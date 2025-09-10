import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { BaseProvider, ProviderResponse, ChatCompletionRequest, ProviderConfig, ProviderMessage } from './BaseProvider.js';

export class GoogleProvider extends BaseProvider {
  private client: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor(config: ProviderConfig) {
    super('google', config);
    
    if (!config.apiKey) {
      throw new Error('Google API key is required');
    }

    this.client = new GoogleGenerativeAI(config.apiKey);
    this.model = this.client.getGenerativeModel({ 
      model: this.getDefaultModel(config.defaultModel)
    });
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ProviderResponse> {
    this.validateRequest(request);

    try {
      const prompt = this.convertMessagesToPrompt(request.messages);
      
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: this.getMaxTokens(request),
          temperature: this.getTemperature(request),
        }
      });

      const response = result.response;
      const content = response.text();

      return this.createResponse(
        'gemini-' + Date.now(),
        content,
        this.config.defaultModel,
        {
          prompt_tokens: this.estimateTokens(prompt),
          completion_tokens: this.estimateTokens(content),
          total_tokens: this.estimateTokens(prompt) + this.estimateTokens(content)
        },
        'stop'
      );

    } catch (error: any) {
      this.emit('error', error);
      throw new Error(`Google Gemini API error: ${error.message}`);
    }
  }

  async *streamChatCompletion(request: ChatCompletionRequest): AsyncGenerator<Partial<ProviderResponse>> {
    this.validateRequest(request);

    try {
      const prompt = this.convertMessagesToPrompt(request.messages);
      
      const result = await this.model.generateContentStream({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: this.getMaxTokens(request),
          temperature: this.getTemperature(request),
        }
      });

      let fullContent = '';
      const responseId = 'gemini-' + Date.now();

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        
        if (chunkText) {
          fullContent += chunkText;
          
          yield {
            id: responseId,
            content: chunkText,
            model: this.config.defaultModel,
            timestamp: new Date()
          };
        }
      }

      // Final response
      yield {
        id: responseId,
        content: fullContent,
        model: this.config.defaultModel,
        finish_reason: 'stop',
        usage: {
          prompt_tokens: this.estimateTokens(prompt),
          completion_tokens: this.estimateTokens(fullContent),
          total_tokens: this.estimateTokens(prompt) + this.estimateTokens(fullContent)
        },
        timestamp: new Date()
      };
      
    } catch (error: any) {
      this.emit('error', error);
      throw new Error(`Google Gemini streaming error: ${error.message}`);
    }
  }

  async validateConnection(): Promise<boolean> {
    try {
      await this.model.generateContent('Hello');
      return true;
    } catch (error) {
      return false;
    }
  }

  async getAvailableModels(): Promise<string[]> {
    // Google doesn't provide a models listing endpoint, return known models
    return [
      'gemini-pro',
      'gemini-pro-vision',
      'gemini-1.5-pro-latest',
      'gemini-1.5-flash-latest'
    ];
  }

  private convertMessagesToPrompt(messages: ProviderMessage[]): string {
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

  private getDefaultModel(model: string): string {
    // Map common model names to Google's naming
    const modelMap: Record<string, string> = {
      'gemini-pro': 'gemini-1.5-pro-latest',
      'gemini-flash': 'gemini-1.5-flash-latest',
      'gemini-vision': 'gemini-pro-vision'
    };

    return modelMap[model] || model || 'gemini-1.5-pro-latest';
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  // Google-specific methods
  async generateWithVision(imageData: string, prompt: string): Promise<string> {
    try {
      const visionModel = this.client.getGenerativeModel({ model: 'gemini-pro-vision' });
      
      const result = await visionModel.generateContent([
        prompt,
        {
          inlineData: {
            data: imageData,
            mimeType: 'image/jpeg'
          }
        }
      ]);

      return result.response.text();
    } catch (error: any) {
      this.emit('error', error);
      throw new Error(`Google Vision error: ${error.message}`);
    }
  }

  async embedContent(content: string): Promise<number[]> {
    try {
      const embeddingModel = this.client.getGenerativeModel({ model: 'embedding-001' });
      
      const result = await embeddingModel.embedContent(content);
      return result.embedding.values || [];
    } catch (error: any) {
      this.emit('error', error);
      throw new Error(`Google embedding error: ${error.message}`);
    }
  }

  async generateStructuredOutput(prompt: string, schema: any): Promise<any> {
    const structuredPrompt = `
${prompt}

Please respond with a JSON object that matches this schema:
${JSON.stringify(schema, null, 2)}

Ensure your response is valid JSON only, no additional text.
`;

    const response = await this.chatCompletion({
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that always responds with valid JSON according to the requested schema.'
        },
        {
          role: 'user',
          content: structuredPrompt
        }
      ],
      temperature: 0.1
    });

    try {
      return JSON.parse(response.content);
    } catch (error) {
      throw new Error('Failed to parse structured output as JSON');
    }
  }
}