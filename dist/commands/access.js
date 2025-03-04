"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.accessCommand = accessCommand;
const commander_1 = require("commander");
const client_1 = require("@prisma/client");
const chalk_1 = __importDefault(require("chalk"));
const githubClient_1 = require("../lib/githubClient");
const figlet_1 = __importDefault(require("figlet"));
const prisma = new client_1.PrismaClient();
function accessCommand() {
    const access = new commander_1.Command("access");
    access
        .description("Analyze access control (collaborators, teams, permissions) for an organization")
        .option("--org <org>", "GitHub organization name")
        .action(async (options) => {
        const { org } = options;
        if (!org) {
            console.error(chalk_1.default.red("❌ Please specify --org <org>"));
            process.exit(1);
        }
        console.log(chalk_1.default.blue(figlet_1.default.textSync("access")));
        console.log(chalk_1.default.cyan("🔍 Repanalyzer is starting...\n"));
        // Await the async GitHub client creation (will prompt if token is missing)
        const octokit = await (0, githubClient_1.createGithubClient)(process.env.GITHUB_TOKEN);
        try {
            // 1. Fetch repositories
            const { data: repos } = await octokit.rest.repos.listForOrg({
                org,
                per_page: 100,
            });
            for (const repo of repos) {
                console.log(chalk_1.default.green(`\n📂 Repository: ${repo.name}`));
                // 2. Get collaborators
                const { data: collaborators } = await octokit.rest.repos.listCollaborators({
                    owner: org,
                    repo: repo.name,
                    per_page: 100,
                });
                const userCommits = {};
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
                            }
                            else {
                                page++;
                            }
                        }
                        userCommits[username] = commitCount;
                    }
                    catch (commitError) {
                        if (commitError.status === 409) {
                            console.warn(chalk_1.default.yellow(`⚠️ Repository '${repo.name}' is empty. Skipping commits...`));
                        }
                        else {
                            console.error(chalk_1.default.red(`❌ Failed to fetch commits for ${username} in ${repo.name}: ${commitError.message}`));
                        }
                    }
                }
                // 4. Format and display the output
                const formattedUsers = collaborators
                    .map((collab) => {
                    const username = collab.login;
                    const commitCount = userCommits[username] || 0;
                    let role = chalk_1.default.gray("Contributor");
                    if (collab.permissions?.admin)
                        role = chalk_1.default.red("Admin");
                    else if (collab.permissions?.maintain)
                        role = chalk_1.default.blue("Maintainer");
                    else if (collab.permissions?.push)
                        role = chalk_1.default.green("Developer");
                    else if (collab.permissions?.pull)
                        role = chalk_1.default.yellow("Viewer");
                    return { username, role, commits: commitCount };
                })
                    .sort((a, b) => b.commits - a.commits)
                    .map((user, index) => `${chalk_1.default.magenta(index + 1)}. @${chalk_1.default.bold(user.username)} (${user.role}) - ${chalk_1.default.cyan(user.commits.toLocaleString())} commits`)
                    .join("\n");
                console.log(formattedUsers.length ? formattedUsers : chalk_1.default.gray("No collaborators found."));
            }
            console.log(chalk_1.default.green("\n✅ Access control analysis completed successfully."));
        }
        catch (error) {
            console.error(chalk_1.default.red("❌ Error analyzing access:"), error);
            process.exit(1);
        }
        finally {
            await prisma.$disconnect();
        }
    });
    return access;
}
