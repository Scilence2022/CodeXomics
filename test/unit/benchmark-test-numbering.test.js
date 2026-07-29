import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const ROOT = process.cwd();

function readSource(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf-8');
}

function loadReportGenerator() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(readSource('src/renderer/modules/BenchmarkReportGenerator.js'), sandbox);
  return sandbox.window.BenchmarkReportGenerator;
}

function loadEvaluatorBase() {
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(readSource('src/renderer/modules/benchmark-suites/BenchmarkEvaluatorBase.js'), sandbox);
  return sandbox.window.BenchmarkEvaluatorBase;
}

describe('benchmark test numbering', () => {
  it('numbers tests in declaration order', () => {
    const BenchmarkEvaluatorBase = loadEvaluatorBase();
    const suite = new BenchmarkEvaluatorBase();

    const tests = suite.numberTests([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);

    expect(tests.map(test => test.number)).toEqual([1, 2, 3]);
  });

  it('renumbers in place when a suite regenerates its tests', () => {
    const BenchmarkEvaluatorBase = loadEvaluatorBase();
    const suite = new BenchmarkEvaluatorBase();

    // setConfiguration() rebuilds the test array with updated paths; the rebuilt
    // array must come back numbered, not carrying stale or missing numbers.
    const regenerated = suite.numberTests([{ id: 'b', number: 7 }, { id: 'a' }]);

    expect(regenerated.map(test => test.number)).toEqual([1, 2]);
  });

  it('carries the test number onto every test result the framework produces', () => {
    const source = readSource('src/renderer/modules/LLMBenchmarkFramework.js');
    const runSingleTest = source.slice(source.indexOf('async runSingleTest('), source.indexOf('async executeTest('));

    // Both the cancelled-test short circuit and the normal result object, so a
    // stopped run is still traceable to a number.
    expect(runSingleTest.match(/testNumber: test\.number \|\| null/g) || []).toHaveLength(2);

    // The slim copy is what survives into reports, exports and the results list.
    expect(source).toContain('testNumber: result.testNumber || null');
  });

  it('passes the test number to progress listeners so the UI can label the running test', () => {
    const framework = readSource('src/renderer/modules/LLMBenchmarkFramework.js');
    const ui = readSource('src/renderer/modules/BenchmarkUI.js');

    expect(framework).toContain('options.onTestProgress(overallTestProgress, test.id, null, suiteId, test.number');
    expect(framework).toContain(
      'options.onTestProgress(overallTestProgress, test.id, testResult, suiteId, test.number'
    );
    expect(ui).toContain('updateMainWindowTestProgress(progress, testId, testResult, suiteId, testNumber)');
  });

  it('formats numbered and unnumbered labels consistently', () => {
    const sandbox = { window: {}, console };
    vm.createContext(sandbox);
    vm.runInContext(readSource('src/renderer/modules/BenchmarkUI.js'), sandbox);

    // Formatting needs no UI state, so exercise it off the prototype instead of
    // constructing a BenchmarkUI (which wires up DOM event handlers).
    const ui = Object.create(sandbox.window.BenchmarkUI.prototype);

    expect(ui.formatTestNumber(12)).toBe('#12');
    expect(ui.formatTestNumber({ testNumber: 3 })).toBe('#3');
    expect(ui.formatTestNumber({ number: 4 })).toBe('#4');
    expect(ui.formatTestNumber(null)).toBe('');
    expect(ui.formatTestNumber({})).toBe('');
    expect(ui.formatTestLabel(12, 'Set Working Directory')).toBe('#12 Set Working Directory');
    expect(ui.formatTestLabel(null, 'Set Working Directory')).toBe('Set Working Directory');
  });

  it('includes a Test # column in the exported CSV report', () => {
    const BenchmarkReportGenerator = loadReportGenerator();
    const generator = new BenchmarkReportGenerator();

    const csv = generator.generateCSVReport({
      testSuiteResults: [
        {
          suiteName: 'Automatic Simple',
          testResults: [
            {
              testId: 'sys_auto_02',
              testNumber: 2,
              testName: 'List Available Tools',
              success: false,
              score: 0,
              maxScore: 5,
              duration: 1200,
              errors: ['no tool call'],
              warnings: [],
            },
          ],
        },
      ],
    });

    const [header, row] = csv.split('\n');

    expect(header).toContain('"Test #"');
    expect(header.split(',').indexOf('"Test #"')).toBe(1);
    expect(row.split(',')[1]).toBe('"2"');
    expect(row).toContain('"sys_auto_02"');
  });

  it('labels failed tests with their number in the results list', () => {
    const ui = readSource('src/renderer/modules/BenchmarkUI.js');

    expect(ui).toContain('${this.formatTestLabel(test, test.testName)}');
    expect(ui).toContain('\\${this.formatTestLabel(test, test.testName)}');
  });
});
