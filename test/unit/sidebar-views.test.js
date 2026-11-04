/**
 * Sidebar views: the rail switches between grouped views of sidebar sections.
 * A section's open/closed state stays in style.display; the active view only
 * decides which group is rendered.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const UIManager = require('../../src/renderer/modules/UIManager.js');

const section = (id, title, { restorable = false, hidden = false } = {}) => `
  <div class="sidebar-section" id="${id}"${restorable ? ' data-restorable="true"' : ''}${
    hidden ? ' style="display: none;"' : ''
  }>
    <div class="section-header"><h3>${title}</h3>
      <button class="close-panel-btn" data-panel="${id}"><i class="fas fa-times"></i></button>
    </div>
    <div class="body">${title} body</div>
  </div>`;

function renderSidebar() {
  document.body.innerHTML = `
    <main class="main-content">
      <nav id="sidebarRail">
        <button class="sidebar-rail-btn active" data-view="display"></button>
        <button class="sidebar-rail-btn" data-view="inspect"><span class="sidebar-rail-dot" hidden></span></button>
        <button class="sidebar-rail-btn" data-view="explore"><span class="sidebar-rail-badge" hidden></span></button>
      </nav>
      <aside id="sidebar" style="width: 280px">
        <div class="sidebar-view active" data-view="display">
          ${section('tracksSection', 'Track Control', { restorable: true })}
          ${section('featuresSection', 'Show Features', { restorable: true })}
          <div class="sidebar-view-empty"></div>
          <div class="sidebar-view-restore" hidden></div>
        </div>
        <div class="sidebar-view" data-view="inspect" data-transient="true">
          ${section('geneDetailsSection', 'Gene Details', { hidden: true })}
          <div class="sidebar-view-empty"></div>
          <div class="sidebar-view-restore" hidden></div>
        </div>
        <div class="sidebar-view" data-view="explore">
          ${section('operonsSection', 'Operons in View', { restorable: true })}
          ${section('searchResultsSection', 'Search Results', { hidden: true })}
          <div class="sidebar-view-empty"></div>
          <div class="sidebar-view-restore" hidden></div>
        </div>
      </aside>
      <div id="sidebarSplitter"></div>
    </main>
  `;
  const sidebar = document.getElementById('sidebar');
  Object.defineProperty(sidebar, 'offsetWidth', {
    configurable: true,
    get: () => (sidebar.classList.contains('collapsed') ? 0 : parseInt(sidebar.style.width, 10) || 0),
  });
}

function createManager(genomeBrowser = {}) {
  const manager = new UIManager(genomeBrowser);
  clearTimeout(manager._uiInitializationTimer);
  manager.initializeSidebarViews();
  return manager;
}

const activeView = () => document.querySelector('#sidebar > .sidebar-view.active')?.dataset.view;
const flushObserver = () => new Promise(resolve => setTimeout(resolve, 0));

describe('UIManager sidebar views', () => {
  beforeEach(() => {
    localStorage.clear();
    renderSidebar();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('switches to the view that holds a panel when the panel is shown', () => {
    const manager = createManager();

    manager.showPanel('geneDetailsSection');

    expect(activeView()).toBe('inspect');
    expect(document.querySelector('[data-view="inspect"].sidebar-rail-btn').classList.contains('active')).toBe(true);
    expect(document.querySelector('[data-view="display"].sidebar-rail-btn').classList.contains('active')).toBe(false);
  });

  it('collapses the sidebar when the active rail button is clicked again, and reopens on a view', () => {
    const manager = createManager();
    const sidebar = document.getElementById('sidebar');

    manager.handleSidebarRailClick('display');
    expect(sidebar.classList.contains('collapsed')).toBe(true);
    expect(document.getElementById('sidebarRail').classList.contains('sidebar-hidden')).toBe(true);

    manager.handleSidebarRailClick('explore');
    expect(sidebar.classList.contains('collapsed')).toBe(false);
    expect(activeView()).toBe('explore');
  });

  it('returns from the transient Inspect view once its last panel closes', async () => {
    const manager = createManager();
    manager.setActiveSidebarView('explore');
    manager.showPanel('geneDetailsSection');
    expect(activeView()).toBe('inspect');

    document.getElementById('geneDetailsSection').style.display = 'none';
    await flushObserver();

    expect(activeView()).toBe('explore');
  });

  it('never persists the transient Inspect view as the startup view', () => {
    const manager = createManager();
    manager.setActiveSidebarView('explore');
    manager.setActiveSidebarView('inspect');

    expect(localStorage.getItem('sidebarActiveView')).toBe('explore');
  });

  it('offers a restore chip for a closed restorable panel and reopens it from the chip', async () => {
    const manager = createManager({ clearGeneSelection: () => {} });

    manager.closePanel('tracksSection');
    await flushObserver();

    const chip = document.querySelector('[data-view="display"] .sidebar-restore-chip');
    expect(chip?.dataset.panel).toBe('tracksSection');
    expect(chip.textContent.trim()).toBe('Track Control');

    chip.click();
    expect(document.getElementById('tracksSection').style.display).toBe('block');
    expect(document.querySelector('[data-view="display"] .sidebar-view-restore').hidden).toBe(true);
  });

  it('marks a view empty when none of its panels are open', () => {
    const manager = createManager();
    manager.refreshSidebarViews();

    expect(document.querySelector('.sidebar-view[data-view="inspect"]').classList.contains('is-empty')).toBe(true);
    expect(document.querySelector('.sidebar-view[data-view="display"]').classList.contains('is-empty')).toBe(false);
  });

  it('collapses a section from its header, persists it, and ignores clicks on header buttons', () => {
    createManager();
    const tracks = document.getElementById('tracksSection');

    tracks.querySelector('.section-header h3').click();
    expect(tracks.classList.contains('section-collapsed')).toBe(true);
    expect(JSON.parse(localStorage.getItem('sidebarCollapsedSections'))).toEqual(['tracksSection']);

    tracks.querySelector('.close-panel-btn').click();
    expect(tracks.classList.contains('section-collapsed')).toBe(true);

    // A fresh renderer restores the collapsed state
    renderSidebar();
    createManager();
    expect(document.getElementById('tracksSection').classList.contains('section-collapsed')).toBe(true);
  });

  it('expands a collapsed section when it is revealed', () => {
    const manager = createManager();
    manager.toggleSidebarSectionCollapsed('operonsSection', false);
    expect(document.getElementById('operonsSection').classList.contains('section-collapsed')).toBe(true);

    manager.revealSidebarPanel('operonsSection');

    expect(activeView()).toBe('explore');
    expect(document.getElementById('operonsSection').classList.contains('section-collapsed')).toBe(false);
  });

  it('shows the search result count on the Explore rail button while results are open', () => {
    const manager = createManager({ navigationManager: { searchResults: [{}, {}, {}] } });

    document.getElementById('searchResultsSection').style.display = 'block';
    manager.refreshSidebarViews();

    const badge = document.querySelector('[data-view="explore"] .sidebar-rail-badge');
    expect(badge.hidden).toBe(false);
    expect(badge.textContent).toBe('3');
  });

  it('restores the saved startup view', () => {
    localStorage.setItem('sidebarActiveView', 'explore');
    createManager();

    expect(activeView()).toBe('explore');
  });
});
