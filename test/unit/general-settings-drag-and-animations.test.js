/**
 * General Settings: the three drag settings and "Enable Animations".
 *
 * - The drag settings looked like three takes on one thing. They are three
 *   independent parts of a drag (what is drawn, what moves, the sequence
 *   panel), and "Move All Tracks Together" has no effect during a live drag,
 *   so the form must say so instead of leaving a checkbox that does nothing.
 * - "Enable Animations" set a body class that no stylesheet read, and only at
 *   startup. The Tab Settings modal also reused its element id, so that modal's
 *   hover-animation switch was wired to the General Settings checkbox.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import GeneralSettingsManager from '../../src/renderer/modules/GeneralSettingsManager.js';
import NavigationManager from '../../src/renderer/modules/NavigationManager.js';

const readSource = relativePath => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
const indexHtml = readSource('src/renderer/index.html');
const parsedIndex = new DOMParser().parseFromString(indexHtml, 'text/html');

function mountGeneralSettings(saved = {}) {
  document.body.innerHTML = parsedIndex.getElementById('generalSettingsModal').outerHTML;
  const configManager = { set: vi.fn(async () => {}), saveConfig: vi.fn(async () => {}) };
  const manager = Object.create(GeneralSettingsManager.prototype);
  manager.configManager = configManager;
  manager.settings = { ...new GeneralSettingsManager(null).defaultSettings, ...saved };
  manager.updateSystemInfo = () => {};
  manager.setupEventListeners();
  manager.updateUIFromSettings();
  return manager;
}

const toggle = (id, checked) => {
  const el = document.getElementById(id);
  el.checked = checked;
  el.dispatchEvent(new Event('change'));
};

afterEach(() => {
  document.body.innerHTML = '';
  document.body.className = '';
  delete window.genomeBrowser;
  vi.restoreAllMocks();
});

describe('index.html settings ids', () => {
  it('gives each settings checkbox its own id', () => {
    expect(parsedIndex.querySelectorAll('#enableAnimations')).toHaveLength(1);
    expect(parsedIndex.querySelector('#enableAnimations').closest('#generalSettingsModal')).not.toBe(null);
    expect(parsedIndex.querySelector('#tabHoverAnimations').closest('#tabSettingsModal')).not.toBe(null);
  });

  it('groups the three drag settings in one section with distinct labels', () => {
    const section = parsedIndex.getElementById('dragUpdateGeneFeatures').closest('.settings-section');
    expect(section.querySelector('h4').textContent).toContain('Dragging the View');
    expect(section.querySelector('#enableGlobalDragging')).not.toBe(null);
    expect(section.querySelector('#dragRealtimeSequenceUpdate')).not.toBe(null);
    const labels = [...section.querySelectorAll('label')].map(l => l.textContent.trim());
    expect(labels).toEqual([
      'Live-Render New Region While Dragging',
      'Move All Tracks Together',
      'Update Sequence Panel While Dragging',
    ]);
  });

  it('drops the Genes track copy of the global dragging switch, which nothing read', () => {
    expect(readSource('src/renderer/modules/TrackRenderer.js')).not.toContain('genesEnableGlobalDragging');
  });
});

describe('drag settings in the form', () => {
  it('greys out Move All Tracks Together while live rendering is on', () => {
    mountGeneralSettings({ dragUpdateGeneFeatures: true });
    const global = document.getElementById('enableGlobalDragging');
    expect(global.disabled).toBe(true);
    expect(document.getElementById('enableGlobalDraggingOverride').hidden).toBe(false);
    expect(document.getElementById('enableGlobalDraggingGroup').classList.contains('setting-overridden')).toBe(true);

    toggle('dragUpdateGeneFeatures', false);
    expect(global.disabled).toBe(false);
    expect(document.getElementById('enableGlobalDraggingOverride').hidden).toBe(true);
  });

  it('starts with the control enabled when live rendering is off', () => {
    mountGeneralSettings();
    expect(document.getElementById('enableGlobalDragging').disabled).toBe(false);
    expect(document.getElementById('enableGlobalDraggingOverride').hidden).toBe(true);
  });

  it('passes each drag setting to the navigation manager', () => {
    const nav = { setDragUpdateGeneFeatures: vi.fn(), setDragRealtimeSequenceUpdate: vi.fn() };
    window.genomeBrowser = { navigationManager: nav, setGlobalDragging: vi.fn() };
    mountGeneralSettings();
    toggle('dragUpdateGeneFeatures', true);
    toggle('enableGlobalDragging', false);
    toggle('dragRealtimeSequenceUpdate', true);
    expect(nav.setDragUpdateGeneFeatures).toHaveBeenCalledWith(true);
    expect(window.genomeBrowser.setGlobalDragging).toHaveBeenCalledWith(false);
    expect(nav.setDragRealtimeSequenceUpdate).toHaveBeenCalledWith(true);
  });
});

describe('live drag switch', () => {
  it('ignores per-track settings: the General Settings checkbox is the only switch', () => {
    const nm = new NavigationManager({
      trackRenderer: { getTrackSettings: () => ({ dynamicUpdateOnDrag: true }) },
    });
    expect(nm.isDynamicDragUpdateEnabled()).toBe(false);
    nm.setDragUpdateGeneFeatures(true);
    expect(nm.isDynamicDragUpdateEnabled()).toBe(true);
  });
});

describe('Enable Animations', () => {
  it('applies as soon as the checkbox changes', () => {
    mountGeneralSettings();
    toggle('enableAnimations', false);
    expect(document.body.classList.contains('no-animations')).toBe(true);
    toggle('enableAnimations', true);
    expect(document.body.classList.contains('no-animations')).toBe(false);
  });

  it('is applied from saved settings at startup', () => {
    const manager = mountGeneralSettings({ enableAnimations: false });
    manager.applySettings();
    expect(document.body.classList.contains('no-animations')).toBe(true);
  });

  it('has a stylesheet rule that stops transitions and animations', () => {
    const css = readSource('src/renderer/css/base.css');
    const rule = css.slice(css.indexOf('body.no-animations'));
    expect(rule).toMatch(/animation-duration:\s*0\.01ms !important/);
    expect(rule).toMatch(/transition-duration:\s*0\.01ms !important/);
    // Busy indicators keep turning
    expect(rule).toContain(':not(.fa-spin)');
    expect(rule).toContain(':not(.spinner)');
  });
});
