/**
 * Comprehensive Benchmark Suite - Based on COMPREHENSIVE_BENCHMARK_FRAMEWORK.md
 * Tests LLM capabilities across all genomic analysis task categories
 */
class ComprehensiveBenchmarkSuite {
    constructor() {
        this.suiteName = 'Comprehensive Genomic Analysis';
        this.suiteId = 'comprehensive_genomic';
        this.description = 'Comprehensive testing of AI agent performance across all genomic analysis categories';
        this.framework = null;
        this.defaultDirectory = null; // Will be set when framework provides configuration
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
     * Set configuration including default directory
     */
    setConfiguration(config) {
        if (config && config.defaultDirectory) {
            this.defaultDirectory = config.defaultDirectory;
            console.log(`📁 ComprehensiveBenchmarkSuite default directory set to: ${this.defaultDirectory}`);
            
            // Regenerate tests with updated paths
            this.tests = this.initializeTests();
        }
    }

    /**
     * Get default file directory from configuration or fallback
     */
    getDefaultDirectory() {
        // Try to get from current configuration
        if (this.defaultDirectory) {
            return this.defaultDirectory;
        }
        
        // Try to get from BenchmarkUI if available
        if (window.benchmarkUI && window.benchmarkUI.getDefaultDirectory) {
            const uiDirectory = window.benchmarkUI.getDefaultDirectory();
            if (uiDirectory) {
                return uiDirectory;
            }
        }
        
        // Fallback to memory default
        return '/Users/song/Documents/Genome-AI-Studio-Projects/test_data/';
    }

    /**
     * Build file path using default directory
     */
    buildFilePath(filename) {
        const defaultDir = this.getDefaultDirectory();
        // Ensure directory ends with slash
        const normalizedDir = defaultDir.endsWith('/') ? defaultDir : defaultDir + '/';
        return normalizedDir + filename;
    }

    /**
     * Initialize all test cases according to the comprehensive framework
     */
    initializeTests() {
        return [
            // NAVIGATION TASKS - Automatic Evaluation (Simple)
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
            {
                id: 'nav_auto_05',
                name: 'Navigate Complex Range Analysis',
                type: 'function_call',
                category: 'navigation',
                complexity: 'complex',
                evaluation: 'automatic',
                instruction: 'Navigate to region 1130000 to 1300000 and analyze the genomic features in this range.',
                expectedResult: {
                    tool_name: 'navigate_to_position',
                    parameters: {
                        chromosome: '<current_chromosome>',
                        start: 1130000,
                        end: 1300000
                    }
                },
                maxScore: 10,
                bonusScore: 2,
                timeout: 60000,
                evaluator: this.evaluateNavigationCall.bind(this)
            },

            // NAVIGATION TASKS - Manual Evaluation
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

            // ANALYSIS TASKS - Automatic Evaluation
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

            // ANALYSIS TASKS - Manual Evaluation
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

            // DATA LOADING TASKS - Automatic Evaluation
            {
                id: 'load_auto_01',
                name: 'Load Genome File Path',
                type: 'function_call',
                category: 'data_loading',
                complexity: 'simple',
                evaluation: 'automatic',
                instruction: `Load genome file ${this.buildFilePath('ECOLI.gbk')}`,
                expectedResult: {
                    tool_name: 'load_genome_file',
                    parameters: {
                        filePath: this.buildFilePath('ECOLI.gbk')
                    }
                },
                maxScore: 5,
                bonusScore: 1,
                timeout: 30000,
                evaluator: this.evaluateBasicFunctionCall.bind(this)
            },

            // SEARCH TASKS - Automatic Evaluation
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

            // EXTERNAL DATABASE TASKS - Automatic Evaluation
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
            },

            // Additional Manual Data Loading Tasks
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

            // Additional Manual Search Tasks
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
            },
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

            // Additional Analysis Tasks
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

            // External Database Task - Manual Evaluation
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

            // Workflow Integration Tasks
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
     * Basic function call evaluator with priority-based success detection
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

        console.log(`📊 [ComprehensiveBenchmark] Evaluating test result:`, {
            testId: testResult.testId,
            expectedTool: expectedResult.tool_name,
            actualResult: actualResult,
            resultType: typeof actualResult
        });

        // PRIORITY 0: Check Tool Execution Tracker for direct execution status
        if (window.chatManager && window.chatManager.toolExecutionTracker) {
            const tracker = window.chatManager.toolExecutionTracker;
            const recentExecutions = tracker.getSessionExecutions();
            
            console.log(`🔍 [ComprehensiveBenchmark] Checking tracker for tool: ${expectedResult.tool_name}`);
            
            // Look for recent successful execution of the expected tool
            const relevantExecution = recentExecutions.find(exec => 
                exec.toolName === expectedResult.tool_name && 
                exec.status === 'completed' &&
                Date.now() - exec.startTime < 30000 // Within last 30 seconds
            );
            
            if (relevantExecution) {
                console.log(`✅ [ComprehensiveBenchmark] TRACKER SUCCESS: Found successful execution of '${expectedResult.tool_name}'`, relevantExecution);
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
                console.log(`❌ [ComprehensiveBenchmark] TRACKER FAILURE: Found failed execution of '${expectedResult.tool_name}'`, failedExecution);
                evaluation.errors.push(`Tool execution failed: ${failedExecution.error?.message || 'Unknown error'}`);
                return evaluation; // Score remains 0
            }
        }

        // PRIORITY 1: Check for explicit tool execution success signals
        if (typeof actualResult === 'string') {
            const successPatterns = [
                /tool execution completed.*succeeded/i,
                /successfully (executed|navigated|loaded|processed|analyzed)/i,
                /task completed successfully/i,
                /operation completed successfully/i,
                /results have been processed/i
            ];
            
            const hasSuccessSignal = successPatterns.some(pattern => pattern.test(actualResult));
            
            if (hasSuccessSignal) {
                // Check if the expected tool name appears in the response
                const toolMentioned = actualResult.toLowerCase().includes(expectedResult.tool_name.toLowerCase());
                
                if (toolMentioned) {
                    console.log(`✅ [ComprehensiveBenchmark] SUCCESS SIGNAL DETECTED: Tool '${expectedResult.tool_name}' executed successfully`);
                    evaluation.score = evaluation.maxScore; // FULL POINTS
                    evaluation.success = true;
                    evaluation.warnings.push('Awarded full points based on explicit success signal');
                    return evaluation;
                }
            }
        }

        // PRIORITY 2: Check tool name
        const actualTool = Array.isArray(actualResult) ? actualResult[0]?.tool_name : actualResult.tool_name;
        if (actualTool === expectedResult.tool_name) {
            evaluation.score += Math.floor(evaluation.maxScore * 0.6); // 60% for correct tool
        } else {
            evaluation.errors.push(`Expected tool '${expectedResult.tool_name}' but got '${actualTool}'`);
        }

        // Check parameters with enhanced position↔range conversion support
        const actualParams = Array.isArray(actualResult) ? actualResult[0]?.parameters : actualResult.parameters;
        if (actualParams && expectedResult.parameters) {
            let paramScore = 0;
            const expectedKeys = Object.keys(expectedResult.parameters);
            const matchingKeys = expectedKeys.filter(key => {
                if (!(key in actualParams)) {
                    // Handle position→range conversion
                    if (key === 'position' && 'start' in actualParams && 'end' in actualParams) {
                        const expectedPosition = expectedResult.parameters[key];
                        const actualStart = actualParams.start;
                        const actualEnd = actualParams.end;
                        const rangeCenter = Math.floor((actualStart + actualEnd) / 2);
                        const tolerance = Math.abs(actualEnd - actualStart);
                        return Math.abs(expectedPosition - rangeCenter) <= tolerance / 2;
                    }
                    
                    // Handle range→position conversion
                    if ((key === 'start' || key === 'end') && 'position' in actualParams) {
                        const actualPosition = actualParams.position;
                        const expectedValue = expectedResult.parameters[key];
                        
                        if (key === 'start') {
                            const expectedEnd = expectedResult.parameters.end || (expectedValue + 2000);
                            return actualPosition >= expectedValue && actualPosition <= expectedEnd;
                        } else if (key === 'end') {
                            const expectedStart = expectedResult.parameters.start || (expectedValue - 2000);
                            return actualPosition >= expectedStart && actualPosition <= expectedValue;
                        }
                    }
                    
                    return false;
                }
                
                const actualValue = actualParams[key];
                const expectedValue = expectedResult.parameters[key];
                
                // Enhanced placeholder matching
                if (expectedValue === '<current_chromosome>' && typeof actualValue === 'string' && actualValue.length > 0) {
                    return true;
                }
                if (expectedValue === '<lacZ_protein_sequence>' || expectedValue === '<araA_protein_sequence>') {
                    return true;
                }
                
                return actualValue === expectedValue;
            });
            
            if (expectedKeys.length > 0) {
                paramScore = Math.floor(evaluation.maxScore * 0.4 * (matchingKeys.length / expectedKeys.length));
            }
            evaluation.score += paramScore;
        }

        evaluation.success = evaluation.score >= Math.floor(evaluation.maxScore * 0.6);
        return evaluation;
    }

    /**
     * Navigation call evaluator
     */
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

    /**
     * Sequence analysis call evaluator
     */
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

    /**
     * Search function call evaluator
     */
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

    /**
     * Workflow call evaluator for multi-step tasks
     */
    async evaluateWorkflowCall(actualResult, expectedResult, testResult) {
        const evaluation = {
            success: false,
            score: 0,
            maxScore: testResult.maxScore || 100,
            errors: [],
            warnings: []
        };

        if (!actualResult) {
            evaluation.errors.push('No result obtained from workflow execution');
            return evaluation;
        }

        // For workflows, we expect multiple tool calls
        if (Array.isArray(actualResult) && actualResult.length > 1) {
            evaluation.score += Math.floor(evaluation.maxScore * 0.4); // 40% for multi-step execution
            
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
                    const toolScore = Math.floor(evaluation.maxScore * 0.6 * (toolMatches / expectedTools.length));
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

        evaluation.success = evaluation.score >= Math.floor(evaluation.maxScore * 0.6);
        return evaluation;
    }

    async setup(context) {
        console.log('Setting up Comprehensive Genomic Analysis test suite');
    }

    async cleanup(context) {
        console.log('Cleaning up Comprehensive Genomic Analysis test suite');
    }
}

// Make the class available globally
window.ComprehensiveBenchmarkSuite = ComprehensiveBenchmarkSuite;