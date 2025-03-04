// In lib/githubClient.ts
import { Octokit } from "@octokit/rest";

export function createGithubClient(token?: string) {
  if (!token) {
    throw new Error(
      "Github token not provided. Set GITHUB_TOKEN in .env or pass it as an argument."
    );
  }
  return new Octokit({ auth: token });
}
