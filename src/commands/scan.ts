import { Command } from "commander";
import { PrismaClient } from "@prisma/client";
import { createGithubClient } from "../lib/githubClient";

const prisma = new PrismaClient();

export function scanCommand() {
  const scan = new Command("scan");

  scan
    .description("Scan repositories for security issues")
    .option("--org <org>", "Github organization name")
    .action(async (options) => {
      const { org } = options;

      if (!org) {
        console.error("Please specify --org <org>");
        process.exit(1);
      }

      const octokit = createGithubClient();

      try {
        // 1. Fetch the repos from the organization
        const { data: repos } = await octokit.rest.repos.listForOrg({
          org,
          per_page: 100,
        });

        // 2. For each repo, fetch Dependabot and code scanning alerts
        for (const repo of repos) {
          console.log(`Scanning repo: ${repo.name}`);

          // Dependabot alerts
          const { data: dependabotAlerts } = await octokit.request(
            "GET /repos/{owner}/{repo}/dependabot/alerts",
            { owner: org, repo: repo.name }
          );

          // Code scanning alerts with graceful error handling
          let codeScanAlerts: any[] = [];
          try {
            const response = await octokit.request(
              "GET /repos/{owner}/{repo}/code-scanning/alerts",
              { owner: org, repo: repo.name }
            );
            codeScanAlerts = response.data;
          } catch (error: any) {
            if (error.status === 404 && error.message.includes("no analysis found")) {
              console.log(`No code scanning alerts found for repo: ${repo.name}`);
              codeScanAlerts = [];
            } else {
              throw error;
            }
          }

          // 2a. Ensure organization and repository exist in the database.
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

          // 2b. Insert Dependabot alerts into the database
          for (const alert of dependabotAlerts) {
            await prisma.alert.create({
              data: {
                alertType: 'dependabot',
                severity: alert.security_advisory?.severity || 'UNKNOWN',
                description: alert.security_advisory?.description || '',
                repository: { connect: { id: repoRecord.id } },
              },
            });
          }

          // 2c. Insert Code scanning alerts into the database
          for (const alert of codeScanAlerts) {
            await prisma.alert.create({
              data: {
                alertType: 'code-scanning',
                severity: alert.rule?.severity || 'UNKNOWN',
                description: alert.rule?.description || '',
                repository: { connect: { id: repoRecord.id } },
              },
            });
          }
        }

        console.log("Security scan completed successfully");
      } catch (error) {
        console.error("Error during scan: ", error);
        process.exit(1);
      } finally {
        await prisma.$disconnect();
      }
    });

  return scan;
}
