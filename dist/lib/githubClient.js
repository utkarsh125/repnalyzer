"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGithubClient = createGithubClient;
// In lib/githubClient.ts
const rest_1 = require("@octokit/rest");
function createGithubClient(token) {
    if (!token) {
        throw new Error("Github token not provided. Set GITHUB_TOKEN in .env or pass it as an argument.");
    }
    return new rest_1.Octokit({ auth: token });
}
