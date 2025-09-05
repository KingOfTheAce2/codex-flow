import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import open from 'open';
import { createServer } from 'http';
import { URL } from 'url';
import { ConfigManager } from '../../core/config';
import { AuthManager } from '../../core/auth/AuthManager';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function checkCLIPrerequisites(): Promise<void> {
  console.log(chalk.gray('🔍 Checking CLI prerequisites...\n'));
  
  // Check OpenAI Codex CLI
  try {
    await execAsync('codex --version');
    console.log(chalk.green('✅ OpenAI Codex CLI is installed'));
  } catch {
    console.log(chalk.yellow('⚠️  OpenAI Codex CLI not found'));
    console.log(chalk.white('   Install with: npm install -g @openai/codex@latest'));
  }

  // Check Claude Code CLI
  try {
    let env = process.env;
    if (process.platform === 'win32' && !process.env.CLAUDE_CODE_GIT_BASH_PATH) {
      const possiblePaths = [
        "C:\\Program Files\\Git\\bin\\bash.exe",
        process.env.USERPROFILE + "\\AppData\\Local\\Programs\\Git\\bin\\bash.exe"
      ];
      
      for (const path of possiblePaths) {
        try {
          await execAsync(`"${path}" --version`);
          env = { ...process.env, CLAUDE_CODE_GIT_BASH_PATH: path };
          break;
        } catch {
          continue;
        }
      }
    }
    
    await execAsync('claude --version', { env });
    console.log(chalk.green('✅ Claude Code CLI is installed'));
  } catch {
    console.log(chalk.yellow('⚠️  Claude Code CLI not found'));
    console.log(chalk.white('   Install with: npm install -g @anthropic-ai/claude-code'));
    if (process.platform === 'win32') {
      console.log(chalk.gray('   Note: Requires Git Bash on Windows'));
    }
  }

  console.log(chalk.gray('\nNote: Google Gemini uses manual browser authentication (no CLI required)\n'));
}

export const authCommand = new Command('auth')
  .description('Authenticate with AI providers');

// Login command
authCommand
  .command('login')
  .description('Login to AI providers via browser')
  .option('-p, --provider <provider>', 'Provider to login to (openai, anthropic, google)', '')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🔐 Codex-Flow Authentication\n'));

      // Check CLI prerequisites
      await checkCLIPrerequisites();

      const authManager = new AuthManager();
      let provider = options.provider;

      if (!provider) {
        const answer = await inquirer.prompt({
          type: 'list',
          name: 'provider',
          message: 'Choose a provider to authenticate:',
          choices: [
            { name: 'OpenAI (GPT-4, Codex)', value: 'openai' },
            { name: 'Anthropic Claude', value: 'anthropic' },
            { name: 'Google Gemini', value: 'google' },
            { name: 'All providers', value: 'all' }
          ]
        });
        provider = answer.provider;
      }

      if (provider === 'all') {
        const providers = ['openai', 'anthropic', 'google'];
        for (const p of providers) {
          console.log(chalk.yellow(`\nAuthenticating with ${p}...`));
          await authManager.browserLogin(p);
        }
      } else {
        await authManager.browserLogin(provider);
      }

      console.log(chalk.green('\n✅ Authentication completed successfully!'));
      console.log(chalk.blue('\nNext steps:'));
      console.log(chalk.white('• Run: codex-flow auth status'));
      console.log(chalk.white('• Test: codex-flow swarm spawn "Hello world"'));

    } catch (error: any) {
      console.error(chalk.red('❌ Authentication failed:'), error.message);
      process.exit(1);
    }
  });

// Status command
authCommand
  .command('status')
  .description('Show authentication status for all providers')
  .action(async () => {
    try {
      const authManager = new AuthManager();
      const status = await authManager.getStatus();

      console.log(chalk.blue('🔐 Authentication Status\n'));

      const providers = ['openai', 'anthropic', 'google'];
      for (const provider of providers) {
        const isAuth = status[provider]?.authenticated || false;
        const statusIcon = isAuth ? '✅' : '❌';
        const statusText = isAuth ? 'Authenticated' : 'Not authenticated';
        const expiryText = status[provider]?.expiresAt ? 
          `(expires ${new Date(status[provider].expiresAt).toLocaleDateString()})` : '';

        console.log(chalk.white(`${statusIcon} ${provider.charAt(0).toUpperCase() + provider.slice(1)}: ${statusText} ${expiryText}`));
      }

      const unauthenticated = providers.filter(p => !status[p]?.authenticated);
      if (unauthenticated.length > 0) {
        console.log(chalk.yellow(`\nTo authenticate missing providers, run:`));
        console.log(chalk.white(`codex-flow auth login`));
      }

    } catch (error: any) {
      console.error(chalk.red('❌ Failed to get auth status:'), error.message);
      process.exit(1);
    }
  });

// Logout command
authCommand
  .command('logout')
  .description('Logout from AI providers')
  .option('-p, --provider <provider>', 'Provider to logout from (openai, anthropic, google)', 'all')
  .action(async (options) => {
    try {
      const authManager = new AuthManager();
      
      if (options.provider === 'all') {
        await authManager.logoutAll();
        console.log(chalk.green('✅ Logged out from all providers'));
      } else {
        await authManager.logout(options.provider);
        console.log(chalk.green(`✅ Logged out from ${options.provider}`));
      }

    } catch (error: any) {
      console.error(chalk.red('❌ Logout failed:'), error.message);
      process.exit(1);
    }
  });

// Refresh tokens command
authCommand
  .command('refresh')
  .description('Refresh authentication tokens')
  .option('-p, --provider <provider>', 'Provider to refresh (openai, anthropic, google)', 'all')
  .action(async (options) => {
    try {
      const authManager = new AuthManager();
      
      if (options.provider === 'all') {
        await authManager.refreshAllTokens();
        console.log(chalk.green('✅ Refreshed all tokens'));
      } else {
        await authManager.refreshToken(options.provider);
        console.log(chalk.green(`✅ Refreshed ${options.provider} token`));
      }

    } catch (error: any) {
      console.error(chalk.red('❌ Token refresh failed:'), error.message);
      process.exit(1);
    }
  });