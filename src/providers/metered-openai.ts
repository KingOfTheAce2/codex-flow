/**
 * Metered OpenAI Provider
 * 
 * Wraps the OpenAI API with usage tracking and limit enforcement
 * to prevent unexpected costs and ensure controlled usage.
 */

import { OpenAI } from 'openai';
import { getUsageLimits, validateUsageLimits, UsageLimits } from '../config/usage-limits';
import fs from 'fs';
import path from 'path';

export interface UsageRecord {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  timestamp: string;
  model: string;
  requestId?: string;
}

export interface UsageData {
  lastReset: string;
  daily: {
    requests: number;
    inputTokens: number;
    outputTokens: number;
    totalCost: number;
    tasks: number;
  };
  total: {
    requests: number;
    inputTokens: number;
    outputTokens: number;
    totalCost: number;
    tasks: number;
  };
  limits: UsageLimits;
  startDate: string;
  records: UsageRecord[];
}

export class MeteredOpenAIError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'MeteredOpenAIError';
  }
}

export class MeteredOpenAI {
  private openai: OpenAI;
  private limits: UsageLimits;
  private usageFile: string;
  private currentRequests = 0;
  private usageData: UsageData;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) {
      throw new MeteredOpenAIError(
        'OpenAI API key is required. Set OPENAI_API_KEY environment variable or pass it to constructor.',
        'MISSING_API_KEY'
      );
    }

    this.openai = new OpenAI({ apiKey: key });
    this.limits = getUsageLimits();
    this.usageFile = path.join(process.cwd(), '.usage-tracking.json');
    
    // Validate limits and warn about potential issues
    const warnings = validateUsageLimits(this.limits);
    if (warnings.length > 0) {
      console.warn('⚠️  Usage Limit Warnings:');
      warnings.forEach(warning => console.warn(`   ${warning}`));
    }

    this.loadUsageData();
  }

  private loadUsageData() {
    try {
      if (fs.existsSync(this.usageFile)) {
        const data = JSON.parse(fs.readFileSync(this.usageFile, 'utf8'));
        const today = new Date().toISOString().split('T')[0];
        
        // Reset daily counters if it's a new day
        if (data.lastReset !== today) {
          data.daily = {
            requests: 0,
            inputTokens: 0,
            outputTokens: 0,
            totalCost: 0,
            tasks: 0
          };
          data.lastReset = today;
          
          // Keep only last 100 records to prevent file from growing too large
          if (data.records && data.records.length > 100) {
            data.records = data.records.slice(-100);
          }
        }
        
        this.usageData = data;
        this.usageData.limits = this.limits; // Update limits in case they changed
      } else {
        this.resetUsageData();
      }
    } catch (error) {
      console.error('Error loading usage data:', error);
      this.resetUsageData();
    }
  }

  private resetUsageData() {
    const today = new Date().toISOString().split('T')[0];
    this.usageData = {
      lastReset: today,
      daily: {
        requests: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalCost: 0,
        tasks: 0
      },
      total: {
        requests: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalCost: 0,
        tasks: 0
      },
      limits: this.limits,
      startDate: today,
      records: []
    };
  }

  private saveUsageData() {
    try {
      fs.writeFileSync(this.usageFile, JSON.stringify(this.usageData, null, 2));
    } catch (error) {
      console.error('Error saving usage data:', error);
    }
  }

  private checkDailyLimits(): string[] {
    const violations: string[] = [];
    
    if (this.usageData.daily.totalCost >= this.limits.DAILY_SPENDING_CAP_USD) {
      violations.push(`Daily spending cap exceeded: $${this.usageData.daily.totalCost.toFixed(4)} >= $${this.limits.DAILY_SPENDING_CAP_USD}`);
    }
    
    if (this.usageData.daily.requests >= this.limits.DAILY_REQUEST_LIMIT) {
      violations.push(`Daily request limit exceeded: ${this.usageData.daily.requests} >= ${this.limits.DAILY_REQUEST_LIMIT}`);
    }
    
    const totalTokens = this.usageData.daily.inputTokens + this.usageData.daily.outputTokens;
    if (totalTokens >= this.limits.DAILY_TOKEN_LIMIT) {
      violations.push(`Daily token limit exceeded: ${totalTokens} >= ${this.limits.DAILY_TOKEN_LIMIT}`);
    }
    
    return violations;
  }

  private checkRequestLimits(messages: any[]): string[] {
    const violations: string[] = [];
    
    // Estimate prompt tokens (rough approximation: 1 token ≈ 4 characters)
    const promptText = messages.map(m => m.content).join(' ');
    const estimatedPromptTokens = Math.ceil(promptText.length / 4);
    
    if (estimatedPromptTokens > this.limits.MAX_PROMPT_TOKENS) {
      violations.push(`Estimated prompt tokens exceed limit: ${estimatedPromptTokens} > ${this.limits.MAX_PROMPT_TOKENS}`);
    }
    
    if (this.currentRequests >= this.limits.MAX_CONCURRENT_REQUESTS) {
      violations.push(`Concurrent request limit exceeded: ${this.currentRequests} >= ${this.limits.MAX_CONCURRENT_REQUESTS}`);
    }
    
    return violations;
  }

  private recordUsage(inputTokens: number, outputTokens: number, model: string, requestId?: string): UsageRecord {
    const inputCost = inputTokens * this.limits.COST_PER_INPUT_TOKEN;
    const outputCost = outputTokens * this.limits.COST_PER_OUTPUT_TOKEN;
    const totalCost = inputCost + outputCost;

    const record: UsageRecord = {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      inputCost,
      outputCost,
      totalCost,
      timestamp: new Date().toISOString(),
      model,
      requestId
    };

    // Update counters
    this.usageData.daily.requests += 1;
    this.usageData.daily.inputTokens += inputTokens;
    this.usageData.daily.outputTokens += outputTokens;
    this.usageData.daily.totalCost += totalCost;

    this.usageData.total.requests += 1;
    this.usageData.total.inputTokens += inputTokens;
    this.usageData.total.outputTokens += outputTokens;
    this.usageData.total.totalCost += totalCost;

    // Add to records
    this.usageData.records.push(record);

    // Save updated data
    this.saveUsageData();

    return record;
  }

  /**
   * Create a chat completion with usage tracking and limit enforcement
   */
  async createChatCompletion(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    options: Partial<OpenAI.Chat.Completions.ChatCompletionCreateParams> = {}
  ): Promise<{ completion: OpenAI.Chat.Completions.ChatCompletion; usage: UsageRecord }> {
    
    // Check daily limits
    const dailyViolations = this.checkDailyLimits();
    if (dailyViolations.length > 0) {
      throw new MeteredOpenAIError(
        `Daily limits exceeded: ${dailyViolations.join(', ')}`,
        'DAILY_LIMIT_EXCEEDED'
      );
    }

    // Check request-specific limits
    const requestViolations = this.checkRequestLimits(messages);
    if (requestViolations.length > 0) {
      throw new MeteredOpenAIError(
        `Request limits exceeded: ${requestViolations.join(', ')}`,
        'REQUEST_LIMIT_EXCEEDED'
      );
    }

    // Apply hardcoded limits to request parameters
    const params: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
      model: this.limits.MODEL,
      messages,
      max_tokens: Math.min(options.max_tokens || this.limits.MAX_RESPONSE_TOKENS, this.limits.MAX_RESPONSE_TOKENS),
      ...options,
      // Ensure we always get usage data
      stream: false
    };

    this.currentRequests++;
    
    try {
      const completion = await this.openai.chat.completions.create(params);
      
      if (!completion.usage) {
        throw new MeteredOpenAIError('No usage data returned from OpenAI API', 'MISSING_USAGE_DATA');
      }

      const usage = this.recordUsage(
        completion.usage.prompt_tokens,
        completion.usage.completion_tokens,
        params.model,
        completion.id
      );

      return { completion, usage };

    } catch (error) {
      if (error instanceof MeteredOpenAIError) {
        throw error;
      }
      
      // Wrap other OpenAI errors
      throw new MeteredOpenAIError(
        `OpenAI API error: ${error instanceof Error ? error.message : String(error)}`,
        'OPENAI_API_ERROR'
      );
    } finally {
      this.currentRequests = Math.max(0, this.currentRequests - 1);
    }
  }

  /**
   * Record the start of a new task
   */
  recordTaskStart() {
    this.usageData.daily.tasks += 1;
    this.usageData.total.tasks += 1;
    this.saveUsageData();
  }

  /**
   * Get current usage statistics
   */
  getUsageStats() {
    return {
      daily: {
        ...this.usageData.daily,
        totalTokens: this.usageData.daily.inputTokens + this.usageData.daily.outputTokens,
        remainingBudget: Math.max(0, this.limits.DAILY_SPENDING_CAP_USD - this.usageData.daily.totalCost),
        remainingRequests: Math.max(0, this.limits.DAILY_REQUEST_LIMIT - this.usageData.daily.requests),
        remainingTokens: Math.max(0, this.limits.DAILY_TOKEN_LIMIT - (this.usageData.daily.inputTokens + this.usageData.daily.outputTokens))
      },
      total: {
        ...this.usageData.total,
        totalTokens: this.usageData.total.inputTokens + this.usageData.total.outputTokens
      },
      limits: this.limits,
      currentRequests: this.currentRequests
    };
  }

  /**
   * Check if within all limits without throwing
   */
  isWithinLimits(): { ok: boolean; violations: string[] } {
    const violations = this.checkDailyLimits();
    return { ok: violations.length === 0, violations };
  }

  /**
   * Reset all usage counters (use with caution)
   */
  resetUsage() {
    this.resetUsageData();
    this.saveUsageData();
  }
}

// Export for backward compatibility and ease of use
export default MeteredOpenAI;