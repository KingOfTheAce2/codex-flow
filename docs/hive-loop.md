# Hive-Loop Automation

The Hive-Loop feature provides automated, repeated execution of hive-mind spawning cycles with corrective feedback loops. This enables continuous improvement workflows and stress testing of AI agent interactions.

## Overview

Hive-Loop automation repeatedly runs:
1. **Initial Prompt**: Execute `codex-flow hive-mind spawn '<PROMPT_1>' --claude`
2. **Corrective Follow-up**: Execute corrective prompt addressing issues found
3. **Loop Control**: Continue until max sessions or time limits are reached

## Features

- **Two-step prompt cycle** with configurable prompts
- **Timeout handling** for individual sessions
- **Cross-platform support** (Windows, macOS, Linux)  
- **Graceful shutdown** with stop flag support
- **PID cleanup** and process management
- **Per-session logging** with structured output
- **Summary reporting** in JSON format

## Installation

The hive-loop functionality is built into codex-flow. No additional installation required.

```bash
npm install -g @bear_ai/codex-flow
```

## Quick Start

### Basic Usage

```bash
# Run 2 sessions with default prompts
codex-flow hive-loop run --maxSessions 2

# Use custom prompts
codex-flow hive-loop run \
  --prompt1 "Build a React todo app with TypeScript" \
  --prompt2 "Fix the code issues and follow React best practices" \
  --maxSessions 3 \
  --durationHours 1
```

### Advanced Configuration

```bash
# Full configuration example
codex-flow hive-loop run \
  --prompt1 ./prompts/initial.txt \
  --prompt2 ./prompts/corrective.txt \
  --maxSessions 10 \
  --durationHours 2 \
  --sessionTimeoutMinutes 20 \
  --workDir ./workspace \
  --providers "claude,local" \
  --logDir ./logs/automation \
  --verbose \
  --stopOnError
```

## Commands

### `codex-flow hive-loop run`

Execute automated hive-loop cycles.

#### Options

| Flag | Description | Default | Example |
|------|-------------|---------|---------|
| `--prompt1 <prompt>` | First prompt (file path or string) | `"Build a hello world application"` | `./prompts/build.txt` |
| `--prompt2 <prompt>` | Second corrective prompt | `"You are wrong, please fix..."` | `"Fix issues and align with docs"` |
| `--maxSessions <n>` | Maximum number of sessions | `10` | `5` |
| `--durationHours <h>` | Maximum duration in hours | `1` | `2.5` |
| `--sessionTimeoutMinutes <m>` | Timeout per session | `15` | `30` |
| `--workDir <path>` | Working directory | Current directory | `./workspace` |
| `--providers <list>` | Comma-separated providers | `"local"` | `"claude,openai"` |
| `--logDir <path>` | Log directory | `./logs/automation` | `./logs/hive-loop` |
| `--stopOnError` | Stop on first error | `false` | (flag only) |
| `--verbose` | Enable verbose logging | `false` | (flag only) |

#### Examples

```bash
# Simple 2-session test
codex-flow hive-loop run --maxSessions 2 --verbose

# File-based prompts with custom timeouts  
codex-flow hive-loop run \
  --prompt1 ./prompts/build-app.md \
  --prompt2 ./prompts/fix-issues.md \
  --sessionTimeoutMinutes 25

# Long-running automation with multiple providers
codex-flow hive-loop run \
  --maxSessions 20 \
  --durationHours 6 \
  --providers "claude,openai,local" \
  --stopOnError
```

### `codex-flow hive-loop status`

Check the status of recent hive-loop executions.

```bash
# Check default log directory
codex-flow hive-loop status

# Check custom log directory
codex-flow hive-loop status --logDir ./custom-logs
```

### `codex-flow hive-loop stop`

Request graceful shutdown of running hive-loop processes.

```bash
# Set stop flag in default directory
codex-flow hive-loop stop

# Set stop flag in custom directory
codex-flow hive-loop stop --logDir ./custom-logs
```

## Configuration

### Prompt Sources

Prompts can be specified as:

1. **Inline strings**: `--prompt1 "Build a React app"`
2. **File paths**: `--prompt1 ./prompts/build.txt`
3. **Markdown files**: `--prompt1 ./docs/requirements.md`

File paths are detected automatically by the presence of `/`, `\`, or extensions `.txt`, `.md`.

### Configuration Template

Create a configuration template for reusable setups:

```json
{
  "prompt1": "Build a modern web application using React and TypeScript. Include proper error handling, responsive design, and accessibility features.",
  "prompt2": "You are wrong, please fix the issues and align with the latest React best practices. Ensure the code follows SOLID principles, uses proper TypeScript types, and includes comprehensive error boundaries.",
  "maxSessions": 5,
  "durationHours": 2,
  "sessionTimeoutMinutes": 20,
  "workDir": "./workspace",
  "providers": ["local", "claude"],
  "logDir": "./logs/automation",
  "stopOnError": false,
  "verbose": true
}
```

Save as `scripts/hive_loop/config.template.json` and customize as needed.

## Logging

### Log Structure

Hive-loop creates structured logs in the specified log directory:

```
logs/automation/
├── session-1.log          # Individual session output
├── session-2.log
├── session-3.log
└── hive-loop-summary.json # Summary report
```

### Session Logs

Each session log contains:

```
[2023-12-07T10:30:00.000Z] session-1-prompt1
Command: npx codex-flow hive-mind spawn "Build a React app" --claude --verbose
Prompt: Build a React app

🐝 Spawning new swarm...
Objective: Build a React app
...

[2023-12-07T10:35:00.000Z] session-1-prompt2  
Command: npx codex-flow hive-mind spawn "Fix issues and align with best practices" --claude --verbose
Prompt: Fix issues and align with best practices
...
```

### Summary Report

The summary report (`hive-loop-summary.json`) contains:

```json
{
  "config": {
    "prompt1": "Build a React app",
    "prompt2": "Fix issues",
    "maxSessions": 5,
    "durationHours": 1,
    "sessionTimeoutMinutes": 15,
    "workDir": "./workspace",
    "providers": ["claude"],
    "logDir": "./logs/automation"
  },
  "startTime": "2023-12-07T10:30:00.000Z",
  "endTime": "2023-12-07T11:15:00.000Z", 
  "totalSessions": 3,
  "successfulSessions": 2,
  "failedSessions": 1,
  "sessions": [
    {
      "sessionId": 1,
      "startTime": "2023-12-07T10:30:00.000Z",
      "endTime": "2023-12-07T10:45:00.000Z",
      "success": true,
      "logFile": "session-1.log"
    }
  ]
}
```

## Process Management

### Graceful Shutdown

Hive-loop supports multiple shutdown methods:

1. **Ctrl+C (SIGINT)**: Immediate graceful shutdown
2. **SIGTERM**: Graceful shutdown from process managers
3. **Stop flag**: `codex-flow hive-loop stop` creates `.stop_hive_loop` file

### PID Cleanup

The runner automatically:
- Tracks active child processes
- Kills processes on timeout or shutdown
- Cleans up process resources
- Handles orphaned processes

### Cross-Platform Support

Hive-loop works on:
- **Windows**: Uses `npx` with proper path resolution
- **macOS/Linux**: Native shell command execution
- **Mixed environments**: Handles path separators correctly

## Error Handling

### Session Failures

When a session fails:
- Error is logged to session log file
- Session marked as failed in summary
- Loop continues (unless `--stopOnError` specified)
- Timeout triggers process termination

### Common Issues

1. **Command not found**: Ensure `codex-flow` is installed globally
2. **Permission errors**: Check log directory write permissions  
3. **Timeout errors**: Increase `--sessionTimeoutMinutes`
4. **Provider errors**: Configure provider credentials properly

### Debug Mode

Use `--verbose` flag for detailed logging:

```bash
codex-flow hive-loop run --maxSessions 2 --verbose
```

Shows:
- Command execution details
- Real-time session output
- Internal process management
- Detailed error information

## Use Cases

### Development Workflows

```bash
# Continuous integration testing
codex-flow hive-loop run \
  --prompt1 "Implement feature X with tests" \
  --prompt2 "Fix failing tests and improve code quality" \
  --maxSessions 5 \
  --stopOnError

# Code review automation
codex-flow hive-loop run \
  --prompt1 "./prompts/implement-feature.md" \
  --prompt2 "Review code and fix issues found" \
  --sessionTimeoutMinutes 30
```

### Stress Testing

```bash
# Long-running stability test
codex-flow hive-loop run \
  --maxSessions 50 \
  --durationHours 12 \
  --providers "claude,openai,local" \
  --logDir ./stress-test-logs
```

### Educational Content

```bash
# Learning loop with corrections
codex-flow hive-loop run \
  --prompt1 "Explain React hooks with examples" \
  --prompt2 "Correct any errors and add missing details" \
  --maxSessions 3
```

## Testing

Run the test suite to verify functionality:

```bash
# Run all hive-loop tests
npm test tests/hive_loop/

# Run specific test files
npm test tests/hive_loop/hive-loop.test.ts
npm test tests/hive_loop/cli.test.ts
```

### Acceptance Tests

Verify cross-platform compatibility:

```bash
# Test on Windows
codex-flow hive-loop run --maxSessions 1 --verbose

# Test with stop flag (in separate terminal)
codex-flow hive-loop stop

# Verify logs created
codex-flow hive-loop status
```

## Troubleshooting

### Common Commands

```bash
# Check if hive-loop is available
codex-flow hive-loop --help

# Test with minimal configuration
codex-flow hive-loop run --maxSessions 1 --sessionTimeoutMinutes 5

# Check logs for errors
cat logs/automation/session-1.log
cat logs/automation/hive-loop-summary.json

# Clean up test logs
rm -rf logs/automation/
```

### Performance Tips

1. **Reduce session timeout** for faster feedback
2. **Use local provider** to avoid API rate limits
3. **Limit max sessions** during development
4. **Use verbose mode** only for debugging

### Integration

Hive-loop integrates with:
- **CI/CD pipelines**: Use as automated testing step
- **Monitoring systems**: Parse JSON summary reports
- **Process managers**: Supports standard signal handling
- **Log aggregation**: Structured logging format

## API Reference

The hive-loop functionality is also available as a Node.js module:

```typescript
import { HiveLoopRunner, HiveLoopConfig } from './scripts/hive_loop';

const config: HiveLoopConfig = {
  prompt1: 'Build application',
  prompt2: 'Fix issues',
  maxSessions: 3,
  durationHours: 1,
  sessionTimeoutMinutes: 15,
  workDir: process.cwd(),
  providers: ['claude'],
  logDir: './logs',
  verbose: true
};

const runner = new HiveLoopRunner(config);
const results = await runner.run();
```

See `scripts/hive_loop/index.ts` for full API documentation.