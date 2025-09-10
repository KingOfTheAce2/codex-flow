import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import path from 'path';
import { BaseTool } from '../tools/BaseTool.js';
import { BaseAgent } from '../core/agents/BaseAgent.js';

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author?: string;
  homepage?: string;
  license?: string;
  keywords?: string[];
  
  // Plugin type and capabilities
  type: 'tool' | 'agent' | 'provider' | 'extension';
  capabilities: string[];
  
  // Entry points
  main: string;
  exports?: Record<string, string>;
  
  // Dependencies
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  
  // Plugin-specific configuration
  config?: {
    schema?: any;
    defaults?: Record<string, any>;
  };
  
  // Compatibility
  compatibility: {
    codexFlow: string; // semver range
    node: string;
  };
  
  // Security and permissions
  permissions?: string[];
  trusted?: boolean;
  
  // Lifecycle hooks
  hooks?: {
    install?: string;
    activate?: string;
    deactivate?: string;
    uninstall?: string;
  };
}

export interface Plugin {
  manifest: PluginManifest;
  instance?: any;
  status: 'installed' | 'activated' | 'deactivated' | 'failed';
  error?: string;
  loadedAt?: Date;
  activatedAt?: Date;
}

export interface PluginConfig {
  pluginDirectory: string;
  allowUntrusted: boolean;
  autoActivate: boolean;
  maxLoadTime: number; // milliseconds
}

export class PluginSystem extends EventEmitter {
  private config: PluginConfig;
  private plugins: Map<string, Plugin> = new Map();
  private loadedModules: Map<string, any> = new Map();

  constructor(config: Partial<PluginConfig> = {}) {
    super();
    this.config = {
      pluginDirectory: path.join(process.cwd(), 'plugins'),
      allowUntrusted: false,
      autoActivate: true,
      maxLoadTime: 30000,
      ...config
    };
  }

  async initialize(): Promise<void> {
    // Ensure plugin directory exists
    try {
      await fs.mkdir(this.config.pluginDirectory, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    // Discover and load plugins
    await this.discoverPlugins();
    
    this.emit('initialized');
  }

  private async discoverPlugins(): Promise<void> {
    try {
      const entries = await fs.readdir(this.config.pluginDirectory, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          await this.loadPlugin(entry.name);
        }
      }
      
      // Auto-activate plugins if configured
      if (this.config.autoActivate) {
        await this.activateAllPlugins();
      }
      
    } catch (error: any) {
      this.emit('discovery-error', { error: error.message });
    }
  }

  async loadPlugin(pluginName: string): Promise<boolean> {
    const pluginPath = path.join(this.config.pluginDirectory, pluginName);
    
    try {
      // Check if plugin directory exists
      const stats = await fs.stat(pluginPath);
      if (!stats.isDirectory()) {
        throw new Error(`Plugin path is not a directory: ${pluginPath}`);
      }

      // Load and validate manifest
      const manifest = await this.loadManifest(pluginPath);
      
      // Security check
      if (!manifest.trusted && !this.config.allowUntrusted) {
        throw new Error(`Untrusted plugin rejected: ${pluginName}`);
      }

      // Compatibility check
      if (!this.isCompatible(manifest)) {
        throw new Error(`Plugin ${pluginName} is not compatible with current version`);
      }

      // Create plugin entry
      const plugin: Plugin = {
        manifest,
        status: 'installed',
        loadedAt: new Date()
      };

      this.plugins.set(pluginName, plugin);
      
      this.emit('plugin-loaded', { name: pluginName, manifest });
      return true;

    } catch (error: any) {
      const plugin: Plugin = {
        manifest: { 
          name: pluginName, 
          version: 'unknown', 
          description: 'Failed to load',
          type: 'extension',
          capabilities: [],
          main: '',
          compatibility: { codexFlow: '*', node: '*' }
        },
        status: 'failed',
        error: error.message,
        loadedAt: new Date()
      };

      this.plugins.set(pluginName, plugin);
      this.emit('plugin-load-error', { name: pluginName, error: error.message });
      return false;
    }
  }

  private async loadManifest(pluginPath: string): Promise<PluginManifest> {
    const manifestPath = path.join(pluginPath, 'plugin.json');
    
    try {
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent) as PluginManifest;
      
      // Validate required fields
      this.validateManifest(manifest);
      
      return manifest;
    } catch (error: any) {
      throw new Error(`Failed to load plugin manifest: ${error.message}`);
    }
  }

  private validateManifest(manifest: any): void {
    const required = ['name', 'version', 'description', 'type', 'main', 'compatibility'];
    
    for (const field of required) {
      if (!manifest[field]) {
        throw new Error(`Missing required field in manifest: ${field}`);
      }
    }

    if (!['tool', 'agent', 'provider', 'extension'].includes(manifest.type)) {
      throw new Error(`Invalid plugin type: ${manifest.type}`);
    }

    if (!manifest.compatibility.codexFlow || !manifest.compatibility.node) {
      throw new Error('Missing compatibility information');
    }
  }

  private isCompatible(manifest: PluginManifest): boolean {
    // Simple compatibility check - could be enhanced with semver
    return true; // For now, accept all plugins
  }

  async activatePlugin(pluginName: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginName}`);
    }

    if (plugin.status === 'activated') {
      return true;
    }

    if (plugin.status === 'failed') {
      throw new Error(`Cannot activate failed plugin: ${plugin.error}`);
    }

    try {
      // Load the plugin module
      const pluginPath = path.join(this.config.pluginDirectory, pluginName);
      const mainFile = path.join(pluginPath, plugin.manifest.main);
      
      // Set load timeout
      const loadTimeout = setTimeout(() => {
        throw new Error(`Plugin load timeout: ${pluginName}`);
      }, this.config.maxLoadTime);

      try {
        // Dynamic import of the plugin
        const pluginModule = await this.loadPluginModule(mainFile);
        clearTimeout(loadTimeout);

        // Create plugin instance
        let instance;
        if (typeof pluginModule === 'function') {
          instance = new pluginModule();
        } else if (pluginModule.default && typeof pluginModule.default === 'function') {
          instance = new pluginModule.default();
        } else if (pluginModule.create && typeof pluginModule.create === 'function') {
          instance = pluginModule.create();
        } else {
          instance = pluginModule;
        }

        // Validate plugin instance based on type
        this.validatePluginInstance(instance, plugin.manifest.type);

        // Initialize plugin if it has an init method
        if (instance.initialize && typeof instance.initialize === 'function') {
          await instance.initialize();
        }

        // Store instance and update status
        plugin.instance = instance;
        plugin.status = 'activated';
        plugin.activatedAt = new Date();
        
        this.loadedModules.set(pluginName, pluginModule);

        this.emit('plugin-activated', { 
          name: pluginName, 
          type: plugin.manifest.type,
          capabilities: plugin.manifest.capabilities
        });

        return true;

      } catch (error) {
        clearTimeout(loadTimeout);
        throw error;
      }

    } catch (error: any) {
      plugin.status = 'failed';
      plugin.error = error.message;
      
      this.emit('plugin-activation-error', { 
        name: pluginName, 
        error: error.message 
      });
      
      return false;
    }
  }

  private async loadPluginModule(modulePath: string): Promise<any> {
    // Check if it's a TypeScript file
    if (modulePath.endsWith('.ts')) {
      // For TypeScript files, we'd need ts-node or compiled JS
      const jsPath = modulePath.replace('.ts', '.js');
      try {
        await fs.access(jsPath);
        return require(jsPath);
      } catch {
        throw new Error(`TypeScript plugin requires compiled JavaScript: ${jsPath}`);
      }
    }

    return require(modulePath);
  }

  private validatePluginInstance(instance: any, type: string): void {
    switch (type) {
      case 'tool':
        if (!(instance instanceof BaseTool)) {
          throw new Error('Tool plugins must extend BaseTool');
        }
        break;
        
      case 'agent':
        if (!(instance instanceof BaseAgent)) {
          throw new Error('Agent plugins must extend BaseAgent');
        }
        break;
        
      case 'provider':
        // Provider validation would go here
        break;
        
      case 'extension':
        // Extensions can be any valid object
        break;
        
      default:
        throw new Error(`Unknown plugin type: ${type}`);
    }
  }

  async deactivatePlugin(pluginName: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin || plugin.status !== 'activated') {
      return false;
    }

    try {
      // Call cleanup if available
      if (plugin.instance?.cleanup && typeof plugin.instance.cleanup === 'function') {
        await plugin.instance.cleanup();
      }

      // Remove event listeners
      if (plugin.instance?.removeAllListeners && typeof plugin.instance.removeAllListeners === 'function') {
        plugin.instance.removeAllListeners();
      }

      plugin.status = 'deactivated';
      plugin.instance = undefined;

      this.emit('plugin-deactivated', { name: pluginName });
      return true;

    } catch (error: any) {
      this.emit('plugin-deactivation-error', { 
        name: pluginName, 
        error: error.message 
      });
      return false;
    }
  }

  async uninstallPlugin(pluginName: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      return false;
    }

    // Deactivate first if activated
    if (plugin.status === 'activated') {
      await this.deactivatePlugin(pluginName);
    }

    try {
      // Remove from memory
      this.plugins.delete(pluginName);
      this.loadedModules.delete(pluginName);

      // Optionally remove files (careful with this!)
      // const pluginPath = path.join(this.config.pluginDirectory, pluginName);
      // await fs.rmdir(pluginPath, { recursive: true });

      this.emit('plugin-uninstalled', { name: pluginName });
      return true;

    } catch (error: any) {
      this.emit('plugin-uninstall-error', { 
        name: pluginName, 
        error: error.message 
      });
      return false;
    }
  }

  async activateAllPlugins(): Promise<{ activated: string[]; failed: string[] }> {
    const activated: string[] = [];
    const failed: string[] = [];

    for (const [name, plugin] of this.plugins) {
      if (plugin.status === 'installed') {
        try {
          const success = await this.activatePlugin(name);
          if (success) {
            activated.push(name);
          } else {
            failed.push(name);
          }
        } catch {
          failed.push(name);
        }
      }
    }

    this.emit('bulk-activation-complete', { activated, failed });
    return { activated, failed };
  }

  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  getAllPlugins(): Record<string, Plugin> {
    return Object.fromEntries(this.plugins);
  }

  getActivePlugins(): Record<string, Plugin> {
    const active: Record<string, Plugin> = {};
    
    for (const [name, plugin] of this.plugins) {
      if (plugin.status === 'activated') {
        active[name] = plugin;
      }
    }
    
    return active;
  }

  getPluginsByType(type: PluginManifest['type']): Record<string, Plugin> {
    const filtered: Record<string, Plugin> = {};
    
    for (const [name, plugin] of this.plugins) {
      if (plugin.manifest.type === type) {
        filtered[name] = plugin;
      }
    }
    
    return filtered;
  }

  getPluginInstance<T = any>(name: string): T | undefined {
    const plugin = this.plugins.get(name);
    return plugin?.status === 'activated' ? plugin.instance : undefined;
  }

  // Plugin development utilities
  async createPluginTemplate(
    name: string, 
    type: PluginManifest['type'], 
    options: {
      description?: string;
      author?: string;
      typescript?: boolean;
    } = {}
  ): Promise<string> {
    const pluginPath = path.join(this.config.pluginDirectory, name);
    
    // Create plugin directory
    await fs.mkdir(pluginPath, { recursive: true });

    // Create manifest
    const manifest: PluginManifest = {
      name,
      version: '1.0.0',
      description: options.description || `A ${type} plugin`,
      author: options.author,
      type,
      capabilities: [],
      main: options.typescript ? 'index.ts' : 'index.js',
      compatibility: {
        codexFlow: '^1.0.0',
        node: '>=18.0.0'
      },
      trusted: true
    };

    await fs.writeFile(
      path.join(pluginPath, 'plugin.json'),
      JSON.stringify(manifest, null, 2)
    );

    // Create main file template
    const mainContent = this.generateMainFileTemplate(type, options.typescript);
    const mainFile = path.join(pluginPath, manifest.main);
    await fs.writeFile(mainFile, mainContent);

    // Create README
    const readmeContent = this.generateReadmeTemplate(name, type, manifest);
    await fs.writeFile(path.join(pluginPath, 'README.md'), readmeContent);

    this.emit('plugin-template-created', { name, path: pluginPath });
    
    return pluginPath;
  }

  private generateMainFileTemplate(type: PluginManifest['type'], typescript: boolean = false): string {
    const lang = typescript ? 'ts' : 'js';
    const imports = typescript 
      ? `import { BaseTool, ToolResult } from '../tools/BaseTool.js';\nimport { BaseAgent } from '../core/agents/BaseAgent.js';`
      : `const { BaseTool } = require('../tools/BaseTool');\nconst { BaseAgent } = require('../core/agents/BaseAgent');`;

    switch (type) {
      case 'tool':
        return `${imports}

class CustomTool extends BaseTool {
  constructor() {
    super({
      name: 'custom_tool',
      description: 'A custom tool plugin',
      category: 'custom',
      version: '1.0.0',
      parameters: [
        {
          name: 'input',
          type: 'string',
          description: 'Input parameter',
          required: true
        }
      ]
    });
  }

  async execute(parameters${typescript ? ': Record<string, any>' : ''})${typescript ? ': Promise<ToolResult>' : ''} {
    const { input } = parameters;
    
    // Your tool logic here
    return this.success({ result: \`Processed: \${input}\` });
  }
}

${typescript ? 'export default CustomTool;' : 'module.exports = CustomTool;'}
`;

      case 'agent':
        return `${imports}

class CustomAgent extends BaseAgent {
  getSystemPrompt()${typescript ? ': string' : ''} {
    return 'You are a custom agent with specialized capabilities.';
  }

  async processTask(task${typescript ? ': any' : ''})${typescript ? ': Promise<string>' : ''} {
    // Your agent logic here
    return \`Processed task: \${task.description}\`;
  }

  async generateResponse(prompt${typescript ? ': string' : ''}, context${typescript ? '?: any' : ''})${typescript ? ': Promise<string>' : ''} {
    // Your response generation logic here
    return \`Response to: \${prompt}\`;
  }
}

${typescript ? 'export default CustomAgent;' : 'module.exports = CustomAgent;'}
`;

      default:
        return `class CustomPlugin {
  async initialize() {
    console.log('Custom plugin initialized');
  }

  async cleanup() {
    console.log('Custom plugin cleaned up');
  }
}

${typescript ? 'export default CustomPlugin;' : 'module.exports = CustomPlugin;'}
`;
    }
  }

  private generateReadmeTemplate(name: string, type: string, manifest: PluginManifest): string {
    return `# ${name}

${manifest.description}

## Type
${type}

## Installation
1. Copy this plugin directory to your codex-flow plugins folder
2. Restart codex-flow or reload plugins

## Usage
[Add usage instructions here]

## Configuration
[Add configuration options here]

## Development
[Add development instructions here]
`;
  }

  getStats(): {
    total: number;
    activated: number;
    failed: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
  } {
    const stats = {
      total: this.plugins.size,
      activated: 0,
      failed: 0,
      byType: {} as Record<string, number>,
      byStatus: {} as Record<string, number>
    };

    for (const plugin of this.plugins.values()) {
      if (plugin.status === 'activated') stats.activated++;
      if (plugin.status === 'failed') stats.failed++;
      
      stats.byType[plugin.manifest.type] = (stats.byType[plugin.manifest.type] || 0) + 1;
      stats.byStatus[plugin.status] = (stats.byStatus[plugin.status] || 0) + 1;
    }

    return stats;
  }
}