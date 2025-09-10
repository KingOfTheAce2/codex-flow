import { BaseTool, ToolResult } from './BaseTool.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class GitOperationsTool extends BaseTool {
  constructor() {
    super({
      name: 'git_operations',
      description: 'Git version control operations including status, commit, push, pull, and branch management',
      category: 'git',
      version: '1.0.0',
      parameters: [
        {
          name: 'operation',
          type: 'string',
          description: 'The git operation to perform',
          required: true,
          enum: [
            'status', 'add', 'commit', 'push', 'pull', 'clone', 'init',
            'branch', 'checkout', 'merge', 'diff', 'log', 'reset',
            'stash', 'remote', 'tag', 'fetch'
          ]
        },
        {
          name: 'path',
          type: 'string',
          description: 'Repository path (defaults to current directory)',
          required: false,
          default: '.'
        },
        {
          name: 'message',
          type: 'string',
          description: 'Commit message (for commit operation)',
          required: false
        },
        {
          name: 'branch',
          type: 'string',
          description: 'Branch name (for branch/checkout operations)',
          required: false
        },
        {
          name: 'remote',
          type: 'string',
          description: 'Remote name (defaults to origin)',
          required: false,
          default: 'origin'
        },
        {
          name: 'url',
          type: 'string',
          description: 'Repository URL (for clone/remote operations)',
          required: false
        },
        {
          name: 'files',
          type: 'array',
          description: 'Files to add (for add operation)',
          required: false
        },
        {
          name: 'force',
          type: 'boolean',
          description: 'Force operation',
          required: false,
          default: false
        },
        {
          name: 'all',
          type: 'boolean',
          description: 'Apply to all files (for add/reset operations)',
          required: false,
          default: false
        },
        {
          name: 'count',
          type: 'number',
          description: 'Number of entries (for log operation)',
          required: false,
          default: 10
        }
      ]
    });
  }

  async execute(parameters: Record<string, any>): Promise<ToolResult> {
    const { 
      operation, 
      path: repoPath, 
      message, 
      branch, 
      remote, 
      url, 
      files, 
      force, 
      all, 
      count 
    } = parameters;

    try {
      switch (operation) {
        case 'status':
          return await this.getStatus(repoPath);
        
        case 'add':
          return await this.addFiles(repoPath, files, all);
        
        case 'commit':
          return await this.commit(repoPath, message);
        
        case 'push':
          return await this.push(repoPath, remote, branch, force);
        
        case 'pull':
          return await this.pull(repoPath, remote, branch);
        
        case 'clone':
          return await this.clone(url, repoPath);
        
        case 'init':
          return await this.init(repoPath);
        
        case 'branch':
          return await this.manageBranches(repoPath, branch);
        
        case 'checkout':
          return await this.checkout(repoPath, branch, force);
        
        case 'merge':
          return await this.merge(repoPath, branch);
        
        case 'diff':
          return await this.getDiff(repoPath, files);
        
        case 'log':
          return await this.getLog(repoPath, count);
        
        case 'reset':
          return await this.reset(repoPath, files, all, force);
        
        case 'stash':
          return await this.stash(repoPath, message);
        
        case 'remote':
          return await this.manageRemotes(repoPath, url);
        
        case 'tag':
          return await this.manageTags(repoPath, branch);
        
        case 'fetch':
          return await this.fetch(repoPath, remote);
        
        default:
          return this.error(`Unknown git operation: ${operation}`);
      }
    } catch (error: any) {
      return this.error(`Git operation failed: ${error.message}`);
    }
  }

  private async runGitCommand(command: string, cwd: string = '.'): Promise<{ stdout: string; stderr: string }> {
    try {
      const result = await execAsync(`git ${command}`, { 
        cwd,
        timeout: 30000 // 30 second timeout
      });
      return result;
    } catch (error: any) {
      // Git commands sometimes return non-zero exit codes for normal operations
      if (error.stdout || error.stderr) {
        return { stdout: error.stdout || '', stderr: error.stderr || '' };
      }
      throw error;
    }
  }

  private async getStatus(repoPath: string): Promise<ToolResult> {
    try {
      const { stdout } = await this.runGitCommand('status --porcelain', repoPath);
      const files = stdout.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const status = line.substring(0, 2);
          const file = line.substring(3);
          return { status, file };
        });

      const { stdout: branchInfo } = await this.runGitCommand('branch --show-current', repoPath);
      const currentBranch = branchInfo.trim();

      return this.success({
        branch: currentBranch,
        files,
        clean: files.length === 0,
        modified: files.filter(f => f.status.includes('M')).length,
        added: files.filter(f => f.status.includes('A')).length,
        deleted: files.filter(f => f.status.includes('D')).length,
        untracked: files.filter(f => f.status.includes('?')).length
      });
    } catch (error: any) {
      return this.error(`Failed to get git status: ${error.message}`);
    }
  }

  private async addFiles(repoPath: string, files?: string[], all?: boolean): Promise<ToolResult> {
    try {
      let command = 'add';
      
      if (all) {
        command += ' .';
      } else if (files && files.length > 0) {
        command += ' ' + files.map(f => `"${f}"`).join(' ');
      } else {
        return this.error('Either files array or all flag must be provided');
      }

      const { stdout, stderr } = await this.runGitCommand(command, repoPath);
      
      return this.success({
        added: true,
        files: files || ['.'],
        all: !!all
      }, { stdout, stderr });
    } catch (error: any) {
      return this.error(`Failed to add files: ${error.message}`);
    }
  }

  private async commit(repoPath: string, message?: string): Promise<ToolResult> {
    if (!message) {
      return this.error('Commit message is required');
    }

    try {
      const { stdout, stderr } = await this.runGitCommand(`commit -m "${message}"`, repoPath);
      
      // Extract commit hash if present
      const hashMatch = stdout.match(/\[.*\s([a-f0-9]+)\]/);
      const commitHash = hashMatch ? hashMatch[1] : null;

      return this.success({
        committed: true,
        message,
        hash: commitHash
      }, { stdout, stderr });
    } catch (error: any) {
      return this.error(`Failed to commit: ${error.message}`);
    }
  }

  private async push(repoPath: string, remote: string, branch?: string, force?: boolean): Promise<ToolResult> {
    try {
      let command = `push ${remote}`;
      if (branch) command += ` ${branch}`;
      if (force) command += ' --force';

      const { stdout, stderr } = await this.runGitCommand(command, repoPath);
      
      return this.success({
        pushed: true,
        remote,
        branch,
        force: !!force
      }, { stdout, stderr });
    } catch (error: any) {
      return this.error(`Failed to push: ${error.message}`);
    }
  }

  private async pull(repoPath: string, remote: string, branch?: string): Promise<ToolResult> {
    try {
      let command = `pull ${remote}`;
      if (branch) command += ` ${branch}`;

      const { stdout, stderr } = await this.runGitCommand(command, repoPath);
      
      return this.success({
        pulled: true,
        remote,
        branch
      }, { stdout, stderr });
    } catch (error: any) {
      return this.error(`Failed to pull: ${error.message}`);
    }
  }

  private async clone(url?: string, repoPath?: string): Promise<ToolResult> {
    if (!url) {
      return this.error('Repository URL is required for clone operation');
    }

    try {
      let command = `clone ${url}`;
      if (repoPath && repoPath !== '.') {
        command += ` ${repoPath}`;
      }

      const { stdout, stderr } = await this.runGitCommand(command, process.cwd());
      
      return this.success({
        cloned: true,
        url,
        path: repoPath
      }, { stdout, stderr });
    } catch (error: any) {
      return this.error(`Failed to clone repository: ${error.message}`);
    }
  }

  private async init(repoPath: string): Promise<ToolResult> {
    try {
      const { stdout, stderr } = await this.runGitCommand('init', repoPath);
      
      return this.success({
        initialized: true,
        path: repoPath
      }, { stdout, stderr });
    } catch (error: any) {
      return this.error(`Failed to initialize repository: ${error.message}`);
    }
  }

  private async manageBranches(repoPath: string, branchName?: string): Promise<ToolResult> {
    try {
      if (branchName) {
        // Create new branch
        const { stdout, stderr } = await this.runGitCommand(`branch ${branchName}`, repoPath);
        return this.success({
          created: true,
          branch: branchName
        }, { stdout, stderr });
      } else {
        // List branches
        const { stdout } = await this.runGitCommand('branch -a', repoPath);
        const branches = stdout.split('\n')
          .filter(line => line.trim())
          .map(line => ({
            name: line.replace(/^\*?\s*/, '').trim(),
            current: line.startsWith('*'),
            remote: line.includes('remotes/')
          }));

        return this.success({ branches });
      }
    } catch (error: any) {
      return this.error(`Failed to manage branches: ${error.message}`);
    }
  }

  private async checkout(repoPath: string, branch?: string, force?: boolean): Promise<ToolResult> {
    if (!branch) {
      return this.error('Branch name is required for checkout operation');
    }

    try {
      let command = `checkout ${branch}`;
      if (force) command += ' --force';

      const { stdout, stderr } = await this.runGitCommand(command, repoPath);
      
      return this.success({
        checkedOut: true,
        branch,
        force: !!force
      }, { stdout, stderr });
    } catch (error: any) {
      return this.error(`Failed to checkout branch: ${error.message}`);
    }
  }

  private async merge(repoPath: string, branch?: string): Promise<ToolResult> {
    if (!branch) {
      return this.error('Branch name is required for merge operation');
    }

    try {
      const { stdout, stderr } = await this.runGitCommand(`merge ${branch}`, repoPath);
      
      return this.success({
        merged: true,
        branch
      }, { stdout, stderr });
    } catch (error: any) {
      return this.error(`Failed to merge branch: ${error.message}`);
    }
  }

  private async getDiff(repoPath: string, files?: string[]): Promise<ToolResult> {
    try {
      let command = 'diff';
      if (files && files.length > 0) {
        command += ' ' + files.map(f => `"${f}"`).join(' ');
      }

      const { stdout } = await this.runGitCommand(command, repoPath);
      
      return this.success({
        diff: stdout,
        files: files || [],
        hasChanges: stdout.trim().length > 0
      });
    } catch (error: any) {
      return this.error(`Failed to get diff: ${error.message}`);
    }
  }

  private async getLog(repoPath: string, count: number): Promise<ToolResult> {
    try {
      const { stdout } = await this.runGitCommand(
        `log --oneline -${count} --pretty=format:"%h|%an|%ad|%s" --date=short`, 
        repoPath
      );
      
      const commits = stdout.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [hash, author, date, message] = line.split('|');
          return { hash, author, date, message };
        });

      return this.success({ commits, count: commits.length });
    } catch (error: any) {
      return this.error(`Failed to get log: ${error.message}`);
    }
  }

  private async reset(repoPath: string, files?: string[], all?: boolean, force?: boolean): Promise<ToolResult> {
    try {
      let command = 'reset';
      if (force) command += ' --hard';
      
      if (all) {
        command += ' .';
      } else if (files && files.length > 0) {
        command += ' ' + files.map(f => `"${f}"`).join(' ');
      }

      const { stdout, stderr } = await this.runGitCommand(command, repoPath);
      
      return this.success({
        reset: true,
        files: files || ['.'],
        all: !!all,
        force: !!force
      }, { stdout, stderr });
    } catch (error: any) {
      return this.error(`Failed to reset: ${error.message}`);
    }
  }

  private async stash(repoPath: string, message?: string): Promise<ToolResult> {
    try {
      let command = 'stash';
      if (message) command += ` push -m "${message}"`;

      const { stdout, stderr } = await this.runGitCommand(command, repoPath);
      
      return this.success({
        stashed: true,
        message
      }, { stdout, stderr });
    } catch (error: any) {
      return this.error(`Failed to stash: ${error.message}`);
    }
  }

  private async manageRemotes(repoPath: string, url?: string): Promise<ToolResult> {
    try {
      if (url) {
        const { stdout, stderr } = await this.runGitCommand(`remote add origin ${url}`, repoPath);
        return this.success({
          added: true,
          remote: 'origin',
          url
        }, { stdout, stderr });
      } else {
        const { stdout } = await this.runGitCommand('remote -v', repoPath);
        const remotes = stdout.split('\n')
          .filter(line => line.trim())
          .map(line => {
            const [name, url, type] = line.split(/\s+/);
            return { name, url, type: type?.replace(/[()]/g, '') };
          });

        return this.success({ remotes });
      }
    } catch (error: any) {
      return this.error(`Failed to manage remotes: ${error.message}`);
    }
  }

  private async manageTags(repoPath: string, tagName?: string): Promise<ToolResult> {
    try {
      if (tagName) {
        const { stdout, stderr } = await this.runGitCommand(`tag ${tagName}`, repoPath);
        return this.success({
          created: true,
          tag: tagName
        }, { stdout, stderr });
      } else {
        const { stdout } = await this.runGitCommand('tag -l', repoPath);
        const tags = stdout.split('\n').filter(line => line.trim());

        return this.success({ tags });
      }
    } catch (error: any) {
      return this.error(`Failed to manage tags: ${error.message}`);
    }
  }

  private async fetch(repoPath: string, remote: string): Promise<ToolResult> {
    try {
      const { stdout, stderr } = await this.runGitCommand(`fetch ${remote}`, repoPath);
      
      return this.success({
        fetched: true,
        remote
      }, { stdout, stderr });
    } catch (error: any) {
      return this.error(`Failed to fetch: ${error.message}`);
    }
  }
}