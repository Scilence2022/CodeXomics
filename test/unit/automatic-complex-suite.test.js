/* eslint-disable no-new-func */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';

const BASE_EVALUATOR_PATH = path.join(
  process.cwd(),
  'src/renderer/modules/benchmark-suites/BenchmarkEvaluatorBase.js'
);
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
        }
      }
    }
  };

  // Run the base evaluator code
  const runBase = new Function(
    'window',
    `${baseCode}; return window.BenchmarkEvaluatorBase;`
  );
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

      // Total of 19 tests expected
      expect(tests.length).toBe(19);

      // Verify the new complex test cases exist
      expect(testIds).toContain('annotation_auto_complex_01');
      expect(testIds).toContain('track_auto_complex_01');
      expect(testIds).toContain('protein_auto_complex_01');
      expect(testIds).toContain('blast_auto_complex_01');
      expect(testIds).toContain('primer_auto_complex_01');
      expect(testIds).toContain('protein_auto_complex_02');
      expect(testIds).toContain('analysis_auto_complex_05');

      // Verify details of one new test case
      const annotationTest = tests.find(t => t.id === 'annotation_auto_complex_01');
      expect(annotationTest.type).toBe('workflow');
      expect(annotationTest.category).toBe('annotations');
      expect(annotationTest.complexity).toBe('complex');
      expect(annotationTest.evaluation).toBe('automatic');
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
            'max-mismatches': 2
          }
        },
        array_val: [
          { 'item-id-kebab': 1, detailed_info: 'test' },
          { item_id: 2 }
        ]
      };

      const expected = {
        trackName: 'GC Content',
        trackNameKebab: 'Kebab GC',
        simpleKey: 123,
        nestedObjectKebab: {
          uniprotId: 'P04637',
          anotherNested: {
            maxMismatches: 2
          }
        },
        arrayVal: [
          { itemIdKebab: 1, detailedInfo: 'test' },
          { itemId: 2 }
        ]
      };

      const result = suite.normalizeParameterKeys(input);
      expect(result).toEqual(expected);
    });

    it('normalizeResultParameters should normalize parameters, handling alternative properties/JSON', () => {
      const singleCall = {
        tool_name: 'toggle_track',
        params: { // using 'params' instead of 'parameters'
          'track-name': 'GC Content',
          action_type: 'show'
        }
      };

      const jsonParamsCall = {
        tool_name: 'design_primers',
        arguments: '{"gene-name": "lacZ", "max_mismatches": 2}' // JSON string in 'arguments'
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
        parameters: [
          { gene_name: 'lacZ', max_mismatches: 2 }
        ]
      };

      const normalized = suite.normalizeExpectedParameters(expected);
      expect(normalized.parameters[0].geneName).toBe('lacZ');
      expect(normalized.parameters[0].maxMismatches).toBe(2);
    });
  });

  describe('Workflow Call Evaluation and Parameter Normalization Integration', () => {
    it('evaluateWorkflowCall should match parameters even with snake_case/camelCase mismatch', async () => {
      const actualResult = [
        {
          tool_name: 'toggle_track',
          parameters: {
            track_name: 'GC Content',
            action: 'show'
          }
        },
        {
          tool_name: 'toggle_track',
          parameters: {
            track_name: 'Variants',
            action: 'hide'
          }
        }
      ];

      const expectedResult = {
        tool_sequence: ['toggle_track', 'toggle_track'],
        parameters: [
          {
            trackName: 'GC Content',
            action: 'show'
          },
          {
            trackName: 'Variants',
            action: 'hide'
          }
        ]
      };

      const testResult = {
        id: 'track_auto_complex_01',
        maxScore: 15,
        bonusScore: 3,
        category: 'track_control'
      };

      const evalResult = await suite.evaluateWorkflowCall(actualResult, expectedResult, testResult);
      expect(evalResult.success).toBe(true);
      expect(evalResult.score).toBeGreaterThanOrEqual(10);
      expect(evalResult.errors.length).toBe(0);
    });
  });

  describe('Natural Language Workflow Response Parser Routing', () => {
    it('should route navigation category to parseNaturalLanguageNavigationResponse', async () => {
      const actualResult = 'Navigated to position 1230000 to 1300000 and zoom in 10x';
      const expectedResult = {
        tool_sequence: ['navigate_to_position', 'zoom_in'],
        parameters: [
          { start: 1230000, end: 1300000 },
          { factor: 10 }
        ]
      };
      const testResult = {
        id: 'nav_auto_01',
        category: 'navigation',
        maxScore: 10
      };

      const evalResult = await suite.evaluateWorkflowCall(actualResult, expectedResult, testResult);
      expect(evalResult.success).toBe(true);
      expect(evalResult.score).toBe(10); // Fully matches navigation + coordinates + zoom patterns
    });

    it('should route non-navigation category to parseNaturalLanguageWorkflowResponse', async () => {
      const actualResult = 'I have successfully created annotation regulatory_region_a, ' +
        'then description was updated, and listed annotations';
      const expectedResult = {
        tool_sequence: ['create_annotation', 'update_annotation', 'list_annotations'],
        parameters: [{}, {}, {}]
      };
      const testResult = {
        id: 'annotation_auto_complex_01',
        category: 'annotations',
        maxScore: 15
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
        parameters: [{}, {}, {}]
      };
      const testResult = {
        id: 'annotation_auto_complex_01',
        category: 'annotations',
        maxScore: 15
      };

      const evalResult = await suite.evaluateWorkflowCall(actualResult, expectedResult, testResult);
      // Tool matches = 1/3. Baseline = 15 * 0.3 = 5 (since 'successfully' is present). Remaining points = 15 - 5 = 10.
      // Tool score = floor(10 * 1/3) = 3. Total score = 8/15.
      expect(evalResult.score).toBe(8);
      expect(evalResult.success).toBe(true); // 8/15 >= 6 (40% threshold)
    });
  });
});
