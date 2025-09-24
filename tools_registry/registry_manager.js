/**
 * Genome AI Studio Tools Registry Manager
 * Implements dynamic tool retrieval and injection system
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');

class ToolsRegistryManager {
    constructor() {
        this.registryPath = __dirname;
        this.toolsCache = new Map();
        this.categoriesCache = null;
        this.lastCacheUpdate = 0;
        this.cacheTimeout = 300000; // 5 minutes
        
        // Tool usage tracking
        this.usageStats = new Map();
        this.userContext = new Map();
        
        // Initialize
        this.initializeRegistry();
    }

    /**
     * Initialize the tools registry
     */
    async initializeRegistry() {
        try {
            await this.loadCategories();
            await this.preloadCriticalTools();
            console.log('✅ Tools Registry Manager initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Tools Registry Manager:', error);
        }
    }

    /**
     * Load tool categories metadata
     */
    async loadCategories() {
        try {
            const categoriesPath = path.join(this.registryPath, 'tool_categories.yaml');
            const categoriesData = await fs.readFile(categoriesPath, 'utf8');
            this.categoriesCache = yaml.load(categoriesData);
        } catch (error) {
            console.error('Failed to load tool categories:', error);
            this.categoriesCache = { categories: {} };
        }
    }

    /**
     * Preload critical tools for faster access
     */
    async preloadCriticalTools() {
        const criticalTools = [
            'navigate_to_position',
            'get_current_state',
            'search_gene_by_name',
            'get_sequence',
            'compute_gc'
        ];

        for (const toolName of criticalTools) {
            try {
                await this.getToolDefinition(toolName);
            } catch (error) {
                console.warn(`Failed to preload critical tool ${toolName}:`, error);
            }
        }
    }

    /**
     * Get tool definition by name
     */
    async getToolDefinition(toolName) {
        // Check cache first
        if (this.toolsCache.has(toolName)) {
            const cached = this.toolsCache.get(toolName);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.definition;
            }
        }

        // Load from file
        try {
            const toolPath = await this.findToolFile(toolName);
            const toolData = await fs.readFile(toolPath, 'utf8');
            const definition = yaml.load(toolData);

            // Cache the definition
            this.toolsCache.set(toolName, {
                definition,
                timestamp: Date.now()
            });

            return definition;
        } catch (error) {
            console.error(`Failed to load tool definition for ${toolName}:`, error);
            throw new Error(`Tool not found: ${toolName}`);
        }
    }

    /**
     * Find tool file in the registry
     */
    async findToolFile(toolName) {
        const categories = this.categoriesCache?.categories || {};
        
        for (const [categoryName, categoryInfo] of Object.entries(categories)) {
            const categoryPath = path.join(this.registryPath, categoryName);
            
            try {
                const toolFile = path.join(categoryPath, `${toolName}.yaml`);
                await fs.access(toolFile);
                return toolFile;
            } catch (error) {
                // Tool not found in this category, continue searching
                continue;
            }
        }
        
        throw new Error(`Tool file not found: ${toolName}.yaml`);
    }

    /**
     * Get tools by category
     */
    async getToolsByCategory(categoryName) {
        try {
            const categoryPath = path.join(this.registryPath, categoryName);
            const files = await fs.readdir(categoryPath);
            const yamlFiles = files.filter(file => file.endsWith('.yaml'));
            
            const tools = [];
            for (const file of yamlFiles) {
                const toolName = path.basename(file, '.yaml');
                try {
                    const definition = await this.getToolDefinition(toolName);
                    tools.push(definition);
                } catch (error) {
                    console.warn(`Failed to load tool ${toolName}:`, error);
                }
            }
            
            return tools;
        } catch (error) {
            console.error(`Failed to load tools for category ${categoryName}:`, error);
            return [];
        }
    }

    /**
     * Get all available tools
     */
    async getAllTools() {
        const allTools = [];
        const categories = this.categoriesCache?.categories || {};
        console.log('🔍 [Dynamic Tools] Available categories:', Object.keys(categories));
        
        for (const categoryName of Object.keys(categories)) {
            const categoryTools = await this.getToolsByCategory(categoryName);
            console.log('🔍 [Dynamic Tools] Category', categoryName, 'has', categoryTools.length, 'tools');
            allTools.push(...categoryTools);
        }
        
        console.log('🔍 [Dynamic Tools] Total tools loaded:', allTools.length);
        return allTools;
    }

    /**
     * Dynamic tool retrieval based on user intent
     */
    async getRelevantTools(userQuery, context = {}) {
        try {
            console.log('🔍 [Dynamic Tools] Analyzing query:', userQuery);
            console.log('🔍 [Dynamic Tools] Context:', context);
            
            // Analyze user intent
            const intent = await this.analyzeUserIntent(userQuery);
            console.log('🔍 [Dynamic Tools] Detected intent:', intent);
            
            // Get candidate tools
            const candidateTools = await this.getCandidateTools(intent, context);
            console.log('🔍 [Dynamic Tools] Candidate tools count:', candidateTools.length);
            
            // Score and rank tools
        const scoredTools = await this.scoreTools(candidateTools, intent, context);
        console.log('🔍 [Dynamic Tools] Scored tools count:', scoredTools.length);
        
        // Debug: Show top scored tools
        console.log('🔍 [Dynamic Tools] Top scored tools:');
        scoredTools.slice(0, 5).forEach((tool, index) => {
            console.log(`  ${index + 1}. ${tool.tool.name} (score: ${tool.score})`);
        });
            
            // Return top relevant tools
            const relevantTools = scoredTools
                .sort((a, b) => b.score - a.score)
                .slice(0, 10) // Top 10 most relevant tools
                .map(item => item.tool);
                
            console.log('🔍 [Dynamic Tools] Final relevant tools count:', relevantTools.length);
            return relevantTools;
                
        } catch (error) {
            console.error('Failed to get relevant tools:', error);
            return await this.getFallbackTools();
        }
    }

    /**
     * Analyze user intent from query
     */
    async analyzeUserIntent(userQuery) {
        const query = userQuery.toLowerCase();
        console.log('🔍 [Dynamic Tools] Analyzing intent for query:', query);
        
        // Intent keywords mapping
        const intentKeywords = {
            navigation: ['navigate', 'go to', 'jump', 'position', 'location', 'move', 'go', 'navigate to'],
            search: ['search', 'find', 'look for', 'query', 'locate'],
            analysis: ['analyze', 'calculate', 'compute', 'measure', 'count', 'analysis'],
            sequence: ['sequence', 'dna', 'rna', 'protein', 'amino acid'],
            structure: ['structure', '3d', 'pdb', 'alphafold', 'protein structure'],
            database: ['database', 'uniprot', 'interpro', 'lookup', 'entry'],
            editing: ['edit', 'modify', 'change', 'replace', 'insert', 'delete'],
            pathway: ['pathway', 'metabolic', 'kegg', 'reaction', 'enzyme'],
            blast: ['blast', 'similarity', 'align', 'match', 'homolog'],
            plugin: ['plugin', 'install', 'enable', 'disable', 'marketplace']
        };

        const detectedIntents = [];
        
        for (const [intent, keywords] of Object.entries(intentKeywords)) {
            const matches = keywords.filter(keyword => {
                // Handle multi-word keywords like "go to"
                if (keyword.includes(' ')) {
                    return query.includes(keyword);
                } else {
                    return query.includes(keyword);
                }
            });
            if (matches.length > 0) {
                detectedIntents.push({
                    intent,
                    confidence: matches.length / keywords.length,
                    keywords: matches
                });
                console.log('🔍 [Dynamic Tools] Intent detected:', intent, 'matches:', matches, 'confidence:', matches.length / keywords.length);
            }
        }

        // Special handling for position/coordinate patterns
        if (query.match(/\d+-\d+/) || query.match(/\d+:\d+/) || query.match(/position\s+\d+/)) {
            if (!detectedIntents.some(intent => intent.intent === 'navigation')) {
                detectedIntents.push({
                    intent: 'navigation',
                    confidence: 0.8,
                    keywords: ['position', 'coordinates']
                });
                console.log('🔍 [Dynamic Tools] Position pattern detected, adding navigation intent');
            }
        }

        const result = {
            primary: detectedIntents.sort((a, b) => b.confidence - a.confidence)[0]?.intent || 'general',
            all: detectedIntents,
            query: userQuery
        };
        
        console.log('🔍 [Dynamic Tools] Final intent analysis:', result);
        return result;
    }

    /**
     * Get candidate tools based on intent
     */
    async getCandidateTools(intent, context) {
        const allTools = await this.getAllTools();
        console.log('🔍 [Dynamic Tools] Total tools available:', allTools.length);
        
        // Extract query keywords for direct matching
        const queryKeywords = intent.query.toLowerCase().split(/\s+/).filter(word => 
            word.length > 2 && !['the', 'and', 'or', 'of', 'in', 'to', 'for', 'with', 'by'].includes(word)
        );
        console.log('🔍 [Dynamic Tools] Query keywords:', queryKeywords);
        
        // Filter by intent
        const intentKeywords = this.getIntentKeywords(intent.primary);
        console.log('🔍 [Dynamic Tools] Intent keywords:', intentKeywords);
        
        const intentFiltered = allTools.filter(tool => {
            const toolKeywords = tool.keywords || [];
            
            // Check intent keyword matches
            const intentMatches = intentKeywords.some(keyword => 
                toolKeywords.some(toolKeyword => 
                    toolKeyword.toLowerCase().includes(keyword.toLowerCase())
                )
            );
            
            // Check direct query keyword matches (higher priority)
            const queryMatches = queryKeywords.some(queryKeyword => 
                toolKeywords.some(toolKeyword => 
                    toolKeyword.toLowerCase().includes(queryKeyword.toLowerCase())
                )
            );
            
            const matches = intentMatches || queryMatches;
            if (matches) {
                console.log('🔍 [Dynamic Tools] Tool matched by intent:', tool.name, 'keywords:', toolKeywords, 'query matches:', queryMatches);
            }
            return matches;
        });
        console.log('🔍 [Dynamic Tools] Intent filtered tools count:', intentFiltered.length);

        // Filter by context
        const contextFiltered = intentFiltered.filter(tool => {
            // Check if tool requires specific context
            if (tool.execution?.requires_auth && !context.hasAuth) {
                console.log('🔍 [Dynamic Tools] Tool filtered out (requires auth):', tool.name);
                return false;
            }
            if (tool.execution?.requires_data && !context.hasData) {
                console.log('🔍 [Dynamic Tools] Tool filtered out (requires data):', tool.name);
                return false;
            }
            if (tool.execution?.requires_network && !context.hasNetwork) {
                console.log('🔍 [Dynamic Tools] Tool filtered out (requires network):', tool.name);
                return false;
            }
            
            return true;
        });
        console.log('🔍 [Dynamic Tools] Context filtered tools count:', contextFiltered.length);

        return contextFiltered;
    }

    /**
     * Get keywords for specific intent
     */
    getIntentKeywords(intent) {
        const intentKeywordMap = {
            navigation: ['navigate', 'position', 'location', 'jump', 'go', 'go to', 'navigate to', 'coordinates'],
            search: ['search', 'find', 'query', 'lookup'],
            analysis: ['analyze', 'calculate', 'compute', 'measure'],
            sequence: ['sequence', 'dna', 'rna', 'protein'],
            structure: ['structure', '3d', 'pdb', 'alphafold'],
            database: ['database', 'uniprot', 'interpro'],
            editing: ['edit', 'modify', 'change', 'replace'],
            pathway: ['pathway', 'metabolic', 'kegg'],
            blast: ['blast', 'similarity', 'align'],
            plugin: ['plugin', 'install', 'enable']
        };

        return intentKeywordMap[intent] || [];
    }

    /**
     * Score tools based on relevance
     */
    async scoreTools(tools, intent, context) {
        return tools.map(tool => {
            let score = 0;

            // Base score from priority
            score += (4 - (tool.priority || 3)) * 10;

            // Extract query keywords for direct matching
            const queryKeywords = intent.query.toLowerCase().split(/\s+/).filter(word => 
                word.length > 2 && !['the', 'and', 'or', 'of', 'in', 'to', 'for', 'with', 'by'].includes(word)
            );

            // Direct query keyword matching score (higher priority)
            const toolKeywords = tool.keywords || [];
            const queryMatches = queryKeywords.filter(queryKeyword =>
                toolKeywords.some(toolKeyword =>
                    toolKeyword.toLowerCase().includes(queryKeyword.toLowerCase())
                )
            ).length;
            score += queryMatches * 25; // Higher weight for direct query matches

            // Intent matching score
            const intentKeywords = this.getIntentKeywords(intent.primary);
            const keywordMatches = intentKeywords.filter(keyword =>
                toolKeywords.some(toolKeyword =>
                    toolKeyword.toLowerCase().includes(keyword.toLowerCase())
                )
            ).length;
            score += keywordMatches * 15;

            // Special bonus for navigation tools when position patterns are detected
            if (tool.category === 'navigation' && intent.query.match(/\d+-\d+/) || intent.query.match(/\d+:\d+/)) {
                score += 50; // High bonus for navigation tools with position patterns
                console.log('🔍 [Dynamic Tools] Navigation tool bonus applied for position pattern:', tool.name);
            }

            // Special bonus for "go to" queries with navigation tools
            if (tool.category === 'navigation' && intent.query.toLowerCase().includes('go')) {
                score += 30; // Bonus for "go" queries
                console.log('🔍 [Dynamic Tools] Navigation tool bonus applied for "go" query:', tool.name);
            }

            // Usage frequency score
            const usageStats = this.usageStats.get(tool.name) || { count: 0, success_rate: 0 };
            score += Math.log(usageStats.count + 1) * 5;
            score += usageStats.success_rate * 10;

            // Context relevance score
            if (context.currentCategory && tool.category === context.currentCategory) {
                score += 20;
            }

            // Tool relationship score
            if (tool.relationships?.enhances) {
                score += 5;
            }

            return { tool, score };
        }).sort((a, b) => b.score - a.score);
    }

    /**
     * Get fallback tools when intent analysis fails
     */
    async getFallbackTools() {
        const fallbackToolNames = [
            'navigate_to_position',
            'get_current_state',
            'search_gene_by_name',
            'get_sequence',
            'compute_gc'
        ];

        const tools = [];
        for (const toolName of fallbackToolNames) {
            try {
                const definition = await this.getToolDefinition(toolName);
                tools.push(definition);
            } catch (error) {
                console.warn(`Failed to load fallback tool ${toolName}:`, error);
            }
        }

        return tools;
    }

    /**
     * Generate system prompt with relevant tools
     */
    async generateSystemPrompt(userQuery, context = {}) {
        try {
            // Get relevant tools
            const relevantTools = await this.getRelevantTools(userQuery, context);
            
            // Generate tool descriptions
            const toolDescriptions = relevantTools.map(tool => {
                const params = Object.entries(tool.parameters?.properties || {})
                    .map(([name, param]) => `${name}: ${param.type} - ${param.description}`)
                    .join(', ');

                return `- **${tool.name}**: ${tool.description}\n  Parameters: ${params}`;
            }).join('\n');

            // Generate sample usages
            const sampleUsages = relevantTools
                .filter(tool => tool.sample_usages && tool.sample_usages.length > 0)
                .map(tool => {
                    const sample = tool.sample_usages[0];
                    return `- **${tool.name}**: "${sample.user_query}" → \`${sample.tool_call}\``;
                })
                .join('\n');

            return {
                tools: relevantTools,
                toolDescriptions,
                sampleUsages,
                totalTools: relevantTools.length
            };

        } catch (error) {
            console.error('Failed to generate system prompt:', error);
            return {
                tools: [],
                toolDescriptions: '',
                sampleUsages: '',
                totalTools: 0
            };
        }
    }

    /**
     * Track tool usage for optimization
     */
    trackToolUsage(toolName, success, executionTime) {
        const stats = this.usageStats.get(toolName) || {
            count: 0,
            success_count: 0,
            total_time: 0,
            success_rate: 0
        };

        stats.count++;
        if (success) stats.success_count++;
        stats.total_time += executionTime;
        stats.success_rate = stats.success_count / stats.count;

        this.usageStats.set(toolName, stats);
    }

    /**
     * Get tool usage statistics
     */
    getToolUsageStats() {
        const stats = {};
        for (const [toolName, data] of this.usageStats.entries()) {
            stats[toolName] = {
                usage_count: data.count,
                success_rate: data.success_rate,
                avg_execution_time: data.total_time / data.count
            };
        }
        return stats;
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.toolsCache.clear();
        this.categoriesCache = null;
        this.lastCacheUpdate = 0;
    }

    /**
     * Get registry statistics
     */
    async getRegistryStats() {
        const allTools = await this.getAllTools();
        const categories = this.categoriesCache?.categories || {};
        
        return {
            total_tools: allTools.length,
            total_categories: Object.keys(categories).length,
            cached_tools: this.toolsCache.size,
            usage_tracked: this.usageStats.size,
            categories: Object.entries(categories).map(([name, info]) => ({
                name,
                tools_count: info.tools_count,
                priority: info.priority
            }))
        };
    }
}

module.exports = ToolsRegistryManager;
