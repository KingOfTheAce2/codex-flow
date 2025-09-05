# Codex-Flow

> **Multi-agent CLI toolkit for OpenAI Codex with swarm orchestration and persistent memory**

Codex-Flow brings the proven workflows of [Gemini-Flow] and [Claude-Flow] to the OpenAI ecosystem, offering a comprehensive toolkit for orchestrating Codex-powered development tasks with advanced swarm intelligence and hive mind coordination.

[![NPM Version](https://img.shields.io/npm/v/@bear_ai/codex-flow.svg)](https://npmjs.org/package/@bear_ai/codex-flow)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)](https://www.typescriptlang.org/)
[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

## 🚀 Quick Start

```bash
# Install Codex-Flow
npm install -g @bear_ai/codex-flow

# Initialize a new project
codex-flow init my-project

# Start a swarm with multiple agents
codex-flow swarm create --topology hierarchical --agents 5

# Execute a complex task
codex-flow task "Build a REST API with authentication and testing" --agent-types coder,tester,reviewer
```

## ✨ Key Features

### 🧠 **Multi-Agent Orchestration**
- **Swarm Intelligence**: Coordinate multiple Codex agents working in parallel
- **Hive Mind Architecture**: Shared memory and knowledge across agent instances
- **Adaptive Topology**: Hierarchical, mesh, ring, and star coordination patterns
- **Smart Task Distribution**: Automatic workload balancing and specialization

### 🛠️ **Advanced CLI Interface**
- **Interactive Commands**: Guided setup and task execution
- **Plugin Architecture**: Extensible MCP tool system
- **Configuration Management**: Project-level and global settings
- **Session Persistence**: Resume complex workflows across restarts

### 💾 **Intelligent Memory System**
- **SQLite Backend**: Fast, reliable local storage
- **Context Preservation**: Maintain conversation and task history
- **Knowledge Sharing**: Cross-agent memory and learning
- **Memory Optimization**: Automatic cleanup and archival

### 🔧 **Developer Experience**
- **TypeScript First**: Full type safety and IntelliSense support
- **Extensible Tools**: File operations, Git integration, service connectors
- **Real-time Monitoring**: Task progress and agent status tracking
- **Comprehensive Logging**: Debug and audit trails

## 📋 Table of Contents

- [Installation](#installation)
- [Quick Start Guide](#quick-start-guide)
- [CLI Commands](#cli-commands)
- [Configuration](#configuration)
- [Agent Types](#agent-types)
- [Swarm Topologies](#swarm-topologies)
- [Examples](#examples)
- [API Reference](#api-reference)
- [Contributing](#contributing)

## 🔧 Installation

### Prerequisites
- **Node.js**: 18.0.0 or higher
- **npm**: 8.0.0 or higher
- **OpenAI API Key**: Set as `OPENAI_API_KEY` environment variable

### Global Installation
```bash
npm install -g @bear_ai/codex-flow
```

### Local Development
```bash
git clone https://github.com/your-org/codex-flow.git
cd codex-flow
npm install
npm run build
```

### Environment Setup
```bash
# Required
export OPENAI_API_KEY="your-api-key-here"

# Optional
export CODEX_MODEL="gpt-4"  # Default model
export CODEX_FLOW_DEBUG="true"  # Enable debug logging
export CODEX_FLOW_MEMORY_PATH="./memory"  # Memory storage location
```

## 🚀 Quick Start Guide

### 1. Initialize a New Project
```bash
codex-flow init my-ai-project --template fullstack
cd my-ai-project
```

### 2. Configure Your Environment
```bash
# Interactive configuration
codex-flow config setup

# Or edit configuration manually
codex-flow config edit
```

### 3. Create Your First Swarm
```bash
# Start with a simple hierarchical swarm
codex-flow swarm create \
  --topology hierarchical \
  --agents 3 \
  --types coder,tester,reviewer \
  --name development-team
```

### 4. Execute a Task
```bash
# Simple task
codex-flow task "Create a Hello World Express.js API"

# Complex multi-step task
codex-flow task \
  --file tasks/build-api.md \
  --swarm development-team \
  --parallel \
  --track-progress
```

## 📚 CLI Commands

### Core Commands

#### `codex-flow init <project-name>`
Initialize a new Codex-Flow project with templates and configuration.

```bash
codex-flow init my-project --template [web|api|fullstack|cli]
```

#### `codex-flow swarm <command>`
Manage agent swarms for coordinated development.

```bash
# Create a new swarm
codex-flow swarm create --topology mesh --agents 5 --name team-alpha

# List active swarms
codex-flow swarm list

# Monitor swarm activity
codex-flow swarm monitor team-alpha

# Destroy a swarm
codex-flow swarm destroy team-alpha
```

#### `codex-flow task <description>`
Execute development tasks using agent coordination.

```bash
# Simple task
codex-flow task "Implement user authentication"

# Task with specific agents
codex-flow task "Build REST API" --agents coder,tester --parallel

# Task from file
codex-flow task --file ./tasks/complex-feature.md --swarm my-team
```

#### `codex-flow agent <command>`
Manage individual agents and their capabilities.

```bash
# List available agent types
codex-flow agent types

# Spawn a specific agent
codex-flow agent spawn --type researcher --name docs-expert

# Check agent status
codex-flow agent status --all
```

### Utility Commands

#### `codex-flow config <command>`
Manage configuration settings.

```bash
codex-flow config show          # Display current config
codex-flow config edit          # Open config in editor
codex-flow config reset         # Reset to defaults
codex-flow config validate      # Validate configuration
```

#### `codex-flow memory <command>`
Manage persistent memory and knowledge base.

```bash
codex-flow memory status        # Show memory usage
codex-flow memory query "REST"  # Search memory
codex-flow memory clear --old   # Cleanup old entries
codex-flow memory export        # Export knowledge base
```

#### `codex-flow tool <command>`
Manage MCP tools and plugins.

```bash
codex-flow tool list            # List available tools
codex-flow tool install git-ops # Install a tool
codex-flow tool test file-ops   # Test a tool
```

## ⚙️ Configuration

### Project Configuration (`codex-flow.config.json`)

```json
{
  "project": {
    "name": "my-project",
    "version": "1.0.0",
    "description": "AI-powered development project"
  },
  "agents": {
    "maxConcurrent": 5,
    "defaultTimeout": 300,
    "retryAttempts": 3,
    "types": ["coder", "tester", "reviewer", "researcher"]
  },
  "swarm": {
    "defaultTopology": "hierarchical",
    "coordinationMode": "hive-mind",
    "memorySharing": true,
    "autoScale": true
  },
  "openai": {
    "model": "gpt-4",
    "temperature": 0.1,
    "maxTokens": 4096,
    "timeout": 30000
  },
  "memory": {
    "enabled": true,
    "path": "./memory/codex-flow.db",
    "maxEntries": 10000,
    "retentionDays": 30
  },
  "logging": {
    "level": "info",
    "file": "./logs/codex-flow.log",
    "console": true
  },
  "tools": {
    "enabled": ["file-ops", "git-ops", "web-search"],
    "disabled": [],
    "custom": []
  }
}
```

### Global Configuration (`~/.codex-flow/config.json`)

Global settings that apply across all projects:

```json
{
  "user": {
    "name": "Developer Name",
    "email": "dev@example.com",
    "preferences": {
      "defaultModel": "gpt-4",
      "verboseLogging": false,
      "autoSave": true
    }
  },
  "api": {
    "openai": {
      "organization": "org-xxxxxxx",
      "timeout": 30000,
      "retries": 3
    }
  },
  "defaults": {
    "swarmTopology": "hierarchical",
    "maxAgents": 5,
    "taskTimeout": 600
  }
}
```

## 🤖 Agent Types

Codex-Flow includes specialized agent types optimized for different development tasks:

### Core Development Agents

#### **Coder** 🖥️
- **Purpose**: Write, modify, and refactor code
- **Capabilities**: Multi-language support, design patterns, best practices
- **Specializations**: Frontend, backend, fullstack, mobile

#### **Tester** 🧪
- **Purpose**: Create and execute tests
- **Capabilities**: Unit tests, integration tests, E2E tests, test planning
- **Frameworks**: Jest, Mocha, Cypress, Playwright, PyTest

#### **Reviewer** 👀
- **Purpose**: Code review and quality assurance
- **Capabilities**: Code analysis, security review, performance optimization
- **Focus**: Best practices, maintainability, documentation

#### **Researcher** 📚
- **Purpose**: Investigation and analysis
- **Capabilities**: Technology research, requirement analysis, documentation
- **Skills**: Market research, competitive analysis, feasibility studies

#### **Planner** 📋
- **Purpose**: Project planning and architecture
- **Capabilities**: Task breakdown, timeline estimation, resource planning
- **Output**: Project roadmaps, technical specifications, task assignments

### Specialized Agents

#### **Backend Developer** 🔧
- API design and implementation
- Database schema design
- Microservices architecture
- Performance optimization

#### **Frontend Developer** 🎨
- UI/UX implementation
- Component architecture
- State management
- Responsive design

#### **DevOps Engineer** 🚀
- CI/CD pipelines
- Infrastructure as code
- Monitoring and alerting
- Deployment automation

#### **Security Specialist** 🔒
- Security audits
- Vulnerability assessment
- Compliance checking
- Secure coding practices

#### **Data Scientist** 📊
- Data analysis
- Machine learning models
- Statistical analysis
- Data visualization

## 🌐 Swarm Topologies

Choose the right coordination pattern for your task complexity and team size:

### Hierarchical 🌳
```
    Coordinator
   /     |     \
Agent-1 Agent-2 Agent-3
```
- **Best for**: Complex projects with clear task hierarchy
- **Pros**: Clear command structure, efficient coordination
- **Cons**: Single point of failure, limited parallelism

### Mesh 🕸️
```
Agent-1 ←→ Agent-2
   ↕         ↕
Agent-3 ←→ Agent-4
```
- **Best for**: Collaborative tasks requiring frequent communication
- **Pros**: High redundancy, flexible communication
- **Cons**: Network overhead, potential conflicts

### Ring 🔄
```
Agent-1 → Agent-2 → Agent-3
   ↑                   ↓
Agent-6 ← Agent-5 ← Agent-4
```
- **Best for**: Sequential workflows with feedback loops
- **Pros**: Ordered processing, predictable flow
- **Cons**: Bottlenecks, sequential dependencies

### Star ⭐
```
      Agent-1
        ↕
Agent-4 ←→ HUB ←→ Agent-2
        ↕
      Agent-3
```
- **Best for**: Simple coordination with central control
- **Pros**: Simple management, fast communication
- **Cons**: Central bottleneck, hub dependency

## 📖 Examples

Explore comprehensive examples in the [examples/](examples/) directory:

- **[Basic Swarm](examples/basic-swarm.md)**: Simple multi-agent coordination
- **[API Development](examples/api-development.md)**: Full-stack API with testing
- **[Code Review Workflow](examples/code-review.md)**: Automated code quality checks
- **[Documentation Generation](examples/documentation.md)**: Automated docs from code
- **[Complex Orchestration](examples/complex-orchestration.md)**: Enterprise-scale coordination

### Simple Example: Hello World API

```bash
# Initialize project
codex-flow init hello-api --template api

# Create development swarm
codex-flow swarm create \
  --topology hierarchical \
  --agents 3 \
  --types coder,tester,reviewer \
  --name api-team

# Execute the task
codex-flow task "
Create a Hello World REST API with:
- Express.js server
- GET /hello endpoint returning JSON
- Unit tests with Jest
- Error handling middleware
- Basic documentation
" --swarm api-team --track-progress
```

## 🔗 Related Projects

- **[Claude-Flow]**: Multi-agent orchestration for Claude
- **[Gemini-Flow]**: Google Gemini development toolkit
- **[BEAR AI]**: Privacy-first local AI development platform

## 📖 Documentation

- **[API Reference](docs/API.md)**: Complete API documentation
- **[Architecture Guide](docs/ARCHITECTURE.md)**: System design and components
- **[Contributing Guide](docs/CONTRIBUTING.md)**: Development guidelines
- **[Examples](examples/)**: Practical usage examples

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](docs/CONTRIBUTING.md) for details.

### Development Setup

```bash
git clone https://github.com/your-org/codex-flow.git
cd codex-flow
npm install
npm run dev
```

### Running Tests

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🔗 Links

- **Documentation**: [docs.codex-flow.dev](https://docs.codex-flow.dev)
- **NPM Package**: [npmjs.com/package/@bear_ai/codex-flow](https://npmjs.com/package/@bear_ai/codex-flow)
- **Issues**: [GitHub Issues](https://github.com/your-org/codex-flow/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/codex-flow/discussions)

---

**Built with ❤️ by the Codex-Flow team**

[Gemini-Flow]: https://github.com/clduab11/gemini-flow
[Claude-Flow]: https://github.com/ruvnet/claude-flow
[BEAR AI]: https://github.com/KingOfTheAce2/BEAR_AI
