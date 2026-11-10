/**
 * General Settings tab layout.
 *
 * The old Performance tab held four unrelated panels (memory, visualization,
 * dragging, caching). Each now has a home of its own, and the drag settings sit
 * with the other things that change what the view draws.
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const indexHtml = fs.readFileSync(path.join(process.cwd(), 'src/renderer/index.html'), 'utf8');
const doc = new DOMParser().parseFromString(indexHtml, 'text/html');
const modal = doc.getElementById('generalSettingsModal');

const tabOf = id => modal.querySelector(`#${id}`).closest('.tab-content').id;
const sectionsOf = tabId =>
  [...modal.querySelectorAll(`#${tabId} .settings-section h4`)].map(h => h.textContent.trim());

describe('General Settings tab layout', () => {
  it('has one content panel per tab button, in the same order', () => {
    const tabs = [...modal.querySelectorAll('.llm-provider-tabs .tab-button')].map(b => b.dataset.tab);
    expect(tabs).toEqual([
      'appearance',
      'visualization',
      'navigation',
      'features',
      'memory',
      'caching',
      'security',
      'export',
      'about',
    ]);
    const panels = [...modal.querySelectorAll('.tab-content')].map(p => p.id);
    expect(panels).toEqual(tabs.map(t => `${t}-tab`));
    expect(modal.querySelectorAll('.tab-content.active')).toHaveLength(1);
    expect(modal.querySelector('#performance-tab')).toBe(null);
  });

  it('gives Memory and Caching their own tabs', () => {
    expect(sectionsOf('memory-tab')).toEqual(['Memory Management']);
    expect(sectionsOf('caching-tab')).toEqual(['Caching']);
    expect(tabOf('maxSequenceLength')).toBe('memory-tab');
    expect(tabOf('renderingMode')).toBe('memory-tab');
    expect(tabOf('enableFileCache')).toBe('caching-tab');
    expect(tabOf('clearCacheBtn')).toBe('caching-tab');
  });

  it('puts the drag settings under Visualization with the track settings', () => {
    expect(sectionsOf('visualization-tab')).toEqual(['Tracks', 'Sequence Display', 'Dragging the View']);
    for (const id of [
      'maxGenesDisplay',
      'trackHeight',
      'minLineSpacing',
      'dragUpdateGeneFeatures',
      'enableGlobalDragging',
      'dragRealtimeSequenceUpdate',
    ]) {
      expect(tabOf(id)).toBe('visualization-tab');
    }
  });

  it('groups wheel zoom and search under Navigation, and interface motion under Appearance', () => {
    expect(sectionsOf('navigation-tab')).toEqual(['Mouse Wheel Zoom', 'Search']);
    expect(tabOf('enableWheelZoom')).toBe('navigation-tab');
    expect(tabOf('searchHistorySize')).toBe('navigation-tab');
    expect(tabOf('enableAnimations')).toBe('appearance-tab');
    expect(tabOf('compactMode')).toBe('appearance-tab');
  });

  it('opens wide enough for the tab bar', () => {
    const content = modal.querySelector('.modal-content');
    expect(content.style.width).toBe('1080px');
  });
});
