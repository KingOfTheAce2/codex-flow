#!/usr/bin/env node

import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';

export interface HiveLoopConfig {
  prompt1: string;
  prompt2: string;
  maxSessions: number;
  durationHours: number;
  sessionTimeoutMinutes: number;
  workDir: string;
  providers: string[];
  logDir: string;
  stopOnError?: boolean;
  verbose?: boolean;
}

export interface SessionResult {
  sessionId: number;
  startTime: Date;
  endTime?: Date;
  success: boolean;
  error?: string;
  prompt1Result?: string;
  prompt2Result?: string;
  logFile: string;
}

export class HiveLoopRunner {
  private config: HiveLoopConfig;
  private sessions: SessionResult[] = [];
  private stopRequested: boolean = false;
  private startTime: Date;
  private activeProcess?: ChildProcess;
  private sessionTimeoutHandle?: NodeJS.Timeout;

  constructor(config: HiveLoopConfig) {
    this.config = config;
    this.startTime = new Date();
    
    // Set up graceful shutdown handlers
    this.setupShutdownHandlers();
  }

  private setupShutdownHandlers(): void {
    const cleanup = () => {
      console.log(chalk.yellow('\n🛑 Stop signal received, shutting down gracefully...'));
      this.requestStop();
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('SIGQUIT', cleanup);
  }

  async run(): Promise<SessionResult[]> {
    console.log(chalk.blue('🔄 Starting hive-loop automation...'));
    console.log(chalk.white(`Max Sessions: ${this.config.maxSessions}`));
    console.log(chalk.white(`Duration: ${this.config.durationHours} hours`));
    console.log(chalk.white(`Session Timeout: ${this.config.sessionTimeoutMinutes} minutes`));
    console.log(chalk.white(`Work Directory: ${this.config.workDir}`));
    console.log(chalk.white(`Log Directory: ${this.config.logDir}\n`));

    // Ensure log directory exists
    await this.ensureLogDirectory();

    let sessionCount = 0;
    while (!(await this.shouldStop(sessionCount))) {
      sessionCount++;
      
      if (this.config.verbose) {
        console.log(chalk.cyan(`\n📋 Starting session ${sessionCount}/${this.config.maxSessions}...`));
      }

      const sessionResult = await this.runSession(sessionCount);
      this.sessions.push(sessionResult);

      if (!sessionResult.success && this.config.stopOnError) {
        console.log(chalk.red('❌ Session failed and stopOnError is enabled. Stopping loop.'));
        break;
      }

      // Brief pause between sessions
      if (!(await this.shouldStop(sessionCount))) {
        await this.sleep(2000);
      }
    }

    await this.generateSummaryReport();
    return this.sessions;
  }

  private async runSession(sessionId: number): Promise<SessionResult> {
    const sessionResult: SessionResult = {
      sessionId,
      startTime: new Date(),
      success: false,
      logFile: path.join(this.config.logDir, `session-${sessionId}.log`)
    };

    try {
      // Run first prompt
      const prompt1Result = await this.executePrompt(
        this.config.prompt1,
        `session-${sessionId}-prompt1`,
        sessionResult.logFile
      );
      sessionResult.prompt1Result = prompt1Result;

      if (this.config.verbose) {
        console.log(chalk.green(`✅ Prompt 1 completed for session ${sessionId}`));
      }

      // Run corrective follow-up (prompt2)
      const prompt2Result = await this.executePrompt(
        this.config.prompt2,
        `session-${sessionId}-prompt2`,
        sessionResult.logFile
      );
      sessionResult.prompt2Result = prompt2Result;

      if (this.config.verbose) {
        console.log(chalk.green(`✅ Prompt 2 completed for session ${sessionId}`));
      }

      sessionResult.success = true;
      sessionResult.endTime = new Date();
      
    } catch (error: any) {
      sessionResult.error = error.message;
      sessionResult.endTime = new Date();
      console.log(chalk.red(`❌ Session ${sessionId} failed: ${error.message}`));
      
      await this.appendToLogFile(sessionResult.logFile, `ERROR: ${error.message}\n`);
    }

    return sessionResult;
  }

  private async executePrompt(
    prompt: string,
    identifier: string,
    logFile: string
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      // Build command
      const providers = this.config.providers.length > 0 
        ? ['--providers', this.config.providers.join(',')]
        : ['--claude'];

      const args = [
        'swarm', 'spawn',
        prompt,
        ...providers,
        '--verbose'
      ];

      if (this.config.verbose) {
        console.log(chalk.gray(`Running: codex-flow ${args.join(' ')}`));
      }

      // Log command to file
      this.appendToLogFile(logFile, 
        `\n[${new Date().toISOString()}] ${identifier}\n` +
        `Command: codex-flow ${args.join(' ')}\n` +
        `Prompt: ${prompt}\n\n`
      );

      // Spawn process - use codex-flow directly since we're already in the project
      this.activeProcess = spawn('codex-flow', args, {
        cwd: this.config.workDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true  // Use shell to resolve codex-flow PATH
      });

      let output = '';
      let errorOutput = '';

      // Set up session timeout
      this.sessionTimeoutHandle = setTimeout(() => {
        if (this.activeProcess && !this.activeProcess.killed) {
          console.log(chalk.yellow(`⏰ Session timeout reached, killing process...`));
          this.killActiveProcess();
          reject(new Error(`Session timeout after ${this.config.sessionTimeoutMinutes} minutes`));
        }
      }, this.config.sessionTimeoutMinutes * 60 * 1000);

      // Handle stdout
      this.activeProcess.stdout?.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;
        this.appendToLogFile(logFile, chunk);
        
        if (this.config.verbose) {
          process.stdout.write(chalk.gray(chunk));
        }
      });

      // Handle stderr
      this.activeProcess.stderr?.on('data', (data) => {
        const chunk = data.toString();
        errorOutput += chunk;
        this.appendToLogFile(logFile, `STDERR: ${chunk}`);
        
        if (this.config.verbose) {
          process.stderr.write(chalk.red(chunk));
        }
      });

      // Handle process exit
      this.activeProcess.on('close', (code) => {
        if (this.sessionTimeoutHandle) {
          clearTimeout(this.sessionTimeoutHandle);
        }
        
        this.activeProcess = undefined;
        
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Process exited with code ${code}: ${errorOutput}`));
        }
      });

      // Handle process errors
      this.activeProcess.on('error', (error) => {
        if (this.sessionTimeoutHandle) {
          clearTimeout(this.sessionTimeoutHandle);
        }
        
        this.activeProcess = undefined;
        reject(error);
      });
    });
  }

  private async ensureLogDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.config.logDir, { recursive: true });
    } catch (error) {
      console.error(chalk.red('Failed to create log directory:'), error);
      throw error;
    }
  }

  private async appendToLogFile(logFile: string, content: string): Promise<void> {
    try {
      await fs.appendFile(logFile, content, 'utf8');
    } catch (error) {
      console.error(chalk.red('Failed to write to log file:'), error);
    }
  }

  private async shouldStop(sessionCount: number): Promise<boolean> {
    // Check stop flag file
    if (await this.checkStopFlag()) {
      console.log(chalk.yellow('🛑 Stop flag detected, ending loop...'));
      return true;
    }

    // Check internal stop request
    if (this.stopRequested) {
      console.log(chalk.yellow('🛑 Stop requested, ending loop...'));
      return true;
    }

    // Check max sessions
    if (sessionCount >= this.config.maxSessions) {
      console.log(chalk.blue(`✅ Reached max sessions (${this.config.maxSessions}), stopping...`));
      return true;
    }

    // Check duration
    const elapsed = (new Date().getTime() - this.startTime.getTime()) / (1000 * 60 * 60);
    if (elapsed >= this.config.durationHours) {
      console.log(chalk.blue(`⏰ Reached time limit (${this.config.durationHours} hours), stopping...`));
      return true;
    }

    return false;
  }

  private async checkStopFlag(): Promise<boolean> {
    try {
      const stopFlagPath = path.join(this.config.logDir, '.stop_hive_loop');
      await fs.access(stopFlagPath);
      
      // Remove the stop flag file after detecting it
      await fs.unlink(stopFlagPath);
      return true;
    } catch (error) {
      // File doesn't exist, continue
      return false;
    }
  }

  private requestStop(): void {
    this.stopRequested = true;
    this.killActiveProcess();
  }

  private killActiveProcess(): void {
    if (this.activeProcess && !this.activeProcess.killed) {
      console.log(chalk.yellow('🔪 Killing active process...'));
      
      // Try graceful shutdown first
      this.activeProcess.kill('SIGTERM');
      
      // Force kill after 5 seconds
      setTimeout(() => {
        if (this.activeProcess && !this.activeProcess.killed) {
          console.log(chalk.red('🔪 Force killing process...'));
          this.activeProcess.kill('SIGKILL');
        }
      }, 5000);
    }
  }

  private async generateSummaryReport(): Promise<void> {
    const reportPath = path.join(this.config.logDir, 'hive-loop-summary.json');
    
    const summary = {
      config: this.config,
      startTime: this.startTime,
      endTime: new Date(),
      totalSessions: this.sessions.length,
      successfulSessions: this.sessions.filter(s => s.success).length,
      failedSessions: this.sessions.filter(s => !s.success).length,
      sessions: this.sessions
    };

    try {
      await fs.writeFile(reportPath, JSON.stringify(summary, null, 2), 'utf8');
      console.log(chalk.green(`📊 Summary report saved to: ${reportPath}`));
    } catch (error) {
      console.error(chalk.red('Failed to save summary report:'), error);
    }

    // Print summary to console
    console.log(chalk.blue('\n📊 Hive-Loop Summary:'));
    console.log(chalk.white(`Total Sessions: ${summary.totalSessions}`));
    console.log(chalk.green(`Successful: ${summary.successfulSessions}`));
    console.log(chalk.red(`Failed: ${summary.failedSessions}`));
    console.log(chalk.white(`Duration: ${((summary.endTime.getTime() - summary.startTime.getTime()) / (1000 * 60)).toFixed(2)} minutes`));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export for external usage
export default HiveLoopRunner;