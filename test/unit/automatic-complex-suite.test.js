/* eslint-disable no-new-func */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';

const BASE_EVALUATOR_PATH = path.join(process.cwd(), 'src/renderer/modules/benchmark-suites/BenchmarkEvaluatorBase.js');
const AUTOMATIC_COMPLEX_PATH = path.join(
  process.cwd(),
  'src/renderer/modules/benchmark-suites/AutomaticComplexSuite.js'
);

function loadAutomaticComplexSuite() {
  const baseCode = fs.readFileSync(BASE_EVALUATOR_PATH, 'utf-8');
  const suiteCode = fs.readFileSync(AUTOMATIC_COMPLEX_PATH, 'utf-8');

  // Define window globally for script execution context
  global.window = {
    songBenchmarkDebug: { detectedTools: [] },
    chatManager: {
      toolExecutionTracker: {
        getSessionExecutions() {
          return [];
        },
      },
    },
  };

  // Run the base evaluator code
  const runBase = new Function('window', `${baseCode}; return window.BenchmarkEvaluatorBase;`);
  global.BenchmarkEvaluatorBase = runBase(global.window);

  // Run the suite evaluator code
  const runSuite = new Function(
    'window',
    'BenchmarkEvaluatorBase',
    `${suiteCode}; return window.AutomaticComplexSuite;`
  );
  return runSuite(global.window, global.BenchmarkEvaluatorBase);
}

describe('AutomaticComplexSuite', () => {
  let AutomaticComplexSuiteClass;
  let suite;

  beforeAll(() => {
    AutomaticComplexSuiteClass = loadAutomaticComplexSuite();
    suite = new AutomaticComplexSuiteClass();
  });

  describe('Initialization and Config', () => {
    it('should initialize suite metadata correctly', () => {
      expect(suite.getName()).toBe('Automatic Complex Tests');
      expect(suite.suiteId).toBe('automatic_complex');
      expect(suite.getTests()).toBeInstanceOf(Array);
    });

    it('should contain all expected tests, including the new complex ones', () => {
      const tests = suite.getTests();
      const testIds = tests.map(t => t.id);

      // Total of 29 tests expected
      expect(tests.length).toBe(29);
      expect(testIds).toEqual([
        'file_auto_01',
        'nav_auto_01',
        'nav_auto_complex_02',
        'analysis_auto_01',
        'analysis_auto_02',
        'analysis_auto_complex_03',
        'analysis_auto_complex_05',
        'restrict_auto_01',
        'gel_auto_01',
        'gel_auto_03',
        'gel_auto_workflow_02',
        'annotation_auto_complex_01',
        'annotation_auto_complex_02',
        'track_auto_complex_01',
        'task_auto_complex_01',
        'primer_auto_01',
        'primer_auto_complex_01',
        'primer_auto_complex_02',
        'export_auto_complex_01',
        'export_auto_complex_02',
        'file_auto_complex_02',
        'ui_auto_01',
        'ui_auto_complex_02',
        'protein_auto_complex_01',
        'protein_auto_complex_02',
        'blast_auto_complex_01',
        'blast_auto_complex_02',
        'blast_auto_complex_03',
        'blast_auto_complex_04',
      ]);

      // Verify the new complex test cases exist
      expect(testIds).toContain('annotation_auto_complex_01');
      expect(testIds).toContain('track_auto_complex_01');
      expect(testIds).toContain('protein_auto_complex_01');
      expect(testIds).toContain('blast_auto_complex_01');
      expect(testIds).toContain('blast_auto_complex_02');
      expect(testIds).toContain('export_auto_complex_02');
      expect(testIds).toContain('ui_auto_complex_02');
      expect(testIds).toContain('primer_auto_complex_01');
      expect(testIds).toContain('primer_auto_complex_02');
      expect(testIds).toContain('protein_auto_complex_02');
      expect(testIds).toContain('analysis_auto_complex_05');
      expect(testIds).toContain('nav_auto_complex_02');
      expect(testIds).toContain('annotation_auto_complex_02');
      expect(testIds).toContain('task_auto_complex_01');
      expect(testIds).toContain('file_auto_complex_02');
      expect(testIds).toContain('blast_auto_complex_03');
      expect(testIds).toContain('blast_auto_complex_04');

      // Verify details of one new test case
      const annotationTest = tests.find(t => t.id === 'annotation_auto_complex_01');
      expect(annotationTest.type).toBe('workflow');
      expect(annotationTest.category).toBe('annotations');
      expect(annotationTest.complexity).toBe('complex');
      expect(annotationTest.evaluation).toBe('automatic');

      const tabLifecycleTest = tests.find(t => t.id === 'ui_auto_complex_02');
      expect(tabLifecycleTest.expectedResult.tool_sequence).toEqual(['open_new_tab', 'switch_to_tab', 'close_tab']);

      const primerUpstreamTest = tests.find(t => t.id === 'primer_auto_complex_02');
      expect(primerUpstreamTest.type).toBe('workflow');
      expect(primerUpstreamTest.expectedResult.tool_sequence).toEqual([
        'design_primers',
        'save_primer',
        ['jump_to_gene', 'zoom_to_gene', 'navigate_to_position'],
        'toggle_track',
      ]);
      expect(primerUpstreamTest.expectedResult.parameters[0]).toEqual({
        geneName: 'lysC',
        upstreamBp: 50,
      });

      const chainedSequenceTest = tests.find(t => t.id === 'analysis_auto_complex_05');
      expect(chainedSequenceTest.expectedResult.tool_sequence[0]).toEqual(['navigate_to_position', 'navigate_to']);
      expect(chainedSequenceTest.expectedResult.parameters[2].sequence).toBe('{get_sequence.sequence}');
      expect(chainedSequenceTest.expectedResult.parameters[4]).toEqual({
        dna: '{get_sequence.sequence}',
        readingFrame: 1,
      });

      const taskLifecycleTest = tests.find(t => t.id === 'task_auto_complex_01');
      expect(taskLifecycleTest.expectedResult.tool_sequence).toEqual([
        'clear_tasks',
        'add_task',
        'list_tasks',
        'update_task',
        'delete_task',
        'list_tasks',
      ]);

      const blastLifecycleTest = tests.find(t => t.id === 'blast_auto_complex_03');
      expect(blastLifecycleTest.expectedResult.tool_sequence).toEqual([
        'export_current_view_fasta',
        'blast_create_database',
        'blast_validate_database',
        'blast_list_databases',
        'blast_delete_database',
      ]);
    });

    it('should resolve default directory fallback and build paths correctly', () => {
      // Default fallback should be './'
      expect(suite.getDefaultDirectory()).toBe('./');
      expect(suite.buildFilePath('test.fasta')).toBe('./test.fasta');

      // Set custom directory
      suite.setConfiguration({ defaultDirectory: '/custom/dir' });
      expect(suite.getDefaultDirectory()).toBe('/custom/dir');
      expect(suite.buildFilePath('test.fasta')).toBe('/custom/dir/test.fasta');

      // Reset for subsequent tests
      suite.setConfiguration({ defaultDirectory: './' });
    });
  });

  describe('Parameter Key Normalization', () => {
    it('normalizeParameterKeys should recursively convert snake_case and kebab-case to camelCase', () => {
      const input = {
        track_name: 'GC Content',
        'track-name-kebab': 'Kebab GC',
        simple_key: 123,
        'nested-object-kebab': {
          uniprot_id: 'P04637',
          another_nested: {
            'max-mismatches': 2,
          },
        },
        array_val: [{ 'item-id-kebab': 1, detailed_info: 'test' }, { item_id: 2 }],
      };

      const expected = {
        trackName: 'GC Content',
        trackNameKebab: 'Kebab GC',
        simpleKey: 123,
        nestedObjectKebab: {
          uniprotId: 'P04637',
          anotherNested: {
            maxMismatches: 2,
          },
        },
        arrayVal: [{ itemIdKebab: 1, detailedInfo: 'test' }, { itemId: 2 }],
      };

      const result = suite.normalizeParameterKeys(input);
      expect(result).toEqual(expected);
    });

    it('normalizeResultParameters should normalize parameters, handling alternative properties/JSON', () => {
      const singleCall = {
        tool_name: 'toggle_track',
        params: {
          // using 'params' instead of 'parameters'
          'track-name': 'GC Content',
          action_type: 'show',
        },
      };

      const jsonParamsCall = {
        tool_name: 'design_primers',
        arguments: '{"gene-name": "lacZ", "max_mismatches": 2}', // JSON string in 'arguments'
      };

      // Serialized JSON string of the whole result
      const jsonStringResult = '{"tool": "calculate_primer_properties", "args": {"primer-sequence": "ATGACC"}}';

      const normSingle = suite.normalizeResultParameters(singleCall);
      expect(normSingle.parameters.trackName).toBe('GC Content');
      expect(normSingle.parameters.actionType).toBe('show');

      const normJsonParams = suite.normalizeResultParameters(jsonParamsCall);
      expect(normJsonParams.parameters.geneName).toBe('lacZ');
      expect(normJsonParams.parameters.maxMismatches).toBe(2);

      const normJsonString = suite.normalizeResultParameters(jsonStringResult);
      expect(normJsonString.tool_name).toBe('calculate_primer_properties');
      expect(normJsonString.parameters.primerSequence).toBe('ATGACC');
    });

    it('normalizeExpectedParameters should normalize expected parameters object or array', () => {
      const expected = {
        tool_sequence: ['design_primers'],
        parameters: [{ gene_name: 'lacZ', max_mismatches: 2 }],
      };

      const normalized = suite.normalizeExpectedParameters(expected);
      expect(normalized.parameters[0].geneName).toBe('lacZ');
      expect(normalized.parameters[0].maxMismatches).toBe(2);
    });
  });

  describe('Workflow Call Evaluation and Parameter Normalization Integration', () => {
    it('evaluateWorkflowCall should match track aliases and visible/action semantics', async () => {
      const actualResult = [
        {
          tool_name: 'toggle_track',
          parameters: {
            track_name: 'GC Content',
            action: 'show',
          },
        },
        {
          tool_name: 'toggle_track',
          parameters: {
            track_name: 'Variants',
            action: 'hide',
          },
        },
      ];

      const expectedResult = {
        tool_sequence: ['toggle_track', 'toggle_track'],
        parameters: [
          {
            trackName: 'gc',
            visible: true,
          },
          {
            trackName: 'Variants',
            visible: false,
          },
        ],
      };

      const testResult = {
        id: 'track_auto_complex_01',
        maxScore: 15,
        bonusScore: 3,
        category: 'track_control',
      };

      const evalResult = await suite.evaluateWorkflowCall(actualResult, expectedResult, testResult);
      expect(evalResult.success).toBe(true);
      expect(evalResult.score).toBeGreaterThanOrEqual(10);
      expect(evalResult.errors.length).toBe(0);
    });

    it('evaluateWorkflowCall should require duplicate workflow tools to be called multiple times', async () => {
      const actualResult = [
        { tool_name: 'get_track_status', parameters: {} },
        {
          tool_name: 'toggle_track',
          parameters: {
            track_name: 'GC Content',
            action: 'show',
          },
        },
        { tool_name: 'get_track_status', parameters: {} },
      ];

      const expectedResult = {
        tool_sequence: ['get_track_status', 'toggle_track', 'toggle_track', 'get_track_status'],
        parameters: [
          {},
          {
            trackName: 'gc',
            visible: true,
          },
          {
            trackName: 'Variants',
            visible: false,
          },
          {},
        ],
      };

      const testResult = {
        id: 'track_auto_complex_01',
        maxScore: 15,
        category: 'track_control',
      };

      const evalResult = await suite.evaluateWorkflowCall(actualResult, expectedResult, testResult);
      expect(evalResult.success).toBe(false);
      expect(evalResult.details.orderedMatches).toBe(3);
      expect(evalResult.errors.join(' ')).toContain('toggle_track');
    });

    it('evaluateWorkflowCall should fail workflows executed out of order', async () => {
      const actualResult = [
        {
          tool_name: 'zoom_in',
          parameters: {
            factor: 10,
          },
        },
        {
          tool_name: 'navigate_to_position',
          parameters: {
            start: 1230000,
            end: 1300000,
          },
        },
      ];

      const expectedResult = {
        tool_sequence: ['navigate_to_position', 'zoom_in'],
        parameters: [{ start: 1230000, end: 1300000 }, { factor: 10 }],
      };

      const testResult = {
        id: 'nav_auto_01',
        maxScore: 10,
        category: 'navigation',
      };

      const evalResult = await suite.evaluateWorkflowCall(actualResult, expectedResult, testResult);
      expect(evalResult.success).toBe(false);
      expect(evalResult.details.unorderedMatches).toBe(2);
      expect(evalResult.details.orderedMatches).toBe(1);
      expect(evalResult.errors.join(' ')).toContain('expected order');
    });

    it('evaluateWorkflowCall should fail when ordered tools have critical parameter mismatches', async () => {
      const actualResult = [
        { tool_name: 'get_track_status', parameters: {} },
        {
          tool_name: 'toggle_track',
          parameters: {
            trackName: 'Variants',
            visible: true,
          },
        },
      ];

      const expectedResult = {
        tool_sequence: ['get_track_status', 'toggle_track'],
        parameters: [
          {},
          {
            trackName: 'gc',
            visible: true,
          },
        ],
      };

      const testResult = {
        id: 'track_auto_complex_01',
        maxScore: 10,
        category: 'track_control',
      };

      const evalResult = await suite.evaluateWorkflowCall(actualResult, expectedResult, testResult);
      expect(evalResult.success).toBe(false);
      expect(evalResult.details.orderedMatches).toBe(2);
      expect(evalResult.errors.join(' ')).toContain('Critical parameters');
    });

    it('getRecentOrderedWorkflowMatches should consume tracker executions in order', () => {
      const now = Date.now();
      global.window.chatManager.toolExecutionTracker.getSessionExecutions = () => [
        {
          toolName: 'toggle_track',
          parameters: { trackName: 'GC Content', action: 'show' },
          status: 'completed',
          startTime: now - 3000,
        },
        {
          toolName: 'get_track_status',
          parameters: {},
          status: 'completed',
          startTime: now - 2000,
        },
      ];

      const match = suite.getRecentOrderedWorkflowMatches(['get_track_status', 'toggle_track'], 120000, [
        {},
        { trackName: 'gc', visible: true },
      ]);

      expect(match.unorderedMatches).toBe(2);
      expect(match.orderedMatches).toBe(1);
      expect(match.hasOutOfOrder).toBe(true);

      global.window.chatManager.toolExecutionTracker.getSessionExecutions = () => [];
    });

    it('evaluateWorkflowCall should accept chained tool result references for reused sequences', async () => {
      const actualResult = [
        { tool_name: 'navigate_to_position', parameters: { chromosome: 'U00096', start: 100000, end: 101000 } },
        { tool_name: 'get_sequence', parameters: { chromosome: 'U00096', start: 100000, end: 101000 } },
        { tool_name: 'calculate_entropy', parameters: { sequence: '{get_sequence.sequence}' } },
        { tool_name: 'reverse_complement', parameters: { sequence: '{{ get_sequence.sequence }}' } },
        { tool_name: 'translate_dna', parameters: { dna: 'ATGCGTATG', reading_frame: 1 } },
      ];

      const expectedResult = {
        tool_sequence: [
          ['navigate_to_position', 'navigate_to'],
          'get_sequence',
          'calculate_entropy',
          'reverse_complement',
          'translate_dna',
        ],
        parameters: [
          { start: 100000, end: 101000 },
          { start: 100000, end: 101000 },
          { sequence: '{get_sequence.sequence}' },
          { sequence: '{get_sequence.sequence}' },
          { dna: '{get_sequence.sequence}', readingFrame: 1 },
        ],
      };

      const testResult = {
        id: 'analysis_auto_complex_05',
        maxScore: 20,
        category: 'sequence_analysis',
      };

      const evalResult = await suite.evaluateWorkflowCall(actualResult, expectedResult, testResult);
      expect(evalResult.success).toBe(true);
      expect(evalResult.details.orderedMatches).toBe(5);
      expect(evalResult.details.criticalParameterMatches).toBe(evalResult.details.criticalParameterSteps);
    });

    it('tool result reference expectations should not be treated as concrete critical parameters', () => {
      expect(suite.isToolResultReferenceValue('{get_sequence.sequence}')).toBe(true);
      expect(suite.isToolResultReferenceValue('{{ get_sequence.sequence }}')).toBe(true);
      expect(suite.hasConcreteExpectedValue('{get_sequence.sequence}')).toBe(false);
      expect(suite.workflowParametersMatch({ sequence: 'ATGCGT' }, { sequence: '{get_sequence.sequence}' })).toBe(true);
      expect(
        suite.workflowParametersMatch(
          { fragments: '{{ virtual_digest.fragmentDetails }}' },
          { fragments: '{virtual_digest.fragmentDetails}' }
        )
      ).toBe(true);
    });
  });

  describe('Natural Language Workflow Response Parser Routing', () => {
    it('should route navigation category to parseNaturalLanguageNavigationResponse', async () => {
      const actualResult = 'Navigated to position 1230000 to 1300000 and zoom in 10x';
      const expectedResult = {
        tool_sequence: ['navigate_to_position', 'zoom_in'],
        parameters: [{ start: 1230000, end: 1300000 }, { factor: 10 }],
      };
      const testResult = {
        id: 'nav_auto_01',
        category: 'navigation',
        maxScore: 10,
      };

      const evalResult = await suite.evaluateWorkflowCall(actualResult, expectedResult, testResult);
      expect(evalResult.success).toBe(true);
      expect(evalResult.score).toBe(10); // Fully matches navigation + coordinates + zoom patterns
    });

    it('should route non-navigation category to parseNaturalLanguageWorkflowResponse', async () => {
      const actualResult =
        'I have successfully created annotation regulatory_region_a, ' +
        'then description was updated, and listed annotations';
      const expectedResult = {
        tool_sequence: ['create_annotation', 'update_annotation', 'list_annotations'],
        parameters: [{}, {}, {}],
      };
      const testResult = {
        id: 'annotation_auto_complex_01',
        category: 'annotations',
        maxScore: 15,
      };

      const evalResult = await suite.evaluateWorkflowCall(actualResult, expectedResult, testResult);
      expect(evalResult.success).toBe(true);
      expect(evalResult.score).toBe(15); // Matches all three success patterns in toolSuccessPatterns
      expect(evalResult.errors.length).toBe(0);
    });

    it('should calculate partial scores in parseNaturalLanguageWorkflowResponse based on matching tools', async () => {
      // Only created annotation is mentioned, other tools are missing
      const actualResult = 'Created annotation regulatory_region_a successfully.';
      const expectedResult = {
        tool_sequence: ['create_annotation', 'update_annotation', 'list_annotations'],
        parameters: [{}, {}, {}],
      };
      const testResult = {
        id: 'annotation_auto_complex_01',
        category: 'annotations',
        maxScore: 15,
      };

      const evalResult = await suite.evaluateWorkflowCall(actualResult, expectedResult, testResult);
      // Tool matches = 1/3. Baseline = 15 * 0.3 = 5 (since 'successfully' is present). Remaining points = 15 - 5 = 10.
      // Tool score = floor(10 * 1/3) = 3. Total score = 8/15.
      expect(evalResult.score).toBe(8);
      expect(evalResult.success).toBe(false); // Complex workflows now require at least 60% tool coverage.
    });
  });

  describe('Authoritative execution-data tool detection (GC + Export regression)', () => {
    it('extractWorkflowCalls must not let text `steps` shadow real executed tool calls', () => {
      // Shape produced by LLMBenchmarkFramework.parseTestResponse: a final assistant
      // text yields plain-string `steps`, while the real tools live in executedFunctionCalls.
      const parsedResponse = {
        content: 'I calculated the GC content and exported the region features to a BED file.',
        steps: ['Calculate the GC content for the current view region', 'Export the region features to a BED file'],
        functionCalls: [],
        executedFunctionCalls: [
          { tool_name: 'calc_region_gc', parameters: {}, success: true },
          {
            tool_name: 'export_bed_format',
            parameters: { filePath: '/tmp/region_features.bed' },
            success: true,
          },
        ],
      };

      const calls = suite.extractWorkflowCalls(parsedResponse);
      expect(calls.map(c => suite.getToolNameFromCall(c))).toEqual(['calc_region_gc', 'export_bed_format']);
    });

    it('evaluateWorkflowCall detects the GC+export workflow from execution data, not response text', async () => {
      const actualResult = {
        content: 'Done: GC content computed and features exported.',
        // Text-only heuristics would extract these strings and find no tool names.
        steps: ['Calculated GC content', 'Exported BED file'],
        functionCalls: [],
        executedFunctionCalls: [
          { tool_name: 'calc_region_gc', parameters: {}, success: true },
          {
            tool_name: 'export_bed_format',
            parameters: { filePath: '/Users/song/Documents/exported_files/region_features.bed' },
            success: true,
          },
        ],
      };
      const expectedResult = {
        tool_sequence: ['calc_region_gc', 'export_bed_format'],
        parameters: [{}, { filePath: '/Users/song/Documents/exported_files/region_features.bed' }],
      };
      const testResult = { id: 'analysis_auto_01', category: 'sequence_analysis', maxScore: 10, bonusScore: 2 };

      const evalResult = await suite.evaluateWorkflowCall(actualResult, expectedResult, testResult);
      expect(evalResult.success).toBe(true);
      expect(evalResult.details.orderedMatches).toBe(2);
      expect(evalResult.errors.length).toBe(0);
    });

    it('getTrackedExecutions falls back to ChatManager.getLastExecutionData() when the tracker is empty', () => {
      const previous = global.window.chatManager.getLastExecutionData;
      global.window.chatManager.getLastExecutionData = () => ({
        startTime: Date.now(),
        functionCalls: [
          { tool_name: 'calc_region_gc', parameters: {}, timestamp: new Date().toISOString() },
          {
            tool_name: 'export_bed_format',
            parameters: { filePath: '/tmp/region_features.bed' },
            timestamp: new Date().toISOString(),
          },
        ],
        toolResults: [
          { tool: 'calc_region_gc', success: true },
          { tool: 'export_bed_format', success: true },
        ],
      });

      try {
        const executions = suite.getTrackedExecutions();
        expect(executions.map(e => e.toolName)).toEqual(['calc_region_gc', 'export_bed_format']);
        expect(executions.every(e => e.status === 'completed')).toBe(true);

        // A failed tool result must be reflected as a failed execution.
        global.window.chatManager.getLastExecutionData = () => ({
          startTime: Date.now(),
          functionCalls: [{ tool_name: 'export_bed_format', parameters: {}, timestamp: new Date().toISOString() }],
          toolResults: [{ tool: 'export_bed_format', success: false, error: 'write failed' }],
        });
        const failed = suite.getTrackedExecutions();
        expect(failed[0].status).toBe('failed');
      } finally {
        global.window.chatManager.getLastExecutionData = previous;
      }
    });
  });
});
