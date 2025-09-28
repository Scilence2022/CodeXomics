/**
 * Manual Complex Benchmark Suite - Manual evaluation + Complex complexity tests
 * Extracted from ComprehensiveBenchmarkSuite.js for better organization
 */
class ManualComplexSuite {
    constructor() {
        this.suiteName = 'Manual Complex Tests';
        this.suiteId = 'manual_complex';
        this.description = 'Complex tests with manual evaluation - Advanced genomic workflows requiring human verification';
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
     * Initialize manual complex test cases
     */
    initializeTests() {
        return [
            // DATA LOADING TASKS - Manual + Complex
            {
                id: 'load_manual_05',
                name: 'Complete Genomic Environment Setup',
                type: 'workflow',
                category: 'data_loading',
                complexity: 'complex',
                evaluation: 'manual',
                instruction: 'Set up a complete genomic analysis environment by loading genome file, gene annotations, variant data (VCF), and expression tracks (WIG) in the optimal order for integrated analysis.',
                expectedResult: {
                    tool_sequence: ['load_genome_file', 'load_annotation_file', 'load_variant_file', 'load_wig_tracks'],
                    parameters: [{}, {}, {}, {}]
                },
                maxScore: 10,
                bonusScore: 2,
                timeout: 60000,
                evaluator: this.evaluateWorkflowCall.bind(this),
                manualVerification: 'Please verify: 1) All four data types load successfully, 2) Loading order is optimal for integration, 3) Data layers are properly aligned, 4) Cross-references between layers work, 5) Integrated view is functional, 6) Performance remains acceptable.'
            },
            {
                id: 'load_manual_06',
                name: 'Multi-track Comparative Setup',
                type: 'workflow',
                category: 'data_loading',
                complexity: 'complex',
                evaluation: 'manual',
                instruction: 'Create a multi-track comparative analysis setup by loading reference genome, sample reads, and variant calls, then configure tracks for mutation impact visualization.',
                expectedResult: {
                    tool_sequence: ['load_genome_file', 'load_reads_file', 'load_variant_file'],
                    parameters: [{}, {}, {}]
                },
                maxScore: 10,
                bonusScore: 2,
                timeout: 60000,
                evaluator: this.evaluateWorkflowCall.bind(this),
                manualVerification: 'Please verify: 1) Reference genome loads first, 2) Sample reads align properly, 3) Variant calls integrate correctly, 4) Track layering is logical, 5) Mutation impacts are visualizable, 6) Comparative analysis is enabled.'
            },

            // SEARCH TASKS - Manual + Complex
            {
                id: 'search_manual_02',
                name: 'Amino Acid Biosynthesis Distribution',
                type: 'workflow',
                category: 'search',
                complexity: 'complex',
                evaluation: 'manual',
                instruction: 'Search for all genes involved in \'amino acid biosynthesis\' and create a chromosomal distribution map showing their locations and functional clustering.',
                expectedResult: {
                    tool_sequence: ['search_features', 'navigate_to_position'],
                    parameters: [
                        { query: 'amino acid biosynthesis', caseSensitive: false },
                        'multiple_navigation_calls'
                    ]
                },
                maxScore: 10,
                bonusScore: 2,
                timeout: 60000,
                evaluator: this.evaluateWorkflowCall.bind(this),
                manualVerification: 'Please verify: 1) Comprehensive gene identification for amino acid biosynthesis, 2) Chromosomal positions are mapped, 3) Distribution patterns are visualized, 4) Functional clustering is identified, 5) Results enable pathway analysis.'
            },
            {
                id: 'search_manual_03',
                name: 'ara Genes Clustering Analysis',
                type: 'workflow',
                category: 'search',
                complexity: 'complex',
                evaluation: 'manual',
                instruction: 'Find all genes with names containing \'ara\' and perform integrated analysis of their chromosomal clustering.',
                expectedResult: {
                    tool_sequence: ['search_gene_by_name', 'analyze_region'],
                    parameters: [
                        { name: 'ara', exact_match: false },
                        'sequence_analysis_parameters'
                    ]
                },
                maxScore: 10,
                bonusScore: 2,
                timeout: 60000,
                evaluator: this.evaluateWorkflowCall.bind(this),
                manualVerification: 'Please verify: 1) All ara genes are identified, 2) Chromosomal clustering is assessed, 3) Results are integrated coherently, 4) Comparative analysis is meaningful.'
            },

            // ANALYSIS TASKS - Manual + Complex
            {
                id: 'anal_manual_02',
                name: 'araA Comprehensive Codon Analysis',
                type: 'function_call',
                category: 'analysis',
                complexity: 'complex',
                evaluation: 'manual',
                instruction: 'Perform comprehensive codon usage analysis for araA gene.',
                expectedResult: {
                    tool_name: 'codon_usage_analysis',
                    parameters: {
                        geneName: 'araA',
                        include_statistics: true,
                        genetic_code: 'standard'
                    }
                },
                maxScore: 10,
                bonusScore: 2,
                timeout: 60000,
                evaluator: this.evaluateBasicFunctionCall.bind(this),
                manualVerification: 'Please verify: 1) Detailed codon analysis is performed for araA, 2) Bias patterns are clearly identified, 3) Statistical comparisons are provided, 4) Results include significance testing, 5) Visualization effectively shows patterns.'
            },
            {
                id: 'anal_manual_03',
                name: 'thrC Upstream Sequence Analysis',
                type: 'workflow',
                category: 'analysis',
                complexity: 'complex',
                evaluation: 'manual',
                instruction: 'Analyze the sequence composition in the 500bp region upstream of the thrC gene.',
                expectedResult: {
                    tool_sequence: ['get_sequence', 'compute_gc'],
                    parameters: [
                        { geneName: 'thrC', upstream: 500 },
                        { sequence: '<retrieved_sequence>' }
                    ]
                },
                maxScore: 10,
                bonusScore: 2,
                timeout: 60000,
                evaluator: this.evaluateWorkflowCall.bind(this),
                manualVerification: 'Please verify: 1) 500bp upstream sequence is correctly retrieved, 2) GC content analysis is performed, 3) Results show detailed composition analysis, 4) Analysis provides meaningful insights about sequence characteristics.'
            },

            // EXTERNAL DATABASE TASKS - Manual + Complex
            {
                id: 'ext_manual_01',
                name: 'Comprehensive Protein Analysis for araA',
                type: 'workflow',
                category: 'external_database',
                complexity: 'complex',
                evaluation: 'manual',
                instruction: 'Perform comprehensive protein analysis for araA gene: retrieve UniProt annotation and AlphaFold structure prediction, then integrate results for functional characterization.',
                expectedResult: {
                    tool_sequence: ['uniprot_search', 'alphafold_search'],
                    parameters: [
                        { sequence: '<araA_protein_sequence>', blastType: 'blastp', database: 'nr' },
                        { sequence: '<araA_protein_sequence>', blastType: 'blastp', database: 'nr' }
                    ]
                },
                maxScore: 10,
                bonusScore: 2,
                timeout: 60000,
                evaluator: this.evaluateWorkflowCall.bind(this),
                manualVerification: 'Please verify: 1) Both database searches execute successfully, 2) Results are comprehensive and relevant, 3) Data integration maintains cross-references, 4) Functional characterization is coherent, 5) Structural and functional data correlate.'
            },

            // WORKFLOW INTEGRATION TASKS - Manual + Complex
            {
                id: 'workflow_manual_01',
                name: 'Comparative Genomics Analysis',
                type: 'workflow',
                category: 'workflow',
                complexity: 'complex',
                evaluation: 'manual',
                instruction: 'Perform complete comparative genomics analysis: load two bacterial genomes, identify orthologs of lacZ gene, compare their codon usage patterns and assess evolutionary conservation.',
                expectedResult: {
                    tool_sequence: ['load_genome_file', 'search_gene_by_name', 'codon_usage_analysis'],
                    parameters: [
                        { filePath: '<genome_path>' },
                        { name: 'lacZ' },
                        { geneName: 'lacZ', include_statistics: true }
                    ]
                },
                maxScore: 15,
                bonusScore: 3,
                timeout: 90000,
                evaluator: this.evaluateWorkflowCall.bind(this),
                manualVerification: 'Please verify: 1) Both genomes load successfully, 2) lacZ orthologs are identified accurately, 3) Codon usage comparison is statistically robust, 4) Evolutionary analysis is comprehensive, 5) Results integration is scientifically meaningful.'
            },
            {
                id: 'workflow_manual_02',
                name: 'Genome Analysis Workflow',
                type: 'workflow',
                category: 'workflow',
                complexity: 'complex',
                evaluation: 'manual',
                instruction: 'Design and validate genome analysis workflow: load genome and annotation files, analyze sequence composition, and generate comprehensive reports.',
                expectedResult: {
                    tool_sequence: ['load_genome_file', 'load_annotation_file', 'get_sequence', 'compute_gc'],
                    parameters: [
                        { showFileDialog: true },
                        {},
                        { chromosome: '<current_chromosome>', start: 1, end: 10000 },
                        { sequence: '<retrieved_sequence>', include_statistics: true }
                    ]
                },
                maxScore: 15,
                bonusScore: 3,
                timeout: 90000,
                evaluator: this.evaluateWorkflowCall.bind(this),
                manualVerification: 'Please verify: 1) Genome and annotations load successfully, 2) Sequence analysis is comprehensive, 3) Reports are generated with meaningful insights, 4) Workflow is efficient and logical, 5) Results meet analysis objectives.'
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
            maxScore: testResult.maxScore || 10, // Use test's actual maxScore, default to 10 for complex
            errors: [],
            warnings: []
        };

        if (!actualResult) {
            evaluation.errors.push('No result obtained from test execution');
            return evaluation;
        }

        console.log(`📊 [ManualComplexSuite] Evaluating test result:`, {
            testId: testResult.testId,
            expectedTool: expectedResult.tool_name,
            actualResult: actualResult,
            resultType: typeof actualResult
        });

        // PRIORITY 0: Check Tool Execution Tracker for direct execution status
        if (window.chatManager && window.chatManager.toolExecutionTracker) {
            const tracker = window.chatManager.toolExecutionTracker;
            const recentExecutions = tracker.getSessionExecutions();
            
            console.log(`🔍 [ManualComplexSuite] Checking tracker for tool: ${expectedResult.tool_name}`);
            
            // Look for recent successful execution of the expected tool
            const relevantExecution = recentExecutions.find(exec => 
                exec.toolName === expectedResult.tool_name && 
                exec.status === 'completed' &&
                Date.now() - exec.startTime < 30000 // Within last 30 seconds
            );
            
            if (relevantExecution) {
                console.log(`✅ [ManualComplexSuite] TRACKER SUCCESS: Found successful execution of '${expectedResult.tool_name}'`, relevantExecution);
                evaluation.score = evaluation.maxScore; // FULL POINTS from tracker
                evaluation.success = true;
                evaluation.warnings.push('Awarded full points based on Tool Execution Tracker data');
                return evaluation;
            }
            
            // Look for recent failed execution
            const failedExecution = recentExecutions.find(exec => 
                exec.toolName === expectedResult.tool_name && 
                exec.status === 'failed' &&
                Date.now() - exec.startTime < 30000 // Within last 30 seconds
            );
            
            if (failedExecution) {
                console.log(`❌ [ManualComplexSuite] TRACKER FAILURE: Found failed execution of '${expectedResult.tool_name}'`, failedExecution);
                evaluation.errors.push(`Tool execution failed: ${failedExecution.error?.message || 'Unknown error'}`);
                return evaluation; // Score remains 0
            }
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
            
            // Deduct 1 point for each missing/incorrect parameter (up to 2 points for complex)
            const missingParams = expectedKeys.length - matchingKeys.length;
            if (missingParams > 0) {
                evaluation.score = Math.max(0, evaluation.score - Math.min(2, missingParams));
                evaluation.warnings.push(`${missingParams} parameter(s) missing or incorrect`);
            }
        }

        evaluation.success = evaluation.score >= Math.ceil(evaluation.maxScore * 0.6); // 60% threshold
        return evaluation;
    }

    async evaluateWorkflowCall(actualResult, expectedResult, testResult) {
        const evaluation = {
            success: false,
            score: 0,
            maxScore: testResult.maxScore || 10, // Use test's actual maxScore, default to 10 for complex
            errors: [],
            warnings: []
        };

        if (!actualResult) {
            evaluation.errors.push('No result obtained from workflow execution');
            return evaluation;
        }

        // For workflows, award points based on completion
        if (Array.isArray(actualResult) && actualResult.length > 1) {
            evaluation.score = Math.ceil(evaluation.maxScore * 0.5); // 50% for multi-step execution
            
            // Check if expected tools are present
            if (expectedResult.tool_sequence) {
                const actualTools = actualResult.map(call => call.tool_name);
                const expectedTools = expectedResult.tool_sequence;
                
                let toolMatches = 0;
                expectedTools.forEach(expectedTool => {
                    if (actualTools.includes(expectedTool)) {
                        toolMatches++;
                    }
                });
                
                if (expectedTools.length > 0) {
                    const remainingPoints = evaluation.maxScore - evaluation.score;
                    const toolScore = Math.floor(remainingPoints * (toolMatches / expectedTools.length));
                    evaluation.score += toolScore;
                }
            }
        } else {
            // Single step workflow
            const singleStepEval = await this.evaluateBasicFunctionCall(actualResult, 
                { tool_name: expectedResult.tool_sequence?.[0] || expectedResult.tool_name, 
                  parameters: expectedResult.parameters?.[0] || expectedResult.parameters }, 
                testResult);
            evaluation.score = singleStepEval.score;
            evaluation.errors = singleStepEval.errors;
            evaluation.warnings = singleStepEval.warnings;
        }

        evaluation.success = evaluation.score >= Math.ceil(evaluation.maxScore * 0.6); // 60% threshold
        return evaluation;
    }

    async setup(context) {
        console.log('Setting up Manual Complex test suite');
    }

    async cleanup(context) {
        console.log('Cleaning up Manual Complex test suite');
    }
}

// Make the class available globally
window.ManualComplexSuite = ManualComplexSuite;