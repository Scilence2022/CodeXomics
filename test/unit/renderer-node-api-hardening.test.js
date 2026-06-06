import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const source = relativePath => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('renderer Node API hardening', () => {
  it('does not use renderer electron require fallbacks in core IPC callers', () => {
    const files = [
      'src/renderer/modules/BenchmarkUI.js',
      'src/renderer/modules/ChatManager.js',
      'src/renderer/modules/ExternalToolsManager.js',
      'src/renderer/modules/GenomeStudioRPCHandler.js',
      'src/renderer/modules/InternalMCPServer.js',
      'src/renderer/modules/PluginManagementUI.js',
    ];

    for (const file of files) {
      const content = source(file);
      expect(content, file).not.toMatch(/\brequire\(['"]electron['"]\)/);
      expect(content, file).not.toMatch(/\bwindow\.require\s*\(/);
    }
  });

  it('routes Deep Gene Research report persistence through preload IPC', () => {
    const service = source('src/renderer/modules/chat/services/LLMContextService.js');
    const preload = source('src/preload.js');
    const handlers = source('src/main/ipc-handlers.js');

    expect(service).toContain('saveGeneResearchReport');
    expect(service).not.toMatch(/\brequire\(['"]fs['"]\)/);
    expect(service).not.toMatch(/\brequire\(['"]path['"]\)/);
    expect(preload).toContain('saveGeneResearchReport');
    expect(preload).toContain('save-gene-research-report');
    expect(handlers).toContain("ipcMain.handle('save-gene-research-report'");
    expect(handlers).toContain('resolveGeneResearchReportPath');
  });

  it('resolves plugin demo paths without renderer fs/path require', () => {
    const content = source('src/renderer/modules/PluginRealTestDemonstrator.js');

    expect(content).toContain('async resolvePluginDemoPath');
    expect(content).toContain('getAppPaths');
    expect(content).toContain('checkPluginFileExists');
    expect(content).not.toMatch(/\brequire\(['"]fs['"]\)/);
    expect(content).not.toMatch(/\brequire\(['"]path['"]\)/);
  });
});
