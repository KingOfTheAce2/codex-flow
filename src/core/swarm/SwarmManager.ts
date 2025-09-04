import { EventEmitter } from 'events';
import { BaseAgent, Task } from '../agents/BaseAgent';
import { AgentFactory } from '../agents/AgentFactory';
import { MemoryManager } from '../memory/MemoryManager';

export interface SwarmConfig {
  id: string;
  name: string;
  objective: string;
  topology: 'hierarchical' | 'mesh' | 'ring' | 'star';
  maxAgents: number;
  consensus: 'majority' | 'weighted' | 'byzantine';
  autoScale: boolean;
  agents: Array<{
    type: string;
    count: number;
    config?: any;
  }>;
  metadata?: Record<string, any>;
}

export interface SwarmStatus {
  id: string;
  name: string;
  status: 'initializing' | 'active' | 'paused' | 'completed' | 'failed';
  objective: string;
  topology: string;
  agents: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    role: string;
    tasksCompleted?: number;
  }>;
  currentTask?: {
    id: string;
    description: string;
    assignedAgent: string;
    status: string;
  };
  createdAt: Date;
  completedAt?: Date;
  progress: number;
  metrics: {
    tasksCompleted: number;
    tasksTotal: number;
    activeAgents: number;
    totalAgents: number;
    successRate: number;
  };
}

export class SwarmManager extends EventEmitter {
  private agentFactory: AgentFactory;
  private memoryManager: MemoryManager;
  private swarms: Map<string, Swarm> = new Map();
  private config: any;

  constructor(config: any) {
    super();
    this.config = config;
    this.agentFactory = new AgentFactory(config.providerManager || config.providers);
    this.memoryManager = new MemoryManager(config.memory || {});

    // Set up event handlers
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.agentFactory.on('agent-created', (event) => {
      this.emit('agent-created', event);
    });

    this.agentFactory.on('agent-task-completed', (event) => {
      this.emit('agent-task-completed', event);
    });

    this.agentFactory.on('agent-task-failed', (event) => {
      this.emit('agent-task-failed', event);
    });
  }

  async spawn(options: {
    objective: string;
    config?: string;
    maxAgents?: number;
    topology?: string;
    providers?: string[];
    autoScale?: boolean;
    verbose?: boolean;
  }): Promise<Swarm> {
    const swarmId = `swarm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const swarmConfig: SwarmConfig = {
      id: swarmId,
      name: `Swarm for: ${options.objective.substring(0, 50)}...`,
      objective: options.objective,
      topology: (options.topology as any) || 'hierarchical',
      maxAgents: options.maxAgents || 5,
      consensus: 'majority',
      autoScale: options.autoScale || false,
      agents: this.generateDefaultAgentConfig(options.maxAgents || 5)
    };

    const swarm = new Swarm(swarmConfig, this.agentFactory, this.memoryManager);
    
    // Set up swarm event handlers
    this.setupSwarmEventHandlers(swarm);

    // Initialize the swarm
    await swarm.initialize();

    // Store the swarm
    this.swarms.set(swarmId, swarm);

    this.emit('swarm-spawned', { 
      swarmId, 
      objective: options.objective,
      agentCount: swarm.getAgents().length 
    });

    return swarm;
  }

  private generateDefaultAgentConfig(maxAgents: number): Array<{ type: string; count: number }> {
    // Default configuration based on maxAgents
    if (maxAgents <= 3) {
      return [
        { type: 'coder', count: 1 },
        { type: 'tester', count: 1 }
      ];
    } else if (maxAgents <= 5) {
      return [
        { type: 'coder', count: 2 },
        { type: 'tester', count: 1 },
        { type: 'researcher', count: 1 }
      ];
    } else {
      return [
        { type: 'coder', count: 2 },
        { type: 'tester', count: 1 },
        { type: 'researcher', count: 1 },
        { type: 'analyst', count: 1 }
      ];
    }
  }

  private setupSwarmEventHandlers(swarm: Swarm): void {
    swarm.on('task-completed', (event) => {
      this.emit('swarm-task-completed', { 
        swarmId: swarm.getId(), 
        ...event 
      });
    });

    swarm.on('task-failed', (event) => {
      this.emit('swarm-task-failed', { 
        swarmId: swarm.getId(), 
        ...event 
      });
    });

    swarm.on('status-changed', (event) => {
      this.emit('swarm-status-changed', { 
        swarmId: swarm.getId(), 
        ...event 
      });
    });

    swarm.on('completed', (event) => {
      this.emit('swarm-completed', { 
        swarmId: swarm.getId(), 
        ...event 
      });
    });

    swarm.on('failed', (event) => {
      this.emit('swarm-failed', { 
        swarmId: swarm.getId(), 
        ...event 
      });
    });
  }

  async list(includeCompleted: boolean = false): Promise<SwarmStatus[]> {
    const swarmStatuses: SwarmStatus[] = [];

    for (const swarm of this.swarms.values()) {
      const status = swarm.getStatus();
      
      if (includeCompleted || (status.status !== 'completed' && status.status !== 'failed')) {
        swarmStatuses.push(status);
      }
    }

    return swarmStatuses.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getSwarm(swarmId: string): Promise<Swarm | null> {
    return this.swarms.get(swarmId) || null;
  }

  async stop(swarmId: string): Promise<void> {
    const swarm = this.swarms.get(swarmId);
    if (!swarm) {
      throw new Error(`Swarm ${swarmId} not found`);
    }

    await swarm.stop();
    this.emit('swarm-stopped', { swarmId });
  }

  async pause(swarmId: string): Promise<void> {
    const swarm = this.swarms.get(swarmId);
    if (!swarm) {
      throw new Error(`Swarm ${swarmId} not found`);
    }

    swarm.pause();
    this.emit('swarm-paused', { swarmId });
  }

  async resume(swarmId: string): Promise<void> {
    const swarm = this.swarms.get(swarmId);
    if (!swarm) {
      throw new Error(`Swarm ${swarmId} not found`);
    }

    await swarm.resume();
    this.emit('swarm-resumed', { swarmId });
  }

  async destroySwarm(swarmId: string): Promise<void> {
    const swarm = this.swarms.get(swarmId);
    if (!swarm) {
      throw new Error(`Swarm ${swarmId} not found`);
    }

    await swarm.destroy();
    this.swarms.delete(swarmId);
    this.emit('swarm-destroyed', { swarmId });
  }

  getStats(): {
    totalSwarms: number;
    activeSwarms: number;
    completedSwarms: number;
    failedSwarms: number;
    totalAgents: number;
    activeAgents: number;
  } {
    let activeSwarms = 0;
    let completedSwarms = 0;
    let failedSwarms = 0;
    let totalAgents = 0;
    let activeAgents = 0;

    for (const swarm of this.swarms.values()) {
      const status = swarm.getStatus();
      
      switch (status.status) {
        case 'active':
        case 'initializing':
          activeSwarms++;
          break;
        case 'completed':
          completedSwarms++;
          break;
        case 'failed':
          failedSwarms++;
          break;
      }

      totalAgents += status.agents.length;
      activeAgents += status.metrics.activeAgents;
    }

    return {
      totalSwarms: this.swarms.size,
      activeSwarms,
      completedSwarms,
      failedSwarms,
      totalAgents,
      activeAgents
    };
  }
}

export class Swarm extends EventEmitter {
  private config: SwarmConfig;
  private agentFactory: AgentFactory;
  private memoryManager: MemoryManager;
  private coordinator: BaseAgent;
  private agents: Map<string, BaseAgent> = new Map();
  private status: SwarmStatus['status'] = 'initializing';
  private taskQueue: Task[] = [];
  private activeTasks: Map<string, string> = new Map(); // taskId -> agentId
  private completedTasks: Task[] = [];
  private failedTasks: Task[] = [];
  private createdAt: Date = new Date();
  private completedAt?: Date;

  constructor(
    config: SwarmConfig,
    agentFactory: AgentFactory,
    memoryManager: MemoryManager
  ) {
    super();
    this.config = config;
    this.agentFactory = agentFactory;
    this.memoryManager = memoryManager;
  }

  async initialize(): Promise<void> {
    try {
      this.status = 'initializing';
      
      // Create coordinator
      this.coordinator = this.agentFactory.createAgent('coordinator', {
        name: `${this.config.name} Coordinator`
      });

      // Create worker agents based on configuration
      for (const agentSpec of this.config.agents) {
        for (let i = 0; i < agentSpec.count; i++) {
          const agent = this.agentFactory.createAgent(agentSpec.type, agentSpec.config);
          this.agents.set(agent.getId(), agent);
          
          // Set up agent event handlers
          this.setupAgentEventHandlers(agent);
        }
      }

      // Initialize memory for this swarm
      await this.memoryManager.createSession(this.config.id);

      this.status = 'active';
      this.emit('initialized', { swarmId: this.config.id });
      
    } catch (error) {
      this.status = 'failed';
      this.emit('initialization-failed', { swarmId: this.config.id, error });
      throw error;
    }
  }

  private setupAgentEventHandlers(agent: BaseAgent): void {
    agent.on('task-completed', (event) => {
      this.handleTaskCompletion(event);
    });

    agent.on('task-failed', (event) => {
      this.handleTaskFailure(event);
    });

    agent.on('message-sent', (event) => {
      this.emit('agent-message', event);
    });
  }

  async execute(): Promise<string> {
    if (this.status !== 'active') {
      throw new Error(`Cannot execute swarm in status: ${this.status}`);
    }

    try {
      // Create main task from objective
      const mainTask: Task = {
        id: `main-task-${this.config.id}`,
        description: this.config.objective,
        priority: 'high',
        status: 'pending',
        dependencies: [],
        createdAt: new Date()
      };

      // Execute the main task through coordinator
      const result = await this.coordinator.executeTask(mainTask);
      
      this.status = 'completed';
      this.completedAt = new Date();
      this.emit('completed', { swarmId: this.config.id, result });

      return result;

    } catch (error: any) {
      this.status = 'failed';
      this.completedAt = new Date();
      this.emit('failed', { swarmId: this.config.id, error: error.message });
      throw error;
    }
  }

  private handleTaskCompletion(event: any): void {
    const taskId = event.task;
    this.activeTasks.delete(taskId);
    
    // Move task to completed
    const task = this.taskQueue.find(t => t.id === taskId);
    if (task) {
      task.status = 'completed';
      task.completedAt = new Date();
      task.result = event.result;
      this.completedTasks.push(task);
    }

    this.emit('task-completed', event);
  }

  private handleTaskFailure(event: any): void {
    const taskId = event.task;
    this.activeTasks.delete(taskId);
    
    // Move task to failed
    const task = this.taskQueue.find(t => t.id === taskId);
    if (task) {
      task.status = 'failed';
      task.completedAt = new Date();
      task.error = event.error;
      this.failedTasks.push(task);
    }

    this.emit('task-failed', event);
  }

  getId(): string {
    return this.config.id;
  }

  getName(): string {
    return this.config.name;
  }

  getConfig(): SwarmConfig {
    return { ...this.config };
  }

  getAgents(): BaseAgent[] {
    return [this.coordinator, ...Array.from(this.agents.values())];
  }

  getStatus(): SwarmStatus {
    const agents = this.getAgents();
    const activeAgents = agents.filter(a => a.isCurrentlyActive()).length;
    const tasksCompleted = this.completedTasks.length;
    const tasksTotal = this.taskQueue.length + tasksCompleted + this.failedTasks.length;
    const successRate = tasksTotal > 0 ? (tasksCompleted / tasksTotal) * 100 : 0;

    return {
      id: this.config.id,
      name: this.config.name,
      status: this.status,
      objective: this.config.objective,
      topology: this.config.topology,
      agents: agents.map(agent => ({
        id: agent.getId(),
        name: agent.getName(),
        type: agent.getType(),
        status: agent.isCurrentlyActive() ? 'active' : 'idle',
        role: agent.getRole(),
        tasksCompleted: 0 // Could be tracked from agent stats
      })),
      currentTask: this.getCurrentTask(),
      createdAt: this.createdAt,
      completedAt: this.completedAt,
      progress: tasksTotal > 0 ? (tasksCompleted / tasksTotal) * 100 : 0,
      metrics: {
        tasksCompleted,
        tasksTotal,
        activeAgents,
        totalAgents: agents.length,
        successRate
      }
    };
  }

  private getCurrentTask(): SwarmStatus['currentTask'] {
    for (const [taskId, agentId] of this.activeTasks) {
      const task = this.taskQueue.find(t => t.id === taskId);
      if (task) {
        return {
          id: taskId,
          description: task.description,
          assignedAgent: agentId,
          status: task.status
        };
      }
    }
    return undefined;
  }

  pause(): void {
    if (this.status === 'active') {
      this.status = 'paused';
      this.emit('status-changed', { status: 'paused' });
    }
  }

  async resume(): Promise<void> {
    if (this.status === 'paused') {
      this.status = 'active';
      this.emit('status-changed', { status: 'active' });
    }
  }

  async stop(): Promise<void> {
    this.status = 'completed';
    this.completedAt = new Date();
    this.emit('status-changed', { status: 'completed' });
  }

  async destroy(): Promise<void> {
    // Clean up agents
    for (const agent of this.getAgents()) {
      agent.removeAllListeners();
    }

    // Clean up memory session
    await this.memoryManager.deleteSession(this.config.id);

    this.emit('destroyed', { swarmId: this.config.id });
  }
}