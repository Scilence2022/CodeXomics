/* global BenchmarkEvaluatorBase */
/**
 * Automatic Complex Benchmark Suite - Automatic evaluation + Complex complexity tests
 * Extracted from ComprehensiveBenchmarkSuite.js for better organization
 */
class AutomaticComplexSuite extends BenchmarkEvaluatorBase {
  constructor() {
    super();
    this.suiteName = 'Automatic Complex Tests'; // Count will be added dynamically
    this.suiteId = 'automatic_complex';
    this.description = 'Complex tests with automatic evaluation - Advanced genomic analysis operations';
    this.framework = null;
    this.defaultDirectory = null; // Will be set when framework provides configuration
    this.toolSuccessPatterns = {
      // File Loading
      load_genome_file: [/load.*genome/i, /genome.*loaded/i, /opened.*gbk/i, /loaded.*gbk/i],
      load_reads_file: [/load.*reads/i, /reads.*loaded/i, /opened.*bam/i, /loaded.*bam/i],
      load_variant_file: [/load.*variant/i, /variant.*loaded/i, /opened.*vcf/i, /loaded.*vcf/i],
      load_wig_tracks: [/load.*wig/i, /wig.*loaded/i, /opened.*wig/i, /loaded.*wig/i],

      // File Export
      export_fasta_sequence: [/export.*fasta/i, /fasta.*exported/i],
      export_genbank_format: [/export.*genbank/i, /genbank.*exported/i, /gbk.*exported/i],
      export_gff_annotations: [/export.*gff/i, /gff.*exported/i],
      export_bed_format: [/export.*bed/i, /bed.*exported/i, /bed.*saved/i, /bed.*created/i],
      export_cds_fasta: [/export.*cds/i, /cds.*exported/i],
      export_protein_fasta: [/export.*protein/i, /protein.*exported/i],
      export_current_view_fasta: [/export.*view/i, /view.*exported/i, /region.*exported/i],

      // UI Interaction
      open_new_tab: [/open.*tab/i, /new.*tab/i, /tab.*opened/i],
      close_tab: [/close.*tab/i, /tab.*closed/i],
      switch_to_tab: [/switch.*tab/i, /tab.*switched/i],

      // Track Controls
      get_track_status: [/track status/i, /visibility status/i, /tracks.*status/i],
      toggle_track: [/toggle.*track/i, /track.*toggled/i, /display.*track/i, /hide.*track/i],

      // BLAST
      blast_create_database: [/blast.*database/i, /database.*created/i, /ecoli_db/i],
      blast_list_databases: [/list.*databases/i, /available.*databases/i],
      blast_search_online: [/online blast/i, /blastn/i, /ncbi blast/i],
      blast_search_local: [/local blast/i, /blast.*local/i],

      // Primer Design
      design_primers: [/design primers/i, /primer design/i, /pcr primers/i],
      calculate_primer_properties: [/primer properties/i, /melting temperature/i, /tm/i],
      find_primer_binding_sites: [/binding sites/i, /primer binding/i, /mismatch tolerance/i],
      add_primer_annotation: [/add.*primer/i, /primer.*annotation/i, /primer.*added/i],
      list_primer_annotations: [/list.*primer/i, /primer.*listed/i, /primer annotations/i],
      clear_primer_annotations: [/clear.*primer/i, /primer.*cleared/i, /remove.*primer/i],

      // Protein & Structure
      get_uniprot_entry: [/uniprot entry/i, /p04637/i, /p53/i],
      fetch_alphafold_structure: [/alphafold/i, /download.*structure/i, /3d structure/i],
      open_protein_viewer: [/open.*protein/i, /protein viewer/i, /3d protein viewer/i],
      search_uniprot_database: [/search.*uniprot/i, /uniprot.*search/i, /find.*uniprot/i, /uniprot.*results/i],
      analyze_interpro_domains: [/analyze.*interpro/i, /interpro.*domains/i, /domain.*annotations/i],
      search_pdb_structures: [/search.*pdb/i, /pdb.*structures/i, /find.*pdb/i, /pdb.*results/i],

      // Sequence Analysis
      calc_region_gc: [/gc content/i, /region gc/i, /percentage of g-c/i],
      calculate_entropy: [/entropy/i, /sequence entropy/i],
      translate_dna: [/translate.*dna/i, /translated/i, /protein sequence/i],
      calculate_molecular_weight: [/molecular weight/i, /mw/i, /weight/i],
      genome_codon_usage_analysis: [/codon usage/i, /codon frequency/i],
      compute_gc: [/genome gc/i, /overall gc/i, /gc content/i],
      get_sequence: [/current visible dna/i, /visible sequence/i, /get.*sequence/i],
      find_restriction_sites: [/restriction sites/i, /sites/i, /ecori sites/i],
      virtual_digest: [/virtual digest/i, /digest fragments/i, /digest.*completed/i],
      simulate_gel_electrophoresis: [/gel electrophoresis/i, /agarose gel/i, /simulate gel/i, /ladder/i],
      get_coding_sequence: [/coding sequence/i, /cds/i, /retrieve.*cds/i],
      reverse_complement: [/reverse complement/i, /revcomp/i],

      // Annotations
      create_annotation: [/annotation.*created/i, /created.*annotation/i, /new.*annotation/i, /regulatory_region_a/i],
      update_annotation: [/annotation.*updated/i, /updated.*annotation/i, /description.*updated/i],
      list_annotations: [/list.*annotations/i, /annotations.*listed/i, /show.*annotations/i],
    };
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
      console.log(`📁 AutomaticComplexSuite default directory set to: ${this.defaultDirectory}`);

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
    return './';
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
   * Clean up target export files before tests to prevent false positives
   * 在测试开始前检测并删除目标导出文件，避免判断错误
   */
  async cleanupExportFiles() {
    const exportedFilesDir = this.buildFilePath('exported_files');

    console.log(' [AutomaticComplexSuite] Starting export file cleanup...');
    console.log(` [AutomaticComplexSuite] Checking directory: ${exportedFilesDir}`);

    console.info(
      'ℹ️ [AutomaticComplexSuite] Export cleanup skipped in hardened renderer; filesystem access is main-process only.'
    );
  }

  /**
   * Keep state-sensitive tests late and data/context setup early.
   */
  getPreferredTestOrder() {
    return [
      'file_auto_01',
      'nav_auto_01',
      'analysis_auto_01',
      'analysis_auto_02',
      'analysis_auto_complex_03',
      'analysis_auto_complex_05',
      'restrict_auto_01',
      'gel_auto_01',
      'gel_auto_03',
      'gel_auto_workflow_02',
      'annotation_auto_complex_01',
      'track_auto_complex_01',
      'primer_auto_01',
      'primer_auto_complex_01',
      'primer_auto_complex_02',
      'export_auto_complex_01',
      'export_auto_complex_02',
      'ui_auto_01',
      'ui_auto_complex_02',
      'protein_auto_complex_01',
      'protein_auto_complex_02',
      'blast_auto_complex_01',
      'blast_auto_complex_02',
    ];
  }

  orderTestsForStableExecution(tests) {
    const preferredOrder = new Map(this.getPreferredTestOrder().map((id, index) => [id, index]));
    return [...tests].sort((a, b) => {
      const aOrder = preferredOrder.has(a.id) ? preferredOrder.get(a.id) : Number.MAX_SAFE_INTEGER;
      const bOrder = preferredOrder.has(b.id) ? preferredOrder.get(b.id) : Number.MAX_SAFE_INTEGER;
      return aOrder - bOrder;
    });
  }

  /**
   * Initialize automatic complex test cases
   */
  initializeTests() {
    const tests = [
      // FILE LOADING WORKFLOW - Automatic + Complex
      {
        id: 'file_auto_01',
        name: 'Complete Genomic Data Loading Workflow',
        type: 'workflow',
        category: 'file_loading',
        complexity: 'complex',
        evaluation: 'automatic',
        instruction: `Load genome file "${this.buildFilePath('ECOLI.gbk')}"; Load aligned read file "${this.buildFilePath('1655_C10.sorted.bam')}"; Load variant VCF "${this.buildFilePath('1655_C10.mutations.vcf')}"; Load WIG files "${this.buildFilePath('sample.wig')}", "${this.buildFilePath('another_sample.wig')}"`,
        expectedResult: {
          tool_sequence: ['load_genome_file', 'load_reads_file', 'load_variant_file', 'load_wig_tracks'],
          parameters: [
            {
              filePath: this.buildFilePath('ECOLI.gbk'),
            },
            {
              filePath: this.buildFilePath('1655_C10.sorted.bam'),
            },
            {
              filePath: this.buildFilePath('1655_C10.mutations.vcf'),
            },
            {
              filePaths: [this.buildFilePath('sample.wig'), this.buildFilePath('another_sample.wig')],
            },
          ],
        },
        maxScore: 15,
        bonusScore: 3,
        timeout: 120000,
        evaluator: this.evaluateFileLoadingWorkflow.bind(this),
      },

      // NAVIGATION TASKS - Automatic + Complex
      {
        id: 'nav_auto_01',
        name: 'Navigate and Zoom Complex Analysis',
        type: 'workflow',
        category: 'navigation',
        complexity: 'complex',
        evaluation: 'automatic',
        instruction: 'Navigate to region 1230000 to 1300000 and then zoom in 10x to see the features.',
        expectedResult: {
          tool_sequence: ['navigate_to_position', 'zoom_in'],
          parameters: [
            {
              chromosome: '<current_chromosome>',
              start: 1230000,
              end: 1300000,
            },
            {
              factor: 10,
            },
          ],
        },
        maxScore: 10,
        bonusScore: 2,
        timeout: 60000,
        evaluator: this.evaluateWorkflowCall.bind(this),
      },

      // DATA EXPORT WORKFLOW - Automatic + Complex
      {
        id: 'export_auto_complex_01',
        name: 'Complete Data Export Workflow',
        type: 'workflow',
        category: 'file_export',
        complexity: 'complex',
        evaluation: 'automatic',
        instruction: `Please perform the following tasks in order: 1) Export sequences in FASTA format to file: ${this.buildFilePath('exported_files/exported_sequences.fasta')}; 2) Export data in GenBank format to file: ${this.buildFilePath('exported_files/exported_data.gbk')}; 3) Export GFF3 annotation format to file: ${this.buildFilePath('exported_files/exported_annotations.gff3')}; 4) Export features in BED format to file: ${this.buildFilePath('exported_files/exported_features.bed')}; 5) Export coding sequences as FASTA format to file: ${this.buildFilePath('exported_files/exported_cds.fasta')}; 6) Export protein sequences in FASTA format to file: ${this.buildFilePath('exported_files/exported_proteins.fasta')}; `,
        expectedResult: {
          tool_sequence: [
            'export_fasta_sequence',
            'export_genbank_format',
            'export_gff_annotations',
            'export_bed_format',
            'export_cds_fasta',
            'export_protein_fasta',
          ],
          parameters: [
            {
              format: 'fasta',
              includeDescription: true,
              filePath: this.buildFilePath('exported_files/exported_sequences.fasta'),
            },
            {
              includeSequence: true,
              includeAnnotations: true,
              filePath: this.buildFilePath('exported_files/exported_data.gbk'),
            },
            {
              version: 'gff3',
              includeSequence: false,
              filePath: this.buildFilePath('exported_files/exported_annotations.gff3'),
            },
            {
              trackName: 'exported_features',
              includeScore: true,
              filePath: this.buildFilePath('exported_files/exported_features.bed'),
            },
            {
              sequenceType: 'cds',
              includeHeaders: true,
              filePath: this.buildFilePath('exported_files/exported_cds.fasta'),
            },
            {
              sequenceType: 'protein',
              includeHeaders: true,
              translate: true,
              filePath: this.buildFilePath('exported_files/exported_proteins.fasta'),
            },
          ],
          expectedFiles: [
            'exported_files/exported_sequences.fasta',
            'exported_files/exported_data.gbk',
            'exported_files/exported_annotations.gff3',
            'exported_files/exported_features.bed',
            'exported_files/exported_cds.fasta',
            'exported_files/exported_proteins.fasta',
          ],
        },
        maxScore: 20,
        bonusScore: 5,
        timeout: 180000,
        evaluator: this.evaluateDataExportWorkflow.bind(this),
      },

      {
        id: 'export_auto_complex_02',
        name: 'Current View Navigation and FASTA Export',
        type: 'workflow',
        category: 'file_export',
        complexity: 'complex',
        evaluation: 'automatic',
        instruction: `Navigate to region 100000 to 120000, then export the current visible view as FASTA to file: ${this.buildFilePath('exported_files/current_view_region.fasta')} with coordinates included.`,
        expectedResult: {
          tool_sequence: ['navigate_to_position', 'export_current_view_fasta'],
          parameters: [
            {
              chromosome: '<current_chromosome>',
              start: 100000,
              end: 120000,
            },
            {
              filePath: this.buildFilePath('exported_files/current_view_region.fasta'),
              includeCoordinates: true,
            },
          ],
        },
        maxScore: 12,
        bonusScore: 2,
        timeout: 90000,
        evaluator: this.evaluateWorkflowCall.bind(this),
      },

      // UI INTERACTION TASKS - Automatic + Complex
      {
        id: 'ui_auto_01',
        name: 'Open Five New Tabs',
        type: 'function_call',
        category: 'ui_interaction',
        complexity: 'complex',
        evaluation: 'automatic',
        instruction: 'Open Five new tabs.',
        expectedResult: {
          tool_name: 'open_new_tab',
          parameters: {},
          expectedTabsIncrease: 5, // Expected increase in tab count
        },
        maxScore: 5,
        bonusScore: 0,
        timeout: 60000,
        evaluator: this.evaluateMultipleTabOpeningCall.bind(this),
      },

      {
        id: 'ui_auto_complex_02',
        name: 'Tab Lifecycle Workflow',
        type: 'workflow',
        category: 'ui_interaction',
        complexity: 'complex',
        evaluation: 'automatic',
        instruction:
          'Open a new tab, switch to the newly opened tab, then close that tab to return to the original analysis context.',
        expectedResult: {
          tool_sequence: ['open_new_tab', 'switch_to_tab', 'close_tab'],
          parameters: [
            {},
            {
              tabIndex: '<new_tab_index>',
            },
            {},
          ],
        },
        maxScore: 10,
        bonusScore: 2,
        timeout: 90000,
        evaluator: this.evaluateWorkflowCall.bind(this),
      },

      // SEQUENCE ANALYSIS WORKFLOWS - Automatic + Complex
      {
        id: 'analysis_auto_01',
        name: 'GC Content and Export',
        type: 'workflow',
        category: 'sequence_analysis',
        complexity: 'complex',
        evaluation: 'automatic',
        instruction: `Calculate the GC content for the current view region and then export the region features to a BED file named '${this.buildFilePath('exported_files/region_features.bed')}'.`,
        expectedResult: {
          tool_sequence: ['calc_region_gc', 'export_bed_format'],
          parameters: [{}, { filePath: this.buildFilePath('exported_files/region_features.bed') }],
        },
        maxScore: 10,
        bonusScore: 2,
        timeout: 60000,
        evaluator: this.evaluateWorkflowCall.bind(this),
      },

      {
        id: 'analysis_auto_02',
        name: 'Genome Statistics Suite',
        type: 'workflow',
        category: 'sequence_analysis',
        complexity: 'complex',
        evaluation: 'automatic',
        instruction:
          'Retrieve the current genome information, perform genome-wide codon usage analysis, and calculate the GC content of the region currently being viewed.',
        expectedResult: {
          tool_sequence: ['get_genome_info', 'genome_codon_usage_analysis', 'calc_region_gc'],
          parameters: [{}, {}, {}],
        },
        maxScore: 15,
        bonusScore: 3,
        timeout: 90000,
        evaluator: this.evaluateWorkflowCall.bind(this),
      },

      {
        id: 'analysis_auto_complex_03',
        name: 'Coding Sequence Translation Workflow',
        type: 'workflow',
        category: 'sequence_analysis',
        complexity: 'complex',
        evaluation: 'automatic',
        instruction:
          'Retrieve the coding sequence for the lacZ gene, translate that coding sequence in reading frame 1, and calculate the molecular weight of the translated protein sequence.',
        expectedResult: {
          tool_sequence: ['get_coding_sequence', 'calculate_molecular_weight'],
          parameters: [
            {
              geneName: 'lacZ',
            },
            {
              sequence: '<protein_sequence>',
              type: 'protein',
            },
          ],
        },
        maxScore: 15,
        bonusScore: 3,
        timeout: 90000,
        evaluator: this.evaluateWorkflowCall.bind(this),
      },

      {
        id: 'analysis_auto_complex_05',
        name: 'Sequence Composition and Strand Workflow',
        type: 'workflow',
        category: 'sequence_analysis',
        complexity: 'complex',
        evaluation: 'automatic',
        instruction:
          'Get the current visible DNA sequence, calculate its entropy, compute its reverse complement, and translate the same DNA sequence in reading frame 1.',
        expectedResult: {
          tool_sequence: ['get_sequence', 'calculate_entropy', 'reverse_complement', 'translate_dna'],
          parameters: [
            {},
            {
              sequence: '<visible_sequence>',
            },
            {
              sequence: '<visible_sequence>',
            },
            {
              dna: '<visible_sequence>',
              readingFrame: 1,
            },
          ],
        },
        maxScore: 20,
        bonusScore: 4,
        timeout: 90000,
        evaluator: this.evaluateWorkflowCall.bind(this),
      },

      {
        id: 'primer_auto_01',
        name: 'Design Primers',
        type: 'function_call',
        category: 'primer_design',
        complexity: 'simple',
        evaluation: 'automatic',
        instruction: 'Design PCR primers for the lacZ gene with default parameters.',
        expectedResult: {
          tool_name: 'design_primers',
          parameters: {
            geneName: 'lacZ',
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 20000,
        earlyReturn: true,
        evaluator: this.evaluateBasicFunctionCall.bind(this),
      },

      {
        id: 'restrict_auto_01',
        name: 'Virtual Digest',
        type: 'function_call',
        category: 'restriction',
        complexity: 'simple',
        evaluation: 'automatic',
        instruction:
          'Perform a virtual restriction digest with EcoRI and HindIII enzymes of genome sequence in current view.',
        expectedResult: {
          tool_name: 'virtual_digest',
          parameters: {
            enzymes: ['EcoRI', 'HindIII'],
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 30000,
        evaluator: this.evaluateBasicFunctionCall.bind(this),
      },

      {
        id: 'gel_auto_01',
        name: 'Simulate Gel Electrophoresis',
        type: 'function_call',
        category: 'restriction',
        complexity: 'simple',
        evaluation: 'automatic',
        instruction:
          'Run virtual_digest of current viewing region with EcoRI and HindIII, then simulate agarose gel electrophoresis to visualize the digest fragments on a 1% gel with 1kb ladder.',
        expectedResult: {
          tool_name: 'simulate_gel_electrophoresis',
          parameters: {
            fragments: '<any>',
            gelPercentage: 1.0,
            ladderType: '1kb',
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 45000,
        evaluator: this.evaluateBasicFunctionCall.bind(this),
      },

      {
        id: 'gel_auto_03',
        name: 'Gel with Lambda Ladder and EtBr Stain',
        type: 'function_call',
        category: 'restriction',
        complexity: 'simple',
        evaluation: 'automatic',
        instruction:
          'Perform a virtual digest of current viewing region with NotI and SalI, then run gel electrophoresis on a 0.8% agarose gel with lambda HindIII ladder and ethidium bromide stain.',
        expectedResult: {
          tool_name: 'simulate_gel_electrophoresis',
          parameters: {
            fragments: '<any>',
            gelPercentage: 0.8,
            ladderType: 'lambda_hindiii',
            bandColorScheme: 'ethidium_bromide',
          },
        },
        maxScore: 5,
        bonusScore: 2,
        timeout: 45000,
        evaluator: this.evaluateBasicFunctionCall.bind(this),
      },

      {
        id: 'gel_auto_workflow_02',
        name: 'Complete Restriction Analysis and Gel Visualization',
        type: 'workflow',
        category: 'restriction',
        complexity: 'complex',
        evaluation: 'automatic',
        instruction:
          'Find EcoRI restriction sites in the current region, perform a virtual digest with EcoRI and HindIII, then run gel electrophoresis to visualize the fragments with methylene blue stain.',
        expectedResult: {
          tool_sequence: ['find_restriction_sites', 'virtual_digest', 'simulate_gel_electrophoresis'],
          parameters: [
            { enzyme: 'EcoRI' },
            { enzymes: ['EcoRI', 'HindIII'] },
            { fragments: '<any>', bandColorScheme: 'methylene_blue' },
          ],
        },
        maxScore: 20,
        bonusScore: 5,
        timeout: 120000,
        evaluator: this.evaluateWorkflowCall.bind(this),
      },

      {
        id: 'annotation_auto_complex_01',
        name: 'Custom Annotation CRUD Workflow',
        type: 'workflow',
        category: 'annotations',
        complexity: 'complex',
        evaluation: 'automatic',
        instruction:
          "Create a new custom regulatory annotation named 'regulatory_region_A' on chromosome 'U00096' spanning start position 150000 to end position 150500, then update its description to 'Highly conserved regulatory region', and list all annotations in that region to verify.",
        expectedResult: {
          tool_sequence: ['create_annotation', 'update_annotation', 'list_annotations'],
          parameters: [
            {
              name: 'regulatory_region_A',
              chromosome: 'U00096',
              start: 150000,
              end: 150500,
              type: 'regulatory',
            },
            {
              identifier: 'regulatory_region_A',
              updates: {
                description: 'Highly conserved regulatory region',
              },
            },
            {
              chromosome: 'U00096',
              start: 150000,
              end: 150500,
            },
          ],
        },
        maxScore: 15,
        bonusScore: 3,
        timeout: 90000,
        evaluator: this.evaluateWorkflowCall.bind(this),
      },

      {
        id: 'track_auto_complex_01',
        name: 'Track Control and Status Check',
        type: 'workflow',
        category: 'track_control',
        complexity: 'complex',
        evaluation: 'automatic',
        instruction:
          'Check the current visibility status of all tracks, then display the GC content track, hide the variants track, and check the track status again to confirm the visibility changes.',
        expectedResult: {
          tool_sequence: ['get_track_status', 'toggle_track', 'toggle_track', 'get_track_status'],
          parameters: [
            {},
            {
              trackName: 'gc',
              action: 'show',
            },
            {
              trackName: 'Variants',
              action: 'hide',
            },
            {},
          ],
        },
        maxScore: 15,
        bonusScore: 3,
        timeout: 90000,
        evaluator: this.evaluateWorkflowCall.bind(this),
      },

      {
        id: 'protein_auto_complex_01',
        name: 'Protein Query and AlphaFold Structure Retrieval',
        type: 'workflow',
        category: 'protein_structure',
        complexity: 'complex',
        evaluation: 'automatic',
        instruction:
          "Retrieve the UniProt entry details for human protein p53 using accession ID 'P04637', download its AlphaFold 3D structure in PDB format with confidence scores, and then open the structure in the interactive 3D protein viewer using cartoon representation.",
        expectedResult: {
          tool_sequence: ['get_uniprot_entry', 'fetch_alphafold_structure', 'open_protein_viewer'],
          parameters: [
            {
              uniprot_id: 'P04637',
            },
            {
              uniprot_id: 'P04637',
              format: 'pdb',
            },
            {
              uniprot_id: 'P04637',
              representation: 'cartoon',
            },
          ],
        },
        maxScore: 15,
        bonusScore: 3,
        timeout: 90000,
        evaluator: this.evaluateWorkflowCall.bind(this),
      },

      {
        id: 'blast_auto_complex_01',
        name: 'Nucleotide BLAST Database Creation and Local Search',
        type: 'workflow',
        category: 'blast',
        complexity: 'complex',
        evaluation: 'automatic',
        instruction: `Create a new nucleotide BLAST database named 'ecoli_db' from input FASTA file '${this.buildFilePath('ECOLI.fasta')}', then list the available BLAST databases to verify, and run a local blastn search against the 'ecoli_db' database for the query sequence 'ATGCGATCGATC'.`,
        expectedResult: {
          tool_sequence: ['blast_create_database', 'blast_list_databases', 'blast_search_local'],
          parameters: [
            {
              inputFile: this.buildFilePath('ECOLI.fasta'),
              dbName: 'ecoli_db',
              dbType: 'nucleotide',
            },
            {},
            {
              sequence: 'ATGCGATCGATC',
              blastType: 'blastn',
              database: 'ecoli_db',
            },
          ],
        },
        maxScore: 15,
        bonusScore: 3,
        timeout: 90000,
        evaluator: this.evaluateWorkflowCall.bind(this),
      },

      {
        id: 'blast_auto_complex_02',
        name: 'Protein BLAST Database Creation and Local Search',
        type: 'workflow',
        category: 'blast',
        complexity: 'complex',
        evaluation: 'automatic',
        instruction: `Create a new protein BLAST database named 'ecoli_protein_db' from input FASTA file '${this.buildFilePath('exported_files/exported_proteins.fasta')}', then list the available BLAST databases to verify, and run a local blastp search against the 'ecoli_protein_db' database for the query sequence 'MKTAYIAKQRQISFVKSHFSRQLEERLGLIEVQ'.`,
        expectedResult: {
          tool_sequence: ['blast_create_database', 'blast_list_databases', 'blast_search_local'],
          parameters: [
            {
              inputFile: this.buildFilePath('exported_files/exported_proteins.fasta'),
              dbName: 'ecoli_protein_db',
              dbType: 'protein',
            },
            {},
            {
              sequence: 'MKTAYIAKQRQISFVKSHFSRQLEERLGLIEVQ',
              blastType: 'blastp',
              database: 'ecoli_protein_db',
            },
          ],
        },
        maxScore: 15,
        bonusScore: 3,
        timeout: 120000,
        evaluator: this.evaluateWorkflowCall.bind(this),
      },

      {
        id: 'primer_auto_complex_01',
        name: 'Primer Design, Property Calculation, and Binding Search',
        type: 'workflow',
        category: 'primer_design',
        complexity: 'complex',
        evaluation: 'automatic',
        instruction:
          "Design primers for the 'lacZ' gene, then calculate the properties (like melting temperature) of the designed primer sequence 'ATGACCATGATTACGGATTCACT', and search for its binding sites in the current genome with a mismatch tolerance of 2.",
        expectedResult: {
          tool_sequence: ['design_primers', 'calculate_primer_properties', 'find_primer_binding_sites'],
          parameters: [
            {
              geneName: 'lacZ',
            },
            {
              sequence: 'ATGACCATGATTACGGATTCACT',
            },
            {
              sequence: 'ATGACCATGATTACGGATTCACT',
              maxMismatches: 2,
            },
          ],
        },
        maxScore: 15,
        bonusScore: 3,
        timeout: 90000,
        evaluator: this.evaluateWorkflowCall.bind(this),
      },

      {
        id: 'primer_auto_complex_02',
        name: 'Primer Design with Upstream RBS Coverage',
        type: 'function_call',
        category: 'primer_design',
        complexity: 'moderate',
        evaluation: 'automatic',
        instruction: 'Design primers to amplify the lysC gene, including 50bp of upstream sequence to capture the RBS.',
        expectedResult: {
          tool_name: 'design_primers',
          parameters: {
            geneName: 'lysC',
            upstreamBp: 50,
          },
        },
        maxScore: 10,
        bonusScore: 2,
        timeout: 30000,
        earlyReturn: true,
        evaluator: this.evaluateBasicFunctionCall.bind(this),
      },

      {
        id: 'protein_auto_complex_02',
        name: 'Protein Domain & Structure Workflow',
        type: 'workflow',
        category: 'protein_analysis',
        complexity: 'complex',
        evaluation: 'automatic',
        instruction:
          'Search the UniProt database for the E.coli K12 protein DapA and verify whether the UniProt ID P0A6L2 is present. Then retrieve the representative sequence using that UniProt ID, perform an InterPro domain analysis to identify key domains, and search the PDB database to find structurally resolved DapA structures.',
        expectedResult: {
          tool_sequence: [
            'search_uniprot_database',
            'get_uniprot_entry',
            'analyze_interpro_domains',
            'search_pdb_structures',
          ],
          parameters: [
            {
              search_query: 'DapA',
              search_type: 'protein_name',
              organism: 'Escherichia coli K-12',
            },
            {
              search_query: 'BRCA1',
              organism: 'Homo sapiens',
              include_sequence: true,
            },
            {
              uniprotId: 'P38398',
            },
            {
              query: 'BRCA1',
            },
          ],
        },
        maxScore: 15,
        bonusScore: 3,
        timeout: 90000,
        evaluator: this.evaluateWorkflowCall.bind(this),
      },
    ];

    return this.orderTestsForStableExecution(tests);
  }

  /**
   * Parse natural language response from LLM to detect successful file loading
   */
  parseNaturalLanguageFileLoadingResponse(actualResult, evaluation) {
    let responseText = '';

    // Extract text from various response formats
    if (typeof actualResult === 'string') {
      responseText = actualResult;
    } else if (actualResult && actualResult.response) {
      responseText = actualResult.response;
    } else if (actualResult && actualResult.message) {
      responseText = actualResult.message;
    } else {
      responseText = JSON.stringify(actualResult);
    }

    console.log('📄 [FileLoadingWorkflow] Parsing response text:', responseText.substring(0, 500));

    const fileLoadingExpectedTools = {
      load_genome_file: ['ECOLI.gbk'],
      load_reads_file: ['1655_C10.sorted.bam'],
      load_variant_file: ['1655_C10.mutations.vcf'],
      load_wig_tracks: ['sample.wig', 'another_sample.wig'],
    };

    const { matched: trackerMatchedTools } = this.getRecentToolMatches(
      Object.keys(fileLoadingExpectedTools),
      BenchmarkEvaluatorBase.TIMEOUTS.DEFAULT
    );

    if (trackerMatchedTools.length > 0) {
      let trackerLoadedFiles = 0;
      const loadedFilesList = [];

      trackerMatchedTools.forEach(toolName => {
        const files = fileLoadingExpectedTools[toolName] || [];
        files.forEach(file => {
          loadedFilesList.push(file);
          trackerLoadedFiles++;
        });
      });

      evaluation.details.filesLoaded = loadedFilesList;
      evaluation.details.successfulFiles = trackerLoadedFiles;
      const pointsPerFile = Math.floor(evaluation.maxScore / evaluation.details.totalFiles);
      evaluation.score = Math.min(evaluation.maxScore, trackerLoadedFiles * pointsPerFile);
      evaluation.success =
        trackerLoadedFiles / evaluation.details.totalFiles >= BenchmarkEvaluatorBase.THRESHOLDS.FILE_LOADING_PASS;
      evaluation.warnings.push(`Evaluated via Tool Execution Tracker (${trackerLoadedFiles} files loaded)`);
      console.log(`✅ [FileLoadingWorkflow] TRACKER: Evaluated successfully: ${trackerLoadedFiles} files loaded`);
      return evaluation;
    }

    // Expected files and their success indicators
    const expectedFiles = [
      {
        name: 'ECOLI.gbk',
        patterns: ['genome file loaded successfully', 'ECOLI.gbk', 'genome file.*loaded', 'file type.*genome'],
      },
      {
        name: '1655_C10.sorted.bam',
        patterns: ['reads file loaded successfully', '1655_C10.sorted.bam', 'aligned read', 'reads.*loaded'],
      },
      {
        name: '1655_C10.mutations.vcf',
        patterns: ['variant file loaded successfully', '1655_C10.mutations.vcf', 'variant.*loaded', 'VCF.*loaded'],
      },
      { name: 'sample.wig', patterns: ['wig.*loaded', 'sample.wig', 'tracks.*loaded'] },
      { name: 'another_sample.wig', patterns: ['wig.*loaded', 'another_sample.wig', 'tracks.*loaded'] },
    ];

    const pointsPerFile = Math.floor(evaluation.maxScore / evaluation.details.totalFiles);
    console.log(`📊 [FileLoadingWorkflow] Points per file: ${pointsPerFile}`);

    // Check for each expected file
    expectedFiles.forEach(file => {
      const found = file.patterns.some(pattern => {
        const regex = new RegExp(pattern, 'i');
        return regex.test(responseText);
      });

      if (found) {
        evaluation.details.filesLoaded.push(file.name);
        evaluation.details.successfulFiles++;
        evaluation.score += pointsPerFile;
        console.log(`✅ [FileLoadingWorkflow] File detected as loaded: ${file.name} (+${pointsPerFile} points)`);
      } else {
        console.log(`❌ [FileLoadingWorkflow] File not detected as loaded: ${file.name}`);
      }
    });

    // Special handling for WIG files (they might be reported together)
    if (/wig tracks? loading completed/i.test(responseText) || /wig.*loading.*completed/i.test(responseText)) {
      // If WIG loading was mentioned but individual files weren't detected, award partial credit
      const wigFilesAlreadyCounted = evaluation.details.filesLoaded.filter(f => f.includes('.wig')).length;
      if (wigFilesAlreadyCounted === 0) {
        // Award points for at least one WIG file
        evaluation.details.filesLoaded.push('wig_files');
        evaluation.details.successfulFiles++;
        evaluation.score += pointsPerFile;
        console.log(`✅ [FileLoadingWorkflow] WIG files detected as loaded (+${pointsPerFile} points)`);
      }
    }

    // Calculate success based on file loading
    const successRate = evaluation.details.successfulFiles / evaluation.details.totalFiles;
    evaluation.success = successRate >= BenchmarkEvaluatorBase.THRESHOLDS.FILE_LOADING_PASS;

    // Cap score at maximum
    evaluation.score = Math.min(evaluation.score, evaluation.maxScore);

    console.log(`🎯 [FileLoadingWorkflow] Natural language parsing results:`);
    console.log(`   Score: ${evaluation.score}/${evaluation.maxScore}`);
    console.log(
      `   Files loaded: ${evaluation.details.successfulFiles}/${evaluation.details.totalFiles} (${evaluation.details.filesLoaded.join(', ')})`
    );
    console.log(`   Success rate: ${(successRate * 100).toFixed(1)}%`);
    console.log(`   Success: ${evaluation.success}`);

    if (!evaluation.success) {
      evaluation.errors.push(
        `Insufficient files loaded: ${evaluation.details.successfulFiles}/${evaluation.details.totalFiles} (need at least 2 files)`
      );
    }

    return evaluation;
  }

  /**
   * Normalize parameter keys recursively from snake_case and kebab-case to camelCase
   */
  normalizeParameterKeys(params) {
    if (!params || typeof params !== 'object') {
      return params;
    }
    if (Array.isArray(params)) {
      return params.map(item => this.normalizeParameterKeys(item));
    }
    const normalized = {};
    for (const key of Object.keys(params)) {
      const camelKey = key.replace(/[-_]([a-zA-Z0-9])/g, (match, letter) => letter.toUpperCase());
      normalized[camelKey] = this.normalizeParameterKeys(params[key]);
    }
    return normalized;
  }

  /**
   * Normalize actual results parameter keys and locations
   */
  normalizeResultParameters(result) {
    if (!result) return result;

    // If it's a string, try to parse it as JSON
    if (typeof result === 'string') {
      try {
        const parsed = JSON.parse(result);
        if (parsed && typeof parsed === 'object') {
          return this.normalizeResultParameters(parsed);
        }
      } catch (e) {
        // Not a JSON string, keep as string
      }
    }

    if (Array.isArray(result)) {
      return result.map(call => this.normalizeResultParameters(call));
    }

    if (typeof result === 'object') {
      const normalizedCall = { ...result };

      // Normalize tool_name / tool / toolName
      if (!normalizedCall.tool_name) {
        if (normalizedCall.tool) {
          normalizedCall.tool_name = normalizedCall.tool;
        } else if (normalizedCall.toolName) {
          normalizedCall.tool_name = normalizedCall.toolName;
        }
      }

      // Check alternative parameter locations
      let params = normalizedCall.parameters;
      if (params === undefined) {
        // Try other names: params, arguments, args
        const alternateKeys = ['params', 'arguments', 'args', 'parameter', 'argument', 'arg'];
        for (const altKey of alternateKeys) {
          if (normalizedCall[altKey] !== undefined) {
            params = normalizedCall[altKey];
            break;
          }
        }
      }

      // If params is a string, try parsing it as JSON
      if (typeof params === 'string') {
        try {
          const parsedParams = JSON.parse(params);
          if (parsedParams && typeof parsedParams === 'object') {
            params = parsedParams;
          }
        } catch (e) {
          // Keep as string
        }
      }

      if (params !== undefined) {
        normalizedCall.parameters = this.normalizeParameterKeys(params);
      }

      return normalizedCall;
    }

    return result;
  }

  /**
   * Normalize expected results parameter keys
   */
  normalizeExpectedParameters(expected) {
    if (!expected) return expected;

    if (expected.parameters) {
      if (Array.isArray(expected.parameters)) {
        return {
          ...expected,
          parameters: expected.parameters.map(p => this.normalizeParameterKeys(p)),
        };
      } else if (typeof expected.parameters === 'object') {
        return {
          ...expected,
          parameters: this.normalizeParameterKeys(expected.parameters),
        };
      }
    }

    return expected;
  }

  getWorkflowExpectedTools(expectedResult) {
    if (!expectedResult) return [];
    if (Array.isArray(expectedResult.tool_sequence)) return expectedResult.tool_sequence;
    return expectedResult.tool_name ? [expectedResult.tool_name] : [];
  }

  getWorkflowExpectedParameters(expectedResult) {
    if (!expectedResult || !expectedResult.parameters) return [];
    return Array.isArray(expectedResult.parameters) ? expectedResult.parameters : [expectedResult.parameters];
  }

  getToolNameFromCall(call) {
    if (!call || typeof call !== 'object') return '';
    return (
      call.tool_name ||
      call.toolName ||
      call.tool ||
      call.function_name ||
      call.function_call?.name ||
      call.tool_call?.name ||
      call.function?.name ||
      call.name ||
      ''
    );
  }

  getParametersFromCall(call) {
    if (!call || typeof call !== 'object') return undefined;
    let params =
      call.parameters ?? call.params ?? call.arguments ?? call.args ?? call.parameter ?? call.argument ?? call.arg;

    if (typeof params === 'string') {
      try {
        params = JSON.parse(params);
      } catch (e) {
        // Keep plain string parameters as-is.
      }
    }

    return params;
  }

  extractWorkflowCalls(result) {
    if (Array.isArray(result)) {
      return result.map(call => this.normalizeResultParameters(call));
    }

    if (!result || typeof result !== 'object') {
      return [];
    }

    // Candidate arrays in priority order. `executedFunctionCalls` is the authoritative
    // record of tools that actually ran (captured from ChatManager.getLastExecutionData()),
    // so it is preferred over anything derived from the assistant's final text. Note
    // `result.steps` holds plain text lines (from extractWorkflowSteps) with no tool
    // names — it must never shadow a real tool-call array, so each candidate is only
    // accepted when at least one entry resolves to a tool name.
    const nestedCallArrays = [
      result.executedFunctionCalls,
      result.functionCalls,
      result.results,
      result.toolCalls,
      result.tool_calls,
      result.calls,
      result.executions,
      result.steps,
    ];

    for (const candidate of nestedCallArrays) {
      if (!Array.isArray(candidate) || candidate.length === 0) continue;
      const normalized = candidate.map(call => this.normalizeResultParameters(call));
      if (normalized.some(call => this.getToolNameFromCall(call))) {
        return normalized;
      }
    }

    return this.getToolNameFromCall(result) ? [this.normalizeResultParameters(result)] : [];
  }

  isSuccessfulWorkflowCall(call) {
    return call && call.success !== false && !call.error && call.status !== 'failed';
  }

  isPlaceholderExpectedValue(value) {
    return typeof value === 'string' && value.startsWith('<') && value.endsWith('>');
  }

  hasConcreteExpectedValue(value) {
    if (this.isPlaceholderExpectedValue(value)) return false;
    if (Array.isArray(value)) return value.some(item => this.hasConcreteExpectedValue(item));
    if (value && typeof value === 'object') {
      return Object.values(value).some(item => this.hasConcreteExpectedValue(item));
    }
    return value !== undefined;
  }

  getConcreteExpectedParameters(params) {
    if (!params || typeof params !== 'object' || Array.isArray(params)) return {};

    return Object.entries(params).reduce((concrete, [key, value]) => {
      if (this.hasConcreteExpectedValue(value)) {
        concrete[key] = value;
      }
      return concrete;
    }, {});
  }

  getParameterAliasCandidates(key) {
    const aliases = {
      filePath: ['filename', 'path', 'outputPath'],
      filename: ['filePath', 'path', 'outputPath'],
      inputFile: ['filePath', 'filename', 'path'],
      database: ['dbName', 'databaseName'],
      dbName: ['database', 'databaseName'],
      tabIndex: ['index', 'tab'],
      sequence: ['primerSequence', 'dna'],
      primerSequence: ['sequence'],
      dna: ['sequence'],
      includeCoordinates: ['include_coordinate', 'includeCoords'],
    };

    return [key, ...(aliases[key] || [])];
  }

  getActualParameterValue(actualParams, expectedKey) {
    if (!actualParams || typeof actualParams !== 'object') {
      return { found: false, value: undefined };
    }

    for (const candidateKey of this.getParameterAliasCandidates(expectedKey)) {
      if (Object.prototype.hasOwnProperty.call(actualParams, candidateKey)) {
        return { found: true, value: actualParams[candidateKey] };
      }
    }

    return { found: false, value: undefined };
  }

  workflowValuesMatch(actualValue, expectedValue) {
    if (this.isPlaceholderExpectedValue(expectedValue)) {
      return actualValue !== undefined && actualValue !== null;
    }

    if (Array.isArray(expectedValue)) {
      if (!Array.isArray(actualValue)) return false;
      const remainingActual = [...actualValue];
      return expectedValue.every(expectedItem => {
        const matchIndex = remainingActual.findIndex(actualItem => this.workflowValuesMatch(actualItem, expectedItem));
        if (matchIndex === -1) return false;
        remainingActual.splice(matchIndex, 1);
        return true;
      });
    }

    if (expectedValue && typeof expectedValue === 'object') {
      return this.workflowParametersMatch(actualValue, expectedValue);
    }

    if (typeof expectedValue === 'number') {
      const numericActual = Number(actualValue);
      return Number.isFinite(numericActual) && numericActual === expectedValue;
    }

    if (typeof expectedValue === 'boolean') {
      if (typeof actualValue === 'boolean') return actualValue === expectedValue;
      if (typeof actualValue === 'string') return actualValue.toLowerCase() === String(expectedValue);
      return false;
    }

    if (typeof expectedValue === 'string') {
      if (actualValue === undefined || actualValue === null) return false;
      const actualText = String(actualValue).replace(/\\/g, '/');
      const expectedText = expectedValue.replace(/\\/g, '/');
      const actualLower = actualText.toLowerCase();
      const expectedLower = expectedText.toLowerCase();

      if (actualLower === expectedLower) return true;
      if (actualLower.endsWith(`/${expectedLower}`) || expectedLower.endsWith(`/${actualLower}`)) return true;

      const actualBase = actualLower.split('/').pop();
      const expectedBase = expectedLower.split('/').pop();
      if (actualBase && expectedBase && actualBase === expectedBase) return true;

      return this.calculateStringSimilarity(actualText, expectedText) >= 0.8;
    }

    return actualValue === expectedValue;
  }

  workflowParametersMatch(actualParams, expectedParams) {
    if (!expectedParams || Object.keys(expectedParams).length === 0) return true;
    if (!actualParams || typeof actualParams !== 'object') return false;

    const normalizedActual = this.normalizeParameterKeys(actualParams);
    const normalizedExpected = this.normalizeParameterKeys(expectedParams);

    return Object.entries(normalizedExpected).every(([expectedKey, expectedValue]) => {
      const actualCandidate = this.getActualParameterValue(normalizedActual, expectedKey);
      if (!actualCandidate.found) {
        return !this.hasConcreteExpectedValue(expectedValue);
      }
      return this.workflowValuesMatch(actualCandidate.value, expectedValue);
    });
  }

  matchWorkflowCallsToExpected(actualCalls, expectedTools, expectedParams = []) {
    const normalizedCalls = actualCalls.map(call => this.normalizeResultParameters(call));
    let normalizedExpectedParams = [];
    if (Array.isArray(expectedParams)) {
      normalizedExpectedParams = expectedParams;
    } else if (expectedParams) {
      normalizedExpectedParams = [expectedParams];
    }
    const expectedCount = expectedTools.length;
    const actualTools = normalizedCalls.map(call => this.getToolNameFromCall(call)).filter(Boolean);

    const availableForUnordered = normalizedCalls.map((call, index) => ({ call, index, used: false }));
    const unorderedMatchedTools = [];

    expectedTools.forEach(expectedTool => {
      const match = availableForUnordered.find(item => {
        if (item.used || !this.isSuccessfulWorkflowCall(item.call)) return false;
        return this.matchToolName(this.getToolNameFromCall(item.call), expectedTool);
      });

      if (match) {
        match.used = true;
        unorderedMatchedTools.push(expectedTool);
      }
    });

    const orderedMatchedTools = [];
    const matchDetails = [];
    const missingTools = [];
    const parameterMismatches = [];
    const criticalParameterMismatches = [];
    let parameterMatches = 0;
    let criticalParameterSteps = 0;
    let criticalParameterMatches = 0;
    let searchStart = 0;

    expectedTools.forEach((expectedTool, expectedIndex) => {
      let matchedIndex = -1;
      for (let callIndex = searchStart; callIndex < normalizedCalls.length; callIndex++) {
        const call = normalizedCalls[callIndex];
        if (!this.isSuccessfulWorkflowCall(call)) continue;
        if (this.matchToolName(this.getToolNameFromCall(call), expectedTool)) {
          matchedIndex = callIndex;
          break;
        }
      }

      if (matchedIndex === -1) {
        missingTools.push(expectedTool);
        return;
      }

      const call = normalizedCalls[matchedIndex];
      const expectedParam = normalizedExpectedParams[expectedIndex] || {};
      const actualParams = this.getParametersFromCall(call);
      const concreteExpectedParams = this.getConcreteExpectedParameters(expectedParam);
      const hasCriticalParameters = Object.keys(concreteExpectedParams).length > 0;
      const paramsVerified = this.workflowParametersMatch(actualParams, expectedParam);
      const criticalParamsVerified =
        !hasCriticalParameters || this.workflowParametersMatch(actualParams, concreteExpectedParams);

      if (paramsVerified) {
        parameterMatches++;
      } else {
        parameterMismatches.push(expectedTool);
      }

      if (hasCriticalParameters) {
        criticalParameterSteps++;
        if (criticalParamsVerified) {
          criticalParameterMatches++;
        } else {
          criticalParameterMismatches.push(expectedTool);
        }
      }

      orderedMatchedTools.push(expectedTool);
      matchDetails.push({
        tool: expectedTool,
        actualTool: this.getToolNameFromCall(call),
        actualIndex: matchedIndex,
        expectedIndex,
        paramsVerified,
        criticalParamsVerified,
      });
      searchStart = matchedIndex + 1;
    });

    return {
      expectedCount,
      actualTools,
      orderedMatchedTools,
      unorderedMatchedTools,
      orderedMatches: orderedMatchedTools.length,
      unorderedMatches: unorderedMatchedTools.length,
      parameterMatches,
      criticalParameterSteps,
      criticalParameterMatches,
      missingTools,
      parameterMismatches,
      criticalParameterMismatches,
      matchDetails,
      hasOutOfOrder: unorderedMatchedTools.length > orderedMatchedTools.length,
    };
  }

  calculateWorkflowMatchScore(matchResult, maxScore) {
    const expectedCount = Math.max(matchResult.expectedCount, 1);
    const scoreRatio =
      0.4 * (matchResult.unorderedMatches / expectedCount) +
      0.4 * (matchResult.orderedMatches / expectedCount) +
      0.2 * (matchResult.parameterMatches / expectedCount);

    return Math.min(maxScore, Math.round(maxScore * scoreRatio));
  }

  isWorkflowMatchSuccessful(matchResult, score, maxScore) {
    const passScore = Math.ceil(maxScore * BenchmarkEvaluatorBase.THRESHOLDS.SUCCESS_SIMPLE);
    return (
      matchResult.expectedCount > 0 &&
      matchResult.orderedMatches === matchResult.expectedCount &&
      matchResult.criticalParameterMatches === matchResult.criticalParameterSteps &&
      score >= passScore
    );
  }

  buildWorkflowEvaluationFromMatch(matchResult, testResult) {
    const evaluation = {
      success: false,
      score: this.calculateWorkflowMatchScore(matchResult, testResult.maxScore || 10),
      maxScore: testResult.maxScore || 10,
      errors: [],
      warnings: [],
      details: {
        expectedTools: matchResult.expectedCount,
        orderedMatches: matchResult.orderedMatches,
        unorderedMatches: matchResult.unorderedMatches,
        parameterMatches: matchResult.parameterMatches,
        criticalParameterMatches: matchResult.criticalParameterMatches,
        criticalParameterSteps: matchResult.criticalParameterSteps,
        actualTools: matchResult.actualTools,
      },
    };

    if (matchResult.hasOutOfOrder) {
      evaluation.errors.push('Workflow tools were detected but not in the expected order');
    }

    if (matchResult.missingTools.length > 0) {
      evaluation.errors.push(`Missing ordered workflow tools: ${matchResult.missingTools.join(', ')}`);
    }

    if (matchResult.criticalParameterMismatches.length > 0) {
      evaluation.errors.push(
        `Critical parameters did not match for: ${matchResult.criticalParameterMismatches.join(', ')}`
      );
    } else if (matchResult.parameterMismatches.length > 0) {
      evaluation.warnings.push(`Non-critical parameter mismatch for: ${matchResult.parameterMismatches.join(', ')}`);
    }

    evaluation.success = this.isWorkflowMatchSuccessful(matchResult, evaluation.score, evaluation.maxScore);
    return evaluation;
  }

  getRecentOrderedWorkflowMatches(
    expectedTools,
    timeoutMs = BenchmarkEvaluatorBase.TIMEOUTS.DEFAULT,
    expectedParams = []
  ) {
    const now = Date.now();
    const recentExecutions = this.getTrackedExecutions()
      .filter(exec => exec.status === 'completed' && now - exec.startTime < timeoutMs)
      .sort((a, b) => a.startTime - b.startTime)
      .map(exec => ({
        tool_name: exec.toolName,
        parameters: this.normalizeParameterKeys(exec.parameters || {}),
        status: exec.status,
        success: true,
        execution: exec,
      }));

    return this.matchWorkflowCallsToExpected(recentExecutions, expectedTools, expectedParams);
  }

  /**
   * Evaluator methods - delegates to BenchmarkEvaluatorBase for unified logic.
   * Fix Problem 4: Single source of truth for evaluation.
   */
  async evaluateBasicFunctionCall(actualResult, expectedResult, testResult) {
    const normalizedActual = this.normalizeResultParameters(actualResult);
    const normalizedExpected = this.normalizeExpectedParameters(expectedResult);

    // Delegate to the base class with AutomaticComplex-specific options:
    // - useParseDebugInfo: true (ComplexSuite PRIORITY 1 feature)
    // - useStringFallbacks: true (PRIORITY 3-5: JSON parse, alt props, string contains)
    // - maxParamDeduction: 2 (complex allows more deduction)
    // - successThreshold: 0.4 (40% for complex tests)
    // - defaultMaxScore: 10
    return super.evaluateBasicFunctionCall(normalizedActual, normalizedExpected, testResult, {
      defaultMaxScore: 10,
      successThreshold: BenchmarkEvaluatorBase.THRESHOLDS.SUCCESS_COMPLEX,
      useParseDebugInfo: true,
      maxParamDeduction: 2,
    });
  }

  async evaluateNavigationCall(actualResult, expectedResult, testResult) {
    const evaluation = await this.evaluateBasicFunctionCall(actualResult, expectedResult, testResult);

    // Add navigation-specific checks for complex tests
    if (actualResult && actualResult.parameters) {
      const params = actualResult.parameters;

      // Check for reasonable coordinate ranges
      if (params.start && params.end && params.start > params.end) {
        evaluation.warnings.push('Start position should be less than end position');
      }

      // Check for very large ranges that might indicate errors
      if (params.start && params.end && params.end - params.start > 10000000) {
        evaluation.warnings.push('Range is very large (>10Mb), verify this is intentional');
      }

      // Complex test: Check for appropriate range size for analysis
      if (params.start && params.end) {
        const rangeSize = params.end - params.start;
        if (rangeSize > 50000 && rangeSize < 500000) {
          evaluation.score = Math.min(evaluation.maxScore, evaluation.score + (testResult.bonusScore || 2)); // Add bonus points
        }
      }
    }

    return evaluation;
  }

  /**
   * Parse natural language response for navigation workflow
   */
  parseNaturalLanguageNavigationResponse(actualResult, expectedResult, testResult) {
    const evaluation = {
      success: false,
      score: 0,
      maxScore: testResult.maxScore || 10,
      errors: [],
      warnings: [],
    };

    let responseText = '';

    // Extract text from various response formats
    if (typeof actualResult === 'string') {
      responseText = actualResult;
    } else if (actualResult && actualResult.response) {
      responseText = actualResult.response;
    } else if (actualResult && actualResult.message) {
      responseText = actualResult.message;
    } else {
      responseText = JSON.stringify(actualResult);
    }

    console.log('📄 [NavigationWorkflow] Parsing response text:', responseText.substring(0, 500));

    const navTrackerCheck = this.checkToolExecutionTracker(
      'navigate_to_position',
      BenchmarkEvaluatorBase.TIMEOUTS.DEFAULT
    );
    if (navTrackerCheck.found && navTrackerCheck.status === 'completed') {
      evaluation.score = Math.ceil(evaluation.maxScore * BenchmarkEvaluatorBase.THRESHOLDS.SUCCESS_EXPORT_PASS);

      const zoomTrackerCheck = this.checkToolExecutionTracker('zoom_in', BenchmarkEvaluatorBase.TIMEOUTS.DEFAULT);
      const zoomAltCheck = this.checkToolExecutionTracker('set_zoom_level', BenchmarkEvaluatorBase.TIMEOUTS.DEFAULT);
      if (
        (zoomTrackerCheck.found && zoomTrackerCheck.status === 'completed') ||
        (zoomAltCheck.found && zoomAltCheck.status === 'completed')
      ) {
        evaluation.score = evaluation.maxScore;
      } else {
        const zoomPatterns = ['zoom.*10x', 'zoom.*in', 'magnify', 'zoom.*factor'];
        const zoomDetected = zoomPatterns.some(pattern => new RegExp(pattern, 'i').test(responseText));
        if (zoomDetected) {
          evaluation.score = evaluation.maxScore;
        }
      }
      evaluation.success =
        evaluation.score >= Math.ceil(evaluation.maxScore * BenchmarkEvaluatorBase.THRESHOLDS.SUCCESS_COMPLEX);
      evaluation.warnings.push('Evaluated via Tool Execution Tracker');
      console.log(` [NavigationWorkflow] TRACKER: Evaluated successfully. Score: ${evaluation.score}`);
      return evaluation;
    }

    // Check for navigation success indicators
    const navigationSuccessPatterns = [
      'navigate.*position.*completed',
      'navigation.*successful',
      'navigated to.*position',
      'task completed.*navigate',
      'navigate_to_position.*success',
      'results have been processed',
      'navigation.*complete',
    ];

    const navigationDetected = navigationSuccessPatterns.some(pattern => {
      const regex = new RegExp(pattern, 'i');
      return regex.test(responseText);
    });

    if (navigationDetected) {
      evaluation.score = Math.ceil(evaluation.maxScore * BenchmarkEvaluatorBase.THRESHOLDS.SUCCESS_EXPORT_PASS);
      console.log(`✅ [NavigationWorkflow] Navigation detected as successful (+${evaluation.score} points)`);

      // Check if coordinates were mentioned
      const coordinatePatterns = [
        '123\\d{4}', // 1230000 pattern
        '130\\d{4}', // 1300000 pattern
        '1230000',
        '1300000',
      ];

      const coordinatesDetected = coordinatePatterns.some(pattern => {
        const regex = new RegExp(pattern, 'i');
        return regex.test(responseText);
      });

      if (coordinatesDetected) {
        // Award bonus points for correct coordinates
        evaluation.score = Math.min(evaluation.maxScore, evaluation.score + 2);
        console.log(`✅ [NavigationWorkflow] Correct coordinates detected (+2 bonus points)`);
      }

      // Check for zoom functionality mention
      const zoomPatterns = ['zoom.*10x', 'zoom.*in', 'magnify', 'zoom.*factor'];

      const zoomDetected = zoomPatterns.some(pattern => {
        const regex = new RegExp(pattern, 'i');
        return regex.test(responseText);
      });

      if (zoomDetected) {
        // Award remaining points for zoom functionality
        evaluation.score = evaluation.maxScore;
        console.log(`✅ [NavigationWorkflow] Zoom functionality detected - full points awarded`);
      }
    } else {
      evaluation.errors.push('Navigation success not detected in response');
      console.log(`❌ [NavigationWorkflow] Navigation success not detected`);
    }

    // Calculate success based on score
    evaluation.success =
      evaluation.score >= Math.ceil(evaluation.maxScore * BenchmarkEvaluatorBase.THRESHOLDS.SUCCESS_COMPLEX);

    console.log(`🎯 [NavigationWorkflow] Natural language parsing results:`);
    console.log(`   Score: ${evaluation.score}/${evaluation.maxScore}`);
    console.log(`   Success: ${evaluation.success}`);

    return evaluation;
  }

  async evaluateWorkflowCall(actualResult, expectedResult, testResult) {
    const normalizedActual = this.normalizeResultParameters(actualResult);
    const normalizedExpected = this.normalizeExpectedParameters(expectedResult);
    const expectedTools = this.getWorkflowExpectedTools(normalizedExpected);
    const expectedParams = this.getWorkflowExpectedParameters(normalizedExpected);
    const workflowCalls = this.extractWorkflowCalls(normalizedActual);

    const evaluation = {
      success: false,
      score: 0,
      maxScore: testResult.maxScore || 10, // Use test's actual maxScore, default to 10 for complex
      errors: [],
      warnings: [],
    };

    if (!normalizedActual) {
      evaluation.errors.push('No result obtained from workflow execution');
      return evaluation;
    }

    if (workflowCalls.length > 1) {
      const matchResult = this.matchWorkflowCallsToExpected(workflowCalls, expectedTools, expectedParams);
      return this.buildWorkflowEvaluationFromMatch(matchResult, testResult);
    }

    // Handle both structured tool results AND natural language responses
    const isNaturalLanguageResponse =
      typeof normalizedActual === 'string' ||
      (normalizedActual &&
        typeof normalizedActual === 'object' &&
        !normalizedActual.tool_name &&
        !Array.isArray(normalizedActual));

    if (isNaturalLanguageResponse) {
      if (testResult.category === 'navigation') {
        console.log('📝 [WorkflowCall] Detected natural language response, parsing for navigation success');
        return this.parseNaturalLanguageNavigationResponse(normalizedActual, normalizedExpected, testResult);
      } else {
        console.log('📝 [WorkflowCall] Detected natural language response, parsing for workflow success');
        return this.parseNaturalLanguageWorkflowResponse(normalizedActual, normalizedExpected, testResult);
      }
    }

    // Single step workflow fallback
    const singleStepEval = await this.evaluateBasicFunctionCall(
      workflowCalls[0] || normalizedActual,
      {
        tool_name: expectedTools[0] || normalizedExpected.tool_name,
        parameters: expectedParams[0] || normalizedExpected.parameters,
      },
      testResult
    );
    evaluation.score = singleStepEval.score;
    evaluation.errors = singleStepEval.errors;
    evaluation.warnings = singleStepEval.warnings;
    evaluation.success =
      evaluation.score >= Math.ceil(evaluation.maxScore * BenchmarkEvaluatorBase.THRESHOLDS.SUCCESS_SIMPLE);
    return evaluation;
  }

  /**
   * Parse natural language response for general workflows
   */
  parseNaturalLanguageWorkflowResponse(actualResult, expectedResult, testResult) {
    const evaluation = {
      success: false,
      score: 0,
      maxScore: testResult.maxScore || 10,
      errors: [],
      warnings: [],
    };

    let responseText = '';

    if (typeof actualResult === 'string') {
      responseText = actualResult;
    } else if (actualResult && actualResult.response) {
      responseText = actualResult.response;
    } else if (actualResult && actualResult.message) {
      responseText = actualResult.message;
    } else {
      responseText = JSON.stringify(actualResult);
    }

    console.log(` [WorkflowCall] Parsing response text:`, responseText.substring(0, 500));

    const expectedTools = this.getWorkflowExpectedTools(expectedResult);
    const expectedParams = this.getWorkflowExpectedParameters(expectedResult);

    if (expectedTools.length === 0) {
      evaluation.errors.push('No expected tools defined for evaluation');
      return evaluation;
    }

    const trackerMatchResult = this.getRecentOrderedWorkflowMatches(
      expectedTools,
      BenchmarkEvaluatorBase.TIMEOUTS.DEFAULT,
      expectedParams
    );

    if (trackerMatchResult.unorderedMatches > 0) {
      const trackerEvaluation = this.buildWorkflowEvaluationFromMatch(trackerMatchResult, testResult);
      const paramsNote = trackerMatchResult.matchDetails.some(d => d.paramsVerified) ? ' (params verified)' : '';
      trackerEvaluation.warnings.push(
        `Evaluated via Tool Execution Tracker (${trackerMatchResult.orderedMatches}/${expectedTools.length} tools in order${paramsNote})`
      );
      console.log(
        ` [WorkflowCall] TRACKER: Ordered matches: ${trackerMatchResult.orderedMatches}/${expectedTools.length}. Score: ${trackerEvaluation.score}`
      );
      return trackerEvaluation;
    }

    const generalSuccessPatterns = [
      /completed successfully/i,
      /successfully completed/i,
      /workflow.*complete/i,
      /tasks?.*done/i,
      /successfully/i,
    ];
    const hasGeneralSuccess = generalSuccessPatterns.some(pattern => pattern.test(responseText));

    let toolMatches = 0;
    expectedTools.forEach(tool => {
      const normTool = this.normalizeToolName(tool);
      const patterns = this.toolSuccessPatterns[normTool] || [new RegExp(normTool.replace(/_/g, '.*'), 'i')];
      const detected = patterns.some(pattern => pattern.test(responseText));
      if (detected) {
        toolMatches++;
        console.log(` [WorkflowCall] Detected tool execution: ${tool}`);
      } else {
        console.log(` [WorkflowCall] Tool execution not detected: ${tool}`);
      }
    });

    const baselineScore = hasGeneralSuccess
      ? Math.ceil(evaluation.maxScore * BenchmarkEvaluatorBase.THRESHOLDS.GENERAL_SUCCESS_BONUS)
      : 0;
    let toolScore = 0;
    if (expectedTools.length > 0) {
      const remainingPoints = evaluation.maxScore - baselineScore;
      toolScore = Math.floor(remainingPoints * (toolMatches / expectedTools.length));
    }

    evaluation.score = baselineScore + toolScore;
    const requiredToolMatches = Math.ceil(expectedTools.length * BenchmarkEvaluatorBase.THRESHOLDS.SUCCESS_EXPORT_PASS);
    evaluation.success =
      toolMatches >= requiredToolMatches &&
      evaluation.score >= Math.ceil(evaluation.maxScore * BenchmarkEvaluatorBase.THRESHOLDS.SUCCESS_SIMPLE);
    if (evaluation.success) {
      evaluation.warnings.push('Natural-language fallback cannot verify strict tool order');
    }

    console.log(`/ [WorkflowCall] Natural language parsing results:`);
    console.log(`   Score: ${evaluation.score}/${evaluation.maxScore}`);
    console.log(`   Tool matches: ${toolMatches}/${expectedTools.length}`);
    console.log(`   Success: ${evaluation.success}`);

    if (!evaluation.success) {
      evaluation.errors.push(
        `Workflow execution not verified in response (${toolMatches}/${expectedTools.length} tool matches)`
      );
    }

    return evaluation;
  }

  async evaluateFileLoadingWorkflow(actualResult, expectedResult, testResult) {
    const evaluation = {
      success: false,
      score: 0,
      maxScore: testResult.maxScore || 15,
      errors: [],
      warnings: [],
      details: {
        filesLoaded: [],
        toolsExecuted: [],
        successfulFiles: 0,
        totalFiles: 5, // Total expected files: ECOLI.gbk, bam, vcf, 2 wig files
      },
    };

    console.log('🔍 [FileLoadingWorkflow] Starting simplified evaluation with result:', actualResult);

    if (!actualResult) {
      evaluation.errors.push('No result obtained from file loading workflow');
      return evaluation;
    }

    // Handle both structured tool results AND natural language responses
    const isNaturalLanguageResponse =
      typeof actualResult === 'string' ||
      (actualResult && typeof actualResult === 'object' && !actualResult.tool_name && !Array.isArray(actualResult));

    if (isNaturalLanguageResponse) {
      console.log('📝 [FileLoadingWorkflow] Detected natural language response, parsing for file loading success');
      return this.parseNaturalLanguageFileLoadingResponse(actualResult, evaluation);
    }

    // Handle different result formats flexibly
    let results = [];
    if (Array.isArray(actualResult)) {
      results = actualResult;
    } else if (actualResult && typeof actualResult === 'object') {
      if (actualResult.tool_name) {
        results = [actualResult];
      } else if (actualResult.results && Array.isArray(actualResult.results)) {
        results = actualResult.results;
      } else {
        // Extract tool calls from object
        const extractedResults = [];
        Object.values(actualResult).forEach(value => {
          if (value && typeof value === 'object' && value.tool_name) {
            extractedResults.push(value);
          }
        });
        results = extractedResults;
      }
    }

    console.log(`📋 [FileLoadingWorkflow] Processing ${results.length} results`);

    // Expected tools for validation
    const expectedTools = {
      load_genome_file: ['ECOLI.gbk'],
      load_reads_file: ['1655_C10.sorted.bam'],
      load_variant_file: ['1655_C10.mutations.vcf'],
      load_wig_tracks: ['sample.wig', 'another_sample.wig'],
    };

    // Points per successfully loaded file
    const pointsPerFile = Math.floor(evaluation.maxScore / evaluation.details.totalFiles);
    console.log(`📊 [FileLoadingWorkflow] Points per file: ${pointsPerFile}`);

    // Track loaded files to avoid double counting
    const loadedFiles = new Set();

    // Evaluate each result
    results.forEach((result, index) => {
      if (!result || !result.tool_name) {
        console.log(`⚠️ [FileLoadingWorkflow] Result ${index} missing tool_name`);
        return;
      }

      const toolName = result.tool_name;
      evaluation.details.toolsExecuted.push(toolName);
      console.log(`🔧 [FileLoadingWorkflow] Processing tool: ${toolName}`);

      // Check if tool is expected
      const matchedKey = Object.keys(expectedTools).find(key => this.matchToolName(toolName, key));
      if (matchedKey) {
        // Check if operation was successful
        const isSuccessful =
          result.success !== false &&
          !result.error &&
          result.message &&
          !result.message.toLowerCase().includes('error') &&
          !result.message.toLowerCase().includes('failed');

        if (isSuccessful) {
          // Award points for each expected file that should be loaded by this tool
          const toolFiles = expectedTools[matchedKey];

          // Check parameters to see if files are correctly specified
          let hasCorrectParameters = false;
          if (result.parameters) {
            // Single file parameter
            if (result.parameters.filePath) {
              const fileName = result.parameters.filePath.split('/').pop();
              if (
                toolFiles.some(
                  expectedFile =>
                    fileName === expectedFile || fileName.includes(expectedFile) || expectedFile.includes(fileName)
                )
              ) {
                hasCorrectParameters = true;
              }
            }

            // Multiple files parameter (for WIG tracks)
            if (result.parameters.filePaths && Array.isArray(result.parameters.filePaths)) {
              const fileNames = result.parameters.filePaths.map(path => path.split('/').pop());
              hasCorrectParameters = toolFiles.some(expectedFile =>
                fileNames.some(
                  fileName =>
                    fileName === expectedFile || fileName.includes(expectedFile) || expectedFile.includes(fileName)
                )
              );
            }
          }

          if (hasCorrectParameters) {
            // Successful file loading - award full points per file
            toolFiles.forEach(file => {
              if (!loadedFiles.has(file)) {
                loadedFiles.add(file);
                evaluation.details.filesLoaded.push(file);
                evaluation.details.successfulFiles++;
                evaluation.score += pointsPerFile;
                console.log(`✅ [FileLoadingWorkflow] File loaded successfully: ${file} (+${pointsPerFile} points)`);
              }
            });
          } else {
            // Tool correct but parameters incorrect - award 1 point only
            evaluation.score += 1;
            evaluation.warnings.push(`Tool '${toolName}' executed but parameters incorrect`);
            console.log(`⚠️ [FileLoadingWorkflow] Tool '${toolName}' has incorrect parameters (+1 point only)`);
          }
        } else {
          // Tool failed - no points
          evaluation.errors.push(`Tool '${toolName}' failed to execute successfully`);
          console.log(`❌ [FileLoadingWorkflow] Tool '${toolName}' failed - no points`);
        }
      } else {
        // Unexpected tool - no points
        evaluation.warnings.push(`Unexpected tool executed: ${toolName}`);
        console.log(`⚠️ [FileLoadingWorkflow] Unexpected tool: ${toolName} - no points`);
      }
    });

    // Calculate success based on file loading
    const successRate = evaluation.details.successfulFiles / evaluation.details.totalFiles;
    evaluation.success = successRate >= BenchmarkEvaluatorBase.THRESHOLDS.FILE_LOADING_PASS;

    // Cap score at maximum
    evaluation.score = Math.min(evaluation.score, evaluation.maxScore);

    console.log(`🎯 [FileLoadingWorkflow] Final evaluation:`);
    console.log(`   Score: ${evaluation.score}/${evaluation.maxScore}`);
    console.log(
      `   Files loaded: ${evaluation.details.successfulFiles}/${evaluation.details.totalFiles} (${evaluation.details.filesLoaded.join(', ')})`
    );
    console.log(`   Success rate: ${(successRate * 100).toFixed(1)}%`);
    console.log(`   Success: ${evaluation.success}`);

    if (!evaluation.success) {
      evaluation.errors.push(
        `Insufficient files loaded: ${evaluation.details.successfulFiles}/${evaluation.details.totalFiles} (need at least 2 files)`
      );
    }

    return evaluation;
  }

  /**
   * Evaluate data export workflow with Song's file-priority system
   * Primary: Check if target files exist → Full score
   * Fallback: Tool calls + execution success
   * Enhanced: Handle "NO TOOLS DETECTED" cases with execution tracker priority
   */
  async evaluateDataExportWorkflow(actualResult, expectedResult, testResult) {
    const evaluation = {
      success: false,
      score: 0,
      maxScore: testResult.maxScore || 20,
      errors: [],
      warnings: [],
      details: {
        filesExported: [],
        toolsExecuted: [],
        successfulExports: 0,
        totalExpectedFiles: expectedResult.expectedFiles?.length || 7,
        evaluationMethod: 'unknown',
      },
    };

    console.log("🗂️ [DataExportWorkflow] Starting Song's enhanced file-priority evaluation:", {
      testId: testResult.id,
      expectedFiles: expectedResult.expectedFiles,
      actualResult: actualResult,
      parseDebugInfo: testResult.parseDebugInfo,
    });

    if (!actualResult) {
      evaluation.errors.push('No result obtained from data export workflow');
      return evaluation;
    }

    const exportExpectedTools = expectedResult.tool_sequence || [];
    const exportExpectedParams = expectedResult.parameters || null;
    const exportTrackerMatch = this.getRecentOrderedWorkflowMatches(
      exportExpectedTools,
      BenchmarkEvaluatorBase.TIMEOUTS.EXPORT_WORKFLOW,
      exportExpectedParams
    );
    const trackerMatchedExportTools = exportTrackerMatch.orderedMatchedTools;
    const exportMatchDetails = exportTrackerMatch.matchDetails;

    if (trackerMatchedExportTools.length > 0) {
      console.log(
        `/ [DataExportWorkflow] TRACKER PRIORITY: Found ${trackerMatchedExportTools.length}/${exportExpectedTools.length} successful tool executions`
      );

      let score = 0;
      const toolsFound = Math.min(trackerMatchedExportTools.length, exportExpectedTools.length);

      if (toolsFound <= 4) {
        score = toolsFound * 2;
      } else {
        const firstTierPoints = 4 * 2;
        const additionalTools = toolsFound - 4;
        const secondTierPoints = additionalTools * 4;
        score = firstTierPoints + secondTierPoints;
      }

      evaluation.score = Math.min(score, evaluation.maxScore);
      const paramsNote = exportMatchDetails.some(d => d.paramsVerified) ? ' (params verified)' : '';
      evaluation.details.toolsExecuted = trackerMatchedExportTools;
      evaluation.details.evaluationMethod = 'execution_tracker';

      if (exportTrackerMatch.hasOutOfOrder) {
        evaluation.warnings.push('Export tools were detected but not in the requested order');
      }

      if (
        trackerMatchedExportTools.length >=
        Math.ceil(exportExpectedTools.length * BenchmarkEvaluatorBase.THRESHOLDS.SUCCESS_EXPORT_PASS)
      ) {
        evaluation.success = true;
        evaluation.warnings.push(
          `Awarded points based on Tool Execution Tracker (${trackerMatchedExportTools.length}/${exportExpectedTools.length} tools executed${paramsNote})`
        );
        console.log(
          ` [DataExportWorkflow] TRACKER SUCCESS: ${trackerMatchedExportTools.length}/${exportExpectedTools.length} tools executed successfully`
        );
      }

      await this.applyFileVerificationPenalty(evaluation, expectedResult, trackerMatchedExportTools.length);

      evaluation.score = Math.min(evaluation.score, evaluation.maxScore);
      return evaluation;
    }

    // PRIORITY 1: Check if target export files exist (Song's file-priority system)
    const expectedFiles = expectedResult.expectedFiles || [];
    const pointsPerFile = Math.floor(evaluation.maxScore / evaluation.details.totalExpectedFiles);
    console.log(`📊 [DataExportWorkflow] Points per file: ${pointsPerFile}`);

    for (const fileName of expectedFiles) {
      const filePath = this.buildFilePath(fileName);
      const fileExists = await this.checkTargetFileExists(filePath);

      if (fileExists) {
        evaluation.details.filesExported.push(fileName);
        evaluation.details.successfulExports++;
        evaluation.score += pointsPerFile;
        console.log(`✅ [DataExportWorkflow] File exists: ${fileName} (+${pointsPerFile} points)`);
      } else {
        console.log(`❌ [DataExportWorkflow] File missing: ${fileName}`);
      }
    }

    // If files exist, award full score (Song's primary criterion)
    if (
      evaluation.details.successfulExports >=
      Math.ceil(evaluation.details.totalExpectedFiles * BenchmarkEvaluatorBase.THRESHOLDS.FILE_EXPORT_PASS)
    ) {
      console.log(
        `🎯 [DataExportWorkflow] PRIMARY SUCCESS: ${evaluation.details.successfulExports}/${evaluation.details.totalExpectedFiles} files exist`
      );
      evaluation.success = true;
      evaluation.details.evaluationMethod = 'file_existence';
      evaluation.score = Math.min(evaluation.score, evaluation.maxScore);
      return evaluation;
    }

    console.log(`⚠️ [DataExportWorkflow] Insufficient files exist, using fallback evaluation`);

    // PRIORITY 2: Enhanced ChatManager parseDebugInfo detection (Song's improvement)
    if (
      testResult.parseDebugInfo &&
      testResult.parseDebugInfo.detectedTools &&
      testResult.parseDebugInfo.detectedTools.length > 0
    ) {
      const detectedTools = testResult.parseDebugInfo.detectedTools;
      console.log(
        `🎯 [DataExportWorkflow] Using ChatManager's detected tools:`,
        detectedTools.map(t => t.tool)
      );

      const expectedToolsList = expectedResult.tool_sequence || [];
      const matchingTools = detectedTools.filter(dt => expectedToolsList.some(et => this.matchToolName(dt.tool, et)));

      if (matchingTools.length > 0) {
        const expectedToolCount = expectedResult.tool_sequence?.length || 7;

        // Song's tiered scoring system:
        // First 4 tools: 2 points each = 8 points
        // Additional 3 tools: 4 points each = 12 points
        // Total possible: 8 + 12 = 20 points
        let score = 0;
        const toolsFound = Math.min(matchingTools.length, expectedToolCount);

        if (toolsFound <= 4) {
          // Only first tier: 2 points per tool
          score = toolsFound * 2;
        } else {
          // First 4 tools: 8 points + additional tools: 4 points each
          const firstTierPoints = 4 * 2; // 8 points
          const additionalTools = toolsFound - 4;
          const secondTierPoints = additionalTools * 4;
          score = firstTierPoints + secondTierPoints;
        }

        evaluation.score = Math.min(score, evaluation.maxScore);
        evaluation.details.toolsExecuted = matchingTools.map(mt => mt.tool);
        evaluation.details.evaluationMethod = 'parse_debug_info';
        evaluation.success =
          matchingTools.length >= Math.ceil(expectedToolCount * BenchmarkEvaluatorBase.THRESHOLDS.SUCCESS_EXPORT_PASS);

        console.log(
          `✅ [DataExportWorkflow] PARSE DEBUG SUCCESS: ${matchingTools.length}/${expectedToolCount} tools detected`
        );
        console.log(
          `🎯 [DataExportWorkflow] Tiered scoring: ${toolsFound <= 4 ? toolsFound + ' tools × 2 points' : '4 tools × 2 + ' + (toolsFound - 4) + ' tools × 4'} = ${score} points`
        );
        evaluation.warnings.push(
          `Awarded ${score} points using tiered scoring (${matchingTools.length}/${expectedToolCount} tools detected)`
        );

        // Apply Song's file verification penalty system
        await this.applyFileVerificationPenalty(evaluation, expectedResult, matchingTools.length);

        return evaluation;
      }
    }

    // PRIORITY 3: Natural Language Response Parsing
    const isNaturalLanguageResponse =
      typeof actualResult === 'string' ||
      (actualResult && typeof actualResult === 'object' && !actualResult.tool_name && !Array.isArray(actualResult));

    if (isNaturalLanguageResponse) {
      console.log('📝 [DataExportWorkflow] Parsing natural language response for export success');
      evaluation.details.evaluationMethod = 'natural_language';
      return this.parseNaturalLanguageExportResponse(actualResult, expectedResult, testResult, evaluation);
    }

    // PRIORITY 4: Structured Tool Results (Legacy)
    let results = [];
    if (Array.isArray(actualResult)) {
      results = actualResult;
    } else if (actualResult && actualResult.tool_name) {
      results = [actualResult];
    }

    console.log(`📋 [DataExportWorkflow] Processing ${results.length} structured tool results`);

    if (results.length > 0) {
      evaluation.details.evaluationMethod = 'structured_tools';
      return this.evaluateStructuredToolResults(results, expectedResult, evaluation);
    }

    // FINAL FALLBACK: If no tools detected but this is a multi-tool workflow,
    // check for general success patterns in the response
    if (
      typeof actualResult === 'string' ||
      (actualResult && actualResult.message) ||
      (actualResult && actualResult.response)
    ) {
      const responseText =
        typeof actualResult === 'string'
          ? actualResult
          : actualResult.message || actualResult.response || JSON.stringify(actualResult);

      console.log('🔍 [DataExportWorkflow] FINAL FALLBACK: Checking for general success patterns');

      const generalSuccessPatterns = [
        /export.*completed successfully/i,
        /all.*files.*exported/i,
        /workflow.*complete/i,
        /tasks?.*completed/i,
        /successfully.*exported/i,
        /export.*successful/i,
      ];

      const hasGeneralSuccess = generalSuccessPatterns.some(pattern => pattern.test(responseText));

      if (hasGeneralSuccess) {
        // Award partial credit for general success indication
        evaluation.score = Math.floor(evaluation.maxScore * BenchmarkEvaluatorBase.THRESHOLDS.SUCCESS_EXPORT_PASS);
        evaluation.success = true;
        evaluation.details.evaluationMethod = 'general_success_pattern';
        evaluation.warnings.push('Awarded partial credit based on general success patterns in response');
        console.log(`✅ [DataExportWorkflow] GENERAL SUCCESS: Detected success patterns in response`);
        return evaluation;
      }
    }

    // No success detected
    evaluation.errors.push('No tool execution or success patterns detected');
    evaluation.details.evaluationMethod = 'no_detection';
    console.log(`❌ [DataExportWorkflow] NO SUCCESS: No detection method succeeded`);

    return evaluation;
  }

  /**
   * Apply Song's file verification penalty system
   * If detected files < detected tools, deduct 1 point per missing file
   */
  async applyFileVerificationPenalty(evaluation, expectedResult, detectedToolsCount) {
    const expectedFiles = expectedResult.expectedFiles || [];
    let actualFilesFound = 0;
    const foundFiles = [];
    const missingFiles = [];

    console.log(
      `🔍 [FileVerification] Starting verification for ${expectedFiles.length} files, ${detectedToolsCount} tools detected`
    );
    console.log(`🔍 [FileVerification] Expected files:`, expectedFiles);

    // Check each expected file existence
    for (const fileName of expectedFiles) {
      const filePath = this.buildFilePath(fileName);
      console.log(`🔍 [FileVerification] Checking file: ${fileName} at path: ${filePath}`);

      const fileExists = await this.checkTargetFileExists(filePath);

      if (fileExists) {
        evaluation.details.filesExported.push(fileName);
        evaluation.details.successfulExports++;
        actualFilesFound++;
        foundFiles.push(fileName);
        console.log(`✅ [FileVerification] File exists: ${fileName}`);
      } else {
        missingFiles.push(fileName);
        console.log(`❌ [FileVerification] File missing: ${fileName}`);
      }
    }

    console.log(`📉 [FileVerification] Files found: ${actualFilesFound}/${expectedFiles.length}`);
    console.log(`📉 [FileVerification] Found files:`, foundFiles);
    console.log(`📉 [FileVerification] Missing files:`, missingFiles);

    // Apply penalty if actual files < detected tools
    if (actualFilesFound < detectedToolsCount) {
      const penalty = detectedToolsCount - actualFilesFound;
      const originalScore = evaluation.score;
      evaluation.score = Math.max(0, evaluation.score - penalty); // Don't go below 0

      console.log(
        `⚠️ [FileVerificationPenalty] Files found: ${actualFilesFound}, Tools detected: ${detectedToolsCount}`
      );
      console.log(
        `📉 [FileVerificationPenalty] Penalty applied: -${penalty} points (${originalScore} → ${evaluation.score})`
      );

      evaluation.warnings.push(
        `File verification penalty: -${penalty} points (${actualFilesFound} files found vs ${detectedToolsCount} tools detected)`
      );

      if (foundFiles.length > 0) {
        evaluation.warnings.push(`Found files: ${foundFiles.join(', ')}`);
      }
      if (missingFiles.length > 0) {
        evaluation.warnings.push(`Missing files: ${missingFiles.join(', ')}`);
      }
    } else {
      console.log(`✅ [FileVerification] No penalty: ${actualFilesFound} files ≥ ${detectedToolsCount} tools`);
      if (foundFiles.length > 0) {
        evaluation.warnings.push(`File verification passed: ${foundFiles.length} files found`);
      }
    }

    console.log(
      `📊 [FileVerification] Summary: ${actualFilesFound}/${expectedFiles.length} files found, ${detectedToolsCount} tools detected`
    );
  }

  /**
   * Evaluate structured tool results (legacy method)
   */
  evaluateStructuredToolResults(results, expectedResult, evaluation) {
    const expectedTools = {
      export_fasta_sequence: ['exported_sequences.fasta'],
      export_genbank_format: ['exported_data.gbk'],
      export_gff_annotations: ['exported_annotations.gff3'],
      export_bed_format: ['exported_features.bed'],
      export_cds_fasta: ['exported_cds.fasta'],
      export_protein_fasta: ['exported_proteins.fasta'],
      export_current_view_fasta: ['exported_region.fasta'],
    };

    // Fallback scoring: 3 points for correct tool, 1 point for execution success
    results.forEach((result, index) => {
      if (!result || !result.tool_name) {
        console.log(`⚠️ [DataExportWorkflow] Result ${index} missing tool_name`);
        return;
      }

      const toolName = result.tool_name;
      evaluation.details.toolsExecuted.push(toolName);

      const matchedKey = Object.keys(expectedTools).find(key => this.matchToolName(toolName, key));
      if (matchedKey) {
        // Correct tool: +3 points (Song's fallback criterion 1)
        evaluation.score += 3;
        console.log(`✅ [DataExportWorkflow] Correct tool: ${toolName} (+3 points)`);

        // Check execution success: +1 point (Song's fallback criterion 2)
        const hasSuccessSignal = this.checkToolExecutionSuccess(result, toolName);
        if (hasSuccessSignal) {
          evaluation.score += 1;
          console.log(`✅ [DataExportWorkflow] Tool execution success: ${toolName} (+1 point)`);
        } else {
          console.log(`❌ [DataExportWorkflow] No execution success signal: ${toolName}`);
        }
      } else {
        evaluation.warnings.push(`Unexpected tool executed: ${toolName}`);
        console.log(`⚠️ [DataExportWorkflow] Unexpected tool: ${toolName}`);
      }
    });

    // Calculate success based on fallback scoring (4+ points to pass)
    evaluation.success = evaluation.score >= 4;
    evaluation.score = Math.min(evaluation.score, evaluation.maxScore);

    console.log(`🎯 [DataExportWorkflow] Structured tool evaluation complete:`, {
      score: evaluation.score,
      maxScore: evaluation.maxScore,
      success: evaluation.success,
      filesExported: evaluation.details.successfulExports,
      toolsExecuted: evaluation.details.toolsExecuted.length,
    });

    return evaluation;
  }
  parseNaturalLanguageExportResponse(actualResult, expectedResult, testResult, evaluation) {
    let responseText = '';

    // Extract text from various response formats
    if (typeof actualResult === 'string') {
      responseText = actualResult;
    } else if (actualResult && actualResult.response) {
      responseText = actualResult.response;
    } else if (actualResult && actualResult.message) {
      responseText = actualResult.message;
    } else {
      responseText = JSON.stringify(actualResult);
    }

    console.log('📄 [DataExportWorkflow] Parsing response text:', responseText.substring(0, 500));

    // Expected files and their success indicators
    const expectedFiles = expectedResult.expectedFiles || [];
    const pointsPerFile = Math.floor(evaluation.maxScore / evaluation.details.totalExpectedFiles);

    // Check for each expected file export success
    expectedFiles.forEach(fileName => {
      const patterns = [
        new RegExp(`${fileName}.*created`, 'i'),
        new RegExp(`created.*${fileName}`, 'i'),
        new RegExp(`exported.*${fileName}`, 'i'),
        new RegExp(`saved.*${fileName}`, 'i'),
        new RegExp(`${fileName.replace('.', '\\.')}`, 'i'),
      ];

      const found = patterns.some(pattern => pattern.test(responseText));

      if (found) {
        evaluation.details.filesExported.push(fileName);
        evaluation.details.successfulExports++;
        evaluation.score += pointsPerFile;
        console.log(`✅ [DataExportWorkflow] Export detected: ${fileName} (+${pointsPerFile} points)`);
      } else {
        console.log(`❌ [DataExportWorkflow] Export not detected: ${fileName}`);
      }
    });

    // General export success patterns
    const generalSuccessPatterns = [
      /export.*completed successfully/i,
      /all.*files.*exported/i,
      /export.*workflow.*complete/i,
      /task.*completed.*export/i,
    ];

    const hasGeneralSuccess = generalSuccessPatterns.some(pattern => pattern.test(responseText));
    if (hasGeneralSuccess) {
      evaluation.score += 2; // Bonus for general success indication
      console.log(`✅ [DataExportWorkflow] General export success detected (+2 bonus points)`);
    }

    // Calculate success based on export detection
    const successRate = evaluation.details.successfulExports / evaluation.details.totalExpectedFiles;
    evaluation.success = successRate >= BenchmarkEvaluatorBase.THRESHOLDS.FILE_EXPORT_PASS;

    // Cap score at maximum
    evaluation.score = Math.min(evaluation.score, evaluation.maxScore);

    console.log(`🎯 [DataExportWorkflow] Natural language parsing results:`, {
      score: evaluation.score,
      maxScore: evaluation.maxScore,
      filesExported: evaluation.details.successfulExports,
      totalFiles: evaluation.details.totalExpectedFiles,
      successRate: (successRate * 100).toFixed(1) + '%',
      success: evaluation.success,
    });

    return evaluation;
  }

  /**
   * Check if target export file exists (Song's file-priority system)
   */
  async checkTargetFileExists(filePath) {
    console.log(`🔍 [checkTargetFileExists] Checking file existence: ${filePath}`);

    return this.checkFileExists(filePath);
  }

  /**
   * Check if tool execution was successful (Song's fallback criterion)
   */
  checkToolExecutionSuccess(actualResult, expectedToolName) {
    const trackerResult = this.checkToolExecutionTracker(expectedToolName, BenchmarkEvaluatorBase.TIMEOUTS.DEFAULT);
    if (trackerResult.found && trackerResult.status === 'completed') {
      console.log(` [checkToolExecutionSuccess] Tracker shows successful execution:`, trackerResult.execution);
      return true;
    }

    // Method 2: Check for success patterns in response text
    if (typeof actualResult === 'string') {
      const successPatterns = [
        /tool execution completed.*succeeded/i,
        /successfully (executed|exported|created|generated)/i,
        /export.*completed successfully/i,
        /file.*created successfully/i,
        /operation completed successfully/i,
      ];

      const hasSuccessPattern = successPatterns.some(pattern => pattern.test(actualResult));
      if (hasSuccessPattern) {
        console.log(`🔍 [checkToolExecutionSuccess] Success pattern found in response`);
        return true;
      }
    }

    // Method 3: Check if actualResult indicates successful tool execution
    if (actualResult && typeof actualResult === 'object' && actualResult.success === true) {
      console.log(`🔍 [checkToolExecutionSuccess] Result object indicates success`);
      return true;
    }

    return false;
  }

  async setup(context) {
    console.log('🔧 [AutomaticComplexSuite] Setting up Automatic Complex test suite...');

    // 清理导出文件防止假阳性
    // Clean up export files to prevent false positives
    await this.cleanupExportFiles();

    console.log('✅ [AutomaticComplexSuite] Setup completed');
  }

  /**
   * Evaluate multiple tab opening test with detailed scoring
   * Song's requirement: Complex scoring based on actual vs expected tab count
   * Expected: 3 tabs = 5 points, 2-4 tabs = 3 points, 1 tab = 2 points, 0 tabs = 0 points
   */
  async evaluateMultipleTabOpeningCall(actualResult, expectedResult, testResult) {
    const evaluation = {
      success: false,
      score: 0,
      maxScore: testResult.maxScore || 5,
      errors: [],
      warnings: [],
      details: {
        initialTabsCount: 0,
        finalTabsCount: 0,
        tabsOpened: 0,
        expectedTabsIncrease: expectedResult.expectedTabsIncrease || 3,
      },
    };

    console.log('🗂️ [evaluateMultipleTabOpeningCall] Evaluating multiple tab opening test:', {
      testId: testResult.testId,
      expectedTool: expectedResult.tool_name,
      expectedIncrease: evaluation.details.expectedTabsIncrease,
      actualResult: actualResult,
    });

    if (!actualResult) {
      evaluation.errors.push('No result obtained from test execution');
      return evaluation;
    }

    // Get tabs count through genomeBrowser.tabManager
    try {
      if (window.genomeBrowser && window.genomeBrowser.tabManager) {
        evaluation.details.finalTabsCount = window.genomeBrowser.tabManager.tabs.size;

        // Try to estimate initial count (this is a limitation - we don't have before/after tracking)
        // For complex tests, we assume reasonable initial state or check from tool execution results
        if (Array.isArray(actualResult) && actualResult.length > 0) {
          // Multiple tool calls - number of successful calls
          const successfulCalls = actualResult.filter(
            call =>
              call &&
              this.matchToolName(call.tool_name, expectedResult.tool_name) &&
              !call.error &&
              call.success !== false
          ).length;
          evaluation.details.tabsOpened = successfulCalls;
          console.log('🗂️ [evaluateMultipleTabOpeningCall] Multiple calls detected:', {
            totalCalls: actualResult.length,
            successfulCalls: successfulCalls,
          });
        } else if (actualResult && this.matchToolName(actualResult.tool_name, expectedResult.tool_name)) {
          // Single tool call - assume 1 tab opened if successful
          evaluation.details.tabsOpened = !actualResult.error && actualResult.success !== false ? 1 : 0;
          console.log('🗂️ [evaluateMultipleTabOpeningCall] Single call detected');
        } else {
          evaluation.details.tabsOpened = 0;
          console.log('🗂️ [evaluateMultipleTabOpeningCall] No valid tool calls detected');
        }

        console.log('🗂️ [evaluateMultipleTabOpeningCall] Tab analysis:', {
          finalTabsCount: evaluation.details.finalTabsCount,
          estimatedTabsOpened: evaluation.details.tabsOpened,
          expectedIncrease: evaluation.details.expectedTabsIncrease,
        });
      } else {
        evaluation.warnings.push('TabManager not available for verification');
        // Fallback: analyze actualResult structure
        if (Array.isArray(actualResult)) {
          evaluation.details.tabsOpened = actualResult.filter(
            call => call && this.matchToolName(call.tool_name, expectedResult.tool_name)
          ).length;
        } else if (actualResult && this.matchToolName(actualResult.tool_name, expectedResult.tool_name)) {
          evaluation.details.tabsOpened = 1;
        }
      }
    } catch (error) {
      console.warn('⚠️ [evaluateMultipleTabOpeningCall] Could not access TabManager:', error.message);
      evaluation.warnings.push('Could not verify tab count directly');

      // Fallback analysis based on actualResult structure
      if (Array.isArray(actualResult)) {
        evaluation.details.tabsOpened = actualResult.filter(
          call => call && this.matchToolName(call.tool_name, expectedResult.tool_name)
        ).length;
      } else if (actualResult && this.matchToolName(actualResult.tool_name, expectedResult.tool_name)) {
        evaluation.details.tabsOpened = 1;
      }
    }

    // Song's complex scoring system
    const tabsOpened = evaluation.details.tabsOpened;
    const expectedIncrease = evaluation.details.expectedTabsIncrease;

    if (tabsOpened === expectedIncrease) {
      // Perfect match: full score (5 points)
      evaluation.score = 5;
      evaluation.success = true;
      evaluation.warnings.push(`Perfect! Opened exactly ${expectedIncrease} tabs as expected`);
      console.log('🎯 [evaluateMultipleTabOpeningCall] Perfect score - exact match!');
    } else if (tabsOpened >= 2 && tabsOpened <= 4) {
      // Close to target: 3 points
      evaluation.score = 3;
      evaluation.success = true;
      evaluation.warnings.push(`Good! Opened ${tabsOpened} tabs (expected ${expectedIncrease})`);
      console.log('👍 [evaluateMultipleTabOpeningCall] Good score - close to target');
    } else if (tabsOpened === 1) {
      // Opened at least one: 2 points
      evaluation.score = 2;
      evaluation.success = false; // Below passing threshold for complex tests
      evaluation.warnings.push(`Partial! Opened ${tabsOpened} tab (expected ${expectedIncrease})`);
      console.log('⚠️ [evaluateMultipleTabOpeningCall] Partial score - opened some tabs');
    } else {
      // No tabs opened: 0 points
      evaluation.score = 0;
      evaluation.success = false;
      evaluation.errors.push(`Failed to open any tabs (expected ${expectedIncrease})`);
      console.log('❌ [evaluateMultipleTabOpeningCall] No score - no tabs opened');
    }

    // Additional check: Look for success patterns in response
    if (typeof actualResult === 'string') {
      const multiTabPatterns = [
        /opened.*three.*tabs?/i,
        /created.*3.*tabs?/i,
        /three.*tabs?.*opened/i,
        /tabs?.*opened.*successfully/i,
      ];

      const hasMultiTabPattern = multiTabPatterns.some(pattern => pattern.test(actualResult));
      if (hasMultiTabPattern && evaluation.score < 5) {
        evaluation.score = Math.max(evaluation.score, 3); // At least good score
        evaluation.warnings.push('Multiple tab opening detected from response text');
        console.log('🔍 [evaluateMultipleTabOpeningCall] Multi-tab pattern detected in response');
      }
    }

    let scoringReason = 'Failed';
    if (evaluation.score === 5) {
      scoringReason = 'Perfect match';
    } else if (evaluation.score === 3) {
      scoringReason = 'Close to target';
    } else if (evaluation.score === 2) {
      scoringReason = 'Partial success';
    }

    console.log('🏁 [evaluateMultipleTabOpeningCall] Final evaluation:', {
      score: evaluation.score,
      maxScore: evaluation.maxScore,
      success: evaluation.success,
      tabsOpened: evaluation.details.tabsOpened,
      expectedIncrease: evaluation.details.expectedTabsIncrease,
      scoringReason,
    });

    return evaluation;
  }

  async cleanup(context) {
    console.log('Cleaning up Automatic Complex test suite');
  }
}

// Make the class available globally
window.AutomaticComplexSuite = AutomaticComplexSuite;
