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

    expect(source).toContain('approveWorkingDirectory');
    expect(source).toContain('window.electronAPI?.getSelectedFileInfo');
    expect(source).toContain('infoResult.info?.isDirectory');
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

  it('keeps a run-level ToolExecutionTracker session during benchmark execution', () => {
    const source = readSource('src/renderer/modules/LLMBenchmarkFramework.js');

    expect(source).toContain('benchmark_run_');
    expect(source).toContain('Started run-level tracker session');
    expect(source).toContain('createdTrackerSessionForTest');
  });

  it('path info IPC returns file and directory type metadata', () => {
    const source = readSource('src/main/ipc-handlers.js');

    expect(source).toContain('isDirectory: stats.isDirectory()');
    expect(source).toContain('isFile: stats.isFile()');
  });
});
