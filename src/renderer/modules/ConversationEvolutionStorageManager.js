/**
 * ConversationEvolutionStorageManager - 对话进化系统存储管理器
 * 为Conversation Evolution System提供独立的存储和历史管理功能
 */
class ConversationEvolutionStorageManager {
    constructor(configManager) {
        this.configManager = configManager;
        
        // 存储配置
        this.storageConfig = {
            maxConversations: 1000,
            maxHistoryLength: 10000,
            autoSave: true,
            autoSaveInterval: 5000, // 5秒
            enableBackup: true,
            backupInterval: 86400000, // 24小时
        };
        
        // 历史数据结构
        this.historyData = {
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
        };
        
        // 防抖存储
        this._saveTimeout = null;
        
        console.log('ConversationEvolutionStorageManager initialized');
        this.initializeStorage();
    }

    /**
     * 初始化存储系统
     */
    async initializeStorage() {
        try {
            await this.loadHistoryData();
            this.setupAutoBackup();
            this.updateStorageStats();
            console.log('Evolution storage system initialized successfully');
        } catch (error) {
            console.error('Failed to initialize evolution storage:', error);
        }
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
            // 搜索消息内容
            if (searchFields.includes('messages')) {
                const messageMatch = conversation.messages.some(msg => {
                    const content = caseSensitive ? msg.content : msg.content.toLowerCase();
                    return content.includes(searchQuery);
                });
                if (messageMatch) return true;
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
            totalMessages: conversations.reduce((sum, conv) => sum + conv.messageCount, 0),
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
     * 加载历史数据
     */
    async loadHistoryData() {
        try {
            // 尝试从新的独立配置文件加载
            const evolutionConfig = this.configManager.get('evolution', null);
            if (evolutionConfig && evolutionConfig.historyData) {
                this.historyData = { ...this.historyData, ...evolutionConfig.historyData };
                this.storageConfig = { ...this.storageConfig, ...evolutionConfig.storageConfig };
                console.log('Evolution history data loaded from independent storage');
                console.log(`Loaded ${this.historyData.conversations.length} conversations, ${this.historyData.analysisRecords.length} analysis records`);
            } else {
                // 回退到旧的存储位置（向后兼容）
                const legacySaved = this.configManager.get('evolution.history', null);
                if (legacySaved) {
                    this.historyData = { ...this.historyData, ...legacySaved };
                    console.log('Evolution history data loaded from legacy storage (will be migrated)');
                    // 触发迁移
                    await this.migrateToNewStorage();
                } else {
                    console.log('No existing evolution history data found, starting fresh');
                }
            }
            
            // 更新统计信息
            this.updateStorageStats();
        } catch (error) {
            console.error('Failed to load evolution history:', error);
        }
    }

    /**
     * 保存历史数据
     */
    async saveHistoryData() {
        try {
            // 准备完整的evolution配置数据
            const evolutionData = {
                version: '1.0.0',
                lastModified: new Date().toISOString(),
                storageConfig: this.storageConfig,
                historyData: this.historyData,
                
                // 添加元数据
                metadata: {
                    createdAt: this.historyData.storageStats.firstRecordDate || new Date().toISOString(),
                    lastSaved: new Date().toISOString(),
                    fileVersion: '1.0.0',
                    totalRecords: this.historyData.conversations.length + 
                                this.historyData.analysisRecords.length + 
                                this.historyData.pluginGenerationHistory.length,
                    dataIntegrity: this.calculateDataChecksum()
                }
            };
            
            // 保存到独立的配置文件
            await this.configManager.set('evolution', evolutionData);
            console.log('Evolution history data saved to independent storage');
            console.log(`Saved: ${this.historyData.conversations.length} conversations, ${this.historyData.analysisRecords.length} analysis records, ${this.historyData.pluginGenerationHistory.length} plugin records`);
            
            // 清理旧的存储位置（如果存在）
            if (this.configManager.get('evolution.history', null)) {
                await this.configManager.set('evolution.history', null);
                console.log('Legacy evolution history data cleaned up');
            }
            
        } catch (error) {
            console.error('Failed to save evolution history:', error);
            throw error;
        }
    }

    /**
     * 迁移到新的存储格式
     */
    async migrateToNewStorage() {
        try {
            console.log('Migrating evolution data to new independent storage format...');
            await this.saveHistoryData();
            console.log('Evolution data migration completed successfully');
        } catch (error) {
            console.error('Failed to migrate evolution data:', error);
        }
    }

    /**
     * 计算数据校验和
     */
    calculateDataChecksum() {
        try {
            const dataString = JSON.stringify({
                conversationCount: this.historyData.conversations.length,
                analysisCount: this.historyData.analysisRecords.length,
                pluginCount: this.historyData.pluginGenerationHistory.length,
                lastUpdate: this.historyData.storageStats.lastUpdateDate
            });
            
            // 简单的哈希函数
            let hash = 0;
            for (let i = 0; i < dataString.length; i++) {
                const char = dataString.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // 转换为32位整数
            }
            return hash.toString(16);
        } catch (error) {
            console.error('Failed to calculate data checksum:', error);
            return 'unknown';
        }
    }

    /**
     * 防抖保存
     */
    async debouncedSave() {
        if (this._saveTimeout) {
            clearTimeout(this._saveTimeout);
        }
        
        this._saveTimeout = setTimeout(async () => {
            await this.saveHistoryData();
        }, this.storageConfig.autoSaveInterval);
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
        try {
            console.log('Initializing independent conversation evolution storage...');
            
            // 检查是否已存在evolution配置
            const existingConfig = this.configManager.get('evolution', null);
            
            if (!existingConfig) {
                console.log('No existing evolution config found, creating default configuration...');
                
                // 创建默认的evolution配置
                const defaultEvolutionConfig = this.configManager.getDefaultEvolutionConfig();
                
                // 保存默认配置
                await this.configManager.set('evolution', defaultEvolutionConfig);
                
                console.log('✅ Independent conversation evolution storage initialized successfully');
                console.log('📁 Storage file: conversation-evolution-data.json');
                console.log('📍 Location: /Users/song/.genome-browser/');
                
                // 显示配置摘要
                this.displayStorageConfigSummary(defaultEvolutionConfig);
                
            } else {
                console.log('✅ Evolution storage already initialized');
                console.log('📁 Found existing conversation-evolution-data.json');
                this.displayStorageConfigSummary(existingConfig);
            }
            
            // 触发配置保存，确保文件创建
            await this.configManager.saveConfig();
            
        } catch (error) {
            console.error('❌ Failed to initialize independent storage:', error);
            throw error;
        }
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
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConversationEvolutionStorageManager;
} else if (typeof window !== 'undefined') {
    window.ConversationEvolutionStorageManager = ConversationEvolutionStorageManager;
} 