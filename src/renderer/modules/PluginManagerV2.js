/**
 * PluginManagerV2 - Modern plugin system core for GenomeExplorer
 * 
 * Enhanced with VS Code-inspired extension architecture:
 * - Extension Context for lifecycle management
 * - Contribution Registry for extension points
 * - Command Registry for unified command handling
 * - Activation Events for lazy loading
 * - Disposable pattern for resource cleanup
 * - Production-ready path resolution for packaged apps
 * 
 * @see core/ExtensionService.js for the new architecture
 * @see PluginPathResolver.js for path resolution
 */
console.log('🔧 [DEBUG] PluginManagerV2.js file loaded at:', new Date().toISOString());

class PluginManagerV2 {
    constructor(app, configManager = null, options = {}) {
        console.log('🔧 [DEBUG] PluginManagerV2 constructor called');
        this.app = app;
        this.configManager = configManager;
        this.options = {
            enableResourceManagement: true,
            enableCaching: true,
            enableMarketplace: true,
            enableSecurityValidation: false,  // Temporarily disabled for testing
            enableDependencyResolution: true,
            enableAutoUpdates: true,
            enableNewArchitecture: true, // Enable VS Code-inspired architecture
            maxConcurrentExecutions: 5,
            defaultPermissions: {
                'genome.read': true,
                'annotations.read': true,
                'features.read': true,
                'tracks.read': true
            },
            ...options
        };
        
        // Core components
        this.api = null;
        this.resourceManager = null;
        this.marketplace = null;
        this.promptProvider = null;
        this.eventBus = new EventTarget();
        
        // Path resolver for production-ready plugin loading
        this.pathResolver = null;
        
        // New architecture components (VS Code-inspired)
        this.extensionService = null;
        this.contributionRegistry = null;
        this.commandRegistry = null;
        this.activationService = null;
        this.pluginBridge = null;
        
        // Plugin registries - separated by type for better organization
        this.pluginRegistry = {
            function: new Map(),
            visualization: new Map(),
            utility: new Map()
        };
        
        // Plugin metadata and state
        this.pluginMetadata = new Map();
        this.pluginExecutors = new Map();
        
        // Extension contexts for each plugin (new architecture)
        this.extensionContexts = new Map();
        
        // System state
        this.isInitialized = false;
        this.initializationPromise = null;
        
        // Performance monitoring
        this.metrics = {
            totalExecutions: 0,
            successfulExecutions: 0,
            failedExecutions: 0,
            averageExecutionTime: 0,
            pluginUsageStats: new Map()
        };
        
        console.log('PluginManagerV2 initializing...');
        this.initialize();
    }

    /**
     * Initialize the plugin system
     */
    async initialize() {
        if (this.initializationPromise) {
            return this.initializationPromise;
        }
        
        this.initializationPromise = this._performInitialization();
        return this.initializationPromise;
    }
    
    /**
     * Wait for plugin system initialization to complete
     * @returns {Promise<void>}
     */
    async waitForInitialization() {
        if (this.isInitialized) {
            return;
        }
        if (this.initializationPromise) {
            await this.initializationPromise;
        }
    }

    async _performInitialization() {
        try {
            console.log('🔧 Initializing PluginManagerV2 components...');
            
            // 0. Initialize Path Resolver for production-ready plugin loading
            if (typeof window !== 'undefined' && window.pluginPathResolver) {
                this.pathResolver = window.pluginPathResolver;
                await this.pathResolver.initialize();
                console.log('✅ PluginPathResolver initialized');
                console.log('  Built-in plugins path:', this.pathResolver.getBuiltinPluginsPath());
                console.log('  User plugins path:', this.pathResolver.getUserPluginsPath());
            } else if (typeof window !== 'undefined' && window.PluginPathResolver) {
                // Fallback: Create instance if class exists but singleton doesn't
                console.log('⚠️  window.pluginPathResolver not found, creating new instance');
                this.pathResolver = new window.PluginPathResolver();
                await this.pathResolver.initialize();
                window.pluginPathResolver = this.pathResolver;
                console.log('✅ PluginPathResolver instance created and initialized');
                console.log('  Built-in plugins path:', this.pathResolver.getBuiltinPluginsPath());
                console.log('  User plugins path:', this.pathResolver.getUserPluginsPath());
            } else {
                console.warn('⚠️  PluginPathResolver not available, using fallback paths');
                console.warn('  This may cause issues in production environments');
                console.warn('  Ensure PluginPathResolver.js is loaded before PluginManagerV2.js');
            }
            
            // 1. Initialize PluginAPI with permissions
            this.api = new PluginAPI(this.app, this.options.defaultPermissions);
            console.log('✅ PluginAPI initialized');
            
            // 2. Initialize Resource Manager if enabled
            if (this.options.enableResourceManagement) {
                this.resourceManager = new PluginResourceManager({
                    maxConcurrentExecutions: this.options.maxConcurrentExecutions
                });
                console.log('✅ PluginResourceManager initialized');
            }
            
            // 3. Initialize new architecture components if enabled
            if (this.options.enableNewArchitecture) {
                await this._initializeNewArchitecture();
            }
            
            // 4. Initialize Plugin Prompt Provider
            const { default: PluginPromptProvider } = await import('./PluginPromptProvider.js');
            this.promptProvider = new PluginPromptProvider();
            console.log('✅ PluginPromptProvider initialized');
            
            // 5. Initialize Plugin Marketplace
            if (this.options.enableMarketplace !== false) {
                this.marketplace = new PluginMarketplace(this, this.configManager, {
                    enableSecurityValidation: this.options.enableSecurityValidation,
                    enableDependencyResolution: this.options.enableDependencyResolution,
                    enableAutoUpdates: this.options.enableAutoUpdates
                });
                // Wait for marketplace async initialization to complete
                // This ensures installed plugins are restored before system-initialized event
                await this.marketplace.waitForInitialization();
                console.log('✅ PluginMarketplace initialized and plugins restored');
            }
            
            // 6. Load and register built-in plugins
            await this.loadBuiltinPlugins();
            console.log('✅ Built-in plugins loaded');
            
            // 7. Set up event listeners
            this.setupEventListeners();
            console.log('✅ Event listeners configured');
            
            // 8. Set global reference
            if (typeof window !== 'undefined') {
                window.pluginManagerV2 = this;
            }
            
            this.isInitialized = true;
            this.emitEvent('system-initialized', { timestamp: Date.now() });
            
            console.log('🚀 PluginManagerV2 initialization complete');
            
        } catch (error) {
            console.error('❌ PluginManagerV2 initialization failed:', error);
            throw error;
        }
    }

    /**
     * Initialize VS Code-inspired architecture components
     * @private
     */
    async _initializeNewArchitecture() {
        console.log('🔧 Initializing VS Code-inspired architecture...');
        
        try {
            // Check if core modules are available
            if (typeof ContributionRegistry !== 'undefined') {
                this.contributionRegistry = new ContributionRegistry();
                console.log('✅ ContributionRegistry initialized');
            }
            
            if (typeof CommandRegistry !== 'undefined') {
                this.commandRegistry = new CommandRegistry();
                console.log('✅ CommandRegistry initialized');
            }
            
            if (typeof ActivationEventsService !== 'undefined') {
                this.activationService = new ActivationEventsService();
                this.activationService.setActivationHandler(
                    this._handleExtensionActivation.bind(this)
                );
                console.log('✅ ActivationEventsService initialized');
            }
            
            if (typeof ExtensionService !== 'undefined') {
                this.extensionService = new ExtensionService({
                    storageBackend: this.configManager
                });
                await this.extensionService.initialize();
                console.log('✅ ExtensionService initialized');
            }
            
            // Create bridge for backward compatibility
            if (typeof PluginManagerBridge !== 'undefined' && this.extensionService) {
                this.pluginBridge = new PluginManagerBridge(this, this.extensionService);
                console.log('✅ PluginManagerBridge initialized');
            }
            
            console.log('✅ VS Code-inspired architecture initialized');
            
        } catch (error) {
            console.warn('⚠️ New architecture initialization failed, falling back to legacy:', error);
            // Continue with legacy system
        }
    }

    /**
     * Handle extension activation request
     * @private
     * @param {string} extensionId 
     * @param {string} trigger 
     * @param {string} event 
     */
    async _handleExtensionActivation(extensionId, trigger, event) {
        console.log(`Activating extension ${extensionId} via ${trigger}`);
        // This will be called by the activation service when an extension needs activation
        // The actual activation is handled by the extension service
    }

    /**
     * Load built-in plugins with improved organization
     */
    async loadBuiltinPlugins() {
        console.log('📦 Loading built-in plugins...');
        
        // Function plugins
        await this.registerBuiltinFunctionPlugins();
        
        // Visualization plugins  
        await this.registerBuiltinVisualizationPlugins();
        
        // Utility plugins
        await this.registerBuiltinUtilityPlugins();
        
        console.log(`📊 Loaded plugins: ${this.getTotalPluginCount()} total`);
    }

    /**
     * Register built-in function plugins with better organization
     */
    async registerBuiltinFunctionPlugins() {
        // Genomic Analysis Plugin
   
    }

    /**
     * Register built-in visualization plugins
     */
    async registerBuiltinVisualizationPlugins() {
      
    }

    /**
     * Register built-in utility plugins
     */
    async registerBuiltinUtilityPlugins() {
      
    }

    /**
     * Uninstall a plugin from the system
     */
    async uninstallPlugin(pluginId) {
        try {
            console.log(`🗑️ Uninstalling plugin: ${pluginId}`);
            
            // Find plugin in registries
            let pluginType = null;
            let plugin = null;
            
            for (const [type, registry] of Object.entries(this.pluginRegistry)) {
                if (registry.has(pluginId)) {
                    pluginType = type;
                    plugin = registry.get(pluginId);
                    break;
                }
            }
            
            if (!plugin) {
                throw new Error(`Plugin ${pluginId} not found`);
            }
            
            // 1. Delete plugin files from disk
            if (this.pathResolver && typeof window !== 'undefined' && window.electronAPI?.deletePluginFiles) {
                const installPath = this.pathResolver.getInstallPath(pluginId);
                console.log(`🗑️ Deleting plugin files from: ${installPath}`);
                
                try {
                    const deleteResult = await window.electronAPI.deletePluginFiles({
                        pluginId,
                        installPath
                    });
                    
                    if (deleteResult.success) {
                        console.log(`✅ Plugin files deleted from disk`);
                    } else {
                        console.warn(`⚠️  Failed to delete plugin files: ${deleteResult.error}`);
                    }
                } catch (deleteError) {
                    console.warn(`⚠️  Error deleting plugin files:`, deleteError);
                    // Continue with uninstall even if file deletion fails
                }
            }
            
            // 2. Dispose extension context if exists (new architecture)
            if (this.extensionContexts.has(pluginId)) {
                const context = this.extensionContexts.get(pluginId);
                if (context.subscriptions) {
                    context.subscriptions.forEach(disposable => {
                        if (disposable.dispose) disposable.dispose();
                    });
                }
                this.extensionContexts.delete(pluginId);
            }
            
            // 3. Remove from registry
            this.pluginRegistry[pluginType].delete(pluginId);
            
            // 4. Remove metadata and executors
            this.pluginMetadata.delete(pluginId);
            this.pluginExecutors.delete(pluginId);
            
            // 5. Remove from usage stats
            this.metrics.pluginUsageStats.delete(pluginId);
            
            // 6. Emit uninstall event (PluginMarketplace listens to this)
            this.emitEvent('plugin-uninstalled', { pluginId, type: pluginType });
            
            console.log(`✅ Plugin ${pluginId} uninstalled successfully`);
            
            return {
                success: true,
                pluginId,
                type: pluginType,
                uninstalledAt: Date.now()
            };
            
        } catch (error) {
            console.error(`❌ Failed to uninstall plugin ${pluginId}:`, error);
            throw error;
        }
    }

    /**
     * Enhanced plugin registration with validation and metadata
     */
    async registerPlugin(pluginId, pluginDefinition) {
        try {
            // Validate plugin definition
            this.validatePluginDefinition(pluginDefinition);
            
            // Check for conflicts
            if (this.pluginRegistry[pluginDefinition.type].has(pluginId)) {
                throw new Error(`Plugin ${pluginId} is already registered`);
            }
            
            // Prepare plugin metadata
            const metadata = {
                id: pluginId,
                registeredAt: Date.now(),
                loadedAt: null,
                lastExecuted: null,
                executionCount: 0,
                errorCount: 0,
                status: 'registered'
            };
            
            // Set default enabled state if not explicitly defined
            if (pluginDefinition.enabled === undefined) {
                pluginDefinition.enabled = true;
            }

            // Register plugin
            this.pluginRegistry[pluginDefinition.type].set(pluginId, pluginDefinition);
            this.pluginMetadata.set(pluginId, metadata);
            
            // Initialize plugin executors if needed
            if (pluginDefinition.functions) {
                await this.initializePluginExecutors(pluginId, pluginDefinition);
            }
            
            // Register with new architecture if available
            await this._registerWithNewArchitecture(pluginId, pluginDefinition);
            
            this.emitEvent('plugin-registered', { pluginId, type: pluginDefinition.type });
            console.log(`✅ Plugin registered: ${pluginId} (${pluginDefinition.type})`);
            
        } catch (error) {
            console.error(`❌ Failed to register plugin ${pluginId}:`, error);
            throw error;
        }
    }

    /**
     * Register plugin with new VS Code-inspired architecture
     * @private
     * @param {string} pluginId 
     * @param {Object} pluginDefinition 
     */
    async _registerWithNewArchitecture(pluginId, pluginDefinition) {
        // Register contributions if ContributionRegistry is available
        if (this.contributionRegistry) {
            const contributions = this._convertToContributions(pluginId, pluginDefinition);
            if (Object.keys(contributions).length > 0) {
                this.contributionRegistry.registerContributions(pluginId, contributions);
            }
        }
        
        // Register commands if CommandRegistry is available
        if (this.commandRegistry && pluginDefinition.functions) {
            for (const [funcName, funcDef] of Object.entries(pluginDefinition.functions)) {
                const commandId = `${pluginId}.${funcName}`;
                
                this.commandRegistry.registerCommand(commandId, async (params) => {
                    return await this.executeFunction(pluginId, funcName, params);
                }, {
                    title: funcDef.description || funcName,
                    category: pluginDefinition.category || 'Plugins',
                    extensionId: pluginId
                });
            }
        }
        
        // Register with activation service if available
        if (this.activationService) {
            this.activationService.registerExtension(pluginId, {
                activationEvents: ['onStartupFinished'],
                extensionDependencies: []
            });
        }
        
        // Create extension context for lifecycle management
        if (typeof ExtensionContext !== 'undefined') {
            const context = new ExtensionContext({
                extension: {
                    id: pluginId,
                    name: pluginDefinition.name,
                    version: pluginDefinition.version
                },
                extensionPath: `/plugins/${pluginId}`,
                storageBackend: this.configManager
            });
            this.extensionContexts.set(pluginId, context);
        }
    }

    /**
     * Convert legacy plugin definition to contribution format
     * @private
     * @param {string} pluginId 
     * @param {Object} pluginDefinition 
     * @returns {Object}
     */
    _convertToContributions(pluginId, pluginDefinition) {
        const contributions = {};
        
        // Convert functions to function contributions
        if (pluginDefinition.functions) {
            contributions.functions = {};
            
            for (const [funcName, funcDef] of Object.entries(pluginDefinition.functions)) {
                contributions.functions[funcName] = {
                    name: funcName,
                    description: funcDef.description || '',
                    parameters: funcDef.parameters || { type: 'object', properties: {} },
                    category: pluginDefinition.category || 'general'
                };
            }
        }
        
        // Convert visualizations
        if (pluginDefinition.type === 'visualization') {
            contributions.visualizations = {
                [pluginId]: {
                    id: pluginId,
                    name: pluginDefinition.name,
                    description: pluginDefinition.description,
                    supportedDataTypes: pluginDefinition.supportedDataTypes || []
                }
            };
        }
        
        return contributions;
    }

    /**
     * Validate plugin definition structure
     */
    validatePluginDefinition(definition) {
        const required = ['type', 'name', 'description', 'version'];
        
        for (const field of required) {
            if (!definition[field]) {
                throw new Error(`Plugin definition missing required field: ${field}`);
            }
        }
        
        if (!['function', 'visualization', 'utility'].includes(definition.type)) {
            throw new Error(`Invalid plugin type: ${definition.type}`);
        }
        
        if (definition.type === 'function' || definition.type === 'utility') {
            if (!definition.functions || Object.keys(definition.functions).length === 0) {
                throw new Error('Function plugins must define at least one function');
            }
        }
        
        if (definition.type === 'visualization') {
            if (!definition.supportedDataTypes || !definition.executor) {
                throw new Error('Visualization plugins must define supportedDataTypes and executor');
            }
        }
    }

    /**
     * Initialize plugin executors
     */
    async initializePluginExecutors(pluginId, pluginDefinition) {
        const executors = new Map();
        
        for (const [funcName, funcDef] of Object.entries(pluginDefinition.functions)) {
            try {
                // Load executor
                const executor = await this.loadExecutor(funcDef.executor);
                executors.set(funcName, executor);
                
            } catch (error) {
                console.error(`Failed to load executor for ${pluginId}.${funcName}:`, error);
                throw error;
            }
        }
        
        this.pluginExecutors.set(pluginId, executors);
    }

    /**
     * Load plugin executor function
     */
    async loadExecutor(executorPath) {
        // For now, return a reference to the executor
        // In future versions, this could load from external modules
        return executorPath;
    }

    /**
     * Execute plugin function with resource management
     */
    async executeFunction(pluginId, functionName, parameters = {}) {
        const startTime = performance.now();
        let executionId = null;
        
        try {
            // Check if plugin exists
            const plugin = this.getPlugin(pluginId);
            if (!plugin) {
                throw new Error(`Plugin not found: ${pluginId}`);
            }
            
            const functionDef = plugin.functions?.[functionName];
            if (!functionDef) {
                throw new Error(`Function not found: ${functionName} in plugin ${pluginId}`);
            }
            
            // Validate parameters
            this.validateParameters(parameters, functionDef.parameters);
            
            // Request execution slot if resource management is enabled
            if (this.resourceManager) {
                const request = await this.resourceManager.requestExecution(
                    pluginId, 
                    functionName, 
                    plugin.priority || 'normal'
                );
                
                if (!request.granted) {
                    throw new Error(`Execution denied: ${request.reason}`);
                }
                
                executionId = request.executionId;
            }
            
            // Execute function
            const result = await this.executePluginFunction(pluginId, functionName, parameters);
            
            // Update metrics
            this.updateExecutionMetrics(pluginId, functionName, performance.now() - startTime, true);
            
            // Release execution slot
            if (executionId) {
                this.resourceManager.releaseExecution(executionId, 'success');
            }
            
            this.emitEvent('function-executed', { 
                pluginId, 
                functionName, 
                parameters, 
                result, 
                executionTime: performance.now() - startTime 
            });
            
            return result;
            
        } catch (error) {
            // Update error metrics
            this.updateExecutionMetrics(pluginId, functionName, performance.now() - startTime, false);
            
            // Release execution slot
            if (executionId) {
                this.resourceManager.releaseExecution(executionId, 'error');
            }
            
            this.emitEvent('function-error', { 
                pluginId, 
                functionName, 
                parameters, 
                error: error.message,
                executionTime: performance.now() - startTime 
            });
            
            throw error;
        }
    }

    /**
     * Execute plugin function by full name (pluginId.functionName)
     */
    async executeFunctionByName(fullName, parameters = {}) {
        const [pluginId, functionName] = fullName.split('.');
        if (!pluginId || !functionName) {
            throw new Error('Invalid function name format. Use: pluginId.functionName');
        }
        
        return await this.executeFunction(pluginId, functionName, parameters);
    }

    /**
     * Execute the actual plugin function
     */
    async executePluginFunction(pluginId, functionName, parameters) {
        const plugin = this.getPlugin(pluginId);
        const functionDef = plugin.functions[functionName];
        
        // Get executor
        const executors = this.pluginExecutors.get(pluginId);
        const executorPath = executors?.get(functionName) || functionDef.executor;
        
        // Create execution context
        const context = {
            api: this.api,
            pluginId,
            functionName,
            parameters,
            utils: this.getUtilityFunctions()
        };
        
        // Execute based on executor type
        if (typeof executorPath === 'string') {
            return await this.executeByPath(executorPath, context);
        } else if (typeof executorPath === 'function') {
            return await executorPath(context);
        } else {
            throw new Error(`Invalid executor type for ${pluginId}.${functionName}`);
        }
    }

    /**
     * Execute function by path (legacy compatibility)
     */
    async executeByPath(executorPath, context) {
        throw new Error('Legacy executor paths are no longer supported');
    }

    /**
     * Get utility functions for plugin execution
     */
    getUtilityFunctions() {
        return {
            // Utility functions that plugins can use
            calculateGC: (sequence) => {
                const g = (sequence.match(/G/gi) || []).length;
                const c = (sequence.match(/C/gi) || []).length;
                const total = sequence.length;
                return total > 0 ? ((g + c) / total) * 100 : 0;
            },
            
            reverseComplement: (sequence) => {
                const complement = { 'A': 'T', 'T': 'A', 'G': 'C', 'C': 'G', 'N': 'N' };
                return sequence.toUpperCase()
                    .split('')
                    .reverse()
                    .map(base => complement[base] || 'N')
                    .join('');
            }
        };
    }

    /**
     * Validate function parameters
     */
    validateParameters(parameters, schema) {
        if (!schema || !schema.properties) return;

        // Check required parameters
        if (schema.required) {
            for (const required of schema.required) {
                if (!(required in parameters)) {
                    throw new Error(`Missing required parameter: ${required}`);
                }
            }
        }

        // Validate parameter types
        for (const [paramName, paramSchema] of Object.entries(schema.properties)) {
            if (paramName in parameters) {
                const value = parameters[paramName];
                if (!this.validateParameterType(value, paramSchema)) {
                    throw new Error(`Invalid type for parameter ${paramName}: expected ${paramSchema.type}`);
                }
            }
        }
    }

    /**
     * Validate parameter type
     */
    validateParameterType(value, schema) {
        switch (schema.type) {
            case 'string':
                return typeof value === 'string';
            case 'number':
                return typeof value === 'number' && !isNaN(value);
            case 'boolean':
                return typeof value === 'boolean';
            case 'array':
                return Array.isArray(value);
            case 'object':
                return typeof value === 'object' && value !== null && !Array.isArray(value);
            default:
                return true;
        }
    }

    /**
     * Update execution metrics
     */
    updateExecutionMetrics(pluginId, functionName, executionTime, success) {
        this.metrics.totalExecutions++;
        
        if (success) {
            this.metrics.successfulExecutions++;
        } else {
            this.metrics.failedExecutions++;
        }
        
        // Update average execution time
        this.metrics.averageExecutionTime = 
            (this.metrics.averageExecutionTime * (this.metrics.totalExecutions - 1) + executionTime) / 
            this.metrics.totalExecutions;
        
        // Update plugin-specific stats
        const pluginKey = `${pluginId}.${functionName}`;
        if (!this.metrics.pluginUsageStats.has(pluginKey)) {
            this.metrics.pluginUsageStats.set(pluginKey, {
                executions: 0,
                totalTime: 0,
                errors: 0
            });
        }
        
        const stats = this.metrics.pluginUsageStats.get(pluginKey);
        stats.executions++;
        stats.totalTime += executionTime;
        if (!success) stats.errors++;
        
        // Update plugin metadata
        const metadata = this.pluginMetadata.get(pluginId);
        if (metadata) {
            metadata.lastExecuted = Date.now();
            metadata.executionCount++;
            if (!success) metadata.errorCount++;
        }
    }

    /**
     * Get plugin by ID
     */
    getPlugin(pluginId) {
        for (const registry of Object.values(this.pluginRegistry)) {
            if (registry.has(pluginId)) {
                return registry.get(pluginId);
            }
        }
        return null;
    }

    /**
     * Get all available functions for LLM integration
     */
    getAvailableFunctions() {
        const functions = [];
        
        for (const [pluginId, plugin] of this.pluginRegistry.function) {
            for (const [funcName, funcDef] of Object.entries(plugin.functions || {})) {
                functions.push({
                    name: `${pluginId}.${funcName}`,
                    description: funcDef.description,
                    parameters: funcDef.parameters,
                    plugin: {
                        id: pluginId,
                        name: plugin.name,
                        version: plugin.version,
                        category: plugin.category
                    }
                });
            }
        }
        
        // Include utility functions
        for (const [pluginId, plugin] of this.pluginRegistry.utility) {
            for (const [funcName, funcDef] of Object.entries(plugin.functions || {})) {
                functions.push({
                    name: `${pluginId}.${funcName}`,
                    description: funcDef.description,
                    parameters: funcDef.parameters,
                    plugin: {
                        id: pluginId,
                        name: plugin.name,
                        version: plugin.version,
                        category: 'utility'
                    }
                });
            }
        }
        
        return functions;
    }

    /**
     * Get all available visualizations
     */
    getAvailableVisualizations() {
        const visualizations = [];
        
        for (const [pluginId, plugin] of this.pluginRegistry.visualization) {
            visualizations.push({
                id: pluginId,
                name: plugin.name,
                description: plugin.description,
                supportedDataTypes: plugin.supportedDataTypes,
                version: plugin.version
            });
        }
        
        return visualizations;
    }

    /**
     * Get system statistics
     */
    getSystemStats() {
        const stats = {
            plugins: {
                total: this.getTotalPluginCount(),
                byType: {
                    function: this.pluginRegistry.function.size,
                    visualization: this.pluginRegistry.visualization.size,
                    utility: this.pluginRegistry.utility.size
                }
            },
            execution: { ...this.metrics },
            resources: this.resourceManager ? this.resourceManager.getResourceStats() : null,
            api: this.api ? this.api.getStats() : null
        };
        
        // Add new architecture stats if available
        if (this.contributionRegistry) {
            stats.contributions = this.contributionRegistry.getStats();
        }
        
        if (this.commandRegistry) {
            stats.commands = this.commandRegistry.getStats();
        }
        
        if (this.activationService) {
            stats.activation = this.activationService.getStats();
        }
        
        if (this.extensionService) {
            stats.extensionService = this.extensionService.getStats();
        }
        
        stats.extensionContexts = this.extensionContexts.size;
        stats.newArchitectureEnabled = this.options.enableNewArchitecture;
        
        return stats;
    }

    /**
     * Get total plugin count
     */
    getTotalPluginCount() {
        return Object.values(this.pluginRegistry).reduce((total, registry) => total + registry.size, 0);
    }

    /**
     * Get ChatBox system prompt section from all plugins
     */
    getPluginSystemPromptSection() {
        if (!this.promptProvider) {
            return '';
        }
        
        return this.promptProvider.generateSystemPromptSection();
    }

    /**
     * Get plugin tool categories for ChatBox
     */
    getPluginToolCategories() {
        if (!this.promptProvider) {
            return {};
        }
        
        return this.promptProvider.getToolCategoriesForPrompt();
    }

    /**
     * Get all plugin functions for tool listing
     */
    getAllPluginFunctions() {
        if (!this.promptProvider) {
            return [];
        }
        
        return this.promptProvider.getAllPluginFunctions();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Resource management events
        if (this.resourceManager) {
            if (typeof window !== 'undefined') {
                window.addEventListener('plugin-resource-event', (event) => {
                    this.emitEvent('resource-event', event.detail);
                });
            }
        }
    }

    /**
     * Emit system events
     */
    emitEvent(eventType, data) {
        const event = new CustomEvent('plugin-system-event', {
            detail: { type: eventType, data, timestamp: Date.now() }
        });
        
        this.eventBus.dispatchEvent(event);
        
        // Also emit to window for global event handling
        if (typeof window !== 'undefined') {
            window.dispatchEvent(event);
        }
        
        console.log(`🔔 Plugin system event: ${eventType}`, data);
    }

    /**
     * Add event listener
     */
    on(eventType, callback) {
        this.eventBus.addEventListener('plugin-system-event', (event) => {
            if (event.detail.type === eventType) {
                callback(event.detail.data);
            }
        });
    }

    /**
     * Cleanup and destroy
     */
    destroy() {
        console.log('🧹 Destroying PluginManagerV2...');
        
        // Stop resource manager
        if (this.resourceManager) {
            this.resourceManager.destroy();
        }
        
        // Dispose new architecture components
        if (this.extensionService) {
            this.extensionService.dispose().catch(console.error);
            this.extensionService = null;
        }
        
        if (this.contributionRegistry) {
            this.contributionRegistry.dispose();
            this.contributionRegistry = null;
        }
        
        if (this.commandRegistry) {
            this.commandRegistry.dispose();
            this.commandRegistry = null;
        }
        
        if (this.activationService) {
            this.activationService.dispose();
            this.activationService = null;
        }
        
        if (this.pluginBridge) {
            this.pluginBridge.dispose().catch(console.error);
            this.pluginBridge = null;
        }
        
        // Dispose extension contexts
        for (const context of this.extensionContexts.values()) {
            if (context && typeof context.dispose === 'function') {
                context.dispose().catch(console.error);
            }
        }
        this.extensionContexts.clear();
        
        // Clear registries
        Object.values(this.pluginRegistry).forEach(registry => registry.clear());
        this.pluginMetadata.clear();
        this.pluginExecutors.clear();
        
        // Clear references
        this.api = null;
        this.resourceManager = null;
        
        this.emitEvent('system-destroyed', { timestamp: Date.now() });
        console.log('✅ PluginManagerV2 destroyed');
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PluginManagerV2;
} else if (typeof window !== 'undefined') {
    window.PluginManagerV2 = PluginManagerV2;
} 