/**
 * PluginToolsBridge - Bridge between Plugin System and Dynamic Tool Registry
 *
 * This module provides seamless integration between the PluginManagerV2 plugin system
 * and the Dynamic Tool Registry, ensuring that all installed plugins are discoverable
 * and callable through the LLM's function calling interface.
 *
 * Key responsibilities:
 * 1. Extract plugin functions from PluginManagerV2
 * 2. Convert plugin definitions to registry-compatible tool format
 * 3. Generate system prompt sections for plugin tools
 * 4. Analyze user query relevance for plugin tool selection
 */

class PluginToolsBridge {
  constructor() {
    this.pluginManager = null;
    this.cachedPluginTools = null;
    this.cacheTimestamp = 0;
    this.cacheTimeout = 60000; // 1 minute cache

    // Plugin type to category mapping
    this.typeToCategory = {
      function: 'plugin_functions',
      visualization: 'plugin_visualizations',
      utility: 'plugin_utilities',
    };

    // Plugin type to priority mapping (lower = higher priority)
    this.typeToPriority = {
      utility: 2, // High priority for utility plugins
      function: 3, // Medium priority for function plugins
      visualization: 4, // Lower priority for visualization plugins
    };

    // Keyword extraction configuration
    this.keywordConfig = {
      // Extract from manifest fields
      extractFromFields: ['keywords', 'tags', 'category'],
      // Auto-generate from description
      enableDescriptionParsing: true,
      // Minimum keyword length
      minKeywordLength: 3,
      // Common stop words to exclude
      stopWords: new Set(['the', 'and', 'for', 'with', 'from', 'this', 'that', 'are', 'was', 'will']),
    };

    // Cache for extracted plugin keywords
    this.pluginKeywordsCache = new Map();

    console.log('PluginToolsBridge initialized');
  }

  /**
   * Extract keywords from plugin metadata
   * @param {string} pluginId - Plugin ID
   * @param {Object} plugin - Plugin definition
   * @returns {Array<string>} Extracted keywords
   */
  extractPluginKeywords(pluginId, plugin) {
    // Check cache first
    if (this.pluginKeywordsCache.has(pluginId)) {
      return this.pluginKeywordsCache.get(pluginId);
    }

    const keywords = new Set();

    // 1. Extract from explicitly defined keyword fields
    for (const field of this.keywordConfig.extractFromFields) {
      const value = plugin[field];
      if (Array.isArray(value)) {
        value.forEach(kw => {
          if (typeof kw === 'string' && kw.length >= this.keywordConfig.minKeywordLength) {
            keywords.add(kw.toLowerCase());
          }
        });
      } else if (typeof value === 'string') {
        if (value.length >= this.keywordConfig.minKeywordLength) {
          keywords.add(value.toLowerCase());
        }
      }
    }

    // 2. Parse plugin ID (convert kebab-case to words)
    if (pluginId) {
      const idWords = pluginId.split(/[-_]/);
      idWords.forEach(word => {
        if (
          word.length >= this.keywordConfig.minKeywordLength &&
          !this.keywordConfig.stopWords.has(word.toLowerCase())
        ) {
          keywords.add(word.toLowerCase());
        }
      });
    }

    // 3. Extract from description if enabled
    if (this.keywordConfig.enableDescriptionParsing && plugin.description) {
      const descWords = this.parseDescription(plugin.description);
      descWords.forEach(word => keywords.add(word));
    }

    // 4. Extract from plugin name
    if (plugin.name) {
      const nameWords = plugin.name.split(/\s+/);
      nameWords.forEach(word => {
        const cleaned = word.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        if (cleaned.length >= this.keywordConfig.minKeywordLength && !this.keywordConfig.stopWords.has(cleaned)) {
          keywords.add(cleaned);
        }
      });
    }

    // 5. Extract from command descriptions
    if (plugin.contributes && plugin.contributes.commands) {
      plugin.contributes.commands.forEach(cmd => {
        if (cmd.description) {
          const cmdWords = this.parseDescription(cmd.description);
          cmdWords.forEach(word => keywords.add(word));
        }
        // Extract from command ID
        if (cmd.command) {
          const cmdParts = cmd.command.split(/[.\-_]/);
          cmdParts.forEach(part => {
            if (
              part.length >= this.keywordConfig.minKeywordLength &&
              !this.keywordConfig.stopWords.has(part.toLowerCase())
            ) {
              keywords.add(part.toLowerCase());
            }
          });
        }
      });
    }

    // 6. Extract from supportedDataTypes
    if (plugin.supportedDataTypes) {
      plugin.supportedDataTypes.forEach(dataType => {
        const typeParts = dataType.split(/[-_]/);
        typeParts.forEach(part => {
          if (
            part.length >= this.keywordConfig.minKeywordLength &&
            !this.keywordConfig.stopWords.has(part.toLowerCase())
          ) {
            keywords.add(part.toLowerCase());
          }
        });
      });
    }

    const result = Array.from(keywords);

    // Cache the result
    this.pluginKeywordsCache.set(pluginId, result);

    console.log(`📝 Extracted ${result.length} keywords for ${pluginId}:`, result.slice(0, 10));

    return result;
  }

  /**
   * Parse description text to extract meaningful keywords
   * @param {string} description - Description text
   * @returns {Array<string>} Extracted keywords
   */
  parseDescription(description) {
    const keywords = new Set();

    // Split by common delimiters and clean
    const words = description
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/);

    words.forEach(word => {
      // Remove common suffixes
      const cleaned = word.replace(/(ing|tion|ment|ness|ity)$/, '');

      if (cleaned.length >= this.keywordConfig.minKeywordLength && !this.keywordConfig.stopWords.has(cleaned)) {
        keywords.add(cleaned);
      }
    });

    return Array.from(keywords);
  }

  /**
   * Set the plugin manager instance
   * @param {PluginManagerV2} pluginManager - The plugin manager instance
   */
  setPluginManager(pluginManager) {
    this.pluginManager = pluginManager;
    this.invalidateCache();
    console.log('PluginToolsBridge: PluginManager connected');
  }

  /**
   * Invalidate the cached plugin tools
   */
  invalidateCache() {
    this.cachedPluginTools = null;
    this.cacheTimestamp = 0;
    // Also clear keyword cache when plugin tools change
    this.pluginKeywordsCache.clear();
    console.log('📦 PluginToolsBridge cache invalidated (tools + keywords)');
  }

  /**
   * Check if cache is valid
   * @returns {boolean}
   */
  isCacheValid() {
    return this.cachedPluginTools !== null && Date.now() - this.cacheTimestamp < this.cacheTimeout;
  }

  /**
   * Get all plugin tools in registry-compatible format
   * @returns {Array} Array of tool definitions
   */
  getAllPluginTools() {
    if (this.isCacheValid()) {
      return this.cachedPluginTools;
    }

    if (!this.pluginManager) {
      console.warn('PluginToolsBridge: No PluginManager available');
      return [];
    }

    const pluginTools = [];

    try {
      // Get all plugin registries
      const registries = this.pluginManager.pluginRegistry;

      if (!registries) {
        console.warn('PluginToolsBridge: No plugin registries found');
        return [];
      }

      // Process each plugin type
      for (const [type, registry] of Object.entries(registries)) {
        if (!registry || !(registry instanceof Map)) continue;

        for (const [pluginId, plugin] of registry) {
          // 🔒 SECURITY: Only export enabled plugins to tool registry
          if (plugin.enabled === false) {
            console.log(`🔒 PluginToolsBridge: Skipping disabled plugin: ${pluginId}`);
            continue;
          }

          const tools = this.convertPluginToTools(pluginId, plugin, type);
          pluginTools.push(...tools);
        }
      }

      // Cache the results
      this.cachedPluginTools = pluginTools;
      this.cacheTimestamp = Date.now();

      console.log(`PluginToolsBridge: Loaded ${pluginTools.length} plugin tools`);
    } catch (error) {
      console.error('PluginToolsBridge: Error loading plugin tools:', error);
    }

    return pluginTools;
  }

  /**
   * Convert a plugin definition to tool format
   * @param {string} pluginId - Plugin ID
   * @param {Object} plugin - Plugin definition
   * @param {string} type - Plugin type
   * @returns {Array} Array of tool definitions
   */
  convertPluginToTools(pluginId, plugin, type) {
    const tools = [];
    const category = this.typeToCategory[type] || 'plugin_system';
    const priority = this.typeToPriority[type] || 4;

    // Handle function/utility plugins with explicit functions
    if ((type === 'function' || type === 'utility') && plugin.functions) {
      for (const [funcName, funcDef] of Object.entries(plugin.functions)) {
        const toolName = `${pluginId}.${funcName}`;

        tools.push({
          name: toolName,
          description: funcDef.description || `${pluginId} ${funcName} function`,
          category: category,
          priority: priority,
          source: 'plugin',
          plugin_type: type,
          plugin_id: pluginId,
          plugin_name: plugin.name || pluginId,
          parameters: funcDef.parameters || {
            type: 'object',
            properties: {},
            required: [],
          },
          execution: {
            method: 'pluginManager.executeFunctionByName',
            args: [toolName],
          },
        });
      }
    }

    // Handle visualization plugins
    if (type === 'visualization') {
      // IMPORTANT: Check if plugin has command handlers (e.g., STRING, KEGG, EcoCyc)
      // These plugins should expose their commands as separate tools, not just visualize
      if (plugin._commandHandlers && plugin._commandHandlers.size > 0) {
        // Create tools for each registered command
        for (const [commandId] of plugin._commandHandlers) {
          const commandName = commandId.split('.').pop(); // e.g., 'search' from 'string-explorer.search'
          const toolName = `${pluginId}.${commandName}`;

          // Get command metadata from manifest if available
          const commandMeta = this.getCommandMetadata(plugin, commandId);

          // Define specific parameter schemas for known commands
          let parameters = {
            type: 'object',
            properties: {},
            required: [],
          };

          // STRING Network Explorer specific command parameters
          if (pluginId === 'string-network-explorer') {
            if (commandName === 'searchProteinInteractions' || commandName === 'search') {
              parameters = {
                type: 'object',
                properties: {
                  proteins: {
                    type: 'array',
                    description: 'Array of protein names or identifiers to search (e.g., ["TP53", "MDM2", "BRCA1"])',
                    items: { type: 'string' },
                  },
                  species: {
                    type: 'string',
                    description: 'NCBI Taxonomy ID (default: 9606 for human)',
                    default: '9606',
                  },
                  requiredScore: {
                    type: 'number',
                    description: 'Minimum interaction confidence score (0-1000, default: 400)',
                    default: 400,
                  },
                  networkType: {
                    type: 'string',
                    description: 'Type of network: physical or functional',
                    enum: ['physical', 'functional'],
                    default: 'physical',
                  },
                },
                required: ['proteins'],
              };
            } else if (commandName === 'getNetwork') {
              parameters = {
                type: 'object',
                properties: {
                  proteins: {
                    type: 'array',
                    description: 'Array of protein names',
                    items: { type: 'string' },
                  },
                  species: { type: 'string', default: '9606' },
                  requiredScore: { type: 'number', default: 400 },
                  limit: { type: 'number', description: 'Max interaction partners', default: 50 },
                },
                required: ['proteins'],
              };
            } else if (commandName === 'getEnrichment') {
              parameters = {
                type: 'object',
                properties: {
                  proteins: {
                    type: 'array',
                    description: 'Array of protein names',
                    items: { type: 'string' },
                  },
                  species: { type: 'string', default: '9606' },
                  categories: {
                    type: 'array',
                    description: 'GO categories to analyze',
                    items: { type: 'string' },
                    default: ['Process', 'Component', 'Function'],
                  },
                },
                required: ['proteins'],
              };
            }
          }

          tools.push({
            name: toolName,
            description: commandMeta?.description || `${commandId.split('.')[1]} - ${plugin.name}`,
            category: 'plugin_commands',
            priority: 2, // High priority for data fetching commands
            source: 'plugin',
            plugin_type: 'command',
            plugin_id: pluginId,
            plugin_name: plugin.name || pluginId,
            parameters: parameters,
            execution: {
              method: 'pluginCommand',
              command_id: commandId,
              plugin_id: pluginId,
            },
          });
        }
      }

      // Create the primary visualization tool
      const visualizeTool = {
        name: `${pluginId}.visualize`,
        description: plugin.description || `Visualize data using ${plugin.name || pluginId}`,
        category: 'plugin_visualizations',
        priority: priority,
        source: 'plugin',
        plugin_type: 'visualization',
        plugin_id: pluginId,
        plugin_name: plugin.name || pluginId,
        supported_data_types: plugin.supportedDataTypes || ['generic'],
        parameters: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              description:
                'Network data object containing "nodes" and "edges" arrays. NOTE: This tool DOES NOT fetch data; you must provide the full network object.',
              properties: {
                nodes: {
                  type: 'array',
                  description: 'Array of nodes (e.g. [{"id": "P1", "name": "Protein 1"}])',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' },
                      type: { type: 'string' },
                    },
                    required: ['id'],
                  },
                },
                edges: {
                  type: 'array',
                  description: 'Array of edges (e.g. [{"source": "P1", "target": "P2", "confidence": 0.9}])',
                  items: {
                    type: 'object',
                    properties: {
                      source: { type: 'string' },
                      target: { type: 'string' },
                      confidence: { type: 'number' },
                    },
                    required: ['source', 'target'],
                  },
                },
              },
              required: ['nodes'],
            },
          },
          required: ['data'],
        },
        execution: {
          method: 'pluginVisualization',
          plugin_id: pluginId,
        },
      };

      // Add a special warning for pure visualizers like protein-interaction-network
      if (pluginId === 'protein-interaction-network') {
        visualizeTool.description +=
          '. IMPORTANT: This is a PURE VISUALIZER. It requires a full network data object. If you only have protein names, use "string-network-explorer.search" first to fetch the data.';
      }

      tools.push(visualizeTool);

      // Also add renderNetwork alias for network-type visualizations
      if (
        pluginId.includes('network') ||
        (plugin.supportedDataTypes &&
          plugin.supportedDataTypes.some(t => t.includes('network') || t.includes('interaction') || t.includes('ppi')))
      ) {
        const renderNetworkTool = {
          ...visualizeTool,
          name: `${pluginId}.renderNetwork`,
          description: `Render network visualization using ${plugin.name || pluginId}. Requires full network data object.`,
        };
        tools.push(renderNetworkTool);
      }
    }

    return tools;
  }

  /**
   * Get command metadata from plugin manifest
   * @param {Object} plugin - Plugin object
   * @param {string} commandId - Command ID
   * @returns {Object|null} Command metadata
   */
  getCommandMetadata(plugin, commandId) {
    if (!plugin.contributes || !plugin.contributes.commands) {
      return null;
    }

    return plugin.contributes.commands.find(cmd => cmd.command === commandId) || null;
  }

  /**
   * Get plugin tools relevant to a user query
   * @param {string} userQuery - User's query
   * @param {number} maxTools - Maximum number of tools to return
   * @returns {Array} Array of relevant plugin tools
   */
  getRelevantPluginTools(userQuery, maxTools = 10) {
    const allTools = this.getAllPluginTools();

    if (!userQuery || allTools.length === 0) {
      return allTools.slice(0, maxTools);
    }

    const queryLower = userQuery.toLowerCase();
    const scoredTools = [];

    for (const tool of allTools) {
      let score = 0;

      // Check tool name match
      if (
        queryLower.includes(tool.plugin_id.replace(/-/g, ' ')) ||
        queryLower.includes(tool.plugin_id.replace(/-/g, ''))
      ) {
        score += 50;
      }

      // Check description match
      if (tool.description) {
        const descWords = tool.description.toLowerCase().split(/\s+/);
        for (const word of descWords) {
          if (word.length > 3 && queryLower.includes(word)) {
            score += 10;
          }
        }
      }

      // Check plugin-specific keywords (dynamically extracted)
      if (this.pluginManager) {
        const plugin = this.pluginManager.getPlugin(tool.plugin_id);
        if (plugin) {
          const keywords = this.extractPluginKeywords(tool.plugin_id, plugin);
          for (const keyword of keywords) {
            if (queryLower.includes(keyword.toLowerCase())) {
              score += 20;
            }
          }
        }
      }

      // Check for visualization-related queries
      if (tool.plugin_type === 'visualization') {
        const vizKeywords = ['visualize', 'show', 'display', 'render', 'graph', 'plot', 'chart', 'draw'];
        for (const kw of vizKeywords) {
          if (queryLower.includes(kw)) {
            score += 15;
          }
        }
      }

      // Check for network-related queries
      if (tool.name.includes('network')) {
        const networkKeywords = ['network', 'interaction', 'connection', 'relationship', 'link'];
        for (const kw of networkKeywords) {
          if (queryLower.includes(kw)) {
            score += 20;
          }
        }
      }

      // Check supported data types
      if (tool.supported_data_types) {
        for (const dataType of tool.supported_data_types) {
          if (queryLower.includes(dataType.replace(/-/g, ' '))) {
            score += 25;
          }
        }
      }

      scoredTools.push({ tool, score });
    }

    // Sort by score and return top tools
    scoredTools.sort((a, b) => b.score - a.score);

    // Return tools with score > 0, or top tools if none match
    const relevantTools = scoredTools
      .filter(st => st.score > 0)
      .slice(0, maxTools)
      .map(st => st.tool);

    if (relevantTools.length === 0) {
      // Return some tools even if no direct match
      return scoredTools.slice(0, Math.min(3, maxTools)).map(st => st.tool);
    }

    return relevantTools;
  }

  /**
   * Generate system prompt section for plugin tools
   * @param {string} userQuery - User's query for relevance filtering
   * @returns {string} System prompt section
   */
  generatePluginToolsPromptSection(userQuery = '') {
    const tools = userQuery ? this.getRelevantPluginTools(userQuery, 15) : this.getAllPluginTools();

    if (tools.length === 0) {
      return '';
    }

    let prompt = '\n\n=== PLUGIN SYSTEM TOOLS ===\n';
    prompt += 'The following plugin tools are available through the Plugin System:\n\n';

    // Group by plugin
    const pluginGroups = new Map();
    for (const tool of tools) {
      const pluginId = tool.plugin_id;
      if (!pluginGroups.has(pluginId)) {
        pluginGroups.set(pluginId, {
          name: tool.plugin_name,
          type: tool.plugin_type,
          tools: [],
        });
      }
      pluginGroups.get(pluginId).tools.push(tool);
    }

    // Generate prompt for each plugin
    for (const [, group] of pluginGroups) {
      prompt += `**${group.name}** (${group.type}):\n`;

      for (const tool of group.tools) {
        prompt += `  - ${tool.name}: ${tool.description}\n`;

        // Add parameter hints for visualization tools
        if (tool.plugin_type === 'visualization' && tool.parameters?.properties?.data) {
          prompt += `    Usage: {"tool_name": "${tool.name}", "parameters": {"data": {"nodes": [...], "edges": [...]}}}\n`;
        }
      }
      prompt += '\n';
    }

    prompt += 'PLUGIN TOOL EXAMPLES:\n';

    // Add STRING Network Explorer specific workflow example
    if (pluginGroups.has('string-network-explorer')) {
      prompt += `\n**STRING Network Explorer Workflow:**\n`;
      prompt += `1. Search proteins: {"tool_name": "string-network-explorer.search", "parameters": {"proteins": ["TP53", "MDM2"], "species": "9606", "requiredScore": 400}}\n`;
      prompt += `2. Visualize results: {"tool_name": "string-network-explorer.visualize", "parameters": {"data": <result_from_search>}}\n`;
      prompt += `\nIMPORTANT: For STRING plugin, always call 'search' or 'getNetwork' first to fetch data, then use 'visualize' to display it.\n`;
    }

    // Add specific examples
    if (pluginGroups.has('protein-interaction-network')) {
      prompt += `\n**Protein Interaction Network Workflow:**\n`;
      prompt += `IMPORTANT: This plugin is a pure visualizer and does NOT fetch data itself. You must provide a full JSON object with "nodes" and "edges".\n`;
      prompt += `Example: {"tool_name": "protein-interaction-network.visualize", "parameters": {"data": {"nodes": [{"id": "P1", "name": "Prot1"}, {"id": "P2", "name": "Prot2"}], "edges": [{"source": "P1", "target": "P2"}]}}}\n`;
      prompt += `If you only have protein names, use "string-network-explorer.search" first, then pass its result to this tool.\n`;
    }

    // Add generic examples based on available tools
    for (const tool of tools.slice(0, 3)) {
      if (tool.plugin_type !== 'visualization' && tool.plugin_type !== 'command') {
        const exampleParams = this.generateExampleParameters(tool);
        prompt += `- ${tool.description}: {"tool_name": "${tool.name}", "parameters": ${JSON.stringify(exampleParams)}}\n`;
      }
    }

    prompt += '\nNOTE: Plugin tools use the format "plugin-id.function-name" for invocation.\n';
    prompt +=
      'For database plugins (STRING, KEGG, EcoCyc), call search/fetch commands BEFORE visualization commands.\n';

    return prompt;
  }

  /**
   * Generate example parameters for a tool
   * @param {Object} tool - Tool definition
   * @returns {Object} Example parameters
   */
  generateExampleParameters(tool) {
    if (!tool.parameters || !tool.parameters.properties) {
      return {};
    }

    const example = {};
    const props = tool.parameters.properties;
    const required = tool.parameters.required || [];

    for (const [key, schema] of Object.entries(props)) {
      if (required.includes(key) || Object.keys(example).length < 2) {
        switch (schema.type) {
          case 'string':
            example[key] = schema.example || 'example_value';
            break;
          case 'number':
            example[key] = schema.example || 0.7;
            break;
          case 'array':
            example[key] = schema.example || [];
            break;
          case 'object':
            example[key] = schema.example || {};
            break;
          case 'boolean':
            example[key] = schema.example !== undefined ? schema.example : true;
            break;
          default:
            example[key] = null;
        }
      }
    }

    return example;
  }

  /**
   * Get plugin tool by name
   * @param {string} toolName - Full tool name (plugin-id.function-name)
   * @returns {Object|null} Tool definition or null if not found
   */
  getPluginTool(toolName) {
    const allTools = this.getAllPluginTools();
    return allTools.find(t => t.name === toolName) || null;
  }

  /**
   * Check if a tool name is a plugin tool
   * @param {string} toolName - Tool name to check
   * @returns {boolean}
   */
  isPluginTool(toolName) {
    if (!toolName || !toolName.includes('.')) {
      return false;
    }

    const tool = this.getPluginTool(toolName);
    return tool !== null;
  }

  /**
   * Get statistics about available plugin tools
   * @returns {Object} Statistics object
   */
  getStatistics() {
    const allTools = this.getAllPluginTools();

    const stats = {
      totalPluginTools: allTools.length,
      byType: {},
      byPlugin: {},
      timestamp: Date.now(),
    };

    for (const tool of allTools) {
      // Count by type
      const type = tool.plugin_type;
      stats.byType[type] = (stats.byType[type] || 0) + 1;

      // Count by plugin
      const pluginId = tool.plugin_id;
      stats.byPlugin[pluginId] = (stats.byPlugin[pluginId] || 0) + 1;
    }

    return stats;
  }
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PluginToolsBridge;
}

// Export for browser
if (typeof window !== 'undefined') {
  window.PluginToolsBridge = PluginToolsBridge;
}
