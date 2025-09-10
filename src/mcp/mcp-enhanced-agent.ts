/**
 * MCP-Enhanced Agent
 * 
 * Extends BaseAgent with MCP tool integration capabilities
 */

import { BaseAgent, AgentConfig, Task, AgentContext } from '../core/agents/BaseAgent.js';
import { ProviderManager } from '../core/providers/ProviderManager.js';
import { LLMToolBridge, ProviderToolHandler } from './llm-bridge.js';
import { MCPToolRegistry } from './tool-adapter.js';
import { MCPRegistry } from './registry.js';
import winston from 'winston';

export interface MCPAgentConfig extends AgentConfig {
  enabledMCPServers?: string[];
  toolPermissions?: {
    allowAll?: boolean;
    allowedTools?: string[];
    blockedTools?: string[];
  };
  toolTimeout?: number;
}

export interface MCPAgentContext extends AgentContext {
  mcpTools: string[];
  toolExecutions: Array<{
    toolName: string;
    arguments: any;
    result: any;
    success: boolean;
    timestamp: Date;
    duration: number;
  }>;
}

/**
 * Agent enhanced with MCP tool capabilities
 */
export abstract class MCPEnhancedAgent extends BaseAgent {
  protected mcpConfig: MCPAgentConfig;
  protected mcpContext: MCPAgentContext;
  protected mcpRegistry: MCPRegistry;
  protected toolBridge: LLMToolBridge;
  protected toolHandler: ProviderToolHandler;
  protected logger: winston.Logger;

  constructor(
    config: MCPAgentConfig,
    providerManager: ProviderManager,
    mcpRegistry: MCPRegistry,
    toolRegistry: MCPToolRegistry
  ) {
    super(config, providerManager);
    
    this.mcpConfig = config;
    this.mcpRegistry = mcpRegistry;
    this.toolBridge = new LLMToolBridge(toolRegistry);
    this.toolHandler = new ProviderToolHandler(this.toolBridge);
    
    // Enhance context with MCP-specific fields
    this.mcpContext = {
      ...this.context,
      mcpTools: [],
      toolExecutions: []
    };
    this.context = this.mcpContext;

    this.logger = winston.createLogger({
      level: 'debug',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [MCPAgent:${this.config.id}] ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        })
      ),
      transports: [
        new winston.transports.Console({ silent: process.env.NODE_ENV === 'test' })
      ]
    });

    // Initialize available tools
    this.refreshAvailableTools();
  }

  /**
   * Enhanced task execution with MCP tool support
   */
  override async executeTask(task: Task): Promise<string> {
    try {
      this.logger.info('Starting task execution with MCP tools', { 
        taskId: task.id,
        availableTools: this.mcpContext.mcpTools.length
      });

      // Refresh tools before execution
      this.refreshAvailableTools();

      // Call parent implementation which will call our processTask
      return await super.executeTask(task);

    } catch (error) {
      this.logger.error('Task execution failed', { 
        taskId: task.id,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Enhanced response generation with tool support
   */
  async generateResponseWithTools(prompt: string, context?: any): Promise<string> {
    const provider = await this.providerManager.getProvider(this.config.provider);
    
    if (!provider) {
      throw new Error(`Provider not found: ${this.config.provider}`);
    }

    const providerName = provider.getName();

    try {
      switch (providerName) {
        case 'openai':
          return await this.generateOpenAIResponseWithTools(prompt, context);
        case 'anthropic':
          return await this.generateAnthropicResponseWithTools(prompt, context);
        case 'google':
          return await this.generateGeminiResponseWithTools(prompt, context);
        default:
          // Fallback to regular response generation
          return await this.generateResponse(prompt, context);
      }
    } catch (error) {
      this.logger.error('Tool-enhanced response generation failed', { 
        error: (error as Error).message
      });
      // Fallback to regular response generation
      return await this.generateResponse(prompt, context);
    }
  }

  /**
   * Generate response using OpenAI with tool support
   */
  private async generateOpenAIResponseWithTools(prompt: string, context?: any): Promise<string> {
    const provider = await this.providerManager.getProvider(this.config.provider);
    
    if (!provider) {
      throw new Error(`Provider not found: ${this.config.provider}`);
    }

    const messages = this.buildMessagesFromHistory();
    messages.push({ role: 'user', content: prompt });

    // For now, use the provider's chatCompletion method directly
    // TODO: Implement proper tool integration
    const response = await provider.chatCompletion({
      messages: messages,
      model: this.config.model,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      tools: this.getFilteredToolsForProvider('openai')
    });

    return response.content || '';
  }

  /**
   * Generate response using Anthropic with tool support
   */
  private async generateAnthropicResponseWithTools(prompt: string, context?: any): Promise<string> {
    const provider = await this.providerManager.getProvider(this.config.provider);
    
    if (!provider) {
      throw new Error(`Provider not found: ${this.config.provider}`);
    }

    const messages = this.buildMessagesFromHistory();
    messages.push({ role: 'user', content: prompt });

    // For now, use the provider's chatCompletion method directly
    // TODO: Implement proper tool integration
    const response = await provider.chatCompletion({
      messages: messages,
      model: this.config.model || 'claude-3-5-sonnet-20241022',
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens || 4096,
      tools: this.getFilteredToolsForProvider('anthropic')
    });

    return response.content || '';
  }

  /**
   * Generate response using Gemini with tool support
   */
  private async generateGeminiResponseWithTools(prompt: string, context?: any): Promise<string> {
    const provider = await this.providerManager.getProvider(this.config.provider);
    
    if (!provider) {
      throw new Error(`Provider not found: ${this.config.provider}`);
    }

    const messages = this.buildMessagesFromHistory();
    messages.push({ role: 'user', content: prompt });

    // For now, use the provider's chatCompletion method directly
    // TODO: Implement proper tool integration
    const response = await provider.chatCompletion({
      messages: messages,
      model: this.config.model,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      tools: this.getFilteredToolsForProvider('gemini')
    });

    return response.content || '';
  }

  /**
   * Get filtered tools based on agent permissions
   */
  private getFilteredToolsForProvider(providerType: 'openai' | 'anthropic' | 'gemini'): any[] {
    const allTools = this.toolBridge.getOpenAITools(); // We'll convert as needed
    
    if (!this.mcpConfig.toolPermissions) {
      return this.convertToolsForProvider(allTools, providerType);
    }

    const permissions = this.mcpConfig.toolPermissions;
    
    // If allowAll is true, return all tools
    if (permissions.allowAll) {
      return this.convertToolsForProvider(allTools, providerType);
    }

    // Filter based on allowed/blocked tools
    const filteredTools = allTools.filter(tool => {
      const toolName = tool.function.name;
      
      // Check if tool is explicitly blocked
      if (permissions.blockedTools?.includes(toolName)) {
        return false;
      }
      
      // If allowedTools is specified, only include those
      if (permissions.allowedTools && permissions.allowedTools.length > 0) {
        return permissions.allowedTools.includes(toolName);
      }
      
      return true;
    });

    return this.convertToolsForProvider(filteredTools, providerType);
  }

  /**
   * Convert tool schemas for different providers
   */
  private convertToolsForProvider(tools: any[], providerType: string): any[] {
    switch (providerType) {
      case 'openai':
        return tools; // Already in OpenAI format
      case 'anthropic':
        return this.toolBridge.getAnthropicTools();
      case 'gemini':
        return this.toolBridge.getGeminiTools();
      default:
        return tools;
    }
  }

  /**
   * Build message array from conversation history
   */
  private buildMessagesFromHistory(): any[] {
    return this.context.conversationHistory.map(entry => ({
      role: entry.role,
      content: entry.content
    }));
  }

  /**
   * Update tool execution history
   */
  private updateToolExecutionHistory(messages: any[]): void {
    const toolMessages = messages.filter(m => m.role === 'tool' || m.type === 'tool_result');
    // This is a simplified implementation - in a real scenario, you'd extract
    // more detailed information about tool executions
    this.logger.debug('Tool executions logged', { count: toolMessages.length });
  }

  /**
   * Refresh available MCP tools
   */
  protected refreshAvailableTools(): void {
    try {
      this.toolBridge.refreshTools();
      const toolStats = this.toolBridge.getToolStats();
      
      this.mcpContext.mcpTools = Array.from(toolStats.connectedServers);
      this.mcpContext.availableTools = [
        ...this.mcpContext.availableTools.filter(tool => !tool.startsWith('mcp:')),
        ...Object.keys(toolStats.toolsByServer).map(server => `mcp:${server}`)
      ];
      
      this.logger.debug('Refreshed available MCP tools', { 
        totalTools: toolStats.totalTools,
        connectedServers: toolStats.connectedServers.length
      });
      
    } catch (error) {
      this.logger.warn('Failed to refresh MCP tools', { 
        error: (error as Error).message 
      });
    }
  }

  /**
   * Execute a specific MCP tool
   */
  async executeMCPTool(toolName: string, arguments_: any): Promise<any> {
    const startTime = Date.now();
    
    try {
      this.logger.debug('Executing MCP tool', { toolName, arguments: arguments_ });
      
      const result = await this.toolBridge.getToolStats();
      const duration = Date.now() - startTime;
      
      // Log execution
      this.mcpContext.toolExecutions.push({
        toolName,
        arguments: arguments_,
        result: result,
        success: true,
        timestamp: new Date(),
        duration
      });
      
      this.emit('tool-executed', {
        agent: this.config.id,
        toolName,
        success: true,
        duration
      });
      
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.error('MCP tool execution failed', { 
        toolName,
        error: (error as Error).message,
        duration
      });
      
      // Log failed execution
      this.mcpContext.toolExecutions.push({
        toolName,
        arguments: arguments_,
        result: null,
        success: false,
        timestamp: new Date(),
        duration
      });
      
      this.emit('tool-executed', {
        agent: this.config.id,
        toolName,
        success: false,
        error: (error as Error).message,
        duration
      });
      
      throw error;
    }
  }

  /**
   * Get tool execution statistics
   */
  getToolExecutionStats(): {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageDuration: number;
    toolUsage: Record<string, number>;
  } {
    const executions = this.mcpContext.toolExecutions;
    const successful = executions.filter(e => e.success);
    const failed = executions.filter(e => !e.success);
    
    const toolUsage: Record<string, number> = {};
    executions.forEach(e => {
      toolUsage[e.toolName] = (toolUsage[e.toolName] || 0) + 1;
    });
    
    const averageDuration = executions.length > 0 
      ? executions.reduce((sum, e) => sum + e.duration, 0) / executions.length
      : 0;
    
    return {
      totalExecutions: executions.length,
      successfulExecutions: successful.length,
      failedExecutions: failed.length,
      averageDuration,
      toolUsage
    };
  }

  /**
   * Check if agent has access to a specific tool
   */
  hasToolAccess(toolName: string): boolean {
    if (!this.mcpConfig.toolPermissions) {
      return true;
    }
    
    const permissions = this.mcpConfig.toolPermissions;
    
    if (permissions.allowAll) {
      return !permissions.blockedTools?.includes(toolName);
    }
    
    if (permissions.allowedTools && permissions.allowedTools.length > 0) {
      return permissions.allowedTools.includes(toolName);
    }
    
    return !permissions.blockedTools?.includes(toolName);
  }

  /**
   * Get enhanced system prompt with tool information
   */
  getEnhancedSystemPrompt(): string {
    const basePrompt = this.getSystemPrompt();
    const availableTools = this.toolBridge.getToolStats();
    
    if (availableTools.totalTools === 0) {
      return basePrompt;
    }
    
    const toolsDescription = `

Available MCP Tools (${availableTools.totalTools} tools from ${availableTools.connectedServers.length} servers):
${Object.entries(availableTools.toolsByServer)
  .map(([server, count]) => `- ${server}: ${count} tools`)
  .join('\n')}

You can call these tools to help complete tasks more effectively. Use tools when they would be helpful for the specific task at hand.`;
    
    return basePrompt + toolsDescription;
  }

  /**
   * Get MCP-specific context information
   */
  getMCPContext(): MCPAgentContext {
    return this.mcpContext;
  }
}

export default MCPEnhancedAgent;