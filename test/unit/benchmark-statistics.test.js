import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const STATISTICS_PATH = path.join(process.cwd(), 'src/renderer/modules/BenchmarkStatistics.js');

function loadBenchmarkStatistics() {
  const source = fs.readFileSync(STATISTICS_PATH, 'utf-8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window.BenchmarkStatistics;
}

describe('BenchmarkStatistics dynamic tools analysis', () => {
  it('summarizes dynamic tool counts and estimated token savings per prompt', () => {
    const BenchmarkStatistics = loadBenchmarkStatistics();
    const statistics = new BenchmarkStatistics();

    const suiteStats = statistics.calculateSuiteStatistics([
      {
        testId: 'nav_01',
        testName: 'Navigate to position',
        suiteId: 'automatic_simple',
        success: true,
        status: 'passed',
        score: 5,
        maxScore: 5,
        duration: 100,
        errors: [],
        warnings: [],
        metrics: {},
        llmInteractionDataSummary: {
          dynamicToolsAnalysis: {
            mode: 'dynamic',
            selectedToolCount: 12,
            selectedBuiltInToolCount: 9,
            selectedRegistryToolCount: 2,
            selectedPluginToolCount: 1,
            baselineToolCount: 180,
            promptTokenEstimate: 1200,
            baselineTokenEstimate: 6000,
            estimatedTokensSaved: 4800,
            estimatedPercentSaved: 80,
            selectedToolsByCategory: { navigation: 8, sequence: 4 },
            selectedToolNames: ['go_to_position'],
          },
        },
      },
      {
        testId: 'file_01',
        testName: 'Load file',
        suiteId: 'automatic_simple',
        success: false,
        status: 'failed',
        score: 1,
        maxScore: 5,
        duration: 200,
        errors: ['Wrong tool'],
        warnings: [],
        metrics: {},
        llmInteractionDataSummary: {
          dynamicToolsAnalysis: {
            mode: 'dynamic',
            selectedToolCount: 20,
            selectedBuiltInToolCount: 15,
            selectedRegistryToolCount: 5,
            selectedPluginToolCount: 0,
            baselineToolCount: 180,
            promptTokenEstimate: 1500,
            baselineTokenEstimate: 6500,
            estimatedTokensSaved: 5000,
            estimatedPercentSaved: 76.923,
          },
        },
      },
    ]);

    expect(suiteStats.dynamicToolsAnalysis.available).toBe(true);
    expect(suiteStats.dynamicToolsAnalysis.analyzedPrompts).toBe(2);
    expect(suiteStats.dynamicToolsAnalysis.selectedToolCount.mean).toBe(16);
    expect(suiteStats.dynamicToolsAnalysis.tokenSavings.total).toBe(9800);
    expect(suiteStats.dynamicToolsAnalysis.topTokenSavingPrompts[0].testId).toBe('file_01');
    expect(suiteStats.dynamicToolsAnalysis.perPrompt[0]).toMatchObject({
      testId: 'nav_01',
      selectedToolCount: 12,
      estimatedTokensSaved: 4800,
    });
  });
});
