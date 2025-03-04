#!/usr/bin/env node

import * as dotenv from 'dotenv';

import { Command } from "commander";
import { accessCommand } from './commands/access';
import listApisCommand from './commands/listApis';
import { scanCommand } from './commands/scan'

dotenv.config();

console.log('Repnalyzering is starting...');

//TODO: Instead of taking the GITHUB_TOKEN from the environment variables take it from the user input if possible
//TODO: then store it safely and on update or exit remove it from the local directory.
console.log('GITHUB_TOKEN:', process.env.GITHUB_TOKEN);



const program = new Command();

program
.name('repnalyzer')
.description('A CLI tool for Github Security Scanning, Access Control Analysis, and more...')
.version('0.1.0')


//TODO: Add subcommands.
program.addCommand(scanCommand());
program.addCommand(accessCommand());
program.addCommand(listApisCommand());

program.parse(process.argv)

