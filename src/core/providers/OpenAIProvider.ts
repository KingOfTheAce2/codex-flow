import OpenAI from 'openai';
import { BaseProvider, ProviderResponse, ChatCompletionRequest, ProviderConfig } from './BaseProvider';

export class OpenAIProvider extends BaseProvider {
  private client: OpenAI;

  constructor(config: ProviderConfig) {
    super('openai', config);
    
    if (!config.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.client = new OpenAI({
      apiKey: config.apiKey,
      timeout: config.timeout || 30000
    });
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ProviderResponse> {
    this.validateRequest(request);

    try {
      const response = await this.client.chat.completions.create({
        model: this.getModel(request),
        messages: request.messages as any,
        max_tokens: this.getMaxTokens(request),
        temperature: this.getTemperature(request),
        tools: request.tools,
        tool_choice: request.toolChoice as any,
        stream: false
      });

      const choice = response.choices[0];
      if (!choice) {
        throw new Error('No response choices returned from OpenAI');
      }

      return this.createResponse(
        response.id,
        choice.message?.content || '',
        response.model,
        response.usage,
        choice.finish_reason || 'stop'
      );

    } catch (error: any) {
      this.emit('error', error);
      throw new Error(`OpenAI API error: ${error.message}`);
    }
  }

  async *streamChatCompletion(request: ChatCompletionRequest): AsyncGenerator<Partial<ProviderResponse>> {
    this.validateRequest(request);

    try {
      const stream = await this.client.chat.completions.create({
        model: this.getModel(request),
        messages: request.messages as any,
        max_tokens: this.getMaxTokens(request),
        temperature: this.getTemperature(request),
        tools: request.tools,
        tool_choice: request.toolChoice as any,
        stream: true
      });

      let fullContent = '';
      let responseId = '';
      let responseModel = '';

      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (!choice) continue;

        responseId = chunk.id;
        responseModel = chunk.model;

        if (choice.delta?.content) {
          fullContent += choice.delta.content;
          
          yield {
            id: responseId,
            content: choice.delta.content,
            model: responseModel,
            timestamp: new Date()
          };
        }

        if (choice.finish_reason) {
          yield {
            id: responseId,
            content: fullContent,
            model: responseModel,
            finish_reason: choice.finish_reason as any,
            timestamp: new Date()
          };
          break;
        }
      }
      
    } catch (error: any) {
      this.emit('error', error);
      throw new Error(`OpenAI streaming error: ${error.message}`);
    }
  }

  async validateConnection(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch (error) {
      return false;
    }
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await this.client.models.list();
      return response.data
        .filter(model => model.id.includes('gpt') || model.id.includes('text-davinci') || model.id.includes('code-davinci'))
        .map(model => model.id)
        .sort();
    } catch (error: any) {
      this.emit('error', error);
      throw new Error(`Failed to get OpenAI models: ${error.message}`);
    }
  }

  // OpenAI-specific methods
  async createEmbedding(input: string | string[], model: string = 'text-embedding-ada-002'): Promise<number[][]> {
    try {
      const response = await this.client.embeddings.create({
        model,
        input: Array.isArray(input) ? input : [input]
      });

      return response.data.map(item => item.embedding);
    } catch (error: any) {
      this.emit('error', error);
      throw new Error(`OpenAI embedding error: ${error.message}`);
    }
  }

  async generateCode(prompt: string, language: string = 'javascript'): Promise<string> {
    const codePrompt = `Write ${language} code for the following requirement:\n\n${prompt}\n\nCode:`;
    
    const response = await this.chatCompletion({
      messages: [
        {
          role: 'system',
          content: `You are an expert ${language} developer. Write clean, well-commented code that follows best practices.`
        },
        {
          role: 'user',
          content: codePrompt
        }
      ],
      temperature: 0.2
    });

    return response.content;
  }

  async reviewCode(code: string, language: string = 'javascript'): Promise<string> {
    const response = await this.chatCompletion({
      messages: [
        {
          role: 'system',
          content: `You are an expert ${language} code reviewer. Analyze the code for bugs, security issues, performance problems, and best practices. Provide specific, actionable feedback.`
        },
        {
          role: 'user',
          content: `Please review this ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\``
        }
      ],
      temperature: 0.3
    });

    return response.content;
  }
}