/**
 * PluginPromptProvider - Plugin prompt management system
 * Allows plugins to provide their own ChatBox prompts and examples
 * Enables dynamic collection and organization of plugin documentation
 */
class PluginPromptProvider {
    constructor() {
        this.pluginPrompts = new Map();
        this.promptCategories = new Map();
        this.initialized = false;
        
        console.log('PluginPromptProvider initialized');
    }

    /**
     * Register plugin prompt information
     * @param {string} pluginId - Plugin identifier
     * @param {Object} promptInfo - Plugin prompt information
     */
    registerPluginPrompts(pluginId, promptInfo) {
        try {
            // Validate prompt info structure
            this.validatePromptInfo(promptInfo);
            
            // Store plugin prompts
            this.pluginPrompts.set(pluginId, {
                ...promptInfo,
                registeredAt: new Date().toISOString()
            });
            
            // Update category mapping
            this.updateCategoryMapping(pluginId, promptInfo.category);
            
            console.log(`✅ Plugin prompts registered: ${pluginId}`);
            
        } catch (error) {
            console.error(`Failed to register prompts for plugin ${pluginId}:`, error);
            throw error;
        }
    }

    /**
     * Validate plugin prompt information structure
     */
    validatePromptInfo(promptInfo) {
        const required = ['name', 'description', 'category', 'functions'];
        
        for (const field of required) {
            if (!promptInfo[field]) {
                throw new Error(`Missing required prompt field: ${field}`);
            }
        }
        
        if (!Array.isArray(promptInfo.functions)) {
            throw new Error('Functions must be an array');
        }
        
        // Validate function structure
        for (const func of promptInfo.functions) {
            if (!func.name || !func.description || !func.examples) {
                throw new Error('Function must have name, description, and examples');
            }
        }
    }

    /**
     * Update category mapping for organization
     */
    updateCategoryMapping(pluginId, category) {
        if (!this.promptCategories.has(category)) {
            this.promptCategories.set(category, []);
        }
        
        const categoryPlugins = this.promptCategories.get(category);
        if (!categoryPlugins.includes(pluginId)) {
            categoryPlugins.push(pluginId);
        }
    }

    /**
     * Generate comprehensive ChatBox system prompt section for all plugins
     */
    generateSystemPromptSection() {
        if (this.pluginPrompts.size === 0) {
            return '';
        }

        let promptSection = '\n\nPLUGIN SYSTEM TOOLS:\n';
        promptSection += '===================\n';

        // Group by category
        const categorizedPrompts = this.getCategorizedPrompts();
        
        for (const [category, plugins] of categorizedPrompts) {
            promptSection += `\n${category.toUpperCase()}:\n`;
            
            for (const pluginId of plugins) {
                const promptInfo = this.pluginPrompts.get(pluginId);
                promptSection += this.generatePluginPromptSection(pluginId, promptInfo);
            }
        }

        // Add comprehensive examples section
        promptSection += this.generateExamplesSection();
        
        return promptSection;
    }

    /**
     * Generate prompt section for a specific plugin
     */
    generatePluginPromptSection(pluginId, promptInfo) {
        let section = `\n**${promptInfo.name}** (${promptInfo.version || '1.0.0'}):\n`;
        section += `${promptInfo.description}\n\n`;

        // Add function descriptions
        section += 'Available Functions:\n';
        for (const func of promptInfo.functions) {
            section += `- ${func.name}: ${func.description}\n`;
            
            // Add parameter info if available
            if (func.parameters) {
                const requiredParams = func.parameters.required || [];
                const allParams = Object.keys(func.parameters.properties || {});
                const paramList = allParams.map(p => requiredParams.includes(p) ? `${p}*` : p).join(', ');
                section += `  Parameters: ${paramList}\n`;
            }
        }

        return section;
    }

    /**
     * Generate comprehensive examples section
     */
    generateExamplesSection() {
        let examplesSection = '\n\nPLUGIN FUNCTION EXAMPLES:\n';
        examplesSection += '========================\n';

        for (const [pluginId, promptInfo] of this.pluginPrompts) {
            if (promptInfo.functions.some(f => f.examples && f.examples.length > 0)) {
                examplesSection += `\n${promptInfo.name}:\n`;
                
                for (const func of promptInfo.functions) {
                    if (func.examples && func.examples.length > 0) {
                        for (const example of func.examples) {
                            const toolName = `${pluginId}.${func.name}`;
                            examplesSection += `- ${example.description}: {"tool_name": "${toolName}", "parameters": ${JSON.stringify(example.parameters)}}\n`;
                        }
                    }
                }
            }
        }

        return examplesSection;
    }

    /**
     * Get tool categories for system prompt
     */
    getToolCategoriesForPrompt() {
        const categories = {};
        
        for (const [category, plugins] of this.promptCategories) {
            const tools = [];
            
            for (const pluginId of plugins) {
                const promptInfo = this.pluginPrompts.get(pluginId);
                for (const func of promptInfo.functions) {
                    tools.push(`${pluginId}.${func.name}`);
                }
            }
            
            if (tools.length > 0) {
                categories[category.toUpperCase()] = tools;
            }
        }
        
        return categories;
    }

    /**
     * Get categorized prompts
     */
    getCategorizedPrompts() {
        return new Map([...this.promptCategories.entries()].sort());
    }

    /**
     * Get all plugin functions for tool listing
     */
    getAllPluginFunctions() {
        const functions = [];
        
        for (const [pluginId, promptInfo] of this.pluginPrompts) {
            for (const func of promptInfo.functions) {
                functions.push({
                    id: `${pluginId}.${func.name}`,
                    name: func.name,
                    description: func.description,
                    category: promptInfo.category,
                    plugin: promptInfo.name
                });
            }
        }
        
        return functions;
    }

    /**
     * Get plugin-specific usage examples
     */
    getPluginExamples(pluginId) {
        const promptInfo = this.pluginPrompts.get(pluginId);
        if (!promptInfo) {
            return [];
        }

        const examples = [];
        for (const func of promptInfo.functions) {
            if (func.examples) {
                for (const example of func.examples) {
                    examples.push({
                        toolName: `${pluginId}.${func.name}`,
                        description: example.description,
                        parameters: example.parameters,
                        userQuery: example.userQuery || null
                    });
                }
            }
        }
        
        return examples;
    }

    /**
     * Get statistics about registered plugins
     */
    getStatistics() {
        const totalFunctions = Array.from(this.pluginPrompts.values())
            .reduce((sum, plugin) => sum + plugin.functions.length, 0);
            
        const categoryCounts = {};
        for (const [category, plugins] of this.promptCategories) {
            categoryCounts[category] = plugins.length;
        }

        return {
            totalPlugins: this.pluginPrompts.size,
            totalFunctions: totalFunctions,
            categories: Object.keys(categoryCounts),
            categoryCounts: categoryCounts
        };
    }

    /**
     * Clear all plugin prompts (for testing)
     */
    clear() {
        this.pluginPrompts.clear();
        this.promptCategories.clear();
        console.log('Plugin prompts cleared');
    }

    /**
     * Check if plugin prompts are registered
     */
    hasPluginPrompts(pluginId) {
        return this.pluginPrompts.has(pluginId);
    }

    /**
     * Get specific plugin prompt info
     */
    getPluginPrompts(pluginId) {
        return this.pluginPrompts.get(pluginId);
    }
}

// Export for module system
export default PluginPromptProvider;
