/**
 * PluginManagerBridge - Integration layer between new Extension System and PluginManagerV2
 * 
 * This bridge provides backward compatibility while enabling the new VS Code-inspired
 * extension architecture. It allows gradual migration of plugins to the new system.
 * 
 * Key features:
 * - Wraps existing PluginManagerV2 functionality
 * - Converts legacy plugin definitions to new manifest format
 * - Provides unified API for both old and new plugins
 * - Enables incremental migration path
 */

/**
 * PluginManagerBridge - Main bridge class
 */
class PluginManagerBridge {
    /**
     * @param {PluginManagerV2} legacyManager - Existing PluginManagerV2 instance
     * @param {ExtensionService} extensionService - New ExtensionService instance
     */
    constructor(legacyManager, extensionService = null) {
        this._legacyManager = legacyManager;
        this._extensionService = extensionService;
        this._migratedPlugins = new Set();
        this._eventEmitter = new EventTarget();
        
        // Migration statistics
        this._stats = {
            totalPlugins: 0,
            migratedPlugins: 0,
            legacyPlugins: 0,
            migrationErrors: 0
        };

        console.log('PluginManagerBridge created');
    }

    /**
     * Initialize the bridge with a new ExtensionService
     * @param {Object} options - Extension service options
     * @returns {Promise<void>}
     */
    async initialize(options = {}) {
        if (!this._extensionService) {
            this._extensionService = new ExtensionService({
                storageBackend: options.storageBackend || this._legacyManager?.configManager,
                ...options
            });
        }

        await this._extensionService.initialize();
        console.log('PluginManagerBridge initialized with ExtensionService');
    }

    /**
     * Convert a legacy plugin definition to new manifest format
     * @param {string} pluginId - Legacy plugin ID
     * @param {Object} pluginDef - Legacy plugin definition
     * @returns {Object} New manifest format
     */
    convertToManifest(pluginId, pluginDef) {
        const manifest = {
            name: pluginId,
            version: pluginDef.version || '1.0.0',
            displayName: pluginDef.name || pluginId,
            description: pluginDef.description || '',
            publisher: pluginDef.author || 'GenomeExplorer',
            type: pluginDef.type || 'function',
            
            // Activation events based on plugin type
            activationEvents: this._inferActivationEvents(pluginDef),
            
            // Convert contributions
            contributes: {}
        };

        // Convert functions to contributions
        if (pluginDef.functions) {
            manifest.contributes.functions = {};
            
            for (const [funcName, funcDef] of Object.entries(pluginDef.functions)) {
                manifest.contributes.functions[funcName] = {
                    name: funcName,
                    description: funcDef.description || '',
                    parameters: funcDef.parameters || { type: 'object', properties: {} },
                    executor: funcDef.executor || null,
                    category: pluginDef.category || 'general'
                };
            }
        }

        // Convert visualization plugins
        if (pluginDef.type === 'visualization') {
            manifest.contributes.visualizations = {
                [pluginId]: {
                    id: pluginId,
                    name: pluginDef.name,
                    description: pluginDef.description,
                    supportedDataTypes: pluginDef.supportedDataTypes || [],
                    executor: pluginDef.executor
                }
            };
        }

        // Add metadata
        manifest.categories = [pluginDef.category || 'other'];
        manifest.keywords = pluginDef.keywords || [];
        manifest.priority = pluginDef.priority || 'normal';
        manifest.enabled = pluginDef.enabled !== false;

        return manifest;
    }

    /**
     * Infer activation events from plugin definition
     * @private
     * @param {Object} pluginDef 
     * @returns {string[]}
     */
    _inferActivationEvents(pluginDef) {
        const events = [];

        // Function plugins activate on command
        if (pluginDef.functions) {
            for (const funcName of Object.keys(pluginDef.functions)) {
                events.push(`onCommand:${pluginDef.type || 'function'}.${funcName}`);
            }
        }

        // If no specific events, use startup finished
        if (events.length === 0) {
            events.push('onStartupFinished');
        }

        return events;
    }

    /**
     * Migrate a legacy plugin to the new system
     * @param {string} pluginId - Legacy plugin ID
     * @returns {Promise<boolean>} Success status
     */
    async migratePlugin(pluginId) {
        if (this._migratedPlugins.has(pluginId)) {
            console.log(`Plugin ${pluginId} is already migrated`);
            return true;
        }

        if (!this._extensionService) {
            throw new Error('ExtensionService not initialized. Call initialize() first.');
        }

        try {
            console.log(`Migrating plugin: ${pluginId}`);

            // Get legacy plugin definition
            const legacyPlugin = this._legacyManager.getPlugin(pluginId);
            
            if (!legacyPlugin) {
                throw new Error(`Plugin ${pluginId} not found in legacy manager`);
            }

            // Convert to new manifest format
            const manifest = this.convertToManifest(pluginId, legacyPlugin);

            // Create extension module wrapper
            const extensionModule = this._createExtensionModule(pluginId, legacyPlugin);

            // Register with new system
            await this._extensionService.registerExtension(manifest, extensionModule);

            this._migratedPlugins.add(pluginId);
            this._stats.migratedPlugins++;

            this._emitEvent('pluginMigrated', { pluginId });
            console.log(`Plugin ${pluginId} migrated successfully`);

            return true;

        } catch (error) {
            this._stats.migrationErrors++;
            console.error(`Failed to migrate plugin ${pluginId}:`, error);
            this._emitEvent('pluginMigrationFailed', { pluginId, error: error.message });
            return false;
        }
    }

    /**
     * Create an extension module wrapper for a legacy plugin
     * @private
     * @param {string} pluginId 
     * @param {Object} pluginDef 
     * @returns {Object}
     */
    _createExtensionModule(pluginId, pluginDef) {
        const legacyManager = this._legacyManager;

        return {
            /**
             * Activate the extension
             * @param {ExtensionContext} context 
             * @returns {Object}
             */
            activate: async (context) => {
                console.log(`Activating migrated plugin: ${pluginId}`);
                
                const exports = {
                    commands: {},
                    functions: {}
                };

                // Wrap legacy functions
                if (pluginDef.functions) {
                    for (const [funcName, funcDef] of Object.entries(pluginDef.functions)) {
                        const fullName = `${pluginId}.${funcName}`;
                        
                        exports.functions[funcName] = async (parameters) => {
                            return await legacyManager.executeFunction(pluginId, funcName, parameters);
                        };

                        // Also register as command
                        exports.commands[fullName] = exports.functions[funcName];
                    }
                }

                return exports;
            },

            /**
             * Deactivate the extension
             */
            deactivate: async () => {
                console.log(`Deactivating migrated plugin: ${pluginId}`);
            }
        };
    }

    /**
     * Migrate all legacy plugins
     * @returns {Promise<{success: number, failed: number}>}
     */
    async migrateAllPlugins() {
        const results = { success: 0, failed: 0 };

        // Get all plugins from each registry type
        const registryTypes = ['function', 'visualization', 'utility'];

        for (const type of registryTypes) {
            const registry = this._legacyManager.pluginRegistry[type];
            
            if (registry) {
                for (const pluginId of registry.keys()) {
                    const success = await this.migratePlugin(pluginId);
                    
                    if (success) {
                        results.success++;
                    } else {
                        results.failed++;
                    }
                }
            }
        }

        console.log(`Migration complete: ${results.success} succeeded, ${results.failed} failed`);
        return results;
    }

    /**
     * Register a new plugin using the new system
     * @param {Object} manifest - Extension manifest
     * @param {Object} module - Extension module
     * @returns {Promise<void>}
     */
    async registerExtension(manifest, module = null) {
        if (!this._extensionService) {
            throw new Error('ExtensionService not initialized');
        }

        await this._extensionService.registerExtension(manifest, module);
        this._stats.totalPlugins++;
    }

    /**
     * Execute a function (supports both legacy and new plugins)
     * @param {string} pluginId - Plugin ID
     * @param {string} functionName - Function name
     * @param {Object} parameters - Function parameters
     * @returns {Promise<any>}
     */
    async executeFunction(pluginId, functionName, parameters = {}) {
        // Check if plugin is migrated
        if (this._migratedPlugins.has(pluginId)) {
            // Use new system
            const commandId = `${pluginId}.${functionName}`;
            return await this._extensionService.executeCommand(commandId, parameters);
        } else {
            // Use legacy system
            return await this._legacyManager.executeFunction(pluginId, functionName, parameters);
        }
    }

    /**
     * Get all available functions (from both systems)
     * @returns {Object[]}
     */
    getAvailableFunctions() {
        const functions = [];

        // Get from legacy manager
        if (this._legacyManager) {
            const legacyFunctions = this._legacyManager.getAvailableFunctions();
            
            for (const func of legacyFunctions) {
                const pluginId = func.plugin?.id || func.name.split('.')[0];
                
                functions.push({
                    ...func,
                    source: this._migratedPlugins.has(pluginId) ? 'new' : 'legacy'
                });
            }
        }

        // Get from new system (for non-migrated extensions)
        if (this._extensionService) {
            const newFunctions = this._extensionService.getContributedFunctions();
            
            for (const func of newFunctions) {
                // Avoid duplicates from migrated plugins
                if (!this._migratedPlugins.has(func.extensionId)) {
                    functions.push({
                        name: `${func.extensionId}.${func.name}`,
                        description: func.description,
                        parameters: func.parameters,
                        plugin: { id: func.extensionId },
                        source: 'new'
                    });
                }
            }
        }

        return functions;
    }

    /**
     * Get plugin by ID (from both systems)
     * @param {string} pluginId 
     * @returns {Object | null}
     */
    getPlugin(pluginId) {
        // Check new system first
        if (this._extensionService) {
            const extension = this._extensionService.getExtension(pluginId);
            if (extension) {
                return {
                    ...extension,
                    source: 'new'
                };
            }
        }

        // Fall back to legacy
        if (this._legacyManager) {
            const plugin = this._legacyManager.getPlugin(pluginId);
            if (plugin) {
                return {
                    ...plugin,
                    id: pluginId,
                    source: 'legacy'
                };
            }
        }

        return null;
    }

    /**
     * Get system statistics
     * @returns {Object}
     */
    getStats() {
        return {
            ...this._stats,
            legacy: this._legacyManager?.getSystemStats() || {},
            new: this._extensionService?.getStats() || {}
        };
    }

    /**
     * Check if a plugin is migrated
     * @param {string} pluginId 
     * @returns {boolean}
     */
    isMigrated(pluginId) {
        return this._migratedPlugins.has(pluginId);
    }

    /**
     * Get the new ExtensionService
     * @returns {ExtensionService}
     */
    get extensionService() {
        return this._extensionService;
    }

    /**
     * Get the legacy PluginManagerV2
     * @returns {PluginManagerV2}
     */
    get legacyManager() {
        return this._legacyManager;
    }

    /**
     * Emit an event
     * @private
     */
    _emitEvent(eventType, data) {
        const event = new CustomEvent('pluginBridge', {
            detail: { type: eventType, data, timestamp: Date.now() }
        });

        this._eventEmitter.dispatchEvent(event);

        if (typeof window !== 'undefined') {
            window.dispatchEvent(event);
        }
    }

    /**
     * Add event listener
     * @param {string} eventType 
     * @param {Function} callback 
     * @returns {Object}
     */
    on(eventType, callback) {
        const handler = (event) => {
            if (event.detail.type === eventType) {
                callback(event.detail.data);
            }
        };

        this._eventEmitter.addEventListener('pluginBridge', handler);

        return {
            dispose: () => {
                this._eventEmitter.removeEventListener('pluginBridge', handler);
            }
        };
    }

    /**
     * Dispose the bridge
     * @returns {Promise<void>}
     */
    async dispose() {
        if (this._extensionService) {
            await this._extensionService.dispose();
        }

        this._migratedPlugins.clear();
        console.log('PluginManagerBridge disposed');
    }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PluginManagerBridge };
} else if (typeof window !== 'undefined') {
    window.PluginManagerBridge = PluginManagerBridge;
}
