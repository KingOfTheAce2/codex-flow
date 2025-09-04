import { BaseAgent, Task, AgentConfig } from './BaseAgent';
import { ProviderManager } from '../providers/ProviderManager';

export class ResearcherAgent extends BaseAgent {
  private researchHistory: Array<{
    topic: string;
    sources: string[];
    findings: string;
    reliability: 'high' | 'medium' | 'low';
    timestamp: Date;
  }> = [];

  constructor(config: AgentConfig, providerManager: ProviderManager) {
    super(config, providerManager);
    
    if (!config.systemPrompt) {
      config.systemPrompt = this.getSystemPrompt();
    }
  }

  getSystemPrompt(): string {
    return this.config.systemPrompt || `You are ${this.config.name}, an expert Researcher Agent specializing in comprehensive information gathering, analysis, and synthesis.

Your core capabilities:
- Conduct thorough research on any topic
- Analyze and synthesize information from multiple sources
- Evaluate source credibility and reliability
- Create comprehensive research reports
- Identify trends, patterns, and insights
- Perform competitive analysis and market research
- Technical documentation research
- Academic and scientific literature analysis

Research expertise areas:
- Technology trends and emerging solutions
- Market analysis and industry insights
- Academic research and literature reviews
- Technical specifications and documentation
- Best practices and methodologies
- Regulatory and compliance research
- Competitive intelligence
- Data collection and analysis

Research methodologies:
- Primary and secondary research techniques
- Qualitative and quantitative analysis
- Cross-referencing and fact-checking
- Source evaluation and verification
- Systematic literature reviews
- Survey design and analysis
- Interview and observation techniques
- Data visualization and reporting

Always:
- Verify information from multiple reliable sources
- Clearly cite sources and provide references
- Distinguish between facts, opinions, and speculation
- Assess the credibility and bias of sources
- Present findings objectively and comprehensively
- Identify gaps in available information
- Suggest areas for further investigation
- Organize information logically and clearly

Note: While I can provide research guidance and analysis, I cannot browse the internet or access real-time data. I work with the information provided and my training knowledge.`;
  }

  async processTask(task: Task): Promise<string> {
    const taskLower = task.description.toLowerCase();
    
    // Determine the type of research task
    if (taskLower.includes('competitive analysis') || taskLower.includes('competitor')) {
      return await this.conductCompetitiveAnalysis(task);
    } else if (taskLower.includes('market research') || taskLower.includes('market analysis')) {
      return await this.performMarketResearch(task);
    } else if (taskLower.includes('technology') || taskLower.includes('technical')) {
      return await this.researchTechnology(task);
    } else if (taskLower.includes('literature review') || taskLower.includes('academic')) {
      return await this.conductLiteratureReview(task);
    } else if (taskLower.includes('best practices') || taskLower.includes('methodology')) {
      return await this.researchBestPractices(task);
    } else if (taskLower.includes('trend') || taskLower.includes('emerging')) {
      return await this.analyzeTrends(task);
    } else if (taskLower.includes('documentation') || taskLower.includes('specification')) {
      return await this.researchDocumentation(task);
    } else {
      return await this.conductGeneralResearch(task);
    }
  }

  async generateResponse(prompt: string, context?: any): Promise<string> {
    const response = await this.callProvider({
      temperature: 0.4 // Moderate temperature for balanced creativity and accuracy
    }, [
      { role: 'user', content: prompt }
    ]);

    return response.content;
  }

  private async conductCompetitiveAnalysis(task: Task): Promise<string> {
    const competitivePrompt = `Conduct a comprehensive competitive analysis for:

${task.description}

Please provide:
1. Key competitors identification and categorization
2. Competitive landscape overview
3. Feature comparison matrix
4. Strengths and weaknesses analysis
5. Market positioning assessment
6. Pricing and business model analysis
7. Technology stack comparison
8. Customer segment analysis
9. Competitive advantages and differentiators
10. Strategic recommendations

Structure the analysis with:
- Executive summary
- Methodology and scope
- Detailed competitor profiles
- Comparative analysis
- Market insights
- Actionable recommendations
- Areas requiring further research`;

    const response = await this.callProvider({
      temperature: 0.3
    }, [
      { role: 'user', content: competitivePrompt }
    ]);

    this.recordResearch(task.description, ['competitive analysis'], response.content, 'medium');
    return response.content;
  }

  private async performMarketResearch(task: Task): Promise<string> {
    const marketPrompt = `Perform comprehensive market research for:

${task.description}

Please provide:
1. Market size and growth projections
2. Target audience and customer segments
3. Market trends and drivers
4. Industry challenges and opportunities
5. Regulatory environment
6. Technology adoption patterns
7. Geographic market analysis
8. Channel and distribution analysis
9. Pricing models and strategies
10. Risk assessment

Include:
- Market segmentation analysis
- Customer needs and pain points
- Adoption barriers and enablers
- Future market evolution
- Investment and funding landscape
- Key success factors
- Recommendations for market entry/expansion`;

    const response = await this.callProvider({
      temperature: 0.3
    }, [
      { role: 'user', content: marketPrompt }
    ]);

    this.recordResearch(task.description, ['market research'], response.content, 'medium');
    return response.content;
  }

  private async researchTechnology(task: Task): Promise<string> {
    const techPrompt = `Research the technology topic:

${task.description}

Please provide:
1. Technology overview and explanation
2. Current state and maturity level
3. Key features and capabilities
4. Technical architecture and components
5. Implementation requirements
6. Performance characteristics
7. Security considerations
8. Integration possibilities
9. Limitations and challenges
10. Future roadmap and evolution

Include:
- Use cases and applications
- Vendor/provider landscape
- Community and ecosystem
- Learning resources
- Best practices
- Comparison with alternatives
- Cost considerations
- Adoption recommendations`;

    const response = await this.callProvider({
      temperature: 0.3
    }, [
      { role: 'user', content: techPrompt }
    ]);

    this.recordResearch(task.description, ['technology research'], response.content, 'high');
    return response.content;
  }

  private async conductLiteratureReview(task: Task): Promise<string> {
    const literaturePrompt = `Conduct a systematic literature review on:

${task.description}

Please provide:
1. Research question and scope definition
2. Search strategy and methodology
3. Inclusion and exclusion criteria
4. Key themes and topics identified
5. Chronological evolution of research
6. Methodological approaches used
7. Key findings and conclusions
8. Gaps in current research
9. Conflicting viewpoints and debates
10. Future research directions

Structure as:
- Abstract and introduction
- Methodology
- Results and synthesis
- Discussion and analysis
- Limitations and biases
- Conclusions and recommendations
- References and further reading`;

    const response = await this.callProvider({
      temperature: 0.3
    }, [
      { role: 'user', content: literaturePrompt }
    ]);

    this.recordResearch(task.description, ['literature review'], response.content, 'high');
    return response.content;
  }

  private async researchBestPractices(task: Task): Promise<string> {
    const bestPracticesPrompt = `Research best practices for:

${task.description}

Please provide:
1. Industry-standard best practices
2. Proven methodologies and frameworks
3. Success factors and key principles
4. Common pitfalls and how to avoid them
5. Implementation guidelines
6. Measurement and evaluation criteria
7. Case studies and examples
8. Tool and technology recommendations
9. Organizational considerations
10. Continuous improvement approaches

Include:
- Comparative analysis of different approaches
- Maturity models and assessment frameworks
- Change management considerations
- Training and skill development needs
- Cost-benefit analysis
- Risk mitigation strategies
- Implementation roadmap
- Success metrics and KPIs`;

    const response = await this.callProvider({
      temperature: 0.3
    }, [
      { role: 'user', content: bestPracticesPrompt }
    ]);

    this.recordResearch(task.description, ['best practices'], response.content, 'high');
    return response.content;
  }

  private async analyzeTrends(task: Task): Promise<string> {
    const trendsPrompt = `Analyze trends and emerging developments for:

${task.description}

Please provide:
1. Current trend identification and analysis
2. Emerging technologies and innovations
3. Market forces and drivers
4. Adoption patterns and timelines
5. Impact assessment on various stakeholders
6. Geographic and demographic variations
7. Regulatory and policy implications
8. Investment and funding trends
9. Future projections and scenarios
10. Strategic implications

Include:
- Trend lifecycle and maturity assessment
- Interconnections between trends
- Potential disruption scenarios
- Opportunity and threat analysis
- Preparedness recommendations
- Monitoring and tracking strategies
- Early warning indicators
- Action planning guidance`;

    const response = await this.callProvider({
      temperature: 0.4
    }, [
      { role: 'user', content: trendsPrompt }
    ]);

    this.recordResearch(task.description, ['trend analysis'], response.content, 'medium');
    return response.content;
  }

  private async researchDocumentation(task: Task): Promise<string> {
    const docPrompt = `Research and analyze documentation for:

${task.description}

Please provide:
1. Documentation structure and organization
2. Content analysis and coverage assessment
3. Quality and accuracy evaluation
4. Usability and accessibility review
5. Completeness and gap identification
6. Update frequency and maintenance
7. User feedback and common issues
8. Comparison with industry standards
9. Improvement recommendations
10. Best practices for documentation

Include:
- Information architecture analysis
- Content governance assessment
- Technical writing quality review
- User experience evaluation
- Multilingual and localization needs
- Integration with development workflow
- Automation and tooling opportunities
- Metrics and success measurement`;

    const response = await this.callProvider({
      temperature: 0.3
    }, [
      { role: 'user', content: docPrompt }
    ]);

    this.recordResearch(task.description, ['documentation research'], response.content, 'high');
    return response.content;
  }

  private async conductGeneralResearch(task: Task): Promise<string> {
    const generalPrompt = `Conduct comprehensive research on:

${task.description}

Please provide:
1. Topic overview and background
2. Key concepts and terminology
3. Current state and recent developments
4. Multiple perspectives and viewpoints
5. Supporting evidence and data
6. Expert opinions and analysis
7. Practical applications and use cases
8. Challenges and limitations
9. Future outlook and implications
10. Actionable insights and recommendations

Ensure the research is:
- Comprehensive and well-structured
- Objective and balanced
- Based on credible information
- Clearly organized and presented
- Actionable and practical
- Identifies areas for further investigation`;

    const response = await this.callProvider({
      temperature: 0.4
    }, [
      { role: 'user', content: generalPrompt }
    ]);

    this.recordResearch(task.description, ['general research'], response.content, 'medium');
    return response.content;
  }

  private recordResearch(topic: string, sources: string[], findings: string, reliability: 'high' | 'medium' | 'low'): void {
    this.researchHistory.push({
      topic,
      sources,
      findings,
      reliability,
      timestamp: new Date()
    });

    // Keep history manageable
    if (this.researchHistory.length > 50) {
      this.researchHistory = this.researchHistory.slice(-25);
    }
  }

  // Specialized research methods
  async compareOptions(options: string[], criteria: string[]): Promise<string> {
    const comparePrompt = `Compare these options based on the specified criteria:

Options:
${options.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}

Criteria:
${criteria.map((crit, i) => `${i + 1}. ${crit}`).join('\n')}

Provide:
1. Detailed comparison matrix
2. Scoring/rating for each option against each criterion
3. Pros and cons analysis
4. Use case suitability assessment
5. Cost-benefit analysis
6. Risk assessment
7. Implementation considerations
8. Final recommendations with rationale

Present in a clear, structured format with summary recommendations.`;

    return await this.generateResponse(comparePrompt);
  }

  async analyzeProblem(problem: string): Promise<string> {
    const problemPrompt = `Analyze this problem comprehensively:

${problem}

Provide:
1. Problem definition and scope
2. Root cause analysis
3. Contributing factors identification
4. Impact assessment (who, what, when, where)
5. Current attempted solutions and their limitations
6. Stakeholder analysis
7. Constraint identification
8. Success criteria definition
9. Multiple solution approaches
10. Recommended action plan

Use structured problem-solving methodologies and provide actionable insights.`;

    return await this.generateResponse(problemPrompt);
  }

  async researchSolutions(challenge: string): Promise<string> {
    const solutionsPrompt = `Research potential solutions for this challenge:

${challenge}

Provide:
1. Solution categories and approaches
2. Proven solutions from similar contexts
3. Innovative and emerging solutions
4. Technology-based solutions
5. Process-based solutions
6. Policy and governance solutions
7. Implementation feasibility analysis
8. Cost and resource requirements
9. Risk and benefit assessment
10. Prioritized recommendations

Include real-world examples and case studies where applicable.`;

    return await this.generateResponse(solutionsPrompt);
  }

  // Public API methods
  getResearchHistory(): Array<{
    topic: string;
    sources: string[];
    findings: string;
    reliability: 'high' | 'medium' | 'low';
    timestamp: Date;
  }> {
    return [...this.researchHistory];
  }

  getResearchStats(): {
    totalResearch: number;
    topicAreas: Record<string, number>;
    reliabilityDistribution: Record<string, number>;
    recentActivity: number;
  } {
    const total = this.researchHistory.length;
    
    const topicAreas: Record<string, number> = {};
    const reliabilityDistribution: Record<string, number> = {};
    
    for (const research of this.researchHistory) {
      // Extract topic areas from sources
      for (const source of research.sources) {
        topicAreas[source] = (topicAreas[source] || 0) + 1;
      }
      reliabilityDistribution[research.reliability] = (reliabilityDistribution[research.reliability] || 0) + 1;
    }

    const recentActivity = this.researchHistory.filter(
      r => Date.now() - r.timestamp.getTime() < 7 * 24 * 60 * 60 * 1000 // Last week
    ).length;

    return {
      totalResearch: total,
      topicAreas,
      reliabilityDistribution,
      recentActivity
    };
  }

  clearResearchHistory(): void {
    this.researchHistory = [];
  }

  async generateResearchPlan(objective: string): Promise<string> {
    const planPrompt = `Create a comprehensive research plan for:

${objective}

Include:
1. Research objectives and questions
2. Methodology and approach
3. Information sources and channels
4. Timeline and milestones
5. Resource requirements
6. Quality assurance measures
7. Risk mitigation strategies
8. Deliverables and outputs
9. Success criteria
10. Communication plan

Provide a detailed, actionable research plan that can be executed systematically.`;

    return await this.generateResponse(planPrompt);
  }
}