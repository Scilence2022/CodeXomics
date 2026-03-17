/**
 * EcoCyc Pathway Analyzer - Interactive Demo Script
 *
 * This module provides demo scenarios and execution logic for testing
 * EcoCyc Pathway Analyzer plugin functionality.
 *
 * @version 1.0.0
 * @author GenomeAIStudio Team
 */

class EcoCycPathwayDemo {
  constructor(pluginInstance) {
    this.plugin = pluginInstance;
    this.demoData = this.initializeDemoData();
  }

  /**
   * Initialize demo datasets with real E. coli pathways
   * Each demo fetches real-time data from BioCyc/EcoCyc database
   */
  initializeDemoData() {
    return {
      basic: {
        name: 'L-Arabinose Degradation',
        description: 'E. coli arabinose catabolism pathway - Real-time BioCyc data',
        complexity: 'basic',
        expectedNodes: '5-10',
        expectedEdges: '8-15',
        searchConfig: {
          pathwayId: 'ARABCAT-PWY', // L-arabinose degradation I
          organism: 'ECOLI', // E. coli K-12 substr. MG1655
          pathwayName: 'L-arabinose degradation I',
        },
        isRealTimeSearch: true,
        validationRules: {
          minNodes: 3,
          minEdges: 3,
          requiredPathwayId: 'ARABCAT-PWY',
        },
      },

      complex: {
        name: 'TCA Cycle in E. coli',
        description: 'Complete tricarboxylic acid cycle - Real-time BioCyc data',
        complexity: 'complex',
        expectedNodes: '15-25',
        expectedEdges: '25-40',
        searchConfig: {
          pathwayId: 'TCA', // TCA cycle I (aerobic)
          organism: 'ECOLI',
          pathwayName: 'TCA cycle I (aerobic)',
        },
        isRealTimeSearch: true,
        validationRules: {
          minNodes: 8,
          minEdges: 10,
          requiredPathwayId: 'TCA',
        },
      },

      glycolysis: {
        name: 'Glycolysis in E. coli',
        description: 'Glycolysis pathway in E. coli - Real-time BioCyc data',
        complexity: 'advanced',
        expectedNodes: '20-30',
        expectedEdges: '30-50',
        searchConfig: {
          pathwayId: 'GLYCOLYSIS', // Glycolysis I
          organism: 'ECOLI',
          pathwayName: 'Glycolysis I (from glucose 6-phosphate)',
        },
        isRealTimeSearch: true,
        validationRules: {
          minNodes: 10,
          minEdges: 12,
          requiredPathwayId: 'GLYCOLYSIS',
        },
      },

      biosynthesis: {
        name: 'Amino Acid Biosynthesis',
        description: 'L-lysine biosynthesis pathway',
        complexity: 'performance',
        expectedNodes: '25-40',
        expectedEdges: '40-70',
        searchConfig: {
          pathwayId: 'DAPLYSINESYN-PWY', // L-lysine biosynthesis I
          organism: 'ECOLI',
          pathwayName: 'L-lysine biosynthesis I',
        },
        isRealTimeSearch: true,
        validationRules: {
          minNodes: 12,
          minEdges: 15,
          maxExecutionTime: 8000, // 8 seconds
        },
      },
    };
  }

  /**
   * Execute demo scenario
   */
  async executeDemo(demoKey, logger) {
    const demo = this.demoData[demoKey];

    if (!demo) {
      throw new Error(`Demo scenario "${demoKey}" not found`);
    }

    logger(`Starting demo: ${demo.name}`, 'info');
    logger(`Complexity: ${demo.complexity}`, 'info');
    logger(`Expected nodes: ${demo.expectedNodes}, edges: ${demo.expectedEdges}`, 'info');
    logger('─'.repeat(60), 'info');

    const startTime = Date.now();

    try {
      if (demo.isRealTimeSearch) {
        return await this.fetchRealTimeData(demo.searchConfig, logger, demo.validationRules);
      } else {
        return {
          success: true,
          data: demo.data,
          executionTime: Date.now() - startTime,
        };
      }
    } catch (error) {
      logger(`❌ Demo execution failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Fetch real-time data from BioCyc/EcoCyc database
   */
  async fetchRealTimeData(config, logger, validationRules) {
    logger('🔍 Fetching real-time data from BioCyc database...', 'info');
    logger(`  Pathway ID: ${config.pathwayId}`, 'info');
    logger(`  Organism: ${config.organism}`, 'info');
    logger(`  Pathway Name: ${config.pathwayName}`, 'info');

    const startTime = Date.now();

    try {
      if (!this.plugin) {
        throw new Error('Plugin instance not available');
      }

      let pathwayResult;

      if (typeof this.plugin.getPathwayDetails === 'function') {
        logger('  Calling getPathwayDetails()...', 'info');
        pathwayResult = await this.plugin.getPathwayDetails(config);
      } else {
        throw new Error('getPathwayDetails() method not found in plugin');
      }

      if (!pathwayResult || !pathwayResult.success) {
        throw new Error('BioCyc API request failed or returned no data');
      }

      const executionTime = Date.now() - startTime;
      const data = pathwayResult.data;
      const nodeCount = data.nodes?.length || 0;
      const edgeCount = data.edges?.length || 0;

      logger('✅ Real-time data retrieved from BioCyc database', 'success');
      logger(`  Nodes: ${nodeCount}`, 'info');
      logger(`  Edges: ${edgeCount}`, 'info');
      logger(`  Execution Time: ${executionTime}ms`, 'info');

      const validation = this.validateResult(pathwayResult, validationRules);

      if (!validation.isValid) {
        logger('⚠️ Validation warnings:', 'warning');
        validation.warnings.forEach(w => logger(`  - ${w}`, 'warning'));

        if (validation.errors.length > 0) {
          logger('❌ Validation errors:', 'error');
          validation.errors.forEach(e => logger(`  - ${e}`, 'error'));
        }
      } else {
        logger('✅ Result validation passed', 'success');
      }

      return {
        success: true,
        data: data,
        executionTime: executionTime,
        validation: validation,
        metadata: {
          source: 'BioCyc/EcoCyc',
          pathwayId: config.pathwayId,
          organism: config.organism,
        },
      };
    } catch (error) {
      logger(`❌ BioCyc API error: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Validate demo execution result
   */
  validateResult(result, rules) {
    const validation = {
      isValid: true,
      warnings: [],
      errors: [],
      metrics: {},
    };

    if (!result || !result.data) {
      validation.isValid = false;
      validation.errors.push('No data returned from BioCyc');
      return validation;
    }

    const data = result.data;
    const nodeCount = data.nodes?.length || 0;
    const edgeCount = data.edges?.length || 0;

    validation.metrics.nodeCount = nodeCount;
    validation.metrics.edgeCount = edgeCount;

    if (rules.minNodes && nodeCount < rules.minNodes) {
      validation.isValid = false;
      validation.errors.push(`Insufficient nodes: expected >=${rules.minNodes}, got ${nodeCount}`);
    }

    if (rules.minEdges && edgeCount < rules.minEdges) {
      validation.warnings.push(`Low edge count: expected >=${rules.minEdges}, got ${edgeCount}`);
    }

    if (rules.requiredPathwayId && result.pathwayId !== rules.requiredPathwayId) {
      validation.warnings.push(`Pathway ID mismatch: expected ${rules.requiredPathwayId}, got ${result.pathwayId}`);
    }

    if (rules.maxExecutionTime && result.executionTime) {
      validation.metrics.executionTime = result.executionTime;

      if (result.executionTime > rules.maxExecutionTime) {
        validation.warnings.push(`Slow execution: ${result.executionTime}ms > ${rules.maxExecutionTime}ms`);
      }
    }

    return validation;
  }

  /**
   * Get demo metadata for UI display
   */
  getMetadata() {
    return {
      pluginId: 'ecocyc-pathway-analyzer',
      pluginName: 'EcoCyc Pathway Analyzer',
      version: '1.0.0',
      demoCount: Object.keys(this.demoData).length,
      complexityLevels: ['basic', 'complex', 'advanced', 'performance'],
      requiresNetwork: true,
      estimatedDuration: {
        basic: '2-3 seconds',
        complex: '3-5 seconds',
        advanced: '5-8 seconds',
        performance: '6-10 seconds',
      },
    };
  }

  /**
   * List available demo scenarios
   */
  listDemos() {
    return Object.entries(this.demoData).map(([key, demo]) => ({
      key,
      name: demo.name,
      description: demo.description,
      complexity: demo.complexity,
      expectedNodes: demo.expectedNodes,
      expectedEdges: demo.expectedEdges,
      isRealTime: demo.isRealTimeSearch,
    }));
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EcoCycPathwayDemo;
}

if (typeof window !== 'undefined') {
  window.EcoCycPathwayDemo = EcoCycPathwayDemo;
}
