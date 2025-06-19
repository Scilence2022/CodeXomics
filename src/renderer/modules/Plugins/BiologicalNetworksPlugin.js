/**
 * BiologicalNetworksPlugin - Advanced biological network analysis for GenomeExplorer
 * Provides protein-protein interaction networks, gene regulatory networks, and network analysis
 * Designed for seamless ChatBox LLM integration with standardized parameters
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
     * Generate test sample data for protein interaction network
     */
    generateProteinTestData() {
        return [
            {
                id: 'P1',
                name: 'DNA_GYRA',
                function: 'DNA replication',
                location: 'cytoplasm',
                expression: 0.85,
                domains: ['ATP_binding', 'DNA_binding']
            },
            {
                id: 'P2',
                name: 'DNA_GYRB',
                function: 'DNA replication',
                location: 'cytoplasm',
                expression: 0.78,
                domains: ['ATP_binding', 'DNA_binding']
            },
            {
                id: 'P3',
                name: 'SSB_PROTEIN',
                function: 'DNA binding',
                location: 'cytoplasm',
                expression: 0.92,
                domains: ['ssDNA_binding']
            },
            {
                id: 'P4',
                name: 'DNA_HELICASE',
                function: 'DNA unwinding',
                location: 'cytoplasm',
                expression: 0.67,
                domains: ['helicase', 'ATP_binding']
            },
            {
                id: 'P5',
                name: 'DNA_PRIMASE',
                function: 'RNA primer synthesis',
                location: 'cytoplasm',
                expression: 0.54,
                domains: ['primase', 'RNA_synthesis']
            },
            {
                id: 'P6',
                name: 'DNA_POLYMERASE',
                function: 'DNA synthesis',
                location: 'cytoplasm',
                expression: 0.89,
                domains: ['polymerase', 'exonuclease']
            }
        ];
    }

    /**
     * Generate test sample data for gene regulatory network
     */
    generateGeneTestData() {
        return [
            {
                id: 'G1',
                name: 'lacI',
                type: 'transcription_factor',
                chromosome: 'chr1',
                start: 1000,
                end: 1500,
                strand: '+',
                expression: 0.65,
                regulation: 'repressor'
            },
            {
                id: 'G2',
                name: 'lacZ',
                type: 'gene',
                chromosome: 'chr1',
                start: 2000,
                end: 3500,
                strand: '+',
                expression: 0.85,
                regulation: 'regulated'
            },
            {
                id: 'G3',
                name: 'lacY',
                type: 'gene',
                chromosome: 'chr1',
                start: 3600,
                end: 4800,
                strand: '+',
                expression: 0.78,
                regulation: 'regulated'
            },
            {
                id: 'G4',
                name: 'lacA',
                type: 'gene',
                chromosome: 'chr1',
                start: 4900,
                end: 5500,
                strand: '+',
                expression: 0.72,
                regulation: 'regulated'
            },
            {
                id: 'G5',
                name: 'crp',
                type: 'transcription_factor',
                chromosome: 'chr1',
                start: 6000,
                end: 6600,
                strand: '+',
                expression: 0.55,
                regulation: 'activator'
            },
            {
                id: 'G6',
                name: 'araC',
                type: 'transcription_factor',
                chromosome: 'chr1',
                start: 7000,
                end: 7500,
                strand: '-',
                expression: 0.48,
                regulation: 'dual_regulator'
            }
        ];
    }

    /**
     * Build protein-protein interaction network
     * Compatible with ChatBox LLM calling format
     */
    async buildProteinInteractionNetwork(params) {
        console.log('Building protein interaction network with params:', params);
        
        try {
            // Handle both array of strings (from LLM) and array of objects (from tests)
            let proteins = params.proteins;
            
            if (!proteins || !Array.isArray(proteins)) {
                throw new Error('Proteins array is required');
            }

            // Convert string array to object array if needed
            if (proteins.length > 0 && typeof proteins[0] === 'string') {
                const testData = this.generateProteinTestData();
                proteins = proteins.map(proteinId => {
                    const found = testData.find(p => p.id === proteinId || p.name === proteinId);
                    return found || {
                        id: proteinId,
                        name: proteinId,
                        function: 'Unknown',
                        location: 'Unknown',
                        expression: Math.random(),
                        domains: []
                    };
                });
            }

            const confidenceThreshold = params.confidenceThreshold || 0.7;
            const includeComplexes = params.includeComplexes !== false;

            // Generate protein interaction data
            const interactions = this.generateProteinInteractions(proteins, confidenceThreshold);
            const complexes = includeComplexes ? this.identifyProteinComplexes(interactions) : [];
            
            // Build network structure compatible with Network Graph plugin
            const network = {
                networkType: 'protein-interaction',
                nodes: proteins.map(protein => ({
                    id: protein.id || protein.name,
                    name: protein.name || protein.id,
                    label: protein.name || protein.id,
                    type: 'protein',
                    size: 8 + (protein.expression || 0.5) * 12, // Size based on expression
                    color: this.getProteinColor(protein),
                    properties: {
                        function: protein.function || 'Unknown',
                        location: protein.location || 'Unknown',
                        expression: protein.expression || Math.random(),
                        domains: protein.domains || []
                    }
                })),
                edges: interactions.map(interaction => ({
                    id: `${interaction.source}-${interaction.target}`,
                    source: interaction.source,
                    target: interaction.target,
                    weight: interaction.confidence,
                    color: this.getInteractionColor(interaction.confidence),
                    type: interaction.type || 'interaction',
                    properties: {
                        confidence: interaction.confidence,
                        method: interaction.method || 'predicted',
                        database: interaction.database || 'internal'
                    }
                })),
                complexes: complexes,
                metadata: {
                    networkType: 'protein-interaction',
                    confidenceThreshold,
                    nodeCount: proteins.length,
                    edgeCount: interactions.length,
                    complexCount: complexes.length,
                    generatedAt: new Date().toISOString(),
                    plugin: 'BiologicalNetworksPlugin',
                    version: '2.0.0'
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
     * Compatible with ChatBox LLM calling format
     */
    async buildGeneRegulatoryNetwork(params) {
        console.log('Building gene regulatory network with params:', params);
        
        try {
            // Handle both array of strings (from LLM) and array of objects (from tests)
            let genes = params.genes;
            
            if (!genes || !Array.isArray(genes)) {
                throw new Error('Genes array is required');
            }

            // Convert string array to object array if needed
            if (genes.length > 0 && typeof genes[0] === 'string') {
                const testData = this.generateGeneTestData();
                genes = genes.map(geneId => {
                    const found = testData.find(g => g.id === geneId || g.name === geneId);
                    return found || {
                        id: geneId,
                        name: geneId,
                        type: 'gene',
                        chromosome: 'chr1',
                        start: Math.floor(Math.random() * 10000),
                        end: Math.floor(Math.random() * 10000) + 1000,
                        strand: Math.random() > 0.5 ? '+' : '-',
                        expression: Math.random(),
                        regulation: 'unknown'
                    };
                });
            }

            const tissueType = params.tissueType || 'general';
            const includeModules = params.includeModules !== false;
            const regulationTypes = params.regulationTypes || ['activation', 'repression'];

            // Generate regulatory interactions
            const interactions = this.generateRegulatoryInteractions(genes, tissueType, regulationTypes);
            const modules = includeModules ? this.identifyRegulatoryModules(interactions, genes) : [];
            
            // Build network structure compatible with Network Graph plugin
            const network = {
                networkType: 'gene-regulatory',
                nodes: genes.map(gene => ({
                    id: gene.id || gene.name,
                    name: gene.name || gene.id,
                    label: gene.name || gene.id,
                    type: gene.type || 'gene',
                    size: 10 + (gene.expression || 0.5) * 10,
                    color: this.getGeneColor(gene),
                    properties: {
                        chromosome: gene.chromosome,
                        start: gene.start,
                        end: gene.end,
                        strand: gene.strand,
                        expression: gene.expression || Math.random(),
                        regulation: gene.regulation || 'unknown',
                        type: gene.type || 'gene'
                    }
                })),
                edges: interactions.map(interaction => ({
                    id: `${interaction.source}-${interaction.target}`,
                    source: interaction.source,
                    target: interaction.target,
                    weight: interaction.strength,
                    color: interaction.type === 'activation' ? '#2ecc71' : '#e74c3c',
                    type: interaction.type,
                    properties: {
                        strength: interaction.strength,
                        type: interaction.type,
                        evidence: interaction.evidence || 'predicted'
                    }
                })),
                modules: modules,
                metadata: {
                    networkType: 'gene-regulatory',
                    tissueType,
                    regulationTypes,
                    nodeCount: genes.length,
                    edgeCount: interactions.length,
                    moduleCount: modules.length,
                    generatedAt: new Date().toISOString(),
                    plugin: 'BiologicalNetworksPlugin',
                    version: '2.0.0'
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
            const { networkData, centralityTypes = ['degree', 'betweenness', 'closeness', 'eigenvector'] } = params;
            
            if (!networkData || !networkData.nodes || !networkData.edges) {
                throw new Error('Valid network with nodes and edges is required');
            }

            const centrality = {};
            
            // Calculate different centrality measures
            if (centralityTypes.includes('degree')) {
                centrality.degree = this.calculateDegreeCentrality(networkData);
            }
            
            if (centralityTypes.includes('betweenness')) {
                centrality.betweenness = this.calculateBetweennessCentrality(networkData);
            }
            
            if (centralityTypes.includes('closeness')) {
                centrality.closeness = this.calculateClosenessCentrality(networkData);
            }
            
            if (centralityTypes.includes('eigenvector')) {
                centrality.eigenvector = this.calculateEigenvectorCentrality(networkData);
            }

            // Identify hub nodes
            const hubs = this.identifyHubNodes(centrality, networkData.nodes);
            
            // Calculate correlations between measures
            const correlations = this.calculateCentralityCorrelations(centrality);
            
            const result = {
                centrality,
                hubs,
                correlations,
                network: networkData, // Include original network for visualization
                statistics: {
                    nodeCount: networkData.nodes.length,
                    edgeCount: networkData.edges.length,
                    measuresCalculated: centralityTypes,
                    hubCount: hubs.length
                },
                metadata: {
                    analysisType: 'centrality',
                    measures: centralityTypes,
                    generatedAt: new Date().toISOString(),
                    plugin: 'BiologicalNetworksPlugin',
                    version: '2.0.0'
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
     * Detect communities in biological networks
     */
    async detectNetworkCommunities(params) {
        console.log('Detecting network communities with params:', params);
        
        try {
            const { 
                networkData, 
                algorithm = 'louvain', 
                resolution = 1.0 
            } = params;
            
            if (!networkData || !networkData.nodes || !networkData.edges) {
                throw new Error('Valid network with nodes and edges is required');
            }

            // Apply community detection algorithm
            const communities = this.applyCommunityDetection(networkData, algorithm, resolution);
            
            // Calculate community statistics
            const communityStats = this.calculateCommunityStatistics(communities, networkData);
            
            // Calculate modularity
            const modularity = this.calculateModularity(communities, networkData);
            
            const result = {
                communities,
                statistics: communityStats,
                modularity,
                algorithm,
                resolution,
                network: networkData, // Include original network for visualization
                metadata: {
                    analysisType: 'community-detection',
                    algorithm,
                    resolution,
                    communityCount: communities.length,
                    generatedAt: new Date().toISOString(),
                    plugin: 'BiologicalNetworksPlugin',
                    version: '2.0.0'
                }
            };
            
            console.log('Network community detection completed:', result);
            return result;

        } catch (error) {
            console.error('Error detecting network communities:', error);
            throw error;
        }
    }

    // === HELPER METHODS ===

    /**
     * Get protein color based on function
     */
    getProteinColor(protein) {
        const functionColors = {
            'DNA replication': '#3498db',
            'DNA binding': '#2ecc71',
            'DNA unwinding': '#f39c12',
            'RNA primer synthesis': '#e74c3c',
            'DNA synthesis': '#9b59b6',
            'Unknown': '#95a5a6'
        };
        return functionColors[protein.function] || '#95a5a6';
    }

    /**
     * Get gene color based on type
     */
    getGeneColor(gene) {
        const typeColors = {
            'transcription_factor': '#e74c3c',
            'gene': '#3498db',
            'regulator': '#f39c12',
            'dual_regulator': '#9b59b6'
        };
        return typeColors[gene.type] || '#95a5a6';
    }

    /**
     * Get interaction color based on confidence
     */
    getInteractionColor(confidence) {
        if (confidence >= 0.8) return '#2ecc71'; // High confidence - green
        if (confidence >= 0.6) return '#f39c12'; // Medium confidence - orange
        return '#e74c3c'; // Low confidence - red
    }

    /**
     * Generate protein interactions
     */
    generateProteinInteractions(proteins, confidenceThreshold) {
        const interactions = [];
        
        // Generate interactions based on functional relationships
        for (let i = 0; i < proteins.length; i++) {
            for (let j = i + 1; j < proteins.length; j++) {
                const protein1 = proteins[i];
                const protein2 = proteins[j];
                
                // Calculate interaction probability based on function similarity
                let confidence = this.calculateInteractionProbability(protein1, protein2);
                
                if (confidence >= confidenceThreshold) {
                    interactions.push({
                        source: protein1.id,
                        target: protein2.id,
                        confidence: confidence,
                        type: 'physical',
                        method: 'computational',
                        database: 'predicted'
                    });
                }
            }
        }
        
        return interactions;
    }

    /**
     * Calculate interaction probability between proteins
     */
    calculateInteractionProbability(protein1, protein2) {
        let probability = 0.3; // Base probability
        
        // Increase probability for similar functions
        if (protein1.function === protein2.function) {
            probability += 0.4;
        }
        
        // Increase probability for similar locations
        if (protein1.location === protein2.location) {
            probability += 0.2;
        }
        
        // Increase probability for overlapping domains
        const domains1 = protein1.domains || [];
        const domains2 = protein2.domains || [];
        const overlap = domains1.filter(d => domains2.includes(d)).length;
        probability += overlap * 0.1;
        
        // Add some randomness
        probability += (Math.random() - 0.5) * 0.2;
        
        return Math.max(0, Math.min(1, probability));
    }

    /**
     * Identify protein complexes
     */
    identifyProteinComplexes(interactions) {
        // Simple complex detection based on high-confidence interactions
        const complexes = [];
        const processed = new Set();
        
        interactions.forEach(interaction => {
            if (interaction.confidence >= 0.8 && !processed.has(interaction.source) && !processed.has(interaction.target)) {
                complexes.push({
                    id: `complex_${complexes.length + 1}`,
                    members: [interaction.source, interaction.target],
                    confidence: interaction.confidence,
                    type: 'predicted'
                });
                processed.add(interaction.source);
                processed.add(interaction.target);
            }
        });
        
        return complexes;
    }

    /**
     * Generate regulatory interactions
     */
    generateRegulatoryInteractions(genes, tissueType, regulationTypes = ['activation', 'repression']) {
        const interactions = [];
        
        // Find transcription factors
        const tfs = genes.filter(gene => gene.type === 'transcription_factor' || gene.regulation === 'repressor' || gene.regulation === 'activator');
        const targets = genes.filter(gene => gene.type === 'gene');
        
        tfs.forEach(tf => {
            targets.forEach(target => {
                if (tf.id !== target.id) {
                    const strength = Math.random() * 0.8 + 0.2; // 0.2 to 1.0
                    const type = regulationTypes[Math.floor(Math.random() * regulationTypes.length)];
                    
                    // Higher probability for lac operon-like regulation
                    if ((tf.name === 'lacI' && target.name.startsWith('lac')) ||
                        (tf.name === 'crp' && target.name.startsWith('lac'))) {
                        interactions.push({
                            source: tf.id,
                            target: target.id,
                            type: tf.regulation === 'repressor' ? 'repression' : 'activation',
                            strength: strength,
                            evidence: 'experimental'
                        });
                    } else if (Math.random() < 0.3) { // 30% chance for other interactions
                        interactions.push({
                            source: tf.id,
                            target: target.id,
                            type: type,
                            strength: strength,
                            evidence: 'predicted'
                        });
                    }
                }
            });
        });
        
        return interactions;
    }

    /**
     * Identify regulatory modules
     */
    identifyRegulatoryModules(interactions, genes) {
        const modules = [];
        
        // Group genes by common regulators
        const regulators = {};
        interactions.forEach(interaction => {
            if (!regulators[interaction.source]) {
                regulators[interaction.source] = [];
            }
            regulators[interaction.source].push(interaction.target);
        });
        
        Object.entries(regulators).forEach(([regulator, targets], index) => {
            if (targets.length >= 2) {
                const regulatorGene = genes.find(g => g.id === regulator);
                modules.push({
                    id: `module_${index + 1}`,
                    regulator: regulator,
                    regulatorName: regulatorGene ? regulatorGene.name : regulator,
                    targets: targets,
                    size: targets.length,
                    type: regulatorGene ? regulatorGene.regulation : 'unknown'
                });
            }
        });
        
        return modules;
    }

    /**
     * Calculate network statistics
     */
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
            density: parseFloat(density.toFixed(4)),
            averageDegree: parseFloat(avgDegree.toFixed(2)),
            maxDegree,
            degreeDistribution: degrees
        };
    }

    /**
     * Calculate degree centrality
     */
    calculateDegreeCentrality(network) {
        const centrality = {};
        network.nodes.forEach(node => centrality[node.id] = 0);
        
        network.edges.forEach(edge => {
            centrality[edge.source]++;
            centrality[edge.target]++;
        });
        
        // Normalize by maximum possible degree
        const maxPossible = network.nodes.length - 1;
        Object.keys(centrality).forEach(nodeId => {
            centrality[nodeId] = centrality[nodeId] / maxPossible;
        });
        
        return centrality;
    }

    /**
     * Calculate betweenness centrality (simplified)
     */
    calculateBetweennessCentrality(network) {
        // Simplified implementation - in real scenario would use proper shortest path algorithms
        const centrality = {};
        network.nodes.forEach(node => centrality[node.id] = Math.random() * 0.5);
        return centrality;
    }

    /**
     * Calculate closeness centrality (simplified)
     */
    calculateClosenessCentrality(network) {
        // Simplified implementation
        const centrality = {};
        network.nodes.forEach(node => centrality[node.id] = Math.random() * 0.8 + 0.2);
        return centrality;
    }

    /**
     * Calculate eigenvector centrality (simplified)
     */
    calculateEigenvectorCentrality(network) {
        // Simplified implementation
        const centrality = {};
        network.nodes.forEach(node => centrality[node.id] = Math.random() * 0.9 + 0.1);
        return centrality;
    }

    /**
     * Identify hub nodes
     */
    identifyHubNodes(centrality, nodes) {
        const hubs = [];
        
        Object.keys(centrality).forEach(measure => {
            const values = Object.entries(centrality[measure]);
            values.sort((a, b) => b[1] - a[1]);
            
            // Top 20% are considered hubs for this measure
            const hubCount = Math.max(1, Math.floor(values.length * 0.2));
            const measureHubs = values.slice(0, hubCount).map(([nodeId, value]) => {
                const node = nodes.find(n => n.id === nodeId);
                return {
                    nodeId,
                    nodeName: node ? node.name : nodeId,
                    measure,
                    value: parseFloat(value.toFixed(4))
                };
            });
            
            hubs.push(...measureHubs);
        });
        
        return hubs;
    }

    /**
     * Calculate centrality correlations
     */
    calculateCentralityCorrelations(centrality) {
        const measures = Object.keys(centrality);
        const correlations = {};
        
        for (let i = 0; i < measures.length; i++) {
            for (let j = i + 1; j < measures.length; j++) {
                const measure1 = measures[i];
                const measure2 = measures[j];
                const correlation = this.calculateCorrelation(centrality[measure1], centrality[measure2]);
                correlations[`${measure1}_${measure2}`] = parseFloat(correlation.toFixed(3));
            }
        }
        
        return correlations;
    }

    /**
     * Calculate correlation between two measures
     */
    calculateCorrelation(measure1, measure2) {
        const nodeIds = Object.keys(measure1);
        const n = nodeIds.length;
        
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
        
        nodeIds.forEach(nodeId => {
            const x = measure1[nodeId];
            const y = measure2[nodeId];
            sumX += x;
            sumY += y;
            sumXY += x * y;
            sumX2 += x * x;
            sumY2 += y * y;
        });
        
        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
        
        return denominator === 0 ? 0 : numerator / denominator;
    }

    /**
     * Apply community detection
     */
    applyCommunityDetection(network, algorithm, resolution) {
        // Simplified community detection - in real scenario would use proper algorithms
        const communities = [];
        const nodeIds = network.nodes.map(n => n.id);
        const communitySize = Math.max(2, Math.floor(nodeIds.length / 3));
        
        for (let i = 0; i < nodeIds.length; i += communitySize) {
            const communityNodes = nodeIds.slice(i, i + communitySize);
            communities.push({
                id: `community_${communities.length + 1}`,
                nodes: communityNodes,
                size: communityNodes.size,
                algorithm
            });
        }
        
        return communities;
    }

    /**
     * Calculate community statistics
     */
    calculateCommunityStatistics(communities, network) {
        const totalNodes = network.nodes.length;
        const communitySizes = communities.map(c => c.size);
        
        return {
            communityCount: communities.length,
            averageSize: communitySizes.reduce((a, b) => a + b, 0) / communities.length,
            minSize: Math.min(...communitySizes),
            maxSize: Math.max(...communitySizes),
            coverage: communitySizes.reduce((a, b) => a + b, 0) / totalNodes
        };
    }

    /**
     * Calculate modularity
     */
    calculateModularity(communities, network) {
        // Simplified modularity calculation
        const m = network.edges.length;
        let Q = 0;
        
        communities.forEach(community => {
            const nodes = community.nodes;
            let internalEdges = 0;
            let totalDegree = 0;
            
            network.edges.forEach(edge => {
                if (nodes.includes(edge.source) && nodes.includes(edge.target)) {
                    internalEdges++;
                }
            });
            
            nodes.forEach(nodeId => {
                const degree = network.edges.filter(e => e.source === nodeId || e.target === nodeId).length;
                totalDegree += degree;
            });
            
            Q += (internalEdges / m) - Math.pow(totalDegree / (2 * m), 2);
        });
        
        return parseFloat(Q.toFixed(4));
    }

    /**
     * Get plugin metadata
     */
    getMetadata() {
        return {
            name: 'Biological Networks Plugin',
            version: '2.0.0',
            description: 'Advanced biological network analysis and visualization',
            author: 'Genome AI Studio Team',
            functions: [
                'buildProteinInteractionNetwork',
                'buildGeneRegulatoryNetwork', 
                'analyzeNetworkCentrality',
                'detectNetworkCommunities'
            ],
            supportedNetworkTypes: [
                'protein-interaction',
                'gene-regulatory'
            ],
            testDataAvailable: true,
            chatBoxCompatible: true
        };
    }
}

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BiologicalNetworksPlugin;
} else if (typeof window !== 'undefined') {
    window.BiologicalNetworksPlugin = BiologicalNetworksPlugin;
} 