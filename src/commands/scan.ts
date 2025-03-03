// this will be used to perform
// full security scanning (dependabot & code scanning alerts)

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
        //1. Fetch the repos
        const { data: repos } = await octokit.rest.repos.listForOrg({
          org,
          per_page: 100,
        });

        //2. For each repo, fetch Dependabot and code scanning alerts
        for (const repo of repos) {
          //Dependabot
          const { data: dependabotAlerts } = await octokit.request(
            "GET /repos/{owner}/{repos}/dependabot/alerts",
            { owner: org, repo: repo.name }
          );

          //Code scanning
          const { data: codeScanAlerts } = await octokit.request(
            "GET /repos/{owner}/{repo}/code-scanning/alerts",
            { owner: org, repo: repo.name }
          );

          //Save to DB via Prisma
          // 2a. Ensure organization and repo exist in db.

          let orgRecord = await prisma.organization.findUnique({
            where: { name: org },
          });

          if(!orgRecord){
            //TODO: Check if upsert is usable here
            orgRecord = await prisma.organization.create({ 
                data: { name: org },
            })
          }

          let repoRecord = await prisma.repository.findFirst({
            where: {
                name: repo.name,
                orgId: orgRecord.id,
            },
          });

          if(!repoRecord){
            repoRecord = await prisma.repository.create({
                data: {
                    name: repo.name,
                    organization: { connect: { id: orgRecord.id }},
                },
            });
          }


          //2b. Insert alertsz

          for(const alert of dependabotAlerts){
            await prisma.alert.create({
                data: {
                    alertType: 'code-scanning',
                    severity: alert.rule.severity || 'UNKNOWN', //store the severity if not known then store `UNKNOWN`
                    description: alert.rule.description || '',
                    repository: { connect: {id: repoRecord.id}}
                },
            });
          }
        }

        console.log('Security scan completed successfully')
      } catch (error) {
        console.error('Error during scan: ', error);
        process.exit(1);
      } finally{
        //disconnect db
        await prisma.$disconnect();
      }
    });

    return scan;
}
