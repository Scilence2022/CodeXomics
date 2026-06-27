/**
 * DeepResearchAgent - deep-research agent
 * Specializes in deep-research tasks using the Deep Research MCP server
 * Provides advanced research capabilities, including multi-source information integration, deep analysis, and report generation
 */
class DeepResearchAgent extends AgentBase {
  constructor(multiAgentSystem) {
    super(multiAgentSystem, 'deep-research', [
      'deep_research',
      'research_analysis',
      'information_synthesis',
      'report_generation',
    ]);

    this.app = multiAgentSystem.app;
    this.configManager = multiAgentSystem.configManager;
    this.mcpServerManager = null;
    this.researchCache = new Map();
    this.activeResearchSessions = new Map();

    // Research configuration
    this.researchConfig = {
      maxResults: 10,
      enableCitations: true,
      enableReferences: true,
      enableImages: true,
      defaultLanguage: 'English',
      researchTimeout: 300000, // 5 minutes
      cacheTimeout: 3600000, // 1 hour
    };

    console.log(`🔬 DeepResearchAgent initialized with advanced research capabilities`);
  }

  /**
   * Run the concrete initialization logic
   */
  async performInitialization() {
    try {
      // Ensure the app is initialized
      if (!this.app) {
        throw new Error('Application reference not available');
      }

      // Get the MCP server manager
      this.mcpServerManager = this.app.chatManager?.mcpServerManager || null;
      if (!this.mcpServerManager) {
        console.warn(
          '⚠️ DeepResearchAgent: MCP Server Manager not available, deep research tools will rely on ChatManager fallback'
        );
      } else {
        // Check the Deep Research server connection (non-blocking)
        try {
          await this.verifyDeepResearchConnection();
        } catch (error) {
          console.warn(`⚠️ DeepResearchAgent: Deep Research server verification failed: ${error.message}`);
        }
      }

      // Load the research configuration
      await this.loadResearchConfig();

      console.log(`🔬 DeepResearchAgent: Deep research tools initialized`);
    } catch (error) {
      console.error(`❌ DeepResearchAgent initialization failed:`, error);
      // Don't rethrow - log warning instead to prevent multi-agent system from failing
    }
  }

  /**
   * Perform function execution with ChatManager delegation
   */
  async performExecution(functionName, parameters, context) {
    const chatManager = this.multiAgentSystem.chatManager;

    // Try ChatManager first (authoritative execution path)
    if (chatManager && typeof chatManager.executeToolByName === 'function') {
      try {
        const result = await chatManager.executeToolByName(functionName, parameters, { bypassAgent: true });
        return result;
      } catch (error) {
        console.warn(
          `DeepResearchAgent: ChatManager execution failed for ${functionName}, falling back to local implementation`
        );
      }
    }

    // Fall back to local implementation
    return await this._performLocalExecution(functionName, parameters, context);
  }

  /**
   * Local execution fallback
   */
  async _performLocalExecution(functionName, parameters, context) {
    // Check toolMapping for local implementations
    if (this.toolMapping.has(functionName)) {
      const toolFunction = this.toolMapping.get(functionName);
      return await toolFunction(parameters, context);
    }

    throw new Error(`DeepResearchAgent: Function ${functionName} not implemented locally and ChatManager unavailable`);
  }

  /**
   * Register the tool mappings - ONLY implemented tools
   */
  registerToolMapping() {
    // Core deep-research tools (IMPLEMENTED)
    this.toolMapping.set('deep_research', this.performDeepResearch.bind(this));
    this.toolMapping.set('research_analysis', this.analyzeResearchResults.bind(this));
    this.toolMapping.set('synthesize_information', this.synthesizeInformation.bind(this));
    this.toolMapping.set('generate_research_report', this.generateResearchReport.bind(this));

    console.log(`🔬 DeepResearchAgent: Registered ${this.toolMapping.size} deep research tools`);
  }

  /**
   * Validate the Deep Research server connection
   */
  async verifyDeepResearchConnection() {
    try {
      // Find the Deep Research server
      const deepResearchServer = this.findDeepResearchServer();
      if (!deepResearchServer) {
        throw new Error('Deep Research MCP server not found or not connected');
      }

      // Check the server status
      const isConnected = this.mcpServerManager.activeServers.has(deepResearchServer.id);
      if (!isConnected) {
        throw new Error('Deep Research MCP server is not connected');
      }

      // Check the available tools
      const tools = this.mcpServerManager.serverTools.get(deepResearchServer.id) || [];
      if (tools.length === 0) {
        throw new Error('No tools available from Deep Research MCP server');
      }

      console.log(`✅ Deep Research server verified: ${tools.length} tools available`);
      return true;
    } catch (error) {
      console.error(`❌ Deep Research server verification failed:`, error);
      throw error;
    }
  }

  /**
   * Find the Deep Research server
   */
  findDeepResearchServer() {
    if (!this.mcpServerManager) return null;
    for (const [, server] of this.mcpServerManager.servers) {
      if (
        server.name === 'deep-research' ||
        server.name.includes('deep-research') ||
        server.name.includes('Deep Research')
      ) {
        return server;
      }
    }
    return null;
  }

  /**
   * Load the research configuration
   */
  async loadResearchConfig() {
    try {
      const savedConfig = this.configManager?.get('deepResearchConfig');
      if (savedConfig) {
        this.researchConfig = { ...this.researchConfig, ...savedConfig };
      }

      console.log(`📋 Research configuration loaded:`, this.researchConfig);
    } catch (error) {
      console.warn(`⚠️ Failed to load research config, using defaults:`, error.message);
    }
  }

  /**
   * Run deep research
   */
  async performDeepResearch(parameters, strategy) {
    try {
      const {
        query,
        language = this.researchConfig.defaultLanguage,
        maxResults = this.researchConfig.maxResults,
        enableCitations = this.researchConfig.enableCitations,
        enableReferences = this.researchConfig.enableReferences,
        enableImages = this.researchConfig.enableImages,
        researchId = this.generateResearchId(),
      } = parameters;

      if (!query) {
        throw new Error('Research query is required');
      }

      console.log(`🔬 Starting deep research: "${query}"`);

      // Create a research session
      const researchSession = this.createResearchSession(researchId, {
        query,
        language,
        maxResults,
        enableCitations,
        enableReferences,
        enableImages,
        startTime: Date.now(),
      });

      // Execute the Deep Research MCP tool
      const researchResult = await this.executeDeepResearchTool({
        query,
        language,
        maxResult: maxResults,
        enableCitationImage: enableImages,
        enableReferences,
      });

      // Process the research results
      const processedResult = await this.processResearchResult(researchResult, researchSession);

      // Update the research session
      researchSession.results = processedResult;
      researchSession.status = 'completed';
      researchSession.endTime = Date.now();

      // Cache the results
      this.cacheResearchResult(researchId, processedResult);

      return {
        success: true,
        researchId,
        query,
        result: processedResult,
        session: researchSession,
        metadata: {
          executionTime: researchSession.endTime - researchSession.startTime,
          sources: processedResult.sources?.length || 0,
          citations: processedResult.citations?.length || 0,
        },
      };
    } catch (error) {
      console.error(`❌ Deep research failed:`, error);
      return {
        success: false,
        error: error.message,
        researchId: parameters.researchId,
      };
    }
  }

  /**
   * Execute the Deep Research MCP tool
   */
  async executeDeepResearchTool(parameters) {
    try {
      const deepResearchServer = this.findDeepResearchServer();
      if (!deepResearchServer) {
        throw new Error('Deep Research server not available');
      }

      // Execute the MCP tool
      const result = await this.mcpServerManager.executeToolOnServer(
        deepResearchServer.id,
        'deep-research',
        parameters
      );

      return result;
    } catch (error) {
      console.error(`❌ Deep Research MCP tool execution failed:`, error);
      throw error;
    }
  }

  /**
   * Process the research results
   */
  async processResearchResult(rawResult, researchSession) {
    try {
      const processedResult = {
        query: researchSession.query,
        summary: rawResult.summary || rawResult.result?.summary || 'No summary available',
        content: rawResult.content || rawResult.result?.content || rawResult.result,
        sources: this.extractSources(rawResult),
        citations: this.extractCitations(rawResult),
        images: this.extractImages(rawResult),
        metadata: {
          language: researchSession.language,
          maxResults: researchSession.maxResults,
          processedAt: Date.now(),
          originalResult: rawResult,
        },
      };

      // Enhanced result analysis
      processedResult.analysis = await this.analyzeResearchContent(processedResult);

      return processedResult;
    } catch (error) {
      console.error(`❌ Research result processing failed:`, error);
      return {
        query: researchSession.query,
        summary: 'Research completed but result processing failed',
        content: rawResult,
        error: error.message,
        metadata: {
          processedAt: Date.now(),
          processingError: true,
        },
      };
    }
  }

  /**
   * Extract source information
   */
  extractSources(result) {
    const sources = [];

    // Extract sources from various possible fields
    const possibleSourceFields = ['sources', 'references', 'links', 'urls'];

    for (const field of possibleSourceFields) {
      if (result[field] && Array.isArray(result[field])) {
        sources.push(...result[field]);
      }
    }

    // Extract URLs from the content
    const content = result.content || result.result?.content || JSON.stringify(result);
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;
    const urls = content.match(urlRegex) || [];
    sources.push(...urls.map(url => ({ url, type: 'extracted' })));

    return [...new Set(sources.map(s => (typeof s === 'string' ? s : s.url)))];
  }

  /**
   * Extract citation information
   */
  extractCitations(result) {
    const citations = [];

    // Extract citations from various possible fields
    const possibleCitationFields = ['citations', 'references', 'bibliography'];

    for (const field of possibleCitationFields) {
      if (result[field] && Array.isArray(result[field])) {
        citations.push(...result[field]);
      }
    }

    return citations;
  }

  /**
   * Extract image information
   */
  extractImages(result) {
    const images = [];

    // Extract images from various possible fields
    const possibleImageFields = ['images', 'figures', 'diagrams'];

    for (const field of possibleImageFields) {
      if (result[field] && Array.isArray(result[field])) {
        images.push(...result[field]);
      }
    }

    return images;
  }

  /**
   * Analyze the research content
   */
  async analyzeResearchContent(result) {
    try {
      const analysis = {
        wordCount: this.countWords(result.content),
        sourceCount: result.sources?.length || 0,
        citationCount: result.citations?.length || 0,
        imageCount: result.images?.length || 0,
        keyTopics: this.extractKeyTopics(result.content),
        sentiment: this.analyzeSentiment(result.content),
        complexity: this.assessComplexity(result.content),
        credibility: this.assessCredibility(result.sources),
      };

      return analysis;
    } catch (error) {
      console.error(`❌ Content analysis failed:`, error);
      return {
        error: 'Analysis failed',
        message: error.message,
      };
    }
  }

  /**
   * Analyze the research results
   */
  async analyzeResearchResults(parameters, strategy) {
    try {
      const { researchId, analysisType = 'comprehensive' } = parameters;

      if (!researchId) {
        throw new Error('Research ID is required');
      }

      const researchResult = this.getCachedResearchResult(researchId);
      if (!researchResult) {
        throw new Error('Research result not found');
      }

      let analysis;
      switch (analysisType) {
        case 'comprehensive':
          analysis = await this.performComprehensiveAnalysis(researchResult);
          break;
        case 'basic':
        default:
          analysis = await this.performBasicAnalysis(researchResult);
      }

      return {
        success: true,
        researchId,
        analysisType,
        analysis,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Synthesize information
   */
  async synthesizeInformation(parameters, strategy) {
    try {
      const { sources, synthesisType = 'comprehensive', focusAreas = [], outputFormat = 'structured' } = parameters;

      if (!sources || sources.length === 0) {
        throw new Error('Sources are required for synthesis');
      }

      console.log(`🔄 Synthesizing information from ${sources.length} sources`);

      // Perform the synthesis research
      const synthesisQuery = this.buildSynthesisQuery(sources, focusAreas);
      const synthesisResult = await this.performDeepResearch({
        query: synthesisQuery,
        maxResults: 15,
        enableCitations: true,
        enableReferences: true,
      });

      // Format the output
      const formattedResult = this.formatSynthesisOutput(synthesisResult, outputFormat);

      return {
        success: true,
        synthesisType,
        sources: sources.length,
        result: formattedResult,
        metadata: {
          synthesisQuery,
          outputFormat,
          processedAt: Date.now(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Generate a research report
   */
  async generateResearchReport(parameters, strategy) {
    try {
      const {
        researchId,
        reportType = 'comprehensive',
        format = 'markdown',
        includeVisualizations = true,
      } = parameters;

      if (!researchId) {
        throw new Error('Research ID is required');
      }

      const researchResult = this.getCachedResearchResult(researchId);
      if (!researchResult) {
        throw new Error('Research result not found');
      }

      console.log(`📄 Generating ${reportType} research report`);

      // Generate the report content
      const reportContent = await this.buildReportContent(researchResult, reportType, format);

      // Add visualizations (if needed)
      if (includeVisualizations) {
        reportContent.visualizations = await this.generateVisualizations(researchResult);
      }

      // Save the report
      const reportId = this.saveResearchReport(reportContent, format);

      return {
        success: true,
        reportId,
        reportType,
        format,
        content: reportContent,
        metadata: {
          generatedAt: Date.now(),
          researchId,
          wordCount: this.countWords(reportContent.content),
          sectionCount: reportContent.sections?.length || 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Create a research session
   */
  createResearchSession(researchId, config) {
    const session = {
      id: researchId,
      config,
      status: 'active',
      startTime: Date.now(),
      results: null,
      endTime: null,
    };

    this.activeResearchSessions.set(researchId, session);
    return session;
  }

  /**
   * Cache the research results
   */
  cacheResearchResult(researchId, result) {
    this.researchCache.set(researchId, {
      result,
      timestamp: Date.now(),
      ttl: this.researchConfig.cacheTimeout,
    });
  }

  /**
   * Get cached research results
   */
  getCachedResearchResult(researchId) {
    const cached = this.researchCache.get(researchId);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.result;
    }
    return null;
  }

  /**
   * Generate a research ID
   */
  generateResearchId() {
    return `research_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Build the synthesis query
   */
  buildSynthesisQuery(sources, focusAreas) {
    let query = 'Synthesize and analyze the following information sources: ';

    sources.forEach((source, index) => {
      query += `\n${index + 1}. ${source}`;
    });

    if (focusAreas.length > 0) {
      query += `\n\nFocus on these areas: ${focusAreas.join(', ')}`;
    }

    query += '\n\nProvide a comprehensive synthesis with key insights, patterns, and conclusions.';

    return query;
  }

  /**
   * Format the synthesis output
   */
  formatSynthesisOutput(result, format) {
    switch (format) {
      case 'structured':
        return {
          summary: result.summary,
          keyInsights: this.extractKeyInsights(result.content),
          patterns: this.extractPatterns(result.content),
          conclusions: this.extractConclusions(result.content),
          sources: result.sources,
          citations: result.citations,
        };
      case 'narrative':
        return {
          content: result.content,
          summary: result.summary,
          sources: result.sources,
        };
      default:
        return result;
    }
  }

  /**
   * Build the report content
   */
  async buildReportContent(researchResult, reportType, format) {
    const report = {
      title: `Research Report: ${researchResult.query}`,
      executiveSummary: researchResult.summary,
      content: researchResult.content,
      sections: this.buildReportSections(researchResult, reportType),
      sources: researchResult.sources,
      citations: researchResult.citations,
      metadata: {
        generatedAt: Date.now(),
        reportType,
        format,
        researchQuery: researchResult.query,
      },
    };

    return report;
  }

  /**
   * Build the report sections
   */
  buildReportSections(researchResult, reportType) {
    const sections = [
      {
        title: 'Executive Summary',
        content: researchResult.summary,
        order: 1,
      },
      {
        title: 'Main Findings',
        content: researchResult.content,
        order: 2,
      },
    ];

    if (researchResult.sources && researchResult.sources.length > 0) {
      sections.push({
        title: 'Sources',
        content: this.formatSourcesList(researchResult.sources),
        order: 3,
      });
    }

    if (researchResult.citations && researchResult.citations.length > 0) {
      sections.push({
        title: 'References',
        content: this.formatCitationsList(researchResult.citations),
        order: 4,
      });
    }

    return sections;
  }

  /**
   * Format the source list
   */
  formatSourcesList(sources) {
    return sources.map((source, index) => `${index + 1}. ${source}`).join('\n');
  }

  /**
   * Format the citation list
   */
  formatCitationsList(citations) {
    return citations.map((citation, index) => `${index + 1}. ${citation}`).join('\n');
  }

  /**
   * Save the research report
   */
  saveResearchReport(reportContent, format) {
    const reportId = `report_${Date.now()}`;
    const filename = `research_report_${reportId}.${format}`;

    console.log(`📄 Research report saved: ${filename}`);

    return reportId;
  }

  // Helper methods
  countWords(text) {
    if (!text) return 0;
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  extractKeyTopics(content) {
    if (!content || typeof content !== 'string') return [];
    // Simple keyword extraction
    const words = content.toLowerCase().split(/\s+/);
    const wordFreq = {};
    words.forEach(word => {
      if (word.length > 4) {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      }
    });

    return Object.entries(wordFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  analyzeSentiment(content) {
    if (!content || typeof content !== 'string') return 'neutral';
    // Simple sentiment analysis
    const positiveWords = ['good', 'excellent', 'positive', 'beneficial', 'effective'];
    const negativeWords = ['bad', 'poor', 'negative', 'harmful', 'ineffective'];

    const words = content.toLowerCase().split(/\s+/);
    const positiveCount = words.filter(word => positiveWords.includes(word)).length;
    const negativeCount = words.filter(word => negativeWords.includes(word)).length;

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  assessComplexity(content) {
    if (!content || typeof content !== 'string') return 'low';
    const wordCount = this.countWords(content);
    const sentenceCount = content.split(/[.!?]+/).length;
    const avgWordsPerSentence = wordCount / sentenceCount;

    if (avgWordsPerSentence > 20) return 'high';
    if (avgWordsPerSentence > 15) return 'medium';
    return 'low';
  }

  assessCredibility(sources) {
    if (!sources || sources.length === 0) return 'unknown';

    const credibleDomains = ['edu', 'gov', 'org', 'nature.com', 'science.org'];
    const credibleCount = sources.filter(source => credibleDomains.some(domain => source.includes(domain))).length;

    const credibilityRatio = credibleCount / sources.length;

    if (credibilityRatio > 0.7) return 'high';
    if (credibilityRatio > 0.4) return 'medium';
    return 'low';
  }

  extractKeyInsights(content) {
    if (!content || typeof content !== 'string') return [];
    // Simple key-insight extraction
    const sentences = content.split(/[.!?]+/);
    return sentences
      .filter(sentence => sentence.length > 50)
      .slice(0, 5)
      .map(sentence => sentence.trim());
  }

  extractPatterns(content) {
    return ['Pattern analysis not implemented yet'];
  }

  extractConclusions(content) {
    if (!content || typeof content !== 'string') return [];
    // Simple conclusion extraction
    const sentences = content.split(/[.!?]+/);
    return sentences
      .filter(
        sentence =>
          sentence.toLowerCase().includes('conclusion') ||
          sentence.toLowerCase().includes('therefore') ||
          sentence.toLowerCase().includes('thus')
      )
      .slice(0, 3)
      .map(sentence => sentence.trim());
  }

  async generateVisualizations(researchResult) {
    // Visualization-generation placeholder
    return {
      wordCloud: 'Word cloud visualization',
      topicDistribution: 'Topic distribution chart',
      sourceAnalysis: 'Source credibility analysis',
    };
  }

  async performComprehensiveAnalysis(researchResult) {
    return { success: true, message: 'Comprehensive analysis not fully implemented yet' };
  }

  async performBasicAnalysis(researchResult) {
    return { success: true, message: 'Basic analysis not fully implemented yet' };
  }
}

// Export the agent
window.DeepResearchAgent = DeepResearchAgent;
