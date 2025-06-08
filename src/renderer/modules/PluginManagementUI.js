/**
 * PluginManagementUI - User interface for managing plugins in GenomeExplorer
 * Provides functionality to view, install, configure, and manage plugins
 */
class PluginManagementUI {
    constructor(pluginManager, configManager) {
        this.pluginManager = pluginManager;
        this.configManager = configManager;
        
        // UI state
        this.currentTab = 'installed';
        this.selectedPlugin = null;
        
        // Initialize UI
        this.initializeUI();
        
        console.log('PluginManagementUI initialized');
    }

    /**
     * Initialize the plugin management UI
     */
    initializeUI() {
        // Setup modal and tab switching
        this.setupModalHandlers();
        this.setupTabHandlers();
        this.setupPluginActions();
        
        // Load initial data
        this.refreshPluginLists();
    }

    /**
     * Setup modal event handlers
     */
    setupModalHandlers() {
        const pluginManagerBtn = document.getElementById('pluginManagerBtn');
        const pluginModal = document.getElementById('pluginManagementModal');
        
        if (pluginManagerBtn) {
            pluginManagerBtn.addEventListener('click', () => {
                this.showPluginModal();
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
     * Setup plugin action handlers
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
     * Switch between tabs
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

        // Load tab-specific data
        if (tabName === 'installed') {
            this.refreshPluginLists();
        } else if (tabName === 'available') {
            this.loadAvailablePlugins();
        } else if (tabName === 'settings') {
            this.loadPluginSettings();
        }
    }

    /**
     * Refresh the plugin lists
     */
    refreshPluginLists() {
        this.refreshFunctionPlugins();
        this.refreshVisualizationPlugins();
    }

    /**
     * Refresh function plugins list
     */
    refreshFunctionPlugins() {
        const container = document.getElementById('functionPluginsList');
        if (!container) return;

        container.innerHTML = '';

        const functionPlugins = this.pluginManager.functionPlugins;
        
        if (functionPlugins.size === 0) {
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

        const visualizationPlugins = this.pluginManager.visualizationPlugins;
        
        if (visualizationPlugins.size === 0) {
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
        const plugin = type === 'function' ? 
            this.pluginManager.functionPlugins.get(pluginId) :
            this.pluginManager.visualizationPlugins.get(pluginId);

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
     * Toggle plugin enabled/disabled state
     */
    togglePlugin(pluginId, type) {
        const plugin = type === 'function' ? 
            this.pluginManager.functionPlugins.get(pluginId) :
            this.pluginManager.visualizationPlugins.get(pluginId);

        if (!plugin) return;

        // Toggle enabled state
        plugin.enabled = !plugin.enabled;

        // Update UI
        this.refreshPluginLists();

        // Show feedback
        const action = plugin.enabled ? 'enabled' : 'disabled';
        this.showMessage(`Plugin "${plugin.name}" has been ${action}`, 'info');
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
     * Load plugin settings
     */
    loadPluginSettings() {
        // Load current settings
        const pluginDirectory = document.getElementById('pluginDirectory');
        const enableSandbox = document.getElementById('enablePluginSandbox');
        const enableDebug = document.getElementById('enablePluginDebug');

        if (pluginDirectory) {
            pluginDirectory.value = this.configManager?.get('pluginDirectory') || 'src/renderer/modules/Plugins';
        }

        if (enableSandbox) {
            enableSandbox.checked = this.configManager?.get('enablePluginSandbox') !== false;
        }

        if (enableDebug) {
            enableDebug.checked = this.configManager?.get('enablePluginDebug') === true;
        }
    }

    /**
     * Save plugin settings
     */
    savePluginSettings() {
        try {
            const pluginDirectory = document.getElementById('pluginDirectory').value;
            const enableSandbox = document.getElementById('enablePluginSandbox').checked;
            const enableDebug = document.getElementById('enablePluginDebug').checked;

            // Save settings
            if (this.configManager) {
                this.configManager.set('pluginDirectory', pluginDirectory);
                this.configManager.set('enablePluginSandbox', enableSandbox);
                this.configManager.set('enablePluginDebug', enableDebug);
            }

            this.showMessage('Plugin settings saved successfully!', 'success');

        } catch (error) {
            this.showMessage(`Error saving settings: ${error.message}`, 'error');
        }
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
     * Get plugin statistics
     */
    getPluginStatistics() {
        const functionPlugins = this.pluginManager.functionPlugins.size;
        const visualizationPlugins = this.pluginManager.visualizationPlugins.size;
        const totalFunctions = Array.from(this.pluginManager.functionPlugins.values())
            .reduce((total, plugin) => total + Object.keys(plugin.functions || {}).length, 0);

        return {
            functionPlugins,
            visualizationPlugins,
            totalPlugins: functionPlugins + visualizationPlugins,
            totalFunctions
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PluginManagementUI;
} 