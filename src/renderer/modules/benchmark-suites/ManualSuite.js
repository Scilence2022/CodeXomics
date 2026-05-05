/**
 * Manual Benchmark Suite - Manual evaluation tests (Simple + Complex)
 * Renamed from ManualSimpleSuite.js for broader scope
 */
class ManualSuite extends BenchmarkEvaluatorBase {
  constructor() {
    super();
    this.suiteName = 'Manual Tests'; // Count will be added dynamically
    this.suiteId = 'manual_suite';
    this.description = 'Manual evaluation tests - Genomic operations requiring human verification';
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
   * Initialize manual test cases
   */
  initializeTests() {
    return [
      // DATA LOADING TASKS - Manual + Simple (FIRST - Data must be loaded before other tests)
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
            showFileDialog: true,
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 300000,
        evaluator: this.evaluateBasicFunctionCall.bind(this),
        manualVerification:
          'Please verify: 1) File selection dialog opens properly, 2) Dialog supports FASTA/GenBank formats.',
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
          parameters: {},
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 300000,
        evaluator: this.evaluateBasicFunctionCall.bind(this),
        manualVerification:
          'Please verify: 1) Annotation loading interface appears, 2) Annotation file can be loaded and visualized.',
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
          parameters: {},
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 300000,
        evaluator: this.evaluateBasicFunctionCall.bind(this),
        manualVerification: 'Please verify: 1) Reads file dialog opens, 2) BAM/SAM file can be loaded and visualized.',
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
          parameters: {},
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 300000,
        evaluator: this.evaluateBasicFunctionCall.bind(this),
        manualVerification:
          'Please verify: 1) WIG file loading interface appears, 2) WIG files can be loaded and visulized.',
      },

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
            geneName: 'lacZ',
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 300000,
        evaluator: this.evaluateBasicFunctionCall.bind(this),
        manualVerification: 'Please verify: 1) Browser navigates to lacZ gene；',
      },
      {
        id: 'nav_manual_02',
        name: 'Open New Browser Tab',
        type: 'function_call',
        category: 'navigation',
        complexity: 'simple',
        evaluation: 'manual',
        instruction: 'Open a new tab.',
        expectedResult: {
          tool_name: 'open_new_tab',
          parameters: {},
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 300000,
        evaluator: this.evaluateBasicFunctionCall.bind(this),
        manualVerification: 'Please verify: 1) New browser tab opens successfully；',
      },
      {
        id: 'nav_manual_03',
        name: 'Switch to First Tab',
        type: 'function_call',
        category: 'navigation',
        complexity: 'simple',
        evaluation: 'manual',
        instruction: 'Switch to the first tab (tab index 0).',
        expectedResult: {
          tool_name: 'switch_to_tab',
          parameters: {
            tab_index: 0,
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 300000,
        evaluator: this.evaluateBasicFunctionCall.bind(this),
        manualVerification: 'Please verify: 1) Browser switches to the first tab successfully；',
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
            include_statistics: true,
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 300000,
        evaluator: this.evaluateBasicFunctionCall.bind(this),
        manualVerification:
          'Please verify: 1) Codon usage analysis is performed for lacZ, 2) Results show frequency tables and statistics；',
      },

      // SEARCH TASKS - Manual + Simple
      {
        id: 'search_manual_01',
        name: 'Search b1210 Locus Tags',
        type: 'function_call',
        category: 'search',
        complexity: 'simple',
        evaluation: 'manual',
        instruction: "Search for genes with locus tags starting with 'b1210'.",
        expectedResult: {
          tool_name: 'find_gene_by_name',
          parameters: {
            name: 'b1210',
            exact_match: false,
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 300000,
        evaluator: this.evaluateBasicFunctionCall.bind(this),
        manualVerification: 'Please verify: 1) Search identifies genes with locus tags b1210 etc.;',
      },

      // ANNOTATION MANAGEMENT TASKS - Manual + Simple
      {
        id: 'annot_manual_01',
        name: 'Create Gene Annotation',
        type: 'function_call',
        category: 'annotation',
        complexity: 'simple',
        evaluation: 'manual',
        instruction: 'Create a gene annotation named "my_custom_gene" of type "gene" at position 600000 to 602000 on the current chromosome.',
        expectedResult: {
          tool_name: 'create_annotation',
          parameters: {
            start: 600000,
            end: 602000,
            name: 'my_custom_gene',
            type: 'gene',
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 300000,
        evaluator: this.evaluateBasicFunctionCall.bind(this),
        manualVerification: 'Please verify: 1) New annotation appears on the genome browser at the correct position, 2) Annotation name and type are correct in the sidebar.',
      },
      {
        id: 'annot_manual_02',
        name: 'Search Annotations by Type',
        type: 'function_call',
        category: 'annotation',
        complexity: 'simple',
        evaluation: 'manual',
        instruction: 'Search for all annotations of type "CDS" in the current genome.',
        expectedResult: {
          tool_name: 'search_annotations',
          parameters: {
            type: 'CDS',
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 300000,
        evaluator: this.evaluateBasicFunctionCall.bind(this),
        manualVerification: 'Please verify: 1) Search returns CDS annotations correctly, 2) Results are relevant and complete.',
      },

      // TRACK CONTROL TASKS - Manual + Simple
      {
        id: 'track_manual_01',
        name: 'Toggle GC Track',
        type: 'function_call',
        category: 'track_control',
        complexity: 'simple',
        evaluation: 'manual',
        instruction: 'Toggle the GC content track visibility.',
        expectedResult: {
          tool_name: 'toggle_track',
          parameters: {
            trackName: 'gc_content',
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 300000,
        evaluator: this.evaluateBasicFunctionCall.bind(this),
        manualVerification: 'Please verify: 1) GC content track appears or disappears in the browser, 2) Track toggle is responsive.',
      },

      // PROTEIN STRUCTURE TASKS - Manual + Simple
      {
        id: 'protein_manual_01',
        name: 'Open AlphaFold Viewer',
        type: 'function_call',
        category: 'protein_structure',
        complexity: 'simple',
        evaluation: 'manual',
        instruction: 'Open the AlphaFold 3D structure viewer for gene lacZ.',
        expectedResult: {
          tool_name: 'open_protein_viewer',
          parameters: {
            geneName: 'lacZ',
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 300000,
        evaluator: this.evaluateBasicFunctionCall.bind(this),
        manualVerification: 'Please verify: 1) AlphaFold 3D structure viewer opens, 2) Protein structure renders correctly.',
      },

      // GENE ANALYSIS TASKS - Manual + Simple
      {
        id: 'gene_manual_01',
        name: 'Get Gene Details for lacZ',
        type: 'function_call',
        category: 'gene_analysis',
        complexity: 'simple',
        evaluation: 'manual',
        instruction: 'Get detailed information about the lacZ gene including its product, function, and genomic context.',
        expectedResult: {
          tool_name: 'get_gene_details',
          parameters: {
            geneName: 'lacZ',
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 300000,
        evaluator: this.evaluateBasicFunctionCall.bind(this),
        manualVerification: 'Please verify: 1) Gene details are displayed correctly, 2) Information includes product, function, and genomic context.',
      },
      {
        id: 'gene_manual_02',
        name: 'Find Intergenic Regions',
        type: 'function_call',
        category: 'gene_analysis',
        complexity: 'simple',
        evaluation: 'manual',
        instruction: 'Find intergenic regions in the current genomic view.',
        expectedResult: {
          tool_name: 'find_intergenic_regions',
          parameters: {},
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 300000,
        evaluator: this.evaluateBasicFunctionCall.bind(this),
        manualVerification: 'Please verify: 1) Intergenic regions are identified, 2) Region boundaries match gene annotations.',
      },

      // PRIMER DESIGN TASKS - Manual + Simple
      {
        id: 'primer_manual_01',
        name: 'Design Primers for lacZ',
        type: 'function_call',
        category: 'primer_design',
        complexity: 'simple',
        evaluation: 'manual',
        instruction: 'Design PCR primers for the lacZ gene with melting temperature around 60°C.',
        expectedResult: {
          tool_name: 'design_primers',
          parameters: {
            geneName: 'lacZ',
            targetTm: 60,
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 300000,
        evaluator: this.evaluateBasicFunctionCall.bind(this),
        manualVerification: 'Please verify: 1) Primer sequences are generated, 2) Melting temperatures are near 60°C, 3) Primer properties are reasonable.',
      },

      // RESTRICTION ANALYSIS TASKS - Manual + Simple
      {
        id: 'restrict_manual_01',
        name: 'Find Restriction Sites',
        type: 'function_call',
        category: 'restriction',
        complexity: 'simple',
        evaluation: 'manual',
        instruction: 'Find restriction enzyme recognition sites in the region around the lacZ gene.',
        expectedResult: {
          tool_name: 'find_restriction_sites',
          parameters: {
            geneName: 'lacZ',
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 300000,
        evaluator: this.evaluateBasicFunctionCall.bind(this),
        manualVerification: 'Please verify: 1) Restriction sites are found and listed, 2) Enzyme names and cut positions are correct.',
      },

      // BLAST TASKS - Manual + Simple
      {
        id: 'blast_manual_01',
        name: 'BLAST Search with Parameters',
        type: 'function_call',
        category: 'blast',
        complexity: 'simple',
        evaluation: 'manual',
        instruction: 'Perform a BLAST search online with the sequence ATGAAAGCGCTGAAAGCGCTG using blastn program against the nr database with e-value threshold 0.001.',
        expectedResult: {
          tool_name: 'blast_search_online',
          parameters: {
            sequence: 'ATGAAAGCGCTGAAAGCGCTG',
            program: 'blastn',
            database: 'nr',
            evalue: 0.001,
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 300000,
        evaluator: this.evaluateBasicFunctionCall.bind(this),
        manualVerification: 'Please verify: 1) BLAST search executes successfully, 2) Results include relevant hits with e-values below threshold.',
      },

      // DATABASE INTEGRATION TASKS - Manual + Simple
      {
        id: 'db_manual_01',
        name: 'Analyze InterPro Domains for lacZ',
        type: 'function_call',
        category: 'database',
        complexity: 'simple',
        evaluation: 'manual',
        instruction: 'Analyze InterPro protein domains for the lacZ gene from Escherichia coli.',
        expectedResult: {
          tool_name: 'analyze_interpro_domains',
          parameters: {
            geneName: 'lacZ',
            organism: 'Escherichia coli',
          },
        },
        maxScore: 5,
        bonusScore: 1,
        timeout: 300000,
        evaluator: this.evaluateBasicFunctionCall.bind(this),
        manualVerification: 'Please verify: 1) InterPro domain analysis executes, 2) Domain families and functional sites are identified.',
      },

      // COMPLEX NAVIGATION WORKFLOW - Manual + Complex
      {
        id: 'navi_manual_01',
        name: 'Open tabs and navigate to different positions',
        type: 'workflow',
        category: 'navigation',
        complexity: 'complex',
        evaluation: 'manual',
        instruction:
          'Open three new tabs and navigate to different positions: 1) Open a new tab then navigate to position 1000000, 2) Open a new tab then jump to lacZ gene, 3) Open a new tab then navigate to position 2500000.',
        expectedResult: {
          tool_sequence: [
            'open_new_tab',
            'navigate_to_position',
            'open_new_tab',
            'jump_to_gene',
            'open_new_tab',
            'navigate_to_position',
          ],
          parameters: [
            {}, // open_new_tab 1
            { chromosome: '<current_chromosome>', position: 1000000 }, // navigate to 1M in new tab
            {}, // open_new_tab 2
            { geneName: 'lacZ' }, // jump to lacZ in new tab
            {}, // open_new_tab 3
            { chromosome: '<current_chromosome>', position: 2500000 }, // navigate to 2.5M in new tab
          ],
        },
        maxScore: 15,
        bonusScore: 5,
        timeout: 300000,
        evaluator: this.evaluateComplexNavigationWorkflow.bind(this),
        manualVerification:
          'Please verify: 1) Three new tabs are opened successfully, 2) First new tab automatically navigates to position 1000000, 3) Second new tab automatically navigates to lacZ gene location, 4) Third new tab automatically navigates to position 2500000, 5) Navigation in each tab is accurate and responsive.',
      },
    ];
  }

  /**
   * Evaluator methods - delegates to BenchmarkEvaluatorBase for unified logic.
   * Fix Problem 4: Single source of truth for evaluation.
   */
  async evaluateBasicFunctionCall(actualResult, expectedResult, testResult) {
    // Delegate to the base class with ManualSuite-specific options:
    // - successThreshold: 0.6 (60% for manual tests)
    // - defaultMaxScore: 5
    return super.evaluateBasicFunctionCall(actualResult, expectedResult, testResult, {
      defaultMaxScore: 5,
      successThreshold: 0.6,
    });
  }

  /**
   * Evaluate complex navigation workflow with multiple tabs and navigation
   */
  async evaluateComplexNavigationWorkflow(actualResult, expectedResult, testResult) {
    const evaluation = {
      success: false,
      score: 0,
      maxScore: testResult.maxScore || 15,
      errors: [],
      warnings: [],
      details: {
        toolsExecuted: [],
        expectedSequence: expectedResult.tool_sequence || [],
        actualSequence: [],
        sequenceMatch: false,
      },
    };

    console.log(`🧭 [ManualSuite] Evaluating complex navigation workflow:`, {
      testId: testResult.testId,
      expectedSequence: expectedResult.tool_sequence,
      actualResult: actualResult,
      actualResultType: typeof actualResult,
      isArray: Array.isArray(actualResult),
    });

    if (!actualResult) {
      evaluation.errors.push('No result obtained from complex navigation workflow');
      return evaluation;
    }

    // CRITICAL FIX: Handle different result formats
    let toolResults = [];

    // Check if actualResult is already an array of tool calls
    if (Array.isArray(actualResult)) {
      toolResults = actualResult;
    }
    // Check if it's a single tool call object
    else if (actualResult.tool_name) {
      toolResults = [actualResult];
    }
    // Check if executionData has functionCalls array
    else if (testResult.llmInteractionData?.response?.actualExecutionData?.functionCalls) {
      const functionCalls = testResult.llmInteractionData.response.actualExecutionData.functionCalls;
      toolResults = functionCalls.map(call => ({
        tool_name: call.tool_name,
        parameters: call.parameters,
        round: call.round,
      }));
      console.log(`🔧 [ManualSuite] Extracted ${toolResults.length} tools from executionData`);
    }
    // Fallback: check detailedLogs for round information
    else if (testResult.detailedLogs?.toolCallHistory?.toolCallRounds) {
      const rounds = testResult.detailedLogs.toolCallHistory.toolCallRounds;
      const allTools = [];
      rounds.forEach(round => {
        if (round.tools && round.tools.length > 0) {
          round.tools.forEach(tool => {
            allTools.push({
              tool_name: tool,
              round: round.current,
            });
          });
        }
      });
      toolResults = allTools;
      console.log(`🔧 [ManualSuite] Extracted ${toolResults.length} tools from detailedLogs`);
    }

    console.log(`🧭 [ManualSuite] Processing ${toolResults.length} tool calls in workflow`);
    console.log(`🧭 [ManualSuite] Tool results:`, toolResults);

    // Extract actual tool sequence
    evaluation.details.actualSequence = toolResults.map(result => result?.tool_name).filter(Boolean);
    evaluation.details.toolsExecuted = evaluation.details.actualSequence;

    console.log(`🧭 [ManualSuite] Actual sequence:`, evaluation.details.actualSequence);
    console.log(`🧭 [ManualSuite] Expected sequence:`, evaluation.details.expectedSequence);

    // Check sequence matching
    const expectedSequence = evaluation.details.expectedSequence;
    const actualSequence = evaluation.details.actualSequence;

    // ENHANCED: More flexible sequence matching
    let sequenceScore = 0;
    const maxSequenceScore = 10; // 10 points for sequence matching (increased from 8)

    if (actualSequence.length > 0) {
      // Count tools that match expected sequence (in order)
      let correctTools = 0;
      let exactMatches = 0;

      // Check exact sequence match
      for (let i = 0; i < Math.min(expectedSequence.length, actualSequence.length); i++) {
        if (actualSequence[i] === expectedSequence[i]) {
          exactMatches++;
        }
      }

      // Also give credit for having the right tools, even if order is slightly different
      expectedSequence.forEach(expectedTool => {
        if (actualSequence.includes(expectedTool)) {
          correctTools++;
        }
      });

      // Calculate score based on both exact matches and presence
      const exactMatchRatio = exactMatches / expectedSequence.length;
      const presenceRatio = correctTools / expectedSequence.length;

      // Weight exact matches more heavily (70%) than just presence (30%)
      sequenceScore = Math.round((exactMatchRatio * 0.7 + presenceRatio * 0.3) * maxSequenceScore);

      evaluation.details.sequenceMatch = exactMatches >= Math.ceil(expectedSequence.length * 0.7); // 70% exact match required

      console.log(`🎯 [ManualSuite] Sequence scoring:`, {
        exactMatches,
        correctTools,
        expectedLength: expectedSequence.length,
        exactMatchRatio: (exactMatchRatio * 100).toFixed(1) + '%',
        presenceRatio: (presenceRatio * 100).toFixed(1) + '%',
        sequenceScore,
      });
    }

    // Award additional points for workflow completion
    let workflowScore = 0;
    const maxWorkflowScore = 5; // 5 points for overall workflow success (reduced to make room for sequence score)

    // Check for key workflow components
    const tabCreationCount = actualSequence.filter(tool => tool === 'open_new_tab').length;
    const hasNavigation = actualSequence.includes('navigate_to_position') || actualSequence.includes('jump_to_gene');
    const expectedTabCount = expectedSequence.filter(tool => tool === 'open_new_tab').length;

    // Award points for tab creation (3 points max)
    if (tabCreationCount > 0) {
      workflowScore += Math.min(3, (tabCreationCount / Math.max(1, expectedTabCount)) * 3);
    }

    // Award points for navigation (2 points)
    if (hasNavigation) {
      workflowScore += 2;
    }

    workflowScore = Math.round(workflowScore);

    evaluation.score = sequenceScore + workflowScore;
    evaluation.success = evaluation.score >= Math.ceil(evaluation.maxScore * 0.6); // 60% threshold

    // Add detailed feedback
    evaluation.warnings.push(`Sequence matching: ${sequenceScore}/${maxSequenceScore} points`);
    evaluation.warnings.push(`Workflow completion: ${workflowScore}/${maxWorkflowScore} points`);
    evaluation.warnings.push(`Tools executed: ${actualSequence.join(' → ')}`);
    evaluation.warnings.push(`Expected tools: ${expectedSequence.join(' → ')}`);

    console.log(`🧭 [ManualSuite] Complex navigation workflow evaluation complete:`, {
      score: evaluation.score,
      maxScore: evaluation.maxScore,
      success: evaluation.success,
      sequenceMatch: evaluation.details.sequenceMatch,
      toolsExecuted: evaluation.details.toolsExecuted.length,
    });

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

  async evaluateTabSwitchCall(actualResult, expectedResult, testResult) {
    const evaluation = await this.evaluateBasicFunctionCall(actualResult, expectedResult, testResult);

    console.log(`🔄 [ManualSuite] Evaluating tab switch call:`, {
      testId: testResult.testId,
      expectedTool: expectedResult.tool_name,
      actualResult: actualResult,
    });

    // Add tab switching-specific checks
    if (actualResult && actualResult.parameters) {
      const params = actualResult.parameters;

      // Validate tab switching parameters
      if (params.tab_id || params.tab_name || params.tab_index !== undefined) {
        evaluation.score += 1; // Bonus for providing valid tab identification

        // Bonus for using appropriate parameter types
        if (params.tab_index !== undefined && typeof params.tab_index === 'number') {
          evaluation.score += 1; // Bonus for correct index type
        }

        if (params.tab_name && typeof params.tab_name === 'string') {
          evaluation.score += 1; // Bonus for string tab name
        }

        if (params.tab_id && typeof params.tab_id === 'string') {
          evaluation.score += 1; // Bonus for string tab ID
        }
      } else {
        evaluation.warnings.push(
          'No valid tab identification parameter provided (tab_id, tab_name, or tab_index required)'
        );
      }

      // Check for invalid combinations
      const providedParams = [params.tab_id, params.tab_name, params.tab_index].filter(
        p => p !== undefined && p !== null
      );
      if (providedParams.length > 1) {
        evaluation.warnings.push('Multiple tab identification parameters provided - tool will use the first valid one');
      }
    }

    // Cap the score at maxScore to prevent over-scoring
    evaluation.score = Math.min(evaluation.score, evaluation.maxScore);

    return evaluation;
  }

  async setup(context) {
    console.log('Setting up Manual test suite');
  }

  async cleanup(context) {
    console.log('Cleaning up Manual test suite');
  }
}

// Make the class available globally
window.ManualSuite = ManualSuite;
