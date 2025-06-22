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
            
            // Window settings
            rememberPosition: true,
            rememberSize: true,
            startMinimized: false
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
        console.log('🔧 ChatBox settings loaded:', this.settings);
    }

    /**
     * Save settings to config manager
     */
    saveSettings() {
        this.configManager.set('chatboxSettings', this.settings);
        console.log('💾 ChatBox settings saved:', this.settings);
        
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
            rememberPosition: true,
            rememberSize: true,
            startMinimized: false
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
        
        // Populate current settings
        this.populateSettingsForm(modal);
        
        // Show modal
        modal.style.display = 'flex';
        
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
        modal.className = 'modal-overlay';
        
        modal.innerHTML = `
            <div class="modal-container chatbox-settings-modal">
                <div class="modal-header">
                    <h2><i class="fas fa-comments"></i> ChatBox Settings</h2>
                    <button class="modal-close-btn" onclick="this.closest('.modal-overlay').style.display='none'">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="modal-content">
                    <div class="settings-tabs">
                        <button class="tab-button active" data-tab="display">
                            <i class="fas fa-eye"></i> Display
                        </button>
                        <button class="tab-button" data-tab="behavior">
                            <i class="fas fa-cogs"></i> Behavior
                        </button>
                        <button class="tab-button" data-tab="advanced">
                            <i class="fas fa-tools"></i> Advanced
                        </button>
                    </div>
                    
                    <div class="settings-content">
                        <!-- Display Tab -->
                        <div class="tab-panel active" data-panel="display">
                            <div class="settings-group">
                                <h3>Thinking Process</h3>
                                <div class="setting-item">
                                    <label class="setting-label">
                                        <input type="checkbox" id="showThinkingProcess" class="setting-checkbox">
                                        <span class="setting-text">Show AI thinking process</span>
                                    </label>
                                    <p class="setting-description">Display the AI's reasoning and analysis steps</p>
                                </div>
                                
                                <div class="setting-item">
                                    <label class="setting-label">
                                        <input type="checkbox" id="hideThinkingAfterConversation" class="setting-checkbox">
                                        <span class="setting-text">Hide thinking process after conversation ends</span>
                                    </label>
                                    <p class="setting-description">Automatically remove thinking process when conversation completes</p>
                                </div>
                                
                                <div class="setting-item">
                                    <label class="setting-label">
                                        <input type="checkbox" id="showToolCalls" class="setting-checkbox">
                                        <span class="setting-text">Show tool calls</span>
                                    </label>
                                    <p class="setting-description">Display detailed information about tool execution</p>
                                </div>
                            </div>
                            
                            <div class="settings-group">
                                <h3>Interface</h3>
                                <div class="setting-item">
                                    <label class="setting-label">
                                        <input type="checkbox" id="showTimestamps" class="setting-checkbox">
                                        <span class="setting-text">Show message timestamps</span>
                                    </label>
                                    <p class="setting-description">Display when each message was sent</p>
                                </div>
                                
                                <div class="setting-item">
                                    <label class="setting-label">
                                        <span class="setting-text">Font size</span>
                                        <select id="fontSize" class="setting-select">
                                            <option value="small">Small</option>
                                            <option value="medium">Medium</option>
                                            <option value="large">Large</option>
                                        </select>
                                    </label>
                                </div>
                                
                                <div class="setting-item">
                                    <label class="setting-label">
                                        <span class="setting-text">Theme</span>
                                        <select id="theme" class="setting-select">
                                            <option value="auto">Auto</option>
                                            <option value="light">Light</option>
                                            <option value="dark">Dark</option>
                                        </select>
                                    </label>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Behavior Tab -->
                        <div class="tab-panel" data-panel="behavior">
                            <div class="settings-group">
                                <h3>Interaction</h3>
                                <div class="setting-item">
                                    <label class="setting-label">
                                        <input type="checkbox" id="autoScrollToBottom" class="setting-checkbox">
                                        <span class="setting-text">Auto-scroll to bottom</span>
                                    </label>
                                    <p class="setting-description">Automatically scroll to show new messages</p>
                                </div>
                                
                                <div class="setting-item">
                                    <label class="setting-label">
                                        <input type="checkbox" id="enableAbortButton" class="setting-checkbox">
                                        <span class="setting-text">Enable abort button</span>
                                    </label>
                                    <p class="setting-description">Show button to stop ongoing conversations</p>
                                </div>
                            </div>
                            
                            <div class="settings-group">
                                <h3>History</h3>
                                <div class="setting-item">
                                    <label class="setting-label">
                                        <span class="setting-text">Max history messages</span>
                                        <input type="number" id="maxHistoryMessages" class="setting-input" min="10" max="10000" step="10">
                                    </label>
                                    <p class="setting-description">Maximum number of messages to keep in history</p>
                                </div>
                                
                                <div class="setting-item">
                                    <label class="setting-label">
                                        <input type="checkbox" id="enableHistorySearch" class="setting-checkbox">
                                        <span class="setting-text">Enable history search</span>
                                    </label>
                                    <p class="setting-description">Allow searching through chat history</p>
                                </div>
                            </div>
                            
                            <div class="settings-group">
                                <h3>Performance</h3>
                                <div class="setting-item">
                                    <label class="setting-label">
                                        <span class="setting-text">Response timeout (seconds)</span>
                                        <input type="number" id="responseTimeout" class="setting-input" min="5" max="300" step="5">
                                    </label>
                                    <p class="setting-description">How long to wait for LLM responses</p>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Advanced Tab -->
                        <div class="tab-panel" data-panel="advanced">
                            <div class="settings-group">
                                <h3>Animation & Effects</h3>
                                <div class="setting-item">
                                    <label class="setting-label">
                                        <input type="checkbox" id="animateThinking" class="setting-checkbox">
                                        <span class="setting-text">Animate thinking process</span>
                                    </label>
                                    <p class="setting-description">Show animations for thinking process updates</p>
                                </div>
                                
                                <div class="setting-item">
                                    <label class="setting-label">
                                        <input type="checkbox" id="compactMode" class="setting-checkbox">
                                        <span class="setting-text">Compact mode</span>
                                    </label>
                                    <p class="setting-description">Use more compact message layout</p>
                                </div>
                            </div>
                            
                            <div class="settings-group">
                                <h3>Window Management</h3>
                                <div class="setting-item">
                                    <label class="setting-label">
                                        <input type="checkbox" id="rememberPosition" class="setting-checkbox">
                                        <span class="setting-text">Remember window position</span>
                                    </label>
                                    <p class="setting-description">Save and restore chat window position</p>
                                </div>
                                
                                <div class="setting-item">
                                    <label class="setting-label">
                                        <input type="checkbox" id="rememberSize" class="setting-checkbox">
                                        <span class="setting-text">Remember window size</span>
                                    </label>
                                    <p class="setting-description">Save and restore chat window size</p>
                                </div>
                            </div>
                            
                            <div class="settings-group">
                                <h3>Debug</h3>
                                <div class="setting-item">
                                    <label class="setting-label">
                                        <input type="checkbox" id="debugMode" class="setting-checkbox">
                                        <span class="setting-text">Debug mode</span>
                                    </label>
                                    <p class="setting-description">Show detailed debug information in console</p>
                                </div>
                                
                                <div class="setting-item">
                                    <label class="setting-label">
                                        <input type="checkbox" id="logToolCalls" class="setting-checkbox">
                                        <span class="setting-text">Log tool calls</span>
                                    </label>
                                    <p class="setting-description">Log all tool calls to console for debugging</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="window.chatBoxSettingsManager.resetToDefaults(); window.chatBoxSettingsManager.populateSettingsForm(this.closest('.modal-overlay'));">
                        <i class="fas fa-undo"></i> Reset to Defaults
                    </button>
                    <div class="modal-actions">
                        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').style.display='none'">
                            Cancel
                        </button>
                        <button class="btn btn-primary" onclick="window.chatBoxSettingsManager.saveSettingsFromForm(this.closest('.modal-overlay'))">
                            <i class="fas fa-save"></i> Save Settings
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Add tab switching functionality
        modal.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-button')) {
                const tabName = e.target.dataset.tab;
                this.switchTab(modal, tabName);
            }
        });
        
        return modal;
    }

    /**
     * Switch between tabs in settings modal
     */
    switchTab(modal, tabName) {
        // Remove active class from all tabs and panels
        modal.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        modal.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
        
        // Add active class to selected tab and panel
        const activeTab = modal.querySelector(`[data-tab="${tabName}"]`);
        const activePanel = modal.querySelector(`[data-panel="${tabName}"]`);
        
        if (activeTab) activeTab.classList.add('active');
        if (activePanel) activePanel.classList.add('active');
    }

    /**
     * Populate settings form with current values
     */
    populateSettingsForm(modal) {
        for (const [key, value] of Object.entries(this.settings)) {
            const element = modal.querySelector(`#${key}`);
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = value;
                } else if (element.type === 'number') {
                    element.value = key === 'responseTimeout' ? value / 1000 : value;
                } else {
                    element.value = value;
                }
            }
        }
    }

    /**
     * Save settings from form
     */
    saveSettingsFromForm(modal) {
        const newSettings = {};
        
        for (const key of Object.keys(this.settings)) {
            const element = modal.querySelector(`#${key}`);
            if (element) {
                if (element.type === 'checkbox') {
                    newSettings[key] = element.checked;
                } else if (element.type === 'number') {
                    const value = parseInt(element.value);
                    newSettings[key] = key === 'responseTimeout' ? value * 1000 : value;
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
            // Show success message
            this.showNotification('Settings saved successfully!', 'success');
            
            // Close modal
            modal.style.display = 'none';
        } else {
            // Close modal anyway
            modal.style.display = 'none';
        }
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