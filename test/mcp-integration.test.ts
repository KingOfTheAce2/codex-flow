/**
 * MCP Integration Test
 * 
 * Tests the complete MCP integration flow
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { MCPRegistry } from '../src/mcp/registry';
import { MCPToolRegistry } from '../src/mcp/tool-adapter';
import { LLMToolBridge } from '../src/mcp/llm-bridge';
import { MCPSwarmManager } from '../src/mcp/mcp-swarm-manager';
import { MemoryManager } from '../src/core/memory/MemoryManager';
import { ProviderManager } from '../src/core/providers/ProviderManager';
import fs from 'fs/promises';
import path from 'path';

describe('MCP Integration', () => {
  let mcpRegistry: MCPRegistry;
  let toolRegistry: MCPToolRegistry;
  let toolBridge: LLMToolBridge;
  let testConfigPath: string;

  beforeAll(async () => {
    // Create test configuration
    testConfigPath = path.join(__dirname, '.test-mcp.json');
    const testConfig = {
      mcpServers: {
        'test-calculator': {
          id: 'test-calculator',
          command: 'node',
          args: [path.resolve(__dirname, '../src/mcp/test-server.js')],
          description: 'Test calculator server',
          enabled: true,
          autoStart: true,
          timeout: 5000,
          maxRetries: 2
        }
      },
      globalSettings: {
        autoConnectOnStart: true,
        healthCheckInterval: 10000,
        maxConcurrentConnections: 5,
        retryBackoffMs: 500
      }
    };

    await fs.writeFile(testConfigPath, JSON.stringify(testConfig, null, 2));

    // Initialize MCP components
    mcpRegistry = new MCPRegistry(testConfigPath);
    await mcpRegistry.loadConfig();
    
    toolRegistry = new MCPToolRegistry(mcpRegistry);
    toolBridge = new LLMToolBridge(toolRegistry);
  });

  afterAll(async () => {
    // Cleanup
    await mcpRegistry.disconnectAll();
    
    try {
      await fs.unlink(testConfigPath);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('should load MCP configuration', () => {
    const config = mcpRegistry.getConfig();
    expect(config.mcpServers).toHaveProperty('test-calculator');
    expect(config.mcpServers['test-calculator'].enabled).toBe(true);
  });

  test('should add and remove MCP server', async () => {
    await mcpRegistry.addServer({
      id: 'test-server-2',
      command: 'echo',
      args: ['test'],
      description: 'Test server 2',
      enabled: false,
      autoStart: false,
      timeout: 5000,
      maxRetries: 1,
      tags: ['test']
    });

    const config = mcpRegistry.getConfig();
    expect(config.mcpServers).toHaveProperty('test-server-2');
    expect(config.mcpServers['test-server-2'].enabled).toBe(false);

    await mcpRegistry.removeServer('test-server-2');
    const updatedConfig = mcpRegistry.getConfig();
    expect(updatedConfig.mcpServers).not.toHaveProperty('test-server-2');
  });

  test('should connect to MCP server', async () => {
    const connected = await mcpRegistry.connectServer('test-calculator');
    expect(connected).toBe(true);

    const client = mcpRegistry.getClientManager().getClient('test-calculator');
    expect(client).toBeDefined();
    expect(client?.isConnected()).toBe(true);
  }, 10000);

  test('should list available tools', async () => {
    await mcpRegistry.connectServer('test-calculator');
    toolRegistry.refreshTools();

    const tools = toolRegistry.getAvailableToolNames();
    expect(tools).toContain('add');
    expect(tools).toContain('multiply');
    expect(tools).toContain('echo');
  });

  test('should execute MCP tools', async () => {
    await mcpRegistry.connectServer('test-calculator');
    toolRegistry.refreshTools();

    // Test add tool
    const addResult = await toolRegistry.executeTool('add', { a: 5, b: 3 });
    expect(addResult.success).toBe(true);
    expect(addResult.result).toContain('5 + 3 = 8');

    // Test multiply tool
    const multiplyResult = await toolRegistry.executeTool('multiply', { a: 4, b: 6 });
    expect(multiplyResult.success).toBe(true);
    expect(multiplyResult.result).toContain('4 × 6 = 24');

    // Test echo tool
    const echoResult = await toolRegistry.executeTool('echo', { message: 'Hello MCP!' });
    expect(echoResult.success).toBe(true);
    expect(echoResult.result).toContain('Echo: Hello MCP!');
  });

  test('should handle tool errors gracefully', async () => {
    await mcpRegistry.connectServer('test-calculator');
    toolRegistry.refreshTools();

    // Test invalid tool
    const invalidResult = await toolRegistry.executeTool('nonexistent-tool', {});
    expect(invalidResult.success).toBe(false);
    expect(invalidResult.error).toContain('not found');

    // Test invalid arguments
    const invalidArgsResult = await toolRegistry.executeTool('add', { a: 5 }); // missing 'b'
    expect(invalidArgsResult.success).toBe(false);
  });

  test('should generate tool schemas for different providers', async () => {
    await mcpRegistry.connectServer('test-calculator');
    toolRegistry.refreshTools();

    const openaiTools = toolBridge.getOpenAITools();
    expect(openaiTools.length).toBeGreaterThan(0);
    expect(openaiTools[0]).toHaveProperty('type', 'function');
    expect(openaiTools[0].function).toHaveProperty('name');
    expect(openaiTools[0].function).toHaveProperty('description');

    const anthropicTools = toolBridge.getAnthropicTools();
    expect(anthropicTools.length).toBeGreaterThan(0);
    expect(anthropicTools[0]).toHaveProperty('name');
    expect(anthropicTools[0]).toHaveProperty('input_schema');

    const geminiTools = toolBridge.getGeminiTools();
    expect(geminiTools.length).toBeGreaterThan(0);
    expect(geminiTools[0]).toHaveProperty('name');
    expect(geminiTools[0]).toHaveProperty('parameters');
  });

  test('should get server status information', async () => {
    await mcpRegistry.connectServer('test-calculator');
    
    const statuses = await mcpRegistry.getServerStatus();
    const calculatorStatus = statuses.find(s => s.id === 'test-calculator');
    
    expect(calculatorStatus).toBeDefined();
    expect(calculatorStatus?.connected).toBe(true);
    expect(calculatorStatus?.toolCount).toBeGreaterThan(0);
  });

  test('should test server connectivity', async () => {
    const testResult = await mcpRegistry.testServer('test-calculator');
    
    expect(testResult.success).toBe(true);
    expect(testResult.tools).toBeDefined();
    expect(testResult.tools?.length).toBeGreaterThan(0);
  });

  test('should handle health checks', async () => {
    await mcpRegistry.connectServer('test-calculator');
    
    const health = await mcpRegistry.getClientManager().healthCheck();
    expect(health.has('test-calculator')).toBe(true);
    expect(health.get('test-calculator')).toBe(true);
  });

  test('should disconnect gracefully', async () => {
    await mcpRegistry.connectServer('test-calculator');
    
    const client = mcpRegistry.getClientManager().getClient('test-calculator');
    expect(client?.isConnected()).toBe(true);
    
    await mcpRegistry.disconnectAll();
    expect(client?.isConnected()).toBe(false);
  });

  describe('MCP Swarm Manager Integration', () => {
    let memoryManager: MemoryManager;
    let providerManager: ProviderManager;
    let mcpSwarmManager: MCPSwarmManager;

    beforeAll(async () => {
      memoryManager = new MemoryManager({
        dbPath: ':memory:', // Use in-memory SQLite for tests
        maxSize: 100
      });

      providerManager = new ProviderManager({
        providers: {
          local: {
            enabled: true,
            url: 'http://localhost:11434/v1',
            defaultModel: 'llama2',
            apiKey: 'test-key'
          }
        },
        defaultProvider: 'local',
        loadBalancing: {
          enabled: false,
          strategy: 'round-robin'
        }
      });

      await mcpRegistry.loadConfig();
      mcpSwarmManager = new MCPSwarmManager(memoryManager, providerManager, mcpRegistry, toolRegistry);
    });

    test('should get MCP statistics', async () => {
      await mcpRegistry.connectServer('test-calculator');
      toolRegistry.refreshTools();

      const stats = await mcpSwarmManager.getMCPStats();
      expect(stats.totalTools).toBeGreaterThan(0);
      expect(stats.connectedServers).toBeGreaterThan(0);
      expect(stats.toolsByServer).toHaveProperty('test-calculator');
    });

    test('should test MCP integration', async () => {
      const integrationTest = await mcpSwarmManager.testMCPIntegration();
      
      // May fail if server is not connected, but should not throw
      expect(integrationTest).toHaveProperty('success');
      expect(integrationTest).toHaveProperty('connectedServers');
      expect(integrationTest).toHaveProperty('availableTools');
      expect(integrationTest).toHaveProperty('errors');
    });
  });
});

describe('MCP Error Handling', () => {
  test('should handle connection timeouts', async () => {
    const registry = new MCPRegistry();
    
    // Add a server that will timeout
    await registry.addServer({
      id: 'timeout-server',
      command: 'sleep',
      args: ['10'],
      timeout: 1000, // 1 second timeout
      maxRetries: 1,
      tags: ['test'],
      enabled: true,
      autoStart: false
    });

    const connected = await registry.connectServer('timeout-server');
    expect(connected).toBe(false);
  }, 15000);

  test('should handle invalid server commands', async () => {
    const registry = new MCPRegistry();
    
    await registry.addServer({
      id: 'invalid-server',
      command: 'nonexistent-command',
      args: [],
      timeout: 5000,
      maxRetries: 1,
      tags: ['test'],
      enabled: true,
      autoStart: false
    });

    const connected = await registry.connectServer('invalid-server');
    expect(connected).toBe(false);
  });
});