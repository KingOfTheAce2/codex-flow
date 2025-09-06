# Codex-Flow Swarm Spawn Issues - Bug Report

## Environment
- **Version**: 0.2.2-alpha
- **Platform**: Windows 11
- **Node.js**: v20.19.4
- **Command**: `codex-flow swarm spawn 'Build a hello world app'`

## Issues Identified

### 1. Provider Manager Wiring Bug (CRITICAL - FIXED)
**Error**: `this.providerManager.getEnabledProviders is not a function`

**Root Cause**: Type mismatch between expected and actual parameter types
- `AgentFactory` constructor expects `ProviderManager` instance
- `SwarmManager` was receiving raw config object and passing `config.providers`
- Raw config has no `getEnabledProviders()` method

**Impact**: Complete failure to spawn swarms

**Fix**: Create proper `ProviderManager` instance in `swarm.ts` and update `SwarmManager.ts` to handle both scenarios

### 2. Missing Credential Guard (MEDIUM)
**Error**: `OpenAI API error: Cannot read properties of undefined (reading 'chat')`

**Root Cause**: OpenAI provider enabled by default without API key validation
- `this.client` is undefined when no API key provided
- No fallback or graceful degradation

**Impact**: Runtime crash when using OpenAI provider without credentials

**Workaround**: Disable OpenAI and enable local provider

### 3. Task Command Config Load Error (LOW)
**Error**: `Configuration not loaded. Call load() first.`

**Root Cause**: Some CLI commands attempt to use configuration before initialization

**Impact**: User must run `codex-flow init` before any operations

**Workaround**: Always initialize project first

### 4. MCP Setup Script 404 (EXPECTED)
**Error**: `npm error 404 Not Found - GET https://registry.npmjs.org/ruv-swarm-mcp`

**Root Cause**: `ruv-swarm-mcp` package doesn't exist yet

**Impact**: Noisy error during postinstall, but doesn't affect functionality

**Status**: Expected behavior, package will be published later

## Reproduction Steps

### Before Fix:
```bash
# Initialize project
codex-flow init -y --name "test" --providers "openai"

# Attempt spawn (fails)
codex-flow swarm spawn 'Build a hello world app' --verbose
# Error: this.providerManager.getEnabledProviders is not a function
```

### After Fix:
```bash
# Configure providers
codex-flow config set providers.openai.enabled false
codex-flow config set providers.local.enabled true
codex-flow config verify

# Test spawn (succeeds)
codex-flow swarm spawn 'Build a hello world app' --providers local --verbose
# ✅ Swarm spawned successfully!
```

## Log Files
- `RUN_LOGS/attempt-1.txt` - Original error
- `RUN_LOGS/attempt-2.txt` - Post-fix results

## Permanent Fix Required

The provider wiring bug is fixed, but for production:

1. **Add credential validation** in provider constructors
2. **Implement graceful fallbacks** when providers are misconfigured  
3. **Add initialization checks** in CLI commands
4. **Improve error messages** for common configuration issues

## Priority Assessment
- **Provider wiring bug**: FIXED ✅
- **Credential validation**: Should be addressed for production
- **Config initialization**: Low priority, documented workaround exists
- **MCP errors**: Cosmetic only, can be ignored

## Test Coverage Recommendations
1. Unit tests for `ProviderManager` instantiation
2. Integration tests for swarm spawn with different provider configurations
3. Error handling tests for missing credentials
4. CLI initialization sequence tests