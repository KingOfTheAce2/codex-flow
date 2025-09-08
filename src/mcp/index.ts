/**
 * MCP (Model Context Protocol) Integration Module
 * 
 * Provides complete MCP integration for codex-flow including:
 * - MCP client and server registry
 * - Tool adapters and LLM bridges
 * - Enhanced agents with MCP support
 */

export { MCPClient, MCPClientManager } from './client.js';
export { MCPRegistry } from './registry.js';
export { MCPToolAdapter, MCPToolRegistry } from './tool-adapter.js';
export { LLMToolBridge, ProviderToolHandler } from './llm-bridge.js';
export { MCPEnhancedAgent } from './mcp-enhanced-agent.js';

export type {
  MCPServerConfig,
  MCPTool,
  MCPResource,
  MCPPrompt,
  MCPToolCall,
  MCPToolResult
} from './client.js';

export type {
  MCPRegistryConfig,
  ExtendedMCPServerConfig,
  MCPServerStatus
} from './registry.js';

export type {
  ToolCall,
  ToolResult
} from './tool-adapter.js';

export type {
  OpenAIToolCall,
  OpenAIToolMessage,
  AnthropicToolUse,
  AnthropicToolResult,
  GeminiFunctionCall,
  GeminiFunctionResponse
} from './llm-bridge.js';

export type {
  MCPAgentConfig,
  MCPAgentContext
} from './mcp-enhanced-agent.js';

/**
 * Initialize MCP system with default configuration
 */
export async function initializeMCP(configPath?: string) {
  const { MCPRegistry } = await import('./registry.js');
  const { MCPToolRegistry } = await import('./tool-adapter.js');
  
  const registry = new MCPRegistry(configPath);
  await registry.loadConfig();
  
  const toolRegistry = new MCPToolRegistry(registry);
  
  return {
    registry,
    toolRegistry
  };
}