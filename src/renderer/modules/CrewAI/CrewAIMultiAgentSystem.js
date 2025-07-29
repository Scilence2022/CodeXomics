/**
 * CrewAI-Enhanced Multi-Agent System
 * Integrates CrewAI framework with existing Genome AI Studio architecture
 */

/**
 * CrewAI Multi-Agent System Manager
 * Replaces the original MultiAgentSystem with CrewAI-based architecture
 */
class CrewAIMultiAgentSystem {
    constructor(chatManager, configManager) {
        this.chatManager = chatManager;
        this.configManager = configManager;
        this.app = chatManager.app;
        
        // CrewAI components
        this.crews = new Map();
        this.agents = new Map();
        this.activeTasks = new Map();
        
        // System state
        this.isInitialized = false;
        this.systemMetrics = new Map();
        this.executionHistory = [];
        
        // Performance tracking
        this.performanceMonitor = new PerformanceMonitor();
        
        console.log('🚢 CrewAI Multi-Agent System initializing...');
        this.initialize();
    }
    
    /**
     * Initialize the CrewAI multi-agent system
     */
    async initialize() {
        try {
            // Initialize specialized genomics agents
            await this.initializeGenomicsAgents();
            
            // Create predefined crews for common workflows
            await this.createPredefinedCrews();
            
            // Setup performance monitoring
            this.setupPerformanceMonitoring();
            
            // Setup communication protocols
            this.setupCommunicationProtocols();
            
            this.isInitialized = true;
            console.log('✅ CrewAI Multi-Agent System initialized successfully');
            
            // Emit initialization event
            this.emitEvent('crew-system-initialized', {
                agentCount: this.agents.size,
                crewCount: this.crews.size
            });
            
        } catch (error) {
            console.error('❌ CrewAI Multi-Agent System initialization failed:', error);
            throw error;
        }
    }
    
    /**
     * Initialize specialized genomics agents
     */
    async initializeGenomicsAgents() {
        try {
            // Load agent classes
            const {
                GenomicsDataAnalyst,
                BioinformaticsResearcher,
                GenomeNavigator,
                QualityController,
                ProjectCoordinator
            } = await this.loadAgentClasses();
            
            // Create agent instances
            const agents = [
                { name: 'DataAnalyst', class: GenomicsDataAnalyst },
                { name: 'Researcher', class: BioinformaticsResearcher },
                { name: 'Navigator', class: GenomeNavigator },
                { name: 'QualityController', class: QualityController },
                { name: 'Coordinator', class: ProjectCoordinator }
            ];
            
            for (const agentConfig of agents) {
                const agent = new agentConfig.class(this.app, {
                    verbose: this.configManager?.get('agents.verbose', false)
                });
                
                this.agents.set(agentConfig.name, agent);
                console.log(`✅ Initialized agent: ${agent.role}`);
            }
            
            console.log(`🤖 Initialized ${this.agents.size} genomics agents`);
            
        } catch (error) {
            console.error('❌ Failed to initialize genomics agents:', error);
            throw error;
        }
    }
    
    /**
     * Load agent classes dynamically
     */
    async loadAgentClasses() {
        // In browser environment, classes are already loaded via script tags
        if (typeof window !== 'undefined') {
            return {
                GenomicsDataAnalyst: window.GenomicsDataAnalyst,
                BioinformaticsResearcher: window.BioinformaticsResearcher,
                GenomeNavigator: window.GenomeNavigator,
                QualityController: window.QualityController,
                ProjectCoordinator: window.ProjectCoordinator
            };
        }
        
        // In Node.js environment
        return require('./GenomicsCrewAgents');
    }
    
    /**
     * Create predefined crews for common genomics workflows
     */
    async createPredefinedCrews() {
        try {
            // General Analysis Crew
            const analysisAgents = [
                this.agents.get('DataAnalyst'),
                this.agents.get('QualityController'),
                this.agents.get('Navigator')
            ];
            
            const analysisCrew = new Crew({
                agents: analysisAgents,
                process: 'sequential',
                verbose: true,
                memory: true
            });
            
            this.crews.set('GeneralAnalysis', analysisCrew);
            
            // Research Crew
            const researchAgents = [
                this.agents.get('Researcher'),
                this.agents.get('DataAnalyst'),
                this.agents.get('QualityController')
            ];
            
            const researchCrew = new Crew({
                agents: researchAgents,
                process: 'parallel',
                verbose: true,
                memory: true
            });
            
            this.crews.set('Research', researchCrew);
            
            // Comprehensive Analysis Crew (Hierarchical)
            const comprehensiveAgents = [
                this.agents.get('Coordinator'), // Leader
                this.agents.get('DataAnalyst'),
                this.agents.get('Researcher'),
                this.agents.get('Navigator'),
                this.agents.get('QualityController')
            ];
            
            const comprehensiveCrew = new Crew({
                agents: comprehensiveAgents,
                process: 'hierarchical',
                verbose: true,
                memory: true,
                shareCrewState: true
            });
            
            this.crews.set('Comprehensive', comprehensiveCrew);
            
            console.log(`🚢 Created ${this.crews.size} predefined crews`);
            
        } catch (error) {
            console.error('❌ Failed to create predefined crews:', error);
            throw error;
        }
    }
    
    /**
     * Execute function using CrewAI system
     */
    async executeFunction(functionName, parameters, context = {}) {
        const startTime = performance.now();
        const executionId = this.generateExecutionId();
        
        try {
            console.log(`🚀 CrewAI executing function: ${functionName}`);
            
            // Determine optimal crew and strategy
            const executionPlan = this.planExecution(functionName, parameters, context);
            
            // Execute using selected crew
            const result = await this.executeWithCrew(executionPlan, executionId);
            
            // Record execution metrics
            const executionTime = performance.now() - startTime;
            this.recordExecution(executionId, functionName, parameters, result, executionTime, true);
            
            return {
                success: true,
                result: result.results || result,
                metadata: {
                    executionId,
                    crew: executionPlan.crew,
                    strategy: executionPlan.strategy,
                    executionTime,
                    timestamp: Date.now()
                }
            };
            
        } catch (error) {
            const executionTime = performance.now() - startTime;
            this.recordExecution(executionId, functionName, parameters, null, executionTime, false, error);
            
            console.error(`❌ CrewAI execution failed for ${functionName}:`, error);
            throw error;
        }
    }
    
    /**
     * Plan execution strategy based on function and parameters
     */
    planExecution(functionName, parameters, context) {
        const plan = {
            crew: 'GeneralAnalysis',
            strategy: 'sequential',
            tasks: [],
            estimatedTime: 30000,
            confidence: 0.8
        };
        
        // Function-specific planning
        switch (functionName) {
            case 'search_features':
            case 'get_nearby_features':
                plan.crew = 'GeneralAnalysis';
                plan.tasks = [
                    { description: `Search for features: ${parameters.query || parameters.chromosome}`, agent: 'DataAnalyst' },
                    { description: 'Validate search results', agent: 'QualityController' },
                    { description: 'Navigate to relevant regions', agent: 'Navigator' }
                ];
                break;
                
            case 'batch_blast_search':
            case 'advanced_blast_search':
                plan.crew = 'Research';
                plan.strategy = 'parallel';
                plan.estimatedTime = 120000; // 2 minutes
                plan.tasks = [
                    { description: 'Execute BLAST search', agent: 'Researcher' },
                    { description: 'Analyze BLAST results', agent: 'DataAnalyst' },
                    { description: 'Validate result quality', agent: 'QualityController' }
                ];
                break;
                
            case 'fetch_protein_structure':
            case 'search_protein_by_gene':
                plan.crew = 'Research';
                plan.tasks = [
                    { description: 'Fetch protein information', agent: 'Researcher' },
                    { description: 'Validate protein data', agent: 'QualityController' }
                ];
                break;
                
            case 'navigate_to_position':
            case 'get_current_state':
                plan.crew = 'GeneralAnalysis';
                plan.tasks = [
                    { description: 'Navigate to position', agent: 'Navigator' },
                    { description: 'Analyze region content', agent: 'DataAnalyst' }
                ];
                break;
                
            default:
                // Complex multi-step tasks use comprehensive crew
                if (this.isComplexTask(functionName, parameters)) {
                    plan.crew = 'Comprehensive';
                    plan.strategy = 'hierarchical';
                    plan.estimatedTime = 90000; // 1.5 minutes
                    plan.tasks = [
                        { description: `Coordinate execution of ${functionName}`, agent: 'Coordinator' }
                    ];
                }
                break;
        }
        
        // Adjust plan based on context
        if (context.urgent) {
            plan.strategy = 'parallel';
            plan.estimatedTime *= 0.7;
        }
        
        if (context.thorough) {
            plan.crew = 'Comprehensive';
            plan.strategy = 'hierarchical';
            plan.estimatedTime *= 1.5;
        }
        
        console.log(`📋 Execution plan: ${plan.crew} crew, ${plan.strategy} strategy, ~${plan.estimatedTime}ms`);
        return plan;
    }
    
    /**
     * Execute with selected crew
     */
    async executeWithCrew(executionPlan, executionId) {
        const crew = this.crews.get(executionPlan.crew);
        if (!crew) {
            throw new Error(`Crew not found: ${executionPlan.crew}`);
        }
        
        // Update crew tasks
        crew.tasks = executionPlan.tasks.map((task, index) => ({
            id: `task_${index}`,
            description: task.description,
            agent: task.agent,
            ...task
        }));
        
        // Update crew process if needed
        if (crew.process !== executionPlan.strategy) {
            crew.process = executionPlan.strategy;
        }
        
        // Track active task
        this.activeTasks.set(executionId, {
            crew: executionPlan.crew,
            startTime: Date.now(),
            status: 'running'
        });
        
        try {
            // Execute crew workflow
            const result = await crew.kickoff({
                executionId,
                timestamp: Date.now()
            });
            
            // Update task status
            this.activeTasks.set(executionId, {
                ...this.activeTasks.get(executionId),
                status: 'completed',
                endTime: Date.now()
            });
            
            return result;
            
        } catch (error) {
            // Update task status
            this.activeTasks.set(executionId, {
                ...this.activeTasks.get(executionId),
                status: 'failed',
                error: error.message,
                endTime: Date.now()
            });
            
            throw error;
        }
    }
    
    /**
     * Determine if task is complex
     */
    isComplexTask(functionName, parameters) {
        const complexPatterns = [
            'analyze_',
            'compare_',
            'build_',
            'generate_',
            'compute_'
        ];
        
        return complexPatterns.some(pattern => functionName.includes(pattern)) ||
               (parameters && Object.keys(parameters).length > 5);
    }
    
    /**
     * Setup performance monitoring
     */
    setupPerformanceMonitoring() {
        // Monitor crew performance
        setInterval(() => {
            this.updateSystemMetrics();
        }, 10000); // Every 10 seconds
        
        // Clean up old tasks
        setInterval(() => {
            this.cleanupOldTasks();
        }, 60000); // Every minute
        
        console.log('📊 Performance monitoring activated');
    }
    
    /**
     * Setup communication protocols
     */
    setupCommunicationProtocols() {
        // Listen for agent collaboration events
        if (typeof window !== 'undefined') {
            window.addEventListener('agent-collaboration', (event) => {
                this.handleAgentCollaboration(event.detail);
            });
        }
        
        console.log('📡 Communication protocols established');
    }
    
    /**
     * Handle agent collaboration events
     */
    handleAgentCollaboration(collaborationData) {
        console.log('🤝 Agent collaboration detected:', collaborationData);
        
        // Update collaboration metrics
        const collaborationKey = `${collaborationData.initiator}-${collaborationData.collaborator}`;
        const metrics = this.systemMetrics.get(collaborationKey) || { count: 0, successRate: 0 };
        
        metrics.count++;
        if (collaborationData.success) {
            metrics.successRate = (metrics.successRate * (metrics.count - 1) + 1) / metrics.count;
        } else {
            metrics.successRate = (metrics.successRate * (metrics.count - 1)) / metrics.count;
        }
        
        this.systemMetrics.set(collaborationKey, metrics);
    }
    
    /**
     * Update system metrics
     */
    updateSystemMetrics() {
        const metrics = {
            timestamp: Date.now(),
            activeCrews: Array.from(this.crews.keys()),
            activeTasks: this.activeTasks.size,
            systemLoad: this.calculateSystemLoad(),
            averageExecutionTime: this.calculateAverageExecutionTime(),
            successRate: this.calculateSuccessRate()
        };
        
        this.systemMetrics.set('system', metrics);
        
        // Emit metrics event
        this.emitEvent('system-metrics-updated', metrics);
    }
    
    /**
     * Calculate system load
     */
    calculateSystemLoad() {
        const activeTasks = Array.from(this.activeTasks.values())
            .filter(task => task.status === 'running');
        
        return {
            runningTasks: activeTasks.length,
            load: Math.min(activeTasks.length / 5, 1.0), // Normalize to 0-1
            status: activeTasks.length > 3 ? 'high' : activeTasks.length > 1 ? 'medium' : 'low'
        };
    }
    
    /**
     * Calculate average execution time
     */
    calculateAverageExecutionTime() {
        const recentExecutions = this.executionHistory.slice(-50); // Last 50 executions
        if (recentExecutions.length === 0) return 0;
        
        const totalTime = recentExecutions.reduce((sum, exec) => sum + exec.executionTime, 0);
        return totalTime / recentExecutions.length;
    }
    
    /**
     * Calculate success rate
     */
    calculateSuccessRate() {
        const recentExecutions = this.executionHistory.slice(-100); // Last 100 executions
        if (recentExecutions.length === 0) return 1.0;
        
        const successfulExecutions = recentExecutions.filter(exec => exec.success).length;
        return successfulExecutions / recentExecutions.length;
    }
    
    /**
     * Record execution details
     */
    recordExecution(executionId, functionName, parameters, result, executionTime, success, error = null) {
        const record = {
            executionId,
            functionName,
            parameters,
            result,
            executionTime,
            success,
            error: error?.message,
            timestamp: Date.now()
        };
        
        this.executionHistory.push(record);
        
        // Keep only recent history
        if (this.executionHistory.length > 500) {
            this.executionHistory = this.executionHistory.slice(-500);
        }
        
        // Update performance monitor
        this.performanceMonitor.recordExecution(record);
    }
    
    /**
     * Clean up old tasks
     */
    cleanupOldTasks() {
        const now = Date.now();
        const maxAge = 3600000; // 1 hour
        
        for (const [taskId, task] of this.activeTasks) {
            if (task.endTime && (now - task.endTime) > maxAge) {
                this.activeTasks.delete(taskId);
            }
        }
    }
    
    /**
     * Get specific agent
     */
    getAgent(agentName) {
        return this.agents.get(agentName);
    }
    
    /**
     * Get specific crew
     */
    getCrew(crewName) {
        return this.crews.get(crewName);
    }
    
    /**
     * Create custom crew
     */
    createCustomCrew(name, agentNames, process = 'sequential', config = {}) {
        const agents = agentNames.map(name => this.agents.get(name)).filter(Boolean);
        
        if (agents.length === 0) {
            throw new Error('No valid agents specified for crew');
        }
        
        const crew = new Crew({
            agents,
            process,
            verbose: config.verbose !== false,
            memory: config.memory !== false,
            ...config
        });
        
        this.crews.set(name, crew);
        console.log(`🚢 Created custom crew: ${name} with ${agents.length} agents`);
        
        return crew;
    }
    
    /**
     * Execute with custom crew
     */
    async executeWithCustomCrew(crewName, tasks, inputs = {}) {
        const crew = this.crews.get(crewName);
        if (!crew) {
            throw new Error(`Crew not found: ${crewName}`);
        }
        
        crew.tasks = tasks;
        return await crew.kickoff(inputs);
    }
    
    /**
     * Get system statistics
     */
    getSystemStats() {
        return {
            isInitialized: this.isInitialized,
            agentCount: this.agents.size,
            crewCount: this.crews.size,
            activeTasks: this.activeTasks.size,
            totalExecutions: this.executionHistory.length,
            systemMetrics: Object.fromEntries(this.systemMetrics),
            performanceStats: this.performanceMonitor.getStats()
        };
    }
    
    /**
     * Get agent for specific tool (compatibility with old system)
     */
    getAgentForTool(toolName) {
        // Map tool names to appropriate agents
        const toolAgentMap = {
            'search_features': 'DataAnalyst',
            'get_nearby_features': 'DataAnalyst',
            'navigate_to_position': 'Navigator',
            'batch_blast_search': 'Researcher',
            'fetch_protein_structure': 'Researcher',
            'get_current_state': 'Navigator',
            'get_sequence': 'DataAnalyst',
            'toggle_track': 'Navigator',
            'get_gene_details': 'DataAnalyst',
            'analyze_region': 'DataAnalyst',
            'create_annotation': 'DataAnalyst',
            'export_data': 'DataAnalyst',
            'zoom_in': 'Navigator',
            'zoom_out': 'Navigator',
            'scroll_left': 'Navigator',
            'scroll_right': 'Navigator'
        };
        
        const agentName = toolAgentMap[toolName] || 'DataAnalyst';
        const agent = this.agents.get(agentName);
        
        if (agent) {
            return {
                name: agentName,
                role: agent.role,
                capability: { canExecute: true, estimatedTime: 5000 },
                score: 100
            };
        }
        
        return null;
    }
    
    /**
     * Emit system events
     */
    emitEvent(eventType, data) {
        if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent(eventType, { detail: data }));
        }
        
        console.log(`📡 Event emitted: ${eventType}`, data);
    }
    
    /**
     * Generate unique execution ID
     */
    generateExecutionId() {
        return `crewai_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    }
    
    /**
     * Shutdown the system
     */
    async shutdown() {
        console.log('🔄 Shutting down CrewAI Multi-Agent System...');
        
        // Stop all active tasks
        for (const [taskId, task] of this.activeTasks) {
            if (task.status === 'running') {
                task.status = 'terminated';
                task.endTime = Date.now();
            }
        }
        
        // Clear data
        this.activeTasks.clear();
        this.systemMetrics.clear();
        
        this.isInitialized = false;
        console.log('✅ CrewAI Multi-Agent System shutdown complete');
    }
}

/**
 * Performance Monitor for CrewAI system
 */
class PerformanceMonitor {
    constructor() {
        this.executionStats = new Map();
        this.agentStats = new Map();
        this.crewStats = new Map();
    }
    
    recordExecution(record) {
        // Record function-level stats
        const funcStats = this.executionStats.get(record.functionName) || {
            totalExecutions: 0,
            successfulExecutions: 0,
            totalTime: 0,
            averageTime: 0,
            successRate: 0
        };
        
        funcStats.totalExecutions++;
        funcStats.totalTime += record.executionTime;
        funcStats.averageTime = funcStats.totalTime / funcStats.totalExecutions;
        
        if (record.success) {
            funcStats.successfulExecutions++;
        }
        
        funcStats.successRate = funcStats.successfulExecutions / funcStats.totalExecutions;
        
        this.executionStats.set(record.functionName, funcStats);
    }
    
    getStats() {
        return {
            executionStats: Object.fromEntries(this.executionStats),
            agentStats: Object.fromEntries(this.agentStats),
            crewStats: Object.fromEntries(this.crewStats)
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CrewAIMultiAgentSystem, PerformanceMonitor };
} else {
    window.CrewAIMultiAgentSystem = CrewAIMultiAgentSystem;
    window.PerformanceMonitor = PerformanceMonitor;
}