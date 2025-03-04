import { Command } from "commander";
import { PrismaClient } from "@prisma/client";
import chalk from "chalk";
import { createGithubClient } from "../lib/githubClient";
import figlet from "figlet";

const prisma = new PrismaClient();

export function scanCommand() {
  const scan = new Command("scan");

  scan
    .description(
      "Scan GitHub organization repositories for security issues. This command scans for Dependabot alerts, code scanning alerts, and checks for the presence and errors of GitHub Actions workflows."
    )
    .option("--org <org>", "Github organization name")
    .action(async (options) => {
      const { org } = options;

      if (!org) {
        console.error(chalk.red("Please specify --org <org>"));
        process.exit(1);
      }

      // Display a big "SCAN" banner using figlet and chalk
      console.log(chalk.blue(figlet.textSync("SCAN")));

      const octokit = createGithubClient();

      try {
        // 1. Fetch the repos from the organization
        const { data: repos } = await octokit.rest.repos.listForOrg({
          org,
          per_page: 100,
        });

        if (!repos.length) {
          console.log(chalk.yellow(`No repositories found in organization ${org}`));
          return;
        }

        // 2. Process each repository
        for (const repo of repos) {
          console.log(chalk.green(`\nScanning repo: ${repo.name}`));

          // Handle empty repositories gracefully by checking the repo size.
          if (repo.size === 0) {
            console.log(chalk.yellow(`Repo ${repo.name} is empty. Skipping further scans.`));
            continue;
          }

          // 2a. Fetch Dependabot alerts
          const { data: dependabotAlerts } = await octokit.request(
            "GET /repos/{owner}/{repo}/dependabot/alerts",
            { owner: org, repo: repo.name }
          );

          // 2b. Fetch Code scanning alerts with graceful error handling
          let codeScanAlerts: any[] = [];
          try {
            const response = await octokit.request(
              "GET /repos/{owner}/{repo}/code-scanning/alerts",
              { owner: org, repo: repo.name }
            );
            codeScanAlerts = response.data;
          } catch (error: any) {
            if (error.status === 404 && error.message.includes("no analysis found")) {
              console.log(chalk.yellow(`No code scanning alerts found for repo: ${repo.name}`));
              codeScanAlerts = [];
            } else {
              throw error;
            }
          }

          // 2c. Check for GitHub Actions workflows and list errors (1 error per action file)
          try {
            const { data: workflowsData } = await octokit.request(
              "GET /repos/{owner}/{repo}/actions/workflows",
              { owner: org, repo: repo.name }
            );
            if (!workflowsData.workflows || workflowsData.workflows.length === 0) {
              console.log(chalk.red(`No GitHub Actions workflows found for repo: ${repo.name}`));
            } else {
              console.log(chalk.green(`GitHub Actions workflows found for repo: ${repo.name}`));

              let workflowErrors: { workflow: string; error: string }[] = [];

              for (const workflow of workflowsData.workflows) {
                // For each workflow, fetch the latest run
                const { data: runsData } = await octokit.request(
                  "GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs",
                  { owner: org, repo: repo.name, workflow_id: workflow.id, per_page: 1 }
                );
                if (runsData.total_count > 0) {
                  const latestRun = runsData.workflow_runs[0];
                  if (latestRun.conclusion && latestRun.conclusion !== "success") {
                    workflowErrors.push({
                      workflow: workflow.name,
                      error: `Latest run concluded with ${latestRun.conclusion}`,
                    });
                  }
                }
              }

              // Output errors if any, else print that no errors were found
              if (workflowErrors.length > 0) {
                workflowErrors.forEach((err) => {
                  console.log(chalk.red(`Error in workflow "${err.workflow}": ${err.error}`));
                });
              } else {
                console.log(chalk.green("No workflow errors found"));
              }
            }
          } catch (error: any) {
            if (error.status === 404) {
              console.log(chalk.red(`No GitHub Actions workflows found for repo: ${repo.name}`));
            } else {
              throw error;
            }
          }

          // 2d. Ensure organization and repository exist in the database.
          let orgRecord = await prisma.organization.findUnique({
            where: { name: org },
          });

          if (!orgRecord) {
            orgRecord = await prisma.organization.create({
              data: { name: org },
            });
          }

          let repoRecord = await prisma.repository.findFirst({
            where: {
              name: repo.name,
              orgId: orgRecord.id,
            },
          });

          if (!repoRecord) {
            repoRecord = await prisma.repository.create({
              data: {
                name: repo.name,
                organization: { connect: { id: orgRecord.id } },
              },
            });
          }

          // 2e. Insert Dependabot alerts into the database
          for (const alert of dependabotAlerts) {
            await prisma.alert.create({
              data: {
                alertType: "dependabot",
                severity: alert.security_advisory?.severity || "UNKNOWN",
                description: alert.security_advisory?.description || "",
                repository: { connect: { id: repoRecord.id } },
              },
            });
          }

          // 2f. Insert Code scanning alerts into the database
          for (const alert of codeScanAlerts) {
            await prisma.alert.create({
              data: {
                alertType: "code-scanning",
                severity: alert.rule?.severity || "UNKNOWN",
                description: alert.rule?.description || "",
                repository: { connect: { id: repoRecord.id } },
              },
            });
          }
        }

        console.log(chalk.blue("\nSecurity scan completed successfully"));
      } catch (error) {
        console.error(chalk.red("Error during scan: "), error);
        process.exit(1);
      } finally {
        await prisma.$disconnect();
      }
    });

  return scan;
}
