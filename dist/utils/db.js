"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.promptForDB = promptForDB;
exports.getDBUrl = getDBUrl;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const readline_1 = __importDefault(require("readline"));
const DB_FILE = path_1.default.join(process.env.HOME || process.cwd(), '.repnalyzer_db_url');
async function promptForDB() {
    return new Promise((resolve) => {
        const rl = readline_1.default.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        rl.question("Please enter DATABASE_URL: ", (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}
async function getDBUrl() {
    if (fs_1.default.existsSync(DB_FILE)) {
        return fs_1.default.readFileSync(DB_FILE, { encoding: 'utf8' }).trim();
    }
    else {
        const dbUrl = await promptForDB();
        fs_1.default.writeFileSync(DB_FILE, dbUrl, { mode: 0o600 });
        return dbUrl;
    }
}
