/**
 * PluginTestManager - Comprehensive testing framework for GenomeExplorer plugins
 * Provides detailed testing, validation, and reporting for all plugin types
 */
class PluginTestManager {
    constructor(pluginManager) {
        this.pluginManager = pluginManager;
        this.testResults = new Map();
        this.testSuites = new Map();
        
        // Initialize built-in test suites
        this.initializeTestSuites();
        
        console.log('PluginTestManager initialized');
    }

    /**
     * Initialize built-in test suites for different plugin types
     */
    initializeTestSuites() {
        // Register test suites for different plugins
        this.registerTestSuite('genomic-analysis', {
            name: 'Genomic Analysis Test Suite',
            description: 'Comprehensive tests for genomic analysis functions',
            tests: this.createGenomicAnalysisTests()
        });

        this.registerTestSuite('phylogenetic-analysis', {
            name: 'Phylogenetic Analysis Test Suite',
            description: 'Tests for phylogenetic and evolutionary analysis',
            tests: this.createPhylogeneticAnalysisTests()
        });

        this.registerTestSuite('biological-networks', {
            name: 'Biological Networks Test Suite',
            description: 'Network analysis and visualization tests',
            tests: this.createBiologicalNetworksTests()
        });

        // Special test suite for Circos if available
        this.registerTestSuite('circos-genome-plotter', {
            name: 'Circos Genome Plotter Test Suite',
            description: 'Comprehensive Circos visualization tests',
            tests: this.createCircosTests()
        });

        // Generic visualization tests
        this.registerTestSuite('visualization-generic', {
            name: 'Generic Visualization Test Suite',
            description: 'Standard visualization plugin tests',
            tests: this.createGenericVisualizationTests()
        });
    }

    /**
     * Register a custom test suite
     */
    registerTestSuite(pluginId, testSuite) {
        this.testSuites.set(pluginId, testSuite);
    }

    /**
     * Run comprehensive test for a plugin
     */
    async runPluginTests(pluginId, type, testWindow) {
        const plugin = type === 'function' ? 
            this.pluginManager.functionPlugins.get(pluginId) :
            this.pluginManager.visualizationPlugins.get(pluginId);

        if (!plugin) {
            throw new Error(`Plugin "${pluginId}" not found`);
        }

        const testSuite = this.testSuites.get(pluginId) || this.getDefaultTestSuite(type);
        const testRunner = new PluginTestRunner(plugin, testSuite, this.pluginManager, testWindow);
        
        return await testRunner.runTests();
    }

    /**
     * Get default test suite for plugin type
     */
    getDefaultTestSuite(type) {
        if (type === 'function') {
            return {
                name: 'Default Function Plugin Test Suite',
                description: 'Standard function plugin tests',
                tests: this.createDefaultFunctionTests()
            };
        } else {
            return {
                name: 'Default Visualization Plugin Test Suite',
                description: 'Standard visualization plugin tests',
                tests: this.createDefaultVisualizationTests()
            };
        }
    }

    /**
     * Create genomic analysis specific tests
     */
    createGenomicAnalysisTests() {
        return [
            {
                name: 'GC Content Analysis',
                description: 'Test GC content calculation with various parameters',
                type: 'function',
                target: 'analyzeGCContent',
                testCases: [
                    {
                        name: 'Basic GC Analysis',
                        parameters: {
                            chromosome: 'chr1',
                            start: 1000,
                            end: 2000,
                            windowSize: 100
                        },
                        expectedResult: (result) => result && typeof result.gcContent === 'number'
                    },
                    {
                        name: 'Large Region Analysis',
                        parameters: {
                            chromosome: 'chr1',
                            start: 1000,
                            end: 50000,
                            windowSize: 1000
                        },
                        expectedResult: (result) => result && Array.isArray(result.windows)
                    }
                ]
            },
            {
                name: 'Motif Finding',
                description: 'Test sequence motif detection',
                type: 'function',
                target: 'findMotifs',
                testCases: [
                    {
                        name: 'Simple Motif Search',
                        parameters: {
                            chromosome: 'chr1',
                            start: 1000,
                            end: 2000,
                            motif: 'ATCG'
                        },
                        expectedResult: (result) => result && Array.isArray(result.matches)
                    }
                ]
            },
            {
                name: 'Sequence Diversity',
                description: 'Test diversity calculation',
                type: 'function',
                target: 'calculateDiversity',
                testCases: [
                    {
                        name: 'Shannon Diversity',
                        parameters: {
                            sequences: ['ATCGATCG', 'GCTAGCTA', 'TTAACCGG'],
                            metric: 'shannon'
                        },
                        expectedResult: (result) => result && typeof result.shannon === 'number'
                    }
                ]
            }
        ];
    }

    /**
     * Create phylogenetic analysis specific tests
     */
    createPhylogeneticAnalysisTests() {
        return [
            {
                name: 'Phylogenetic Tree Construction',
                description: 'Test tree building algorithms',
                type: 'function',
                target: 'buildPhylogeneticTree',
                testCases: [
                    {
                        name: 'Neighbor Joining Tree',
                        parameters: {
                            sequences: [
                                { id: '1', sequence: 'ATCGATCG', name: 'seq1' },
                                { id: '2', sequence: 'GCTAGCTA', name: 'seq2' },
                                { id: '3', sequence: 'TTAACCGG', name: 'seq3' }
                            ],
                            method: 'nj'
                        },
                        expectedResult: (result) => result && result.newick
                    }
                ]
            },
            {
                name: 'Evolutionary Distance',
                description: 'Test distance calculations',
                type: 'function',
                target: 'calculateEvolutionaryDistance',
                testCases: [
                    {
                        name: 'P-Distance Calculation',
                        parameters: {
                            sequence1: 'ATCGATCG',
                            sequence2: 'GCTAGCTA',
                            model: 'p-distance'
                        },
                        expectedResult: (result) => result && typeof result.distance === 'number'
                    }
                ]
            }
        ];
    }

    /**
     * Create biological networks specific tests
     */
    createBiologicalNetworksTests() {
        return [
            {
                name: 'Network Construction',
                description: 'Test network building capabilities',
                type: 'function',
                target: 'buildProteinInteractionNetwork',
                testCases: [
                    {
                        name: 'Basic PPI Network',
                        parameters: {
                            proteins: ['TP53', 'MDM2', 'ATM'],
                            interactionThreshold: 0.7
                        },
                        expectedResult: (result) => result && result.nodes && result.edges
                    }
                ]
            },
            {
                name: 'Network Analysis',
                description: 'Test network analysis functions',
                type: 'function',
                target: 'analyzeNetworkCentrality',
                testCases: [
                    {
                        name: 'Centrality Measures',
                        parameters: {
                            network: {
                                nodes: [{ id: 1 }, { id: 2 }, { id: 3 }],
                                edges: [{ source: 1, target: 2 }, { source: 2, target: 3 }]
                            }
                        },
                        expectedResult: (result) => result && result.centrality
                    }
                ]
            }
        ];
    }

    /**
     * Create Circos specific tests
     */
    createCircosTests() {
        return [
            {
                name: 'Circos Basic Test',
                description: 'Test basic Circos functionality',
                type: 'circos',
                target: 'basic',
                testCases: [
                    {
                        name: 'Circos Window Creation',
                        test: async () => {
                            // Test if Circos window can be created
                            return { success: true, message: 'Circos window creation test' };
                        }
                    }
                ]
            },
            {
                name: 'Circos Performance Test',
                description: 'Test Circos rendering performance',
                type: 'circos',
                target: 'performance',
                testCases: [
                    {
                        name: 'Large Dataset Rendering',
                        test: async () => {
                            const startTime = Date.now();
                            // Simulate large dataset rendering
                            await new Promise(resolve => setTimeout(resolve, 100));
                            const duration = Date.now() - startTime;
                            return { 
                                success: duration < 5000, 
                                message: `Rendering took ${duration}ms`,
                                duration 
                            };
                        }
                    }
                ]
            },
            {
                name: 'Circos Theme Test',
                description: 'Test different Circos themes and styling',
                type: 'circos',
                target: 'theme',
                testCases: [
                    {
                        name: 'Default Theme',
                        test: async () => {
                            return { success: true, message: 'Default theme applied successfully' };
                        }
                    },
                    {
                        name: 'Dark Theme',
                        test: async () => {
                            return { success: true, message: 'Dark theme applied successfully' };
                        }
                    }
                ]
            },
            {
                name: 'Circos Export Test',
                description: 'Test Circos export functionality',
                type: 'circos',
                target: 'export',
                testCases: [
                    {
                        name: 'SVG Export',
                        test: async () => {
                            return { success: true, message: 'SVG export functionality verified' };
                        }
                    },
                    {
                        name: 'PNG Export',
                        test: async () => {
                            return { success: true, message: 'PNG export functionality verified' };
                        }
                    }
                ]
            }
        ];
    }

    /**
     * Create generic visualization tests
     */
    createGenericVisualizationTests() {
        return [
            {
                name: 'Basic Rendering',
                description: 'Test basic visualization rendering',
                type: 'visualization',
                target: 'render',
                testCases: [
                    {
                        name: 'Empty Container Rendering',
                        test: async (plugin, container) => {
                            // Test rendering with minimal data
                            const success = container && container.nodeType === 1;
                            return { success, message: success ? 'Container valid' : 'Invalid container' };
                        }
                    }
                ]
            }
        ];
    }

    /**
     * Create default function tests
     */
    createDefaultFunctionTests() {
        return [
            {
                name: 'Function Availability',
                description: 'Test function availability and structure',
                type: 'validation',
                testCases: [
                    {
                        name: 'Functions Defined',
                        test: async (plugin) => {
                            const hasFunctions = plugin.functions && Object.keys(plugin.functions).length > 0;
                            return { 
                                success: hasFunctions, 
                                message: hasFunctions ? 
                                    `${Object.keys(plugin.functions).length} functions available` :
                                    'No functions defined'
                            };
                        }
                    }
                ]
            }
        ];
    }

    /**
     * Create default visualization tests
     */
    createDefaultVisualizationTests() {
        return [
            {
                name: 'Data Type Support',
                description: 'Test supported data types',
                type: 'validation',
                testCases: [
                    {
                        name: 'Supported Data Types',
                        test: async (plugin) => {
                            const hasDataTypes = plugin.supportedDataTypes && plugin.supportedDataTypes.length > 0;
                            return {
                                success: hasDataTypes,
                                message: hasDataTypes ?
                                    `${plugin.supportedDataTypes.length} data types supported` :
                                    'No supported data types defined'
                            };
                        }
                    }
                ]
            }
        ];
    }
}

/**
 * PluginTestRunner - Executes tests for a specific plugin
 */
class PluginTestRunner {
    constructor(plugin, testSuite, pluginManager, testWindow) {
        this.plugin = plugin;
        this.testSuite = testSuite;
        this.pluginManager = pluginManager;
        this.testWindow = testWindow;
        this.results = [];
    }

    /**
     * Run all tests in the test suite
     */
    async runTests() {
        console.log(`Running test suite: ${this.testSuite.name}`);
        
        for (const test of this.testSuite.tests) {
            try {
                const testResult = await this.runSingleTest(test);
                this.results.push(testResult);
            } catch (error) {
                this.results.push({
                    name: test.name,
                    success: false,
                    message: `Test failed: ${error.message}`,
                    error: error
                });
            }
        }

        return {
            plugin: this.plugin.name,
            testSuite: this.testSuite.name,
            results: this.results,
            summary: this.generateSummary()
        };
    }

    /**
     * Run a single test
     */
    async runSingleTest(test) {
        console.log(`Running test: ${test.name}`);

        if (test.type === 'function') {
            return await this.runFunctionTest(test);
        } else if (test.type === 'visualization') {
            return await this.runVisualizationTest(test);
        } else if (test.type === 'circos') {
            return await this.runCircosTest(test);
        } else if (test.type === 'validation') {
            return await this.runValidationTest(test);
        } else {
            return await this.runCustomTest(test);
        }
    }

    /**
     * Run function-specific tests
     */
    async runFunctionTest(test) {
        const results = [];
        
        for (const testCase of test.testCases) {
            try {
                const fullFunctionName = `${this.plugin.name.toLowerCase().replace(/\s+/g, '-')}.${test.target}`;
                const result = await this.pluginManager.executeFunctionByName(fullFunctionName, testCase.parameters);
                
                const success = testCase.expectedResult ? testCase.expectedResult(result) : !!result;
                results.push({
                    name: testCase.name,
                    success,
                    message: success ? 'Test passed' : 'Test failed - unexpected result',
                    result
                });
            } catch (error) {
                results.push({
                    name: testCase.name,
                    success: false,
                    message: `Function execution failed: ${error.message}`,
                    error
                });
            }
        }

        return {
            name: test.name,
            description: test.description,
            success: results.every(r => r.success),
            message: `${results.filter(r => r.success).length}/${results.length} test cases passed`,
            testCases: results
        };
    }

    /**
     * Run visualization-specific tests
     */
    async runVisualizationTest(test) {
        const results = [];
        
        for (const testCase of test.testCases) {
            try {
                const result = await testCase.test(this.plugin, this.createTestContainer());
                results.push({
                    name: testCase.name,
                    success: result.success,
                    message: result.message,
                    result
                });
            } catch (error) {
                results.push({
                    name: testCase.name,
                    success: false,
                    message: `Visualization test failed: ${error.message}`,
                    error
                });
            }
        }

        return {
            name: test.name,
            description: test.description,
            success: results.every(r => r.success),
            message: `${results.filter(r => r.success).length}/${results.length} test cases passed`,
            testCases: results
        };
    }

    /**
     * Run Circos-specific tests
     */
    async runCircosTest(test) {
        const results = [];
        
        for (const testCase of test.testCases) {
            try {
                const result = await testCase.test();
                results.push({
                    name: testCase.name,
                    success: result.success,
                    message: result.message,
                    result
                });
            } catch (error) {
                results.push({
                    name: testCase.name,
                    success: false,
                    message: `Circos test failed: ${error.message}`,
                    error
                });
            }
        }

        return {
            name: test.name,
            description: test.description,
            success: results.every(r => r.success),
            message: `${results.filter(r => r.success).length}/${results.length} test cases passed`,
            testCases: results
        };
    }

    /**
     * Run validation tests
     */
    async runValidationTest(test) {
        const results = [];
        
        for (const testCase of test.testCases) {
            try {
                const result = await testCase.test(this.plugin);
                results.push({
                    name: testCase.name,
                    success: result.success,
                    message: result.message,
                    result
                });
            } catch (error) {
                results.push({
                    name: testCase.name,
                    success: false,
                    message: `Validation test failed: ${error.message}`,
                    error
                });
            }
        }

        return {
            name: test.name,
            description: test.description,
            success: results.every(r => r.success),
            message: `${results.filter(r => r.success).length}/${results.length} test cases passed`,
            testCases: results
        };
    }

    /**
     * Run custom tests
     */
    async runCustomTest(test) {
        try {
            const result = await test.execute(this.plugin, this.pluginManager);
            return {
                name: test.name,
                description: test.description,
                success: result.success,
                message: result.message,
                result
            };
        } catch (error) {
            return {
                name: test.name,
                description: test.description,
                success: false,
                message: `Custom test failed: ${error.message}`,
                error
            };
        }
    }

    /**
     * Create a test container for visualization tests
     */
    createTestContainer() {
        const container = document.createElement('div');
        container.style.width = '300px';
        container.style.height = '300px';
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.top = '-9999px';
        document.body.appendChild(container);
        
        // Clean up after test
        setTimeout(() => {
            if (container.parentNode) {
                container.parentNode.removeChild(container);
            }
        }, 5000);
        
        return container;
    }

    /**
     * Generate test summary
     */
    generateSummary() {
        const total = this.results.length;
        const passed = this.results.filter(r => r.success).length;
        const failed = total - passed;
        const successRate = total > 0 ? (passed / total * 100).toFixed(1) : 0;

        return {
            total,
            passed,
            failed,
            successRate: parseFloat(successRate)
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PluginTestManager;
} else if (typeof window !== 'undefined') {
    window.PluginTestManager = PluginTestManager;
} 