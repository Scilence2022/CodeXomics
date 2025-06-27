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
        
        console.log('🎨 PluginMarketplaceUI initialized');
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
                    <button onclick="pluginMarketplaceUI.closeMarketplace()" 
                            style="float: right; background: rgba(255,255,255,0.2); 
                                   border: none; color: white; padding: 5px 10px; 
                                   border-radius: 4px; cursor: pointer;">×</button>
                </div>
                <div style="padding: 20px; height: calc(100% - 120px); overflow-y: auto;">
                    <div id="marketplace-content">
                        <h3>Available Plugins</h3>
                        <div id="plugin-list"></div>
                    </div>
                </div>
                <div style="background: #f8f9fa; padding: 10px; border-top: 1px solid #ddd; 
                           border-radius: 0 0 8px 8px;">
                    <span id="marketplace-status">Ready</span>
                </div>
            </div>
        `;
        
        document.body.appendChild(marketplaceWindow);
        this.loadPluginList();
    }

    async loadPluginList() {
        const pluginList = document.getElementById('plugin-list');
        if (!pluginList) return;

        try {
            const plugins = await this.marketplace.searchPlugins('', {});
            
            if (plugins.length === 0) {
                pluginList.innerHTML = '<p>No plugins available</p>';
                return;
            }

            const pluginCards = plugins.map(plugin => `
                <div style="border: 1px solid #ddd; border-radius: 6px; padding: 15px; 
                           margin-bottom: 15px; background: #f9f9f9;">
                    <h4 style="margin: 0 0 10px 0;">${plugin.name} v${plugin.version}</h4>
                    <p style="margin: 0 0 10px 0; color: #666;">${plugin.description}</p>
                    <button onclick="pluginMarketplaceUI.installPlugin('${plugin.id}')"
                            style="background: #4CAF50; color: white; border: none; 
                                   padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                        Install
                    </button>
                </div>
            `).join('');

            pluginList.innerHTML = pluginCards;
        } catch (error) {
            pluginList.innerHTML = `<p style="color: red;">Error loading plugins: ${error.message}</p>`;
        }
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