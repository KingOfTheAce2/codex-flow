/**
 * MCP Error Handling and Timeout Management
 * 
 * Provides robust error handling, retry mechanisms, and timeout management
 * for MCP operations
 */

import winston from 'winston';
import { EventEmitter } from 'events';

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
  retryableErrors?: string[];
}

export interface TimeoutConfig {
  connectionTimeoutMs: number;
  callTimeoutMs: number;
  healthCheckTimeoutMs: number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  monitoringWindowMs: number;
}

export class MCPError extends Error {
  constructor(
    message: string,
    public code: string,
    public serverId?: string,
    public retryable: boolean = false,
    public cause?: Error
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

export class MCPTimeoutError extends MCPError {
  constructor(operation: string, timeoutMs: number, serverId?: string) {
    super(
      `Operation '${operation}' timed out after ${timeoutMs}ms`,
      'MCP_TIMEOUT',
      serverId,
      true
    );
    this.name = 'MCPTimeoutError';
  }
}

export class MCPConnectionError extends MCPError {
  constructor(message: string, serverId?: string, cause?: Error) {
    super(message, 'MCP_CONNECTION_ERROR', serverId, true, cause);
    this.name = 'MCPConnectionError';
  }
}

export class MCPToolError extends MCPError {
  constructor(toolName: string, message: string, serverId?: string, retryable: boolean = false) {
    super(`Tool '${toolName}': ${message}`, 'MCP_TOOL_ERROR', serverId, retryable);
    this.name = 'MCPToolError';
  }
}

export class MCPValidationError extends MCPError {
  constructor(message: string, serverId?: string) {
    super(message, 'MCP_VALIDATION_ERROR', serverId, false);
    this.name = 'MCPValidationError';
  }
}

/**
 * Circuit breaker for MCP operations
 */
export class MCPCircuitBreaker extends EventEmitter {
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private successCount: number = 0;
  
  constructor(
    private serverId: string,
    private config: CircuitBreakerConfig,
    private logger: winston.Logger
  ) {
    super();
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime < this.config.resetTimeoutMs) {
        throw new MCPError(
          'Circuit breaker is open',
          'MCP_CIRCUIT_OPEN',
          this.serverId,
          true
        );
      } else {
        this.state = 'half-open';
        this.successCount = 0;
        this.logger.info('Circuit breaker entering half-open state', { serverId: this.serverId });
      }
    }

    try {
      const result = await operation();
      
      if (this.state === 'half-open') {
        this.successCount++;
        if (this.successCount >= 3) { // Require 3 successful calls to close
          this.state = 'closed';
          this.failures = 0;
          this.logger.info('Circuit breaker closed', { serverId: this.serverId });
          this.emit('closed');
        }
      } else if (this.state === 'closed') {
        this.failures = 0; // Reset failure count on success
      }

      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();

      if (this.failures >= this.config.failureThreshold) {
        this.state = 'open';
        this.logger.warn('Circuit breaker opened', { 
          serverId: this.serverId,
          failures: this.failures
        });
        this.emit('opened');
      } else if (this.state === 'half-open') {
        this.state = 'open';
        this.logger.warn('Circuit breaker re-opened from half-open', { serverId: this.serverId });
      }

      throw error;
    }
  }

  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }

  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    this.logger.info('Circuit breaker reset', { serverId: this.serverId });
  }
}

/**
 * Retry mechanism with exponential backoff
 */
export class MCPRetryHandler {
  constructor(
    private config: RetryConfig,
    private logger: winston.Logger
  ) {}

  async execute<T>(
    operation: () => Promise<T>,
    operationName: string,
    serverId?: string
  ): Promise<T> {
    let lastError: Error;
    let delay = this.config.baseDelayMs;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          this.logger.debug('Retrying operation', { 
            operationName,
            serverId,
            attempt,
            delay
          });
          await this.sleep(delay);
        }

        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt === this.config.maxRetries) {
          break;
        }

        // Check if error is retryable
        if (!this.isRetryableError(error as Error)) {
          this.logger.debug('Non-retryable error, stopping retries', {
            operationName,
            serverId,
            error: error.message
          });
          throw error;
        }

        this.logger.warn('Operation failed, will retry', {
          operationName,
          serverId,
          attempt,
          error: error.message,
          nextDelayMs: Math.min(delay * this.config.backoffFactor, this.config.maxDelayMs)
        });

        delay = Math.min(delay * this.config.backoffFactor, this.config.maxDelayMs);
      }
    }

    this.logger.error('All retry attempts exhausted', {
      operationName,
      serverId,
      maxRetries: this.config.maxRetries
    });
    
    throw lastError!;
  }

  private isRetryableError(error: Error): boolean {
    if (error instanceof MCPError) {
      return error.retryable;
    }

    // Check against configured retryable error patterns
    if (this.config.retryableErrors) {
      return this.config.retryableErrors.some(pattern => 
        error.message.toLowerCase().includes(pattern.toLowerCase())
      );
    }

    // Default retryable conditions
    const retryablePatterns = [
      'timeout',
      'connection',
      'network',
      'ECONNRESET',
      'ECONNREFUSED',
      'ETIMEDOUT'
    ];

    return retryablePatterns.some(pattern =>
      error.message.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Timeout manager for MCP operations
 */
export class MCPTimeoutManager {
  constructor(
    private config: TimeoutConfig,
    private logger: winston.Logger
  ) {}

  async withTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    operationName: string,
    serverId?: string
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new MCPTimeoutError(operationName, timeoutMs, serverId));
      }, timeoutMs);

      // Clear timeout if operation completes
      operation().then(() => clearTimeout(timeoutId)).catch(() => clearTimeout(timeoutId));
    });

    return Promise.race([operation(), timeoutPromise]);
  }

  async withConnectionTimeout<T>(operation: () => Promise<T>, serverId?: string): Promise<T> {
    return this.withTimeout(
      operation,
      this.config.connectionTimeoutMs,
      'connection',
      serverId
    );
  }

  async withCallTimeout<T>(operation: () => Promise<T>, serverId?: string): Promise<T> {
    return this.withTimeout(
      operation,
      this.config.callTimeoutMs,
      'tool_call',
      serverId
    );
  }

  async withHealthCheckTimeout<T>(operation: () => Promise<T>, serverId?: string): Promise<T> {
    return this.withTimeout(
      operation,
      this.config.healthCheckTimeoutMs,
      'health_check',
      serverId
    );
  }
}

/**
 * Comprehensive MCP error handler
 */
export class MCPErrorHandler extends EventEmitter {
  private circuitBreakers: Map<string, MCPCircuitBreaker> = new Map();
  private retryHandler: MCPRetryHandler;
  private timeoutManager: MCPTimeoutManager;
  private logger: winston.Logger;

  constructor(
    private retryConfig: RetryConfig = {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 10000,
      backoffFactor: 2
    },
    private timeoutConfig: TimeoutConfig = {
      connectionTimeoutMs: 10000,
      callTimeoutMs: 30000,
      healthCheckTimeoutMs: 5000
    },
    private circuitBreakerConfig: CircuitBreakerConfig = {
      failureThreshold: 5,
      resetTimeoutMs: 60000,
      monitoringWindowMs: 300000
    }
  ) {
    super();

    this.logger = winston.createLogger({
      level: 'debug',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [MCPErrorHandler] ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        })
      ),
      transports: [
        new winston.transports.Console({ silent: process.env.NODE_ENV === 'test' })
      ]
    });

    this.retryHandler = new MCPRetryHandler(retryConfig, this.logger);
    this.timeoutManager = new MCPTimeoutManager(timeoutConfig, this.logger);
  }

  /**
   * Execute operation with full error handling (circuit breaker, retry, timeout)
   */
  async execute<T>(
    operation: () => Promise<T>,
    serverId: string,
    operationName: string,
    options: {
      enableCircuitBreaker?: boolean;
      enableRetry?: boolean;
      enableTimeout?: boolean;
      timeoutMs?: number;
    } = {}
  ): Promise<T> {
    const {
      enableCircuitBreaker = true,
      enableRetry = true,
      enableTimeout = true,
      timeoutMs = this.timeoutConfig.callTimeoutMs
    } = options;

    let wrappedOperation = operation;

    // Apply timeout wrapper
    if (enableTimeout) {
      wrappedOperation = () => this.timeoutManager.withTimeout(
        operation,
        timeoutMs,
        operationName,
        serverId
      );
    }

    // Apply retry wrapper
    if (enableRetry) {
      const currentOperation = wrappedOperation;
      wrappedOperation = () => this.retryHandler.execute(
        currentOperation,
        operationName,
        serverId
      );
    }

    // Apply circuit breaker wrapper
    if (enableCircuitBreaker) {
      const circuitBreaker = this.getOrCreateCircuitBreaker(serverId);
      const currentOperation = wrappedOperation;
      wrappedOperation = () => circuitBreaker.execute(currentOperation);
    }

    try {
      const result = await wrappedOperation();
      this.emit('operation_success', { serverId, operationName });
      return result;
    } catch (error) {
      this.handleError(error as Error, serverId, operationName);
      throw error;
    }
  }

  /**
   * Execute connection with appropriate timeout and retry
   */
  async executeConnection<T>(operation: () => Promise<T>, serverId: string): Promise<T> {
    return this.execute(
      operation,
      serverId,
      'connection',
      {
        timeoutMs: this.timeoutConfig.connectionTimeoutMs,
        enableCircuitBreaker: false // Don't use circuit breaker for initial connections
      }
    );
  }

  /**
   * Execute tool call with full protection
   */
  async executeToolCall<T>(operation: () => Promise<T>, serverId: string, toolName: string): Promise<T> {
    return this.execute(
      operation,
      serverId,
      `tool_call:${toolName}`,
      {
        timeoutMs: this.timeoutConfig.callTimeoutMs
      }
    );
  }

  /**
   * Execute health check with short timeout
   */
  async executeHealthCheck<T>(operation: () => Promise<T>, serverId: string): Promise<T> {
    return this.execute(
      operation,
      serverId,
      'health_check',
      {
        timeoutMs: this.timeoutConfig.healthCheckTimeoutMs,
        enableRetry: false // Don't retry health checks
      }
    );
  }

  /**
   * Get or create circuit breaker for server
   */
  private getOrCreateCircuitBreaker(serverId: string): MCPCircuitBreaker {
    if (!this.circuitBreakers.has(serverId)) {
      const circuitBreaker = new MCPCircuitBreaker(
        serverId,
        this.circuitBreakerConfig,
        this.logger
      );

      circuitBreaker.on('opened', () => {
        this.emit('circuit_breaker_opened', serverId);
      });

      circuitBreaker.on('closed', () => {
        this.emit('circuit_breaker_closed', serverId);
      });

      this.circuitBreakers.set(serverId, circuitBreaker);
    }

    return this.circuitBreakers.get(serverId)!;
  }

  /**
   * Handle and log errors
   */
  private handleError(error: Error, serverId: string, operationName: string): void {
    this.logger.error('MCP operation failed', {
      serverId,
      operationName,
      errorType: error.constructor.name,
      message: error.message
    });

    this.emit('operation_error', {
      serverId,
      operationName,
      error,
      timestamp: new Date()
    });
  }

  /**
   * Reset circuit breaker for a server
   */
  resetCircuitBreaker(serverId: string): void {
    const circuitBreaker = this.circuitBreakers.get(serverId);
    if (circuitBreaker) {
      circuitBreaker.reset();
    }
  }

  /**
   * Get circuit breaker states for all servers
   */
  getCircuitBreakerStates(): Record<string, 'closed' | 'open' | 'half-open'> {
    const states: Record<string, 'closed' | 'open' | 'half-open'> = {};
    
    for (const [serverId, circuitBreaker] of this.circuitBreakers) {
      states[serverId] = circuitBreaker.getState();
    }
    
    return states;
  }

  /**
   * Update configuration
   */
  updateConfig(config: {
    retry?: Partial<RetryConfig>;
    timeout?: Partial<TimeoutConfig>;
    circuitBreaker?: Partial<CircuitBreakerConfig>;
  }): void {
    if (config.retry) {
      Object.assign(this.retryConfig, config.retry);
      this.retryHandler = new MCPRetryHandler(this.retryConfig, this.logger);
    }

    if (config.timeout) {
      Object.assign(this.timeoutConfig, config.timeout);
      this.timeoutManager = new MCPTimeoutManager(this.timeoutConfig, this.logger);
    }

    if (config.circuitBreaker) {
      Object.assign(this.circuitBreakerConfig, config.circuitBreaker);
    }

    this.logger.info('MCP error handler configuration updated');
  }
}

export default MCPErrorHandler;