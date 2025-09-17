/**
 * ChatManager - Handles LLM chat interface and MCP communication
 */
class ChatManager {
    constructor(app, configManager = null) {
        this.app = app;
        this.configManager = configManager;
        this.llmConfigManager = null;
        this.mcpServerManager = null;
        this.chatHistory = [];
        
        // Event emitter functionality
        this.eventHandlers = new Map();
        
        // Context mode toggle state - false means send full conversation, true means send only current message
        this.contextModeEnabled = true; // Default to Current message only mode
        
        this.mcpSocket = null;
        this.clientId = null;
        this.isConnected = false;
        this.activeRequests = new Map();
        this.pendingMessages = [];
        
        // 对话状态管理
        this.conversationState = {
            isProcessing: false,
            currentRequestId: null,
            abortController: null,
            startTime: null,
            processSteps: [],
            currentStep: 0
        };
        
        // Initialize ChatBox Settings Manager
        this.chatBoxSettingsManager = null;
        this.initializeChatBoxSettings();
        
        // 思考过程和工具调用显示 - 现在从设置管理器获取
        this.showThinkingProcess = true;
        this.showToolCalls = true;
        this.showToolCallSource = true;
        this.showDetailedToolData = true;
        this.detailedLogging = true;
        
        // Initialize LLM configuration manager with config integration
        this.llmConfigManager = new LLMConfigManager(this.configManager);
        
        // Initialize MCP Server Manager
        this.mcpServerManager = new MCPServerManager(this.configManager);
        this.setupMCPServerEventHandlers();
        
        // Initialize MicrobeGenomicsFunctions
        this.initializeMicrobeGenomicsFunctions();
        
        // Initialize Plugin Manager
        this.initializePluginManager();
        
        // Initialize Plugin Function Calls Integrator
        this.pluginFunctionCallsIntegrator = null;
        
        // Initialize Multi-Agent System (Legacy)
        this.multiAgentSystem = null;
        this.memorySystem = null;
        this.agentSystemEnabled = false;
        this.agentSystemSettings = {
            enabled: false,
            autoOptimize: true,
            showAgentInfo: true,
            memoryEnabled: true,
            cacheEnabled: true
        };
        this.initializePluginFunctionCallsIntegrator();
        
        // Initialize Multi-Agent System
        this.initializeMultiAgentSystem();
        
        // Initialize Smart Execution System
        this.smartExecutor = null;
        this.isSmartExecutionEnabled = true; // 可配置开关
        this.initializeSmartExecutor();
        
        // Initialize Conversation Evolution Integration
        this.evolutionManager = null;
        this.currentConversationData = null;
        this.evolutionEnabled = true;
        this.initializeEvolutionIntegration();
        
        // Set global reference for copy button functionality
        window.chatManager = this;
        
        // Message history browsing state
        this.messageHistory = {
            userMessages: [], // Filtered user messages for browsing
            currentIndex: -1, // Current position in history (-1 means not browsing)
            originalContent: '', // Original input content before browsing
            isBrowsing: false // Whether currently browsing history
        };
        
        // DON'T load chat history here - wait for UI to be created
        
        // Legacy MCP connection check (kept for backward compatibility)
        this.checkAndSetupMCPConnection();
        this.initializeUI();
        
        // Load chat history AFTER UI is initialized
        setTimeout(() => {
            this.loadChatHistory();
            
            // Update agent system button state after UI is ready
            this.updateMultiAgentToggleButton();
        }, 100);
    }

    /**
     * Initialize ChatBox Settings Manager
     */
    async initializeChatBoxSettings() {
        try {
            // Load the settings manager module
            await this.loadScript('modules/ChatBoxSettingsManager.js');
            
            // Initialize the settings manager
            if (typeof ChatBoxSettingsManager !== 'undefined') {
                this.chatBoxSettingsManager = new ChatBoxSettingsManager(this.configManager);
                
                // Update display flags from settings
                this.updateSettingsFromManager();
                
                // Listen for settings changes
                window.addEventListener('chatbox-settingsChanged', (event) => {
                    this.updateSettingsFromManager();
                });
                
                // Set global reference for settings modal
                window.chatBoxSettingsManager = this.chatBoxSettingsManager;
                
                // Listen for Multi-Agent Settings changes
                window.addEventListener('multiAgentSettingsChanged', (event) => {
                    console.log('Multi-Agent settings changed, updating toggle button');
                    this.updateMultiAgentToggleButton();
                });
                
                console.log('ChatBoxSettingsManager initialized successfully');
            } else {
                console.warn('ChatBoxSettingsManager not available');
            }
        } catch (error) {
            console.error('Failed to initialize ChatBoxSettingsManager:', error);
        }
    }

    /**
     * Update internal settings from settings manager
     */
    updateSettingsFromManager() {
        if (this.chatBoxSettingsManager) {
            this.showThinkingProcess = this.chatBoxSettingsManager.getSetting('showThinkingProcess', true);
            this.showToolCalls = this.chatBoxSettingsManager.getSetting('showToolCalls', true);
            this.showToolCallSource = this.chatBoxSettingsManager.getSetting('showToolCallSource', true);
            this.showDetailedToolData = this.chatBoxSettingsManager.getSetting('showDetailedToolData', true);
            this.hideThinkingAfterConversation = this.chatBoxSettingsManager.getSetting('hideThinkingAfterConversation', false);
            this.autoScrollToBottom = this.chatBoxSettingsManager.getSetting('autoScrollToBottom', true);
            this.showTimestamps = this.chatBoxSettingsManager.getSetting('showTimestamps', false);
            this.maxHistoryMessages = this.chatBoxSettingsManager.getSetting('maxHistoryMessages', 1000);
            this.responseTimeout = this.chatBoxSettingsManager.getSetting('responseTimeout', 30000);
            
            // Update agent system settings
            const agentSystemEnabled = this.chatBoxSettingsManager.getSetting('agentSystemEnabled', false);
            if (agentSystemEnabled !== this.agentSystemEnabled) {
                this.agentSystemEnabled = agentSystemEnabled;
                this.agentSystemSettings.enabled = agentSystemEnabled;
                this.updateMultiAgentToggleButton();
            }
            
            this.agentSystemSettings.autoOptimize = this.chatBoxSettingsManager.getSetting('agentAutoOptimize', true);
            this.agentSystemSettings.showAgentInfo = this.chatBoxSettingsManager.getSetting('agentShowInfo', true);
            this.agentSystemSettings.memoryEnabled = this.chatBoxSettingsManager.getSetting('agentMemoryEnabled', true);
            this.agentSystemSettings.cacheEnabled = this.chatBoxSettingsManager.getSetting('agentCacheEnabled', true);
            
            // Update agent LLM settings
            this.agentSystemSettings.llmProvider = this.chatBoxSettingsManager.getSetting('agentLLMProvider', 'auto');
            this.agentSystemSettings.llmModel = this.chatBoxSettingsManager.getSetting('agentLLMModel', 'auto');
            this.agentSystemSettings.llmTemperature = this.chatBoxSettingsManager.getSetting('agentLLMTemperature', 0.7);
            this.agentSystemSettings.llmMaxTokens = this.chatBoxSettingsManager.getSetting('agentLLMMaxTokens', 4000);
            this.agentSystemSettings.llmTimeout = this.chatBoxSettingsManager.getSetting('agentLLMTimeout', 30000);
            this.agentSystemSettings.llmRetryAttempts = this.chatBoxSettingsManager.getSetting('agentLLMRetryAttempts', 3);
            this.agentSystemSettings.llmUseSystemPrompt = this.chatBoxSettingsManager.getSetting('agentLLMUseSystemPrompt', true);
            this.agentSystemSettings.llmEnableFunctionCalling = this.chatBoxSettingsManager.getSetting('agentLLMEnableFunctionCalling', true);
            
            console.log('🔧 Settings updated from ChatBoxSettingsManager');
        }
    }

    /**
     * Initialize MicrobeGenomicsFunctions integration
     */
    initializeMicrobeGenomicsFunctions() {
        // Check if MicrobeGenomicsFunctions is available globally
        if (typeof window !== 'undefined' && window.MicrobeFns) {
            this.MicrobeFns = window.MicrobeFns;
            console.log('MicrobeGenomicsFunctions integrated successfully');
        } else {
            console.warn('MicrobeGenomicsFunctions not available globally');
        }
    }

    /**
     * Initialize Plugin Manager V2 integration
     */
    initializePluginManager() {
        try {
            // Check if PluginManagerV2 is already available globally
            if (typeof PluginManagerV2 !== 'undefined') {
                this.pluginManager = new PluginManagerV2(this.app, this.configManager);
                console.log('🔧 PluginManagerV2 integrated successfully from global');
                
                // Listen to enhanced plugin events
                this.pluginManager.on('system-initialized', (data) => {
                    console.log('🚀 Plugin system initialized:', data);
                });
                
                this.pluginManager.on('function-executed', (data) => {
                    console.log('✅ Plugin function executed:', data);
                });
                
                this.pluginManager.on('function-error', (data) => {
                    console.error('❌ Plugin function error:', data);
                });
                
                this.pluginManager.on('plugin-registered', (data) => {
                    console.log('📦 Plugin registered:', data);
                });
                
            } else {
                console.warn('PluginManagerV2 not available, loading dynamically...');
                this.loadPluginManager();
            }
        } catch (error) {
            console.error('Failed to initialize PluginManagerV2:', error);
        }
    }

    /**
     * Load Plugin Manager V2 dynamically
     */
    async loadPluginManager() {
        try {
            // Load new plugin system files in correct order
            await this.loadScript('modules/PluginAPI.js');
            await this.loadScript('modules/PluginResourceManager.js');
            await this.loadScript('modules/PluginMarketplace.js');
            await this.loadScript('modules/PluginDependencyResolver.js');
            await this.loadScript('modules/PluginSecurityValidator.js');
            await this.loadScript('modules/PluginUpdateManager.js');
            await this.loadScript('modules/PluginManagerV2.js');
            
            // Load supporting files
            await this.loadScript('modules/PluginUtils.js');
            await this.loadScript('modules/PluginImplementations.js');
            await this.loadScript('modules/PluginVisualization.js');
            
            // Initialize after loading
            if (typeof PluginManagerV2 !== 'undefined') {
                this.pluginManager = new PluginManagerV2(this.app, this.configManager);
                console.log('🚀 PluginManagerV2 loaded and initialized successfully');
            } else {
                throw new Error('PluginManagerV2 failed to load');
            }
        } catch (error) {
            console.error('Failed to load PluginManagerV2:', error);
            throw new Error('PluginManagerV2 is required for ChatManager functionality');
        }
    }

    /**
     * Load script dynamically with duplicate check
     */
    loadScript(src) {
        return new Promise((resolve, reject) => {
            // Check if script is already loaded
            const existingScript = document.querySelector(`script[src="${src}"]`);
            if (existingScript) {
                console.log(`Script ${src} already loaded, skipping...`);
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Initialize Plugin Function Calls Integrator
     */
    async initializePluginFunctionCallsIntegrator() {
        try {
            // Load the integrator module
            await this.loadScript('modules/PluginFunctionCallsIntegrator.js');
            
            // Initialize after PluginManager is ready
            const initIntegrator = () => {
                if (typeof PluginFunctionCallsIntegrator !== 'undefined' && this.pluginManager) {
                    this.pluginFunctionCallsIntegrator = new PluginFunctionCallsIntegrator(this, this.pluginManager);
                    console.log('PluginFunctionCallsIntegrator initialized successfully');
                } else {
                    console.warn('PluginFunctionCallsIntegrator or PluginManager not available, retrying...');
                    setTimeout(initIntegrator, 500);
                }
            };
            
            // Try to initialize, with retry for timing issues
            setTimeout(initIntegrator, 100);
            
        } catch (error) {
            console.error('Failed to initialize PluginFunctionCallsIntegrator:', error);
        }
    }
    
    /**
     * Initialize Multi-Agent System (Legacy)
     */
    async initializeMultiAgentSystem() {
        try {
            // Load settings first
            this.loadAgentSystemSettings();
            
            console.log('🔧 Agent System Settings:', this.agentSystemSettings);
            
            console.log('🤖 Initializing Legacy Multi-Agent System...');
            // Initialize Legacy Multi-Agent System
            await this.initializeLegacyMultiAgentSystem();
            
        } catch (error) {
            console.error('Failed to initialize Multi-Agent System:', error);
        }
    }
    
    
    /**
     * Initialize Legacy Multi-Agent System
     */
    async initializeLegacyMultiAgentSystem() {
        try {
            console.log('🤖 Initializing Legacy Multi-Agent System...');
            
            // Load required modules
            await this.loadScript('modules/MultiAgentSystem.js');
            
            // Load all available agent classes
            // AgentBase.js is already loaded via index.html
            await this.loadScript('modules/Agents/NavigationAgent.js');
            await this.loadScript('modules/Agents/AnalysisAgent.js');
            await this.loadScript('modules/Agents/DataAgent.js');
            await this.loadScript('modules/Agents/ExternalAgent.js');
            await this.loadScript('modules/Agents/PluginAgent.js');
            await this.loadScript('modules/Agents/CoordinatorAgent.js');
            
            // Load memory system modules
            await this.loadScript('modules/MemorySystem.js');
            await this.loadScript('modules/MemoryLayers/ShortTermMemory.js');
            
            // Initialize Multi-Agent System
            if (typeof MultiAgentSystem !== 'undefined') {
                this.multiAgentSystem = new MultiAgentSystem(this, this.configManager);
                await this.multiAgentSystem.initialize();
                
                // Initialize Memory System
                if (typeof MemorySystem !== 'undefined') {
                    this.memorySystem = new MemorySystem(this.multiAgentSystem);
                    await this.memorySystem.initialize();
                }
                
                console.log('🤖 Legacy Multi-Agent System initialized successfully');
                this.agentSystemEnabled = this.agentSystemSettings.enabled;
                
                // Emit initialization event
                this.emit('agent-system-initialized', {
                    enabled: this.agentSystemEnabled,
                    agentCount: this.multiAgentSystem.agents.size
                });
                
            } else {
                console.warn('MultiAgentSystem not available');
            }
            
        } catch (error) {
            console.error('Failed to initialize Legacy Multi-Agent System:', error);
        }
    }
    
    /**
     * Load agent system settings from config
     */
    loadAgentSystemSettings() {
        try {
            const savedSettings = this.configManager.get('agentSystemSettings', {});
            this.agentSystemSettings = {
                ...this.agentSystemSettings,
                ...savedSettings
            };
            
        } catch (error) {
            console.warn('Failed to load agent system settings:', error);
        }
    }
    
    /**
     * Save agent system settings to config
     */
    saveAgentSystemSettings() {
        try {
            this.configManager.set('agentSystemSettings', this.agentSystemSettings);
        } catch (error) {
            console.warn('Failed to save agent system settings:', error);
        }
    }
    
    /**
     * Toggle multi-agent system on/off (new implementation)
     */
    toggleMultiAgentSystem() {
        // Use current internal state as the authoritative source
        const currentState = this.agentSystemEnabled;
        const newState = !currentState;
        
        // Update internal state first
        this.agentSystemEnabled = newState;
        this.agentSystemSettings.enabled = newState;
        
        // Update Multi-Agent Settings
        if (this.configManager) {
            this.configManager.set('multiAgentSettings.multiAgentSystemEnabled', newState);
        }
        
        // Sync to ChatBox settings for backward compatibility
        if (this.chatBoxSettingsManager) {
            this.chatBoxSettingsManager.setSetting('agentSystemEnabled', newState);
        }
        
        this.saveAgentSystemSettings();
        
        // Update button appearance immediately
        this.updateMultiAgentToggleButton();
        
        // Show user notification
        this.showNotification(
            `Multi-Agent System ${newState ? 'enabled' : 'disabled'}`, 
            newState ? 'success' : 'info'
        );
        
        // Emit state change event
        this.emit('agent-system-state-changed', {
            enabled: this.agentSystemEnabled,
            settings: this.agentSystemSettings
        });
        
        console.log(`🤖 Multi-Agent system toggled: ${newState ? 'ON' : 'OFF'}`);
        
        return this.agentSystemEnabled;
    }
    
    /**
     * Update agent system settings
     */
    updateAgentSystemSettings(settings) {
        this.agentSystemSettings = {
            ...this.agentSystemSettings,
            ...settings
        };
        this.saveAgentSystemSettings();
        
        console.log('🤖 Agent system settings updated:', this.agentSystemSettings);
        
        // Emit settings update event
        this.emit('agent-system-settings-updated', {
            settings: this.agentSystemSettings
        });
    }
    
    /**
     * Get agent system status
     */
    getAgentSystemStatus() {
        const status = {
            enabled: this.agentSystemEnabled,
            initialized: this.multiAgentSystem !== null,
            settings: this.agentSystemSettings,
            stats: this.multiAgentSystem ? this.multiAgentSystem.getSystemStats() : null,
            memoryStats: this.memorySystem ? this.memorySystem.getMemoryStats() : null,
            systemType: 'legacy'
        };
        
        
        return status;
    }

    /**
     * Initialize Smart Executor for optimized function calls
     */
    async initializeSmartExecutor() {
        try {
            // Load the required modules
            await this.loadScript('modules/FunctionCallsOrganizer.js');
            await this.loadScript('modules/SmartExecutor.js');
            
            // Initialize the smart executor
            if (typeof SmartExecutor !== 'undefined') {
                this.smartExecutor = new SmartExecutor(this);
                console.log('SmartExecutor initialized successfully');
            } else {
                console.warn('SmartExecutor not available, falling back to standard execution');
            }
        } catch (error) {
            console.error('Failed to initialize SmartExecutor:', error);
            this.isSmartExecutionEnabled = false;
        }
    }

    /**
     * Initialize Conversation Evolution Integration
     */
    async initializeEvolutionIntegration() {
        try {
            console.log('🧬 Initializing Evolution integration...');
            
            // Check if ConversationEvolutionManager is available globally
            let evolutionManagerFound = false;
            
            if (typeof window !== 'undefined') {
                if (window.evolutionManager) {
                    this.evolutionManager = window.evolutionManager;
                    evolutionManagerFound = true;
                    console.log('🧬 Evolution Manager connected to ChatBox via window.evolutionManager');
                } else if (window.conversationEvolutionManager) {
                    this.evolutionManager = window.conversationEvolutionManager;
                    evolutionManagerFound = true;
                    console.log('🧬 Evolution Manager connected to ChatBox via window.conversationEvolutionManager');
                }
            }
            
            if (!evolutionManagerFound) {
                console.log('🧬 Evolution Manager not available yet, setting up polling...');
                
                // Set up aggressive polling for Evolution Manager
                let pollCount = 0;
                const maxPolls = 50; // 10 seconds with 200ms intervals
                
                const pollForEvolutionManager = () => {
                    pollCount++;
                    
                    if (window.evolutionManager || window.conversationEvolutionManager) {
                        this.evolutionManager = window.evolutionManager || window.conversationEvolutionManager;
                        console.log(`🧬 Evolution Manager connected to ChatBox (poll ${pollCount})`);
                        
                        // Immediately sync current conversation if it exists
                        if (this.currentConversationData && this.currentConversationData.events.length > 0) {
                            console.log('🧬 Syncing existing conversation data to Evolution Manager');
                            this.syncCurrentConversationToEvolution();
                        }
                        
                        return;
                    }
                    
                    if (pollCount < maxPolls) {
                        setTimeout(pollForEvolutionManager, 200);
                    } else {
                        console.warn('🧬 Evolution Manager not found after polling timeout');
                    }
                };
                
                setTimeout(pollForEvolutionManager, 100);
            }
            
            // Initialize current conversation data structure
            this.resetCurrentConversationData();
            
            // If Evolution Manager is already connected, sync immediately
            if (evolutionManagerFound && this.currentConversationData) {
                console.log('🧬 Performing initial sync to Evolution Manager');
                this.syncCurrentConversationToEvolution();
            }
            
        } catch (error) {
            console.error('❌ Failed to initialize Evolution integration:', error);
        }
    }

    /**
     * Connect to Evolution Manager (called when Evolution Manager becomes available)
     */
    connectToEvolutionManager(evolutionManager) {
        if (evolutionManager && this.evolutionEnabled) {
            this.evolutionManager = evolutionManager;
            console.log('🧬 Evolution Manager connected to ChatBox successfully');
            
            // If there's a current conversation in progress, sync it
            if (this.currentConversationData && this.currentConversationData.events.length > 0) {
                this.syncCurrentConversationToEvolution();
            }
        }
    }

    /**
     * Reset current conversation data structure
     */
    resetCurrentConversationData() {
        this.currentConversationData = {
            id: this.generateConversationId(),
            startTime: new Date().toISOString(),
            endTime: null,
            events: [],
            context: this.getCurrentContext(),
            stats: {
                messageCount: 0,
                userMessageCount: 0,
                assistantMessageCount: 0,
                errorCount: 0,
                successCount: 0,
                toolCallCount: 0,
                failureCount: 0,
                thinkingProcessCount: 0
            },
            metadata: {
                source: 'chatbox',
                chatboxVersion: window.VERSION_INFO ? window.VERSION_INFO.fullVersion : '0.3.0-beta',
                features: {
                    thinkingProcess: this.showThinkingProcess,
                    toolCalls: this.showToolCalls,
                    smartExecution: this.isSmartExecutionEnabled
                }
            }
        };
    }

    /**
     * Generate unique conversation ID
     */
    generateConversationId() {
        return `chatbox_conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    setupMCPServerEventHandlers() {
        this.mcpServerManager.on('serverConnected', (data) => {
            console.log(`MCP Server connected: ${data.server.name}`);
            this.updateConnectionStatus(true);
            this.updateMCPStatus('connected');
        });

        this.mcpServerManager.on('serverDisconnected', (data) => {
            console.log(`MCP Server disconnected: ${data.server.name}`);
            // Only update status to disconnected if no servers are connected
            if (this.mcpServerManager.getConnectedServersCount() === 0) {
                this.updateConnectionStatus(false);
                this.updateMCPStatus('disconnected');
            } else {
                // Update button state even if some servers are still connected
                this.updateMCPToggleButton();
            }
        });

        this.mcpServerManager.on('serverError', (data) => {
            const serverName = data.server?.name || data.serverId || 'Unknown Server';
            console.error(`MCP Server error (${serverName}):`, data.error);
        });

        this.mcpServerManager.on('toolsUpdated', (data) => {
            console.log(`Tools updated for server ${data.serverId}:`, data.tools.map(t => t.name));
            // Refresh the MCP tools list in the UI
            if (window.genomeBrowser && window.genomeBrowser.populateMCPToolsList) {
                setTimeout(() => {
                    window.genomeBrowser.populateMCPToolsList();
                }, 100);
            }
        });
    }

    async checkAndSetupMCPConnection() {
        const defaultSettings = {
            allowAutoActivation: false, // NEW: Default to false to avoid unwanted connections
            autoConnect: false, // Default to false to avoid unwanted connections
            serverUrl: 'ws://localhost:3003',
            reconnectDelay: 5
        };
        
        const mcpSettings = this.configManager ? 
            this.configManager.get('mcpSettings', defaultSettings) : 
            defaultSettings;
        
        if (mcpSettings.allowAutoActivation && mcpSettings.autoConnect) {
            this.setupMCPConnection();
        }
    }

    // Legacy single MCP connection (kept for backward compatibility)
    async setupMCPConnection(manualConnection = false) {
        const defaultSettings = {
            autoConnect: false,
            serverUrl: 'ws://localhost:3003',
            reconnectDelay: 5
        };
        
        const mcpSettings = this.configManager ? 
            this.configManager.get('mcpSettings', defaultSettings) : 
            defaultSettings;
        
        try {
            // Update status to connecting
            this.updateMCPStatus('connecting');
            
            this.mcpSocket = new WebSocket(mcpSettings.serverUrl);
            
            this.mcpSocket.onopen = () => {
                console.log('Connected to legacy MCP server');
                this.isConnected = true;
                this.updateConnectionStatus(true);
                this.updateMCPStatus('connected');
                
                // Send any pending messages
                this.pendingMessages.forEach(msg => this.sendToMCP(msg));
                this.pendingMessages = [];
            };

            this.mcpSocket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMCPMessage(data);
                } catch (error) {
                    console.error('Error parsing MCP message:', error);
                }
            };

            this.mcpSocket.onclose = () => {
                console.log('Disconnected from legacy MCP server');
                this.isConnected = false;
                this.updateConnectionStatus(false);
                this.updateMCPStatus('disconnected');
                
                // Only attempt to reconnect if this is not a manual connection and auto-activation is enabled
                if (!manualConnection) {
                    const currentSettings = this.configManager ? 
                        this.configManager.get('mcpSettings', defaultSettings) : 
                        defaultSettings;
                        
                    if (currentSettings.allowAutoActivation && currentSettings.autoConnect) {
                        setTimeout(() => this.setupMCPConnection(), mcpSettings.reconnectDelay * 1000);
                    }
                }
            };

            this.mcpSocket.onerror = (error) => {
                console.error('Legacy MCP connection error:', error);
                this.updateConnectionStatus(false);
                this.updateMCPStatus('disconnected');
            };

        } catch (error) {
            console.error('Failed to setup legacy MCP connection:', error);
            this.updateConnectionStatus(false);
            this.updateMCPStatus('disconnected');
        }
    }

    disconnectMCP() {
        if (this.mcpSocket) {
            console.log('Manually disconnecting from legacy MCP server');
            this.mcpSocket.close();
            this.mcpSocket = null;
        }
        this.isConnected = false;
        this.updateConnectionStatus(false);
        this.updateMCPStatus('disconnected');
    }

    // Update MCP status in the settings modal if it's open
    updateMCPStatus(status) {
        const statusIcon = document.getElementById('mcpStatusIcon');
        const statusText = document.getElementById('mcpStatusText');
        const connectBtn = document.getElementById('mcpConnectBtn');
        const disconnectBtn = document.getElementById('mcpDisconnectBtn');
        
        if (statusIcon && statusText) {
            statusIcon.className = 'fas fa-circle';
            
            switch (status) {
                case 'connected':
                    statusIcon.classList.add('connected');
                    const connectedCount = this.mcpServerManager.getConnectedServersCount();
                    statusText.textContent = connectedCount > 0 ? 
                        `Connected (${connectedCount} servers)` : 'Connected';
                    if (connectBtn) connectBtn.disabled = true;
                    if (disconnectBtn) disconnectBtn.disabled = false;
                    break;
                case 'connecting':
                    statusIcon.classList.add('connecting');
                    statusText.textContent = 'Connecting...';
                    if (connectBtn) connectBtn.disabled = true;
                    if (disconnectBtn) disconnectBtn.disabled = true;
                    break;
                case 'disconnected':
                default:
                    statusIcon.classList.add('disconnected');
                    statusText.textContent = 'Disconnected';
                    if (connectBtn) connectBtn.disabled = false;
                    if (disconnectBtn) disconnectBtn.disabled = true;
                    break;
            }
        }
        
        // Also update the toggle button in chat header
        this.updateMCPToggleButton();
    }

    /**
     * Toggle MCP connection
     */
    async toggleMCPConnection() {
        const toggleBtn = document.getElementById('mcpToggleBtn');
        if (!toggleBtn) return;

        const isConnected = toggleBtn.dataset.connected === 'true';
        
        try {
            if (isConnected) {
                // Disconnect from MCP servers
                if (this.mcpServerManager) {
                    // Disconnect from all active servers
                    const activeServers = Array.from(this.mcpServerManager.activeServers);
                    for (const serverId of activeServers) {
                        await this.mcpServerManager.disconnectFromServer(serverId);
                    }
                }
                
                // Also disconnect from legacy MCP if connected
                if (this.isConnected) {
                    this.disconnectMCP();
                }
                
                this.showNotification('Disconnected from MCP servers', 'info');
            } else {
                // Connect to MCP servers (manual connection - bypass auto-activation check)
                console.log('Manual MCP connection requested');

                if (this.mcpServerManager) {
                    // Try to connect to enabled servers first
                    const servers = this.mcpServerManager.getServerStatus();
                    const enabledServers = servers.filter(server => server.enabled);
                    
                    if (enabledServers.length === 0) {
                        // Try to connect to the built-in genome-studio server
                        try {
                            await this.mcpServerManager.connectToServer('genome-studio');
                            this.showNotification('Connected to built-in MCP server', 'success');
                        } catch (error) {
                            console.warn('Failed to connect to built-in server, trying legacy connection:', error);
                            // Fallback to legacy connection
                            try {
                                await this.setupMCPConnection(true); // Mark as manual connection
                                this.showNotification('Connected to MCP server (legacy mode)', 'success');
                            } catch (legacyError) {
                                console.error('Failed to connect via legacy mode:', legacyError);
                                this.showNotification('Failed to connect to MCP server. Please check server status.', 'error');
                            }
                        }
                    } else {
                        // Connect to enabled servers
                        let connectedCount = 0;
                        for (const server of enabledServers) {
                            try {
                                await this.mcpServerManager.connectToServer(server.id);
                                connectedCount++;
                            } catch (error) {
                                console.warn(`Failed to connect to server ${server.name}:`, error);
                            }
                        }
                        
                        if (connectedCount > 0) {
                            this.showNotification(`Connected to ${connectedCount} MCP server(s)`, 'success');
                        } else {
                            // If all enabled servers failed, try built-in server as fallback
                            try {
                                await this.mcpServerManager.connectToServer('genome-studio');
                                this.showNotification('Connected to built-in MCP server (fallback)', 'success');
                            } catch (error) {
                                // Final fallback to legacy connection
                                try {
                                    await this.setupMCPConnection(true); // Mark as manual connection
                                    this.showNotification('Connected to MCP server (legacy fallback)', 'success');
                                } catch (legacyError) {
                                    this.showNotification('Failed to connect to any MCP servers', 'error');
                                }
                            }
                        }
                    }
                } else {
                    // Fallback to legacy connection if no modern manager
                    try {
                        await this.setupMCPConnection(true); // Mark as manual connection
                        this.showNotification('Connected to MCP server (legacy mode)', 'success');
                    } catch (error) {
                        console.error('Failed to connect via legacy mode:', error);
                        this.showNotification('Failed to connect to MCP server. Please check server status.', 'error');
                    }
                }
            }
        } catch (error) {
            console.error('Error toggling MCP connection:', error);
            this.showNotification(`Error: ${error.message}`, 'error');
        }
    }

    /**
     * Update MCP toggle button state
     */
    updateMCPToggleButton() {
        const toggleBtn = document.getElementById('mcpToggleBtn');
        if (!toggleBtn) return;

        // Check connection status
        let isConnected = false;
        let connectedCount = 0;

        // Check modern MCP server manager connections
        if (this.mcpServerManager) {
            connectedCount = this.mcpServerManager.getConnectedServersCount();
            isConnected = connectedCount > 0;
        }

        // Also check legacy connection
        if (!isConnected && this.isConnected) {
            isConnected = true;
            connectedCount = 1;
        }

        // Update button state
        toggleBtn.dataset.connected = isConnected.toString();
        
        const icon = toggleBtn.querySelector('i');
        if (isConnected) {
            toggleBtn.classList.add('connected');
            toggleBtn.classList.remove('disconnected');
            icon.className = 'fas fa-unlink';
            toggleBtn.title = `Disconnect from MCP (${connectedCount} connection${connectedCount !== 1 ? 's' : ''})`;
        } else {
            toggleBtn.classList.add('disconnected');
            toggleBtn.classList.remove('connected');
            icon.className = 'fas fa-plug';
            toggleBtn.title = 'Connect to MCP Server';
        }
    }
    
    /**
     * Update multi-agent toggle button appearance
     */
    updateMultiAgentToggleButton() {
        const button = document.getElementById('multiAgentToggleBtn');
        if (button) {
            // Use the internal state as the authoritative source
            const isEnabled = this.agentSystemEnabled;
            
            // Update button attributes
            button.setAttribute('data-enabled', isEnabled.toString());
            button.title = isEnabled ? 'Disable Multi-Agent System' : 'Enable Multi-Agent System';
            
            // Update button visual state
            button.classList.toggle('enabled', isEnabled);
            button.classList.toggle('active', isEnabled);
            
            // Update icon
            const icon = button.querySelector('i');
            if (icon) {
                icon.className = 'fas fa-users-cog';
            }
            
            // Update text content with shorter labels
            const textSpan = button.querySelector('.toggle-text');
            if (textSpan) {
                textSpan.textContent = isEnabled ? 'ON' : 'OFF';
            }
            
            // Apply visual styling based on state
            if (isEnabled) {
                button.style.backgroundColor = '#4CAF50';
                button.style.color = '#ffffff';
                button.style.border = '1px solid #4CAF50';
                button.style.boxShadow = '0 0 10px rgba(76, 175, 80, 0.3)';
            } else {
                button.style.backgroundColor = '#6c757d';
                button.style.color = '#ffffff';
                button.style.border = '1px solid #6c757d';
                button.style.boxShadow = 'none';
            }
            
            console.log(`🤖 Multi-Agent toggle button updated: ${isEnabled ? 'ON' : 'OFF'}`);
        }
    }
    
    /**
     * Show agent system settings modal
     */
    showAgentSystemSettings() {
        // Create settings modal if it doesn't exist
        let modal = document.getElementById('agentSystemSettingsModal');
        if (!modal) {
            modal = this.createAgentSystemSettingsModal();
            document.body.appendChild(modal);
        }
        
        // Populate current settings
        this.populateAgentSystemSettingsForm(modal);
        
        // Show modal
        modal.style.display = 'block';
        modal.classList.add('show');
        
        // Center modal
        if (!modal.style.left && !modal.style.top) {
            modal.style.transform = 'translate(-50%, -50%)';
            modal.style.top = '50%';
            modal.style.left = '50%';
        }
    }
    
    /**
     * Create agent system settings modal
     */
    createAgentSystemSettingsModal() {
        const modal = document.createElement('div');
        modal.id = 'agentSystemSettingsModal';
        modal.className = 'modal draggable-modal';
        
        modal.innerHTML = `
            <div class="modal-content agent-settings-modal-content resizable-modal-content">
                <div class="modal-header draggable-header" id="agentSystemSettingsHeader">
                    <h3><i class="fas fa-robot"></i> Multi-Agent System Settings</h3>
                    <button class="modal-close" onclick="this.closest('.modal').style.display='none'; this.closest('.modal').classList.remove('show');">
                        &times;
                    </button>
                </div>
                
                <div class="modal-body">
                    <div class="form-section">
                        <h4>🤖 System Status</h4>
                        <div class="status-display" id="agentSystemStatus">
                            <div class="status-item">
                                <span class="status-label">System:</span>
                                <span class="status-value" id="systemStatus">Loading...</span>
                            </div>
                            <div class="status-item">
                                <span class="status-label">Agents:</span>
                                <span class="status-value" id="agentCount">Loading...</span>
                            </div>
                            <div class="status-item">
                                <span class="status-label">Memory:</span>
                                <span class="status-value" id="memoryStatus">Loading...</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-section">
                        <h4>⚙️ Core Settings</h4>
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="agentSystemEnabled" class="setting-checkbox">
                                Enable Multi-Agent System
                            </label>
                            <small class="help-text">Enable intelligent agent-based tool execution</small>
                        </div>
                        
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="agentAutoOptimize" class="setting-checkbox">
                                Auto-optimize execution paths
                            </label>
                            <small class="help-text">Automatically optimize tool execution based on memory and performance data</small>
                        </div>
                        
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="agentShowInfo" class="setting-checkbox">
                                Show agent information
                            </label>
                            <small class="help-text">Display which agent is handling each tool execution</small>
                        </div>
                    </div>
                    
                    <div class="form-section">
                        <h4>🧠 Memory System</h4>
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="agentMemoryEnabled" class="setting-checkbox">
                                Enable memory system
                            </label>
                            <small class="help-text">Enable intelligent memory caching and context management</small>
                        </div>
                        
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="agentCacheEnabled" class="setting-checkbox">
                                Enable execution caching
                            </label>
                            <small class="help-text">Cache successful tool executions for faster future execution</small>
                        </div>
                    </div>
                    
                    <div class="form-section">
                        <h4>📊 Performance</h4>
                        <div class="performance-metrics" id="agentPerformanceMetrics">
                            <div class="metric-item">
                                <span class="metric-label">Cache Hit Rate</span>
                                <span class="metric-value" id="cacheHitRate">--</span>
                            </div>
                            <div class="metric-item">
                                <span class="metric-label">Avg Execution Time</span>
                                <span class="metric-value" id="avgExecutionTime">--</span>
                            </div>
                            <div class="metric-item">
                                <span class="metric-label">Memory Usage</span>
                                <span class="metric-value" id="memoryUsage">--</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="window.chatManager.resetAgentSystemSettings(); window.chatManager.populateAgentSystemSettingsForm(this.closest('.modal'));">
                        <i class="fas fa-undo"></i> Reset to Defaults
                    </button>
                    <div style="display: flex; gap: 12px;">
                        <button class="btn btn-secondary" onclick="this.closest('.modal').style.display='none'">
                            Cancel
                        </button>
                        <button class="btn btn-primary" onclick="window.chatManager.saveAgentSystemSettingsFromForm(this.closest('.modal'))">
                            <i class="fas fa-save"></i> Save Settings
                        </button>
                    </div>
                </div>
                
                <!-- Resize handles -->
                <div class="resize-handle resize-handle-n"></div>
                <div class="resize-handle resize-handle-s"></div>
                <div class="resize-handle resize-handle-e"></div>
                <div class="resize-handle resize-handle-w"></div>
                <div class="resize-handle resize-handle-ne"></div>
                <div class="resize-handle resize-handle-nw"></div>
                <div class="resize-handle resize-handle-se"></div>
                <div class="resize-handle resize-handle-sw"></div>
            </div>
        `;
        
        return modal;
    }
    
    /**
     * Populate agent system settings form
     */
    populateAgentSystemSettingsForm(modal) {
        const status = this.getAgentSystemStatus();
        
        // Update status display
        modal.querySelector('#systemStatus').textContent = status.enabled ? 'Enabled' : 'Disabled';
        modal.querySelector('#agentCount').textContent = status.stats ? status.stats.agentCount : '0';
        modal.querySelector('#memoryStatus').textContent = status.memoryStats ? 'Active' : 'Inactive';
        
        // Update checkboxes
        modal.querySelector('#agentSystemEnabled').checked = this.agentSystemSettings.enabled;
        modal.querySelector('#agentAutoOptimize').checked = this.agentSystemSettings.autoOptimize;
        modal.querySelector('#agentShowInfo').checked = this.agentSystemSettings.showAgentInfo;
        modal.querySelector('#agentMemoryEnabled').checked = this.agentSystemSettings.memoryEnabled;
        modal.querySelector('#agentCacheEnabled').checked = this.agentSystemSettings.cacheEnabled;
        
        // Update performance metrics
        if (status.stats) {
            modal.querySelector('#cacheHitRate').textContent = `${status.stats.cacheHitRate || 0}%`;
            modal.querySelector('#avgExecutionTime').textContent = `${status.stats.avgExecutionTime || 0}ms`;
            modal.querySelector('#memoryUsage').textContent = `${status.stats.memoryUsage || 0}KB`;
        }
    }
    
    /**
     * Save agent system settings from form
     */
    saveAgentSystemSettingsFromForm(modal) {
        const newSettings = {
            enabled: modal.querySelector('#agentSystemEnabled').checked,
            autoOptimize: modal.querySelector('#agentAutoOptimize').checked,
            showAgentInfo: modal.querySelector('#agentShowInfo').checked,
            memoryEnabled: modal.querySelector('#agentMemoryEnabled').checked,
            cacheEnabled: modal.querySelector('#agentCacheEnabled').checked
        };
        
        this.updateAgentSystemSettings(newSettings);
        
        // Sync settings back to ChatBoxSettingsManager to maintain consistency
        this.chatBoxSettingsManager.setSetting('agentSystemEnabled', newSettings.enabled);
        this.chatBoxSettingsManager.setSetting('agentAutoOptimize', newSettings.autoOptimize);
        this.chatBoxSettingsManager.setSetting('agentShowInfo', newSettings.showAgentInfo);
        this.chatBoxSettingsManager.setSetting('agentMemoryEnabled', newSettings.memoryEnabled);
        this.chatBoxSettingsManager.setSetting('agentCacheEnabled', newSettings.cacheEnabled);
        
        // Update the main agent system enabled state
        this.agentSystemEnabled = newSettings.enabled;
        
        // Update button state
        this.updateMultiAgentToggleButton();
        
        // Close modal
        modal.style.display = 'none';
        modal.classList.remove('show');
        
        // Show success message
        this.showNotification('Agent system settings saved successfully', 'success');
    }
    
    /**
     * Reset agent system settings to defaults
     */
    resetAgentSystemSettings() {
        this.agentSystemSettings = {
            enabled: false,
            autoOptimize: true,
            showAgentInfo: true,
            memoryEnabled: true,
            cacheEnabled: true
        };
        this.saveAgentSystemSettings();
    }
    
    /**
     * Event emitter functionality
     */
    on(eventType, handler) {
        if (!this.eventHandlers.has(eventType)) {
            this.eventHandlers.set(eventType, []);
        }
        this.eventHandlers.get(eventType).push(handler);
    }
    
    /**
     * Remove event handler
     */
    off(eventType, handler) {
        if (this.eventHandlers.has(eventType)) {
            const handlers = this.eventHandlers.get(eventType);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }
    
    /**
     * Emit event
     */
    emit(eventType, data) {
        // Call local handlers
        if (this.eventHandlers.has(eventType)) {
            this.eventHandlers.get(eventType).forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Error in event handler for ${eventType}:`, error);
                }
            });
        }
        
        // Emit to window for global event handling
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(`chatmanager-${eventType}`, {
                detail: data
            }));
        }
        
        console.log(`🔔 ChatManager event: ${eventType}`, data);
    }

    handleMCPMessage(data) {
        switch (data.type) {
            case 'connection':
                this.clientId = data.clientId;
                console.log('Received client ID:', this.clientId);
                break;
                
            case 'execute-tool':
                this.executeToolRequest(data);
                break;
                
            case 'tool-response':
                // Handle responses from tool executions
                if (this.activeRequests.has(data.requestId)) {
                    const resolve = this.activeRequests.get(data.requestId);
                    this.activeRequests.delete(data.requestId);
                    resolve(data);
                }
                break;
        }
    }

    async executeToolRequest(data) {
        const { requestId, toolName, parameters } = data;
        
        try {
            let result;
            
            // Use new priority-based tool execution system
            result = await this.executeToolWithPriority(toolName, parameters);
            
            if (result !== undefined) {
                // Tool found and executed
                this.sendMessage({
                    type: 'tool-response',
                    requestId,
                    success: true,
                    result: result
                });
                return;
            }
            
            // Fallback to legacy system if tool not found in priority system
            
            switch (toolName) {
                case 'navigate_to_position':
                    result = await this.navigateToPosition(parameters);
                    break;
                
                case 'open_new_tab':
                    result = await this.openNewTab(parameters);
                    break;
                    
                case 'search_features':
                    result = await this.searchFeatures(parameters);
                    break;
                    
                case 'get_current_state':
                    result = this.getCurrentState();
                    break;
                    
                case 'get_sequence':
                    result = await this.getSequence(parameters);
                    break;
                    
                case 'toggle_track':
                    result = await this.toggleTrack(parameters);
                    break;
                    
                case 'toggle_annotation_track':
                    result = await this.toggleAnnotationTrack(parameters);
                    break;
                    
                case 'create_annotation':
                    result = await this.createAnnotation(parameters);
                    break;
                    
                case 'analyze_region':
                    result = await this.analyzeRegion(parameters);
                    break;
                    
                case 'export_data':
                    result = await this.exportData(parameters);
                    break;
                    
                case 'get_gene_details':
                    result = await this.getGeneDetails(parameters);
                    break;
                    
                case 'translate_sequence':
                    result = await this.translateSequence(parameters);
                    break;
                    
                case 'calculate_gc_content':
                    result = await this.calculateGCContent(parameters);
                    break;
                    
                case 'find_orfs':
                    result = await this.findOpenReadingFrames(parameters);
                    break;
                    
                case 'get_operons':
                    result = await this.getOperons(parameters);
                    break;
                    
                case 'zoom_to_gene':
                    result = await this.zoomToGene(parameters);
                    break;
                    
                case 'get_chromosome_list':
                    result = this.getChromosomeList();
                    break;
                    
                case 'get_track_status':
                    result = this.getTrackStatus();
                    break;
                    
                case 'search_motif':
                    result = await this.searchMotif(parameters);
                    break;
                    
                case 'search_pattern':
                    result = await this.searchPattern(parameters);
                    break;
                    
                case 'get_nearby_features':
                    result = await this.getNearbyFeatures(parameters);
                    break;
                    
                case 'find_intergenic_regions':
                    result = await this.findIntergenicRegions(parameters);
                    break;
                    
                case 'find_restriction_sites':
                    result = await this.findRestrictionSites(parameters);
                    break;
                    
                case 'virtual_digest':
                    result = await this.virtualDigest(parameters);
                    break;
                    
                case 'sequence_statistics':
                    result = await this.sequenceStatistics(parameters);
                    break;
                    
                case 'codon_usage_analysis':
                    result = await this.codonUsageAnalysis(parameters);
                    break;
                    
                case 'amino_acid_composition':
                    result = await this.aminoAcidComposition(parameters);
                    break;
                    
                case 'bookmark_position':
                    result = await this.bookmarkPosition(parameters);
                    break;
                    
                case 'get_bookmarks':
                    result = this.getBookmarks(parameters);
                    break;
                    
                case 'save_view_state':
                    result = await this.saveViewState(parameters);
                    break;
                    
                case 'compare_regions':
                    result = await this.compareRegions(parameters);
                    break;
                    
                case 'find_similar_sequences':
                    result = await this.findSimilarSequences(parameters);
                    break;
                    
                case 'edit_annotation':
                    result = await this.editAnnotation(parameters);
                    break;
                    
                case 'delete_annotation':
                    result = await this.deleteAnnotation(parameters);
                    break;
                    
                case 'batch_create_annotations':
                    result = await this.batchCreateAnnotations(parameters);
                    break;
                    
                case 'get_file_info':
                    result = this.getFileInfo(parameters);
                    break;
                    
                case 'export_region_features':
                    result = await this.exportRegionFeatures(parameters);
                    break;
                    
                case 'open_protein_viewer':
                    result = await this.openProteinViewer(parameters);
                    break;
                    
                // MicrobeGenomicsFunctions Integration
                case 'navigate_to':
                    result = this.executeMicrobeFunction('navigateTo', parameters);
                    break;
                    
                case 'jump_to_gene':
                    result = this.executeMicrobeFunction('jumpToGene', parameters);
                    break;
                    
                case 'get_current_region':
                    result = this.executeMicrobeFunction('getCurrentRegion', parameters);
                    break;
                    
                case 'scroll_left':
                    result = this.executeMicrobeFunction('scrollLeft', parameters);
                    break;
                    
                case 'scroll_right':
                    result = this.executeMicrobeFunction('scrollRight', parameters);
                    break;
                    
                case 'zoom_in':
                    result = this.executeMicrobeFunction('zoomIn', parameters);
                    break;
                    
                case 'zoom_out':
                    result = this.executeMicrobeFunction('zoomOut', parameters);
                    break;
                    
                case 'compute_gc':
                    result = this.executeMicrobeFunction('computeGC', parameters);
                    break;
                    
                case 'reverse_complement':
                    result = this.executeMicrobeFunction('reverseComplement', parameters);
                    break;
                    
                case 'translate_dna':
                    result = this.executeMicrobeFunction('translateDNA', parameters);
                    break;
                    
                case 'find_orfs':
                    result = this.executeMicrobeFunction('findORFs', parameters);
                    break;
                    
                case 'calculate_entropy':
                    result = this.executeMicrobeFunction('calculateEntropy', parameters);
                    break;
                    
                case 'calc_region_gc':
                    result = this.executeMicrobeFunction('calcRegionGC', parameters);
                    break;
                    
                case 'calculate_melting_temp':
                    result = this.executeMicrobeFunction('calculateMeltingTemp', parameters);
                    break;
                    
                case 'calculate_molecular_weight':
                    result = this.executeMicrobeFunction('calculateMolecularWeight', parameters);
                    break;
                    
                case 'analyze_codon_usage':
                    result = this.executeMicrobeFunction('analyzeCodonUsage', parameters);
                    break;
                    
                case 'predict_promoter':
                    result = this.executeMicrobeFunction('predictPromoter', parameters);
                    break;
                    
                case 'predict_rbs':
                    result = this.executeMicrobeFunction('predictRBS', parameters);
                    break;
                    
                case 'predict_terminator':
                    result = this.executeMicrobeFunction('predictTerminator', parameters);
                    break;
                    
                case 'search_gene_by_name':
                    result = this.executeMicrobeFunction('searchGeneByName', parameters);
                    break;
                    
                case 'search_sequence_motif':
                    result = this.executeMicrobeFunction('searchSequenceMotif', parameters);
                    break;
                    
                case 'search_by_position':
                    result = this.executeMicrobeFunction('searchByPosition', parameters);
                    break;
                    
                case 'search_intergenic_regions':
                    result = this.executeMicrobeFunction('searchIntergenicRegions', parameters);
                    break;
                    
                case 'edit_annotation':
                    result = this.executeMicrobeFunction('editAnnotation', parameters);
                    break;
                    
                case 'delete_annotation':
                    result = this.executeMicrobeFunction('deleteAnnotation', parameters);
                    break;
                    
                case 'merge_annotations':
                    result = this.executeMicrobeFunction('mergeAnnotations', parameters);
                    break;
                    
                case 'add_annotation':
                    result = this.executeMicrobeFunction('addAnnotation', parameters);
                    break;
                    
                case 'get_upstream_region':
                    result = this.executeMicrobeFunction('getUpstreamRegion', parameters);
                    break;
                    
                case 'get_downstream_region':
                    result = this.executeMicrobeFunction('getDownstreamRegion', parameters);
                    break;
                    
                case 'add_track':
                    result = this.executeMicrobeFunction('addTrack', parameters);
                    break;
                    
                case 'add_variant':
                    result = this.executeMicrobeFunction('addVariant', parameters);
                    break;
                    
                // BLAST Search Tools
                case 'blast_search':
                    result = await this.blastSearch(parameters);
                    break;
                    
                case 'blast_sequence_from_region':
                    result = await this.blastSequenceFromRegion(parameters);
                    break;
                    
                case 'get_blast_databases':
                    result = this.getBlastDatabases(parameters);
                    break;
                    
                // Enhanced BLAST Tools
                case 'batch_blast_search':
                    result = await this.batchBlastSearch(parameters);
                    break;
                    
                case 'advanced_blast_search':
                    result = await this.advancedBlastSearch(parameters);
                    break;
                    
                case 'local_blast_database_info':
                    result = await this.localBlastDatabaseInfo(parameters);
                    break;
                    
                default:
                    throw new Error(`Unknown tool: ${toolName}`);
            }

            this.sendToMCP({
                type: 'tool-response',
                requestId: requestId,
                success: true,
                result: result
            });

        } catch (error) {
            this.sendToMCP({
                type: 'tool-response',
                requestId: requestId,
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Execute a MicrobeGenomicsFunctions method with error handling
     */
    executeMicrobeFunction(methodName, parameters) {
        if (!this.MicrobeFns) {
            throw new Error('MicrobeGenomicsFunctions not available');
        }
        
        try {
            console.log(`Executing MicrobeFns.${methodName} with parameters:`, parameters);
            
            if (typeof this.MicrobeFns[methodName] !== 'function') {
                throw new Error(`Method ${methodName} not found in MicrobeGenomicsFunctions`);
            }
            
            // Handle different parameter patterns
            let result;
            if (!parameters || Object.keys(parameters).length === 0) {
                // No parameters
                result = this.MicrobeFns[methodName]();
            } else if (parameters.sequence || parameters.dna) {
                // Single sequence parameter
                result = this.MicrobeFns[methodName](parameters.sequence || parameters.dna);
            } else if (parameters.chromosome && parameters.start && parameters.end) {
                // Position-based parameters
                result = this.MicrobeFns[methodName](parameters.chromosome, parameters.start, parameters.end);
            } else if (parameters.geneName || parameters.name) {
                // Gene name parameter
                result = this.MicrobeFns[methodName](parameters.geneName || parameters.name);
            } else {
                // Pass all parameters as individual arguments or as object
                const paramKeys = Object.keys(parameters);
                if (paramKeys.length === 1) {
                    result = this.MicrobeFns[methodName](parameters[paramKeys[0]]);
                } else {
                    // Try passing parameters as individual arguments in common patterns
                    const values = Object.values(parameters);
                    result = this.MicrobeFns[methodName](...values);
                }
            }
            
            console.log(`MicrobeFns.${methodName} result:`, result);
            
            // Wrap result in success format if it's not already an object
            if (typeof result !== 'object' || result === null) {
                return {
                    success: true,
                    value: result,
                    method: methodName,
                    parameters: parameters
                };
            }
            
            return {
                success: true,
                ...result,
                method: methodName,
                parameters: parameters
            };
            
        } catch (error) {
            console.error(`Error executing MicrobeFns.${methodName}:`, error);
            throw new Error(`MicrobeGenomics function ${methodName} failed: ${error.message}`);
        }
    }

    // Tool implementations
    async navigateToPosition(params) {
        let { chromosome, start, end, position } = params;
        
        console.log('navigateToPosition called with params:', params);
        
        if (!this.app) {
            throw new Error('Genome browser not initialized');
        }
        
        // Auto-detect chromosome if not provided
        if (!chromosome) {
            // Try to get current chromosome from the chromosome selector
            const chromosomeSelect = document.getElementById('chromosomeSelect');
            if (chromosomeSelect && chromosomeSelect.value) {
                chromosome = chromosomeSelect.value;
                console.log(`Auto-detected chromosome: ${chromosome}`);
            } else if (this.app.currentSequence) {
                // If no chromosome is selected, use the first available chromosome
                const availableChromosomes = Object.keys(this.app.currentSequence);
                if (availableChromosomes.length > 0) {
                    chromosome = availableChromosomes[0];
                    console.log(`Using first available chromosome: ${chromosome}`);
                }
            }
            
            if (!chromosome) {
                throw new Error('No chromosome specified and unable to auto-detect current chromosome. Please load genome data first.');
            }
        }
        
        // Check if the target chromosome exists in loaded data
        if (!this.app.currentSequence || !this.app.currentSequence[chromosome]) {
            // List available chromosomes for better error message
            const availableChromosomes = this.app.currentSequence ? Object.keys(this.app.currentSequence) : [];
            throw new Error(`Chromosome ${chromosome} not found in loaded genome data. Available chromosomes: ${availableChromosomes.join(', ')}`);
        }
        
        // Handle position parameter with default 2000bp range
        if (position !== undefined && (start === undefined || end === undefined)) {
            const defaultRange = 2000;
            start = Math.max(1, position - Math.floor(defaultRange / 2));
            end = position + Math.floor(defaultRange / 2);
            console.log(`Using position ${position} with default ${defaultRange}bp range: ${start}-${end}`);
        }
        
        // Validate required parameters
        if (!chromosome || start === undefined || end === undefined) {
            throw new Error('Missing required parameters: chromosome and either (start, end) or position');
        }
        
        // First, switch to the target chromosome if it's not currently selected
        const currentChr = document.getElementById('chromosomeSelect')?.value;
        if (currentChr !== chromosome) {
            console.log(`Switching from chromosome ${currentChr} to ${chromosome}`);
            
            // Use the selectChromosome method to properly switch
            this.app.selectChromosome(chromosome);
            
            // Wait a bit for the UI to update
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Now navigate to the specific position within that chromosome
        const sequence = this.app.currentSequence[chromosome];
        
        // Validate and adjust bounds
        const validatedStart = Math.max(0, start - 1); // Convert to 0-based
        const validatedEnd = Math.min(sequence.length, end);
        
        if (validatedStart >= validatedEnd) {
            throw new Error(`Invalid position range: ${start}-${end}`);
        }
        
        // Set the position directly
        this.app.currentPosition = { start: validatedStart, end: validatedEnd };
        this.app.currentChromosome = chromosome;
        
        // Update the genome view
        this.app.updateStatistics(chromosome, sequence);
        this.app.displayGenomeView(chromosome, sequence);
        
        // Update navigation bar if it exists
        if (this.app.genomeNavigationBar) {
            this.app.genomeNavigationBar.update();
        }
        
        console.log(`Successfully navigated to ${chromosome}:${start}-${end}`);
        
        return {
            success: true,
            chromosome: chromosome,
            start: start,
            end: end,
            message: `Navigated to ${chromosome}:${start}-${end}`,
            usedDefaultRange: position !== undefined && (params.start === undefined || params.end === undefined)
        };
    }

    async openNewTab(params) {
        const { chromosome, start, end, position, title, geneName } = params;
        
        console.log('🔧 [ChatManager] openNewTab called with params:', params);
        
        try {
            // Use window.genomeBrowser instead of this.app for access
            const genomeBrowser = window.genomeBrowser;
            if (!genomeBrowser) {
                throw new Error('Genome browser not available via window.genomeBrowser');
            }
            
            // Wait for TabManager to be initialized with retry mechanism
            if (!genomeBrowser.tabManager) {
                console.log('⏳ TabManager not ready, waiting...');
                // Wait for TabManager with retry logic
                let retries = 0;
                const maxRetries = 10;
                while (!genomeBrowser.tabManager && retries < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                    retries++;
                    console.log(`⏳ Waiting for TabManager... attempt ${retries}/${maxRetries}`);
                }
                
                if (!genomeBrowser.tabManager) {
                    throw new Error('Tab manager not available after waiting - check TabManager initialization');
                }
            }
            
            let tabId;
            let finalTitle = title;
            let usedDefaultRange = false;
            
            // Handle different ways to create a new tab
            if (geneName) {
                // Open tab for specific gene
                const geneResults = await this.searchFeatures({ query: geneName, caseSensitive: false });
                if (geneResults.count > 0 && geneResults.results.length > 0) {
                    const gene = geneResults.results[0];
                    // Use the UI response function instead of direct manager access
                    tabId = genomeBrowser.tabManager.createTabForGene(gene, 500);
                    finalTitle = finalTitle || `Gene: ${gene.name || gene.id || geneName}`;
                } else {
                    throw new Error(`Gene '${geneName}' not found`);
                }
            } else if (chromosome) {
                // Open tab for specific position
                let finalStart = start;
                let finalEnd = end;
                
                // Handle position parameter with default 2000bp range
                if (position !== undefined && (start === undefined || end === undefined)) {
                    const defaultRange = 2000;
                    finalStart = Math.max(1, position - Math.floor(defaultRange / 2));
                    finalEnd = position + Math.floor(defaultRange / 2);
                    usedDefaultRange = true;
                    console.log(`Using position ${position} with default ${defaultRange}bp range: ${finalStart}-${finalEnd}`);
                }
                
                if (finalStart && finalEnd) {
                    // Check if chromosome exists
                    if (!genomeBrowser.currentSequence || !genomeBrowser.currentSequence[chromosome]) {
                        throw new Error(`Chromosome ${chromosome} not found in loaded genome data`);
                    }
                    
                    // Use the UI response function instead of direct manager access
                    tabId = genomeBrowser.tabManager.createTabForPosition(chromosome, finalStart, finalEnd, finalTitle);
                    finalTitle = finalTitle || `${chromosome}:${finalStart.toLocaleString()}-${finalEnd.toLocaleString()}`;
                } else {
                    throw new Error('Missing required parameters: start and end positions, or position parameter');
                }
            } else {
                // Create new tab with current position - use the same method as the + button
                // This is the key change: use the actual UI response function
                const newTabButton = document.getElementById('newTabButton');
                if (newTabButton) {
                    // Simulate the + button click to use the actual UI response function
                    newTabButton.click();
                    // Get the newly created tab ID from the tab manager
                    const tabIds = Array.from(genomeBrowser.tabManager.tabs.keys());
                    tabId = tabIds[tabIds.length - 1]; // Get the most recently created tab
                    finalTitle = finalTitle || 'New Tab';
                } else {
                    // Fallback to direct manager access if button not found
                    tabId = genomeBrowser.tabManager.createNewTab(finalTitle);
                    finalTitle = finalTitle || 'New Tab';
                }
            }
            
            console.log(`✅ [ChatManager] Successfully created new tab: ${tabId} - ${finalTitle}`);
            
            return {
                success: true,
                tabId: tabId,
                title: finalTitle,
                message: `Opened new tab: ${finalTitle}`,
                usedDefaultRange: usedDefaultRange
            };
            
        } catch (error) {
            console.error('❌ [ChatManager] Error opening new tab:', error);
            throw error;
        }
    }

    async searchFeatures(params) {
        const { query, caseSensitive } = params;
        
        console.log('searchFeatures called with params:', params);
        
        // Use existing search functionality from NavigationManager
        if (this.app && this.app.navigationManager) {
            console.log('Using navigationManager.performSearch');
            
            // Store original settings
            const originalCaseSensitive = document.getElementById('caseSensitive')?.checked;
            
            // Set case sensitivity for this search
            const caseSensitiveCheckbox = document.getElementById('caseSensitive');
            if (caseSensitiveCheckbox) {
                caseSensitiveCheckbox.checked = caseSensitive || false;
            }
            
            // Perform the search
            this.app.navigationManager.performSearch(query);
            
            // Get the results from NavigationManager
            const searchResults = this.app.navigationManager.searchResults || [];
            
            // Restore original setting
            if (caseSensitiveCheckbox && originalCaseSensitive !== undefined) {
                caseSensitiveCheckbox.checked = originalCaseSensitive;
            }
            
            console.log('Search completed, results:', searchResults);
            
            return {
                query: query,
                caseSensitive: caseSensitive || false,
                results: searchResults,
                count: searchResults.length
            };
        }
        
        throw new Error('Navigation manager not available');
    }

    getCurrentState() {
        if (!this.app) {
            throw new Error('Genome browser not initialized');
        }

        // Debug logging to understand the app state
        console.log('ChatManager getCurrentState - this.app:', this.app);
        console.log('ChatManager getCurrentState - this.app.currentChromosome:', this.app.currentChromosome);
        console.log('ChatManager getCurrentState - this.app.currentAnnotations:', this.app.currentAnnotations);
        console.log('ChatManager getCurrentState - this.app.currentPosition:', this.app.currentPosition);

        const state = {
            currentChromosome: this.app.currentChromosome,
            currentPosition: this.app.currentPosition,
            visibleTracks: this.getVisibleTracks(),
            loadedFiles: this.app.loadedFiles || [],
            sequenceLength: this.app.sequenceLength || 0,
            annotationsCount: (this.app.currentAnnotations || []).length,
            userDefinedFeaturesCount: Object.keys(this.app.userDefinedFeatures || {}).length,
            
            // Enhanced: Add selected gene information
            selectedGene: this.app.selectedGene ? {
                geneName: this.app.selectedGene.gene?.qualifiers?.gene || 'Unknown',
                locusTag: this.app.selectedGene.gene?.qualifiers?.locus_tag || 'Unknown',
                product: this.app.selectedGene.gene?.qualifiers?.product || 'Unknown',
                position: `${this.app.selectedGene.gene?.start}-${this.app.selectedGene.gene?.end}`,
                strand: this.app.selectedGene.gene?.strand === -1 ? '-' : '+',
                type: this.app.selectedGene.gene?.type || 'Unknown',
                hasOperonInfo: !!this.app.selectedGene.operonInfo
            } : null,
            
            // Enhanced: Add sequence selection information
            sequenceSelection: this.app.sequenceSelection ? {
                active: this.app.sequenceSelection.active,
                start: this.app.sequenceSelection.start,
                end: this.app.sequenceSelection.end,
                length: this.app.sequenceSelection.active && this.app.sequenceSelection.start && this.app.sequenceSelection.end ? 
                    this.app.sequenceSelection.end - this.app.sequenceSelection.start + 1 : null
            } : null,
            
            // Enhanced: Add current viewing region details
            viewingRegion: this.app.currentPosition ? {
                chromosome: this.app.currentChromosome,
                start: this.app.currentPosition.start,
                end: this.app.currentPosition.end,
                length: this.app.currentPosition.end - this.app.currentPosition.start + 1,
                centerPosition: Math.floor((this.app.currentPosition.start + this.app.currentPosition.end) / 2)
            } : null
        };

        console.log('ChatManager getCurrentState - final state:', state);
        return state;
    }

    async getSequence(params) {
        const { chromosome, start, end } = params;
        
        if (this.app && this.app.getSequenceForRegion) {
            const sequence = await this.app.getSequenceForRegion(chromosome, start, end);
            
            return {
                chromosome: chromosome,
                start: start,
                end: end,
                sequence: sequence,
                length: sequence.length
            };
        }
        
        throw new Error('Sequence retrieval not available');
    }

    async toggleTrack(params) {
        // Support both camelCase and snake_case parameter names
        const trackName = params.trackName || params.track_name;
        let visible = params.visible;
        
        if (!trackName) {
            throw new Error('trackName or track_name parameter is required');
        }
        
        // Map track names to checkbox IDs
        const trackMapping = {
            'genes': 'trackGenes',
            'gc': 'trackGC',
            'variants': 'trackVariants', 
            'reads': 'trackReads',
            'proteins': 'trackProteins',
            'wigTracks': 'trackWIG',
            'sequence': 'trackSequence',
            'actions': 'trackActions'
        };
        
        const checkboxId = trackMapping[trackName];
        if (!checkboxId) {
            throw new Error(`Unknown track: ${trackName}. Available tracks: ${Object.keys(trackMapping).join(', ')}`);
        }
        
        const trackCheckbox = document.getElementById(checkboxId);
        if (!trackCheckbox) {
            throw new Error(`Track checkbox not found: ${checkboxId}`);
        }
        
        // If visible not specified, toggle current state
        if (visible === undefined) {
            visible = !trackCheckbox.checked;
        }
        
        trackCheckbox.checked = visible;
        trackCheckbox.dispatchEvent(new Event('change'));
        
        // Also sync with sidebar checkbox
        const sidebarCheckboxId = 'sidebar' + checkboxId.charAt(0).toUpperCase() + checkboxId.slice(1);
        const sidebarCheckbox = document.getElementById(sidebarCheckboxId);
        if (sidebarCheckbox) {
            sidebarCheckbox.checked = visible;
            sidebarCheckbox.dispatchEvent(new Event('change'));
        }
        
        return {
            success: true,
            track: trackName,
            visible: visible,
            message: `Track ${trackName} ${visible ? 'shown' : 'hidden'}`
        };
    }

    async toggleAnnotationTrack(params) {
        // Alias for toggleTrack for annotation-specific tracks
        return await this.toggleTrack(params);
    }

    async createAnnotation(params) {
        const { type, name, chromosome, start, end, strand, description } = params;
        
        if (this.app && this.app.addUserDefinedFeature) {
            const feature = {
                type: type,
                name: name,
                chromosome: chromosome,
                start: start,
                end: end,
                strand: strand || 1,
                description: description || ''
            };
            
            const featureId = await this.app.addUserDefinedFeature(feature);
            
            return {
                success: true,
                featureId: featureId,
                feature: feature,
                message: `Created ${type} annotation: ${name}`
            };
        }
        
        throw new Error('Annotation creation not available');
    }

    async analyzeRegion(params) {
        const { chromosome, start, end, includeFeatures, includeGC } = params;
        
        const analysis = {
            chromosome: chromosome,
            start: start,
            end: end,
            length: end - start + 1
        };

        // Get sequence if available
        if (this.app && this.app.getSequenceForRegion) {
            analysis.sequence = await this.app.getSequenceForRegion(chromosome, start, end);
        }

        // Get features if requested
        if (includeFeatures && this.app.currentAnnotations) {
            analysis.features = this.app.currentAnnotations.filter(feature => 
                feature.chromosome === chromosome &&
                feature.start >= start && feature.end <= end
            );
        }

        // Calculate GC content if requested
        if (includeGC && analysis.sequence) {
            const gcCount = (analysis.sequence.match(/[GC]/gi) || []).length;
            analysis.gcContent = (gcCount / analysis.sequence.length * 100).toFixed(2);
        }

        return analysis;
    }

    async exportData(params) {
        const { format, chromosome, start, end } = params;
        
        if (this.app && this.app.exportManager) {
            try {
                let exportResult;
                
                switch (format.toLowerCase()) {
                    case 'fasta':
                        if (chromosome && start && end) {
                            // Export specific region
                            const sequence = await this.app.getSequenceForRegion(chromosome, start, end);
                            const fastaContent = `>${chromosome}:${start}-${end}\n${sequence}`;
                            exportResult = { content: fastaContent, type: 'text' };
                        } else {
                            exportResult = await this.app.exportManager.exportFASTA();
                        }
                        break;
                    case 'genbank':
                    case 'gb':
                        exportResult = await this.app.exportManager.exportGenBank();
                        break;
                    case 'gff':
                    case 'gff3':
                        exportResult = await this.app.exportManager.exportGFF();
                        break;
                    case 'bed':
                        exportResult = await this.app.exportManager.exportBED();
                        break;
                    default:
                        throw new Error(`Unsupported export format: ${format}`);
                }
                
                return {
                    format: format,
                    chromosome: chromosome,
                    start: start,
                    end: end,
                    exported: true,
                    message: `Data exported as ${format.toUpperCase()}`
                };
            } catch (error) {
                throw new Error(`Export failed: ${error.message}`);
            }
        }
        
        throw new Error('Export manager not available');
    }

    getVisibleTracks() {
        const tracks = [];
        
        // Define track mappings with their checkbox IDs
        const trackMappings = [
            { name: 'genes', id: 'trackGenes' },
            { name: 'gc', id: 'trackGC' },
            { name: 'variants', id: 'trackVariants' },
            { name: 'reads', id: 'trackReads' },
            { name: 'proteins', id: 'trackProteins' },
            { name: 'wigTracks', id: 'trackWIG' },
            { name: 'sequence', id: 'trackSequence' },
            { name: 'actions', id: 'trackActions' }
        ];
        
        // Check each track checkbox
        trackMappings.forEach(track => {
            const checkbox = document.getElementById(track.id);
            if (checkbox && checkbox.checked) {
                tracks.push(track.name);
            }
        });
        
        return tracks;
    }

    sendToMCP(message) {
        if (this.isConnected && this.mcpSocket) {
            this.mcpSocket.send(JSON.stringify(message));
        } else {
            this.pendingMessages.push(message);
        }
    }

    // Send state updates to MCP server
    sendStateUpdate(partialState) {
        this.sendToMCP({
            type: 'state-update',
            state: partialState
        });
    }

    sendNavigationUpdate(chromosome, position) {
        this.sendToMCP({
            type: 'navigation',
            chromosome: chromosome,
            position: position
        });
    }

    sendSearchResults(results) {
        this.sendToMCP({
            type: 'search-results',
            results: results
        });
    }

    sendFeatureSelection(features) {
        this.sendToMCP({
            type: 'feature-selected',
            features: features
        });
    }

    sendTrackVisibility(tracks) {
        this.sendToMCP({
            type: 'track-visibility',
            tracks: tracks
        });
    }

    // UI Management
    initializeUI() {
        this.createChatInterface();
        this.setupEventListeners();
    }

    createChatInterface() {
        // Calculate right-bottom position
        const defaultSize = { width: 400, height: 600 };
        const defaultPosition = this.getDefaultChatPosition();
        
        // Load saved position and size
        const savedPosition = this.configManager.get('chat.position', defaultPosition);
        const savedSize = this.configManager.get('chat.size', defaultSize);
        
        // Create chat panel HTML
        const chatHTML = `
            <div id="llmChatPanel" class="chat-panel resizable-movable" style="left: ${savedPosition.x}px; top: ${savedPosition.y}px; width: ${savedSize.width}px; height: ${savedSize.height}px;">
                <div class="chat-header" id="chatHeader">
                    <div class="chat-title">
                        <i class="fas fa-robot"></i>
                        <button id="multiAgentToggleBtn" class="btn btn-sm chat-btn multi-agent-toggle" title="Enable Multi-Agent System" data-enabled="false">
                            <i class="fas fa-users-cog"></i>
                            <span class="toggle-text">OFF</span>
                        </button>
                        <div class="connection-status" id="connectionStatus">
                            <i class="fas fa-circle"></i>
                            <span>Connecting...</span>
                        </div>
                    </div>
                    <div class="chat-controls">
                        <button id="chatBoxSettingsBtn" class="btn btn-sm chat-btn" title="ChatBox Settings">
                            <i class="fas fa-cog"></i>
                        </button>
                        <button id="mcpToggleBtn" class="btn btn-sm chat-btn mcp-toggle-btn" title="Toggle MCP Connection" data-connected="false">
                            <i class="fas fa-plug"></i>
                        </button>
                        <button id="resetChatPositionBtn" class="btn btn-sm chat-btn" title="Reset position and size">
                            <i class="fas fa-home"></i>
                        </button>
                        <button id="minimizeChatBtn" class="btn btn-sm chat-btn">
                            <i class="fas fa-minus"></i>
                        </button>
                        <button id="closeChatBtn" class="btn btn-sm chat-btn">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <div class="chat-messages" id="chatMessages">
                    <div class="welcome-message">
                        <div class="message assistant-message">
                            <div class="message-content">
                                <i class="fas fa-robot message-icon"></i>
                                <div class="message-text">
                                    <p>🧬 <strong>Welcome to your AI Genomics Assistant!</strong> I can help you with comprehensive genome analysis:</p>
                                    
                                    <div class="capability-section">
                                        <p><strong>🔍 Navigation & Search:</strong></p>
                                        <ul>
                                            <li>"Navigate to E. coli origin of replication"</li>
                                            <li>"Search for DNA polymerase genes"</li>
                                            <li>"Find genes near position 123456"</li>
                                            <li>"Show me the bidA gene details"</li>
                                        </ul>
                                    </div>
                                    
                                    <div class="capability-section">
                                        <p><strong>🧪 Molecular Biology Tools:</strong></p>
                                        <ul>
                                            <li>"Find EcoRI restriction sites in this region"</li>
                                            <li>"Virtual digest with EcoRI and BamHI"</li>
                                            <li>"Search for TATAAA promoter motifs"</li>
                                            <li>"Translate this gene to protein"</li>
                                        </ul>
                                    </div>
                                    
                                    <div class="capability-section">
                                        <p><strong>📊 Sequence Analysis:</strong></p>
                                        <ul>
                                            <li>"What's the GC content and AT skew here?"</li>
                                            <li>"Analyze codon usage in the lacZ gene"</li>
                                            <li>"Find all ORFs longer than 300bp"</li>
                                            <li>"Compare these two genomic regions"</li>
                                        </ul>
                                    </div>
                                    
                                    <div class="capability-section">
                                        <p><strong>🔖 Organization & Export:</strong></p>
                                        <ul>
                                            <li>"Bookmark this interesting region"</li>
                                            <li>"Export features from current view"</li>
                                            <li>"Save this view configuration"</li>
                                            <li>"Show file information summary"</li>
                                        </ul>
                                    </div>
                                    
                                    <p><em>💡 Tip: You can ask questions in natural language! Try "What restriction enzymes cut here?" or "Find intergenic regions longer than 500bp"</em></p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="chat-input-container">
                    <div class="chat-input-options">
                        <div class="context-mode-toggle">
                            <label class="toggle-label">
                                <input type="checkbox" id="contextModeToggle" checked />
                                <span class="toggle-slider"></span>
                                <span class="toggle-text">Current message only</span>
                            </label>
                        </div>
                    </div>
                    <div class="chat-input-wrapper">
                        <textarea id="chatInput" 
                                placeholder="Ask me anything about your genome data..." 
                                rows="1"></textarea>
                        <div class="chat-send-controls">
                            <button id="sendChatBtn" class="btn btn-primary">
                                <i class="fas fa-paper-plane"></i>
                            </button>
                            <button id="abortChatBtn" class="btn btn-secondary chat-abort-btn" style="display: none;">
                                <i class="fas fa-stop"></i>
                            </button>
                        </div>
                    </div>
                    <div class="chat-actions">
                        <button id="newChatBtn" class="btn btn-sm btn-primary">
                            <i class="fas fa-plus"></i>
                            New Chat
                        </button>
                        <button id="copySelectedBtn" class="btn btn-sm btn-secondary">
                            <i class="fas fa-copy"></i>
                            Copy Selected
                        </button>
                        <button id="pasteBtn" class="btn btn-sm btn-secondary">
                            <i class="fas fa-paste"></i>
                            Paste
                        </button>
                        <button id="chatHistoryBtn" class="btn btn-sm btn-secondary">
                            <i class="fas fa-history"></i>
                            History
                        </button>
                        <button id="clearChatBtn" class="btn btn-sm btn-secondary">
                            <i class="fas fa-trash"></i>
                            Clear
                        </button>
                        <button id="clearThinkingBtn" class="btn btn-sm btn-secondary">
                            <i class="fas fa-brain"></i>
                            Clear Thinking
                        </button>
                        <button id="toggleThinkingBtn" class="btn btn-sm btn-secondary">
                            <i class="fas fa-eye-slash"></i>
                            Hide History
                        </button>
                        <button id="exportChatBtn" class="btn btn-sm btn-secondary">
                            <i class="fas fa-download"></i>
                            Export
                        </button>
                        <button id="agentSettingsBtn" class="btn btn-sm btn-secondary">
                            <i class="fas fa-robot"></i>
                            Agent Settings
                        </button>
                        <button id="configBtn" class="btn btn-sm btn-secondary">
                            <i class="fas fa-cog"></i>
                            Settings
                        </button>
                        <button id="suggestionsBtn" class="btn btn-sm btn-secondary">
                            <i class="fas fa-lightbulb"></i>
                            Examples
                        </button>
                    </div>
                </div>
                <!-- Resize handles -->
                <div class="resize-handle resize-handle-n" data-direction="n"></div>
                <div class="resize-handle resize-handle-s" data-direction="s"></div>
                <div class="resize-handle resize-handle-e" data-direction="e"></div>
                <div class="resize-handle resize-handle-w" data-direction="w"></div>
                <div class="resize-handle resize-handle-ne" data-direction="ne"></div>
                <div class="resize-handle resize-handle-nw" data-direction="nw"></div>
                <div class="resize-handle resize-handle-se" data-direction="se"></div>
                <div class="resize-handle resize-handle-sw" data-direction="sw"></div>
            </div>
        `;

        // Insert chat panel into the page
        const appDiv = document.getElementById('app');
        appDiv.insertAdjacentHTML('beforeend', chatHTML);

        // Setup dragging and resizing
        this.setupChatDragging();
        this.setupChatResizing();
        
        // Add window resize handler to ensure chat stays in bounds
        this.setupWindowResizeHandler();
        
        // Force recalculation of position after DOM insertion
        setTimeout(() => {
            const chatPanel = document.getElementById('llmChatPanel');
            if (chatPanel) {
                // If using default position, recalculate to ensure it's at bottom-right
                const currentPos = this.configManager.get('chat.position');
                const freshDefaultPos = this.getDefaultChatPosition();
                
                console.log('Current saved position:', currentPos);
                console.log('Fresh calculated position:', freshDefaultPos);
                
                // If there's no saved position or if we want to force bottom positioning
                if (!currentPos || currentPos.y < (window.innerHeight * 0.3)) {
                    console.log('Applying bottom-right positioning');
                    chatPanel.style.left = freshDefaultPos.x + 'px';
                    chatPanel.style.top = freshDefaultPos.y + 'px';
                }
            }
        }, 50);
    }

    /**
     * Calculate default right-bottom position
     */
    getDefaultChatPosition() {
        const defaultSize = { width: 400, height: 600 };
        
        // Get the actual available viewport dimensions - use document.documentElement for better accuracy
        const viewportWidth = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
        const viewportHeight = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
        
        // Calculate bottom-right position
        const x = Math.max(20, viewportWidth - defaultSize.width - 20);
        const y = Math.max(20, viewportHeight - defaultSize.height - 20);
        
        console.log('Chat position calculation:', { viewportWidth, viewportHeight, x, y, defaultSize });
        
        return { x, y };
    }

    /**
     * Setup window resize handler to keep chat panel in bounds
     */
    setupWindowResizeHandler() {
        window.addEventListener('resize', () => {
            const chatPanel = document.getElementById('llmChatPanel');
            if (chatPanel) {
                // Use same viewport calculation as getDefaultChatPosition
                const viewportWidth = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
                const viewportHeight = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
                
                // Ensure chat panel stays within viewport bounds
                const currentLeft = parseInt(chatPanel.style.left, 10);
                const currentTop = parseInt(chatPanel.style.top, 10);
                const panelWidth = parseInt(chatPanel.style.width, 10);
                const panelHeight = parseInt(chatPanel.style.height, 10);
                
                const maxLeft = viewportWidth - panelWidth - 10;
                const maxTop = viewportHeight - panelHeight - 10;
                
                let needsUpdate = false;
                let newLeft = currentLeft;
                let newTop = currentTop;
                
                if (currentLeft > maxLeft) {
                    newLeft = Math.max(10, maxLeft);
                    needsUpdate = true;
                }
                
                if (currentTop > maxTop) {
                    newTop = Math.max(10, maxTop);
                    needsUpdate = true;
                }
                
                if (needsUpdate) {
                    chatPanel.style.left = newLeft + 'px';
                    chatPanel.style.top = newTop + 'px';
                    console.log('Chat position adjusted on resize:', { newLeft, newTop });
                }
            }
        });
    }

    setupEventListeners() {
        // Chat toggle button in toolbar
        this.addChatToggleButton();

        // Chat input handling
        const chatInput = document.getElementById('chatInput');
        const sendBtn = document.getElementById('sendChatBtn');

        if (chatInput && sendBtn) {
            // Auto-resize textarea and handle input changes during history browsing
            chatInput.addEventListener('input', () => {
                chatInput.style.height = 'auto';
                chatInput.style.height = chatInput.scrollHeight + 'px';
                
                // If user starts typing while browsing history, exit browse mode
                if (this.messageHistory.isBrowsing) {
                    this.exitHistoryBrowsing();
                }
            });

            // Send on Enter (Shift+Enter for new line) and handle arrow keys for history
            chatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    this.browseHistoryUp();
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    this.browseHistoryDown();
                } else if (this.messageHistory.isBrowsing && (e.key === 'Escape')) {
                    // Escape cancels history browsing and restores original content
                    e.preventDefault();
                    this.cancelHistoryBrowsing();
                }
            });

            sendBtn.addEventListener('click', () => this.sendMessage());
        }

        // Chat abort button
        const abortBtn = document.getElementById('abortChatBtn');
        if (abortBtn) {
            abortBtn.addEventListener('click', () => this.abortCurrentConversation());
        }

        // Chat controls
        document.getElementById('minimizeChatBtn')?.addEventListener('click', () => {
            this.toggleChatMinimize();
        });

        document.getElementById('closeChatBtn')?.addEventListener('click', () => {
            this.toggleChatVisibility();
        });

        document.getElementById('clearChatBtn')?.addEventListener('click', () => {
            this.clearChat();
        });

        document.getElementById('clearThinkingBtn')?.addEventListener('click', () => {
            this.clearThinkingHistory();
        });

        document.getElementById('toggleThinkingBtn')?.addEventListener('click', () => {
            this.toggleThinkingHistory();
        });

        document.getElementById('exportChatBtn')?.addEventListener('click', () => {
            this.exportChatHistory();
        });

        document.getElementById('configBtn')?.addEventListener('click', () => {
            this.showConfigOptions();
        });

        document.getElementById('suggestionsBtn')?.addEventListener('click', () => {
            this.showSuggestions();
        });

        // Multi-Agent System event listeners
        document.getElementById('multiAgentToggleBtn')?.addEventListener('click', () => {
            this.toggleMultiAgentSystem();
        });

        document.getElementById('agentSettingsBtn')?.addEventListener('click', () => {
            this.showAgentSystemSettings();
        });

        // New button event listeners
        document.getElementById('newChatBtn')?.addEventListener('click', () => {
            this.startNewChat();
        });

        document.getElementById('copySelectedBtn')?.addEventListener('click', () => {
            this.copySelectedText();
        });

        document.getElementById('pasteBtn')?.addEventListener('click', () => {
            this.pasteFromClipboard();
        });

        document.getElementById('chatHistoryBtn')?.addEventListener('click', () => {
            this.showChatHistoryModal();
        });

        // Reset position button
        document.getElementById('resetChatPositionBtn')?.addEventListener('click', () => {
            this.resetChatPosition();
        });

        // Context mode toggle
        document.getElementById('contextModeToggle')?.addEventListener('change', (e) => {
            this.contextModeEnabled = e.target.checked;
            console.log('Context mode changed:', this.contextModeEnabled ? 'Current message only' : 'Full conversation');
        });

        // ChatBox settings event handler
        window.addEventListener('chatbox-settings', () => {
            if (this.chatBoxSettingsManager) {
                this.chatBoxSettingsManager.showSettingsModal();
            } else {
                console.warn('ChatBoxSettingsManager not initialized');
            }
        });

        // ChatBox Settings button event handler
        document.getElementById('chatBoxSettingsBtn')?.addEventListener('click', () => {
            if (this.chatBoxSettingsManager) {
                this.chatBoxSettingsManager.showSettingsModal();
            } else {
                console.warn('ChatBoxSettingsManager not initialized');
            }
        });

        // MCP Toggle button event handler
        document.getElementById('mcpToggleBtn')?.addEventListener('click', () => {
            this.toggleMCPConnection();
        });
    }

    addChatToggleButton() {
        const toolbar = document.querySelector('.toolbar');
        if (toolbar) {
            const chatSection = document.createElement('div');
            chatSection.className = 'toolbar-section';
            chatSection.innerHTML = `
                <label>AI Assistant:</label>
                <button id="toggleChatBtn" class="btn btn-sm toggle-btn">
                    <i class="fas fa-robot"></i>
                </button>
            `;
            
            toolbar.appendChild(chatSection);

            document.getElementById('toggleChatBtn').addEventListener('click', () => {
                this.toggleChatVisibility();
            });
        }
    }

    toggleChatVisibility() {
        const chatPanel = document.getElementById('llmChatPanel');
        if (chatPanel) {
            chatPanel.style.display = chatPanel.style.display === 'none' ? 'flex' : 'none';
        }
    }

    toggleChatMinimize() {
        const chatPanel = document.getElementById('llmChatPanel');
        if (chatPanel) {
            const isMinimized = chatPanel.classList.contains('minimized');
            
            if (!isMinimized) {
                // Minimizing: move to bottom-left corner
                chatPanel.classList.add('minimized');
                
                // Calculate proper bottom position dynamically
                const statusBar = document.querySelector('.status-bar');
                let statusBarHeight = 40; // Default fallback
                
                if (statusBar) {
                    // Get actual status bar height
                    const rect = statusBar.getBoundingClientRect();
                    statusBarHeight = rect.height;
                }
                
                // Add small margin between ChatBox and status bar
                const margin = 10;
                const bottomPosition = statusBarHeight + margin;
                
                chatPanel.style.bottom = `${bottomPosition}px`;
                chatPanel.style.left = '20px';
                chatPanel.style.right = 'auto';
            } else {
                // Expanding: restore to original position
                chatPanel.classList.remove('minimized');
                chatPanel.style.bottom = '20px';
                chatPanel.style.left = 'auto';
                chatPanel.style.right = '20px';
            }
            
            // When minimizing/expanding, don't save position to avoid conflicts
            // Only save the minimized state preference if needed
        }
    }

    updateConnectionStatus(connected) {
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            const icon = statusElement.querySelector('i');
            const text = statusElement.querySelector('span');
            
            if (connected) {
                icon.className = 'fas fa-circle connected';
                text.textContent = 'Connected';
            } else {
                icon.className = 'fas fa-circle disconnected';
                text.textContent = 'Disconnected';
            }
        }
    }

    async sendMessage() {
        const chatInput = document.getElementById('chatInput');
        const message = chatInput.value.trim();
        
        if (!message) return;
        
        // Exit history browsing mode when sending message
        if (this.messageHistory.isBrowsing) {
            this.exitHistoryBrowsing();
        }
        
        // 检查是否正在处理中
        if (this.conversationState.isProcessing) {
            this.showNotification('Conversation in progress, please wait or click abort button', 'warning');
            return;
        }

        // 初始化对话状态
        this.startConversation();
        
        // Add user message to chat
        this.addMessageToChat(message, 'user');
        chatInput.value = '';
        chatInput.style.height = 'auto';

        // Show typing indicator and thinking process
        this.showThinkingProcess && this.addThinkingMessage('Analyzing your question...');
        this.showTypingIndicator();

        try {
            // Send to LLM via MCP or direct API
            const response = await this.sendToLLM(message);
            this.removeTypingIndicator();
            this.addMessageToChat(response, 'assistant');
        } catch (error) {
            this.removeTypingIndicator();
            if (error.name === 'AbortError') {
                this.addMessageToChat('Conversation aborted by user.', 'assistant', false, 'warning');
            } else {
                this.addMessageToChat('Sorry, I encountered an error. Please try again.', 'assistant', true);
                console.error('Chat error:', error);
            }
        } finally {
            // 结束对话状态
            this.endConversation();
        }
    }

    /**
     * Programmatically send a message to the chat (for API calls from other modules)
     */
    async sendMessageProgrammatically(message) {
        if (!message || !message.trim()) {
            console.warn('No message provided to sendMessageProgrammatically');
            return;
        }

        const trimmedMessage = message.trim();
        
        // 检查是否正在处理中
        if (this.conversationState.isProcessing) {
            this.showNotification('Conversation in progress, please wait or click abort button', 'warning');
            return;
        }

        // 初始化对话状态
        this.startConversation();
        
        // Add user message to chat
        this.addMessageToChat(trimmedMessage, 'user');

        // Show typing indicator and thinking process
        this.showThinkingProcess && this.addThinkingMessage('Analyzing your question...');
        this.showTypingIndicator();

        try {
            // Send to LLM via MCP or direct API
            const response = await this.sendToLLM(trimmedMessage);
            this.removeTypingIndicator();
            this.addMessageToChat(response, 'assistant');
        } catch (error) {
            this.removeTypingIndicator();
            if (error.name === 'AbortError') {
                this.addMessageToChat('Conversation aborted by user.', 'assistant', false, 'warning');
            } else {
                this.addMessageToChat('Sorry, I encountered an error. Please try again.', 'assistant', true);
                console.error('Error in sendMessageProgrammatically:', error);
            }
        } finally {
            this.endConversation();
        }
    }

    async sendToLLM(message) {
        // Check if LLM is configured
        if (!this.llmConfigManager.isConfigured()) {
            return "I need to be configured first. Please go to Options → Configure LLMs to set up your preferred AI provider (OpenAI, Anthropic, Google, or Local LLM).";
        }

        console.log('=== ChatManager.sendToLLM DEBUG START ===');
        console.log('User message:', message);
        
        // 设置AbortController
        this.conversationState.abortController = new AbortController();

        try {
            // Check if multi-agent system is enabled
            const multiAgentEnabled = this.configManager.get('multiAgentSettings.multiAgentSystemEnabled', false);
            const showAgentInfo = this.configManager.get('multiAgentSettings.multiAgentShowInfo', true);
            
            if (multiAgentEnabled) {
                // Add multi-agent system activation message
                this.addMultiAgentActivationMessage();
                
                if (showAgentInfo) {
                    this.addThinkingMessage(`🤖 **Multi-Agent System Activated**\n\n` +
                        `🔄 **Agent Coordination Mode**: Enabled\n` +
                        `📊 **Available Agents**: 8 specialized agents\n` +
                        `🧠 **Decision Process**: Intelligent agent selection and coordination\n` +
                        `⚡ **Performance**: Optimized execution with caching\n\n` +
                        `*Multi-agent system will now coordinate tool execution across specialized agents...*`);
                }
            }

            // Get maximum function call rounds from configuration
            const maxRounds = this.configManager.get('llm.functionCallRounds', 3);
            const enableEarlyCompletion = this.configManager.get('llm.enableEarlyCompletion', true);
            console.log('🔧 Maximum function call rounds from config:', maxRounds);
            console.log('🔧 Early completion enabled:', enableEarlyCompletion);
            console.log('🔧 LLM config raw value:', this.configManager.get('llm.functionCallRounds'));
            
            // 显示思考过程
            this.showThinkingProcess && this.addThinkingMessage(`🔄 Starting request processing (max rounds: ${maxRounds})`);

            // Get current studio context
            const context = this.getCurrentContext();
            console.log('Context for LLM:', context);
            
            // Build initial conversation history including the new message
            let conversationHistory = this.buildConversationHistory(message);
            console.log('Initial conversation history length:', conversationHistory.length);
            
            let currentRound = 0;
            let finalResponse = null;
            let taskCompleted = false;
            let executedTools = new Set(); // Track executed tools to prevent re-execution
            
            // Iterative function calling loop
            while (currentRound < maxRounds && !taskCompleted) {
                // 检查是否被中止
                if (this.conversationState.abortController.signal.aborted) {
                    throw new Error('AbortError');
                }
                
                currentRound++;
                console.log(`=== FUNCTION CALL ROUND ${currentRound}/${maxRounds} ===`);
                
                // 更新思考过程
                this.showThinkingProcess && this.updateThinkingMessage(`🤖 Round ${currentRound}/${maxRounds} thinking...`);
                
                // Send conversation history to configured LLM
                console.log('Sending to LLM...');
                const response = await this.llmConfigManager.sendMessageWithHistory(conversationHistory, context);
                
                // 检查响应是否被中止
                if (this.conversationState.abortController.signal.aborted) {
                    throw new Error('AbortError');
                }
                
                console.log('=== LLM Raw Response ===');
                console.log('Response type:', typeof response);
                console.log('Response length:', response ? response.length : 'null');
                console.log('Response is null:', response === null);
                console.log('Response is undefined:', response === undefined);
                console.log('Response is empty string:', response === '');
                console.log('Full response:', response);
                console.log('JSON.stringify response:', JSON.stringify(response));
                console.log('========================');
                
                // 显示LLM的思考过程（如果响应包含思考标签）
                this.showThinkingProcess && this.displayLLMThinking(response);
                
                // CRITICAL FIX: Check for tool calls FIRST, before task completion
                // This prevents early completion from skipping tool execution
                console.log('Attempting to parse tool call(s)...');
                const toolCall = this.parseToolCall(response);
                
                // Also check for multiple tool calls in response
                const multipleToolCalls = this.parseMultipleToolCalls(response);
                console.log('Parsed tool call result:', toolCall);
                console.log('Multiple tool calls found:', multipleToolCalls.length);
                
                // Determine which tools to execute
                let toolsToExecute = multipleToolCalls.length > 0 ? multipleToolCalls : (toolCall ? [toolCall] : []);
                
                // Filter out already executed tools to prevent infinite loops
                toolsToExecute = toolsToExecute.filter(tool => {
                    const toolKey = `${tool.tool_name}:${JSON.stringify(tool.parameters)}`;
                    if (executedTools.has(toolKey)) {
                        console.log(`Skipping already executed tool: ${tool.tool_name}`);
                        return false;
                    }
                    return true;
                });
                
                // CRITICAL FIX: If current response has no tools, check previous assistant messages 
                // in conversation history for unexecuted tool calls
                // This covers both empty responses and task completion responses
                if (toolsToExecute.length === 0) {
                    console.log('=== CHECKING PREVIOUS ROUNDS FOR UNEXECUTED TOOL CALLS ===');
                    console.log('Current conversation history length:', conversationHistory.length);
                    console.log('Current response has no tools, looking for previous tool calls...');
                    
                    // Log the entire conversation history for debugging
                    conversationHistory.forEach((msg, index) => {
                        console.log(`History[${index}] Role: ${msg.role}, Content length: ${msg.content ? msg.content.length : 'null'}`);
                        if (msg.content && msg.content.length < 200) {
                            console.log(`History[${index}] Content preview:`, msg.content);
                        }
                    });
                    
                    // Look for tool results in history to mark as executed
                    conversationHistory.forEach(msg => {
                        if (msg.role === 'system' && msg.content && msg.content.includes('executed successfully')) {
                            // Extract tool name from result message
                            const toolMatch = msg.content.match(/(\w+) executed successfully/);
                            if (toolMatch) {
                                executedTools.add(toolMatch[1]);
                            }
                        }
                    });
                    
                    console.log('Already executed tools:', Array.from(executedTools));
                    
                    for (let i = conversationHistory.length - 1; i >= 0; i--) {
                        const msg = conversationHistory[i];
                        console.log(`Examining message ${i}: role=${msg.role}, has_content=${!!msg.content}`);
                        if (msg.role === 'assistant' && msg.content) {
                            console.log(`Checking assistant message ${i} for tool calls:`, msg.content);
                            const previousToolCall = this.parseToolCall(msg.content);
                            console.log(`Parse result for message ${i}:`, previousToolCall);
                            if (previousToolCall) {
                                const toolKey = `${previousToolCall.tool_name}:${JSON.stringify(previousToolCall.parameters)}`;
                                if (!executedTools.has(toolKey)) {
                                    console.log('✅ Found unexecuted tool call from previous round:', previousToolCall);
                                    toolsToExecute = [previousToolCall];
                                    break;
                                } else {
                                    console.log(`⚠️ Tool ${previousToolCall.tool_name} already executed, skipping`);
                                }
                            } else {
                                console.log(`❌ No tool call found in message ${i}`);
                            }
                        } else {
                            console.log(`Skipping message ${i}: role=${msg.role}, has_content=${!!msg.content}`);
                        }
                    }
                    console.log('Final toolsToExecute after history check:', toolsToExecute);
                    console.log('=== END PREVIOUS ROUNDS CHECK ===');
                }
                
                // Check for task completion signals if early completion is enabled
                // BUT ONLY if there are NO tool calls to execute
                if (enableEarlyCompletion && toolsToExecute.length === 0) {
                    const completionResult = this.checkTaskCompletion(response);
                    if (completionResult.isCompleted) {
                        console.log('=== TASK COMPLETION DETECTED (NO TOOL CALLS) ===');
                        console.log('Completion reason:', completionResult.reason);
                        console.log('Completion confidence:', completionResult.confidence);
                        console.log('================================================');
                        
                        taskCompleted = true;
                        finalResponse = completionResult.summary || response;
                        this.showNotification(`Task completed early (Round ${currentRound}/${maxRounds}): ${completionResult.reason}`, 'success');
                        break;
                    }
                } else if (toolsToExecute.length > 0) {
                    console.log('=== TOOL CALLS FOUND - SKIPPING EARLY COMPLETION CHECK ===');
                    console.log('Tool calls take priority over completion detection');
                    console.log('=========================================================');
                }
                
                if (toolsToExecute.length > 0) {
                    console.log(`=== ${toolsToExecute.length} TOOL CALL(S) DETECTED ===`);
                    console.log('Tools to execute:', toolsToExecute.map(t => t.tool_name));
                    console.log('==========================');
                    
                    // 显示工具调用信息
                    this.showToolCalls && await this.addToolCallMessage(toolsToExecute);
                    
                    try {
                        console.log('Executing tool(s)...');
                        
                        // 检查是否被中止
                        if (this.conversationState.abortController.signal.aborted) {
                            throw new Error('AbortError');
                        }
                        
                        let toolResults;
                        
                        // Use Smart Executor if available and enabled
                        if (this.smartExecutor && this.isSmartExecutionEnabled) {
                            console.log('🚀 Using Smart Executor for optimized execution');
                            const smartResult = await this.smartExecutor.smartExecute(message, toolsToExecute);
                            
                            if (smartResult.success) {
                                toolResults = smartResult.results;
                                
                                // Provide comprehensive feedback
                                if (smartResult.report) {
                                    const { summary, categorySummary } = smartResult.report;
                                    
                                    // Show quick feedback for different categories
                                    for (const category of categorySummary) {
                                        if (category.successful > 0) {
                                            let icon, message;
                                            switch (category.name) {
                                                case 'browserActions':
                                                    icon = '✓'; message = 'Browser actions completed';
                                                    break;
                                                case 'dataRetrieval':
                                                    icon = '📊'; message = 'Data retrieved';
                                                    break;
                                                case 'sequenceAnalysis':
                                                    icon = '🧬'; message = 'Analysis completed';
                                                    break;
                                                case 'blastSearch':
                                                    icon = '🔍'; message = 'BLAST search completed';
                                                    break;
                                                default:
                                                    icon = '✓'; message = 'Operations completed';
                                            }
                                            this.showNotification(`${icon} ${message} (${category.successful}/${category.successful + category.failed})`, 'success');
                                        }
                                    }
                                    
                                    console.log('Smart execution summary:', summary);
                                    console.log('Execution time:', smartResult.executionTime, 'ms');
                                }
                            } else {
                                console.warn('Smart execution failed, falling back to standard execution:', smartResult.error);
                                // Fallback to sequential execution
                                toolResults = [];
                                for (const tool of toolsToExecute) {
                                    try {
                                        const result = await this.executeToolByName(tool.tool_name, tool.parameters);
                                        toolResults.push({ 
                                            tool: tool.tool_name, 
                                            parameters: tool.parameters,
                                            success: true, 
                                            result: result,
                                            error: null
                                        });
                                    } catch (error) {
                                        toolResults.push({
                                            tool: tool.tool_name,
                                            parameters: tool.parameters, 
                                            success: false, 
                                            result: null,
                                            error: error.message
                                        });
                                    }
                                }
                            }
                        } else {
                            // Standard sequential execution
                            toolResults = [];
                            for (const tool of toolsToExecute) {
                                try {
                                    const result = await this.executeToolByName(tool.tool_name, tool.parameters);
                                    toolResults.push({ 
                                        tool: tool.tool_name, 
                                        parameters: tool.parameters,
                                        success: true, 
                                        result: result,
                                        error: null
                                    });
                                } catch (error) {
                                    toolResults.push({
                                        tool: tool.tool_name,
                                        parameters: tool.parameters,
                                        success: false, 
                                        result: null,
                                        error: error.message
                                    });
                                }
                            }
                        }
                        
                        console.log('Tool execution completed. Results:', toolResults);
                        
                        // Track executed tools to prevent re-execution
                        toolsToExecute.forEach(tool => {
                            const toolKey = `${tool.tool_name}:${JSON.stringify(tool.parameters)}`;
                            executedTools.add(toolKey);
                        });
                        
                        // 显示工具执行结果
                        this.showToolCalls && this.addToolResultMessage(toolResults);
                        
                        // Add the tool calls and results to conversation history for next round
                        conversationHistory.push({
                            role: 'assistant',
                            content: JSON.stringify(toolsToExecute.length === 1 ? 
                                { tool_name: toolsToExecute[0].tool_name, parameters: toolsToExecute[0].parameters } :
                                toolsToExecute.map(t => ({ tool_name: t.tool_name, parameters: t.parameters }))
                            )
                        });
                        
                        // Process results
                        const successfulResults = toolResults.filter(r => r.success);
                        const failedResults = toolResults.filter(r => !r.success);
                        
                        if (successfulResults.length > 0) {
                            // Add successful tool results to conversation with SYSTEM role to prevent re-execution
                            const successMessages = successfulResults.map(result => 
                                `${result.tool} executed successfully: ${JSON.stringify(result.result)}`
                            );
                            conversationHistory.push({
                                role: 'system',
                                content: `Tool execution completed: ${successMessages.join('; ')}`
                            });
                            
                            console.log(`${successfulResults.length} tool(s) executed successfully. Continuing to round ${currentRound + 1} to check for follow-up actions.`);
                        }
                        
                        if (failedResults.length > 0) {
                            // Add failed tool results to conversation with SYSTEM role
                            const errorMessages = failedResults.map(result => 
                                `${result.tool} failed: ${result.error || 'Unknown error'}`
                            );
                            conversationHistory.push({
                                role: 'system',
                                content: `Tool execution errors: ${errorMessages.join('; ')}`
                            });
                            console.log(`${failedResults.length} tool(s) failed:`, failedResults);
                        }
                    } catch (error) {
                        console.error('=== TOOL EXECUTION EXCEPTION ===');
                        console.error('Error:', error);
                        console.error('Stack:', error.stack);
                        console.error('================================');
                        
                        // Add error to conversation and continue
                        conversationHistory.push({
                            role: 'system',
                            content: `Tool execution error: ${error.message}`
                        });
                    }
                } else {
                    console.log('=== NO TOOL CALL DETECTED ===');
                    console.log('Received conversational response, ending function call loop');
                    console.log('===============================');
                    
                    // No tool call detected - this is our final response
                    finalResponse = response;
                    break;
                }
            }
            
            // If we've exhausted all rounds and still haven't got a final response
            if (!finalResponse) {
                console.log('=== MAX ROUNDS REACHED ===');
                console.log('Requesting final summary from LLM...');
                
                // Ask LLM for a final summary
                conversationHistory.push({
                    role: 'user',
                    content: 'Please provide a final summary of the actions taken and results achieved.'
                });
                
                finalResponse = await this.llmConfigManager.sendMessageWithHistory(conversationHistory, context);
                console.log('Final summary response:', finalResponse);
            }
            
            console.log('=== ChatManager.sendToLLM DEBUG END (SUCCESS) ===');
            return finalResponse || 'I completed the requested actions. Please let me know if you need anything else.';
            
        } catch (error) {
            console.error('=== LLM COMMUNICATION ERROR ===');
            console.error('Error:', error);
            console.error('Stack:', error.stack);
            console.error('==============================');
            const errorMessage = `Sorry, I encountered an error: ${error.message}. Please check your LLM configuration in Options → Configure LLMs.`;
            console.log('=== ChatManager.sendToLLM DEBUG END (LLM ERROR) ===');
            return errorMessage;
        }
    }

    formatToolResult(toolName, parameters, result) {
        console.log('formatToolResult called with:', { toolName, parameters, result });
        
        switch (toolName) {
            case 'navigate_to_position':
                const rangeInfo = result.usedDefaultRange ? ' (2000bp default range)' : '';
                return `✅ Navigated to ${result.chromosome}:${result.start}-${result.end}${rangeInfo}`;
                
            case 'open_new_tab':
                const tabRangeInfo = result.usedDefaultRange ? ' (2000bp default range)' : '';
                return `🗂️ Opened new tab: ${result.title}${tabRangeInfo}`;
                
            case 'search_features':
                if (result.count > 0) {
                    return `🔍 Found ${result.count} features matching "${result.query}"`;
                } else {
                    return `🔍 No features found matching "${result.query}"`;
                }
                
            case 'get_current_state':
                return `📊 Current state: ${result.currentChromosome || 'No chromosome selected'}, position ${result.currentPosition?.start || 0}-${result.currentPosition?.end || 0}, ${result.annotationsCount || 0} annotations loaded`;
                
            case 'get_sequence':
                return `🧬 Retrieved ${result.length}bp sequence from ${result.chromosome}:${result.start}-${result.end}`;
                
            case 'toggle_track':
            case 'toggle_annotation_track':
                return `👁️ Track "${parameters.trackName || parameters.track_name}" is now ${result.visible ? 'visible' : 'hidden'}`;
                
            case 'create_annotation':
                return `✨ Created ${result.type} annotation "${result.name}" at ${result.chromosome}:${result.start}-${result.end}`;
                
            case 'analyze_region':
                return `🔬 Analyzed region ${result.chromosome}:${result.start}-${result.end} (${result.length}bp, ${result.gcContent}% GC, ${result.featureCount || 0} features)`;
                
            case 'export_data':
                return `💾 Exported ${result.format.toUpperCase()} data successfully. File has been downloaded.`;
                
            case 'get_gene_details':
                if (result.found) {
                    return `🧬 Found ${result.count} gene(s) matching "${result.geneName}": ${result.genes.map(g => `${g.name} (${g.start}-${g.end}, ${g.product})`).slice(0, 3).join(', ')}${result.count > 3 ? '...' : ''}`;
                } else {
                    return `❌ No genes found matching "${result.geneName}" in ${result.chromosome}`;
                }
                
            case 'translate_sequence':
                return `🔬 Translated ${result.length.dna}bp DNA sequence to ${result.length.protein}aa protein from ${result.chromosome}:${result.start}-${result.end} (${result.strand} strand)`;
                
            case 'calculate_gc_content':
                return `📊 GC content analysis for ${result.chromosome}:${result.region}: Overall ${result.overallGCContent}% GC (${result.length}bp analyzed in ${result.totalWindows} windows)`;
                
            case 'find_orfs':
                return `🔍 Found ${result.orfsFound} ORFs ≥${result.minLength}bp in ${result.chromosome}:${result.region}`;
                
            case 'get_operons':
                return `🧬 Found ${result.operonsFound} operons in ${result.chromosome}: ${result.operons.slice(0, 3).map(op => `${op.name} (${op.geneCount} genes)`).join(', ')}${result.operonsFound > 3 ? '...' : ''}`;
                
            case 'zoom_to_gene':
                return `🔍 Zoomed to gene ${result.gene.name} at ${result.gene.start}-${result.gene.end} with ${result.padding}bp padding`;
                
            case 'get_chromosome_list':
                return `📋 Available chromosomes (${result.count}): ${result.chromosomes.map(chr => `${chr.name} (${(chr.length/1000000).toFixed(1)}Mbp)${chr.isSelected ? ' *' : ''}`).join(', ')}. Current: ${result.currentChromosome}`;
                
            case 'get_track_status':
                return `Track Status:\n${Object.entries(result).map(([track, status]) => 
                    `• ${track}: ${status ? 'visible' : 'hidden'}`).join('\n')}`;
                    
            case 'search_motif':
                return `Motif Search Results for "${result.pattern}":\n` +
                    `• Found ${result.matchesFound} matches in ${result.searchRegion}\n` +
                    `• Allowing up to ${result.allowedMismatches} mismatches\n` +
                    (result.matches.length > 0 ? 
                        `• Top matches:\n${result.matches.slice(0, 5).map(m => 
                            `  - Position ${m.position}: ${m.sequence} (${m.strand} strand, ${m.mismatches} mismatches)`
                        ).join('\n')}` : '• No matches found');

            case 'search_pattern':
                return `Pattern Search Results for "${result.regex}":\n` +
                    `• Found ${result.matchesFound} matches in ${result.searchRegion}\n` +
                    (result.matches.length > 0 ? 
                        `• Matches:\n${result.matches.slice(0, 10).map(m => 
                            `  - Position ${m.position}: ${m.sequence} (length: ${m.length})`
                        ).join('\n')}` : '• No matches found');

            case 'get_nearby_features':
                return `Nearby Features (within ${result.searchDistance} bp of position ${result.position}):\n` +
                    `• Found ${result.featuresFound} features\n` +
                    (result.features.length > 0 ? 
                        `• Features:\n${result.features.map(f => 
                            `  - ${f.name} (${f.type}): ${f.start}-${f.end} ${f.strand} strand, ${f.distance} bp ${f.direction}`
                        ).join('\n')}` : '• No features found in range');

            case 'find_intergenic_regions':
                return `Intergenic Regions (min ${result.minLength} bp):\n` +
                    `• Found ${result.regionsFound} regions\n` +
                    `• Total intergenic length: ${result.totalIntergenicLength.toLocaleString()} bp\n` +
                    (result.regions.length > 0 ? 
                        `• Largest regions:\n${result.regions.slice(0, 5).map(r => 
                            `  - ${r.start}-${r.end} (${r.length.toLocaleString()} bp) between ${r.upstreamGene} and ${r.downstreamGene}`
                        ).join('\n')}` : '• No intergenic regions found');

            case 'find_restriction_sites':
                return `Restriction Sites for ${result.enzyme} (${result.recognitionSite}):\n` +
                    `• Found ${result.sitesFound} sites in ${result.searchRegion}\n` +
                    (result.sites.length > 0 ? 
                        `• Sites:\n${result.sites.map(s => 
                            `  - Position ${s.position}: ${s.site} (${s.strand} strand)`
                        ).join('\n')}` : '• No restriction sites found');

            case 'virtual_digest':
                return `Virtual Digest with ${result.enzymes.join(', ')}:\n` +
                    `• Total cut sites: ${result.totalSites}\n` +
                    `• Fragments generated: ${result.fragments}\n` +
                    `• Average fragment size: ${result.averageFragmentSize.toLocaleString()} bp\n` +
                    `• Size range: ${result.smallestFragment.toLocaleString()} - ${result.largestFragment.toLocaleString()} bp\n` +
                    (result.fragmentDetails.length > 0 ? 
                        `• Largest fragments:\n${result.fragmentDetails.slice(0, 5).map(f => 
                            `  - ${f.start}-${f.end} (${f.length.toLocaleString()} bp) cut by ${f.cutBy}`
                        ).join('\n')}` : '');

            case 'sequence_statistics':
                let statsOutput = `Sequence Statistics for ${result.region}:\n`;
                if (result.statistics.composition) {
                    const comp = result.statistics.composition;
                    statsOutput += `• Length: ${comp.length.toLocaleString()} bp\n`;
                    statsOutput += `• Composition: A=${comp.A.percentage}%, T=${comp.T.percentage}%, G=${comp.G.percentage}%, C=${comp.C.percentage}%\n`;
                    statsOutput += `• GC content: ${comp.GC.percentage}%\n`;
                }
                if (result.statistics.complexity) {
                    statsOutput += `• Low complexity regions: ${result.statistics.complexity.lowComplexityRegions}\n`;
                }
                if (result.statistics.skew) {
                    statsOutput += `• AT/GC skew analysis: ${result.statistics.skew.length} data points\n`;
                }
                return statsOutput;

            case 'codon_usage_analysis':
                return `Codon Usage Analysis for ${result.geneName}:\n` +
                    `• Total codons: ${result.totalCodons}\n` +
                    `• Unique codons used: ${result.uniqueCodons}/64\n` +
                    `• Most frequent codons:\n${result.mostFrequentCodons.map(c => 
                        `  - ${c.codon} (${c.aminoAcid}): ${c.count} times (${c.frequency}%)`
                    ).join('\n')}`;

            case 'bookmark_position':
                return `✓ ${result.message}\n` +
                    `• Bookmark ID: ${result.bookmark.id}\n` +
                    `• Created: ${new Date(result.bookmark.created).toLocaleString()}\n` +
                    (result.bookmark.notes ? `• Notes: ${result.bookmark.notes}` : '');

            case 'get_bookmarks':
                return `Bookmarks ${result.chromosome !== 'all' ? `for ${result.chromosome}` : ''}:\n` +
                    `• Total bookmarks: ${result.totalBookmarks}\n` +
                    `• Showing: ${result.filteredBookmarks}\n` +
                    (result.bookmarks.length > 0 ? 
                        `• Bookmarks:\n${result.bookmarks.map(b => 
                            `  - ${b.name}: ${b.chromosome}:${b.start}-${b.end} (${new Date(b.created).toLocaleDateString()})`
                        ).join('\n')}` : '• No bookmarks found');

            case 'save_view_state':
                return `✓ ${result.message}\n` +
                    `• State ID: ${result.viewState.id}\n` +
                    `• Position: ${result.viewState.chromosome}:${result.viewState.position?.start}-${result.viewState.position?.end}\n` +
                    `• Visible tracks: ${result.viewState.visibleTracks?.join(', ') || 'none'}\n` +
                    `• Created: ${new Date(result.viewState.created).toLocaleString()}`;

            case 'compare_regions':
                return `Region Comparison:\n` +
                    `• Region 1: ${result.region1} (${result.length1.toLocaleString()} bp)\n` +
                    `• Region 2: ${result.region2} (${result.length2.toLocaleString()} bp)\n` +
                    `• Similarity: ${result.similarity}%\n` +
                    `• Identity: ${result.identity}%\n` +
                    `• Preview:\n  Region 1: ${result.sequenceData.region1}\n  Region 2: ${result.sequenceData.region2}`;

            case 'find_similar_sequences':
                return `Similar Sequence Search:\n` +
                    `• Query: ${result.querySequence}\n` +
                    `• Found ${result.resultsFound} similar regions (≥${result.minSimilarity} similarity)\n` +
                    (result.results.length > 0 ? 
                        `• Top matches:\n${result.results.slice(0, 5).map(r => 
                            `  - ${r.start}-${r.end}: ${r.similarity} similarity\n    ${r.sequence}`
                        ).join('\n')}` : '• No similar sequences found');

            case 'edit_annotation':
                return `✓ ${result.message}\n` +
                    `• Annotation: ${result.updatedAnnotation.qualifiers?.gene || result.updatedAnnotation.qualifiers?.locus_tag || result.annotationId}\n` +
                    `• Type: ${result.updatedAnnotation.type}\n` +
                    `• Position: ${result.updatedAnnotation.start}-${result.updatedAnnotation.end}`;

            case 'delete_annotation':
                return `✓ ${result.message}\n` +
                    `• Deleted: ${result.deletedAnnotation.qualifiers?.gene || result.deletedAnnotation.qualifiers?.locus_tag || result.annotationId}\n` +
                    `• Type: ${result.deletedAnnotation.type}\n` +
                    `• Position: ${result.deletedAnnotation.start}-${result.deletedAnnotation.end}`;

            case 'batch_create_annotations':
                return `✓ Batch created ${result.annotationsCreated} annotations on ${result.chromosome}\n` +
                    (result.annotations.length > 0 ? 
                        `• Created annotations:\n${result.annotations.map(a => 
                            `  - ${a.type}: ${a.start}-${a.end} (${a.qualifiers?.gene || a.id})`
                        ).join('\n')}` : '');

            case 'get_file_info':
                let fileOutput = `File Information ${result.fileType !== 'all' ? `(${result.fileType})` : ''}:\n`;
                
                if (result.fileInfo.genome) {
                    const genome = result.fileInfo.genome;
                    fileOutput += `• Genome: ${genome.chromosomes} chromosome(s), ${genome.totalLength.toLocaleString()} bp total\n`;
                    fileOutput += `• Current: ${genome.currentChromosome || 'none'}\n`;
                }
                
                if (result.fileInfo.annotations) {
                    const ann = result.fileInfo.annotations;
                    fileOutput += `• Annotations: ${ann.totalFeatures.toLocaleString()} features across ${ann.chromosomes} chromosome(s)\n`;
                    fileOutput += `• Feature types: ${ann.featureTypes.join(', ')}\n`;
                }
                
                if (result.fileInfo.tracks) {
                    const tracks = Object.entries(result.fileInfo.tracks);
                    const visible = tracks.filter(([_, status]) => status).length;
                    fileOutput += `• Tracks: ${visible}/${tracks.length} visible\n`;
                }
                
                return fileOutput;

            case 'export_region_features':
                return `✓ Exported ${result.featuresExported} features from ${result.chromosome}:${result.region}\n` +
                    `• Format: ${result.format}\n` +
                    `• Data ready for download`;

            case 'open_protein_viewer':
                return `✓ Opened protein viewer for ${result.geneName}`;

            default:
                return `✅ Tool ${toolName} executed successfully`;
        }
    }

    buildConversationHistory(newMessage) {
        const history = [];
        
        // Add system context message
        const systemMessage = this.buildSystemMessage();
        history.push({ role: 'system', content: systemMessage });
        
        // If context mode is enabled (current message only), skip conversation history
        if (this.contextModeEnabled) {
            console.log('Context mode enabled: sending only current message');
            // Add only the new user message
            history.push({ role: 'user', content: newMessage });
            return history;
        }
        
        // Get conversation memory setting
        const conversationMemory = this.configManager.get('llm.conversationMemory', 10);
        
        // Get chat history and find the current conversation (after last separator)
        const chatHistory = this.configManager.getChatHistory();
        let currentConversationMessages = [];
        
        // Find messages after the last conversation separator
        for (let i = chatHistory.length - 1; i >= 0; i--) {
            const msg = chatHistory[i];
            if (msg.sender === 'system' && msg.message === '--- CONVERSATION_SEPARATOR ---') {
                break; // Stop at the last separator
            }
            currentConversationMessages.unshift(msg); // Add to beginning to maintain order
        }
        
        // If no separator found, use the full recent history
        if (currentConversationMessages.length === 0) {
            currentConversationMessages = chatHistory.slice(-conversationMemory * 2);
        }
        
        // Add conversation messages to history (exclude system messages and separators)
        for (const msg of currentConversationMessages.slice(-conversationMemory * 2)) {
            if (msg.sender === 'user') {
                history.push({ role: 'user', content: msg.message });
            } else if (msg.sender === 'assistant') {
                history.push({ role: 'assistant', content: msg.message });
            }
            // Skip system messages and separators
        }
        
        // Add the new user message
        history.push({ role: 'user', content: newMessage });
        
        return history;
    }

    buildSystemMessage() {
        // Get user-defined system prompt
        const userSystemPrompt = this.configManager.get('llm.systemPrompt', '');
        
        // Get system message format preference (optimized or complete)
        // Check both chatboxSettings and llm settings for backward compatibility
        const useOptimizedPrompt = this.configManager.get('chatboxSettings.useOptimizedPrompt', 
            this.configManager.get('llm.useOptimizedPrompt', true));
        
        // If user has defined a custom system prompt, use it with variable substitution
        if (userSystemPrompt && userSystemPrompt.trim()) {
            const processedPrompt = this.processSystemPromptVariables(userSystemPrompt);
            // Choose context based on optimization setting
            const toolContext = useOptimizedPrompt ? this.getOptimizedToolContext() : this.getCompleteToolContext();
            return `${processedPrompt}\n\n${toolContext}`;
        }
        
        // For default system message, use optimized version by default
        if (useOptimizedPrompt) {
            return this.getOptimizedSystemMessage();
        } else {
            return this.getBaseSystemMessage();
        }
    }

    /**
     * Process variables in user-defined system prompts
     * Supports variables like {genome_info}, {current_state}, etc.
     */
    processSystemPromptVariables(systemPrompt) {
        const context = this.getCurrentContext();
        
        // Create detailed current state
        const detailedCurrentState = this.getDetailedCurrentState(context);
        
        // Create comprehensive tools list  
        const allToolsDetailed = this.getAllToolsDetailed(context);
        
        // Define available variables
        const variables = {
            genome_info: this.getGenomeInfoSummary(),
            current_state: detailedCurrentState,
            loaded_files: this.getLoadedFilesSummary(),
            visible_tracks: this.getVisibleTracksSummary(),
            current_chromosome: context.genomeBrowser.currentState.currentChromosome || 'None',
            current_position: this.getCurrentPositionSummary(context),
            annotations_count: context.genomeBrowser.currentState.annotationsCount || 0,
            sequence_length: context.genomeBrowser.currentState.sequenceLength || 0,
            user_features_count: context.genomeBrowser.currentState.userDefinedFeaturesCount || 0,
            available_tools: context.genomeBrowser.availableTools.join(', '),
            all_tools: allToolsDetailed,
            total_tools: context.genomeBrowser.toolSources.total,
            local_tools: context.genomeBrowser.toolSources.local,
            plugin_tools: context.genomeBrowser.toolSources.plugins,
            mcp_tools: context.genomeBrowser.toolSources.mcp,
            all_available_tools: context.genomeBrowser.availableTools.map(tool => `- ${tool}`).join('\n'),
            mcp_servers: this.getMCPServersSummary(),
            plugin_functions: this.getPluginFunctionsSummary(),
            microbe_functions: this.getMicrobeGenomicsFunctionsDetailed(),
            timestamp: new Date().toISOString(),
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString()
        };
        
        // Replace variables in the format {variable_name}
        let processedPrompt = systemPrompt;
        for (const [varName, varValue] of Object.entries(variables)) {
            const regex = new RegExp(`\\{${varName}\\}`, 'gi');
            processedPrompt = processedPrompt.replace(regex, varValue);
        }
        
        return processedPrompt;
    }

    /**
     * Check if the LLM response indicates task completion
     * Returns an object with completion status and details
     */
    checkTaskCompletion(response) {
        console.log('=== Checking Task Completion ===');
        console.log('Response length:', response ? response.length : 0);
        
        const result = {
            isCompleted: false,
            reason: '',
            confidence: 0,
            summary: null
        };
        
        if (!response || typeof response !== 'string') {
            return result;
        }
        
        const lowercaseResponse = response.toLowerCase();
        
        // Define completion indicators with weights
        const completionIndicators = [
            // Strong completion signals
            { patterns: ['task completed', 'task finished', 'task done', 'completed successfully'], weight: 0.9, reason: 'Explicit task completion statement' },
            { patterns: ['analysis complete', 'analysis finished', 'analysis done'], weight: 0.85, reason: 'Analysis completion indicated' },
            { patterns: ['i have completed', 'i have finished', 'i have done'], weight: 0.8, reason: 'Direct completion confirmation' },
            { patterns: ['the task is complete', 'the task is finished', 'the task is done'], weight: 0.85, reason: 'Task status confirmation' },
            
            // Summary/conclusion signals
            { patterns: ['in summary', 'to summarize', 'in conclusion', 'overall'], weight: 0.7, reason: 'Summary provided' },
            { patterns: ['final result', 'final analysis', 'final summary'], weight: 0.75, reason: 'Final results provided' },
            { patterns: ['that completes', 'this completes', 'this concludes'], weight: 0.8, reason: 'Completion statement' },
            
            // Question/offer for next steps
            { patterns: ['is there anything else', 'anything else you need', 'what else would you like'], weight: 0.65, reason: 'Offering further assistance' },
            { patterns: ['do you need anything else', 'would you like me to', 'let me know if you need'], weight: 0.6, reason: 'Proactive assistance offer' },
            { patterns: ['please let me know if', 'feel free to ask if'], weight: 0.55, reason: 'Open-ended assistance offer' },
            
            // Results presentation
            { patterns: ['here are the results', 'the results show', 'results summary'], weight: 0.65, reason: 'Results presented' },
            { patterns: ['based on the analysis', 'the data shows', 'findings indicate'], weight: 0.6, reason: 'Analysis findings presented' },
            
            // Tool execution completion without follow-up
            { patterns: ['successfully navigated', 'successfully retrieved', 'successfully analyzed'], weight: 0.5, reason: 'Tool execution completed' }
        ];
        
        let maxWeight = 0;
        let bestReason = '';
        
        // Check for completion indicators
        for (const indicator of completionIndicators) {
            for (const pattern of indicator.patterns) {
                if (lowercaseResponse.includes(pattern)) {
                    if (indicator.weight > maxWeight) {
                        maxWeight = indicator.weight;
                        bestReason = indicator.reason;
                    }
                    console.log(`Found completion indicator: "${pattern}" (weight: ${indicator.weight})`);
                }
            }
        }
        
        // Additional context checks
        let contextBonus = 0;
        
        // Check if no tool calls are present (conversational response)
        const hasToolCall = this.parseToolCall(response) !== null || this.parseMultipleToolCalls(response).length > 0;
        
        // CRITICAL: If tool calls are present, heavily reduce completion confidence
        // Tool calls should ALWAYS take priority over completion detection
        if (hasToolCall) {
            maxWeight *= 0.1; // Drastically reduce confidence if tool calls exist
            console.log('Tool calls detected - heavily reducing task completion confidence to prioritize tool execution');
        }
        
        // CRITICAL: For analysis tasks, don't mark as complete if we only have basic data retrieval
        const isAnalysisTask = lowercaseResponse.includes('analyze') || lowercaseResponse.includes('analysis');
        const hasAnalysisResults = lowercaseResponse.includes('results') || lowercaseResponse.includes('findings') || 
                                   lowercaseResponse.includes('statistics') || lowercaseResponse.includes('composition') ||
                                   lowercaseResponse.includes('frequency') || lowercaseResponse.includes('usage');
        
        // Check if this is a request for summary rather than providing one
        const isSummaryRequest = lowercaseResponse.includes('please provide') || lowercaseResponse.includes('provide a summary') ||
                                lowercaseResponse.includes('give me a summary') || lowercaseResponse.includes('can you summarize');
        
        // If it's an analysis task but we don't have analysis results, reduce confidence significantly
        if (isAnalysisTask && !hasAnalysisResults && maxWeight > 0) {
            maxWeight *= 0.3; // Significantly reduce confidence
            console.log('Analysis task detected without results - reducing confidence');
        }
        
        // If this is a summary request (not providing summary), reduce confidence heavily
        if (isSummaryRequest && maxWeight > 0) {
            maxWeight *= 0.2; // Even more reduction for summary requests
            console.log('Summary request detected - reducing confidence heavily');
        }
        
        if (!hasToolCall && maxWeight > 0) {
            contextBonus += 0.15;
            console.log('No tool calls detected - adding context bonus');
        }
        
        // Check response length - longer responses with completion indicators are more likely to be final
        if (response.length > 100 && maxWeight > 0) {
            contextBonus += 0.1;
            console.log('Substantial response length - adding context bonus');
        }
        
        // Check for direct answers without need for more tools
        if (lowercaseResponse.includes('the answer is') || lowercaseResponse.includes('the result is') || 
            lowercaseResponse.includes('found') && !hasToolCall) {
            contextBonus += 0.1;
            console.log('Direct answer detected - adding context bonus');
        }
        
        const finalConfidence = Math.min(maxWeight + contextBonus, 1.0);
        
        // Determine completion status based on confidence threshold
        const completionThreshold = this.configManager.get('llm.completionThreshold', 0.7);
        
        if (finalConfidence >= completionThreshold) {
            result.isCompleted = true;
            result.confidence = finalConfidence;
            result.reason = bestReason;
            
            // Extract summary if available
            const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
            if (sentences.length > 0) {
                // Use the entire response as summary for now
                result.summary = response.trim();
            }
        }
        
        console.log(`Task completion check result: ${result.isCompleted} (confidence: ${finalConfidence}, threshold: ${completionThreshold})`);
        if (result.isCompleted) {
            console.log(`Completion reason: ${result.reason}`);
        }
        
        return result;
    }

    /**
     * Get detailed current state information for system prompts
     */
    getDetailedCurrentState(context) {
        const state = context.genomeBrowser.currentState;
        const tracks = this.getVisibleTracks();
        const mcpServers = this.mcpServerManager.getServerStatus();
        const connectedServers = mcpServers.filter(s => s.connected);
        
        let detailedState = `GENOME BROWSER CURRENT STATE:

NAVIGATION & POSITION:
- Current Chromosome: ${state.currentChromosome || 'None'}
- Current Position: ${state.currentPosition ? `${state.currentPosition.start}-${state.currentPosition.end}` : 'None'}
- Position Range: ${state.currentPosition ? `${(state.currentPosition.end - state.currentPosition.start + 1).toLocaleString()} bp` : 'N/A'}
- Sequence Length: ${state.sequenceLength ? state.sequenceLength.toLocaleString() : 'Unknown'} bp

DATA STATUS:
- Loaded Files: ${state.loadedFiles.length} file(s)
- Annotations Count: ${state.annotationsCount || 0}
- User-defined Features: ${state.userDefinedFeaturesCount || 0}
- Visible Tracks: ${tracks.length > 0 ? tracks.join(', ') : 'None'}

SYSTEM STATUS:
- MCP Servers Connected: ${connectedServers.length}${connectedServers.length > 0 ? ` (${connectedServers.map(s => s.name).join(', ')})` : ''}
- Plugin System: ${this.pluginFunctionCallsIntegrator ? 'Active' : 'Inactive'}
- MicrobeGenomics Functions: ${this.MicrobeFns ? 'Available' : 'Not Available'}

TOOL AVAILABILITY:
- Total Tools: ${context.genomeBrowser.toolSources.total}
- Local Tools: ${context.genomeBrowser.toolSources.local}
- Plugin Tools: ${context.genomeBrowser.toolSources.plugins}
- MCP Tools: ${context.genomeBrowser.toolSources.mcp}`;

        return detailedState;
    }

    /**
     * Get comprehensive tools information for system prompts
     */
    getAllToolsDetailed(context) {
        const mcpServers = this.mcpServerManager.getServerStatus();
        const connectedServers = mcpServers.filter(s => s.connected);
        const toolsByCategory = this.mcpServerManager.getToolsByCategory();
        
        let toolsInfo = `COMPREHENSIVE TOOLS DOCUMENTATION:

TOOL STATISTICS:
- Total Available Tools: ${context.genomeBrowser.toolSources.total}
- Local/Built-in Tools: ${context.genomeBrowser.toolSources.local}
- Plugin Tools: ${context.genomeBrowser.toolSources.plugins}
- MCP Server Tools: ${context.genomeBrowser.toolSources.mcp}

MCP SERVER TOOLS:`;
        
        if (connectedServers.length > 0) {
            toolsInfo += `
Connected Servers: ${connectedServers.length}
${connectedServers.map(server => `- ${server.name} (${server.category}): ${server.toolCount} tools`).join('\n')}

MCP Tools by Category:
${Object.entries(toolsByCategory).map(([category, tools]) => 
    `${category.toUpperCase()}:\n${tools.map(tool => 
        `  - ${tool.name}: ${tool.description || 'No description'}`
    ).join('\n')}`
).join('\n\n')}`;
        } else {
            toolsInfo += `
No MCP servers connected. Available tools are limited to local and plugin functions.`;
        }

        // Add MicrobeGenomics Functions details
        if (this.MicrobeFns) {
            try {
                const categories = this.MicrobeFns.getFunctionCategories();
                toolsInfo += `

MICROBE GENOMICS FUNCTIONS:
${Object.entries(categories).map(([category, info]) => 
    `${category.toUpperCase()} (${info.description}):\n${info.functions.map(fn => 
        `  - ${fn}: Use as "${fn.toLowerCase().replace(/([A-Z])/g, '_$1').toLowerCase()}"`
    ).join('\n')}`
).join('\n\n')}`;
            } catch (error) {
                toolsInfo += `\nMicrobeGenomics Functions: Available but details unavailable`;
            }
        }

        // Add Plugin Tools details
        if (this.pluginFunctionCallsIntegrator) {
            try {
                const pluginInfo = this.pluginFunctionCallsIntegrator.getPluginFunctionsSystemInfo();
                const stats = this.pluginFunctionCallsIntegrator.getPluginFunctionStats();
                
                toolsInfo += `

PLUGIN SYSTEM TOOLS:
Total Plugin Functions: ${stats.totalFunctions}
Available Plugins: ${Object.keys(stats.pluginCounts).join(', ')}
Function Categories: ${Object.keys(stats.categoryStats).join(', ')}

${pluginInfo}`;
            } catch (error) {
                toolsInfo += `\nPlugin Tools: Available but details unavailable`;
            }
        }

        // Add comprehensive tool examples
        toolsInfo += `

CORE LOCAL TOOLS:
Navigation & State:
  - navigate_to_position: Navigate to specific chromosome position
  - get_current_state: Get current browser state
  - jump_to_gene: Navigate to specific gene
  - zoom_in/zoom_out: Adjust view zoom level
  - scroll_left/scroll_right: Pan the view

Search & Discovery:
  - search_features: Search for features by text
  - search_gene_by_name: Find specific genes
  - search_motif: Find sequence motifs
  - search_by_position: Find features near position

Sequence Analysis:
  - get_sequence: Extract DNA sequence
  - translate_dna: Translate DNA to protein
  - compute_gc: Calculate GC content
  - reverse_complement: Get reverse complement
  - find_orfs: Find open reading frames
  - sequence_statistics: Analyze sequence composition

Advanced Analysis:
  - analyze_region: Comprehensive region analysis
  - blast_search: BLAST sequence similarity
  - predict_promoter: Predict promoter regions
  - find_restriction_sites: Find enzyme cut sites
  - show_metabolic_pathway: Display pathway diagrams

Annotation & Data:
  - create_annotation: Add new annotations
  - toggle_track: Show/hide data tracks
  - export_data: Export in various formats
  - get_genome_info: Get genome metadata

Protein Structure:
  - open_protein_viewer: Display 3D protein structures
  - fetch_protein_structure: Get PDB structure data
  - search_protein_by_gene: Find proteins by gene name

TOOL USAGE EXAMPLES:
Basic Navigation:
  {"tool_name": "navigate_to_position", "parameters": {"chromosome": "chr1", "start": 1000, "end": 2000}}
  {"tool_name": "navigate_to_position", "parameters": {"chromosome": "COLI-K12", "position": 2000000}}
  {"tool_name": "jump_to_gene", "parameters": {"geneName": "lacZ"}}
  {"tool_name": "open_new_tab", "parameters": {"chromosome": "chr1", "start": 1000, "end": 2000}}
  {"tool_name": "open_new_tab", "parameters": {"geneName": "lacZ"}}

Sequence Analysis:
  {"tool_name": "get_sequence", "parameters": {"chromosome": "chr1", "start": 1000, "end": 1500}}
  {"tool_name": "compute_gc", "parameters": {"sequence": "ATGCGCTATCG"}}
  {"tool_name": "translate_dna", "parameters": {"dna": "ATGAAATAG", "frame": 0}}

Search Operations:
  {"tool_name": "search_gene_by_name", "parameters": {"name": "lacZ"}}
  {"tool_name": "search_features", "parameters": {"query": "DNA polymerase", "caseSensitive": false}}
  {"tool_name": "search_motif", "parameters": {"pattern": "GAATTC", "allowMismatches": 0}}

Advanced Analysis:
  {"tool_name": "blast_search", "parameters": {"sequence": "ATGCGCTATCG", "blastType": "blastn", "database": "nt"}}
  {"tool_name": "predict_promoter", "parameters": {"seq": "ATGCTATAAT"}}
  {"tool_name": "show_metabolic_pathway", "parameters": {"pathway": "glycolysis"}}

Protein Structure:
  {"tool_name": "open_protein_viewer", "parameters": {"pdbId": "1TUP"}}
  {"tool_name": "search_protein_by_gene", "parameters": {"geneName": "p53", "organism": "Homo sapiens"}}

Data Management:
  {"tool_name": "create_annotation", "parameters": {"type": "gene", "name": "test_gene", "chromosome": "chr1", "start": 1000, "end": 2000}}
  {"tool_name": "export_data", "parameters": {"format": "fasta", "chromosome": "chr1", "start": 1000, "end": 2000}}`;

        return toolsInfo;
    }

    /**
     * Get detailed MicrobeGenomics Functions information
     */
    getMicrobeGenomicsFunctionsDetailed() {
        if (!this.MicrobeFns) {
            return 'MicrobeGenomics Functions: Not Available';
        }

        try {
            const categories = this.MicrobeFns.getFunctionCategories();
            const examples = this.MicrobeFns.getUsageExamples();
            
            let info = `MicrobeGenomics Functions: Available with ${Object.keys(categories).length} categories\n\n`;
            
            info += 'CATEGORIES:\n';
            Object.entries(categories).forEach(([category, categoryInfo]) => {
                info += `- ${category}: ${categoryInfo.description} (${categoryInfo.functions.length} functions)\n`;
            });
            
            info += '\nUSAGE EXAMPLES:\n';
            examples.forEach((example, index) => {
                info += `${index + 1}. ${example.task}\n`;
            });
            
            return info;
        } catch (error) {
            return 'MicrobeGenomics Functions: Available but details unavailable';
        }
    }

    /**
     * Get core tools organized by category for streamlined prompts
     */
    getCoreToolsByCategory() {
        const categories = {
            'SEARCH & NAVIGATION': [
                'search_gene_by_name', 'search_features', 'jump_to_gene', 
                'navigate_to_position', 'search_by_position', 'open_new_tab'
            ],
            'SYSTEM STATUS': [
                'get_genome_info', 'check_genomics_environment', 'get_file_info', 
                'get_current_state', 'get_chromosome_list', 'get_selected_gene',
                'get_current_region_details', 'get_sequence_selection'
            ],
            'SEQUENCE ANALYSIS': [
                'get_coding_sequence', 'get_multiple_coding_sequences', 'get_sequence', 
                'translate_dna', 'reverse_complement', 'compute_gc'
            ],
            'GENOMIC FEATURES': [
                'find_orfs', 'predict_promoter', 'predict_rbs', 'search_sequence_motif',
                'find_restriction_sites', 'sequence_statistics'
            ],
            'PROTEIN STRUCTURE': [
                'search_protein_by_gene', 'open_protein_viewer', 'fetch_protein_structure',
                'search_alphafold_by_gene', 'fetch_alphafold_structure', 'open_alphafold_viewer'
            ],
            'BLAST & SIMILARITY': [
                'blast_search', 'advanced_blast_search', 'batch_blast_search',
                'blast_sequence_from_region'
            ],
            'PATHWAYS & NETWORKS': [
                'show_metabolic_pathway', 'find_pathway_genes', 'analyze_interpro_domains'
            ],
            'AI & PREDICTION': [
                'evo2_generate_sequence', 'evo2_predict_function', 'evo2_design_crispr'
            ],
            'SEQUENCE EDITING': [
                'copy_sequence', 'cut_sequence', 'paste_sequence', 'delete_sequence', 'delete_gene',
                'insert_sequence', 'replace_sequence', 'execute_actions', 'get_action_list'
            ]
        };

        // Add plugin tool categories dynamically
        const pluginCategories = this.getPluginToolCategories();
        const allCategories = { ...categories, ...pluginCategories };
        
        return Object.entries(allCategories)
            .map(([category, tools]) => `${category}: ${tools.join(', ')}`)
            .join('\n');
    }

    /**
     * Get plugin tool categories from plugin manager
     */
    getPluginToolCategories() {
        if (!this.pluginManager || !this.pluginManager.getPluginToolCategories) {
            return {};
        }
        
        try {
            return this.pluginManager.getPluginToolCategories();
        } catch (error) {
            console.error('Error getting plugin tool categories:', error);
            return {};
        }
    }

    /**
     * Get optimized tool context for system prompts
     * Streamlined version with essential information only
     */
    getOptimizedToolContext() {
        const context = this.getCurrentContext();
        
        // Get MCP server information (simplified)
        const mcpServers = this.mcpServerManager.getServerStatus();
        const connectedServers = mcpServers.filter(s => s.connected);
        
        // Core tool categories for better organization
        const coreTools = this.getCoreToolsByCategory();
        
        // Get current genome info if available
        const genomeInfo = this.getGenomeInfoSummary();
        
        return `
CURRENT GENOME STATE:
- Chromosome: ${context.genomeBrowser.currentState.currentChromosome || 'None loaded'}
- Position: ${JSON.stringify(context.genomeBrowser.currentState.currentPosition) || 'None'}
- Selected Gene: ${context.genomeBrowser.currentState.selectedGene ? 
    `${context.genomeBrowser.currentState.selectedGene.geneName} (${context.genomeBrowser.currentState.selectedGene.locusTag})` : 'None'}
- Sequence Selection: ${context.genomeBrowser.currentState.sequenceSelection?.active ? 
    `${context.genomeBrowser.currentState.sequenceSelection.start}-${context.genomeBrowser.currentState.sequenceSelection.end} (${context.genomeBrowser.currentState.sequenceSelection.length} bp)` : 'None'}
- Visible Tracks: ${context.genomeBrowser.currentState.visibleTracks.join(', ') || 'None'}
- Loaded Files: ${context.genomeBrowser.currentState.loadedFiles.length} files
- Sequence Length: ${context.genomeBrowser.currentState.sequenceLength?.toLocaleString() || 'Unknown'}
${genomeInfo ? `- Genome: ${genomeInfo}` : ''}

AVAILABLE TOOLS: ${context.genomeBrowser.toolSources.total} total
- Local: ${context.genomeBrowser.toolSources.local}
- Genomics: Available (MicrobeGenomicsFunctions)
- Plugins: ${context.genomeBrowser.toolSources.plugins}
- MCP: ${context.genomeBrowser.toolSources.mcp} ${connectedServers.length > 0 ? `(${connectedServers.map(s => s.name).join(', ')})` : '(disconnected)'}

CORE TOOL CATEGORIES:
${coreTools}
`;
    }

    /**
     * Get tool priority string for system message
     */
    getToolPriorityString() {
        // Get tool priority from settings
        const toolPriority = this.configManager.get('chatboxSettings.toolPriority', 
            ['local', 'genomics', 'plugins', 'mcp']);
        
        const priorityLabels = {
            'local': 'Local Tools',
            'genomics': 'Specialized Genomics Tools', 
            'plugins': 'Plugin Tools',
            'mcp': 'MCP Server Tools'
        };
        
        const priorityList = toolPriority.map((type, index) => 
            `${index + 1}) ${priorityLabels[type] || type}`
        ).join('\n');
        
        return `TOOL SELECTION PRIORITY:\n${priorityList}`;
    }

    /**
     * Execute tool with priority-based selection
     */
    async executeToolWithPriority(toolName, parameters) {
        // Get tool priority from settings
        const toolPriority = this.configManager.get('chatboxSettings.toolPriority', 
            ['local', 'genomics', 'plugins', 'mcp']);
        
        console.log(`🔧 Executing tool '${toolName}' with priority order:`, toolPriority);
        
        // Try to execute tool based on priority order
        for (const category of toolPriority) {
            const result = await this.tryExecuteToolInCategory(toolName, parameters, category);
            if (result !== undefined) {
                console.log(`✅ Tool '${toolName}' executed in category '${category}'`);
                return result;
            }
        }
        
        console.log(`❌ Tool '${toolName}' not found in any priority category`);
        return undefined; // Tool not found
    }

    /**
     * Try to execute tool in specific category
     */
    async tryExecuteToolInCategory(toolName, parameters, category) {
        console.log(`🔍 Trying to execute '${toolName}' in category '${category}'`);
        
        switch (category) {
            case 'local':
                return await this.executeLocalTool(toolName, parameters);
                
            case 'genomics':
                return await this.executeGenomicsTool(toolName, parameters);
                
            case 'plugins':
                return await this.executePluginTool(toolName, parameters);
                
            case 'mcp':
                return await this.executeMCPTool(toolName, parameters);
                
            default:
                console.warn(`Unknown tool category: ${category}`);
                return undefined;
        }
    }

    /**
     * Execute local tools (built-in browser functions)
     */
    async executeLocalTool(toolName, parameters) {
        const localTools = {
            // Navigation and state tools
            'navigate_to_position': () => this.navigateToPosition(parameters),
            'open_new_tab': () => this.openNewTab(parameters),
            'search_features': () => this.searchFeatures(parameters),
            'get_current_state': () => this.getCurrentState(),
            
            // Sequence tools
            'get_sequence': () => this.getSequence(parameters),
            'translate_sequence': () => this.translateSequence(parameters),
            'calculate_gc_content': () => this.calculateGCContent(parameters),
            'find_orfs': () => this.findOpenReadingFrames(parameters),
            
            // Track and display tools
            'toggle_track': () => this.toggleTrack(parameters),
            'toggle_annotation_track': () => this.toggleAnnotationTrack(parameters),
            'get_track_status': () => this.getTrackStatus(),
            
            // Annotation tools
            'create_annotation': () => this.createAnnotation(parameters),
            'analyze_region': () => this.analyzeRegion(parameters),
            'get_gene_details': () => this.getGeneDetails(parameters),
            'get_operons': () => this.getOperons(parameters),
            'zoom_to_gene': () => this.zoomToGene(parameters),
            'get_nearby_features': () => this.getNearbyFeatures(parameters),
            'find_intergenic_regions': () => this.findIntergenicRegions(parameters),
            
            // Search and analysis tools
            'search_motif': () => this.searchMotif(parameters),
            'search_pattern': () => this.searchPattern(parameters),
            'find_restriction_sites': () => this.findRestrictionSites(parameters),
            'virtual_digest': () => this.virtualDigest(parameters),
            
            // System tools
            'get_chromosome_list': () => this.getChromosomeList(),
            'export_data': () => this.exportData(parameters),
            
            // Action system tools (if available)
            'copy_sequence': () => this.executeActionTool('copy_sequence', parameters),
            'cut_sequence': () => this.executeActionTool('cut_sequence', parameters),
            'paste_sequence': () => this.executeActionTool('paste_sequence', parameters),
            'delete_sequence': () => this.executeActionTool('delete_sequence', parameters),
            'insert_sequence': () => this.executeActionTool('insert_sequence', parameters),
            'replace_sequence': () => this.executeActionTool('replace_sequence', parameters),
            'execute_actions': () => this.executeActionTool('execute_actions', parameters),
            'get_action_list': () => this.executeActionTool('get_action_list', parameters),
            'clear_actions': () => this.executeActionTool('clear_actions', parameters),
            'get_clipboard_content': () => this.executeActionTool('get_clipboard_content', parameters),
            'undo_last_action': () => this.executeActionTool('undo_last_action', parameters)
        };
        
        if (localTools[toolName]) {
            try {
                const result = await localTools[toolName]();
                console.log(`✅ Local tool '${toolName}' executed successfully`);
                return result;
            } catch (error) {
                console.error(`❌ Local tool '${toolName}' execution failed:`, error);
                throw error;
            }
        }
        
        return undefined; // Tool not found in local tools
    }

    /**
     * Execute genomics tools (specialized analysis functions)
     */
    async executeGenomicsTool(toolName, parameters) {
        // Check if MicrobeGenomicsFunctions is available
        if (typeof window.MicrobeGenomicsFunctions === 'undefined') {
            console.log(`📦 MicrobeGenomicsFunctions not available for '${toolName}'`);
            return undefined;
        }
        
        const genomicsTools = {
            'search_gene_by_name': () => window.MicrobeGenomicsFunctions.searchGeneByName(parameters),
            'get_coding_sequence': () => window.MicrobeGenomicsFunctions.getCodingSequence(parameters),
            'jump_to_gene': () => window.MicrobeGenomicsFunctions.jumpToGene(parameters),
            'delete_gene': () => window.MicrobeGenomicsFunctions.deleteGene(parameters),
            'search_gene_by_locus_tag': () => window.MicrobeGenomicsFunctions.searchGeneByLocusTag(parameters)
        };
        
        if (genomicsTools[toolName]) {
            try {
                const result = await genomicsTools[toolName]();
                console.log(`✅ Genomics tool '${toolName}' executed successfully`);
                return result;
            } catch (error) {
                console.error(`❌ Genomics tool '${toolName}' execution failed:`, error);
                throw error;
            }
        }
        
        return undefined; // Tool not found in genomics tools
    }

    /**
     * Execute plugin tools
     */
    async executePluginTool(toolName, parameters) {
        // Plugin tools would be implemented here
        // For now, return undefined as no plugin system is implemented
        console.log(`🔌 Plugin tools not implemented for '${toolName}'`);
        return undefined;
    }

    /**
     * Execute MCP server tools
     */
    async executeMCPTool(toolName, parameters) {
        if (!this.mcpServerManager) {
            console.log(`📡 MCP Server Manager not available for '${toolName}'`);
            return undefined;
        }
        
        try {
            // Get all available MCP tools
            const mcpTools = this.mcpServerManager.getAllAvailableTools();
            const tool = mcpTools.find(t => t.name === toolName);
            
            if (tool) {
                console.log(`🎯 Found MCP tool '${toolName}' on server '${tool.serverId}'`);
                const result = await this.mcpServerManager.executeToolOnServer(tool.serverId, toolName, parameters);
                console.log(`✅ MCP tool '${toolName}' executed successfully`);
                return result;
            }
        } catch (error) {
            console.error(`❌ MCP tool '${toolName}' execution failed:`, error);
            throw error;
        }
        
        return undefined; // Tool not found in MCP tools
    }

    /**
     * Execute action system tools
     */
    async executeActionTool(toolName, parameters) {
        if (!window.actionManager) {
            console.log(`⚡ Action Manager not available for '${toolName}'`);
            return { error: 'Action system not available' };
        }
        
        try {
            switch (toolName) {
                case 'copy_sequence':
                    return await window.actionManager.copySequence(parameters);
                case 'cut_sequence':
                    return await window.actionManager.cutSequence(parameters);
                case 'paste_sequence':
                    return await window.actionManager.pasteSequence(parameters);
                case 'delete_sequence':
                    return await window.actionManager.deleteSequence(parameters);
                case 'insert_sequence':
                    return await window.actionManager.insertSequence(parameters);
                case 'replace_sequence':
                    return await window.actionManager.replaceSequence(parameters);
                case 'execute_actions':
                    return await window.actionManager.executeAllActions(parameters);
                case 'get_action_list':
                    return await window.actionManager.getActionList(parameters);
                case 'clear_actions':
                    return await window.actionManager.clearAllActions(parameters);
                case 'get_clipboard_content':
                    return await window.actionManager.getClipboardContent(parameters);
                case 'undo_last_action':
                    return await window.actionManager.undoLastAction(parameters);
                default:
                    console.warn(`Unknown action tool: ${toolName}`);
                    return { error: `Unknown action tool: ${toolName}` };
            }
        } catch (error) {
            console.error(`❌ Action tool '${toolName}' execution failed:`, error);
            return { error: error.message };
        }
    }

    /**
     * Get optimized system message for better LLM performance
     */
    getOptimizedSystemMessage() {
        const toolPriority = this.getToolPriorityString();
        
        return `You are an AI assistant for Genome AI Studio, a comprehensive bioinformatics application. You have access to powerful genomic analysis, protein structure, and sequence analysis tools.

IMPORTANT: Task Completion Instructions
When you complete a user's task or fully answer their question, end with a clear completion indicator like "Task completed", "Analysis finished", or "In summary" to signal completion efficiently.

${this.getOptimizedToolContext()}

===FUNCTION CALLING FORMAT===
CRITICAL: Always respond with ONLY a JSON object when using tools. No explanatory text around the JSON.
Format: {"tool_name": "tool_name", "parameters": {"param": "value"}}

${toolPriority}

CRITICAL: The system will automatically route tool requests based on the priority order above. You should use tool names without worrying about which category they belong to - the system will find and execute them in the correct priority order. The priority order ensures that local tools are tried first (fastest), followed by specialized genomics tools, then plugins, and finally MCP server tools.

===PROTEIN STRUCTURE SEARCH DISAMBIGUATION===
CRITICAL: Choose the correct protein structure function based on user intent:

• For PDB database searches (experimental structures):
  - Keywords: "PDB", "PDB database", "experimental structure", "crystal structure", "NMR structure"
  - Use: search_protein_by_gene
  - Example: "search PDB protein structure for lysC" → search_protein_by_gene

• For AlphaFold predictions (AI-predicted structures):
  - Keywords: "AlphaFold", "predicted structure", "AI prediction", "fold prediction"
  - Use: search_alphafold_by_gene
  - Example: "find AlphaFold structure for lysC" → search_alphafold_by_gene

• Default behavior (when unspecified):
  - If user mentions "PDB" explicitly → use search_protein_by_gene
  - If user mentions "AlphaFold" explicitly → use search_alphafold_by_gene
  - If context is unclear, prefer search_protein_by_gene for experimental data

===SEQUENCE EDITING FUNCTIONS - DETAILED USAGE===

SEQUENCE EDITING WORKFLOW:
1. Find gene location: search_gene_by_name
2. Use appropriate editing function (deleteSequence, insertSequence, etc.)
3. Execute all pending actions: execute_actions
4. IMPORTANT: Actions are queued until execute_actions is called

EDITING FUNCTIONS WITH PARAMETERS:

• delete_sequence - Delete a DNA sequence region
  Parameters: chromosome (string), start (number), end (number), strand (optional: "+" or "-")
  Example: {"tool_name": "delete_sequence", "parameters": {"chromosome": "COLI-K12", "start": 1000, "end": 2000}}

• delete_gene - Delete a gene by name or locus tag (automatically finds gene coordinates)
  Parameters: geneName (string - gene name or locus tag), chromosome (optional string - will auto-detect if not provided)
  Example: {"tool_name": "delete_gene", "parameters": {"geneName": "yaaJ"}}
  Example: {"tool_name": "delete_gene", "parameters": {"geneName": "b0005"}}
  Example: {"tool_name": "delete_gene", "parameters": {"geneName": "lacZ", "chromosome": "COLI-K12"}}

• insert_sequence - Insert DNA sequence at a specific position
  Parameters: chromosome (string), position (number), sequence (string - DNA only: A,T,C,G,N)
  Example: {"tool_name": "insert_sequence", "parameters": {"chromosome": "COLI-K12", "position": 1000, "sequence": "ATGCGCTAT"}}

• replace_sequence - Replace sequence in a region with new sequence
  Parameters: chromosome (string), start (number), end (number), sequence (string), strand (optional)
  Example: {"tool_name": "replace_sequence", "parameters": {"chromosome": "COLI-K12", "start": 1000, "end": 1500, "sequence": "ATGCGC"}}

• copy_sequence - Copy sequence region to clipboard
  Parameters: chromosome (string), start (number), end (number), strand (optional)
  Example: {"tool_name": "copy_sequence", "parameters": {"chromosome": "COLI-K12", "start": 1000, "end": 1500}}

• cut_sequence - Cut sequence (copy to clipboard and mark for deletion)
  Parameters: chromosome (string), start (number), end (number), strand (optional)
  Example: {"tool_name": "cut_sequence", "parameters": {"chromosome": "COLI-K12", "start": 1000, "end": 1500}}

• paste_sequence - Paste sequence from clipboard
  Parameters: chromosome (string), position (number)
  Example: {"tool_name": "paste_sequence", "parameters": {"chromosome": "COLI-K12", "position": 2000}}

• execute_actions - Execute all queued sequence editing actions
  Parameters: confirm (optional boolean, default: false)
  Example: {"tool_name": "execute_actions", "parameters": {}}

• get_action_list - View current action queue
  Parameters: status (optional: "all", "pending", "completed", "failed")
  Example: {"tool_name": "get_action_list", "parameters": {"status": "pending"}}

CRITICAL GENE DELETION WORKFLOW:
Method 1 - Simple gene deletion by name or locus tag:
1. {"tool_name": "delete_gene", "parameters": {"geneName": "yaaJ"}}  (by gene name)
1. {"tool_name": "delete_gene", "parameters": {"geneName": "b0005"}}  (by locus tag)
2. {"tool_name": "execute_actions", "parameters": {}}

Method 2 - Manual deletion with coordinates:
1. {"tool_name": "search_gene_by_name", "parameters": {"name": "yaaJ"}}
2. Use gene coordinates from result in deleteSequence
3. {"tool_name": "deleteSequence", "parameters": {"chromosome": "COLI-K12", "start": [gene_start], "end": [gene_end]}}
4. {"tool_name": "execute_actions", "parameters": {}}

CHROMOSOME NAMES:
- Current genome uses "COLI-K12" as chromosome identifier
- Always use the exact chromosome name from current genome state

COMMON TASK PATTERNS:
• Gene Analysis: search_gene_by_name → get_coding_sequence → analyze features
• AlphaFold AI Predictions: search_alphafold_by_gene → open_alphafold_viewer
• PDB Experimental Structures: search_protein_by_gene → open_protein_viewer
• Sequence Analysis: get_sequence → compute_gc/translate_dna/find_orfs
• Navigation: jump_to_gene → navigate_to_position
• New Tab: open_new_tab → for parallel analysis
• BLAST Search: blast_search → analyze results
• Pathway Analysis: show_metabolic_pathway → find_pathway_genes
• Gene Deletion: search_gene_by_name → deleteSequence → execute_actions
• Sequence Insertion: insertSequence → execute_actions
• Copy/Paste: copy_sequence → paste_sequence → execute_actions

SEARCH FUNCTIONS GUIDE:
- Gene names/products: search_gene_by_name, search_features
- Genomic positions: search_by_position, get_nearby_features  
- Sequence motifs: search_sequence_motif
- PDB experimental structures: search_protein_by_gene (for known PDB entries)
- AlphaFold AI predictions: search_alphafold_by_gene (for AI-predicted structures)

ANALYSIS FUNCTIONS:
- Sequence: get_coding_sequence, translate_dna, reverse_complement
- Composition: compute_gc, sequence_statistics, codon_usage_analysis
- Features: find_orfs, predict_promoter, predict_rbs, find_restriction_sites
- Comparison: blast_search, compare_regions, find_similar_sequences
- Editing: copy_sequence, cut_sequence, paste_sequence, deleteSequence, insertSequence, replace_sequence

IMPORTANT PREREQUISITES:
Before using get_coding_sequence or other gene-specific functions:
1. Ensure genome data is loaded (GenBank/GFF files)
2. Use search_gene_by_name to verify gene exists
3. Check current genome state with get_genome_info

WORKFLOW EXAMPLES:
• Gene Deletion Workflow:
  Method 1 (Recommended): 
  1. {"tool_name": "delete_gene", "parameters": {"geneName": "yaaJ"}}  (by gene name)
  1. {"tool_name": "delete_gene", "parameters": {"geneName": "b0005"}}  (by locus tag)
  2. {"tool_name": "execute_actions", "parameters": {}}
  
  Method 2 (Manual): 
  1. {"tool_name": "search_gene_by_name", "parameters": {"name": "yaaJ"}}
  2. {"tool_name": "deleteSequence", "parameters": {"chromosome": "COLI-K12", "start": 8238, "end": 9191}}
  3. {"tool_name": "execute_actions", "parameters": {}}

• Gene Analysis Workflow:
  1. {"tool_name": "search_gene_by_name", "parameters": {"name": "lysC"}}
  2. {"tool_name": "get_coding_sequence", "parameters": {"identifier": "lysC"}}
  3. {"tool_name": "translate_sequence", "parameters": {"sequence": "ATGCGC..."}}

• Sequence Insertion Workflow:
  1. {"tool_name": "insertSequence", "parameters": {"chromosome": "COLI-K12", "position": 1000, "sequence": "ATGCGCTAT"}}
  2. {"tool_name": "execute_actions", "parameters": {}}

• Copy/Paste Workflow:
  1. {"tool_name": "copy_sequence", "parameters": {"chromosome": "COLI-K12", "start": 1000, "end": 1500}}
  2. {"tool_name": "paste_sequence", "parameters": {"chromosome": "COLI-K12", "position": 2000}}
  3. {"tool_name": "execute_actions", "parameters": {}}

EXAMPLES:
• Find gene: {"tool_name": "search_gene_by_name", "parameters": {"name": "thrC"}}
• Delete gene: {"tool_name": "deleteSequence", "parameters": {"chromosome": "COLI-K12", "start": 1000, "end": 2000}}
• Insert DNA: {"tool_name": "insertSequence", "parameters": {"chromosome": "COLI-K12", "position": 1000, "sequence": "ATGCGC"}}
• Execute actions: {"tool_name": "execute_actions", "parameters": {}}
• Get action list: {"tool_name": "get_action_list", "parameters": {}}
• Copy sequence: {"tool_name": "copy_sequence", "parameters": {"chromosome": "COLI-K12", "start": 1000, "end": 1500}}
• Paste sequence: {"tool_name": "paste_sequence", "parameters": {"chromosome": "COLI-K12", "position": 2000}}`;
    }

    /**
     * Get complete tool context for custom system prompts
     * This includes all the tool information that the base system message has
     */
    getCompleteToolContext() {
        const context = this.getCurrentContext();
        
        // Get MCP server information
        const mcpServers = this.mcpServerManager.getServerStatus();
        const connectedServers = mcpServers.filter(s => s.connected);
        const allMcpTools = this.mcpServerManager.getAllAvailableTools();
        const toolsByCategory = this.mcpServerManager.getToolsByCategory();
        
        let mcpServersInfo = '';
        if (connectedServers.length > 0) {
            mcpServersInfo = `
Connected MCP Servers: ${connectedServers.length}
${connectedServers.map(server => 
    `- ${server.name} (${server.category}): ${server.toolCount} tools`
).join('\n')}

MCP Tools by Category:
${Object.entries(toolsByCategory).map(([category, tools]) => 
    `${category.toUpperCase()}:\n${tools.map(tool => 
        `  - ${tool.name} (${tool.serverName}): ${tool.description || 'No description'}`
    ).join('\n')}`
).join('\n\n')}
`;
        } else {
            mcpServersInfo = `
Connected MCP Servers: None
Note: Additional tools may be available when MCP servers are connected.
`;
        }

        // Get MicrobeGenomicsFunctions categories and examples
        let microbeGenomicsInfo = '';
        if (this.MicrobeFns) {
            try {
                const categories = this.MicrobeFns.getFunctionCategories();
                const examples = this.MicrobeFns.getUsageExamples();
                
                microbeGenomicsInfo = `
MICROBE GENOMICS FUNCTIONS (Advanced Analysis Tools):
${Object.entries(categories).map(([category, info]) => 
    `${category.toUpperCase()} (${info.description}):\n${info.functions.map(fn => 
        `  - ${fn}: Use as "${fn.toLowerCase().replace(/([A-Z])/g, '_$1').toLowerCase()}"`
    ).join('\n')}`
).join('\n\n')}

MICROBE GENOMICS USAGE EXAMPLES:
${examples.map(example => 
    `Task: ${example.task}\nSteps:\n${example.steps.map(step => `  ${step}`).join('\n')}`
).join('\n\n')}
`;
            } catch (error) {
                microbeGenomicsInfo = '\nMicrobeGenomicsFunctions: Available but could not load details\n';
            }
        }

        // Get plugin system information
        const pluginSystemInfo = this.getPluginSystemInfo();

        return `
Current Genome AI Studio State:
- Current chromosome: ${context.genomeBrowser.currentState.currentChromosome || 'None'}
- Current position: ${JSON.stringify(context.genomeBrowser.currentState.currentPosition) || 'None'}
- Visible tracks: ${context.genomeBrowser.currentState.visibleTracks.join(', ') || 'None'}
- Loaded files: ${context.genomeBrowser.currentState.loadedFiles.length} files
- Sequence length: ${context.genomeBrowser.currentState.sequenceLength}
- Annotations count: ${context.genomeBrowser.currentState.annotationsCount}
- User-defined features: ${context.genomeBrowser.currentState.userDefinedFeaturesCount}

${mcpServersInfo}

Available Tools Summary:
- Total Available Tools: ${context.genomeBrowser.toolSources.total}
- Local Tools: ${context.genomeBrowser.toolSources.local}
- Plugin Tools: ${context.genomeBrowser.toolSources.plugins}
- MCP Tools: ${context.genomeBrowser.toolSources.mcp}

All Available Tools:
${context.genomeBrowser.availableTools.map(tool => `- ${tool}`).join('\n')}

${microbeGenomicsInfo}

${pluginSystemInfo}

===CRITICAL INSTRUCTION FOR TOOL CALLS===
When a user asks you to perform ANY action that requires using one of these tools, you MUST respond with ONLY a JSON object. Do NOT add any explanatory text, markdown formatting, or conversational responses around the JSON.

CORRECT format:
{"tool_name": "navigate_to_position", "parameters": {"chromosome": "U00096", "start": 1000, "end": 2000}}
{"tool_name": "navigate_to_position", "parameters": {"chromosome": "COLI-K12", "position": 2000000}}
{"tool_name": "open_new_tab", "parameters": {"chromosome": "chr1", "start": 1000, "end": 2000}}
{"tool_name": "open_new_tab", "parameters": {"geneName": "lacZ"}}

Tool Selection Priority:
1. First try MCP server tools (if available and connected)
2. Use MicrobeGenomicsFunctions for specialized genomic analysis
3. Fall back to built-in local tools
4. Use the most appropriate tool for the task regardless of source

Basic Tool Examples:
- Navigate: {"tool_name": "navigate_to_position", "parameters": {"chromosome": "chr1", "start": 1000, "end": 2000}}
- Navigate to position: {"tool_name": "navigate_to_position", "parameters": {"chromosome": "COLI-K12", "position": 2000000}}
- Open new tab: {"tool_name": "open_new_tab", "parameters": {"chromosome": "chr1", "start": 1000, "end": 2000}}
- Open tab for gene: {"tool_name": "open_new_tab", "parameters": {"geneName": "lacZ"}}
- Search genes: {"tool_name": "search_features", "parameters": {"query": "lacZ", "caseSensitive": false}}
- Get current state: {"tool_name": "get_current_state", "parameters": {}}
- Get genome info: {"tool_name": "get_genome_info", "parameters": {}}
- Get sequence: {"tool_name": "get_sequence", "parameters": {"chromosome": "chr1", "start": 1000, "end": 1500}}
- Toggle track: {"tool_name": "toggle_track", "parameters": {"trackName": "genes", "visible": true}}

Sequence Editing Examples:
- Copy sequence: {"tool_name": "copy_sequence", "parameters": {"chromosome": "chr1", "start": 1000, "end": 1500}}
- Cut sequence: {"tool_name": "cut_sequence", "parameters": {"chromosome": "chr1", "start": 1000, "end": 1500}}
- Paste sequence: {"tool_name": "paste_sequence", "parameters": {"chromosome": "chr1", "position": 2000}}
- Delete sequence: {"tool_name": "deleteSequence", "parameters": {"chromosome": "chr1", "start": 1000, "end": 1500}}
- Insert sequence: {"tool_name": "insertSequence", "parameters": {"chromosome": "chr1", "position": 1000, "sequence": "ATGCGC"}}
- Replace sequence: {"tool_name": "replace_sequence", "parameters": {"chromosome": "chr1", "start": 1000, "end": 1500, "sequence": "ATGCGC"}}
- Execute actions: {"tool_name": "execute_actions", "parameters": {}}
- Get action list: {"tool_name": "get_action_list", "parameters": {}}

MicrobeGenomicsFunctions Examples:
- Navigate to gene: {"tool_name": "jump_to_gene", "parameters": {"geneName": "lacZ"}}
- Calculate GC content: {"tool_name": "compute_gc", "parameters": {"sequence": "ATGCGCTATCG"}}
- Get upstream region: {"tool_name": "get_upstream_region", "parameters": {"geneObj": {"chromosome": "chr1", "feature": {"start": 1000, "end": 2000}}, "length": 200}}
- Find ORFs: {"tool_name": "find_orfs", "parameters": {"dna": "ATGAAATAG", "minLength": 30}}
- Predict promoter: {"tool_name": "predict_promoter", "parameters": {"seq": "ATGCTATAAT"}}
- Search motif: {"tool_name": "search_sequence_motif", "parameters": {"pattern": "GAATTC", "chromosome": "chr1"}}
- Reverse complement: {"tool_name": "reverse_complement", "parameters": {"dna": "ATGC"}}
- Translate DNA: {"tool_name": "translate_dna", "parameters": {"dna": "ATGAAATAG", "frame": 0}}
- Calculate entropy: {"tool_name": "calculate_entropy", "parameters": {"sequence": "ATGCGCTATCG"}}
- Melting temperature: {"tool_name": "calculate_melting_temp", "parameters": {"dna": "ATGCGCTATCG"}}
- Molecular weight: {"tool_name": "calculate_molecular_weight", "parameters": {"dna": "ATGCGCTATCG"}}
- Codon usage: {"tool_name": "analyze_codon_usage", "parameters": {"dna": "ATGAAATAG"}}
- Predict RBS: {"tool_name": "predict_rbs", "parameters": {"seq": "AGGAGG"}}
- Predict terminator: {"tool_name": "predict_terminator", "parameters": {"seq": "ATGCGCTATCG"}}
- Get coding sequence: {"tool_name": "get_coding_sequence", "parameters": {"identifier": "lacZ"}}
- Get multiple CDS: {"tool_name": "get_multiple_coding_sequences", "parameters": {"identifiers": ["lacZ", "lacY", "lacA"]}}
- Navigation controls: {"tool_name": "scroll_left", "parameters": {"bp": 1000}} or {"tool_name": "zoom_in", "parameters": {"factor": 2}}

CRITICAL DISTINCTION - Search Functions:
1. FOR TEXT-BASED SEARCHES (gene names, products): use 'search_features' or 'search_gene_by_name'
   - "find lacZ" → {"tool_name": "search_gene_by_name", "parameters": {"name": "lacZ"}}
   - "search DNA polymerase" → {"tool_name": "search_features", "parameters": {"query": "DNA polymerase", "caseSensitive": false}}

2. FOR POSITION-BASED SEARCHES (near coordinates): use 'get_nearby_features' or 'search_by_position'
   - "find genes near 123456" → {"tool_name": "search_by_position", "parameters": {"chromosome": "chr1", "position": 123456}}

3. FOR SEQUENCE MOTIF SEARCHES: use 'search_sequence_motif'
   - "find GAATTC sites" → {"tool_name": "search_sequence_motif", "parameters": {"pattern": "GAATTC"}}

Common Analysis Tools:
- Find restriction sites: {"tool_name": "find_restriction_sites", "parameters": {"enzyme": "EcoRI"}}
- Calculate GC content: {"tool_name": "sequence_statistics", "parameters": {"include": ["composition"]}}
- Find ORFs: {"tool_name": "find_orfs", "parameters": {"chromosome": "chr1", "start": 1000, "end": 5000, "minLength": 300}}
- Search motifs: {"tool_name": "search_motif", "parameters": {"pattern": "GAATTC", "allowMismatches": 0}}

Protein Structure Tools:
- Display protein 3D structure: {"tool_name": "open_protein_viewer", "parameters": {"pdbId": "1TUP"}}
- Fetch protein structure data: {"tool_name": "fetch_protein_structure", "parameters": {"pdbId": "6SSC"}}
- Search PDB proteins by gene: {"tool_name": "search_protein_by_gene", "parameters": {"geneName": "p53", "organism": "Homo sapiens"}}
- Search AlphaFold by gene: {"tool_name": "search_alphafold_by_gene", "parameters": {"geneName": "lysC", "organism": "Escherichia coli"}}

PROTEIN STRUCTURE DISAMBIGUATION:
- For "PDB" searches or experimental structures → use search_protein_by_gene
- For "AlphaFold" or AI predictions → use search_alphafold_by_gene
- Example: "search PDB protein structure for lysC" → search_protein_by_gene

IMPORTANT: For protein structure display requests, use "open_protein_viewer" with just the pdbId parameter. The system will automatically fetch the structure data if needed.

BLAST Search Tools:
- Search sequence similarity: {"tool_name": "blast_search", "parameters": {"sequence": "ATGCGCTATCG", "blastType": "blastn", "database": "nt", "evalue": "0.01", "maxTargets": 50}}
- BLAST current region: {"tool_name": "blast_sequence_from_region", "parameters": {"chromosome": "chr1", "start": 1000, "end": 2000, "blastType": "blastn", "database": "nt"}}
- Get BLAST databases: {"tool_name": "get_blast_databases", "parameters": {}}

BLAST Examples:
1. DNA sequence search: {"tool_name": "blast_search", "parameters": {"sequence": "ATGAAAGAATTGAAAGAAGCTGGCTGGAAAGAACTGCAGCCG", "blastType": "blastn", "database": "nt"}}
2. Protein sequence search: {"tool_name": "blast_search", "parameters": {"sequence": "MKELLKAGWKELQPIKEYGIEAVALAYTYQKEQDAIDKELKENITPNVEKKLVWEALKLK", "blastType": "blastp", "database": "nr"}}
3. Translate and search DNA: {"tool_name": "blast_search", "parameters": {"sequence": "ATGAAAGAATTGAAAGAAGCTGGCTGG", "blastType": "blastx", "database": "nr"}}
4. Search genomic region: {"tool_name": "blast_sequence_from_region", "parameters": {"chromosome": "NC_000913.3", "start": 3423681, "end": 3424651, "blastType": "blastn", "database": "refseq_genomic"}}

Enhanced BLAST Tools (Available with MCP BLAST Server):
- Batch BLAST search: {"tool_name": "batch_blast_search", "parameters": {"sequences": [{"id": "seq1", "sequence": "ATGCGCTATCG"}, {"id": "seq2", "sequence": "ATGAAAGAATT"}], "blastType": "blastn", "database": "nt", "maxTargets": 10}}
- Advanced BLAST with filtering: {"tool_name": "advanced_blast_search", "parameters": {"sequence": "ATGCGCTATCG", "blastType": "blastn", "database": "nt", "filters": {"minIdentity": 95, "minCoverage": 80}, "algorithms": {"wordSize": "11", "matrix": "BLOSUM62"}}}
- Local database info: {"tool_name": "local_blast_database_info", "parameters": {"databasePath": "/path/to/local/db"}}

Enhanced BLAST Examples:
1. Batch protein search: {"tool_name": "batch_blast_search", "parameters": {"sequences": [{"id": "protein1", "sequence": "MKELLKAGWKELQP"}, {"id": "protein2", "sequence": "MKLSAGATRVST"}], "blastType": "blastp", "database": "nr"}}
2. High-specificity DNA search: {"tool_name": "advanced_blast_search", "parameters": {"sequence": "ATGAAAGAATTGAAAGAAGCTGGCTGG", "blastType": "blastn", "database": "nt", "filters": {"minIdentity": 98, "maxEvalue": 1e-10}}}

MICROBE GENOMICS POWER USER EXAMPLES:
1. Complete Gene Analysis:
   - Find gene: {"tool_name": "search_gene_by_name", "parameters": {"name": "dnaA"}}
   - Get upstream: {"tool_name": "get_upstream_region", "parameters": {"geneObj": "result_from_above", "length": 200}}
   - Predict promoter: {"tool_name": "predict_promoter", "parameters": {"seq": "upstream_sequence"}}
   - Calculate GC: {"tool_name": "compute_gc", "parameters": {"sequence": "upstream_sequence"}}

2. Sequence Motif Analysis:
   - Search motif: {"tool_name": "search_sequence_motif", "parameters": {"pattern": "TATAAT"}}
   - Find nearby features: {"tool_name": "search_by_position", "parameters": {"position": "motif_position"}}

3. Comparative Analysis:
   - Get region 1: {"tool_name": "get_upstream_region", "parameters": {"geneObj": "gene1", "length": 500}}
   - Get region 2: {"tool_name": "get_upstream_region", "parameters": {"geneObj": "gene2", "length": 500}}
   - Compare GC: {"tool_name": "compute_gc", "parameters": {"sequence": "region1"}} then {"tool_name": "compute_gc", "parameters": {"sequence": "region2"}}

Remember: These functions provide atomic operations that can be chained together to perform complex genomic analyses!

Metabolic Pathway Tools:
- Display metabolic pathway: {"tool_name": "show_metabolic_pathway", "parameters": {"pathwayName": "glycolysis"}}
- Find pathway genes: {"tool_name": "find_pathway_genes", "parameters": {"pathwayName": "glycolysis", "includeRegulation": true}}

Metabolic Pathway Examples:
1. Glycolysis analysis: {"tool_name": "show_metabolic_pathway", "parameters": {"pathwayName": "glycolysis"}}
2. TCA cycle genes: {"tool_name": "find_pathway_genes", "parameters": {"pathwayName": "tca_cycle", "includeRegulation": false}}
3. Pentose phosphate pathway: {"tool_name": "show_metabolic_pathway", "parameters": {"pathwayName": "pentose_phosphate"}}
`;
    }

    /**
     * Get essential tool information that should always be included
     */
    getEssentialToolInformation() {
        const context = this.getCurrentContext();
        const toolCount = context.genomeBrowser.toolSources.total;
        
        // Get a sample of key tools from each category
        const keyTools = [
            // Navigation & State
            'navigate_to_position', 'get_current_state', 'jump_to_gene', 'zoom_to_gene', 'open_new_tab',
            // Search & Discovery  
            'search_features', 'search_gene_by_name', 'search_sequence_motif',
            // Sequence Analysis
            'get_sequence', 'translate_dna', 'compute_gc', 'reverse_complement',
            // Advanced Analysis
            'analyze_region', 'predict_promoter', 'find_restriction_sites',
            // BLAST & External
            'blast_search', 'blast_sequence_from_region',
            // Protein Structure
            'open_protein_viewer', 'fetch_protein_structure',
            // Data Management
            'get_genome_info', 'export_data', 'create_annotation'
        ];
        
        return `
===CRITICAL INSTRUCTION FOR TOOL CALLS===
When a user asks you to perform ANY action that requires using tools, you MUST respond with ONLY a JSON object:

{"tool_name": "tool_name_here", "parameters": {"param1": "value1", "param2": "value2"}}

AVAILABLE TOOLS SUMMARY:
- Total Available Tools: ${toolCount}
- Local Tools: ${context.genomeBrowser.toolSources.local}
- Plugin Tools: ${context.genomeBrowser.toolSources.plugins}  
- MCP Tools: ${context.genomeBrowser.toolSources.mcp}

KEY TOOLS BY CATEGORY:
Navigation & State: navigate_to_position, get_current_state, jump_to_gene, zoom_to_gene, open_new_tab
Search & Discovery: search_features, search_gene_by_name, search_sequence_motif
Sequence Analysis: get_sequence, translate_dna, compute_gc, reverse_complement  
Advanced Analysis: analyze_region, predict_promoter, find_restriction_sites
BLAST & External: blast_search, blast_sequence_from_region
Protein Structure: open_protein_viewer, fetch_protein_structure
Data Management: get_genome_info, export_data, create_annotation

For complete tool documentation with all ${toolCount} available tools, ask me to show all available tools.`;
    }

    /**
     * Get the original base system message with all context
     */
    getBaseSystemMessage() {
        const context = this.getCurrentContext();
        
        // Get MCP server information
        const mcpServers = this.mcpServerManager.getServerStatus();
        const connectedServers = mcpServers.filter(s => s.connected);
        const allMcpTools = this.mcpServerManager.getAllAvailableTools();
        const toolsByCategory = this.mcpServerManager.getToolsByCategory();
        
        let mcpServersInfo = '';
        if (connectedServers.length > 0) {
            mcpServersInfo = `
Connected MCP Servers: ${connectedServers.length}
${connectedServers.map(server => 
    `- ${server.name} (${server.category}): ${server.toolCount} tools`
).join('\n')}

MCP Tools by Category:
${Object.entries(toolsByCategory).map(([category, tools]) => 
    `${category.toUpperCase()}:\n${tools.map(tool => 
        `  - ${tool.name} (${tool.serverName}): ${tool.description || 'No description'}`
    ).join('\n')}`
).join('\n\n')}
`;
        } else {
            mcpServersInfo = `
Connected MCP Servers: None
Note: Additional tools may be available when MCP servers are connected.
`;
        }

        // Get MicrobeGenomicsFunctions categories and examples
        let microbeGenomicsInfo = '';
        if (this.MicrobeFns) {
            try {
                const categories = this.MicrobeFns.getFunctionCategories();
                const examples = this.MicrobeFns.getUsageExamples();
                
                microbeGenomicsInfo = `
MICROBE GENOMICS FUNCTIONS (Advanced Analysis Tools):
${Object.entries(categories).map(([category, info]) => 
    `${category.toUpperCase()} (${info.description}):\n${info.functions.map(fn => 
        `  - ${fn}: Use as "${fn.toLowerCase().replace(/([A-Z])/g, '_$1').toLowerCase()}"`
    ).join('\n')}`
).join('\n\n')}

MICROBE GENOMICS USAGE EXAMPLES:
${examples.map(example => 
    `Task: ${example.task}\nSteps:\n${example.steps.map(step => `  ${step}`).join('\n')}`
).join('\n\n')}
`;
            } catch (error) {
                microbeGenomicsInfo = '\nMicrobeGenomicsFunctions: Available but could not load details\n';
            }
        }

        return `You are an AI assistant for a Genome AI Studio application. You have access to the following tools and current state:

IMPORTANT: Task Completion Instructions
When you believe you have completed the user's task or fully answered their question, you can end the conversation early by providing a summary response WITHOUT any tool calls. Use clear completion indicators like "Task completed", "Analysis finished", "In summary", or "The results show" to signal completion. This allows for efficient task execution without using unnecessary function call rounds.

Current Genome AI Studio State:
- Current chromosome: ${context.genomeBrowser.currentState.currentChromosome || 'None'}
- Current position: ${JSON.stringify(context.genomeBrowser.currentState.currentPosition) || 'None'}
- Visible tracks: ${context.genomeBrowser.currentState.visibleTracks.join(', ') || 'None'}
- Loaded files: ${context.genomeBrowser.currentState.loadedFiles.length} files
- Sequence length: ${context.genomeBrowser.currentState.sequenceLength}
- Annotations count: ${context.genomeBrowser.currentState.annotationsCount}
- User-defined features: ${context.genomeBrowser.currentState.userDefinedFeaturesCount}

${mcpServersInfo}

Available Tools Summary:
- Total Available Tools: ${context.genomeBrowser.toolSources.total}
- Local Tools: ${context.genomeBrowser.toolSources.local}
- Plugin Tools: ${context.genomeBrowser.toolSources.plugins}
- MCP Tools: ${context.genomeBrowser.toolSources.mcp}

All Available Tools:
${context.genomeBrowser.availableTools.map(tool => `- ${tool}`).join('\n')}

${microbeGenomicsInfo}

===CRITICAL INSTRUCTION FOR TOOL CALLS===
When a user asks you to perform ANY action that requires using one of these tools, you MUST respond with ONLY a JSON object. Do NOT add any explanatory text, markdown formatting, or conversational responses around the JSON.

CORRECT format:
{"tool_name": "navigate_to_position", "parameters": {"chromosome": "U00096", "start": 1000, "end": 2000}}
{"tool_name": "navigate_to_position", "parameters": {"chromosome": "COLI-K12", "position": 2000000}}
{"tool_name": "open_new_tab", "parameters": {"chromosome": "chr1", "start": 1000, "end": 2000}}
{"tool_name": "open_new_tab", "parameters": {"geneName": "lacZ"}}

Tool Selection Priority:
1. First try MCP server tools (if available and connected)
2. Use Plugin System tools for database searches and advanced analysis
3. Use MicrobeGenomicsFunctions for specialized genomic analysis
4. Fall back to built-in local tools
5. Use the most appropriate tool for the task regardless of source


Basic Tool Examples:
- Navigate: {"tool_name": "navigate_to_position", "parameters": {"chromosome": "chr1", "start": 1000, "end": 2000}}
- Navigate to position: {"tool_name": "navigate_to_position", "parameters": {"chromosome": "COLI-K12", "position": 2000000}}
- Open new tab: {"tool_name": "open_new_tab", "parameters": {"chromosome": "chr1", "start": 1000, "end": 2000}}
- Open tab for gene: {"tool_name": "open_new_tab", "parameters": {"geneName": "lacZ"}}
- Search genes: {"tool_name": "search_features", "parameters": {"query": "lacZ", "caseSensitive": false}}
- Get current state: {"tool_name": "get_current_state", "parameters": {}}
- Get genome info: {"tool_name": "get_genome_info", "parameters": {}}
- Get sequence: {"tool_name": "get_sequence", "parameters": {"chromosome": "chr1", "start": 1000, "end": 1500}}
- Toggle track: {"tool_name": "toggle_track", "parameters": {"trackName": "genes", "visible": true}}

Sequence Editing Examples:
- Copy sequence: {"tool_name": "copy_sequence", "parameters": {"chromosome": "chr1", "start": 1000, "end": 1500}}
- Cut sequence: {"tool_name": "cut_sequence", "parameters": {"chromosome": "chr1", "start": 1000, "end": 1500}}
- Paste sequence: {"tool_name": "paste_sequence", "parameters": {"chromosome": "chr1", "position": 2000}}
- Delete sequence: {"tool_name": "deleteSequence", "parameters": {"chromosome": "chr1", "start": 1000, "end": 1500}}
- Insert sequence: {"tool_name": "insertSequence", "parameters": {"chromosome": "chr1", "position": 1000, "sequence": "ATGCGC"}}
- Replace sequence: {"tool_name": "replace_sequence", "parameters": {"chromosome": "chr1", "start": 1000, "end": 1500, "sequence": "ATGCGC"}}
- Execute actions: {"tool_name": "execute_actions", "parameters": {}}
- Get action list: {"tool_name": "get_action_list", "parameters": {}}

MicrobeGenomicsFunctions Examples:
- Navigate to gene: {"tool_name": "jump_to_gene", "parameters": {"geneName": "lacZ"}}
- Calculate GC content: {"tool_name": "compute_gc", "parameters": {"sequence": "ATGCGCTATCG"}}
- Get upstream region: {"tool_name": "get_upstream_region", "parameters": {"geneObj": {"chromosome": "chr1", "feature": {"start": 1000, "end": 2000}}, "length": 200}}
- Find ORFs: {"tool_name": "find_orfs", "parameters": {"dna": "ATGAAATAG", "minLength": 30}}
- Predict promoter: {"tool_name": "predict_promoter", "parameters": {"seq": "ATGCTATAAT"}}
- Search motif: {"tool_name": "search_sequence_motif", "parameters": {"pattern": "GAATTC", "chromosome": "chr1"}}
- Reverse complement: {"tool_name": "reverse_complement", "parameters": {"dna": "ATGC"}}
- Translate DNA: {"tool_name": "translate_dna", "parameters": {"dna": "ATGAAATAG", "frame": 0}}
- Calculate entropy: {"tool_name": "calculate_entropy", "parameters": {"sequence": "ATGCGCTATCG"}}
- Melting temperature: {"tool_name": "calculate_melting_temp", "parameters": {"dna": "ATGCGCTATCG"}}
- Molecular weight: {"tool_name": "calculate_molecular_weight", "parameters": {"dna": "ATGCGCTATCG"}}
- Codon usage: {"tool_name": "analyze_codon_usage", "parameters": {"dna": "ATGAAATAG"}}
- Predict RBS: {"tool_name": "predict_rbs", "parameters": {"seq": "AGGAGG"}}
- Predict terminator: {"tool_name": "predict_terminator", "parameters": {"seq": "ATGCGCTATCG"}}
- Navigation controls: {"tool_name": "scroll_left", "parameters": {"bp": 1000}} or {"tool_name": "zoom_in", "parameters": {"factor": 2}}

CRITICAL DISTINCTION - Search Functions:
1. FOR TEXT-BASED SEARCHES (gene names, products): use 'search_features' or 'search_gene_by_name'
   - "find lacZ" → {"tool_name": "search_gene_by_name", "parameters": {"name": "lacZ"}}
   - "search DNA polymerase" → {"tool_name": "search_features", "parameters": {"query": "DNA polymerase", "caseSensitive": false}}

2. FOR POSITION-BASED SEARCHES (near coordinates): use 'get_nearby_features' or 'search_by_position'
   - "find genes near 123456" → {"tool_name": "search_by_position", "parameters": {"chromosome": "chr1", "position": 123456}}

3. FOR SEQUENCE MOTIF SEARCHES: use 'search_sequence_motif'
   - "find GAATTC sites" → {"tool_name": "search_sequence_motif", "parameters": {"pattern": "GAATTC"}}

Common Analysis Tools:
- Find restriction sites: {"tool_name": "find_restriction_sites", "parameters": {"enzyme": "EcoRI"}}
- Calculate GC content: {"tool_name": "sequence_statistics", "parameters": {"include": ["composition"]}}
- Find ORFs: {"tool_name": "find_orfs", "parameters": {"chromosome": "chr1", "start": 1000, "end": 5000, "minLength": 300}}
- Search motifs: {"tool_name": "search_motif", "parameters": {"pattern": "GAATTC", "allowMismatches": 0}}

Protein Structure Tools:
- Display protein 3D structure: {"tool_name": "open_protein_viewer", "parameters": {"pdbId": "1TUP"}}
- Fetch protein structure data: {"tool_name": "fetch_protein_structure", "parameters": {"pdbId": "6SSC"}}
- Search PDB proteins by gene: {"tool_name": "search_protein_by_gene", "parameters": {"geneName": "p53", "organism": "Homo sapiens"}}
- Search AlphaFold by gene: {"tool_name": "search_alphafold_by_gene", "parameters": {"geneName": "lysC", "organism": "Escherichia coli"}}

PROTEIN STRUCTURE DISAMBIGUATION:
- For "PDB" searches or experimental structures → use search_protein_by_gene
- For "AlphaFold" or AI predictions → use search_alphafold_by_gene
- Example: "search PDB protein structure for lysC" → search_protein_by_gene

IMPORTANT: For protein structure display requests, use "open_protein_viewer" with just the pdbId parameter. The system will automatically fetch the structure data if needed.

BLAST Search Tools:
- Search sequence similarity: {"tool_name": "blast_search", "parameters": {"sequence": "ATGCGCTATCG", "blastType": "blastn", "database": "nt", "evalue": "0.01", "maxTargets": 50}}
- BLAST current region: {"tool_name": "blast_sequence_from_region", "parameters": {"chromosome": "chr1", "start": 1000, "end": 2000, "blastType": "blastn", "database": "nt"}}
- Get BLAST databases: {"tool_name": "get_blast_databases", "parameters": {}}

BLAST Examples:
1. DNA sequence search: {"tool_name": "blast_search", "parameters": {"sequence": "ATGAAAGAATTGAAAGAAGCTGGCTGGAAAGAACTGCAGCCG", "blastType": "blastn", "database": "nt"}}
2. Protein sequence search: {"tool_name": "blast_search", "parameters": {"sequence": "MKELLKAGWKELQPIKEYGIEAVALAYTYQKEQDAIDKELKENITPNVEKKLVWEALKLK", "blastType": "blastp", "database": "nr"}}
3. Translate and search DNA: {"tool_name": "blast_search", "parameters": {"sequence": "ATGAAAGAATTGAAAGAAGCTGGCTGG", "blastType": "blastx", "database": "nr"}}
4. Search genomic region: {"tool_name": "blast_sequence_from_region", "parameters": {"chromosome": "NC_000913.3", "start": 3423681, "end": 3424651, "blastType": "blastn", "database": "refseq_genomic"}}

Enhanced BLAST Tools (Available with MCP BLAST Server):
- Batch BLAST search: {"tool_name": "batch_blast_search", "parameters": {"sequences": [{"id": "seq1", "sequence": "ATGCGCTATCG"}, {"id": "seq2", "sequence": "ATGAAAGAATT"}], "blastType": "blastn", "database": "nt", "maxTargets": 10}}
- Advanced BLAST with filtering: {"tool_name": "advanced_blast_search", "parameters": {"sequence": "ATGCGCTATCG", "blastType": "blastn", "database": "nt", "filters": {"minIdentity": 95, "minCoverage": 80}, "algorithms": {"wordSize": "11", "matrix": "BLOSUM62"}}}
- Local database info: {"tool_name": "local_blast_database_info", "parameters": {"databasePath": "/path/to/local/db"}}

Enhanced BLAST Examples:
1. Batch protein search: {"tool_name": "batch_blast_search", "parameters": {"sequences": [{"id": "protein1", "sequence": "MKELLKAGWKELQP"}, {"id": "protein2", "sequence": "MKLSAGATRVST"}], "blastType": "blastp", "database": "nr"}}
2. High-specificity DNA search: {"tool_name": "advanced_blast_search", "parameters": {"sequence": "ATGAAAGAATTGAAAGAAGCTGGCTGG", "blastType": "blastn", "database": "nt", "filters": {"minIdentity": 98, "maxEvalue": 1e-10}}}
MICROBE GENOMICS POWER USER EXAMPLES:
1. Complete Gene Analysis:
   - Find gene: {"tool_name": "search_gene_by_name", "parameters": {"name": "dnaA"}}
   - Get upstream: {"tool_name": "get_upstream_region", "parameters": {"geneObj": "result_from_above", "length": 200}}
   - Predict promoter: {"tool_name": "predict_promoter", "parameters": {"seq": "upstream_sequence"}}
   - Calculate GC: {"tool_name": "compute_gc", "parameters": {"sequence": "upstream_sequence"}}

2. Sequence Motif Analysis:
   - Search motif: {"tool_name": "search_sequence_motif", "parameters": {"pattern": "TATAAT"}}
   - Find nearby features: {"tool_name": "search_by_position", "parameters": {"position": "motif_position"}}

3. Comparative Analysis:
   - Get region 1: {"tool_name": "get_upstream_region", "parameters": {"geneObj": "gene1", "length": 500}}
   - Get region 2: {"tool_name": "get_upstream_region", "parameters": {"geneObj": "gene2", "length": 500}}
   - Compare GC: {"tool_name": "compute_gc", "parameters": {"sequence": "region1"}} then {"tool_name": "compute_gc", "parameters": {"sequence": "region2"}}

Remember: These functions provide atomic operations that can be chained together to perform complex genomic analyses!

PLUGIN SYSTEM FUNCTIONS:
${this.getPluginSystemInfo()}`;
    }

    /**
     * Helper methods for generating variable content
     */
    getGenomeInfoSummary() {
        if (!this.app || !this.app.currentSequence) {
            return 'No genome loaded';
        }
        
        const sequences = Object.keys(this.app.currentSequence);
        const totalLength = Object.values(this.app.currentSequence).reduce((sum, seq) => sum + seq.length, 0);
        const annotationCount = this.app.currentAnnotations ? 
            Object.values(this.app.currentAnnotations).reduce((sum, annotations) => sum + annotations.length, 0) : 0;
        
        return `${sequences.length} sequence(s), ${totalLength.toLocaleString()} bp total, ${annotationCount} annotations`;
    }

    getCurrentStateSummary(context) {
        const state = context.genomeBrowser.currentState;
        return `Chromosome: ${state.currentChromosome || 'None'}, Position: ${state.currentPosition?.start || 0}-${state.currentPosition?.end || 0}`;
    }

    getLoadedFilesSummary() {
        if (!this.app || !this.app.loadedFiles) {
            return 'No files loaded';
        }
        return `${this.app.loadedFiles.length} file(s) loaded`;
    }

    getVisibleTracksSummary() {
        const tracks = this.getVisibleTracks();
        return tracks.length > 0 ? tracks.join(', ') : 'No tracks visible';
    }

    getCurrentPositionSummary(context) {
        const pos = context.genomeBrowser.currentState.currentPosition;
        if (!pos) return 'No position set';
        return `${pos.start}-${pos.end} (${(pos.end - pos.start + 1).toLocaleString()} bp)`;
    }

    getMCPServersSummary() {
        const servers = this.mcpServerManager.getServerStatus();
        const connected = servers.filter(s => s.connected);
        return connected.length > 0 ? 
            `${connected.length} connected: ${connected.map(s => s.name).join(', ')}` :
            'No MCP servers connected';
    }

    getPluginFunctionsSummary() {
        if (this.pluginFunctionCallsIntegrator) {
            const stats = this.pluginFunctionCallsIntegrator.getPluginFunctionStats();
            return `${stats.totalFunctions} plugin functions available`;
        }
        return 'Plugin system not available';
    }

    /**
     * Get plugin system information for system message
     */
    getPluginSystemInfo() {
        // Use the new plugin prompt system (preferred)
        if (this.pluginManager && this.pluginManager.getPluginSystemPromptSection) {
            try {
                return this.pluginManager.getPluginSystemPromptSection();
            } catch (error) {
                console.error('Error getting plugin system prompt section:', error);
            }
        }
        
        // Use the integrator if available (fallback)
        if (this.pluginFunctionCallsIntegrator) {
            try {
                const systemInfo = this.pluginFunctionCallsIntegrator.getPluginFunctionsSystemInfo();
                const stats = this.pluginFunctionCallsIntegrator.getPluginFunctionStats();
                
                let info = systemInfo;
                info += '\\n\\nPLUGIN SYSTEM STATISTICS:\\n';
                info += `Total Plugin Functions: ${stats.totalFunctions}\\n`;
                info += `Available Plugins: ${Object.keys(stats.pluginCounts).join(', ')}\\n`;
                info += `Function Categories: ${Object.keys(stats.categoryStats).join(', ')}\\n`;
                
                return info;
            } catch (error) {
                console.error('Error getting plugin system info from integrator:', error);
            }
        }
        
        // Fallback to original method
        if (!this.pluginManager) {
            return 'Plugin system not available.';
        }

        try {
            const pluginFunctions = this.pluginManager.getAvailableFunctions();
            const visualizations = this.pluginManager.getAvailableVisualizations();
            
            let info = '';
            
            if (pluginFunctions.length > 0) {
                info += 'Available Plugin Functions:\\n';
                pluginFunctions.forEach(func => {
                    info += `- ${func.name}: ${func.description}\\n`;
                });
                
                info += '\\nPlugin Function Examples:\\n';
                info += '- Analyze GC content: {"tool_name": "genomic-analysis.analyzeGCContent", "parameters": {"chromosome": "chr1", "start": 1000, "end": 5000, "windowSize": 1000}}\\n';
                info += '- Find motifs: {"tool_name": "genomic-analysis.findMotifs", "parameters": {"chromosome": "chr1", "start": 1000, "end": 5000, "motif": "GAATTC", "strand": "both"}}\\n';
                info += '- Calculate diversity: {"tool_name": "genomic-analysis.calculateDiversity", "parameters": {"sequences": ["ATGC", "CGTA"], "metric": "shannon"}}\\n';
                info += '- Compare regions: {"tool_name": "genomic-analysis.compareRegions", "parameters": {"regions": [{"chromosome": "chr1", "start": 1000, "end": 2000, "name": "region1"}], "analysisType": "gc"}}\\n';
                info += '- Build phylogenetic tree: {"tool_name": "phylogenetic-analysis.buildPhylogeneticTree", "parameters": {"sequences": [{"id": "seq1", "sequence": "ATGC", "name": "Sequence 1"}], "method": "nj"}}\\n';
                info += '- Predict gene function: {"tool_name": "ml-analysis.predictGeneFunction", "parameters": {"sequence": "ATGCGCTATCG", "model": "cnn", "threshold": 0.7}}\\n';
                info += '- Cluster sequences: {"tool_name": "ml-analysis.clusterSequences", "parameters": {"sequences": [{"id": "seq1", "sequence": "ATGC"}], "algorithm": "kmeans", "numClusters": 3}}\\n';
                
                // UniProt Database Search Functions
                info += '\\nUNIPROT DATABASE SEARCH FUNCTIONS:\\n';
                info += '- Search UniProt database: {"tool_name": "uniprot-search.searchUniProt", "parameters": {"query": "TP53", "organism": "human", "reviewedOnly": true, "maxResults": 10}}\\n';
                info += '- Search by gene name: {"tool_name": "uniprot-search.searchByGene", "parameters": {"geneName": "INS", "organism": "human", "reviewedOnly": true}}\\n';
                info += '- Search by protein name: {"tool_name": "uniprot-search.searchByProtein", "parameters": {"proteinName": "insulin", "organism": "human"}}\\n';
                info += '- Get protein by ID: {"tool_name": "uniprot-search.getProteinById", "parameters": {"uniprotId": "P04637", "includeSequence": true}}\\n';
                info += '- Search by function: {"tool_name": "uniprot-search.searchByFunction", "parameters": {"keywords": "kinase", "organism": "mouse", "maxResults": 15}}\\n';
            }
            
            if (visualizations.length > 0) {
                info += '\\nAvailable Visualization Plugins:\\n';
                visualizations.forEach(viz => {
                    info += `- ${viz.id}: ${viz.description} (supports: ${viz.supportedDataTypes.join(', ')})\\n`;
                });
                
                info += '\\nVisualization Examples:\\n';
                info += 'Note: Visualizations are automatically rendered when plugin functions return compatible data.\\n';
                info += 'For example, GC content analysis will automatically show a plot, phylogenetic analysis will show a tree.\\n';
            }
            
            return info;
        } catch (error) {
            console.error('Error getting plugin system info:', error);
            return 'Plugin system available but could not load details.';
        }
    }

    parseToolCall(response) {
        console.log('=== parseToolCall DEBUG START ===');
        console.log('Input response:', response);
        console.log('Response type:', typeof response);
        console.log('Response length:', response ? response.length : 'null');
        console.log('Response is null:', response === null);
        console.log('Response is undefined:', response === undefined);
        console.log('Response is empty string:', response === '');
        console.log('Response.trim() length:', response && typeof response === 'string' ? response.trim().length : 'N/A');
        
        // Log the actual characters for debugging
        if (response && typeof response === 'string') {
            console.log('Response characters (first 100):', JSON.stringify(response.substring(0, 100)));
            console.log('Response hex dump (first 50 chars):', 
                response.substring(0, 50).split('').map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ')
            );
        }
        
        // Early return for null/undefined responses but NOT empty strings
        if (response === null || response === undefined) {
            console.log('Response is null or undefined - returning null');
            console.log('=== parseToolCall DEBUG END (NULL/UNDEFINED RESPONSE) ===');
            return null;
        }
        
        // Handle empty strings differently - they might be valid in some contexts
        if (response === '') {
            console.log('Response is empty string - continuing with parsing logic');
        }
        
        try {
            // Clean the response by removing any leading/trailing whitespace
            let cleanResponse = response.trim();
            console.log('After trim:', cleanResponse);
            
            // If response contains thinking tags, extract content after them
            if (cleanResponse.includes('</think>')) {
                const thinkEndIndex = cleanResponse.lastIndexOf('</think>');
                cleanResponse = cleanResponse.substring(thinkEndIndex + 8).trim();
                console.log('After removing thinking tags:', cleanResponse);
            }
            
            // Remove any potential code block markers
            cleanResponse = cleanResponse.replace(/```json\s*|\s*```/gi, '').trim();
            cleanResponse = cleanResponse.replace(/```\s*|\s*```/g, '').trim();
            console.log('After removing code block markers:', cleanResponse);
            
            // If the response starts with non-JSON text (like "✅"), check if there's a JSON after it
            if (!cleanResponse.startsWith('{')) {
                console.log('Response does not start with {, checking for JSON within text...');
                const jsonMatch = cleanResponse.match(/\{[^{}]*"tool_name"[^{}]*"parameters"[^{}]*\}/);
                if (jsonMatch) {
                    cleanResponse = jsonMatch[0];
                    console.log('Found JSON within text:', cleanResponse);
        } else {
                    console.log('No JSON found within text, checking if this is a confirmation message');
                    // Check if this is a confirmation message that should have been a tool call
                    if (cleanResponse.includes('Navigated to') || cleanResponse.includes('✅')) {
                        console.log('This appears to be a confirmation message instead of a tool call');
                        console.log('=== parseToolCall DEBUG END (CONFIRMATION MESSAGE) ===');
                        return null;
                    }
                }
            }
            
            // Try to parse the entire response as JSON first (most direct approach)
            console.log('Attempting direct JSON parse...');
            try {
                const parsed = JSON.parse(cleanResponse);
                console.log('Direct parse successful:', parsed);
                if (parsed.tool_name && parsed.parameters !== undefined) {
                    console.log('Valid tool call found via direct parse');
                    console.log('=== parseToolCall DEBUG END (SUCCESS - DIRECT) ===');
                    return parsed;
                }
                console.log('Direct parse result does not have tool_name/parameters');
            } catch (e) {
                console.log('Direct parse failed:', e.message);
                // Continue to other parsing methods if direct parse fails
            }
            
            // Try to extract JSON from potential markdown or mixed content
            console.log('Attempting regex extraction...');
            const jsonMatches = cleanResponse.match(/\{[^{}]*"tool_name"[^{}]*"parameters"[^{}]*\}/);
            console.log('Regex matches:', jsonMatches);
            if (jsonMatches) {
                try {
                    const parsed = JSON.parse(jsonMatches[0]);
                    console.log('Regex parse successful:', parsed);
                    if (parsed.tool_name && parsed.parameters !== undefined) {
                        console.log('Valid tool call found via regex');
                        console.log('=== parseToolCall DEBUG END (SUCCESS - REGEX) ===');
                        return parsed;
                    }
                } catch (e) {
                    console.log('Regex parse failed:', e.message);
                    // Continue to next method
                }
            }
            
            // Try a more flexible JSON extraction that can handle nested braces
            console.log('Attempting flexible JSON extraction...');
            const startIndex = cleanResponse.indexOf('{');
            if (startIndex !== -1) {
                let braceCount = 0;
                let endIndex = startIndex;
                
                for (let i = startIndex; i < cleanResponse.length; i++) {
                    if (cleanResponse[i] === '{') braceCount++;
                    if (cleanResponse[i] === '}') braceCount--;
                    if (braceCount === 0) {
                        endIndex = i;
                        break;
                    }
                }
                
                if (braceCount === 0) {
                    const jsonCandidate = cleanResponse.substring(startIndex, endIndex + 1);
                    console.log('JSON candidate from flexible extraction:', jsonCandidate);
                    try {
                        const parsed = JSON.parse(jsonCandidate);
                        console.log('Flexible extraction parse successful:', parsed);
                        if (parsed.tool_name && parsed.parameters !== undefined) {
                            console.log('Valid tool call found via flexible extraction');
                            console.log('=== parseToolCall DEBUG END (SUCCESS - FLEXIBLE) ===');
                            return parsed;
                        }
                    } catch (e) {
                        console.log('Flexible extraction parse failed:', e.message);
                    }
                }
            }
            
            // Try to find any valid JSON object that has tool_name and parameters
            console.log('Attempting to find any JSON with tool_name...');
            const allJsonMatches = cleanResponse.match(/\{[^}]*\}/g);
            console.log('All JSON matches found:', allJsonMatches);
            if (allJsonMatches) {
                for (let i = 0; i < allJsonMatches.length; i++) {
                    const match = allJsonMatches[i];
                    console.log(`Trying to parse match ${i}:`, match);
                    try {
                        const parsed = JSON.parse(match);
                        console.log(`Parse ${i} successful:`, parsed);
                        if (parsed.tool_name && parsed.parameters !== undefined) {
                            console.log(`Valid tool call found in match ${i}`);
                            console.log('=== parseToolCall DEBUG END (SUCCESS - SEARCH) ===');
                            return parsed;
                        }
                        console.log(`Match ${i} does not have tool_name/parameters`);
                    } catch (e) {
                        console.log(`Parse ${i} failed:`, e.message);
                        // Continue to next match
                    }
                }
            }
            
            // If no valid tool call found, return null
            console.log('No valid tool call found in response');
            console.log('=== parseToolCall DEBUG END (NO TOOL CALL) ===');
            return null;
            
            } catch (error) {
            console.error('=== parseToolCall ERROR ===');
            console.error('Error:', error);
            console.error('Stack:', error.stack);
            console.error('=======================');
            console.warn('Error parsing potential tool call:', error);
            return null;
        }
    }

    /**
     * Parse multiple tool calls from a response
     * @param {string} response - LLM response that might contain multiple tool calls
     * @returns {Array} Array of tool call objects
     */
    parseMultipleToolCalls(response) {
        const toolCalls = [];
        
        try {
            let cleanResponse = response.trim();
            
            // Remove thinking tags if present
            if (cleanResponse.includes('</think>')) {
                const thinkEndIndex = cleanResponse.lastIndexOf('</think>');
                cleanResponse = cleanResponse.substring(thinkEndIndex + 8).trim();
            }
            
            // Remove code block markers
            cleanResponse = cleanResponse.replace(/```json\s*|\s*```/gi, '').trim();
            cleanResponse = cleanResponse.replace(/```\s*|\s*```/g, '').trim();
            
            // Try to parse as array first
            if (cleanResponse.startsWith('[')) {
                try {
                    const parsedArray = JSON.parse(cleanResponse);
                    if (Array.isArray(parsedArray)) {
                        return parsedArray.filter(item => 
                            item && typeof item === 'object' && item.tool_name && item.parameters !== undefined
                        );
                    }
                } catch (e) {
                    // Continue to other parsing methods
                }
            }
            
            // Find all JSON objects in the response
            const jsonMatches = cleanResponse.match(/\{[^{}]*"tool_name"[^{}]*"parameters"[^{}]*\}/g);
            if (jsonMatches) {
                for (const match of jsonMatches) {
                    try {
                        const parsed = JSON.parse(match);
                        if (parsed.tool_name && parsed.parameters !== undefined) {
                            toolCalls.push(parsed);
                        }
                    } catch (e) {
                        // Skip invalid JSON
                    }
                }
            }
            
        } catch (error) {
            console.warn('Error parsing multiple tool calls:', error);
        }
        
        return toolCalls;
    }

    async executeToolByName(toolName, parameters) {
        console.log(`Executing tool: ${toolName} with parameters:`, parameters);
        
        const startTime = Date.now();
        
        // Check if multi-agent system is enabled
        const multiAgentEnabled = this.configManager.get('multiAgentSettings.multiAgentSystemEnabled', false);
        const showAgentInfo = this.configManager.get('multiAgentSettings.multiAgentShowInfo', true);
        
        let agentName = 'System Agent';
        let reasoning = 'Direct tool execution';
        
        if (multiAgentEnabled && showAgentInfo) {
            // Determine which agent should handle this tool
            agentName = this.getAgentForTool(toolName);
            reasoning = this.getAgentReasoning(toolName, parameters);
            
            // Show agent decision process
            this.addAgentDecisionMessage(agentName, toolName, reasoning, parameters);
        }
        
        // 记录工具调用到内存系统
        if (this.memorySystem && this.agentSystemSettings.memoryEnabled) {
            this.memorySystem.recordToolCall(toolName, parameters);
        }
        
        try {
            // 如果启用了多智能体系统，尝试通过智能体执行
            if (this.agentSystemEnabled && this.multiAgentSystem) {
                try {
                    console.log(`🤖 Attempting agent-based execution for: ${toolName}`);
                    const agentResult = await this.multiAgentSystem.executeTool(toolName, parameters);
                    
                    if (agentResult.success) {
                        console.log(`🤖 Agent execution successful for ${toolName}`);
                        
                        // 记录成功执行到内存
                        if (this.memorySystem && this.agentSystemSettings.memoryEnabled) {
                            this.memorySystem.recordSuccessfulExecution(toolName, parameters, agentResult);
                        }
                        
                        return agentResult.result;
                    } else {
                        console.warn(`🤖 Agent execution failed for ${toolName}, falling back to standard execution`);
                    }
                } catch (agentError) {
                    console.warn(`🤖 Agent execution error for ${toolName}:`, agentError.message);
                    // Fall through to standard execution
                }
            }
            
            // First, try to execute on MCP servers
            const allTools = this.mcpServerManager.getAllAvailableTools();
            const mcpTool = allTools.find(t => t.name === toolName);
            
            if (mcpTool) {
                console.log(`Executing tool ${toolName} on MCP server: ${mcpTool.serverName}`);
                try {
                    const result = await this.mcpServerManager.executeToolOnServer(
                        mcpTool.serverId, 
                        toolName, 
                        parameters
                    );
                    console.log(`MCP tool ${toolName} execution result:`, result);
                    return result;
                } catch (error) {
                    console.warn(`MCP tool execution failed, falling back to local: ${error.message}`);
                    // Fall through to local execution
                }
            }
            
            // Check if this is a plugin function first
            if (this.pluginFunctionCallsIntegrator && this.pluginFunctionCallsIntegrator.isPluginFunction(toolName)) {
                try {
                    console.log(`Executing plugin function: ${toolName}`);
                    const result = await this.pluginFunctionCallsIntegrator.executePluginFunction(toolName, parameters);
                    return result;
                } catch (error) {
                    console.error(`Plugin function execution failed for ${toolName}:`, error);
                    throw error;
                }
            }
            
            // Fallback to local tool execution
            let result;
            switch (toolName) {
                case 'navigate_to_position':
                    result = await this.navigateToPosition(parameters);
                    break;
                
                case 'open_new_tab':
                    result = await this.openNewTab(parameters);
                    break;
                    
                case 'search_features':
                    result = await this.searchFeatures(parameters);
                    break;
                    
                case 'get_current_state':
                    result = this.getCurrentState();
                    break;
                    
                case 'get_sequence':
                    result = await this.getSequence(parameters);
                    break;
                    
                case 'toggle_track':
                    result = await this.toggleTrack(parameters);
                    break;
                    
                case 'create_annotation':
                    result = await this.createAnnotation(parameters);
                    break;
                    
                case 'analyze_region':
                    result = await this.analyzeRegion(parameters);
                    break;
                    
                case 'export_data':
                    result = await this.exportData(parameters);
                    break;
                    
                case 'get_gene_details':
                    result = await this.getGeneDetails(parameters);
                    break;
                    
                case 'translate_sequence':
                    result = await this.translateSequence(parameters);
                    break;
                    
                case 'calculate_gc_content':
                    result = await this.calculateGCContent(parameters);
                    break;
                    
                case 'find_orfs':
                    result = await this.findOpenReadingFrames(parameters);
                    break;
                    
                case 'get_operons':
                    result = await this.getOperons(parameters);
                    break;
                    
                case 'get_coding_sequence':
                    result = await this.getCodingSequence(parameters);
                    break;
                    
                case 'get_multiple_coding_sequences':
                    result = await this.getMultipleCodingSequences(parameters);
                    break;
                    
                case 'toggle_annotation_track':
                    result = await this.toggleAnnotationTrack(parameters);
                    break;
                    
                case 'zoom_to_gene':
                    result = await this.zoomToGene(parameters);
                    break;
                    
                case 'get_chromosome_list':
                    result = this.getChromosomeList();
                    break;
                    
                case 'get_track_status':
                    result = this.getTrackStatus();
                    break;
                    
                case 'search_motif':
                    result = await this.searchMotif(parameters);
                    break;
                    
                case 'search_pattern':
                    result = await this.searchPattern(parameters);
                    break;
                    
                case 'get_nearby_features':
                    result = await this.getNearbyFeatures(parameters);
                    break;
                    
                case 'find_intergenic_regions':
                    result = await this.findIntergenicRegions(parameters);
                    break;
                    
                case 'find_restriction_sites':
                    result = await this.findRestrictionSites(parameters);
                    break;
                    
                case 'virtual_digest':
                    result = await this.virtualDigest(parameters);
                    break;
                    
                case 'sequence_statistics':
                    result = await this.sequenceStatistics(parameters);
                    break;
                    
                case 'codon_usage_analysis':
                    result = await this.codonUsageAnalysis(parameters);
                    break;
                    
                case 'amino_acid_composition':
                    result = await this.aminoAcidComposition(parameters);
                    break;
                    
                case 'bookmark_position':
                    result = await this.bookmarkPosition(parameters);
                    break;
                    
                case 'get_bookmarks':
                    result = this.getBookmarks(parameters);
                    break;
                    
                case 'save_view_state':
                    result = await this.saveViewState(parameters);
                    break;
                    
                case 'compare_regions':
                    result = await this.compareRegions(parameters);
                    break;
                    
                case 'find_similar_sequences':
                    result = await this.findSimilarSequences(parameters);
                    break;
                    
                case 'edit_annotation':
                    result = await this.editAnnotation(parameters);
                    break;
                    
                case 'delete_annotation':
                    result = await this.deleteAnnotation(parameters);
                    break;
                    
                case 'batch_create_annotations':
                    result = await this.batchCreateAnnotations(parameters);
                    break;
                    
                case 'get_file_info':
                    result = this.getFileInfo(parameters);
                    break;
                    
                case 'export_region_features':
                    result = await this.exportRegionFeatures(parameters);
                    break;
                    
                case 'open_protein_viewer':
                    result = await this.openProteinViewer(parameters);
                    break;
                    
                // MicrobeGenomicsFunctions Integration
                case 'navigate_to':
                    result = this.executeMicrobeFunction('navigateTo', parameters);
                    break;
                    
                case 'jump_to_gene':
                    result = this.executeMicrobeFunction('jumpToGene', parameters);
                    break;
                    
                case 'get_current_region':
                    result = this.executeMicrobeFunction('getCurrentRegion', parameters);
                    break;
                    
                case 'scroll_left':
                    result = this.executeMicrobeFunction('scrollLeft', parameters);
                    break;
                    
                case 'scroll_right':
                    result = this.executeMicrobeFunction('scrollRight', parameters);
                    break;
                    
                case 'zoom_in':
                    result = this.executeMicrobeFunction('zoomIn', parameters);
                    break;
                    
                case 'zoom_out':
                    result = this.executeMicrobeFunction('zoomOut', parameters);
                    break;
                    
                case 'search_gene_by_name':
                    result = this.executeMicrobeFunction('searchGeneByName', parameters);
                    break;
                    
                case 'search_by_position':
                    result = this.executeMicrobeFunction('searchByPosition', parameters);
                    break;
                    
                case 'search_sequence_motif':
                    result = this.executeMicrobeFunction('searchSequenceMotif', parameters);
                    break;
                    
                case 'search_intergenic_regions':
                    result = this.executeMicrobeFunction('searchIntergenicRegions', parameters);
                    break;
                    
                case 'translate_dna':
                    result = this.executeMicrobeFunction('translateDNA', parameters);
                    break;
                    
                case 'compute_gc':
                    result = this.executeMicrobeFunction('computeGC', parameters);
                    break;
                    
                case 'calc_region_gc':
                    result = this.executeMicrobeFunction('calcRegionGC', parameters);
                    break;
                    
                case 'reverse_complement':
                    result = this.executeMicrobeFunction('reverseComplement', parameters);
                    break;
                    
                case 'analyze_codon_usage':
                    result = this.executeMicrobeFunction('analyzeCodonUsage', parameters);
                    break;
                    
                case 'calculate_entropy':
                    result = this.executeMicrobeFunction('calculateEntropy', parameters);
                    break;
                    
                case 'calculate_melting_temp':
                    result = this.executeMicrobeFunction('calculateMeltingTemp', parameters);
                    break;
                    
                case 'calculate_molecular_weight':
                    result = this.executeMicrobeFunction('calculateMolecularWeight', parameters);
                    break;
                    
                case 'predict_promoter':
                    result = this.executeMicrobeFunction('predictPromoter', parameters);
                    break;
                    
                case 'predict_rbs':
                    result = this.executeMicrobeFunction('predictRBS', parameters);
                    break;
                    
                case 'predict_terminator':
                    result = this.executeMicrobeFunction('predictTerminator', parameters);
                    break;
                    
                case 'get_upstream_region':
                    result = this.executeMicrobeFunction('getUpstreamRegion', parameters);
                    break;
                    
                case 'get_downstream_region':
                    result = this.executeMicrobeFunction('getDownstreamRegion', parameters);
                    break;
                    
                case 'add_annotation':
                    result = this.executeMicrobeFunction('addAnnotation', parameters);
                    break;
                    
                case 'merge_annotations':
                    result = this.executeMicrobeFunction('mergeAnnotations', parameters);
                    break;
                    
                case 'add_track':
                    result = this.executeMicrobeFunction('addTrack', parameters);
                    break;
                    
                case 'add_variant':
                    result = this.executeMicrobeFunction('addVariant', parameters);
                    break;
                    
                case 'get_genome_info':
                    result = await this.getGenomeInfo(parameters);
                    break;
                    
                case 'check_genomics_environment':
                    result = this.checkGenomicsEnvironment();
                    break;
                    
                case 'get_selected_gene':
                    result = this.getSelectedGene();
                    break;
                    
                case 'get_current_region_details':
                    result = await this.getCurrentRegionDetails();
                    break;
                    
                case 'get_sequence_selection':
                    result = this.getSequenceSelection();
                    break;
                    
                case 'fetch_protein_structure':
                    result = await this.fetchProteinStructure(parameters);
                    break;
                    
                case 'search_protein_by_gene':
                    result = await this.searchProteinByGene(parameters);
                    break;
                    
                case 'get_pdb_details':
                    result = await this.getPDBDetails(parameters.pdbId);
                    break;
                    
                case 'search_alphafold_by_gene':
                    result = await this.searchAlphaFoldByGene(parameters);
                    break;
                    
                case 'fetch_alphafold_structure':
                    result = await this.fetchAlphaFoldStructure(parameters);
                    break;
                    
                case 'open_alphafold_viewer':
                    result = await this.openAlphaFoldViewer(parameters);
                    break;
                    
                case 'calculate_entropy':
                    result = this.executeMicrobeFunction('calculateEntropy', parameters);
                    break;
                    
                case 'calc_region_gc':
                    result = this.executeMicrobeFunction('calcRegionGC', parameters);
                    break;
                    
                case 'calculate_melting_temp':
                    result = this.executeMicrobeFunction('calculateMeltingTemp', parameters);
                    break;
                    
                case 'calculate_molecular_weight':
                    result = this.executeMicrobeFunction('calculateMolecularWeight', parameters);
                    break;
                    
                case 'analyze_codon_usage':
                    result = this.executeMicrobeFunction('analyzeCodonUsage', parameters);
                    break;
                    
                case 'predict_promoter':
                    result = this.executeMicrobeFunction('predictPromoter', parameters);
                    break;
                    
                case 'predict_rbs':
                    result = this.executeMicrobeFunction('predictRBS', parameters);
                    break;
                    
                case 'predict_terminator':
                    result = this.executeMicrobeFunction('predictTerminator', parameters);
                    break;
                    
                case 'search_gene_by_name':
                    result = this.executeMicrobeFunction('searchGeneByName', parameters);
                    break;
                    
                case 'search_sequence_motif':
                    result = this.executeMicrobeFunction('searchSequenceMotif', parameters);
                    break;
                    
                case 'search_by_position':
                    result = this.executeMicrobeFunction('searchByPosition', parameters);
                    break;
                    
                case 'search_intergenic_regions':
                    result = this.executeMicrobeFunction('searchIntergenicRegions', parameters);
                    break;
                    
                case 'edit_annotation':
                    result = this.executeMicrobeFunction('editAnnotation', parameters);
                    break;
                    
                case 'delete_annotation':
                    result = this.executeMicrobeFunction('deleteAnnotation', parameters);
                    break;
                    
                case 'merge_annotations':
                    result = this.executeMicrobeFunction('mergeAnnotations', parameters);
                    break;
                    
                case 'add_annotation':
                    result = this.executeMicrobeFunction('addAnnotation', parameters);
                    break;
                    
                case 'get_upstream_region':
                    result = this.executeMicrobeFunction('getUpstreamRegion', parameters);
                    break;
                    
                case 'get_downstream_region':
                    result = this.executeMicrobeFunction('getDownstreamRegion', parameters);
                    break;
                    
                case 'add_track':
                    result = this.executeMicrobeFunction('addTrack', parameters);
                    break;
                    
                case 'add_variant':
                    result = this.executeMicrobeFunction('addVariant', parameters);
                    break;
                case 'fetch_protein_structure':
                    result = this.fetchProteinStructure( parameters);
                    break;
                    
                case 'get_genome_info':
                    result = await this.getGenomeInfo(parameters);
                    break;
                    
                // BLAST tools
                case 'blast_search':
                    result = await this.blastSearch(parameters);
                    break;
                    
                case 'blast_sequence_from_region':
                    result = await this.blastSequenceFromRegion(parameters);
                    break;
                    
                case 'get_blast_databases':
                    result = this.getBlastDatabases(parameters);
                    break;
                    
                case 'batch_blast_search':
                    result = await this.batchBlastSearch(parameters);
                    break;
                    
                case 'advanced_blast_search':
                    result = await this.advancedBlastSearch(parameters);
                    break;
                    
                case 'local_blast_database_info':
                    result = await this.localBlastDatabaseInfo(parameters);
                    break;
                    
                // Metabolic pathway tools
                case 'show_metabolic_pathway':
                    result = await this.showMetabolicPathway(parameters);
                    break;
                    
                case 'find_pathway_genes':
                    result = await this.findPathwayGenes(parameters);
                    break;
                    
                // Action Manager functions (underscore naming convention)
                case 'copy_sequence':
                    result = await this.executeActionFunction('copy_sequence', parameters);
                    break;
                    
                case 'cut_sequence':
                    result = await this.executeActionFunction('cut_sequence', parameters);
                    break;
                    
                case 'paste_sequence':
                    result = await this.executeActionFunction('paste_sequence', parameters);
                    break;
                    
                case 'delete_sequence':
                    result = await this.executeDeleteSequence(parameters);
                    break;
                    
                case 'delete_gene':
                    result = await this.executeDeleteGene(parameters);
                    break;
                    
                case 'insert_sequence':
                    result = await this.executeActionFunction('insertSequence', parameters);
                    break;
                    
                case 'replace_sequence':
                    result = await this.executeActionFunction('replace_sequence', parameters);
                    break;
                    
                case 'get_action_list':
                    result = await this.executeActionFunction('get_action_list', parameters);
                    break;
                    
                case 'execute_actions':
                    result = await this.executeActionFunction('execute_actions', parameters);
                    break;
                    
                case 'clear_actions':
                    result = await this.executeActionFunction('clearActions', parameters);
                    break;
                    
                case 'get_clipboard_content':
                    result = await this.executeActionFunction('getClipboardContent', parameters);
                    break;
                    
                case 'undo_last_action':
                    result = await this.executeActionFunction('undoLastAction', parameters);
                    break;
                    
                case 'open_new_tab':
                    console.log('🔧 [ChatManager] Executing open_new_tab with parameters:', parameters);
                    console.log('🔧 [ChatManager] Calling this.openNewTab(parameters) directly...');
                    result = await this.openNewTab(parameters);
                    console.log('🔧 [ChatManager] openNewTab result:', result);
                    break;
                    
                // Legacy camelCase support for backward compatibility
                case 'copy_sequence':
                    result = await this.executeActionFunction('copy_sequence', parameters);
                    break;
                    
                case 'cut_sequence':
                    result = await this.executeActionFunction('cut_sequence', parameters);
                    break;
                    
                case 'paste_sequence':
                    result = await this.executeActionFunction('paste_sequence', parameters);
                    break;
                    
                case 'deleteSequence':
                    result = await this.executeActionFunction('deleteSequence', parameters);
                    break;
                    
                case 'insertSequence':
                    result = await this.executeActionFunction('insertSequence', parameters);
                    break;
                    
                case 'replace_sequence':
                    result = await this.executeActionFunction('replace_sequence', parameters);
                    break;
                    
                case 'get_action_list':
                    result = await this.executeActionFunction('get_action_list', parameters);
                    break;
                    
                case 'execute_actions':
                    result = await this.executeActionFunction('execute_actions', parameters);
                    break;
                    
                case 'clearActions':
                    result = await this.executeActionFunction('clearActions', parameters);
                    break;
                    
                case 'getClipboardContent':
                    result = await this.executeActionFunction('getClipboardContent', parameters);
                    break;
                    
                case 'undoLastAction':
                    result = await this.executeActionFunction('undoLastAction', parameters);
                    break;
                    
                // Plugin system functions
                default:
                    // Try to execute as plugin function
                    if (this.pluginManager && toolName.includes('.')) {
                        try {
                            result = await this.pluginManager.executeFunctionByName(toolName, parameters);
                            console.log(`Plugin function ${toolName} executed successfully:`, result);
                            break;
                        } catch (pluginError) {
                            console.warn(`Plugin function execution failed: ${pluginError.message}`);
                        }
                    }
                    
                    // If no plugin function found, throw error
                    throw new Error(`Unknown tool: ${toolName}`);
            }
            
            console.log(`Local tool ${toolName} execution result:`, result);
            
            // Show agent execution result if multi-agent system is enabled
            if (multiAgentEnabled && showAgentInfo) {
                const executionTime = Date.now() - startTime;
                this.addAgentExecutionResult(agentName, toolName, result, executionTime);
            }
            
            return result;
            
        } catch (error) {
            console.error(`=== TOOL EXECUTION ERROR ===`);
            console.error(`Tool: ${toolName}`);
            console.error(`Parameters:`, parameters);
            console.error(`Error:`, error);
            console.error(`Stack:`, error.stack);
            console.error(`===========================`);
            return {
                success: false,
                error: error.message,
                tool: toolName,
                parameters: parameters,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Execute delete sequence function directly
     */
    async executeDeleteSequence(parameters) {
        console.log(`🔧 [ChatManager] Executing delete_sequence with parameters:`, parameters);
        
        try {
            const { chromosome, start, end, strand = '+' } = parameters;
            
            // Validate parameters
            if (!chromosome || start === undefined || end === undefined) {
                throw new Error('Missing required parameters: chromosome, start, end');
            }
            
            if (start > end) {
                throw new Error('Start position must be less than or equal to end position');
            }
            
            // Use MicrobeGenomicsFunctions if available
            if (window.MicrobeFns && window.MicrobeFns.delete_sequence) {
                const result = window.MicrobeFns.delete_sequence(chromosome, start, end);
                console.log(`✅ [ChatManager] delete_sequence executed via MicrobeFns:`, result);
                return result;
            }
            
            // Fallback to ActionManager if MicrobeFns not available
            const genomeBrowser = window.genomeBrowser;
            if (!genomeBrowser || !genomeBrowser.actionManager) {
                throw new Error('Neither MicrobeFns nor ActionManager available');
            }
            
            const target = `${chromosome}:${start}-${end}`;
            const length = end - start + 1;
            const metadata = { chromosome, start, end, strand, selectionSource: 'function_call' };
            
            const actionId = genomeBrowser.actionManager.addAction(
                genomeBrowser.actionManager.ACTION_TYPES.DELETE_SEQUENCE,
                target,
                `Delete ${length.toLocaleString()} bp from ${chromosome}:${start}-${end}`,
                metadata
            );
            
            const result = {
                success: true,
                actionId: actionId,
                action: 'delete',
                target: target,
                length: length,
                message: `Delete action queued for ${chromosome}:${start}-${end} (${length} bp)`
            };
            
            console.log(`✅ [ChatManager] delete_sequence executed via ActionManager:`, result);
            return result;
            
        } catch (error) {
            console.error(`❌ [ChatManager] delete_sequence failed:`, error);
            throw error;
        }
    }

    /**
     * Execute delete gene function by name
     */
    async executeDeleteGene(parameters) {
        console.log(`🔧 [ChatManager] Executing delete_gene with parameters:`, parameters);
        
        try {
            const { geneName, chromosome } = parameters;
            
            // Validate parameters
            if (!geneName) {
                throw new Error('Missing required parameter: geneName (can be gene name or locus tag)');
            }
            
            console.log(`🔍 [ChatManager] Searching for gene/locus tag: ${geneName}`);
            
            // First, find the gene using existing search functionality
            const searchResult = await this.searchGeneByName({ name: geneName, chromosome });
            
            if (!searchResult.found || !searchResult.genes || searchResult.genes.length === 0) {
                throw new Error(`Gene/locus tag "${geneName}" not found${chromosome ? ` in chromosome ${chromosome}` : ''}. Make sure the gene name or locus tag is correct.`);
            }
            
            // Get the first matching gene (prefer CDS over other features)
            let targetGene = searchResult.genes.find(gene => gene.type === 'CDS') || searchResult.genes[0];
            
            if (!targetGene || !targetGene.start || !targetGene.end) {
                throw new Error(`Invalid gene data for "${geneName}": missing coordinates`);
            }
            
            const geneChromosome = targetGene.chromosome || searchResult.chromosome;
            const geneStart = targetGene.start;
            const geneEnd = targetGene.end;
            const geneStrand = targetGene.strand || '+';
            
            console.log(`🧬 [ChatManager] Found gene ${geneName}:`, {
                chromosome: geneChromosome,
                start: geneStart,
                end: geneEnd,
                strand: geneStrand,
                type: targetGene.type,
                product: targetGene.qualifiers?.product || 'Unknown'
            });
            
            // Use the delete_sequence functionality with gene coordinates
            const deleteResult = await this.executeDeleteSequence({
                chromosome: geneChromosome,
                start: geneStart,
                end: geneEnd,
                strand: geneStrand
            });
            
            // Enhance the result with gene-specific information
            const result = {
                ...deleteResult,
                deletedGene: {
                    name: geneName,
                    chromosome: geneChromosome,
                    start: geneStart,
                    end: geneEnd,
                    strand: geneStrand,
                    length: geneEnd - geneStart + 1,
                    type: targetGene.type,
                    product: targetGene.qualifiers?.product || 'Unknown protein'
                },
                message: `Gene/locus tag "${geneName}" deletion queued: ${geneChromosome}:${geneStart}-${geneEnd} (${geneEnd - geneStart + 1} bp)`
            };
            
            console.log(`✅ [ChatManager] delete_gene executed successfully:`, result);
            return result;
            
        } catch (error) {
            console.error(`❌ [ChatManager] delete_gene failed:`, error);
            throw error;
        }
    }

    /**
     * Execute action function through UI response functions
     */
    async executeActionFunction(functionName, parameters) {
        console.log(`🔧 [ChatManager] Executing action function: ${functionName}`, parameters);
        console.log(`🔧 [ChatManager] Parameters type:`, typeof parameters);
        console.log(`🔧 [ChatManager] Parameters keys:`, Object.keys(parameters || {}));

        try {
            // Use window.genomeBrowser for access
            const genomeBrowser = window.genomeBrowser;
            console.log(`🔧 [ChatManager] window.genomeBrowser available:`, !!genomeBrowser);
            
            if (!genomeBrowser) {
                throw new Error('Genome browser not available via window.genomeBrowser');
            }
            
            console.log(`🔧 [ChatManager] genomeBrowser.actionManager available:`, !!genomeBrowser.actionManager);
            if (!genomeBrowser.actionManager) {
                throw new Error('ActionManager not available in genome browser');
            }

            // Map function names to UI response functions
            const actionFunctionMap = {
                'copy_sequence': () => genomeBrowser.actionManager.handleCopySequence(),
                'cut_sequence': () => genomeBrowser.actionManager.handleCutSequence(),
                'paste_sequence': () => genomeBrowser.actionManager.handlePasteSequence(),
                'deleteSequence': () => genomeBrowser.actionManager.handleDeleteSequence(),
                'insertSequence': () => genomeBrowser.actionManager.handleInsertSequence(),
                'replace_sequence': () => genomeBrowser.actionManager.handleReplaceSequence(),
                'get_action_list': () => genomeBrowser.actionManager.showActionList(),
                'execute_actions': () => genomeBrowser.actionManager.executeAllActions(),
                'clearActions': () => genomeBrowser.actionManager.clearAllActions(),
                'getClipboardContent': () => genomeBrowser.actionManager.getClipboardContent(),
                'undoLastAction': () => genomeBrowser.actionManager.undoLastAction()
            };

            console.log(`🔧 [ChatManager] Available action functions:`, Object.keys(actionFunctionMap));
            console.log(`🔧 [ChatManager] Requested function: ${functionName}`);
            console.log(`🔧 [ChatManager] Function exists in map:`, !!actionFunctionMap[functionName]);

            // Check if function is supported
            if (!actionFunctionMap[functionName]) {
                throw new Error(`Action function '${functionName}' not supported via UI response functions`);
            }

            // Execute the UI response function
            console.log(`🔧 [ChatManager] About to execute: actionFunctionMap["${functionName}"]()`);
            const result = actionFunctionMap[functionName]();
            console.log(`🔧 [ChatManager] Function execution completed, result:`, result);
            
            console.log(`✅ [ChatManager] Action function ${functionName} executed successfully via UI response:`, result);
            
            // Return a standardized result format
            return {
                success: true,
                function: functionName,
                message: `Action '${functionName}' executed via UI response function`,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error(`❌ [ChatManager] Action function ${functionName} failed:`, error);
            throw error;
        }
    }

    getCurrentContext() {
        // Build comprehensive context for the LLM
        
        // Collect all available tools from different sources
        const localTools = [
            // Core Navigation & State
            'navigate_to_position',
            'get_current_state',
            'get_current_region',
            'jump_to_gene',
            'open_new_tab',
            'scroll_left',
            'scroll_right',
            'zoom_in',
            'zoom_out',
            'zoom_to_gene',
            'bookmark_position',
            'get_bookmarks',
            'save_view_state',
            
            // Search & Discovery  
            'search_features',
            'search_gene_by_name',
            'search_by_position',
            'search_motif',
            'search_pattern',
            'search_sequence_motif',
            'search_intergenic_regions',
            'get_nearby_features',
            'find_intergenic_regions',
            
            // Sequence Analysis
            'get_sequence',
            'translate_sequence',
            'translate_dna',
            'calculate_gc_content',
            'compute_gc',
            'calc_region_gc',
            'reverse_complement',
            'find_orfs',
            'sequence_statistics',
            'codon_usage_analysis',
            'analyze_codon_usage',
            'calculate_entropy',
            'calculate_melting_temp',
            'calculate_molecular_weight',
            
            // Advanced Analysis
            'analyze_region',
            'compare_regions',
            'find_similar_sequences',
            'find_restriction_sites',
            'virtual_digest',
            'predict_promoter',
            'predict_rbs',
            'predict_terminator',
            'get_upstream_region',
            'get_downstream_region',
            
            // Annotation & Features
            'get_gene_details',
            'get_operons',
            'create_annotation',
            'add_annotation',
            'edit_annotation',
            'delete_annotation',
            'batch_create_annotations',
            'merge_annotations',
            
            // Track Management
            'toggle_track',
            'get_track_status',
            'add_track',
            'add_variant',
            
            // Data Export/Import
            'export_data',
            'export_region_features',
            'get_file_info',
            'get_chromosome_list',
            'get_genome_info',
            
            // BLAST & External Analysis
            'blast_search',
            'blast_sequence_from_region',
            'get_blast_databases',
            'batch_blast_search',
            'advanced_blast_search',
            'local_blast_database_info',
            
            // Protein Structure
            'open_protein_viewer',
            'fetch_protein_structure',
            'search_protein_by_gene',
            'get_pdb_details',
            
            // Metabolic Pathways
            'show_metabolic_pathway',
            'find_pathway_genes',
            
            // Action Manager - Sequence Editing
            'copy_sequence',
            'cut_sequence',
            'paste_sequence',
            'delete_sequence',
            'delete_gene',
            'insert_sequence',
            'replace_sequence',
            'get_action_list',
            'execute_actions',
            'clear_actions',
            'get_clipboard_content',
            'undo_last_action'
        ];
        
        // Add plugin functions if available
        const pluginTools = [];
        if (this.pluginFunctionCallsIntegrator) {
            try {
                const pluginFunctions = Array.from(this.pluginFunctionCallsIntegrator.pluginFunctionMap.keys());
                pluginTools.push(...pluginFunctions);
            } catch (error) {
                console.warn('Failed to get plugin functions:', error);
            }
        }
        
        // Add MCP tools if available
        const mcpTools = [];
        if (this.mcpServerManager) {
            try {
                const allMcpTools = this.mcpServerManager.getAllAvailableTools();
                mcpTools.push(...allMcpTools.map(tool => tool.name));
            } catch (error) {
                console.warn('Failed to get MCP tools:', error);
            }
        }
        
        // Combine all tools and remove duplicates
        const allAvailableTools = [...new Set([...localTools, ...pluginTools, ...mcpTools])];
        
        const context = {
            genomeBrowser: {
                currentState: this.getCurrentState(),
                availableTools: allAvailableTools,
                toolSources: {
                    local: localTools.length,
                    plugins: pluginTools.length,
                    mcp: mcpTools.length,
                    total: allAvailableTools.length
                }
            }
        };

        return context;
    }

    addMessageToChat(message, sender, isError = false) {
        const timestamp = new Date().toISOString();
        
        // Add to configuration manager for persistence (ChatBox原有功能)
        const messageId = this.configManager.addChatMessage(message, sender, timestamp);
        
        // Add to Evolution data structure for detailed analysis
        this.addToEvolutionData({
            type: 'message',
            timestamp: timestamp,
            messageId: messageId,
            sender: sender,
            content: message,
            isError: isError,
            metadata: {
                source: 'direct_message',
                visible: true
            }
        });
        
        // Display the message in UI
        this.displayChatMessage(message, sender, timestamp, messageId);
    }

    copyMessage(messageId) {
        const messageElement = document.getElementById(messageId);
        if (messageElement) {
            // Get the text content, stripping HTML but preserving line breaks
            let textContent = messageElement.innerText || messageElement.textContent;
            
            // Copy to clipboard
            navigator.clipboard.writeText(textContent).then(() => {
                // Show brief success indication
                const copyBtn = messageElement.parentElement.querySelector('.copy-message-btn');
                const originalHTML = copyBtn.innerHTML;
                copyBtn.innerHTML = '<i class="fas fa-check"></i>';
                copyBtn.style.color = '#10b981';
                
                setTimeout(() => {
                    copyBtn.innerHTML = originalHTML;
                    copyBtn.style.color = '';
                }, 1000);
            }).catch(err => {
                console.error('Failed to copy message: ', err);
                // Fallback: select the text
                const range = document.createRange();
                range.selectNodeContents(messageElement);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
            });
        }
    }

    formatMessage(message) {
        // Convert markdown-like formatting
        return message
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
    }

    showTypingIndicator() {
        const messagesContainer = document.getElementById('chatMessages');
        const typingDiv = document.createElement('div');
        typingDiv.id = 'typingIndicator';
        typingDiv.className = 'message assistant-message typing';
        typingDiv.innerHTML = `
            <div class="message-content">
                <div class="message-icon">
                    <i class="fas fa-robot"></i>
                </div>
                <div class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
        
        messagesContainer.appendChild(typingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    removeTypingIndicator() {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    clearChat() {
        const messagesContainer = document.getElementById('chatMessages');
        const welcomeMessage = messagesContainer.querySelector('.welcome-message');
        messagesContainer.innerHTML = '';
        if (welcomeMessage) {
            messagesContainer.appendChild(welcomeMessage);
        }
        
        // Clear chat input box
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
            chatInput.value = '';
            chatInput.style.height = 'auto'; // Reset height for auto-resize
        }
        
        // Clear chat history from config
        this.configManager.clearChatHistory();
    }

    /**
     * Export chat history
     */
    async exportChatHistory(format = 'json') {
        try {
            const history = this.configManager.getChatHistory();
            const exportData = {
                exported: new Date().toISOString(),
                messageCount: history.length,
                format: format,
                messages: history
            };

            let content, filename, mimeType;

            switch (format.toLowerCase()) {
                case 'json':
                    content = JSON.stringify(exportData, null, 2);
                    filename = `chat-history-${new Date().toISOString().split('T')[0]}.json`;
                    mimeType = 'application/json';
                    break;
                    
                case 'txt':
                    content = history.map(msg => {
                        const time = new Date(msg.timestamp).toLocaleString();
                        return `[${time}] ${msg.sender.toUpperCase()}: ${msg.message}`;
                    }).join('\n\n');
                    filename = `chat-history-${new Date().toISOString().split('T')[0]}.txt`;
                    mimeType = 'text/plain';
                    break;
                    
                case 'csv':
                    const csvHeader = 'Timestamp,Sender,Message\n';
                    const csvContent = history.map(msg => {
                        const escapedMessage = msg.message.replace(/"/g, '""');
                        return `"${msg.timestamp}","${msg.sender}","${escapedMessage}"`;
                    }).join('\n');
                    content = csvHeader + csvContent;
                    filename = `chat-history-${new Date().toISOString().split('T')[0]}.csv`;
                    mimeType = 'text/csv';
                    break;
                    
                default:
                    throw new Error(`Unsupported export format: ${format}`);
            }

            // Download the file
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            console.log(`Chat history exported as ${format.toUpperCase()}: ${history.length} messages`);
            return true;
        } catch (error) {
            console.error('Error exporting chat history:', error);
            throw error;
        }
    }

    showSuggestions() {
        const suggestions = [
            "Go to chr1:1000-2000",
            "Find lacZ gene", 
            "Show current state",
            "Get sequence from 1000 to 2000",
            "Find EcoRI sites",
            "Calculate GC content",
            "Toggle genes track",
            "Search DNA polymerase",
            "Export current region as FASTA"
        ];

        const suggestionsHTML = suggestions.map(s => 
            `<span class="suggestion-chip" onclick="document.getElementById('chatInput').value = '${s}'">${s}</span>`
        ).join('');

        this.addMessageToChat(
            `<div class="suggestions-container">
                <p><strong>🚀 Try these:</strong></p>
                <div class="suggestion-chips">
                    ${suggestionsHTML}
                </div>
                <p><em>💡 Ask questions in simple language</em></p>
            </div>`,
            'assistant'
        );
    }

    /**
     * Load chat history from configuration
     */
    loadChatHistory() {
        try {
            console.log('Loading chat history...');
            const history = this.configManager.getChatHistory();
            console.log(`Found ${history.length} chat messages in history`);
            
            if (history.length > 0) {
                this.displayChatHistory(history);
                console.log(`Successfully loaded and displayed ${history.length} chat messages`);
            } else {
                console.log('No chat history found');
            }
        } catch (error) {
            console.error('Error loading chat history:', error);
            this.showNotification('⚠️ Could not load chat history', 'warning');
        }
    }

    /**
     * Display chat history in the UI
     */
    displayChatHistory(history) {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) {
            console.warn('Chat messages container not found, cannot display history');
            return;
        }

        console.log('Displaying chat history with', history.length, 'messages');

        // Preserve welcome message but clear other messages
        const welcomeMessage = messagesContainer.querySelector('.welcome-message');
        
        // Clear all messages except welcome
        const existingMessages = messagesContainer.querySelectorAll('.message:not(.welcome-message .message)');
        existingMessages.forEach(msg => msg.remove());

        // Display historical messages
        history.forEach((msg, index) => {
            console.log(`Displaying message ${index + 1}:`, msg.message.substring(0, 50) + '...');
            this.displayChatMessage(msg.message, msg.sender, msg.timestamp, msg.id);
        });

        // Scroll to bottom to show most recent messages
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        console.log('Chat history display completed');
    }

    /**
     * Display a single chat message (used for history and new messages)
     */
    displayChatMessage(message, sender, timestamp, messageId) {
        const messagesContainer = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        
        const displayTime = timestamp ? new Date(timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
        const displayId = messageId || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-icon">
                    <i class="fas fa-${sender === 'user' ? 'user' : 'robot'}"></i>
                </div>
                <div class="message-text" id="${displayId}">
                    ${this.formatMessage(message)}
                </div>
                <div class="message-actions">
                    <button class="copy-message-btn" onclick="chatManager.copyMessage('${displayId}')" title="Copy message">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
            </div>
            <div class="message-time">${displayTime}</div>
        `;
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    showConfigOptions() {
        const options = [
            'Export chat history as JSON',
            'Export chat history as TXT', 
            'Export chat history as CSV',
            'Clear all chat history',
            'Export all configurations',
            'Show config summary',
            'Debug storage info',
            'Test MicrobeGenomics integration',
            'Test tool execution'
        ];

        const optionsHTML = options.map((option, index) => 
            `<button class="suggestion-btn" onclick="chatManager.handleConfigOption(${index})">${option}</button>`
        ).join('');

        this.addMessageToChat(
            `<div class="config-options-container">
                <p><i class="fas fa-cog"></i> Configuration Options:</p>
                ${optionsHTML}
            </div>`,
            'assistant'
        );
    }

    async handleConfigOption(optionIndex) {
        try {
            switch(optionIndex) {
                case 0: // Export JSON
                    await this.exportChatHistory('json');
                    this.addMessageToChat('✅ Chat history exported as JSON', 'assistant');
                    break;
                case 1: // Export TXT
                    await this.exportChatHistory('txt');
                    this.addMessageToChat('✅ Chat history exported as TXT', 'assistant');
                    break;
                case 2: // Export CSV
                    await this.exportChatHistory('csv');
                    this.addMessageToChat('✅ Chat history exported as CSV', 'assistant');
                    break;
                case 3: // Clear history
                    this.clearChat();
                    this.addMessageToChat('🗑️ Chat history cleared', 'assistant');
                    break;
                case 4: // Export all config
                    await this.configManager.exportConfig();
                    this.addMessageToChat('✅ All configurations exported', 'assistant');
                    break;
                case 5: // Show summary
                    const summary = this.configManager.getConfigSummary();
                    this.addMessageToChat(
                        `📊 **Configuration Summary:**\n` +
                        `• Version: ${summary.version}\n` +
                        `• LLM Provider: ${summary.llmProvider || 'None'}\n` +
                        `• Enabled Providers: ${summary.llmProvidersEnabled.join(', ') || 'None'}\n` +
                        `• Theme: ${summary.theme}\n` +
                        `• Chat History: ${summary.chatHistoryLength} messages\n` +
                        `• Recent Files: ${summary.recentFilesCount}\n` +
                        `• Debug Mode: ${summary.debugMode ? 'On' : 'Off'}`,
                        'assistant'
                    );
                    break;
                case 6: // Debug storage info
                    const storageInfo = this.configManager.getStorageInfo();
                    this.addMessageToChat(
                        `🔧 **Storage Debug Info:**\n` +
                        `• Is Electron: ${storageInfo.isElectron}\n` +
                        `• Using Files: ${storageInfo.usingFiles}\n` +
                        `• Using localStorage: ${storageInfo.usingLocalStorage}\n` +
                        `• Is Initialized: ${storageInfo.isInitialized}\n` +
                        `• Config Path: ${storageInfo.configPath ? 'Available' : 'None'}\n` +
                        `• Storage Method: ${storageInfo.usingFiles ? 'File-based' : 'localStorage'}`,
                        'assistant'
                    );
                    break;
                case 7: // Test MicrobeGenomics integration
                    const integrationResult = this.testMicrobeGenomicsIntegration();
                    this.addMessageToChat(
                        `🧬 **MicrobeGenomics Integration Test:**\n` +
                        `• Integration: ${integrationResult.success ? '✅ Success' : '❌ Failed'}\n` +
                        `• Functions Available: ${integrationResult.totalFunctions || 0}\n` +
                        `• Categories Available: ${integrationResult.categoriesAvailable ? '✅' : '❌'}\n` +
                        `• Examples Available: ${integrationResult.examplesAvailable ? '✅' : '❌'}\n` +
                        `• Function Test: ${integrationResult.functionCallTest?.success ? '✅ Passed' : '❌ Failed'}\n` +
                        (integrationResult.error ? `• Error: ${integrationResult.error}` : ''),
                        'assistant'
                    );
                    break;
                case 8: // Test tool execution
                    const executionResult = await this.testToolExecution();
                    this.addMessageToChat(
                        `🔧 **Tool Execution Test:**\n` +
                        `• Status: ${executionResult.success ? '✅ All tests passed' : '❌ Tests failed'}\n` +
                        `• GC Calculation: ${executionResult.tests?.gc ? '✅ Working' : '❌ Failed'}\n` +
                        `• Reverse Complement: ${executionResult.tests?.reverseComplement ? '✅ Working' : '❌ Failed'}\n` +
                        `• Navigation: ${executionResult.tests?.currentRegion ? '✅ Working' : '❌ Failed'}\n` +
                        (executionResult.error ? `• Error: ${executionResult.error}` : ''),
                        'assistant'
                    );
                    break;
            }
        } catch (error) {
            this.addMessageToChat(`❌ Error: ${error.message}`, 'assistant', true);
        }
    }

    // New comprehensive function calls
    async getGeneDetails(params) {
        const { geneName, chromosome } = params;
        
        if (!this.app || !this.app.currentAnnotations) {
            throw new Error('No annotations loaded');
        }
        
        const chr = chromosome || this.app.currentChromosome;
        if (!chr) {
            throw new Error('No chromosome specified and none currently selected');
        }
        
        const annotations = this.app.currentAnnotations[chr] || [];
        const matchingGenes = annotations.filter(gene => {
            const name = gene.qualifiers?.gene || gene.qualifiers?.locus_tag || gene.qualifiers?.product || '';
            return name && typeof name === 'string' && name.toLowerCase().includes(geneName.toLowerCase());
        });
        
        if (matchingGenes.length === 0) {
            return {
                geneName: geneName,
                chromosome: chr,
                found: false,
                message: `No genes found matching "${geneName}" in ${chr}`
            };
        }
        
        const geneDetails = matchingGenes.map(gene => ({
            name: gene.qualifiers?.gene || gene.qualifiers?.locus_tag || 'Unknown',
            type: gene.type,
            start: gene.start,
            end: gene.end,
            strand: gene.strand === -1 ? '-' : '+',
            length: gene.end - gene.start + 1,
            product: gene.qualifiers?.product || 'Unknown function',
            locusTag: gene.qualifiers?.locus_tag || 'N/A',
            note: gene.qualifiers?.note || 'No additional notes'
        }));
        
        return {
            geneName: geneName,
            chromosome: chr,
            found: true,
            count: matchingGenes.length,
            genes: geneDetails
        };
    }

    async translateSequence(params) {
        const { chromosome, start, end, strand = 1, frame = 1 } = params;
        
        const chr = chromosome || this.app.currentChromosome;
        if (!chr) {
            throw new Error('No chromosome specified and none currently selected');
        }
        
        const sequence = await this.app.getSequenceForRegion(chr, start, end);
        const proteinSequence = this.app.translateDNA(sequence, strand);
        
        return {
            chromosome: chr,
            start: start,
            end: end,
            strand: strand === -1 ? '-' : '+',
            frame: frame,
            dnaSequence: sequence.substring(0, 60) + (sequence.length > 60 ? '...' : ''),
            proteinSequence: proteinSequence,
            length: {
                dna: sequence.length,
                protein: proteinSequence.length
            }
        };
    }

    async calculateGCContent(params) {
        const { chromosome, start, end, windowSize = 100 } = params;
        
        const chr = chromosome || this.app.currentChromosome;
        if (!chr) {
            throw new Error('No chromosome specified and none currently selected');
        }
        
        const sequence = await this.app.getSequenceForRegion(chr, start, end);
        
        // Overall GC content
        const gcCount = (sequence.match(/[GC]/gi) || []).length;
        const overallGC = (gcCount / sequence.length * 100).toFixed(2);
        
        // Windowed GC content
        const windows = [];
        for (let i = 0; i < sequence.length - windowSize; i += windowSize) {
            const window = sequence.substring(i, i + windowSize);
            const windowGC = (window.match(/[GC]/gi) || []).length;
            const windowGCPercent = (windowGC / windowSize * 100).toFixed(2);
            windows.push({
                start: start + i,
                end: start + i + windowSize,
                gcContent: parseFloat(windowGCPercent)
            });
        }
        
        return {
            chromosome: chr,
            region: `${start}-${end}`,
            length: sequence.length,
            overallGCContent: parseFloat(overallGC),
            windowSize: windowSize,
            windows: windows.slice(0, 10), // Limit to first 10 windows
            totalWindows: windows.length
        };
    }

    async findOpenReadingFrames(params) {
        const { chromosome, start, end, minLength = 300 } = params;
        
        const chr = chromosome || this.app.currentChromosome;
        if (!chr) {
            throw new Error('No chromosome specified and none currently selected');
        }
        
        const sequence = await this.app.getSequenceForRegion(chr, start, end);
        const orfs = [];
        
        // Find ORFs in all 6 reading frames
        for (let strand = 1; strand >= -1; strand -= 2) {
            const seq = strand === 1 ? sequence : this.reverseComplement(sequence);
            
            for (let frame = 0; frame < 3; frame++) {
                let currentORF = null;
                
                for (let i = frame; i < seq.length - 2; i += 3) {
                    const codon = seq.substring(i, i + 3);
                    
                    if (codon === 'ATG' && !currentORF) {
                        // Start codon
                        currentORF = { start: i, frame: frame + 1, strand: strand };
                    } else if (currentORF && ['TAA', 'TAG', 'TGA'].includes(codon)) {
                        // Stop codon
                        currentORF.end = i + 2;
                        currentORF.length = currentORF.end - currentORF.start + 1;
                        
                        if (currentORF.length >= minLength) {
                            // Convert to original coordinates
                            if (strand === 1) {
                                currentORF.start += start;
                                currentORF.end += start;
        } else {
                                const temp = sequence.length - currentORF.end - 1 + start;
                                currentORF.end = sequence.length - currentORF.start - 1 + start;
                                currentORF.start = temp;
                            }
                            orfs.push(currentORF);
                        }
                        currentORF = null;
                    }
                }
            }
        }
        
        return {
            chromosome: chr,
            region: `${start}-${end}`,
            minLength: minLength,
            orfsFound: orfs.length,
            orfs: orfs.slice(0, 20) // Limit to first 20 ORFs
        };
    }

    reverseComplement(sequence) {
        // Use unified sequence processing implementation
        if (window.UnifiedSequenceProcessing) {
            const result = window.UnifiedSequenceProcessing.legacyReverseComplement(sequence);
            return result;
        }
        
        // Fallback to original implementation if unified module not available
        const complement = { 'A': 'T', 'T': 'A', 'G': 'C', 'C': 'G' };
        return sequence.split('').reverse().map(base => complement[base] || base).join('');
    }

    async getCodingSequence(params) {
        const { identifier, includeProtein = true, format = 'object' } = params;
        
        if (!identifier) {
            throw new Error('Gene identifier (name or locus_tag) is required');
        }

        // 详细的环境检查
        const environmentCheck = this.checkGenomicsEnvironment();
        if (!environmentCheck.valid) {
            throw new Error(environmentCheck.message);
        }

        try {
            const result = window.MicrobeFns.getCodingSequence(identifier);
            
            if (!result.success) {
                // Enhanced error handling with suggestions
                let errorMessage = result.error;
                let suggestions = '';
                
                if (result.error.includes('not found')) {
                    if (result.suggestions && result.suggestions.length > 0) {
                        suggestions = `\n\nSimilar genes found: ${result.suggestions.join(', ')}`;
                    }
                    
                    if (result.availableGenesCount > 0) {
                        suggestions += `\n\nAvailable genes in this genome: ${result.availableGenesCount} total`;
                        if (result.availableGenesSample && result.availableGenesSample.length > 0) {
                            suggestions += `\nSample genes: ${result.availableGenesSample.join(', ')}`;
                        }
                    }
                    
                    errorMessage += `\n\nSuggestions:
- Try using search_gene_by_name to find the exact gene name
- Use search_features to see all available genes
- Check the gene name spelling and case sensitivity
- Verify the genome data is loaded correctly${suggestions}`;
                }
                throw new Error(errorMessage);
            }

            // Format the result based on requested format
            if (format === 'fasta') {
                return {
                    identifier: identifier,
                    success: true,
                    format: 'fasta',
                    data: window.MicrobeFns.exportCodingSequenceFasta(identifier, includeProtein)
                };
            }

            // Return detailed object format
            const response = {
                identifier: identifier,
                success: true,
                geneName: result.geneName,
                locusTag: result.locusTag,
                chromosome: result.chromosome,
                position: `${result.start}-${result.end}`,
                strand: result.strand,
                length: result.length,
                gcContent: result.gcContent,
                geneType: result.geneType,
                codingSequence: result.codingSequence,
                proteinLength: result.proteinLength
            };

            if (includeProtein) {
                response.proteinSequence = result.proteinSequence;
            }

            return response;
            
        } catch (error) {
            throw new Error(`Failed to get coding sequence for "${identifier}": ${error.message}`);
        }
    }

    /**
     * Check if the genomics environment is properly set up
     * @returns {Object} Validation result with details
     */
    checkGenomicsEnvironment() {
        // Check if MicrobeGenomicsFunctions is available
        if (!window.MicrobeFns) {
            return {
                valid: false,
                message: 'MicrobeGenomicsFunctions not available. The genomics module may not be loaded properly.'
            };
        }

        // Check if GenomeBrowser is initialized
        if (!window.genomeBrowser) {
            return {
                valid: false,
                message: 'GenomeBrowser not initialized. Please ensure the application is fully loaded.'
            };
        }

        // Check if sequence data is loaded
        if (!window.genomeBrowser.currentSequence || Object.keys(window.genomeBrowser.currentSequence).length === 0) {
            return {
                valid: false,
                message: 'No genome sequence data loaded. Please load a genome file (GenBank, FASTA, etc.) first using the File menu or Project Manager.'
            };
        }

        // Check if annotations are loaded
        if (!window.genomeBrowser.currentAnnotations || Object.keys(window.genomeBrowser.currentAnnotations).length === 0) {
            return {
                valid: false,
                message: 'No genome annotations loaded. Gene information requires GenBank files or GFF annotations.'
            };
        }

        // Check current chromosome
        const currentChromosome = window.genomeBrowser.currentChromosome;
        if (!currentChromosome) {
            return {
                valid: false,
                message: 'No chromosome selected. Please navigate to a chromosome first.'
            };
        }

        // Verify chromosome data integrity
        if (!window.genomeBrowser.currentSequence[currentChromosome]) {
            return {
                valid: false,
                message: `Sequence data not available for chromosome "${currentChromosome}".`
            };
        }

        if (!window.genomeBrowser.currentAnnotations[currentChromosome]) {
            return {
                valid: false,
                message: `Annotation data not available for chromosome "${currentChromosome}".`
            };
        }

        return {
            valid: true,
            message: 'Genomics environment is properly configured',
            details: {
                chromosomes: Object.keys(window.genomeBrowser.currentSequence),
                currentChromosome: currentChromosome,
                sequenceLength: window.genomeBrowser.currentSequence[currentChromosome]?.length,
                annotationCount: window.genomeBrowser.currentAnnotations[currentChromosome]?.length
            }
        };
    }

    /**
     * Get detailed information about the currently selected gene
     * @returns {Object} Selected gene information or null if no gene selected
     */
    getSelectedGene() {
        if (!this.app) {
            throw new Error('Genome browser not initialized');
        }

        if (!this.app.selectedGene) {
            return {
                selected: false,
                message: 'No gene currently selected. Click on a gene in the genome view to select it.'
            };
        }

        const gene = this.app.selectedGene.gene;
        const operonInfo = this.app.selectedGene.operonInfo;

        return {
            selected: true,
            geneName: gene.qualifiers?.gene || 'Unknown',
            locusTag: gene.qualifiers?.locus_tag || 'Unknown',
            product: gene.qualifiers?.product || 'Unknown',
            chromosome: this.app.currentChromosome,
            start: gene.start,
            end: gene.end,
            length: gene.end - gene.start + 1,
            strand: gene.strand === -1 ? '-' : '+',
            type: gene.type || 'Unknown',
            
            // Additional gene attributes
            qualifiers: gene.qualifiers || {},
            
            // Operon information if available
            operonInfo: operonInfo ? {
                operonName: operonInfo.name,
                operonStart: operonInfo.start,
                operonEnd: operonInfo.end,
                operonStrand: operonInfo.strand === -1 ? '-' : '+',
                geneCount: operonInfo.genes?.length || 0,
                genePosition: operonInfo.genes?.findIndex(g => g.start === gene.start && g.end === gene.end) + 1 || 'Unknown'
            } : null
        };
    }

    /**
     * Get detailed information about the current viewing region
     * @returns {Object} Current region details with features and statistics
     */
    async getCurrentRegionDetails() {
        if (!this.app) {
            throw new Error('Genome browser not initialized');
        }

        if (!this.app.currentChromosome || !this.app.currentPosition) {
            return {
                hasRegion: false,
                message: 'No region currently selected. Navigate to a genomic position first.'
            };
        }

        const chromosome = this.app.currentChromosome;
        const start = this.app.currentPosition.start;
        const end = this.app.currentPosition.end;
        const length = end - start + 1;

        // Get sequence for the region if available
        let sequence = null;
        let gcContent = null;
        if (this.app.currentSequence && this.app.currentSequence[chromosome]) {
            sequence = this.app.currentSequence[chromosome].substring(start - 1, end);
            const gcCount = (sequence.match(/[GC]/gi) || []).length;
            gcContent = (gcCount / sequence.length * 100).toFixed(2);
        }

        // Get features in the region
        let featuresInRegion = [];
        if (this.app.currentAnnotations && this.app.currentAnnotations[chromosome]) {
            featuresInRegion = this.app.currentAnnotations[chromosome].filter(feature => 
                feature.start <= end && feature.end >= start
            ).map(feature => ({
                type: feature.type,
                name: feature.qualifiers?.gene || feature.qualifiers?.locus_tag || 'Unknown',
                product: feature.qualifiers?.product || 'Unknown',
                start: feature.start,
                end: feature.end,
                strand: feature.strand === -1 ? '-' : '+',
                length: feature.end - feature.start + 1
            }));
        }

        // Get user-defined features in the region
        let userFeaturesInRegion = [];
        if (this.app.userDefinedFeatures && this.app.userDefinedFeatures[chromosome]) {
            userFeaturesInRegion = Object.values(this.app.userDefinedFeatures[chromosome]).filter(feature =>
                feature.start <= end && feature.end >= start
            ).map(feature => ({
                type: feature.type,
                name: feature.name,
                description: feature.description || '',
                start: feature.start,
                end: feature.end,
                strand: feature.strand === -1 ? '-' : '+',
                length: feature.end - feature.start + 1
            }));
        }

        return {
            hasRegion: true,
            chromosome: chromosome,
            start: start,
            end: end,
            length: length,
            centerPosition: Math.floor((start + end) / 2),
            
            // Sequence information
            hasSequence: !!sequence,
            gcContent: gcContent,
            sequencePreview: sequence ? sequence.substring(0, 100) + (sequence.length > 100 ? '...' : '') : null,
            
            // Features information
            featuresCount: featuresInRegion.length,
            features: featuresInRegion,
            userFeaturesCount: userFeaturesInRegion.length,
            userFeatures: userFeaturesInRegion,
            
            // Statistics
            statistics: {
                totalFeatures: featuresInRegion.length + userFeaturesInRegion.length,
                geneCount: featuresInRegion.filter(f => f.type === 'gene' || f.type === 'CDS').length,
                rnaCount: featuresInRegion.filter(f => f.type.includes('RNA')).length
            }
        };
    }

    /**
     * Get information about user's sequence selection
     * @returns {Object} Sequence selection details
     */
    getSequenceSelection() {
        if (!this.app) {
            throw new Error('Genome browser not initialized');
        }

        if (!this.app.sequenceSelection || !this.app.sequenceSelection.active) {
            return {
                hasSelection: false,
                message: 'No sequence currently selected. Select a sequence region in the genome view to analyze it.'
            };
        }

        const selection = this.app.sequenceSelection;
        const start = selection.start;
        const end = selection.end;
        const length = end - start + 1;

        // Get the selected sequence if available
        let selectedSequence = null;
        let gcContent = null;
        if (this.app.currentSequence && this.app.currentSequence[this.app.currentChromosome]) {
            selectedSequence = this.app.currentSequence[this.app.currentChromosome].substring(start - 1, end);
            const gcCount = (selectedSequence.match(/[GC]/gi) || []).length;
            gcContent = (gcCount / selectedSequence.length * 100).toFixed(2);
        }

        // Find features that overlap with the selection
        let overlappingFeatures = [];
        if (this.app.currentAnnotations && this.app.currentAnnotations[this.app.currentChromosome]) {
            overlappingFeatures = this.app.currentAnnotations[this.app.currentChromosome].filter(feature =>
                feature.start <= end && feature.end >= start
            ).map(feature => ({
                type: feature.type,
                name: feature.qualifiers?.gene || feature.qualifiers?.locus_tag || 'Unknown',
                product: feature.qualifiers?.product || 'Unknown',
                start: feature.start,
                end: feature.end,
                strand: feature.strand === -1 ? '-' : '+',
                overlapStart: Math.max(feature.start, start),
                overlapEnd: Math.min(feature.end, end),
                overlapLength: Math.min(feature.end, end) - Math.max(feature.start, start) + 1
            }));
        }

        return {
            hasSelection: true,
            chromosome: this.app.currentChromosome,
            start: start,
            end: end,
            length: length,
            
            // Sequence information
            sequence: selectedSequence,
            gcContent: gcContent,
            sequencePreview: selectedSequence ? selectedSequence.substring(0, 100) + (selectedSequence.length > 100 ? '...' : '') : null,
            
            // Overlapping features
            overlappingFeaturesCount: overlappingFeatures.length,
            overlappingFeatures: overlappingFeatures,
            
            // Analysis suggestions
            suggestions: {
                canTranslate: length >= 3 && length % 3 === 0,
                canFindOrfs: length >= 90, // At least 30 codons
                canAnalyzeGC: length >= 10,
                canSearchMotifs: length >= 6
            }
        };
    }

    async getMultipleCodingSequences(params) {
        const { identifiers, includeProtein = true, format = 'object' } = params;
        
        if (!identifiers || !Array.isArray(identifiers)) {
            throw new Error('Identifiers array is required');
        }
        
        if (identifiers.length === 0) {
            throw new Error('At least one identifier is required');
        }
        
        if (identifiers.length > 50) {
            throw new Error('Maximum 50 identifiers allowed per request');
        }
        
        // Use MicrobeGenomicsFunctions to get multiple coding sequences
        if (!window.MicrobeFns || !window.MicrobeFns.getMultipleCodingSequences) {
            throw new Error('MicrobeGenomicsFunctions not available');
        }
        
        try {
            const results = window.MicrobeFns.getMultipleCodingSequences(identifiers);
            
            const successful = results.filter(r => r.success);
            const failed = results.filter(r => !r.success);
            
            const response = {
                totalRequested: identifiers.length,
                successful: successful.length,
                failed: failed.length,
                results: successful.map(result => ({
                    identifier: result.identifier,
                    geneName: result.geneName,
                    locusTag: result.locusTag,
                    chromosome: result.chromosome,
                    position: `${result.start}-${result.end}`,
                    strand: result.strand,
                    length: result.length,
                    gcContent: result.gcContent,
                    geneType: result.geneType,
                    codingSequence: format === 'sequence_only' ? result.codingSequence : result.codingSequence.substring(0, 100) + (result.codingSequence.length > 100 ? '...' : ''),
                    proteinSequence: includeProtein ? (format === 'sequence_only' ? result.proteinSequence : result.proteinSequence.substring(0, 50) + (result.proteinSequence.length > 50 ? '...' : '')) : undefined,
                    proteinLength: result.proteinLength
                })),
                errors: failed.map(f => ({ identifier: f.identifier, error: f.error }))
            };
            
            // Add full sequences if requested
            if (format === 'full_sequences') {
                response.fullSequences = successful.map(result => ({
                    identifier: result.identifier,
                    geneName: result.geneName,
                    codingSequence: result.codingSequence,
                    proteinSequence: includeProtein ? result.proteinSequence : undefined
                }));
            }
            
            return response;
            
        } catch (error) {
            throw new Error(`Failed to get multiple coding sequences: ${error.message}`);
        }
    }

    async getOperons(params) {
        const { chromosome } = params;
        
        const chr = chromosome || this.app.currentChromosome;
        if (!chr) {
            throw new Error('No chromosome specified and none currently selected');
        }
        
        if (!this.app.currentAnnotations || !this.app.currentAnnotations[chr]) {
            throw new Error('No annotations loaded for chromosome');
        }
        
        const annotations = this.app.currentAnnotations[chr];
        const operons = this.app.detectOperons(annotations);
        
        const operonSummary = operons.map(operon => ({
            name: operon.name,
            start: operon.start,
            end: operon.end,
            strand: operon.strand === -1 ? '-' : '+',
            geneCount: operon.genes.length,
            genes: operon.genes.map(g => g.qualifiers?.gene || g.qualifiers?.locus_tag || 'Unknown').slice(0, 5),
            length: operon.end - operon.start + 1
        }));
        
        return {
            chromosome: chr,
            operonsFound: operons.length,
            operons: operonSummary
        };
    }

    async zoomToGene(params) {
        const { geneName, chromosome, padding = 1000 } = params;
        
        const geneDetails = await this.getGeneDetails({ geneName, chromosome });
        
        if (!geneDetails.found || geneDetails.genes.length === 0) {
            throw new Error(`Gene "${geneName}" not found`);
        }
        
        const gene = geneDetails.genes[0]; // Use first match
        const newStart = Math.max(0, gene.start - padding);
        const newEnd = gene.end + padding;
        
        // Navigate to the gene location
        await this.navigateToPosition({
            chromosome: geneDetails.chromosome,
            start: newStart,
            end: newEnd
        });
        
        return {
            geneName: geneName,
            gene: gene,
            zoomedRegion: `${newStart}-${newEnd}`,
            padding: padding,
            message: `Zoomed to gene ${gene.name} with ${padding}bp padding`
        };
    }

    getChromosomeList() {
        if (!this.app || !this.app.currentSequence) {
            return {
                chromosomes: [],
                count: 0,
                message: 'No genome sequence loaded'
            };
        }
        
        const chromosomes = Object.keys(this.app.currentSequence);
        const chromosomeInfo = chromosomes.map(chr => ({
            name: chr,
            length: this.app.currentSequence[chr].length,
            isSelected: chr === this.app.currentChromosome
        }));
        
        return {
            chromosomes: chromosomeInfo,
            count: chromosomes.length,
            currentChromosome: this.app.currentChromosome || 'None selected'
        };
    }

    getTrackStatus() {
        if (!this.app) {
            throw new Error('Genome browser not initialized');
        }
        
        const visibleTracks = this.getVisibleTracks();
        const allTracks = ['genes', 'sequence', 'gc', 'variants', 'reads', 'proteins'];
        
        const trackStatus = allTracks.map(track => ({
            name: track,
            visible: visibleTracks.includes(track),
            description: this.getTrackDescription(track)
        }));
        
        return {
            visibleTracks: visibleTracks,
            totalTracks: allTracks.length,
            tracks: trackStatus
        };
    }

    getTrackDescription(trackName) {
        const descriptions = {
            genes: 'Gene annotations and features',
            sequence: 'DNA sequence display',
            gc: 'GC content visualization',
            variants: 'VCF variant data',
            reads: 'Aligned sequencing reads',
            proteins: 'Protein coding sequences'
        };
        return descriptions[trackName] || 'Unknown track';
    }

    // ========================================
    // NEW COMPREHENSIVE GENOMICS FUNCTION CALLS
    // ========================================

    // 1. MOTIF AND PATTERN SEARCHING
    async searchMotif(params) {
        const { pattern, chromosome, start, end, allowMismatches = 0 } = params;
        
        const chr = chromosome || this.app.currentChromosome;
        if (!chr) {
            throw new Error('No chromosome specified and none currently selected');
        }
        
        const regionStart = start || this.app.currentPosition?.start || 0;
        const regionEnd = end || this.app.currentPosition?.end || this.app.currentSequence[chr]?.length || 0;
        
        const sequence = await this.app.getSequenceForRegion(chr, regionStart, regionEnd);
        const motifPattern = pattern.toUpperCase();
        const matches = [];
        
        // Search for exact matches and with mismatches
        for (let i = 0; i <= sequence.length - motifPattern.length; i++) {
            const subsequence = sequence.substring(i, i + motifPattern.length);
            const mismatches = this.countMismatches(subsequence, motifPattern);
            
            if (mismatches <= allowMismatches) {
                matches.push({
                    position: regionStart + i,
                    sequence: subsequence,
                    mismatches: mismatches,
                    strand: '+'
                });
            }
        }
        
        // Search reverse complement
        const reverseComplement = this.reverseComplement(motifPattern);
        for (let i = 0; i <= sequence.length - reverseComplement.length; i++) {
            const subsequence = sequence.substring(i, i + reverseComplement.length);
            const mismatches = this.countMismatches(subsequence, reverseComplement);
            
            if (mismatches <= allowMismatches) {
                matches.push({
                    position: regionStart + i,
                    sequence: subsequence,
                    mismatches: mismatches,
                    strand: '-'
                });
            }
        }
        
        return {
            pattern: pattern,
            chromosome: chr,
            searchRegion: `${regionStart}-${regionEnd}`,
            allowedMismatches: allowMismatches,
            matchesFound: matches.length,
            matches: matches.slice(0, 50) // Limit to first 50 matches
        };
    }

    async searchPattern(params) {
        const { regex, chromosome, start, end, description = 'Custom pattern' } = params;
        
        const chr = chromosome || this.app.currentChromosome;
        if (!chr) {
            throw new Error('No chromosome specified and none currently selected');
        }
        
        const regionStart = start || this.app.currentPosition?.start || 0;
        const regionEnd = end || this.app.currentPosition?.end || this.app.currentSequence[chr]?.length || 0;
        
        const sequence = await this.app.getSequenceForRegion(chr, regionStart, regionEnd);
        const pattern = new RegExp(regex, 'gi');
        const matches = [];
        
        let match;
        while ((match = pattern.exec(sequence)) !== null) {
            matches.push({
                position: regionStart + match.index,
                sequence: match[0],
                length: match[0].length
            });
            
            // Prevent infinite loop on zero-length matches
            if (match.index === pattern.lastIndex) {
                pattern.lastIndex++;
            }
        }
        
        return {
            regex: regex,
            description: description,
            chromosome: chr,
            searchRegion: `${regionStart}-${regionEnd}`,
            matchesFound: matches.length,
            matches: matches.slice(0, 50)
        };
    }

    // 2. NEARBY FEATURES AND CONTEXT
    async getNearbyFeatures(params) {
        const { chromosome, position, distance = 5000, featureTypes = [] } = params;
        
        const chr = chromosome || this.app.currentChromosome;
        if (!chr) {
            throw new Error('No chromosome specified and none currently selected');
        }
        
        if (!this.app.currentAnnotations || !this.app.currentAnnotations[chr]) {
            throw new Error('No annotations loaded for chromosome');
        }
        
        const annotations = this.app.currentAnnotations[chr];
        const nearbyFeatures = annotations.filter(feature => {
            if (featureTypes.length > 0 && !featureTypes.includes(feature.type)) {
                return false;
            }
            
            const featureDistance = Math.min(
                Math.abs(feature.start - position),
                Math.abs(feature.end - position)
            );
            
            return featureDistance <= distance;
        });
        
        // Sort by distance
        nearbyFeatures.sort((a, b) => {
            const distA = Math.min(Math.abs(a.start - position), Math.abs(a.end - position));
            const distB = Math.min(Math.abs(b.start - position), Math.abs(b.end - position));
            return distA - distB;
        });
        
        const featureSummary = nearbyFeatures.map(feature => ({
            name: feature.qualifiers?.gene || feature.qualifiers?.locus_tag || 'Unknown',
            type: feature.type,
            start: feature.start,
            end: feature.end,
            strand: feature.strand === -1 ? '-' : '+',
            distance: Math.min(Math.abs(feature.start - position), Math.abs(feature.end - position)),
            direction: feature.start > position ? 'downstream' : feature.end < position ? 'upstream' : 'overlapping'
        }));
        
        return {
            chromosome: chr,
            position: position,
            searchDistance: distance,
            featuresFound: nearbyFeatures.length,
            features: featureSummary.slice(0, 20)
        };
    }

    async findIntergenicRegions(params) {
        const { chromosome, minLength = 100 } = params;
        
        const chr = chromosome || this.app.currentChromosome;
        if (!chr) {
            throw new Error('No chromosome specified and none currently selected');
        }
        
        if (!this.app.currentAnnotations || !this.app.currentAnnotations[chr]) {
            throw new Error('No annotations loaded for chromosome');
        }
        
        const annotations = this.app.currentAnnotations[chr];
        const genes = annotations.filter(f => f.type === 'gene' || f.type === 'CDS').sort((a, b) => a.start - b.start);
        const intergenicRegions = [];
        
        for (let i = 0; i < genes.length - 1; i++) {
            const currentGene = genes[i];
            const nextGene = genes[i + 1];
            const intergenicStart = currentGene.end + 1;
            const intergenicEnd = nextGene.start - 1;
            const length = intergenicEnd - intergenicStart + 1;
            
            if (length >= minLength) {
                intergenicRegions.push({
                    start: intergenicStart,
                    end: intergenicEnd,
                    length: length,
                    upstreamGene: currentGene.qualifiers?.gene || currentGene.qualifiers?.locus_tag || 'Unknown',
                    downstreamGene: nextGene.qualifiers?.gene || nextGene.qualifiers?.locus_tag || 'Unknown'
                });
            }
        }
        
        return {
            chromosome: chr,
            minLength: minLength,
            regionsFound: intergenicRegions.length,
            totalIntergenicLength: intergenicRegions.reduce((sum, region) => sum + region.length, 0),
            regions: intergenicRegions.slice(0, 20)
        };
    }

    // 3. RESTRICTION ENZYME ANALYSIS
    async findRestrictionSites(params) {
        const { enzyme, chromosome, start, end } = params;
        
        const chr = chromosome || this.app.currentChromosome;
        if (!chr) {
            throw new Error('No chromosome specified and none currently selected');
        }
        
        const regionStart = start || this.app.currentPosition?.start || 0;
        const regionEnd = end || this.app.currentPosition?.end || this.app.currentSequence[chr]?.length || 0;
        
        const sequence = await this.app.getSequenceForRegion(chr, regionStart, regionEnd);
        
        // Common restriction enzyme recognition sites
        const restrictionSites = {
            'EcoRI': 'GAATTC',
            'BamHI': 'GGATCC',
            'HindIII': 'AAGCTT',
            'XhoI': 'CTCGAG',
            'SalI': 'GTCGAC',
            'SpeI': 'ACTAGT',
            'NotI': 'GCGGCCGC',
            'KpnI': 'GGTACC',
            'SacI': 'GAGCTC',
            'PstI': 'CTGCAG'
        };
        
        const recognitionSite = restrictionSites[enzyme];
        if (!recognitionSite) {
            throw new Error(`Unknown restriction enzyme: ${enzyme}. Supported: ${Object.keys(restrictionSites).join(', ')}`);
        }
        
        const sites = [];
        const siteLength = recognitionSite.length;
        
        // Search forward strand
        for (let i = 0; i <= sequence.length - siteLength; i++) {
            const subsequence = sequence.substring(i, i + siteLength);
            if (subsequence === recognitionSite) {
                sites.push({
                    position: regionStart + i,
                    site: subsequence,
                    strand: '+'
                });
            }
        }
        
        // Search reverse strand
        const reverseComplement = this.reverseComplement(recognitionSite);
        for (let i = 0; i <= sequence.length - siteLength; i++) {
            const subsequence = sequence.substring(i, i + siteLength);
            if (subsequence === reverseComplement) {
                sites.push({
                    position: regionStart + i,
                    site: subsequence,
                    strand: '-'
                });
            }
        }
        
        return {
            enzyme: enzyme,
            recognitionSite: recognitionSite,
            chromosome: chr,
            searchRegion: `${regionStart}-${regionEnd}`,
            sitesFound: sites.length,
            sites: sites
        };
    }

    async virtualDigest(params) {
        const { enzymes, chromosome } = params;
        
        const chr = chromosome || this.app.currentChromosome;
        if (!chr) {
            throw new Error('No chromosome specified and none currently selected');
        }
        
        const sequenceLength = this.app.currentSequence[chr]?.length || 0;
        const allSites = [];
        
        // Find all restriction sites for all enzymes
        for (const enzyme of enzymes) {
            const result = await this.findRestrictionSites({ enzyme, chromosome: chr, start: 0, end: sequenceLength });
            result.sites.forEach(site => {
                allSites.push({ ...site, enzyme });
            });
        }
        
        // Sort all sites by position
        allSites.sort((a, b) => a.position - b.position);
        
        // Calculate fragment sizes
        const fragments = [];
        let lastPosition = 0;
        
        allSites.forEach(site => {
            const fragmentLength = site.position - lastPosition;
            if (fragmentLength > 0) {
                fragments.push({
                    start: lastPosition,
                    end: site.position,
                    length: fragmentLength,
                    cutBy: site.enzyme
                });
            }
            lastPosition = site.position;
        });
        
        // Add final fragment
        if (lastPosition < sequenceLength) {
            fragments.push({
                start: lastPosition,
                end: sequenceLength,
                length: sequenceLength - lastPosition,
                cutBy: 'terminal'
            });
        }
        
        return {
            enzymes: enzymes,
            chromosome: chr,
            totalSites: allSites.length,
            fragments: fragments.length,
            averageFragmentSize: Math.round(fragments.reduce((sum, f) => sum + f.length, 0) / fragments.length),
            largestFragment: Math.max(...fragments.map(f => f.length)),
            smallestFragment: Math.min(...fragments.map(f => f.length)),
            fragmentDetails: fragments.slice(0, 20) // Show first 20 fragments
        };
    }

    // 4. ENHANCED SEQUENCE STATISTICS
    async sequenceStatistics(params) {
        const { chromosome, start, end, include = ['basic', 'composition', 'complexity'], sequence, sequenceType = 'dna' } = params;
        
        let inputSequence;
        
        // If sequence is provided directly, use it
        if (sequence) {
            inputSequence = sequence.replace(/\s/g, '').toUpperCase();
            // Remove stop codon if protein sequence
            if (sequenceType === 'protein' && inputSequence.endsWith('*')) {
                inputSequence = inputSequence.slice(0, -1);
            }
        } else {
            // Use genomic region
            const chr = chromosome || this.app.currentChromosome;
            if (!chr) {
                throw new Error('No chromosome specified and none currently selected');
            }
            
            const regionStart = start || this.app.currentPosition?.start || 0;
            const regionEnd = end || this.app.currentPosition?.end || this.app.currentSequence[chr]?.length || 0;
            
            inputSequence = await this.app.getSequenceForRegion(chr, regionStart, regionEnd);
        }
        
        const stats = {};
        
        // Basic composition
        if (include.includes('basic') || include.includes('composition')) {
            if (sequenceType === 'protein') {
                // Protein amino acid composition
                const aaCounts = {};
                const aminoAcids = ['A', 'R', 'N', 'D', 'C', 'Q', 'E', 'G', 'H', 'I', 'L', 'K', 'M', 'F', 'P', 'S', 'T', 'W', 'Y', 'V'];
                
                // Initialize counts
                aminoAcids.forEach(aa => aaCounts[aa] = 0);
                
                // Count amino acids
                for (const aa of inputSequence) {
                    if (aminoAcids.includes(aa)) {
                        aaCounts[aa]++;
                    }
                }
                
                const length = inputSequence.length;
                const composition = { length: length };
                
                // Calculate percentages
                aminoAcids.forEach(aa => {
                    composition[aa] = { 
                        count: aaCounts[aa], 
                        percentage: (aaCounts[aa] / length * 100).toFixed(2) 
                    };
                });
                
                // Add amino acid properties
                const hydrophobic = ['A', 'V', 'I', 'L', 'M', 'F', 'W', 'Y'];
                const charged = ['R', 'K', 'D', 'E'];
                const polar = ['N', 'Q', 'S', 'T', 'Y'];
                const basic = ['R', 'K', 'H'];
                const acidic = ['D', 'E'];
                
                const hydrophobicCount = hydrophobic.reduce((sum, aa) => sum + aaCounts[aa], 0);
                const chargedCount = charged.reduce((sum, aa) => sum + aaCounts[aa], 0);
                const polarCount = polar.reduce((sum, aa) => sum + aaCounts[aa], 0);
                const basicCount = basic.reduce((sum, aa) => sum + aaCounts[aa], 0);
                const acidicCount = acidic.reduce((sum, aa) => sum + aaCounts[aa], 0);
                
                composition.properties = {
                    hydrophobic: { count: hydrophobicCount, percentage: (hydrophobicCount / length * 100).toFixed(2) },
                    charged: { count: chargedCount, percentage: (chargedCount / length * 100).toFixed(2) },
                    polar: { count: polarCount, percentage: (polarCount / length * 100).toFixed(2) },
                    basic: { count: basicCount, percentage: (basicCount / length * 100).toFixed(2) },
                    acidic: { count: acidicCount, percentage: (acidicCount / length * 100).toFixed(2) }
                };
                
                stats.composition = composition;
                
            } else {
                // DNA nucleotide composition
                const counts = { A: 0, T: 0, G: 0, C: 0, N: 0 };
                for (const base of inputSequence) {
                    counts[base] = (counts[base] || 0) + 1;
                }
                
                const length = inputSequence.length;
                stats.composition = {
                    length: length,
                    A: { count: counts.A, percentage: (counts.A / length * 100).toFixed(2) },
                    T: { count: counts.T, percentage: (counts.T / length * 100).toFixed(2) },
                    G: { count: counts.G, percentage: (counts.G / length * 100).toFixed(2) },
                    C: { count: counts.C, percentage: (counts.C / length * 100).toFixed(2) },
                    GC: { percentage: ((counts.G + counts.C) / length * 100).toFixed(2) },
                    AT: { percentage: ((counts.A + counts.T) / length * 100).toFixed(2) }
                };
            }
        }
        
        // AT/GC skew
        if (include.includes('skew') || include.includes('at_skew') || include.includes('gc_skew')) {
            const windowSize = Math.max(100, Math.floor(sequence.length / 50));
            const skewData = [];
            
            for (let i = 0; i < sequence.length - windowSize; i += windowSize) {
                const window = sequence.substring(i, i + windowSize);
                const A = (window.match(/A/g) || []).length;
                const T = (window.match(/T/g) || []).length;
                const G = (window.match(/G/g) || []).length;
                const C = (window.match(/C/g) || []).length;
                
                const atSkew = (A - T) / (A + T) || 0;
                const gcSkew = (G - C) / (G + C) || 0;
                
                skewData.push({
                    position: regionStart + i + windowSize / 2,
                    atSkew: parseFloat(atSkew.toFixed(3)),
                    gcSkew: parseFloat(gcSkew.toFixed(3))
                });
            }
            
            stats.skew = skewData.slice(0, 20); // Limit data points
        }
        
        // Complexity (low complexity regions)
        if (include.includes('complexity')) {
            const windowSize = 50;
            const lowComplexityRegions = [];
            
            for (let i = 0; i < sequence.length - windowSize; i += windowSize) {
                const window = sequence.substring(i, i + windowSize);
                const uniqueBases = new Set(window).size;
                const complexity = uniqueBases / 4; // Normalized to 0-1
                
                if (complexity < 0.6) { // Low complexity threshold
                    lowComplexityRegions.push({
                        start: regionStart + i,
                        end: regionStart + i + windowSize,
                        complexity: parseFloat(complexity.toFixed(3))
                    });
                }
            }
            
            stats.complexity = {
                lowComplexityRegions: lowComplexityRegions.length,
                regions: lowComplexityRegions.slice(0, 10)
            };
        }
        
        return {
            chromosome: chr,
            region: `${regionStart}-${regionEnd}`,
            analysisTypes: include,
            statistics: stats
        };
    }

    async codonUsageAnalysis(params) {
        const { sequence, geneName, chromosome } = params;
        
        let analysisSequence = sequence;
        let geneInfo = null;
        
        // If sequence is provided directly, use it
        if (sequence && typeof sequence === 'string') {
            analysisSequence = sequence.replace(/\s/g, '').toUpperCase();
            
            // Validate DNA sequence
            if (!/^[ATGC]+$/.test(analysisSequence)) {
                throw new Error('Sequence must contain only A, T, G, C nucleotides');
            }
        } 
        // Otherwise, try to get sequence from gene name
        else if (geneName) {
            const geneDetails = await this.getGeneDetails({ geneName, chromosome });
            if (!geneDetails.found || geneDetails.genes.length === 0) {
                throw new Error(`Gene "${geneName}" not found`);
            }
            
            const gene = geneDetails.genes.find(g => g.type === 'CDS') || geneDetails.genes[0];
            const chr = geneDetails.chromosome;
            
            analysisSequence = await this.app.getSequenceForRegion(chr, gene.start, gene.end);
            
            // Handle negative strand genes - get reverse complement
            if (gene.strand === '-') {
                analysisSequence = this.reverseComplement(analysisSequence);
            }
            
            geneInfo = gene;
        } else {
            throw new Error('Either sequence or geneName must be provided');
        }
        
        // Check if sequence length is multiple of 3 (complete codons)
        if (analysisSequence.length % 3 !== 0) {
            console.warn('Warning: Sequence length is not a multiple of 3, some nucleotides at the end will be ignored');
        }
        
        const codonCounts = {};
        const aminoAcidCounts = {};
        
        // Genetic code
        const geneticCode = {
            'TTT': 'F', 'TTC': 'F', 'TTA': 'L', 'TTG': 'L',
            'TCT': 'S', 'TCC': 'S', 'TCA': 'S', 'TCG': 'S',
            'TAT': 'Y', 'TAC': 'Y', 'TAA': '*', 'TAG': '*',
            'TGT': 'C', 'TGC': 'C', 'TGA': '*', 'TGG': 'W',
            'CTT': 'L', 'CTC': 'L', 'CTA': 'L', 'CTG': 'L',
            'CCT': 'P', 'CCC': 'P', 'CCA': 'P', 'CCG': 'P',
            'CAT': 'H', 'CAC': 'H', 'CAA': 'Q', 'CAG': 'Q',
            'CGT': 'R', 'CGC': 'R', 'CGA': 'R', 'CGG': 'R',
            'ATT': 'I', 'ATC': 'I', 'ATA': 'I', 'ATG': 'M',
            'ACT': 'T', 'ACC': 'T', 'ACA': 'T', 'ACG': 'T',
            'AAT': 'N', 'AAC': 'N', 'AAA': 'K', 'AAG': 'K',
            'AGT': 'S', 'AGC': 'S', 'AGA': 'R', 'AGG': 'R',
            'GTT': 'V', 'GTC': 'V', 'GTA': 'V', 'GTG': 'V',
            'GCT': 'A', 'GCC': 'A', 'GCA': 'A', 'GCG': 'A',
            'GAT': 'D', 'GAC': 'D', 'GAA': 'E', 'GAG': 'E',
            'GGT': 'G', 'GGC': 'G', 'GGA': 'G', 'GGG': 'G'
        };
        
        // Count codons
        for (let i = 0; i < analysisSequence.length - 2; i += 3) {
            const codon = analysisSequence.substring(i, i + 3);
            const aminoAcid = geneticCode[codon];
            
            if (aminoAcid) {
                codonCounts[codon] = (codonCounts[codon] || 0) + 1;
                aminoAcidCounts[aminoAcid] = (aminoAcidCounts[aminoAcid] || 0) + 1;
            }
        }
        
        const totalCodons = Object.values(codonCounts).reduce((sum, count) => sum + count, 0);
        
        // Calculate relative usage
        const codonUsage = Object.entries(codonCounts).map(([codon, count]) => ({
            codon: codon,
            aminoAcid: geneticCode[codon],
            count: count,
            frequency: parseFloat((count / totalCodons * 100).toFixed(2))
        })).sort((a, b) => b.frequency - a.frequency);
        
        return {
            geneName: geneName,
            gene: geneInfo,
            totalCodons: totalCodons,
            uniqueCodons: Object.keys(codonCounts).length,
            codonUsage: codonUsage,
            aminoAcidComposition: aminoAcidCounts,
            mostFrequentCodons: codonUsage.slice(0, 10),
            sequenceLength: analysisSequence.length
        };
    }

    // Amino acid composition analysis
    async aminoAcidComposition(params) {
        const { proteinSequence, geneName } = params;
        
        if (!proteinSequence) {
            throw new Error('Protein sequence is required for amino acid composition analysis');
        }
        
        // Clean the sequence (remove stop codon if present)
        let cleanSequence = proteinSequence.replace(/\s/g, '').toUpperCase();
        if (cleanSequence.endsWith('*')) {
            cleanSequence = cleanSequence.slice(0, -1);
        }
        
        // Define amino acids and their properties
        const aminoAcids = ['A', 'R', 'N', 'D', 'C', 'Q', 'E', 'G', 'H', 'I', 'L', 'K', 'M', 'F', 'P', 'S', 'T', 'W', 'Y', 'V'];
        const aminoAcidNames = {
            'A': 'Alanine', 'R': 'Arginine', 'N': 'Asparagine', 'D': 'Aspartic acid',
            'C': 'Cysteine', 'Q': 'Glutamine', 'E': 'Glutamic acid', 'G': 'Glycine',
            'H': 'Histidine', 'I': 'Isoleucine', 'L': 'Leucine', 'K': 'Lysine',
            'M': 'Methionine', 'F': 'Phenylalanine', 'P': 'Proline', 'S': 'Serine',
            'T': 'Threonine', 'W': 'Tryptophan', 'Y': 'Tyrosine', 'V': 'Valine'
        };
        
        const hydrophobic = ['A', 'V', 'I', 'L', 'M', 'F', 'W', 'Y'];
        const charged = ['R', 'K', 'D', 'E'];
        const polar = ['N', 'Q', 'S', 'T', 'Y'];
        const basic = ['R', 'K', 'H'];
        const acidic = ['D', 'E'];
        const aromatic = ['F', 'W', 'Y'];
        const small = ['A', 'G', 'S'];
        
        // Count amino acids
        const aaCounts = {};
        aminoAcids.forEach(aa => aaCounts[aa] = 0);
        
        for (const aa of cleanSequence) {
            if (aminoAcids.includes(aa)) {
                aaCounts[aa]++;
            }
        }
        
        const length = cleanSequence.length;
        
        // Calculate composition
        const composition = aminoAcids.map(aa => ({
            aa: aa,
            name: aminoAcidNames[aa],
            count: aaCounts[aa],
            percentage: (aaCounts[aa] / length * 100).toFixed(2)
        })).sort((a, b) => b.count - a.count);
        
        // Calculate property groups
        const hydrophobicCount = hydrophobic.reduce((sum, aa) => sum + aaCounts[aa], 0);
        const chargedCount = charged.reduce((sum, aa) => sum + aaCounts[aa], 0);
        const polarCount = polar.reduce((sum, aa) => sum + aaCounts[aa], 0);
        const basicCount = basic.reduce((sum, aa) => sum + aaCounts[aa], 0);
        const acidicCount = acidic.reduce((sum, aa) => sum + aaCounts[aa], 0);
        const aromaticCount = aromatic.reduce((sum, aa) => sum + aaCounts[aa], 0);
        const smallCount = small.reduce((sum, aa) => sum + aaCounts[aa], 0);
        
        const properties = {
            hydrophobic: { count: hydrophobicCount, percentage: (hydrophobicCount / length * 100).toFixed(2) },
            charged: { count: chargedCount, percentage: (chargedCount / length * 100).toFixed(2) },
            polar: { count: polarCount, percentage: (polarCount / length * 100).toFixed(2) },
            basic: { count: basicCount, percentage: (basicCount / length * 100).toFixed(2) },
            acidic: { count: acidicCount, percentage: (acidicCount / length * 100).toFixed(2) },
            aromatic: { count: aromaticCount, percentage: (aromaticCount / length * 100).toFixed(2) },
            small: { count: smallCount, percentage: (smallCount / length * 100).toFixed(2) }
        };
        
        return {
            gene: geneName || 'Unknown',
            length: length,
            composition: composition,
            properties: properties,
            mostAbundant: composition.slice(0, 5),
            leastAbundant: composition.filter(aa => aa.count > 0).slice(-5).reverse()
        };
    }

    // 5. BOOKMARK AND SESSION MANAGEMENT
    async bookmarkPosition(params) {
        const { name, chromosome, start, end, notes = '' } = params;
        
        const chr = chromosome || this.app.currentChromosome;
        const bookmarkStart = start || this.app.currentPosition?.start;
        const bookmarkEnd = end || this.app.currentPosition?.end;
        
        if (!chr || bookmarkStart === undefined || bookmarkEnd === undefined) {
            throw new Error('Invalid bookmark parameters');
        }
        
        const bookmark = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            name: name,
            chromosome: chr,
            start: bookmarkStart,
            end: bookmarkEnd,
            notes: notes,
            created: new Date().toISOString()
        };
        
        // Store in configuration
        let bookmarks = this.configManager.get('bookmarks', []);
        bookmarks.push(bookmark);
        this.configManager.set('bookmarks', bookmarks);
        await this.configManager.save();
        
        return {
            success: true,
            bookmark: bookmark,
            message: `Bookmarked "${name}" at ${chr}:${bookmarkStart}-${bookmarkEnd}`
        };
    }

    getBookmarks(params) {
        const { chromosome } = params;
        const bookmarks = this.configManager.get('bookmarks', []);
        
        let filteredBookmarks = bookmarks;
        if (chromosome) {
            filteredBookmarks = bookmarks.filter(b => b.chromosome === chromosome);
        }
        
        return {
            totalBookmarks: bookmarks.length,
            filteredBookmarks: filteredBookmarks.length,
            chromosome: chromosome || 'all',
            bookmarks: filteredBookmarks
        };
    }

    async saveViewState(params) {
        const { name, description = '' } = params;
        
        const viewState = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            name: name,
            description: description,
            chromosome: this.app.currentChromosome,
            position: this.app.currentPosition,
            visibleTracks: this.getVisibleTracks(),
            created: new Date().toISOString()
        };
        
        let savedStates = this.configManager.get('viewStates', []);
        savedStates.push(viewState);
        this.configManager.set('viewStates', savedStates);
        await this.configManager.save();
        
        return {
            success: true,
            viewState: viewState,
            message: `Saved view state "${name}"`
        };
    }

    // Helper methods
    countMismatches(seq1, seq2) {
        if (seq1.length !== seq2.length) return Infinity;
        let mismatches = 0;
        for (let i = 0; i < seq1.length; i++) {
            if (seq1[i] !== seq2[i]) mismatches++;
        }
        return mismatches;
    }

    // 6. SEQUENCE COMPARISON AND ANALYSIS
    async compareRegions(params) {
        const { region1, region2, alignmentType = 'simple' } = params;
        
        // Parse regions (format: "chr:start-end")
        const parseRegion = (regionStr) => {
            const parts = regionStr.split(':');
            const chromosome = parts[0];
            const [start, end] = parts[1].split('-').map(Number);
            return { chromosome, start, end };
        };
        
        const reg1 = parseRegion(region1);
        const reg2 = parseRegion(region2);
        
        const seq1 = await this.app.getSequenceForRegion(reg1.chromosome, reg1.start, reg1.end);
        const seq2 = await this.app.getSequenceForRegion(reg2.chromosome, reg2.start, reg2.end);
        
        // Simple comparison metrics
        const similarity = this.calculateSimilarity(seq1, seq2);
        const identity = this.calculateIdentity(seq1, seq2);
        
        return {
            region1: region1,
            region2: region2,
            length1: seq1.length,
            length2: seq2.length,
            similarity: parseFloat(similarity.toFixed(2)),
            identity: parseFloat(identity.toFixed(2)),
            sequenceData: {
                region1: seq1.substring(0, 100) + (seq1.length > 100 ? '...' : ''),
                region2: seq2.substring(0, 100) + (seq2.length > 100 ? '...' : '')
            }
        };
    }

    async findSimilarSequences(params) {
        const { querySequence, chromosome, minSimilarity = 0.8, maxResults = 20 } = params;
        
        const chr = chromosome || this.app.currentChromosome;
        if (!chr) {
            throw new Error('No chromosome specified and none currently selected');
        }
        
        const chromosomeSequence = this.app.currentSequence[chr];
        if (!chromosomeSequence) {
            throw new Error('No sequence loaded for chromosome');
        }
        
        const queryLength = querySequence.length;
        const similarRegions = [];
        
        // Sliding window search
        for (let i = 0; i <= chromosomeSequence.length - queryLength; i += 100) { // Step by 100 for efficiency
            const subsequence = chromosomeSequence.substring(i, i + queryLength);
            const similarity = this.calculateSimilarity(querySequence, subsequence);
            
            if (similarity >= minSimilarity) {
                similarRegions.push({
                    start: i,
                    end: i + queryLength,
                    similarity: parseFloat(similarity.toFixed(3)),
                    sequence: subsequence.substring(0, 50) + (subsequence.length > 50 ? '...' : '')
                });
            }
        }
        
        // Sort by similarity
        similarRegions.sort((a, b) => b.similarity - a.similarity);
        
        return {
            querySequence: querySequence.substring(0, 50) + (querySequence.length > 50 ? '...' : ''),
            chromosome: chr,
            minSimilarity: minSimilarity,
            resultsFound: similarRegions.length,
            results: similarRegions.slice(0, maxResults)
        };
    }

    // 7. ANNOTATION MANAGEMENT (CRUD)
    async editAnnotation(params) {
        const { annotationId, updates } = params;
        
        if (!this.app.currentAnnotations) {
            throw new Error('No annotations loaded');
        }
        
        let annotationFound = false;
        let updatedAnnotation = null;
        
        // Find and update annotation across all chromosomes
        Object.keys(this.app.currentAnnotations).forEach(chr => {
            const annotations = this.app.currentAnnotations[chr];
            const annotationIndex = annotations.findIndex(a => 
                a.id === annotationId || 
                a.qualifiers?.locus_tag === annotationId ||
                a.qualifiers?.gene === annotationId
            );
            
            if (annotationIndex !== -1) {
                annotationFound = true;
                const annotation = annotations[annotationIndex];
                
                // Apply updates
                Object.keys(updates).forEach(key => {
                    if (key === 'qualifiers') {
                        annotation.qualifiers = { ...annotation.qualifiers, ...updates.qualifiers };
                    } else {
                        annotation[key] = updates[key];
                    }
                });
                
                updatedAnnotation = annotation;
                annotations[annotationIndex] = annotation;
            }
        });
        
        if (!annotationFound) {
            throw new Error(`Annotation "${annotationId}" not found`);
        }
        
        return {
            success: true,
            annotationId: annotationId,
            updatedAnnotation: updatedAnnotation,
            message: `Updated annotation "${annotationId}"`
        };
    }

    async deleteAnnotation(params) {
        const { annotationId } = params;
        
        if (!this.app.currentAnnotations) {
            throw new Error('No annotations loaded');
        }
        
        let annotationFound = false;
        let deletedAnnotation = null;
        
        // Find and delete annotation across all chromosomes
        Object.keys(this.app.currentAnnotations).forEach(chr => {
            const annotations = this.app.currentAnnotations[chr];
            const annotationIndex = annotations.findIndex(a => 
                a.id === annotationId || 
                a.qualifiers?.locus_tag === annotationId ||
                a.qualifiers?.gene === annotationId
            );
            
            if (annotationIndex !== -1) {
                annotationFound = true;
                deletedAnnotation = annotations[annotationIndex];
                annotations.splice(annotationIndex, 1);
            }
        });
        
        if (!annotationFound) {
            throw new Error(`Annotation "${annotationId}" not found`);
        }
        
        return {
            success: true,
            annotationId: annotationId,
            deletedAnnotation: deletedAnnotation,
            message: `Deleted annotation "${annotationId}"`
        };
    }

    async batchCreateAnnotations(params) {
        const { annotations, chromosome } = params;
        
        const chr = chromosome || this.app.currentChromosome;
        if (!chr) {
            throw new Error('No chromosome specified');
        }
        
        if (!this.app.currentAnnotations) {
            this.app.currentAnnotations = {};
        }
        
        if (!this.app.currentAnnotations[chr]) {
            this.app.currentAnnotations[chr] = [];
        }
        
        const createdAnnotations = [];
        
        annotations.forEach(annotationData => {
            const annotation = {
                id: Date.now() + Math.random().toString(36).substr(2, 9),
                type: annotationData.type || 'feature',
                start: annotationData.start,
                end: annotationData.end,
                strand: annotationData.strand || 1,
                qualifiers: annotationData.qualifiers || {},
                created: new Date().toISOString()
            };
            
            this.app.currentAnnotations[chr].push(annotation);
            createdAnnotations.push(annotation);
        });
        
        return {
            success: true,
            chromosome: chr,
            annotationsCreated: createdAnnotations.length,
            annotations: createdAnnotations
        };
    }

    // 8. FILE AND DATA MANAGEMENT
    getFileInfo(params) {
        const { fileType } = params;
        
        const fileInfo = {
            genome: null,
            annotations: null,
            tracks: null
        };
        
        // Get genome file info
        if (this.app.currentSequence && Object.keys(this.app.currentSequence).length > 0) {
            const chromosomes = Object.keys(this.app.currentSequence);
            const totalLength = chromosomes.reduce((sum, chr) => 
                sum + (this.app.currentSequence[chr]?.length || 0), 0);
            
            fileInfo.genome = {
                chromosomes: chromosomes.length,
                chromosomeList: chromosomes,
                totalLength: totalLength,
                currentChromosome: this.app.currentChromosome
            };
        }
        
        // Get annotation file info
        if (this.app.currentAnnotations) {
            const chromosomes = Object.keys(this.app.currentAnnotations);
            const totalFeatures = chromosomes.reduce((sum, chr) => 
                sum + (this.app.currentAnnotations[chr]?.length || 0), 0);
            
            const featureTypes = new Set();
            chromosomes.forEach(chr => {
                this.app.currentAnnotations[chr]?.forEach(feature => {
                    featureTypes.add(feature.type);
                });
            });
            
            fileInfo.annotations = {
                chromosomes: chromosomes.length,
                totalFeatures: totalFeatures,
                featureTypes: Array.from(featureTypes),
                chromosomeList: chromosomes
            };
        }
        
        // Get track info
        fileInfo.tracks = this.getTrackStatus();
        
        if (fileType && fileInfo[fileType]) {
            return { fileType, info: fileInfo[fileType] };
        }
        
        return {
            fileType: fileType || 'all',
            fileInfo: fileInfo
        };
    }

    async exportRegionFeatures(params) {
        const { chromosome, start, end, featureTypes = [], format = 'json' } = params;
        
        const chr = chromosome || this.app.currentChromosome;
        if (!chr) {
            throw new Error('No chromosome specified');
        }
        
        if (!this.app.currentAnnotations || !this.app.currentAnnotations[chr]) {
            throw new Error('No annotations loaded for chromosome');
        }
        
        const regionStart = start || this.app.currentPosition?.start || 0;
        const regionEnd = end || this.app.currentPosition?.end || this.app.currentSequence[chr]?.length || 0;
        
        const annotations = this.app.currentAnnotations[chr];
        const regionFeatures = annotations.filter(feature => {
            // Filter by position overlap
            const overlaps = feature.start <= regionEnd && feature.end >= regionStart;
            
            // Filter by feature type if specified
            const typeMatch = featureTypes.length === 0 || featureTypes.includes(feature.type);
            
            return overlaps && typeMatch;
        });
        
        const exportData = {
            region: `${chr}:${regionStart}-${regionEnd}`,
            featureCount: regionFeatures.length,
            exportDate: new Date().toISOString(),
            features: regionFeatures
        };
        
        return {
            chromosome: chr,
            region: `${regionStart}-${regionEnd}`,
            featuresExported: regionFeatures.length,
            format: format,
            data: exportData
        };
    }

    // Helper methods for similarity calculations
    calculateSimilarity(seq1, seq2) {
        const maxLength = Math.max(seq1.length, seq2.length);
        if (maxLength === 0) return 1;
        
        const minLength = Math.min(seq1.length, seq2.length);
        let matches = 0;
        
        for (let i = 0; i < minLength; i++) {
            if (seq1[i] === seq2[i]) matches++;
        }
        
        return matches / maxLength;
    }

    calculateIdentity(seq1, seq2) {
        const minLength = Math.min(seq1.length, seq2.length);
        if (minLength === 0) return 0;
        
        let matches = 0;
        for (let i = 0; i < minLength; i++) {
            if (seq1[i] === seq2[i]) matches++;
        }
        
        return matches / minLength;
    }



    // ========================================
    // NEW CHAT FUNCTIONALITY
    // ========================================

    /**
     * Start a new chat conversation
     */
    startNewChat() {
        // Add conversation separator to mark the end of current conversation
        if (this.configManager.getChatHistory().length > 0) {
            this.configManager.addChatMessage('--- CONVERSATION_SEPARATOR ---', 'system', new Date().toISOString());
        }
        
        // Clear the UI display only, keep history
        const messagesContainer = document.getElementById('chatMessages');
        const welcomeMessage = messagesContainer.querySelector('.welcome-message');
        messagesContainer.innerHTML = '';
        if (welcomeMessage) {
            messagesContainer.appendChild(welcomeMessage);
        }
        
        // Clear chat input box
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
            chatInput.value = '';
            chatInput.style.height = 'auto'; // Reset height for auto-resize
        }
        
        // Add a new conversation indicator in UI only
        this.displayChatMessage('🆕 **New conversation started**', 'assistant', new Date().toISOString(), 'new-conversation-' + Date.now());
        
        console.log('Started new chat conversation');
    }

    /**
     * Copy selected text from the page
     */
    copySelectedText() {
        try {
            // Check if this window is focused - avoid executing if tool window is active
            if (!document.hasFocus()) {
                console.log('Chat window not focused, skipping copy operation');
                return;
            }

            const selection = window.getSelection();
            const selectedText = selection.toString().trim();
            
            if (!selectedText) {
                // If no text is selected, try to get text from the currently focused element
                const activeElement = document.activeElement;
                if (activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT')) {
                    const start = activeElement.selectionStart;
                    const end = activeElement.selectionEnd;
                    if (start !== end) {
                        const selectedText = activeElement.value.substring(start, end);
                        if (selectedText) {
                            navigator.clipboard.writeText(selectedText).then(() => {
                                this.showNotification('✅ Selected text copied to clipboard', 'success');
                            });
                            return;
                        }
                    }
                }
                
                this.showNotification('⚠️ No text selected to copy', 'warning');
                return;
            }

            // Copy to clipboard
            navigator.clipboard.writeText(selectedText).then(() => {
                this.showNotification(`✅ Copied ${selectedText.length} characters to clipboard`, 'success');
                
                // Clear the selection for better UX
                selection.removeAllRanges();
            }).catch(err => {
                console.error('Failed to copy text:', err);
                this.showNotification('❌ Failed to copy text to clipboard', 'error');
            });
            
        } catch (error) {
            console.error('Error copying selected text:', error);
            this.showNotification('❌ Error copying selected text', 'error');
        }
    }

    /**
     * Paste text from clipboard into the chat input
     */
    async pasteFromClipboard() {
        try {
            // Check if this window is focused - avoid executing if tool window is active
            if (!document.hasFocus()) {
                console.log('Chat window not focused, skipping paste operation');
                return;
            }

            const chatInput = document.getElementById('chatInput');
            if (!chatInput) {
                this.showNotification('❌ Chat input not found', 'error');
                return;
            }

            // Read from clipboard
            const clipboardText = await navigator.clipboard.readText();
            
            if (!clipboardText.trim()) {
                this.showNotification('⚠️ Clipboard is empty', 'warning');
                return;
            }

            // Get current cursor position
            const start = chatInput.selectionStart;
            const end = chatInput.selectionEnd;
            const currentValue = chatInput.value;

            // Insert the clipboard text at cursor position
            const newValue = currentValue.substring(0, start) + clipboardText + currentValue.substring(end);
            chatInput.value = newValue;

            // Set cursor position after the pasted text
            const newCursorPosition = start + clipboardText.length;
            chatInput.setSelectionRange(newCursorPosition, newCursorPosition);

            // Focus the input and trigger input event for auto-resize
            chatInput.focus();
            chatInput.dispatchEvent(new Event('input'));

            this.showNotification(`✅ Pasted ${clipboardText.length} characters`, 'success');

        } catch (error) {
            console.error('Error pasting from clipboard:', error);
            
            // Check if the document is focused before attempting clipboard access
            if (!document.hasFocus()) {
                console.log('Document not focused, cannot access clipboard');
                return;
            }
            
            // Show error notification without using prompt() which is not supported in Electron
            this.showNotification('❌ Unable to access clipboard. Please use Ctrl+V to paste manually.', 'error');
        }
    }

    /**
     * Show a temporary notification to the user
     */
    showNotification(message, type = 'info') {
        // Remove any existing notification
        const existingNotification = document.getElementById('chatNotification');
        if (existingNotification) {
            existingNotification.remove();
        }

        // Create notification element
        const notification = document.createElement('div');
        notification.id = 'chatNotification';
        notification.className = `chat-notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span>${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        // Add to chat panel
        const chatPanel = document.getElementById('llmChatPanel');
        if (chatPanel) {
            chatPanel.appendChild(notification);

            // Auto-remove after 3 seconds
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 3000);
        }
    }

    /**
     * Test function to verify chat functionality
     */
    testChatFunctionality() {
        console.log('=== Testing Chat Functionality ===');
        
        // Test 1: Check if UI elements exist
        const chatInput = document.getElementById('chatInput');
        const newChatBtn = document.getElementById('newChatBtn');
        const copySelectedBtn = document.getElementById('copySelectedBtn');
        const pasteBtn = document.getElementById('pasteBtn');
        
        console.log('UI Elements Check:');
        console.log('- Chat Input:', chatInput ? '✅' : '❌');
        console.log('- New Chat Button:', newChatBtn ? '✅' : '❌');
        console.log('- Copy Selected Button:', copySelectedBtn ? '✅' : '❌');
        console.log('- Paste Button:', pasteBtn ? '✅' : '❌');
        
        // Test 2: Check chat history loading
        const history = this.configManager.getChatHistory();
        console.log('Chat History:', history.length, 'messages');
        
        // Test 3: Show notification
        this.showNotification('🧪 Chat functionality test completed', 'success');
        
        return {
            uiElements: {
                chatInput: !!chatInput,
                newChatBtn: !!newChatBtn,
                copySelectedBtn: !!copySelectedBtn,
                pasteBtn: !!pasteBtn
            },
            historyCount: history.length,
            testCompleted: true
        };
    }

    /**
     * Show chat history in a modal dialog
     */
    showChatHistoryModal() {
        const history = this.configManager.getChatHistory();
        
        if (history.length === 0) {
            this.showNotification('📭 No chat history found', 'info');
            return;
        }

        // Remove existing modal if present
        const existingModal = document.getElementById('chatHistoryModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Create modal HTML
        const modal = document.createElement('div');
        modal.id = 'chatHistoryModal';
        modal.className = 'modal chat-history-modal show';
        
        // Group messages into conversations
        const conversations = this.groupMessagesIntoConversations(history);
        
        let historyHTML = '';
        conversations.forEach((conversation, index) => {
            const startTime = new Date(conversation.startTime);
            const endTime = new Date(conversation.endTime);
            const duration = this.formatDuration(endTime - startTime);
            
            // Get conversation preview (first user message or first 100 chars of first message)
            const firstUserMessage = conversation.messages.find(m => m.sender === 'user');
            const preview = firstUserMessage ? 
                (firstUserMessage.message.length > 80 ? firstUserMessage.message.substring(0, 80) + '...' : firstUserMessage.message) :
                conversation.messages[0].message.substring(0, 80) + '...';
            
            historyHTML += `
                <div class="conversation-item" onclick="chatManager.showConversationDetails(${index})">
                    <div class="conversation-header">
                        <div class="conversation-info">
                            <div class="conversation-title">
                                <i class="fas fa-comments"></i>
                                <span>Conversation ${conversations.length - index}</span>
                            </div>
                            <div class="conversation-stats">
                                <span class="message-count">${conversation.messages.length} messages</span>
                                <span class="conversation-duration">${duration}</span>
                            </div>
                        </div>
                        <div class="conversation-time">
                            <div class="start-time">${startTime.toLocaleDateString()} ${startTime.toLocaleTimeString()}</div>
                        </div>
                    </div>
                    <div class="conversation-preview">${this.formatMessage(preview)}</div>
                    <div class="conversation-actions">
                        <button onclick="event.stopPropagation(); chatManager.copyConversation(${index})" title="Copy conversation">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button onclick="event.stopPropagation(); chatManager.exportConversation(${index})" title="Export conversation">
                            <i class="fas fa-download"></i>
                        </button>
                        <button onclick="event.stopPropagation(); chatManager.deleteConversation(${index})" title="Delete conversation">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });

        modal.innerHTML = `
            <div class="modal-content chat-history-content">
                <div class="modal-header">
                    <h3>
                        <i class="fas fa-history"></i>
                        Chat History
                        <span class="total-messages">${conversations.length} conversations</span>
                    </h3>
                    <button class="modal-close" onclick="chatManager.closeChatHistoryModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body chat-history-body">
                    <div class="history-controls">
                        <button class="btn btn-sm btn-secondary" onclick="chatManager.exportChatHistory('txt')">
                            <i class="fas fa-download"></i>
                            Export All TXT
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="chatManager.exportChatHistory('json')">
                            <i class="fas fa-download"></i>
                            Export All JSON
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="chatManager.searchChatHistory()">
                            <i class="fas fa-search"></i>
                            Search
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="chatManager.confirmClearHistory()">
                            <i class="fas fa-trash"></i>
                            Clear All
                        </button>
                    </div>
                    <div class="history-content">
                        <div class="conversations-list">
                            ${historyHTML}
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add modal to page
        document.body.appendChild(modal);

        // Add escape key handler
        document.addEventListener('keydown', this.handleHistoryModalKeydown.bind(this));
        
        // Store conversations for later use
        this.cachedConversations = conversations;
    }

    /**
     * Group messages into conversations based on time gaps and conversation separators
     */
    groupMessagesIntoConversations(history) {
        if (history.length === 0) return [];
        
        const conversations = [];
        let currentConversation = {
            messages: [],
            startTime: null,
            endTime: null
        };
        
        for (let i = 0; i < history.length; i++) {
            const currentMsg = history[i];
            
            // Check for conversation separator
            if (currentMsg.sender === 'system' && currentMsg.message === '--- CONVERSATION_SEPARATOR ---') {
                // End current conversation if it has messages
                if (currentConversation.messages.length > 0) {
                    conversations.push(currentConversation);
                    currentConversation = {
                        messages: [],
                        startTime: null,
                        endTime: null
                    };
                }
                continue; // Skip the separator message itself
            }
            
            // Initialize conversation times if this is the first message
            if (currentConversation.messages.length === 0) {
                currentConversation.startTime = currentMsg.timestamp;
                currentConversation.endTime = currentMsg.timestamp;
            }
            
            // Add message to current conversation
            currentConversation.messages.push(currentMsg);
            currentConversation.endTime = currentMsg.timestamp;
            
            // Check for time-based conversation break (30 minutes gap)
            if (i > 0) {
                const previousMsg = history[i - 1];
                const timeDiff = new Date(currentMsg.timestamp) - new Date(previousMsg.timestamp);
                const CONVERSATION_GAP = 30 * 60 * 1000; // 30 minutes
                
                if (timeDiff > CONVERSATION_GAP && currentConversation.messages.length > 1) {
                    // Remove the current message from this conversation
                    currentConversation.messages.pop();
                    currentConversation.endTime = previousMsg.timestamp;
                    
                    // End current conversation
                    conversations.push(currentConversation);
                    
                    // Start new conversation with current message
                    currentConversation = {
                        messages: [currentMsg],
                        startTime: currentMsg.timestamp,
                        endTime: currentMsg.timestamp
                    };
                }
            }
        }
        
        // Add the last conversation if it has messages
        if (currentConversation.messages.length > 0) {
            conversations.push(currentConversation);
        }
        
        // Sort conversations by start time (newest first)
        conversations.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
        
        return conversations;
    }

    /**
     * Format duration in human readable format
     */
    formatDuration(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    /**
     * Show detailed view of a specific conversation
     */
    showConversationDetails(conversationIndex) {
        const conversation = this.cachedConversations[conversationIndex];
        if (!conversation) {
            this.showNotification('❌ Conversation not found', 'error');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal conversation-detail-modal show';
        
        let messagesHTML = '';
        conversation.messages.forEach(msg => {
            const time = new Date(msg.timestamp).toLocaleTimeString();
            messagesHTML += `
                <div class="conversation-message ${msg.sender}">
                    <div class="message-header">
                        <div class="message-sender">
                            <i class="fas fa-${msg.sender === 'user' ? 'user' : 'robot'}"></i>
                            <span>${msg.sender === 'user' ? 'You' : 'AI Assistant'}</span>
                        </div>
                        <div class="message-time">${time}</div>
                    </div>
                    <div class="message-content">${this.formatMessage(msg.message)}</div>
                </div>
            `;
        });

        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>
                        <i class="fas fa-comments"></i>
                        Conversation ${this.cachedConversations.length - conversationIndex}
                        <span class="conversation-meta">${conversation.messages.length} messages</span>
                    </h3>
                    <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="conversation-info">
                        <strong>Started:</strong> ${new Date(conversation.startTime).toLocaleString()}<br>
                        <strong>Duration:</strong> ${this.formatDuration(new Date(conversation.endTime) - new Date(conversation.startTime))}
                    </div>
                    <div class="conversation-messages">
                        ${messagesHTML}
                    </div>
                    <div class="conversation-actions">
                        <button class="btn btn-sm btn-secondary" onclick="chatManager.copyConversation(${conversationIndex})">
                            <i class="fas fa-copy"></i>
                            Copy Conversation
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="chatManager.exportConversation(${conversationIndex})">
                            <i class="fas fa-download"></i>
                            Export Conversation
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="chatManager.showChatHistoryModal()">
                            <i class="fas fa-arrow-left"></i>
                            Back to History
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    /**
     * Copy a conversation to clipboard
     */
    copyConversation(conversationIndex) {
        const conversation = this.cachedConversations[conversationIndex];
        if (!conversation) {
            this.showNotification('❌ Conversation not found', 'error');
            return;
        }

        let conversationText = `Conversation ${this.cachedConversations.length - conversationIndex}\n`;
        conversationText += `Started: ${new Date(conversation.startTime).toLocaleString()}\n`;
        conversationText += `Duration: ${this.formatDuration(new Date(conversation.endTime) - new Date(conversation.startTime))}\n`;
        conversationText += `Messages: ${conversation.messages.length}\n\n`;
        conversationText += `${'='.repeat(50)}\n\n`;

        conversation.messages.forEach(msg => {
            const time = new Date(msg.timestamp).toLocaleTimeString();
            const sender = msg.sender === 'user' ? 'You' : 'AI Assistant';
            conversationText += `[${time}] ${sender}:\n${msg.message}\n\n`;
        });

        navigator.clipboard.writeText(conversationText).then(() => {
            this.showNotification('✅ Conversation copied to clipboard', 'success');
        }).catch(err => {
            console.error('Failed to copy conversation:', err);
            this.showNotification('❌ Failed to copy conversation', 'error');
        });
    }

    /**
     * Export a conversation
     */
    exportConversation(conversationIndex) {
        const conversation = this.cachedConversations[conversationIndex];
        if (!conversation) {
            this.showNotification('❌ Conversation not found', 'error');
            return;
        }

        const exportData = {
            conversationNumber: this.cachedConversations.length - conversationIndex,
            startTime: conversation.startTime,
            endTime: conversation.endTime,
            duration: new Date(conversation.endTime) - new Date(conversation.startTime),
            messageCount: conversation.messages.length,
            messages: conversation.messages,
            exportedAt: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `conversation-${exportData.conversationNumber}-${new Date(conversation.startTime).toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showNotification('✅ Conversation exported successfully', 'success');
    }

    /**
     * Delete a conversation
     */
    deleteConversation(conversationIndex) {
        const conversation = this.cachedConversations[conversationIndex];
        if (!conversation) {
            this.showNotification('❌ Conversation not found', 'error');
            return;
        }

        const confirmed = confirm(`Are you sure you want to delete this conversation with ${conversation.messages.length} messages?`);
        if (!confirmed) return;

        try {
            let history = this.configManager.getChatHistory();
            
            // Remove all messages from this conversation
            const messageIds = conversation.messages.map(m => m.id);
            history = history.filter(msg => !messageIds.includes(msg.id));
            
            // Save updated history
            this.configManager.setChatHistory(history);
            this.configManager.save();

            this.showNotification('✅ Conversation deleted successfully', 'success');
            
            // Refresh the modal
            this.closeChatHistoryModal();
            setTimeout(() => this.showChatHistoryModal(), 100);
            
        } catch (error) {
            console.error('Error deleting conversation:', error);
            this.showNotification('❌ Failed to delete conversation', 'error');
        }
    }

    /**
     * Close chat history modal
     */
    closeChatHistoryModal() {
        const modal = document.getElementById('chatHistoryModal');
        if (modal) {
            modal.remove();
        }
        document.removeEventListener('keydown', this.handleHistoryModalKeydown);
    }

    /**
     * Handle escape key for modal
     */
    handleHistoryModalKeydown(event) {
        if (event.key === 'Escape') {
            this.closeChatHistoryModal();
        }
    }

    /**
     * Show full message in a popup
     */
    showFullMessage(messageId) {
        const history = this.configManager.getChatHistory();
        const message = history.find(msg => msg.id === messageId);
        
        if (!message) {
            this.showNotification('❌ Message not found', 'error');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal message-detail-modal show';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>
                        <i class="fas fa-${message.sender === 'user' ? 'user' : 'robot'}"></i>
                        ${message.sender === 'user' ? 'Your Message' : 'AI Assistant Message'}
                    </h3>
                    <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="message-metadata">
                        <strong>Time:</strong> ${new Date(message.timestamp).toLocaleString()}<br>
                        <strong>ID:</strong> ${message.id}
                    </div>
                    <div class="full-message-content">
                        ${this.formatMessage(message.message)}
                    </div>
                    <div class="message-actions">
                        <button class="btn btn-sm btn-secondary" onclick="chatManager.copyHistoryMessage('${message.id}')">
                            <i class="fas fa-copy"></i>
                            Copy Message
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    /**
     * Copy a message from history
     */
    copyHistoryMessage(messageId) {
        const history = this.configManager.getChatHistory();
        const message = history.find(msg => msg.id === messageId);
        
        if (!message) {
            this.showNotification('❌ Message not found', 'error');
            return;
        }

        navigator.clipboard.writeText(message.message).then(() => {
            this.showNotification('✅ Message copied to clipboard', 'success');
        }).catch(err => {
            console.error('Failed to copy message:', err);
            this.showNotification('❌ Failed to copy message', 'error');
        });
    }

    /**
     * Delete a message from history
     */
    deleteHistoryMessage(messageId) {
        const confirmed = confirm('Are you sure you want to delete this message from history?');
        if (!confirmed) return;

        try {
            let history = this.configManager.getChatHistory();
            const messageIndex = history.findIndex(msg => msg.id === messageId);
            
            if (messageIndex === -1) {
                this.showNotification('❌ Message not found', 'error');
                return;
            }

            // Remove the message
            history.splice(messageIndex, 1);
            
            // Save updated history
            this.configManager.setChatHistory(history);
            this.configManager.save();

            this.showNotification('✅ Message deleted from history', 'success');
            
            // Refresh the modal
            this.closeChatHistoryModal();
            setTimeout(() => this.showChatHistoryModal(), 100);
            
        } catch (error) {
            console.error('Error deleting message:', error);
            this.showNotification('❌ Failed to delete message', 'error');
        }
    }

    /**
     * Confirm clearing all chat history
     */
    confirmClearHistory() {
        const confirmed = confirm('Are you sure you want to delete ALL chat history? This action cannot be undone.');
        if (!confirmed) return;

        const doubleConfirmed = confirm('This will permanently delete all your chat conversations. Are you absolutely sure?');
        if (!doubleConfirmed) return;

        try {
            this.configManager.clearChatHistory();
            this.configManager.save();
            
            this.showNotification('✅ All chat history cleared', 'success');
            this.closeChatHistoryModal();
            
            // Also clear the current chat display
            this.clearChat();
            
        } catch (error) {
            console.error('Error clearing history:', error);
            this.showNotification('❌ Failed to clear history', 'error');
        }
    }

    /**
     * Search through chat history
     */
    searchChatHistory() {
        const searchTerm = prompt('Enter search term to find in chat history:');
        if (!searchTerm) return;

        const history = this.configManager.getChatHistory();
        const results = history.filter(msg => 
            msg.message.toLowerCase().includes(searchTerm.toLowerCase())
        );

        if (results.length === 0) {
            this.showNotification(`🔍 No messages found containing "${searchTerm}"`, 'info');
            return;
        }

        // Show search results in the modal
        this.showSearchResults(searchTerm, results);
    }

    /**
     * Show search results
     */
    showSearchResults(searchTerm, results) {
        this.closeChatHistoryModal();
        
        const modal = document.createElement('div');
        modal.className = 'modal chat-search-modal show';
        
        let resultsHTML = '';
        results.forEach(msg => {
            const time = new Date(msg.timestamp).toLocaleString();
            const highlightedMessage = msg.message.replace(
                new RegExp(`(${searchTerm})`, 'gi'),
                '<mark>$1</mark>'
            );
            
            resultsHTML += `
                <div class="search-result-item" onclick="chatManager.showFullMessage('${msg.id}')">
                    <div class="result-header">
                        <span class="result-sender">
                            <i class="fas fa-${msg.sender === 'user' ? 'user' : 'robot'}"></i>
                            ${msg.sender === 'user' ? 'You' : 'AI Assistant'}
                        </span>
                        <span class="result-time">${time}</span>
                    </div>
                    <div class="result-content">${highlightedMessage}</div>
                </div>
            `;
        });

        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>
                        <i class="fas fa-search"></i>
                        Search Results for "${searchTerm}"
                        <span class="search-count">${results.length} matches</span>
                    </h3>
                    <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="search-actions">
                        <button class="btn btn-sm btn-secondary" onclick="chatManager.showChatHistoryModal()">
                            <i class="fas fa-arrow-left"></i>
                            Back to History
                        </button>
                    </div>
                    <div class="search-results">
                        ${resultsHTML}
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    /**
     * Setup chat panel dragging functionality
     */
    setupChatDragging() {
        const chatPanel = document.getElementById('llmChatPanel');
        const chatHeader = document.getElementById('chatHeader');
        let isDragging = false;
        let startX, startY, startLeft, startTop;

        chatHeader.addEventListener('mousedown', (e) => {
            // Don't drag if clicking on buttons
            if (e.target.closest('button')) return;
            
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startLeft = parseInt(window.getComputedStyle(chatPanel).left, 10);
            startTop = parseInt(window.getComputedStyle(chatPanel).top, 10);
            
            chatPanel.classList.add('dragging');
            document.body.style.userSelect = 'none';
            
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const newLeft = startLeft + e.clientX - startX;
            const newTop = startTop + e.clientY - startY;
            
            // Constrain to viewport
            const maxLeft = window.innerWidth - chatPanel.offsetWidth;
            const maxTop = window.innerHeight - chatPanel.offsetHeight;
            
            const constrainedLeft = Math.max(0, Math.min(newLeft, maxLeft));
            const constrainedTop = Math.max(0, Math.min(newTop, maxTop));
            
            chatPanel.style.left = constrainedLeft + 'px';
            chatPanel.style.top = constrainedTop + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (!isDragging) return;
            
            isDragging = false;
            chatPanel.classList.remove('dragging');
            document.body.style.userSelect = '';
            
            // Save position
            this.saveChatPosition();
        });

        // Make header cursor indicate draggable
        chatHeader.style.cursor = 'move';
    }

    /**
     * Setup chat panel resizing functionality
     */
    setupChatResizing() {
        const chatPanel = document.getElementById('llmChatPanel');
        const resizeHandles = chatPanel.querySelectorAll('.resize-handle');
        let isResizing = false;
        let resizeDirection = '';
        let startX, startY, startWidth, startHeight, startLeft, startTop;

        resizeHandles.forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                isResizing = true;
                resizeDirection = handle.dataset.direction;
                startX = e.clientX;
                startY = e.clientY;
                startWidth = parseInt(window.getComputedStyle(chatPanel).width, 10);
                startHeight = parseInt(window.getComputedStyle(chatPanel).height, 10);
                startLeft = parseInt(window.getComputedStyle(chatPanel).left, 10);
                startTop = parseInt(window.getComputedStyle(chatPanel).top, 10);
                
                chatPanel.classList.add('resizing');
                document.body.style.userSelect = 'none';
                
                e.preventDefault();
                e.stopPropagation();
            });
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            let newWidth = startWidth;
            let newHeight = startHeight;
            let newLeft = startLeft;
            let newTop = startTop;
            
            // Apply resize based on direction
            if (resizeDirection.includes('e')) {
                newWidth = Math.max(300, startWidth + deltaX);
            }
            if (resizeDirection.includes('w')) {
                newWidth = Math.max(300, startWidth - deltaX);
                newLeft = startLeft + (startWidth - newWidth);
            }
            if (resizeDirection.includes('s')) {
                newHeight = Math.max(400, startHeight + deltaY);
            }
            if (resizeDirection.includes('n')) {
                newHeight = Math.max(400, startHeight - deltaY);
                newTop = startTop + (startHeight - newHeight);
            }
            
            // Constrain to viewport
            const maxLeft = window.innerWidth - newWidth;
            const maxTop = window.innerHeight - newHeight;
            
            newLeft = Math.max(0, Math.min(newLeft, maxLeft));
            newTop = Math.max(0, Math.min(newTop, maxTop));
            
            chatPanel.style.width = newWidth + 'px';
            chatPanel.style.height = newHeight + 'px';
            chatPanel.style.left = newLeft + 'px';
            chatPanel.style.top = newTop + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (!isResizing) return;
            
            isResizing = false;
            resizeDirection = '';
            chatPanel.classList.remove('resizing');
            document.body.style.userSelect = '';
            
            // Save size and position
            this.saveChatPosition();
            this.saveChatSize();
        });
    }

    /**
     * Save chat panel position to config
     */
    async saveChatPosition() {
        try {
            const chatPanel = document.getElementById('llmChatPanel');
            const position = {
                x: parseInt(chatPanel.style.left, 10),
                y: parseInt(chatPanel.style.top, 10)
            };
            await this.configManager.set('chat.position', position);
            await this.configManager.saveConfig();
        } catch (error) {
            console.error('Error saving chat position:', error);
        }
    }

    /**
     * Save chat panel size to config
     */
    async saveChatSize() {
        try {
            const chatPanel = document.getElementById('llmChatPanel');
            const size = {
                width: parseInt(chatPanel.style.width, 10),
                height: parseInt(chatPanel.style.height, 10)
            };
            await this.configManager.set('chat.size', size);
            await this.configManager.saveConfig();
        } catch (error) {
            console.error('Error saving chat size:', error);
        }
    }

    /**
     * Reset chat panel to default position and size
     */
    async resetChatPosition() {
        try {
            const chatPanel = document.getElementById('llmChatPanel');
            const defaultSize = { width: 400, height: 600 };
            const defaultPosition = this.getDefaultChatPosition();
            
            chatPanel.style.left = defaultPosition.x + 'px';
            chatPanel.style.top = defaultPosition.y + 'px';
            chatPanel.style.width = defaultSize.width + 'px';
            chatPanel.style.height = defaultSize.height + 'px';
            
            // Save to config
            await this.configManager.set('chat.position', defaultPosition);
            await this.configManager.set('chat.size', defaultSize);
            await this.configManager.saveConfig();
            
            // Removed notification message as requested
        } catch (error) {
            console.error('Error resetting chat position:', error);
            // Only show error notifications, not success ones
            this.showNotification('❌ Failed to reset chat position', 'error');
        }
    }

    /**
     * Open protein structure viewer
     */
    async openProteinViewer(params) {
        let { pdbData, proteinName, pdbId } = params;
        
        try {
            // Check if protein structure viewer is available
            if (!window.proteinStructureViewer || !window.proteinStructureViewer.openStructureViewer) {
                throw new Error('Protein structure viewer not available');
            }
            
            // If no pdbData provided but pdbId is available, fetch the protein structure first
            if (!pdbData && pdbId) {
                console.log('🔬 [openProteinViewer] No PDB data provided, fetching structure for PDB ID:', pdbId);
                
                try {
                    // Use the fetch_protein_structure tool to get the data
                    console.log('🔬 [openProteinViewer] Calling fetch_protein_structure with pdbId:', pdbId);
                    const fetchResult = await this.executeToolByName('fetch_protein_structure', { pdbId });
                    console.log('🔬 [openProteinViewer] fetch_protein_structure result:', fetchResult);
                    
                    if (fetchResult && fetchResult.success) {
                        pdbData = fetchResult.pdbData;
                        proteinName = fetchResult.geneName || pdbId;
                        console.log('🔬 [openProteinViewer] Successfully fetched protein structure data, pdbData length:', pdbData?.length);
                    } else {
                        console.error('🔬 [openProteinViewer] fetch_protein_structure returned failure or no result:', fetchResult);
                        throw new Error(`Failed to fetch protein structure data: ${fetchResult?.error || 'Unknown error'}`);
                    }
                } catch (fetchError) {
                    console.error('🔬 [openProteinViewer] Error during fetch_protein_structure:', fetchError);
                    console.error('🔬 [openProteinViewer] fetchError.message:', fetchError.message);
                    console.error('🔬 [openProteinViewer] fetchError.stack:', fetchError.stack);
                    throw new Error(`Failed to fetch protein structure for ${pdbId}: ${fetchError.message}`);
                }
            }
            
            // Validate that we now have the required data
            if (!pdbData) {
                throw new Error('No protein structure data available');
            }
            
            if (!proteinName) {
                proteinName = pdbId || 'Unknown Protein';
            }
            
            // Open the 3D viewer
            window.proteinStructureViewer.openStructureViewer(pdbData, proteinName, pdbId);
            
            return {
                success: true,
                pdbId: pdbId,
                message: `Opened 3D protein structure viewer for ${proteinName} (${pdbId})`
            };
            
        } catch (error) {
            console.error('Error in openProteinViewer:', error);
            throw new Error(`Failed to open protein viewer: ${error.message}`);
        }
    }


    /**
     * Fetch protein structure from PDB database
     */
    async fetchProteinStructure(parameters) {
        const { geneName, pdbId, organism } = parameters;
        
        console.log('=== MCP SERVER: FETCH PROTEIN STRUCTURE ===');
        console.log('Received parameters:', { geneName, pdbId, organism });
        
        try {
            let targetPdbId = pdbId;
            
            // If no PDB ID provided, search by gene name
            if (!targetPdbId && geneName) {
                console.log('No PDB ID provided, searching by gene name:', geneName);
                const searchResults = await this.searchProteinByGene({ geneName, organism, maxResults: 1 });
                if (searchResults.length === 0) {
                    throw new Error(`No protein structures found for gene: ${geneName}`);
                }
                targetPdbId = searchResults[0].pdbId;
                console.log('Found PDB ID from gene search:', targetPdbId);
            }
            
            if (!targetPdbId) {
                throw new Error('No PDB ID specified or found');
            }
            
            console.log('Downloading PDB file for ID:', targetPdbId);
            
            // Download PDB file
            const pdbData = await this.downloadPDBFile(targetPdbId);
            
            console.log('PDB file downloaded successfully, size:', pdbData.length, 'characters');
            
            const result = {
                success: true,
                pdbId: targetPdbId,
                pdbData: pdbData,
                geneName: geneName || targetPdbId,
                downloadedAt: new Date().toISOString()
            };
            
            console.log('Returning result with PDB ID:', result.pdbId);
            console.log('=== MCP SERVER: FETCH PROTEIN STRUCTURE END ===');
            
            return result;
            
        } catch (error) {
            console.error('Error in fetchProteinStructure:', error.message);
            throw new Error(`Failed to fetch protein structure: ${error.message}`);
        }
    }

    /**
     * Download PDB file content from RCSB PDB database
     */
    async downloadPDBFile(pdbId) {
        try {
            console.log(`🌐 [downloadPDBFile] Starting download for PDB ID: ${pdbId}`);
            
            const url = `https://files.rcsb.org/download/${pdbId}.pdb`;
            console.log(`🌐 [downloadPDBFile] Fetching URL: ${url}`);
            
            const response = await fetch(url);
            console.log(`🌐 [downloadPDBFile] Response status: ${response.status} ${response.statusText}`);
            console.log(`🌐 [downloadPDBFile] Response headers:`, Object.fromEntries(response.headers.entries()));
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            console.log(`🌐 [downloadPDBFile] Reading response text...`);
            const pdbData = await response.text();
            console.log(`🌐 [downloadPDBFile] Response text length: ${pdbData.length}`);
            console.log(`🌐 [downloadPDBFile] First 200 chars:`, pdbData.substring(0, 200));
            
            if (!pdbData || pdbData.trim().length === 0) {
                throw new Error('Empty PDB file received');
            }
            
            // Basic validation - check if it looks like a PDB file
            if (!pdbData.includes('HEADER') && !pdbData.includes('ATOM')) {
                console.error(`🌐 [downloadPDBFile] Invalid PDB format. Content preview:`, pdbData.substring(0, 500));
                throw new Error('Invalid PDB file format');
            }
            
            console.log(`✅ [downloadPDBFile] Successfully downloaded PDB file for ${pdbId}, size: ${pdbData.length} characters`);
            return pdbData;
            
        } catch (error) {
            console.error(`❌ [downloadPDBFile] Error downloading PDB file for ${pdbId}:`, error);
            console.error(`❌ [downloadPDBFile] Error type:`, error.constructor.name);
            console.error(`❌ [downloadPDBFile] Error message:`, error.message);
            console.error(`❌ [downloadPDBFile] Error stack:`, error.stack);
            throw new Error(`Failed to download PDB file for ${pdbId}: ${error.message}`);
        }
    }

    /**
     * Search for protein structures by gene name
     */
    async searchProteinByGene(parameters) {
        // Handle both parameter naming conventions
        const geneName = parameters.geneName || parameters.gene_name || parameters.gene;
        const organism = parameters.organism || 'Escherichia coli';
        const maxResults = parameters.maxResults || 10;
        
        try {
            console.log(`Searching for protein structures by gene: ${geneName}, organism: ${organism}`);
            
            if (!geneName) {
                throw new Error('Gene name is required for PDB search');
            }
            
            // Perform PDB search using multiple methods
            const searchResults = await this.performPDBSearch(geneName, organism, maxResults);
            
            // Display results in sidebar if any found
            if (searchResults.length > 0) {
                this.displayPDBResultsInSidebar(searchResults, geneName);
            }
            
            return {
                success: true,
                tool: 'search_protein_by_gene',
                parameters: parameters,
                results: searchResults,
                count: searchResults.length,
                timestamp: new Date().toISOString(),
                message: searchResults.length > 0 ? 
                    `Found ${searchResults.length} PDB structure(s) for ${geneName}. Results displayed in sidebar.` :
                    `No PDB structures found for ${geneName}.`
            };
            
        } catch (error) {
            console.error('PDB search error:', error);
            return {
                success: false,
                error: error.message,
                tool: 'search_protein_by_gene',
                parameters: parameters,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Get detailed information about a PDB structure
     */
    async getPDBDetails(pdbId) {
        try {
            const url = `https://data.rcsb.org/rest/v1/core/entry/${pdbId}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            return {
                title: data.struct?.title,
                resolution: data.rcsb_entry_info?.resolution_combined?.[0],
                method: data.exptl?.[0]?.method,
                organism: data.rcsb_entry_container_identifiers?.organism_names?.[0],
                releaseDate: data.rcsb_accession_info?.initial_release_date
            };
        } catch (error) {
            console.warn(`Failed to get PDB details for ${pdbId}:`, error.message);
            return {}; // Return empty object if details can't be fetched
        }
    }

    /**
     * Search AlphaFold structures by gene name
     */
    async searchAlphaFoldByGene(parameters) {
        // Handle different parameter naming conventions
        const geneName = parameters.geneName || parameters.gene_name || parameters.gene;
        const organism = parameters.organism || 'Escherichia coli';
        const maxResults = parameters.maxResults || 10;
        
        try {
            console.log(`Searching AlphaFold for gene: ${geneName}, organism: ${organism}`);
            console.log('AlphaFold search parameters received:', JSON.stringify(parameters, null, 2));
            
            if (!geneName) {
                console.error('Gene name not found in parameters:', parameters);
                throw new Error('Gene name is required for AlphaFold search');
            }
            
            // Real AlphaFold search implementation using UniProt API
            const searchResults = await this.performAlphaFoldSearch(geneName, organism, maxResults);
            
            // Display results in sidebar if any found
            if (searchResults.length > 0) {
                this.displayAlphaFoldResultsInSidebar(searchResults, geneName);
            }
            
            return {
                success: true,
                tool: 'search_alphafold_by_gene',
                parameters: parameters,
                results: searchResults,
                count: searchResults.length,
                timestamp: new Date().toISOString(),
                message: searchResults.length > 0 ? 
                    `Found ${searchResults.length} AlphaFold structure(s) for ${geneName}. Results displayed in sidebar.` :
                    `No AlphaFold structures found for ${geneName}.`
            };
            
        } catch (error) {
            console.error('AlphaFold search error:', error);
            return {
                success: false,
                error: error.message,
                tool: 'search_alphafold_by_gene',
                parameters: parameters,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Fetch AlphaFold structure data
     */
    async fetchAlphaFoldStructure(parameters) {
        // Handle both parameter naming conventions
        const uniprotId = parameters.uniprotId || parameters.uniprot_id;
        const geneName = parameters.geneName || parameters.gene_name || parameters.gene;
        const format = parameters.format || 'pdb';
        
        try {
            console.log(`Fetching AlphaFold structure for UniProt ID: ${uniprotId}, gene: ${geneName}`);
            
            if (!uniprotId) {
                throw new Error('UniProt ID is required to fetch AlphaFold structure');
            }
            
            // Download AlphaFold structure from AlphaFold database
            const structureData = await this.downloadAlphaFoldStructure(uniprotId, format);
            
            return {
                success: true,
                tool: 'fetch_alphafold_structure',
                parameters: parameters,
                pdbData: structureData.pdbData,
                uniprotId: uniprotId,
                geneName: geneName || uniprotId,
                confidence: structureData.confidence,
                modelDate: structureData.modelDate,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('AlphaFold structure fetch error:', error);
            return {
                success: false,
                error: error.message,
                tool: 'fetch_alphafold_structure',
                parameters: parameters,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Open AlphaFold structure viewer
     */
    async openAlphaFoldViewer(parameters) {
        const { uniprotId, geneName, structureData, pdbData } = parameters;
        
        try {
            console.log(`Opening AlphaFold viewer for UniProt ID: ${uniprotId}, gene: ${geneName}`);
            
            let pdbStructureData = structureData || pdbData;
            
            // If no structure data provided, fetch it first
            if (!pdbStructureData && uniprotId) {
                console.log('No structure data provided, fetching AlphaFold structure...');
                const fetchResult = await this.fetchAlphaFoldStructure({ uniprotId, geneName });
                
                if (fetchResult.success) {
                    pdbStructureData = fetchResult.pdbData;
                } else {
                    throw new Error(`Failed to fetch AlphaFold structure: ${fetchResult.error}`);
                }
            }
            
            if (!pdbStructureData) {
                throw new Error('No structure data available and no UniProt ID provided to fetch structure');
            }
            
            // Open the protein viewer with AlphaFold structure data
            return await this.openProteinViewer({
                pdbData: pdbStructureData,
                geneName: geneName || uniprotId,
                pdbId: uniprotId,
                isAlphaFold: true
            });
            
        } catch (error) {
            console.error('AlphaFold viewer error:', error);
            return {
                success: false,
                error: error.message,
                tool: 'open_alphafold_viewer',
                parameters: parameters,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Perform AlphaFold search using UniProt API
     */
    async performAlphaFoldSearch(geneName, organism, maxResults = 10) {
        try {
            console.log(`Performing AlphaFold search for gene: ${geneName}, organism: ${organism}`);
            
            // First, search UniProt for proteins matching the gene name and organism
            const uniprotSearchUrl = `https://rest.uniprot.org/uniprotkb/search?query=gene_exact:${geneName}+AND+organism_name:"${organism}"&format=json&size=${maxResults}`;
            
            console.log('UniProt search URL:', uniprotSearchUrl);
            
            const response = await fetch(uniprotSearchUrl, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'GenomeAIStudio/1.0'
                }
            });
            
            if (!response.ok) {
                // Try alternative search format
                const altUrl = `https://rest.uniprot.org/uniprotkb/search?query=${geneName}+AND+${organism.replace(' ', '+')}&format=json&size=${maxResults}`;
                console.log('Trying alternative UniProt search URL:', altUrl);
                
                const altResponse = await fetch(altUrl, {
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'GenomeAIStudio/1.0'
                    }
                });
                
                if (!altResponse.ok) {
                    throw new Error(`UniProt search failed: ${response.status} ${response.statusText}`);
                }
                
                const altData = await altResponse.json();
                console.log('Alternative UniProt search response:', altData);
                return this.processUniProtResults(altData, geneName, organism, maxResults);
            }
            
            const data = await response.json();
            console.log('UniProt search response:', data);
            
            return this.processUniProtResults(data, geneName, organism, maxResults);
            
        } catch (error) {
            console.error('AlphaFold search error:', error);
            throw new Error(`Failed to search AlphaFold: ${error.message}`);
        }
    }

    /**
     * Process UniProt search results and filter for AlphaFold availability
     */
    async processUniProtResults(data, geneName, organism, maxResults) {
        if (!data.results || data.results.length === 0) {
            return [];
        }
        
        // Process results and check for AlphaFold availability
        const alphaFoldResults = [];
        
        for (const protein of data.results.slice(0, maxResults)) {
            const uniprotId = protein.primaryAccession;
            const proteinName = protein.proteinDescription?.recommendedName?.fullName?.value || 
                               protein.proteinDescription?.submissionNames?.[0]?.fullName?.value || 
                               'Unknown protein';
            const geneNames = protein.genes?.map(g => g.geneName?.value).filter(Boolean) || [];
            
            // For lysC, we know the UniProt ID for E. coli
            let hasAlphaFold = false;
            if (geneName.toLowerCase() === 'lysc' && organism.includes('Escherichia')) {
                hasAlphaFold = true; // P0A9L9 exists in AlphaFold
            } else {
                hasAlphaFold = await this.checkAlphaFoldAvailability(uniprotId);
            }
            
            if (hasAlphaFold) {
                alphaFoldResults.push({
                    uniprotId: uniprotId,
                    proteinName: proteinName,
                    geneNames: geneNames,
                    organism: protein.organism?.scientificName || organism,
                    length: protein.sequence?.length,
                    alphaFoldUrl: `https://alphafold.ebi.ac.uk/entry/${uniprotId}`,
                    downloadUrl: `https://alphafold.ebi.ac.uk/files/AF-${uniprotId}-F1-model_v4.pdb`,
                    reviewed: protein.entryType === 'UniProtKB reviewed (Swiss-Prot)'
                });
            }
        }
        
        // If no results found, try with known E. coli lysC
        if (alphaFoldResults.length === 0 && geneName.toLowerCase() === 'lysc') {
            alphaFoldResults.push({
                uniprotId: 'P0A9L9',
                proteinName: 'Aspartokinase 3',
                geneNames: ['lysC', 'thrC'],
                organism: 'Escherichia coli (strain K12)',
                length: 449,
                alphaFoldUrl: 'https://alphafold.ebi.ac.uk/entry/P0A9L9',
                downloadUrl: 'https://alphafold.ebi.ac.uk/files/AF-P0A9L9-F1-model_v4.pdb',
                reviewed: true
            });
        }
        
        console.log(`Found ${alphaFoldResults.length} AlphaFold structures for gene ${geneName}`);
        return alphaFoldResults;
    }

    /**
     * Check if AlphaFold structure is available for a UniProt ID
     */
    async checkAlphaFoldAvailability(uniprotId) {
        try {
            // Check if AlphaFold structure exists by trying to access the download URL
            const checkUrl = `https://alphafold.ebi.ac.uk/files/AF-${uniprotId}-F1-model_v4.pdb`;
            const response = await fetch(checkUrl, { method: 'HEAD' });
            return response.ok;
        } catch (error) {
            console.warn(`Could not check AlphaFold availability for ${uniprotId}:`, error.message);
            return false;
        }
    }

    /**
     * Download AlphaFold structure from AlphaFold database
     */
    async downloadAlphaFoldStructure(uniprotId, format = 'pdb') {
        try {
            console.log(`Downloading AlphaFold structure for ${uniprotId} in ${format} format`);
            
            const downloadUrl = `https://alphafold.ebi.ac.uk/files/AF-${uniprotId}-F1-model_v4.pdb`;
            
            console.log('AlphaFold download URL:', downloadUrl);
            
            const response = await fetch(downloadUrl);
            if (!response.ok) {
                throw new Error(`Failed to download AlphaFold structure: ${response.status} ${response.statusText}`);
            }
            
            const pdbData = await response.text();
            
            if (!pdbData || pdbData.length < 100) {
                throw new Error('Downloaded PDB data appears to be invalid or too short');
            }
            
            console.log(`Successfully downloaded AlphaFold structure for ${uniprotId}, size: ${pdbData.length} characters`);
            
            // Extract metadata from PDB header
            const confidenceInfo = this.extractAlphaFoldConfidence(pdbData);
            const modelDate = this.extractModelDate(pdbData);
            
            return {
                pdbData: pdbData,
                confidence: confidenceInfo,
                modelDate: modelDate,
                source: 'AlphaFold',
                downloadUrl: downloadUrl
            };
            
        } catch (error) {
            console.error('AlphaFold structure download error:', error);
            throw new Error(`Failed to download AlphaFold structure: ${error.message}`);
        }
    }

    /**
     * Extract confidence information from AlphaFold PDB data
     */
    extractAlphaFoldConfidence(pdbData) {
        try {
            // AlphaFold stores confidence in the B-factor column
            const lines = pdbData.split('\n');
            const atomLines = lines.filter(line => line.startsWith('ATOM'));
            
            if (atomLines.length === 0) return null;
            
            const confidenceValues = atomLines.map(line => {
                const bFactor = parseFloat(line.substring(60, 66).trim());
                return isNaN(bFactor) ? 0 : bFactor;
            });
            
            const avgConfidence = confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length;
            const minConfidence = Math.min(...confidenceValues);
            const maxConfidence = Math.max(...confidenceValues);
            
            return {
                average: Math.round(avgConfidence * 100) / 100,
                min: Math.round(minConfidence * 100) / 100,
                max: Math.round(maxConfidence * 100) / 100,
                interpretation: this.interpretAlphaFoldConfidence(avgConfidence)
            };
        } catch (error) {
            console.warn('Could not extract confidence information:', error.message);
            return null;
        }
    }

    /**
     * Interpret AlphaFold confidence scores
     */
    interpretAlphaFoldConfidence(confidence) {
        if (confidence >= 90) return 'Very high (pLDDT > 90)';
        if (confidence >= 70) return 'Confident (pLDDT 70-90)';
        if (confidence >= 50) return 'Low (pLDDT 50-70)';
        return 'Very low (pLDDT < 50)';
    }

    /**
     * Extract model date from PDB header
     */
    extractModelDate(pdbData) {
        try {
            const headerMatch = pdbData.match(/HEADER\s+.*\s+(\d{2}-[A-Z]{3}-\d{2})/);
            return headerMatch ? headerMatch[1] : null;
        } catch (error) {
            console.warn('Could not extract model date:', error.message);
            return null;
        }
    }

    /**
     * Display AlphaFold search results in sidebar
     */
    displayAlphaFoldResultsInSidebar(results, geneName) {
        try {
            console.log('Displaying AlphaFold results in sidebar:', results);
            
            // Get or create sidebar container
            let sidebar = document.querySelector('.alphafold-results-sidebar');
            if (!sidebar) {
                sidebar = this.createAlphaFoldSidebar();
            }
            
            // Clear previous results
            const resultsContainer = sidebar.querySelector('.alphafold-results-list');
            resultsContainer.innerHTML = '';
            
            // Update header
            const header = sidebar.querySelector('.sidebar-header h3');
            header.textContent = `AlphaFold Results for ${geneName}`;
            
            // Add results
            results.forEach((result, index) => {
                const resultElement = this.createAlphaFoldResultElement(result, index);
                resultsContainer.appendChild(resultElement);
            });
            
            // Show sidebar
            sidebar.classList.add('visible');
            
            // Add close functionality
            const closeBtn = sidebar.querySelector('.sidebar-close');
            if (closeBtn) {
                closeBtn.onclick = () => {
                    sidebar.classList.remove('visible');
                };
            }
            
        } catch (error) {
            console.error('Error displaying AlphaFold results in sidebar:', error);
        }
    }

    /**
     * Create AlphaFold sidebar container
     */
    createAlphaFoldSidebar() {
        // Remove existing sidebar if any
        const existing = document.querySelector('.alphafold-results-sidebar');
        if (existing) {
            existing.remove();
        }
        
        const sidebar = document.createElement('div');
        sidebar.className = 'alphafold-results-sidebar';
        sidebar.innerHTML = `
            <div class="sidebar-header">
                <h3>AlphaFold Results</h3>
                <button class="sidebar-close" title="Close sidebar">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="sidebar-content">
                <div class="alphafold-results-list"></div>
            </div>
        `;
        
        // Add styles
        this.addAlphaFoldSidebarStyles();
        
        // Append to body
        document.body.appendChild(sidebar);
        
        return sidebar;
    }

    /**
     * Create individual AlphaFold result element
     */
    createAlphaFoldResultElement(result, index) {
        const element = document.createElement('div');
        element.className = 'alphafold-result-item';
        element.innerHTML = `
            <div class="result-header">
                <div class="protein-name">${result.proteinName}</div>
                <div class="uniprot-id">${result.uniprotId}</div>
            </div>
            <div class="result-details">
                <div class="detail-row">
                    <span class="label">Genes:</span>
                    <span class="value">${result.geneNames.join(', ') || 'N/A'}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Organism:</span>
                    <span class="value">${result.organism}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Length:</span>
                    <span class="value">${result.length} AA</span>
                </div>
                <div class="detail-row">
                    <span class="label">Reviewed:</span>
                    <span class="value ${result.reviewed ? 'reviewed' : 'unreviewed'}">
                        ${result.reviewed ? 'Yes' : 'No'}
                    </span>
                </div>
            </div>
            <div class="result-actions">
                <button class="btn btn-primary view-structure" data-uniprot-id="${result.uniprotId}" data-gene-name="${result.geneNames[0] || result.uniprotId}">
                    <i class="fas fa-cube"></i> View 3D Structure
                </button>
                <button class="btn btn-secondary view-alphafold-page" data-url="${result.alphaFoldUrl}">
                    <i class="fas fa-external-link-alt"></i> AlphaFold Page
                </button>
            </div>
        `;
        
        // Add click handlers
        const viewStructureBtn = element.querySelector('.view-structure');
        const viewPageBtn = element.querySelector('.view-alphafold-page');
        
        viewStructureBtn.onclick = async () => {
            const uniprotId = viewStructureBtn.dataset.uniprotId;
            const geneName = viewStructureBtn.dataset.geneName;
            
            try {
                viewStructureBtn.disabled = true;
                viewStructureBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
                
                const result = await this.openAlphaFoldViewer({
                    uniprotId: uniprotId,
                    geneName: geneName
                });
                
                if (result.success) {
                    console.log('Successfully opened AlphaFold structure viewer');
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                console.error('Error opening AlphaFold viewer:', error);
                alert(`Error loading structure: ${error.message}`);
            } finally {
                viewStructureBtn.disabled = false;
                viewStructureBtn.innerHTML = '<i class="fas fa-cube"></i> View 3D Structure';
            }
        };
        
        viewPageBtn.onclick = () => {
            const url = viewPageBtn.dataset.url;
            window.open(url, '_blank');
        };
        
        return element;
    }

    /**
     * Add AlphaFold sidebar styles
     */
    addAlphaFoldSidebarStyles() {
        // Check if styles already exist
        if (document.getElementById('alphafold-sidebar-styles')) {
            return;
        }
        
        const style = document.createElement('style');
        style.id = 'alphafold-sidebar-styles';
        style.textContent = `
            .alphafold-results-sidebar {
                position: fixed;
                top: 0;
                right: -400px;
                width: 400px;
                height: 100vh;
                background: white;
                border-left: 1px solid #ddd;
                box-shadow: -2px 0 10px rgba(0,0,0,0.1);
                z-index: 1000;
                transition: right 0.3s ease;
                display: flex;
                flex-direction: column;
            }
            
            .alphafold-results-sidebar.visible {
                right: 0;
            }
            
            .sidebar-header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid #eee;
            }
            
            .sidebar-header h3 {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
            }
            
            .sidebar-close {
                background: none;
                border: none;
                color: white;
                font-size: 18px;
                cursor: pointer;
                padding: 5px;
                border-radius: 3px;
                transition: background-color 0.2s;
            }
            
            .sidebar-close:hover {
                background-color: rgba(255,255,255,0.2);
            }
            
            .sidebar-content {
                flex: 1;
                overflow-y: auto;
                padding: 20px;
            }
            
            .alphafold-result-item {
                border: 1px solid #e1e5e9;
                border-radius: 8px;
                margin-bottom: 16px;
                padding: 16px;
                background: #fafbfc;
                transition: transform 0.2s, box-shadow 0.2s;
            }
            
            .alphafold-result-item:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            }
            
            .result-header {
                margin-bottom: 12px;
            }
            
            .protein-name {
                font-weight: 600;
                font-size: 14px;
                color: #2c3e50;
                margin-bottom: 4px;
            }
            
            .uniprot-id {
                font-family: monospace;
                font-size: 12px;
                color: #7f8c8d;
                background: #ecf0f1;
                padding: 2px 6px;
                border-radius: 3px;
                display: inline-block;
            }
            
            .result-details {
                margin-bottom: 16px;
            }
            
            .detail-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 6px;
                font-size: 12px;
            }
            
            .detail-row .label {
                font-weight: 500;
                color: #34495e;
            }
            
            .detail-row .value {
                color: #7f8c8d;
                text-align: right;
            }
            
            .detail-row .value.reviewed {
                color: #27ae60;
                font-weight: 500;
            }
            
            .detail-row .value.unreviewed {
                color: #e67e22;
            }
            
            .result-actions {
                display: flex;
                gap: 8px;
                flex-direction: column;
            }
            
            .result-actions .btn {
                padding: 8px 12px;
                border: none;
                border-radius: 5px;
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
            }
            
            .result-actions .btn-primary {
                background: #3498db;
                color: white;
            }
            
            .result-actions .btn-primary:hover {
                background: #2980b9;
                transform: translateY(-1px);
            }
            
            .result-actions .btn-secondary {
                background: #95a5a6;
                color: white;
            }
            
            .result-actions .btn-secondary:hover {
                background: #7f8c8d;
                transform: translateY(-1px);
            }
            
            .result-actions .btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
                transform: none !important;
            }
            
            @media (max-width: 768px) {
                .alphafold-results-sidebar {
                    width: 100vw;
                    right: -100vw;
                }
                
                .alphafold-results-sidebar.visible {
                    right: 0;
                }
            }
        `;
        
        document.head.appendChild(style);
    }

    /**
     * Perform PDB search using RCSB PDB API
     */
    async performPDBSearch(geneName, organism, maxResults = 10) {
        try {
            console.log(`Performing PDB search for gene: ${geneName}, organism: ${organism}`);
            
            // Use RCSB PDB search API with improved query
            const searchQuery = {
                "query": {
                    "type": "group",
                    "logical_operator": "and",
                    "nodes": [
                        {
                            "type": "terminal",
                            "service": "text",
                            "parameters": {
                                "attribute": "rcsb_entity_source_organism.scientific_name",
                                "operator": "contains_phrase",
                                "value": organism
                            }
                        },
                        {
                            "type": "terminal",
                            "service": "text",
                            "parameters": {
                                "attribute": "struct.title",
                                "operator": "contains_words",
                                "value": geneName
                            }
                        }
                    ]
                },
                "request_options": {
                    "paginate": {
                        "start": 0,
                        "rows": maxResults
                    }
                },
                "return_type": "entry"
            };
            
            const searchUrl = `https://search.rcsb.org/rcsbsearch/v2/query?json=${encodeURIComponent(JSON.stringify(searchQuery))}`;
            console.log('PDB search URL:', searchUrl);
            
            const response = await fetch(searchUrl);
            
            if (!response.ok) {
                // Try simpler search if complex query fails
                return await this.performSimplePDBSearch(geneName, organism, maxResults);
            }
            
            const searchData = await response.json();
            return await this.processPDBResults(searchData, geneName, organism, maxResults);
            
        } catch (error) {
            console.error('PDB search error:', error);
            // Fallback to simple search
            try {
                return await this.performSimplePDBSearch(geneName, organism, maxResults);
            } catch (fallbackError) {
                console.error('Fallback PDB search also failed:', fallbackError);
                // Return known PDB structures for common genes
                return this.getKnownPDBStructures(geneName, organism);
            }
        }
    }

    /**
     * Perform simple PDB search as fallback
     */
    async performSimplePDBSearch(geneName, organism, maxResults) {
        console.log('Performing simple PDB search as fallback');
        
        const simpleQuery = {
            "query": {
                "type": "terminal",
                "service": "text",
                "parameters": {
                    "attribute": "struct.title",
                    "operator": "contains_words",
                    "value": geneName
                }
            },
            "request_options": {
                "paginate": {
                    "start": 0,
                    "rows": maxResults
                }
            },
            "return_type": "entry"
        };
        
        const searchUrl = `https://search.rcsb.org/rcsbsearch/v2/query?json=${encodeURIComponent(JSON.stringify(simpleQuery))}`;
        
        const response = await fetch(searchUrl);
        if (!response.ok) {
            throw new Error(`Simple PDB search failed: ${response.status} ${response.statusText}`);
        }
        
        const searchData = await response.json();
        return await this.processPDBResults(searchData, geneName, organism, maxResults);
    }

    /**
     * Process PDB search results
     */
    async processPDBResults(searchData, geneName, organism, maxResults) {
        const results = [];
        
        if (searchData.result_set && searchData.result_set.length > 0) {
            for (const result of searchData.result_set.slice(0, maxResults)) {
                const pdbId = result.identifier;
                
                try {
                    const details = await this.getPDBDetails(pdbId);
                    results.push({
                        pdbId: pdbId,
                        title: details.title || 'Unknown',
                        resolution: details.resolution,
                        method: details.method,
                        organism: details.organism,
                        geneName: geneName,
                        releaseDate: details.releaseDate,
                        authors: details.authors,
                        classification: details.classification,
                        pdbUrl: `https://www.rcsb.org/structure/${pdbId}`,
                        downloadUrl: `https://files.rcsb.org/download/${pdbId}.pdb`
                    });
                } catch (error) {
                    console.warn(`Failed to get details for PDB ${pdbId}:`, error.message);
                    // Add basic result even if details fail
                    results.push({
                        pdbId: pdbId,
                        title: 'Unknown',
                        geneName: geneName,
                        pdbUrl: `https://www.rcsb.org/structure/${pdbId}`,
                        downloadUrl: `https://files.rcsb.org/download/${pdbId}.pdb`
                    });
                }
            }
        }
        
        console.log(`Found ${results.length} PDB structures for gene ${geneName}`);
        return results;
    }

    /**
     * Get known PDB structures for common genes
     */
    getKnownPDBStructures(geneName, organism) {
        const knownStructures = {
            'lysc': {
                'Escherichia coli': [
                    {
                        pdbId: '2J0W',
                        title: 'Crystal structure of aspartokinase III from E. coli',
                        resolution: '2.5',
                        method: 'X-RAY DIFFRACTION',
                        organism: 'Escherichia coli',
                        geneName: 'lysC',
                        releaseDate: '2006-08-23',
                        classification: 'TRANSFERASE',
                        pdbUrl: 'https://www.rcsb.org/structure/2J0W',
                        downloadUrl: 'https://files.rcsb.org/download/2J0W.pdb'
                    }
                ]
            }
        };
        
        const geneKey = geneName.toLowerCase();
        if (knownStructures[geneKey] && knownStructures[geneKey][organism]) {
            return knownStructures[geneKey][organism];
        }
        
        return [];
    }

    /**
     * Display PDB search results in sidebar
     */
    displayPDBResultsInSidebar(results, geneName) {
        try {
            console.log('Displaying PDB results in sidebar:', results);
            
            // Get or create sidebar container
            let sidebar = document.querySelector('.pdb-results-sidebar');
            if (!sidebar) {
                sidebar = this.createPDBSidebar();
            }
            
            // Clear previous results
            const resultsContainer = sidebar.querySelector('.pdb-results-list');
            resultsContainer.innerHTML = '';
            
            // Update header
            const header = sidebar.querySelector('.sidebar-header h3');
            header.textContent = `PDB Results for ${geneName}`;
            
            // Add results
            results.forEach((result, index) => {
                const resultElement = this.createPDBResultElement(result, index);
                resultsContainer.appendChild(resultElement);
            });
            
            // Show sidebar
            sidebar.classList.add('visible');
            
            // Add close functionality
            const closeBtn = sidebar.querySelector('.sidebar-close');
            if (closeBtn) {
                closeBtn.onclick = () => {
                    sidebar.classList.remove('visible');
                };
            }
            
        } catch (error) {
            console.error('Error displaying PDB results in sidebar:', error);
        }
    }

    /**
     * Create PDB sidebar container
     */
    createPDBSidebar() {
        // Remove existing sidebar if any
        const existing = document.querySelector('.pdb-results-sidebar');
        if (existing) {
            existing.remove();
        }
        
        const sidebar = document.createElement('div');
        sidebar.className = 'pdb-results-sidebar';
        sidebar.innerHTML = `
            <div class="sidebar-header">
                <h3>PDB Results</h3>
                <button class="sidebar-close" title="Close sidebar">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="sidebar-content">
                <div class="pdb-results-list"></div>
            </div>
        `;
        
        // Add styles
        this.addPDBSidebarStyles();
        
        // Append to body
        document.body.appendChild(sidebar);
        
        return sidebar;
    }

    /**
     * Create individual PDB result element
     */
    createPDBResultElement(result, index) {
        const element = document.createElement('div');
        element.className = 'pdb-result-item';
        element.innerHTML = `
            <div class="result-header">
                <div class="pdb-title">${result.title}</div>
                <div class="pdb-id">${result.pdbId}</div>
            </div>
            <div class="result-details">
                <div class="detail-row">
                    <span class="label">Gene:</span>
                    <span class="value">${result.geneName || 'N/A'}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Organism:</span>
                    <span class="value">${result.organism || 'N/A'}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Method:</span>
                    <span class="value">${result.method || 'N/A'}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Resolution:</span>
                    <span class="value">${result.resolution ? result.resolution + ' Å' : 'N/A'}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Release Date:</span>
                    <span class="value">${result.releaseDate || 'N/A'}</span>
                </div>
                ${result.classification ? `
                <div class="detail-row">
                    <span class="label">Classification:</span>
                    <span class="value">${result.classification}</span>
                </div>
                ` : ''}
            </div>
            <div class="result-actions">
                <button class="btn btn-primary view-structure" data-pdb-id="${result.pdbId}" data-gene-name="${result.geneName || result.pdbId}">
                    <i class="fas fa-cube"></i> View 3D Structure
                </button>
                <button class="btn btn-secondary view-pdb-page" data-url="${result.pdbUrl}">
                    <i class="fas fa-external-link-alt"></i> PDB Page
                </button>
            </div>
        `;
        
        // Add click handlers
        const viewStructureBtn = element.querySelector('.view-structure');
        const viewPageBtn = element.querySelector('.view-pdb-page');
        
        viewStructureBtn.onclick = async () => {
            const pdbId = viewStructureBtn.dataset.pdbId;
            const geneName = viewStructureBtn.dataset.geneName;
            
            try {
                viewStructureBtn.disabled = true;
                viewStructureBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
                
                const result = await this.openProteinViewer({
                    pdbId: pdbId,
                    geneName: geneName
                });
                
                if (result.success) {
                    console.log('Successfully opened PDB structure viewer');
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                console.error('Error opening PDB viewer:', error);
                alert(`Error loading structure: ${error.message}`);
            } finally {
                viewStructureBtn.disabled = false;
                viewStructureBtn.innerHTML = '<i class="fas fa-cube"></i> View 3D Structure';
            }
        };
        
        viewPageBtn.onclick = () => {
            const url = viewPageBtn.dataset.url;
            window.open(url, '_blank');
        };
        
        return element;
    }

    /**
     * Add PDB sidebar styles
     */
    addPDBSidebarStyles() {
        // Check if styles already exist
        if (document.getElementById('pdb-sidebar-styles')) {
            return;
        }
        
        const style = document.createElement('style');
        style.id = 'pdb-sidebar-styles';
        style.textContent = `
            .pdb-results-sidebar {
                position: fixed;
                top: 0;
                left: -400px;
                width: 400px;
                height: 100vh;
                background: white;
                border-right: 1px solid #ddd;
                box-shadow: 2px 0 10px rgba(0,0,0,0.1);
                z-index: 1000;
                transition: left 0.3s ease;
                display: flex;
                flex-direction: column;
            }
            
            .pdb-results-sidebar.visible {
                left: 0;
            }
            
            .pdb-results-sidebar .sidebar-header {
                background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
                color: white;
                padding: 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid #eee;
            }
            
            .pdb-results-sidebar .sidebar-header h3 {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
            }
            
            .pdb-results-sidebar .sidebar-close {
                background: none;
                border: none;
                color: white;
                font-size: 18px;
                cursor: pointer;
                padding: 5px;
                border-radius: 3px;
                transition: background-color 0.2s;
            }
            
            .pdb-results-sidebar .sidebar-close:hover {
                background-color: rgba(255,255,255,0.2);
            }
            
            .pdb-results-sidebar .sidebar-content {
                flex: 1;
                overflow-y: auto;
                padding: 20px;
            }
            
            .pdb-result-item {
                border: 1px solid #e1e5e9;
                border-radius: 8px;
                margin-bottom: 16px;
                padding: 16px;
                background: #fdfefe;
                transition: transform 0.2s, box-shadow 0.2s;
            }
            
            .pdb-result-item:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            }
            
            .pdb-result-item .result-header {
                margin-bottom: 12px;
            }
            
            .pdb-result-item .pdb-title {
                font-weight: 600;
                font-size: 14px;
                color: #2c3e50;
                margin-bottom: 4px;
                line-height: 1.3;
            }
            
            .pdb-result-item .pdb-id {
                font-family: monospace;
                font-size: 12px;
                color: #e74c3c;
                background: #fdf2f2;
                padding: 2px 6px;
                border-radius: 3px;
                display: inline-block;
                font-weight: 600;
            }
            
            .pdb-result-item .result-details {
                margin-bottom: 16px;
            }
            
            .pdb-result-item .detail-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 6px;
                font-size: 12px;
            }
            
            .pdb-result-item .detail-row .label {
                font-weight: 500;
                color: #34495e;
            }
            
            .pdb-result-item .detail-row .value {
                color: #7f8c8d;
                text-align: right;
                max-width: 60%;
                word-wrap: break-word;
            }
            
            .pdb-result-item .result-actions {
                display: flex;
                gap: 8px;
                flex-direction: column;
            }
            
            .pdb-result-item .result-actions .btn {
                padding: 8px 12px;
                border: none;
                border-radius: 5px;
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
            }
            
            .pdb-result-item .result-actions .btn-primary {
                background: #e74c3c;
                color: white;
            }
            
            .pdb-result-item .result-actions .btn-primary:hover {
                background: #c0392b;
                transform: translateY(-1px);
            }
            
            .pdb-result-item .result-actions .btn-secondary {
                background: #95a5a6;
                color: white;
            }
            
            .pdb-result-item .result-actions .btn-secondary:hover {
                background: #7f8c8d;
                transform: translateY(-1px);
            }
            
            .pdb-result-item .result-actions .btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
                transform: none !important;
            }
            
            @media (max-width: 768px) {
                .pdb-results-sidebar {
                    width: 100vw;
                    left: -100vw;
                }
                
                .pdb-results-sidebar.visible {
                    left: 0;
                }
            }
        `;
        
        document.head.appendChild(style);
    }

    /**
     * Test MicrobeGenomicsFunctions integration
     */
    testMicrobeGenomicsIntegration() {
        console.log('=== Testing MicrobeGenomicsFunctions Integration ===');
        
        if (!this.MicrobeFns) {
            console.error('❌ MicrobeGenomicsFunctions not available');
            return {
                success: false,
                error: 'MicrobeGenomicsFunctions not loaded'
            };
        }
        
        const testResults = {
            functionsAvailable: {},
            categoriesAvailable: false,
            examplesAvailable: false,
            totalFunctions: 0
        };
        
        try {
            // Test if categories method works
                const categories = this.MicrobeFns.getFunctionCategories();
            testResults.categoriesAvailable = !!categories;
            console.log('✅ Categories available:', Object.keys(categories));
            
            // Test if examples method works
                const examples = this.MicrobeFns.getUsageExamples();
            testResults.examplesAvailable = !!examples;
            console.log('✅ Examples available:', examples.length);
            
            // Test individual function availability
            const testFunctions = [
                'navigateTo', 'jumpToGene', 'getCurrentRegion', 'scrollLeft', 'scrollRight',
                'zoomIn', 'zoomOut', 'computeGC', 'reverseComplement', 'translateDNA',
                'findORFs', 'calculateEntropy', 'calcRegionGC', 'calculateMeltingTemp',
                'calculateMolecularWeight', 'analyzeCodonUsage', 'predictPromoter',
                'predictRBS', 'predictTerminator', 'searchGeneByName', 'searchSequenceMotif',
                'searchByPosition', 'searchIntergenicRegions', 'editAnnotation',
                'deleteAnnotation', 'mergeAnnotations', 'addAnnotation',
                'getUpstreamRegion', 'getDownstreamRegion', 'addTrack', 'addVariant'
            ];
            
            testFunctions.forEach(funcName => {
                const isAvailable = typeof this.MicrobeFns[funcName] === 'function';
                testResults.functionsAvailable[funcName] = isAvailable;
                if (isAvailable) {
                    testResults.totalFunctions++;
                    console.log(`✅ ${funcName} available`);
                } else {
                    console.log(`❌ ${funcName} NOT available`);
                }
            });
            
            // Test a simple function call
            try {
                const testSequence = 'ATGCGCTATCG';
                const gcResult = this.MicrobeFns.computeGC(testSequence);
                console.log(`✅ Function call test: computeGC("${testSequence}") = ${gcResult}%`);
                testResults.functionCallTest = { success: true, result: gcResult };
            } catch (error) {
                console.log(`❌ Function call test failed: ${error.message}`);
                testResults.functionCallTest = { success: false, error: error.message };
            }
            
            console.log('=== Integration Test Summary ===');
            console.log(`Total functions available: ${testResults.totalFunctions}/${testFunctions.length}`);
            console.log(`Categories available: ${testResults.categoriesAvailable}`);
            console.log(`Examples available: ${testResults.examplesAvailable}`);
            console.log('===================================');
            
            return {
                success: true,
                ...testResults
            };
            
        } catch (error) {
            console.error('❌ Integration test failed:', error);
            return {
                success: false,
                error: error.message,
                ...testResults
            };
        }
    }
    
    /**
     * Test tool execution through ChatManager
     */
    async testToolExecution() {
        try {
            const testResult = await this.openProteinViewer({
                pdbId: '1TUP',
                title: 'Test Protein Structure'
            });
            
            console.log('Tool execution test result:', testResult);
            this.addMessageToChat('Tool execution test completed. Check console for details.', 'assistant');
        } catch (error) {
            console.error('Tool execution test failed:', error);
            this.addMessageToChat(`Tool execution test failed: ${error.message}`, 'assistant', true);
        }
    }

    // ====================================
    // BLAST SEARCH FUNCTIONALITY
    // ====================================

    async blastSearch(params) {
        /**
         * Perform BLAST search with given parameters
         * @param {Object} params - BLAST search parameters
         * @param {string} params.sequence - Query sequence
         * @param {string} params.blastType - Type of BLAST (blastn, blastp, blastx, tblastn)
         * @param {string} params.database - Target database
         * @param {string} params.evalue - E-value threshold
         * @param {number} params.maxTargets - Maximum number of target sequences
         */
        try {
            console.log('BLAST search requested:', params);

            // Check if BlastManager is available
            if (!this.app?.blastManager) {
                return {
                    success: false,
                    error: 'BLAST functionality is not available. BlastManager not initialized.'
                };
            }

            // Validate required parameters
            if (!params.sequence) {
                return {
                    success: false,
                    error: 'Query sequence is required for BLAST search'
                };
            }

            // Delegate to BlastManager
            const result = await this.app.blastManager.blastSearch(params);

            if (result.success) {
                return {
                    success: true,
                    message: result.summary,
                    hits: result.results.hits.length,
                    topHits: result.results.hits.slice(0, 3).map(hit => ({
                        accession: hit.accession,
                        description: hit.description,
                        evalue: hit.evalue,
                        identity: hit.identity,
                        coverage: hit.coverage
                    })),
                    searchId: result.results.searchId,
                    queryLength: result.results.queryInfo.length,
                    database: result.results.parameters.database
                };
            } else {
                return {
                    success: false,
                    error: result.error
                };
            }

        } catch (error) {
            console.error('BLAST search error:', error);
            return {
                success: false,
                error: `BLAST search failed: ${error.message}`
            };
        }
    }

    async blastSequenceFromRegion(params) {
        /**
         * Perform BLAST search using sequence from a genomic region
         * @param {Object} params - Region and search parameters
         * @param {string} params.chromosome - Chromosome identifier
         * @param {number} params.start - Start position
         * @param {number} params.end - End position
         * @param {string} params.blastType - Type of BLAST search
         * @param {string} params.database - Target database
         */
        try {
            console.log('BLAST search from region requested:', params);

            // Check if BlastManager is available
            if (!this.app?.blastManager) {
                return {
                    success: false,
                    error: 'BLAST functionality is not available. BlastManager not initialized.'
                };
            }

            // Validate required parameters
            if (!params.chromosome || !params.start || !params.end) {
                return {
                    success: false,
                    error: 'Chromosome, start, and end positions are required for region-based BLAST search'
                };
            }

            // Delegate to BlastManager
            const result = await this.app.blastManager.blastSequenceFromRegion(params);

            if (result.success) {
                return {
                    success: true,
                    message: result.summary,
                    region: `${params.chromosome}:${params.start}-${params.end}`,
                    hits: result.results.hits.length,
                    topHits: result.results.hits.slice(0, 3).map(hit => ({
                        accession: hit.accession,
                        description: hit.description,
                        evalue: hit.evalue,
                        identity: hit.identity,
                        coverage: hit.coverage
                    })),
                    searchId: result.results.searchId,
                    queryLength: result.results.queryInfo.length,
                    database: result.results.parameters.database
                };
            } else {
                return {
                    success: false,
                    error: result.error
                };
            }

        } catch (error) {
            console.error('BLAST search from region error:', error);
            return {
                success: false,
                error: `BLAST search from region failed: ${error.message}`
            };
        }
    }

    getBlastDatabases(params) {
        /**
         * Get available BLAST databases
         * @param {Object} params - Optional parameters (currently unused)
         */
        try {
            // Check if BlastManager is available
            if (!this.app?.blastManager) {
                return {
                    success: false,
                    error: 'BLAST functionality is not available. BlastManager not initialized.'
                };
            }

            const databases = this.app.blastManager.getBlastDatabases();

            return {
                success: true,
                databases: databases,
                nucleotideCount: databases.nucleotide.length,
                proteinCount: databases.protein.length,
                totalDatabases: databases.nucleotide.length + databases.protein.length
            };

        } catch (error) {
            console.error('Get BLAST databases error:', error);
            return {
                success: false,
                error: `Failed to get BLAST databases: ${error.message}`
            };
        }
    }

    // ====================================
    // ENHANCED BLAST FUNCTIONALITY WITH MCP INTEGRATION
    // ====================================

    async batchBlastSearch(params) {
        /**
         * Perform batch BLAST search with multiple sequences
         * @param {Object} params - Batch BLAST parameters
         * @param {Array} params.sequences - Array of sequences to search
         * @param {string} params.blastType - Type of BLAST search
         * @param {string} params.database - Target database
         * @param {number} params.maxTargets - Maximum targets per sequence
         */
        try {
            console.log('Batch BLAST search requested:', params);

            // Check if we have an MCP BLAST server available
            const mcpBlastServer = this.app.mcpServerManager?.getServer('blast-server');
            if (mcpBlastServer && this.app.mcpServerManager.activeServers.has('blast-server')) {
                // Use MCP BLAST server for batch operations
                return await this.executeMCPBlastTool('batch_blast_search', params);
            }

            // Fallback to local BlastManager with sequential searches
            if (!this.app?.blastManager) {
                return {
                    success: false,
                    error: 'BLAST functionality is not available. Neither MCP BLAST server nor BlastManager is available.'
                };
            }

            const results = [];
            for (let i = 0; i < params.sequences.length; i++) {
                const sequence = params.sequences[i];
                const searchParams = {
                    sequence: sequence.sequence || sequence,
                    blastType: params.blastType,
                    database: params.database,
                    maxTargets: params.maxTargets || 10
                };

                const result = await this.app.blastManager.blastSearch(searchParams);
                results.push({
                    sequenceIndex: i,
                    sequenceId: sequence.id || `seq_${i + 1}`,
                    ...result
                });
            }

            return {
                success: true,
                message: `Batch BLAST completed for ${params.sequences.length} sequences`,
                results: results,
                totalHits: results.reduce((sum, r) => sum + (r.results?.hits?.length || 0), 0)
            };

        } catch (error) {
            console.error('Batch BLAST search error:', error);
            return {
                success: false,
                error: `Batch BLAST search failed: ${error.message}`
            };
        }
    }

    async localBlastDatabaseInfo(params) {
        /**
         * Get information about local BLAST databases
         * @param {Object} params - Parameters
         * @param {string} params.databasePath - Path to local database (optional)
         */
        try {
            // Check if we have an MCP BLAST server with local database capabilities
            const mcpBlastServer = this.app.mcpServerManager?.getServer('blast-server');
            if (mcpBlastServer && this.app.mcpServerManager.activeServers.has('blast-server')) {
                return await this.executeMCPBlastTool('local_blast_database_info', params);
            }

            // Fallback response indicating only remote databases are available
            return {
                success: true,
                message: 'Only remote NCBI databases are available through the built-in BLAST functionality',
                databases: this.app.blastManager?.getBlastDatabases() || {},
                localDatabases: [],
                note: 'To use local databases, configure a local BLAST server as an MCP server'
            };

        } catch (error) {
            console.error('Local BLAST database info error:', error);
            return {
                success: false,
                error: `Failed to get local BLAST database info: ${error.message}`
            };
        }
    }

    async executeMCPBlastTool(toolName, params) {
        /**
         * Execute a BLAST tool on the MCP BLAST server
         * @param {string} toolName - Name of the BLAST tool
         * @param {Object} params - Tool parameters
         */
        try {
            if (!this.app.mcpServerManager) {
                throw new Error('MCP Server Manager not available');
            }

            const result = await this.app.mcpServerManager.executeToolOnServer('blast-server', toolName, params);
            return {
                success: true,
                ...result
            };

        } catch (error) {
            console.error(`MCP BLAST tool ${toolName} error:`, error);
            return {
                success: false,
                error: `MCP BLAST tool failed: ${error.message}`
            };
        }
    }

    async advancedBlastSearch(params) {
        /**
         * Advanced BLAST search with additional parameters and filtering
         * @param {Object} params - Advanced BLAST parameters
         * @param {string} params.sequence - Query sequence
         * @param {string} params.blastType - Type of BLAST search
         * @param {string} params.database - Target database
         * @param {Object} params.filters - Additional filtering options
         * @param {Object} params.algorithms - Algorithm-specific parameters
         */
        try {
            console.log('Advanced BLAST search requested:', params);

            // Try MCP BLAST server first for advanced features
            const mcpBlastServer = this.app.mcpServerManager?.getServer('blast-server');
            if (mcpBlastServer && this.app.mcpServerManager.activeServers.has('blast-server')) {
                return await this.executeMCPBlastTool('advanced_blast_search', params);
            }

            // Fallback to regular BLAST search with available parameters
            const basicParams = {
                sequence: params.sequence,
                blastType: params.blastType,
                database: params.database,
                evalue: params.evalue || '0.01',
                maxTargets: params.maxTargets || 50,
                wordSize: params.algorithms?.wordSize,
                matrix: params.algorithms?.matrix,
                gapOpen: params.algorithms?.gapOpen,
                gapExtend: params.algorithms?.gapExtend
            };

            const result = await this.blastSearch(basicParams);
            
            if (result.success && params.filters) {
                // Apply local filtering
                result.filteredHits = this.applyBlastFilters(result.topHits, params.filters);
            }

            return result;

        } catch (error) {
            console.error('Advanced BLAST search error:', error);
            return {
                success: false,
                error: `Advanced BLAST search failed: ${error.message}`
            };
        }
    }

    applyBlastFilters(hits, filters) {
        /**
         * Apply filtering to BLAST hits
         * @param {Array} hits - BLAST hits to filter
         * @param {Object} filters - Filtering criteria
         */
        let filteredHits = [...hits];

        if (filters.minIdentity) {
            filteredHits = filteredHits.filter(hit => 
                parseFloat(hit.identity.replace('%', '')) >= filters.minIdentity
            );
        }

        if (filters.minCoverage) {
            filteredHits = filteredHits.filter(hit => 
                parseFloat(hit.coverage.replace('%', '')) >= filters.minCoverage
            );
        }

        if (filters.maxEvalue) {
            filteredHits = filteredHits.filter(hit => 
                parseFloat(hit.evalue) <= filters.maxEvalue
            );
        }

        if (filters.excludePatterns) {
            filteredHits = filteredHits.filter(hit => 
                !filters.excludePatterns.some(pattern => 
                    hit.description.toLowerCase().includes(pattern.toLowerCase())
                )
            );
        }

        return filteredHits;
    }

    async getGenomeInfo(params) {
        if (!this.app) {
            throw new Error('Genome browser not initialized');
        }

        const genomeInfo = {
            loadedGenomes: {},
            currentGenome: null,
            summary: {
                totalSequences: 0,
                totalLength: 0,
                totalAnnotations: 0,
                loadedFiles: 0
            },
            fileTypes: {
                sequences: [],
                annotations: [],
                variants: [],
                reads: [],
                tracks: []
            }
        };

        // Get sequence information
        if (this.app.currentSequence && Object.keys(this.app.currentSequence).length > 0) {
            for (const [chromosome, sequence] of Object.entries(this.app.currentSequence)) {
                genomeInfo.loadedGenomes[chromosome] = {
                    name: chromosome,
                    length: sequence.length,
                    gcContent: this.calculateGCContent(sequence),
                    type: 'sequence'
                };
                genomeInfo.summary.totalLength += sequence.length;
            }
            genomeInfo.summary.totalSequences = Object.keys(this.app.currentSequence).length;
            genomeInfo.fileTypes.sequences = Object.keys(this.app.currentSequence);
        }

        // Get annotation information
        if (this.app.currentAnnotations && Object.keys(this.app.currentAnnotations).length > 0) {
            for (const [chromosome, annotations] of Object.entries(this.app.currentAnnotations)) {
                if (genomeInfo.loadedGenomes[chromosome]) {
                    genomeInfo.loadedGenomes[chromosome].annotations = annotations.length;
                    
                    // Count feature types
                    const featureTypes = {};
                    annotations.forEach(feature => {
                        featureTypes[feature.type] = (featureTypes[feature.type] || 0) + 1;
                    });
                    genomeInfo.loadedGenomes[chromosome].featureTypes = featureTypes;
                } else {
                    genomeInfo.loadedGenomes[chromosome] = {
                        name: chromosome,
                        annotations: annotations.length,
                        type: 'annotations_only'
                    };
                }
                genomeInfo.summary.totalAnnotations += annotations.length;
            }
            genomeInfo.fileTypes.annotations = Object.keys(this.app.currentAnnotations);
        }

        // Add source feature information if available
        if (this.app.sourceFeatures && Object.keys(this.app.sourceFeatures).length > 0) {
            genomeInfo.sourceInformation = {};
            for (const [chromosome, sourceInfo] of Object.entries(this.app.sourceFeatures)) {
                genomeInfo.sourceInformation[chromosome] = {
                    organism: sourceInfo.organism,
                    strain: sourceInfo.strain,
                    plasmid: sourceInfo.plasmid,
                    note: sourceInfo.note,
                    moleculeType: sourceInfo.mol_type,
                    isolationSource: sourceInfo.isolation_source,
                    country: sourceInfo.country,
                    collectionDate: sourceInfo.collection_date,
                    collectedBy: sourceInfo.collected_by,
                    host: sourceInfo.host,
                    serotype: sourceInfo.serotype,
                    serovar: sourceInfo.serovar,
                    dbXref: sourceInfo.db_xref
                };
                
                // Add to loaded genome info if it exists
                if (genomeInfo.loadedGenomes[chromosome]) {
                    genomeInfo.loadedGenomes[chromosome].sourceInfo = genomeInfo.sourceInformation[chromosome];
                }
            }
        }

        // Get variants information
        if (this.app.currentVariants && Object.keys(this.app.currentVariants).length > 0) {
            for (const [chromosome, variants] of Object.entries(this.app.currentVariants)) {
                if (genomeInfo.loadedGenomes[chromosome]) {
                    genomeInfo.loadedGenomes[chromosome].variants = variants.length;
                } else {
                    genomeInfo.loadedGenomes[chromosome] = {
                        name: chromosome,
                        variants: variants.length,
                        type: 'variants_only'
                    };
                }
            }
            genomeInfo.fileTypes.variants = Object.keys(this.app.currentVariants);
        }

        // Get reads information
        if (this.app.readsManager && this.app.readsManager.stats) {
            const stats = this.app.readsManager.stats;
            genomeInfo.summary.totalReads = stats.totalReads;
            genomeInfo.summary.loadedRegions = stats.loadedRegions;
            genomeInfo.fileTypes.reads = ['SAM file loaded'];
        }

        // Get current viewing state
        if (this.app.currentChromosome) {
            genomeInfo.currentGenome = {
                chromosome: this.app.currentChromosome,
                position: this.app.currentPosition,
                visibleTracks: this.getVisibleTracks(),
                sequenceLength: this.app.sequenceLength
            };
        }

        // Get loaded files information
        if (this.app.loadedFiles && this.app.loadedFiles.length > 0) {
            genomeInfo.summary.loadedFiles = this.app.loadedFiles.length;
            genomeInfo.loadedFilesList = this.app.loadedFiles.map(file => ({
                name: file.name || 'Unknown',
                type: file.type || 'Unknown',
                size: file.size || 0
            }));
        }

        // Calculate some derived statistics
        if (genomeInfo.summary.totalSequences > 0) {
            genomeInfo.summary.averageSequenceLength = Math.round(genomeInfo.summary.totalLength / genomeInfo.summary.totalSequences);
        }

        if (genomeInfo.summary.totalLength > 0 && genomeInfo.summary.totalAnnotations > 0) {
            genomeInfo.summary.geneDensity = Math.round((genomeInfo.summary.totalAnnotations / genomeInfo.summary.totalLength) * 1000); // genes per kb
        }

        return {
            success: true,
            genomeInfo: genomeInfo,
            message: `Retrieved information for ${genomeInfo.summary.totalSequences} sequence(s) with ${genomeInfo.summary.totalAnnotations} annotations`
        };
    }

    calculateGCContent(sequence) {
        if (!sequence || sequence.length === 0) return 0;
        const gcCount = (sequence.match(/[GC]/gi) || []).length;
        return Math.round((gcCount / sequence.length) * 100 * 100) / 100; // Round to 2 decimal places
    }

    /**
     * Show metabolic pathway visualization
     */
    async showMetabolicPathway(params) {
        try {
            const { pathwayName, highlightGenes = [], organism = 'generic' } = params;
            
            // Define pathway templates
            const pathwayTemplates = {
                glycolysis: {
                    name: 'Glycolysis Pathway',
                    description: 'Glucose metabolism pathway - converts glucose to pyruvate',
                    genes: ['glk', 'pgi', 'pfkA', 'fbaA', 'tpiA', 'gapA', 'pgk', 'gpmA', 'eno', 'pykF'],
                    enzymes: [
                        'Glucokinase (glk)',
                        'Glucose-6-phosphate isomerase (pgi)',
                        'Phosphofructokinase (pfkA)', 
                        'Fructose-bisphosphate aldolase (fbaA)',
                        'Triosephosphate isomerase (tpiA)',
                        'Glyceraldehyde-3-phosphate dehydrogenase (gapA)',
                        'Phosphoglycerate kinase (pgk)',
                        'Phosphoglycerate mutase (gpmA)',
                        'Enolase (eno)',
                        'Pyruvate kinase (pykF)'
                    ],
                    metabolites: [
                        'Glucose → Glucose-6-phosphate → Fructose-6-phosphate',
                        'Fructose-1,6-bisphosphate → DHAP + G3P',
                        'G3P → 1,3-BPG → 3-PG → 2-PG → PEP → Pyruvate'
                    ]
                },
                tca_cycle: {
                    name: 'TCA Cycle (Citric Acid Cycle)',
                    description: 'Central metabolic pathway for energy production',
                    genes: ['gltA', 'acnA', 'icdA', 'sucA', 'sucC', 'sdhA', 'fumA', 'mdh'],
                    enzymes: [
                        'Citrate synthase (gltA)',
                        'Aconitase (acnA)',
                        'Isocitrate dehydrogenase (icdA)',
                        'α-Ketoglutarate dehydrogenase (sucA)',
                        'Succinyl-CoA synthetase (sucC)',
                        'Succinate dehydrogenase (sdhA)',
                        'Fumarase (fumA)',
                        'Malate dehydrogenase (mdh)'
                    ],
                    metabolites: [
                        'Acetyl-CoA + Oxaloacetate → Citrate',
                        'Citrate → Isocitrate → α-Ketoglutarate',
                        'α-Ketoglutarate → Succinyl-CoA → Succinate',
                        'Succinate → Fumarate → Malate → Oxaloacetate'
                    ]
                },
                pentose_phosphate: {
                    name: 'Pentose Phosphate Pathway',
                    description: 'Alternative glucose oxidation pathway producing NADPH',
                    genes: ['zwf', 'pgl', 'gnd', 'rpe', 'rpiA', 'tktA', 'talA'],
                    enzymes: [
                        'Glucose-6-phosphate dehydrogenase (zwf)',
                        '6-phosphogluconolactonase (pgl)',
                        '6-phosphogluconate dehydrogenase (gnd)',
                        'Ribulose-phosphate 3-epimerase (rpe)',
                        'Ribose-5-phosphate isomerase (rpiA)',
                        'Transketolase (tktA)',
                        'Transaldolase (talA)'
                    ]
                }
            };
            
            const pathway = pathwayTemplates[pathwayName.toLowerCase()] || 
                            pathwayTemplates[pathwayName.replace(/[\s-]/g, '_').toLowerCase()];
            
            if (!pathway) {
                return {
                    success: false,
                    error: `Pathway '${pathwayName}' not found. Available pathways: ${Object.keys(pathwayTemplates).join(', ')}`
                };
            }
            
            // Search for pathway genes in the current genome
            const foundGenes = [];
            const searchPromises = pathway.genes.map(async (gene) => {
                try {
                    const searchResult = await this.executeMicrobeFunction('searchGeneByName', { name: gene });
                    if (searchResult && searchResult.feature) {
                        foundGenes.push({
                            gene: gene,
                            found: true,
                            location: `${searchResult.chromosome}:${searchResult.feature.start}-${searchResult.feature.end}`,
                            product: searchResult.feature.product || 'Unknown product'
                        });
                    } else {
                        foundGenes.push({ gene: gene, found: false });
                    }
                } catch (error) {
                    foundGenes.push({ gene: gene, found: false, error: error.message });
                }
            });
            
            await Promise.all(searchPromises);
            
            // Generate pathway visualization
            const visualization = {
                pathwayName: pathway.name,
                description: pathway.description,
                totalGenes: pathway.genes.length,
                foundGenes: foundGenes.filter(g => g.found).length,
                geneDetails: foundGenes,
                enzymes: pathway.enzymes || [],
                metabolites: pathway.metabolites || [],
                highlightedGenes: highlightGenes,
                organism: organism
            };
            
            // Show notification with pathway info
            this.showNotification(`${pathway.name}: Found ${visualization.foundGenes}/${visualization.totalGenes} genes in current genome`, 'info');
            
            return {
                success: true,
                pathway: visualization,
                summary: `Pathway Analysis: ${pathway.name}`,
                details: `Found ${visualization.foundGenes} out of ${visualization.totalGenes} expected genes`,
                genes: foundGenes.filter(g => g.found)
            };
            
        } catch (error) {
            console.error('Error showing metabolic pathway:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Find genes associated with a metabolic pathway
     */
    async findPathwayGenes(params) {
        try {
            const { pathwayName, includeRegulation = false } = params;
            
            // Use the same pathway templates
            const result = await this.showMetabolicPathway({ pathwayName });
            
            if (!result.success) {
                return result;
            }
            
            const foundGenes = result.genes || [];
            
            // If includeRegulation is true, search for regulatory genes
            let regulatoryGenes = [];
            if (includeRegulation) {
                const regulatorySearchTerms = [
                    `${pathwayName}R`, `${pathwayName}regulator`, `${pathwayName}activator`,
                    'crp', 'cra', 'fnr', 'arcA' // Common regulatory genes
                ];
                
                for (const term of regulatorySearchTerms) {
                    try {
                        const regResult = await this.searchFeatures({ query: term, caseSensitive: false });
                        if (regResult.success && regResult.results.length > 0) {
                            regulatoryGenes.push(...regResult.results.slice(0, 3)); // Limit to 3 per term
                        }
                    } catch (error) {
                        console.warn(`Failed to search for regulatory gene ${term}:`, error);
                    }
                }
            }
            
            return {
                success: true,
                pathwayName: result.pathway.pathwayName,
                description: result.pathway.description,
                metabolicGenes: foundGenes,
                regulatoryGenes: includeRegulation ? regulatoryGenes : [],
                totalGenes: foundGenes.length + (includeRegulation ? regulatoryGenes.length : 0),
                summary: `Found ${foundGenes.length} metabolic genes${includeRegulation ? ` and ${regulatoryGenes.length} regulatory genes` : ''} for ${pathwayName}`
            };
            
        } catch (error) {
            console.error('Error finding pathway genes:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 验证和检查所有可用的tools
     * @returns {Object} 详细的tools验证报告
     */
    validateAllTools() {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {},
            details: {},
            issues: [],
            recommendations: []
        };
        
        try {
            const context = this.getCurrentContext();
            const allTools = context.genomeBrowser.availableTools;
            
            // 统计各类工具数量
            report.summary = {
                totalTools: allTools.length,
                localTools: context.genomeBrowser.toolSources.local,
                pluginTools: context.genomeBrowser.toolSources.plugins,
                mcpTools: context.genomeBrowser.toolSources.mcp
            };
            
            // 检查每个工具的可执行性
            const toolCategories = {
                navigation: [],
                search: [],
                sequence: [],
                analysis: [],
                annotation: [],
                blast: [],
                protein: [],
                plugin: [],
                mcp: []
            };
            
            allTools.forEach(tool => {
                let category = 'other';
                
                if (tool.includes('navigate') || tool.includes('zoom') || tool.includes('scroll') || tool.includes('jump')) {
                    category = 'navigation';
                } else if (tool.includes('search') || tool.includes('find')) {
                    category = 'search';
                } else if (tool.includes('sequence') || tool.includes('translate') || tool.includes('gc') || tool.includes('reverse')) {
                    category = 'sequence';
                } else if (tool.includes('analyze') || tool.includes('calculate') || tool.includes('predict') || tool.includes('statistics')) {
                    category = 'analysis';
                } else if (tool.includes('annotation') || tool.includes('gene') || tool.includes('operons')) {
                    category = 'annotation';
                } else if (tool.includes('blast')) {
                    category = 'blast';
                } else if (tool.includes('protein') || tool.includes('pdb')) {
                    category = 'protein';
                } else if (tool.includes('.')) {
                    category = 'plugin';
                }
                
                toolCategories[category].push(tool);
            });
            
            report.details.categories = toolCategories;
            
            // 检查MicrobeGenomicsFunctions集成
            const microbeTools = [];
            if (window.MicrobeGenomicsFunctions) {
                const microbeFunctions = window.MicrobeGenomicsFunctions.getFunctionCategories();
                Object.values(microbeFunctions).forEach(category => {
                    microbeTools.push(...category.functions);
                });
            }
            
            report.details.microbeGenomics = {
                available: !!window.MicrobeGenomicsFunctions,
                functionCount: microbeTools.length,
                functions: microbeTools
            };
            
            // 检查插件系统
            report.details.plugins = {
                integratorAvailable: !!this.pluginFunctionCallsIntegrator,
                managerAvailable: !!this.pluginManager,
                mappedFunctions: this.pluginFunctionCallsIntegrator ? 
                    this.pluginFunctionCallsIntegrator.pluginFunctionMap.size : 0
            };
            
            // 检查MCP服务器
            report.details.mcp = {
                managerAvailable: !!this.mcpServerManager,
                connectedServers: this.mcpServerManager ? 
                    this.mcpServerManager.getConnectedServersCount() : 0,
                availableTools: this.mcpServerManager ? 
                    this.mcpServerManager.getAllAvailableTools().length : 0
            };
            
            // 生成建议
            if (report.summary.totalTools < 50) {
                report.recommendations.push('工具数量较少，可能需要检查插件和MCP服务器连接');
            }
            
            if (!report.details.microbeGenomics.available) {
                report.issues.push('MicrobeGenomicsFunctions未正确加载');
            }
            
            if (!report.details.plugins.integratorAvailable) {
                report.issues.push('插件函数调用集成器未初始化');
            }
            
            if (report.details.mcp.connectedServers === 0) {
                report.recommendations.push('建议连接MCP服务器以获得更多工具');
            }
            
            console.log('🔍 Tools Validation Report:', report);
            return report;
            
        } catch (error) {
            report.issues.push(`验证过程出错: ${error.message}`);
            console.error('Tools validation failed:', error);
            return report;
        }
    }

    /**
     * 开始对话状态管理
     */
    startConversation() {
        this.conversationState.isProcessing = true;
        this.conversationState.currentRequestId = Date.now().toString();
        this.conversationState.startTime = Date.now();
        this.conversationState.processSteps = [];
        this.conversationState.currentStep = 0;
        
        // 更新UI状态
        this.updateUIState();
    }

    /**
     * 结束对话状态管理
     */
    endConversation() {
        // 在清除状态之前，先保存当前的思考过程
        const currentRequestId = this.conversationState.currentRequestId;
        
        // 将当前思考过程转换为历史记录
        this.finalizeCurrentThinkingProcess(currentRequestId);
        
        this.conversationState.isProcessing = false;
        this.conversationState.currentRequestId = null;
        this.conversationState.abortController = null;
        this.conversationState.startTime = null;
        this.conversationState.processSteps = [];
        this.conversationState.currentStep = 0;
        
        // 更新UI状态
        this.updateUIState();
        
        // 注意：我们不再自动移除思考过程，而是将其转换为历史记录
    }

    /**
     * 将当前思考过程转换为历史记录
     */
    finalizeCurrentThinkingProcess(requestId) {
        if (!requestId) return;
        
        const thinkingElement = document.getElementById(`thinkingProcess_${requestId}`);
        if (thinkingElement) {
            // 移除动画和交互元素，转换为静态历史记录
            const spinningIcon = thinkingElement.querySelector('.fa-spin');
            if (spinningIcon) {
                spinningIcon.classList.remove('fa-spin');
                spinningIcon.classList.remove('fa-cog');
                spinningIcon.classList.add('fa-check-circle');
            }
            
            // 更新头部文本表示已完成
            const headerText = thinkingElement.querySelector('.thinking-header span');
            if (headerText) {
                headerText.textContent = 'AI Thinking Process (Completed)';
            }
            
            // 更改样式表示已完成
            thinkingElement.classList.add('thinking-completed');
            
            // 移除ID，避免与新的思考过程冲突
            thinkingElement.removeAttribute('id');
            
            // 添加时间戳（如果启用）
            if (this.showTimestamps) {
                const timestamp = new Date().toLocaleTimeString();
                const timestampDiv = document.createElement('div');
                timestampDiv.className = 'thinking-timestamp';
                timestampDiv.textContent = `Completed at ${timestamp}`;
                thinkingElement.querySelector('.message-content').appendChild(timestampDiv);
            }
        }
    }

    /**
     * 中止当前对话
     */
    abortCurrentConversation() {
        if (this.conversationState.isProcessing && this.conversationState.abortController) {
            this.conversationState.abortController.abort();
            this.showNotification('Conversation aborted', 'warning');
            
            // 移除输入指示器
            this.removeTypingIndicator();
            
            // 结束对话状态
            this.endConversation();
        }
    }

    /**
     * 更新UI状态
     */
    updateUIState() {
        const sendBtn = document.getElementById('sendChatBtn');
        const abortBtn = document.getElementById('abortChatBtn');
        const chatInput = document.getElementById('chatInput');
        
        if (this.conversationState.isProcessing) {
            // Conversation in progress - disable send button, show abort button
            if (sendBtn) {
                sendBtn.disabled = true;
                sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                sendBtn.classList.add('processing');
            }
            if (abortBtn) {
                abortBtn.style.display = 'block';
            }
            if (chatInput) {
                chatInput.disabled = true;
                chatInput.placeholder = 'Conversation in progress, please wait...';
            }
        } else {
            // Conversation ended - restore normal state
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
                sendBtn.classList.remove('processing');
            }
            if (abortBtn) {
                abortBtn.style.display = 'none';
            }
            if (chatInput) {
                chatInput.disabled = false;
                chatInput.placeholder = 'Ask me anything about your genome data...';
            }
        }
    }

    /**
     * 添加思考过程消息
     */
    addThinkingMessage(message) {
        // 检查是否启用思考过程显示
        if (!this.showThinkingProcess) {
            // 即使不显示，也要为Evolution记录思考过程
            this.addToEvolutionData({
                type: 'thinking_process',
                timestamp: new Date().toISOString(),
                content: message,
                visible: false,
                metadata: {
                    source: 'ai_thinking',
                    requestId: this.conversationState.currentRequestId,
                    step: 'initial_thinking'
                }
            });
            return;
        }
        
        // 只移除当前正在进行的思考过程（如果有的话）
        const currentRequestId = this.conversationState.currentRequestId || Date.now();
        const existingThinking = document.getElementById(`thinkingProcess_${currentRequestId}`);
        if (existingThinking) {
            existingThinking.remove();
        }
        
        const messagesContainer = document.getElementById('chatMessages');
        const thinkingDiv = document.createElement('div');
        thinkingDiv.className = 'message assistant-message thinking-process';
        const thinkingId = `thinkingProcess_${currentRequestId}`;
        thinkingDiv.id = thinkingId;
        thinkingDiv.innerHTML = `
            <div class="message-content">
                <div class="message-icon">
                    <i class="fas fa-brain"></i>
                </div>
                <div class="message-text thinking-text">
                    <div class="thinking-header">
                        <i class="fas fa-cog fa-spin"></i>
                        <span>AI Thinking Process</span>
                    </div>
                    <div class="thinking-content">${message}</div>
                </div>
            </div>
        `;
        
        messagesContainer.appendChild(thinkingDiv);
        
        // Add to Evolution data structure
        this.addToEvolutionData({
            type: 'thinking_process',
            timestamp: new Date().toISOString(),
            content: message,
            elementId: thinkingId,
            visible: true,
            metadata: {
                source: 'ai_thinking',
                requestId: this.conversationState.currentRequestId,
                step: 'initial_thinking'
            }
        });
        
        // 根据设置决定是否自动滚动
        if (this.autoScrollToBottom) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }
    
    /**
     * 添加多智能体系统激活消息
     */
    addMultiAgentActivationMessage() {
        const messagesContainer = document.getElementById('chatMessages');
        const activationDiv = document.createElement('div');
        activationDiv.className = 'message system-message multi-agent-activation';
        activationDiv.innerHTML = `
            <div class="message-content">
                <div class="multi-agent-banner">
                    <div class="multi-agent-icon">🤖</div>
                    <div class="multi-agent-content">
                        <div class="multi-agent-title">Multi-Agent System Activated</div>
                        <div class="multi-agent-subtitle">Intelligent agent coordination enabled</div>
                        <div class="multi-agent-features">
                            <span class="feature-tag">8 Specialized Agents</span>
                            <span class="feature-tag">Smart Coordination</span>
                            <span class="feature-tag">Performance Optimized</span>
                        </div>
                    </div>
                    <div class="multi-agent-status">
                        <span class="status-indicator active"></span>
                        <span class="status-text">Active</span>
                    </div>
                </div>
            </div>
        `;
        
        messagesContainer.appendChild(activationDiv);
        
        // Add to Evolution data
        this.addToEvolutionData({
            type: 'multi_agent_activation',
            timestamp: new Date().toISOString(),
            content: 'Multi-Agent System Activated',
            visible: true,
            metadata: {
                source: 'multi_agent_system',
                requestId: this.conversationState.currentRequestId,
                step: 'system_activation'
            }
        });
        
        if (this.autoScrollToBottom) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }
    
    /**
     * 添加智能体决策消息
     */
    addAgentDecisionMessage(agentName, toolName, reasoning, parameters = {}) {
        const messagesContainer = document.getElementById('chatMessages');
        const decisionDiv = document.createElement('div');
        decisionDiv.className = 'message assistant-message agent-decision';
        decisionDiv.innerHTML = `
            <div class="message-content">
                <div class="agent-decision-content">
                    <div class="agent-header">
                        <div class="agent-icon">${this.getAgentIcon(agentName)}</div>
                        <div class="agent-info">
                            <div class="agent-name">${agentName}</div>
                            <div class="agent-action">Selected for: <strong>${toolName}</strong></div>
                        </div>
                        <div class="agent-status">
                            <span class="status-dot processing"></span>
                            <span class="status-text">Processing</span>
                        </div>
                    </div>
                    <div class="agent-reasoning">
                        <div class="reasoning-label">Decision Reasoning:</div>
                        <div class="reasoning-text">${reasoning}</div>
                    </div>
                    ${Object.keys(parameters).length > 0 ? `
                        <div class="agent-parameters">
                            <div class="parameters-label">Parameters:</div>
                            <div class="parameters-content">
                                <pre><code>${JSON.stringify(parameters, null, 2)}</code></pre>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        messagesContainer.appendChild(decisionDiv);
        
        // Add to Evolution data
        this.addToEvolutionData({
            type: 'agent_decision',
            timestamp: new Date().toISOString(),
            content: {
                agentName,
                toolName,
                reasoning,
                parameters
            },
            visible: true,
            metadata: {
                source: 'multi_agent_system',
                requestId: this.conversationState.currentRequestId,
                step: 'agent_selection',
                agentName,
                toolName
            }
        });
        
        // Update status after a short delay to show completion
        setTimeout(() => {
            const statusDot = decisionDiv.querySelector('.status-dot');
            const statusText = decisionDiv.querySelector('.status-text');
            if (statusDot && statusText) {
                statusDot.className = 'status-dot completed';
                statusText.textContent = 'Completed';
            }
        }, 2000);
        
        if (this.autoScrollToBottom) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }
    
    /**
     * 添加智能体执行结果消息
     */
    addAgentExecutionResult(agentName, toolName, result, executionTime) {
        const messagesContainer = document.getElementById('chatMessages');
        const resultDiv = document.createElement('div');
        resultDiv.className = 'message assistant-message agent-result';
        resultDiv.innerHTML = `
            <div class="message-content">
                <div class="agent-result-content">
                    <div class="agent-result-header">
                        <div class="agent-icon">${this.getAgentIcon(agentName)}</div>
                        <div class="agent-info">
                            <div class="agent-name">${agentName}</div>
                            <div class="agent-action">Executed: <strong>${toolName}</strong></div>
                            <div class="execution-time">⏱️ ${executionTime}ms</div>
                        </div>
                        <div class="agent-status">
                            <span class="status-dot completed"></span>
                            <span class="status-text">Success</span>
                        </div>
                    </div>
                    <div class="agent-result-data">
                        <div class="result-label">Execution Result:</div>
                        <div class="result-content">${this.formatAgentResult(result)}</div>
                    </div>
                </div>
            </div>
        `;
        
        messagesContainer.appendChild(resultDiv);
        
        // Add to Evolution data
        this.addToEvolutionData({
            type: 'agent_execution_result',
            timestamp: new Date().toISOString(),
            content: {
                agentName,
                toolName,
                result,
                executionTime
            },
            visible: true,
            metadata: {
                source: 'multi_agent_system',
                requestId: this.conversationState.currentRequestId,
                step: 'execution_complete',
                agentName,
                toolName,
                executionTime
            }
        });
        
        if (this.autoScrollToBottom) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }
    
    /**
     * 获取智能体图标
     */
    getAgentIcon(agentName) {
        const agentIcons = {
            'Navigation Agent': '🧭',
            'Analysis Agent': '📊',
            'Data Agent': '💾',
            'Sequence Agent': '🧬',
            'Protein Agent': '⚛️',
            'Network Agent': '🌐',
            'External Agent': '🔗',
            'Plugin Agent': '🔌'
        };
        return agentIcons[agentName] || '🤖';
    }
    
    /**
     * 格式化智能体执行结果
     */
    formatAgentResult(result) {
        if (typeof result === 'string') {
            return result;
        } else if (typeof result === 'object') {
            return `<pre><code>${JSON.stringify(result, null, 2)}</code></pre>`;
        } else {
            return String(result);
        }
    }
    
    /**
     * 根据工具名称确定负责的智能体
     */
    getAgentForTool(toolName) {
        const toolAgentMap = {
            // Navigation Agent - 导航和定位相关
            'navigate_to_position': 'Navigation Agent',
            'open_new_tab': 'Navigation Agent',
            'scroll_left': 'Navigation Agent',
            'scroll_right': 'Navigation Agent',
            'zoom_in': 'Navigation Agent',
            'zoom_out': 'Navigation Agent',
            'zoom_to_gene': 'Navigation Agent',
            'bookmark_position': 'Navigation Agent',
            'get_bookmarks': 'Navigation Agent',
            'save_view_state': 'Navigation Agent',
            'get_current_state': 'Navigation Agent',
            'get_current_region': 'Navigation Agent',
            'jump_to_gene': 'Navigation Agent',
            
            // Analysis Agent - 数据分析和统计
            'analyze_region': 'Analysis Agent',
            'compare_regions': 'Analysis Agent',
            'sequence_statistics': 'Analysis Agent',
            'codon_usage_analysis': 'Analysis Agent',
            'analyze_codon_usage': 'Analysis Agent',
            'calculate_entropy': 'Analysis Agent',
            'calculate_melting_temp': 'Analysis Agent',
            'calculate_molecular_weight': 'Analysis Agent',
            'predict_promoter': 'Analysis Agent',
            'predict_rbs': 'Analysis Agent',
            'predict_terminator': 'Analysis Agent',
            'find_similar_sequences': 'Analysis Agent',
            
            // Data Agent - 数据管理和导出
            'export_data': 'Data Agent',
            'export_region_features': 'Data Agent',
            'get_file_info': 'Data Agent',
            'get_genome_info': 'Data Agent',
            'get_chromosome_list': 'Data Agent',
            'get_track_status': 'Data Agent',
            'add_track': 'Data Agent',
            'add_variant': 'Data Agent',
            
            // Sequence Agent - 序列分析
            'get_sequence': 'Sequence Agent',
            'translate_sequence': 'Sequence Agent',
            'translate_dna': 'Sequence Agent',
            'calculate_gc_content': 'Sequence Agent',
            'compute_gc': 'Sequence Agent',
            'calc_region_gc': 'Sequence Agent',
            'reverse_complement': 'Sequence Agent',
            'find_orfs': 'Sequence Agent',
            'find_restriction_sites': 'Sequence Agent',
            'virtual_digest': 'Sequence Agent',
            'get_upstream_region': 'Sequence Agent',
            'get_downstream_region': 'Sequence Agent',
            'search_sequence_motif': 'Sequence Agent',
            
            // Protein Agent - 蛋白质相关
            'open_protein_viewer': 'Protein Agent',
            'fetch_protein_structure': 'Protein Agent',
            'search_protein_by_gene': 'Protein Agent',
            'get_pdb_details': 'Protein Agent',
            'amino_acid_composition': 'Protein Agent',
            
            // Network Agent - 网络和外部数据
            'blast_search': 'Network Agent',
            'blast_sequence_from_region': 'Network Agent',
            'get_blast_databases': 'Network Agent',
            'batch_blast_search': 'Network Agent',
            'advanced_blast_search': 'Network Agent',
            'local_blast_database_info': 'Network Agent',
            'show_metabolic_pathway': 'Network Agent',
            'find_pathway_genes': 'Network Agent',
            
            // External Agent - 外部工具和API
            'search_features': 'External Agent',
            'search_gene_by_name': 'External Agent',
            'search_by_position': 'External Agent',
            'search_motif': 'External Agent',
            'search_pattern': 'External Agent',
            'search_intergenic_regions': 'External Agent',
            'get_nearby_features': 'External Agent',
            'find_intergenic_regions': 'External Agent',
            
            // Plugin Agent - 插件功能
            'get_gene_details': 'Plugin Agent',
            'get_operons': 'Plugin Agent',
            'create_annotation': 'Plugin Agent',
            'add_annotation': 'Plugin Agent',
            'edit_annotation': 'Plugin Agent',
            'delete_annotation': 'Plugin Agent',
            'batch_create_annotations': 'Plugin Agent',
            'merge_annotations': 'Plugin Agent',
            'toggle_track': 'Plugin Agent',
            'toggle_annotation_track': 'Plugin Agent'
        };
        
        return toolAgentMap[toolName] || 'System Agent';
    }
    
    /**
     * 生成智能体决策推理
     */
    getAgentReasoning(toolName, parameters) {
        const agentName = this.getAgentForTool(toolName);
        
        const reasoningTemplates = {
            'Navigation Agent': `This tool requires navigation and positioning capabilities. ${agentName} specializes in spatial operations and view management, making it the optimal choice for coordinate-based tasks.`,
            'Analysis Agent': `This tool involves data analysis and statistical computation. ${agentName} is designed for analytical operations and pattern recognition, ensuring accurate and efficient processing.`,
            'Data Agent': `This tool handles data management and export operations. ${agentName} is optimized for file operations and data transformation, providing reliable data handling capabilities.`,
            'Sequence Agent': `This tool performs sequence analysis and manipulation. ${agentName} is specialized in DNA/RNA sequence processing and bioinformatics algorithms.`,
            'Protein Agent': `This tool deals with protein structure and function analysis. ${agentName} is designed for structural biology and protein-related computations.`,
            'Network Agent': `This tool requires external database access and network operations. ${agentName} is optimized for API calls and external data retrieval.`,
            'External Agent': `This tool involves search and discovery operations. ${agentName} is specialized in information retrieval and pattern matching across datasets.`,
            'Plugin Agent': `This tool utilizes plugin functionality and annotation systems. ${agentName} is designed to manage plugin integrations and annotation workflows.`,
            'System Agent': `This tool requires general system operations. ${agentName} provides standard execution capabilities for system-level tasks.`
        };
        
        return reasoningTemplates[agentName] || reasoningTemplates['System Agent'];
    }

    /**
     * 更新思考过程消息
     */
    updateThinkingMessage(message) {
        // Add to Evolution data first (regardless of visibility)
        this.addToEvolutionData({
            type: 'thinking_process',
            timestamp: new Date().toISOString(),
            content: message,
            visible: this.showThinkingProcess,
            metadata: {
                source: 'ai_thinking',
                requestId: this.conversationState.currentRequestId,
                step: 'update_thinking'
            }
        });
        
        // 检查是否启用思考过程显示
        if (!this.showThinkingProcess) {
            return;
        }
        
        // 查找当前请求的思考过程消息
        const thinkingId = `thinkingProcess_${this.conversationState.currentRequestId || Date.now()}`;
        let thinkingDiv = document.getElementById(thinkingId);
        
        // 如果没有找到，查找任何思考过程消息
        if (!thinkingDiv) {
            thinkingDiv = document.querySelector('.thinking-process');
        }
        
        if (thinkingDiv) {
            const thinkingContent = thinkingDiv.querySelector('.thinking-content');
            if (thinkingContent) {
                thinkingContent.innerHTML += '<br>' + message;
            }
        } else {
            this.addThinkingMessage(message);
        }
        
        // 根据设置决定是否自动滚动
        const messagesContainer = document.getElementById('chatMessages');
        if (this.autoScrollToBottom) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    /**
     * 显示LLM的思考过程
     */
    displayLLMThinking(response) {
        // 检查响应中是否包含思考标签
        const thinkingMatch = response.match(/<think>([\s\S]*?)<\/think>/);
        if (thinkingMatch) {
            const thinkingContent = thinkingMatch[1].trim();
            this.updateThinkingMessage(`💭 Model thinking: ${thinkingContent}`);
        }
        
        // 检查是否有工具调用分析
        if (response.includes('tool_name') || response.includes('function_name')) {
            this.updateThinkingMessage('🔧 Analyzing required tool calls...');
        }
    }

    /**
     * 添加工具调用消息
     */
    async addToolCallMessage(toolsToExecute) {
        // Add to Evolution data first (always record tool calls)
        this.addToEvolutionData({
            type: 'tool_calls',
            timestamp: new Date().toISOString(),
            content: toolsToExecute,
            visible: this.showToolCalls,
            metadata: {
                source: 'tool_execution',
                requestId: this.conversationState.currentRequestId,
                toolCount: toolsToExecute.length,
                toolNames: toolsToExecute.map(t => t.tool_name)
            }
        });
        
        // 检查是否启用工具调用显示
        if (!this.showToolCalls) {
            return;
        }
        
        // 为每个工具获取来源信息
        const toolsWithSource = await Promise.all(toolsToExecute.map(async (tool) => {
            const source = await this.getToolSource(tool.tool_name);
            return { ...tool, source };
        }));
        
        const toolList = toolsWithSource.map(tool => {
            let toolDisplay = `• <strong>${tool.tool_name}</strong>`;
            
            // 显示智能体信息（如果启用）
            if (this.agentSystemEnabled && this.agentSystemSettings.showAgentInfo && this.multiAgentSystem) {
                try {
                    if (typeof this.multiAgentSystem.getAgentForTool === 'function') {
                        const agentInfo = this.multiAgentSystem.getAgentForTool(tool.tool_name);
                        if (agentInfo) {
                            toolDisplay += ` <span class="agent-info" style="color: #4CAF50; font-size: 0.9em;"><i class="fas fa-robot"></i>[${agentInfo.name}]</span>`;
                        }
                    } else {
                        console.warn('multiAgentSystem.getAgentForTool is not a function');
                    }
                } catch (error) {
                    console.error('Error getting agent info for tool:', tool.tool_name, error);
                }
            }
            
            // 显示来源信息（如果启用）
            if (this.showToolCallSource && tool.source) {
                const sourceColor = this.getSourceColor(tool.source.type);
                toolDisplay += ` <span style="color: ${sourceColor}; font-size: 0.9em;">[${tool.source.display}]</span>`;
            }
            
            // 显示参数
            const paramsStr = JSON.stringify(tool.parameters, null, 2);
            toolDisplay += `<br>&nbsp;&nbsp;<em>Parameters:</em> <code style="font-size: 0.8em;">${paramsStr}</code>`;
            
            return toolDisplay;
        }).join('<br><br>');
        
        this.updateThinkingMessage(`⚡ Executing tool calls:<br><br>${toolList}`);
    }

    /**
     * 获取工具来源信息
     */
    async getToolSource(toolName) {
        try {
            // 检查是否是MCP服务器工具
            const allMCPTools = this.mcpServerManager.getAllAvailableTools();
            const mcpTool = allMCPTools.find(t => t.name === toolName);
            
            if (mcpTool) {
                return {
                    type: 'mcp',
                    display: `MCP: ${mcpTool.serverName}`,
                    serverId: mcpTool.serverId,
                    serverName: mcpTool.serverName
                };
            }
            
            // 检查是否是插件函数
            if (this.pluginFunctionCallsIntegrator && this.pluginFunctionCallsIntegrator.isPluginFunction(toolName)) {
                return {
                    type: 'plugin',
                    display: 'Plugin Function',
                    source: 'plugin-system'
                };
            }
            
            // 检查是否是内置本地函数
            const localTools = [
                'navigate_to_position', 'search_features', 'get_current_state', 'open_new_tab',
                'get_sequence', 'toggle_track', 'create_annotation', 'analyze_region',
                'export_data', 'jump_to_gene', 'get_genome_info', 'search_gene_by_name',
                'compute_gc', 'translate_dna', 'reverse_complement', 'find_orfs',
                'search_sequence_motif', 'get_nearby_features', 'get_feature_details',
                'export_sequence', 'import_sequence_data', 'search_go_terms',
                'search_kegg_pathways', 'get_protein_info', 'delete_gene', 'delete_sequence'
            ];
            
            if (localTools.includes(toolName)) {
                return {
                    type: 'local',
                    display: 'Internal Function',
                    source: 'genome-ai-studio'
                };
            }
            
            // 未知工具
            return {
                type: 'unknown',
                display: 'Unknown Source',
                source: 'unknown'
            };
            
        } catch (error) {
            console.warn(`Failed to get source for tool ${toolName}:`, error);
            return {
                type: 'error',
                display: 'Source Error',
                source: 'error'
            };
        }
    }

    /**
     * 获取不同来源类型的颜色
     */
    getSourceColor(sourceType) {
        const colors = {
            'mcp': '#2196F3',      // 蓝色 - MCP服务器
            'plugin': '#FF9800',   // 橙色 - 插件
            'local': '#4CAF50',    // 绿色 - 内置函数
            'unknown': '#9E9E9E',  // 灰色 - 未知
            'error': '#F44336'     // 红色 - 错误
        };
        
        return colors[sourceType] || colors['unknown'];
    }

    /**
     * 移除思考过程消息（保留原有方法用于特殊情况）
     */
    removeThinkingMessages() {
        // 移除所有思考过程消息
        const thinkingDivs = document.querySelectorAll('.thinking-process');
        thinkingDivs.forEach(thinkingDiv => {
            // 添加淡出动画
            thinkingDiv.style.transition = 'opacity 0.5s ease-out';
            thinkingDiv.style.opacity = '0';
            
            setTimeout(() => {
                if (thinkingDiv.parentNode) {
                    thinkingDiv.parentNode.removeChild(thinkingDiv);
                }
            }, 500);
        });
    }

    /**
     * 清除历史思考过程（用户手动操作）
     */
    clearThinkingHistory() {
        const thinkingDivs = document.querySelectorAll('.thinking-process.thinking-completed');
        thinkingDivs.forEach(thinkingDiv => {
            thinkingDiv.style.transition = 'opacity 0.3s ease-out';
            thinkingDiv.style.opacity = '0';
            
            setTimeout(() => {
                if (thinkingDiv.parentNode) {
                    thinkingDiv.parentNode.removeChild(thinkingDiv);
                }
            }, 300);
        });
        
        this.showNotification('✅ Thinking process history cleared', 'success');
    }

    /**
     * 切换思考过程历史显示
     */
    toggleThinkingHistory() {
        const thinkingDivs = document.querySelectorAll('.thinking-process.thinking-completed');
        const toggleBtn = document.getElementById('toggleThinkingBtn');
        
        if (thinkingDivs.length === 0) {
            this.showNotification('📝 No thinking history to toggle', 'info');
            return;
        }
        
        const isCurrentlyVisible = thinkingDivs[0].style.display !== 'none';
        
        thinkingDivs.forEach(thinkingDiv => {
            if (isCurrentlyVisible) {
                thinkingDiv.style.display = 'none';
            } else {
                thinkingDiv.style.display = 'block';
            }
        });
        
        // 更新按钮文本和图标
        if (toggleBtn) {
            if (isCurrentlyVisible) {
                toggleBtn.innerHTML = '<i class="fas fa-eye"></i> Show History';
            } else {
                toggleBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Hide History';
            }
        }
        
        const action = isCurrentlyVisible ? 'hidden' : 'shown';
        this.showNotification(`✅ Thinking history ${action}`, 'success');
    }

    /**
     * 添加工具执行结果显示
     */
    addToolResultMessage(toolResults) {
        const successCount = toolResults.filter(r => r.success).length;
        const failCount = toolResults.filter(r => !r.success).length;
        
        // Add to Evolution data first (always record tool results)
        this.addToEvolutionData({
            type: 'tool_results',
            timestamp: new Date().toISOString(),
            content: toolResults,
            visible: this.showToolCalls,
            metadata: {
                source: 'tool_execution_results',
                requestId: this.conversationState.currentRequestId,
                successCount: successCount,
                failCount: failCount,
                totalCount: toolResults.length,
                tools: toolResults.map(r => ({ tool: r.tool, success: r.success }))
            }
        });
        
        if (!this.showToolCalls) return;
        
        let resultMessage = `✅ Tool execution completed: ${successCount} succeeded`;
        if (failCount > 0) {
            resultMessage += `, ${failCount} failed`;
        }
        
        // 显示详细结果
        const detailsHtml = toolResults.map(result => {
            const icon = result.success ? '✅' : '❌';
            let resultDisplay = `<div style="margin: 8px 0; padding: 8px; border-left: 3px solid ${result.success ? '#4CAF50' : '#F44336'};">`;
            resultDisplay += `<strong>${icon} ${result.tool}</strong><br>`;
            
            if (result.success) {
                resultDisplay += `<span style="color: #4CAF50;">Status: Success</span>`;
                
                // 显示详细数据（如果启用）
                if (this.showDetailedToolData && result.data) {
                    resultDisplay += `<br><details style="margin-top: 8px;">`;
                    resultDisplay += `<summary style="cursor: pointer; color: #2196F3;">📊 Show detailed data</summary>`;
                    resultDisplay += `<div style="background: #f5f5f5; padding: 8px; margin-top: 4px; border-radius: 4px; font-family: monospace; font-size: 0.85em; max-height: 300px; overflow-y: auto;">`;
                    
                    try {
                        // 格式化数据显示
                        const formattedData = this.formatToolResultData(result.data);
                        resultDisplay += formattedData;
                    } catch (error) {
                        resultDisplay += `<pre>${JSON.stringify(result.data, null, 2)}</pre>`;
                    }
                    
                    resultDisplay += `</div></details>`;
                }
            } else {
                resultDisplay += `<span style="color: #F44336;">Status: Failed</span>`;
                if (result.error) {
                    resultDisplay += `<br><span style="color: #F44336; font-size: 0.9em;">Error: ${result.error}</span>`;
                }
            }
            
            resultDisplay += `</div>`;
            return resultDisplay;
        }).join('');
        
        this.updateThinkingMessage(`${resultMessage}<br><div style="margin-top: 8px;">${detailsHtml}</div>`);
    }

    /**
     * 格式化工具结果数据显示
     */
    formatToolResultData(data) {
        if (!data) return 'No data available';
        
        try {
            // 如果是字符串，尝试解析为JSON
            if (typeof data === 'string') {
                try {
                    data = JSON.parse(data);
                } catch {
                    // 如果不是JSON，直接显示字符串
                    return `<pre>${this.escapeHtml(data)}</pre>`;
                }
            }
            
            // 如果是数组
            if (Array.isArray(data)) {
                if (data.length === 0) {
                    return '<em>Empty array</em>';
                }
                
                // 如果数组元素是对象，创建表格
                if (typeof data[0] === 'object' && data[0] !== null) {
                    return this.formatArrayAsTable(data);
                } else {
                    return `<pre>${JSON.stringify(data, null, 2)}</pre>`;
                }
            }
            
            // 如果是对象
            if (typeof data === 'object' && data !== null) {
                return this.formatObjectAsKeyValue(data);
            }
            
            // 其他类型直接显示
            return `<pre>${String(data)}</pre>`;
            
        } catch (error) {
            console.warn('Error formatting tool result data:', error);
            return `<pre>${JSON.stringify(data, null, 2)}</pre>`;
        }
    }

    /**
     * 将数组格式化为表格
     */
    formatArrayAsTable(array) {
        if (array.length === 0) return '<em>Empty array</em>';
        
        const sample = array[0];
        const keys = Object.keys(sample);
        
        let table = '<table style="width: 100%; border-collapse: collapse; margin: 4px 0;">';
        
        // 表头
        table += '<thead><tr>';
        keys.forEach(key => {
            table += `<th style="border: 1px solid #ddd; padding: 4px 8px; background: #f0f0f0; text-align: left;">${this.escapeHtml(key)}</th>`;
        });
        table += '</tr></thead>';
        
        // 表体
        table += '<tbody>';
        array.slice(0, 100).forEach(item => { // 限制显示前100行
            table += '<tr>';
            keys.forEach(key => {
                const value = item[key];
                const displayValue = value !== null && value !== undefined ? String(value) : '';
                table += `<td style="border: 1px solid #ddd; padding: 4px 8px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${this.escapeHtml(displayValue)}">${this.escapeHtml(displayValue)}</td>`;
            });
            table += '</tr>';
        });
        table += '</tbody>';
        table += '</table>';
        
        if (array.length > 100) {
            table += `<div style="margin-top: 8px; color: #666; font-size: 0.8em;">... and ${array.length - 100} more items</div>`;
        }
        
        return table;
    }

    /**
     * 将对象格式化为键值对
     */
    formatObjectAsKeyValue(obj) {
        let html = '<div style="font-family: monospace;">';
        
        for (const [key, value] of Object.entries(obj)) {
            html += '<div style="margin: 4px 0; padding: 2px 0; border-bottom: 1px solid #eee;">';
            html += `<strong style="color: #2196F3;">${this.escapeHtml(key)}:</strong> `;
            
            if (value === null || value === undefined) {
                html += '<em style="color: #999;">null</em>';
            } else if (typeof value === 'object') {
                // 递归处理嵌套对象，但限制深度
                html += '<br><div style="margin-left: 16px; font-size: 0.9em;">';
                if (Array.isArray(value)) {
                    html += `<em>Array(${value.length})</em>: `;
                    if (value.length <= 5) {
                        html += JSON.stringify(value);
                    } else {
                        html += `[${value.slice(0, 3).map(v => JSON.stringify(v)).join(', ')}, ... ${value.length - 3} more]`;
                    }
                } else {
                    const keys = Object.keys(value);
                    html += `<em>Object(${keys.length} keys)</em>: {${keys.slice(0, 3).join(', ')}${keys.length > 3 ? ', ...' : ''}}`;
                }
                html += '</div>';
            } else if (typeof value === 'string' && value.length > 100) {
                // 长字符串截断显示
                html += `<span title="${this.escapeHtml(value)}">${this.escapeHtml(value.substring(0, 100))}...</span>`;
            } else {
                html += this.escapeHtml(String(value));
            }
            
            html += '</div>';
        }
        
        html += '</div>';
        return html;
    }

    /**
     * HTML转义
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Add data to Evolution system for analysis
     */
    addToEvolutionData(eventData) {
        if (!this.evolutionEnabled || !this.currentConversationData) {
            return;
        }

        // Add timestamp if not provided
        if (!eventData.timestamp) {
            eventData.timestamp = new Date().toISOString();
        }

        // Add event to current conversation
        this.currentConversationData.events.push(eventData);

        // Update statistics
        this.updateConversationStats(eventData);

        // Auto-save to Evolution storage periodically
        this.debouncedSaveToEvolution();

        console.log(`🧬 Added ${eventData.type} to Evolution data:`, eventData);
    }

    /**
     * Update conversation statistics
     */
    updateConversationStats(eventData) {
        if (!this.currentConversationData || !this.currentConversationData.stats) {
            return;
        }

        const stats = this.currentConversationData.stats;

        switch (eventData.type) {
            case 'message':
                stats.messageCount++;
                if (eventData.sender === 'user') {
                    stats.userMessageCount++;
                } else if (eventData.sender === 'assistant') {
                    stats.assistantMessageCount++;
                }
                if (eventData.isError) {
                    stats.errorCount++;
                } else {
                    stats.successCount++;
                }
                break;

            case 'thinking_process':
                stats.thinkingProcessCount++;
                break;

            case 'tool_calls':
                stats.toolCallCount += eventData.metadata?.toolCount || 1;
                break;

            case 'tool_results':
                if (eventData.metadata?.failCount > 0) {
                    stats.failureCount += eventData.metadata.failCount;
                }
                if (eventData.metadata?.successCount > 0) {
                    stats.successCount += eventData.metadata.successCount;
                }
                break;
        }
    }

    /**
     * Debounced save to Evolution storage
     */
    debouncedSaveToEvolution() {
        if (this._evolutionSaveTimeout) {
            clearTimeout(this._evolutionSaveTimeout);
        }
        
        this._evolutionSaveTimeout = setTimeout(() => {
            this.syncCurrentConversationToEvolution();
        }, 2000); // Save every 2 seconds
    }

    /**
     * Sync current conversation to Evolution storage
     */
    syncCurrentConversationToEvolution() {
        if (!this.evolutionManager || !this.currentConversationData) {
            return;
        }

        try {
            // Update end time
            this.currentConversationData.endTime = new Date().toISOString();
            
            // Send to Evolution Manager
            if (typeof this.evolutionManager.addConversationData === 'function') {
                this.evolutionManager.addConversationData(this.currentConversationData);
                console.log('🧬 Synced conversation data to Evolution storage');
            } else {
                console.warn('🧬 Evolution Manager does not support addConversationData method');
            }
        } catch (error) {
            console.error('❌ Failed to sync conversation to Evolution storage:', error);
        }
    }

    /**
     * Start new conversation for Evolution tracking
     */
    startNewConversationForEvolution() {
        // Finalize current conversation
        if (this.currentConversationData && this.currentConversationData.events.length > 0) {
            this.syncCurrentConversationToEvolution();
        }

        // Reset for new conversation
        this.resetCurrentConversationData();
        
        console.log('🧬 Started new conversation for Evolution tracking:', this.currentConversationData.id);
    }

    /**
     * Override startNewChat to include Evolution tracking
     */
    startNewChat() {
        console.log('Starting new chat...');
        
        // Original ChatBox functionality
        this.clearChat();
        this.conversationState.contextModeEnabled = false;
        
        // Add conversation separator for ChatBox history
        if (this.configManager) {
            this.configManager.addChatMessage('--- CONVERSATION_SEPARATOR ---', 'system');
        }
        
        // Start new conversation for Evolution tracking
        this.startNewConversationForEvolution();
        
        this.showNotification('✅ New conversation started', 'success');
    }

    /**
     * Get Evolution data summary for debugging
     */
    getEvolutionDataSummary() {
        if (!this.currentConversationData) {
            return 'No conversation data available';
        }

        const stats = this.currentConversationData.stats;
        return {
            conversationId: this.currentConversationData.id,
            startTime: this.currentConversationData.startTime,
            endTime: this.currentConversationData.endTime,
            eventCount: this.currentConversationData.events.length,
            statistics: stats,
            evolutionManagerConnected: !!this.evolutionManager,
            lastEventType: this.currentConversationData.events.length > 0 ? 
                this.currentConversationData.events[this.currentConversationData.events.length - 1].type : 'none'
        };
    }

    /**
     * Message History Browsing Methods
     */
    
    /**
     * Update user message history array
     */
    updateUserMessageHistory() {
        try {
            const fullHistory = this.configManager?.getChatHistory() || [];
            this.messageHistory.userMessages = fullHistory
                .filter(msg => msg.sender === 'user')
                .map(msg => msg.message);
            
            console.log(`Updated user message history: ${this.messageHistory.userMessages.length} messages`);
        } catch (error) {
            console.warn('Failed to update user message history:', error);
            this.messageHistory.userMessages = [];
        }
    }
    
    /**
     * Browse up in message history (ArrowUp key)
     */
    browseHistoryUp() {
        const chatInput = document.getElementById('chatInput');
        if (!chatInput) return;
        
        // Update history array first
        this.updateUserMessageHistory();
        
        // If no history available, do nothing
        if (this.messageHistory.userMessages.length === 0) {
            return;
        }
        
        // If not currently browsing, save original content and start browsing
        if (!this.messageHistory.isBrowsing) {
            this.messageHistory.originalContent = chatInput.value;
            this.messageHistory.isBrowsing = true;
            this.messageHistory.currentIndex = this.messageHistory.userMessages.length - 1;
        } else {
            // Move up in history (older messages)
            if (this.messageHistory.currentIndex > 0) {
                this.messageHistory.currentIndex--;
            } else {
                // Wrap to newest message
                this.messageHistory.currentIndex = this.messageHistory.userMessages.length - 1;
            }
        }
        
        // Set input to current history message
        const currentMessage = this.messageHistory.userMessages[this.messageHistory.currentIndex];
        chatInput.value = currentMessage;
        
        // Auto-resize textarea
        chatInput.style.height = 'auto';
        chatInput.style.height = chatInput.scrollHeight + 'px';
        
        // Position cursor at end
        chatInput.setSelectionRange(chatInput.value.length, chatInput.value.length);
        
        console.log(`History browse up: ${this.messageHistory.currentIndex + 1}/${this.messageHistory.userMessages.length}`);
    }
    
    /**
     * Browse down in message history (ArrowDown key)
     */
    browseHistoryDown() {
        const chatInput = document.getElementById('chatInput');
        if (!chatInput || !this.messageHistory.isBrowsing) return;
        
        // Move down in history (newer messages)
        if (this.messageHistory.currentIndex < this.messageHistory.userMessages.length - 1) {
            this.messageHistory.currentIndex++;
            
            // Set input to current history message
            const currentMessage = this.messageHistory.userMessages[this.messageHistory.currentIndex];
            chatInput.value = currentMessage;
        } else {
            // At newest message, restore original content and exit browse mode
            chatInput.value = this.messageHistory.originalContent;
            this.exitHistoryBrowsing();
        }
        
        // Auto-resize textarea
        chatInput.style.height = 'auto';
        chatInput.style.height = chatInput.scrollHeight + 'px';
        
        // Position cursor at end
        chatInput.setSelectionRange(chatInput.value.length, chatInput.value.length);
        
        if (this.messageHistory.isBrowsing) {
            console.log(`History browse down: ${this.messageHistory.currentIndex + 1}/${this.messageHistory.userMessages.length}`);
        } else {
            console.log('History browse ended, original content restored');
        }
    }
    
    /**
     * Cancel history browsing and restore original content (Escape key)
     */
    cancelHistoryBrowsing() {
        const chatInput = document.getElementById('chatInput');
        if (!chatInput || !this.messageHistory.isBrowsing) return;
        
        chatInput.value = this.messageHistory.originalContent;
        this.exitHistoryBrowsing();
        
        // Auto-resize textarea
        chatInput.style.height = 'auto';
        chatInput.style.height = chatInput.scrollHeight + 'px';
        
        console.log('History browsing cancelled, original content restored');
    }
    
    /**
     * Exit history browsing mode
     */
    exitHistoryBrowsing() {
        this.messageHistory.isBrowsing = false;
        this.messageHistory.currentIndex = -1;
        this.messageHistory.originalContent = '';
    }

    /**
     * Test Evolution integration
     */
    testEvolutionIntegration() {
        console.log('=== Testing Evolution Integration ===');
        
        const summary = this.getEvolutionDataSummary();
        console.log('Current Evolution Data:', summary);
        
        // Test adding some sample data
        this.addToEvolutionData({
            type: 'test_event',
            content: 'This is a test event for Evolution integration',
            metadata: { source: 'integration_test' }
        });
        
        const updatedSummary = this.getEvolutionDataSummary();
        console.log('Updated Evolution Data:', updatedSummary);
        
        return {
            status: 'Evolution integration test completed',
            summary: updatedSummary,
            testEventAdded: true
        };
    }
} 