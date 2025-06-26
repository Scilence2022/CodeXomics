/**
 * PluginMarketplace - Advanced plugin distribution and management system
 * Supports multiple plugin sources, dependency resolution, and secure installation
 */
class PluginMarketplace {
    constructor(pluginManagerV2, configManager, options = {}) {
        this.pluginManager = pluginManagerV2;
        this.configManager = configManager;
        this.options = {
            enableSecurityValidation: true,
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
        this.initialize();
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
        const defaultSources = [
            {
                id: 'official',
                name: 'GenomeExplorer Official Repository',
                url: 'https://plugins.genomeexplorer.org/api/v1',
                priority: 1,
                trusted: true,
                enabled: true
            },
            {
                id: 'community',
                name: 'Community Plugin Repository', 
                url: 'https://community-plugins.genomeexplorer.org/api/v1',
                priority: 2,
                trusted: false,
                enabled: true
            },
            {
                id: 'local',
                name: 'Local Plugin Directory',
                url: 'file://~/.genome-explorer/plugins',
                priority: 3,
                trusted: true,
                enabled: true
            }
        ];
        
        // Load from config or use defaults
        const configuredSources = this.configManager?.get('marketplace.sources') || defaultSources;
        
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
     * Load installed plugins registry
     */
    async loadInstalledPlugins() {
        const installedData = this.configManager?.get('marketplace.installed') || {};
        
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
        
        console.log(`📋 Loaded ${this.installedPlugins.size} installed plugins`);
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
     * Search in local plugin directory
     */
    async searchLocalSource(source, query, filters) {
        // Simulate local directory search
        // In real implementation, this would scan local filesystem
        const mockLocalPlugins = [
            {
                id: 'local-sequence-analyzer',
                name: 'Advanced Sequence Analyzer',
                description: 'Local development version of sequence analysis tools',
                version: '1.0.0-dev',
                author: 'Local Developer',
                category: 'sequence-analysis',
                tags: ['sequence', 'analysis', 'local'],
                type: 'function',
                size: 156000,
                dependencies: []
            }
        ];
        
        return mockLocalPlugins.filter(plugin => 
            plugin.name.toLowerCase().includes(query.toLowerCase()) ||
            plugin.description.toLowerCase().includes(query.toLowerCase()) ||
            plugin.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
        );
    }

    /**
     * Search in remote marketplace
     */
    async searchRemoteSource(source, query, filters) {
        try {
            // Simulate API call to remote marketplace
            const mockResponse = await this.simulateMarketplaceAPI(source, query, filters);
            return mockResponse.plugins || [];
            
        } catch (error) {
            console.error(`❌ Failed to search in source ${source.id}:`, error);
            source.errorCount++;
            return [];
        }
    }

    /**
     * Simulate marketplace API response
     */
    async simulateMarketplaceAPI(source, query, filters) {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
        
        const mockPlugins = [
            {
                id: 'advanced-phylogenetics',
                name: 'Advanced Phylogenetic Analysis',
                description: 'Comprehensive phylogenetic tree construction and analysis toolkit',
                version: '2.1.0',
                author: 'Bioinformatics Lab',
                category: 'phylogenetics',
                tags: ['phylogeny', 'evolution', 'trees'],
                type: 'function',
                size: 2340000,
                downloadUrl: `${source.url}/plugins/advanced-phylogenetics/2.1.0/download`,
                dependencies: [
                    { id: 'sequence-utils', version: '>=1.0.0' },
                    { id: 'math-libs', version: '>=2.0.0' }
                ],
                rating: 4.8,
                downloads: 15234,
                lastUpdated: '2024-11-15'
            },
            {
                id: 'protein-folding-predictor',
                name: 'Protein Folding Predictor',
                description: 'AI-powered protein structure prediction and folding analysis',
                version: '1.5.2',
                author: 'ML Research Group',
                category: 'protein-analysis',
                tags: ['protein', 'folding', 'ml', 'ai'],
                type: 'function',
                size: 4560000,
                downloadUrl: `${source.url}/plugins/protein-folding-predictor/1.5.2/download`,
                dependencies: [
                    { id: 'ml-core', version: '>=3.0.0' },
                    { id: 'protein-utils', version: '>=1.2.0' }
                ],
                rating: 4.6,
                downloads: 8921,
                lastUpdated: '2024-11-10'
            },
            {
                id: 'network-analysis-suite',
                name: 'Network Analysis Suite',
                description: 'Comprehensive biological network analysis and visualization',
                version: '3.0.1',
                author: 'Network Biology Team',
                category: 'network-analysis',
                tags: ['network', 'graph', 'visualization', 'analysis'],
                type: 'visualization',
                size: 1890000,
                downloadUrl: `${source.url}/plugins/network-analysis-suite/3.0.1/download`,
                dependencies: [
                    { id: 'graph-libs', version: '>=2.5.0' },
                    { id: 'visualization-engine', version: '>=1.8.0' }
                ],
                rating: 4.9,
                downloads: 12456,
                lastUpdated: '2024-11-12'
            },
            {
                id: 'sequence-alignment-pro',
                name: 'Sequence Alignment Pro',
                description: 'Professional multiple sequence alignment with advanced algorithms',
                version: '2.3.0',
                author: 'Alignment Algorithms Inc',
                category: 'sequence-analysis',
                tags: ['alignment', 'sequence', 'multiple', 'professional'],
                type: 'function',
                size: 3120000,
                downloadUrl: `${source.url}/plugins/sequence-alignment-pro/2.3.0/download`,
                dependencies: [
                    { id: 'sequence-utils', version: '>=1.1.0' },
                    { id: 'alignment-core', version: '>=2.0.0' }
                ],
                rating: 4.7,
                downloads: 9876,
                lastUpdated: '2024-11-08'
            }
        ];
        
        // Filter based on query
        const filteredPlugins = mockPlugins.filter(plugin => 
            plugin.name.toLowerCase().includes(query.toLowerCase()) ||
            plugin.description.toLowerCase().includes(query.toLowerCase()) ||
            plugin.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase())) ||
            plugin.category.toLowerCase().includes(query.toLowerCase())
        );
        
        return {
            plugins: filteredPlugins,
            total: filteredPlugins.length,
            source: source.id
        };
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
        // Simulate local plugin discovery
        const localPlugins = {
            'local-sequence-analyzer': {
                id: 'local-sequence-analyzer',
                name: 'Advanced Sequence Analyzer',
                description: 'Local development version of sequence analysis tools',
                version: '1.0.0-dev',
                author: 'Local Developer',
                category: 'sequence-analysis',
                type: 'function',
                dependencies: [],
                downloadUrl: `${source.url}/${pluginId}`
            }
        };
        
        return localPlugins[pluginId] || null;
    }

    /**
     * Find plugin in remote source
     */
    async findPluginInRemoteSource(source, pluginId) {
        try {
            // Simulate API call
            const response = await this.simulatePluginDetailsAPI(source, pluginId);
            return response.plugin;
        } catch (error) {
            console.warn(`Failed to find plugin ${pluginId} in source ${source.id}:`, error);
            return null;
        }
    }

    /**
     * Simulate plugin details API
     */
    async simulatePluginDetailsAPI(source, pluginId) {
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
        
        const mockPlugins = {
            'advanced-phylogenetics': {
                id: 'advanced-phylogenetics',
                name: 'Advanced Phylogenetic Analysis',
                description: 'Comprehensive phylogenetic tree construction and analysis toolkit',
                version: '2.1.0',
                author: 'Bioinformatics Lab',
                category: 'phylogenetics',
                type: 'function',
                size: 2340000,
                downloadUrl: `${source.url}/plugins/advanced-phylogenetics/2.1.0/download`,
                dependencies: [
                    { id: 'sequence-utils', version: '>=1.0.0' },
                    { id: 'math-libs', version: '>=2.0.0' }
                ]
            }
        };
        
        const plugin = mockPlugins[pluginId];
        if (!plugin) {
            throw new Error(`Plugin ${pluginId} not found`);
        }
        
        return { plugin };
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
                
                // Register as installed
                this.registerInstalledPlugin(plugin, installResult);
                
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
     * Download plugin
     */
    async downloadPlugin(plugin) {
        console.log(`⬇️ Downloading ${plugin.id} from ${plugin.downloadUrl}...`);
        
        // Simulate download
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
        
        // Simulate downloaded plugin data
        return {
            pluginId: plugin.id,
            version: plugin.version,
            data: `// Mock plugin code for ${plugin.id}\n// Version: ${plugin.version}`,
            manifest: {
                id: plugin.id,
                name: plugin.name,
                version: plugin.version,
                type: plugin.type,
                dependencies: plugin.dependencies
            }
        };
    }

    /**
     * Install downloaded plugin
     */
    async installDownloadedPlugin(downloadResult) {
        console.log(`🔧 Installing ${downloadResult.pluginId}...`);
        
        // Simulate installation process
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Register with plugin manager
        if (this.pluginManager) {
            await this.pluginManager.registerPlugin(downloadResult.pluginId, downloadResult.manifest);
        }
        
        return {
            success: true,
            installedAt: new Date(),
            installPath: `/plugins/${downloadResult.pluginId}`
        };
    }

    /**
     * Register installed plugin
     */
    registerInstalledPlugin(plugin, installResult) {
        this.installedPlugins.set(plugin.id, {
            id: plugin.id,
            version: plugin.version,
            source: plugin.source?.id || 'unknown',
            installedAt: installResult.installedAt,
            dependencies: plugin.dependencies || [],
            autoUpdate: true
        });
        
        // Save to config
        this.saveInstalledPluginsRegistry();
    }

    /**
     * Save installed plugins registry
     */
    saveInstalledPluginsRegistry() {
        if (this.configManager) {
            const registryData = {};
            for (const [id, plugin] of this.installedPlugins) {
                registryData[id] = plugin;
            }
            this.configManager.set('marketplace.installed', registryData);
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
     * Sync specific source
     */
    async syncSource(sourceId) {
        const source = this.marketplaceSources.get(sourceId);
        console.log(`🔄 Syncing source: ${source.name}`);
        
        // Clear old cache for this source
        this.clearCacheForSource(sourceId);
        
        // For remote sources, this would fetch the latest plugin index
        // For now, we'll just simulate the sync
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log(`✅ Source ${source.name} synced successfully`);
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