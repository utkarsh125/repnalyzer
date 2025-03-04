"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.promptForToken = promptForToken;
exports.getApiKey = getApiKey;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const readline_1 = __importDefault(require("readline"));
const TOKEN_FILE = path_1.default.join(process.env.HOME || process.cwd(), '.repnalyzer_token');
async function promptForToken() {
    return new Promise((resolve) => {
        const rl = readline_1.default.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        rl.question('Please enter your API key: ', (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}
async function getApiKey() {
    if (fs_1.default.existsSync(TOKEN_FILE)) {
        return fs_1.default.readFileSync(TOKEN_FILE, { encoding: 'utf8' }).trim();
    }
    else {
        const token = await promptForToken();
        fs_1.default.writeFileSync(TOKEN_FILE, token, { mode: 0o600 });
        return token;
    }
}
