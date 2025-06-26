/**
 * PluginManagerV2 - Refactored plugin system core for GenomeExplorer
 * Integrates PluginAPI abstraction layer, resource management, and improved architecture
 * Replaces the legacy PluginManager with better separation of concerns
 */
class PluginManagerV2 {
    constructor(app, configManager = null, options = {}) {
        this.app = app;
        this.configManager = configManager;
        this.options = {
            enableResourceManagement: true,
            enableCaching: true,
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
        this.eventBus = new EventTarget();
        
        // Plugin registries - separated by type for better organization
        this.pluginRegistry = {
            function: new Map(),
            visualization: new Map(),
            utility: new Map()
        };
        
        // Plugin metadata and state
        this.pluginMetadata = new Map();
        this.pluginExecutors = new Map();
        
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

    async _performInitialization() {
        try {
            console.log('🔧 Initializing PluginManagerV2 components...');
            
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
            
            // 3. Load and register built-in plugins
            await this.loadBuiltinPlugins();
            console.log('✅ Built-in plugins loaded');
            
            // 4. Set up event listeners
            this.setupEventListeners();
            console.log('✅ Event listeners configured');
            
            // 5. Set global reference
            if (typeof window !== 'undefined') {
                window.pluginManagerV2 = this;
                // Maintain backward compatibility
                window.pluginManager = this;
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
        await this.registerPlugin('genomic-analysis', {
            type: 'function',
            name: 'Genomic Analysis Suite',
            description: 'Core genomic analysis functions with enhanced performance',
            version: '2.0.0',
            author: 'GenomeExplorer Team',
            category: 'sequence-analysis',
            priority: 'normal',
            
            functions: {
                analyzeGCContent: {
                    description: 'Analyze GC content in genomic regions with sliding window',
                    parameters: {
                        type: 'object',
                        properties: {
                            chromosome: { type: 'string', description: 'Chromosome identifier' },
                            start: { type: 'number', description: 'Start position (1-based)' },
                            end: { type: 'number', description: 'End position (1-based)' },
                            windowSize: { type: 'number', description: 'Window size for analysis', default: 1000 },
                            stepSize: { type: 'number', description: 'Step size for sliding window', default: 500 }
                        },
                        required: ['chromosome', 'start', 'end']
                    },
                    executor: 'PluginExecutors.analyzeGCContent'
                },
                
                findMotifs: {
                    description: 'Find sequence motifs with pattern matching',
                    parameters: {
                        type: 'object',
                        properties: {
                            chromosome: { type: 'string', description: 'Chromosome identifier' },
                            start: { type: 'number', description: 'Start position' },
                            end: { type: 'number', description: 'End position' },
                            motif: { type: 'string', description: 'Motif pattern (regex supported)' },
                            strand: { type: 'string', enum: ['+', '-', 'both'], default: 'both' },
                            maxMismatches: { type: 'number', description: 'Maximum allowed mismatches', default: 0 }
                        },
                        required: ['chromosome', 'start', 'end', 'motif']
                    },
                    executor: 'PluginExecutors.findMotifs'
                },
                
                calculateDiversity: {
                    description: 'Calculate sequence diversity metrics',
                    parameters: {
                        type: 'object',
                        properties: {
                            sequences: { 
                                type: 'array', 
                                items: { type: 'string' }, 
                                description: 'Array of sequences to analyze' 
                            },
                            metric: { 
                                type: 'string', 
                                enum: ['shannon', 'simpson', 'both'], 
                                default: 'shannon' 
                            },
                            normalize: { type: 'boolean', description: 'Normalize sequences', default: true }
                        },
                        required: ['sequences']
                    },
                    executor: 'PluginExecutors.calculateDiversity'
                },
                
                compareRegions: {
                    description: 'Compare multiple genomic regions',
                    parameters: {
                        type: 'object',
                        properties: {
                            regions: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        chromosome: { type: 'string' },
                                        start: { type: 'number' },
                                        end: { type: 'number' },
                                        name: { type: 'string' }
                                    },
                                    required: ['chromosome', 'start', 'end']
                                }
                            },
                            analysisType: { 
                                type: 'string', 
                                enum: ['gc', 'complexity', 'similarity', 'all'], 
                                default: 'gc' 
                            }
                        },
                        required: ['regions']
                    },
                    executor: 'PluginExecutors.compareRegions'
                }
            }
        });

        // Phylogenetic Analysis Plugin
        await this.registerPlugin('phylogenetic-analysis', {
            type: 'function',
            name: 'Phylogenetic Analysis',
            description: 'Advanced phylogenetic and evolutionary analysis',
            version: '2.0.0',
            author: 'GenomeExplorer Team',
            category: 'evolutionary-analysis',
            priority: 'normal',
            
            functions: {
                buildPhylogeneticTree: {
                    description: 'Build phylogenetic tree from sequences',
                    parameters: {
                        type: 'object',
                        properties: {
                            sequences: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        id: { type: 'string' },
                                        sequence: { type: 'string' },
                                        name: { type: 'string' }
                                    },
                                    required: ['id', 'sequence']
                                }
                            },
                            method: { type: 'string', enum: ['nj', 'upgma', 'ml'], default: 'nj' },
                            distanceMetric: { type: 'string', enum: ['hamming', 'jukes-cantor', 'kimura'], default: 'hamming' },
                            bootstrap: { type: 'number', description: 'Bootstrap replicates', default: 0 }
                        },
                        required: ['sequences']
                    },
                    executor: 'PluginExecutors.buildPhylogeneticTree'
                },
                
                calculateEvolutionaryDistance: {
                    description: 'Calculate evolutionary distance between sequences',
                    parameters: {
                        type: 'object',
                        properties: {
                            sequence1: { type: 'string', description: 'First sequence' },
                            sequence2: { type: 'string', description: 'Second sequence' },
                            model: { type: 'string', enum: ['p-distance', 'jukes-cantor', 'kimura'], default: 'p-distance' },
                            gapHandling: { type: 'string', enum: ['pairwise', 'complete', 'ignore'], default: 'pairwise' }
                        },
                        required: ['sequence1', 'sequence2']
                    },
                    executor: 'PluginExecutors.calculateEvolutionaryDistance'
                }
            }
        });

        // Machine Learning Analysis Plugin
        await this.registerPlugin('ml-analysis', {
            type: 'function',
            name: 'Machine Learning Analysis',
            description: 'AI-powered genomic analysis and prediction',
            version: '2.0.0',
            author: 'GenomeExplorer Team',
            category: 'ai-analysis',
            priority: 'low',
            
            functions: {
                predictGeneFunction: {
                    description: 'Predict gene function using ML models',
                    parameters: {
                        type: 'object',
                        properties: {
                            sequence: { type: 'string', description: 'Gene sequence' },
                            model: { type: 'string', enum: ['cnn', 'lstm', 'transformer'], default: 'cnn' },
                            threshold: { type: 'number', description: 'Confidence threshold', default: 0.7 },
                            includeScores: { type: 'boolean', description: 'Include prediction scores', default: false }
                        },
                        required: ['sequence']
                    },
                    executor: 'PluginExecutors.predictGeneFunction'
                },
                
                classifySequence: {
                    description: 'Classify sequences into functional categories',
                    parameters: {
                        type: 'object',
                        properties: {
                            sequences: { type: 'array', items: { type: 'string' } },
                            categories: { type: 'array', items: { type: 'string' } },
                            model: { type: 'string', default: 'random-forest' },
                            crossValidation: { type: 'boolean', default: false }
                        },
                        required: ['sequences']
                    },
                    executor: 'PluginExecutors.classifySequence'
                }
            }
        });
    }

    /**
     * Register built-in visualization plugins
     */
    async registerBuiltinVisualizationPlugins() {
        await this.registerPlugin('phylogenetic-tree-viz', {
            type: 'visualization',
            name: 'Phylogenetic Tree Visualization',
            description: 'Interactive phylogenetic tree renderer',
            version: '2.0.0',
            supportedDataTypes: ['phylogenetic-tree', 'distance-matrix'],
            executor: 'VisualizationRenderers.renderPhylogeneticTree'
        });

        await this.registerPlugin('sequence-alignment-viz', {
            type: 'visualization',
            name: 'Sequence Alignment Visualization',
            description: 'Multiple sequence alignment viewer',
            version: '2.0.0',
            supportedDataTypes: ['sequence-alignment', 'sequences'],
            executor: 'VisualizationRenderers.renderSequenceAlignment'
        });

        await this.registerPlugin('gc-content-plot', {
            type: 'visualization',
            name: 'GC Content Plot',
            description: 'GC content distribution visualization',
            version: '2.0.0',
            supportedDataTypes: ['gc-analysis', 'genomic-windows'],
            executor: 'VisualizationRenderers.renderGCContentPlot'
        });
    }

    /**
     * Register built-in utility plugins
     */
    async registerBuiltinUtilityPlugins() {
        await this.registerPlugin('sequence-utils', {
            type: 'utility',
            name: 'Sequence Utilities',
            description: 'Common sequence manipulation utilities',
            version: '2.0.0',
            functions: {
                reverseComplement: {
                    description: 'Get reverse complement of DNA sequence',
                    parameters: {
                        type: 'object',
                        properties: {
                            sequence: { type: 'string', description: 'DNA sequence' }
                        },
                        required: ['sequence']
                    },
                    executor: 'UtilityExecutors.reverseComplement'
                },
                
                translateSequence: {
                    description: 'Translate DNA to protein sequence',
                    parameters: {
                        type: 'object',
                        properties: {
                            sequence: { type: 'string', description: 'DNA sequence' },
                            frame: { type: 'number', enum: [1, 2, 3, -1, -2, -3], default: 1 },
                            geneticCode: { type: 'string', default: 'standard' }
                        },
                        required: ['sequence']
                    },
                    executor: 'UtilityExecutors.translateSequence'
                }
            }
        });
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
            
            // Register plugin
            this.pluginRegistry[pluginDefinition.type].set(pluginId, pluginDefinition);
            this.pluginMetadata.set(pluginId, metadata);
            
            // Initialize plugin executors if needed
            if (pluginDefinition.functions) {
                await this.initializePluginExecutors(pluginId, pluginDefinition);
            }
            
            this.emitEvent('plugin-registered', { pluginId, type: pluginDefinition.type });
            console.log(`✅ Plugin registered: ${pluginId} (${pluginDefinition.type})`);
            
        } catch (error) {
            console.error(`❌ Failed to register plugin ${pluginId}:`, error);
            throw error;
        }
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
        // Handle legacy executor paths
        if (executorPath.startsWith('PluginExecutors.')) {
            const funcName = executorPath.replace('PluginExecutors.', '');
            
            // Import legacy implementations
            if (typeof require !== 'undefined') {
                const PluginImplementations = require('./PluginImplementations');
                const impl = PluginImplementations.init(this.app, this.configManager);
                
                if (typeof impl[funcName] === 'function') {
                    return await impl[funcName](context.parameters);
                }
            }
        }
        
        throw new Error(`Executor not found: ${executorPath}`);
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
        return {
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
    }

    /**
     * Get total plugin count
     */
    getTotalPluginCount() {
        return Object.values(this.pluginRegistry).reduce((total, registry) => total + registry.size, 0);
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
        
        // Also emit to window if available (for backward compatibility)
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