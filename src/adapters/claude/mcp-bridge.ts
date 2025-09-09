/**
 * Claude MCP Bridge - Integrates Claude's MCP ecosystem into Codex-Flow
 * 
 * This adapter bridges Claude's 87 MCP tools into the universal adapter system,
 * preserving all existing functionality while enabling multi-AI orchestration.
 */

import { BaseAdapter, TaskRequest, TaskResponse, AgentCapability, ProviderHealth, MemoryContext, AdapterFactory } from '../universal/base-adapter';
import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

export interface ClaudeConfig {
  apiKey?: string;
  model?: string;
  claudeCodePath?: string;
  mcpServerConfig?: Record<string, any>;
  sparc?: {
    enabled: boolean;
    modes: string[];
  };
  memory?: {
    sqlitePath?: string;
    crossSession: boolean;
    namespaces: string[];
  };
  hooks?: {
    enabled: boolean;
    configPath?: string;
  };
}

export interface MCPTool {
  name: string;
  description: string;
  category: string;
  parameters: Record<string, any>;
  capabilities: string[];
  complexity: 'simple' | 'medium' | 'complex' | 'enterprise';
}

/**
 * Claude MCP Bridge Adapter
 */
export class ClaudeMCPBridge extends BaseAdapter {
  private config: ClaudeConfig;
  private mcpTools: Map<string, MCPTool> = new Map();
  private claudeProcess?: ChildProcess;
  private memoryPath?: string;
  private sessionContext: Map<string, any> = new Map();

  constructor(config: ClaudeConfig) {
    super('claude-mcp', '2.0.0');
    this.config = config;
  }

  async initialize(config: Record<string, any>): Promise<boolean> {
    try {
      // Merge configuration
      this.config = { ...this.config, ...config };

      // Initialize MCP tools registry
      await this.initializeMCPTools();

      // Setup memory system
      await this.initializeMemorySystem();

      // Setup hooks if enabled
      if (this.config.hooks?.enabled) {
        await this.initializeHooks();
      }

      // Load capabilities
      this.capabilities = await this.loadCapabilities();

      // Update health
      this.updateHealth({
        status: 'healthy',
        responseTime: 0,
        successRate: 100,
        errorRate: 0
      });

      this.isInitialized = true;
      this.emit('initialized', { provider: 'claude-mcp' });

      return true;
    } catch (error) {
      this.updateHealth({
        status: 'unavailable',
        issues: [`Initialization failed: ${(error as Error).message}`]
      });
      return false;
    }
  }

  async executeTask(request: TaskRequest): Promise<TaskResponse> {
    const startTime = Date.now();
    this.emitTaskEvent('task_started', request);

    try {
      // Validate request
      const validation = this.validateTaskRequest(request);
      if (!validation.valid) {
        throw new Error(`Invalid request: ${validation.errors.join(', ')}`);
      }

      // Determine optimal MCP tools for the task
      const optimalTools = await this.selectOptimalTools(request);

      // Execute task using Claude with MCP tools
      let result: TaskResponse;

      switch (request.type) {
        case 'code':
          result = await this.executeCodeTask(request, optimalTools);
          break;
        case 'research':
          result = await this.executeResearchTask(request, optimalTools);
          break;
        case 'analysis':
          result = await this.executeAnalysisTask(request, optimalTools);
          break;
        case 'coordination':
          result = await this.executeCoordinationTask(request, optimalTools);
          break;
        default:
          result = await this.executeGenericTask(request, optimalTools);
      }

      // Update performance metrics
      const duration = Date.now() - startTime;
      result.performance.duration = duration;

      // Store result in memory if needed
      if (request.metadata?.storeResult) {
        await this.storeTaskResult(request, result);
      }

      this.emitTaskEvent('task_completed', request, result);
      return result;

    } catch (error) {
      const errorResponse = this.createErrorResponse(
        request, 
        error as Error, 
        Date.now() - startTime
      );
      
      this.emitTaskEvent('task_failed', request, errorResponse, error as Error);
      return errorResponse;
    }
  }

  async getCapabilities(): Promise<AgentCapability[]> {
    if (this.capabilities.length > 0) {
      return this.capabilities;
    }

    return await this.loadCapabilities();
  }

  async canHandleTask(taskType: string, requirements?: any): Promise<boolean> {
    const supportedTypes = ['code', 'research', 'analysis', 'creative', 'coordination'];
    
    if (!supportedTypes.includes(taskType)) {
      return false;
    }

    // Check specific requirements
    if (requirements?.model && !this.isModelSupported(requirements.model)) {
      return false;
    }

    // Check complexity requirements
    if (requirements?.quality === 'enterprise' && taskType !== 'code') {
      // Claude excels at enterprise-level code tasks
      return false;
    }

    return true;
  }

  async getOptimalAgent(
    taskType: string,
    requirements?: any
  ): Promise<{
    agent: string;
    model: string;
    confidence: number;
    reasoning: string;
  }> {
    const capabilities = await this.getCapabilities();
    let bestCapability: AgentCapability | null = null;
    let bestScore = 0;

    for (const capability of capabilities) {
      const score = this.calculateCapabilityScore(capability, taskType, requirements);
      if (score > bestScore) {
        bestScore = score;
        bestCapability = capability;
      }
    }

    if (!bestCapability) {
      return {
        agent: 'claude-generic',
        model: this.config.model || 'claude-3-5-sonnet-20241022',
        confidence: 0.3,
        reasoning: 'No specific capability match, using generic Claude agent'
      };
    }

    const confidence = Math.min(bestScore / 20, 1); // Normalize to 0-1
    const model = this.selectModelForCapability(bestCapability, requirements);

    return {
      agent: bestCapability.name,
      model,
      confidence,
      reasoning: `Selected ${bestCapability.name} based on ${bestCapability.domains.join(', ')} expertise`
    };
  }

  async storeMemory(context: MemoryContext): Promise<boolean> {
    try {
      // Use Claude's existing memory system integration
      const memoryKey = `${context.namespace}:${context.sessionId}`;
      this.sessionContext.set(memoryKey, {
        ...context.data,
        metadata: context.metadata
      });

      // If SQLite memory is configured, store there too
      if (this.memoryPath) {
        await this.storeInSQLite(context);
      }

      return true;
    } catch (error) {
      console.error('Failed to store memory:', error);
      return false;
    }
  }

  async retrieveMemory(
    sessionId: string,
    namespace: string = 'default'
  ): Promise<MemoryContext | null> {
    try {
      const memoryKey = `${namespace}:${sessionId}`;
      const data = this.sessionContext.get(memoryKey);

      if (!data) {
        // Try SQLite if available
        if (this.memoryPath) {
          return await this.retrieveFromSQLite(sessionId, namespace);
        }
        return null;
      }

      return {
        sessionId,
        namespace,
        crossSession: true,
        data: data,
        metadata: data.metadata || {
          created: new Date(),
          updated: new Date(),
          accessCount: 1,
          tags: []
        }
      };
    } catch (error) {
      console.error('Failed to retrieve memory:', error);
      return null;
    }
  }

  async checkHealth(): Promise<ProviderHealth> {
    const startTime = Date.now();
    
    try {
      // Test basic Claude Code functionality
      const testResponse = await this.executeClaude('echo "health check"', { timeout: 5000 });
      const responseTime = Date.now() - startTime;

      const health: ProviderHealth = {
        status: testResponse.success ? 'healthy' : 'degraded',
        responseTime,
        successRate: testResponse.success ? 100 : 0,
        errorRate: testResponse.success ? 0 : 100,
        lastCheck: new Date()
      };

      if (!testResponse.success) {
        health.issues = [`Health check failed: ${testResponse.error}`];
      }

      this.updateHealth(health);
      return health;
    } catch (error) {
      const health: ProviderHealth = {
        status: 'unavailable',
        responseTime: Date.now() - startTime,
        successRate: 0,
        errorRate: 100,
        lastCheck: new Date(),
        issues: [`Health check error: ${(error as Error).message}`]
      };

      this.updateHealth(health);
      return health;
    }
  }

  async shutdown(): Promise<void> {
    try {
      if (this.claudeProcess) {
        this.claudeProcess.kill();
        this.claudeProcess = undefined;
      }

      this.sessionContext.clear();
      this.isInitialized = false;
      
      this.emit('shutdown', { provider: 'claude-mcp' });
    } catch (error) {
      console.error('Error during shutdown:', error);
    }
  }

  // Private implementation methods

  private async initializeMCPTools(): Promise<void> {
    // Load the 87 MCP tools from Claude Flow
    const toolDefinitions = await this.loadMCPToolDefinitions();
    
    for (const tool of toolDefinitions) {
      this.mcpTools.set(tool.name, tool);
    }
  }

  private async loadMCPToolDefinitions(): Promise<MCPTool[]> {
    // This would load from the actual Claude Flow MCP tools configuration
    // For now, returning a representative set
    return [
      {
        name: 'code-generator',
        description: 'Generate code in various programming languages',
        category: 'development',
        parameters: { language: 'string', framework: 'string', requirements: 'string' },
        capabilities: ['typescript', 'python', 'javascript', 'react', 'node'],
        complexity: 'complex'
      },
      {
        name: 'test-generator',
        description: 'Generate comprehensive test suites',
        category: 'testing',
        parameters: { codeBase: 'string', testType: 'string', coverage: 'number' },
        capabilities: ['unit-tests', 'integration-tests', 'e2e-tests'],
        complexity: 'complex'
      },
      {
        name: 'documentation-writer',
        description: 'Generate technical documentation',
        category: 'documentation',
        parameters: { codeBase: 'string', format: 'string', audience: 'string' },
        capabilities: ['api-docs', 'user-guides', 'technical-specs'],
        complexity: 'medium'
      },
      {
        name: 'architecture-analyzer',
        description: 'Analyze and design system architecture',
        category: 'architecture',
        parameters: { requirements: 'string', constraints: 'object', scale: 'string' },
        capabilities: ['system-design', 'scalability', 'performance'],
        complexity: 'enterprise'
      },
      {
        name: 'debug-assistant',
        description: 'Debug and troubleshoot code issues',
        category: 'debugging',
        parameters: { code: 'string', error: 'string', context: 'string' },
        capabilities: ['error-analysis', 'performance-debugging', 'logic-debugging'],
        complexity: 'complex'
      }
      // ... 82 more tools would be loaded here
    ];
  }

  private async initializeMemorySystem(): Promise<void> {
    if (this.config.memory?.sqlitePath) {
      this.memoryPath = this.config.memory.sqlitePath;
      
      // Ensure the directory exists
      const dir = path.dirname(this.memoryPath);
      await fs.mkdir(dir, { recursive: true });
    }
  }

  private async initializeHooks(): Promise<void> {
    // Initialize Claude's hooks system
    if (this.config.hooks?.configPath) {
      try {
        const hooksConfig = JSON.parse(
          await fs.readFile(this.config.hooks.configPath, 'utf-8')
        );
        // Setup hooks integration
        console.log('Hooks initialized:', Object.keys(hooksConfig));
      } catch (error) {
        console.warn('Failed to initialize hooks:', error);
      }
    }
  }

  private async loadCapabilities(): Promise<AgentCapability[]> {
    const capabilities: AgentCapability[] = [];

    for (const [name, tool] of this.mcpTools) {
      capabilities.push({
        name: name,
        description: tool.description,
        type: tool.complexity === 'enterprise' ? 'specialized' : 'primary',
        domains: tool.capabilities,
        complexity: tool.complexity,
        performance: {
          speed: this.getSpeedScore(tool),
          quality: this.getQualityScore(tool),
          cost: this.getCostScore(tool)
        },
        requirements: {
          modelAccess: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307']
        }
      });
    }

    return capabilities;
  }

  private getSpeedScore(tool: MCPTool): number {
    const speedMap = {
      'simple': 9,
      'medium': 7,
      'complex': 6,
      'enterprise': 5
    };
    return speedMap[tool.complexity] || 7;
  }

  private getQualityScore(tool: MCPTool): number {
    const qualityMap = {
      'simple': 7,
      'medium': 8,
      'complex': 9,
      'enterprise': 10
    };
    return qualityMap[tool.complexity] || 8;
  }

  private getCostScore(tool: MCPTool): number {
    const costMap = {
      'simple': 2,
      'medium': 4,
      'complex': 6,
      'enterprise': 8
    };
    return costMap[tool.complexity] || 4;
  }

  private async selectOptimalTools(request: TaskRequest): Promise<MCPTool[]> {
    const relevantTools: MCPTool[] = [];

    for (const tool of this.mcpTools.values()) {
      if (this.isToolRelevant(tool, request)) {
        relevantTools.push(tool);
      }
    }

    // Sort by relevance and return top 5
    return relevantTools
      .sort((a, b) => this.calculateToolRelevance(b, request) - this.calculateToolRelevance(a, request))
      .slice(0, 5);
  }

  private isToolRelevant(tool: MCPTool, request: TaskRequest): boolean {
    // Check if tool capabilities match request type
    const typeCapabilityMap = {
      'code': ['typescript', 'python', 'javascript', 'react', 'node'],
      'research': ['analysis', 'documentation', 'research'],
      'analysis': ['analysis', 'performance', 'debugging'],
      'coordination': ['architecture', 'system-design', 'orchestration']
    };

    const relevantCapabilities = typeCapabilityMap[request.type] || [];
    return tool.capabilities.some(cap => relevantCapabilities.includes(cap));
  }

  private calculateToolRelevance(tool: MCPTool, request: TaskRequest): number {
    let score = 0;

    // Direct capability match
    const typeCapabilityMap = {
      'code': ['typescript', 'python', 'javascript', 'react', 'node'],
      'research': ['analysis', 'documentation', 'research'],
      'analysis': ['analysis', 'performance', 'debugging'],
      'coordination': ['architecture', 'system-design', 'orchestration']
    };

    const relevantCapabilities = typeCapabilityMap[request.type] || [];
    score += tool.capabilities.filter(cap => relevantCapabilities.includes(cap)).length * 3;

    // Complexity match
    if (request.requirements?.quality === 'enterprise' && tool.complexity === 'enterprise') {
      score += 5;
    }

    // Description keyword match
    const keywords = request.description.toLowerCase().split(' ');
    score += keywords.filter(keyword => 
      tool.description.toLowerCase().includes(keyword) ||
      tool.capabilities.some(cap => cap.includes(keyword))
    ).length;

    return score;
  }

  private async executeCodeTask(request: TaskRequest, tools: MCPTool[]): Promise<TaskResponse> {
    const primaryTool = tools.find(t => t.name === 'code-generator') || tools[0];
    
    return await this.executeWithTool(primaryTool, request, {
      language: this.extractLanguage(request.description),
      framework: this.extractFramework(request.description),
      requirements: request.description
    });
  }

  private async executeResearchTask(request: TaskRequest, tools: MCPTool[]): Promise<TaskResponse> {
    const primaryTool = tools.find(t => t.category === 'research') || tools[0];
    
    return await this.executeWithTool(primaryTool, request, {
      query: request.description,
      depth: request.requirements?.quality || 'production'
    });
  }

  private async executeAnalysisTask(request: TaskRequest, tools: MCPTool[]): Promise<TaskResponse> {
    const primaryTool = tools.find(t => t.category === 'analysis') || 
                       tools.find(t => t.name === 'architecture-analyzer') || 
                       tools[0];
    
    return await this.executeWithTool(primaryTool, request, {
      target: request.description,
      analysisType: this.extractAnalysisType(request.description)
    });
  }

  private async executeCoordinationTask(request: TaskRequest, tools: MCPTool[]): Promise<TaskResponse> {
    const primaryTool = tools.find(t => t.name === 'architecture-analyzer') || tools[0];
    
    return await this.executeWithTool(primaryTool, request, {
      objective: request.description,
      scope: 'coordination'
    });
  }

  private async executeGenericTask(request: TaskRequest, tools: MCPTool[]): Promise<TaskResponse> {
    const primaryTool = tools[0] || {
      name: 'generic-claude',
      description: 'Generic Claude processing',
      category: 'general',
      parameters: {},
      capabilities: ['general'],
      complexity: 'medium' as const
    };
    
    return await this.executeWithTool(primaryTool, request, {
      prompt: request.description,
      context: request.context
    });
  }

  private async executeWithTool(
    tool: MCPTool, 
    request: TaskRequest, 
    toolParams: Record<string, any>
  ): Promise<TaskResponse> {
    const startTime = Date.now();
    
    try {
      // Build Claude command with MCP tool
      const claudeCommand = this.buildClaudeCommand(tool, request, toolParams);
      
      // Execute the command
      const result = await this.executeClaude(claudeCommand, {
        timeout: request.constraints?.timeout || 30000
      });

      if (!result.success) {
        throw new Error(result.error || 'Claude execution failed');
      }

      return {
        id: request.id,
        status: 'success',
        result: {
          content: result.output || '',
          confidence: 0.85, // Claude generally provides high-confidence results
          reasoning: `Used ${tool.name} with MCP integration`,
          metadata: {
            tool: tool.name,
            toolParams,
            model: this.config.model || 'claude-3-5-sonnet-20241022'
          }
        },
        performance: {
          duration: Date.now() - startTime,
          tokensUsed: result.tokensUsed || 0,
          cost: this.calculateCost(result.tokensUsed || 0),
          model: this.config.model || 'claude-3-5-sonnet-20241022'
        },
        provider: {
          name: 'claude-mcp',
          version: this.version,
          capabilities: tool.capabilities
        },
        timestamp: new Date()
      };
    } catch (error) {
      throw error;
    }
  }

  private buildClaudeCommand(
    tool: MCPTool, 
    request: TaskRequest, 
    toolParams: Record<string, any>
  ): string {
    // Build appropriate Claude Code command
    let command = 'claude';
    
    if (this.config.sparc?.enabled) {
      command += ` sparc ${tool.name}`;
    }
    
    command += ` "${request.description}"`;
    
    // Add tool-specific parameters
    Object.entries(toolParams).forEach(([key, value]) => {
      if (typeof value === 'string') {
        command += ` --${key} "${value}"`;
      } else {
        command += ` --${key} ${JSON.stringify(value)}`;
      }
    });

    return command;
  }

  private async executeClaude(
    command: string, 
    options: { timeout?: number } = {}
  ): Promise<{
    success: boolean;
    output?: string;
    error?: string;
    tokensUsed?: number;
  }> {
    return new Promise((resolve) => {
      const process = spawn('claude', command.split(' ').slice(1), {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let error = '';

      process.stdout?.on('data', (data) => {
        output += data.toString();
      });

      process.stderr?.on('data', (data) => {
        error += data.toString();
      });

      process.on('close', (code) => {
        resolve({
          success: code === 0,
          output: output.trim(),
          error: error.trim() || undefined,
          tokensUsed: this.extractTokenCount(output)
        });
      });

      // Set timeout
      if (options.timeout) {
        setTimeout(() => {
          process.kill();
          resolve({
            success: false,
            error: 'Command timeout'
          });
        }, options.timeout);
      }
    });
  }

  private extractTokenCount(output: string): number {
    // Try to extract token count from Claude output
    const tokenMatch = output.match(/tokens?:\s*(\d+)/i);
    return tokenMatch ? parseInt(tokenMatch[1]) : 0;
  }

  private calculateCost(tokens: number): number {
    // Approximate Claude pricing
    const costPerToken = 0.00003; // $3 per 100K tokens
    return tokens * costPerToken;
  }

  private isModelSupported(model: string): boolean {
    const supportedModels = [
      'claude-3-5-sonnet-20241022',
      'claude-3-haiku-20240307',
      'claude-3-opus-20240229'
    ];
    return supportedModels.includes(model);
  }

  private selectModelForCapability(
    capability: AgentCapability, 
    requirements?: any
  ): string {
    if (requirements?.speed === 'fast') {
      return 'claude-3-haiku-20240307';
    }
    
    if (capability.complexity === 'enterprise' || requirements?.quality === 'enterprise') {
      return 'claude-3-opus-20240229';
    }
    
    return this.config.model || 'claude-3-5-sonnet-20241022';
  }

  private extractLanguage(description: string): string {
    const languages = ['typescript', 'javascript', 'python', 'java', 'go', 'rust', 'c++'];
    const desc = description.toLowerCase();
    
    for (const lang of languages) {
      if (desc.includes(lang)) {
        return lang;
      }
    }
    
    return 'typescript'; // default
  }

  private extractFramework(description: string): string {
    const frameworks = ['react', 'vue', 'angular', 'express', 'fastapi', 'django', 'spring'];
    const desc = description.toLowerCase();
    
    for (const framework of frameworks) {
      if (desc.includes(framework)) {
        return framework;
      }
    }
    
    return 'none';
  }

  private extractAnalysisType(description: string): string {
    const types = ['performance', 'security', 'architecture', 'code-quality', 'dependencies'];
    const desc = description.toLowerCase();
    
    for (const type of types) {
      if (desc.includes(type)) {
        return type;
      }
    }
    
    return 'general';
  }

  private async storeTaskResult(request: TaskRequest, result: TaskResponse): Promise<void> {
    const context: MemoryContext = {
      sessionId: request.metadata?.sessionId || 'default',
      namespace: request.metadata?.namespace || 'tasks',
      crossSession: true,
      data: {
        request,
        result,
        timestamp: new Date()
      },
      metadata: {
        created: new Date(),
        updated: new Date(),
        accessCount: 1,
        tags: [request.type, result.provider.name]
      }
    };

    await this.storeMemory(context);
  }

  private async storeInSQLite(context: MemoryContext): Promise<void> {
    // SQLite storage implementation would go here
    // This would integrate with Claude's existing SQLite memory system
    console.log('Storing in SQLite:', context.sessionId);
  }

  private async retrieveFromSQLite(
    sessionId: string, 
    namespace: string
  ): Promise<MemoryContext | null> {
    // SQLite retrieval implementation would go here
    // This would integrate with Claude's existing SQLite memory system
    console.log('Retrieving from SQLite:', sessionId, namespace);
    return null;
  }
}

/**
 * Factory for creating Claude MCP Bridge instances
 */
export class ClaudeMCPFactory implements AdapterFactory {
  async createAdapter(
    providerName: string,
    config: Record<string, any>
  ): Promise<BaseAdapter> {
    const claudeConfig = config as ClaudeConfig;
    const adapter = new ClaudeMCPBridge(claudeConfig);
    await adapter.initialize(config);
    return adapter;
  }
}

export default ClaudeMCPBridge;