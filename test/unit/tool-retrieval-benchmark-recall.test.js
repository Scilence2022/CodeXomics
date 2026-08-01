/* eslint-disable no-new-func */
import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const DynamicToolsSnapshotAdapter = require('../../src/renderer/modules/DynamicToolsSnapshotAdapter.js');
const manifest = require('../../tools_registry/generated/tool-registry-manifest.json');

function loadSuites() {
  const basePath = path.join(process.cwd(), 'src/renderer/modules/benchmark-suites/BenchmarkEvaluatorBase.js');
  const windowMock = {
    songBenchmarkDebug: { detectedTools: [] },
    benchmarkUI: { getDefaultDirectory: () => './test_data/' },
    chatManager: { toolExecutionTracker: { getSessionExecutions: () => [] } },
  };
  const baseSource = fs.readFileSync(basePath, 'utf8');
  const Base = new Function('window', `${baseSource}; return window.BenchmarkEvaluatorBase;`)(windowMock);
  const load = (filename, className) => {
    const source = fs.readFileSync(path.join(path.dirname(basePath), filename), 'utf8');
    return new (new Function('window', 'BenchmarkEvaluatorBase', `${source}; return window.${className};`)(
      windowMock,
      Base
    ))();
  };
  return {
    simple: load('AutomaticSimpleSuite.js', 'AutomaticSimpleSuite'),
    complex: load('AutomaticComplexSuite.js', 'AutomaticComplexSuite'),
  };
}

function assertCoverage(suite, limit) {
  const adapter = new DynamicToolsSnapshotAdapter(manifest, { agentSystemEnabled: false });
  for (const test of suite.getTests()) {
    const expected = Array.isArray(test.expectedResult?.tool_sequence)
      ? test.expectedResult.tool_sequence
      : [test.expectedResult?.tool_name].filter(Boolean);
    const selected = adapter.selectRelevantTools(test.instruction, {}, limit).map(tool => tool.name);
    for (const step of expected) {
      const alternatives = Array.isArray(step) ? step : [step];
      expect(
        alternatives.some(name => selected.includes(name)),
        `${test.id} missing ${alternatives.join('|')} from Top-${limit}`
      ).toBe(true);
    }
  }
}

describe('automatic benchmark retrieval gates', () => {
  it('covers all 143 simple cases at Top-8', () => {
    const { simple } = loadSuites();
    expect(simple.getTests()).toHaveLength(143);
    assertCoverage(simple, 8);
  });

  it('covers every expected step in all 29 complex cases at Top-24', () => {
    const { complex } = loadSuites();
    expect(complex.getTests()).toHaveLength(29);
    assertCoverage(complex, 24);
  });
});
