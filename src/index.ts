#!/usr/bin/env node

import * as dotenv from 'dotenv';

import { Command } from 'commander';
import { accessCommand } from './commands/access';
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
  return new Promise((resolve: (value: string) => void) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    rl.question('Please enter your GITHUB_TOKEN: ', (answer) => {
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
        'User-Agent': 'repnalyzer-cli'
      }
    });
    
    if (!response.ok) {
      console.error('Error fetching organizations:', response.status, response.statusText);
      return false;
    }
    
    const orgs = await response.json();
    if (orgs.length === 0) {
      console.log('User is not affiliated with any organization.');
      return false;
    } else {
      console.log('User is affiliated with the following organizations:');
      orgs.forEach((org: { login: string }) => console.log(`- ${org.login}`));
      return true;
    }
  } catch (error) {
    console.error('Error while checking organizations:', error);
    return false;
  }
}

async function main() {
  console.log('Repnalyzer is starting...');

  // Load the GitHub token from file or prompt the user.
  const githubToken = await getGithubToken();
  console.log('GITHUB_TOKEN loaded.');
  // Set the token in the environment for downstream usage.
  process.env.GITHUB_TOKEN = githubToken;

  // Check user's organization affiliation.
  await checkUserOrganizations(githubToken);

  const program = new Command();

  program
    .name('repnalyzer')
    .description('A CLI tool for Github Security Scanning, Access Control Analysis, and more...')
    .version('0.1.0');

  // Add subcommands.
  program.addCommand(scanCommand());
  program.addCommand(accessCommand());
  program.addCommand(listApisCommand());

  // Add a subcommand to update the token.
  program
    .command('update-token')
    .description('Update your GITHUB_TOKEN')
    .action(async () => {
      const newToken = await promptForToken();
      fs.writeFileSync(TOKEN_FILE, newToken, { mode: 0o600 });
      console.log('Token updated.');
      process.env.GITHUB_TOKEN = newToken;
      // Check organizations after token update.
      await checkUserOrganizations(newToken);
    });

  program.parse(process.argv);
}

main();
