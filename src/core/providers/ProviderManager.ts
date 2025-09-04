import { EventEmitter } from 'events';
import { BaseProvider, ProviderResponse, ChatCompletionRequest, ProviderConfig } from './BaseProvider';
import { OpenAIProvider } from './OpenAIProvider';
import { AnthropicProvider } from './AnthropicProvider';
import { GoogleProvider } from './GoogleProvider';
import { LocalProvider } from './LocalProvider';

export interface ProviderManagerConfig {
  providers: Record<string, ProviderConfig & { enabled: boolean }>;
  defaultProvider?: string;
  fallbackProviders?: string[];
  loadBalancing?: {
    enabled: boolean;
    strategy: 'round-robin' | 'least-loaded' | 'random';
  };
}

export class ProviderManager extends EventEmitter {
  private providers: Map<string, BaseProvider> = new Map();
  private config: ProviderManagerConfig;
  private providerStats: Map<string, { requests: number; errors: number; avgResponseTime: number }> = new Map();
  private lastUsedProvider = 0;

  constructor(config: ProviderManagerConfig) {
    super();
    this.config = config;
    this.initializeProviders();
  }

  private initializeProviders(): void {
    for (const [name, providerConfig] of Object.entries(this.config.providers)) {
      if (!providerConfig.enabled) continue;

      try {
        let provider: BaseProvider;

        switch (name.toLowerCase()) {
          case 'openai':
            provider = new OpenAIProvider(providerConfig);
            break;
          case 'anthropic':
            provider = new AnthropicProvider(providerConfig);
            break;
          case 'google':
            provider = new GoogleProvider(providerConfig);
            break;
          case 'local':
            provider = new LocalProvider(providerConfig);
            break;
          default:
            this.emit('warning', `Unknown provider type: ${name}`);
            continue;
        }

        // Set up provider event handlers
        provider.on('error', (error) => {
          this.updateProviderStats(name, { error: true });
          this.emit('provider-error', { provider: name, error });
        });

        provider.on('config-updated', (config) => {
          this.emit('provider-config-updated', { provider: name, config });
        });

        this.providers.set(name, provider);
        this.providerStats.set(name, { requests: 0, errors: 0, avgResponseTime: 0 });
        
        this.emit('provider-initialized', { provider: name, status: 'success' });
        
      } catch (error: any) {
        this.emit('provider-initialized', { 
          provider: name, 
          status: 'error', 
          error: error.message 
        });
      }
    }
  }

  async chatCompletion(request: ChatCompletionRequest, providerName?: string): Promise<ProviderResponse> {
    const provider = this.selectProvider(providerName, request);
    
    if (!provider) {
      throw new Error(`No available provider for request. Requested: ${providerName}, Available: ${Array.from(this.providers.keys()).join(', ')}`);
    }

    const startTime = Date.now();
    
    try {
      const response = await provider.chatCompletion(request);
      
      const responseTime = Date.now() - startTime;
      this.updateProviderStats(provider.getName(), { responseTime });
      
      return response;
    } catch (error: any) {
      this.updateProviderStats(provider.getName(), { error: true });
      
      // Try fallback providers if configured
      if (this.config.fallbackProviders && !providerName) {
        for (const fallbackName of this.config.fallbackProviders) {
          if (fallbackName === provider.getName()) continue;
          
          const fallbackProvider = this.providers.get(fallbackName);
          if (fallbackProvider) {
            try {
              const response = await fallbackProvider.chatCompletion(request);
              this.updateProviderStats(fallbackName, { responseTime: Date.now() - startTime });
              return response;
            } catch (fallbackError) {
              this.updateProviderStats(fallbackName, { error: true });
              continue;
            }
          }
        }
      }
      
      throw error;
    }
  }

  async *streamChatCompletion(request: ChatCompletionRequest, providerName?: string): AsyncGenerator<Partial<ProviderResponse>> {
    const provider = this.selectProvider(providerName, request);
    
    if (!provider) {
      throw new Error(`No available provider for streaming request. Requested: ${providerName}`);
    }

    const startTime = Date.now();
    
    try {
      for await (const chunk of provider.streamChatCompletion(request)) {
        yield chunk;
      }
      
      const responseTime = Date.now() - startTime;
      this.updateProviderStats(provider.getName(), { responseTime });
      
    } catch (error: any) {
      this.updateProviderStats(provider.getName(), { error: true });
      throw error;
    }
  }

  private selectProvider(providerName?: string, request?: ChatCompletionRequest): BaseProvider | null {
    // If specific provider requested, use it
    if (providerName) {
      const provider = this.providers.get(providerName);
      if (!provider) {
        throw new Error(`Provider '${providerName}' not found or not enabled`);
      }
      return provider;
    }

    // Use default provider if specified
    if (this.config.defaultProvider) {
      const defaultProvider = this.providers.get(this.config.defaultProvider);
      if (defaultProvider) {
        return defaultProvider;
      }
    }

    // Use load balancing strategy
    if (this.config.loadBalancing?.enabled) {
      return this.selectByLoadBalancing();
    }

    // Return first available provider
    const providers = Array.from(this.providers.values());
    return providers.length > 0 ? providers[0] : null;
  }

  private selectByLoadBalancing(): BaseProvider | null {
    const availableProviders = Array.from(this.providers.entries());
    
    if (availableProviders.length === 0) return null;
    if (availableProviders.length === 1) return availableProviders[0][1];

    switch (this.config.loadBalancing?.strategy) {
      case 'round-robin':
        this.lastUsedProvider = (this.lastUsedProvider + 1) % availableProviders.length;
        return availableProviders[this.lastUsedProvider][1];
        
      case 'least-loaded':
        const leastLoaded = availableProviders.reduce((min, current) => {
          const minStats = this.providerStats.get(min[0])!;
          const currentStats = this.providerStats.get(current[0])!;
          
          return currentStats.requests < minStats.requests ? current : min;
        });
        return leastLoaded[1];
        
      case 'random':
      default:
        const randomIndex = Math.floor(Math.random() * availableProviders.length);
        return availableProviders[randomIndex][1];
    }
  }

  private updateProviderStats(providerName: string, update: { responseTime?: number; error?: boolean }): void {
    const stats = this.providerStats.get(providerName);
    if (!stats) return;

    stats.requests++;
    
    if (update.error) {
      stats.errors++;
    }
    
    if (update.responseTime) {
      // Calculate rolling average
      stats.avgResponseTime = stats.avgResponseTime === 0 
        ? update.responseTime
        : (stats.avgResponseTime + update.responseTime) / 2;
    }
  }

  getProvider(name: string): BaseProvider | undefined {
    return this.providers.get(name);
  }

  getAllProviders(): Record<string, BaseProvider> {
    return Object.fromEntries(this.providers);
  }

  getEnabledProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  getProviderStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [name, provider] of this.providers) {
      const providerStats = this.providerStats.get(name);
      stats[name] = {
        ...providerStats,
        config: provider.getConfig()
      };
    }
    
    return stats;
  }

  async validateAllProviders(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    const validationPromises = Array.from(this.providers.entries()).map(
      async ([name, provider]) => {
        try {
          const isValid = await provider.validateConnection();
          results[name] = isValid;
        } catch (error) {
          results[name] = false;
        }
      }
    );
    
    await Promise.all(validationPromises);
    return results;
  }

  async getAllAvailableModels(): Promise<Record<string, string[]>> {
    const models: Record<string, string[]> = {};
    
    const modelPromises = Array.from(this.providers.entries()).map(
      async ([name, provider]) => {
        try {
          models[name] = await provider.getAvailableModels();
        } catch (error) {
          models[name] = [];
        }
      }
    );
    
    await Promise.all(modelPromises);
    return models;
  }

  updateProviderConfig(providerName: string, updates: Partial<ProviderConfig>): void {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider '${providerName}' not found`);
    }
    
    provider.updateConfig(updates);
  }

  enableProvider(providerName: string, config: ProviderConfig): void {
    if (this.providers.has(providerName)) {
      throw new Error(`Provider '${providerName}' is already enabled`);
    }

    this.config.providers[providerName] = { ...config, enabled: true };
    this.initializeProviders();
  }

  disableProvider(providerName: string): void {
    if (!this.providers.has(providerName)) {
      throw new Error(`Provider '${providerName}' is not enabled`);
    }

    this.providers.delete(providerName);
    this.providerStats.delete(providerName);
    this.config.providers[providerName].enabled = false;
    
    this.emit('provider-disabled', providerName);
  }
}