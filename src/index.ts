#!/usr/bin/env node

import * as dotenv from 'dotenv';

import { getDBUrl, promptForDB } from './utils/db';

import { Command } from 'commander';
import { accessCommand } from './commands/access';
import chalk from 'chalk';
import figlet from 'figlet';
import fs from 'fs';
// Import utility functions for GitHub token and Database URL.
import { getApiKey } from './utils/token';
import listApisCommand from './commands/listApis';
import path from 'path';
// Import your command modules.
import { scanCommand } from './commands/scan';
dotenv.config();




// Function to update (prompt and store) the DATABASE_URL.
async function updateDatabaseUrl() {
  const newDbUrl = await promptForDB();
  const DB_FILE = path.join(process.env.HOME || process.cwd(), '.repnalyzer_db_url');
  fs.writeFileSync(DB_FILE, newDbUrl, { mode: 0o600 });
  process.env.DATABASE_URL = newDbUrl;
  console.log(chalk.green("DATABASE_URL updated successfully."));
}

// Function to update repnalyzer (for example, by showing instructions)
async function updateRepnalyzer() {
  console.log(chalk.green("To update repnalyzer globally, run:"));
  console.log(chalk.yellow("npm update -g repnalyzer"));
}

// This function loads both the GitHub token and the DATABASE_URL before any CLI commands run.
async function initializeEnv() {
  // Get GitHub token
  const githubToken = await getApiKey();
  process.env.GITHUB_TOKEN = githubToken;
  console.log(chalk.green('GITHUB_TOKEN loaded.'));

  // Get DATABASE_URL; if not present, prompt the user and save it.
  const dbUrl = await getDBUrl();
  process.env.DATABASE_URL = dbUrl;
  console.log(chalk.green('DATABASE_URL loaded.'));
}

async function main() {
  console.log(chalk.blue(figlet.textSync('Repnalyzer')));
  console.log(chalk.yellow('Repnalyzer is starting...\n'));

  // Initialize environment: load GITHUB_TOKEN and DATABASE_URL.
  await initializeEnv();

  const program = new Command();
  program
    .name('repnalyzer')
    .description('A CLI tool for GitHub Security Scanning, Access Control Analysis, and more...')
    .version('0.1.0');

  // Register subcommands.
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

  // Default behavior: if an organization name is provided, you might show org stats;
  // otherwise, show a help prompt.
  program
    .argument('[orgname]', 'GitHub organization name to view stats for (if provided, displays org stats)')
    .action(async (orgname) => {
      if (orgname) {
        // For example, if you have a function getOrgStats(), call it here:
        // await getOrgStats(process.env.GITHUB_TOKEN, orgname);
      } else {
        // If no orgname is provided, display default user stats or just a help message.
        console.log(chalk.yellow("\nPlease use --help to see a list of things that you can do with this CLI."));
      }
    });

  program.parse(process.argv);

  if (process.argv.length <= 2) {
    console.log(chalk.yellow("\nPlease use --help to see a list of things that you can do with this CLI."));
  }
}

main();
