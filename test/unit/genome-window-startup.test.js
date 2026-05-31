import { createRequire } from 'node:module';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const GeneralSettingsManager = require('../../src/renderer/modules/GeneralSettingsManager.js');
const SequenceUtils = require('../../src/renderer/modules/SequenceUtils.js');
const UIManager = require('../../src/renderer/modules/UIManager.js');

describe('Genome window startup guards', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.genomeBrowser = undefined;
    window.sequenceUtils = undefined;
    localStorage.clear();
  });

  it('makes UIManager initializeHorizontalSplitter available for GenomeBrowser init', () => {
    const uiManager = new UIManager({});

    expect(typeof uiManager.initializeHorizontalSplitter).toBe('function');
    expect(() => uiManager.initializeHorizontalSplitter()).not.toThrow();
  });

  it('serves default general settings before async initialization completes', () => {
    const settingsManager = new GeneralSettingsManager(null);

    expect(settingsManager.getSetting('minLineSpacing', 6)).toBe(12);
    expect(settingsManager.getSettings().minLineSpacing).toBe(12);
  });

  it('loads sequence line spacing from the current GenomeBrowser instead of stale globals', () => {
    window.genomeBrowser = {
      generalSettingsManager: {
        getSetting: vi.fn(() => {
          throw new Error('stale global settings manager should not be used');
        }),
      },
    };

    const sequenceUtils = new SequenceUtils({
      generalSettingsManager: {
        getSetting: vi.fn(() => 18),
      },
    });

    expect(sequenceUtils.minLineSpacing).toBe(18);
  });
});
