import { BaseAgent, AgentConfig } from './BaseAgent';
import { CoordinatorAgent } from './CoordinatorAgent';
import { CoderAgent } from './CoderAgent';
import { TesterAgent } from './TesterAgent';
import { ResearcherAgent } from './ResearcherAgent';
import { ProviderManager } from '../providers/ProviderManager';
import { EventEmitter } from 'events';

export interface AgentTemplate {
  type: string;
  name: string;
  role: string;
  defaultProvider: string;
  defaultModel?: string;
  systemPrompt?: string;
  capabilities: string[];
  defaultConfig: Partial<AgentConfig>;
}

export class AgentFactory extends EventEmitter {
  private providerManager: ProviderManager;
  private agentTemplates: Map<string, AgentTemplate> = new Map();
  private activeAgents: Map<string, BaseAgent> = new Map();
  private agentCounter = 0;

  constructor(providerManager: ProviderManager) {
    super();
    this.providerManager = providerManager;
    this.initializeDefaultTemplates();
  }

  private initializeDefaultTemplates(): void {
    // Coordinator Agent Template
    this.registerTemplate({
      type: 'coordinator',
      name: 'Coordinator',
      role: 'Task coordination and agent management',
      defaultProvider: 'openai',
      defaultModel: 'gpt-4',
      capabilities: [
        'task_delegation',
        'coordination',
        'planning',
        'decision_making',
        'conflict_resolution'
      ],
      defaultConfig: {
        temperature: 0.3,
        maxTokens: 4000
      }
    });

    // Coder Agent Template
    this.registerTemplate({
      type: 'coder',
      name: 'Coder',
      role: 'Software development and code generation',
      defaultProvider: 'openai',
      defaultModel: 'gpt-4',
      capabilities: [
        'code_generation',
        'code_review',
        'debugging',
        'refactoring',
        'documentation',
        'testing'
      ],
      defaultConfig: {
        temperature: 0.2,
        maxTokens: 4000
      }
    });

    // Tester Agent Template
    this.registerTemplate({
      type: 'tester',
      name: 'Tester',
      role: 'Quality assurance and testing',
      defaultProvider: 'openai',
      defaultModel: 'gpt-4',
      capabilities: [
        'test_generation',
        'test_execution',
        'quality_assurance',
        'bug_reporting',
        'test_planning',
        'automation'
      ],
      defaultConfig: {
        temperature: 0.3,
        maxTokens: 4000
      }
    });

    // Researcher Agent Template
    this.registerTemplate({
      type: 'researcher',
      name: 'Researcher',
      role: 'Information gathering and analysis',
      defaultProvider: 'anthropic',
      defaultModel: 'claude-3-sonnet-20240229',
      capabilities: [
        'research',
        'analysis',
        'information_gathering',
        'competitive_analysis',
        'trend_analysis',
        'documentation'
      ],
      defaultConfig: {
        temperature: 0.4,
        maxTokens: 4000
      }
    });

    // Analyst Agent Template
    this.registerTemplate({
      type: 'analyst',
      name: 'Analyst',
      role: 'Data analysis and insights generation',
      defaultProvider: 'openai',
      defaultModel: 'gpt-4',
      capabilities: [
        'data_analysis',
        'pattern_recognition',
        'insights_generation',
        'reporting',
        'visualization',
        'metrics_analysis'
      ],
      defaultConfig: {
        temperature: 0.3,
        maxTokens: 4000
      }
    });

    // Writer Agent Template
    this.registerTemplate({
      type: 'writer',
      name: 'Writer',
      role: 'Content creation and documentation',
      defaultProvider: 'anthropic',
      defaultModel: 'claude-3-sonnet-20240229',
      capabilities: [
        'content_creation',
        'documentation',
        'technical_writing',
        'editing',
        'communication',
        'storytelling'
      ],
      defaultConfig: {
        temperature: 0.5,
        maxTokens: 4000
      }
    });
  }

  registerTemplate(template: AgentTemplate): void {
    this.agentTemplates.set(template.type, template);
    this.emit('template-registered', { type: template.type, template });
  }

  getTemplate(type: string): AgentTemplate | undefined {
    return this.agentTemplates.get(type);
  }

  getAllTemplates(): Record<string, AgentTemplate> {
    return Object.fromEntries(this.agentTemplates);
  }

  createAgent(
    type: string, 
    config?: Partial<AgentConfig>, 
    customName?: string
  ): BaseAgent {
    const template = this.agentTemplates.get(type);
    if (!template) {
      throw new Error(`Unknown agent type: ${type}. Available types: ${Array.from(this.agentTemplates.keys()).join(', ')}`);
    }

    // Generate unique ID and name
    const id = config?.id || `${type}-${++this.agentCounter}-${Date.now()}`;
    const name = customName || config?.name || `${template.name} ${this.agentCounter}`;

    // Merge configuration
    const agentConfig: AgentConfig = {
      id,
      name,
      type,
      role: template.role,
      provider: template.defaultProvider,
      model: template.defaultModel,
      capabilities: template.capabilities,
      ...template.defaultConfig,
      ...config
    };

    // Validate provider availability
    const enabledProviders = this.providerManager.getEnabledProviders();
    if (!enabledProviders.includes(agentConfig.provider)) {
      const fallbackProvider = enabledProviders[0];
      if (!fallbackProvider) {
        throw new Error('No enabled providers available for agent creation');
      }
      
      console.warn(`Provider '${agentConfig.provider}' not available, using fallback: '${fallbackProvider}'`);
      agentConfig.provider = fallbackProvider;
    }

    // Create agent instance
    let agent: BaseAgent;

    switch (type) {
      case 'coordinator':
        agent = new CoordinatorAgent(agentConfig, this.providerManager);
        break;
      case 'coder':
        agent = new CoderAgent(agentConfig, this.providerManager);
        break;
      case 'tester':
        agent = new TesterAgent(agentConfig, this.providerManager);
        break;
      case 'researcher':
        agent = new ResearcherAgent(agentConfig, this.providerManager);
        break;
      case 'analyst':
      case 'writer':
        // Use base agent for now, could implement specialized classes later
        agent = new BaseAgent(agentConfig, this.providerManager) as any;
        break;
      default:
        throw new Error(`Agent type '${type}' is registered but not implemented`);
    }

    // Set up event handlers
    this.setupAgentEvents(agent);

    // Store agent
    this.activeAgents.set(id, agent);

    this.emit('agent-created', { 
      id, 
      type, 
      name, 
      config: agentConfig 
    });

    return agent;
  }

  private setupAgentEvents(agent: BaseAgent): void {
    agent.on('task-started', (event) => {
      this.emit('agent-task-started', { ...event, agentType: agent.getType() });
    });

    agent.on('task-completed', (event) => {
      this.emit('agent-task-completed', { ...event, agentType: agent.getType() });
    });

    agent.on('task-failed', (event) => {
      this.emit('agent-task-failed', { ...event, agentType: agent.getType() });
    });

    agent.on('message-sent', (event) => {
      this.emit('agent-message', event);
    });

    agent.on('broadcast-message', (event) => {
      this.emit('agent-broadcast', event);
    });

    agent.on('config-updated', (event) => {
      this.emit('agent-config-updated', { agentId: agent.getId(), config: event });
    });

    agent.on('provider-error', (event) => {
      this.emit('agent-provider-error', { agentId: agent.getId(), error: event });
    });
  }

  getAgent(id: string): BaseAgent | undefined {
    return this.activeAgents.get(id);
  }

  getAllAgents(): BaseAgent[] {
    return Array.from(this.activeAgents.values());
  }

  getActiveAgents(): BaseAgent[] {
    return this.getAllAgents().filter(agent => agent.isCurrentlyActive());
  }

  getAgentsByType(type: string): BaseAgent[] {
    return this.getAllAgents().filter(agent => agent.getType() === type);
  }

  destroyAgent(id: string): boolean {
    const agent = this.activeAgents.get(id);
    if (!agent) {
      return false;
    }

    // Remove all listeners
    agent.removeAllListeners();

    // Remove from active agents
    this.activeAgents.delete(id);

    this.emit('agent-destroyed', { 
      id, 
      type: agent.getType(), 
      name: agent.getName() 
    });

    return true;
  }

  createAgentSwarm(
    swarmConfig: {
      coordinator?: Partial<AgentConfig>;
      agents: Array<{ type: string; count: number; config?: Partial<AgentConfig> }>;
    }
  ): { coordinator: BaseAgent; agents: BaseAgent[] } {
    const agents: BaseAgent[] = [];

    // Create coordinator if specified
    let coordinator: BaseAgent;
    if (swarmConfig.coordinator !== false) {
      coordinator = this.createAgent('coordinator', swarmConfig.coordinator, 'Swarm Coordinator');
    } else {
      // Create a basic coordinator
      coordinator = this.createAgent('coordinator', {}, 'Default Coordinator');
    }

    // Create worker agents
    for (const agentSpec of swarmConfig.agents) {
      for (let i = 0; i < agentSpec.count; i++) {
        const agent = this.createAgent(
          agentSpec.type, 
          agentSpec.config, 
          `${agentSpec.type.charAt(0).toUpperCase() + agentSpec.type.slice(1)} ${i + 1}`
        );
        agents.push(agent);

        // Add to coordinator if it's a CoordinatorAgent
        if (coordinator instanceof CoordinatorAgent) {
          coordinator.addSubordinate(agent);
        }
      }
    }

    this.emit('swarm-created', { 
      coordinator: coordinator.getId(), 
      agents: agents.map(a => a.getId()),
      totalAgents: agents.length + 1
    });

    return { coordinator, agents };
  }

  cloneAgent(sourceId: string, customConfig?: Partial<AgentConfig>): BaseAgent {
    const sourceAgent = this.activeAgents.get(sourceId);
    if (!sourceAgent) {
      throw new Error(`Source agent '${sourceId}' not found`);
    }

    const sourceConfig = sourceAgent.getConfig();
    const newConfig = {
      ...sourceConfig,
      id: undefined, // Will be generated
      name: `${sourceConfig.name} (Clone)`,
      ...customConfig
    };

    return this.createAgent(sourceConfig.type, newConfig);
  }

  getAgentStats(): {
    totalAgents: number;
    activeAgents: number;
    agentsByType: Record<string, number>;
    agentsByProvider: Record<string, number>;
    averageTasksPerAgent: number;
  } {
    const allAgents = this.getAllAgents();
    const activeAgents = this.getActiveAgents();

    const agentsByType: Record<string, number> = {};
    const agentsByProvider: Record<string, number> = {};

    for (const agent of allAgents) {
      const type = agent.getType();
      const provider = agent.getConfig().provider;

      agentsByType[type] = (agentsByType[type] || 0) + 1;
      agentsByProvider[provider] = (agentsByProvider[provider] || 0) + 1;
    }

    return {
      totalAgents: allAgents.length,
      activeAgents: activeAgents.length,
      agentsByType,
      agentsByProvider,
      averageTasksPerAgent: 0 // Could be calculated from task history
    };
  }

  updateAgentTemplate(type: string, updates: Partial<AgentTemplate>): void {
    const template = this.agentTemplates.get(type);
    if (!template) {
      throw new Error(`Template '${type}' not found`);
    }

    const updatedTemplate = { ...template, ...updates };
    this.agentTemplates.set(type, updatedTemplate);

    this.emit('template-updated', { type, template: updatedTemplate });
  }

  validateAgentConfig(config: AgentConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.id || config.id.trim() === '') {
      errors.push('Agent ID is required');
    }

    if (!config.name || config.name.trim() === '') {
      errors.push('Agent name is required');
    }

    if (!config.type || config.type.trim() === '') {
      errors.push('Agent type is required');
    }

    if (!config.provider || config.provider.trim() === '') {
      errors.push('Provider is required');
    }

    const enabledProviders = this.providerManager.getEnabledProviders();
    if (!enabledProviders.includes(config.provider)) {
      errors.push(`Provider '${config.provider}' is not enabled`);
    }

    if (config.temperature !== undefined && (config.temperature < 0 || config.temperature > 2)) {
      errors.push('Temperature must be between 0 and 2');
    }

    if (config.maxTokens !== undefined && config.maxTokens < 1) {
      errors.push('Max tokens must be greater than 0');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  destroyAllAgents(): number {
    const count = this.activeAgents.size;
    
    for (const [id, agent] of this.activeAgents) {
      agent.removeAllListeners();
    }
    
    this.activeAgents.clear();
    this.agentCounter = 0;

    this.emit('all-agents-destroyed', { count });
    
    return count;
  }
}