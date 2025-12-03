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
            'function': 'plugin_functions',
            'visualization': 'plugin_visualizations',
            'utility': 'plugin_utilities'
        };
        
        // Plugin type to priority mapping (lower = higher priority)
        this.typeToPriority = {
            'utility': 2,      // High priority for utility plugins
            'function': 3,     // Medium priority for function plugins
            'visualization': 4 // Lower priority for visualization plugins
        };
        
        // Keywords for relevance scoring
        this.pluginKeywords = {
            'protein-interaction-network': [
                'protein', 'interaction', 'network', 'ppi', 'visualize', 
                'pathway', 'p53', 'mdm2', 'node', 'edge', 'graph'
            ],
            'genomic-analysis': [
                'gc', 'content', 'motif', 'diversity', 'compare', 'region',
                'sequence', 'analysis', 'genomic'
            ],
            'phylogenetic-analysis': [
                'phylogenetic', 'tree', 'evolution', 'distance', 'newick',
                'ancestor', 'branch', 'clade'
            ],
            'biological-networks': [
                'network', 'gene', 'regulatory', 'centrality', 'community',
                'hub', 'interaction', 'topology'
            ],
            'ml-analysis': [
                'machine learning', 'predict', 'classify', 'model', 'ml',
                'neural', 'deep learning', 'training'
            ]
        };
        
        console.log('PluginToolsBridge initialized');
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
    }
    
    /**
     * Check if cache is valid
     * @returns {boolean}
     */
    isCacheValid() {
        return this.cachedPluginTools !== null && 
               (Date.now() - this.cacheTimestamp) < this.cacheTimeout;
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
                        required: []
                    },
                    execution: {
                        method: 'pluginManager.executeFunctionByName',
                        args: [toolName]
                    }
                });
            }
        }
        
        // Handle visualization plugins
        if (type === 'visualization') {
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
                            description: 'Data to visualize',
                            properties: {
                                nodes: {
                                    type: 'array',
                                    description: 'Array of nodes (for network visualizations)',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            id: { type: 'string' },
                                            name: { type: 'string' },
                                            type: { type: 'string' }
                                        }
                                    }
                                },
                                edges: {
                                    type: 'array',
                                    description: 'Array of edges (for network visualizations)',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            source: { type: 'string' },
                                            target: { type: 'string' },
                                            confidence: { type: 'number' }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    required: ['data']
                },
                execution: {
                    method: 'pluginVisualization',
                    plugin_id: pluginId
                }
            };
            
            tools.push(visualizeTool);
            
            // Also add renderNetwork alias for network-type visualizations
            if (pluginId.includes('network') || 
                (plugin.supportedDataTypes && plugin.supportedDataTypes.some(t => 
                    t.includes('network') || t.includes('interaction') || t.includes('ppi')
                ))) {
                
                const renderNetworkTool = {
                    ...visualizeTool,
                    name: `${pluginId}.renderNetwork`,
                    description: `Render network visualization using ${plugin.name || pluginId}`
                };
                tools.push(renderNetworkTool);
            }
        }
        
        return tools;
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
            if (queryLower.includes(tool.plugin_id.replace(/-/g, ' ')) ||
                queryLower.includes(tool.plugin_id.replace(/-/g, ''))) {
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
            
            // Check plugin-specific keywords
            const keywords = this.pluginKeywords[tool.plugin_id] || [];
            for (const keyword of keywords) {
                if (queryLower.includes(keyword.toLowerCase())) {
                    score += 20;
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
        const tools = userQuery 
            ? this.getRelevantPluginTools(userQuery, 15)
            : this.getAllPluginTools();
        
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
                    tools: []
                });
            }
            pluginGroups.get(pluginId).tools.push(tool);
        }
        
        // Generate prompt for each plugin
        for (const [pluginId, group] of pluginGroups) {
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
        
        // Add specific examples
        if (pluginGroups.has('protein-interaction-network')) {
            prompt += `- Visualize protein network: {"tool_name": "protein-interaction-network.visualize", "parameters": {"data": {"nodes": [{"id": "TP53", "name": "TP53", "type": "protein"}, {"id": "MDM2", "name": "MDM2", "type": "protein"}], "edges": [{"source": "TP53", "target": "MDM2", "confidence": 0.9}]}}}\n`;
        }
        
        // Add generic examples based on available tools
        for (const tool of tools.slice(0, 3)) {
            if (tool.plugin_type !== 'visualization') {
                const exampleParams = this.generateExampleParameters(tool);
                prompt += `- ${tool.description}: {"tool_name": "${tool.name}", "parameters": ${JSON.stringify(exampleParams)}}\n`;
            }
        }
        
        prompt += '\nNOTE: Plugin tools use the format "plugin-id.function-name" for invocation.\n';
        
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
            timestamp: Date.now()
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
