/**
 * Tool Execution Tracker
 * 集中跟踪和记录所有工具的执行状态，为测试评估提供可靠的数据源
 */
class ToolExecutionTracker {
    constructor() {
        // 工具执行记录存储
        this.executionRecords = new Map(); // sessionId -> executionRecord
        this.sessionHistory = new Map(); // sessionId -> [executionRecord, ...]
        
        // 当前会话ID（与benchmark集成）
        this.currentSessionId = null;
        
        // 执行统计
        this.globalStats = {
            totalExecutions: 0,
            successfulExecutions: 0,
            failedExecutions: 0,
            toolUsageStats: new Map() // toolName -> {count, successCount, avgTime}
        };
        
        console.log('🔍 [ToolExecutionTracker] Initialized - Ready to track tool executions');
    }

    /**
     * 开始新的执行会话（用于benchmark测试）
     */
    startSession(sessionId, metadata = {}) {
        this.currentSessionId = sessionId;
        this.sessionHistory.set(sessionId, []);
        
        console.log(`🚀 [ToolExecutionTracker] Started session: ${sessionId}`, metadata);
        
        return {
            sessionId,
            startTime: Date.now(),
            metadata
        };
    }

    /**
     * 记录工具执行开始
     */
    recordExecutionStart(toolName, parameters = {}, context = {}) {
        const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const record = {
            executionId,
            sessionId: this.currentSessionId,
            toolName,
            parameters: this.sanitizeParameters(parameters),
            context,
            startTime: Date.now(),
            endTime: null,
            duration: null,
            success: null,
            result: null,
            error: null,
            status: 'running',
            timestamp: new Date().toISOString()
        };

        // 存储到当前执行记录
        this.executionRecords.set(executionId, record);
        
        // 添加到会话历史
        if (this.currentSessionId && this.sessionHistory.has(this.currentSessionId)) {
            this.sessionHistory.get(this.currentSessionId).push(record);
        }

        console.log(`📝 [ToolExecutionTracker] Execution started: ${toolName} (${executionId})`);
        return executionId;
    }

    /**
     * 记录工具执行成功
     */
    recordExecutionSuccess(executionId, result, additionalData = {}) {
        const record = this.executionRecords.get(executionId);
        if (!record) {
            console.warn(`⚠️ [ToolExecutionTracker] No execution record found for ID: ${executionId}`);
            return null;
        }

        const endTime = Date.now();
        record.endTime = endTime;
        record.duration = endTime - record.startTime;
        record.success = true;
        record.result = this.sanitizeResult(result);
        record.status = 'completed';
        record.additionalData = additionalData;

        // 更新全局统计
        this.updateGlobalStats(record.toolName, true, record.duration);

        console.log(`✅ [ToolExecutionTracker] Execution succeeded: ${record.toolName} (${record.duration}ms)`);
        
        return record;
    }

    /**
     * 记录工具执行失败
     */
    recordExecutionFailure(executionId, error, additionalData = {}) {
        const record = this.executionRecords.get(executionId);
        if (!record) {
            console.warn(`⚠️ [ToolExecutionTracker] No execution record found for ID: ${executionId}`);
            return null;
        }

        const endTime = Date.now();
        record.endTime = endTime;
        record.duration = endTime - record.startTime;
        record.success = false;
        record.error = {
            message: error.message || error,
            name: error.name || 'Error',
            stack: error.stack
        };
        record.status = 'failed';
        record.additionalData = additionalData;

        // 更新全局统计
        this.updateGlobalStats(record.toolName, false, record.duration);

        console.log(`❌ [ToolExecutionTracker] Execution failed: ${record.toolName} - ${error.message || error}`);
        
        return record;
    }

    /**
     * 获取会话的所有执行记录
     */
    getSessionExecutions(sessionId = null) {
        const targetSessionId = sessionId || this.currentSessionId;
        if (!targetSessionId) {
            console.warn('⚠️ [ToolExecutionTracker] No session ID provided and no current session');
            return [];
        }

        const executions = this.sessionHistory.get(targetSessionId) || [];
        console.log(`🔍 [ToolExecutionTracker] Retrieved ${executions.length} executions for session: ${targetSessionId}`);
        
        return executions;
    }

    /**
     * 获取特定工具在当前会话中的执行状态
     */
    getToolExecutionStatus(toolName, sessionId = null) {
        const executions = this.getSessionExecutions(sessionId);
        const toolExecutions = executions.filter(exec => exec.toolName === toolName);

        if (toolExecutions.length === 0) {
            return { executed: false, success: null, executions: [] };
        }

        // 获取最后一次执行的状态
        const lastExecution = toolExecutions[toolExecutions.length - 1];
        
        return {
            executed: true,
            success: lastExecution.success,
            lastResult: lastExecution.result,
            lastError: lastExecution.error,
            executionCount: toolExecutions.length,
            executions: toolExecutions
        };
    }

    /**
     * 检查工具是否成功执行
     */
    isToolExecutedSuccessfully(toolName, parameters = null, sessionId = null) {
        const status = this.getToolExecutionStatus(toolName, sessionId);
        
        if (!status.executed) {
            return false;
        }

        // 如果提供了参数，检查参数匹配
        if (parameters !== null) {
            const matchingExecutions = status.executions.filter(exec => 
                exec.success && this.parametersMatch(exec.parameters, parameters)
            );
            return matchingExecutions.length > 0;
        }

        return status.success === true;
    }

    /**
     * 生成会话执行摘要（用于benchmark评估）
     */
    generateSessionSummary(sessionId = null) {
        const executions = this.getSessionExecutions(sessionId);
        
        const summary = {
            sessionId: sessionId || this.currentSessionId,
            totalExecutions: executions.length,
            successfulExecutions: executions.filter(e => e.success === true).length,
            failedExecutions: executions.filter(e => e.success === false).length,
            runningExecutions: executions.filter(e => e.status === 'running').length,
            toolSummary: {},
            executionTimes: {
                total: executions.reduce((sum, e) => sum + (e.duration || 0), 0),
                average: 0,
                min: 0,
                max: 0
            }
        };

        // 计算成功率
        summary.successRate = summary.totalExecutions > 0 ? 
            (summary.successfulExecutions / summary.totalExecutions) * 100 : 0;

        // 生成工具级别摘要
        const toolGroups = this.groupBy(executions, 'toolName');
        for (const [toolName, toolExecutions] of toolGroups) {
            summary.toolSummary[toolName] = {
                executionCount: toolExecutions.length,
                successCount: toolExecutions.filter(e => e.success === true).length,
                failureCount: toolExecutions.filter(e => e.success === false).length,
                lastExecutionSuccess: toolExecutions[toolExecutions.length - 1]?.success,
                averageTime: this.calculateAverage(toolExecutions.map(e => e.duration || 0))
            };
        }

        // 计算执行时间统计
        const durations = executions.map(e => e.duration || 0).filter(d => d > 0);
        if (durations.length > 0) {
            summary.executionTimes.average = this.calculateAverage(durations);
            summary.executionTimes.min = Math.min(...durations);
            summary.executionTimes.max = Math.max(...durations);
        }

        console.log(`📊 [ToolExecutionTracker] Session summary:`, summary);
        return summary;
    }

    /**
     * 结束会话
     */
    endSession(sessionId = null) {
        const targetSessionId = sessionId || this.currentSessionId;
        if (!targetSessionId) {
            console.warn('⚠️ [ToolExecutionTracker] No session to end');
            return null;
        }

        const summary = this.generateSessionSummary(targetSessionId);
        
        // 清理当前会话ID（如果结束的是当前会话）
        if (targetSessionId === this.currentSessionId) {
            this.currentSessionId = null;
        }

        console.log(`🏁 [ToolExecutionTracker] Session ended: ${targetSessionId}`);
        return summary;
    }

    /**
     * 清理旧的执行记录（性能优化）
     */
    cleanup(maxAge = 3600000) { // 默认1小时
        const cutoffTime = Date.now() - maxAge;
        let cleanedCount = 0;

        for (const [executionId, record] of this.executionRecords.entries()) {
            if (record.startTime < cutoffTime) {
                this.executionRecords.delete(executionId);
                cleanedCount++;
            }
        }

        console.log(`🧹 [ToolExecutionTracker] Cleaned up ${cleanedCount} old execution records`);
    }

    // === 辅助方法 ===

    sanitizeParameters(parameters) {
        try {
            // 移除可能导致序列化问题的复杂对象
            return JSON.parse(JSON.stringify(parameters));
        } catch (error) {
            return { serialization_error: 'Parameters could not be serialized' };
        }
    }

    sanitizeResult(result) {
        try {
            // 限制结果大小，避免内存问题
            const serialized = JSON.stringify(result);
            if (serialized.length > 10000) { // 10KB limit
                return { truncated: true, preview: serialized.substring(0, 1000) + '...' };
            }
            return JSON.parse(serialized);
        } catch (error) {
            return { serialization_error: 'Result could not be serialized', type: typeof result };
        }
    }

    updateGlobalStats(toolName, success, duration) {
        this.globalStats.totalExecutions++;
        if (success) {
            this.globalStats.successfulExecutions++;
        } else {
            this.globalStats.failedExecutions++;
        }

        // 更新工具级别统计
        if (!this.globalStats.toolUsageStats.has(toolName)) {
            this.globalStats.toolUsageStats.set(toolName, {
                count: 0,
                successCount: 0,
                totalTime: 0,
                avgTime: 0
            });
        }

        const toolStats = this.globalStats.toolUsageStats.get(toolName);
        toolStats.count++;
        if (success) toolStats.successCount++;
        toolStats.totalTime += duration;
        toolStats.avgTime = toolStats.totalTime / toolStats.count;
    }

    parametersMatch(params1, params2) {
        try {
            return JSON.stringify(params1) === JSON.stringify(params2);
        } catch (error) {
            return false;
        }
    }

    groupBy(array, key) {
        const groups = new Map();
        for (const item of array) {
            const groupKey = item[key];
            if (!groups.has(groupKey)) {
                groups.set(groupKey, []);
            }
            groups.get(groupKey).push(item);
        }
        return groups;
    }

    calculateAverage(numbers) {
        if (numbers.length === 0) return 0;
        return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
    }

    // === Benchmark Integration API ===

    /**
     * 为benchmark测试提供的专用API
     */
    getBenchmarkExecutionData(sessionId, toolName = null) {
        const executions = this.getSessionExecutions(sessionId);
        
        if (toolName) {
            const toolExecutions = executions.filter(exec => exec.toolName === toolName);
            return {
                tool: toolName,
                executed: toolExecutions.length > 0,
                success: toolExecutions.length > 0 ? toolExecutions[toolExecutions.length - 1].success : false,
                executions: toolExecutions
            };
        }

        return {
            allExecutions: executions,
            summary: this.generateSessionSummary(sessionId)
        };
    }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ToolExecutionTracker;
} else {
    window.ToolExecutionTracker = ToolExecutionTracker;
}