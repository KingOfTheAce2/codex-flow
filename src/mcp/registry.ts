/**
 * MCP Server Registry
 * 
 * Manages MCP server configurations, lifecycle, and discovery
 */

import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { MCPClientManager, MCPServerConfig } from './client.js';
import winston from 'winston';

export const MCPServerConfigSchema = z.object({
  id: z.string().min(1),
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  env: z.record(z.string()).optional(),
  cwd: z.string().optional(),
  timeout: z.number().positive().default(10000),
  maxRetries: z.number().min(0).default(3),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  autoStart: z.boolean().default(true),
  enabled: z.boolean().default(true)
});

export const MCPRegistryConfigSchema = z.object({
  mcpServers: z.record(MCPServerConfigSchema),
  globalSettings: z.object({
    autoConnectOnStart: z.boolean().default(true),
    healthCheckInterval: z.number().positive().default(30000),
    maxConcurrentConnections: z.number().positive().default(10),
    retryBackoffMs: z.number().positive().default(1000)
  }).default({})
});

export type MCPRegistryConfig = z.infer<typeof MCPRegistryConfigSchema>;
export type ExtendedMCPServerConfig = z.infer<typeof MCPServerConfigSchema>;

export interface MCPServerStatus {
  id: string;
  connected: boolean;
  lastConnected?: Date;
  lastError?: string;
  toolCount: number;
  resourceCount: number;
  promptCount: number;
  health: 'healthy' | 'unhealthy' | 'unknown';
}

export class MCPRegistry {
  private config: MCPRegistryConfig;
  private clientManager: MCPClientManager;
  private configPath: string;
  private logger: winston.Logger;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(configPath: string = '.mcp.json') {
    this.configPath = configPath;
    this.clientManager = new MCPClientManager();
    this.config = { 
      mcpServers: {}, 
      globalSettings: {
        autoConnectOnStart: true,
        healthCheckInterval: 30000,
        maxConcurrentConnections: 10,
        retryBackoffMs: 1000
      } 
    };
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [MCPRegistry] ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        })
      ),
      transports: [
        new winston.transports.Console({ silent: process.env.NODE_ENV === 'test' })
      ]
    });

    // Proxy client manager events
    this.clientManager.on('server_connected', (id) => {
      this.logger.info(`MCP server connected: ${id}`);
    });

    this.clientManager.on('server_disconnected', (id) => {
      this.logger.info(`MCP server disconnected: ${id}`);
    });

    this.clientManager.on('server_error', (id, error) => {
      this.logger.error(`MCP server error: ${id}`, { error: error.message });
    });
  }

  /**
   * Load MCP configuration from file
   */
  async loadConfig(): Promise<void> {
    try {
      const configExists = await fs.access(this.configPath).then(() => true).catch(() => false);
      
      if (!configExists) {
        this.logger.info('No MCP config found, creating default');
        await this.createDefaultConfig();
        return;
      }

      const configData = await fs.readFile(this.configPath, 'utf-8');
      const parsedConfig = JSON.parse(configData);
      
      this.config = MCPRegistryConfigSchema.parse(parsedConfig);
      this.logger.info(`Loaded MCP config with ${Object.keys(this.config.mcpServers).length} servers`);

      // Add servers to client manager
      for (const [id, serverConfig] of Object.entries(this.config.mcpServers)) {
        if (serverConfig.enabled) {
          this.clientManager.addServer({
            id,
            command: serverConfig.command,
            args: serverConfig.args,
            env: serverConfig.env,
            cwd: serverConfig.cwd,
            timeout: serverConfig.timeout,
            maxRetries: serverConfig.maxRetries
          });
        }
      }

    } catch (error) {
      this.logger.error('Failed to load MCP config', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Save current configuration to file
   */
  async saveConfig(): Promise<void> {
    try {
      const configData = JSON.stringify(this.config, null, 2);
      await fs.writeFile(this.configPath, configData, 'utf-8');
      this.logger.info('Saved MCP config');
    } catch (error) {
      this.logger.error('Failed to save MCP config', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Create default configuration
   */
  async createDefaultConfig(): Promise<void> {
    this.config = {
      mcpServers: {
        'filesystem': {
          id: 'filesystem',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', path.resolve('.')],
          description: 'File system operations',
          tags: ['files', 'local'],
          autoStart: true,
          enabled: true,
          timeout: 10000,
          maxRetries: 3
        }
      },
      globalSettings: {
        autoConnectOnStart: true,
        healthCheckInterval: 30000,
        maxConcurrentConnections: 10,
        retryBackoffMs: 1000
      }
    };

    await this.saveConfig();
    this.logger.info('Created default MCP configuration');
  }

  /**
   * Add a new MCP server
   */
  async addServer(config: ExtendedMCPServerConfig): Promise<void> {
    const validConfig = MCPServerConfigSchema.parse(config);
    
    this.config.mcpServers[validConfig.id] = validConfig;
    await this.saveConfig();

    if (validConfig.enabled) {
      this.clientManager.addServer({
        id: validConfig.id,
        command: validConfig.command,
        args: validConfig.args,
        env: validConfig.env,
        cwd: validConfig.cwd,
        timeout: validConfig.timeout,
        maxRetries: validConfig.maxRetries
      });
    }

    this.logger.info(`Added MCP server: ${validConfig.id}`);
  }

  /**
   * Remove MCP server
   */
  async removeServer(id: string): Promise<void> {
    if (!this.config.mcpServers[id]) {
      throw new Error(`MCP server not found: ${id}`);
    }

    // Disconnect if connected
    const client = this.clientManager.getClient(id);
    if (client) {
      await client.disconnect();
    }

    delete this.config.mcpServers[id];
    await this.saveConfig();

    this.logger.info(`Removed MCP server: ${id}`);
  }

  /**
   * Update server configuration
   */
  async updateServer(id: string, updates: Partial<ExtendedMCPServerConfig>): Promise<void> {
    const existing = this.config.mcpServers[id];
    if (!existing) {
      throw new Error(`MCP server not found: ${id}`);
    }

    const updatedConfig = MCPServerConfigSchema.parse({ ...existing, ...updates });
    this.config.mcpServers[id] = updatedConfig;
    await this.saveConfig();

    // Reconnect if needed
    if (updatedConfig.enabled) {
      await this.reconnectServer(id);
    }

    this.logger.info(`Updated MCP server: ${id}`);
  }

  /**
   * Enable/disable server
   */
  async setServerEnabled(id: string, enabled: boolean): Promise<void> {
    await this.updateServer(id, { enabled });

    if (!enabled) {
      const client = this.clientManager.getClient(id);
      if (client) {
        await client.disconnect();
      }
    }
  }

  /**
   * Connect to all enabled servers
   */
  async connectAll(): Promise<void> {
    this.logger.info('Connecting to all enabled MCP servers...');
    
    await this.clientManager.connectAll();
    
    if (this.config.globalSettings.healthCheckInterval > 0) {
      this.startHealthCheck();
    }
  }

  /**
   * Connect to specific server
   */
  async connectServer(id: string): Promise<boolean> {
    return await this.clientManager.connectServer(id);
  }

  /**
   * Reconnect server (disconnect then connect)
   */
  async reconnectServer(id: string): Promise<boolean> {
    const client = this.clientManager.getClient(id);
    if (client) {
      await client.disconnect();
    }
    return await this.clientManager.connectServer(id);
  }

  /**
   * Disconnect from all servers
   */
  async disconnectAll(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    await this.clientManager.disconnectAll();
    this.logger.info('Disconnected from all MCP servers');
  }

  /**
   * Get server status information
   */
  async getServerStatus(): Promise<MCPServerStatus[]> {
    const statuses: MCPServerStatus[] = [];
    const healthMap = await this.clientManager.healthCheck();

    for (const [id, config] of Object.entries(this.config.mcpServers)) {
      const client = this.clientManager.getClient(id);
      const connected = client?.isConnected() || false;
      const healthy = healthMap.get(id) || false;

      statuses.push({
        id,
        connected,
        toolCount: client?.getAvailableTools().length || 0,
        resourceCount: client?.getAvailableResources().length || 0,
        promptCount: client?.getAvailablePrompts().length || 0,
        health: connected ? (healthy ? 'healthy' : 'unhealthy') : 'unknown'
      });
    }

    return statuses;
  }

  /**
   * List all available tools across all servers
   */
  getAllTools(): Array<{ serverId: string; toolName: string; description?: string }> {
    const allTools = this.clientManager.getAllAvailableTools();
    return allTools.map(({ serverId, tool }) => ({
      serverId,
      toolName: tool.name,
      description: tool.description
    }));
  }

  /**
   * Find servers that have a specific tool
   */
  findToolServers(toolName: string): string[] {
    return this.clientManager.findToolServers(toolName);
  }

  /**
   * Call a tool on a specific server
   */
  async callTool(serverId: string, toolName: string, arguments_: any): Promise<any> {
    return await this.clientManager.callTool(serverId, toolName, arguments_);
  }

  /**
   * Test server connectivity
   */
  async testServer(id: string): Promise<{ success: boolean; error?: string; tools?: string[] }> {
    try {
      const connected = await this.connectServer(id);
      if (!connected) {
        return { success: false, error: 'Failed to connect' };
      }

      const client = this.clientManager.getClient(id);
      if (!client) {
        return { success: false, error: 'Client not available' };
      }

      const tools = client.getAvailableTools().map(tool => tool.name);
      const pingSuccess = await client.ping();

      return { 
        success: pingSuccess, 
        tools,
        error: pingSuccess ? undefined : 'Ping failed'
      };
    } catch (error) {
      return { 
        success: false, 
        error: (error as Error).message 
      };
    }
  }

  /**
   * Start periodic health checks
   */
  private startHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        const healthMap = await this.clientManager.healthCheck();
        const unhealthyServers = Array.from(healthMap.entries())
          .filter(([_, healthy]) => !healthy)
          .map(([serverId]) => serverId);

        if (unhealthyServers.length > 0) {
          this.logger.warn('Unhealthy MCP servers detected', { servers: unhealthyServers });
          
          // Attempt to reconnect unhealthy servers
          for (const serverId of unhealthyServers) {
            try {
              await this.reconnectServer(serverId);
            } catch (error) {
              this.logger.error(`Failed to reconnect server ${serverId}`, { error: (error as Error).message });
            }
          }
        }
      } catch (error) {
        this.logger.error('Health check failed', { error: (error as Error).message });
      }
    }, this.config.globalSettings.healthCheckInterval);
  }

  /**
   * Get client manager (for direct access)
   */
  getClientManager(): MCPClientManager {
    return this.clientManager;
  }

  /**
   * Get current configuration
   */
  getConfig(): MCPRegistryConfig {
    return { ...this.config };
  }
}

export default MCPRegistry;