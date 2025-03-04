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
const commander_1 = require("commander");
const access_1 = require("./commands/access");
const chalk_1 = __importDefault(require("chalk"));
const figlet_1 = __importDefault(require("figlet"));
const fs_1 = __importDefault(require("fs"));
const token_1 = require("./utils/token");
const listApis_1 = __importDefault(require("./commands/listApis"));
const path_1 = __importDefault(require("path"));
const scan_1 = require("./commands/scan");
dotenv.config();
// Function to check if the user is affiliated with any GitHub organizations.
async function checkUserOrganizations(token) {
    try {
        const response = await fetch('https://api.github.com/user/orgs', {
            headers: {
                'Authorization': `token ${token}`,
                'User-Agent': 'repnalyzer-cli',
            },
        });
        if (!response.ok) {
            console.error(chalk_1.default.red('Error fetching organizations:'), response.status, response.statusText);
            return false;
        }
        const orgs = await response.json();
        if (orgs.length === 0) {
            console.log(chalk_1.default.yellow('User is not affiliated with any organization.'));
            return false;
        }
        else {
            console.log(chalk_1.default.green('User is affiliated with the following organizations:'));
            orgs.forEach((org) => console.log(chalk_1.default.green(`- ${org.login}`)));
            return true;
        }
    }
    catch (error) {
        console.error(chalk_1.default.red('Error while checking organizations:'), error);
        return false;
    }
}
// Fetches and prints user statistics (e.g., number of repositories and organizations)
async function getUserStats(token) {
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
        console.log(chalk_1.default.blue(figlet_1.default.textSync('Profile Info')));
        console.log(chalk_1.default.green(`Total Repositories: ${repos.length}`));
        console.log(chalk_1.default.green(`Total Organizations: ${orgs.length}`));
    }
    catch (error) {
        console.error(chalk_1.default.red('Error fetching user stats:'), error);
    }
}
// Fetches and prints organization statistics (e.g., number of public repos and members)
async function getOrgStats(token, orgname) {
    try {
        const orgResponse = await fetch(`https://api.github.com/orgs/${orgname}`, {
            headers: {
                'Authorization': `token ${token}`,
                'User-Agent': 'repnalyzer-cli',
            },
        });
        if (!orgResponse.ok) {
            console.error(chalk_1.default.red(`Error fetching organization ${orgname}: ${orgResponse.status} ${orgResponse.statusText}`));
            return;
        }
        const orgData = await orgResponse.json();
        const membersResponse = await fetch(`https://api.github.com/orgs/${orgname}/members?per_page=100`, {
            headers: {
                'Authorization': `token ${token}`,
                'User-Agent': 'repnalyzer-cli',
            },
        });
        const members = await membersResponse.json();
        console.log(chalk_1.default.blue(figlet_1.default.textSync('Org Stats')));
        console.log(chalk_1.default.green(`Organization: ${orgData.login}`));
        console.log(chalk_1.default.green(`Total Public Repositories: ${orgData.public_repos}`));
        console.log(chalk_1.default.green(`Total Members: ${members.length}`));
    }
    catch (error) {
        console.error(chalk_1.default.red(`Error fetching stats for organization ${orgname}:`), error);
    }
}
async function main() {
    // Print the banner
    console.log(chalk_1.default.blue(figlet_1.default.textSync('Repnalyzer')));
    console.log(chalk_1.default.yellow('Repnalyzer is starting...\n'));
    // Load the GitHub token using the utility function.
    const githubToken = await (0, token_1.getApiKey)();
    console.log(chalk_1.default.green('GITHUB_TOKEN loaded.'));
    process.env.GITHUB_TOKEN = githubToken;
    // Check user's organization affiliation.
    await checkUserOrganizations(githubToken);
    const program = new commander_1.Command();
    program
        .name('repnalyzer')
        .description('A CLI tool for GitHub Security Scanning, Access Control Analysis, and more...')
        .version('0.1.0');
    // Register subcommands.
    program.addCommand((0, scan_1.scanCommand)());
    program.addCommand((0, access_1.accessCommand)());
    program.addCommand((0, listApis_1.default)());
    // Command to update the token.
    program
        .command('update-token')
        .description('Update your GITHUB_TOKEN')
        .action(async () => {
        // Prompt the user for a new token
        const rl = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        rl.question(chalk_1.default.yellow('Please enter your new GITHUB_TOKEN: '), (answer) => {
            rl.close();
            const newToken = answer.trim();
            // Overwrite the token file (the same path as defined in your token.ts module)
            fs_1.default.writeFileSync(path_1.default.join(process.env.HOME || process.cwd(), '.repnalyzer_token'), newToken, { mode: 0o600 });
            console.log(chalk_1.default.green('Token updated.'));
            process.env.GITHUB_TOKEN = newToken;
        });
    });
    // Default behavior when no subcommand or argument is provided.
    // It displays the user profile info and a prompt message.
    program
        .argument('[orgname]', 'GitHub organization name to view stats for (if provided, displays org stats)')
        .action(async (orgname) => {
        if (orgname) {
            await getOrgStats(githubToken, orgname);
        }
        else {
            await getUserStats(githubToken);
            console.log(chalk_1.default.yellow("\nPlease use --help to see a list of things that you can do with this CLI."));
        }
    });
    program.parse(process.argv);
    // If no arguments were provided (only the executable name), show profile info with the help prompt.
    if (process.argv.length <= 2) {
        await getUserStats(githubToken);
        console.log(chalk_1.default.yellow("\nPlease use --help to see a list of things that you can do with this CLI."));
    }
}
main();
