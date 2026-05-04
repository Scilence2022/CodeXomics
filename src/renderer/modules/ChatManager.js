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
      file: new window.FileOperationService(this.app, this),
      analysis: new window.GenomeAnalysisService(this.app, this),
      protein: new window.ProteinService(this.app, this),
      blast: new window.BlastService(this.app, this),
      annotation: new window.AnnotationService(this.app, this),
      intent: new window.IntentParserService(this.app, this),
      context: new window.LLMContextService(this.app, this),
      ui: new window.UIService(this.app, this)
    };

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
      this.addMessageToChat(markedPrompt, 'user');

      // Show thinking process
      this.showThinkingProcess && this.addThinkingMessage('🔗 MCP Agent request — analyzing...');
      this.showTypingIndicator();

      try {
        // Execute via the main sendToLLM pipeline — same as user typing in ChatBox
        const response = await this.sendToLLM(prompt);

        // Display response in ChatBox
        this.removeTypingIndicator();
        this.addMessageToChat(response, 'assistant');

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
        this.removeTypingIndicator();
        if (llmError.name === 'AbortError') {
          this.addMessageToChat('MCP Agent request aborted by user.', 'assistant', false, 'warning');
        } else {
          this.addMessageToChat(`MCP Agent request failed: ${llmError.message}`, 'assistant', true);
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

      // Call the Electron API to open the markdown viewer
      if (window.electronAPI && window.electronAPI.openMarkdownViewer) {
        const result = await window.electronAPI.openMarkdownViewer({
          filePath,
          title,
        });

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
      } else {
        throw new Error('electronAPI.openMarkdownViewer not available');
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
    const context = this.getCurrentContext();

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
                    <div class="mcp-server-name">${this.escapeHtml(server.name)}</div>
                    <div class="mcp-server-details">
                        <span class="mcp-server-url">${this.escapeHtml(server.url)}</span>
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
      result = await this.executeToolWithPriority(toolName, parameters);

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
      result = await this.executeToolByName(toolName, parameters);

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
        throw new Error(
          'No chromosome specified and unable to auto-detect current chromosome. Please load genome data first.'
        );
      }
    }

    // Check if the target chromosome exists in loaded data
    if (!this.app.currentSequence || !this.app.currentSequence[chromosome]) {
      // List available chromosomes for better error message
      const availableChromosomes = this.app.currentSequence ? Object.keys(this.app.currentSequence) : [];
      throw new Error(
        `Chromosome ${chromosome} not found in loaded genome data. Available chromosomes: ${availableChromosomes.join(', ')}`
      );
    }

    // Handle position parameter with default 2000bp range
    if (position !== undefined && (start === undefined || end === undefined)) {
      const defaultRange = 2000;
      start = Math.max(1, position - Math.floor(defaultRange / 2));
      end = position + Math.floor(defaultRange / 2);
      console.log(`Using position ${position} with default ${defaultRange}bp range: ${start}-${end}`);
    }

    // Handle start=end or start-only: center on position with ~2kb window (±1kb)
    if (start !== undefined && (end === undefined || start === end)) {
      const center = start;
      const halfRange = 1000;
      start = Math.max(1, center - halfRange);
      end = center + halfRange;
      console.log(`Centering on position ${center} with ±${halfRange}bp range: ${start}-${end}`);
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
      usedDefaultRange: position !== undefined && (params.start === undefined || params.end === undefined),
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

        // Handle start=end or start-only: center on position with ~2kb window (±1kb)
        if (start !== undefined && (end === undefined || start === end)) {
          const center = start;
          const halfRange = 1000;
          finalStart = Math.max(1, center - halfRange);
          finalEnd = center + halfRange;
          usedDefaultRange = true;
          console.log(`Centering on position ${center} with ±${halfRange}bp range: ${finalStart}-${finalEnd}`);
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
        usedDefaultRange: usedDefaultRange,
      };
    } catch (error) {
      console.error('❌ [ChatManager] Error opening new tab:', error);
      throw error;
    }
  }

  /**
   * Switch to a specific tab by ID, name, or index - Built-in function tool
   * @param {Object} params - Tool parameters
   * @param {string} params.tab_id - Specific tab ID to switch to
   * @param {string} params.tab_name - Tab name/title to search for (partial matching)
   * @param {number} params.tab_index - Zero-based index of tab to switch to
   * @param {string} params.clientId - Optional client identifier
   * @returns {Object} Switch result
   */
  async switchToTab(params) {
    const { tab_id, tab_name, tab_index, clientId } = params;

    console.log('🔧 [ChatManager] switchToTab called with params:', params);

    try {
      // Use window.genomeBrowser for access
      const genomeBrowser = window.genomeBrowser;
      if (!genomeBrowser) {
        throw new Error('Genome browser not available via window.genomeBrowser');
      }

      // Wait for TabManager to be initialized
      if (!genomeBrowser.tabManager) {
        console.log('⏳ TabManager not ready, waiting...');
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

      let targetTabId = null;
      let targetTabTitle = null;
      const tabEntries = Array.from(genomeBrowser.tabManager.tabs.entries());

      // Strategy 1: Switch by specific tab ID
      if (tab_id) {
        if (genomeBrowser.tabManager.tabs.has(tab_id)) {
          targetTabId = tab_id;
          const tabState = genomeBrowser.tabManager.tabs.get(tab_id);
          targetTabTitle = tabState.title || `Tab ${tab_id}`;
          console.log(`🎯 [ChatManager] Found tab by ID: ${tab_id}`);
        } else {
          throw new Error(`Tab with ID '${tab_id}' not found`);
        }
      }
      // Strategy 2: Switch by tab name/title (case-insensitive partial matching)
      else if (tab_name) {
        const foundTab = tabEntries.find(([tabId, tabState]) => {
          if (tabState.title) {
            return tabState.title.toLowerCase().includes(tab_name.toLowerCase());
          }
          return false;
        });

        if (foundTab) {
          targetTabId = foundTab[0];
          targetTabTitle = foundTab[1].title;
          console.log(`🎯 [ChatManager] Found tab by name '${tab_name}': ${targetTabId} - ${targetTabTitle}`);
        } else {
          throw new Error(`No tab found matching name '${tab_name}'`);
        }
      }
      // Strategy 3: Switch by tab index (zero-based)
      else if (tab_index !== undefined) {
        const tabIds = Array.from(genomeBrowser.tabManager.tabs.keys());
        if (tab_index >= 0 && tab_index < tabIds.length) {
          targetTabId = tabIds[tab_index];
          const tabState = genomeBrowser.tabManager.tabs.get(targetTabId);
          targetTabTitle = tabState.title || `Tab ${targetTabId}`;
          console.log(`🎯 [ChatManager] Found tab by index ${tab_index}: ${targetTabId} - ${targetTabTitle}`);
        } else {
          throw new Error(`Tab index ${tab_index} is out of range (0-${tabIds.length - 1})`);
        }
      } else {
        throw new Error('At least one parameter (tab_id, tab_name, or tab_index) must be provided');
      }

      // Perform the tab switch
      if (targetTabId) {
        // Use the TabManager's switchTab method
        genomeBrowser.tabManager.switchTab(targetTabId);

        console.log(`✅ [ChatManager] Successfully switched to tab: ${targetTabId} - ${targetTabTitle}`);

        return {
          success: true,
          tab_id: targetTabId,
          tab_title: targetTabTitle,
          message: `Successfully switched to tab: ${targetTabTitle}`,
          clientId: clientId,
        };
      } else {
        throw new Error('Failed to identify target tab');
      }
    } catch (error) {
      console.error('❌ [ChatManager] Error switching tab:', error);
      return {
        success: false,
        error: error.message,
        clientId: clientId,
      };
    }
  }

  /**
   * Close a specific tab by ID, name, or index - Built-in function tool
   * @param {Object} params - Tool parameters
   * @param {string} params.tab_id - Specific tab ID to close
   * @param {string} params.tab_name - Tab name/title to search for (partial matching)
   * @param {number} params.tab_index - Zero-based index of tab to close
   * @param {string} params.clientId - Optional client identifier
   * @returns {Object} Close result
   */
  async closeTab(params) {
    const { tab_id, tab_name, tab_index, clientId } = params;

    console.log('🔧 [ChatManager] closeTab called with params:', params);

    try {
      const genomeBrowser = this.app;

      // Wait for tabManager to be available
      if (!genomeBrowser.tabManager) {
        throw new Error('TabManager not available');
      }

      const tabManager = genomeBrowser.tabManager;

      // Prevent closing the last tab
      if (tabManager.tabs.size <= 1) {
        throw new Error('Cannot close the last remaining tab');
      }

      let targetTabId = null;
      let targetTabTitle = null;
      const tabEntries = Array.from(tabManager.tabs.entries());

      // Strategy 1: Close by specific tab ID
      if (tab_id) {
        if (tabManager.tabs.has(tab_id)) {
          targetTabId = tab_id;
          const tabState = tabManager.tabStates?.get(tab_id);
          targetTabTitle = tabState?.title || `Tab ${tab_id}`;
        } else {
          throw new Error(`Tab with ID '${tab_id}' not found`);
        }
      }
      // Strategy 2: Close by tab name/title (case-insensitive partial matching)
      else if (tab_name) {
        const foundTab = tabEntries.find(([tabId, tabElement]) => {
          const tabState = tabManager.tabStates?.get(tabId);
          if (tabState?.title) {
            return tabState.title.toLowerCase().includes(tab_name.toLowerCase());
          }
          return false;
        });

        if (foundTab) {
          targetTabId = foundTab[0];
          targetTabTitle = tabManager.tabStates?.get(targetTabId)?.title;
        } else {
          throw new Error(`No tab found matching name '${tab_name}'`);
        }
      }
      // Strategy 3: Close by tab index (zero-based)
      else if (tab_index !== undefined) {
        const tabIds = Array.from(tabManager.tabs.keys());
        if (tab_index >= 0 && tab_index < tabIds.length) {
          targetTabId = tabIds[tab_index];
          const tabState = tabManager.tabStates?.get(targetTabId);
          targetTabTitle = tabState?.title || `Tab ${targetTabId}`;
        } else {
          throw new Error(`Tab index ${tab_index} is out of range (0-${tabIds.length - 1})`);
        }
      } else {
        throw new Error('At least one parameter (tab_id, tab_name, or tab_index) must be provided');
      }

      // Perform the tab close
      if (targetTabId) {
        tabManager.closeTab(targetTabId);

        console.log(`✅ [ChatManager] Successfully closed tab: ${targetTabId} - ${targetTabTitle}`);

        return {
          success: true,
          closed_tab_id: targetTabId,
          closed_tab_title: targetTabTitle,
          remaining_tabs: tabManager.tabs.size,
          message: `Closed tab: ${targetTabTitle}`,
          clientId: clientId,
        };
      } else {
        throw new Error('Failed to identify target tab');
      }
    } catch (error) {
      console.error('❌ [ChatManager] Error closing tab:', error);
      return {
        success: false,
        error: error.message,
        clientId: clientId,
      };
    }
  }

  /**
   * Switch to a specific tab by ID, name, or index
   */
  async switchToTab(params) {
    const { tab_id, tab_name, tab_index, clientId } = params;

    console.log('🔧 [ChatManager] switchToTab called with params:', params);

    try {
      // Use window.genomeBrowser instead of this.app for access
      const genomeBrowser = window.genomeBrowser;
      if (!genomeBrowser) {
        throw new Error('Genome browser not available via window.genomeBrowser');
      }

      // Wait for TabManager to be initialized
      if (!genomeBrowser.tabManager) {
        console.log('⏳ TabManager not ready, waiting...');
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

      // Get current active tab for reference
      const previousTabId = genomeBrowser.tabManager.activeTabId;
      let targetTabId = null;
      let targetTabTitle = null;

      // Strategy 1: Switch by specific tab ID
      if (tab_id) {
        if (genomeBrowser.tabManager.tabs.has(tab_id)) {
          targetTabId = tab_id;
          const tabState = genomeBrowser.tabManager.tabStates.get(tab_id);
          targetTabTitle = tabState?.title || 'Unknown';
        } else {
          throw new Error(`Tab with ID '${tab_id}' not found`);
        }
      }
      // Strategy 2: Switch by tab name/title
      else if (tab_name) {
        const tabEntries = Array.from(genomeBrowser.tabManager.tabStates.entries());
        const foundTab = tabEntries.find(
          ([tabId, tabState]) => tabState.title && tabState.title.toLowerCase().includes(tab_name.toLowerCase())
        );

        if (foundTab) {
          targetTabId = foundTab[0];
          targetTabTitle = foundTab[1].title;
        } else {
          throw new Error(`Tab with name containing '${tab_name}' not found`);
        }
      }
      // Strategy 3: Switch by tab index
      else if (tab_index !== undefined) {
        const tabIds = Array.from(genomeBrowser.tabManager.tabs.keys());
        if (tab_index >= 0 && tab_index < tabIds.length) {
          targetTabId = tabIds[tab_index];
          const tabState = genomeBrowser.tabManager.tabStates.get(targetTabId);
          targetTabTitle = tabState?.title || 'Unknown';
        } else {
          throw new Error(`Tab index ${tab_index} is out of range (0-${tabIds.length - 1})`);
        }
      } else {
        throw new Error('Must provide either tab_id, tab_name, or tab_index');
      }

      // Perform the tab switch
      genomeBrowser.tabManager.switchToTab(targetTabId);

      console.log(`✅ [ChatManager] Successfully switched to tab: ${targetTabId} - ${targetTabTitle}`);

      return {
        success: true,
        tab_id: targetTabId,
        tab_title: targetTabTitle,
        previous_tab_id: previousTabId,
        message: `Switched to tab: ${targetTabTitle}`,
      };
    } catch (error) {
      console.error('❌ [ChatManager] Error switching tab:', error);
      throw error;
    }
  }

  async searchFeatures(params) {
    const { query, caseSensitive } = params;

    // Log tool detection as requested by Song
    console.log('🔍 [Tool Detection] search_features tool called with params:', params);
    console.log(
      '🔍 [Tool Detection] Detected tool: search_features, parameters: query="' +
      query +
      '", caseSensitive=' +
      (caseSensitive || false)
    );

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

      // Auto-scroll sidebar to search results panel (similar to Gene Details)
      if (searchResults.length > 0 && this.app.scrollSidebarToSection) {
        const searchResultsSection = document.getElementById('searchResultsSection');
        if (searchResultsSection) {
          this.app.scrollSidebarToSection(searchResultsSection);
          console.log('🔄 Auto-scrolled sidebar to search results panel');
        }
      }

      // Restore original setting
      if (caseSensitiveCheckbox && originalCaseSensitive !== undefined) {
        caseSensitiveCheckbox.checked = originalCaseSensitive;
      }

      console.log('Search completed, results:', searchResults);

      // CRITICAL FIX: Filter results to remove verbose data and prevent token overflow
      const optimizedResults = searchResults.map(result => {
        if (result.annotation) {
          // Return only essential annotation data, excluding verbose note field
          return {
            ...result,
            annotation: {
              start: result.annotation.start,
              end: result.annotation.end,
              type: result.annotation.type,
              strand: result.annotation.strand,
              qualifiers: {
                gene: result.annotation.qualifiers?.gene,
                locus_tag: result.annotation.qualifiers?.locus_tag,
                product: result.annotation.qualifiers?.product,
                // NOTE: Intentionally excluding 'note' field to prevent token overflow
              },
            },
          };
        }
        return result;
      });

      console.log(
        '🔍 [Tool Detection] search_features completed, returning',
        optimizedResults.length,
        'optimized results (note fields excluded)'
      );

      return {
        query: query,
        caseSensitive: caseSensitive || false,
        results: optimizedResults, // Return optimized results instead of raw results
        count: optimizedResults.length,
        optimization_note: 'Results optimized to exclude verbose note fields for token efficiency',
      };
    }

    throw new Error('Navigation manager not available');
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
      visibleTracks: this.getVisibleTracks(),
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

  async toggleTrack(params) {
    // Support both camelCase and snake_case parameter names
    const trackName = params.trackName || params.track_name;
    let visible = params.visible;
    const action = params.action;

    if (!trackName) {
      throw new Error('trackName or track_name parameter is required');
    }

    // Convert action to visible if visible is not specified
    if (visible === undefined && action) {
      if (action === 'show') {
        visible = true;
      } else if (action === 'hide') {
        visible = false;
      } else {
        throw new Error('Invalid action parameter. Must be "show" or "hide"');
      }
    }

    // Map track names to checkbox IDs
    const trackMapping = {
      genes: 'trackGenes',
      gc: 'trackGC',
      variants: 'trackVariants',
      reads: 'trackReads',
      proteins: 'trackProteins',
      wigTracks: 'trackWIG',
      sequence: 'trackSequence',
      actions: 'trackActions',
      action: 'trackActions',
      blast: 'trackBlast',
      blast_results: 'trackBlast',
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

    // Check current state before making changes
    const currentState = trackCheckbox.checked;

    // If the track is already in the desired state, no need to change it
    if (currentState === visible) {
      return {
        success: true,
        track: trackName,
        visible: visible,
        message: `Track ${trackName} is already ${visible ? 'shown' : 'hidden'}`,
        noChangeNeeded: true,
      };
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
      message: `Track ${trackName} ${visible ? 'shown' : 'hidden'}`,
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
      { name: 'actions', id: 'trackActions' },
      { name: 'blast', id: 'trackBlast' },
      { name: 'blast_results', id: 'trackBlast' },
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
                        <button id="clearThinkingBtn" class="btn btn-sm btn-secondary">
                            <i class="fas fa-brain"></i>
                            Clear Thinking
                        </button>
                        <button id="exportChatBtn" class="btn btn-sm btn-secondary">
                            <i class="fas fa-download"></i>
                            Export
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
          this.sendMessage();
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

    document.getElementById('clearThinkingBtn')?.addEventListener('click', () => {
      this.clearThinkingHistory();
    });

    document.getElementById('toggleThinkingBtn')?.addEventListener('click', () => {
      this.toggleThinkingHistory();
    });

    document.getElementById('exportChatBtn')?.addEventListener('click', () => {
      this.exportChatHistory();
    });

    document.getElementById('suggestionsBtn')?.addEventListener('click', () => {
      this.showSuggestions();
    });

    // Multi-Agent System event listeners
    document.getElementById('multiAgentToggleBtn')?.addEventListener('click', () => {
      this.toggleMultiAgentSystem();
    });

    // New button event listeners
    document.getElementById('newChatBtn')?.addEventListener('click', () => {
      this.startNewChat();
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
              this.sendMessage();
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

  async sendToLLM(message, options = {}) {
    // Set current message for Dynamic Tools Registry
    this.currentMessage = message;

    // Check if LLM is configured
    if (!this.llmConfigManager.isConfigured()) {
      return 'I need to be configured first. Please go to Options → Configure LLMs to set up your preferred AI provider (OpenAI, Anthropic, Google, or Custom Endpoint).';
    }

    // Initialize execution tracking for benchmark integration
    const executionData = {
      functionCalls: [],
      toolResults: [],
      rounds: 0,
      startTime: Date.now(),
      endTime: null,
      totalExecutionTime: 0,
    };

    // Store execution data for benchmark access
    this.lastExecutionData = executionData;

    console.log('=== ChatManager.sendToLLM DEBUG START ===');
    console.log('User message:', message);

    // 设置AbortController
    this.conversationState.abortController = new AbortController();
    console.log('AbortController initialized:', !!this.conversationState.abortController);

    try {
      // Check if multi-agent system is enabled
      const multiAgentEnabled = this.configManager.get('multiAgentSettings.multiAgentSystemEnabled', false);
      const showAgentInfo = this.configManager.get('multiAgentSettings.multiAgentShowInfo', true);

      if (multiAgentEnabled) {
        // Add multi-agent system activation message
        this.addMultiAgentActivationMessage();

        if (showAgentInfo) {
          this.addThinkingMessage(
            `🤖 **Multi-Agent System Activated**\n\n` +
            `🔄 **Agent Coordination Mode**: Enabled\n` +
            `📊 **Available Agents**: 8 specialized agents\n` +
            `🧠 **Decision Process**: Intelligent agent selection and coordination\n` +
            `⚡ **Performance**: Optimized execution with caching\n\n` +
            `*Multi-agent system will now coordinate tool execution across specialized agents...*`
          );
        }
      }

      // Get maximum function call rounds from configuration
      const maxRounds = this.configManager.get('llm.functionCallRounds', 10);
      const enableEarlyCompletion = this.configManager.get('llm.enableEarlyCompletion', true);
      console.log('🔧 Maximum function call rounds from config:', maxRounds);
      console.log('🔧 Early completion enabled:', enableEarlyCompletion);
      console.log('🔧 LLM config raw value:', this.configManager.get('llm.functionCallRounds'));

      // 显示详细的思考过程
      this.showThinkingProcess &&
        this.addThinkingMessage(
          `🔄 <strong>Starting request processing</strong> (max rounds: ${maxRounds})<br>` +
          `📝 <strong>User Query:</strong> ${message.substring(0, 200)}${message.length > 200 ? '...' : ''}`
        );

      // Get current studio context
      const context = this.getCurrentContext();
      console.log('Context for LLM:', context);

      // Display context information
      if (this.showThinkingProcess && context) {
        const contextInfo = [];
        if (context.currentFile) contextInfo.push(`📄 Current file: ${context.currentFile}`);
        if (context.selectedFeatures && context.selectedFeatures.length > 0) {
          contextInfo.push(`🎯 Selected features: ${context.selectedFeatures.length}`);
        }
        if (context.genomeLoaded) contextInfo.push(`🧬 Genome loaded: Yes`);
        if (contextInfo.length > 0) {
          this.updateThinkingMessage(
            `<br>📊 <strong>Current Context:</strong><br>&nbsp;&nbsp;${contextInfo.join('<br>&nbsp;&nbsp;')}`
          );
        }
      }

      // Get memory context for conversation
      let memoryContext = null;
      try {
        memoryContext = await this.getMemoryContext(message, 'general_chat');
        if (memoryContext) {
          console.log('🧠 Retrieved memory context for conversation');
          this.showThinkingProcess &&
            this.updateThinkingMessage(
              `<br>🧠 Memory context retrieved: ${Object.keys(memoryContext).length} memory items`
            );
        }
      } catch (error) {
        console.warn('🧠 Failed to retrieve memory context:', error);
      }

      // Build initial conversation history including the new message
      let conversationHistory = await this.buildConversationHistory(message);
      console.log('Initial conversation history length:', conversationHistory.length);

      let currentRound = 0;
      let finalResponse = null;
      let taskCompleted = false;
      let executedTools = new Set(); // Track executed tools to prevent re-execution

      // Iterative function calling loop
      while (currentRound < maxRounds && !taskCompleted) {
        // 检查是否被中止
        if (this.conversationState.abortController && this.conversationState.abortController.signal.aborted) {
          throw new Error('AbortError');
        }

        // 防御性检查：如果abortController为null，重新初始化
        if (!this.conversationState.abortController) {
          console.warn('AbortController is null during processing, reinitializing...');
          this.conversationState.abortController = new AbortController();
        }

        currentRound++;
        console.log(`=== FUNCTION CALL ROUND ${currentRound}/${maxRounds} ===`);

        // 更新思考过程 - 添加更详细的信息
        if (this.showThinkingProcess) {
          this.updateThinkingMessage(`<br><br>🤖 <strong>Round ${currentRound}/${maxRounds}</strong>`);
          this.updateThinkingMessage(`📤 Sending request to LLM...`);
          this.updateThinkingMessage(`📚 Conversation history: ${conversationHistory.length} messages`);
        }

        // Send conversation history to configured LLM
        console.log('Sending to LLM...');
        const response = await this.llmConfigManager.sendMessageWithHistory(
          conversationHistory,
          context,
          memoryContext
        );

        // 检查响应是否被中止
        if (this.conversationState.abortController && this.conversationState.abortController.signal.aborted) {
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
        if (this.showThinkingProcess) {
          this.updateThinkingMessage(`✅ Response received (${response ? response.length : 0} chars)`);
          this.displayLLMThinking(response);
        }

        // CRITICAL FIX: Check for tool calls FIRST, before task completion
        // This prevents early completion from skipping tool execution
        const toolCall = this.parseToolCall(response);

        // Also check for multiple tool calls in response
        const multipleToolCalls = this.parseMultipleToolCalls(response);

        // Determine which tools to execute
        let toolsToExecute = multipleToolCalls.length > 0 ? multipleToolCalls : toolCall ? [toolCall] : [];

        // Display tool detection information
        if (this.showThinkingProcess) {
          if (toolsToExecute.length > 0) {
            this.updateThinkingMessage(
              `🔍 Detected ${toolsToExecute.length} tool call(s): ${toolsToExecute.map(t => t.tool_name).join(', ')}`
            );
          } else {
            this.updateThinkingMessage(`💬 No tool calls detected - conversational response`);
          }
        }

        // Apply intelligent tool execution policies instead of simple re-executable sets
        const toolsBeforeFilter = toolsToExecute.length;
        toolsToExecute = toolsToExecute.filter(tool => {
          const shouldAllow = this.shouldAllowToolExecution(tool, conversationHistory, currentRound, []);
          if (!shouldAllow) {
            console.log(`🚫 [Policy] Blocking execution of: ${tool.tool_name}`);
            this.showThinkingProcess && this.updateThinkingMessage(`🚫 Policy blocked: ${tool.tool_name}`);
            return false;
          }
          console.log(`✅ [Policy] Allowing execution of: ${tool.tool_name}`);
          return true;
        });

        if (this.showThinkingProcess && toolsBeforeFilter > toolsToExecute.length) {
          this.updateThinkingMessage(
            `⚠️ Filtered ${toolsBeforeFilter - toolsToExecute.length} tool(s) by execution policy`
          );
        }

        // CRITICAL FIX: If current response has no tools, check previous assistant messages
        // in conversation history for unexecuted tool calls
        // This covers both empty responses and task completion responses
        if (toolsToExecute.length === 0) {
          console.log('=== CHECKING PREVIOUS ROUNDS FOR UNEXECUTED TOOL CALLS ===');
          console.log('Current conversation history length:', conversationHistory.length);
          console.log('Current response has no tools, looking for previous tool calls...');

          // Log the entire conversation history for debugging
          conversationHistory.forEach((msg, index) => {
            console.log(
              `History[${index}] Role: ${msg.role}, Content length: ${msg.content ? msg.content.length : 'null'}`
            );
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
                const shouldAllow = this.shouldAllowToolExecution(
                  previousToolCall,
                  conversationHistory,
                  currentRound,
                  []
                );
                if (shouldAllow) {
                  console.log('✅ [Policy] Found allowed tool call from previous round:', previousToolCall);
                  toolsToExecute = [previousToolCall];
                  break;
                } else {
                  console.log(`🚫 [Policy] Tool not allowed for re-execution: ${previousToolCall.tool_name}`);
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
            this.showNotification(
              `Task completed early (Round ${currentRound}/${maxRounds}): ${completionResult.reason}`,
              'success'
            );
            break;
          }
        } else if (toolsToExecute.length > 0) {
          console.log('=== TOOL CALLS FOUND - SKIPPING EARLY COMPLETION CHECK ===');
          console.log('Tool calls take priority over completion detection');
          console.log('=========================================================');
        }

        if (toolsToExecute.length > 0) {
          console.log(`=== ${toolsToExecute.length} TOOL CALL(S) DETECTED ===`);
          console.log(
            'Tools to execute:',
            toolsToExecute.map(t => t.tool_name)
          );
          console.log('==========================');

          // Show thinking process for tool execution
          if (this.showThinkingProcess) {
            this.updateThinkingMessage(`<br><br>⚡ <strong>Preparing tool execution...</strong>`);
            this.updateThinkingMessage(`🛠️ Tools to execute: ${toolsToExecute.map(t => t.tool_name).join(', ')}`);
          }

          // 显示工具调用信息
          this.showToolCalls && (await this.addToolCallMessage(toolsToExecute));

          try {
            console.log('Executing tool(s)...');

            // Show execution start in thinking process
            if (this.showThinkingProcess) {
              this.updateThinkingMessage(`🚀 Starting execution...`);
            }

            // 检查是否被中止
            if (this.conversationState.abortController && this.conversationState.abortController.signal.aborted) {
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
                          icon = '✓';
                          message = 'Browser actions completed';
                          break;
                        case 'dataRetrieval':
                          icon = '📊';
                          message = 'Data retrieved';
                          break;
                        case 'sequenceAnalysis':
                          icon = '🧬';
                          message = 'Analysis completed';
                          break;
                        case 'blastSearch':
                          icon = '🔍';
                          message = 'BLAST search completed';
                          break;
                        default:
                          icon = '✓';
                          message = 'Operations completed';
                      }
                      this.showNotification(
                        `${icon} ${message} (${category.successful}/${category.successful + category.failed})`,
                        'success'
                      );
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
                      error: null,
                    });
                  } catch (error) {
                    toolResults.push({
                      tool: tool.tool_name,
                      parameters: tool.parameters,
                      success: false,
                      result: null,
                      error: error.message,
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
                    error: null,
                  });
                } catch (error) {
                  toolResults.push({
                    tool: tool.tool_name,
                    parameters: tool.parameters,
                    success: false,
                    result: null,
                    error: error.message,
                  });
                }
              }
            }

            console.log('Tool execution completed. Results:', toolResults);

            // Show execution results in thinking process
            if (this.showThinkingProcess) {
              const successCount = toolResults.filter(r => r.success).length;
              const failCount = toolResults.filter(r => !r.success).length;
              this.updateThinkingMessage(`✅ Execution completed: ${successCount} successful, ${failCount} failed`);

              // Show details for each tool
              toolResults.forEach(result => {
                if (result.success) {
                  this.updateThinkingMessage(`&nbsp;&nbsp;✅ ${result.tool}: Success`);
                } else {
                  this.updateThinkingMessage(`&nbsp;&nbsp;❌ ${result.tool}: Failed - ${result.error}`);
                }
              });
            }

            // BENCHMARK INTEGRATION: Track function calls and results for benchmark access
            if (this.lastExecutionData) {
              // Track function calls
              toolsToExecute.forEach(tool => {
                this.lastExecutionData.functionCalls.push({
                  tool_name: tool.tool_name,
                  parameters: tool.parameters,
                  round: currentRound,
                  timestamp: new Date().toISOString(),
                });
              });

              // Track tool results
              this.lastExecutionData.toolResults.push(...toolResults);
              this.lastExecutionData.rounds = currentRound;
            }

            // Track executed tools to prevent infinite loops
            // Be more selective about which tools to track for re-execution prevention
            const nonReExecutableTools = new Set([
              'blast_search',
              'fetch_protein_structure',
              'get_uniprot_entry',
              'create_annotation',
              'export_data',
              'delete_feature',
            ]);

            // File loading tools should be tracked when they succeed to prevent re-execution with same parameters
            const fileLoadingTools = new Set([
              'load_genome_file',
              'load_annotation_file',
              'load_variant_file',
              'load_reads_file',
              'load_wig_tracks',
              'load_operon_file',
            ]);

            toolsToExecute.forEach(tool => {
              const toolKey = `${tool.tool_name}:${JSON.stringify(tool.parameters)}`;

              // Track non-re-executable tools and successful file loading operations
              if (nonReExecutableTools.has(tool.tool_name)) {
                executedTools.add(toolKey);
                console.log(`🔒 Tracking execution for non-re-executable tool: ${tool.tool_name}`);
              } else if (fileLoadingTools.has(tool.tool_name)) {
                // Only track file loading tools if they succeed
                const result = toolResults.find(r => r.tool === tool.tool_name);
                if (result && result.success) {
                  executedTools.add(toolKey);
                  console.log(`🔒 Tracking successful file loading execution: ${tool.tool_name}`);
                } else {
                  console.log(`🔄 Not tracking failed file loading execution: ${tool.tool_name}`);
                }
              } else {
                console.log(`🔄 Not tracking execution for re-executable tool: ${tool.tool_name}`);
              }
            });

            // 显示工具执行结果
            this.showToolCalls && this.addToolResultMessage(toolResults);

            // Add the tool calls and results to conversation history for next round
            conversationHistory.push({
              role: 'assistant',
              content: JSON.stringify(
                toolsToExecute.length === 1
                  ? { tool_name: toolsToExecute[0].tool_name, parameters: toolsToExecute[0].parameters }
                  : toolsToExecute.map(t => ({ tool_name: t.tool_name, parameters: t.parameters }))
              ),
            });

            // Process results
            const successfulResults = toolResults.filter(r => r.success);
            const failedResults = toolResults.filter(r => !r.success);

            if (successfulResults.length > 0) {
              // Add successful tool results to conversation with SYSTEM role to prevent re-execution
              // IMPORTANT: Sanitize results before sending to LLM to prevent context overflow
              const successMessages = successfulResults.map(result => {
                const sanitizedResult = this.sanitizeResultForLLM(result.result, result.tool);
                return `${result.tool} executed successfully: ${JSON.stringify(sanitizedResult)}`;
              });
              conversationHistory.push({
                role: 'system',
                content: `Tool execution completed: ${successMessages.join('; ')}`,
              });

              // ENHANCED: Check for simple task completion after successful tool execution
              const shouldTerminateEarly = this.shouldTerminateAfterToolExecution(
                toolsToExecute,
                successfulResults,
                message
              );
              if (shouldTerminateEarly) {
                console.log('=== EARLY TERMINATION AFTER SUCCESSFUL TOOL EXECUTION ===');
                console.log('Simple task completed successfully, terminating early');
                console.log('=========================================================');

                taskCompleted = true;
                // Generate a simple completion response based on the tool results
                finalResponse = this.generateCompletionResponseFromToolResults(successfulResults, toolsToExecute);
                break;
              }

              console.log(
                `${successfulResults.length} tool(s) executed successfully. Continuing to round ${currentRound + 1} to check for follow-up actions.`
              );
            }

            if (failedResults.length > 0) {
              // Add failed tool results to conversation with SYSTEM role
              const errorMessages = failedResults.map(
                result => `${result.tool} failed: ${result.error || 'Unknown error'}`
              );
              conversationHistory.push({
                role: 'system',
                content: `Tool execution errors: ${errorMessages.join('; ')}`,
              });
              console.log(`${failedResults.length} tool(s) failed:`, failedResults);

              // CRITICAL FIX: If ALL tools failed, terminate to prevent infinite retry
              if (successfulResults.length === 0) {
                console.log('=== ALL TOOLS FAILED - TERMINATING TO PREVENT INFINITE RETRY ===');
                console.log(
                  'Failed tools:',
                  failedResults.map(r => r.tool)
                );
                console.log(
                  'Errors:',
                  failedResults.map(r => r.error)
                );
                console.log('This prevents infinite retry loops when tools consistently fail');
                console.log('================================================================');

                taskCompleted = true;

                // Generate more informative error response based on the specific tool
                if (failedResults.length === 1 && failedResults[0].tool === 'get_genome_info') {
                  finalResponse =
                    `ℹ️ **Unable to retrieve genome information**\n\n` +
                    `The genome information tool is currently unavailable. This might be because:\n` +
                    `- No genome file is currently loaded\n` +
                    `- The genome browser is not initialized\n` +
                    `- The requested data is not available\n\n` +
                    `Please try loading a genome file first or check if the genome browser is properly initialized.`;
                } else {
                  finalResponse =
                    `❌ **Tool Execution Failed**\n\n` +
                    `The following tool(s) could not be executed:\n` +
                    failedResults.map(r => `- **${r.tool}**: ${r.error || 'Unknown error'}`).join('\n') +
                    `\n\nPlease check your system configuration or try a different approach.`;
                }
                break;
              }
            }
          } catch (error) {
            console.error('=== TOOL EXECUTION EXCEPTION ===');
            console.error('Error:', error);
            console.error('Stack:', error.stack);
            console.error('================================');

            // Add error to conversation and continue
            conversationHistory.push({
              role: 'system',
              content: `Tool execution error: ${error.message}`,
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
          content: 'Please provide a final summary of the actions taken and results achieved.',
        });

        finalResponse = await this.llmConfigManager.sendMessageWithHistory(conversationHistory, context, memoryContext);
        console.log('Final summary response:', finalResponse);
      }

      // BENCHMARK INTEGRATION: Complete execution data tracking
      if (this.lastExecutionData) {
        this.lastExecutionData.endTime = Date.now();
        this.lastExecutionData.totalExecutionTime = this.lastExecutionData.endTime - this.lastExecutionData.startTime;
        this.lastExecutionData.finalResponse =
          finalResponse || 'I completed the requested actions. Please let me know if you need anything else.';
        console.log('📊 Execution data for benchmark:', this.lastExecutionData);
      }

      console.log('=== ChatManager.sendToLLM DEBUG END (SUCCESS) ===');
      return finalResponse || 'I completed the requested actions. Please let me know if you need anything else.';
    } catch (error) {
      console.error('=== LLM COMMUNICATION ERROR ===');
      console.error('Error:', error);
      console.error('Stack:', error.stack);
      console.error('==============================');

      let errorMessage;

      // Provide specific error messages based on error type
      if (error.message.includes('HTTP 503') || error.message.includes('Service Unavailable')) {
        errorMessage =
          `🚫 **Service Temporarily Unavailable**\n\n` +
          `The LLM service is currently experiencing high load or maintenance. ` +
          `The system automatically retried your request, but the service remains unavailable.\n\n` +
          `**Suggestions:**\n` +
          `• Wait a few minutes and try again\n` +
          `• Switch to a different LLM provider in Options → Configure LLMs\n` +
          `• Check the service status page for your LLM provider`;
      } else if (error.message.includes('HTTP 429') || error.message.includes('Too Many Requests')) {
        errorMessage =
          `⏱️ **Rate Limit Exceeded**\n\n` +
          `You've exceeded the API rate limit for your LLM provider. ` +
          `The system will automatically retry, but you may need to wait.\n\n` +
          `**Suggestions:**\n` +
          `• Wait a few minutes before sending another message\n` +
          `• Consider upgrading your API plan for higher limits\n` +
          `• Switch to a different LLM provider temporarily`;
      } else if (error.message.includes('HTTP 401') || error.message.includes('Unauthorized')) {
        errorMessage =
          `🔐 **Authentication Error**\n\n` +
          `Your API key appears to be invalid or expired.\n\n` +
          `**Please:**\n` +
          `• Go to Options → Configure LLMs\n` +
          `• Check and update your API key\n` +
          `• Test the connection before saving`;
      } else if (error.message.includes('HTTP 404') || error.message.includes('Not Found')) {
        errorMessage =
          `🔍 **Model Not Found**\n\n` +
          `The requested model is not available or doesn't exist.\n\n` +
          `**Please:**\n` +
          `• Go to Options → Configure LLMs\n` +
          `• Select a different model\n` +
          `• Check your provider's available models`;
      } else if (
        error.message.includes('fetch') ||
        error.message.includes('network') ||
        error.message.includes('connection')
      ) {
        errorMessage =
          `🌐 **Network Connection Error**\n\n` +
          `Unable to connect to the LLM service. This could be due to:\n\n` +
          `• Internet connectivity issues\n` +
          `• Firewall blocking the connection\n` +
          `• Service endpoint temporarily down\n\n` +
          `**Please check your internet connection and try again.**`;
      } else {
        errorMessage =
          `❌ **Unexpected Error**\n\n` +
          `${error.message}\n\n` +
          `**Troubleshooting:**\n` +
          `• Check your LLM configuration in Options → Configure LLMs\n` +
          `• Try switching to a different LLM provider\n` +
          `• Check the browser console for more details`;
      }

      console.log('=== ChatManager.sendToLLM DEBUG END (LLM ERROR) ===');
      return errorMessage;
    }
  }

  /**
   * Sanitize tool result for LLM context
   * Removes or truncates large data arrays to prevent context overflow
   * @param {Object} result - The tool execution result
   * @param {string} toolName - Name of the tool that generated the result
   * @returns {Object} Sanitized result suitable for LLM context
   */
  sanitizeResultForLLM(result, toolName) {
    if (!result || typeof result !== 'object') {
      return result;
    }

    // Create a shallow copy to avoid modifying the original
    const sanitized = { ...result };

    // Tool-specific sanitization rules
    switch (toolName) {
      case 'genome_codon_usage_analysis':
        // Keep summary statistics but remove large gene list
        if (sanitized.analyzedGenes && Array.isArray(sanitized.analyzedGenes)) {
          const geneCount = sanitized.analyzedGenes.length;
          const sampleSize = 5;
          sanitized.analyzedGenes = {
            totalCount: geneCount,
            note: `Full list omitted (${geneCount} genes analyzed)`,
            sample: sanitized.analyzedGenes.slice(0, sampleSize).map(g => ({
              name: g.name,
              length: g.length,
              chromosome: g.chromosome,
            })),
          };
        }
        // Truncate codonPreferences to top amino acids only
        if (sanitized.codonPreferences && typeof sanitized.codonPreferences === 'object') {
          const aaEntries = Object.entries(sanitized.codonPreferences)
            .filter(([aa]) => aa !== '*')
            .sort(([, a], [, b]) => (b.totalCount || 0) - (a.totalCount || 0))
            .slice(0, 10); // Keep only top 10 amino acids
          sanitized.codonPreferences = {
            note: `Showing top 10 amino acids by usage`,
            data: Object.fromEntries(aaEntries),
          };
        }
        break;

      case 'codon_usage_analysis':
        // Keep only top codons for summary
        if (sanitized.codonUsage && Array.isArray(sanitized.codonUsage)) {
          sanitized.codonUsage = sanitized.codonUsage.slice(0, 15); // Top 15 codons
        }
        break;

      case 'search_features':
      case 'find_gene_by_name':
      case 'get_gene_details':
        // Limit gene/feature results to reasonable number
        if (sanitized.genes && Array.isArray(sanitized.genes)) {
          const totalGenes = sanitized.genes.length;
          if (totalGenes > 10) {
            sanitized.genes = sanitized.genes.slice(0, 10);
            sanitized.note = `Showing first 10 of ${totalGenes} results`;
          }
        }
        if (sanitized.features && Array.isArray(sanitized.features)) {
          const totalFeatures = sanitized.features.length;
          if (totalFeatures > 10) {
            sanitized.features = sanitized.features.slice(0, 10);
            sanitized.note = `Showing first 10 of ${totalFeatures} results`;
          }
        }
        break;

      case 'find_restriction_sites':
        // Limit array results
        if (sanitized.sites && Array.isArray(sanitized.sites)) {
          const totalSites = sanitized.sites.length;
          if (totalSites > 20) {
            sanitized.sites = sanitized.sites.slice(0, 20);
            sanitized.note = `Showing first 20 of ${totalSites} sites`;
          }
        }
        break;
    }

    // General sanitization for any result
    // Truncate very long sequence strings
    if (sanitized.sequence && typeof sanitized.sequence === 'string' && sanitized.sequence.length > 1000) {
      sanitized.sequence =
        sanitized.sequence.substring(0, 500) +
        '...[truncated]...' +
        sanitized.sequence.substring(sanitized.sequence.length - 500);
      sanitized.sequenceLength = sanitized.sequence.length;
    }

    // Limit any large arrays not caught by specific rules
    Object.keys(sanitized).forEach(key => {
      if (Array.isArray(sanitized[key]) && sanitized[key].length > 50) {
        const originalLength = sanitized[key].length;
        sanitized[key] = sanitized[key].slice(0, 50);
        sanitized[`${key}_truncated`] = `Array truncated from ${originalLength} to 50 items`;
      }
    });

    return sanitized;
  }

  formatToolResult(toolName, parameters, result) {
    if (!this.services || !this.services.context) {
      console.error('[ChatManager] context not initialized');
      return;
    }
    return this.services.context.formatToolResult(toolName, parameters, result);
  }

  async buildConversationHistory(newMessage) {
    const history = [];

    // Add system context message
    const systemMessage = await this.buildSystemMessage();
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

  async buildSystemMessage() {
    // [MCP Integration] Check for specific MCP server prompts first
    if (this.mcpServerManager && this.mcpServerManager.serverPrompts) {
      for (const [serverId, prompts] of this.mcpServerManager.serverPrompts) {
        // Look for Deep Gene Research Assistant prompt
        const deepGenePrompt = prompts.find(
          p =>
            p.name === 'Deep Gene Research Assistant' ||
            p.name === 'deep-gene-research-assistant' ||
            p.name === 'deep_gene_research_assistant'
        );

        if (deepGenePrompt) {
          console.log(`🤖 Found MCP system prompt from server ${serverId}: ${deepGenePrompt.name}`);
          try {
            // Fetch the full prompt content
            const promptResult = await this.mcpServerManager.getPrompt(serverId, deepGenePrompt.name);

            if (promptResult && promptResult.messages && promptResult.messages.length > 0) {
              console.log(`✅ Using MCP system prompt:`, promptResult.description || deepGenePrompt.name);

              // Extract text content from messages
              // MCP prompts return a list of messages (role + content)
              // We'll combine all system/user/assistant messages into one system instruction for now,
              // or just extract the content if it's primarily a system prompt.
              // For simplicity and compatibility with current single-string system prompt, we join text parts.

              let promptText = '';

              for (const msg of promptResult.messages) {
                if (msg.content) {
                  if (typeof msg.content === 'string') {
                    promptText += msg.content + '\n\n';
                  } else if (msg.content.text) {
                    promptText += msg.content.text + '\n\n';
                  } else if (msg.content.type === 'text' && msg.content.text) {
                    promptText += msg.content.text + '\n\n';
                  }
                }
              }

              if (promptText.trim()) {
                // Append standard tool context if needed, or rely on the prompt to ask for tools?
                // Usually MCP prompts are standalone system instructions.
                // But we still need our tools available.

                const useOptimizedPrompt = this.configManager.get(
                  'chatboxSettings.useOptimizedPrompt',
                  this.configManager.get('llm.useOptimizedPrompt', true)
                );
                const toolContext = useOptimizedPrompt ? this.getOptimizedToolContext() : this.getCompleteToolContext();

                return `${promptText}\n\n${toolContext}`;
              }
            }
          } catch (error) {
            console.error(`❌ Failed to get/apply prompt '${deepGenePrompt.name}':`, error);
            // Fallback to standard logic if prompt fetching fails
          }
        }
      }
    }

    // Get user-defined system prompt
    // Check chatboxSettings.customSystemPrompt first, then llm.systemPrompt for backward compatibility
    const userSystemPrompt = this.configManager.get('chatboxSettings.customSystemPrompt', '') ||
      this.configManager.get('llm.systemPrompt', '');

    // Get system message format preference (optimized or complete)
    // Check both chatboxSettings and llm settings for backward compatibility
    const useOptimizedPrompt = this.configManager.get(
      'chatboxSettings.useOptimizedPrompt',
      this.configManager.get('llm.useOptimizedPrompt', true)
    );

    // Get system prompt section configuration
    const sectionConfig = this.getSystemPromptSectionConfig();

    // Get current user query for memory retrieval
    const currentUserQuery = this.getLastUserQuery() || '';

    // If user has defined a custom system prompt, use it with variable substitution
    if (userSystemPrompt && userSystemPrompt.trim()) {
      const processedPrompt = this.processSystemPromptVariables(userSystemPrompt);
      // Choose context based on optimization setting
      const toolContext = useOptimizedPrompt ? this.getOptimizedToolContext() : this.getCompleteToolContext();

      // Add memory context if enabled in section config
      let memorySection = '';
      if (sectionConfig.toggles.memoryContext) {
        const memoryContext = await this.getMemoryContext(currentUserQuery);
        memorySection = memoryContext ? `\n\n[Memory Context]\n${memoryContext}` : '';
      }

      return `${processedPrompt}\n\n${toolContext}${memorySection}`;
    }

    // Check if Dynamic Tools Registry is enabled in settings
    const dynamicToolsRegistryEnabled = this.configManager.get('chatboxSettings.enableDynamicToolsRegistry', true);
    console.log('🔧 [buildSystemMessage] Dynamic Tools Registry enabled in settings:', dynamicToolsRegistryEnabled);

    // Try to use Dynamic Tools Registry if available and enabled
    console.log('🔧 [buildSystemMessage] Checking Dynamic Tools Registry...');
    console.log('🔧 [buildSystemMessage] dynamicToolsEnabled:', this.dynamicToolsEnabled);
    console.log('🔧 [buildSystemMessage] dynamicTools:', this.dynamicTools);

    if (dynamicToolsRegistryEnabled && this.dynamicToolsEnabled && this.dynamicTools) {
      try {
        console.log('🔧 [buildSystemMessage] Using Dynamic Tools Registry...');
        const context = this.getCurrentContextForDynamicTools();
        const lastUserQuery = this.getLastUserQuery();
        console.log('🔧 [buildSystemMessage] Context:', context);
        console.log('🔧 [buildSystemMessage] Last user query:', lastUserQuery);

        const promptData = await this.dynamicTools.generateDynamicSystemPrompt(lastUserQuery, context);
        console.log('🔧 [buildSystemMessage] Generated prompt data:', promptData);

        // Apply section configuration filtering to dynamic prompt
        const filteredPrompt = this.applySystemPromptSectionConfig(promptData.systemPrompt, sectionConfig, currentUserQuery);
        return filteredPrompt;
      } catch (error) {
        console.warn('Dynamic Tools Registry failed, falling back to standard system message:', error);
        console.error('Dynamic Tools Registry error details:', error.message, error.stack);
      }
    } else {
      if (!dynamicToolsRegistryEnabled) {
        console.log('🔧 [buildSystemMessage] Dynamic Tools Registry disabled in settings, using fallback');
      } else if (!this.dynamicToolsEnabled) {
        console.log('🔧 [buildSystemMessage] Dynamic Tools Registry not initialized, using fallback');
      } else if (!this.dynamicTools) {
        console.log('🔧 [buildSystemMessage] Dynamic Tools Registry not available, using fallback');
      }
    }

    // For default system message, use optimized version by default
    // Apply section configuration
    const baseMessage = useOptimizedPrompt ? this.getOptimizedSystemMessage() : this.getBaseSystemMessage();

    // Add memory context if enabled in section config
    let memorySection = '';
    if (sectionConfig.toggles.memoryContext) {
      const memoryContext = await this.getMemoryContext(currentUserQuery);
      memorySection = memoryContext ? `\n\n[Memory Context]\n${memoryContext}` : '';
    }

    return `${baseMessage}${memorySection}`;
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
   * Apply section configuration to a dynamically generated system prompt.
   * Filters out disabled sections and reorders them based on user configuration.
   * @param {string} prompt - The original system prompt
   * @param {object} sectionConfig - Section configuration with toggles and order
   * @param {string} userQuery - Current user query for memory context
   * @returns {Promise<string>} - Filtered and reordered system prompt
   */
  async applySystemPromptSectionConfig(prompt, sectionConfig, userQuery) {
    const { order, toggles } = sectionConfig;

    // Parse the dynamic prompt into sections by markdown headers
    const sections = this.parseSystemPromptSections(prompt);

    // Filter and reorder sections based on configuration
    const orderedSections = [];
    for (const sectionKey of order) {
      if (!toggles[sectionKey]) continue; // Skip disabled sections

      const sectionContent = this.mapSectionKeyToContent(sectionKey, sections);
      if (sectionContent) {
        orderedSections.push(sectionContent);
      }
    }

    // Add any sections from the original prompt that weren't mapped
    for (const [header, content] of Object.entries(sections)) {
      const isMapped = this.mapHeaderToSectionKey(header);
      if (!isMapped || !toggles[isMapped]) continue;
      // Already included above
    }

    // Add memory context if enabled
    if (toggles.memoryContext) {
      const memoryContext = await this.getMemoryContext(userQuery);
      if (memoryContext) {
        orderedSections.push(`## Memory Context\n\n${memoryContext}`);
      }
    }

    return orderedSections.join('\n\n');
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
    this.displayLLMThinking(sampleResponse);

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
   * Execute tool with priority-based selection
   */
  async executeToolWithPriority(toolName, parameters) {
    // Get tool priority from settings
    const toolPriority = this.configManager.get('chatboxSettings.toolPriority', [
      'local',
      'genomics',
      'plugins',
      'mcp',
    ]);

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
      // File Loading tools
      load_genome_file: () => this.loadGenomeFile(parameters),
      load_annotation_file: () => this.loadAnnotationFile(parameters),
      load_variant_file: () => this.loadVariantFile(parameters),
      load_reads_file: () => this.loadReadsFile(parameters),
      load_wig_tracks: () => this.loadWigTracks(parameters),
      load_operon_file: () => this.loadOperonFile(parameters),

      // Navigation and state tools
      navigate_to_position: () => this.navigateToPosition(parameters),
      open_new_tab: () => this.openNewTab(parameters),
      search_features: () => this.searchFeatures(parameters),
      get_current_state: () => this.getCurrentState(),
      find_gene_by_name: () => this.executeMicrobeFunction('searchGeneByName', parameters),

      // Sequence tools
      get_sequence: () => this.getSequence(parameters),
      translate_sequence: () => this.translateSequence(parameters),
      calculate_gc_content: () => this.calculateGCContent(parameters),

      // Track and display tools
      toggle_track: () => this.toggleTrack(parameters),
      toggle_annotation_track: () => this.toggleAnnotationTrack(parameters),
      get_track_status: () => this.getTrackStatus(),

      // Annotation tools
      create_annotation: () => this.createAnnotation(parameters),
      analyze_region: () => this.analyzeRegion(parameters),
      get_gene_details: () => this.getGeneDetails(parameters),
      get_operons: () => this.getOperons(parameters),
      zoom_to_gene: () => this.zoomToGene(parameters),
      select_gene: () => this.selectGene(parameters),
      select_sequence_region: () => this.selectSequenceRegion(parameters),
      get_nearby_features: () => this.getNearbyFeatures(parameters),
      find_intergenic_regions: () => this.findIntergenicRegions(parameters),

      // Analysis and external tools
      compute_gc: () => this.executeMicrobeFunction('computeGC', parameters),
      translate_dna: () => this.executeMicrobeFunction('translateDNA', parameters),
      reverse_complement: () => this.reverseComplement(parameters),
      codon_usage_analysis: () => this.codonUsageAnalysis(parameters),

      // Database tools
      analyze_interpro_domains: () => this.analyzeInterProDomains(parameters),
      search_uniprot_database: () => this.services.protein.searchUniProtDatabase(parameters),
      advanced_uniprot_search: () => this.services.protein.advancedUniprotSearch(parameters),
      get_uniprot_entry: () => this.getUniProtEntry(parameters),
      search_interpro_entry: () => this.services.protein.searchInterproEntry(parameters),
      get_interpro_entry_details: () => this.services.protein.getInterproEntryDetails(parameters),
      search_pattern: () => this.searchPattern(parameters),
      find_restriction_sites: () => this.findRestrictionSites(parameters),
      virtual_digest: () => this.virtualDigest(parameters),
      search_sequence_motif: () => this.searchMotif(parameters),

      // AlphaFold and protein structure tools
      search_alphafold_structures: () => this.services.protein.searchAlphaFoldStructures(parameters),
      search_alphafold_by_gene: () => this.services.protein.searchAlphaFoldStructures(parameters), // Legacy alias
      alphafold_search: () => this.services.protein.searchAlphaFoldStructures(parameters), // Legacy alias
      alphafold_get_structure: () => this.fetchAlphaFoldStructure(parameters), // Legacy alias
      fetch_alphafold_structure: () => this.fetchAlphaFoldStructure(parameters),
      search_pdb_structures: () => this.services.protein.searchPdbStructures(parameters),
      fetch_protein_structure: () => this.fetchProteinStructure(parameters),
      search_alphafold_by_sequence: () => this.searchAlphaFoldBySequence(parameters),

      // Genome-wide analysis tools
      genome_codon_usage_analysis: () => this.genomeCodonUsageAnalysis(parameters),
      // Annotation CRUD tools (Phase 1 - OpenClaw integration)
      list_annotations: () => this.listAnnotations(parameters),
      get_annotation: () => this.getAnnotation(parameters),
      update_annotation: () => this.updateAnnotation(parameters),
      delete_annotation: () => this.deleteAnnotation(parameters),
      search_annotations: () => this.searchAnnotations(parameters),
      bulk_update_annotations: () => this.bulkUpdateAnnotations(parameters),
      get_annotation_history: () => this.getAnnotationHistory(parameters),


      // Export tools - built-in equivalents for Export As dropdown menu
      export_fasta_sequence: () => this.exportFastaSequence(parameters),
      export_genbank_format: () => this.exportGenBankFormat(parameters),
      export_cds_fasta: () => this.exportCDSFasta(parameters),
      export_protein_fasta: () => this.exportProteinFasta(parameters),
      export_gff_annotations: () => this.exportGFFAnnotations(parameters),
      export_bed_format: () => this.exportBEDFormat(parameters),
      export_current_view_fasta: () => this.exportCurrentViewFasta(parameters),

      // System tools
      get_chromosome_list: () => this.getChromosomeList(),
      get_genome_info: () => this.getGenomeInfo(parameters),
      export_data: () => this.exportData(parameters),
      set_working_directory: () => this.setWorkingDirectory(parameters),
      list_available_tools: () => this.listAvailableTools(parameters),
      download_internet_file: () => this.downloadInternetFile(parameters),
      utility_download_internet_file: () => this.downloadInternetFile(parameters),
      utility_toggle_settings_modal: () => this.toggleSettingsModal(parameters),

      // Action system tools (if available)
      copy_sequence: () => this.executeActionTool('copy_sequence', parameters),
      action_copy_sequence: () => this.executeActionTool('copy_sequence', parameters),
      cut_sequence: () => this.executeActionTool('cut_sequence', parameters),
      action_cut_sequence: () => this.executeActionTool('cut_sequence', parameters),
      paste_sequence: () => this.executeActionTool('paste_sequence', parameters),
      action_paste_sequence: () => this.executeActionTool('paste_sequence', parameters),
      delete_sequence: () => this.executeActionTool('delete_sequence', parameters),
      action_delete_sequence: () => this.executeActionTool('delete_sequence', parameters),
      insert_sequence: () => this.executeActionTool('insert_sequence', parameters),
      action_insert_sequence: () => this.executeActionTool('insert_sequence', parameters),
      replace_sequence: () => this.executeActionTool('replace_sequence', parameters),
      action_replace_sequence: () => this.executeActionTool('replace_sequence', parameters),
      execute_actions: () => this.executeActionTool('execute_actions', parameters),
      action_execute_actions: () => this.executeActionTool('execute_actions', parameters),
      get_action_list: () => this.executeActionTool('get_action_list', parameters),
      show_action_list: () => this.executeActionTool('get_action_list', parameters),
      action_get_action_list: () => this.executeActionTool('get_action_list', parameters),
      action_show_action_list: () => this.executeActionTool('get_action_list', parameters),
      clear_actions: () => this.executeActionTool('clear_actions', parameters),
      action_clear_actions: () => this.executeActionTool('clear_actions', parameters),
      get_clipboard_content: () => this.executeActionTool('get_clipboard_content', parameters),
      action_get_clipboard_content: () => this.executeActionTool('get_clipboard_content', parameters),

      // Track settings tools
      get_track_settings: () => this.getTrackSettings(parameters),
      set_track_settings: () => this.setTrackSettings(parameters),
      get_all_track_settings: () => this.getAllTrackSettings(parameters),
      reset_track_settings: () => this.resetTrackSettings(parameters),
      get_track_settings_schema: () => this.getTrackSettingsSchema(parameters),
      batch_set_track_settings: () => this.batchSetTrackSettings(parameters),

      // Primer Design Tools
      calculate_primer_properties: () => this.primerCalculateProperties(parameters),
      design_primers: () => this.primerDesign(parameters),
      find_primer_binding_sites: () => this.primerFindBindingSites(parameters),
      add_primer_annotation: async () => {
        // Fallback implementation if Primer integration hasn't loaded
        if (typeof this.primerAddAnnotation === 'function') {
          return await this.primerAddAnnotation(parameters);
        }
        // Direct implementation using createAnnotation
        if (!parameters.chromosome || !parameters.start || !parameters.end || !parameters.name) {
          throw new Error('Missing required fields for annotation: chromosome, start, end, name');
        }
        const strand = parameters.strand === '-' ? -1 : 1;
        return await this.createAnnotation({
          type: 'primer',
          name: parameters.name,
          chromosome: parameters.chromosome,
          start: parseInt(parameters.start),
          end: parseInt(parameters.end),
          strand: strand,
          description: parameters.description || `Tm: ${parameters.tm || '?'}, GC: ${parameters.gcContent || '?'}%`
        });
      },

      // View control tools
      zoom_in: () => this.zoomIn(parameters),
      zoom_out: () => this.zoomOut(parameters),
      pan_left: () => this.panLeft(parameters),
      pan_right: () => this.panRight(parameters),

      // Multi-window management tools (IPC-based, no MCP server required)
      list_genome_windows: () => this.listGenomeWindows(parameters),
      switch_active_window: () => this.switchActiveWindow(parameters),

      // Settings modal tools
      toggle_settings_modal: () => this.toggleSettingsModal(parameters),

      // Benchmark tools
      open_benchmark: () => this.openBenchmark(parameters),
      start_benchmark: () => this.startBenchmark(parameters),
      stop_benchmark: () => this.stopBenchmark(parameters),
      pause_benchmark: () => this.pauseBenchmark(parameters),
      resume_benchmark: () => this.resumeBenchmark(parameters),
      get_benchmark_results: () => this.getBenchmarkResults(parameters),
      get_benchmark_status: () => this.getBenchmarkStatus(parameters),
      export_benchmark_results: () => this.exportBenchmarkResults(parameters),
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
   * Zoom in the current genome view
   */
  async zoomIn(parameters = {}) {
    const factor = parameters.factor || 2;
    if (!this.app.navigationManager) throw new Error('NavigationManager not available');
    for (let i = 0; i < Math.log2(factor); i++) {
      this.app.navigationManager.zoomIn();
    }
    const state = this.getCurrentState();
    return {
      success: true,
      factor,
      message: `Zoomed in by ${factor}x`,
      newRange: state.viewingRegion,
    };
  }

  /**
   * Zoom out the current genome view
   */
  async zoomOut(parameters = {}) {
    const factor = parameters.factor || 2;
    if (!this.app.navigationManager) throw new Error('NavigationManager not available');
    for (let i = 0; i < Math.log2(factor); i++) {
      this.app.navigationManager.zoomOut();
    }
    const state = this.getCurrentState();
    return {
      success: true,
      factor,
      message: `Zoomed out by ${factor}x`,
      newRange: state.viewingRegion,
    };
  }

  /**
   * Pan the view left
   */
  async panLeft(parameters = {}) {
    if (!this.app.navigationManager) throw new Error('NavigationManager not available');
    const amount = parameters.amount || null; // NavigationManager handles default
    this.app.navigationManager.navigatePrevious(amount);
    const state = this.getCurrentState();
    return { success: true, message: 'Panned left', newRange: state.viewingRegion };
  }

  /**
   * Pan the view right
   */
  async panRight(parameters = {}) {
    if (!this.app.navigationManager) throw new Error('NavigationManager not available');
    const amount = parameters.amount || null;
    this.app.navigationManager.navigateNext(amount);
    const state = this.getCurrentState();
    return { success: true, message: 'Panned right', newRange: state.viewingRegion };
  }

  /**
   * List all open genome browser windows via IPC to main process
   * Works without MCP server - directly queries the window registry
   */
  async listGenomeWindows(parameters = {}) {
    console.log(`[ChatManager] listGenomeWindows called`);
    console.log(`[ChatManager] this.app.windowId: ${this.app.windowId}`);
    try {
      // Use Electron IPC to query the main process window registry
      let ipc;
      try {
        ipc = typeof ipcRenderer !== 'undefined' ? ipcRenderer : require('electron').ipcRenderer;
      } catch (e) {
        ipc = require('electron').ipcRenderer;
      }

      console.log(`[ChatManager] Calling ipc.invoke('list-genome-windows')`);
      const windows = await ipc.invoke('list-genome-windows');
      console.log(`[ChatManager] IPC returned ${windows.length} windows:`, windows);

      return {
        success: true,
        windowCount: windows.length,
        windows: windows,
        currentWindowId: this.app.windowId || null,
      };
    } catch (error) {
      console.error('[ChatManager] listGenomeWindows error:', error);
      return {
        success: false,
        error: error.message,
        windowCount: 0,
        windows: [],
      };
    }
  }

  /**
   * Switch focus to a specific genome browser window via IPC
   * Works without MCP server - directly sends focus command to main process
   */
  async switchActiveWindow(parameters = {}) {
    const { windowId } = parameters;
    if (!windowId) {
      return { success: false, error: 'windowId parameter is required. Use list_genome_windows to see available IDs.' };
    }

    try {
      let ipc;
      try {
        ipc = typeof ipcRenderer !== 'undefined' ? ipcRenderer : require('electron').ipcRenderer;
      } catch (e) {
        ipc = require('electron').ipcRenderer;
      }

      const result = await ipc.invoke('focus-genome-window', windowId);
      return result;
    } catch (error) {
      console.error('[ChatManager] switchActiveWindow error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Toggle settings modal open/close state
   * Provides a unified interface for opening, closing, or toggling any settings modal
   */
  async toggleSettingsModal(parameters = {}) {
    const { modal_name: modalName, action = 'toggle' } = parameters;

    if (!modalName) {
      return {
        success: false,
        error: 'modal_name parameter is required. Supported: llm_config, chatbox_settings, general_settings, track_settings, mcp_settings, multi_agent_settings, tab_settings, search_settings, gene_detail_settings, external_tools, plugin_management, action_list, literature_settings',
      };
    }

    // Map modal names to their DOM IDs, open functions, and close functions
    const modalRegistry = {
      llm_config: {
        id: 'llmConfigModal',
        open: () => {
          if (window.llmConfigManager) {
            window.llmConfigManager.showConfigModal();
          } else {
            const modal = document.getElementById('llmConfigModal');
            if (modal) modal.classList.add('show');
          }
        },
        close: () => {
          if (window.llmConfigManager) {
            window.llmConfigManager.hideConfigModal();
          } else {
            const modal = document.getElementById('llmConfigModal');
            if (modal) modal.classList.remove('show');
          }
        },
      },
      chatbox_settings: {
        id: 'chatboxSettingsModal',
        open: () => {
          if (window.chatBoxSettingsManager) {
            window.chatBoxSettingsManager.showSettingsModal();
          }
        },
        close: () => {
          const modal = document.getElementById('chatboxSettingsModal');
          if (modal) {
            modal.classList.remove('show');
            modal.style.display = 'none';
          }
        },
      },
      general_settings: {
        id: 'generalSettingsModal',
        open: () => {
          if (window.genomeBrowser && window.genomeBrowser.showGeneralSettingsModal) {
            window.genomeBrowser.showGeneralSettingsModal();
          } else {
            const modal = document.getElementById('generalSettingsModal');
            if (modal) modal.classList.add('show');
          }
        },
        close: () => {
          const modal = document.getElementById('generalSettingsModal');
          if (modal) modal.classList.remove('show');
        },
      },
      track_settings: {
        id: 'trackSettingsModal',
        open: () => {
          if (window.genomeBrowser && window.genomeBrowser.trackRenderer && window.genomeBrowser.trackRenderer.openTrackSettings) {
            window.genomeBrowser.trackRenderer.openTrackSettings('genes');
          }
        },
        close: () => {
          const modal = document.getElementById('trackSettingsModal');
          if (modal) modal.classList.remove('show');
        },
      },
      mcp_settings: {
        id: 'mcpSettingsModal',
        open: () => {
          if (window.genomeBrowser && window.genomeBrowser.showMCPSettingsModal) {
            window.genomeBrowser.showMCPSettingsModal();
          } else {
            const modal = document.getElementById('mcpSettingsModal');
            if (modal) modal.classList.add('show');
          }
        },
        close: () => {
          const modal = document.getElementById('mcpSettingsModal');
          if (modal) modal.classList.remove('show');
        },
      },
      multi_agent_settings: {
        id: 'multiAgentSettingsModal',
        open: () => {
          if (window.multiAgentSettingsManager) {
            window.multiAgentSettingsManager.showModal();
          } else {
            const modal = document.getElementById('multiAgentSettingsModal');
            if (modal) modal.classList.add('show');
          }
        },
        close: () => {
          if (window.multiAgentSettingsManager) {
            window.multiAgentSettingsManager.hideModal();
          } else {
            const modal = document.getElementById('multiAgentSettingsModal');
            if (modal) modal.classList.remove('show');
          }
        },
      },
      tab_settings: {
        id: 'tabSettingsModal',
        open: () => {
          if (window.genomeBrowser && window.genomeBrowser.tabManager && window.genomeBrowser.tabManager.openTabSettingsModal) {
            window.genomeBrowser.tabManager.openTabSettingsModal();
          } else {
            const modal = document.getElementById('tabSettingsModal');
            if (modal) modal.style.display = 'flex';
          }
        },
        close: () => {
          if (window.genomeBrowser && window.genomeBrowser.tabManager && window.genomeBrowser.tabManager.closeTabSettingsModal) {
            window.genomeBrowser.tabManager.closeTabSettingsModal();
          } else {
            const modal = document.getElementById('tabSettingsModal');
            if (modal) modal.style.display = 'none';
          }
        },
      },
      search_settings: {
        id: 'searchSettingsModal',
        open: () => {
          if (window.genomeBrowser && window.genomeBrowser.navigationManager && window.genomeBrowser.navigationManager.showSearchSettingsModal) {
            window.genomeBrowser.navigationManager.showSearchSettingsModal();
          } else {
            const modal = document.getElementById('searchSettingsModal');
            if (modal) modal.classList.add('show');
          }
        },
        close: () => {
          const modal = document.getElementById('searchSettingsModal');
          if (modal) modal.classList.remove('show');
        },
      },
      gene_detail_settings: {
        id: 'geneDetailSettingsModal',
        open: () => {
          if (window.genomeBrowser && window.genomeBrowser.showGeneDetailSettings) {
            window.genomeBrowser.showGeneDetailSettings();
          } else {
            const modal = document.getElementById('geneDetailSettingsModal');
            if (modal) modal.classList.add('show');
          }
        },
        close: () => {
          const modal = document.getElementById('geneDetailSettingsModal');
          if (modal) modal.classList.remove('show');
        },
      },
      external_tools: {
        id: 'externalToolsModal',
        open: () => {
          if (window.genomeBrowser && window.genomeBrowser.showExternalToolsModal) {
            window.genomeBrowser.showExternalToolsModal();
          } else {
            const modal = document.getElementById('externalToolsModal');
            if (modal) modal.classList.add('show');
          }
        },
        close: () => {
          const modal = document.getElementById('externalToolsModal');
          if (modal) modal.classList.remove('show');
        },
      },
      plugin_management: {
        id: 'pluginManagementModal',
        open: () => {
          if (window.pluginManagementUI && window.pluginManagementUI.showPluginModal) {
            window.pluginManagementUI.showPluginModal();
          } else {
            const modal = document.getElementById('pluginManagementModal');
            if (modal) modal.style.display = 'block';
          }
        },
        close: () => {
          if (window.pluginManagementUI && window.pluginManagementUI.hidePluginModal) {
            window.pluginManagementUI.hidePluginModal();
          } else {
            const modal = document.getElementById('pluginManagementModal');
            if (modal) modal.style.display = 'none';
          }
        },
      },
      action_list: {
        id: 'actionListModal',
        open: () => {
          if (window.actionManager && window.actionManager.showActionList) {
            window.actionManager.showActionList();
          } else {
            const modal = document.getElementById('actionListModal');
            if (modal) modal.classList.add('show');
          }
        },
        close: () => {
          if (window.actionManager && window.actionManager.closeActionList) {
            window.actionManager.closeActionList();
          } else {
            const modal = document.getElementById('actionListModal');
            if (modal) modal.classList.remove('show');
          }
        },
      },
      literature_settings: {
        id: 'literatureSettingsModal',
        open: () => {
          if (window.literatureSettings && window.literatureSettings.showModal) {
            window.literatureSettings.showModal();
          }
        },
        close: () => {
          if (window.literatureSettings && window.literatureSettings.closeModal) {
            window.literatureSettings.closeModal();
          } else {
            const modal = document.getElementById('literatureSettingsModal');
            if (modal) modal.remove();
          }
        },
      },
    };

    const entry = modalRegistry[modalName];
    if (!entry) {
      return {
        success: false,
        error: `Unknown modal: '${modalName}'. Supported: ${Object.keys(modalRegistry).join(', ')}`,
      };
    }

    try {
      // Determine current state and action to perform
      const modal = document.getElementById(entry.id);
      const isOpen = modal ? modal.classList.contains('show') || modal.style.display === 'flex' || modal.style.display === 'block' : false;

      let effectiveAction = action;
      if (action === 'toggle') {
        effectiveAction = isOpen ? 'close' : 'open';
      }

      if (effectiveAction === 'open') {
        entry.open();
        return {
          success: true,
          message: `Opened ${modalName} settings modal`,
          modal_name: modalName,
          new_state: 'open',
        };
      } else if (effectiveAction === 'close') {
        entry.close();
        return {
          success: true,
          message: `Closed ${modalName} settings modal`,
          modal_name: modalName,
          new_state: 'closed',
        };
      } else {
        return {
          success: false,
          error: `Invalid action: '${action}'. Use 'open', 'close', or 'toggle'.`,
        };
      }
    } catch (error) {
      console.error(`[ChatManager] toggleSettingsModal error:`, error);
      return {
        success: false,
        error: error.message,
        modal_name: modalName,
      };
    }
  }

  /**
   * Switch UI style / theme
   * Changes the application's visual style preset and/or dark/light mode
   */
  async switchUIStyle(parameters = {}) {
    const { style_name: styleName, dark_mode: darkMode } = parameters;
    const themeManager = window.themeManager;
    const generalSettingsManager = window.generalSettingsManager;

    if (!themeManager) {
      return {
        success: false,
        error: 'ThemeManager is not available',
      };
    }

    const availableStyles = themeManager.getAvailableStyles().map(s => s.id);
    const results = [];

    try {
      // Apply style preset if specified
      if (styleName) {
        if (!availableStyles.includes(styleName)) {
          return {
            success: false,
            error: `Unknown style: '${styleName}'`,
            available_styles: availableStyles,
            message: `Available styles: ${availableStyles.join(', ')}`,
          };
        }
        await themeManager.switchStyle(styleName);
        results.push(`Style switched to '${styleName}'`);

        // Also sync GeneralSettingsManager
        if (generalSettingsManager) {
          generalSettingsManager.settings.uiStyle = styleName;
          const preset = themeManager.stylePresets[styleName];
          if (preset) {
            generalSettingsManager.settings.accentColor = preset.variables['--primary-color'];
          }
        }
      }

      // Apply dark/light mode if specified
      if (darkMode) {
        let targetIsDark;
        if (darkMode === 'dark') {
          targetIsDark = true;
        } else if (darkMode === 'light') {
          targetIsDark = false;
        } else if (darkMode === 'toggle') {
          targetIsDark = !themeManager.isDarkMode();
        }

        if (targetIsDark !== undefined) {
          const themeMode = targetIsDark ? 'dark' : 'light';
          if (generalSettingsManager) {
            generalSettingsManager.settings.themeMode = themeMode;
            generalSettingsManager.applyTheme(themeMode);
          } else {
            themeManager.applyDarkModeOverrides(targetIsDark);
          }
          results.push(`Dark mode ${targetIsDark ? 'enabled' : 'disabled'}`);
        }
      }

      // If neither specified, just return current state
      if (!styleName && !darkMode) {
        const currentStyle = themeManager.getCurrentStyle();
        const isDark = themeManager.isDarkMode();
        return {
          success: true,
          message: `Current UI style: '${currentStyle}' (${isDark ? 'dark' : 'light'} mode)`,
          style_name: currentStyle,
          dark_mode: isDark,
          available_styles: availableStyles,
        };
      }

      return {
        success: true,
        message: results.join('. ') || 'UI style updated',
        style_name: themeManager.getCurrentStyle(),
        dark_mode: themeManager.isDarkMode(),
      };
    } catch (error) {
      console.error(`[ChatManager] switchUIStyle error:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
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
    const context = this.getCurrentContext();
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
    if (!this.services || !this.services.execution) {
       console.error('[ChatManager] ToolExecutionService not initialized!');
       throw new Error('ChatManager services not fully initialized');
    }
    return await this.services.execution.execute(toolName, parameters);
  }

  /**
   * Execute delete sequence function directly
   */
  async executeDeleteSequence(parameters) {
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
        message: `Delete action queued for ${chromosome}:${start}-${end} (${length} bp)`,
      };

      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Execute delete gene function by name
   */
  async executeDeleteGene(parameters) {
    try {
      const { geneName, chromosome } = parameters;

      // Validate parameters
      if (!geneName) {
        throw new Error('Missing required parameter: geneName (can be gene name or locus tag)');
      }

      // First, find the gene using existing search functionality
      const searchResult = await this.searchGeneByName({ name: geneName, chromosome });

      if (!searchResult.found || !searchResult.genes || searchResult.genes.length === 0) {
        throw new Error(
          `Gene/locus tag "${geneName}" not found${chromosome ? ` in chromosome ${chromosome}` : ''}. Make sure the gene name or locus tag is correct.`
        );
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

      // Use the delete_sequence functionality with gene coordinates
      const deleteResult = await this.executeDeleteSequence({
        chromosome: geneChromosome,
        start: geneStart,
        end: geneEnd,
        strand: geneStrand,
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
          product: targetGene.qualifiers?.product || 'Unknown protein',
        },
        message: `Gene/locus tag "${geneName}" deletion queued: ${geneChromosome}:${geneStart}-${geneEnd} (${geneEnd - geneStart + 1} bp)`,
      };

      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Execute action function through UI response functions
   */
  async executeActionFunction(functionName, parameters) {
    try {
      // Use window.genomeBrowser for access
      const genomeBrowser = window.genomeBrowser;

      if (!genomeBrowser) {
        throw new Error('Genome browser not available via window.genomeBrowser');
      }

      if (!genomeBrowser.actionManager) {
        throw new Error('ActionManager not available in genome browser');
      }

      // Use ActionManager's executeActionFunction method which delegates to function* methods
      // This ensures parameters are used instead of showing UI dialogs
      const result = await genomeBrowser.actionManager.executeActionFunction(functionName, parameters);

      return result;
    } catch (error) {
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
      'select_gene',
      'select_sequence_region',
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
      'find_gene_by_name',
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
      'search_pdb_structures',
      'search_alphafold_structures',
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

      // System & File Management
      'set_working_directory',
      'list_available_tools',
      'download_internet_file',
      'toggle_settings_modal',
    ];

    // Add plugin functions if available
    const pluginTools = [];
    if (this.pluginFunctionCallsIntegrator) {
      try {
        const pluginFunctions = Array.from(this.pluginFunctionCallsIntegrator.pluginFunctionMap.keys());
        pluginTools.push(...pluginFunctions);
      } catch (error) {
        // Silently handle error
      }
    }

    // Add MCP tools if available
    const mcpTools = [];
    if (this.mcpServerManager) {
      try {
        const allMcpTools = this.mcpServerManager.getAllAvailableTools();
        mcpTools.push(...allMcpTools.map(tool => tool.name));
      } catch (error) {
        // Silently handle error
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
          total: allAvailableTools.length,
        },
      },
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
        visible: true,
      },
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
      navigator.clipboard
        .writeText(textContent)
        .then(() => {
          // Show brief success indication
          const copyBtn = messageElement.parentElement.querySelector('.copy-message-btn');
          const originalHTML = copyBtn.innerHTML;
          copyBtn.innerHTML = '<i class="fas fa-check"></i>';
          copyBtn.style.color = '#10b981';

          setTimeout(() => {
            copyBtn.innerHTML = originalHTML;
            copyBtn.style.color = '';
          }, 1000);
        })
        .catch(err => {
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

  /**
   * Enhanced Markdown formatting with proper rendering
   * Handles code blocks, lists, headers, links, tables, and more
   */
  formatMessage(message) {
    if (!message || typeof message !== 'string') {
      return '';
    }
    // Trim leading/trailing whitespace
    let formattedMessage = message.trim();

    // Remove common leading whitespace while preserving relative indentation
    const lines = formattedMessage.split('\n');
    if (lines.length > 1) {
      const nonEmptyLines = lines.filter(line => line.trim().length > 0);
      if (nonEmptyLines.length > 0) {
        const minIndent = Math.min(
          ...nonEmptyLines.map(line => {
            const match = line.match(/^(\s*)/);
            return match ? match[1].length : 0;
          })
        );

        if (minIndent > 0) {
          formattedMessage = lines
            .map(line => {
              return line.length > 0 ? line.substring(minIndent) : line;
            })
            .join('\n');
        }
      }
    }

    // Preprocess: Convert relative MCP download URLs to absolute clickable links
    formattedMessage = this.convertMCPDownloadUrls(formattedMessage);

    // Use marked library for proper Markdown rendering if available
    if (typeof marked !== 'undefined' && marked.parse) {
      try {
        // Configure marked options for better rendering
        marked.setOptions({
          breaks: true, // Enable GFM line breaks
          gfm: true, // Enable GitHub Flavored Markdown
          headerIds: false, // Disable header IDs for security
          mangle: false, // Don't mangle email addresses
          sanitize: false, // We'll handle sanitization separately
          smartLists: true, // Use smarter list behavior
          smartypants: true, // Use smart typography
          xhtml: false, // Don't use XHTML tags
        });

        // Parse markdown to HTML
        const htmlContent = marked.parse(formattedMessage);

        // Sanitize the HTML output to prevent XSS while preserving formatting
        const sanitizedHtml = this.sanitizeHTML(htmlContent);

        // Post-process to convert any remaining markdown-style MCP links to clickable HTML
        return this.postProcessMCPLinks(sanitizedHtml);
      } catch (error) {
        console.error('Markdown parsing error:', error);
        // Fallback to basic formatting if marked fails
        const basicHtml = this.basicMarkdownFormat(formattedMessage);
        return this.postProcessMCPLinks(basicHtml);
      }
    }

    // Fallback to basic formatting if marked is not available
    const basicHtml = this.basicMarkdownFormat(formattedMessage);
    return this.postProcessMCPLinks(basicHtml);
  }

  /**
   * Basic Markdown formatting fallback
   * Used when marked library is not available
   */
  basicMarkdownFormat(text) {
    return (
      text
        // Code blocks (```)
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Bold
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/__([^_]+)__/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/_([^_]+)_/g, '<em>$1</em>')
        // Headers
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
        // Unordered lists
        .replace(/^[*+-] (.+)$/gm, '<li>$1</li>')
        // Ordered lists
        .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
        // Line breaks
        .replace(/\n/g, '<br>')
    );
  }

  /**
   * Convert relative MCP download URLs to absolute clickable URLs
   * Converts paths like /api/mcp/download/... to full URLs with the MCP server base URL
   * Generates both markdown links (for markdown contexts) and HTML links (for direct HTML contexts)
   */
  convertMCPDownloadUrls(text) {
    if (!this.services || !this.services.file) {
      console.error('[ChatManager] file not initialized');
      return text;
    }
    return this.services.file.convertMCPDownloadUrls(text);
  }

  /**
   * Post-process HTML to convert remaining markdown-style links to clickable HTML links
   * Called after sanitizeHTML to handle cases where markdown wasn't parsed
   */
  postProcessMCPLinks(html) {
    if (!html || typeof html !== 'string') {
      return html;
    }

    try {
      // Get MCP base URL
      let baseUrl = 'http://localhost:3000';
      if (this.mcpServerManager) {
        const deepGeneServer = this.mcpServerManager.servers?.get('deep-gene-research');
        if (deepGeneServer && deepGeneServer.url) {
          try {
            const urlObj = new URL(deepGeneServer.url);
            baseUrl = `${urlObj.protocol}//${urlObj.host}`;
          } catch (e) {
            /* ignore */
          }
        }
      }

      // Convert escaped markdown links like [text](url) that weren't rendered
      // This handles cases where content wasn't markdown-parsed
      html = html.replace(/\[([^\]]+)\]\((http[s]?:\/\/[^\s\)]+\/api\/mcp\/[^\s\)]+)\)/g, (match, label, url) => {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="mcp-download-link">${label}</a>`;
      });

      // Also convert any remaining raw /api/mcp URLs to clickable links
      html = html.replace(/(?<!href="|">)(http[s]?:\/\/[^\s<>"]+\/api\/mcp\/download\/[^\s<>"]+)/g, (match, url) => {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="mcp-download-link">${url}</a>`;
      });

      return html;
    } catch (error) {
      console.error('Error post-processing MCP links:', error);
      return html;
    }
  }

  /**
   * Sanitize HTML to prevent XSS attacks while preserving formatting
   * Allows safe HTML tags and attributes
   */
  sanitizeHTML(html) {
    // Allow these HTML tags
    const allowedTags = [
      'p',
      'br',
      'strong',
      'b',
      'em',
      'i',
      'u',
      'code',
      'pre',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'ul',
      'ol',
      'li',
      'a',
      'img',
      'blockquote',
      'hr',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'div',
      'span',
      'del',
      'ins',
      'sup',
      'sub',
    ];

    // Allow these attributes
    const allowedAttributes = {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      code: ['class'],
      pre: ['class'],
      div: ['class'],
      span: ['class'],
    };

    // Create a temporary DOM element for parsing
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // Recursively sanitize the DOM
    const sanitizeNode = node => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.cloneNode(true);
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName.toLowerCase();

        // Remove disallowed tags
        if (!allowedTags.includes(tagName)) {
          // Return text content only for disallowed tags
          const textNode = document.createTextNode(node.textContent);
          return textNode;
        }

        // Create new element
        const newElement = document.createElement(tagName);

        // Copy allowed attributes
        if (allowedAttributes[tagName]) {
          Array.from(node.attributes).forEach(attr => {
            if (allowedAttributes[tagName].includes(attr.name)) {
              // Special handling for links to ensure they're safe
              if (tagName === 'a' && attr.name === 'href') {
                const href = attr.value;
                // Only allow http, https, and mailto links
                if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:')) {
                  newElement.setAttribute(attr.name, attr.value);
                }
              } else {
                newElement.setAttribute(attr.name, attr.value);
              }
            }
          });

          // Add security attributes for links
          if (tagName === 'a' && !newElement.hasAttribute('target')) {
            newElement.setAttribute('target', '_blank');
          }
          if (tagName === 'a' && !newElement.hasAttribute('rel')) {
            newElement.setAttribute('rel', 'noopener noreferrer');
          }
        }

        // Recursively sanitize children
        Array.from(node.childNodes).forEach(child => {
          const sanitizedChild = sanitizeNode(child);
          if (sanitizedChild) {
            newElement.appendChild(sanitizedChild);
          }
        });

        return newElement;
      }

      return null;
    };

    // Sanitize all child nodes
    const sanitizedDiv = document.createElement('div');
    Array.from(tempDiv.childNodes).forEach(child => {
      const sanitizedChild = sanitizeNode(child);
      if (sanitizedChild) {
        sanitizedDiv.appendChild(sanitizedChild);
      }
    });

    return sanitizedDiv.innerHTML;
  }

  /**
   * Display visualization DOM element in chat interface
   * @param {string} toolName - Name of the visualization tool
   * @param {HTMLElement} domElement - DOM element to display
   * @param {Object} parameters - Tool parameters for context
   */
  displayVisualizationInChat(toolName, domElement, parameters = {}) {
    try {
      console.log(`🎨 [ChatManager] Displaying visualization: ${toolName}`);

      const messagesContainer = document.getElementById('chatMessages');
      if (!messagesContainer) {
        console.error('❌ [ChatManager] Chat messages container not found');
        return;
      }

      // Create visualization message container
      const vizMessage = document.createElement('div');
      vizMessage.className = 'chat-message assistant-message visualization-message';
      vizMessage.style.cssText = `
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border: none;
                border-radius: 12px;
                padding: 0;
                margin: 12px 0;
                max-width: 90%;
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.25);
            `;

      // Create header
      const vizHeader = document.createElement('div');
      vizHeader.style.cssText = `
                padding: 12px 16px;
                border-bottom: 1px solid rgba(255,255,255,0.1);
                display: flex;
                align-items: center;
                justify-content: space-between;
                color: white;
                font-weight: 600;
                font-size: 14px;
            `;
      vizHeader.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-chart-network" style="font-size: 16px;"></i>
                    <span>🎨 Visualization: ${this.formatToolName(toolName)}</span>
                </div>
                <button class="viz-expand-btn" title="Expand" style="
                    background: rgba(255,255,255,0.2);
                    border: none;
                    color: white;
                    padding: 4px 8px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                ">
                    <i class="fas fa-expand-alt"></i>
                </button>
            `;

      // Create content container
      const vizContent = document.createElement('div');
      vizContent.className = 'visualization-content';
      vizContent.style.cssText = `
                background: white;
                padding: 16px;
                border-radius: 0 0 12px 12px;
                min-height: 200px;
                max-height: 600px;
                overflow: auto;
            `;

      // Validate and append DOM element
      if (domElement instanceof Node) {
        // Style the visualization element
        domElement.style.width = '100%';
        domElement.style.minHeight = '300px';
        vizContent.appendChild(domElement);
        console.log('✅ [ChatManager] Visualization DOM element appended successfully');
      } else {
        console.error('❌ [ChatManager] Invalid DOM element', domElement);
        vizContent.innerHTML =
          '<div style="color: #e74c3c; padding: 20px; text-align: center;">Invalid visualization element</div>';
      }

      // Assemble message
      vizMessage.appendChild(vizHeader);
      vizMessage.appendChild(vizContent);
      messagesContainer.appendChild(vizMessage);

      // Add expand functionality
      const expandBtn = vizHeader.querySelector('.viz-expand-btn');
      if (expandBtn) {
        expandBtn.addEventListener('click', () => {
          this.expandVisualization(domElement, toolName);
        });
      }

      // Scroll to show the visualization
      messagesContainer.scrollTop = messagesContainer.scrollHeight;

      // Track in Evolution data
      this.addToEvolutionData({
        type: 'visualization_displayed',
        timestamp: new Date().toISOString(),
        toolName: toolName,
        parameters: parameters,
        success: true,
      });
    } catch (error) {
      console.error('❌ [ChatManager] Error displaying visualization:', error);
    }
  }

  /**
   * Format tool name for display
   * @param {string} toolName - Tool name (e.g., "protein-interaction-network.visualize")
   * @returns {string} Formatted name
   */
  formatToolName(toolName) {
    return toolName
      .split('.')
      .map(part => part.replace(/-/g, ' '))
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' → ');
  }

  /**
   * Expand visualization in full-screen modal
   * @param {HTMLElement} element - Visualization element
   * @param {string} toolName - Tool name
   */
  expandVisualization(element, toolName) {
    // Create modal
    const modal = document.createElement('div');
    modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0,0,0,0.9);
            z-index: 10000;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 20px;
        `;

    // Clone the element for modal display
    const clonedElement = element.cloneNode(true);
    clonedElement.style.width = '90%';
    clonedElement.style.height = '80%';
    clonedElement.style.maxWidth = '1200px';
    clonedElement.style.background = 'white';
    clonedElement.style.borderRadius = '8px';
    clonedElement.style.padding = '20px';

    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '<i class="fas fa-times"></i> Close';
    closeBtn.style.cssText = `
            position: absolute;
            top: 30px;
            right: 30px;
            background: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
    closeBtn.onclick = () => document.body.removeChild(modal);

    modal.appendChild(clonedElement);
    modal.appendChild(closeBtn);
    document.body.appendChild(modal);

    // Close on escape key
    const escHandler = e => {
      if (e.key === 'Escape' && document.body.contains(modal)) {
        document.body.removeChild(modal);
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
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
        messages: history,
      };

      let content, filename, mimeType;

      switch (format.toLowerCase()) {
        case 'json':
          content = JSON.stringify(exportData, null, 2);
          filename = `chat-history-${new Date().toISOString().split('T')[0]}.json`;
          mimeType = 'application/json';
          break;

        case 'txt':
          content = history
            .map(msg => {
              const time = new Date(msg.timestamp).toLocaleString();
              return `[${time}] ${msg.sender.toUpperCase()}: ${msg.message}`;
            })
            .join('\n\n');
          filename = `chat-history-${new Date().toISOString().split('T')[0]}.txt`;
          mimeType = 'text/plain';
          break;

        case 'csv':
          const csvHeader = 'Timestamp,Sender,Message\n';
          const csvContent = history
            .map(msg => {
              const escapedMessage = msg.message.replace(/"/g, '""');
              return `"${msg.timestamp}","${msg.sender}","${escapedMessage}"`;
            })
            .join('\n');
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
      'Go to chr1:1000-2000',
      'Find lacZ gene',
      'Show current state',
      'Get sequence from 1000 to 2000',
      'Find EcoRI sites',
      'Calculate GC content',
      'Toggle genes track',
      'Search DNA polymerase',
      'Export current region as FASTA',
    ];

    const suggestionsHTML = suggestions
      .map(
        s => `<span class="suggestion-chip" onclick="document.getElementById('chatInput').value = '${s}'">${s}</span>`
      )
      .join('');

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

    messageDiv.innerHTML = `<div class="message-content"><div class="message-icon"><i class="fas fa-${sender === 'user' ? 'user' : 'robot'}"></i></div><div class="message-text" id="${displayId}">${this.formatMessage(message)}</div><div class="message-actions"><button class="copy-message-btn" onclick="chatManager.copyMessage('${displayId}')" title="Copy message"><i class="fas fa-copy"></i></button></div></div><div class="message-time">${displayTime}</div>`;

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
      'Test tool execution',
    ];

    const optionsHTML = options
      .map(
        (option, index) =>
          `<button class="suggestion-btn" onclick="chatManager.handleConfigOption(${index})">${option}</button>`
      )
      .join('');

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
      switch (optionIndex) {
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
    await this.navigateToPosition({
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
      await this.navigateToPosition({
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

  getTrackStatus() {
    if (!this.app) {
      throw new Error('Genome browser not initialized');
    }

    const visibleTracks = this.getVisibleTracks();
    const allTracks = ['genes', 'sequence', 'gc', 'variants', 'reads', 'proteins'];

    const trackStatus = allTracks.map(track => ({
      name: track,
      visible: visibleTracks.includes(track),
      description: this.getTrackDescription(track),
    }));

    return {
      visibleTracks: visibleTracks,
      totalTracks: allTracks.length,
      tracks: trackStatus,
    };
  }

  getTrackDescription(trackName) {
    const descriptions = {
      genes: 'Gene annotations and features',
      sequence: 'DNA sequence display',
      gc: 'GC content visualization',
      variants: 'VCF variant data',
      reads: 'Aligned sequencing reads',
      proteins: 'Protein coding sequences',
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
          strand: '+',
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
          strand: '-',
        });
      }
    }

    return {
      pattern: pattern,
      chromosome: chr,
      searchRegion: `${regionStart}-${regionEnd}`,
      allowedMismatches: allowMismatches,
      matchesFound: matches.length,
      matches: matches.slice(0, 50), // Limit to first 50 matches
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
      visibleTracks: this.getVisibleTracks(),
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
    fileInfo.tracks = this.getTrackStatus();

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
    this.displayChatMessage(
      '🆕 **New conversation started**',
      'assistant',
      new Date().toISOString(),
      'new-conversation-' + Date.now()
    );

    console.log('Started new chat conversation');
  }

  /**
   * Copy selected text from the page
   */

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

    console.log('UI Elements Check:');
    console.log('- Chat Input:', chatInput ? '✅' : '❌');
    console.log('- New Chat Button:', newChatBtn ? '✅' : '❌');

    // Test 2: Check chat history loading
    const history = this.configManager.getChatHistory();
    console.log('Chat History:', history.length, 'messages');

    // Test 3: Show notification
    this.showNotification('🧪 Chat functionality test completed', 'success');

    return {
      uiElements: {
        chatInput: !!chatInput,
        newChatBtn: !!newChatBtn,
      },
      historyCount: history.length,
      testCompleted: true,
    };
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
<div class="full-message-content">${this.formatMessage(message.message)}</div>
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

    navigator.clipboard
      .writeText(message.message)
      .then(() => {
        this.showNotification('Message copied to clipboard', 'success');
      })
      .catch(err => {
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

      this.showNotification('Message deleted from history', 'success');

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
    let { pdbData, proteinName, pdbId, uniprotId } = params;

    try {
      // Check if protein structure viewer is available
      if (!window.proteinStructureViewer || !window.proteinStructureViewer.openStructureViewer) {
        throw new Error('Protein structure viewer not available');
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
            console.error('🔬 [openProteinViewer] Failed to download AlphaFold data');
            throw new Error(`Failed to download AlphaFold structure data for ${uniprotId}`);
          }
        } catch (fetchError) {
          console.error('🔬 [openProteinViewer] Error during AlphaFold download:', fetchError);
          throw new Error(`Failed to fetch AlphaFold structure for ${uniprotId}: ${fetchError.message}`);
        }
      }
      // If no pdbData provided but pdbId is available, fetch the PDB structure
      else if (!pdbData && pdbId) {
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
            console.error('🔬 [openProteinViewer] Failed to download PDB data');
            throw new Error(`Failed to download protein structure data for ${pdbId}`);
          }
        } catch (fetchError) {
          console.error('🔬 [openProteinViewer] Error during PDB download:', fetchError);
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
        uniprotId: uniprotId,
        message: `Opened 3D protein structure viewer for ${proteinName} (${pdbId || uniprotId || ''})`,
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

  // Removed deprecated openAlphaFoldViewer



  /**
   * Fetch protein structure data (from PDB or AlphaFold)
   */
  async fetchProteinStructure(parameters) {
    const pdbId = parameters.pdbId || parameters.pdb_id;
    const uniprotId = parameters.uniprotId || parameters.uniprot_id;
    const geneName = parameters.geneName || parameters.gene_name;

    try {
      console.log(`Fetching protein structure: PDB=${pdbId}, UniProt=${uniprotId}, gene=${geneName}`);

      // If PDB ID provided, fetch from RCSB
      if (pdbId) {
        const pdbUrl = `https://files.rcsb.org/download/${pdbId}.pdb`;
        const response = await fetch(pdbUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch PDB structure ${pdbId}: ${response.status}`);
        }
        const pdbData = await response.text();

        return {
          success: true,
          tool: 'fetch_protein_structure',
          pdbId: pdbId,
          pdbData: pdbData,
          source: 'RCSB PDB',
          timestamp: new Date().toISOString(),
        };
      }

      // If UniProt ID provided, fetch from AlphaFold
      if (uniprotId) {
        return await this.fetchAlphaFoldStructure({ uniprotId, geneName });
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
   * Test MicrobeGenomicsFunctions integration
   */
  testMicrobeGenomicsIntegration() {
    console.log('=== Testing MicrobeGenomicsFunctions Integration ===');

    if (!this.MicrobeFns) {
      console.error('❌ MicrobeGenomicsFunctions not available');
      return {
        success: false,
        error: 'MicrobeGenomicsFunctions not loaded',
      };
    }

    const testResults = {
      functionsAvailable: {},
      categoriesAvailable: false,
      examplesAvailable: false,
      totalFunctions: 0,
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
        'navigateTo',
        'jumpToGene',
        'getCurrentRegion',
        'scrollLeft',
        'scrollRight',
        'zoomIn',
        'zoomOut',
        'computeGC',
        'reverseComplement',
        'translateDNA',
        'findORFs',
        'calculateEntropy',
        'calcRegionGC',
        'calculateMeltingTemp',
        'calculateMolecularWeight',
        'analyzeCodonUsage',
        'predictPromoter',
        'predictRBS',
        'predictTerminator',
        'searchGeneByName',
        'searchSequenceMotif',
        'searchByPosition',
        'searchIntergenicRegions',
        'editAnnotation',
        'deleteAnnotation',
        'mergeAnnotations',
        'addAnnotation',
        'getUpstreamRegion',
        'getDownstreamRegion',
        'addTrack',
        'addVariant',
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
        ...testResults,
      };
    } catch (error) {
      console.error('❌ Integration test failed:', error);
      return {
        success: false,
        error: error.message,
        ...testResults,
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
        title: 'Test Protein Structure',
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
      const context = this.getCurrentContext();
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
          step: 'initial_thinking',
        },
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
    thinkingDiv.innerHTML = `<div class="message-content"><div class="message-icon"><i class="fas fa-cog fa-spin"></i></div><div class="message-text thinking-text"><div class="thinking-header"><span>AI Thinking Process</span></div><div class="thinking-content">${message}</div></div></div>`;

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
        step: 'initial_thinking',
      },
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
        step: 'system_activation',
      },
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
                    ${Object.keys(parameters).length > 0
        ? `
                        <div class="agent-parameters">
                            <div class="parameters-label">Parameters:</div>
                            <div class="parameters-content">
                                <pre><code>${JSON.stringify(parameters, null, 2)}</code></pre>
                            </div>
                        </div>
                    `
        : ''
      }
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
        parameters,
      },
      visible: true,
      metadata: {
        source: 'multi_agent_system',
        requestId: this.conversationState.currentRequestId,
        step: 'agent_selection',
        agentName,
        toolName,
      },
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
        executionTime,
      },
      visible: true,
      metadata: {
        source: 'multi_agent_system',
        requestId: this.conversationState.currentRequestId,
        step: 'execution_complete',
        agentName,
        toolName,
        executionTime,
      },
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
      'Plugin Agent': '🔌',
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
      navigate_to_position: 'Navigation Agent',
      open_new_tab: 'Navigation Agent',
      scroll_left: 'Navigation Agent',
      scroll_right: 'Navigation Agent',
      zoom_in: 'Navigation Agent',
      zoom_out: 'Navigation Agent',
      zoom_to_gene: 'Navigation Agent',
      bookmark_position: 'Navigation Agent',
      get_bookmarks: 'Navigation Agent',
      save_view_state: 'Navigation Agent',
      get_current_state: 'Navigation Agent',
      get_current_region: 'Navigation Agent',
      jump_to_gene: 'Navigation Agent',
      select_gene: 'Navigation Agent',
      select_sequence_region: 'Navigation Agent',

      // Analysis Agent - 数据分析和统计
      analyze_region: 'Analysis Agent',
      compare_regions: 'Analysis Agent',
      sequence_statistics: 'Analysis Agent',
      codon_usage_analysis: 'Analysis Agent',
      analyze_codon_usage: 'Analysis Agent',
      calculate_entropy: 'Analysis Agent',
      calculate_melting_temp: 'Analysis Agent',
      calculate_molecular_weight: 'Analysis Agent',
      predict_promoter: 'Analysis Agent',
      predict_rbs: 'Analysis Agent',
      predict_terminator: 'Analysis Agent',
      find_similar_sequences: 'Analysis Agent',

      // Data Agent - 数据管理和导出
      export_data: 'Data Agent',
      export_region_features: 'Data Agent',
      get_file_info: 'Data Agent',
      get_genome_info: 'Data Agent',
      get_chromosome_list: 'Data Agent',
      get_track_status: 'Data Agent',
      add_track: 'Data Agent',
      add_variant: 'Data Agent',

      // Sequence Agent - 序列分析
      get_sequence: 'Sequence Agent',
      translate_sequence: 'Sequence Agent',
      translate_dna: 'Sequence Agent',
      calculate_gc_content: 'Sequence Agent',
      compute_gc: 'Sequence Agent',
      calc_region_gc: 'Sequence Agent',
      reverse_complement: 'Sequence Agent',
      find_restriction_sites: 'Sequence Agent',
      virtual_digest: 'Sequence Agent',
      get_upstream_region: 'Sequence Agent',
      get_downstream_region: 'Sequence Agent',
      search_sequence_motif: 'Sequence Agent',

      // Protein Agent - 蛋白质相关
      open_protein_viewer: 'Protein Agent',
      fetch_protein_structure: 'Protein Agent',
      search_pdb_structures: 'Protein Agent',
      get_pdb_details: 'Protein Agent',
      amino_acid_composition: 'Protein Agent',

      // Network Agent - 网络和外部数据
      blast_search: 'Network Agent',
      blast_sequence_from_region: 'Network Agent',
      get_blast_databases: 'Network Agent',
      batch_blast_search: 'Network Agent',
      advanced_blast_search: 'Network Agent',
      local_blast_database_info: 'Network Agent',
      show_metabolic_pathway: 'Network Agent',
      find_pathway_genes: 'Network Agent',

      // External Agent - 外部工具和API
      search_features: 'External Agent',
      find_gene_by_name: 'External Agent',
      search_by_position: 'External Agent',
      search_motif: 'External Agent',
      search_pattern: 'External Agent',
      search_intergenic_regions: 'External Agent',
      get_nearby_features: 'External Agent',
      find_intergenic_regions: 'External Agent',

      // Plugin Agent - 插件功能
      get_gene_details: 'Plugin Agent',
      get_operons: 'Plugin Agent',
      create_annotation: 'Plugin Agent',
      add_annotation: 'Plugin Agent',
      edit_annotation: 'Plugin Agent',
      delete_annotation: 'Plugin Agent',
      batch_create_annotations: 'Plugin Agent',
      merge_annotations: 'Plugin Agent',
      toggle_track: 'Plugin Agent',
      toggle_annotation_track: 'Plugin Agent',
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
      'System Agent': `This tool requires general system operations. ${agentName} provides standard execution capabilities for system-level tasks.`,
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
        step: 'update_thinking',
      },
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
        // Use innerHTML to properly render HTML tags and entities
        thinkingContent.innerHTML += '\n' + message;
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
      // 格式化思考内容，使其更易读
      const formattedThinking = this.formatThinkingContent(thinkingContent);
      this.updateThinkingMessage(`💭 <strong>Model reasoning:</strong>`);
      this.updateThinkingMessage(`&nbsp;&nbsp;${formattedThinking.replace(/\n/g, '\n&nbsp;&nbsp;')}`);
    }

    // 检查是否有工具调用，并显示参数提取过程
    if (response.includes('tool_name') || response.includes('function_name')) {
      this.updateThinkingMessage(`🔧 Analyzing tool call structure...`);

      // Extract and display parameter information
      try {
        const toolCall = this.parseToolCall(response);
        if (toolCall) {
          const paramCount = Object.keys(toolCall.parameters || {}).length;
          this.updateThinkingMessage(`&nbsp;&nbsp;✅ Tool identified: <strong>${toolCall.tool_name}</strong>`);
          this.updateThinkingMessage(`&nbsp;&nbsp;📊 Parameters extracted: ${paramCount} parameter(s)`);

          // Display parameter details
          if (paramCount > 0) {
            const paramKeys = Object.keys(toolCall.parameters);
            this.updateThinkingMessage(`&nbsp;&nbsp;🔑 Keys: ${paramKeys.join(', ')}`);
          }
        }
      } catch (e) {
        console.warn('Error analyzing tool call:', e);
      }
    } else if (response && response.length > 0) {
      // No tool call - this is a conversational response
      this.updateThinkingMessage(`💬 Conversational response generated`);
      if (response.length > 100) {
        this.updateThinkingMessage(`&nbsp;&nbsp;📝 Response preview: "${response.substring(0, 100)}..."`);
      }
    }
  }

  /**
   * 格式化思考内容，使其更易读
   */
  formatThinkingContent(thinkingContent) {
    // 清理和格式化思考内容
    let formatted = thinkingContent
      .replace(/\n\s*\n/g, '\n') // 移除多余的空行
      .trim();

    // 如果内容很长，进行适当的换行处理
    if (formatted.length > 200) {
      // 在句号、问号、感叹号后添加换行（如果后面不是换行符）
      formatted = formatted.replace(/([.!?])\s+(?=[A-Z])/g, '$1\n\n');
    }

    // 确保内容以适当的格式结束
    if (!formatted.endsWith('.') && !formatted.endsWith('!') && !formatted.endsWith('?')) {
      formatted += '...';
    }

    return formatted;
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
        toolNames: toolsToExecute.map(t => t.tool_name),
      },
    });

    // 检查是否启用工具调用显示
    if (!this.showToolCalls) {
      return;
    }

    // 为每个工具获取来源信息
    const toolsWithSource = await Promise.all(
      toolsToExecute.map(async tool => {
        const source = await this.getToolSource(tool.tool_name);
        return { ...tool, source };
      })
    );

    const toolList = toolsWithSource
      .map(tool => {
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
      })
      .join('<br><br>');

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
          serverName: mcpTool.serverName,
        };
      }

      // 检查是否是插件函数
      if (this.pluginFunctionCallsIntegrator && this.pluginFunctionCallsIntegrator.isPluginFunction(toolName)) {
        return {
          type: 'plugin',
          display: 'Plugin Function',
          source: 'plugin-system',
        };
      }

      // 检查是否是内置本地函数 - 使用 FunctionCallsOrganizer 获取完整列表
      if (this.smartExecutor && this.smartExecutor.organizer) {
        const category = this.smartExecutor.organizer.getFunctionCategory(toolName);
        if (category) {
          // Tool found in FunctionCallsOrganizer - it's a local/internal tool
          return {
            type: 'local',
            display: 'Internal Function',
            source: 'genome-ai-studio',
            category: category.name,
            priority: category.priority,
          };
        }
      }

      // Fallback: Check builtin_tools_integration for database and other built-in tools
      if (this.builtInTools && this.builtInTools.builtInToolsMap) {
        const builtInTool = this.builtInTools.builtInToolsMap.get(toolName);
        if (builtInTool) {
          return {
            type: 'local',
            display: 'Built-in Tool',
            source: 'genome-ai-studio',
            category: builtInTool.category,
            priority: builtInTool.priority,
          };
        }
      }

      // 未知工具
      return {
        type: 'unknown',
        display: 'Unknown Source',
        source: 'unknown',
      };
    } catch (error) {
      console.warn(`Failed to get source for tool ${toolName}:`, error);
      return {
        type: 'error',
        display: 'Source Error',
        source: 'error',
      };
    }
  }

  /**
   * 获取不同来源类型的颜色
   */
  getSourceColor(sourceType) {
    const colors = {
      mcp: '#2196F3', // 蓝色 - MCP服务器
      plugin: '#FF9800', // 橙色 - 插件
      local: '#4CAF50', // 绿色 - 内置函数
      unknown: '#9E9E9E', // 灰色 - 未知
      error: '#F44336', // 红色 - 错误
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

    this.showNotification('Thinking process history cleared', 'success');
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
    if (!this.services || !this.services.context) {
      console.error('[ChatManager] context not initialized');
      return;
    }
    return this.services.context.addToolResultMessage(toolResults);
  }

  /**
   * Extract Deep Gene Research report from various MCP response formats
   * Handles: content arrays, direct report fields, raw text, and other structures
   * @param {*} resultData - The raw result data from MCP tool execution
   * @returns {Object} Normalized structure with report, geneSymbol, steps, and statistics
   */
  extractDeepGeneResearchReport(resultData) {
    let report = '';
    let geneSymbol = 'Unknown';
    let stepsCount = 0;
    let statistics = { totalCitations: 0, processedPapers: 0 };
    let images = [];
    let sources = [];

    try {
      // First pass: extract the primary content/data object
      let parsedData = resultData;

      // Handle: string input
      if (typeof resultData === 'string') {
        try {
          parsedData = JSON.parse(resultData);
        } catch (e) {
          // It's a raw string, use it as report for now
          report = resultData;
        }
      }

      // Handle: standard MCP "content" array
      if (parsedData.content && Array.isArray(parsedData.content)) {
        // Combine text parts
        const textContent = parsedData.content
          .filter(item => item.type === 'text' && item.text)
          .map(item => item.text)
          .join('\n\n');

        // Extract images and resources
        parsedData.content.forEach(item => {
          if (item.type === 'image' && item.data) images.push(item);
          if (item.type === 'resource' && item.resource) sources.push(item.resource);
        });

        // Check if the extracted text is actually a JSON string (Nested JSON case)
        if (textContent.trim().startsWith('{')) {
          try {
            const innerJson = JSON.parse(textContent);
            parsedData = innerJson; // Switch to using the inner JSON object
          } catch (e) {
            report = textContent; // Use text as report if not valid JSON
          }
        } else {
          report = textContent;
        }
      }
      // Handle: "result" wrapper (e.g., JSON-RPC style)
      else if (parsedData.result) {
        if (parsedData.result.content && Array.isArray(parsedData.result.content)) {
          // Similar logic for result.content
          const textContent = parsedData.result.content
            .filter(item => item.type === 'text' && item.text)
            .map(item => item.text)
            .join('\n\n');

          if (textContent.trim().startsWith('{')) {
            try {
              parsedData = JSON.parse(textContent);
            } catch (e) {
              report = textContent;
            }
          } else {
            report = textContent;
          }
        } else {
          parsedData = parsedData.result;
        }
      }
      // Handle: "text" field wrapper
      else if (parsedData.text) {
        if (parsedData.text.trim().startsWith('{')) {
          try {
            parsedData = JSON.parse(parsedData.text);
          } catch (e) {
            report = parsedData.text;
          }
        } else {
          report = parsedData.text;
        }
      }

      // --- Phase 2: Extract Data from the Resolved Object (parsedData) ---

      // 1. Extract Gene Symbol
      if (
        parsedData.workflow &&
        parsedData.workflow.geneIdentification &&
        parsedData.workflow.geneIdentification.geneSymbol
      ) {
        geneSymbol = parsedData.workflow.geneIdentification.geneSymbol;
      } else if (parsedData.metadata && parsedData.metadata.geneSymbol) {
        geneSymbol = parsedData.metadata.geneSymbol;
      } else if (parsedData.geneSymbol) {
        geneSymbol = parsedData.geneSymbol;
      } else if (parsedData.searchResults && parsedData.searchResults[0] && parsedData.searchResults[0].symbol) {
        geneSymbol = parsedData.searchResults[0].symbol;
      }

      // Fallback: Regex extraction if still unknown and we have text content
      // Ensure report is a string before regex operations
      if (geneSymbol === 'Unknown' && report && typeof report === 'string') {
        const patterns = [
          /gene[:\s]+\*?\*?([A-Za-z][A-Za-z0-9_-]{1,20})\*?\*?/i,
          /\*\*([A-Za-z][A-Za-z0-9_-]{1,20})\*\*\s+gene/i,
          /analysis\s+of\s+(?:the\s+)?([A-Za-z][A-Za-z0-9_-]{1,20})\s+gene/i,
        ];
        for (const pattern of patterns) {
          const match = report.match(pattern);
          if (match && match[1]) {
            // Validate to ensure it's not a common word like "repression"
            // Simple heuristic: exact match or reasonable gene format
            if (match[1].length <= 10) {
              geneSymbol = match[1];
              break;
            }
          }
        }
      }

      // 2. Extract/Construct Report Content
      if (parsedData.report) {
        report = parsedData.report;
      } else if (!report) {
        // If we don't have a direct report string yet, construct one from available fields
        let builtReport = '';

        if (geneSymbol !== 'Unknown') {
          builtReport += `# Deep Gene Research: ${geneSymbol}\n\n`;
        }

        if (parsedData.researchPlan) {
          builtReport += `## Research Plan\n\n${parsedData.researchPlan}\n\n`;
        }

        if (parsedData.researchGoal) {
          builtReport += `## Research Goal\n\n${parsedData.researchGoal}\n\n`;
        }

        if (parsedData.workflow) {
          builtReport += `## Workflow Configuration\n\n`;
          if (parsedData.workflow.organism) builtReport += `- **Organism**: ${parsedData.workflow.organism}\n`;
          if (parsedData.workflow.specificAspects && parsedData.workflow.specificAspects.length) {
            builtReport += `- **Focus Aspects**: ${parsedData.workflow.specificAspects.join(', ')}\n`;
          }
          builtReport += '\n';
        }

        if (parsedData.searchTasks && Array.isArray(parsedData.searchTasks)) {
          builtReport += `## Search Tasks\n\n`;
          parsedData.searchTasks.forEach((task, idx) => {
            builtReport += `${idx + 1}. ${task.query || task}\n`;
          });
          builtReport += '\n';
        }

        // If we constructed something meaningful, use it
        if (builtReport.length > 50) {
          report = builtReport;
        } else if (typeof parsedData === 'object') {
          // Ultima ratio: dump the object as markdown code block
          report = '## Raw Data Output\n\n```json\n' + JSON.stringify(parsedData, null, 2) + '\n```';
        }
      }

      // 3. Extract Statistics
      if (parsedData.statistics) {
        statistics.totalCitations = parsedData.statistics.totalCitations || parsedData.statistics.citations || 0;
        statistics.processedPapers = parsedData.statistics.processedPapers || parsedData.statistics.papers || 0;
      } else if (report && typeof report === 'string') {
        const doiMatches = report.match(/DOI:\s*[0-9.\/a-zA-Z-]+/gi);
        const pmidMatches = report.match(/PMID:\s*[0-9]+/gi);
        statistics.totalCitations = (doiMatches ? doiMatches.length : 0) + (pmidMatches ? pmidMatches.length : 0);
      }

      // 4. Extract Steps Count
      if (parsedData.workflow && parsedData.workflow.steps) {
        stepsCount = parsedData.workflow.steps.length;
      } else if (parsedData.steps) {
        stepsCount = Array.isArray(parsedData.steps) ? parsedData.steps.length : parsedData.steps;
      } else if (parsedData.searchTasks) {
        stepsCount = parsedData.searchTasks.length;
      }

      // 5. Extract Sources
      if (parsedData.sources) sources = sources.concat(parsedData.sources);
      if (parsedData.references) sources = sources.concat(parsedData.references);
    } catch (error) {
      console.error('Error extracting Deep Gene Research report:', error);
      // Emergency fallback
      if (!report && typeof resultData === 'string') report = resultData;
      else if (!report) report = JSON.stringify(resultData, null, 2);
    }

    return { report, geneSymbol, stepsCount, statistics, images, sources };
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
    array.slice(0, 100).forEach(item => {
      // 限制显示前100行
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
            html += `[${value
              .slice(0, 3)
              .map(v => JSON.stringify(v))
              .join(', ')}, ... ${value.length - 3} more]`;
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

  startNewChat() {
    console.log('Starting new chat...');

    // Original ChatBox functionality
    this.clearChat();
    this.conversationState.contextModeEnabled = false;

    // Add conversation separator for ChatBox history
    if (this.configManager) {
      this.configManager.addChatMessage('--- CONVERSATION_SEPARATOR ---', 'system');
    }

    this.showNotification('New conversation started', 'success');
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

  // ==================== Track Settings Tools ====================

  /**
   * Get settings for a specific track type
   */
  async getTrackSettings(parameters) {
    const { track_type } = parameters;

    if (!track_type) {
      throw new Error('track_type parameter is required');
    }

    const validTrackTypes = [
      'genes',
      'reads',
      'sequence',
      'gc',
      'variants',
      'actions',
      'blast',
      'wigTracks',
      'sequenceLine',
    ];
    if (!validTrackTypes.includes(track_type)) {
      throw new Error(`Invalid track_type: ${track_type}. Valid types: ${validTrackTypes.join(', ')}`);
    }

    if (!this.genomeBrowser?.trackRenderer) {
      throw new Error('TrackRenderer not available');
    }

    const settings = this.genomeBrowser.trackRenderer.getTrackSettings(track_type);

    return {
      success: true,
      track_type,
      settings,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Set settings for a specific track type
   */
  async setTrackSettings(parameters) {
    const { track_type, settings } = parameters;

    if (!track_type) {
      throw new Error('track_type parameter is required');
    }

    if (!settings || typeof settings !== 'object') {
      throw new Error('settings parameter must be an object');
    }

    const validTrackTypes = [
      'genes',
      'reads',
      'sequence',
      'gc',
      'variants',
      'actions',
      'blast',
      'wigTracks',
      'sequenceLine',
    ];
    if (!validTrackTypes.includes(track_type)) {
      throw new Error(`Invalid track_type: ${track_type}. Valid types: ${validTrackTypes.join(', ')}`);
    }

    if (!this.genomeBrowser?.trackRenderer) {
      throw new Error('TrackRenderer not available');
    }

    // Get current settings and merge with new settings
    const currentSettings = this.genomeBrowser.trackRenderer.getTrackSettings(track_type);
    const mergedSettings = { ...currentSettings, ...settings };

    // Save and apply settings
    this.genomeBrowser.trackRenderer.saveTrackSettings(track_type, mergedSettings);
    this.genomeBrowser.trackRenderer.applySettingsToTrack(track_type, mergedSettings);

    return {
      success: true,
      track_type,
      updated_settings: settings,
      applied_settings: mergedSettings,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get all track settings
   */
  async getAllTrackSettings(parameters = {}) {
    if (!this.genomeBrowser?.trackRenderer) {
      throw new Error('TrackRenderer not available');
    }

    const trackTypes = [
      'genes',
      'reads',
      'sequence',
      'gc',
      'variants',
      'actions',
      'blast',
      'wigTracks',
      'sequenceLine',
    ];
    const allSettings = {};

    for (const trackType of trackTypes) {
      try {
        allSettings[trackType] = this.genomeBrowser.trackRenderer.getTrackSettings(trackType);
      } catch (error) {
        console.warn(`Failed to get settings for ${trackType}:`, error.message);
        allSettings[trackType] = { error: error.message };
      }
    }

    return {
      success: true,
      settings: allSettings,
      track_count: trackTypes.length,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Reset track settings to defaults
   */
  async resetTrackSettings(parameters) {
    const { track_type } = parameters;

    if (!track_type) {
      throw new Error('track_type parameter is required');
    }

    if (!this.genomeBrowser?.trackRenderer) {
      throw new Error('TrackRenderer not available');
    }

    if (track_type === 'all') {
      // Reset all tracks
      const trackTypes = [
        'genes',
        'reads',
        'sequence',
        'gc',
        'variants',
        'actions',
        'blast',
        'wigTracks',
        'sequenceLine',
      ];
      const results = {};

      for (const type of trackTypes) {
        try {
          // Clear saved settings from storage
          if (this.genomeBrowser.configManager) {
            this.genomeBrowser.configManager.set(`tracks.${type}.settings`, {});
          }
          localStorage.removeItem(`trackSettings_${type}`);

          // Get fresh default settings
          const defaultSettings = this.genomeBrowser.trackRenderer.getTrackSettings(type);
          this.genomeBrowser.trackRenderer.applySettingsToTrack(type, defaultSettings);

          results[type] = { success: true };
        } catch (error) {
          results[type] = { success: false, error: error.message };
        }
      }

      // Save config changes
      if (this.genomeBrowser.configManager) {
        this.genomeBrowser.configManager.saveConfig();
      }

      return {
        success: true,
        track_type: 'all',
        results,
        timestamp: new Date().toISOString(),
      };
    } else {
      // Reset specific track
      const validTrackTypes = [
        'genes',
        'reads',
        'sequence',
        'gc',
        'variants',
        'actions',
        'blast',
        'wigTracks',
        'sequenceLine',
      ];
      if (!validTrackTypes.includes(track_type)) {
        throw new Error(`Invalid track_type: ${track_type}`);
      }

      // Clear saved settings from storage
      if (this.genomeBrowser.configManager) {
        this.genomeBrowser.configManager.set(`tracks.${track_type}.settings`, {});
      }
      localStorage.removeItem(`trackSettings_${track_type}`);

      // Get fresh default settings
      const defaultSettings = this.genomeBrowser.trackRenderer.getTrackSettings(track_type);
      this.genomeBrowser.trackRenderer.applySettingsToTrack(track_type, defaultSettings);

      // Save config changes
      if (this.genomeBrowser.configManager) {
        this.genomeBrowser.configManager.saveConfig();
      }

      return {
        success: true,
        track_type,
        default_settings: defaultSettings,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get track settings schema
   */
  async getTrackSettingsSchema(parameters = {}) {
    // Import the schema from TrackSettingsTools
    const TrackSettingsTools = require('../../mcp-tools/track/TrackSettingsTools');
    const tools = new TrackSettingsTools();
    const schema = tools.getDefaultSettingsSchema();

    return {
      success: true,
      schema,
      description: 'Complete schema of available track settings with types, defaults, and validation rules',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Batch set track settings for multiple tracks
   */
  async batchSetTrackSettings(parameters) {
    const { settings_map } = parameters;

    if (!settings_map || typeof settings_map !== 'object') {
      throw new Error('settings_map parameter must be an object');
    }

    const results = {};
    const errors = [];

    for (const [trackType, settings] of Object.entries(settings_map)) {
      try {
        const result = await this.setTrackSettings({
          track_type: trackType,
          settings: settings,
        });
        results[trackType] = result;
      } catch (error) {
        results[trackType] = { success: false, error: error.message };
        errors.push(`${trackType}: ${error.message}`);
      }
    }

    return {
      success: errors.length === 0,
      track_count: Object.keys(settings_map).length,
      successful_updates: Object.keys(settings_map).length - errors.length,
      failed_updates: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
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
