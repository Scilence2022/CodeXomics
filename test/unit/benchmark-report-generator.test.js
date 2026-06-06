import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const REPORT_GENERATOR_PATH = path.join(process.cwd(), 'src/renderer/modules/BenchmarkReportGenerator.js');

function loadBenchmarkReportGenerator() {
  const source = fs.readFileSync(REPORT_GENERATOR_PATH, 'utf-8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window.BenchmarkReportGenerator;
}

describe('BenchmarkReportGenerator', () => {
  it('generates suite analysis for setup failures with minimal stats', () => {
    const BenchmarkReportGenerator = loadBenchmarkReportGenerator();
    const generator = new BenchmarkReportGenerator();

    const analysis = generator.generateDetailedAnalysis({
      overallStats: {
        trendAnalysis: {},
        correlationAnalysis: { insights: [] },
      },
      testSuiteResults: [
        {
          suiteId: 'automatic_simple',
          suiteName: 'Automatic Simple',
          testResults: [],
          stats: { totalTests: 0, passedTests: 0, failedTests: 0, averageScore: 0 },
          error: "Blocked renderer require('fs') after security hardening",
        },
      ],
    });

    expect(analysis.testSuiteBreakdown).toHaveLength(1);
    expect(analysis.testSuiteBreakdown[0].summary.averageScore).toBe(0);
    expect(analysis.testSuiteBreakdown[0].strengths).not.toContain('Low error rate');
    expect(analysis.testSuiteBreakdown[0].weaknesses).toContain('High error rate');
    expect(analysis.categoryAnalysis.Other.testCount).toBe(0);
    expect(analysis.categoryAnalysis.Other.averageDuration).toBe(0);
  });

  it('filters LLM interaction analysis to failed interactions when requested', () => {
    const BenchmarkReportGenerator = loadBenchmarkReportGenerator();
    const generator = new BenchmarkReportGenerator();

    const benchmarkResults = {
      testSuiteResults: [
        {
          suiteId: 'automatic_simple',
          suiteName: 'Automatic Simple',
          testResults: [
            {
              testId: 'pass_01',
              testName: 'Passing test',
              success: true,
              status: 'passed',
              llmInteractionData: {
                testId: 'pass_01',
                request: { provider: 'openai', model: 'gpt-test' },
                response: { responseTime: 100, tokenUsage: { totalTokens: 10 } },
                analysis: { isError: false, confidence: 90 },
              },
            },
            {
              testId: 'error_01',
              testName: 'Errored interaction',
              success: false,
              status: 'failed',
              llmInteractionData: {
                testId: 'error_01',
                request: { provider: 'openai', model: 'gpt-test' },
                response: { responseTime: 200, tokenUsage: { totalTokens: 20 } },
                analysis: { isError: true, confidence: 0 },
              },
            },
            {
              testId: 'score_fail_01',
              testName: 'Failed evaluation',
              success: false,
              status: 'failed',
              llmInteractionData: {
                testId: 'score_fail_01',
                request: { provider: 'anthropic', model: 'claude-test' },
                response: { responseTime: 300, tokenUsage: { totalTokens: 30 } },
                analysis: { isError: false, confidence: 55 },
              },
            },
          ],
        },
      ],
    };

    const analysis = generator.generateLLMInteractionAnalysis(benchmarkResults, { failedOnly: true });

    expect(analysis.summary.totalInteractions).toBe(2);
    expect(analysis.summary.successfulInteractions).toBe(1);
    expect(analysis.summary.failedInteractions).toBe(1);
    expect(analysis.providerAnalysis.openai.interactions).toBe(1);
    expect(analysis.providerAnalysis.anthropic.interactions).toBe(1);
  });
});
