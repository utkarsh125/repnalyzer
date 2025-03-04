import fs from 'fs';
import path from 'path';
import readline from 'readline';

const TOKEN_FILE = path.join(process.env.HOME || process.cwd(), '.repnalyzer_token');

export async function promptForToken(): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question('Please enter your API key: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function getApiKey(): Promise<string> {
  if (fs.existsSync(TOKEN_FILE)) {
    return fs.readFileSync(TOKEN_FILE, { encoding: 'utf8' }).trim();
  } else {
    const token = await promptForToken();
    fs.writeFileSync(TOKEN_FILE, token, { mode: 0o600 });
    return token;
  }
}
