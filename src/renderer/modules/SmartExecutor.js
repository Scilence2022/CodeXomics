/**
 * SmartExecutor - intelligent function-calls executor
 * Optimizes the execution strategy by feature category and priority to improve ChatBox response speed
 */
class SmartExecutor {
  constructor(chatManager) {
    this.chatManager = chatManager;
    this.app = chatManager.app;
    this.organizer = new FunctionCallsOrganizer(chatManager);

    // Execution state tracking
    this.isExecuting = false;
    this.currentExecution = null;
    this.executionQueue = [];

    // Performance monitoring
    this.executionMetrics = {
      totalExecutions: 0,
      averageTime: 0,
      successRate: 0,
      categoryPerformance: new Map(),
    };
  }

  /**
   * Main entry point for smart execution of function calls
   * @param {string} userMessage - the user message
   * @param {Array|Object} tools - the requested tools (an array or a single tool object)
   * @returns {Object} the execution result
   */
  async smartExecute(userMessage, tools) {
    const startTime = Date.now();

    try {
      // Normalize the tools format
      const toolRequests = this.normalizeToolRequests(tools);

      // Analyze the execution strategy
      const optimization = await this.organizer.optimizeExecution(
        userMessage,
        toolRequests.map(t => t.tool_name)
      );

      // Set the execution state
      this.currentExecution = {
        id: `exec_${Date.now()}`,
        userMessage: userMessage,
        tools: toolRequests,
        optimization: optimization,
        startTime: startTime,
        status: 'started',
      };

      this.isExecuting = true;

      // Execute according to the strategy
      const results = await this.executeWithStrategy(toolRequests, optimization.strategy);

      // Update the performance metrics
      this.updateMetrics(startTime, results);

      // Generate the execution report
      const report = this.generateExecutionReport(results, optimization);

      return {
        success: true,
        results: results,
        optimization: optimization,
        report: report,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      console.error('SmartExecutor error:', error);
      return {
        success: false,
        error: error.message,
        executionTime: Date.now() - startTime,
      };
    } finally {
      this.isExecuting = false;
      this.currentExecution = null;
    }
  }

  /**
   * Normalize the tool-request format
   */
  normalizeToolRequests(tools) {
    if (!Array.isArray(tools)) {
      // If it's a single tool object
      if (typeof tools === 'object' && tools.tool_name) {
        return [tools];
      }
      // If it's a tool-name string
      if (typeof tools === 'string') {
        return [{ tool_name: tools, parameters: {} }];
      }
      return [];
    }

    // Handle the array format
    return tools.map(tool => {
      if (typeof tool === 'string') {
        return { tool_name: tool, parameters: {} };
      }
      return tool;
    });
  }

  /**
   * Execute tools according to the strategy
   */
  async executeWithStrategy(toolRequests, strategy) {
    const results = [];
    const executionPlan = strategy.executionPlan;

    // Check if any tools were skipped because they weren't in category mapping
    toolRequests.map(t => t.tool_name);
    const planToolNames = new Set();

    // Collect all tool names from the execution plan
    for (const phase of executionPlan) {
      for (const tool of phase.tools) {
        planToolNames.add(typeof tool === 'string' ? tool : tool.tool || tool.tool_name || tool);
      }
    }

    // Identify tools that weren't added to the execution plan
    const unmatchedTools = toolRequests.filter(req => !planToolNames.has(req.tool_name));

    // If there are unmatched tools, create a default phase for them
    if (unmatchedTools.length > 0) {
      console.log(`⚠️  Found ${unmatchedTools.length} unmatched tools, creating default execution phase`);

      // Add unmatched tools to a default phase
      const defaultPhase = {
        priority: 3, // Medium priority
        phase: 'Default Execution',
        tools: unmatchedTools.map(t => ({ tool: t.tool_name })),
        parallelizable: true,
        estimatedTime: unmatchedTools.length * 500,
      };

      // Add default phase to execution plan
      executionPlan.push(defaultPhase);
    }

    for (const phase of executionPlan) {
      console.log(`🚀 Executing ${phase.phase} (Priority: ${phase.priority})`);

      // Get the tool requests for the current stage
      const phaseTools = this.getPhaseTools(toolRequests, phase.tools);

      if (phaseTools.length === 0) continue;

      let phaseResults;

      if (phase.parallelizable && phaseTools.length > 1) {
        // Parallel execution
        console.log(`   ⚡ Parallel execution of ${phaseTools.length} tools`);
        phaseResults = await this.executeParallel(phaseTools);
      } else {
        // Sequential execution
        console.log(`   📋 Sequential execution of ${phaseTools.length} tools`);
        phaseResults = await this.executeSequential(phaseTools);
      }

      results.push(...phaseResults);

      // For browser actions, provide visual feedback immediately
      if (phase.priority === 1) {
        this.provideBrowserFeedback(phaseResults);
      }
    }

    return results;
  }

  /**
   * Get the tool requests for a stage
   */
  getPhaseTools(toolRequests, phaseTools) {
    const phaseToolNames = phaseTools.map(t => t.tool);
    return toolRequests.filter(req => phaseToolNames.includes(req.tool_name));
  }

  /**
   * Execute tools in parallel
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
      executionMode: 'parallel',
    }));
  }

  /**
   * Execute tools sequentially
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
          executionMode: 'sequential',
        });
      } catch (error) {
        results.push({
          tool: tool.tool_name,
          parameters: tool.parameters,
          success: false,
          result: null,
          error: error.message,
          executionMode: 'sequential',
        });
      }
    }

    return results;
  }

  /**
   * Execute a single tool
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
   * Provide immediate feedback for browser actions
   */
  provideBrowserFeedback(results) {
    const successfulActions = results.filter(r => r.success);

    if (successfulActions.length > 0) {
      // Show visual feedback
      this.showQuickFeedback(`✓ ${successfulActions.length} browser action(s) completed`, 'success');
    }
  }

  /**
   * Show quick feedback
   */
  showQuickFeedback(message, type = 'info') {
    if (this.app.showNotification) {
      this.app.showNotification(message, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  /**
   * Update the performance metrics
   */
  updateMetrics(startTime, results) {
    const executionTime = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;
    const successRate = results.length > 0 ? successCount / results.length : 0;

    this.executionMetrics.totalExecutions++;
    this.executionMetrics.averageTime =
      (this.executionMetrics.averageTime * (this.executionMetrics.totalExecutions - 1) + executionTime) /
      this.executionMetrics.totalExecutions;
    this.executionMetrics.successRate =
      (this.executionMetrics.successRate * (this.executionMetrics.totalExecutions - 1) + successRate) /
      this.executionMetrics.totalExecutions;

    // Update the per-category performance
    for (const result of results) {
      const category = this.organizer.getFunctionCategory(result.tool);
      if (category) {
        if (!this.executionMetrics.categoryPerformance.has(category.name)) {
          this.executionMetrics.categoryPerformance.set(category.name, {
            count: 0,
            successRate: 0,
            averageTime: 0,
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
   * Generate the execution report
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
        successRate: totalTools > 0 ? Math.round((successfulTools / totalTools) * 100) : 0,
      },
      optimization: optimization.report,
      recommendations: optimization.recommendations,
      categorySummary: this.generateCategorySummary(results),
      performance: {
        executionTime: optimization.strategy.estimatedTime,
        actualResults: results.length,
        phases: optimization.strategy.executionPlan.length,
      },
    };

    return report;
  }

  /**
   * Generate the category summary
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
          failed: 0,
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
   * Get the execution state
   */
  getExecutionStatus() {
    return {
      isExecuting: this.isExecuting,
      currentExecution: this.currentExecution,
      queueLength: this.executionQueue.length,
      metrics: this.executionMetrics,
    };
  }

  /**
   * Get the performance statistics
   */
  getPerformanceStats() {
    return {
      ...this.executionMetrics,
      categoryPerformance: Object.fromEntries(this.executionMetrics.categoryPerformance),
    };
  }

  /**
   * Reset the performance metrics
   */
  resetMetrics() {
    this.executionMetrics = {
      totalExecutions: 0,
      averageTime: 0,
      successRate: 0,
      categoryPerformance: new Map(),
    };
  }

  /**
   * Get optimization suggestions
   */
  getOptimizationSuggestions(userMessage) {
    this.organizer.extractKeywords(userMessage.toLowerCase());
    const suggestions = [];

    // Provide suggestions based on historical performance data
    if (this.executionMetrics.totalExecutions > 10) {
      const avgTime = this.executionMetrics.averageTime;
      if (avgTime > 3000) {
        suggestions.push({
          type: 'performance',
          message: 'Consider breaking complex requests into smaller parts to improve response time',
        });
      }

      if (this.executionMetrics.successRate < 0.8) {
        suggestions.push({
          type: 'reliability',
          message: 'Some tools may be experiencing issues. Check system status',
        });
      }
    }

    return suggestions;
  }
}

// Export the class
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SmartExecutor;
} else if (typeof window !== 'undefined') {
  window.SmartExecutor = SmartExecutor;
}
