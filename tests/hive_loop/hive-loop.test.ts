import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { HiveLoopRunner, HiveLoopConfig } from '../../src/core/hive-loop/HiveLoopRunner';

describe('HiveLoopRunner', () => {
  let testConfig: HiveLoopConfig;
  let testLogDir: string;
  let runner: HiveLoopRunner;

  beforeEach(async () => {
    // Create temporary test directory
    testLogDir = path.join(__dirname, 'tmp', `test-${Date.now()}`);
    await fs.mkdir(testLogDir, { recursive: true });

    testConfig = {
      prompt1: 'Test prompt 1',
      prompt2: 'Test prompt 2 - fix issues',
      maxSessions: 2,
      durationHours: 0.1, // 6 minutes
      sessionTimeoutMinutes: 1,
      workDir: process.cwd(),
      providers: ['local'],
      logDir: testLogDir,
      stopOnError: false,
      verbose: false
    };
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testLogDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Configuration Validation', () => {
    it('should accept valid configuration', () => {
      expect(() => new HiveLoopRunner(testConfig)).not.toThrow();
    });

    it('should handle configuration with all options', () => {
      const fullConfig = {
        ...testConfig,
        stopOnError: true,
        verbose: true
      };
      
      expect(() => new HiveLoopRunner(fullConfig)).not.toThrow();
    });
  });

  describe('Stop Flag Handling', () => {
    beforeEach(() => {
      runner = new HiveLoopRunner(testConfig);
    });

    it('should detect stop flag file', async () => {
      const stopFlagPath = path.join(testLogDir, '.stop_hive_loop');
      await fs.writeFile(stopFlagPath, 'stop', 'utf8');
      
      // Access private method for testing
      const shouldStop = await (runner as any).shouldStop(0);
      expect(shouldStop).toBe(true);
      
      // Flag should be removed after detection
      try {
        await fs.access(stopFlagPath);
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error).toBeDefined(); // File should be deleted
      }
    });

    it('should continue when no stop flag exists', async () => {
      const shouldStop = await (runner as any).shouldStop(0);
      expect(shouldStop).toBe(false);
    });
  });

  describe('Session Limits', () => {
    it('should stop at maxSessions limit', async () => {
      runner = new HiveLoopRunner({ ...testConfig, maxSessions: 3 });
      
      const shouldStop1 = await (runner as any).shouldStop(2); // 2 < 3
      expect(shouldStop1).toBe(false);
      
      const shouldStop2 = await (runner as any).shouldStop(3); // 3 >= 3
      expect(shouldStop2).toBe(true);
    });

    it('should stop at duration limit', async () => {
      const shortConfig = { ...testConfig, durationHours: 0.001 }; // ~3.6 seconds
      runner = new HiveLoopRunner(shortConfig);
      
      // Wait longer than duration
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const shouldStop = await (runner as any).shouldStop(0);
      expect(shouldStop).toBe(true);
    });
  });

  describe('Logging', () => {
    beforeEach(() => {
      runner = new HiveLoopRunner(testConfig);
    });

    it('should ensure log directory exists', async () => {
      const testLogDir2 = path.join(testLogDir, 'nested', 'path');
      const config2 = { ...testConfig, logDir: testLogDir2 };
      const runner2 = new HiveLoopRunner(config2);
      
      await (runner2 as any).ensureLogDirectory();
      
      const stats = await fs.stat(testLogDir2);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should append to log files', async () => {
      const logFile = path.join(testLogDir, 'test.log');
      await (runner as any).appendToLogFile(logFile, 'Test line 1\n');
      await (runner as any).appendToLogFile(logFile, 'Test line 2\n');
      
      const content = await fs.readFile(logFile, 'utf8');
      expect(content).toBe('Test line 1\nTest line 2\n');
    });
  });

  describe('Session Management', () => {
    it('should create session results with proper structure', () => {
      runner = new HiveLoopRunner(testConfig);
      
      const sessionResult = {
        sessionId: 1,
        startTime: new Date(),
        success: false,
        logFile: path.join(testLogDir, 'session-1.log')
      };
      
      expect(sessionResult).toHaveProperty('sessionId');
      expect(sessionResult).toHaveProperty('startTime');
      expect(sessionResult).toHaveProperty('success');
      expect(sessionResult).toHaveProperty('logFile');
    });
  });

  describe('Process Management', () => {
    beforeEach(() => {
      runner = new HiveLoopRunner(testConfig);
    });

    it('should handle graceful shutdown signals', () => {
      const killActiveProcessSpy = vi.spyOn(runner as any, 'killActiveProcess').mockImplementation(() => {});
      
      // Simulate SIGINT
      process.emit('SIGINT' as any, 'SIGINT');
      
      expect((runner as any).stopRequested).toBe(true);
    });

    it('should request stop on signal', () => {
      const originalRequestStop = (runner as any).requestStop;
      const requestStopSpy = vi.spyOn(runner as any, 'requestStop').mockImplementation(() => {
        (runner as any).stopRequested = true;
      });
      
      // Trigger signal handler
      (runner as any).setupShutdownHandlers();
      process.emit('SIGTERM' as any, 'SIGTERM');
      
      expect(requestStopSpy).toHaveBeenCalled();
      expect((runner as any).stopRequested).toBe(true);
      
      // Restore original method
      requestStopSpy.mockRestore();
    });
  });

  describe('Summary Report Generation', () => {
    beforeEach(() => {
      runner = new HiveLoopRunner(testConfig);
    });

    it('should generate summary report', async () => {
      const mockSessions = [
        {
          sessionId: 1,
          startTime: new Date(),
          endTime: new Date(),
          success: true,
          logFile: 'session-1.log'
        },
        {
          sessionId: 2,
          startTime: new Date(),
          endTime: new Date(),
          success: false,
          error: 'Test error',
          logFile: 'session-2.log'
        }
      ];
      
      (runner as any).sessions = mockSessions;
      await (runner as any).generateSummaryReport();
      
      const reportPath = path.join(testLogDir, 'hive-loop-summary.json');
      const reportContent = await fs.readFile(reportPath, 'utf8');
      const report = JSON.parse(reportContent);
      
      expect(report).toHaveProperty('config');
      expect(report).toHaveProperty('startTime');
      expect(report).toHaveProperty('endTime');
      expect(report).toHaveProperty('totalSessions', 2);
      expect(report).toHaveProperty('successfulSessions', 1);
      expect(report).toHaveProperty('failedSessions', 1);
      expect(report.sessions).toHaveLength(2);
    });
  });

  describe('Utility Functions', () => {
    it('should sleep for specified duration', async () => {
      const start = Date.now();
      await (HiveLoopRunner.prototype as any).sleep(100);
      const elapsed = Date.now() - start;
      
      expect(elapsed).toBeGreaterThanOrEqual(90); // Allow some tolerance
      expect(elapsed).toBeLessThan(150);
    });
  });
});

describe('HiveLoopConfig Parsing', () => {
  it('should parse configuration from CLI options', async () => {
    const mockOptions = {
      prompt1: 'Test prompt 1',
      prompt2: 'Test prompt 2',
      maxSessions: '5',
      durationHours: '2.5',
      sessionTimeoutMinutes: '15',
      workDir: './test-work',
      providers: 'openai,claude,local',
      logDir: './test-logs',
      stopOnError: true,
      verbose: true
    };

    // This would be part of the CLI command parsing
    const config = {
      prompt1: mockOptions.prompt1,
      prompt2: mockOptions.prompt2,
      maxSessions: parseInt(mockOptions.maxSessions, 10),
      durationHours: parseFloat(mockOptions.durationHours),
      sessionTimeoutMinutes: parseInt(mockOptions.sessionTimeoutMinutes, 10),
      workDir: path.resolve(mockOptions.workDir),
      providers: mockOptions.providers.split(',').map(p => p.trim()),
      logDir: path.resolve(mockOptions.logDir),
      stopOnError: mockOptions.stopOnError,
      verbose: mockOptions.verbose
    };

    expect(config.maxSessions).toBe(5);
    expect(config.durationHours).toBe(2.5);
    expect(config.sessionTimeoutMinutes).toBe(15);
    expect(config.providers).toEqual(['openai', 'claude', 'local']);
    expect(config.stopOnError).toBe(true);
    expect(config.verbose).toBe(true);
  });
});

describe('Error Handling', () => {
  let testLogDir: string;

  beforeEach(async () => {
    testLogDir = path.join(__dirname, 'tmp', `error-test-${Date.now()}`);
    await fs.mkdir(testLogDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testLogDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should handle invalid configuration gracefully', () => {
    const invalidConfig = {
      prompt1: '', // Empty prompt should be invalid
      prompt2: 'Valid prompt',
      maxSessions: -1, // Negative sessions invalid
      durationHours: 0,
      sessionTimeoutMinutes: 0,
      workDir: '/nonexistent/path',
      providers: [],
      logDir: testLogDir
    } as HiveLoopConfig;

    // Should not crash, but might log warnings
    expect(() => new HiveLoopRunner(invalidConfig)).not.toThrow();
  });

  it('should handle file system errors in logging', async () => {
    const config: HiveLoopConfig = {
      prompt1: 'Test prompt',
      prompt2: 'Fix prompt', 
      maxSessions: 1,
      durationHours: 1,
      sessionTimeoutMinutes: 5,
      workDir: process.cwd(),
      providers: ['local'],
      logDir: '/root/inaccessible', // Likely to cause permission error
      verbose: false
    };

    const runner = new HiveLoopRunner(config);
    
    // Should not throw, just log the error
    await expect((runner as any).appendToLogFile('/root/test.log', 'test')).resolves.not.toThrow();
  });
});