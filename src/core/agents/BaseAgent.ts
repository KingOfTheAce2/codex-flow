import { EventEmitter } from 'events';
import { ProviderManager } from '../providers/ProviderManager.js';
import { ChatCompletionRequest, ProviderResponse } from '../providers/BaseProvider.js';

export interface AgentConfig {
  id: string;
  name: string;
  type: string;
  role: string;
  provider: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  capabilities?: string[];
  metadata?: Record<string, any>;
}

export interface Task {
  id: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  assignedAgent?: string;
  swarmId?: string;
  dependencies: string[];
  result?: string;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface AgentContext {
  conversationHistory: Array<{ role: string; content: string; timestamp: Date }>;
  currentTask?: Task;
  availableTools: string[];
  memory: Map<string, any>;
  swarmContext?: {
    swarmId: string;
    otherAgents: string[];
    sharedMemory: Map<string, any>;
  };
}

export abstract class BaseAgent extends EventEmitter {
  protected config: AgentConfig;
  protected providerManager: ProviderManager;
  protected context: AgentContext;
  protected isActive: boolean = false;
  protected currentTaskId?: string;

  constructor(config: AgentConfig, providerManager: ProviderManager) {
    super();
    this.config = config;
    this.providerManager = providerManager;
    this.context = {
      conversationHistory: [],
      availableTools: [],
      memory: new Map(),
    };

    // Set up provider manager event handlers
    this.providerManager.on('provider-error', this.handleProviderError.bind(this));
  }

  // Abstract methods to be implemented by specific agent types
  abstract processTask(task: Task): Promise<string>;
  abstract generateResponse(prompt: string, context?: any): Promise<string>;
  abstract getSystemPrompt(): string;

  // Core agent functionality
  async executeTask(task: Task): Promise<string> {
    try {
      this.isActive = true;
      this.currentTaskId = task.id;
      this.context.currentTask = task;

      this.emit('task-started', { agent: this.config.id, task: task.id });
      
      // Add task context to conversation history
      this.addToHistory('system', `Starting task: ${task.description}`);

      const result = await this.processTask(task);

      this.addToHistory('assistant', result);
      this.emit('task-completed', { agent: this.config.id, task: task.id, result });

      return result;

    } catch (error: any) {
      this.emit('task-failed', { agent: this.config.id, task: task.id, error: error.message });
      throw error;
    } finally {
      this.isActive = false;
      this.currentTaskId = undefined;
      this.context.currentTask = undefined;
    }
  }

  async sendMessage(message: string, recipient?: string): Promise<void> {
    this.addToHistory('user', message);
    
    if (recipient) {
      this.emit('message-sent', {
        from: this.config.id,
        to: recipient,
        message,
        timestamp: new Date()
      });
    } else {
      // Broadcast to swarm
      this.emit('broadcast-message', {
        from: this.config.id,
        message,
        timestamp: new Date()
      });
    }
  }

  async receiveMessage(message: string, sender: string): Promise<string | null> {
    this.addToHistory('user', `Message from ${sender}: ${message}`);

    // Process the message and generate response if needed
    if (this.shouldRespond(message, sender)) {
      const response = await this.generateResponse(message, { sender });
      this.addToHistory('assistant', response);
      return response;
    }

    return null;
  }

  protected async callProvider(request: Omit<ChatCompletionRequest, 'messages'>, additionalMessages: any[] = []): Promise<ProviderResponse> {
    const systemPrompt = this.getSystemPrompt();
    
    const messages = [
      { role: 'system', content: systemPrompt },
      ...this.context.conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      ...additionalMessages
    ];

    return await this.providerManager.chatCompletion({
      messages,
      model: this.config.model,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      ...request
    }, this.config.provider);
  }

  protected addToHistory(role: string, content: string): void {
    this.context.conversationHistory.push({
      role,
      content,
      timestamp: new Date()
    });

    // Keep conversation history manageable
    if (this.context.conversationHistory.length > 100) {
      this.context.conversationHistory = this.context.conversationHistory.slice(-50);
    }
  }

  protected shouldRespond(message: string, sender: string): boolean {
    // Default implementation - can be overridden
    // Respond if directly addressed or if it's a question
    return message.toLowerCase().includes(this.config.name.toLowerCase()) ||
           message.includes('?') ||
           message.toLowerCase().includes('help');
  }

  protected handleProviderError(event: { provider: string; error: any }): void {
    if (event.provider === this.config.provider) {
      this.emit('provider-error', event.error);
    }
  }

  // Public API methods
  getId(): string {
    return this.config.id;
  }

  getName(): string {
    return this.config.name;
  }

  getType(): string {
    return this.config.type;
  }

  getRole(): string {
    return this.config.role;
  }

  getConfig(): AgentConfig {
    return { ...this.config };
  }

  isCurrentlyActive(): boolean {
    return this.isActive;
  }

  getCurrentTaskId(): string | undefined {
    return this.currentTaskId;
  }

  getConversationHistory(): Array<{ role: string; content: string; timestamp: Date }> {
    return [...this.context.conversationHistory];
  }

  clearHistory(): void {
    this.context.conversationHistory = [];
  }

  setMemory(key: string, value: any): void {
    this.context.memory.set(key, value);
  }

  getMemory(key: string): any {
    return this.context.memory.get(key);
  }

  clearMemory(): void {
    this.context.memory.clear();
  }

  updateConfig(updates: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...updates };
    this.emit('config-updated', this.config);
  }

  setSwarmContext(context: AgentContext['swarmContext']): void {
    this.context.swarmContext = context;
  }

  getStats(): {
    id: string;
    name: string;
    type: string;
    isActive: boolean;
    currentTask?: string;
    conversationLength: number;
    memorySize: number;
  } {
    return {
      id: this.config.id,
      name: this.config.name,
      type: this.config.type,
      isActive: this.isActive,
      currentTask: this.currentTaskId,
      conversationLength: this.context.conversationHistory.length,
      memorySize: this.context.memory.size
    };
  }
}