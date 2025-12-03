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
        
        console.log('🎨 PluginMarketplaceUI initialized (using ModalDragManager for drag functionality)');
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
        // Add draggable styles to head if not present
        this.addMarketplaceStyles();
        
        const marketplaceWindow = document.createElement('div');
        marketplaceWindow.id = 'plugin-marketplace-window';
        marketplaceWindow.className = 'marketplace-modal';
        marketplaceWindow.innerHTML = `
            <div class="modal-content draggable" id="marketplace-modal-content">
                <div class="modal-header draggable-handle" id="marketplace-header">
                    <div class="header-content">
                        <div class="header-left">
                            <span class="drag-indicator">⋮⋮</span>
                            <h2>🛒 Plugin Marketplace</h2>
                        </div>
                        <div class="header-controls">
                            <button onclick="pluginMarketplaceUI.showConfiguration()" 
                                    class="header-btn" title="Marketplace Configuration">⚙️</button>
                            <button onclick="pluginMarketplaceUI.showSubmissionDialog()" 
                                    class="header-btn" title="Submit Plugin">📤</button>
                            <button onclick="pluginMarketplaceUI.resetPosition()" 
                                    class="header-btn" title="Reset Position">🔄</button>
                            <button onclick="pluginMarketplaceUI.closeMarketplace()" 
                                    class="modal-close header-btn close-btn">×</button>
                        </div>
                    </div>
                </div>
                <div class="modal-body marketplace-body">
                    <div id="marketplace-content">
                        <div class="marketplace-controls">
                            <h3>Available Plugins</h3>
                            <div class="search-controls">
                                <input type="text" id="plugin-search" placeholder="Search plugins..." 
                                       class="search-input">
                                <button onclick="pluginMarketplaceUI.searchPlugins()" 
                                        class="control-btn primary">🔍 Search</button>
                                <button onclick="pluginMarketplaceUI.clearSearch()" 
                                        class="control-btn secondary" id="clear-search-btn" style="display: none;">✕ Clear</button>
                                <button onclick="pluginMarketplaceUI.refreshPlugins()" 
                                        class="control-btn secondary">🔄 Refresh</button>
                            </div>
                        </div>
                        <div id="plugin-list" class="plugin-list"></div>
                    </div>
                </div>
                <div class="marketplace-footer">
                    <span id="marketplace-status" class="status-text">Ready</span>
                    <div class="connection-info">
                        <span class="port-info">Port: ${this.config?.getSettings()?.defaultPort || 3001}</span>
                        <span id="connection-status" class="connection-status">🔴 Disconnected</span>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(marketplaceWindow);
        
        // Setup draggable functionality using ModalDragManager
        this.setupDraggable();
        
        // Setup search input event listeners
        this.setupSearchInput();
        
        this.loadPluginList();
        this.checkConnectionStatus();
    }

    /**
     * Add marketplace-specific styles
     */
    addMarketplaceStyles() {
        if (document.getElementById('marketplace-draggable-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'marketplace-draggable-styles';
        styles.textContent = `
            /* Marketplace Modal Styles */
            .marketplace-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            /* Use standard modal-content class for consistency with ModalDragManager */
            #marketplace-modal-content {
                background: white;
                border-radius: 12px;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
                width: 1000px;
                height: 700px;
                max-width: 95vw;
                max-height: 95vh;
                display: flex;
                flex-direction: column;
            }

            #marketplace-modal-content.dragging {
                box-shadow: 0 15px 50px rgba(0, 0, 0, 0.3);
                z-index: 10001;
            }

            #marketplace-header {
                background: linear-gradient(135deg, #4CAF50, #45a049);
                color: white;
                border-radius: 12px 12px 0 0;
                padding: 0 !important;
                cursor: move;
                user-select: none;
                position: relative;
                border-bottom: none !important;
            }

            #marketplace-header:hover {
                background: linear-gradient(135deg, #45a049, #3d8b40);
            }

            .header-content {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px 20px;
                width: 100%;
            }

            .header-left {
                display: flex;
                align-items: center;
                gap: 12px;
            }

            #marketplace-header .drag-indicator {
                font-size: 14px;
                opacity: 0.7;
                transition: opacity 0.2s ease;
            }

            #marketplace-header:hover .drag-indicator {
                opacity: 1;
            }

            .header-left h2 {
                margin: 0;
                font-size: 18px;
                font-weight: 600;
                white-space: nowrap;
            }

            .header-controls {
                display: flex;
                gap: 8px;
                align-items: center;
                flex-shrink: 0;
            }

            .header-btn {
                background: rgba(255, 255, 255, 0.2);
                border: none;
                color: white;
                padding: 8px 12px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                min-width: 36px;
                height: 36px;
            }

            .header-btn:hover {
                background: rgba(255, 255, 255, 0.3);
                transform: translateY(-1px);
            }

            .header-btn.close-btn {
                background: rgba(244, 67, 54, 0.8);
                font-size: 18px;
                font-weight: bold;
            }

            .header-btn.close-btn:hover {
                background: rgba(244, 67, 54, 1);
            }

            .marketplace-body {
                padding: 20px;
                flex: 1;
                overflow-y: auto;
                min-height: 0;
            }

            .marketplace-controls {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                padding-bottom: 15px;
                border-bottom: 2px solid #f0f0f0;
            }

            .marketplace-controls h3 {
                margin: 0;
                color: #333;
                font-size: 20px;
                font-weight: 600;
            }

            .search-controls {
                display: flex;
                gap: 10px;
                align-items: center;
            }

            .search-input {
                padding: 10px 15px;
                border: 2px solid #ddd;
                border-radius: 8px;
                font-size: 14px;
                width: 250px;
                transition: border-color 0.2s ease;
            }

            .search-input:focus {
                outline: none;
                border-color: #4CAF50;
                box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.1);
            }

            .control-btn {
                padding: 10px 20px;
                border: none;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                min-width: 80px;
            }

            .control-btn.primary {
                background: #4CAF50;
                color: white;
            }

            .control-btn.primary:hover {
                background: #45a049;
                transform: translateY(-1px);
            }

            .control-btn.secondary {
                background: #2196F3;
                color: white;
            }

            .control-btn.secondary:hover {
                background: #1976D2;
                transform: translateY(-1px);
            }

            .plugin-list {
                max-height: calc(100% - 80px);
                overflow-y: auto;
            }

            .marketplace-footer {
                background: #f8f9fa;
                padding: 15px 20px;
                border-top: 1px solid #ddd;
                border-radius: 0 0 12px 12px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-shrink: 0;
            }

            .status-text {
                font-weight: 500;
                color: #333;
            }

            .connection-info {
                display: flex;
                gap: 15px;
                align-items: center;
                font-size: 13px;
            }

            .port-info {
                color: #666;
            }

            .connection-status {
                font-weight: 500;
            }

            /* Scrollbar styling */
            .marketplace-body::-webkit-scrollbar,
            .plugin-list::-webkit-scrollbar {
                width: 8px;
            }

            .marketplace-body::-webkit-scrollbar-track,
            .plugin-list::-webkit-scrollbar-track {
                background: #f1f1f1;
                border-radius: 4px;
            }

            .marketplace-body::-webkit-scrollbar-thumb,
            .plugin-list::-webkit-scrollbar-thumb {
                background: #c1c1c1;
                border-radius: 4px;
            }

            .marketplace-body::-webkit-scrollbar-thumb:hover,
            .plugin-list::-webkit-scrollbar-thumb:hover {
                background: #a8a8a8;
            }
        `;
        
        document.head.appendChild(styles);
    }

    /**
     * Setup draggable functionality for the marketplace window using ModalDragManager
     */
    setupDraggable() {
        // Use the global ModalDragManager if available
        if (window.modalDragManager) {
            // Set the data-modal-content attribute on the header for ModalDragManager
            const header = document.getElementById('marketplace-header');
            if (header) {
                header.setAttribute('data-modal-content', '#plugin-marketplace-window');
            }
            
            // Make the marketplace draggable
            window.modalDragManager.makeDraggable('#plugin-marketplace-window');
            console.log('✅ Plugin Marketplace made draggable using ModalDragManager');
        } else {
            console.warn('⚠️ ModalDragManager not available, marketplace will not be draggable');
        }
    }

    /**
     * Setup search input event listeners for Enter key and real-time feedback
     */
    setupSearchInput() {
        const searchInput = document.getElementById('plugin-search');
        if (!searchInput) return;

        // Handle Enter key press
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.searchPlugins();
            }
        });

        // Optional: Real-time search as user types (debounced)
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const value = e.target.value.trim();
            
            // Show/hide clear button based on input
            const clearBtn = document.getElementById('clear-search-btn');
            if (clearBtn) {
                clearBtn.style.display = value ? 'inline-block' : 'none';
            }

            // Debounced search (optional - can be removed if too aggressive)
            // searchTimeout = setTimeout(() => {
            //     if (value !== this.searchQuery) {
            //         this.searchPlugins();
            //     }
            // }, 500);
        });

        console.log('✅ Search input event listeners attached');
    }

    /**
     * Reset marketplace window position to center
     */
    resetPosition() {
        if (window.modalDragManager) {
            window.modalDragManager.resetPosition('#plugin-marketplace-window');
            console.log('🔄 Plugin Marketplace position reset to center');
        }
    }

    async loadPluginList() {
        const pluginList = document.getElementById('plugin-list');
        if (!pluginList) return;

        try {
            const statusElement = document.getElementById('marketplace-status');
            
            // Show loading state with search context
            if (this.searchQuery) {
                statusElement.textContent = `Searching for "${this.searchQuery}"...`;
            } else {
                statusElement.textContent = 'Loading plugins...';
            }
            
            // Use the search query set by searchPlugins() method
            const searchQuery = this.searchQuery || '';
            const plugins = await this.marketplace.searchPlugins(searchQuery, this.filters);
            
            console.log(`📄 Loaded ${plugins.length} plugins${searchQuery ? ` for query: "${searchQuery}"` : ''}`);
            
            if (plugins.length === 0) {
                const noResultsMessage = searchQuery ? 
                    `No plugins found for "${searchQuery}"` : 
                    'No plugins available';
                    
                pluginList.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: #666;">
                        <div style="font-size: 48px; margin-bottom: 20px;">📎</div>
                        <h3>${noResultsMessage}</h3>
                        <p>${searchQuery ? 
                            'Try a different search term or clear the search to see all plugins.' : 
                            'Check your marketplace server connection or submit the first plugin!'}</p>
                        ${searchQuery ? 
                            `<button onclick="pluginMarketplaceUI.clearSearch()" 
                                    style="background: #2196F3; color: white; border: none; 
                                           padding: 10px 20px; border-radius: 4px; cursor: pointer; margin-top: 10px; margin-right: 10px;">
                                Clear Search
                            </button>` : ''}
                        <button onclick="pluginMarketplaceUI.showSubmissionDialog()" 
                                style="background: #4CAF50; color: white; border: none; 
                                       padding: 10px 20px; border-radius: 4px; cursor: pointer; margin-top: 10px;">
                            Submit ${searchQuery ? 'Plugin' : 'First Plugin'}
                        </button>
                    </div>
                `;
                statusElement.textContent = searchQuery ? `No results for "${searchQuery}"` : 'No plugins available';
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

    /**
     * Execute search based on search input
     */
    async searchPlugins() {
        const searchInput = document.getElementById('plugin-search');
        if (searchInput) {
            const newQuery = searchInput.value.trim();
            
            // Only reload if query actually changed
            if (newQuery !== this.searchQuery) {
                this.searchQuery = newQuery;
                console.log(`🔍 Searching for: "${this.searchQuery || '(all plugins)'}"`);
                
                // Show/hide clear button
                const clearBtn = document.getElementById('clear-search-btn');
                if (clearBtn) {
                    clearBtn.style.display = this.searchQuery ? 'inline-block' : 'none';
                }
                
                await this.loadPluginList();
            } else {
                console.log('🔍 Search query unchanged, skipping reload');
            }
        }
    }

    /**
     * Clear search and show all plugins
     */
    async clearSearch() {
        console.log('✖️ Clearing search query');
        
        const searchInput = document.getElementById('plugin-search');
        if (searchInput) {
            searchInput.value = '';
        }
        
        this.searchQuery = '';
        
        // Hide clear button
        const clearBtn = document.getElementById('clear-search-btn');
        if (clearBtn) {
            clearBtn.style.display = 'none';
        }
        
        await this.loadPluginList();
    }

    /**
     * Refresh plugin list (clears cache and reloads)
     */
    async refreshPlugins() {
        console.log('🔄 Refreshing plugin list (clearing cache)...');
        
        // Clear search cache in marketplace
        if (this.marketplace && this.marketplace.searchCache) {
            this.marketplace.searchCache.clear();
            console.log('✅ Search cache cleared');
        }
        
        // Reload the current view (with or without search query)
        await this.loadPluginList();
        await this.checkConnectionStatus();
        
        console.log('✅ Plugin list refreshed');
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
            window.style.zIndex = '10000';
            // Add a subtle animation to indicate focus
            const content = window.querySelector('.marketplace-content');
            if (content) {
                content.style.animation = 'marketplace-focus 0.3s ease';
                setTimeout(() => {
                    content.style.animation = '';
                }, 300);
            }
        }
    }
}

if (typeof window !== 'undefined') {
    window.PluginMarketplaceUI = PluginMarketplaceUI;
} 