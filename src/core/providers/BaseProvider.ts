import { EventEmitter } from 'events';

export interface ProviderMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  name?: string;
}

export interface ProviderResponse {
  id: string;
  content: string;
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  timestamp: Date;
}

export interface ProviderConfig {
  apiKey?: string;
  url?: string;
  defaultModel: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

export interface ChatCompletionRequest {
  messages: ProviderMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  tools?: any[];
  toolChoice?: string;
}

export abstract class BaseProvider extends EventEmitter {
  protected config: ProviderConfig;
  protected name: string;

  constructor(name: string, config: ProviderConfig) {
    super();
    this.name = name;
    this.config = config;
  }

  abstract chatCompletion(request: ChatCompletionRequest): Promise<ProviderResponse>;
  abstract streamChatCompletion(request: ChatCompletionRequest): AsyncGenerator<Partial<ProviderResponse>>;
  abstract validateConnection(): Promise<boolean>;
  abstract getAvailableModels(): Promise<string[]>;

  getName(): string {
    return this.name;
  }

  getConfig(): ProviderConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<ProviderConfig>): void {
    this.config = { ...this.config, ...updates };
    this.emit('config-updated', this.config);
  }

  protected createResponse(
    id: string,
    content: string,
    model: string,
    usage: any = {},
    finishReason: string = 'stop'
  ): ProviderResponse {
    return {
      id,
      content,
      model,
      usage: {
        prompt_tokens: usage.prompt_tokens || 0,
        completion_tokens: usage.completion_tokens || 0,
        total_tokens: usage.total_tokens || 0
      },
      finish_reason: finishReason as any,
      timestamp: new Date()
    };
  }

  protected validateRequest(request: ChatCompletionRequest): void {
    if (!request.messages || !Array.isArray(request.messages) || request.messages.length === 0) {
      throw new Error('Messages array is required and cannot be empty');
    }

    for (const message of request.messages) {
      if (!message.role || !['system', 'user', 'assistant'].includes(message.role)) {
        throw new Error(`Invalid message role: ${message.role}`);
      }
      if (!message.content || typeof message.content !== 'string') {
        throw new Error('Message content is required and must be a string');
      }
    }
  }

  protected getModel(request: ChatCompletionRequest): string {
    return request.model || this.config.defaultModel;
  }

  protected getMaxTokens(request: ChatCompletionRequest): number {
    return request.maxTokens || this.config.maxTokens || 4000;
  }

  protected getTemperature(request: ChatCompletionRequest): number {
    return request.temperature !== undefined ? request.temperature : (this.config.temperature || 0.7);
  }
}