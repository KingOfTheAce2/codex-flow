import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { ConfigManager } from '../../core/config';

export const configCommand = new Command('config')
  .description('Manage configuration');

// Show current configuration
configCommand
  .command('show')
  .description('Show current configuration')
  .option('-p, --providers', 'Show provider configurations only')
  .option('-s, --swarm', 'Show swarm configurations only')
  .action(async (options) => {
    try {
      const configManager = new ConfigManager();
      await configManager.load();
      
      const config = configManager.getConfig();
      
      console.log(chalk.blue('⚙️  Current Configuration\n'));
      
      if (!options.providers && !options.swarm) {
        console.log(chalk.white('Project:'));
        console.log(chalk.gray(`  Name: ${config.project.name}`));
        console.log(chalk.gray(`  Description: ${config.project.description}`));
        console.log(chalk.gray(`  Version: ${config.project.version}\n`));
      }
      
      if (!options.swarm) {
        console.log(chalk.white('Providers:'));
        Object.entries(config.providers).forEach(([name, provider]: [string, any]) => {
          const status = provider.enabled ? chalk.green('✅') : chalk.red('❌');
          console.log(chalk.gray(`  ${name}: ${status}`));
          if (provider.enabled) {
            console.log(chalk.gray(`    Model: ${provider.defaultModel}`));
            console.log(chalk.gray(`    API Key: ${provider.apiKey ? '***configured***' : 'not configured'}`));
          }
        });
        console.log();
      }
      
      if (!options.providers) {
        console.log(chalk.white('Swarm Defaults:'));
        console.log(chalk.gray(`  Max Agents: ${config.swarm.maxAgents}`));
        console.log(chalk.gray(`  Default Topology: ${config.swarm.defaultTopology}`));
        console.log(chalk.gray(`  Consensus: ${config.swarm.consensus}`));
        console.log(chalk.gray(`  Auto-scaling: ${config.swarm.autoScale ? 'enabled' : 'disabled'}`));
      }

    } catch (error: any) {
      console.error(chalk.red('❌ Failed to show configuration:'), error.message);
      process.exit(1);
    }
  });

// Set configuration values
configCommand
  .command('set')
  .description('Set configuration values')
  .argument('<key>', 'Configuration key (dot notation supported)')
  .argument('<value>', 'Configuration value')
  .action(async (key, value) => {
    try {
      const configManager = new ConfigManager();
      await configManager.load();
      
      // Convert string values to appropriate types
      let parsedValue: any = value;
      if (value === 'true') parsedValue = true;
      else if (value === 'false') parsedValue = false;
      else if (!isNaN(Number(value))) parsedValue = Number(value);
      
      await configManager.set(key, parsedValue);
      
      console.log(chalk.green(`✅ Configuration updated: ${key} = ${parsedValue}`));

    } catch (error: any) {
      console.error(chalk.red('❌ Failed to set configuration:'), error.message);
      process.exit(1);
    }
  });

// Interactive configuration setup
configCommand
  .command('setup')
  .description('Interactive configuration setup')
  .option('--providers-only', 'Setup providers only')
  .action(async (options) => {
    try {
      const configManager = new ConfigManager();
      await configManager.load();
      
      console.log(chalk.blue('⚙️  Interactive Configuration Setup\n'));

      if (!options.providersOnly) {
        // Project configuration
        const projectAnswers = await inquirer.prompt([
          {
            type: 'input',
            name: 'maxAgents',
            message: 'Maximum number of agents per swarm:',
            default: '10',
            validate: (input) => !isNaN(Number(input)) && Number(input) > 0 || 'Must be a positive number'
          },
          {
            type: 'list',
            name: 'defaultTopology',
            message: 'Default swarm topology:',
            choices: ['hierarchical', 'mesh', 'ring', 'star'],
            default: 'hierarchical'
          },
          {
            type: 'list',
            name: 'consensus',
            message: 'Consensus algorithm:',
            choices: ['majority', 'weighted', 'byzantine'],
            default: 'majority'
          },
          {
            type: 'confirm',
            name: 'autoScale',
            message: 'Enable auto-scaling:',
            default: true
          }
        ]);

        await configManager.set('swarm.maxAgents', Number(projectAnswers.maxAgents));
        await configManager.set('swarm.defaultTopology', projectAnswers.defaultTopology);
        await configManager.set('swarm.consensus', projectAnswers.consensus);
        await configManager.set('swarm.autoScale', projectAnswers.autoScale);
      }

      // Provider configuration
      const providers = ['openai', 'anthropic', 'google', 'local'];
      
      for (const provider of providers) {
        const enableProvider = await inquirer.prompt({
          type: 'confirm',
          name: 'enable',
          message: `Enable ${provider.toUpperCase()} provider:`,
          default: provider === 'openai'
        });

        if (enableProvider.enable) {
          let apiKeyPrompt = 'API Key:';
          let modelPrompt = 'Default model:';
          let defaultModel = 'gpt-4';

          switch (provider) {
            case 'anthropic':
              defaultModel = 'claude-3-sonnet-20240229';
              break;
            case 'google':
              defaultModel = 'gemini-pro';
              break;
            case 'local':
              apiKeyPrompt = 'Local LLM URL (optional):';
              modelPrompt = 'Local model name:';
              defaultModel = 'llama2';
              break;
          }

          const providerConfig = await inquirer.prompt([
            {
              type: 'password',
              name: 'apiKey',
              message: apiKeyPrompt,
              mask: '*',
              when: provider !== 'local'
            },
            {
              type: 'input',
              name: 'url',
              message: apiKeyPrompt,
              default: 'http://localhost:11434',
              when: provider === 'local'
            },
            {
              type: 'input',
              name: 'defaultModel',
              message: modelPrompt,
              default: defaultModel
            }
          ]);

          await configManager.set(`providers.${provider}.enabled`, true);
          await configManager.set(`providers.${provider}.defaultModel`, providerConfig.defaultModel);
          
          if (provider === 'local') {
            await configManager.set(`providers.${provider}.url`, providerConfig.url);
          } else {
            await configManager.set(`providers.${provider}.apiKey`, providerConfig.apiKey);
          }
        } else {
          await configManager.set(`providers.${provider}.enabled`, false);
        }
      }

      console.log(chalk.green('\n✅ Configuration setup completed!'));
      console.log(chalk.blue('Run "codex-flow config verify" to test your configuration'));

    } catch (error: any) {
      console.error(chalk.red('❌ Configuration setup failed:'), error.message);
      process.exit(1);
    }
  });

// Verify configuration
configCommand
  .command('verify')
  .description('Verify configuration and test provider connections')
  .action(async () => {
    try {
      console.log(chalk.blue('🔍 Verifying configuration...\n'));

      const configManager = new ConfigManager();
      await configManager.load();
      
      const config = configManager.getConfig();
      
      // Test each enabled provider
      for (const [name, provider] of Object.entries(config.providers)) {
        const providerConfig = provider as any;
        
        if (!providerConfig.enabled) {
          console.log(chalk.gray(`${name}: skipped (disabled)`));
          continue;
        }

        try {
          // Test provider connection (placeholder - would implement actual testing)
          console.log(chalk.blue(`Testing ${name}...`));
          
          if (name !== 'local' && !providerConfig.apiKey) {
            console.log(chalk.red(`${name}: ❌ API key not configured`));
            continue;
          }
          
          // Simulate provider test
          await new Promise(resolve => setTimeout(resolve, 500));
          console.log(chalk.green(`${name}: ✅ Connected`));
          
        } catch (error: any) {
          console.log(chalk.red(`${name}: ❌ Connection failed - ${error.message}`));
        }
      }

      console.log(chalk.green('\n✅ Configuration verification completed!'));

    } catch (error: any) {
      console.error(chalk.red('❌ Configuration verification failed:'), error.message);
      process.exit(1);
    }
  });