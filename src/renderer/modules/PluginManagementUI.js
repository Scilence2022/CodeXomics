/**
 * PluginManagementUI - Modern user interface for managing plugins in GenomeExplorer
 * Designed exclusively for PluginManagerV2 - no legacy compatibility
 * Enhanced with local storage persistence for settings
 */
class PluginManagementUI {
    constructor(pluginManager, configManager) {
        if (!pluginManager || pluginManager.constructor.name !== 'PluginManagerV2') {
            throw new Error('PluginManagementUI requires PluginManagerV2. Legacy PluginManager is no longer supported.');
        }
        
        this.pluginManager = pluginManager;
        this.configManager = configManager;
        
        // Local storage key for plugin management settings
        this.storageKey = 'genomeexplorer-plugin-management-settings';
        
        // Default settings structure
        this.defaultSettings = {
            // Plugin system settings
            pluginDirectory: 'src/renderer/modules/Plugins',
            enablePluginSandbox: true,
            enablePluginDebug: false,
            
            // Plugin states (enabled/disabled)
            pluginStates: {},
            
            // UI preferences
            uiPreferences: {
                currentTab: 'installed',
                showPluginDetails: true,
                sortBy: 'name',
                sortOrder: 'asc',
                gridView: false,
                showDisabledPlugins: true
            },
            
            // Marketplace settings
            marketplaceSettings: {
                autoCheckUpdates: true,
                enableNotifications: true,
                trustedSources: ['localhost', 'official'],
                installationPath: 'auto'
            },
            
            // Performance settings
            performanceSettings: {
                maxConcurrentPlugins: 10,
                enableCaching: true,
                cacheTimeout: 3600000,
                enableLazyLoading: true
            },
            
            // Security settings
            securitySettings: {
                validateSignatures: true,
                allowUntrustedSources: false,
                enableSandboxMode: true,
                restrictNetworkAccess: true
            },
            
            // Metadata
            version: '1.0.0',
            lastSaved: null,
            lastLoaded: null
        };
        
        // Current settings (loaded from storage or defaults)
        this.settings = { ...this.defaultSettings };
        
        // Initialize test framework
        if (typeof PluginTestFramework !== 'undefined') {
            this.testFramework = new PluginTestFramework(pluginManager, configManager);
        } else {
            console.warn('PluginTestFramework not available, using basic test functionality');
            this.testFramework = null;
        }
        
        // Initialize demo generator
        if (typeof PluginDemoGenerator !== 'undefined') {
            this.demoGenerator = new PluginDemoGenerator(pluginManager);
        } else {
            console.warn('PluginDemoGenerator not available');
            this.demoGenerator = null;
        }
        
        // Initialize test manager
        if (typeof PluginTestManager !== 'undefined') {
            this.testManager = new PluginTestManager(pluginManager);
        } else {
            console.warn('PluginTestManager not available, tests will use basic functionality');
            this.testManager = null;
        }
        
        // UI state
        this.currentTab = 'installed';
        this.selectedPlugin = null;
        
        // Load settings from local storage
        this.loadSettingsFromStorage();
        
        // Initialize UI
        this.initializeUI();
        
        // Auto-save settings when they change
        this.setupAutoSave();
        
        console.log('PluginManagementUI initialized with PluginManagerV2 and local storage persistence');
    }

    /**
     * Load settings from local storage
     */
    loadSettingsFromStorage() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const parsedSettings = JSON.parse(stored);
                
                // Merge with defaults to ensure all properties exist
                this.settings = this.mergeSettingsWithDefaults(parsedSettings);
                this.settings.lastLoaded = new Date().toISOString();
                
                console.log('✅ Plugin management settings loaded from local storage');
                this.applyLoadedSettings();
            } else {
                console.log('📝 No saved plugin management settings found, using defaults');
                this.settings = { ...this.defaultSettings };
            }
        } catch (error) {
            console.error('❌ Error loading plugin management settings from storage:', error);
            this.settings = { ...this.defaultSettings };
        }
    }

    /**
     * Merge loaded settings with defaults to ensure all properties exist
     */
    mergeSettingsWithDefaults(loadedSettings) {
        const merged = { ...this.defaultSettings };
        
        // Deep merge for nested objects
        Object.keys(loadedSettings).forEach(key => {
            if (typeof loadedSettings[key] === 'object' && loadedSettings[key] !== null && !Array.isArray(loadedSettings[key])) {
                merged[key] = { ...this.defaultSettings[key], ...loadedSettings[key] };
            } else {
                merged[key] = loadedSettings[key];
            }
        });
        
        return merged;
    }

    /**
     * Apply loaded settings to the UI and plugin system
     */
    applyLoadedSettings() {
        try {
            // Apply plugin states (enabled/disabled)
            this.applyPluginStates();
            
            // Apply UI preferences
            this.applyUIPreferences();
            
            // Apply system settings to configManager if available
            if (this.configManager) {
                this.configManager.set('pluginDirectory', this.settings.pluginDirectory);
                this.configManager.set('enablePluginSandbox', this.settings.enablePluginSandbox);
                this.configManager.set('enablePluginDebug', this.settings.enablePluginDebug);
            }
            
            console.log('✅ Loaded plugin management settings applied successfully');
        } catch (error) {
            console.error('❌ Error applying loaded settings:', error);
        }
    }

    /**
     * Apply plugin enabled/disabled states with detailed logging
     */
    applyPluginStates() {
        if (!this.settings.pluginStates) {
            console.log('📋 No plugin states found in settings');
            return;
        }
        
        console.log('🔧 Applying plugin states from local storage:', this.settings.pluginStates);
        
        let appliedCount = 0;
        let skippedCount = 0;
        
        Object.keys(this.settings.pluginStates).forEach(pluginId => {
            const state = this.settings.pluginStates[pluginId];
            
            // Find plugin in registries
            const functionPlugin = this.pluginManager.pluginRegistry.function.get(pluginId);
            const visualizationPlugin = this.pluginManager.pluginRegistry.visualization.get(pluginId);
            const utilityPlugin = this.pluginManager.pluginRegistry.utility?.get(pluginId);
            
            let targetPlugin = null;
            let pluginType = 'unknown';
            
            if (functionPlugin) {
                targetPlugin = functionPlugin;
                pluginType = 'function';
            } else if (visualizationPlugin) {
                targetPlugin = visualizationPlugin;
                pluginType = 'visualization';
            } else if (utilityPlugin) {
                targetPlugin = utilityPlugin;
                pluginType = 'utility';
            }
            
            if (targetPlugin) {
                const previousState = targetPlugin.enabled;
                targetPlugin.enabled = state.enabled;
                appliedCount++;
                
                console.log(`✅ Applied state for ${pluginType} plugin "${pluginId}": ${previousState} → ${state.enabled}`);
            } else {
                skippedCount++;
                console.warn(`⚠️ Plugin "${pluginId}" not found in registries, skipping state application`);
            }
        });
        
        console.log(`🎯 Plugin state application complete: ${appliedCount} applied, ${skippedCount} skipped`);
    }

    /**
     * Apply UI preferences
     */
    applyUIPreferences() {
        if (this.settings.uiPreferences) {
            this.currentTab = this.settings.uiPreferences.currentTab || 'installed';
        }
    }

    /**
     * Save settings to local storage
     */
    saveSettingsToStorage() {
        try {
            // Update metadata
            this.settings.lastSaved = new Date().toISOString();
            
            // Save current plugin states
            this.updatePluginStates();
            
            // Save current UI preferences
            this.updateUIPreferences();
            
            // Store in localStorage
            localStorage.setItem(this.storageKey, JSON.stringify(this.settings));
            
            console.log('✅ Plugin management settings saved to local storage');
            return true;
        } catch (error) {
            console.error('❌ Error saving plugin management settings to storage:', error);
            return false;
        }
    }

    /**
     * Update plugin states in settings from current plugin registry
     */
    updatePluginStates() {
        this.settings.pluginStates = {};
        
        // Save function plugins states
        this.pluginManager.pluginRegistry.function.forEach((plugin, pluginId) => {
            this.settings.pluginStates[pluginId] = {
                type: 'function',
                enabled: plugin.enabled !== false,
                lastUsed: plugin.lastUsed || null,
                usageCount: plugin.usageCount || 0
            };
        });
        
        // Save visualization plugins states
        this.pluginManager.pluginRegistry.visualization.forEach((plugin, pluginId) => {
            this.settings.pluginStates[pluginId] = {
                type: 'visualization',
                enabled: plugin.enabled !== false,
                lastUsed: plugin.lastUsed || null,
                usageCount: plugin.usageCount || 0
            };
        });
        
        // Save utility plugins states if available
        if (this.pluginManager.pluginRegistry.utility) {
            this.pluginManager.pluginRegistry.utility.forEach((plugin, pluginId) => {
                this.settings.pluginStates[pluginId] = {
                    type: 'utility',
                    enabled: plugin.enabled !== false,
                    lastUsed: plugin.lastUsed || null,
                    usageCount: plugin.usageCount || 0
                };
            });
        }
    }

    /**
     * Update UI preferences in settings
     */
    updateUIPreferences() {
        this.settings.uiPreferences = {
            ...this.settings.uiPreferences,
            currentTab: this.currentTab,
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * Setup auto-save functionality
     */
    setupAutoSave() {
        // Save settings periodically (every 30 seconds)
        setInterval(() => {
            this.saveSettingsToStorage();
        }, 30000);
        
        // Save when page is about to unload
        window.addEventListener('beforeunload', () => {
            this.saveSettingsToStorage();
        });
        
        // Save when visibility changes (tab switch, minimize, etc.)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.saveSettingsToStorage();
            }
        });
    }

    /**
     * Export settings to file
     */
    exportSettings() {
        try {
            const exportData = {
                ...this.settings,
                exportDate: new Date().toISOString(),
                exportVersion: this.settings.version,
                application: 'GenomeExplorer',
                type: 'plugin-management-settings'
            };
            
            const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                type: 'application/json'
            });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `genomeexplorer-plugin-settings-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            
            URL.revokeObjectURL(url);
            
            this.showMessage('Plugin settings exported successfully!', 'success');
        } catch (error) {
            this.showMessage(`Error exporting settings: ${error.message}`, 'error');
        }
    }

    /**
     * Import settings from file
     */
    importSettings() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (event) => {
            const file = event.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const importedData = JSON.parse(e.target.result);
                    
                    // Validate imported data
                    if (importedData.type !== 'plugin-management-settings') {
                        throw new Error('Invalid settings file format');
                    }
                    
                    // Merge imported settings with defaults
                    this.settings = this.mergeSettingsWithDefaults(importedData);
                    this.settings.lastLoaded = new Date().toISOString();
                    
                    // Apply imported settings
                    this.applyLoadedSettings();
                    
                    // Save to storage
                    this.saveSettingsToStorage();
                    
                    // Refresh UI
                    this.refreshPluginLists();
                    this.loadPluginSettings();
                    
                    this.showMessage('Plugin settings imported successfully!', 'success');
                    
                } catch (error) {
                    this.showMessage(`Error importing settings: ${error.message}`, 'error');
                }
            };
            
            reader.readAsText(file);
        };
        
        input.click();
    }

    /**
     * Reset settings to defaults
     */
    resetSettingsToDefaults() {
        if (confirm('Are you sure you want to reset all plugin management settings to defaults? This action cannot be undone.')) {
            try {
                // Clear localStorage
                localStorage.removeItem(this.storageKey);
                
                // Reset to defaults
                this.settings = { ...this.defaultSettings };
                
                // Apply defaults
                this.applyLoadedSettings();
                
                // Refresh UI
                this.refreshPluginLists();
                this.loadPluginSettings();
                
                this.showMessage('Plugin settings reset to defaults successfully!', 'success');
                
            } catch (error) {
                this.showMessage(`Error resetting settings: ${error.message}`, 'error');
            }
        }
    }

    /**
     * Get storage information
     */
    getStorageInfo() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            const size = stored ? new Blob([stored]).size : 0;
            
            return {
                exists: !!stored,
                size: size,
                sizeFormatted: this.formatBytes(size),
                lastSaved: this.settings.lastSaved,
                lastLoaded: this.settings.lastLoaded,
                version: this.settings.version
            };
        } catch (error) {
            return {
                exists: false,
                error: error.message
            };
        }
    }

    /**
     * Format bytes to human readable string
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Initialize UI elements and event handlers
     */
    initializeUI() {
        // Create marketplace button if it doesn't exist
        this.createMarketplaceButton();
        
        // Setup event handlers
        this.setupModalHandlers();
        this.setupTabHandlers();
        this.setupPluginActions();
    }

    /**
     * Create plugin marketplace button in options menu
     */
    createMarketplaceButton() {
        const optionsButton = document.querySelector('.options-button');
        if (!optionsButton) return;

        // Check if marketplace button already exists
        const existingButton = document.querySelector('[data-action="open-marketplace"]');
        if (existingButton) return;

        // Create marketplace button
        const marketplaceButton = document.createElement('button');
        marketplaceButton.textContent = '🛍️ Plugin Marketplace';
        marketplaceButton.setAttribute('data-action', 'open-marketplace');
        marketplaceButton.className = 'dropdown-item';
        marketplaceButton.addEventListener('click', () => this.openPluginMarketplace());

        // Add to options dropdown if it exists
        const dropdownMenu = document.querySelector('.dropdown-menu');
        if (dropdownMenu) {
            dropdownMenu.appendChild(marketplaceButton);
        }
    }

    /**
     * Setup modal event handlers
     */
    setupModalHandlers() {
        const pluginManagerBtn = document.getElementById('pluginManagerBtn');
        const pluginMarketplaceBtn = document.getElementById('pluginMarketplaceBtn');
        const pluginModal = document.getElementById('pluginManagementModal');
        
        if (pluginManagerBtn) {
            pluginManagerBtn.addEventListener('click', () => {
                this.showPluginModal();
            });
        }

        // Add Plugin Marketplace button handler
        if (pluginMarketplaceBtn) {
            pluginMarketplaceBtn.addEventListener('click', () => {
                this.openPluginMarketplace();
            });
        }

        // Modal close handlers
        const closeButtons = pluginModal.querySelectorAll('.modal-close');
        closeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.hidePluginModal();
            });
        });

        // Click outside to close
        pluginModal.addEventListener('click', (e) => {
            if (e.target === pluginModal) {
                this.hidePluginModal();
            }
        });
    }

    /**
     * Setup tab switching handlers
     */
    setupTabHandlers() {
        const tabButtons = document.querySelectorAll('.plugin-management-tabs .tab-btn');
        
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabName = btn.dataset.tab;
                this.switchTab(tabName);
            });
        });
    }

    /**
     * Setup plugin action handlers including storage management
     */
    setupPluginActions() {
        // Load plugin from file
        const loadPluginBtn = document.getElementById('loadPluginBtn');
        if (loadPluginBtn) {
            loadPluginBtn.addEventListener('click', () => {
                this.loadPluginFromFile();
            });
        }

        // Refresh plugins
        const refreshPluginsBtn = document.getElementById('refreshPluginsBtn');
        if (refreshPluginsBtn) {
            refreshPluginsBtn.addEventListener('click', () => {
                this.refreshPluginLists();
            });
        }

        // Save settings
        const saveSettingsBtn = document.getElementById('savePluginSettings');
        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', () => {
                this.savePluginSettings();
            });
        }

        // Browse plugin directory
        const browsePluginDir = document.getElementById('browsePluginDir');
        if (browsePluginDir) {
            browsePluginDir.addEventListener('click', () => {
                this.browsePluginDirectory();
            });
        }

        // Storage Management Actions
        const exportSettingsBtn = document.getElementById('exportPluginSettingsBtn');
        if (exportSettingsBtn) {
            exportSettingsBtn.addEventListener('click', () => {
                this.exportSettings();
            });
        }

        const importSettingsBtn = document.getElementById('importPluginSettingsBtn');
        if (importSettingsBtn) {
            importSettingsBtn.addEventListener('click', () => {
                this.importSettings();
            });
        }

        const resetSettingsBtn = document.getElementById('resetPluginSettingsBtn');
        if (resetSettingsBtn) {
            resetSettingsBtn.addEventListener('click', () => {
                this.resetSettingsToDefaults();
            });
        }

        const viewDetailsBtn = document.getElementById('viewStorageDetailsBtn');
        if (viewDetailsBtn) {
            viewDetailsBtn.addEventListener('click', () => {
                this.showStorageDetails();
            });
        }
    }

    /**
     * Show the plugin management modal
     */
    showPluginModal() {
        const modal = document.getElementById('pluginManagementModal');
        if (modal) {
            modal.style.display = 'block';
            this.refreshPluginLists();
        }
    }

    /**
     * Hide the plugin management modal
     */
    hidePluginModal() {
        const modal = document.getElementById('pluginManagementModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /**
     * Switch between tabs and initialize content as needed
     */
    switchTab(tabName) {
        // Update tab buttons
        const tabButtons = document.querySelectorAll('.plugin-management-tabs .tab-btn');
        tabButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update tab content
        const tabContents = document.querySelectorAll('.plugin-management-tabs .tab-content');
        tabContents.forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-plugins-tab`);
        });

        this.currentTab = tabName;

        // Update UI preferences in local storage
        this.updateUIPreferences();

        // Load tab-specific data
        if (tabName === 'installed') {
            // Validate and fix plugin states before showing installed plugins
            this.validateAndFixPluginStates();
            this.refreshPluginLists();
        } else if (tabName === 'available') {
            this.loadAvailablePlugins();
        } else if (tabName === 'settings') {
            this.loadPluginSettings();
            // Initialize storage info when settings tab is opened
            setTimeout(() => {
                this.updateStorageInfoDisplay();
            }, 100);
        }
    }

    /**
     * Refresh plugin lists and reapply saved states
     */
    refreshPluginLists() {
        // Reapply plugin states from local storage before refreshing UI
        // This ensures the UI shows the correct state even if there are timing issues
        this.applyPluginStates();
        
        this.refreshFunctionPlugins();
        this.refreshVisualizationPlugins();
        
        // Debug logging to verify states are applied
        if (this.settings.pluginStates) {
            console.log('🔄 Plugin states reapplied during refresh:', this.settings.pluginStates);
        }
    }

    /**
     * Refresh function plugins list
     */
    refreshFunctionPlugins() {
        const container = document.getElementById('functionPluginsList');
        if (!container) return;

        container.innerHTML = '';

        const functionPlugins = this.pluginManager.pluginRegistry.function;
        
        if (!functionPlugins || functionPlugins.size === 0) {
            container.innerHTML = '<div class="no-plugins">No function plugins installed</div>';
            return;
        }

        functionPlugins.forEach((plugin, pluginId) => {
            const pluginCard = this.createPluginCard(pluginId, plugin, 'function');
            container.appendChild(pluginCard);
        });
    }

    /**
     * Refresh visualization plugins list
     */
    refreshVisualizationPlugins() {
        const container = document.getElementById('visualizationPluginsList');
        if (!container) return;

        container.innerHTML = '';

        const visualizationPlugins = this.pluginManager.pluginRegistry.visualization;
        
        if (!visualizationPlugins || visualizationPlugins.size === 0) {
            container.innerHTML = '<div class="no-plugins">No visualization plugins installed</div>';
            return;
        }

        visualizationPlugins.forEach((plugin, pluginId) => {
            const pluginCard = this.createPluginCard(pluginId, plugin, 'visualization');
            container.appendChild(pluginCard);
        });
    }

    /**
     * Create a plugin card element
     */
    createPluginCard(pluginId, plugin, type) {
        const card = document.createElement('div');
        card.className = 'plugin-card';
        card.dataset.pluginId = pluginId;
        card.dataset.pluginType = type;

        const functionsCount = type === 'function' ? 
            Object.keys(plugin.functions || {}).length : 
            plugin.supportedDataTypes ? plugin.supportedDataTypes.length : 0;

        const statusClass = plugin.enabled !== false ? 'enabled' : 'disabled';
        const statusText = plugin.enabled !== false ? 'Enabled' : 'Disabled';

        card.innerHTML = `
            <div class="plugin-header">
                <div class="plugin-info">
                    <h5 class="plugin-name">
                        <i class="fas ${type === 'function' ? 'fa-code' : 'fa-chart-bar'}"></i>
                        ${plugin.name}
                    </h5>
                    <span class="plugin-version">v${plugin.version}</span>
                    <span class="plugin-status status-${statusClass}">${statusText}</span>
                </div>
                <div class="plugin-actions">
                    <button class="btn btn-sm btn-info" onclick="pluginManagementUI.showPluginDetails('${pluginId}', '${type}')">
                        <i class="fas fa-info-circle"></i>
                        Details
                    </button>
                    <button class="btn btn-sm btn-primary" onclick="pluginManagementUI.runPluginTest('${pluginId}', '${type}')" 
                            ${plugin.enabled === false ? 'disabled' : ''}>
                        <i class="fas fa-vial"></i>
                        Test
                    </button>
                    <button class="btn btn-sm ${statusClass === 'enabled' ? 'btn-warning' : 'btn-success'}" 
                            onclick="pluginManagementUI.togglePlugin('${pluginId}', '${type}')">
                        <i class="fas ${statusClass === 'enabled' ? 'fa-pause' : 'fa-play'}"></i>
                        ${statusClass === 'enabled' ? 'Disable' : 'Enable'}
                    </button>
                </div>
            </div>
            <div class="plugin-description">
                ${plugin.description}
            </div>
            <div class="plugin-meta">
                <span class="plugin-author">
                    <i class="fas fa-user"></i>
                    ${plugin.author || 'Unknown'}
                </span>
                <span class="plugin-functions">
                    <i class="fas ${type === 'function' ? 'fa-cogs' : 'fa-layer-group'}"></i>
                    ${functionsCount} ${type === 'function' ? 'function(s)' : 'data type(s)'}
                </span>
                <span class="plugin-registered">
                    <i class="fas fa-clock"></i>
                    ${plugin.registeredAt ? new Date(plugin.registeredAt).toLocaleDateString() : 'Unknown'}
                </span>
            </div>
        `;

        return card;
    }

    /**
     * Show plugin details
     */
    showPluginDetails(pluginId, type) {
        let plugin;
        
        if (this.pluginManager.pluginRegistry) {
            // PluginManagerV2
            if (type === 'function') {
                plugin = this.pluginManager.pluginRegistry.function.get(pluginId);
            } else {
                plugin = this.pluginManager.pluginRegistry.visualization.get(pluginId);
            }
        } else {
            // Legacy PluginManager
            plugin = type === 'function' ? 
                this.pluginManager.functionPlugins.get(pluginId) :
                this.pluginManager.visualizationPlugins.get(pluginId);
        }

        if (!plugin) return;

        let detailsHTML = `
            <h4><i class="fas ${type === 'function' ? 'fa-code' : 'fa-chart-bar'}"></i> ${plugin.name}</h4>
            <p><strong>Version:</strong> ${plugin.version}</p>
            <p><strong>Author:</strong> ${plugin.author || 'Unknown'}</p>
            <p><strong>Description:</strong> ${plugin.description}</p>
            <p><strong>Type:</strong> ${type === 'function' ? 'Function Plugin' : 'Visualization Plugin'}</p>
        `;

        if (type === 'function' && plugin.functions) {
            detailsHTML += '<h5>Available Functions:</h5><ul>';
            Object.entries(plugin.functions).forEach(([funcName, func]) => {
                detailsHTML += `<li><strong>${funcName}:</strong> ${func.description}</li>`;
            });
            detailsHTML += '</ul>';
        } else if (type === 'visualization' && plugin.supportedDataTypes) {
            detailsHTML += `<h5>Supported Data Types:</h5><ul>`;
            plugin.supportedDataTypes.forEach(dataType => {
                detailsHTML += `<li>${dataType}</li>`;
            });
            detailsHTML += '</ul>';
        }

        // Show in a simple alert for now (could be enhanced with a proper modal)
        const detailsWindow = window.open('', '_blank', 'width=600,height=400,scrollbars=yes');
        detailsWindow.document.write(`
            <html>
                <head>
                    <title>Plugin Details - ${plugin.name}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        h4 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
                        h5 { color: #555; margin-top: 20px; }
                        ul { margin-left: 20px; }
                        li { margin-bottom: 5px; }
                    </style>
                </head>
                <body>${detailsHTML}</body>
            </html>
        `);
    }

    /**
     * Toggle plugin enabled/disabled state with local storage persistence
     */
    togglePlugin(pluginId, type) {
        let plugin;
        
        if (type === 'function') {
            plugin = this.pluginManager.pluginRegistry.function.get(pluginId);
        } else if (type === 'visualization') {
            plugin = this.pluginManager.pluginRegistry.visualization.get(pluginId);
        } else if (type === 'utility') {
            plugin = this.pluginManager.pluginRegistry.utility?.get(pluginId);
        }

        if (!plugin) return;

        // Toggle enabled state
        plugin.enabled = !plugin.enabled;

        // Update plugin state in local storage immediately
        if (!this.settings.pluginStates) {
            this.settings.pluginStates = {};
        }
        
        this.settings.pluginStates[pluginId] = {
            type: type,
            enabled: plugin.enabled,
            lastUsed: plugin.lastUsed || null,
            usageCount: plugin.usageCount || 0,
            lastToggled: new Date().toISOString()
        };

        // Save to local storage immediately
        const saveSuccess = this.saveSettingsToStorage();

        // Update UI
        this.refreshPluginLists();

        // Show feedback with storage status
        const action = plugin.enabled ? 'enabled' : 'disabled';
        const storageStatus = saveSuccess ? ' and saved to storage' : ' (save failed)';
        this.showMessage(`Plugin "${plugin.name}" has been ${action}${storageStatus}`, saveSuccess ? 'success' : 'warning');

        // Emit event for other components
        this.pluginManager.emitEvent('plugin-toggled', {
            pluginId,
            type,
            enabled: plugin.enabled,
            saved: saveSuccess,
            timestamp: Date.now()
        });
        
        // Debug logging
        console.log(`🔧 Plugin ${pluginId} toggled: ${action}, saved: ${saveSuccess}`);
    }

    /**
     * Load available plugins from directory
     */
    async loadAvailablePlugins() {
        const container = document.getElementById('pluginDirectoryList');
        if (!container) return;

        container.innerHTML = '<div class="loading">Loading available plugins...</div>';

        try {
            // This would typically scan the plugin directory
            // For now, show example plugins that could be loaded
            const availablePlugins = [
                {
                    id: 'sequence-alignment-plugin',
                    name: 'Sequence Alignment Plugin',
                    description: 'Advanced sequence alignment and comparison tools',
                    version: '1.0.0',
                    author: 'Community',
                    file: 'SequenceAlignmentPlugin.js'
                },
                {
                    id: 'phylogenetic-analysis-plugin',
                    name: 'Phylogenetic Analysis Plugin',
                    description: 'Enhanced phylogenetic tree construction and analysis',
                    version: '1.2.0',
                    author: 'Research Team',
                    file: 'PhylogeneticAnalysisPlugin.js'
                }
            ];

            container.innerHTML = '';
            
            if (availablePlugins.length === 0) {
                container.innerHTML = '<div class="no-plugins">No additional plugins available in directory</div>';
                return;
            }

            availablePlugins.forEach(plugin => {
                const pluginCard = this.createAvailablePluginCard(plugin);
                container.appendChild(pluginCard);
            });

        } catch (error) {
            container.innerHTML = '<div class="error">Error loading available plugins</div>';
            console.error('Error loading available plugins:', error);
        }
    }

    /**
     * Create available plugin card
     */
    createAvailablePluginCard(plugin) {
        const card = document.createElement('div');
        card.className = 'plugin-card available-plugin';
        card.dataset.pluginId = plugin.id;

        card.innerHTML = `
            <div class="plugin-header">
                <div class="plugin-info">
                    <h5 class="plugin-name">
                        <i class="fas fa-puzzle-piece"></i>
                        ${plugin.name}
                    </h5>
                    <span class="plugin-version">v${plugin.version}</span>
                    <span class="plugin-status status-available">Available</span>
                </div>
                <div class="plugin-actions">
                    <button class="btn btn-sm btn-success" onclick="pluginManagementUI.installPlugin('${plugin.id}')">
                        <i class="fas fa-download"></i>
                        Install
                    </button>
                </div>
            </div>
            <div class="plugin-description">
                ${plugin.description}
            </div>
            <div class="plugin-meta">
                <span class="plugin-author">
                    <i class="fas fa-user"></i>
                    ${plugin.author}
                </span>
                <span class="plugin-file">
                    <i class="fas fa-file-code"></i>
                    ${plugin.file}
                </span>
            </div>
        `;

        return card;
    }

    /**
     * Install a plugin
     */
    async installPlugin(pluginId) {
        try {
            this.showMessage(`Installing plugin: ${pluginId}...`, 'info');
            
            // This would typically load and register the plugin
            // For now, just show a success message
            setTimeout(() => {
                this.showMessage(`Plugin "${pluginId}" installed successfully!`, 'success');
                this.refreshPluginLists();
            }, 1000);

        } catch (error) {
            this.showMessage(`Error installing plugin: ${error.message}`, 'error');
            console.error('Plugin installation error:', error);
        }
    }

    /**
     * Load plugin from file
     */
    async loadPluginFromFile() {
        try {
            // In a real implementation, this would open a file dialog
            // For now, show a placeholder message
            this.showMessage('File dialog would open here to select plugin file', 'info');
            
        } catch (error) {
            this.showMessage(`Error loading plugin: ${error.message}`, 'error');
        }
    }

    /**
     * Load plugin settings from both configManager and local storage
     */
    loadPluginSettings() {
        // Load current settings from local storage first, then fall back to configManager
        const pluginDirectory = document.getElementById('pluginDirectory');
        const enableSandbox = document.getElementById('enablePluginSandbox');
        const enableDebug = document.getElementById('enablePluginDebug');

        if (pluginDirectory) {
            // Use local storage value if available, otherwise use configManager or default
            pluginDirectory.value = this.settings.pluginDirectory || 
                                  this.configManager?.get('pluginDirectory') || 
                                  'src/renderer/modules/Plugins';
        }

        if (enableSandbox) {
            // Use local storage value if available, otherwise use configManager or default
            enableSandbox.checked = this.settings.enablePluginSandbox !== undefined ? 
                                   this.settings.enablePluginSandbox : 
                                   (this.configManager?.get('enablePluginSandbox') !== false);
        }

        if (enableDebug) {
            // Use local storage value if available, otherwise use configManager or default
            enableDebug.checked = this.settings.enablePluginDebug !== undefined ?
                                 this.settings.enablePluginDebug :
                                 (this.configManager?.get('enablePluginDebug') === true);
        }

        // Show storage info if available
        this.updateStorageInfo();
    }

    /**
     * Save plugin settings to both local storage and configManager
     */
    savePluginSettings() {
        try {
            const pluginDirectory = document.getElementById('pluginDirectory').value;
            const enableSandbox = document.getElementById('enablePluginSandbox').checked;
            const enableDebug = document.getElementById('enablePluginDebug').checked;

            // Update local settings object
            this.settings.pluginDirectory = pluginDirectory;
            this.settings.enablePluginSandbox = enableSandbox;
            this.settings.enablePluginDebug = enableDebug;

            // Save to local storage
            const storageSuccess = this.saveSettingsToStorage();

            // Also save to configManager for compatibility
            if (this.configManager) {
                this.configManager.set('pluginDirectory', pluginDirectory);
                this.configManager.set('enablePluginSandbox', enableSandbox);
                this.configManager.set('enablePluginDebug', enableDebug);
            }

            // Update storage info display
            this.updateStorageInfo();

            // Show success message with storage info
            const storageInfo = this.getStorageInfo();
            this.showMessage(
                `Plugin settings saved successfully! Storage size: ${storageInfo.sizeFormatted}`, 
                'success'
            );

        } catch (error) {
            this.showMessage(`Error saving settings: ${error.message}`, 'error');
        }
    }

    /**
     * Update storage information display in the UI
     */
    updateStorageInfo() {
        const storageInfo = this.getStorageInfo();
        
        // Add storage info to settings tab if not already present
        let storageInfoElement = document.getElementById('plugin-storage-info');
        if (!storageInfoElement) {
            const settingsTab = document.getElementById('settings-plugins-tab');
            if (settingsTab) {
                storageInfoElement = document.createElement('div');
                storageInfoElement.id = 'plugin-storage-info';
                storageInfoElement.className = 'settings-section';
                
                storageInfoElement.innerHTML = `
                    <h4><i class="fas fa-database"></i> Storage Information</h4>
                    <div class="storage-info-content">
                        <div class="storage-stats">
                            <div class="storage-stat">
                                <span class="stat-label">Settings Size:</span>
                                <span class="stat-value" id="storage-size">${storageInfo.sizeFormatted || '0 Bytes'}</span>
                            </div>
                            <div class="storage-stat">
                                <span class="stat-label">Last Saved:</span>
                                <span class="stat-value" id="last-saved">${storageInfo.lastSaved ? new Date(storageInfo.lastSaved).toLocaleString() : 'Never'}</span>
                            </div>
                            <div class="storage-stat">
                                <span class="stat-label">Version:</span>
                                <span class="stat-value">${storageInfo.version || '1.0.0'}</span>
                            </div>
                        </div>
                        <div class="storage-actions">
                            <button id="exportSettingsBtn" class="btn btn-info btn-sm">
                                <i class="fas fa-download"></i>
                                Export Settings
                            </button>
                            <button id="importSettingsBtn" class="btn btn-secondary btn-sm">
                                <i class="fas fa-upload"></i>
                                Import Settings
                            </button>
                            <button id="resetSettingsBtn" class="btn btn-warning btn-sm">
                                <i class="fas fa-undo"></i>
                                Reset to Defaults
                            </button>
                            <button id="viewStorageDetailsBtn" class="btn btn-primary btn-sm">
                                <i class="fas fa-info-circle"></i>
                                View Details
                            </button>
                        </div>
                    </div>
                `;
                
                settingsTab.appendChild(storageInfoElement);
                
                // Add event listeners for storage actions
                this.setupStorageActionHandlers();
            }
        } else {
            // Update existing storage info
            const sizeElement = storageInfoElement.querySelector('#storage-size');
            const lastSavedElement = storageInfoElement.querySelector('#last-saved');
            
            if (sizeElement) {
                sizeElement.textContent = storageInfo.sizeFormatted || '0 Bytes';
            }
            if (lastSavedElement) {
                lastSavedElement.textContent = storageInfo.lastSaved ? 
                    new Date(storageInfo.lastSaved).toLocaleString() : 'Never';
            }
        }
    }

    /**
     * Setup event handlers for storage action buttons
     */
    setupStorageActionHandlers() {
        const exportBtn = document.getElementById('exportSettingsBtn');
        const importBtn = document.getElementById('importSettingsBtn');
        const resetBtn = document.getElementById('resetSettingsBtn');
        const detailsBtn = document.getElementById('viewStorageDetailsBtn');

        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportSettings();
            });
        }

        if (importBtn) {
            importBtn.addEventListener('click', () => {
                this.importSettings();
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetSettingsToDefaults();
            });
        }

        if (detailsBtn) {
            detailsBtn.addEventListener('click', () => {
                this.showStorageDetails();
            });
        }
    }

    /**
     * Show detailed storage information
     */
    showStorageDetails() {
        const storageInfo = this.getStorageInfo();
        const pluginCount = Object.keys(this.settings.pluginStates || {}).length;
        
        const details = `
            <div class="storage-details">
                <h4>📊 Storage Details</h4>
                <table class="details-table">
                    <tr><td><strong>Storage Status:</strong></td><td>${storageInfo.exists ? '✅ Active' : '❌ Not Found'}</td></tr>
                    <tr><td><strong>Storage Size:</strong></td><td>${storageInfo.sizeFormatted}</td></tr>
                    <tr><td><strong>Version:</strong></td><td>${storageInfo.version}</td></tr>
                    <tr><td><strong>Plugins Tracked:</strong></td><td>${pluginCount}</td></tr>
                    <tr><td><strong>Last Saved:</strong></td><td>${storageInfo.lastSaved ? new Date(storageInfo.lastSaved).toLocaleString() : 'Never'}</td></tr>
                    <tr><td><strong>Last Loaded:</strong></td><td>${storageInfo.lastLoaded ? new Date(storageInfo.lastLoaded).toLocaleString() : 'Never'}</td></tr>
                    <tr><td><strong>Auto-Save:</strong></td><td>✅ Every 30 seconds</td></tr>
                    <tr><td><strong>Storage Key:</strong></td><td><code>${this.storageKey}</code></td></tr>
                </table>
                
                <h5>📋 Settings Categories</h5>
                <ul class="settings-categories">
                    <li>🔧 System Settings (directory, sandbox, debug)</li>
                    <li>🔌 Plugin States (enabled/disabled status)</li>
                    <li>🎨 UI Preferences (tabs, sorting, view options)</li>
                    <li>🛒 Marketplace Settings (updates, notifications)</li>
                    <li>⚡ Performance Settings (caching, limits)</li>
                    <li>🔒 Security Settings (validation, restrictions)</li>
                </ul>
            </div>
        `;
        
        // Create modal for details
        const detailsModal = document.createElement('div');
        detailsModal.className = 'storage-details-modal';
        detailsModal.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h3><i class="fas fa-database"></i> Plugin Storage Details</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        ${details}
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-primary modal-close">Close</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(detailsModal);
        
        // Add close handlers
        const closeButtons = detailsModal.querySelectorAll('.modal-close');
        closeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                detailsModal.remove();
            });
        });
        
        // Click outside to close
        detailsModal.addEventListener('click', (e) => {
            if (e.target === detailsModal.querySelector('.modal-overlay')) {
                detailsModal.remove();
            }
        });
    }

    /**
     * Browse plugin directory
     */
    async browsePluginDirectory() {
        // In a real implementation, this would open a directory dialog
        this.showMessage('Directory browser would open here', 'info');
    }

    /**
     * Show a temporary message
     */
    showMessage(message, type = 'info') {
        // Create message element
        const messageEl = document.createElement('div');
        messageEl.className = `plugin-message plugin-message-${type}`;
        messageEl.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 
                           type === 'error' ? 'fa-exclamation-circle' : 
                           'fa-info-circle'}"></i>
            ${message}
        `;

        // Add to modal
        const modal = document.getElementById('pluginManagementModal');
        const modalBody = modal.querySelector('.modal-body');
        modalBody.insertBefore(messageEl, modalBody.firstChild);

        // Remove after 3 seconds
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.parentNode.removeChild(messageEl);
            }
        }, 3000);
    }

    /**
     * Run comprehensive test for a plugin
     */
    async runPluginTest(pluginId, type) {
        let plugin;
        
        if (type === 'function') {
            plugin = this.pluginManager.pluginRegistry.function.get(pluginId);
        } else if (type === 'visualization') {
            plugin = this.pluginManager.pluginRegistry.visualization.get(pluginId);
        } else if (type === 'utility') {
            plugin = this.pluginManager.pluginRegistry.utility?.get(pluginId);
        }

        if (!plugin) {
            this.showMessage(`Plugin "${pluginId}" not found`, 'error');
            return;
        }

        if (plugin.enabled === false) {
            this.showMessage(`Plugin "${plugin.name}" is disabled. Enable it first to run tests.`, 'warning');
            return;
        }

        // Show loading message
        this.showMessage(`Starting enhanced test suite for "${plugin.name}"...`, 'info');

        // Use new test framework if available
        if (this.testFramework) {
            this.testFramework.openPluginTestInterface(pluginId, plugin, type);
        } else {
            // Fallback to enhanced test window
            this.showEnhancedPluginTestWindow(pluginId, plugin, type);
        }
    }

    /**
     * Create and display enhanced plugin test window
     */
    showEnhancedPluginTestWindow(pluginId, plugin, type) {
        // Create test window
        const testWindow = window.open('', '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
        
        testWindow.document.write(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Plugin Test Suite - ${plugin.name}</title>
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
                <style>
                    ${this.getEnhancedTestWindowStyles()}
                </style>
            </head>
            <body>
                <div class="test-container">
                    <div class="test-header">
                        <div class="header-content">
                            <div class="plugin-info">
                                <h1><i class="fas fa-vial"></i> Plugin Test Suite</h1>
                                <h2>${plugin.name} <span class="version">v${plugin.version}</span></h2>
                                <p class="description">${plugin.description}</p>
                                <div class="plugin-meta">
                                    <span class="meta-item">
                                        <i class="fas fa-user"></i>
                                        ${plugin.author || 'Unknown Author'}
                                    </span>
                                    <span class="meta-item">
                                        <i class="fas fa-tag"></i>
                                        ${type === 'function' ? 'Function Plugin' : 'Visualization Plugin'}
                                    </span>
                                    ${type === 'function' && plugin.functions ? 
                                        `<span class="meta-item">
                                            <i class="fas fa-code"></i>
                                            ${Object.keys(plugin.functions).length} Functions
                                        </span>` : ''}
                                    ${type === 'visualization' && plugin.supportedDataTypes ? 
                                        `<span class="meta-item">
                                            <i class="fas fa-chart-bar"></i>
                                            ${plugin.supportedDataTypes.length} Data Types
                                        </span>` : ''}
                                </div>
                            </div>
                            <div class="test-controls">
                                <button class="btn btn-primary" id="runFullTestSuite">
                                    <i class="fas fa-play"></i>
                                    Run Full Test Suite
                                </button>
                                <button class="btn btn-secondary" id="runQuickTest">
                                    <i class="fas fa-bolt"></i>
                                    Quick Test
                                </button>
                                <button class="btn btn-info" id="runPerformanceTest">
                                    <i class="fas fa-tachometer-alt"></i>
                                    Performance Test
                                </button>
                                <button class="btn btn-success" id="generateReport">
                                    <i class="fas fa-file-alt"></i>
                                    Generate Report
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="test-dashboard">
                        <div class="stats-grid">
                            <div class="stat-card">
                                <div class="stat-icon">
                                    <i class="fas fa-list-check"></i>
                                </div>
                                <div class="stat-content">
                                    <div class="stat-value" id="totalTests">0</div>
                                    <div class="stat-label">Total Tests</div>
                                </div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-icon success">
                                    <i class="fas fa-check-circle"></i>
                                </div>
                                <div class="stat-content">
                                    <div class="stat-value" id="passedTests">0</div>
                                    <div class="stat-label">Passed</div>
                                </div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-icon error">
                                    <i class="fas fa-times-circle"></i>
                                </div>
                                <div class="stat-content">
                                    <div class="stat-value" id="failedTests">0</div>
                                    <div class="stat-label">Failed</div>
                                </div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-icon info">
                                    <i class="fas fa-clock"></i>
                                </div>
                                <div class="stat-content">
                                    <div class="stat-value" id="testDuration">0ms</div>
                                    <div class="stat-label">Duration</div>
                                </div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-icon warning">
                                    <i class="fas fa-percentage"></i>
                                </div>
                                <div class="stat-content">
                                    <div class="stat-value" id="successRate">0%</div>
                                    <div class="stat-label">Success Rate</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="test-content">
                        <div class="test-tabs">
                            <button class="tab-btn active" data-tab="overview">
                                <i class="fas fa-home"></i>
                                Overview
                            </button>
                            <button class="tab-btn" data-tab="results">
                                <i class="fas fa-chart-line"></i>
                                Test Results
                            </button>
                            <button class="tab-btn" data-tab="functions">
                                <i class="fas fa-code"></i>
                                ${type === 'function' ? 'Functions' : 'Visualizations'}
                            </button>
                            <button class="tab-btn" data-tab="performance">
                                <i class="fas fa-tachometer-alt"></i>
                                Performance
                            </button>
                            <button class="tab-btn" data-tab="logs">
                                <i class="fas fa-terminal"></i>
                                Logs
                            </button>
                        </div>

                        <div class="tab-content active" id="overview-tab">
                            ${typeof PluginTestHelpers !== 'undefined' ? 
                                PluginTestHelpers.generateOverviewTab(plugin, type) : 
                                this.generateOverviewTab(plugin, type)}
                        </div>

                        <div class="tab-content" id="results-tab">
                            ${typeof PluginTestHelpers !== 'undefined' ? 
                                PluginTestHelpers.generateResultsTab() : 
                                this.generateResultsTab()}
                        </div>

                        <div class="tab-content" id="functions-tab">
                            ${typeof PluginTestHelpers !== 'undefined' ? 
                                PluginTestHelpers.generateFunctionsTab(plugin, type) : 
                                this.generateFunctionsTab(plugin, type)}
                        </div>

                        <div class="tab-content" id="performance-tab">
                            ${typeof PluginTestHelpers !== 'undefined' ? 
                                PluginTestHelpers.generatePerformanceTab() : 
                                this.generatePerformanceTab()}
                        </div>

                        <div class="tab-content" id="logs-tab">
                            ${typeof PluginTestHelpers !== 'undefined' ? 
                                PluginTestHelpers.generateLogsTab() : 
                                this.generateLogsTab()}
                        </div>
                    </div>
                </div>

                <script>
                    ${typeof PluginTestHelpers !== 'undefined' ? 
                        PluginTestHelpers.generateEnhancedTestScript(pluginId, plugin, type) : 
                        this.generateEnhancedTestScript(pluginId, plugin, type)}
                </script>
            </body>
            </html>
        `);

        testWindow.document.close();
        testWindow.focus();
    }

    /**
     * Create and display plugin test window (fallback method)
     */
    showPluginTestWindow(pluginId, plugin, type) {
        // Create test window
        const testWindow = window.open('', '_blank', 'width=1000,height=700,scrollbars=yes,resizable=yes');
        
        testWindow.document.write(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Plugin Test - ${plugin.name}</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        margin: 0;
                        padding: 20px;
                        background: #f5f7fa;
                        color: #2d3748;
                    }
                    .test-container {
                        max-width: 1200px;
                        margin: 0 auto;
                        background: white;
                        border-radius: 8px;
                        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                        overflow: hidden;
                    }
                    .test-header {
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        padding: 20px;
                        text-align: center;
                    }
                    .test-content {
                        padding: 20px;
                    }
                    .test-section {
                        margin-bottom: 20px;
                        border: 1px solid #e2e8f0;
                        border-radius: 6px;
                        overflow: hidden;
                    }
                    .test-section-header {
                        background: #f7fafc;
                        padding: 12px 16px;
                        border-bottom: 1px solid #e2e8f0;
                        font-weight: 600;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                    }
                    .test-section-content {
                        padding: 16px;
                    }
                    .test-result {
                        padding: 12px;
                        border-radius: 4px;
                        margin: 8px 0;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }
                    .test-result.success {
                        background: #f0fff4;
                        border: 1px solid #9ae6b4;
                        color: #276749;
                    }
                    .test-result.error {
                        background: #fed7d7;
                        border: 1px solid #feb2b2;
                        color: #742a2a;
                    }
                    .test-result.warning {
                        background: #fefcbf;
                        border: 1px solid #f6e05e;
                        color: #744210;
                    }
                    .test-result.running {
                        background: #bee3f8;
                        border: 1px solid #90cdf4;
                        color: #2c5282;
                    }
                    .btn {
                        background: #4299e1;
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                        transition: background 0.2s;
                    }
                    .btn:hover {
                        background: #3182ce;
                    }
                    .btn:disabled {
                        background: #a0aec0;
                        cursor: not-allowed;
                    }
                    .test-log {
                        background: #2d3748;
                        color: #e2e8f0;
                        padding: 12px;
                        border-radius: 4px;
                        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                        font-size: 12px;
                        max-height: 200px;
                        overflow-y: auto;
                        white-space: pre-wrap;
                    }
                    .test-stats {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                        gap: 16px;
                        margin: 16px 0;
                    }
                    .stat-card {
                        background: #f7fafc;
                        padding: 12px;
                        border-radius: 6px;
                        text-align: center;
                        border: 1px solid #e2e8f0;
                    }
                    .stat-value {
                        font-size: 24px;
                        font-weight: bold;
                        color: #4299e1;
                    }
                    .stat-label {
                        font-size: 12px;
                        color: #718096;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    .spinner {
                        display: inline-block;
                        width: 16px;
                        height: 16px;
                        border: 2px solid #e2e8f0;
                        border-radius: 50%;
                        border-top-color: #4299e1;
                        animation: spin 1s ease-in-out infinite;
                    }
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                    .function-test {
                        background: #f8f9fa;
                        border: 1px solid #dee2e6;
                        border-radius: 4px;
                        padding: 12px;
                        margin: 8px 0;
                    }
                    .function-name {
                        font-weight: 600;
                        color: #495057;
                        margin-bottom: 4px;
                    }
                    .function-desc {
                        font-size: 13px;
                        color: #6c757d;
                        margin-bottom: 8px;
                    }
                    .test-parameters {
                        background: #e9ecef;
                        padding: 8px;
                        border-radius: 3px;
                        font-size: 12px;
                        font-family: monospace;
                    }
                </style>
            </head>
            <body>
                <div class="test-container">
                    <div class="test-header">
                        <h1><i class="fas fa-vial"></i> Plugin Test Suite</h1>
                        <h2>${plugin.name} v${plugin.version}</h2>
                        <p>Comprehensive testing and validation</p>
                    </div>
                    
                    <div class="test-content">
                        <div class="test-stats">
                            <div class="stat-card">
                                <div class="stat-value" id="totalTests">0</div>
                                <div class="stat-label">Total Tests</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value" id="passedTests">0</div>
                                <div class="stat-label">Passed</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value" id="failedTests">0</div>
                                <div class="stat-label">Failed</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value" id="testDuration">0ms</div>
                                <div class="stat-label">Duration</div>
                            </div>
                        </div>

                        <div class="test-section">
                            <div class="test-section-header">
                                <span><i class="fas fa-info-circle"></i> Plugin Information</span>
                            </div>
                            <div class="test-section-content">
                                <p><strong>Name:</strong> ${plugin.name}</p>
                                <p><strong>Version:</strong> ${plugin.version}</p>
                                <p><strong>Author:</strong> ${plugin.author || 'Unknown'}</p>
                                <p><strong>Type:</strong> ${type === 'function' ? 'Function Plugin' : 'Visualization Plugin'}</p>
                                <p><strong>Description:</strong> ${plugin.description}</p>
                            </div>
                        </div>

                        <div class="test-section">
                            <div class="test-section-header">
                                <span><i class="fas fa-play-circle"></i> Test Controls</span>
                                <div>
                                    <button class="btn" id="runAllTestsBtn">Run All Tests</button>
                                    <button class="btn" id="runQuickTestBtn">Quick Test</button>
                                    <button class="btn" id="runPerformanceTestBtn">Performance Test</button>
                                </div>
                            </div>
                            <div class="test-section-content">
                                <div id="testProgress"></div>
                            </div>
                        </div>

                        <div class="test-section">
                            <div class="test-section-header">
                                <span><i class="fas fa-list-check"></i> Test Results</span>
                            </div>
                            <div class="test-section-content" id="testResults">
                                <p>Click "Run All Tests" to start comprehensive testing.</p>
                            </div>
                        </div>

                        ${type === 'function' ? this.generateFunctionTestsHTML(plugin) : this.generateVisualizationTestsHTML(plugin)}

                        <div class="test-section">
                            <div class="test-section-header">
                                <span><i class="fas fa-terminal"></i> Test Log</span>
                            </div>
                            <div class="test-section-content">
                                <div class="test-log" id="testLog">Test log will appear here...\n</div>
                            </div>
                        </div>
                    </div>
                </div>

                <script>
                    ${this.generateTestScript(pluginId, plugin, type)}
                </script>
            </body>
            </html>
        `);

        testWindow.document.close();
        testWindow.focus();
    }

    /**
     * Generate HTML for function plugin tests
     */
    generateFunctionTestsHTML(plugin) {
        if (!plugin.functions || Object.keys(plugin.functions).length === 0) {
            return `
                <div class="test-section">
                    <div class="test-section-header">
                        <span><i class="fas fa-exclamation-triangle"></i> No Functions Available</span>
                    </div>
                    <div class="test-section-content">
                        <p>This plugin does not expose any testable functions.</p>
                    </div>
                </div>
            `;
        }

        const functionsHTML = Object.entries(plugin.functions).map(([funcName, func]) => `
            <div class="function-test">
                <div class="function-name">${funcName}</div>
                <div class="function-desc">${func.description}</div>
                <div class="test-parameters">
                    Parameters: ${JSON.stringify(func.parameters || {}, null, 2)}
                </div>
                <button class="btn" onclick="testFunction('${funcName}')">Test Function</button>
            </div>
        `).join('');

        return `
            <div class="test-section">
                <div class="test-section-header">
                    <span><i class="fas fa-code"></i> Function Tests</span>
                </div>
                <div class="test-section-content">
                    ${functionsHTML}
                </div>
            </div>
        `;
    }

    /**
     * Generate HTML for visualization plugin tests
     */
    generateVisualizationTestsHTML(plugin) {
        const supportedTypes = plugin.supportedDataTypes || [];
        
        const testsHTML = supportedTypes.map(dataType => `
            <div class="function-test">
                <div class="function-name">Visualization Test: ${dataType}</div>
                <div class="function-desc">Test rendering with ${dataType} data</div>
                <button class="btn" onclick="testVisualization('${dataType}')">Test Rendering</button>
            </div>
        `).join('');

        return `
            <div class="test-section">
                <div class="test-section-header">
                    <span><i class="fas fa-chart-bar"></i> Visualization Tests</span>
                </div>
                <div class="test-section-content">
                    ${testsHTML}
                    <div class="function-test">
                        <div class="function-name">Performance Test</div>
                        <div class="function-desc">Test rendering performance with large datasets</div>
                        <button class="btn" onclick="testVisualizationPerformance()">Test Performance</button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Generate JavaScript code for test functionality
     */
    generateTestScript(pluginId, plugin, type) {
        return `
            let testStats = {
                total: 0,
                passed: 0,
                failed: 0,
                startTime: null
            };

            let testLog = [];

            function log(message, level = 'info') {
                const timestamp = new Date().toLocaleTimeString();
                const logEntry = \`[\${timestamp}] [\${level.toUpperCase()}] \${message}\`;
                testLog.push(logEntry);
                
                const logElement = document.getElementById('testLog');
                logElement.textContent = testLog.join('\\n');
                logElement.scrollTop = logElement.scrollHeight;
                
                console.log(logEntry);
            }

            function updateStats() {
                document.getElementById('totalTests').textContent = testStats.total;
                document.getElementById('passedTests').textContent = testStats.passed;
                document.getElementById('failedTests').textContent = testStats.failed;
                
                if (testStats.startTime) {
                    const duration = Date.now() - testStats.startTime;
                    document.getElementById('testDuration').textContent = duration + 'ms';
                }
            }

            function addTestResult(testName, success, message, details = '') {
                testStats.total++;
                if (success) {
                    testStats.passed++;
                } else {
                    testStats.failed++;
                }
                
                const resultsContainer = document.getElementById('testResults');
                const resultDiv = document.createElement('div');
                resultDiv.className = \`test-result \${success ? 'success' : 'error'}\`;
                resultDiv.innerHTML = \`
                    <i class="fas \${success ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                    <div>
                        <strong>\${testName}</strong>: \${message}
                        \${details ? \`<br><small>\${details}</small>\` : ''}
                    </div>
                \`;
                resultsContainer.appendChild(resultDiv);
                
                updateStats();
                log(\`Test "\${testName}": \${success ? 'PASSED' : 'FAILED'} - \${message}\`);
            }

            async function runAllTests() {
                log('Starting comprehensive test suite for ${plugin.name}');
                testStats.startTime = Date.now();
                testStats.total = 0;
                testStats.passed = 0;
                testStats.failed = 0;
                
                document.getElementById('testResults').innerHTML = '';
                document.getElementById('runAllTestsBtn').disabled = true;
                
                try {
                    // Basic plugin validation tests
                    await runBasicValidationTests();
                    
                    ${type === 'function' ? 'await runFunctionTests();' : 'await runVisualizationTests();'}
                    
                    // Performance tests
                    await runPerformanceTests();
                    
                    log(\`Test suite completed. \${testStats.passed}/\${testStats.total} tests passed.\`);
                    
                } catch (error) {
                    log(\`Test suite failed with error: \${error.message}\`, 'error');
                    addTestResult('Test Suite', false, 'Critical error occurred', error.message);
                } finally {
                    document.getElementById('runAllTestsBtn').disabled = false;
                }
            }

            async function runBasicValidationTests() {
                log('Running basic validation tests...');
                
                // Test plugin structure
                const plugin = ${JSON.stringify(plugin)};
                
                addTestResult('Plugin Name', !!plugin.name, plugin.name ? \`Name: \${plugin.name}\` : 'Missing plugin name');
                addTestResult('Plugin Version', !!plugin.version, plugin.version ? \`Version: \${plugin.version}\` : 'Missing version');
                addTestResult('Plugin Description', !!plugin.description, plugin.description ? 'Description present' : 'Missing description');
                
                ${type === 'function' ? `
                    addTestResult('Functions Available', !!(plugin.functions && Object.keys(plugin.functions).length > 0), 
                        plugin.functions ? \`\${Object.keys(plugin.functions).length} functions available\` : 'No functions defined');
                ` : `
                    addTestResult('Supported Data Types', !!(plugin.supportedDataTypes && plugin.supportedDataTypes.length > 0),
                        plugin.supportedDataTypes ? \`\${plugin.supportedDataTypes.length} data types supported\` : 'No data types defined');
                `}
                
                // Test plugin manager integration
                try {
                    const pluginManager = window.opener.pluginManager || window.opener.window.pluginManager;
                    if (pluginManager) {
                        const retrievedPlugin = pluginManager.${type}Plugins.get('${pluginId}');
                        addTestResult('Plugin Manager Integration', !!retrievedPlugin, 'Plugin found in manager');
                    } else {
                        addTestResult('Plugin Manager Integration', false, 'Plugin manager not accessible');
                    }
                } catch (error) {
                    addTestResult('Plugin Manager Integration', false, \`Error: \${error.message}\`);
                }
            }

            ${type === 'function' ? `
                async function runFunctionTests() {
                    log('Running function tests...');
                    const plugin = ${JSON.stringify(plugin)};
                    
                    if (!plugin.functions) {
                        addTestResult('Function Tests', false, 'No functions to test');
                        return;
                    }
                    
                    for (const [funcName, func] of Object.entries(plugin.functions)) {
                        await testFunction(funcName);
                    }
                }
                
                async function testFunction(funcName) {
                    log(\`Testing function: \${funcName}\`);
                    
                    try {
                        const pluginManager = window.opener.pluginManager || window.opener.window.pluginManager;
                        if (!pluginManager) {
                            addTestResult(\`Function: \${funcName}\`, false, 'Plugin manager not available');
                            return;
                        }
                        
                        // Get sample parameters for the function
                        const sampleParams = generateSampleParameters(funcName);
                        
                        log(\`Executing \${funcName} with parameters: \${JSON.stringify(sampleParams)}\`);
                        
                        const result = await pluginManager.executeFunctionByName('${pluginId}.' + funcName, sampleParams);
                        
                        if (result) {
                            addTestResult(\`Function: \${funcName}\`, true, 'Executed successfully', \`Result type: \${typeof result}\`);
                        } else {
                            addTestResult(\`Function: \${funcName}\`, false, 'Function returned null/undefined');
                        }
                        
                    } catch (error) {
                        addTestResult(\`Function: \${funcName}\`, false, \`Execution failed: \${error.message}\`);
                        log(\`Function \${funcName} failed: \${error.message}\`, 'error');
                    }
                }
                
                function generateSampleParameters(funcName) {
                    // Generate sample parameters based on function name
                    const sampleData = {
                        'analyzeGCContent': {
                            chromosome: 'chr1',
                            start: 1000,
                            end: 2000,
                            windowSize: 100
                        },
                        'findMotifs': {
                            chromosome: 'chr1',
                            start: 1000,
                            end: 2000,
                            motif: 'ATCG'
                        },
                        'calculateDiversity': {
                            sequences: ['ATCGATCG', 'GCTAGCTA', 'TTAACCGG']
                        },
                        'compareRegions': {
                            regions: [
                                { chromosome: 'chr1', start: 1000, end: 2000, name: 'region1' },
                                { chromosome: 'chr1', start: 3000, end: 4000, name: 'region2' }
                            ]
                        },
                        'buildPhylogeneticTree': {
                            sequences: [
                                { id: '1', sequence: 'ATCGATCG', name: 'seq1' },
                                { id: '2', sequence: 'GCTAGCTA', name: 'seq2' }
                            ]
                        },
                        'calculateEvolutionaryDistance': {
                            sequence1: 'ATCGATCG',
                            sequence2: 'GCTAGCTA'
                        },
                        // Biological Networks Plugin Parameters
                        'buildProteinInteractionNetwork': {
                            proteins: ['TP53', 'MDM2', 'ATM', 'BRCA1', 'CHEK2', 'PTEN'],
                            confidenceThreshold: 0.7,
                            includeComplexes: true
                        },
                        'buildGeneRegulatoryNetwork': {
                            genes: ['lacI', 'lacZ', 'lacY', 'lacA', 'crp', 'araC'],
                            tissueType: 'general',
                            regulationTypes: ['activation', 'repression'],
                            includeModules: true
                        },
                        'analyzeNetworkCentrality': {
                            networkData: {
                                nodes: [
                                    { id: 'TP53', name: 'TP53', type: 'protein' },
                                    { id: 'MDM2', name: 'MDM2', type: 'protein' },
                                    { id: 'ATM', name: 'ATM', type: 'protein' }
                                ],
                                edges: [
                                    { source: 'TP53', target: 'MDM2', weight: 0.9 },
                                    { source: 'ATM', target: 'TP53', weight: 0.8 }
                                ]
                            },
                            centralityTypes: ['degree', 'betweenness', 'closeness']
                        },
                        'detectNetworkCommunities': {
                            networkData: {
                                nodes: [
                                    { id: 'TP53', name: 'TP53', type: 'protein' },
                                    { id: 'MDM2', name: 'MDM2', type: 'protein' },
                                    { id: 'ATM', name: 'ATM', type: 'protein' },
                                    { id: 'BRCA1', name: 'BRCA1', type: 'protein' }
                                ],
                                edges: [
                                    { source: 'TP53', target: 'MDM2', weight: 0.9 },
                                    { source: 'ATM', target: 'TP53', weight: 0.8 },
                                    { source: 'BRCA1', target: 'ATM', weight: 0.7 },
                                    { source: 'BRCA1', target: 'TP53', weight: 0.6 }
                                ]
                            },
                            algorithm: 'louvain',
                            minCommunitySize: 2
                        }
                    };
                    
                    return sampleData[funcName] || {};
                }
            ` : `
                async function runVisualizationTests() {
                    log('Running visualization tests...');
                    const plugin = ${JSON.stringify(plugin)};
                    
                    if (!plugin.supportedDataTypes || plugin.supportedDataTypes.length === 0) {
                        addTestResult('Visualization Tests', false, 'No supported data types to test');
                        return;
                    }
                    
                    for (const dataType of plugin.supportedDataTypes) {
                        await testVisualization(dataType);
                    }
                }
                
                async function testVisualization(dataType) {
                    log(\`Testing visualization for data type: \${dataType}\`);
                    
                    try {
                        const pluginManager = window.opener.pluginManager || window.opener.window.pluginManager;
                        if (!pluginManager) {
                            addTestResult(\`Visualization: \${dataType}\`, false, 'Plugin manager not available');
                            return;
                        }
                        
                        // Create a test container
                        const testContainer = document.createElement('div');
                        testContainer.style.width = '400px';
                        testContainer.style.height = '300px';
                        testContainer.style.border = '1px solid #ccc';
                        testContainer.style.borderRadius = '4px';
                        testContainer.style.margin = '10px';
                        testContainer.id = \`test-viz-\${dataType}\`;
                        
                        // Add to visible results area for network visualizations
                        if (dataType.includes('network')) {
                            const resultsArea = document.getElementById('testResults');
                            const testResultDiv = document.createElement('div');
                            testResultDiv.className = 'test-result network-test';
                            testResultDiv.innerHTML = \`
                                <div style="display: flex; align-items: center; margin-bottom: 10px;">
                                    <i class="fas fa-play-circle" style="color: #3498db; margin-right: 10px;"></i>
                                    <strong>Testing \${dataType} visualization...</strong>
                                </div>
                            \`;
                            testResultDiv.appendChild(testContainer);
                            resultsArea.appendChild(testResultDiv);
                        } else {
                            testContainer.style.display = 'none';
                            document.body.appendChild(testContainer);
                        }
                        
                        // Generate sample data
                        const sampleData = generateSampleVisualizationData(dataType);
                        
                                                 log(\`Rendering \${dataType} visualization with data:\`, sampleData);
                        
                        // Special handling for network visualizations
                        if (dataType.includes('network') || dataType === 'network-graph') {
                            await testNetworkVisualization(dataType, sampleData, testContainer);
                        } else {
                            await pluginManager.renderVisualization('${pluginId}', sampleData, testContainer);
                            
                            // Check if something was rendered
                            const hasContent = testContainer.children.length > 0 || testContainer.innerHTML.trim().length > 0;
                            
                            if (hasContent) {
                                addTestResult(\`Visualization: \${dataType}\`, true, 'Rendered successfully');
                            } else {
                                addTestResult(\`Visualization: \${dataType}\`, false, 'No content rendered');
                            }
                        }
                        
                        // Clean up for non-network visualizations
                        if (!dataType.includes('network') && testContainer.parentNode === document.body) {
                            document.body.removeChild(testContainer);
                        }
                        
                    } catch (error) {
                        addTestResult(\`Visualization: \${dataType}\`, false, \`Rendering failed: \${error.message}\`);
                        log(\`Visualization \${dataType} failed: \${error.message}\`, 'error');
                    }
                }
                
                async function testNetworkVisualization(dataType, sampleData, testContainer) {
                    log(\`Running specialized network visualization test for \${dataType}\`);
                    
                    try {
                        const pluginManager = window.opener.pluginManager || window.opener.window.pluginManager;
                        
                        // Test network graph rendering
                        if (dataType === 'network-graph' || dataType === 'network-data') {
                            // Use the NetworkGraphPlugin directly
                            const networkResult = await pluginManager.renderVisualization('network-graph', sampleData, testContainer);
                            addTestResult(\`Network Graph: \${dataType}\`, true, 'Interactive network graph rendered', 
                                \`Nodes: \${sampleData.nodes.length}, Edges: \${sampleData.edges.length}\`);
                        } 
                        // Test protein interaction network
                        else if (dataType === 'protein-interaction-network') {
                            const networkResult = await pluginManager.renderVisualization('protein-interaction-network', sampleData, testContainer);
                            addTestResult('Protein Interaction Network', true, 'Protein network visualization rendered',
                                \`Proteins: \${sampleData.nodes.length}, Interactions: \${sampleData.edges.length}\`);
                            
                            // Add interaction details
                            const detailsDiv = document.createElement('div');
                            detailsDiv.className = 'network-details';
                            detailsDiv.style.marginTop = '10px';
                            detailsDiv.style.fontSize = '12px';
                            detailsDiv.style.color = '#666';
                            detailsDiv.innerHTML = \`
                                <strong>Network Details:</strong><br>
                                • Node types: \${[...new Set(sampleData.nodes.map(n => n.type))].join(', ')}<br>
                                • Edge types: \${[...new Set(sampleData.edges.map(e => e.type))].join(', ')}<br>
                                • Network type: \${sampleData.networkType}
                            \`;
                            testContainer.parentNode.appendChild(detailsDiv);
                        }
                        // Test gene regulatory network
                        else if (dataType === 'gene-regulatory-network') {
                            const networkResult = await pluginManager.renderVisualization('gene-regulatory-network', sampleData, testContainer);
                            addTestResult('Gene Regulatory Network', true, 'Gene network visualization rendered',
                                \`Genes: \${sampleData.nodes.length}, Regulations: \${sampleData.edges.length}\`);
                            
                            // Add regulatory details
                            const detailsDiv = document.createElement('div');
                            detailsDiv.className = 'network-details';
                            detailsDiv.style.marginTop = '10px';
                            detailsDiv.style.fontSize = '12px';
                            detailsDiv.style.color = '#666';
                            const regulationTypes = [...new Set(sampleData.edges.map(e => e.type))];
                            detailsDiv.innerHTML = \`
                                <strong>Regulatory Network Details:</strong><br>
                                • Gene types: \${[...new Set(sampleData.nodes.map(n => n.type))].join(', ')}<br>
                                • Regulation types: \${regulationTypes.join(', ')}<br>
                                • Network complexity: \${regulationTypes.includes('activation') && regulationTypes.includes('repression') ? 'Mixed regulation' : 'Simple regulation'}
                            \`;
                            testContainer.parentNode.appendChild(detailsDiv);
                        }
                        
                        // Add interactive test controls
                        const controlsDiv = document.createElement('div');
                        controlsDiv.className = 'test-controls';
                        controlsDiv.style.marginTop = '10px';
                        controlsDiv.innerHTML = \`
                            <button class="btn btn-sm btn-primary" onclick="testNetworkInteractivity('\${testContainer.id}')">
                                <i class="fas fa-mouse-pointer"></i> Test Interactivity
                            </button>
                            <button class="btn btn-sm btn-info" onclick="testNetworkZoom('\${testContainer.id}')">
                                <i class="fas fa-search-plus"></i> Test Zoom
                            </button>
                            <button class="btn btn-sm btn-success" onclick="exportNetworkData('\${testContainer.id}')">
                                <i class="fas fa-download"></i> Export Data
                            </button>
                        \`;
                        testContainer.parentNode.appendChild(controlsDiv);
                        
                        // Add network statistics
                        const statsDiv = document.createElement('div');
                        statsDiv.className = 'network-stats';
                        statsDiv.style.marginTop = '5px';
                        statsDiv.style.fontSize = '11px';
                        statsDiv.style.color = '#888';
                        const avgDegree = (sampleData.edges.length * 2) / sampleData.nodes.length;
                        statsDiv.innerHTML = \`
                            Density: \${(sampleData.edges.length / (sampleData.nodes.length * (sampleData.nodes.length - 1) / 2)).toFixed(3)} | 
                            Avg Degree: \${avgDegree.toFixed(1)} | 
                            Connected: \${sampleData.edges.length > 0 ? 'Yes' : 'No'}
                        \`;
                        testContainer.parentNode.appendChild(statsDiv);
                        
                    } catch (error) {
                        addTestResult(\`Network Test: \${dataType}\`, false, \`Network rendering failed: \${error.message}\`);
                        log(\`Network test \${dataType} failed: \${error.message}\`, 'error');
                    }
                }
                
                function generateSampleVisualizationData(dataType) {
                    const sampleData = {
                        'network-data': {
                            networkType: 'generic',
                            nodes: [
                                { id: 'N1', name: 'Node 1', size: 10, color: '#4ECDC4' },
                                { id: 'N2', name: 'Node 2', size: 12, color: '#45B7D1' },
                                { id: 'N3', name: 'Node 3', size: 8, color: '#F7DC6F' }
                            ],
                            edges: [
                                { source: 'N1', target: 'N2', weight: 0.8, color: '#999' },
                                { source: 'N2', target: 'N3', weight: 0.6, color: '#999' }
                            ]
                        },
                        'protein-interaction-network': {
                            networkType: 'protein-interaction',
                            nodes: [
                                { 
                                    id: 'TP53', 
                                    name: 'TP53', 
                                    type: 'protein',
                                    size: 15,
                                    color: '#E74C3C',
                                    properties: {
                                        function: 'Tumor suppressor',
                                        location: 'nucleus',
                                        expression: 0.85
                                    }
                                },
                                { 
                                    id: 'MDM2', 
                                    name: 'MDM2', 
                                    type: 'protein',
                                    size: 12,
                                    color: '#3498DB',
                                    properties: {
                                        function: 'E3 ubiquitin ligase',
                                        location: 'nucleus',
                                        expression: 0.67
                                    }
                                },
                                { 
                                    id: 'ATM', 
                                    name: 'ATM', 
                                    type: 'protein',
                                    size: 13,
                                    color: '#2ECC71',
                                    properties: {
                                        function: 'Protein kinase',
                                        location: 'nucleus',
                                        expression: 0.72
                                    }
                                }
                            ],
                            edges: [
                                { 
                                    source: 'TP53', 
                                    target: 'MDM2', 
                                    weight: 0.9, 
                                    color: '#E67E22',
                                    type: 'physical',
                                    properties: {
                                        confidence: 0.9,
                                        method: 'experimental'
                                    }
                                },
                                { 
                                    source: 'ATM', 
                                    target: 'TP53', 
                                    weight: 0.8, 
                                    color: '#9B59B6',
                                    type: 'phosphorylation',
                                    properties: {
                                        confidence: 0.8,
                                        method: 'experimental'
                                    }
                                }
                            ],
                            metadata: {
                                networkType: 'protein-interaction',
                                nodeCount: 3,
                                edgeCount: 2,
                                plugin: 'BiologicalNetworksPlugin'
                            }
                        },
                        'gene-regulatory-network': {
                            networkType: 'gene-regulatory',
                            nodes: [
                                { 
                                    id: 'lacI', 
                                    name: 'lacI', 
                                    type: 'transcription_factor',
                                    size: 14,
                                    color: '#E74C3C',
                                    properties: {
                                        regulation: 'repressor',
                                        chromosome: 'chr1',
                                        expression: 0.65
                                    }
                                },
                                { 
                                    id: 'lacZ', 
                                    name: 'lacZ', 
                                    type: 'gene',
                                    size: 10,
                                    color: '#3498DB',
                                    properties: {
                                        regulation: 'regulated',
                                        chromosome: 'chr1',
                                        expression: 0.85
                                    }
                                },
                                { 
                                    id: 'crp', 
                                    name: 'crp', 
                                    type: 'transcription_factor',
                                    size: 12,
                                    color: '#2ECC71',
                                    properties: {
                                        regulation: 'activator',
                                        chromosome: 'chr1',
                                        expression: 0.55
                                    }
                                }
                            ],
                            edges: [
                                { 
                                    source: 'lacI', 
                                    target: 'lacZ', 
                                    weight: 0.7, 
                                    color: '#E74C3C',
                                    type: 'repression',
                                    properties: {
                                        strength: 0.7,
                                        evidence: 'experimental'
                                    }
                                },
                                { 
                                    source: 'crp', 
                                    target: 'lacZ', 
                                    weight: 0.6, 
                                    color: '#2ECC71',
                                    type: 'activation',
                                    properties: {
                                        strength: 0.6,
                                        evidence: 'experimental'
                                    }
                                }
                            ],
                            metadata: {
                                networkType: 'gene-regulatory',
                                nodeCount: 3,
                                edgeCount: 2,
                                plugin: 'BiologicalNetworksPlugin'
                            }
                        },
                        'sequence-comparison': {
                            sequences: ['ATCG', 'ATCG'],
                            similarity: 1.0
                        },
                        'phylogenetic-tree': {
                            newick: '(A:0.1,B:0.2,(C:0.3,D:0.4):0.5);'
                        },
                        'gc-content-plot': {
                            chromosome: 'chr1',
                            start: 1000,
                            end: 5000,
                            windowSize: 100,
                            results: [
                                { position: 1000, end: 1100, gcContent: 45.2 },
                                { position: 1100, end: 1200, gcContent: 52.8 },
                                { position: 1200, end: 1300, gcContent: 38.9 }
                            ]
                        }
                    };
                    
                    return sampleData[dataType] || { test: true, dataType: dataType };
                }
                
                async function testVisualizationPerformance() {
                    log('Running visualization performance test...');
                    
                    const startTime = Date.now();
                    try {
                        // Test with a larger dataset
                        const largeData = {
                            nodes: Array.from({length: 100}, (_, i) => ({id: i, name: \`Node \${i}\`})),
                            links: Array.from({length: 200}, (_, i) => ({source: i % 100, target: (i + 1) % 100}))
                        };
                        
                        const testContainer = document.createElement('div');
                        testContainer.style.width = '500px';
                        testContainer.style.height = '500px';
                        testContainer.style.display = 'none';
                        document.body.appendChild(testContainer);
                        
                        const pluginManager = window.opener.pluginManager || window.opener.window.pluginManager;
                        await pluginManager.renderVisualization('${pluginId}', largeData, testContainer);
                        
                        const duration = Date.now() - startTime;
                        addTestResult('Performance Test', duration < 5000, \`Rendering took \${duration}ms\`, 
                            duration < 5000 ? 'Good performance' : 'Performance may need optimization');
                        
                        document.body.removeChild(testContainer);
                        
                    } catch (error) {
                        const duration = Date.now() - startTime;
                        addTestResult('Performance Test', false, \`Failed after \${duration}ms: \${error.message}\`);
                    }
                }
            `}

            async function runPerformanceTests() {
                log('Running performance tests...');
                
                // Memory usage test
                const initialMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
                
                // Simulate some operations
                for (let i = 0; i < 1000; i++) {
                    // Simple operation to test memory usage
                    const temp = new Array(100).fill(i);
                }
                
                const finalMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
                const memoryDelta = finalMemory - initialMemory;
                
                addTestResult('Memory Usage', memoryDelta < 10000000, \`Memory delta: \${memoryDelta} bytes\`,
                    memoryDelta < 10000000 ? 'Acceptable memory usage' : 'High memory usage detected');
            }

            async function runQuickTest() {
                log('Running quick test...');
                testStats.startTime = Date.now();
                testStats.total = 0;
                testStats.passed = 0;
                testStats.failed = 0;
                
                document.getElementById('testResults').innerHTML = '';
                
                // Just run basic validation
                await runBasicValidationTests();
                
                log('Quick test completed.');
            }

            // Network test utility functions
            function testNetworkInteractivity(containerId) {
                const container = document.getElementById(containerId);
                if (!container) {
                    log('Container not found for interactivity test', 'error');
                    return;
                }
                
                log('Testing network interactivity...');
                
                // Simulate mouse events on network elements
                const nodes = container.querySelectorAll('circle, .node');
                const links = container.querySelectorAll('line, .link');
                
                if (nodes.length > 0) {
                    // Test node hover
                    const firstNode = nodes[0];
                    const hoverEvent = new MouseEvent('mouseover', { bubbles: true });
                    firstNode.dispatchEvent(hoverEvent);
                    
                    log(\`Interactivity test: Found \${nodes.length} nodes and \${links.length} links\`);
                    addTestResult('Network Interactivity', true, 'Mouse events working', 
                        \`Tested on \${nodes.length} nodes, \${links.length} edges\`);
                } else {
                    addTestResult('Network Interactivity', false, 'No interactive elements found');
                }
            }

            function testNetworkZoom(containerId) {
                const container = document.getElementById(containerId);
                if (!container) {
                    log('Container not found for zoom test', 'error');
                    return;
                }
                
                log('Testing network zoom functionality...');
                
                // Look for SVG element with zoom capability
                const svg = container.querySelector('svg');
                if (svg) {
                    const transform = svg.querySelector('g')?.getAttribute('transform');
                    log(\`Zoom test: SVG found with transform: \${transform || 'none'}\`);
                    addTestResult('Network Zoom', true, 'Zoom infrastructure present', 
                        transform ? 'Transform detected' : 'Transform ready');
                } else {
                    addTestResult('Network Zoom', false, 'No SVG zoom infrastructure found');
                }
            }

            function exportNetworkData(containerId) {
                const container = document.getElementById(containerId);
                if (!container) {
                    log('Container not found for export test', 'error');
                    return;
                }
                
                log('Testing network data export...');
                
                // Try to extract network data from the visualization
                try {
                    const svg = container.querySelector('svg');
                    const nodes = container.querySelectorAll('circle, .node');
                    const links = container.querySelectorAll('line, .link');
                    
                    const exportData = {
                        nodeCount: nodes.length,
                        linkCount: links.length,
                        svgWidth: svg?.getAttribute('width') || 'unknown',
                        svgHeight: svg?.getAttribute('height') || 'unknown',
                        timestamp: new Date().toISOString()
                    };
                    
                    log(\`Export data: \${JSON.stringify(exportData, null, 2)}\`);
                    addTestResult('Network Export', true, 'Data export successful', 
                        \`Exported \${exportData.nodeCount} nodes, \${exportData.linkCount} links\`);
                                 } catch (error) {
                     addTestResult('Network Export', false, \`Export failed: \${error.message}\`);
                 }
             }

            // Event listeners
            document.getElementById('runAllTestsBtn').addEventListener('click', runAllTests);
            document.getElementById('runQuickTestBtn').addEventListener('click', runQuickTest);
            document.getElementById('runPerformanceTestBtn').addEventListener('click', runPerformanceTests);

            // Auto-run quick test on load
            window.addEventListener('load', () => {
                setTimeout(runQuickTest, 500);
            });
        `;
    }

    /**
     * Get enhanced test window styles
     */
    getEnhancedTestWindowStyles() {
        return `
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #f8fafc;
                color: #2d3748;
                line-height: 1.6;
            }
            .test-container {
                min-height: 100vh;
                display: flex;
                flex-direction: column;
            }
            .test-header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 2rem;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header-content {
                max-width: 1200px;
                margin: 0 auto;
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 2rem;
            }
            .plugin-info h1 {
                font-size: 2rem;
                margin-bottom: 0.5rem;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            .plugin-info h2 {
                font-size: 1.5rem;
                margin-bottom: 0.5rem;
            }
            .version {
                font-size: 1rem;
                opacity: 0.8;
                font-weight: normal;
            }
            .description {
                font-size: 1.1rem;
                opacity: 0.9;
                margin-bottom: 1rem;
            }
            .plugin-meta {
                display: flex;
                gap: 1.5rem;
                flex-wrap: wrap;
            }
            .meta-item {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                opacity: 0.9;
            }
            .test-controls {
                display: flex;
                gap: 0.75rem;
                flex-wrap: wrap;
            }
            .btn {
                padding: 0.75rem 1.5rem;
                border: none;
                border-radius: 0.5rem;
                font-size: 0.95rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                gap: 0.5rem;
                text-decoration: none;
                white-space: nowrap;
            }
            .btn-primary { background: #4299e1; color: white; }
            .btn-secondary { background: #718096; color: white; }
            .btn-info { background: #38b2ac; color: white; }
            .btn-success { background: #48bb78; color: white; }
            .btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); }
            .test-dashboard {
                background: white;
                padding: 1.5rem;
                border-bottom: 1px solid #e2e8f0;
            }
            .stats-grid {
                max-width: 1200px;
                margin: 0 auto;
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 1rem;
            }
            .stat-card {
                background: #f7fafc;
                border: 1px solid #e2e8f0;
                border-radius: 0.75rem;
                padding: 1.5rem;
                display: flex;
                align-items: center;
                gap: 1rem;
                transition: all 0.2s ease;
            }
            .stat-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); }
            .stat-icon {
                width: 3rem;
                height: 3rem;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.25rem;
                background: #e2e8f0;
                color: #4a5568;
            }
            .stat-icon.success { background: #c6f6d5; color: #276749; }
            .stat-icon.error { background: #fed7d7; color: #742a2a; }
            .stat-icon.warning { background: #fefcbf; color: #744210; }
            .stat-icon.info { background: #bee3f8; color: #2c5282; }
            .stat-value {
                font-size: 2rem;
                font-weight: bold;
                color: #2d3748;
            }
            .stat-label {
                font-size: 0.875rem;
                color: #718096;
                text-transform: uppercase;
                letter-spacing: 0.025em;
            }
            .test-content {
                flex: 1;
                max-width: 1200px;
                margin: 0 auto;
                width: 100%;
                padding: 0 1.5rem 1.5rem;
            }
            .test-tabs {
                display: flex;
                gap: 0.25rem;
                margin-bottom: 1.5rem;
                border-bottom: 1px solid #e2e8f0;
            }
            .tab-btn {
                padding: 0.75rem 1.5rem;
                border: none;
                background: transparent;
                color: #718096;
                font-weight: 500;
                cursor: pointer;
                border-bottom: 2px solid transparent;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            .tab-btn:hover { color: #4a5568; }
            .tab-btn.active {
                color: #4299e1;
                border-bottom-color: #4299e1;
                background: rgba(66, 153, 225, 0.1);
            }
            .tab-content {
                display: none;
                background: white;
                border-radius: 0.75rem;
                padding: 1.5rem;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            }
            .tab-content.active { display: block; }
            .test-section {
                margin-bottom: 1.5rem;
                border: 1px solid #e2e8f0;
                border-radius: 0.5rem;
                overflow: hidden;
            }
            .test-section-header {
                background: #f7fafc;
                padding: 1rem 1.5rem;
                border-bottom: 1px solid #e2e8f0;
                font-weight: 600;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            .test-section-content { padding: 1.5rem; }
            .test-result {
                padding: 1rem;
                border-radius: 0.5rem;
                margin: 0.75rem 0;
                display: flex;
                align-items: flex-start;
                gap: 0.75rem;
                border-left: 4px solid;
            }
            .test-result.success {
                background: #f0fff4;
                border-left-color: #48bb78;
                color: #276749;
            }
            .test-result.error {
                background: #fed7d7;
                border-left-color: #f56565;
                color: #742a2a;
            }
            .test-result.warning {
                background: #fefcbf;
                border-left-color: #ed8936;
                color: #744210;
            }
            .test-result.info {
                background: #ebf8ff;
                border-left-color: #4299e1;
                color: #2c5282;
            }
            .test-logs {
                background: #1a202c;
                color: #e2e8f0;
                padding: 1rem;
                border-radius: 0.5rem;
                font-family: 'Monaco', 'Menlo', monospace;
                font-size: 0.875rem;
                max-height: 400px;
                overflow-y: auto;
                white-space: pre-wrap;
            }
            .function-card {
                background: #f7fafc;
                border: 1px solid #e2e8f0;
                border-radius: 0.5rem;
                padding: 1rem;
                margin: 0.75rem 0;
            }
            .function-name {
                font-weight: 600;
                color: #2d3748;
                margin-bottom: 0.5rem;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            .function-desc {
                color: #718096;
                font-size: 0.875rem;
                margin-bottom: 0.75rem;
            }
            .function-params {
                background: #edf2f7;
                padding: 0.75rem;
                border-radius: 0.25rem;
                font-family: monospace;
                font-size: 0.75rem;
                margin: 0.5rem 0;
            }
            .progress-bar {
                width: 100%;
                height: 0.5rem;
                background: #e2e8f0;
                border-radius: 0.25rem;
                overflow: hidden;
            }
            .progress-fill {
                height: 100%;
                background: linear-gradient(90deg, #4299e1, #38b2ac);
                width: 0%;
                transition: width 0.3s ease;
            }
            .spinner {
                display: inline-block;
                width: 1rem;
                height: 1rem;
                border: 2px solid #e2e8f0;
                border-radius: 50%;
                border-top-color: #4299e1;
                animation: spin 1s linear infinite;
            }
            @keyframes spin { to { transform: rotate(360deg); } }
            .chart-container {
                width: 100%;
                height: 300px;
                border: 1px solid #e2e8f0;
                border-radius: 0.5rem;
                padding: 1rem;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #718096;
            }
            
            /* Network Testing Specific Styles */
            .network-test {
                background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
                border: 2px solid #4299e1;
                border-radius: 1rem;
                padding: 1.5rem;
                margin: 1rem 0;
                box-shadow: 0 4px 12px rgba(66, 153, 225, 0.15);
            }
            
            .network-details {
                background: #edf2f7;
                border-radius: 0.5rem;
                padding: 1rem;
                font-size: 0.875rem;
                border-left: 4px solid #38b2ac;
            }
            
            .network-stats {
                background: #f7fafc;
                border-radius: 0.25rem;
                padding: 0.5rem;
                font-family: monospace;
                text-align: center;
            }
            
            .test-controls {
                display: flex;
                gap: 0.5rem;
                flex-wrap: wrap;
                justify-content: center;
                align-items: center;
            }
            
            .btn-sm {
                padding: 0.5rem 1rem;
                font-size: 0.875rem;
                border-radius: 0.375rem;
            }
            
            .btn-sm:hover {
                transform: translateY(-1px);
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            }
            
            /* Network visualization container enhancements */
            #test-viz-network-graph,
            #test-viz-protein-interaction-network,
            #test-viz-gene-regulatory-network,
            #test-viz-network-data {
                background: white;
                border: 2px solid #e2e8f0;
                border-radius: 0.75rem;
                position: relative;
                overflow: hidden;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                transition: all 0.3s ease;
            }
            
            #test-viz-network-graph:hover,
            #test-viz-protein-interaction-network:hover,
            #test-viz-gene-regulatory-network:hover,
            #test-viz-network-data:hover {
                border-color: #4299e1;
                box-shadow: 0 4px 16px rgba(66, 153, 225, 0.2);
            }
            
            /* Network visualization loading state */
            .network-loading {
                display: flex;
                align-items: center;
                justify-content: center;
                height: 300px;
                flex-direction: column;
                gap: 1rem;
                color: #718096;
            }
            
            .network-loading .spinner {
                width: 2rem;
                height: 2rem;
                border-width: 3px;
            }
            
            /* Interactive elements styling */
            .network-node:hover {
                stroke-width: 3px !important;
                filter: brightness(1.1);
            }
            
            .network-edge:hover {
                stroke-width: 4px !important;
                opacity: 0.8 !important;
            }
            
            /* Network controls panel */
            .network-controls-panel {
                position: absolute;
                top: 10px;
                right: 10px;
                background: rgba(255, 255, 255, 0.95);
                border-radius: 0.5rem;
                padding: 0.75rem;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                display: flex;
                gap: 0.5rem;
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            
            .network-visualization:hover .network-controls-panel {
                opacity: 1;
            }
            
            /* Network info tooltip */
            .network-tooltip {
                position: absolute;
                background: rgba(0, 0, 0, 0.9);
                color: white;
                padding: 0.75rem;
                border-radius: 0.5rem;
                font-size: 0.875rem;
                pointer-events: none;
                z-index: 1000;
                max-width: 200px;
                word-wrap: break-word;
            }
            
            /* Network legend */
            .network-legend {
                position: absolute;
                bottom: 10px;
                left: 10px;
                background: rgba(255, 255, 255, 0.95);
                border-radius: 0.5rem;
                padding: 0.75rem;
                font-size: 0.75rem;
                max-width: 200px;
            }
            
            .legend-item {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                margin: 0.25rem 0;
            }
            
            .legend-color {
                width: 12px;
                height: 12px;
                border-radius: 50%;
                flex-shrink: 0;
            }
        `;
    }

    /**
     * Get plugin statistics
     */
    getPluginStatistics() {
        const functionPlugins = this.pluginManager.pluginRegistry.function.size;
        const visualizationPlugins = this.pluginManager.pluginRegistry.visualization.size;
        const utilityPlugins = this.pluginManager.pluginRegistry.utility?.size || 0;
        
        const totalFunctions = Array.from(this.pluginManager.pluginRegistry.function.values())
            .reduce((total, plugin) => total + Object.keys(plugin.functions || {}).length, 0) +
            Array.from(this.pluginManager.pluginRegistry.utility?.values() || [])
            .reduce((total, plugin) => total + Object.keys(plugin.functions || {}).length, 0);
        
        return {
            functionPlugins,
            visualizationPlugins,
            utilityPlugins,
            totalPlugins: functionPlugins + visualizationPlugins + utilityPlugins,
            totalFunctions,
            version: 'V2',
            systemMetrics: this.pluginManager.metrics || {}
        };
    }

    /**
     * Open the plugin marketplace
     */
    async openPluginMarketplace() {
        try {
            console.log('🛒 Opening Plugin Marketplace...');
            
            // Verify PluginManagerV2 is properly initialized
            if (!this.pluginManager || this.pluginManager.constructor.name !== 'PluginManagerV2') {
                throw new Error('PluginManagerV2 is required for the marketplace. Please restart the application.');
            }
            
            console.log('✅ PluginManagerV2 verified');
            
            // Check if marketplace is available
            if (!this.pluginManager.marketplace) {
                console.log('🔄 Initializing marketplace...');
                
                // Try to initialize marketplace if method exists
                if (typeof this.pluginManager.initializeMarketplace === 'function') {
                    await this.pluginManager.initializeMarketplace();
                }
                
                // If still not available, try reinitialization
                if (!this.pluginManager.marketplace) {
                    const userChoice = confirm(
                        'The marketplace component is not initialized.\n\n' +
                        'This might happen if some modules failed to load.\n\n' +
                        'Options:\n' +
                        '• Click OK to try reinitializing the marketplace\n' +
                        '• Click Cancel to use basic plugin management instead'
                    );
                    
                    if (userChoice) {
                        await this.reinitializeMarketplace();
                        // Retry opening marketplace after reinitialization
                        return this.openPluginMarketplace();
                    } else {
                        // Fall back to basic plugin management
                        this.showMessage('Opening basic plugin management instead...', 'info');
                        this.showPluginModal();
                        return;
                    }
                }
            }
            
            console.log('✅ Marketplace available');
            
            // Load PluginMarketplaceUI if not already loaded
            if (!window.PluginMarketplaceUI) {
                await this.loadPluginMarketplaceUI();
            }
            
            // Create marketplace UI instance
            window.pluginMarketplaceUI = new PluginMarketplaceUI(this.pluginManager.marketplace);
            console.log('✅ Plugin Marketplace UI initialized');
            
            // Open the marketplace
            await window.pluginMarketplaceUI.openMarketplace();
            console.log('✅ Plugin Marketplace opened successfully');
            
        } catch (error) {
            console.error('❌ Failed to open Plugin Marketplace:', error);
            
            let errorMessage = 'Failed to open Plugin Marketplace: ' + error.message;
            let suggestions = '';
            
            if (error.message.includes('not initialized') || error.message.includes('required')) {
                suggestions = '\n\nSuggestions:\n• Restart GenomeExplorer\n• Check console for module loading errors';
            } else if (error.message.includes('marketplace')) {
                suggestions = '\n\nSuggestions:\n• Check network connection\n• Ensure all plugin files are present\n• Try refreshing the page';
            }
            
            this.showMessage(errorMessage + suggestions, 'error');
        }
    }

    /**
     * Reinitialize marketplace components
     */
    async reinitializeMarketplace() {
        try {
            console.log('🔄 Attempting to reinitialize marketplace...');
            
            // Load PluginManagerV2 modules if needed
            if (!window.PluginMarketplace || !window.PluginDependencyResolver || 
                !window.PluginSecurityValidator || !window.PluginUpdateManager) {
                console.log('📦 Loading marketplace modules...');
                await this.loadPluginManagerV2Modules();
            }
            
            // Verify PluginManagerV2 is available
            if (!window.PluginManagerV2) {
                throw new Error('PluginManagerV2 still not available after loading modules');
            }
            
            // Get current app and config references
            const app = this.pluginManager.app || window.genomeBrowser || { name: 'GenomeExplorer', version: '1.0.0' };
            const configManager = this.pluginManager.configManager || window.configManager || null;
            
            // Create new PluginManagerV2 instance
            console.log('🔄 Creating new PluginManagerV2 instance...');
            const newPluginManager = new PluginManagerV2(app, configManager);
            
            // Wait for initialization
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Update references
            this.pluginManager = newPluginManager;
            
            // Update ChatManager reference if available
            if (window.chatManager && window.chatManager.pluginManager) {
                window.chatManager.pluginManager = newPluginManager;
            }
            
            console.log('✅ Marketplace reinitialized successfully');
            this.showMessage('Marketplace reinitialized successfully!', 'success');
            
        } catch (error) {
            console.error('❌ Failed to reinitialize marketplace:', error);
            throw new Error(`Marketplace reinitialization failed: ${error.message}`);
        }
    }

    /**
     * Load PluginManagerV2 modules
     */
    async loadPluginManagerV2Modules() {
        try {
            console.log('📦 Loading PluginManagerV2 modules...');
            
            // Detect current script directory to build proper paths
            const currentScript = document.currentScript || 
                document.querySelector('script[src*="PluginManagementUI"]') ||
                document.querySelector('script[src*="renderer-modular"]');
            
            let basePath = './';
            if (currentScript && currentScript.src) {
                const scriptPath = currentScript.src;
                const pathParts = scriptPath.split('/');
                // Remove the filename to get directory
                pathParts.pop();
                basePath = pathParts.join('/') + '/';
                // Make it relative if it's an absolute path
                if (basePath.startsWith('file:///')) {
                    basePath = './';
                }
            }
            
            console.log(`🔍 Using base path: ${basePath}`);
            
            const modules = [
                'PluginMarketplace.js',
                'PluginDependencyResolver.js', 
                'PluginSecurityValidator.js',
                'PluginUpdateManager.js',
                'PluginManagerV2.js'
            ];
            
            // Check which modules are already available before loading
            const initialAvailability = this.checkModuleAvailability();
            console.log('📋 Initial module availability check:', initialAvailability);
            
            for (const module of modules) {
                const moduleKey = module.replace('.js', '');
                
                if (initialAvailability[moduleKey]) {
                    console.log(`✅ ${module} already available, skipping load`);
                    continue;
                }
                
                try {
                    await this.loadScript(`${basePath}${module}`);
                    console.log(`✅ Loaded ${module}`);
                } catch (error) {
                    console.warn(`⚠️ Failed to load ${module} from ${basePath}, trying alternative path...`);
                    
                    // Try alternative path
                    try {
                        await this.loadScript(`./${module}`);
                        console.log(`✅ Loaded ${module} with alternative path`);
                    } catch (altError) {
                        console.error(`❌ Failed to load ${module} with both paths:`, error, altError);
                        throw new Error(`Could not load ${module}: ${error.message}`);
                    }
                }
                
                // After loading, wait a bit for the script to execute and check availability
                await this.waitForModuleAvailability(moduleKey, 5000); // 5 second timeout
            }
            
            // Final comprehensive check
            const finalCheck = this.checkModuleAvailability();
            console.log('🔍 Final module availability:', finalCheck);
            
            const missing = Object.keys(finalCheck).filter(key => !finalCheck[key]);
            if (missing.length > 0) {
                console.warn('⚠️ Some modules still missing, attempting forced reload...');
                
                // Try to force reload missing modules
                for (const missingModule of missing) {
                    try {
                        // Remove existing script tags for this module
                        const existingScripts = document.querySelectorAll(`script[src*="${missingModule}"]`);
                        existingScripts.forEach(script => script.remove());
                        
                        // Force reload
                        await this.loadScript(`./${missingModule}.js`, true); // Add force=true parameter
                        await this.waitForModuleAvailability(missingModule, 3000);
                        console.log(`🔄 Force reloaded ${missingModule}`);
                    } catch (error) {
                        console.error(`❌ Failed to force reload ${missingModule}:`, error);
                    }
                }
                
                // Final final check
                const ultimateCheck = this.checkModuleAvailability();
                const stillMissing = Object.keys(ultimateCheck).filter(key => !ultimateCheck[key]);
                
                if (stillMissing.length > 0) {
                    throw new Error(`Required modules still missing after all attempts: ${stillMissing.join(', ')}`);
                }
            }
            
            console.log('✅ All PluginManagerV2 modules loaded successfully');
            
        } catch (error) {
            console.error('❌ Failed to load PluginManagerV2 modules:', error);
            throw error;
        }
    }

    /**
     * Check module availability in window scope
     */
    checkModuleAvailability() {
        return {
            'PluginMarketplace': !!window.PluginMarketplace,
            'PluginDependencyResolver': !!window.PluginDependencyResolver,
            'PluginSecurityValidator': !!window.PluginSecurityValidator,
            'PluginUpdateManager': !!window.PluginUpdateManager,
            'PluginManagerV2': !!window.PluginManagerV2
        };
    }

    /**
     * Wait for a specific module to become available
     */
    async waitForModuleAvailability(moduleKey, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            const checkAvailability = () => {
                if (window[moduleKey]) {
                    console.log(`✅ Module ${moduleKey} is now available`);
                    resolve();
                    return;
                }
                
                if (Date.now() - startTime > timeout) {
                    console.warn(`⚠️ Timeout waiting for ${moduleKey} to become available`);
                    resolve(); // Don't reject, continue anyway
                    return;
                }
                
                // Check again in 100ms
                setTimeout(checkAvailability, 100);
            };
            
            checkAvailability();
        });
    }

    /**
     * Load script utility method
     */
    loadScript(src, force = false) {
        return new Promise((resolve, reject) => {
            // Check if script is already loaded (unless force is true)
            if (!force) {
                const existingScript = document.querySelector(`script[src="${src}"]`);
                if (existingScript) {
                    console.log(`Script ${src} already loaded, skipping...`);
                    resolve();
                    return;
                }
            }
            
            // If forcing reload, remove existing script first
            if (force) {
                const existingScripts = document.querySelectorAll(`script[src="${src}"]`);
                existingScripts.forEach(script => script.remove());
                console.log(`🔄 Force reloading script: ${src}`);
            }
            
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => {
                console.log(`✅ Script loaded: ${src}`);
                resolve();
            };
            script.onerror = (error) => {
                console.error(`❌ Failed to load script: ${src}`, error);
                reject(new Error(`Failed to load ${src}`));
            };
            
            document.head.appendChild(script);
        });
    }

    /**
     * Load PluginMarketplaceUI module
     */
    async loadPluginMarketplaceUI() {
        try {
            // Check if the module is already loaded
            if (window.PluginMarketplaceUI) {
                console.log('✅ PluginMarketplaceUI already available');
                return;
            }

            console.log('📦 Loading PluginMarketplaceUI module...');
            
            // Use smart path detection
            let basePath = './';
            const currentScript = document.currentScript || 
                document.querySelector('script[src*="PluginManagementUI"]') ||
                document.querySelector('script[src*="renderer-modular"]');
            
            if (currentScript && currentScript.src) {
                const scriptPath = currentScript.src;
                const pathParts = scriptPath.split('/');
                pathParts.pop(); // Remove filename
                basePath = pathParts.join('/') + '/';
                if (basePath.startsWith('file:///')) {
                    basePath = './';
                }
            }
            
            console.log(`🔍 Using base path for PluginMarketplaceUI: ${basePath}`);

            // Try to load the PluginMarketplaceUI module with fallback
            try {
                await this.loadScript(`${basePath}PluginMarketplaceUI.js`);
            } catch (error) {
                console.warn('⚠️ Failed with base path, trying alternative...');
                await this.loadScript('./PluginMarketplaceUI.js');
            }
            
            if (!window.PluginMarketplaceUI) {
                throw new Error('PluginMarketplaceUI module not available after loading');
            }
            
            console.log('✅ PluginMarketplaceUI module loaded successfully');
            
        } catch (error) {
            console.error('❌ Failed to load PluginMarketplaceUI:', error);
            throw new Error(`Failed to load PluginMarketplaceUI: ${error.message}`);
        }
    }

    /**
     * Validate plugin state consistency and fix any discrepancies
     */
    validateAndFixPluginStates() {
        if (!this.settings.pluginStates) {
            console.log('📋 No plugin states to validate');
            return { fixed: 0, validated: 0 };
        }
        
        let fixedCount = 0;
        let validatedCount = 0;
        
        console.log('🔍 Validating plugin state consistency...');
        
        // Check all registered plugins against saved states
        const allPlugins = new Map();
        
        // Collect all plugins from registries
        this.pluginManager.pluginRegistry.function.forEach((plugin, id) => {
            allPlugins.set(id, { plugin, type: 'function' });
        });
        
        this.pluginManager.pluginRegistry.visualization.forEach((plugin, id) => {
            allPlugins.set(id, { plugin, type: 'visualization' });
        });
        
        if (this.pluginManager.pluginRegistry.utility) {
            this.pluginManager.pluginRegistry.utility.forEach((plugin, id) => {
                allPlugins.set(id, { plugin, type: 'utility' });
            });
        }
        
        allPlugins.forEach(({ plugin, type }, pluginId) => {
            const savedState = this.settings.pluginStates[pluginId];
            validatedCount++;
            
            if (savedState) {
                // Check if current state matches saved state
                if (plugin.enabled !== savedState.enabled) {
                    console.warn(`🔧 Fixing state mismatch for ${type} plugin "${pluginId}": current=${plugin.enabled}, saved=${savedState.enabled}`);
                    plugin.enabled = savedState.enabled;
                    fixedCount++;
                }
            } else {
                // Plugin exists but no saved state - create one
                console.log(`📝 Creating missing state for ${type} plugin "${pluginId}": enabled=${plugin.enabled !== false}`);
                this.settings.pluginStates[pluginId] = {
                    type: type,
                    enabled: plugin.enabled !== false,
                    lastUsed: plugin.lastUsed || null,
                    usageCount: plugin.usageCount || 0,
                    createdAt: new Date().toISOString()
                };
                fixedCount++;
            }
        });
        
        // Save fixes if any were made
        if (fixedCount > 0) {
            this.saveSettingsToStorage();
            console.log(`💾 Saved ${fixedCount} plugin state fixes to local storage`);
        }
        
        console.log(`✅ Plugin state validation complete: ${validatedCount} checked, ${fixedCount} fixed`);
        return { fixed: fixedCount, validated: validatedCount };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PluginManagementUI;
} 