/**
 * PluginRequirementAnalyzer - 插件需求分析器
 * 分析用户的插件开发需求，提取关键信息并生成开发规格
 */
class PluginRequirementAnalyzer {
    constructor(app) {
        this.app = app;
        this.llmConfigManager = app.llmConfigManager;
        
        // 需求分析模板和规则
        this.analysisTemplates = this.initializeAnalysisTemplates();
        this.domainClassifiers = this.initializeDomainClassifiers();
        this.intentExtractors = this.initializeIntentExtractors();
        
        // 分析历史和学习数据
        this.analysisHistory = [];
        this.learningData = new Map();
        
        console.log('PluginRequirementAnalyzer initialized');
    }

    async initialize() {
        // 加载分析规则和模板
        await this.loadAnalysisRules();
        console.log('✅ PluginRequirementAnalyzer ready');
    }

    /**
     * 分析用户需求
     */
    async analyzeRequirement(userRequirement) {
        try {
            console.log('📊 Analyzing user requirement:', userRequirement);
            
            const analysis = {
                originalRequirement: userRequirement,
                timestamp: Date.now(),
                analysisId: this.generateAnalysisId(),
                
                // 基础分析
                domain: null,
                intent: null,
                complexity: 'medium',
                priority: 'normal',
                
                // 详细分析结果
                extractedFeatures: [],
                requiredFunctions: [],
                suggestedAPI: [],
                dataRequirements: [],
                uiRequirements: [],
                
                // 技术规格
                pluginType: 'function', // function, visualization, utility
                category: 'general',
                estimatedDifficulty: 'medium',
                estimatedTime: '30-60 minutes',
                
                // 实现建议
                suggestedImplementation: '',
                requiredPermissions: [],
                dependencies: [],
                
                // 风险评估
                risks: [],
                limitations: []
            };
            
            // 第1步：基础文本分析
            await this.performBasicTextAnalysis(analysis);
            
            // 第2步：领域分类
            await this.classifyDomain(analysis);
            
            // 第3步：意图提取
            await this.extractIntent(analysis);
            
            // 第4步：功能需求分析
            await this.analyzeFunctionalRequirements(analysis);
            
            // 第5步：技术需求分析
            await this.analyzeTechnicalRequirements(analysis);
            
            // 第6步：使用LLM增强分析（如果可用）
            if (this.llmConfigManager && this.llmConfigManager.isConfigured()) {
                await this.enhanceAnalysisWithLLM(analysis);
            }
            
            // 第7步：生成实现建议
            await this.generateImplementationSuggestions(analysis);
            
            // 保存分析历史
            this.analysisHistory.push(analysis);
            
            console.log('✅ Requirement analysis completed:', analysis);
            return analysis;
            
        } catch (error) {
            console.error('❌ Requirement analysis failed:', error);
            throw error;
        }
    }

    /**
     * 修改分析结果
     */
    async modifyAnalysis(originalAnalysis, userFeedback) {
        try {
            console.log('🔄 Modifying analysis based on feedback...');
            
            const modifiedAnalysis = {
                ...originalAnalysis,
                modificationHistory: originalAnalysis.modificationHistory || [],
                lastModified: Date.now()
            };
            
            // 记录修改历史
            modifiedAnalysis.modificationHistory.push({
                feedback: userFeedback,
                timestamp: Date.now(),
                previousState: { ...originalAnalysis }
            });
            
            // 使用LLM处理用户反馈
            if (this.llmConfigManager && this.llmConfigManager.isConfigured()) {
                const enhancedAnalysis = await this.processUserFeedback(modifiedAnalysis, userFeedback);
                Object.assign(modifiedAnalysis, enhancedAnalysis);
            } else {
                // 基础反馈处理
                await this.processBasicFeedback(modifiedAnalysis, userFeedback);
            }
            
            console.log('✅ Analysis modification completed');
            return modifiedAnalysis;
            
        } catch (error) {
            console.error('❌ Analysis modification failed:', error);
            throw error;
        }
    }

    /**
     * 基础文本分析
     */
    async performBasicTextAnalysis(analysis) {
        const text = analysis.originalRequirement.toLowerCase();
        
        // 复杂度评估
        if (text.includes('complex') || text.includes('advanced') || text.includes('machine learning')) {
            analysis.complexity = 'high';
        } else if (text.includes('simple') || text.includes('basic')) {
            analysis.complexity = 'low';
        }
        
        // 优先级评估
        if (text.includes('urgent') || text.includes('critical') || text.includes('important')) {
            analysis.priority = 'high';
        } else if (text.includes('low priority') || text.includes('when possible')) {
            analysis.priority = 'low';
        }
        
        // 提取关键特性
        const featureKeywords = [
            'analysis', 'visualization', 'plot', 'chart', 'sequence', 'genome', 
            'protein', 'phylogenetic', 'alignment', 'database', 'search', 'export'
        ];
        
        featureKeywords.forEach(keyword => {
            if (text.includes(keyword)) {
                analysis.extractedFeatures.push(keyword);
            }
        });
    }

    /**
     * 领域分类
     */
    async classifyDomain(analysis) {
        const text = analysis.originalRequirement.toLowerCase();
        
        const domainKeywords = {
            genomics: ['genome', 'dna', 'sequence', 'chromosome', 'gene', 'nucleotide'],
            proteomics: ['protein', 'amino acid', 'structure', 'fold', 'domain'],
            phylogenetics: ['phylogenetic', 'evolution', 'tree', 'distance', 'alignment'],
            systems_biology: ['network', 'pathway', 'interaction', 'regulation', 'system'],
            visualization: ['plot', 'chart', 'graph', 'visualize', 'display', 'render'],
            bioinformatics: ['blast', 'database', 'search', 'annotation', 'analysis'],
            machine_learning: ['predict', 'classify', 'model', 'ai', 'machine learning', 'neural']
        };
        
        let maxScore = 0;
        let bestDomain = 'general';
        
        for (const [domain, keywords] of Object.entries(domainKeywords)) {
            const score = keywords.reduce((sum, keyword) => {
                return sum + (text.includes(keyword) ? 1 : 0);
            }, 0);
            
            if (score > maxScore) {
                maxScore = score;
                bestDomain = domain;
            }
        }
        
        analysis.domain = bestDomain;
        analysis.category = bestDomain;
    }

    /**
     * 意图提取
     */
    async extractIntent(analysis) {
        const text = analysis.originalRequirement.toLowerCase();
        
        const intentPatterns = {
            analyze: ['analyze', 'analysis', 'examine', 'study', 'investigate'],
            visualize: ['visualize', 'plot', 'chart', 'display', 'show', 'render'],
            search: ['search', 'find', 'query', 'lookup', 'retrieve'],
            compare: ['compare', 'contrast', 'difference', 'similarity', 'align'],
            predict: ['predict', 'forecast', 'estimate', 'classify', 'identify'],
            export: ['export', 'save', 'download', 'output', 'generate'],
            integrate: ['integrate', 'connect', 'link', 'combine', 'merge']
        };
        
        let maxScore = 0;
        let bestIntent = 'general_function';
        
        for (const [intent, patterns] of Object.entries(intentPatterns)) {
            const score = patterns.reduce((sum, pattern) => {
                return sum + (text.includes(pattern) ? 1 : 0);
            }, 0);
            
            if (score > maxScore) {
                maxScore = score;
                bestIntent = intent;
            }
        }
        
        analysis.intent = bestIntent;
    }

    /**
     * 分析功能需求
     */
    async analyzeFunctionalRequirements(analysis) {
        const text = analysis.originalRequirement;
        
        // 提取可能的函数名称和参数
        const functionPatterns = {
            'calculate': ['calculate', 'compute', 'determine'],
            'analyze': ['analyze', 'examine', 'process'],
            'find': ['find', 'search', 'locate', 'identify'],
            'compare': ['compare', 'contrast', 'match'],
            'generate': ['generate', 'create', 'produce', 'build'],
            'export': ['export', 'save', 'output', 'download']
        };
        
        for (const [funcType, patterns] of Object.entries(functionPatterns)) {
            patterns.forEach(pattern => {
                if (text.toLowerCase().includes(pattern)) {
                    analysis.requiredFunctions.push({
                        type: funcType,
                        pattern: pattern,
                        suggestedName: this.generateFunctionName(funcType, analysis.domain)
                    });
                }
            });
        }
        
        // 数据需求分析
        const dataTypes = ['sequence', 'genome', 'protein', 'gene', 'annotation', 'variant'];
        dataTypes.forEach(dataType => {
            if (text.toLowerCase().includes(dataType)) {
                analysis.dataRequirements.push(dataType);
            }
        });
    }

    /**
     * 分析技术需求
     */
    async analyzeTechnicalRequirements(analysis) {
        const text = analysis.originalRequirement.toLowerCase();
        
        // 插件类型判断
        if (analysis.extractedFeatures.some(f => ['plot', 'chart', 'visualization'].includes(f))) {
            analysis.pluginType = 'visualization';
        } else if (text.includes('utility') || text.includes('helper')) {
            analysis.pluginType = 'utility';
        } else {
            analysis.pluginType = 'function';
        }
        
        // 权限需求
        const permissionIndicators = {
            'file-access': ['file', 'save', 'load', 'export', 'import'],
            'network-access': ['download', 'fetch', 'api', 'database', 'remote'],
            'genome-data': ['sequence', 'genome', 'annotation', 'feature'],
            'ui-modification': ['panel', 'window', 'interface', 'display']
        };
        
        for (const [permission, indicators] of Object.entries(permissionIndicators)) {
            if (indicators.some(indicator => text.includes(indicator))) {
                analysis.requiredPermissions.push(permission);
            }
        }
        
        // 依赖分析
        const dependencyIndicators = {
            'd3': ['visualization', 'chart', 'plot', 'graph'],
            'bioinformatics-js': ['sequence', 'alignment', 'phylogenetic'],
            'ml-js': ['machine learning', 'predict', 'classify', 'neural']
        };
        
        for (const [dependency, indicators] of Object.entries(dependencyIndicators)) {
            if (indicators.some(indicator => text.includes(indicator))) {
                analysis.dependencies.push(dependency);
            }
        }
    }

    /**
     * 使用LLM增强分析
     */
    async enhanceAnalysisWithLLM(analysis) {
        try {
            const prompt = `作为生物信息学专家，请分析以下插件开发需求：

用户需求：${analysis.originalRequirement}

当前分析结果：
- 领域：${analysis.domain}
- 意图：${analysis.intent}
- 复杂度：${analysis.complexity}
- 插件类型：${analysis.pluginType}

请提供更详细的分析和建议，包括：
1. 具体的函数定义和参数
2. 实现策略和算法建议
3. 可能的技术挑战
4. 用户界面设计建议
5. 测试策略

请以JSON格式返回增强的分析结果。`;

            const response = await this.llmConfigManager.sendMessageWithHistory([
                { role: 'user', content: prompt }
            ]);

            // 解析LLM响应
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const enhancement = JSON.parse(jsonMatch[0]);
                Object.assign(analysis, enhancement);
            } else {
                // 如果没有JSON，提取文本建议
                analysis.suggestedImplementation = response;
            }

        } catch (error) {
            console.warn('LLM enhancement failed, using basic analysis:', error);
        }
    }

    /**
     * 生成实现建议
     */
    async generateImplementationSuggestions(analysis) {
        const suggestions = [];
        
        // 基于领域的建议
        const domainSuggestions = {
            genomics: [
                '使用SequenceUtils进行序列处理',
                '集成BLAST API进行序列比对',
                '实现GC含量和序列统计分析'
            ],
            proteomics: [
                '集成UniProt API获取蛋白质信息',
                '实现蛋白质结构预测功能',
                '添加氨基酸组成分析'
            ],
            visualization: [
                '使用D3.js创建交互式图表',
                '实现SVG导出功能',
                '添加缩放和平移支持'
            ]
        };
        
        if (domainSuggestions[analysis.domain]) {
            suggestions.push(...domainSuggestions[analysis.domain]);
        }
        
        // 基于复杂度的建议
        if (analysis.complexity === 'high') {
            suggestions.push('考虑分步实现，先完成核心功能');
            suggestions.push('添加进度指示器处理长时间运行的任务');
        }
        
        analysis.implementationSuggestions = suggestions;
        
        // 时间估算
        const timeEstimates = {
            low: '15-30 minutes',
            medium: '30-60 minutes',
            high: '1-2 hours'
        };
        
        analysis.estimatedTime = timeEstimates[analysis.complexity];
    }

    /**
     * 处理用户反馈
     */
    async processUserFeedback(analysis, feedback) {
        const prompt = `用户对插件需求分析提供了反馈，请根据反馈调整分析结果：

原始需求：${analysis.originalRequirement}
当前分析：${JSON.stringify(analysis, null, 2)}
用户反馈：${feedback}

请返回调整后的分析结果JSON。`;

        try {
            const response = await this.llmConfigManager.sendMessageWithHistory([
                { role: 'user', content: prompt }
            ]);

            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (error) {
            console.warn('LLM feedback processing failed:', error);
        }

        return analysis;
    }

    /**
     * 基础反馈处理
     */
    async processBasicFeedback(analysis, feedback) {
        const feedbackLower = feedback.toLowerCase();
        
        // 简单的关键词匹配调整
        if (feedbackLower.includes('more complex') || feedbackLower.includes('advanced')) {
            analysis.complexity = 'high';
        } else if (feedbackLower.includes('simpler') || feedbackLower.includes('basic')) {
            analysis.complexity = 'low';
        }
        
        if (feedbackLower.includes('visualization') || feedbackLower.includes('chart')) {
            analysis.pluginType = 'visualization';
        }
        
        // 添加用户建议到实现建议中
        if (!analysis.userSuggestions) {
            analysis.userSuggestions = [];
        }
        analysis.userSuggestions.push(feedback);
    }

    /**
     * 生成函数名称
     */
    generateFunctionName(funcType, domain) {
        const prefixes = {
            genomics: 'analyze',
            proteomics: 'predict',
            phylogenetics: 'build',
            visualization: 'render'
        };
        
        const prefix = prefixes[domain] || funcType;
        const suffix = domain.charAt(0).toUpperCase() + domain.slice(1);
        
        return `${prefix}${suffix}`;
    }

    /**
     * 生成分析ID
     */
    generateAnalysisId() {
        return `analysis-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    }

    /**
     * 初始化分析模板
     */
    initializeAnalysisTemplates() {
        return {
            basic: {
                requiredFields: ['domain', 'intent', 'complexity'],
                optionalFields: ['dataRequirements', 'uiRequirements']
            },
            detailed: {
                requiredFields: ['domain', 'intent', 'complexity', 'requiredFunctions'],
                optionalFields: ['dependencies', 'permissions', 'risks']
            }
        };
    }

    /**
     * 初始化领域分类器
     */
    initializeDomainClassifiers() {
        return {
            genomics: { weight: 1.0, keywords: 50 },
            proteomics: { weight: 1.0, keywords: 30 },
            phylogenetics: { weight: 0.8, keywords: 20 },
            visualization: { weight: 1.2, keywords: 25 }
        };
    }

    /**
     * 初始化意图提取器
     */
    initializeIntentExtractors() {
        return {
            patterns: new Map(),
            weights: new Map(),
            contexts: new Map()
        };
    }

    /**
     * 加载分析规则
     */
    async loadAnalysisRules() {
        // 在实际实现中，这里可以从配置文件或数据库加载规则
        console.log('📋 Analysis rules loaded');
    }

    /**
     * 获取统计信息
     */
    getStats() {
        return {
            totalAnalyses: this.analysisHistory.length,
            domainDistribution: this.getDomainDistribution(),
            complexityDistribution: this.getComplexityDistribution(),
            averageAnalysisTime: this.getAverageAnalysisTime()
        };
    }

    getDomainDistribution() {
        const distribution = {};
        this.analysisHistory.forEach(analysis => {
            distribution[analysis.domain] = (distribution[analysis.domain] || 0) + 1;
        });
        return distribution;
    }

    getComplexityDistribution() {
        const distribution = {};
        this.analysisHistory.forEach(analysis => {
            distribution[analysis.complexity] = (distribution[analysis.complexity] || 0) + 1;
        });
        return distribution;
    }

    getAverageAnalysisTime() {
        // 简化实现，实际应该记录分析时间
        return '2-5 seconds';
    }

    /**
     * 清理和销毁
     */
    async destroy() {
        this.analysisHistory = [];
        this.learningData.clear();
        console.log('✅ PluginRequirementAnalyzer destroyed');
    }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PluginRequirementAnalyzer;
} else if (typeof window !== 'undefined') {
    window.PluginRequirementAnalyzer = PluginRequirementAnalyzer;
}