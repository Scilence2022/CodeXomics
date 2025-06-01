/**
 * ConfigManager - Comprehensive configuration management for the Genome Browser
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
                        app: electronAPI_path.join(configDir, 'app-settings.json')
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
                                app: path.join(configDir, 'app-settings.json')
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
                    local: {
                        name: 'Local LLM',
                        apiKey: '',
                        model: 'llama3.2',
                        baseUrl: 'http://localhost:11434/v1',
                        streamingSupport: true,
                        enabled: false,
                        maxTokens: 4096,
                        temperature: 0.7
                    }
                },
                currentProvider: null,
                systemPrompt: '',
                conversationMemory: 10, // Number of messages to remember
                autoSave: true
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
                confirmDeleteActions: true
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
                app: this.configPath.app
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
            await fs.writeFile(this.configPath.main, JSON.stringify(mainConfigData, null, 2));
            console.log('Main config saved successfully');

            // Save specific config files
            const configFiles = {
                [this.configPath.llm]: this.config.llm,
                [this.configPath.ui]: this.config.ui,
                [this.configPath.chat]: this.config.chat,
                [this.configPath.app]: this.config.app
            };

            for (const [filePath, data] of Object.entries(configFiles)) {
                console.log('Saving config to:', filePath);
                console.log('Data keys:', Object.keys(data));
                await fs.writeFile(filePath, JSON.stringify(data, null, 2));
                console.log('Config file saved successfully:', filePath);
            }
            
            console.log('All configuration files saved successfully');
            console.log('=== saveToFiles Debug End ===');
        } catch (error) {
            console.error('Error saving configuration to files:', error);
            console.error('=== saveToFiles Debug End (ERROR) ===');
            throw error;
        }
    }

    /**
     * Save configuration to localStorage (fallback)
     */
    saveToLocalStorage() {
        try {
            // Backward compatibility with existing LLM config
            localStorage.setItem('llmConfiguration', JSON.stringify({
                providers: this.config.llm.providers,
                currentProvider: this.config.llm.currentProvider
            }));

            localStorage.setItem('uiPreferences', JSON.stringify(this.config.ui));
            localStorage.setItem('chatHistory', JSON.stringify(this.config.chat.history));
            localStorage.setItem('appSettings', JSON.stringify(this.config.app));
        } catch (error) {
            console.error('Error saving configuration to localStorage:', error);
            throw error;
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
} 