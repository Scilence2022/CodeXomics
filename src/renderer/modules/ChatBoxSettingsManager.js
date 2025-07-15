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
            
            // Tool priority settings
            toolPriority: ['local', 'genomics', 'plugins', 'mcp'], // 工具优先级顺序
            
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
        
        // Show modal with proper positioning
        modal.style.display = 'block';
        modal.classList.add('show');
        
        // Reset to center position if not already positioned
        if (!modal.style.left && !modal.style.top) {
            modal.style.transform = 'translate(-50%, -50%)';
            modal.style.top = '50%';
            modal.style.left = '50%';
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
        modal.className = 'modal draggable-modal';
        
        modal.innerHTML = `
            
            <div class="modal-content chatbox-settings-modal-content resizable-modal-content">
                <div class="modal-header draggable-header" id="chatboxSettingsHeader">
                    <h3><i class="fas fa-comments"></i> ChatBox Settings</h3>
                    <button class="modal-close" onclick="this.closest('.modal').style.display='none'; this.closest('.modal').classList.remove('show');">
                        &times;
                    </button>
                </div>
                
                <div class="modal-body" >
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
                                <h4>System Prompt</h4>
                                <div class="form-group">
                                    <label>
                                        <input type="checkbox" id="useOptimizedPrompt" class="setting-checkbox">
                                        Use optimized system prompt
                                    </label>
                                    <small class="help-text">Use streamlined system prompt for better performance and reduced token usage</small>
                                </div>
                            </div>
                            
                            <div class="form-section">
                                <h4>Tool Priority</h4>
                                <div class="form-group">
                                    <label>Tool selection priority order:</label>
                                    <div id="toolPriorityContainer" class="priority-container">
                                        <div class="priority-item" data-type="local">
                                            <span class="priority-number">1</span>
                                            <span class="priority-label">Local Tools</span>
                                            <div class="priority-controls">
                                                <button type="button" class="priority-btn up" onclick="movePriorityUp(this)">↑</button>
                                                <button type="button" class="priority-btn down" onclick="movePriorityDown(this)">↓</button>
                                            </div>
                                        </div>
                                        <div class="priority-item" data-type="genomics">
                                            <span class="priority-number">2</span>
                                            <span class="priority-label">Genomics Tools</span>
                                            <div class="priority-controls">
                                                <button type="button" class="priority-btn up" onclick="movePriorityUp(this)">↑</button>
                                                <button type="button" class="priority-btn down" onclick="movePriorityDown(this)">↓</button>
                                            </div>
                                        </div>
                                        <div class="priority-item" data-type="plugins">
                                            <span class="priority-number">3</span>
                                            <span class="priority-label">Plugin Tools</span>
                                            <div class="priority-controls">
                                                <button type="button" class="priority-btn up" onclick="movePriorityUp(this)">↑</button>
                                                <button type="button" class="priority-btn down" onclick="movePriorityDown(this)">↓</button>
                                            </div>
                                        </div>
                                        <div class="priority-item" data-type="mcp">
                                            <span class="priority-number">4</span>
                                            <span class="priority-label">MCP Tools</span>
                                            <div class="priority-controls">
                                                <button type="button" class="priority-btn up" onclick="movePriorityUp(this)">↑</button>
                                                <button type="button" class="priority-btn down" onclick="movePriorityDown(this)">↓</button>
                                            </div>
                                        </div>
                                    </div>
                                    <small class="help-text">Drag or use arrows to reorder tool selection priority</small>
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
        
        // Setup resizing functionality
        this.setupModalResizing(modal);
        
        // Setup tool priority functionality
        this.setupToolPriorityHandlers(modal);
        
        return modal;
    }

    /**
     * Setup dragging functionality for the settings modal
     */
    setupModalDragging(modal) {
        const header = modal.querySelector('.draggable-header');
        if (!header) return;

        let isDragging = false;
        let startX, startY, startLeft, startTop;

        header.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('modal-close')) return;
            
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            
            // Get current modal position
            const rect = modal.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            
            // Remove the default centered positioning
            modal.style.transform = 'none';
            modal.style.top = startTop + 'px';
            modal.style.left = startLeft + 'px';
            
            modal.classList.add('dragging');
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            const newLeft = startLeft + deltaX;
            const newTop = startTop + deltaY;
            
            // Keep modal within viewport bounds
            const modalRect = modal.getBoundingClientRect();
            const maxLeft = window.innerWidth - modalRect.width;
            const maxTop = window.innerHeight - modalRect.height;
            
            const clampedLeft = Math.max(0, Math.min(newLeft, maxLeft));
            const clampedTop = Math.max(0, Math.min(newTop, maxTop));
            
            modal.style.left = clampedLeft + 'px';
            modal.style.top = clampedTop + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                modal.classList.remove('dragging');
            }
        });
    }

    /**
     * Setup resizing functionality for the settings modal
     */
    setupModalResizing(modal) {
        const content = modal.querySelector('.resizable-modal-content');
        if (!content) return;

        const handles = modal.querySelectorAll('.resize-handle');
        let isResizing = false;
        let currentHandle = null;
        let startX, startY, startWidth, startHeight, startLeft, startTop;

        handles.forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                isResizing = true;
                currentHandle = handle;
                startX = e.clientX;
                startY = e.clientY;
                
                const rect = content.getBoundingClientRect();
                startWidth = rect.width;
                startHeight = rect.height;
                startLeft = rect.left;
                startTop = rect.top;
                
                e.preventDefault();
                e.stopPropagation();
            });
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing || !currentHandle) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            const handleClass = currentHandle.className;
            let newWidth = startWidth;
            let newHeight = startHeight;
            let newLeft = startLeft;
            let newTop = startTop;
            
            // Handle different resize directions
            if (handleClass.includes('e')) {
                newWidth = Math.max(400, startWidth + deltaX);
            }
            if (handleClass.includes('w')) {
                const widthChange = Math.min(deltaX, startWidth - 400);
                newWidth = startWidth - widthChange;
                newLeft = startLeft + widthChange;
            }
            if (handleClass.includes('s')) {
                newHeight = Math.max(300, startHeight + deltaY);
            }
            if (handleClass.includes('n')) {
                const heightChange = Math.min(deltaY, startHeight - 300);
                newHeight = startHeight - heightChange;
                newTop = startTop + heightChange;
            }
            
            // Apply new dimensions
            content.style.width = newWidth + 'px';
            content.style.height = newHeight + 'px';
            
            // Update modal dimensions to match content
            modal.style.width = newWidth + 'px';
            modal.style.height = newHeight + 'px';
            
            // Adjust position if resizing from left or top
            if (handleClass.includes('w') || handleClass.includes('n')) {
                modal.style.left = newLeft + 'px';
                modal.style.top = newTop + 'px';
            }
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                currentHandle = null;
            }
        });
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
            }
        };

        window.movePriorityDown = (button) => {
            const item = button.closest('.priority-item');
            const nextItem = item.nextElementSibling;
            if (nextItem) {
                container.insertBefore(nextItem, item);
                this.updatePriorityNumbers(container);
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