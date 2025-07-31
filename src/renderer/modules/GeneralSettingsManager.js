/**
 * General Settings Manager
 * Handles all general application settings and preferences
 */
class GeneralSettingsManager {
    constructor(configManager) {
        this.configManager = configManager;
        this.currentTab = 'appearance';
        this.isInitialized = false;
        
        // Default settings
        this.defaultSettings = {
            // Appearance
            themeMode: 'auto',
            accentColor: '#667eea',
            fontSize: 'medium',
            fontFamily: 'system',
            sequenceFont: 'monaco',
            compactMode: false,
            showWelcomeScreen: true,
            minLineSpacing: 12, // Minimum line spacing for sequence display
            
            // Performance
            maxSequenceLength: 5000000,
            renderingMode: 'adaptive',
            maxGenesDisplay: 1000,
            trackHeight: 'normal',
            enableAnimations: true,
            enableFileCache: true,
            cacheSize: 500,
            enableGlobalDragging: true, // Enable dynamic viewport updates for all tracks during dragging
            
            // Wheel Zoom
            enableWheelZoom: true,
            wheelZoomSensitivity: 0.1,
            wheelZoomToCursor: true,
            wheelZoomMinRange: 100,
            wheelZoomMaxRange: 1000000,
            
            // Features
            enableGCContent: true,
            enableProteinTranslation: true,
            enableOperonPrediction: true,
            enableSyntaxHighlighting: true,
            enableAutoSave: true,
            autoSaveInterval: 300,
            enableNotifications: true,
            enableKeyboardShortcuts: true,
            
            // Export/Import
            defaultExportFormat: 'fasta',
            includeMetadata: true,
            compressionLevel: 'medium',
            autoBackup: true,
            backupInterval: 24,
            maxBackups: 10
        };
    }

    /**
     * Initialize the settings manager
     */
    async init() {
        if (this.isInitialized) return;

        try {
            // Initialize UI elements and event handlers
            this.initializeUI();
            
            await this.loadSettings();
            this.applySettings();
            this.isInitialized = true;
            console.log('✅ [GeneralSettings] GeneralSettingsManager initialized');
        } catch (error) {
            console.error('❌ [GeneralSettings] Failed to initialize GeneralSettingsManager:', error);
            // Even if initialization fails, mark as initialized to prevent repeated errors
            this.isInitialized = true;
        }
    }

    /**
     * Initialize UI elements and event handlers
     */
    initializeUI() {
        // Setup event listeners
        this.setupEventListeners();
        
        console.log('✅ [GeneralSettings] UI initialized');
    }

    /**
     * Initialize tabs when modal is opened
     */
    initializeTabs() {
        console.log('🔄 [GeneralSettings] Initializing tabs');
        
        // Use a more robust approach with multiple attempts
        const initializeTabsWithRetry = (attempts = 0, maxAttempts = 5) => {
            // Ensure the first tab is active by default
            const firstTab = document.querySelector('#generalSettingsModal .settings-tabs .tab-btn[data-tab="appearance"]');
            const firstContent = document.getElementById('appearance-tab');
            
            console.log(`🔍 [GeneralSettings] Attempt ${attempts + 1}: Found first tab:`, !!firstTab);
            console.log('🔍 [GeneralSettings] Found first content:', !!firstContent);
            
            if (firstTab && firstContent) {
                // Remove active from all tabs first
                const allTabButtons = document.querySelectorAll('#generalSettingsModal .settings-tabs .tab-btn');
                const allTabContents = document.querySelectorAll('#generalSettingsModal .tab-content');
                
                console.log(`🔍 [GeneralSettings] Found ${allTabButtons.length} tab buttons`);
                console.log(`🔍 [GeneralSettings] Found ${allTabContents.length} tab contents`);
                
                allTabButtons.forEach(btn => {
                    btn.classList.remove('active');
                    console.log(`🔄 [GeneralSettings] Removed active from button: ${btn.dataset.tab}`);
                });
                
                allTabContents.forEach(content => {
                    content.classList.remove('active');
                    console.log(`🔄 [GeneralSettings] Removed active from content: ${content.id}`);
                });
                
                // Set first tab as active
                firstTab.classList.add('active');
                firstContent.classList.add('active');
                this.currentTab = 'appearance';
                
                console.log('✅ [GeneralSettings] Default tab (appearance) activated');
                console.log('🔍 [GeneralSettings] First tab classes:', firstTab.className);
                console.log('🔍 [GeneralSettings] First content classes:', firstContent.className);
                
                // Setup tab event listeners after ensuring elements exist
                this.setupTabHandlers();
                
                return true;
            } else {
                console.warn(`❌ [GeneralSettings] Attempt ${attempts + 1}: Could not find default tab elements`);
                
                if (attempts < maxAttempts) {
                    console.log(`🔄 [GeneralSettings] Retrying in ${(attempts + 1) * 100}ms...`);
                    setTimeout(() => {
                        initializeTabsWithRetry(attempts + 1, maxAttempts);
                    }, (attempts + 1) * 100);
                } else {
                    console.error('❌ [GeneralSettings] Failed to initialize tabs after all attempts');
                    
                    // Debug: List all available elements
                    const allTabs = document.querySelectorAll('#generalSettingsModal .tab-btn');
                    const allContents = document.querySelectorAll('#generalSettingsModal .tab-content');
                    console.log('🔍 [GeneralSettings] All tab buttons found:', 
                        Array.from(allTabs).map(t => t.dataset.tab));
                    console.log('🔍 [GeneralSettings] All tab contents found:', 
                        Array.from(allContents).map(c => c.id));
                }
                return false;
            }
        };
        
        // Start the initialization process
        initializeTabsWithRetry();
    }

    /**
     * Setup event listeners for the modal and form elements
     */
    setupEventListeners() {
        // Setup modal and tab handlers
        this.setupModalHandlers();
        // Note: setupTabHandlers is now called from initializeTabs after elements are confirmed to exist

        // Theme mode change
        const themeSelect = document.getElementById('themeMode');
        if (themeSelect) {
            themeSelect.addEventListener('change', (e) => {
                this.updateSetting('themeMode', e.target.value);
                this.applyTheme(e.target.value);
            });
        }

        // Accent color change
        const accentColorInput = document.getElementById('accentColor');
        if (accentColorInput) {
            accentColorInput.addEventListener('change', (e) => {
                this.updateSetting('accentColor', e.target.value);
                this.applyAccentColor(e.target.value);
            });
        }

        // Reset accent color
        const resetAccentBtn = document.getElementById('resetAccentColor');
        if (resetAccentBtn) {
            resetAccentBtn.addEventListener('click', () => {
                const defaultColor = this.defaultSettings.accentColor;
                document.getElementById('accentColor').value = defaultColor;
                this.updateSetting('accentColor', defaultColor);
                this.applyAccentColor(defaultColor);
            });
        }

        // Font settings
        const fontSizeSelect = document.getElementById('fontSize');
        if (fontSizeSelect) {
            fontSizeSelect.addEventListener('change', (e) => {
                this.updateSetting('fontSize', e.target.value);
                this.applyFontSize(e.target.value);
            });
        }

        const fontFamilySelect = document.getElementById('fontFamily');
        if (fontFamilySelect) {
            fontFamilySelect.addEventListener('change', (e) => {
                this.updateSetting('fontFamily', e.target.value);
                this.applyFontFamily(e.target.value);
            });
        }

        const sequenceFontSelect = document.getElementById('sequenceFont');
        if (sequenceFontSelect) {
            sequenceFontSelect.addEventListener('change', (e) => {
                this.updateSetting('sequenceFont', e.target.value);
                this.applySequenceFont(e.target.value);
            });
        }

        // Layout settings
        const compactModeCheckbox = document.getElementById('compactMode');
        if (compactModeCheckbox) {
            compactModeCheckbox.addEventListener('change', (e) => {
                this.updateSetting('compactMode', e.target.checked);
                this.applyCompactMode(e.target.checked);
            });
        }

        const showWelcomeCheckbox = document.getElementById('showWelcomeScreen');
        if (showWelcomeCheckbox) {
            showWelcomeCheckbox.addEventListener('change', (e) => {
                this.updateSetting('showWelcomeScreen', e.target.checked);
            });
        }

        // Minimum line spacing setting
        const minLineSpacingInput = document.getElementById('minLineSpacing');
        if (minLineSpacingInput) {
            minLineSpacingInput.addEventListener('change', (e) => {
                const value = parseInt(e.target.value);
                if (value >= 2 && value <= 20) {
                    this.updateSetting('minLineSpacing', value);
                    this.applyMinLineSpacing(value);
                } else {
                    // Reset to valid range
                    e.target.value = Math.max(2, Math.min(20, value));
                    this.showNotification('Minimum line spacing must be between 2px and 20px', 'warning');
                }
            });
        }

        // Performance settings
        const maxSequenceLengthSelect = document.getElementById('maxSequenceLength');
        if (maxSequenceLengthSelect) {
            maxSequenceLengthSelect.addEventListener('change', (e) => {
                this.updateSetting('maxSequenceLength', 
                    e.target.value === 'unlimited' ? -1 : parseInt(e.target.value));
            });
        }

        const renderingModeSelect = document.getElementById('renderingMode');
        if (renderingModeSelect) {
            renderingModeSelect.addEventListener('change', (e) => {
                this.updateSetting('renderingMode', e.target.value);
            });
        }

        const maxGenesInput = document.getElementById('maxGenesDisplay');
        if (maxGenesInput) {
            maxGenesInput.addEventListener('change', (e) => {
                this.updateSetting('maxGenesDisplay', parseInt(e.target.value));
            });
        }

        const trackHeightSelect = document.getElementById('trackHeight');
        if (trackHeightSelect) {
            trackHeightSelect.addEventListener('change', (e) => {
                this.updateSetting('trackHeight', e.target.value);
                this.applyTrackHeight(e.target.value);
            });
        }

        // Wheel zoom settings
        const wheelZoomSensitivityInput = document.getElementById('wheelZoomSensitivity');
        if (wheelZoomSensitivityInput) {
            wheelZoomSensitivityInput.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                this.updateSetting('wheelZoomSensitivity', value);
                this.applyFeatureSetting('wheelZoomSensitivity', value);
                
                // Update display value
                const displayElement = document.getElementById('wheelZoomSensitivityValue');
                if (displayElement) {
                    displayElement.textContent = value;
                }
            });
        }
        
        const wheelZoomMinRangeInput = document.getElementById('wheelZoomMinRange');
        if (wheelZoomMinRangeInput) {
            wheelZoomMinRangeInput.addEventListener('change', (e) => {
                const value = parseInt(e.target.value);
                this.updateSetting('wheelZoomMinRange', value);
                this.applyFeatureSetting('wheelZoomMinRange', value);
            });
        }
        
        const wheelZoomMaxRangeInput = document.getElementById('wheelZoomMaxRange');
        if (wheelZoomMaxRangeInput) {
            wheelZoomMaxRangeInput.addEventListener('change', (e) => {
                const value = parseInt(e.target.value);
                this.updateSetting('wheelZoomMaxRange', value);
                this.applyFeatureSetting('wheelZoomMaxRange', value);
            });
        }

        // Feature toggles
        const featureCheckboxes = [
            'enableGCContent', 'enableProteinTranslation', 'enableOperonPrediction',
            'enableSyntaxHighlighting', 'enableAutoSave', 'enableNotifications',
            'enableKeyboardShortcuts', 'enableAnimations', 'enableFileCache',
            'enableGlobalDragging', 'enableWheelZoom', 'wheelZoomToCursor',
            'enableLLMIntegration', 'enableContextualSuggestions', 'enableFuzzySearch', 'enableAutoComplete'
        ];

        featureCheckboxes.forEach(id => {
            const checkbox = document.getElementById(id);
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    this.updateSetting(id, e.target.checked);
                    this.applyFeatureSetting(id, e.target.checked);
                });
            }
        });

        // Clear cache button
        const clearCacheBtn = document.getElementById('clearCacheBtn');
        if (clearCacheBtn) {
            clearCacheBtn.addEventListener('click', () => {
                this.clearCache();
            });
        }

        // Export settings
        const exportSettingsBtn = document.getElementById('exportSettingsBtn');
        if (exportSettingsBtn) {
            exportSettingsBtn.addEventListener('click', () => {
                this.exportSettings();
            });
        }

        // Import settings
        const importSettingsBtn = document.getElementById('importSettingsBtn');
        if (importSettingsBtn) {
            importSettingsBtn.addEventListener('click', () => {
                this.importSettings();
            });
        }

        // Reset all settings
        const resetAllBtn = document.getElementById('resetAllSettingsBtn');
        if (resetAllBtn) {
            resetAllBtn.addEventListener('click', () => {
                this.resetAllSettings();
            });
        }

        // Save settings button - use event delegation since button might not exist during init
        document.addEventListener('click', (e) => {
            if (e.target && e.target.id === 'saveGeneralSettings') {
                e.preventDefault();
                console.log('🔄 [GeneralSettings] Save Settings button clicked');
                this.saveAllSettings();
            }
        });

        // Modal close handlers and other form elements are handled in setupModalHandlers
    }

    /**
     * Setup modal event handlers
     */
    setupModalHandlers() {
        const modal = document.getElementById('generalSettingsModal');
        if (!modal) {
            console.warn('❌ [GeneralSettings] General Settings Modal not found during initialization');
            return;
        }

        // Modal close handlers
        modal.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                modal.classList.remove('show');
            });
        });

        // Click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });
    }

    /**
     * Setup tab switching handlers
     */
    setupTabHandlers() {
        console.log('🔄 [GeneralSettings] Setting up tab handlers');
        
        const tabButtons = document.querySelectorAll('.settings-tabs .tab-btn');
        console.log(`🔍 [GeneralSettings] Found ${tabButtons.length} tab buttons to bind events to`);
        
        if (tabButtons.length === 0) {
            console.error('❌ [GeneralSettings] No tab buttons found for event binding');
            return;
        }
        
        tabButtons.forEach((btn, index) => {
            // Remove any existing event listeners to prevent duplicates
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const tabName = newBtn.dataset.tab;
                console.log(`🔄 [GeneralSettings] Tab button clicked: ${tabName}`);
                
                if (tabName) {
                    this.switchTab(tabName);
                } else {
                    console.error('❌ [GeneralSettings] Tab button has no data-tab attribute');
                }
            });
            
            console.log(`✅ [GeneralSettings] Event listener bound to tab button ${index + 1}: ${newBtn.dataset.tab}`);
        });
        
        console.log('✅ [GeneralSettings] Tab handlers setup completed');
    }

    /**
     * Switch between settings tabs
     */
    switchTab(tabName) {
        try {
            console.log(`🔄 [GeneralSettings] Switching to tab: ${tabName}`);
            
            if (!tabName) {
                console.error('❌ [GeneralSettings] No tab name provided for switching');
                return;
            }
            
            // Update tab buttons
            const tabButtons = document.querySelectorAll('.settings-tabs .tab-btn');
            console.log(`🔍 [GeneralSettings] Found ${tabButtons.length} tab buttons to update`);
            
            tabButtons.forEach(btn => {
                const isActive = btn.dataset.tab === tabName;
                btn.classList.toggle('active', isActive);
                console.log(`🔄 [GeneralSettings] Tab button ${btn.dataset.tab}: ${isActive ? 'activated' : 'deactivated'}`);
            });
            
            // Update tab content
            const tabContents = document.querySelectorAll('.settings-tabs .tab-content');
            console.log(`🔍 [GeneralSettings] Found ${tabContents.length} tab contents to update`);
            
            const targetContentId = `${tabName}-tab`;
            tabContents.forEach(content => {
                const isActive = content.id === targetContentId;
                content.classList.toggle('active', isActive);
                console.log(`🔄 [GeneralSettings] Tab content ${content.id}: ${isActive ? 'activated' : 'deactivated'}`);
            });

            this.currentTab = tabName;
            console.log(`✅ [GeneralSettings] Successfully switched to tab: ${tabName}`);
            
            // Verify the switch worked
            const activeButton = document.querySelector('.settings-tabs .tab-btn.active');
            const activeContent = document.querySelector('.settings-tabs .tab-content.active');
            
            console.log(`🔍 [GeneralSettings] Verification - Active button: ${activeButton?.dataset.tab}`);
            console.log(`🔍 [GeneralSettings] Verification - Active content: ${activeContent?.id}`);
            
        } catch (error) {
            console.error(`❌ [GeneralSettings] Error switching tabs:`, error);
            console.error(`❌ [GeneralSettings] Error stack:`, error.stack);
        }
    }

    /**
     * Load settings from configuration
     */
    async loadSettings() {
        if (!this.configManager) return;

        try {
            const settings = this.configManager.get('generalSettings', {});
            
            // Merge with defaults
            this.settings = { ...this.defaultSettings, ...settings };
            
            // Update UI elements
            this.updateUIFromSettings();
            
        } catch (error) {
            console.error('Failed to load general settings:', error);
            this.settings = { ...this.defaultSettings };
        }
    }

    /**
     * Update UI elements based on current settings
     */
    updateUIFromSettings() {
        // Theme mode
        const themeSelect = document.getElementById('themeMode');
        if (themeSelect) themeSelect.value = this.settings.themeMode;

        // Accent color
        const accentColorInput = document.getElementById('accentColor');
        if (accentColorInput) accentColorInput.value = this.settings.accentColor;

        // Font settings
        const fontSizeSelect = document.getElementById('fontSize');
        if (fontSizeSelect) fontSizeSelect.value = this.settings.fontSize;

        const fontFamilySelect = document.getElementById('fontFamily');
        if (fontFamilySelect) fontFamilySelect.value = this.settings.fontFamily;

        const sequenceFontSelect = document.getElementById('sequenceFont');
        if (sequenceFontSelect) sequenceFontSelect.value = this.settings.sequenceFont;

        // Layout settings
        const compactModeCheckbox = document.getElementById('compactMode');
        if (compactModeCheckbox) compactModeCheckbox.checked = this.settings.compactMode;

        const showWelcomeCheckbox = document.getElementById('showWelcomeScreen');
        if (showWelcomeCheckbox) showWelcomeCheckbox.checked = this.settings.showWelcomeScreen;

        // Minimum line spacing
        const minLineSpacingInput = document.getElementById('minLineSpacing');
        if (minLineSpacingInput) minLineSpacingInput.value = this.settings.minLineSpacing;

        // Performance settings
        const maxSequenceLengthSelect = document.getElementById('maxSequenceLength');
        if (maxSequenceLengthSelect) {
            const value = this.settings.maxSequenceLength === -1 ? 'unlimited' : this.settings.maxSequenceLength.toString();
            maxSequenceLengthSelect.value = value;
        }

        const renderingModeSelect = document.getElementById('renderingMode');
        if (renderingModeSelect) renderingModeSelect.value = this.settings.renderingMode;

        const maxGenesInput = document.getElementById('maxGenesDisplay');
        if (maxGenesInput) maxGenesInput.value = this.settings.maxGenesDisplay;

        const trackHeightSelect = document.getElementById('trackHeight');
        if (trackHeightSelect) trackHeightSelect.value = this.settings.trackHeight;

        const cacheSizeInput = document.getElementById('cacheSize');
        if (cacheSizeInput) cacheSizeInput.value = this.settings.cacheSize;

        // Wheel zoom settings
        const wheelZoomSensitivityInput = document.getElementById('wheelZoomSensitivity');
        if (wheelZoomSensitivityInput) {
            wheelZoomSensitivityInput.value = this.settings.wheelZoomSensitivity;
            // Update display value
            const displayElement = document.getElementById('wheelZoomSensitivityValue');
            if (displayElement) {
                displayElement.textContent = this.settings.wheelZoomSensitivity;
            }
        }
        
        const wheelZoomMinRangeInput = document.getElementById('wheelZoomMinRange');
        if (wheelZoomMinRangeInput) wheelZoomMinRangeInput.value = this.settings.wheelZoomMinRange;
        
        const wheelZoomMaxRangeInput = document.getElementById('wheelZoomMaxRange');
        if (wheelZoomMaxRangeInput) wheelZoomMaxRangeInput.value = this.settings.wheelZoomMaxRange;

        // Feature toggles
        const featureCheckboxes = [
            'enableGCContent', 'enableProteinTranslation', 'enableOperonPrediction',
            'enableSyntaxHighlighting', 'enableAutoSave', 'enableNotifications',
            'enableKeyboardShortcuts', 'enableAnimations', 'enableFileCache',
            'enableGlobalDragging', 'enableWheelZoom', 'wheelZoomToCursor',
            'enableLLMIntegration', 'enableContextualSuggestions', 'enableFuzzySearch', 'enableAutoComplete'
        ];

        featureCheckboxes.forEach(id => {
            const checkbox = document.getElementById(id);
            if (checkbox) checkbox.checked = this.settings[id];
        });

        // Update system info
        this.updateSystemInfo();
    }

    /**
     * Update a specific setting
     */
    async updateSetting(key, value) {
        this.settings[key] = value;
        
        if (this.configManager) {
            try {
                await this.configManager.set(`generalSettings.${key}`, value);
                await this.configManager.saveConfig();
            } catch (error) {
                console.error(`Failed to save setting ${key}:`, error);
            }
        }
    }

    /**
     * Save all settings and close modal
     */
    async saveAllSettings() {
        try {
            // Apply all current settings
            this.applySettings();
            
            // Save to config manager
            if (this.configManager) {
                await this.configManager.set('generalSettings', this.settings);
                await this.configManager.saveConfig();
            }
            
            // Close modal
            const modal = document.getElementById('generalSettingsModal');
            if (modal) {
                modal.classList.remove('show');
            }
            
            // Show success notification
            this.showNotification('Settings saved successfully!', 'success');
            
            console.log('✅ [GeneralSettings] All settings saved successfully');
        } catch (error) {
            console.error('❌ [GeneralSettings] Failed to save settings:', error);
            this.showNotification('Failed to save settings. Please try again.', 'error');
        }
    }

    /**
     * Apply all settings to the application
     */
    applySettings() {
        this.applyTheme(this.settings.themeMode);
        this.applyAccentColor(this.settings.accentColor);
        this.applyFontSize(this.settings.fontSize);
        this.applyFontFamily(this.settings.fontFamily);
        this.applySequenceFont(this.settings.sequenceFont);
        this.applyCompactMode(this.settings.compactMode);
        this.applyTrackHeight(this.settings.trackHeight);
        this.applyAnimations(this.settings.enableAnimations);
        this.applyMinLineSpacing(this.settings.minLineSpacing);
        
        // Apply feature settings
        this.applyFeatureSetting('enableGlobalDragging', this.settings.enableGlobalDragging);
    }

    /**
     * Apply theme setting
     */
    applyTheme(theme) {
        const body = document.body;
        body.classList.remove('theme-light', 'theme-dark');
        
        if (theme === 'light') {
            body.classList.add('theme-light');
        } else if (theme === 'dark') {
            body.classList.add('theme-dark');
        }
        // 'auto' uses system preference via CSS media queries
    }

    /**
     * Apply accent color
     */
    applyAccentColor(color) {
        document.documentElement.style.setProperty('--primary-color', color);
        document.documentElement.style.setProperty('--primary-hover', this.adjustBrightness(color, -10));
    }

    /**
     * Apply font size setting
     */
    applyFontSize(size) {
        const body = document.body;
        body.classList.remove('font-small', 'font-medium', 'font-large', 'font-extra-large');
        body.classList.add(`font-${size}`);
    }

    /**
     * Apply font family setting
     */
    applyFontFamily(family) {
        let fontStack;
        switch (family) {
            case 'inter':
                fontStack = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
                break;
            case 'roboto':
                fontStack = "'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
                break;
            case 'open-sans':
                fontStack = "'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
                break;
            default:
                fontStack = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        }
        document.documentElement.style.setProperty('--font-family', fontStack);
    }

    /**
     * Apply sequence font setting
     */
    applySequenceFont(font) {
        let fontStack;
        switch (font) {
            case 'monaco':
                fontStack = "'Monaco', 'Menlo', 'Ubuntu Mono', monospace";
                break;
            case 'menlo':
                fontStack = "'Menlo', 'Monaco', 'Ubuntu Mono', monospace";
                break;
            case 'consolas':
                fontStack = "'Consolas', 'Monaco', 'Menlo', monospace";
                break;
            default:
                fontStack = "'Courier New', 'Monaco', 'Menlo', monospace";
        }
        document.documentElement.style.setProperty('--sequence-font-family', fontStack);
    }

    /**
     * Apply compact mode
     */
    applyCompactMode(enabled) {
        const body = document.body;
        if (enabled) {
            body.classList.add('compact-mode');
        } else {
            body.classList.remove('compact-mode');
        }
    }

    /**
     * Apply minimum line spacing setting
     */
    applyMinLineSpacing(minSpacing) {
        // Apply minimum line spacing to SequenceUtils if available
        if (window.genomeBrowser && window.genomeBrowser.sequenceUtils) {
            const sequenceUtils = window.genomeBrowser.sequenceUtils;
            if (sequenceUtils.setMinimumLineSpacing) {
                sequenceUtils.setMinimumLineSpacing(minSpacing);
                console.log(`🔧 [GeneralSettings] Applied minimum line spacing: ${minSpacing}px`);
            }
        }
        
        // Also set CSS custom property for immediate effect
        document.documentElement.style.setProperty('--min-sequence-line-spacing', `${minSpacing}px`);
        
        // Update all existing sequence lines
        const sequenceLines = document.querySelectorAll('.sequence-line');
        sequenceLines.forEach(line => {
            const currentMargin = getComputedStyle(line).marginBottom;
            const currentValue = parseInt(currentMargin);
            if (currentValue < minSpacing) {
                line.style.marginBottom = `${minSpacing}px`;
            }
        });
    }

    /**
     * Apply track height setting
     */
    applyTrackHeight(height) {
        let heightValue;
        switch (height) {
            case 'compact':
                heightValue = '60px';
                break;
            case 'expanded':
                heightValue = '120px';
                break;
            default:
                heightValue = '80px';
        }
        document.documentElement.style.setProperty('--default-track-height', heightValue);
    }

    /**
     * Apply animations setting
     */
    applyAnimations(enabled) {
        const body = document.body;
        if (enabled) {
            body.classList.remove('no-animations');
        } else {
            body.classList.add('no-animations');
        }
    }

    /**
     * Apply feature setting
     */
    applyFeatureSetting(feature, enabled) {
        // Handle specific feature settings
        switch (feature) {
            case 'enableGlobalDragging':
                // Notify the genome browser about the global dragging setting change
                if (window.genomeBrowser) {
                    window.genomeBrowser.setGlobalDragging(enabled);
                    
                    // Also update individual track settings to inherit the global setting
                    if (window.genomeBrowser.trackRenderer) {
                        if (window.genomeBrowser.trackRenderer.trackSettings) {
                            // Update existing track settings
                            if (window.genomeBrowser.trackRenderer.trackSettings.genes) {
                                window.genomeBrowser.trackRenderer.trackSettings.genes.enableGlobalDragging = enabled;
                            }
                        }
                        console.log(`🎯 Updated individual track settings to inherit global dragging: ${enabled}`);
                    }
                }
                break;
            case 'enableWheelZoom':
                // Configure wheel zoom enabled/disabled
                if (window.genomeBrowser && window.genomeBrowser.navigationManager) {
                    window.genomeBrowser.navigationManager.setWheelZoomEnabled(enabled);
                }
                break;
            case 'wheelZoomToCursor':
            case 'wheelZoomSensitivity':
            case 'wheelZoomMinRange':
            case 'wheelZoomMaxRange':
                // Update wheel zoom configuration
                if (window.genomeBrowser && window.genomeBrowser.navigationManager) {
                    const config = {};
                    if (feature === 'wheelZoomToCursor') config.zoomToCursor = enabled;
                    if (feature === 'wheelZoomSensitivity') config.sensitivity = enabled;
                    if (feature === 'wheelZoomMinRange') config.minRange = enabled;
                    if (feature === 'wheelZoomMaxRange') config.maxRange = enabled;
                    window.genomeBrowser.navigationManager.configureWheelZoom(config);
                }
                break;
        }
        
        // Emit event for other components to listen to
        window.dispatchEvent(new CustomEvent('settingChanged', {
            detail: { feature, enabled }
        }));
    }

    /**
     * Clear application cache
     */
    async clearCache() {
        try {
            // Clear localStorage
            const keysToKeep = ['generalSettings', 'llmConfig'];
            const allKeys = Object.keys(localStorage);
            allKeys.forEach(key => {
                if (!keysToKeep.some(keepKey => key.includes(keepKey))) {
                    localStorage.removeItem(key);
                }
            });

            // Clear any cached data in ConfigManager
            if (this.configManager && typeof this.configManager.clearCache === 'function') {
                await this.configManager.clearCache();
            }

            this.showNotification('Cache cleared successfully', 'success');
        } catch (error) {
            console.error('Failed to clear cache:', error);
            this.showNotification('Failed to clear cache', 'error');
        }
    }

    /**
     * Export settings to file
     */
    async exportSettings() {
        try {
            const settingsData = {
                version: '1.0',
                timestamp: new Date().toISOString(),
                settings: this.settings
            };

            const blob = new Blob([JSON.stringify(settingsData, null, 2)], {
                type: 'application/json'
            });

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `genome-explorer-settings-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.showNotification('Settings exported successfully', 'success');
        } catch (error) {
            console.error('Failed to export settings:', error);
            this.showNotification('Failed to export settings', 'error');
        }
    }

    /**
     * Import settings from file
     */
    async importSettings() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                const data = JSON.parse(text);
                
                if (data.settings) {
                    // Validate and merge settings
                    const validatedSettings = this.validateSettings(data.settings);
                    this.settings = { ...this.defaultSettings, ...validatedSettings };
                    
                    // Save to config
                    if (this.configManager) {
                        await this.configManager.set('generalSettings', this.settings);
                        await this.configManager.saveConfig();
                    }
                    
                    // Update UI and apply settings
                    this.updateUIFromSettings();
                    this.applySettings();
                    
                    this.showNotification('Settings imported successfully', 'success');
                } else {
                    throw new Error('Invalid settings file format');
                }
            } catch (error) {
                console.error('Failed to import settings:', error);
                this.showNotification('Failed to import settings: ' + error.message, 'error');
            }
        };
        
        input.click();
    }

    /**
     * Reset all settings to defaults
     */
    async resetAllSettings() {
        if (!confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
            return;
        }

        try {
            this.settings = { ...this.defaultSettings };
            
            if (this.configManager) {
                await this.configManager.set('generalSettings', this.settings);
                await this.configManager.saveConfig();
            }
            
            this.updateUIFromSettings();
            this.applySettings();
            
            this.showNotification('All settings reset to defaults', 'success');
        } catch (error) {
            console.error('Failed to reset settings:', error);
            this.showNotification('Failed to reset settings', 'error');
        }
    }

    /**
     * Validate imported settings
     */
    validateSettings(settings) {
        const validated = {};
        
        for (const [key, defaultValue] of Object.entries(this.defaultSettings)) {
            if (key in settings) {
                const value = settings[key];
                const defaultType = typeof defaultValue;
                
                if (typeof value === defaultType) {
                    validated[key] = value;
                } else {
                    console.warn(`Invalid type for setting ${key}, using default`);
                    validated[key] = defaultValue;
                }
            } else {
                validated[key] = defaultValue;
            }
        }
        
        return validated;
    }

    /**
     * Update system information display
     */
    updateSystemInfo() {
        const userAgent = navigator.userAgent;
        const platform = navigator.platform;
        const memory = navigator.deviceMemory ? `${navigator.deviceMemory} GB` : 'Unknown';
        const cores = navigator.hardwareConcurrency || 'Unknown';
        const language = navigator.language;
        
        const systemInfo = document.querySelector('.system-info');
        if (systemInfo) {
            systemInfo.innerHTML = `
                <div class="info-row">
                    <span class="info-label">Platform:</span>
                    <span class="info-value">${platform}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Browser:</span>
                    <span class="info-value">${this.getBrowserName()}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Memory:</span>
                    <span class="info-value">${memory}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">CPU Cores:</span>
                    <span class="info-value">${cores}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Language:</span>
                    <span class="info-value">${language}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">App Version:</span>
                    <span class="info-value">1.0.0</span>
                </div>
            `;
        }
    }

    /**
     * Get browser name from user agent
     */
    getBrowserName() {
        const userAgent = navigator.userAgent;
        
        if (userAgent.includes('Chrome')) return 'Chrome';
        if (userAgent.includes('Firefox')) return 'Firefox';
        if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
        if (userAgent.includes('Edge')) return 'Edge';
        if (userAgent.includes('Opera')) return 'Opera';
        
        return 'Unknown';
    }

    /**
     * Adjust color brightness
     */
    adjustBrightness(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x0000FF) + amt;
        
        return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255))
            .toString(16).slice(1);
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Style the notification
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 20px',
            backgroundColor: type === 'success' ? '#d4edda' : type === 'error' ? '#f8d7da' : '#d1ecf1',
            color: type === 'success' ? '#155724' : type === 'error' ? '#721c24' : '#0c5460',
            border: `1px solid ${type === 'success' ? '#c3e6cb' : type === 'error' ? '#f5c6cb' : '#bee5eb'}`,
            borderRadius: '4px',
            zIndex: '9999',
            maxWidth: '300px',
            wordWrap: 'break-word',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        });
        
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    /**
     * Get current settings
     */
    getSettings() {
        return { ...this.settings };
    }

    /**
     * Get a specific setting
     */
    getSetting(key, defaultValue = null) {
        return this.settings[key] !== undefined ? this.settings[key] : defaultValue;
    }

    /**
     * Debug method to test tab switching manually
     */
    testTabSwitching() {
        console.log('🧪 [GeneralSettings] Testing tab switching...');
        
        const tabs = ['appearance', 'performance', 'features', 'export', 'about'];
        let currentIndex = 0;
        
        const testNext = () => {
            if (currentIndex < tabs.length) {
                const tabName = tabs[currentIndex];
                console.log(`🧪 [GeneralSettings] Testing tab: ${tabName}`);
                this.switchTab(tabName);
                currentIndex++;
                setTimeout(testNext, 1000);
            } else {
                console.log('🧪 [GeneralSettings] Tab switching test completed');
            }
        };
        
        testNext();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GeneralSettingsManager;
}

 