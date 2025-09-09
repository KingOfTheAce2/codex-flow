import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { SwarmManager } from '../../core/swarm/SwarmManager';
import { ConfigManager } from '../../core/config';
import { ProviderManager } from '../../core/providers/ProviderManager';
import { MemoryManager } from '../../core/memory/MemoryManager';
import { MCPSwarmManager } from '../../mcp/mcp-swarm-manager';
import { initializeMCP } from '../../mcp';

export const swarmCommand = new Command('swarm')
  .description('Manage agent swarms');

// Spawn a new swarm
swarmCommand
  .command('spawn')
  .description('Spawn a new agent swarm with MCP tool support')
  .argument('[objective]', 'Swarm objective')
  .option('-c, --config <config>', 'Swarm configuration file', 'default')
  .option('-m, --max-agents <number>', 'Maximum number of agents', '5')
  .option('-t, --topology <topology>', 'Swarm topology (hierarchical, mesh, ring, star)', 'hierarchical')
  .option('--providers <providers...>', 'AI providers to use')
  .option('--mcp-servers <servers...>', 'MCP servers to connect to')
  .option('--allow-tools <tools...>', 'Allowed MCP tools')
  .option('--block-tools <tools...>', 'Blocked MCP tools')
  .option('--allow-all-tools', 'Allow all MCP tools')
  .option('--no-mcp', 'Disable MCP tool integration')
  .option('--auto-scale', 'Enable auto-scaling')
  .option('--verbose', 'Verbose logging')
  .action(async (objective, options) => {
    try {
      const configManager = new ConfigManager();
      await configManager.load();

      // Create managers
      const config = configManager.getConfig();
      const memoryManager = new MemoryManager({
        maxSize: config.swarm.memorySize || 100
      });
      const providerManager = new ProviderManager({
        providers: config.providers,
        defaultProvider: 'openai',
        loadBalancing: { enabled: true, strategy: 'round-robin' }
      });

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

      console.log(chalk.blue('🐝 Spawning MCP-enhanced swarm...\n'));
      console.log(chalk.white(`Objective: ${swarmObjective}`));
      console.log(chalk.white(`Configuration: ${options.config}`));
      console.log(chalk.white(`Topology: ${options.topology}`));
      console.log(chalk.white(`Max Agents: ${options.maxAgents}`));

      // Initialize MCP if not disabled
      let mcpSwarmManager;
      if (!options.noMcp) {
        try {
          console.log(chalk.gray('Initializing MCP integration...'));
          const { registry, toolRegistry } = await initializeMCP();
          mcpSwarmManager = new MCPSwarmManager(memoryManager, providerManager, registry, toolRegistry);
          
          // Test MCP integration
          const mcpTest = await mcpSwarmManager.testMCPIntegration();
          if (mcpTest.success) {
            console.log(chalk.green(`✅ MCP initialized: ${mcpTest.connectedServers.length} servers, ${mcpTest.availableTools.length} tools`));
          } else {
            console.log(chalk.yellow(`⚠️  MCP partially initialized: ${mcpTest.errors.join(', ')}`));
          }
        } catch (mcpError) {
          console.log(chalk.yellow(`⚠️  MCP initialization failed, using standard swarm: ${(mcpError as Error).message}`));
          mcpSwarmManager = null;
        }
      }

      console.log();

      // Prepare tool permissions
      const toolPermissions = {
        allowAll: options.allowAllTools,
        allowedTools: options.allowTools,
        blockedTools: options.blockTools
      };

      // Spawn MCP-enhanced or regular swarm
      if (mcpSwarmManager && !options.noMcp) {
        const result = await mcpSwarmManager.spawnMCPTask(swarmObjective, {
          swarmConfig: {
            topology: options.topology,
            maxAgents: parseInt(options.maxAgents),
            autoScale: options.autoScale
          },
          providers: options.providers,
          verbose: options.verbose,
          enabledMCPServers: options.mcpServers,
          toolPermissions
        });

        console.log(chalk.green('✅ MCP-enhanced swarm task completed!'));
        console.log(chalk.blue('Result:\n'));
        console.log(result);

        // Show MCP stats
        if (options.verbose) {
          const stats = mcpSwarmManager.getMCPStats();
          console.log(chalk.gray('\nMCP Statistics:'));
          console.log(chalk.gray(`  Connected Servers: ${stats.connectedServers}`));
          console.log(chalk.gray(`  Available Tools: ${stats.totalTools}`));
          console.log(chalk.gray(`  Tools by Server:`));
          Object.entries(stats.toolsByServer).forEach(([server, count]) => {
            console.log(chalk.gray(`    ${server}: ${count} tools`));
          });
        }
      } else {
        // Fallback to regular swarm
        console.log(chalk.yellow('Using standard swarm (MCP disabled)'));
        const swarmManager = new SwarmManager({
          memoryManager,
          providerManager
        });
        
        // This would need to be implemented in the base SwarmManager
        console.log(chalk.blue('Standard swarm execution not yet implemented in this version'));
      }

    } catch (error: any) {
      console.error(chalk.red('❌ Failed to spawn swarm:'), error.message);
      if (options.verbose) {
        console.error(chalk.gray(error.stack));
      }
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