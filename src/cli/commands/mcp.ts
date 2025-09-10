/**
 * MCP Command
 * 
 * CLI commands for managing MCP (Model Context Protocol) servers and tools
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { initializeMCP } from '../../mcp/index.js';

export const mcpCommand = new Command('mcp')
  .description('Manage MCP servers and tools');

// List MCP servers
mcpCommand
  .command('list')
  .description('List all configured MCP servers')
  .option('-s, --status', 'Show server status')
  .action(async (options) => {
    try {
      console.log(chalk.blue('📡 MCP Servers\n'));
      
      const { registry } = await initializeMCP();
      const config = registry.getConfig();
      const servers = Object.entries(config.mcpServers);
      
      if (servers.length === 0) {
        console.log(chalk.yellow('No MCP servers configured'));
        return;
      }

      if (options.status) {
        const statuses = await registry.getServerStatus();
        
        statuses.forEach(status => {
          const healthColor = status.health === 'healthy' ? 'green' : 
                             status.health === 'unhealthy' ? 'red' : 'yellow';
          
          console.log(chalk.white(`${status.id}`));
          console.log(chalk.gray(`  Status: ${chalk[healthColor](status.health)}`));
          console.log(chalk.gray(`  Connected: ${status.connected ? '✅' : '❌'}`));
          console.log(chalk.gray(`  Tools: ${status.toolCount}`));
          console.log(chalk.gray(`  Resources: ${status.resourceCount}`));
          console.log(chalk.gray(`  Prompts: ${status.promptCount}\n`));
        });
      } else {
        servers.forEach(([id, config]) => {
          console.log(chalk.white(`${id}`));
          console.log(chalk.gray(`  Command: ${config.command} ${config.args.join(' ')}`));
          console.log(chalk.gray(`  Enabled: ${config.enabled ? '✅' : '❌'}`));
          console.log(chalk.gray(`  Auto-start: ${config.autoStart ? '✅' : '❌'}`));
          if (config.description) {
            console.log(chalk.gray(`  Description: ${config.description}`));
          }
          console.log();
        });
      }

    } catch (error) {
      console.error(chalk.red('❌ Failed to list MCP servers:'), (error as Error).message);
      process.exit(1);
    }
  });

// Add MCP server
mcpCommand
  .command('add')
  .description('Add a new MCP server')
  .argument('[id]', 'Server ID')
  .option('-c, --command <command>', 'Server command')
  .option('-a, --args <args...>', 'Server arguments')
  .option('-d, --description <description>', 'Server description')
  .option('--env <env...>', 'Environment variables (KEY=VALUE format)')
  .option('--cwd <cwd>', 'Working directory')
  .option('--timeout <timeout>', 'Connection timeout in ms', '10000')
  .option('--no-auto-start', 'Disable auto-start')
  .option('--no-enable', 'Add but keep disabled')
  .action(async (id, options) => {
    try {
      let serverId = id;
      let command = options.command;
      let args = options.args || [];
      let description = options.description;

      // Interactive mode if not all options provided
      if (!serverId) {
        const answer = await inquirer.prompt({
          type: 'input',
          name: 'id',
          message: 'Server ID:',
          validate: (input) => input.length > 0 || 'Server ID is required'
        });
        serverId = answer.id;
      }

      if (!command) {
        const answer = await inquirer.prompt({
          type: 'input',
          name: 'command',
          message: 'Server command:',
          validate: (input) => input.length > 0 || 'Command is required'
        });
        command = answer.command;
      }

      if (args.length === 0) {
        const answer = await inquirer.prompt({
          type: 'input',
          name: 'args',
          message: 'Server arguments (space-separated):',
          default: ''
        });
        args = answer.args ? answer.args.split(' ') : [];
      }

      if (!description) {
        const answer = await inquirer.prompt({
          type: 'input',
          name: 'description',
          message: 'Description (optional):',
          default: ''
        });
        description = answer.description || undefined;
      }

      // Parse environment variables
      const env: Record<string, string> = {};
      if (options.env) {
        for (const envVar of options.env) {
          const [key, value] = envVar.split('=', 2);
          if (key && value) {
            env[key] = value;
          }
        }
      }

      const { registry } = await initializeMCP();
      
      await registry.addServer({
        id: serverId,
        command,
        args,
        description,
        env: Object.keys(env).length > 0 ? env : undefined,
        cwd: options.cwd,
        timeout: parseInt(options.timeout),
        maxRetries: 3,
        tags: [],
        autoStart: !options.noAutoStart,
        enabled: !options.noEnable
      });

      console.log(chalk.green(`✅ Added MCP server: ${serverId}`));

    } catch (error) {
      console.error(chalk.red('❌ Failed to add MCP server:'), (error as Error).message);
      process.exit(1);
    }
  });

// Remove MCP server
mcpCommand
  .command('remove')
  .alias('rm')
  .description('Remove an MCP server')
  .argument('<id>', 'Server ID')
  .option('-f, --force', 'Force removal without confirmation')
  .action(async (id, options) => {
    try {
      if (!options.force) {
        const answer = await inquirer.prompt({
          type: 'confirm',
          name: 'confirm',
          message: `Remove MCP server '${id}'?`,
          default: false
        });

        if (!answer.confirm) {
          console.log(chalk.yellow('Operation cancelled'));
          return;
        }
      }

      const { registry } = await initializeMCP();
      await registry.removeServer(id);

      console.log(chalk.green(`✅ Removed MCP server: ${id}`));

    } catch (error) {
      console.error(chalk.red('❌ Failed to remove MCP server:'), (error as Error).message);
      process.exit(1);
    }
  });

// Test MCP server
mcpCommand
  .command('test')
  .description('Test connection to an MCP server')
  .argument('<id>', 'Server ID')
  .option('-v, --verbose', 'Verbose output')
  .action(async (id, options) => {
    try {
      console.log(chalk.blue(`🔍 Testing MCP server: ${id}\n`));

      const { registry } = await initializeMCP();
      const result = await registry.testServer(id);

      if (result.success) {
        console.log(chalk.green('✅ Connection successful'));
        if (result.tools && result.tools.length > 0) {
          console.log(chalk.blue(`Available tools: ${result.tools.length}`));
          if (options.verbose) {
            result.tools.forEach(tool => {
              console.log(chalk.gray(`  - ${tool}`));
            });
          }
        } else {
          console.log(chalk.yellow('No tools available'));
        }
      } else {
        console.log(chalk.red('❌ Connection failed'));
        if (result.error) {
          console.log(chalk.red(`Error: ${result.error}`));
        }
      }

    } catch (error) {
      console.error(chalk.red('❌ Test failed:'), (error as Error).message);
      process.exit(1);
    }
  });

// Connect to MCP servers
mcpCommand
  .command('connect')
  .description('Connect to MCP servers')
  .argument('[ids...]', 'Server IDs (connect to all if not specified)')
  .action(async (ids) => {
    try {
      const { registry } = await initializeMCP();

      if (ids && ids.length > 0) {
        console.log(chalk.blue(`📡 Connecting to MCP servers: ${ids.join(', ')}\n`));
        
        for (const id of ids) {
          try {
            const connected = await registry.connectServer(id);
            if (connected) {
              console.log(chalk.green(`✅ Connected to ${id}`));
            } else {
              console.log(chalk.red(`❌ Failed to connect to ${id}`));
            }
          } catch (error) {
            console.log(chalk.red(`❌ Error connecting to ${id}: ${(error as Error).message}`));
          }
        }
      } else {
        console.log(chalk.blue('📡 Connecting to all enabled MCP servers...\n'));
        await registry.connectAll();
        
        const statuses = await registry.getServerStatus();
        const connected = statuses.filter(s => s.connected);
        const failed = statuses.filter(s => !s.connected);
        
        console.log(chalk.green(`✅ Connected: ${connected.length} servers`));
        if (failed.length > 0) {
          console.log(chalk.red(`❌ Failed: ${failed.length} servers`));
        }
      }

    } catch (error) {
      console.error(chalk.red('❌ Connection failed:'), (error as Error).message);
      process.exit(1);
    }
  });

// Disconnect from MCP servers
mcpCommand
  .command('disconnect')
  .description('Disconnect from all MCP servers')
  .action(async () => {
    try {
      console.log(chalk.blue('📡 Disconnecting from MCP servers...'));

      const { registry } = await initializeMCP();
      await registry.disconnectAll();

      console.log(chalk.green('✅ Disconnected from all MCP servers'));

    } catch (error) {
      console.error(chalk.red('❌ Disconnect failed:'), (error as Error).message);
      process.exit(1);
    }
  });

// List available tools
mcpCommand
  .command('tools')
  .description('List available MCP tools')
  .option('-s, --server <server>', 'Filter by server')
  .option('-v, --verbose', 'Show detailed information')
  .action(async (options) => {
    try {
      const { registry, toolRegistry } = await initializeMCP();
      await registry.connectAll();

      const tools = registry.getAllTools();
      
      if (tools.length === 0) {
        console.log(chalk.yellow('No tools available (no MCP servers connected)'));
        return;
      }

      console.log(chalk.blue(`🛠️  Available MCP Tools (${tools.length})\n`));

      const filteredTools = options.server 
        ? tools.filter(t => t.serverId === options.server)
        : tools;

      if (filteredTools.length === 0) {
        console.log(chalk.yellow(`No tools found${options.server ? ` for server: ${options.server}` : ''}`));
        return;
      }

      // Group by server
      const toolsByServer = filteredTools.reduce((acc, tool) => {
        if (!acc[tool.serverId]) {
          acc[tool.serverId] = [];
        }
        acc[tool.serverId].push(tool);
        return acc;
      }, {} as Record<string, typeof tools>);

      Object.entries(toolsByServer).forEach(([serverId, serverTools]) => {
        console.log(chalk.white(`${serverId} (${serverTools.length} tools):`));
        
        serverTools.forEach(tool => {
          console.log(chalk.gray(`  • ${tool.toolName}`));
          if (options.verbose && tool.description) {
            console.log(chalk.gray(`    ${tool.description}`));
          }
        });
        console.log();
      });

    } catch (error) {
      console.error(chalk.red('❌ Failed to list tools:'), (error as Error).message);
      process.exit(1);
    }
  });

// Enable/disable server
mcpCommand
  .command('enable')
  .description('Enable an MCP server')
  .argument('<id>', 'Server ID')
  .action(async (id) => {
    try {
      const { registry } = await initializeMCP();
      await registry.setServerEnabled(id, true);
      console.log(chalk.green(`✅ Enabled MCP server: ${id}`));
    } catch (error) {
      console.error(chalk.red('❌ Failed to enable server:'), (error as Error).message);
      process.exit(1);
    }
  });

mcpCommand
  .command('disable')
  .description('Disable an MCP server')
  .argument('<id>', 'Server ID')
  .action(async (id) => {
    try {
      const { registry } = await initializeMCP();
      await registry.setServerEnabled(id, false);
      console.log(chalk.green(`✅ Disabled MCP server: ${id}`));
    } catch (error) {
      console.error(chalk.red('❌ Failed to disable server:'), (error as Error).message);
      process.exit(1);
    }
  });

export default mcpCommand;