/**
 * Memory System for CodeXomics
 * Multi-layer memory architecture for intelligent caching and context management
 */
class MemorySystem {
  constructor(multiAgentSystem) {
    this.multiAgentSystem = multiAgentSystem;

    // Memory layers
    this.shortTermMemory = new ShortTermMemory();
    this.mediumTermMemory = new MediumTermMemory();
    this.longTermMemory = new LongTermMemory();
    this.semanticMemory = new SemanticMemory();

    // Memory management
    this.memoryManager = new MemoryManager(this);
    this.memoryOptimizer = new MemoryOptimizer(this);

    // Context tracking
    this.currentContext = null;
    this.contextHistory = [];
    this.contextPatterns = new Map();

    // Performance tracking
    this.memoryMetrics = {
      cacheHits: 0,
      cacheMisses: 0,
      memoryAccesses: 0,
      contextSwitches: 0,
      optimizationEvents: 0,
    };

    // Event system
    this.eventBus = new EventTarget();

    console.log('🧠 MemorySystem initializing...');
    this.initialize();
  }

  /**
   * Initialize the memory system
   */
  async initialize() {
    try {
      // Initialize memory layers
      await this.shortTermMemory.initialize();
      await this.mediumTermMemory.initialize();
      await this.longTermMemory.initialize();
      await this.semanticMemory.initialize();

      // Initialize management components
      await this.memoryManager.initialize();
      await this.memoryOptimizer.initialize();

      // Setup event handlers
      this.setupEventHandlers();

      // Start background optimization
      this.startBackgroundOptimization();

      // Initialize cache performance monitoring
      this.startCachePerformanceMonitoring();

      console.log('✅ MemorySystem initialized successfully with advanced caching');
    } catch (error) {
      console.error('❌ MemorySystem initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize intelligent recommendation system
   */
  initializeRecommendationSystem() {
    this.recommendationEngine = {
      // User behavior patterns
      userPatterns: new Map(),
      // Success patterns by function
      successPatterns: new Map(),
      // Context recommendations
      contextRecommendations: new Map(),
      // Knowledge-based recommendations
      knowledgeRecommendations: new Map(),
      // Recommendation weights
      weights: {
        behavior: 0.3,
        success: 0.25,
        context: 0.25,
        knowledge: 0.2,
      },
    };

    console.log('🧠 Intelligent Recommendation System initialized');
  }

  /**
   * Generate intelligent recommendations based on current context
   */
  async generateIntelligentRecommendations(functionName, parameters, context = {}) {
    const startTime = performance.now();

    try {
      // Get base recommendations from different sources
      const recommendationPromises = [
        this.getBehaviorBasedRecommendations(functionName, parameters, context),
        this.getSuccessPatternRecommendations(functionName, parameters, context),
        this.getContextBasedRecommendations(functionName, parameters, context),
        this.getKnowledgeBasedRecommendations(functionName, parameters, context),
      ];

      const [behaviorRecs, successRecs, contextRecs, knowledgeRecs] = await Promise.allSettled(recommendationPromises);

      // Combine and weight recommendations
      const allRecommendations = this.combineRecommendations(
        behaviorRecs.status === 'fulfilled' ? behaviorRecs.value : [],
        successRecs.status === 'fulfilled' ? successRecs.value : [],
        contextRecs.status === 'fulfilled' ? contextRecs.value : [],
        knowledgeRecs.status === 'fulfilled' ? knowledgeRecs.value : []
      );

      // Rank and filter recommendations
      const rankedRecommendations = this.rankRecommendations(allRecommendations, context);

      // Generate recommendation explanations
      const enrichedRecommendations = this.enrichRecommendationsWithExplanations(rankedRecommendations);

      const generationTime = performance.now() - startTime;
      console.log(
        `🧠 Generated ${enrichedRecommendations.length} intelligent recommendations in ${generationTime.toFixed(2)}ms`
      );

      return {
        recommendations: enrichedRecommendations,
        generationTime,
        confidence: this.calculateRecommendationConfidence(enrichedRecommendations),
        reasoning: this.generateRecommendationReasoning(enrichedRecommendations),
      };
    } catch (error) {
      console.error('❌ Recommendation generation failed:', error);
      return {
        recommendations: [],
        generationTime: performance.now() - startTime,
        confidence: 0,
        error: error.message,
      };
    }
  }

  /**
   * Get behavior-based recommendations
   */
  async getBehaviorBasedRecommendations(functionName, parameters, context) {
    const userId = this.getCurrentUserId();
    if (!userId) return [];

    const userPattern = this.recommendationEngine.userPatterns.get(userId) || {
      frequentFunctions: new Map(),
      parameterPatterns: new Map(),
      contextPatterns: new Map(),
    };

    const recommendations = [];

    // Recommend frequently used functions
    if (userPattern.frequentFunctions.has(functionName)) {
      const frequencyData = userPattern.frequentFunctions.get(functionName);
      recommendations.push({
        type: 'frequency',
        function: functionName,
        reason: `You've used this function ${frequencyData.count} times`,
        confidence: Math.min(frequencyData.count / 10, 0.9),
        suggestedAction: 'continue_pattern',
        data: { frequency: frequencyData.count, lastUsed: frequencyData.lastUsed },
      });
    }

    // Recommend based on parameter patterns
    if (userPattern.parameterPatterns.has(functionName)) {
      const paramPattern = userPattern.parameterPatterns.get(functionName);
      const commonParams = this.findCommonParameters(paramPattern, parameters);

      if (commonParams.length > 0) {
        recommendations.push({
          type: 'parameter_pattern',
          function: functionName,
          reason: 'Based on your parameter usage patterns',
          confidence: 0.7,
          suggestedAction: 'optimize_parameters',
          data: { suggestedParams: commonParams },
        });
      }
    }

    return recommendations;
  }

  /**
   * Get success pattern recommendations
   */
  async getSuccessPatternRecommendations(functionName, parameters, context) {
    const successPattern = this.recommendationEngine.successPatterns.get(functionName);
    if (!successPattern) return [];

    const recommendations = [];

    // Recommend parameters that historically lead to success
    if (successPattern.successfulParameters) {
      const optimalParams = this.findOptimalParameters(successPattern.successfulParameters, parameters);

      if (optimalParams.length > 0) {
        recommendations.push({
          type: 'success_pattern',
          function: functionName,
          reason: 'Parameters that historically lead to successful outcomes',
          confidence: successPattern.successRate || 0.8,
          suggestedAction: 'apply_optimal_params',
          data: { optimalParams, successRate: successPattern.successRate },
        });
      }
    }

    // Recommend alternative approaches based on success history
    if (successPattern.alternativeApproaches) {
      recommendations.push({
        type: 'alternative_approach',
        function: functionName,
        reason: 'Alternative approaches with high success rates',
        confidence: 0.6,
        suggestedAction: 'consider_alternative',
        data: { alternatives: successPattern.alternativeApproaches },
      });
    }

    return recommendations;
  }

  /**
   * Get context-based recommendations
   */
  async getContextBasedRecommendations(functionName, parameters, context) {
    const recommendations = [];

    // Analyze current context for patterns
    const contextSignature = this.generateContextSignature(context);
    const similarContexts = this.findSimilarContexts(contextSignature);

    if (similarContexts.length > 0) {
      const successfulContext = similarContexts.find(c => c.success);
      if (successfulContext) {
        recommendations.push({
          type: 'context_pattern',
          function: functionName,
          reason: 'Similar contexts have led to successful outcomes',
          confidence: 0.75,
          suggestedAction: 'follow_successful_pattern',
          data: {
            similarContext: successfulContext.context,
            successRate: successfulContext.successRate,
          },
        });
      }
    }

    // Context-specific parameter recommendations
    if (context.userPreferences) {
      const contextOptimizedParams = this.applyContextPreferences(parameters, context.userPreferences);
      if (JSON.stringify(contextOptimizedParams) !== JSON.stringify(parameters)) {
        recommendations.push({
          type: 'context_preference',
          function: functionName,
          reason: 'Optimized for your current context and preferences',
          confidence: 0.8,
          suggestedAction: 'apply_context_optimization',
          data: { optimizedParams: contextOptimizedParams },
        });
      }
    }

    return recommendations;
  }

  /**
   * Get knowledge-based recommendations
   */
  async getKnowledgeBasedRecommendations(functionName, parameters, context) {
    const knowledgeBase = this.longTermMemory.knowledgeBase;
    const recommendations = [];

    // Find relevant knowledge for the function
    for (const [domain, knowledge] of knowledgeBase) {
      if (this.isKnowledgeRelevant(functionName, knowledge)) {
        const relevanceScore = this.calculateKnowledgeRelevance(functionName, knowledge);

        recommendations.push({
          type: 'knowledge_based',
          function: functionName,
          reason: `Relevant knowledge from ${domain} domain`,
          confidence: relevanceScore * 0.8,
          suggestedAction: 'apply_knowledge',
          data: {
            domain,
            knowledge: this.selectRelevantKnowledge(knowledge, parameters),
            relevanceScore,
          },
        });
      }
    }

    return recommendations;
  }

  /**
   * Combine recommendations from different sources with weights
   */
  combineRecommendations(...recommendationArrays) {
    const allRecommendations = [];
    const weights = this.recommendationEngine.weights;

    recommendationArrays.forEach((recs, index) => {
      const sourceTypes = ['behavior', 'success', 'context', 'knowledge'];
      const sourceWeight = weights[sourceTypes[index]] || 0.1;

      recs.forEach(rec => {
        allRecommendations.push({
          ...rec,
          weightedConfidence: rec.confidence * sourceWeight,
        });
      });
    });

    return allRecommendations;
  }

  /**
   * Rank recommendations by confidence and relevance
   */
  rankRecommendations(recommendations, context) {
    return recommendations
      .filter(rec => rec.confidence > 0.3) // Filter low-confidence recommendations
      .sort((a, b) => {
        // Primary sort: weighted confidence
        const confidenceDiff = b.weightedConfidence - a.weightedConfidence;
        if (Math.abs(confidenceDiff) > 0.01) return confidenceDiff;

        // Secondary sort: recency (newer recommendations preferred)
        const aRecency = this.getRecommendationRecency(a);
        const bRecency = this.getRecommendationRecency(b);
        return bRecency - aRecency;
      })
      .slice(0, 10); // Limit to top 10 recommendations
  }

  /**
   * Enrich recommendations with detailed explanations
   */
  enrichRecommendationsWithExplanations(recommendations) {
    return recommendations.map(rec => ({
      ...rec,
      explanation: this.generateRecommendationExplanation(rec),
      benefits: this.getRecommendationBenefits(rec),
      risks: this.getRecommendationRisks(rec),
      implementation: this.getImplementationGuidance(rec),
      estimatedImpact: this.estimateRecommendationImpact(rec),
    }));
  }

  /**
   * Get current user ID
   */
  getCurrentUserId() {
    return this.currentContext?.userId || 'default_user';
  }

  /**
   * Find common parameters from pattern data
   */
  findCommonParameters(paramPattern, currentParams) {
    const commonParams = {};
    const paramCounts = {};

    // Count parameter occurrences
    paramPattern.forEach(pattern => {
      Object.keys(pattern).forEach(key => {
        paramCounts[key] = (paramCounts[key] || 0) + 1;
      });
    });

    // Find parameters that appear frequently and differ from current
    Object.keys(paramCounts).forEach(key => {
      if (paramCounts[key] > paramPattern.length * 0.5) {
        // Appears in >50% of patterns
        if (currentParams[key] === undefined || currentParams[key] !== paramPattern[0][key]) {
          commonParams[key] = paramPattern[0][key];
        }
      }
    });

    return commonParams;
  }

  /**
   * Find optimal parameters from successful executions
   */
  findOptimalParameters(successfulParameters, currentParams) {
    return successfulParameters
      .filter(sp => sp.success && sp.parameters)
      .map(sp => ({
        parameters: sp.parameters,
        successRate: sp.successRate || 0.8,
        usage: sp.usage || 1,
      }))
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 3); // Top 3 successful parameter sets
  }

  /**
   * Generate context signature for comparison
   */
  generateContextSignature(context) {
    const signature = {
      userId: context.userId,
      sessionType: context.sessionType,
      primaryGoal: context.primaryGoal,
      tools: context.tools?.sort() || [],
      agents: context.agents?.sort() || [],
    };

    return JSON.stringify(signature);
  }

  /**
   * Find similar contexts from history
   */
  findSimilarContexts(contextSignature) {
    // This would typically search through historical context data
    // For now, return empty array as placeholder
    return [];
  }

  /**
   * Apply context preferences to parameters
   */
  applyContextPreferences(parameters, preferences) {
    const optimized = { ...parameters };

    Object.keys(preferences).forEach(key => {
      if (optimized[key] === undefined) {
        optimized[key] = preferences[key];
      }
    });

    return optimized;
  }

  /**
   * Check if knowledge is relevant to function
   */
  isKnowledgeRelevant(functionName, knowledge) {
    const functionKeywords = functionName.toLowerCase().split(/[_\s]+/);
    const knowledgeContent = JSON.stringify(knowledge).toLowerCase();

    return functionKeywords.some(keyword => knowledgeContent.includes(keyword));
  }

  /**
   * Calculate knowledge relevance score
   */
  calculateKnowledgeRelevance(functionName, knowledge) {
    // Simplified relevance calculation
    const functionKeywords = functionName.toLowerCase().split(/[_\s]+/);
    const knowledgeContent = JSON.stringify(knowledge).toLowerCase();

    let matchCount = 0;
    functionKeywords.forEach(keyword => {
      if (knowledgeContent.includes(keyword)) {
        matchCount++;
      }
    });

    return matchCount / functionKeywords.length;
  }

  /**
   * Select relevant knowledge for parameters
   */
  selectRelevantKnowledge(knowledge, parameters) {
    return knowledge.filter(
      item => item.relevanceScore > 0.5 && (!parameters.domain || item.domain === parameters.domain)
    );
  }

  /**
   * Generate recommendation explanation
   */
  generateRecommendationExplanation(rec) {
    const explanations = {
      frequency: `Based on your usage pattern, you frequently use ${rec.function}. This recommendation maintains your established workflow.`,
      parameter_pattern: 'Parameter optimization based on your historical usage patterns.',
      success_pattern: 'Recommendations derived from successful executions with similar parameters.',
      context_pattern: 'Based on successful outcomes in similar contexts.',
      context_preference: 'Parameters optimized according to your current context and preferences.',
      knowledge_based: 'Recommendations based on relevant domain knowledge and best practices.',
      alternative_approach: 'Alternative methods that have shown high success rates.',
    };

    return explanations[rec.type] || 'Personalized recommendation based on your usage patterns.';
  }

  /**
   * Get recommendation benefits
   */
  getRecommendationBenefits(rec) {
    const benefits = {
      frequency: ['Maintains workflow consistency', 'Reduces cognitive load'],
      parameter_pattern: ['Optimized parameters', 'Improved performance'],
      success_pattern: ['Higher success probability', 'Proven results'],
      context_pattern: ['Context-appropriate approach', 'Reduced trial and error'],
      context_preference: ['Personalized optimization', 'Better user experience'],
      knowledge_based: ['Best practices integration', 'Reduced errors'],
      alternative_approach: ['Multiple solution options', 'Risk mitigation'],
    };

    return benefits[rec.type] || ['Improved efficiency', 'Better outcomes'];
  }

  /**
   * Get recommendation risks
   */
  getRecommendationRisks(rec) {
    const risks = {
      frequency: ['May miss better approaches', 'Could lead to habits'],
      parameter_pattern: ['May not suit current context', 'Historical bias'],
      success_pattern: ["Past success doesn't guarantee future results", 'Context dependency'],
      context_pattern: ['Context similarity may be superficial', 'False positives'],
      context_preference: ['May not account for current goals', 'Preference conflicts'],
      knowledge_based: ['Knowledge may be outdated', 'Overgeneralization'],
      alternative_approach: ['Implementation complexity', 'Resource requirements'],
    };

    return risks[rec.type] || ['May require adaptation', 'Implementation challenges'];
  }

  /**
   * Get implementation guidance
   */
  getImplementationGuidance(rec) {
    const guidance = {
      continue_pattern: 'Proceed with your current approach, ensuring consistency.',
      optimize_parameters: 'Apply suggested parameter modifications gradually.',
      apply_optimal_params: 'Implement the most successful parameter set first.',
      follow_successful_pattern: 'Adopt the pattern from successful similar contexts.',
      apply_context_optimization: 'Integrate context-specific optimizations.',
      apply_knowledge: 'Incorporate relevant knowledge into your approach.',
      consider_alternative: 'Evaluate alternative approaches before implementation.',
    };

    return guidance[rec.suggestedAction] || 'Review and adapt the recommendation to your specific needs.';
  }

  /**
   * Estimate recommendation impact
   */
  estimateRecommendationImpact(rec) {
    return {
      confidence: rec.confidence,
      expectedImprovement: Math.min(rec.confidence * 0.3, 0.25), // Max 25% improvement
      effort: this.estimateImplementationEffort(rec),
      timeframe: this.estimateImplementationTimeframe(rec),
    };
  }

  /**
   * Get recommendation recency score
   */
  getRecommendationRecency(rec) {
    // Simplified recency calculation based on timestamp
    return rec.data?.timestamp || Date.now();
  }

  /**
   * Calculate recommendation confidence
   */
  calculateRecommendationConfidence(recommendations) {
    if (!recommendations || recommendations.length === 0) return 0;

    const totalConfidence = recommendations.reduce((sum, rec) => sum + rec.confidence, 0);
    return totalConfidence / recommendations.length;
  }

  /**
   * Generate recommendation reasoning summary
   */
  generateRecommendationReasoning(recommendations) {
    const topRecs = recommendations.slice(0, 3);
    const reasoningPoints = [];

    topRecs.forEach(rec => {
      reasoningPoints.push({
        type: rec.type,
        reason: rec.reason,
        confidence: rec.confidence,
      });
    });

    return {
      primaryReasoning: reasoningPoints,
      overallConfidence: this.calculateRecommendationConfidence(recommendations),
      recommendationCount: recommendations.length,
    };
  }

  /**
   * Estimate implementation effort
   */
  estimateImplementationEffort(rec) {
    const effortMap = {
      frequency: 'low',
      parameter_pattern: 'medium',
      success_pattern: 'low',
      context_pattern: 'medium',
      context_preference: 'low',
      knowledge_based: 'high',
      alternative_approach: 'high',
    };

    return effortMap[rec.type] || 'medium';
  }

  /**
   * Estimate implementation timeframe
   */
  estimateImplementationTimeframe(rec) {
    const timeframeMap = {
      frequency: 'immediate',
      parameter_pattern: 'short',
      success_pattern: 'short',
      context_pattern: 'medium',
      context_preference: 'immediate',
      knowledge_based: 'long',
      alternative_approach: 'long',
    };

    return timeframeMap[rec.type] || 'medium';
  }

  /**
   * Start cache performance monitoring
   */
  startCachePerformanceMonitoring() {
    // Monitor cache performance every 30 seconds
    setInterval(async () => {
      const stats = this.getCachePerformanceStats();
      console.log('🧠 [Cache Monitor] Performance Stats:', {
        hitRate: `${(stats.hitRate * 100).toFixed(1)}%`,
        averageResponseTime: `${stats.averageResponseTime.toFixed(2)}ms`,
        totalCacheSize: stats.totalCacheSize,
        memoryUsage: stats.memoryUsage,
      });
    }, 30000);

    // Generate cache performance report every 5 minutes
    setInterval(async () => {
      const report = this.generateCachePerformanceReport();
      console.log('🧠 [Cache Report] Performance Report:', report);
    }, 300000);
  }

  /**
   * Asynchronously search a single memory layer with timeout and error handling
   */
  async searchMemoryLayerAsync(memoryLayer, functionName, parameters, layerName, priority) {
    const timeout = this.getSearchTimeout(layerName);
    const searchPromise = memoryLayer.search(functionName, parameters);

    try {
      const result = await Promise.race([
        searchPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`${layerName} search timeout`)), timeout)),
      ]);

      return result.map(r => ({ ...r, layer: layerName, priority }));
    } catch (error) {
      console.warn(`⚠️ ${layerName} search failed:`, error.message);
      return [];
    }
  }

  /**
   * Get token limit based on current context and system state
   */
  getTokenLimit() {
    // Adaptive token limit based on system performance and user context
    const baseLimit = 4000; // Base token limit
    const performanceMultiplier = this.calculatePerformanceMultiplier();
    const contextComplexity = this.calculateContextComplexity(this.currentContext);

    return Math.floor(baseLimit * performanceMultiplier * (1 - contextComplexity * 0.3));
  }

  /**
   * Optimize results to fit within token limit
   */
  optimizeResultsForTokenLimit(results, tokenLimit) {
    if (!results || results.length === 0) return [];

    // Sort by priority and relevance
    const sortedResults = results.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    const optimizedResults = [];
    let currentTokenCount = 0;

    for (const result of sortedResults) {
      const resultTokenSize = this.estimateResultTokenSize(result);

      if (currentTokenCount + resultTokenSize <= tokenLimit) {
        optimizedResults.push(result);
        currentTokenCount += resultTokenSize;
      } else if (optimizedResults.length === 0) {
        // Ensure at least one result if possible
        optimizedResults.push(this.compressResult(result, tokenLimit));
        break;
      } else {
        break; // Token limit reached
      }
    }

    return optimizedResults;
  }

  /**
   * Update token usage metrics
   */
  updateTokenUsageMetrics(results) {
    const tokenUsage = this.calculateTokenUsage(results);

    this.memoryMetrics.tokenUsage = {
      current: tokenUsage,
      limit: this.getTokenLimit(),
      timestamp: Date.now(),
      efficiency: this.calculateTokenEfficiency(results),
    };
  }

  /**
   * Calculate estimated token usage for results
   */
  calculateTokenUsage(results) {
    return results.reduce((total, result) => {
      return total + this.estimateResultTokenSize(result);
    }, 0);
  }

  /**
   * Calculate compression ratio
   */
  calculateCompressionRatio(originalResults, optimizedResults) {
    if (!originalResults || originalResults.length === 0) return 1.0;

    const originalTokens = this.calculateTokenUsage(originalResults);
    const optimizedTokens = this.calculateTokenUsage(optimizedResults);

    return originalTokens > 0 ? (originalTokens - optimizedTokens) / originalTokens : 0;
  }

  /**
   * Estimate token size for a result
   */
  estimateResultTokenSize(result) {
    // Rough token estimation based on content
    const content = JSON.stringify(result);
    return Math.ceil(content.length / 4); // Approximate 4 characters per token
  }

  /**
   * Compress a result to fit token limit
   */
  compressResult(result, maxTokens) {
    const compressed = { ...result };

    // Remove less important fields to reduce token count
    if (compressed.metadata) {
      delete compressed.metadata;
    }

    if (compressed.fullText && this.estimateResultTokenSize(compressed) > maxTokens) {
      compressed.summary = compressed.fullText.substring(0, maxTokens * 3); // Rough approximation
      delete compressed.fullText;
    }

    return compressed;
  }

  /**
   * Calculate performance multiplier for token limit
   */
  calculatePerformanceMultiplier() {
    const { cacheHitRate } = this.memoryMetrics;

    if (cacheHitRate > 0.8) {
      return 1.2; // High performance allows more tokens
    } else if (cacheHitRate > 0.5) {
      return 1.0; // Normal performance
    } else {
      return 0.8; // Lower performance reduces token limit
    }
  }

  /**
   * Calculate context complexity
   */
  calculateContextComplexity(context) {
    if (!context) return 0;

    const complexityFactors = [
      context.agents?.length || 0,
      context.tools?.length || 0,
      context.sessionDuration || 0,
      Object.keys(context).length,
    ];

    return Math.min(complexityFactors.reduce((a, b) => a + b, 0) / 10, 1);
  }

  /**
   * Get search timeout based on layer
   */
  getSearchTimeout(layerName) {
    const timeouts = {
      short: 50, // 50ms for short-term memory
      medium: 100, // 100ms for medium-term memory
      long: 200, // 200ms for long-term memory
      semantic: 150, // 150ms for semantic memory
    };

    return timeouts[layerName] || 100;
  }

  /**
   * Calculate token efficiency
   */
  calculateTokenEfficiency(results) {
    if (!results || results.length === 0) return 0;

    const relevantResults = results.filter(r => r.relevanceScore > 0.5).length;
    return relevantResults / results.length;
  }

  /**
   * Apply context optimizations asynchronously
   */
  async applyContextOptimizationsAsync(functionName, parameters, memoryContext) {
    try {
      // Simulate async context analysis and optimization
      await new Promise(resolve => setTimeout(resolve, 10)); // Minimal delay for simulation

      const optimized = { ...parameters };

      // Apply context-based optimizations
      if (memoryContext.context?.userPreferences) {
        const preferences = memoryContext.context.userPreferences;
        Object.keys(preferences).forEach(key => {
          if (Object.prototype.hasOwnProperty.call(optimized, key) && typeof preferences[key] === 'object') {
            optimized[key] = { ...optimized[key], ...preferences[key] };
          }
        });
      }

      return optimized;
    } catch (error) {
      console.warn('⚠️ Context optimizations failed:', error);
      return parameters;
    }
  }

  /**
   * Apply historical patterns for optimization
   */
  async applyHistoricalPatterns(functionName, parameters, memoryContext) {
    try {
      // Simulate async historical analysis
      await new Promise(resolve => setTimeout(resolve, 5));

      const optimized = { ...parameters };

      // Apply historical success patterns
      if (memoryContext.results && memoryContext.results.length > 0) {
        const successfulParams = memoryContext.results.filter(r => r.success && r.parameters).map(r => r.parameters);

        if (successfulParams.length > 0) {
          // Merge most common successful parameter patterns
          const commonPatterns = this.findCommonPatterns(successfulParams);
          Object.keys(commonPatterns).forEach(key => {
            if (!optimized[key] || optimized[key] === null) {
              optimized[key] = commonPatterns[key];
            }
          });
        }
      }

      return optimized;
    } catch (error) {
      console.warn('⚠️ Historical pattern application failed:', error);
      return parameters;
    }
  }

  /**
   * Merge optimization results from different sources
   */
  mergeOptimizationResults(...results) {
    const merged = { ...results[0] };

    for (let i = 1; i < results.length; i++) {
      const result = results[i];
      if (result && typeof result === 'object') {
        Object.keys(result).forEach(key => {
          if (result[key] !== null && result[key] !== undefined) {
            // Deep merge for nested objects
            if (typeof result[key] === 'object' && !Array.isArray(result[key])) {
              merged[key] = { ...(merged[key] || {}), ...result[key] };
            } else {
              merged[key] = result[key];
            }
          }
        });
      }
    }

    return merged;
  }

  /**
   * Calculate optimization metrics
   */
  calculateOptimizationMetrics(original, optimized, memoryContext) {
    const originalTokens = this.calculateTokenUsage([{ data: original }]);
    const optimizedTokens = this.calculateTokenUsage([{ data: optimized }]);
    const tokenSavings = originalTokens - optimizedTokens;

    return {
      optimizations: this.getOptimizationSummary(original, optimized),
      confidence: this.calculateOptimizationConfidence(memoryContext),
      tokenSavings: Math.max(0, tokenSavings),
      efficiency: tokenSavings > 0 ? tokenSavings / originalTokens : 0,
    };
  }

  /**
   * Find common patterns in parameter arrays
   */
  findCommonPatterns(paramArrays) {
    const patternCount = {};

    paramArrays.forEach(params => {
      Object.keys(params).forEach(key => {
        const value = params[key];
        const patternKey = `${key}:${typeof value}:${JSON.stringify(value)}`;
        patternCount[patternKey] = (patternCount[patternKey] || 0) + 1;
      });
    });

    // Return patterns that appear in at least 50% of cases
    const commonThreshold = paramArrays.length * 0.5;
    const commonPatterns = {};

    Object.keys(patternCount).forEach(patternKey => {
      if (patternCount[patternKey] >= commonThreshold) {
        const [key, , value] = patternKey.split(':');
        if (key && value) {
          try {
            commonPatterns[key] = JSON.parse(value);
          } catch {
            commonPatterns[key] = value;
          }
        }
      }
    });

    return commonPatterns;
  }

  /**
   * Get optimization summary
   */

  /**
   * Classify the type of parameter change
   */
  classifyChange(original, optimized) {
    if (original === undefined || original === null) return 'added';
    if (optimized === undefined || optimized === null) return 'removed';
    if (JSON.stringify(original) === JSON.stringify(optimized)) return 'unchanged';
    return 'modified';
  }

  /**
   * Record a tool call in memory
   */
  async recordToolCall(functionName, parameters, result, executionTime, agent) {
    const memoryEntry = {
      id: this.generateMemoryId(),
      timestamp: Date.now(),
      functionName,
      parameters,
      result,
      executionTime,
      agent,
      context: this.currentContext,
      success: !result || !result.error,
      memoryType: this.determineMemoryType(functionName, parameters, result),
    };

    // Store in appropriate memory layer
    await this.storeInMemoryLayer(memoryEntry);

    // Update context patterns
    this.updateContextPatterns(memoryEntry);

    // Trigger optimization if needed
    this.memoryOptimizer.analyzeMemoryEntry(memoryEntry);

    console.log(`🧠 Recorded tool call: ${functionName} in ${memoryEntry.memoryType} memory`);

    return memoryEntry.id;
  }

  /**
   * Retrieve memory context for function execution with async optimization
   */
  async retrieveMemoryContext(functionName, parameters, context = {}) {
    const startTime = performance.now();
    const tokenLimit = this.getTokenLimit();

    try {
      // Parallel search across all memory layers for better performance
      const searchPromises = [
        this.searchMemoryLayerAsync(this.shortTermMemory, functionName, parameters, 'short', 1.0),
        this.searchMemoryLayerAsync(this.mediumTermMemory, functionName, parameters, 'medium', 0.8),
        this.searchMemoryLayerAsync(this.longTermMemory, functionName, parameters, 'long', 0.6),
        this.searchMemoryLayerAsync(this.semanticMemory, functionName, parameters, 'semantic', 0.4),
      ];

      // Execute all searches concurrently with token optimization
      const searchResults = await Promise.allSettled(searchPromises);

      // Combine results and handle failures gracefully
      const allResults = [];
      for (const result of searchResults) {
        if (result.status === 'fulfilled' && result.value) {
          allResults.push(...result.value);
        }
      }

      // Token-aware result filtering and compression
      const tokenOptimizedResults = this.optimizeResultsForTokenLimit(allResults, tokenLimit);

      // Rank by relevance and recency
      const rankedResults = this.rankMemoryResults(tokenOptimizedResults, functionName, parameters, context);

      // Update metrics
      this.memoryMetrics.memoryAccesses++;
      this.updateTokenUsageMetrics(tokenOptimizedResults);

      if (rankedResults.length > 0) {
        this.memoryMetrics.cacheHits++;
      } else {
        this.memoryMetrics.cacheMisses++;
      }

      const searchTime = performance.now() - startTime;
      console.log(
        `🧠 Async memory search completed in ${searchTime.toFixed(2)}ms, found ${rankedResults.length} results (tokens: ${this.calculateTokenUsage(rankedResults)})`
      );

      return {
        results: rankedResults,
        searchTime,
        context: this.buildMemoryContext(rankedResults, context),
        tokenUsage: this.calculateTokenUsage(rankedResults),
        tokenLimit: tokenLimit,
        compressionRatio: this.calculateCompressionRatio(allResults, tokenOptimizedResults),
      };
    } catch (error) {
      console.error('❌ Memory context retrieval failed:', error);
      return {
        results: [],
        searchTime: performance.now() - startTime,
        context: context,
        error: error.message,
      };
    }
  }

  /**
   * Optimize parameters with async processing and token efficiency
   */
  async optimizeParameters(functionName, parameters, context = {}) {
    const startTime = performance.now();
    const tokenBudget = this.getTokenLimit() * 0.3; // Reserve 30% of token budget for optimization

    try {
      // Get memory context with token optimization
      const memoryContext = await this.retrieveMemoryContext(functionName, parameters, context);

      // Check if we have enough token budget for optimization
      if (memoryContext.tokenUsage > tokenBudget) {
        console.log('⚠️ Insufficient token budget for parameter optimization');
        return {
          original: parameters,
          optimized: parameters,
          optimizations: [],
          confidence: 0,
          tokenBudgetExceeded: true,
        };
      }

      // Apply parameter optimization rules in parallel where possible
      const optimizationPromises = [
        this.memoryOptimizer.optimizeParameters(functionName, parameters, memoryContext),
        this.applyContextOptimizationsAsync(functionName, parameters, memoryContext),
        this.applyHistoricalPatterns(functionName, parameters, memoryContext),
      ];

      const [optimizerResult, contextResult, patternResult] = await Promise.allSettled(optimizationPromises);

      // Combine results
      const optimizedParams = this.mergeOptimizationResults(
        optimizerResult.status === 'fulfilled' ? optimizerResult.value : parameters,
        contextResult.status === 'fulfilled' ? contextResult.value : parameters,
        patternResult.status === 'fulfilled' ? patternResult.value : parameters
      );

      // Calculate optimization metrics
      const optimizationMetrics = this.calculateOptimizationMetrics(parameters, optimizedParams, memoryContext);

      const optimizationTime = performance.now() - startTime;
      console.log(
        `🧠 Parameter optimization completed in ${optimizationTime.toFixed(2)}ms (tokens: ${memoryContext.tokenUsage})`
      );

      return {
        original: parameters,
        optimized: optimizedParams,
        optimizations: optimizationMetrics.optimizations,
        confidence: optimizationMetrics.confidence,
        tokenUsage: memoryContext.tokenUsage,
        tokenSavings: optimizationMetrics.tokenSavings,
        processingTime: optimizationTime,
      };
    } catch (error) {
      console.error('❌ Parameter optimization failed:', error);
      return {
        original: parameters,
        optimized: parameters,
        optimizations: [],
        confidence: 0,
        error: error.message,
      };
    }
  }

  /**
   * Select optimal execution path based on memory
   */
  async selectExecutionPath(functionName, parameters, availableAgents, context = {}) {
    try {
      // Get memory context
      const memoryContext = await this.retrieveMemoryContext(functionName, parameters, context);

      // Analyze historical performance
      const performanceAnalysis = await this.analyzeHistoricalPerformance(
        functionName,
        parameters,
        availableAgents,
        memoryContext
      );

      // Select optimal agent
      const optimalAgent = this.selectOptimalAgent(performanceAnalysis, availableAgents);

      // Determine execution strategy
      const executionStrategy = await this.determineExecutionStrategy(
        functionName,
        parameters,
        optimalAgent,
        memoryContext
      );

      return {
        agent: optimalAgent,
        strategy: executionStrategy,
        confidence: performanceAnalysis.confidence,
        reasoning: performanceAnalysis.reasoning,
      };
    } catch (error) {
      console.error('❌ Execution path selection failed:', error);
      // Fallback to default selection
      return {
        agent: availableAgents[0],
        strategy: 'default',
        confidence: 0,
        reasoning: 'Fallback due to error',
      };
    }
  }

  /**
   * Update current context
   */
  updateContext(newContext) {
    const previousContext = this.currentContext;
    this.currentContext = {
      ...newContext,
      timestamp: Date.now(),
      sessionId: this.getSessionId(),
    };

    // Record context switch
    if (previousContext && this.hasContextChanged(previousContext, this.currentContext)) {
      this.memoryMetrics.contextSwitches++;
      this.contextHistory.push({
        from: previousContext,
        to: this.currentContext,
        timestamp: Date.now(),
      });

      // Keep only recent context history
      if (this.contextHistory.length > 100) {
        this.contextHistory = this.contextHistory.slice(-100);
      }
    }

    console.log('🧠 Context updated:', this.currentContext);
  }

  /**
   * Get memory statistics
   */
  getMemoryStats() {
    return {
      layers: {
        shortTerm: this.shortTermMemory.getStats(),
        mediumTerm: this.mediumTermMemory.getStats(),
        longTerm: this.longTermMemory.getStats(),
        semantic: this.semanticMemory.getStats(),
      },
      metrics: this.memoryMetrics,
      context: {
        current: this.currentContext,
        historyLength: this.contextHistory.length,
        patternsCount: this.contextPatterns.size,
      },
      optimization: this.memoryOptimizer.getStats(),
    };
  }

  /**
   * Get cache performance statistics
   */
  getCachePerformanceStats() {
    const shortTermStats = this.shortTermMemory.getStats();

    return {
      hitRate: shortTermStats.cacheEfficiency,
      averageResponseTime: shortTermStats.averageResponseTime,
      totalCacheSize: shortTermStats.cacheSize,
      memoryUsage: this.calculateTotalMemoryUsage(),
      cacheHits: shortTermStats.cacheStats.hits,
      cacheMisses: shortTermStats.cacheStats.misses,
      hitToMissRatio:
        shortTermStats.cacheStats.misses > 0 ? shortTermStats.cacheStats.hits / shortTermStats.cacheStats.misses : 0,
    };
  }

  /**
   * Generate comprehensive cache performance report
   */
  generateCachePerformanceReport() {
    const stats = this.getCachePerformanceStats();
    const sessionStats = this.shortTermMemory.getSessionStats();
    const toolPattern = this.shortTermMemory.getToolUsagePattern();

    // Analyze top tools
    const topTools = Array.from(toolPattern.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tool, count]) => ({ tool, count }));

    // Calculate cache efficiency categories
    const efficiencyLevel =
      stats.hitRate > 0.8 ? 'Excellent' : stats.hitRate > 0.6 ? 'Good' : stats.hitRate > 0.4 ? 'Fair' : 'Poor';

    return {
      overall: {
        efficiency: efficiencyLevel,
        hitRate: `${(stats.hitRate * 100).toFixed(1)}%`,
        responseTime: `${stats.averageResponseTime.toFixed(2)}ms`,
      },
      usage: {
        totalCalls: sessionStats.totalCalls,
        uniqueFunctions: sessionStats.uniqueFunctions,
        successRate: `${(sessionStats.successRate * 100).toFixed(1)}%`,
        avgExecutionTime: `${sessionStats.averageExecutionTime.toFixed(2)}ms`,
      },
      topTools,
      cache: {
        currentSize: stats.totalCacheSize,
        memoryUsage: stats.memoryUsage,
        hitToMissRatio: stats.hitToMissRatio.toFixed(2),
      },
      recommendations: this.generateCacheRecommendations(stats, sessionStats),
    };
  }

  /**
   * Generate cache optimization recommendations
   */
  generateCacheRecommendations(stats, sessionStats) {
    const recommendations = [];

    if (stats.hitRate < 0.6) {
      recommendations.push({
        type: 'performance',
        message: 'Low cache hit rate detected. Consider increasing cache size or TTL values.',
        priority: 'high',
      });
    }

    if (stats.averageResponseTime > 100) {
      recommendations.push({
        type: 'performance',
        message: 'High response time detected. Consider optimizing search algorithms.',
        priority: 'medium',
      });
    }

    if (sessionStats.successRate < 0.8) {
      recommendations.push({
        type: 'reliability',
        message: 'Low success rate in cached operations. Review error handling.',
        priority: 'medium',
      });
    }

    if (stats.totalCacheSize > 1000) {
      recommendations.push({
        type: 'optimization',
        message: 'Large cache size detected. Consider implementing more aggressive eviction policies.',
        priority: 'low',
      });
    }

    return recommendations;
  }

  /**
   * Calculate total memory usage across all layers
   */
  calculateTotalMemoryUsage() {
    let totalUsage = 0;

    // Calculate ShortTermMemory usage
    totalUsage += this.shortTermMemory.calculateMemoryUsage();

    // Add usage from other memory layers if they have calculateMemoryUsage methods
    if (this.mediumTermMemory.calculateMemoryUsage) {
      totalUsage += this.mediumTermMemory.calculateMemoryUsage();
    }

    if (this.longTermMemory.calculateMemoryUsage) {
      totalUsage += this.longTermMemory.calculateMemoryUsage();
    }

    if (this.semanticMemory.calculateMemoryUsage) {
      totalUsage += this.semanticMemory.calculateMemoryUsage();
    }

    return totalUsage;
  }

  /**
   * Optimize cache configuration based on usage patterns
   */
  async optimizeCacheConfiguration() {
    try {
      const sessionStats = this.shortTermMemory.getSessionStats();
      const toolPattern = this.shortTermMemory.getToolUsagePattern();

      // Analyze usage patterns
      Array.from(toolPattern.entries())
        .filter(([_, count]) => count > 10)
        .map(([tool]) => tool);

      // Adjust cache size based on usage
      if (sessionStats.totalCalls > 1000) {
        // Increase cache size for high usage
        this.shortTermMemory.maxCacheSize = Math.min(2000, this.shortTermMemory.maxCacheSize * 1.5);
        console.log('🧠 Cache size increased to', this.shortTermMemory.maxCacheSize);
      } else if (sessionStats.totalCalls < 100) {
        // Decrease cache size for low usage
        this.shortTermMemory.maxCacheSize = Math.max(100, this.shortTermMemory.maxCacheSize * 0.8);
        console.log('🧠 Cache size decreased to', this.shortTermMemory.maxCacheSize);
      }

      // Adjust TTL based on success rate
      if (sessionStats.successRate > 0.9) {
        // Increase TTL for high success rate
        this.shortTermMemory.defaultTTL = Math.min(15 * 60 * 1000, this.shortTermMemory.defaultTTL * 1.2);
        console.log('🧠 Cache TTL increased to', this.shortTermMemory.defaultTTL);
      } else if (sessionStats.successRate < 0.7) {
        // Decrease TTL for low success rate
        this.shortTermMemory.defaultTTL = Math.max(2 * 60 * 1000, this.shortTermMemory.defaultTTL * 0.8);
        console.log('🧠 Cache TTL decreased to', this.shortTermMemory.defaultTTL);
      }

      console.log('🧠 Cache optimization completed');
    } catch (error) {
      console.error('❌ Cache optimization failed:', error);
    }
  }

  /**
   * Clear memory layers
   */
  async clearMemory(layer = 'all') {
    try {
      switch (layer) {
        case 'short':
          await this.shortTermMemory.clear();
          break;
        case 'medium':
          await this.mediumTermMemory.clear();
          break;
        case 'long':
          await this.longTermMemory.clear();
          break;
        case 'semantic':
          await this.semanticMemory.clear();
          break;
        case 'all':
          await this.shortTermMemory.clear();
          await this.mediumTermMemory.clear();
          await this.longTermMemory.clear();
          await this.semanticMemory.clear();
          break;
      }

      console.log(`🧠 Cleared ${layer} memory`);
    } catch (error) {
      console.error('❌ Memory clear failed:', error);
      throw error;
    }
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    // Memory optimization events
    this.eventBus.addEventListener('memory-optimization', event => {
      this.handleMemoryOptimization(event.detail);
    });

    // Context change events
    this.eventBus.addEventListener('context-change', event => {
      this.handleContextChange(event.detail);
    });

    // Performance events
    this.eventBus.addEventListener('performance-alert', event => {
      this.handlePerformanceAlert(event.detail);
    });
  }

  /**
   * Start background optimization
   */
  startBackgroundOptimization() {
    // Periodic memory optimization
    setInterval(() => {
      this.memoryOptimizer.performBackgroundOptimization();
    }, 30000); // Every 30 seconds

    // Memory cleanup
    setInterval(() => {
      this.performMemoryCleanup();
    }, 60000); // Every minute

    console.log('🔄 Background memory optimization started');
  }

  /**
   * Determine memory type for storage
   */
  determineMemoryType(functionName, parameters, result) {
    // High-frequency, fast functions go to short-term memory
    if (this.isHighFrequencyFunction(functionName)) {
      return 'short';
    }

    // Complex analysis results go to medium-term memory
    if (this.isComplexAnalysis(functionName)) {
      return 'medium';
    }

    // Large datasets and external API results go to long-term memory
    if (this.isLargeDataset(result) || this.isExternalAPI(functionName)) {
      return 'long';
    }

    // Patterns and insights go to semantic memory
    if (this.isPatternOrInsight(functionName, result)) {
      return 'semantic';
    }

    // Default to medium-term
    return 'medium';
  }

  /**
   * Store entry in appropriate memory layer
   */
  async storeInMemoryLayer(memoryEntry) {
    switch (memoryEntry.memoryType) {
      case 'short':
        await this.shortTermMemory.store(memoryEntry);
        break;
      case 'medium':
        await this.mediumTermMemory.store(memoryEntry);
        break;
      case 'long':
        await this.longTermMemory.store(memoryEntry);
        break;
      case 'semantic':
        await this.semanticMemory.store(memoryEntry);
        break;
    }
  }

  /**
   * Update context patterns
   */
  updateContextPatterns(memoryEntry) {
    const patternKey = this.generatePatternKey(memoryEntry.functionName, memoryEntry.parameters);
    const pattern = this.contextPatterns.get(patternKey) || {
      count: 0,
      lastUsed: 0,
      contexts: [],
      successRate: 0,
      averageTime: 0,
    };

    pattern.count++;
    pattern.lastUsed = Date.now();
    pattern.contexts.push(memoryEntry.context);
    pattern.successRate = (pattern.successRate * (pattern.count - 1) + (memoryEntry.success ? 1 : 0)) / pattern.count;
    pattern.averageTime = (pattern.averageTime * (pattern.count - 1) + memoryEntry.executionTime) / pattern.count;

    // Keep only recent contexts
    if (pattern.contexts.length > 20) {
      pattern.contexts = pattern.contexts.slice(-20);
    }

    this.contextPatterns.set(patternKey, pattern);
  }

  /**
   * Rank memory results by relevance
   */
  rankMemoryResults(results, functionName, parameters, context) {
    return results
      .map(result => ({
        ...result,
        score: this.calculateRelevanceScore(result, functionName, parameters, context),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10); // Return top 10 results
  }

  /**
   * Calculate relevance score for memory result
   */
  calculateRelevanceScore(result, functionName, parameters, context) {
    let score = 0;

    // Function name match
    if (result.functionName === functionName) {
      score += 10;
    }

    // Parameter similarity
    const paramSimilarity = this.calculateParameterSimilarity(result.parameters, parameters);
    score += paramSimilarity * 5;

    // Context similarity
    const contextSimilarity = this.calculateContextSimilarity(result.context, context);
    score += contextSimilarity * 3;

    // Recency bonus
    const age = Date.now() - result.timestamp;
    const recencyBonus = Math.max(0, 1 - age / (24 * 60 * 60 * 1000)); // Decay over 24 hours
    score += recencyBonus * 2;

    // Success rate bonus
    if (result.success) {
      score += 1;
    }

    // Layer priority
    score *= result.priority;

    return score;
  }

  /**
   * Build memory context from results
   */
  buildMemoryContext(results, currentContext) {
    const context = {
      ...currentContext,
      memoryInsights: {
        similarExecutions: results.length,
        averageExecutionTime: 0,
        successRate: 0,
        commonParameters: this.extractCommonParameters(results),
        patterns: this.extractPatterns(results),
      },
    };

    if (results.length > 0) {
      const times = results.map(r => r.executionTime).filter(t => t > 0);
      const successes = results.filter(r => r.success);

      context.memoryInsights.averageExecutionTime =
        times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
      context.memoryInsights.successRate = results.length > 0 ? successes.length / results.length : 0;
    }

    return context;
  }

  /**
   * Apply context-based optimizations
   */
  async applyContextOptimizations(functionName, parameters, memoryContext) {
    const optimizedParams = { ...parameters };

    // Apply parameter defaults based on context
    const defaults = this.getParameterDefaults(functionName, memoryContext);
    for (const [key, value] of Object.entries(defaults)) {
      if (optimizedParams[key] === undefined) {
        optimizedParams[key] = value;
      }
    }

    // Apply context-specific optimizations
    const contextOptimizations = this.getContextOptimizations(functionName, memoryContext);
    for (const optimization of contextOptimizations) {
      if (optimization.condition(optimizedParams, memoryContext)) {
        optimization.apply(optimizedParams, memoryContext);
      }
    }

    return optimizedParams;
  }

  /**
   * Analyze historical performance
   */
  async analyzeHistoricalPerformance(functionName, parameters, availableAgents, memoryContext) {
    const analysis = {
      agentPerformance: new Map(),
      confidence: 0,
      reasoning: [],
    };

    // Analyze performance for each agent
    for (const agent of availableAgents) {
      const performance = await this.getAgentPerformance(agent.name, functionName, memoryContext);
      analysis.agentPerformance.set(agent.name, performance);
    }

    // Calculate confidence based on data availability
    const totalExecutions = Array.from(analysis.agentPerformance.values()).reduce(
      (sum, perf) => sum + perf.executions,
      0
    );

    analysis.confidence = Math.min(1, totalExecutions / 10); // Higher confidence with more data

    return analysis;
  }

  /**
   * Select optimal agent based on performance analysis
   */
  selectOptimalAgent(performanceAnalysis, availableAgents) {
    let bestAgent = availableAgents[0];
    let bestScore = 0;

    for (const agent of availableAgents) {
      const performance = performanceAnalysis.agentPerformance.get(agent.name);
      if (performance) {
        const score = performance.successRate * (1 / performance.averageTime) * performance.executions;
        if (score > bestScore) {
          bestScore = score;
          bestAgent = agent;
        }
      }
    }

    return bestAgent;
  }

  /**
   * Determine execution strategy
   */
  async determineExecutionStrategy(functionName, parameters, agent, memoryContext) {
    const strategy = {
      caching: false,
      parallelization: false,
      retryCount: 0,
      timeout: 15000,
      priority: 'normal',
    };

    // Apply memory-based strategy rules
    const rules = this.getExecutionStrategyRules(functionName, memoryContext);
    for (const rule of rules) {
      if (rule.condition(parameters, memoryContext)) {
        Object.assign(strategy, rule.strategy);
      }
    }

    return strategy;
  }

  /**
   * Check if context has changed significantly
   */
  hasContextChanged(oldContext, newContext) {
    if (!oldContext || !newContext) return true;

    const oldKeys = Object.keys(oldContext);
    const newKeys = Object.keys(newContext);

    if (oldKeys.length !== newKeys.length) return true;

    for (const key of oldKeys) {
      if (oldContext[key] !== newContext[key]) return true;
    }

    return false;
  }

  /**
   * Perform memory cleanup
   */
  async performMemoryCleanup() {
    try {
      await this.shortTermMemory.cleanup();
      await this.mediumTermMemory.cleanup();
      await this.longTermMemory.cleanup();
      await this.semanticMemory.cleanup();

      console.log('🧹 Memory cleanup completed');
    } catch (error) {
      console.error('❌ Memory cleanup failed:', error);
    }
  }

  /**
   * Generate unique memory ID
   */
  generateMemoryId() {
    return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate pattern key
   */
  generatePatternKey(functionName, parameters) {
    return `${functionName}:${JSON.stringify(parameters)}`;
  }

  /**
   * Get session ID
   */
  getSessionId() {
    return (
      sessionStorage.getItem('genome_session_id') || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    );
  }

  /**
   * Calculate parameter similarity
   */
  calculateParameterSimilarity(params1, params2) {
    const keys1 = Object.keys(params1);
    const keys2 = Object.keys(params2);
    const commonKeys = keys1.filter(key => keys2.includes(key));

    if (commonKeys.length === 0) return 0;

    let similarity = 0;
    for (const key of commonKeys) {
      if (params1[key] === params2[key]) {
        similarity += 1;
      }
    }

    return similarity / commonKeys.length;
  }

  /**
   * Calculate context similarity
   */
  calculateContextSimilarity(context1, context2) {
    if (!context1 || !context2) return 0;

    const keys1 = Object.keys(context1);
    const keys2 = Object.keys(context2);
    const commonKeys = keys1.filter(key => keys2.includes(key));

    if (commonKeys.length === 0) return 0;

    let similarity = 0;
    for (const key of commonKeys) {
      if (context1[key] === context2[key]) {
        similarity += 1;
      }
    }

    return similarity / commonKeys.length;
  }

  /**
   * Extract common parameters from results
   */
  extractCommonParameters(results) {
    const paramCounts = new Map();

    for (const result of results) {
      for (const [key, value] of Object.entries(result.parameters)) {
        const paramKey = `${key}:${value}`;
        paramCounts.set(paramKey, (paramCounts.get(paramKey) || 0) + 1);
      }
    }

    return Array.from(paramCounts.entries())
      .filter(([, count]) => count > 1)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
  }

  /**
   * Extract patterns from results
   */
  extractPatterns(results) {
    const patterns = [];

    // Time-based patterns
    const timeGroups = this.groupByTime(results);
    if (timeGroups.length > 1) {
      patterns.push({
        type: 'temporal',
        description: `Function called ${timeGroups.length} times in recent history`,
      });
    }

    // Success patterns
    const successRate = results.filter(r => r.success).length / results.length;
    if (successRate > 0.8) {
      patterns.push({
        type: 'success',
        description: `High success rate: ${(successRate * 100).toFixed(1)}%`,
      });
    }

    return patterns;
  }

  /**
   * Group results by time
   */
  groupByTime(results) {
    const groups = [];
    let currentGroup = [];

    for (const result of results.sort((a, b) => a.timestamp - b.timestamp)) {
      if (currentGroup.length === 0 || result.timestamp - currentGroup[currentGroup.length - 1].timestamp < 60000) {
        currentGroup.push(result);
      } else {
        if (currentGroup.length > 0) {
          groups.push(currentGroup);
        }
        currentGroup = [result];
      }
    }

    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    return groups;
  }

  /**
   * Helper methods for memory type determination
   */
  isHighFrequencyFunction(functionName) {
    const highFreqFunctions = [
      'navigate_to_position',
      'get_current_state',
      'search_features',
      'get_sequence',
      'toggle_track',
    ];
    return highFreqFunctions.includes(functionName);
  }

  isComplexAnalysis(functionName) {
    const complexFunctions = [
      'compare_regions',
      'find_similar_sequences',
      'build_phylogenetic_tree',
      'ml_analysis',
    ];
    return complexFunctions.includes(functionName);
  }

  isLargeDataset(result) {
    return (
      result &&
      ((result.sequences && result.sequences.length > 100) ||
        (result.features && result.features.length > 1000) ||
        (result.data && JSON.stringify(result.data).length > 10000))
    );
  }

  isExternalAPI(functionName) {
    const externalFunctions = [
      'blast_search',
      'uniprot_search',
      'alphafold_search',
      'interpro_search',
    ];
    return externalFunctions.includes(functionName);
  }

  isPatternOrInsight(functionName, result) {
    return (
      functionName.includes('pattern') ||
      functionName.includes('insight') ||
      functionName.includes('analysis') ||
      (result && result.patterns)
    );
  }

  /**
   * Get parameter defaults based on context
   */
  getParameterDefaults(functionName, memoryContext) {
    const defaults = {};

    // Apply context-specific defaults
    if (memoryContext.results && memoryContext.results.length > 0) {
      const recentResults = memoryContext.results.slice(0, 5);

      // Find common parameter values
      for (const result of recentResults) {
        for (const [key, value] of Object.entries(result.parameters)) {
          if (value !== undefined && value !== null) {
            if (!defaults[key]) {
              defaults[key] = { values: [], count: 0 };
            }
            defaults[key].values.push(value);
            defaults[key].count++;
          }
        }
      }

      // Use most common values as defaults
      for (const [key, data] of Object.entries(defaults)) {
        if (data.count > 1) {
          const valueCounts = {};
          for (const value of data.values) {
            valueCounts[value] = (valueCounts[value] || 0) + 1;
          }
          const mostCommon = Object.entries(valueCounts).sort(([, a], [, b]) => b - a)[0];
          if (mostCommon) {
            defaults[key] = mostCommon[0];
          }
        }
      }
    }

    return defaults;
  }

  /**
   * Get context optimizations
   */
  getContextOptimizations(functionName, memoryContext) {
    const optimizations = [];

    // Performance-based optimizations
    if (memoryContext.memoryInsights && memoryContext.memoryInsights.averageExecutionTime > 5000) {
      optimizations.push({
        condition: () => true,
        apply: params => {
          params.timeout = Math.max(15000, memoryContext.memoryInsights.averageExecutionTime * 2);
        },
      });
    }

    // Success rate optimizations
    if (memoryContext.memoryInsights && memoryContext.memoryInsights.successRate < 0.8) {
      optimizations.push({
        condition: () => true,
        apply: params => {
          params.retryCount = 3;
          params.fallback = true;
        },
      });
    }

    return optimizations;
  }

  /**
   * Get agent performance data
   */
  async getAgentPerformance(agentName, functionName, memoryContext) {
    // This would typically query the memory system for historical performance
    // For now, return default performance data
    return {
      executions: 0,
      successRate: 0.8,
      averageTime: 1000,
      lastUsed: 0,
    };
  }

  /**
   * Get execution strategy rules
   */
  getExecutionStrategyRules(functionName, memoryContext) {
    const rules = [];

    // Caching rules
    if (memoryContext.memoryInsights && memoryContext.memoryInsights.similarExecutions > 3) {
      rules.push({
        condition: () => true,
        strategy: { caching: true },
      });
    }

    // Parallelization rules
    if (functionName.includes('batch') || functionName.includes('multiple')) {
      rules.push({
        condition: () => true,
        strategy: { parallelization: true },
      });
    }

    return rules;
  }

  /**
   * Get optimization summary
   */
  getOptimizationSummary(original, optimized) {
    const summary = [];

    for (const [key, value] of Object.entries(optimized)) {
      if (original[key] !== value) {
        summary.push({
          parameter: key,
          original: original[key],
          optimized: value,
          type: 'default', // or 'context', 'performance', etc.
        });
      }
    }

    return summary;
  }

  /**
   * Calculate optimization confidence
   */
  calculateOptimizationConfidence(memoryContext) {
    if (!memoryContext.results || memoryContext.results.length === 0) {
      return 0;
    }

    const dataPoints = memoryContext.results.length;
    const successRate = memoryContext.memoryInsights.successRate;
    const recency = Math.min(1, dataPoints / 10); // More recent data = higher confidence

    return dataPoints * 0.3 + successRate * 0.4 + recency * 0.3;
  }

  /**
   * Handle memory optimization events
   */
  handleMemoryOptimization(detail) {
    this.memoryMetrics.optimizationEvents++;
    console.log('🧠 Memory optimization event:', detail);
  }

  /**
   * Handle context change events
   */
  handleContextChange(detail) {
    console.log('🧠 Context change event:', detail);
  }

  /**
   * Handle performance alert events
   */
  handlePerformanceAlert(detail) {
    console.log('🚨 Performance alert:', detail);
    // Could trigger memory optimization or cleanup
  }
}

/**
 * Short-term Memory Layer with Advanced Caching
 */
class ShortTermMemory {
  constructor() {
    // LRU Cache implementation
    this.cache = new Map();
    this.maxCacheSize = 1000;
    this.defaultTTL = 5 * 60 * 1000; // 5 minutes
    this.accessOrder = new Map(); // For LRU tracking

    // Cache statistics
    this.cacheStats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      expiredEntries: 0,
      totalRequests: 0,
    };

    // Performance tracking
    this.performanceTracker = {
      averageResponseTime: 0,
      cacheEfficiency: 0,
      lastCleanup: Date.now(),
    };

    // Tool call history for context
    this.toolCallHistory = [];
    this.maxHistorySize = 500;

    // Predictive caching
    this.predictiveCache = new Map();
    this.accessPatterns = new Map();
  }

  /**
   * Initialize short-term memory
   */
  async initialize() {
    // Start background cache maintenance
    this.startCacheMaintenance();
    console.log('🧠 ShortTermMemory initialized with LRU cache');
  }

  /**
   * Store memory entry with caching
   */
  async store(memoryEntry) {
    try {
      const cacheKey = this.generateCacheKey(memoryEntry);
      const cacheEntry = {
        ...memoryEntry,
        cacheKey,
        timestamp: Date.now(),
        accessCount: 1,
        lastAccessed: Date.now(),
        ttl: this.calculateTTL(memoryEntry),
      };

      // Add to cache
      this.cache.set(cacheKey, cacheEntry);
      this.accessOrder.set(cacheKey, Date.now());

      // Maintain LRU order
      this.maintainCacheSize();

      // Add to history
      this.addToHistory(memoryEntry);

      // Update access patterns for predictive caching
      this.updateAccessPattern(memoryEntry);

      console.log(`🧠 [ShortTermMemory] Cached entry: ${cacheKey}`);
    } catch (error) {
      console.error('❌ ShortTermMemory.store error:', error);
    }
  }

  /**
   * Search with intelligent caching
   */
  async search(functionName, parameters) {
    const startTime = performance.now();
    this.cacheStats.totalRequests++;

    try {
      const searchKey = this.generateSearchKey(functionName, parameters);

      // Check direct cache hit
      const directResult = this.getFromCache(searchKey);
      if (directResult && !this.isExpired(directResult)) {
        this.cacheStats.hits++;
        this.recordAccess(searchKey);
        this.updateResponseTime(performance.now() - startTime);
        console.log(`🧠 [ShortTermMemory] Cache hit: ${searchKey}`);
        return [this.adaptResult(directResult, functionName, parameters)];
      }

      // Check predictive cache
      const predictiveResult = this.getFromPredictiveCache(functionName, parameters);
      if (predictiveResult) {
        this.cacheStats.hits++;
        this.recordAccess(searchKey);
        this.updateResponseTime(performance.now() - startTime);
        console.log(`🧠 [ShortTermMemory] Predictive cache hit: ${searchKey}`);
        return [this.adaptResult(predictiveResult, functionName, parameters)];
      }

      // Cache miss - search in history
      this.cacheStats.misses++;
      const historyResults = this.searchInHistory(functionName, parameters);

      // If found in history, add to predictive cache
      if (historyResults.length > 0) {
        this.addToPredictiveCache(functionName, parameters, historyResults[0]);
        this.updateResponseTime(performance.now() - startTime);
        return historyResults.slice(0, 3); // Return top 3 results
      }

      this.updateResponseTime(performance.now() - startTime);
      console.log(`🧠 [ShortTermMemory] Cache miss: ${searchKey}`);
      return [];
    } catch (error) {
      console.error('❌ ShortTermMemory.search error:', error);
      this.updateResponseTime(performance.now() - startTime);
      return [];
    }
  }

  /**
   * Generate cache key
   */
  generateCacheKey(memoryEntry) {
    const components = [
      memoryEntry.functionName || 'unknown',
      JSON.stringify(memoryEntry.parameters || {}),
      memoryEntry.agent || 'default',
      Math.floor(memoryEntry.timestamp / (60 * 1000)), // Group by minute
    ];
    return components.join('|');
  }

  /**
   * Generate search key
   */
  generateSearchKey(functionName, parameters) {
    return `${functionName}|${JSON.stringify(parameters)}`;
  }

  /**
   * Get from cache with LRU update
   */
  getFromCache(key) {
    const entry = this.cache.get(key);
    if (entry) {
      if (!this.isExpired(entry)) {
        // Update access info for LRU
        this.accessOrder.set(key, Date.now());
        entry.lastAccessed = Date.now();
        entry.accessCount++;
        return entry;
      } else {
        // Remove expired entry
        this.removeFromCache(key);
        this.cacheStats.expiredEntries++;
      }
    }
    return null;
  }

  /**
   * Check if cache entry is expired
   */
  isExpired(entry) {
    if (!entry.ttl) return false;
    return Date.now() - entry.lastAccessed > entry.ttl;
  }

  /**
   * Calculate TTL based on entry characteristics
   */
  calculateTTL(memoryEntry) {
    let ttl = this.defaultTTL;

    // High-frequency functions get longer TTL
    if (this.isHighFrequencyFunction(memoryEntry.functionName)) {
      ttl *= 2;
    }

    // Complex results get shorter TTL (to encourage fresh data)
    if (this.isComplexResult(memoryEntry.result)) {
      ttl *= 0.5;
    }

    // Successful operations get longer TTL
    if (memoryEntry.success) {
      ttl *= 1.5;
    }

    return Math.max(ttl, 60 * 1000); // Minimum 1 minute
  }

  /**
   * Maintain cache size using LRU
   */
  maintainCacheSize() {
    while (this.cache.size > this.maxCacheSize) {
      // Find least recently used entry
      let lruKey = null;
      let lruTime = Date.now();

      for (const [key, accessTime] of this.accessOrder) {
        if (accessTime < lruTime) {
          lruTime = accessTime;
          lruKey = key;
        }
      }

      if (lruKey) {
        this.removeFromCache(lruKey);
        this.cacheStats.evictions++;
      } else {
        break; // Safety check
      }
    }
  }

  /**
   * Remove from cache
   */
  removeFromCache(key) {
    this.cache.delete(key);
    this.accessOrder.delete(key);
  }

  /**
   * Record cache access
   */
  recordAccess(key) {
    this.accessOrder.set(key, Date.now());
  }

  /**
   * Update response time metrics
   */
  updateResponseTime(responseTime) {
    const currentAvg = this.performanceTracker.averageResponseTime;
    const totalRequests = this.cacheStats.totalRequests;

    this.performanceTracker.averageResponseTime = (currentAvg * (totalRequests - 1) + responseTime) / totalRequests;

    // Update cache efficiency
    this.performanceTracker.cacheEfficiency =
      this.cacheStats.totalRequests > 0 ? this.cacheStats.hits / this.cacheStats.totalRequests : 0;
  }

  /**
   * Search in tool call history
   */
  searchInHistory(functionName, parameters) {
    const results = [];
    const recentHistory = this.toolCallHistory.slice(-100); // Search in recent history

    for (const entry of recentHistory) {
      if (entry.functionName === functionName) {
        const similarity = this.calculateSimilarity(entry.parameters, parameters);
        if (similarity > 0.3) {
          // Threshold for relevance
          results.push({
            ...entry,
            score: similarity,
            fromCache: false,
            cacheKey: this.generateCacheKey(entry),
          });
        }
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate parameter similarity
   */
  calculateSimilarity(params1, params2) {
    const keys1 = Object.keys(params1 || {});
    const keys2 = Object.keys(params2 || {});
    const commonKeys = keys1.filter(key => keys2.includes(key));

    if (commonKeys.length === 0) return 0;

    let similarity = 0;
    for (const key of commonKeys) {
      if (params1[key] === params2[key]) {
        similarity += 1;
      }
    }

    return similarity / Math.max(keys1.length, keys2.length);
  }

  /**
   * Add to tool call history
   */
  addToHistory(memoryEntry) {
    this.toolCallHistory.push(memoryEntry);

    // Maintain history size
    if (this.toolCallHistory.length > this.maxHistorySize) {
      this.toolCallHistory = this.toolCallHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Update access patterns for predictive caching
   */
  updateAccessPattern(memoryEntry) {
    const patternKey = `${memoryEntry.functionName}_${Date.now() % (60 * 60 * 1000)}`; // Group by hour
    const pattern = this.accessPatterns.get(patternKey) || {
      count: 0,
      functions: new Set(),
      parameters: new Map(),
    };

    pattern.count++;
    pattern.functions.add(memoryEntry.functionName);

    // Track common parameters
    Object.entries(memoryEntry.parameters || {}).forEach(([key, value]) => {
      const paramPattern = pattern.parameters.get(key) || new Map();
      paramPattern.set(value, (paramPattern.get(value) || 0) + 1);
      pattern.parameters.set(key, paramPattern);
    });

    this.accessPatterns.set(patternKey, pattern);
  }

  /**
   * Get from predictive cache
   */
  getFromPredictiveCache(functionName, parameters) {
    const currentHour = Date.now() % (60 * 60 * 1000);
    const patternKey = `${functionName}_${currentHour}`;
    const pattern = this.accessPatterns.get(patternKey);

    if (pattern && pattern.count > 2) {
      // Need at least 3 accesses for prediction
      // Find best matching historical result
      for (const historyEntry of this.toolCallHistory) {
        if (historyEntry.functionName === functionName) {
          const similarity = this.calculateSimilarity(historyEntry.parameters, parameters);
          if (similarity > 0.7) {
            // High similarity threshold for predictions
            return historyEntry;
          }
        }
      }
    }

    return null;
  }

  /**
   * Add to predictive cache
   */
  addToPredictiveCache(functionName, parameters, result) {
    const cacheKey = `predictive_${this.generateSearchKey(functionName, parameters)}`;
    this.predictiveCache.set(cacheKey, {
      ...result,
      cacheKey,
      predicted: true,
      confidence: this.calculatePredictionConfidence(functionName, parameters),
    });

    // Clean old predictive cache entries
    this.cleanPredictiveCache();
  }

  /**
   * Calculate prediction confidence
   */
  calculatePredictionConfidence(functionName, parameters) {
    const patternKey = `${functionName}_${Date.now() % (60 * 60 * 1000)}`;
    const pattern = this.accessPatterns.get(patternKey);

    if (!pattern) return 0;

    // Higher confidence for frequently accessed patterns
    const frequencyScore = Math.min(pattern.count / 10, 1);

    // Higher confidence for successful operations
    const successScore = this.getRecentSuccessRate(functionName);

    return frequencyScore * 0.6 + successScore * 0.4;
  }

  /**
   * Get recent success rate for function
   */
  getRecentSuccessRate(functionName) {
    const recentEntries = this.toolCallHistory.filter(entry => entry.functionName === functionName).slice(-10); // Last 10 calls

    if (recentEntries.length === 0) return 0;

    const successCount = recentEntries.filter(entry => entry.success).length;
    return successCount / recentEntries.length;
  }

  /**
   * Clean predictive cache
   */
  cleanPredictiveCache() {
    if (this.predictiveCache.size > 100) {
      // Remove oldest entries
      const entries = Array.from(this.predictiveCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

      const toRemove = entries.slice(0, entries.length - 100);
      toRemove.forEach(([key]) => this.predictiveCache.delete(key));
    }
  }

  /**
   * Adapt result for current context
   */
  adaptResult(cachedResult, functionName, parameters) {
    return {
      ...cachedResult,
      fromCache: true,
      cacheKey: cachedResult.cacheKey,
      adapted: true,
      originalFunctionName: cachedResult.functionName,
      currentFunctionName: functionName,
    };
  }

  /**
   * Start background cache maintenance
   */
  startCacheMaintenance() {
    // Periodic cleanup
    setInterval(() => {
      this.performMaintenance();
    }, 60000); // Every minute

    // Performance monitoring
    setInterval(() => {
      this.logPerformanceStats();
    }, 300000); // Every 5 minutes
  }

  /**
   * Perform cache maintenance
   */
  performMaintenance() {
    const now = Date.now();

    // Remove expired entries
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.removeFromCache(key);
        this.cacheStats.expiredEntries++;
      }
    }

    // Clean access patterns older than 2 hours
    const twoHoursAgo = now - 2 * 60 * 60 * 1000;
    for (const [key] of this.accessPatterns) {
      const hourTimestamp = parseInt(key.split('_')[1]);
      if (hourTimestamp < twoHoursAgo) {
        this.accessPatterns.delete(key);
      }
    }

    this.performanceTracker.lastCleanup = now;
  }

  /**
   * Log performance statistics
   */
  logPerformanceStats() {
    const stats = this.getStats();
    console.log('🧠 [ShortTermMemory] Cache Performance:', {
      hitRate: `${(stats.cacheEfficiency * 100).toFixed(1)}%`,
      averageResponseTime: `${stats.averageResponseTime.toFixed(2)}ms`,
      totalEntries: stats.cacheSize,
      memoryUsage: this.calculateMemoryUsage(),
    });
  }

  /**
   * Calculate memory usage
   */
  calculateMemoryUsage() {
    let totalSize = 0;

    for (const [, entry] of this.cache) {
      totalSize += JSON.stringify(entry).length;
    }

    for (const [, entry] of this.predictiveCache) {
      totalSize += JSON.stringify(entry).length;
    }

    return `${(totalSize / 1024).toFixed(2)}KB`;
  }

  /**
   * Clear all caches
   */
  async clear() {
    this.cache.clear();
    this.accessOrder.clear();
    this.predictiveCache.clear();
    this.toolCallHistory = [];
    this.accessPatterns.clear();

    // Reset statistics
    Object.keys(this.cacheStats).forEach(key => {
      this.cacheStats[key] = 0;
    });

    console.log('🧠 [ShortTermMemory] All caches cleared');
  }

  /**
   * Get comprehensive statistics
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      predictiveCacheSize: this.predictiveCache.size,
      historySize: this.toolCallHistory.length,
      patternCount: this.accessPatterns.size,
      cacheStats: { ...this.cacheStats },
      performance: { ...this.performanceTracker },
      averageResponseTime: this.performanceTracker.averageResponseTime,
      cacheEfficiency: this.performanceTracker.cacheEfficiency,
    };
  }

  /**
   * Get session-specific statistics
   */
  getSessionStats() {
    return {
      totalCalls: this.toolCallHistory.length,
      uniqueFunctions: new Set(this.toolCallHistory.map(h => h.functionName)).size,
      successRate:
        this.toolCallHistory.length > 0
          ? this.toolCallHistory.filter(h => h.success).length / this.toolCallHistory.length
          : 0,
      averageExecutionTime:
        this.toolCallHistory.length > 0
          ? this.toolCallHistory.reduce((sum, h) => sum + (h.executionTime || 0), 0) / this.toolCallHistory.length
          : 0,
    };
  }

  /**
   * Get tool usage pattern
   */
  getToolUsagePattern() {
    const pattern = new Map();

    this.toolCallHistory.forEach(entry => {
      const count = pattern.get(entry.functionName) || 0;
      pattern.set(entry.functionName, count + 1);
    });

    return pattern;
  }

  /**
   * Helper methods for TTL calculation
   */
  isHighFrequencyFunction(functionName) {
    const highFreqFunctions = [
      'navigate_to_position',
      'get_current_state',
      'search_features',
      'get_sequence',
      'toggle_track',
      'zoom_to_region',
    ];
    return highFreqFunctions.includes(functionName);
  }

  isComplexResult(result) {
    return (
      result &&
      ((result.sequences && result.sequences.length > 50) ||
        (result.features && result.features.length > 500) ||
        (result.data && JSON.stringify(result.data).length > 5000))
    );
  }

  /**
   * Clean up expired entries
   */
  async cleanup() {
    const now = Date.now();
    const expiredKeys = [];

    // Clean up cache entries
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        expiredKeys.push(key);
      }
    }

    // Remove expired cache entries
    for (const key of expiredKeys) {
      this.removeFromCache(key);
    }

    // Clean up tool call history
    const cutoffTime = now - 24 * 60 * 60 * 1000; // 24 hours
    this.toolCallHistory = this.toolCallHistory.filter(entry => entry.timestamp > cutoffTime);

    // Clean up predictive cache
    for (const [key, entry] of this.predictiveCache.entries()) {
      if (now - entry.timestamp > this.defaultTTL) {
        this.predictiveCache.delete(key);
      }
    }

    // Clean up access patterns
    for (const [key, pattern] of this.accessPatterns.entries()) {
      if (now - pattern.lastAccess > this.defaultTTL) {
        this.accessPatterns.delete(key);
      }
    }

    this.performanceTracker.lastCleanup = now;
    this.cacheStats.expiredEntries += expiredKeys.length;

    if (expiredKeys.length > 0) {
      console.log(`🧠 ShortTermMemory cleaned up ${expiredKeys.length} expired cache entries`);
    }
  }
}

/**
 * Medium-term Memory Layer
 */
class MediumTermMemory {
  constructor() {
    this.userPreferences = new Map();
    this.workflowPatterns = new Map();
    this.performanceMetrics = new Map();
    this.errorPatterns = new Map();
  }

  /**
   * Initialize
   */
  async initialize() {
    // No specific initialization needed for medium-term memory
    console.log('🧠 MediumTermMemory initialized');
  }

  /**
   * Store memory entry
   */
  async store(memoryEntry) {
    try {
      // Store in appropriate medium-term memory structures
      if (memoryEntry.type === 'tool_call') {
        this.updateUserPreferences(memoryEntry.functionName, memoryEntry.parameters, memoryEntry.success);

        // Update workflow patterns
        if (!this.workflowPatterns.has(memoryEntry.agent)) {
          this.workflowPatterns.set(memoryEntry.agent, []);
        }
        this.workflowPatterns.get(memoryEntry.agent).push({
          function: memoryEntry.functionName,
          timestamp: memoryEntry.timestamp,
          success: memoryEntry.success,
        });
      }

      // Update performance metrics
      if (memoryEntry.executionTime) {
        const key = `${memoryEntry.functionName}_${memoryEntry.agent}`;
        if (!this.performanceMetrics.has(key)) {
          this.performanceMetrics.set(key, {
            totalTime: 0,
            count: 0,
            averageTime: 0,
          });
        }

        const metrics = this.performanceMetrics.get(key);
        metrics.totalTime += memoryEntry.executionTime;
        metrics.count++;
        metrics.averageTime = metrics.totalTime / metrics.count;
      }
    } catch (error) {
      console.error('❌ MediumTermMemory.store error:', error);
    }
  }

  /**
   * Update user preferences
   */
  updateUserPreferences(toolName, parameters, success) {
    if (!this.userPreferences.has(toolName)) {
      this.userPreferences.set(toolName, {
        preferredParameters: new Map(),
        successRate: 0,
        usageCount: 0,
        lastUsed: null,
      });
    }

    const pref = this.userPreferences.get(toolName);
    pref.usageCount++;
    pref.successRate = (pref.successRate * (pref.usageCount - 1) + (success ? 1 : 0)) / pref.usageCount;
    pref.lastUsed = Date.now();

    // Update parameter preferences
    Object.entries(parameters).forEach(([key, value]) => {
      if (!pref.preferredParameters.has(key)) {
        pref.preferredParameters.set(key, new Map());
      }
      const paramPref = pref.preferredParameters.get(key);
      paramPref.set(value, (paramPref.get(value) || 0) + 1);
    });
  }

  /**
   * Get preferred parameters
   */
  getPreferredParameters(toolName) {
    const pref = this.userPreferences.get(toolName);
    if (!pref) return {};

    const preferred = {};
    pref.preferredParameters.forEach((valueCounts, paramName) => {
      const maxValue = Array.from(valueCounts.entries()).reduce((a, b) => (a[1] > b[1] ? a : b))[0];
      preferred[paramName] = maxValue;
    });

    return preferred;
  }

  /**
   * Record workflow pattern
   */
  recordWorkflowPattern(pattern) {
    const patternKey = this.generatePatternKey(pattern);
    if (!this.workflowPatterns.has(patternKey)) {
      this.workflowPatterns.set(patternKey, {
        pattern,
        usageCount: 0,
        successRate: 0,
        lastUsed: null,
      });
    }

    const workflow = this.workflowPatterns.get(patternKey);
    workflow.usageCount++;
    workflow.lastUsed = Date.now();
  }

  /**
   * Generate pattern key
   */
  generatePatternKey(pattern) {
    return pattern.tools.join('->');
  }

  /**
   * Get recommended workflows
   */
  getRecommendedWorkflows(toolName) {
    const recommendations = [];

    this.workflowPatterns.forEach((workflow, key) => {
      if (workflow.pattern.tools.includes(toolName)) {
        recommendations.push({
          pattern: workflow.pattern,
          usageCount: workflow.usageCount,
          successRate: workflow.successRate,
        });
      }
    });

    return recommendations.sort((a, b) => b.usageCount - a.usageCount);
  }

  /**
   * Search for patterns
   */
  async search(functionName, parameters) {
    const results = [];
    for (const [, workflow] of this.workflowPatterns) {
      if (workflow.pattern.tools.includes(functionName)) {
        results.push({
          ...workflow,
          score: this.calculateRelevanceScore(workflow, functionName, parameters),
        });
      }
    }
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate relevance score
   */
  calculateRelevanceScore(workflow, functionName, parameters) {
    let score = 0;

    // Function name match
    if (workflow.pattern.tools.includes(functionName)) {
      score += 10;
    }

    // Parameter similarity
    const paramSimilarity = this.calculateParameterSimilarity(workflow.pattern.parameters, parameters);
    score += paramSimilarity * 5;

    // Recency bonus
    const age = Date.now() - workflow.lastUsed;
    const recencyBonus = Math.max(0, 1 - age / (24 * 60 * 60 * 1000)); // Decay over 24 hours
    score += recencyBonus * 2;

    // Success rate bonus
    if (workflow.successRate > 0.8) {
      score += 1;
    }

    return score;
  }

  /**
   * Calculate parameter similarity
   */
  calculateParameterSimilarity(params1, params2) {
    const keys1 = Object.keys(params1);
    const keys2 = Object.keys(params2);
    const commonKeys = keys1.filter(key => keys2.includes(key));

    if (commonKeys.length === 0) return 0;

    let similarity = 0;
    for (const key of commonKeys) {
      if (params1[key] === params2[key]) {
        similarity += 1;
      }
    }

    return similarity / commonKeys.length;
  }

  /**
   * Clean up expired data
   */
  async cleanup() {
    // Clean up old workflow patterns (older than 30 days)
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    for (const [key, workflow] of this.workflowPatterns.entries()) {
      if (workflow.lastUsed < thirtyDaysAgo) {
        this.workflowPatterns.delete(key);
      }
    }

    console.log('🧠 MediumTermMemory cleanup completed');
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      userPreferences: this.userPreferences.size,
      workflowPatterns: this.workflowPatterns.size,
    };
  }
}

/**
 * Long-term Memory Layer
 */
class LongTermMemory {
  constructor() {
    this.knowledgeBase = new Map();
    this.historicalData = new Map();
    this.learnedPatterns = new Map();
    this.optimizationRules = new Map();
  }

  /**
   * Initialize
   */
  async initialize() {
    // No specific initialization needed for long-term memory
    console.log('🧠 LongTermMemory initialized');
  }

  /**
   * Store memory entry
   */
  async store(memoryEntry) {
    try {
      // Store in appropriate long-term memory structures
      if (memoryEntry.type === 'tool_call') {
        // Store in historical data
        const historicalKey = `${memoryEntry.functionName}_${Date.now()}`;
        this.historicalData.set(historicalKey, {
          functionName: memoryEntry.functionName,
          parameters: memoryEntry.parameters,
          result: memoryEntry.result,
          executionTime: memoryEntry.executionTime,
          agent: memoryEntry.agent,
          success: memoryEntry.success,
          timestamp: memoryEntry.timestamp,
        });

        // Update learned patterns
        if (!this.learnedPatterns.has(memoryEntry.functionName)) {
          this.learnedPatterns.set(memoryEntry.functionName, {
            successRate: 0,
            commonParameters: new Map(),
            averageExecutionTime: 0,
            usageCount: 0,
          });
        }

        const pattern = this.learnedPatterns.get(memoryEntry.functionName);
        pattern.usageCount++;
        pattern.successRate =
          (pattern.successRate * (pattern.usageCount - 1) + (memoryEntry.success ? 1 : 0)) / pattern.usageCount;

        if (memoryEntry.executionTime) {
          pattern.averageExecutionTime =
            (pattern.averageExecutionTime * (pattern.usageCount - 1) + memoryEntry.executionTime) / pattern.usageCount;
        }
      }
    } catch (error) {
      console.error('❌ LongTermMemory.store error:', error);
    }
  }

  /**
   * Store knowledge
   */
  storeKnowledge(domain, knowledge) {
    if (!this.knowledgeBase.has(domain)) {
      this.knowledgeBase.set(domain, []);
    }
    this.knowledgeBase.get(domain).push({
      ...knowledge,
      timestamp: Date.now(),
      confidence: knowledge.confidence || 0.8,
    });
  }

  /**
   * Retrieve knowledge
   */
  async retrieveKnowledge(domain, query) {
    const domainKnowledge = this.knowledgeBase.get(domain) || [];
    return domainKnowledge.filter(k => k.confidence > 0.7 && this.matchesQuery(k, query));
  }

  /**
   * Check query match
   */
  matchesQuery(knowledge, query) {
    // Simple string matching, can be extended to more complex semantic matching
    if (typeof query === 'string') {
      return (
        knowledge.functionName === query ||
        knowledge.parameters?.includes?.(query) ||
        knowledge.context?.includes?.(query)
      );
    }
    return true;
  }

  /**
   * Update optimization rules
   */
  updateOptimizationRules(toolName, rule) {
    if (!this.optimizationRules.has(toolName)) {
      this.optimizationRules.set(toolName, []);
    }
    this.optimizationRules.get(toolName).push(rule);
  }

  /**
   * Get optimization rules
   */
  getOptimizationRules(toolName) {
    return this.optimizationRules.get(toolName) || [];
  }

  /**
   * Store historical data
   */
  storeHistoricalData(key, data) {
    this.historicalData.set(key, {
      data,
      timestamp: Date.now(),
      accessCount: 0,
    });
  }

  /**
   * Get historical data
   */
  getHistoricalData(key) {
    const historical = this.historicalData.get(key);
    if (historical) {
      historical.accessCount++;
      return historical.data;
    }
    return null;
  }

  /**
   * Search for knowledge
   */
  async search(functionName, parameters) {
    const results = [];
    for (const [, knowledge] of this.knowledgeBase) {
      for (const k of knowledge) {
        if (k.functionName === functionName && this.matchesQuery(k, parameters)) {
          results.push({
            ...k,
            score: this.calculateRelevanceScore(k, functionName, parameters),
          });
        }
      }
    }
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate relevance score
   */
  calculateRelevanceScore(knowledge, functionName, parameters) {
    let score = 0;

    // Function name match
    if (knowledge.functionName === functionName) {
      score += 10;
    }

    // Parameter similarity
    const paramSimilarity = this.calculateParameterSimilarity(knowledge.parameters, parameters);
    score += paramSimilarity * 5;

    // Recency bonus
    const age = Date.now() - knowledge.timestamp;
    const recencyBonus = Math.max(0, 1 - age / (24 * 60 * 60 * 1000)); // Decay over 24 hours
    score += recencyBonus * 2;

    // Success rate bonus
    if (knowledge.success) {
      score += 1;
    }

    return score;
  }

  /**
   * Calculate parameter similarity
   */
  calculateParameterSimilarity(params1, params2) {
    const keys1 = Object.keys(params1);
    const keys2 = Object.keys(params2);
    const commonKeys = keys1.filter(key => keys2.includes(key));

    if (commonKeys.length === 0) return 0;

    let similarity = 0;
    for (const key of commonKeys) {
      if (params1[key] === params2[key]) {
        similarity += 1;
      }
    }

    return similarity / commonKeys.length;
  }

  /**
   * Clean up expired data
   */
  async cleanup() {
    // Clean up old historical data (older than 90 days)
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;

    for (const [key, data] of this.historicalData.entries()) {
      if (data.timestamp < ninetyDaysAgo && data.accessCount === 0) {
        this.historicalData.delete(key);
      }
    }

    // Clean up low-confidence knowledge (older than 30 days and confidence < 0.3)
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    for (const [domain, knowledgeList] of this.knowledgeBase.entries()) {
      const filtered = knowledgeList.filter(k => k.timestamp > thirtyDaysAgo || k.confidence >= 0.3);
      this.knowledgeBase.set(domain, filtered);
    }

    console.log('🧠 LongTermMemory cleanup completed');
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      knowledgeBase: this.knowledgeBase.size,
      optimizationRules: this.optimizationRules.size,
    };
  }
}

/**
 * Semantic Memory Layer
 */
class SemanticMemory {
  constructor() {
    this.conceptGraph = new Map();
    this.relationshipMap = new Map();
    this.contextualRules = new Map();
  }

  /**
   * Initialize
   */
  async initialize() {
    // No specific initialization needed for semantic memory
    console.log('🧠 SemanticMemory initialized');
  }

  /**
   * Store memory entry
   */
  async store(memoryEntry) {
    try {
      // Store in appropriate semantic memory structures
      if (memoryEntry.type === 'tool_call') {
        // Add concept for the function
        if (!this.conceptGraph.has(memoryEntry.functionName)) {
          this.addConcept(memoryEntry.functionName, {
            type: 'function',
            category: 'genomics_tool',
            success_rate: memoryEntry.success ? 1 : 0,
            usage_count: 1,
          });
        } else {
          // Update existing concept
          const concept = this.conceptGraph.get(memoryEntry.functionName);
          concept.properties.usage_count = (concept.properties.usage_count || 0) + 1;
          concept.properties.last_used = Date.now();

          // Update success rate
          const currentSuccessRate = concept.properties.success_rate || 0;
          const newSuccessRate =
            (currentSuccessRate * (concept.properties.usage_count - 1) + (memoryEntry.success ? 1 : 0)) /
            concept.properties.usage_count;
          concept.properties.success_rate = newSuccessRate;
        }

        // Add relationships between function and parameters
        Object.keys(memoryEntry.parameters).forEach(param => {
          const paramConcept = `param_${param}`;
          if (!this.conceptGraph.has(paramConcept)) {
            this.addConcept(paramConcept, {
              type: 'parameter',
              category: 'function_parameter',
            });
          }

          // Add relationship
          this.addRelationship(memoryEntry.functionName, paramConcept, 'uses');
        });

        // Add agent relationship
        if (memoryEntry.agent) {
          const agentConcept = `agent_${memoryEntry.agent}`;
          if (!this.conceptGraph.has(agentConcept)) {
            this.addConcept(agentConcept, {
              type: 'agent',
              category: 'execution_agent',
            });
          }
          this.addRelationship(memoryEntry.functionName, agentConcept, 'executed_by');
        }
      }
    } catch (error) {
      console.error('❌ SemanticMemory.store error:', error);
    }
  }

  /**
   * Add concept
   */
  addConcept(concept, properties) {
    this.conceptGraph.set(concept, {
      properties,
      relationships: new Set(),
      instances: new Set(),
      timestamp: Date.now(),
    });
  }

  /**
   * Add relationship
   */
  addRelationship(concept1, concept2, relationshipType) {
    if (!this.relationshipMap.has(relationshipType)) {
      this.relationshipMap.set(relationshipType, new Map());
    }

    const relationships = this.relationshipMap.get(relationshipType);
    if (!relationships.has(concept1)) {
      relationships.set(concept1, new Set());
    }
    relationships.get(concept1).add(concept2);
  }

  /**
   * Find related concepts
   */
  findRelatedConcepts(concept, relationshipType, maxDepth = 2) {
    const related = new Set();
    const visited = new Set();

    const traverse = (currentConcept, depth) => {
      if (depth > maxDepth || visited.has(currentConcept)) return;
      visited.add(currentConcept);

      const relationships = this.relationshipMap.get(relationshipType);
      if (relationships && relationships.has(currentConcept)) {
        relationships.get(currentConcept).forEach(relatedConcept => {
          related.add(relatedConcept);
          if (depth < maxDepth) {
            traverse(relatedConcept, depth + 1);
          }
        });
      }
    };

    traverse(concept, 0);
    return Array.from(related);
  }

  /**
   * Get concept properties
   */
  getConceptProperties(concept) {
    const conceptData = this.conceptGraph.get(concept);
    return conceptData ? conceptData.properties : null;
  }

  /**
   * Add contextual rule
   */
  addContextualRule(context, rule) {
    if (!this.contextualRules.has(context)) {
      this.contextualRules.set(context, []);
    }
    this.contextualRules.get(context).push(rule);
  }

  /**
   * Get contextual rules
   */
  getContextualRules(context) {
    return this.contextualRules.get(context) || [];
  }

  /**
   * Search for concepts
   */
  async search(functionName, parameters) {
    const results = [];
    for (const [concept, data] of this.conceptGraph) {
      if (this.matchesQuery(concept, functionName) && this.matchesQuery(data.properties, parameters)) {
        results.push({
          concept,
          properties: data.properties,
          score: this.calculateRelevanceScore(concept, functionName, parameters),
        });
      }
    }
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Check if query matches
   */
  matchesQuery(item, query) {
    if (typeof query === 'string') {
      return item === query;
    }
    return true;
  }

  /**
   * Calculate relevance score
   */
  calculateRelevanceScore(concept, functionName, parameters) {
    let score = 0;

    // Function name match
    if (concept === functionName) {
      score += 10;
    }

    // Parameter similarity
    const paramSimilarity = this.calculateParameterSimilarity(this.getConceptProperties(concept), parameters);
    score += paramSimilarity * 5;

    // Recency bonus
    const age = Date.now() - this.conceptGraph.get(concept).timestamp;
    const recencyBonus = Math.max(0, 1 - age / (24 * 60 * 60 * 1000)); // Decay over 24 hours
    score += recencyBonus * 2;

    return score;
  }

  /**
   * Calculate parameter similarity
   */
  calculateParameterSimilarity(properties1, properties2) {
    const keys1 = Object.keys(properties1);
    const keys2 = Object.keys(properties2);
    const commonKeys = keys1.filter(key => keys2.includes(key));

    if (commonKeys.length === 0) return 0;

    let similarity = 0;
    for (const key of commonKeys) {
      if (properties1[key] === properties2[key]) {
        similarity += 1;
      }
    }

    return similarity / commonKeys.length;
  }

  /**
   * Clean up expired data
   */
  async cleanup() {
    // Clean up old concepts (older than 60 days with no instances or relationships)
    const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000;

    for (const [concept, data] of this.conceptGraph.entries()) {
      if (data.timestamp < sixtyDaysAgo && data.instances.size === 0 && data.relationships.size === 0) {
        this.conceptGraph.delete(concept);

        // Clean up relationships involving this concept
        for (const [relType, relationMap] of this.relationshipMap.entries()) {
          for (const [fromConcept, toConcepts] of relationMap.entries()) {
            toConcepts.delete(concept);
            if (toConcepts.size === 0) {
              relationMap.delete(fromConcept);
            }
          }
          if (relationMap.size === 0) {
            this.relationshipMap.delete(relType);
          }
        }
      }
    }

    console.log('🧠 SemanticMemory cleanup completed');
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      concepts: this.conceptGraph.size,
      relationships: this.relationshipMap.size,
    };
  }
}

/**
 * Memory Manager
 */
class MemoryManager {
  constructor(memorySystem) {
    this.memorySystem = memorySystem;
    this.isInitialized = false;
  }

  /**
   * Initialize
   */
  async initialize() {
    try {
      await this.loadMemoryData();
      this.isInitialized = true;
      console.log('🧠 MemoryManager initialized');
    } catch (error) {
      console.error('❌ Failed to initialize MemoryManager:', error);
      throw error;
    }
  }

  /**
   * Load memory data
   */
  async loadMemoryData() {
    // Load data from session storage or other persistent storage
    const storedData = sessionStorage.getItem('genome_memory_data');
    if (storedData) {
      try {
        const data = JSON.parse(storedData);
        await this.importData(data);
        console.log('🧠 Memory data loaded from session storage');
      } catch (e) {
        console.warn('Failed to load memory data from session storage, starting fresh.');
        // Optionally, clear session storage or handle error
      }
    }
  }

  /**
   * Save memory data
   */
  async saveMemoryData() {
    const memoryData = {
      shortTerm: this.memorySystem.shortTermMemory.toolCallHistory,
      mediumTerm: Object.fromEntries(this.memorySystem.mediumTermMemory.userPreferences),
      longTerm: Object.fromEntries(this.memorySystem.longTermMemory.knowledgeBase),
      semantic: Object.fromEntries(this.memorySystem.semanticMemory.conceptGraph),
    };

    sessionStorage.setItem('genome_memory_data', JSON.stringify(memoryData));
    console.log('🧠 Memory data saved to session storage');
  }

  /**
   * Cleanup memory
   */
  async cleanup() {
    // Clear short-term memory
    this.memorySystem.shortTermMemory.clear();

    // Save other memory layers
    await this.saveMemoryData();
  }

  /**
   * Export data
   */
  async exportData() {
    return {
      shortTerm: this.memorySystem.shortTermMemory.toolCallHistory,
      mediumTerm: Object.fromEntries(this.memorySystem.mediumTermMemory.userPreferences),
      longTerm: Object.fromEntries(this.memorySystem.longTermMemory.knowledgeBase),
      semantic: Object.fromEntries(this.memorySystem.semanticMemory.conceptGraph),
    };
  }

  /**
   * Import data
   */
  async importData(data) {
    if (data.shortTerm) {
      this.memorySystem.shortTermMemory.toolCallHistory = data.shortTerm;
    }

    if (data.mediumTerm) {
      Object.entries(data.mediumTerm).forEach(([key, value]) => {
        this.memorySystem.mediumTermMemory.userPreferences.set(key, value);
      });
    }

    if (data.longTerm) {
      Object.entries(data.longTerm).forEach(([key, value]) => {
        this.memorySystem.longTermMemory.knowledgeBase.set(key, value);
      });
    }

    if (data.semantic) {
      Object.entries(data.semantic).forEach(([key, value]) => {
        this.memorySystem.semanticMemory.conceptGraph.set(key, value);
      });
    }

    await this.saveMemoryData();
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      shortTerm: this.memorySystem.shortTermMemory.getSessionStats(),
      mediumTerm: Object.fromEntries(this.memorySystem.mediumTermMemory.userPreferences),
      longTerm: Object.fromEntries(this.memorySystem.longTermMemory.knowledgeBase),
      semantic: Object.fromEntries(this.memorySystem.semanticMemory.conceptGraph),
    };
  }
}

/**
 * Memory Optimizer
 */
class MemoryOptimizer {
  constructor(memorySystem) {
    this.memorySystem = memorySystem;
    this.optimizationRules = new Map();
  }

  /**
   * Initialize
   */
  async initialize() {
    this.loadOptimizationRules();
    console.log('🧠 MemoryOptimizer initialized');
  }

  /**
   * Load optimization rules
   */
  loadOptimizationRules() {
    // Performance optimization rules
    this.optimizationRules.set('performance', [
      {
        condition: memoryContext => {
          // Check if shortTermMemory exists and has memory Map
          return (
            this.memorySystem.shortTermMemory &&
            this.memorySystem.shortTermMemory.memory &&
            this.memorySystem.shortTermMemory.memory.size > 100
          );
        },
        action: () => {
          // Clean up old short-term memory using the new implementation
          if (this.memorySystem.shortTermMemory && this.memorySystem.shortTermMemory.cleanup) {
            this.memorySystem.shortTermMemory.cleanup();
          }
        },
      },
    ]);

    // Storage optimization rules
    this.optimizationRules.set('storage', [
      {
        condition: memoryContext => this.memorySystem.longTermMemory.knowledgeBase.size > 1000,
        action: () => {
          // Clean up low-confidence knowledge
          for (const [domain, knowledge] of this.memorySystem.longTermMemory.knowledgeBase) {
            this.memorySystem.longTermMemory.knowledgeBase.set(
              domain,
              knowledge.filter(k => k.confidence > 0.5)
            );
          }
        },
      },
    ]);
  }

  /**
   * Optimize memory
   */
  async optimizeMemory() {
    try {
      const memoryContext = {
        shortTerm: this.memorySystem.shortTermMemory?.getToolUsagePattern?.() || new Map(),
        mediumTerm: this.memorySystem.mediumTermMemory?.userPreferences || new Map(),
        longTerm: this.memorySystem.longTermMemory?.knowledgeBase || new Map(),
        semantic: this.memorySystem.semanticMemory?.conceptGraph || new Map(),
      };

      for (const [category, rules] of this.optimizationRules) {
        for (const rule of rules) {
          try {
            if (rule.condition(memoryContext)) {
              rule.action();
            }
          } catch (error) {
            console.warn(`🧠 MemoryOptimizer rule failed in category ${category}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('🧠 MemoryOptimizer.optimizeMemory failed:', error);
    }
  }

  /**
   * Analyze a single memory entry for optimization
   */
  analyzeMemoryEntry(memoryEntry) {
    try {
      const memoryContext = {
        shortTerm: this.memorySystem.shortTermMemory?.getToolUsagePattern?.() || new Map(),
        mediumTerm: this.memorySystem.mediumTermMemory?.userPreferences || new Map(),
        longTerm: this.memorySystem.longTermMemory?.knowledgeBase || new Map(),
        semantic: this.memorySystem.semanticMemory?.conceptGraph || new Map(),
      };

      for (const [category, rules] of this.optimizationRules) {
        for (const rule of rules) {
          try {
            if (rule.condition(memoryContext)) {
              rule.action();
            }
          } catch (error) {
            console.warn(`🧠 MemoryOptimizer rule failed in category ${category}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('🧠 MemoryOptimizer.analyzeMemoryEntry failed:', error);
    }
  }

  /**
   * Perform background optimization
   */
  performBackgroundOptimization() {
    this.optimizeMemory();
    console.log('🧠 MemoryOptimizer performing background optimization...');
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      optimizationRules: this.optimizationRules.size,
    };
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MemorySystem;
}
