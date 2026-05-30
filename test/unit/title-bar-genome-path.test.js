/**
 * Title Bar Genome Path Tests
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const RENDERER_MODULAR_PATH = path.join(process.cwd(), 'src/renderer/renderer-modular.js');
const TAB_MANAGER_PATH = path.join(process.cwd(), 'src/renderer/modules/TabManager.js');

describe('App Title Bar - Loaded Genome Path Display', () => {
  it('should initialize loadedGenomePath state in renderer-modular.js', () => {
    const content = fs.readFileSync(RENDERER_MODULAR_PATH, 'utf-8');
    expect(content).toContain('this.loadedGenomePath = null;');
  });

  it('should implement updateAppTitle method in renderer-modular.js', () => {
    const content = fs.readFileSync(RENDERER_MODULAR_PATH, 'utf-8');
    expect(content).toContain('updateAppTitle() {');
    expect(content).toContain('document.title = title;');
    expect(content).toContain('this.loadedGenomePath');
  });

  it('should update document title in setupIPC when windowId is set', () => {
    const content = fs.readFileSync(RENDERER_MODULAR_PATH, 'utf-8');
    expect(content).toContain('this.updateAppTitle();');
  });

  it('should update loadedGenomePath and trigger updateAppTitle in TabManager onGenomeLoaded', () => {
    const content = fs.readFileSync(TAB_MANAGER_PATH, 'utf-8');
    expect(content).toContain('this.genomeBrowser.loadedGenomePath = filename;');
    expect(content).toContain('this.genomeBrowser.updateAppTitle();');
  });
});
