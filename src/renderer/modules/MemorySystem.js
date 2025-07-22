/**
 * Memory System for Genome AI Studio
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
            optimizationEvents: 0
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
            
            console.log('✅ MemorySystem initialized successfully');
            
        } catch (error) {
            console.error('❌ MemorySystem initialization failed:', error);
            throw error;
        }
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
            success: !result.error,
            memoryType: this.determineMemoryType(functionName, parameters, result)
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
     * Retrieve memory context for function execution
     */
    async retrieveMemoryContext(functionName, parameters, context = {}) {
        const startTime = performance.now();
        
        try {
            // Search across all memory layers
            const shortTermResults = await this.shortTermMemory.search(functionName, parameters);
            const mediumTermResults = await this.mediumTermMemory.search(functionName, parameters);
            const longTermResults = await this.longTermMemory.search(functionName, parameters);
            const semanticResults = await this.semanticMemory.search(functionName, parameters);
            
            // Combine and rank results
            const allResults = [
                ...shortTermResults.map(r => ({ ...r, layer: 'short', priority: 1.0 })),
                ...mediumTermResults.map(r => ({ ...r, layer: 'medium', priority: 0.8 })),
                ...longTermResults.map(r => ({ ...r, layer: 'long', priority: 0.6 })),
                ...semanticResults.map(r => ({ ...r, layer: 'semantic', priority: 0.4 }))
            ];
            
            // Rank by relevance and recency
            const rankedResults = this.rankMemoryResults(allResults, functionName, parameters, context);
            
            // Update metrics
            this.memoryMetrics.memoryAccesses++;
            if (rankedResults.length > 0) {
                this.memoryMetrics.cacheHits++;
            } else {
                this.memoryMetrics.cacheMisses++;
            }
            
            const searchTime = performance.now() - startTime;
            console.log(`🧠 Memory search completed in ${searchTime.toFixed(2)}ms, found ${rankedResults.length} results`);
            
            return {
                results: rankedResults,
                searchTime,
                context: this.buildMemoryContext(rankedResults, context)
            };
            
        } catch (error) {
            console.error('❌ Memory context retrieval failed:', error);
            return {
                results: [],
                searchTime: performance.now() - startTime,
                context: context,
                error: error.message
            };
        }
    }
    
    /**
     * Optimize parameters based on memory insights
     */
    async optimizeParameters(functionName, parameters, context = {}) {
        try {
            // Get memory context
            const memoryContext = await this.retrieveMemoryContext(functionName, parameters, context);
            
            // Apply parameter optimization rules
            const optimizedParams = await this.memoryOptimizer.optimizeParameters(
                functionName, 
                parameters, 
                memoryContext
            );
            
            // Apply context-based optimizations
            const contextOptimizedParams = await this.applyContextOptimizations(
                functionName,
                optimizedParams,
                memoryContext
            );
            
            console.log(`🧠 Parameter optimization applied to ${functionName}`);
            
            return {
                original: parameters,
                optimized: contextOptimizedParams,
                optimizations: this.getOptimizationSummary(parameters, contextOptimizedParams),
                confidence: this.calculateOptimizationConfidence(memoryContext)
            };
            
        } catch (error) {
            console.error('❌ Parameter optimization failed:', error);
            return {
                original: parameters,
                optimized: parameters,
                optimizations: [],
                confidence: 0,
                error: error.message
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
                reasoning: performanceAnalysis.reasoning
            };
            
        } catch (error) {
            console.error('❌ Execution path selection failed:', error);
            // Fallback to default selection
            return {
                agent: availableAgents[0],
                strategy: 'default',
                confidence: 0,
                reasoning: 'Fallback due to error'
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
            sessionId: this.getSessionId()
        };
        
        // Record context switch
        if (previousContext && this.hasContextChanged(previousContext, this.currentContext)) {
            this.memoryMetrics.contextSwitches++;
            this.contextHistory.push({
                from: previousContext,
                to: this.currentContext,
                timestamp: Date.now()
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
                semantic: this.semanticMemory.getStats()
            },
            metrics: this.memoryMetrics,
            context: {
                current: this.currentContext,
                historyLength: this.contextHistory.length,
                patternsCount: this.contextPatterns.size
            },
            optimization: this.memoryOptimizer.getStats()
        };
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
        this.eventBus.addEventListener('memory-optimization', (event) => {
            this.handleMemoryOptimization(event.detail);
        });
        
        // Context change events
        this.eventBus.addEventListener('context-change', (event) => {
            this.handleContextChange(event.detail);
        });
        
        // Performance events
        this.eventBus.addEventListener('performance-alert', (event) => {
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
            averageTime: 0
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
                score: this.calculateRelevanceScore(result, functionName, parameters, context)
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
        const recencyBonus = Math.max(0, 1 - (age / (24 * 60 * 60 * 1000))); // Decay over 24 hours
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
                patterns: this.extractPatterns(results)
            }
        };
        
        if (results.length > 0) {
            const times = results.map(r => r.executionTime).filter(t => t > 0);
            const successes = results.filter(r => r.success);
            
            context.memoryInsights.averageExecutionTime = times.length > 0 ? 
                times.reduce((a, b) => a + b, 0) / times.length : 0;
            context.memoryInsights.successRate = results.length > 0 ? 
                successes.length / results.length : 0;
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
            reasoning: []
        };
        
        // Analyze performance for each agent
        for (const agent of availableAgents) {
            const performance = await this.getAgentPerformance(agent.name, functionName, memoryContext);
            analysis.agentPerformance.set(agent.name, performance);
        }
        
        // Calculate confidence based on data availability
        const totalExecutions = Array.from(analysis.agentPerformance.values())
            .reduce((sum, perf) => sum + perf.executions, 0);
        
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
            priority: 'normal'
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
        return sessionStorage.getItem('genome_session_id') || 
               `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
                description: `Function called ${timeGroups.length} times in recent history`
            });
        }
        
        // Success patterns
        const successRate = results.filter(r => r.success).length / results.length;
        if (successRate > 0.8) {
            patterns.push({
                type: 'success',
                description: `High success rate: ${(successRate * 100).toFixed(1)}%`
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
            if (currentGroup.length === 0 || 
                result.timestamp - currentGroup[currentGroup.length - 1].timestamp < 60000) {
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
            'navigate_to_position', 'get_current_state', 'search_features',
            'get_sequence', 'toggle_track'
        ];
        return highFreqFunctions.includes(functionName);
    }
    
    isComplexAnalysis(functionName) {
        const complexFunctions = [
            'analyze_region', 'compare_regions', 'find_similar_sequences',
            'build_phylogenetic_tree', 'ml_analysis'
        ];
        return complexFunctions.includes(functionName);
    }
    
    isLargeDataset(result) {
        return result && (
            (result.sequences && result.sequences.length > 100) ||
            (result.features && result.features.length > 1000) ||
            (result.data && JSON.stringify(result.data).length > 10000)
        );
    }
    
    isExternalAPI(functionName) {
        const externalFunctions = [
            'blast_search', 'uniprot_search', 'alphafold_search',
            'evo2_generate_sequence', 'interpro_search'
        ];
        return externalFunctions.includes(functionName);
    }
    
    isPatternOrInsight(functionName, result) {
        return functionName.includes('pattern') || 
               functionName.includes('insight') ||
               functionName.includes('analysis') ||
               (result && result.patterns);
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
                    const mostCommon = Object.entries(valueCounts)
                        .sort(([, a], [, b]) => b - a)[0];
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
                apply: (params) => {
                    params.timeout = Math.max(15000, memoryContext.memoryInsights.averageExecutionTime * 2);
                }
            });
        }
        
        // Success rate optimizations
        if (memoryContext.memoryInsights && memoryContext.memoryInsights.successRate < 0.8) {
            optimizations.push({
                condition: () => true,
                apply: (params) => {
                    params.retryCount = 3;
                    params.fallback = true;
                }
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
            lastUsed: 0
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
                strategy: { caching: true }
            });
        }
        
        // Parallelization rules
        if (functionName.includes('batch') || functionName.includes('multiple')) {
            rules.push({
                condition: () => true,
                strategy: { parallelization: true }
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
                    type: 'default' // or 'context', 'performance', etc.
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
        
        return (dataPoints * 0.3 + successRate * 0.4 + recency * 0.3);
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
     * Update user preferences
     */
    updateUserPreferences(toolName, parameters, success) {
        if (!this.userPreferences.has(toolName)) {
            this.userPreferences.set(toolName, {
                preferredParameters: new Map(),
                successRate: 0,
                usageCount: 0,
                lastUsed: null
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
            const maxValue = Array.from(valueCounts.entries())
                .reduce((a, b) => a[1] > b[1] ? a : b)[0];
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
                lastUsed: null
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
                    successRate: workflow.successRate
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
        for (const [key, workflow] of this.workflowPatterns) {
            if (workflow.pattern.tools.includes(functionName)) {
                results.push({
                    ...workflow,
                    score: this.calculateRelevanceScore(workflow, functionName, parameters)
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
        const recencyBonus = Math.max(0, 1 - (age / (24 * 60 * 60 * 1000))); // Decay over 24 hours
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
     * Get stats
     */
    getStats() {
        return {
            userPreferences: this.userPreferences.size,
            workflowPatterns: this.workflowPatterns.size
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
     * Store knowledge
     */
    storeKnowledge(domain, knowledge) {
        if (!this.knowledgeBase.has(domain)) {
            this.knowledgeBase.set(domain, []);
        }
        this.knowledgeBase.get(domain).push({
            ...knowledge,
            timestamp: Date.now(),
            confidence: knowledge.confidence || 0.8
        });
    }
    
    /**
     * Retrieve knowledge
     */
    async retrieveKnowledge(domain, query) {
        const domainKnowledge = this.knowledgeBase.get(domain) || [];
        return domainKnowledge.filter(k => 
            k.confidence > 0.7 && this.matchesQuery(k, query)
        );
    }
    
    /**
     * Check query match
     */
    matchesQuery(knowledge, query) {
        // Simple string matching, can be extended to more complex semantic matching
        if (typeof query === 'string') {
            return knowledge.functionName === query || 
                   knowledge.parameters?.includes?.(query) ||
                   knowledge.context?.includes?.(query);
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
            accessCount: 0
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
        for (const [domain, knowledge] of this.knowledgeBase) {
            for (const k of knowledge) {
                if (k.functionName === functionName && this.matchesQuery(k, parameters)) {
                    results.push({
                        ...k,
                        score: this.calculateRelevanceScore(k, functionName, parameters)
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
        const recencyBonus = Math.max(0, 1 - (age / (24 * 60 * 60 * 1000))); // Decay over 24 hours
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
     * Get stats
     */
    getStats() {
        return {
            knowledgeBase: this.knowledgeBase.size,
            optimizationRules: this.optimizationRules.size
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
     * Add concept
     */
    addConcept(concept, properties) {
        this.conceptGraph.set(concept, {
            properties,
            relationships: new Set(),
            instances: new Set(),
            timestamp: Date.now()
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
                    score: this.calculateRelevanceScore(concept, functionName, parameters)
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
        const recencyBonus = Math.max(0, 1 - (age / (24 * 60 * 60 * 1000))); // Decay over 24 hours
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
     * Get stats
     */
    getStats() {
        return {
            concepts: this.conceptGraph.size,
            relationships: this.relationshipMap.size
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
            semantic: Object.fromEntries(this.memorySystem.semanticMemory.conceptGraph)
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
            semantic: Object.fromEntries(this.memorySystem.semanticMemory.conceptGraph)
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
            semantic: Object.fromEntries(this.memorySystem.semanticMemory.conceptGraph)
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
                condition: (memoryContext) => memoryContext.shortTermMemory.toolCallHistory.length > 50,
                action: () => {
                    // Clean up old short-term memory
                    this.memorySystem.shortTermMemory.toolCallHistory = 
                        this.memorySystem.shortTermMemory.toolCallHistory.slice(-50);
                }
            }
        ]);
        
        // Storage optimization rules
        this.optimizationRules.set('storage', [
            {
                condition: (memoryContext) => this.memorySystem.longTermMemory.knowledgeBase.size > 1000,
                action: () => {
                    // Clean up low-confidence knowledge
                    for (const [domain, knowledge] of this.memorySystem.longTermMemory.knowledgeBase) {
                        this.memorySystem.longTermMemory.knowledgeBase.set(domain, 
                            knowledge.filter(k => k.confidence > 0.5));
                    }
                }
            }
        ]);
    }
    
    /**
     * Optimize memory
     */
    async optimizeMemory() {
        const memoryContext = {
            shortTerm: this.memorySystem.shortTermMemory.getToolUsagePattern(),
            mediumTerm: this.memorySystem.mediumTermMemory.userPreferences,
            longTerm: this.memorySystem.longTermMemory.knowledgeBase,
            semantic: this.memorySystem.semanticMemory.conceptGraph
        };
        
        for (const [category, rules] of this.optimizationRules) {
            for (const rule of rules) {
                if (rule.condition(memoryContext)) {
                    rule.action();
                }
            }
        }
    }
    
    /**
     * Analyze a single memory entry for optimization
     */
    analyzeMemoryEntry(memoryEntry) {
        const memoryContext = {
            shortTerm: this.memorySystem.shortTermMemory.getToolUsagePattern(),
            mediumTerm: this.memorySystem.mediumTermMemory.userPreferences,
            longTerm: this.memorySystem.longTermMemory.knowledgeBase,
            semantic: this.memorySystem.semanticMemory.conceptGraph
        };
        
        for (const [category, rules] of this.optimizationRules) {
            for (const rule of rules) {
                if (rule.condition(memoryContext)) {
                    rule.action();
                }
            }
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
            optimizationRules: this.optimizationRules.size
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MemorySystem;
} 