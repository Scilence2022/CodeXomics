/**
 * PluginManager - Core plugin system for GenomeExplorer
 * Supports function calling plugins and data visualization plugins
 * Designed for seamless integration with LLM ChatBox
 */
class PluginManager {
    constructor(app, configManager = null) {
        this.app = app;
        this.configManager = configManager;
        
        // Plugin registries
        this.functionPlugins = new Map();
        this.visualizationPlugins = new Map();
        this.loadedPlugins = new Map();
        
        // Plugin state
        this.isInitialized = false;
        this.sandbox = null;
        
        // Events
        this.eventListeners = new Map();
        
        // Initialize core systems
        this.initializeSandbox();
        this.initializeBuiltinPlugins();
        
        // Set global reference
        window.pluginManager = this;
        
        console.log('PluginManager initialized');
    }

    /**
     * Initialize plugin sandbox for security
     */
    initializeSandbox() {
        this.sandbox = {
            // Safe globals that plugins can access
            allowedGlobals: new Set([
                'console', 'Math', 'Date', 'JSON', 'parseInt', 'parseFloat',
                'Array', 'Object', 'String', 'Number', 'Boolean'
            ]),
            
            // Restricted operations
            restrictedOperations: new Set([
                'eval', 'Function', 'XMLHttpRequest', 'fetch', 'WebSocket',
                'localStorage', 'sessionStorage', 'indexedDB'
            ])
        };
    }

    /**
     * Initialize built-in plugins
     */
    initializeBuiltinPlugins() {
        // Register built-in function plugins
        this.registerBuiltinFunctionPlugins();
        
        // Register built-in visualization plugins
        this.registerBuiltinVisualizationPlugins();
        
        this.isInitialized = true;
    }

    /**
     * Register built-in function plugins
     */
    registerBuiltinFunctionPlugins() {
        // Genomic Analysis Functions
        this.registerFunctionPlugin('genomic-analysis', {
            name: 'Genomic Analysis',
            description: 'Core genomic analysis functions',
            version: '1.0.0',
            author: 'Genome AI Studio Team',
            functions: {
                analyzeGCContent: {
                    description: 'Analyze GC content in genomic regions',
                    parameters: {
                        type: 'object',
                        properties: {
                            chromosome: { type: 'string', description: 'Chromosome name' },
                            start: { type: 'number', description: 'Start position' },
                            end: { type: 'number', description: 'End position' },
                            windowSize: { type: 'number', description: 'Window size for analysis', default: 1000 }
                        },
                        required: ['chromosome', 'start', 'end']
                    },
                    execute: this.analyzeGCContent.bind(this)
                },
                
                findMotifs: {
                    description: 'Find sequence motifs in genomic regions',
                    parameters: {
                        type: 'object',
                        properties: {
                            chromosome: { type: 'string', description: 'Chromosome name' },
                            start: { type: 'number', description: 'Start position' },
                            end: { type: 'number', description: 'End position' },
                            motif: { type: 'string', description: 'Motif pattern (regex or string)' },
                            strand: { type: 'string', description: 'Strand (+, -, or both)', default: 'both' }
                        },
                        required: ['chromosome', 'start', 'end', 'motif']
                    },
                    execute: this.findMotifs.bind(this)
                },
                
                calculateDiversity: {
                    description: 'Calculate sequence diversity metrics',
                    parameters: {
                        type: 'object',
                        properties: {
                            sequences: { type: 'array', items: { type: 'string' }, description: 'Array of sequences' },
                            metric: { type: 'string', enum: ['shannon', 'simpson', 'both'], default: 'shannon' }
                        },
                        required: ['sequences']
                    },
                    execute: this.calculateDiversity.bind(this)
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
                                    }
                                }
                            },
                            analysisType: { type: 'string', enum: ['gc', 'complexity', 'similarity'], default: 'gc' }
                        },
                        required: ['regions']
                    },
                    execute: this.compareRegions.bind(this)
                }
            }
        });

        // Phylogenetic Analysis Functions
        this.registerFunctionPlugin('phylogenetic-analysis', {
            name: 'Phylogenetic Analysis',
            description: 'Phylogenetic and evolutionary analysis functions',
            version: '1.0.0',
            author: 'Genome AI Studio Team',
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
                                    }
                                }
                            },
                            method: { type: 'string', enum: ['nj', 'upgma'], default: 'nj' },
                            distanceMetric: { type: 'string', enum: ['hamming', 'jukes-cantor'], default: 'hamming' }
                        },
                        required: ['sequences']
                    },
                    execute: this.buildPhylogeneticTree.bind(this)
                },
                
                calculateEvolutionaryDistance: {
                    description: 'Calculate evolutionary distance between sequences',
                    parameters: {
                        type: 'object',
                        properties: {
                            sequence1: { type: 'string', description: 'First sequence' },
                            sequence2: { type: 'string', description: 'Second sequence' },
                            model: { type: 'string', enum: ['p-distance', 'jukes-cantor', 'kimura'], default: 'p-distance' }
                        },
                        required: ['sequence1', 'sequence2']
                    },
                    execute: this.calculateEvolutionaryDistance.bind(this)
                }
            }
        });

        // Machine Learning Functions
        this.registerFunctionPlugin('ml-analysis', {
            name: 'Machine Learning Analysis',
            description: 'Machine learning-based genomic analysis',
            version: '1.0.0',
            author: 'Genome AI Studio Team',
            functions: {
                predictGeneFunction: {
                    description: 'Predict gene function using ML models',
                    parameters: {
                        type: 'object',
                        properties: {
                            sequence: { type: 'string', description: 'Gene sequence' },
                            model: { type: 'string', enum: ['cnn', 'lstm', 'transformer'], default: 'cnn' },
                            threshold: { type: 'number', description: 'Confidence threshold', default: 0.7 }
                        },
                        required: ['sequence']
                    },
                    execute: this.predictGeneFunction.bind(this)
                },
                
                classifySequence: {
                    description: 'Classify sequences into functional categories',
                    parameters: {
                        type: 'object',
                        properties: {
                            sequences: { type: 'array', items: { type: 'string' } },
                            categories: { type: 'array', items: { type: 'string' } },
                            model: { type: 'string', default: 'random-forest' }
                        },
                        required: ['sequences']
                    },
                    execute: this.classifySequence.bind(this)
                },
                
                clusterSequences: {
                    description: 'Cluster sequences based on similarity',
                    parameters: {
                        type: 'object',
                        properties: {
                            sequences: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        id: { type: 'string' },
                                        sequence: { type: 'string' }
                                    }
                                }
                            },
                            algorithm: { type: 'string', enum: ['kmeans', 'hierarchical', 'dbscan'], default: 'kmeans' },
                            numClusters: { type: 'number', description: 'Number of clusters (for k-means)', default: 3 }
                        },
                        required: ['sequences']
                    },
                    execute: this.clusterSequences.bind(this)
                }
            }
        });
    }

    /**
     * Register built-in visualization plugins
     */
    registerBuiltinVisualizationPlugins() {
        // Phylogenetic Tree Visualization
        this.registerVisualizationPlugin('phylogenetic-tree', {
            name: 'Phylogenetic Tree',
            description: 'Interactive phylogenetic tree visualization',
            version: '1.0.0',
            author: 'Genome AI Studio Team',
            supportedDataTypes: ['newick', 'tree-object'],
            render: this.renderPhylogeneticTree.bind(this)
        });

        // Sequence Alignment Visualization
        this.registerVisualizationPlugin('sequence-alignment', {
            name: 'Sequence Alignment',
            description: 'Multiple sequence alignment visualization',
            version: '1.0.0',
            author: 'Genome AI Studio Team',
            supportedDataTypes: ['fasta', 'alignment-object'],
            render: this.renderSequenceAlignment.bind(this)
        });

        // GC Content Plot
        this.registerVisualizationPlugin('gc-content-plot', {
            name: 'GC Content Plot',
            description: 'GC content distribution visualization',
            version: '1.0.0',
            author: 'Genome AI Studio Team',
            supportedDataTypes: ['gc-data'],
            render: this.renderGCContentPlot.bind(this)
        });

        // Heatmap Visualization
        this.registerVisualizationPlugin('heatmap', {
            name: 'Heatmap',
            description: 'Interactive heatmap for genomic data',
            version: '1.0.0',
            author: 'Genome AI Studio Team',
            supportedDataTypes: ['matrix', 'expression-data'],
            render: this.renderHeatmap.bind(this)
        });

        // Network Graph
        this.registerVisualizationPlugin('network-graph', {
            name: 'Network Graph',
            description: 'Interactive network graph visualization',
            version: '1.0.0',
            author: 'Genome AI Studio Team',
            supportedDataTypes: ['network-data', 'graph-object'],
            render: this.renderNetworkGraph.bind(this)
        });

        // Dot Plot
        this.registerVisualizationPlugin('dot-plot', {
            name: 'Dot Plot',
            description: 'Sequence comparison dot plot',
            version: '1.0.0',
            author: 'Genome AI Studio Team',
            supportedDataTypes: ['sequence-comparison'],
            render: this.renderDotPlot.bind(this)
        });
    }

    /**
     * Register a function plugin
     */
    registerFunctionPlugin(id, plugin) {
        if (this.functionPlugins.has(id)) {
            throw new Error(`Function plugin ${id} already registered`);
        }

        // Validate plugin structure
        this.validateFunctionPlugin(plugin);

        // Add metadata
        plugin.id = id;
        plugin.type = 'function';
        plugin.registeredAt = new Date();

        this.functionPlugins.set(id, plugin);
        this.loadedPlugins.set(id, plugin);

        this.emit('pluginRegistered', { id, plugin, type: 'function' });
        console.log(`Function plugin registered: ${id}`);
    }

    /**
     * Register a visualization plugin
     */
    registerVisualizationPlugin(id, plugin) {
        if (this.visualizationPlugins.has(id)) {
            throw new Error(`Visualization plugin ${id} already registered`);
        }

        // Validate plugin structure
        this.validateVisualizationPlugin(plugin);

        // Add metadata
        plugin.id = id;
        plugin.type = 'visualization';
        plugin.registeredAt = new Date();

        this.visualizationPlugins.set(id, plugin);
        this.loadedPlugins.set(id, plugin);

        this.emit('pluginRegistered', { id, plugin, type: 'visualization' });
        console.log(`Visualization plugin registered: ${id}`);
    }

    /**
     * Validate function plugin structure
     */
    validateFunctionPlugin(plugin) {
        const required = ['name', 'description', 'version', 'functions'];
        for (const field of required) {
            if (!plugin[field]) {
                throw new Error(`Function plugin missing required field: ${field}`);
            }
        }

        // Validate functions
        for (const [funcName, func] of Object.entries(plugin.functions)) {
            if (!func.description || !func.parameters || !func.execute) {
                throw new Error(`Function ${funcName} missing required fields`);
            }
            if (typeof func.execute !== 'function') {
                throw new Error(`Function ${funcName} execute must be a function`);
            }
        }
    }

    /**
     * Validate visualization plugin structure
     */
    validateVisualizationPlugin(plugin) {
        const required = ['name', 'description', 'version', 'supportedDataTypes', 'render'];
        for (const field of required) {
            if (!plugin[field]) {
                throw new Error(`Visualization plugin missing required field: ${field}`);
            }
        }

        if (typeof plugin.render !== 'function') {
            throw new Error('Visualization plugin render must be a function');
        }
    }

    /**
     * Execute a function from a plugin
     */
    async executeFunction(pluginId, functionName, parameters) {
        const plugin = this.functionPlugins.get(pluginId);
        if (!plugin) {
            throw new Error(`Function plugin not found: ${pluginId}`);
        }

        const func = plugin.functions[functionName];
        if (!func) {
            throw new Error(`Function not found: ${functionName} in plugin ${pluginId}`);
        }

        try {
            // Validate parameters against schema
            this.validateParameters(parameters, func.parameters);

            // Execute function in sandbox
            const result = await this.executeFunctionSafely(func.execute, parameters);

            this.emit('functionExecuted', {
                pluginId,
                functionName,
                parameters,
                result,
                timestamp: new Date()
            });

            return result;
        } catch (error) {
            this.emit('functionError', {
                pluginId,
                functionName,
                parameters,
                error: error.message,
                timestamp: new Date()
            });
            throw error;
        }
    }

    /**
     * Render visualization
     */
    async renderVisualization(pluginId, data, container, options = {}) {
        const plugin = this.visualizationPlugins.get(pluginId);
        if (!plugin) {
            throw new Error(`Visualization plugin not found: ${pluginId}`);
        }

        try {
            const result = await plugin.render(data, container, options);

            this.emit('visualizationRendered', {
                pluginId,
                data,
                container,
                options,
                result,
                timestamp: new Date()
            });

            return result;
        } catch (error) {
            this.emit('visualizationError', {
                pluginId,
                data,
                container,
                options,
                error: error.message,
                timestamp: new Date()
            });
            throw error;
        }
    }

    /**
     * Execute function safely in sandbox
     */
    async executeFunctionSafely(func, parameters) {
        // Create limited context for function execution
        const context = {
            // Provide access to safe utilities
            Math,
            Date,
            JSON,
            console: {
                log: (...args) => console.log('[Plugin]', ...args),
                warn: (...args) => console.warn('[Plugin]', ...args),
                error: (...args) => console.error('[Plugin]', ...args)
            },
            // Provide access to app data through safe interface
            app: this.createSafeAppInterface(),
            // Provide access to MicrobeGenomicsFunctions
            MicrobeFns: window.MicrobeFns
        };

        // Execute function with limited context
        return await func.call(context, parameters);
    }

    /**
     * Create safe interface to app data
     */
    createSafeAppInterface() {
        return {
            // Safe read-only access to genome data
            getSequence: (chromosome, start, end) => {
                if (window.genomeBrowser && window.genomeBrowser.getSequence) {
                    return window.genomeBrowser.getSequence(chromosome, start, end);
                }
                return null;
            },
            
            getCurrentRegion: () => {
                if (window.genomeBrowser) {
                    return {
                        chromosome: window.genomeBrowser.currentChromosome,
                        start: window.genomeBrowser.currentPosition?.start,
                        end: window.genomeBrowser.currentPosition?.end
                    };
                }
                return null;
            },
            
            getFeatures: (chromosome, start, end) => {
                if (window.genomeBrowser && window.genomeBrowser.getFeatures) {
                    return window.genomeBrowser.getFeatures(chromosome, start, end);
                }
                return [];
            },
            
            getTrackData: (trackName) => {
                if (window.genomeBrowser && window.genomeBrowser.getTrackData) {
                    return window.genomeBrowser.getTrackData(trackName);
                }
                return null;
            }
        };
    }

    /**
     * Validate parameters against schema
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
                    throw new Error(`Invalid type for parameter ${paramName}`);
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
                return typeof value === 'number';
            case 'boolean':
                return typeof value === 'boolean';
            case 'array':
                return Array.isArray(value);
            case 'object':
                return typeof value === 'object' && value !== null;
            default:
                return true;
        }
    }

    /**
     * Get all available functions for LLM
     */
    getAvailableFunctions() {
        const functions = [];
        
        for (const [pluginId, plugin] of this.functionPlugins) {
            for (const [funcName, func] of Object.entries(plugin.functions)) {
                functions.push({
                    name: `${pluginId}.${funcName}`,
                    description: func.description,
                    parameters: func.parameters,
                    plugin: {
                        id: pluginId,
                        name: plugin.name,
                        version: plugin.version
                    }
                });
            }
        }
        
        return functions;
    }

    /**
     * Get available visualization plugins
     */
    getAvailableVisualizations() {
        const visualizations = [];
        
        for (const [pluginId, plugin] of this.visualizationPlugins) {
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
     * Execute function by full name (pluginId.functionName)
     */
    async executeFunctionByName(fullName, parameters) {
        const [pluginId, functionName] = fullName.split('.');
        if (!pluginId || !functionName) {
            throw new Error('Invalid function name format. Use: pluginId.functionName');
        }
        
        return await this.executeFunction(pluginId, functionName, parameters);
    }

    /**
     * Event system
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }

    emit(event, data) {
        if (this.eventListeners.has(event)) {
            for (const callback of this.eventListeners.get(event)) {
                try {
                    callback(data);
                } catch (error) {
                    console.error('Error in event listener:', error);
                }
            }
        }
    }

    // Built-in function implementations will be added in the next part...
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PluginManager;
} 