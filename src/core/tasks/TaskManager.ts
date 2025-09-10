import { EventEmitter } from 'events';
import { Task } from '../agents/BaseAgent.js';

export interface TaskFilter {
  swarmId?: string;
  assignedAgent?: string;
  status?: Task['status'];
  priority?: Task['priority'];
}

export interface CreateTaskRequest {
  description: string;
  priority?: Task['priority'];
  assignedAgent?: string;
  swarmId?: string;
  dependencies?: string[];
}

export interface UpdateTaskRequest {
  status?: Task['status'];
  assignedAgent?: string;
  priority?: Task['priority'];
  result?: string;
  error?: string;
}

export class TaskManager extends EventEmitter {
  private tasks: Map<string, Task> = new Map();
  private taskCounter = 0;
  private config: any;

  constructor(config: any) {
    super();
    this.config = config;
  }

  async create(request: CreateTaskRequest): Promise<Task> {
    const taskId = `task-${++this.taskCounter}-${Date.now()}`;
    
    const task: Task = {
      id: taskId,
      description: request.description,
      priority: request.priority || 'medium',
      status: 'pending',
      assignedAgent: request.assignedAgent,
      swarmId: request.swarmId,
      dependencies: request.dependencies || [],
      createdAt: new Date()
    };

    this.tasks.set(taskId, task);
    
    this.emit('task-created', { task });
    
    return task;
  }

  async get(taskId: string): Promise<Task | null> {
    return this.tasks.get(taskId) || null;
  }

  async list(filter?: TaskFilter): Promise<Task[]> {
    let tasks = Array.from(this.tasks.values());

    if (filter) {
      if (filter.swarmId) {
        tasks = tasks.filter(t => t.swarmId === filter.swarmId);
      }
      if (filter.assignedAgent) {
        tasks = tasks.filter(t => t.assignedAgent === filter.assignedAgent);
      }
      if (filter.status) {
        tasks = tasks.filter(t => t.status === filter.status);
      }
      if (filter.priority) {
        tasks = tasks.filter(t => t.priority === filter.priority);
      }
    }

    return tasks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async update(taskId: string, updates: UpdateTaskRequest): Promise<Task | null> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return null;
    }

    const updatedTask = { ...task, ...updates };
    
    // Set completion time if status changed to completed or failed
    if (updates.status === 'completed' || updates.status === 'failed') {
      updatedTask.completedAt = new Date();
    }
    
    // Set start time if status changed to in_progress
    if (updates.status === 'in_progress' && !task.startedAt) {
      updatedTask.startedAt = new Date();
    }

    this.tasks.set(taskId, updatedTask);
    
    this.emit('task-updated', { taskId, updates, task: updatedTask });
    
    return updatedTask;
  }

  async delete(taskId: string): Promise<boolean> {
    const deleted = this.tasks.delete(taskId);
    
    if (deleted) {
      this.emit('task-deleted', { taskId });
    }
    
    return deleted;
  }

  async getTasksByAgent(agentId: string): Promise<Task[]> {
    return this.list({ assignedAgent: agentId });
  }

  async getTasksBySwarm(swarmId: string): Promise<Task[]> {
    return this.list({ swarmId });
  }

  async getPendingTasks(): Promise<Task[]> {
    return this.list({ status: 'pending' });
  }

  async getActiveTasks(): Promise<Task[]> {
    return this.list({ status: 'in_progress' });
  }

  getStats(): {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    failed: number;
    byPriority: Record<string, number>;
  } {
    const tasks = Array.from(this.tasks.values());
    
    const stats = {
      total: tasks.length,
      pending: 0,
      inProgress: 0,
      completed: 0,
      failed: 0,
      byPriority: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0
      }
    };

    for (const task of tasks) {
      switch (task.status) {
        case 'pending':
          stats.pending++;
          break;
        case 'in_progress':
          stats.inProgress++;
          break;
        case 'completed':
          stats.completed++;
          break;
        case 'failed':
          stats.failed++;
          break;
      }

      stats.byPriority[task.priority]++;
    }

    return stats;
  }

  async clear(): Promise<number> {
    const count = this.tasks.size;
    this.tasks.clear();
    this.taskCounter = 0;
    
    this.emit('tasks-cleared', { count });
    
    return count;
  }
}