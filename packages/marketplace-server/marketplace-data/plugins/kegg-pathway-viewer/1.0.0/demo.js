/**
 * KEGG Pathway Viewer - Interactive Demo Script
 *
 * This module provides demo scenarios and execution logic for testing
 * KEGG Pathway Viewer plugin functionality.
 *
 * @version 1.0.0
 * @author GenomeAIStudio Team
 */

class KEGGPathwayDemo {
  constructor(pluginInstance) {
    this.plugin = pluginInstance;
    this.demoData = this.initializeDemoData();
  }

  /**
   * Initialize demo datasets with real biological pathways
   * Each demo fetches real-time data from KEGG database
   */
  initializeDemoData() {
    return {
      basic: {
        name: 'Glycolysis Pathway',
        description: 'Glycolysis / Gluconeogenesis pathway - Real-time KEGG data',
        complexity: 'basic',
        expectedNodes: '10-15',
        expectedEdges: '15-25',
        searchConfig: {
          pathwayId: 'hsa00010', // Human glycolysis pathway
          organism: 'hsa',
          pathwayName: 'Glycolysis / Gluconeogenesis',
        },
        isRealTimeSearch: true,
        validationRules: {
          minNodes: 5,
          minEdges: 5,
          requiredPathwayId: 'hsa00010',
        },
      },

      complex: {
        name: 'TCA Cycle Pathway',
        description: 'Citrate cycle (TCA cycle) - Real-time KEGG data',
        complexity: 'complex',
        expectedNodes: '20-30',
        expectedEdges: '30-50',
        searchConfig: {
          pathwayId: 'hsa00020', // Human TCA cycle
          organism: 'hsa',
          pathwayName: 'Citrate cycle (TCA cycle)',
        },
        isRealTimeSearch: true,
        validationRules: {
          minNodes: 10,
          minEdges: 15,
          requiredPathwayId: 'hsa00020',
        },
      },

      metabolic: {
        name: 'Purine Metabolism',
        description: 'Purine metabolism pathway - Real-time KEGG data',
        complexity: 'advanced',
        expectedNodes: '30-50',
        expectedEdges: '50-100',
        searchConfig: {
          pathwayId: 'hsa00230', // Human purine metabolism
          organism: 'hsa',
          pathwayName: 'Purine metabolism',
        },
        isRealTimeSearch: true,
        validationRules: {
          minNodes: 15,
          minEdges: 20,
          requiredPathwayId: 'hsa00230',
        },
      },

      disease: {
        name: 'Cancer Pathways',
        description: 'Pathways in cancer - Comprehensive network',
        complexity: 'performance',
        expectedNodes: '50-100',
        expectedEdges: '100-200',
        searchConfig: {
          pathwayId: 'hsa05200', // Pathways in cancer
          organism: 'hsa',
          pathwayName: 'Pathways in cancer',
        },
        isRealTimeSearch: true,
        validationRules: {
          minNodes: 30,
          minEdges: 50,
          maxExecutionTime: 10000, // 10 seconds
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
   * Fetch real-time data from KEGG database
   */
  async fetchRealTimeData(config, logger, validationRules) {
    logger('🔍 Fetching real-time data from KEGG database...', 'info');
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
        throw new Error('KEGG API request failed or returned no data');
      }

      const executionTime = Date.now() - startTime;
      const data = pathwayResult.data;
      const nodeCount = data.nodes?.length || 0;
      const edgeCount = data.edges?.length || 0;

      logger('✅ Real-time data retrieved from KEGG database', 'success');
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
          source: 'KEGG',
          pathwayId: config.pathwayId,
          organism: config.organism,
        },
      };
    } catch (error) {
      logger(`❌ KEGG API error: ${error.message}`, 'error');
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
      validation.errors.push('No data returned from KEGG');
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
      pluginId: 'kegg-pathway-viewer',
      pluginName: 'KEGG Pathway Viewer',
      version: '1.0.0',
      demoCount: Object.keys(this.demoData).length,
      complexityLevels: ['basic', 'complex', 'advanced', 'performance'],
      requiresNetwork: true,
      estimatedDuration: {
        basic: '2-4 seconds',
        complex: '4-6 seconds',
        advanced: '6-10 seconds',
        performance: '8-15 seconds',
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
  module.exports = KEGGPathwayDemo;
}

if (typeof window !== 'undefined') {
  window.KEGGPathwayDemo = KEGGPathwayDemo;
}
