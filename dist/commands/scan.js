"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanCommand = scanCommand;
const commander_1 = require("commander");
const client_1 = require("@prisma/client");
const chalk_1 = __importDefault(require("chalk"));
const githubClient_1 = require("../lib/githubClient");
const figlet_1 = __importDefault(require("figlet"));
const prisma = new client_1.PrismaClient();
function scanCommand() {
    const scan = new commander_1.Command("scan");
    scan
        .description("Scan GitHub organization repositories for security issues. This command scans for Dependabot alerts, code scanning alerts, and checks for the presence and errors of GitHub Actions workflows.")
        .option("--org <org>", "Github organization name")
        .action(async (options) => {
        const { org } = options;
        if (!org) {
            console.error(chalk_1.default.red("Please specify --org <org>"));
            process.exit(1);
        }
        console.log(chalk_1.default.blue(figlet_1.default.textSync("SCAN")));
        // Await the async GitHub client creation
        const octokit = await (0, githubClient_1.createGithubClient)(process.env.GITHUB_TOKEN);
        try {
            // 1. Fetch the repos from the organization
            const { data: repos } = await octokit.rest.repos.listForOrg({
                org,
                per_page: 100,
            });
            if (!repos.length) {
                console.log(chalk_1.default.yellow(`No repositories found in organization ${org}`));
                return;
            }
            // 2. Process each repository
            for (const repo of repos) {
                console.log(chalk_1.default.green(`\nScanning repo: ${repo.name}`));
                if (repo.size === 0) {
                    console.log(chalk_1.default.yellow(`Repo ${repo.name} is empty. Skipping further scans.`));
                    continue;
                }
                // 2a. Fetch Dependabot alerts
                const { data: dependabotAlerts } = await octokit.request("GET /repos/{owner}/{repo}/dependabot/alerts", { owner: org, repo: repo.name });
                // 2b. Fetch Code scanning alerts
                let codeScanAlerts = [];
                try {
                    const response = await octokit.request("GET /repos/{owner}/{repo}/code-scanning/alerts", { owner: org, repo: repo.name });
                    codeScanAlerts = response.data;
                }
                catch (error) {
                    if (error.status === 404 && error.message.includes("no analysis found")) {
                        console.log(chalk_1.default.yellow(`No code scanning alerts found for repo: ${repo.name}`));
                        codeScanAlerts = [];
                    }
                    else {
                        throw error;
                    }
                }
                // 2c. Check for GitHub Actions workflows and list errors (1 error per action file)
                try {
                    const { data: workflowsData } = await octokit.request("GET /repos/{owner}/{repo}/actions/workflows", { owner: org, repo: repo.name });
                    if (!workflowsData.workflows || workflowsData.workflows.length === 0) {
                        console.log(chalk_1.default.red(`No GitHub Actions workflows found for repo: ${repo.name}`));
                    }
                    else {
                        console.log(chalk_1.default.green(`GitHub Actions workflows found for repo: ${repo.name}`));
                        let workflowErrors = [];
                        for (const workflow of workflowsData.workflows) {
                            const { data: runsData } = await octokit.request("GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs", { owner: org, repo: repo.name, workflow_id: workflow.id, per_page: 1 });
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
                        if (workflowErrors.length > 0) {
                            workflowErrors.forEach((err) => {
                                console.log(chalk_1.default.red(`Error in workflow "${err.workflow}": ${err.error}`));
                            });
                        }
                        else {
                            console.log(chalk_1.default.green("No workflow errors found"));
                        }
                    }
                }
                catch (error) {
                    if (error.status === 404) {
                        console.log(chalk_1.default.red(`No GitHub Actions workflows found for repo: ${repo.name}`));
                    }
                    else {
                        throw error;
                    }
                }
                // 2d. Ensure organization and repository exist in the database.
                let orgRecord = await prisma.organization.findUnique({ where: { name: org } });
                if (!orgRecord) {
                    orgRecord = await prisma.organization.create({ data: { name: org } });
                }
                let repoRecord = await prisma.repository.findFirst({
                    where: { name: repo.name, orgId: orgRecord.id },
                });
                if (!repoRecord) {
                    repoRecord = await prisma.repository.create({
                        data: { name: repo.name, organization: { connect: { id: orgRecord.id } } },
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
            console.log(chalk_1.default.blue("\nSecurity scan completed successfully"));
        }
        catch (error) {
            console.error(chalk_1.default.red("Error during scan: "), error);
            process.exit(1);
        }
        finally {
            await prisma.$disconnect();
        }
    });
    return scan;
}
