import { Octokit } from "@octokit/rest";

export function createGithubClient(token?: string){
    const authToken = token || process.env.GITHUB_TOKEN;
    console.log('authToken: ', authToken);
    if(!authToken){
        throw new Error('Github token not provided. Set GITHUB_TOKEN in .env or pass it as an argument.')
    }

    return new Octokit({
        auth: authToken
    })
}