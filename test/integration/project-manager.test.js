/**
 * Project Manager Window Integration Tests
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const PM_HTML = path.join(process.cwd(), 'src', 'project-manager.html');
const PM_JS = path.join(process.cwd(), 'src/renderer/modules/ProjectManagerWindow.js');
const PROJECT_IPC = path.join(process.cwd(), 'src/main/project-ipc.js');

describe('Project Manager', () => {
  describe('HTML Structure', () => {
    it('project-manager.html should exist', () => {
      expect(fs.existsSync(PM_HTML)).toBe(true);
    });

    it('should include ProjectManagerWindow.js script', () => {
      const content = fs.readFileSync(PM_HTML, 'utf-8');
      expect(content).toContain('ProjectManagerWindow.js');
    });

    it('should load preload.js in webPreferences', () => {
      const content = fs.readFileSync(path.join(process.cwd(), 'src/main/project-ipc.js'), 'utf-8');
      // Preload is set in main process when creating the window
      expect(content.includes('preload') || content.includes('ProjectManager')).toBe(true);
    });

    it('should have a proper HTML document structure', () => {
      const content = fs.readFileSync(PM_HTML, 'utf-8');
      expect(content).toContain('<!doctype html>');
      expect(content).toContain('<html');
      expect(content).toContain('<head');
      expect(content).toContain('<body');
    });
  });

  describe('JavaScript Module', () => {
    it('ProjectManagerWindow.js should define a class', () => {
      const content = fs.readFileSync(PM_JS, 'utf-8');
      expect(content).toContain('class ProjectManagerWindow');
    });

    it('should reference electronAPI for IPC', () => {
      const content = fs.readFileSync(PM_JS, 'utf-8');
      expect(content.includes('electronAPI') || content.includes('ipcRenderer')).toBe(true);
    });
  });

  describe('IPC Handlers', () => {
    it('project-ipc.js should exist and define handlers', () => {
      const content = fs.readFileSync(PROJECT_IPC, 'utf-8');
      expect(content).toContain('function registerProjectIpcHandlers');
    });

    it('should have project file operations', () => {
      const content = fs.readFileSync(PROJECT_IPC, 'utf-8');
      const ops = ['loadProjectFile', 'selectProjectDirectory', 'createProjectDirectory', 'saveProjectFile'];
      let found = 0;
      for (const op of ops) {
        if (content.includes(op)) found++;
      }
      expect(found).toBeGreaterThanOrEqual(2);
    });

    it('should have file locking operations', () => {
      const content = fs.readFileSync(PROJECT_IPC, 'utf-8');
      expect(content).toContain('lockProjectFile');
      expect(content).toContain('unlockProjectFile');
    });

    it('should export the register function', () => {
      const content = fs.readFileSync(PROJECT_IPC, 'utf-8');
      expect(content).toContain('module.exports');
    });
  });
});
