/**
 * ConversationEvolutionStorageManager - 对话进化系统存储管理器
 * 为Conversation Evolution System提供独立的存储和历史管理功能
 * 使用独立的ConversationHistoryStorageManager处理大容量历史数据
 */
class ConversationEvolutionStorageManager {
    constructor(configManager) {
        this.configManager = configManager;
        this.isInitialized = false;

        // 初始化独立的历史存储管理器
        this.historyStorageManager = null;
        this.initializeHistoryStorage();

        // 默认数据结构，作为基准（仅用于配置，不包含大量历史数据）
        this.defaultHistoryData = this.getDefaultEvolutionConfig().historyData;
        this.storageConfig = this.getDefaultEvolutionConfig().storageConfig;
        
        // 轻量级历史数据（仅保存最近的少量数据用于快速访问）
        this.historyData = {
            conversations: [], // 仅保存最近50个对话的摘要
            analysisRecords: [],
            pluginGenerationHistory: [],
            evolutionTimeline: [],
            storageStats: {
                totalConversations: 0,
                totalMessages: 0,
                totalAnalysisCount: 0,
                totalPluginsGenerated: 0,
                firstRecordDate: null,
                lastUpdateDate: null,
                storageSize: 0
            }
        };

        // 防抖存储
        this._saveTimeout = null;

        console.log('ConversationEvolutionStorageManager initialized with independent storage');

        // 正确初始化 debouncedSave 方法
        this.debouncedSave = this.debounce(this.saveHistoryData.bind(this), 1500);
        // 构造函数中不再直接调用，改为外部显式调用
        // this.initializeStorage(); 
    }

    /**
     * 初始化独立的历史存储管理器
     */
    async initializeHistoryStorage() {
        try {
            // 动态加载ConversationHistoryStorageManager
            if (typeof window !== 'undefined' && window.ConversationHistoryStorageManager) {
                this.historyStorageManager = new window.ConversationHistoryStorageManager(this.configManager);
            } else if (typeof require !== 'undefined') {
                const ConversationHistoryStorageManager = require('./ConversationHistoryStorageManager');
                this.historyStorageManager = new ConversationHistoryStorageManager(this.configManager);
            }
            
            if (this.historyStorageManager) {
                console.log('✅ Independent history storage manager initialized');
                
                // 检查是否需要迁移现有数据
                await this.checkAndMigrateExistingData();
            } else {
                console.warn('⚠️ Failed to initialize independent history storage manager');
            }
            
        } catch (error) {
            console.error('❌ Failed to initialize history storage:', error);
        }
    }

    /**
     * 检查并迁移现有的大型历史数据
     */
    async checkAndMigrateExistingData() {
        try {
            // 获取现有的evolution配置
            const existingConfig = this.configManager.get('evolution', null);
            
            if (existingConfig && existingConfig.historyData && existingConfig.historyData.conversations) {
                const conversations = existingConfig.historyData.conversations;
                
                // 如果现有对话数量很大，需要迁移
                if (conversations.length > 100) {
                    console.log(`🔄 Starting data migration: ${conversations.length} conversations found`);
                    
                    let migratedCount = 0;
                    const batchSize = 50;
                    
                    // 批量迁移对话数据
                    for (let i = 0; i < conversations.length; i += batchSize) {
                        const batch = conversations.slice(i, i + batchSize);
                        
                        for (const conversation of batch) {
                            try {
                                // 迁移完整对话到独立存储
                                await this.historyStorageManager.addConversation(conversation);
                                migratedCount++;
                            } catch (error) {
                                console.warn(`Failed to migrate conversation ${conversation.id}:`, error);
                            }
                        }
                        
                        // 小延迟避免阻塞UI
                        await new Promise(resolve => setTimeout(resolve, 10));
                    }
                    
                    console.log(`✅ Migration completed: ${migratedCount}/${conversations.length} conversations migrated`);
                    
                    // 创建迁移后的轻量级配置
                    const lightweightConfig = {
                        ...existingConfig,
                        historyData: {
                            ...existingConfig.historyData,
                            conversations: conversations.slice(-50).map(conv => ({
                                id: conv.id,
                                startTime: conv.startTime,
                                endTime: conv.endTime,
                                source: conv.source,
                                messageCount: conv.events ? conv.events.length : 0,
                                stats: conv.stats,
                                metadata: {
                                    processedAt: conv.metadata?.processedAt,
                                    version: conv.metadata?.version,
                                    migrated: true
                                }
                            }))
                        }
                    };
                    
                    // 保存轻量级配置
                    await this.configManager.set('evolution', lightweightConfig);
                    await this.configManager.saveConfig();
                    
                    console.log(`🎯 Lightweight config saved with ${lightweightConfig.historyData.conversations.length} conversation summaries`);
                }
            }
            
        } catch (error) {
            console.error('❌ Failed to migrate existing data:', error);
        }
    }

    /**
     * 防抖函数
     */
    debounce(func, wait) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    }

    /**
     * 深度合并对象的辅助函数
     */
    isObject(item) {
        return (item && typeof item === 'object' && !Array.isArray(item));
    }

    deepmerge(target, ...sources) {
        if (!sources.length) return target;
        const source = sources.shift();

        if (this.isObject(target) && this.isObject(source)) {
            for (const key in source) {
                if (this.isObject(source[key])) {
                    if (!target[key]) Object.assign(target, { [key]: {} });
                    this.deepmerge(target[key], source[key]);
                } else {
                    Object.assign(target, { [key]: source[key] });
                }
            }
        }
        return this.deepmerge(target, ...sources);
    }
    
    /**
     * 初始化存储系统（核心入口）
     */
    async initializeStorage() {
        if (this.isInitialized) {
            console.log('🔄 Storage already initialized.');
            return;
        }
        console.log('🚀 Initializing evolution storage system...');
        try {
            await this.loadHistoryData();
            this.setupAutoBackup();
            this.isInitialized = true;
            console.log('✅ Evolution storage system initialized successfully');
            console.log(`📊 Found ${this.historyData.conversations.length} conversations on disk.`);
        } catch (error) {
            console.error('❌ Failed to initialize evolution storage:', error);
            // 即使初始化失败，也要确保有一个有效的空数据结构
            this.historyData = this.deepmerge({}, this.defaultHistoryData);
            this.isInitialized = true;
        }
    }
    
    /**
     * 加载历史数据
     */
    async loadHistoryData() {
        console.log('💾 Loading evolution history data from disk...');
        try {
            // 确保ConfigManager已准备好
            await this.configManager.waitForInitialization();

            const evolutionConfig = this.configManager.get('evolution', null);
            
            if (evolutionConfig && this.isObject(evolutionConfig)) {
                console.log('✅ Found existing evolution configuration.');
                // 使用深度合并，而不是直接赋值，防止数据结构不一致或丢失
                this.historyData = this.deepmerge({}, this.defaultHistoryData, evolutionConfig.historyData || {});
                this.storageConfig = this.deepmerge({}, this.storageConfig, evolutionConfig.storageConfig || {});
                
                // 数据校验和清理
                if (!Array.isArray(this.historyData.conversations)) {
                    console.warn('⚠️ Conversations data is not an array, resetting.');
                    this.historyData.conversations = [];
                }

            } else {
                console.log('⚠️ No existing evolution config found, starting with default structure.');
                // 如果没有配置文件，则使用默认空数据，并触发一次保存以创建文件
                this.historyData = this.deepmerge({}, this.defaultHistoryData);
                await this.saveHistoryData();
            }
            
            console.log(`👍 History data loaded. Conversations: ${this.historyData.conversations.length}`);
            this.updateStorageStats();

        } catch (error) {
            console.error('❌ Failed to load evolution history:', error);
            // 出错时回退到安全的默认值
            this.historyData = this.deepmerge({}, this.defaultHistoryData);
        }
    }

    /**
     * 保存历史数据到配置文件（轻量级配置）和独立存储（大容量数据）
     */
    async saveHistoryData() {
        if (!this.isInitialized) {
            console.warn('💾 Save attempt skipped: storage not initialized.');
            return;
        }
        console.log('💾 Saving evolution history data to disk...');
        try {
            // 准备轻量级配置数据（不包含大量对话历史）
            const evolutionConfig = {
                version: '1.0.1', // 版本号提升
                lastModified: new Date().toISOString(),
                storageConfig: this.storageConfig,
                historyData: {
                    // 仅保存统计信息和最近的少量摘要数据
                    conversations: this.historyData.conversations.slice(-50), // 最近50个对话摘要
                    analysisRecords: this.historyData.analysisRecords,
                    pluginGenerationHistory: this.historyData.pluginGenerationHistory,
                    evolutionTimeline: this.historyData.evolutionTimeline,
                    storageStats: this.historyData.storageStats
                }
            };
            
            // 保存轻量级配置到ConfigManager
            await this.configManager.set('evolution', evolutionConfig);
            await this.configManager.saveConfig(); 
            
            console.log(`✅ Evolution config saved. Summary conversations: ${evolutionConfig.historyData.conversations.length}`);
            
            // 获取独立存储统计信息
            if (this.historyStorageManager) {
                const stats = await this.historyStorageManager.getStorageStats();
                console.log(`📊 Independent storage: ${stats.currentFile.conversations} current, ${stats.archives.count} archives`);
            }
            
        } catch (error) {
            console.error('❌ Failed to save evolution history:', error);
            throw error;
        }
    }

    /**
     * Add conversation record from ChatBox
     */
    addConversationRecord(conversationData) {
        if (!this.isInitialized) {
             console.warn('🔴 Add record failed: storage not initialized.');
             return;
        }
        try {
            console.log('➕ Adding new conversation record:', conversationData.id);
            if (!this.historyData.conversations) {
                this.historyData.conversations = [];
            }

            // Convert ChatBox conversation data to our storage format
            const conversationRecord = {
                id: conversationData.id,
                startTime: conversationData.startTime,
                endTime: conversationData.endTime,
                source: 'chatbox_integration',
                events: conversationData.events,
                context: conversationData.context,
                stats: conversationData.stats,
                metadata: {
                    ...conversationData.metadata,
                    processedAt: new Date().toISOString(),
                    version: this.storageConfig.version || '1.0.0'
                }
            };

            // 1. 保存完整数据到独立存储管理器
            if (this.historyStorageManager) {
                this.historyStorageManager.addConversation(conversationRecord).catch(error => {
                    console.error('❌ Failed to save to independent storage:', error);
                });
            }

            // 2. 保存轻量级摘要到内存（用于快速访问）
            const conversationSummary = {
                id: conversationRecord.id,
                startTime: conversationRecord.startTime,
                endTime: conversationRecord.endTime,
                source: conversationRecord.source,
                messageCount: conversationRecord.events ? conversationRecord.events.length : 0,
                stats: conversationRecord.stats,
                metadata: {
                    processedAt: conversationRecord.metadata.processedAt,
                    version: conversationRecord.metadata.version
                }
            };

            // 只在内存中保留最近的对话摘要
            this.historyData.conversations.push(conversationSummary);
            
            // 保持内存中的对话摘要数量限制（最多200个）
            if (this.historyData.conversations.length > 200) {
                this.historyData.conversations = this.historyData.conversations.slice(-150); // 保留最新150个
            }

            // Update storage stats
            this.updateStorageStats(conversationRecord);

            // Auto-save (轻量级配置)
            this.debouncedSave();

            console.log(`🧬 Added conversation record: ${conversationRecord.id}. Summary count: ${this.historyData.conversations.length}`);

        } catch (error) {
            console.error('❌ Failed to add conversation record:', error);
        }
    }

    /**
     * Add analysis record
     */
    addAnalysisRecord(analysisData) {
        try {
            if (!this.historyData.analysisRecords) {
                this.historyData.analysisRecords = [];
            }

            const analysisRecord = {
                id: `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                timestamp: new Date().toISOString(),
                ...analysisData
            };

            this.historyData.analysisRecords.push(analysisRecord);

            // Update storage stats
            this.historyData.storageStats.totalAnalysisCount++;
            this.historyData.storageStats.lastUpdateDate = new Date().toISOString();

            // Auto-save
            this.debouncedSave();

            console.log('🧬 Added analysis record:', analysisRecord.id);

        } catch (error) {
            console.error('❌ Failed to add analysis record:', error);
        }
    }

    /**
     * Update storage statistics
     */
    updateStorageStats(conversationRecord) {
        if (!this.historyData.storageStats) {
            this.historyData.storageStats = {
                totalConversations: 0,
                totalMessages: 0,
                totalAnalysisCount: 0,
                totalPluginsGenerated: 0,
                firstRecordDate: null,
                lastUpdateDate: null,
                storageSize: 0
            };
        }

        const stats = this.historyData.storageStats;
        
        // Correct way to update total conversations
        stats.totalConversations = this.historyData.conversations.length;
        
        if (conversationRecord) {
            stats.totalMessages += conversationRecord.stats?.messageCount || 0;
            if (!stats.firstRecordDate) {
                stats.firstRecordDate = conversationRecord.startTime;
            }
        }
        
        stats.lastUpdateDate = new Date().toISOString();
        
        // Calculate approximate storage size
        stats.storageSize = JSON.stringify(this.historyData).length;
    }

    /**
     * 保存完整对话记录
     */
    async saveCompleteConversation(conversationData) {
        try {
            const conversationRecord = {
                id: conversationData.id || this.generateId(),
                startTime: conversationData.startTime,
                endTime: conversationData.endTime || new Date().toISOString(),
                duration: this.calculateDuration(conversationData.startTime, conversationData.endTime),
                
                // 对话基本信息
                messageCount: conversationData.events ? conversationData.events.length : 0,
                participants: this.extractParticipants(conversationData),
                context: conversationData.context || {},
                
                // 对话内容
                messages: this.formatMessages(conversationData.events || []),
                
                // 分析结果
                analysis: conversationData.analysis || null,
                errors: this.extractErrors(conversationData.events || []),
                toolCalls: this.extractToolCalls(conversationData.events || []),
                
                // 统计信息
                stats: {
                    successCount: conversationData.stats?.successCount || 0,
                    errorCount: conversationData.stats?.errorCount || 0,
                    toolCallCount: conversationData.stats?.toolCallCount || 0,
                    failureCount: conversationData.stats?.failureCount || 0,
                    averageResponseTime: this.calculateAverageResponseTime(conversationData.events || [])
                },
                
                // 元数据
                metadata: {
                    source: 'evolution-system',
                    version: '1.0.0',
                    savedAt: new Date().toISOString(),
                    tags: this.generateTags(conversationData),
                    category: this.categorizeConversation(conversationData)
                }
            };

            // 添加到历史记录
            this.historyData.conversations.push(conversationRecord);
            
            // 限制历史长度
            this.limitHistoryLength();
            
            // 更新统计
            this.updateStorageStats();
            
            // 保存数据
            await this.saveHistoryData();
            
            console.log('Complete conversation saved:', conversationRecord.id);
            return conversationRecord.id;
        } catch (error) {
            console.error('Failed to save complete conversation:', error);
            throw error;
        }
    }

    /**
     * 保存分析记录
     */
    async saveAnalysisRecord(analysisData) {
        try {
            const analysisRecord = {
                id: this.generateId(),
                timestamp: new Date().toISOString(),
                conversationId: analysisData.conversationId,
                analysisType: analysisData.analysisType || 'general',
                
                // 分析结果
                results: analysisData.results || {},
                missingFunctions: analysisData.missingFunctions || [],
                suggestions: analysisData.suggestions || [],
                priority: analysisData.priority || 0,
                
                // 性能指标
                processingTime: analysisData.processingTime || 0,
                confidence: analysisData.confidence || 0,
                
                // 元数据
                metadata: {
                    analyzer: analysisData.analyzer || 'ConversationAnalysisEngine',
                    version: analysisData.version || '1.0.0',
                    context: analysisData.context || {}
                }
            };

            this.historyData.analysisRecords.push(analysisRecord);
            this.updateStorageStats();
            await this.debouncedSave();
            
            console.log('Analysis record saved:', analysisRecord.id);
            return analysisRecord.id;
        } catch (error) {
            console.error('Failed to save analysis record:', error);
            throw error;
        }
    }

    /**
     * 保存插件生成历史
     */
    async savePluginGenerationRecord(pluginData) {
        try {
            const pluginRecord = {
                id: this.generateId(),
                timestamp: new Date().toISOString(),
                pluginId: pluginData.pluginId,
                conversationId: pluginData.conversationId,
                analysisId: pluginData.analysisId,
                
                // 插件信息
                pluginName: pluginData.name,
                pluginType: pluginData.type,
                specification: pluginData.specification || {},
                
                // 生成过程
                generationMethod: pluginData.method || 'auto',
                sourceAnalysis: pluginData.sourceAnalysis || {},
                generationTime: pluginData.generationTime || 0,
                
                // 测试结果
                testResults: pluginData.testResults || null,
                status: pluginData.status || 'generated',
                
                // 代码信息
                codeStats: {
                    linesOfCode: pluginData.codeStats?.linesOfCode || 0,
                    complexity: pluginData.codeStats?.complexity || 0,
                    dependencies: pluginData.codeStats?.dependencies || []
                },
                
                // 元数据
                metadata: {
                    generator: 'AutoPluginGenerator',
                    version: '1.0.0',
                    tags: pluginData.tags || [],
                    category: pluginData.category || 'unknown'
                }
            };

            this.historyData.pluginGenerationHistory.push(pluginRecord);
            this.updateStorageStats();
            await this.debouncedSave();
            
            console.log('Plugin generation record saved:', pluginRecord.id);
            return pluginRecord.id;
        } catch (error) {
            console.error('Failed to save plugin generation record:', error);
            throw error;
        }
    }

    /**
     * 添加进化时间线事件
     */
    async addEvolutionTimelineEvent(eventData) {
        try {
            const timelineEvent = {
                id: this.generateId(),
                timestamp: new Date().toISOString(),
                eventType: eventData.type,
                title: eventData.title,
                description: eventData.description,
                
                // 相关数据
                relatedIds: {
                    conversationId: eventData.conversationId || null,
                    analysisId: eventData.analysisId || null,
                    pluginId: eventData.pluginId || null
                },
                
                // 事件数据
                data: eventData.data || {},
                impact: eventData.impact || 'low',
                category: eventData.category || 'general',
                
                // 元数据
                metadata: {
                    source: eventData.source || 'evolution-system',
                    version: '1.0.0',
                    context: eventData.context || {}
                }
            };

            this.historyData.evolutionTimeline.push(timelineEvent);
            
            // 按时间排序
            this.historyData.evolutionTimeline.sort((a, b) => 
                new Date(b.timestamp) - new Date(a.timestamp)
            );
            
            await this.debouncedSave();
            
            console.log('Evolution timeline event added:', timelineEvent.id);
            return timelineEvent.id;
        } catch (error) {
            console.error('Failed to add timeline event:', error);
            throw error;
        }
    }

    /**
     * 获取对话历史
     */
    getConversationHistory(filters = {}) {
        let conversations = [...this.historyData.conversations];
        
        // 应用过滤器
        if (filters.dateRange) {
            const { startDate, endDate } = filters.dateRange;
            conversations = conversations.filter(conv => {
                const convDate = new Date(conv.startTime);
                return convDate >= new Date(startDate) && convDate <= new Date(endDate);
            });
        }
        
        if (filters.category) {
            conversations = conversations.filter(conv => 
                conv.metadata?.category === filters.category
            );
        }
        
        if (filters.minMessages) {
            conversations = conversations.filter(conv => 
                conv.messageCount >= filters.minMessages
            );
        }
        
        if (filters.hasErrors !== undefined) {
            conversations = conversations.filter(conv => 
                (conv.stats.errorCount > 0) === filters.hasErrors
            );
        }
        
        // 应用排序
        const sortBy = filters.sortBy || 'startTime';
        const sortOrder = filters.sortOrder || 'desc';
        
        conversations.sort((a, b) => {
            const aVal = this.getNestedValue(a, sortBy);
            const bVal = this.getNestedValue(b, sortBy);
            
            if (sortOrder === 'desc') {
                return bVal > aVal ? 1 : -1;
            } else {
                return aVal > bVal ? 1 : -1;
            }
        });
        
        // 应用限制
        if (filters.limit) {
            conversations = conversations.slice(0, filters.limit);
        }
        
        return conversations;
    }

    /**
     * 搜索对话
     */
    searchConversations(query, options = {}) {
        const searchFields = options.fields || ['messages', 'context', 'analysis'];
        const caseSensitive = options.caseSensitive || false;
        const searchQuery = caseSensitive ? query : query.toLowerCase();
        
        return this.historyData.conversations.filter(conversation => {
            // 搜索消息内容 - 从events中提取消息
            if (searchFields.includes('messages')) {
                const messageEvents = conversation.events ? conversation.events.filter(event => 
                    event.type === 'message' && event.content
                ) : [];
                
                const messageMatch = messageEvents.some(event => {
                    const content = caseSensitive ? event.content : event.content.toLowerCase();
                    return content.includes(searchQuery);
                });
                if (messageMatch) return true;
                
                // 也搜索旧格式的messages字段（向后兼容）
                if (conversation.messages) {
                    const legacyMessageMatch = conversation.messages.some(msg => {
                        const content = caseSensitive ? msg.content : msg.content.toLowerCase();
                        return content.includes(searchQuery);
                    });
                    if (legacyMessageMatch) return true;
                }
            }
            
            // 搜索上下文
            if (searchFields.includes('context')) {
                const contextStr = caseSensitive ? 
                    JSON.stringify(conversation.context) : 
                    JSON.stringify(conversation.context).toLowerCase();
                if (contextStr.includes(searchQuery)) return true;
            }
            
            // 搜索分析结果
            if (searchFields.includes('analysis') && conversation.analysis) {
                const analysisStr = caseSensitive ? 
                    JSON.stringify(conversation.analysis) : 
                    JSON.stringify(conversation.analysis).toLowerCase();
                if (analysisStr.includes(searchQuery)) return true;
            }
            
            return false;
        });
    }

    /**
     * 导出对话历史
     */
    async exportConversationHistory(format = 'json', filters = {}) {
        try {
            const conversations = this.getConversationHistory(filters);
            
            const exportData = {
                exportedAt: new Date().toISOString(),
                exportFormat: format,
                filters: filters,
                totalConversations: conversations.length,
                storageStats: this.historyData.storageStats,
                conversations: conversations
            };
            
            let content, filename, mimeType;
            
            switch (format.toLowerCase()) {
                case 'json':
                    content = JSON.stringify(exportData, null, 2);
                    filename = `evolution-conversations-${new Date().toISOString().split('T')[0]}.json`;
                    mimeType = 'application/json';
                    break;
                    
                case 'csv':
                    content = this.convertToCSV(conversations);
                    filename = `evolution-conversations-${new Date().toISOString().split('T')[0]}.csv`;
                    mimeType = 'text/csv';
                    break;
                    
                case 'txt':
                    content = this.convertToText(conversations);
                    filename = `evolution-conversations-${new Date().toISOString().split('T')[0]}.txt`;
                    mimeType = 'text/plain';
                    break;
                    
                default:
                    throw new Error(`Unsupported export format: ${format}`);
            }
            
            // 下载文件
            this.downloadFile(content, filename, mimeType);
            
            console.log(`Exported ${conversations.length} conversations as ${format.toUpperCase()}`);
            return true;
        } catch (error) {
            console.error('Failed to export conversation history:', error);
            throw error;
        }
    }

    /**
     * 获取存储统计信息
     */
    getStorageStats() {
        return {
            ...this.historyData.storageStats,
            currentStorageSize: this.calculateStorageSize(),
            lastUpdateDate: new Date().toISOString()
        };
    }

    /**
     * 清理历史数据
     */
    async cleanupHistory(options = {}) {
        try {
            const {
                olderThanDays = 30,
                keepMinimum = 10,
                removeErrors = false,
                removeEmpty = true
            } = options;
            
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
            
            let removedCount = 0;
            const initialCount = this.historyData.conversations.length;
            
            this.historyData.conversations = this.historyData.conversations.filter((conv, index) => {
                // 保留最小数量
                if (index < keepMinimum) return true;
                
                const convDate = new Date(conv.startTime);
                
                // 移除旧数据
                if (convDate < cutoffDate) {
                    removedCount++;
                    return false;
                }
                
                // 移除错误记录
                if (removeErrors && conv.stats.errorCount > conv.stats.successCount) {
                    removedCount++;
                    return false;
                }
                
                // 移除空对话
                if (removeEmpty && conv.messageCount === 0) {
                    removedCount++;
                    return false;
                }
                
                return true;
            });
            
            // 清理其他历史数据
            this.historyData.analysisRecords = this.historyData.analysisRecords.filter(record => 
                new Date(record.timestamp) >= cutoffDate
            );
            
            this.historyData.pluginGenerationHistory = this.historyData.pluginGenerationHistory.filter(record => 
                new Date(record.timestamp) >= cutoffDate
            );
            
            this.historyData.evolutionTimeline = this.historyData.evolutionTimeline.filter(event => 
                new Date(event.timestamp) >= cutoffDate
            );
            
            this.updateStorageStats();
            await this.saveHistoryData();
            
            console.log(`History cleanup completed: removed ${removedCount} of ${initialCount} conversations`);
            return {
                removedConversations: removedCount,
                remainingConversations: this.historyData.conversations.length,
                totalRemoved: removedCount
            };
        } catch (error) {
            console.error('Failed to cleanup history:', error);
            throw error;
        }
    }

    /**
     * 备份历史数据
     */
    async backupHistory() {
        try {
            const backupData = {
                backupDate: new Date().toISOString(),
                version: '1.0.0',
                historyData: this.historyData,
                storageConfig: this.storageConfig
            };
            
            const backupKey = `evolution_backup_${Date.now()}`;
            await this.configManager.set(`backups.${backupKey}`, backupData);
            
            // 限制备份数量（保留最近10个备份）
            const backups = this.configManager.get('backups', {});
            const backupKeys = Object.keys(backups).filter(key => key.startsWith('evolution_backup_'));
            
            if (backupKeys.length > 10) {
                const sortedKeys = backupKeys.sort().slice(0, -10);
                for (const key of sortedKeys) {
                    await this.configManager.set(key, undefined);
                }
            }
            
            console.log('Evolution history backed up successfully:', backupKey);
            return backupKey;
        } catch (error) {
            console.error('Failed to backup history:', error);
            throw error;
        }
    }

    /**
     * 从备份恢复历史数据
     */
    async restoreFromBackup(backupKey) {
        try {
            const backupData = this.configManager.get(`backups.${backupKey}`, null);
            if (!backupData) {
                throw new Error('Backup not found');
            }
            
            this.historyData = backupData.historyData;
            this.storageConfig = { ...this.storageConfig, ...backupData.storageConfig };
            
            await this.saveHistoryData();
            this.updateStorageStats();
            
            console.log('Evolution history restored from backup:', backupKey);
            return true;
        } catch (error) {
            console.error('Failed to restore from backup:', error);
            throw error;
        }
    }

    // ========================================
    // 私有辅助方法
    // ========================================

    /**
     * 生成唯一ID
     */
    generateId() {
        return Date.now() + Math.random().toString(36).substr(2, 9);
    }

    /**
     * 计算持续时间
     */
    calculateDuration(startTime, endTime) {
        if (!endTime) return null;
        
        const start = new Date(startTime);
        const end = new Date(endTime);
        const diffMs = end - start;
        
        const hours = Math.floor(diffMs / 3600000);
        const minutes = Math.floor((diffMs % 3600000) / 60000);
        const seconds = Math.floor((diffMs % 60000) / 1000);
        
        if (hours > 0) {
            return `${hours}h ${minutes}m ${seconds}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        } else {
            return `${seconds}s`;
        }
    }

    /**
     * 提取参与者信息
     */
    extractParticipants(conversationData) {
        const participants = new Set();
        
        if (conversationData.events) {
            conversationData.events.forEach(event => {
                if (event.sender) {
                    participants.add(event.sender);
                }
            });
        }
        
        return Array.from(participants);
    }

    /**
     * 格式化消息
     */
    formatMessages(events) {
        return events.map(event => ({
            id: event.id,
            timestamp: event.timestamp,
            sender: event.sender,
            content: event.message,
            isError: event.isError || false,
            context: event.context || {}
        }));
    }

    /**
     * 提取错误信息
     */
    extractErrors(events) {
        return events
            .filter(event => event.isError)
            .map(event => ({
                timestamp: event.timestamp,
                message: event.message,
                context: event.context
            }));
    }

    /**
     * 提取工具调用
     */
    extractToolCalls(events) {
        return events
            .filter(event => event.message && event.message.includes('tool_name'))
            .map(event => ({
                timestamp: event.timestamp,
                toolCall: event.message,
                context: event.context
            }));
    }

    /**
     * 计算平均响应时间
     */
    calculateAverageResponseTime(events) {
        const responseTimes = [];
        
        for (let i = 1; i < events.length; i++) {
            const prevEvent = events[i - 1];
            const currentEvent = events[i];
            
            if (prevEvent.sender === 'user' && currentEvent.sender === 'assistant') {
                const responseTime = new Date(currentEvent.timestamp) - new Date(prevEvent.timestamp);
                responseTimes.push(responseTime);
            }
        }
        
        if (responseTimes.length === 0) return 0;
        
        const totalTime = responseTimes.reduce((sum, time) => sum + time, 0);
        return Math.round(totalTime / responseTimes.length);
    }

    /**
     * 生成标签
     */
    generateTags(conversationData) {
        const tags = [];
        
        if (conversationData.stats?.errorCount > 0) {
            tags.push('errors');
        }
        
        if (conversationData.stats?.toolCallCount > 0) {
            tags.push('tool-calls');
        }
        
        if (conversationData.analysis) {
            tags.push('analyzed');
        }
        
        const messageCount = conversationData.events?.length || 0;
        if (messageCount > 20) {
            tags.push('long-conversation');
        } else if (messageCount < 5) {
            tags.push('short-conversation');
        }
        
        return tags;
    }

    /**
     * 对话分类
     */
    categorizeConversation(conversationData) {
        const messageCount = conversationData.events?.length || 0;
        const errorCount = conversationData.stats?.errorCount || 0;
        const successCount = conversationData.stats?.successCount || 0;
        
        if (errorCount > successCount) {
            return 'problematic';
        }
        
        if (conversationData.analysis?.shouldGeneratePlugin) {
            return 'plugin-generation';
        }
        
        if (messageCount > 20) {
            return 'extended';
        }
        
        if (conversationData.stats?.toolCallCount > 5) {
            return 'tool-intensive';
        }
        
        return 'standard';
    }

    /**
     * 限制历史长度
     */
    limitHistoryLength() {
        if (this.historyData.conversations.length > this.storageConfig.maxConversations) {
            const excess = this.historyData.conversations.length - this.storageConfig.maxConversations;
            this.historyData.conversations.splice(0, excess);
        }
    }

    /**
     * 更新存储统计
     */
    updateStorageStats() {
        const conversations = this.historyData.conversations;
        
        this.historyData.storageStats = {
            totalConversations: conversations.length,
            totalMessages: conversations.reduce((sum, conv) => {
                // 优先使用stats.messageCount，然后是messageCount，最后计算events长度
                const messageCount = conv.stats?.messageCount || conv.messageCount || 
                    (conv.events ? conv.events.filter(e => e.type === 'message').length : 0);
                return sum + messageCount;
            }, 0),
            totalAnalysisCount: this.historyData.analysisRecords.length,
            totalPluginsGenerated: this.historyData.pluginGenerationHistory.length,
            firstRecordDate: conversations.length > 0 ? 
                Math.min(...conversations.map(conv => new Date(conv.startTime))) : null,
            lastUpdateDate: new Date().toISOString(),
            storageSize: this.calculateStorageSize()
        };
    }

    /**
     * 计算存储大小
     */
    calculateStorageSize() {
        const dataStr = JSON.stringify(this.historyData);
        return new Blob([dataStr]).size;
    }

    /**
     * 获取嵌套值
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    /**
     * 转换为CSV格式
     */
    convertToCSV(conversations) {
        const headers = [
            'ID', 'Start Time', 'End Time', 'Duration', 'Message Count',
            'Success Count', 'Error Count', 'Tool Call Count', 'Category', 'Tags'
        ];
        
        const rows = conversations.map(conv => [
            conv.id,
            conv.startTime,
            conv.endTime,
            conv.duration,
            conv.messageCount,
            conv.stats.successCount,
            conv.stats.errorCount,
            conv.stats.toolCallCount,
            conv.metadata?.category || '',
            conv.metadata?.tags?.join(';') || ''
        ]);
        
        return [headers, ...rows].map(row => 
            row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        ).join('\n');
    }

    /**
     * 转换为文本格式
     */
    convertToText(conversations) {
        return conversations.map((conv, index) => {
            let text = `\n${'='.repeat(60)}\n`;
            text += `Conversation ${index + 1}: ${conv.id}\n`;
            text += `Start: ${conv.startTime}\n`;
            text += `Duration: ${conv.duration}\n`;
            text += `Messages: ${conv.messageCount}, Errors: ${conv.stats.errorCount}\n`;
            text += `Category: ${conv.metadata?.category || 'Unknown'}\n`;
            text += `${'='.repeat(60)}\n`;
            
            conv.messages.forEach(msg => {
                text += `\n[${new Date(msg.timestamp).toLocaleTimeString()}] ${msg.sender.toUpperCase()}:\n`;
                text += `${msg.content}\n`;
            });
            
            return text;
        }).join('\n');
    }

    /**
     * 下载文件
     */
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * 设置自动备份
     */
    setupAutoBackup() {
        if (this.storageConfig.enableBackup) {
            console.log('Auto backup system initialized');
            // 简化版自动备份
        }
    }

    /**
     * 验证和初始化独立存储文件
     */
    async initializeIndependentStorage() {
        // This method is now effectively replaced by initializeStorage and loadHistoryData
        // We will call initializeStorage from ConversationEvolutionManager instead
        console.log('DEPRECATED: initializeIndependentStorage should not be called directly. Use initializeStorage.');
        return this.initializeStorage();
    }

    /**
     * 显示存储配置摘要
     */
    displayStorageConfigSummary(config) {
        console.log('\n📊 Conversation Evolution Storage Summary:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`📝 Version: ${config.version}`);
        console.log(`📅 Last Modified: ${config.lastModified}`);
        console.log(`💾 Max Conversations: ${config.storageConfig?.maxConversations || 'N/A'}`);
        console.log(`🔄 Auto Save: ${config.storageConfig?.autoSave ? 'Enabled' : 'Disabled'}`);
        console.log(`⏱️  Auto Save Interval: ${(config.storageConfig?.autoSaveInterval / 1000) || 'N/A'}s`);
        console.log(`🗃️  Current Conversations: ${config.historyData?.conversations?.length || 0}`);
        console.log(`🔍 Analysis Records: ${config.historyData?.analysisRecords?.length || 0}`);
        console.log(`🔧 Plugin Records: ${config.historyData?.pluginGenerationHistory?.length || 0}`);
        console.log(`📈 Total Storage Size: ${this.formatBytes(config.historyData?.storageStats?.storageSize || 0)}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }

    /**
     * 格式化字节数
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * 获取存储文件路径信息
     */
    getStorageInfo() {
        const configPath = this.configManager.configPath;
        if (configPath && configPath.evolution) {
            return {
                filePath: configPath.evolution,
                fileName: 'conversation-evolution-data.json',
                directory: configPath.dir,
                exists: true
            };
        }
        
        return {
            filePath: null,
            fileName: 'conversation-evolution-data.json',
            directory: '/Users/song/.genome-browser/',
            exists: false
        };
    }

    /**
     * 获取默认的evolution配置（备用方法）
     */
    getDefaultEvolutionConfig() {
        return {
            version: '1.0.0',
            lastModified: new Date().toISOString(),
            
            // 存储配置
            storageConfig: {
                maxConversations: 1000,
                maxHistoryLength: 10000,
                autoSave: true,
                autoSaveInterval: 5000, // 5秒
                enableBackup: true,
                backupInterval: 86400000, // 24小时
                compressionEnabled: true,
                maxFileSize: 50 * 1024 * 1024 // 50MB
            },
            
            // 历史数据结构
            historyData: {
                conversations: [],
                analysisRecords: [],
                pluginGenerationHistory: [],
                evolutionTimeline: [],
                storageStats: {
                    totalConversations: 0,
                    totalMessages: 0,
                    totalAnalysisCount: 0,
                    totalPluginsGenerated: 0,
                    firstRecordDate: null,
                    lastUpdateDate: null,
                    storageSize: 0
                }
            },
            
            // 分析引擎配置
            analysisConfig: {
                enableRealTimeAnalysis: true,
                failureDetectionKeywords: [
                    'error', 'failed', 'cannot', 'unable', 'not available', 
                    'not found', 'not supported', 'not implemented',
                    'sorry', 'unfortunately', 'not possible'
                ],
                successDetectionKeywords: [
                    'success', 'completed', 'done', 'finished', 'resolved', 
                    'working', 'created', 'generated', 'saved'
                ],
                minConversationLength: 3, // Minimum messages before analysis
                analysisThreshold: 0.7, // Confidence threshold for analysis
                pluginGenerationThreshold: 0.8 // Threshold to trigger plugin generation
            },
            
            // 插件生成配置
            pluginGenerationConfig: {
                enabled: true,
                autoGenerate: false, // Manual approval required
                testingEnabled: true,
                maxGenerationAttempts: 3,
                templateEngine: 'default',
                codeValidation: true,
                securityScan: true,
                outputDirectory: 'src/renderer/modules/Plugins/Generated'
            },
            
            // 用户界面配置
            uiConfig: {
                showEvolutionPanel: true,
                showAnalysisResults: true,
                showPluginGeneration: true,
                notificationsEnabled: true,
                autoRefreshInterval: 10000, // 10秒
                maxDisplayItems: 100
            },
            
            // 导出配置
            exportConfig: {
                defaultFormat: 'json',
                includeSensitiveData: false,
                compressionLevel: 6,
                timestampFormat: 'ISO',
                supportedFormats: ['json', 'csv', 'txt']
            },
            
            // 元数据
            metadata: {
                createdAt: new Date().toISOString(),
                lastSaved: new Date().toISOString(),
                fileVersion: '1.0.0',
                totalRecords: 0,
                dataIntegrity: 'new-file'
            }
        };
    }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConversationEvolutionStorageManager;
} else if (typeof window !== 'undefined') {
    window.ConversationEvolutionStorageManager = ConversationEvolutionStorageManager;
} 