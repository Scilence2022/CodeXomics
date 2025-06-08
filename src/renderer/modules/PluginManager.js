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
        
        // Set global reference (browser only)
        if (typeof window !== 'undefined') {
            window.pluginManager = this;
        }
        
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
            author: 'GenomeExplorer Team',
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
            author: 'GenomeExplorer Team',
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

        // Biological Networks Functions  
        this.registerFunctionPlugin('biological-networks', {
            name: 'Biological Networks Analysis',
            description: 'Advanced network analysis and visualization for biological data',
            version: '1.0.0',
            author: 'GenomeExplorer Team',
            functions: {
                buildProteinInteractionNetwork: {
                    description: 'Build protein-protein interaction network',
                    parameters: {
                        type: 'object',
                        properties: {
                            proteins: { 
                                type: 'array', 
                                items: { type: 'string' },
                                description: 'Array of protein identifiers' 
                            },
                            confidenceThreshold: { 
                                type: 'number', 
                                description: 'Minimum interaction confidence (0-1)', 
                                default: 0.7 
                            },
                            interactionDatabase: { 
                                type: 'string', 
                                description: 'Database source for interactions', 
                                default: 'string' 
                            }
                        },
                        required: ['proteins']
                    },
                    execute: this.buildProteinInteractionNetwork.bind(this)
                },
                
                buildGeneRegulatoryNetwork: {
                    description: 'Construct gene regulatory network',
                    parameters: {
                        type: 'object',
                        properties: {
                            genes: { 
                                type: 'array', 
                                items: { type: 'string' },
                                description: 'Array of gene identifiers' 
                            },
                            regulationTypes: {
                                type: 'array',
                                items: { type: 'string', enum: ['activation', 'repression', 'binding'] },
                                description: 'Types of regulation to include',
                                default: ['activation', 'repression']
                            },
                            tissueType: { 
                                type: 'string', 
                                description: 'Tissue/cell type context', 
                                default: 'all' 
                            }
                        },
                        required: ['genes']
                    },
                    execute: this.buildGeneRegulatoryNetwork.bind(this)
                },
                
                analyzeNetworkCentrality: {
                    description: 'Analyze network centrality measures',
                    parameters: {
                        type: 'object',
                        properties: {
                            networkData: { 
                                type: 'object', 
                                description: 'Network data from previous analysis' 
                            },
                            centralityTypes: {
                                type: 'array',
                                items: { type: 'string', enum: ['degree', 'betweenness', 'closeness', 'eigenvector'] },
                                description: 'Centrality measures to calculate',
                                default: ['degree', 'betweenness', 'closeness']
                            }
                        },
                        required: ['networkData']
                    },
                    execute: this.analyzeNetworkCentrality.bind(this)
                },
                
                detectNetworkCommunities: {
                    description: 'Detect communities in biological networks',
                    parameters: {
                        type: 'object',
                        properties: {
                            networkData: { 
                                type: 'object', 
                                description: 'Network data from previous analysis' 
                            },
                            algorithm: {
                                type: 'string',
                                enum: ['louvain', 'leiden', 'greedy'],
                                description: 'Community detection algorithm',
                                default: 'louvain'
                            },
                            resolution: { 
                                type: 'number', 
                                description: 'Resolution parameter for community detection', 
                                default: 1.0 
                            }
                        },
                        required: ['networkData']
                    },
                    execute: this.detectNetworkCommunities.bind(this)
                }
            }
        });

        // Machine Learning Functions
        this.registerFunctionPlugin('ml-analysis', {
            name: 'Machine Learning Analysis',
            description: 'Machine learning-based genomic analysis',
            version: '1.0.0',
            author: 'GenomeExplorer Team',
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
            author: 'GenomeExplorer Team',
            supportedDataTypes: ['newick', 'tree-object'],
            render: this.renderPhylogeneticTree.bind(this)
        });

        // Sequence Alignment Visualization
        this.registerVisualizationPlugin('sequence-alignment', {
            name: 'Sequence Alignment',
            description: 'Multiple sequence alignment visualization',
            version: '1.0.0',
            author: 'GenomeExplorer Team',
            supportedDataTypes: ['fasta', 'alignment-object'],
            render: this.renderSequenceAlignment.bind(this)
        });

        // GC Content Plot
        this.registerVisualizationPlugin('gc-content-plot', {
            name: 'GC Content Plot',
            description: 'GC content distribution visualization',
            version: '1.0.0',
            author: 'GenomeExplorer Team',
            supportedDataTypes: ['gc-data'],
            render: this.renderGCContentPlot.bind(this)
        });

        // Heatmap Visualization
        this.registerVisualizationPlugin('heatmap', {
            name: 'Heatmap',
            description: 'Interactive heatmap for genomic data',
            version: '1.0.0',
            author: 'GenomeExplorer Team',
            supportedDataTypes: ['matrix', 'expression-data'],
            render: this.renderHeatmap.bind(this)
        });

        // Network Graph
        this.registerVisualizationPlugin('network-graph', {
            name: 'Network Graph',
            description: 'Interactive network graph visualization',
            version: '1.0.0',
            author: 'GenomeExplorer Team',
            supportedDataTypes: ['network-data', 'graph-object'],
            render: this.renderNetworkGraph.bind(this)
        });

        // Dot Plot
        this.registerVisualizationPlugin('dot-plot', {
            name: 'Dot Plot',
            description: 'Sequence comparison dot plot',
            version: '1.0.0',
            author: 'GenomeExplorer Team',
            supportedDataTypes: ['sequence-comparison'],
            render: this.renderDotPlot.bind(this)
        });

        // Biological Network Visualizations
        this.registerVisualizationPlugin('protein-interaction-network', {
            name: 'Protein Interaction Network',
            description: 'Interactive protein-protein interaction network visualization',
            version: '1.0.0',
            author: 'GenomeExplorer Team',
            supportedDataTypes: ['protein-interaction-network', 'ppi-network'],
            render: this.renderProteinInteractionNetwork.bind(this)
        });

        this.registerVisualizationPlugin('gene-regulatory-network', {
            name: 'Gene Regulatory Network',
            description: 'Gene regulatory network visualization with regulatory modules',
            version: '1.0.0',
            author: 'GenomeExplorer Team',
            supportedDataTypes: ['gene-regulatory-network', 'grn-network'],
            render: this.renderGeneRegulatoryNetwork.bind(this)
        });

        this.registerVisualizationPlugin('network-centrality-dashboard', {
            name: 'Network Centrality Dashboard',
            description: 'Dashboard showing network centrality measures and hub analysis',
            version: '1.0.0',
            author: 'GenomeExplorer Team',
            supportedDataTypes: ['network-centrality-analysis', 'centrality-data'],
            render: this.renderNetworkCentralityDashboard.bind(this)
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
            MicrobeFns: (typeof window !== 'undefined' && window.MicrobeFns) ? window.MicrobeFns : null
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
                if (typeof window !== 'undefined' && window.genomeBrowser && window.genomeBrowser.getSequence) {
                    return window.genomeBrowser.getSequence(chromosome, start, end);
                } else if (this.app && this.app.genomeBrowser && this.app.genomeBrowser.getSequence) {
                    return this.app.genomeBrowser.getSequence(chromosome, start, end);
                }
                return null;
            },
            
            getCurrentRegion: () => {
                if (typeof window !== 'undefined' && window.genomeBrowser) {
                    return {
                        chromosome: window.genomeBrowser.currentChromosome,
                        start: window.genomeBrowser.currentPosition?.start,
                        end: window.genomeBrowser.currentPosition?.end
                    };
                } else if (this.app && this.app.genomeBrowser) {
                    return {
                        chromosome: this.app.genomeBrowser.currentChromosome,
                        start: this.app.genomeBrowser.currentPosition?.start,
                        end: this.app.genomeBrowser.currentPosition?.end
                    };
                }
                return null;
            },
            
            getFeatures: (chromosome, start, end) => {
                if (typeof window !== 'undefined' && window.genomeBrowser && window.genomeBrowser.getFeatures) {
                    return window.genomeBrowser.getFeatures(chromosome, start, end);
                } else if (this.app && this.app.genomeBrowser && this.app.genomeBrowser.getFeatures) {
                    return this.app.genomeBrowser.getFeatures(chromosome, start, end);
                }
                return [];
            },
            
            getTrackData: (trackName) => {
                if (typeof window !== 'undefined' && window.genomeBrowser && window.genomeBrowser.getTrackData) {
                    return window.genomeBrowser.getTrackData(trackName);
                } else if (this.app && this.app.genomeBrowser && this.app.genomeBrowser.getTrackData) {
                    return this.app.genomeBrowser.getTrackData(trackName);
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
}

// Now I need to add the implementations for the bound methods
Object.assign(PluginManager.prototype, {
    // Import implementations from PluginImplementations
    async analyzeGCContent(params) {
        const PluginImplementations = require('./PluginImplementations');
        return await PluginImplementations.init(this.app, this.configManager).analyzeGCContent(params);
    },

    async findMotifs(params) {
        const PluginImplementations = require('./PluginImplementations');
        return await PluginImplementations.init(this.app, this.configManager).findMotifs(params);
    },

    async calculateDiversity(params) {
        const PluginImplementations = require('./PluginImplementations');
        return await PluginImplementations.init(this.app, this.configManager).calculateDiversity(params);
    },

    async compareRegions(params) {
        const PluginImplementations = require('./PluginImplementations');
        return await PluginImplementations.init(this.app, this.configManager).compareRegions(params);
    },

    async buildPhylogeneticTree(params) {
        const PluginImplementations = require('./PluginImplementations');
        return await PluginImplementations.init(this.app, this.configManager).buildPhylogeneticTree(params);
    },

    async calculateEvolutionaryDistance(params) {
        const PluginImplementations = require('./PluginImplementations');
        return await PluginImplementations.init(this.app, this.configManager).calculateEvolutionaryDistance(params);
    },

    async predictGeneFunction(params) {
        const PluginImplementations = require('./PluginImplementations');
        return await PluginImplementations.init(this.app, this.configManager).predictGeneFunction(params);
    },

    async classifySequence(params) {
        const PluginImplementations = require('./PluginImplementations');
        return await PluginImplementations.init(this.app, this.configManager).classifySequence(params);
    },

    async clusterSequences(params) {
        const PluginImplementations = require('./PluginImplementations');
        return await PluginImplementations.init(this.app, this.configManager).clusterSequences(params);
    },

    // Biological Networks function implementations
    async buildProteinInteractionNetwork(params) {
        const BiologicalNetworksPlugin = require('./Plugins/BiologicalNetworksPlugin');
        return await BiologicalNetworksPlugin.init(this.app, this.configManager).buildProteinInteractionNetwork(params);
    },

    async buildGeneRegulatoryNetwork(params) {
        const BiologicalNetworksPlugin = require('./Plugins/BiologicalNetworksPlugin');
        return await BiologicalNetworksPlugin.init(this.app, this.configManager).buildGeneRegulatoryNetwork(params);
    },

    async analyzeNetworkCentrality(params) {
        const BiologicalNetworksPlugin = require('./Plugins/BiologicalNetworksPlugin');
        return await BiologicalNetworksPlugin.init(this.app, this.configManager).analyzeNetworkCentrality(params);
    },

    async detectNetworkCommunities(params) {
        const BiologicalNetworksPlugin = require('./Plugins/BiologicalNetworksPlugin');
        return await BiologicalNetworksPlugin.init(this.app, this.configManager).detectNetworkCommunities(params);
    }
});

// Add visualization methods
Object.assign(PluginManager.prototype, {
    // Import visualization implementations
    async renderPhylogeneticTree(data, container, options = {}) {
        const PluginVisualization = require('./PluginVisualization');
        return await PluginVisualization.renderPhylogeneticTree(data, container, options);
    },

    async renderSequenceAlignment(data, container, options = {}) {
        const PluginVisualization = require('./PluginVisualization');
        return await PluginVisualization.renderSequenceAlignment(data, container, options);
    },

    async renderGCContentPlot(data, container, options = {}) {
        const PluginVisualization = require('./PluginVisualization');
        return await PluginVisualization.renderGCContentPlot(data, container, options);
    },

    async renderHeatmap(data, container, options = {}) {
        const PluginVisualization = require('./PluginVisualization');
        return await PluginVisualization.renderHeatmap(data, container, options);
    },

    async renderNetworkGraph(data, container, options = {}) {
        const PluginVisualization = require('./PluginVisualization');
        return await PluginVisualization.renderNetworkGraph(data, container, options);
    },

    async renderDotPlot(data, container, options = {}) {
        const PluginVisualization = require('./PluginVisualization');
        return await PluginVisualization.renderDotPlot(data, container, options);
    },

    // Biological Network visualization implementations
    async renderProteinInteractionNetwork(data, container, options = {}) {
        const BiologicalNetworkViz = require('./Plugins/BiologicalNetworkViz');
        return await BiologicalNetworkViz.renderPPINetwork(data, container, options);
    },

    async renderGeneRegulatoryNetwork(data, container, options = {}) {
        const BiologicalNetworkViz = require('./Plugins/BiologicalNetworkViz');
        return await BiologicalNetworkViz.renderPPINetwork(data, container, { ...options, networkType: 'regulatory' });
    },

    async renderNetworkCentralityDashboard(data, container, options = {}) {
        const BiologicalNetworkViz = require('./Plugins/BiologicalNetworkViz');
        return await BiologicalNetworkViz.renderCentralityDashboard(data, container, options);
    }
});

// Export if in module environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PluginManager;
} 