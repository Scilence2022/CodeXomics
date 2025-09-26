/**
 * System Integration for Dynamic Tools Registry
 * Integrates the tools registry with existing Genome AI Studio components
 */

const ToolsRegistryManager = require('./registry_manager');
const BuiltInToolsIntegration = require('./builtin_tools_integration');
const path = require('path');

class SystemIntegration {
    constructor() {
        this.registryManager = new ToolsRegistryManager();
        this.builtInTools = new BuiltInToolsIntegration();
        this.integrationStatus = {
            initialized: false,
            lastUpdate: null,
            toolsLoaded: 0,
            categoriesLoaded: 0,
            builtInToolsLoaded: 0
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
            
            const builtInStats = this.builtInTools.getBuiltInToolsStats();
            this.integrationStatus.builtInToolsLoaded = builtInStats.total_builtin_tools;
            
            console.log('✅ Dynamic Tools System integrated successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize Dynamic Tools System:', error);
            return false;
        }
    }

    /**
     * Generate system prompt for non-dynamic mode (emphasizing built-in tools)
     */
    async generateNonDynamicSystemPrompt(context = {}) {
        try {
            console.log('🎯 [System Integration] Generating non-dynamic system prompt with built-in tools emphasis');
            
            const systemPrompt = this.builtInTools.generateNonDynamicSystemPrompt(context);
            
            return {
                systemPrompt,
                toolsUsed: Array.from(this.builtInTools.builtInToolsMap.keys()),
                toolCount: this.builtInTools.builtInToolsMap.size,
                generationTime: Date.now(),
                mode: 'non-dynamic'
            };
        } catch (error) {
            console.error('Failed to generate non-dynamic system prompt:', error);
            return this.getFallbackSystemPrompt();
        }
    }

    /**
     * Enhanced tool execution with built-in tool detection and routing
     */
    async executeToolWithRouting(toolName, parameters, chatManagerInstance, clientId = null) {
        const startTime = Date.now();
        let success = false;
        let result;
        
        try {
            // Check if it's a built-in tool first
            if (this.builtInTools.isBuiltInTool(toolName)) {
                console.log(`🔧 [System Integration] Routing to built-in tool: ${toolName}`);
                result = await this.builtInTools.executeBuiltInTool(toolName, parameters, chatManagerInstance);
                success = true;
            } else {
                // Route to external tool execution (MCP, plugins, etc.)
                console.log(`🌐 [System Integration] Routing to external tool: ${toolName}`);
                if (chatManagerInstance && typeof chatManagerInstance.executeToolViaMCP === 'function') {
                    result = await chatManagerInstance.executeToolViaMCP(toolName, parameters, clientId);
                } else {
                    throw new Error('External tool execution not available');
                }
                success = true;
            }
            
            // Track tool usage
            this.trackToolUsage(toolName, success, Date.now() - startTime);
            
            return result;
            
        } catch (error) {
            console.error(`❌ [System Integration] Tool execution failed for ${toolName}:`, error);
            this.trackToolUsage(toolName, success, Date.now() - startTime);
            throw error;
        }
    }

    /**
     * Analyze user query and suggest optimal tool execution strategy
     */
    async analyzeToolExecutionStrategy(userQuery, context = {}) {
        try {
            // Analyze for built-in tool relevance
            const builtInRelevance = this.builtInTools.analyzeBuiltInToolRelevance(userQuery);
            
            // Get dynamic tool suggestions
            const dynamicRelevance = await this.registryManager.getRelevantTools(userQuery, context);
            
            // Combine and prioritize
            const strategy = {
                primaryTools: builtInRelevance.filter(t => t.confidence > 0.8),
                secondaryTools: builtInRelevance.filter(t => t.confidence <= 0.8),
                dynamicTools: dynamicRelevance.slice(0, 5), // Top 5 dynamic tools
                executionMode: builtInRelevance.length > 0 ? 'hybrid' : 'dynamic',
                confidence: Math.max(...builtInRelevance.map(t => t.confidence), 0)
            };
            
            console.log('🎯 [System Integration] Execution strategy analysis:', {
                primaryBuiltIn: strategy.primaryTools.length,
                secondaryBuiltIn: strategy.secondaryTools.length,
                dynamic: strategy.dynamicTools.length,
                mode: strategy.executionMode
            });
            
            return strategy;
            
        } catch (error) {
            console.error('Failed to analyze tool execution strategy:', error);
            return {
                primaryTools: [],
                secondaryTools: [],
                dynamicTools: [],
                executionMode: 'fallback',
                confidence: 0
            };
        }
    }
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
     * Build the complete system prompt with dynamic tools and built-in tool integration
     */
    buildSystemPrompt(promptData, context) {
        const { tools, toolDescriptions, sampleUsages } = promptData;
        
        // Separate built-in tools from external tools
        const builtInTools = tools.filter(tool => tool.execution_type === 'built-in' || tool.implementation?.type === 'built-in');
        const externalTools = tools.filter(tool => tool.execution_type !== 'built-in' && tool.implementation?.type !== 'built-in');
        
        // Build detailed genome browser state information
        let genomeStateInfo = '';
        if (context.genomeBrowser) {
            const gb = context.genomeBrowser;
            genomeStateInfo = `
- **Current Chromosome**: ${gb.currentChromosome || 'None'}
- **Current Position**: ${gb.currentPosition ? `${gb.currentPosition.start}-${gb.currentPosition.end}` : 'None'}
- **Visible Tracks**: ${gb.visibleTracks ? gb.visibleTracks.join(', ') : 'None'}
- **Loaded Files**: ${gb.loadedFiles ? gb.loadedFiles.length : 0} files
- **Sequence Length**: ${gb.sequenceLength ? gb.sequenceLength.toLocaleString() + ' bp' : 'Unknown'}
- **Annotations**: ${gb.annotationsCount || 0} annotations
- **User Features**: ${gb.userDefinedFeaturesCount || 0} user-defined features`;
        } else {
            genomeStateInfo = '- **Genome Browser**: No genome data loaded';
        }
        
        // Generate built-in tools section
        const builtInToolDescriptions = builtInTools.map(tool => {
            const params = Object.entries(tool.parameters?.properties || {})
                .map(([name, param]) => `${name}: ${param.type} - ${param.description}`)
                .join(', ');

            return `- **${tool.name}** (Built-in): ${tool.description}\n  Parameters: ${params}\n  Implementation: ChatManager.${tool.implementation?.method || tool.name}`;
        }).join('\n');
        
        // Generate external tools section
        const externalToolDescriptions = externalTools.map(tool => {
            const params = Object.entries(tool.parameters?.properties || {})
                .map(([name, param]) => `${name}: ${param.type} - ${param.description}`)
                .join(', ');

            return `- **${tool.name}**: ${tool.description}\n  Parameters: ${params}`;
        }).join('\n');

        return `# Genome AI Studio - Enhanced Dynamic Tools System

You are an advanced AI assistant for Genome AI Studio, equipped with ${tools.length} dynamically selected tools based on the user's query.

## 🧬 Current Context
${genomeStateInfo}
- **Network Status**: ${context.hasNetwork ? 'Connected' : 'Offline'}
- **Authentication**: ${context.hasAuth ? 'Authenticated' : 'Not authenticated'}
- **Active Tools**: ${tools.length} tools available (${builtInTools.length} built-in, ${externalTools.length} external)

## 🔧 Built-in Tools (Directly Available)

${builtInToolDescriptions || 'No built-in tools selected for this query.'}

## 🌐 External Tools (Via MCP/Plugin System)

${externalToolDescriptions || 'No external tools selected for this query.'}

## 📚 Tool Usage Examples

${sampleUsages}

## 🎯 Enhanced Tool Selection Guidelines

1. **Built-in Tools Priority**: Built-in tools are faster and more reliable - use them when available
2. **File Loading Operations**: Use built-in file loading tools for importing data:
   - load_genome_file: For FASTA/GenBank genome files
   - load_annotation_file: For GFF/BED/GTF annotation files
   - load_variant_file: For VCF variant files
   - load_reads_file: For SAM/BAM read alignment files
   - load_wig_tracks: For WIG/BigWig track files
   - load_operon_file: For operon/regulatory element files
3. **Tool Chaining**: Combine tools for complex analyses
4. **Error Handling**: Always check tool return values
5. **Context Awareness**: Consider current genome state and loaded data

## ⚡ Response Format

When using tools, respond with ONLY a JSON object:
${'```'}json
{"tool_name": "tool_name", "parameters": {"param1": "value1"}}
${'```'}

## 🔄 Tool Categories & Relationships

- **File Loading Tools**: Use for importing various genomic data files
- **Navigation Tools**: Use for genome browser movement
- **Sequence Tools**: Use for DNA/RNA analysis
- **Protein Tools**: Use for structure and function analysis
- **Database Tools**: Use for external data retrieval
- **AI Tools**: Use for advanced AI-powered analysis
- **Editing Tools**: Use for sequence manipulation
- **Plugin Tools**: Use for extended functionality

## 📊 Performance Optimization

- Tools are selected based on advanced user intent analysis with file loading pattern recognition
- Built-in tools are prioritized for better performance
- Only relevant tools are loaded to reduce context size
- Tool usage is tracked for continuous optimization
- Failed tools are automatically retried with fallback options

Remember: You have access to the most relevant tools for the user's specific query, with built-in tools prioritized for file loading and core operations. Use them effectively to provide comprehensive genomic analysis and assistance.`;
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
     * Get comprehensive registry statistics including built-in tools
     */
    async getRegistryStats() {
        const dynamicStats = await this.registryManager.getRegistryStats();
        const builtInStats = this.builtInTools.getBuiltInToolsStats();
        
        return {
            ...dynamicStats,
            builtin_tools: builtInStats.total_builtin_tools,
            builtin_categories: Object.keys(builtInStats.categories).length,
            total_tools_including_builtin: dynamicStats.total_tools + builtInStats.total_builtin_tools,
            builtin_breakdown: builtInStats.categories,
            integration_status: this.integrationStatus
        };
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
