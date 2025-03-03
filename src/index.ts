#!/usr/bin/env node

import * as dotenv from 'dotenv';

import { Command } from "commander";
import { scanCommand } from './commands/scan'

dotenv.config();

console.log('Repnalyzering is starting...');
console.log('GITHUB_TOKEN:', process.env.GITHUB_TOKEN);



const program = new Command();

program
.name('repnalyzer')
.description('A CLI tool for Github Security Scanning, Access Control Analysis, and more...')
.version('0.1.0')


//TODO: Add subcommands.
program.addCommand(scanCommand());

program.parse(process.argv)

