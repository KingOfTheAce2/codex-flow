import { BaseTool, ToolResult } from './BaseTool';
import { promises as fs } from 'fs';
import path from 'path';

export class FileOperationsTool extends BaseTool {
  constructor() {
    super({
      name: 'file_operations',
      description: 'File system operations including read, write, delete, and directory management',
      category: 'filesystem',
      version: '1.0.0',
      parameters: [
        {
          name: 'operation',
          type: 'string',
          description: 'The file operation to perform',
          required: true,
          enum: ['read', 'write', 'append', 'delete', 'exists', 'mkdir', 'rmdir', 'list', 'stat', 'copy', 'move']
        },
        {
          name: 'path',
          type: 'string',
          description: 'File or directory path',
          required: true
        },
        {
          name: 'content',
          type: 'string',
          description: 'Content to write (for write/append operations)',
          required: false
        },
        {
          name: 'destination',
          type: 'string',
          description: 'Destination path (for copy/move operations)',
          required: false
        },
        {
          name: 'encoding',
          type: 'string',
          description: 'File encoding',
          required: false,
          default: 'utf8',
          enum: ['utf8', 'ascii', 'base64', 'hex', 'binary']
        },
        {
          name: 'recursive',
          type: 'boolean',
          description: 'Recursive operation for directories',
          required: false,
          default: false
        },
        {
          name: 'filter',
          type: 'string',
          description: 'File filter pattern for list operations (e.g., *.js)',
          required: false
        }
      ]
    });
  }

  async execute(parameters: Record<string, any>): Promise<ToolResult> {
    const { operation, path: filePath, content, destination, encoding, recursive, filter } = parameters;

    try {
      switch (operation) {
        case 'read':
          return await this.readFile(filePath, encoding);
        
        case 'write':
          return await this.writeFile(filePath, content, encoding);
        
        case 'append':
          return await this.appendFile(filePath, content, encoding);
        
        case 'delete':
          return await this.deleteFile(filePath, recursive);
        
        case 'exists':
          return await this.checkExists(filePath);
        
        case 'mkdir':
          return await this.makeDirectory(filePath, recursive);
        
        case 'rmdir':
          return await this.removeDirectory(filePath, recursive);
        
        case 'list':
          return await this.listDirectory(filePath, filter);
        
        case 'stat':
          return await this.getStats(filePath);
        
        case 'copy':
          return await this.copyFile(filePath, destination, recursive);
        
        case 'move':
          return await this.moveFile(filePath, destination);
        
        default:
          return this.error(`Unknown operation: ${operation}`);
      }
    } catch (error: any) {
      return this.error(`File operation failed: ${error.message}`);
    }
  }

  private async readFile(filePath: string, encoding: string): Promise<ToolResult> {
    try {
      const content = await fs.readFile(filePath, encoding as BufferEncoding);
      return this.success({ content }, { size: content.length, encoding });
    } catch (error: any) {
      return this.error(`Failed to read file: ${error.message}`);
    }
  }

  private async writeFile(filePath: string, content: string, encoding: string): Promise<ToolResult> {
    if (!content) {
      return this.error('Content is required for write operation');
    }

    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, encoding as BufferEncoding);
      
      const stats = await fs.stat(filePath);
      return this.success({ written: true }, { 
        size: stats.size, 
        encoding,
        created: stats.birthtime,
        modified: stats.mtime 
      });
    } catch (error: any) {
      return this.error(`Failed to write file: ${error.message}`);
    }
  }

  private async appendFile(filePath: string, content: string, encoding: string): Promise<ToolResult> {
    if (!content) {
      return this.error('Content is required for append operation');
    }

    try {
      await fs.appendFile(filePath, content, encoding as BufferEncoding);
      
      const stats = await fs.stat(filePath);
      return this.success({ appended: true }, { 
        size: stats.size, 
        encoding,
        modified: stats.mtime 
      });
    } catch (error: any) {
      return this.error(`Failed to append to file: ${error.message}`);
    }
  }

  private async deleteFile(filePath: string, recursive: boolean): Promise<ToolResult> {
    try {
      const stats = await fs.stat(filePath);
      
      if (stats.isDirectory()) {
        if (recursive) {
          await fs.rmdir(filePath, { recursive: true });
        } else {
          await fs.rmdir(filePath);
        }
      } else {
        await fs.unlink(filePath);
      }
      
      return this.success({ deleted: true }, { 
        type: stats.isDirectory() ? 'directory' : 'file',
        recursive 
      });
    } catch (error: any) {
      return this.error(`Failed to delete: ${error.message}`);
    }
  }

  private async checkExists(filePath: string): Promise<ToolResult> {
    try {
      await fs.access(filePath);
      const stats = await fs.stat(filePath);
      
      return this.success({ 
        exists: true, 
        type: stats.isDirectory() ? 'directory' : 'file' 
      }, {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        isReadable: true,
        isWritable: true
      });
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return this.success({ exists: false, type: null });
      }
      return this.error(`Failed to check existence: ${error.message}`);
    }
  }

  private async makeDirectory(dirPath: string, recursive: boolean): Promise<ToolResult> {
    try {
      await fs.mkdir(dirPath, { recursive });
      return this.success({ created: true }, { path: dirPath, recursive });
    } catch (error: any) {
      return this.error(`Failed to create directory: ${error.message}`);
    }
  }

  private async removeDirectory(dirPath: string, recursive: boolean): Promise<ToolResult> {
    try {
      await fs.rmdir(dirPath, { recursive });
      return this.success({ removed: true }, { path: dirPath, recursive });
    } catch (error: any) {
      return this.error(`Failed to remove directory: ${error.message}`);
    }
  }

  private async listDirectory(dirPath: string, filter?: string): Promise<ToolResult> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      let files = await Promise.all(entries.map(async (entry) => {
        const fullPath = path.join(dirPath, entry.name);
        const stats = await fs.stat(fullPath);
        
        return {
          name: entry.name,
          path: fullPath,
          type: entry.isDirectory() ? 'directory' : 'file',
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          isDirectory: entry.isDirectory(),
          isFile: entry.isFile()
        };
      }));

      // Apply filter if provided
      if (filter) {
        const regex = new RegExp(filter.replace(/\*/g, '.*').replace(/\?/g, '.'));
        files = files.filter(file => regex.test(file.name));
      }

      return this.success({ 
        files,
        count: files.length 
      }, { 
        directory: dirPath, 
        filter: filter || null 
      });
    } catch (error: any) {
      return this.error(`Failed to list directory: ${error.message}`);
    }
  }

  private async getStats(filePath: string): Promise<ToolResult> {
    try {
      const stats = await fs.stat(filePath);
      
      return this.success({
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        accessed: stats.atime,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        permissions: {
          readable: true, // Simplified - could use fs.access for actual check
          writable: true,
          executable: stats.mode & 0o111 ? true : false
        },
        mode: stats.mode.toString(8),
        uid: stats.uid,
        gid: stats.gid
      });
    } catch (error: any) {
      return this.error(`Failed to get file stats: ${error.message}`);
    }
  }

  private async copyFile(sourcePath: string, destPath: string, recursive: boolean): Promise<ToolResult> {
    if (!destPath) {
      return this.error('Destination path is required for copy operation');
    }

    try {
      const sourceStats = await fs.stat(sourcePath);
      
      if (sourceStats.isDirectory()) {
        if (!recursive) {
          return this.error('Recursive flag required for copying directories');
        }
        
        // Copy directory recursively
        await this.copyDirectoryRecursive(sourcePath, destPath);
        return this.success({ copied: true }, { 
          source: sourcePath, 
          destination: destPath, 
          type: 'directory',
          recursive: true 
        });
      } else {
        // Ensure destination directory exists
        await fs.mkdir(path.dirname(destPath), { recursive: true });
        await fs.copyFile(sourcePath, destPath);
        
        return this.success({ copied: true }, { 
          source: sourcePath, 
          destination: destPath, 
          type: 'file',
          size: sourceStats.size 
        });
      }
    } catch (error: any) {
      return this.error(`Failed to copy: ${error.message}`);
    }
  }

  private async copyDirectoryRecursive(source: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(source, { withFileTypes: true });
    
    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        await this.copyDirectoryRecursive(sourcePath, destPath);
      } else {
        await fs.copyFile(sourcePath, destPath);
      }
    }
  }

  private async moveFile(sourcePath: string, destPath: string): Promise<ToolResult> {
    if (!destPath) {
      return this.error('Destination path is required for move operation');
    }

    try {
      const sourceStats = await fs.stat(sourcePath);
      
      // Ensure destination directory exists
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await fs.rename(sourcePath, destPath);
      
      return this.success({ moved: true }, { 
        source: sourcePath, 
        destination: destPath,
        type: sourceStats.isDirectory() ? 'directory' : 'file',
        size: sourceStats.size 
      });
    } catch (error: any) {
      return this.error(`Failed to move: ${error.message}`);
    }
  }
}