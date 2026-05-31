/**
 * Menu Builder Module Tests
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const MB_PATH = path.join(process.cwd(), 'src/main/menu-builder.js');
const INDEX_PATH = path.join(process.cwd(), 'src/renderer/index.html');
const RENDERER_PATH = path.join(process.cwd(), 'src/renderer/renderer-modular.js');

describe('Menu Builder Module', () => {
  let content;
  let indexHtml;
  let rendererContent;

  beforeAll(() => {
    content = fs.readFileSync(MB_PATH, 'utf-8');
    indexHtml = fs.readFileSync(INDEX_PATH, 'utf-8');
    rendererContent = fs.readFileSync(RENDERER_PATH, 'utf-8');
  });

  it('should use strict mode', () => {
    expect(content).toContain("'use strict'");
  });

  it('should define all 6 menu functions', () => {
    const funcs = [
      'createCircosPlotterMenu',
      'createToolWindowMenu',
      'createMenu',
      'createDeepGeneResearchMenu',
      'createProjectManagerMenu',
      'createMCPServerManagerMenu',
    ];
    for (const fn of funcs) {
      expect(content.includes(`function ${fn}`), `Missing ${fn}`).toBe(true);
    }
  });

  it('should define setMenuDependencies', () => {
    expect(content).toContain('function setMenuDependencies');
  });

  it('should export via module.exports', () => {
    expect(content).toContain('module.exports');
  });

  it('should not have let/function createMenu conflict', () => {
    const letDecl = (content.match(/let createMenu/g) || []).length;
    const funcDecl = (content.match(/function createMenu/g) || []).length;
    expect(letDecl).toBe(0);
    expect(funcDecl).toBe(1);
  });

  it('createMenu should build File, Edit, View menus', () => {
    expect(content).toContain("'File'");
    expect(content).toContain("'Edit'");
    expect(content).toContain("'View'");
  });

  it('File menu should start with new-window actions', () => {
    const fileMenuIndex = content.indexOf("label: 'File'");
    const newWindowIndex = content.indexOf("label: 'New Window'", fileMenuIndex);
    const openNewWindowIndex = content.indexOf("label: 'Open (New Window)'", fileMenuIndex);
    const loadFileIndex = content.indexOf("label: 'Load File'", fileMenuIndex);

    expect(fileMenuIndex).toBeGreaterThan(-1);
    expect(newWindowIndex).toBeGreaterThan(fileMenuIndex);
    expect(openNewWindowIndex).toBeGreaterThan(newWindowIndex);
    expect(loadFileIndex).toBeGreaterThan(openNewWindowIndex);
  });

  it('Action menu should include reverse-complement paste and insert items', () => {
    expect(content).toContain("label: 'Paste (Reverse)'");
    expect(content).toContain("'action-paste-sequence-reverse'");
    expect(content).toContain("label: 'Insert (Reverse)'");
    expect(content).toContain("'action-insert-sequence-reverse'");
  });

  it('top Actions dropdown should include reverse-complement paste and insert buttons', () => {
    expect(indexHtml).toContain('id="pasteSequenceReverseBtn"');
    expect(indexHtml).toContain('Paste (Reverse)');
    expect(indexHtml).toContain('id="insertSequenceReverseBtn"');
    expect(indexHtml).toContain('Insert (Reverse)');
    expect(rendererContent).toContain("ipcRenderer.on('action-paste-sequence-reverse'");
    expect(rendererContent).toContain('window.actionManager.handlePasteSequence(true)');
    expect(rendererContent).toContain("ipcRenderer.on('action-insert-sequence-reverse'");
    expect(rendererContent).toContain('window.actionManager.handleInsertSequence(true)');
  });

  it('createCircosPlotterMenu should accept circosWindow param', () => {
    const match = content.match(/function createCircosPlotterMenu\(\s*circosWindow/);
    expect(match).not.toBeNull();
  });

  it('createToolWindowMenu should accept toolWindow, toolName', () => {
    expect(content).toContain('function createToolWindowMenu(toolWindow, toolName)');
  });
});
