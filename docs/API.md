# Codex-Flow API Reference

This document provides comprehensive API reference for Codex-Flow, including provider interfaces, tool development guide, memory system documentation, and extension points.

## Table of Contents

- [Core API](#core-api)
- [Provider Interfaces](#provider-interfaces)
- [Agent System](#agent-system)
- [Swarm Orchestration](#swarm-orchestration)
- [Memory System](#memory-system)
- [Tool Development](#tool-development)
- [Configuration API](#configuration-api)
- [Event System](#event-system)
- [Extension Points](#extension-points)
- [Error Handling](#error-handling)

## Core API

### CodexFlow Class

The main entry point for the Codex-Flow system.

```typescript
import { CodexFlow } from 'codex-flow';

const codexFlow = new CodexFlow({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4',
  config: {
    memory: {
      enabled: true,
      path: './memory/codex.db'
    },
    logging: {
      level: 'info'
    }
  }
});
```

#### Constructor Options

```typescript
interface CodexFlowOptions {
  provider: ProviderType;
  apiKey: string;
  model?: string;
  config?: CodexFlowConfig;
  plugins?: Plugin[];
  customAgents?: AgentDefinition[];
}
```

#### Methods

##### `initialize(): Promise<void>`

Initialize the Codex-Flow system, including memory, logging, and agent registration.

```typescript
await codexFlow.initialize();
```

##### `createSwarm(config: SwarmConfig): Promise<Swarm>`

Create a new agent swarm with specified configuration.

```typescript
const swarm = await codexFlow.createSwarm({
  topology: 'hierarchical',
  agents: [
    { type: 'coder', name: 'main-coder' },
    { type: 'tester', name: 'test-agent' },
    { type: 'reviewer', name: 'code-reviewer' }
  ],
  coordination: {
    memorySharing: true,
    eventBroadcast: true
  }
});
```

##### `executeTask(task: TaskDefinition): Promise<TaskResult>`

Execute a development task using the swarm orchestration system.

```typescript
const result = await codexFlow.executeTask({
  description: "Create a REST API with authentication",
  requirements: [
    "Express.js server",
    "JWT authentication",
    "User registration/login endpoints",
    "Protected routes",
    "Unit tests"
  ],
  swarm: swarm.id,
  timeout: 600000,
  parallel: true
});
```

##### `getMemory(): MemorySystem`

Access the memory system for reading/writing persistent data.

```typescript
const memory = codexFlow.getMemory();
await memory.store('api-design', {
  endpoints: ['/users', '/auth/login', '/auth/register'],
  database: 'mongodb',
  authentication: 'jwt'
});
```

## Provider Interfaces

### Base Provider Interface

All AI providers must implement the `Provider` interface:

```typescript
interface Provider {
  name: string;
  models: string[];
  
  initialize(config: ProviderConfig): Promise<void>;
  generateResponse(request: GenerationRequest): Promise<GenerationResponse>;
  validateModel(model: string): boolean;
  getCapabilities(): ProviderCapabilities;
}
```

### OpenAI Provider

```typescript
class OpenAIProvider implements Provider {
  name = 'openai';
  models = ['gpt-4', 'gpt-3.5-turbo', 'gpt-4-turbo'];
  
  constructor(private apiKey: string) {}
  
  async initialize(config: ProviderConfig): Promise<void> {
    // Initialize OpenAI client
    this.client = new OpenAI({ apiKey: this.apiKey });
  }
  
  async generateResponse(request: GenerationRequest): Promise<GenerationResponse> {
    const completion = await this.client.chat.completions.create({
      model: request.model,
      messages: request.messages,
      temperature: request.temperature ?? 0.1,
      max_tokens: request.maxTokens ?? 4096,
      tools: request.tools
    });
    
    return {
      content: completion.choices[0].message.content,
      toolCalls: completion.choices[0].message.tool_calls,
      usage: completion.usage
    };
  }
}
```

### Custom Provider Implementation

Create custom providers for other AI services:

```typescript
class CustomProvider implements Provider {
  name = 'custom-ai';
  models = ['custom-model-v1', 'custom-model-v2'];
  
  async initialize(config: ProviderConfig): Promise<void> {
    // Custom initialization logic
  }
  
  async generateResponse(request: GenerationRequest): Promise<GenerationResponse> {
    // Custom generation logic
    return {
      content: "Generated response from custom provider",
      usage: { tokens: 150 }
    };
  }
  
  validateModel(model: string): boolean {
    return this.models.includes(model);
  }
  
  getCapabilities(): ProviderCapabilities {
    return {
      supportsTools: true,
      supportsStreaming: false,
      maxTokens: 8192,
      supportedLanguages: ['javascript', 'python', 'typescript']
    };
  }
}
```

## Agent System

### Agent Interface

```typescript
interface Agent {
  id: string;
  type: AgentType;
  name: string;
  capabilities: AgentCapabilities;
  status: AgentStatus;
  
  initialize(context: AgentContext): Promise<void>;
  execute(task: AgentTask): Promise<AgentResult>;
  communicate(message: AgentMessage): Promise<AgentResponse>;
  getState(): AgentState;
}
```

### Built-in Agent Types

#### Coder Agent

```typescript
class CoderAgent implements Agent {
  type = 'coder';
  capabilities = {
    languages: ['typescript', 'javascript', 'python', 'java'],
    patterns: ['mvc', 'repository', 'factory', 'observer'],
    frameworks: ['express', 'react', 'nestjs', 'fastapi']
  };
  
  async execute(task: AgentTask): Promise<AgentResult> {
    const code = await this.generateCode(task);
    const validation = await this.validateCode(code);
    
    return {
      files: code.files,
      explanation: code.explanation,
      validation: validation,
      suggestions: code.improvements
    };
  }
  
  private async generateCode(task: AgentTask): Promise<CodeGeneration> {
    // Implementation for code generation
  }
}
```

#### Tester Agent

```typescript
class TesterAgent implements Agent {
  type = 'tester';
  capabilities = {
    testTypes: ['unit', 'integration', 'e2e'],
    frameworks: ['jest', 'mocha', 'cypress', 'playwright'],
    coverage: ['statement', 'branch', 'function', 'line']
  };
  
  async execute(task: AgentTask): Promise<AgentResult> {
    const tests = await this.generateTests(task);
    const coverage = await this.analyzeCoverage(tests);
    
    return {
      tests: tests,
      coverage: coverage,
      recommendations: this.getTestingRecommendations(task)
    };
  }
}
```

#### Reviewer Agent

```typescript
class ReviewerAgent implements Agent {
  type = 'reviewer';
  capabilities = {
    analysisTypes: ['security', 'performance', 'maintainability', 'best-practices'],
    languages: ['typescript', 'javascript', 'python', 'java'],
    tools: ['eslint', 'sonarqube', 'security-scanner']
  };
  
  async execute(task: AgentTask): Promise<AgentResult> {
    const analysis = await this.analyzeCode(task);
    const issues = await this.findIssues(analysis);
    const suggestions = await this.generateSuggestions(issues);
    
    return {
      analysis: analysis,
      issues: issues,
      suggestions: suggestions,
      score: this.calculateQualityScore(analysis)
    };
  }
}
```

### Custom Agent Development

```typescript
class CustomAgent implements Agent {
  id: string;
  type: AgentType;
  name: string;
  
  constructor(config: AgentConfig) {
    this.id = config.id;
    this.type = config.type;
    this.name = config.name;
  }
  
  async initialize(context: AgentContext): Promise<void> {
    // Custom initialization
    this.provider = context.provider;
    this.memory = context.memory;
    this.logger = context.logger;
  }
  
  async execute(task: AgentTask): Promise<AgentResult> {
    // Custom task execution logic
    const result = await this.provider.generateResponse({
      messages: this.buildPrompt(task),
      model: this.getModel(),
      tools: this.getTools()
    });
    
    return this.parseResult(result);
  }
  
  async communicate(message: AgentMessage): Promise<AgentResponse> {
    // Handle inter-agent communication
    await this.memory.store(`agent-${this.id}-messages`, message);
    return { acknowledged: true, response: "Message received" };
  }
}
```

## Swarm Orchestration

### Swarm Interface

```typescript
interface Swarm {
  id: string;
  topology: TopologyType;
  agents: Agent[];
  coordinator: Coordinator;
  memory: SharedMemory;
  
  addAgent(agent: Agent): Promise<void>;
  removeAgent(agentId: string): Promise<void>;
  executeTask(task: SwarmTask): Promise<SwarmResult>;
  broadcast(message: SwarmMessage): Promise<void>;
  getStatus(): SwarmStatus;
}
```

### Topology Implementations

#### Hierarchical Topology

```typescript
class HierarchicalTopology implements Topology {
  private coordinator: Agent;
  private workers: Agent[];
  
  async orchestrate(task: SwarmTask): Promise<SwarmResult> {
    // Break down task using coordinator
    const subtasks = await this.coordinator.execute({
      type: 'task-breakdown',
      content: task.description,
      requirements: task.requirements
    });
    
    // Distribute subtasks to workers
    const results = await Promise.all(
      subtasks.map((subtask, index) => 
        this.workers[index % this.workers.length].execute(subtask)
      )
    );
    
    // Coordinate final result
    const finalResult = await this.coordinator.execute({
      type: 'result-integration',
      results: results
    });
    
    return finalResult;
  }
}
```

#### Mesh Topology

```typescript
class MeshTopology implements Topology {
  private agents: Agent[];
  private communicationMatrix: Map<string, string[]>;
  
  async orchestrate(task: SwarmTask): Promise<SwarmResult> {
    // Broadcast task to all agents
    await this.broadcast({
      type: 'task-announcement',
      task: task
    });
    
    // Allow agents to self-organize
    const proposals = await this.collectProposals(task);
    const workPlan = await this.negotiateWorkPlan(proposals);
    
    // Execute coordinated work
    const results = await this.executeCoordinatedWork(workPlan);
    
    return this.consolidateResults(results);
  }
}
```

### Coordinator Interface

```typescript
interface Coordinator {
  topology: TopologyType;
  
  initialize(swarm: Swarm): Promise<void>;
  coordinate(task: SwarmTask): Promise<SwarmResult>;
  handleAgentFailure(agentId: string): Promise<void>;
  optimizeWorkflow(metrics: PerformanceMetrics): Promise<void>;
}
```

## Memory System

### Memory Interface

```typescript
interface MemorySystem {
  store(key: string, value: any, tags?: string[]): Promise<void>;
  retrieve(key: string): Promise<any>;
  query(criteria: QueryCriteria): Promise<MemoryEntry[]>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  
  // Vector operations for semantic search
  storeVector(key: string, vector: number[], metadata?: any): Promise<void>;
  searchSimilar(query: number[], limit?: number): Promise<SimilarityResult[]>;
  
  // Session management
  createSession(sessionId: string): Promise<MemorySession>;
  getSession(sessionId: string): Promise<MemorySession>;
  listSessions(): Promise<MemorySession[]>;
}
```

### Memory Implementation

```typescript
class SQLiteMemorySystem implements MemorySystem {
  private db: Database;
  
  constructor(private dbPath: string) {}
  
  async store(key: string, value: any, tags: string[] = []): Promise<void> {
    const entry = {
      key,
      value: JSON.stringify(value),
      tags: tags.join(','),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    await this.db.run(
      'INSERT OR REPLACE INTO memory (key, value, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [entry.key, entry.value, entry.tags, entry.created_at, entry.updated_at]
    );
  }
  
  async retrieve(key: string): Promise<any> {
    const row = await this.db.get('SELECT value FROM memory WHERE key = ?', [key]);
    return row ? JSON.parse(row.value) : null;
  }
  
  async query(criteria: QueryCriteria): Promise<MemoryEntry[]> {
    let sql = 'SELECT * FROM memory WHERE 1=1';
    const params: any[] = [];
    
    if (criteria.tags) {
      sql += ' AND tags LIKE ?';
      params.push(`%${criteria.tags.join('%')}%`);
    }
    
    if (criteria.since) {
      sql += ' AND created_at > ?';
      params.push(criteria.since.toISOString());
    }
    
    const rows = await this.db.all(sql, params);
    return rows.map(row => ({
      key: row.key,
      value: JSON.parse(row.value),
      tags: row.tags.split(','),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }));
  }
}
```

### Shared Memory for Swarms

```typescript
interface SharedMemory extends MemorySystem {
  subscribe(pattern: string, callback: MemoryChangeCallback): void;
  unsubscribe(pattern: string): void;
  broadcast(event: MemoryEvent): Promise<void>;
  
  // Agent-specific storage
  storeAgentData(agentId: string, key: string, value: any): Promise<void>;
  retrieveAgentData(agentId: string, key: string): Promise<any>;
  
  // Cross-agent communication
  sendMessage(fromAgent: string, toAgent: string, message: any): Promise<void>;
  getMessages(agentId: string): Promise<AgentMessage[]>;
}
```

## Tool Development

### Tool Interface

```typescript
interface Tool {
  name: string;
  description: string;
  schema: ToolSchema;
  
  execute(parameters: any, context: ToolContext): Promise<ToolResult>;
  validate(parameters: any): ValidationResult;
  getHelp(): string;
}
```

### Built-in Tools

#### File Operations Tool

```typescript
class FileOperationsTool implements Tool {
  name = 'file-ops';
  description = 'File system operations including read, write, create, delete';
  
  schema = {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['read', 'write', 'create', 'delete', 'list'] },
      path: { type: 'string' },
      content: { type: 'string' },
      recursive: { type: 'boolean' }
    },
    required: ['operation', 'path']
  };
  
  async execute(parameters: any, context: ToolContext): Promise<ToolResult> {
    const { operation, path, content, recursive } = parameters;
    
    switch (operation) {
      case 'read':
        const fileContent = await fs.readFile(path, 'utf-8');
        return { success: true, data: fileContent };
      
      case 'write':
        await fs.writeFile(path, content, 'utf-8');
        return { success: true, message: `File written to ${path}` };
      
      case 'create':
        if (recursive) {
          await fs.mkdir(path, { recursive: true });
        } else {
          await fs.mkdir(path);
        }
        return { success: true, message: `Directory created at ${path}` };
      
      case 'delete':
        await fs.rm(path, { recursive });
        return { success: true, message: `Deleted ${path}` };
      
      case 'list':
        const files = await fs.readdir(path);
        return { success: true, data: files };
      
      default:
        return { success: false, error: `Unknown operation: ${operation}` };
    }
  }
}
```

#### Git Operations Tool

```typescript
class GitOperationsTool implements Tool {
  name = 'git-ops';
  description = 'Git version control operations';
  
  schema = {
    type: 'object',
    properties: {
      command: { type: 'string', enum: ['status', 'add', 'commit', 'push', 'pull', 'branch', 'checkout'] },
      message: { type: 'string' },
      files: { type: 'array', items: { type: 'string' } },
      branch: { type: 'string' }
    },
    required: ['command']
  };
  
  async execute(parameters: any, context: ToolContext): Promise<ToolResult> {
    const { command, message, files, branch } = parameters;
    
    try {
      switch (command) {
        case 'status':
          const status = await this.execGit('status --porcelain');
          return { success: true, data: status };
        
        case 'add':
          const filesToAdd = files || ['.'];
          await this.execGit(`add ${filesToAdd.join(' ')}`);
          return { success: true, message: 'Files staged successfully' };
        
        case 'commit':
          await this.execGit(`commit -m "${message}"`);
          return { success: true, message: 'Commit created successfully' };
        
        case 'push':
          await this.execGit('push');
          return { success: true, message: 'Changes pushed to remote' };
        
        default:
          return { success: false, error: `Unknown git command: ${command}` };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  private async execGit(command: string): Promise<string> {
    // Execute git command using child_process
    return new Promise((resolve, reject) => {
      exec(`git ${command}`, (error, stdout, stderr) => {
        if (error) reject(error);
        else resolve(stdout);
      });
    });
  }
}
```

### Custom Tool Development

```typescript
class CustomTool implements Tool {
  name = 'my-custom-tool';
  description = 'Custom tool for specific functionality';
  
  schema = {
    type: 'object',
    properties: {
      // Define your tool's parameters
      action: { type: 'string' },
      data: { type: 'object' }
    },
    required: ['action']
  };
  
  async execute(parameters: any, context: ToolContext): Promise<ToolResult> {
    // Implement your tool's logic
    const { action, data } = parameters;
    
    // Access context for logging, memory, etc.
    context.logger.info(`Executing ${this.name} with action: ${action}`);
    
    // Store results in memory if needed
    await context.memory.store(`tool-${this.name}-result`, {
      action,
      timestamp: new Date(),
      result: 'success'
    });
    
    return {
      success: true,
      data: { message: `Executed ${action} successfully` }
    };
  }
  
  validate(parameters: any): ValidationResult {
    // Implement parameter validation
    if (!parameters.action) {
      return { valid: false, errors: ['action is required'] };
    }
    
    return { valid: true };
  }
}
```

### Tool Registration

```typescript
// Register tools with the system
codexFlow.registerTool(new FileOperationsTool());
codexFlow.registerTool(new GitOperationsTool());
codexFlow.registerTool(new CustomTool());

// Tools are automatically available to agents
const tools = codexFlow.getAvailableTools();
console.log('Available tools:', tools.map(t => t.name));
```

## Configuration API

### Configuration Schema

```typescript
interface CodexFlowConfig {
  project: ProjectConfig;
  agents: AgentConfig;
  swarm: SwarmConfig;
  provider: ProviderConfig;
  memory: MemoryConfig;
  logging: LoggingConfig;
  tools: ToolConfig;
}

interface ProjectConfig {
  name: string;
  version: string;
  description?: string;
  workingDirectory?: string;
}

interface AgentConfig {
  maxConcurrent: number;
  defaultTimeout: number;
  retryAttempts: number;
  types: string[];
  customAgents?: CustomAgentDefinition[];
}

interface SwarmConfig {
  defaultTopology: TopologyType;
  coordinationMode: 'hive-mind' | 'isolated';
  memorySharing: boolean;
  autoScale: boolean;
  maxAgents?: number;
}
```

### Configuration Management

```typescript
class ConfigurationManager {
  private config: CodexFlowConfig;
  
  constructor(configPath?: string) {
    this.loadConfig(configPath);
  }
  
  loadConfig(configPath?: string): void {
    const defaultPath = path.join(process.cwd(), 'codex-flow.config.json');
    const targetPath = configPath || defaultPath;
    
    if (fs.existsSync(targetPath)) {
      this.config = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
    } else {
      this.config = this.getDefaultConfig();
    }
    
    this.validateConfig();
  }
  
  saveConfig(configPath?: string): void {
    const defaultPath = path.join(process.cwd(), 'codex-flow.config.json');
    const targetPath = configPath || defaultPath;
    
    fs.writeFileSync(targetPath, JSON.stringify(this.config, null, 2));
  }
  
  get(key: string): any {
    return this.getNestedValue(this.config, key);
  }
  
  set(key: string, value: any): void {
    this.setNestedValue(this.config, key, value);
  }
  
  private getDefaultConfig(): CodexFlowConfig {
    return {
      project: {
        name: 'codex-flow-project',
        version: '1.0.0'
      },
      agents: {
        maxConcurrent: 5,
        defaultTimeout: 300,
        retryAttempts: 3,
        types: ['coder', 'tester', 'reviewer', 'researcher']
      },
      swarm: {
        defaultTopology: 'hierarchical',
        coordinationMode: 'hive-mind',
        memorySharing: true,
        autoScale: true
      },
      provider: {
        name: 'openai',
        model: 'gpt-4',
        temperature: 0.1,
        maxTokens: 4096
      },
      memory: {
        enabled: true,
        path: './memory/codex-flow.db',
        maxEntries: 10000,
        retentionDays: 30
      },
      logging: {
        level: 'info',
        file: './logs/codex-flow.log',
        console: true
      },
      tools: {
        enabled: ['file-ops', 'git-ops'],
        disabled: [],
        custom: []
      }
    };
  }
}
```

## Event System

### Event Interface

```typescript
interface EventSystem {
  emit(event: string, data?: any): void;
  on(event: string, listener: EventListener): void;
  off(event: string, listener: EventListener): void;
  once(event: string, listener: EventListener): void;
}

interface EventListener {
  (data: any): void | Promise<void>;
}
```

### Built-in Events

```typescript
// Agent events
codexFlow.on('agent:created', (data) => {
  console.log(`Agent ${data.id} created`);
});

codexFlow.on('agent:task:started', (data) => {
  console.log(`Agent ${data.agentId} started task: ${data.taskId}`);
});

codexFlow.on('agent:task:completed', (data) => {
  console.log(`Agent ${data.agentId} completed task: ${data.taskId}`);
});

// Swarm events
codexFlow.on('swarm:created', (data) => {
  console.log(`Swarm ${data.id} created with topology: ${data.topology}`);
});

codexFlow.on('swarm:task:started', (data) => {
  console.log(`Swarm ${data.swarmId} started executing task`);
});

// Memory events
codexFlow.on('memory:stored', (data) => {
  console.log(`Data stored in memory: ${data.key}`);
});

// Error events
codexFlow.on('error', (error) => {
  console.error('Codex-Flow error:', error);
});
```

## Extension Points

### Plugin Interface

```typescript
interface Plugin {
  name: string;
  version: string;
  dependencies?: string[];
  
  initialize(codexFlow: CodexFlow): Promise<void>;
  destroy(): Promise<void>;
  getConfiguration?(): PluginConfiguration;
}
```

### Plugin Development

```typescript
class CustomPlugin implements Plugin {
  name = 'my-custom-plugin';
  version = '1.0.0';
  
  async initialize(codexFlow: CodexFlow): Promise<void> {
    // Register custom agents
    codexFlow.registerAgent('custom-agent', CustomAgent);
    
    // Register custom tools
    codexFlow.registerTool(new CustomTool());
    
    // Subscribe to events
    codexFlow.on('swarm:created', this.onSwarmCreated.bind(this));
    
    // Extend memory system
    const memory = codexFlow.getMemory();
    memory.addIndex('custom-index', this.customIndexer.bind(this));
  }
  
  async destroy(): Promise<void> {
    // Cleanup plugin resources
  }
  
  private onSwarmCreated(data: any): void {
    console.log(`Plugin ${this.name} detected new swarm: ${data.id}`);
  }
  
  private customIndexer(entry: MemoryEntry): string[] {
    // Custom indexing logic
    return [];
  }
}
```

### Middleware System

```typescript
interface Middleware {
  name: string;
  priority: number;
  
  beforeTask?(context: TaskContext): Promise<TaskContext>;
  afterTask?(context: TaskContext, result: TaskResult): Promise<TaskResult>;
  beforeAgentExecution?(agent: Agent, task: AgentTask): Promise<void>;
  afterAgentExecution?(agent: Agent, result: AgentResult): Promise<void>;
}

class LoggingMiddleware implements Middleware {
  name = 'logging';
  priority = 100;
  
  async beforeTask(context: TaskContext): Promise<TaskContext> {
    console.log(`Starting task: ${context.task.description}`);
    context.metadata.startTime = Date.now();
    return context;
  }
  
  async afterTask(context: TaskContext, result: TaskResult): Promise<TaskResult> {
    const duration = Date.now() - context.metadata.startTime;
    console.log(`Task completed in ${duration}ms`);
    return result;
  }
}

// Register middleware
codexFlow.use(new LoggingMiddleware());
```

## Error Handling

### Error Types

```typescript
class CodexFlowError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: any
  ) {
    super(message);
    this.name = 'CodexFlowError';
  }
}

class AgentError extends CodexFlowError {
  constructor(message: string, public agentId: string, context?: any) {
    super(message, 'AGENT_ERROR', context);
    this.name = 'AgentError';
  }
}

class SwarmError extends CodexFlowError {
  constructor(message: string, public swarmId: string, context?: any) {
    super(message, 'SWARM_ERROR', context);
    this.name = 'SwarmError';
  }
}

class ProviderError extends CodexFlowError {
  constructor(message: string, public provider: string, context?: any) {
    super(message, 'PROVIDER_ERROR', context);
    this.name = 'ProviderError';
  }
}
```

### Error Recovery

```typescript
class ErrorRecoveryManager {
  private strategies = new Map<string, RecoveryStrategy>();
  
  registerStrategy(errorCode: string, strategy: RecoveryStrategy): void {
    this.strategies.set(errorCode, strategy);
  }
  
  async recover(error: CodexFlowError, context: any): Promise<RecoveryResult> {
    const strategy = this.strategies.get(error.code);
    
    if (strategy) {
      return await strategy.recover(error, context);
    }
    
    // Default recovery strategy
    return { recovered: false, shouldRetry: false };
  }
}

interface RecoveryStrategy {
  recover(error: CodexFlowError, context: any): Promise<RecoveryResult>;
}

interface RecoveryResult {
  recovered: boolean;
  shouldRetry: boolean;
  newContext?: any;
}
```

## Usage Examples

### Basic Usage

```typescript
import { CodexFlow } from 'codex-flow';

async function main() {
  const codexFlow = new CodexFlow({
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY
  });
  
  await codexFlow.initialize();
  
  const result = await codexFlow.executeTask({
    description: "Create a simple web server",
    requirements: ["Express.js", "Basic routing", "Error handling"]
  });
  
  console.log('Task completed:', result);
}

main().catch(console.error);
```

### Advanced Usage with Custom Agents and Tools

```typescript
import { CodexFlow, Agent, Tool } from 'codex-flow';

class DatabaseAgent implements Agent {
  // Implementation details...
}

class DatabaseTool implements Tool {
  // Implementation details...
}

async function advancedExample() {
  const codexFlow = new CodexFlow({
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    config: {
      memory: { enabled: true },
      logging: { level: 'debug' }
    }
  });
  
  // Register custom agent and tool
  codexFlow.registerAgent('database', DatabaseAgent);
  codexFlow.registerTool(new DatabaseTool());
  
  await codexFlow.initialize();
  
  // Create specialized swarm
  const swarm = await codexFlow.createSwarm({
    topology: 'mesh',
    agents: [
      { type: 'coder', name: 'api-developer' },
      { type: 'database', name: 'db-expert' },
      { type: 'tester', name: 'qa-engineer' }
    ]
  });
  
  const result = await codexFlow.executeTask({
    description: "Build a complete e-commerce API",
    requirements: [
      "User authentication",
      "Product catalog",
      "Shopping cart",
      "Order processing",
      "Payment integration",
      "Database schema",
      "Comprehensive tests"
    ],
    swarm: swarm.id
  });
  
  console.log('E-commerce API built successfully:', result);
}
```

This API reference provides comprehensive documentation for all major components of Codex-Flow. For more specific examples and use cases, refer to the [examples/](../examples/) directory.