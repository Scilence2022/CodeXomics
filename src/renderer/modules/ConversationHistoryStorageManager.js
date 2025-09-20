/**
 * ConversationHistoryStorageManager - 独立的对话历史存储管理器
 * 专门处理大容量对话历史数据的存储，与系统配置分离
 */
class ConversationHistoryStorageManager {
    constructor(configManager) {
        this.configManager = configManager;
        this.isElectron = this.detectElectron();
        
        // 存储配置
        this.storageConfig = {
            maxFileSize: 500 * 1024 * 1024, // 500MB per file
            maxTotalSize: 2 * 1024 * 1024 * 1024, // 2GB total
            compressionEnabled: true,
            autoArchive: true,
            archiveThreshold: 100 * 1024 * 1024, // 100MB
            maxConversationsPerFile: 1000,
            backupEnabled: true,
            maxBackupFiles: 5
        };
        
        // 文件路径配置
        this.storageDir = this.getStorageDirectory();
        this.currentFile = 'conversations-current.json';
        this.archivePrefix = 'conversations-archive-';
        this.backupPrefix = 'conversations-backup-';
        
        // 内存缓存
        this.conversationCache = new Map();
        this.maxCacheSize = 100; // 缓存最近100个对话
        
        // 防抖保存
        this.saveTimeout = null;
        this.saveDelay = 2000; // 2秒延迟
        
        console.log('ConversationHistoryStorageManager initialized');
        this.initializeStorage();
    }
    
    /**
     * 检测Electron环境
     */
    detectElectron() {
        try {
            return typeof window !== 'undefined' && 
                   window.process && 
                   window.process.type === 'renderer';
        } catch (e) {
            return false;
        }
    }
    
    /**
     * 获取存储目录
     */
    getStorageDirectory() {
        if (this.isElectron) {
            const { ipcRenderer } = require('electron');
            try {
                const userDataPath = ipcRenderer.sendSync('get-user-data-path');
                return require('path').join(userDataPath, 'conversation-history');
            } catch (error) {
                console.warn('Failed to get user data path, using fallback');
            }
        }
        
        // 浏览器环境或fallback
        return 'conversation-history';
    }
    
    /**
     * 初始化存储系统
     */
    async initializeStorage() {
        try {
            // 确保存储目录存在
            await this.ensureStorageDirectory();
            
            // 加载当前对话文件
            await this.loadCurrentConversations();
            
            // 检查是否需要归档
            await this.checkAndArchiveIfNeeded();
            
            console.log('✅ Conversation history storage initialized');
            
        } catch (error) {
            console.error('❌ Failed to initialize conversation history storage:', error);
        }
    }
    
    /**
     * 确保存储目录存在
     */
    async ensureStorageDirectory() {
        if (this.isElectron) {
            const fs = require('fs').promises;
            const path = require('path');
            
            try {
                await fs.mkdir(this.storageDir, { recursive: true });
            } catch (error) {
                if (error.code !== 'EEXIST') {
                    throw error;
                }
            }
        }
    }
    
    /**
     * 加载当前对话数据
     */
    async loadCurrentConversations() {
        try {
            const filePath = this.getFilePath(this.currentFile);
            let data = await this.readFile(filePath);
            
            if (data) {
                // 首先尝试解析，检查是否需要解压
                let parsed;
                try {
                    parsed = JSON.parse(data);
                } catch (parseError) {
                    // 如果解析失败，可能是压缩数据
                    console.log('🗜️ Attempting to decompress data...');
                    data = await this.decompressData(data);
                    parsed = JSON.parse(data);
                }
                
                // 如果metadata标记为压缩但我们没有解压，则解压
                if (parsed.metadata && parsed.metadata.compressed && typeof data === 'string' && !data.includes('"conversations"')) {
                    console.log('🗜️ Decompressing stored data...');
                    data = await this.decompressData(data);
                    parsed = JSON.parse(data);
                }
                
                this.currentConversations = parsed.conversations || [];
                this.metadata = parsed.metadata || this.getDefaultMetadata();
                
                console.log(`📂 Loaded ${this.currentConversations.length} conversations from storage${this.metadata.compressed ? ' [Decompressed]' : ''}`);
            } else {
                this.currentConversations = [];
                this.metadata = this.getDefaultMetadata();
                console.log('📂 No existing conversations found, starting fresh');
            }
            
        } catch (error) {
            console.warn('Failed to load conversations, starting fresh:', error);
            this.currentConversations = [];
            this.metadata = this.getDefaultMetadata();
        }
    }
    
    /**
     * 获取默认元数据
     */
    getDefaultMetadata() {
        return {
            version: '1.0.0',
            created: new Date().toISOString(),
            lastModified: new Date().toISOString(),
            totalConversations: 0,
            totalMessages: 0,
            fileSize: 0,
            compressionEnabled: this.storageConfig.compressionEnabled
        };
    }
    
    /**
     * 添加对话记录
     */
    async addConversation(conversationData) {
        try {
            // 验证数据
            if (!conversationData || !conversationData.id) {
                throw new Error('Invalid conversation data');
            }
            
            // 添加到当前对话列表
            this.currentConversations.push({
                ...conversationData,
                addedAt: new Date().toISOString(),
                fileIndex: this.currentConversations.length
            });
            
            // 更新元数据
            this.updateMetadata(conversationData);
            
            // 添加到缓存
            this.conversationCache.set(conversationData.id, conversationData);
            this.maintainCacheSize();
            
            // 防抖保存
            this.debouncedSave();
            
            console.log(`➕ Added conversation ${conversationData.id}, total: ${this.currentConversations.length}`);
            
        } catch (error) {
            console.error('❌ Failed to add conversation:', error);
            throw error;
        }
    }
    
    /**
     * 更新元数据
     */
    updateMetadata(conversationData) {
        this.metadata.lastModified = new Date().toISOString();
        this.metadata.totalConversations = this.currentConversations.length;
        
        // 计算消息数量
        if (conversationData.events && Array.isArray(conversationData.events)) {
            this.metadata.totalMessages += conversationData.events.length;
        }
    }
    
    /**
     * 防抖保存
     */
    debouncedSave() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        
        this.saveTimeout = setTimeout(async () => {
            try {
                await this.saveCurrentConversations();
            } catch (error) {
                console.error('❌ Failed to save conversations:', error);
            }
        }, this.saveDelay);
    }
    
    /**
     * 保存当前对话数据
     */
    async saveCurrentConversations() {
        try {
            const data = {
                metadata: this.metadata,
                conversations: this.currentConversations,
                savedAt: new Date().toISOString()
            };
            
            let dataToSave = JSON.stringify(data, null, 2);
            const filePath = this.getFilePath(this.currentFile);
            
            // 如果启用压缩且数据超过阈值，进行压缩
            if (this.storageConfig.compressionEnabled && dataToSave.length > 1024 * 1024) { // 1MB threshold
                try {
                    dataToSave = await this.compressData(dataToSave);
                    this.metadata.compressed = true;
                    console.log(`🗜️ Data compressed: ${(dataToSave.length / 1024 / 1024).toFixed(2)} MB`);
                } catch (compressionError) {
                    console.warn('Compression failed, saving uncompressed:', compressionError);
                    this.metadata.compressed = false;
                }
            } else {
                this.metadata.compressed = false;
            }
            
            // 更新文件大小
            this.metadata.fileSize = new Blob([dataToSave]).size;
            
            await this.writeFile(filePath, dataToSave);
            
            console.log(`💾 Saved ${this.currentConversations.length} conversations (${(this.metadata.fileSize / 1024 / 1024).toFixed(2)} MB)${this.metadata.compressed ? ' [Compressed]' : ''}`);
            
            // 检查是否需要归档
            await this.checkAndArchiveIfNeeded();
            
        } catch (error) {
            console.error('❌ Failed to save conversations:', error);
            throw error;
        }
    }

    /**
     * 压缩数据
     */
    async compressData(data) {
        if (this.isElectron) {
            // Electron环境使用zlib
            const zlib = require('zlib');
            const util = require('util');
            const gzip = util.promisify(zlib.gzip);
            
            const compressed = await gzip(Buffer.from(data, 'utf8'));
            return compressed.toString('base64');
        } else {
            // 浏览器环境使用简单的字符串压缩
            return this.simpleCompress(data);
        }
    }

    /**
     * 解压数据
     */
    async decompressData(compressedData) {
        if (this.isElectron) {
            // Electron环境使用zlib
            const zlib = require('zlib');
            const util = require('util');
            const gunzip = util.promisify(zlib.gunzip);
            
            const buffer = Buffer.from(compressedData, 'base64');
            const decompressed = await gunzip(buffer);
            return decompressed.toString('utf8');
        } else {
            // 浏览器环境使用简单的字符串解压
            return this.simpleDecompress(compressedData);
        }
    }

    /**
     * 简单压缩（浏览器环境）
     */
    simpleCompress(data) {
        // 使用简单的重复字符压缩
        return data.replace(/(.)\1{2,}/g, (match, char) => {
            return `${char}${match.length}`;
        });
    }

    /**
     * 简单解压（浏览器环境）
     */
    simpleDecompress(data) {
        // 恢复重复字符
        return data.replace(/(.)\d+/g, (match, char) => {
            const count = parseInt(match.slice(1));
            return char.repeat(count);
        });
    }
    
    /**
     * 检查并归档大文件
     */
    async checkAndArchiveIfNeeded() {
        try {
            if (this.metadata.fileSize > this.storageConfig.archiveThreshold ||
                this.currentConversations.length > this.storageConfig.maxConversationsPerFile) {
                
                console.log(`📦 Archiving conversations (${(this.metadata.fileSize / 1024 / 1024).toFixed(2)} MB, ${this.currentConversations.length} conversations)`);
                await this.archiveCurrentConversations();
            }
            
        } catch (error) {
            console.error('❌ Failed to check archive:', error);
        }
    }
    
    /**
     * 归档当前对话
     */
    async archiveCurrentConversations() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const archiveFileName = `${this.archivePrefix}${timestamp}.json`;
            
            // 准备归档数据
            const archiveData = {
                metadata: {
                    ...this.metadata,
                    archived: true,
                    archivedAt: new Date().toISOString(),
                    originalFile: this.currentFile
                },
                conversations: this.currentConversations,
                archiveInfo: {
                    reason: this.metadata.fileSize > this.storageConfig.archiveThreshold ? 'size' : 'count',
                    originalSize: this.metadata.fileSize,
                    originalCount: this.currentConversations.length
                }
            };
            
            // 保存归档文件
            const archivePath = this.getFilePath(archiveFileName);
            await this.writeFile(archivePath, JSON.stringify(archiveData, null, 2));
            
            // 创建备份
            if (this.storageConfig.backupEnabled) {
                await this.createBackup(archiveFileName);
            }
            
            // 重置当前对话
            this.currentConversations = [];
            this.metadata = this.getDefaultMetadata();
            
            // 保存新的空文件
            await this.saveCurrentConversations();
            
            console.log(`✅ Archived conversations to ${archiveFileName}`);
            
        } catch (error) {
            console.error('❌ Failed to archive conversations:', error);
            throw error;
        }
    }
    
    /**
     * 创建备份
     */
    async createBackup(fileName) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFileName = `${this.backupPrefix}${timestamp}.json`;
            
            const sourcePath = this.getFilePath(fileName);
            const backupPath = this.getFilePath(backupFileName);
            
            const data = await this.readFile(sourcePath);
            await this.writeFile(backupPath, data);
            
            // 清理旧备份
            await this.cleanupOldBackups();
            
            console.log(`🔄 Created backup: ${backupFileName}`);
            
        } catch (error) {
            console.error('❌ Failed to create backup:', error);
        }
    }
    
    /**
     * 清理旧备份
     */
    async cleanupOldBackups() {
        if (!this.isElectron) return;
        
        try {
            const fs = require('fs').promises;
            const path = require('path');
            
            const files = await fs.readdir(this.storageDir);
            const backupFiles = files
                .filter(file => file.startsWith(this.backupPrefix))
                .map(file => ({
                    name: file,
                    path: path.join(this.storageDir, file),
                    stat: null
                }));
            
            // 获取文件统计信息
            for (const file of backupFiles) {
                try {
                    file.stat = await fs.stat(file.path);
                } catch (error) {
                    console.warn(`Failed to stat backup file ${file.name}:`, error);
                }
            }
            
            // 按修改时间排序，保留最新的几个
            const validBackups = backupFiles
                .filter(file => file.stat)
                .sort((a, b) => b.stat.mtime - a.stat.mtime);
            
            const toDelete = validBackups.slice(this.storageConfig.maxBackupFiles);
            
            for (const file of toDelete) {
                try {
                    await fs.unlink(file.path);
                    console.log(`🗑️ Deleted old backup: ${file.name}`);
                } catch (error) {
                    console.warn(`Failed to delete backup ${file.name}:`, error);
                }
            }
            
        } catch (error) {
            console.error('❌ Failed to cleanup old backups:', error);
        }
    }
    
    /**
     * 获取对话记录
     */
    async getConversation(conversationId) {
        // 先检查缓存
        if (this.conversationCache.has(conversationId)) {
            return this.conversationCache.get(conversationId);
        }
        
        // 在当前对话中查找
        const conversation = this.currentConversations.find(conv => conv.id === conversationId);
        if (conversation) {
            this.conversationCache.set(conversationId, conversation);
            return conversation;
        }
        
        // 在归档文件中查找
        return await this.searchInArchives(conversationId);
    }
    
    /**
     * 在归档文件中搜索
     */
    async searchInArchives(conversationId) {
        if (!this.isElectron) return null;
        
        try {
            const fs = require('fs').promises;
            const path = require('path');
            
            const files = await fs.readdir(this.storageDir);
            const archiveFiles = files.filter(file => file.startsWith(this.archivePrefix));
            
            for (const fileName of archiveFiles) {
                try {
                    const filePath = path.join(this.storageDir, fileName);
                    const data = await fs.readFile(filePath, 'utf8');
                    const parsed = JSON.parse(data);
                    
                    if (parsed.conversations && Array.isArray(parsed.conversations)) {
                        const conversation = parsed.conversations.find(conv => conv.id === conversationId);
                        if (conversation) {
                            this.conversationCache.set(conversationId, conversation);
                            return conversation;
                        }
                    }
                } catch (error) {
                    console.warn(`Failed to search in archive ${fileName}:`, error);
                }
            }
            
        } catch (error) {
            console.error('❌ Failed to search archives:', error);
        }
        
        return null;
    }
    
    /**
     * 获取存储统计信息
     */
    async getStorageStats() {
        const stats = {
            currentFile: {
                conversations: this.currentConversations.length,
                size: this.metadata.fileSize,
                sizeFormatted: `${(this.metadata.fileSize / 1024 / 1024).toFixed(2)} MB`
            },
            archives: {
                count: 0,
                totalSize: 0,
                files: []
            },
            backups: {
                count: 0,
                totalSize: 0,
                files: []
            },
            cache: {
                size: this.conversationCache.size,
                maxSize: this.maxCacheSize
            }
        };
        
        if (this.isElectron) {
            try {
                const fs = require('fs').promises;
                const path = require('path');
                
                const files = await fs.readdir(this.storageDir);
                
                for (const fileName of files) {
                    const filePath = path.join(this.storageDir, fileName);
                    const stat = await fs.stat(filePath);
                    
                    if (fileName.startsWith(this.archivePrefix)) {
                        stats.archives.count++;
                        stats.archives.totalSize += stat.size;
                        stats.archives.files.push({
                            name: fileName,
                            size: stat.size,
                            modified: stat.mtime
                        });
                    } else if (fileName.startsWith(this.backupPrefix)) {
                        stats.backups.count++;
                        stats.backups.totalSize += stat.size;
                        stats.backups.files.push({
                            name: fileName,
                            size: stat.size,
                            modified: stat.mtime
                        });
                    }
                }
                
                stats.archives.totalSizeFormatted = `${(stats.archives.totalSize / 1024 / 1024).toFixed(2)} MB`;
                stats.backups.totalSizeFormatted = `${(stats.backups.totalSize / 1024 / 1024).toFixed(2)} MB`;
                
            } catch (error) {
                console.error('Failed to get storage stats:', error);
            }
        }
        
        return stats;
    }
    
    /**
     * 维护缓存大小
     */
    maintainCacheSize() {
        if (this.conversationCache.size > this.maxCacheSize) {
            const entries = Array.from(this.conversationCache.entries());
            const toDelete = entries.slice(0, entries.length - this.maxCacheSize);
            
            for (const [key] of toDelete) {
                this.conversationCache.delete(key);
            }
        }
    }
    
    /**
     * 获取文件路径
     */
    getFilePath(fileName) {
        if (this.isElectron) {
            const path = require('path');
            return path.join(this.storageDir, fileName);
        }
        return fileName;
    }
    
    /**
     * 读取文件
     */
    async readFile(filePath) {
        if (this.isElectron) {
            const fs = require('fs').promises;
            try {
                return await fs.readFile(filePath, 'utf8');
            } catch (error) {
                if (error.code === 'ENOENT') {
                    return null;
                }
                throw error;
            }
        } else {
            // 浏览器环境使用localStorage
            return localStorage.getItem(filePath);
        }
    }
    
    /**
     * 写入文件
     */
    async writeFile(filePath, data) {
        if (this.isElectron) {
            const fs = require('fs').promises;
            await fs.writeFile(filePath, data, 'utf8');
        } else {
            // 浏览器环境使用localStorage
            localStorage.setItem(filePath, data);
        }
    }
    
    /**
     * 清理所有数据（谨慎使用）
     */
    async clearAllData() {
        try {
            this.currentConversations = [];
            this.metadata = this.getDefaultMetadata();
            this.conversationCache.clear();
            
            await this.saveCurrentConversations();
            
            console.log('🗑️ All conversation history cleared');
            
        } catch (error) {
            console.error('❌ Failed to clear data:', error);
            throw error;
        }
    }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConversationHistoryStorageManager;
} else if (typeof window !== 'undefined') {
    window.ConversationHistoryStorageManager = ConversationHistoryStorageManager;
}
