/**
 * "Operons in View" panel tab independence.
 *
 * The panel sits in the shared sidebar, outside #genomeViewer. Before this was
 * tracked per tab, switching tabs left the previous tab's operons on screen
 * (always on a cached restore, which never re-renders the gene track), and
 * closing the panel in one tab closed it in every tab.
 */
import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import TrackRenderer from '../../src/renderer/modules/TrackRenderer.js';

function loadTabManagerClass() {
  const managerPath = path.join(process.cwd(), 'src/renderer/modules/TabManager.js');
  const content = fs.readFileSync(managerPath, 'utf-8');
  // eslint-disable-next-line no-new-func
  return new Function('window', `${content}; return TabManager;`)({});
}

function renderSidebar() {
  document.body.innerHTML = `
    <div id="sidebar">
      <div class="sidebar-section" id="operonsSection">
        <div id="operonsList" class="operons-list"></div>
      </div>
    </div>
  `;
}

function makeSetup() {
  const genomeBrowser = {
    operonColors: ['#e74c3c', '#3498db'],
    operonColorIndex: 0,
    operonColorMap: new Map(),
    assignOperonColor(name) {
      if (!this.operonColorMap.has(name)) {
        this.operonColorMap.set(name, this.operonColors[this.operonColorMap.size % this.operonColors.length]);
      }
      return this.operonColorMap.get(name);
    },
    uiManager: {
      showSidebarIfHidden: vi.fn(),
      checkAndHideSidebarIfAllPanelsClosed: vi.fn(),
    },
  };
  const renderer = new TrackRenderer(genomeBrowser);
  genomeBrowser.trackRenderer = renderer;

  const TabManager = loadTabManagerClass();
  const tabManager = Object.create(TabManager.prototype);
  tabManager.genomeBrowser = genomeBrowser;
  tabManager.tabStates = new Map([
    ['tab-1', { id: 'tab-1', sidebarPanels: {}, operonsInView: [] }],
    ['tab-2', { id: 'tab-2', sidebarPanels: {}, operonsInView: [] }],
  ]);
  tabManager.activeTabId = 'tab-1';
  genomeBrowser.tabManager = tabManager;

  return { genomeBrowser, renderer, tabManager };
}

/** Simulate a tab switch through the sidebar save/restore pair both restore paths use. */
function switchTab(tabManager, toTabId) {
  tabManager.saveSidebarPanelStates(tabManager.tabStates.get(tabManager.activeTabId));
  tabManager.activeTabId = toTabId;
  tabManager.restoreSidebarPanelStates(tabManager.tabStates.get(toTabId));
}

function shownOperonNames() {
  return Array.from(document.querySelectorAll('#operonsList .operon-name')).map(el => el.textContent);
}

const OPERONS = [
  { name: 'lac_operon', start: 1000, end: 4000, strand: 1, genes: ['lacZ', 'lacY', 'lacA'] },
  { name: 'trp_operon', start: 90000, end: 96000, strand: -1, genes: ['trpE', 'trpD'] },
];

describe('Operons in View panel per tab', () => {
  let setup;

  beforeEach(() => {
    renderSidebar();
    setup = makeSetup();
  });

  it('shows each tab its own operons, even when the gene track is not re-rendered', () => {
    const { renderer, tabManager } = setup;

    renderer.updateOperonsPanel(OPERONS, new Set(['lac_operon']));
    switchTab(tabManager, 'tab-2');
    renderer.updateOperonsPanel(OPERONS, new Set(['trp_operon']));
    expect(shownOperonNames()).toEqual(['trp']);

    // Cached restore: nothing re-renders, the panel must come from tab-1's state
    switchTab(tabManager, 'tab-1');
    expect(shownOperonNames()).toEqual(['lac']);
    expect(document.querySelector('#operonsList .operon-gene-count').textContent).toBe('3');

    switchTab(tabManager, 'tab-2');
    expect(shownOperonNames()).toEqual(['trp']);
    expect(document.querySelector('#operonsList .operon-details').textContent).toContain('(-)');
  });

  it('keeps the click-to-navigate handler on restored entries', () => {
    const { renderer, tabManager } = setup;
    renderer.navigateToOperon = vi.fn();

    renderer.updateOperonsPanel(OPERONS, new Set(['lac_operon']));
    switchTab(tabManager, 'tab-2');
    switchTab(tabManager, 'tab-1');

    document.querySelector('#operonsList .operon-item').click();
    expect(renderer.navigateToOperon).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'lac_operon', start: 1000, end: 4000 })
    );
  });

  it('shows the empty message for a tab that has no operons yet', () => {
    const { renderer, tabManager } = setup;

    renderer.updateOperonsPanel(OPERONS, new Set(['lac_operon']));
    switchTab(tabManager, 'tab-2');
    expect(shownOperonNames()).toEqual([]);
    expect(document.querySelector('#operonsList .no-operons')).not.toBeNull();
  });

  it('closes the panel only in the tab where it was closed', () => {
    const { tabManager } = setup;
    const panel = document.getElementById('operonsSection');

    // Both tabs have seen the panel open
    switchTab(tabManager, 'tab-2');
    switchTab(tabManager, 'tab-1');

    panel.style.display = 'none';
    switchTab(tabManager, 'tab-2');
    expect(panel.style.display).toBe('block');

    switchTab(tabManager, 'tab-1');
    expect(panel.style.display).toBe('none');
  });

  it('does not force the sidebar open just because the operons panel is shown', () => {
    const { tabManager, genomeBrowser } = setup;

    switchTab(tabManager, 'tab-2');
    expect(genomeBrowser.uiManager.showSidebarIfHidden).not.toHaveBeenCalled();
  });

  it('leaves the panel visibility alone for tab states saved before it was tracked', () => {
    const { tabManager } = setup;
    const panel = document.getElementById('operonsSection');
    panel.style.display = 'none';

    tabManager.restoreSidebarPanelStates({ id: 'legacy', sidebarPanels: {} });
    expect(panel.style.display).toBe('none');
  });
});
