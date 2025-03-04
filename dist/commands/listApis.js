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
        .description("Scan repositories for API endpoints, API keys, and connected APIs (webhooks, integrations, and service connections) and list them from the local Prisma database. Use --org to specify the GitHub organization and --repo to filter by repository name.")
        .option("--org <org>", "GitHub organization name (required)")
        .option("--repo <repo>", "Filter by repository name")
        .action(async (options) => {
        console.log(chalk_1.default.blue(figlet_1.default.textSync("LIST APIS")));
        const { org, repo } = options;
        if (!org) {
            console.error(chalk_1.default.red("Please specify --org <org>"));
            process.exit(1);
        }
        // Get token from process.env and await GitHub client creation
        const token = process.env.GITHUB_TOKEN;
        const octokit = await (0, githubClient_1.createGithubClient)(token);
        try {
            const repos = await octokit.paginate(octokit.rest.repos.listForOrg, {
                org,
                per_page: 100,
            });
            console.log(chalk_1.default.blue(`Total repositories fetched: ${repos.length}`));
            if (!repos.length) {
                console.log(chalk_1.default.yellow(`No repositories found in organization ${org}`));
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
                if (repo && repoData.name !== repo)
                    continue;
                console.log(chalk_1.default.green(`\nScanning repository: ${repoData.name}`));
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
                        tree_sha: repoData.default_branch,
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
                const codeFiles = tree.filter((file) => file.type === "blob" &&
                    file.path !== undefined &&
                    /\.(js|ts|py|java|go|rb)$/.test(file.path));
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
                        console.log(chalk_1.default.blue(`\nContent of ${file.path}:`));
                        console.log(content);
                        const endpointRegex = /(https?:\/\/[^\s'"<>]+)/g;
                        const endpointMatches = content.match(endpointRegex);
                        if (endpointMatches) {
                            console.log(chalk_1.default.magenta(`Endpoint matches found in ${file.path}: ${endpointMatches.join(", ")}`));
                            for (const url of endpointMatches) {
                                // Process every URL found
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
                        else {
                            console.log(chalk_1.default.red(`No endpoint matches found in ${file.path}`));
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
                                console.log(chalk_1.default.yellow(`Found webhook in ${repoData.name}: ${hookUrl}`));
                            }
                        }
                    }
                    else {
                        console.log(chalk_1.default.yellow(`No webhooks found for repository ${repoData.name}.`));
                    }
                }
                catch (hookError) {
                    const errorMsg = hookError instanceof Error ? hookError.message : String(hookError);
                    console.error(chalk_1.default.red(`Error fetching webhooks for ${repoData.name}: ${errorMsg}`));
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
                            console.log(chalk_1.default.yellow(`Found integration in ${repoData.name}: GitHub App installation with id ${installation.id}`));
                        }
                    }
                }
                catch (integrationError) {
                    const errorMsg = integrationError instanceof Error ? integrationError.message : String(integrationError);
                    console.log(chalk_1.default.yellow(`No integration found for repository ${repoData.name} or error: ${errorMsg}`));
                }
                console.log(chalk_1.default.yellow(`No service connections API available for repository ${repoData.name}.`));
            }
        }
        catch (scanError) {
            const errorMsg = scanError instanceof Error ? scanError.message : String(scanError);
            console.error(chalk_1.default.red("Error scanning repositories:"), errorMsg);
        }
        try {
            const endpoints = await prisma.apiEndpoint.findMany({
                include: { repository: { include: { organization: true } } },
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
                console.log(chalk_1.default.yellow("API endpoints stored in database: " +
                    endpoints.map((ep) => ep.endpoint).join(" \n")));
            }
            const apiKeys = await prisma.apiKey.findMany({
                include: { repository: { include: { organization: true } } },
                where: {
                    repository: {
                        ...(org ? { organization: { name: org } } : {}),
                        ...(repo ? { name: repo } : {}),
                    },
                },
            });
            if (apiKeys.length !== 0) {
                apiKeys.forEach((apiKey) => {
                    console.log(chalk_1.default.green(`Organization: ${apiKey.repository.organization.name}`));
                    console.log(chalk_1.default.green(`Repository: ${apiKey.repository.name}`));
                    console.log(chalk_1.default.green(`API Key: ${apiKey.key}`));
                    console.log(chalk_1.default.gray(`Stored on: ${new Date(apiKey.createdAt).toLocaleString()}`));
                    console.log(chalk_1.default.blue("-------------------------------------------------"));
                });
            }
            const connections = await prisma.apiConnection.findMany({
                include: { repository: { include: { organization: true } } },
                where: {
                    repository: {
                        ...(org ? { organization: { name: org } } : {}),
                        ...(repo ? { name: repo } : {}),
                    },
                },
            });
            if (connections.length !== 0) {
                connections.forEach((connection) => {
                    console.log(chalk_1.default.green(`Organization: ${connection.repository.organization.name}`));
                    console.log(chalk_1.default.green(`Repository: ${connection.repository.name}`));
                    console.log(chalk_1.default.green(`Connection Type: ${connection.connectionType}`));
                    console.log(chalk_1.default.green(`Identifier: ${connection.identifier}`));
                    console.log(chalk_1.default.gray(`Stored on: ${new Date(connection.createdAt).toLocaleString()}`));
                    console.log(chalk_1.default.blue("-------------------------------------------------"));
                });
                console.log(chalk_1.default.yellow("API connections stored in database: " +
                    connections.map((c) => `${c.connectionType}: ${c.identifier}`).join(" \n")));
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
