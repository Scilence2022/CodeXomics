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
});
