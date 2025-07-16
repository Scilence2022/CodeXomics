/**
 * CoordinatorAgent - 协调智能体
 * 负责协调其他智能体的工作，处理复杂任务分解和结果整合
 */
class CoordinatorAgent extends AgentBase {
    constructor(multiAgentSystem) {
        super(multiAgentSystem, 'coordinator', [
            'task_coordination',
            'workflow_management',
            'result_integration',
            'error_recovery'
        ]);
        
        this.app = multiAgentSystem.app;
        this.configManager = multiAgentSystem.configManager;
        this.memorySystem = null;
        this.workflowEngine = null;
    }
    
    /**
     * 执行具体初始化逻辑
     */
    async performInitialization() {
        // 确保应用已初始化
        if (!this.app) {
            throw new Error('Application reference not available');
        }
        
        // 获取记忆系统
        this.memorySystem = this.app.memorySystem;
        
        // 初始化工作流引擎
        this.workflowEngine = new WorkflowEngine(this);
        
        console.log(`🎯 CoordinatorAgent: Coordination tools initialized`);
    }
    
    /**
     * 注册工具映射
     */
    registerToolMapping() {
        // 任务协调工具
        this.toolMapping.set('coordinate_task', this.coordinateTask.bind(this));
        this.toolMapping.set('decompose_task', this.decomposeTask.bind(this));
        this.toolMapping.set('integrate_results', this.integrateResults.bind(this));
        
        // 工作流管理工具
        this.toolMapping.set('create_workflow', this.createWorkflow.bind(this));
        this.toolMapping.set('execute_workflow', this.executeWorkflow.bind(this));
        this.toolMapping.set('get_workflow_status', this.getWorkflowStatus.bind(this));
        
        // 智能体协调工具
        this.toolMapping.set('assign_task_to_agent', this.assignTaskToAgent.bind(this));
        this.toolMapping.set('get_agent_status', this.getAgentStatus.bind(this));
        this.toolMapping.set('balance_load', this.balanceLoad.bind(this));
        
        // 错误恢复工具
        this.toolMapping.set('handle_error', this.handleError.bind(this));
        this.toolMapping.set('retry_failed_task', this.retryFailedTask.bind(this));
        this.toolMapping.set('fallback_strategy', this.fallbackStrategy.bind(this));
        
        // 性能优化工具
        this.toolMapping.set('optimize_execution', this.optimizeExecution.bind(this));
        this.toolMapping.set('cache_strategy', this.cacheStrategy.bind(this));
        this.toolMapping.set('parallel_execution', this.parallelExecution.bind(this));
        
        console.log(`🎯 CoordinatorAgent: Registered ${this.toolMapping.size} coordination tools`);
    }
    
    /**
     * 协调任务
     */
    async coordinateTask(parameters, strategy) {
        try {
            const { task, priority = 'normal', timeout = 30000 } = parameters;
            
            if (!task) {
                throw new Error('Task is required');
            }
            
            // 1. 分析任务
            const taskAnalysis = await this.analyzeTask(task);
            
            // 2. 分解任务
            const subtasks = await this.decomposeTask(taskAnalysis);
            
            // 3. 分配任务给智能体
            const assignments = await this.assignSubtasksToAgents(subtasks);
            
            // 4. 执行任务
            const results = await this.executeSubtasks(assignments, timeout);
            
            // 5. 整合结果
            const integratedResult = await this.integrateResults(results);
            
            // 6. 记录到记忆系统
            if (this.memorySystem) {
                await this.memorySystem.recordToolCall('coordinate_task', parameters, integratedResult, Date.now());
            }
            
            return {
                success: true,
                result: integratedResult,
                taskAnalysis,
                subtasks: subtasks.length,
                executionTime: Date.now()
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * 分解任务
     */
    async decomposeTask(parameters, strategy) {
        try {
            const { task } = parameters;
            
            if (!task) {
                throw new Error('Task is required');
            }
            
            const subtasks = [];
            
            // 基于任务类型分解
            if (task.type === 'sequence_analysis') {
                subtasks.push(
                    { type: 'data_retrieval', agent: 'data', priority: 'high' },
                    { type: 'sequence_processing', agent: 'analysis', priority: 'high' },
                    { type: 'result_formatting', agent: 'data', priority: 'low' }
                );
            } else if (task.type === 'external_search') {
                subtasks.push(
                    { type: 'api_call', agent: 'external', priority: 'high' },
                    { type: 'result_processing', agent: 'analysis', priority: 'medium' },
                    { type: 'data_storage', agent: 'data', priority: 'low' }
                );
            } else if (task.type === 'plugin_execution') {
                subtasks.push(
                    { type: 'plugin_validation', agent: 'plugin', priority: 'high' },
                    { type: 'plugin_execution', agent: 'plugin', priority: 'high' },
                    { type: 'result_integration', agent: 'coordinator', priority: 'medium' }
                );
            } else {
                // 通用任务分解
                subtasks.push(
                    { type: 'task_analysis', agent: 'coordinator', priority: 'high' },
                    { type: 'execution', agent: 'auto', priority: 'high' },
                    { type: 'result_validation', agent: 'coordinator', priority: 'medium' }
                );
            }
            
            return {
                success: true,
                subtasks: subtasks.map((subtask, index) => ({
                    id: `subtask_${index}`,
                    ...subtask,
                    dependencies: this.getDependencies(subtask, subtasks, index)
                }))
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * 整合结果
     */
    async integrateResults(parameters, strategy) {
        try {
            const { results } = parameters;
            
            if (!results || !Array.isArray(results)) {
                throw new Error('Results array is required');
            }
            
            // 按优先级排序结果
            const sortedResults = results.sort((a, b) => b.priority - a.priority);
            
            // 整合结果
            const integratedResult = {
                success: true,
                data: {},
                metadata: {
                    totalResults: results.length,
                    successfulResults: results.filter(r => r.success).length,
                    failedResults: results.filter(r => !r.success).length,
                    integrationTime: Date.now()
                }
            };
            
            // 合并数据
            results.forEach(result => {
                if (result.success && result.data) {
                    Object.assign(integratedResult.data, result.data);
                }
            });
            
            // 处理错误
            const errors = results.filter(r => !r.success).map(r => r.error);
            if (errors.length > 0) {
                integratedResult.warnings = errors;
            }
            
            return {
                success: true,
                integratedResult
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * 创建工作流
     */
    async createWorkflow(parameters, strategy) {
        try {
            const { name, steps, dependencies = [] } = parameters;
            
            if (!name || !steps) {
                throw new Error('Workflow name and steps are required');
            }
            
            const workflow = await this.workflowEngine.createWorkflow(name, steps, dependencies);
            
            return {
                success: true,
                workflow: {
                    id: workflow.id,
                    name: workflow.name,
                    steps: workflow.steps,
                    status: workflow.status
                }
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * 执行工作流
     */
    async executeWorkflow(parameters, strategy) {
        try {
            const { workflowId, parameters: workflowParams = {} } = parameters;
            
            if (!workflowId) {
                throw new Error('Workflow ID is required');
            }
            
            const result = await this.workflowEngine.executeWorkflow(workflowId, workflowParams);
            
            return {
                success: true,
                result: result,
                workflowId
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * 获取工作流状态
     */
    async getWorkflowStatus(parameters, strategy) {
        try {
            const { workflowId } = parameters;
            
            if (!workflowId) {
                throw new Error('Workflow ID is required');
            }
            
            const status = await this.workflowEngine.getWorkflowStatus(workflowId);
            
            return {
                success: true,
                status: status
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * 分配任务给智能体
     */
    async assignTaskToAgent(parameters, strategy) {
        try {
            const { task, agentName, priority = 'normal' } = parameters;
            
            if (!task || !agentName) {
                throw new Error('Task and agent name are required');
            }
            
            const agent = this.multiAgentSystem.getAgent(agentName);
            if (!agent) {
                throw new Error(`Agent not found: ${agentName}`);
            }
            
            const result = await agent.executeFunction(task.type, task.parameters, {
                priority,
                timeout: task.timeout || 15000
            });
            
            return {
                success: true,
                result: result,
                agent: agentName,
                task: task.type
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * 获取智能体状态
     */
    async getAgentStatus(parameters, strategy) {
        try {
            const { agentName } = parameters;
            
            if (!agentName) {
                throw new Error('Agent name is required');
            }
            
            const agent = this.multiAgentSystem.getAgent(agentName);
            if (!agent) {
                throw new Error(`Agent not found: ${agentName}`);
            }
            
            const status = await agent.healthCheck();
            
            return {
                success: true,
                status: status
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * 负载均衡
     */
    async balanceLoad(parameters, strategy) {
        try {
            const { taskType } = parameters;
            
            // 获取所有智能体状态
            const agentStatuses = [];
            for (const [name, agent] of this.multiAgentSystem.getAllAgents()) {
                const status = await agent.healthCheck();
                agentStatuses.push({ name, status });
            }
            
            // 选择负载最低的智能体
            const availableAgents = agentStatuses.filter(agent => 
                agent.status.initialized && agent.status.status === 'ready'
            );
            
            if (availableAgents.length === 0) {
                throw new Error('No available agents');
            }
            
            // 基于任务类型和智能体能力选择
            const bestAgent = this.selectBestAgent(taskType, availableAgents);
            
            return {
                success: true,
                selectedAgent: bestAgent.name,
                reason: bestAgent.reason,
                alternatives: availableAgents.map(a => a.name)
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * 处理错误
     */
    async handleError(parameters, strategy) {
        try {
            const { error, context, retryCount = 0 } = parameters;
            
            if (!error) {
                throw new Error('Error details are required');
            }
            
            // 分析错误类型
            const errorAnalysis = this.analyzeError(error, context);
            
            // 选择恢复策略
            const recoveryStrategy = this.selectRecoveryStrategy(errorAnalysis, retryCount);
            
            // 执行恢复
            const recoveryResult = await this.executeRecoveryStrategy(recoveryStrategy, context);
            
            return {
                success: true,
                errorAnalysis,
                recoveryStrategy: recoveryStrategy.type,
                recoveryResult
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * 重试失败任务
     */
    async retryFailedTask(parameters, strategy) {
        try {
            const { task, maxRetries = 3, backoffDelay = 1000 } = parameters;
            
            if (!task) {
                throw new Error('Task is required');
            }
            
            let lastError = null;
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    const result = await this.executeTask(task);
                    return {
                        success: true,
                        result: result,
                        attempts: attempt
                    };
                } catch (error) {
                    lastError = error;
                    if (attempt < maxRetries) {
                        await this.delay(backoffDelay * attempt);
                    }
                }
            }
            
            throw lastError;
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * 回退策略
     */
    async fallbackStrategy(parameters, strategy) {
        try {
            const { primaryTask, fallbackTasks } = parameters;
            
            if (!primaryTask || !fallbackTasks) {
                throw new Error('Primary task and fallback tasks are required');
            }
            
            // 尝试主要任务
            try {
                const result = await this.executeTask(primaryTask);
                return {
                    success: true,
                    result: result,
                    strategy: 'primary'
                };
            } catch (error) {
                // 尝试回退任务
                for (const fallbackTask of fallbackTasks) {
                    try {
                        const result = await this.executeTask(fallbackTask);
                        return {
                            success: true,
                            result: result,
                            strategy: 'fallback',
                            fallbackTask: fallbackTask.type
                        };
                    } catch (fallbackError) {
                        console.warn(`Fallback task failed: ${fallbackError.message}`);
                    }
                }
                
                throw new Error('All tasks failed');
            }
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * 优化执行
     */
    async optimizeExecution(parameters, strategy) {
        try {
            const { task, optimizationLevel = 'medium' } = parameters;
            
            if (!task) {
                throw new Error('Task is required');
            }
            
            // 获取记忆上下文
            const memoryContext = this.memorySystem ? 
                await this.memorySystem.retrieveMemoryContext(task.type, task.parameters, {}) :
                this.memorySystem.getEmptyMemoryContext();
            
            // 优化参数
            const optimizedParameters = this.memorySystem.optimizeParameters(
                task.type, task.parameters, memoryContext
            );
            
            // 选择执行路径
            const executionPath = this.memorySystem.selectExecutionPath(
                task.type, optimizedParameters, memoryContext
            );
            
            return {
                success: true,
                optimization: {
                    originalParameters: task.parameters,
                    optimizedParameters,
                    executionPath,
                    optimizationLevel
                }
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * 缓存策略
     */
    async cacheStrategy(parameters, strategy) {
        try {
            const { task, cacheKey, ttl = 300000 } = parameters;
            
            if (!task || !cacheKey) {
                throw new Error('Task and cache key are required');
            }
            
            // 检查缓存
            const cachedResult = this.getCachedResult(cacheKey);
            if (cachedResult) {
                return {
                    success: true,
                    result: cachedResult,
                    source: 'cache'
                };
            }
            
            // 执行任务
            const result = await this.executeTask(task);
            
            // 缓存结果
            this.cacheResult(cacheKey, result, ttl);
            
            return {
                success: true,
                result: result,
                source: 'execution'
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * 并行执行
     */
    async parallelExecution(parameters, strategy) {
        try {
            const { tasks, maxConcurrency = 5 } = parameters;
            
            if (!tasks || !Array.isArray(tasks)) {
                throw new Error('Tasks array is required');
            }
            
            // 分组任务
            const taskGroups = this.groupTasksForParallelExecution(tasks, maxConcurrency);
            
            // 并行执行
            const results = [];
            for (const group of taskGroups) {
                const groupResults = await Promise.allSettled(
                    group.map(task => this.executeTask(task))
                );
                results.push(...groupResults);
            }
            
            // 处理结果
            const successfulResults = results
                .filter(r => r.status === 'fulfilled')
                .map(r => r.value);
            
            const failedResults = results
                .filter(r => r.status === 'rejected')
                .map(r => r.reason);
            
            return {
                success: true,
                results: {
                    successful: successfulResults,
                    failed: failedResults,
                    total: results.length,
                    successRate: successfulResults.length / results.length
                }
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    // 辅助方法
    
    /**
     * 分析任务
     */
    async analyzeTask(task) {
        return {
            type: task.type,
            complexity: this.assessComplexity(task),
            requirements: this.extractRequirements(task),
            estimatedTime: this.estimateExecutionTime(task)
        };
    }
    
    /**
     * 评估复杂度
     */
    assessComplexity(task) {
        // 基于任务类型和参数评估复杂度
        const complexityFactors = {
            dataSize: task.parameters?.dataSize || 1,
            operationCount: task.parameters?.operationCount || 1,
            externalCalls: task.type.includes('external') ? 2 : 1
        };
        
        return Object.values(complexityFactors).reduce((sum, factor) => sum + factor, 0);
    }
    
    /**
     * 提取需求
     */
    extractRequirements(task) {
        return {
            agents: this.getRequiredAgents(task),
            resources: this.getRequiredResources(task),
            permissions: this.getRequiredPermissions(task)
        };
    }
    
    /**
     * 估算执行时间
     */
    estimateExecutionTime(task) {
        const baseTime = 1000; // 基础时间1秒
        const complexity = this.assessComplexity(task);
        return baseTime * complexity;
    }
    
    /**
     * 获取依赖关系
     */
    getDependencies(subtask, allSubtasks, currentIndex) {
        const dependencies = [];
        
        // 基于任务类型确定依赖关系
        if (subtask.type === 'result_processing') {
            dependencies.push('data_retrieval');
        } else if (subtask.type === 'result_integration') {
            dependencies.push('execution');
        }
        
        return dependencies;
    }
    
    /**
     * 分配子任务给智能体
     */
    async assignSubtasksToAgents(subtasks) {
        const assignments = [];
        
        for (const subtask of subtasks) {
            const agentName = subtask.agent === 'auto' ? 
                await this.selectBestAgent(subtask.type) : subtask.agent;
            
            assignments.push({
                subtask,
                agent: agentName,
                priority: subtask.priority
            });
        }
        
        return assignments;
    }
    
    /**
     * 执行子任务
     */
    async executeSubtasks(assignments, timeout) {
        const results = [];
        
        for (const assignment of assignments) {
            try {
                const result = await Promise.race([
                    this.assignTaskToAgent({
                        task: assignment.subtask,
                        agentName: assignment.agent,
                        priority: assignment.priority
                    }),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Timeout')), timeout)
                    )
                ]);
                
                results.push(result);
            } catch (error) {
                results.push({
                    success: false,
                    error: error.message,
                    subtask: assignment.subtask.type,
                    agent: assignment.agent
                });
            }
        }
        
        return results;
    }
    
    /**
     * 选择最佳智能体
     */
    selectBestAgent(taskType, availableAgents) {
        // 基于任务类型和智能体能力选择最佳智能体
        const agentCapabilities = {
            'data_retrieval': ['data'],
            'sequence_processing': ['analysis'],
            'api_call': ['external'],
            'plugin_execution': ['plugin'],
            'navigation': ['navigation']
        };
        
        const preferredAgents = agentCapabilities[taskType] || ['coordinator'];
        
        for (const preferredAgent of preferredAgents) {
            const agent = availableAgents.find(a => a.name === preferredAgent);
            if (agent) {
                return { name: agent.name, reason: `Preferred agent for ${taskType}` };
            }
        }
        
        // 如果没有首选智能体，选择负载最低的
        const leastLoadedAgent = availableAgents.reduce((min, agent) => 
            agent.status.performanceStats?.totalExecutions < min.status.performanceStats?.totalExecutions ? agent : min
        );
        
        return { name: leastLoadedAgent.name, reason: 'Least loaded agent' };
    }
    
    /**
     * 分析错误
     */
    analyzeError(error, context) {
        return {
            type: this.classifyError(error),
            severity: this.assessErrorSeverity(error),
            recoverable: this.isErrorRecoverable(error),
            context: context
        };
    }
    
    /**
     * 选择恢复策略
     */
    selectRecoveryStrategy(errorAnalysis, retryCount) {
        if (retryCount >= 3) {
            return { type: 'fallback', action: 'use_alternative_method' };
        }
        
        if (errorAnalysis.recoverable) {
            return { type: 'retry', action: 'retry_with_backoff' };
        }
        
        return { type: 'fallback', action: 'use_alternative_method' };
    }
    
    /**
     * 执行恢复策略
     */
    async executeRecoveryStrategy(strategy, context) {
        switch (strategy.type) {
            case 'retry':
                return await this.retryFailedTask({ task: context.task, maxRetries: 1 });
            case 'fallback':
                return await this.fallbackStrategy({ 
                    primaryTask: context.task, 
                    fallbackTasks: context.fallbackTasks 
                });
            default:
                throw new Error(`Unknown recovery strategy: ${strategy.type}`);
        }
    }
    
    /**
     * 执行任务
     */
    async executeTask(task) {
        const agent = this.multiAgentSystem.getAgent(task.agent);
        if (!agent) {
            throw new Error(`Agent not found: ${task.agent}`);
        }
        
        return await agent.executeFunction(task.type, task.parameters, {});
    }
    
    /**
     * 分组任务用于并行执行
     */
    groupTasksForParallelExecution(tasks, maxConcurrency) {
        const groups = [];
        for (let i = 0; i < tasks.length; i += maxConcurrency) {
            groups.push(tasks.slice(i, i + maxConcurrency));
        }
        return groups;
    }
    
    /**
     * 延迟函数
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * 分类错误
     */
    classifyError(error) {
        if (error.message.includes('timeout')) return 'timeout';
        if (error.message.includes('network')) return 'network';
        if (error.message.includes('permission')) return 'permission';
        if (error.message.includes('not found')) return 'not_found';
        return 'unknown';
    }
    
    /**
     * 评估错误严重性
     */
    assessErrorSeverity(error) {
        if (error.message.includes('critical')) return 'critical';
        if (error.message.includes('fatal')) return 'critical';
        if (error.message.includes('timeout')) return 'medium';
        return 'low';
    }
    
    /**
     * 检查错误是否可恢复
     */
    isErrorRecoverable(error) {
        const nonRecoverableErrors = ['permission', 'not_found', 'invalid_parameter'];
        const errorType = this.classifyError(error);
        return !nonRecoverableErrors.includes(errorType);
    }
}

/**
 * 工作流引擎
 */
class WorkflowEngine {
    constructor(coordinatorAgent) {
        this.coordinatorAgent = coordinatorAgent;
        this.workflows = new Map();
        this.executions = new Map();
    }
    
    /**
     * 创建工作流
     */
    async createWorkflow(name, steps, dependencies) {
        const workflowId = `workflow_${Date.now()}`;
        const workflow = {
            id: workflowId,
            name,
            steps,
            dependencies,
            status: 'created',
            createdAt: Date.now()
        };
        
        this.workflows.set(workflowId, workflow);
        return workflow;
    }
    
    /**
     * 执行工作流
     */
    async executeWorkflow(workflowId, parameters) {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) {
            throw new Error(`Workflow not found: ${workflowId}`);
        }
        
        const executionId = `exec_${Date.now()}`;
        const execution = {
            id: executionId,
            workflowId,
            status: 'running',
            startTime: Date.now(),
            results: []
        };
        
        this.executions.set(executionId, execution);
        
        try {
            // 按依赖关系排序步骤
            const sortedSteps = this.topologicalSort(workflow.steps, workflow.dependencies);
            
            // 执行步骤
            for (const step of sortedSteps) {
                const result = await this.executeStep(step, parameters);
                execution.results.push(result);
            }
            
            execution.status = 'completed';
            execution.endTime = Date.now();
            
            return {
                success: true,
                results: execution.results,
                executionTime: execution.endTime - execution.startTime
            };
            
        } catch (error) {
            execution.status = 'failed';
            execution.error = error.message;
            throw error;
        }
    }
    
    /**
     * 获取工作流状态
     */
    async getWorkflowStatus(workflowId) {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) {
            throw new Error(`Workflow not found: ${workflowId}`);
        }
        
        return {
            id: workflow.id,
            name: workflow.name,
            status: workflow.status,
            steps: workflow.steps.length,
            createdAt: workflow.createdAt
        };
    }
    
    /**
     * 执行步骤
     */
    async executeStep(step, parameters) {
        const stepParameters = { ...parameters, ...step.parameters };
        return await this.coordinatorAgent.executeFunction(step.type, stepParameters, {});
    }
    
    /**
     * 拓扑排序
     */
    topologicalSort(steps, dependencies) {
        // 简单的拓扑排序实现
        const sorted = [];
        const visited = new Set();
        
        const visit = (step) => {
            if (visited.has(step.id)) return;
            visited.add(step.id);
            
            const stepDeps = dependencies.filter(d => d.to === step.id);
            for (const dep of stepDeps) {
                const depStep = steps.find(s => s.id === dep.from);
                if (depStep) visit(depStep);
            }
            
            sorted.push(step);
        };
        
        for (const step of steps) {
            visit(step);
        }
        
        return sorted;
    }
}

// 导出智能体
window.CoordinatorAgent = CoordinatorAgent;
window.WorkflowEngine = WorkflowEngine; 