import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { ConfigManager } from '../../core/config';

export const initCommand = new Command('init')
  .description('Initialize a new codex-flow project')
  .option('-t, --template <template>', 'Project template (basic, api, documentation)', 'basic')
  .option('-d, --dir <directory>', 'Project directory', '.')
  .option('-n, --name <name>', 'Project name (non-interactive)')
  .option('--description <description>', 'Project description (non-interactive)')
  .option('-p, --providers <providers>', 'Comma-separated list of providers (openai,anthropic,google,local)')
  .option('-y, --yes', 'Skip interactive prompts and use defaults')
  .option('--no-bootstrap', 'Skip automatic bootstrap after init')
  .action(async (options) => {
    console.log(chalk.blue('🚀 Initializing Codex-Flow project...\n'));

    try {
      const projectDir = path.resolve(options.dir);
      
      // Ensure directory exists
      await fs.mkdir(projectDir, { recursive: true });

      let answers;

      if (options.yes || (options.name && options.providers)) {
        // Non-interactive mode
        answers = {
          projectName: options.name || path.basename(projectDir),
          description: options.description || 'A codex-flow multi-agent project',
          template: options.template,
          providers: options.providers ? options.providers.split(',') : ['openai']
        };
      } else {
        // Interactive project setup
        answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'projectName',
            message: 'Project name:',
            default: options.name || path.basename(projectDir)
          },
          {
            type: 'input',
            name: 'description',
            message: 'Project description:',
            default: options.description || 'A codex-flow multi-agent project'
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
      }

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

      // Set up MCP server configuration
      await setupMCPServers(projectDir);

      console.log(chalk.green('✅ Project initialized successfully!'));

      // Run bootstrap unless explicitly disabled
      if (!options.noBootstrap) {
        console.log(chalk.blue('\n🔧 Running bootstrap to complete setup...'));
        await runBootstrap(projectDir);
      } else {
        console.log(chalk.blue('\nNext steps:'));
        console.log('1. Run: npm run codex:bootstrap');
        console.log('2. Configure your AI providers in .env file');
        console.log('3. Run: npm run codex:verify');
        console.log('4. Start a swarm: npm run codex:swarm');
      }

    } catch (error: any) {
      console.error(chalk.red('❌ Failed to initialize project:'), error.message);
      process.exit(1);
    }
  });

async function runBootstrap(projectDir: string): Promise<void> {
  try {
    const isWindows = process.platform === 'win32';
    const bootstrapScript = isWindows ? 'bootstrap.ps1' : 'bootstrap.sh';
    const bootstrapPath = path.join(projectDir, 'scripts', 'codex', bootstrapScript);
    
    // Check if bootstrap script exists
    try {
      await fs.access(bootstrapPath);
    } catch (error) {
      console.log(chalk.yellow('⚠️  Bootstrap script not found, skipping automatic setup'));
      console.log(chalk.blue('Please run: npm run codex:bootstrap'));
      return;
    }
    
    const command = isWindows ? 'pwsh' : 'bash';
    const args = isWindows 
      ? ['-ExecutionPolicy', 'Bypass', '-File', bootstrapPath]
      : [bootstrapPath];
    
    const bootstrapProcess = spawn(command, args, {
      cwd: projectDir,
      stdio: 'inherit',
      shell: isWindows
    });
    
    await new Promise((resolve, reject) => {
      bootstrapProcess.on('close', (code) => {
        if (code === 0) {
          console.log(chalk.green('\n✅ Bootstrap completed successfully!'));
          resolve(code);
        } else {
          console.log(chalk.yellow(`⚠️  Bootstrap exited with code ${code}`));
          console.log(chalk.blue('You can run it manually with: npm run codex:bootstrap'));
          resolve(code); // Don't reject, just warn
        }
      });
      
      bootstrapProcess.on('error', (error) => {
        console.log(chalk.yellow(`⚠️  Bootstrap failed: ${error.message}`));
        console.log(chalk.blue('You can run it manually with: npm run codex:bootstrap'));
        resolve(1); // Don't reject, just warn
      });
    });
    
  } catch (error) {
    console.log(chalk.yellow(`⚠️  Bootstrap failed: ${error}`));
    console.log(chalk.blue('You can run it manually with: npm run codex:bootstrap'));
  }
}

async function createProjectStructure(projectDir: string, template: string): Promise<void> {
  const directories = [
    '.codex-flow',
    '.codex-flow/agents',
    '.codex-flow/memory',
    '.codex-flow/logs',
    'examples',
    'swarms',
    'tools',
    'configs',
    'scripts',
    'scripts/codex'
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

  // Copy bootstrap scripts from the codex-flow installation
  await copyBootstrapScripts(projectDir);
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

async function setupMCPServers(projectDir: string): Promise<void> {
  try {
    console.log(chalk.blue('🔧 Setting up MCP servers...'));
    
    // Create .mcp.json configuration
    const mcpConfig = {
      mcpServers: {
        "ruv-swarm": {
          command: "ruv-swarm-mcp",
          args: ["--stdio"],
          env: {
            RUST_LOG: "info"
          }
        }
      }
    };

    await fs.writeFile(
      path.join(projectDir, '.mcp.json'),
      JSON.stringify(mcpConfig, null, 2)
    );

    // Create Claude Code settings to enable MCP servers
    const claudeDir = path.join(projectDir, '.claude');
    await fs.mkdir(claudeDir, { recursive: true });
    
    const claudeSettings = {
      enableAllProjectMcpServers: true,
      enabledMcpjsonServers: ["ruv-swarm"]
    };

    await fs.writeFile(
      path.join(claudeDir, 'settings.local.json'),
      JSON.stringify(claudeSettings, null, 2)
    );

    // Update package.json to include MCP setup script
    const packageJsonPath = path.join(projectDir, 'package.json');
    try {
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);
      
      if (!packageJson.scripts) {
        packageJson.scripts = {};
      }
      
      packageJson.scripts['setup:mcp'] = 'npm install -g ruv-swarm-mcp || echo "Installing ruv-swarm-mcp globally..."';
      packageJson.scripts['postinstall'] = packageJson.scripts['postinstall'] 
        ? `${packageJson.scripts['postinstall']} && npm run setup:mcp`
        : 'npm run setup:mcp';

      // Add convenience scripts for bootstrap and development
      const isWindows = process.platform === 'win32';
      const bootstrapCommand = isWindows 
        ? 'pwsh -ExecutionPolicy Bypass -File scripts/codex/bootstrap.ps1'
        : 'bash scripts/codex/bootstrap.sh';

      packageJson.scripts['codex:bootstrap'] = bootstrapCommand;
      packageJson.scripts['codex:verify'] = 'codex-flow config verify && echo "Configuration: OK"';
      packageJson.scripts['codex:swarm'] = 'codex-flow swarm spawn "Build a simple hello world application" --providers auto --verbose';

      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
    } catch (error) {
      // If package.json doesn't exist, create a minimal one
      const isWindows = process.platform === 'win32';
      const bootstrapCommand = isWindows 
        ? 'pwsh -ExecutionPolicy Bypass -File scripts/codex/bootstrap.ps1'
        : 'bash scripts/codex/bootstrap.sh';

      const minimalPackageJson = {
        name: path.basename(projectDir),
        version: "1.0.0",
        description: "Codex-Flow project with MCP integration",
        scripts: {
          "setup:mcp": "npm install -g ruv-swarm-mcp || echo 'Installing ruv-swarm-mcp globally...'",
          "postinstall": "npm run setup:mcp",
          "codex:bootstrap": bootstrapCommand,
          "codex:verify": "codex-flow config verify && echo 'Configuration: OK'",
          "codex:swarm": "codex-flow swarm spawn 'Build a simple hello world application' --providers auto --verbose"
        },
        dependencies: {
          "@bear_ai/codex-flow": "^0.2.2-alpha"
        }
      };
      
      await fs.writeFile(packageJsonPath, JSON.stringify(minimalPackageJson, null, 2));
    }

    console.log(chalk.green('✅ MCP servers configuration created'));
    
  } catch (error: any) {
    console.warn(chalk.yellow('⚠️ Failed to setup MCP servers:'), error.message);
  }
}

async function copyBootstrapScripts(projectDir: string): Promise<void> {
  try {
    // Find the codex-flow installation directory
    const currentDir = __dirname;
    const packageRoot = path.join(currentDir, '..', '..', '..');
    const sourceScriptsDir = path.join(packageRoot, 'scripts', 'codex');
    const targetScriptsDir = path.join(projectDir, 'scripts', 'codex');

    // Check if source bootstrap scripts exist
    const psScript = path.join(sourceScriptsDir, 'bootstrap.ps1');
    const bashScript = path.join(sourceScriptsDir, 'bootstrap.sh');

    try {
      // Copy PowerShell script
      if (await fs.access(psScript).then(() => true).catch(() => false)) {
        await fs.copyFile(psScript, path.join(targetScriptsDir, 'bootstrap.ps1'));
      } else {
        // Create a basic PowerShell script if source doesn't exist
        await createBasicBootstrapPS1(targetScriptsDir);
      }

      // Copy Bash script  
      if (await fs.access(bashScript).then(() => true).catch(() => false)) {
        await fs.copyFile(bashScript, path.join(targetScriptsDir, 'bootstrap.sh'));
        
        // Make bash script executable
        try {
          await fs.chmod(path.join(targetScriptsDir, 'bootstrap.sh'), 0o755);
        } catch (chmodError) {
          // Ignore chmod errors on Windows
        }
      } else {
        // Create a basic bash script if source doesn't exist
        await createBasicBootstrapSh(targetScriptsDir);
      }

      console.log(chalk.green('✅ Bootstrap scripts created'));

    } catch (copyError) {
      // If copying fails, create basic bootstrap scripts
      await createBasicBootstrapPS1(targetScriptsDir);
      await createBasicBootstrapSh(targetScriptsDir);
      console.log(chalk.green('✅ Basic bootstrap scripts created'));
    }

  } catch (error: any) {
    console.warn(chalk.yellow('⚠️ Failed to create bootstrap scripts:'), error.message);
  }
}

async function createBasicBootstrapPS1(targetDir: string): Promise<void> {
  const basicScript = `# Basic Codex-Flow Bootstrap Script (PowerShell)
Write-Host "🔧 Starting basic bootstrap..." -ForegroundColor Blue

# Create .env if it doesn't exist
if (!(Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "✅ Created .env from .env.example" -ForegroundColor Green
    }
}

# Run config verify
try {
    codex-flow config verify
    Write-Host "✅ Configuration verified" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Configuration needs attention" -ForegroundColor Yellow
}

Write-Host "✅ Basic bootstrap completed!" -ForegroundColor Green
Write-Host "Add API keys to .env file and run 'codex-flow config verify'" -ForegroundColor Cyan
`;

  await fs.writeFile(path.join(targetDir, 'bootstrap.ps1'), basicScript);
}

async function createBasicBootstrapSh(targetDir: string): Promise<void> {
  const basicScript = `#!/bin/bash
# Basic Codex-Flow Bootstrap Script (Bash)

echo -e "\\033[34m🔧 Starting basic bootstrap...\\033[0m"

# Create .env if it doesn't exist
if [[ ! -f ".env" ]]; then
    if [[ -f ".env.example" ]]; then
        cp ".env.example" ".env"
        echo -e "\\033[32m✅ Created .env from .env.example\\033[0m"
    fi
fi

# Run config verify
if codex-flow config verify 2>/dev/null; then
    echo -e "\\033[32m✅ Configuration verified\\033[0m"
else
    echo -e "\\033[33m⚠️  Configuration needs attention\\033[0m"
fi

echo -e "\\033[32m✅ Basic bootstrap completed!\\033[0m"
echo -e "\\033[36mAdd API keys to .env file and run 'codex-flow config verify'\\033[0m"
`;

  await fs.writeFile(path.join(targetDir, 'bootstrap.sh'), basicScript);
  
  // Make executable
  try {
    await fs.chmod(path.join(targetDir, 'bootstrap.sh'), 0o755);
  } catch (error) {
    // Ignore chmod errors
  }
}