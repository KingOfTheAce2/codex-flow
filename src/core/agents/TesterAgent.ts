import { BaseAgent, Task, AgentConfig } from './BaseAgent';
import { ProviderManager } from '../providers/ProviderManager';

export class TesterAgent extends BaseAgent {
  private testHistory: Array<{
    testType: string;
    target: string;
    result: 'pass' | 'fail' | 'partial';
    details: string;
    timestamp: Date;
  }> = [];

  constructor(config: AgentConfig, providerManager: ProviderManager) {
    super(config, providerManager);
    
    if (!config.systemPrompt) {
      config.systemPrompt = this.getSystemPrompt();
    }
  }

  getSystemPrompt(): string {
    return this.config.systemPrompt || `You are ${this.config.name}, an expert Tester Agent specializing in comprehensive software testing and quality assurance.

Your core capabilities:
- Design and implement comprehensive test strategies
- Write unit, integration, and end-to-end tests
- Perform manual and automated testing
- Create test plans and test cases
- Execute load testing and performance validation
- Conduct security testing and vulnerability assessment
- Implement continuous testing pipelines
- Analyze test results and generate reports

Testing expertise across:
- Unit Testing (Jest, pytest, JUnit, etc.)
- Integration Testing (API testing, database testing)
- End-to-End Testing (Selenium, Playwright, Cypress)
- Performance Testing (load, stress, spike testing)
- Security Testing (OWASP, penetration testing basics)
- Accessibility Testing (WCAG compliance)
- Mobile Testing (iOS, Android)
- API Testing (REST, GraphQL, gRPC)

Quality Assurance practices:
- Test-driven development (TDD)
- Behavior-driven development (BDD)
- Risk-based testing
- Exploratory testing
- Regression testing
- Test automation frameworks
- CI/CD integration

Always:
- Focus on comprehensive test coverage
- Design tests that catch edge cases
- Write maintainable and reliable tests
- Document test cases and results clearly
- Consider performance and scalability
- Validate both positive and negative scenarios
- Ensure tests are independent and repeatable`;
  }

  async processTask(task: Task): Promise<string> {
    const taskLower = task.description.toLowerCase();
    
    // Determine the type of testing task
    if (taskLower.includes('unit test') || taskLower.includes('unittest')) {
      return await this.writeUnitTests(task);
    } else if (taskLower.includes('integration test')) {
      return await this.writeIntegrationTests(task);
    } else if (taskLower.includes('e2e') || taskLower.includes('end-to-end')) {
      return await this.writeE2ETests(task);
    } else if (taskLower.includes('performance') || taskLower.includes('load test')) {
      return await this.designPerformanceTests(task);
    } else if (taskLower.includes('security') || taskLower.includes('vulnerability')) {
      return await this.conductSecurityTesting(task);
    } else if (taskLower.includes('test plan') || taskLower.includes('strategy')) {
      return await this.createTestPlan(task);
    } else if (taskLower.includes('validate') || taskLower.includes('verify')) {
      return await this.validateFunctionality(task);
    } else {
      return await this.performGeneralTesting(task);
    }
  }

  async generateResponse(prompt: string, context?: any): Promise<string> {
    const response = await this.callProvider({
      temperature: 0.3 // Moderate temperature for testing creativity while maintaining accuracy
    }, [
      { role: 'user', content: prompt }
    ]);

    return response.content;
  }

  private async writeUnitTests(task: Task): Promise<string> {
    const unitTestPrompt = `Write comprehensive unit tests for:

${task.description}

Please provide:
1. Complete test suite with multiple test cases
2. Positive and negative test scenarios
3. Edge cases and boundary testing
4. Mock/stub setup where needed
5. Test data and fixtures
6. Clear test descriptions and assertions

Include:
- Setup and teardown procedures
- Test isolation and independence
- Comprehensive coverage of all code paths
- Error condition testing
- Performance considerations
- Instructions for running tests

Format with proper test framework syntax and markdown code blocks.`;

    const response = await this.callProvider({
      temperature: 0.2
    }, [
      { role: 'user', content: unitTestPrompt }
    ]);

    this.recordTestActivity('unit', task.description, 'pass', response.content);
    return response.content;
  }

  private async writeIntegrationTests(task: Task): Promise<string> {
    const integrationTestPrompt = `Design integration tests for:

${task.description}

Please provide:
1. Integration test scenarios
2. Service/component interaction testing
3. Database integration testing
4. API endpoint testing
5. External service mocking strategies
6. Data flow validation

Focus on:
- Component boundaries and interfaces
- Data consistency across services
- Error propagation and handling
- Transaction boundaries
- Configuration and environment setup
- Test environment requirements`;

    const response = await this.callProvider({
      temperature: 0.3
    }, [
      { role: 'user', content: integrationTestPrompt }
    ]);

    this.recordTestActivity('integration', task.description, 'pass', response.content);
    return response.content;
  }

  private async writeE2ETests(task: Task): Promise<string> {
    const e2eTestPrompt = `Create end-to-end tests for:

${task.description}

Please provide:
1. Complete user journey test scenarios
2. Browser automation scripts
3. Cross-browser compatibility tests
4. Mobile responsiveness validation
5. Accessibility testing
6. Performance benchmarks

Include:
- Page object model patterns
- Test data management
- Screenshot/video capture
- Parallel execution setup
- CI/CD integration
- Environment configuration
- Reporting and analytics`;

    const response = await this.callProvider({
      temperature: 0.3
    }, [
      { role: 'user', content: e2eTestPrompt }
    ]);

    this.recordTestActivity('e2e', task.description, 'pass', response.content);
    return response.content;
  }

  private async designPerformanceTests(task: Task): Promise<string> {
    const performanceTestPrompt = `Design performance tests for:

${task.description}

Please provide:
1. Load testing scenarios
2. Stress testing approaches
3. Spike testing configurations
4. Performance benchmarks and SLAs
5. Resource monitoring strategies
6. Bottleneck identification methods

Include:
- Load generation scripts
- Performance metrics to track
- Test data and scenarios
- Environment requirements
- Result analysis approaches
- Optimization recommendations`;

    const response = await this.callProvider({
      temperature: 0.3
    }, [
      { role: 'user', content: performanceTestPrompt }
    ]);

    this.recordTestActivity('performance', task.description, 'pass', response.content);
    return response.content;
  }

  private async conductSecurityTesting(task: Task): Promise<string> {
    const securityTestPrompt = `Conduct security testing for:

${task.description}

Please provide:
1. OWASP Top 10 vulnerability checks
2. Authentication and authorization testing
3. Input validation and sanitization tests
4. SQL injection and XSS prevention
5. API security testing
6. Data privacy and encryption validation

Include:
- Security test cases
- Vulnerability scanning approaches
- Penetration testing scenarios
- Security configuration validation
- Compliance checking (GDPR, HIPAA, etc.)
- Security monitoring and logging`;

    const response = await this.callProvider({
      temperature: 0.2
    }, [
      { role: 'user', content: securityTestPrompt }
    ]);

    this.recordTestActivity('security', task.description, 'pass', response.content);
    return response.content;
  }

  private async createTestPlan(task: Task): Promise<string> {
    const testPlanPrompt = `Create a comprehensive test plan for:

${task.description}

Please provide:
1. Test scope and objectives
2. Testing approach and strategy
3. Test types and levels
4. Resource requirements
5. Timeline and milestones
6. Risk assessment and mitigation
7. Entry and exit criteria
8. Deliverables and reporting

Include:
- Test environment setup
- Test data requirements
- Tools and frameworks
- Team roles and responsibilities
- Quality metrics and KPIs
- Communication plan
- Contingency planning`;

    const response = await this.callProvider({
      temperature: 0.4
    }, [
      { role: 'user', content: testPlanPrompt }
    ]);

    this.recordTestActivity('planning', task.description, 'pass', response.content);
    return response.content;
  }

  private async validateFunctionality(task: Task): Promise<string> {
    const validationPrompt = `Validate the functionality described in:

${task.description}

Please provide:
1. Functional validation test cases
2. Requirements coverage analysis
3. Acceptance criteria verification
4. User story validation
5. Business rule testing
6. Workflow testing

Include:
- Test case design
- Expected vs actual results
- Defect identification
- Coverage analysis
- Recommendations for improvement
- Sign-off criteria`;

    const response = await this.callProvider({
      temperature: 0.3
    }, [
      { role: 'user', content: validationPrompt }
    ]);

    this.recordTestActivity('validation', task.description, 'pass', response.content);
    return response.content;
  }

  private async performGeneralTesting(task: Task): Promise<string> {
    const generalTestPrompt = `Perform comprehensive testing for:

${task.description}

Please provide:
1. Test analysis and approach
2. Appropriate test types and methods
3. Test case design and execution
4. Risk assessment
5. Quality evaluation
6. Recommendations and next steps

Consider:
- Functional requirements
- Non-functional requirements
- User experience
- Performance implications
- Security considerations
- Maintainability and scalability`;

    const response = await this.callProvider({
      temperature: 0.3
    }, [
      { role: 'user', content: generalTestPrompt }
    ]);

    this.recordTestActivity('general', task.description, 'pass', response.content);
    return response.content;
  }

  private recordTestActivity(testType: string, target: string, result: 'pass' | 'fail' | 'partial', details: string): void {
    this.testHistory.push({
      testType,
      target,
      result,
      details,
      timestamp: new Date()
    });

    // Keep history manageable
    if (this.testHistory.length > 100) {
      this.testHistory = this.testHistory.slice(-50);
    }
  }

  // Specialized testing methods
  async generateTestData(schema: any, recordCount: number = 10): Promise<string> {
    const testDataPrompt = `Generate ${recordCount} realistic test data records based on this schema:

${JSON.stringify(schema, null, 2)}

Provide:
1. Valid data samples covering different scenarios
2. Edge case data (boundaries, limits)
3. Invalid data for negative testing
4. Performance testing data sets
5. Data generation scripts or queries

Format as JSON, SQL, or appropriate format for the schema.`;

    return await this.generateResponse(testDataPrompt);
  }

  async analyzeTestCoverage(codeOrDescription: string): Promise<string> {
    const coveragePrompt = `Analyze test coverage for:

${codeOrDescription}

Provide:
1. Coverage analysis (line, branch, function)
2. Untested code paths identification
3. Missing test scenarios
4. Coverage improvement recommendations
5. Risk assessment for untested areas
6. Priority suggestions for additional tests

Include specific recommendations for achieving better coverage.`;

    return await this.generateResponse(coveragePrompt);
  }

  async createTestAutomation(manualTests: string, framework: string): Promise<string> {
    const automationPrompt = `Convert these manual tests to automated tests using ${framework}:

${manualTests}

Provide:
1. Automated test scripts
2. Test framework setup
3. Page object models (if UI testing)
4. Test data management
5. Configuration files
6. CI/CD integration
7. Reporting setup

Make the automation maintainable and scalable.`;

    return await this.generateResponse(automationPrompt);
  }

  async reviewTestCases(testCases: string): Promise<string> {
    const reviewPrompt = `Review these test cases for quality and completeness:

${testCases}

Provide:
1. Test case quality assessment
2. Coverage gaps identification
3. Improvement suggestions
4. Best practice recommendations
5. Risk assessment
6. Prioritization suggestions

Focus on effectiveness, maintainability, and coverage.`;

    return await this.generateResponse(reviewPrompt);
  }

  // Public API methods
  getTestHistory(): Array<{
    testType: string;
    target: string;
    result: 'pass' | 'fail' | 'partial';
    details: string;
    timestamp: Date;
  }> {
    return [...this.testHistory];
  }

  getTestStats(): {
    totalTests: number;
    passRate: number;
    testTypes: Record<string, number>;
    recentActivity: number;
  } {
    const total = this.testHistory.length;
    const passed = this.testHistory.filter(t => t.result === 'pass').length;
    const passRate = total > 0 ? (passed / total) * 100 : 0;

    const testTypes: Record<string, number> = {};
    for (const test of this.testHistory) {
      testTypes[test.testType] = (testTypes[test.testType] || 0) + 1;
    }

    const recentActivity = this.testHistory.filter(
      t => Date.now() - t.timestamp.getTime() < 24 * 60 * 60 * 1000
    ).length;

    return {
      totalTests: total,
      passRate,
      testTypes,
      recentActivity
    };
  }

  clearTestHistory(): void {
    this.testHistory = [];
  }

  async generateBugReport(issue: string): Promise<string> {
    const bugReportPrompt = `Generate a comprehensive bug report for:

${issue}

Include:
1. Bug summary and description
2. Steps to reproduce
3. Expected vs actual behavior
4. Environment details
5. Severity and priority assessment
6. Impact analysis
7. Suggested fixes or workarounds
8. Test cases to verify the fix

Format as a professional bug report suitable for development teams.`;

    return await this.generateResponse(bugReportPrompt);
  }
}