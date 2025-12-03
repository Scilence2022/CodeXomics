/**
 * PluginMarketplace - Advanced plugin distribution and management system
 * Supports multiple plugin sources, dependency resolution, and secure installation
 */
console.log('📦 [DEBUG] PluginMarketplace.js file loaded at:', new Date().toISOString());

class PluginMarketplace {
    constructor(pluginManagerV2, configManager, options = {}) {
        console.log('📦 [DEBUG] PluginMarketplace constructor called');
        this.pluginManager = pluginManagerV2;
        this.configManager = configManager;
        this.options = {
            enableSecurityValidation: false,  // Temporarily disabled for testing
            enableDependencyResolution: true,
            enableAutoUpdates: true,
            cacheTimeout: 3600000, // 1 hour
            maxConcurrentDownloads: 3,
            ...options
        };
        
        // Core components
        this.marketplaceSources = new Map();
        this.installedPlugins = new Map();
        this.downloadQueue = new Map();
        this.dependencyResolver = null;
        this.securityValidator = null;
        this.updateManager = null;
        
        // Cache and state
        this.pluginCache = new Map();
        this.searchCache = new Map();
        this.lastCacheUpdate = 0;
        this.isInitialized = false;
        this._initializationPromise = null;
        
        // Event system
        this.eventBus = new EventTarget();
        
        // Statistics
        this.stats = {
            totalSearches: 0,
            totalInstalls: 0,
            totalUpdates: 0,
            failedInstalls: 0,
            securityBlocks: 0
        };
        
        console.log('🛒 PluginMarketplace initializing...');
        // Store the promise so callers can wait for initialization
        this._initializationPromise = this.initialize();
    }
    
    /**
     * Wait for marketplace initialization to complete
     * @returns {Promise<void>}
     */
    async waitForInitialization() {
        if (this.isInitialized) {
            return;
        }
        if (this._initializationPromise) {
            await this._initializationPromise;
        }
    }

    /**
     * Initialize the marketplace system
     */
    async initialize() {
        try {
            console.log('🛒 Starting PluginMarketplace initialization...');
            
            // 1. Initialize dependency resolver
            this.dependencyResolver = new PluginDependencyResolver(this);
            console.log('✅ Dependency resolver initialized');
            
            // 2. Initialize security validator
            this.securityValidator = new PluginSecurityValidator(this.options);
            console.log('✅ Security validator initialized');
            
            // 3. Initialize update manager
            this.updateManager = new PluginUpdateManager(this);
            console.log('✅ Update manager initialized');
            
            // 4. Load configured marketplace sources
            await this.loadMarketplaceSources();
            console.log('✅ Marketplace sources loaded');
            
            // 5. Load installed plugins registry
            await this.loadInstalledPlugins();
            console.log('✅ Installed plugins registry loaded');
            
            // 6. Setup event listeners
            this.setupEventListeners();
            console.log('✅ Event listeners configured');
            
            // 7. Start background services
            this.startBackgroundServices();
            console.log('✅ Background services started');
            
            this.isInitialized = true;
            this.emitEvent('marketplace-initialized', { timestamp: Date.now() });
            
            console.log('🚀 PluginMarketplace initialization complete');
            
        } catch (error) {
            console.error('❌ PluginMarketplace initialization failed:', error);
            throw error;
        }
    }

    /**
     * Load configured marketplace sources
     */
    async loadMarketplaceSources() {
        // Default sources
        this.defaultSources = [
            { id: 'localhost', url: 'http://localhost:3001/api/v1', priority: 0, enabled: true },    // Updated to port 3001
            { id: 'official', url: 'https://plugins.genomeexplorer.org/api/v1', priority: 1, enabled: false },
            { id: 'community', url: 'https://community-plugins.genomeexplorer.org/api/v1', priority: 2, enabled: false }
        ];
        
        // Load from config or use defaults
        const configuredSources = this.configManager?.get('marketplace.sources') || this.defaultSources;
        
        for (const source of configuredSources) {
            if (source.enabled) {
                this.marketplaceSources.set(source.id, {
                    ...source,
                    lastSync: 0,
                    syncInProgress: false,
                    errorCount: 0,
                    plugins: new Map()
                });
            }
        }
        
        console.log(`📦 Loaded ${this.marketplaceSources.size} marketplace sources`);
    }

    /**
     * Load installed plugins registry and restore them to PluginManagerV2
     */
    async loadInstalledPlugins() {
        // Wait for ConfigManager to finish initializing before reading data
        if (this.configManager && this.configManager.waitForInitialization) {
            await this.configManager.waitForInitialization();
            console.log('✅ ConfigManager initialization complete, loading installed plugins...');
        }
        
        // First, check localStorage directly for debugging
        try {
            const rawData = localStorage.getItem('marketplaceSettings');
            if (rawData) {
                const parsed = JSON.parse(rawData);
                console.log('🔍 Direct localStorage check (marketplaceSettings):', {
                    hasInstalled: !!parsed.installed,
                    installedCount: Object.keys(parsed.installed || {}).length,
                    installedIds: Object.keys(parsed.installed || {})
                });
            } else {
                console.warn('⚠️  No marketplaceSettings found in localStorage');
            }
        } catch (e) {
            console.error('❌ Error reading localStorage directly:', e);
        }
        
        const installedData = this.configManager?.get('marketplace.installed') || {};
        
        console.log('📊 ConfigManager returned installed data:', {
            hasData: Object.keys(installedData).length > 0,
            pluginCount: Object.keys(installedData).length,
            pluginIds: Object.keys(installedData)
        });
        
        for (const [pluginId, pluginInfo] of Object.entries(installedData)) {
            this.installedPlugins.set(pluginId, {
                id: pluginId,
                version: pluginInfo.version,
                source: pluginInfo.source,
                installedAt: new Date(pluginInfo.installedAt),
                dependencies: pluginInfo.dependencies || [],
                autoUpdate: pluginInfo.autoUpdate !== false,
                ...pluginInfo
            });
        }
        
        console.log(`📋 Loaded ${this.installedPlugins.size} installed plugins from registry`);
        
        // Restore installed plugins to PluginManagerV2
        await this.restoreInstalledPlugins();
    }
    
    /**
     * Restore installed plugins by re-registering them with PluginManagerV2
     */
    async restoreInstalledPlugins() {
        if (this.installedPlugins.size === 0) {
            console.log('📋 No installed plugins to restore');
            return;
        }
        
        console.log(`🔄 Restoring ${this.installedPlugins.size} installed plugins to PluginManagerV2...`);
        console.log('📋 Plugins to restore:', Array.from(this.installedPlugins.keys()));
        
        let restoredCount = 0;
        let failedCount = 0;
        
        for (const [pluginId, pluginInfo] of this.installedPlugins) {
            try {
                console.log(`🔄 Attempting to restore plugin: ${pluginId}`);
                
                // Check if plugin is already registered
                const existingPlugin = this.pluginManager.getPlugin(pluginId);
                if (existingPlugin) {
                    console.log(`✅ Plugin ${pluginId} already registered`);
                    restoredCount++;
                    continue;
                }
                
                // Get plugin manifest from stored data
                const manifest = pluginInfo.manifest || {
                    id: pluginId,
                    name: pluginInfo.name || pluginId,
                    description: pluginInfo.description || '',
                    version: pluginInfo.version,
                    author: pluginInfo.author || 'Unknown',
                    category: pluginInfo.category || 'general',
                    type: pluginInfo.type || 'function',
                    dependencies: pluginInfo.dependencies || [],
                    tags: pluginInfo.tags || [],
                    homepage: pluginInfo.homepage || '',
                    repository: pluginInfo.repository || '',
                    license: pluginInfo.license || 'Unknown',
                    // Type-specific fields
                    ...(pluginInfo.type === 'visualization' ? {
                        supportedDataTypes: pluginInfo.supportedDataTypes || ['generic'],
                        executor: pluginInfo.executor || function(data) { return data; }
                    } : {}),
                    ...(pluginInfo.type === 'function' ? {
                        functions: pluginInfo.functions || {}
                    } : {})
                };
                
                console.log(`📦 Restoring plugin manifest:`, {
                    id: manifest.id,
                    name: manifest.name,
                    type: manifest.type,
                    version: manifest.version,
                    hasManifest: !!pluginInfo.manifest
                });
                
                // Re-register plugin with PluginManagerV2
                await this.pluginManager.registerPlugin(pluginId, manifest);
                
                // Verify registration
                const verifyPlugin = this.pluginManager.getPlugin(pluginId);
                if (verifyPlugin) {
                    console.log(`✅ Restored and verified plugin: ${pluginId}`);
                    restoredCount++;
                } else {
                    console.error(`❌ Plugin ${pluginId} registration returned but plugin not found!`);
                    failedCount++;
                }
                
            } catch (error) {
                console.error(`❌ Failed to restore plugin ${pluginId}:`, error);
                failedCount++;
            }
        }
        
        console.log(`✅ Plugin restoration complete: ${restoredCount} restored, ${failedCount} failed`);
        
        // Final verification - log all registered plugins
        console.log('📊 Final plugin registry state:', {
            functionPlugins: Array.from(this.pluginManager.pluginRegistry.function?.keys() || []),
            visualizationPlugins: Array.from(this.pluginManager.pluginRegistry.visualization?.keys() || []),
            utilityPlugins: Array.from(this.pluginManager.pluginRegistry.utility?.keys() || [])
        });
    }

    /**
     * Search plugins across all marketplace sources
     */
    async searchPlugins(query, filters = {}) {
        const searchKey = JSON.stringify({ query, filters });
        
        // Check cache first
        if (this.searchCache.has(searchKey)) {
            const cached = this.searchCache.get(searchKey);
            if (Date.now() - cached.timestamp < this.options.cacheTimeout) {
                this.stats.totalSearches++;
                return cached.results;
            }
        }
        
        try {
            console.log(`🔍 Searching plugins: "${query}"`);
            
            const searchPromises = [];
            
            // Search across all enabled sources
            for (const [sourceId, source] of this.marketplaceSources) {
                if (source.enabled) {
                    searchPromises.push(this.searchInSource(sourceId, query, filters));
                }
            }
            
            const sourceResults = await Promise.allSettled(searchPromises);
            
            // Combine and deduplicate results
            const allResults = new Map();
            
            sourceResults.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    const sourceId = Array.from(this.marketplaceSources.keys())[index];
                    const source = this.marketplaceSources.get(sourceId);
                    
                    result.value.forEach(plugin => {
                        const existingPlugin = allResults.get(plugin.id);
                        
                        if (!existingPlugin || source.priority < existingPlugin.source.priority) {
                            allResults.set(plugin.id, {
                                ...plugin,
                                source: { id: sourceId, ...source }
                            });
                        }
                    });
                }
            });
            
            // Apply filters and sorting
            let results = Array.from(allResults.values());
            results = this.applySearchFilters(results, filters);
            results = this.sortSearchResults(results, query);
            
            // Cache results
            this.searchCache.set(searchKey, {
                results,
                timestamp: Date.now()
            });
            
            this.stats.totalSearches++;
            this.emitEvent('plugins-searched', { query, resultCount: results.length });
            
            console.log(`✅ Found ${results.length} plugins for "${query}"`);
            return results;
            
        } catch (error) {
            console.error('❌ Plugin search failed:', error);
            throw error;
        }
    }

    /**
     * Search plugins in a specific source
     */
    async searchInSource(sourceId, query, filters) {
        const source = this.marketplaceSources.get(sourceId);
        
        if (source.url.startsWith('file://')) {
            return this.searchLocalSource(source, query, filters);
        } else {
            return this.searchRemoteSource(source, query, filters);
        }
    }


    /**
     * Search in remote marketplace
     */
    async searchRemoteSource(source, query, filters) {
        try {
            console.log(`🌐 Calling marketplace API: ${source.url}/plugins`);
            return this.callRealMarketplaceAPI(source, query, filters);
            
        } catch (error) {
            console.error(`❌ Failed to search in source ${source.id}:`, error);
            source.errorCount++;
            return [];
        }
    }

    /**
     * Call real marketplace API
     */
    async callRealMarketplaceAPI(source, query, filters) {
        try {
            // Build query parameters
            const params = new URLSearchParams();
            if (query) params.append('query', query);
            if (filters.category) params.append('category', filters.category);
            if (filters.type) params.append('type', filters.type);
            if (filters.author) params.append('author', filters.author);
            if (filters.tags) {
                const tags = Array.isArray(filters.tags) ? filters.tags : [filters.tags];
                tags.forEach(tag => params.append('tags', tag));
            }
            params.append('limit', '50');
            params.append('offset', '0');
            
            const url = `${source.url}/plugins?${params.toString()}`;
            console.log(`📡 Fetching: ${url}`);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'GenomeExplorer/2.0.0'
                },
                signal: AbortSignal.timeout(10000)  // 10 second timeout
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || 'API returned error');
            }
            
            console.log(`✅ Real API returned ${data.data.plugins.length} plugins from ${source.id}`);
            
            // Transform API response to match internal format
            return data.data.plugins.map(plugin => ({
                ...plugin,
                source: source.id,
                // Ensure required fields exist
                tags: plugin.tags || [],
                dependencies: plugin.dependencies || [],
                rating: plugin.rating || 0,
                downloads: plugin.downloads || 0
            }));
            
        } catch (error) {
            console.error(`❌ Real API call failed for ${source.id}:`, error);
            throw error;
        }
    }



    /**
     * Apply search filters to results
     */
    applySearchFilters(results, filters) {
        let filtered = results;
        
        if (filters.category) {
            filtered = filtered.filter(plugin => plugin.category === filters.category);
        }
        
        if (filters.type) {
            filtered = filtered.filter(plugin => plugin.type === filters.type);
        }
        
        if (filters.author) {
            filtered = filtered.filter(plugin => 
                plugin.author.toLowerCase().includes(filters.author.toLowerCase())
            );
        }
        
        if (filters.minRating) {
            filtered = filtered.filter(plugin => 
                plugin.rating >= filters.minRating
            );
        }
        
        if (filters.tags) {
            const requiredTags = Array.isArray(filters.tags) ? filters.tags : [filters.tags];
            filtered = filtered.filter(plugin =>
                requiredTags.some(tag => 
                    plugin.tags.some(pluginTag => 
                        pluginTag.toLowerCase().includes(tag.toLowerCase())
                    )
                )
            );
        }
        
        return filtered;
    }

    /**
     * Sort search results by relevance
     */
    sortSearchResults(results, query) {
        const queryLower = query.toLowerCase();
        
        return results.sort((a, b) => {
            // Calculate relevance scores
            let scoreA = 0;
            let scoreB = 0;
            
            // Exact name match gets highest score
            if (a.name.toLowerCase() === queryLower) scoreA += 100;
            if (b.name.toLowerCase() === queryLower) scoreB += 100;
            
            // Name starts with query
            if (a.name.toLowerCase().startsWith(queryLower)) scoreA += 50;
            if (b.name.toLowerCase().startsWith(queryLower)) scoreB += 50;
            
            // Name contains query
            if (a.name.toLowerCase().includes(queryLower)) scoreA += 25;
            if (b.name.toLowerCase().includes(queryLower)) scoreB += 25;
            
            // Description contains query
            if (a.description.toLowerCase().includes(queryLower)) scoreA += 10;
            if (b.description.toLowerCase().includes(queryLower)) scoreB += 10;
            
            // Tag matches
            const aTagMatches = a.tags.filter(tag => tag.toLowerCase().includes(queryLower)).length;
            const bTagMatches = b.tags.filter(tag => tag.toLowerCase().includes(queryLower)).length;
            scoreA += aTagMatches * 5;
            scoreB += bTagMatches * 5;
            
            // Secondary sorting by popularity
            if (scoreA === scoreB) {
                // Sort by rating and downloads
                const aPopularity = (a.rating || 0) * 0.2 + Math.log(a.downloads || 1) * 0.1;
                const bPopularity = (b.rating || 0) * 0.2 + Math.log(b.downloads || 1) * 0.1;
                return bPopularity - aPopularity;
            }
            
            return scoreB - scoreA;
        });
    }

    /**
     * Install plugin with dependency resolution
     */
    async installPlugin(pluginId, options = {}) {
        try {
            console.log(`📦 Starting installation of plugin: ${pluginId}`);
            
            // 1. Find plugin in marketplace
            const plugin = await this.findPlugin(pluginId);
            if (!plugin) {
                throw new Error(`Plugin ${pluginId} not found in marketplace`);
            }
            
            // 2. Check if already installed
            if (this.installedPlugins.has(pluginId) && !options.force) {
                const installed = this.installedPlugins.get(pluginId);
                if (this.compareVersions(installed.version, plugin.version) >= 0) {
                    console.log(`✅ Plugin ${pluginId} is already up to date`);
                    return { success: true, action: 'already-installed' };
                }
            }
            
            // 3. Resolve dependencies
            const installPlan = await this.dependencyResolver.createInstallPlan(plugin);
            console.log(`📋 Install plan created: ${installPlan.plugins.length} plugins to install`);
            
            // 4. Validate security
            if (this.options.enableSecurityValidation) {
                await this.securityValidator.validateInstallPlan(installPlan);
                console.log('🔒 Security validation passed');
            }
            
            // 5. Download and install plugins in dependency order
            const results = await this.executeInstallPlan(installPlan);
            
            this.stats.totalInstalls++;
            this.emitEvent('plugin-installed', { pluginId, results });
            
            console.log(`✅ Plugin ${pluginId} installed successfully`);
            return { success: true, results };
            
        } catch (error) {
            this.stats.failedInstalls++;
            console.error(`❌ Failed to install plugin ${pluginId}:`, error);
            this.emitEvent('plugin-install-failed', { pluginId, error: error.message });
            throw error;
        }
    }

    /**
     * Find plugin by ID across all sources
     */
    async findPlugin(pluginId) {
        // First check cache
        if (this.pluginCache.has(pluginId)) {
            const cached = this.pluginCache.get(pluginId);
            if (Date.now() - cached.timestamp < this.options.cacheTimeout) {
                return cached.plugin;
            }
        }
        
        // Search across all sources
        for (const [sourceId, source] of this.marketplaceSources) {
            try {
                const plugin = await this.findPluginInSource(sourceId, pluginId);
                if (plugin) {
                    // Cache the result
                    this.pluginCache.set(pluginId, {
                        plugin,
                        timestamp: Date.now()
                    });
                    return plugin;
                }
            } catch (error) {
                console.warn(`Failed to search in source ${sourceId}:`, error);
            }
        }
        
        return null;
    }

    /**
     * Find plugin in specific source
     */
    async findPluginInSource(sourceId, pluginId) {
        const source = this.marketplaceSources.get(sourceId);
        
        if (source.url.startsWith('file://')) {
            // Local source search
            return this.findPluginInLocalSource(source, pluginId);
        } else {
            // Remote source search
            return this.findPluginInRemoteSource(source, pluginId);
        }
    }

    /**
     * Find plugin in local source
     */
    async findPluginInLocalSource(source, pluginId) {
        try {
            // Read plugin manifest from local file system
            const pluginPath = source.url.replace('file://', '');
            const manifestPath = `${pluginPath}/${pluginId}/manifest.json`;
            
            // For browser environment, we can't access file system directly
            // This would need to be implemented via IPC in Electron
            console.warn('Local plugin source not fully implemented - requires IPC bridge');
            return null;
            
        } catch (error) {
            console.error(`Failed to read local plugin ${pluginId}:`, error);
            return null;
        }
    }

    /**
     * Find plugin in remote source
     */
    async findPluginInRemoteSource(source, pluginId) {
        try {
            // Try direct endpoint first if available
            const directUrl = `${source.url}/plugins/${pluginId}`;
            try {
                const directResp = await fetch(directUrl, {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' },
                    signal: AbortSignal.timeout(8000)
                });
                if (directResp.ok) {
                    const directData = await directResp.json();
                    // Handle wrapped response {success, data: {plugin}}
                    const plugin = directData.data?.plugin || directData.plugin || directData;
                    if (plugin && plugin.id === pluginId) {
                        plugin.downloadUrl = plugin.downloadUrl || `${source.url}/plugins/${plugin.id}/${plugin.version}/download`;
                        plugin.source = source;
                        return plugin;
                    }
                }
            } catch (e) {
                // Continue to list fallback
            }

            // Fallback: query the plugin list and filter by id
            const listUrl = `${source.url}/plugins`;
            const response = await fetch(listUrl, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                signal: AbortSignal.timeout(10000)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const responseData = await response.json();

            // Unwrap server response: {success: true, data: {plugins: [...]}}
            const data = responseData.data || responseData;

            // Handle both array and object response shapes from server
            let plugin = null;
            if (Array.isArray(data)) {
                // Direct array format
                plugin = data.find(p => p && p.id === pluginId) || null;
            } else if (Array.isArray(data.plugins)) {
                // Array nested in plugins property (current server format)
                plugin = data.plugins.find(p => p && p.id === pluginId) || null;
            } else if (data.plugins && typeof data.plugins === 'object') {
                // Object mapping format
                plugin = data.plugins[pluginId] || null;
            }

            if (!plugin) {
                console.log(`Plugin ${pluginId} not found in response:`, data);
                return null;
            }

            // Ensure download URL exists
            plugin.downloadUrl = plugin.downloadUrl || `${source.url}/plugins/${plugin.id}/${plugin.version}/download`;
            plugin.source = source;

            return plugin;
        } catch (error) {
            console.warn(`Failed to find plugin ${pluginId} in source ${source.id}:`, error);
            return null;
        }
    }



    /**
     * Execute install plan
     */
    async executeInstallPlan(installPlan) {
        const results = [];
        
        for (const plugin of installPlan.plugins) {
            try {
                console.log(`📥 Installing ${plugin.id} v${plugin.version}...`);
                
                // Download plugin
                const downloadResult = await this.downloadPlugin(plugin);
                
                // Install plugin
                const installResult = await this.installDownloadedPlugin(downloadResult);
                
                // Register as installed (await to ensure persistence)
                await this.registerInstalledPlugin(plugin, installResult);
                
                results.push({
                    pluginId: plugin.id,
                    success: true,
                    action: 'installed'
                });
                
            } catch (error) {
                console.error(`❌ Failed to install ${plugin.id}:`, error);
                results.push({
                    pluginId: plugin.id,
                    success: false,
                    error: error.message
                });
                
                // If this is a dependency, stop the installation
                if (plugin.isDependency) {
                    throw new Error(`Failed to install dependency ${plugin.id}: ${error.message}`);
                }
            }
        }
        
        return results;
    }

    /**
     * Download plugin from marketplace
     */
    async downloadPlugin(plugin) {
        console.log(`⬇️ Downloading ${plugin.id} from ${plugin.downloadUrl}...`);
        
        try {
            const response = await fetch(plugin.downloadUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json, application/zip, application/octet-stream',
                    'User-Agent': 'GenomeExplorer/2.0.0'
                },
                signal: AbortSignal.timeout(60000) // 60 second timeout for download
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const contentType = response.headers.get('content-type');
            let downloadResult;
            
            if (contentType && contentType.includes('application/json')) {
                // Server returned JSON (mock plugin package)
                const data = await response.json();
                
                if (!data.success) {
                    throw new Error(data.error || 'Download failed');
                }
                
                console.log(`✅ Downloaded ${plugin.id} as JSON package`);
                
                // Use manifest from server response
                downloadResult = {
                    pluginId: plugin.id,
                    version: plugin.version,
                    data: data.data.files, // JSON package files
                    manifest: data.data.manifest
                };
                
            } else {
                // Server returned binary file (actual zip/tarball)
                const blob = await response.blob();
                const arrayBuffer = await blob.arrayBuffer();
                
                console.log(`✅ Downloaded ${plugin.id} (${blob.size} bytes)`);
                
                // Return downloaded binary data with manifest from plugin metadata
                downloadResult = {
                    pluginId: plugin.id,
                    version: plugin.version,
                    data: arrayBuffer,
                    blob: blob,
                    manifest: {
                        id: plugin.id,
                        name: plugin.name,
                        description: plugin.description,
                        version: plugin.version,
                        author: plugin.author,
                        category: plugin.category,
                        type: plugin.type,
                        dependencies: plugin.dependencies || [],
                        tags: plugin.tags || [],
                        homepage: plugin.homepage,
                        repository: plugin.repository,
                        license: plugin.license,
                        // Add required fields for visualization plugins
                        ...(plugin.type === 'visualization' ? {
                            supportedDataTypes: plugin.supportedDataTypes || ['generic'],
                            executor: plugin.executor || function(data) { return data; }
                        } : {}),
                        // Add required fields for function plugins
                        ...(plugin.type === 'function' ? {
                            functions: plugin.functions || {}
                        } : {})
                    }
                };
            }
            
            return downloadResult;
            
        } catch (error) {
            console.error(`❌ Failed to download ${plugin.id}:`, error);
            throw new Error(`Download failed: ${error.message}`);
        }
    }

    /**
     * Install downloaded plugin
     */
    async installDownloadedPlugin(downloadResult) {
        console.log(`🔧 Installing ${downloadResult.pluginId}...`);
        
        try {
            // Register plugin with plugin manager
            // The plugin manager will handle loading and initialization
            if (this.pluginManager) {
                await this.pluginManager.registerPlugin(downloadResult.pluginId, downloadResult.manifest);
            } else {
                throw new Error('Plugin manager not available');
            }
            
            console.log(`✅ Successfully installed ${downloadResult.pluginId}`);
            
            return {
                success: true,
                installedAt: new Date(),
                installPath: `/plugins/${downloadResult.pluginId}`
            };
            
        } catch (error) {
            console.error(`❌ Failed to install ${downloadResult.pluginId}:`, error);
            throw new Error(`Installation failed: ${error.message}`);
        }
    }

    /**
     * Register installed plugin with complete manifest data
     */
    async registerInstalledPlugin(plugin, installResult) {
        // Get complete manifest from plugin manager if available
        const installedPlugin = this.pluginManager.getPlugin(plugin.id);
        const manifest = installedPlugin || plugin;
        
        this.installedPlugins.set(plugin.id, {
            id: plugin.id,
            version: plugin.version,
            source: plugin.source?.id || 'unknown',
            installedAt: installResult.installedAt,
            dependencies: plugin.dependencies || [],
            autoUpdate: true,
            // Store complete manifest data for restoration
            manifest: {
                id: manifest.id,
                name: manifest.name,
                description: manifest.description,
                version: manifest.version,
                author: manifest.author,
                category: manifest.category,
                type: manifest.type,
                dependencies: manifest.dependencies || [],
                tags: manifest.tags || [],
                homepage: manifest.homepage,
                repository: manifest.repository,
                license: manifest.license,
                // Type-specific fields
                ...(manifest.type === 'visualization' ? {
                    supportedDataTypes: manifest.supportedDataTypes || ['generic'],
                    executor: manifest.executor
                } : {}),
                ...(manifest.type === 'function' ? {
                    functions: manifest.functions || {}
                } : {})
            }
        });
        
        // Save to config immediately (await to ensure persistence)
        await this.saveInstalledPluginsRegistry();
        
        console.log(`💾 Saved ${plugin.id} to installed plugins registry`);
    }

    /**
     * Save installed plugins registry to ConfigManager (with immediate persistence)
     */
    async saveInstalledPluginsRegistry() {
        if (this.configManager) {
            const registryData = {};
            for (const [id, plugin] of this.installedPlugins) {
                registryData[id] = plugin;
            }
            
            console.log('💾 Saving installed plugins registry:', {
                pluginCount: Object.keys(registryData).length,
                pluginIds: Object.keys(registryData)
            });
            
            // Use immediate save to ensure persistence (bypasses debounce)
            // This is critical for plugin installation - data must be written to localStorage immediately
            if (this.configManager.setAndSaveImmediate) {
                const success = await this.configManager.setAndSaveImmediate('marketplace.installed', registryData);
                if (success) {
                    console.log('✅ Plugin registry saved to localStorage immediately');
                } else {
                    console.error('❌ Failed to save plugin registry immediately');
                }
            } else {
                // Fallback to regular set (for backward compatibility)
                this.configManager.set('marketplace.installed', registryData);
                console.warn('⚠️  Using debounced save (setAndSaveImmediate not available)');
            }
            
            // Verify save was successful by reading from ConfigManager
            setTimeout(() => {
                const savedData = this.configManager.get('marketplace.installed');
                console.log('✅ Verified saved data in ConfigManager:', {
                    pluginCount: Object.keys(savedData || {}).length,
                    pluginIds: Object.keys(savedData || {})
                });
                
                // Also verify localStorage directly
                try {
                    const localStorageData = localStorage.getItem('marketplaceSettings');
                    if (localStorageData) {
                        const parsed = JSON.parse(localStorageData);
                        console.log('✅ Verified data in localStorage:', {
                            hasInstalled: !!parsed.installed,
                            pluginCount: Object.keys(parsed.installed || {}).length
                        });
                    } else {
                        console.warn('⚠️  marketplaceSettings not found in localStorage');
                    }
                } catch (e) {
                    console.error('❌ Error verifying localStorage:', e);
                }
            }, 200);
        } else {
            console.warn('⚠️  ConfigManager not available, cannot save installed plugins registry');
        }
    }

    /**
     * Compare version strings
     */
    compareVersions(version1, version2) {
        const v1Parts = version1.split('.').map(Number);
        const v2Parts = version2.split('.').map(Number);
        
        for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
            const v1 = v1Parts[i] || 0;
            const v2 = v2Parts[i] || 0;
            
            if (v1 > v2) return 1;
            if (v1 < v2) return -1;
        }
        
        return 0;
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Plugin manager events
        if (this.pluginManager) {
            this.pluginManager.on('plugin-registered', (data) => {
                this.emitEvent('marketplace-plugin-activated', data);
            });
        }
    }

    /**
     * Start background services
     */
    startBackgroundServices() {
        // Auto-update check every hour
        if (this.options.enableAutoUpdates) {
            setInterval(() => {
                this.checkForUpdates();
            }, 3600000); // 1 hour
        }
        
        // Marketplace sync every 6 hours
        setInterval(() => {
            this.syncMarketplaceSources();
        }, 21600000); // 6 hours
    }

    /**
     * Check for plugin updates
     */
    async checkForUpdates() {
        console.log('🔄 Checking for plugin updates...');
        
        const updateablePlugins = [];
        
        for (const [pluginId, installedPlugin] of this.installedPlugins) {
            if (installedPlugin.autoUpdate) {
                try {
                    const latestPlugin = await this.findPlugin(pluginId);
                    if (latestPlugin && this.compareVersions(latestPlugin.version, installedPlugin.version) > 0) {
                        updateablePlugins.push({
                            current: installedPlugin,
                            latest: latestPlugin
                        });
                    }
                } catch (error) {
                    console.warn(`Failed to check updates for ${pluginId}:`, error);
                }
            }
        }
        
        if (updateablePlugins.length > 0) {
            console.log(`📋 Found ${updateablePlugins.length} plugin updates available`);
            this.emitEvent('updates-available', { plugins: updateablePlugins });
        }
        
        return updateablePlugins;
    }

    /**
     * Sync marketplace sources
     */
    async syncMarketplaceSources() {
        console.log('🔄 Syncing marketplace sources...');
        
        for (const [sourceId, source] of this.marketplaceSources) {
            if (source.enabled && !source.syncInProgress) {
                try {
                    source.syncInProgress = true;
                    await this.syncSource(sourceId);
                    source.lastSync = Date.now();
                    source.errorCount = 0;
                } catch (error) {
                    console.error(`Failed to sync source ${sourceId}:`, error);
                    source.errorCount++;
                } finally {
                    source.syncInProgress = false;
                }
            }
        }
    }

    /**
     * Sync specific source - fetch latest plugin index
     */
    async syncSource(sourceId) {
        const source = this.marketplaceSources.get(sourceId);
        console.log(`🔄 Syncing source: ${source.name || sourceId}`);
        
        try {
            // Clear old cache for this source
            this.clearCacheForSource(sourceId);
            
            // Fetch latest plugin index from source
            const url = `${source.url}/plugins`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'GenomeExplorer/2.0.0'
                },
                signal: AbortSignal.timeout(15000) // 15 second timeout
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            const pluginList = data.data?.plugins || data.plugins || [];
            
            // Update source's plugin cache
            source.plugins.clear();
            pluginList.forEach(plugin => {
                source.plugins.set(plugin.id, plugin);
            });
            
            console.log(`✅ Source ${source.name || sourceId} synced successfully (${pluginList.length} plugins)`);
            
        } catch (error) {
            console.error(`❌ Failed to sync source ${sourceId}:`, error);
            throw error;
        }
    }

    /**
     * Clear cache for specific source
     */
    clearCacheForSource(sourceId) {
        // Clear relevant cache entries
        for (const [cacheKey, cacheEntry] of this.pluginCache) {
            if (cacheEntry.plugin.source?.id === sourceId) {
                this.pluginCache.delete(cacheKey);
            }
        }
        
        // Clear search cache (it may contain results from this source)
        this.searchCache.clear();
    }

    /**
     * Get marketplace statistics
     */
    getMarketplaceStats() {
        return {
            sources: {
                total: this.marketplaceSources.size,
                enabled: Array.from(this.marketplaceSources.values()).filter(s => s.enabled).length,
                syncing: Array.from(this.marketplaceSources.values()).filter(s => s.syncInProgress).length
            },
            installed: {
                total: this.installedPlugins.size,
                autoUpdate: Array.from(this.installedPlugins.values()).filter(p => p.autoUpdate).length
            },
            cache: {
                pluginCacheSize: this.pluginCache.size,
                searchCacheSize: this.searchCache.size
            },
            stats: { ...this.stats }
        };
    }

    /**
     * Emit marketplace event
     */
    emitEvent(eventType, data) {
        const event = new CustomEvent('marketplace-event', {
            detail: { type: eventType, data, timestamp: Date.now() }
        });
        
        this.eventBus.dispatchEvent(event);
        
        // Also emit to window for backward compatibility
        if (typeof window !== 'undefined') {
            window.dispatchEvent(event);
        }
        
        console.log(`🔔 Marketplace event: ${eventType}`, data);
    }

    /**
     * Add event listener
     */
    on(eventType, callback) {
        this.eventBus.addEventListener('marketplace-event', (event) => {
            if (event.detail.type === eventType) {
                callback(event.detail.data);
            }
        });
    }

    /**
     * Cleanup and destroy
     */
    destroy() {
        console.log('🧹 Destroying PluginMarketplace...');
        
        // Clear timers
        clearInterval(this.updateCheckInterval);
        clearInterval(this.syncInterval);
        
        // Clear caches
        this.pluginCache.clear();
        this.searchCache.clear();
        
        // Clear registries
        this.marketplaceSources.clear();
        this.installedPlugins.clear();
        
        this.emitEvent('marketplace-destroyed', { timestamp: Date.now() });
        console.log('✅ PluginMarketplace destroyed');
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PluginMarketplace;
} else if (typeof window !== 'undefined') {
    window.PluginMarketplace = PluginMarketplace;
} 