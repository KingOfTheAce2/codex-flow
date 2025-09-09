/**
 * OpenAI Usage Limits Configuration
 * 
 * Hardcoded limits to prevent unexpected API costs and ensure controlled usage.
 * These values are intentionally restrictive and should be modified with caution.
 */

export interface UsageLimits {
  // OpenAI Model Configuration
  MODEL: string;
  
  // Request Limits
  MAX_STEPS_PER_TASK: number;
  MAX_CONCURRENT_REQUESTS: number;
  
  // Token Budgets
  MAX_PROMPT_TOKENS: number;
  MAX_RESPONSE_TOKENS: number;
  MAX_TOTAL_TOKENS_PER_REQUEST: number;
  
  // Daily Limits
  DAILY_SPENDING_CAP_USD: number;
  DAILY_REQUEST_LIMIT: number;
  DAILY_TOKEN_LIMIT: number;
  
  // Rate Limiting
  REQUESTS_PER_MINUTE: number;
  TOKENS_PER_MINUTE: number;
  
  // Cost per token (approximate for gpt-4o-mini)
  COST_PER_INPUT_TOKEN: number;
  COST_PER_OUTPUT_TOKEN: number;
}

export const DEFAULT_USAGE_LIMITS: UsageLimits = {
  // OpenAI Model Configuration - Using cost-optimized model
  MODEL: 'gpt-4o-mini',
  
  // Request Limits - Conservative to prevent runaway costs
  MAX_STEPS_PER_TASK: 50,
  MAX_CONCURRENT_REQUESTS: 3,
  
  // Token Budgets - Reasonable limits for most tasks
  MAX_PROMPT_TOKENS: 4000,
  MAX_RESPONSE_TOKENS: 2000,
  MAX_TOTAL_TOKENS_PER_REQUEST: 6000,
  
  // Daily Limits - $5 daily budget is reasonable for development
  DAILY_SPENDING_CAP_USD: 5.00,
  DAILY_REQUEST_LIMIT: 1000,
  DAILY_TOKEN_LIMIT: 500000,
  
  // Rate Limiting - Based on OpenAI tier limits
  REQUESTS_PER_MINUTE: 60,
  TOKENS_PER_MINUTE: 40000,
  
  // Cost per token for gpt-4o-mini (as of 2024)
  // Input: $0.003 per 1K tokens = $0.000003 per token
  // Output: $0.012 per 1K tokens = $0.000012 per token
  COST_PER_INPUT_TOKEN: 0.000003,
  COST_PER_OUTPUT_TOKEN: 0.000012,
};

/**
 * Environment-based configuration override
 * Allows customization via environment variables while keeping defaults safe
 */
export function getUsageLimits(): UsageLimits {
  return {
    MODEL: process.env.CODEX_FLOW_MODEL || DEFAULT_USAGE_LIMITS.MODEL,
    
    MAX_STEPS_PER_TASK: parseInt(process.env.CODEX_FLOW_MAX_STEPS || '') || DEFAULT_USAGE_LIMITS.MAX_STEPS_PER_TASK,
    MAX_CONCURRENT_REQUESTS: parseInt(process.env.CODEX_FLOW_MAX_CONCURRENT || '') || DEFAULT_USAGE_LIMITS.MAX_CONCURRENT_REQUESTS,
    
    MAX_PROMPT_TOKENS: parseInt(process.env.CODEX_FLOW_MAX_PROMPT_TOKENS || '') || DEFAULT_USAGE_LIMITS.MAX_PROMPT_TOKENS,
    MAX_RESPONSE_TOKENS: parseInt(process.env.CODEX_FLOW_MAX_RESPONSE_TOKENS || '') || DEFAULT_USAGE_LIMITS.MAX_RESPONSE_TOKENS,
    MAX_TOTAL_TOKENS_PER_REQUEST: parseInt(process.env.CODEX_FLOW_MAX_TOTAL_TOKENS || '') || DEFAULT_USAGE_LIMITS.MAX_TOTAL_TOKENS_PER_REQUEST,
    
    DAILY_SPENDING_CAP_USD: parseFloat(process.env.CODEX_FLOW_DAILY_CAP || '') || DEFAULT_USAGE_LIMITS.DAILY_SPENDING_CAP_USD,
    DAILY_REQUEST_LIMIT: parseInt(process.env.CODEX_FLOW_DAILY_REQUESTS || '') || DEFAULT_USAGE_LIMITS.DAILY_REQUEST_LIMIT,
    DAILY_TOKEN_LIMIT: parseInt(process.env.CODEX_FLOW_DAILY_TOKENS || '') || DEFAULT_USAGE_LIMITS.DAILY_TOKEN_LIMIT,
    
    REQUESTS_PER_MINUTE: parseInt(process.env.CODEX_FLOW_RPM || '') || DEFAULT_USAGE_LIMITS.REQUESTS_PER_MINUTE,
    TOKENS_PER_MINUTE: parseInt(process.env.CODEX_FLOW_TPM || '') || DEFAULT_USAGE_LIMITS.TOKENS_PER_MINUTE,
    
    COST_PER_INPUT_TOKEN: parseFloat(process.env.CODEX_FLOW_INPUT_COST || '') || DEFAULT_USAGE_LIMITS.COST_PER_INPUT_TOKEN,
    COST_PER_OUTPUT_TOKEN: parseFloat(process.env.CODEX_FLOW_OUTPUT_COST || '') || DEFAULT_USAGE_LIMITS.COST_PER_OUTPUT_TOKEN,
  };
}

/**
 * Validation functions to ensure limits are reasonable
 */
export function validateUsageLimits(limits: UsageLimits): string[] {
  const warnings: string[] = [];
  
  // Check for potentially dangerous values
  if (limits.DAILY_SPENDING_CAP_USD > 50) {
    warnings.push(`Daily spending cap of $${limits.DAILY_SPENDING_CAP_USD} is quite high. Consider reducing to prevent unexpected costs.`);
  }
  
  if (limits.MAX_CONCURRENT_REQUESTS > 10) {
    warnings.push(`Max concurrent requests of ${limits.MAX_CONCURRENT_REQUESTS} may exceed rate limits.`);
  }
  
  if (limits.MAX_PROMPT_TOKENS > 10000) {
    warnings.push(`Max prompt tokens of ${limits.MAX_PROMPT_TOKENS} is very high and may be expensive.`);
  }
  
  if (limits.MAX_RESPONSE_TOKENS > 4000) {
    warnings.push(`Max response tokens of ${limits.MAX_RESPONSE_TOKENS} is high and may impact costs.`);
  }
  
  // Check for unreasonably low values
  if (limits.DAILY_SPENDING_CAP_USD < 0.10) {
    warnings.push(`Daily spending cap of $${limits.DAILY_SPENDING_CAP_USD} may be too low for practical use.`);
  }
  
  if (limits.MAX_PROMPT_TOKENS < 100) {
    warnings.push(`Max prompt tokens of ${limits.MAX_PROMPT_TOKENS} may be too low for complex tasks.`);
  }
  
  return warnings;
}