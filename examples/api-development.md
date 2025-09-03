# Full-Stack API Development Example

This example demonstrates using Codex-Flow to build a complete REST API with authentication, database integration, testing, and documentation.

## Overview

We'll build a **Task Management API** with:
- User authentication (JWT)
- CRUD operations for tasks
- Database integration (MongoDB)
- Comprehensive testing suite
- API documentation
- Security best practices
- Performance optimization

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Task Management API                       │
├─────────────────────────────────────────────────────────────┤
│  Authentication  │    Task CRUD    │    User Management     │
├─────────────────────────────────────────────────────────────┤
│           Express.js Server + Middleware                    │
├─────────────────────────────────────────────────────────────┤
│      MongoDB Database + Mongoose ODM                        │
├─────────────────────────────────────────────────────────────┤
│  Testing Suite  │  Documentation  │  Security & Validation │
└─────────────────────────────────────────────────────────────┘
```

## Implementation

### Main Orchestration

```typescript
import { CodexFlow } from 'codex-flow';

async function buildTaskManagementAPI() {
  const codexFlow = new CodexFlow({
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4',
    config: {
      memory: { enabled: true },
      logging: { level: 'info' },
      agents: { maxConcurrent: 6 }
    }
  });

  await codexFlow.initialize();

  // Create specialized development swarm
  const swarm = await codexFlow.createSwarm({
    name: 'api-development-team',
    topology: 'mesh', // Allow direct agent communication
    agents: [
      {
        type: 'backend-dev',
        name: 'api-architect',
        specialization: 'api-design',
        capabilities: ['express', 'nodejs', 'rest-api', 'middleware']
      },
      {
        type: 'database-expert',
        name: 'data-architect', 
        specialization: 'database-design',
        capabilities: ['mongodb', 'mongoose', 'schema-design', 'indexing']
      },
      {
        type: 'security-specialist',
        name: 'security-expert',
        specialization: 'api-security',
        capabilities: ['jwt', 'authentication', 'validation', 'sanitization']
      },
      {
        type: 'tester',
        name: 'qa-engineer',
        specialization: 'api-testing',
        capabilities: ['jest', 'supertest', 'integration-testing', 'load-testing']
      },
      {
        type: 'coder',
        name: 'implementation-dev',
        specialization: 'implementation',
        capabilities: ['javascript', 'async-await', 'error-handling']
      },
      {
        type: 'reviewer',
        name: 'code-reviewer',
        specialization: 'quality-assurance',
        capabilities: ['code-review', 'performance', 'best-practices']
      }
    ],
    coordination: {
      memorySharing: true,
      eventBroadcast: true,
      knowledgeTransfer: true
    }
  });

  // Set up comprehensive monitoring
  setupAPIDevMonitoring(codexFlow);

  return { codexFlow, swarm };
}
```

### Task Execution

```typescript
async function executeAPITask(codexFlow: CodexFlow, swarmId: string) {
  const result = await codexFlow.executeTask({
    description: "Build a complete Task Management REST API",
    requirements: [
      // Database & Models
      "Design MongoDB schema for users and tasks",
      "Implement Mongoose models with validation",
      "Create database indexes for performance",
      
      // Authentication System
      "JWT-based authentication system",
      "User registration with email validation",
      "Secure login with password hashing",
      "Protected route middleware",
      
      // API Endpoints
      "POST /auth/register - User registration",
      "POST /auth/login - User login",
      "GET /auth/me - Get current user profile",
      
      "GET /tasks - List user's tasks with filtering/pagination",
      "POST /tasks - Create new task",
      "GET /tasks/:id - Get specific task",
      "PUT /tasks/:id - Update task",
      "DELETE /tasks/:id - Delete task",
      
      // Validation & Security
      "Input validation with Joi",
      "Rate limiting middleware",
      "CORS configuration",
      "Security headers (helmet)",
      "SQL injection prevention",
      
      // Testing
      "Unit tests for all models",
      "Integration tests for all endpoints",
      "Authentication flow testing",
      "Error handling tests",
      "Load testing scenarios",
      
      // Documentation
      "OpenAPI/Swagger documentation",
      "Postman collection",
      "README with setup instructions",
      
      // Deployment Preparation
      "Environment configuration",
      "Docker containerization",
      "Health check endpoints",
      "Logging configuration"
    ],
    constraints: [
      "Follow RESTful principles",
      "Use async/await throughout",
      "Implement proper error handling",
      "Ensure 90%+ test coverage",
      "Follow security best practices",
      "Optimize for performance"
    ],
    swarm: swarmId,
    parallel: true,
    timeout: 1800000, // 30 minutes
    trackProgress: true,
    quality: {
      codeReview: true,
      securityAudit: true,
      performanceTesting: true
    }
  });

  return result;
}
```

### Monitoring Setup

```typescript
function setupAPIDevMonitoring(codexFlow: CodexFlow) {
  // Phase tracking
  let currentPhase = '';
  const phases = [
    'Architecture Design',
    'Database Schema',
    'Authentication System', 
    'API Endpoints',
    'Security Implementation',
    'Testing Suite',
    'Documentation',
    'Code Review',
    'Final Integration'
  ];

  codexFlow.on('swarm:phase:changed', (data) => {
    currentPhase = data.phase;
    console.log(`\n🔄 Phase: ${currentPhase}`);
    console.log(`📊 Progress: ${data.overallProgress}%`);
  });

  // Agent-specific tracking
  codexFlow.on('agent:task:started', (data) => {
    const emoji = getAgentEmoji(data.agentType);
    console.log(`${emoji} ${data.agentName}: ${data.taskSummary}`);
  });

  codexFlow.on('agent:collaboration', (data) => {
    console.log(`🤝 Collaboration: ${data.fromAgent} → ${data.toAgent}`);
    console.log(`   Context: ${data.context}`);
  });

  // Quality gates
  codexFlow.on('quality:gate:passed', (data) => {
    console.log(`✅ Quality Gate: ${data.gate} - ${data.score}/100`);
  });

  codexFlow.on('quality:gate:failed', (data) => {
    console.log(`❌ Quality Gate Failed: ${data.gate}`);
    console.log(`   Issues: ${data.issues.join(', ')}`);
  });

  // Security events
  codexFlow.on('security:audit:completed', (data) => {
    console.log(`🔒 Security Audit: ${data.vulnerabilities} issues found`);
    if (data.critical > 0) {
      console.log(`🚨 Critical vulnerabilities: ${data.critical}`);
    }
  });
}

function getAgentEmoji(agentType: string): string {
  const emojis = {
    'backend-dev': '🏗️',
    'database-expert': '🗄️', 
    'security-specialist': '🔒',
    'tester': '🧪',
    'coder': '👨‍💻',
    'reviewer': '👀'
  };
  return emojis[agentType] || '🤖';
}
```

### Complete Example

```typescript
import { CodexFlow } from 'codex-flow';
import path from 'path';

async function main() {
  try {
    console.log('🚀 Starting Task Management API Development');
    console.log('================================================');

    // 1. Initialize development environment
    const { codexFlow, swarm } = await buildTaskManagementAPI();
    
    console.log(`✅ Development swarm ready: ${swarm.agents.length} agents`);
    console.log(`🏗️ Architecture: ${swarm.topology} topology`);

    // 2. Execute the full API development task
    console.log('\n📋 Starting API development process...');
    const startTime = Date.now();
    
    const result = await executeAPITask(codexFlow, swarm.id);
    
    const duration = Date.now() - startTime;
    console.log(`\n🎉 API Development completed in ${duration / 1000}s`);

    // 3. Analyze results
    await analyzeResults(result);

    // 4. Generate deployment package
    await createDeploymentPackage(result, './task-management-api');

    // 5. Display final summary
    displayFinalSummary(result, duration);

  } catch (error) {
    console.error('❌ API Development failed:', error);
    process.exit(1);
  }
}

async function analyzeResults(result: any) {
  console.log('\n📊 Development Analysis');
  console.log('========================');

  // File analysis
  console.log(`📁 Generated ${result.files.length} files:`);
  const filesByType = groupFilesByType(result.files);
  
  Object.entries(filesByType).forEach(([type, files]) => {
    console.log(`  ${type}: ${files.length} files`);
  });

  // Quality metrics
  console.log('\n🎯 Quality Metrics:');
  console.log(`  Test Coverage: ${result.metrics.testCoverage}%`);
  console.log(`  Security Score: ${result.metrics.securityScore}/100`);
  console.log(`  Performance Score: ${result.metrics.performanceScore}/100`);
  console.log(`  Code Quality: ${result.metrics.codeQuality}/100`);

  // Testing results
  console.log('\n🧪 Testing Results:');
  console.log(`  Unit Tests: ${result.testing.unitTests.passed}/${result.testing.unitTests.total}`);
  console.log(`  Integration Tests: ${result.testing.integrationTests.passed}/${result.testing.integrationTests.total}`);
  console.log(`  Load Tests: ${result.testing.loadTests.passed ? '✅ Passed' : '❌ Failed'}`);

  // Security audit
  if (result.security.vulnerabilities.length > 0) {
    console.log('\n🔒 Security Issues Found:');
    result.security.vulnerabilities.forEach((vuln, index) => {
      console.log(`  ${index + 1}. ${vuln.severity.toUpperCase()}: ${vuln.description}`);
    });
  } else {
    console.log('\n🔒 Security: ✅ No vulnerabilities found');
  }
}

function groupFilesByType(files: any[]) {
  return files.reduce((groups, file) => {
    const ext = path.extname(file.path);
    let type = 'Other';
    
    if (['.js', '.ts'].includes(ext)) type = 'Source Code';
    else if (['.test.js', '.spec.js'].includes(ext)) type = 'Tests';
    else if (['.json', '.env', '.yml'].includes(ext)) type = 'Configuration';
    else if (['.md', '.txt'].includes(ext)) type = 'Documentation';
    else if (ext === '.dockerfile' || file.path.includes('docker')) type = 'Docker';

    groups[type] = groups[type] || [];
    groups[type].push(file);
    return groups;
  }, {});
}

async function createDeploymentPackage(result: any, outputDir: string) {
  console.log(`\n📦 Creating deployment package at ${outputDir}`);
  
  // This would create the actual file structure
  // In a real implementation, you'd write the files to disk
  
  console.log('📁 Package structure:');
  console.log(`  ${outputDir}/`);
  console.log('  ├── src/');
  console.log('  │   ├── models/');
  console.log('  │   ├── routes/');
  console.log('  │   ├── middleware/');
  console.log('  │   ├── controllers/');
  console.log('  │   └── utils/');
  console.log('  ├── tests/');
  console.log('  ├── docs/');
  console.log('  ├── docker/');
  console.log('  ├── package.json');
  console.log('  ├── docker-compose.yml');
  console.log('  └── README.md');
}

function displayFinalSummary(result: any, duration: number) {
  console.log('\n🎊 Development Summary');
  console.log('=====================');
  console.log(`⏱️  Total Time: ${(duration / 1000 / 60).toFixed(1)} minutes`);
  console.log(`📁 Files Created: ${result.files.length}`);
  console.log(`🧪 Tests Written: ${result.metrics.totalTests}`);
  console.log(`🔒 Security: ${result.security.vulnerabilities.length === 0 ? 'Secure' : 'Issues found'}`);
  console.log(`📈 Overall Quality: ${result.metrics.overallScore}/100`);

  console.log('\n🚀 Ready for deployment!');
  console.log('Next steps:');
  console.log('  1. Review the generated code');
  console.log('  2. Set up your MongoDB database');
  console.log('  3. Configure environment variables');
  console.log('  4. Run npm install && npm test');
  console.log('  5. Deploy using docker-compose up');
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
}
```

## Expected Generated Files

### Project Structure
```
task-management-api/
├── src/
│   ├── app.js                 # Express app setup
│   ├── server.js              # Server startup
│   ├── config/
│   │   ├── database.js        # MongoDB connection
│   │   └── auth.js            # JWT configuration
│   ├── models/
│   │   ├── User.js            # User model
│   │   └── Task.js            # Task model
│   ├── routes/
│   │   ├── auth.js            # Authentication routes
│   │   └── tasks.js           # Task CRUD routes
│   ├── middleware/
│   │   ├── auth.js            # JWT middleware
│   │   ├── validation.js      # Input validation
│   │   └── errorHandler.js    # Error handling
│   └── controllers/
│       ├── authController.js  # Auth logic
│       └── taskController.js  # Task logic
├── tests/
│   ├── unit/
│   │   ├── models/           # Model tests
│   │   └── controllers/      # Controller tests
│   ├── integration/
│   │   ├── auth.test.js      # Auth endpoint tests
│   │   └── tasks.test.js     # Task endpoint tests
│   └── load/
│       └── load.test.js      # Performance tests
├── docs/
│   ├── api/
│   │   ├── swagger.yaml      # OpenAPI spec
│   │   └── postman.json      # Postman collection
│   └── README.md             # API documentation
├── docker/
│   ├── Dockerfile            # App container
│   └── docker-compose.yml    # Full stack setup
├── package.json
├── .env.example
└── README.md
```

### Key Generated Files

#### `src/models/Task.js`
```javascript
const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed'],
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  dueDate: {
    type: Date
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  }
}, {
  timestamps: true
});

// Indexes for performance
taskSchema.index({ userId: 1, status: 1 });
taskSchema.index({ userId: 1, dueDate: 1 });

module.exports = mongoose.model('Task', taskSchema);
```

#### `src/routes/tasks.js`
```javascript
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const validate = require('../middleware/validation');
const taskController = require('../controllers/taskController');
const { taskValidation } = require('../validators/taskValidator');

// All routes require authentication
router.use(auth);

/**
 * @route   GET /api/tasks
 * @desc    Get all tasks for authenticated user
 * @access  Private
 */
router.get('/', taskController.getTasks);

/**
 * @route   POST /api/tasks
 * @desc    Create a new task
 * @access  Private
 */
router.post('/', validate(taskValidation.create), taskController.createTask);

/**
 * @route   GET /api/tasks/:id
 * @desc    Get task by ID
 * @access  Private
 */
router.get('/:id', validate(taskValidation.getById), taskController.getTaskById);

/**
 * @route   PUT /api/tasks/:id
 * @desc    Update task
 * @access  Private
 */
router.put('/:id', validate(taskValidation.update), taskController.updateTask);

/**
 * @route   DELETE /api/tasks/:id
 * @desc    Delete task
 * @access  Private
 */
router.delete('/:id', validate(taskValidation.delete), taskController.deleteTask);

module.exports = router;
```

#### `tests/integration/tasks.test.js`
```javascript
const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/models/User');
const Task = require('../../src/models/Task');
const { connectDB, closeDB } = require('../helpers/database');

describe('Tasks API', () => {
  let authToken;
  let userId;
  let taskId;

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await closeDB();
  });

  beforeEach(async () => {
    // Clean database
    await User.deleteMany({});
    await Task.deleteMany({});

    // Create test user and get auth token
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      });

    authToken = userResponse.body.token;
    userId = userResponse.body.user.id;
  });

  describe('POST /api/tasks', () => {
    it('should create a new task', async () => {
      const taskData = {
        title: 'Test Task',
        description: 'Test Description',
        priority: 'high'
      };

      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(taskData.title);
      expect(response.body.data.userId).toBe(userId);

      taskId = response.body.data._id;
    });

    it('should return validation error for invalid data', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('title');
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/tasks')
        .send({ title: 'Test Task' })
        .expect(401);
    });
  });

  describe('GET /api/tasks', () => {
    beforeEach(async () => {
      // Create test tasks
      await Task.create([
        { title: 'Task 1', userId, status: 'pending' },
        { title: 'Task 2', userId, status: 'completed' },
        { title: 'Task 3', userId, status: 'in-progress' }
      ]);
    });

    it('should get all user tasks', async () => {
      const response = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);
    });

    it('should filter tasks by status', async () => {
      const response = await request(app)
        .get('/api/tasks?status=completed')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe('completed');
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/tasks?page=1&limit=2')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.totalPages).toBe(2);
    });
  });
});
```

## Expected Output

```
🚀 Starting Task Management API Development
================================================
✅ Development swarm ready: 6 agents
🏗️ Architecture: mesh topology

📋 Starting API development process...

🔄 Phase: Architecture Design
📊 Progress: 5%
🏗️ api-architect: Designing RESTful API structure and endpoints

🔄 Phase: Database Schema  
📊 Progress: 15%
🗄️ data-architect: Creating MongoDB schemas for User and Task models
🤝 Collaboration: data-architect → api-architect
   Context: Sharing database schema for API integration

🔄 Phase: Authentication System
📊 Progress: 30%
🔒 security-expert: Implementing JWT authentication and middleware
👨‍💻 implementation-dev: Coding authentication controllers and routes

✅ Quality Gate: Code Structure - 92/100
✅ Quality Gate: Security Standards - 88/100

🔄 Phase: API Endpoints
📊 Progress: 50%
👨‍💻 implementation-dev: Building CRUD endpoints for task management
🤝 Collaboration: implementation-dev → security-expert
   Context: Validating input sanitization for endpoints

🔄 Phase: Testing Suite
📊 Progress: 70%
🧪 qa-engineer: Writing comprehensive test suite
   - Unit tests: 45 tests created
   - Integration tests: 23 endpoints tested
   - Load tests: Performance scenarios implemented

✅ Quality Gate: Test Coverage - 94/100

🔄 Phase: Code Review
📊 Progress: 85%
👀 code-reviewer: Reviewing code quality and performance optimizations

🔒 Security Audit: 2 issues found
  - Fixed: Weak JWT secret configuration
  - Fixed: Missing rate limiting on auth endpoints

🔄 Phase: Final Integration
📊 Progress: 100%

🎉 API Development completed in 1247.3s

📊 Development Analysis
========================
📁 Generated 31 files:
  Source Code: 14 files
  Tests: 12 files  
  Configuration: 3 files
  Documentation: 2 files

🎯 Quality Metrics:
  Test Coverage: 94%
  Security Score: 96/100
  Performance Score: 89/100
  Code Quality: 92/100

🧪 Testing Results:
  Unit Tests: 45/45
  Integration Tests: 23/23  
  Load Tests: ✅ Passed

🔒 Security: ✅ No vulnerabilities found

📦 Creating deployment package at ./task-management-api
📁 Package structure:
  ./task-management-api/
  ├── src/
  │   ├── models/
  │   ├── routes/
  │   ├── middleware/
  │   ├── controllers/
  │   └── utils/
  ├── tests/
  ├── docs/
  ├── docker/
  ├── package.json
  ├── docker-compose.yml
  └── README.md

🎊 Development Summary
=====================
⏱️  Total Time: 20.8 minutes
📁 Files Created: 31
🧪 Tests Written: 68
🔒 Security: Secure
📈 Overall Quality: 93/100

🚀 Ready for deployment!
Next steps:
  1. Review the generated code
  2. Set up your MongoDB database
  3. Configure environment variables
  4. Run npm install && npm test
  5. Deploy using docker-compose up
```

## Key Features Demonstrated

1. **Complex Multi-Agent Coordination**: 6 specialized agents working in mesh topology
2. **Quality Gates**: Automated quality checks throughout development
3. **Security-First Approach**: Security specialist ensuring best practices
4. **Comprehensive Testing**: Unit, integration, and load testing
5. **Real-time Collaboration**: Agents sharing knowledge and context
6. **Production-Ready Output**: Complete deployment package with Docker

This example shows how Codex-Flow can handle complex, real-world development scenarios with multiple specialized agents working together to deliver high-quality, production-ready code.