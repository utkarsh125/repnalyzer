import { Command } from "commander";
import { PrismaClient } from "@prisma/client";
import chalk from "chalk";
import { createGithubClient } from "../lib/githubClient";
import figlet from "figlet";

const prisma = new PrismaClient();

export function accessCommand() {
  const access = new Command("access");

  access
    .description("Analyze access control (collaborators, teams, permissions) for an organization")
    .option("--org <org>", "GitHub organization name")
    .action(async (options) => {
      const { org } = options;
      if (!org) {
        console.error(chalk.red("❌ Please specify --org <org>"));
        process.exit(1);
      }

      console.log(chalk.blue(figlet.textSync("access")));
      console.log(chalk.cyan("🔍 Repanalyzer is starting...\n"));

      // Await the async GitHub client creation (will prompt if token is missing)
      const octokit = await createGithubClient(process.env.GITHUB_TOKEN);

      try {
        // 1. Fetch repositories
        const { data: repos } = await octokit.rest.repos.listForOrg({
          org,
          per_page: 100,
        });

        for (const repo of repos) {
          console.log(chalk.green(`\n📂 Repository: ${repo.name}`));

          // 2. Get collaborators
          const { data: collaborators } = await octokit.rest.repos.listCollaborators({
            owner: org,
            repo: repo.name,
            per_page: 100,
          });

          const userCommits: Record<string, number> = {};

          // 3. Fetch commit counts for each collaborator
          for (const collab of collaborators) {
            const username = collab.login;
            userCommits[username] = 0; // Default commit count

            try {
              let commitCount = 0;
              let page = 1;
              let hasMoreCommits = true;

              while (hasMoreCommits) {
                const { data: commits } = await octokit.rest.repos.listCommits({
                  owner: org,
                  repo: repo.name,
                  author: username,
                  per_page: 100,
                  page: page,
                });

                commitCount += commits.length;

                if (commits.length < 100) {
                  hasMoreCommits = false;
                } else {
                  page++;
                }
              }

              userCommits[username] = commitCount;
            } catch (commitError: any) {
              if (commitError.status === 409) {
                console.warn(chalk.yellow(`⚠️ Repository '${repo.name}' is empty. Skipping commits...`));
              } else {
                console.error(chalk.red(`❌ Failed to fetch commits for ${username} in ${repo.name}: ${commitError.message}`));
              }
            }
          }

          // 4. Format and display the output
          const formattedUsers = collaborators
            .map((collab) => {
              const username = collab.login;
              const commitCount = userCommits[username] || 0;

              let role = chalk.gray("Contributor");
              if (collab.permissions?.admin) role = chalk.red("Admin");
              else if (collab.permissions?.maintain) role = chalk.blue("Maintainer");
              else if (collab.permissions?.push) role = chalk.green("Developer");
              else if (collab.permissions?.pull) role = chalk.yellow("Viewer");

              return { username, role, commits: commitCount };
            })
            .sort((a, b) => b.commits - a.commits)
            .map(
              (user, index) =>
                `${chalk.magenta(index + 1)}. @${chalk.bold(user.username)} (${user.role}) - ${chalk.cyan(user.commits.toLocaleString())} commits`
            )
            .join("\n");

          console.log(formattedUsers.length ? formattedUsers : chalk.gray("No collaborators found."));
        }

        console.log(chalk.green("\n✅ Access control analysis completed successfully."));
      } catch (error) {
        console.error(chalk.red("❌ Error analyzing access:"), error);
        process.exit(1);
      } finally {
        await prisma.$disconnect();
      }
    });

  return access;
}
