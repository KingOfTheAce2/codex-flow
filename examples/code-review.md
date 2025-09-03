# Automated Code Review Workflow

This example demonstrates how to set up an automated code review workflow using Codex-Flow with multiple specialized reviewer agents working together to ensure code quality.

## Overview

We'll create a comprehensive code review system that:
- Analyzes code quality, security, and performance
- Provides detailed feedback and suggestions
- Generates improvement recommendations
- Produces a comprehensive review report
- Integrates with Git workflows

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                Code Review Pipeline                         │
├─────────────────────────────────────────────────────────────┤
│ Code Analysis │ Security Scan │ Performance │ Style Check   │
├─────────────────────────────────────────────────────────────┤
│          Collaborative Review & Feedback                    │
├─────────────────────────────────────────────────────────────┤
│ Report Generation │ Recommendations │ Quality Score        │
└─────────────────────────────────────────────────────────────┘
```

## Implementation

### Reviewer Swarm Setup

```typescript
import { CodexFlow } from 'codex-flow';
import { GitOperationsTool, FileOperationsTool } from 'codex-flow/tools';

async function createReviewSwarm() {
  const codexFlow = new CodexFlow({
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4',
    config: {
      memory: { enabled: true },
      logging: { level: 'info' }
    }
  });

  await codexFlow.initialize();

  // Create specialized code review swarm
  const swarm = await codexFlow.createSwarm({
    name: 'code-review-team',
    topology: 'hierarchical', // Lead reviewer coordinates others
    agents: [
      {
        type: 'lead-reviewer',
        name: 'review-coordinator',
        role: 'coordinator',
        capabilities: [
          'code-review-coordination',
          'report-synthesis',
          'quality-assessment',
          'team-communication'
        ]
      },
      {
        type: 'security-reviewer',
        name: 'security-analyst',
        role: 'specialist',
        capabilities: [
          'security-vulnerability-scanning',
          'authentication-review',
          'input-validation-analysis',
          'dependency-security-check'
        ]
      },
      {
        type: 'performance-reviewer',
        name: 'performance-analyst',
        role: 'specialist',
        capabilities: [
          'performance-bottleneck-detection',
          'memory-leak-analysis',
          'algorithm-optimization',
          'database-query-optimization'
        ]
      },
      {
        type: 'style-reviewer',
        name: 'style-analyst',
        role: 'specialist',
        capabilities: [
          'coding-standards-enforcement',
          'consistency-checking',
          'documentation-review',
          'naming-convention-validation'
        ]
      },
      {
        type: 'architecture-reviewer',
        name: 'architecture-analyst',
        role: 'specialist',
        capabilities: [
          'design-pattern-analysis',
          'coupling-cohesion-assessment',
          'scalability-review',
          'maintainability-evaluation'
        ]
      }
    ],
    coordination: {
      reviewProcess: 'collaborative',
      consensusRequired: true,
      knowledgeSharing: true
    }
  });

  // Register specialized tools
  codexFlow.registerTool(new GitOperationsTool());
  codexFlow.registerTool(new FileOperationsTool());
  codexFlow.registerTool(new CodeAnalysisTool());

  return { codexFlow, swarm };
}
```

### Review Execution

```typescript
interface ReviewConfiguration {
  repository: string;
  branch?: string;
  pullRequest?: number;
  files?: string[];
  excludePatterns?: string[];
  reviewCriteria: {
    security: boolean;
    performance: boolean;
    style: boolean;
    architecture: boolean;
    documentation: boolean;
  };
  outputFormat: 'markdown' | 'json' | 'html';
  integrations: {
    github?: boolean;
    slack?: boolean;
    email?: boolean;
  };
}

async function executeCodeReview(
  codexFlow: CodexFlow, 
  swarmId: string, 
  config: ReviewConfiguration
) {
  const reviewTask = await codexFlow.executeTask({
    description: "Conduct comprehensive code review",
    type: 'code-review',
    context: {
      repository: config.repository,
      branch: config.branch || 'main',
      pullRequest: config.pullRequest,
      files: config.files || []
    },
    requirements: [
      // Code Analysis
      "Analyze code structure and organization",
      "Identify design patterns and anti-patterns",
      "Check for code smells and technical debt",
      
      // Security Review
      "Scan for security vulnerabilities",
      "Review authentication and authorization",
      "Check input validation and sanitization",
      "Analyze dependency security",
      
      // Performance Analysis  
      "Identify performance bottlenecks",
      "Review database query efficiency",
      "Analyze memory usage patterns",
      "Check for unnecessary computations",
      
      // Style and Standards
      "Enforce coding standards and conventions",
      "Check consistency across codebase",
      "Review documentation quality",
      "Validate naming conventions",
      
      // Architecture Assessment
      "Evaluate overall system design",
      "Check separation of concerns",
      "Assess scalability considerations",
      "Review error handling strategies"
    ],
    criteria: config.reviewCriteria,
    swarm: swarmId,
    parallel: true,
    timeout: 900000, // 15 minutes
    trackProgress: true,
    quality: {
      thoroughness: 'comprehensive',
      evidenceBased: true,
      actionableAdvice: true
    }
  });

  return reviewTask;
}
```

### Review Monitoring

```typescript
function setupReviewMonitoring(codexFlow: CodexFlow) {
  const reviewProgress = {
    phases: [
      'Code Discovery',
      'Security Analysis', 
      'Performance Review',
      'Style Check',
      'Architecture Assessment',
      'Report Synthesis'
    ],
    currentPhase: 0,
    findings: []
  };

  codexFlow.on('review:phase:started', (data) => {
    const phase = reviewProgress.phases[data.phaseIndex];
    console.log(`\n🔍 Starting: ${phase}`);
    console.log(`👤 Lead: ${data.leadAgent}`);
    if (data.collaborators) {
      console.log(`🤝 Collaborators: ${data.collaborators.join(', ')}`);
    }
  });

  codexFlow.on('review:finding:discovered', (data) => {
    const severityEmoji = {
      'critical': '🔴',
      'high': '🟠', 
      'medium': '🟡',
      'low': '🟢',
      'info': '🔵'
    };

    console.log(`${severityEmoji[data.severity]} Finding: ${data.title}`);
    console.log(`   File: ${data.file}:${data.line}`);
    console.log(`   Category: ${data.category}`);
    
    reviewProgress.findings.push(data);
  });

  codexFlow.on('review:suggestion:generated', (data) => {
    console.log(`💡 Suggestion: ${data.title}`);
    console.log(`   Impact: ${data.estimatedImpact}`);
    console.log(`   Effort: ${data.estimatedEffort}`);
  });

  codexFlow.on('review:consensus:reached', (data) => {
    console.log(`✅ Consensus reached on: ${data.topic}`);
    console.log(`   Decision: ${data.decision}`);
    console.log(`   Reviewers: ${data.participants.join(', ')}`);
  });

  codexFlow.on('review:quality:score', (data) => {
    console.log(`📊 Quality Score: ${data.score}/100`);
    console.log(`   Breakdown:`);
    Object.entries(data.breakdown).forEach(([category, score]) => {
      console.log(`     ${category}: ${score}/100`);
    });
  });

  return reviewProgress;
}
```

### Complete Review Example

```typescript
import { CodexFlow } from 'codex-flow';
import path from 'path';

async function main() {
  try {
    console.log('🔍 Starting Automated Code Review');
    console.log('==================================');

    // 1. Initialize review system
    const { codexFlow, swarm } = await createReviewSwarm();
    console.log(`✅ Review team assembled: ${swarm.agents.length} reviewers`);

    // 2. Configure review parameters
    const reviewConfig: ReviewConfiguration = {
      repository: './sample-project',
      branch: 'feature/user-authentication',
      files: [
        'src/auth/authController.js',
        'src/middleware/authentication.js', 
        'src/models/User.js',
        'src/routes/auth.js',
        'tests/auth.test.js'
      ],
      reviewCriteria: {
        security: true,
        performance: true,
        style: true,
        architecture: true,
        documentation: true
      },
      outputFormat: 'markdown',
      integrations: {
        github: true,
        slack: false
      }
    };

    // 3. Set up monitoring
    const progress = setupReviewMonitoring(codexFlow);

    // 4. Execute the review
    console.log('\n📋 Starting comprehensive code review...');
    const startTime = Date.now();

    const reviewResult = await executeCodeReview(codexFlow, swarm.id, reviewConfig);
    
    const duration = Date.now() - startTime;
    console.log(`\n✅ Review completed in ${duration / 1000}s`);

    // 5. Process and display results
    await processReviewResults(reviewResult, reviewConfig);

    // 6. Generate reports
    await generateReviewReports(reviewResult, reviewConfig);

    console.log('\n🎉 Code review process completed successfully!');

  } catch (error) {
    console.error('❌ Code review failed:', error);
    process.exit(1);
  }
}

async function processReviewResults(result: any, config: ReviewConfiguration) {
  console.log('\n📊 Review Summary');
  console.log('=================');

  // Overall quality score
  console.log(`🎯 Overall Quality Score: ${result.qualityScore}/100`);
  
  // Category breakdown
  console.log('\n📋 Category Scores:');
  Object.entries(result.categoryScores).forEach(([category, score]) => {
    const emoji = getScoreEmoji(score as number);
    console.log(`  ${emoji} ${category}: ${score}/100`);
  });

  // Findings summary
  const findingsByCategory = groupFindingsByCategory(result.findings);
  console.log('\n🔍 Findings Summary:');
  Object.entries(findingsByCategory).forEach(([category, findings]) => {
    console.log(`  ${category}: ${findings.length} issues`);
    
    const severityCounts = countBySeverity(findings);
    Object.entries(severityCounts).forEach(([severity, count]) => {
      if (count > 0) {
        const emoji = getSeverityEmoji(severity);
        console.log(`    ${emoji} ${severity}: ${count}`);
      }
    });
  });

  // Top recommendations
  console.log('\n💡 Top Recommendations:');
  result.recommendations
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 5)
    .forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec.title}`);
      console.log(`     Impact: ${rec.impact}/10, Effort: ${rec.effort}/10`);
    });

  // Files reviewed
  console.log('\n📁 Files Reviewed:');
  result.filesReviewed.forEach(file => {
    const score = file.qualityScore;
    const emoji = getScoreEmoji(score);
    console.log(`  ${emoji} ${file.path} (${score}/100)`);
  });
}

function getScoreEmoji(score: number): string {
  if (score >= 90) return '🟢';
  if (score >= 70) return '🟡';
  if (score >= 50) return '🟠';
  return '🔴';
}

function getSeverityEmoji(severity: string): string {
  const emojis = {
    'critical': '🔴',
    'high': '🟠',
    'medium': '🟡', 
    'low': '🟢',
    'info': '🔵'
  };
  return emojis[severity] || '⚪';
}

function groupFindingsByCategory(findings: any[]) {
  return findings.reduce((groups, finding) => {
    const category = finding.category || 'General';
    groups[category] = groups[category] || [];
    groups[category].push(finding);
    return groups;
  }, {});
}

function countBySeverity(findings: any[]) {
  return findings.reduce((counts, finding) => {
    counts[finding.severity] = (counts[finding.severity] || 0) + 1;
    return counts;
  }, {});
}

async function generateReviewReports(result: any, config: ReviewConfiguration) {
  console.log('\n📄 Generating Review Reports');
  console.log('============================');

  // Markdown report
  const markdownReport = generateMarkdownReport(result);
  console.log('✅ Generated: code-review-report.md');

  // JSON report for tools integration
  const jsonReport = generateJSONReport(result);
  console.log('✅ Generated: code-review-report.json');

  // GitHub integration
  if (config.integrations.github) {
    await publishToGitHub(result, config);
    console.log('✅ Published to GitHub PR');
  }

  // Summary for developers
  generateDeveloperSummary(result);
}

function generateMarkdownReport(result: any): string {
  return `# Code Review Report

## Overall Assessment
- **Quality Score**: ${result.qualityScore}/100
- **Review Date**: ${new Date().toISOString().split('T')[0]}
- **Reviewer Team**: ${result.reviewers.join(', ')}

## Quality Breakdown
${Object.entries(result.categoryScores).map(([category, score]) => 
  `- **${category}**: ${score}/100`
).join('\n')}

## Critical Issues
${result.findings
  .filter(f => f.severity === 'critical')
  .map(finding => `
### ${finding.title}
- **File**: ${finding.file}:${finding.line}
- **Category**: ${finding.category}
- **Description**: ${finding.description}
- **Recommendation**: ${finding.recommendation}
`).join('\n')}

## Recommendations
${result.recommendations.map((rec, i) => `
${i + 1}. **${rec.title}**
   - Impact: ${rec.impact}/10
   - Effort: ${rec.effort}/10
   - Description: ${rec.description}
`).join('\n')}

## Files Reviewed
${result.filesReviewed.map(file => 
  `- ${file.path}: ${file.qualityScore}/100`
).join('\n')}
`;
}

function generateJSONReport(result: any): object {
  return {
    metadata: {
      reviewDate: new Date().toISOString(),
      reviewers: result.reviewers,
      duration: result.duration
    },
    qualityMetrics: {
      overallScore: result.qualityScore,
      categoryScores: result.categoryScores,
      trend: result.trend || 'stable'
    },
    findings: result.findings,
    recommendations: result.recommendations,
    filesReviewed: result.filesReviewed,
    summary: {
      totalIssues: result.findings.length,
      criticalIssues: result.findings.filter(f => f.severity === 'critical').length,
      highImpactRecommendations: result.recommendations.filter(r => r.impact >= 8).length
    }
  };
}

async function publishToGitHub(result: any, config: ReviewConfiguration) {
  // This would integrate with GitHub API to post review comments
  // on the pull request
  console.log('📝 Publishing review to GitHub...');
  
  // Simulate GitHub integration
  const reviewComments = result.findings.map(finding => ({
    path: finding.file,
    line: finding.line,
    body: `**${finding.title}**\n\n${finding.description}\n\n**Recommendation**: ${finding.recommendation}`,
    severity: finding.severity
  }));

  console.log(`📨 Would post ${reviewComments.length} review comments`);
}

function generateDeveloperSummary(result: any) {
  console.log('\n👨‍💻 Developer Summary');
  console.log('===================');
  
  console.log('🎯 Focus Areas:');
  const priorities = result.recommendations
    .sort((a, b) => (b.impact - b.effort) - (a.impact - a.effort))
    .slice(0, 3);

  priorities.forEach((priority, index) => {
    console.log(`  ${index + 1}. ${priority.title} (ROI: ${(priority.impact - priority.effort).toFixed(1)})`);
  });

  console.log('\n⚡ Quick Wins:');
  const quickWins = result.recommendations.filter(r => r.effort <= 3 && r.impact >= 6);
  quickWins.slice(0, 3).forEach((win, index) => {
    console.log(`  ${index + 1}. ${win.title}`);
  });

  console.log('\n🚨 Must Fix:');
  const criticalIssues = result.findings.filter(f => f.severity === 'critical');
  criticalIssues.forEach((issue, index) => {
    console.log(`  ${index + 1}. ${issue.title} (${issue.file})`);
  });
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
}
```

## Sample Output

```
🔍 Starting Automated Code Review
==================================
✅ Review team assembled: 5 reviewers

📋 Starting comprehensive code review...

🔍 Starting: Code Discovery
👤 Lead: review-coordinator
🤝 Collaborators: security-analyst, performance-analyst, style-analyst, architecture-analyst

📁 Discovered 5 files for review:
  - src/auth/authController.js (247 lines)
  - src/middleware/authentication.js (89 lines)
  - src/models/User.js (134 lines)
  - src/routes/auth.js (67 lines)
  - tests/auth.test.js (156 lines)

🔍 Starting: Security Analysis
👤 Lead: security-analyst

🔴 Finding: JWT Secret Hardcoded
   File: src/auth/authController.js:23
   Category: Security

🟠 Finding: Missing Rate Limiting
   File: src/routes/auth.js:15
   Category: Security

🟡 Finding: Weak Password Validation
   File: src/models/User.js:45
   Category: Security

💡 Suggestion: Implement Environment-Based Configuration
   Impact: High (8/10)
   Effort: Low (2/10)

🔍 Starting: Performance Review
👤 Lead: performance-analyst

🟠 Finding: Inefficient Database Query
   File: src/auth/authController.js:67
   Category: Performance

🟡 Finding: Synchronous Password Hashing
   File: src/models/User.js:78
   Category: Performance

🔍 Starting: Style Check
👤 Lead: style-analyst

🟢 Finding: Inconsistent Naming Convention
   File: src/auth/authController.js:multiple
   Category: Style

🟢 Finding: Missing JSDoc Comments
   File: src/middleware/authentication.js:multiple
   Category: Documentation

🔍 Starting: Architecture Assessment  
👤 Lead: architecture-analyst

🟡 Finding: Tight Coupling Between Modules
   File: src/auth/authController.js:imports
   Category: Architecture

✅ Consensus reached on: Error Handling Strategy
   Decision: Implement centralized error handling middleware
   Reviewers: review-coordinator, architecture-analyst, security-analyst

📊 Quality Score: 78/100
   Breakdown:
     Security: 65/100
     Performance: 74/100
     Style: 88/100
     Architecture: 82/100
     Documentation: 71/100

✅ Review completed in 127.5s

📊 Review Summary
=================
🎯 Overall Quality Score: 78/100

📋 Category Scores:
  🟠 Security: 65/100
  🟡 Performance: 74/100
  🟢 Style: 88/100
  🟢 Architecture: 82/100
  🟡 Documentation: 71/100

🔍 Findings Summary:
  Security: 3 issues
    🔴 critical: 1
    🟠 high: 1
    🟡 medium: 1
  Performance: 2 issues
    🟠 high: 1
    🟡 medium: 1
  Style: 2 issues
    🟢 low: 2
  Architecture: 1 issues
    🟡 medium: 1

💡 Top Recommendations:
  1. Implement Environment-Based Configuration
     Impact: 8/10, Effort: 2/10
  2. Add Rate Limiting Middleware
     Impact: 7/10, Effort: 3/10
  3. Centralize Error Handling
     Impact: 6/10, Effort: 4/10
  4. Optimize Database Queries
     Impact: 7/10, Effort: 5/10
  5. Improve Password Validation
     Impact: 6/10, Effort: 2/10

📁 Files Reviewed:
  🟠 src/auth/authController.js (72/100)
  🟡 src/middleware/authentication.js (81/100)
  🟢 src/models/User.js (85/100)
  🟢 src/routes/auth.js (87/100)
  🟢 tests/auth.test.js (92/100)

📄 Generating Review Reports
============================
✅ Generated: code-review-report.md
✅ Generated: code-review-report.json
✅ Published to GitHub PR

👨‍💻 Developer Summary
===================
🎯 Focus Areas:
  1. Implement Environment-Based Configuration (ROI: 6.0)
  2. Add Rate Limiting Middleware (ROI: 4.0)
  3. Optimize Database Queries (ROI: 2.0)

⚡ Quick Wins:
  1. Implement Environment-Based Configuration
  2. Improve Password Validation
  3. Add JSDoc Comments

🚨 Must Fix:
  1. JWT Secret Hardcoded (src/auth/authController.js)

🎉 Code review process completed successfully!
```

## Generated Review Report

The system generates comprehensive reports like:

### `code-review-report.md`
```markdown
# Code Review Report

## Overall Assessment
- **Quality Score**: 78/100
- **Review Date**: 2024-01-15
- **Reviewer Team**: review-coordinator, security-analyst, performance-analyst, style-analyst, architecture-analyst

## Critical Issues

### JWT Secret Hardcoded
- **File**: src/auth/authController.js:23
- **Category**: Security
- **Description**: JWT secret is hardcoded in the source code, making it vulnerable to exposure
- **Recommendation**: Move JWT secret to environment variables and implement proper secret management

## Recommendations

1. **Implement Environment-Based Configuration**
   - Impact: 8/10
   - Effort: 2/10
   - Description: Migrate all configuration values to environment variables for better security and deployment flexibility

[... continued with full report]
```

## Key Features

1. **Multi-Specialist Review**: Different agents focus on specific aspects
2. **Collaborative Analysis**: Agents work together and reach consensus
3. **Comprehensive Coverage**: Security, performance, style, architecture
4. **Actionable Recommendations**: Prioritized by impact and effort
5. **Multiple Output Formats**: Markdown, JSON, GitHub integration
6. **Quality Scoring**: Quantitative assessment with breakdowns

This example demonstrates how Codex-Flow can automate complex, multi-faceted code reviews that rival human expert analysis while providing consistent, thorough, and actionable feedback.