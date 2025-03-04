import { Command } from "commander";
import { PrismaClient } from "@prisma/client";
import chalk from "chalk";
import { createGithubClient } from "../lib/githubClient";
import figlet from "figlet";

const prisma = new PrismaClient();

export function listApisCommand() {
  const listApis = new Command("list-apis");

  listApis
    .description(
      "Scan repositories for API endpoints, API keys, and connected APIs (webhooks, integrations, and service connections) and list them from the local Prisma database. Use --org to specify the GitHub organization and --repo to filter by repository name."
    )
    .option("--org <org>", "GitHub organization name (required)")
    .option("--repo <repo>", "Filter by repository name")
    .action(async (options) => {
      // Display a big "LIST APIS" banner using figlet and chalk
      console.log(chalk.blue(figlet.textSync("LIST APIS")));

      const { org, repo } = options;
      if (!org) {
        console.error(chalk.red("Please specify --org <org>"));
        process.exit(1);
      }

      // Pass the token from the environment (which should be set by your main script)
      const token = process.env.GITHUB_TOKEN;
      const octokit = createGithubClient(token);

      // ... (rest of your code remains unchanged)
      try {
        const repos = await octokit.paginate(octokit.rest.repos.listForOrg, {
          org,
          per_page: 100,
        });
        console.log(chalk.blue(`Total repositories fetched: ${repos.length}`));

        if (!repos.length) {
          console.log(chalk.yellow(`No repositories found in organization ${org}`));
          process.exit(0);
        }

        let orgRecord = await prisma.organization.findUnique({
          where: { name: org },
        });
        if (!orgRecord) {
          orgRecord = await prisma.organization.create({
            data: { name: org },
          });
        }

        for (const repoData of repos) {
          if (repo && repoData.name !== repo) continue;

          console.log(chalk.green(`\nScanning repository: ${repoData.name}`));

          let repoRecord = await prisma.repository.findFirst({
            where: { name: repoData.name, orgId: orgRecord.id },
          });
          if (!repoRecord) {
            repoRecord = await prisma.repository.create({
              data: {
                name: repoData.name,
                organization: { connect: { id: orgRecord.id } },
              },
            });
          }

          let treeResponse;
          try {
            treeResponse = await octokit.rest.git.getTree({
              owner: org,
              repo: repoData.name,
              tree_sha: repoData.default_branch!,
              recursive: "1",
            });
          } catch (treeError: unknown) {
            const errorMsg =
              treeError instanceof Error ? treeError.message : String(treeError);
            console.error(
              chalk.red(`Could not fetch file tree for ${repoData.name}: ${errorMsg}`)
            );
            continue;
          }
          const tree = treeResponse.data.tree;
          if (!tree || tree.length === 0) {
            console.log(chalk.yellow(`No files found in repository ${repoData.name}.`));
            continue;
          }

          const codeFiles = tree.filter(
            (file) =>
              file.type === "blob" &&
              file.path !== undefined &&
              /\.(js|ts|py|java|go|rb)$/.test(file.path)
          );

          for (const file of codeFiles) {
            try {
              const fileResponse = await octokit.rest.repos.getContent({
                owner: org,
                repo: repoData.name,
                path: file.path!,
              });
              let content = "";
              if (
                typeof fileResponse.data === "object" &&
                "content" in fileResponse.data &&
                fileResponse.data.content
              ) {
                content = Buffer.from(fileResponse.data.content!, "base64").toString("utf-8");
              }

              console.log(chalk.blue(`\nContent of ${file.path}:`));
              console.log(content);

              const endpointRegex = /(https?:\/\/[^\s'"<>]+)/g;
              const endpointMatches = content.match(endpointRegex);
              if (endpointMatches) {
                console.log(
                  chalk.magenta(
                    `Endpoint matches found in ${file.path}: ${endpointMatches.join(", ")}`
                  )
                );
                for (const url of endpointMatches) {
                  if (url.toLowerCase().includes("api")) {
                    const existingEndpoint = await prisma.apiEndpoint.findFirst({
                      where: {
                        endpoint: url,
                        repository: { id: repoRecord.id },
                      },
                    });
                    if (!existingEndpoint) {
                      await prisma.apiEndpoint.create({
                        data: {
                          endpoint: url,
                          repository: { connect: { id: repoRecord.id } },
                        },
                      });
                      console.log(chalk.yellow(`Found API endpoint in ${repoData.name}: ${url}`));
                    }
                  }
                }
              } else {
                console.log(chalk.red(`No endpoint matches found in ${file.path}`));
              }

              const apiKeyRegex = /api[_-]?key\s*[:=]\s*['"]([^'"]+)['"]/gi;
              const keyMatches = [...content.matchAll(apiKeyRegex)];
              if (keyMatches.length) {
                keyMatches.forEach(async (match) => {
                  const key = match[1];
                  const existingKey = await prisma.apiKey.findFirst({
                    where: {
                      key,
                      repository: { id: repoRecord.id },
                    },
                  });
                  if (!existingKey) {
                    await prisma.apiKey.create({
                      data: {
                        key,
                        repository: { connect: { id: repoRecord.id } },
                      },
                    });
                    console.log(chalk.yellow(`Found API key in ${repoData.name}: ${key}`));
                  }
                });
              } else {
                console.log(chalk.red(`No API key matches found in ${file.path}`));
              }
            } catch (fileError: unknown) {
              const errorMsg =
                fileError instanceof Error ? fileError.message : String(fileError);
              console.error(
                chalk.red(
                  `Error scanning file ${file.path} in ${repoData.name}: ${errorMsg}`
                )
              );
            }
          }

          try {
            const hooksResponse = await octokit.rest.repos.listWebhooks({
              owner: org,
              repo: repoData.name,
            });
            const hooks = hooksResponse.data;
            if (hooks && hooks.length > 0) {
              for (const hook of hooks) {
                const hookUrl = hook.config && hook.config.url ? hook.config.url : "N/A";
                const existingHook = await prisma.apiConnection.findFirst({
                  where: {
                    repository: { id: repoRecord.id },
                    connectionType: "webhook",
                    identifier: hook.id.toString(),
                  },
                });
                if (!existingHook) {
                  await prisma.apiConnection.create({
                    data: {
                      repository: { connect: { id: repoRecord.id } },
                      connectionType: "webhook",
                      identifier: hook.id.toString(),
                      config: JSON.stringify(hook.config),
                    },
                  });
                  console.log(chalk.yellow(`Found webhook in ${repoData.name}: ${hookUrl}`));
                }
              }
            } else {
              console.log(chalk.yellow(`No webhooks found for repository ${repoData.name}.`));
            }
          } catch (hookError: unknown) {
            const errorMsg =
              hookError instanceof Error ? hookError.message : String(hookError);
            console.error(chalk.red(`Error fetching webhooks for ${repoData.name}: ${errorMsg}`));
          }

          try {
            const installationResponse = await octokit.rest.apps.getRepoInstallation({
              owner: org,
              repo: repoData.name,
            });
            const installation = installationResponse.data;
            if (installation) {
              const existingIntegration = await prisma.apiConnection.findFirst({
                where: {
                  repository: { id: repoRecord.id },
                  connectionType: "integration",
                  identifier: installation.id.toString(),
                },
              });
              if (!existingIntegration) {
                await prisma.apiConnection.create({
                  data: {
                    repository: { connect: { id: repoRecord.id } },
                    connectionType: "integration",
                    identifier: installation.id.toString(),
                    config: JSON.stringify(installation),
                  },
                });
                console.log(
                  chalk.yellow(
                    `Found integration in ${repoData.name}: GitHub App installation with id ${installation.id}`
                  )
                );
              }
            }
          } catch (integrationError: unknown) {
            const errorMsg =
              integrationError instanceof Error ? integrationError.message : String(integrationError);
            console.log(
              chalk.yellow(
                `No integration found for repository ${repoData.name} or error: ${errorMsg}`
              )
            );
          }

          console.log(chalk.yellow(`No service connections API available for repository ${repoData.name}.`));
        }
      } catch (scanError: unknown) {
        const errorMsg =
          scanError instanceof Error ? scanError.message : String(scanError);
        console.error(chalk.red("Error scanning repositories:"), errorMsg);
      }

      try {
        const endpoints = await prisma.apiEndpoint.findMany({
          include: {
            repository: {
              include: { organization: true },
            },
          },
          where: {
            repository: {
              ...(org ? { organization: { name: org } } : {}),
              ...(repo ? { name: repo } : {}),
            },
          },
        });

        if (endpoints.length === 0) {
          console.log(chalk.yellow("No API endpoints found in the local database."));
        } else {
          endpoints.forEach((endpoint) => {
            console.log(chalk.green(`Organization: ${endpoint.repository.organization.name}`));
            console.log(chalk.green(`Repository: ${endpoint.repository.name}`));
            console.log(chalk.green(`API Endpoint: ${endpoint.endpoint}`));
            console.log(
              chalk.gray(`Discovered on: ${new Date(endpoint.createdAt).toLocaleString()}`)
            );
            console.log(chalk.blue("-------------------------------------------------"));
          });
          console.log(
            chalk.yellow(
              "API endpoints stored in database: " +
                endpoints.map((ep) => ep.endpoint).join(" \n")
            )
          );
        }

        const apiKeys = await prisma.apiKey.findMany({
          include: {
            repository: {
              include: { organization: true },
            },
          },
          where: {
            repository: {
              ...(org ? { organization: { name: org } } : {}),
              ...(repo ? { name: repo } : {}),
            },
          },
        });
        if (apiKeys.length !== 0) {
          apiKeys.forEach((apiKey) => {
            console.log(chalk.green(`Organization: ${apiKey.repository.organization.name}`));
            console.log(chalk.green(`Repository: ${apiKey.repository.name}`));
            console.log(chalk.green(`API Key: ${apiKey.key}`));
            console.log(
              chalk.gray(`Stored on: ${new Date(apiKey.createdAt).toLocaleString()}`)
            );
            console.log(chalk.blue("-------------------------------------------------"));
          });
        }

        const connections = await prisma.apiConnection.findMany({
          include: {
            repository: {
              include: { organization: true },
            },
          },
          where: {
            repository: {
              ...(org ? { organization: { name: org } } : {}),
              ...(repo ? { name: repo } : {}),
            },
          },
        });
        if (connections.length === 0) {
          console.log(chalk.yellow("No API connections found in the local database."));
        } else {
          connections.forEach((connection) => {
            console.log(chalk.green(`Organization: ${connection.repository.organization.name}`));
            console.log(chalk.green(`Repository: ${connection.repository.name}`));
            console.log(chalk.green(`Connection Type: ${connection.connectionType}`));
            console.log(chalk.green(`Identifier: ${connection.identifier}`));
            console.log(
              chalk.gray(`Stored on: ${new Date(connection.createdAt).toLocaleString()}`)
            );
            console.log(chalk.blue("-------------------------------------------------"));
          });
          console.log(
            chalk.yellow(
              "API connections stored in database: " +
                connections.map((c) => `${c.connectionType}: ${c.identifier}`).join(" \n")
            )
          );
        }
      } catch (fetchError: unknown) {
        const errorMsg =
          fetchError instanceof Error ? fetchError.message : String(fetchError);
        console.error(chalk.red("Error retrieving data from local DB:"), errorMsg);
      } finally {
        await prisma.$disconnect();
      }
    });

  return listApis;
}

export default listApisCommand;
