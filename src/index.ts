#!/usr/bin/env node

import * as dotenv from 'dotenv';

import { Command } from 'commander';
import { accessCommand } from './commands/access';
import chalk from 'chalk';
import figlet from 'figlet';
import fs from 'fs';
import { getApiKey } from './utils/token';
import { getDBUrl } from './utils/db';
import listApisCommand from './commands/listApis';
import path from 'path';
import { scanCommand } from './commands/scan';
dotenv.config();



// Optional: you may already have these functions defined
// (You can adjust the implementations as needed.)
async function updateDatabaseUrl() {
  // Assume promptForDB is a function that prompts the user for the DB URL
  const { promptForDB } = await import('./utils/db');
  const newDbUrl = await promptForDB();
  const DB_FILE = path.join(process.env.HOME || process.cwd(), '.repnalyzer_db_url');
  fs.writeFileSync(DB_FILE, newDbUrl, { mode: 0o600 });
  process.env.DATABASE_URL = newDbUrl;
  console.log(chalk.green("DATABASE_URL updated successfully."));
}

async function updateRepnalyzer() {
  console.log(chalk.green("To update repnalyzer globally, run:"));
  console.log(chalk.yellow("npm update -g repnalyzer"));
}

// This function loads both the GitHub token and DATABASE_URL
async function initializeEnv() {
  const githubToken = await getApiKey();
  process.env.GITHUB_TOKEN = githubToken;
  console.log(chalk.green('GITHUB_TOKEN loaded.'));

  const dbUrl = await getDBUrl();
  process.env.DATABASE_URL = dbUrl;
  console.log(chalk.green('DATABASE_URL loaded.'));
}

async function main() {
  console.log(chalk.blue(figlet.textSync('Repnalyzer')));
  console.log(chalk.yellow('Repnalyzer is starting...\n'));

  // Ensure that both GITHUB_TOKEN and DATABASE_URL are loaded before any commands run.
  await initializeEnv();

  // (Optional) You can check GitHub organization affiliation here if needed.
  // await checkUserOrganizations(process.env.GITHUB_TOKEN);

  const program = new Command();
  program
    .name('repnalyzer')
    .description('A CLI tool for GitHub Security Scanning, Access Control Analysis, and more...')
    .version('0.1.0');

  // Register subcommands (they instantiate PrismaClient within their action callbacks)
  program.addCommand(scanCommand());
  program.addCommand(accessCommand());
  program.addCommand(listApisCommand());

  // Command to update the GitHub token.
  program
    .command('update-token')
    .description('Update your GITHUB_TOKEN')
    .action(async () => {
      const rl = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.question(chalk.yellow('Please enter your new GITHUB_TOKEN: '), (answer: string) => {
        rl.close();
        const newToken = answer.trim();
        fs.writeFileSync(
          path.join(process.env.HOME || process.cwd(), '.repnalyzer_token'),
          newToken,
          { mode: 0o600 }
        );
        console.log(chalk.green('Token updated.'));
        process.env.GITHUB_TOKEN = newToken;
      });
    });

  // Command to update the DATABASE_URL.
  program
    .command('update-db')
    .description('Update your DATABASE_URL')
    .action(async () => {
      await updateDatabaseUrl();
    });

  // Command to update repnalyzer itself.
  program
    .command('update')
    .description('Update repnalyzer')
    .action(async () => {
      await updateRepnalyzer();
    });

  // Default behavior: if an organization name is provided as an argument, show org stats;
  // otherwise, show user stats.
  program
    .argument('[orgname]', 'GitHub organization name to view stats for (if provided, displays org stats)')
    .action(async (orgname) => {
      if (orgname) {
        // Assume getOrgStats is implemented similarly to getUserStats.
        // For example: await getOrgStats(process.env.GITHUB_TOKEN, orgname);
      } else {
        // Assume getUserStats is implemented.
        // For example: await getUserStats(process.env.GITHUB_TOKEN);
        console.log(chalk.yellow("\nPlease use --help to see a list of things that you can do with this CLI."));
      }
    });

  program.parse(process.argv);

  if (process.argv.length <= 2) {
    // If no arguments provided, show default behavior (e.g., user stats) and a help prompt.
    // await getUserStats(process.env.GITHUB_TOKEN);
    console.log(chalk.yellow("\nPlease use --help to see a list of things that you can do with this CLI."));
  }
}

main();
