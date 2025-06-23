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
        modal.className = 'modal';
        
        modal.innerHTML = `
            <div class="modal-content llm-config-modal draggable-modal">
                <div class="modal-header draggable-header" id="chatboxSettingsHeader">
                    <h3><i class="fas fa-comments"></i> ChatBox Settings</h3>
                    <button class="modal-close" onclick="this.closest('.modal').style.display='none'">
                        &times;
                    </button>
                </div>
                
                <div class="modal-body">
                    <div class="llm-provider-tabs">
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
                    
                    <div class="llm-provider-config">
                        <!-- Display Tab -->
                        <div class="provider-config active" data-panel="display">
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
                        <div class="provider-config" data-panel="behavior">
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
                        </div>
                        
                        <!-- Advanced Tab -->
                        <div class="provider-config" data-panel="advanced">
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
                        <button class="btn btn-secondary" onclick="this.closest('.modal').style.display='none'">
                            Cancel
                        </button>
                        <button class="btn btn-primary" onclick="window.chatBoxSettingsManager.saveSettingsFromForm(this.closest('.modal'))">
                            <i class="fas fa-save"></i> Save Settings
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Add event listeners for tabs
        const tabButtons = modal.querySelectorAll('.tab-button');
        const tabPanels = modal.querySelectorAll('.provider-config');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.dataset.tab;
                
                // Update active tab button
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                // Update active tab panel
                tabPanels.forEach(panel => {
                    panel.classList.remove('active');
                    if (panel.dataset.panel === targetTab) {
                        panel.classList.add('active');
                    }
                });
            });
        });
        
        // Setup dragging functionality
        this.setupModalDragging(modal);
        
        return modal;
    }

    /**
     * Setup dragging functionality for the settings modal
     */
    setupModalDragging(modal) {
        const modalContent = modal.querySelector('.modal-content');
        const header = modal.querySelector('.draggable-header');
        let isDragging = false;
        let currentX = 0;
        let currentY = 0;
        let initialX = 0;
        let initialY = 0;
        let xOffset = 0;
        let yOffset = 0;

        // Make header cursor indicate draggable
        if (header) {
            header.style.cursor = 'move';
        }

        // Mouse events
        header.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', dragMove);
        document.addEventListener('mouseup', dragEnd);

        // Touch events for mobile support
        header.addEventListener('touchstart', dragStart);
        document.addEventListener('touchmove', dragMove);
        document.addEventListener('touchend', dragEnd);

        function dragStart(e) {
            // Don't drag if clicking on buttons
            if (e.target.closest('button')) return;

            if (e.type === 'touchstart') {
                initialX = e.touches[0].clientX - xOffset;
                initialY = e.touches[0].clientY - yOffset;
            } else {
                initialX = e.clientX - xOffset;
                initialY = e.clientY - yOffset;
            }

            if (e.target === header || header.contains(e.target)) {
                isDragging = true;
                modalContent.classList.add('dragging');
                document.body.style.userSelect = 'none';
            }
        }

        function dragMove(e) {
            if (isDragging) {
                e.preventDefault();

                if (e.type === 'touchmove') {
                    currentX = e.touches[0].clientX - initialX;
                    currentY = e.touches[0].clientY - initialY;
                } else {
                    currentX = e.clientX - initialX;
                    currentY = e.clientY - initialY;
                }

                xOffset = currentX;
                yOffset = currentY;

                // Constrain to viewport
                const rect = modalContent.getBoundingClientRect();
                const maxX = window.innerWidth - rect.width;
                const maxY = window.innerHeight - rect.height;

                xOffset = Math.max(-rect.width + 100, Math.min(xOffset, maxX - 100));
                yOffset = Math.max(0, Math.min(yOffset, maxY));

                modalContent.style.transform = `translate(${xOffset}px, ${yOffset}px)`;
            }
        }

        function dragEnd() {
            if (isDragging) {
                isDragging = false;
                modalContent.classList.remove('dragging');
                document.body.style.userSelect = '';
            }
        }
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