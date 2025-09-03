# Automated Documentation Generation

This example demonstrates how to use Codex-Flow to automatically generate comprehensive documentation from your codebase, including API docs, user guides, and technical specifications.

## Overview

We'll create a documentation generation system that:
- Analyzes existing code and extracts documentation
- Generates API documentation from code annotations
- Creates user guides and tutorials
- Produces technical architecture documents
- Maintains consistency across all documentation
- Updates documentation as code evolves

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                Documentation Pipeline                       │
├─────────────────────────────────────────────────────────────┤
│ Code Analysis │ Content Generation │ Format & Structure    │
├─────────────────────────────────────────────────────────────┤
│          Multi-format Output Generation                     │
├─────────────────────────────────────────────────────────────┤
│ Markdown │ HTML │ PDF │ OpenAPI │ Confluence │ Wiki        │
└─────────────────────────────────────────────────────────────┘
```

## Implementation

### Documentation Swarm Setup

```typescript
import { CodexFlow } from 'codex-flow';

async function createDocumentationSwarm() {
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

  const swarm = await codexFlow.createSwarm({
    name: 'documentation-team',
    topology: 'hierarchical',
    agents: [
      {
        type: 'documentation-coordinator',
        name: 'doc-lead',
        role: 'coordinator',
        capabilities: [
          'documentation-planning',
          'content-organization',
          'quality-control',
          'cross-reference-management'
        ]
      },
      {
        type: 'code-analyst',
        name: 'code-reader',
        role: 'analyzer',
        capabilities: [
          'code-parsing',
          'api-extraction',
          'dependency-analysis',
          'comment-extraction'
        ]
      },
      {
        type: 'api-documenter',
        name: 'api-writer',
        role: 'specialist',
        capabilities: [
          'openapi-generation',
          'endpoint-documentation',
          'schema-documentation',
          'example-generation'
        ]
      },
      {
        type: 'tutorial-writer',
        name: 'guide-writer',
        role: 'specialist',
        capabilities: [
          'tutorial-creation',
          'step-by-step-guides',
          'example-applications',
          'troubleshooting-guides'
        ]
      },
      {
        type: 'technical-writer',
        name: 'tech-writer',
        role: 'specialist',
        capabilities: [
          'architecture-documentation',
          'design-decisions',
          'system-overview',
          'deployment-guides'
        ]
      },
      {
        type: 'content-reviewer',
        name: 'doc-reviewer',
        role: 'quality-assurance',
        capabilities: [
          'documentation-review',
          'consistency-checking',
          'accuracy-validation',
          'style-enforcement'
        ]
      }
    ],
    coordination: {
      workflowMode: 'pipeline',
      qualityGates: true,
      reviewProcess: 'collaborative'
    }
  });

  return { codexFlow, swarm };
}
```

### Documentation Configuration

```typescript
interface DocumentationConfig {
  project: {
    name: string;
    version: string;
    description: string;
    repository: string;
  };
  sources: {
    codeDirectories: string[];
    configFiles: string[];
    existingDocs: string[];
    excludePatterns: string[];
  };
  output: {
    formats: ('markdown' | 'html' | 'pdf' | 'confluence')[];
    structure: 'flat' | 'hierarchical' | 'modular';
    outputDirectory: string;
  };
  content: {
    includeAPI: boolean;
    includeUserGuides: boolean;
    includeTechnicalSpecs: boolean;
    includeArchitecture: boolean;
    includeExamples: boolean;
    includeTroubleshooting: boolean;
  };
  quality: {
    enforceConsistency: boolean;
    validateLinks: boolean;
    checkSpelling: boolean;
    requireExamples: boolean;
  };
}

const documentationConfig: DocumentationConfig = {
  project: {
    name: 'TaskFlow API',
    version: '2.1.0',
    description: 'Advanced task management REST API with real-time features',
    repository: 'https://github.com/company/taskflow-api'
  },
  sources: {
    codeDirectories: ['src/', 'lib/', 'api/'],
    configFiles: ['package.json', 'openapi.yaml', 'docker-compose.yml'],
    existingDocs: ['README.md', 'CHANGELOG.md'],
    excludePatterns: ['node_modules/', '*.test.js', 'build/']
  },
  output: {
    formats: ['markdown', 'html'],
    structure: 'hierarchical',
    outputDirectory: './docs-generated'
  },
  content: {
    includeAPI: true,
    includeUserGuides: true,
    includeTechnicalSpecs: true,
    includeArchitecture: true,
    includeExamples: true,
    includeTroubleshooting: true
  },
  quality: {
    enforceConsistency: true,
    validateLinks: true,
    checkSpelling: true,
    requireExamples: true
  }
};
```

### Documentation Generation Task

```typescript
async function generateDocumentation(
  codexFlow: CodexFlow,
  swarmId: string,
  config: DocumentationConfig
) {
  const task = await codexFlow.executeTask({
    description: "Generate comprehensive project documentation",
    type: 'documentation-generation',
    context: {
      project: config.project,
      analysisScope: config.sources,
      outputRequirements: config.output,
      contentRequirements: config.content
    },
    requirements: [
      // Code Analysis Phase
      "Analyze project structure and identify components",
      "Extract API endpoints, models, and schemas", 
      "Parse existing documentation and comments",
      "Identify dependencies and integrations",
      "Map data flow and system architecture",
      
      // Content Generation Phase
      "Generate comprehensive API documentation",
      "Create user onboarding and getting started guides",
      "Write detailed installation and setup instructions",
      "Develop usage examples and code samples",
      "Document configuration options and environment setup",
      
      // Technical Documentation
      "Create system architecture overview",
      "Document design decisions and rationale",
      "Generate database schema documentation",
      "Create deployment and operations guides",
      "Write troubleshooting and FAQ sections",
      
      // Quality Assurance
      "Ensure consistency across all documentation",
      "Validate all code examples and snippets",
      "Check cross-references and internal links",
      "Review documentation for completeness and accuracy",
      "Generate table of contents and navigation"
    ],
    deliverables: [
      {
        type: 'api-documentation',
        format: ['openapi', 'markdown'],
        includes: ['endpoints', 'schemas', 'examples', 'authentication']
      },
      {
        type: 'user-guides',
        format: ['markdown', 'html'],
        includes: ['getting-started', 'tutorials', 'recipes', 'best-practices']
      },
      {
        type: 'technical-specs',
        format: ['markdown'],
        includes: ['architecture', 'database', 'deployment', 'security']
      },
      {
        type: 'developer-docs',
        format: ['markdown'],
        includes: ['contributing', 'api-reference', 'sdk-docs', 'changelog']
      }
    ],
    swarm: swarmId,
    parallel: true,
    timeout: 1200000, // 20 minutes
    trackProgress: true,
    quality: config.quality
  });

  return task;
}
```

### Progress Monitoring

```typescript
function setupDocumentationMonitoring(codexFlow: CodexFlow) {
  const progress = {
    phases: [
      'Project Analysis',
      'Code Scanning',
      'API Documentation',
      'User Guide Creation', 
      'Technical Specifications',
      'Content Review',
      'Format Generation',
      'Quality Validation'
    ],
    currentPhase: 0,
    documentsGenerated: [],
    qualityChecks: []
  };

  codexFlow.on('documentation:analysis:started', (data) => {
    console.log(`\n🔍 Analyzing: ${data.component}`);
    console.log(`📁 Files: ${data.fileCount}`);
    console.log(`🧩 Components: ${data.componentCount}`);
  });

  codexFlow.on('documentation:content:generated', (data) => {
    console.log(`📝 Generated: ${data.documentType} - ${data.title}`);
    console.log(`   Words: ${data.wordCount}, Sections: ${data.sectionCount}`);
    progress.documentsGenerated.push(data);
  });

  codexFlow.on('documentation:example:created', (data) => {
    console.log(`💡 Example: ${data.title} (${data.language})`);
    console.log(`   Lines: ${data.lineCount}, Tested: ${data.tested ? '✅' : '⏳'}`);
  });

  codexFlow.on('documentation:quality:check', (data) => {
    const statusEmoji = data.passed ? '✅' : '❌';
    console.log(`${statusEmoji} Quality Check: ${data.checkName}`);
    if (!data.passed) {
      console.log(`   Issues: ${data.issues.join(', ')}`);
    }
    progress.qualityChecks.push(data);
  });

  codexFlow.on('documentation:cross-reference:resolved', (data) => {
    console.log(`🔗 Linked: ${data.sourceDoc} → ${data.targetDoc}`);
  });

  codexFlow.on('documentation:format:generated', (data) => {
    console.log(`📄 Format: ${data.format} - ${data.outputPath}`);
    console.log(`   Size: ${data.sizeKB}KB, Pages: ${data.pages || 'N/A'}`);
  });

  return progress;
}
```

### Complete Documentation Example

```typescript
import { CodexFlow } from 'codex-flow';
import path from 'path';
import fs from 'fs-extra';

async function main() {
  try {
    console.log('📚 Starting Automated Documentation Generation');
    console.log('=============================================');

    // 1. Initialize documentation system
    const { codexFlow, swarm } = await createDocumentationSwarm();
    console.log(`✅ Documentation team ready: ${swarm.agents.length} agents`);

    // 2. Set up monitoring
    const progress = setupDocumentationMonitoring(codexFlow);

    // 3. Execute documentation generation
    console.log('\n📋 Analyzing project and generating documentation...');
    const startTime = Date.now();

    const result = await generateDocumentation(codexFlow, swarm.id, documentationConfig);

    const duration = Date.now() - startTime;
    console.log(`\n✅ Documentation generation completed in ${duration / 1000}s`);

    // 4. Process and organize results
    await organizeDocumentation(result, documentationConfig);

    // 5. Generate final output
    await createDocumentationSite(result, documentationConfig);

    // 6. Display summary
    displayDocumentationSummary(result, progress, duration);

  } catch (error) {
    console.error('❌ Documentation generation failed:', error);
    process.exit(1);
  }
}

async function organizeDocumentation(result: any, config: DocumentationConfig) {
  console.log('\n📁 Organizing Documentation Structure');
  console.log('====================================');

  const outputDir = config.output.outputDirectory;
  await fs.ensureDir(outputDir);

  // Create directory structure
  const directories = [
    'api',
    'guides',
    'technical',
    'examples',
    'assets',
    'schemas'
  ];

  for (const dir of directories) {
    await fs.ensureDir(path.join(outputDir, dir));
    console.log(`📂 Created: ${dir}/`);
  }

  // Organize documents by type
  const documentsByType = groupDocumentsByType(result.documents);

  for (const [type, docs] of Object.entries(documentsByType)) {
    console.log(`\n📋 ${type}:`);
    docs.forEach(doc => {
      console.log(`  ✅ ${doc.title} (${doc.wordCount} words)`);
    });
  }
}

function groupDocumentsByType(documents: any[]) {
  return documents.reduce((groups, doc) => {
    const type = doc.type || 'general';
    groups[type] = groups[type] || [];
    groups[type].push(doc);
    return groups;
  }, {});
}

async function createDocumentationSite(result: any, config: DocumentationConfig) {
  console.log('\n🌐 Creating Documentation Site');
  console.log('==============================');

  // Generate navigation structure
  const navigation = generateNavigationStructure(result.documents);
  console.log('🧭 Generated navigation structure');

  // Create index pages
  await generateIndexPages(result, config);
  console.log('🏠 Generated index pages');

  // Generate search index
  await generateSearchIndex(result.documents);
  console.log('🔍 Generated search index');

  // Create cross-reference links
  const linkMap = generateCrossReferences(result.documents);
  console.log(`🔗 Generated ${Object.keys(linkMap).length} cross-references`);
}

function generateNavigationStructure(documents: any[]) {
  const nav = {
    'Getting Started': [],
    'API Reference': [],
    'User Guides': [],
    'Technical Specifications': [],
    'Examples': [],
    'Troubleshooting': []
  };

  documents.forEach(doc => {
    const category = mapDocumentToCategory(doc.type);
    if (nav[category]) {
      nav[category].push({
        title: doc.title,
        path: doc.outputPath,
        summary: doc.summary
      });
    }
  });

  return nav;
}

function mapDocumentToCategory(docType: string): string {
  const mapping = {
    'getting-started': 'Getting Started',
    'api-reference': 'API Reference',
    'user-guide': 'User Guides',
    'tutorial': 'User Guides',
    'architecture': 'Technical Specifications',
    'deployment': 'Technical Specifications',
    'example': 'Examples',
    'troubleshooting': 'Troubleshooting'
  };
  
  return mapping[docType] || 'Technical Specifications';
}

async function generateIndexPages(result: any, config: DocumentationConfig) {
  // Main index page
  const mainIndex = generateMainIndexContent(result, config);
  console.log('📄 Generated: index.md');

  // Category index pages
  const categories = ['api', 'guides', 'technical', 'examples'];
  for (const category of categories) {
    const categoryDocs = result.documents.filter(d => d.category === category);
    const categoryIndex = generateCategoryIndexContent(category, categoryDocs);
    console.log(`📄 Generated: ${category}/index.md`);
  }
}

function generateMainIndexContent(result: any, config: DocumentationConfig): string {
  return `# ${config.project.name} Documentation

${config.project.description}

## Quick Start

- [Getting Started Guide](guides/getting-started.md)
- [API Reference](api/index.md)
- [Examples](examples/index.md)

## Project Information

- **Version**: ${config.project.version}
- **Repository**: [${config.project.repository}](${config.project.repository})
- **Last Updated**: ${new Date().toISOString().split('T')[0]}

## Documentation Overview

This documentation includes:

${result.documentStats.map(stat => 
  `- **${stat.category}**: ${stat.count} documents`
).join('\n')}

## API Coverage

- **Endpoints**: ${result.apiStats.endpoints} documented
- **Models**: ${result.apiStats.models} schemas
- **Examples**: ${result.apiStats.examples} code samples

## Need Help?

- [Troubleshooting Guide](troubleshooting/index.md)
- [FAQ](troubleshooting/faq.md)
- [Support](mailto:support@company.com)
`;
}

async function generateSearchIndex(documents: any[]) {
  const searchIndex = documents.map(doc => ({
    id: doc.id,
    title: doc.title,
    content: extractSearchableContent(doc.content),
    category: doc.category,
    tags: doc.tags || [],
    path: doc.outputPath
  }));

  // In a real implementation, this would create a search index
  // for tools like Algolia, Elasticsearch, or a client-side search
  console.log(`🔍 Indexed ${searchIndex.length} documents for search`);
  
  return searchIndex;
}

function extractSearchableContent(content: string): string {
  // Remove markdown syntax and extract searchable text
  return content
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/`[^`]*`/g, '') // Remove inline code
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // Extract link text
    .replace(/[#*_]/g, '') // Remove markdown formatting
    .slice(0, 500); // Limit for search index
}

function generateCrossReferences(documents: any[]) {
  const linkMap = new Map();
  
  documents.forEach(doc => {
    // Find references to other documents
    const references = extractReferences(doc.content, documents);
    linkMap.set(doc.id, references);
  });

  return Object.fromEntries(linkMap);
}

function extractReferences(content: string, allDocuments: any[]) {
  const references = [];
  
  // Look for mentions of other document titles or concepts
  allDocuments.forEach(otherDoc => {
    const titleRegex = new RegExp(otherDoc.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    if (content.match(titleRegex) && otherDoc.title !== content) {
      references.push({
        targetId: otherDoc.id,
        targetTitle: otherDoc.title,
        targetPath: otherDoc.outputPath
      });
    }
  });

  return references;
}

function displayDocumentationSummary(result: any, progress: any, duration: number) {
  console.log('\n📊 Documentation Generation Summary');
  console.log('===================================');

  console.log(`⏱️  Total Time: ${(duration / 1000 / 60).toFixed(1)} minutes`);
  console.log(`📄 Documents Generated: ${result.documents.length}`);
  console.log(`📝 Total Word Count: ${result.documents.reduce((sum, doc) => sum + doc.wordCount, 0).toLocaleString()}`);
  console.log(`💡 Code Examples: ${result.examples.length}`);
  
  console.log('\n📋 Content Breakdown:');
  const contentStats = result.documentStats || [];
  contentStats.forEach(stat => {
    console.log(`  ${stat.category}: ${stat.count} documents`);
  });

  console.log('\n🎯 Quality Metrics:');
  const qualityChecks = progress.qualityChecks;
  const passedChecks = qualityChecks.filter(check => check.passed).length;
  console.log(`  Quality Score: ${passedChecks}/${qualityChecks.length} checks passed`);
  
  const failedChecks = qualityChecks.filter(check => !check.passed);
  if (failedChecks.length > 0) {
    console.log('  ⚠️  Issues Found:');
    failedChecks.forEach(check => {
      console.log(`    - ${check.checkName}: ${check.issues.join(', ')}`);
    });
  }

  console.log('\n🔗 Cross-References:');
  console.log(`  Internal Links: ${result.crossReferences?.internal || 0}`);
  console.log(`  External Links: ${result.crossReferences?.external || 0}`);

  console.log('\n📁 Output Formats:');
  result.formats?.forEach(format => {
    console.log(`  ${format.type}: ${format.files} files (${format.totalSize}KB)`);
  });

  console.log('\n🚀 Documentation Ready!');
  console.log(`📂 Location: ${documentationConfig.output.outputDirectory}`);
  console.log('Next steps:');
  console.log('  1. Review generated documentation');
  console.log('  2. Deploy to documentation hosting');
  console.log('  3. Set up automated updates');
  console.log('  4. Configure search functionality');
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
}
```

## Expected Output

```
📚 Starting Automated Documentation Generation
=============================================
✅ Documentation team ready: 6 agents

📋 Analyzing project and generating documentation...

🔍 Analyzing: TaskFlow API Core
📁 Files: 47
🧩 Components: 23

🔍 Analyzing: Authentication System
📁 Files: 12
🧩 Components: 8

📝 Generated: API Reference - Authentication Endpoints
   Words: 2,847, Sections: 12

💡 Example: User Registration Flow (javascript)
   Lines: 23, Tested: ✅

📝 Generated: User Guide - Getting Started
   Words: 1,654, Sections: 8

💡 Example: Basic Task Creation (curl)
   Lines: 8, Tested: ✅

📝 Generated: Technical Spec - System Architecture
   Words: 3,221, Sections: 15

🔗 Linked: API Reference → Authentication Guide
🔗 Linked: User Guide → API Reference

✅ Quality Check: Consistency Check
✅ Quality Check: Link Validation
❌ Quality Check: Spelling Check
   Issues: typo in deployment.md line 45

📄 Format: markdown - docs-generated/api/authentication.md
   Size: 12KB, Pages: N/A

📄 Format: html - docs-generated/html/index.html
   Size: 8KB, Pages: 1

✅ Documentation generation completed in 127.3s

📁 Organizing Documentation Structure
====================================
📂 Created: api/
📂 Created: guides/
📂 Created: technical/
📂 Created: examples/
📂 Created: assets/
📂 Created: schemas/

📋 API Reference:
  ✅ Authentication Endpoints (2,847 words)
  ✅ Task Management API (4,123 words)
  ✅ User Management API (1,967 words)
  ✅ WebSocket Events (1,445 words)

📋 User Guides:
  ✅ Getting Started Guide (1,654 words)
  ✅ Advanced Features Tutorial (2,983 words)
  ✅ Integration Examples (2,156 words)

📋 Technical Specifications:
  ✅ System Architecture (3,221 words)
  ✅ Database Schema (1,789 words)
  ✅ Deployment Guide (2,445 words)
  ✅ Security Overview (1,887 words)

🌐 Creating Documentation Site
==============================
🧭 Generated navigation structure
🏠 Generated index pages
🔍 Generated search index
🔗 Generated 47 cross-references

📄 Generated: index.md
📄 Generated: api/index.md
📄 Generated: guides/index.md
📄 Generated: technical/index.md
📄 Generated: examples/index.md

🔍 Indexed 28 documents for search

📊 Documentation Generation Summary
===================================
⏱️  Total Time: 2.1 minutes
📄 Documents Generated: 28
📝 Total Word Count: 31,247
💡 Code Examples: 45

📋 Content Breakdown:
  API Reference: 8 documents
  User Guides: 6 documents
  Technical Specifications: 9 documents
  Examples: 5 documents

🎯 Quality Metrics:
  Quality Score: 7/8 checks passed
  ⚠️  Issues Found:
    - Spelling Check: typo in deployment.md line 45

🔗 Cross-References:
  Internal Links: 47
  External Links: 12

📁 Output Formats:
  markdown: 28 files (245KB)
  html: 28 files (189KB)

🚀 Documentation Ready!
📂 Location: ./docs-generated
Next steps:
  1. Review generated documentation
  2. Deploy to documentation hosting
  3. Set up automated updates
  4. Configure search functionality
```

## Generated Documentation Structure

```
docs-generated/
├── index.md                    # Main documentation home
├── api/
│   ├── index.md               # API overview
│   ├── authentication.md      # Auth endpoints
│   ├── tasks.md              # Task management
│   ├── users.md              # User management
│   └── websockets.md         # Real-time events
├── guides/
│   ├── index.md              # Guides overview
│   ├── getting-started.md    # Quick start guide
│   ├── advanced-features.md  # Advanced tutorials
│   └── integrations.md       # Integration examples
├── technical/
│   ├── index.md              # Technical overview
│   ├── architecture.md       # System design
│   ├── database.md           # Schema documentation
│   ├── deployment.md         # Deployment guide
│   └── security.md           # Security specifications
├── examples/
│   ├── index.md              # Examples overview
│   ├── javascript/           # JS examples
│   ├── python/               # Python examples
│   └── curl/                 # cURL examples
├── assets/
│   ├── images/               # Diagrams and screenshots
│   └── files/                # Downloadable resources
└── schemas/
    ├── openapi.yaml          # OpenAPI specification
    └── database.sql          # Database schema
```

## Key Features Demonstrated

1. **Comprehensive Analysis**: Deep code analysis with API extraction
2. **Multi-Format Output**: Markdown, HTML, OpenAPI, and more
3. **Quality Assurance**: Automated consistency and accuracy checking
4. **Cross-Referencing**: Intelligent linking between documents
5. **Search Integration**: Full-text search index generation
6. **Template-Based Generation**: Consistent formatting and structure
7. **Examples Integration**: Tested code examples throughout
8. **Navigation Generation**: Automatic site structure and menus

This example shows how Codex-Flow can automate the creation of professional, comprehensive documentation that stays in sync with your codebase and provides an excellent developer experience.