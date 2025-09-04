import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';

// Configuration schemas
const ProjectConfigSchema = z.object({
  name: z.string(),
  description: z.string(),
  version: z.string().default('1.0.0')
});

const ProviderConfigSchema = z.object({
  enabled: z.boolean(),
  apiKey: z.string().optional(),
  url: z.string().optional(),
  defaultModel: z.string(),
  maxTokens: z.number().optional(),
  temperature: z.number().optional(),
  timeout: z.number().optional()
});

const SwarmConfigSchema = z.object({
  maxAgents: z.number().default(10),
  defaultTopology: z.enum(['hierarchical', 'mesh', 'ring', 'star']).default('hierarchical'),
  consensus: z.enum(['majority', 'weighted', 'byzantine']).default('majority'),
  autoScale: z.boolean().default(true),
  memorySize: z.number().default(100) // MB
});

const ConfigSchema = z.object({
  project: ProjectConfigSchema,
  providers: z.record(ProviderConfigSchema),
  swarm: SwarmConfigSchema,
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    file: z.string().optional()
  }).default({
    level: 'info'
  })
});

export type Config = z.infer<typeof ConfigSchema>;
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

export class ConfigManager {
  private config: Config | null = null;
  private configPath: string;

  constructor(projectDir: string = process.cwd()) {
    this.configPath = path.join(projectDir, '.codex-flow', 'config.json');
  }

  async initialize(projectConfig: {
    projectName: string;
    description: string;
    template: string;
    providers: string[];
  }): Promise<void> {
    const defaultConfig: Config = {
      project: {
        name: projectConfig.projectName,
        description: projectConfig.description,
        version: '1.0.0'
      },
      providers: {
        openai: {
          enabled: projectConfig.providers.includes('openai'),
          defaultModel: 'gpt-4',
          maxTokens: 4000,
          temperature: 0.7,
          timeout: 30000
        },
        anthropic: {
          enabled: projectConfig.providers.includes('anthropic'),
          defaultModel: 'claude-3-sonnet-20240229',
          maxTokens: 4000,
          temperature: 0.7,
          timeout: 30000
        },
        google: {
          enabled: projectConfig.providers.includes('google'),
          defaultModel: 'gemini-pro',
          maxTokens: 4000,
          temperature: 0.7,
          timeout: 30000
        },
        local: {
          enabled: projectConfig.providers.includes('local'),
          url: 'http://localhost:11434',
          defaultModel: 'llama2',
          maxTokens: 4000,
          temperature: 0.7,
          timeout: 30000
        }
      },
      swarm: {
        maxAgents: 10,
        defaultTopology: 'hierarchical',
        consensus: 'majority',
        autoScale: true,
        memorySize: 100
      },
      logging: {
        level: 'info'
      }
    };

    await this.save(defaultConfig);
  }

  async load(): Promise<Config> {
    try {
      const configData = await fs.readFile(this.configPath, 'utf-8');
      const parsedConfig = JSON.parse(configData);
      this.config = ConfigSchema.parse(parsedConfig);
      return this.config;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error('Configuration not found. Run "codex-flow init" first.');
      }
      throw new Error(`Failed to load configuration: ${error.message}`);
    }
  }

  async save(config: Config): Promise<void> {
    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(this.configPath), { recursive: true });
      
      // Validate configuration
      const validatedConfig = ConfigSchema.parse(config);
      
      await fs.writeFile(
        this.configPath,
        JSON.stringify(validatedConfig, null, 2),
        'utf-8'
      );
      
      this.config = validatedConfig;
    } catch (error: any) {
      throw new Error(`Failed to save configuration: ${error.message}`);
    }
  }

  getConfig(): Config {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call load() first.');
    }
    return this.config;
  }

  async set(key: string, value: any): Promise<void> {
    if (!this.config) {
      await this.load();
    }

    // Support dot notation for nested keys
    const keys = key.split('.');
    let current: any = this.config;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in current)) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
    
    await this.save(this.config!);
  }

  get(key: string): any {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call load() first.');
    }

    const keys = key.split('.');
    let current: any = this.config;
    
    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        return undefined;
      }
    }
    
    return current;
  }

  getEnabledProviders(): Record<string, ProviderConfig> {
    const config = this.getConfig();
    return Object.fromEntries(
      Object.entries(config.providers).filter(([_, provider]) => provider.enabled)
    );
  }

  async validateProviders(): Promise<Record<string, boolean>> {
    const enabledProviders = this.getEnabledProviders();
    const results: Record<string, boolean> = {};

    for (const [name, provider] of Object.entries(enabledProviders)) {
      try {
        // Check required fields
        if (name !== 'local' && !provider.apiKey) {
          results[name] = false;
          continue;
        }

        if (name === 'local' && !provider.url) {
          results[name] = false;
          continue;
        }

        // Additional validation could go here
        results[name] = true;
        
      } catch (error) {
        results[name] = false;
      }
    }

    return results;
  }
}