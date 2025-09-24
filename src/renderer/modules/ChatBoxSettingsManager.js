/**
 * ChatBox Settings Manager
 * Handles all ChatBox-related configuration and settings
 */
class ChatBoxSettingsManager {
    constructor(configManager) {
        this.configManager = configManager;
        this.settings = {
            // Display settings
            showThinkingProcess: true,
            showToolCalls: true,
            showToolCallSource: true, // 新增：显示tool call来源
            showDetailedToolData: true, // 新增：显示详细数据展示
            hideThinkingAfterConversation: false,
            preserveThinkingHistory: true, // 新增：保留历史思考过程
            
            // Behavior settings
            autoScrollToBottom: true,
            showTimestamps: false,
            
            // History settings
            maxHistoryMessages: 1000,
            enableHistorySearch: true,
            
            // Performance settings
            responseTimeout: 30000, // 30 seconds
            typingIndicatorDelay: 500,
            
            // UI settings
            animateThinking: true,
            compactMode: false,
            fontSize: 'medium', // small, medium, large
            theme: 'auto', // auto, light, dark
            
            // Advanced settings
            debugMode: false,
            logToolCalls: false,
            enableAbortButton: true,
            useOptimizedPrompt: true, // 新增：使用优化的系统提示
            enableDynamicToolsRegistry: true, // 新增：启用Dynamic Tools Registry
            
            // Tool priority settings
            toolPriority: ['local', 'genomics', 'plugins', 'mcp'], // 工具优先级顺序
            
            // Window settings
            rememberPosition: true,
            rememberSize: true,
            startMinimized: false,
            
            // Multi-Agent System settings
            agentSystemEnabled: false,
            agentAutoOptimize: true,
            agentShowInfo: true,
            agentMemoryEnabled: true,
            agentCacheEnabled: true,
            
            // Memory System settings
            memorySystemEnabled: true,
            memoryCacheEnabled: true,
            memoryOptimizationEnabled: true,
            memoryCleanupInterval: 300000, // 5 minutes
            memoryMaxEntries: 10000,
            
            // Multi-Agent LLM settings
            agentLLMProvider: 'auto', // auto, openai, anthropic, google, local
            agentLLMModel: 'auto', // auto or specific model
            agentLLMTemperature: 0.7,
            agentLLMMaxTokens: 4000,
            agentLLMTimeout: 30000,
            agentLLMRetryAttempts: 3,
            agentLLMUseSystemPrompt: true,
            agentLLMEnableFunctionCalling: true,
            
            // Function Call Settings
            functionCallRounds: 5,
            enableEarlyCompletion: true,
            completionThreshold: 0.7,
            
            // Model Selection Settings
            chatboxModelType: 'auto',
            chatboxLLMTemperature: 0.7,
            chatboxLLMMaxTokens: 4000,
            chatboxLLMTimeout: 30,
            chatboxLLMUseSystemPrompt: true,
            chatboxLLMEnableFunctionCalling: true
        };
        
        this.loadSettings();
        this.setupEventListeners();
    }

    /**
     * Load settings from config manager
     */
    loadSettings() {
        const savedSettings = this.configManager.get('chatboxSettings', {});
        this.settings = { ...this.settings, ...savedSettings };
        
        // Sync Function Call Settings from the main LLM configuration
        const llmFunctionCallRounds = this.configManager.get('llm.functionCallRounds');
        const llmEnableEarlyCompletion = this.configManager.get('llm.enableEarlyCompletion');
        const llmCompletionThreshold = this.configManager.get('llm.completionThreshold');
        
        if (llmFunctionCallRounds !== undefined) {
            this.settings.functionCallRounds = llmFunctionCallRounds;
        }
        if (llmEnableEarlyCompletion !== undefined) {
            this.settings.enableEarlyCompletion = llmEnableEarlyCompletion;
        }
        if (llmCompletionThreshold !== undefined) {
            this.settings.completionThreshold = llmCompletionThreshold;
        }
        
        console.log('🔧 ChatBox settings loaded:', this.settings);
        console.log('🔄 Synced Function Call Settings from LLM config');
    }

    /**
     * Save settings to config manager
     */
    saveSettings() {
        this.configManager.set('chatboxSettings', this.settings);
        
        // Sync Function Call Settings to the main LLM configuration
        if (this.settings.hasOwnProperty('functionCallRounds')) {
            this.configManager.set('llm.functionCallRounds', this.settings.functionCallRounds);
        }
        if (this.settings.hasOwnProperty('enableEarlyCompletion')) {
            this.configManager.set('llm.enableEarlyCompletion', this.settings.enableEarlyCompletion);
        }
        if (this.settings.hasOwnProperty('completionThreshold')) {
            this.configManager.set('llm.completionThreshold', this.settings.completionThreshold);
        }
        
        console.log('💾 ChatBox settings saved:', this.settings);
        console.log('🔄 Synced Function Call Settings to LLM config');
        console.log('📊 Current LLM functionCallRounds:', this.configManager.get('llm.functionCallRounds'));
        
        // Emit settings changed event
        this.emit('settingsChanged', this.settings);
    }

    /**
     * Get a specific setting
     */
    getSetting(key, defaultValue = null) {
        return this.settings.hasOwnProperty(key) ? this.settings[key] : defaultValue;
    }

    /**
     * Set a specific setting
     */
    setSetting(key, value) {
        if (this.settings.hasOwnProperty(key)) {
            this.settings[key] = value;
            this.saveSettings();
            return true;
        }
        console.warn('⚠️ Unknown ChatBox setting:', key);
        return false;
    }

    /**
     * Update multiple settings at once
     */
    updateSettings(newSettings) {
        let hasChanges = false;
        
        for (const [key, value] of Object.entries(newSettings)) {
            if (this.settings.hasOwnProperty(key) && this.settings[key] !== value) {
                this.settings[key] = value;
                hasChanges = true;
            }
        }
        
        if (hasChanges) {
            this.saveSettings();
        }
        
        return hasChanges;
    }

    /**
     * Reset settings to default values
     */
    resetToDefaults() {
        const defaultSettings = {
            showThinkingProcess: true,
            showToolCalls: true,
            showToolCallSource: true,
            showDetailedToolData: true,
            hideThinkingAfterConversation: false,
            autoScrollToBottom: true,
            showTimestamps: false,
            maxHistoryMessages: 1000,
            enableHistorySearch: true,
            responseTimeout: 30000,
            typingIndicatorDelay: 500,
            animateThinking: true,
            compactMode: false,
            fontSize: 'medium',
            theme: 'auto',
            debugMode: false,
            logToolCalls: false,
            enableAbortButton: true,
            useOptimizedPrompt: true,
            toolPriority: ['local', 'genomics', 'plugins', 'mcp'],
            rememberPosition: true,
            rememberSize: true,
            startMinimized: false,
            
            // Function Call Settings (duplicated in defaultSettings)
            functionCallRounds: 5,
            enableEarlyCompletion: true,
            completionThreshold: 0.7,
            
            // Model Selection Settings
            chatboxModelType: 'auto',
            chatboxLLMTemperature: 0.7,
            chatboxLLMMaxTokens: 4000,
            chatboxLLMTimeout: 30,
            chatboxLLMUseSystemPrompt: true,
            chatboxLLMEnableFunctionCalling: true
        };
        
        this.settings = { ...defaultSettings };
        this.saveSettings();
        console.log('🔄 ChatBox settings reset to defaults');
    }

    /**
     * Get all settings
     */
    getAllSettings() {
        return { ...this.settings };
    }

    /**
     * Validate settings
     */
    validateSettings() {
        const errors = [];
        
        // Validate numeric settings
        if (typeof this.settings.maxHistoryMessages !== 'number' || this.settings.maxHistoryMessages < 1) {
            errors.push('maxHistoryMessages must be a positive number');
        }
        
        if (typeof this.settings.responseTimeout !== 'number' || this.settings.responseTimeout < 1000) {
            errors.push('responseTimeout must be at least 1000ms');
        }
        
        if (typeof this.settings.typingIndicatorDelay !== 'number' || this.settings.typingIndicatorDelay < 0) {
            errors.push('typingIndicatorDelay must be a non-negative number');
        }
        
        // Validate enum settings
        const validFontSizes = ['small', 'medium', 'large'];
        if (!validFontSizes.includes(this.settings.fontSize)) {
            errors.push('fontSize must be one of: ' + validFontSizes.join(', '));
        }
        
        const validThemes = ['auto', 'light', 'dark'];
        if (!validThemes.includes(this.settings.theme)) {
            errors.push('theme must be one of: ' + validThemes.join(', '));
        }
        
        return errors;
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Listen for settings UI events
        if (typeof window !== 'undefined') {
            window.addEventListener('chatbox-setting-changed', (event) => {
                const { key, value } = event.detail;
                this.setSetting(key, value);
            });
        }
    }

    /**
     * Simple event emitter functionality
     */
    emit(eventName, data) {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(`chatbox-${eventName}`, { detail: data }));
        }
    }

    /**
     * Show settings modal
     */
    showSettingsModal() {
        // Create settings modal if it doesn't exist
        let modal = document.getElementById('chatboxSettingsModal');
        if (!modal) {
            modal = this.createSettingsModal();
            document.body.appendChild(modal);
        }
        
        
        // Add reset to defaults button handler
        const resetDefaultsBtn = modal.querySelector('.reset-defaults-btn');
        if (resetDefaultsBtn) {
            resetDefaultsBtn.addEventListener('click', () => {
                this.resetToDefaults();
                this.populateSettingsForm(modal);
            });
        }
        
        // Add reset position button handler
        const resetPositionBtn = modal.querySelector('.reset-position-btn');
        if (resetPositionBtn) {
            resetPositionBtn.addEventListener('click', () => {
                const modalContent = modal.querySelector('.modal-content');
                if (modalContent) {
                    modalContent.style.position = 'fixed';
                    modalContent.style.transform = 'translate(-50%, -50%)';
                    modalContent.style.top = '50%';
                    modalContent.style.left = '50%';
                    modalContent.style.margin = '0';
                }
            });
        }
        
        // Populate current settings
        this.populateSettingsForm(modal);
        
        // Show modal with proper positioning
        modal.style.display = 'block';
        modal.classList.add('show');
        
        // Initialize draggable and resizable using centralized managers
        if (window.modalDragManager) {
            window.modalDragManager.makeDraggable('#chatboxSettingsModal');
        }
        if (window.resizableModalManager) {
            window.resizableModalManager.makeResizable('#chatboxSettingsModal');
        }
        
        // Focus first input
        const firstInput = modal.querySelector('input, select');
        if (firstInput) {
            firstInput.focus();
        }
    }

    /**
     * Create settings modal HTML
     */
    createSettingsModal() {
        const modal = document.createElement('div');
        modal.id = 'chatboxSettingsModal';
        modal.className = 'modal';
        
        modal.innerHTML = `
            <div class="modal-content resizable" style="max-width: 800px;">
                <div class="modal-header">
                    <h3><i class="fas fa-comments"></i> ChatBox Settings</h3>
                    <div class="modal-controls">
                        <button class="reset-position-btn" title="Reset Position">
                            <i class="fas fa-crosshairs"></i>
                        </button>
                        <button class="reset-defaults-btn" title="Reset to Defaults">
                            <i class="fas fa-undo"></i>
                        </button>
                        <button class="modal-close" onclick="this.closest('.modal').style.display='none'; this.closest('.modal').classList.remove('show');">
                            &times;
                        </button>
                    </div>
                </div>
                
                <div class="modal-body">
                    <div class="settings-tabs">
                        <div class="tab-header">
                            <button class="tab-btn active" data-tab="display">
                                <i class="fas fa-eye"></i> Display
                            </button>
                            <button class="tab-btn" data-tab="behavior">
                                <i class="fas fa-cogs"></i> Behavior
                            </button>
                            <button class="tab-btn" data-tab="models">
                                <i class="fas fa-brain"></i> Models
                            </button>
                            <button class="tab-btn" data-tab="memory">
                                <i class="fas fa-brain"></i> Memory
                            </button>
                            <button class="tab-btn" data-tab="advanced">
                                <i class="fas fa-tools"></i> Advanced
                            </button>
                        </div>
                        
                        <!-- Display Tab -->
                        <div id="display-tab" class="tab-content active">
                            <div class="form-section">
                                <h4>Thinking Process</h4>
                                <div class="form-group">
                                    <label>
                                        <input type="checkbox" id="showThinkingProcess" class="setting-checkbox">
                                        Show AI thinking process
                                    </label>
                                    <small class="help-text">Display the AI's reasoning and analysis steps</small>
                                </div>
                                
                                <div class="form-group">
                                    <label>
                                        <input type="checkbox" id="hideThinkingAfterConversation" class="setting-checkbox">
                                        Hide thinking process after conversation ends
                                    </label>
                                    <small class="help-text">Automatically remove thinking process when conversation completes</small>
                                </div>
                                
                                <div class="form-group">
                                    <label>
                                        <input type="checkbox" id="preserveThinkingHistory" class="setting-checkbox">
                                        Preserve thinking history
                                    </label>
                                    <small class="help-text">Keep thinking process history in chat records</small>
                                </div>
                                
                                <div class="form-group">
                                    <label>
                                        <input type="checkbox" id="showToolCalls" class="setting-checkbox">
                                        Show tool calls
                                    </label>
                                    <small class="help-text">Display detailed information about tool execution</small>
                                </div>
                                
                                <div class="form-group">
                                    <label>
                                        <input type="checkbox" id="showToolCallSource" class="setting-checkbox">
                                        Show tool call source
                                    </label>
                                    <small class="help-text">Display the specific source of each tool call (MCP Server or internal function)</small>
                                </div>
                                
                                <div class="form-group">
                                    <label>
                                        <input type="checkbox" id="showDetailedToolData" class="setting-checkbox">
                                        Show detailed tool data
                                    </label>
                                    <small class="help-text">Display detailed data content returned by tool calls</small>
                                </div>
                            </div>
                            
                            <div class="form-section">
                                <h4>Interface</h4>
                                <div class="form-group">
                                    <label>
                                        <input type="checkbox" id="showTimestamps" class="setting-checkbox">
                                        Show message timestamps
                                    </label>
                                    <small class="help-text">Display when each message was sent</small>
                                </div>
                                
                                <div class="form-group">
                                    <label for="fontSize">Font size:</label>
                                    <select id="fontSize" class="select">
                                        <option value="small">Small</option>
                                        <option value="medium">Medium</option>
                                        <option value="large">Large</option>
                                    </select>
                                </div>
                                
                                <div class="form-group">
                                    <label for="theme">Theme:</label>
                                    <select id="theme" class="select">
                                        <option value="auto">Auto</option>
                                        <option value="light">Light</option>
                                        <option value="dark">Dark</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Behavior Tab -->
                        <div id="behavior-tab" class="tab-content">
                            <div class="form-section">
                                <h4>Interaction</h4>
                                <div class="form-group">
                                    <label>
                                        <input type="checkbox" id="autoScrollToBottom" class="setting-checkbox">
                                        Auto-scroll to bottom
                                    </label>
                                    <small class="help-text">Automatically scroll to show new messages</small>
                                </div>
                                
                                <div class="form-group">
                                    <label>
                                        <input type="checkbox" id="enableAbortButton" class="setting-checkbox">
                                        Enable abort button
                                    </label>
                                    <small class="help-text">Show button to stop ongoing conversations</small>
                                </div>
                            </div>
                            
                            <div class="form-section">
                                <h4>History</h4>
                                <div class="form-group">
                                    <label for="maxHistoryMessages">Max history messages:</label>
                                    <input type="number" id="maxHistoryMessages" class="input-full" min="10" max="10000" step="10">
                                    <small class="help-text">Maximum number of messages to keep in history</small>
                                </div>
                                
                                <div class="form-group">
                                    <label>
                                        <input type="checkbox" id="enableHistorySearch" class="setting-checkbox">
                                        Enable history search
                                    </label>
                                    <small class="help-text">Allow searching through chat history</small>
                                </div>
                            </div>
                            
                            <div class="form-section">
                                <h4>Performance</h4>
                                <div class="form-group">
                                    <label for="responseTimeout">Response timeout (seconds):</label>
                                    <input type="number" id="responseTimeout" class="input-full" min="5" max="300" step="5">
                                    <small class="help-text">How long to wait for LLM responses</small>
                                </div>
                            </div>
                            
                            <div class="form-section">
                                <h4>Function Call Settings</h4>
                                <div class="form-group">
                                    <label for="functionCallRounds">Maximum Function Call Rounds:</label>
                                    <input type="number" id="functionCallRounds" class="input-full" min="1" max="10" step="1">
                                    <small class="help-text">Maximum number of consecutive function calls the AI can make (1-10). Higher values allow more complex multi-step operations but may take longer.</small>
                                </div>
                                <div class="form-group">
                                    <label>
                                        <input type="checkbox" id="enableEarlyCompletion" class="setting-checkbox">
                                        Enable Early Task Completion
                                    </label>
                                    <small class="help-text">Allow the AI to end the function call loop early when it determines the task is complete, instead of using all available rounds.</small>
                                </div>
                                <div class="form-group">
                                    <label for="completionThreshold">Task Completion Confidence Threshold:</label>
                                    <div class="slider-container">
                                        <input type="range" id="completionThreshold" class="range-slider" min="0.5" max="1.0" step="0.05" value="0.7">
                                        <div class="slider-labels">
                                            <span class="slider-label-left">50% (Low)</span>
                                            <span class="slider-value" id="completionThresholdValue">70%</span>
                                            <span class="slider-label-right">100% (High)</span>
                                        </div>
                                    </div>
                                    <small class="help-text">Minimum confidence level required for the AI to consider a task complete. Higher values reduce false positives but may miss valid completions.</small>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Models Tab -->
                        <div id="models-tab" class="tab-content">
                            <div class="form-section">
                                <h4>🤖 Model Selection</h4>
                                <div class="form-group">
                                    <label for="chatboxModelType">Primary Model Type:</label>
                                    <select id="chatboxModelType" class="select">
                                        <option value="auto">Auto (Use main LLM)</option>
                                        <option value="reasoning">Reasoning Model</option>
                                        <option value="task">Task Model</option>
                                        <option value="code">Code Model</option>
                                        <option value="multimodal">Multimodal Model</option>
                                    </select>
                                    <small class="help-text">Choose the primary model type for ChatBox conversations. Configure specific models in Options → Configure LLMs → Model Selection.</small>
                                </div>
                                
                                <div class="form-group">
                                    <label for="chatboxLLMTemperature">Temperature:</label>
                                    <div class="slider-container">
                                        <input type="range" id="chatboxLLMTemperature" class="range-slider" min="0" max="2" step="0.1" value="0.7">
                                        <div class="slider-labels">
                                            <span class="slider-label-left">0 (Deterministic)</span>
                                            <span class="slider-value" id="chatboxLLMTemperatureValue">0.7</span>
                                            <span class="slider-label-right">2 (Creative)</span>
                                        </div>
                                    </div>
                                    <small class="help-text">Control creativity vs consistency in responses</small>
                                </div>
                                
                                <div class="form-group">
                                    <label for="chatboxLLMMaxTokens">Max Tokens:</label>
                                    <input type="number" id="chatboxLLMMaxTokens" class="input-full" min="1000" max="32000" step="1000" value="4000">
                                    <small class="help-text">Maximum tokens for LLM responses</small>
                                </div>
                                
                                <div class="form-group">
                                    <label for="chatboxLLMTimeout">Timeout (seconds):</label>
                                    <input type="number" id="chatboxLLMTimeout" class="input-full" min="5" max="300" step="5" value="30">
                                    <small class="help-text">Timeout for LLM requests</small>
                                </div>
                                
                                <div class="form-group">
                                    <label>
                                        <input type="checkbox" id="chatboxLLMUseSystemPrompt" class="setting-checkbox" checked>
                                        Use system prompt
                                    </label>
                                    <small class="help-text">Enable system prompts for better behavior</small>
                                </div>
                                
                                <div class="form-group">
                                    <label>
                                        <input type="checkbox" id="chatboxLLMEnableFunctionCalling" class="setting-checkbox" checked>
                                        Enable function calling
                                    </label>
                                    <small class="help-text">Allow the AI to use function calling capabilities</small>
                                </div>
                            </div>
                            
                            <div class="form-section">
                                <h4>ℹ️ Configuration Info</h4>
                                <div class="info-box">
                                    <p><strong>Model Configuration:</strong> To configure specific models for each type, go to <strong>Options → Configure LLMs → Model Selection</strong>.</p>
                                    <p><strong>API Keys:</strong> API keys are configured in the main LLM configuration.</p>
                                    <p><strong>Inheritance:</strong> These settings serve as defaults for Multi-Agent System. Agent-specific settings can override these defaults.</p>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Memory Tab -->
                        <div id="memory-tab" class="tab-content">
                            <div class="form-section">
                                <h4>🧠 Memory System</h4>
                                <div class="form-group">
                                    <label>
                                        <input type="checkbox" id="memorySystemEnabled" class="setting-checkbox">
                                        Enable Memory System
                                    </label>
                                    <small class="help-text">Enable intelligent memory caching and context management</small>
                                </div>
                                
                                <div class="form-group">
                                    <label>
                                        <input type="checkbox" id="memoryCacheEnabled" class="setting-checkbox">
                                        Enable memory caching
                                    </label>
                                    <small class="help-text">Cache memory operations for improved performance</small>
                                </div>
                                
                                <div class="form-group">
                                    <label>
                                        <input type="checkbox" id="memoryOptimizationEnabled" class="setting-checkbox">
                                        Enable memory optimization
                                    </label>
                                    <small class="help-text">Automatically optimize memory usage and cleanup</small>
                                </div>
                                
                                <div class="form-group">
                                    <label for="memoryCleanupInterval">Memory cleanup interval (minutes):</label>
                                    <input type="number" id="memoryCleanupInterval" class="input-full" min="1" max="60" step="1">
                                    <small class="help-text">How often to perform memory cleanup operations</small>
                                </div>
                                
                                <div class="form-group">
                                    <label for="memoryMaxEntries">Maximum memory entries:</label>
                                    <input type="number" id="memoryMaxEntries" class="input-full" min="100" max="100000" step="100">
                                    <small class="help-text">Maximum number of entries to keep in memory</small>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Advanced Tab -->
                        <div id="advanced-tab" class="tab-content">
                            <div class="form-section">
                                <h4>Animation & Effects</h4>
                                <div class="form-group">
                                    <label>
                                        <input type="checkbox" id="animateThinking" class="setting-checkbox">
                                        Animate thinking process
                                    </label>
                                    <small class="help-text">Show animations for thinking process updates</small>
                                </div>
                                
                                <div class="form-group">
                                    <label>
                                        <input type="checkbox" id="compactMode" class="setting-checkbox">
                                        Compact mode
                                    </label>
                                    <small class="help-text">Use more compact message layout</small>
                                </div>
                            </div>
                            
                            <div class="form-section">
                                <h4>Window Management</h4>
                                <div class="form-group">
                                    <label>
                                        <input type="checkbox" id="rememberPosition" class="setting-checkbox">
                                        Remember window position
                                    </label>
                                    <small class="help-text">Save and restore chat window position</small>
                                </div>
                                
                                <div class="form-group">
                                    <label>
                                        <input type="checkbox" id="rememberSize" class="setting-checkbox">
                                        Remember window size
                                    </label>
                                    <small class="help-text">Save and restore chat window size</small>
                                </div>
                                
                                <div class="form-group">
                                    <label>
                                        <input type="checkbox" id="startMinimized" class="setting-checkbox">
                                        Start minimized
                                    </label>
                                    <small class="help-text">Start chat window in minimized state</small>
                                </div>
                            </div>
                            
                            <div class="form-section">
                                <h4>System Prompt</h4>
                                <div class="form-group">
                                    <label>
                                        <input type="checkbox" id="enableDynamicToolsRegistry" class="setting-checkbox">
                                        Enable Dynamic Tools Registry
                                    </label>
                                    <small class="help-text">Use intelligent tool selection based on user intent and context. When disabled, uses the traditional comprehensive system prompt.</small>
                                </div>
                                
                                <div class="form-group">
                                    <label>
                                        <input type="checkbox" id="useOptimizedPrompt" class="setting-checkbox">
                                        Use optimized system prompt
                                    </label>
                                    <small class="help-text">Use streamlined system prompt for better performance and reduced token usage (only applies when Dynamic Tools Registry is disabled)</small>
                                </div>
                            </div>
                            
                            <div class="form-section">
                                <h4>Tool Selection Priority</h4>
                                <div class="form-group">
                                    <label>Configure tool selection priority order:</label>
                                    <div id="toolPriorityContainer" class="priority-container">
                                        <div class="priority-item" data-type="local" draggable="true">
                                            <div class="priority-drag-handle">⋮⋮</div>
                                            <span class="priority-number">1</span>
                                            <div class="priority-info">
                                                <span class="priority-label">Local Tools</span>
                                                <span class="priority-description">Built-in genome browser tools</span>
                                            </div>
                                            <div class="priority-controls">
                                                <button type="button" class="priority-btn up" title="Move up" onclick="movePriorityUp(this)">↑</button>
                                                <button type="button" class="priority-btn down" title="Move down" onclick="movePriorityDown(this)">↓</button>
                                            </div>
                                        </div>
                                        <div class="priority-item" data-type="genomics" draggable="true">
                                            <div class="priority-drag-handle">⋮⋮</div>
                                            <span class="priority-number">2</span>
                                            <div class="priority-info">
                                                <span class="priority-label">Genomics Tools</span>
                                                <span class="priority-description">Specialized analysis tools</span>
                                            </div>
                                            <div class="priority-controls">
                                                <button type="button" class="priority-btn up" title="Move up" onclick="movePriorityUp(this)">↑</button>
                                                <button type="button" class="priority-btn down" title="Move down" onclick="movePriorityDown(this)">↓</button>
                                            </div>
                                        </div>
                                        <div class="priority-item" data-type="plugins" draggable="true">
                                            <div class="priority-drag-handle">⋮⋮</div>
                                            <span class="priority-number">3</span>
                                            <div class="priority-info">
                                                <span class="priority-label">Plugin Tools</span>
                                                <span class="priority-description">Third-party extensions</span>
                                            </div>
                                            <div class="priority-controls">
                                                <button type="button" class="priority-btn up" title="Move up" onclick="movePriorityUp(this)">↑</button>
                                                <button type="button" class="priority-btn down" title="Move down" onclick="movePriorityDown(this)">↓</button>
                                            </div>
                                        </div>
                                        <div class="priority-item" data-type="mcp" draggable="true">
                                            <div class="priority-drag-handle">⋮⋮</div>
                                            <span class="priority-number">4</span>
                                            <div class="priority-info">
                                                <span class="priority-label">MCP Server Tools</span>
                                                <span class="priority-description">External server tools</span>
                                            </div>
                                            <div class="priority-controls">
                                                <button type="button" class="priority-btn up" title="Move up" onclick="movePriorityUp(this)">↑</button>
                                                <button type="button" class="priority-btn down" title="Move down" onclick="movePriorityDown(this)">↓</button>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="priority-help">
                                        <small class="help-text">
                                            <strong>How it works:</strong> When the AI assistant needs to use tools, it will prefer tools from higher priority categories first. 
                                            You can drag items or use the arrow buttons to reorder the priority.
                                        </small>
                                        <div class="priority-status" id="priorityStatus">
                                            <small>Current order will be applied to conversations</small>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="form-section">
                                <h4>Debug</h4>
                                <div class="form-group">
                                    <label>
                                        <input type="checkbox" id="debugMode" class="setting-checkbox">
                                        Debug mode
                                    </label>
                                    <small class="help-text">Show detailed debug information in console</small>
                                </div>
                                
                                <div class="form-group">
                                    <label>
                                        <input type="checkbox" id="logToolCalls" class="setting-checkbox">
                                        Log tool calls
                                    </label>
                                    <small class="help-text">Log all tool calls to console for debugging</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="window.chatBoxSettingsManager.resetToDefaults(); window.chatBoxSettingsManager.populateSettingsForm(this.closest('.modal'));">
                        <i class="fas fa-undo"></i> Reset to Defaults
                    </button>
                    <div style="display: flex; gap: 12px;">
                        <button class="btn btn-secondary" onclick="this.closest('.modal').style.display='none'; this.closest('.modal').classList.remove('show');">
                            Cancel
                        </button>
                        <button class="btn btn-primary" id="chatboxSaveSettingsBtn">
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
        
        // Add event listeners for tabs
        const tabButtons = modal.querySelectorAll('.tab-btn');
        const tabPanels = modal.querySelectorAll('.tab-content');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.dataset.tab;
                
                // Update active tab button
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                // Update active tab panel
                tabPanels.forEach(panel => {
                    panel.classList.remove('active');
                    if (panel.id === `${targetTab}-tab`) {
                        panel.classList.add('active');
                    }
                });
            });
        });
        
        
        // Setup tool priority functionality
        this.setupToolPriorityHandlers(modal);
        
        // Setup save button handler
        const saveBtn = modal.querySelector('#chatboxSaveSettingsBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                console.log('💾 ChatBox Settings save button clicked');
                this.saveSettingsFromForm(modal);
            });
        }
        
        return modal;
    }



    /**
     * Setup tool priority handlers
     */
    setupToolPriorityHandlers(modal) {
        const container = modal.querySelector('#toolPriorityContainer');
        if (!container) return;

        // Add global functions for priority buttons
        window.movePriorityUp = (button) => {
            const item = button.closest('.priority-item');
            const prevItem = item.previousElementSibling;
            if (prevItem) {
                container.insertBefore(item, prevItem);
                this.updatePriorityNumbers(container);
                this.updatePriorityStatus(container);
            }
        };

        window.movePriorityDown = (button) => {
            const item = button.closest('.priority-item');
            const nextItem = item.nextElementSibling;
            if (nextItem) {
                container.insertBefore(nextItem, item);
                this.updatePriorityNumbers(container);
                this.updatePriorityStatus(container);
            }
        };

        // Add drag and drop functionality
        const items = container.querySelectorAll('.priority-item');
        items.forEach(item => {
            item.draggable = true;
            
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', '');
                item.classList.add('dragging');
            });
            
            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                this.updatePriorityNumbers(container);
                this.updatePriorityStatus(container);
            });
            
            item.addEventListener('dragover', (e) => {
                e.preventDefault();
            });
            
            item.addEventListener('drop', (e) => {
                e.preventDefault();
                const draggingItem = container.querySelector('.dragging');
                if (draggingItem && draggingItem !== item) {
                    const rect = item.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;
                    
                    if (e.clientY < midY) {
                        container.insertBefore(draggingItem, item);
                    } else {
                        container.insertBefore(draggingItem, item.nextSibling);
                    }
                }
            });
        });
    }

    /**
     * Update priority numbers after reordering
     */
    updatePriorityNumbers(container) {
        const items = container.querySelectorAll('.priority-item');
        items.forEach((item, index) => {
            const numberSpan = item.querySelector('.priority-number');
            if (numberSpan) {
                numberSpan.textContent = index + 1;
            }
            
            // Update button states
            const upBtn = item.querySelector('.priority-btn.up');
            const downBtn = item.querySelector('.priority-btn.down');
            
            if (upBtn) upBtn.disabled = index === 0;
            if (downBtn) downBtn.disabled = index === items.length - 1;
        });
    }

    /**
     * Update priority status display
     */
    updatePriorityStatus(container) {
        const statusElement = document.querySelector('#priorityStatus');
        if (!statusElement) return;
        
        const items = container.querySelectorAll('.priority-item');
        const priorityList = Array.from(items).map((item, index) => {
            const label = item.querySelector('.priority-label').textContent;
            return `${index + 1}. ${label}`;
        });
        
        statusElement.innerHTML = `
            <small>
                <strong>Current Order:</strong> ${priorityList.join(' → ')}
            </small>
        `;
    }

    /**
     * Get current tool priority order from UI
     */
    getToolPriorityFromUI(modal) {
        const container = modal.querySelector('#toolPriorityContainer');
        if (!container) return this.settings.toolPriority;
        
        const items = container.querySelectorAll('.priority-item');
        return Array.from(items).map(item => item.dataset.type);
    }

    /**
     * Set tool priority order in UI
     */
    setToolPriorityInUI(modal, priority) {
        const container = modal.querySelector('#toolPriorityContainer');
        if (!container || !Array.isArray(priority)) return;
        
        // Reorder items based on priority array
        const items = Array.from(container.querySelectorAll('.priority-item'));
        const orderedItems = [];
        
        priority.forEach(type => {
            const item = items.find(item => item.dataset.type === type);
            if (item) orderedItems.push(item);
        });
        
        // Add any missing items at the end
        items.forEach(item => {
            if (!orderedItems.includes(item)) {
                orderedItems.push(item);
            }
        });
        
        // Clear container and re-add in correct order
        container.innerHTML = '';
        orderedItems.forEach(item => container.appendChild(item));
        
        this.updatePriorityNumbers(container);
        this.updatePriorityStatus(container);
    }

    /**
     * Populate settings form with current values
     */
    populateSettingsForm(modal) {
        for (const [key, value] of Object.entries(this.settings)) {
            if (key === 'toolPriority') {
                // Handle tool priority specially
                this.setToolPriorityInUI(modal, value);
                continue;
            }
            
            const element = modal.querySelector(`#${key}`);
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = value;
                } else if (element.type === 'number') {
                    if (key === 'responseTimeout') {
                        element.value = value / 1000;
                    } else if (key === 'memoryCleanupInterval') {
                        element.value = value / 60000; // Convert from ms to minutes
                    } else if (key === 'agentLLMTimeout') {
                        element.value = value / 1000; // Convert from ms to seconds
                    } else {
                        element.value = value;
                    }
                } else if (element.type === 'range') {
                    element.value = value;
                    // Update range value display
                    const valueDisplay = modal.querySelector(`#${key}Value`);
                    if (valueDisplay) {
                        if (key === 'completionThreshold') {
                            valueDisplay.textContent = Math.round(value * 100) + '%';
                        } else if (key === 'chatboxLLMTemperature') {
                            valueDisplay.textContent = value;
                        } else {
                            valueDisplay.textContent = value;
                        }
                    }
                } else {
                    element.value = value;
                }
            }
        }
        
        // Setup range slider event listeners
        this.setupRangeSliders(modal);
    }
    
    /**
     * Setup range slider event listeners
     */
    setupRangeSliders(modal) {
        const rangeSliders = modal.querySelectorAll('input[type="range"]');
        rangeSliders.forEach(slider => {
            const valueDisplay = modal.querySelector(`#${slider.id}Value`);
            if (valueDisplay) {
                slider.addEventListener('input', () => {
                    if (slider.id === 'completionThreshold') {
                        valueDisplay.textContent = Math.round(slider.value * 100) + '%';
                    } else if (slider.id === 'chatboxLLMTemperature') {
                        valueDisplay.textContent = slider.value;
                    } else {
                        valueDisplay.textContent = slider.value;
                    }
                });
            }
        });
    }

    /**
     * Save settings from form
     */
    saveSettingsFromForm(modal) {
        const newSettings = {};
        
        for (const key of Object.keys(this.settings)) {
            if (key === 'toolPriority') {
                // Handle tool priority specially
                newSettings[key] = this.getToolPriorityFromUI(modal);
                continue;
            }
            
            const element = modal.querySelector(`#${key}`);
            if (element) {
                if (element.type === 'checkbox') {
                    newSettings[key] = element.checked;
                } else if (element.type === 'number') {
                    const value = parseInt(element.value);
                    if (key === 'responseTimeout') {
                        newSettings[key] = value * 1000;
                    } else if (key === 'memoryCleanupInterval') {
                        newSettings[key] = value * 60000; // Convert from minutes to ms
                    } else if (key === 'agentLLMTimeout') {
                        newSettings[key] = value * 1000; // Convert from seconds to ms
                    } else {
                        newSettings[key] = value;
                    }
                } else if (element.type === 'range') {
                    newSettings[key] = parseFloat(element.value);
                } else {
                    newSettings[key] = element.value;
                }
            }
        }
        
        // Validate settings
        const tempSettings = { ...this.settings, ...newSettings };
        const settingsManager = { settings: tempSettings };
        const errors = this.validateSettings.call(settingsManager);
        
        if (errors.length > 0) {
            alert('Settings validation failed:\n' + errors.join('\n'));
            return;
        }
        
        // Update settings
        const hasChanges = this.updateSettings(newSettings);
        
        if (hasChanges) {
            // Show success message with detailed feedback
            this.showSaveSuccessMessage(newSettings);
            
            // Close modal
            modal.style.display = 'none';
            modal.classList.remove('show');
        } else {
            // Show no changes message
            this.showNotification('No changes detected. Settings are already up to date.', 'info');
            
            // Close modal
            modal.style.display = 'none';
            modal.classList.remove('show');
        }
    }
    
    /**
     * Show detailed save success message
     */
    showSaveSuccessMessage(newSettings) {
        const changedSettings = [];
        
        // Check which settings were changed
        for (const [key, value] of Object.entries(newSettings)) {
            if (this.settings[key] !== value) {
                changedSettings.push(key);
            }
        }
        
        if (changedSettings.length === 0) {
            this.showNotification('Settings saved successfully!', 'success');
            return;
        }
        
        // Create detailed message
        let message = '✅ Settings saved successfully!\n\n';
        message += 'Updated settings:\n';
        
        changedSettings.forEach(setting => {
            const value = newSettings[setting];
            const displayValue = typeof value === 'boolean' ? (value ? 'Enabled' : 'Disabled') : value;
            message += `• ${this.getSettingDisplayName(setting)}: ${displayValue}\n`;
        });
        
        // Show notification
        this.showNotification(message, 'success');
        
        // Also log to console for debugging
        console.log('💾 Settings saved:', changedSettings);
    }
    
    /**
     * Get display name for setting key
     */
    getSettingDisplayName(key) {
        const displayNames = {
            'agentSystemEnabled': 'Multi-Agent System',
            'agentAutoOptimize': 'Agent Auto-Optimization',
            'agentShowInfo': 'Agent Information Display',
            'agentMemoryEnabled': 'Agent Memory Integration',
            'agentCacheEnabled': 'Agent Execution Caching',
            'agentLLMProvider': 'Agent LLM Provider',
            'agentLLMModel': 'Agent LLM Model',
            'agentLLMTemperature': 'Agent LLM Temperature',
            'agentLLMMaxTokens': 'Agent LLM Max Tokens',
            'agentLLMTimeout': 'Agent LLM Timeout',
            'agentLLMRetryAttempts': 'Agent LLM Retry Attempts',
            'agentLLMUseSystemPrompt': 'Agent LLM System Prompt',
            'agentLLMEnableFunctionCalling': 'Agent LLM Function Calling',
            'functionCallRounds': 'Maximum Function Call Rounds',
            'enableEarlyCompletion': 'Enable Early Task Completion',
            'completionThreshold': 'Task Completion Confidence Threshold',
            'memorySystemEnabled': 'Memory System',
            'memoryCacheEnabled': 'Memory Caching',
            'memoryOptimizationEnabled': 'Memory Optimization',
            'memoryCleanupInterval': 'Memory Cleanup Interval',
            'memoryMaxEntries': 'Memory Max Entries',
            'showThinkingProcess': 'Thinking Process Display',
            'showToolCalls': 'Tool Calls Display',
            'showToolCallSource': 'Tool Call Source Display',
            'showDetailedToolData': 'Detailed Tool Data',
            'responseTimeout': 'Response Timeout',
            'autoScrollToBottom': 'Auto Scroll to Bottom',
            'showTimestamps': 'Show Timestamps',
            'maxHistoryMessages': 'Max History Messages',
            'animateThinking': 'Animate Thinking',
            'compactMode': 'Compact Mode',
            'rememberPosition': 'Remember Position',
            'rememberSize': 'Remember Size',
            'startMinimized': 'Start Minimized',
            'useOptimizedPrompt': 'Use Optimized Prompt',
            'debugMode': 'Debug Mode',
            'logToolCalls': 'Log Tool Calls',
            'chatboxModelType': 'Primary Model Type',
            'chatboxLLMTemperature': 'LLM Temperature',
            'chatboxLLMMaxTokens': 'LLM Max Tokens',
            'chatboxLLMTimeout': 'LLM Timeout',
            'chatboxLLMUseSystemPrompt': 'LLM System Prompt',
            'chatboxLLMEnableFunctionCalling': 'LLM Function Calling'
        };
        
        return displayNames[key] || key;
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        // Try to use existing notification system
        if (window.chatManager && window.chatManager.showNotification) {
            window.chatManager.showNotification(message, type);
        } else {
            // Fallback to alert
            alert(message);
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChatBoxSettingsManager;
} 