#!/usr/bin/env node

import * as dotenv from 'dotenv';

import { Command } from 'commander';
import { accessCommand } from './commands/access';
import chalk from 'chalk';
import figlet from 'figlet';
import fs from 'fs';
import listApisCommand from './commands/listApis';
import path from 'path';
import readline from 'readline';
import { scanCommand } from './commands/scan';

dotenv.config();

// Define a token file in the current directory.
const TOKEN_FILE = path.join(process.cwd(), '.repnalyzer_token');

// Prompts the user to enter their GitHub token.
async function promptForToken(): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    rl.question(chalk.yellow('Please enter your GITHUB_TOKEN: '), (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Retrieve the token from file or prompt the user if not available.
async function getGithubToken(): Promise<string> {
  if (fs.existsSync(TOKEN_FILE)) {
    const token = fs.readFileSync(TOKEN_FILE, { encoding: 'utf8' }).trim();
    return token;
  } else {
    const token = await promptForToken();
    // Write the token to the file with restricted permissions.
    fs.writeFileSync(TOKEN_FILE, token, { mode: 0o600 });
    return token;
  }
}

// Function to check if the user is affiliated with any GitHub organizations.
async function checkUserOrganizations(token: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.github.com/user/orgs', {
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'repnalyzer-cli',
      },
    });
    
    if (!response.ok) {
      console.error(chalk.red('Error fetching organizations:'), response.status, response.statusText);
      return false;
    }
    
    const orgs = await response.json();
    if (orgs.length === 0) {
      console.log(chalk.yellow('User is not affiliated with any organization.'));
      return false;
    } else {
      console.log(chalk.green('User is affiliated with the following organizations:'));
      orgs.forEach((org: { login: string }) => console.log(chalk.green(`- ${org.login}`)));
      return true;
    }
  } catch (error) {
    console.error(chalk.red('Error while checking organizations:'), error);
    return false;
  }
}

// Fetches and prints user statistics (e.g., number of repositories and organizations)
async function getUserStats(token: string) {
  try {
    const reposResponse = await fetch('https://api.github.com/user/repos?per_page=100', {
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'repnalyzer-cli',
      },
    });
    const repos = await reposResponse.json();
    const orgsResponse = await fetch('https://api.github.com/user/orgs', {
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'repnalyzer-cli',
      },
    });
    const orgs = await orgsResponse.json();
    
    console.log(chalk.blue(figlet.textSync('Profile Info')));
    console.log(chalk.green(`Total Repositories: ${repos.length}`));
    console.log(chalk.green(`Total Organizations: ${orgs.length}`));
  } catch (error) {
    console.error(chalk.red('Error fetching user stats:'), error);
  }
}

// Fetches and prints organization statistics (e.g., number of public repos and members)
async function getOrgStats(token: string, orgname: string) {
  try {
    // Fetch organization details.
    const orgResponse = await fetch(`https://api.github.com/orgs/${orgname}`, {
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'repnalyzer-cli',
      },
    });
    if (!orgResponse.ok) {
      console.error(chalk.red(`Error fetching organization ${orgname}: ${orgResponse.status} ${orgResponse.statusText}`));
      return;
    }
    const orgData = await orgResponse.json();
    // Fetch organization members.
    const membersResponse = await fetch(`https://api.github.com/orgs/${orgname}/members?per_page=100`, {
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'repnalyzer-cli',
      },
    });
    const members = await membersResponse.json();

    console.log(chalk.blue(figlet.textSync('Org Stats')));
    console.log(chalk.green(`Organization: ${orgData.login}`));
    console.log(chalk.green(`Total Public Repositories: ${orgData.public_repos}`));
    console.log(chalk.green(`Total Members: ${members.length}`));
  } catch (error) {
    console.error(chalk.red(`Error fetching stats for organization ${orgname}:`), error);
  }
}

async function main() {
  // Print a beautiful banner.
  console.log(chalk.blue(figlet.textSync('Repnalyzer')));
  console.log(chalk.yellow('Repnalyzer is starting...\n'));

  // Load the GitHub token.
  const githubToken = await getGithubToken();
  console.log(chalk.green('GITHUB_TOKEN loaded.'));
  process.env.GITHUB_TOKEN = githubToken;

  // Check user organizations.
  await checkUserOrganizations(githubToken);

  const program = new Command();

  program
    .name('repnalyzer')
    .description('A CLI tool for GitHub Security Scanning, Access Control Analysis, and more...')
    .version('0.1.0');

  // Register subcommands.
  program.addCommand(scanCommand());
  program.addCommand(accessCommand());
  program.addCommand(listApisCommand());

  // Command to update the token.
  program
    .command('update-token')
    .description('Update your GITHUB_TOKEN')
    .action(async () => {
      const newToken = await promptForToken();
      fs.writeFileSync(TOKEN_FILE, newToken, { mode: 0o600 });
      console.log(chalk.green('Token updated.'));
      process.env.GITHUB_TOKEN = newToken;
      await checkUserOrganizations(newToken);
    });

  // Default behavior when no subcommand or argument is provided.
  // It displays the user profile info and a prompt message.
  program
    .argument('[orgname]', 'GitHub organization name to view stats for (if provided, displays org stats)')
    .action(async (orgname) => {
      if (orgname) {
        await getOrgStats(githubToken, orgname);
      } else {
        await getUserStats(githubToken);
        console.log(chalk.yellow("\nPlease use --help to see a list of things that you can do with this CLI."));
      }
    });

  program.parse(process.argv);

  // If no arguments were provided (only the executable name), show profile info with the help prompt.
  if (process.argv.length <= 2) {
    await getUserStats(githubToken);
    console.log(chalk.yellow("\nPlease use --help to see a list of things that you can do with this CLI."));
  }
}

main();
