/**
 * ConversationEvolutionManager - 对话进化管理器
 * 分析ChatBox LLM对话过程，识别无法实现的功能需求，并自动生成相应的插件
 */
class ConversationEvolutionManager {
    constructor(app, configManager, chatManager) {
        this.app = app;
        this.configManager = configManager;
        this.chatManager = chatManager;
        
        // 进化数据存储
        this.evolutionData = {
            conversations: [],
            missingFunctions: [],
            generatedPlugins: [],
            evolutionHistory: []
        };
        
        // 分析引擎
        this.analysisEngine = null;
        this.pluginGenerator = null;
        
        // LLM配置
        this.llmConfigManager = null;
        
        // 存储管理器
        this.storageManager = null;
        
        // 初始化
        this.initializeEvolutionSystem();
        
        console.log('ConversationEvolutionManager initialized');
    }

    /**
     * 初始化进化系统
     */
    async initializeEvolutionSystem() {
        try {
            console.log('🚀 Initializing Conversation Evolution System...');
            
            // 初始化存储管理器
            this.storageManager = new ConversationEvolutionStorageManager(this.configManager);
            
            // 初始化独立存储系统
            await this.storageManager.initializeIndependentStorage();
            
            // 获取LLM配置管理器
            if (this.chatManager && this.chatManager.llmConfigManager) {
                // 使用现有的LLM配置管理器（集成模式）
                this.llmConfigManager = this.chatManager.llmConfigManager;
                console.log('📡 Using integrated LLM configuration manager');
            } else {
                // 创建独立的LLM配置管理器（独立模式）
                console.log('⚙️  Creating standalone LLMConfigManager for evolution system...');
                this.llmConfigManager = new LLMConfigManager(this.configManager);
            }
            
            // 初始化分析引擎
            this.analysisEngine = new ConversationAnalysisEngine(this);
            console.log('🔍 Conversation analysis engine initialized');
            
            // 初始化插件生成器
            this.pluginGenerator = new AutoPluginGenerator(this);
            console.log('🔧 Auto plugin generator initialized');
            
            // 加载进化数据
            await this.loadEvolutionData();
            
            // 设置对话监听（仅在集成模式下）
            this.setupConversationMonitoring();
            
            // Connect to ChatBox if available
            this.connectToChatBox();
            
            console.log('✅ Evolution system initialized successfully');
            console.log('📊 Storage info:', this.storageManager.getStorageInfo());
            
        } catch (error) {
            console.error('❌ Failed to initialize evolution system:', error);
            throw error;
        }
    }

    /**
     * 设置对话监听
     */
    setupConversationMonitoring() {
        // 监听聊天消息
        if (this.chatManager) {
            // 重写addMessageToChat方法以监听对话
            const originalAddMessage = this.chatManager.addMessageToChat.bind(this.chatManager);
            this.chatManager.addMessageToChat = (message, sender, isError = false) => {
                // 调用原始方法
                const result = originalAddMessage(message, sender, isError);
                
                // 记录对话数据
                this.recordConversationData(message, sender, isError);
                
                return result;
            };
        }
    }

    /**
     * 记录对话数据并实时分析
     */
    recordConversationData(message, sender, isError) {
        const timestamp = new Date().toISOString();
        
        // 记录对话事件
        const conversationEvent = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            message,
            sender,
            isError,
            timestamp,
            context: this.getCurrentContext()
        };
        
        // 添加到当前对话
        this.addToCurrentConversation(conversationEvent);
        
        // 如果是错误或失败，进行实时分析
        if (isError || this.isFailureMessage(message)) {
            this.analyzeFailure(conversationEvent);
        }
        
        // 定期保存数据
        this.debouncedSaveEvolutionData();
    }

    /**
     * 获取当前上下文
     */
    getCurrentContext() {
        try {
            if (this.chatManager && this.chatManager.getCurrentContext) {
                // 集成模式：从chatManager获取上下文
                const context = this.chatManager.getCurrentContext();
                return {
                    currentChromosome: context.genomeBrowser.currentChromosome,
                    currentPosition: context.genomeBrowser.currentPosition,
                    loadedFiles: context.genomeBrowser.loadedFiles,
                    availableTools: context.genomeBrowser.toolSources.total,
                    pluginCount: context.genomeBrowser.toolSources.plugins
                };
            } else {
                // 独立模式：返回基本上下文信息
                return {
                    mode: 'standalone',
                    timestamp: new Date().toISOString(),
                    systemStatus: 'active',
                    evolutionSystemActive: true
                };
            }
        } catch (error) {
            return { 
                error: 'Failed to get context',
                mode: this.chatManager ? 'integrated' : 'standalone'
            };
        }
    }

    /**
     * 判断是否为失败消息
     */
    isFailureMessage(message) {
        const failureKeywords = [
            'error', 'failed', 'cannot', 'unable', 'not available', 
            'not found', 'not supported', 'not implemented',
            'sorry', 'unfortunately', 'not possible'
        ];
        
        const lowerMessage = message.toLowerCase();
        return failureKeywords.some(keyword => lowerMessage.includes(keyword));
    }

    /**
     * 添加到当前对话
     */
    addToCurrentConversation(event) {
        // 获取或创建当前对话
        let currentConversation = this.getCurrentConversation();
        if (!currentConversation) {
            currentConversation = this.createNewConversation();
        }
        
        // 添加事件
        currentConversation.events.push(event);
        currentConversation.lastActivity = event.timestamp;
        
        // 更新对话统计
        this.updateConversationStats(currentConversation);
    }

    /**
     * 获取当前对话
     */
    getCurrentConversation() {
        return this.evolutionData.conversations.find(conv => !conv.completed);
    }

    /**
     * 创建新对话
     */
    createNewConversation() {
        const conversation = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            startTime: new Date().toISOString(),
            events: [],
            completed: false,
            stats: {
                messageCount: 0,
                errorCount: 0,
                successCount: 0,
                toolCallCount: 0,
                failureCount: 0
            },
            analysis: null
        };
        
        this.evolutionData.conversations.push(conversation);
        return conversation;
    }

    /**
     * 更新对话统计
     */
    updateConversationStats(conversation) {
        const stats = {
            messageCount: 0,
            errorCount: 0,
            successCount: 0,
            toolCallCount: 0,
            failureCount: 0
        };
        
        for (const event of conversation.events) {
            stats.messageCount++;
            
            if (event.isError) {
                stats.errorCount++;
            }
            
            if (this.isFailureMessage(event.message)) {
                stats.failureCount++;
            }
            
            if (this.isSuccessMessage(event.message)) {
                stats.successCount++;
            }
            
            if (this.isToolCall(event.message)) {
                stats.toolCallCount++;
            }
        }
        
        conversation.stats = stats;
    }

    /**
     * 判断是否为成功消息
     */
    isSuccessMessage(message) {
        const successKeywords = [
            'success', 'completed', 'done', 'finished', 'executed',
            '✅', 'successfully', 'result'
        ];
        
        const lowerMessage = message.toLowerCase();
        return successKeywords.some(keyword => lowerMessage.includes(keyword));
    }

    /**
     * 判断是否为工具调用
     */
    isToolCall(message) {
        try {
            const parsed = JSON.parse(message);
            return parsed.tool_name && parsed.parameters;
        } catch {
            return false;
        }
    }

    /**
     * 分析失败事件
     */
    async analyzeFailure(event) {
        try {
            const analysis = await this.analysisEngine.analyzeFailure(event);
            
            if (analysis.isMissingFunction) {
                // 记录缺失的功能
                this.recordMissingFunction(analysis);
                
                // 检查是否需要生成插件
                if (analysis.shouldGeneratePlugin) {
                    await this.initiatePluginGeneration(analysis);
                }
            }
        } catch (error) {
            console.error('Failed to analyze failure:', error);
        }
    }

    /**
     * 记录缺失功能
     */
    recordMissingFunction(analysis) {
        const missingFunction = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toISOString(),
            description: analysis.missingFunctionDescription,
            userIntent: analysis.userIntent,
            suggestedImplementation: analysis.suggestedImplementation,
            priority: analysis.priority,
            occurrences: 1,
            lastOccurrence: new Date().toISOString()
        };
        
        // 检查是否已存在类似功能
        const existing = this.findSimilarMissingFunction(missingFunction);
        if (existing) {
            existing.occurrences++;
            existing.lastOccurrence = missingFunction.timestamp;
            existing.priority = Math.max(existing.priority, missingFunction.priority);
        } else {
            this.evolutionData.missingFunctions.push(missingFunction);
        }
    }

    /**
     * 查找相似的缺失功能
     */
    findSimilarMissingFunction(newFunction) {
        return this.evolutionData.missingFunctions.find(existing => {
            const similarity = this.calculateSimilarity(
                existing.description, 
                newFunction.description
            );
            return similarity > 0.7; // 70%相似度阈值
        });
    }

    /**
     * 计算文本相似度
     */
    calculateSimilarity(text1, text2) {
        const words1 = text1.toLowerCase().split(/\s+/);
        const words2 = text2.toLowerCase().split(/\s+/);
        
        const intersection = words1.filter(word => words2.includes(word));
        const union = [...new Set([...words1, ...words2])];
        
        return intersection.length / union.length;
    }

    /**
     * 启动插件生成
     */
    async initiatePluginGeneration(analysis) {
        try {
            const pluginSpec = await this.pluginGenerator.generatePluginSpecification(analysis);
            
            if (pluginSpec) {
                await this.generateAndTestPlugin(pluginSpec);
            }
        } catch (error) {
            console.error('Failed to generate plugin:', error);
        }
    }

    /**
     * 生成并测试插件
     */
    async generateAndTestPlugin(spec) {
        try {
            const startTime = Date.now();
            
            // 生成插件代码
            const pluginCode = await this.pluginGenerator.generatePluginCode(spec);
            
            // 创建插件记录
            const plugin = {
                id: Date.now() + Math.random().toString(36).substr(2, 9),
                name: spec.name,
                description: spec.description,
                generatedAt: new Date().toISOString(),
                specification: spec,
                code: pluginCode,
                status: 'generated',
                testResults: null
            };
            
            // 测试插件
            const testResults = await this.testGeneratedPlugin(plugin);
            plugin.testResults = testResults;
            plugin.status = testResults.success ? 'tested' : 'failed';
            
            // 记录生成的插件
            this.evolutionData.generatedPlugins.push(plugin);
            
            // 保存插件生成记录到存储系统
            if (this.storageManager) {
                const generationTime = Date.now() - startTime;
                this.storageManager.savePluginGenerationRecord({
                    pluginId: plugin.id,
                    conversationId: spec.conversationId,
                    analysisId: spec.analysisId,
                    name: plugin.name,
                    type: spec.type || 'auto-generated',
                    specification: spec,
                    method: 'auto-generation',
                    sourceAnalysis: spec.sourceAnalysis || {},
                    generationTime: generationTime,
                    testResults: testResults,
                    status: plugin.status,
                    codeStats: {
                        linesOfCode: pluginCode ? pluginCode.split('\n').length : 0,
                        complexity: this.calculateCodeComplexity(pluginCode),
                        dependencies: this.extractDependencies(pluginCode)
                    },
                    tags: spec.tags || [],
                    category: spec.category || 'unknown'
                }).catch(error => {
                    console.error('Failed to save plugin generation record:', error);
                });
            }
            
            return plugin;
        } catch (error) {
            console.error('Failed to generate and test plugin:', error);
            return null;
        }
    }

    /**
     * 测试生成的插件
     */
    async testGeneratedPlugin(plugin) {
        try {
            const testResults = {
                success: false,
                tests: [],
                errors: []
            };
            
            // 基本代码解析测试
            try {
                new Function(plugin.code);
                testResults.tests.push({ name: 'Code Parsing', success: true });
            } catch (error) {
                testResults.tests.push({ 
                    name: 'Code Parsing', 
                    success: false, 
                    error: error.message 
                });
                testResults.errors.push(`Code parsing failed: ${error.message}`);
            }
            
            // 插件结构验证
            const structureTest = this.validatePluginStructure(plugin.code);
            testResults.tests.push(structureTest);
            
            if (!structureTest.success) {
                testResults.errors.push(structureTest.error);
            }
            
            // 设置总体成功状态
            testResults.success = testResults.tests.every(test => test.success);
            
            return testResults;
        } catch (error) {
            return {
                success: false,
                tests: [],
                errors: [`Test execution failed: ${error.message}`]
            };
        }
    }

    /**
     * 验证插件结构
     */
    validatePluginStructure(code) {
        try {
            // 检查必需的插件结构元素
            const requiredElements = [
                'name:', 'description:', 'version:', 'functions:'
            ];
            
            const missing = requiredElements.filter(element => 
                !code.includes(element)
            );
            
            if (missing.length > 0) {
                return {
                    name: 'Plugin Structure',
                    success: false,
                    error: `Missing required elements: ${missing.join(', ')}`
                };
            }
            
            return { name: 'Plugin Structure', success: true };
        } catch (error) {
            return {
                name: 'Plugin Structure',
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 完成当前对话
     */
    completeCurrentConversation() {
        const conversation = this.getCurrentConversation();
        if (conversation) {
            conversation.completed = true;
            conversation.endTime = new Date().toISOString();
            
            // 保存完整对话到存储系统
            if (this.storageManager) {
                this.storageManager.saveCompleteConversation(conversation).catch(error => {
                    console.error('Failed to save complete conversation to storage:', error);
                });
            }
            
            // 进行完整对话分析
            this.analyzeCompletedConversation(conversation);
            
            console.log('Conversation completed and saved:', conversation.id);
        }
    }

    /**
     * 分析完成的对话
     */
    async analyzeCompletedConversation(conversation) {
        try {
            const analysis = await this.analysisEngine.analyzeFullConversation(conversation);
            conversation.analysis = analysis;
            
            // 保存分析记录到存储系统
            if (this.storageManager && analysis) {
                this.storageManager.saveAnalysisRecord({
                    conversationId: conversation.id,
                    analysisType: 'completed-conversation',
                    results: analysis,
                    missingFunctions: analysis.criticalMissingFunctions || [],
                    suggestions: analysis.suggestions || [],
                    priority: analysis.overallPriority || 0,
                    processingTime: analysis.processingTime || 0,
                    confidence: analysis.confidence || 0,
                    context: conversation.context
                }).catch(error => {
                    console.error('Failed to save analysis record:', error);
                });
            }
            
            // 如果发现重要的缺失功能，考虑生成插件
            if (analysis.criticalMissingFunctions && analysis.criticalMissingFunctions.length > 0) {
                for (const missingFunc of analysis.criticalMissingFunctions) {
                    await this.considerPluginGeneration(missingFunc);
                }
            }
        } catch (error) {
            console.error('Failed to analyze completed conversation:', error);
        }
    }

    /**
     * 考虑生成插件
     */
    async considerPluginGeneration(missingFunction) {
        // 检查是否已经为此功能生成过插件
        const existingPlugin = this.evolutionData.generatedPlugins.find(plugin => 
            plugin.specification.addresses === missingFunction.id
        );
        
        if (!existingPlugin && missingFunction.priority >= 7) {
            await this.initiatePluginGeneration({ 
                isMissingFunction: true,
                missingFunctionDescription: missingFunction.description,
                userIntent: missingFunction.userIntent,
                suggestedImplementation: missingFunction.suggestedImplementation,
                priority: missingFunction.priority,
                shouldGeneratePlugin: true
            });
        }
    }

    /**
     * 获取进化统计
     */
    getEvolutionStats() {
        return {
            totalConversations: this.evolutionData.conversations.length,
            completedConversations: this.evolutionData.conversations.filter(c => c.completed).length,
            missingFunctions: this.evolutionData.missingFunctions.length,
            generatedPlugins: this.evolutionData.generatedPlugins.length,
            successfulPlugins: this.evolutionData.generatedPlugins.filter(p => p.status === 'tested').length,
            lastEvolutionDate: this.evolutionData.evolutionHistory.length > 0 
                ? this.evolutionData.evolutionHistory[this.evolutionData.evolutionHistory.length - 1].timestamp 
                : null
        };
    }

    /**
     * 加载进化数据
     */
    async loadEvolutionData() {
        try {
            const saved = this.configManager.get('evolution.data', null);
            if (saved) {
                this.evolutionData = { ...this.evolutionData, ...saved };
                console.log('Evolution data loaded:', this.getEvolutionStats());
            }
        } catch (error) {
            console.error('Failed to load evolution data:', error);
        }
    }

    /**
     * 保存进化数据
     */
    async saveEvolutionData() {
        try {
            await this.configManager.set('evolution.data', this.evolutionData);
            console.log('Evolution data saved');
        } catch (error) {
            console.error('Failed to save evolution data:', error);
        }
    }

    /**
     * 防抖保存
     */
    debouncedSaveEvolutionData() {
        if (this._saveTimeout) {
            clearTimeout(this._saveTimeout);
        }
        this._saveTimeout = setTimeout(() => {
            this.saveEvolutionData();
        }, 5000); // 5秒后保存
    }

    /**
     * 开始自动进化过程
     */
    async startEvolutionProcess() {
        try {
            console.log('Starting evolution process...');
            
            // 分析所有缺失功能
            const prioritizedFunctions = this.evolutionData.missingFunctions
                .sort((a, b) => (b.priority + b.occurrences) - (a.priority + a.occurrences))
                .slice(0, 5); // 优先处理前5个
            
            const evolutionReport = {
                timestamp: new Date().toISOString(),
                processedFunctions: 0,
                generatedPlugins: 0,
                results: []
            };
            
            for (const missingFunc of prioritizedFunctions) {
                try {
                    const plugin = await this.generatePluginForMissingFunction(missingFunc);
                    
                    if (plugin) {
                        evolutionReport.generatedPlugins++;
                        evolutionReport.results.push({
                            functionId: missingFunc.id,
                            pluginId: plugin.id,
                            success: true,
                            status: plugin.status
                        });
                    }
                    
                    evolutionReport.processedFunctions++;
                } catch (error) {
                    evolutionReport.results.push({
                        functionId: missingFunc.id,
                        success: false,
                        error: error.message
                    });
                }
            }
            
            // 记录进化历史
            this.evolutionData.evolutionHistory.push(evolutionReport);
            await this.saveEvolutionData();
            
            return evolutionReport;
        } catch (error) {
            console.error('Evolution process failed:', error);
            throw error;
        }
    }

    /**
     * 为缺失功能生成插件
     */
    async generatePluginForMissingFunction(missingFunction) {
        const analysis = {
            isMissingFunction: true,
            missingFunctionDescription: missingFunction.description,
            userIntent: missingFunction.userIntent,
            suggestedImplementation: missingFunction.suggestedImplementation,
            priority: missingFunction.priority,
            shouldGeneratePlugin: true
        };
        
        return await this.initiatePluginGeneration(analysis);
    }

    /**
     * 获取进化报告
     */
    generateEvolutionReport() {
        const stats = this.getEvolutionStats();
        const recentConversations = this.evolutionData.conversations
            .filter(c => c.completed)
            .slice(-10);
        
        const topMissingFunctions = this.evolutionData.missingFunctions
            .sort((a, b) => (b.priority + b.occurrences) - (a.priority + a.occurrences))
            .slice(0, 10);
        
        return {
            summary: stats,
            recentConversations: recentConversations.map(c => ({
                id: c.id,
                duration: this.calculateDuration(c.startTime, c.endTime),
                messageCount: c.stats.messageCount,
                errorCount: c.stats.errorCount,
                successRate: c.stats.successCount / Math.max(c.stats.messageCount, 1)
            })),
            topMissingFunctions,
            generatedPlugins: this.evolutionData.generatedPlugins.map(p => ({
                name: p.name,
                status: p.status,
                generatedAt: p.generatedAt,
                testSuccess: p.testResults?.success || false
            })),
            evolutionHistory: this.evolutionData.evolutionHistory
        };
    }

    /**
     * 计算持续时间
     */
    calculateDuration(startTime, endTime) {
        if (!endTime) return null;
        
        const start = new Date(startTime);
        const end = new Date(endTime);
        const diffMs = end - start;
        
        const minutes = Math.floor(diffMs / 60000);
        const seconds = Math.floor((diffMs % 60000) / 1000);
        
        return `${minutes}m ${seconds}s`;
    }

    /**
     * 计算代码复杂度（简化版）
     */
    calculateCodeComplexity(code) {
        if (!code) return 0;
        
        // 简单的复杂度计算：基于控制结构和函数数量
        const controlStructures = (code.match(/\b(if|else|for|while|switch|case|try|catch)\b/g) || []).length;
        const functions = (code.match(/function\s+\w+/g) || []).length;
        const methods = (code.match(/\w+\s*:\s*function/g) || []).length;
        
        return controlStructures + functions + methods;
    }

    /**
     * 提取代码依赖
     */
    extractDependencies(code) {
        if (!code) return [];
        
        const dependencies = [];
        
        // 提取常见的依赖模式
        const imports = code.match(/import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g) || [];
        const requires = code.match(/require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g) || [];
        
        imports.forEach(imp => {
            const match = imp.match(/from\s+['"`]([^'"`]+)['"`]/);
            if (match) dependencies.push(match[1]);
        });
        
        requires.forEach(req => {
            const match = req.match(/['"`]([^'"`]+)['"`]/);
            if (match) dependencies.push(match[1]);
        });
        
        return [...new Set(dependencies)]; // 去重
    }

    /**
     * 获取存储管理器的历史统计
     */
    getStorageStats() {
        if (this.storageManager) {
            return this.storageManager.getStorageStats();
        }
        return null;
    }

    /**
     * 获取对话历史（通过存储管理器）
     */
    getConversationHistory(filters = {}) {
        if (this.storageManager) {
            return this.storageManager.getConversationHistory(filters);
        }
        return [];
    }

    /**
     * 搜索对话（通过存储管理器）
     */
    searchConversations(query, options = {}) {
        if (this.storageManager) {
            return this.storageManager.searchConversations(query, options);
        }
        return [];
    }

    /**
     * 导出对话历史（通过存储管理器）
     */
    async exportConversationHistory(format = 'json', filters = {}) {
        if (this.storageManager) {
            return await this.storageManager.exportConversationHistory(format, filters);
        }
        throw new Error('Storage manager not available');
    }

    /**
     * Connect to ChatBox for data integration
     */
    connectToChatBox() {
        try {
            // Check if ChatManager is available
            if (typeof window !== 'undefined' && window.chatManager) {
                window.chatManager.connectToEvolutionManager(this);
                console.log('🧬 Connected to ChatBox for data integration');
            } else {
                console.log('🧬 ChatBox not available yet, will connect when available');
                
                // Set up a listener for when ChatBox becomes available
                const checkForChatBox = () => {
                    if (window.chatManager) {
                        window.chatManager.connectToEvolutionManager(this);
                        console.log('🧬 Connected to ChatBox for data integration (delayed)');
                    } else {
                        setTimeout(checkForChatBox, 1000); // Check every second
                    }
                };
                setTimeout(checkForChatBox, 1000);
            }
        } catch (error) {
            console.error('❌ Failed to connect to ChatBox:', error);
        }
    }

    /**
     * Add conversation data from ChatBox
     */
    addConversationData(conversationData) {
        try {
            console.log('🧬 Received conversation data from ChatBox:', conversationData.id);
            
            // Store in storage manager
            if (this.storageManager) {
                this.storageManager.addConversationRecord(conversationData);
            }
            
            // Process for analysis
            this.processConversationForAnalysis(conversationData);
            
        } catch (error) {
            console.error('❌ Failed to add conversation data:', error);
        }
    }

    /**
     * Process conversation data for analysis
     */
    processConversationForAnalysis(conversationData) {
        try {
            // Extract key patterns for analysis
            const analysisData = this.extractAnalysisPatterns(conversationData);
            
            // Store analysis record
            if (this.storageManager) {
                this.storageManager.addAnalysisRecord({
                    conversationId: conversationData.id,
                    analysisTime: new Date().toISOString(),
                    patterns: analysisData,
                    source: 'chatbox_integration'
                });
            }
            
            console.log('🧬 Processed conversation for analysis:', conversationData.id);
            
        } catch (error) {
            console.error('❌ Failed to process conversation for analysis:', error);
        }
    }

    /**
     * Extract analysis patterns from conversation data
     */
    extractAnalysisPatterns(conversationData) {
        const patterns = {
            messagePatterns: [],
            toolUsagePatterns: [],
            thinkingPatterns: [],
            errorPatterns: [],
            successPatterns: []
        };

        conversationData.events.forEach(event => {
            switch (event.type) {
                case 'message':
                    patterns.messagePatterns.push({
                        sender: event.sender,
                        contentLength: event.content.length,
                        timestamp: event.timestamp,
                        isError: event.isError
                    });
                    break;

                case 'tool_calls':
                    patterns.toolUsagePatterns.push({
                        tools: event.metadata?.toolNames || [],
                        toolCount: event.metadata?.toolCount || 0,
                        timestamp: event.timestamp
                    });
                    break;

                case 'thinking_process':
                    patterns.thinkingPatterns.push({
                        contentLength: event.content.length,
                        step: event.metadata?.step || 'unknown',
                        timestamp: event.timestamp
                    });
                    break;

                case 'tool_results':
                    if (event.metadata?.failCount > 0) {
                        patterns.errorPatterns.push({
                            failCount: event.metadata.failCount,
                            tools: event.metadata.tools,
                            timestamp: event.timestamp
                        });
                    }
                    if (event.metadata?.successCount > 0) {
                        patterns.successPatterns.push({
                            successCount: event.metadata.successCount,
                            tools: event.metadata.tools,
                            timestamp: event.timestamp
                        });
                    }
                    break;
            }
        });

        return patterns;
    }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConversationEvolutionManager;
} else if (typeof window !== 'undefined') {
    window.ConversationEvolutionManager = ConversationEvolutionManager;
}