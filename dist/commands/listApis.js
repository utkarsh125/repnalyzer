"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listApisCommand = listApisCommand;
const commander_1 = require("commander");
const client_1 = require("@prisma/client");
const chalk_1 = __importDefault(require("chalk"));
const githubClient_1 = require("../lib/githubClient");
const figlet_1 = __importDefault(require("figlet"));
const prisma = new client_1.PrismaClient();
function listApisCommand() {
    const listApis = new commander_1.Command("list-apis");
    listApis
        .description("Scan repositories for API endpoints and API keys, and list them from the local Prisma database. Use --org to specify the GitHub organization and --repo to filter by repository name.")
        .option("--org <org>", "GitHub organization name (required)")
        .option("--repo <repo>", "Filter by repository name")
        .action(async (options) => {
        // Display a big "LIST APIS" banner using figlet and chalk
        console.log(chalk_1.default.blue(figlet_1.default.textSync("LIST APIS")));
        const { org, repo } = options;
        if (!org) {
            console.error(chalk_1.default.red("Please specify --org <org>"));
            process.exit(1);
        }
        const octokit = (0, githubClient_1.createGithubClient)();
        // 1. Scan GitHub repositories for API endpoints and API keys and store them in the DB
        try {
            // Use Octokit's pagination helper to fetch all repositories for the organization
            const repos = await octokit.paginate(octokit.rest.repos.listForOrg, {
                org,
                per_page: 100,
            });
            console.log(chalk_1.default.blue(`Total repositories fetched: ${repos.length}`));
            if (!repos.length) {
                console.log(chalk_1.default.yellow(`No repositories found in organization ${org}`));
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
                console.log(chalk_1.default.green(`\nScanning repository: ${repoData.name}`));
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
                        tree_sha: repoData.default_branch, // non-null assertion
                        recursive: "1",
                    });
                }
                catch (treeError) {
                    const errorMsg = treeError instanceof Error ? treeError.message : String(treeError);
                    console.error(chalk_1.default.red(`Could not fetch file tree for ${repoData.name}: ${errorMsg}`));
                    continue;
                }
                const tree = treeResponse.data.tree;
                if (!tree || tree.length === 0) {
                    console.log(chalk_1.default.yellow(`No files found in repository ${repoData.name}.`));
                    continue;
                }
                // Filter for code files (only include files with a defined path)
                const codeFiles = tree.filter((file) => file.type === "blob" &&
                    file.path !== undefined &&
                    /\.(js|ts|py|java|go|rb)$/.test(file.path));
                // Scan each code file for API endpoints and API keys
                for (const file of codeFiles) {
                    try {
                        const fileResponse = await octokit.rest.repos.getContent({
                            owner: org,
                            repo: repoData.name,
                            path: file.path,
                        });
                        let content = "";
                        if (typeof fileResponse.data === "object" &&
                            "content" in fileResponse.data &&
                            fileResponse.data.content) {
                            content = Buffer.from(fileResponse.data.content, "base64").toString("utf-8");
                        }
                        // Print the file content to the console before processing
                        console.log(chalk_1.default.blue(`\nContent of ${file.path}:`));
                        console.log(content);
                        // --- API Endpoint Extraction ---
                        // Adjusted regex: allow additional delimiters like angle brackets
                        const endpointRegex = /(https?:\/\/[^\s'"<>]+)/g;
                        const endpointMatches = content.match(endpointRegex);
                        if (endpointMatches) {
                            console.log(chalk_1.default.magenta(`Endpoint matches found in ${file.path}: ${endpointMatches.join(", ")}`));
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
                                        console.log(chalk_1.default.yellow(`Found API endpoint in ${repoData.name}: ${url}`));
                                    }
                                }
                            }
                        }
                        else {
                            console.log(chalk_1.default.red(`No endpoint matches found in ${file.path}`));
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
                                    console.log(chalk_1.default.yellow(`Found API key in ${repoData.name}: ${key}`));
                                }
                            });
                        }
                        else {
                            console.log(chalk_1.default.red(`No API key matches found in ${file.path}`));
                        }
                    }
                    catch (fileError) {
                        const errorMsg = fileError instanceof Error ? fileError.message : String(fileError);
                        console.error(chalk_1.default.red(`Error scanning file ${file.path} in ${repoData.name}: ${errorMsg}`));
                        // Continue with the next file if an error occurs
                    }
                }
            }
        }
        catch (scanError) {
            const errorMsg = scanError instanceof Error ? scanError.message : String(scanError);
            console.error(chalk_1.default.red("Error scanning repositories:"), errorMsg);
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
                console.log(chalk_1.default.yellow("No API endpoints found in the local database."));
            }
            else {
                endpoints.forEach((endpoint) => {
                    console.log(chalk_1.default.green(`Organization: ${endpoint.repository.organization.name}`));
                    console.log(chalk_1.default.green(`Repository: ${endpoint.repository.name}`));
                    console.log(chalk_1.default.green(`API Endpoint: ${endpoint.endpoint}`));
                    console.log(chalk_1.default.gray(`Discovered on: ${new Date(endpoint.createdAt).toLocaleString()}`));
                    console.log(chalk_1.default.blue("-------------------------------------------------"));
                });
                // Added summary line in yellow
                console.log(chalk_1.default.yellow("API endpoints stored in database: " +
                    endpoints.map((ep) => ep.endpoint).join(" \n")));
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
                console.log(chalk_1.default.yellow("No API keys found in the local database."));
            }
            else {
                apiKeys.forEach((apiKey) => {
                    console.log(chalk_1.default.green(`Organization: ${apiKey.repository.organization.name}`));
                    console.log(chalk_1.default.green(`Repository: ${apiKey.repository.name}`));
                    console.log(chalk_1.default.green(`API Key: ${apiKey.key}`));
                    console.log(chalk_1.default.gray(`Stored on: ${new Date(apiKey.createdAt).toLocaleString()}`));
                    console.log(chalk_1.default.blue("-------------------------------------------------"));
                });
            }
        }
        catch (fetchError) {
            const errorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
            console.error(chalk_1.default.red("Error retrieving data from local DB:"), errorMsg);
        }
        finally {
            await prisma.$disconnect();
        }
    });
    return listApis;
}
exports.default = listApisCommand;
