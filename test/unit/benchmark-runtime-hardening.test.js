import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();

function readSource(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf-8');
}

describe('benchmark runtime hardening', () => {
  it('sets ChatBox working directory through path-info IPC in hardened renderer', () => {
    const source = readSource('src/renderer/modules/ChatManager.js');
    const methodStart = source.indexOf('async setWorkingDirectory');
    const methodEnd = source.indexOf('/**\n   * Get current working directory', methodStart);
    const methodSource = source.slice(methodStart, methodEnd);

    expect(source).toContain('approveWorkingDirectory');
    expect(source).toContain('window.electronAPI?.getSelectedFileInfo');
    expect(source).toContain('infoResult.info?.isDirectory');
    expect(methodSource).not.toMatch(/\brequire\(['"]fs['"]\)/);
    expect(methodSource).not.toMatch(/\brequire\(['"]path['"]\)/);
    expect(methodSource).not.toMatch(/\brequire\(['"]os['"]\)/);
  });

  it('downloads to the working directory only after approving it through main IPC', () => {
    const source = readSource('src/renderer/modules/chat/services/FileOperationService.js');

    expect(source).toContain('usingWorkingDirectoryDestination');
    expect(source).toContain('window.electronAPI?.approveWorkingDirectory');
    expect(source).toContain('window.electronAPI.downloadInternetFile');
  });

  it('writes BLAST temporary FASTA files through main-process file IPC', () => {
    const source = readSource('src/renderer/modules/BlastManager.js');
    const writeSequenceStart = source.indexOf('async writeSequenceToFile');
    const writeSequenceEnd = source.indexOf('generateEnhancedMockResults', writeSequenceStart);
    const writeSequenceSource = source.slice(writeSequenceStart, writeSequenceEnd);
    const tempFastaStart = source.indexOf('async createTempFastaFile');
    const tempFastaEnd = source.indexOf('buildBlastCommand', tempFastaStart);
    const tempFastaSource = source.slice(tempFastaStart, tempFastaEnd);

    expect(source).toContain('writeTextFileViaMain');
    expect(writeSequenceSource).not.toContain("require('fs')");
    expect(writeSequenceSource).not.toContain('require("fs")');
    expect(tempFastaSource).not.toContain("require('fs')");
    expect(tempFastaSource).not.toContain('require("fs")');
  });

  it('prevents benchmark automation from opening file chooser dialogs', () => {
    const source = readSource('src/renderer/modules/chat/services/FileOperationService.js');

    expect(source).toContain('benchmarkAutomationActive');
    expect(source).toContain('requires an explicit filePath during benchmark automation');
    expect(source).toContain('parameters.file_path');
  });

  it('does not use renderer fs fallback in benchmark cleanup or file verification', () => {
    const simpleSuite = readSource('src/renderer/modules/benchmark-suites/AutomaticSimpleSuite.js');
    const complexSuite = readSource('src/renderer/modules/benchmark-suites/AutomaticComplexSuite.js');
    const evaluator = readSource('src/renderer/modules/benchmark-suites/BenchmarkEvaluatorBase.js');
    const combinedSource = [simpleSuite, complexSuite, evaluator].join('\n');

    expect(combinedSource).not.toMatch(/\brequire\(['"]fs['"]\)/);
    expect(combinedSource).toContain('filesystem access is main-process only');
    expect(evaluator).toContain('window.electronAPI.checkFileExists');
  });

  it('keeps a run-level ToolExecutionTracker session during benchmark execution', () => {
    const source = readSource('src/renderer/modules/LLMBenchmarkFramework.js');

    expect(source).toContain('benchmark_run_');
    expect(source).toContain('Started run-level tracker session');
    expect(source).toContain('createdTrackerSessionForTest');
  });

  it('persists benchmark interaction data only through preload file IPC', () => {
    const source = readSource('src/renderer/modules/LLMBenchmarkFramework.js');
    const persistStart = source.indexOf('async persistInteractionDataToDisk');
    const loadStart = source.indexOf('async loadInteractionDataFromDisk');
    const persistSource = source.slice(persistStart, loadStart);
    const loadEnd = source.indexOf('/**\n   * MEMORY SAFETY', loadStart);
    const loadSource = source.slice(loadStart, loadEnd);

    expect(source).toContain('getPathModule()');
    expect(persistSource).toContain('electronAPI.writeFile');
    expect(persistSource).toContain('electronAPI.ensureDirectory');
    expect(persistSource).toContain('electronAPI.writeFile is unavailable');
    expect(loadSource).toContain('window.electronAPI?.readFile');
    expect(persistSource).not.toMatch(/\brequire\(['"]fs['"]\)/);
    expect(persistSource).not.toMatch(/\brequire\(['"]path['"]\)/);
    expect(loadSource).not.toMatch(/\brequire\(['"]fs['"]\)/);
  });

  it('path info IPC returns file and directory type metadata', () => {
    const source = readSource('src/main/ipc-handlers.js');

    expect(source).toContain('isDirectory: stats.isDirectory()');
    expect(source).toContain('isFile: stats.isFile()');
  });

  it('recovers partial execution data on timeout instead of an empty skeleton', () => {
    const framework = readSource('src/renderer/modules/LLMBenchmarkFramework.js');

    expect(framework).toContain('reconstructInteractionDataFromPartialExecution');
    expect(framework).toContain('timeout_partial_execution');
    expect(framework).toContain('tracker.getTestExecutions(test.id)');
    // The recovery path must consult request-scoped execution data, not only
    // conversation history / lastResponse, or timed-out tests lose all calls.
    const recoveryStart = framework.indexOf('async attemptToRecoverLLMInteractionData');
    const recoveryEnd = framework.indexOf('reconstructInteractionDataFromPartialExecution', recoveryStart);
    const recoverySource = framework.slice(recoveryStart, recoveryEnd);
    expect(recoverySource).toContain('getLastExecutionData');
    expect(recoverySource).toContain('trackedExecutions');
  });

  it('marks provider request boundaries and timeout diagnostics for stall analysis', () => {
    const framework = readSource('src/renderer/modules/LLMBenchmarkFramework.js');
    const config = readSource('src/renderer/modules/LLMConfigManager.js');

    expect(framework).toContain('[Benchmark][request] sending test');
    expect(framework).toContain('LLM returned in');
    expect(framework).toContain('[Benchmark][timeout]');
    expect(config).toContain('[LLM][local] non-streaming request start');
    expect(config).toContain('streaming request start');
  });

  it('exposes a 10-minute global test timeout option in the benchmark UI', () => {
    const source = readSource('src/renderer/modules/BenchmarkUI.js');

    const occurrences = source.match(/<option value="600000">10 minutes<\/option>/g) || [];
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
  });
});
