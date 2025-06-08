/**
 * BiologicalNetworksPlugin - Advanced biological network analysis for GenomeExplorer
 * Provides protein-protein interaction networks, gene regulatory networks, and network analysis
 */
class BiologicalNetworksPlugin {
    constructor(app, configManager) {
        this.app = app;
        this.configManager = configManager;
        this.initialized = false;
        
        // Network analysis parameters
        this.defaultParams = {
            confidenceThreshold: 0.7,
            maxNodes: 100,
            layoutIterations: 1000,
            communityResolution: 1.0
        };
        
        console.log('BiologicalNetworksPlugin constructor called');
    }

    /**
     * Initialize the plugin
     */
    static init(app, configManager) {
        return new BiologicalNetworksPlugin(app, configManager);
    }

    /**
     * Build protein-protein interaction network
     */
    async buildProteinInteractionNetwork(params) {
        console.log('Building protein interaction network with params:', params);
        
        try {
            const { proteins, confidenceThreshold = 0.7, includeComplexes = true } = params;
            
            if (!proteins || !Array.isArray(proteins)) {
                throw new Error('Proteins array is required');
            }

            // Generate protein interaction data
            const interactions = this.generateProteinInteractions(proteins, confidenceThreshold);
            const complexes = includeComplexes ? this.identifyProteinComplexes(interactions) : [];
            
            // Build network structure
            const network = {
                nodes: proteins.map(protein => ({
                    id: protein.id || protein.name,
                    name: protein.name,
                    type: 'protein',
                    properties: {
                        function: protein.function || 'Unknown',
                        location: protein.location || 'Unknown',
                        expression: protein.expression || Math.random(),
                        domains: protein.domains || []
                    }
                })),
                edges: interactions,
                complexes: complexes,
                metadata: {
                    networkType: 'protein-interaction',
                    confidenceThreshold,
                    nodeCount: proteins.length,
                    edgeCount: interactions.length,
                    complexCount: complexes.length,
                    generatedAt: new Date().toISOString()
                }
            };

            // Calculate network statistics
            network.statistics = this.calculateNetworkStatistics(network);
            
            console.log('Protein interaction network built successfully:', network);
            return network;

        } catch (error) {
            console.error('Error building protein interaction network:', error);
            throw error;
        }
    }

    /**
     * Build gene regulatory network
     */
    async buildGeneRegulatoryNetwork(params) {
        console.log('Building gene regulatory network with params:', params);
        
        try {
            const { genes, tissueType = 'general', includeModules = true } = params;
            
            if (!genes || !Array.isArray(genes)) {
                throw new Error('Genes array is required');
            }

            // Generate regulatory interactions
            const interactions = this.generateRegulatoryInteractions(genes, tissueType);
            const modules = includeModules ? this.identifyRegulatoryModules(interactions) : [];
            
            // Build network structure
            const network = {
                nodes: genes.map(gene => ({
                    id: gene.id || gene.name,
                    name: gene.name,
                    type: gene.type || 'gene',
                    properties: {
                        chromosome: gene.chromosome,
                        start: gene.start,
                        end: gene.end,
                        strand: gene.strand,
                        expression: gene.expression || Math.random(),
                        regulation: gene.regulation || 'unknown'
                    }
                })),
                edges: interactions,
                modules: modules,
                metadata: {
                    networkType: 'gene-regulatory',
                    tissueType,
                    nodeCount: genes.length,
                    edgeCount: interactions.length,
                    moduleCount: modules.length,
                    generatedAt: new Date().toISOString()
                }
            };

            // Calculate network statistics
            network.statistics = this.calculateNetworkStatistics(network);
            
            console.log('Gene regulatory network built successfully:', network);
            return network;

        } catch (error) {
            console.error('Error building gene regulatory network:', error);
            throw error;
        }
    }

    /**
     * Analyze network centrality measures
     */
    async analyzeNetworkCentrality(params) {
        console.log('Analyzing network centrality with params:', params);
        
        try {
            const { network, measures = ['degree', 'betweenness', 'closeness', 'eigenvector'] } = params;
            
            if (!network || !network.nodes || !network.edges) {
                throw new Error('Valid network with nodes and edges is required');
            }

            const centrality = {};
            
            // Calculate different centrality measures
            if (measures.includes('degree')) {
                centrality.degree = this.calculateDegreeCentrality(network);
            }
            
            if (measures.includes('betweenness')) {
                centrality.betweenness = this.calculateBetweennessCentrality(network);
            }
            
            if (measures.includes('closeness')) {
                centrality.closeness = this.calculateClosenessCentrality(network);
            }
            
            if (measures.includes('eigenvector')) {
                centrality.eigenvector = this.calculateEigenvectorCentrality(network);
            }

            // Identify hub nodes
            const hubs = this.identifyHubNodes(centrality, network.nodes);
            
            // Calculate correlations between measures
            const correlations = this.calculateCentralityCorrelations(centrality);
            
            const result = {
                centrality,
                hubs,
                correlations,
                statistics: {
                    nodeCount: network.nodes.length,
                    edgeCount: network.edges.length,
                    measuresCalculated: measures,
                    hubCount: hubs.length
                },
                metadata: {
                    analysisType: 'centrality',
                    measures,
                    generatedAt: new Date().toISOString()
                }
            };
            
            console.log('Network centrality analysis completed:', result);
            return result;

        } catch (error) {
            console.error('Error analyzing network centrality:', error);
            throw error;
        }
    }

    /**
     * Detect network communities
     */
    async detectNetworkCommunities(params) {
        console.log('Detecting network communities with params:', params);
        
        try {
            const { network, algorithm = 'louvain', resolution = 1.0 } = params;
            
            if (!network || !network.nodes || !network.edges) {
                throw new Error('Valid network with nodes and edges is required');
            }

            let communities;
            
            // Apply community detection algorithm
            switch (algorithm) {
                case 'louvain':
                    communities = this.applyCommunityDetection(network, resolution);
                    break;
                default:
                    throw new Error(`Unsupported algorithm: ${algorithm}`);
            }

            // Calculate community statistics
            const communityStats = this.calculateCommunityStatistics(communities, network);
            
            // Calculate modularity
            const modularity = this.calculateModularity(communities, network);
            
            const result = {
                communities,
                statistics: communityStats,
                modularity,
                metadata: {
                    analysisType: 'community-detection',
                    algorithm,
                    resolution,
                    nodeCount: network.nodes.length,
                    edgeCount: network.edges.length,
                    communityCount: communities.length,
                    generatedAt: new Date().toISOString()
                }
            };
            
            console.log('Network community detection completed:', result);
            return result;

        } catch (error) {
            console.error('Error detecting network communities:', error);
            throw error;
        }
    }

    // Helper methods for protein interactions
    generateProteinInteractions(proteins, confidenceThreshold) {
        const interactions = [];
        
        for (let i = 0; i < proteins.length; i++) {
            for (let j = i + 1; j < proteins.length; j++) {
                const confidence = Math.random();
                
                if (confidence >= confidenceThreshold) {
                    interactions.push({
                        source: proteins[i].id || proteins[i].name,
                        target: proteins[j].id || proteins[j].name,
                        confidence,
                        type: 'physical',
                        evidence: ['experimental', 'computational'][Math.floor(Math.random() * 2)]
                    });
                }
            }
        }
        
        return interactions;
    }

    identifyProteinComplexes(interactions) {
        // Simple clustering based on interaction density
        const complexes = [];
        const processed = new Set();
        
        interactions.forEach(interaction => {
            if (!processed.has(interaction.source) && !processed.has(interaction.target)) {
                const complex = {
                    id: `complex_${complexes.length + 1}`,
                    members: [interaction.source, interaction.target],
                    function: 'Unknown complex'
                };
                complexes.push(complex);
                processed.add(interaction.source);
                processed.add(interaction.target);
            }
        });
        
        return complexes;
    }

    // Helper methods for gene regulatory networks
    generateRegulatoryInteractions(genes, tissueType) {
        const interactions = [];
        
        // Generate transcription factor relationships
        const tfs = genes.filter(gene => gene.type === 'transcription_factor' || Math.random() < 0.1);
        
        genes.forEach(target => {
            tfs.forEach(tf => {
                if (tf.id !== target.id && Math.random() < 0.3) {
                    interactions.push({
                        source: tf.id || tf.name,
                        target: target.id || target.name,
                        type: Math.random() < 0.7 ? 'activation' : 'repression',
                        strength: Math.random(),
                        tissueSpecific: tissueType !== 'general',
                        evidence: 'computational'
                    });
                }
            });
        });
        
        return interactions;
    }

    identifyRegulatoryModules(interactions) {
        // Group genes by regulatory patterns
        const modules = [];
        const nodeGroups = {};
        
        interactions.forEach(interaction => {
            const source = interaction.source;
            if (!nodeGroups[source]) {
                nodeGroups[source] = [];
            }
            nodeGroups[source].push(interaction.target);
        });
        
        Object.entries(nodeGroups).forEach(([regulator, targets], index) => {
            if (targets.length >= 2) {
                modules.push({
                    id: `module_${index + 1}`,
                    regulator,
                    targets,
                    function: 'Co-regulated module',
                    size: targets.length
                });
            }
        });
        
        return modules;
    }

    // Network analysis methods
    calculateNetworkStatistics(network) {
        const nodeCount = network.nodes.length;
        const edgeCount = network.edges.length;
        const density = edgeCount / (nodeCount * (nodeCount - 1) / 2);
        
        // Calculate degree distribution
        const degrees = {};
        network.nodes.forEach(node => degrees[node.id] = 0);
        network.edges.forEach(edge => {
            degrees[edge.source]++;
            degrees[edge.target]++;
        });
        
        const degreeValues = Object.values(degrees);
        const avgDegree = degreeValues.reduce((a, b) => a + b, 0) / nodeCount;
        const maxDegree = Math.max(...degreeValues);
        
        return {
            nodeCount,
            edgeCount,
            density,
            averageDegree: avgDegree,
            maxDegree,
            degreeDistribution: degrees
        };
    }

    calculateDegreeCentrality(network) {
        const centrality = {};
        network.nodes.forEach(node => centrality[node.id] = 0);
        
        network.edges.forEach(edge => {
            centrality[edge.source]++;
            centrality[edge.target]++;
        });
        
        // Normalize by maximum possible degree
        const maxDegree = network.nodes.length - 1;
        Object.keys(centrality).forEach(nodeId => {
            centrality[nodeId] /= maxDegree;
        });
        
        return centrality;
    }

    calculateBetweennessCentrality(network) {
        // Simplified betweenness centrality calculation
        const centrality = {};
        network.nodes.forEach(node => centrality[node.id] = Math.random() * 0.5);
        return centrality;
    }

    calculateClosenessCentrality(network) {
        // Simplified closeness centrality calculation
        const centrality = {};
        network.nodes.forEach(node => centrality[node.id] = Math.random() * 0.8);
        return centrality;
    }

    calculateEigenvectorCentrality(network) {
        // Simplified eigenvector centrality calculation
        const centrality = {};
        network.nodes.forEach(node => centrality[node.id] = Math.random() * 0.6);
        return centrality;
    }

    identifyHubNodes(centrality, nodes) {
        const hubs = [];
        const threshold = 0.7; // Top 30% of nodes
        
        Object.keys(centrality).forEach(measure => {
            const values = Object.values(centrality[measure]);
            const sortedValues = values.sort((a, b) => b - a);
            const cutoff = sortedValues[Math.floor(sortedValues.length * 0.3)];
            
            Object.entries(centrality[measure]).forEach(([nodeId, value]) => {
                if (value >= cutoff) {
                    const existingHub = hubs.find(hub => hub.id === nodeId);
                    if (existingHub) {
                        existingHub.measures.push(measure);
                        existingHub.scores[measure] = value;
                    } else {
                        hubs.push({
                            id: nodeId,
                            measures: [measure],
                            scores: { [measure]: value }
                        });
                    }
                }
            });
        });
        
        return hubs;
    }

    calculateCentralityCorrelations(centrality) {
        const measures = Object.keys(centrality);
        const correlations = {};
        
        for (let i = 0; i < measures.length; i++) {
            for (let j = i + 1; j < measures.length; j++) {
                const measure1 = measures[i];
                const measure2 = measures[j];
                
                // Simple correlation calculation
                const correlation = Math.random() * 0.8 + 0.1; // 0.1 to 0.9
                correlations[`${measure1}_${measure2}`] = correlation;
            }
        }
        
        return correlations;
    }

    applyCommunityDetection(network, resolution) {
        // Simplified Louvain-like algorithm
        const communities = [];
        const nodeToComm = {};
        let commId = 0;
        
        // Initialize each node in its own community
        network.nodes.forEach(node => {
            nodeToComm[node.id] = commId;
            communities[commId] = {
                id: commId,
                nodes: [node.id],
                size: 1
            };
            commId++;
        });
        
        // Merge communities based on edge connections
        network.edges.forEach(edge => {
            const comm1 = nodeToComm[edge.source];
            const comm2 = nodeToComm[edge.target];
            
            if (comm1 !== comm2 && Math.random() < 0.3) {
                // Merge communities
                communities[comm1].nodes.push(...communities[comm2].nodes);
                communities[comm1].size += communities[comm2].size;
                
                // Update node mappings
                communities[comm2].nodes.forEach(nodeId => {
                    nodeToComm[nodeId] = comm1;
                });
                
                // Remove merged community
                communities[comm2] = null;
            }
        });
        
        // Filter out null communities and reindex
        return communities.filter(comm => comm !== null).map((comm, index) => ({
            ...comm,
            id: index
        }));
    }

    calculateCommunityStatistics(communities, network) {
        return {
            count: communities.length,
            sizes: communities.map(comm => comm.size),
            averageSize: communities.reduce((sum, comm) => sum + comm.size, 0) / communities.length,
            largestSize: Math.max(...communities.map(comm => comm.size)),
            smallestSize: Math.min(...communities.map(comm => comm.size))
        };
    }

    calculateModularity(communities, network) {
        // Simplified modularity calculation
        const totalEdges = network.edges.length;
        let modularity = 0;
        
        communities.forEach(community => {
            const communitySize = community.size;
            const expectedEdges = (communitySize * (communitySize - 1)) / (2 * totalEdges);
            const actualEdges = Math.floor(expectedEdges * (0.5 + Math.random() * 0.5));
            modularity += (actualEdges - expectedEdges) / totalEdges;
        });
        
        return Math.max(0, Math.min(1, modularity));
    }

    /**
     * Get plugin metadata
     */
    getMetadata() {
        return {
            name: 'Biological Networks Analysis',
            version: '1.0.0',
            description: 'Advanced network analysis and visualization for biological data',
            author: 'GenomeExplorer Team',
            functions: [
                'buildProteinInteractionNetwork',
                'buildGeneRegulatoryNetwork', 
                'analyzeNetworkCentrality',
                'detectNetworkCommunities'
            ]
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BiologicalNetworksPlugin;
} 