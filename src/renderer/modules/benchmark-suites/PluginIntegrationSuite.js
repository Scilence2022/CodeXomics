/**
 * Plugin Integration Test Suite - Tests LLM integration with plugin system
 */
class PluginIntegrationSuite {
    constructor() {
        this.suiteName = 'Plugin Integration';
        this.suiteId = 'plugin_integration';
        this.description = 'Tests LLM ability to call and integrate with plugin functions';
        this.framework = null;
        this.tests = this.initializeTests();
    }

    getName() {
        return this.suiteName;
    }

    getTests() {
        return this.tests;
    }

    getTestCount() {
        return this.tests.length;
    }

    /**
     * Initialize plugin integration test cases
     */
    initializeTests() {
        return [
            // Genomic Analysis Plugin Tests
            {
                id: 'plugin_genomic_01',
                name: 'GC Content Analysis Plugin',
                type: 'function_call',
                instruction: 'Use the genomic analysis plugin to calculate GC content for the region from position 10000 to 15000 on chromosome COLI-K12.',
                expectedResult: {
                    tool_name: 'genomic-analysis.analyzeGCContent',
                    parameters: {
                        chromosome: 'COLI-K12',
                        start: 10000,
                        end: 15000
                    }
                },
                maxScore: 120,
                timeout: 20000,
                evaluator: this.evaluatePluginFunctionCall.bind(this)
            },
            {
                id: 'plugin_genomic_02',
                name: 'Motif Finding Plugin',
                type: 'function_call',
                instruction: 'Find sequence motifs in the lacZ gene using the genomic analysis plugin.',
                expectedResult: {
                    tool_name: 'genomic-analysis.findMotifs',
                    parameters: {
                        geneName: 'lacZ'
                    }
                },
                maxScore: 120,
                evaluator: this.evaluatePluginFunctionCall.bind(this)
            },
            {
                id: 'plugin_genomic_03',
                name: 'Sequence Diversity Analysis',
                type: 'function_call',
                instruction: 'Calculate sequence diversity for ribosomal RNA genes using the genomic analysis plugin.',
                expectedResult: {
                    tool_name: 'genomic-analysis.calculateDiversity',
                    parameters: {
                        geneType: 'rRNA'
                    }
                },
                maxScore: 120,
                evaluator: this.evaluatePluginFunctionCall.bind(this)
            },
            {
                id: 'plugin_genomic_04',
                name: 'Region Comparison Plugin',
                type: 'function_call',
                instruction: 'Compare genomic regions around genes thrA and thrB using the genomic analysis plugin.',
                expectedResult: {
                    tool_name: 'genomic-analysis.compareRegions',
                    parameters: {
                        gene1: 'thrA',
                        gene2: 'thrB'
                    }
                },
                maxScore: 120,
                evaluator: this.evaluatePluginFunctionCall.bind(this)
            },

            // Phylogenetic Analysis Plugin Tests
            {
                id: 'plugin_phylo_01',
                name: 'Phylogenetic Tree Construction',
                type: 'function_call',
                instruction: 'Build a phylogenetic tree for the 16S rRNA gene using the phylogenetic analysis plugin.',
                expectedResult: {
                    tool_name: 'phylogenetic-analysis.buildPhylogeneticTree',
                    parameters: {
                        geneName: '16S rRNA',
                        method: 'neighbor-joining'
                    }
                },
                maxScore: 140,
                evaluator: this.evaluatePhylogeneticCall.bind(this)
            },
            {
                id: 'plugin_phylo_02',
                name: 'Evolutionary Distance Calculation',
                type: 'function_call',
                instruction: 'Calculate evolutionary distances between homologous sequences of the rpoB gene using the phylogenetic plugin.',
                expectedResult: {
                    tool_name: 'phylogenetic-analysis.calculateEvolutionaryDistance',
                    parameters: {
                        geneName: 'rpoB'
                    }
                },
                maxScore: 140,
                evaluator: this.evaluatePhylogeneticCall.bind(this)
            },

            // Biological Networks Plugin Tests
            {
                id: 'plugin_network_01',
                name: 'Protein Interaction Network',
                type: 'function_call',
                instruction: 'Build a protein interaction network for DNA repair genes using the biological networks plugin.',
                expectedResult: {
                    tool_name: 'biological-networks.buildProteinInteractionNetwork',
                    parameters: {
                        geneSet: 'DNA repair',
                        organism: 'E. coli'
                    }
                },
                maxScore: 140,
                evaluator: this.evaluateNetworkCall.bind(this)
            },
            {
                id: 'plugin_network_02',
                name: 'Gene Regulatory Network',
                type: 'function_call',
                instruction: 'Construct a gene regulatory network for the lac operon using the biological networks plugin.',
                expectedResult: {
                    tool_name: 'biological-networks.buildGeneRegulatoryNetwork',
                    parameters: {
                        operon: 'lac',
                        includeRegulators: true
                    }
                },
                maxScore: 140,
                evaluator: this.evaluateNetworkCall.bind(this)
            },
            {
                id: 'plugin_network_03',
                name: 'Network Centrality Analysis',
                type: 'function_call',
                instruction: 'Analyze network centrality for metabolic enzymes using the biological networks plugin.',
                expectedResult: {
                    tool_name: 'biological-networks.analyzeNetworkCentrality',
                    parameters: {
                        networkType: 'metabolic',
                        centralityMeasure: 'betweenness'
                    }
                },
                maxScore: 140,
                evaluator: this.evaluateNetworkCall.bind(this)
            },
            {
                id: 'plugin_network_04',
                name: 'Network Community Detection',
                type: 'function_call',
                instruction: 'Detect communities in the protein interaction network using the biological networks plugin.',
                expectedResult: {
                    tool_name: 'biological-networks.detectNetworkCommunities',
                    parameters: {
                        networkType: 'protein_interaction',
                        algorithm: 'modularity'
                    }
                },
                maxScore: 140,
                evaluator: this.evaluateNetworkCall.bind(this)
            },

            // Machine Learning Plugin Tests
            {
                id: 'plugin_ml_01',
                name: 'Gene Function Prediction',
                type: 'function_call',
                instruction: 'Predict the function of hypothetical gene yaaX using the machine learning analysis plugin.',
                expectedResult: {
                    tool_name: 'ml-analysis.predictGeneFunction',
                    parameters: {
                        geneName: 'yaaX',
                        method: 'sequence_similarity'
                    }
                },
                maxScore: 140,
                evaluator: this.evaluateMLCall.bind(this)
            },
            {
                id: 'plugin_ml_02',
                name: 'Protein Localization Prediction',
                type: 'function_call',
                instruction: 'Predict subcellular localization for the malE protein using the ML plugin.',
                expectedResult: {
                    tool_name: 'ml-analysis.predictProteinLocalization',
                    parameters: {
                        proteinName: 'malE',
                        organism: 'E. coli'
                    }
                },
                maxScore: 140,
                evaluator: this.evaluateMLCall.bind(this)
            },

            // Multi-plugin Workflow Tests
            {
                id: 'plugin_workflow_01',
                name: 'Multi-Plugin Gene Analysis',
                type: 'workflow',
                instruction: 'Perform comprehensive analysis of gene dnaA using multiple plugins: calculate GC content with genomic plugin, predict function with ML plugin, and build interaction network with networks plugin.',
                expectedResult: {
                    expectedSteps: 3,
                    expectedFunctionCalls: 3,
                    requiredFunctions: [
                        'genomic-analysis.analyzeGCContent',
                        'ml-analysis.predictGeneFunction',
                        'biological-networks.buildProteinInteractionNetwork'
                    ]
                },
                maxScore: 200,
                timeout: 45000,
                evaluator: this.evaluateMultiPluginWorkflow.bind(this)
            },
            {
                id: 'plugin_workflow_02',
                name: 'Evolutionary Analysis Pipeline',
                type: 'workflow',
                instruction: 'Analyze the evolution of the rpoB gene using phylogenetic and genomic plugins: find motifs, calculate diversity, and build phylogenetic tree.',
                expectedResult: {
                    expectedSteps: 3,
                    expectedFunctionCalls: 3,
                    requiredFunctions: [
                        'genomic-analysis.findMotifs',
                        'genomic-analysis.calculateDiversity',
                        'phylogenetic-analysis.buildPhylogeneticTree'
                    ]
                },
                maxScore: 200,
                timeout: 45000,
                evaluator: this.evaluateMultiPluginWorkflow.bind(this)
            },

            // Plugin Parameter Handling Tests
            {
                id: 'plugin_params_01',
                name: 'Complex Parameter Handling',
                type: 'function_call',
                instruction: 'Compare multiple genomic regions (positions 10000-15000, 20000-25000, 30000-35000) on chromosome COLI-K12 using the genomic analysis plugin.',
                expectedResult: {
                    tool_name: 'genomic-analysis.compareRegions',
                    parameters: {
                        regions: [
                            { chromosome: 'COLI-K12', start: 10000, end: 15000 },
                            { chromosome: 'COLI-K12', start: 20000, end: 25000 },
                            { chromosome: 'COLI-K12', start: 30000, end: 35000 }
                        ]
                    }
                },
                maxScore: 150,
                evaluator: this.evaluateComplexParameterCall.bind(this)
            },
            {
                id: 'plugin_params_02',
                name: 'Array Parameter Handling',
                type: 'function_call',
                instruction: 'Build phylogenetic tree for multiple genes (dnaA, dnaB, dnaC) using the phylogenetic analysis plugin.',
                expectedResult: {
                    tool_name: 'phylogenetic-analysis.buildPhylogeneticTree',
                    parameters: {
                        geneNames: ['dnaA', 'dnaB', 'dnaC'],
                        method: 'maximum_likelihood'
                    }
                },
                maxScore: 150,
                evaluator: this.evaluateComplexParameterCall.bind(this)
            },

            // Plugin Error Handling Tests
            {
                id: 'plugin_error_01',
                name: 'Plugin Function Error Recovery',
                type: 'function_call',
                instruction: 'Try to analyze a non-existent gene "fakeGene123" using the genomic analysis plugin and handle any errors appropriately.',
                expectedResult: {
                    tool_name: 'genomic-analysis.analyzeGCContent',
                    parameters: {
                        geneName: 'fakeGene123'
                    },
                    expectError: true
                },
                maxScore: 100,
                evaluator: this.evaluateErrorHandlingCall.bind(this)
            },

            // Plugin Integration with Core Functions
            {
                id: 'plugin_integration_01',
                name: 'Plugin-Core Function Integration',
                type: 'workflow',
                instruction: 'Find gene lacZ using core functions, then analyze its GC content using the genomic plugin, and finally search for its protein structure using core functions.',
                expectedResult: {
                    expectedSteps: 3,
                    expectedFunctionCalls: 3,
                    requiredFunctions: [
                        'search_gene_by_name',
                        'genomic-analysis.analyzeGCContent',
                        'search_protein_by_gene'
                    ],
                    mixedFunctions: true
                },
                maxScore: 180,
                timeout: 40000,
                evaluator: this.evaluateMixedFunctionWorkflow.bind(this)
            }
        ];
    }

    /**
     * Evaluate basic plugin function call
     */
    async evaluatePluginFunctionCall(actualResult, expectedResult, testResult) {
        const evaluation = {
            success: false,
            score: 0,
            maxScore: testResult.maxScore || 120,
            errors: [],
            warnings: []
        };

        if (!actualResult) {
            evaluation.errors.push('No plugin function call detected');
            return evaluation;
        }

        if (actualResult.error) {
            evaluation.errors.push(`Plugin function call error: ${actualResult.error}`);
            return evaluation;
        }

        const calls = Array.isArray(actualResult) ? actualResult : [actualResult];
        const call = calls[0];

        if (!call || !call.tool_name) {
            evaluation.errors.push('Invalid plugin function call format');
            return evaluation;
        }

        // Check plugin function name (60 points)
        if (call.tool_name === expectedResult.tool_name) {
            evaluation.score += 60;
        } else {
            // Check if it's the same plugin but different function
            const expectedPlugin = expectedResult.tool_name.split('.')[0];
            const actualPlugin = call.tool_name.split('.')[0];
            
            if (actualPlugin === expectedPlugin) {
                evaluation.score += 30;
                evaluation.warnings.push(`Different function in same plugin: expected ${expectedResult.tool_name}, got ${call.tool_name}`);
            } else {
                evaluation.errors.push(`Wrong plugin function: expected ${expectedResult.tool_name}, got ${call.tool_name}`);
            }
        }

        // Check parameters (40 points)
        if (call.parameters && expectedResult.parameters) {
            const paramScore = this.evaluatePluginParameters(call.parameters, expectedResult.parameters);
            evaluation.score += (paramScore / 100) * 40;
        } else if (!expectedResult.parameters) {
            evaluation.score += 40;
        } else {
            evaluation.errors.push('Missing required plugin parameters');
        }

        // Bonus points for plugin-specific parameter validation (20 points)
        const validationBonus = this.validatePluginSpecificParameters(call.tool_name, call.parameters);
        evaluation.score += validationBonus;

        evaluation.score = Math.min(evaluation.score, evaluation.maxScore);
        evaluation.success = evaluation.score >= (evaluation.maxScore * 0.7);

        return evaluation;
    }

    /**
     * Evaluate phylogenetic plugin calls
     */
    async evaluatePhylogeneticCall(actualResult, expectedResult, testResult) {
        const evaluation = await this.evaluatePluginFunctionCall(actualResult, expectedResult, testResult);
        
        // Additional validation for phylogenetic functions
        if (actualResult && actualResult.parameters) {
            const call = Array.isArray(actualResult) ? actualResult[0] : actualResult;
            
            // Check for valid phylogenetic methods
            if (call.parameters.method) {
                const validMethods = ['neighbor-joining', 'maximum_likelihood', 'parsimony', 'upgma'];
                if (validMethods.includes(call.parameters.method)) {
                    evaluation.score += 5;
                } else {
                    evaluation.warnings.push('Non-standard phylogenetic method specified');
                }
            }
        }

        return evaluation;
    }

    /**
     * Evaluate network plugin calls
     */
    async evaluateNetworkCall(actualResult, expectedResult, testResult) {
        const evaluation = await this.evaluatePluginFunctionCall(actualResult, expectedResult, testResult);
        
        // Additional validation for network functions
        if (actualResult && actualResult.parameters) {
            const call = Array.isArray(actualResult) ? actualResult[0] : actualResult;
            
            // Check for valid network types
            if (call.parameters.networkType) {
                const validTypes = ['protein_interaction', 'metabolic', 'regulatory', 'coexpression'];
                if (validTypes.includes(call.parameters.networkType)) {
                    evaluation.score += 5;
                }
            }

            // Check for valid centrality measures
            if (call.parameters.centralityMeasure) {
                const validMeasures = ['betweenness', 'closeness', 'degree', 'eigenvector'];
                if (validMeasures.includes(call.parameters.centralityMeasure)) {
                    evaluation.score += 5;
                }
            }
        }

        return evaluation;
    }

    /**
     * Evaluate ML plugin calls
     */
    async evaluateMLCall(actualResult, expectedResult, testResult) {
        const evaluation = await this.evaluatePluginFunctionCall(actualResult, expectedResult, testResult);
        
        // Additional validation for ML functions
        if (actualResult && actualResult.parameters) {
            const call = Array.isArray(actualResult) ? actualResult[0] : actualResult;
            
            // Check for valid ML methods
            if (call.parameters.method) {
                const validMethods = ['sequence_similarity', 'domain_analysis', 'expression_profile', 'phylogenetic_profile'];
                if (validMethods.includes(call.parameters.method)) {
                    evaluation.score += 5;
                }
            }

            // Check for organism specification
            if (call.parameters.organism) {
                evaluation.score += 5;
            }
        }

        return evaluation;
    }

    /**
     * Evaluate multi-plugin workflow
     */
    async evaluateMultiPluginWorkflow(actualResult, expectedResult, testResult) {
        const evaluation = {
            success: false,
            score: 0,
            maxScore: testResult.maxScore || 200,
            errors: [],
            warnings: []
        };

        if (!actualResult || !actualResult.functionCalls) {
            evaluation.errors.push('No function calls detected in multi-plugin workflow');
            return evaluation;
        }

        const functionCalls = actualResult.functionCalls || [];
        
        // Check that multiple plugins are used (50 points)
        const pluginsUsed = this.getUniquePlugins(functionCalls);
        if (pluginsUsed.length >= 2) {
            evaluation.score += 50;
        } else if (pluginsUsed.length === 1) {
            evaluation.score += 25;
            evaluation.warnings.push('Only one plugin used in multi-plugin workflow');
        } else {
            evaluation.errors.push('No plugins used in multi-plugin workflow');
        }

        // Check required functions (100 points)
        const functionScore = this.evaluateRequiredPluginFunctions(functionCalls, expectedResult.requiredFunctions);
        evaluation.score += functionScore;

        // Check workflow completion (50 points)
        const completionScore = this.evaluateWorkflowCompletion(actualResult);
        evaluation.score += completionScore;

        evaluation.success = evaluation.score >= (evaluation.maxScore * 0.6);
        return evaluation;
    }

    /**
     * Evaluate complex parameter handling
     */
    async evaluateComplexParameterCall(actualResult, expectedResult, testResult) {
        const evaluation = await this.evaluatePluginFunctionCall(actualResult, expectedResult, testResult);
        
        // Additional scoring for complex parameters
        if (actualResult && actualResult.parameters) {
            const call = Array.isArray(actualResult) ? actualResult[0] : actualResult;
            
            // Check for array parameters
            if (expectedResult.parameters.regions && call.parameters.regions) {
                if (Array.isArray(call.parameters.regions)) {
                    evaluation.score += 10;
                    
                    // Check array length
                    if (call.parameters.regions.length >= expectedResult.parameters.regions.length) {
                        evaluation.score += 10;
                    }
                }
            }

            if (expectedResult.parameters.geneNames && call.parameters.geneNames) {
                if (Array.isArray(call.parameters.geneNames)) {
                    evaluation.score += 10;
                }
            }
        }

        return evaluation;
    }

    /**
     * Evaluate error handling
     */
    async evaluateErrorHandlingCall(actualResult, expectedResult, testResult) {
        const evaluation = {
            success: false,
            score: 0,
            maxScore: testResult.maxScore || 100,
            errors: [],
            warnings: []
        };

        // For error handling tests, we expect either:
        // 1. The function to be called but return an error
        // 2. The LLM to recognize the invalid input and suggest alternatives

        if (actualResult && actualResult.error) {
            // Function was called but returned error - this is acceptable
            evaluation.score += 60;
            evaluation.success = true;
        } else if (actualResult && actualResult.tool_name === expectedResult.tool_name) {
            // Function was called with invalid parameters
            evaluation.score += 40;
        } else if (actualResult && actualResult.content) {
            // LLM provided explanation instead of calling function
            if (this.containsErrorRecognition(actualResult.content)) {
                evaluation.score += 80;
                evaluation.success = true;
            }
        }

        return evaluation;
    }

    /**
     * Evaluate mixed function workflow (plugins + core functions)
     */
    async evaluateMixedFunctionWorkflow(actualResult, expectedResult, testResult) {
        const evaluation = {
            success: false,
            score: 0,
            maxScore: testResult.maxScore || 180,
            errors: [],
            warnings: []
        };

        if (!actualResult || !actualResult.functionCalls) {
            evaluation.errors.push('No function calls detected');
            return evaluation;
        }

        const functionCalls = actualResult.functionCalls || [];
        
        // Check for mix of core and plugin functions (60 points)
        const hasCoreFunctions = functionCalls.some(call => !call.tool_name.includes('.'));
        const hasPluginFunctions = functionCalls.some(call => call.tool_name.includes('.'));
        
        if (hasCoreFunctions && hasPluginFunctions) {
            evaluation.score += 60;
        } else if (hasCoreFunctions || hasPluginFunctions) {
            evaluation.score += 30;
            evaluation.warnings.push('Workflow uses only one type of function (core or plugin)');
        }

        // Check required functions (80 points)
        const requiredScore = this.evaluateRequiredMixedFunctions(functionCalls, expectedResult.requiredFunctions);
        evaluation.score += requiredScore;

        // Check logical sequence (40 points)
        const sequenceScore = this.evaluateLogicalSequence(functionCalls);
        evaluation.score += sequenceScore;

        evaluation.success = evaluation.score >= (evaluation.maxScore * 0.65);
        return evaluation;
    }

    // Helper methods

    evaluatePluginParameters(actualParams, expectedParams) {
        let score = 0;
        const totalParams = Object.keys(expectedParams).length;
        
        if (totalParams === 0) return 100;
        
        let matchingParams = 0;
        
        for (const [key, expectedValue] of Object.entries(expectedParams)) {
            if (actualParams.hasOwnProperty(key)) {
                if (this.comparePluginParameterValues(actualParams[key], expectedValue)) {
                    matchingParams++;
                } else {
                    matchingParams += 0.5;
                }
            }
        }
        
        return (matchingParams / totalParams) * 100;
    }

    comparePluginParameterValues(actual, expected) {
        // Handle arrays
        if (Array.isArray(expected)) {
            if (!Array.isArray(actual)) return false;
            if (actual.length !== expected.length) return false;
            
            for (let i = 0; i < expected.length; i++) {
                if (!this.comparePluginParameterValues(actual[i], expected[i])) {
                    return false;
                }
            }
            return true;
        }

        // Handle objects
        if (typeof expected === 'object' && expected !== null) {
            if (typeof actual !== 'object' || actual === null) return false;
            
            for (const [key, value] of Object.entries(expected)) {
                if (!this.comparePluginParameterValues(actual[key], value)) {
                    return false;
                }
            }
            return true;
        }

        // Handle primitives
        if (typeof actual === 'string' && typeof expected === 'string') {
            return actual.toLowerCase() === expected.toLowerCase();
        }

        return actual === expected;
    }

    validatePluginSpecificParameters(toolName, parameters) {
        if (!parameters) return 0;
        
        const plugin = toolName.split('.')[0];
        let bonus = 0;

        switch (plugin) {
            case 'genomic-analysis':
                if (parameters.chromosome && parameters.start && parameters.end) {
                    if (parameters.start < parameters.end) bonus += 5;
                }
                if (parameters.geneName && typeof parameters.geneName === 'string') bonus += 5;
                break;
                
            case 'phylogenetic-analysis':
                if (parameters.method && typeof parameters.method === 'string') bonus += 5;
                if (parameters.geneName || parameters.geneNames) bonus += 5;
                break;
                
            case 'biological-networks':
                if (parameters.networkType && typeof parameters.networkType === 'string') bonus += 5;
                if (parameters.organism && typeof parameters.organism === 'string') bonus += 5;
                break;
                
            case 'ml-analysis':
                if (parameters.method && typeof parameters.method === 'string') bonus += 5;
                if (parameters.geneName || parameters.proteinName) bonus += 5;
                break;
        }

        return Math.min(bonus, 20);
    }

    getUniquePlugins(functionCalls) {
        const plugins = new Set();
        
        for (const call of functionCalls) {
            if (call.tool_name && call.tool_name.includes('.')) {
                const plugin = call.tool_name.split('.')[0];
                plugins.add(plugin);
            }
        }
        
        return Array.from(plugins);
    }

    evaluateRequiredPluginFunctions(functionCalls, requiredFunctions) {
        if (!requiredFunctions) return 0;
        
        const calledFunctions = functionCalls.map(call => call.tool_name);
        const foundFunctions = requiredFunctions.filter(func => calledFunctions.includes(func));
        
        return (foundFunctions.length / requiredFunctions.length) * 100;
    }

    evaluateRequiredMixedFunctions(functionCalls, requiredFunctions) {
        if (!requiredFunctions) return 0;
        
        const calledFunctions = functionCalls.map(call => call.tool_name);
        const foundFunctions = requiredFunctions.filter(func => calledFunctions.includes(func));
        
        return (foundFunctions.length / requiredFunctions.length) * 80;
    }

    evaluateWorkflowCompletion(actualResult) {
        let score = 0;
        
        if (actualResult.completionIndicators && actualResult.completionIndicators.length > 0) {
            score += 25;
        }
        
        if (actualResult.steps && actualResult.steps.length > 0) {
            score += 25;
        }
        
        return score;
    }

    evaluateLogicalSequence(functionCalls) {
        // Check if core functions come before plugin functions (logical flow)
        let coreIndex = -1;
        let pluginIndex = -1;
        
        for (let i = 0; i < functionCalls.length; i++) {
            const call = functionCalls[i];
            if (!call.tool_name.includes('.') && coreIndex === -1) {
                coreIndex = i;
            }
            if (call.tool_name.includes('.') && pluginIndex === -1) {
                pluginIndex = i;
            }
        }
        
        // If we have both types and core comes first, give bonus
        if (coreIndex !== -1 && pluginIndex !== -1 && coreIndex < pluginIndex) {
            return 40;
        } else if (coreIndex !== -1 || pluginIndex !== -1) {
            return 20;
        }
        
        return 0;
    }

    containsErrorRecognition(content) {
        const errorKeywords = ['not found', 'does not exist', 'invalid', 'error', 'cannot find', 'unavailable'];
        return errorKeywords.some(keyword => content.toLowerCase().includes(keyword));
    }

    /**
     * Setup method
     */
    async setup(context) {
        console.log('Setting up Plugin Integration test suite');
    }

    /**
     * Cleanup method
     */
    async cleanup(context) {
        console.log('Cleaning up Plugin Integration test suite');
    }
}

// Make available globally
window.PluginIntegrationSuite = PluginIntegrationSuite;
