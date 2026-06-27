/**
 * PluginFunctionCallsIntegrator - plugin function-call integrator
 * Ensures plugin-system features can be correctly invoked by the ChatBox LLM via function calling
 */
class PluginFunctionCallsIntegrator {
  constructor(chatManager, pluginManager) {
    this.chatManager = chatManager;
    this.pluginManager = pluginManager;

    // Plugin function map
    this.pluginFunctionMap = new Map();

    // Initialize the plugin function map
    this.initializePluginFunctionMap();

    console.log('PluginFunctionCallsIntegrator initialized');
  }

  /**
   * Initialize the plugin function map
   */
  initializePluginFunctionMap() {
    if (!this.pluginManager) {
      console.warn('PluginManager not available for function mapping');
      return;
    }

    try {
      const availableFunctions = this.pluginManager.getAvailableFunctions();

      for (const func of availableFunctions) {
        this.pluginFunctionMap.set(func.name, {
          pluginId: func.plugin.id,
          functionName: func.name.split('.')[1],
          description: func.description,
          parameters: func.parameters,
          plugin: func.plugin,
        });
      }

      console.log(`Mapped ${this.pluginFunctionMap.size} plugin functions for LLM calling`);
    } catch (error) {
      console.error('Failed to initialize plugin function map:', error);
    }
  }

  /**
   * Check whether this is a plugin function call
   * @param {string} toolName - the tool name
   * @returns {boolean}
   */
  isPluginFunction(toolName) {
    return this.pluginFunctionMap.has(toolName);
  }

  /**
   * Execute a plugin function
   * @param {string} toolName - the tool name
   * @param {Object} parameters - the parameters
   * @returns {Promise<Object>} the execution result
   */
  async executePluginFunction(toolName, parameters) {
    if (!this.isPluginFunction(toolName)) {
      throw new Error(`Plugin function not found: ${toolName}`);
    }

    const functionInfo = this.pluginFunctionMap.get(toolName);

    try {
      console.log(`Executing plugin function: ${toolName}`);
      console.log(`Plugin: ${functionInfo.plugin.name} v${functionInfo.plugin.version}`);
      console.log(`Parameters:`, parameters);

      // Execute the feature through PluginManager
      const result = await this.pluginManager.executeFunctionByName(toolName, parameters);

      console.log(`Plugin function ${toolName} executed successfully:`, result);

      // Wrap the result in a uniform format
      return {
        success: true,
        result: result,
        plugin: functionInfo.plugin,
        functionName: toolName,
        parameters: parameters,
        executionTime: Date.now(),
      };
    } catch (error) {
      console.error(`Plugin function execution failed for ${toolName}:`, error);
      throw new Error(`Plugin function ${toolName} failed: ${error.message}`);
    }
  }

  /**
   * Get the LLM system info for all plugin features
   * @returns {string} the system info string
   */
  getPluginFunctionsSystemInfo() {
    if (this.pluginFunctionMap.size === 0) {
      return 'No plugin functions available.';
    }

    let info = '';

    // Group by plugin
    const pluginGroups = new Map();
    for (const [functionName, functionInfo] of this.pluginFunctionMap) {
      const pluginId = functionInfo.pluginId;
      if (!pluginGroups.has(pluginId)) {
        pluginGroups.set(pluginId, {
          plugin: functionInfo.plugin,
          functions: [],
        });
      }
      pluginGroups.get(pluginId).functions.push({
        name: functionName,
        description: functionInfo.description,
        parameters: functionInfo.parameters,
      });
    }

    info += 'PLUGIN SYSTEM FUNCTIONS:\\n';
    info += '======================\\n';

    for (const [, group] of pluginGroups) {
      info += `\\n**${group.plugin.name}** (${group.plugin.version}):\\n`;

      for (const func of group.functions) {
        info += `- ${func.name}: ${func.description}\\n`;

        // Add parameter info
        if (func.parameters && func.parameters.properties) {
          const requiredParams = func.parameters.required || [];
          const paramList = Object.keys(func.parameters.properties)
            .map(param => (requiredParams.includes(param) ? `${param}*` : param))
            .join(', ');
          info += `  Parameters: ${paramList}\\n`;
        }
      }
    }

    info += '\\nPLUGIN FUNCTION CALLING EXAMPLES:\\n';
    info += '================================\\n';

    // Provide examples for each plugin category
    const examples = this.generatePluginExamples();
    for (const example of examples) {
      info += `- ${example.description}:\\n`;
      info += `  ${JSON.stringify(example.call)}\\n`;
    }

    info +=
      '\\nNOTE: Plugin functions are executed in a sandboxed environment with access to MicrobeGenomicsFunctions and safe app interfaces.\\n';

    return info;
  }

  /**
   * Generate plugin function-call examples
   * @returns {Array} the array of examples
   */
  generatePluginExamples() {
    const examples = [];

    // Genome analysis examples
    if (this.pluginFunctionMap.has('genomic-analysis.analyzeGCContent')) {
      examples.push({
        description: 'Analyze GC content in genomic region',
        call: {
          tool_name: 'genomic-analysis.analyzeGCContent',
          parameters: {
            chromosome: 'chr1',
            start: 1000,
            end: 5000,
            windowSize: 1000,
          },
        },
      });
    }

    if (this.pluginFunctionMap.has('genomic-analysis.findMotifs')) {
      examples.push({
        description: 'Find sequence motifs',
        call: {
          tool_name: 'genomic-analysis.findMotifs',
          parameters: {
            chromosome: 'chr1',
            start: 1000,
            end: 5000,
            motif: 'GAATTC',
            strand: 'both',
          },
        },
      });
    }

    // Phylogenetic analysis examples
    if (this.pluginFunctionMap.has('phylogenetic-analysis.buildPhylogeneticTree')) {
      examples.push({
        description: 'Build phylogenetic tree',
        call: {
          tool_name: 'phylogenetic-analysis.buildPhylogeneticTree',
          parameters: {
            sequences: [
              { id: 'seq1', sequence: 'ATGCGCTATCG', name: 'Sequence 1' },
              { id: 'seq2', sequence: 'ATGAAAGAATT', name: 'Sequence 2' },
            ],
            method: 'nj',
            distanceMetric: 'hamming',
          },
        },
      });
    }

    // Machine learning analysis examples
    if (this.pluginFunctionMap.has('ml-analysis.predictGeneFunction')) {
      examples.push({
        description: 'Predict gene function using ML',
        call: {
          tool_name: 'ml-analysis.predictGeneFunction',
          parameters: {
            sequence: 'ATGCGCTATCGATGAAAGAATT',
            model: 'cnn',
            threshold: 0.7,
          },
        },
      });
    }

    // Biological network analysis examples
    if (this.pluginFunctionMap.has('biological-networks.buildProteinInteractionNetwork')) {
      examples.push({
        description: 'Build protein interaction network',
        call: {
          tool_name: 'biological-networks.buildProteinInteractionNetwork',
          parameters: {
            proteins: ['TP53', 'MDM2', 'ATM', 'CHEK2'],
            confidenceThreshold: 0.7,
            interactionDatabase: 'string',
          },
        },
      });
    }

    return examples;
  }

  /**
   * Validate plugin function parameters
   * @param {string} toolName - the tool name
   * @param {Object} parameters - the parameters
   * @returns {boolean} the validation result
   */
  validatePluginFunctionParameters(toolName, parameters) {
    if (!this.isPluginFunction(toolName)) {
      return false;
    }

    const functionInfo = this.pluginFunctionMap.get(toolName);

    try {
      // Use PluginManager's parameter validation
      this.pluginManager.validateParameters(parameters, functionInfo.parameters);
      return true;
    } catch (error) {
      console.warn(`Plugin function parameter validation failed for ${toolName}:`, error.message);
      return false;
    }
  }

  /**
   * Get the category info for a plugin feature
   * @param {string} toolName - the tool name
   * @returns {Object|null} the category info
   */
  getPluginFunctionCategory(toolName) {
    if (!this.isPluginFunction(toolName)) {
      return null;
    }

    const functionInfo = this.pluginFunctionMap.get(toolName);
    const pluginId = functionInfo.pluginId;

    // Determine the category from the plugin ID
    if (pluginId === 'genomic-analysis') {
      return {
        name: 'pluginGenomicAnalysis',
        priority: 3,
        description: 'Plugin-based genomic analysis functions',
      };
    } else if (pluginId === 'phylogenetic-analysis') {
      return {
        name: 'pluginPhylogenetic',
        priority: 4,
        description: 'Plugin-based phylogenetic analysis functions',
      };
    } else if (pluginId === 'biological-networks') {
      return {
        name: 'pluginNetworkAnalysis',
        priority: 4,
        description: 'Plugin-based biological network analysis functions',
      };
    } else if (pluginId === 'ml-analysis') {
      return {
        name: 'pluginMachineLearning',
        priority: 4,
        description: 'Plugin-based machine learning analysis functions',
      };
    }

    // Default category
    return {
      name: 'pluginGeneral',
      priority: 3,
      description: 'General plugin functions',
    };
  }

  /**
   * Refresh the plugin function map (called when the plugin system updates)
   */
  refreshPluginFunctionMap() {
    this.pluginFunctionMap.clear();
    this.initializePluginFunctionMap();
    console.log('Plugin function map refreshed');
  }

  /**
   * Get plugin feature statistics
   * @returns {Object} the statistics
   */
  getPluginFunctionStats() {
    const stats = {
      totalFunctions: this.pluginFunctionMap.size,
      pluginCounts: new Map(),
      categoryStats: new Map(),
    };

    for (const [, functionInfo] of this.pluginFunctionMap) {
      const pluginId = functionInfo.pluginId;
      const category = this.getPluginFunctionCategory(functionInfo.name);

      // Count the plugins
      stats.pluginCounts.set(pluginId, (stats.pluginCounts.get(pluginId) || 0) + 1);

      // Count the categories
      if (category) {
        stats.categoryStats.set(category.name, (stats.categoryStats.get(category.name) || 0) + 1);
      }
    }

    return {
      ...stats,
      pluginCounts: Object.fromEntries(stats.pluginCounts),
      categoryStats: Object.fromEntries(stats.categoryStats),
    };
  }
}

// Export the class
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PluginFunctionCallsIntegrator;
}
