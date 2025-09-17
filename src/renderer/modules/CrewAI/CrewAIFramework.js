/**
 * CrewAI-inspired Multi-Agent Framework for JavaScript
 * Provides structured agent roles, goals, and collaborative workflows
 */

/**
 * Base Agent class inspired by CrewAI
 */
class CrewAgent {
    constructor(config) {
        this.role = config.role;
        this.goal = config.goal;
        this.backstory = config.backstory;
        this.tools = config.tools || [];
        this.llm = config.llm;
        this.maxIter = config.maxIter || 15;
        this.memory = config.memory !== false; // Default true
        this.verbose = config.verbose || false;
        this.allowDelegation = config.allowDelegation !== false; // Default true
        this.stepCallback = config.stepCallback;
        
        // Internal state
        this.context = new Map();
        this.executionHistory = [];
        this.collaborationMemory = new Map();
        
        console.log(`🤖 CrewAgent ${this.role} initialized`);
    }
    
    /**
     * Execute a task with the agent's role and tools
     */
    async execute(task, context = {}) {
        const startTime = Date.now();
        const executionId = this.generateExecutionId();
        
        try {
            // Store execution context
            this.context.set(executionId, {
                task,
                context,
                startTime,
                role: this.role
            });
            
            // Generate agent response using role-based prompting
            const response = await this.processTask(task, context);
            
            // Record execution
            const executionTime = Date.now() - startTime;
            this.recordExecution(executionId, task, response, executionTime, true);
            
            return {
                success: true,
                result: response,
                agent: this.role,
                executionTime,
                executionId
            };
            
        } catch (error) {
            const executionTime = Date.now() - startTime;
            this.recordExecution(executionId, task, null, executionTime, false, error);
            
            return {
                success: false,
                error: error.message,
                agent: this.role,
                executionTime,
                executionId
            };
        }
    }
    
    /**
     * Process task with role-based context
     */
    async processTask(task, context) {
        // Build role-based prompt
        const prompt = this.buildRolePrompt(task, context);
        
        // Execute available tools if needed
        const toolResults = await this.executeTools(task, context);
        
        // Combine tool results with agent reasoning
        return this.synthesizeResponse(prompt, toolResults, context);
    }
    
    /**
     * Build role-specific prompt
     */
    buildRolePrompt(task, context) {
        return `
Role: ${this.role}
Goal: ${this.goal}
Backstory: ${this.backstory}

Task: ${task.description || task}
Context: ${JSON.stringify(context, null, 2)}

Previous executions: ${this.getRelevantHistory(task)}

Please provide a response based on your role and expertise.
        `.trim();
    }
    
    /**
     * Execute available tools
     */
    async executeTools(task, context) {
        const results = [];
        
        for (const tool of this.tools) {
            if (this.shouldUseTool(tool, task, context)) {
                try {
                    const result = await this.executeTool(tool, task, context);
                    results.push({
                        tool: tool.name,
                        result,
                        success: true
                    });
                } catch (error) {
                    results.push({
                        tool: tool.name,
                        error: error.message,
                        success: false
                    });
                }
            }
        }
        
        return results;
    }
    
    /**
     * Determine if tool should be used
     */
    shouldUseTool(tool, task, context) {
        // Simple heuristic - can be enhanced with LLM decision making
        if (tool.condition) {
            return tool.condition(task, context);
        }
        
        // Default: use tool if task mentions tool's domain
        const taskText = (task.description || task).toLowerCase();
        const toolKeywords = tool.keywords || [tool.name.toLowerCase()];
        
        return toolKeywords.some(keyword => taskText.includes(keyword));
    }
    
    /**
     * Execute a specific tool
     */
    async executeTool(tool, task, context) {
        if (typeof tool.execute === 'function') {
            return await tool.execute(task, context);
        } else if (typeof tool === 'function') {
            return await tool(task, context);
        } else {
            throw new Error(`Tool ${tool.name} is not executable`);
        }
    }
    
    /**
     * Synthesize response from prompt and tool results
     */
    async synthesizeResponse(prompt, toolResults, context) {
        // If LLM is available, use it for synthesis
        if (this.llm && typeof this.llm.generate === 'function') {
            const enhancedPrompt = `
${prompt}

Tool execution results:
${toolResults.map(r => `- ${r.tool}: ${r.success ? r.result : 'Error: ' + r.error}`).join('\n')}

Synthesize a comprehensive response based on your role and the tool results.
            `.trim();
            
            return await this.llm.generate(enhancedPrompt);
        }
        
        // Fallback: structured response without LLM
        return {
            analysis: `As a ${this.role}, I've analyzed the task and executed relevant tools.`,
            toolResults: toolResults.filter(r => r.success),
            recommendations: this.generateRecommendations(toolResults, context),
            nextSteps: this.suggestNextSteps(toolResults, context)
        };
    }
    
    /**
     * Generate recommendations based on tool results
     */
    generateRecommendations(toolResults, context) {
        const recommendations = [];
        
        // Role-specific recommendations
        switch (this.role.toLowerCase()) {
            case 'data analyst':
                recommendations.push('Review data quality and completeness');
                if (toolResults.some(r => r.tool.includes('sequence'))) {
                    recommendations.push('Consider sequence alignment validation');
                }
                break;
            case 'researcher':
                recommendations.push('Cross-reference findings with literature');
                recommendations.push('Document methodology for reproducibility');
                break;
            case 'coordinator':
                recommendations.push('Ensure all team members have necessary context');
                recommendations.push('Plan follow-up tasks based on results');
                break;
        }
        
        return recommendations;
    }
    
    /**
     * Suggest next steps
     */
    suggestNextSteps(toolResults, context) {
        const steps = [];
        
        // Base next steps on successful tool executions
        toolResults.filter(r => r.success).forEach(result => {
            if (result.tool.includes('search')) {
                steps.push('Analyze search results for relevant patterns');
            } else if (result.tool.includes('analyze')) {
                steps.push('Validate analysis results with additional methods');
            } else if (result.tool.includes('fetch')) {
                steps.push('Process fetched data for further analysis');
            }
        });
        
        if (steps.length === 0) {
            steps.push('Review task requirements and retry with different approach');
        }
        
        return steps;
    }
    
    /**
     * Record execution history
     */
    recordExecution(executionId, task, result, executionTime, success, error = null) {
        const record = {
            executionId,
            timestamp: Date.now(),
            task: task.description || task,
            result,
            executionTime,
            success,
            error: error?.message,
            role: this.role
        };
        
        this.executionHistory.push(record);
        
        // Keep only recent history
        if (this.executionHistory.length > 100) {
            this.executionHistory = this.executionHistory.slice(-100);
        }
        
        // Update collaboration memory
        this.updateCollaborationMemory(record);
    }
    
    /**
     * Update collaboration memory for future interactions
     */
    updateCollaborationMemory(record) {
        const taskType = this.classifyTask(record.task);
        const memory = this.collaborationMemory.get(taskType) || {
            executions: 0,
            successRate: 0,
            averageTime: 0,
            patterns: []
        };
        
        memory.executions++;
        memory.successRate = (memory.successRate * (memory.executions - 1) + (record.success ? 1 : 0)) / memory.executions;
        memory.averageTime = (memory.averageTime * (memory.executions - 1) + record.executionTime) / memory.executions;
        memory.patterns.push({
            task: record.task,
            success: record.success,
            timestamp: record.timestamp
        });
        
        // Keep recent patterns
        if (memory.patterns.length > 20) {
            memory.patterns = memory.patterns.slice(-20);
        }
        
        this.collaborationMemory.set(taskType, memory);
    }
    
    /**
     * Classify task type for memory organization
     */
    classifyTask(task) {
        const taskLower = task.toLowerCase();
        
        if (taskLower.includes('search') || taskLower.includes('find')) return 'search';
        if (taskLower.includes('analyze') || taskLower.includes('analysis')) return 'analysis';
        if (taskLower.includes('navigate') || taskLower.includes('position')) return 'navigation';
        if (taskLower.includes('sequence') || taskLower.includes('dna') || taskLower.includes('protein')) return 'sequence';
        if (taskLower.includes('external') || taskLower.includes('api') || taskLower.includes('blast')) return 'external';
        if (taskLower.includes('plugin') || taskLower.includes('extension')) return 'plugin';
        
        return 'general';
    }
    
    /**
     * Get relevant execution history for context
     */
    getRelevantHistory(task) {
        const taskType = this.classifyTask(task.description || task);
        const memory = this.collaborationMemory.get(taskType);
        
        if (!memory) return 'No previous executions of this type';
        
        return `Previous ${taskType} tasks: ${memory.executions}, Success rate: ${(memory.successRate * 100).toFixed(1)}%, Average time: ${memory.averageTime.toFixed(0)}ms`;
    }
    
    /**
     * Delegate task to another agent
     */
    async delegateTask(task, targetAgent, reason) {
        if (!this.allowDelegation) {
            throw new Error('Delegation not allowed for this agent');
        }
        
        console.log(`🔄 ${this.role} delegating task to ${targetAgent.role}: ${reason}`);
        
        const delegationContext = {
            delegatedBy: this.role,
            reason,
            originalContext: task.context || {}
        };
        
        return await targetAgent.execute(task, delegationContext);
    }
    
    /**
     * Collaborate with other agents
     */
    async collaborate(task, agents, collaborationType = 'sequential') {
        console.log(`🤝 ${this.role} starting ${collaborationType} collaboration with ${agents.length} agents`);
        
        switch (collaborationType) {
            case 'sequential':
                return await this.sequentialCollaboration(task, agents);
            case 'parallel':
                return await this.parallelCollaboration(task, agents);
            case 'hierarchical':
                return await this.hierarchicalCollaboration(task, agents);
            default:
                throw new Error(`Unknown collaboration type: ${collaborationType}`);
        }
    }
    
    /**
     * Sequential collaboration pattern
     */
    async sequentialCollaboration(task, agents) {
        const results = [];
        let currentContext = task.context || {};
        
        // Execute with each agent in sequence
        for (const agent of agents) {
            const result = await agent.execute(task, {
                ...currentContext,
                previousResults: results,
                collaborationType: 'sequential'
            });
            
            results.push(result);
            
            // Pass successful results to next agent
            if (result.success) {
                currentContext = {
                    ...currentContext,
                    [`${agent.role}_result`]: result.result
                };
            }
        }
        
        return {
            collaborationType: 'sequential',
            results,
            finalContext: currentContext,
            success: results.some(r => r.success)
        };
    }
    
    /**
     * Parallel collaboration pattern
     */
    async parallelCollaboration(task, agents) {
        console.log(`⚡ Running parallel collaboration with ${agents.length} agents`);
        
        const promises = agents.map(agent => 
            agent.execute(task, {
                ...(task.context || {}),
                collaborationType: 'parallel'
            })
        );
        
        const results = await Promise.allSettled(promises);
        
        return {
            collaborationType: 'parallel',
            results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason.message }),
            success: results.some(r => r.status === 'fulfilled' && r.value.success)
        };
    }
    
    /**
     * Hierarchical collaboration pattern
     */
    async hierarchicalCollaboration(task, agents) {
        // This agent acts as coordinator
        const results = [];
        
        // Decompose task for subordinate agents
        const subtasks = this.decomposeTask(task, agents);
        
        // Execute subtasks
        for (const subtask of subtasks) {
            const result = await subtask.agent.execute(subtask.task, {
                ...(task.context || {}),
                coordinator: this.role,
                collaborationType: 'hierarchical'
            });
            
            results.push({
                subtask: subtask.id,
                agent: subtask.agent.role,
                result
            });
        }
        
        // Synthesize results
        const synthesizedResult = await this.synthesizeCollaborationResults(results, task);
        
        return {
            collaborationType: 'hierarchical',
            coordinator: this.role,
            subtasks: results,
            synthesizedResult,
            success: results.some(r => r.result.success)
        };
    }
    
    /**
     * Decompose task for hierarchical collaboration
     */
    decomposeTask(task, agents) {
        const subtasks = [];
        const taskText = task.description || task;
        
        // Simple task decomposition based on agent roles
        agents.forEach((agent, index) => {
            subtasks.push({
                id: `subtask_${index}`,
                agent,
                task: {
                    description: `${agent.role} perspective on: ${taskText}`,
                    context: task.context
                }
            });
        });
        
        return subtasks;
    }
    
    /**
     * Synthesize results from collaboration
     */
    async synthesizeCollaborationResults(results, originalTask) {
        const successfulResults = results.filter(r => r.result.success);
        
        if (successfulResults.length === 0) {
            return {
                synthesis: 'No successful results to synthesize',
                recommendations: ['Review task requirements', 'Try alternative approaches']
            };
        }
        
        const synthesis = {
            summary: `Collaboration completed with ${successfulResults.length}/${results.length} successful executions`,
            insights: successfulResults.map(r => ({
                agent: r.agent,
                contribution: r.result.result
            })),
            combinedRecommendations: this.combineRecommendations(successfulResults),
            nextSteps: this.synthesizeNextSteps(successfulResults)
        };
        
        return synthesis;
    }
    
    /**
     * Combine recommendations from multiple agents
     */
    combineRecommendations(results) {
        const allRecommendations = [];
        
        results.forEach(result => {
            if (result.result.result && result.result.result.recommendations) {
                allRecommendations.push(...result.result.result.recommendations);
            }
        });
        
        // Remove duplicates and prioritize
        return [...new Set(allRecommendations)].slice(0, 5);
    }
    
    /**
     * Synthesize next steps from multiple agents
     */
    synthesizeNextSteps(results) {
        const allSteps = [];
        
        results.forEach(result => {
            if (result.result.result && result.result.result.nextSteps) {
                allSteps.push(...result.result.result.nextSteps);
            }
        });
        
        return [...new Set(allSteps)].slice(0, 3);
    }
    
    /**
     * Legacy compatibility: canExecute method for old MultiAgentSystem
     */
    canExecute(functionName, parameters) {
        // Check if any of our tools can handle this function
        const canHandle = this.tools.some(tool => {
            if (tool.condition) {
                return tool.condition({ description: functionName }, {});
            }
            
            // Check tool keywords
            if (tool.keywords) {
                return tool.keywords.some(keyword => 
                    functionName.toLowerCase().includes(keyword.toLowerCase())
                );
            }
            
            // Default: check if tool name matches
            return tool.name === functionName;
        });
        
        return {
            canExecute: canHandle,
            estimatedTime: 5000,
            priority: 'normal',
            reason: canHandle ? 'Agent has relevant tools' : 'No matching tools'
        };
    }

    /**
     * Generate unique execution ID
     */
    generateExecutionId() {
        return `${this.role.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    }
    
    /**
     * Get agent statistics
     */
    getStatistics() {
        const totalExecutions = this.executionHistory.length;
        const successfulExecutions = this.executionHistory.filter(h => h.success).length;
        const averageExecutionTime = totalExecutions > 0 ? 
            this.executionHistory.reduce((sum, h) => sum + h.executionTime, 0) / totalExecutions : 0;
        
        return {
            role: this.role,
            totalExecutions,
            successfulExecutions,
            successRate: totalExecutions > 0 ? successfulExecutions / totalExecutions : 0,
            averageExecutionTime,
            collaborationMemorySize: this.collaborationMemory.size,
            availableTools: this.tools.length
        };
    }
}

/**
 * Crew class for managing multiple agents
 */
class Crew {
    constructor(config) {
        this.agents = config.agents || [];
        this.tasks = config.tasks || [];
        this.process = config.process || 'sequential'; // sequential, hierarchical, parallel
        this.verbose = config.verbose !== false;
        this.memory = config.memory !== false;
        this.cache = config.cache !== false;
        this.maxRpm = config.maxRpm || 100;
        this.shareCrewState = config.shareCrewState !== false;
        
        // Crew state
        this.crewState = new Map();
        this.executionHistory = [];
        this.collaborationGraph = new Map();
        
        console.log(`🚢 Crew initialized with ${this.agents.length} agents, process: ${this.process}`);
    }
    
    /**
     * Execute the crew workflow
     */
    async kickoff(inputs = {}) {
        const startTime = Date.now();
        const crewExecutionId = this.generateCrewExecutionId();
        
        try {
            console.log(`🚀 Crew kickoff started with ${this.tasks.length} tasks`);
            
            // Initialize crew state
            this.crewState.set('executionId', crewExecutionId);
            this.crewState.set('inputs', inputs);
            this.crewState.set('startTime', startTime);
            
            // Execute based on process type
            let results;
            switch (this.process) {
                case 'sequential':
                    results = await this.executeSequential(inputs);
                    break;
                case 'hierarchical':
                    results = await this.executeHierarchical(inputs);
                    break;
                case 'parallel':
                    results = await this.executeParallel(inputs);
                    break;
                default:
                    throw new Error(`Unknown process type: ${this.process}`);
            }
            
            const executionTime = Date.now() - startTime;
            
            // Record crew execution
            const crewResult = {
                executionId: crewExecutionId,
                process: this.process,
                results,
                executionTime,
                success: results.success,
                timestamp: Date.now()
            };
            
            this.executionHistory.push(crewResult);
            
            console.log(`✅ Crew execution completed in ${executionTime}ms`);
            return crewResult;
            
        } catch (error) {
            const executionTime = Date.now() - startTime;
            console.error(`❌ Crew execution failed after ${executionTime}ms:`, error);
            
            return {
                executionId: crewExecutionId,
                process: this.process,
                success: false,
                error: error.message,
                executionTime,
                timestamp: Date.now()
            };
        }
    }
    
    /**
     * Execute tasks sequentially
     */
    async executeSequential(inputs) {
        const results = [];
        let currentContext = { ...inputs };
        
        for (let i = 0; i < this.tasks.length; i++) {
            const task = this.tasks[i];
            const agent = this.selectAgentForTask(task, i);
            
            console.log(`📝 Task ${i + 1}: ${task.description} (Agent: ${agent.role})`);
            
            const result = await agent.execute(task, {
                ...currentContext,
                taskIndex: i,
                crewState: this.shareCrewState ? Object.fromEntries(this.crewState) : {},
                previousResults: results
            });
            
            results.push({
                taskIndex: i,
                task: task.description,
                agent: agent.role,
                result
            });
            
            // Update context with successful results
            if (result.success) {
                currentContext[`task_${i}_result`] = result.result;
                
                // Update crew state
                if (this.shareCrewState) {
                    this.crewState.set(`task_${i}_result`, result.result);
                }
            }
        }
        
        return {
            process: 'sequential',
            results,
            finalContext: currentContext,
            success: results.every(r => r.result.success)
        };
    }
    
    /**
     * Execute tasks hierarchically
     */
    async executeHierarchical(inputs) {
        // First agent acts as coordinator
        if (this.agents.length === 0) {
            throw new Error('No agents available for hierarchical execution');
        }
        
        const coordinator = this.agents[0];
        const subordinates = this.agents.slice(1);
        
        console.log(`👑 Hierarchical execution with coordinator: ${coordinator.role}`);
        
        const results = [];
        
        for (let i = 0; i < this.tasks.length; i++) {
            const task = this.tasks[i];
            
            // Coordinator delegates to subordinates
            const collaborationResult = await coordinator.collaborate(
                task, 
                subordinates, 
                'hierarchical'
            );
            
            results.push({
                taskIndex: i,
                task: task.description,
                coordinator: coordinator.role,
                collaborationResult
            });
            
            // Update crew state
            if (this.shareCrewState && collaborationResult.success) {
                this.crewState.set(`task_${i}_result`, collaborationResult.synthesizedResult);
            }
        }
        
        return {
            process: 'hierarchical',
            coordinator: coordinator.role,
            results,
            success: results.some(r => r.collaborationResult.success)
        };
    }
    
    /**
     * Execute tasks in parallel
     */
    async executeParallel(inputs) {
        console.log(`⚡ Parallel execution of ${this.tasks.length} tasks`);
        
        const taskPromises = this.tasks.map(async (task, index) => {
            const agent = this.selectAgentForTask(task, index);
            
            const result = await agent.execute(task, {
                ...inputs,
                taskIndex: index,
                crewState: this.shareCrewState ? Object.fromEntries(this.crewState) : {}
            });
            
            return {
                taskIndex: index,
                task: task.description,
                agent: agent.role,
                result
            };
        });
        
        const results = await Promise.allSettled(taskPromises);
        
        const processedResults = results.map(r => 
            r.status === 'fulfilled' ? r.value : {
                success: false,
                error: r.reason.message
            }
        );
        
        return {
            process: 'parallel',
            results: processedResults,
            success: processedResults.some(r => r.result && r.result.success)
        };
    }
    
    /**
     * Select appropriate agent for task
     */
    selectAgentForTask(task, taskIndex) {
        // If task specifies an agent, use it
        if (task.agent) {
            const specifiedAgent = this.agents.find(a => a.role === task.agent);
            if (specifiedAgent) return specifiedAgent;
        }
        
        // Round-robin assignment if no specific agent
        return this.agents[taskIndex % this.agents.length];
    }
    
    /**
     * Add agent to crew
     */
    addAgent(agent) {
        this.agents.push(agent);
        console.log(`➕ Added agent ${agent.role} to crew (total: ${this.agents.length})`);
    }
    
    /**
     * Remove agent from crew
     */
    removeAgent(role) {
        const index = this.agents.findIndex(a => a.role === role);
        if (index > -1) {
            this.agents.splice(index, 1);
            console.log(`➖ Removed agent ${role} from crew (remaining: ${this.agents.length})`);
        }
    }
    
    /**
     * Add task to crew
     */
    addTask(task) {
        this.tasks.push(task);
        console.log(`📋 Added task to crew (total: ${this.tasks.length})`);
    }
    
    /**
     * Get crew statistics
     */
    getStatistics() {
        const totalExecutions = this.executionHistory.length;
        const successfulExecutions = this.executionHistory.filter(h => h.success).length;
        
        return {
            totalAgents: this.agents.length,
            totalTasks: this.tasks.length,
            process: this.process,
            totalExecutions,
            successfulExecutions,
            successRate: totalExecutions > 0 ? successfulExecutions / totalExecutions : 0,
            agentStatistics: this.agents.map(agent => agent.getStatistics())
        };
    }
    
    /**
     * Generate unique crew execution ID
     */
    generateCrewExecutionId() {
        return `crew_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    }
}

// Export classes
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CrewAgent, Crew };
} else {
    console.log('🔧 Exporting CrewAI Framework classes to window object...');
    try {
        window.CrewAgent = CrewAgent;
        window.Crew = Crew;
        console.log('✅ CrewAI Framework classes exported successfully');
    } catch (error) {
        console.error('❌ Error exporting CrewAI Framework classes:', error);
    }
}