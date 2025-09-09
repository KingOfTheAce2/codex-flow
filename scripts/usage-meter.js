#!/usr/bin/env node

/**
 * OpenAI Usage Metering Script for Codex-Flow
 * 
 * This script provides hardcoded limits and real-time usage tracking
 * to prevent unexpected API costs and ensure controlled usage.
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// HARDCODED LIMITS - MODIFY WITH CAUTION
// ============================================================================

const USAGE_LIMITS = {
  // OpenAI Model Configuration
  MODEL: 'gpt-4o-mini',
  
  // Request Limits
  MAX_STEPS_PER_TASK: 50,
  MAX_CONCURRENT_REQUESTS: 3,
  
  // Token Budgets
  MAX_PROMPT_TOKENS: 4000,
  MAX_RESPONSE_TOKENS: 2000,
  MAX_TOTAL_TOKENS_PER_REQUEST: 6000,
  
  // Daily Limits
  DAILY_SPENDING_CAP_USD: 5.00,
  DAILY_REQUEST_LIMIT: 1000,
  DAILY_TOKEN_LIMIT: 500000,
  
  // Rate Limiting
  REQUESTS_PER_MINUTE: 60,
  TOKENS_PER_MINUTE: 40000,
  
  // Cost per token (approximate for gpt-4o-mini)
  COST_PER_INPUT_TOKEN: 0.000003,   // $0.003 per 1K input tokens
  COST_PER_OUTPUT_TOKEN: 0.000012,  // $0.012 per 1K output tokens
};

// ============================================================================
// USAGE TRACKING
// ============================================================================

const USAGE_FILE = path.join(__dirname, '..', '.usage-tracking.json');

class UsageMeter {
  constructor() {
    this.loadUsageData();
    this.currentRequests = 0;
  }

  loadUsageData() {
    try {
      if (fs.existsSync(USAGE_FILE)) {
        const data = JSON.parse(fs.readFileSync(USAGE_FILE, 'utf8'));
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
        }
        
        this.usage = data;
      } else {
        this.resetUsageData();
      }
    } catch (error) {
      console.error('Error loading usage data:', error.message);
      this.resetUsageData();
    }
  }

  resetUsageData() {
    const today = new Date().toISOString().split('T')[0];
    this.usage = {
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
      limits: USAGE_LIMITS,
      startDate: today
    };
  }

  saveUsageData() {
    try {
      fs.writeFileSync(USAGE_FILE, JSON.stringify(this.usage, null, 2));
    } catch (error) {
      console.error('Error saving usage data:', error.message);
    }
  }

  // ============================================================================
  // LIMIT CHECKING
  // ============================================================================

  checkDailyLimits() {
    const violations = [];
    
    if (this.usage.daily.totalCost >= USAGE_LIMITS.DAILY_SPENDING_CAP_USD) {
      violations.push(`Daily spending cap exceeded: $${this.usage.daily.totalCost.toFixed(4)} >= $${USAGE_LIMITS.DAILY_SPENDING_CAP_USD}`);
    }
    
    if (this.usage.daily.requests >= USAGE_LIMITS.DAILY_REQUEST_LIMIT) {
      violations.push(`Daily request limit exceeded: ${this.usage.daily.requests} >= ${USAGE_LIMITS.DAILY_REQUEST_LIMIT}`);
    }
    
    if ((this.usage.daily.inputTokens + this.usage.daily.outputTokens) >= USAGE_LIMITS.DAILY_TOKEN_LIMIT) {
      violations.push(`Daily token limit exceeded: ${this.usage.daily.inputTokens + this.usage.daily.outputTokens} >= ${USAGE_LIMITS.DAILY_TOKEN_LIMIT}`);
    }
    
    return violations;
  }

  checkConcurrencyLimit() {
    return this.currentRequests >= USAGE_LIMITS.MAX_CONCURRENT_REQUESTS;
  }

  checkTokenLimits(promptTokens, maxResponseTokens = USAGE_LIMITS.MAX_RESPONSE_TOKENS) {
    const violations = [];
    
    if (promptTokens > USAGE_LIMITS.MAX_PROMPT_TOKENS) {
      violations.push(`Prompt tokens exceed limit: ${promptTokens} > ${USAGE_LIMITS.MAX_PROMPT_TOKENS}`);
    }
    
    if (maxResponseTokens > USAGE_LIMITS.MAX_RESPONSE_TOKENS) {
      violations.push(`Response tokens exceed limit: ${maxResponseTokens} > ${USAGE_LIMITS.MAX_RESPONSE_TOKENS}`);
    }
    
    if ((promptTokens + maxResponseTokens) > USAGE_LIMITS.MAX_TOTAL_TOKENS_PER_REQUEST) {
      violations.push(`Total tokens exceed limit: ${promptTokens + maxResponseTokens} > ${USAGE_LIMITS.MAX_TOTAL_TOKENS_PER_REQUEST}`);
    }
    
    return violations;
  }

  // ============================================================================
  // USAGE TRACKING
  // ============================================================================

  recordRequest(inputTokens, outputTokens) {
    const inputCost = inputTokens * USAGE_LIMITS.COST_PER_INPUT_TOKEN;
    const outputCost = outputTokens * USAGE_LIMITS.COST_PER_OUTPUT_TOKEN;
    const totalCost = inputCost + outputCost;

    this.usage.daily.requests += 1;
    this.usage.daily.inputTokens += inputTokens;
    this.usage.daily.outputTokens += outputTokens;
    this.usage.daily.totalCost += totalCost;

    this.usage.total.requests += 1;
    this.usage.total.inputTokens += inputTokens;
    this.usage.total.outputTokens += outputTokens;
    this.usage.total.totalCost += totalCost;

    this.saveUsageData();

    return {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      inputCost,
      outputCost,
      totalCost
    };
  }

  recordTaskStart() {
    this.usage.daily.tasks += 1;
    this.usage.total.tasks += 1;
    this.saveUsageData();
  }

  incrementConcurrency() {
    this.currentRequests += 1;
  }

  decrementConcurrency() {
    this.currentRequests = Math.max(0, this.currentRequests - 1);
  }

  // ============================================================================
  // REPORTING
  // ============================================================================

  generateReport() {
    const today = new Date().toISOString().split('T')[0];
    const dailyTokens = this.usage.daily.inputTokens + this.usage.daily.outputTokens;
    const totalTokens = this.usage.total.inputTokens + this.usage.total.outputTokens;

    return {
      reportDate: today,
      limits: USAGE_LIMITS,
      dailyUsage: {
        ...this.usage.daily,
        totalTokens: dailyTokens,
        remainingBudget: Math.max(0, USAGE_LIMITS.DAILY_SPENDING_CAP_USD - this.usage.daily.totalCost),
        remainingRequests: Math.max(0, USAGE_LIMITS.DAILY_REQUEST_LIMIT - this.usage.daily.requests),
        remainingTokens: Math.max(0, USAGE_LIMITS.DAILY_TOKEN_LIMIT - dailyTokens)
      },
      totalUsage: {
        ...this.usage.total,
        totalTokens: totalTokens
      },
      currentStatus: {
        concurrentRequests: this.currentRequests,
        maxConcurrency: USAGE_LIMITS.MAX_CONCURRENT_REQUESTS,
        withinLimits: this.checkDailyLimits().length === 0
      }
    };
  }

  printReport() {
    const report = this.generateReport();
    
    console.log('\n🔍 CODEX-FLOW USAGE METER REPORT');
    console.log('='.repeat(50));
    console.log(`📅 Date: ${report.reportDate}`);
    console.log(`🤖 Model: ${USAGE_LIMITS.MODEL}`);
    
    console.log('\n📊 DAILY USAGE:');
    console.log(`  Requests: ${report.dailyUsage.requests}/${USAGE_LIMITS.DAILY_REQUEST_LIMIT} (${report.dailyUsage.remainingRequests} remaining)`);
    console.log(`  Tokens: ${report.dailyUsage.totalTokens.toLocaleString()}/${USAGE_LIMITS.DAILY_TOKEN_LIMIT.toLocaleString()} (${report.dailyUsage.remainingTokens.toLocaleString()} remaining)`);
    console.log(`  Cost: $${report.dailyUsage.totalCost.toFixed(4)}/$${USAGE_LIMITS.DAILY_SPENDING_CAP_USD.toFixed(2)} ($${report.dailyUsage.remainingBudget.toFixed(4)} remaining)`);
    console.log(`  Tasks: ${report.dailyUsage.tasks}`);
    
    console.log('\n📈 TOTAL USAGE (Since Start):');
    console.log(`  Requests: ${report.totalUsage.requests.toLocaleString()}`);
    console.log(`  Tokens: ${report.totalUsage.totalTokens.toLocaleString()}`);
    console.log(`  Cost: $${report.totalUsage.totalCost.toFixed(4)}`);
    console.log(`  Tasks: ${report.totalUsage.tasks}`);
    
    console.log('\n⚙️  CURRENT LIMITS:');
    console.log(`  Max Steps per Task: ${USAGE_LIMITS.MAX_STEPS_PER_TASK}`);
    console.log(`  Max Concurrent Requests: ${USAGE_LIMITS.MAX_CONCURRENT_REQUESTS} (${report.currentStatus.concurrentRequests} active)`);
    console.log(`  Max Prompt Tokens: ${USAGE_LIMITS.MAX_PROMPT_TOKENS.toLocaleString()}`);
    console.log(`  Max Response Tokens: ${USAGE_LIMITS.MAX_RESPONSE_TOKENS.toLocaleString()}`);
    
    console.log('\n🚦 STATUS:');
    const violations = this.checkDailyLimits();
    if (violations.length === 0) {
      console.log('  ✅ All limits OK');
    } else {
      console.log('  ❌ LIMIT VIOLATIONS:');
      violations.forEach(violation => console.log(`     - ${violation}`));
    }
    
    console.log('\n💡 COST BREAKDOWN:');
    console.log(`  Input tokens: ${report.dailyUsage.inputTokens.toLocaleString()} × $${USAGE_LIMITS.COST_PER_INPUT_TOKEN} = $${(report.dailyUsage.inputTokens * USAGE_LIMITS.COST_PER_INPUT_TOKEN).toFixed(4)}`);
    console.log(`  Output tokens: ${report.dailyUsage.outputTokens.toLocaleString()} × $${USAGE_LIMITS.COST_PER_OUTPUT_TOKEN} = $${(report.dailyUsage.outputTokens * USAGE_LIMITS.COST_PER_OUTPUT_TOKEN).toFixed(4)}`);
    
    console.log('='.repeat(50));
  }
}

// ============================================================================
// CLI INTERFACE
// ============================================================================

function main() {
  const meter = new UsageMeter();
  const command = process.argv[2];

  switch (command) {
    case 'report':
    case undefined:
      meter.printReport();
      break;
      
    case 'reset':
      meter.resetUsageData();
      meter.saveUsageData();
      console.log('✅ Usage data reset successfully');
      break;
      
    case 'limits':
      console.log('\n⚙️  HARDCODED LIMITS:');
      console.log(JSON.stringify(USAGE_LIMITS, null, 2));
      break;
      
    case 'check':
      const violations = meter.checkDailyLimits();
      if (violations.length === 0) {
        console.log('✅ All limits OK');
        process.exit(0);
      } else {
        console.log('❌ LIMIT VIOLATIONS:');
        violations.forEach(violation => console.log(`  - ${violation}`));
        process.exit(1);
      }
      break;
      
    case 'help':
      console.log(`
🔍 Codex-Flow Usage Meter

Usage: node scripts/usage-meter.js [command]

Commands:
  report (default)  Show detailed usage report
  reset            Reset all usage counters
  limits           Show hardcoded limits
  check            Check if within limits (exit 0=OK, 1=violations)
  help             Show this help message

Examples:
  npm run meter:usage
  node scripts/usage-meter.js report
  node scripts/usage-meter.js check && echo "Good to proceed"
      `);
      break;
      
    default:
      console.error(`❌ Unknown command: ${command}`);
      console.error('Run "node scripts/usage-meter.js help" for usage information');
      process.exit(1);
  }
}

// Export for use in other modules
module.exports = { UsageMeter, USAGE_LIMITS };

// Run CLI if called directly
if (require.main === module) {
  main();
}