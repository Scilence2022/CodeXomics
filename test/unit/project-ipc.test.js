/**
 * Project IPC Module Structure Tests
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const PIPC_PATH = path.join(process.cwd(), 'src/main/project-ipc.js');

describe('Project IPC Module', () => {
  let content;

  beforeAll(() => {
    content = fs.readFileSync(PIPC_PATH, 'utf-8');
  });

  it('should exist and be substantial', () => {
    expect(fs.existsSync(PIPC_PATH)).toBe(true);
    expect(content.length).toBeGreaterThan(10000);
  });

  it('should define registerProjectIpcHandlers', () => {
    expect(content).toContain('function registerProjectIpcHandlers');
  });

  it('should export via module.exports', () => {
    expect(content).toContain('module.exports');
  });

  it('should have 30+ ipcMain.handle registrations', () => {
    const count = (content.match(/ipcMain\.handle\(/g) || []).length;
    expect(count).toBeGreaterThanOrEqual(30);
  });

  it('should handle project file operations', () => {
    const ops = ['loadProjectFile', 'saveProjectFile', 'createProjectDirectory'];
    for (const op of ops) {
      expect(content.includes(op), `Missing ${op}`).toBe(true);
    }
  });

  it('should handle file locking', () => {
    expect(content).toContain('lockProjectFile');
    expect(content).toContain('unlockProjectFile');
  });

  it('should handle project data management', () => {
    expect(content).toContain('saveProjectsData');
    expect(content).toContain('loadProjectsData');
  });

  it('should handle file operations (move, rename, copy)', () => {
    expect(content).toContain('moveFileInProject');
    expect(content).toContain('renameFileInProject');
    expect(content).toContain('copyFileToProject');
  });

  it('should have helper functions', () => {
    const helpers = ['getFolderIcon', 'getFileTypeFromExtension', 'copyDirectoryRecursive', 'categorizeGenomicFile'];
    for (const helper of helpers) {
      expect(content.includes(`function ${helper}`) || content.includes(helper)).toBe(true);
    }
  });

  it('should handle genomic downloads', () => {
    expect(content).toContain('createGenomicDownloadWindow');
    expect(content).toContain('download');
  });

  it('should use deps parameter pattern', () => {
    expect(content).toContain('function registerProjectIpcHandlers(deps)');
  });

  it('createNewMainWindow should update the shared active-window tracker', () => {
    expect(content).toContain('const setActiveMainWindow = win =>');
    expect(content).toContain("typeof deps.setCurrentActiveWindow === 'function'");
    expect(content).toContain('deps.setCurrentActiveWindow(win)');
    expect(content).toContain("newMainWindow.webContents.on('focus'");
    expect(content).toContain('clearActiveMainWindow(newMainWindow)');
  });
});
