/**
 * PluginFunctionCallsIntegrator - 插件功能调用集成器
 * 确保插件系统功能可以被ChatBox LLM通过function calling正确调用
 */
class PluginFunctionCallsIntegrator {
    constructor(chatManager, pluginManager) {
        this.chatManager = chatManager;
        this.pluginManager = pluginManager;
        
        // 插件功能映射表
        this.pluginFunctionMap = new Map();
        
        // 初始化插件功能映射
        this.initializePluginFunctionMap();
        
        console.log('PluginFunctionCallsIntegrator initialized');
    }
    
    /**
     * 初始化插件功能映射表
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
                    plugin: func.plugin
                });
            }
            
            console.log(`Mapped ${this.pluginFunctionMap.size} plugin functions for LLM calling`);
        } catch (error) {
            console.error('Failed to initialize plugin function map:', error);
        }
    }
    
    /**
     * 检查是否为插件功能调用
     * @param {string} toolName - 工具名称
     * @returns {boolean}
     */
    isPluginFunction(toolName) {
        return this.pluginFunctionMap.has(toolName);
    }
    
    /**
     * 执行插件功能
     * @param {string} toolName - 工具名称
     * @param {Object} parameters - 参数
     * @returns {Promise<Object>} 执行结果
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
            
            // 通过PluginManager执行功能
            const result = await this.pluginManager.executeFunctionByName(toolName, parameters);
            
            console.log(`Plugin function ${toolName} executed successfully:`, result);
            
            // 包装结果以统一格式
            return {
                success: true,
                result: result,
                plugin: functionInfo.plugin,
                functionName: toolName,
                parameters: parameters,
                executionTime: Date.now()
            };
            
        } catch (error) {
            console.error(`Plugin function execution failed for ${toolName}:`, error);
            throw new Error(`Plugin function ${toolName} failed: ${error.message}`);
        }
    }
    
    /**
     * 获取所有插件功能的LLM系统信息
     * @returns {string} 系统信息字符串
     */
    getPluginFunctionsSystemInfo() {
        if (this.pluginFunctionMap.size === 0) {
            return 'No plugin functions available.';
        }
        
        let info = '';
        
        // 按插件分组
        const pluginGroups = new Map();
        for (const [functionName, functionInfo] of this.pluginFunctionMap) {
            const pluginId = functionInfo.pluginId;
            if (!pluginGroups.has(pluginId)) {
                pluginGroups.set(pluginId, {
                    plugin: functionInfo.plugin,
                    functions: []
                });
            }
            pluginGroups.get(pluginId).functions.push({
                name: functionName,
                description: functionInfo.description,
                parameters: functionInfo.parameters
            });
        }
        
        info += 'PLUGIN SYSTEM FUNCTIONS:\\n';
        info += '======================\\n';
        
        for (const [pluginId, group] of pluginGroups) {
            info += `\\n**${group.plugin.name}** (${group.plugin.version}):\\n`;
            
            for (const func of group.functions) {
                info += `- ${func.name}: ${func.description}\\n`;
                
                // 添加参数信息
                if (func.parameters && func.parameters.properties) {
                    const requiredParams = func.parameters.required || [];
                    const paramList = Object.keys(func.parameters.properties)
                        .map(param => requiredParams.includes(param) ? `${param}*` : param)
                        .join(', ');
                    info += `  Parameters: ${paramList}\\n`;
                }
            }
        }
        
        info += '\\nPLUGIN FUNCTION CALLING EXAMPLES:\\n';
        info += '================================\\n';
        
        // 为每个插件类别提供示例
        const examples = this.generatePluginExamples();
        for (const example of examples) {
            info += `- ${example.description}:\\n`;
            info += `  ${JSON.stringify(example.call)}\\n`;
        }
        
        info += '\\nNOTE: Plugin functions are executed in a sandboxed environment with access to MicrobeGenomicsFunctions and safe app interfaces.\\n';
        
        return info;
    }
    
    /**
     * 生成插件功能调用示例
     * @returns {Array} 示例数组
     */
    generatePluginExamples() {
        const examples = [];
        
        // 基因组分析示例
        if (this.pluginFunctionMap.has('genomic-analysis.analyzeGCContent')) {
            examples.push({
                description: 'Analyze GC content in genomic region',
                call: {
                    tool_name: 'genomic-analysis.analyzeGCContent',
                    parameters: {
                        chromosome: 'chr1',
                        start: 1000,
                        end: 5000,
                        windowSize: 1000
                    }
                }
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
                        strand: 'both'
                    }
                }
            });
        }
        
        // 系统发育分析示例
        if (this.pluginFunctionMap.has('phylogenetic-analysis.buildPhylogeneticTree')) {
            examples.push({
                description: 'Build phylogenetic tree',
                call: {
                    tool_name: 'phylogenetic-analysis.buildPhylogeneticTree',
                    parameters: {
                        sequences: [
                            { id: 'seq1', sequence: 'ATGCGCTATCG', name: 'Sequence 1' },
                            { id: 'seq2', sequence: 'ATGAAAGAATT', name: 'Sequence 2' }
                        ],
                        method: 'nj',
                        distanceMetric: 'hamming'
                    }
                }
            });
        }
        
        // 机器学习分析示例
        if (this.pluginFunctionMap.has('ml-analysis.predictGeneFunction')) {
            examples.push({
                description: 'Predict gene function using ML',
                call: {
                    tool_name: 'ml-analysis.predictGeneFunction',
                    parameters: {
                        sequence: 'ATGCGCTATCGATGAAAGAATT',
                        model: 'cnn',
                        threshold: 0.7
                    }
                }
            });
        }
        
        // 生物网络分析示例
        if (this.pluginFunctionMap.has('biological-networks.buildProteinInteractionNetwork')) {
            examples.push({
                description: 'Build protein interaction network',
                call: {
                    tool_name: 'biological-networks.buildProteinInteractionNetwork',
                    parameters: {
                        proteins: ['TP53', 'MDM2', 'ATM', 'CHEK2'],
                        confidenceThreshold: 0.7,
                        interactionDatabase: 'string'
                    }
                }
            });
        }
        
        return examples;
    }
    
    /**
     * 验证插件功能参数
     * @param {string} toolName - 工具名称
     * @param {Object} parameters - 参数
     * @returns {boolean} 验证结果
     */
    validatePluginFunctionParameters(toolName, parameters) {
        if (!this.isPluginFunction(toolName)) {
            return false;
        }
        
        const functionInfo = this.pluginFunctionMap.get(toolName);
        
        try {
            // 使用PluginManager的参数验证
            this.pluginManager.validateParameters(parameters, functionInfo.parameters);
            return true;
        } catch (error) {
            console.warn(`Plugin function parameter validation failed for ${toolName}:`, error.message);
            return false;
        }
    }
    
    /**
     * 获取插件功能分类信息
     * @param {string} toolName - 工具名称
     * @returns {Object|null} 分类信息
     */
    getPluginFunctionCategory(toolName) {
        if (!this.isPluginFunction(toolName)) {
            return null;
        }
        
        const functionInfo = this.pluginFunctionMap.get(toolName);
        const pluginId = functionInfo.pluginId;
        
        // 根据插件ID确定分类
        if (pluginId === 'genomic-analysis') {
            return {
                name: 'pluginGenomicAnalysis',
                priority: 3,
                description: 'Plugin-based genomic analysis functions'
            };
        } else if (pluginId === 'phylogenetic-analysis') {
            return {
                name: 'pluginPhylogenetic',
                priority: 4,
                description: 'Plugin-based phylogenetic analysis functions'
            };
        } else if (pluginId === 'biological-networks') {
            return {
                name: 'pluginNetworkAnalysis',
                priority: 4,
                description: 'Plugin-based biological network analysis functions'
            };
        } else if (pluginId === 'ml-analysis') {
            return {
                name: 'pluginMachineLearning',
                priority: 4,
                description: 'Plugin-based machine learning analysis functions'
            };
        }
        
        // 默认分类
        return {
            name: 'pluginGeneral',
            priority: 3,
            description: 'General plugin functions'
        };
    }
    
    /**
     * 刷新插件功能映射（当插件系统更新时调用）
     */
    refreshPluginFunctionMap() {
        this.pluginFunctionMap.clear();
        this.initializePluginFunctionMap();
        console.log('Plugin function map refreshed');
    }
    
    /**
     * 获取插件功能统计信息
     * @returns {Object} 统计信息
     */
    getPluginFunctionStats() {
        const stats = {
            totalFunctions: this.pluginFunctionMap.size,
            pluginCounts: new Map(),
            categoryStats: new Map()
        };
        
        for (const [, functionInfo] of this.pluginFunctionMap) {
            const pluginId = functionInfo.pluginId;
            const category = this.getPluginFunctionCategory(functionInfo.name);
            
            // 统计插件数量
            stats.pluginCounts.set(pluginId, (stats.pluginCounts.get(pluginId) || 0) + 1);
            
            // 统计分类数量
            if (category) {
                stats.categoryStats.set(category.name, (stats.categoryStats.get(category.name) || 0) + 1);
            }
        }
        
        return {
            ...stats,
            pluginCounts: Object.fromEntries(stats.pluginCounts),
            categoryStats: Object.fromEntries(stats.categoryStats)
        };
    }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PluginFunctionCallsIntegrator;
} 