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
const fs_1 = __importDefault(require("fs"));
const listApis_1 = __importDefault(require("./commands/listApis"));
const path_1 = __importDefault(require("path"));
const readline_1 = __importDefault(require("readline"));
const scan_1 = require("./commands/scan");
dotenv.config();
// Define a token file in the current directory.
const TOKEN_FILE = path_1.default.join(process.cwd(), '.repnalyzer_token');
// Prompts the user to enter their GitHub token.
async function promptForToken() {
    return new Promise((resolve) => {
        const rl = readline_1.default.createInterface({
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
async function getGithubToken() {
    if (fs_1.default.existsSync(TOKEN_FILE)) {
        const token = fs_1.default.readFileSync(TOKEN_FILE, { encoding: 'utf8' }).trim();
        return token;
    }
    else {
        const token = await promptForToken();
        // Write the token to the file with restricted permissions.
        fs_1.default.writeFileSync(TOKEN_FILE, token, { mode: 0o600 });
        return token;
    }
}
// Function to check if the user is affiliated with any GitHub organizations.
async function checkUserOrganizations(token) {
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
        }
        else {
            console.log('User is affiliated with the following organizations:');
            orgs.forEach((org) => console.log(`- ${org.login}`));
            return true;
        }
    }
    catch (error) {
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
    const program = new commander_1.Command();
    program
        .name('repnalyzer')
        .description('A CLI tool for Github Security Scanning, Access Control Analysis, and more...')
        .version('0.1.0');
    // Add subcommands.
    program.addCommand((0, scan_1.scanCommand)());
    program.addCommand((0, access_1.accessCommand)());
    program.addCommand((0, listApis_1.default)());
    // Add a subcommand to update the token.
    program
        .command('update-token')
        .description('Update your GITHUB_TOKEN')
        .action(async () => {
        const newToken = await promptForToken();
        fs_1.default.writeFileSync(TOKEN_FILE, newToken, { mode: 0o600 });
        console.log('Token updated.');
        process.env.GITHUB_TOKEN = newToken;
        // Check organizations after token update.
        await checkUserOrganizations(newToken);
    });
    program.parse(process.argv);
}
main();
