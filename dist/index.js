#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = __importStar(require("dotenv"));
const db_1 = require("./utils/db");
const commander_1 = require("commander");
const access_1 = require("./commands/access");
const chalk_1 = __importDefault(require("chalk"));
const figlet_1 = __importDefault(require("figlet"));
const fs_1 = __importDefault(require("fs"));
// Import utility functions for GitHub token and Database URL.
const token_1 = require("./utils/token");
const listApis_1 = __importDefault(require("./commands/listApis"));
const path_1 = __importDefault(require("path"));
// Import your command modules.
const scan_1 = require("./commands/scan");
dotenv.config();
// Function to update (prompt and store) the DATABASE_URL.
async function updateDatabaseUrl() {
    const newDbUrl = await (0, db_1.promptForDB)();
    const DB_FILE = path_1.default.join(process.env.HOME || process.cwd(), '.repnalyzer_db_url');
    fs_1.default.writeFileSync(DB_FILE, newDbUrl, { mode: 0o600 });
    process.env.DATABASE_URL = newDbUrl;
    console.log(chalk_1.default.green("DATABASE_URL updated successfully."));
}
// Function to update repnalyzer (for example, by showing instructions)
async function updateRepnalyzer() {
    console.log(chalk_1.default.green("To update repnalyzer globally, run:"));
    console.log(chalk_1.default.yellow("npm update -g repnalyzer"));
}
// This function loads both the GitHub token and the DATABASE_URL before any CLI commands run.
async function initializeEnv() {
    // Get GitHub token
    const githubToken = await (0, token_1.getApiKey)();
    process.env.GITHUB_TOKEN = githubToken;
    console.log(chalk_1.default.green('GITHUB_TOKEN loaded.'));
    // Get DATABASE_URL; if not present, prompt the user and save it.
    const dbUrl = await (0, db_1.getDBUrl)();
    process.env.DATABASE_URL = dbUrl;
    console.log(chalk_1.default.green('DATABASE_URL loaded.'));
}
async function main() {
    console.log(chalk_1.default.blue(figlet_1.default.textSync('Repnalyzer')));
    console.log(chalk_1.default.yellow('Repnalyzer is starting...\n'));
    // Initialize environment: load GITHUB_TOKEN and DATABASE_URL.
    await initializeEnv();
    const program = new commander_1.Command();
    program
        .name('repnalyzer')
        .description('A CLI tool for GitHub Security Scanning, Access Control Analysis, and more...')
        .version('0.1.0');
    // Register subcommands.
    program.addCommand((0, scan_1.scanCommand)());
    program.addCommand((0, access_1.accessCommand)());
    program.addCommand((0, listApis_1.default)());
    // Command to update the GitHub token.
    program
        .command('update-token')
        .description('Update your GITHUB_TOKEN')
        .action(async () => {
        const rl = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        rl.question(chalk_1.default.yellow('Please enter your new GITHUB_TOKEN: '), (answer) => {
            rl.close();
            const newToken = answer.trim();
            fs_1.default.writeFileSync(path_1.default.join(process.env.HOME || process.cwd(), '.repnalyzer_token'), newToken, { mode: 0o600 });
            console.log(chalk_1.default.green('Token updated.'));
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
        }
        else {
            // If no orgname is provided, display default user stats or just a help message.
            console.log(chalk_1.default.yellow("\nPlease use --help to see a list of things that you can do with this CLI."));
        }
    });
    program.parse(process.argv);
    if (process.argv.length <= 2) {
        console.log(chalk_1.default.yellow("\nPlease use --help to see a list of things that you can do with this CLI."));
    }
}
main();
