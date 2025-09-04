import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { SwarmManager } from '../../core/swarm/SwarmManager';
import { ConfigManager } from '../../core/config';

export const swarmCommand = new Command('swarm')
  .description('Manage agent swarms');

// Spawn a new swarm
swarmCommand
  .command('spawn')
  .description('Spawn a new agent swarm')
  .argument('[objective]', 'Swarm objective')
  .option('-c, --config <config>', 'Swarm configuration file', 'default')
  .option('-m, --max-agents <number>', 'Maximum number of agents', '5')
  .option('-t, --topology <topology>', 'Swarm topology (hierarchical, mesh, ring, star)', 'hierarchical')
  .option('--providers <providers...>', 'AI providers to use')
  .option('--auto-scale', 'Enable auto-scaling')
  .option('--verbose', 'Verbose logging')
  .action(async (objective, options) => {
    try {
      const configManager = new ConfigManager();
      await configManager.load();

      let swarmObjective = objective;
      
      if (!swarmObjective) {
        const answer = await inquirer.prompt({
          type: 'input',
          name: 'objective',
          message: 'What is the swarm objective?',
          validate: (input) => input.length > 0 || 'Objective is required'
        });
        swarmObjective = answer.objective;
      }

      console.log(chalk.blue('🐝 Spawning new swarm...\n'));
      console.log(chalk.white(`Objective: ${swarmObjective}`));
      console.log(chalk.white(`Configuration: ${options.config}`));
      console.log(chalk.white(`Topology: ${options.topology}`));
      console.log(chalk.white(`Max Agents: ${options.maxAgents}\n`));

      const swarmManager = new SwarmManager(configManager.getConfig());
      
      const swarm = await swarmManager.spawn({
        objective: swarmObjective,
        config: options.config,
        maxAgents: parseInt(options.maxAgents),
        topology: options.topology,
        providers: options.providers,
        autoScale: options.autoScale,
        verbose: options.verbose
      });

      console.log(chalk.green('✅ Swarm spawned successfully!'));
      console.log(chalk.blue(`Swarm ID: ${swarm.getId()}`));
      const agents = swarm.getAgents();
      console.log(chalk.blue(`Active Agents: ${agents.length}`));
      
      if (options.verbose) {
        console.log(chalk.gray('\nAgents:'));
        agents.forEach(agent => {
          console.log(chalk.gray(`  - ${agent.getName()} (${agent.getType()}): ${agent.getRole()}`));
        });
      }

      // Start execution
      console.log(chalk.blue('\n🚀 Starting swarm execution...'));
      await swarm.execute();

    } catch (error: any) {
      console.error(chalk.red('❌ Failed to spawn swarm:'), error.message);
      process.exit(1);
    }
  });

// List active swarms
swarmCommand
  .command('list')
  .description('List all active swarms')
  .option('-a, --all', 'Show all swarms (including completed)')
  .action(async (options) => {
    try {
      const configManager = new ConfigManager();
      const swarmManager = new SwarmManager(configManager.getConfig());
      
      const swarms = await swarmManager.list(options.all);
      
      if (swarms.length === 0) {
        console.log(chalk.yellow('No swarms found'));
        return;
      }

      console.log(chalk.blue('🐝 Active Swarms\n'));
      
      swarms.forEach(swarm => {
        console.log(chalk.white(`${swarm.id} - ${swarm.name}`));
        console.log(chalk.gray(`  Status: ${swarm.status}`));
        console.log(chalk.gray(`  Objective: ${swarm.objective}`));
        console.log(chalk.gray(`  Agents: ${swarm.agents.length}`));
        console.log(chalk.gray(`  Created: ${new Date(swarm.createdAt).toLocaleString()}\n`));
      });

    } catch (error: any) {
      console.error(chalk.red('❌ Failed to list swarms:'), error.message);
      process.exit(1);
    }
  });

// Show swarm status
swarmCommand
  .command('status')
  .description('Show status of a specific swarm')
  .argument('<swarm-id>', 'Swarm ID')
  .action(async (swarmId) => {
    try {
      const configManager = new ConfigManager();
      const swarmManager = new SwarmManager(configManager.getConfig());
      
      const swarm = await swarmManager.getSwarm(swarmId);
      
      if (!swarm) {
        console.log(chalk.red(`Swarm ${swarmId} not found`));
        return;
      }

      const status = swarm.getStatus();
      
      console.log(chalk.blue(`🐝 Swarm Status: ${status.name}\n`));
      console.log(chalk.white(`ID: ${status.id}`));
      console.log(chalk.white(`Status: ${status.status}`));
      console.log(chalk.white(`Objective: ${status.objective}`));
      console.log(chalk.white(`Topology: ${status.topology}`));
      console.log(chalk.white(`Created: ${status.createdAt.toLocaleString()}`));
      
      if (status.completedAt) {
        console.log(chalk.white(`Completed: ${status.completedAt.toLocaleString()}`));
      }

      console.log(chalk.blue('\nAgents:'));
      status.agents.forEach(agent => {
        console.log(chalk.white(`  ${agent.name} (${agent.type})`));
        console.log(chalk.gray(`    Status: ${agent.status}`));
        console.log(chalk.gray(`    Role: ${agent.role}`));
        console.log(chalk.gray(`    Tasks Completed: ${agent.tasksCompleted || 0}`));
      });

      if (status.currentTask) {
        console.log(chalk.blue('\nCurrent Task:'));
        console.log(chalk.white(`  ${status.currentTask.description}`));
        console.log(chalk.gray(`  Assigned to: ${status.currentTask.assignedAgent}`));
        console.log(chalk.gray(`  Status: ${status.currentTask.status}`));
      }

    } catch (error: any) {
      console.error(chalk.red('❌ Failed to get swarm status:'), error.message);
      process.exit(1);
    }
  });

// Stop a swarm
swarmCommand
  .command('stop')
  .description('Stop a running swarm')
  .argument('<swarm-id>', 'Swarm ID')
  .option('-f, --force', 'Force stop without confirmation')
  .action(async (swarmId, options) => {
    try {
      if (!options.force) {
        const answer = await inquirer.prompt({
          type: 'confirm',
          name: 'confirm',
          message: `Are you sure you want to stop swarm ${swarmId}?`
        });
        
        if (!answer.confirm) {
          console.log(chalk.yellow('Operation cancelled'));
          return;
        }
      }

      const configManager = new ConfigManager();
      const swarmManager = new SwarmManager(configManager.getConfig());
      
      await swarmManager.stop(swarmId);
      
      console.log(chalk.green(`✅ Swarm ${swarmId} stopped successfully`));

    } catch (error: any) {
      console.error(chalk.red('❌ Failed to stop swarm:'), error.message);
      process.exit(1);
    }
  });