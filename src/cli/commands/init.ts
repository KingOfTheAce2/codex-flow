import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { promises as fs } from 'fs';
import path from 'path';
import { ConfigManager } from '../../core/config';

export const initCommand = new Command('init')
  .description('Initialize a new codex-flow project')
  .option('-t, --template <template>', 'Project template (basic, api, documentation)', 'basic')
  .option('-d, --dir <directory>', 'Project directory', '.')
  .action(async (options) => {
    console.log(chalk.blue('🚀 Initializing Codex-Flow project...\n'));

    try {
      const projectDir = path.resolve(options.dir);
      
      // Ensure directory exists
      await fs.mkdir(projectDir, { recursive: true });

      // Interactive project setup
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'projectName',
          message: 'Project name:',
          default: path.basename(projectDir)
        },
        {
          type: 'input',
          name: 'description',
          message: 'Project description:',
          default: 'A codex-flow multi-agent project'
        },
        {
          type: 'list',
          name: 'template',
          message: 'Choose a template:',
          choices: [
            { name: 'Basic - Simple swarm setup', value: 'basic' },
            { name: 'API Development - Full-stack API with testing', value: 'api' },
            { name: 'Documentation - Automated docs from code', value: 'documentation' }
          ],
          default: options.template
        },
        {
          type: 'checkbox',
          name: 'providers',
          message: 'Select AI providers to configure:',
          choices: [
            { name: 'OpenAI (GPT-4, Codex)', value: 'openai', checked: true },
            { name: 'Anthropic Claude', value: 'anthropic' },
            { name: 'Google Gemini', value: 'google' },
            { name: 'Local LLM (Ollama, LMStudio)', value: 'local' }
          ]
        }
      ]);

      // Create project structure
      await createProjectStructure(projectDir, answers.template);
      
      // Initialize configuration
      const configManager = new ConfigManager(projectDir);
      await configManager.initialize({
        projectName: answers.projectName,
        description: answers.description,
        template: answers.template,
        providers: answers.providers
      });

      // Create template-specific files
      await createTemplateFiles(projectDir, answers.template);

      console.log(chalk.green('✅ Project initialized successfully!'));
      console.log(chalk.blue('\nNext steps:'));
      console.log('1. Configure your AI providers in .env file');
      console.log('2. Run: codex-flow config verify');
      console.log('3. Start a swarm: codex-flow swarm spawn');

    } catch (error: any) {
      console.error(chalk.red('❌ Failed to initialize project:'), error.message);
      process.exit(1);
    }
  });

async function createProjectStructure(projectDir: string, template: string): Promise<void> {
  const directories = [
    '.codex-flow',
    '.codex-flow/agents',
    '.codex-flow/memory',
    '.codex-flow/logs',
    'swarms',
    'tools',
    'configs'
  ];

  for (const dir of directories) {
    await fs.mkdir(path.join(projectDir, dir), { recursive: true });
  }
}

async function createTemplateFiles(projectDir: string, template: string): Promise<void> {
  // Create .env.example
  const envExample = `# AI Provider Configuration
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
GOOGLE_API_KEY=your_google_api_key_here

# Local LLM Configuration (Optional)
LOCAL_LLM_URL=http://localhost:11434
LOCAL_LLM_MODEL=llama2

# Codex-Flow Configuration
CODEX_FLOW_LOG_LEVEL=info
CODEX_FLOW_MAX_AGENTS=10
CODEX_FLOW_MEMORY_SIZE=100
`;
  
  await fs.writeFile(path.join(projectDir, '.env.example'), envExample);

  // Create basic swarm configuration
  const basicSwarmConfig = {
    name: 'default-swarm',
    description: 'Default swarm configuration',
    agents: {
      coordinator: {
        type: 'coordinator',
        provider: 'openai',
        model: 'gpt-4',
        role: 'Coordinates tasks between agents'
      },
      coder: {
        type: 'coder',
        provider: 'openai', 
        model: 'gpt-4',
        role: 'Writes and reviews code'
      },
      tester: {
        type: 'tester',
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        role: 'Tests and validates code'
      }
    },
    topology: 'hierarchical',
    maxAgents: 5,
    consensus: 'majority'
  };

  await fs.writeFile(
    path.join(projectDir, 'swarms', 'default.json'),
    JSON.stringify(basicSwarmConfig, null, 2)
  );

  // Template-specific files
  switch (template) {
    case 'api':
      await createAPITemplate(projectDir);
      break;
    case 'documentation':
      await createDocumentationTemplate(projectDir);
      break;
    default:
      await createBasicTemplate(projectDir);
  }
}

async function createBasicTemplate(projectDir: string): Promise<void> {
  const exampleTask = `# Basic Multi-Agent Task Example

## Objective
Create a simple "Hello World" application using a coordinated swarm.

## Swarm Configuration
- Coordinator: Plans and delegates tasks
- Coder: Implements the application
- Tester: Validates the implementation

## Usage
\`\`\`bash
codex-flow swarm spawn "Create a hello world app"
\`\`\`
`;

  await fs.writeFile(path.join(projectDir, 'examples', 'basic-task.md'), exampleTask);
}

async function createAPITemplate(projectDir: string): Promise<void> {
  // More complex API development template files would go here
  const apiConfig = {
    name: 'api-development-swarm',
    agents: {
      architect: { type: 'architect', role: 'Design API structure' },
      backend_dev: { type: 'coder', role: 'Implement backend' },
      frontend_dev: { type: 'coder', role: 'Implement frontend' },
      tester: { type: 'tester', role: 'Write and run tests' },
      reviewer: { type: 'reviewer', role: 'Code review and quality assurance' }
    }
  };
  
  await fs.writeFile(
    path.join(projectDir, 'swarms', 'api-development.json'),
    JSON.stringify(apiConfig, null, 2)
  );
}

async function createDocumentationTemplate(projectDir: string): Promise<void> {
  // Documentation-focused template
  const docConfig = {
    name: 'documentation-swarm',
    agents: {
      analyzer: { type: 'analyzer', role: 'Analyze code structure' },
      writer: { type: 'writer', role: 'Generate documentation' },
      reviewer: { type: 'reviewer', role: 'Review and improve docs' }
    }
  };
  
  await fs.writeFile(
    path.join(projectDir, 'swarms', 'documentation.json'),
    JSON.stringify(docConfig, null, 2)
  );
}