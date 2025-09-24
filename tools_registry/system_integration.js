/**
 * System Integration for Dynamic Tools Registry
 * Integrates the tools registry with existing Genome AI Studio components
 */

const ToolsRegistryManager = require('./registry_manager');
const path = require('path');

class SystemIntegration {
    constructor() {
        this.registryManager = new ToolsRegistryManager();
        this.integrationStatus = {
            initialized: false,
            lastUpdate: null,
            toolsLoaded: 0,
            categoriesLoaded: 0
        };
    }

    /**
     * Initialize the dynamic tools system
     */
    async initialize() {
        try {
            await this.registryManager.initializeRegistry();
            this.integrationStatus.initialized = true;
            this.integrationStatus.lastUpdate = Date.now();
            
            const stats = await this.registryManager.getRegistryStats();
            this.integrationStatus.toolsLoaded = stats.total_tools;
            this.integrationStatus.categoriesLoaded = stats.total_categories;
            
            console.log('✅ Dynamic Tools System integrated successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize Dynamic Tools System:', error);
            return false;
        }
    }

    /**
     * Generate dynamic system prompt for ChatManager
     */
    async generateDynamicSystemPrompt(userQuery, context = {}) {
        try {
            if (!this.integrationStatus.initialized) {
                await this.initialize();
            }

            // Get relevant tools based on user intent
            const promptData = await this.registryManager.generateSystemPrompt(userQuery, context);
            
            // Generate the enhanced system prompt
            const systemPrompt = this.buildSystemPrompt(promptData, context);
            
            return {
                systemPrompt,
                toolsUsed: promptData.tools,
                toolCount: promptData.totalTools,
                generationTime: Date.now()
            };
        } catch (error) {
            console.error('Failed to generate dynamic system prompt:', error);
            return this.getFallbackSystemPrompt();
        }
    }

    /**
     * Build the complete system prompt with dynamic tools
     */
    buildSystemPrompt(promptData, context) {
        const { tools, toolDescriptions, sampleUsages } = promptData;
        
        return `# Genome AI Studio - Dynamic Tools System

You are an advanced AI assistant for Genome AI Studio, equipped with ${tools.length} dynamically selected tools based on the user's query.

## 🧬 Current Context
- **Genome Browser**: ${context.hasData ? 'Genome data loaded' : 'No genome data loaded'}
- **Network Status**: ${context.hasNetwork ? 'Connected' : 'Offline'}
- **Authentication**: ${context.hasAuth ? 'Authenticated' : 'Not authenticated'}
- **Active Tools**: ${tools.length} tools available

## 🔧 Available Tools (Dynamically Selected)

${toolDescriptions}

## 📚 Tool Usage Examples

${sampleUsages}

## 🎯 Tool Selection Guidelines

1. **Primary Tools**: Use the most specific tool for the task
2. **Tool Chaining**: Combine tools for complex analyses
3. **Error Handling**: Always check tool return values
4. **Context Awareness**: Consider current genome state and loaded data

## ⚡ Response Format

When using tools, respond with ONLY a JSON object:
\`\`\`json
{"tool_name": "tool_name", "parameters": {"param1": "value1"}}
\`\`\`

## 🔄 Tool Relationships

- **Navigation Tools**: Use for genome browser movement
- **Sequence Tools**: Use for DNA/RNA analysis
- **Protein Tools**: Use for structure and function analysis
- **Database Tools**: Use for external data retrieval
- **AI Tools**: Use for advanced AI-powered analysis
- **Editing Tools**: Use for sequence manipulation
- **Plugin Tools**: Use for extended functionality

## 📊 Performance Optimization

- Tools are selected based on user intent analysis
- Only relevant tools are loaded to reduce context size
- Tool usage is tracked for continuous optimization
- Failed tools are automatically retried with fallback options

Remember: You have access to the most relevant tools for the user's specific query. Use them effectively to provide comprehensive genomic analysis and assistance.`;
    }

    /**
     * Get fallback system prompt when dynamic generation fails
     */
    getFallbackSystemPrompt() {
        return {
            systemPrompt: `# Genome AI Studio - Fallback Mode

You are an AI assistant for Genome AI Studio. The dynamic tools system is temporarily unavailable.

## 🔧 Basic Tools Available
- navigate_to_position: Navigate to genomic positions
- get_current_state: Get current browser state
- search_gene_by_name: Search for genes by name
- get_sequence: Retrieve DNA sequences
- compute_gc: Calculate GC content

## ⚡ Response Format
Respond with JSON tool calls:
\`\`\`json
{"tool_name": "tool_name", "parameters": {"param1": "value1"}}
\`\`\`

Please use the available tools to assist with genomic analysis.`,
            toolsUsed: [],
            toolCount: 5,
            generationTime: Date.now()
        };
    }

    /**
     * Track tool usage for optimization
     */
    trackToolUsage(toolName, success, executionTime) {
        this.registryManager.trackToolUsage(toolName, success, executionTime);
    }

    /**
     * Get tool usage statistics
     */
    getToolUsageStats() {
        return this.registryManager.getToolUsageStats();
    }

    /**
     * Get registry statistics
     */
    async getRegistryStats() {
        return await this.registryManager.getRegistryStats();
    }

    /**
     * Update tool definitions (for hot reloading)
     */
    async updateToolDefinition(toolName, definition) {
        try {
            // This would implement hot reloading of tool definitions
            // For now, we'll clear the cache to force reload
            this.registryManager.clearCache();
            return true;
        } catch (error) {
            console.error(`Failed to update tool definition for ${toolName}:`, error);
            return false;
        }
    }

    /**
     * Get tools by category
     */
    async getToolsByCategory(categoryName) {
        return await this.registryManager.getToolsByCategory(categoryName);
    }

    /**
     * Get all available tools
     */
    async getAllTools() {
        return await this.registryManager.getAllTools();
    }

    /**
     * Search tools by keywords
     */
    async searchTools(keywords, limit = 10) {
        const allTools = await this.getAllTools();
        const searchTerms = keywords.toLowerCase().split(' ');
        
        const matchingTools = allTools.filter(tool => {
            const toolKeywords = (tool.keywords || []).join(' ').toLowerCase();
            const toolDescription = (tool.description || '').toLowerCase();
            const toolName = (tool.name || '').toLowerCase();
            
            return searchTerms.some(term => 
                toolKeywords.includes(term) || 
                toolDescription.includes(term) || 
                toolName.includes(term)
            );
        });

        return matchingTools.slice(0, limit);
    }

    /**
     * Get integration status
     */
    getIntegrationStatus() {
        return {
            ...this.integrationStatus,
            uptime: Date.now() - (this.integrationStatus.lastUpdate || 0)
        };
    }

    /**
     * Reset the integration (for testing or recovery)
     */
    async reset() {
        this.registryManager.clearCache();
        this.integrationStatus = {
            initialized: false,
            lastUpdate: null,
            toolsLoaded: 0,
            categoriesLoaded: 0
        };
        await this.initialize();
    }
}

module.exports = SystemIntegration;
