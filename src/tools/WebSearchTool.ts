import { BaseTool, ToolResult } from './BaseTool';
import axios from 'axios';

export class WebSearchTool extends BaseTool {
  constructor() {
    super({
      name: 'web_search',
      description: 'Search the web using various search engines and APIs',
      category: 'web',
      version: '1.0.0',
      parameters: [
        {
          name: 'query',
          type: 'string',
          description: 'The search query',
          required: true
        },
        {
          name: 'engine',
          type: 'string',
          description: 'Search engine to use',
          required: false,
          default: 'duckduckgo',
          enum: ['duckduckgo', 'google', 'bing', 'searx']
        },
        {
          name: 'count',
          type: 'number',
          description: 'Number of results to return',
          required: false,
          default: 10
        },
        {
          name: 'language',
          type: 'string',
          description: 'Language for results',
          required: false,
          default: 'en'
        },
        {
          name: 'safe_search',
          type: 'boolean',
          description: 'Enable safe search',
          required: false,
          default: true
        },
        {
          name: 'time_range',
          type: 'string',
          description: 'Time range for results',
          required: false,
          enum: ['day', 'week', 'month', 'year', 'all']
        }
      ]
    });
  }

  async execute(parameters: Record<string, any>): Promise<ToolResult> {
    const { query, engine, count, language, safe_search, time_range } = parameters;

    try {
      switch (engine) {
        case 'duckduckgo':
          return await this.searchDuckDuckGo(query, count, safe_search);
        
        case 'searx':
          return await this.searchSearx(query, count, language, safe_search);
        
        default:
          return this.error(`Search engine '${engine}' not supported in this implementation`);
      }
    } catch (error: any) {
      return this.error(`Web search failed: ${error.message}`);
    }
  }

  private async searchDuckDuckGo(query: string, count: number, safeSearch: boolean): Promise<ToolResult> {
    try {
      // DuckDuckGo Instant Answer API (limited but free)
      const response = await axios.get('https://api.duckduckgo.com/', {
        params: {
          q: query,
          format: 'json',
          no_html: '1',
          skip_disambig: '1',
          safe_search: safeSearch ? 'strict' : 'off'
        },
        timeout: 10000
      });

      const data = response.data;
      const results: Array<{title: any, snippet: any, url: any, type: string}> = [];

      // Add instant answer if available
      if (data.Answer || data.AbstractText) {
        results.push({
          title: data.Heading || 'Instant Answer',
          snippet: data.Answer || data.AbstractText,
          url: data.AbstractURL || data.AnswerURL,
          type: 'instant_answer'
        });
      }

      // Add related topics
      if (data.RelatedTopics && data.RelatedTopics.length > 0) {
        for (const topic of data.RelatedTopics.slice(0, count - results.length)) {
          if (topic.Text && topic.FirstURL) {
            results.push({
              title: topic.Text.split(' - ')[0] || 'Related Topic',
              snippet: topic.Text,
              url: topic.FirstURL,
              type: 'related_topic'
            });
          }
        }
      }

      // Add definition if available
      if (data.Definition) {
        results.push({
          title: 'Definition',
          snippet: data.Definition,
          url: data.DefinitionURL,
          type: 'definition'
        });
      }

      return this.success({
        query,
        results: results.slice(0, count),
        total: results.length,
        engine: 'duckduckgo'
      }, {
        search_time: new Date().toISOString(),
        safe_search: safeSearch
      });

    } catch (error: any) {
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        return this.error('Unable to connect to DuckDuckGo. Please check your internet connection.');
      }
      return this.error(`DuckDuckGo search failed: ${error.message}`);
    }
  }

  private async searchSearx(query: string, count: number, language: string, safeSearch: boolean): Promise<ToolResult> {
    try {
      // Use a public Searx instance (note: these may be unreliable)
      const searxInstances = [
        'https://searx.org',
        'https://searx.me',
        'https://search.disroot.org'
      ];

      let lastError: any;
      
      for (const instance of searxInstances) {
        try {
          const response = await axios.get(`${instance}/search`, {
            params: {
              q: query,
              format: 'json',
              language: language,
              safesearch: safeSearch ? '2' : '0',
              pageno: '1'
            },
            timeout: 15000,
            headers: {
              'User-Agent': 'Codex-Flow/1.0.0 (Search Tool)'
            }
          });

          const data = response.data;
          const results: Array<{title: any, snippet: any, url: any, engine?: any, category?: any, type: string}> = [];

          if (data.results && Array.isArray(data.results)) {
            for (const result of data.results.slice(0, count)) {
              results.push({
                title: result.title || 'No Title',
                snippet: result.content || result.pretty_url || '',
                url: result.url,
                engine: result.engine,
                category: result.category,
                type: 'web_result'
              });
            }
          }

          // Add instant answers if available
          if (data.answers && Array.isArray(data.answers)) {
            for (const answer of data.answers) {
              results.unshift({
                title: 'Instant Answer',
                snippet: answer.answer,
                url: answer.url,
                type: 'instant_answer'
              });
            }
          }

          return this.success({
            query,
            results: results.slice(0, count),
            total: results.length,
            engine: 'searx',
            instance: instance
          }, {
            search_time: new Date().toISOString(),
            language,
            safe_search: safeSearch
          });

        } catch (error: any) {
          lastError = error;
          continue; // Try next instance
        }
      }

      throw lastError || new Error('All Searx instances failed');

    } catch (error: any) {
      return this.error(`Searx search failed: ${error.message}`);
    }
  }

  // Utility method for URL validation and cleaning
  private cleanUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.toString();
    } catch {
      return url; // Return as-is if invalid
    }
  }

  // Utility method for text cleaning
  private cleanText(text: string): string {
    if (!text) return '';
    
    return text
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&[^;]+;/g, ' ') // Remove HTML entities
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  // Method to search for specific domains
  async searchDomain(domain: string, query: string, count: number = 10): Promise<ToolResult> {
    const siteQuery = `site:${domain} ${query}`;
    return await this.execute({
      query: siteQuery,
      count,
      engine: 'duckduckgo'
    });
  }

  // Method to search for specific file types
  async searchFileType(fileType: string, query: string, count: number = 10): Promise<ToolResult> {
    const fileQuery = `filetype:${fileType} ${query}`;
    return await this.execute({
      query: fileQuery,
      count,
      engine: 'duckduckgo'
    });
  }

  // Method to get search suggestions
  async getSuggestions(query: string): Promise<ToolResult> {
    try {
      // Use DuckDuckGo autocomplete API
      const response = await axios.get('https://duckduckgo.com/ac/', {
        params: {
          q: query,
          type: 'list'
        },
        timeout: 5000
      });

      const suggestions = response.data;
      
      return this.success({
        query,
        suggestions: Array.isArray(suggestions) ? suggestions.slice(0, 10) : [],
        count: Array.isArray(suggestions) ? Math.min(suggestions.length, 10) : 0
      });

    } catch (error: any) {
      return this.error(`Failed to get search suggestions: ${error.message}`);
    }
  }
}