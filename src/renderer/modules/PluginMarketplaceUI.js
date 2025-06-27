/**
 * PluginMarketplaceUI - User interface for the plugin marketplace
 * Provides a comprehensive interface for browsing, installing, and managing plugins
 */
class PluginMarketplaceUI {
    constructor(marketplace) {
        this.marketplace = marketplace;
        this.isOpen = false;
        this.currentView = 'browse'; // browse, installed, updates, search
        this.searchQuery = '';
        this.selectedCategory = 'all';
        this.selectedPlugin = null;
        
        // UI state
        this.filters = {
            category: 'all',
            type: 'all',
            rating: 0,
            source: 'all'
        };
        
        // Initialize configuration and submission components
        this.initializeComponents();
        
        console.log('🎨 PluginMarketplaceUI initialized');
    }

    initializeComponents() {
        // Initialize configuration manager
        if (typeof PluginMarketplaceConfig !== 'undefined') {
            this.config = new PluginMarketplaceConfig(this.marketplace?.configManager);
        }
        
        // Initialize submission UI
        if (typeof PluginSubmissionUI !== 'undefined') {
            this.submissionUI = new PluginSubmissionUI(this.config, this.marketplace?.pluginManager);
        }
    }

    /**
     * Open the plugin marketplace window
     */
    async openMarketplace() {
        if (this.isOpen) {
            this.focusMarketplaceWindow();
            return;
        }

        try {
            console.log('🛒 Opening Plugin Marketplace...');
            this.createMarketplaceWindow();
            this.isOpen = true;
        } catch (error) {
            console.error('❌ Failed to open Plugin Marketplace:', error);
            alert('Failed to open Plugin Marketplace: ' + error.message);
        }
    }

    /**
     * Create the marketplace window UI
     */
    createMarketplaceWindow() {
        const marketplaceWindow = document.createElement('div');
        marketplaceWindow.id = 'plugin-marketplace-window';
        marketplaceWindow.innerHTML = `
            <div style="position: fixed; top: 50px; left: 50px; width: 1000px; height: 700px; 
                        background: white; border: 1px solid #ccc; border-radius: 8px; 
                        box-shadow: 0 4px 20px rgba(0,0,0,0.15); z-index: 10000;">
                <div style="background: linear-gradient(135deg, #4CAF50, #45a049); 
                           color: white; padding: 15px; border-radius: 8px 8px 0 0;">
                    <h2 style="margin: 0; display: inline-block;">🛒 Plugin Marketplace</h2>
                    <div style="float: right; display: flex; gap: 10px; align-items: center;">
                        <button onclick="pluginMarketplaceUI.showConfiguration()" 
                                style="background: rgba(255,255,255,0.2); border: none; color: white; 
                                       padding: 8px 12px; border-radius: 4px; cursor: pointer;" 
                                title="Marketplace Configuration">⚙️</button>
                        <button onclick="pluginMarketplaceUI.showSubmissionDialog()" 
                                style="background: rgba(255,255,255,0.2); border: none; color: white; 
                                       padding: 8px 12px; border-radius: 4px; cursor: pointer;" 
                                title="Submit Plugin">📤</button>
                        <button onclick="pluginMarketplaceUI.closeMarketplace()" 
                                style="background: rgba(255,255,255,0.2); border: none; color: white; 
                                       padding: 5px 10px; border-radius: 4px; cursor: pointer;">×</button>
                    </div>
                </div>
                <div style="padding: 20px; height: calc(100% - 120px); overflow-y: auto;">
                    <div id="marketplace-content">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                            <h3>Available Plugins</h3>
                            <div style="display: flex; gap: 10px;">
                                <input type="text" id="plugin-search" placeholder="Search plugins..." 
                                       style="padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                                <button onclick="pluginMarketplaceUI.searchPlugins()" 
                                        style="background: #4CAF50; color: white; border: none; 
                                               padding: 8px 16px; border-radius: 4px; cursor: pointer;">Search</button>
                                <button onclick="pluginMarketplaceUI.refreshPlugins()" 
                                        style="background: #2196F3; color: white; border: none; 
                                               padding: 8px 16px; border-radius: 4px; cursor: pointer;">Refresh</button>
                            </div>
                        </div>
                        <div id="plugin-list"></div>
                    </div>
                </div>
                <div style="background: #f8f9fa; padding: 10px; border-top: 1px solid #ddd; 
                           border-radius: 0 0 8px 8px; display: flex; justify-content: space-between; align-items: center;">
                    <span id="marketplace-status">Ready</span>
                    <div style="display: flex; gap: 10px;">
                        <span style="color: #666; font-size: 12px;">Port: ${this.config?.getSettings()?.defaultPort || 3001}</span>
                        <span style="color: #666; font-size: 12px;" id="connection-status">🔴 Disconnected</span>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(marketplaceWindow);
        this.loadPluginList();
        this.checkConnectionStatus();
    }

    async loadPluginList() {
        const pluginList = document.getElementById('plugin-list');
        if (!pluginList) return;

        try {
            document.getElementById('marketplace-status').textContent = 'Loading plugins...';
            
            const plugins = await this.marketplace.searchPlugins('', {});
            
            if (plugins.length === 0) {
                pluginList.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: #666;">
                        <div style="font-size: 48px; margin-bottom: 20px;">📦</div>
                        <h3>No plugins available</h3>
                        <p>Check your marketplace server connection or submit the first plugin!</p>
                        <button onclick="pluginMarketplaceUI.showSubmissionDialog()" 
                                style="background: #4CAF50; color: white; border: none; 
                                       padding: 10px 20px; border-radius: 4px; cursor: pointer; margin-top: 10px;">
                            Submit First Plugin
                        </button>
                    </div>
                `;
                return;
            }

            const pluginCards = plugins.map(plugin => `
                <div style="border: 1px solid #ddd; border-radius: 6px; padding: 15px; 
                           margin-bottom: 15px; background: #f9f9f9;">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div style="flex: 1;">
                            <h4 style="margin: 0 0 5px 0;">${plugin.name} v${plugin.version}</h4>
                            <p style="margin: 0 0 5px 0; color: #666; font-size: 13px;">by ${plugin.author}</p>
                            <p style="margin: 0 0 10px 0; color: #333;">${plugin.description}</p>
                            <div style="display: flex; gap: 5px; margin-bottom: 10px;">
                                <span style="background: #e3f2fd; color: #1976d2; padding: 2px 8px; 
                                           border-radius: 12px; font-size: 11px;">${plugin.category}</span>
                                <span style="background: #f3e5f5; color: #7b1fa2; padding: 2px 8px; 
                                           border-radius: 12px; font-size: 11px;">${plugin.type}</span>
                                ${plugin.tags ? plugin.tags.slice(0, 2).map(tag => 
                                    `<span style="background: #e8f5e8; color: #2e7d32; padding: 2px 8px; 
                                                   border-radius: 12px; font-size: 11px;">${tag}</span>`
                                ).join('') : ''}
                            </div>
                            <div style="font-size: 12px; color: #666;">
                                Downloads: ${plugin.downloads || 0} | 
                                Rating: ${'★'.repeat(Math.floor(plugin.rating || 0))}${'☆'.repeat(5 - Math.floor(plugin.rating || 0))}
                                ${plugin.size ? ` | Size: ${this.formatFileSize(plugin.size)}` : ''}
                            </div>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 5px; margin-left: 15px;">
                            <button onclick="pluginMarketplaceUI.installPlugin('${plugin.id}')"
                                    style="background: #4CAF50; color: white; border: none; 
                                           padding: 8px 16px; border-radius: 4px; cursor: pointer; white-space: nowrap;">
                                Install
                            </button>
                            <button onclick="pluginMarketplaceUI.viewPluginDetails('${plugin.id}')"
                                    style="background: #2196F3; color: white; border: none; 
                                           padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                Details
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');

            pluginList.innerHTML = pluginCards;
            document.getElementById('marketplace-status').textContent = `${plugins.length} plugins loaded`;
        } catch (error) {
            pluginList.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #d32f2f;">
                    <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
                    <h3>Error loading plugins</h3>
                    <p>${error.message}</p>
                    <button onclick="pluginMarketplaceUI.showConfiguration()" 
                            style="background: #f57c00; color: white; border: none; 
                                   padding: 10px 20px; border-radius: 4px; cursor: pointer; margin-top: 10px;">
                        Check Configuration
                    </button>
                </div>
            `;
            document.getElementById('marketplace-status').textContent = 'Error loading plugins';
        }
    }

    async checkConnectionStatus() {
        const statusElement = document.getElementById('connection-status');
        if (!statusElement || !this.config) return;

        try {
            const sources = this.config.getEnabledSources();
            let connected = false;
            
            for (const source of sources) {
                const result = await this.config.testSource(source);
                if (result.success) {
                    connected = true;
                    break;
                }
            }
            
            statusElement.textContent = connected ? '🟢 Connected' : '🔴 Disconnected';
            statusElement.style.color = connected ? '#4CAF50' : '#f44336';
        } catch (error) {
            statusElement.textContent = '🔴 Error';
            statusElement.style.color = '#f44336';
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async searchPlugins() {
        const searchInput = document.getElementById('plugin-search');
        if (searchInput) {
            this.searchQuery = searchInput.value.trim();
            await this.loadPluginList();
        }
    }

    async refreshPlugins() {
        await this.loadPluginList();
        await this.checkConnectionStatus();
    }

    async installPlugin(pluginId) {
        try {
            document.getElementById('marketplace-status').textContent = `Installing ${pluginId}...`;
            
            const result = await this.marketplace.installPlugin(pluginId);
            
            if (result.success) {
                alert(`✅ Plugin ${pluginId} installed successfully!`);
                this.loadPluginList();
            }
        } catch (error) {
            alert(`❌ Failed to install ${pluginId}: ${error.message}`);
        } finally {
            document.getElementById('marketplace-status').textContent = 'Ready';
        }
    }

    viewPluginDetails(pluginId) {
        // TODO: Implement plugin details view
        alert(`Plugin details for ${pluginId} - Coming soon!`);
    }

    showConfiguration() {
        if (this.config) {
            this.config.showConfiguration();
        } else {
            alert('Configuration not available. Please ensure PluginMarketplaceConfig is loaded.');
        }
    }

    showSubmissionDialog() {
        if (this.submissionUI) {
            this.submissionUI.showSubmissionDialog();
        } else {
            alert('Submission feature not available. Please ensure PluginSubmissionUI is loaded.');
        }
    }

    /**
     * Close marketplace
     */
    closeMarketplace() {
        const window = document.getElementById('plugin-marketplace-window');
        if (window) {
            window.remove();
        }
        this.isOpen = false;
        console.log('🛒 Plugin Marketplace closed');
    }

    /**
     * Focus marketplace window if already open
     */
    focusMarketplaceWindow() {
        const window = document.getElementById('plugin-marketplace-window');
        if (window) {
            window.style.zIndex = '10001';
            setTimeout(() => window.style.zIndex = '10000', 100);
        }
    }
}

if (typeof window !== 'undefined') {
    window.PluginMarketplaceUI = PluginMarketplaceUI;
} 