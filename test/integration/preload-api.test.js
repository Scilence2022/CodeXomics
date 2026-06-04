/**
 * Preload API Structure Tests
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const PRELOAD_PATH = path.join(process.cwd(), 'src', 'preload.js');

describe('Preload API Structure', () => {
  let preloadContent;

  beforeAll(() => {
    preloadContent = fs.readFileSync(PRELOAD_PATH, 'utf-8');
  });

  it('should use contextBridge.exposeInMainWorld', () => {
    expect(preloadContent).toContain('contextBridge.exposeInMainWorld');
  });

  it('should expose electronAPI namespace', () => {
    expect(preloadContent).toContain("exposeInMainWorld('electronAPI'");
  });

  it('should expose nodeAPI namespace', () => {
    expect(preloadContent).toContain("exposeInMainWorld('nodeAPI'");
  });

  describe('electronAPI methods', () => {
    const requiredMethods = [
      'getLoadedResources',
      'selectAndLoadFile',
      'showSaveDialog',
      'writeFile',
      'selectProjectDirectory',
      'loadProjectFile',
      'getLocaleData',
      'getLocaleLanguages',
      'getAppPaths',
      'getSanitizerConfig',
      'checkGeneResearchReport',
      'openGeneResearchReport',
      'invoke',
      'onMenuAction',
      'ipcRenderer',
      'removeAllListeners',
    ];

    for (const method of requiredMethods) {
      it(`should expose ${method}`, () => {
        expect(preloadContent).toContain(`${method}:`);
      });
    }
  });

  describe('IPC channel validation', () => {
    it('should validate invoke channels', () => {
      expect(preloadContent).toContain('allowedInvokeChannels');
      expect(preloadContent).toContain('mcp-server-start');
      expect(preloadContent).toContain('mcp-server-stop');
    });

    it('should validate on() listener channels', () => {
      expect(preloadContent).toContain('mcp-server-status-changed');
      expect(preloadContent).toContain('mcp-server-log');
    });

    it('removeAllListeners should validate channels', () => {
      expect(preloadContent).toContain('allowedChannels');
      expect(preloadContent).toContain('Blocked removeAllListeners');
    });
  });

  describe('Security hardening', () => {
    it('should NOT expose raw ipcRenderer directly', () => {
      // The preload should only expose specific, validated methods
      // This check ensures we don't have `exposeInMainWorld('ipcRenderer', ipcRenderer)`
      expect(preloadContent).toContain("exposeInMainWorld('electronAPI'");
      expect(preloadContent).not.toContain("exposeInMainWorld('ipcRenderer', ipcRenderer)");
    });

    it('removeAllListeners should have channel whitelist', () => {
      // After P1 hardening, removeAllListeners must validate channels
      expect(preloadContent).toContain('removeAllListeners');
      expect(preloadContent).toContain('includes(channel)');
    });

    it('should not use eval() in preload', () => {
      expect(preloadContent).not.toMatch(/\beval\s*\(/);
    });
  });
});
