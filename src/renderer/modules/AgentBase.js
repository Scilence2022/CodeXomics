/**
 * AgentBase - 智能体基类
 * 定义所有智能体的通用接口和行为
 */
class AgentBase {
    constructor(multiAgentSystem, name, capabilities = []) {
        this.multiAgentSystem = multiAgentSystem;
        this.name = name;
        this.capabilities = capabilities;
        this.communicationProtocol = null;
        this.eventBus = null;
        this.isInitialized = false;
        this.status = 'created';
        
        // 性能统计
        this.performanceStats = {
            totalExecutions: 0,
            successfulExecutions: 0,
            failedExecutions: 0,
            averageExecutionTime: 0,
            totalExecutionTime: 0
        };
        
        // 工具映射
        this.toolMapping = new Map();
        
        // 缓存
        this.cache = new Map();
        
        console.log(`🤖 Agent ${name} created`);
    }
    
    /**
     * 设置通信协议
     */
    setCommunicationProtocol(protocol) {
        this.communicationProtocol = protocol;
    }
    
    /**
     * 设置事件总线
     */
    setEventBus(eventBus) {
        this.eventBus = eventBus;
    }
    
    /**
     * 初始化智能体
     */
    async initialize() {
        try {
            this.status = 'initializing';
            console.log(`🚀 Initializing agent: ${this.name}`);
            
            // 子类实现具体初始化逻辑
            await this.performInitialization();
            
            // 注册工具映射
            this.registerToolMapping();
            
            this.isInitialized = true;
            this.status = 'ready';
            console.log(`✅ Agent ${this.name} initialized successfully`);
            
        } catch (error) {
            this.status = 'error';
            console.error(`❌ Failed to initialize agent ${this.name}:`, error);
            throw error;
        }
    }
    
    /**
     * 执行具体初始化逻辑（子类实现）
     */
    async performInitialization() {
        // 子类重写此方法
    }
    
    /**
     * 注册工具映射（子类实现）
     */
    registerToolMapping() {
        // 子类重写此方法
    }
    
    /**
     * 执行函数
     */
    async executeFunction(toolName, parameters, strategy) {
        if (!this.isInitialized) {
            throw new Error(`Agent ${this.name} not initialized`);
        }
        
        const startTime = Date.now();
        
        try {
            // 检查缓存
            if (strategy.cache) {
                const cachedResult = this.getCachedResult(toolName, parameters);
                if (cachedResult) {
                    console.log(`📦 Agent ${this.name} using cached result for ${toolName}`);
                    return cachedResult;
                }
            }
            
            // 检查工具是否支持
            if (!this.supportsTool(toolName)) {
                throw new Error(`Tool ${toolName} not supported by agent ${this.name}`);
            }
            
            // 执行工具
            const result = await this.executeTool(toolName, parameters, strategy);
            
            // 缓存结果
            if (strategy.cache && result && !result.error) {
                this.cacheResult(toolName, parameters, result);
            }
            
            // 更新性能统计
            const executionTime = Date.now() - startTime;
            this.updatePerformanceStats(executionTime, !result.error);
            
            // 触发事件
            this.triggerExecutionEvent(toolName, parameters, result, executionTime);
            
            return result;
            
        } catch (error) {
            const executionTime = Date.now() - startTime;
            this.updatePerformanceStats(executionTime, false);
            
            console.error(`❌ Agent ${this.name} execution failed for ${toolName}:`, error);
            throw error;
        }
    }
    
    /**
     * 检查是否支持工具
     */
    supportsTool(toolName) {
        return this.toolMapping.has(toolName);
    }
    
    /**
     * 执行工具（子类实现）
     */
    async executeTool(toolName, parameters, strategy) {
        const toolHandler = this.toolMapping.get(toolName);
        if (!toolHandler) {
            throw new Error(`Tool handler not found for ${toolName}`);
        }
        
        return await toolHandler.call(this, parameters, strategy);
    }
    
    /**
     * 处理消息
     */
    async handleMessage(message) {
        try {
            switch (message.type) {
                case 'execute_function':
                    return await this.executeFunction(
                        message.data.toolName,
                        message.data.parameters,
                        message.data.strategy
                    );
                    
                case 'get_status':
                    return this.getStatus();
                    
                case 'get_capabilities':
                    return this.getCapabilities();
                    
                case 'clear_cache':
                    return this.clearCache();
                    
                default:
                    throw new Error(`Unknown message type: ${message.type}`);
            }
        } catch (error) {
            console.error(`Agent ${this.name} message handling failed:`, error);
            throw error;
        }
    }
    
    /**
     * 获取状态
     */
    getStatus() {
        return {
            name: this.name,
            status: this.status,
            initialized: this.isInitialized,
            performanceStats: this.performanceStats,
            supportedTools: Array.from(this.toolMapping.keys()),
            cacheSize: this.cache.size
        };
    }
    
    /**
     * 获取能力
     */
    getCapabilities() {
        return {
            name: this.name,
            capabilities: this.capabilities,
            supportedTools: Array.from(this.toolMapping.keys()),
            toolCount: this.toolMapping.size
        };
    }
    
    /**
     * 更新性能统计
     */
    updatePerformanceStats(executionTime, success) {
        this.performanceStats.totalExecutions++;
        this.performanceStats.totalExecutionTime += executionTime;
        this.performanceStats.averageExecutionTime = 
            this.performanceStats.totalExecutionTime / this.performanceStats.totalExecutions;
        
        if (success) {
            this.performanceStats.successfulExecutions++;
        } else {
            this.performanceStats.failedExecutions++;
        }
    }
    
    /**
     * 触发执行事件
     */
    triggerExecutionEvent(toolName, parameters, result, executionTime) {
        if (this.eventBus) {
            this.eventBus.dispatchEvent(new CustomEvent('agent-execution', {
                detail: {
                    agentName: this.name,
                    toolName,
                    parameters,
                    result,
                    executionTime,
                    success: !result.error
                }
            }));
        }
    }
    
    /**
     * 缓存结果
     */
    cacheResult(toolName, parameters, result) {
        const cacheKey = this.generateCacheKey(toolName, parameters);
        this.cache.set(cacheKey, {
            result,
            timestamp: Date.now(),
            ttl: 300000 // 5分钟TTL
        });
    }
    
    /**
     * 获取缓存结果
     */
    getCachedResult(toolName, parameters) {
        const cacheKey = this.generateCacheKey(toolName, parameters);
        const cached = this.cache.get(cacheKey);
        
        if (!cached) return null;
        
        if (Date.now() - cached.timestamp > cached.ttl) {
            this.cache.delete(cacheKey);
            return null;
        }
        
        return cached.result;
    }
    
    /**
     * 生成缓存键
     */
    generateCacheKey(toolName, parameters) {
        return `${toolName}_${JSON.stringify(parameters)}`;
    }
    
    /**
     * 清除缓存
     */
    clearCache() {
        const cacheSize = this.cache.size;
        this.cache.clear();
        return { cleared: cacheSize };
    }
    
    /**
     * 发送消息到其他智能体
     */
    async sendMessage(toAgent, message) {
        if (!this.communicationProtocol) {
            throw new Error('Communication protocol not set');
        }
        
        return await this.communicationProtocol.sendMessage(this, toAgent, message);
    }
    
    /**
     * 获取性能报告
     */
    getPerformanceReport() {
        const successRate = this.performanceStats.totalExecutions > 0 
            ? this.performanceStats.successfulExecutions / this.performanceStats.totalExecutions 
            : 0;
            
        return {
            agentName: this.name,
            totalExecutions: this.performanceStats.totalExecutions,
            successfulExecutions: this.performanceStats.successfulExecutions,
            failedExecutions: this.performanceStats.failedExecutions,
            successRate: successRate,
            averageExecutionTime: this.performanceStats.averageExecutionTime,
            supportedTools: Array.from(this.toolMapping.keys()).length
        };
    }
    
    /**
     * 健康检查
     */
    async healthCheck() {
        return {
            name: this.name,
            status: this.status,
            initialized: this.isInitialized,
            communicationProtocol: !!this.communicationProtocol,
            eventBus: !!this.eventBus,
            toolMappingSize: this.toolMapping.size,
            cacheSize: this.cache.size
        };
    }
}

// 导出基类
window.AgentBase = AgentBase; 