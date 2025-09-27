/**
 * Manual Simple Benchmark Suite - Manual evaluation + Simple complexity tests
 * Extracted from ComprehensiveBenchmarkSuite.js for better organization
 */
class ManualSimpleSuite {
    constructor() {
        this.suiteName = 'Manual Simple Tests';
        this.suiteId = 'manual_simple';
        this.description = 'Simple tests with manual evaluation - Basic genomic operations requiring human verification';
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
     * Initialize manual simple test cases
     */
    initializeTests() {
        return [
            // NAVIGATION TASKS - Manual + Simple
            {
                id: 'nav_manual_01',
                name: 'Jump to lacZ Gene',
                type: 'function_call',
                category: 'navigation',
                complexity: 'simple',
                evaluation: 'manual',
                instruction: 'Jump to the lacZ gene location.',
                expectedResult: {
                    tool_name: 'jump_to_gene',
                    parameters: {
                        geneName: 'lacZ'
                    }
                },
                maxScore: 5,
                bonusScore: 1,
                timeout: 30000,
                evaluator: this.evaluateBasicFunctionCall.bind(this),
                manualVerification: 'Please verify: 1) Browser navigates to lacZ gene, 2) Gene is highlighted/centered in view, 3) Navigation completes within 5 seconds.'
            },
            {
                id: 'nav_manual_02',
                name: 'Open New Browser Tab',
                type: 'function_call',
                category: 'navigation',
                complexity: 'simple',
                evaluation: 'manual',
                instruction: 'Open a new tab for genome browsing.',
                expectedResult: {
                    tool_name: 'open_new_tab',
                    parameters: {}
                },
                maxScore: 5,
                bonusScore: 1,
                timeout: 30000,
                evaluator: this.evaluateBasicFunctionCall.bind(this),
                manualVerification: 'Please confirm: 1) New browser tab opens successfully, 2) New tab is ready for genome visualization, 3) Original tab remains functional.'
            },

            // ANALYSIS TASKS - Manual + Simple
            {
                id: 'anal_manual_01',
                name: 'lacZ Codon Usage Analysis',
                type: 'function_call',
                category: 'analysis',
                complexity: 'simple',
                evaluation: 'manual',
                instruction: 'Analyze codon usage patterns for the lacZ gene',
                expectedResult: {
                    tool_name: 'codon_usage_analysis',
                    parameters: {
                        geneName: 'lacZ',
                        include_statistics: true
                    }
                },
                maxScore: 5,
                bonusScore: 1,
                timeout: 30000,
                evaluator: this.evaluateBasicFunctionCall.bind(this),
                manualVerification: 'Please verify: 1) Codon usage analysis is performed for lacZ, 2) Results show frequency tables and statistics, 3) Codon bias patterns are identified, 4) Results are clearly visualized.'
            },

            // DATA LOADING TASKS - Manual + Simple
            {
                id: 'load_manual_01',
                name: 'Load Genome File Dialog',
                type: 'function_call',
                category: 'data_loading',
                complexity: 'simple',
                evaluation: 'manual',
                instruction: 'Load a genome file using the file selection dialog.',
                expectedResult: {
                    tool_name: 'load_genome_file',
                    parameters: {
                        showFileDialog: true
                    }
                },
                maxScore: 5,
                bonusScore: 1,
                timeout: 30000,
                evaluator: this.evaluateBasicFunctionCall.bind(this),
                manualVerification: 'Please verify: 1) File selection dialog opens properly, 2) Dialog supports FASTA/GenBank formats, 3) File filtering works correctly, 4) Dialog interface is user-friendly.'
            },
            {
                id: 'load_manual_02',
                name: 'Load Annotation Data',
                type: 'function_call',
                category: 'data_loading',
                complexity: 'simple',
                evaluation: 'manual',
                instruction: 'Load annotation data for the current genome.',
                expectedResult: {
                    tool_name: 'load_annotation_file',
                    parameters: {}
                },
                maxScore: 5,
                bonusScore: 1,
                timeout: 30000,
                evaluator: this.evaluateBasicFunctionCall.bind(this),
                manualVerification: 'Please verify: 1) Annotation loading interface appears, 2) Compatible annotation formats are supported, 3) File selection is intuitive, 4) Loading progress is indicated.'
            },
            {
                id: 'load_manual_03',
                name: 'Load Aligned Reads',
                type: 'function_call',
                category: 'data_loading',
                complexity: 'simple',
                evaluation: 'manual',
                instruction: 'Load aligned reads data for genome visualization.',
                expectedResult: {
                    tool_name: 'load_reads_file',
                    parameters: {}
                },
                maxScore: 5,
                bonusScore: 1,
                timeout: 30000,
                evaluator: this.evaluateBasicFunctionCall.bind(this),
                manualVerification: 'Please verify: 1) Reads file dialog opens, 2) BAM/SAM formats are supported, 3) File size handling is appropriate, 4) Integration with genome view is prepared.'
            },
            {
                id: 'load_manual_04',
                name: 'Load WIG Track Data',
                type: 'function_call',
                category: 'data_loading',
                complexity: 'simple',
                evaluation: 'manual',
                instruction: 'Load WIG track data for quantitative visualization.',
                expectedResult: {
                    tool_name: 'load_wig_tracks',
                    parameters: {}
                },
                maxScore: 5,
                bonusScore: 1,
                timeout: 30000,
                evaluator: this.evaluateBasicFunctionCall.bind(this),
                manualVerification: 'Please verify: 1) WIG file loading interface appears, 2) Track configuration options are available, 3) Quantitative data handling is prepared, 4) Visualization parameters can be set.'
            },

            // SEARCH TASKS - Manual + Simple
            {
                id: 'search_manual_01',
                name: 'Search b003 Locus Tags',
                type: 'function_call',
                category: 'search',
                complexity: 'simple',
                evaluation: 'manual',
                instruction: 'Search for genes with locus tags starting with \'b003\'.',
                expectedResult: {
                    tool_name: 'search_gene_by_name',
                    parameters: {
                        name: 'b003',
                        exact_match: false
                    }
                },
                maxScore: 5,
                bonusScore: 1,
                timeout: 30000,
                evaluator: this.evaluateBasicFunctionCall.bind(this),
                manualVerification: 'Please verify: 1) Search identifies genes with locus tags b0030, b0031, etc., 2) Partial matching works correctly, 3) Results are comprehensive, 4) Search performance is acceptable.'
            }
        ];
    }

    /**
     * Evaluator methods - shared across all suite types
     */
    async evaluateBasicFunctionCall(actualResult, expectedResult, testResult) {
        const evaluation = {
            success: false,
            score: 0,
            maxScore: testResult.maxScore || 100,
            errors: [],
            warnings: []
        };

        if (!actualResult) {
            evaluation.errors.push('No result obtained from test execution');
            return evaluation;
        }

        // Check tool name
        const actualTool = Array.isArray(actualResult) ? actualResult[0]?.tool_name : actualResult.tool_name;
        if (actualTool === expectedResult.tool_name) {
            evaluation.score += Math.floor(evaluation.maxScore * 0.6); // 60% for correct tool
        } else {
            evaluation.errors.push(`Expected tool '${expectedResult.tool_name}' but got '${actualTool}'`);
        }

        // Check parameters
        const actualParams = Array.isArray(actualResult) ? actualResult[0]?.parameters : actualResult.parameters;
        if (actualParams && expectedResult.parameters) {
            let paramScore = 0;
            const expectedKeys = Object.keys(expectedResult.parameters);
            const matchingKeys = expectedKeys.filter(key => 
                key in actualParams && 
                (actualParams[key] === expectedResult.parameters[key] || 
                 expectedResult.parameters[key] === '<current_chromosome>' ||
                 expectedResult.parameters[key] === '<lacZ_protein_sequence>' ||
                 expectedResult.parameters[key] === '<araA_protein_sequence>')
            );
            
            if (expectedKeys.length > 0) {
                paramScore = Math.floor(evaluation.maxScore * 0.4 * (matchingKeys.length / expectedKeys.length));
            }
            evaluation.score += paramScore;
        }

        evaluation.success = evaluation.score >= Math.floor(evaluation.maxScore * 0.6);
        return evaluation;
    }

    async evaluateNavigationCall(actualResult, expectedResult, testResult) {
        const evaluation = await this.evaluateBasicFunctionCall(actualResult, expectedResult, testResult);
        
        // Add navigation-specific checks
        if (actualResult && actualResult.parameters) {
            const params = actualResult.parameters;
            
            // Check for reasonable coordinate ranges
            if (params.start && params.end && params.start > params.end) {
                evaluation.warnings.push('Start position should be less than end position');
            }
            
            // Check for very large ranges that might indicate errors
            if (params.start && params.end && (params.end - params.start) > 10000000) {
                evaluation.warnings.push('Range is very large (>10Mb), verify this is intentional');
            }
        }
        
        return evaluation;
    }

    async evaluateSequenceAnalysisCall(actualResult, expectedResult, testResult) {
        const evaluation = await this.evaluateBasicFunctionCall(actualResult, expectedResult, testResult);
        
        // Add sequence-specific checks
        if (actualResult && actualResult.parameters && actualResult.parameters.sequence) {
            const sequence = actualResult.parameters.sequence.toUpperCase();
            const validChars = /^[ATCGN]+$/;
            
            if (validChars.test(sequence)) {
                evaluation.score += 5; // Bonus for valid DNA sequence
            } else {
                evaluation.warnings.push('Sequence contains invalid DNA characters');
            }
        }
        
        return evaluation;
    }

    async evaluateSearchFunctionCall(actualResult, expectedResult, testResult) {
        const evaluation = await this.evaluateBasicFunctionCall(actualResult, expectedResult, testResult);
        
        // Add search-specific checks
        if (actualResult && actualResult.parameters) {
            const params = actualResult.parameters;
            
            // Check for case sensitivity handling
            if (params.caseSensitive === false || params.caseSensitive === true) {
                evaluation.score += 2; // Bonus for explicit case sensitivity handling
            }
        }
        
        return evaluation;
    }

    async setup(context) {
        console.log('Setting up Manual Simple test suite');
    }

    async cleanup(context) {
        console.log('Cleaning up Manual Simple test suite');
    }
}

// Make the class available globally
window.ManualSimpleSuite = ManualSimpleSuite;