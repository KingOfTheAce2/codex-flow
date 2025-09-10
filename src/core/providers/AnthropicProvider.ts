import Anthropic from '@anthropic-ai/sdk';
import { BaseProvider, ProviderResponse, ChatCompletionRequest, ProviderConfig, ProviderMessage } from './BaseProvider.js';

export class AnthropicProvider extends BaseProvider {
  private client: Anthropic;

  constructor(config: ProviderConfig) {
    super('anthropic', config);
    
    if (!config.apiKey) {
      throw new Error('Anthropic API key is required');
    }

    this.client = new Anthropic({
      apiKey: config.apiKey,
      timeout: config.timeout || 30000
    });
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ProviderResponse> {
    this.validateRequest(request);

    try {
      // Convert messages to Anthropic format
      const { messages, system } = this.convertMessages(request.messages);

      const response = await this.client.messages.create({
        model: this.getModel(request),
        messages: messages as any,
        system: system,
        max_tokens: this.getMaxTokens(request),
        temperature: this.getTemperature(request),
        tools: request.tools as any,
        tool_choice: request.toolChoice as any
      });

      const content = response.content
        .filter(item => item.type === 'text')
        .map(item => (item as any).text)
        .join('');

      return this.createResponse(
        response.id,
        content,
        response.model,
        response.usage,
        response.stop_reason || 'stop'
      );

    } catch (error: any) {
      this.emit('error', error);
      throw new Error(`Anthropic API error: ${error.message}`);
    }
  }

  async *streamChatCompletion(request: ChatCompletionRequest): AsyncGenerator<Partial<ProviderResponse>> {
    this.validateRequest(request);

    try {
      const { messages, system } = this.convertMessages(request.messages);

      const stream = this.client.messages.stream({
        model: this.getModel(request),
        messages: messages as any,
        system: system,
        max_tokens: this.getMaxTokens(request),
        temperature: this.getTemperature(request),
        tools: request.tools as any,
        tool_choice: request.toolChoice as any
      });

      let fullContent = '';
      let responseId = '';
      let responseModel = '';

      for await (const chunk of stream) {
        if (chunk.type === 'message_start') {
          responseId = chunk.message.id;
          responseModel = chunk.message.model;
        } else if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          fullContent += chunk.delta.text;
          
          yield {
            id: responseId,
            content: chunk.delta.text,
            model: responseModel,
            timestamp: new Date()
          };
        } else if (chunk.type === 'message_delta' && chunk.delta.stop_reason) {
          yield {
            id: responseId,
            content: fullContent,
            model: responseModel,
            finish_reason: chunk.delta.stop_reason as any,
            timestamp: new Date()
          };
          break;
        }
      }
      
    } catch (error: any) {
      this.emit('error', error);
      throw new Error(`Anthropic streaming error: ${error.message}`);
    }
  }

  async validateConnection(): Promise<boolean> {
    try {
      // Test with a minimal message
      await this.client.messages.create({
        model: this.config.defaultModel,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 1
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  async getAvailableModels(): Promise<string[]> {
    // Anthropic doesn't provide a models endpoint, so we return known models
    return [
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
      'claude-2.1',
      'claude-2.0',
      'claude-instant-1.2'
    ];
  }

  private convertMessages(messages: ProviderMessage[]): { messages: any[], system?: string } {
    let system: string | undefined;
    const convertedMessages: any[] = [];

    for (const message of messages) {
      if (message.role === 'system') {
        // Anthropic uses system parameter instead of system messages
        if (system) {
          system += '\n\n' + message.content;
        } else {
          system = message.content;
        }
      } else {
        convertedMessages.push({
          role: message.role,
          content: message.content
        });
      }
    }

    return { messages: convertedMessages, system };
  }

  // Anthropic-specific methods
  async analyzeCode(code: string, language: string = 'javascript'): Promise<string> {
    const response = await this.chatCompletion({
      messages: [
        {
          role: 'system',
          content: `You are Claude, an AI assistant created by Anthropic. You are an expert at analyzing code and providing detailed insights about its structure, functionality, and potential improvements.`
        },
        {
          role: 'user',
          content: `Please analyze this ${language} code and provide insights about its functionality, structure, and any potential improvements:\n\n\`\`\`${language}\n${code}\n\`\`\``
        }
      ],
      temperature: 0.3
    });

    return response.content;
  }

  async explainConcept(concept: string, context?: string): Promise<string> {
    const contextPrompt = context ? `\n\nContext: ${context}` : '';
    
    const response = await this.chatCompletion({
      messages: [
        {
          role: 'system',
          content: 'You are Claude, an AI assistant created by Anthropic. You excel at explaining complex concepts clearly and thoroughly.'
        },
        {
          role: 'user',
          content: `Please explain the concept of "${concept}" in detail.${contextPrompt}`
        }
      ],
      temperature: 0.4
    });

    return response.content;
  }

  async generateDocumentation(code: string, language: string = 'javascript'): Promise<string> {
    const response = await this.chatCompletion({
      messages: [
        {
          role: 'system',
          content: `You are Claude, an AI assistant created by Anthropic. You are expert at creating comprehensive, clear documentation for code.`
        },
        {
          role: 'user',
          content: `Please generate comprehensive documentation for this ${language} code, including function descriptions, parameter explanations, return values, and usage examples:\n\n\`\`\`${language}\n${code}\n\`\`\``
        }
      ],
      temperature: 0.2
    });

    return response.content;
  }
}