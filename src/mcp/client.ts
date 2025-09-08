/**
 * MCP Client Implementation
 * 
 * Provides a complete MCP (Model Context Protocol) client layer with:
 * - Session lifecycle management
 * - Capability negotiation
 * - Tool execution
 * - Resource management
 * - Error handling and retries
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { EventEmitter } from 'events';
import winston from 'winston';

export interface MCPServerConfig {
  id: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  cwd?: string;
  timeout?: number;
  maxRetries?: number;
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: any;
}

export interface MCPResource {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: any[];
}

export interface MCPToolCall {
  name: string;
  arguments: any;
}

export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

export class MCPClient extends EventEmitter {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private process: ChildProcessWithoutNullStreams | null = null;
  private config: MCPServerConfig;
  private connected: boolean = false;
  private tools: Map<string, MCPTool> = new Map();
  private resources: Map<string, MCPResource> = new Map();
  private prompts: Map<string, MCPPrompt> = new Map();
  private logger: winston.Logger;

  constructor(config: MCPServerConfig) {
    super();
    this.config = config;
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [MCP:${this.config.id}] ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        })
      ),
      transports: [
        new winston.transports.Console({ silent: process.env.NODE_ENV === 'test' })
      ]
    });
  }

  async connect(): Promise<boolean> {
    if (this.connected) {
      this.logger.warn('Already connected');
      return true;
    }

    try {
      this.logger.info('Starting MCP server', { command: this.config.command, args: this.config.args });

      // Spawn the MCP server process
      this.process = spawn(this.config.command, this.config.args, {
        env: { ...process.env, ...this.config.env },
        cwd: this.config.cwd,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      if (!this.process.stdin || !this.process.stdout || !this.process.stderr) {
        throw new Error('Failed to create stdio streams');
      }

      // Set up transport
      this.transport = new StdioClientTransport({
        stdin: this.process.stdin,
        stdout: this.process.stdout
      });

      // Create client
      this.client = new Client({
        name: `codex-flow-${this.config.id}`,
        version: '0.3.1-alpha'
      }, {
        capabilities: {
          tools: {},
          resources: {
            subscribe: true
          },
          prompts: {},
          logging: {}
        }
      });

      // Handle process errors
      this.process.on('error', (error) => {
        this.logger.error('MCP server process error', { error: error.message });
        this.emit('error', error);
      });

      this.process.on('exit', (code, signal) => {
        this.logger.info('MCP server exited', { code, signal });
        this.connected = false;
        this.emit('disconnected', { code, signal });
      });

      this.process.stderr?.on('data', (data) => {
        this.logger.warn('MCP server stderr', { data: data.toString() });
      });

      // Connect with timeout
      const connectTimeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout')), this.config.timeout || 10000);
      });

      await Promise.race([
        this.client.connect(this.transport),
        connectTimeout
      ]);

      this.connected = true;
      this.logger.info('Successfully connected to MCP server');

      // Initialize capabilities
      await this.loadCapabilities();

      this.emit('connected');
      return true;

    } catch (error) {
      this.logger.error('Failed to connect to MCP server', { error: (error as Error).message });
      await this.cleanup();
      this.emit('error', error);
      return false;
    }
  }

  private async loadCapabilities(): Promise<void> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    try {
      // Load tools
      const toolsResponse = await this.client.listTools();
      this.tools.clear();
      for (const tool of toolsResponse.tools) {
        this.tools.set(tool.name, tool);
      }
      this.logger.info(`Loaded ${this.tools.size} tools`, { tools: Array.from(this.tools.keys()) });

      // Load resources
      try {
        const resourcesResponse = await this.client.listResources();
        this.resources.clear();
        for (const resource of resourcesResponse.resources) {
          this.resources.set(resource.uri, resource);
        }
        this.logger.info(`Loaded ${this.resources.size} resources`);
      } catch (error) {
        this.logger.debug('Resources not supported or failed to load');
      }

      // Load prompts
      try {
        const promptsResponse = await this.client.listPrompts();
        this.prompts.clear();
        for (const prompt of promptsResponse.prompts) {
          this.prompts.set(prompt.name, prompt);
        }
        this.logger.info(`Loaded ${this.prompts.size} prompts`);
      } catch (error) {
        this.logger.debug('Prompts not supported or failed to load');
      }

    } catch (error) {
      this.logger.error('Failed to load capabilities', { error: (error as Error).message });
      throw error;
    }
  }

  async callTool(name: string, arguments_: any): Promise<MCPToolResult> {
    if (!this.client || !this.connected) {
      throw new Error('Client not connected');
    }

    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool '${name}' not found. Available tools: ${Array.from(this.tools.keys()).join(', ')}`);
    }

    try {
      this.logger.debug('Calling tool', { name, arguments: arguments_ });
      
      const result = await this.client.callTool({ name, arguments: arguments_ });
      
      this.logger.debug('Tool call completed', { name, success: !result.isError });
      
      return {
        content: result.content,
        isError: result.isError
      };
    } catch (error) {
      this.logger.error('Tool call failed', { name, error: (error as Error).message });
      throw error;
    }
  }

  async getResource(uri: string): Promise<any> {
    if (!this.client || !this.connected) {
      throw new Error('Client not connected');
    }

    try {
      this.logger.debug('Getting resource', { uri });
      const result = await this.client.readResource({ uri });
      return result.contents;
    } catch (error) {
      this.logger.error('Failed to get resource', { uri, error: (error as Error).message });
      throw error;
    }
  }

  async getPrompt(name: string, arguments_?: any): Promise<any> {
    if (!this.client || !this.connected) {
      throw new Error('Client not connected');
    }

    try {
      this.logger.debug('Getting prompt', { name, arguments: arguments_ });
      const result = await this.client.getPrompt({ name, arguments: arguments_ });
      return result;
    } catch (error) {
      this.logger.error('Failed to get prompt', { name, error: (error as Error).message });
      throw error;
    }
  }

  getAvailableTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  getAvailableResources(): MCPResource[] {
    return Array.from(this.resources.values());
  }

  getAvailablePrompts(): MCPPrompt[] {
    return Array.from(this.prompts.values());
  }

  isConnected(): boolean {
    return this.connected;
  }

  async ping(): Promise<boolean> {
    if (!this.client || !this.connected) {
      return false;
    }

    try {
      await this.client.ping();
      return true;
    } catch (error) {
      this.logger.warn('Ping failed', { error: (error as Error).message });
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.logger.info('Disconnecting from MCP server');
    this.connected = false;
    await this.cleanup();
    this.emit('disconnected');
  }

  private async cleanup(): Promise<void> {
    try {
      if (this.client && this.transport) {
        await this.client.close();
      }
    } catch (error) {
      this.logger.warn('Error during client cleanup', { error: (error as Error).message });
    }

    if (this.process && !this.process.killed) {
      this.process.kill('SIGTERM');
      
      // Force kill after timeout
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill('SIGKILL');
        }
      }, 5000);
    }

    this.client = null;
    this.transport = null;
    this.process = null;
    this.tools.clear();
    this.resources.clear();
    this.prompts.clear();
  }
}

/**
 * MCP Client Manager - manages multiple MCP server connections
 */
export class MCPClientManager extends EventEmitter {
  private clients: Map<string, MCPClient> = new Map();
  private configs: Map<string, MCPServerConfig> = new Map();
  private logger: winston.Logger;

  constructor() {
    super();
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [MCPManager] ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        })
      ),
      transports: [
        new winston.transports.Console({ silent: process.env.NODE_ENV === 'test' })
      ]
    });
  }

  addServer(config: MCPServerConfig): void {
    this.configs.set(config.id, config);
    this.logger.info('Added MCP server configuration', { id: config.id });
  }

  async connectServer(id: string): Promise<boolean> {
    const config = this.configs.get(id);
    if (!config) {
      throw new Error(`MCP server config not found: ${id}`);
    }

    if (this.clients.has(id)) {
      const client = this.clients.get(id)!;
      if (client.isConnected()) {
        return true;
      }
      await client.disconnect();
    }

    const client = new MCPClient(config);
    this.clients.set(id, client);

    // Proxy events
    client.on('connected', () => this.emit('server_connected', id));
    client.on('disconnected', () => this.emit('server_disconnected', id));
    client.on('error', (error) => this.emit('server_error', id, error));

    return await client.connect();
  }

  async connectAll(): Promise<void> {
    const connectionPromises = Array.from(this.configs.keys()).map(async (id) => {
      try {
        await this.connectServer(id);
      } catch (error) {
        this.logger.error(`Failed to connect to server ${id}`, { error: (error as Error).message });
      }
    });

    await Promise.allSettled(connectionPromises);
  }

  getClient(id: string): MCPClient | undefined {
    return this.clients.get(id);
  }

  getConnectedClients(): MCPClient[] {
    return Array.from(this.clients.values()).filter(client => client.isConnected());
  }

  async callTool(serverId: string, toolName: string, arguments_: any): Promise<MCPToolResult> {
    const client = this.clients.get(serverId);
    if (!client) {
      throw new Error(`MCP server not found: ${serverId}`);
    }

    return await client.callTool(toolName, arguments_);
  }

  findToolServers(toolName: string): string[] {
    const servers: string[] = [];
    
    for (const [serverId, client] of this.clients.entries()) {
      if (client.isConnected() && client.getAvailableTools().some(tool => tool.name === toolName)) {
        servers.push(serverId);
      }
    }

    return servers;
  }

  getAllAvailableTools(): Array<{ serverId: string; tool: MCPTool }> {
    const tools: Array<{ serverId: string; tool: MCPTool }> = [];
    
    for (const [serverId, client] of this.clients.entries()) {
      if (client.isConnected()) {
        for (const tool of client.getAvailableTools()) {
          tools.push({ serverId, tool });
        }
      }
    }

    return tools;
  }

  async disconnectAll(): Promise<void> {
    const disconnectionPromises = Array.from(this.clients.values()).map(client => 
      client.disconnect()
    );

    await Promise.allSettled(disconnectionPromises);
    this.clients.clear();
  }

  async healthCheck(): Promise<Map<string, boolean>> {
    const health = new Map<string, boolean>();
    
    for (const [serverId, client] of this.clients.entries()) {
      try {
        const isHealthy = await client.ping();
        health.set(serverId, isHealthy);
      } catch (error) {
        health.set(serverId, false);
      }
    }

    return health;
  }
}

export default MCPClient;