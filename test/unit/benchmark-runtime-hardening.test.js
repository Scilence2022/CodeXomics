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

    expect(source).toContain('window.electronAPI?.getSelectedFileInfo');
    expect(source).toContain('infoResult.info?.isDirectory');
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
