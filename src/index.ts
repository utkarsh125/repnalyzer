#!/usr/bin/env node

import * as dotenv from 'dotenv';

import { getDBUrl, promptForDB } from './utils/db';

import { Command } from 'commander';
import { accessCommand } from './commands/access';
import chalk from 'chalk';
import { execSync } from 'child_process';
import figlet from 'figlet';
import fs from 'fs';
import { getApiKey } from './utils/token';
import listApisCommand from './commands/listApis';
import path from 'path';
import { scanCommand } from './commands/scan';
dotenv.config();




// Function to update DATABASE_URL manually.
async function updateDatabaseUrl() {
  const newDbUrl = await promptForDB();
  const DB_FILE = path.join(process.env.HOME || process.cwd(), '.repnalyzer_db_url');
  fs.writeFileSync(DB_FILE, newDbUrl, { mode: 0o600 });
  process.env.DATABASE_URL = newDbUrl;
  console.log(chalk.green("DATABASE_URL updated successfully."));
}

// Function to update repnalyzer (prints update instructions)
async function updateRepnalyzer() {
  console.log(chalk.green("To update repnalyzer globally, run:"));
  console.log(chalk.yellow("npm update -g repnalyzer"));
}

// This function loads both the GITHUB_TOKEN and DATABASE_URL.
async function initializeEnv() {
  // Load GitHub token.
  const githubToken = await getApiKey();
  process.env.GITHUB_TOKEN = githubToken;
  console.log(chalk.green('GITHUB_TOKEN loaded.'));

  // Load DATABASE_URL.
  const dbUrl = await getDBUrl();
  process.env.DATABASE_URL = dbUrl;
  console.log(chalk.green('DATABASE_URL loaded.'));
}

// Function to automatically run Prisma migrations using the default schema shipped with the package.
function runPrismaMigrations() {
  try {
    console.log(chalk.blue("Applying Prisma migrations..."));
    // Define the expected location of your Prisma schema relative to this file.
    const schemaPath = path.join(__dirname, '../prisma/schema.prisma');

    if (!fs.existsSync(schemaPath)) {
      console.error(
        chalk.red("Prisma schema not found. Please ensure a schema.prisma exists in the 'prisma' folder of your project, or include one with repnalyzer.")
      );
      process.exit(1);
    }

    // Run migration command with the --schema flag.
    execSync(`npx prisma migrate deploy --schema="${schemaPath}"`, { stdio: 'inherit' });
    console.log(chalk.green("Prisma migrations applied successfully."));
  } catch (err) {
    console.error(chalk.red("Error applying Prisma migrations:"), err);
    process.exit(1);
  }
}

async function main() {
  console.log(chalk.blue(figlet.textSync('Repnalyzer')));
  console.log(chalk.yellow('Repnalyzer is starting...\n'));

  // Initialize environment variables (GITHUB_TOKEN and DATABASE_URL)
  await initializeEnv();

  // Automatically apply Prisma migrations before proceeding.
  runPrismaMigrations();

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

  // Default behavior: if an organization name is provided, show org stats;
  // otherwise, show a help prompt.
  program
    .argument('[orgname]', 'GitHub organization name to view stats for (if provided, displays org stats)')
    .action(async (orgname) => {
      if (orgname) {
        // Call your getOrgStats() function here, if implemented.
      } else {
        // Call your getUserStats() function here, if implemented.
        console.log(chalk.yellow("\nPlease use --help to see a list of things that you can do with this CLI."));
      }
    });

  program.parse(process.argv);

  if (process.argv.length <= 2) {
    console.log(chalk.yellow("\nPlease use --help to see a list of things that you can do with this CLI."));
  }
}

main();
