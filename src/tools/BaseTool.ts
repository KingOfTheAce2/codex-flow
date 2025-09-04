import { EventEmitter } from 'events';

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  default?: any;
  enum?: any[];
  schema?: any; // JSON Schema for complex types
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export interface ToolConfig {
  name: string;
  description: string;
  category: string;
  version: string;
  parameters: ToolParameter[];
  metadata?: Record<string, any>;
}

export abstract class BaseTool extends EventEmitter {
  protected config: ToolConfig;
  protected isEnabled: boolean = true;

  constructor(config: ToolConfig) {
    super();
    this.config = config;
  }

  // Abstract methods to be implemented by specific tools
  abstract execute(parameters: Record<string, any>): Promise<ToolResult>;

  // Optional lifecycle methods
  async initialize(): Promise<void> {
    // Override if needed
  }

  async cleanup(): Promise<void> {
    // Override if needed
  }

  // Tool information methods
  getName(): string {
    return this.config.name;
  }

  getDescription(): string {
    return this.config.description;
  }

  getCategory(): string {
    return this.config.category;
  }

  getVersion(): string {
    return this.config.version;
  }

  getParameters(): ToolParameter[] {
    return [...this.config.parameters];
  }

  getConfig(): ToolConfig {
    return { ...this.config };
  }

  // Tool state management
  isToolEnabled(): boolean {
    return this.isEnabled;
  }

  enable(): void {
    this.isEnabled = true;
    this.emit('tool-enabled', { tool: this.config.name });
  }

  disable(): void {
    this.isEnabled = false;
    this.emit('tool-disabled', { tool: this.config.name });
  }

  // Parameter validation
  validateParameters(parameters: Record<string, any>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required parameters
    for (const param of this.config.parameters) {
      if (param.required && !(param.name in parameters)) {
        errors.push(`Required parameter '${param.name}' is missing`);
        continue;
      }

      const value = parameters[param.name];
      
      // Skip validation for missing optional parameters
      if (value === undefined || value === null) {
        continue;
      }

      // Type validation
      if (!this.validateParameterType(value, param)) {
        errors.push(`Parameter '${param.name}' has invalid type. Expected: ${param.type}`);
      }

      // Enum validation
      if (param.enum && !param.enum.includes(value)) {
        errors.push(`Parameter '${param.name}' must be one of: ${param.enum.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private validateParameterType(value: any, param: ToolParameter): boolean {
    switch (param.type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && !Array.isArray(value);
      default:
        return true;
    }
  }

  // Helper method for creating results
  protected createResult(success: boolean, data?: any, error?: string, metadata?: Record<string, any>): ToolResult {
    const result: ToolResult = { success };
    
    if (data !== undefined) result.data = data;
    if (error) result.error = error;
    if (metadata) result.metadata = metadata;
    
    return result;
  }

  // Helper method for creating success results
  protected success(data?: any, metadata?: Record<string, any>): ToolResult {
    return this.createResult(true, data, undefined, metadata);
  }

  // Helper method for creating error results
  protected error(message: string, metadata?: Record<string, any>): ToolResult {
    return this.createResult(false, undefined, message, metadata);
  }

  // Safe execution wrapper
  async safeExecute(parameters: Record<string, any>): Promise<ToolResult> {
    if (!this.isEnabled) {
      return this.error('Tool is disabled');
    }

    // Validate parameters
    const validation = this.validateParameters(parameters);
    if (!validation.valid) {
      return this.error(`Parameter validation failed: ${validation.errors.join(', ')}`);
    }

    // Add default values for missing optional parameters
    const enrichedParameters = { ...parameters };
    for (const param of this.config.parameters) {
      if (param.default !== undefined && !(param.name in enrichedParameters)) {
        enrichedParameters[param.name] = param.default;
      }
    }

    try {
      this.emit('tool-execute-start', { 
        tool: this.config.name, 
        parameters: enrichedParameters 
      });

      const startTime = Date.now();
      const result = await this.execute(enrichedParameters);
      const duration = Date.now() - startTime;

      this.emit('tool-execute-complete', { 
        tool: this.config.name, 
        parameters: enrichedParameters,
        result,
        duration
      });

      return result;

    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error occurred';
      
      this.emit('tool-execute-error', { 
        tool: this.config.name, 
        parameters: enrichedParameters,
        error: errorMessage
      });

      return this.error(`Tool execution failed: ${errorMessage}`);
    }
  }

  // Generate tool schema for MCP compatibility
  generateMCPSchema(): any {
    return {
      name: this.config.name,
      description: this.config.description,
      inputSchema: {
        type: 'object',
        properties: this.config.parameters.reduce((props, param) => {
          props[param.name] = {
            type: param.type,
            description: param.description,
            ...(param.enum && { enum: param.enum }),
            ...(param.schema && param.schema)
          };
          return props;
        }, {} as Record<string, any>),
        required: this.config.parameters
          .filter(p => p.required)
          .map(p => p.name)
      }
    };
  }
}