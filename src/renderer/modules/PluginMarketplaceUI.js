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
            
            // Check for plugin updates when marketplace is opened
            if (this.marketplace && this.marketplace.updateManager) {
                console.log('🔍 Checking for plugin updates...');
                await this.marketplace.updateManager.checkForUpdates();
            }
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

            /* Pulse animation for update badge */
            @keyframes pulse {
                0%, 100% {
                    opacity: 1;
                    transform: scale(1);
                }
                50% {
                    opacity: 0.8;
                    transform: scale(1.05);
                }
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

            const pluginCards = plugins.map(plugin => {
                // Check if plugin is installed and get version info
                const installInfo = this.getPluginInstallInfo(plugin.id, plugin.version);
                const isInstalled = installInfo.isInstalled;
                const installedVersion = installInfo.version;
                const needsUpdate = installInfo.needsUpdate;
                const updateAvailable = needsUpdate && plugin.version;
                
                return `
                <div style="border: 1px solid ${isInstalled ? '#4CAF50' : '#ddd'}; border-radius: 6px; padding: 15px; 
                           margin-bottom: 15px; background: ${isInstalled ? '#f1f8f4' : '#f9f9f9'}; position: relative;">
                    ${isInstalled && needsUpdate ? `
                        <div style="position: absolute; top: 10px; right: 10px; display: flex; gap: 5px; align-items: center;">
                            <span style="background: #FF9800; color: white; padding: 3px 10px; 
                                       border-radius: 12px; font-size: 11px; font-weight: 600; animation: pulse 2s infinite;">
                                ⚡ UPDATE AVAILABLE
                            </span>
                        </div>
                    ` : ''}
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div style="flex: 1; ${isInstalled && needsUpdate ? 'padding-right: 140px;' : ''}">
                            <h4 style="margin: 0 0 5px 0;">
                                ${plugin.name} v${plugin.version}
                                ${isInstalled && installedVersion ? `
                                    <span style="color: #666; font-weight: normal; font-size: 12px;">
                                        (installed: v${installedVersion})
                                    </span>
                                ` : ''}
                            </h4>
                            <p style="margin: 0 0 5px 0; color: #666; font-size: 13px;">by ${plugin.author}</p>
                            <p style="margin: 0 0 10px 0; color: #333;">${plugin.description}</p>
                            <div style="display: flex; gap: 5px; margin-bottom: 10px; flex-wrap: wrap;">
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
                        <div style="display: flex; flex-direction: column; gap: 5px; margin-left: 15px; min-width: 120px;">
                            ${isInstalled && needsUpdate ? `
                                <button onclick="pluginMarketplaceUI.updatePlugin('${plugin.id}')"
                                        style="background: linear-gradient(135deg, #FF9800 0%, #F57C00 100%); 
                                               color: white; border: none; 
                                               padding: 10px 16px; border-radius: 6px; cursor: pointer; 
                                               white-space: nowrap; font-weight: 600; font-size: 13px;
                                               box-shadow: 0 2px 8px rgba(255, 152, 0, 0.3);
                                               transition: all 0.2s ease;"
                                        onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(255, 152, 0, 0.4)';"
                                        onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(255, 152, 0, 0.3)';">
                                    ⚡ Update to v${plugin.version}
                                </button>
                            ` : isInstalled ? `
                                <button style="background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); 
                                               color: white; border: none; 
                                               padding: 10px 16px; border-radius: 6px; cursor: default; 
                                               white-space: nowrap; font-weight: 600; font-size: 13px;
                                               box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
                                               display: flex; align-items: center; justify-content: center; gap: 6px;">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="white"/>
                                    </svg>
                                    Installed
                                </button>
                            ` : `
                                <button onclick="pluginMarketplaceUI.installPlugin('${plugin.id}')"
                                        style="background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); 
                                               color: white; border: none; 
                                               padding: 10px 16px; border-radius: 6px; cursor: pointer; 
                                               white-space: nowrap; font-weight: 600; font-size: 13px;
                                               box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
                                               transition: all 0.2s ease;"
                                        onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(76, 175, 80, 0.4)';"
                                        onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(76, 175, 80, 0.3)';">
                                    📥 Install
                                </button>
                            `}
                            <button onclick="pluginMarketplaceUI.viewPluginDetails('${plugin.id}')"
                                    style="background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%); 
                                           color: white; border: none; 
                                           padding: 8px 12px; border-radius: 6px; cursor: pointer; 
                                           font-size: 12px; font-weight: 500;
                                           box-shadow: 0 2px 6px rgba(33, 150, 243, 0.25);
                                           transition: all 0.2s ease;"
                                    onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 10px rgba(33, 150, 243, 0.35)';"
                                    onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 6px rgba(33, 150, 243, 0.25)';">
                                Details
                            </button>
                        </div>
                    </div>
                </div>
            `;
            }).join('');

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

    /**
     * Get plugin installation information
     * @param {string} pluginId - Plugin identifier  
     * @param {string} marketVersion - Marketplace version for comparison (optional)
     * @returns {Object} Installation info {isInstalled, version, needsUpdate}
     */
    getPluginInstallInfo(pluginId, marketVersion = null) {
        const result = {
            isInstalled: false,
            version: null,
            needsUpdate: false
        };

        if (!this.marketplace || !this.marketplace.pluginManager) {
            return result;
        }

        const pluginManager = this.marketplace.pluginManager;
        
        // Check in visualization registry
        let installedPlugin = pluginManager.pluginRegistry?.visualization?.get(pluginId);
        
        // Check in function registry if not found
        if (!installedPlugin) {
            installedPlugin = pluginManager.pluginRegistry?.function?.get(pluginId);
        }

        if (installedPlugin) {
            result.isInstalled = true;
            result.version = installedPlugin.version || '1.0.0';
            
            // Check if update is available
            if (marketVersion) {
                result.needsUpdate = this.compareVersions(result.version, marketVersion);
            }
        }

        return result;
    }

    /**
     * Compare versions to check if update is needed
     * @param {string} installedVersion - Currently installed version
     * @param {string} marketVersion - Available marketplace version
     * @returns {boolean} True if marketplace version is newer
     */
    compareVersions(installedVersion, marketVersion) {
        if (!installedVersion || !marketVersion) return false;

        const installed = installedVersion.split('.').map(Number);
        const market = marketVersion.split('.').map(Number);

        for (let i = 0; i < Math.max(installed.length, market.length); i++) {
            const installedPart = installed[i] || 0;
            const marketPart = market[i] || 0;

            if (marketPart > installedPart) return true;
            if (marketPart < installedPart) return false;
        }

        return false; // Versions are equal
    }

    /**
     * Update an installed plugin to the latest version
     */
    async updatePlugin(pluginId) {
        try {
            console.log(`🔄 Updating plugin: ${pluginId}`);
            document.getElementById('marketplace-status').textContent = `Updating ${pluginId}...`;
            
            // Uninstall current version first
            const uninstallResult = await this.marketplace.uninstallPlugin(pluginId);
            if (!uninstallResult.success) {
                throw new Error(uninstallResult.error || 'Failed to uninstall old version');
            }
            
            console.log(`✅ Old version uninstalled`);
            
            // Install new version
            const installResult = await this.marketplace.installPlugin(pluginId);
            
            if (installResult.success) {
                alert(`✅ Plugin ${pluginId} updated successfully to v${installResult.plugin?.version || 'latest'}!`);
                await this.loadPluginList(); // Refresh to show updated status
                console.log(`✅ Plugin ${pluginId} updated successfully`);
            } else {
                throw new Error(installResult.error || 'Installation failed');
            }
        } catch (error) {
            console.error(`❌ Failed to update plugin ${pluginId}:`, error);
            alert(`❌ Failed to update ${pluginId}: ${error.message}`);
        } finally {
            document.getElementById('marketplace-status').textContent = 'Ready';
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

    async viewPluginDetails(pluginId) {
        try {
            console.log(`📋 Fetching details for plugin: ${pluginId}`);
            
            let pluginData = null;
            let source = 'unknown';
            
            // PRIORITY 1: Check plugin manager registry FIRST (for installed plugins)
            // This is the most reliable source for installed plugins
            if (this.marketplace && this.marketplace.pluginManager) {
                const registry = this.marketplace.pluginManager.pluginRegistry;
                console.log('🔍 Checking plugin manager registry...', {
                    hasRegistry: !!registry,
                    hasVisualization: !!registry?.visualization,
                    hasFunction: !!registry?.function,
                    vizSize: registry?.visualization?.size || 0,
                    funcSize: registry?.function?.size || 0
                });
                
                if (registry) {
                    const vizPlugin = registry.visualization?.get(pluginId);
                    const funcPlugin = registry.function?.get(pluginId);
                    pluginData = vizPlugin || funcPlugin;
                    
                    if (pluginData) {
                        source = 'plugin-manager-registry';
                        console.log(`✅ Found plugin in ${vizPlugin ? 'visualization' : 'function'} registry:`, {
                            id: pluginData.id,
                            name: pluginData.name,
                            version: pluginData.version,
                            hasExecutor: !!pluginData.executor,
                            hasCommands: !!pluginData.contributes?.commands
                        });
                    }
                }
            }
            
            // PRIORITY 2: Check installed plugins map (marketplace's installed registry)
            if (!pluginData && this.marketplace && this.marketplace.installedPlugins) {
                console.log('🔍 Checking marketplace installed plugins...', {
                    hasInstalledPlugins: !!this.marketplace.installedPlugins,
                    installedCount: this.marketplace.installedPlugins?.size || 0,
                    installedIds: this.marketplace.installedPlugins ? Array.from(this.marketplace.installedPlugins.keys()) : []
                });
                
                if (this.marketplace.installedPlugins.has(pluginId)) {
                    const installed = this.marketplace.installedPlugins.get(pluginId);
                    pluginData = installed.manifest || installed;
                    source = 'marketplace-installed';
                    console.log('✅ Found plugin in marketplace installed registry:', pluginData);
                }
            }
            
            // PRIORITY 3: Search marketplace API (for available but not installed plugins)
            if (!pluginData && this.marketplace) {
                console.log('🔍 Searching marketplace API...');
                try {
                    const searchResults = await this.marketplace.searchPlugins(pluginId);
                    console.log('📡 Marketplace search results:', {
                        resultCount: searchResults?.length || 0,
                        results: searchResults
                    });
                    
                    if (searchResults && searchResults.length > 0) {
                        pluginData = searchResults.find(p => p.id === pluginId);
                        if (pluginData) {
                            source = 'marketplace-api';
                            console.log('✅ Found plugin via marketplace API:', pluginData);
                        }
                    }
                } catch (searchError) {
                    console.warn('⚠️ Marketplace API search failed:', searchError);
                }
            }
            
            // Final check: If still not found, log comprehensive debug info
            if (!pluginData) {
                console.error(`❌ Plugin ${pluginId} not found in any source`);
                console.error('🔍 Debug info:', {
                    hasMarketplace: !!this.marketplace,
                    hasPluginManager: !!this.marketplace?.pluginManager,
                    hasRegistry: !!this.marketplace?.pluginManager?.pluginRegistry,
                    vizPlugins: this.marketplace?.pluginManager?.pluginRegistry?.visualization ? 
                        Array.from(this.marketplace.pluginManager.pluginRegistry.visualization.keys()) : [],
                    funcPlugins: this.marketplace?.pluginManager?.pluginRegistry?.function ? 
                        Array.from(this.marketplace.pluginManager.pluginRegistry.function.keys()) : [],
                    installedPlugins: this.marketplace?.installedPlugins ? 
                        Array.from(this.marketplace.installedPlugins.keys()) : []
                });
                
                alert(`❌ Plugin "${pluginId}" not found

The plugin may not be properly registered. Debug info has been logged to console.

Try:
1. Refresh the plugin list
2. Restart the application
3. Check if the marketplace server is running`);
                return;
            }
            
            console.log(`✅ Plugin data loaded from: ${source}`);
            
            // Show details modal
            this.showPluginDetailsModal(pluginData);
            
        } catch (error) {
            console.error('❌ Failed to fetch plugin details:', error);
            console.error('❌ Error stack:', error.stack);
            alert(`Failed to load plugin details: ${error.message}\n\nPlease check the console for detailed error information.`);
        }
    }
    
    showPluginDetailsModal(plugin) {
        // Create modal backdrop
        const detailsModal = document.createElement('div');
        detailsModal.id = 'plugin-details-modal';
        detailsModal.className = 'details-modal-backdrop';
        
        // Extract command information
        const commands = this.extractCommandsInfo(plugin);
        const dataTypes = plugin.supportedDataTypes || [];
        const keywords = plugin.keywords || [];
        const tags = plugin.tags || [];
        
        // Build modal content
        detailsModal.innerHTML = `
            <div class="details-modal-content">
                <div class="details-header">
                    <h2>📦 ${plugin.name || plugin.id}</h2>
                    <button onclick="document.getElementById('plugin-details-modal').remove()" 
                            class="details-close-btn">×</button>
                </div>
                
                <div class="details-body">
                    <!-- Version & Author Section -->
                    <div class="details-section">
                        <h3>📌 Basic Information</h3>
                        <div class="info-grid">
                            <div class="info-item">
                                <span class="info-label">Version:</span>
                                <span class="info-value">${plugin.version || 'N/A'}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Author:</span>
                                <span class="info-value">${plugin.author || 'Unknown'}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Category:</span>
                                <span class="info-value badge category-badge">${plugin.category || 'general'}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Type:</span>
                                <span class="info-value badge type-badge">${plugin.type || 'unknown'}</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Description Section -->
                    <div class="details-section">
                        <h3>📝 Description</h3>
                        <p class="description-text">${plugin.description || 'No description available'}</p>
                    </div>
                    
                    <!-- Commands Section -->
                    ${commands.length > 0 ? `
                    <div class="details-section">
                        <h3>⚡ Available Commands (${commands.length})</h3>
                        <div class="commands-list">
                            ${commands.map(cmd => `
                                <div class="command-item">
                                    <div class="command-header">
                                        <code class="command-id">${cmd.command}</code>
                                        ${cmd.title ? `<span class="command-title">${cmd.title}</span>` : ''}
                                    </div>
                                    ${cmd.description ? `<p class="command-description">${cmd.description}</p>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}
                    
                    <!-- Supported Data Types Section -->
                    ${dataTypes.length > 0 ? `
                    <div class="details-section">
                        <h3>🗂️ Supported Data Types (${dataTypes.length})</h3>
                        <div class="tags-container">
                            ${dataTypes.map(type => `
                                <span class="tag datatype-tag">${type}</span>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}
                    
                    <!-- Keywords Section -->
                    ${keywords.length > 0 ? `
                    <div class="details-section">
                        <h3>🔍 Keywords (${keywords.length})</h3>
                        <div class="tags-container">
                            ${keywords.map(kw => `
                                <span class="tag keyword-tag">${kw}</span>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}
                    
                    <!-- Tags Section -->
                    ${tags.length > 0 ? `
                    <div class="details-section">
                        <h3>🏷️ Tags (${tags.length})</h3>
                        <div class="tags-container">
                            ${tags.map(tag => `
                                <span class="tag general-tag">${tag}</span>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}
                    
                    <!-- Dependencies Section -->
                    ${plugin.dependencies && plugin.dependencies.length > 0 ? `
                    <div class="details-section">
                        <h3>📦 Dependencies (${plugin.dependencies.length})</h3>
                        <ul class="dependencies-list">
                            ${plugin.dependencies.map(dep => `
                                <li><code>${typeof dep === 'string' ? dep : dep.id}</code></li>
                            `).join('')}
                        </ul>
                    </div>
                    ` : ''}
                    
                    <!-- Additional Metadata -->
                    <div class="details-section metadata-section">
                        <h3>ℹ️ Additional Information</h3>
                        <div class="info-grid">
                            ${plugin.homepage ? `
                            <div class="info-item">
                                <span class="info-label">Homepage:</span>
                                <a href="${plugin.homepage}" target="_blank" class="info-link">${plugin.homepage}</a>
                            </div>
                            ` : ''}
                            ${plugin.repository ? `
                            <div class="info-item">
                                <span class="info-label">Repository:</span>
                                <a href="${plugin.repository}" target="_blank" class="info-link">${plugin.repository}</a>
                            </div>
                            ` : ''}
                            ${plugin.license ? `
                            <div class="info-item">
                                <span class="info-label">License:</span>
                                <span class="info-value">${plugin.license}</span>
                            </div>
                            ` : ''}
                            ${plugin.installedAt ? `
                            <div class="info-item">
                                <span class="info-label">Installed:</span>
                                <span class="info-value">${new Date(plugin.installedAt).toLocaleString()}</span>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
                
                <div class="details-footer">
                    <button onclick="document.getElementById('plugin-details-modal').remove()" 
                            class="btn-secondary details-btn">Close</button>
                </div>
            </div>
        `;
        
        // Add styles for details modal
        this.addDetailsModalStyles();
        
        // Append to body
        document.body.appendChild(detailsModal);
        
        // Click outside to close
        detailsModal.addEventListener('click', (e) => {
            if (e.target === detailsModal) {
                detailsModal.remove();
            }
        });
        
        console.log('✅ Plugin details modal displayed');
    }
    
    extractCommandsInfo(plugin) {
        const commands = [];
        
        // Extract from contributes.commands
        if (plugin.contributes && plugin.contributes.commands) {
            commands.push(...plugin.contributes.commands);
        }
        
        // Extract from _commandHandlers if available (runtime data)
        if (plugin._commandHandlers && plugin._commandHandlers.size > 0) {
            for (const [commandId] of plugin._commandHandlers) {
                // Check if already in commands array
                if (!commands.find(cmd => cmd.command === commandId)) {
                    commands.push({
                        command: commandId,
                        title: commandId.split('.').pop(),
                        description: 'Runtime registered command'
                    });
                }
            }
        }
        
        return commands;
    }
    
    addDetailsModalStyles() {
        if (document.getElementById('plugin-details-modal-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'plugin-details-modal-styles';
        styles.textContent = `
            .details-modal-backdrop {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.6);
                z-index: 10001;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: fadeIn 0.2s ease;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            .details-modal-content {
                background: white;
                border-radius: 12px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                width: 800px;
                max-width: 90vw;
                max-height: 90vh;
                display: flex;
                flex-direction: column;
                animation: slideUp 0.3s ease;
            }
            
            @keyframes slideUp {
                from { transform: translateY(20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            
            .details-header {
                background: linear-gradient(135deg, #2196F3, #1976D2);
                color: white;
                padding: 20px 25px;
                border-radius: 12px 12px 0 0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .details-header h2 {
                margin: 0;
                font-size: 22px;
                font-weight: 600;
            }
            
            .details-close-btn {
                background: rgba(255, 255, 255, 0.2);
                border: none;
                color: white;
                font-size: 28px;
                width: 40px;
                height: 40px;
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
                line-height: 1;
            }
            
            .details-close-btn:hover {
                background: rgba(255, 255, 255, 0.3);
                transform: scale(1.1);
            }
            
            .details-body {
                padding: 25px;
                overflow-y: auto;
                flex: 1;
                min-height: 0;
            }
            
            .details-section {
                margin-bottom: 25px;
                padding-bottom: 20px;
                border-bottom: 1px solid #e0e0e0;
            }
            
            .details-section:last-child {
                border-bottom: none;
                margin-bottom: 0;
            }
            
            .details-section h3 {
                margin: 0 0 15px 0;
                font-size: 16px;
                font-weight: 600;
                color: #333;
            }
            
            .info-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 12px;
            }
            
            .info-item {
                display: flex;
                align-items: baseline;
                gap: 8px;
            }
            
            .info-label {
                font-weight: 600;
                color: #666;
                min-width: 80px;
            }
            
            .info-value {
                color: #333;
            }
            
            .info-link {
                color: #2196F3;
                text-decoration: none;
                word-break: break-all;
            }
            
            .info-link:hover {
                text-decoration: underline;
            }
            
            .badge {
                display: inline-block;
                padding: 4px 12px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: 500;
            }
            
            .category-badge {
                background: #e3f2fd;
                color: #1976d2;
            }
            
            .type-badge {
                background: #f3e5f5;
                color: #7b1fa2;
            }
            
            .description-text {
                margin: 0;
                color: #555;
                line-height: 1.6;
            }
            
            .commands-list {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            
            .command-item {
                background: #f8f9fa;
                border: 1px solid #e0e0e0;
                border-radius: 6px;
                padding: 12px;
            }
            
            .command-header {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 6px;
            }
            
            .command-id {
                background: #263238;
                color: #4CAF50;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 13px;
                font-family: 'Monaco', 'Menlo', monospace;
            }
            
            .command-title {
                color: #666;
                font-size: 14px;
                font-weight: 500;
            }
            
            .command-description {
                margin: 0;
                color: #777;
                font-size: 13px;
                line-height: 1.5;
            }
            
            .tags-container {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
            }
            
            .tag {
                display: inline-block;
                padding: 6px 12px;
                border-radius: 14px;
                font-size: 12px;
                font-weight: 500;
            }
            
            .datatype-tag {
                background: #e8f5e9;
                color: #2e7d32;
            }
            
            .keyword-tag {
                background: #fff3e0;
                color: #ef6c00;
            }
            
            .general-tag {
                background: #e3f2fd;
                color: #1976d2;
            }
            
            .dependencies-list {
                margin: 0;
                padding-left: 20px;
            }
            
            .dependencies-list li {
                margin-bottom: 8px;
                color: #555;
            }
            
            .dependencies-list code {
                background: #f5f5f5;
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 13px;
            }
            
            .details-footer {
                background: #f8f9fa;
                padding: 15px 25px;
                border-top: 1px solid #e0e0e0;
                border-radius: 0 0 12px 12px;
                display: flex;
                justify-content: flex-end;
                gap: 10px;
            }
            
            .details-btn {
                padding: 10px 24px;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .btn-secondary {
                background: #6c757d;
                color: white;
            }
            
            .btn-secondary:hover {
                background: #5a6268;
                transform: translateY(-1px);
            }
            
            /* Scrollbar styling */
            .details-body::-webkit-scrollbar {
                width: 8px;
            }
            
            .details-body::-webkit-scrollbar-track {
                background: #f1f1f1;
                border-radius: 4px;
            }
            
            .details-body::-webkit-scrollbar-thumb {
                background: #c1c1c1;
                border-radius: 4px;
            }
            
            .details-body::-webkit-scrollbar-thumb:hover {
                background: #a8a8a8;
            }
        `;
        
        document.head.appendChild(styles);
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