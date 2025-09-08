/**
 * Task Analyzer - OpenAI-Powered Task Analysis & Classification
 * 
 * This module uses OpenAI as the central intelligence to analyze incoming tasks
 * and make strategic decisions about optimal AI provider selection and execution strategy.
 */

import OpenAI from 'openai';
import { TaskRequest } from '../adapters/universal/base-adapter.js';

export interface TaskAnalysis {
  complexity: 'simple' | 'medium' | 'complex' | 'enterprise';
  domains: string[];
  primarySkills: string[];
  secondarySkills: string[];
  estimatedDuration: number; // in milliseconds
  resourceRequirements: {
    memory: 'low' | 'medium' | 'high';
    compute: 'low' | 'medium' | 'high';
    specialization: string[];
  };
  riskFactors: string[];
  successPredictors: string[];
  qualityRequirements: {
    accuracy: number; // 0-1
    creativity: number; // 0-1
    consistency: number; // 0-1
    performance: number; // 0-1
  };
}

export interface ProviderRecommendation {
  provider: 'claude' | 'gemini' | 'openai';
  confidence: number; // 0-1
  reasoning: string;
  expectedPerformance: {
    quality: number; // 0-1
    speed: number; // 0-1  
    cost: number; // relative cost factor
  };
  alternatives: Array<{
    provider: 'claude' | 'gemini' | 'openai';
    confidence: number;
    tradeoffs: string;
  }>;
}

export interface ExecutionStrategy {
  approach: 'single-provider' | 'multi-provider' | 'sequential' | 'parallel' | 'hierarchical';
  phases: Array<{
    name: string;
    provider: 'claude' | 'gemini' | 'openai' | 'hybrid';
    description: string;
    dependencies: string[];
    estimatedDuration: number;
  }>;
  coordination: {
    type: 'queen-led' | 'democratic' | 'byzantine' | 'consensus';
    faultTolerance: number;
    validationStrategy: 'single' | 'majority' | 'unanimous';
  };
  fallbackStrategy: {
    triggers: string[];
    fallbackProvider: 'claude' | 'gemini' | 'openai';
    escalationPath: string[];
  };
}

/**
 * OpenAI-powered task analysis engine
 */
export class TaskAnalyzer {
  private openai: OpenAI;
  private analysisCache: Map<string, TaskAnalysis> = new Map();
  private recommendationCache: Map<string, ProviderRecommendation[]> = new Map();

  constructor(config: { apiKey: string; model?: string }) {
    this.openai = new OpenAI({
      apiKey: config.apiKey,
    });
  }

  /**
   * Analyze a task and determine its complexity, requirements, and characteristics
   */
  async analyzeTask(request: TaskRequest): Promise<TaskAnalysis> {
    const cacheKey = this.getCacheKey(request);
    
    if (this.analysisCache.has(cacheKey)) {
      return this.analysisCache.get(cacheKey)!;
    }

    try {
      const prompt = this.buildAnalysisPrompt(request);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are the central intelligence of Codex-Flow, an advanced AI orchestration system. 
                     Your role is to analyze tasks and provide strategic recommendations for optimal AI provider selection.
                     
                     Available AI Providers:
                     - Claude: Excellent for code generation, documentation, testing, architecture, complex reasoning
                     - Gemini: Superior for research, analysis, optimization, multi-modal processing, coordination
                     - OpenAI: Strong general capability, good for creative tasks, explanation, and orchestration
                     
                     Analyze the given task comprehensively and provide structured analysis in valid JSON format.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3, // Lower temperature for consistent analysis
        max_tokens: 2000,
        response_format: { type: 'json_object' }
      });

      const analysisText = response.choices[0].message.content;
      if (!analysisText) {
        throw new Error('No analysis received from OpenAI');
      }

      const analysis = JSON.parse(analysisText) as TaskAnalysis;
      
      // Validate and normalize the analysis
      const normalizedAnalysis = this.normalizeAnalysis(analysis);
      
      // Cache the result
      this.analysisCache.set(cacheKey, normalizedAnalysis);
      
      return normalizedAnalysis;
    } catch (error) {
      console.error('Task analysis failed:', error);
      // Return fallback analysis
      return this.createFallbackAnalysis(request);
    }
  }

  /**
   * Get provider recommendations based on task analysis
   */
  async getProviderRecommendations(
    analysis: TaskAnalysis, 
    request: TaskRequest
  ): Promise<ProviderRecommendation[]> {
    const cacheKey = `${this.getCacheKey(request)}_recommendations`;
    
    if (this.recommendationCache.has(cacheKey)) {
      return this.recommendationCache.get(cacheKey)!;
    }

    try {
      const prompt = this.buildRecommendationPrompt(analysis, request);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are the strategic decision-maker for Codex-Flow AI orchestration.
                     Based on task analysis, recommend the optimal AI provider(s) and explain your reasoning.
                     
                     Provider Strengths:
                     - Claude: Code generation (95%), Documentation (90%), Testing (88%), Architecture (85%)
                     - Gemini: Research (95%), Analysis (92%), Optimization (88%), Multi-modal (90%)  
                     - OpenAI: General reasoning (85%), Creative tasks (88%), Explanation (90%)
                     
                     Consider performance, cost, quality, and task-specific requirements.
                     Provide recommendations in valid JSON format.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 1500,
        response_format: { type: 'json_object' }
      });

      const recommendationsText = response.choices[0].message.content;
      if (!recommendationsText) {
        throw new Error('No recommendations received from OpenAI');
      }

      const parsed = JSON.parse(recommendationsText);
      const recommendations = parsed.recommendations as ProviderRecommendation[];
      
      // Validate and normalize recommendations
      const normalizedRecommendations = recommendations.map(rec => 
        this.normalizeRecommendation(rec)
      );
      
      // Cache the result
      this.recommendationCache.set(cacheKey, normalizedRecommendations);
      
      return normalizedRecommendations;
    } catch (error) {
      console.error('Provider recommendation failed:', error);
      // Return fallback recommendations
      return this.createFallbackRecommendations(analysis, request);
    }
  }

  /**
   * Generate execution strategy for the task
   */
  async generateExecutionStrategy(
    analysis: TaskAnalysis,
    recommendations: ProviderRecommendation[],
    request: TaskRequest
  ): Promise<ExecutionStrategy> {
    try {
      const prompt = this.buildStrategyPrompt(analysis, recommendations, request);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are the execution strategist for Codex-Flow AI orchestration.
                     Design optimal execution strategies that leverage multiple AI providers effectively.
                     
                     Strategy Types:
                     - single-provider: Use one AI for simple, specialized tasks
                     - multi-provider: Use different AIs for different aspects simultaneously
                     - sequential: Chain AIs in sequence (research → design → implement → test)
                     - parallel: Multiple AIs work on same task for validation
                     - hierarchical: Queen AI coordinates worker AIs
                     
                     Design for maximum quality, efficiency, and fault tolerance.
                     Provide strategy in valid JSON format.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.25,
        max_tokens: 2000,
        response_format: { type: 'json_object' }
      });

      const strategyText = response.choices[0].message.content;
      if (!strategyText) {
        throw new Error('No strategy received from OpenAI');
      }

      const strategy = JSON.parse(strategyText) as ExecutionStrategy;
      
      return this.normalizeStrategy(strategy);
    } catch (error) {
      console.error('Strategy generation failed:', error);
      return this.createFallbackStrategy(analysis, recommendations);
    }
  }

  /**
   * Comprehensive task assessment combining all analysis components
   */
  async assessTask(request: TaskRequest): Promise<{
    analysis: TaskAnalysis;
    recommendations: ProviderRecommendation[];
    strategy: ExecutionStrategy;
    confidence: number;
    reasoning: string;
  }> {
    try {
      // Run analysis
      const analysis = await this.analyzeTask(request);
      
      // Get provider recommendations
      const recommendations = await this.getProviderRecommendations(analysis, request);
      
      // Generate execution strategy
      const strategy = await this.generateExecutionStrategy(analysis, recommendations, request);
      
      // Calculate overall confidence
      const confidence = this.calculateOverallConfidence(analysis, recommendations, strategy);
      
      // Generate executive summary
      const reasoning = this.generateExecutiveSummary(analysis, recommendations, strategy);
      
      return {
        analysis,
        recommendations,
        strategy,
        confidence,
        reasoning
      };
    } catch (error) {
      console.error('Task assessment failed:', error);
      throw error;
    }
  }

  // Private helper methods

  private buildAnalysisPrompt(request: TaskRequest): string {
    return `
Analyze the following task comprehensively:

**Task Details:**
- ID: ${request.id}
- Type: ${request.type}
- Description: ${request.description}
- Context: ${request.context || 'None provided'}
- Requirements: ${JSON.stringify(request.requirements || {}, null, 2)}
- Constraints: ${JSON.stringify(request.constraints || {}, null, 2)}

**Analysis Required:**
Provide a comprehensive analysis in the following JSON structure:

{
  "complexity": "simple|medium|complex|enterprise",
  "domains": ["array", "of", "relevant", "domains"],
  "primarySkills": ["most", "important", "skills", "needed"],
  "secondarySkills": ["supporting", "skills", "needed"],
  "estimatedDuration": milliseconds_estimate,
  "resourceRequirements": {
    "memory": "low|medium|high",
    "compute": "low|medium|high", 
    "specialization": ["specific", "expert", "knowledge", "needed"]
  },
  "riskFactors": ["potential", "challenges", "or", "failure", "points"],
  "successPredictors": ["factors", "that", "indicate", "likely", "success"],
  "qualityRequirements": {
    "accuracy": 0.8,
    "creativity": 0.6,
    "consistency": 0.9,
    "performance": 0.7
  }
}

Consider the task's technical complexity, domain expertise required, creative elements, and quality standards needed.
`;
  }

  private buildRecommendationPrompt(analysis: TaskAnalysis, request: TaskRequest): string {
    return `
Based on this task analysis, recommend the optimal AI provider(s):

**Task Analysis:**
${JSON.stringify(analysis, null, 2)}

**Original Task:**
- Type: ${request.type}
- Description: ${request.description}
- Requirements: ${JSON.stringify(request.requirements || {}, null, 2)}

**Provider Capabilities:**
- **Claude**: Code generation (95%), Documentation (90%), Testing (88%), Architecture (85%), Reasoning (88%)
- **Gemini**: Research (95%), Analysis (92%), Optimization (88%), Multi-modal (90%), Coordination (85%)
- **OpenAI**: General reasoning (85%), Creative tasks (88%), Explanation (90%), Orchestration (92%)

Provide recommendations in this JSON structure:

{
  "recommendations": [
    {
      "provider": "claude|gemini|openai",
      "confidence": 0.85,
      "reasoning": "detailed explanation of why this provider is recommended",
      "expectedPerformance": {
        "quality": 0.9,
        "speed": 0.8,
        "cost": 0.7
      },
      "alternatives": [
        {
          "provider": "alternative_provider",
          "confidence": 0.7,
          "tradeoffs": "explanation of tradeoffs vs primary recommendation"
        }
      ]
    }
  ]
}

Rank providers by suitability and explain the reasoning for each recommendation.
`;
  }

  private buildStrategyPrompt(
    analysis: TaskAnalysis, 
    recommendations: ProviderRecommendation[], 
    request: TaskRequest
  ): string {
    return `
Design an optimal execution strategy for this task:

**Task Analysis:**
${JSON.stringify(analysis, null, 2)}

**Provider Recommendations:**
${JSON.stringify(recommendations, null, 2)}

**Task Requirements:**
- Type: ${request.type}
- Description: ${request.description}
- Quality Target: ${request.requirements?.quality || 'production'}
- Speed Priority: ${request.requirements?.speed || 'balanced'}

Design an execution strategy in this JSON structure:

{
  "approach": "single-provider|multi-provider|sequential|parallel|hierarchical",
  "phases": [
    {
      "name": "phase_name",
      "provider": "claude|gemini|openai|hybrid",
      "description": "what happens in this phase", 
      "dependencies": ["previous", "phases"],
      "estimatedDuration": milliseconds
    }
  ],
  "coordination": {
    "type": "queen-led|democratic|byzantine|consensus",
    "faultTolerance": 0.33,
    "validationStrategy": "single|majority|unanimous"
  },
  "fallbackStrategy": {
    "triggers": ["conditions", "that", "trigger", "fallback"],
    "fallbackProvider": "backup_provider",
    "escalationPath": ["escalation", "steps"]
  }
}

Optimize for the task's complexity, quality requirements, and available provider strengths.
Consider fault tolerance, validation needs, and cost efficiency.
`;
  }

  private getCacheKey(request: TaskRequest): string {
    return `${request.type}_${request.description}_${JSON.stringify(request.requirements || {})}_${JSON.stringify(request.constraints || {})}`;
  }

  private normalizeAnalysis(analysis: TaskAnalysis): TaskAnalysis {
    return {
      complexity: analysis.complexity || 'medium',
      domains: analysis.domains || [],
      primarySkills: analysis.primarySkills || [],
      secondarySkills: analysis.secondarySkills || [],
      estimatedDuration: Math.max(1000, analysis.estimatedDuration || 30000),
      resourceRequirements: {
        memory: analysis.resourceRequirements?.memory || 'medium',
        compute: analysis.resourceRequirements?.compute || 'medium',
        specialization: analysis.resourceRequirements?.specialization || []
      },
      riskFactors: analysis.riskFactors || [],
      successPredictors: analysis.successPredictors || [],
      qualityRequirements: {
        accuracy: Math.max(0, Math.min(1, analysis.qualityRequirements?.accuracy || 0.8)),
        creativity: Math.max(0, Math.min(1, analysis.qualityRequirements?.creativity || 0.5)),
        consistency: Math.max(0, Math.min(1, analysis.qualityRequirements?.consistency || 0.8)),
        performance: Math.max(0, Math.min(1, analysis.qualityRequirements?.performance || 0.7))
      }
    };
  }

  private normalizeRecommendation(rec: ProviderRecommendation): ProviderRecommendation {
    return {
      provider: rec.provider || 'claude',
      confidence: Math.max(0, Math.min(1, rec.confidence || 0.5)),
      reasoning: rec.reasoning || 'No reasoning provided',
      expectedPerformance: {
        quality: Math.max(0, Math.min(1, rec.expectedPerformance?.quality || 0.7)),
        speed: Math.max(0, Math.min(1, rec.expectedPerformance?.speed || 0.7)),
        cost: Math.max(0.1, rec.expectedPerformance?.cost || 1.0)
      },
      alternatives: rec.alternatives || []
    };
  }

  private normalizeStrategy(strategy: ExecutionStrategy): ExecutionStrategy {
    return {
      approach: strategy.approach || 'single-provider',
      phases: strategy.phases || [{
        name: 'execution',
        provider: 'claude',
        description: 'Execute the task',
        dependencies: [],
        estimatedDuration: 30000
      }],
      coordination: {
        type: strategy.coordination?.type || 'queen-led',
        faultTolerance: Math.max(0, Math.min(0.33, strategy.coordination?.faultTolerance || 0.1)),
        validationStrategy: strategy.coordination?.validationStrategy || 'single'
      },
      fallbackStrategy: {
        triggers: strategy.fallbackStrategy?.triggers || ['provider_failure', 'quality_threshold'],
        fallbackProvider: strategy.fallbackStrategy?.fallbackProvider || 'openai',
        escalationPath: strategy.fallbackStrategy?.escalationPath || ['retry', 'fallback_provider', 'human_intervention']
      }
    };
  }

  private createFallbackAnalysis(request: TaskRequest): TaskAnalysis {
    return {
      complexity: 'medium',
      domains: [request.type],
      primarySkills: [request.type],
      secondarySkills: ['general-reasoning'],
      estimatedDuration: 30000,
      resourceRequirements: {
        memory: 'medium',
        compute: 'medium',
        specialization: []
      },
      riskFactors: ['analysis_failure'],
      successPredictors: ['clear_requirements'],
      qualityRequirements: {
        accuracy: 0.8,
        creativity: 0.5,
        consistency: 0.8,
        performance: 0.7
      }
    };
  }

  private createFallbackRecommendations(analysis: TaskAnalysis, request: TaskRequest): ProviderRecommendation[] {
    // Simple heuristic-based fallback
    const typeProviderMap = {
      'code': 'claude',
      'research': 'gemini', 
      'analysis': 'gemini',
      'creative': 'openai',
      'coordination': 'openai',
      'hybrid': 'openai'
    } as const;

    const primaryProvider = typeProviderMap[request.type] || 'claude';

    return [{
      provider: primaryProvider,
      confidence: 0.6,
      reasoning: 'Fallback recommendation based on task type heuristics',
      expectedPerformance: {
        quality: 0.7,
        speed: 0.7,
        cost: 1.0
      },
      alternatives: []
    }];
  }

  private createFallbackStrategy(
    analysis: TaskAnalysis, 
    recommendations: ProviderRecommendation[]
  ): ExecutionStrategy {
    const primaryProvider = recommendations[0]?.provider || 'claude';
    
    return {
      approach: 'single-provider',
      phases: [{
        name: 'execution',
        provider: primaryProvider,
        description: 'Execute the task using primary recommended provider',
        dependencies: [],
        estimatedDuration: analysis.estimatedDuration
      }],
      coordination: {
        type: 'queen-led',
        faultTolerance: 0.1,
        validationStrategy: 'single'
      },
      fallbackStrategy: {
        triggers: ['provider_failure'],
        fallbackProvider: 'openai',
        escalationPath: ['retry', 'fallback_provider']
      }
    };
  }

  private calculateOverallConfidence(
    analysis: TaskAnalysis,
    recommendations: ProviderRecommendation[],
    strategy: ExecutionStrategy
  ): number {
    const analysisConfidence = analysis.complexity !== 'enterprise' ? 0.8 : 0.6;
    const recommendationConfidence = recommendations[0]?.confidence || 0.5;
    const strategyConfidence = strategy.approach === 'single-provider' ? 0.8 : 0.7;
    
    return (analysisConfidence + recommendationConfidence + strategyConfidence) / 3;
  }

  private generateExecutiveSummary(
    analysis: TaskAnalysis,
    recommendations: ProviderRecommendation[],
    strategy: ExecutionStrategy
  ): string {
    const primaryProvider = recommendations[0]?.provider || 'claude';
    const complexity = analysis.complexity;
    const approach = strategy.approach;
    
    return `Task Analysis Summary:
- Complexity: ${complexity} (requires ${analysis.primarySkills.join(', ')})
- Recommended Provider: ${primaryProvider} (${(recommendations[0]?.confidence * 100 || 50).toFixed(0)}% confidence)
- Execution Strategy: ${approach} with ${strategy.phases.length} phases
- Estimated Duration: ${Math.round(analysis.estimatedDuration / 1000)}s
- Key Success Factors: ${analysis.successPredictors.slice(0, 3).join(', ')}
- Risk Mitigation: ${strategy.fallbackStrategy.triggers.length} fallback triggers configured`;
  }

  /**
   * Clear analysis cache
   */
  clearCache(): void {
    this.analysisCache.clear();
    this.recommendationCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    analysisEntries: number;
    recommendationEntries: number;
    memoryUsage: string;
  } {
    return {
      analysisEntries: this.analysisCache.size,
      recommendationEntries: this.recommendationCache.size,
      memoryUsage: `${Math.round((this.analysisCache.size + this.recommendationCache.size) * 0.1)}KB`
    };
  }
}

export default TaskAnalyzer;