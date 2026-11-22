/**
 * Manual Complex Benchmark Suite - Manual evaluation + Complex complexity tests
 * Extracted from ComprehensiveBenchmarkSuite.js for better organization
 */
class ManualComplexSuite extends BenchmarkEvaluatorBase {
  constructor() {
    super();
    this.suiteName = 'Manual Complex Tests'; // Count will be added dynamically
    this.suiteId = 'manual_complex';
    this.description = 'Complex tests with manual evaluation - Advanced genomic workflows requiring human verification';
    this.framework = null;
    this.tests = this.numberTests(this.initializeTests());
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
        instruction:
          'Set up a complete genomic analysis environment by loading genome file, gene annotations, variant data (VCF), and expression tracks (WIG) in the optimal order for integrated analysis.',
        expectedResult: {
          tool_sequence: ['load_genome_file', 'load_annotation_file', 'load_variant_file', 'load_wig_tracks'],
          parameters: [{}, {}, {}, {}],
        },
        maxScore: 10,
        bonusScore: 2,
        timeout: 60000,
        evaluator: this.evaluateWorkflowCall.bind(this),
        manualVerification:
          'Please verify: 1) All four data types load successfully, 2) Loading order is optimal for integration, 3) Data layers are properly aligned, 4) Cross-references between layers work, 5) Integrated view is functional, 6) Performance remains acceptable.',
      },
      {
        id: 'load_manual_06',
        name: 'Multi-track Comparative Setup',
        type: 'workflow',
        category: 'data_loading',
        complexity: 'complex',
        evaluation: 'manual',
        instruction:
          'Create a multi-track comparative analysis setup by loading reference genome, sample reads, and variant calls, then configure tracks for mutation impact visualization.',
        expectedResult: {
          tool_sequence: ['load_genome_file', 'load_reads_file', 'load_variant_file'],
          parameters: [{}, {}, {}],
        },
        maxScore: 10,
        bonusScore: 2,
        timeout: 60000,
        evaluator: this.evaluateWorkflowCall.bind(this),
        manualVerification:
          'Please verify: 1) Reference genome loads first, 2) Sample reads align properly, 3) Variant calls integrate correctly, 4) Track layering is logical, 5) Mutation impacts are visualizable, 6) Comparative analysis is enabled.',
      },

      // SEARCH TASKS - Manual + Complex
      {
        id: 'search_manual_02',
        name: 'Amino Acid Biosynthesis Distribution',
        type: 'workflow',
        category: 'search',
        complexity: 'complex',
        evaluation: 'manual',
        instruction:
          "Search for all genes involved in 'amino acid biosynthesis' and create a chromosomal distribution map showing their locations and functional clustering.",
        expectedResult: {
          tool_sequence: ['search_features', 'navigate_to_position'],
          parameters: [
            { query: 'amino acid biosynthesis', case_sensitive: this.schemaDefault(false) },
            { start: '<hit_start>', end: '<hit_end>' },
          ],
        },
        maxScore: 10,
        bonusScore: 2,
        timeout: 60000,
        evaluator: this.evaluateWorkflowCall.bind(this),
        manualVerification:
          'Please verify: 1) Comprehensive gene identification for amino acid biosynthesis, 2) Chromosomal positions are mapped, 3) Distribution patterns are visualized, 4) Functional clustering is identified, 5) Results enable pathway analysis.',
      },
      {
        id: 'search_manual_03',
        name: 'ara Genes Clustering Analysis',
        type: 'workflow',
        category: 'search',
        complexity: 'complex',
        evaluation: 'manual',
        instruction:
          "Use feature search to find CDS records matching 'ara' and describe how the returned hits are distributed along the chromosome.",
        expectedResult: {
          tool_sequence: ['search_features'],
          parameters: [{ query: 'ara', feature_type: 'CDS' }],
        },
        maxScore: 10,
        bonusScore: 2,
        timeout: 60000,
        evaluator: this.evaluateWorkflowCall.bind(this),
        manualVerification:
          'Please verify: 1) The answer summarizes the genomic distribution using coordinates from the returned CDS hits.',
      },

      // ANALYSIS TASKS - Manual + Complex
      {
        id: 'anal_manual_02',
        name: 'araA Comprehensive Codon Analysis',
        type: 'function_call',
        category: 'analysis',
        complexity: 'complex',
        evaluation: 'manual',
        instruction: 'Report detailed codon counts and frequencies for araA using its annotated genetic code.',
        expectedResult: {
          tool_name: 'codon_usage_analysis',
          parameters: {
            geneName: 'araA',
            include_statistics: this.schemaDefault(true),
          },
        },
        maxScore: 10,
        bonusScore: 2,
        timeout: 60000,
        evaluator: this.evaluateBasicFunctionCall.bind(this),
        manualVerification:
          'Please verify: 1) The result identifies araA and the code table used, and includes the observed codon counts and frequencies.',
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
          tool_sequence: ['find_gene_by_name', 'get_sequence', 'compute_gc'],
          parameters: [
            { name: 'thrC', exact_match: true },
            {
              chromosome: '<gene_chromosome>',
              start: '<upstream_start>',
              end: '<upstream_end>',
              strand: '<gene_strand>',
            },
            { sequence: '<retrieved_sequence>' },
          ],
        },
        maxScore: 10,
        bonusScore: 2,
        timeout: 60000,
        evaluator: this.evaluateWorkflowCall.bind(this),
        manualVerification:
          'Please verify: 1) The 500-base interval is calculated from the gene coordinates and strand, 2) GC content analysis is performed, 3) Results show detailed composition analysis, 4) Analysis provides meaningful insights about sequence characteristics.',
      },

      // EXTERNAL DATABASE TASKS - Manual + Complex
      {
        id: 'ext_manual_01',
        name: 'Comprehensive Protein Analysis for araA',
        type: 'workflow',
        category: 'external_database',
        complexity: 'complex',
        evaluation: 'manual',
        instruction:
          'Perform comprehensive protein analysis for the E. coli araA gene: retrieve UniProt annotation and AlphaFold structure prediction, then integrate results for functional characterization.',
        expectedResult: {
          tool_sequence: ['get_uniprot_entry', 'search_alphafold_structures'],
          parameters: [
            { geneName: 'araA', organism: 'Escherichia coli' },
            { geneName: 'araA', organism: this.schemaDefault('Escherichia coli') },
          ],
        },
        maxScore: 10,
        bonusScore: 2,
        timeout: 30000,
        earlyReturn: true,
        evaluator: this.evaluateWorkflowCall.bind(this),
        manualVerification:
          'Please verify: 1) get_uniprot_entry and search_alphafold_structures tool calls are issued, 2) Both tasks are submitted successfully (do not wait for completion as online search time is variable).',
      },

      // ANNOTATION WORKFLOW TASKS - Manual + Complex
      {
        id: 'annot_manual_01',
        name: 'Create and Search Annotation Workflow',
        type: 'workflow',
        category: 'annotation',
        complexity: 'complex',
        evaluation: 'manual',
        instruction:
          'Create a gene annotation named "test_workflow_gene" at position 700000 to 703000, then search for that name to verify it was created.',
        expectedResult: {
          tool_sequence: ['create_annotation', 'search_annotations'],
          parameters: [
            {
              chromosome: '<current_chromosome>',
              start: 700000,
              end: 703000,
              name: 'test_workflow_gene',
              type: 'gene',
            },
            { query: 'test_workflow_gene', type: 'gene' },
          ],
        },
        maxScore: 10,
        bonusScore: 2,
        timeout: 60000,
        evaluator: this.evaluateWorkflowCall.bind(this),
        manualVerification:
          'Please verify: 1) Annotation is created at correct position, 2) Search results include the new annotation, 3) Workflow executes in correct order.',
      },

      // TRACK SETTINGS WORKFLOW - Manual + Complex
      {
        id: 'track_manual_01',
        name: 'Configure and Reset Track Settings',
        type: 'workflow',
        category: 'track_settings',
        complexity: 'complex',
        evaluation: 'manual',
        instruction:
          'Get the genes track settings, set its height to 80 pixels, then reset that track to its defaults.',
        expectedResult: {
          tool_sequence: ['get_track_settings', 'set_track_settings', 'reset_track_settings'],
          parameters: [
            { track_type: 'genes' },
            { track_type: 'genes', settings: { height: 80 } },
            { track_type: 'genes' },
          ],
        },
        maxScore: 10,
        bonusScore: 2,
        timeout: 60000,
        evaluator: this.evaluateWorkflowCall.bind(this),
        manualVerification:
          'Please verify: 1) Track settings are retrieved, 2) Annotation track height changes to 80px, 3) Settings reset to defaults correctly.',
      },

      // PRIMER DESIGN WORKFLOW - Manual + Complex
      {
        id: 'primer_manual_01',
        name: 'Design and Annotate Primers',
        type: 'workflow',
        category: 'primer_design',
        complexity: 'complex',
        evaluation: 'manual',
        instruction:
          'Design PCR primers for the lacZ gene, calculate the properties of the forward primer, then save the primer to the primer library.',
        expectedResult: {
          tool_sequence: ['design_primers', 'calculate_primer_properties', 'save_primer'],
          parameters: [
            { geneName: 'lacZ' },
            { sequence: '<forward_primer_sequence>' },
            {
              sequence: '<forward_primer_sequence>',
              name: '<primer_name>',
              chromosome: '<primer_chromosome>',
              start: '<forward_primer_start>',
              end: '<forward_primer_end>',
            },
          ],
        },
        maxScore: 10,
        bonusScore: 2,
        timeout: 30000,
        earlyReturn: true,
        evaluator: this.evaluateWorkflowCall.bind(this),
        manualVerification:
          'Please verify: 1) design_primers is called for lacZ, 2) calculate_primer_properties is called, 3) save_primer is called, 4) All tasks are submitted successfully (do not wait for completion).',
      },

      // BLAST WORKFLOW - Manual + Complex
      {
        id: 'blast_manual_01',
        name: 'BLAST Create DB and Search',
        type: 'workflow',
        category: 'blast',
        complexity: 'complex',
        evaluation: 'manual',
        instruction:
          'Create a BLAST database from the current genome, then perform a local blastn search with sequence ATGAAAGCGCTGAAAGCGCTG against it.',
        expectedResult: {
          tool_sequence: ['blast_create_quick_db_for_current_genome', 'blast_search_local'],
          parameters: [{}, { sequence: 'ATGAAAGCGCTGAAAGCGCTG', blastType: 'blastn', database: '<created_database>' }],
        },
        maxScore: 10,
        bonusScore: 2,
        timeout: 30000,
        earlyReturn: true,
        evaluator: this.evaluateWorkflowCall.bind(this),
        manualVerification:
          'Please verify: 1) blast_create_quick_db_for_current_genome is called, 2) blast_search_local is called with correct sequence, 3) Both tasks are submitted successfully (do not wait for completion).',
      },

      // RESTRICTION ANALYSIS WORKFLOW - Manual + Complex
      {
        id: 'restrict_manual_01',
        name: 'Find Sites and Virtual Digest',
        type: 'workflow',
        category: 'restriction',
        complexity: 'complex',
        evaluation: 'manual',
        instruction:
          'Find EcoRI sites in the current region, then perform a virtual digest with EcoRI and BamHI enzymes.',
        expectedResult: {
          tool_sequence: ['find_restriction_sites', 'virtual_digest'],
          parameters: [{ enzyme: 'EcoRI' }, { enzymes: ['EcoRI', 'BamHI'] }],
        },
        maxScore: 10,
        bonusScore: 2,
        timeout: 60000,
        evaluator: this.evaluateWorkflowCall.bind(this),
        manualVerification:
          'Please verify: 1) Restriction sites are found, 2) Virtual digest shows fragment sizes, 3) Both analyses use the same genomic context.',
      },

      // PROTEIN ANALYSIS WORKFLOW - Manual + Complex
      {
        id: 'protein_manual_01',
        name: 'Comprehensive Protein Analysis',
        type: 'workflow',
        category: 'protein_structure',
        complexity: 'complex',
        evaluation: 'manual',
        instruction:
          'Search UniProt for lacZ protein from E. coli, fetch its AlphaFold structure, then analyze its InterPro domains.',
        expectedResult: {
          tool_sequence: ['search_uniprot_database', 'fetch_alphafold_structure', 'analyze_interpro_domains'],
          parameters: [
            { query: 'lacZ', organism: 'Escherichia coli' },
            { uniprotId: '<lacZ_uniprot_id>' },
            { geneName: 'lacZ', organism: 'Escherichia coli' },
          ],
        },
        maxScore: 10,
        bonusScore: 2,
        timeout: 90000,
        evaluator: this.evaluateWorkflowCall.bind(this),
        manualVerification:
          'Please verify: 1) UniProt search returns lacZ results, 2) AlphaFold structure is fetched, 3) InterPro domains are analyzed, 4) All steps form a coherent analysis.',
      },

      // WORKFLOW INTEGRATION TASKS - Manual + Complex
      {
        id: 'workflow_manual_01',
        name: 'Comparative Genomics Analysis',
        type: 'workflow',
        category: 'workflow',
        complexity: 'complex',
        evaluation: 'manual',
        instruction:
          'Load the two bacterial genome files supplied by the operator. For each genome, report detailed codon usage for lacZ using its annotated genetic code, then compare the observed counts and frequencies.',
        expectedResult: {
          tool_sequence: ['load_genome_file', 'codon_usage_analysis', 'load_genome_file', 'codon_usage_analysis'],
          parameters: [
            { filePath: '<first_genome_path>' },
            { geneName: 'lacZ', include_statistics: this.schemaDefault(true) },
            { filePath: '<second_genome_path>' },
            { geneName: 'lacZ', include_statistics: this.schemaDefault(true) },
          ],
        },
        maxScore: 15,
        bonusScore: 3,
        timeout: 90000,
        evaluator: this.evaluateWorkflowCall.bind(this),
        manualVerification:
          'Please verify: Each analysis uses the genome just loaded. Verify that the comparison cites the observed counts or frequencies from both results.',
      },
      {
        id: 'workflow_manual_02',
        name: 'Genome Analysis Workflow',
        type: 'workflow',
        category: 'workflow',
        complexity: 'complex',
        evaluation: 'manual',
        instruction:
          'Load the genome and annotation files, read positions 1 through 10,000 on the current chromosome, and report GC content.',
        expectedResult: {
          tool_sequence: ['load_genome_file', 'load_annotation_file', 'get_sequence', 'compute_gc'],
          parameters: [
            { showFileDialog: true },
            {},
            { chromosome: '<current_chromosome>', start: 1, end: 10000 },
            { sequence: '<retrieved_sequence>' },
          ],
        },
        maxScore: 15,
        bonusScore: 3,
        timeout: 90000,
        evaluator: this.evaluateWorkflowCall.bind(this),
        manualVerification:
          'Please verify: 1) Genome and annotations load successfully, 2) Sequence analysis is comprehensive, 3) The reported GC content is based on the retrieved sequence, 4) Workflow is efficient and logical, 5) Results meet analysis objectives.',
      },
    ];
  }

  /**
   * Evaluator methods - delegates to BenchmarkEvaluatorBase for unified logic.
   * Fix Problem 4: Single source of truth for evaluation.
   */
  async evaluateBasicFunctionCall(actualResult, expectedResult, testResult) {
    // Delegate to the base class with ManualComplex-specific options:
    // - maxParamDeduction: 2 (complex allows more deduction)
    // - successThreshold: 0.6 (60% for manual complex tests)
    // - defaultMaxScore: 10
    return super.evaluateBasicFunctionCall(actualResult, expectedResult, testResult, {
      defaultMaxScore: 10,
      successThreshold: 0.6,
      maxParamDeduction: 2,
    });
  }

  async evaluateWorkflowCall(actualResult, expectedResult, testResult) {
    const evaluation = {
      success: false,
      score: 0,
      maxScore: testResult.maxScore || 10, // Use test's actual maxScore, default to 10 for complex
      errors: [],
      warnings: [],
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
      const singleStepEval = await this.evaluateBasicFunctionCall(
        actualResult,
        {
          tool_name: expectedResult.tool_sequence?.[0] || expectedResult.tool_name,
          parameters: expectedResult.parameters?.[0] || expectedResult.parameters,
        },
        testResult
      );
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
