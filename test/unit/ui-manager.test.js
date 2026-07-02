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

describe('UIManager sidebar controls', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <main class="main-content sidebar-collapsed"></main>
      <aside id="sidebar" class="collapsed" style="width: 0px" data-previous-width="320px">
        <section class="sidebar-section"></section>
      </aside>
      <div id="sidebarSplitter" class="collapsed"></div>
      <button id="splitterToggleBtn" class="collapsed" title="Show Sidebar">
        <i class="fas fa-chevron-right"></i>
      </button>
      <input id="toggleSidebar" type="checkbox">
    `;

    const sidebar = document.getElementById('sidebar');
    Object.defineProperty(sidebar, 'offsetWidth', {
      configurable: true,
      get: () => (sidebar.classList.contains('collapsed') ? 0 : parseInt(sidebar.style.width, 10) || 0),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('synchronizes both controls when a panel opens the hidden sidebar', () => {
    const manager = new UIManager({});

    manager.showSidebarIfHidden();

    expect(document.getElementById('sidebar').classList.contains('collapsed')).toBe(false);
    expect(document.getElementById('sidebar').style.width).toBe('320px');
    expect(document.getElementById('toggleSidebar').checked).toBe(true);
    expect(document.getElementById('splitterToggleBtn').classList.contains('collapsed')).toBe(false);
    expect(document.getElementById('splitterToggleBtn').title).toBe('Hide Sidebar');
  });
});
