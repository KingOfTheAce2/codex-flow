#!/usr/bin/env node
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
export declare class HiveLoopRunner {
    private config;
    private sessions;
    private stopRequested;
    private startTime;
    private activeProcess?;
    private sessionTimeoutHandle?;
    constructor(config: HiveLoopConfig);
    private setupShutdownHandlers;
    run(): Promise<SessionResult[]>;
    private runSession;
    private executePrompt;
    private ensureLogDirectory;
    private appendToLogFile;
    private shouldStop;
    private checkStopFlag;
    private requestStop;
    private killActiveProcess;
    private generateSummaryReport;
    private sleep;
}
export default HiveLoopRunner;
//# sourceMappingURL=index.d.ts.map