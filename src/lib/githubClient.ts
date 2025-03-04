// In lib/githubClient.ts
import { Octokit } from "@octokit/rest";
import { promptForToken } from "../utils/token";

export async function createGithubClient(token?: string) {
  if (!token) {
    console.error("GITHUB_TOKEN not provided. Please enter a valid API KEY.");
    token = await promptForToken();
    if (!token) {
      console.error("No valid API key provided. Exiting.");
      process.exit(1);
    }
  }
  return new Octokit({ auth: token });
}
