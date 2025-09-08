/**
 * Universal Base Adapter - Foundation for All AI Provider Integrations
 * 
 * This abstract base class defines the common interface that all AI provider
 * adapters must implement to work within the Codex-Flow orchestration system.
 * It enables seamless switching between Claude, Gemini, OpenAI, and future providers.
 */

import { EventEmitter } from 'events';

export interface TaskRequest {
  id: string;
  type: 'code' | 'research' | 'analysis' | 'creative' | 'coordination' | 'hybrid';
  description: string;
  context?: string;
  requirements?: {
    quality: 'draft' | 'production' | 'enterprise';
    speed: 'fast' | 'balanced' | 'thorough';
    creativity: number; // 0-1 scale
    accuracy: number; // 0-1 scale
  };
  constraints?: {
    maxTokens?: number;
    timeout?: number;
    cost?: number;
    model?: string;
  };
  metadata?: Record<string, any>;
}

export interface TaskResponse {
  id: string;
  status: 'success' | 'failure' | 'partial';
  result: {
    content: string;
    confidence: number; // 0-1 scale
    reasoning?: string;
    alternatives?: string[];
    metadata?: Record<string, any>;
  };
  performance: {
    duration: number;
    tokensUsed: number;
    cost: number;
    model: string;
  };
  provider: {
    name: string;
    version: string;
    capabilities: string[];
  };
  timestamp: Date;
}

export interface AgentCapability {
  name: string;
  description: string;
  type: 'primary' | 'secondary' | 'specialized';
  domains: string[]; // e.g., ['code', 'documentation', 'testing']
  complexity: 'simple' | 'medium' | 'complex' | 'enterprise';
  performance: {
    speed: number; // relative scale 1-10
    quality: number; // relative scale 1-10
    cost: number; // relative cost factor
  };
  requirements?: {
    minMemory?: number;
    specializedKnowledge?: string[];
    modelAccess?: string[];
  };
}

export interface ProviderHealth {
  status: 'healthy' | 'degraded' | 'unavailable';
  responseTime: number;
  successRate: number;
  errorRate: number;
  quotaRemaining?: number;
  quotaResetTime?: Date;
  lastCheck: Date;
  issues?: string[];
}

export interface MemoryContext {
  sessionId: string;
  namespace: string;
  crossSession: boolean;
  data: Record<string, any>;
  metadata: {
    created: Date;
    updated: Date;
    accessCount: number;
    tags: string[];
  };
}

/**
 * Abstract base class that all AI provider adapters must extend
 */
export abstract class BaseAdapter extends EventEmitter {
  protected providerName: string;
  protected version: string;
  protected isInitialized: boolean = false;
  protected health: ProviderHealth;
  protected capabilities: AgentCapability[] = [];

  constructor(providerName: string, version: string = '1.0.0') {
    super();
    this.providerName = providerName;
    this.version = version;
    this.health = {
      status: 'unavailable',
      responseTime: 0,
      successRate: 0,
      errorRate: 0,
      lastCheck: new Date(),
    };
  }

  /**
   * Initialize the adapter with provider-specific configuration
   */
  abstract initialize(config: Record<string, any>): Promise<boolean>;

  /**
   * Execute a task request and return the response
   */
  abstract executeTask(request: TaskRequest): Promise<TaskResponse>;

  /**
   * Get all available capabilities for this provider
   */
  abstract getCapabilities(): Promise<AgentCapability[]>;

  /**
   * Check if the provider can handle a specific task type
   */
  abstract canHandleTask(taskType: string, requirements?: any): Promise<boolean>;

  /**
   * Get optimal agent/model for a specific task
   */
  abstract getOptimalAgent(
    taskType: string,
    requirements?: any
  ): Promise<{
    agent: string;
    model: string;
    confidence: number;
    reasoning: string;
  }>;

  /**
   * Store context in provider-specific memory system
   */
  abstract storeMemory(context: MemoryContext): Promise<boolean>;

  /**
   * Retrieve context from provider-specific memory system
   */
  abstract retrieveMemory(
    sessionId: string,
    namespace?: string
  ): Promise<MemoryContext | null>;

  /**
   * Check provider health and update status
   */
  abstract checkHealth(): Promise<ProviderHealth>;

  /**
   * Graceful shutdown of the adapter
   */
  abstract shutdown(): Promise<void>;

  // Common methods implemented in base class

  /**
   * Get provider information
   */
  getProviderInfo(): {
    name: string;
    version: string;
    initialized: boolean;
    health: ProviderHealth;
  } {
    return {
      name: this.providerName,
      version: this.version,
      initialized: this.isInitialized,
      health: this.health,
    };
  }

  /**
   * Check if adapter is ready to handle requests
   */
  isReady(): boolean {
    return this.isInitialized && this.health.status !== 'unavailable';
  }

  /**
   * Get cached capabilities
   */
  getCachedCapabilities(): AgentCapability[] {
    return [...this.capabilities];
  }

  /**
   * Update health status
   */
  protected updateHealth(health: Partial<ProviderHealth>): void {
    this.health = {
      ...this.health,
      ...health,
      lastCheck: new Date(),
    };

    this.emit('health_updated', this.health);
  }

  /**
   * Emit task events for monitoring
   */
  protected emitTaskEvent(
    eventType: 'task_started' | 'task_completed' | 'task_failed',
    request: TaskRequest,
    response?: TaskResponse,
    error?: Error
  ): void {
    this.emit(eventType, {
      provider: this.providerName,
      request,
      response,
      error,
      timestamp: new Date(),
    });
  }

  /**
   * Calculate capability score for a given task
   */
  protected calculateCapabilityScore(
    capability: AgentCapability,
    taskType: string,
    requirements?: any
  ): number {
    let score = 0;

    // Domain match scoring
    if (capability.domains.includes(taskType)) {
      score += capability.type === 'primary' ? 10 : 
                capability.type === 'secondary' ? 7 : 5;
    }

    // Performance scoring
    if (requirements) {
      if (requirements.speed === 'fast' && capability.performance.speed >= 8) {
        score += 3;
      }
      if (requirements.quality === 'enterprise' && capability.performance.quality >= 9) {
        score += 5;
      }
      if (requirements.cost && capability.performance.cost <= requirements.cost) {
        score += 2;
      }
    }

    // Complexity match
    const complexityMatch = this.matchComplexity(capability.complexity, requirements?.quality);
    score += complexityMatch;

    return Math.min(score, 20); // Cap at 20 points
  }

  /**
   * Match complexity requirements
   */
  private matchComplexity(
    capabilityComplexity: string,
    qualityRequirement?: string
  ): number {
    const complexityScores = {
      simple: { draft: 3, production: 1, enterprise: 0 },
      medium: { draft: 2, production: 3, enterprise: 2 },
      complex: { draft: 1, production: 2, enterprise: 3 },
      enterprise: { draft: 0, production: 1, enterprise: 5 }
    };

    const quality = qualityRequirement || 'production';
    return complexityScores[capabilityComplexity]?.[quality] || 1;
  }

  /**
   * Validate task request format
   */
  protected validateTaskRequest(request: TaskRequest): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!request.id) errors.push('Task ID is required');
    if (!request.type) errors.push('Task type is required');
    if (!request.description) errors.push('Task description is required');

    if (request.requirements) {
      if (request.requirements.creativity !== undefined && 
          (request.requirements.creativity < 0 || request.requirements.creativity > 1)) {
        errors.push('Creativity must be between 0 and 1');
      }
      if (request.requirements.accuracy !== undefined && 
          (request.requirements.accuracy < 0 || request.requirements.accuracy > 1)) {
        errors.push('Accuracy must be between 0 and 1');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Create standardized error response
   */
  protected createErrorResponse(
    request: TaskRequest,
    error: Error,
    duration: number = 0
  ): TaskResponse {
    return {
      id: request.id,
      status: 'failure',
      result: {
        content: '',
        confidence: 0,
        reasoning: `Error: ${error.message}`,
        metadata: {
          error: error.name,
          stack: error.stack
        }
      },
      performance: {
        duration,
        tokensUsed: 0,
        cost: 0,
        model: 'error'
      },
      provider: {
        name: this.providerName,
        version: this.version,
        capabilities: []
      },
      timestamp: new Date()
    };
  }
}

/**
 * Factory function to create adapter instances
 */
export interface AdapterFactory {
  createAdapter(
    providerName: string,
    config: Record<string, any>
  ): Promise<BaseAdapter>;
}

/**
 * Adapter registry for managing multiple providers
 */
export class AdapterRegistry {
  private adapters: Map<string, BaseAdapter> = new Map();
  private factories: Map<string, AdapterFactory> = new Map();

  /**
   * Register an adapter factory
   */
  registerFactory(providerName: string, factory: AdapterFactory): void {
    this.factories.set(providerName, factory);
  }

  /**
   * Create and register an adapter
   */
  async createAdapter(
    providerName: string,
    config: Record<string, any>
  ): Promise<BaseAdapter> {
    const factory = this.factories.get(providerName);
    if (!factory) {
      throw new Error(`No factory registered for provider: ${providerName}`);
    }

    const adapter = await factory.createAdapter(providerName, config);
    this.adapters.set(providerName, adapter);
    return adapter;
  }

  /**
   * Get an adapter by provider name
   */
  getAdapter(providerName: string): BaseAdapter | undefined {
    return this.adapters.get(providerName);
  }

  /**
   * Get all registered adapters
   */
  getAllAdapters(): BaseAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Get all healthy adapters
   */
  getHealthyAdapters(): BaseAdapter[] {
    return this.getAllAdapters().filter(adapter => 
      adapter.isReady() && adapter.getProviderInfo().health.status === 'healthy'
    );
  }

  /**
   * Remove an adapter
   */
  async removeAdapter(providerName: string): Promise<boolean> {
    const adapter = this.adapters.get(providerName);
    if (adapter) {
      await adapter.shutdown();
      return this.adapters.delete(providerName);
    }
    return false;
  }

  /**
   * Shutdown all adapters
   */
  async shutdown(): Promise<void> {
    const shutdownPromises = Array.from(this.adapters.values())
      .map(adapter => adapter.shutdown());
    await Promise.all(shutdownPromises);
    this.adapters.clear();
  }
}

export default BaseAdapter;