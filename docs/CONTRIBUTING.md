# Contributing to Codex-Flow

Thank you for your interest in contributing to Codex-Flow! This guide will help you get started with development, understand our processes, and contribute effectively to the project.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Environment](#development-environment)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Code Style Guide](#code-style-guide)
- [Testing Requirements](#testing-requirements)
- [Pull Request Process](#pull-request-process)
- [Issue Guidelines](#issue-guidelines)
- [Community Guidelines](#community-guidelines)
- [Release Process](#release-process)

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: 18.0.0 or higher
- **npm**: 8.0.0 or higher  
- **Git**: Latest version
- **Code Editor**: VS Code recommended with TypeScript extensions

### Environment Setup

1. **Fork the Repository**
   ```bash
   # Fork the repo on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/codex-flow.git
   cd codex-flow
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Set Up Environment Variables**
   ```bash
   # Copy the example environment file
   cp .env.example .env
   
   # Add your API keys and configuration
   # OPENAI_API_KEY=your-api-key-here
   # CODEX_FLOW_DEBUG=true
   ```

4. **Run Initial Build**
   ```bash
   npm run build
   ```

5. **Verify Installation**
   ```bash
   npm test
   npm run lint
   ```

## Development Environment

### Recommended VS Code Extensions

Add these extensions to your VS Code for the best development experience:

```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-eslint",
    "ms-vscode.vscode-jest",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-json"
  ]
}
```

### Development Scripts

```bash
# Development with auto-reload
npm run dev

# Build the project
npm run build

# Run tests
npm test
npm run test:watch
npm run test:coverage

# Linting and formatting
npm run lint
npm run lint:fix
npm run format

# Type checking
npm run typecheck

# Clean build artifacts
npm run clean
```

## Project Structure

```
codex-flow/
├── src/                    # Source code
│   ├── cli/               # Command line interface
│   ├── core/              # Core system components
│   ├── agents/            # Agent implementations
│   ├── swarm/             # Swarm orchestration
│   ├── memory/            # Memory system
│   ├── providers/         # AI provider implementations
│   ├── tools/             # Built-in tools
│   ├── config/            # Configuration management
│   ├── events/            # Event system
│   └── utils/             # Utility functions
├── tests/                 # Test files
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   └── fixtures/          # Test data and mocks
├── docs/                  # Documentation
├── examples/              # Usage examples
├── scripts/               # Build and utility scripts
└── dist/                  # Built output (generated)
```

### Key Directories

#### `src/core/`
Contains the fundamental system components:
- `CodexFlow` - Main orchestration class
- `Agent` - Base agent interface and implementations
- `Swarm` - Swarm management and coordination
- `Memory` - Memory system and storage

#### `src/providers/`
AI provider implementations:
- `OpenAIProvider` - OpenAI integration
- `AnthropicProvider` - Anthropic Claude integration
- `BaseProvider` - Common provider interface

#### `src/tools/`
Built-in tool implementations:
- `FileOperations` - File system tools
- `GitOperations` - Git repository tools
- `WebSearch` - Web search capabilities

## Development Workflow

### Branch Strategy

We use a **GitHub Flow** model:

1. **Main Branch**: `main`
   - Always deployable
   - Protected with branch rules
   - All changes via pull requests

2. **Feature Branches**
   - Created from `main`
   - Named descriptively: `feature/agent-improvement` or `fix/memory-leak`
   - Merged back to `main` via PR

3. **Release Branches**
   - Created for major releases
   - Named: `release/v1.2.0`
   - Used for final testing and bug fixes

### Commit Message Convention

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat`: New features
- `fix`: Bug fixes
- `docs`: Documentation changes
- `style`: Code style changes (no logic changes)
- `refactor`: Code refactoring
- `test`: Test additions or modifications
- `chore`: Maintenance tasks

**Examples:**
```
feat(agents): add new database specialist agent

Add DatabaseAgent with capabilities for schema design,
query optimization, and database migrations.

Closes #123
```

```
fix(memory): resolve memory leak in vector storage

- Fixed improper cleanup of vector embeddings
- Added proper disposal of resources
- Updated tests to verify fix

Fixes #456
```

## Code Style Guide

### TypeScript Guidelines

1. **Strict Type Safety**
   ```typescript
   // ✅ Good - Explicit types
   interface AgentConfig {
     name: string;
     type: AgentType;
     capabilities: string[];
   }
   
   // ❌ Bad - Any types
   function processAgent(config: any): any {
     // ...
   }
   ```

2. **Interface Over Type**
   ```typescript
   // ✅ Good - Use interfaces for object shapes
   interface Task {
     id: string;
     description: string;
     priority: number;
   }
   
   // ❌ Bad - Type alias for simple objects
   type Task = {
     id: string;
     description: string;
     priority: number;
   };
   ```

3. **Async/Await Over Promises**
   ```typescript
   // ✅ Good
   async function executeTask(task: Task): Promise<TaskResult> {
     const result = await agent.process(task);
     return result;
   }
   
   // ❌ Bad
   function executeTask(task: Task): Promise<TaskResult> {
     return agent.process(task).then(result => {
       return result;
     });
   }
   ```

### Code Organization

1. **File Naming**
   - Use kebab-case: `agent-manager.ts`
   - Include type in name: `user.interface.ts`, `task.service.ts`
   - Test files: `agent-manager.test.ts`

2. **Import Organization**
   ```typescript
   // 1. Node.js built-ins
   import fs from 'fs';
   import path from 'path';
   
   // 2. External libraries
   import { OpenAI } from 'openai';
   import winston from 'winston';
   
   // 3. Internal modules (absolute paths)
   import { Agent } from '@/core/agent';
   import { MemorySystem } from '@/memory/memory-system';
   
   // 4. Relative imports
   import { validateConfig } from './utils';
   ```

3. **Class Structure**
   ```typescript
   export class ExampleAgent implements Agent {
     // 1. Public properties
     public readonly id: string;
     public readonly type: AgentType;
     
     // 2. Private properties
     private readonly config: AgentConfig;
     private provider: Provider;
     
     // 3. Constructor
     constructor(config: AgentConfig) {
       this.config = config;
     }
     
     // 4. Public methods
     public async initialize(): Promise<void> {
       // Implementation
     }
     
     // 5. Private methods
     private validateConfig(): void {
       // Implementation
     }
   }
   ```

### Error Handling

1. **Custom Error Classes**
   ```typescript
   export class AgentError extends Error {
     constructor(
       message: string,
       public readonly agentId: string,
       public readonly code: string
     ) {
       super(message);
       this.name = 'AgentError';
     }
   }
   ```

2. **Error Handling Patterns**
   ```typescript
   // ✅ Good - Specific error handling
   try {
     const result = await agent.execute(task);
     return result;
   } catch (error) {
     if (error instanceof AgentError) {
       logger.error(`Agent ${error.agentId} failed: ${error.message}`);
       // Handle agent-specific error
     } else {
       logger.error('Unexpected error:', error);
       throw error;
     }
   }
   ```

### Documentation

1. **JSDoc Comments**
   ```typescript
   /**
    * Executes a task using the specified agent configuration.
    * 
    * @param task - The task to execute
    * @param config - Agent configuration options
    * @returns Promise resolving to task execution result
    * @throws {AgentError} When agent execution fails
    * @throws {ValidationError} When task validation fails
    * 
    * @example
    * ```typescript
    * const result = await executeTask(
    *   { id: '123', description: 'Write unit tests' },
    *   { type: 'tester', timeout: 300 }
    * );
    * ```
    */
   async function executeTask(
     task: Task, 
     config: AgentConfig
   ): Promise<TaskResult> {
     // Implementation
   }
   ```

## Testing Requirements

### Testing Strategy

We use a comprehensive testing approach:

1. **Unit Tests**: Test individual functions and classes
2. **Integration Tests**: Test component interactions
3. **End-to-End Tests**: Test complete workflows

### Testing Tools

- **Jest**: Test runner and assertion library
- **ts-jest**: TypeScript preprocessor for Jest
- **Supertest**: HTTP assertion library
- **Mock Service Worker**: API mocking

### Test Structure

```typescript
describe('AgentManager', () => {
  let agentManager: AgentManager;
  let mockProvider: jest.Mocked<Provider>;
  
  beforeEach(() => {
    mockProvider = createMockProvider();
    agentManager = new AgentManager({ provider: mockProvider });
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('createAgent', () => {
    it('should create agent with valid configuration', async () => {
      // Arrange
      const config: AgentConfig = {
        type: 'coder',
        name: 'test-agent'
      };
      
      // Act
      const agent = await agentManager.createAgent(config);
      
      // Assert
      expect(agent).toBeDefined();
      expect(agent.type).toBe('coder');
      expect(agent.name).toBe('test-agent');
    });
    
    it('should throw error for invalid configuration', async () => {
      // Arrange
      const invalidConfig = {} as AgentConfig;
      
      // Act & Assert
      await expect(agentManager.createAgent(invalidConfig))
        .rejects
        .toThrow(ValidationError);
    });
  });
});
```

### Testing Guidelines

1. **Test Naming**
   - Descriptive test names
   - Use "should" statements
   - Include context: "when user is authenticated"

2. **Test Organization**
   - Group related tests with `describe`
   - Use `beforeEach`/`afterEach` for setup/cleanup
   - One assertion per test when possible

3. **Mocking**
   ```typescript
   // ✅ Good - Mock external dependencies
   const mockProvider = {
     generateResponse: jest.fn().mockResolvedValue({
       content: 'Mock response'
     })
   } as jest.Mocked<Provider>;
   
   // ✅ Good - Use factory functions for test data
   function createMockTask(overrides: Partial<Task> = {}): Task {
     return {
       id: 'test-task',
       description: 'Test task',
       priority: 1,
       ...overrides
     };
   }
   ```

4. **Coverage Requirements**
   - Minimum 80% code coverage
   - 100% coverage for critical paths
   - Focus on business logic testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- agent-manager.test.ts

# Run integration tests only
npm run test:integration

# Run tests for specific pattern
npm test -- --testNamePattern="should create agent"
```

## Pull Request Process

### Before Creating a PR

1. **Ensure Your Branch is Up to Date**
   ```bash
   git checkout main
   git pull origin main
   git checkout your-feature-branch
   git rebase main
   ```

2. **Run Quality Checks**
   ```bash
   npm run lint
   npm run typecheck
   npm test
   npm run build
   ```

3. **Update Documentation**
   - Update relevant documentation
   - Add JSDoc comments for new public APIs
   - Update README if necessary

### PR Requirements

1. **PR Title**: Follow conventional commit format
2. **Description**: Use the PR template
3. **Tests**: All new code must include tests
4. **Documentation**: Update docs for new features
5. **No Breaking Changes**: Without prior discussion

### PR Template

```markdown
## Description
Brief description of changes made.

## Type of Change
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that changes existing functionality)
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] All tests passing locally

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes (or properly documented)

## Related Issues
Closes #123
```

### Review Process

1. **Automated Checks**
   - Linting and formatting
   - Type checking
   - Test execution
   - Build verification

2. **Code Review**
   - At least one approving review required
   - Address all review comments
   - Maintain conversation until resolved

3. **Merge Requirements**
   - All checks passing
   - Up to date with main branch
   - Squash and merge preferred

## Issue Guidelines

### Creating Issues

1. **Bug Reports**
   ```markdown
   ## Bug Description
   Clear description of the bug.
   
   ## Steps to Reproduce
   1. Step one
   2. Step two
   3. Step three
   
   ## Expected Behavior
   What should have happened.
   
   ## Actual Behavior
   What actually happened.
   
   ## Environment
   - OS: [e.g., Windows 11]
   - Node.js: [e.g., 18.15.0]
   - Codex-Flow: [e.g., 1.2.0]
   
   ## Additional Context
   Any other relevant information.
   ```

2. **Feature Requests**
   ```markdown
   ## Feature Description
   Clear description of the proposed feature.
   
   ## Use Case
   Why is this feature needed?
   
   ## Proposed Solution
   How should this feature work?
   
   ## Alternatives Considered
   Any alternative approaches considered?
   
   ## Additional Context
   Any other relevant information.
   ```

### Issue Labels

- **Type**: `bug`, `enhancement`, `documentation`, `question`
- **Priority**: `high`, `medium`, `low`
- **Status**: `needs-triage`, `in-progress`, `blocked`
- **Component**: `agents`, `swarm`, `memory`, `tools`, `cli`

## Community Guidelines

### Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please read our [Code of Conduct](CODE_OF_CONDUCT.md).

### Communication

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and community discussions
- **Pull Requests**: Code review and technical discussions

### Getting Help

1. **Documentation**: Check existing docs first
2. **Search Issues**: Look for existing discussions
3. **GitHub Discussions**: Ask questions in the community
4. **Discord**: Join our community Discord server

## Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):
- **MAJOR**: Breaking changes
- **MINOR**: New features (backwards compatible)
- **PATCH**: Bug fixes (backwards compatible)

### Release Schedule

- **Patch releases**: As needed for critical bugs
- **Minor releases**: Monthly feature releases
- **Major releases**: Quarterly or as needed for breaking changes

### Release Checklist

1. **Pre-release**
   - [ ] Update version in `package.json`
   - [ ] Update `CHANGELOG.md`
   - [ ] Run full test suite
   - [ ] Update documentation

2. **Release**
   - [ ] Create release branch
   - [ ] Tag release: `git tag v1.2.0`
   - [ ] Push tags: `git push --tags`
   - [ ] Publish to npm: `npm publish`

3. **Post-release**
   - [ ] Update GitHub release notes
   - [ ] Announce on community channels
   - [ ] Update documentation site

## Advanced Contributing

### Adding New Agent Types

1. **Create Agent Class**
   ```typescript
   // src/agents/custom-agent.ts
   export class CustomAgent implements Agent {
     // Implementation
   }
   ```

2. **Register Agent**
   ```typescript
   // src/agents/registry.ts
   export const agentRegistry = {
     // existing agents...
     'custom': CustomAgent
   };
   ```

3. **Add Tests**
   ```typescript
   // tests/unit/agents/custom-agent.test.ts
   describe('CustomAgent', () => {
     // Test implementation
   });
   ```

4. **Update Documentation**
   - Add to agent types documentation
   - Include usage examples
   - Update API reference

### Adding New Tools

1. **Implement Tool Interface**
   ```typescript
   // src/tools/my-tool.ts
   export class MyTool implements Tool {
     name = 'my-tool';
     description = 'Description of what this tool does';
     
     async execute(parameters: any, context: ToolContext): Promise<ToolResult> {
       // Implementation
     }
   }
   ```

2. **Register Tool**
   ```typescript
   // src/tools/registry.ts
   export const toolRegistry = {
     // existing tools...
     'my-tool': MyTool
   };
   ```

3. **Add Tests and Documentation**

### Adding New Providers

1. **Implement Provider Interface**
   ```typescript
   // src/providers/my-provider.ts
   export class MyProvider implements Provider {
     // Implementation following BaseProvider pattern
   }
   ```

2. **Register Provider**
3. **Add Configuration Support**
4. **Test Integration**
5. **Update Documentation**

Thank you for contributing to Codex-Flow! Your contributions help make this project better for everyone.