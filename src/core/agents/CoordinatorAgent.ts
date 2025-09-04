import { BaseAgent, Task, AgentConfig } from './BaseAgent';
import { ProviderManager } from '../providers/ProviderManager';

export class CoordinatorAgent extends BaseAgent {
  private subordinates: Map<string, BaseAgent> = new Map();
  private taskQueue: Task[] = [];
  private activeTasks: Map<string, string> = new Map(); // taskId -> agentId

  constructor(config: AgentConfig, providerManager: ProviderManager) {
    super(config, providerManager);
    
    // Set default system prompt if not provided
    if (!config.systemPrompt) {
      config.systemPrompt = this.getSystemPrompt();
    }
  }

  getSystemPrompt(): string {
    return this.config.systemPrompt || `You are ${this.config.name}, a Coordinator Agent responsible for managing and delegating tasks to specialized agents in a swarm.

Your key responsibilities:
- Break down complex objectives into specific, actionable tasks
- Assign tasks to the most appropriate agents based on their capabilities
- Monitor task progress and provide guidance when needed
- Coordinate between agents to ensure smooth workflow
- Make decisions about task priority and resource allocation
- Resolve conflicts and dependencies between tasks

Available agent types and their capabilities:
- Coder: Writing, reviewing, and refactoring code
- Tester: Creating and running tests, quality assurance
- Researcher: Gathering information, analyzing data
- Analyst: Data analysis, pattern recognition, insights
- Writer: Documentation, content creation, communication

Always be clear, decisive, and consider the overall objective when making coordination decisions.
Communicate in a professional, helpful manner and provide specific, actionable instructions.`;
  }

  async processTask(task: Task): Promise<string> {
    this.addToHistory('user', `Coordinating task: ${task.description}`);

    // Analyze the task and determine delegation strategy
    const analysis = await this.analyzeTask(task);
    
    // Break down into subtasks if needed
    const subtasks = await this.breakDownTask(task, analysis);
    
    if (subtasks.length === 0) {
      // Handle task directly
      return await this.handleTaskDirectly(task);
    }

    // Delegate subtasks to appropriate agents
    const results = await this.delegateSubtasks(subtasks);
    
    // Synthesize results
    return await this.synthesizeResults(task, results);
  }

  async generateResponse(prompt: string, context?: any): Promise<string> {
    const response = await this.callProvider({}, [
      { role: 'user', content: prompt }
    ]);

    return response.content;
  }

  private async analyzeTask(task: Task): Promise<{
    complexity: 'low' | 'medium' | 'high';
    requiredSkills: string[];
    estimatedTime: number;
    canDelegate: boolean;
    suggestedAgents: string[];
  }> {
    const analysisPrompt = `Analyze this task for coordination purposes:

Task: ${task.description}
Priority: ${task.priority}

Determine:
1. Complexity level (low/medium/high)
2. Required skills/agent types needed
3. Estimated time to complete (in minutes)
4. Whether this can be delegated to other agents
5. Which specific agent types would be best suited

Respond with a JSON object containing your analysis.`;

    try {
      const response = await this.callProvider({}, [
        { role: 'user', content: analysisPrompt }
      ]);

      // Try to parse JSON response, fallback to structured analysis
      try {
        return JSON.parse(response.content);
      } catch {
        return this.parseAnalysisFromText(response.content);
      }
    } catch (error) {
      // Fallback analysis
      return {
        complexity: task.priority === 'critical' ? 'high' : 'medium',
        requiredSkills: ['coder'],
        estimatedTime: 30,
        canDelegate: true,
        suggestedAgents: ['coder']
      };
    }
  }

  private parseAnalysisFromText(text: string): any {
    // Simple text parsing fallback
    const complexity = text.toLowerCase().includes('high') ? 'high' : 
                      text.toLowerCase().includes('low') ? 'low' : 'medium';
    
    const skills = [];
    if (text.toLowerCase().includes('cod')) skills.push('coder');
    if (text.toLowerCase().includes('test')) skills.push('tester');
    if (text.toLowerCase().includes('research')) skills.push('researcher');
    if (text.toLowerCase().includes('analy')) skills.push('analyst');
    if (text.toLowerCase().includes('writ')) skills.push('writer');

    return {
      complexity,
      requiredSkills: skills.length > 0 ? skills : ['coder'],
      estimatedTime: complexity === 'high' ? 60 : complexity === 'medium' ? 30 : 15,
      canDelegate: true,
      suggestedAgents: skills.length > 0 ? skills : ['coder']
    };
  }

  private async breakDownTask(task: Task, analysis: any): Promise<Task[]> {
    if (analysis.complexity === 'low' || !analysis.canDelegate) {
      return []; // Handle directly
    }

    const breakdownPrompt = `Break down this complex task into specific subtasks:

Original Task: ${task.description}
Required Skills: ${analysis.requiredSkills.join(', ')}
Complexity: ${analysis.complexity}

Create 2-5 specific, actionable subtasks that different specialized agents can handle.
Each subtask should be clear, independent, and focused on a single responsibility.

Format as a numbered list with clear descriptions.`;

    try {
      const response = await this.callProvider({}, [
        { role: 'user', content: breakdownPrompt }
      ]);

      return this.parseSubtasksFromResponse(response.content, task);
    } catch (error) {
      return []; // Fallback to handling directly
    }
  }

  private parseSubtasksFromResponse(response: string, parentTask: Task): Task[] {
    const lines = response.split('\n').filter(line => line.trim());
    const subtasks: Task[] = [];

    let counter = 1;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.match(/^\d+\./) || trimmed.startsWith('-') || trimmed.startsWith('*')) {
        const description = trimmed.replace(/^\d+\.\s*/, '').replace(/^[-*]\s*/, '');
        if (description.length > 10) {
          subtasks.push({
            id: `${parentTask.id}-subtask-${counter++}`,
            description,
            priority: parentTask.priority,
            status: 'pending',
            dependencies: [],
            createdAt: new Date()
          });
        }
      }
    }

    return subtasks;
  }

  private async handleTaskDirectly(task: Task): Promise<string> {
    const directPrompt = `Handle this task directly as a coordinator:

Task: ${task.description}
Priority: ${task.priority}

Provide a comprehensive response or solution to complete this task.`;

    const response = await this.callProvider({}, [
      { role: 'user', content: directPrompt }
    ]);

    return response.content;
  }

  private async delegateSubtasks(subtasks: Task[]): Promise<Record<string, string>> {
    const results: Record<string, string> = {};
    
    for (const subtask of subtasks) {
      try {
        // Find best agent for this subtask
        const agentId = this.findBestAgent(subtask);
        
        if (agentId) {
          const agent = this.subordinates.get(agentId);
          if (agent) {
            this.activeTasks.set(subtask.id, agentId);
            const result = await agent.executeTask(subtask);
            results[subtask.id] = result;
            this.activeTasks.delete(subtask.id);
          }
        } else {
          // Handle subtask directly if no suitable agent
          results[subtask.id] = await this.handleTaskDirectly(subtask);
        }
      } catch (error) {
        results[subtask.id] = `Error: ${error.message}`;
      }
    }

    return results;
  }

  private findBestAgent(subtask: Task): string | null {
    // Simple agent selection logic - can be enhanced
    const description = subtask.description.toLowerCase();
    
    for (const [agentId, agent] of this.subordinates) {
      if (!agent.isCurrentlyActive()) {
        const agentType = agent.getType().toLowerCase();
        
        if (description.includes('code') || description.includes('implement') || description.includes('develop')) {
          if (agentType.includes('coder')) return agentId;
        } else if (description.includes('test') || description.includes('verify') || description.includes('check')) {
          if (agentType.includes('tester')) return agentId;
        } else if (description.includes('research') || description.includes('find') || description.includes('investigate')) {
          if (agentType.includes('researcher')) return agentId;
        } else if (description.includes('analyz') || description.includes('evaluate') || description.includes('assess')) {
          if (agentType.includes('analyst')) return agentId;
        } else if (description.includes('write') || description.includes('document') || description.includes('explain')) {
          if (agentType.includes('writer')) return agentId;
        }
      }
    }

    // Return first available agent as fallback
    for (const [agentId, agent] of this.subordinates) {
      if (!agent.isCurrentlyActive()) {
        return agentId;
      }
    }

    return null;
  }

  private async synthesizeResults(originalTask: Task, results: Record<string, string>): Promise<string> {
    if (Object.keys(results).length === 0) {
      return "No results to synthesize.";
    }

    const synthesisPrompt = `Synthesize the following subtask results into a comprehensive response for the original task:

Original Task: ${originalTask.description}

Subtask Results:
${Object.entries(results).map(([taskId, result], index) => 
  `${index + 1}. ${result}`
).join('\n\n')}

Provide a coherent, comprehensive summary that addresses the original task objective.`;

    const response = await this.callProvider({}, [
      { role: 'user', content: synthesisPrompt }
    ]);

    return response.content;
  }

  // Agent management methods
  addSubordinate(agent: BaseAgent): void {
    this.subordinates.set(agent.getId(), agent);
    
    // Set up communication
    agent.on('message-sent', this.handleAgentMessage.bind(this));
    agent.on('task-completed', this.handleTaskCompletion.bind(this));
    agent.on('task-failed', this.handleTaskFailure.bind(this));

    this.emit('subordinate-added', { coordinator: this.config.id, agent: agent.getId() });
  }

  removeSubordinate(agentId: string): boolean {
    const removed = this.subordinates.delete(agentId);
    if (removed) {
      this.emit('subordinate-removed', { coordinator: this.config.id, agent: agentId });
    }
    return removed;
  }

  getSubordinates(): BaseAgent[] {
    return Array.from(this.subordinates.values());
  }

  private handleAgentMessage(event: any): void {
    // Forward message or handle coordination
    this.emit('agent-message', event);
  }

  private handleTaskCompletion(event: any): void {
    this.activeTasks.delete(event.task);
    this.emit('subtask-completed', event);
  }

  private handleTaskFailure(event: any): void {
    this.activeTasks.delete(event.task);
    this.emit('subtask-failed', event);
  }

  getActiveTaskCount(): number {
    return this.activeTasks.size;
  }

  getQueuedTaskCount(): number {
    return this.taskQueue.length;
  }

  getSubordinateStatus(): Array<{ id: string; name: string; type: string; isActive: boolean; currentTask?: string }> {
    return Array.from(this.subordinates.values()).map(agent => ({
      id: agent.getId(),
      name: agent.getName(),
      type: agent.getType(),
      isActive: agent.isCurrentlyActive(),
      currentTask: agent.getCurrentTaskId()
    }));
  }
}