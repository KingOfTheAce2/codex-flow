#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { initCommand } from './commands/init';
import { swarmCommand } from './commands/swarm';
import { taskCommand } from './commands/task';
import { configCommand } from './commands/config';
import { authCommand } from './commands/auth';
import { hiveLoopCommand } from './commands/hive-loop';
import { mcpCommand } from './commands/mcp';
const packageJson = require('../../package.json');
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