import { BaseAgent, Task, AgentConfig } from './BaseAgent.js';
import { ProviderManager } from '../providers/ProviderManager.js';

export class CoderAgent extends BaseAgent {
  private codeHistory: Array<{ 
    language: string; 
    code: string; 
    task: string; 
    timestamp: Date 
  }> = [];

  constructor(config: AgentConfig, providerManager: ProviderManager) {
    super(config, providerManager);
    
    if (!config.systemPrompt) {
      config.systemPrompt = this.getSystemPrompt();
    }
  }

  getSystemPrompt(): string {
    return this.config.systemPrompt || `You are ${this.config.name}, an expert Coder Agent specializing in writing high-quality, maintainable code.

Your core capabilities:
- Write clean, efficient, and well-documented code in multiple programming languages
- Follow best practices and coding standards for each language
- Implement proper error handling and edge case management
- Create modular, reusable code components
- Optimize for performance and maintainability
- Generate comprehensive unit tests
- Review and refactor existing code
- Debug and fix code issues

Programming languages you excel at:
- JavaScript/TypeScript (Node.js, React, etc.)
- Python (Django, FastAPI, data science)
- Go (microservices, CLI tools)
- Rust (systems programming, performance)
- Java/Kotlin (enterprise, Android)
- C# (.NET, Unity)
- SQL (database design, optimization)

Always:
- Write production-ready code with proper error handling
- Include clear comments and documentation
- Follow language-specific best practices
- Consider security implications
- Write testable code
- Optimize for readability and maintainability

Format your code responses with proper markdown code blocks and language specification.`;
  }

  async processTask(task: Task): Promise<string> {
    const taskLower = task.description.toLowerCase();
    
    // Determine the type of coding task
    if (taskLower.includes('review') || taskLower.includes('refactor')) {
      return await this.reviewOrRefactorCode(task);
    } else if (taskLower.includes('fix') || taskLower.includes('debug') || taskLower.includes('bug')) {
      return await this.fixCode(task);
    } else if (taskLower.includes('test') || taskLower.includes('unit test')) {
      return await this.writeTests(task);
    } else if (taskLower.includes('optimize') || taskLower.includes('performance')) {
      return await this.optimizeCode(task);
    } else {
      return await this.writeNewCode(task);
    }
  }

  async generateResponse(prompt: string, context?: any): Promise<string> {
    const response = await this.callProvider({
      temperature: 0.2 // Lower temperature for more consistent code
    }, [
      { role: 'user', content: prompt }
    ]);

    // Store code if present
    this.extractAndStoreCode(response.content, prompt);
    
    return response.content;
  }

  private async writeNewCode(task: Task): Promise<string> {
    const codePrompt = `Write code for the following requirement:

${task.description}

Please provide:
1. Clean, well-documented code
2. Proper error handling
3. Any necessary imports/dependencies
4. Usage examples if appropriate
5. Brief explanation of the implementation approach

Format with proper markdown code blocks.`;

    const response = await this.callProvider({
      temperature: 0.2
    }, [
      { role: 'user', content: codePrompt }
    ]);

    this.extractAndStoreCode(response.content, task.description);
    return response.content;
  }

  private async reviewOrRefactorCode(task: Task): Promise<string> {
    const reviewPrompt = `Review and/or refactor the following code:

${task.description}

Please provide:
1. Code quality assessment
2. Identified issues and improvements
3. Refactored code if necessary
4. Best practice recommendations
5. Performance considerations

Focus on:
- Code clarity and maintainability
- Security vulnerabilities
- Performance optimizations
- Design patterns and architecture
- Error handling improvements`;

    const response = await this.callProvider({
      temperature: 0.3
    }, [
      { role: 'user', content: reviewPrompt }
    ]);

    return response.content;
  }

  private async fixCode(task: Task): Promise<string> {
    const fixPrompt = `Debug and fix the following code issue:

${task.description}

Please provide:
1. Root cause analysis
2. Fixed code with corrections highlighted
3. Explanation of what was wrong
4. Prevention strategies for similar issues
5. Any additional improvements

Focus on:
- Identifying the specific bug or error
- Providing a working solution
- Explaining the fix clearly
- Suggesting testing approaches`;

    const response = await this.callProvider({
      temperature: 0.1 // Very low temperature for debugging
    }, [
      { role: 'user', content: fixPrompt }
    ]);

    return response.content;
  }

  private async writeTests(task: Task): Promise<string> {
    const testPrompt = `Write comprehensive tests for:

${task.description}

Please provide:
1. Unit tests with good coverage
2. Edge case testing
3. Error condition testing
4. Mock/stub setup if needed
5. Test organization and structure

Include:
- Test framework setup
- Assertion statements
- Test data and fixtures
- Comments explaining test scenarios
- Instructions for running tests`;

    const response = await this.callProvider({
      temperature: 0.2
    }, [
      { role: 'user', content: testPrompt }
    ]);

    return response.content;
  }

  private async optimizeCode(task: Task): Promise<string> {
    const optimizePrompt = `Optimize the following code for performance:

${task.description}

Please provide:
1. Performance analysis of current code
2. Identified bottlenecks
3. Optimized version with improvements
4. Benchmark comparisons if applicable
5. Trade-offs and considerations

Focus on:
- Time complexity improvements
- Memory usage optimization
- Algorithmic improvements
- Caching strategies
- Parallel processing opportunities`;

    const response = await this.callProvider({
      temperature: 0.2
    }, [
      { role: 'user', content: optimizePrompt }
    ]);

    return response.content;
  }

  private extractAndStoreCode(response: string, taskDescription: string): void {
    // Extract code blocks from markdown
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;

    while ((match = codeBlockRegex.exec(response)) !== null) {
      const language = match[1] || 'unknown';
      const code = match[2];
      
      this.codeHistory.push({
        language,
        code,
        task: taskDescription,
        timestamp: new Date()
      });
    }

    // Keep history manageable
    if (this.codeHistory.length > 50) {
      this.codeHistory = this.codeHistory.slice(-25);
    }
  }

  // Specialized coding methods
  async generateBoilerplate(framework: string, projectType: string): Promise<string> {
    const boilerplatePrompt = `Generate boilerplate code for a ${projectType} project using ${framework}.

Include:
- Project structure
- Configuration files
- Basic setup code
- Essential dependencies
- Development scripts
- README with setup instructions

Make it production-ready with proper organization.`;

    return await this.generateResponse(boilerplatePrompt);
  }

  async explainCode(code: string): Promise<string> {
    const explainPrompt = `Explain this code in detail:

\`\`\`
${code}
\`\`\`

Provide:
1. Overall purpose and functionality
2. Line-by-line or block-by-block explanation
3. Key concepts and patterns used
4. Dependencies and requirements
5. Potential improvements or alternatives`;

    return await this.generateResponse(explainPrompt);
  }

  async convertCode(code: string, fromLanguage: string, toLanguage: string): Promise<string> {
    const convertPrompt = `Convert this ${fromLanguage} code to ${toLanguage}:

\`\`\`${fromLanguage}
${code}
\`\`\`

Ensure:
- Equivalent functionality
- Language-specific best practices
- Proper syntax and idioms
- Necessary imports/dependencies
- Comments explaining any differences`;

    return await this.generateResponse(convertPrompt);
  }

  async generateAPI(specification: string): Promise<string> {
    const apiPrompt = `Generate a REST API based on this specification:

${specification}

Include:
- Route definitions
- Request/response models
- Validation logic
- Error handling
- Authentication/authorization if needed
- Database integration patterns
- Documentation comments

Use modern patterns and best practices.`;

    return await this.generateResponse(apiPrompt);
  }

  async writeDocumentation(code: string, language: string): Promise<string> {
    const docPrompt = `Write comprehensive documentation for this ${language} code:

\`\`\`${language}
${code}
\`\`\`

Include:
- API documentation (if applicable)
- Function/method descriptions
- Parameter explanations
- Return value documentation
- Usage examples
- Installation/setup instructions
- Contributing guidelines`;

    return await this.generateResponse(docPrompt);
  }

  // Public API methods
  getCodeHistory(): Array<{ language: string; code: string; task: string; timestamp: Date }> {
    return [...this.codeHistory];
  }

  clearCodeHistory(): void {
    this.codeHistory = [];
  }

  getLanguageStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    
    for (const entry of this.codeHistory) {
      stats[entry.language] = (stats[entry.language] || 0) + 1;
    }
    
    return stats;
  }

  async validateCode(code: string, language: string): Promise<string> {
    const validatePrompt = `Validate and analyze this ${language} code for issues:

\`\`\`${language}
${code}
\`\`\`

Check for:
- Syntax errors
- Logic issues
- Security vulnerabilities
- Performance problems
- Code quality issues
- Best practice violations

Provide specific feedback and suggestions.`;

    return await this.generateResponse(validatePrompt);
  }
}