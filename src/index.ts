// Core exports
export * from './core/config';
export * from './core/providers';
export * from './core/agents';
export * from './core/swarm';
export * from './core/tasks';
export * from './core/memory';

// Tools and plugins
export * from './tools';
export * from './plugins';

// CLI (for programmatic usage)
export * from './cli/commands/init';
export * from './cli/commands/swarm';
export * from './cli/commands/task';
export * from './cli/commands/config';

// Main application class
import { EventEmitter } from 'events';
import { ConfigManager } from './core/config';
import { ProviderManager } from './core/providers';
import { AgentFactory } from './core/agents';
import { SwarmManager } from './core/swarm';
import { TaskManager } from './core/tasks';
import { MemoryManager } from './core/memory';
import { ToolManager } from './tools';
import { PluginSystem } from './plugins';

export interface CodexFlowConfig {
  projectPath?: string;
  configPath?: string;
  autoStart?: boolean;
  plugins?: {
    enabled?: boolean;
    directory?: string;
    autoActivate?: boolean;
  };
}

export class CodexFlow extends EventEmitter {
  private config: ConfigManager;
  private providers: ProviderManager;
  private agents: AgentFactory;
  private swarms: SwarmManager;
  private tasks: TaskManager;
  private memory: MemoryManager;
  private tools: ToolManager;
  private plugins: PluginSystem;
  private initialized = false;

  constructor(options: CodexFlowConfig = {}) {
    super();
    
    this.config = new ConfigManager(options.projectPath);
    this.memory = new MemoryManager();
    this.tools = new ToolManager();
    this.plugins = new PluginSystem({
      pluginDirectory: options.plugins?.directory,
      autoActivate: options.plugins?.autoActivate
    });

    // Initialize other managers after config is loaded
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Provider manager events
    this.providers?.on('provider-error', (event) => {
      this.emit('provider-error', event);
    });

    // Swarm manager events
    this.swarms?.on('swarm-spawned', (event) => {
      this.emit('swarm-spawned', event);
    });

    this.swarms?.on('swarm-completed', (event) => {
      this.emit('swarm-completed', event);
    });

    // Tool manager events
    this.tools.on('tool-registered', (event) => {
      this.emit('tool-registered', event);
    });

    // Plugin system events
    this.plugins.on('plugin-activated', (event) => {
      this.emit('plugin-activated', event);
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Load configuration
      await this.config.load();
      const configData = this.config.getConfig();

      // Initialize memory system
      await this.memory.initialize();

      // Initialize provider manager
      this.providers = new ProviderManager({
        providers: configData.providers,
        defaultProvider: 'openai',
        loadBalancing: {
          enabled: true,
          strategy: 'round-robin'
        }
      });

      // Initialize agent factory
      this.agents = new AgentFactory(this.providers);

      // Initialize managers that depend on providers
      this.swarms = new SwarmManager({
        providerManager: this.providers,
        memory: this.memory
      });

      this.tasks = new TaskManager(configData);

      // Initialize tools
      await this.tools.initializeAllTools();

      // Initialize plugins if enabled
      if (configData.plugins?.enabled !== false) {
        await this.plugins.initialize();
      }

      this.initialized = true;
      this.emit('initialized');

    } catch (error: any) {
      this.emit('initialization-error', { error: error.message });
      throw error;
    }
  }

  // Getters for accessing subsystems
  getConfig(): ConfigManager {
    return this.config;
  }

  getProviders(): ProviderManager {
    if (!this.providers) throw new Error('CodexFlow not initialized');
    return this.providers;
  }

  getAgents(): AgentFactory {
    if (!this.agents) throw new Error('CodexFlow not initialized');
    return this.agents;
  }

  getSwarms(): SwarmManager {
    if (!this.swarms) throw new Error('CodexFlow not initialized');
    return this.swarms;
  }

  getTasks(): TaskManager {
    return this.tasks;
  }

  getMemory(): MemoryManager {
    return this.memory;
  }

  getTools(): ToolManager {
    return this.tools;
  }

  getPlugins(): PluginSystem {
    return this.plugins;
  }

  // High-level operations
  async createSwarm(objective: string, options: any = {}): Promise<any> {
    if (!this.initialized) {
      await this.initialize();
    }

    return await this.swarms.spawn({
      objective,
      ...options
    });
  }

  async executeTask(description: string, options: any = {}): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Create a simple agent to execute the task
    const agent = this.agents.createAgent('coder', {
      name: 'Task Executor'
    });

    const task = await this.tasks.create({
      description,
      ...options
    });

    return await agent.executeTask(task);
  }

  async runTool(toolName: string, parameters: any, context: any = {}): Promise<any> {
    if (!this.initialized) {
      await this.initialize();
    }

    return await this.tools.executeTool(toolName, parameters, context);
  }

  // Utility methods
  async validateConfiguration(): Promise<{ valid: boolean; errors: string[] }> {
    try {
      await this.config.load();
      const providers = await this.providers?.validateAllProviders() || {};
      
      const errors: string[] = [];
      
      for (const [name, isValid] of Object.entries(providers)) {
        if (!isValid) {
          errors.push(`Provider '${name}' configuration is invalid`);
        }
      }

      return {
        valid: errors.length === 0,
        errors
      };
    } catch (error: any) {
      return {
        valid: false,
        errors: [error.message]
      };
    }
  }

  getSystemStatus(): {
    initialized: boolean;
    providers: number;
    activeAgents: number;
    activeSwarms: number;
    tools: number;
    plugins: number;
    memorySize: number;
  } {
    const providerStats = this.providers?.getStats() || { totalAgents: 0, activeAgents: 0 };
    const swarmStats = this.swarms?.getStats() || { totalSwarms: 0, activeSwarms: 0 };
    const toolStats = this.tools.getToolStats();
    const pluginStats = this.plugins.getStats();

    return {
      initialized: this.initialized,
      providers: Object.keys(this.providers?.getAllProviders() || {}).length,
      activeAgents: providerStats.activeAgents,
      activeSwarms: swarmStats.activeSwarms,
      tools: toolStats.enabledTools,
      plugins: pluginStats.activated,
      memorySize: 0 // Could get from memory manager
    };
  }

  async cleanup(): Promise<void> {
    try {
      // Cleanup in reverse order of initialization
      if (this.plugins) {
        await this.plugins.cleanupAllPlugins?.();
      }

      if (this.tools) {
        await this.tools.cleanupAllTools();
      }

      if (this.agents) {
        this.agents.destroyAllAgents();
      }

      if (this.memory) {
        await this.memory.close();
      }

      this.initialized = false;
      this.emit('cleaned-up');

    } catch (error: any) {
      this.emit('cleanup-error', { error: error.message });
    }
  }
}

// Export a default instance
export const codexFlow = new CodexFlow();