import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const UIManager = require('../../src/renderer/modules/UIManager.js');

describe('UIManager dropdown handlers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    localStorage.clear();
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
    localStorage.clear();
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

  it('clears stale collapsed overflow when a saved non-zero width makes the sidebar visible immediately', () => {
    const sidebar = document.getElementById('sidebar');
    sidebar.style.width = '420px';
    sidebar.style.overflow = 'hidden';
    sidebar.dataset.previousWidth = '420px';

    const manager = new UIManager({});
    manager.showSidebarIfHidden();

    expect(sidebar.classList.contains('collapsed')).toBe(false);
    expect(sidebar.style.width).toBe('420px');
    expect(sidebar.style.overflow).toBe('');
    expect(sidebar.style.overflowY).toBe('');
  });

  it('records a saved width without re-expanding a collapsed sidebar during initialization', () => {
    localStorage.setItem('sidebarWidth', '360px');
    const sidebar = document.getElementById('sidebar');
    const manager = new UIManager({});

    manager.restoreSidebarWidth();

    expect(sidebar.classList.contains('collapsed')).toBe(true);
    expect(sidebar.style.width).toBe('0px');
    expect(sidebar.dataset.previousWidth).toBe('360px');
  });

  it('keeps the expanded sidebar CSS state scrollable despite stale inline overflow', () => {
    const layoutCss = fs.readFileSync(path.join(process.cwd(), 'src/renderer/css/layout.css'), 'utf8');

    expect(layoutCss).toMatch(/\.sidebar:not\(\.collapsed\)\s*\{[^}]*overflow-y:\s*auto\s*!important;/s);
  });
});
