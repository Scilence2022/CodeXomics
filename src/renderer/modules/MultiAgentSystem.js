/**
 * Multi-Agent System for Genome AI Studio
 * Intelligent coordination of function calling across all subsystems
 */
class MultiAgentSystem {
    constructor(chatManager, configManager) {
        this.chatManager = chatManager;
        this.configManager = configManager;
        this.app = chatManager.app;
        
        // Agent registry
        this.agents = new Map();
        this.agentCapabilities = new Map();
        
        // Communication and coordination
        this.eventBus = new EventTarget();
        this.messageQueue = [];
        this.executionHistory = new Map();
        
        // Performance optimization
        this.cache = new Map();
        this.executionMetrics = new Map();
        this.learningData = new Map();
        
        // System state
        this.isInitialized = false;
        this.activeWorkflows = new Map();
        this.resourceManager = null;
        
        console.log('🤖 MultiAgentSystem initializing...');
        this.initialize();
    }
    
    /**
     * Initialize the multi-agent system
     */
    async initialize() {
        try {
            // Initialize core agents
            await this.initializeAgents();
            
            // Setup communication protocols
            this.setupCommunicationProtocols();
            
            // Initialize resource management
            this.initializeResourceManager();
            
            // Setup performance monitoring
            this.setupPerformanceMonitoring();
            
            this.isInitialized = true;
            console.log('✅ MultiAgentSystem initialized successfully');
            
            // Emit initialization event
            this.eventBus.dispatchEvent(new CustomEvent('system-initialized', {
                detail: { agentCount: this.agents.size }
            }));
            
        } catch (error) {
            console.error('❌ MultiAgentSystem initialization failed:', error);
            throw error;
        }
    }
    
    /**
     * Initialize all agents
     */
    async initializeAgents() {
        // Core function execution agents
        this.registerAgent('NavigationAgent', new NavigationAgent(this));
        this.registerAgent('AnalysisAgent', new AnalysisAgent(this));
        this.registerAgent('DataAgent', new DataAgent(this));
        this.registerAgent('ExternalAgent', new ExternalAgent(this));
        this.registerAgent('PluginAgent', new PluginAgent(this));
        
        // Coordination and optimization agents
        this.registerAgent('CoordinatorAgent', new CoordinatorAgent(this));
        this.registerAgent('MemoryAgent', new MemoryAgent(this));
        this.registerAgent('OptimizationAgent', new OptimizationAgent(this));
        
        // Specialized agents
        this.registerAgent('SequenceAgent', new SequenceAgent(this));
        this.registerAgent('ProteinAgent', new ProteinAgent(this));
        this.registerAgent('NetworkAgent', new NetworkAgent(this));
        
        console.log(`🤖 Registered ${this.agents.size} agents`);
    }
    
    /**
     * Register an agent with the system
     */
    registerAgent(name, agent) {
        this.agents.set(name, agent);
        this.agentCapabilities.set(name, agent.getCapabilities());
        
        // Setup agent event listeners
        agent.on('task-completed', (data) => {
            this.handleAgentTaskCompleted(name, data);
        });
        
        agent.on('task-failed', (data) => {
            this.handleAgentTaskFailed(name, data);
        });
        
        agent.on('resource-request', (data) => {
            this.handleResourceRequest(name, data);
        });
        
        console.log(`🤖 Agent registered: ${name} with ${agent.getCapabilities().length} capabilities`);
    }
    
    /**
     * Setup communication protocols between agents
     */
    setupCommunicationProtocols() {
        // Inter-agent messaging
        this.eventBus.addEventListener('agent-message', (event) => {
            this.routeAgentMessage(event.detail);
        });
        
        // Workflow coordination
        this.eventBus.addEventListener('workflow-step', (event) => {
            this.handleWorkflowStep(event.detail);
        });
        
        // Resource coordination
        this.eventBus.addEventListener('resource-available', (event) => {
            this.handleResourceAvailable(event.detail);
        });
        
        console.log('📡 Communication protocols established');
    }
    
    /**
     * Initialize resource management system
     */
    initializeResourceManager() {
        this.resourceManager = {
            cpu: { available: 100, allocated: 0 },
            memory: { available: 1000, allocated: 0 },
            network: { available: 100, allocated: 0 },
            cache: { available: 500, allocated: 0 }
        };
        
        console.log('📊 Resource manager initialized');
    }
    
    /**
     * Setup performance monitoring
     */
    setupPerformanceMonitoring() {
        // Monitor agent performance
        setInterval(() => {
            this.updatePerformanceMetrics();
        }, 5000);
        
        // Monitor resource usage
        setInterval(() => {
            this.updateResourceMetrics();
        }, 2000);
        
        console.log('📈 Performance monitoring active');
    }
    
    /**
     * Execute function with intelligent agent routing
     */
    async executeFunction(functionName, parameters, context = {}) {
        return await this.executeTool(functionName, parameters, context);
    }
    
    /**
     * Execute tool with intelligent agent routing (alias for executeFunction)
     */
    async executeTool(functionName, parameters, context = {}) {
        const startTime = performance.now();
        const executionId = this.generateExecutionId();
        
        try {
            // Determine optimal agent for execution
            const optimalAgent = this.selectOptimalAgent(functionName, parameters, context);
            
            // Create execution context
            const executionContext = {
                id: executionId,
                functionName,
                parameters,
                context,
                startTime,
                agent: optimalAgent.name,
                priority: this.calculatePriority(functionName, context),
                dependencies: this.analyzeDependencies(functionName, parameters)
            };
            
            // Check cache first
            const cachedResult = this.checkCache(functionName, parameters);
            if (cachedResult) {
                console.log(`⚡ Cache hit for ${functionName}`);
                return this.wrapResult(cachedResult, executionContext, performance.now() - startTime);
            }
            
            // Execute through optimal agent
            const result = await optimalAgent.executeFunction(functionName, parameters, executionContext);
            
            // Cache result if appropriate
            this.cacheResult(functionName, parameters, result);
            
            // Update execution metrics
            this.updateExecutionMetrics(executionContext, performance.now() - startTime, true);
            
            return this.wrapResult(result, executionContext, performance.now() - startTime);
            
        } catch (error) {
            // Handle execution failure
            this.handleExecutionFailure(executionId, functionName, error);
            throw error;
        }
    }
    
    /**
     * Select optimal agent for function execution
     */
    selectOptimalAgent(functionName, parameters, context) {
        const candidates = [];
        
        // Evaluate each agent's capability
        for (const [agentName, agent] of this.agents) {
            const capability = agent.canExecute(functionName, parameters);
            if (capability.canExecute) {
                const score = this.calculateAgentScore(agentName, functionName, context);
                candidates.push({
                    agent,
                    name: agentName,
                    capability,
                    score
                });
            }
        }
        
        // Sort by score and select best
        candidates.sort((a, b) => b.score - a.score);
        
        if (candidates.length === 0) {
            throw new Error(`No agent can execute function: ${functionName}`);
        }
        
        console.log(`🤖 Selected agent ${candidates[0].name} for ${functionName} (score: ${candidates[0].score})`);
        return candidates[0];
    }
    
    /**
     * Calculate agent selection score
     */
    calculateAgentScore(agentName, functionName, context) {
        let score = 0;
        
        // Historical performance
        const performance = this.executionMetrics.get(`${agentName}:${functionName}`);
        if (performance) {
            score += (1 / performance.averageTime) * 1000; // Faster is better
            score += performance.successRate * 100; // Higher success rate is better
        }
        
        // Current resource availability
        const agent = this.agents.get(agentName);
        if (agent) {
            const resourceScore = agent.getResourceAvailability();
            score += resourceScore * 50;
        }
        
        // Context relevance
        const contextScore = this.calculateContextRelevance(agentName, context);
        score += contextScore * 200;
        
        // Specialization bonus
        if (this.isSpecializedAgent(agentName, functionName)) {
            score += 100;
        }
        
        return score;
    }
    
    /**
     * Calculate priority for function execution
     */
    calculatePriority(functionName, context) {
        let priority = 5; // Default medium priority
        
        // High priority functions
        const highPriorityFunctions = [
            'navigate_to_position', 'get_current_state', 'search_features',
            'get_sequence', 'toggle_track'
        ];
        
        if (highPriorityFunctions.includes(functionName)) {
            priority = 1;
        }
        
        // Low priority functions
        const lowPriorityFunctions = [
            'batch_blast_search', 'advanced_blast_search', 'evo2_generate_sequence',
            'build_phylogenetic_tree'
        ];
        
        if (lowPriorityFunctions.includes(functionName)) {
            priority = 9;
        }
        
        // Context-based priority adjustment
        if (context.urgent) priority -= 2;
        if (context.background) priority += 2;
        
        return Math.max(1, Math.min(10, priority));
    }
    
    /**
     * Analyze function dependencies
     */
    analyzeDependencies(functionName, parameters) {
        const dependencies = [];
        
        // Check for data dependencies
        if (parameters.chromosome && parameters.start && parameters.end) {
            dependencies.push({
                type: 'sequence_data',
                resource: `${parameters.chromosome}:${parameters.start}-${parameters.end}`,
                required: true
            });
        }
        
        // Check for external service dependencies
        if (functionName.includes('blast') || functionName.includes('evo2')) {
            dependencies.push({
                type: 'external_service',
                service: functionName.split('_')[0],
                required: true
            });
        }
        
        return dependencies;
    }
    
    /**
     * Check cache for function result
     */
    checkCache(functionName, parameters) {
        const cacheKey = this.generateCacheKey(functionName, parameters);
        const cached = this.cache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < cached.ttl) {
            return cached.result;
        }
        
        return null;
    }
    
    /**
     * Cache function result
     */
    cacheResult(functionName, parameters, result) {
        const cacheKey = this.generateCacheKey(functionName, parameters);
        const ttl = this.calculateCacheTTL(functionName);
        
        this.cache.set(cacheKey, {
            result,
            timestamp: Date.now(),
            ttl
        });
        
        // Clean old cache entries
        this.cleanCache();
    }
    
    /**
     * Generate cache key
     */
    generateCacheKey(functionName, parameters) {
        return `${functionName}:${JSON.stringify(parameters)}`;
    }
    
    /**
     * Calculate cache TTL based on function type
     */
    calculateCacheTTL(functionName) {
        // Short TTL for dynamic data
        if (functionName.includes('get_current') || functionName.includes('navigate')) {
            return 30000; // 30 seconds
        }
        
        // Medium TTL for analysis results
        if (functionName.includes('analyze') || functionName.includes('compute')) {
            return 300000; // 5 minutes
        }
        
        // Long TTL for static data
        if (functionName.includes('get_sequence') || functionName.includes('get_gene')) {
            return 3600000; // 1 hour
        }
        
        return 600000; // Default 10 minutes
    }
    
    /**
     * Clean old cache entries
     */
    cleanCache() {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > value.ttl) {
                this.cache.delete(key);
            }
        }
    }
    
    /**
     * Wrap execution result with metadata
     */
    wrapResult(result, context, executionTime) {
        return {
            success: true,
            result,
            metadata: {
                executionId: context.id,
                agent: context.agent,
                executionTime,
                timestamp: Date.now(),
                cacheHit: false
            }
        };
    }
    
    /**
     * Handle execution failure
     */
    handleExecutionFailure(executionId, functionName, error) {
        console.error(`❌ Function execution failed: ${functionName}`, error);
        
        // Update failure metrics
        this.updateExecutionMetrics({
            id: executionId,
            functionName,
            agent: 'unknown'
        }, 0, false);
        
        // Notify agents of failure
        this.eventBus.dispatchEvent(new CustomEvent('execution-failed', {
            detail: { executionId, functionName, error: error.message }
        }));
    }
    
    /**
     * Update execution metrics
     */
    updateExecutionMetrics(context, executionTime, success) {
        const key = `${context.agent}:${context.functionName}`;
        const metrics = this.executionMetrics.get(key) || {
            totalExecutions: 0,
            successfulExecutions: 0,
            failedExecutions: 0,
            totalTime: 0,
            averageTime: 0,
            successRate: 0
        };
        
        metrics.totalExecutions++;
        metrics.totalTime += executionTime;
        metrics.averageTime = metrics.totalTime / metrics.totalExecutions;
        
        if (success) {
            metrics.successfulExecutions++;
        } else {
            metrics.failedExecutions++;
        }
        
        metrics.successRate = metrics.successfulExecutions / metrics.totalExecutions;
        
        this.executionMetrics.set(key, metrics);
    }
    
    /**
     * Update performance metrics
     */
    updatePerformanceMetrics() {
        const metrics = {
            totalAgents: this.agents.size,
            activeWorkflows: this.activeWorkflows.size,
            cacheSize: this.cache.size,
            averageExecutionTime: 0,
            successRate: 0
        };
        
        // Calculate averages
        let totalTime = 0;
        let totalExecutions = 0;
        let totalSuccess = 0;
        
        for (const [, agentMetrics] of this.executionMetrics) {
            totalTime += agentMetrics.totalTime;
            totalExecutions += agentMetrics.totalExecutions;
            totalSuccess += agentMetrics.successfulExecutions;
        }
        
        if (totalExecutions > 0) {
            metrics.averageExecutionTime = totalTime / totalExecutions;
            metrics.successRate = totalSuccess / totalExecutions;
        }
        
        // Emit metrics event
        this.eventBus.dispatchEvent(new CustomEvent('performance-metrics', {
            detail: metrics
        }));
    }
    
    /**
     * Update resource metrics
     */
    updateResourceMetrics() {
        // Calculate current resource usage
        let totalAllocated = {
            cpu: 0,
            memory: 0,
            network: 0,
            cache: 0
        };
        
        for (const [, agent] of this.agents) {
            const usage = agent.getResourceUsage();
            totalAllocated.cpu += usage.cpu || 0;
            totalAllocated.memory += usage.memory || 0;
            totalAllocated.network += usage.network || 0;
            totalAllocated.cache += usage.cache || 0;
        }
        
        this.resourceManager.allocated = totalAllocated;
        
        // Emit resource event
        this.eventBus.dispatchEvent(new CustomEvent('resource-update', {
            detail: this.resourceManager
        }));
    }
    
    /**
     * Handle agent task completion
     */
    handleAgentTaskCompleted(agentName, data) {
        console.log(`✅ Agent ${agentName} completed task:`, data);
        
        // Update learning data
        this.updateLearningData(agentName, data);
        
        // Notify other agents if needed
        this.eventBus.dispatchEvent(new CustomEvent('task-completed', {
            detail: { agent: agentName, ...data }
        }));
    }
    
    /**
     * Handle agent task failure
     */
    handleAgentTaskFailed(agentName, data) {
        console.error(`❌ Agent ${agentName} failed task:`, data);
        
        // Update failure metrics
        this.updateExecutionMetrics({
            agent: agentName,
            functionName: data.functionName
        }, 0, false);
        
        // Attempt recovery or fallback
        this.handleTaskFailure(agentName, data);
    }
    
    /**
     * Handle resource requests
     */
    handleResourceRequest(agentName, data) {
        const { resourceType, amount } = data;
        
        if (this.resourceManager[resourceType].allocated + amount <= this.resourceManager[resourceType].available) {
            this.resourceManager[resourceType].allocated += amount;
            
            // Notify agent of resource allocation
            const agent = this.agents.get(agentName);
            if (agent) {
                agent.onResourceAllocated(resourceType, amount);
            }
        } else {
            // Resource not available
            const agent = this.agents.get(agentName);
            if (agent) {
                agent.onResourceDenied(resourceType, amount);
            }
        }
    }
    
    /**
     * Handle resource availability
     */
    handleResourceAvailable(data) {
        const { resourceType, amount } = data;
        this.resourceManager[resourceType].allocated = Math.max(0, this.resourceManager[resourceType].allocated - amount);
    }
    
    /**
     * Update learning data for agent optimization
     */
    updateLearningData(agentName, data) {
        const key = `${agentName}:${data.functionName}`;
        const learning = this.learningData.get(key) || {
            executions: 0,
            successRate: 0,
            averageTime: 0,
            patterns: []
        };
        
        learning.executions++;
        learning.patterns.push({
            timestamp: Date.now(),
            parameters: data.parameters,
            executionTime: data.executionTime,
            success: data.success
        });
        
        // Keep only recent patterns
        if (learning.patterns.length > 100) {
            learning.patterns = learning.patterns.slice(-100);
        }
        
        this.learningData.set(key, learning);
    }
    
    /**
     * Handle task failure with recovery strategies
     */
    handleTaskFailure(agentName, data) {
        // Try alternative agent
        const alternativeAgent = this.findAlternativeAgent(data.functionName);
        if (alternativeAgent) {
            console.log(`🔄 Retrying with alternative agent: ${alternativeAgent.name}`);
            alternativeAgent.executeFunction(data.functionName, data.parameters, data.context);
        } else {
            // Fallback to basic execution
            console.log(`🔄 Falling back to basic execution for: ${data.functionName}`);
            this.fallbackExecution(data.functionName, data.parameters);
        }
    }
    
    /**
     * Find alternative agent for function execution
     */
    findAlternativeAgent(functionName) {
        const candidates = [];
        
        for (const [agentName, agent] of this.agents) {
            if (agent.canExecute(functionName, {}).canExecute) {
                const metrics = this.executionMetrics.get(`${agentName}:${functionName}`);
                if (metrics && metrics.successRate > 0.8) {
                    candidates.push({ agent, name: agentName, score: metrics.successRate });
                }
            }
        }
        
        candidates.sort((a, b) => b.score - a.score);
        return candidates[0];
    }
    
    /**
     * Fallback execution for failed functions
     */
    async fallbackExecution(functionName, parameters) {
        try {
            // Try direct execution through ChatManager
            const result = await this.chatManager.executeToolByName(functionName, parameters);
            console.log(`✅ Fallback execution successful for: ${functionName}`);
            return result;
        } catch (error) {
            console.error(`❌ Fallback execution failed for: ${functionName}`, error);
            throw error;
        }
    }
    
    /**
     * Generate unique execution ID
     */
    generateExecutionId() {
        return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Calculate context relevance for agent selection
     */
    calculateContextRelevance(agentName, context) {
        let relevance = 0;
        
        // Check if agent has handled similar context
        const learning = Array.from(this.learningData.entries())
            .filter(([key]) => key.startsWith(agentName))
            .map(([, data]) => data);
        
        for (const data of learning) {
            for (const pattern of data.patterns) {
                if (this.contextSimilarity(context, pattern.parameters) > 0.7) {
                    relevance += pattern.success ? 1 : -0.5;
                }
            }
        }
        
        return Math.max(0, relevance);
    }
    
    /**
     * Calculate context similarity
     */
    contextSimilarity(context1, context2) {
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
     * Check if agent is specialized for function
     */
    isSpecializedAgent(agentName, functionName) {
        const specializations = {
            'SequenceAgent': ['get_sequence', 'translate_dna', 'reverse_complement', 'find_orfs'],
            'ProteinAgent': ['fetch_protein_structure', 'search_protein_by_gene', 'open_protein_viewer'],
            'NetworkAgent': ['build_protein_interaction_network', 'analyze_network_centrality'],
            'AnalysisAgent': ['analyze_region', 'compare_regions', 'find_similar_sequences'],
            'DataAgent': ['get_gene_details', 'get_operons', 'create_annotation']
        };
        
        return specializations[agentName]?.includes(functionName) || false;
    }
    
    /**
     * Get agent information for a specific tool
     */
    getAgentForTool(toolName) {
        const candidates = [];
        
        // Evaluate each agent's capability
        for (const [agentName, agent] of this.agents) {
            const capability = agent.canExecute(toolName, {});
            if (capability.canExecute) {
                const score = this.calculateAgentScore(agentName, toolName, {});
                candidates.push({
                    agent,
                    name: agentName,
                    capability,
                    score
                });
            }
        }
        
        // Sort by score and return best match
        candidates.sort((a, b) => b.score - a.score);
        
        if (candidates.length === 0) {
            return null;
        }
        
        return {
            name: candidates[0].name,
            score: candidates[0].score,
            capability: candidates[0].capability
        };
    }
    
    /**
     * Get system statistics
     */
    getSystemStats() {
        return {
            agents: this.agents.size,
            activeWorkflows: this.activeWorkflows.size,
            cacheSize: this.cache.size,
            executionMetrics: Object.fromEntries(this.executionMetrics),
            resourceUsage: this.resourceManager,
            isInitialized: this.isInitialized
        };
    }
    
    /**
     * Shutdown the multi-agent system
     */
    async shutdown() {
        console.log('🔄 Shutting down MultiAgentSystem...');
        
        // Stop all agents
        for (const [, agent] of this.agents) {
            await agent.shutdown();
        }
        
        // Clear caches
        this.cache.clear();
        this.executionMetrics.clear();
        this.learningData.clear();
        
        this.isInitialized = false;
        console.log('✅ MultiAgentSystem shutdown complete');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MultiAgentSystem;
} 
window.ExecutionOptimizer = ExecutionOptimizer; 