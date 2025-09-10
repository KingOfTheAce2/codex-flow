import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import { promises as fs } from 'fs';
import { HiveLoopRunner, HiveLoopConfig } from '../../core/hive-loop/HiveLoopRunner.js';

export const hiveLoopCommand = new Command('hive-loop')
  .description('Automated hive-mind spawning with loop control');

// Run hive-loop automation
hiveLoopCommand
  .command('run')
  .description('Run automated hive-loop with repeated hive-mind spawn cycles')
  .option('--prompt1 <prompt>', 'First prompt (file path or string)', 'Build a hello world application')
  .option('--prompt2 <prompt>', 'Second corrective prompt (file path or string)', 'You are wrong, please fix the issues and align with best practices')
  .option('--maxSessions <n>', 'Maximum number of sessions to run', '10')
  .option('--durationHours <h>', 'Maximum duration in hours', '1')
  .option('--sessionTimeoutMinutes <m>', 'Timeout per session in minutes', '15')
  .option('--workDir <path>', 'Working directory for execution', process.cwd())
  .option('--providers <list>', 'Comma-separated list of providers', 'local')
  .option('--logDir <path>', 'Directory for session logs', './logs/automation')
  .option('--stopOnError', 'Stop loop on first error', false)
  .option('--verbose', 'Enable verbose logging', false)
  .action(async (options) => {
    try {
      console.log(chalk.blue('🚀 Initializing hive-loop automation...\n'));

      // Parse and validate options
      const config = await parseConfig(options);
      
      // Validate configuration
      await validateConfig(config);

      if (options.verbose) {
        console.log(chalk.gray('Configuration:'));
        console.log(chalk.gray(JSON.stringify(config, null, 2)));
        console.log('');
      }

      // Create runner and execute
      const runner = new HiveLoopRunner(config);
      const results = await runner.run();

      // Print final results
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      console.log(chalk.green(`\n✅ Hive-loop completed successfully!`));
      console.log(chalk.white(`Sessions run: ${results.length}`));
      console.log(chalk.green(`Successful: ${successful}`));
      if (failed > 0) {
        console.log(chalk.red(`Failed: ${failed}`));
      }
      console.log(chalk.white(`Logs saved to: ${config.logDir}`));

    } catch (error: any) {
      console.error(chalk.red('❌ Hive-loop failed:'), error.message);
      if (options.verbose) {
        console.error(chalk.red('Stack trace:'), error.stack);
      }
      process.exit(1);
    }
  });

// Status command to check running loops
hiveLoopCommand
  .command('status')
  .description('Check status of running hive-loop processes')
  .option('--logDir <path>', 'Log directory to check', './logs/automation')
  .action(async (options) => {
    try {
      const summaryPath = path.join(options.logDir, 'hive-loop-summary.json');
      
      try {
        const summaryContent = await fs.readFile(summaryPath, 'utf8');
        const summary = JSON.parse(summaryContent);
        
        console.log(chalk.blue('📊 Latest Hive-Loop Status:'));
        console.log(chalk.white(`Start Time: ${new Date(summary.startTime).toLocaleString()}`));
        console.log(chalk.white(`End Time: ${new Date(summary.endTime).toLocaleString()}`));
        console.log(chalk.white(`Total Sessions: ${summary.totalSessions}`));
        console.log(chalk.green(`Successful: ${summary.successfulSessions}`));
        console.log(chalk.red(`Failed: ${summary.failedSessions}`));
        
        if (summary.sessions && summary.sessions.length > 0) {
          console.log(chalk.blue('\n📋 Recent Sessions:'));
          summary.sessions.slice(-5).forEach((session: any) => {
            const status = session.success ? chalk.green('✅') : chalk.red('❌');
            const duration = session.endTime 
              ? Math.round((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 1000)
              : 'running';
            console.log(chalk.white(`${status} Session ${session.sessionId}: ${duration}s`));
          });
        }
        
      } catch (error) {
        console.log(chalk.yellow('⚠️ No recent hive-loop summary found'));
        console.log(chalk.gray(`Checked: ${summaryPath}`));
      }
      
    } catch (error: any) {
      console.error(chalk.red('❌ Failed to check status:'), error.message);
      process.exit(1);
    }
  });

// Stop command for graceful shutdown
hiveLoopCommand
  .command('stop')
  .description('Request graceful stop of running hive-loop processes')
  .option('--logDir <path>', 'Log directory to check', './logs/automation')
  .action(async (options) => {
    try {
      const stopFlagPath = path.join(options.logDir, '.stop_hive_loop');
      await fs.writeFile(stopFlagPath, new Date().toISOString(), 'utf8');
      
      console.log(chalk.yellow('🛑 Stop flag set. Running hive-loops will stop gracefully.'));
      console.log(chalk.gray(`Stop flag created at: ${stopFlagPath}`));
      
    } catch (error: any) {
      console.error(chalk.red('❌ Failed to set stop flag:'), error.message);
      process.exit(1);
    }
  });

async function parseConfig(options: any): Promise<HiveLoopConfig> {
  const config: HiveLoopConfig = {
    prompt1: await resolvePrompt(options.prompt1),
    prompt2: await resolvePrompt(options.prompt2),
    maxSessions: parseInt(options.maxSessions, 10),
    durationHours: parseFloat(options.durationHours),
    sessionTimeoutMinutes: parseInt(options.sessionTimeoutMinutes, 10),
    workDir: path.resolve(options.workDir),
    providers: options.providers.split(',').map((p: string) => p.trim()).filter((p: string) => p.length > 0),
    logDir: path.resolve(options.logDir),
    stopOnError: options.stopOnError,
    verbose: options.verbose
  };

  return config;
}

async function resolvePrompt(promptInput: string): Promise<string> {
  // Check if it's a file path
  if (promptInput.includes('/') || promptInput.includes('\\') || promptInput.endsWith('.txt') || promptInput.endsWith('.md')) {
    try {
      const resolvedPath = path.resolve(promptInput);
      const content = await fs.readFile(resolvedPath, 'utf8');
      return content.trim();
    } catch (error) {
      console.log(chalk.yellow(`⚠️ Could not read file ${promptInput}, using as string prompt`));
      return promptInput;
    }
  }
  
  return promptInput;
}

async function validateConfig(config: HiveLoopConfig): Promise<void> {
  const errors: string[] = [];

  // Validate numeric values
  if (config.maxSessions < 1 || config.maxSessions > 1000) {
    errors.push('maxSessions must be between 1 and 1000');
  }

  if (config.durationHours < 0.1 || config.durationHours > 168) { // Max 1 week
    errors.push('durationHours must be between 0.1 and 168');
  }

  if (config.sessionTimeoutMinutes < 1 || config.sessionTimeoutMinutes > 1440) { // Max 24 hours
    errors.push('sessionTimeoutMinutes must be between 1 and 1440');
  }

  // Validate directories
  try {
    await fs.access(config.workDir);
  } catch (error) {
    errors.push(`workDir does not exist: ${config.workDir}`);
  }

  // Validate prompts
  if (!config.prompt1 || config.prompt1.length < 5) {
    errors.push('prompt1 must be at least 5 characters long');
  }

  if (!config.prompt2 || config.prompt2.length < 5) {
    errors.push('prompt2 must be at least 5 characters long');
  }

  // Validate providers
  const validProviders = ['openai', 'claude', 'anthropic', 'gemini', 'local'];
  for (const provider of config.providers) {
    if (!validProviders.includes(provider)) {
      console.log(chalk.yellow(`⚠️ Unknown provider: ${provider}`));
    }
  }

  if (errors.length > 0) {
    console.error(chalk.red('❌ Configuration errors:'));
    errors.forEach(error => console.error(chalk.red(`  - ${error}`)));
    throw new Error('Invalid configuration');
  }

  console.log(chalk.green('✅ Configuration validated successfully'));
}