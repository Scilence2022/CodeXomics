/**
 * STRING Network Explorer - Interactive Demo Script
 *
 * This module provides demo scenarios and execution logic for testing
 * STRING Network Explorer plugin functionality.
 *
 * @version 1.0.0
 * @author GenomeAIStudio Team
 */

class STRINGNetworkDemo {
  constructor(pluginInstance) {
    this.plugin = pluginInstance;
    this.demoData = this.initializeDemoData();
  }

  /**
   * Initialize demo datasets with real biological scenarios
   * Each demo fetches real-time data from STRING database
   */
  initializeDemoData() {
    return {
      basic: {
        name: 'p53 Tumor Suppressor Network',
        description: 'Core p53 signaling pathway proteins - Real-time STRING data',
        complexity: 'basic',
        expectedNodes: 3,
        expectedEdges: '2-5',
        searchConfig: {
          proteins: ['TP53', 'MDM2', 'ATM'],
          species: '9606', // Homo sapiens
          requiredScore: 400,
          networkType: 'physical',
        },
        isRealTimeSearch: true,
        validationRules: {
          minNodes: 2,
          minEdges: 1,
          requiredProteins: ['TP53', 'MDM2', 'ATM'],
        },
      },

      complex: {
        name: 'DNA Damage Response Network',
        description: 'Extended network with 8 proteins in DNA repair pathway - Real-time STRING data',
        complexity: 'complex',
        expectedNodes: 8,
        expectedEdges: '15-30',
        searchConfig: {
          proteins: ['TP53', 'MDM2', 'ATM', 'CHEK2', 'BRCA1', 'RAD51', 'ATR', 'CDKN1A'],
          species: '9606', // Homo sapiens
          requiredScore: 400,
          networkType: 'physical',
        },
        isRealTimeSearch: true,
        validationRules: {
          minNodes: 6,
          minEdges: 10,
          minAvgConfidence: 0.4,
        },
      },

      oncogene: {
        name: 'Oncogene Network Analysis',
        description: 'Key oncogenes and tumor suppressors - Real-time STRING data',
        complexity: 'advanced',
        expectedNodes: 6,
        expectedEdges: '10-25',
        searchConfig: {
          proteins: ['TP53', 'BRCA1', 'BRCA2', 'MYC', 'KRAS', 'APC'],
          species: '9606',
          requiredScore: 500, // Higher confidence threshold
          networkType: 'physical',
        },
        isRealTimeSearch: true,
        validationRules: {
          minNodes: 5,
          minEdges: 8,
          minAvgConfidence: 0.5,
        },
      },

      performance: {
        name: 'Large Pathway Network (Performance Test)',
        description: 'Stress test with major cancer-related proteins',
        complexity: 'performance',
        expectedNodes: 15,
        expectedEdges: '50-100',
        searchConfig: {
          proteins: [
            'TP53',
            'BRCA1',
            'BRCA2',
            'ATM',
            'ATR',
            'CHEK1',
            'CHEK2',
            'MDM2',
            'MDM4',
            'CDKN1A',
            'PTEN',
            'AKT1',
            'KRAS',
            'BRAF',
            'EGFR',
          ],
          species: '9606',
          requiredScore: 400,
          networkType: 'physical',
        },
        isRealTimeSearch: true,
        validationRules: {
          minNodes: 12,
          minEdges: 30,
          maxExecutionTime: 5000, // 5 seconds
        },
      },
    };
  }

  /**
   * Execute demo scenario
   * @param {string} demoKey - Demo scenario identifier
   * @param {Function} logger - Logging callback function
   * @returns {Promise<Object>} Demo execution result
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
      // Execute real-time search
      if (demo.isRealTimeSearch) {
        return await this.fetchRealTimeData(demo.searchConfig, logger, demo.validationRules);
      } else {
        // Static data (not used in STRING plugin, but included for compatibility)
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
   * Fetch real-time data from STRING database
   * @param {Object} config - Search configuration
   * @param {Function} logger - Logging callback
   * @param {Object} validationRules - Validation rules for this demo
   * @returns {Promise<Object>} Search result with validation
   */
  async fetchRealTimeData(config, logger, validationRules) {
    logger('🔍 Fetching real-time data from STRING database...', 'info');
    logger(`  Proteins: ${config.proteins.join(', ')}`, 'info');
    logger(`  Species: ${config.species} (Homo sapiens)`, 'info');
    logger(`  Required Score: ${config.requiredScore}`, 'info');
    logger(`  Network Type: ${config.networkType}`, 'info');

    const startTime = Date.now();

    try {
      // Ensure plugin instance is available
      if (!this.plugin) {
        throw new Error('Plugin instance not available');
      }

      // Call plugin's search method
      let searchResult;

      if (typeof this.plugin.searchProteinInteractions === 'function') {
        logger('  Calling searchProteinInteractions()...', 'info');
        searchResult = await this.plugin.searchProteinInteractions(config);
      } else {
        throw new Error('searchProteinInteractions() method not found in plugin');
      }

      if (!searchResult || !searchResult.success) {
        throw new Error('STRING API search failed or returned no data');
      }

      const executionTime = Date.now() - startTime;

      const data = searchResult.data;
      const nodeCount = data.nodes?.length || 0;
      const edgeCount = data.edges?.length || 0;
      const avgConfidence = edgeCount > 0 ? data.edges.reduce((sum, e) => sum + (e.confidence || 0), 0) / edgeCount : 0;

      logger('✅ Real-time data retrieved from STRING database', 'success');
      logger(`  Nodes: ${nodeCount}`, 'info');
      logger(`  Edges: ${edgeCount}`, 'info');
      logger(`  Avg Confidence: ${avgConfidence.toFixed(3)}`, 'info');
      logger(`  Execution Time: ${executionTime}ms`, 'info');

      // Validate result
      const validation = this.validateResult(searchResult, validationRules);

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
          source: 'STRING',
          species: config.species,
          requiredScore: config.requiredScore,
          networkType: config.networkType,
        },
      };
    } catch (error) {
      logger(`❌ STRING API error: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Validate demo execution result
   * @param {Object} result - Search result from plugin
   * @param {Object} rules - Validation rules
   * @returns {Object} Validation report
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
      validation.errors.push('No data returned from search');
      return validation;
    }

    const data = result.data;
    const nodeCount = data.nodes?.length || 0;
    const edgeCount = data.edges?.length || 0;

    validation.metrics.nodeCount = nodeCount;
    validation.metrics.edgeCount = edgeCount;

    // Validate node count
    if (rules.minNodes && nodeCount < rules.minNodes) {
      validation.isValid = false;
      validation.errors.push(`Insufficient nodes: expected >=${rules.minNodes}, got ${nodeCount}`);
    }

    // Validate edge count
    if (rules.minEdges && edgeCount < rules.minEdges) {
      validation.warnings.push(`Low edge count: expected >=${rules.minEdges}, got ${edgeCount}`);
    }

    // Validate average confidence
    if (rules.minAvgConfidence && edgeCount > 0) {
      const avgConfidence = data.edges.reduce((sum, e) => sum + (e.confidence || 0), 0) / edgeCount;
      validation.metrics.avgConfidence = avgConfidence;

      if (avgConfidence < rules.minAvgConfidence) {
        validation.warnings.push(
          `Low avg confidence: expected >=${rules.minAvgConfidence}, got ${avgConfidence.toFixed(3)}`
        );
      }
    }

    // Validate required proteins
    if (rules.requiredProteins && data.nodes) {
      const nodeIds = new Set(data.nodes.map(n => n.id || n.name));
      const missingProteins = rules.requiredProteins.filter(p => !nodeIds.has(p));

      if (missingProteins.length > 0) {
        validation.warnings.push(`Missing proteins: ${missingProteins.join(', ')}`);
      }
    }

    // Validate execution time
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
   * @returns {Object} Demo metadata
   */
  getMetadata() {
    return {
      pluginId: 'string-network-explorer',
      pluginName: 'STRING Network Explorer',
      version: '1.0.0',
      demoCount: Object.keys(this.demoData).length,
      complexityLevels: ['basic', 'complex', 'advanced', 'performance'],
      requiresNetwork: true,
      estimatedDuration: {
        basic: '2-3 seconds',
        complex: '3-5 seconds',
        advanced: '4-6 seconds',
        performance: '5-10 seconds',
      },
    };
  }

  /**
   * List available demo scenarios
   * @returns {Array<Object>} Demo scenario summaries
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

// Export for Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = STRINGNetworkDemo;
}

// Browser global export
if (typeof window !== 'undefined') {
  window.STRINGNetworkDemo = STRINGNetworkDemo;
}
