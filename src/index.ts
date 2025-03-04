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



// Paths to local config files:
const DB_FILE = path.join(process.env.HOME || process.cwd(), '.repnalyzer_db_url');
const MIGRATIONS_DONE_FILE = path.join(process.env.HOME || process.cwd(), '.repnalyzer_migrations_done');

// Prompts user to update the DATABASE_URL and sets it in process.env
async function updateDatabaseUrl() {
  const newDbUrl = await promptForDB();
  fs.writeFileSync(DB_FILE, newDbUrl, { mode: 0o600 });
  process.env.DATABASE_URL = newDbUrl;
  console.log(chalk.green("DATABASE_URL updated successfully."));
}

// Prints instructions for updating repnalyzer globally
async function updateRepnalyzer() {
  console.log(chalk.green("To update repnalyzer globally, run:"));
  console.log(chalk.yellow("npm update -g repnalyzer"));
}

// Loads environment variables (GITHUB_TOKEN and DATABASE_URL).
async function initializeEnv() {
  // 1. GitHub token
  const githubToken = await getApiKey();
  process.env.GITHUB_TOKEN = githubToken;
  console.log(chalk.green('GITHUB_TOKEN loaded.'));

  // 2. Database URL
  const dbUrl = await getDBUrl();
  process.env.DATABASE_URL = dbUrl;
  console.log(chalk.green('DATABASE_URL loaded.'));
}

// Runs Prisma migrations only once, creating a small file to remember they are done
function runPrismaMigrationsOnce() {
  if (fs.existsSync(MIGRATIONS_DONE_FILE)) {
    // Already migrated
    console.log(chalk.yellow("Migrations already applied. Skipping."));
    return;
  }

  console.log(chalk.blue("Applying Prisma migrations for the first time..."));

  const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
  if (!fs.existsSync(schemaPath)) {
    console.error(
      chalk.red(
        "Prisma schema not found. Please ensure a schema.prisma exists in the 'prisma' folder of your project, or include one with repnalyzer."
      )
    );
    process.exit(1);
  }

  try {
    execSync(`npx prisma migrate deploy --schema="${schemaPath}"`, { stdio: 'inherit' });
    console.log(chalk.green("Prisma migrations applied successfully."));
    // Mark migrations as done
    fs.writeFileSync(MIGRATIONS_DONE_FILE, "done", { mode: 0o600 });

    // Print a friendly message on the first run
    console.log(chalk.green("To get started, type 'repnalyzer' into the console."));
  } catch (err) {
    console.error(chalk.red("Error applying Prisma migrations:"), err);
    process.exit(1);
  }
}

async function main() {
  console.log(chalk.blue(figlet.textSync('Repnalyzer')));
  console.log(chalk.yellow('Repnalyzer is starting...\n'));

  // 1. Initialize environment (prompts if needed)
  await initializeEnv();

  // 2. Apply Prisma migrations only once
  runPrismaMigrationsOnce();

  // 3. Register CLI commands
  const program = new Command();
  program
    .name('repnalyzer')
    .description('A CLI tool for GitHub Security Scanning, Access Control Analysis, and more...')
    .version('0.1.0');

  // Subcommands
  program.addCommand(scanCommand());
  program.addCommand(accessCommand());
  program.addCommand(listApisCommand());

  // Command: update-token
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

  // Command: update-db
  program
    .command('update-db')
    .description('Update your DATABASE_URL')
    .action(async () => {
      await updateDatabaseUrl();
    });

  // Command: update
  program
    .command('update')
    .description('Update repnalyzer')
    .action(async () => {
      await updateRepnalyzer();
    });

  // Default argument: [orgname]
  program
    .argument('[orgname]', 'GitHub organization name to view stats for (if provided, displays org stats)')
    .action(async (orgname) => {
      if (orgname) {
        // Possibly call getOrgStats(githubToken, orgname)
      } else {
        // Possibly call getUserStats(githubToken)
        console.log(chalk.yellow("\nPlease use --help to see a list of things that you can do with this CLI."));
      }
    });

  program.parse(process.argv);

  if (process.argv.length <= 2) {
    console.log(chalk.yellow("\nPlease use --help to see a list of things that you can do with this CLI."));
  }
}

main();
