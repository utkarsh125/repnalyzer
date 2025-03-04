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
const listApis_1 = __importDefault(require("./commands/listApis"));
const scan_1 = require("./commands/scan");
dotenv.config();
console.log('Repnalyzering is starting...');
//TODO: Instead of taking the GITHUB_TOKEN from the environment variables take it from the user input if possible
//TODO: then store it safely and on update or exit remove it from the local directory.
console.log('GITHUB_TOKEN:', process.env.GITHUB_TOKEN);
const program = new commander_1.Command();
program
    .name('repnalyzer')
    .description('A CLI tool for Github Security Scanning, Access Control Analysis, and more...')
    .version('0.1.0');
//TODO: Add subcommands.
program.addCommand((0, scan_1.scanCommand)());
program.addCommand((0, access_1.accessCommand)());
program.addCommand((0, listApis_1.default)());
program.parse(process.argv);
