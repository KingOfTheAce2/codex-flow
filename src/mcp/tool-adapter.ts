/**
 * MCP Tool Adapter
 * 
 * Bridges MCP tools with the unified Tool interface used by swarm agents
 */

import { MCPClient, MCPTool, MCPToolResult } from './client.js';
import { MCPRegistry } from './registry.js';
import { BaseTool } from '../tools/BaseTool.js';
import winston from 'winston';

export interface ToolCall {
  name: string;
  arguments: any;
}

export interface ToolResult {
  success: boolean;
  result?: any;
  error?: string;
  metadata?: {
    serverId: string;
    duration: number;
    tokensUsed?: number;
  };
}

/**
 * Adapter that wraps an MCP tool to implement the unified Tool interface
 */
export class MCPToolAdapter extends BaseTool {
  public readonly name: string;
  public readonly description: string;
  private serverId: string;
  private mcpTool: MCPTool;
  private registry: MCPRegistry;
  private logger: winston.Logger;

  constructor(
    serverId: string,
    mcpTool: MCPTool,
    registry: MCPRegistry
  ) {
    super({
      name: mcpTool.name,
      description: mcpTool.description || `MCP tool from ${serverId}`,
      category: 'mcp',
      version: '1.0.0',
      parameters: Object.entries(mcpTool.inputSchema?.properties || {}).map(([name, prop]: [string, any]) => ({
        name,
        type: prop.type || 'string',
        description: prop.description || `Parameter ${name}`,
        required: mcpTool.inputSchema?.required?.includes(name) || false
      }))
    });
    
    this.name = mcpTool.name;
    this.description = mcpTool.description || `MCP tool from ${serverId}`;
    this.serverId = serverId;
    this.mcpTool = mcpTool;
    this.registry = registry;
    
    this.logger = winston.createLogger({
      level: 'debug',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [MCPToolAdapter:${this.name}] ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        })
      ),
      transports: [
        new winston.transports.Console({ silent: process.env.NODE_ENV === 'test' })
      ]
    });
  }

  async execute(args: any): Promise<ToolResult> {
    const startTime = Date.now();
    
    try {
      this.logger.debug('Executing MCP tool', { 
        tool: this.name, 
        serverId: this.serverId,
        args 
      });

      // Validate arguments against schema if available
      if (this.mcpTool.inputSchema) {
        try {
          // Basic validation - could be enhanced with a proper JSON schema validator
          this.validateArguments(args, this.mcpTool.inputSchema);
        } catch (error) {
          return {
            success: false,
            error: `Invalid arguments: ${(error as Error).message}`,
            metadata: {
              serverId: this.serverId,
              duration: Date.now() - startTime
            }
          };
        }
      }

      // Call the MCP tool
      const mcpResult = await this.registry.callTool(this.serverId, this.name, args);
      const duration = Date.now() - startTime;

      if (mcpResult.isError) {
        this.logger.warn('MCP tool returned error', { 
          tool: this.name,
          serverId: this.serverId,
          duration
        });

        return {
          success: false,
          error: this.extractErrorFromResult(mcpResult),
          metadata: {
            serverId: this.serverId,
            duration
          }
        };
      }

      const result = this.processResult(mcpResult);
      
      this.logger.debug('MCP tool executed successfully', { 
        tool: this.name,
        serverId: this.serverId,
        duration,
        resultType: typeof result
      });

      return {
        success: true,
        result,
        metadata: {
          serverId: this.serverId,
          duration
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.error('MCP tool execution failed', { 
        tool: this.name,
        serverId: this.serverId,
        duration,
        error: (error as Error).message
      });

      return {
        success: false,
        error: (error as Error).message,
        metadata: {
          serverId: this.serverId,
          duration
        }
      };
    }
  }

  /**
   * Get tool schema in OpenAI function calling format
   */
  getOpenAISchema(): any {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: this.mcpTool.inputSchema || {
          type: 'object',
          properties: {},
          required: []
        }
      }
    };
  }

  /**
   * Get tool schema in Anthropic format
   */
  getAnthropicSchema(): any {
    return {
      name: this.name,
      description: this.description,
      input_schema: this.mcpTool.inputSchema || {
        type: 'object',
        properties: {},
        required: []
      }
    };
  }

  /**
   * Get tool schema in Gemini format
   */
  getGeminiSchema(): any {
    return {
      name: this.name,
      description: this.description,
      parameters: this.mcpTool.inputSchema || {
        type: 'object',
        properties: {},
        required: []
      }
    };
  }

  /**
   * Basic argument validation
   */
  private validateArguments(args: any, schema: any): void {
    if (!schema || schema.type !== 'object') {
      return; // Skip validation if no proper schema
    }

    if (schema.required) {
      for (const requiredProp of schema.required) {
        if (!(requiredProp in args)) {
          throw new Error(`Missing required argument: ${requiredProp}`);
        }
      }
    }

    // Could add more sophisticated validation here
  }

  /**
   * Process MCP result into a more usable format
   */
  private processResult(mcpResult: MCPToolResult): any {
    if (!mcpResult.content || mcpResult.content.length === 0) {
      return null;
    }

    // If single content item, return it directly
    if (mcpResult.content.length === 1) {
      const content = mcpResult.content[0];
      if (content.type === 'text') {
        return content.text;
      }
      return content;
    }

    // Multiple content items - return as array
    return mcpResult.content.map(content => {
      if (content.type === 'text') {
        return content.text;
      }
      return content;
    });
  }

  /**
   * Extract error message from MCP result
   */
  private extractErrorFromResult(mcpResult: MCPToolResult): string {
    if (mcpResult.content && mcpResult.content.length > 0) {
      const errorContent = mcpResult.content.find(c => c.type === 'text');
      if (errorContent && errorContent.text) {
        return errorContent.text;
      }
    }
    return 'MCP tool execution failed';
  }

  getServerId(): string {
    return this.serverId;
  }

  getMCPTool(): MCPTool {
    return this.mcpTool;
  }
}

/**
 * Registry for MCP tool adapters
 */
export class MCPToolRegistry {
  private adapters: Map<string, MCPToolAdapter> = new Map();
  private registry: MCPRegistry;
  private logger: winston.Logger;

  constructor(registry: MCPRegistry) {
    this.registry = registry;
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [MCPToolRegistry] ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        })
      ),
      transports: [
        new winston.transports.Console({ silent: process.env.NODE_ENV === 'test' })
      ]
    });

    this.refreshTools();
  }

  /**
   * Refresh available tools from all connected MCP servers
   */
  refreshTools(): void {
    this.adapters.clear();
    
    const allTools = this.registry.getAllTools();
    
    for (const { serverId, toolName, description } of allTools) {
      const client = this.registry.getClientManager().getClient(serverId);
      if (!client || !client.isConnected()) {
        continue;
      }

      const mcpTool = client.getAvailableTools().find(t => t.name === toolName);
      if (!mcpTool) {
        continue;
      }

      const adapterId = `${serverId}:${toolName}`;
      const adapter = new MCPToolAdapter(serverId, mcpTool, this.registry);
      this.adapters.set(adapterId, adapter);
    }

    this.logger.info(`Refreshed ${this.adapters.size} MCP tool adapters`);
  }

  /**
   * Get all available tool adapters
   */
  getAllAdapters(): MCPToolAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Get adapter for a specific tool
   */
  getAdapter(toolName: string): MCPToolAdapter | undefined {
    // Try to find by tool name across all servers
    for (const adapter of this.adapters.values()) {
      if (adapter.name === toolName) {
        return adapter;
      }
    }
    return undefined;
  }

  /**
   * Get adapter by server and tool name
   */
  getAdapterByServer(serverId: string, toolName: string): MCPToolAdapter | undefined {
    const adapterId = `${serverId}:${toolName}`;
    return this.adapters.get(adapterId);
  }

  /**
   * Get all adapters for a specific server
   */
  getAdaptersByServer(serverId: string): MCPToolAdapter[] {
    return Array.from(this.adapters.values()).filter(
      adapter => adapter.getServerId() === serverId
    );
  }

  /**
   * Get adapters that match a pattern or tag
   */
  findAdapters(pattern: string | RegExp): MCPToolAdapter[] {
    const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
    
    return Array.from(this.adapters.values()).filter(adapter => 
      regex.test(adapter.name) || regex.test(adapter.description)
    );
  }

  /**
   * Execute a tool by name
   */
  async executeTool(toolName: string, args: any): Promise<ToolResult> {
    const adapter = this.getAdapter(toolName);
    if (!adapter) {
      return {
        success: false,
        error: `Tool not found: ${toolName}. Available tools: ${this.getAvailableToolNames().join(', ')}`
      };
    }

    return await adapter.execute(args);
  }

  /**
   * Get list of available tool names
   */
  getAvailableToolNames(): string[] {
    return Array.from(this.adapters.values()).map(adapter => adapter.name);
  }

  /**
   * Get tools formatted for different LLM providers
   */
  getToolsForProvider(provider: 'openai' | 'anthropic' | 'gemini'): any[] {
    const adapters = this.getAllAdapters();
    
    switch (provider) {
      case 'openai':
        return adapters.map(adapter => adapter.getOpenAISchema());
      case 'anthropic':
        return adapters.map(adapter => adapter.getAnthropicSchema());
      case 'gemini':
        return adapters.map(adapter => adapter.getGeminiSchema());
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * Handle tool calls from LLM responses
   */
  async handleToolCalls(toolCalls: ToolCall[]): Promise<ToolResult[]> {
    const results: ToolResult[] = [];
    
    for (const toolCall of toolCalls) {
      const result = await this.executeTool(toolCall.name, toolCall.arguments);
      results.push(result);
    }

    return results;
  }

  /**
   * Get tool statistics
   */
  getStats(): {
    totalTools: number;
    toolsByServer: Record<string, number>;
    connectedServers: string[];
  } {
    const toolsByServer: Record<string, number> = {};
    const connectedServers = new Set<string>();

    for (const adapter of this.adapters.values()) {
      const serverId = adapter.getServerId();
      toolsByServer[serverId] = (toolsByServer[serverId] || 0) + 1;
      connectedServers.add(serverId);
    }

    return {
      totalTools: this.adapters.size,
      toolsByServer,
      connectedServers: Array.from(connectedServers)
    };
  }
}

export default MCPToolRegistry;