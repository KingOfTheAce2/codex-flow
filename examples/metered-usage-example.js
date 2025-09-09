#!/usr/bin/env node

/**
 * Example: Using Metered OpenAI Provider
 * 
 * This example demonstrates how to use the MeteredOpenAI provider
 * with built-in usage tracking and cost controls.
 * 
 * Run with: node examples/metered-usage-example.js
 */

const path = require('path');

// Add src to require path for this example
require('ts-node').register({
  project: path.join(__dirname, '..', 'tsconfig.json')
});

const { MeteredOpenAI } = require('../src/providers/metered-openai.ts');

async function runExample() {
  console.log('🤖 Metered OpenAI Provider Example');
  console.log('='.repeat(50));

  try {
    // Initialize the metered provider
    const meteredOpenAI = new MeteredOpenAI();
    console.log('✅ MeteredOpenAI initialized successfully');

    // Check initial usage stats
    const initialStats = meteredOpenAI.getUsageStats();
    console.log('\n📊 Initial Usage Stats:');
    console.log(`  Daily requests: ${initialStats.daily.requests}`);
    console.log(`  Daily budget remaining: $${initialStats.daily.remainingBudget.toFixed(4)}`);
    console.log(`  Daily tokens remaining: ${initialStats.daily.remainingTokens.toLocaleString()}`);

    // Check if within limits
    const limitsCheck = meteredOpenAI.isWithinLimits();
    if (!limitsCheck.ok) {
      console.log('\n❌ Currently exceeding limits:');
      limitsCheck.violations.forEach(v => console.log(`  - ${v}`));
      return;
    }

    console.log('\n✅ All limits OK, proceeding with API call...');

    // Record task start
    meteredOpenAI.recordTaskStart();
    
    // Make a simple API call with usage tracking
    const messages = [
      {
        role: 'system',
        content: 'You are a helpful assistant. Respond concisely.'
      },
      {
        role: 'user', 
        content: 'Explain what a REST API is in one sentence.'
      }
    ];

    console.log('\n🔄 Making metered API request...');
    const { completion, usage } = await meteredOpenAI.createChatCompletion(messages, {
      max_tokens: 100,  // Will be capped at the configured limit
      temperature: 0.7
    });

    console.log('\n📝 Response:');
    console.log(`  "${completion.choices[0].message.content}"`);

    console.log('\n💰 Usage Information:');
    console.log(`  Input tokens: ${usage.inputTokens}`);
    console.log(`  Output tokens: ${usage.outputTokens}`);
    console.log(`  Total tokens: ${usage.totalTokens}`);
    console.log(`  Input cost: $${usage.inputCost.toFixed(6)}`);
    console.log(`  Output cost: $${usage.outputCost.toFixed(6)}`);
    console.log(`  Total cost: $${usage.totalCost.toFixed(6)}`);
    console.log(`  Model used: ${usage.model}`);

    // Check updated usage stats
    const updatedStats = meteredOpenAI.getUsageStats();
    console.log('\n📊 Updated Usage Stats:');
    console.log(`  Daily requests: ${updatedStats.daily.requests}`);
    console.log(`  Daily cost: $${updatedStats.daily.totalCost.toFixed(6)}`);
    console.log(`  Daily tokens used: ${updatedStats.daily.totalTokens.toLocaleString()}`);
    console.log(`  Daily budget remaining: $${updatedStats.daily.remainingBudget.toFixed(4)}`);
    console.log(`  Tasks completed today: ${updatedStats.daily.tasks}`);

  } catch (error) {
    if (error.name === 'MeteredOpenAIError') {
      console.error(`\n❌ Metered OpenAI Error [${error.code}]:`, error.message);
      
      if (error.code === 'MISSING_API_KEY') {
        console.log('\n💡 To fix this:');
        console.log('  1. Get an API key from https://platform.openai.com/api-keys');
        console.log('  2. Set it as an environment variable: export OPENAI_API_KEY=sk-...');
        console.log('  3. Or create a .env file in the project root with: OPENAI_API_KEY=sk-...');
      }
      
      if (error.code === 'DAILY_LIMIT_EXCEEDED') {
        console.log('\n💡 Daily limits exceeded. You can:');
        console.log('  1. Wait until tomorrow for limits to reset');
        console.log('  2. Run: npm run meter:reset (to reset counters)');
        console.log('  3. Increase limits in src/config/usage-limits.ts (use caution)');
      }
    } else {
      console.error('\n❌ Unexpected error:', error.message);
    }
    process.exit(1);
  }

  console.log('\n🎉 Example completed successfully!');
  console.log('\n💡 Next steps:');
  console.log('  - Check detailed usage: npm run meter:usage');
  console.log('  - View limits: npm run meter:limits');
  console.log('  - Reset counters: npm run meter:reset');
  console.log('='.repeat(50));
}

// Run the example
runExample().catch(console.error);