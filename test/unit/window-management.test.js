/**
 * Window Management Module Tests
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const WM_PATH = path.join(process.cwd(), 'src/main/window-management.js');

describe('Window Management Module', () => {
  let content;

  beforeAll(() => {
    content = fs.readFileSync(WM_PATH, 'utf-8');
  });

  it('should use strict mode', () => {
    expect(content).toContain("'use strict'");
  });

  it('should have 21 window creation functions', () => {
    const funcs = [
      'createWindow',
      'createCircosWindow',
      'createKEGGWindow',
      'createGOWindow',
      'createUniProtWindow',
      'createInterProWindow',
      'createNCBIWindow',
      'createSTRINGWindow',
      'createDAVIDWindow',
      'createReactomeWindow',
      'createPDBWindow',
      'createGeneAnnotationRefineWindow',
      'createBlastDownloaderWindow',
      'createBlastConfigWindow',
      'createProGenFixerWindow',
      'createDeepGeneResearchWindow',
      'createChopchopWindow',
      'createCustomExternalToolWindow',
      'createProjectManagerWindow',
      'getCurrentMainWindow',
      'sendToCurrentMainWindow',
    ];
    for (const fn of funcs) {
      expect(content.includes(fn), `Missing ${fn}`).toBe(true);
    }
  });

  it('should have 9 layout functions', () => {
    const layouts = [
      'getDisplayWorkArea',
      'getMainWindows',
      'arrangeWindowsOptimal',
      'arrangeWindowsSideBySide',
      'arrangeMainWindowFocus',
      'arrangeProjectManagerFocus',
      'arrangeWindowsVertical',
      'arrangeWindowsCascade',
      'resetWindowPositions',
    ];
    for (const ln of layouts) {
      expect(content.includes(`function ${ln}`), `Missing ${ln}`).toBe(true);
    }
  });

  it('should include setWindowMgmtDependencies', () => {
    expect(content).toContain('function setWindowMgmtDependencies');
  });

  it('should export via module.exports', () => {
    expect(content).toContain('module.exports');
  });

  it('should have enableRemoteModule:false for all windows', () => {
    const count = (content.match(/enableRemoteModule:\s*false/g) || []).length;
    expect(count).toBeGreaterThanOrEqual(18);
  });

  it('should import ipcMain after fix', () => {
    expect(content).toContain("require('electron')");
    expect(content).toContain('ipcMain');
  });
});
