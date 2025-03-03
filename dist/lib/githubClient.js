"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGithubClient = createGithubClient;
const rest_1 = require("@octokit/rest");
function createGithubClient(token) {
    const authToken = token || process.env.GITHUB_TOKEN;
    console.log('authToken: ', authToken);
    if (!authToken) {
        throw new Error('Github token not provided. Set GITHUB_TOKEN in .env or pass it as an argument.');
    }
    return new rest_1.Octokit({
        auth: authToken
    });
}
