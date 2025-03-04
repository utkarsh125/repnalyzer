import fs from 'fs';
import path from 'path';
import readline from 'readline';

const DB_FILE = path.join(process.env.HOME || process.cwd(), '.repnalyzer_db_url');

// Prompts the user for the DATABASE_URL.
export async function promptForDB(): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question('Please enter your DATABASE_URL: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Reads the DATABASE_URL from file; if not found, prompts the user and then saves it.
export async function getDBUrl(): Promise<string> {
  if (fs.existsSync(DB_FILE)) {
    return fs.readFileSync(DB_FILE, { encoding: 'utf8' }).trim();
  } else {
    const dbUrl = await promptForDB();
    fs.writeFileSync(DB_FILE, dbUrl, { mode: 0o600 });
    return dbUrl;
  }
}
