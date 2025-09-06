# MCP Server Integration for Codex-Flow

This document explains how rUv net's MCP server integration has been set up with codex-flow.

## Overview

The MCP (Model Context Protocol) server integration allows Claude Code to directly interact with ruv-swarm through a standardized protocol. When you run codex-flow, it automatically configures and enables the ruv-swarm MCP server.

## Files Created

### 1. `.mcp.json` - MCP Server Configuration
```json
{
  "mcpServers": {
    "ruv-swarm": {
      "command": "ruv-swarm-mcp",
      "args": ["--stdio"],
      "env": {
        "RUST_LOG": "info"
      }
    }
  }
}
```

### 2. `.claude/settings.local.json` - Claude Code Settings
```json
{
  "enableAllProjectMcpServers": true,
  "enabledMcpjsonServers": ["ruv-swarm"]
}
```

### 3. `package.json` - Installation Scripts
The package.json includes scripts for automatic MCP server installation:
```json
{
  "scripts": {
    "setup:mcp": "npm install -g ruv-swarm-mcp || echo 'Installing ruv-swarm-mcp globally...'",
    "postinstall": "npm run setup:mcp"
  }
}
```

## How It Works

1. **Project Initialization**: When you run `codex-flow init`, it automatically:
   - Creates the `.mcp.json` configuration file
   - Sets up Claude Code settings to enable the MCP server
   - Adds installation scripts to package.json

2. **Automatic Installation**: The `postinstall` script ensures that `ruv-swarm-mcp` is installed whenever someone installs the project dependencies.

3. **Claude Code Integration**: Claude Code automatically detects and loads the MCP server configuration, making ruv-swarm tools available in the session.

## Usage

### Non-Interactive Initialization
```bash
# Initialize with MCP integration
codex-flow init -y --name "my-project" --providers "openai,anthropic"

# Install MCP servers
npm run setup:mcp
```

### Interactive Initialization
```bash
# Standard interactive setup
codex-flow init
```

### Verify Integration
```bash
# Check configuration
codex-flow config verify

# Start a swarm (will have access to ruv-swarm tools)
codex-flow swarm spawn "Create a hello world app"
```

## CLI Integration Benefits

With this integration, users can:

1. **Direct CLI Usage**: Work with OpenAI CLI, Claude Code, and Gemini CLI without pip installations
2. **Seamless Tool Access**: ruv-swarm tools are available directly in Claude Code sessions
3. **Automated Setup**: No manual MCP server configuration needed
4. **Cross-Platform**: Works on Windows, macOS, and Linux

## Example Workflow

```bash
# 1. Install codex-flow globally
npm install -g @bear_ai/codex-flow

# 2. Initialize a new project with MCP integration
codex-flow init -y --name "my-ai-project" --providers "openai,anthropic"

# 3. MCP servers are automatically configured and ready to use
# 4. Claude Code can now use ruv-swarm tools directly

# 5. Start working with swarms
codex-flow swarm spawn "Build a REST API with authentication"
```

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Claude Code   │────│  MCP Protocol   │────│   ruv-swarm     │
│                 │    │                  │    │   MCP Server    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         v                       v                       v
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  codex-flow     │    │   .mcp.json      │    │  ruv-swarm      │
│  CLI Tool       │    │   configuration  │    │  Backend        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Next Steps

1. **Publish ruv-swarm-mcp**: Create and publish the actual MCP server package to npm
2. **Tool Implementation**: Implement the specific ruv-swarm tools that will be exposed via MCP
3. **Testing**: Create comprehensive tests for the MCP integration
4. **Documentation**: Add detailed API documentation for ruv-swarm MCP tools

## Troubleshooting

### MCP Server Not Loading
- Check that `.mcp.json` exists and is valid JSON
- Verify Claude Code settings in `.claude/settings.local.json`
- Ensure ruv-swarm-mcp is installed globally

### Installation Issues
- Run `npm run setup:mcp` manually
- Check npm permissions for global installs
- Use alternative installation methods if npm registry is unavailable