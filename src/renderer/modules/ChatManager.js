/**
 * ChatManager - Handles LLM chat interface and MCP communication
 */
// Note: fs and path are required locally inside addToolResultMessage to avoid global scope conflicts

class ChatManager {
  constructor(app, configManager = null) {
    this.app = app;
    this.configManager = configManager;
    this.llmConfigManager = null;
    this.mcpServerManager = null;
    this.chatHistory = [];

    // Dock state
    this.isDocked = false;

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
      currentStep: 0,
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

    // Initialize BLAST Function Tools
    this.blastFunctionTools = null;
    this.initializeBlastFunctionTools();

    // Initialize Plugin Manager (async - stores promise for awaiting)
    this._pluginManagerReady = this.initializePluginManager();

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
      cacheEnabled: true,
    };
    this.initializePluginFunctionCallsIntegrator();

    // Initialize Multi-Agent System
    this.initializeMultiAgentSystem();

    // Initialize Smart Execution System
    this.smartExecutor = null;
    this.isSmartExecutionEnabled = true; // 可配置开关
    this.initializeSmartExecutor();

    // Removed Conversation Evolution Integration (cleanup completed)

    // Initialize Dynamic Tools Registry System
    this.dynamicTools = null;
    this.dynamicToolsEnabled = true;
    this.initializeDynamicTools();

    // Initialize Tool Execution Tracker
    this.toolExecutionTracker = null;
    this.initializeToolExecutionTracker();

    // Set global reference for copy button functionality
    window.chatManager = this;

    // Message history browsing state
    this.messageHistory = {
      userMessages: [], // Filtered user messages for browsing
      currentIndex: -1, // Current position in history (-1 means not browsing)
      originalContent: '', // Original input content before browsing
      isBrowsing: false, // Whether currently browsing history
    };

    // DON'T load chat history here - wait for UI to be created

    // Initialize working directory
    this.initializeWorkingDirectory();

    // Initialize modularized services first - UI initialization depends on them
    this.services = {
      execution: new window.ToolExecutionService(this.app, this),
      tools: new window.LocalToolService(this.app, this),
      file: new window.FileOperationService(this.app, this),
      analysis: new window.GenomeAnalysisService(this.app, this),
      protein: new window.ProteinService(this.app, this),
      blast: new window.BlastService(this.app, this),
      annotation: new window.AnnotationService(this.app, this),
      intent: new window.IntentParserService(this.app, this),
      context: new window.LLMContextService(this.app, this),
      ui: new window.UIService(this.app, this),
      messaging: new window.ChatMessageService(this.app, this),
      settings: new window.SettingsService(this.app, this),
      trackBridge: new window.TrackSettingsBridgeService(this.app, this),
      llm: new window.LLMInteractionService(this.app, this),
      thinking: new window.ThinkingDisplayService(this.app, this),
    };

    // Legacy MCP connection check (kept for backward compatibility)
    this.checkAndSetupMCPConnection();
    this.initializeUI();

    // Load chat history AFTER UI is initialized
    setTimeout(() => {
      this.services.messaging.loadChatHistory();

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

        // Wait for async settings loading (awaits ConfigManager initialization)
        if (this.chatBoxSettingsManager._initPromise) {
          await this.chatBoxSettingsManager._initPromise;
        }

        // Update display flags from settings
        this.updateSettingsFromManager();

        // Listen for settings changes
        window.addEventListener('chatbox-settingsChanged', event => {
          this.updateSettingsFromManager();

          // Check if Dynamic Tools Registry setting changed
          const dynamicToolsRegistryEnabled = this.configManager.get(
            'chatboxSettings.enableDynamicToolsRegistry',
            true
          );
        });

        // Set global reference for settings modal
        window.chatBoxSettingsManager = this.chatBoxSettingsManager;

        // Listen for Multi-Agent Settings changes
        window.addEventListener('multiAgentSettingsChanged', event => {
          this.updateMultiAgentToggleButton();
        });
      } else {
        console.warn('ChatBoxSettingsManager not available');
      }
    } catch (error) {
      // Silently handle initialization error
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
      this.hideThinkingAfterConversation = this.chatBoxSettingsManager.getSetting(
        'hideThinkingAfterConversation',
        false
      );
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
      this.agentSystemSettings.llmUseSystemPrompt = this.chatBoxSettingsManager.getSetting(
        'agentLLMUseSystemPrompt',
        true
      );
      this.agentSystemSettings.llmEnableFunctionCalling = this.chatBoxSettingsManager.getSetting(
        'agentLLMEnableFunctionCalling',
        true
      );

      // Settings updated from ChatBoxSettingsManager
    }
  }

  /**
   * Initialize MicrobeGenomicsFunctions integration
   */
  initializeMicrobeGenomicsFunctions() {
    // Check if MicrobeGenomicsFunctions is available globally
    if (typeof window !== 'undefined' && window.MicrobeFns) {
      this.MicrobeFns = window.MicrobeFns;
      // MicrobeGenomicsFunctions integrated successfully
    } else {
      // MicrobeGenomicsFunctions not available globally
    }
  }

  /**
   * Initialize Plugin Manager V2 integration
   */
  async initializePluginManager() {
    console.log('📦 [DEBUG] ChatManager.initializePluginManager() called');
    console.log('📦 [DEBUG] PluginManagerV2 available:', typeof PluginManagerV2 !== 'undefined');
    try {
      // Check if PluginManagerV2 is already available globally
      if (typeof PluginManagerV2 !== 'undefined') {
        console.log('📦 [DEBUG] Creating new PluginManagerV2 instance...');
        this.pluginManager = new PluginManagerV2(this.app, this.configManager);

        // Wait for plugin system to fully initialize (including marketplace and installed plugins)
        console.log('🔄 Waiting for PluginManagerV2 initialization...');
        await this.pluginManager.waitForInitialization();
        console.log('✅ PluginManagerV2 fully initialized');

        // Listen to enhanced plugin events
        this.pluginManager.on('system-initialized', data => {
          // Plugin system initialized
        });

        this.pluginManager.on('function-executed', data => {
          // Plugin function executed
        });

        this.pluginManager.on('function-error', data => {
          // Plugin function error
        });

        this.pluginManager.on('plugin-registered', data => {
          // Plugin registered
          // Notify Dynamic Tools about plugin state change
          this.onPluginStateChanged();
        });

        // Connect PluginManager to Dynamic Tools after initialization
        this.connectPluginManagerToDynamicTools();
      } else {
        // PluginManagerV2 not available, loading dynamically...
        await this.loadPluginManager();
      }
    } catch (error) {
      console.error('❌ Failed to initialize PluginManagerV2:', error);
    }
  }

  /**
   * Wait for plugin manager to be fully initialized
   * @returns {Promise<void>}
   */
  async waitForPluginManager() {
    if (this._pluginManagerReady) {
      await this._pluginManagerReady;
    }
    if (this.pluginManager && this.pluginManager.waitForInitialization) {
      await this.pluginManager.waitForInitialization();
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
        // PluginManagerV2 loaded and initialized successfully
      } else {
        throw new Error('PluginManagerV2 failed to load');
      }
    } catch (error) {
      // Failed to load PluginManagerV2
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
        // Script already loaded, skipping...
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
      await this.loadScript('modules/BlastChatManagerIntegration.js');
      await this.loadScript('modules/PrimerChatManagerIntegration.js');
      await this.loadScript('modules/PluginFunctionCallsIntegrator.js');

      // Initialize after PluginManager is ready
      const initIntegrator = () => {
        if (typeof PluginFunctionCallsIntegrator !== 'undefined' && this.pluginManager) {
          this.pluginFunctionCallsIntegrator = new PluginFunctionCallsIntegrator(this, this.pluginManager);
          // PluginFunctionCallsIntegrator initialized successfully
        } else {
          // PluginFunctionCallsIntegrator or PluginManager not available, retrying...
          setTimeout(initIntegrator, 500);
        }
      };

      // Try to initialize, with retry for timing issues
      setTimeout(initIntegrator, 100);
    } catch (error) {
      // Failed to initialize PluginFunctionCallsIntegrator
    }
  }

  /**
   * Initialize Multi-Agent System (Legacy)
   */
  async initializeMultiAgentSystem() {
    try {
      // Load settings first
      this.loadAgentSystemSettings();

      // Agent System Settings loaded

      // Initializing Legacy Multi-Agent System...
      // Initialize Legacy Multi-Agent System
      await this.initializeLegacyMultiAgentSystem();
    } catch (error) {
      // Failed to initialize Multi-Agent System
    }
  }

  /**
   * Initialize Legacy Multi-Agent System
   */
  async initializeLegacyMultiAgentSystem() {
    try {
      // Initializing Legacy Multi-Agent System...

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

      // Initialize Multi-Agent System
      if (typeof MultiAgentSystem !== 'undefined') {
        this.multiAgentSystem = new MultiAgentSystem(this, this.configManager);
        await this.multiAgentSystem.initialize();

        // Initialize Memory System
        if (typeof MemorySystem !== 'undefined') {
          this.memorySystem = new MemorySystem(this.multiAgentSystem);
          await this.memorySystem.initialize();
        }

        // Legacy Multi-Agent System initialized successfully
        this.agentSystemEnabled = this.agentSystemSettings.enabled;

        // Emit initialization event
        this.emit('agent-system-initialized', {
          enabled: this.agentSystemEnabled,
          agentCount: this.multiAgentSystem.agents.size,
        });
      } else {
        // MultiAgentSystem not available
      }
    } catch (error) {
      // Failed to initialize Legacy Multi-Agent System
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
        ...savedSettings,
      };

      // Also load from multiAgentSettings (used by MultiAgentSettingsManager) for sync
      const masSaved = this.configManager.get('multiAgentSettings', {});
      if (masSaved && Object.keys(masSaved).length > 0) {
        // Map multiAgentSettings keys to agentSystemSettings keys
        if (masSaved.multiAgentSystemEnabled !== undefined) {
          this.agentSystemSettings.enabled = masSaved.multiAgentSystemEnabled;
        }
        if (masSaved.multiAgentAutoOptimize !== undefined) {
          this.agentSystemSettings.autoOptimize = masSaved.multiAgentAutoOptimize;
        }
        if (masSaved.multiAgentShowInfo !== undefined) {
          this.agentSystemSettings.showAgentInfo = masSaved.multiAgentShowInfo;
        }
        if (masSaved.multiAgentMemoryEnabled !== undefined) {
          this.agentSystemSettings.memoryEnabled = masSaved.multiAgentMemoryEnabled;
        }
        if (masSaved.multiAgentCacheEnabled !== undefined) {
          this.agentSystemSettings.cacheEnabled = masSaved.multiAgentCacheEnabled;
        }
        if (masSaved.multiAgentLLMTemperature !== undefined) {
          this.agentSystemSettings.llmTemperature = masSaved.multiAgentLLMTemperature;
        }
        if (masSaved.multiAgentLLMMaxTokens !== undefined) {
          this.agentSystemSettings.llmMaxTokens = masSaved.multiAgentLLMMaxTokens;
        }
        if (masSaved.multiAgentLLMTimeout !== undefined) {
          this.agentSystemSettings.llmTimeout = masSaved.multiAgentLLMTimeout;
        }
        if (masSaved.multiAgentLLMRetryAttempts !== undefined) {
          this.agentSystemSettings.llmRetryAttempts = masSaved.multiAgentLLMRetryAttempts;
        }
        if (masSaved.multiAgentLLMUseSystemPrompt !== undefined) {
          this.agentSystemSettings.llmUseSystemPrompt = masSaved.multiAgentLLMUseSystemPrompt;
        }
        if (masSaved.multiAgentLLMEnableFunctionCalling !== undefined) {
          this.agentSystemSettings.llmEnableFunctionCalling = masSaved.multiAgentLLMEnableFunctionCalling;
        }
        if (masSaved.multiAgentModelType !== undefined) {
          this.agentSystemSettings.llmProvider = masSaved.multiAgentModelType;
        }
      }

      // Sync agentSystemEnabled from loaded settings
      this.agentSystemEnabled = this.agentSystemSettings.enabled;
    } catch (error) {
      // Failed to load agent system settings
    }
  }

  /**
   * Save agent system settings to config
   */
  saveAgentSystemSettings() {
    try {
      this.configManager.set('agentSystemSettings', this.agentSystemSettings);
    } catch (error) {
      // Failed to save agent system settings
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
    this.showNotification(`Multi-Agent System ${newState ? 'enabled' : 'disabled'}`, newState ? 'success' : 'info');

    // Emit state change event
    this.emit('agent-system-state-changed', {
      enabled: this.agentSystemEnabled,
      settings: this.agentSystemSettings,
    });

    // Multi-Agent system toggled

    return this.agentSystemEnabled;
  }

  /**
   * Update agent system settings
   */
  updateAgentSystemSettings(settings) {
    this.agentSystemSettings = {
      ...this.agentSystemSettings,
      ...settings,
    };
    this.saveAgentSystemSettings();

    // Agent system settings updated

    // Emit settings update event
    this.emit('agent-system-settings-updated', {
      settings: this.agentSystemSettings,
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
      systemType: 'legacy',
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
        // SmartExecutor initialized successfully
      } else {
        // SmartExecutor not available, falling back to standard execution
      }
    } catch (error) {
      // Failed to initialize SmartExecutor
      this.isSmartExecutionEnabled = false;
    }
  }

  /**
   * Process a prompt through the AI agent (for MCP Server remote invocation)
   * This is the bridge between MCP Server's codexomics_chat tool
   * and the internal ChatBox + LLM + tool execution loop.
   *
   * The prompt is executed in the ChatBox with a source marker, making the
   * execution process visible to the user — identical to typing in ChatBox.
   *
   * @param {string} prompt - Natural language instruction
   * @param {Object} options - Execution options
   * @param {boolean} options.activateMultiAgent - Enable multi-agent coordination
   * @param {Function} options.onProgress - Optional progress callback for MCP notifications
   *   Receives: { type: string, message: string, data?: Object }
   *   Types: 'round_start', 'completion', 'error'
   * @returns {Object} Execution result with response and mode
   */
  async processAgentPrompt(prompt, options = {}) {
    const { activateMultiAgent = false, onProgress = null } = options;

    // Save current agent state
    const previousAgentState = this.agentSystemEnabled;

    try {
      // Validate LLM configuration
      if (!this.llmConfigManager || !this.llmConfigManager.isConfigured()) {
        throw new Error('No LLM configured. Please set up an LLM provider in Settings > LLM Config.');
      }

      // Temporarily activate multi-agent if requested
      if (activateMultiAgent && !this.agentSystemEnabled) {
        this.agentSystemEnabled = true;
        console.log('[AgentMode] Multi-agent mode activated for this request');
      }

      // Notify progress: starting
      if (onProgress) {
        onProgress({ type: 'round_start', message: `Starting agent execution in ChatBox`, data: { mode: activateMultiAgent ? 'multi-agent' : 'single-agent' } });
      }

      // Mark the prompt with MCP source so user knows where it came from
      const markedPrompt = `🔗 **[MCP Agent]** ${prompt}`;

      // Check if ChatBox is busy — if so, wait briefly
      if (this.conversationState.isProcessing) {
        if (onProgress) {
          onProgress({ type: 'error', message: 'ChatBox is busy with another request' });
        }
        return {
          success: false,
          error: 'ChatBox is busy with another request. Please wait and try again.',
          mode: activateMultiAgent ? 'multi-agent' : 'single-agent',
        };
      }

      // Initialize conversation state (same as sendMessage)
      this.startConversation();

      // Add user message to ChatBox with MCP source marker
      this.services.messaging.addMessageToChat(markedPrompt, 'user');

      // Show thinking process
      this.showThinkingProcess && this.services.thinking.addThinkingMessage('🔗 MCP Agent request — analyzing...');
      this.services.messaging.showTypingIndicator();

      try {
        // Execute via the main sendToLLM pipeline — same as user typing in ChatBox
        const response = await this.services.llm.sendToLLM(prompt);

        // Display response in ChatBox
        this.services.messaging.removeTypingIndicator();
        this.services.messaging.addMessageToChat(response, 'assistant');

        // Notify progress: completion
        if (onProgress) {
          onProgress({ type: 'completion', message: `Agent execution completed in ChatBox`, data: { responseLength: response ? response.length : 0 } });
        }

        return {
          success: true,
          response: response,
          mode: activateMultiAgent ? 'multi-agent' : 'single-agent',
        };
      } catch (llmError) {
        this.services.messaging.removeTypingIndicator();
        if (llmError.name === 'AbortError') {
          this.services.messaging.addMessageToChat('MCP Agent request aborted by user.', 'assistant', false, 'warning');
        } else {
          this.services.messaging.addMessageToChat(`MCP Agent request failed: ${llmError.message}`, 'assistant', true);
          console.error('[AgentMode] sendToLLM failed:', llmError);
        }
        throw llmError;
      } finally {
        this.endConversation();
      }

    } catch (error) {
      console.error('[AgentMode] processAgentPrompt failed:', error);

      // Notify progress: error
      if (onProgress) {
        onProgress({ type: 'error', message: `Agent execution failed: ${error.message}` });
      }

      return {
        success: false,
        error: error.message,
        mode: activateMultiAgent ? 'multi-agent' : 'single-agent',
      };
    } finally {
      // Restore previous agent state
      this.agentSystemEnabled = previousAgentState;
    }
  }

  /**
   * Initialize Dynamic Tools Registry System
   */
  async initializeDynamicTools() {
    try {
      // Initializing Dynamic Tools Registry System...

      // Initialize Blast Function Tools
      if (typeof this.initializeBlastFunctionTools === 'function') {
        await this.initializeBlastFunctionTools();
      }

      // Initialize Primer Function Tools
      if (typeof this.initializePrimerFunctionTools === 'function') {
        await this.initializePrimerFunctionTools();
      }

      // Check if we can access file system to verify tools_registry directory
      if (window.require) {
        try {
          const fs = window.require('fs');
          const path = window.require('path');

          // Check different possible locations
          const possibleDirs = [
            path.join(__dirname, '../../tools_registry'),
            path.join(__dirname, '../../../tools_registry'),
            path.join(process.cwd(), 'tools_registry'),
            path.join(process.resourcesPath, 'tools_registry'),
          ];

          // Checking tools_registry directory locations:
          for (const dir of possibleDirs) {
            try {
              const exists = fs.existsSync(dir);
              // Directory check result
              if (exists) {
                const files = fs.readdirSync(dir);
                // Files found
              }
            } catch (e) {
              // Directory check error
            }
          }
        } catch (e) {
          // Could not access filesystem for directory check
        }
      }

      // Try different path resolution strategies for packaged vs development
      let SystemIntegration;
      const possiblePaths = [
        '../../tools_registry/system_integration', // Development path
        '../../../tools_registry/system_integration', // Alternative dev path
        './tools_registry/system_integration', // Packaged relative path
        'tools_registry/system_integration', // Direct path
      ];

      let loadedPath = null;
      for (const tryPath of possiblePaths) {
        try {
          // Trying to load SystemIntegration from path
          SystemIntegration = require(tryPath);
          loadedPath = tryPath;
          // Successfully loaded SystemIntegration from path
          break;
        } catch (pathError) {
          // Failed to load from path
        }
      }

      if (!SystemIntegration) {
        throw new Error('Could not load SystemIntegration from any path');
      }

      // SystemIntegration loaded

      if (SystemIntegration) {
        // Creating SystemIntegration instance...
        this.dynamicTools = new SystemIntegration();
        // Calling initialize()...
        const initialized = await this.dynamicTools.initialize();
        // Initialize result

        if (initialized) {
          // Dynamic Tools Registry System initialized
          // Loaded from path

          // Connect PluginManager to Dynamic Tools Bridge
          this.connectPluginManagerToDynamicTools();
        } else {
          // Dynamic Tools Registry System failed to initialize, using fallback
          this.dynamicToolsEnabled = false;
        }
      } else {
        // SystemIntegration not available
        this.dynamicToolsEnabled = false;
      }
    } catch (error) {
      // Failed to initialize Dynamic Tools Registry System
      // Error details
      this.dynamicToolsEnabled = false;
    }
  }

  /**
   * Initialize Tool Execution Tracker
   */
  async initializeToolExecutionTracker() {
    try {
      // Initializing Tool Execution Tracker...

      // Check if ToolExecutionTracker is available globally
      if (typeof ToolExecutionTracker !== 'undefined') {
        this.toolExecutionTracker = new ToolExecutionTracker();
        // Tool Execution Tracker initialized successfully
      } else {
        // Try to load the module
        await this.loadScript('modules/ToolExecutionTracker.js');

        if (typeof ToolExecutionTracker !== 'undefined') {
          this.toolExecutionTracker = new ToolExecutionTracker();
          // Tool Execution Tracker loaded and initialized successfully
        } else {
          // ToolExecutionTracker not available
        }
      }
    } catch (error) {
      // Failed to initialize Tool Execution Tracker
    }
  }

  /**
   * Get the last user query for Dynamic Tools Registry intent analysis
   */
  getLastUserQuery() {
    // Try to get the current message being processed
    if (this.currentMessage) {
      return this.currentMessage;
    }

    // Fallback to chat history
    if (this.chatHistory.length === 0) return '';
    const lastMessage = this.chatHistory[this.chatHistory.length - 1];
    return lastMessage.role === 'user' ? lastMessage.content : '';
  }

  /**
   * Check if we're currently in benchmark mode
   * @returns {boolean} True if in benchmark mode
   */
  isBenchmarkMode() {
    // Check if benchmark interface is open
    const benchmarkInterface = document.getElementById('benchmarkInterface');
    if (benchmarkInterface && benchmarkInterface.style.display !== 'none') {
      return true;
    }

    // Check if any benchmark is currently running
    if (window.benchmarkUI && window.benchmarkUI.isRunning) {
      return true;
    }

    // Check if we have an active benchmark manager
    if (this.app?.benchmarkManager?.isRunning) {
      return true;
    }

    return false;
  }

  /**
   * Load genome file (FASTA/GenBank) - Built-in function tool
   * @param {Object} parameters - Tool parameters
   * @param {string} parameters.filePath - Direct file path (optional)
   * @param {boolean} parameters.showFileDialog - Whether to show file dialog (default: false)
   * @param {string} parameters.fileType - File type hint ('fasta', 'genbank', 'auto')
   * @returns {Object} Load result
   */
  async loadGenomeFile(parameters = {}) {
    return this.services.file.loadGenomeFile(parameters);
  }

  /**
   * Load annotation file (GFF/BED) - Built-in function tool
   * @param {Object} parameters - Tool parameters
   * @param {string} parameters.filePath - Direct file path (optional)
   * @param {boolean} parameters.showFileDialog - Whether to show file dialog (default: false)
   * @param {string} parameters.fileType - File type hint ('gff', 'bed', 'auto')
   * @param {boolean} parameters.mergeWithExisting - Whether to merge with existing annotations (default: false)
   * @returns {Object} Load result
   */
  async loadAnnotationFile(parameters = {}) {
    return this.services.file.loadAnnotationFile(parameters);
  }

  /**
   * Load variant file (VCF) - Built-in function tool
   * @param {Object} parameters - Tool parameters
   * @param {string} parameters.filePath - Direct file path (optional)
   * @param {boolean} parameters.showFileDialog - Whether to show file dialog (default: false)
   * @returns {Object} Load result
   */
  async loadVariantFile(parameters = {}) {
    return this.services.file.loadVariantFile(parameters);
  }

  /**
   * Load reads file (SAM/BAM) - Built-in function tool
   * @param {Object} parameters - Tool parameters
   * @param {string} parameters.filePath - Direct file path (optional)
   * @param {boolean} parameters.showFileDialog - Whether to show file dialog (default: false)
   * @returns {Object} Load result
   */
  async loadReadsFile(parameters = {}) {
    return this.services.file.loadReadsFile(parameters);
  }

  /**
   * Load WIG tracks - Built-in function tool
   * @param {Object} parameters - Tool parameters
   * @param {string|string[]} parameters.filePaths - Direct file path(s) (optional)
   * @param {boolean} parameters.showFileDialog - Whether to show file dialog (default: false)
   * @param {boolean} parameters.multiple - Allow multiple file selection (default: true)
   * @returns {Object} Load result
   */
  async loadWigTracks(parameters = {}) {
    return this.services.file.loadWigTracks(parameters);
  }

  /**
   * Load operon file - Built-in function tool
   * @param {Object} parameters - Tool parameters
   * @param {string} parameters.filePath - Direct file path (optional)
   * @param {boolean} parameters.showFileDialog - Whether to show file dialog (default: false)
   * @param {string} parameters.format - File format hint ('json', 'csv', 'txt', 'auto')
   * @returns {Object} Load result
   */
  async loadOperonFile(parameters = {}) {
    return this.services.file.loadOperonFile(parameters);
  }

  /**
   * Download a file from the internet - Built-in utility function tool
   * @param {Object} parameters - Tool parameters
   * @param {string} parameters.url - The URL to download from
   * @param {string} parameters.destinationPath - The local directory to save to (optional)
   * @param {string} parameters.filename - Custom filename (optional)
   * @returns {Object} Download result
   */
  async downloadInternetFile(parameters = {}) {
    if (!this.services || !this.services.file) {
      console.error('[ChatManager] file not initialized');
      return;
    }
    return this.services.file.downloadInternetFile(parameters);
  }

  /**
   * Open and view a markdown file - Built-in utility function tool
   * @param {Object} parameters - Tool parameters
   * @param {string} parameters.filePath - The path to the markdown file
   * @param {string} parameters.title - Custom window title (optional)
   * @returns {Object} Viewer result
   */
  async viewMarkdownFile(parameters = {}) {
    try {
      const { filePath, title } = parameters;

      console.log(`📄 [ChatManager] Opening markdown file: ${filePath}`);

      if (!filePath) {
        throw new Error('File path is required');
      }

      // Main renderer window uses nodeIntegration:true / contextIsolation:false (no preload),
      // so window.electronAPI is undefined here. Use require('electron').ipcRenderer directly.
      const { ipcRenderer } = require('electron');
      const result = await ipcRenderer.invoke('open-markdown-viewer', { filePath, title });

      if (result.success) {
        return {
          success: true,
          message: `Opened markdown viewer for: ${result.fileName}`,
          filePath: result.filePath,
          fileName: result.fileName,
          windowTitle: result.windowTitle,
          tool: 'view_markdown_file',
        };
      } else {
        throw new Error(result.error || 'Failed to open markdown viewer');
      }
    } catch (error) {
      console.error('❌ [ChatManager] Error opening markdown viewer:', error);
      return {
        success: false,
        error: error.message,
        tool: 'view_markdown_file',
      };
    }
  }

  /**
   * Get list of loaded files - Built-in function tool
   * Returns information about all currently loaded files in the genome browser
   * @param {Object} parameters - Tool parameters (optional)
   * @param {boolean} parameters.includeMetadata - Include detailed file metadata (default: true)
   * @returns {Object} Loaded files list result
   */

  async getLoadedFilesList(parameters = {}) {
    try {
      const { includeMetadata = true } = parameters;

      // [ChatManager] Getting loaded files list

      if (!this.app) {
        throw new Error('Application not available');
      }

      // Get loaded files from genome browser
      const loadedFiles = this.app.loadedFiles || [];

      // Format the file list
      const filesList = loadedFiles.map(file => {
        const baseInfo = {
          name: file.name,
          path: file.path,
          type: file.type,
        };

        if (includeMetadata) {
          return {
            ...baseInfo,
            size: file.size,
            sizeFormatted: file.size ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Unknown',
            loadedAt: file.loadedAt,
          };
        }

        return baseInfo;
      });

      const result = {
        success: true,
        message: `Found ${filesList.length} loaded file(s)`,
        filesCount: filesList.length,
        files: filesList,
        tool: 'get_loaded_files_list',
        timestamp: new Date().toISOString(),
      };

      // [ChatManager] TOOL EXECUTED: get_loaded_files_list - Retrieved file list

      return result;
    } catch (error) {
      // [ChatManager] Error getting loaded files list

      const errorResult = {
        success: false,
        error: error.message,
        filesCount: 0,
        files: [],
        tool: 'get_loaded_files_list',
        timestamp: new Date().toISOString(),
      };

      return errorResult;
    }
  }

  /**
   * Set working directory - Built-in function tool
   * @param {Object} parameters - Tool parameters
   * @param {string} parameters.directory_path - Absolute or relative path to set as working directory
   * @param {boolean} parameters.use_home_directory - Set to true to use user home directory
   * @param {boolean} parameters.create_if_missing - Create directory if it doesn't exist (default: false)
   * @param {boolean} parameters.validate_permissions - Validate read/write permissions (default: true)
   * @returns {Object} Set directory result
   */
  async setWorkingDirectory(parameters = {}) {
    // Support both parameter names for compatibility
    const directory_path = parameters.directory_path || parameters.working_directory;
    const { use_home_directory = false, create_if_missing = false, validate_permissions = true } = parameters;

    // [ChatManager] Setting working directory

    try {
      let targetPath;
      let previousDirectory = this.getCurrentWorkingDirectory();

      // Determine target directory
      if (use_home_directory) {
        const os = require('os');
        targetPath = os.homedir();
        // [ChatManager] Using home directory
      } else if (directory_path) {
        const path = require('path');
        // Handle both absolute and relative paths
        targetPath = path.isAbsolute(directory_path) ? directory_path : path.resolve(process.cwd(), directory_path);
        // [ChatManager] Target directory
      } else {
        throw new Error('Either directory_path or use_home_directory must be provided');
      }

      // Validate and setup directory
      const fs = require('fs');
      const path = require('path');

      // Check if directory exists
      if (!fs.existsSync(targetPath)) {
        if (create_if_missing) {
          // [ChatManager] Creating directory
          fs.mkdirSync(targetPath, { recursive: true });
        } else {
          throw new Error(`Directory '${targetPath}' does not exist`);
        }
      }

      // Validate it's actually a directory
      const stats = fs.statSync(targetPath);
      if (!stats.isDirectory()) {
        throw new Error(`Path '${targetPath}' is not a directory`);
      }

      // Check permissions if requested
      let permissions = { readable: false, writable: false };
      if (validate_permissions) {
        try {
          fs.accessSync(targetPath, fs.constants.R_OK);
          permissions.readable = true;
        } catch (e) {
          // [ChatManager] Directory not readable
        }

        try {
          fs.accessSync(targetPath, fs.constants.W_OK);
          permissions.writable = true;
        } catch (e) {
          // [ChatManager] Directory not writable
        }

        if (!permissions.readable) {
          throw new Error(`Permission denied: Cannot read directory '${targetPath}'`);
        }
      }

      // Set the working directory
      process.chdir(targetPath);

      // Store in ChatManager state for persistence
      this.currentWorkingDirectory = targetPath;

      // Save to config for persistence across sessions
      if (this.configManager) {
        this.configManager.set('workingDirectory', targetPath);
      }

      const result = {
        success: true,
        message:
          create_if_missing && !fs.existsSync(targetPath)
            ? `Working directory set to ${targetPath} (created)`
            : `Working directory set to ${targetPath}`,
        current_directory: targetPath,
        previous_directory: previousDirectory,
        permissions: permissions,
        tool: 'set_working_directory',
        timestamp: new Date().toISOString(),
      };

      // Enhanced logging for benchmark tool detection recording
      // [ChatManager] TOOL EXECUTED: set_working_directory - Directory changed

      return result;
    } catch (error) {
      // [ChatManager] Error setting working directory

      const errorResult = {
        success: false,
        error: error.message,
        attempted_path: directory_path || (use_home_directory ? 'user home directory' : 'undefined'),
        tool: 'set_working_directory',
        timestamp: new Date().toISOString(),
      };

      // Log error for benchmark tool detection recording
      // [ChatManager] TOOL ERROR: set_working_directory - Failed

      return errorResult;
    }
  }

  /**
   * Get current working directory
   * @returns {string} Current working directory path
   */
  getCurrentWorkingDirectory() {
    return this.currentWorkingDirectory || process.cwd();
  }

  /**
   * Initialize working directory on startup
   */
  initializeWorkingDirectory() {
    try {
      // Check if there's a saved working directory
      let savedDirectory = null;
      if (this.configManager) {
        savedDirectory = this.configManager.get('workingDirectory', null);
      }

      if (savedDirectory && require('fs').existsSync(savedDirectory)) {
        this.currentWorkingDirectory = savedDirectory;
        process.chdir(savedDirectory);
        // [ChatManager] Restored working directory
      } else {
        // Default to user home directory
        const os = require('os');
        const homeDir = os.homedir();
        this.currentWorkingDirectory = homeDir;
        process.chdir(homeDir);
        // [ChatManager] Initialized working directory to home
      }
    } catch (error) {
      // [ChatManager] Error initializing working directory
      // Fallback to current process directory
      this.currentWorkingDirectory = process.cwd();
    }
  }

  /**
   * List all available tools in the system
   * @param {Object} parameters - Optional parameters
   * @param {string} parameters.category - Optional category filter
   * @param {boolean} parameters.include_details - Include detailed descriptions
   * @param {string} parameters.format - 'summary' or 'detailed'
   * @returns {Object} List of available tools organized by category
   */
  async listAvailableTools(parameters = {}) {
    const { category = null, include_details = false, format = 'summary' } = parameters;

    console.log('📋 [ChatManager] Listing available tools', { category, include_details, format });

    try {
      const result = {
        success: true,
        tool: 'list_available_tools',
        timestamp: new Date().toISOString(),
        total_tools: 0,
        categories: {},
        tools: [],
        filtered_category: category,
      };

      // Get tools from dynamic tools registry if available
      if (this.dynamicToolsEnabled && this.dynamicTools) {
        try {
          const allTools = await this.dynamicTools.getAllTools();

          // Organize by category
          for (const tool of allTools) {
            const cat = tool.category || 'uncategorized';

            // Skip if category filter is set and doesn't match
            if (category && cat !== category) continue;

            if (!result.categories[cat]) {
              result.categories[cat] = {
                name: cat,
                count: 0,
                tools: [],
              };
            }

            const toolInfo = {
              name: tool.name,
              description: tool.description || 'No description available',
            };

            if (include_details || format === 'detailed') {
              toolInfo.keywords = tool.keywords || [];
              toolInfo.parameters = tool.parameters || {};
            }

            result.categories[cat].tools.push(toolInfo);
            result.categories[cat].count++;
            result.tools.push(toolInfo);
            result.total_tools++;
          }

          console.log(`✅ [ChatManager] Listed ${result.total_tools} tools from dynamic registry`);
        } catch (error) {
          console.warn('⚠️ [ChatManager] Error getting dynamic tools, using fallback:', error);
        }
      }

      // Fallback or supplement with core tools from getCoreToolsByCategory
      if (result.total_tools === 0) {
        const coreTools = this.getCoreToolsInfo(category, include_details);
        result.categories = coreTools.categories;
        result.tools = coreTools.tools;
        result.total_tools = coreTools.total;
        console.log(`✅ [ChatManager] Listed ${result.total_tools} tools from core tools`);
      }

      // Format message based on format type
      if (format === 'summary') {
        result.message = this.formatToolsSummary(result);
      } else {
        result.message = this.formatToolsDetailed(result);
      }

      return result;
    } catch (error) {
      console.error('❌ [ChatManager] Error listing available tools:', error);
      return {
        success: false,
        error: error.message,
        tool: 'list_available_tools',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get core tools information
   */
  getCoreToolsInfo(category = null, includeDetails = false) {
    const coreCategories = {
      navigation: {
        name: 'Navigation & State Management',
        tools: [
          'navigate_to_position',
          'jump_to_gene',
          'find_gene_by_name',
          'open_new_tab',
          'zoom_in',
          'zoom_out',
          'get_current_state',
        ],
      },
      sequence: {
        name: 'Sequence Analysis',
        tools: ['get_sequence', 'translate_dna', 'reverse_complement', 'compute_gc', 'get_coding_sequence'],
      },
      database: {
        name: 'Database Integration',
        tools: ['search_uniprot_database', 'get_uniprot_entry', 'analyze_interpro_domains', 'search_interpro_entry'],
      },
      protein: {
        name: 'Protein Structure',
        tools: [
          'search_pdb_structures',
          'fetch_protein_structure',
          'search_alphafold_structures',
        ],
      },
      file_loading: {
        name: 'File Loading',
        tools: ['load_genome_file', 'load_annotation_file', 'load_variant_file', 'load_reads_file'],
      },
      system: {
        name: 'System Management',
        tools: ['set_working_directory', 'list_available_tools'],
      },
      sequence_editing: {
        name: 'Sequence Editing',
        tools: ['copy_sequence', 'paste_sequence', 'insert_sequence', 'delete_sequence', 'execute_actions'],
      },
    };

    const result = { categories: {}, tools: [], total: 0 };

    for (const [catKey, catInfo] of Object.entries(coreCategories)) {
      if (category && catKey !== category) continue;

      result.categories[catKey] = {
        name: catInfo.name,
        count: catInfo.tools.length,
        tools: catInfo.tools.map(name => ({
          name,
          description: `${catInfo.name} tool`,
        })),
      };

      result.tools.push(...result.categories[catKey].tools);
      result.total += catInfo.tools.length;
    }

    return result;
  }

  /**
   * Format tools list as summary
   */
  formatToolsSummary(result) {
    let message = `📋 **Available Tools Summary**\n\n`;
    message += `**Total Tools:** ${result.total_tools}\n\n`;

    for (const [catKey, catInfo] of Object.entries(result.categories)) {
      message += `### ${catInfo.name || catKey} (${catInfo.count} tools)\n`;
      message += catInfo.tools.map(t => `- ${t.name}`).join('\n');
      message += '\n\n';
    }

    return message;
  }

  /**
   * Format tools list with details
   */
  formatToolsDetailed(result) {
    let message = `📋 **Available Tools (Detailed)**\n\n`;
    message += `**Total Tools:** ${result.total_tools}\n\n`;

    for (const [catKey, catInfo] of Object.entries(result.categories)) {
      message += `### ${catInfo.name || catKey}\n`;
      for (const tool of catInfo.tools) {
        message += `- **${tool.name}**: ${tool.description}\n`;
      }
      message += '\n';
    }

    return message;
  }

  /**
   * Connect PluginManager to Dynamic Tools Registry
   * This enables plugin tools to be discovered and included in the LLM system prompt
   */
  connectPluginManagerToDynamicTools() {
    if (this.dynamicTools && this.pluginManager) {
      try {
        this.dynamicTools.setPluginManager(this.pluginManager);
        console.log('✅ [ChatManager] PluginManager connected to Dynamic Tools Bridge');

        // Get initial stats
        const stats = this.dynamicTools.integrationStatus;
        console.log(`📊 [ChatManager] Dynamic Tools status: ${stats.pluginToolsLoaded || 0} plugin tools integrated`);

        // Also register plugin tools with FunctionCallsOrganizer
        if (this.smartExecutor && this.smartExecutor.organizer) {
          this.smartExecutor.organizer.registerPluginTools(this.pluginManager);
        }
      } catch (error) {
        console.error('❌ [ChatManager] Failed to connect PluginManager to Dynamic Tools:', error);
      }
    } else {
      // Either dynamicTools or pluginManager is not ready, retry when both are available
      if (!this.dynamicTools) {
        console.log('⚠️ [ChatManager] Dynamic Tools not initialized yet, will connect later');
      }
      if (!this.pluginManager) {
        console.log('⚠️ [ChatManager] PluginManager not initialized yet, will connect later');
      }
    }
  }

  /**
   * Notify Dynamic Tools Registry when plugins are installed/uninstalled
   * Call this method after plugin installation or removal to update the tools cache
   */
  onPluginStateChanged() {
    if (this.dynamicTools && this.dynamicTools.pluginBridge) {
      this.dynamicTools.invalidatePluginCache();
      console.log('🔄 [ChatManager] Plugin state changed, Dynamic Tools cache invalidated');

      // Re-connect to ensure fresh plugin list
      this.connectPluginManagerToDynamicTools();
    }

    // Also update FunctionCallsOrganizer
    if (this.smartExecutor && this.smartExecutor.organizer && this.pluginManager) {
      this.smartExecutor.organizer.registerPluginTools(this.pluginManager);
      console.log('🔌 [ChatManager] FunctionCallsOrganizer updated with plugin tools');
    }
  }

  /**
   * Get current context for Dynamic Tools Registry
   */
  getCurrentContextForDynamicTools() {
    const context = this.services.llm.getCurrentContext();

    // Check if there's a valid LLM provider configured
    let hasAuth = false;
    if (this.llmConfigManager) {
      const currentProvider = this.llmConfigManager.getProviderForModelType('task');
      if (currentProvider) {
        const provider = this.llmConfigManager.providers[currentProvider];
        hasAuth = !!(provider && provider.apiKey && provider.enabled);
      }
    }

    // Enhanced context with detailed genome browser state
    const genomeState = context.genomeBrowser.currentState;
    // For navigation tools, consider data available if there's a current chromosome
    const hasData = genomeState.loadedFiles.length > 0 || genomeState.currentChromosome;

    return {
      hasData: hasData,
      hasNetwork: navigator.onLine,
      hasAuth: hasAuth,
      currentCategory: this.getCurrentCategory(),

      // Detailed genome browser state
      genomeBrowser: {
        currentChromosome: genomeState.currentChromosome,
        currentPosition: genomeState.currentPosition,
        visibleTracks: genomeState.visibleTracks || [],
        loadedFiles: genomeState.loadedFiles,
        sequenceLength: genomeState.sequenceLength,
        annotationsCount: genomeState.annotationsCount,
        userDefinedFeaturesCount: genomeState.userDefinedFeaturesCount,
      },

      // Legacy fields for backward compatibility
      loadedGenome: genomeState,
      activeTracks: genomeState.visibleTracks || [],
      currentPosition: genomeState.currentPosition || null,
    };
  }

  /**
   * Get current category based on active tools or context
   */
  getCurrentCategory() {
    // This would be determined based on current analysis context
    if (this.app?.genomeData?.currentAnalysis) {
      return this.app.genomeData.currentAnalysis.category;
    }
    return null;
  }

  /**
   * Get Dynamic Tools Registry statistics
   */
  async getDynamicToolsStats() {
    if (this.dynamicToolsEnabled && this.dynamicTools) {
      return await this.dynamicTools.getRegistryStats();
    }
    return { total_tools: 0, total_categories: 0 };
  }

  /**
   * Get tool usage statistics from Dynamic Tools Registry
   */
  getDynamicToolsUsageStats() {
    if (this.dynamicToolsEnabled && this.dynamicTools) {
      return this.dynamicTools.getToolUsageStats();
    }
    return {};
  }

  /**
   * Search tools by keywords using Dynamic Tools Registry
   */
  async searchDynamicTools(keywords, limit = 10) {
    if (this.dynamicToolsEnabled && this.dynamicTools) {
      return await this.dynamicTools.searchTools(keywords, limit);
    }
    return [];
  }

  /**
   * Get tools by category using Dynamic Tools Registry
   */
  async getDynamicToolsByCategory(categoryName) {
    if (this.dynamicToolsEnabled && this.dynamicTools) {
      return await this.dynamicTools.getToolsByCategory(categoryName);
    }
    return [];
  }

  /**
   * Get Dynamic Tools Registry integration status
   */
  getDynamicToolsStatus() {
    const settingsEnabled = this.configManager.get('chatboxSettings.enableDynamicToolsRegistry', true);
    return {
      enabled: settingsEnabled && this.dynamicToolsEnabled,
      settingsEnabled: settingsEnabled,
      systemEnabled: this.dynamicToolsEnabled,
      initialized: this.dynamicTools !== null,
      status: this.dynamicTools ? this.dynamicTools.getIntegrationStatus() : null,
    };
  }

  setupMCPServerEventHandlers() {
    this.mcpServerManager.on('serverConnected', data => {
      // [ChatManager] MCP Server connected
      this.updateMCPStatus('connected');
    });

    this.mcpServerManager.on('serverDisconnected', data => {
      // [ChatManager] MCP Server disconnected
      // Only update status to disconnected if no servers are connected
      if (this.mcpServerManager.getConnectedServersCount() === 0) {
        this.updateMCPStatus('disconnected');
      } else {
        // Update button state even if some servers are still connected
        this.updateMCPToggleButton();
      }
    });

    this.mcpServerManager.on('serverError', data => {
      const serverName = data.server?.name || data.serverId || 'Unknown Server';
      // [ChatManager] MCP Server error
    });

    this.mcpServerManager.on('toolsUpdated', data => {
      // [ChatManager] Tools updated for server
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
      reconnectDelay: 5,
    };

    const mcpSettings = this.configManager ? this.configManager.get('mcpSettings', defaultSettings) : defaultSettings;

    if (mcpSettings.allowAutoActivation && mcpSettings.autoConnect) {
      this.setupMCPConnection();
    }
  }

  // Legacy single MCP connection (kept for backward compatibility)
  async setupMCPConnection(manualConnection = false) {
    const defaultSettings = {
      autoConnect: false,
      serverUrl: 'ws://localhost:3003',
      reconnectDelay: 5,
    };

    const mcpSettings = this.configManager ? this.configManager.get('mcpSettings', defaultSettings) : defaultSettings;

    try {
      // Update status to connecting
      this.updateMCPStatus('connecting');

      this.mcpSocket = new WebSocket(mcpSettings.serverUrl);

      this.mcpSocket.onopen = () => {
        // [ChatManager] Connected to legacy MCP server
        this.isConnected = true;
        this.updateMCPStatus('connected');

        // Send any pending messages
        this.pendingMessages.forEach(msg => this.sendToMCP(msg));
        this.pendingMessages = [];
      };

      this.mcpSocket.onmessage = event => {
        try {
          const data = JSON.parse(event.data);
          this.handleMCPMessage(data);
        } catch (error) {
          // [ChatManager] Error parsing MCP message
        }
      };

      this.mcpSocket.onclose = () => {
        // [ChatManager] Disconnected from legacy MCP server
        this.isConnected = false;
        this.updateMCPStatus('disconnected');

        // Only attempt to reconnect if this is not a manual connection and auto-activation is enabled
        if (!manualConnection) {
          const currentSettings = this.configManager
            ? this.configManager.get('mcpSettings', defaultSettings)
            : defaultSettings;

          if (currentSettings.allowAutoActivation && currentSettings.autoConnect) {
            setTimeout(() => this.setupMCPConnection(), mcpSettings.reconnectDelay * 1000);
          }
        }
      };

      this.mcpSocket.onerror = error => {
        // [ChatManager] Legacy MCP connection error
        this.updateMCPStatus('disconnected');
      };
    } catch (error) {
      // [ChatManager] Failed to setup legacy MCP connection
      this.updateMCPStatus('disconnected');
    }
  }

  disconnectMCP() {
    if (this.mcpSocket) {
      // [ChatManager] Manually disconnecting from legacy MCP server
      this.mcpSocket.close();
      this.mcpSocket = null;
    }
    this.isConnected = false;
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
          statusText.textContent = connectedCount > 0 ? `Connected (${connectedCount} servers)` : 'Connected';
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
    // Instead of toggling all servers, show a server list popup
    this.showMCPServerListPopup();
  }

  /**
   * Show MCP Server list popup
   */
  showMCPServerListPopup() {
    // Remove any existing popup
    const existingPopup = document.getElementById('mcpServerListPopup');
    if (existingPopup) {
      existingPopup.remove();
    }

    // Create popup
    const popup = document.createElement('div');
    popup.id = 'mcpServerListPopup';
    popup.className = 'mcp-server-list-popup';
    popup.innerHTML = `
            <div class="mcp-server-list-container">
                <div class="mcp-server-list-header">
                    <h3>MCP Servers</h3>
                    <button class="close-btn" onclick="document.getElementById('mcpServerListPopup').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="mcp-server-list-content">
                    <div id="mcpServerListItems"></div>
                </div>
                <div class="mcp-server-list-footer">
                    <button class="btn btn-sm btn-secondary" onclick="document.getElementById('mcpServerListPopup').remove()">
                        Close
                    </button>
                </div>
            </div>
        `;

    // Add popup to document
    document.body.appendChild(popup);

    // Populate server list
    this.populateMCPServerListPopup();
  }

  /**
   * Populate MCP Server list popup
   */
  populateMCPServerListPopup() {
    const serverList = document.getElementById('mcpServerListItems');
    if (!serverList) return;

    if (!this.mcpServerManager) {
      serverList.innerHTML = '<div class="empty-state">MCPServerManager not available</div>';
      return;
    }

    const servers = this.mcpServerManager.getServerStatus();

    if (servers.length === 0) {
      serverList.innerHTML = '<div class="empty-state">No MCP servers configured</div>';
      return;
    }

    serverList.innerHTML = '';

    servers.forEach(server => {
      const serverItem = document.createElement('div');
      serverItem.className = 'mcp-server-list-item';
      serverItem.innerHTML = `
                <div class="mcp-server-info">
                    <div class="mcp-server-name">${this.services.llm.escapeHtml(server.name)}</div>
                    <div class="mcp-server-details">
                        <span class="mcp-server-url">${this.services.llm.escapeHtml(server.url)}</span>
                        <span class="mcp-server-status ${server.connected ? 'connected' : 'disconnected'}">
                            ${server.connected ? '● Connected' : '○ Disconnected'}
                        </span>
                    </div>
                </div>
                <div class="mcp-server-controls">
                    <label class="toggle-label">
                        <input type="checkbox" 
                               class="mcp-server-toggle" 
                               data-server-id="${server.id}" 
                               ${server.enabled ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                        <span class="toggle-text">${server.enabled ? 'Enabled' : 'Disabled'}</span>
                    </label>
                    <button class="btn btn-sm ${server.connected ? 'btn-secondary' : 'btn-primary'}" 
                            onclick="genomeBrowser.chatManager.toggleMCPServerConnection('${server.id}')">
                        ${server.connected ? 'Disconnect' : 'Connect'}
                    </button>
                </div>
            `;
      serverList.appendChild(serverItem);
    });

    // Add event listeners for enable/disable toggles
    const toggles = serverList.querySelectorAll('.mcp-server-toggle');
    toggles.forEach(toggle => {
      toggle.addEventListener('change', e => {
        const serverId = e.target.dataset.serverId;
        const enabled = e.target.checked;
        this.toggleMCPServerEnabled(serverId, enabled);
        e.target.nextElementSibling.nextElementSibling.textContent = enabled ? 'Enabled' : 'Disabled';
      });
    });
  }

  /**
   * Toggle MCP Server enabled state
   * @param {string} serverId - Server ID
   * @param {boolean} enabled - Enabled state
   */
  toggleMCPServerEnabled(serverId, enabled) {
    if (this.mcpServerManager) {
      this.mcpServerManager.updateServer(serverId, { enabled });
      this.showNotification(`${enabled ? 'Enabled' : 'Disabled'} server ${serverId}`, 'info');
    }
  }

  /**
   * Toggle connection to a specific MCP Server
   * @param {string} serverId - Server ID
   */
  async toggleMCPServerConnection(serverId) {
    if (!this.mcpServerManager) return;

    const server = this.mcpServerManager.getServer(serverId);
    if (!server) return;

    try {
      if (server.connected) {
        await this.mcpServerManager.disconnectFromServer(serverId);
        this.showNotification(`Disconnected from ${server.name}`, 'info');
      } else {
        await this.mcpServerManager.connectToServer(serverId);
        this.showNotification(`Connected to ${server.name}`, 'success');
      }
      // Refresh the server list
      this.populateMCPServerListPopup();
    } catch (error) {
      console.error(`Error toggling connection to server ${serverId}:`, error);
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

    // Update button title
    if (isConnected) {
      toggleBtn.title = `MCP Tools Enabled (${connectedCount} connection${connectedCount !== 1 ? 's' : ''})`;
    } else {
      toggleBtn.title = 'MCP Tools Disabled';
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
      window.dispatchEvent(
        new CustomEvent(`chatmanager-${eventType}`, {
          detail: data,
        })
      );
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

      // Use new priority-based tool execution system first
      result = await this.services.tools.executeToolWithPriority(toolName, parameters);

      if (result !== undefined) {
        // Tool found and executed via priority system
        this.sendMessage({
          type: 'tool-response',
          requestId,
          success: true,
          result: result,
        });
        return;
      }

      // Fallback to main executeToolByName method (unified tool execution)
      // This eliminates the need for duplicate switch statements
      console.log(`🔄 [MCP] Fallback to executeToolByName for tool: ${toolName}`);
      result = await this.services.tools.executeToolByName(toolName, parameters);

      // Send success response
      this.sendToMCP({
        type: 'tool-response',
        requestId: requestId,
        success: true,
        result: result,
      });
    } catch (error) {
      console.error(`❌ [MCP] Tool execution failed for ${toolName}:`, error);
      this.sendToMCP({
        type: 'tool-response',
        requestId: requestId,
        success: false,
        error: error.message,
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
      } else if (parameters.sequence || parameters.dna || parameters.dna_sequence) {
        // Single sequence parameter — extract the actual string value
        const seq = parameters.sequence || parameters.dna || parameters.dna_sequence;
        if (typeof seq !== 'string') {
          throw new Error(`Expected a DNA sequence string but received ${typeof seq}. Provide a 'sequence' parameter with a string value.`);
        }
        result = this.MicrobeFns[methodName](seq);
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
          parameters: parameters,
        };
      }

      return {
        success: true,
        ...result,
        method: methodName,
        parameters: parameters,
      };
    } catch (error) {
      console.error(`Error executing MicrobeFns.${methodName}:`, error);
      throw new Error(`MicrobeGenomics function ${methodName} failed: ${error.message}`);
    }
  }

  /**
   * @deprecated Use this.services.tools.navigateToPosition() instead
   */
  async navigateToPosition(params) {
    return this.services.tools.navigateToPosition(params);
  }

  /**
   * @deprecated Use this.services.tools.openNewTab() instead
   */
  async openNewTab(params) {
    return this.services.tools.openNewTab(params);
  }

  /**
   * @deprecated Use this.services.tools.switchToTab() instead
   */
  async switchToTab(params) {
    return this.services.tools.switchToTab(params);
  }

  /**
   * @deprecated Use this.services.tools.closeTab() instead
   */
  async closeTab(params) {
    return this.services.tools.closeTab(params);
  }

  /**
   * @deprecated Use this.services.tools.searchFeatures() instead
   */
  async searchFeatures(params) {
    return this.services.tools.searchFeatures(params);
  }

  async searchGeneByName(params) {
    const { name } = params;

    console.log('searchGeneByName called with params:', params);

    if (!this.app || !this.app.navigationManager) {
      throw new Error('Navigation manager not available');
    }

    // Use improved gene search logic with relevance scoring
    const searchResults = this.performIntelligentGeneSearch(name);

    // Display results in sidebar using NavigationManager's populateSearchResults
    this.app.navigationManager.searchResults = searchResults;
    this.app.navigationManager.populateSearchResults(searchResults, name);

    // Auto-scroll sidebar to search results panel (similar to Gene Details)
    if (searchResults.length > 0 && this.app.scrollSidebarToSection) {
      const searchResultsSection = document.getElementById('searchResultsSection');
      if (searchResultsSection) {
        this.app.scrollSidebarToSection(searchResultsSection);
        console.log('🔄 Auto-scrolled sidebar to search results panel');
      }
    }

    console.log('Intelligent gene search completed, results:', searchResults);

    return {
      name: name,
      results: searchResults,
      count: searchResults.length,
      success: true,
    };
  }

  /**
   * Perform intelligent gene search with relevance scoring and filtering
   */
  performIntelligentGeneSearch(geneName) {
    if (!this.app || !this.app.currentAnnotations) {
      return [];
    }

    const currentChr = document.getElementById('chromosomeSelect')?.value;
    if (!currentChr || !this.app.currentAnnotations[currentChr]) {
      return [];
    }

    const annotations = this.app.currentAnnotations[currentChr];
    const searchTerm = geneName.toLowerCase();
    const results = [];

    console.log(`🔍 Intelligent search for gene: "${geneName}"`);
    console.log(`📊 Searching in ${annotations.length} annotations`);

    annotations.forEach(annotation => {
      if (!annotation.qualifiers) return;

      const geneNameValue = this.app.getQualifierValue(annotation.qualifiers, 'gene') || '';
      const locusTag = this.app.getQualifierValue(annotation.qualifiers, 'locus_tag') || '';
      const product = this.app.getQualifierValue(annotation.qualifiers, 'product') || '';
      const note = this.app.getQualifierValue(annotation.qualifiers, 'note') || '';

      // Debug logging for problematic values
      if (
        typeof geneNameValue !== 'string' ||
        typeof locusTag !== 'string' ||
        typeof product !== 'string' ||
        typeof note !== 'string'
      ) {
        console.warn('Non-string qualifier values found:', {
          gene: { value: geneNameValue, type: typeof geneNameValue },
          locus_tag: { value: locusTag, type: typeof locusTag },
          product: { value: product, type: typeof product },
          note: { value: note, type: typeof note },
        });
      }

      // Calculate relevance score with error handling
      let relevanceScore;
      try {
        relevanceScore = this.calculateGeneRelevanceScore(
          searchTerm,
          geneNameValue,
          locusTag,
          product
          // Note: removed note parameter to reduce token usage
        );
      } catch (error) {
        console.error('Error calculating relevance score for annotation:', {
          geneName: geneNameValue,
          locusTag: locusTag,
          product: product,
          note: note,
          error: error.message,
        });
        // Skip this annotation if there's an error
        return;
      }

      // Only include results with meaningful relevance (score > 0)
      if (relevanceScore && relevanceScore.score > 0) {
        const result = {
          type: 'gene',
          position: annotation.start,
          end: annotation.end,
          name: geneNameValue || locusTag || annotation.type,
          details: `${annotation.type}: ${product || 'No description'}`,
          // Remove full annotation object to reduce token usage
          // Only include essential annotation data without note information
          annotation: {
            start: annotation.start,
            end: annotation.end,
            type: annotation.type,
            strand: annotation.strand,
            qualifiers: {
              gene: geneNameValue,
              locus_tag: locusTag,
              product: product,
              // Note: intentionally excluding 'note' field to reduce token usage
            },
          },
          relevanceScore: relevanceScore.score,
          matchType: relevanceScore.matchType,
          matchedField: relevanceScore.matchedField,
        };

        results.push(result);
        console.log(
          `✅ Found match: ${result.name} (score: ${relevanceScore.score}, type: ${relevanceScore.matchType})`
        );
      }
    });

    // Sort by relevance score (highest first), then by position
    results.sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      return a.position - b.position;
    });

    // Limit results to most relevant ones (max 20 for gene search)
    const limitedResults = results.slice(0, 20);

    console.log(`📈 Search completed: ${limitedResults.length} relevant results found`);
    console.log(
      `🎯 Top results:`,
      limitedResults.slice(0, 5).map(r => `${r.name} (${r.relevanceScore})`)
    );

    return limitedResults;
  }

  /**
   * Calculate relevance score for gene search
   */
  calculateGeneRelevanceScore(searchTerm, geneName, locusTag, product) {
    let maxScore = 0;
    let matchType = 'none';
    let matchedField = '';

    const fields = [
      { name: 'gene', value: geneName, weight: 100 },
      { name: 'locus_tag', value: locusTag, weight: 80 },
      { name: 'product', value: product, weight: 20 },
      // Note: removed 'note' field to reduce token usage and improve search relevance
    ];

    fields.forEach(field => {
      if (!field.value) return;

      // Ensure field.value is a string and convert to lowercase
      let fieldValue;
      if (typeof field.value === 'string') {
        fieldValue = field.value.toLowerCase();
      } else if (Array.isArray(field.value)) {
        // Handle array values (join them)
        fieldValue = field.value.join(' ').toLowerCase();
      } else if (typeof field.value === 'object' && field.value !== null) {
        // Handle object values (convert to string)
        fieldValue = String(field.value).toLowerCase();
      } else {
        // Handle other types (numbers, booleans, etc.)
        fieldValue = String(field.value).toLowerCase();
      }

      let score = 0;
      let type = 'none';

      // Exact match (highest priority)
      if (fieldValue === searchTerm) {
        score = field.weight * 10;
        type = 'exact';
      }
      // Starts with search term
      else if (fieldValue.startsWith(searchTerm)) {
        score = field.weight * 8;
        type = 'starts_with';
      }
      // Ends with search term
      else if (fieldValue.endsWith(searchTerm)) {
        score = field.weight * 6;
        type = 'ends_with';
      }
      // Contains search term as whole word
      else if (new RegExp(`\\b${searchTerm}\\b`).test(fieldValue)) {
        score = field.weight * 5;
        type = 'whole_word';
      }
      // Contains search term (partial match)
      else if (fieldValue.includes(searchTerm)) {
        score = field.weight * 2;
        type = 'partial';
      }
      // Fuzzy match for gene names (allow some character differences)
      else if (field.name === 'gene' || field.name === 'locus_tag') {
        const fuzzyScore = this.calculateFuzzyMatch(searchTerm, fieldValue);
        if (fuzzyScore > 0.7) {
          // 70% similarity threshold
          score = field.weight * fuzzyScore;
          type = 'fuzzy';
        }
      }

      if (score > maxScore) {
        maxScore = score;
        matchType = type;
        matchedField = field.name;
      }
    });

    return {
      score: maxScore,
      matchType: matchType,
      matchedField: matchedField,
    };
  }

  /**
   * Calculate fuzzy match score between two strings
   */
  calculateFuzzyMatch(str1, str2) {
    if (str1.length === 0) return str2.length === 0 ? 1 : 0;
    if (str2.length === 0) return 0;

    const matrix = [];

    // Initialize matrix
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          );
        }
      }
    }

    const maxLength = Math.max(str1.length, str2.length);
    return maxLength === 0 ? 1 : (maxLength - matrix[str2.length][str1.length]) / maxLength;
  }

  getCurrentState() {
    if (!this.app) {
      throw new Error('Genome browser not initialized');
    }

    // Debug logging to understand the app state
    // console.log('ChatManager getCurrentState - this.app:', this.app);
    // console.log('ChatManager getCurrentState - this.app.currentChromosome:', this.app.currentChromosome);
    // console.log('ChatManager getCurrentState - this.app.currentAnnotations:', this.app.currentAnnotations);
    // console.log('ChatManager getCurrentState - this.app.currentPosition:', this.app.currentPosition);

    const state = {
      // Multi-window support: include window identifier
      windowId: this.app.windowId || null,
      currentChromosome: this.app.currentChromosome,
      currentPosition: this.app.currentPosition,
      visibleTracks: this.services.trackBridge.getVisibleTracks(),
      loadedFiles: this.app.loadedFiles || [],
      sequenceLength: this.app.sequenceLength || 0,
      annotationsCount: (this.app.currentAnnotations || []).length,
      userDefinedFeaturesCount: Object.keys(this.app.userDefinedFeatures || {}).length,

      // Enhanced: Add working directory information
      workingDirectory: {
        current: this.getCurrentWorkingDirectory(),
        timestamp: new Date().toISOString(),
      },

      // Enhanced: Add selected gene information
      selectedGene: this.app.selectedGene
        ? {
          geneName: this.app.selectedGene.gene?.qualifiers?.gene || 'Unknown',
          locusTag: this.app.selectedGene.gene?.qualifiers?.locus_tag || 'Unknown',
          product: this.app.selectedGene.gene?.qualifiers?.product || 'Unknown',
          position: `${this.app.selectedGene.gene?.start}-${this.app.selectedGene.gene?.end}`,
          strand: this.app.selectedGene.gene?.strand === -1 ? '-' : '+',
          type: this.app.selectedGene.gene?.type || 'Unknown',
          hasOperonInfo: !!this.app.selectedGene.operonInfo,
        }
        : null,

      // Enhanced: Add sequence selection information
      sequenceSelection: this.app.sequenceSelection
        ? {
          active: this.app.sequenceSelection.active,
          start: this.app.sequenceSelection.start,
          end: this.app.sequenceSelection.end,
          length:
            this.app.sequenceSelection.active && this.app.sequenceSelection.start && this.app.sequenceSelection.end
              ? this.app.sequenceSelection.end - this.app.sequenceSelection.start + 1
              : null,
        }
        : null,

      // Enhanced: Add current viewing region details
      viewingRegion: this.app.currentPosition
        ? {
          chromosome: this.app.currentChromosome,
          start: this.app.currentPosition.start,
          end: this.app.currentPosition.end,
          length: this.app.currentPosition.end - this.app.currentPosition.start + 1,
          centerPosition: Math.floor((this.app.currentPosition.start + this.app.currentPosition.end) / 2),
        }
        : null,

      // Enhanced: Add open tabs information
      openTabs: this.getOpenTabsInfo(),
    };

    console.log('ChatManager getCurrentState - final state:', state);
    return state;
  }

  /**
   * Get information about all open tabs
   * @returns {Array} Array of tab objects with id, title, position, chromosome, and isActive
   */
  getOpenTabsInfo() {
    try {
      if (!this.app?.tabManager?.tabs) {
        return [];
      }

      const activeTabId = this.app.tabManager.activeTabId;
      const tabs = [];

      for (const [tabId, tabState] of this.app.tabManager.tabs.entries()) {
        tabs.push({
          id: tabId,
          title: tabState.title || `Tab ${tabId}`,
          chromosome: tabState.chromosome || this.app.currentChromosome,
          position: tabState.position
            ? {
              start: tabState.position.start,
              end: tabState.position.end,
            }
            : null,
          isActive: tabId === activeTabId,
          index: tabs.length,
        });
      }

      return tabs;
    } catch (error) {
      console.warn('Error getting open tabs info:', error);
      return [];
    }
  }

  async getSequence(params) {
    return this.services.analysis.getSequence(params);
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
        description: description || '',
      };

      const featureId = await this.app.addUserDefinedFeature(feature);

      return {
        success: true,
        featureId: featureId,
        feature: feature,
        message: `Created ${type} annotation: ${name}`,
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
      length: end - start + 1,
    };

    // Get sequence if available
    if (this.app && this.app.getSequenceForRegion) {
      analysis.sequence = await this.app.getSequenceForRegion(chromosome, start, end);
    }

    // Get features if requested
    if (includeFeatures && this.app.currentAnnotations) {
      analysis.features = this.app.currentAnnotations.filter(
        feature => feature.chromosome === chromosome && feature.start >= start && feature.end <= end
      );
    }

    // Calculate GC content if requested
    if (includeGC && analysis.sequence) {
      const gcCount = (analysis.sequence.match(/[GC]/gi) || []).length;
      analysis.gcContent = ((gcCount / analysis.sequence.length) * 100).toFixed(2);
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
          message: `Data exported as ${format.toUpperCase()}`,
        };
      } catch (error) {
        throw new Error(`Export failed: ${error.message}`);
      }
    }

    throw new Error('Export manager not available');
  }

  /**
   * Export full genome sequence as FASTA format
   * Built-in tool equivalent for "FASTA Sequence" export dropdown option
   */
  async exportFastaSequence(parameters = {}) {
    return this.services.file.exportFastaSequence(parameters);
  }

  /**
   * Export genome data as GenBank format
   * Built-in tool equivalent for "GenBank Format" export dropdown option
   */
  async exportGenBankFormat(parameters = {}) {
    return this.services.file.exportGenBankFormat(parameters);
  }

  /**
   * Export coding sequences as FASTA format
   * Built-in tool equivalent for "CDS FASTA" export dropdown option
   */
  async exportCDSFasta(parameters = {}) {
    return this.services.file.exportCDSFasta(parameters);
  }

  /**
   * Export protein sequences as FASTA format
   * Built-in tool equivalent for "Protein FASTA" export dropdown option
   */
  async exportProteinFasta(parameters = {}) {
    return this.services.file.exportProteinFasta(parameters);
  }

  /**
   * Export feature annotations as GFF format
   * Built-in tool equivalent for "GFF Annotations" export dropdown option
   */
  async exportGFFAnnotations(parameters = {}) {
    return this.services.file.exportGFFAnnotations(parameters);
  }

  /**
   * Export feature annotations as BED format
   * Built-in tool equivalent for "BED Format" export dropdown option
   */
  async exportBEDFormat(parameters = {}) {
    return this.services.file.exportBEDFormat(parameters);
  }

  /**
   * Export current visible region as FASTA format
   * Built-in tool equivalent for "Current View (FASTA)" export dropdown option
   */
  async exportCurrentViewFasta(parameters = {}) {
    return this.services.file.exportCurrentViewFasta(parameters);
  }

  /**
   * Helper method to show save dialog for export operations
   * Uses Electron's native save dialog for file selection
   */
  async showExportSaveDialog(content, defaultFilename, formatType, mimeType = 'text/plain') {
    return this.services.file.showExportSaveDialog(content, defaultFilename, formatType, mimeType);
  }
  /**
   * Helper method for browser-based file download (fallback)
   */
  downloadFileAsBrowser(content, filename, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
    console.log(`💾 [ChatManager] Browser download triggered: ${filename}`);
  }

  /**
   * Helper method to write file directly without showing dialog
   * Uses Electron IPC for secure file system access
   */
  async writeFileDirectly(content, filename, formatType) {
    return this.services.file.writeFileDirectly(content, filePath, fileType);
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
      state: partialState,
    });
  }

  sendNavigationUpdate(chromosome, position) {
    this.sendToMCP({
      type: 'navigation',
      chromosome: chromosome,
      position: position,
    });
  }

  sendSearchResults(results) {
    this.sendToMCP({
      type: 'search-results',
      results: results,
    });
  }

  sendFeatureSelection(features) {
    this.sendToMCP({
      type: 'feature-selected',
      features: features,
    });
  }

  sendTrackVisibility(tracks) {
    this.sendToMCP({
      type: 'track-visibility',
      tracks: tracks,
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
                    </div>
                    <div class="chat-controls">
                        <button id="dockChatBtn" class="btn btn-sm chat-btn" title="Dock to right side">
                            <i class="fas fa-columns"></i>
                        </button>
                        <button id="chatBoxSettingsBtn" class="btn btn-sm chat-btn" title="ChatBox Settings">
                            <i class="fas fa-cog"></i>
                        </button>
                        <button id="resetChatPositionBtn" class="btn btn-sm chat-btn" title="Reset position and size">
                            <i class="fas fa-home"></i>
                        </button>
                        <button id="minimizeChatBtn" class="btn btn-sm chat-btn">
                            <i class="fas fa-minus"></i>
                        </button>
                        <button id="closeChatBtn" class="btn btn-sm chat-btn">
                            <i class="fas fa-eye-slash"></i>
                        </button>
                    </div>
                </div>
                <div class="chat-messages" id="chatMessages">
                    <div class="welcome-message">
                        <div class="message assistant-message">
                            <div class="message-content">
                                <i class="fas fa-robot message-icon"></i>
                                <div class="message-text">
                                    <div class="welcome-hero">
                                        <div class="welcome-hero-icon">🧬</div>
                                        <div class="welcome-hero-text">
                                            <h3>Welcome to CodeXomics AI</h3>
                                            <p>Your intelligent genomics assistant — click any example below to get started</p>
                                        </div>
                                    </div>
                                    <div class="welcome-cards-grid">
                                        <div class="welcome-card welcome-card-search">
                                            <div class="welcome-card-header">
                                                <span class="welcome-card-icon">🔍</span>
                                                <span class="welcome-card-title">Navigation & Search</span>
                                            </div>
                                            <div class="welcome-card-examples">
                                                <button class="welcome-example-btn" data-prompt="Navigate to E. coli origin of replication">Navigate to E. coli origin of replication</button>
                                                <button class="welcome-example-btn" data-prompt="Search for DNA polymerase genes">Search for DNA polymerase genes</button>
                                                <button class="welcome-example-btn" data-prompt="Find genes near position 123456">Find genes near position 123456</button>
                                            </div>
                                        </div>
                                        <div class="welcome-card welcome-card-molbio">
                                            <div class="welcome-card-header">
                                                <span class="welcome-card-icon">🧪</span>
                                                <span class="welcome-card-title">Molecular Biology</span>
                                            </div>
                                            <div class="welcome-card-examples">
                                                <button class="welcome-example-btn" data-prompt="Find EcoRI restriction sites in this region">Find EcoRI restriction sites in this region</button>
                                                <button class="welcome-example-btn" data-prompt="Virtual digest with EcoRI and BamHI">Virtual digest with EcoRI and BamHI</button>
                                                <button class="welcome-example-btn" data-prompt="Search for TATAAA promoter motifs">Search for TATAAA promoter motifs</button>
                                            </div>
                                        </div>
                                        <div class="welcome-card welcome-card-analysis">
                                            <div class="welcome-card-header">
                                                <span class="welcome-card-icon">📊</span>
                                                <span class="welcome-card-title">Sequence Analysis</span>
                                            </div>
                                            <div class="welcome-card-examples">
                                                <button class="welcome-example-btn" data-prompt="What is the GC content of the current view?">What is the GC content of the current view?</button>
                                                <button class="welcome-example-btn" data-prompt="Analyze codon usage in the lacZ gene">Analyze codon usage in the lacZ gene</button>
                                                <button class="welcome-example-btn" data-prompt="Find all ORFs longer than 300bp">Find all ORFs longer than 300bp</button>
                                            </div>
                                        </div>
                                        <div class="welcome-card welcome-card-export">
                                            <div class="welcome-card-header">
                                                <span class="welcome-card-icon">🔖</span>
                                                <span class="welcome-card-title">Organization & Export</span>
                                            </div>
                                            <div class="welcome-card-examples">
                                                <button class="welcome-example-btn" data-prompt="Bookmark this interesting region">Bookmark this interesting region</button>
                                                <button class="welcome-example-btn" data-prompt="Export features from current view">Export features from current view</button>
                                                <button class="welcome-example-btn" data-prompt="Show file information summary">Show file information summary</button>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="welcome-tip">
                                        <i class="fas fa-lightbulb"></i>
                                        <span>Ask anything in natural language — e.g. <em>"What restriction enzymes cut here?"</em> or <em>"Find intergenic regions longer than 500bp"</em></span>
                                    </div>
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
                        <button id="mcpToggleBtn" class="btn btn-sm btn-secondary mcp-tools-btn" title="Toggle MCP Tools" data-connected="false">
                            <i class="fas fa-microchip"></i>
                            MCP Tools
                        </button>
                    </div>
                    <div class="chat-actions secondary-actions">
                        <button id="chatHistoryBtn" class="btn btn-sm btn-secondary">
                            <i class="fas fa-history"></i>
                            History
                        </button>
                        <button id="exportChatBtn" class="btn btn-sm btn-secondary">
                            <i class="fas fa-download"></i>
                            Export
                        </button>
                        <button id="mcpServerMgmtBtn" class="btn btn-sm btn-secondary" title="External MCP Servers">
                            <i class="fas fa-server"></i>
                            MCP Servers
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

    // Ensure ChatBox is visible by default
    const chatPanel = document.getElementById('llmChatPanel');
    if (chatPanel) {
      // Check if there's a saved visibility state
      const savedVisibility = this.configManager.get('chat.visible', true);
      chatPanel.style.display = savedVisibility ? 'flex' : 'none';
      console.log('ChatBox created with visibility:', savedVisibility ? 'visible' : 'hidden');
    }

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
        if (!currentPos || currentPos.y < window.innerHeight * 0.3) {
          console.log('Applying bottom-right positioning');
          chatPanel.style.left = freshDefaultPos.x + 'px';
          chatPanel.style.top = freshDefaultPos.y + 'px';
        }
      }

      // Restore dock state from config
      const savedDockState = this.configManager.get('chat.docked', false);
      if (savedDockState) {
        this.dockChat();
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
      chatInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.services.llm.sendMessage();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.browseHistoryUp();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.browseHistoryDown();
        } else if (this.messageHistory.isBrowsing && e.key === 'Escape') {
          // Escape cancels history browsing and restores original content
          e.preventDefault();
          this.cancelHistoryBrowsing();
        }
      });

      sendBtn.addEventListener('click', () => this.services.llm.sendMessage());
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

    document.getElementById('exportChatBtn')?.addEventListener('click', () => {
      this.services.messaging.exportChatHistory();
    });

    document.getElementById('mcpServerMgmtBtn')?.addEventListener('click', () => {
      if (window.genomeBrowser && window.genomeBrowser.showMCPSettingsModal) {
        window.genomeBrowser.showMCPSettingsModal();
      }
    });

    // Multi-Agent System event listeners
    document.getElementById('multiAgentToggleBtn')?.addEventListener('click', () => {
      this.toggleMultiAgentSystem();
    });

    // New button event listeners
    document.getElementById('newChatBtn')?.addEventListener('click', () => {
      this.services.settings.startNewChat();
    });

    document.getElementById('chatHistoryBtn')?.addEventListener('click', () => {
      this.showChatHistoryModal();
    });

    // Reset position button
    document.getElementById('resetChatPositionBtn')?.addEventListener('click', () => {
      this.resetChatPosition();
    });

    // Dock/Undock button
    document.getElementById('dockChatBtn')?.addEventListener('click', () => {
      this.toggleDockState();
    });

    // Context mode toggle
    document.getElementById('contextModeToggle')?.addEventListener('change', e => {
      this.contextModeEnabled = e.target.checked;
      console.log('Context mode changed:', this.contextModeEnabled ? 'Current message only' : 'Full conversation');
    });

    // Welcome example buttons - click to auto-fill and send
    const messagesContainer = document.getElementById('chatMessages');
    if (messagesContainer) {
      messagesContainer.addEventListener('click', e => {
        const exampleBtn = e.target.closest('.welcome-example-btn');
        if (exampleBtn) {
          const prompt = exampleBtn.getAttribute('data-prompt');
          if (prompt) {
            const chatInput = document.getElementById('chatInput');
            if (chatInput) {
              chatInput.value = prompt;
              chatInput.style.height = 'auto';
              chatInput.style.height = chatInput.scrollHeight + 'px';
              this.services.llm.sendMessage();
            }
          }
        }
      });
    }

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
      chatSection.className = 'toolbar-section chat-toggle-section';
      chatSection.innerHTML = `
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
      const isVisible = chatPanel.style.display !== 'none';
      chatPanel.style.display = isVisible ? 'none' : 'flex';

      // Also toggle dock container/splitter if docked
      if (this.isDocked) {
        const dockContainer = document.getElementById('chatDockContainer');
        const dockSplitter = document.getElementById('chatDockSplitter');
        if (dockContainer) dockContainer.style.display = isVisible ? 'none' : 'flex';
        if (dockSplitter) dockSplitter.style.display = isVisible ? 'none' : 'flex';
      }

      // Save visibility state
      this.configManager.set('chat.visible', !isVisible);
      console.log('ChatBox visibility toggled:', isVisible ? 'hidden' : 'visible');
    }
  }

  /**
   * Toggle between docked and floating ChatBox states
   */
  toggleDockState() {
    if (this.isDocked) {
      this.undockChat();
    } else {
      this.dockChat();
    }
  }

  /**
   * Dock the ChatBox to the right side panel
   */
  dockChat() {
    const chatPanel = document.getElementById('llmChatPanel');
    const dockContainer = document.getElementById('chatDockContainer');
    const dockSplitter = document.getElementById('chatDockSplitter');
    const dockBtn = document.getElementById('dockChatBtn');

    if (!chatPanel || !dockContainer || !dockSplitter) return;

    // Save current floating position/size before docking
    this.configManager.set('chat.floatingPosition', {
      x: parseInt(chatPanel.style.left) || 0,
      y: parseInt(chatPanel.style.top) || 0
    });
    this.configManager.set('chat.floatingSize', {
      width: parseInt(chatPanel.style.width) || 400,
      height: parseInt(chatPanel.style.height) || 600
    });

    // If minimized, un-minimize first
    if (chatPanel.classList.contains('minimized')) {
      chatPanel.classList.remove('minimized');
    }

    // Move chat panel into dock container
    dockContainer.appendChild(chatPanel);

    // Add docked class and show container/splitter
    chatPanel.classList.add('docked');
    dockContainer.style.display = 'flex';
    dockSplitter.style.display = 'flex';

    // Ensure chat panel is visible
    chatPanel.style.display = 'flex';

    // Restore saved dock width
    const savedDockWidth = this.configManager.get('chat.dockWidth', 400);
    dockContainer.style.width = savedDockWidth + 'px';

    // Update button icon and title
    if (dockBtn) {
      dockBtn.title = 'Undock to floating window';
      dockBtn.innerHTML = '<i class="fas fa-window-restore"></i>';
    }

    // Hide the reset position button when docked (not meaningful)
    const resetBtn = document.getElementById('resetChatPositionBtn');
    if (resetBtn) resetBtn.style.display = 'none';

    this.isDocked = true;
    this.configManager.set('chat.docked', true);

    // Hide any dock indicator
    this.hideDockIndicator();

    // Setup dock splitter dragging
    this.setupDockSplitterDragging();

    console.log('ChatBox docked to right panel');
  }

  /**
   * Undock the ChatBox back to floating mode
   */
  undockChat() {
    const chatPanel = document.getElementById('llmChatPanel');
    const dockContainer = document.getElementById('chatDockContainer');
    const dockSplitter = document.getElementById('chatDockSplitter');
    const dockBtn = document.getElementById('dockChatBtn');
    const appDiv = document.getElementById('app');

    if (!chatPanel || !dockContainer || !dockSplitter || !appDiv) return;

    // Save dock width for next time
    this.configManager.set('chat.dockWidth', parseInt(dockContainer.style.width) || 400);

    // Move chat panel back to app root
    appDiv.appendChild(chatPanel);

    // Remove docked class and hide container/splitter
    chatPanel.classList.remove('docked');
    dockContainer.style.display = 'none';
    dockSplitter.style.display = 'none';

    // Restore floating position and size
    const savedPos = this.configManager.get('chat.floatingPosition', this.getDefaultChatPosition());
    const savedSize = this.configManager.get('chat.floatingSize', { width: 400, height: 600 });

    chatPanel.style.left = savedPos.x + 'px';
    chatPanel.style.top = savedPos.y + 'px';
    chatPanel.style.width = savedSize.width + 'px';
    chatPanel.style.height = savedSize.height + 'px';

    // Ensure visibility
    chatPanel.style.display = 'flex';

    // Update button icon and title
    if (dockBtn) {
      dockBtn.title = 'Dock to right side';
      dockBtn.innerHTML = '<i class="fas fa-columns"></i>';
    }

    // Show the reset position button again
    const resetBtn = document.getElementById('resetChatPositionBtn');
    if (resetBtn) resetBtn.style.display = '';

    this.isDocked = false;
    this.configManager.set('chat.docked', false);

    // Hide any undock indicator
    this.hideUndockIndicator();

    console.log('ChatBox undocked to floating mode');
  }

  /**
   * Setup dock splitter dragging for resizable dock width
   */
  setupDockSplitterDragging() {
    const splitter = document.getElementById('chatDockSplitter');
    const dockContainer = document.getElementById('chatDockContainer');
    const mainContent = document.querySelector('.main-content');

    if (!splitter || !dockContainer || !mainContent) return;

    // Remove any existing listeners (in case called multiple times)
    const newSplitter = splitter.cloneNode(true);
    splitter.parentNode.replaceChild(newSplitter, splitter);

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    const onMouseDown = (e) => {
      if (e.button !== 0) return;
      isResizing = true;
      startX = e.clientX;
      startWidth = parseInt(dockContainer.style.width) || dockContainer.offsetWidth;

      newSplitter.classList.add('resizing');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      e.preventDefault();
    };

    const onMouseMove = (e) => {
      if (!isResizing) return;

      const deltaX = startX - e.clientX; // dragging left increases width
      let newWidth = startWidth + deltaX;

      // Enforce min/max
      const maxWidth = mainContent.offsetWidth * 0.5;
      newWidth = Math.max(280, Math.min(maxWidth, newWidth));

      dockContainer.style.width = newWidth + 'px';
    };

    const onMouseUp = () => {
      if (!isResizing) return;
      isResizing = false;

      newSplitter.classList.remove('resizing');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      // Save the new width
      const finalWidth = parseInt(dockContainer.style.width) || 400;
      this.configManager.set('chat.dockWidth', finalWidth);
    };

    newSplitter.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  /**
   * Force show the ChatBox interface
   */
  showChatBox() {
    const chatPanel = document.getElementById('llmChatPanel');
    if (chatPanel) {
      chatPanel.style.display = 'flex';
      this.configManager.set('chat.visible', true);
      console.log('ChatBox forced to visible');
    }
  }

  /**
   * Hide the ChatBox interface
   */
  hideChatBox() {
    const chatPanel = document.getElementById('llmChatPanel');
    if (chatPanel) {
      chatPanel.style.display = 'none';
      this.configManager.set('chat.visible', false);
      console.log('ChatBox hidden');
    }
  }

  toggleChatMinimize() {
    const chatPanel = document.getElementById('llmChatPanel');
    const minimizeBtn = document.getElementById('minimizeChatBtn');

    if (chatPanel) {
      const isMinimized = chatPanel.classList.contains('minimized');
      const icon = minimizeBtn ? minimizeBtn.querySelector('i') : null;

      if (!isMinimized) {
        // Minimizing: just add class to shrink height, leave position alone
        chatPanel.classList.add('minimized');

        if (icon) {
          icon.className = 'fas fa-window-maximize';
          minimizeBtn.title = 'Expand window';
        }
      } else {
        // Expanding: restore original height
        chatPanel.classList.remove('minimized');

        if (icon) {
          icon.className = 'fas fa-minus';
          minimizeBtn.title = 'Minimize window';
        }
      }

      // When minimizing/expanding, don't save position to avoid conflicts
      // Only save the minimized state preference if needed
    }
  }





  formatToolResult(toolName, parameters, result) {
    if (!this.services || !this.services.context) {
      console.error('[ChatManager] context not initialized');
      return;
    }
    return this.services.context.formatToolResult(toolName, parameters, result);
  }



  /**
   * Get system prompt section configuration from ChatBox settings
   * @returns {object} Section config with toggles and order
   */
  getSystemPromptSectionConfig() {
    const defaultOrder = [
      'systemInstructions', 'currentContext', 'dynamicTools', 'toolExamples',
      'toolGuidelines', 'responseFormat', 'toolCategories', 'memoryContext',
    ];
    const defaultToggles = {
      systemInstructions: true, currentContext: true, dynamicTools: true,
      toolExamples: true, toolGuidelines: true, responseFormat: true,
      toolCategories: true, memoryContext: true,
    };

    const order = this.configManager.get('chatboxSettings.systemPromptSectionOrder', defaultOrder);
    const toggles = {};
    for (const key of defaultOrder) {
      const settingKey = `chatboxSettings.systemPromptInclude${key.charAt(0).toUpperCase() + key.slice(1)}`;
      toggles[key] = this.configManager.get(settingKey, true);
    }

    return { order, toggles };
  }


  /**
   * Parse a system prompt into sections by markdown headers
   * @param {string} prompt - The system prompt to parse
   * @returns {object} Map of header -> content
   */
  parseSystemPromptSections(prompt) {
    const sections = {};
    const lines = prompt.split('\n');
    let currentHeader = null;
    let currentContent = [];

    for (const line of lines) {
      if (line.startsWith('## ')) {
        // Save previous section
        if (currentHeader !== null) {
          sections[currentHeader] = currentContent.join('\n').trim();
        } else if (currentContent.length > 0) {
          // Content before any ## header is the preamble (system instructions / role definition)
          sections['_preamble'] = currentContent.join('\n').trim();
        }
        currentHeader = line.replace(/^##\s+/, '').trim();
        currentContent = [line];
      } else if (currentHeader !== null) {
        currentContent.push(line);
      } else {
        // Content before any header - treat as preamble
        currentContent.push(line);
      }
    }

    // Save last section
    if (currentHeader !== null) {
      sections[currentHeader] = currentContent.join('\n').trim();
    } else if (currentContent.length > 0) {
      // No headers found, treat entire prompt as one section
      sections['_preamble'] = currentContent.join('\n').trim();
    }

    return sections;
  }

  /**
   * Map a section key (from config) to content from parsed sections
   * @param {string} sectionKey - Section key from configuration
   * @param {object} sections - Parsed sections map
   * @returns {string|null} - Content for this section
   */
  mapSectionKeyToContent(sectionKey, sections) {
    const headerMappings = {
      systemInstructions: ['CodeXomics', 'Enhanced Dynamic Tools System', 'Comprehensive Tools System'],
      currentContext: ['Current Context', '🧬 Current Context'],
      dynamicTools: ['Directly Available Tools', '🔧 Directly Available Tools', '🔧 Directly Available Tools (Built-in)', 'Built-in Tools'],
      toolExamples: ['Tool Usage Examples', '📚 Tool Usage Examples'],
      toolGuidelines: ['Tool Selection Guidelines', '🎯 Enhanced Tool Selection Guidelines', 'Tool Usage Guidelines'],
      responseFormat: ['Response Format', '⚡ Response Format'],
      toolCategories: ['Tool Categories', '🔄 Tool Categories', 'Tool Categories & Relationships', '🔄 Tool Categories & Relationships'],
    };

    // For systemInstructions, combine _preamble (role definition) with any matched header content
    if (sectionKey === 'systemInstructions') {
      const parts = [];
      if (sections['_preamble']) {
        parts.push(sections['_preamble']);
      }
      const possibleHeaders = headerMappings[sectionKey] || [];
      for (const header of possibleHeaders) {
        if (sections[header]) {
          parts.push(sections[header]);
        }
      }
      return parts.length > 0 ? parts.join('\n\n') : null;
    }

    const possibleHeaders = headerMappings[sectionKey] || [];

    // For dynamicTools, combine Built-in + Extended tools sections + Plugin tools
    if (sectionKey === 'dynamicTools') {
      const toolParts = [];
      // Collect all built-in tool sections
      for (const header of possibleHeaders) {
        if (sections[header]) {
          toolParts.push(sections[header]);
        }
      }
      // Also collect Extended Tools and Plugin sections
      for (const [header, content] of Object.entries(sections)) {
        if (header.includes('Extended Tools') || header.includes('🌐 Extended Tools')) {
          toolParts.push(content);
        }
      }
      if (toolParts.length > 0) {
        return toolParts.join('\n\n');
      }
    }

    for (const header of possibleHeaders) {
      if (sections[header]) {
        return sections[header];
      }
    }

    return null;
  }

  /**
   * Map a header text back to a section key
   * @param {string} header - Header text
   * @returns {string|null} - Section key or null
   */
  mapHeaderToSectionKey(header) {
    const normalizedHeader = header.toLowerCase().replace(/[^\w\s]/g, '').trim();
    if (normalizedHeader.includes('context')) return 'currentContext';
    if (normalizedHeader.includes('built-in') || normalizedHeader.includes('directly available') || normalizedHeader.includes('extended tools')) return 'dynamicTools';
    if (normalizedHeader.includes('example')) return 'toolExamples';
    if (normalizedHeader.includes('guideline') || normalizedHeader.includes('selection')) return 'toolGuidelines';
    if (normalizedHeader.includes('response format')) return 'responseFormat';
    if (normalizedHeader.includes('categor') || normalizedHeader.includes('relationship')) return 'toolCategories';
    if (normalizedHeader.includes('memory')) return 'memoryContext';
    return 'systemInstructions'; // Default to system instructions
  }

  /**
   * Retrieve memory context for the current user query
   * @param {string} userQuery - Current user query for context matching
   * @returns {Promise<string|null>} - Formatted memory context or null if no relevant memories
   */
  async getMemoryContext(userQuery) {
    try {
      // Check if memory system is available and enabled
      if (!this.memorySystem || !this.configManager.get('chatboxSettings.memorySystemEnabled', false)) {
        return null;
      }

      // Check if ChatBox memory system is enabled (separate from Multi-Agent)
      const memorySystemEnabled = this.configManager.get('chatboxSettings.memorySystemEnabled', false);
      if (!memorySystemEnabled) {
        return null;
      }

      console.log('🧠 [getMemoryContext] Retrieving memory context for query:', userQuery);

      // Infer task type and prepare context for memory search
      const taskType = this.inferTaskType(userQuery);
      const context = {
        userQuery: userQuery,
        currentTime: new Date().toISOString(),
        sessionId: this.getSessionId(),
        taskType: taskType,
      };

      // Call memory system to search for relevant context
      // For general chat context, we use "chat_context" as function name
      const memoryContext = await this.memorySystem.retrieveMemoryContext('chat_context', context, context);

      if (!memoryContext || !memoryContext.results || memoryContext.results.length === 0) {
        console.log('🧠 [getMemoryContext] No relevant memories found for query');
        return null;
      }

      // Format memory context for LLM
      const formattedContext = this.formatMemoryContextForLLM(memoryContext);
      console.log('🧠 [getMemoryContext] Retrieved memory context:', formattedContext);

      return formattedContext;
    } catch (error) {
      console.warn('🧠 [getMemoryContext] Failed to retrieve memory context:', error);
      return null; // Don't fail the entire system message building process
    }
  }

  /**
   * Format memory context for LLM consumption
   * @param {object} memoryContext - Raw memory context from MemorySystem
   * @returns {string} - Formatted memory context
   */
  formatMemoryContextForLLM(memoryContext) {
    if (!memoryContext || !memoryContext.results || memoryContext.results.length === 0) {
      return '';
    }

    let formatted = '';
    const results = memoryContext.results.slice(0, 5); // Limit to top 5 most relevant

    for (const result of results) {
      // Format each memory entry
      let memoryText = `• ${result.concept || 'Relevant previous action'}`;

      // Add relevance score if available
      if (result.score !== undefined) {
        memoryText += ` (relevance: ${(result.score * 100).toFixed(1)}%)`;
      }

      // Add properties if available
      if (result.properties) {
        if (result.properties.usage_count) {
          memoryText += ` - used ${result.properties.usage_count} times`;
        }

        if (result.properties.success_rate !== undefined) {
          memoryText += ` (${Math.round(result.properties.success_rate * 100)}% success rate)`;
        }

        if (result.properties.type) {
          memoryText += ` - type: ${result.properties.type}`;
        }

        if (result.properties.category) {
          memoryText += ` - category: ${result.properties.category}`;
        }
      }

      formatted += memoryText + '\n';
    }

    if (formatted) {
      return `Based on previous similar queries, here are relevant patterns:\n${formatted.trim()}`;
    }

    return '';
  }

  /**
   * Infer task type from user query for better memory retrieval
   * @param {string} userQuery - User query to analyze
   * @returns {string} - Inferred task type
   */
  inferTaskType(userQuery) {
    if (!userQuery) return 'general';

    const query = userQuery.toLowerCase();

    // Gene analysis patterns
    if (query.includes('gene') || query.includes('sequence') || query.includes('protein')) {
      return 'gene_analysis';
    }

    // Search patterns
    if (query.includes('search') || query.includes('find') || query.includes('lookup')) {
      return 'search';
    }

    // Analysis patterns
    if (query.includes('analyze') || query.includes('analysis') || query.includes('compare')) {
      return 'analysis';
    }

    // Navigation patterns
    if (query.includes('navigate') || query.includes('zoom') || query.includes('goto')) {
      return 'navigation';
    }

    // Data retrieval patterns
    if (query.includes('download') || query.includes('get') || query.includes('fetch')) {
      return 'data_retrieval';
    }

    return 'general';
  }

  /**
   * Get current session ID for memory correlation
   * @returns {string} - Session identifier
   */
  getSessionId() {
    return this.sessionId || `session_${Date.now()}`;
  }

  /**
   * Process variables in user-defined system prompts
   * Supports variables like {genome_info}, {current_state}, etc.
   */
  processSystemPromptVariables(systemPrompt) {
    const context = this.services.llm.getCurrentContext();

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
      time: new Date().toLocaleTimeString(),
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
    if (!this.services || !this.services.context) {
      console.error('[ChatManager] context not initialized');
      return;
    }
    return this.services.context.checkTaskCompletion(response);
  }

  /**
   * Determine if we should terminate early after successful tool execution
   * This helps prevent infinite loops for simple tasks like gene searches
   */
  shouldTerminateAfterToolExecution(toolsToExecute, successfulResults, originalMessage) {
    if (!this.services || !this.services.context) {
      console.error('[ChatManager] context not initialized');
      return;
    }
    return this.services.context.shouldTerminateAfterToolExecution(toolsToExecute, successfulResults, originalMessage);
  }

  /**
   * Intelligent tool execution policy - determines if a tool should be re-executed
   * This replaces the simple re-executable sets with sophisticated logic
   */
  shouldAllowToolExecution(tool, conversationHistory, currentRound, toolResults = []) {
    if (!this.services || !this.services.context) {
      console.error('[ChatManager] context not initialized');
      return;
    }
    return this.services.context.shouldAllowToolExecution(tool, conversationHistory, currentRound, toolResults);
  }

  /**
   * Check if a tool with specific parameters was executed successfully in conversation history
   */
  wasToolExecutedSuccessfully(toolKey, conversationHistory) {
    // Look for system messages indicating successful execution
    for (const msg of conversationHistory) {
      if (msg.role === 'system' && msg.content && msg.content.includes('executed successfully')) {
        // Extract tool name and check if it matches
        const toolName = toolKey.split(':')[0];
        if (msg.content.includes(`${toolName} executed successfully`)) {
          console.log(`🔍 Found successful execution record for: ${toolName}`);
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Find recent execution of a tool within a time window
   */
  findRecentExecution(toolName, conversationHistory, timeWindowMs = 5000) {
    const now = Date.now();

    // Look through conversation history for recent executions
    for (let i = conversationHistory.length - 1; i >= 0; i--) {
      const msg = conversationHistory[i];

      // Check system messages for successful executions
      if (msg.role === 'system' && msg.content) {
        if (msg.content.includes(`${toolName} executed successfully`)) {
          // Estimate message timestamp (conversations are usually recent)
          const estimatedTimestamp = now - (conversationHistory.length - 1 - i) * 1000;

          if (now - estimatedTimestamp < timeWindowMs) {
            console.log(`🔍 Found recent execution of ${toolName} within ${timeWindowMs}ms window`);
            return {
              toolName,
              timestamp: estimatedTimestamp,
              messageIndex: i,
            };
          }
        }
      }

      // Check assistant messages for tool calls
      if (msg.role === 'assistant' && msg.content) {
        try {
          // Try to parse as single tool call
          const parsed = JSON.parse(msg.content);
          if (parsed.tool_name === toolName) {
            const estimatedTimestamp = now - (conversationHistory.length - 1 - i) * 1000;

            if (now - estimatedTimestamp < timeWindowMs) {
              console.log(`🔍 Found recent tool call of ${toolName} within ${timeWindowMs}ms window`);
              return {
                toolName,
                timestamp: estimatedTimestamp,
                messageIndex: i,
                parameters: parsed.parameters,
              };
            }
          }
        } catch (e) {
          // Try to parse as multiple tool calls
          try {
            const multipleToolCalls = this.parseMultipleToolCalls(msg.content);
            const matchingTool = multipleToolCalls.find(t => t.tool_name === toolName);
            if (matchingTool) {
              const estimatedTimestamp = now - (conversationHistory.length - 1 - i) * 1000;

              if (now - estimatedTimestamp < timeWindowMs) {
                return {
                  toolName,
                  timestamp: estimatedTimestamp,
                  messageIndex: i,
                  parameters: matchingTool.parameters,
                };
              }
            }
          } catch (e2) {
            // Not a tool call, continue
          }
        }
      }
    }

    return null;
  }

  /**
   * Find existing execution of a tool with specific parameters
   */
  findExistingExecution(toolKey, conversationHistory) {
    const toolName = toolKey.split(':')[0];
    for (const msg of conversationHistory) {
      if (msg.role === 'system' && msg.content && msg.content.includes(`${toolName} executed`)) {
        return {
          success: msg.content.includes('successfully'),
          timestamp: new Date().toISOString(), // Approximate
        };
      }
    }
    return null;
  }

  /**
   * Analyze protein domains using InterPro database
   */
  async analyzeInterProDomains(parameters) {
    if (!this.services || !this.services.protein) {
      console.error('[ChatManager] protein not initialized');
      return;
    }
    return await this.services.protein.analyzeInterProDomains(parameters);
  }

  /**
   * Search InterPro database for entries
   */
  async searchInterProEntry(parameters) {
    const {
      search_term,
      search_terms,
      search_type = 'all',
      entry_type = 'all',
      database_source = [],
      max_results = 50,
      include_statistics = true,
    } = parameters;

    console.log('🔍 [ChatManager] Searching InterPro entries:', {
      search_term,
      search_terms,
      search_type,
      entry_type,
    });

    try {
      // Try MCP server first
      if (this.mcpServerManager) {
        const mcpTools = this.mcpServerManager.getAllAvailableTools();
        const mcpTool = mcpTools.find(t => t.name === 'search_interpro_entry');

        if (mcpTool) {
          try {
            return await this.mcpServerManager.executeToolOnServer(
              mcpTool.serverId,
              'search_interpro_entry',
              parameters
            );
          } catch (mcpError) {
            console.warn('🔄 [ChatManager] MCP execution failed, using fallback:', mcpError.message);
          }
        }
      }

      // Fallback implementation
      const terms = search_terms || [search_term];
      const mockEntries = terms.flatMap(term => [
        {
          accession: 'IPR000719',
          name: `${term} domain`,
          type: 'Domain',
          description: `Protein kinase domain related to ${term}`,
          member_databases: ['Pfam', 'SMART'],
          protein_count: 15000,
        },
      ]);

      return {
        success: true,
        tool: 'search_interpro_entry',
        timestamp: new Date().toISOString(),
        results_count: mockEntries.length,
        entries: mockEntries,
        search_parameters: { search_term, search_type, entry_type },
        message: `Found ${mockEntries.length} InterPro entries`,
        note: 'This is a demonstration result. Real implementation would connect to InterPro API.',
      };
    } catch (error) {
      console.error('❌ [ChatManager] InterPro entry search failed:', error);
      return {
        success: false,
        tool: 'search_interpro_entry',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get detailed information for an InterPro entry
   */
  async getInterProEntryDetails(parameters) {
    const {
      interpro_id,
      entry_name,
      include_proteins = true,
      include_structures = true,
      output_format = 'detailed',
    } = parameters;

    console.log('📖 [ChatManager] Getting InterPro entry details:', {
      interpro_id,
      entry_name,
    });

    try {
      // Try MCP server first
      if (this.mcpServerManager) {
        const mcpTools = this.mcpServerManager.getAllAvailableTools();
        const mcpTool = mcpTools.find(t => t.name === 'get_interpro_entry_details');

        if (mcpTool) {
          try {
            return await this.mcpServerManager.executeToolOnServer(
              mcpTool.serverId,
              'get_interpro_entry_details',
              parameters
            );
          } catch (mcpError) {
            console.warn('🔄 [ChatManager] MCP execution failed, using fallback:', mcpError.message);
          }
        }
      }

      // Fallback implementation
      const entryId = interpro_id || 'IPR000719';
      const entryNameStr = entry_name || 'Protein kinase domain';

      return {
        success: true,
        tool: 'get_interpro_entry_details',
        timestamp: new Date().toISOString(),
        entry_info: {
          accession: entryId,
          name: entryNameStr,
          type: 'Domain',
          description: 'Serine/threonine/tyrosine protein kinase catalytic domain',
        },
        member_databases: ['Pfam', 'SMART', 'PROSITE'],
        protein_matches: include_proteins
          ? [
            { uniprot_id: 'P12345', name: 'Example protein 1', organism: 'Homo sapiens' },
            { uniprot_id: 'P67890', name: 'Example protein 2', organism: 'Mus musculus' },
          ]
          : [],
        statistics: {
          protein_count: 15000,
          organism_count: 500,
        },
        message: `Retrieved details for ${entryNameStr}`,
        note: 'This is a demonstration result. Real implementation would connect to InterPro API.',
      };
    } catch (error) {
      console.error('❌ [ChatManager] InterPro entry details retrieval failed:', error);
      return {
        success: false,
        tool: 'get_interpro_entry_details',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Advanced UniProt search with multiple filters
   */
  async advancedUniProtSearch(parameters) {
    const {
      query_fields,
      boolean_operator = 'AND',
      filters = {},
      max_results = 100,
      sort_by = 'relevance',
    } = parameters;

    console.log('🔍 [ChatManager] Advanced UniProt search:', {
      query_fields,
      boolean_operator,
      filters,
    });

    try {
      // Try MCP server first
      if (this.mcpServerManager) {
        const mcpTools = this.mcpServerManager.getAllAvailableTools();
        const mcpTool = mcpTools.find(t => t.name === 'advanced_uniprot_search');

        if (mcpTool) {
          try {
            return await this.mcpServerManager.executeToolOnServer(
              mcpTool.serverId,
              'advanced_uniprot_search',
              parameters
            );
          } catch (mcpError) {
            console.warn('🔄 [ChatManager] MCP execution failed, using fallback:', mcpError.message);
          }
        }
      }

      // Fallback implementation
      const mockEntries = [
        {
          uniprot_id: 'P04637',
          protein_name: query_fields.protein_name || 'Example protein',
          organism: query_fields.organism || 'Homo sapiens',
          length: 393,
          reviewed: true,
        },
      ];

      return {
        success: true,
        tool: 'advanced_uniprot_search',
        timestamp: new Date().toISOString(),
        results_count: mockEntries.length,
        entries: mockEntries,
        reviewed_count: 1,
        unreviewed_count: 0,
        search_summary: { query_fields, boolean_operator, filters },
        message: `Found ${mockEntries.length} UniProt entries`,
        note: 'This is a demonstration result. Real implementation would connect to UniProt API.',
      };
    } catch (error) {
      console.error('❌ [ChatManager] Advanced UniProt search failed:', error);
      return {
        success: false,
        tool: 'advanced_uniprot_search',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get detailed UniProt entry information
   */
  async getUniProtEntry(parameters) {
    const {
      uniprot_id,
      geneName,
      organism = null, // No default organism - will be 'Homo sapiens' only for gene searches
      include_sequence = true,
      include_features = true,
      include_function = true,
      format = 'detailed',
    } = parameters;

    console.log('📖 [ChatManager] Getting UniProt entry:', {
      uniprot_id,
      geneName,
      organism,
    });

    try {
      // Try MCP server first
      if (this.mcpServerManager) {
        const mcpTools = this.mcpServerManager.getAllAvailableTools();
        const mcpTool = mcpTools.find(t => t.name === 'get_uniprot_entry');

        if (mcpTool) {
          try {
            return await this.mcpServerManager.executeToolOnServer(mcpTool.serverId, 'get_uniprot_entry', parameters);
          } catch (mcpError) {
            console.warn('🔄 [ChatManager] MCP execution failed, using fallback:', mcpError.message);
          }
        }
      }

      // Fallback implementation
      const entryId = uniprot_id || 'P04637';
      const gene = geneName || 'TP53';
      const displayOrganism = organism || (geneName ? 'Homo sapiens' : 'Not specified');

      const result = {
        success: true,
        tool: 'get_uniprot_entry',
        timestamp: new Date().toISOString(),
        entry_info: {
          uniprot_id: entryId,
          protein_name: `${gene} protein`,
          organism: displayOrganism,
          status: 'reviewed',
        },
        sequence_length: 393,
        message: `Retrieved UniProt entry for ${gene}`,
        note: 'This is a demonstration result. Real implementation would connect to UniProt API.',
      };

      if (include_sequence) {
        result.protein_sequence = 'MEEPQSDPSVEPPLSQETFSDLWKLLPENNVLSPLPSQAMDDLMLSPDDIEQWFTEDPGP...';
      }

      if (include_features) {
        result.features = [
          { type: 'Domain', description: 'DNA-binding', start: 102, end: 292 },
          { type: 'Region', description: 'Transactivation', start: 1, end: 61 },
        ];
      }

      if (include_function) {
        result.function = {
          description: 'Tumor suppressor protein',
          go_terms: ['GO:0006355', 'GO:0045786'],
        };
      }

      return result;
    } catch (error) {
      console.error('❌ [ChatManager] UniProt entry retrieval failed:', error);
      return {
        success: false,
        tool: 'get_uniprot_entry',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Generate a completion response based on tool execution results
   */
  generateCompletionResponseFromToolResults(successfulResults, toolsToExecute) {
    if (successfulResults.length === 0) {
      return 'Task completed but no results were obtained.';
    }

    // Handle multiple tools - combine results
    if (successfulResults.length > 1) {
      console.log(`📋 [generateCompletionResponseFromToolResults] Processing ${successfulResults.length} tools`);

      let combinedResponse = '';
      const processedResults = [];

      // Process each tool result individually
      for (let i = 0; i < successfulResults.length; i++) {
        const tool = toolsToExecute[i];
        const result = successfulResults[i];

        console.log(`🔧 [generateCompletionResponseFromToolResults] Processing tool ${i + 1}: ${tool.tool_name}`);

        const singleToolResponse = this.generateSingleToolResponse(tool, result);
        if (singleToolResponse) {
          processedResults.push({
            tool: tool.tool_name,
            response: singleToolResponse,
          });
        }
      }

      // Combine all responses
      if (processedResults.length > 0) {
        combinedResponse = processedResults.map(r => r.response).join('\n\n---\n\n');
        return combinedResponse;
      }
    }

    // Handle single tool (original logic)
    const tool = toolsToExecute[0];
    const result = successfulResults[0];

    return this.generateSingleToolResponse(tool, result) || 'Task completed successfully.';
  }

  /**
   * Generate response for a single tool execution
   */
  generateSingleToolResponse(tool, result) {
    if (!this.services || !this.services.context) {
      console.error('[ChatManager] context not initialized');
      return;
    }
    return this.services.context.generateSingleToolResponse(tool, result);
  }

  /**
   * Get execution data for benchmark integration
   * Returns the function calls and tool results from the last LLM interaction
   */
  getLastExecutionData() {
    return this.lastExecutionData || null;
  }

  /**
   * Clear execution data (for memory management)
   */
  clearExecutionData() {
    this.lastExecutionData = null;
  }

  /**
   * Test function call parsing with sample LLM response
   * This method helps debug function call extraction issues
   */
  testFunctionCallParsing() {
    // Sample LLM response from user
    const sampleResponse = `<think>
Okay, the user wants to search for the gene lacZ. Let me check the available tools. The relevant function here is find_gene_by_name, which is under the SEARCH & NAVIGATION category. The parameters needed are the name of the gene. Since the user specified "lacZ", I should use that as the parameter. I need to make sure the tool call is correctly formatted in JSON. Also, according to the priority, local tools are first, so this should be okay. No other parameters are needed, just the gene name. Let me structure the JSON accordingly.
</think>

{"tool_name": "find_gene_by_name", "parameters": {"name": "lacZ"}}`;

    console.log('🧪 Testing function call parsing with sample response...');
    console.log('Sample response:', sampleResponse);

    // Test parseToolCall
    const parsedToolCall = this.parseToolCall(sampleResponse);
    console.log('Parsed tool call:', parsedToolCall);

    // Test displayLLMThinking
    console.log('Testing thinking display...');
    this.services.thinking.displayLLMThinking(sampleResponse);

    // Expected result
    const expectedResult = {
      tool_name: 'find_gene_by_name',
      parameters: { name: 'lacZ' },
    };

    // Verify result
    if (
      parsedToolCall &&
      parsedToolCall.tool_name === expectedResult.tool_name &&
      JSON.stringify(parsedToolCall.parameters) === JSON.stringify(expectedResult.parameters)
    ) {
      console.log('✅ Function call parsing test PASSED');
      return true;
    } else {
      console.log('❌ Function call parsing test FAILED');
      console.log('Expected:', expectedResult);
      console.log('Got:', parsedToolCall);
      return false;
    }
  }

  /**
   * Store for active tasks being polled
   */
  activeTasks = new Map();

  /**
   * Start polling for task status updates
   */
  startTaskPolling(taskInfo) {
    // Add task to active tasks map
    this.activeTasks.set(taskInfo.taskId, taskInfo);

    // Start the polling interval
    const pollInterval = setInterval(async () => {
      await this.checkTaskStatus(taskInfo);
    }, 5000); // Check every 5 seconds

    // Store the interval ID for cleanup
    taskInfo.pollInterval = pollInterval;

    console.log(`🔄 Started polling for task ${taskInfo.taskId} with 5-second interval`);
  }

  /**
   * Check task status and update the message
   */
  async checkTaskStatus(taskInfo) {
    try {
      // Get the latest status from the server
      const statusResult = await this.mcpServerManager.checkTaskStatus(taskInfo.serverId, taskInfo.taskId);

      console.log(`📊 Task ${taskInfo.taskId} status:`, statusResult);

      // Update task info
      const oldStatus = taskInfo.status;
      taskInfo.status = statusResult.status || taskInfo.status;
      taskInfo.lastUpdated = new Date().toISOString();
      taskInfo.progress = statusResult.progress || taskInfo.progress;
      taskInfo.currentStep = statusResult.currentStep || taskInfo.currentStep;
      taskInfo.totalSteps = statusResult.totalSteps || taskInfo.totalSteps;
      taskInfo.error = statusResult.error || null;

      // If status has changed or we have new progress info, update the message
      if (oldStatus !== taskInfo.status || statusResult.progress || statusResult.currentStep || statusResult.error) {
        // Update the chat message
        this.updateTaskMessage(taskInfo, statusResult);

        // If task is completed or failed, stop polling
        if (taskInfo.status === 'completed' || taskInfo.status === 'failed') {
          this.stopTaskPolling(taskInfo.taskId);

          // If completed, get the final results
          if (taskInfo.status === 'completed') {
            await this.getFinalTaskResults(taskInfo);
          }
        }
      }
    } catch (error) {
      console.error(`❌ Error checking status for task ${taskInfo.taskId}:`, error);

      // Update message with error
      taskInfo.status = 'error';
      taskInfo.error = error.message;
      this.updateTaskMessage(taskInfo, {
        status: 'error',
        error: error.message,
      });

      // Stop polling on error
      this.stopTaskPolling(taskInfo.taskId);
    }
  }

  /**
   * Update the chat message with current task status
   */
  updateTaskMessage(taskInfo, statusResult) {
    // Find the message element containing the task ID
    if (!taskInfo.messageElement) {
      // First time, find the message element
      const chatMessages = document.querySelectorAll('.chat-message');
      for (const message of chatMessages) {
        if (message.textContent.includes(taskInfo.taskId)) {
          taskInfo.messageElement = message;
          break;
        }
      }
    }

    if (!taskInfo.messageElement) {
      console.warn(`⚠️ Could not find message element for task ${taskInfo.taskId}`);
      return;
    }

    // Create updated message content
    let updatedContent = `✅ **Deep Gene Research Task - ${taskInfo.status.toUpperCase()}**\n\n`;
    updatedContent += `📋 **Task ID**: ${taskInfo.taskId}\n`;
    updatedContent += `📊 **Status**: ${taskInfo.status}\n`;
    updatedContent += `⏱️ **Created**: ${new Date(taskInfo.createdAt).toLocaleString()}\n`;
    updatedContent += `🔄 **Last Updated**: ${new Date(taskInfo.lastUpdated).toLocaleString()}\n\n`;

    // Add progress information if available
    if (taskInfo.progress || taskInfo.currentStep) {
      updatedContent += `📈 **Progress**: ${taskInfo.progress || 'N/A'}%\n`;
      if (taskInfo.currentStep && taskInfo.totalSteps) {
        updatedContent += `🔢 **Step**: ${taskInfo.currentStep}/${taskInfo.totalSteps}\n`;
      } else if (taskInfo.currentStep) {
        updatedContent += `🔢 **Current Step**: ${taskInfo.currentStep}\n`;
      }
      updatedContent += `\n`;
    }

    // Add current step details if available
    if (statusResult.currentStepInfo) {
      updatedContent += `📝 **Current Activity**: ${statusResult.currentStepInfo}\n\n`;
    }

    // Add error message if any
    if (taskInfo.error) {
      updatedContent += `❌ **Error**: ${taskInfo.error}\n\n`;
    }

    // Add final status messages
    if (taskInfo.status === 'completed') {
      updatedContent += `🎉 Research completed successfully! Final results will be available shortly...\n\n`;
    } else if (taskInfo.status === 'failed') {
      updatedContent += `❌ Research failed. Please check the error message above.\n\n`;
    } else {
      updatedContent += `🔄 The system will continue to update this message as the research progresses...\n\n`;
    }

    // Update the message content
    const messageContent = taskInfo.messageElement.querySelector('.message-content');
    if (messageContent) {
      // Use markdown to render the updated content
      messageContent.innerHTML = this.renderMarkdown(updatedContent);
    }

    console.log(`📝 Updated message for task ${taskInfo.taskId} with status: ${taskInfo.status}`);
  }

  /**
   * Get final task results and update the message
   */
  async getFinalTaskResults(taskInfo) {
    try {
      console.log(`📥 Getting final results for task ${taskInfo.taskId}`);

      // Get the final results from the server
      const result = await this.mcpServerManager.getTaskResult(taskInfo.serverId, taskInfo.taskId);

      console.log(`✅ Got final results for task ${taskInfo.taskId}:`, result);

      // Find the message element
      if (!taskInfo.messageElement) {
        console.warn(`⚠️ Could not find message element for task ${taskInfo.taskId}`);
        return;
      }

      // Create final message content
      let finalContent = `✅ **Deep Gene Research Task - COMPLETED**\n\n`;
      finalContent += `📋 **Task ID**: ${taskInfo.taskId}\n`;
      finalContent += `📊 **Status**: ${taskInfo.status}\n`;
      finalContent += `⏱️ **Created**: ${new Date(taskInfo.createdAt).toLocaleString()}\n`;
      finalContent += `🔄 **Last Updated**: ${new Date(taskInfo.lastUpdated).toLocaleString()}\n\n`;

      // Add results information
      finalContent += `📚 **Research Results**\n\n`;

      if (result.summary || result.message) {
        finalContent += `${result.summary || result.message}\n\n`;
      } else if (result.result && typeof result.result === 'object') {
        // Try to format the results
        try {
          const resultString = JSON.stringify(result.result, null, 2);
          finalContent += `**Full Results**:\n\`\`\`json\n${resultString}\n\`\`\`\n\n`;
        } catch (e) {
          finalContent += `Results obtained but could not be formatted.\n\n`;
        }
      }

      // Add download links if available
      if (result.downloadLinks) {
        finalContent += `📥 **Download Reports**\n\n`;
        for (const [format, link] of Object.entries(result.downloadLinks)) {
          finalContent += `- [${format.toUpperCase()} Report](${link})\n`;
        }
        finalContent += `\n`;
      } else {
        // Add manual download options
        finalContent += `📥 **Download Reports**\n\n`;
        finalContent += `- [Markdown Report](javascript:chatManager.downloadTaskReport('${taskInfo.taskId}', 'markdown'))\n`;
        finalContent += `- [PDF Report](javascript:chatManager.downloadTaskReport('${taskInfo.taskId}', 'pdf'))\n`;
        finalContent += `- [DOCX Report](javascript:chatManager.downloadTaskReport('${taskInfo.taskId}', 'docx'))\n\n`;
      }

      // Update the message content
      const messageContent = taskInfo.messageElement.querySelector('.message-content');
      if (messageContent) {
        messageContent.innerHTML = this.renderMarkdown(finalContent);
      }
    } catch (error) {
      console.error(`❌ Error getting final results for task ${taskInfo.taskId}:`, error);

      // Update message with error
      if (taskInfo.messageElement) {
        const messageContent = taskInfo.messageElement.querySelector('.message-content');
        if (messageContent) {
          const currentHtml = messageContent.innerHTML;
          messageContent.innerHTML = currentHtml + `\n\n❌ **Error retrieving final results**: ${error.message}`;
        }
      }
    }
  }

  /**
   * Download a task report in the specified format
   */
  async downloadTaskReport(taskId, format = 'markdown') {
    try {
      // Get the task info
      const taskInfo = this.activeTasks.get(taskId);
      if (!taskInfo) {
        throw new Error(`Task ${taskId} not found`);
      }

      console.log(`📥 Downloading ${format} report for task ${taskId}`);

      // Download the report from the server
      const downloadResult = await this.mcpServerManager.downloadTaskReport(taskInfo.serverId, taskId, format);

      // Create a download link and trigger it
      const blobUrl = URL.createObjectURL(downloadResult.blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = downloadResult.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Revoke the blob URL after download
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 1000);

      console.log(`✅ Report downloaded successfully: ${downloadResult.filename}`);
    } catch (error) {
      console.error(`❌ Error downloading report for task ${taskId}:`, error);
      alert(`Failed to download report: ${error.message}`);
    }
  }

  /**
   * Stop polling for a task
   */
  stopTaskPolling(taskId) {
    const taskInfo = this.activeTasks.get(taskId);
    if (taskInfo) {
      // Clear the polling interval
      clearInterval(taskInfo.pollInterval);

      // Remove from active tasks map
      this.activeTasks.delete(taskId);

      console.log(`⏹️ Stopped polling for task ${taskId}`);
    }
  }

  /**
   * Get detailed current state information for system prompts
   */
  getDetailedCurrentState(context) {
    const state = context.genomeBrowser.currentState;
    const tracks = this.services.trackBridge.getVisibleTracks();
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
    if (!this.services || !this.services.context) {
      console.error('[ChatManager] context not initialized');
      return;
    }
    return this.services.context.getAllToolsDetailed(context);
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
        'find_gene_by_name',
        'search_features',
        'jump_to_gene',
        'navigate_to_position',
        'search_by_position',
        'open_new_tab',
        'zoom_in',
        'zoom_out',
      ],
      'SYSTEM STATUS': [
        'get_genome_info',
        'check_genomics_environment',
        'get_file_info',
        'get_current_state',
        'get_chromosome_list',
        'get_selected_gene',
        'select_gene',
        'select_sequence_region',
        'get_current_region_details',
        'get_sequence_selection',
        'list_genome_windows',
        'switch_active_window',
      ],
      'SEQUENCE ANALYSIS': [
        'get_coding_sequence',
        'get_multiple_coding_sequences',
        'get_sequence',
        'translate_dna',
        'reverse_complement',
        'compute_gc',
      ],
      'GENOMIC FEATURES': [
        'predict_promoter',
        'predict_rbs',
        'search_sequence_motif',
        'find_restriction_sites',
        'sequence_statistics',
      ],
      'PROTEIN STRUCTURE': [
        'search_pdb_structures',
        'open_protein_viewer',
        'fetch_protein_structure',
        'search_alphafold_structures',
        'fetch_alphafold_structure',
      ],
      'DATABASE INTEGRATION': [
        'search_uniprot_database',
        'advanced_uniprot_search',
        'get_uniprot_entry',
        'analyze_interpro_domains',
        'search_interpro_entry',
        'get_interpro_entry_details',
      ],
      'DATA EXPORT': [
        'export_fasta_sequence',
        'export_genbank_format',
        'export_cds_fasta',
        'export_protein_fasta',
        'export_gff_annotations',
        'export_bed_format',
        'export_current_view_fasta',
      ],
      'BLAST & SIMILARITY': [
        'blast_search',
        'advanced_blast_search',
        'batch_blast_search',
        'blast_sequence_from_region',
      ],
      'PATHWAYS & NETWORKS': ['show_metabolic_pathway', 'find_pathway_genes', 'analyze_interpro_domains'],
      'AI & PREDICTION': ['evo2_generate_sequence', 'evo2_predict_function', 'evo2_design_crispr'],
      'SEQUENCE EDITING': [
        'copy_sequence',
        'cut_sequence',
        'paste_sequence',
        'delete_sequence',
        'delete_gene',
        'insert_sequence',
        'replace_sequence',
        'execute_actions',
        'get_action_list',
      ],
      'TRACK SETTINGS': [
        'get_track_settings',
        'set_track_settings',
        'get_all_track_settings',
        'reset_track_settings',
        'get_track_settings_schema',
        'batch_set_track_settings',
      ],
      'PRIMER DESIGN & PCR': [
        'calculate_primer_properties',
        'design_primers',
        'find_primer_binding_sites',
        'add_primer_annotation',
      ],
      'SYSTEM & FILE MANAGEMENT': [
        'set_working_directory',
        'list_available_tools',
        'download_internet_file',
        'toggle_settings_modal',
      ],
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
    const context = this.services.llm.getCurrentContext();

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
- Selected Gene: ${context.genomeBrowser.currentState.selectedGene
        ? `${context.genomeBrowser.currentState.selectedGene.geneName} (${context.genomeBrowser.currentState.selectedGene.locusTag})`
        : 'None'
      }
- Sequence Selection: ${context.genomeBrowser.currentState.sequenceSelection?.active
        ? `${context.genomeBrowser.currentState.sequenceSelection.start}-${context.genomeBrowser.currentState.sequenceSelection.end} (${context.genomeBrowser.currentState.sequenceSelection.length} bp)`
        : 'None'
      }
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
    const toolPriority = this.configManager.get('chatboxSettings.toolPriority', [
      'local',
      'genomics',
      'plugins',
      'mcp',
    ]);

    const priorityLabels = {
      local: 'Local Tools',
      genomics: 'Specialized Genomics Tools',
      plugins: 'Plugin Tools',
      mcp: 'MCP Server Tools',
    };

    const priorityList = toolPriority.map((type, index) => `${index + 1}) ${priorityLabels[type] || type}`).join('\n');

    return `TOOL SELECTION PRIORITY:\n${priorityList}`;
  }

  /**
   * @deprecated Use this.services.tools.executeToolWithPriority() instead
   */
  async executeToolWithPriority(toolName, parameters) {
    return this.services.tools.executeToolWithPriority(toolName, parameters);
  }

  /**
   * @deprecated Use this.services.tools.tryExecuteToolInCategory() instead
   */
  async tryExecuteToolInCategory(toolName, parameters, category) {
    return this.services.tools.tryExecuteToolInCategory(toolName, parameters, category);
  }

  /**
   * @deprecated Use this.services.tools.executeLocalTool() instead
   */
  async executeLocalTool(toolName, parameters) {
    return this.services.tools.executeLocalTool(toolName, parameters);
  }

  /**
   * @deprecated Use this.services.tools.zoomIn() instead
   */
  async zoomIn(parameters = {}) {
    return this.services.tools.zoomIn(parameters);
  }

  /**
   * @deprecated Use this.services.tools.zoomOut() instead
   */
  async zoomOut(parameters = {}) {
    return this.services.tools.zoomOut(parameters);
  }

  /**
   * @deprecated Use this.services.tools.panLeft() instead
   */
  async panLeft(parameters = {}) {
    return this.services.tools.panLeft(parameters);
  }

  /**
   * @deprecated Use this.services.tools.panRight() instead
   */
  async panRight(parameters = {}) {
    return this.services.tools.panRight(parameters);
  }

  /**
   * @deprecated Use this.services.tools.listGenomeWindows() instead
   */
  async listGenomeWindows(parameters = {}) {
    return this.services.tools.listGenomeWindows(parameters);
  }

  /**
   * @deprecated Use this.services.tools.switchActiveWindow() instead
   */
  async switchActiveWindow(parameters = {}) {
    return this.services.tools.switchActiveWindow(parameters);
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

    // Tool-specific parameter extraction - MicrobeGenomicsFunctions methods expect specific arguments
    const genomicsTools = {
      find_gene_by_name: () =>
        window.MicrobeGenomicsFunctions.searchGeneByName(
          parameters.name || parameters.geneName || parameters.identifier
        ),
      get_coding_sequence: () =>
        window.MicrobeGenomicsFunctions.getCodingSequence(
          parameters.identifier || parameters.geneName || parameters.gene_name
        ),
      jump_to_gene: () =>
        window.MicrobeGenomicsFunctions.jumpToGene(parameters.geneName || parameters.identifier || parameters.name),
      delete_gene: () => window.MicrobeGenomicsFunctions.deleteGene(parameters.geneName || parameters.identifier),
      search_gene_by_locus_tag: () =>
        window.MicrobeGenomicsFunctions.searchGeneByLocusTag(
          parameters.locusTag || parameters.locus_tag || parameters.identifier
        ),
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
    // Delegate to PluginFunctionCallsIntegrator if available
    if (this.pluginFunctionCallsIntegrator && this.pluginFunctionCallsIntegrator.isPluginFunction(toolName)) {
      return await this.pluginFunctionCallsIntegrator.executePluginFunction(toolName, parameters);
    }

    console.log(`🔌 Plugin tool '${toolName}' not found in PluginFunctionCallsIntegrator`);
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
          // Pass parameters directly — path resolution is handled by
          // resolveSaveFilePath() inside executeAllActionsInternal
          console.log(`🔍 [TRACE-EXECUTE_ACTIONS] ChatManager.executeActionTool execute_actions | parameters=${JSON.stringify(parameters)}`);
          return await window.actionManager.executeAllActions(parameters);
        case 'get_action_list':
          return await window.actionManager.getActionList(parameters);
        case 'clear_actions':
          const clearOptions = {};
          if (parameters && parameters.forced !== undefined) {
            clearOptions.forced = parameters.forced;
          }
          return await window.actionManager.clearAllActions(clearOptions);
        case 'get_clipboard_content':
          return await window.actionManager.getClipboardContent(parameters);
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
    if (!this.services || !this.services.context) {
      console.error('[ChatManager] context not initialized');
      return;
    }
    return this.services.context.getOptimizedSystemMessage();
  }

  /**
   * Get complete tool context for custom system prompts
   * This includes all the tool information that the base system message has
   */
  getCompleteToolContext() {
    if (!this.services || !this.services.context) {
      console.error('[ChatManager] context not initialized');
      return;
    }
    return this.services.context.getCompleteToolContext();
  }

  /**
   * Get essential tool information that should always be included
   */
  getEssentialToolInformation() {
    const context = this.services.llm.getCurrentContext();
    const toolCount = context.genomeBrowser.toolSources.total;

    // Get a sample of key tools from each category
    const keyTools = [
      // Navigation & State
      'navigate_to_position',
      'get_current_state',
      'jump_to_gene',
      'zoom_to_gene',
      'open_new_tab',
      // Search & Discovery
      'search_features',
      'find_gene_by_name',
      'search_sequence_motif',
      // Sequence Analysis
      'get_sequence',
      'translate_dna',
      'compute_gc',
      'reverse_complement',
      // Advanced Analysis
      'analyze_region',
      'predict_promoter',
      'find_restriction_sites',
      // BLAST & External
      'blast_search',
      'blast_sequence_from_region',
      // Protein Structure
      'open_protein_viewer',
      'fetch_protein_structure',
      'search_pdb_structures',
      // Data Management
      'get_genome_info',
      'export_data',
      'create_annotation',
      // System & File Management
      'set_working_directory',
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
Navigation & State: navigate_to_position, get_current_state, jump_to_gene, zoom_to_gene, select_gene, select_sequence_region, open_new_tab
Search & Discovery: search_features, find_gene_by_name, search_sequence_motif
Sequence Analysis: get_sequence, translate_dna, compute_gc, reverse_complement  
Advanced Analysis: analyze_region, predict_promoter, find_restriction_sites
BLAST & External: blast_search, blast_sequence_from_region
Protein Structure: open_protein_viewer, fetch_protein_structure
Data Management: get_genome_info, export_data, create_annotation
System & File Management: set_working_directory, list_available_tools, download_internet_file

For complete tool documentation with all ${toolCount} available tools, ask me to show all available tools.`;
  }

  /**
   * Get the original base system message with all context
   */
  getBaseSystemMessage() {
    if (!this.services || !this.services.context) {
      console.error('[ChatManager] context not initialized');
      return;
    }
    return this.services.context.getBaseSystemMessage();
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
    const annotationCount = this.app.currentAnnotations
      ? Object.values(this.app.currentAnnotations).reduce((sum, annotations) => sum + annotations.length, 0)
      : 0;

    let summary = `${sequences.length} sequence(s), ${totalLength.toLocaleString()} bp total, ${annotationCount} annotations`;
    if (this.app.windowId) {
      summary = `[Window: ${this.app.windowId}] ${summary}`;
    }
    return summary;
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
    const tracks = this.services.trackBridge.getVisibleTracks();
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
    return connected.length > 0
      ? `${connected.length} connected: ${connected.map(s => s.name).join(', ')}`
      : 'No MCP servers connected';
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
        info +=
          '- Analyze GC content: {"tool_name": "genomic-analysis.analyzeGCContent", "parameters": {"chromosome": "chr1", "start": 1000, "end": 5000, "windowSize": 1000}}\\n';
        info +=
          '- Find motifs: {"tool_name": "genomic-analysis.findMotifs", "parameters": {"chromosome": "chr1", "start": 1000, "end": 5000, "motif": "GAATTC", "strand": "both"}}\\n';
        info +=
          '- Calculate diversity: {"tool_name": "genomic-analysis.calculateDiversity", "parameters": {"sequences": ["ATGC", "CGTA"], "metric": "shannon"}}\\n';
        info +=
          '- Compare regions: {"tool_name": "genomic-analysis.compareRegions", "parameters": {"regions": [{"chromosome": "chr1", "start": 1000, "end": 2000, "name": "region1"}], "analysisType": "gc"}}\\n';
        info +=
          '- Build phylogenetic tree: {"tool_name": "phylogenetic-analysis.buildPhylogeneticTree", "parameters": {"sequences": [{"id": "seq1", "sequence": "ATGC", "name": "Sequence 1"}], "method": "nj"}}\\n';
        info +=
          '- Predict gene function: {"tool_name": "ml-analysis.predictGeneFunction", "parameters": {"sequence": "ATGCGCTATCG", "model": "cnn", "threshold": 0.7}}\\n';
        info +=
          '- Cluster sequences: {"tool_name": "ml-analysis.clusterSequences", "parameters": {"sequences": [{"id": "seq1", "sequence": "ATGC"}], "algorithm": "kmeans", "numClusters": 3}}\\n';

        // UniProt Database Search Functions
        info += '\\nUNIPROT DATABASE SEARCH FUNCTIONS:\\n';
        info +=
          '- Search UniProt database: {"tool_name": "uniprot-search.searchUniProt", "parameters": {"query": "TP53", "organism": "human", "reviewedOnly": true, "maxResults": 10}}\\n';
        info +=
          '- Search by gene name: {"tool_name": "uniprot-search.searchByGene", "parameters": {"geneName": "INS", "organism": "human", "reviewedOnly": true}}\\n';
        info +=
          '- Search by protein name: {"tool_name": "uniprot-search.searchByProtein", "parameters": {"proteinName": "insulin", "organism": "human"}}\\n';
        info +=
          '- Get protein by ID: {"tool_name": "uniprot-search.getProteinById", "parameters": {"uniprotId": "P04637", "includeSequence": true}}\\n';
        info +=
          '- Search by function: {"tool_name": "uniprot-search.searchByFunction", "parameters": {"keywords": "kinase", "organism": "mouse", "maxResults": 15}}\\n';
      }

      if (visualizations.length > 0) {
        info += '\\nAvailable Visualization Plugins:\\n';
        visualizations.forEach(viz => {
          info += `- ${viz.id}: ${viz.description} (supports: ${viz.supportedDataTypes.join(', ')})\\n`;
        });

        info += '\\nVisualization Examples:\\n';
        info += 'Note: Visualizations are automatically rendered when plugin functions return compatible data.\\n';
        info +=
          'For example, GC content analysis will automatically show a plot, phylogenetic analysis will show a tree.\\n';
      }

      return info;
    } catch (error) {
      console.error('Error getting plugin system info:', error);
      return 'Plugin system available but could not load details.';
    }
  }

  parseToolCall(response) {
    if (!this.services || !this.services.intent) {
      console.error('[ChatManager] intent not initialized');
      return null;
    }
    return this.services.intent.parseToolCall(response);
  }

  parseMultipleToolCalls(response) {
    if (!this.services || !this.services.intent) {
      console.error('[ChatManager] intent not initialized');
      return [];
    }
    return this.services.intent.parseMultipleToolCalls(response);
  }

  async executeToolByName(toolName, parameters) {
    return this.services.tools.executeToolByName(toolName, parameters);
  }

  /**
   * @deprecated Use this.services.tools.executeDeleteSequence() instead
   */
  async executeDeleteSequence(parameters) {
    return this.services.tools.executeDeleteSequence(parameters);
  }

  /**
   * @deprecated Use this.services.tools.executeDeleteGene() instead
   */
  async executeDeleteGene(parameters) {
    return this.services.tools.executeDeleteGene(parameters);
  }

  /**
   * @deprecated Use this.services.tools.executeActionFunction() instead
   */
  async executeActionFunction(functionName, parameters) {
    return this.services.tools.executeActionFunction(functionName, parameters);
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
        message: `No genes found matching "${geneName}" in ${chr}`,
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
      note: gene.qualifiers?.note || 'No additional notes',
    }));

    return {
      geneName: geneName,
      chromosome: chr,
      found: true,
      count: matchingGenes.length,
      genes: geneDetails,
    };
  }

  async translateSequence(params) {
    return this.services.analysis.translateSequence(params);
  }

  async calculateGCContent(params) {
    return this.services.analysis.calculateGCContent(params);
  }

  async findOpenReadingFrames(params) {
    return this.services.analysis.findOpenReadingFrames(params);
  }

  reverseComplement(sequence) {
    // Use local SequenceTools implementation
    const SequenceTools = require('../mcp-tools/sequence/SequenceTools');
    const seqTools = new SequenceTools();
    return seqTools.reverseComplement(sequence);
  }

  async getCodingSequence(params) {
    return this.services.analysis.getCodingSequence(params);
  }

  /**
   * Check if the genomics environment is properly set up
   * @returns {Object} Validation result with details
   */
  checkGenomicsEnvironment() {
    return this.services.analysis.checkGenomicsEnvironment();
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
        message: 'No gene currently selected. Click on a gene in the genome view to select it.',
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
      operonInfo: operonInfo
        ? {
          operonName: operonInfo.name,
          operonStart: operonInfo.start,
          operonEnd: operonInfo.end,
          operonStrand: operonInfo.strand === -1 ? '-' : '+',
          geneCount: operonInfo.genes?.length || 0,
          genePosition:
            operonInfo.genes?.findIndex(g => g.start === gene.start && g.end === gene.end) + 1 || 'Unknown',
        }
        : null,
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
        message: 'No region currently selected. Navigate to a genomic position first.',
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
      gcContent = ((gcCount / sequence.length) * 100).toFixed(2);
    }

    // Get features in the region
    let featuresInRegion = [];
    if (this.app.currentAnnotations && this.app.currentAnnotations[chromosome]) {
      featuresInRegion = this.app.currentAnnotations[chromosome]
        .filter(feature => feature.start <= end && feature.end >= start)
        .map(feature => ({
          type: feature.type,
          name: feature.qualifiers?.gene || feature.qualifiers?.locus_tag || 'Unknown',
          product: feature.qualifiers?.product || 'Unknown',
          start: feature.start,
          end: feature.end,
          strand: feature.strand === -1 ? '-' : '+',
          length: feature.end - feature.start + 1,
        }));
    }

    // Get user-defined features in the region
    let userFeaturesInRegion = [];
    if (this.app.userDefinedFeatures && this.app.userDefinedFeatures[chromosome]) {
      userFeaturesInRegion = Object.values(this.app.userDefinedFeatures[chromosome])
        .filter(feature => feature.start <= end && feature.end >= start)
        .map(feature => ({
          type: feature.type,
          name: feature.name,
          description: feature.description || '',
          start: feature.start,
          end: feature.end,
          strand: feature.strand === -1 ? '-' : '+',
          length: feature.end - feature.start + 1,
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
        rnaCount: featuresInRegion.filter(f => f.type.includes('RNA')).length,
      },
    };
  }

  /**
   * Get information about user's sequence selection
   * @returns {Object} Sequence selection details
   */
  getSequenceSelection() {
    return this.services.analysis.getSequenceSelection();
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
          codingSequence:
            format === 'sequence_only'
              ? result.codingSequence
              : result.codingSequence.substring(0, 100) + (result.codingSequence.length > 100 ? '...' : ''),
          proteinSequence: includeProtein
            ? format === 'sequence_only'
              ? result.proteinSequence
              : result.proteinSequence.substring(0, 50) + (result.proteinSequence.length > 50 ? '...' : '')
            : undefined,
          proteinLength: result.proteinLength,
        })),
        errors: failed.map(f => ({ identifier: f.identifier, error: f.error })),
      };

      // Add full sequences if requested
      if (format === 'full_sequences') {
        response.fullSequences = successful.map(result => ({
          identifier: result.identifier,
          geneName: result.geneName,
          codingSequence: result.codingSequence,
          proteinSequence: includeProtein ? result.proteinSequence : undefined,
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
    const operons = this.app.detectOperons(annotations, chr);

    const operonSummary = operons.map(operon => ({
      name: operon.name,
      start: operon.start,
      end: operon.end,
      strand: operon.strand === -1 ? '-' : '+',
      geneCount: operon.genes.length,
      genes: operon.genes.map(g => g.qualifiers?.gene || g.qualifiers?.locus_tag || 'Unknown').slice(0, 5),
      length: operon.end - operon.start + 1,
    }));

    return {
      chromosome: chr,
      operonsFound: operons.length,
      operons: operonSummary,
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
    await this.services.tools.navigateToPosition({
      chromosome: geneDetails.chromosome,
      start: newStart,
      end: newEnd,
    });

    return {
      geneName: geneName,
      gene: gene,
      zoomedRegion: `${newStart}-${newEnd}`,
      padding: padding,
      message: `Zoomed to gene ${gene.name} with ${padding}bp padding`,
    };
  }

  /**
   * Select a gene by name or locus tag, highlighting it in the genome view
   */
  async selectGene(params) {
    const { geneName, chromosome } = params;

    if (!this.app) {
      throw new Error('Genome browser not initialized');
    }

    if (!geneName) {
      throw new Error('Gene name is required');
    }

    // Find the gene across all chromosomes (multi-chromosome support)
    let searchResults = [];
    let foundChromosome = null;

    if (this.app.currentAnnotations) {
      // If a specific chromosome is requested, search only that one
      if (chromosome && this.app.currentAnnotations[chromosome]) {
        foundChromosome = chromosome;
        searchResults = this._searchGeneInChromosome(geneName, chromosome);
      } else {
        // Search across all chromosomes
        const allChromosomes = Object.keys(this.app.currentAnnotations);
        for (const chr of allChromosomes) {
          const chrResults = this._searchGeneInChromosome(geneName, chr);
          // Tag each result with its chromosome
          chrResults.forEach(r => { r.chromosome = chr; });
          searchResults = searchResults.concat(chrResults);
        }
        // Sort by relevance across all chromosomes
        searchResults.sort((a, b) => {
          if (b.relevanceScore !== a.relevanceScore) {
            return b.relevanceScore - a.relevanceScore;
          }
          return a.position - b.position;
        });
        searchResults = searchResults.slice(0, 20);
      }
    }

    if (searchResults.length === 0) {
      throw new Error(`Gene "${geneName}" not found. Try using find_gene_by_name to find the correct identifier.`);
    }

    // Use the best match
    const bestMatch = searchResults[0];
    const targetChromosome = bestMatch.chromosome || foundChromosome || this.app.currentChromosome;

    // Get the full annotation object for the gene (search results use a slim 'annotation' field)
    const geneAnnotation = bestMatch.annotation;
    if (!geneAnnotation || geneAnnotation.start === undefined) {
      throw new Error(`Gene "${geneName}" found but annotation data is incomplete. Try using find_gene_by_name instead.`);
    }

    // If the gene is on a different chromosome, switch to it
    if (targetChromosome && targetChromosome !== this.app.currentChromosome) {
      const chromosomeSelect = document.getElementById('chromosomeSelect');
      if (chromosomeSelect) {
        chromosomeSelect.value = targetChromosome;
        // Trigger the change event to actually switch the chromosome
        const event = new Event('change', { bubbles: true });
        chromosomeSelect.dispatchEvent(event);
        // Wait for the chromosome switch to complete
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    // Resolve the richest annotation object for this gene.
    // _searchGeneInChromosome stores direct references, so geneAnnotation may already
    // be the full object. However, it might be a 'gene' type feature with minimal
    // qualifiers (gene, locus_tag only). In GenBank files, the corresponding CDS
    // feature carries much richer data (product, translation, note, db_xref, etc.).
    // We always prefer CDS > mRNA > gene to match mouse-click sidebar behavior.
    let fullGene = geneAnnotation;
    if (this.app.currentAnnotations && this.app.currentAnnotations[targetChromosome]) {
      const targetName = geneAnnotation.qualifiers?.gene || geneAnnotation.qualifiers?.locus_tag;

      if (targetName) {
        // Find ALL annotations sharing this gene name/locus_tag at the same locus
        const candidates = this.app.currentAnnotations[targetChromosome].filter(a => {
          if (!a.qualifiers) return false;
          const aGene = this.app.getQualifierValue(a.qualifiers, 'gene');
          const aLocus = this.app.getQualifierValue(a.qualifiers, 'locus_tag');
          return (aGene && aGene === targetName) || (aLocus && aLocus === targetName);
        });

        if (candidates.length > 0) {
          // Prefer CDS (richest qualifiers) > mRNA > others > gene (minimal qualifiers)
          const typePriority = (type) => {
            switch ((type || '').toUpperCase()) {
              case 'CDS': return 3;
              case 'MRNA': return 2;
              case 'GENE': return 0;
              default: return 1;
            }
          };
          candidates.sort((a, b) => {
            const typeDiff = typePriority(b.type) - typePriority(a.type);
            if (typeDiff !== 0) return typeDiff;
            // Among same type, prefer the one with more qualifiers
            return Object.keys(b.qualifiers || {}).length - Object.keys(a.qualifiers || {}).length;
          });
          fullGene = candidates[0];
        }
      } else {
        // No gene name available — fall back to exact position match
        const posMatch = this.app.currentAnnotations[targetChromosome].find(a =>
          a.start === geneAnnotation.start &&
          a.end === geneAnnotation.end &&
          a.type === geneAnnotation.type &&
          a.strand === geneAnnotation.strand
        );
        if (posMatch) fullGene = posMatch;
      }
    }

    // Navigate to the gene if it's not in the current view
    const currentStart = this.app.currentPosition?.start || 0;
    const currentEnd = this.app.currentPosition?.end || 0;
    const needNavigation = fullGene.end < currentStart || fullGene.start > currentEnd;
    if (needNavigation) {
      // Gene is outside current view, navigate to it
      const padding = Math.max(500, Math.floor((fullGene.end - fullGene.start) * 0.2));
      await this.services.tools.navigateToPosition({
        chromosome: targetChromosome,
        start: Math.max(0, fullGene.start - padding),
        end: fullGene.end + padding,
      });

      // Wait for the genome view to finish rendering after navigation
      // This ensures DOM elements for the gene are available before highlighting
      await new Promise(resolve => setTimeout(resolve, 400));
    }

    // Use the same function as user click: TrackRenderer.showGeneDetails()
    // This ensures 100% consistent behavior with mouse-click selection
    const operonInfo = bestMatch.operonInfo || null;
    if (this.app.trackRenderer && typeof this.app.trackRenderer.showGeneDetails === 'function') {
      this.app.trackRenderer.showGeneDetails(fullGene, operonInfo);
    } else {
      // Fallback: call the individual methods directly
      if (typeof this.app.selectGene === 'function') {
        this.app.selectGene(fullGene, operonInfo);
      } else {
        this.app.selectedGene = { gene: fullGene, operonInfo };
      }
      try { this.app.showGeneDetailsPanel?.(); } catch (e) { console.warn('Could not show gene details panel:', e.message); }
      try { this.app.populateGeneDetails?.(fullGene, operonInfo); } catch (e) { console.warn('Could not populate gene details:', e.message); }
      try { this.app.highlightGeneSequence?.(fullGene); } catch (e) { console.warn('Could not highlight gene sequence:', e.message); }
    }

    // If navigation occurred, re-apply gene highlighting after render
    // (highlightSelectedGene may have missed DOM elements during navigation render)
    if (needNavigation && typeof this.app.highlightSelectedGene === 'function') {
      setTimeout(() => {
        try {
          this.app.highlightSelectedGene(fullGene);
        } catch (e) {
          console.warn('Could not re-highlight gene after navigation:', e.message);
        }
      }, 600);
    }

    return {
      success: true,
      message: `Selected gene: ${fullGene.qualifiers?.gene || fullGene.qualifiers?.locus_tag || fullGene.type}`,
      gene_info: {
        name: fullGene.qualifiers?.gene || 'Unknown',
        locusTag: fullGene.qualifiers?.locus_tag || 'Unknown',
        product: fullGene.qualifiers?.product || 'Unknown',
        start: fullGene.start,
        end: fullGene.end,
        length: fullGene.end - fullGene.start + 1,
        strand: fullGene.strand === -1 ? '-' : '+',
        type: fullGene.type || 'Unknown',
        chromosome: targetChromosome,
      },
    };
  }

  /**
   * Search for a gene in a specific chromosome (helper for multi-chromosome support)
   */
  _searchGeneInChromosome(geneName, chromosome) {
    if (!this.app.currentAnnotations[chromosome]) {
      return [];
    }

    const originalChr = document.getElementById('chromosomeSelect')?.value;
    const annotations = this.app.currentAnnotations[chromosome];
    const searchTerm = geneName.toLowerCase();
    const results = [];

    annotations.forEach(annotation => {
      if (!annotation.qualifiers) return;

      const geneNameValue = this.app.getQualifierValue(annotation.qualifiers, 'gene') || '';
      const locusTag = this.app.getQualifierValue(annotation.qualifiers, 'locus_tag') || '';
      const product = this.app.getQualifierValue(annotation.qualifiers, 'product') || '';

      let relevanceScore;
      try {
        relevanceScore = this.calculateGeneRelevanceScore(searchTerm, geneNameValue, locusTag, product);
      } catch (error) {
        return;
      }

      if (relevanceScore && relevanceScore.score > 0) {
        results.push({
          type: 'gene',
          position: annotation.start,
          end: annotation.end,
          name: geneNameValue || locusTag || annotation.type,
          details: `${annotation.type}: ${product || 'No description'}`,
          // Reference the full annotation object directly (not a slim copy)
          // so that all qualifiers (translation, codon_start, etc.) are preserved
          annotation: annotation,
          relevanceScore: relevanceScore.score,
          matchType: relevanceScore.matchType,
          matchedField: relevanceScore.matchedField,
          chromosome: chromosome,
        });
      }
    });

    // Prioritize CDS > mRNA > gene > other feature types when relevance scores tie.
    // This ensures the richly-annotated CDS feature is selected rather than the
    // minimal 'gene' feature that only carries gene name and locus_tag qualifiers.
    const featureTypePriority = (type) => {
      switch ((type || '').toUpperCase()) {
        case 'CDS': return 3;
        case 'MRNA': return 2;
        case 'GENE': return 1;
        default: return 0;
      }
    };

    results.sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      // Same relevance: prefer feature types with richer annotation data
      const typeDiff = featureTypePriority(b.annotation?.type) - featureTypePriority(a.annotation?.type);
      if (typeDiff !== 0) return typeDiff;
      return a.position - b.position;
    });

    return results.slice(0, 20);
  }

  /**
   * Select a sequence region by genomic coordinates
   */
  async selectSequenceRegion(params) {
    const { start, end, chromosome } = params;

    if (!this.app) {
      throw new Error('Genome browser not initialized');
    }

    if (start === undefined || end === undefined) {
      throw new Error('Start and end positions are required');
    }

    const regionStart = parseInt(start);
    const regionEnd = parseInt(end);

    if (isNaN(regionStart) || isNaN(regionEnd)) {
      throw new Error('Start and end positions must be valid numbers');
    }

    if (regionStart > regionEnd) {
      throw new Error(`Invalid region: start (${regionStart}) cannot be greater than end (${regionEnd})`);
    }

    // Determine the chromosome
    const targetChromosome = chromosome || this.app.currentChromosome;
    if (!targetChromosome) {
      throw new Error('No chromosome specified and no current chromosome available');
    }

    // Validate chromosome exists
    if (this.app.currentSequence && !this.app.currentSequence[targetChromosome]) {
      throw new Error(`Chromosome "${targetChromosome}" not found in loaded genome`);
    }

    // Validate positions are within sequence range
    if (this.app.currentSequence && this.app.currentSequence[targetChromosome]) {
      const seqLength = this.app.currentSequence[targetChromosome].length;
      if (regionStart < 1 || regionEnd > seqLength) {
        console.warn(`Region ${regionStart}-${regionEnd} extends beyond sequence length (${seqLength}), clamping`);
      }
    }

    // Clear existing sequence selection
    if (typeof this.app.clearSequenceSelection === 'function') {
      this.app.clearSequenceSelection();
    }

    // Set the sequence selection
    this.app.sequenceSelection = {
      start: regionStart,
      end: regionEnd,
      active: true,
      chromosome: targetChromosome,
      source: 'tool', // Mark that this selection came from a tool call
      geneName: `Region ${regionStart}-${regionEnd}`,
    };

    // Highlight the sequence in the view
    if (typeof this.app.highlightSequenceRegion === 'function') {
      try {
        this.app.highlightSequenceRegion(regionStart, regionEnd);
      } catch (e) {
        console.warn('Could not highlight sequence region:', e.message);
      }
    }

    // Update status
    const selectionLength = regionEnd - regionStart + 1;
    const statusMessage = `🔵 Region Selected: ${regionStart.toLocaleString()}-${regionEnd.toLocaleString()} (${selectionLength.toLocaleString()} bp) on ${targetChromosome}`;

    if (typeof this.app.updateStatus === 'function') {
      this.app.updateStatus(statusMessage, {
        highlight: true,
        color: '#3b82f6',
        duration: 3000,
        restore: true,
      });
    }

    if (typeof this.app.showNotification === 'function') {
      this.app.showNotification(statusMessage, 'info');
    }

    return {
      success: true,
      message: `Selected region: ${regionStart}-${regionEnd} on ${targetChromosome}`,
      region: {
        chromosome: targetChromosome,
        start: regionStart,
        end: regionEnd,
        length: selectionLength,
      },
    };
  }

  getChromosomeList() {
    if (!this.app || !this.app.currentSequence) {
      return {
        chromosomes: [],
        count: 0,
        message: 'No genome sequence loaded',
      };
    }

    const chromosomes = Object.keys(this.app.currentSequence);
    const chromosomeInfo = chromosomes.map(chr => ({
      name: chr,
      length: this.app.currentSequence[chr].length,
      isSelected: chr === this.app.currentChromosome,
    }));

    return {
      chromosomes: chromosomeInfo,
      count: chromosomes.length,
      currentChromosome: this.app.currentChromosome || 'None selected',
    };
  }

  // ========================================
  // NEW COMPREHENSIVE GENOMICS FUNCTION CALLS
  // ========================================

  // IUPAC ambiguity code map for motif expansion
  static IUPAC_CODES = {
    A: 'A', C: 'C', G: 'G', T: 'T',
    R: '[AG]', Y: '[CT]', S: '[GC]', W: '[AT]',
    K: '[GT]', M: '[AC]', B: '[CGT]', D: '[AGT]',
    H: '[ACT]', V: '[ACG]', N: '[ACGT]',
  };

  // IUPAC complement map for reverse complementing IUPAC motifs
  static IUPAC_COMPLEMENT = {
    A: 'T', T: 'A', G: 'C', C: 'G',
    R: 'Y', Y: 'R', S: 'S', W: 'W',
    K: 'M', M: 'K', B: 'V', D: 'H',
    H: 'D', V: 'B', N: 'N',
  };

  /**
   * Reverse complement a motif string with IUPAC code support.
   * Unlike this.reverseComplement() which only handles ACGTN,
   * this method correctly complements all IUPAC ambiguity codes.
   * @param {string} motif - Motif string (may contain IUPAC codes)
   * @returns {string} Reverse-complemented motif
   */
  _reverseComplementIUPAC(motif) {
    return motif.toUpperCase().split('').reverse()
      .map(b => ChatManager.IUPAC_COMPLEMENT[b] || b)
      .join('');
  }

  /**
   * Expand IUPAC ambiguity codes in a motif to a regex pattern string.
   * If the motif contains no IUPAC codes beyond ACGT, returns null (use exact match).
   * @param {string} motif - Motif possibly containing IUPAC codes
   * @returns {string|null} Expanded regex pattern string, or null if no IUPAC codes present
   */
  _expandIUPACToRegex(motif) {
    const pureBases = /^[ACGTacgt]+$/;
    if (pureBases.test(motif)) return null;

    let regex = '';
    let hasAmbiguity = false;
    for (const ch of motif.toUpperCase()) {
      const expanded = ChatManager.IUPAC_CODES[ch];
      if (expanded && expanded !== ch) {
        hasAmbiguity = true;
        regex += expanded;
      } else if (expanded) {
        regex += expanded;
      } else {
        regex += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }
    }
    return hasAmbiguity ? regex : null;
  }

  // 1. MOTIF AND PATTERN SEARCHING
  async searchMotif(params) {
    const {
      pattern,
      motif,
      chromosome,
      start,
      end,
      strand = 'both',
      max_mismatches = 0,
      allowMismatches,
      case_sensitive = false,
    } = params;

    // Normalize: accept both 'pattern' and 'motif' parameter names
    const motifPattern = (motif || pattern || '').toUpperCase();
    const maxMismatches = allowMismatches ?? max_mismatches ?? 0;

    if (!motifPattern) {
      return { success: false, error: 'Motif pattern is required (use "motif" or "pattern" parameter)' };
    }

    const chr = chromosome || this.app.currentChromosome;
    if (!chr) {
      return { success: false, error: 'No chromosome specified and none currently selected' };
    }

    const regionStart = start || this.app.currentPosition?.start || 0;
    const regionEnd = end || this.app.currentPosition?.end || this.app.currentSequence?.[chr]?.length || 0;

    const sequence = await this.app.getSequenceForRegion(chr, regionStart, regionEnd);
    if (!sequence || sequence.length === 0) {
      return { success: false, error: 'No sequence data available for the specified region' };
    }

    const searchSeq = case_sensitive ? sequence : sequence.toUpperCase();
    const matches = [];
    const maxResults = 500;

    // Decide search strategy: regex (for IUPAC or mismatches=0) vs brute-force (for mismatches>0 without IUPAC)
    const iupacRegex = this._expandIUPACToRegex(motifPattern);

    if (maxMismatches === 0) {
      // ---- Fast regex path (exact / IUPAC) ----
      const regexPattern = iupacRegex || motifPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const flags = case_sensitive ? 'g' : 'gi';
      const regex = new RegExp(regexPattern, flags);

      // Forward strand
      if (strand === '+' || strand === 'both') {
        regex.lastIndex = 0;
        let m;
        while ((m = regex.exec(searchSeq)) !== null && matches.length < maxResults) {
          matches.push({
            position: regionStart + m.index + 1,  // 1-based
            end: regionStart + m.index + m[0].length,
            sequence: m[0],
            strand: '+',
            mismatches: 0,
          });
          if (m[0].length === 0) regex.lastIndex++;  // zero-length match guard
        }
      }

      // Reverse strand
      if (strand === '-' || strand === 'both') {
        const rcMotif = this._reverseComplementIUPAC(motifPattern);
        const rcRegexStr = iupacRegex
          ? this._expandIUPACToRegex(rcMotif) || rcMotif.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          : rcMotif.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const rcRegex = new RegExp(rcRegexStr, flags);
        const rcSeq = this.reverseComplement(searchSeq);
        rcRegex.lastIndex = 0;
        let m;
        while ((m = rcRegex.exec(rcSeq)) !== null && matches.length < maxResults) {
          // Map position from reverse-complement space back to forward coordinates
          const fwdPos = searchSeq.length - m.index - m[0].length;
          matches.push({
            position: regionStart + fwdPos + 1,  // 1-based
            end: regionStart + fwdPos + m[0].length,
            sequence: m[0],
            strand: '-',
            mismatches: 0,
          });
          if (m[0].length === 0) rcRegex.lastIndex++;
        }
      }
    } else {
      // ---- Mismatch-tolerant path (brute-force with early exit) ----
      const motifLen = motifPattern.length;

      // Forward strand
      if (strand === '+' || strand === 'both') {
        for (let i = 0; i <= searchSeq.length - motifLen && matches.length < maxResults; i++) {
          const sub = searchSeq.substring(i, i + motifLen);
          const mm = this.countMismatches(sub, motifPattern);
          if (mm <= maxMismatches) {
            matches.push({
              position: regionStart + i + 1,  // 1-based
              end: regionStart + i + motifLen,
              sequence: sub,
              strand: '+',
              mismatches: mm,
            });
          }
        }
      }

      // Reverse strand
      if (strand === '-' || strand === 'both') {
        const rcMotif = this._reverseComplementIUPAC(motifPattern);
        const rcMotifLen = rcMotif.length;
        for (let i = 0; i <= searchSeq.length - rcMotifLen && matches.length < maxResults; i++) {
          const sub = searchSeq.substring(i, i + rcMotifLen);
          const mm = this.countMismatches(sub, rcMotif);
          if (mm <= maxMismatches) {
            matches.push({
              position: regionStart + i + 1,
              end: regionStart + i + rcMotifLen,
              sequence: sub,
              strand: '-',
              mismatches: mm,
            });
          }
        }
      }
    }

    // Sort by position
    matches.sort((a, b) => a.position - b.position);

    // Compute summary statistics
    const fwdCount = matches.filter(m => m.strand === '+').length;
    const revCount = matches.filter(m => m.strand === '-').length;
    const regionLen = regionEnd - regionStart;
    const density = regionLen > 0 ? (matches.length / regionLen * 1000).toFixed(3) : 0;

    return {
      success: true,
      motif: motifPattern,
      chromosome: chr,
      searchRegion: { start: regionStart, end: regionEnd, length: regionLen },
      strandSearched: strand,
      allowedMismatches: maxMismatches,
      iupacExpanded: iupacRegex !== null,
      totalMatches: matches.length,
      forwardMatches: fwdCount,
      reverseMatches: revCount,
      densityPerKb: parseFloat(density),
      matches: matches.slice(0, maxResults),
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
        length: match[0].length,
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
      matches: matches.slice(0, 50),
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

      const featureDistance = Math.min(Math.abs(feature.start - position), Math.abs(feature.end - position));

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
      direction: feature.start > position ? 'downstream' : feature.end < position ? 'upstream' : 'overlapping',
    }));

    return {
      chromosome: chr,
      position: position,
      searchDistance: distance,
      featuresFound: nearbyFeatures.length,
      features: featureSummary.slice(0, 20),
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
          downstreamGene: nextGene.qualifiers?.gene || nextGene.qualifiers?.locus_tag || 'Unknown',
        });
      }
    }

    return {
      chromosome: chr,
      minLength: minLength,
      regionsFound: intergenicRegions.length,
      totalIntergenicLength: intergenicRegions.reduce((sum, region) => sum + region.length, 0),
      regions: intergenicRegions.slice(0, 20),
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
      EcoRI: 'GAATTC',
      BamHI: 'GGATCC',
      HindIII: 'AAGCTT',
      XhoI: 'CTCGAG',
      SalI: 'GTCGAC',
      SpeI: 'ACTAGT',
      NotI: 'GCGGCCGC',
      KpnI: 'GGTACC',
      SacI: 'GAGCTC',
      PstI: 'CTGCAG',
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
          strand: '+',
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
          strand: '-',
        });
      }
    }

    return {
      enzyme: enzyme,
      recognitionSite: recognitionSite,
      chromosome: chr,
      searchRegion: `${regionStart}-${regionEnd}`,
      sitesFound: sites.length,
      sites: sites,
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
          cutBy: site.enzyme,
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
        cutBy: 'terminal',
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
      fragmentDetails: fragments.slice(0, 20), // Show first 20 fragments
    };
  }

  // 4. ENHANCED SEQUENCE STATISTICS
  async sequenceStatistics(params) {
    if (!this.services || !this.services.analysis) {
      console.error('[ChatManager] analysis not initialized');
      return;
    }
    return await this.services.analysis.sequenceStatistics(params);
  }

  async codonUsageAnalysis(params) {
    return this.services.analysis.codonUsageAnalysis(params);
  }

  /**
   * Genome-wide codon usage analysis
   * Analyzes codon usage patterns across all CDS features in the genome
   */
  async genomeCodonUsageAnalysis(params) {
    if (!this.services || !this.services.analysis) {
      console.error('[ChatManager] analysis not initialized');
      return;
    }
    return await this.services.analysis.genomeCodonUsageAnalysis(params);
  }

  // Amino acid composition analysis
  async aminoAcidComposition(params) {
    if (!this.services || !this.services.analysis) {
      console.error('[ChatManager] analysis not initialized');
      return;
    }
    return await this.services.analysis.aminoAcidComposition(params);
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
      created: new Date().toISOString(),
    };

    // Store in configuration
    let bookmarks = this.configManager.get('bookmarks', []);
    bookmarks.push(bookmark);
    this.configManager.set('bookmarks', bookmarks);
    await this.configManager.save();

    return {
      success: true,
      bookmark: bookmark,
      message: `Bookmarked "${name}" at ${chr}:${bookmarkStart}-${bookmarkEnd}`,
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
      bookmarks: filteredBookmarks,
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
      visibleTracks: this.services.trackBridge.getVisibleTracks(),
      created: new Date().toISOString(),
    };

    let savedStates = this.configManager.get('viewStates', []);
    savedStates.push(viewState);
    this.configManager.set('viewStates', savedStates);
    await this.configManager.save();

    return {
      success: true,
      viewState: viewState,
      message: `Saved view state "${name}"`,
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
    const parseRegion = regionStr => {
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
        region2: seq2.substring(0, 100) + (seq2.length > 100 ? '...' : ''),
      },
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
    for (let i = 0; i <= chromosomeSequence.length - queryLength; i += 100) {
      // Step by 100 for efficiency
      const subsequence = chromosomeSequence.substring(i, i + queryLength);
      const similarity = this.calculateSimilarity(querySequence, subsequence);

      if (similarity >= minSimilarity) {
        similarRegions.push({
          start: i,
          end: i + queryLength,
          similarity: parseFloat(similarity.toFixed(3)),
          sequence: subsequence.substring(0, 50) + (subsequence.length > 50 ? '...' : ''),
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
      results: similarRegions.slice(0, maxResults),
    };
  }

  // === NEW ANNOTATION METHODS ===

  _getChangeTracker() {
    if (!this._annotationChangeTracker) {
      if (typeof AnnotationChangeTracker !== 'undefined') {
        this._annotationChangeTracker = new AnnotationChangeTracker();
      } else {
        // Fallback: create a minimal no-op tracker
        this._annotationChangeTracker = {
          recordChange: () => ({}),
          recordMultiFieldUpdate: () => [],
          getHistory: () => [],
          getAllChanges: () => [],
          getSummary: () => ({ totalChanges: 0 }),
          exportChangelog: () => '[]',
          clearHistory: () => { },
          size: 0,
        };
      }
    }
    return this._annotationChangeTracker;
  }

  async listAnnotations(params) {
    return this.services.annotation.listAnnotations(params);
  }

  /**
   * Find annotation by identifier (gene name, locus tag, or protein ID)
   */
  _findAnnotation(identifier, chromosome) {
    return this.services.annotation._findAnnotation(identifier, chromosome);
  }

  async getAnnotation(params) {
    return this.services.annotation.getAnnotation(params);
  }

  async updateAnnotation(params) {
    return this.services.annotation.updateAnnotation(params);
  }

  async searchAnnotations(params) {
    return this.services.annotation.searchAnnotations(params);
  }

  async bulkUpdateAnnotations(params) {
    return this.services.annotation.bulkUpdateAnnotations(params);
  }

  async getAnnotationHistory(params) {
    return this.services.annotation.getAnnotationHistory(params);
  }



  // 7. ANNOTATION MANAGEMENT (CRUD)
  async editAnnotation(params) {
    return this.services.annotation.editAnnotation(params);
  }

  async deleteAnnotation(params) {
    return this.services.annotation.deleteAnnotation(params);
  }

  async batchCreateAnnotations(params) {
    return this.services.annotation.batchCreateAnnotations(params);
  }

  // 8. FILE AND DATA MANAGEMENT
  getFileInfo(params) {
    const { fileType } = params;

    const fileInfo = {
      genome: null,
      annotations: null,
      tracks: null,
    };

    // Get genome file info
    if (this.app.currentSequence && Object.keys(this.app.currentSequence).length > 0) {
      const chromosomes = Object.keys(this.app.currentSequence);
      const totalLength = chromosomes.reduce((sum, chr) => sum + (this.app.currentSequence[chr]?.length || 0), 0);

      fileInfo.genome = {
        chromosomes: chromosomes.length,
        chromosomeList: chromosomes,
        totalLength: totalLength,
        currentChromosome: this.app.currentChromosome,
      };
    }

    // Get annotation file info
    if (this.app.currentAnnotations) {
      const chromosomes = Object.keys(this.app.currentAnnotations);
      const totalFeatures = chromosomes.reduce((sum, chr) => sum + (this.app.currentAnnotations[chr]?.length || 0), 0);

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
        chromosomeList: chromosomes,
      };
    }

    // Get track info
    fileInfo.tracks = this.services.trackBridge.getTrackStatus();

    if (fileType && fileInfo[fileType]) {
      return { fileType, info: fileInfo[fileType] };
    }

    return {
      fileType: fileType || 'all',
      fileInfo: fileInfo,
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
      features: regionFeatures,
    };

    return {
      chromosome: chr,
      region: `${regionStart}-${regionEnd}`,
      featuresExported: regionFeatures.length,
      format: format,
      data: exportData,
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
   * Copy selected text from the page
   */

  /**
   * @deprecated Use this.services.thinking.addThinkingMessage() instead
   */
  addThinkingMessage(content) {
    return this.services.thinking.addThinkingMessage(content);
  }

  /**
   * @deprecated Use this.services.thinking.addToolCallMessage() instead
   */
  async addToolCallMessage(toolName, args, source) {
    return this.services.thinking.addToolCallMessage(toolName, args, source);
  }

  /**
   * @deprecated Use this.services.thinking.updateThinkingMessage() instead
   */
  updateThinkingMessage(message) {
    return this.services.thinking.updateThinkingMessage(message);
  }

  /**
   * @deprecated Use this.services.thinking.displayLLMThinking() instead
   */
  displayLLMThinking(response) {
    return this.services.thinking.displayLLMThinking(response);
  }

  /**
   * @deprecated Use this.services.settings.showNotification() instead
   */
  showNotification(message, type = 'info') {
    return this.services.settings.showNotification(message, type);
  }

  /**
   * @deprecated Use this.services.llm.sendMessage() instead
   */
  async sendMessage() {
    return this.services.llm.sendMessage();
  }

  /**
   * @deprecated Use this.services.llm.sendMessageProgrammatically() instead
   */
  async sendMessageProgrammatically(message) {
    return this.services.llm.sendMessageProgrammatically(message);
  }

  /**
   * @deprecated Use this.services.llm.sendToLLM() instead
   */
  async sendToLLM(message, options = {}) {
    return this.services.llm.sendToLLM(message, options);
  }

  /**
   * @deprecated Use this.services.llm.buildSystemMessage() instead
   */
  async buildSystemMessage() {
    return this.services.llm.buildSystemMessage();
  }

  /**
   * Show chat history in a modal dialog
   */
  showChatHistoryModal() {
    if (!this.services || !this.services.ui) {
      console.error('[ChatManager] ui not initialized');
      return;
    }
    return this.services.ui.showChatHistoryModal();
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
      endTime: null,
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
            endTime: null,
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
            endTime: currentMsg.timestamp,
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
                    <div class="message-content">${this.services.messaging.formatMessage(msg.message)}</div>
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

    navigator.clipboard
      .writeText(conversationText)
      .then(() => {
        this.showNotification('Conversation copied to clipboard', 'success');
      })
      .catch(err => {
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
      exportedAt: new Date().toISOString(),
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

    this.showNotification('Conversation exported successfully', 'success');
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

    const confirmed = confirm(
      `Are you sure you want to delete this conversation with ${conversation.messages.length} messages?`
    );
    if (!confirmed) return;

    try {
      let history = this.configManager.getChatHistory();

      // Remove all messages from this conversation
      const messageIds = conversation.messages.map(m => m.id);
      history = history.filter(msg => !messageIds.includes(msg.id));

      // Save updated history
      this.configManager.setChatHistory(history);
      this.configManager.save();

      this.showNotification('Conversation deleted successfully', 'success');

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
   * Confirm clearing all chat history
   */
  confirmClearHistory() {
    const confirmed = confirm('Are you sure you want to delete ALL chat history? This action cannot be undone.');
    if (!confirmed) return;

    const doubleConfirmed = confirm(
      'This will permanently delete all your chat conversations. Are you absolutely sure?'
    );
    if (!doubleConfirmed) return;

    try {
      this.configManager.clearChatHistory();
      this.configManager.save();

      this.showNotification('All chat history cleared', 'success');
      this.closeChatHistoryModal();

      // Also clear the current chat display
      this.services.messaging.clearChat();
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
    const results = history.filter(msg => msg.message.toLowerCase().includes(searchTerm.toLowerCase()));

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
      const highlightedMessage = msg.message.replace(new RegExp(`(${searchTerm})`, 'gi'), '<mark>$1</mark>');

      resultsHTML += `
                <div class="search-result-item" onclick="chatManager.services.messaging.showFullMessage('${msg.id}')">
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
   * Setup chat panel dragging functionality with drag-and-drop docking support
   */
  setupChatDragging() {
    if (!this.services || !this.services.ui) {
      console.error('[ChatManager] ui not initialized');
      return;
    }
    return this.services.ui.setupChatDragging();
  }

  /**
   * Show visual indicator for docking zone
   */
  showDockIndicator() {
    let indicator = document.getElementById('chatDockIndicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'chatDockIndicator';
      indicator.innerHTML = '<i class="fas fa-columns"></i><span>Dock Here</span>';
      document.body.appendChild(indicator);

      // Add styles
      indicator.style.cssText = `
        position: fixed;
        right: 20px;
        top: 50%;
        transform: translateY(-50%);
        background: rgba(13, 110, 253, 0.9);
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s ease;
      `;
    }
    indicator.style.opacity = '1';
  }

  /**
   * Hide visual indicator for docking zone
   */
  hideDockIndicator() {
    const indicator = document.getElementById('chatDockIndicator');
    if (indicator) {
      indicator.style.opacity = '0';
    }
  }

  /**
   * Show visual indicator for undocking
   */
  showUndockIndicator() {
    let indicator = document.getElementById('chatUndockIndicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'chatUndockIndicator';
      indicator.innerHTML = '<i class="fas fa-window-restore"></i><span>Release to Undock</span>';
      document.body.appendChild(indicator);

      // Add styles
      indicator.style.cssText = `
        position: fixed;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        background: rgba(25, 135, 84, 0.9);
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s ease;
      `;
    }
    indicator.style.opacity = '1';
  }

  /**
   * Hide visual indicator for undocking
   */
  hideUndockIndicator() {
    const indicator = document.getElementById('chatUndockIndicator');
    if (indicator) {
      indicator.style.opacity = '0';
    }
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
      handle.addEventListener('mousedown', e => {
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

    document.addEventListener('mousemove', e => {
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
        y: parseInt(chatPanel.style.top, 10),
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
        height: parseInt(chatPanel.style.height, 10),
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
    let { pdbData, proteinName, pdbId, uniprotId, geneName, _dataRef } = params;

    try {
      // Check if protein structure viewer is available
      if (!window.proteinStructureViewer || !window.proteinStructureViewer.openStructureViewer) {
        return {
          success: false,
          error: 'Protein structure viewer not available. Please ensure the protein viewer module is loaded.',
          message: 'Cannot open protein viewer: viewer module not found.',
        };
      }

      // If a _dataRef is provided, try to retrieve cached structure data first
      if (!pdbData && _dataRef && this.services && this.services.protein) {
        const cachedData = this.services.protein.getCachedStructureData(_dataRef);
        if (cachedData) {
          pdbData = cachedData;
          proteinName = proteinName || pdbId || uniprotId || geneName || 'Cached Structure';
          console.log('🔬 [openProteinViewer] Retrieved structure data from cache via _dataRef:', _dataRef);
        } else {
          console.warn('🔬 [openProteinViewer] _dataRef cache miss, will try download fallback:', _dataRef);
        }
      }

      // If no pdbData provided but uniprotId is available, fetch AlphaFold structure
      if (!pdbData && uniprotId) {
        console.log('🔬 [openProteinViewer] No PDB data provided, fetching AlphaFold structure for UniProt ID:', uniprotId);
        try {
          const alphaFoldResult = await this.downloadAlphaFoldStructure(uniprotId, 'pdb');
          if (alphaFoldResult && alphaFoldResult.pdbData) {
            pdbData = alphaFoldResult.pdbData;
            proteinName = proteinName || uniprotId;
            console.log(
              '🔬 [openProteinViewer] Successfully downloaded AlphaFold structure data, pdbData length:',
              pdbData.length
            );
          } else {
            console.warn('🔬 [openProteinViewer] Failed to download AlphaFold data for', uniprotId);
          }
        } catch (fetchError) {
          console.warn('🔬 [openProteinViewer] AlphaFold download failed:', fetchError.message);
        }
      }
      // If no pdbData provided but pdbId is available, fetch the PDB structure
      if (!pdbData && pdbId) {
        console.log('🔬 [openProteinViewer] No PDB data provided, fetching structure for PDB ID:', pdbId);

        try {
          // Directly download PDB file from RCSB database
          console.log('🔬 [openProteinViewer] Directly downloading PDB structure for ID:', pdbId);
          const pdbDataFromDownload = await this.downloadPDBFile(pdbId);

          if (pdbDataFromDownload) {
            pdbData = pdbDataFromDownload;
            proteinName = proteinName || pdbId;
            console.log(
              '🔬 [openProteinViewer] Successfully downloaded protein structure data, pdbData length:',
              pdbData.length
            );
          } else {
            console.warn('🔬 [openProteinViewer] Failed to download PDB data for', pdbId);
          }
        } catch (fetchError) {
          console.warn('🔬 [openProteinViewer] PDB download failed:', fetchError.message);
        }
      }

      // Validate that we now have the required data
      // If no structure data could be obtained, return a graceful failure instead of throwing
      if (!pdbData) {
        const identifier = pdbId || uniprotId || geneName || 'unknown';
        const attemptedSources = [];
        if (uniprotId) attemptedSources.push('AlphaFold');
        if (pdbId) attemptedSources.push('RCSB PDB');

        return {
          success: false,
          error: `No protein structure data available for ${identifier}`,
          pdbId: pdbId,
          uniprotId: uniprotId,
          geneName: geneName,
          attemptedSources: attemptedSources,
          message: `Could not retrieve protein structure for ${identifier}.` +
            (attemptedSources.length > 0
              ? ` Attempted sources: ${attemptedSources.join(', ')}. This may be due to network issues, the structure not being available in the database, or an invalid identifier.`
              : ' No structure source (PDB ID or UniProt ID) was provided.'),
          suggestions: [
            'Verify the PDB ID or UniProt ID is correct',
            'Check your internet connection',
            'Try searching for the structure first using search_alphafold_structures or search_pdb_structures',
          ],
        };
      }

      if (!proteinName) {
        proteinName = pdbId || 'Unknown Protein';
      }

      // Open the 3D viewer
      window.proteinStructureViewer.openStructureViewer(pdbData, proteinName, pdbId);

      return {
        success: true,
        pdbId: pdbId,
        uniprotId: uniprotId,
        message: `Opened 3D protein structure viewer for ${proteinName} (${pdbId || uniprotId || ''})`,
      };
    } catch (error) {
      console.error('Error in openProteinViewer:', error);
      // Return structured error instead of throwing — allows tool chain to continue gracefully
      return {
        success: false,
        error: error.message,
        message: `Failed to open protein viewer: ${error.message}`,
      };
    }
  }

  /**
   * Fetch protein structure from PDB database
   */
  async fetchProteinStructure(parameters) {
    return this.services.protein.fetchProteinStructure(parameters);
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

      console.log(
        `✅ [downloadPDBFile] Successfully downloaded PDB file for ${pdbId}, size: ${pdbData.length} characters`
      );
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
   * Search PDB database for experimental protein structures by gene name
   */
  async searchPDBStructures(parameters) {
    return this.services.protein.searchPDBStructures(parameters);
  }

  // Keep the old method name for backward compatibility, but deprecate it
  /**
   * Search UniProt database with various search types and filters
   * @param {Object} parameters - Search parameters
   * @returns {Promise<Object>} Search results
   */
  async searchUniProtDatabase(parameters) {
    return this.services.protein.searchUniProtDatabase(parameters);
  }

  /**
   * Get detailed information about a PDB structure
   */
  async getPDBDetails(pdbId) {
    return this.services.protein.getPDBDetails(pdbId);
  }


  /**
   * Search AlphaFold structures by gene name
   */
  async searchAlphaFoldByGene(parameters) {
    return this.services.protein.searchAlphaFoldStructures(parameters);
  }

  /**
   * Fetch AlphaFold structure data
   */
  async fetchAlphaFoldStructure(parameters) {
    return this.services.protein.fetchAlphaFoldStructure(parameters);
  }

  /**
   * Fetch protein structure data (from PDB or AlphaFold)
   */
  async fetchProteinStructure(parameters) {
    // Delegate to ProteinService which caches PDB data to prevent LLM context overflow.
    // The ProteinService version returns metadata + _dataRef instead of raw pdbData.
    if (this.services && this.services.protein) {
      return this.services.protein.fetchProteinStructure(parameters);
    }

    // Fallback: minimal metadata-only implementation if ProteinService is unavailable
    const pdbId = parameters.pdbId || parameters.pdb_id;
    const uniprotId = parameters.uniprotId || parameters.uniprot_id;

    try {
      if (pdbId) {
        const pdbUrl = `https://files.rcsb.org/download/${pdbId}.pdb`;
        const response = await fetch(pdbUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch PDB structure ${pdbId}: ${response.status}`);
        }
        // Don't return raw data — just confirm fetch succeeded
        const pdbData = await response.text();
        return {
          success: true,
          tool: 'fetch_protein_structure',
          pdbId: pdbId,
          source: 'RCSB PDB',
          dataLength: pdbData.length,
          downloadUrl: pdbUrl,
          timestamp: new Date().toISOString(),
          message: `Successfully fetched PDB structure for ${pdbId} (${pdbData.length} chars).`,
        };
      }

      if (uniprotId) {
        return await this.fetchAlphaFoldStructure({ uniprotId, geneName: parameters.geneName || parameters.gene_name });
      }

      throw new Error('Either pdbId or uniprotId must be provided');
    } catch (error) {
      console.error('Protein structure fetch error:', error);
      return {
        success: false,
        error: error.message,
        tool: 'fetch_protein_structure',
        parameters: parameters,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Search AlphaFold by protein sequence
   */
  async searchAlphaFoldBySequence(parameters) {
    const sequence = parameters.sequence;
    const maxResults = parameters.maxResults || 10;

    try {
      console.log(`Searching AlphaFold by sequence (length: ${sequence?.length})`);

      if (!sequence || sequence.length < 10) {
        throw new Error('Protein sequence must be at least 10 amino acids');
      }

      // Use UniProt BLAST search
      const searchUrl = `https://rest.uniprot.org/uniprotkb/search?query=${sequence.substring(0, 50)}&format=json&size=${maxResults}`;

      const response = await fetch(searchUrl, {
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`UniProt sequence search failed: ${response.status}`);
      }

      const data = await response.json();
      const results = (data.results || []).map(protein => ({
        uniprotId: protein.primaryAccession,
        proteinName: protein.proteinDescription?.recommendedName?.fullName?.value || 'Unknown',
        organism: protein.organism?.scientificName,
        alphaFoldUrl: `https://alphafold.ebi.ac.uk/entry/${protein.primaryAccession}`,
      }));

      return {
        success: true,
        tool: 'search_alphafold_by_sequence',
        parameters: { sequenceLength: sequence.length, maxResults },
        results: results,
        count: results.length,
        timestamp: new Date().toISOString(),
        message:
          results.length > 0
            ? `Found ${results.length} potential AlphaFold match(es)`
            : 'No AlphaFold matches found for sequence',
      };
    } catch (error) {
      console.error('AlphaFold sequence search error:', error);
      return {
        success: false,
        error: error.message,
        tool: 'search_alphafold_by_sequence',
        parameters: { sequenceLength: sequence?.length },
        timestamp: new Date().toISOString(),
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
          Accept: 'application/json',
          'User-Agent': 'CodeXomics/1.0',
        },
      });

      if (!response.ok) {
        // Try alternative search format
        const altUrl = `https://rest.uniprot.org/uniprotkb/search?query=${geneName}+AND+${organism.replace(' ', '+')}&format=json&size=${maxResults}`;
        console.log('Trying alternative UniProt search URL:', altUrl);

        const altResponse = await fetch(altUrl, {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'CodeXomics/1.0',
          },
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
    if (!this.services || !this.services.protein) {
      console.error('[ChatManager] protein not initialized');
      return;
    }
    return await this.services.protein.processUniProtResults(data, geneName, organism, maxResults);
  }

  /**
   * Check if AlphaFold structure is available for a UniProt ID
   */
  async checkAlphaFoldAvailability(uniprotId) {
    return this.services.protein.checkAlphaFoldAvailability(uniprotId);
  }

  /**
   * Download AlphaFold structure from AlphaFold database
   */
  async downloadAlphaFoldStructure(uniprotId, format = 'pdb') {
    try {
      console.log(`Downloading AlphaFold structure for ${uniprotId} in ${format} format`);

      const downloadUrl = `https://alphafold.ebi.ac.uk/files/AF-${uniprotId}-F1-model_v6.pdb`;

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
        downloadUrl: downloadUrl,
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
        interpretation: this.interpretAlphaFoldConfidence(avgConfidence),
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

        const result = await this.openProteinViewer({
          uniprotId: uniprotId,
          geneName: geneName,
        });

        if (result.success) {
          console.log('Successfully opened protein structure viewer');
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
    if (!this.services || !this.services.ui) {
      console.error('[ChatManager] ui not initialized');
      return;
    }
    return this.services.ui.addAlphaFoldSidebarStyles();
  }

  /**
   * Perform PDB search using RCSB PDB API
   */
  async performPDBSearch(geneName, organism, maxResults = 10) {
    try {
      console.log(`Performing PDB search for gene: ${geneName}, organism: ${organism}`);

      // Use RCSB PDB search API with improved query (POST request)
      const searchQuery = {
        query: {
          type: 'group',
          logical_operator: 'and',
          nodes: [
            {
              type: 'terminal',
              service: 'text',
              parameters: {
                attribute: 'rcsb_entity_source_organism.scientific_name',
                operator: 'contains_phrase',
                value: organism,
              },
            },
            {
              type: 'terminal',
              service: 'text',
              parameters: {
                attribute: 'struct.title',
                operator: 'contains_words',
                value: geneName,
              },
            },
          ],
        },
        request_options: {
          paginate: {
            start: 0,
            rows: maxResults,
          },
        },
        return_type: 'entry',
      };

      console.log('PDB search query:', JSON.stringify(searchQuery, null, 2));

      // Fixed: Use POST request instead of GET with URL parameter
      const response = await fetch('https://search.rcsb.org/rcsbsearch/v2/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(searchQuery),
      });

      if (!response.ok) {
        console.warn(`PDB search failed with ${response.status}: ${response.statusText}`);
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
      query: {
        type: 'terminal',
        service: 'text',
        parameters: {
          attribute: 'struct.title',
          operator: 'contains_words',
          value: geneName,
        },
      },
      request_options: {
        paginate: {
          start: 0,
          rows: maxResults,
        },
      },
      return_type: 'entry',
    };

    // Fixed: Use POST request for fallback search as well
    const response = await fetch('https://search.rcsb.org/rcsbsearch/v2/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(simpleQuery),
    });

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
            downloadUrl: `https://files.rcsb.org/download/${pdbId}.pdb`,
          });
        } catch (error) {
          console.warn(`Failed to get details for PDB ${pdbId}:`, error.message);
          // Add basic result even if details fail
          results.push({
            pdbId: pdbId,
            title: 'Unknown',
            geneName: geneName,
            pdbUrl: `https://www.rcsb.org/structure/${pdbId}`,
            downloadUrl: `https://files.rcsb.org/download/${pdbId}.pdb`,
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
      lysc: {
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
            downloadUrl: 'https://files.rcsb.org/download/2J0W.pdb',
          },
        ],
      },
    };

    const geneKey = geneName.toLowerCase();
    if (knownStructures[geneKey] && knownStructures[geneKey][organism]) {
      return knownStructures[geneKey][organism];
    }

    return [];
  }

  /**

        const result = await this.openProteinViewer({
          pdbId: pdbId,
          geneName: geneName,
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
    if (!this.services || !this.services.ui) {
      console.error('[ChatManager] ui not initialized');
      return;
    }
    return this.services.ui.addPDBSidebarStyles();
  }

  /**
   * @deprecated Use this.services.tools.testMicrobeGenomicsIntegration() instead
   */
  testMicrobeGenomicsIntegration() {
    return this.services.tools.testMicrobeGenomicsIntegration();
  }

  /**
   * @deprecated Use this.services.tools.testToolExecution() instead
   */
  async testToolExecution() {
    return this.services.tools.testToolExecution();
  }

  // ====================================
  // BLAST SEARCH FUNCTIONALITY
  // ====================================

  async blastSearch(params) {
    return this.services.blast.blastSearch(params);
  }

  async blastSequenceFromRegion(params) {
    return this.services.blast.blastSequenceFromRegion(params);
  }

  getBlastDatabases(params) {
    return this.services.blast.getBlastDatabases(params);
  }

  // ====================================
  // ENHANCED BLAST FUNCTIONALITY WITH MCP INTEGRATION
  // ====================================

  async batchBlastSearch(params) {
    return this.services.blast.batchBlastSearch(params);
  }

  async localBlastDatabaseInfo(params) {
    return this.services.blast.localBlastDatabaseInfo(params);
  }

  async executeMCPBlastTool(toolName, params) {
    return this.services.blast.executeMCPBlastTool(toolName, params);
  }

  async advancedBlastSearch(params) {
    return this.services.blast.advancedBlastSearch(params);
  }

  applyBlastFilters(hits, filters) {
    return this.services.blast.applyBlastFilters(hits, filters);
  }

  async getGenomeInfo(params = {}) {
    const { include_statistics = true, include_annotations = true, include_chromosomes = true } = params;

    if (!this.app || !this.app.currentSequence) {
      return {
        success: false,
        error: 'No genome loaded',
        genome_name: null,
        chromosomes: [],
        statistics: null,
        annotations: null,
      };
    }

    const sequences = Object.keys(this.app.currentSequence);
    const totalLength = Object.values(this.app.currentSequence).reduce((sum, seq) => sum + seq.length, 0);

    const result = {
      success: true,
      genome_name: this.app.currentGenomeName || this.app.loadedFiles?.[0]?.name || 'Unknown',
      organism: this.app.organism || 'Unknown',
      total_length: totalLength,
      chromosome_count: sequences.length,
    };

    if (include_chromosomes) {
      result.chromosomes = sequences.map(chr => ({
        name: chr,
        length: this.app.currentSequence[chr]?.length || 0,
      }));
    }

    if (include_statistics) {
      const annotationCount = this.app.currentAnnotations
        ? Object.values(this.app.currentAnnotations).reduce((sum, anns) => sum + (Array.isArray(anns) ? anns.length : 0), 0)
        : 0;
      result.statistics = {
        total_length: totalLength,
        total_chromosomes: sequences.length,
        total_annotations: annotationCount,
        loaded_files: this.app.loadedFiles?.length || 0,
        gc_content: this.calculateGCContent(
          Object.values(this.app.currentSequence).join('')
        ),
      };
    }

    if (include_annotations) {
      const annotationCount = this.app.currentAnnotations
        ? Object.values(this.app.currentAnnotations).reduce((sum, anns) => sum + (Array.isArray(anns) ? anns.length : 0), 0)
        : 0;
      result.annotations = {
        total_count: annotationCount,
        types: this.app.currentAnnotations
          ? [...new Set(
              Object.values(this.app.currentAnnotations)
                .flat()
                .map(a => a.type || a.featureType || 'unknown')
            )]
          : [],
      };
    }

    return result;
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
    if (!this.services || !this.services.ui) {
      console.error('[ChatManager] ui not initialized');
      return;
    }
    return await this.services.ui.showMetabolicPathway(params);
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
          `${pathwayName}R`,
          `${pathwayName}regulator`,
          `${pathwayName}activator`,
          'crp',
          'cra',
          'fnr',
          'arcA', // Common regulatory genes
        ];

        for (const term of regulatorySearchTerms) {
          try {
            const regResult = await this.services.tools.searchFeatures({ query: term, caseSensitive: false });
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
        summary: `Found ${foundGenes.length} metabolic genes${includeRegulation ? ` and ${regulatoryGenes.length} regulatory genes` : ''} for ${pathwayName}`,
      };
    } catch (error) {
      console.error('Error finding pathway genes:', error);
      return {
        success: false,
        error: error.message,
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
      recommendations: [],
    };

    try {
      const context = this.services.llm.getCurrentContext();
      const allTools = context.genomeBrowser.availableTools;

      // 统计各类工具数量
      report.summary = {
        totalTools: allTools.length,
        localTools: context.genomeBrowser.toolSources.local,
        pluginTools: context.genomeBrowser.toolSources.plugins,
        mcpTools: context.genomeBrowser.toolSources.mcp,
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
        mcp: [],
      };

      allTools.forEach(tool => {
        let category = 'other';

        if (tool.includes('navigate') || tool.includes('zoom') || tool.includes('scroll') || tool.includes('jump')) {
          category = 'navigation';
        } else if (tool.includes('search') || tool.includes('find')) {
          category = 'search';
        } else if (
          tool.includes('sequence') ||
          tool.includes('translate') ||
          tool.includes('gc') ||
          tool.includes('reverse')
        ) {
          category = 'sequence';
        } else if (
          tool.includes('analyze') ||
          tool.includes('calculate') ||
          tool.includes('predict') ||
          tool.includes('statistics')
        ) {
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
        functions: microbeTools,
      };

      // 检查插件系统
      report.details.plugins = {
        integratorAvailable: !!this.pluginFunctionCallsIntegrator,
        managerAvailable: !!this.pluginManager,
        mappedFunctions: this.pluginFunctionCallsIntegrator
          ? this.pluginFunctionCallsIntegrator.pluginFunctionMap.size
          : 0,
      };

      // 检查MCP服务器
      report.details.mcp = {
        managerAvailable: !!this.mcpServerManager,
        connectedServers: this.mcpServerManager ? this.mcpServerManager.getConnectedServersCount() : 0,
        availableTools: this.mcpServerManager ? this.mcpServerManager.getAllAvailableTools().length : 0,
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
      // 更新 message-icon 为完成状态的对号图标
      const messageIcon = thinkingElement.querySelector('.message-icon i');
      if (messageIcon) {
        messageIcon.classList.remove('fa-spin');
        messageIcon.classList.remove('fa-cog');
        messageIcon.classList.add('fa-check-circle');
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
      this.services.messaging.removeTypingIndicator();

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
    const toggleChatBtn = document.getElementById('toggleChatBtn');

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
      if (toggleChatBtn) {
        toggleChatBtn.classList.add('ai-processing');
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
      if (toggleChatBtn) {
        toggleChatBtn.classList.remove('ai-processing');
      }
    }
  }

  /**
   * 添加工具执行结果显示
   */
  addToolResultMessage(toolResults) {
    if (!this.services || !this.services.context) {
      console.error('[ChatManager] context not initialized');
      return;
    }
    return this.services.context.addToolResultMessage(toolResults);
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
   * Message History Browsing Methods
   */

  /**
   * Update user message history array
   */
  updateUserMessageHistory() {
    try {
      const fullHistory = this.configManager?.getChatHistory() || [];
      this.messageHistory.userMessages = fullHistory.filter(msg => msg.sender === 'user').map(msg => msg.message);

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

    console.log(
      `History browse up: ${this.messageHistory.currentIndex + 1}/${this.messageHistory.userMessages.length}`
    );
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
      console.log(
        `History browse down: ${this.messageHistory.currentIndex + 1}/${this.messageHistory.userMessages.length}`
      );
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
      metadata: { source: 'integration_test' },
    });

    const updatedSummary = this.getEvolutionDataSummary();
    console.log('Updated Evolution Data:', updatedSummary);

    return {
      status: 'Evolution integration test completed',
      summary: updatedSummary,
      testEventAdded: true,
    };
  }



  // ============================================================
  // Benchmark Tools
  // ============================================================

  /**
   * Helper to get benchmarkManager from app or window global.
   */
  _getBenchmarkManager() {
    return (this.app && this.app.benchmarkManager) || window.benchmarkManager || null;
  }

  /**
   * Open the benchmark interface.
   */
  async openBenchmark(_parameters = {}) {
    let bm = this._getBenchmarkManager();
    if (!bm) {
      // Benchmark modules not yet loaded — initialize on demand via the app
      if (this.app && typeof this.app.initializeBenchmarkSystemOnDemand === 'function') {
        try {
          bm = await this.app.initializeBenchmarkSystemOnDemand();
        } catch (e) {
          console.error('[openBenchmark] On-demand initialization failed:', e);
          return { success: false, error: 'Failed to initialize benchmark system: ' + e.message };
        }
      } else {
        return { success: false, error: 'Benchmark system not available. Please open it manually from the menu.' };
      }
    }
    await bm.showBenchmarkInterface();
    return { success: true, message: 'Benchmark interface opened' };
  }

  /**
   * Start a benchmark run with the given options.
   */
  async startBenchmark(parameters = {}) {
    let bm = this._getBenchmarkManager();
    if (!bm) {
      // Benchmark modules not yet loaded — initialize on demand via the app
      if (this.app && typeof this.app.initializeBenchmarkSystemOnDemand === 'function') {
        try {
          bm = await this.app.initializeBenchmarkSystemOnDemand();
        } catch (e) {
          console.error('[startBenchmark] On-demand initialization failed:', e);
          return { success: false, error: 'Failed to initialize benchmark system: ' + e.message };
        }
      } else {
        return { success: false, error: 'Benchmark system not available. Please open it manually from the menu.' };
      }
    }

    // Wait for initialization
    await bm.waitForInitialization();

    const suites = parameters.suites || ['automatic_simple', 'automatic_complex'];
    const timeout = parameters.timeout !== undefined ? parameters.timeout : 120000;
    const testDelay = parameters.test_delay !== undefined ? parameters.test_delay : 60000;
    const generateReport = parameters.generate_report !== undefined ? parameters.generate_report : true;
    const includeCharts = parameters.include_charts !== undefined ? parameters.include_charts : true;
    const includeRawData = parameters.include_raw_data !== undefined ? parameters.include_raw_data : false;
    const stopOnError = parameters.stop_on_error !== undefined ? parameters.stop_on_error : false;

    // Open the interface first so the user can see progress
    try {
      await bm.showBenchmarkInterface();
    } catch (_e) {
      // Non-fatal — continue even if UI open fails
    }

    // Pre-configure the UI form to match programmatic options, then delegate to the
    // UI's own startMainWindowBenchmark() so it owns the running-state, timers,
    // progress bar, and results display — avoiding the postMessage DataCloneError.
    setTimeout(() => {
      try {
        // Suite checkboxes
        const allSuiteIds = ['automatic_simple', 'automatic_complex', 'manual_suite', 'manual_complex'];
        for (const id of allSuiteIds) {
          const cb = document.getElementById(`suite-${id}`);
          if (cb) cb.checked = suites.includes(id);
        }
        // Timeout (-1 signals individual-test timeouts)
        const timeoutEl = document.getElementById('testTimeout');
        if (timeoutEl) timeoutEl.value = timeout === null ? '-1' : String(timeout);
        // Delay between batches
        const testDelayEl = document.getElementById('testDelay');
        if (testDelayEl) testDelayEl.value = String(testDelay);
        // Report options
        const reportEl = document.getElementById('generateReport');
        if (reportEl) reportEl.checked = generateReport;
        const chartsEl = document.getElementById('includeCharts');
        if (chartsEl) chartsEl.checked = includeCharts;
        const rawDataEl = document.getElementById('includeRawData');
        if (rawDataEl) rawDataEl.checked = includeRawData;
        const stopOnErrorEl = document.getElementById('stopOnError');
        if (stopOnErrorEl) stopOnErrorEl.checked = stopOnError;

        // Trigger via the UI so it handles running-state, elapsed timer, and results display
        if (bm.ui && typeof bm.ui.startMainWindowBenchmark === 'function') {
          bm.ui.startMainWindowBenchmark();
        } else {
          console.warn('[startBenchmark] BenchmarkUI.startMainWindowBenchmark not available — falling back to direct run');
          bm.framework.runAllBenchmarks({
            suites, timeout, testDelay, generateReport, includeCharts, includeRawData, stopOnError,
          }).catch(err => console.error('[startBenchmark] Fallback run error:', err));
        }
      } catch (e) {
        console.error('[startBenchmark] Failed to configure and start benchmark via UI:', e);
      }
    }, 250);

    return {
      success: true,
      message: `Benchmark starting with suites: ${suites.join(', ')}`,
      suites,
    };
  }

  /**
   * Stop the currently running benchmark.
   */
  async stopBenchmark(_parameters = {}) {
    const bm = this._getBenchmarkManager();
    if (!bm || !bm.framework) {
      return { success: false, error: 'Benchmark system not available' };
    }
    if (!bm.framework.isRunning) {
      return { success: false, error: 'No benchmark is currently running' };
    }
    bm.framework.stopBenchmark();
    return { success: true, message: 'Benchmark stopped' };
  }

  /**
   * Pause the currently running benchmark.
   */
  async pauseBenchmark(_parameters = {}) {
    const bm = this._getBenchmarkManager();
    if (!bm || !bm.framework) {
      return { success: false, error: 'Benchmark system not available' };
    }
    if (!bm.framework.isRunning) {
      return { success: false, error: 'No benchmark is currently running' };
    }
    bm.framework.pauseBenchmark();
    return { success: true, message: 'Benchmark paused' };
  }

  /**
   * Resume a paused benchmark.
   */
  async resumeBenchmark(_parameters = {}) {
    const bm = this._getBenchmarkManager();
    if (!bm || !bm.framework) {
      return { success: false, error: 'Benchmark system not available' };
    }
    if (!bm.framework.isPaused) {
      return { success: false, error: 'No benchmark is paused' };
    }
    bm.framework.resumeBenchmark();
    return { success: true, message: 'Benchmark resumed' };
  }

  /**
   * Get benchmark results/history.
   */
  async getBenchmarkResults(parameters = {}) {
    const bm = this._getBenchmarkManager();
    if (!bm || !bm.framework) {
      return { success: false, error: 'Benchmark system not available' };
    }

    const history = bm.framework.getBenchmarkHistory();
    if (!history || history.length === 0) {
      return { success: false, error: 'No benchmark history available. Run a benchmark first.' };
    }

    // If a specific index requested
    if (parameters.index !== undefined) {
      const idx = parameters.index === -1 ? history.length - 1 : parameters.index;
      const run = history[idx];
      if (!run) {
        return { success: false, error: `No benchmark run at index ${parameters.index}` };
      }
      return {
        success: true,
        totalRuns: history.length,
        run: {
          index: idx,
          date: new Date(run.startTime).toLocaleString(),
          duration: Math.round(run.duration / 1000),
          successRate: run.overallStats.overallSuccessRate.toFixed(1),
          totalTests: run.overallStats.totalTests,
          passedTests: run.overallStats.passedTests,
          failedTests: run.overallStats.failedTests,
          suites: run.options && run.options.suites ? run.options.suites : [],
        },
      };
    }

    // Return summary statistics
    const stats = bm.getBenchmarkStatistics();
    return {
      success: true,
      totalRuns: history.length,
      latestRun: stats ? stats.latestRun : null,
      averageSuccessRate: stats ? Number(stats.averageSuccessRate.toFixed(1)) : null,
      runs: history.map((run, idx) => ({
        index: idx,
        date: new Date(run.startTime).toLocaleString(),
        duration: Math.round(run.duration / 1000),
        successRate: run.overallStats.overallSuccessRate.toFixed(1),
        totalTests: run.overallStats.totalTests,
        passedTests: run.overallStats.passedTests,
      })),
    };
  }

  /**
   * Get the current status of the benchmark system.
   */
  async getBenchmarkStatus(_parameters = {}) {
    const bm = this._getBenchmarkManager();
    if (!bm) {
      return {
        success: true,
        initialized: false,
        frameworkReady: false,
        isRunning: false,
        isPaused: false,
        testSuitesLoaded: 0,
        totalRuns: 0,
        message: 'Benchmark system not yet initialized. Open the benchmark panel to initialize.',
      };
    }

    const systemStatus = bm.getSystemStatus();
    const history = bm.framework ? bm.framework.getBenchmarkHistory() : [];
    const isRunning = !!(bm.framework && bm.framework.isRunning);
    const isPaused = !!(bm.framework && bm.framework.isPaused);

    return {
      success: true,
      initialized: systemStatus.initialized,
      frameworkReady: systemStatus.frameworkReady,
      uiReady: systemStatus.uiReady,
      isRunning,
      isPaused,
      testSuitesLoaded: systemStatus.testSuitesLoaded,
      totalRuns: history.length,
    };
  }

  /**
   * Export benchmark results in the specified format.
   */
  async exportBenchmarkResults(parameters = {}) {
    const bm = this._getBenchmarkManager();
    if (!bm || !bm.framework) {
      return { success: false, error: 'Benchmark system not available' };
    }

    const history = bm.framework.getBenchmarkHistory();
    if (!history || history.length === 0) {
      return { success: false, error: 'No benchmark results available to export. Run a benchmark first.' };
    }

    const format = (parameters.format || 'json').toLowerCase();
    const validFormats = ['json', 'csv', 'html'];
    if (!validFormats.includes(format)) {
      return { success: false, error: `Invalid format '${format}'. Supported formats: json, csv, html` };
    }

    try {
      await bm.framework.exportResults(format);
      return { success: true, message: `Benchmark results exported as ${format}` };
    } catch (err) {
      return { success: false, error: `Export failed: ${err.message}` };
    }
  }
}
