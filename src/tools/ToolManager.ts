import { EventEmitter } from 'events';
import { BaseTool, ToolResult } from './BaseTool.js';
import { FileOperationsTool } from './FileOperationsTool.js';
import { GitOperationsTool } from './GitOperationsTool.js';
import { WebSearchTool } from './WebSearchTool.js';

export interface ToolRegistry {
  [name: string]: BaseTool;
}

export interface ToolExecutionContext {
  agentId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

export class ToolManager extends EventEmitter {
  private tools: ToolRegistry = {};
  private executionHistory: Array<{
    toolName: string;
    parameters: any;
    result: ToolResult;
    context?: ToolExecutionContext;
    timestamp: Date;
    duration: number;
  }> = [];

  constructor() {
    super();
    this.initializeDefaultTools();
  }

  private initializeDefaultTools(): void {
    // Register default tools
    this.registerTool(new FileOperationsTool());
    this.registerTool(new GitOperationsTool());
    this.registerTool(new WebSearchTool());
  }

  registerTool(tool: BaseTool): void {
    const name = tool.getName();
    
    if (this.tools[name]) {
      this.emit('tool-replaced', { 
        name, 
        oldVersion: this.tools[name].getVersion(), 
        newVersion: tool.getVersion() 
      });
    }

    this.tools[name] = tool;

    // Set up tool event handlers
    this.setupToolEventHandlers(tool);

    this.emit('tool-registered', { 
      name, 
      category: tool.getCategory(), 
      version: tool.getVersion() 
    });
  }

  private setupToolEventHandlers(tool: BaseTool): void {
    const toolName = tool.getName();

    tool.on('tool-enabled', (event) => {
      this.emit('tool-enabled', { ...event, category: tool.getCategory() });
    });

    tool.on('tool-disabled', (event) => {
      this.emit('tool-disabled', { ...event, category: tool.getCategory() });
    });

    tool.on('tool-execute-start', (event) => {
      this.emit('tool-execute-start', { 
        ...event, 
        category: tool.getCategory(),
        version: tool.getVersion()
      });
    });

    tool.on('tool-execute-complete', (event) => {
      this.recordExecution(toolName, event.parameters, event.result, undefined, event.duration);
      this.emit('tool-execute-complete', { 
        ...event, 
        category: tool.getCategory(),
        version: tool.getVersion()
      });
    });

    tool.on('tool-execute-error', (event) => {
      const errorResult = { success: false, error: event.error };
      this.recordExecution(toolName, event.parameters, errorResult);
      this.emit('tool-execute-error', { 
        ...event, 
        category: tool.getCategory(),
        version: tool.getVersion()
      });
    });
  }

  unregisterTool(name: string): boolean {
    const tool = this.tools[name];
    if (!tool) {
      return false;
    }

    // Remove event handlers
    tool.removeAllListeners();

    delete this.tools[name];
    this.emit('tool-unregistered', { name });
    
    return true;
  }

  getTool(name: string): BaseTool | undefined {
    return this.tools[name];
  }

  getAllTools(): ToolRegistry {
    return { ...this.tools };
  }

  getEnabledTools(): ToolRegistry {
    const enabled: ToolRegistry = {};
    
    for (const [name, tool] of Object.entries(this.tools)) {
      if (tool.isToolEnabled()) {
        enabled[name] = tool;
      }
    }
    
    return enabled;
  }

  getToolsByCategory(category: string): ToolRegistry {
    const filtered: ToolRegistry = {};
    
    for (const [name, tool] of Object.entries(this.tools)) {
      if (tool.getCategory() === category) {
        filtered[name] = tool;
      }
    }
    
    return filtered;
  }

  async executeTool(
    name: string, 
    parameters: Record<string, any>, 
    context?: ToolExecutionContext
  ): Promise<ToolResult> {
    const tool = this.tools[name];
    if (!tool) {
      const result = { success: false, error: `Tool '${name}' not found` };
      this.recordExecution(name, parameters, result, context);
      return result;
    }

    const startTime = Date.now();
    
    try {
      const result = await tool.safeExecute(parameters);
      const duration = Date.now() - startTime;
      
      this.recordExecution(name, parameters, result, context, duration);
      
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const result = { success: false, error: error.message };
      
      this.recordExecution(name, parameters, result, context, duration);
      
      return result;
    }
  }

  private recordExecution(
    toolName: string, 
    parameters: any, 
    result: ToolResult, 
    context?: ToolExecutionContext, 
    duration?: number
  ): void {
    this.executionHistory.push({
      toolName,
      parameters,
      result,
      context,
      timestamp: new Date(),
      duration: duration || 0
    });

    // Keep history manageable
    if (this.executionHistory.length > 1000) {
      this.executionHistory = this.executionHistory.slice(-500);
    }
  }

  enableTool(name: string): boolean {
    const tool = this.tools[name];
    if (!tool) {
      return false;
    }

    tool.enable();
    return true;
  }

  disableTool(name: string): boolean {
    const tool = this.tools[name];
    if (!tool) {
      return false;
    }

    tool.disable();
    return true;
  }

  async initializeAllTools(): Promise<{ initialized: string[]; failed: string[] }> {
    const initialized: string[] = [];
    const failed: string[] = [];

    for (const [name, tool] of Object.entries(this.tools)) {
      try {
        await tool.initialize();
        initialized.push(name);
      } catch (error) {
        failed.push(name);
        this.emit('tool-initialization-failed', { name, error });
      }
    }

    this.emit('tools-initialized', { initialized, failed });
    
    return { initialized, failed };
  }

  async cleanupAllTools(): Promise<void> {
    const cleanupPromises = Object.entries(this.tools).map(async ([name, tool]) => {
      try {
        await tool.cleanup();
      } catch (error) {
        this.emit('tool-cleanup-error', { name, error });
      }
    });

    await Promise.all(cleanupPromises);
    this.emit('tools-cleaned-up');
  }

  getExecutionHistory(filter?: {
    toolName?: string;
    agentId?: string;
    sessionId?: string;
    limit?: number;
    success?: boolean;
  }): Array<any> {
    let history = [...this.executionHistory];

    if (filter) {
      if (filter.toolName) {
        history = history.filter(entry => entry.toolName === filter.toolName);
      }
      
      if (filter.agentId) {
        history = history.filter(entry => entry.context?.agentId === filter.agentId);
      }
      
      if (filter.sessionId) {
        history = history.filter(entry => entry.context?.sessionId === filter.sessionId);
      }
      
      if (filter.success !== undefined) {
        history = history.filter(entry => entry.result.success === filter.success);
      }
      
      if (filter.limit) {
        history = history.slice(-filter.limit);
      }
    }

    return history.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getToolStats(): {
    totalTools: number;
    enabledTools: number;
    categories: Record<string, number>;
    executions: {
      total: number;
      successful: number;
      failed: number;
      averageDuration: number;
    };
    topTools: Array<{ name: string; count: number; successRate: number }>;
  } {
    const totalTools = Object.keys(this.tools).length;
    const enabledTools = Object.values(this.tools).filter(t => t.isToolEnabled()).length;

    // Category distribution
    const categories: Record<string, number> = {};
    for (const tool of Object.values(this.tools)) {
      const category = tool.getCategory();
      categories[category] = (categories[category] || 0) + 1;
    }

    // Execution statistics
    const executions = this.executionHistory;
    const successful = executions.filter(e => e.result.success).length;
    const failed = executions.length - successful;
    const averageDuration = executions.length > 0 
      ? executions.reduce((sum, e) => sum + e.duration, 0) / executions.length 
      : 0;

    // Top tools by usage
    const toolUsage: Record<string, { count: number; successful: number }> = {};
    for (const execution of executions) {
      if (!toolUsage[execution.toolName]) {
        toolUsage[execution.toolName] = { count: 0, successful: 0 };
      }
      toolUsage[execution.toolName].count++;
      if (execution.result.success) {
        toolUsage[execution.toolName].successful++;
      }
    }

    const topTools = Object.entries(toolUsage)
      .map(([name, stats]) => ({
        name,
        count: stats.count,
        successRate: stats.count > 0 ? (stats.successful / stats.count) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalTools,
      enabledTools,
      categories,
      executions: {
        total: executions.length,
        successful,
        failed,
        averageDuration: Math.round(averageDuration)
      },
      topTools
    };
  }

  clearExecutionHistory(): number {
    const count = this.executionHistory.length;
    this.executionHistory = [];
    this.emit('execution-history-cleared', { count });
    return count;
  }

  // Generate MCP-compatible tool schemas
  generateMCPSchemas(): Array<any> {
    return Object.values(this.tools).map(tool => tool.generateMCPSchema());
  }

  // Validate tool configuration
  validateToolConfig(toolName: string, config: any): { valid: boolean; errors: string[] } {
    const tool = this.tools[toolName];
    if (!tool) {
      return { valid: false, errors: [`Tool '${toolName}' not found`] };
    }

    // Basic validation - can be extended based on requirements
    const errors: string[] = [];
    
    if (!config || typeof config !== 'object') {
      errors.push('Tool configuration must be an object');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Export tool configurations
  exportToolConfigs(): Record<string, any> {
    const configs: Record<string, any> = {};
    
    for (const [name, tool] of Object.entries(this.tools)) {
      configs[name] = {
        name: tool.getName(),
        description: tool.getDescription(),
        category: tool.getCategory(),
        version: tool.getVersion(),
        enabled: tool.isToolEnabled(),
        parameters: tool.getParameters(),
        schema: tool.generateMCPSchema()
      };
    }
    
    return configs;
  }
}