#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { initCommand } from './commands/init.js';
import { swarmCommand } from './commands/swarm.js';
import { taskCommand } from './commands/task.js';
import { configCommand } from './commands/config.js';
import { authCommand } from './commands/auth.js';
import { hiveLoopCommand } from './commands/hive-loop.js';
import { mcpCommand } from './commands/mcp.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJson = JSON.parse(readFileSync(path.join(__dirname, '../../package.json'), 'utf-8'));
const version = packageJson.version;

const program = new Command();

program
  .name('codex-flow')
  .description('Multi-agent orchestration toolkit supporting OpenAI, Anthropic Claude, and Google Gemini with swarm intelligence')
  .version(version);

// Add commands
program.addCommand(authCommand);
program.addCommand(initCommand);
program.addCommand(swarmCommand);
program.addCommand(taskCommand);
program.addCommand(configCommand);
program.addCommand(hiveLoopCommand);
program.addCommand(mcpCommand);

// Global error handler
program.exitOverride();

try {
  program.parse();
} catch (error: any) {
  if (error.code === 'commander.version') {
    console.log(version);
  } else if (error.code === 'commander.help') {
    console.log(error.message);
  } else {
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
  }
}