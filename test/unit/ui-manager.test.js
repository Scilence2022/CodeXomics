import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const UIManager = require('../../src/renderer/modules/UIManager.js');

describe('UIManager dropdown handlers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not throw when optional dropdown controls are missing', () => {
    document.body.innerHTML = `
      <button id="openFileBtn"></button>
      <div id="fileDropdownMenu" class="show"></div>
      <div id="exportDropdownMenu" class="show"></div>
      <div id="optionsDropdownMenu" class="show"></div>
    `;

    const manager = new UIManager({});
    vi.spyOn(manager, 'closeFileDropdown').mockImplementation(() => {});
    vi.spyOn(manager, 'closeExportDropdown').mockImplementation(() => {});
    vi.spyOn(manager, 'closeOptionsDropdown').mockImplementation(() => {});

    expect(() => {
      document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }).not.toThrow();

    expect(manager.closeFileDropdown).toHaveBeenCalled();
    expect(manager.closeExportDropdown).toHaveBeenCalled();
    expect(manager.closeOptionsDropdown).toHaveBeenCalled();
  });
});
