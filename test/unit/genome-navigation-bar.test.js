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

function mockCanvasRect(canvas, width = 100) {
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
    width,
    height: 20,
    top: 0,
    right: width,
    bottom: 20,
    left: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}

describe('GenomeNavigationBar coordinates', () => {
  it('maps the right canvas edge to the final valid zero-based source index', () => {
    const navigationBar = Object.create(GenomeNavigationBar.prototype);
    navigationBar.sequenceLength = 100;
    navigationBar.canvas = document.createElement('canvas');
    mockCanvasRect(navigationBar.canvas);

    expect(navigationBar.getPositionFromEvent({ clientX: 100 })).toBe(99);
  });
});

describe('GenomeNavigationBar ruler display mode', () => {
  let config;
  let configManager;
  let trackRenderer;
  let navigationBar;

  beforeEach(() => {
    document.body.innerHTML = '<div id="genomeViewerSection"></div><div class="coordinate-ruler-bar"></div>';
    globalThis.ResizeObserver = class {
      observe() {}
      disconnect() {}
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ scale: vi.fn() });

    config = {};
    configManager = {
      waitForInitialization: vi.fn().mockResolvedValue(undefined),
      get: vi.fn((key, fallback) => (key in config ? config[key] : fallback)),
      set: vi.fn(async (key, value) => {
        config[key] = value;
      }),
      setAndSaveImmediate: vi.fn(async (key, value) => {
        config[key] = value;
        return true;
      }),
    };
    trackRenderer = {
      elementVisibilityStates: { genesRuler: true },
      applyCoordinateRulerVisibility() {
        const visible = this.elementVisibilityStates.genesRuler !== false;
        document.querySelectorAll('.coordinate-ruler-bar').forEach(bar => {
          bar.style.display = visible ? 'block' : 'none';
        });
      },
    };
    navigationBar = new GenomeNavigationBar({ configManager, trackRenderer });
  });

  const rulerBar = () => document.querySelector('.coordinate-ruler-bar');
  const toggles = () => document.querySelectorAll('#genomeNavigationBar button');

  it('starts compact: slim overview, coordinate ruler shown, one control', () => {
    expect(navigationBar.rulerDisplayMode).toBe('compact');
    expect(navigationBar.isRulerCollapsed).toBe(true);
    expect(navigationBar.container.style.height).toBe('28px');
    expect(rulerBar().style.display).toBe('block');
    expect(toggles()).toHaveLength(1);
    expect(toggles()[0].dataset.mode).toBe('compact');
  });

  it('gives the mode control a styled hint naming the current and next mode', () => {
    const toggle = toggles()[0];
    expect(toggle.dataset.tooltip).toBe('Rulers: Compact (slim overview and coordinate ruler). Click for Minimal.');
    expect(toggle.getAttribute('aria-label')).toBe(toggle.dataset.tooltip);

    toggle.click();
    expect(toggle.dataset.tooltip).toContain('Rulers: Minimal');
  });

  it('has no sequence selection mode on the overview ruler', () => {
    expect(navigationBar.selectionMode).toBeUndefined();
    expect(typeof GenomeNavigationBar.prototype.applySequenceSelection).toBe('undefined');
  });

  it('cycles full -> compact -> minimal and drives both rulers', () => {
    navigationBar.setRulerDisplayMode('full');
    expect(navigationBar.container.style.height).toBe('60px');
    expect(rulerBar().style.display).toBe('block');

    toggles()[0].click();
    expect(navigationBar.rulerDisplayMode).toBe('compact');
    expect(navigationBar.container.style.height).toBe('28px');
    expect(rulerBar().style.display).toBe('block');

    toggles()[0].click();
    expect(navigationBar.rulerDisplayMode).toBe('minimal');
    expect(navigationBar.container.style.height).toBe('28px');
    expect(rulerBar().style.display).toBe('none');
    expect(trackRenderer.elementVisibilityStates.genesRuler).toBe(false);

    toggles()[0].click();
    expect(navigationBar.rulerDisplayMode).toBe('full');
    expect(rulerBar().style.display).toBe('block');
  });

  it('saves user changes to ui.rulerDisplayMode immediately', () => {
    navigationBar.setRulerDisplayMode('minimal');
    expect(configManager.setAndSaveImmediate).toHaveBeenCalledWith('ui.rulerDisplayMode', 'minimal');
  });

  it('restores the saved mode without writing it back', async () => {
    config['ui.rulerDisplayMode'] = 'minimal';
    configManager.setAndSaveImmediate.mockClear();

    await navigationBar.applySavedRulerDisplayMode();

    expect(navigationBar.rulerDisplayMode).toBe('minimal');
    expect(rulerBar().style.display).toBe('none');
    expect(configManager.setAndSaveImmediate).not.toHaveBeenCalled();
    expect(configManager.set).not.toHaveBeenCalled();
  });

  it('falls back to compact for an unknown saved value', async () => {
    config['ui.rulerDisplayMode'] = 'bogus';
    await navigationBar.applySavedRulerDisplayMode();
    expect(navigationBar.rulerDisplayMode).toBe('compact');
  });

  it('reapplies the mode to the track renderer on show()', () => {
    navigationBar.setRulerDisplayMode('minimal', { persist: false });
    trackRenderer.elementVisibilityStates.genesRuler = true;
    navigationBar.draw = vi.fn();

    navigationBar.show('chr1', 1000);

    expect(trackRenderer.elementVisibilityStates.genesRuler).toBe(false);
  });
});
