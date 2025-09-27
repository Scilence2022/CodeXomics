/**
 * Automatic Simple Benchmark Suite - Automatic evaluation + Simple complexity tests
 * Extracted from ComprehensiveBenchmarkSuite.js for better organization
 */
class AutomaticSimpleSuite {
    constructor() {
        this.suiteName = 'Automatic Simple Tests';
        this.suiteId = 'automatic_simple';
        this.description = 'Simple tests with automatic evaluation - Basic genomic analysis operations';
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
     * Initialize automatic simple test cases
     */
    initializeTests() {
        return [
            // NAVIGATION TASKS - Automatic + Simple
            {
                id: 'nav_auto_01',
                name: 'Navigate to Genomic Position',
                type: 'function_call',
                category: 'navigation',
                complexity: 'simple',
                evaluation: 'automatic',
                instruction: 'Navigate to genomic position 100000 on the current chromosome.',
                expectedResult: {
                    tool_name: 'navigate_to_position',
                    parameters: {
                        chromosome: '<current_chromosome>',
                        position: 100000
                    }
                },
                maxScore: 5,
                bonusScore: 1,
                timeout: 30000,
                evaluator: this.evaluateNavigationCall.bind(this)
            },
            {
                id: 'nav_auto_02',
                name: 'Navigate to 3.5M Position',
                type: 'function_call',
                category: 'navigation',
                complexity: 'simple',
                evaluation: 'automatic',
                instruction: 'Navigate to genomic position 3.5M',
                expectedResult: {
                    tool_name: 'navigate_to_position',
                    parameters: {
                        chromosome: '<current_chromosome>',
                        position: 3500000
                    }
                },
                maxScore: 5,
                bonusScore: 1,
                timeout: 30000,
                evaluator: this.evaluateNavigationCall.bind(this)
            },
            {
                id: 'nav_auto_03',
                name: 'Navigate to Region Range',
                type: 'function_call',
                category: 'navigation',
                complexity: 'simple',
                evaluation: 'automatic',
                instruction: 'Show me the genomic region from position 50000 to 75000.',
                expectedResult: {
                    tool_name: 'navigate_to_position',
                    parameters: {
                        chromosome: '<current_chromosome>',
                        start: 50000,
                        end: 75000
                    }
                },
                maxScore: 5,
                bonusScore: 1,
                timeout: 30000,
                evaluator: this.evaluateNavigationCall.bind(this)
            },
            {
                id: 'nav_auto_04',
                name: 'Get Current Browser State',
                type: 'function_call',
                category: 'navigation',
                complexity: 'simple',
                evaluation: 'automatic',
                instruction: 'Get the current state of the genome browser.',
                expectedResult: {
                    tool_name: 'get_current_state',
                    parameters: {}
                },
                maxScore: 5,
                bonusScore: 1,
                timeout: 30000,
                evaluator: this.evaluateBasicFunctionCall.bind(this)
            },

            // ANALYSIS TASKS - Automatic + Simple
            {
                id: 'anal_auto_01',
                name: 'Calculate GC Content',
                type: 'function_call',
                category: 'analysis',
                complexity: 'simple',
                evaluation: 'automatic',
                instruction: 'Calculate the GC content of this DNA sequence: ATGCGCATGCGCTAGC',
                expectedResult: {
                    tool_name: 'compute_gc',
                    parameters: {
                        sequence: 'ATGCGCATGCGCTAGC',
                        include_statistics: true
                    }
                },
                maxScore: 5,
                bonusScore: 1,
                timeout: 30000,
                evaluator: this.evaluateSequenceAnalysisCall.bind(this)
            },
            {
                id: 'anal_auto_02',
                name: 'Reverse Complement',
                type: 'function_call',
                category: 'analysis',
                complexity: 'simple',
                evaluation: 'automatic',
                instruction: 'Get the reverse complement of sequence ATGCGC',
                expectedResult: {
                    tool_name: 'reverse_complement',
                    parameters: {
                        sequence: 'ATGCGC'
                    }
                },
                maxScore: 5,
                bonusScore: 1,
                timeout: 30000,
                evaluator: this.evaluateBasicFunctionCall.bind(this)
            },
            {
                id: 'anal_auto_03',
                name: 'Translate DNA to Protein',
                type: 'function_call',
                category: 'analysis',
                complexity: 'simple',
                evaluation: 'automatic',
                instruction: 'Translate DNA sequence ATGCGATCGTAGC to protein',
                expectedResult: {
                    tool_name: 'translate_dna',
                    parameters: {
                        sequence: 'ATGCGATCGTAGC'
                    }
                },
                maxScore: 5,
                bonusScore: 1,
                timeout: 30000,
                evaluator: this.evaluateBasicFunctionCall.bind(this)
            },

            // DATA LOADING TASKS - Automatic + Simple
            {
                id: 'load_auto_01',
                name: 'Load Genome File Path',
                type: 'function_call',
                category: 'data_loading',
                complexity: 'simple',
                evaluation: 'automatic',
                instruction: 'Load genome file from path /data/ecoli.fasta',
                expectedResult: {
                    tool_name: 'load_genome_file',
                    parameters: {
                        filePath: '/data/ecoli.fasta'
                    }
                },
                maxScore: 5,
                bonusScore: 1,
                timeout: 30000,
                evaluator: this.evaluateBasicFunctionCall.bind(this)
            },

            // SEARCH TASKS - Automatic + Simple
            {
                id: 'search_auto_01',
                name: 'Search Gene lacZ',
                type: 'function_call',
                category: 'search',
                complexity: 'simple',
                evaluation: 'automatic',
                instruction: 'Search for the gene lacZ by name.',
                expectedResult: {
                    tool_name: 'search_gene_by_name',
                    parameters: {
                        name: 'lacZ'
                    }
                },
                maxScore: 5,
                bonusScore: 1,
                timeout: 30000,
                evaluator: this.evaluateBasicFunctionCall.bind(this)
            },
            {
                id: 'search_auto_02',
                name: 'Search Ribosome Functions',
                type: 'function_call',
                category: 'search',
                complexity: 'simple',
                evaluation: 'automatic',
                instruction: 'Find genes related to \'ribosome\' function.',
                expectedResult: {
                    tool_name: 'search_features',
                    parameters: {
                        query: 'ribosome',
                        caseSensitive: false
                    }
                },
                maxScore: 5,
                bonusScore: 1,
                timeout: 30000,
                evaluator: this.evaluateSearchFunctionCall.bind(this)
            },
            {
                id: 'search_auto_03',
                name: 'Search Locus Tag b0344',
                type: 'function_call',
                category: 'search',
                complexity: 'simple',
                evaluation: 'automatic',
                instruction: 'Find the gene with locus tag b0344.',
                expectedResult: {
                    tool_name: 'search_gene_by_name',
                    parameters: {
                        name: 'b0344'
                    }
                },
                maxScore: 5,
                bonusScore: 1,
                timeout: 30000,
                evaluator: this.evaluateBasicFunctionCall.bind(this)
            },

            // EXTERNAL DATABASE TASKS - Automatic + Simple
            {
                id: 'ext_auto_01',
                name: 'Search UniProt for lacZ',
                type: 'function_call',
                category: 'external_database',
                complexity: 'simple',
                evaluation: 'automatic',
                instruction: 'Search UniProt database for protein lacZ.',
                expectedResult: {
                    tool_name: 'uniprot_search',
                    parameters: {
                        sequence: '<lacZ_protein_sequence>',
                        blastType: 'blastp',
                        database: 'nr'
                    }
                },
                maxScore: 5,
                bonusScore: 1,
                timeout: 30000,
                evaluator: this.evaluateBasicFunctionCall.bind(this)
            },
            {
                id: 'ext_auto_02',
                name: 'Get AlphaFold Structure for araA',
                type: 'function_call',
                category: 'external_database',
                complexity: 'simple',
                evaluation: 'automatic',
                instruction: 'Get AlphaFold structure prediction for gene araA.',
                expectedResult: {
                    tool_name: 'alphafold_search',
                    parameters: {
                        sequence: '<araA_protein_sequence>',
                        blastType: 'blastp',
                        database: 'nr'
                    }
                },
                maxScore: 5,
                bonusScore: 1,
                timeout: 30000,
                evaluator: this.evaluateBasicFunctionCall.bind(this)
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
            maxScore: testResult.maxScore || 5, // Use test's actual maxScore, default to 5 for simple
            errors: [],
            warnings: []
        };

        if (!actualResult) {
            evaluation.errors.push('No result obtained from test execution');
            return evaluation;
        }

        // Check tool name - award full points for correct tool
        const actualTool = Array.isArray(actualResult) ? actualResult[0]?.tool_name : actualResult.tool_name;
        if (actualTool === expectedResult.tool_name) {
            evaluation.score = evaluation.maxScore; // Full points for correct tool
        } else {
            evaluation.errors.push(`Expected tool '${expectedResult.tool_name}' but got '${actualTool}'`);
            evaluation.score = 0; // No points for wrong tool
            evaluation.success = false;
            return evaluation;
        }

        // Check parameters - deduct points for parameter issues
        const actualParams = Array.isArray(actualResult) ? actualResult[0]?.parameters : actualResult.parameters;
        if (actualParams && expectedResult.parameters) {
            const expectedKeys = Object.keys(expectedResult.parameters);
            const matchingKeys = expectedKeys.filter(key => 
                key in actualParams && 
                (actualParams[key] === expectedResult.parameters[key] || 
                 expectedResult.parameters[key] === '<current_chromosome>' ||
                 expectedResult.parameters[key] === '<lacZ_protein_sequence>' ||
                 expectedResult.parameters[key] === '<araA_protein_sequence>')
            );
            
            // Deduct 1 point for each missing/incorrect parameter
            const missingParams = expectedKeys.length - matchingKeys.length;
            if (missingParams > 0) {
                evaluation.score = Math.max(0, evaluation.score - missingParams);
                evaluation.warnings.push(`${missingParams} parameter(s) missing or incorrect`);
            }
        }

        evaluation.success = evaluation.score >= Math.ceil(evaluation.maxScore * 0.6); // 60% threshold
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
        
        // Add sequence-specific bonus
        if (actualResult && actualResult.parameters && actualResult.parameters.sequence) {
            const sequence = actualResult.parameters.sequence.toUpperCase();
            const validChars = /^[ATCGN]+$/;
            
            if (validChars.test(sequence)) {
                evaluation.score = Math.min(evaluation.maxScore, evaluation.score + (testResult.bonusScore || 1)); // Add bonus points
            } else {
                evaluation.warnings.push('Sequence contains invalid DNA characters');
            }
        }
        
        return evaluation;
    }

    async evaluateSearchFunctionCall(actualResult, expectedResult, testResult) {
        const evaluation = await this.evaluateBasicFunctionCall(actualResult, expectedResult, testResult);
        
        // Add search-specific bonus
        if (actualResult && actualResult.parameters) {
            const params = actualResult.parameters;
            
            // Check for case sensitivity handling
            if (params.caseSensitive === false || params.caseSensitive === true) {
                evaluation.score = Math.min(evaluation.maxScore, evaluation.score + (testResult.bonusScore || 1)); // Add bonus points
            }
        }
        
        return evaluation;
    }

    async setup(context) {
        console.log('Setting up Automatic Simple test suite');
    }

    async cleanup(context) {
        console.log('Cleaning up Automatic Simple test suite');
    }
}

// Make the class available globally
window.AutomaticSimpleSuite = AutomaticSimpleSuite;