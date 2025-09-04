import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { TaskManager } from '../../core/tasks/TaskManager';
import { ConfigManager } from '../../core/config';

export const taskCommand = new Command('task')
  .description('Manage individual tasks');

// Create a new task
taskCommand
  .command('create')
  .description('Create a new task')
  .argument('[description]', 'Task description')
  .option('-p, --priority <priority>', 'Task priority (low, medium, high, critical)', 'medium')
  .option('-a, --assign <agent>', 'Assign to specific agent')
  .option('-s, --swarm <swarm-id>', 'Assign to swarm')
  .option('--dependencies <tasks...>', 'Dependent task IDs')
  .action(async (description, options) => {
    try {
      let taskDescription = description;
      
      if (!taskDescription) {
        const answer = await inquirer.prompt({
          type: 'input',
          name: 'description',
          message: 'Task description:',
          validate: (input) => input.length > 0 || 'Description is required'
        });
        taskDescription = answer.description;
      }

      console.log(chalk.blue('📝 Creating new task...\n'));

      const configManager = new ConfigManager();
      const taskManager = new TaskManager(configManager.getConfig());
      
      const task = await taskManager.create({
        description: taskDescription,
        priority: options.priority,
        assignedAgent: options.assign,
        swarmId: options.swarm,
        dependencies: options.dependencies || []
      });

      console.log(chalk.green('✅ Task created successfully!'));
      console.log(chalk.blue(`Task ID: ${task.id}`));
      console.log(chalk.white(`Description: ${task.description}`));
      console.log(chalk.white(`Priority: ${task.priority}`));
      console.log(chalk.white(`Status: ${task.status}`));
      
      if (task.assignedAgent) {
        console.log(chalk.white(`Assigned to: ${task.assignedAgent}`));
      }

    } catch (error: any) {
      console.error(chalk.red('❌ Failed to create task:'), error.message);
      process.exit(1);
    }
  });

// List tasks
taskCommand
  .command('list')
  .description('List tasks')
  .option('-s, --swarm <swarm-id>', 'Filter by swarm')
  .option('-a, --agent <agent>', 'Filter by agent')
  .option('--status <status>', 'Filter by status (pending, in_progress, completed, failed)')
  .option('--priority <priority>', 'Filter by priority (low, medium, high, critical)')
  .action(async (options) => {
    try {
      const configManager = new ConfigManager();
      const taskManager = new TaskManager(configManager.getConfig());
      
      const tasks = await taskManager.list({
        swarmId: options.swarm,
        assignedAgent: options.agent,
        status: options.status,
        priority: options.priority
      });
      
      if (tasks.length === 0) {
        console.log(chalk.yellow('No tasks found'));
        return;
      }

      console.log(chalk.blue('📋 Tasks\n'));
      
      tasks.forEach(task => {
        const priorityColor = {
          low: chalk.gray,
          medium: chalk.blue,
          high: chalk.yellow,
          critical: chalk.red
        }[task.priority] || chalk.white;

        console.log(chalk.white(`${task.id} - ${task.description}`));
        console.log(chalk.gray(`  Status: ${task.status}`));
        console.log(priorityColor(`  Priority: ${task.priority}`));
        
        if (task.assignedAgent) {
          console.log(chalk.gray(`  Assigned to: ${task.assignedAgent}`));
        }
        
        if (task.swarmId) {
          console.log(chalk.gray(`  Swarm: ${task.swarmId}`));
        }
        
        console.log(chalk.gray(`  Created: ${new Date(task.createdAt).toLocaleString()}\n`));
      });

    } catch (error: any) {
      console.error(chalk.red('❌ Failed to list tasks:'), error.message);
      process.exit(1);
    }
  });

// Show task details
taskCommand
  .command('show')
  .description('Show task details')
  .argument('<task-id>', 'Task ID')
  .action(async (taskId) => {
    try {
      const configManager = new ConfigManager();
      const taskManager = new TaskManager(configManager.getConfig());
      
      const task = await taskManager.get(taskId);
      
      if (!task) {
        console.log(chalk.red(`Task ${taskId} not found`));
        return;
      }

      console.log(chalk.blue(`📋 Task: ${task.description}\n`));
      console.log(chalk.white(`ID: ${task.id}`));
      console.log(chalk.white(`Status: ${task.status}`));
      console.log(chalk.white(`Priority: ${task.priority}`));
      console.log(chalk.white(`Created: ${new Date(task.createdAt).toLocaleString()}`));
      
      if (task.assignedAgent) {
        console.log(chalk.white(`Assigned to: ${task.assignedAgent}`));
      }
      
      if (task.swarmId) {
        console.log(chalk.white(`Swarm: ${task.swarmId}`));
      }
      
      if (task.dependencies.length > 0) {
        console.log(chalk.white(`Dependencies: ${task.dependencies.join(', ')}`));
      }
      
      if (task.completedAt) {
        console.log(chalk.white(`Completed: ${new Date(task.completedAt).toLocaleString()}`));
      }

      if (task.result) {
        console.log(chalk.blue('\nResult:'));
        console.log(chalk.gray(task.result));
      }

      if (task.error) {
        console.log(chalk.red('\nError:'));
        console.log(chalk.red(task.error));
      }

    } catch (error: any) {
      console.error(chalk.red('❌ Failed to get task details:'), error.message);
      process.exit(1);
    }
  });

// Update task status
taskCommand
  .command('update')
  .description('Update task status')
  .argument('<task-id>', 'Task ID')
  .option('-s, --status <status>', 'New status (pending, in_progress, completed, failed)')
  .option('-a, --assign <agent>', 'Assign to agent')
  .option('-p, --priority <priority>', 'Update priority')
  .action(async (taskId, options) => {
    try {
      const configManager = new ConfigManager();
      const taskManager = new TaskManager(configManager.getConfig());
      
      await taskManager.update(taskId, {
        status: options.status,
        assignedAgent: options.assign,
        priority: options.priority
      });

      console.log(chalk.green(`✅ Task ${taskId} updated successfully`));

    } catch (error: any) {
      console.error(chalk.red('❌ Failed to update task:'), error.message);
      process.exit(1);
    }
  });