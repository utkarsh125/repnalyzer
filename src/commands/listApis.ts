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
      "Scan repositories for API endpoints and API keys, and list them from the local Prisma database. Use --org to specify the GitHub organization and --repo to filter by repository name."
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

      const octokit = createGithubClient();

      // 1. Scan GitHub repositories for API endpoints and API keys and store them in the DB
      try {
        // Use Octokit's pagination helper to fetch all repositories for the organization
        const repos = await octokit.paginate(octokit.rest.repos.listForOrg, {
          org,
          per_page: 100,
        });
        console.log(chalk.blue(`Total repositories fetched: ${repos.length}`));

        if (!repos.length) {
          console.log(chalk.yellow(`No repositories found in organization ${org}`));
          process.exit(0);
        }

        // Ensure organization exists in our DB
        let orgRecord = await prisma.organization.findUnique({
          where: { name: org },
        });
        if (!orgRecord) {
          orgRecord = await prisma.organization.create({
            data: { name: org },
          });
        }

        // Process each repository
        for (const repoData of repos) {
          // If a repository filter is provided, skip non-matching repos
          if (repo && repoData.name !== repo) {
            continue;
          }

          console.log(chalk.green(`\nScanning repository: ${repoData.name}`));

          // (Removed the size check so even repos reporting size 0 are processed)

          // Ensure repository record exists in our DB
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

          // Fetch file tree from the repository's default branch
          let treeResponse;
          try {
            treeResponse = await octokit.rest.git.getTree({
              owner: org,
              repo: repoData.name,
              tree_sha: repoData.default_branch!, // non-null assertion
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

          // Filter for code files (only include files with a defined path)
          const codeFiles = tree.filter(
            (file) =>
              file.type === "blob" &&
              file.path !== undefined &&
              /\.(js|ts|py|java|go|rb)$/.test(file.path)
          );

          // Scan each code file for API endpoints and API keys
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

              // Print the file content to the console before processing
              console.log(chalk.blue(`\nContent of ${file.path}:`));
              console.log(content);

              // --- API Endpoint Extraction ---
              // Adjusted regex: allow additional delimiters like angle brackets
              const endpointRegex = /(https?:\/\/[^\s'"<>]+)/g;
              const endpointMatches = content.match(endpointRegex);
              if (endpointMatches) {
                console.log(
                  chalk.magenta(
                    `Endpoint matches found in ${file.path}: ${endpointMatches.join(", ")}`
                  )
                );
                for (const url of endpointMatches) {
                  // Filter only those endpoints that include "api"
                  if (url.toLowerCase().includes("api")) {
                    // Check if this API endpoint is already in the DB for this repository
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

              // --- API Key Extraction ---
              // Regex to match typical API key patterns (e.g., "apiKey": "value", "api-key" = 'value')
              const apiKeyRegex = /api[_-]?key\s*[:=]\s*['"]([^'"]+)['"]/gi;
              const keyMatches = [...content.matchAll(apiKeyRegex)];
              if (keyMatches.length) {
                keyMatches.forEach(async (match) => {
                  const key = match[1];
                  // Check if this API key is already in the DB for this repository
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
              // Continue with the next file if an error occurs
            }
          }
        }
      } catch (scanError: unknown) {
        const errorMsg =
          scanError instanceof Error ? scanError.message : String(scanError);
        console.error(chalk.red("Error scanning repositories:"), errorMsg);
      }

      // 2. Now fetch and display the API endpoints and API keys from the local DB
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
          // Added summary line in yellow
          console.log(
            chalk.yellow(
              "API endpoints stored in database: " +
                endpoints.map((ep) => ep.endpoint).join(" \n")
            )
          );
        }

        // Fetch and display API keys as well (assumes you have a Prisma model for ApiKey)
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
        if (apiKeys.length === 0) {
        //   console.log(chalk.yellow("No API keys found in the local database."));
        } else {
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
