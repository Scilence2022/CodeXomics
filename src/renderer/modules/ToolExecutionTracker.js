/**
 * Tool Execution Tracker
 * Centrally tracks and records the execution status of all tools, providing a reliable data source for test evaluation
 */
class ToolExecutionTracker {
  constructor() {
    // Tool execution record storage
    this.executionRecords = new Map(); // sessionId -> executionRecord
    this.sessionHistory = new Map(); // sessionId -> [executionRecord, ...]

    // Current session ID (integrated with the benchmark)
    this.currentSessionId = null;

    // Execution statistics
    this.globalStats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      toolUsageStats: new Map(), // toolName -> {count, successCount, avgTime}
    };

    console.log('🔍 [ToolExecutionTracker] Initialized - Ready to track tool executions');
  }

  /**
   * Start a new execution session (for benchmark testing)
   */
  startSession(sessionId, metadata = {}) {
    this.currentSessionId = sessionId;
    this.currentTestId = metadata.testId || null;
    this.sessionHistory.set(sessionId, []);

    console.log(`🚀 [ToolExecutionTracker] Started session: ${sessionId}`, metadata);

    return {
      sessionId,
      startTime: Date.now(),
      metadata,
    };
  }

  /**
   * Record the start of a tool execution
   */
  recordExecutionStart(toolName, parameters = {}, context = {}) {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const record = {
      executionId,
      sessionId: this.currentSessionId,
      testId: context.testId || this.currentTestId || null,
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
      timestamp: new Date().toISOString(),
    };

    // Store in the current execution record
    this.executionRecords.set(executionId, record);

    // Add to the session history
    if (this.currentSessionId && this.sessionHistory.has(this.currentSessionId)) {
      this.sessionHistory.get(this.currentSessionId).push(record);
    }

    console.log(`📝 [ToolExecutionTracker] Execution started: ${toolName} (${executionId})`);
    return executionId;
  }

  /**
   * Record a successful tool execution
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

    // Update the global statistics
    this.updateGlobalStats(record.toolName, true, record.duration);

    console.log(`✅ [ToolExecutionTracker] Execution succeeded: ${record.toolName} (${record.duration}ms)`);

    return record;
  }

  /**
   * Record a failed tool execution
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
      stack: error.stack,
    };
    record.status = 'failed';
    record.additionalData = additionalData;

    // Update the global statistics
    this.updateGlobalStats(record.toolName, false, record.duration);

    console.log(`❌ [ToolExecutionTracker] Execution failed: ${record.toolName} - ${error.message || error}`);

    return record;
  }

  /**
   * Get all execution records for the session
   */
  getSessionExecutions(sessionId = null) {
    const targetSessionId = sessionId || this.currentSessionId;
    if (!targetSessionId) {
      console.debug('ℹ️ [ToolExecutionTracker] No session ID provided and no current session');
      return [];
    }

    const executions = this.sessionHistory.get(targetSessionId) || [];
    console.log(`🔍 [ToolExecutionTracker] Retrieved ${executions.length} executions for session: ${targetSessionId}`);

    return executions;
  }

  getTestExecutions(testId, sessionId = null) {
    const executions = this.getSessionExecutions(sessionId);
    if (!testId) return executions;
    const testExecutions = executions.filter(exec => exec.testId === testId);
    console.log(`🔍 [ToolExecutionTracker] Retrieved ${testExecutions.length} executions for test: ${testId}`);
    return testExecutions;
  }

  setCurrentTestId(testId) {
    this.currentTestId = testId;
  }

  /**
   * Get the execution status of a specific tool in the current session
   */
  getToolExecutionStatus(toolName, sessionId = null) {
    const executions = this.getSessionExecutions(sessionId);
    const toolExecutions = executions.filter(exec => exec.toolName === toolName);

    if (toolExecutions.length === 0) {
      return { executed: false, success: null, executions: [] };
    }

    // Get the status of the last execution
    const lastExecution = toolExecutions[toolExecutions.length - 1];

    return {
      executed: true,
      success: lastExecution.success,
      lastResult: lastExecution.result,
      lastError: lastExecution.error,
      executionCount: toolExecutions.length,
      executions: toolExecutions,
    };
  }

  /**
   * Check whether a tool executed successfully
   */
  isToolExecutedSuccessfully(toolName, parameters = null, sessionId = null) {
    const status = this.getToolExecutionStatus(toolName, sessionId);

    if (!status.executed) {
      return false;
    }

    // If parameters are provided, check that they match
    if (parameters !== null) {
      const matchingExecutions = status.executions.filter(
        exec => exec.success && this.parametersMatch(exec.parameters, parameters)
      );
      return matchingExecutions.length > 0;
    }

    return status.success === true;
  }

  /**
   * Generate a session execution summary (for benchmark evaluation)
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
        max: 0,
      },
    };

    // Calculate the success rate
    summary.successRate =
      summary.totalExecutions > 0 ? (summary.successfulExecutions / summary.totalExecutions) * 100 : 0;

    // Generate the per-tool summary
    const toolGroups = this.groupBy(executions, 'toolName');
    for (const [toolName, toolExecutions] of toolGroups) {
      summary.toolSummary[toolName] = {
        executionCount: toolExecutions.length,
        successCount: toolExecutions.filter(e => e.success === true).length,
        failureCount: toolExecutions.filter(e => e.success === false).length,
        lastExecutionSuccess: toolExecutions[toolExecutions.length - 1]?.success,
        averageTime: this.calculateAverage(toolExecutions.map(e => e.duration || 0)),
      };
    }

    // Calculate execution-time statistics
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
   * End the session
   */
  endSession(sessionId = null) {
    const targetSessionId = sessionId || this.currentSessionId;
    if (!targetSessionId) {
      console.warn('⚠️ [ToolExecutionTracker] No session to end');
      return null;
    }

    const summary = this.generateSessionSummary(targetSessionId);

    // Clear the current session ID (if ending the current session)
    if (targetSessionId === this.currentSessionId) {
      this.currentSessionId = null;
      this.currentTestId = null;
    }

    console.log(`🏁 [ToolExecutionTracker] Session ended: ${targetSessionId}`);
    return summary;
  }

  /**
   * Clean up old execution records (performance optimization)
   */
  cleanup(maxAge = 3600000) {
    // Default: 1 hour
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

  // === Helper methods ===

  sanitizeParameters(parameters) {
    try {
      // Remove complex objects that could cause serialization problems
      return JSON.parse(JSON.stringify(parameters));
    } catch (error) {
      return { serialization_error: 'Parameters could not be serialized' };
    }
  }

  sanitizeResult(result) {
    try {
      // Limit the result size to avoid memory problems
      const serialized = JSON.stringify(result);
      if (serialized.length > 10000) {
        // 10KB limit
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

    // Update the per-tool statistics
    if (!this.globalStats.toolUsageStats.has(toolName)) {
      this.globalStats.toolUsageStats.set(toolName, {
        count: 0,
        successCount: 0,
        totalTime: 0,
        avgTime: 0,
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
   * Dedicated API for benchmark testing
   */
  getBenchmarkExecutionData(sessionId, toolName = null) {
    const executions = this.getSessionExecutions(sessionId);

    if (toolName) {
      const toolExecutions = executions.filter(exec => exec.toolName === toolName);
      return {
        tool: toolName,
        executed: toolExecutions.length > 0,
        success: toolExecutions.length > 0 ? toolExecutions[toolExecutions.length - 1].success : false,
        executions: toolExecutions,
      };
    }

    return {
      allExecutions: executions,
      summary: this.generateSessionSummary(sessionId),
    };
  }
}

// Export the class
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ToolExecutionTracker;
} else {
  window.ToolExecutionTracker = ToolExecutionTracker;
}
