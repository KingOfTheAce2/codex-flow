/**
 * LLM-to-MCP Bridge
 * 
 * Handles tool calls between different LLM providers (OpenAI, Anthropic, Gemini) 
 * and MCP tools, providing unified tool execution across all providers
 */

import { MCPToolRegistry, ToolResult } from './tool-adapter';
import winston from 'winston';

// OpenAI tool call interfaces
export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface OpenAIToolMessage {
  role: 'tool';
  tool_call_id: string;
  content: string;
}

// Anthropic tool call interfaces
export interface AnthropicToolUse {
  type: 'tool_use';
  id: string;
  name: string;
  input: any;
}

export interface AnthropicToolResult {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

// Gemini tool call interfaces
export interface GeminiFunctionCall {
  name: string;
  args: any;
}

export interface GeminiFunctionResponse {
  name: string;
  response: {
    name: string;
    content: any;
  };
}

/**
 * Universal tool call bridge for all LLM providers
 */
export class LLMToolBridge {
  private toolRegistry: MCPToolRegistry;
  private logger: winston.Logger;

  constructor(toolRegistry: MCPToolRegistry) {
    this.toolRegistry = toolRegistry;
    
    this.logger = winston.createLogger({
      level: 'debug',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [LLMToolBridge] ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        })
      ),
      transports: [
        new winston.transports.Console({ silent: process.env.NODE_ENV === 'test' })
      ]
    });
  }

  /**
   * Process OpenAI tool calls and return tool messages
   */
  async processOpenAIToolCalls(toolCalls: OpenAIToolCall[]): Promise<OpenAIToolMessage[]> {
    this.logger.debug('Processing OpenAI tool calls', { count: toolCalls.length });
    
    const toolMessages: OpenAIToolMessage[] = [];

    for (const toolCall of toolCalls) {
      try {
        // Parse arguments
        let args: any;
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch (error) {
          this.logger.error('Failed to parse tool arguments', { 
            toolCallId: toolCall.id,
            arguments: toolCall.function.arguments,
            error: (error as Error).message
          });
          
          toolMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: `Error: Failed to parse tool arguments - ${(error as Error).message}`
          });
          continue;
        }

        // Execute tool
        const result = await this.toolRegistry.executeTool(toolCall.function.name, args);
        
        toolMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: this.formatResultForOpenAI(result)
        });

      } catch (error) {
        this.logger.error('Error processing OpenAI tool call', { 
          toolCallId: toolCall.id,
          error: (error as Error).message
        });
        
        toolMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: `Error: ${(error as Error).message}`
        });
      }
    }

    return toolMessages;
  }

  /**
   * Process Anthropic tool use blocks and return tool result blocks
   */
  async processAnthropicToolUse(toolUseBlocks: AnthropicToolUse[]): Promise<AnthropicToolResult[]> {
    this.logger.debug('Processing Anthropic tool use blocks', { count: toolUseBlocks.length });
    
    const toolResults: AnthropicToolResult[] = [];

    for (const toolUse of toolUseBlocks) {
      try {
        // Execute tool
        const result = await this.toolRegistry.executeTool(toolUse.name, toolUse.input);
        
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: this.formatResultForAnthropic(result),
          is_error: !result.success
        });

      } catch (error) {
        this.logger.error('Error processing Anthropic tool use', { 
          toolUseId: toolUse.id,
          error: (error as Error).message
        });
        
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: `Error: ${(error as Error).message}`,
          is_error: true
        });
      }
    }

    return toolResults;
  }

  /**
   * Process Gemini function calls and return function responses
   */
  async processGeminiFunctionCalls(functionCalls: GeminiFunctionCall[]): Promise<GeminiFunctionResponse[]> {
    this.logger.debug('Processing Gemini function calls', { count: functionCalls.length });
    
    const functionResponses: GeminiFunctionResponse[] = [];

    for (const functionCall of functionCalls) {
      try {
        // Execute tool
        const result = await this.toolRegistry.executeTool(functionCall.name, functionCall.args);
        
        functionResponses.push({
          name: functionCall.name,
          response: {
            name: functionCall.name,
            content: this.formatResultForGemini(result)
          }
        });

      } catch (error) {
        this.logger.error('Error processing Gemini function call', { 
          functionName: functionCall.name,
          error: (error as Error).message
        });
        
        functionResponses.push({
          name: functionCall.name,
          response: {
            name: functionCall.name,
            content: { error: (error as Error).message }
          }
        });
      }
    }

    return functionResponses;
  }

  /**
   * Get available tools for OpenAI
   */
  getOpenAITools(): any[] {
    return this.toolRegistry.getToolsForProvider('openai');
  }

  /**
   * Get available tools for Anthropic
   */
  getAnthropicTools(): any[] {
    return this.toolRegistry.getToolsForProvider('anthropic');
  }

  /**
   * Get available tools for Gemini
   */
  getGeminiTools(): any[] {
    return this.toolRegistry.getToolsForProvider('gemini');
  }

  /**
   * Check if a tool is available
   */
  isToolAvailable(toolName: string): boolean {
    return this.toolRegistry.getAvailableToolNames().includes(toolName);
  }

  /**
   * Get tool statistics
   */
  getToolStats() {
    return this.toolRegistry.getStats();
  }

  /**
   * Format tool result for OpenAI
   */
  private formatResultForOpenAI(result: ToolResult): string {
    if (!result.success) {
      return `Error: ${result.error}`;
    }

    if (typeof result.result === 'string') {
      return result.result;
    }

    return JSON.stringify(result.result, null, 2);
  }

  /**
   * Format tool result for Anthropic
   */
  private formatResultForAnthropic(result: ToolResult): string {
    if (!result.success) {
      return `Error: ${result.error}`;
    }

    if (typeof result.result === 'string') {
      return result.result;
    }

    return JSON.stringify(result.result, null, 2);
  }

  /**
   * Format tool result for Gemini
   */
  private formatResultForGemini(result: ToolResult): any {
    if (!result.success) {
      return { error: result.error };
    }

    return result.result;
  }

  /**
   * Refresh tool registry (should be called when MCP servers connect/disconnect)
   */
  refreshTools(): void {
    this.toolRegistry.refreshTools();
    this.logger.info('Refreshed tool registry');
  }
}

/**
 * Provider-specific tool execution handlers
 */
export class ProviderToolHandler {
  private bridge: LLMToolBridge;
  private logger: winston.Logger;

  constructor(bridge: LLMToolBridge) {
    this.bridge = bridge;
    
    this.logger = winston.createLogger({
      level: 'debug',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [ProviderToolHandler] ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        })
      ),
      transports: [
        new winston.transports.Console({ silent: process.env.NODE_ENV === 'test' })
      ]
    });
  }

  /**
   * Handle OpenAI chat completion with tools
   */
  async handleOpenAICompletion(
    messages: any[],
    openaiClient: any,
    options: {
      model: string;
      temperature?: number;
      maxTokens?: number;
      tools?: any[];
      toolChoice?: any;
    } = { model: 'gpt-4' }
  ): Promise<any> {
    // Add available tools to options if not provided
    if (!options.tools) {
      options.tools = this.bridge.getOpenAITools();
    }

    // Make initial completion request
    let completion = await openaiClient.chat.completions.create({
      model: options.model,
      messages,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      tools: options.tools,
      tool_choice: options.toolChoice
    });

    let responseMessage = completion.choices[0].message;
    let allMessages = [...messages, responseMessage];

    // Handle tool calls
    while (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      this.logger.debug('Processing tool calls in OpenAI completion', { 
        toolCallCount: responseMessage.tool_calls.length 
      });

      // Execute tool calls
      const toolMessages = await this.bridge.processOpenAIToolCalls(responseMessage.tool_calls);
      allMessages.push(...toolMessages);

      // Get next completion
      completion = await openaiClient.chat.completions.create({
        model: options.model,
        messages: allMessages,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        tools: options.tools
      });

      responseMessage = completion.choices[0].message;
      allMessages.push(responseMessage);
    }

    return {
      completion,
      messages: allMessages,
      toolCallsProcessed: allMessages.filter(m => m.role === 'tool').length > 0
    };
  }

  /**
   * Handle Anthropic message with tools
   */
  async handleAnthropicMessage(
    messages: any[],
    anthropicClient: any,
    options: {
      model: string;
      maxTokens: number;
      temperature?: number;
      tools?: any[];
    } = { model: 'claude-3-5-sonnet-20241022', maxTokens: 4096 }
  ): Promise<any> {
    // Add available tools to options if not provided
    if (!options.tools) {
      options.tools = this.bridge.getAnthropicTools();
    }

    // Make initial message request
    let message = await anthropicClient.messages.create({
      model: options.model,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      messages,
      tools: options.tools
    });

    let allMessages = [...messages];
    let currentMessage = message;

    // Handle tool use
    while (currentMessage.content && currentMessage.content.some((block: any) => block.type === 'tool_use')) {
      const toolUseBlocks = currentMessage.content.filter((block: any) => block.type === 'tool_use');
      
      this.logger.debug('Processing tool use in Anthropic message', { 
        toolUseCount: toolUseBlocks.length 
      });

      // Add assistant message with tool use
      allMessages.push({
        role: 'assistant',
        content: currentMessage.content
      });

      // Execute tool calls
      const toolResults = await this.bridge.processAnthropicToolUse(toolUseBlocks);
      
      // Add tool result message
      allMessages.push({
        role: 'user',
        content: toolResults
      });

      // Get next message
      currentMessage = await anthropicClient.messages.create({
        model: options.model,
        max_tokens: options.maxTokens,
        temperature: options.temperature,
        messages: allMessages,
        tools: options.tools
      });
    }

    return {
      message: currentMessage,
      messages: allMessages,
      toolCallsProcessed: allMessages.some(m => 
        Array.isArray(m.content) && m.content.some((block: any) => block.type === 'tool_result')
      )
    };
  }

  /**
   * Handle Gemini generate content with function calling
   */
  async handleGeminiGeneration(
    prompt: string,
    geminiModel: any,
    options: {
      temperature?: number;
      maxOutputTokens?: number;
      tools?: any[];
    } = {}
  ): Promise<any> {
    // Add available tools to options if not provided
    if (!options.tools) {
      options.tools = this.bridge.getGeminiTools();
    }

    const generationConfig = {
      temperature: options.temperature,
      maxOutputTokens: options.maxOutputTokens
    };

    // Make initial generation request
    let result = await geminiModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      tools: options.tools ? [{ functionDeclarations: options.tools }] : undefined,
      generationConfig
    });

    let response = result.response;
    let conversationHistory = [
      { role: 'user', parts: [{ text: prompt }] },
      { role: 'model', parts: response.candidates?.[0]?.content?.parts || [] }
    ];

    // Handle function calls
    while (response.candidates?.[0]?.content?.parts?.some((part: any) => part.functionCall)) {
      const functionCalls = response.candidates[0].content.parts
        .filter((part: any) => part.functionCall)
        .map((part: any) => ({
          name: part.functionCall.name,
          args: part.functionCall.args
        }));

      this.logger.debug('Processing function calls in Gemini generation', { 
        functionCallCount: functionCalls.length 
      });

      // Execute function calls
      const functionResponses = await this.bridge.processGeminiFunctionCalls(functionCalls);

      // Add function responses to conversation
      conversationHistory.push({
        role: 'function',
        parts: functionResponses.map(fr => ({ functionResponse: fr }))
      });

      // Get next generation
      result = await geminiModel.generateContent({
        contents: conversationHistory,
        tools: options.tools ? [{ functionDeclarations: options.tools }] : undefined,
        generationConfig
      });

      response = result.response;
      conversationHistory.push({
        role: 'model',
        parts: response.candidates?.[0]?.content?.parts || []
      });
    }

    return {
      result,
      response,
      conversationHistory,
      toolCallsProcessed: conversationHistory.some(entry => entry.role === 'function')
    };
  }
}

export default LLMToolBridge;