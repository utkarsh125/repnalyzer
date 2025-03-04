"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGithubClient = createGithubClient;
// In lib/githubClient.ts
const rest_1 = require("@octokit/rest");
const token_1 = require("../utils/token");
async function createGithubClient(token) {
    if (!token) {
        console.error("GITHUB_TOKEN not provided. Please enter a valid API KEY.");
        token = await (0, token_1.promptForToken)();
        if (!token) {
            console.error("No valid API key provided. Exiting.");
            process.exit(1);
        }
    }
    return new rest_1.Octokit({ auth: token });
}
