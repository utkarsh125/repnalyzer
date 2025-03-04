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

// Function to update repnalyzer package.
// It removes the stored API key and DATABASE_URL, then updates via npm.
async function updateRepnalyzerPackage() {
  const tokenFile = path.join(process.env.HOME || process.cwd(), '.repnalyzer_token');
  const dbFile = path.join(process.env.HOME || process.cwd(), '.repnalyzer_db_url');

  if (fs.existsSync(tokenFile)) {
    fs.unlinkSync(tokenFile);
    console.log(chalk.green("Stored GITHUB_TOKEN removed."));
  }
  if (fs.existsSync(dbFile)) {
    fs.unlinkSync(dbFile);
    console.log(chalk.green("Stored DATABASE_URL removed."));
  }

  try {
    console.log(chalk.blue("Updating repnalyzer package..."));
    execSync('npm i -g repnalyzer', { stdio: 'inherit' });
    console.log(chalk.green("repnalyzer updated successfully."));
  } catch (err) {
    console.error(chalk.red("Error updating repnalyzer:"), err);
    process.exit(1);
  }
}

// This function loads both the GITHUB_TOKEN and DATABASE_URL.
async function initializeEnv() {
  // Load GitHub token.
  const githubToken = await getApiKey();
  process.env.GITHUB_TOKEN = githubToken;
  console.log(chalk.green("GITHUB_TOKEN loaded."));

  // Load DATABASE_URL.
  const dbUrl = await getDBUrl();
  process.env.DATABASE_URL = dbUrl;
  console.log(chalk.green("DATABASE_URL loaded."));
}

// Function to automatically run Prisma migrations.
// If migrations fail, it falls back to pushing the schema.
function runPrismaMigrations() {
  try {
    console.log(chalk.blue("Applying Prisma migrations..."));
    execSync("npx prisma migrate deploy", { stdio: "inherit" });
    console.log(chalk.green("Prisma migrations applied successfully."));
  } catch (err) {
    console.error(chalk.red("Error applying Prisma migrations:"), err);
    console.log(chalk.blue("Falling back to pushing schema..."));
    try {
      execSync("npx prisma db push", { stdio: "inherit" });
      console.log(chalk.green("Schema pushed successfully."));
    } catch (err2) {
      console.error(chalk.red("Error pushing schema:"), err2);
      process.exit(1);
    }
  }
}

async function main() {
  console.log(chalk.blue(figlet.textSync("Repnalyzer")));
  console.log(chalk.yellow("Repnalyzer is starting...\n"));

  // Initialize environment variables.
  await initializeEnv();

  // Automatically apply Prisma migrations before proceeding.
  runPrismaMigrations();

  const program = new Command();
  program
    .name("repnalyzer")
    .description("A CLI tool for GitHub Security Scanning, Access Control Analysis, and more...")
    .version("0.1.0");

  // Register subcommands.
  program.addCommand(scanCommand());
  program.addCommand(accessCommand());
  program.addCommand(listApisCommand());

  // Command to update the GitHub token.
  program
    .command("update-token")
    .description("Update your GITHUB_TOKEN")
    .action(async () => {
      const rl = require("readline").createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.question(chalk.yellow("Please enter your new GITHUB_TOKEN: "), (answer: string) => {
        rl.close();
        const newToken = answer.trim();
        fs.writeFileSync(
          path.join(process.env.HOME || process.cwd(), ".repnalyzer_token"),
          newToken,
          { mode: 0o600 }
        );
        console.log(chalk.green("Token updated."));
        process.env.GITHUB_TOKEN = newToken;
      });
    });

  // Command to update the DATABASE_URL.
  program
    .command("update-db")
    .description("Update your DATABASE_URL")
    .action(async () => {
      await updateDatabaseUrl();
    });

  // Command to update repnalyzer package.
  program
    .command("update")
    .description("Update repnalyzer package (removes stored credentials before updating)")
    .action(async () => {
      await updateRepnalyzerPackage();
    });

  // Default behavior: if an organization name is provided, show org stats;
  // otherwise, show a help prompt.
  program
    .argument("[orgname]", "GitHub organization name to view stats for (if provided, displays org stats)")
    .action(async (orgname) => {
      if (orgname) {
        // Call your getOrgStats() function here (if implemented).
      } else {
        // Call your getUserStats() function here (if implemented).
        console.log(chalk.yellow("\nPlease use --help to see a list of things that you can do with this CLI."));
      }
    });

  program.parse(process.argv);

  if (process.argv.length <= 2) {
    console.log(chalk.yellow("\nPlease use --help to see a list of things that you can do with this CLI."));
  }
}

main();
