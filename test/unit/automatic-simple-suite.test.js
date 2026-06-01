/* eslint-disable no-new-func */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';

const BASE_EVALUATOR_PATH = path.join(process.cwd(), 'src/renderer/modules/benchmark-suites/BenchmarkEvaluatorBase.js');
const AUTOMATIC_SIMPLE_PATH = path.join(process.cwd(), 'src/renderer/modules/benchmark-suites/AutomaticSimpleSuite.js');

function loadAutomaticSimpleSuite() {
  const baseCode = fs.readFileSync(BASE_EVALUATOR_PATH, 'utf-8');
  const suiteCode = fs.readFileSync(AUTOMATIC_SIMPLE_PATH, 'utf-8');

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
    `${suiteCode}; return window.AutomaticSimpleSuite;`
  );
  return runSuite(global.window, global.BenchmarkEvaluatorBase);
}

describe('AutomaticSimpleSuite', () => {
  let AutomaticSimpleSuiteClass;
  let suite;

  beforeAll(() => {
    AutomaticSimpleSuiteClass = loadAutomaticSimpleSuite();
    suite = new AutomaticSimpleSuiteClass();
  });

  describe('Initialization and Config', () => {
    it('should initialize suite metadata correctly', () => {
      expect(suite.getName()).toBe('Automatic Simple Tests');
      expect(suite.suiteId).toBe('automatic_simple');
      expect(suite.getTests()).toBeInstanceOf(Array);
    });

    it('should contain the new UI style switching test cases', () => {
      const tests = suite.getTests();
      const testIds = tests.map(t => t.id);

      // Verify the new style switching test cases exist
      expect(testIds).toContain('settings_auto_05');
      expect(testIds).toContain('settings_auto_06');

      // Verify details of settings_auto_05 (Switch UI Style Theme)
      const test05 = tests.find(t => t.id === 'settings_auto_05');
      expect(test05.type).toBe('function_call');
      expect(test05.category).toBe('system');
      expect(test05.complexity).toBe('simple');
      expect(test05.evaluation).toBe('automatic');
      expect(test05.expectedResult.tool_name).toBe('switch_ui_style');
      expect(test05.expectedResult.parameters.style_name).toBe('professional');

      // Verify details of settings_auto_06 (Switch to Midnight Mode)
      const test06 = tests.find(t => t.id === 'settings_auto_06');
      expect(test06.type).toBe('function_call');
      expect(test06.category).toBe('system');
      expect(test06.complexity).toBe('simple');
      expect(test06.evaluation).toBe('automatic');
      expect(test06.expectedResult.tool_name).toBe('switch_ui_style');
      expect(test06.expectedResult.parameters.style_name).toBe('midnight');
      expect(test06.expectedResult.parameters).not.toHaveProperty('dark_mode');
    });

    it('should resolve default directory fallback and build paths correctly', () => {
      // Custom default directory fallback check
      expect(suite.getDefaultDirectory()).toBe('/Users/song/Documents/Genome-AI-Studio-Projects/test_data/');
      expect(suite.buildFilePath('ECOLI.gbk')).toBe(
        '/Users/song/Documents/Genome-AI-Studio-Projects/test_data/ECOLI.gbk'
      );

      // Set custom directory
      suite.setConfiguration({ defaultDirectory: '/custom/dir' });
      expect(suite.getDefaultDirectory()).toBe('/custom/dir');
      expect(suite.buildFilePath('ECOLI.gbk')).toBe('/custom/dir/ECOLI.gbk');
    });
  });

  describe('Evaluation Logic', () => {
    it('evaluateBasicFunctionCall should successfully evaluate matching tool and params', async () => {
      const testResult = {
        testId: 'settings_auto_05',
        testName: 'Switch UI Style Theme',
        maxScore: 5,
        bonusScore: 1,
      };

      const expectedResult = {
        tool_name: 'switch_ui_style',
        parameters: {
          style_name: 'professional',
        },
      };

      const actualResult = {
        tool_name: 'switch_ui_style',
        parameters: {
          style_name: 'professional',
        },
      };

      const evalResult = await suite.evaluateBasicFunctionCall(actualResult, expectedResult, testResult);
      expect(evalResult.success).toBe(true);
      expect(evalResult.score).toBe(5);
    });

    it('evaluateBasicFunctionCall should deduct score on incorrect parameters', async () => {
      const testResult = {
        testId: 'settings_auto_05',
        testName: 'Switch UI Style Theme',
        maxScore: 5,
        bonusScore: 1,
      };

      const expectedResult = {
        tool_name: 'switch_ui_style',
        parameters: {
          style_name: 'professional',
        },
      };

      const actualResult = {
        tool_name: 'switch_ui_style',
        parameters: {
          style_name: 'midnight', // Incorrect theme
        },
      };

      const evalResult = await suite.evaluateBasicFunctionCall(actualResult, expectedResult, testResult);
      expect(evalResult.score).toBeLessThan(5);
    });

    it('evaluateBasicFunctionCall should fail evaluation on wrong tool name', async () => {
      const testResult = {
        testId: 'settings_auto_05',
        testName: 'Switch UI Style Theme',
        maxScore: 5,
        bonusScore: 1,
      };

      const expectedResult = {
        tool_name: 'switch_ui_style',
        parameters: {
          style_name: 'professional',
        },
      };

      const actualResult = {
        tool_name: 'toggle_settings_modal', // Incorrect tool
        parameters: {
          action: 'open',
        },
      };

      const evalResult = await suite.evaluateBasicFunctionCall(actualResult, expectedResult, testResult);
      expect(evalResult.success).toBe(false);
      expect(evalResult.score).toBe(0);
    });
  });
});
