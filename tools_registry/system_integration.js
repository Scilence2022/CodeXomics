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
            console.log('🎯 [System Integration] Generating non-dynamic system prompt with comprehensive tools integration');
            
            // Get all tools from registry for comprehensive integration
            const allRegistryTools = await this.registryManager.getAllTools();
            const builtInToolsInfo = this.builtInTools.getBuiltInToolsStats();
            
            // Organize tools by category
            const toolsByCategory = {};
            const builtInToolNames = new Set(this.builtInTools.builtInToolsMap.keys());
            
            // Add built-in tools first (highest priority)
            for (const [toolName, toolInfo] of this.builtInTools.builtInToolsMap.entries()) {
                if (!toolsByCategory[toolInfo.category]) {
                    toolsByCategory[toolInfo.category] = [];
                }
                toolsByCategory[toolInfo.category].push({
                    name: toolName,
                    type: 'built-in',
                    priority: 1,
                    description: `Built-in ${toolInfo.category} tool`,
                    method: toolInfo.method
                });
            }
            
            // Add registry tools (especially missing export and other tools)
            for (const tool of allRegistryTools) {
                // Skip if it's already included as built-in
                if (builtInToolNames.has(tool.name)) {
                    continue;
                }
                
                if (!toolsByCategory[tool.category]) {
                    toolsByCategory[tool.category] = [];
                }
                
                toolsByCategory[tool.category].push({
                    name: tool.name,
                    type: 'registry',
                    priority: tool.priority || 2,
                    description: tool.description || `${tool.category} tool`,
                    category: tool.category
                });
            }
            
            // Generate comprehensive system prompt
            const systemPrompt = this.generateComprehensiveNonDynamicPrompt(context, toolsByCategory, builtInToolsInfo);
            
            // Collect all tool names
            const allToolNames = [];
            for (const category of Object.values(toolsByCategory)) {
                allToolNames.push(...category.map(tool => tool.name));
            }
            
            console.log(`🎯 [System Integration] Non-dynamic prompt generated with ${allToolNames.length} tools across ${Object.keys(toolsByCategory).length} categories`);
            
            return {
                systemPrompt,
                toolsUsed: allToolNames,
                toolCount: allToolNames.length,
                toolsByCategory,
                generationTime: Date.now(),
                mode: 'non-dynamic-comprehensive'
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

            console.log('🎯 [System Integration] Generating dynamic system prompt for query:', userQuery);
            
            // Get relevant tools from registry
            const registryPromptData = await this.registryManager.generateSystemPrompt(userQuery, context);
            console.log('📋 [System Integration] Registry tools found:', registryPromptData.tools.length);
            
            // Get built-in tool relevance analysis
            const builtInRelevance = this.builtInTools.analyzeBuiltInToolRelevance(userQuery);
            console.log('🔧 [System Integration] Built-in tools analysis:', builtInRelevance.length, 'relevant tools');
            
            // Add tool detection logging for Song's benchmark system
            if (builtInRelevance.length > 0) {
                console.log('📋 [Tool Detection Recording] Built-in tools detected:');
                builtInRelevance.forEach(tool => {
                    console.log(`   ✅ ${tool.name} (confidence: ${tool.confidence.toFixed(2)}) - ${tool.reason}`);
                });
                
                // Record for benchmark analysis if system is available
                if (typeof window !== 'undefined' && window.songBenchmarkDebug) {
                    if (!window.songBenchmarkDebug.toolDetectionLog) {
                        window.songBenchmarkDebug.toolDetectionLog = [];
                    }
                    window.songBenchmarkDebug.toolDetectionLog.push({
                        timestamp: new Date().toISOString(),
                        query: userQuery,
                        detectedBuiltInTools: builtInRelevance.map(t => ({
                            name: t.name,
                            confidence: t.confidence,
                            reason: t.reason,
                            category: this.builtInTools.getBuiltInToolInfo(t.name)?.category
                        })),
                        context: context,
                        detection_source: 'built-in-analysis'
                    });
                }
            }
            
            // Create built-in tool objects for high-confidence matches
            const relevantBuiltInTools = [];
            const externalToolHints = []; // Track external tool hints from built-in analysis
            
            for (const relevantTool of builtInRelevance) {
                if (relevantTool.confidence >= 0.7) { // Include high-confidence built-in tools
                    if (relevantTool.is_external) {
                        // This is a hint for an external tool (like search_features)
                        externalToolHints.push({
                            name: relevantTool.name,
                            confidence: relevantTool.confidence,
                            reason: relevantTool.reason,
                            category: relevantTool.category || 'external'
                        });
                        console.log('🎯 [System Integration] External tool hint detected:', relevantTool.name);
                    } else {
                        const builtInToolInfo = this.builtInTools.getBuiltInToolInfo(relevantTool.name);
                        if (builtInToolInfo) {
                            // Create a tool object that matches the registry format
                            const builtInToolObject = {
                                name: relevantTool.name,
                                description: `Built-in ${builtInToolInfo.category} tool for ${relevantTool.reason}`,
                                category: builtInToolInfo.category,
                                execution_type: 'built-in',
                                implementation: {
                                    type: 'built-in',
                                    method: builtInToolInfo.method
                                },
                                confidence: relevantTool.confidence,
                                type: 'built-in',
                                priority: 1,
                                parameters: { properties: {} } // Minimal parameter structure
                            };
                            relevantBuiltInTools.push(builtInToolObject);
                            console.log('🎯 [System Integration] Added built-in tool:', relevantTool.name, 'confidence:', relevantTool.confidence);
                        }
                    }
                }
            }
            
            // Enhance registry tools with external tool hints
            if (externalToolHints.length > 0) {
                console.log('🎯 [System Integration] Processing external tool hints:', externalToolHints.length);
                for (const hint of externalToolHints) {
                    // Try to find the hinted tool in registry
                    const hintedTool = registryPromptData.tools.find(tool => tool.name === hint.name);
                    if (hintedTool) {
                        // Boost the priority/confidence of the hinted tool
                        hintedTool.hint_boost = true;
                        hintedTool.hint_confidence = hint.confidence;
                        hintedTool.hint_reason = hint.reason;
                        console.log('🚀 [System Integration] Boosted external tool via hint:', hint.name);
                    } else {
                        console.log('⚠️ [System Integration] Hinted tool not found in registry:', hint.name);
                    }
                }
            }
            // Merge built-in tools with registry tools (built-in tools first for priority)
            const combinedTools = [...relevantBuiltInTools, ...registryPromptData.tools];
            
            // Create enhanced prompt data
            const enhancedPromptData = {
                tools: combinedTools,
                toolDescriptions: registryPromptData.toolDescriptions,
                sampleUsages: registryPromptData.sampleUsages,
                totalTools: combinedTools.length
            };
            
            console.log('🎯 [System Integration] Final tool count:', enhancedPromptData.totalTools, 
                       '(Built-in:', relevantBuiltInTools.length, '+ Registry:', registryPromptData.tools.length, ')');
            
            // Comprehensive tool detection recording for Song's benchmark evaluation system
            if (typeof window !== 'undefined' && window.songBenchmarkDebug) {
                if (!window.songBenchmarkDebug.finalToolSelections) {
                    window.songBenchmarkDebug.finalToolSelections = [];
                }
                window.songBenchmarkDebug.finalToolSelections.push({
                    timestamp: new Date().toISOString(),
                    query: userQuery,
                    systemPromptGenerated: true,
                    toolSelection: {
                        totalTools: enhancedPromptData.totalTools,
                        builtInTools: relevantBuiltInTools.map(t => ({
                            name: t.name,
                            category: t.category,
                            confidence: t.confidence,
                            executionType: t.execution_type
                        })),
                        registryTools: registryPromptData.tools.map(t => ({
                            name: t.name,
                            category: t.category || 'unknown',
                            executionType: 'external'
                        }))
                    },
                    context: context,
                    detection_source: 'dynamic-prompt-generation'
                });
                
                console.log('📊 [Tool Detection Recording] Logged final tool selection for benchmark analysis');
            }
            
            // Generate the enhanced system prompt
            const systemPrompt = this.buildSystemPrompt(enhancedPromptData, context);
            
            return {
                systemPrompt,
                toolsUsed: enhancedPromptData.tools,
                toolCount: enhancedPromptData.totalTools,
                builtInToolsIncluded: relevantBuiltInTools.length,
                registryToolsIncluded: registryPromptData.tools.length,
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

**For Single Tool Calls:**
Respond with ONLY a JSON object:
${'```'}json
{"tool_name": "tool_name", "parameters": {"param1": "value1"}}
${'```'}

**For Multiple Sequential Tool Calls:**
When the user requests multiple operations (using words like "Then", "After", "Next", or lists multiple tasks), respond with multiple JSON objects, each in its own code block:
${'```'}json
{"tool_name": "first_tool", "parameters": {"param1": "value1"}}
${'```'}

${'```'}json
{"tool_name": "second_tool", "parameters": {"param1": "value1"}}
${'```'}

${'```'}json
{"tool_name": "third_tool", "parameters": {"param1": "value1"}}
${'```'}

**CRITICAL**: When users request multiple file loading operations or use sequential language ("Then", "After", "Next"), you MUST generate ALL requested tool calls, not just the first one.

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
     * Generate comprehensive non-dynamic system prompt with all tools
     */
    generateComprehensiveNonDynamicPrompt(context, toolsByCategory, builtInToolsInfo) {
        const totalTools = Object.values(toolsByCategory).reduce((sum, tools) => sum + tools.length, 0);
        
        let prompt = `# Genome AI Studio - Comprehensive Tools System (Non-Dynamic Mode)

You are an advanced AI assistant for Genome AI Studio with access to ${totalTools} tools across ${Object.keys(toolsByCategory).length} categories.

## 🧬 Current Context
- **Network Status**: ${context.hasNetwork ? 'Connected' : 'Offline'}
- **Authentication**: ${context.hasAuth ? 'Authenticated' : 'Not authenticated'}
- **Loaded Files**: ${context.loadedFiles || 0} files
- **Current Position**: ${context.currentPosition || 'None'}
- **Data Available**: ${context.hasData !== false ? 'Yes' : 'No'}

`;
        
        // Add tools by category with proper prioritization
        const priorityOrder = ['system', 'file_loading', 'file_operations', 'navigation', 'sequence', 'protein', 'database', 'ai_analysis', 'data_management', 'pathway', 'sequence_editing', 'plugin_management', 'coordination', 'external_apis'];
        
        const sortedCategories = priorityOrder.filter(cat => toolsByCategory[cat]);
        const remainingCategories = Object.keys(toolsByCategory).filter(cat => !priorityOrder.includes(cat));
        const allCategories = [...sortedCategories, ...remainingCategories];
        
        for (const categoryName of allCategories) {
            const tools = toolsByCategory[categoryName];
            if (!tools || tools.length === 0) continue;
            
            const categoryIcon = this.getCategoryIcon(categoryName);
            const builtInTools = tools.filter(t => t.type === 'built-in');
            const registryTools = tools.filter(t => t.type === 'registry');
            
            prompt += `## ${categoryIcon} ${this.getCategoryDisplayName(categoryName)} (${tools.length} tools)\n\n`;
            
            // Show built-in tools first
            if (builtInTools.length > 0) {
                prompt += `### Built-in Tools (Highest Priority):\n`;
                for (const tool of builtInTools) {
                    prompt += `- **${tool.name}**: ${tool.description}\n`;
                }
                prompt += `\n`;
            }
            
            // Show registry tools
            if (registryTools.length > 0) {
                prompt += `### Registry Tools:\n`;
                for (const tool of registryTools) {
                    prompt += `- **${tool.name}**: ${tool.description}\n`;
                }
                prompt += `\n`;
            }
        }
        
        // Add comprehensive instructions
        prompt += `## 🎯 Tool Usage Guidelines

1. **Built-in Tools Priority**: Always prefer built-in tools for core functionality
2. **File Operations**: Use file_loading tools for importing data, file_operations tools for exporting
3. **Export Tools Available**: ${Object.values(toolsByCategory.file_operations || []).filter(t => t.name.includes('export_')).length} export tools for various formats (FASTA, GenBank, GFF, BED, etc.)
4. **Context Awareness**: Tools are available based on current context and data availability
5. **Performance**: Built-in tools execute directly, registry tools may have additional requirements

## ⚡ Response Format

Respond with JSON tool calls:
\`\`\`json
{"tool_name": "tool_name", "parameters": {"param1": "value1"}}
\`\`\`

## 📊 System Status

- **Total Tools**: ${totalTools}
- **Built-in Tools**: ${builtInToolsInfo.total_builtin_tools}
- **Registry Tools**: ${totalTools - builtInToolsInfo.total_builtin_tools}
- **Categories**: ${Object.keys(toolsByCategory).length}
- **Mode**: Non-Dynamic Comprehensive

All tools are statically available in this system prompt for maximum reliability and performance.`;
        
        return prompt;
    }
    
    /**
     * Get category display name
     */
    getCategoryDisplayName(categoryName) {
        const displayNames = {
            'system': 'System Management',
            'file_loading': 'File Loading',
            'file_operations': 'File Operations & Export',
            'navigation': 'Navigation & State',
            'sequence': 'Sequence Analysis',
            'protein': 'Protein Structure',
            'database': 'Database Integration',
            'ai_analysis': 'AI-Powered Analysis',
            'data_management': 'Data Management',
            'pathway': 'Pathway & BLAST',
            'sequence_editing': 'Sequence Editing',
            'plugin_management': 'Plugin Management',
            'coordination': 'Multi-Agent Coordination',
            'external_apis': 'External APIs'
        };
        return displayNames[categoryName] || categoryName.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    
    /**
     * Get category icon
     */
    getCategoryIcon(categoryName) {
        const icons = {
            'system': '⚙️',
            'file_loading': '📁',
            'file_operations': '💾',
            'navigation': '🧭',
            'sequence': '🧬',
            'protein': '🔬',
            'database': '🗄️',
            'ai_analysis': '🤖',
            'data_management': '📊',
            'pathway': '🔄',
            'sequence_editing': '✏️',
            'plugin_management': '🔌',
            'coordination': '🎯',
            'external_apis': '🌐'
        };
        return icons[categoryName] || '🔧';
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

    /**
     * Get parameters for a built-in tool (from YAML definition if available)
     */
    async getBuiltInToolParameters(toolName) {
        try {
            // Try to get the YAML definition first
            const yamlTool = await this.registryManager.getToolDefinition(toolName);
            if (yamlTool && yamlTool.parameters) {
                return yamlTool.parameters;
            }
            
            // Fallback to basic parameter definitions for known built-in tools
            const basicParameters = {
                'set_working_directory': {
                    type: 'object',
                    properties: {
                        directory_path: {
                            type: 'string',
                            description: 'The absolute or relative path to set as working directory'
                        },
                        use_home_directory: {
                            type: 'boolean',
                            description: 'Set to true to use user home directory as working directory'
                        },
                        create_if_missing: {
                            type: 'boolean',
                            description: 'Create the directory if it does not exist',
                            default: false
                        }
                    }
                },
                'load_genome_file': {
                    type: 'object',
                    properties: {
                        file_path: {
                            type: 'string',
                            description: 'Path to the genome file (FASTA or GenBank format)'
                        },
                        file_type: {
                            type: 'string',
                            description: 'Type of genome file (auto-detected if not specified)'
                        }
                    }
                }
            };
            
            return basicParameters[toolName] || { type: 'object', properties: {} };
        } catch (error) {
            console.warn(`Could not get parameters for built-in tool ${toolName}:`, error.message);
            return { type: 'object', properties: {} };
        }
    }
    
    /**
     * Get sample usages for a built-in tool
     */
    async getBuiltInToolSampleUsages(toolName) {
        try {
            // Try to get the YAML definition first
            const yamlTool = await this.registryManager.getToolDefinition(toolName);
            if (yamlTool && yamlTool.sample_usages) {
                return yamlTool.sample_usages;
            }
            
            // Fallback to basic sample usages
            const basicSamples = {
                'set_working_directory': [{
                    user_query: 'Set working directory to /Users/data/genome-files',
                    tool_call: 'set_working_directory(directory_path="/Users/data/genome-files")'
                }],
                'load_genome_file': [{
                    user_query: 'Load genome file from /path/to/genome.fasta',
                    tool_call: 'load_genome_file(file_path="/path/to/genome.fasta")'
                }]
            };
            
            return basicSamples[toolName] || [];
        } catch (error) {
            console.warn(`Could not get sample usages for built-in tool ${toolName}:`, error.message);
            return [];
        }
    }

}

module.exports = SystemIntegration;
