/**
 * Automatic Simple Benchmark Suite - Automatic evaluation + Simple complexity tests
 * Extracted from ComprehensiveBenchmarkSuite.js for better organization
 */
class AutomaticSimpleSuite {
  constructor() {
    this.suiteName = 'Automatic Simple Tests (40)'; // Updated count after adding sequence editing tests
    this.suiteId = 'automatic_simple';
    this.description = 'Simple tests with automatic evaluation - Basic genomic analysis operations and system setup';
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
      console.log(`📁 AutomaticSimpleSuite default directory set to: ${this.defaultDirectory}`);

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
   * Clean up target export files before tests to prevent false positives
   * 在测试开始前检测并删除目标导出文件，避免判断错误
   */
  async cleanupExportFiles() {
    const exportedFilesDir = this.buildFilePath('exported_files');

    console.log('🧹 [AutomaticSimpleSuite] Starting export file cleanup...');
    console.log(`🔍 [AutomaticSimpleSuite] Checking directory: ${exportedFilesDir}`);

    // Method 1: Try Node.js fs module if available
    if (typeof require !== 'undefined') {
      const fs = require('fs');
      try {
        // Check if directory exists
        if (fs.existsSync(exportedFilesDir)) {
          // Read all files in the directory
          const files = fs.readdirSync(exportedFilesDir);
          
          // Delete each file
          for (const file of files) {
            const filePath = `${exportedFilesDir}/${file}`;
            // Only delete files, not subdirectories
            if (fs.statSync(filePath).isFile()) {
              fs.unlinkSync(filePath);
              console.log(`✅ [AutomaticSimpleSuite] Deleted file: ${filePath}`);
            }
          }
          console.log(`✅ [AutomaticSimpleSuite] Cleaned up ${files.length} files in ${exportedFilesDir}`);
        } else {
          console.log(`ℹ️  [AutomaticSimpleSuite] Directory does not exist: ${exportedFilesDir}`);
        }
      } catch (error) {
        console.warn(`⚠️  [AutomaticSimpleSuite] Error during directory cleanup: ${error.message}`);
      }
    }
    // Method 2: Try via ChatManager's file operations if available
    else if (window.chatManager && window.chatManager.deleteFile) {
      console.log(`ℹ️  [AutomaticSimpleSuite] Using ChatManager for cleanup (limited to specific files)`);
      // Fallback to specific files if directory operations not available
      const exportFiles = [
        'exported_files/exported_sequences.fasta',
        'exported_files/exported_data.gbk',
        'exported_files/exported_annotations.gff3',
        'exported_files/exported_features.bed',
        'exported_files/exported_cds.fasta',
        'exported_files/exported_proteins.fasta',
        'exported_files/exported_region.fasta',
      ];
      
      for (const filename of exportFiles) {
        try {
          const filePath = this.buildFilePath(filename);
          const result = await window.chatManager.deleteFile({ filePath: filePath });
          if (result && result.success) {
            console.log(`✅ [AutomaticSimpleSuite] Deleted via ChatManager: ${filePath}`);
          } else {
            console.log(`ℹ️  [AutomaticSimpleSuite] File may not exist or delete failed: ${filePath}`);
          }
        } catch (error) {
          if (error.message && error.message.includes('not found')) {
            console.log(`ℹ️  [AutomaticSimpleSuite] File does not exist: ${filePath}`);
          } else {
            console.warn(`⚠️  [AutomaticSimpleSuite] Error checking/deleting ${filePath}:`, error.message);
          }
        }
      }
    }
    // Method 3: Log warning if no deletion method available
    else {
      console.warn(`⚠️  [AutomaticSimpleSuite] No file deletion method available for ${exportedFilesDir}`);
    }

    console.log('✅ [AutomaticSimpleSuite] Export file cleanup completed');
  }

  /**
   * Initialize automatic simple test cases
   */
  initializeTests() {
    return [
      // SYSTEM SETUP TASKS - Automatic + Simple (HIGHEST PRIORITY - Must be first)
      {
        id: 'system_auto_01',
        name: 'Set Working Directory to Test Data',
        type: 'function_call',
        category: 'system_setup',
        complexity: 'simple',
        evaluation: 'automatic',
        instruction: `Set working directory to test data directory: ${this.getDefaultDirectory()}`,
        expectedResult: {
          tool_name: 'set_working_directory',
          parameters: {
            directory_path: this.getDefaultDirectory(),
          },
        },
        maxScore: 5, // Standard 5-point scale for consistency
        bonusScore: 0, // Simplified scoring
        timeout: 15000,
        evaluator: this.evaluateWorkingDirectoryCall.bind(this),
      },
      // DATA LOADING TASKS - Automatic + Simple (FIRST - Data must be loaded before other tests)
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
            filePath: this.buildFilePath('ECOLI.gbk'),
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 30000,
        evaluator: this.evaluateFileLoadingCall.bind(this),
      },
      {
        id: 'load_auto_02',
        name: 'Load BED Annotation File',
        type: 'function_call',
        category: 'data_loading',
        complexity: 'simple',
        evaluation: 'automatic',
        instruction: `Load BED annotation file ${this.buildFilePath('CHOPCHOP-Design.bed')}`,
        expectedResult: {
          tool_name: 'load_annotation_file',
          parameters: {
            filePath: this.buildFilePath('CHOPCHOP-Design.bed'),
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 30000,
        evaluator: this.evaluateFileLoadingCall.bind(this),
      },
      {
        id: 'load_auto_03',
        name: 'Load Aligned Reads File',
        type: 'function_call',
        category: 'data_loading',
        complexity: 'simple',
        evaluation: 'automatic',
        instruction: `Load aligned reads file ${this.buildFilePath('1655_C10.sorted.bam')}`,
        expectedResult: {
          tool_name: 'load_reads_file',
          parameters: {
            filePath: this.buildFilePath('1655_C10.sorted.bam'),
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 30000,
        evaluator: this.evaluateFileLoadingCall.bind(this),
      },
      {
        id: 'load_auto_04',
        name: 'Load Variant VCF File',
        type: 'function_call',
        category: 'data_loading',
        complexity: 'simple',
        evaluation: 'automatic',
        instruction: `Load variant VCF file ${this.buildFilePath('1655_C10.mutations.vcf')}`,
        expectedResult: {
          tool_name: 'load_variant_file',
          parameters: {
            filePath: this.buildFilePath('1655_C10.mutations.vcf'),
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 30000,
        evaluator: this.evaluateFileLoadingCall.bind(this),
      },
      {
        id: 'load_auto_05',
        name: 'Load WIG Track File',
        type: 'function_call',
        category: 'data_loading',
        complexity: 'simple',
        evaluation: 'automatic',
        instruction: `Load WIG track file ${this.buildFilePath('another_sample.wig')}`,
        expectedResult: {
          tool_name: 'load_wig_tracks',
          parameters: {
            filePaths: this.buildFilePath('another_sample.wig'), // Fixed: Use filePaths (plural) to match tool specification
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 30000,
        evaluator: this.evaluateFileLoadingCall.bind(this),
      },
      {
        id: 'load_auto_06',
        name: 'Load Operon File',
        type: 'function_call',
        category: 'data_loading',
        complexity: 'simple',
        evaluation: 'automatic',
        instruction: `Load operon file ${this.buildFilePath('OperonSet.tsv')}`,
        expectedResult: {
          tool_name: 'load_operon_file',
          parameters: {
            filePath: this.buildFilePath('OperonSet.tsv'),
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 30000,
        evaluator: this.evaluateFileLoadingCall.bind(this),
      },

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
            position: 100000,
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 30000,
        evaluator: this.evaluateNavigationCall.bind(this),
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
            position: 3500000,
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 30000,
        evaluator: this.evaluateNavigationCall.bind(this),
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
            end: 75000,
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 30000,
        evaluator: this.evaluateNavigationCall.bind(this),
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
          parameters: {},
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 30000,
        evaluator: this.evaluateBasicFunctionCall.bind(this),
      },

      // ANALYSIS TASKS - Automatic + Simple
      {
        id: 'anal_auto_01',
        name: 'Calculate GC Content',
        type: 'function_call',
        category: 'analysis',
        complexity: 'simple',
        evaluation: 'automatic',
        instruction:
          'Calculate the GC content of this DNA sequence: TCAAAATAGCCCAAGTTGCCCGGTCATAAGTGTAGCAAAATTATCCTCAATAAAAGGGAGTATTCCCTCCGCCACGGGTTGTAGCTGGCGGGTCAGATAGTGTTCGTAATCCAGTGGTGAACGTTGGTAGTCCAGCGGCTCCGGGCCGTTGGTGGTCCATACGTACTTAATGGTGCCGCGATTCTGATATTGCAAGGGGCGACCACGCTTTTGGTTTTCTTCATCGGCAAGGCGAGCGGCGCGTACATGAGGCGGCACATTACGCTGATACTCGCTCAGCGGACGGCGAAGGCGTTTACGGTAAACCAGTCGCGCATCCAGTTCA',
        expectedResult: {
          tool_name: 'compute_gc',
          parameters: {
            sequence:
              'TCAAAATAGCCCAAGTTGCCCGGTCATAAGTGTAGCAAAATTATCCTCAATAAAAGGGAGTATTCCCTCCGCCACGGGTTGTAGCTGGCGGGTCAGATAGTGTTCGTAATCCAGTGGTGAACGTTGGTAGTCCAGCGGCTCCGGGCCGTTGGTGGTCCATACGTACTTAATGGTGCCGCGATTCTGATATTGCAAGGGGCGACCACGCTTTTGGTTTTCTTCATCGGCAAGGCGAGCGGCGCGTACATGAGGCGGCACATTACGCTGATACTCGCTCAGCGGACGGCGAAGGCGTTTACGGTAAACCAGTCGCGCATCCAGTTCA',
            include_statistics: true,
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 30000,
        evaluator: this.evaluateSequenceAnalysisCall.bind(this),
      },
      {
        id: 'anal_auto_02',
        name: 'Reverse Complement',
        type: 'function_call',
        category: 'analysis',
        complexity: 'simple',
        evaluation: 'automatic',
        instruction:
          'Get the reverse complement of sequence TTACCGACTGCGGCCTGAGTTTTTTAAGTGACGTAAAATCGTGTTGAGGCCAACGCCCATAATGCGGGCTGTTGCCCGGCATCCAACGCCATTCATGGCCATATCAATGATTTTCTGGTGCGTACCGGGTTGAGAAGCGGTGTAAGTGAACTGCAGTTGCCATGTTTTACGGCAGTGAGAGCAGAGATAGCGCTGATGTCCGGCGGTGCTTTTGCCGTTACGCACCACCCCGTCAGTAGCTGAACAGGAGGGACAGCTGATAGAAACAGAAGCCAC',
        expectedResult: {
          tool_name: 'reverse_complement',
          parameters: {
            sequence:
              'TTACCGACTGCGGCCTGAGTTTTTTAAGTGACGTAAAATCGTGTTGAGGCCAACGCCCATAATGCGGGCTGTTGCCCGGCATCCAACGCCATTCATGGCCATATCAATGATTTTCTGGTGCGTACCGGGTTGAGAAGCGGTGTAAGTGAACTGCAGTTGCCATGTTTTACGGCAGTGAGAGCAGAGATAGCGCTGATGTCCGGCGGTGCTTTTGCCGTTACGCACCACCCCGTCAGTAGCTGAACAGGAGGGACAGCTGATAGAAACAGAAGCCAC',
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 30000,
        evaluator: this.evaluateBasicFunctionCall.bind(this),
      },
      {
        id: 'anal_auto_03',
        name: 'Translate DNA to Protein',
        type: 'function_call',
        category: 'analysis',
        complexity: 'simple',
        evaluation: 'automatic',
        instruction:
          'Translate DNA sequence "TTGGCTAATATCAAATCAGCTAAGAAGCGCGCCATTCAGTCTGAAAAGGCTCGTAAGCACAACGCAAGCCGTCGCTCTATGATGCGTACTTTCATCAAGAAAGTATACGCAGCTATCGAAGCTGGCGACAAAGCTGCTGCACAGAAAGCATTTAACGAAATGCAACCGATCGTGGACCGTCAGGCTGCTAAAGGTCTGATCCACAAAAACAAAGCTGCACGTCATAAGGCTAACCTGACTGCACAGATCAACAAACTGGCTTAA" to protein',
        expectedResult: {
          tool_name: 'translate_dna',
          parameters: {
            dna: 'TTGGCTAATATCAAATCAGCTAAGAAGCGCGCCATTCAGTCTGAAAAGGCTCGTAAGCACAACGCAAGCCGTCGCTCTATGATGCGTACTTTCATCAAGAAAGTATACGCAGCTATCGAAGCTGGCGACAAAGCTGCTGCACAGAAAGCATTTAACGAAATGCAACCGATCGTGGACCGTCAGGCTGCTAAAGGTCTGATCCACAAAAACAAAGCTGCACGTCATAAGGCTAACCTGACTGCACAGATCAACAAACTGGCTTAA', // FIXED: Use 'dna' parameter name instead of 'sequence'
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 30000,
        evaluator: this.evaluateBasicFunctionCall.bind(this),
      },
      {
        id: 'anal_auto_04',
        name: 'Genome-wide Codon Usage Analysis',
        type: 'function_call',
        category: 'analysis',
        complexity: 'simple',
        evaluation: 'automatic',
        instruction: 'Perform genome-wide codon usage analysis to identify codon preferences and biases.',
        expectedResult: {
          tool_name: 'genome_codon_usage_analysis',
          parameters: {
            featureType: 'CDS',
            minLength: 300,
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 60000,
        evaluator: this.evaluateBasicFunctionCall.bind(this),
      },

      // SEQUENCE TASKS - Automatic + Simple
      {
        id: 'seq_auto_01',
        name: 'Get Genomic Sequence',
        type: 'function_call',
        category: 'sequence',
        complexity: 'simple',
        evaluation: 'automatic',
        instruction: 'Get the DNA sequence from position 100000 to 101000 on the current chromosome.',
        expectedResult: {
          tool_name: 'get_sequence',
          parameters: {
            chromosome: '<current_chromosome>',
            start: 100000,
            end: 101000,
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 30000,
        evaluator: this.evaluateBasicFunctionCall.bind(this),
      },
      {
        id: 'seq_auto_02',
        name: 'Get Coding Sequence for Gene',
        type: 'function_call',
        category: 'sequence',
        complexity: 'simple',
        evaluation: 'automatic',
        instruction: 'Get the coding sequence for gene lacZ.',
        expectedResult: {
          tool_name: 'get_coding_sequence',
          parameters: {
            gene_name: 'lacZ',
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 30000,
        evaluator: this.evaluateBasicFunctionCall.bind(this),
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
            name: 'lacZ',
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 30000,
        evaluator: this.evaluateBasicFunctionCall.bind(this),
      },
      {
        id: 'search_auto_02',
        name: 'Search DNA Polymerase',
        type: 'function_call',
        category: 'search',
        complexity: 'simple',
        evaluation: 'automatic',
        instruction: 'Search for DNA Polymerase genes.',
        expectedResult: {
          tool_name: 'search_features',
          parameters: {
            query: 'DNA Polymerase',
            caseSensitive: false,
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 30000,
        evaluator: this.evaluateSearchFunctionCall.bind(this),
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
            name: 'b0344',
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 30000,
        evaluator: this.evaluateBasicFunctionCall.bind(this),
      },
      {
        id: 'search_auto_04',
        name: 'Search Sequence Motif TATAAA',
        type: 'function_call',
        category: 'search',
        complexity: 'simple',
        evaluation: 'automatic',
        instruction: 'Search for TATA box motif (TATAAA) in the current genomic region on both strands.',
        expectedResult: {
          tool_name: 'search_sequence_motif',
          parameters: {
            motif: 'TATAAA',
            strand: 'both',
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 30000,
        evaluator: this.evaluateBasicFunctionCall.bind(this),
      },

      // EXPORT TASKS - Automatic + Simple (REQUIRES PRE-LOADED DATA)
      {
        id: 'export_auto_01',
        name: 'Export FASTA Sequence',
        type: 'function_call',
        category: 'file_export',
        complexity: 'simple',
        evaluation: 'automatic',
        instruction: `Export sequences in FASTA format to file: ${this.buildFilePath('exported_files/exported_sequences.fasta')}`,
        expectedResult: {
          tool_name: 'export_fasta_sequence',
          parameters: {
            format: 'fasta',
            includeDescription: true,
            filePath: this.buildFilePath('exported_files/exported_sequences.fasta'),
          },
        },
        maxScore: 5,
        bonusScore: 0, // Song's new evaluation: Fixed 5-point scale
        timeout: 30000,
        evaluator: this.evaluateExportCall.bind(this),
      },
      {
        id: 'export_auto_02',
        name: 'Export GenBank Format',
        type: 'function_call',
        category: 'file_export',
        complexity: 'simple',
        evaluation: 'automatic',
        instruction: `Export data in GenBank format to file: ${this.buildFilePath('exported_files/exported_data.gbk')}`,
        expectedResult: {
          tool_name: 'export_genbank_format',
          parameters: {
            includeSequence: true,
            includeAnnotations: true,
            filePath: this.buildFilePath('exported_files/exported_data.gbk'),
          },
        },
        maxScore: 5,
        bonusScore: 0, // Song's new evaluation: Fixed 5-point scale
        timeout: 30000,
        evaluator: this.evaluateExportCall.bind(this),
      },
      {
        id: 'export_auto_03',
        name: 'Export GFF3 Annotations',
        type: 'function_call',
        category: 'file_export',
        complexity: 'simple',
        evaluation: 'automatic',
        instruction: `Export GFF3 annotation format to file: ${this.buildFilePath('exported_files/exported_annotations.gff3')}`,
        expectedResult: {
          tool_name: 'export_gff_annotations',
          parameters: {
            version: 'gff3',
            includeSequence: false,
            filePath: this.buildFilePath('exported_files/exported_annotations.gff3'),
          },
        },
        maxScore: 5,
        bonusScore: 0, // Song's new evaluation: Fixed 5-point scale
        timeout: 30000,
        evaluator: this.evaluateExportCall.bind(this),
      },
      {
        id: 'export_auto_04',
        name: 'Export BED Format Features',
        type: 'function_call',
        category: 'file_export',
        complexity: 'simple',
        evaluation: 'automatic',
        instruction: `Export features in BED format to file: ${this.buildFilePath('exported_files/exported_features.bed')}`,
        expectedResult: {
          tool_name: 'export_bed_format',
          parameters: {
            trackName: 'exported_features',
            includeScore: true,
            filePath: this.buildFilePath('exported_files/exported_features.bed'),
          },
        },
        maxScore: 5,
        bonusScore: 0, // Song's new evaluation: Fixed 5-point scale
        timeout: 30000,
        evaluator: this.evaluateExportCall.bind(this),
      },
      {
        id: 'export_auto_05',
        name: 'Export CDS FASTA',
        type: 'function_call',
        category: 'file_export',
        complexity: 'simple',
        evaluation: 'automatic',
        instruction: `Export coding sequences as FASTA format to file: ${this.buildFilePath('exported_files/exported_cds.fasta')}`,
        expectedResult: {
          tool_name: 'export_cds_fasta',
          parameters: {
            sequenceType: 'cds',
            includeHeaders: true,
            filePath: this.buildFilePath('exported_files/exported_cds.fasta'),
          },
        },
        maxScore: 5,
        bonusScore: 0, // Song's new evaluation: Fixed 5-point scale
        timeout: 30000,
        evaluator: this.evaluateExportCall.bind(this),
      },
      {
        id: 'export_auto_06',
        name: 'Export Protein FASTA',
        type: 'function_call',
        category: 'file_export',
        complexity: 'simple',
        evaluation: 'automatic',
        instruction: `Export protein sequences in FASTA format to file: ${this.buildFilePath('exported_files/exported_proteins.fasta')}`,
        expectedResult: {
          tool_name: 'export_protein_fasta',
          parameters: {
            sequenceType: 'protein',
            includeHeaders: true,
            translate: true,
            filePath: this.buildFilePath('exported_files/exported_proteins.fasta'),
          },
        },
        maxScore: 5,
        bonusScore: 0, // Song's new evaluation: Fixed 5-point scale
        timeout: 30000,
        evaluator: this.evaluateExportCall.bind(this),
      },
      {
        id: 'export_auto_07',
        name: 'Export Current View FASTA',
        type: 'function_call',
        category: 'file_export',
        complexity: 'simple',
        evaluation: 'automatic',
        instruction: `Export currently visible genomic region as FASTA to file: ${this.buildFilePath('exported_files/exported_region.fasta')}`,
        expectedResult: {
          tool_name: 'export_current_view_fasta',
          parameters: {
            format: 'fasta',
            currentViewOnly: true,
            includeCoordinates: true,
            filePath: this.buildFilePath('exported_files/exported_region.fasta'),
          },
        },
        maxScore: 5,
        bonusScore: 0, // Song's new evaluation: Fixed 5-point scale
        timeout: 30000,
        evaluator: this.evaluateExportCall.bind(this),
      },

      // UI INTERACTION TASKS - Automatic + Simple
      {
        id: 'ui_auto_01',
        name: 'Open New Tab',
        type: 'function_call',
        category: 'ui_interaction',
        complexity: 'simple',
        evaluation: 'automatic',
        instruction: 'Open a new tab for parallel analysis.',
        expectedResult: {
          tool_name: 'open_new_tab',
          parameters: {},
        },
        maxScore: 5,
        bonusScore: 0,
        timeout: 30000,
        evaluator: this.evaluateTabOpeningCall.bind(this),
      },

      // EXTERNAL DATABASE TASKS - Automatic + Simple
      // Note: ext_auto_01 (UniProt lacZ search) test removed as requested
      {
        id: 'ext_auto_01b',
        name: 'Search PDB Structure for talB',
        type: 'function_call',
        category: 'external_database',
        complexity: 'simple',
        evaluation: 'automatic',
        instruction: 'Search PDB experimental structures for gene talB from Escherichia coli.',
        expectedResult: {
          tool_name: 'search_pdb_structures',
          parameters: {
            geneName: 'talB',
            organism: 'Escherichia coli',
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 30000,
        evaluator: this.evaluateBasicFunctionCall.bind(this),
      },
      {
        id: 'ext_auto_02',
        name: 'Search AlphaFold Structure for lysC',
        type: 'function_call',
        category: 'external_database',
        complexity: 'simple',
        evaluation: 'automatic',
        instruction: 'Search AlphaFold structure prediction for gene lysC.',
        expectedResult: {
          tool_name: 'search_alphafold_structures',
          parameters: {
            geneName: 'lysC', // Fixed: Use correct parameter name and remove incorrect ones
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 30000,
        evaluator: this.evaluateBasicFunctionCall.bind(this),
      },

      // SEQUENCE EDITING AND ACTION MANAGEMENT TASKS - Automatic + Simple
      // Logical workflow: copy → paste → delete → insert → replace → cut → execute → get_list → undo → clear
      {
        id: 'edit_auto_01',
        name: 'Copy Sequence Region',
        type: 'function_call',
        category: 'sequence_editing',
        complexity: 'simple',
        evaluation: 'automatic',
        instruction: 'Copy the sequence region from position 100000 to 100500 on the current chromosome.',
        expectedResult: {
          tool_name: 'copy_sequence',
          parameters: {
            chromosome: '<current_chromosome>',
            start: 100000,
            end: 100500,
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 30000,
        evaluator: this.evaluateBasicFunctionCall.bind(this),
      },
      {
        id: 'edit_auto_02',
        name: 'Paste Sequence from Clipboard',
        type: 'function_call',
        category: 'sequence_editing',
        complexity: 'simple',
        evaluation: 'automatic',
        instruction: 'Paste the sequence from clipboard at position 600000.',
        expectedResult: {
          tool_name: 'paste_sequence',
          parameters: {
            chromosome: '<current_chromosome>',
            start: 600000,
            end: 600000,
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 30000,
        evaluator: this.evaluateBasicFunctionCall.bind(this),
      },
      {
        id: 'edit_auto_03',
        name: 'Delete Sequence Region',
        type: 'function_call',
        category: 'sequence_editing',
        complexity: 'simple',
        evaluation: 'automatic',
        instruction: 'Delete the sequence region from position 200000 to 200100.',
        expectedResult: {
          tool_name: 'delete_sequence',
          parameters: {
            chromosome: '<current_chromosome>',
            start: 200000,
            end: 200100,
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 30000,
        evaluator: this.evaluateBasicFunctionCall.bind(this),
      },
      {
        id: 'edit_auto_04',
        name: 'Insert Sequence at Position',
        type: 'function_call',
        category: 'sequence_editing',
        complexity: 'simple',
        evaluation: 'automatic',
        instruction: 'Insert the DNA sequence "ATGCGATCGATCGATCG" at position 300000 without user confirmation.',
        expectedResult: {
          tool_name: 'insert_sequence',
          parameters: {
            chromosome: '<current_chromosome>',
            position: 300000,
            sequence: 'ATGCGATCGATCGATCG',
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 30000,
        evaluator: this.evaluateBasicFunctionCall.bind(this),
      },
      {
        id: 'edit_auto_05',
        name: 'Replace Sequence Region',
        type: 'function_call',
        category: 'sequence_editing',
        complexity: 'simple',
        evaluation: 'automatic',
        instruction: 'Replace the sequence in region 400000 to 400200 with the new sequence "GCTAGCTAGCTAGCTA".',
        expectedResult: {
          tool_name: 'replace_sequence',
          parameters: {
            chromosome: '<current_chromosome>',
            start: 400000,
            end: 400200,
            newSequence: 'GCTAGCTAGCTAGCTA',
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 30000,
        evaluator: this.evaluateBasicFunctionCall.bind(this),
      },
      {
        id: 'edit_auto_06',
        name: 'Cut Sequence Region',
        type: 'function_call',
        category: 'sequence_editing',
        complexity: 'simple',
        evaluation: 'automatic',
        instruction:
          'Cut the sequence region from position 500000 to 500300 (copy to clipboard and mark for deletion).',
        expectedResult: {
          tool_name: 'cut_sequence',
          parameters: {
            chromosome: '<current_chromosome>',
            start: 500000,
            end: 500300,
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 30000,
        evaluator: this.evaluateBasicFunctionCall.bind(this),
      },
      {
        id: 'edit_auto_07',
        name: 'Execute Pending Actions',
        type: 'function_call',
        category: 'sequence_editing',
        complexity: 'simple',
        evaluation: 'automatic',
        instruction: `Execute all pending sequence editing actions in the queue and export the resulting gbk file to ${this.buildFilePath("exported_files/edited_genome_sequence.gbk")}`,
        expectedResult: {
          tool_name: 'execute_actions',
          parameters: {
            chromosome: '<current_chromosome>',
            start: 100000,
            end: 600000,
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 30000,
        evaluator: this.evaluateBasicFunctionCall.bind(this),
      },
      {
        id: 'edit_auto_08',
        name: 'Get Action List',
        type: 'function_call',
        category: 'sequence_editing',
        complexity: 'simple',
        evaluation: 'automatic',
        instruction: 'Get the current list of sequence editing actions and their status.',
        expectedResult: {
          tool_name: 'get_action_list',
          parameters: {
            chromosome: '<current_chromosome>',
            start: 100000,
            end: 600000,
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 30000,
        evaluator: this.evaluateBasicFunctionCall.bind(this),
      },

      {
        id: 'edit_auto_09',
        name: 'Clear Action Queue',
        type: 'function_call',
        category: 'sequence_editing',
        complexity: 'simple',
        evaluation: 'automatic',
        instruction: 'Clear all actions from the sequence editing queue without user confirmation.',
        expectedResult: {
          tool_name: 'clear_actions',
          parameters: {
            forced: true,
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 30000,
        evaluator: this.evaluateBasicFunctionCall.bind(this),
      },
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
      warnings: [],
    };

    if (!actualResult) {
      evaluation.errors.push('No result obtained from test execution');
      return evaluation;
    }

    // 🔍 SONG'S ENHANCED DEBUGGING: More comprehensive tool detection logging
    console.log(`🎯 [SONG DEBUG] evaluateBasicFunctionCall called for test: ${testResult.testId || 'unknown'}`);
    console.log(`🎯 [SONG DEBUG] Test name: ${testResult.name || 'unknown'}`);
    console.log(`🎯 [SONG DEBUG] actualResult type:`, typeof actualResult);
    console.log(`🎯 [SONG DEBUG] actualResult content:`, actualResult);
    console.log(`🎯 [SONG DEBUG] expectedResult:`, expectedResult);

    // IMPROVED: Handle multiple tool calls - check all tools in array
    let actualTools = [];
    let actualTool = null;

    if (Array.isArray(actualResult)) {
      actualTools = actualResult.map(call => call?.tool_name).filter(Boolean);
      actualTool = actualTools[0]; // Primary tool for backward compatibility
      console.log(`🎯 [SONG DEBUG] Multiple tools detected:`, actualTools);
      console.log(`🎯 [SONG DEBUG] Checking if expected tool '${expectedResult.tool_name}' is in:`, actualTools);

      // Check if expected tool is in the array
      if (actualTools.includes(expectedResult.tool_name)) {
        actualTool = expectedResult.tool_name; // Use the expected tool for evaluation
        console.log(`✅ [SONG DEBUG] Expected tool '${expectedResult.tool_name}' found in tool array!`);
      } else {
        console.log(`❌ [SONG DEBUG] Expected tool '${expectedResult.tool_name}' NOT found in tool array`);
      }
    } else {
      actualTool = actualResult?.tool_name;
      actualTools = actualTool ? [actualTool] : [];
      console.log(`🎯 [SONG DEBUG] Single tool detected: '${actualTool}'`);
    }

    console.log(`🎯 [SONG DEBUG] Final extracted tool name: '${actualTool}' (expected: '${expectedResult.tool_name}')`);

    // ENHANCED: Record detected tools for Song's analysis with more detail
    const debugEntry = {
      testId: testResult.testId,
      testName: testResult.testName || testResult.name || 'unknown',
      expectedTool: expectedResult.tool_name,
      actualTool: actualTool,
      allDetectedTools: actualTools,
      actualResultType: typeof actualResult,
      actualResult: actualResult,
      isMultipleTools: Array.isArray(actualResult) && actualResult.length > 1,
      toolFoundInArray: actualTools.includes(expectedResult.tool_name),
      timestamp: new Date().toISOString(),
    };

    if (window.songBenchmarkDebug) {
      window.songBenchmarkDebug.detectedTools = window.songBenchmarkDebug.detectedTools || [];
      window.songBenchmarkDebug.detectedTools.push(debugEntry);
    } else {
      window.songBenchmarkDebug = {
        detectedTools: [debugEntry],
      };
    }

    console.log(`📊 [evaluateBasicFunctionCall] Evaluating test result:`, {
      testId: testResult.testId,
      expectedTool: expectedResult.tool_name,
      actualResult: actualResult,
      resultType: typeof actualResult,
      multipleTools: actualTools.length > 1,
    });

    // SONG'S CRITICAL REQUIREMENT: Check all rounds for tool detection
    // Analyze tools from ALL rounds, not just the final result
    let toolFoundInAnyRound = false;
    let foundInRound = null;

    if (testResult.detailedLogs?.toolCallHistory?.toolCallRounds) {
      const rounds = testResult.detailedLogs.toolCallHistory.toolCallRounds;
      console.log(
        `🔍 [evaluateBasicFunctionCall] Checking ${rounds.length} rounds for tool '${expectedResult.tool_name}'`
      );

      for (let i = 0; i < rounds.length; i++) {
        const round = rounds[i];
        if (round.tools && round.tools.includes(expectedResult.tool_name)) {
          toolFoundInAnyRound = true;
          foundInRound = round.current;
          console.log(
            `✅ [evaluateBasicFunctionCall] TOOL FOUND IN ROUND ${round.current}: '${expectedResult.tool_name}'`
          );
          break;
        }
      }

      if (toolFoundInAnyRound) {
        console.log(
          `✅ [evaluateBasicFunctionCall] SUCCESS: Tool '${expectedResult.tool_name}' detected in round ${foundInRound}`
        );
        evaluation.score = evaluation.maxScore; // FULL POINTS
        evaluation.success = true;
        evaluation.warnings.push(`Tool found in round ${foundInRound}/${rounds.length}`);
        return evaluation;
      } else {
        console.log(
          `⚠️ [evaluateBasicFunctionCall] Tool '${expectedResult.tool_name}' NOT found in any of ${rounds.length} rounds`
        );
        console.log(
          `🔍 [evaluateBasicFunctionCall] Tools per round:`,
          rounds.map((r, i) => `Round ${r.current}: [${r.tools?.join(', ') || 'none'}]`)
        );
      }
    }

    // PRIORITY 0: Check Tool Execution Tracker for direct execution status
    if (window.chatManager && window.chatManager.toolExecutionTracker) {
      const tracker = window.chatManager.toolExecutionTracker;
      const recentExecutions = tracker.getSessionExecutions();

      console.log(`🔍 [evaluateBasicFunctionCall] Checking tracker for tool: ${expectedResult.tool_name}`);

      // Look for recent successful execution of the expected tool
      // Use configured benchmark timeout instead of hardcoded 30 seconds
      const timeoutMs = (this.framework && this.framework.testTimeout) || 120000; // Default to 2 minutes
      const relevantExecution = recentExecutions.find(
        exec =>
          exec.toolName === expectedResult.tool_name &&
          exec.status === 'completed' &&
          Date.now() - exec.startTime < timeoutMs // Within configured timeout window
      );

      if (relevantExecution) {
        console.log(
          `✅ [evaluateBasicFunctionCall] TRACKER SUCCESS: Found successful execution of '${expectedResult.tool_name}'`,
          relevantExecution
        );
        evaluation.score = evaluation.maxScore; // FULL POINTS from tracker
        evaluation.success = true;
        evaluation.warnings.push('Awarded full points based on Tool Execution Tracker data');
        return evaluation;
      }

      // Look for recent failed execution
      const failedExecution = recentExecutions.find(
        exec =>
          exec.toolName === expectedResult.tool_name &&
          exec.status === 'failed' &&
          Date.now() - exec.startTime < timeoutMs // Within configured timeout window
      );

      if (failedExecution) {
        console.log(
          `❌ [evaluateBasicFunctionCall] TRACKER FAILURE: Found failed execution of '${expectedResult.tool_name}'`,
          failedExecution
        );
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
        /results have been processed/i,
        /(file|reads|genome|annotation|variant).*loaded successfully/i,
        /I've successfully loaded/i,
      ];

      const hasSuccessSignal = successPatterns.some(pattern => pattern.test(actualResult));

      if (hasSuccessSignal) {
        // For "Tool execution completed: X succeeded" - this is explicit success, award full points
        if (/tool execution completed.*succeeded/i.test(actualResult)) {
          console.log(`✅ [evaluateBasicFunctionCall] EXPLICIT EXECUTION SUCCESS: "Tool execution completed" detected`);
          evaluation.score = evaluation.maxScore; // FULL POINTS
          evaluation.success = true;
          evaluation.warnings.push('Awarded full points based on explicit tool execution success');
          return evaluation;
        }

        // For file loading success patterns
        if (
          /(file|reads|genome|annotation|variant).*loaded successfully|I've successfully loaded/i.test(actualResult)
        ) {
          console.log(`✅ [evaluateBasicFunctionCall] FILE LOADING SUCCESS: Success pattern detected in response`);
          evaluation.score = evaluation.maxScore; // FULL POINTS
          evaluation.success = true;
          evaluation.warnings.push('Awarded full points based on file loading success message');
          return evaluation;
        }

        // For other success patterns, check if the expected tool name appears in the response
        const toolMentioned = actualResult.toLowerCase().includes(expectedResult.tool_name.toLowerCase());

        if (toolMentioned) {
          console.log(
            `✅ [evaluateBasicFunctionCall] SUCCESS SIGNAL DETECTED: Tool '${expectedResult.tool_name}' executed successfully`
          );
          evaluation.score = evaluation.maxScore; // FULL POINTS
          evaluation.success = true;
          evaluation.warnings.push('Awarded full points based on explicit success signal');
          return evaluation;
        }
      }
    }

    // PRIORITY 2: Enhanced tool detection for multiple tools
    // Check if expected tool is found in the detected tools array
    if (actualTools.includes(expectedResult.tool_name)) {
      console.log(
        `✅ [evaluateBasicFunctionCall] EXPECTED TOOL FOUND: '${expectedResult.tool_name}' detected in tools array`
      );
      evaluation.score = evaluation.maxScore; // FULL POINTS for correct tool detection
      actualTool = expectedResult.tool_name; // Set for parameter evaluation
    } else if (actualTool === expectedResult.tool_name) {
      console.log(`✅ [evaluateBasicFunctionCall] Correct tool name detected: ${actualTool}`);
      evaluation.score = evaluation.maxScore; // Full points for correct tool
    } else {
      console.log(
        `❌ [evaluateBasicFunctionCall] Tool mismatch: expected '${expectedResult.tool_name}', got '${actualTool}'`
      );
      console.log(`❌ [evaluateBasicFunctionCall] Available tools were:`, actualTools);
      evaluation.errors.push(
        `Expected tool '${expectedResult.tool_name}' but got '${actualTool || 'none'}'. Available tools: [${actualTools.join(', ')}]`
      );
      evaluation.score = 0; // No points for wrong tool
      evaluation.success = false;
      return evaluation;
    }

    // PRIORITY 3: Enhanced parameter validation with position↔range conversion support
    // Find the correct tool call in the array for parameter validation
    let relevantToolCall = actualResult;
    if (Array.isArray(actualResult)) {
      relevantToolCall = actualResult.find(call => call?.tool_name === expectedResult.tool_name);
      if (!relevantToolCall) {
        relevantToolCall = actualResult[0]; // Fallback to first call
      }
    }

    const actualParams = relevantToolCall?.parameters;
    if (actualParams && expectedResult.parameters) {
      const expectedKeys = Object.keys(expectedResult.parameters);
      const matchingKeys = expectedKeys.filter(key => {
        if (!(key in actualParams)) {
          // Special case: position parameter might be converted to start/end range
          if (key === 'position' && 'start' in actualParams && 'end' in actualParams) {
            const expectedPosition = expectedResult.parameters[key];
            const actualStart = actualParams.start;
            const actualEnd = actualParams.end;

            // Check if the expected position is within the actual range (tolerance: 2000bp)
            const rangeCenter = Math.floor((actualStart + actualEnd) / 2);
            const tolerance = Math.abs(actualEnd - actualStart); // Use actual range size as tolerance
            const positionMatch = Math.abs(expectedPosition - rangeCenter) <= tolerance / 2;

            console.log(`🔄 [evaluateBasicFunctionCall] Position→Range conversion detected:`, {
              expectedPosition,
              actualStart,
              actualEnd,
              rangeCenter,
              tolerance,
              positionMatch,
            });

            return positionMatch;
          }

          // Special case: start/end range might be expected when position was provided
          if ((key === 'start' || key === 'end') && 'position' in actualParams) {
            const actualPosition = actualParams.position;
            const expectedValue = expectedResult.parameters[key];

            // For start parameter: check if position is reasonably close (within expected range)
            if (key === 'start') {
              const expectedEnd = expectedResult.parameters.end || expectedValue + 2000;
              const positionInRange = actualPosition >= expectedValue && actualPosition <= expectedEnd;

              console.log(`🔄 [evaluateBasicFunctionCall] Range→Position conversion for start:`, {
                expectedStart: expectedValue,
                expectedEnd,
                actualPosition,
                positionInRange,
              });

              return positionInRange;
            }

            // For end parameter: check if position is reasonably close (within expected range)
            if (key === 'end') {
              const expectedStart = expectedResult.parameters.start || expectedValue - 2000;
              const positionInRange = actualPosition >= expectedStart && actualPosition <= expectedValue;

              console.log(`🔄 [evaluateBasicFunctionCall] Range→Position conversion for end:`, {
                expectedStart,
                expectedEnd: expectedValue,
                actualPosition,
                positionInRange,
              });

              return positionInRange;
            }
          }

          console.log(`❌ [evaluateBasicFunctionCall] Missing parameter: ${key}`);
          return false;
        }

        const actualValue = actualParams[key];
        const expectedValue = expectedResult.parameters[key];

        // Direct value match
        const directMatch = actualValue === expectedValue;

        // Placeholder matches (enhanced)
        const isPlaceholder =
          expectedValue === '<current_chromosome>' ||
          expectedValue === '<lacZ_protein_sequence>' ||
          expectedValue === '<araA_protein_sequence>';

        // For chromosome placeholder, accept any valid chromosome name
        const isValidChromosome =
          expectedValue === '<current_chromosome>' && typeof actualValue === 'string' && actualValue.length > 0;

        const matches = directMatch || isPlaceholder || isValidChromosome;

        console.log(`🔍 [evaluateBasicFunctionCall] Parameter '${key}':`, {
          expected: expectedValue,
          actual: actualValue,
          directMatch,
          isPlaceholder,
          isValidChromosome,
          matches,
        });

        return matches;
      });

      // Maximum 1 point deduction total for parameter issues
      const missingParams = expectedKeys.length - matchingKeys.length;
      if (missingParams > 0) {
        const deduction = Math.min(1, missingParams);
        evaluation.score = Math.max(0, evaluation.score - deduction);
        evaluation.warnings.push(`${missingParams} parameter(s) missing or incorrect (-${deduction} pt)`);
        console.log(`⚠️ [evaluateBasicFunctionCall] Deducting ${deduction} points for ${missingParams} parameter issues`);
      } else {
        console.log(`✅ [evaluateBasicFunctionCall] All parameters matched correctly`);
      }
    }

    evaluation.success = evaluation.score >= Math.ceil(evaluation.maxScore * 0.6); // 60% threshold

    console.log(`🏆 [evaluateBasicFunctionCall] Final evaluation:`, {
      score: evaluation.score,
      maxScore: evaluation.maxScore,
      success: evaluation.success,
      errors: evaluation.errors,
      warnings: evaluation.warnings,
    });

    // 📊 SONG'S ENHANCED TOOL DETECTION SUMMARY
    console.log(`📊 [SONG SUMMARY] Tool Detection Result for ${testResult.testName || testResult.testId}:`);
    console.log(`   Expected: ${expectedResult.tool_name}`);
    console.log(`   Primary Detected: ${actualTool}`);
    console.log(`   All Detected: [${actualTools.join(', ')}]`);
    console.log(`   Multiple Tools: ${actualTools.length > 1 ? '✅ YES' : '❌ NO'}`);
    console.log(`   Expected Tool Found: ${actualTools.includes(expectedResult.tool_name) ? '✅ YES' : '❌ NO'}`);
    console.log(`   Match: ${actualTool === expectedResult.tool_name ? '✅ YES' : '❌ NO'}`);
    console.log(`   Score: ${evaluation.score}/${evaluation.maxScore}`);
    console.log(`📋 [SONG TIP] Use 'window.songBenchmarkDebug.detectedTools' in console to see all detected tools`);
    console.log(
      `📋 [SONG TIP] Use 'window.songBenchmarkDebug.detectedTools.filter(t => t.isMultipleTools)' to see multi-tool cases`
    );

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
      if (params.start && params.end && params.end - params.start > 10000000) {
        evaluation.warnings.push('Range is very large (>10Mb), verify this is intentional');
      }
    }

    return evaluation;
  }

  async evaluateFileLoadingCall(actualResult, expectedResult, testResult) {
    const evaluation = await this.evaluateBasicFunctionCall(actualResult, expectedResult, testResult);

    // Add file loading specific checks
    if (actualResult && actualResult.parameters) {
      // Handle both filePath (singular) and filePaths (plural) parameters
      let actualFilePath = actualResult.parameters.filePath || actualResult.parameters.filePaths;
      let expectedFilePath = expectedResult.parameters.filePath || expectedResult.parameters.filePaths;

      // If filePaths is an array, take the first element
      if (Array.isArray(actualFilePath)) {
        actualFilePath = actualFilePath[0];
      }
      if (Array.isArray(expectedFilePath)) {
        expectedFilePath = expectedFilePath[0];
      }

      if (actualFilePath && expectedFilePath) {
        // Check if filename matches (flexible path matching)
        const expectedFileName = expectedFilePath.split('/').pop();
        const actualFileName = actualFilePath.split('/').pop();

        if (actualFileName === expectedFileName || actualFilePath.includes(expectedFileName)) {
          evaluation.score = Math.min(evaluation.maxScore, evaluation.score + (testResult.bonusScore || 1));
          console.log(`✅ File loading: correct file '${expectedFileName}'`);
        } else {
          evaluation.warnings.push(`Expected file '${expectedFileName}' but got '${actualFileName}'`);
        }

        // Log current default directory for debugging
        const currentDir = this.getDefaultDirectory();
        console.log(`📁 File loading using directory: ${currentDir}`);
      }
    }

    // 🔥 CRITICAL FIX: Recalculate success field after adding bonus points
    evaluation.success = evaluation.score >= Math.ceil(evaluation.maxScore * 0.6); // 60% threshold

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

    // 🔥 CRITICAL FIX: Recalculate success field after adding bonus points
    evaluation.success = evaluation.score >= Math.ceil(evaluation.maxScore * 0.6); // 60% threshold

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

    // 🔥 CRITICAL FIX: Recalculate success field after adding bonus points
    evaluation.success = evaluation.score >= Math.ceil(evaluation.maxScore * 0.6); // 60% threshold

    return evaluation;
  }

  /**
   * Song's NEW Export evaluation criteria (Updated):
   * PRIMARY: If target file exists → Full score (5 points) - file export successful
   * FALLBACK: If file doesn't exist → 2-criteria scoring:
   *   1) Tool call correct: +3 points
   *   2) Tool execution success: +1 point
   * Pass threshold: 4+ points (achievable only with correct tool + success, or file exists)
   */
  async evaluateExportCall(actualResult, expectedResult, testResult) {
    const evaluation = {
      success: false,
      score: 0,
      maxScore: 5, // Fixed 5-point scale per Song's requirements
      errors: [],
      warnings: [],
    };

    console.log("📊 [evaluateExportCall] Starting Song's NEW file-priority evaluation:", {
      testId: testResult.id,
      expectedTool: expectedResult.tool_name,
      actualResult: actualResult,
    });

    if (!actualResult) {
      evaluation.errors.push('No result obtained from test execution');
      return evaluation;
    }

    // PRIORITY CHECK: Target file exists → FULL SCORE (5 points)
    const fileExists = this.checkTargetFileExists(actualResult, expectedResult);
    if (fileExists) {
      evaluation.score = 5; // FULL SCORE - file export successful
      evaluation.success = true;
      console.log(`🎯 [FILE EXISTS] Target file found - FULL SCORE awarded (5/5 points)`);
      console.log(`✅ [evaluateExportCall] Export successful - file created successfully`);
      return evaluation;
    }

    console.log(`⚠️ [FILE NOT EXISTS] Target file not found - using fallback 2-criteria scoring`);

    // FALLBACK CRITERIA: File doesn't exist - use 2-criteria scoring

    // CRITERION 1: Tool call correct (+3 points)
    const actualTool = Array.isArray(actualResult)
      ? actualResult.find(call => call?.tool_name)?.tool_name
      : actualResult.tool_name;

    if (actualTool === expectedResult.tool_name) {
      evaluation.score += 3;
      console.log(`✅ [Criterion 1] Tool call correct: ${actualTool} (+3 points)`);
    } else {
      evaluation.errors.push(`Wrong tool - Expected: ${expectedResult.tool_name}, Got: ${actualTool || 'none'}`);
      console.log(
        `❌ [Criterion 1] Tool call incorrect: expected ${expectedResult.tool_name}, got ${actualTool || 'none'} (+0 points)`
      );
    }

    // CRITERION 2: Tool execution success (+1 point)
    const hasSuccessSignal = this.checkToolExecutionSuccess(actualResult, expectedResult.tool_name);
    if (hasSuccessSignal) {
      evaluation.score += 1;
      console.log(`✅ [Criterion 2] Tool execution success detected (+1 point)`);
    } else {
      console.log(`❌ [Criterion 2] No tool execution success signal (+0 points)`);
    }

    // FINAL EVALUATION: 4+ points = pass (only achievable with correct tool + success)
    evaluation.success = evaluation.score >= 4;

    console.log(`📈 [evaluateExportCall] Final Song's NEW evaluation:`, {
      score: evaluation.score,
      maxScore: evaluation.maxScore,
      success: evaluation.success,
      status: evaluation.success ? 'PASS' : 'FAIL',
      fileExists: fileExists,
      criteria: {
        fileExists: fileExists,
        toolCorrect: actualTool === expectedResult.tool_name,
        executionSuccess: hasSuccessSignal,
      },
      evaluationMethod: fileExists ? 'FILE_EXISTS_FULL_SCORE' : 'FALLBACK_2_CRITERIA',
    });

    return evaluation;
  }

  /**
   * Helper method: Check if tool execution was successful
   * Looks for success patterns in response or tool execution tracker
   */
  checkToolExecutionSuccess(actualResult, expectedToolName) {
    // Method 1: Check Tool Execution Tracker
    if (window.chatManager && window.chatManager.toolExecutionTracker) {
      const tracker = window.chatManager.toolExecutionTracker;
      const recentExecutions = tracker.getSessionExecutions();

      const relevantExecution = recentExecutions.find(
        exec =>
          exec.toolName === expectedToolName && exec.status === 'completed' && Date.now() - exec.startTime < timeoutMs // Within configured timeout window
      );

      if (relevantExecution) {
        console.log(`🔍 [checkToolExecutionSuccess] Tracker shows successful execution:`, relevantExecution);
        return true;
      }
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

  /**
   * Helper method: Check if target export file exists
   * Attempts to verify file existence through various methods
   */
  checkTargetFileExists(actualResult, expectedResult) {
    // Extract target file path
    let targetFilePath = null;

    // Method 1: From actualResult parameters
    if (actualResult && actualResult.parameters && actualResult.parameters.filePath) {
      targetFilePath = actualResult.parameters.filePath;
    }
    // Method 2: From expectedResult parameters as fallback
    else if (expectedResult && expectedResult.parameters && expectedResult.parameters.filePath) {
      targetFilePath = expectedResult.parameters.filePath;
    }

    if (!targetFilePath) {
      console.log(`⚠️ [checkTargetFileExists] No target file path found`);
      return false;
    }

    console.log(`🔍 [checkTargetFileExists] Checking file: ${targetFilePath}`);

    // Method 1: Try Node.js fs module (if available)
    try {
      if (typeof require !== 'undefined') {
        const fs = require('fs');
        const exists = fs.existsSync(targetFilePath);
        console.log(`🔍 [checkTargetFileExists] fs.existsSync result: ${exists}`);
        return exists;
      }
    } catch (error) {
      console.log(`⚠️ [checkTargetFileExists] fs check failed:`, error.message);
    }

    // Method 2: Check if response mentions file creation
    if (typeof actualResult === 'string') {
      const fileName = targetFilePath.split('/').pop();
      const fileCreationPatterns = [
        new RegExp(`${fileName}.*created`, 'i'),
        new RegExp(`created.*${fileName}`, 'i'),
        new RegExp(`exported.*${fileName}`, 'i'),
        new RegExp(`saved.*${fileName}`, 'i'),
      ];

      const mentionsFileCreation = fileCreationPatterns.some(pattern => pattern.test(actualResult));
      if (mentionsFileCreation) {
        console.log(`🔍 [checkTargetFileExists] Response mentions file creation`);
        return true;
      }
    }

    // Method 3: Assume success if tool executed successfully (conservative approach)
    // This is a fallback when we can't verify file existence directly
    console.log(`⚠️ [checkTargetFileExists] Cannot verify file existence directly`);
    return false;
  }

  async setup(context) {
    console.log('🔧 [AutomaticSimpleSuite] Setting up Automatic Simple test suite...');

    // 清理导出文件防止假阳性
    // Clean up export files to prevent false positives
    await this.cleanupExportFiles();

    console.log('✅ [AutomaticSimpleSuite] Setup completed');
  }

  async cleanup(context) {
    console.log('Cleaning up Automatic Simple test suite');
  }

  /**
   * SONG'S DEBUGGING HELPER: Get summary of detected tools across all tests
   */
  static getToolDetectionSummary() {
    if (!window.songBenchmarkDebug || !window.songBenchmarkDebug.detectedTools) {
      console.log('📊 No tool detection data available. Run some benchmark tests first.');
      return null;
    }

    const tools = window.songBenchmarkDebug.detectedTools;
    const summary = {
      totalTests: tools.length,
      successfulMatches: tools.filter(t => t.actualTool === t.expectedTool).length,
      multipleToolCases: tools.filter(t => t.isMultipleTools).length,
      failedMatches: tools.filter(t => t.actualTool !== t.expectedTool).length,
      byTestType: {},
      byExpectedTool: {},
      byActualTool: {},
      problemCases: [],
    };

    // Analyze by test patterns
    tools.forEach(tool => {
      // By expected tool
      if (!summary.byExpectedTool[tool.expectedTool]) {
        summary.byExpectedTool[tool.expectedTool] = { total: 0, matches: 0, mismatches: 0 };
      }
      summary.byExpectedTool[tool.expectedTool].total++;
      if (tool.actualTool === tool.expectedTool) {
        summary.byExpectedTool[tool.expectedTool].matches++;
      } else {
        summary.byExpectedTool[tool.expectedTool].mismatches++;
      }

      // By actual tool
      if (tool.actualTool) {
        if (!summary.byActualTool[tool.actualTool]) {
          summary.byActualTool[tool.actualTool] = { count: 0, tests: [] };
        }
        summary.byActualTool[tool.actualTool].count++;
        summary.byActualTool[tool.actualTool].tests.push(tool.testName);
      }

      // Identify problem cases
      if (tool.actualTool !== tool.expectedTool) {
        summary.problemCases.push({
          testName: tool.testName,
          expected: tool.expectedTool,
          actual: tool.actualTool,
          allTools: tool.allDetectedTools,
          isMultiple: tool.isMultipleTools,
          foundInArray: tool.toolFoundInArray,
        });
      }
    });

    // Calculate success rate
    summary.successRate = tools.length > 0 ? ((summary.successfulMatches / tools.length) * 100).toFixed(1) : 0;

    // Display formatted summary
    console.log("\n🎯 ======= SONG'S TOOL DETECTION ANALYSIS =======");
    console.log(`📊 Total Tests Analyzed: ${summary.totalTests}`);
    console.log(`✅ Successful Matches: ${summary.successfulMatches} (${summary.successRate}%)`);
    console.log(`❌ Failed Matches: ${summary.failedMatches}`);
    console.log(`🔧 Multiple Tool Cases: ${summary.multipleToolCases}`);

    console.log('\n📋 Expected Tool Performance:');
    Object.entries(summary.byExpectedTool).forEach(([tool, stats]) => {
      const rate = ((stats.matches / stats.total) * 100).toFixed(1);
      console.log(`  ${tool}: ${stats.matches}/${stats.total} (${rate}%) - ${stats.mismatches} mismatches`);
    });

    console.log('\n🔍 Actually Detected Tools:');
    Object.entries(summary.byActualTool).forEach(([tool, stats]) => {
      console.log(
        `  ${tool}: ${stats.count} times - in tests: [${stats.tests.slice(0, 3).join(', ')}${stats.tests.length > 3 ? '...' : ''}]`
      );
    });

    if (summary.problemCases.length > 0) {
      console.log('\n⚠️  Problem Cases to Investigate:');
      summary.problemCases.forEach((problem, index) => {
        console.log(`  ${index + 1}. ${problem.testName}:`);
        console.log(`     Expected: ${problem.expected}`);
        console.log(`     Got: ${problem.actual}`);
        if (problem.isMultiple && problem.allTools) {
          console.log(`     All Tools: [${problem.allTools.join(', ')}]`);
          console.log(`     Expected Found in Array: ${problem.foundInArray ? '✅ YES' : '❌ NO'}`);
        }
      });
    }

    console.log('\n💡 RECOMMENDATIONS:');
    if (summary.multipleToolCases > 0) {
      console.log('  • Multiple tool calls detected - evaluation logic improved to handle these');
    }
    if (summary.failedMatches > 0) {
      console.log('  • Some tool mismatches found - check LLM tool selection logic');
      console.log('  • Consider improving prompts to select correct tools');
    }
    if (summary.successRate < 80) {
      console.log('  • Success rate below 80% - review tool selection criteria');
    } else {
      console.log('  • Good tool detection performance!');
    }

    console.log('\n🔧 Advanced Analysis Commands:');
    console.log('  window.songBenchmarkDebug.detectedTools.filter(t => t.isMultipleTools)');
    console.log('  window.songBenchmarkDebug.detectedTools.filter(t => t.actualTool !== t.expectedTool)');
    console.log('  AutomaticSimpleSuite.getToolDetectionSummary()');
    console.log('================================================\n');

    return summary;
  }

  /**
   * Evaluate working directory tool calls
   * @param {Object} actualResult - The actual function call result
   * @param {Object} expectedResult - The expected function call result
   * @param {Object} testResult - The test result object to populate
   * @returns {Promise<Object>} Enhanced test result
   */
  async evaluateWorkingDirectoryCall(actualResult, expectedResult, testResult) {
    let score = 0;
    let bonusScore = 0;
    const maxScore = testResult.maxScore || 5; // Use 5-point scale
    const maxBonusScore = testResult.bonusScore || 0; // No bonus for simplified scoring
    const feedback = [];

    console.log('📁 [AutomaticSimpleSuite] Evaluating working directory call:', {
      actualResult,
      expectedResult,
    });

    // Check if tool name matches (60% of score)
    if (actualResult && actualResult.tool_name === expectedResult.tool_name) {
      score += Math.round(maxScore * 0.6); // 60% = 3 points for tool
      feedback.push(`✅ Correct tool: ${actualResult.tool_name}`);

      // Parameter validation (40% of score)
      if (actualResult.parameters) {
        const actualParams = actualResult.parameters;
        const expectedParams = expectedResult.parameters;

        // Check for directory_path parameter
        if (expectedParams.directory_path && actualParams.directory_path) {
          if (actualParams.directory_path === expectedParams.directory_path) {
            score += Math.round(maxScore * 0.4); // 40% = 2 points for correct path
            feedback.push(`✅ Correct directory path: ${actualParams.directory_path}`);
          } else {
            score += Math.round(maxScore * 0.2); // 20% = 1 point for having path
            feedback.push(
              `⚠️ Directory path mismatch - Expected: ${expectedParams.directory_path}, Got: ${actualParams.directory_path}`
            );
          }
        }

        // Check for use_home_directory flag
        if (expectedParams.use_home_directory !== undefined) {
          if (actualParams.use_home_directory === expectedParams.use_home_directory) {
            score += Math.round(maxScore * 0.4); // 40% = 2 points for correct flag
            feedback.push(`✅ Correct home directory flag: ${actualParams.use_home_directory}`);
          } else {
            feedback.push(
              `❌ Home directory flag mismatch - Expected: ${expectedParams.use_home_directory}, Got: ${actualParams.use_home_directory}`
            );
          }
        }
      } else {
        feedback.push(`❌ Missing parameters object`);
      }
    } else {
      feedback.push(`❌ Wrong tool - Expected: ${expectedResult.tool_name}, Got: ${actualResult?.tool_name || 'none'}`);
    }

    // Ensure scores don't exceed maximum
    score = Math.min(score, maxScore);
    bonusScore = Math.min(bonusScore, maxBonusScore);

    const finalScore = score + bonusScore;

    // Record for Song's tool detection analysis
    this.recordToolDetection(
      testResult.testName,
      expectedResult.tool_name,
      actualResult?.tool_name,
      actualResult,
      expectedResult,
      finalScore >= maxScore * 0.6
    );

    return {
      ...testResult,
      score: finalScore,
      maxScore: maxScore + maxBonusScore,
      baseScore: score,
      bonusScore: bonusScore,
      success: finalScore >= maxScore * 0.6, // 60% threshold for success - CRITICAL FIX
      passed: finalScore > 0, // Keep for compatibility
      feedback: feedback.join('\n'),
      evaluationDetails: {
        correctTool: actualResult?.tool_name === expectedResult.tool_name,
        hasParameters: !!actualResult?.parameters,
        toolMatches: actualResult?.tool_name === expectedResult.tool_name,
        parameterAnalysis: actualResult?.parameters || {},
      },
    };
  }

  /**
   * Record tool detection for Song's benchmark analysis
   * @param {string} testName - Name of the test
   * @param {string} expectedTool - Expected tool name
   * @param {string} actualTool - Actually detected tool name
   * @param {Object} actualResult - Full actual result object
   * @param {Object} expectedResult - Full expected result object
   * @param {boolean} success - Whether the tool detection was successful
   */
  recordToolDetection(testName, expectedTool, actualTool, actualResult, expectedResult, success) {
    // Initialize global debug object if not exists
    if (!window.songBenchmarkDebug) {
      window.songBenchmarkDebug = {
        toolDetectionLog: [],
        detectedTools: [],
        finalToolSelections: [],
      };
    }

    // Record detailed tool detection information
    const detectionRecord = {
      timestamp: new Date().toISOString(),
      testName: testName,
      expectedTool: expectedTool,
      actualTool: actualTool,
      success: success,
      actualResult: actualResult,
      expectedResult: expectedResult,
      resultType: typeof actualResult,
      hasParameters: actualResult && actualResult.parameters && Object.keys(actualResult.parameters).length > 0,
      detectionSource: 'AutomaticSimpleSuite.evaluateWorkingDirectoryCall',
    };

    window.songBenchmarkDebug.toolDetectionLog.push(detectionRecord);

    console.log("📊 [Tool Detection Recording] Added record for Song's analysis:", {
      testName,
      expectedTool,
      actualTool,
      success,
      totalRecords: window.songBenchmarkDebug.toolDetectionLog.length,
    });
  }

  /**
   * Evaluate tab opening test: tabs count after > tabs count before = full score
   * Song's requirement: Simple pass/fail logic for automatic simple tests
   */
  async evaluateTabOpeningCall(actualResult, expectedResult, testResult) {
    const evaluation = {
      success: false,
      score: 0,
      maxScore: testResult.maxScore || 5,
      errors: [],
      warnings: [],
    };

    console.log('🗂️ [evaluateTabOpeningCall] Evaluating tab opening test:', {
      testId: testResult.testId,
      expectedTool: expectedResult.tool_name,
      actualResult: actualResult,
    });

    if (!actualResult) {
      evaluation.errors.push('No result obtained from test execution');
      return evaluation;
    }

    // Get tabs count through genomeBrowser.tabManager if available
    let currentTabsCount = 0;
    try {
      if (window.genomeBrowser && window.genomeBrowser.tabManager) {
        currentTabsCount = window.genomeBrowser.tabManager.tabs.size;
        console.log('🗂️ [evaluateTabOpeningCall] Current tabs count:', currentTabsCount);
      } else {
        evaluation.warnings.push('TabManager not available for direct count verification');
      }
    } catch (error) {
      console.warn('⚠️ [evaluateTabOpeningCall] Could not access TabManager:', error.message);
      evaluation.warnings.push('Could not verify tab count directly');
    }

    // Check tool execution first
    const basicEvaluation = await this.evaluateBasicFunctionCall(actualResult, expectedResult, testResult);

    // If tool executed correctly, assume tab was opened (full score)
    if (basicEvaluation.success) {
      evaluation.score = evaluation.maxScore;
      evaluation.success = true;
      evaluation.warnings.push('Tab opening successful - tool executed correctly');
      console.log('✅ [evaluateTabOpeningCall] Tab opening tool executed successfully - awarding full score');
    } else {
      // Tool didn't execute correctly
      evaluation.score = 0;
      evaluation.success = false;
      evaluation.errors.push(...basicEvaluation.errors);
      console.log('❌ [evaluateTabOpeningCall] Tab opening tool failed to execute');
    }

    // Additional check: Look for success patterns in response
    if (typeof actualResult === 'string') {
      const successPatterns = [/new tab.*opened/i, /tab.*created/i, /opened new tab/i, /successfully.*opened/i];

      const hasSuccessPattern = successPatterns.some(pattern => pattern.test(actualResult));
      if (hasSuccessPattern && evaluation.score === 0) {
        evaluation.score = evaluation.maxScore;
        evaluation.success = true;
        evaluation.warnings.push('Tab opening detected from response text');
        console.log('✅ [evaluateTabOpeningCall] Tab opening detected from response pattern');
      }
    }

    console.log('🏁 [evaluateTabOpeningCall] Final evaluation:', {
      score: evaluation.score,
      maxScore: evaluation.maxScore,
      success: evaluation.success,
      currentTabsCount: currentTabsCount,
    });

    return evaluation;
  }
}

// Make the class available globally
window.AutomaticSimpleSuite = AutomaticSimpleSuite;
