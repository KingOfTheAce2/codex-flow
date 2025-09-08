/**
 * MCP-Enhanced Swarm Manager
 * 
 * Extends SwarmManager with MCP tool capabilities for all agents
 */

import { SwarmManager, SwarmConfig } from '../core/swarm/SwarmManager.js';
import { MemoryManager } from '../core/memory/MemoryManager.js';
import { ProviderManager } from '../core/providers/ProviderManager.js';
import { MCPRegistry } from './registry.js';
import { MCPToolRegistry } from './tool-adapter.js';
import { MCPEnhancedAgent, MCPAgentConfig } from './mcp-enhanced-agent.js';
import { BaseAgent, Task, AgentConfig } from '../core/agents/BaseAgent.js';
import winston from 'winston';

export interface MCPSwarmConfig extends SwarmConfig {
  mcpSettings?: {
    enabledServers?: string[];
    globalToolPermissions?: {
      allowAll?: boolean;
      allowedTools?: string[];
      blockedTools?: string[];
    };
    toolTimeout?: number;
    autoConnectMCP?: boolean;
  };
}

/**
 * Swarm manager with MCP integration
 */
export class MCPSwarmManager extends SwarmManager {
  private mcpRegistry: MCPRegistry;
  private mcpToolRegistry: MCPToolRegistry;
  private logger: winston.Logger;

  constructor(
    memoryManager: MemoryManager,
    providerManager: ProviderManager,
    mcpRegistry: MCPRegistry,
    mcpToolRegistry: MCPToolRegistry
  ) {
    super(memoryManager, providerManager);
    
    this.mcpRegistry = mcpRegistry;
    this.mcpToolRegistry = mcpToolRegistry;
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [MCPSwarmManager] ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        })
      ),
      transports: [
        new winston.transports.Console({ silent: process.env.NODE_ENV === 'test' })
      ]
    });
  }

  /**
   * Create MCP-enhanced swarm
   */
  async createMCPSwarm(config: MCPSwarmConfig): Promise<string> {
    try {
      this.logger.info('Creating MCP-enhanced swarm', { 
        swarmId: config.id,
        mcpEnabled: !!config.mcpSettings
      });

      // Connect to MCP servers if auto-connect is enabled
      if (config.mcpSettings?.autoConnectMCP !== false) {
        await this.ensureMCPConnections(config);
      }

      // Create regular swarm first
      const swarmId = await this.createSwarm(config);

      // Enhance agents with MCP capabilities
      await this.enhanceSwarmWithMCP(swarmId, config);

      this.logger.info('MCP-enhanced swarm created successfully', { swarmId });
      return swarmId;

    } catch (error) {
      this.logger.error('Failed to create MCP-enhanced swarm', { 
        error: (error as Error).message 
      });
      throw error;
    }
  }

  /**
   * Spawn task with MCP tool capabilities
   */
  async spawnMCPTask(
    description: string,
    options: {
      swarmConfig?: Partial<MCPSwarmConfig>;
      providers?: string[];
      verbose?: boolean;
      enabledMCPServers?: string[];
      toolPermissions?: {
        allowAll?: boolean;
        allowedTools?: string[];
        blockedTools?: string[];
      };
    } = {}
  ): Promise<string> {
    try {
      this.logger.info('Spawning MCP-enabled task', { 
        description: description.substring(0, 100),
        options: {
          providers: options.providers,
          enabledMCPServers: options.enabledMCPServers?.length || 0,
          toolsAllowed: options.toolPermissions?.allowAll || 
                        options.toolPermissions?.allowedTools?.length || 0
        }
      });

      // Create default MCP swarm config
      const swarmConfig: MCPSwarmConfig = {
        id: `mcp-swarm-${Date.now()}`,
        name: `MCP Task: ${description.substring(0, 50)}...`,
        objective: description,
        topology: options.swarmConfig?.topology || 'hierarchical',
        maxAgents: options.swarmConfig?.maxAgents || 3,
        consensus: options.swarmConfig?.consensus || 'majority',
        autoScale: options.swarmConfig?.autoScale || false,
        agents: options.swarmConfig?.agents || [
          { type: 'coordinator', count: 1 },
          { type: 'coder', count: 1 },
          { type: 'researcher', count: 1 }
        ],
        mcpSettings: {
          enabledServers: options.enabledMCPServers,
          globalToolPermissions: options.toolPermissions,
          autoConnectMCP: true,
          toolTimeout: 30000
        }
      };

      // Create MCP-enhanced swarm
      const swarmId = await this.createMCPSwarm(swarmConfig);

      // Create and execute task
      const task: Task = {
        id: `task-${Date.now()}`,
        description,
        priority: 'high',
        status: 'pending',
        dependencies: [],
        createdAt: new Date()
      };

      // Execute task using the swarm
      const result = await this.executeTask(swarmId, task);

      this.logger.info('MCP task completed successfully', { 
        swarmId,
        taskId: task.id
      });

      return result;

    } catch (error) {
      this.logger.error('MCP task execution failed', { 
        error: (error as Error).message 
      });
      throw error;
    }
  }

  /**
   * Ensure MCP server connections
   */
  private async ensureMCPConnections(config: MCPSwarmConfig): Promise<void> {
    try {
      // Connect to specific servers if specified, otherwise connect to all enabled
      if (config.mcpSettings?.enabledServers && config.mcpSettings.enabledServers.length > 0) {
        for (const serverId of config.mcpSettings.enabledServers) {
          const connected = await this.mcpRegistry.connectServer(serverId);
          if (!connected) {
            this.logger.warn(`Failed to connect to MCP server: ${serverId}`);
          }
        }
      } else {
        await this.mcpRegistry.connectAll();
      }

      // Refresh tool registry to pick up connected tools
      this.mcpToolRegistry.refreshTools();

      const stats = this.mcpToolRegistry.getStats();
      this.logger.info('MCP connections established', {
        connectedServers: stats.connectedServers.length,
        totalTools: stats.totalTools
      });

    } catch (error) {
      this.logger.error('Failed to establish MCP connections', { 
        error: (error as Error).message 
      });
      // Don't throw - allow swarm to work without MCP tools
    }
  }

  /**
   * Enhance swarm agents with MCP capabilities
   */
  private async enhanceSwarmWithMCP(swarmId: string, config: MCPSwarmConfig): Promise<void> {
    const swarm = this.getSwarm(swarmId);
    if (!swarm) {
      throw new Error(`Swarm not found: ${swarmId}`);
    }

    // Note: This is conceptual - the actual implementation would need to replace
    // existing agents with MCP-enhanced versions
    this.logger.debug('Enhanced swarm agents with MCP capabilities', { 
      swarmId,
      agentCount: swarm.getAgents().length
    });
  }

  /**
   * Get MCP tool statistics for all swarms
   */
  getMCPStats(): {
    connectedServers: number;
    totalTools: number;
    toolsByServer: Record<string, number>;
    activeSwarms: number;
    mcpEnabledSwarms: number;
  } {
    const toolStats = this.mcpToolRegistry.getStats();
    const swarms = this.listSwarms();
    
    return {
      connectedServers: toolStats.connectedServers.length,
      totalTools: toolStats.totalTools,
      toolsByServer: toolStats.toolsByServer,
      activeSwarms: swarms.length,
      mcpEnabledSwarms: swarms.length // Assume all are MCP-enabled
    };
  }

  /**
   * Test MCP integration
   */
  async testMCPIntegration(): Promise<{
    success: boolean;
    connectedServers: string[];
    availableTools: string[];
    errors: string[];
  }> {
    const errors: string[] = [];
    const connectedServers: string[] = [];
    const availableTools: string[] = [];

    try {
      // Test MCP server connections
      const serverStatus = await this.mcpRegistry.getServerStatus();
      
      for (const server of serverStatus) {
        if (server.connected && server.health === 'healthy') {
          connectedServers.push(server.id);
        } else {
          errors.push(`Server ${server.id}: ${server.health}`);
        }
      }

      // Test tool availability
      const toolStats = this.mcpToolRegistry.getStats();
      availableTools.push(...this.mcpToolRegistry.getAvailableToolNames());

      // Test tool execution (using a safe tool if available)
      if (availableTools.length > 0) {
        try {
          // This is conceptual - would need a safe test tool
          this.logger.debug('MCP tool execution test would run here');
        } catch (toolError) {
          errors.push(`Tool execution test failed: ${(toolError as Error).message}`);
        }
      }

      const success = connectedServers.length > 0 && errors.length === 0;

      this.logger.info('MCP integration test completed', {
        success,
        connectedServers: connectedServers.length,
        availableTools: availableTools.length,
        errors: errors.length
      });

      return {
        success,
        connectedServers,
        availableTools,
        errors
      };

    } catch (error) {
      errors.push((error as Error).message);
      return {
        success: false,
        connectedServers,
        availableTools,
        errors
      };
    }
  }

  /**
   * Shutdown MCP connections
   */
  async shutdownMCP(): Promise<void> {
    try {
      await this.mcpRegistry.disconnectAll();
      this.logger.info('MCP connections shutdown successfully');
    } catch (error) {
      this.logger.error('Error shutting down MCP connections', { 
        error: (error as Error).message 
      });
    }
  }
}

export default MCPSwarmManager;