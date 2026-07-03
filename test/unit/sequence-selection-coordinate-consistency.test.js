import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let GenomeNavigationBar;

beforeAll(() => {
  const source = fs.readFileSync(path.join(repoRoot, 'src/renderer/modules/GenomeNavigationBar.js'), 'utf8');
  vm.runInThisContext(`${source}\nwindow.GenomeNavigationBarForTest = GenomeNavigationBar;`, {
    filename: 'GenomeNavigationBar.js',
  });
  GenomeNavigationBar = window.GenomeNavigationBarForTest;
});

describe('Sequence selection coordinate consistency', () => {
  let genomeBrowser;
  let navigationBar;

  beforeEach(() => {
    document.body.innerHTML = '';
    genomeBrowser = {
      clearSequenceSelection: vi.fn(),
      updateCopyButtonState: vi.fn(),
      showNotification: vi.fn(),
      uiManager: { updateStatus: vi.fn() },
      currentAnnotations: {},
    };
    navigationBar = Object.create(GenomeNavigationBar.prototype);
    navigationBar.genomeBrowser = genomeBrowser;
    navigationBar.currentChromosome = 'chr1';
    navigationBar.sequenceLength = 100;
  });

  it('commits primary ruler selections as one-based inclusive coordinates', () => {
    navigationBar.applySequenceSelection(0, 9);

    expect(genomeBrowser.currentSequenceSelection).toEqual({
      chromosome: 'chr1',
      start: 1,
      end: 10,
      active: true,
      coordinateSystem: 'one-based-inclusive',
      source: 'ruler',
      length: 10,
      wrapsOrigin: false,
      segments: [{ start: 1, end: 10 }],
    });
    expect(genomeBrowser.sequenceSelection).toEqual(genomeBrowser.currentSequenceSelection);
  });

  it('maps the right canvas edge to the final valid zero-based source index', () => {
    navigationBar.canvas = document.createElement('canvas');
    vi.spyOn(navigationBar.canvas, 'getBoundingClientRect').mockReturnValue({
      width: 100,
      height: 20,
      top: 0,
      right: 100,
      bottom: 20,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    expect(navigationBar.getPositionFromEvent({ clientX: 100 })).toBe(99);
  });

  it('shows the first base as position 1 in selection feedback', () => {
    navigationBar.canvas = document.createElement('canvas');
    navigationBar.tooltip = document.createElement('div');
    vi.spyOn(navigationBar.canvas, 'getBoundingClientRect').mockReturnValue({
      width: 100,
      height: 20,
      top: 0,
      right: 100,
      bottom: 20,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    navigationBar.showSelectionTooltip({ clientX: 0, clientY: 10 }, 0, 0);

    expect(navigationBar.tooltip.textContent).toContain('Start: 1');
    expect(navigationBar.tooltip.textContent).toContain('End: 1');
    expect(navigationBar.tooltip.textContent).toContain('Length: 1 bp');
  });
});
