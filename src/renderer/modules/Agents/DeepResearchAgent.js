/**
 * DeepResearchAgent - 深度研究智能体
 * 专门使用Deep Research MCP Server进行深度研究任务
 * 提供高级研究能力，包括多源信息整合、深度分析和报告生成
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

    // 研究配置
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
   * 执行具体初始化逻辑
   */
  async performInitialization() {
    try {
      // 确保应用已初始化
      if (!this.app) {
        throw new Error('Application reference not available');
      }

      // 获取MCP服务器管理器
      this.mcpServerManager = this.app.chatManager?.mcpServerManager || null;
      if (!this.mcpServerManager) {
        console.warn(
          '⚠️ DeepResearchAgent: MCP Server Manager not available, deep research tools will rely on ChatManager fallback'
        );
      } else {
        // 检查Deep Research服务器连接（非阻塞）
        try {
          await this.verifyDeepResearchConnection();
        } catch (error) {
          console.warn(`⚠️ DeepResearchAgent: Deep Research server verification failed: ${error.message}`);
        }
      }

      // 加载研究配置
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
   * 注册工具映射 - ONLY implemented tools
   */
  registerToolMapping() {
    // 核心深度研究工具 (IMPLEMENTED)
    this.toolMapping.set('deep_research', this.performDeepResearch.bind(this));
    this.toolMapping.set('research_analysis', this.analyzeResearchResults.bind(this));
    this.toolMapping.set('synthesize_information', this.synthesizeInformation.bind(this));
    this.toolMapping.set('generate_research_report', this.generateResearchReport.bind(this));

    console.log(`🔬 DeepResearchAgent: Registered ${this.toolMapping.size} deep research tools`);
  }

  /**
   * 验证Deep Research服务器连接
   */
  async verifyDeepResearchConnection() {
    try {
      // 查找Deep Research服务器
      const deepResearchServer = this.findDeepResearchServer();
      if (!deepResearchServer) {
        throw new Error('Deep Research MCP server not found or not connected');
      }

      // 检查服务器状态
      const isConnected = this.mcpServerManager.activeServers.has(deepResearchServer.id);
      if (!isConnected) {
        throw new Error('Deep Research MCP server is not connected');
      }

      // 检查可用工具
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
   * 查找Deep Research服务器
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
   * 加载研究配置
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
   * 执行深度研究
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

      // 创建研究会话
      const researchSession = this.createResearchSession(researchId, {
        query,
        language,
        maxResults,
        enableCitations,
        enableReferences,
        enableImages,
        startTime: Date.now(),
      });

      // 执行Deep Research MCP工具
      const researchResult = await this.executeDeepResearchTool({
        query,
        language,
        maxResult: maxResults,
        enableCitationImage: enableImages,
        enableReferences,
      });

      // 处理研究结果
      const processedResult = await this.processResearchResult(researchResult, researchSession);

      // 更新研究会话
      researchSession.results = processedResult;
      researchSession.status = 'completed';
      researchSession.endTime = Date.now();

      // 缓存结果
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
   * 执行Deep Research MCP工具
   */
  async executeDeepResearchTool(parameters) {
    try {
      const deepResearchServer = this.findDeepResearchServer();
      if (!deepResearchServer) {
        throw new Error('Deep Research server not available');
      }

      // 执行MCP工具
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
   * 处理研究结果
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

      // 增强结果分析
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
   * 提取来源信息
   */
  extractSources(result) {
    const sources = [];

    // 从不同可能的字段中提取来源
    const possibleSourceFields = ['sources', 'references', 'links', 'urls'];

    for (const field of possibleSourceFields) {
      if (result[field] && Array.isArray(result[field])) {
        sources.push(...result[field]);
      }
    }

    // 从内容中提取URL
    const content = result.content || result.result?.content || JSON.stringify(result);
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;
    const urls = content.match(urlRegex) || [];
    sources.push(...urls.map(url => ({ url, type: 'extracted' })));

    return [...new Set(sources.map(s => (typeof s === 'string' ? s : s.url)))];
  }

  /**
   * 提取引用信息
   */
  extractCitations(result) {
    const citations = [];

    // 从不同可能的字段中提取引用
    const possibleCitationFields = ['citations', 'references', 'bibliography'];

    for (const field of possibleCitationFields) {
      if (result[field] && Array.isArray(result[field])) {
        citations.push(...result[field]);
      }
    }

    return citations;
  }

  /**
   * 提取图片信息
   */
  extractImages(result) {
    const images = [];

    // 从不同可能的字段中提取图片
    const possibleImageFields = ['images', 'figures', 'diagrams'];

    for (const field of possibleImageFields) {
      if (result[field] && Array.isArray(result[field])) {
        images.push(...result[field]);
      }
    }

    return images;
  }

  /**
   * 分析研究内容
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
   * 分析研究结果
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
   * 综合信息
   */
  async synthesizeInformation(parameters, strategy) {
    try {
      const { sources, synthesisType = 'comprehensive', focusAreas = [], outputFormat = 'structured' } = parameters;

      if (!sources || sources.length === 0) {
        throw new Error('Sources are required for synthesis');
      }

      console.log(`🔄 Synthesizing information from ${sources.length} sources`);

      // 执行综合研究
      const synthesisQuery = this.buildSynthesisQuery(sources, focusAreas);
      const synthesisResult = await this.performDeepResearch({
        query: synthesisQuery,
        maxResults: 15,
        enableCitations: true,
        enableReferences: true,
      });

      // 格式化输出
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
   * 生成研究报告
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

      // 生成报告内容
      const reportContent = await this.buildReportContent(researchResult, reportType, format);

      // 添加可视化（如果需要）
      if (includeVisualizations) {
        reportContent.visualizations = await this.generateVisualizations(researchResult);
      }

      // 保存报告
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
   * 创建研究会话
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
   * 缓存研究结果
   */
  cacheResearchResult(researchId, result) {
    this.researchCache.set(researchId, {
      result,
      timestamp: Date.now(),
      ttl: this.researchConfig.cacheTimeout,
    });
  }

  /**
   * 获取缓存的研究结果
   */
  getCachedResearchResult(researchId) {
    const cached = this.researchCache.get(researchId);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.result;
    }
    return null;
  }

  /**
   * 生成研究ID
   */
  generateResearchId() {
    return `research_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 构建综合查询
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
   * 格式化综合输出
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
   * 构建报告内容
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
   * 构建报告章节
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
   * 格式化来源列表
   */
  formatSourcesList(sources) {
    return sources.map((source, index) => `${index + 1}. ${source}`).join('\n');
  }

  /**
   * 格式化引用列表
   */
  formatCitationsList(citations) {
    return citations.map((citation, index) => `${index + 1}. ${citation}`).join('\n');
  }

  /**
   * 保存研究报告
   */
  saveResearchReport(reportContent, format) {
    const reportId = `report_${Date.now()}`;
    const filename = `research_report_${reportId}.${format}`;

    console.log(`📄 Research report saved: ${filename}`);

    return reportId;
  }

  // 辅助方法
  countWords(text) {
    if (!text) return 0;
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  extractKeyTopics(content) {
    if (!content || typeof content !== 'string') return [];
    // 简单的关键词提取
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
    // 简单的情感分析
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
    // 简单的关键洞察提取
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
    // 简单的结论提取
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
    // 可视化生成占位符
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

// 导出智能体
window.DeepResearchAgent = DeepResearchAgent;
