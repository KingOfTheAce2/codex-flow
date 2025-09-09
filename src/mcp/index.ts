/**
 * MCP (Model Context Protocol) Integration Module
 * 
 * Provides complete MCP integration for codex-flow including:
 * - MCP client and server registry
 * - Tool adapters and LLM bridges
 * - Enhanced agents with MCP support
 */

export { MCPClient, MCPClientManager } from './client';
export { MCPRegistry } from './registry';
export { MCPToolAdapter, MCPToolRegistry } from './tool-adapter';
export { LLMToolBridge, ProviderToolHandler } from './llm-bridge';
export { MCPEnhancedAgent } from './mcp-enhanced-agent';

export type {
  MCPServerConfig,
  MCPTool,
  MCPResource,
  MCPPrompt,
  MCPToolCall,
  MCPToolResult
} from './client';

export type {
  MCPRegistryConfig,
  ExtendedMCPServerConfig,
  MCPServerStatus
} from './registry';

export type {
  ToolCall,
  ToolResult
} from './tool-adapter';

export type {
  OpenAIToolCall,
  OpenAIToolMessage,
  AnthropicToolUse,
  AnthropicToolResult,
  GeminiFunctionCall,
  GeminiFunctionResponse
} from './llm-bridge';

export type {
  MCPAgentConfig,
  MCPAgentContext
} from './mcp-enhanced-agent';

/**
 * Initialize MCP system with default configuration
 */
export async function initializeMCP(configPath?: string) {
  const { MCPRegistry } = await import('./registry');
  const { MCPToolRegistry } = await import('./tool-adapter');
  
  const registry = new MCPRegistry(configPath);
  await registry.loadConfig();
  
  const toolRegistry = new MCPToolRegistry(registry);
  
  return {
    registry,
    toolRegistry
  };
}