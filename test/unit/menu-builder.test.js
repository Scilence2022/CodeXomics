/**
 * Menu Builder Module Tests
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const MB_PATH = path.join(process.cwd(), 'src/main/menu-builder.js');

describe('Menu Builder Module', () => {
  let content;

  beforeAll(() => {
    content = fs.readFileSync(MB_PATH, 'utf-8');
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

  it('createCircosPlotterMenu should accept circosWindow param', () => {
    const match = content.match(/function createCircosPlotterMenu\(\s*circosWindow/);
    expect(match).not.toBeNull();
  });

  it('createToolWindowMenu should accept toolWindow, toolName', () => {
    expect(content).toContain('function createToolWindowMenu(toolWindow, toolName)');
  });
});
