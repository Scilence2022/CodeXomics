/**
 * ConfigManager - Comprehensive configuration management for the Genome AI Studio
 * Handles LLM settings, UI preferences, chat history, and app configurations
 */
class ConfigManager {
    constructor() {
        // Detect Electron environment first
        this.isElectron = this.detectElectron();
        
        // Then get config path based on environment
        this.configPath = this.getConfigPath();
        this.config = this.getDefaultConfig();
        this.isInitialized = false;
        
        // Initialize asynchronously
        this.initializeConfig().then(() => {
            this.isInitialized = true;
            console.log('ConfigManager fully initialized');
        }).catch(error => {
            console.error('ConfigManager initialization failed:', error);
            this.isInitialized = true; // Mark as initialized even on error to prevent blocking
        });
    }

    /**
     * Detect if running in Electron environment
     */
    detectElectron() {
        try {
            console.log('=== Electron Detection Debug ===');
            console.log('window:', typeof window);
            console.log('window.process:', typeof window?.process);
            console.log('window.process.type:', window?.process?.type);
            console.log('navigator.userAgent:', navigator?.userAgent);
            console.log('window.require:', typeof window?.require);
            console.log('window.electronAPI:', typeof window?.electronAPI);
            console.log('__dirname:', typeof __dirname);
            
            // Multiple ways to detect Electron
            const checks = {
                electronProcess: (typeof window !== 'undefined' && 
                                window.process && 
                                window.process.type === 'renderer'),
                userAgent: (typeof navigator !== 'undefined' && 
                           navigator.userAgent && 
                           navigator.userAgent.toLowerCase().indexOf('electron') !== -1),
                requireFunction: (typeof window !== 'undefined' && 
                                 typeof window.require === 'function'),
                dirname: (typeof __dirname !== 'undefined')
            };
            
            console.log('Detection checks:', checks);
            
            const isElectron = checks.electronProcess || checks.userAgent || checks.requireFunction || checks.dirname;
            console.log('Final Electron detection result:', isElectron);
            console.log('===============================');
            
            return isElectron;
        } catch (error) {
            console.log('Electron detection error:', error);
            return false;
        }
    }

    /**
     * Get the appropriate config directory path based on platform
     */
    getConfigPath() {
        console.log('=== getConfigPath Debug Start ===');
        console.log('this.isElectron:', this.isElectron);
        
        if (this.isElectron) {
            try {
                console.log('Attempting to get config paths in Electron environment...');
                
                // Try modern Electron API first
                console.log('Checking window.electronAPI...');
                const electronAPI_path = window.electronAPI?.path;
                const electronAPI_os = window.electronAPI?.os;
                console.log('electronAPI path:', typeof electronAPI_path, electronAPI_path);
                console.log('electronAPI os:', typeof electronAPI_os, electronAPI_os);
                
                if (electronAPI_path && electronAPI_os) {
                    console.log('Using electronAPI for paths');
                    const configDir = electronAPI_path.join(electronAPI_os.homedir(), '.genome-browser');
                    const paths = {
                        dir: configDir,
                        main: electronAPI_path.join(configDir, 'config.json'),
                        llm: electronAPI_path.join(configDir, 'llm-config.json'),
                        ui: electronAPI_path.join(configDir, 'ui-preferences.json'),
                        chat: electronAPI_path.join(configDir, 'chat-history.json'),
                        app: electronAPI_path.join(configDir, 'app-settings.json'),
                        evolution: electronAPI_path.join(configDir, 'conversation-evolution-data.json'),
                        blast: electronAPI_path.join(configDir, 'blast-databases.json')
                    };
                    console.log('electronAPI config paths:', paths);
                    console.log('=== getConfigPath Debug End (electronAPI success) ===');
                    return paths;
                }
                
                // Fallback to Node.js require if available
                console.log('electronAPI not available, trying window.require...');
                console.log('window.require type:', typeof window.require);
                
                if (typeof window !== 'undefined' && typeof window.require === 'function') {
                    console.log('window.require is available, attempting to load path and os modules...');
                    
                    try {
                        const path = window.require('path');
                        const os = window.require('os');
                        console.log('path module loaded:', typeof path, !!path);
                        console.log('os module loaded:', typeof os, !!os);
                        
                        if (path && os) {
                            console.log('Both modules loaded successfully');
                            const homeDir = os.homedir();
                            console.log('Home directory:', homeDir);
                            
                            const configDir = path.join(homeDir, '.genome-browser');
                            console.log('Config directory:', configDir);
                            
                            const paths = {
                                dir: configDir,
                                main: path.join(configDir, 'config.json'),
                                llm: path.join(configDir, 'llm-config.json'),
                                ui: path.join(configDir, 'ui-preferences.json'),
                                chat: path.join(configDir, 'chat-history.json'),
                                app: path.join(configDir, 'app-settings.json'),
                                evolution: path.join(configDir, 'conversation-evolution-data.json'),
                                blast: path.join(configDir, 'blast-databases.json')
                            };
                            
                            console.log('Final config paths using require:');
                            Object.entries(paths).forEach(([key, value]) => {
                                console.log(`  ${key}: ${value}`);
                            });
                            
                            console.log('=== getConfigPath Debug End (require success) ===');
                            return paths;
                        } else {
                            console.log('Failed to load path or os modules');
                        }
                    } catch (requireError) {
                        console.error('Error requiring modules:', requireError);
                    }
                } else {
                    console.log('window.require not available');
                }
                
                console.log('Electron detected but no file system APIs available');
            } catch (error) {
                console.error('Failed to access Electron APIs:', error);
            }
        } else {
            console.log('Not in Electron environment');
        }
        
        // Fallback to localStorage for non-Electron environments or API failure
        console.log('Using localStorage fallback for configuration storage');
        console.log('=== getConfigPath Debug End (localStorage fallback) ===');
        return null;
    }

    /**
     * Get default configuration structure
     */
    getDefaultConfig() {
        return {
            version: '1.0.0',
            llm: {
                providers: {
                    openai: {
                        name: 'OpenAI',
                        apiKey: '',
                        model: 'gpt-4o',
                        baseUrl: 'https://api.openai.com/v1',
                        enabled: false,
                        maxTokens: 4096,
                        temperature: 0.7
                    },
                    anthropic: {
                        name: 'Anthropic',
                        apiKey: '',
                        model: 'claude-3-5-sonnet-20241022',
                        baseUrl: 'https://api.anthropic.com',
                        enabled: false,
                        maxTokens: 4096,
                        temperature: 0.7
                    },
                    google: {
                        name: 'Google',
                        apiKey: '',
                        model: 'gemini-2.0-flash',
                        baseUrl: 'https://generativelanguage.googleapis.com',
                        enabled: false,
                        maxTokens: 4096,
                        temperature: 0.7
                    },
                    deepseek: {
                        name: 'DeepSeek',
                        apiKey: '',
                        model: 'deepseek-chat',
                        baseUrl: 'https://api.deepseek.com/v1',
                        enabled: false,
                        maxTokens: 4096,
                        temperature: 0.7
                    },
                    siliconflow: {
                        name: 'SiliconFlow',
                        apiKey: '',
                        model: 'Qwen/Qwen2.5-72B-Instruct',
                        baseUrl: 'https://api.siliconflow.cn/v1',
                        enabled: false,
                        maxTokens: 4096,
                        temperature: 0.7
                    },
                    openrouter: {
                        name: 'OpenRouter',
                        apiKey: '',
                        model: 'openai/gpt-4o',
                        baseUrl: 'https://openrouter.ai/api/v1',
                        enabled: false,
                        maxTokens: 4096,
                        temperature: 0.7
                    },
                    local: {
                        name: 'Local LLM',
                        apiKey: '',
                        model: 'qwen3:8b',
                        baseUrl: 'http://localhost:11434/v1',
                        streamingSupport: true,
                        enabled: false,
                        maxTokens: 4096,
                        temperature: 0.7
                    },
                    custom: {
                        name: 'Custom Provider',
                        providerName: 'My Custom Provider',
                        apiKey: '',
                        model: '',
                        baseUrl: '',
                        apiFormat: 'openai',
                        customHeaders: {},
                        maxTokens: 4096,
                        temperature: 0.7,
                        streamingSupport: false,
                        enabled: false
                    }
                },
                currentProvider: null,
                systemPrompt: '',
                conversationMemory: 10, // Number of messages to remember
                autoSave: true,
                functionCallRounds: 3,  // Maximum number of function call rounds
                enableEarlyCompletion: true,  // Enable early task completion detection
                completionThreshold: 0.7  // Confidence threshold for task completion (0.0-1.0)
            },
            ui: {
                theme: 'default',
                fontSize: 14,
                fontFamily: 'Inter, sans-serif',
                sidebarVisible: true,
                sidebarWidth: 300,
                chatPanelVisible: false,
                chatPanelWidth: 350,
                trackHeights: {
                    genes: 200,
                    gcContent: 100,
                    customTracks: 150
                },
                colorScheme: {
                    primary: '#3b82f6',
                    secondary: '#64748b',
                    accent: '#10b981',
                    background: '#ffffff',
                    surface: '#f8fafc'
                },
                animations: true,
                autoSaveInterval: 30000, // 30 seconds
                confirmDeleteActions: true,
                // Tab-specific configurations
                tabSettings: {
                    persistTabStates: true,
                    maxStoredTabs: 50,
                    autoSaveTabStates: true,
                    saveInterval: 5000 // 5 seconds
                }
            },
            // Tab states storage - each tab has independent configuration
            tabs: {
                states: {},
                activeTabId: null,
                lastSessionTabs: [],
                restoreTabsOnStartup: true
            },
            chat: {
                history: [],
                maxHistoryLength: 1000,
                autoExport: false,
                exportFormat: 'json',
                showTimestamps: true,
                copyButtonsEnabled: true,
                typingIndicator: true
            },
            app: {
                recentFiles: [],
                maxRecentFiles: 10,
                defaultDirectory: '',
                autoBackup: true,
                backupInterval: 3600000, // 1 hour
                debugMode: false,
                telemetry: false,
                updateChannel: 'stable',
                language: 'en',
                shortcuts: {
                    search: 'Ctrl+F',
                    goto: 'Ctrl+G',
                    export: 'Ctrl+E',
                    chat: 'Ctrl+H',
                    help: 'F1'
                }
            },
            blast: {
                customDatabases: {},
                settings: {
                    version: '1.0',
                    autoValidate: true,
                    validateOnStartup: true,
                    maxDatabaseAge: 86400000, // 24 hours in milliseconds
                    backupEnabled: true,
                    compressionEnabled: false
                },
                metadata: {
                    lastUpdated: null,
                    totalDatabases: 0,
                    lastValidation: null,
                    migrationVersion: '1.0'
                }
            },
            evo2: {
                apiKey: '',
                apiUrl: 'https://integrate.api.nvidia.com',
                timeout: 60,
                maxRetries: 3,
                debugMode: false,
                lastSaved: null,
                analysisHistory: []
            }
        };
    }

    /**
     * Get default evolution configuration structure
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
            }
        };
    }

    /**
     * Initialize configuration system
     */
    async initializeConfig() {
        try {
            await this.loadConfig();
            this.setupAutoSave();
            
            // Clean up any oversized data from previous sessions
            this.cleanupOversizedData();
            
            console.log('Configuration system initialized');
        } catch (error) {
            console.error('Failed to initialize configuration:', error);
            // Use default config on failure
            this.config = this.getDefaultConfig();
        }
    }

    /**
     * Load configuration from file or localStorage
     */
    async loadConfig() {
        console.log('=== loadConfig Debug Start ===');
        console.log('this.configPath:', this.configPath);
        
        if (this.configPath) {
            console.log('Loading configuration from FILES');
            console.log('Config directory:', this.configPath.dir);
            console.log('Config files:');
            Object.entries(this.configPath).forEach(([key, path]) => {
                console.log(`  ${key}: ${path}`);
            });
            // File-based config for Electron
            await this.loadFromFiles();
        } else {
            console.log('Loading configuration from LOCALSTORAGE (fallback)');
            // localStorage fallback
            this.loadFromLocalStorage();
        }
        console.log('=== loadConfig Debug End ===');
    }

    /**
     * Load configuration from files (Electron)
     */
    async loadFromFiles() {
        console.log('=== loadFromFiles Debug Start ===');
        let fs, path;
        
        try {
            // Try to get file system APIs
            if (typeof window !== 'undefined' && typeof window.require === 'function') {
                console.log('Getting fs and path modules via window.require...');
                fs = window.require('fs').promises;
                path = window.require('path');
                console.log('fs module:', typeof fs);
                console.log('path module:', typeof path);
            } else {
                // This shouldn't happen if we're here, but just in case
                throw new Error('No file system APIs available');
            }

            // Ensure config directory exists
            console.log('Creating config directory:', this.configPath.dir);
            await fs.mkdir(this.configPath.dir, { recursive: true });
            console.log('Config directory created/verified');

            // Load main config
            console.log('Checking main config file:', this.configPath.main);
            if (await this.fileExists(this.configPath.main)) {
                console.log('Loading main config from:', this.configPath.main);
                const mainConfig = JSON.parse(await fs.readFile(this.configPath.main, 'utf8'));
                console.log('Main config loaded:', mainConfig);
                this.config = this.mergeConfig(this.config, mainConfig);
            } else {
                console.log('Main config file does not exist');
            }

            // Load specific config files
            const configFiles = {
                llm: this.configPath.llm,
                ui: this.configPath.ui,
                chat: this.configPath.chat,
                app: this.configPath.app,
                evolution: this.configPath.evolution,
                blast: this.configPath.blast
            };

            for (const [section, filePath] of Object.entries(configFiles)) {
                console.log(`Checking ${section} config file:`, filePath);
                if (await this.fileExists(filePath)) {
                    console.log(`Loading ${section} config from:`, filePath);
                    const sectionConfig = JSON.parse(await fs.readFile(filePath, 'utf8'));
                    console.log(`${section} config loaded:`, Object.keys(sectionConfig));
                    this.config[section] = this.mergeConfig(this.config[section], sectionConfig);
                } else {
                    console.log(`${section} config file does not exist`);
                }
            }

            console.log('Configuration loaded from files successfully');
            console.log('=== loadFromFiles Debug End ===');
        } catch (error) {
            console.error('Error loading configuration from files:', error);
            console.error('=== loadFromFiles Debug End (ERROR) ===');
            throw error;
        }
    }

    /**
     * Load configuration from localStorage (fallback)
     */
    loadFromLocalStorage() {
        try {
            console.log('Loading configuration from localStorage...');
            
            // Load LLM config (backward compatibility)
            const llmConfig = localStorage.getItem('llmConfiguration');
            if (llmConfig) {
                const parsed = JSON.parse(llmConfig);
                this.config.llm.providers = { ...this.config.llm.providers, ...parsed.providers };
                this.config.llm.currentProvider = parsed.currentProvider;
                console.log('LLM configuration loaded from localStorage:', {
                    currentProvider: this.config.llm.currentProvider,
                    providersCount: Object.keys(this.config.llm.providers).length
                });
            } else {
                console.log('No LLM configuration found in localStorage');
            }

            // Load UI preferences
            const uiConfig = localStorage.getItem('uiPreferences');
            if (uiConfig) {
                this.config.ui = { ...this.config.ui, ...JSON.parse(uiConfig) };
                console.log('UI preferences loaded from localStorage');
            }

            // Load chat history
            const chatHistory = localStorage.getItem('chatHistory');
            if (chatHistory) {
                this.config.chat.history = JSON.parse(chatHistory);
                console.log(`Chat history loaded from localStorage: ${this.config.chat.history.length} messages`);
            }

            // Load app settings
            const appSettings = localStorage.getItem('appSettings');
            if (appSettings) {
                this.config.app = { ...this.config.app, ...JSON.parse(appSettings) };
                console.log('App settings loaded from localStorage');
            }

            // Load BLAST databases (migration from localStorage)
            const blastDatabases = localStorage.getItem('blast_custom_databases');
            if (blastDatabases) {
                try {
                    const savedData = JSON.parse(blastDatabases);
                    let databases;
                    
                    if (Array.isArray(savedData)) {
                        // Old format - direct array
                        databases = savedData;
                        console.log('Loading BLAST databases from old localStorage format');
                    } else if (savedData.databases) {
                        // New format - with metadata
                        databases = savedData.databases;
                        console.log('Loading BLAST databases from new localStorage format');
                    }
                    
                    if (databases) {
                        // Convert array format to object format for ConfigManager
                        const databasesObject = {};
                        databases.forEach(([id, data]) => {
                            databasesObject[id] = data;
                        });
                        
                        this.config.blast.customDatabases = databasesObject;
                        this.config.blast.metadata.lastUpdated = new Date().toISOString();
                        this.config.blast.metadata.totalDatabases = databases.length;
                        console.log(`Migrated ${databases.length} BLAST databases from localStorage`);
                    }
                } catch (error) {
                    console.error('Error migrating BLAST databases from localStorage:', error);
                }
            }

            console.log('Configuration loaded from localStorage successfully');
        } catch (error) {
            console.error('Error loading configuration from localStorage:', error);
        }
    }

    /**
     * Save configuration
     */
    async saveConfig() {
        console.log('=== saveConfig Debug Start ===');
        console.log('this.configPath:', this.configPath);
        
        try {
            await this.waitForInitialization();
            
            if (this.configPath) {
                console.log('Saving configuration to FILES');
                console.log('Target directory:', this.configPath.dir);
                console.log('Target files:');
                Object.entries(this.configPath).forEach(([key, path]) => {
                    console.log(`  ${key}: ${path}`);
                });
                await this.saveToFiles();
                console.log('Configuration saved to files');
            } else {
                console.log('Saving configuration to LOCALSTORAGE (fallback)');
                this.saveToLocalStorage();
                console.log('Configuration saved to localStorage');
            }
            console.log('Configuration saved successfully');
            console.log('=== saveConfig Debug End ===');
        } catch (error) {
            console.error('Error saving configuration:', error);
            console.error('=== saveConfig Debug End (ERROR) ===');
            
            // Try fallback to localStorage if file saving fails
            try {
                console.warn('Attempting fallback save to localStorage...');
                this.saveToLocalStorage();
                console.log('Fallback save to localStorage successful');
            } catch (fallbackError) {
                console.error('Fallback save also failed:', fallbackError);
                // Don't throw error to prevent app crashes
                console.warn('Configuration save failed completely, but continuing execution');
            }
        }
    }

    /**
     * Validate and clean data before saving to prevent JSON.stringify errors
     */
    validateAndCleanData(data, maxSize = 10 * 1024 * 1024) { // 10MB default limit
        try {
            // Create a deep copy to avoid modifying original data
            const cleanData = JSON.parse(JSON.stringify(data));
            
            // Check if data has historyData that might be too large
            if (cleanData.historyData) {
                console.log('Validating historyData size...');
                
                // Truncate large arrays in historyData
                const maxArrayLength = 1000; // Limit arrays to 1000 items
                
                if (cleanData.historyData.conversations && Array.isArray(cleanData.historyData.conversations)) {
                    if (cleanData.historyData.conversations.length > maxArrayLength) {
                        console.warn(`Truncating conversations array from ${cleanData.historyData.conversations.length} to ${maxArrayLength} items`);
                        cleanData.historyData.conversations = cleanData.historyData.conversations.slice(-maxArrayLength);
                    }
                }
                
                if (cleanData.historyData.analysisRecords && Array.isArray(cleanData.historyData.analysisRecords)) {
                    if (cleanData.historyData.analysisRecords.length > maxArrayLength) {
                        console.warn(`Truncating analysisRecords array from ${cleanData.historyData.analysisRecords.length} to ${maxArrayLength} items`);
                        cleanData.historyData.analysisRecords = cleanData.historyData.analysisRecords.slice(-maxArrayLength);
                    }
                }
                
                if (cleanData.historyData.pluginGenerationHistory && Array.isArray(cleanData.historyData.pluginGenerationHistory)) {
                    if (cleanData.historyData.pluginGenerationHistory.length > maxArrayLength) {
                        console.warn(`Truncating pluginGenerationHistory array from ${cleanData.historyData.pluginGenerationHistory.length} to ${maxArrayLength} items`);
                        cleanData.historyData.pluginGenerationHistory = cleanData.historyData.pluginGenerationHistory.slice(-maxArrayLength);
                    }
                }
                
                if (cleanData.historyData.evolutionTimeline && Array.isArray(cleanData.historyData.evolutionTimeline)) {
                    if (cleanData.historyData.evolutionTimeline.length > maxArrayLength) {
                        console.warn(`Truncating evolutionTimeline array from ${cleanData.historyData.evolutionTimeline.length} to ${maxArrayLength} items`);
                        cleanData.historyData.evolutionTimeline = cleanData.historyData.evolutionTimeline.slice(-maxArrayLength);
                    }
                }
            }
            
            // Check if chat history is too large
            if (cleanData.history && Array.isArray(cleanData.history)) {
                const maxChatHistory = cleanData.maxHistoryLength || 1000;
                if (cleanData.history.length > maxChatHistory) {
                    console.warn(`Truncating chat history from ${cleanData.history.length} to ${maxChatHistory} items`);
                    cleanData.history = cleanData.history.slice(-maxChatHistory);
                }
            }
            
            // Test if the cleaned data can be stringified
            const testString = JSON.stringify(cleanData);
            const dataSizeBytes = new Blob([testString]).size;
            
            console.log(`Data size after cleaning: ${(dataSizeBytes / 1024 / 1024).toFixed(2)} MB`);
            
            if (dataSizeBytes > maxSize) {
                console.warn(`Data size ${(dataSizeBytes / 1024 / 1024).toFixed(2)} MB exceeds limit ${(maxSize / 1024 / 1024).toFixed(2)} MB`);
                throw new Error(`Data too large: ${(dataSizeBytes / 1024 / 1024).toFixed(2)} MB exceeds ${(maxSize / 1024 / 1024).toFixed(2)} MB limit`);
            }
            
            return cleanData;
        } catch (error) {
            console.error('Error validating/cleaning data:', error);
            
            // If cleaning fails, return a minimal safe version
            if (data.historyData) {
                console.warn('Returning minimal evolution config due to data size issues');
                return this.getDefaultEvolutionConfig();
            } else if (data.history) {
                console.warn('Returning minimal chat config due to data size issues');
                return {
                    ...data,
                    history: data.history ? data.history.slice(-100) : [] // Keep only last 100 messages
                };
            }
            
            return data; // Return original if we can't clean it
        }
    }

    /**
     * Safe JSON stringify with size validation
     */
    safeStringify(data, indent = 2) {
        try {
            const result = JSON.stringify(data, null, indent);
            const sizeBytes = new Blob([result]).size;
            const sizeMB = sizeBytes / 1024 / 1024;
            
            console.log(`JSON string size: ${sizeMB.toFixed(2)} MB`);
            
            // JavaScript string length limit is approximately 1GB, but we'll be more conservative
            if (sizeBytes > 100 * 1024 * 1024) { // 100MB limit
                throw new Error(`JSON string too large: ${sizeMB.toFixed(2)} MB`);
            }
            
            return result;
        } catch (error) {
            console.error('Error in safeStringify:', error);
            throw error;
        }
    }

    /**
     * Save configuration to files (Electron)
     */
    async saveToFiles() {
        console.log('=== saveToFiles Debug Start ===');
        let fs;
        
        try {
            // Try to get file system APIs
            if (typeof window !== 'undefined' && typeof window.require === 'function') {
                console.log('Getting fs module via window.require...');
                fs = window.require('fs').promises;
                console.log('fs module:', typeof fs);
            } else {
                throw new Error('No file system APIs available');
            }

            // Ensure config directory exists
            console.log('Creating config directory:', this.configPath.dir);
            await fs.mkdir(this.configPath.dir, { recursive: true });
            console.log('Config directory created/verified');

            // Save main config
            const mainConfigData = {
                version: this.config.version,
                lastModified: new Date().toISOString()
            };
            console.log('Saving main config to:', this.configPath.main);
            console.log('Main config data:', mainConfigData);
            await fs.writeFile(this.configPath.main, this.safeStringify(mainConfigData));
            console.log('Main config saved successfully');

            // Save specific config files with validation
            const configFiles = {
                [this.configPath.llm]: this.config.llm,
                [this.configPath.ui]: this.config.ui,
                [this.configPath.chat]: this.config.chat,
                [this.configPath.app]: this.config.app,
                [this.configPath.evolution]: this.config.evolution || this.getDefaultEvolutionConfig(),
                [this.configPath.blast]: this.config.blast
            };

            for (const [filePath, data] of Object.entries(configFiles)) {
                try {
                    console.log('Saving config to:', filePath);
                    console.log('Data keys:', Object.keys(data));
                    
                    // Validate and clean data before saving
                    const cleanData = this.validateAndCleanData(data);
                    const jsonString = this.safeStringify(cleanData);
                    
                    await fs.writeFile(filePath, jsonString);
                    console.log('Config file saved successfully:', filePath);
                } catch (fileError) {
                    console.error(`Error saving individual config file ${filePath}:`, fileError);
                    
                    // Try to save a minimal version for critical files
                    if (filePath.includes('evolution')) {
                        console.warn('Saving minimal evolution config due to error');
                        const minimalEvolution = this.getDefaultEvolutionConfig();
                        await fs.writeFile(filePath, this.safeStringify(minimalEvolution));
                    } else if (filePath.includes('chat')) {
                        console.warn('Saving minimal chat config due to error');
                        const minimalChat = {
                            ...data,
                            history: [] // Clear history if it's causing issues
                        };
                        await fs.writeFile(filePath, this.safeStringify(minimalChat));
                    } else {
                        // For other files, re-throw the error
                        throw fileError;
                    }
                }
            }
            
            console.log('All configuration files saved successfully');
            console.log('=== saveToFiles Debug End ===');
        } catch (error) {
            console.error('Error saving configuration to files:', error);
            console.error('=== saveToFiles Debug End (ERROR) ===');
            
            // Don't throw the error, just log it to prevent app crashes
            console.warn('Configuration save failed, but continuing execution to prevent app crash');
        }
    }

    /**
     * Save configuration to localStorage (fallback)
     */
    saveToLocalStorage() {
        try {
            // Save LLM config with validation
            const llmConfig = {
                providers: this.config.llm.providers,
                currentProvider: this.config.llm.currentProvider
            };
            localStorage.setItem('llmConfiguration', this.safeStringify(llmConfig));
            
            // Save UI preferences with validation
            localStorage.setItem('uiPreferences', this.safeStringify(this.config.ui));
            
            // Save chat history with size validation
            const cleanChatHistory = this.validateAndCleanData(this.config.chat).history;
            localStorage.setItem('chatHistory', this.safeStringify(cleanChatHistory));
            
            // Save app settings with validation
            localStorage.setItem('appSettings', this.safeStringify(this.config.app));
            
            console.log('Configuration saved to localStorage with size validation');
        } catch (error) {
            console.error('Error saving configuration to localStorage:', error);
            
            // Try to save minimal data if full save fails
            try {
                console.warn('Attempting to save minimal configuration to localStorage...');
                localStorage.setItem('llmConfiguration', JSON.stringify({
                    providers: this.config.llm.providers || {},
                    currentProvider: this.config.llm.currentProvider || 'openai'
                }));
                localStorage.setItem('uiPreferences', JSON.stringify(this.config.ui || {}));
                localStorage.setItem('chatHistory', JSON.stringify([])); // Clear chat history
                localStorage.setItem('appSettings', JSON.stringify(this.config.app || {}));
                console.log('Minimal configuration saved to localStorage');
            } catch (minimalError) {
                console.error('Even minimal localStorage save failed:', minimalError);
                throw error; // Re-throw original error
            }
        }
    }

    /**
     * Clean up oversized data proactively to prevent save errors
     */
    cleanupOversizedData() {
        console.log('🧹 Starting data cleanup to prevent save errors...');
        
        try {
            let cleaned = false;
            
            // Clean up chat history if too large
            if (this.config.chat && this.config.chat.history && Array.isArray(this.config.chat.history)) {
                const maxChatHistory = this.config.chat.maxHistoryLength || 1000;
                if (this.config.chat.history.length > maxChatHistory) {
                    const oldLength = this.config.chat.history.length;
                    this.config.chat.history = this.config.chat.history.slice(-maxChatHistory);
                    console.log(`🧹 Cleaned chat history: ${oldLength} → ${this.config.chat.history.length} messages`);
                    cleaned = true;
                }
            }
            
            // Clean up evolution data if it exists and is too large
            if (this.config.evolution && this.config.evolution.historyData) {
                const maxArrayLength = 1000;
                const historyData = this.config.evolution.historyData;
                
                ['conversations', 'analysisRecords', 'pluginGenerationHistory', 'evolutionTimeline'].forEach(arrayName => {
                    if (historyData[arrayName] && Array.isArray(historyData[arrayName])) {
                        if (historyData[arrayName].length > maxArrayLength) {
                            const oldLength = historyData[arrayName].length;
                            historyData[arrayName] = historyData[arrayName].slice(-maxArrayLength);
                            console.log(`🧹 Cleaned ${arrayName}: ${oldLength} → ${historyData[arrayName].length} items`);
                            cleaned = true;
                        }
                    }
                });
            }
            
            if (cleaned) {
                console.log('🧹 Data cleanup completed, attempting to save cleaned configuration...');
                // Don't await this to avoid recursive calls
                this.debouncedSave();
            } else {
                console.log('🧹 No cleanup needed - data sizes are within limits');
            }
            
            return cleaned;
        } catch (error) {
            console.error('🧹 Error during data cleanup:', error);
            return false;
        }
    }

    /**
     * Wait for configuration to be initialized
     */
    async waitForInitialization() {
        if (this.isInitialized) {
            return;
        }
        
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (this.isInitialized) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 10); // Check every 10ms
        });
    }

    /**
     * Get configuration value
     */
    get(path, defaultValue = null) {
        try {
            const keys = path.split('.');
            let value = this.config;
            
            for (const key of keys) {
                if (value && typeof value === 'object' && key in value) {
                    value = value[key];
                } else {
                    return defaultValue;
                }
            }
            
            return value;
        } catch (error) {
            console.error('Error getting config value:', error);
            return defaultValue;
        }
    }

    /**
     * Set configuration value
     */
    async set(path, value) {
        try {
            // Ensure initialization is complete
            await this.waitForInitialization();
            
            const keys = path.split('.');
            let obj = this.config;
            
            for (let i = 0; i < keys.length - 1; i++) {
                const key = keys[i];
                if (!(key in obj) || typeof obj[key] !== 'object') {
                    obj[key] = {};
                }
                obj = obj[key];
            }
            
            obj[keys[keys.length - 1]] = value;
            
            if (this.config.ui.autoSaveInterval > 0) {
                this.debouncedSave();
            }
        } catch (error) {
            console.error('Error setting config value:', error);
        }
    }

    /**
     * Add chat message to history
     */
    addChatMessage(message, sender, timestamp = null) {
        const chatMessage = {
            message,
            sender,
            timestamp: timestamp || new Date().toISOString(),
            id: Date.now() + Math.random().toString(36).substr(2, 9)
        };

        this.config.chat.history.push(chatMessage);

        // Limit history length
        if (this.config.chat.history.length > this.config.chat.maxHistoryLength) {
            this.config.chat.history = this.config.chat.history.slice(-this.config.chat.maxHistoryLength);
        }

        if (this.config.llm.autoSave) {
            this.debouncedSave();
        }

        return chatMessage.id;
    }

    /**
     * Get chat history
     */
    getChatHistory(limit = null) {
        const history = this.config.chat.history;
        return limit ? history.slice(-limit) : history;
    }

    /**
     * Clear chat history
     */
    clearChatHistory() {
        this.config.chat.history = [];
        console.log('Chat history cleared');
    }

    /**
     * Set chat history (replace existing history)
     */
    setChatHistory(history) {
        this.config.chat.history = history;
        console.log(`Chat history set: ${history.length} messages`);
    }

    /**
     * Add recent file
     */
    addRecentFile(filePath) {
        const recentFiles = this.config.app.recentFiles;
        
        // Remove if already exists
        const index = recentFiles.indexOf(filePath);
        if (index > -1) {
            recentFiles.splice(index, 1);
        }
        
        // Add to beginning
        recentFiles.unshift(filePath);
        
        // Limit length
        if (recentFiles.length > this.config.app.maxRecentFiles) {
            recentFiles.splice(this.config.app.maxRecentFiles);
        }
        
        this.debouncedSave();
    }

    /**
     * Export configuration
     */
    async exportConfig(filePath = null) {
        try {
            const exportData = {
                version: this.config.version,
                exported: new Date().toISOString(),
                config: this.config
            };

            if (filePath) {
                if (this.isElectron) {
                    const fs = require('fs').promises;
                    await fs.writeFile(filePath, JSON.stringify(exportData, null, 2));
                }
            } else {
                // Download as file in browser
                const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `genome-browser-config-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error('Error exporting configuration:', error);
            throw error;
        }
    }

    /**
     * Import configuration
     */
    async importConfig(data) {
        try {
            if (typeof data === 'string') {
                data = JSON.parse(data);
            }

            if (data.config) {
                this.config = this.mergeConfig(this.getDefaultConfig(), data.config);
                await this.saveConfig();
                console.log('Configuration imported successfully');
                return true;
            } else {
                throw new Error('Invalid configuration format');
            }
        } catch (error) {
            console.error('Error importing configuration:', error);
            throw error;
        }
    }

    /**
     * Reset configuration to defaults
     */
    async resetConfig(sections = null) {
        try {
            const defaultConfig = this.getDefaultConfig();
            
            if (sections) {
                // Reset specific sections
                for (const section of sections) {
                    if (section in defaultConfig) {
                        this.config[section] = defaultConfig[section];
                    }
                }
            } else {
                // Reset everything
                this.config = defaultConfig;
            }
            
            await this.saveConfig();
            console.log('Configuration reset to defaults');
        } catch (error) {
            console.error('Error resetting configuration:', error);
            throw error;
        }
    }

    /**
     * Setup auto-save functionality
     */
    setupAutoSave() {
        if (this.config.ui.autoSaveInterval > 0) {
            this.debouncedSave = this.debounce(() => {
                this.saveConfig();
            }, this.config.ui.autoSaveInterval);
        }
    }

    /**
     * Utility functions
     */
    async fileExists(path) {
        try {
            let fs;
            if (typeof window !== 'undefined' && typeof window.require === 'function') {
                fs = window.require('fs').promises;
            } else {
                return false;
            }
            await fs.access(path);
            return true;
        } catch {
            return false;
        }
    }

    mergeConfig(target, source) {
        const result = { ...target };
        
        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    result[key] = this.mergeConfig(result[key] || {}, source[key]);
                } else {
                    result[key] = source[key];
                }
            }
        }
        
        return result;
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Get configuration summary for debugging
     */
    getConfigSummary() {
        return {
            version: this.config.version,
            llmProvider: this.config.llm.currentProvider,
            llmProvidersEnabled: Object.keys(this.config.llm.providers).filter(p => this.config.llm.providers[p].enabled),
            theme: this.config.ui.theme,
            chatHistoryLength: this.config.chat.history.length,
            recentFilesCount: this.config.app.recentFiles.length,
            debugMode: this.config.app.debugMode
        };
    }

    /**
     * Debug method to check storage mechanism
     */
    getStorageInfo() {
        return {
            isElectron: this.isElectron,
            configPath: this.configPath,
            usingFiles: this.configPath !== null,
            usingLocalStorage: this.configPath === null,
            isInitialized: this.isInitialized
        };
    }

    // BLAST Database specific methods
    async getBlastDatabases() {
        await this.waitForInitialization();
        return this.config.blast.customDatabases || {};
    }

    async setBlastDatabase(id, databaseData) {
        await this.waitForInitialization();
        
        if (!this.config.blast.customDatabases) {
            this.config.blast.customDatabases = {};
        }
        
        // Add metadata
        databaseData.lastModified = new Date().toISOString();
        
        this.config.blast.customDatabases[id] = databaseData;
        this.config.blast.metadata.lastUpdated = new Date().toISOString();
        this.config.blast.metadata.totalDatabases = Object.keys(this.config.blast.customDatabases).length;
        
        await this.saveConfig();
        console.log(`BLAST database ${id} saved to config`);
    }

    async removeBlastDatabase(id) {
        await this.waitForInitialization();
        
        if (this.config.blast.customDatabases && this.config.blast.customDatabases[id]) {
            delete this.config.blast.customDatabases[id];
            this.config.blast.metadata.lastUpdated = new Date().toISOString();
            this.config.blast.metadata.totalDatabases = Object.keys(this.config.blast.customDatabases).length;
            
            await this.saveConfig();
            console.log(`BLAST database ${id} removed from config`);
            return true;
        }
        return false;
    }

    async updateBlastDatabase(id, updates) {
        await this.waitForInitialization();
        
        if (this.config.blast.customDatabases && this.config.blast.customDatabases[id]) {
            this.config.blast.customDatabases[id] = {
                ...this.config.blast.customDatabases[id],
                ...updates,
                lastModified: new Date().toISOString()
            };
            this.config.blast.metadata.lastUpdated = new Date().toISOString();
            
            await this.saveConfig();
            console.log(`BLAST database ${id} updated in config`);
            return true;
        }
        return false;
    }

    async clearBlastDatabases() {
        await this.waitForInitialization();
        
        this.config.blast.customDatabases = {};
        this.config.blast.metadata.lastUpdated = new Date().toISOString();
        this.config.blast.metadata.totalDatabases = 0;
        
        await this.saveConfig();
        console.log('All BLAST databases cleared from config');
    }

    async getBlastSettings() {
        await this.waitForInitialization();
        return this.config.blast.settings || {};
    }

    async setBlastSettings(settings) {
        await this.waitForInitialization();
        
        this.config.blast.settings = {
            ...this.config.blast.settings,
            ...settings
        };
        
        await this.saveConfig();
        console.log('BLAST settings updated');
    }

    async migrateBlastDatabasesFromLocalStorage() {
        console.log('=== Starting BLAST database migration from localStorage ===');
        
        try {
            const localStorageData = localStorage.getItem('blast_custom_databases');
            if (!localStorageData) {
                console.log('No BLAST databases found in localStorage to migrate');
                return { success: true, migrated: 0 };
            }

            const savedData = JSON.parse(localStorageData);
            let databases;
            
            if (Array.isArray(savedData)) {
                databases = savedData;
                console.log('Found old format BLAST databases in localStorage');
            } else if (savedData.databases) {
                databases = savedData.databases;
                console.log('Found new format BLAST databases in localStorage');
            } else {
                throw new Error('Invalid BLAST database format in localStorage');
            }

            let migratedCount = 0;
            for (const [id, data] of databases) {
                await this.setBlastDatabase(id, {
                    ...data,
                    migratedFrom: 'localStorage',
                    migrationDate: new Date().toISOString()
                });
                migratedCount++;
            }

            // Update migration metadata
            this.config.blast.metadata.migrationVersion = '1.0';
            this.config.blast.metadata.lastMigration = new Date().toISOString();
            await this.saveConfig();

            console.log(`Successfully migrated ${migratedCount} BLAST databases from localStorage`);
            
            // Optionally clean up localStorage after successful migration
            if (migratedCount > 0) {
                localStorage.removeItem('blast_custom_databases');
                localStorage.removeItem('blast_custom_databases_backup');
                console.log('Cleaned up localStorage after successful migration');
            }

            return { success: true, migrated: migratedCount };
            
        } catch (error) {
            console.error('Error migrating BLAST databases from localStorage:', error);
            return { success: false, error: error.message };
        }
    }

    // Evo2 configuration methods
    async getEvo2Config() {
        await this.waitForInitialization();
        return this.config.evo2 || {};
    }

    async setEvo2Config(config) {
        await this.waitForInitialization();
        
        this.config.evo2 = {
            ...this.config.evo2,
            ...config,
            lastSaved: new Date().toISOString()
        };
        
        await this.saveConfig();
        console.log('Evo2 configuration updated');
    }

    async getEvo2ApiKey() {
        await this.waitForInitialization();
        return this.config.evo2?.apiKey || '';
    }

    async setEvo2ApiKey(apiKey) {
        await this.waitForInitialization();
        
        if (!this.config.evo2) {
            this.config.evo2 = {};
        }
        
        this.config.evo2.apiKey = apiKey;
        this.config.evo2.lastSaved = new Date().toISOString();
        
        await this.saveConfig();
        console.log('Evo2 API key updated');
    }

    async getEvo2AnalysisHistory() {
        await this.waitForInitialization();
        return this.config.evo2?.analysisHistory || [];
    }

    async setEvo2AnalysisHistory(history) {
        await this.waitForInitialization();
        
        if (!this.config.evo2) {
            this.config.evo2 = {};
        }
        
        this.config.evo2.analysisHistory = history;
        this.config.evo2.lastSaved = new Date().toISOString();
        
        await this.saveConfig();
        console.log('Evo2 analysis history updated');
    }

    // Tab state management methods
    async getTabStates() {
        await this.waitForInitialization();
        return this.config.tabs?.states || {};
    }

    async setTabState(tabId, tabState) {
        await this.waitForInitialization();
        
        if (!this.config.tabs) {
            this.config.tabs = { states: {}, activeTabId: null, lastSessionTabs: [], restoreTabsOnStartup: true };
        }
        if (!this.config.tabs.states) {
            this.config.tabs.states = {};
        }
        
        // Add metadata
        tabState.lastSaved = new Date().toISOString();
        tabState.tabId = tabId;
        
        this.config.tabs.states[tabId] = tabState;
        
        // Update last session tabs list
        if (!this.config.tabs.lastSessionTabs.includes(tabId)) {
            this.config.tabs.lastSessionTabs.push(tabId);
        }
        
        // Limit stored tabs
        const maxTabs = this.config.ui?.tabSettings?.maxStoredTabs || 50;
        const allTabIds = Object.keys(this.config.tabs.states);
        if (allTabIds.length > maxTabs) {
            // Remove oldest tabs
            const sortedTabs = allTabIds.sort((a, b) => {
                const timeA = new Date(this.config.tabs.states[a].lastSaved || 0);
                const timeB = new Date(this.config.tabs.states[b].lastSaved || 0);
                return timeA - timeB;
            });
            
            const tabsToRemove = sortedTabs.slice(0, allTabIds.length - maxTabs);
            tabsToRemove.forEach(id => {
                delete this.config.tabs.states[id];
                const index = this.config.tabs.lastSessionTabs.indexOf(id);
                if (index > -1) {
                    this.config.tabs.lastSessionTabs.splice(index, 1);
                }
            });
        }
        
        if (this.config.ui?.tabSettings?.autoSaveTabStates) {
            this.debouncedSave();
        }
        
        console.log(`Tab state saved for: ${tabId}`);
    }

    async getTabState(tabId) {
        await this.waitForInitialization();
        return this.config.tabs?.states?.[tabId] || null;
    }

    async removeTabState(tabId) {
        await this.waitForInitialization();
        
        if (this.config.tabs?.states?.[tabId]) {
            delete this.config.tabs.states[tabId];
            
            // Remove from last session tabs
            const index = this.config.tabs.lastSessionTabs.indexOf(tabId);
            if (index > -1) {
                this.config.tabs.lastSessionTabs.splice(index, 1);
            }
            
            await this.saveConfig();
            console.log(`Tab state removed for: ${tabId}`);
            return true;
        }
        return false;
    }

    async setActiveTab(tabId) {
        await this.waitForInitialization();
        
        if (!this.config.tabs) {
            this.config.tabs = { states: {}, activeTabId: null, lastSessionTabs: [], restoreTabsOnStartup: true };
        }
        
        this.config.tabs.activeTabId = tabId;
        
        if (this.config.ui?.tabSettings?.autoSaveTabStates) {
            this.debouncedSave();
        }
    }

    async getActiveTab() {
        await this.waitForInitialization();
        return this.config.tabs?.activeTabId || null;
    }

    async getLastSessionTabs() {
        await this.waitForInitialization();
        return this.config.tabs?.lastSessionTabs || [];
    }

    async clearTabStates() {
        await this.waitForInitialization();
        
        if (!this.config.tabs) {
            this.config.tabs = { states: {}, activeTabId: null, lastSessionTabs: [], restoreTabsOnStartup: true };
        }
        
        this.config.tabs.states = {};
        this.config.tabs.lastSessionTabs = [];
        this.config.tabs.activeTabId = null;
        
        await this.saveConfig();
        console.log('All tab states cleared');
    }

    async getTabSettings() {
        await this.waitForInitialization();
        return this.config.ui?.tabSettings || {};
    }

    async setTabSettings(settings) {
        await this.waitForInitialization();
        
        if (!this.config.ui.tabSettings) {
            this.config.ui.tabSettings = {};
        }
        
        this.config.ui.tabSettings = {
            ...this.config.ui.tabSettings,
            ...settings
        };
        
        await this.saveConfig();
        console.log('Tab settings updated');
    }
} 