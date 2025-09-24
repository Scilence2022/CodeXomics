/**
 * ChatManager Integration Example
 * Shows how to integrate the dynamic tools registry with existing ChatManager
 */

const SystemIntegration = require('./system_integration');

class ChatManagerWithDynamicTools {
    constructor(app, configManager = null) {
        this.app = app;
        this.configManager = configManager;
        
        // Initialize dynamic tools system
        this.dynamicTools = new SystemIntegration();
        this.toolsInitialized = false;
        
        // Original ChatManager properties
        this.mcpClient = null;
        this.currentContext = null;
        this.conversationHistory = [];
        
        // Initialize the system
        this.initializeDynamicTools();
    }

    /**
     * Initialize the dynamic tools system
     */
    async initializeDynamicTools() {
        try {
            this.toolsInitialized = await this.dynamicTools.initialize();
            if (this.toolsInitialized) {
                console.log('✅ Dynamic Tools System integrated with ChatManager');
            } else {
                console.warn('⚠️ Dynamic Tools System failed to initialize, using fallback');
            }
        } catch (error) {
            console.error('❌ Failed to initialize Dynamic Tools System:', error);
            this.toolsInitialized = false;
        }
    }

    /**
     * Get the enhanced system message with dynamic tools
     */
    async getBaseSystemMessage() {
        try {
            // Get current context
            const context = this.getCurrentContext();
            
            // Generate dynamic system prompt
            const promptData = await this.dynamicTools.generateDynamicSystemPrompt(
                this.getLastUserQuery(),
                context
            );
            
            return promptData.systemPrompt;
        } catch (error) {
            console.error('Failed to generate dynamic system message:', error);
            return this.getFallbackSystemMessage();
        }
    }

    /**
     * Get current context for tool selection
     */
    getCurrentContext() {
        return {
            hasData: this.app?.genomeData?.isLoaded || false,
            hasNetwork: navigator.onLine,
            hasAuth: this.configManager?.hasValidAPIKey() || false,
            currentCategory: this.getCurrentCategory(),
            loadedGenome: this.app?.genomeData?.genomeInfo || null,
            activeTracks: this.app?.genomeData?.activeTracks || [],
            currentPosition: this.app?.genomeData?.currentPosition || null
        };
    }

    /**
     * Get the last user query for intent analysis
     */
    getLastUserQuery() {
        if (this.conversationHistory.length === 0) return '';
        const lastMessage = this.conversationHistory[this.conversationHistory.length - 1];
        return lastMessage.role === 'user' ? lastMessage.content : '';
    }

    /**
     * Get current category based on active tools or context
     */
    getCurrentCategory() {
        // This would be determined based on current analysis context
        if (this.app?.genomeData?.currentAnalysis) {
            return this.app.genomeData.currentAnalysis.category;
        }
        return null;
    }

    /**
     * Enhanced tool execution with tracking
     */
    async executeTool(toolName, parameters, clientId) {
        const startTime = Date.now();
        let success = false;
        
        try {
            // Execute the tool using existing MCP system
            const result = await this.executeToolViaMCP(toolName, parameters, clientId);
            success = true;
            
            // Track tool usage for optimization
            if (this.toolsInitialized) {
                this.dynamicTools.trackToolUsage(
                    toolName, 
                    success, 
                    Date.now() - startTime
                );
            }
            
            return result;
        } catch (error) {
            console.error(`Tool execution failed: ${toolName}`, error);
            
            // Track failed tool usage
            if (this.toolsInitialized) {
                this.dynamicTools.trackToolUsage(
                    toolName, 
                    success, 
                    Date.now() - startTime
                );
            }
            
            throw error;
        }
    }

    /**
     * Execute tool via existing MCP system
     */
    async executeToolViaMCP(toolName, parameters, clientId) {
        // This would integrate with the existing MCP client
        if (this.mcpClient) {
            return await this.mcpClient.callTool(toolName, parameters, clientId);
        } else {
            throw new Error('MCP client not available');
        }
    }

    /**
     * Get fallback system message when dynamic tools fail
     */
    getFallbackSystemMessage() {
        return `# Genome AI Studio - Fallback Mode

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

Please use the available tools to assist with genomic analysis.`;
    }

    /**
     * Get tool usage statistics
     */
    getToolUsageStats() {
        if (this.toolsInitialized) {
            return this.dynamicTools.getToolUsageStats();
        }
        return {};
    }

    /**
     * Get registry statistics
     */
    async getRegistryStats() {
        if (this.toolsInitialized) {
            return await this.dynamicTools.getRegistryStats();
        }
        return { total_tools: 0, total_categories: 0 };
    }

    /**
     * Search for tools by keywords
     */
    async searchTools(keywords, limit = 10) {
        if (this.toolsInitialized) {
            return await this.dynamicTools.searchTools(keywords, limit);
        }
        return [];
    }

    /**
     * Get tools by category
     */
    async getToolsByCategory(categoryName) {
        if (this.toolsInitialized) {
            return await this.dynamicTools.getToolsByCategory(categoryName);
        }
        return [];
    }

    /**
     * Get integration status
     */
    getIntegrationStatus() {
        return {
            toolsInitialized: this.toolsInitialized,
            dynamicToolsStatus: this.dynamicTools.getIntegrationStatus(),
            mcpClientStatus: this.mcpClient ? 'connected' : 'disconnected'
        };
    }

    /**
     * Reset the dynamic tools system
     */
    async resetDynamicTools() {
        if (this.toolsInitialized) {
            await this.dynamicTools.reset();
            this.toolsInitialized = false;
            await this.initializeDynamicTools();
        }
    }

    /**
     * Update conversation history for context
     */
    addToConversationHistory(role, content) {
        this.conversationHistory.push({
            role,
            content,
            timestamp: Date.now()
        });
        
        // Keep only last 50 messages to prevent memory issues
        if (this.conversationHistory.length > 50) {
            this.conversationHistory = this.conversationHistory.slice(-50);
        }
    }

    /**
     * Get conversation context for tool selection
     */
    getConversationContext() {
        return {
            history: this.conversationHistory.slice(-10), // Last 10 messages
            currentQuery: this.getLastUserQuery(),
            context: this.getCurrentContext()
        };
    }
}

module.exports = ChatManagerWithDynamicTools;
