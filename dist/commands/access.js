"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.accessCommand = accessCommand;
const commander_1 = require("commander");
const client_1 = require("@prisma/client");
const githubClient_1 = require("../lib/githubClient");
const prisma = new client_1.PrismaClient();
function accessCommand() {
    const access = new commander_1.Command("access");
    access
        .description("Analyze access control (collaborators, teams, permissions) for an organization")
        .option("--org <org>", "GitHub organization name")
        .action(async (options) => {
        const { org } = options;
        if (!org) {
            console.error("Please specify --org <org>");
            process.exit(1);
        }
        const octokit = (0, githubClient_1.createGithubClient)();
        try {
            // 1. Fetch repos for the organization
            const { data: repos } = await octokit.rest.repos.listForOrg({
                org,
                per_page: 100,
            });
            for (const repo of repos) {
                console.log(`\nRepository: ${repo.name}`);
                // 2. List collaborators for each repo
                const { data: collaborators } = await octokit.rest.repos.listCollaborators({
                    owner: org,
                    repo: repo.name,
                    per_page: 100,
                });
                // 3. Print or store collaborator data
                for (const collab of collaborators) {
                    // collab.permissions is an object like { admin: true, push: true, pull: true }
                    console.log(` - ${collab.login}: ${JSON.stringify(collab.permissions)}`);
                    // (Optional) Store collaborator info in DB
                    // You could do something like:
                    // 1) Upsert user
                    // 2) Create or update user access record
                    // Example:
                    // const user = await prisma.user.upsert({
                    //   where: { login: collab.login },
                    //   update: {},
                    //   create: { login: collab.login },
                    // });
                    //
                    // const repoRecord = await prisma.repository.findFirst({
                    //   where: {
                    //     name: repo.name,
                    //     // orgId if you track that, etc.
                    //   },
                    // });
                    //
                    // await prisma.userAccess.upsert({
                    //   where: {
                    //     userId_repoId: {
                    //       userId: user.id,
                    //       repoId: repoRecord?.id || "",
                    //     },
                    //   },
                    //   update: {
                    //     permissions: JSON.stringify(collab.permissions),
                    //   },
                    //   create: {
                    //     userId: user.id,
                    //     repoId: repoRecord?.id || "",
                    //     permissions: JSON.stringify(collab.permissions),
                    //   },
                    // });
                }
            }
            console.log("\nAccess control analysis completed successfully.");
        }
        catch (error) {
            console.error("Error analyzing access:", error);
            process.exit(1);
        }
        finally {
            await prisma.$disconnect();
        }
    });
    return access;
}
