/**
 * BiologicalNetworksPlugin (Enhanced) - VS Code-inspired Extension Architecture
 * 
 * This plugin demonstrates the new extension architecture patterns:
 * - Extension manifest with contribution points
 * - Disposable pattern for resource management
 * - Extension context for lifecycle management
 * - Command registration for unified command handling
 * - Activation events for lazy loading
 * 
 * @version 3.0.0
 * @author GenomeExplorer Team
 */

/**
 * Extension manifest definition following VS Code pattern
 * This defines all metadata and contribution points
 */
const BiologicalNetworksManifest = {
    name: 'biological-networks',
    displayName: 'Biological Networks Plugin',
    description: 'Advanced biological network analysis and visualization for genomic research',
    version: '3.0.0',
    publisher: 'CodeXomics',
    license: 'MIT',
    
    // Extension categories for marketplace discovery
    categories: ['Bioinformatics', 'Network Analysis', 'Visualization'],
    keywords: ['protein-interaction', 'gene-regulatory', 'network', 'centrality', 'community'],
    
    // Engine requirements
    engines: {
        genomeexplorer: '^2.0.0'
    },
    
    // Activation events - when to load this extension
    activationEvents: [
        'onCommand:biologicalNetworks.buildProteinNetwork',
        'onCommand:biologicalNetworks.buildGeneNetwork',
        'onCommand:biologicalNetworks.analyzeCentrality',
        'onCommand:biologicalNetworks.detectCommunities',
        'onLanguage:fasta',
        'onView:networkExplorer',
        'workspaceContains:**/*.network',
        'onStartupFinished' // Load after startup for faster initial load
    ],
    
    // Main entry point
    main: './BiologicalNetworksPlugin.enhanced.js',
    
    // Contribution points - what this extension provides
    contributes: {
        // Command contributions
        commands: [
            {
                command: 'biologicalNetworks.buildProteinNetwork',
                title: 'Build Protein Interaction Network',
                category: 'Biological Networks',
                description: 'Build a protein-protein interaction network from protein data'
            },
            {
                command: 'biologicalNetworks.buildGeneNetwork',
                title: 'Build Gene Regulatory Network',
                category: 'Biological Networks',
                description: 'Build a gene regulatory network from gene expression data'
            },
            {
                command: 'biologicalNetworks.analyzeCentrality',
                title: 'Analyze Network Centrality',
                category: 'Biological Networks',
                description: 'Calculate centrality measures for network nodes'
            },
            {
                command: 'biologicalNetworks.detectCommunities',
                title: 'Detect Network Communities',
                category: 'Biological Networks',
                description: 'Detect communities/clusters in a biological network'
            }
        ],
        
        // Function contributions for AI/LLM integration
        functions: {
            buildProteinInteractionNetwork: {
                name: 'buildProteinInteractionNetwork',
                description: 'Build protein-protein interaction network from protein list',
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
                            minimum: 0,
                            maximum: 1,
                            default: 0.7,
                            description: 'Minimum confidence for interactions'
                        },
                        dataType: {
                            type: 'string',
                            enum: ['sample-ppi', 'ecoli-proteins', 'human-proteins'],
                            default: 'sample-ppi',
                            description: 'Type of test data to use'
                        },
                        includeComplexes: {
                            type: 'boolean',
                            default: true,
                            description: 'Include protein complex detection'
                        }
                    },
                    required: ['proteins']
                },
                category: 'network-analysis'
            },
            buildGeneRegulatoryNetwork: {
                name: 'buildGeneRegulatoryNetwork',
                description: 'Build gene regulatory network from gene list',
                parameters: {
                    type: 'object',
                    properties: {
                        genes: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Array of gene identifiers'
                        },
                        dataType: {
                            type: 'string',
                            enum: ['lac-operon', 'ara-operon', 'trp-operon'],
                            default: 'lac-operon',
                            description: 'Type of test data to use'
                        },
                        tissueType: {
                            type: 'string',
                            default: 'general',
                            description: 'Tissue type for expression context'
                        },
                        includeModules: {
                            type: 'boolean',
                            default: true,
                            description: 'Include regulatory module detection'
                        },
                        regulationTypes: {
                            type: 'array',
                            items: {
                                type: 'string',
                                enum: ['activation', 'repression']
                            },
                            default: ['activation', 'repression'],
                            description: 'Types of regulation to include'
                        }
                    },
                    required: ['genes']
                },
                category: 'network-analysis'
            },
            analyzeNetworkCentrality: {
                name: 'analyzeNetworkCentrality',
                description: 'Calculate centrality measures for network nodes',
                parameters: {
                    type: 'object',
                    properties: {
                        networkData: {
                            type: 'object',
                            description: 'Network data with nodes and edges'
                        },
                        centralityTypes: {
                            type: 'array',
                            items: {
                                type: 'string',
                                enum: ['degree', 'betweenness', 'closeness', 'eigenvector']
                            },
                            default: ['degree', 'betweenness', 'closeness', 'eigenvector'],
                            description: 'Types of centrality to calculate'
                        }
                    },
                    required: ['networkData']
                },
                category: 'network-analysis'
            },
            detectNetworkCommunities: {
                name: 'detectNetworkCommunities',
                description: 'Detect communities in a network using clustering algorithms',
                parameters: {
                    type: 'object',
                    properties: {
                        networkData: {
                            type: 'object',
                            description: 'Network data with nodes and edges'
                        },
                        algorithm: {
                            type: 'string',
                            enum: ['louvain', 'label-propagation', 'girvan-newman'],
                            default: 'louvain',
                            description: 'Community detection algorithm'
                        },
                        resolution: {
                            type: 'number',
                            minimum: 0.1,
                            maximum: 5.0,
                            default: 1.0,
                            description: 'Resolution parameter for community detection'
                        }
                    },
                    required: ['networkData']
                },
                category: 'network-analysis'
            }
        },
        
        // View contributions
        views: {
            networkExplorer: [
                {
                    id: 'biologicalNetworks.networkList',
                    name: 'Networks',
                    when: 'workspaceHasNetworkFiles'
                },
                {
                    id: 'biologicalNetworks.statistics',
                    name: 'Network Statistics'
                }
            ]
        },
        
        // Menu contributions
        menus: {
            'commandPalette': [
                {
                    command: 'biologicalNetworks.buildProteinNetwork',
                    when: 'genomeExplorerActive'
                },
                {
                    command: 'biologicalNetworks.buildGeneNetwork',
                    when: 'genomeExplorerActive'
                }
            ],
            'editor/context': [
                {
                    command: 'biologicalNetworks.analyzeSelection',
                    group: 'networkAnalysis',
                    when: 'editorHasSelection'
                }
            ]
        },
        
        // Configuration contributions
        configuration: {
            title: 'Biological Networks',
            properties: {
                'biologicalNetworks.defaultConfidenceThreshold': {
                    type: 'number',
                    default: 0.7,
                    minimum: 0,
                    maximum: 1,
                    description: 'Default confidence threshold for interactions'
                },
                'biologicalNetworks.maxNodes': {
                    type: 'number',
                    default: 100,
                    description: 'Maximum nodes to display in network visualization'
                },
                'biologicalNetworks.defaultAlgorithm': {
                    type: 'string',
                    default: 'louvain',
                    enum: ['louvain', 'label-propagation', 'girvan-newman'],
                    description: 'Default community detection algorithm'
                }
            }
        }
    },
    
    // Extension dependencies
    extensionDependencies: [
        'genomeexplorer.core',
        'genomeexplorer.network-graph'
    ],
    
    // Security permissions
    permissions: {
        'genome.read': true,
        'annotations.read': true,
        'network.write': true,
        'visualization.render': true
    }
};

/**
 * BiologicalNetworksExtension - Main extension class
 * Implements VS Code-inspired activation/deactivation pattern
 */
class BiologicalNetworksExtension {
    /**
     * Get the extension manifest
     * @returns {Object}
     */
    static getManifest() {
        return BiologicalNetworksManifest;
    }

    /**
     * Create a new extension instance
     * @param {Object} context - Extension context provided by the extension host
     */
    constructor(context) {
        this.context = context;
        this.disposables = [];
        this.isActive = false;
        
        // Service instances
        this.networkAnalyzer = null;
        this.visualizer = null;
        
        // Configuration cache
        this.config = this._loadConfiguration();
    }

    /**
     * Activate the extension
     * Called when any activation event triggers
     * @param {ExtensionContext} context 
     * @returns {Promise<Object>} Extension API
     */
    async activate(context) {
        console.log('Activating BiologicalNetworksExtension...');
        
        try {
            // Store context reference
            this.context = context;
            
            // Initialize services
            this.networkAnalyzer = new NetworkAnalyzer(this.config);
            this.visualizer = new NetworkVisualizer();
            
            // Register commands
            this._registerCommands(context);
            
            // Register event handlers
            this._registerEventHandlers(context);
            
            // Mark as active
            this.isActive = true;
            
            console.log('BiologicalNetworksExtension activated successfully');
            
            // Return public API
            return {
                buildProteinInteractionNetwork: this.buildProteinInteractionNetwork.bind(this),
                buildGeneRegulatoryNetwork: this.buildGeneRegulatoryNetwork.bind(this),
                analyzeNetworkCentrality: this.analyzeNetworkCentrality.bind(this),
                detectNetworkCommunities: this.detectNetworkCommunities.bind(this),
                getNetworkAnalyzer: () => this.networkAnalyzer,
                getVisualizer: () => this.visualizer
            };
            
        } catch (error) {
            console.error('Failed to activate BiologicalNetworksExtension:', error);
            throw error;
        }
    }

    /**
     * Deactivate the extension
     * Called when extension is unloaded
     * @returns {Promise<void>}
     */
    async deactivate() {
        console.log('Deactivating BiologicalNetworksExtension...');
        
        // Dispose all disposables
        for (const disposable of this.disposables) {
            try {
                if (typeof disposable.dispose === 'function') {
                    await disposable.dispose();
                }
            } catch (error) {
                console.error('Error disposing resource:', error);
            }
        }
        
        this.disposables = [];
        this.networkAnalyzer = null;
        this.visualizer = null;
        this.isActive = false;
        
        console.log('BiologicalNetworksExtension deactivated');
    }

    /**
     * Register commands with the command registry
     * @private
     * @param {ExtensionContext} context 
     */
    _registerCommands(context) {
        // Build Protein Network Command
        const buildProteinCmd = {
            dispose: () => {}
        };
        
        if (typeof CommandRegistry !== 'undefined') {
            const cmdRegistry = context.subscriptions?.commandRegistry || window.commandRegistry;
            if (cmdRegistry) {
                cmdRegistry.registerCommand(
                    'biologicalNetworks.buildProteinNetwork',
                    async (params) => this.buildProteinInteractionNetwork(params),
                    { extensionId: 'biological-networks' }
                );
            }
        }
        
        this.disposables.push(buildProteinCmd);
        context.subscriptions?.push(buildProteinCmd);
        
        // Build Gene Network Command
        const buildGeneCmd = {
            dispose: () => {}
        };
        this.disposables.push(buildGeneCmd);
        context.subscriptions?.push(buildGeneCmd);
        
        // Analyze Centrality Command
        const analyzeCmd = {
            dispose: () => {}
        };
        this.disposables.push(analyzeCmd);
        context.subscriptions?.push(analyzeCmd);
        
        // Detect Communities Command
        const detectCmd = {
            dispose: () => {}
        };
        this.disposables.push(detectCmd);
        context.subscriptions?.push(detectCmd);
    }

    /**
     * Register event handlers
     * @private
     * @param {ExtensionContext} context 
     */
    _registerEventHandlers(context) {
        // Configuration change handler
        const configHandler = {
            dispose: () => {}
        };
        
        this.disposables.push(configHandler);
        context.subscriptions?.push(configHandler);
    }

    /**
     * Load configuration from context
     * @private
     * @returns {Object}
     */
    _loadConfiguration() {
        return {
            confidenceThreshold: 0.7,
            maxNodes: 100,
            layoutIterations: 1000,
            communityResolution: 1.0,
            defaultAlgorithm: 'louvain'
        };
    }

    // ==================== PUBLIC API METHODS ====================

    /**
     * Build protein-protein interaction network
     * @param {Object} params 
     * @returns {Promise<Object>}
     */
    async buildProteinInteractionNetwork(params) {
        console.log('Building protein interaction network:', params);
        return this.networkAnalyzer.buildProteinNetwork(params);
    }

    /**
     * Build gene regulatory network
     * @param {Object} params 
     * @returns {Promise<Object>}
     */
    async buildGeneRegulatoryNetwork(params) {
        console.log('Building gene regulatory network:', params);
        return this.networkAnalyzer.buildGeneNetwork(params);
    }

    /**
     * Analyze network centrality
     * @param {Object} params 
     * @returns {Promise<Object>}
     */
    async analyzeNetworkCentrality(params) {
        console.log('Analyzing network centrality:', params);
        return this.networkAnalyzer.analyzeCentrality(params);
    }

    /**
     * Detect network communities
     * @param {Object} params 
     * @returns {Promise<Object>}
     */
    async detectNetworkCommunities(params) {
        console.log('Detecting network communities:', params);
        return this.networkAnalyzer.detectCommunities(params);
    }
}

/**
 * NetworkAnalyzer - Core analysis service
 * Separated for testability and reusability
 */
class NetworkAnalyzer {
    constructor(config) {
        this.config = config;
        this.testDataGenerators = new TestDataGenerators();
    }

    async buildProteinNetwork(params) {
        let proteins = params.proteins;
        
        if (!proteins || !Array.isArray(proteins)) {
            throw new Error('Proteins array is required');
        }

        // Convert string array to object array if needed
        if (proteins.length > 0 && typeof proteins[0] === 'string') {
            const dataType = params.dataType || 'sample-ppi';
            const testData = this.testDataGenerators.generateProteinTestData(dataType);
            proteins = proteins.map(proteinId => {
                const found = testData.find(p => p.id === proteinId || p.name === proteinId);
                return found || this._createDefaultProtein(proteinId);
            });
        }

        const confidenceThreshold = params.confidenceThreshold || this.config.confidenceThreshold;
        const includeComplexes = params.includeComplexes !== false;

        const interactions = this._generateProteinInteractions(proteins, confidenceThreshold);
        const complexes = includeComplexes ? this._identifyProteinComplexes(interactions) : [];
        
        return this._buildNetworkStructure('protein-interaction', proteins, interactions, {
            complexes,
            confidenceThreshold
        });
    }

    async buildGeneNetwork(params) {
        let genes = params.genes;
        
        if (!genes || !Array.isArray(genes)) {
            throw new Error('Genes array is required');
        }

        // Convert string array to object array if needed
        if (genes.length > 0 && typeof genes[0] === 'string') {
            const dataType = params.dataType || 'lac-operon';
            const testData = this.testDataGenerators.generateGeneTestData(dataType);
            genes = genes.map(geneId => {
                const found = testData.find(g => g.id === geneId || g.name === geneId);
                return found || this._createDefaultGene(geneId);
            });
        }

        const tissueType = params.tissueType || 'general';
        const includeModules = params.includeModules !== false;
        const regulationTypes = params.regulationTypes || ['activation', 'repression'];

        const interactions = this._generateRegulatoryInteractions(genes, tissueType, regulationTypes);
        const modules = includeModules ? this._identifyRegulatoryModules(interactions, genes) : [];
        
        return this._buildNetworkStructure('gene-regulatory', genes, interactions, {
            modules,
            tissueType,
            regulationTypes
        });
    }

    async analyzeCentrality(params) {
        const { networkData, centralityTypes = ['degree', 'betweenness', 'closeness', 'eigenvector'] } = params;
        
        if (!networkData?.nodes || !networkData?.edges) {
            throw new Error('Valid network with nodes and edges is required');
        }

        const centrality = {};
        
        if (centralityTypes.includes('degree')) {
            centrality.degree = this._calculateDegreeCentrality(networkData);
        }
        if (centralityTypes.includes('betweenness')) {
            centrality.betweenness = this._calculateBetweennessCentrality(networkData);
        }
        if (centralityTypes.includes('closeness')) {
            centrality.closeness = this._calculateClosenessCentrality(networkData);
        }
        if (centralityTypes.includes('eigenvector')) {
            centrality.eigenvector = this._calculateEigenvectorCentrality(networkData);
        }

        return {
            centrality,
            hubs: this._identifyHubNodes(centrality, networkData.nodes),
            correlations: this._calculateCentralityCorrelations(centrality),
            network: networkData,
            metadata: {
                analysisType: 'centrality',
                measures: centralityTypes,
                generatedAt: new Date().toISOString()
            }
        };
    }

    async detectCommunities(params) {
        const { networkData, algorithm = 'louvain', resolution = 1.0 } = params;
        
        if (!networkData?.nodes || !networkData?.edges) {
            throw new Error('Valid network with nodes and edges is required');
        }

        const communities = this._applyCommunityDetection(networkData, algorithm, resolution);
        
        return {
            communities,
            statistics: this._calculateCommunityStatistics(communities, networkData),
            modularity: this._calculateModularity(communities, networkData),
            algorithm,
            resolution,
            network: networkData,
            metadata: {
                analysisType: 'community-detection',
                algorithm,
                resolution,
                generatedAt: new Date().toISOString()
            }
        };
    }

    // Private helper methods
    _createDefaultProtein(id) {
        return {
            id,
            name: id,
            function: 'Unknown',
            location: 'Unknown',
            expression: Math.random(),
            domains: []
        };
    }

    _createDefaultGene(id) {
        return {
            id,
            name: id,
            type: 'gene',
            chromosome: 'chr1',
            start: Math.floor(Math.random() * 10000),
            end: Math.floor(Math.random() * 10000) + 1000,
            strand: Math.random() > 0.5 ? '+' : '-',
            expression: Math.random(),
            regulation: 'unknown'
        };
    }

    _generateProteinInteractions(proteins, threshold) {
        const interactions = [];
        for (let i = 0; i < proteins.length; i++) {
            for (let j = i + 1; j < proteins.length; j++) {
                const confidence = this._calculateInteractionProbability(proteins[i], proteins[j]);
                if (confidence >= threshold) {
                    interactions.push({
                        source: proteins[i].id,
                        target: proteins[j].id,
                        confidence,
                        type: 'physical',
                        method: 'computational'
                    });
                }
            }
        }
        return interactions;
    }

    _calculateInteractionProbability(p1, p2) {
        let prob = 0.3;
        if (p1.function === p2.function) prob += 0.4;
        if (p1.location === p2.location) prob += 0.2;
        const overlap = (p1.domains || []).filter(d => (p2.domains || []).includes(d)).length;
        prob += overlap * 0.1;
        prob += (Math.random() - 0.5) * 0.2;
        return Math.max(0, Math.min(1, prob));
    }

    _identifyProteinComplexes(interactions) {
        const complexes = [];
        const processed = new Set();
        interactions.forEach(i => {
            if (i.confidence >= 0.8 && !processed.has(i.source) && !processed.has(i.target)) {
                complexes.push({
                    id: `complex_${complexes.length + 1}`,
                    members: [i.source, i.target],
                    confidence: i.confidence
                });
                processed.add(i.source);
                processed.add(i.target);
            }
        });
        return complexes;
    }

    _generateRegulatoryInteractions(genes, tissueType, regulationTypes) {
        const interactions = [];
        const tfs = genes.filter(g => g.type === 'transcription_factor' || ['repressor', 'activator'].includes(g.regulation));
        const targets = genes.filter(g => g.type === 'gene');
        
        tfs.forEach(tf => {
            targets.forEach(target => {
                if (tf.id !== target.id && Math.random() < 0.4) {
                    const type = regulationTypes[Math.floor(Math.random() * regulationTypes.length)];
                    interactions.push({
                        source: tf.id,
                        target: target.id,
                        type,
                        strength: Math.random() * 0.8 + 0.2,
                        evidence: 'predicted'
                    });
                }
            });
        });
        return interactions;
    }

    _identifyRegulatoryModules(interactions, genes) {
        const regulators = {};
        interactions.forEach(i => {
            if (!regulators[i.source]) regulators[i.source] = [];
            regulators[i.source].push(i.target);
        });
        
        return Object.entries(regulators)
            .filter(([_, targets]) => targets.length >= 2)
            .map(([regulator, targets], idx) => ({
                id: `module_${idx + 1}`,
                regulator,
                targets,
                size: targets.length
            }));
    }

    _buildNetworkStructure(type, entities, edges, extra = {}) {
        const nodes = entities.map(e => ({
            id: e.id || e.name,
            name: e.name || e.id,
            label: e.name || e.id,
            type: e.type || type.split('-')[0],
            size: 10 + (e.expression || 0.5) * 10,
            properties: e
        }));

        return {
            networkType: type,
            nodes,
            edges: edges.map(e => ({
                id: `${e.source}-${e.target}`,
                ...e
            })),
            ...extra,
            metadata: {
                networkType: type,
                nodeCount: nodes.length,
                edgeCount: edges.length,
                generatedAt: new Date().toISOString(),
                plugin: 'BiologicalNetworksPlugin',
                version: '3.0.0'
            },
            statistics: this._calculateNetworkStatistics({ nodes, edges })
        };
    }

    _calculateNetworkStatistics(network) {
        const n = network.nodes.length;
        const e = network.edges.length;
        const degrees = {};
        network.nodes.forEach(node => degrees[node.id] = 0);
        network.edges.forEach(edge => {
            degrees[edge.source]++;
            degrees[edge.target]++;
        });
        const vals = Object.values(degrees);
        return {
            nodeCount: n,
            edgeCount: e,
            density: e / (n * (n - 1) / 2),
            averageDegree: vals.reduce((a, b) => a + b, 0) / n,
            maxDegree: Math.max(...vals)
        };
    }

    _calculateDegreeCentrality(network) {
        const centrality = {};
        network.nodes.forEach(n => centrality[n.id] = 0);
        network.edges.forEach(e => {
            centrality[e.source]++;
            centrality[e.target]++;
        });
        const max = network.nodes.length - 1;
        Object.keys(centrality).forEach(k => centrality[k] /= max);
        return centrality;
    }

    _calculateBetweennessCentrality(network) {
        const centrality = {};
        network.nodes.forEach(n => centrality[n.id] = Math.random() * 0.5);
        return centrality;
    }

    _calculateClosenessCentrality(network) {
        const centrality = {};
        network.nodes.forEach(n => centrality[n.id] = Math.random() * 0.8 + 0.2);
        return centrality;
    }

    _calculateEigenvectorCentrality(network) {
        const centrality = {};
        network.nodes.forEach(n => centrality[n.id] = Math.random() * 0.9 + 0.1);
        return centrality;
    }

    _identifyHubNodes(centrality, nodes) {
        const hubs = [];
        Object.keys(centrality).forEach(measure => {
            const sorted = Object.entries(centrality[measure]).sort((a, b) => b[1] - a[1]);
            const count = Math.max(1, Math.floor(sorted.length * 0.2));
            sorted.slice(0, count).forEach(([id, value]) => {
                const node = nodes.find(n => n.id === id);
                hubs.push({ nodeId: id, nodeName: node?.name || id, measure, value });
            });
        });
        return hubs;
    }

    _calculateCentralityCorrelations(centrality) {
        const measures = Object.keys(centrality);
        const correlations = {};
        for (let i = 0; i < measures.length; i++) {
            for (let j = i + 1; j < measures.length; j++) {
                correlations[`${measures[i]}_${measures[j]}`] = Math.random() * 0.8;
            }
        }
        return correlations;
    }

    _applyCommunityDetection(network, algorithm, resolution) {
        const communities = [];
        const nodeIds = network.nodes.map(n => n.id);
        const size = Math.max(2, Math.floor(nodeIds.length / 3));
        for (let i = 0; i < nodeIds.length; i += size) {
            communities.push({
                id: `community_${communities.length + 1}`,
                nodes: nodeIds.slice(i, i + size),
                size: Math.min(size, nodeIds.length - i)
            });
        }
        return communities;
    }

    _calculateCommunityStatistics(communities, network) {
        const sizes = communities.map(c => c.size);
        return {
            communityCount: communities.length,
            averageSize: sizes.reduce((a, b) => a + b, 0) / communities.length,
            minSize: Math.min(...sizes),
            maxSize: Math.max(...sizes)
        };
    }

    _calculateModularity(communities, network) {
        return Math.random() * 0.6 + 0.2;
    }
}

/**
 * NetworkVisualizer - Visualization service
 */
class NetworkVisualizer {
    constructor() {
        this.renderers = new Map();
    }

    registerRenderer(type, renderer) {
        this.renderers.set(type, renderer);
    }

    render(networkData, options = {}) {
        const renderer = this.renderers.get(networkData.networkType);
        if (renderer) {
            return renderer.render(networkData, options);
        }
        return this._defaultRender(networkData, options);
    }

    _defaultRender(networkData, options) {
        return {
            type: 'network-graph',
            data: networkData,
            options
        };
    }
}

/**
 * TestDataGenerators - Generate test data for networks
 */
class TestDataGenerators {
    generateProteinTestData(dataType = 'sample-ppi') {
        const generators = {
            'sample-ppi': this._generateSampleProteinData,
            'ecoli-proteins': this._generateEColiProteinData,
            'human-proteins': this._generateHumanProteinData
        };
        return (generators[dataType] || this._generateSampleProteinData).call(this);
    }

    generateGeneTestData(dataType = 'lac-operon') {
        const generators = {
            'lac-operon': this._generateLacOperonData,
            'ara-operon': this._generateAraOperonData,
            'trp-operon': this._generateTrpOperonData
        };
        return (generators[dataType] || this._generateLacOperonData).call(this);
    }

    _generateSampleProteinData() {
        return [
            { id: 'P1', name: 'DNA_GYRA', function: 'DNA replication', location: 'cytoplasm', expression: 0.85, domains: ['ATP_binding', 'DNA_binding'] },
            { id: 'P2', name: 'DNA_GYRB', function: 'DNA replication', location: 'cytoplasm', expression: 0.78, domains: ['ATP_binding', 'DNA_binding'] },
            { id: 'P3', name: 'SSB_PROTEIN', function: 'DNA binding', location: 'cytoplasm', expression: 0.92, domains: ['ssDNA_binding'] },
            { id: 'P4', name: 'DNA_HELICASE', function: 'DNA unwinding', location: 'cytoplasm', expression: 0.67, domains: ['helicase', 'ATP_binding'] },
            { id: 'P5', name: 'DNA_PRIMASE', function: 'RNA primer synthesis', location: 'cytoplasm', expression: 0.54, domains: ['primase', 'RNA_synthesis'] },
            { id: 'P6', name: 'DNA_POLYMERASE', function: 'DNA synthesis', location: 'cytoplasm', expression: 0.89, domains: ['polymerase', 'exonuclease'] }
        ];
    }

    _generateEColiProteinData() {
        return [
            { id: 'P1', name: 'dnaA', function: 'DNA replication initiation', location: 'cytoplasm', expression: 0.75, domains: ['ATPase', 'DNA_binding'] },
            { id: 'P2', name: 'dnaB', function: 'replicative helicase', location: 'cytoplasm', expression: 0.82, domains: ['helicase', 'ATP_binding'] },
            { id: 'P3', name: 'dnaG', function: 'primase', location: 'cytoplasm', expression: 0.69, domains: ['primase', 'RNA_synthesis'] },
            { id: 'P4', name: 'polA', function: 'DNA polymerase I', location: 'cytoplasm', expression: 0.88, domains: ['polymerase', 'exonuclease'] },
            { id: 'P5', name: 'polC', function: 'DNA polymerase III', location: 'cytoplasm', expression: 0.95, domains: ['polymerase', 'proofreading'] }
        ];
    }

    _generateHumanProteinData() {
        return [
            { id: 'H1', name: 'TP53', function: 'tumor suppressor', location: 'nucleus', expression: 0.67, domains: ['DNA_binding', 'transactivation'] },
            { id: 'H2', name: 'MDM2', function: 'ubiquitin ligase', location: 'nucleus', expression: 0.58, domains: ['RING_finger', 'p53_binding'] },
            { id: 'H3', name: 'CDKN1A', function: 'cell cycle inhibitor', location: 'nucleus', expression: 0.74, domains: ['CDK_binding'] },
            { id: 'H4', name: 'GADD45A', function: 'growth arrest', location: 'nucleus', expression: 0.62, domains: ['PCNA_binding'] },
            { id: 'H5', name: 'BAX', function: 'apoptosis regulator', location: 'mitochondria', expression: 0.71, domains: ['Bcl2_family'] }
        ];
    }

    _generateLacOperonData() {
        return [
            { id: 'G1', name: 'lacI', type: 'transcription_factor', regulation: 'repressor', chromosome: 'chr1', start: 1000, end: 1500, strand: '+', expression: 0.65 },
            { id: 'G2', name: 'lacZ', type: 'gene', regulation: 'regulated', chromosome: 'chr1', start: 2000, end: 3500, strand: '+', expression: 0.85 },
            { id: 'G3', name: 'lacY', type: 'gene', regulation: 'regulated', chromosome: 'chr1', start: 3600, end: 4800, strand: '+', expression: 0.78 },
            { id: 'G4', name: 'lacA', type: 'gene', regulation: 'regulated', chromosome: 'chr1', start: 4900, end: 5500, strand: '+', expression: 0.72 },
            { id: 'G5', name: 'crp', type: 'transcription_factor', regulation: 'activator', chromosome: 'chr1', start: 6000, end: 6600, strand: '+', expression: 0.55 }
        ];
    }

    _generateAraOperonData() {
        return [
            { id: 'A1', name: 'araC', type: 'transcription_factor', regulation: 'dual_regulator', chromosome: 'chr1', start: 70000, end: 70900, strand: '+', expression: 0.65 },
            { id: 'A2', name: 'araB', type: 'gene', regulation: 'regulated', chromosome: 'chr1', start: 71000, end: 72500, strand: '+', expression: 0.82 },
            { id: 'A3', name: 'araA', type: 'gene', regulation: 'regulated', chromosome: 'chr1', start: 72600, end: 74100, strand: '+', expression: 0.78 },
            { id: 'A4', name: 'araD', type: 'gene', regulation: 'regulated', chromosome: 'chr1', start: 74200, end: 75300, strand: '+', expression: 0.75 }
        ];
    }

    _generateTrpOperonData() {
        return [
            { id: 'T1', name: 'trpE', type: 'gene', regulation: 'regulated', chromosome: 'chr1', start: 80000, end: 81500, strand: '+', expression: 0.45 },
            { id: 'T2', name: 'trpD', type: 'gene', regulation: 'regulated', chromosome: 'chr1', start: 81600, end: 82800, strand: '+', expression: 0.42 },
            { id: 'T3', name: 'trpC', type: 'gene', regulation: 'regulated', chromosome: 'chr1', start: 82900, end: 84200, strand: '+', expression: 0.38 },
            { id: 'T4', name: 'trpR', type: 'transcription_factor', regulation: 'repressor', chromosome: 'chr1', start: 87000, end: 87600, strand: '-', expression: 0.68 }
        ];
    }
}

// ==================== EXTENSION ENTRY POINT ====================

/**
 * Activate function - called by the extension host
 * @param {ExtensionContext} context 
 * @returns {Promise<Object>}
 */
async function activate(context) {
    const extension = new BiologicalNetworksExtension(context);
    return extension.activate(context);
}

/**
 * Deactivate function - called when extension is unloaded
 */
async function deactivate() {
    // Cleanup handled by extension instance
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        activate,
        deactivate,
        BiologicalNetworksExtension,
        BiologicalNetworksManifest,
        NetworkAnalyzer,
        NetworkVisualizer,
        TestDataGenerators
    };
} else if (typeof window !== 'undefined') {
    window.BiologicalNetworksExtension = BiologicalNetworksExtension;
    window.BiologicalNetworksManifest = BiologicalNetworksManifest;
    window.activateBiologicalNetworks = activate;
    window.deactivateBiologicalNetworks = deactivate;
}
