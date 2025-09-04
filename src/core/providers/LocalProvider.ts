import axios, { AxiosInstance } from 'axios';
import { BaseProvider, ProviderResponse, ChatCompletionRequest, ProviderConfig } from './BaseProvider';

export class LocalProvider extends BaseProvider {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor(config: ProviderConfig) {
    super('local', config);
    
    if (!config.url) {
      throw new Error('Local LLM URL is required');
    }

    this.baseUrl = config.url;
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: config.timeout || 60000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ProviderResponse> {
    this.validateRequest(request);

    try {
      // Try Ollama format first
      const response = await this.tryOllamaFormat(request);
      if (response) return response;

      // Try OpenAI-compatible format
      const openAIResponse = await this.tryOpenAIFormat(request);
      if (openAIResponse) return openAIResponse;

      throw new Error('No compatible API format found');
    } catch (error: any) {
      this.emit('error', error);
      throw new Error(`Local LLM API error: ${error.message}`);
    }
  }

  async *streamChatCompletion(request: ChatCompletionRequest): AsyncGenerator<Partial<ProviderResponse>> {
    this.validateRequest(request);

    try {
      // Try streaming with Ollama format
      const generator = this.tryOllamaStream(request);
      if (generator) {
        yield* generator;
        return;
      }

      // Fallback to non-streaming
      const response = await this.chatCompletion(request);
      yield response;
      
    } catch (error: any) {
      this.emit('error', error);
      throw new Error(`Local LLM streaming error: ${error.message}`);
    }
  }

  async validateConnection(): Promise<boolean> {
    try {
      // Try Ollama health check
      await this.client.get('/api/tags');
      return true;
    } catch (ollamaError) {
      try {
        // Try OpenAI-compatible health check
        await this.client.get('/v1/models');
        return true;
      } catch (openAIError) {
        return false;
      }
    }
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      // Try Ollama models endpoint
      const response = await this.client.get('/api/tags');
      return response.data.models?.map((model: any) => model.name) || [];
    } catch (ollamaError) {
      try {
        // Try OpenAI-compatible models endpoint
        const response = await this.client.get('/v1/models');
        return response.data.data?.map((model: any) => model.id) || [];
      } catch (openAIError) {
        return [this.config.defaultModel]; // Return default as fallback
      }
    }
  }

  private async tryOllamaFormat(request: ChatCompletionRequest): Promise<ProviderResponse | null> {
    try {
      const prompt = this.convertMessagesToPrompt(request.messages);
      
      const response = await this.client.post('/api/generate', {
        model: this.getModel(request),
        prompt: prompt,
        stream: false,
        options: {
          temperature: this.getTemperature(request),
          num_predict: this.getMaxTokens(request)
        }
      });

      if (response.data.response) {
        return this.createResponse(
          'local-' + Date.now(),
          response.data.response,
          this.getModel(request),
          {
            prompt_tokens: this.estimateTokens(prompt),
            completion_tokens: this.estimateTokens(response.data.response),
            total_tokens: this.estimateTokens(prompt) + this.estimateTokens(response.data.response)
          },
          'stop'
        );
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  private async tryOpenAIFormat(request: ChatCompletionRequest): Promise<ProviderResponse | null> {
    try {
      const response = await this.client.post('/v1/chat/completions', {
        model: this.getModel(request),
        messages: request.messages,
        max_tokens: this.getMaxTokens(request),
        temperature: this.getTemperature(request),
        stream: false
      });

      const choice = response.data.choices?.[0];
      if (choice) {
        return this.createResponse(
          response.data.id || 'local-' + Date.now(),
          choice.message?.content || '',
          response.data.model || this.getModel(request),
          response.data.usage,
          choice.finish_reason || 'stop'
        );
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  private async *tryOllamaStream(request: ChatCompletionRequest): AsyncGenerator<Partial<ProviderResponse>> {
    try {
      const prompt = this.convertMessagesToPrompt(request.messages);
      
      const response = await this.client.post('/api/generate', {
        model: this.getModel(request),
        prompt: prompt,
        stream: true,
        options: {
          temperature: this.getTemperature(request),
          num_predict: this.getMaxTokens(request)
        }
      }, {
        responseType: 'stream'
      });

      let fullContent = '';
      const responseId = 'local-' + Date.now();

      for await (const chunk of response.data) {
        const lines = chunk.toString().split('\n').filter((line: string) => line.trim());
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            
            if (data.response) {
              fullContent += data.response;
              
              yield {
                id: responseId,
                content: data.response,
                model: this.getModel(request),
                timestamp: new Date()
              };
            }

            if (data.done) {
              yield {
                id: responseId,
                content: fullContent,
                model: this.getModel(request),
                finish_reason: 'stop',
                usage: {
                  prompt_tokens: this.estimateTokens(prompt),
                  completion_tokens: this.estimateTokens(fullContent),
                  total_tokens: this.estimateTokens(prompt) + this.estimateTokens(fullContent)
                },
                timestamp: new Date()
              };
              return;
            }
          } catch (parseError) {
            // Skip malformed JSON chunks
          }
        }
      }
    } catch (error) {
      throw error;
    }
  }

  private convertMessagesToPrompt(messages: any[]): string {
    let prompt = '';
    let systemMessage = '';

    for (const message of messages) {
      if (message.role === 'system') {
        systemMessage = message.content;
      } else if (message.role === 'user') {
        prompt += `Human: ${message.content}\n\n`;
      } else if (message.role === 'assistant') {
        prompt += `Assistant: ${message.content}\n\n`;
      }
    }

    if (systemMessage) {
      prompt = `${systemMessage}\n\n${prompt}`;
    }

    prompt += 'Assistant: ';
    return prompt;
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  // Local LLM specific methods
  async pullModel(modelName: string): Promise<void> {
    try {
      const response = await this.client.post('/api/pull', {
        name: modelName
      }, {
        timeout: 300000 // 5 minutes for model download
      });

      if (response.status !== 200) {
        throw new Error(`Failed to pull model: ${modelName}`);
      }
    } catch (error: any) {
      this.emit('error', error);
      throw new Error(`Model pull error: ${error.message}`);
    }
  }

  async deleteModel(modelName: string): Promise<void> {
    try {
      await this.client.delete(`/api/delete`, {
        data: { name: modelName }
      });
    } catch (error: any) {
      this.emit('error', error);
      throw new Error(`Model delete error: ${error.message}`);
    }
  }

  async getModelInfo(modelName: string): Promise<any> {
    try {
      const response = await this.client.post('/api/show', {
        name: modelName
      });

      return response.data;
    } catch (error: any) {
      this.emit('error', error);
      throw new Error(`Model info error: ${error.message}`);
    }
  }
}