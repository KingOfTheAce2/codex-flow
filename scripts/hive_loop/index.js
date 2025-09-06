#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HiveLoopRunner = void 0;
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const chalk_1 = __importDefault(require("chalk"));
class HiveLoopRunner {
    config;
    sessions = [];
    stopRequested = false;
    startTime;
    activeProcess;
    sessionTimeoutHandle;
    constructor(config) {
        this.config = config;
        this.startTime = new Date();
        // Set up graceful shutdown handlers
        this.setupShutdownHandlers();
    }
    setupShutdownHandlers() {
        const cleanup = () => {
            console.log(chalk_1.default.yellow('\n🛑 Stop signal received, shutting down gracefully...'));
            this.requestStop();
        };
        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);
        process.on('SIGQUIT', cleanup);
    }
    async run() {
        console.log(chalk_1.default.blue('🔄 Starting hive-loop automation...'));
        console.log(chalk_1.default.white(`Max Sessions: ${this.config.maxSessions}`));
        console.log(chalk_1.default.white(`Duration: ${this.config.durationHours} hours`));
        console.log(chalk_1.default.white(`Session Timeout: ${this.config.sessionTimeoutMinutes} minutes`));
        console.log(chalk_1.default.white(`Work Directory: ${this.config.workDir}`));
        console.log(chalk_1.default.white(`Log Directory: ${this.config.logDir}\n`));
        // Ensure log directory exists
        await this.ensureLogDirectory();
        let sessionCount = 0;
        while (!(await this.shouldStop(sessionCount))) {
            sessionCount++;
            if (this.config.verbose) {
                console.log(chalk_1.default.cyan(`\n📋 Starting session ${sessionCount}/${this.config.maxSessions}...`));
            }
            const sessionResult = await this.runSession(sessionCount);
            this.sessions.push(sessionResult);
            if (!sessionResult.success && this.config.stopOnError) {
                console.log(chalk_1.default.red('❌ Session failed and stopOnError is enabled. Stopping loop.'));
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
    async runSession(sessionId) {
        const sessionResult = {
            sessionId,
            startTime: new Date(),
            success: false,
            logFile: path_1.default.join(this.config.logDir, `session-${sessionId}.log`)
        };
        try {
            // Run first prompt
            const prompt1Result = await this.executePrompt(this.config.prompt1, `session-${sessionId}-prompt1`, sessionResult.logFile);
            sessionResult.prompt1Result = prompt1Result;
            if (this.config.verbose) {
                console.log(chalk_1.default.green(`✅ Prompt 1 completed for session ${sessionId}`));
            }
            // Run corrective follow-up (prompt2)
            const prompt2Result = await this.executePrompt(this.config.prompt2, `session-${sessionId}-prompt2`, sessionResult.logFile);
            sessionResult.prompt2Result = prompt2Result;
            if (this.config.verbose) {
                console.log(chalk_1.default.green(`✅ Prompt 2 completed for session ${sessionId}`));
            }
            sessionResult.success = true;
            sessionResult.endTime = new Date();
        }
        catch (error) {
            sessionResult.error = error.message;
            sessionResult.endTime = new Date();
            console.log(chalk_1.default.red(`❌ Session ${sessionId} failed: ${error.message}`));
            await this.appendToLogFile(sessionResult.logFile, `ERROR: ${error.message}\n`);
        }
        return sessionResult;
    }
    async executePrompt(prompt, identifier, logFile) {
        return new Promise((resolve, reject) => {
            // Build command
            const providers = this.config.providers.length > 0
                ? ['--providers', this.config.providers.join(',')]
                : ['--claude'];
            const args = [
                'hive-mind', 'spawn',
                prompt,
                ...providers,
                '--verbose'
            ];
            if (this.config.verbose) {
                console.log(chalk_1.default.gray(`Running: npx codex-flow ${args.join(' ')}`));
            }
            // Log command to file
            this.appendToLogFile(logFile, `\n[${new Date().toISOString()}] ${identifier}\n` +
                `Command: npx codex-flow ${args.join(' ')}\n` +
                `Prompt: ${prompt}\n\n`);
            // Spawn process
            this.activeProcess = (0, child_process_1.spawn)('npx', ['codex-flow', ...args], {
                cwd: this.config.workDir,
                stdio: ['pipe', 'pipe', 'pipe']
            });
            let output = '';
            let errorOutput = '';
            // Set up session timeout
            this.sessionTimeoutHandle = setTimeout(() => {
                if (this.activeProcess && !this.activeProcess.killed) {
                    console.log(chalk_1.default.yellow(`⏰ Session timeout reached, killing process...`));
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
                    process.stdout.write(chalk_1.default.gray(chunk));
                }
            });
            // Handle stderr
            this.activeProcess.stderr?.on('data', (data) => {
                const chunk = data.toString();
                errorOutput += chunk;
                this.appendToLogFile(logFile, `STDERR: ${chunk}`);
                if (this.config.verbose) {
                    process.stderr.write(chalk_1.default.red(chunk));
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
                }
                else {
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
    async ensureLogDirectory() {
        try {
            await fs_1.promises.mkdir(this.config.logDir, { recursive: true });
        }
        catch (error) {
            console.error(chalk_1.default.red('Failed to create log directory:'), error);
            throw error;
        }
    }
    async appendToLogFile(logFile, content) {
        try {
            await fs_1.promises.appendFile(logFile, content, 'utf8');
        }
        catch (error) {
            console.error(chalk_1.default.red('Failed to write to log file:'), error);
        }
    }
    async shouldStop(sessionCount) {
        // Check stop flag file
        if (await this.checkStopFlag()) {
            console.log(chalk_1.default.yellow('🛑 Stop flag detected, ending loop...'));
            return true;
        }
        // Check internal stop request
        if (this.stopRequested) {
            console.log(chalk_1.default.yellow('🛑 Stop requested, ending loop...'));
            return true;
        }
        // Check max sessions
        if (sessionCount >= this.config.maxSessions) {
            console.log(chalk_1.default.blue(`✅ Reached max sessions (${this.config.maxSessions}), stopping...`));
            return true;
        }
        // Check duration
        const elapsed = (new Date().getTime() - this.startTime.getTime()) / (1000 * 60 * 60);
        if (elapsed >= this.config.durationHours) {
            console.log(chalk_1.default.blue(`⏰ Reached time limit (${this.config.durationHours} hours), stopping...`));
            return true;
        }
        return false;
    }
    async checkStopFlag() {
        try {
            const stopFlagPath = path_1.default.join(this.config.logDir, '.stop_hive_loop');
            await fs_1.promises.access(stopFlagPath);
            // Remove the stop flag file after detecting it
            await fs_1.promises.unlink(stopFlagPath);
            return true;
        }
        catch (error) {
            // File doesn't exist, continue
            return false;
        }
    }
    requestStop() {
        this.stopRequested = true;
        this.killActiveProcess();
    }
    killActiveProcess() {
        if (this.activeProcess && !this.activeProcess.killed) {
            console.log(chalk_1.default.yellow('🔪 Killing active process...'));
            // Try graceful shutdown first
            this.activeProcess.kill('SIGTERM');
            // Force kill after 5 seconds
            setTimeout(() => {
                if (this.activeProcess && !this.activeProcess.killed) {
                    console.log(chalk_1.default.red('🔪 Force killing process...'));
                    this.activeProcess.kill('SIGKILL');
                }
            }, 5000);
        }
    }
    async generateSummaryReport() {
        const reportPath = path_1.default.join(this.config.logDir, 'hive-loop-summary.json');
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
            await fs_1.promises.writeFile(reportPath, JSON.stringify(summary, null, 2), 'utf8');
            console.log(chalk_1.default.green(`📊 Summary report saved to: ${reportPath}`));
        }
        catch (error) {
            console.error(chalk_1.default.red('Failed to save summary report:'), error);
        }
        // Print summary to console
        console.log(chalk_1.default.blue('\n📊 Hive-Loop Summary:'));
        console.log(chalk_1.default.white(`Total Sessions: ${summary.totalSessions}`));
        console.log(chalk_1.default.green(`Successful: ${summary.successfulSessions}`));
        console.log(chalk_1.default.red(`Failed: ${summary.failedSessions}`));
        console.log(chalk_1.default.white(`Duration: ${((summary.endTime.getTime() - summary.startTime.getTime()) / (1000 * 60)).toFixed(2)} minutes`));
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.HiveLoopRunner = HiveLoopRunner;
// Export for external usage
exports.default = HiveLoopRunner;
//# sourceMappingURL=index.js.map