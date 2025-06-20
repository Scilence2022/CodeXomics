/**
 * ConversationAnalysisEngine - 对话分析引擎
 * 分析ChatBox LLM对话中的失败和错误，识别缺失的功能需求
 */
class ConversationAnalysisEngine {
    constructor(evolutionManager) {
        this.evolutionManager = evolutionManager;
        this.llmConfigManager = evolutionManager.llmConfigManager;
        
        // 分析模式和规则
        this.analysisRules = this.initializeAnalysisRules();
        this.contextPatterns = this.initializeContextPatterns();
        
        console.log('ConversationAnalysisEngine initialized');
    }

    /**
     * 初始化分析规则
     */
    initializeAnalysisRules() {
        return {
            // 功能缺失检测规则
            missingFunctionPatterns: [
                {
                    pattern: /not available|not supported|not implemented/i,
                    priority: 8,
                    category: 'missing_implementation'
                },
                {
                    pattern: /unknown tool|tool not found|invalid tool/i,
                    priority: 9,
                    category: 'unknown_tool'
                },
                {
                    pattern: /cannot.*analyze|unable to.*process/i,
                    priority: 7,
                    category: 'analysis_limitation'
                },
                {
                    pattern: /not configured|need.*configuration/i,
                    priority: 6,
                    category: 'configuration_issue'
                },
                {
                    pattern: /visualization.*not.*available/i,
                    priority: 8,
                    category: 'visualization_missing'
                }
            ],
            
            // 用户意图识别规则
            intentPatterns: [
                {
                    pattern: /analyze.*gene|find.*gene|search.*gene/i,
                    intent: 'gene_analysis',
                    domain: 'genomics'
                },
                {
                    pattern: /protein.*structure|3d.*structure|fold.*protein/i,
                    intent: 'protein_structure',
                    domain: 'structural_biology'
                },
                {
                    pattern: /phylogen|evolution|tree/i,
                    intent: 'phylogenetic_analysis',
                    domain: 'evolution'
                },
                {
                    pattern: /network.*analysis|interaction.*network/i,
                    intent: 'network_analysis',
                    domain: 'systems_biology'
                },
                {
                    pattern: /visualiz|plot|graph|chart/i,
                    intent: 'data_visualization',
                    domain: 'visualization'
                }
            ]
        };
    }

    /**
     * 初始化上下文模式
     */
    initializeContextPatterns() {
        return {
            // 生物信息学领域特定的上下文
            genomics: ['chromosome', 'gene', 'sequence', 'genome', 'dna', 'rna'],
            proteomics: ['protein', 'peptide', 'amino acid', 'fold', 'domain'],
            phylogenetics: ['phylogeny', 'tree', 'evolution', 'distance', 'ancestor'],
            systems_biology: ['network', 'pathway', 'interaction', 'module', 'system'],
            visualization: ['plot', 'chart', 'graph', 'diagram', 'image', 'figure']
        };
    }

    /**
     * 分析失败事件
     */
    async analyzeFailure(event) {
        try {
            const analysis = {
                isMissingFunction: false,
                missingFunctionDescription: '',
                userIntent: '',
                suggestedImplementation: '',
                priority: 0,
                shouldGeneratePlugin: false,
                category: '',
                domain: '',
                confidence: 0
            };

            // 分析失败消息
            const failureAnalysis = this.analyzeFBailureMessage(event.message);
            
            if (failureAnalysis.isMissingFunction) {
                analysis.isMissingFunction = true;
                analysis.category = failureAnalysis.category;
                analysis.priority = failureAnalysis.priority;
                analysis.confidence = failureAnalysis.confidence;

                // 分析用户意图
                const intentAnalysis = await this.analyzeUserIntent(event);
                analysis.userIntent = intentAnalysis.intent;
                analysis.domain = intentAnalysis.domain;

                // 生成功能描述
                analysis.missingFunctionDescription = this.generateFunctionDescription(
                    failureAnalysis, intentAnalysis, event
                );

                // 建议实现方案
                analysis.suggestedImplementation = await this.suggestImplementation(
                    analysis.missingFunctionDescription, 
                    analysis.domain,
                    event.context
                );

                // 决定是否应该生成插件
                analysis.shouldGeneratePlugin = this.shouldGeneratePlugin(analysis);
            }

            return analysis;
        } catch (error) {
            console.error('Failed to analyze failure:', error);
            return { isMissingFunction: false };
        }
    }

    /**
     * 分析失败消息
     */
    analyzeFBailureMessage(message) {
        const result = {
            isMissingFunction: false,
            category: '',
            priority: 0,
            confidence: 0,
            matchedRule: null
        };

        for (const rule of this.analysisRules.missingFunctionPatterns) {
            if (rule.pattern.test(message)) {
                result.isMissingFunction = true;
                result.category = rule.category;
                result.priority = rule.priority;
                result.confidence = 0.8; // 基础置信度
                result.matchedRule = rule;
                break;
            }
        }

        // 增强分析 - 检查上下文相关的关键词
        if (result.isMissingFunction) {
            result.confidence = this.calculateConfidence(message, result.matchedRule);
        }

        return result;
    }

    /**
     * 计算置信度
     */
    calculateConfidence(message, rule) {
        let confidence = 0.8; // 基础置信度

        // 检查生物信息学相关词汇
        const bioKeywords = [
            'gene', 'protein', 'sequence', 'genome', 'phylogen', 
            'network', 'pathway', 'structure', 'analysis'
        ];

        const foundKeywords = bioKeywords.filter(keyword => 
            message.toLowerCase().includes(keyword)
        );

        // 根据生物信息学关键词数量调整置信度
        confidence += foundKeywords.length * 0.05;

        // 根据规则类别调整
        if (rule.category === 'unknown_tool') {
            confidence += 0.1;
        } else if (rule.category === 'missing_implementation') {
            confidence += 0.05;
        }

        return Math.min(confidence, 1.0);
    }

    /**
     * 分析用户意图
     */
    async analyzeUserIntent(event) {
        const result = {
            intent: 'unknown',
            domain: 'general',
            confidence: 0
        };

        // 检查前面的消息以获取更多上下文
        const contextMessages = await this.getRecentContextMessages(event, 3);
        const fullContext = contextMessages.map(m => m.message).join(' ') + ' ' + event.message;

        // 匹配意图模式
        for (const rule of this.analysisRules.intentPatterns) {
            if (rule.pattern.test(fullContext)) {
                result.intent = rule.intent;
                result.domain = rule.domain;
                result.confidence = 0.7;
                break;
            }
        }

        // 使用LLM进行更深入的意图分析
        if (result.confidence < 0.7) {
            const llmAnalysis = await this.analyzeSIntentWithLLM(fullContext);
            if (llmAnalysis && llmAnalysis.confidence > result.confidence) {
                result.intent = llmAnalysis.intent;
                result.domain = llmAnalysis.domain;
                result.confidence = llmAnalysis.confidence;
            }
        }

        return result;
    }

    /**
     * 获取最近的上下文消息
     */
    async getRecentContextMessages(currentEvent, count = 3) {
        try {
            const conversation = this.evolutionManager.getCurrentConversation();
            if (!conversation) return [];

            // 获取当前事件之前的消息
            const currentIndex = conversation.events.findIndex(e => e.id === currentEvent.id);
            if (currentIndex === -1) return [];

            const startIndex = Math.max(0, currentIndex - count);
            return conversation.events.slice(startIndex, currentIndex);
        } catch (error) {
            console.error('Failed to get context messages:', error);
            return [];
        }
    }

    /**
     * 使用LLM分析用户意图
     */
    async analyzeSIntentWithLLM(context) {
        try {
            if (!this.llmConfigManager || !this.llmConfigManager.isConfigured()) {
                return null;
            }

            const prompt = `分析以下生物信息学对话中的用户意图和领域分类：

对话内容：
${context}

请识别：
1. 用户的主要意图 (gene_analysis, protein_structure, phylogenetic_analysis, network_analysis, data_visualization, 等)
2. 相关的生物信息学领域 (genomics, proteomics, phylogenetics, systems_biology, visualization, 等)
3. 置信度 (0-1)

请以JSON格式回答：
{
  "intent": "具体意图",
  "domain": "领域",
  "confidence": 0.8
}`;

            const response = await this.llmConfigManager.sendMessageWithHistory([
                { role: 'user', content: prompt }
            ]);

            // 尝试解析LLM响应
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    intent: parsed.intent || 'unknown',
                    domain: parsed.domain || 'general',
                    confidence: Math.min(Math.max(parsed.confidence || 0, 0), 1)
                };
            }
        } catch (error) {
            console.warn('LLM intent analysis failed:', error);
        }

        return null;
    }

    /**
     * 生成功能描述
     */
    generateFunctionDescription(failureAnalysis, intentAnalysis, event) {
        const category = failureAnalysis.category;
        const intent = intentAnalysis.intent;
        const domain = intentAnalysis.domain;

        let description = '';

        switch (category) {
            case 'unknown_tool':
                description = `需要实现 ${domain} 领域的 ${intent} 功能`;
                break;
            case 'missing_implementation':
                description = `缺少 ${intent} 的完整实现，特别是在 ${domain} 方面`;
                break;
            case 'analysis_limitation':
                description = `当前分析能力不足，需要增强 ${domain} 相关的 ${intent} 功能`;
                break;
            case 'visualization_missing':
                description = `缺少 ${domain} 数据的可视化功能，特别是 ${intent} 类型`;
                break;
            default:
                description = `需要开发 ${domain} 领域的新功能来支持 ${intent}`;
        }

        // 添加从错误消息中提取的具体信息
        const errorKeywords = this.extractKeywords(event.message);
        if (errorKeywords.length > 0) {
            description += `。关键词：${errorKeywords.join(', ')}`;
        }

        return description;
    }

    /**
     * 提取关键词
     */
    extractKeywords(message) {
        const keywords = [];
        const biologicalTerms = [
            'gene', 'protein', 'sequence', 'genome', 'chromosome',
            'phylogen', 'tree', 'network', 'pathway', 'structure',
            'analysis', 'visualization', 'plot', 'chart'
        ];

        for (const term of biologicalTerms) {
            if (message.toLowerCase().includes(term)) {
                keywords.push(term);
            }
        }

        return keywords;
    }

    /**
     * 建议实现方案
     */
    async suggestImplementation(description, domain, context) {
        try {
            if (!this.llmConfigManager || !this.llmConfigManager.isConfigured()) {
                return this.getBasicImplementationSuggestion(domain);
            }

            const prompt = `作为生物信息学插件开发专家，为以下需求建议具体的实现方案：

需求描述：${description}
领域：${domain}
当前上下文：${JSON.stringify(context, null, 2)}

请提供：
1. 插件名称建议
2. 主要功能列表
3. 参数定义
4. 实现技术建议
5. 与现有插件系统的集成方案

请以结构化文本格式回答。`;

            const response = await this.llmConfigManager.sendMessageWithHistory([
                { role: 'user', content: prompt }
            ]);

            return response;
        } catch (error) {
            console.warn('LLM implementation suggestion failed:', error);
            return this.getBasicImplementationSuggestion(domain);
        }
    }

    /**
     * 获取基础实现建议
     */
    getBasicImplementationSuggestion(domain) {
        const suggestions = {
            genomics: `
插件名称：GenomicsAnalysisPlugin
主要功能：基因组序列分析、注释处理、变异检测
参数：chromosome, start, end, analysisType
技术：生物信息学算法库集成
集成：通过PluginManager注册新的genomics-analysis插件`,

            proteomics: `
插件名称：ProteomicsPlugin
主要功能：蛋白质序列分析、结构预测、功能注释
参数：sequence, analysisType, database
技术：蛋白质分析工具集成
集成：扩展现有protein-analysis插件`,

            phylogenetics: `
插件名称：PhylogeneticsPlugin
主要功能：系统发育分析、进化树构建、序列比对
参数：sequences, method, model
技术：phylogenetic算法实现
集成：增强phylogenetic-analysis插件`,

            systems_biology: `
插件名称：SystemsBiologyPlugin
主要功能：网络分析、通路分析、系统建模
参数：networkData, analysisType, parameters
技术：网络分析算法库
集成：扩展biological-networks插件`,

            visualization: `
插件名称：BioVisualizationPlugin
主要功能：生物数据可视化、交互式图表、数据导出
参数：data, plotType, options
技术：D3.js, Canvas, WebGL
集成：通过PluginVisualization系统注册`
        };

        return suggestions[domain] || '需要根据具体需求设计自定义插件';
    }

    /**
     * 决定是否应该生成插件
     */
    shouldGeneratePlugin(analysis) {
        // 基于优先级、置信度和领域重要性决定
        const priorityScore = analysis.priority;
        const confidenceScore = analysis.confidence * 10;
        const domainImportance = this.getDomainImportance(analysis.domain);

        const totalScore = priorityScore + confidenceScore + domainImportance;

        // 如果总分超过15分，考虑生成插件
        return totalScore >= 15;
    }

    /**
     * 获取领域重要性评分
     */
    getDomainImportance(domain) {
        const importance = {
            genomics: 5,
            proteomics: 4,
            systems_biology: 4,
            phylogenetics: 3,
            visualization: 3,
            general: 1
        };

        return importance[domain] || 1;
    }

    /**
     * 分析完整对话
     */
    async analyzeFullConversation(conversation) {
        try {
            const analysis = {
                conversationSummary: '',
                totalMessages: conversation.events.length,
                errorRate: conversation.stats.errorCount / Math.max(conversation.stats.messageCount, 1),
                toolUsage: conversation.stats.toolCallCount,
                identifiedIssues: [],
                criticalMissingFunctions: [],
                suggestions: []
            };

            // 识别关键问题
            for (const event of conversation.events) {
                if (event.isError || this.evolutionManager.isFailureMessage(event.message)) {
                    const issueAnalysis = await this.analyzeFailure(event);
                    if (issueAnalysis.isMissingFunction && issueAnalysis.priority >= 7) {
                        analysis.criticalMissingFunctions.push({
                            id: event.id,
                            description: issueAnalysis.missingFunctionDescription,
                            userIntent: issueAnalysis.userIntent,
                            suggestedImplementation: issueAnalysis.suggestedImplementation,
                            priority: issueAnalysis.priority
                        });
                    }
                    analysis.identifiedIssues.push(issueAnalysis);
                }
            }

            // 生成对话摘要
            analysis.conversationSummary = await this.generateConversationSummary(conversation);

            // 生成改进建议
            analysis.suggestions = this.generateImprovementSuggestions(analysis);

            return analysis;
        } catch (error) {
            console.error('Failed to analyze full conversation:', error);
            return { conversationSummary: 'Analysis failed', criticalMissingFunctions: [] };
        }
    }

    /**
     * 生成对话摘要
     */
    async generateConversationSummary(conversation) {
        try {
            const messageCount = conversation.events.length;
            const duration = this.evolutionManager.calculateDuration(
                conversation.startTime, 
                conversation.endTime
            );
            const errorCount = conversation.stats.errorCount;
            const successCount = conversation.stats.successCount;

            let summary = `对话包含 ${messageCount} 条消息，持续 ${duration || '未知'}。`;
            summary += `成功操作 ${successCount} 次，遇到错误 ${errorCount} 次。`;

            if (errorCount > 0) {
                summary += '主要问题包括功能缺失和工具限制。';
            }

            return summary;
        } catch (error) {
            return '无法生成对话摘要';
        }
    }

    /**
     * 生成改进建议
     */
    generateImprovementSuggestions(analysis) {
        const suggestions = [];

        if (analysis.errorRate > 0.3) {
            suggestions.push('错误率较高，建议改进错误处理和用户指导');
        }

        if (analysis.criticalMissingFunctions.length > 0) {
            suggestions.push(`发现 ${analysis.criticalMissingFunctions.length} 个关键缺失功能，建议优先开发相关插件`);
        }

        if (analysis.toolUsage === 0) {
            suggestions.push('对话中未使用任何工具，可能需要改进工具发现和使用指导');
        }

        return suggestions;
    }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConversationAnalysisEngine;
} else if (typeof window !== 'undefined') {
    window.ConversationAnalysisEngine = ConversationAnalysisEngine;
} 