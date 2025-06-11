/**
 * SmartExecutor - 智能function calls执行器
 * 根据功能分类和优先级优化执行策略，提升ChatBox响应速度
 */
class SmartExecutor {
    constructor(chatManager) {
        this.chatManager = chatManager;
        this.app = chatManager.app;
        this.organizer = new FunctionCallsOrganizer(chatManager);
        
        // 执行状态跟踪
        this.isExecuting = false;
        this.currentExecution = null;
        this.executionQueue = [];
        
        // 性能监控
        this.executionMetrics = {
            totalExecutions: 0,
            averageTime: 0,
            successRate: 0,
            categoryPerformance: new Map()
        };
    }
    
    /**
     * 智能执行function calls的主入口方法
     * @param {string} userMessage - 用户消息
     * @param {Array|Object} tools - 请求的工具（可以是数组或单个工具对象）
     * @returns {Object} 执行结果
     */
    async smartExecute(userMessage, tools) {
        const startTime = Date.now();
        
        try {
            // 标准化tools格式
            const toolRequests = this.normalizeToolRequests(tools);
            
            // 分析执行策略
            const optimization = await this.organizer.optimizeExecution(
                userMessage, 
                toolRequests.map(t => t.tool_name)
            );
            
            // 设置执行状态
            this.currentExecution = {
                id: `exec_${Date.now()}`,
                userMessage: userMessage,
                tools: toolRequests,
                optimization: optimization,
                startTime: startTime,
                status: 'started'
            };
            
            this.isExecuting = true;
            
            // 根据策略执行
            const results = await this.executeWithStrategy(toolRequests, optimization.strategy);
            
            // 更新性能指标
            this.updateMetrics(startTime, results);
            
            // 生成执行报告
            const report = this.generateExecutionReport(results, optimization);
            
            return {
                success: true,
                results: results,
                optimization: optimization,
                report: report,
                executionTime: Date.now() - startTime
            };
            
        } catch (error) {
            console.error('SmartExecutor error:', error);
            return {
                success: false,
                error: error.message,
                executionTime: Date.now() - startTime
            };
        } finally {
            this.isExecuting = false;
            this.currentExecution = null;
        }
    }
    
    /**
     * 标准化工具请求格式
     */
    normalizeToolRequests(tools) {
        if (!Array.isArray(tools)) {
            // 如果是单个工具对象
            if (typeof tools === 'object' && tools.tool_name) {
                return [tools];
            }
            // 如果是工具名称字符串
            if (typeof tools === 'string') {
                return [{ tool_name: tools, parameters: {} }];
            }
            return [];
        }
        
        // 处理数组格式
        return tools.map(tool => {
            if (typeof tool === 'string') {
                return { tool_name: tool, parameters: {} };
            }
            return tool;
        });
    }
    
    /**
     * 根据策略执行工具
     */
    async executeWithStrategy(toolRequests, strategy) {
        const results = [];
        const executionPlan = strategy.executionPlan;
        
        for (const phase of executionPlan) {
            console.log(`🚀 Executing ${phase.phase} (Priority: ${phase.priority})`);
            
            // 获取当前阶段的工具请求
            const phaseTools = this.getPhaseTools(toolRequests, phase.tools);
            
            if (phaseTools.length === 0) continue;
            
            let phaseResults;
            
            if (phase.parallelizable && phaseTools.length > 1) {
                // 并行执行
                console.log(`   ⚡ Parallel execution of ${phaseTools.length} tools`);
                phaseResults = await this.executeParallel(phaseTools);
            } else {
                // 顺序执行
                console.log(`   📋 Sequential execution of ${phaseTools.length} tools`);
                phaseResults = await this.executeSequential(phaseTools);
            }
            
            results.push(...phaseResults);
            
            // 对于浏览器行为，立即提供视觉反馈
            if (phase.priority === 1) {
                this.provideBrowserFeedback(phaseResults);
            }
        }
        
        return results;
    }
    
    /**
     * 获取阶段对应的工具请求
     */
    getPhaseTools(toolRequests, phaseTools) {
        const phaseToolNames = phaseTools.map(t => t.tool);
        return toolRequests.filter(req => phaseToolNames.includes(req.tool_name));
    }
    
    /**
     * 并行执行工具
     */
    async executeParallel(tools) {
        const promises = tools.map(tool => this.executeSingleTool(tool));
        const results = await Promise.allSettled(promises);
        
        return results.map((result, index) => ({
            tool: tools[index].tool_name,
            parameters: tools[index].parameters,
            success: result.status === 'fulfilled',
            result: result.status === 'fulfilled' ? result.value : null,
            error: result.status === 'rejected' ? result.reason.message : null,
            executionMode: 'parallel'
        }));
    }
    
    /**
     * 顺序执行工具
     */
    async executeSequential(tools) {
        const results = [];
        
        for (const tool of tools) {
            try {
                const result = await this.executeSingleTool(tool);
                results.push({
                    tool: tool.tool_name,
                    parameters: tool.parameters,
                    success: true,
                    result: result,
                    error: null,
                    executionMode: 'sequential'
                });
            } catch (error) {
                results.push({
                    tool: tool.tool_name,
                    parameters: tool.parameters,
                    success: false,
                    result: null,
                    error: error.message,
                    executionMode: 'sequential'
                });
            }
        }
        
        return results;
    }
    
    /**
     * 执行单个工具
     */
    async executeSingleTool(tool) {
        const category = this.organizer.getFunctionCategory(tool.tool_name);
        console.log(`   🔧 Executing ${tool.tool_name} (${category?.name || 'unknown'})`);
        
        try {
            const result = await this.chatManager.executeToolByName(tool.tool_name, tool.parameters);
            return result;
        } catch (error) {
            console.error(`Tool execution failed for ${tool.tool_name}:`, error);
            throw error;
        }
    }
    
    /**
     * 为浏览器行为提供即时反馈
     */
    provideBrowserFeedback(results) {
        const successfulActions = results.filter(r => r.success);
        
        if (successfulActions.length > 0) {
            // 显示视觉反馈
            this.showQuickFeedback(`✓ ${successfulActions.length} browser action(s) completed`, 'success');
        }
    }
    
    /**
     * 显示快速反馈
     */
    showQuickFeedback(message, type = 'info') {
        if (this.app.showNotification) {
            this.app.showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }
    
    /**
     * 更新性能指标
     */
    updateMetrics(startTime, results) {
        const executionTime = Date.now() - startTime;
        const successCount = results.filter(r => r.success).length;
        const successRate = results.length > 0 ? successCount / results.length : 0;
        
        this.executionMetrics.totalExecutions++;
        this.executionMetrics.averageTime = 
            (this.executionMetrics.averageTime * (this.executionMetrics.totalExecutions - 1) + executionTime) 
            / this.executionMetrics.totalExecutions;
        this.executionMetrics.successRate = 
            (this.executionMetrics.successRate * (this.executionMetrics.totalExecutions - 1) + successRate) 
            / this.executionMetrics.totalExecutions;
        
        // 更新分类性能
        for (const result of results) {
            const category = this.organizer.getFunctionCategory(result.tool);
            if (category) {
                if (!this.executionMetrics.categoryPerformance.has(category.name)) {
                    this.executionMetrics.categoryPerformance.set(category.name, {
                        count: 0,
                        successRate: 0,
                        averageTime: 0
                    });
                }
                
                const categoryStats = this.executionMetrics.categoryPerformance.get(category.name);
                categoryStats.count++;
                const newSuccessRate = result.success ? 1 : 0;
                categoryStats.successRate = 
                    (categoryStats.successRate * (categoryStats.count - 1) + newSuccessRate) / categoryStats.count;
            }
        }
    }
    
    /**
     * 生成执行报告
     */
    generateExecutionReport(results, optimization) {
        const totalTools = results.length;
        const successfulTools = results.filter(r => r.success).length;
        const failedTools = totalTools - successfulTools;
        
        const report = {
            summary: {
                totalTools: totalTools,
                successful: successfulTools,
                failed: failedTools,
                successRate: totalTools > 0 ? Math.round((successfulTools / totalTools) * 100) : 0
            },
            optimization: optimization.report,
            recommendations: optimization.recommendations,
            categorySummary: this.generateCategorySummary(results),
            performance: {
                executionTime: optimization.strategy.estimatedTime,
                actualResults: results.length,
                phases: optimization.strategy.executionPlan.length
            }
        };
        
        return report;
    }
    
    /**
     * 生成分类汇总
     */
    generateCategorySummary(results) {
        const summary = new Map();
        
        for (const result of results) {
            const category = this.organizer.getFunctionCategory(result.tool);
            const categoryName = category?.name || 'unknown';
            
            if (!summary.has(categoryName)) {
                summary.set(categoryName, {
                    name: categoryName,
                    priority: category?.priority || 999,
                    description: category?.description || 'Unknown category',
                    tools: [],
                    successful: 0,
                    failed: 0
                });
            }
            
            const categorySummary = summary.get(categoryName);
            categorySummary.tools.push(result.tool);
            
            if (result.success) {
                categorySummary.successful++;
            } else {
                categorySummary.failed++;
            }
        }
        
        return Array.from(summary.values()).sort((a, b) => a.priority - b.priority);
    }
    
    /**
     * 获取执行状态
     */
    getExecutionStatus() {
        return {
            isExecuting: this.isExecuting,
            currentExecution: this.currentExecution,
            queueLength: this.executionQueue.length,
            metrics: this.executionMetrics
        };
    }
    
    /**
     * 获取性能统计
     */
    getPerformanceStats() {
        return {
            ...this.executionMetrics,
            categoryPerformance: Object.fromEntries(this.executionMetrics.categoryPerformance)
        };
    }
    
    /**
     * 重置性能指标
     */
    resetMetrics() {
        this.executionMetrics = {
            totalExecutions: 0,
            averageTime: 0,
            successRate: 0,
            categoryPerformance: new Map()
        };
    }
    
    /**
     * 获取优化建议
     */
    getOptimizationSuggestions(userMessage) {
        const messageKeywords = this.organizer.extractKeywords(userMessage.toLowerCase());
        const suggestions = [];
        
        // 基于历史性能数据提供建议
        if (this.executionMetrics.totalExecutions > 10) {
            const avgTime = this.executionMetrics.averageTime;
            if (avgTime > 3000) {
                suggestions.push({
                    type: 'performance',
                    message: 'Consider breaking complex requests into smaller parts to improve response time'
                });
            }
            
            if (this.executionMetrics.successRate < 0.8) {
                suggestions.push({
                    type: 'reliability',
                    message: 'Some tools may be experiencing issues. Check system status'
                });
            }
        }
        
        return suggestions;
    }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SmartExecutor;
} else if (typeof window !== 'undefined') {
    window.SmartExecutor = SmartExecutor;
} 