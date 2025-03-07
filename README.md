# Repnalyzer

[![Node.js](https://img.shields.io/badge/Node.js-v23-blue.svg)](https://nodejs.org)  
[![TypeScript](https://img.shields.io/badge/TypeScript-4.x-blue.svg)](https://www.typescriptlang.org)  
[![GitHub Access Token](https://img.shields.io/badge/GitHub_Access_Token-secure-brightgreen.svg)](#)  
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Repnalyzer** is a Node.js and TypeScript-based project that scans GitHub repositories for API endpoints, API keys, and connected API integrations (such as webhooks and GitHub App installations). It uses a GitHub Access Token to securely access repository data and leverages Prisma as a persistent store for your analysis data.

---

## Features

- **API Endpoint Discovery:** Scans code files in repositories to extract API endpoints.
- **API Key Extraction:** Detects potential API keys embedded in source code.
- **API Connections:** Identifies repository webhooks and GitHub integrations.
- **Persistent Storage:** Uses Prisma to store scanned data in a PostgreSQL database.
- **Command-Line Interface:** Implements commands (`access`, `listApis`, and `scan`) for various analysis functions.

---

## Prerequisites

- [Node.js](https://nodejs.org) (v16 or later)
- [npm](https://www.npmjs.com) or [yarn](https://yarnpkg.com)
- A PostgreSQL database
- A valid GitHub Access Token with the necessary permissions
- [Prisma CLI](https://www.prisma.io/docs/getting-started/quickstart) for database migrations

---

## Installation

### Clone the Repository:

```bash
git clone https://github.com/yourusername/repnalyzer.git
cd repnalyzer
```

### Install Dependencies:

```bash
npm install
```

### Apply Prisma Migrations:

```bash
npx prisma migrate deploy
```

---

## Folder Structure

Below is the structure of the repository (excluding the `dist` folder):

```
.
├── prisma
│   ├── migrations
│   │   ├── 20250303103057_init
│   │   │   └── migration.sql
│   │   ├── 20250304082112_add_api
│   │   │   └── migration.sql
│   │   ├── 20250304090529_add_apikey
│   │   │   └── migration.sql
│   │   ├── 20250304095255_add_apiconnection
│   │   │   └── migration.sql
│   │   └── migration_lock.toml
│   └── schema.prisma
├── src
│   ├── commands
│   │   ├── access.ts
│   │   ├── listApis.ts
│   │   └── scan.ts
│   ├── index.ts
│   └── lib
│       └── githubClient.ts
├── package.json
├── package-lock.json
├── tsconfig.json
└── tsconfig.tsbuildinfo
```

---

## Usage

### Running Commands

Repnalyzer exposes several commands via the CLI. For example, to list all APIs:

```bash
npm run cli list-apis -- --org <GitHubOrg> [--repo <repository>]
```

Other commands include `access` and `scan`. Check the command descriptions in their respective source files in `src/commands`.

---

## Development

To compile the TypeScript files, run:

```bash
npm run build
```

Then, run the project using:

```bash
npm start
```

---

## Contributing

Contributions are welcome! Please open an issue or submit a pull request with your changes.

---

## License

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT).
