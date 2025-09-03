# Basic Swarm Example

This example demonstrates how to create and use a basic swarm with Codex-Flow for simple multi-agent coordination.

## Overview

In this example, we'll:
1. Initialize Codex-Flow with basic configuration
2. Create a simple hierarchical swarm with three agents
3. Execute a basic development task
4. Monitor the swarm's progress and results

## Code Example

### Basic Setup

```typescript
import { CodexFlow } from 'codex-flow';

async function basicSwarmExample() {
  // Initialize Codex-Flow
  const codexFlow = new CodexFlow({
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4',
    config: {
      logging: { level: 'info', console: true },
      memory: { enabled: true }
    }
  });

  await codexFlow.initialize();
  console.log('✅ Codex-Flow initialized');

  // Create a basic swarm
  const swarm = await codexFlow.createSwarm({
    topology: 'hierarchical',
    agents: [
      {
        type: 'coder',
        name: 'main-developer',
        capabilities: ['javascript', 'typescript', 'node.js']
      },
      {
        type: 'tester',
        name: 'qa-engineer',
        capabilities: ['jest', 'unit-testing', 'integration-testing']
      },
      {
        type: 'reviewer',
        name: 'code-reviewer',
        capabilities: ['code-review', 'best-practices', 'security']
      }
    ],
    coordination: {
      memorySharing: true,
      eventBroadcast: true,
      timeout: 300 // 5 minutes
    }
  });

  console.log(`✅ Swarm created with ID: ${swarm.id}`);
  console.log(`📊 Topology: ${swarm.topology}`);
  console.log(`👥 Agents: ${swarm.agents.length}`);

  return swarm;
}
```

### Execute Simple Task

```typescript
async function executeSimpleTask(codexFlow: CodexFlow, swarmId: string) {
  const taskResult = await codexFlow.executeTask({
    description: "Create a simple Express.js Hello World API",
    requirements: [
      "Set up Express.js server",
      "Create GET /hello endpoint that returns JSON",
      "Add basic error handling middleware",
      "Include unit tests for the endpoint",
      "Ensure code follows best practices"
    ],
    swarm: swarmId,
    parallel: false, // Sequential execution for this simple example
    timeout: 600000, // 10 minutes
    trackProgress: true
  });

  return taskResult;
}
```

### Monitor Progress

```typescript
async function monitorSwarm(codexFlow: CodexFlow, swarmId: string) {
  // Listen for swarm events
  codexFlow.on('swarm:task:progress', (data) => {
    console.log(`📈 Progress: ${data.progress}% - ${data.currentStep}`);
  });

  codexFlow.on('agent:task:started', (data) => {
    console.log(`🚀 Agent ${data.agentName} started: ${data.taskDescription}`);
  });

  codexFlow.on('agent:task:completed', (data) => {
    console.log(`✅ Agent ${data.agentName} completed: ${data.result.summary}`);
  });

  codexFlow.on('swarm:task:completed', (data) => {
    console.log('🎉 Swarm task completed!');
    console.log(`📊 Total time: ${data.duration}ms`);
    console.log(`🔧 Files created: ${data.result.files.length}`);
  });
}
```

### Complete Example

```typescript
import { CodexFlow } from 'codex-flow';

async function main() {
  try {
    // 1. Initialize system
    const codexFlow = new CodexFlow({
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4',
      config: {
        logging: { level: 'info', console: true },
        memory: { enabled: true },
        agents: { maxConcurrent: 3, defaultTimeout: 300 }
      }
    });

    await codexFlow.initialize();
    console.log('🚀 Starting basic swarm example...');

    // 2. Create swarm
    const swarm = await codexFlow.createSwarm({
      topology: 'hierarchical',
      agents: [
        { type: 'coder', name: 'developer' },
        { type: 'tester', name: 'tester' },
        { type: 'reviewer', name: 'reviewer' }
      ]
    });

    // 3. Set up monitoring
    setupEventListeners(codexFlow);

    // 4. Execute task
    console.log('📋 Executing task...');
    const result = await codexFlow.executeTask({
      description: "Create a Hello World Express.js API with tests",
      requirements: [
        "Express.js server setup",
        "GET /hello endpoint returning { message: 'Hello World!' }",
        "Error handling middleware", 
        "Jest unit tests with 100% coverage",
        "Code review and optimization"
      ],
      swarm: swarm.id,
      trackProgress: true
    });

    // 5. Display results
    console.log('\n🎉 Task completed successfully!');
    console.log('📁 Generated files:');
    result.files.forEach(file => {
      console.log(`  - ${file.path} (${file.size} bytes)`);
    });

    console.log('\n📊 Task summary:');
    console.log(`  Duration: ${result.duration}ms`);
    console.log(`  Files created: ${result.files.length}`);
    console.log(`  Tests passed: ${result.metrics.testsPassed}/${result.metrics.totalTests}`);
    console.log(`  Coverage: ${result.metrics.coverage}%`);

    // 6. Access memory to see what was learned
    const memory = codexFlow.getMemory();
    const learnings = await memory.query({ tags: ['learning', 'patterns'] });
    
    console.log('\n🧠 Key learnings stored in memory:');
    learnings.slice(0, 3).forEach(entry => {
      console.log(`  - ${entry.key}: ${entry.value.summary}`);
    });

  } catch (error) {
    console.error('❌ Error in basic swarm example:', error);
    process.exit(1);
  }
}

function setupEventListeners(codexFlow: CodexFlow) {
  codexFlow.on('swarm:created', (data) => {
    console.log(`✅ Swarm "${data.name}" created with ${data.agentCount} agents`);
  });

  codexFlow.on('agent:task:started', (data) => {
    console.log(`🤖 ${data.agentName} starting: ${data.taskSummary}`);
  });

  codexFlow.on('agent:task:completed', (data) => {
    const duration = (data.endTime - data.startTime) / 1000;
    console.log(`✅ ${data.agentName} completed in ${duration.toFixed(1)}s`);
  });

  codexFlow.on('swarm:task:progress', (data) => {
    const progressBar = '█'.repeat(Math.floor(data.progress / 5)) + 
                       '░'.repeat(20 - Math.floor(data.progress / 5));
    console.log(`📈 [${progressBar}] ${data.progress}% - ${data.currentStep}`);
  });

  codexFlow.on('error', (error) => {
    console.error('🚨 Swarm error:', error.message);
  });
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
}
```

## Expected Output

When you run this example, you should see output similar to:

```
🚀 Starting basic swarm example...
✅ Codex-Flow initialized
✅ Swarm "development-team" created with 3 agents
📋 Executing task...

🤖 developer starting: Create Express.js server setup
📈 [██░░░░░░░░░░░░░░░░░░] 10% - Setting up project structure
✅ developer completed in 45.2s

🤖 tester starting: Create Jest unit tests
📈 [████████░░░░░░░░░░░░] 40% - Writing unit tests
✅ tester completed in 23.8s

🤖 reviewer starting: Code review and optimization
📈 [███████████████░░░░░] 75% - Reviewing code quality
✅ reviewer completed in 15.3s

📈 [████████████████████] 100% - Task completed

🎉 Task completed successfully!
📁 Generated files:
  - server.js (1247 bytes)
  - package.json (542 bytes)
  - server.test.js (891 bytes)
  - README.md (324 bytes)

📊 Task summary:
  Duration: 84576ms
  Files created: 4
  Tests passed: 5/5
  Coverage: 100%

🧠 Key learnings stored in memory:
  - express-setup: Basic Express.js server configuration patterns
  - jest-testing: Unit testing patterns for REST APIs
  - error-handling: Best practices for Express error middleware
```

## Generated Files

The swarm will create several files. Here's what to expect:

### `server.js`
```javascript
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Routes
app.get('/hello', (req, res) => {
  res.json({ message: 'Hello World!' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, server };
```

### `server.test.js`
```javascript
const request = require('supertest');
const { app, server } = require('./server');

describe('Express Server', () => {
  afterAll(() => {
    server.close();
  });

  describe('GET /hello', () => {
    it('should return hello world message', async () => {
      const response = await request(app)
        .get('/hello')
        .expect(200);

      expect(response.body).toEqual({
        message: 'Hello World!'
      });
    });
  });

  describe('404 handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/unknown')
        .expect(404);

      expect(response.body).toEqual({
        error: 'Route not found'
      });
    });
  });

  describe('Error handling', () => {
    it('should handle server errors gracefully', async () => {
      // This test would need a route that throws an error
      // Implementation depends on specific error scenarios
    });
  });
});
```

## Key Learning Points

1. **Swarm Initialization**: Simple setup with hierarchical topology
2. **Agent Coordination**: Agents work sequentially with shared memory
3. **Task Execution**: Clear requirements lead to better results
4. **Event Monitoring**: Real-time progress tracking and logging
5. **Result Analysis**: Comprehensive metrics and file generation
6. **Memory Usage**: Persistent learning across swarm operations

## Next Steps

Try these variations:
- Change topology to `mesh` for parallel agent communication
- Add more agents with different specializations
- Increase task complexity with database integration
- Experiment with different coordination modes
- Add custom tools for specific functionality

## Troubleshooting

### Common Issues

1. **Agent Timeout**: Increase timeout in swarm configuration
2. **API Rate Limits**: Add delays or use different providers
3. **Memory Issues**: Enable cleanup in memory configuration
4. **File Conflicts**: Ensure unique output directories

### Debug Mode

Enable detailed logging:
```typescript
const codexFlow = new CodexFlow({
  // ... other config
  config: {
    logging: { level: 'debug', console: true },
    agents: { debug: true }
  }
});
```

This basic example provides a solid foundation for understanding Codex-Flow's swarm capabilities. Experiment with different configurations to see how they affect the coordination and results!