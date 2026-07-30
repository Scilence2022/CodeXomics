/**
 * Tab rendering cache behaviour
 *
 * Restoring a cached tab used to re-parse an HTML snapshot, which produced new
 * elements stripped of the drag/click listeners TrackRenderer and
 * NavigationManager bind to each track. Document-level handlers (wheel zoom)
 * kept working, so the breakage looked partial. The cache now parks the live
 * nodes in a DocumentFragment and moves them back.
 */
/* eslint-disable no-new-func */
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

function loadTabManagerClass() {
  const managerPath = path.join(process.cwd(), 'src/renderer/modules/TabManager.js');
  const content = fs.readFileSync(managerPath, 'utf-8');
  return new Function('window', `${content}; return TabManager;`)({});
}

function createTabManager() {
  const TabManager = loadTabManagerClass();
  const tabManager = Object.create(TabManager.prototype);

  tabManager.tabCache = new Map();
  tabManager.cacheSettings = {
    enabled: true,
    maxCacheSize: 10,
    cacheTimeout: 30 * 60 * 1000,
  };
  tabManager.tabStates = new Map([
    ['tab-1', { currentPosition: { start: 0, end: 1000 } }],
    ['tab-2', { currentPosition: { start: 5000, end: 6000 } }],
  ]);
  tabManager.configManager = null;
  tabManager.genomeBrowser = {};

  // The UI sync is exercised by the app, not by these DOM-level tests
  tabManager.restoreUIStateOnly = () => {};

  return tabManager;
}

function renderTrack() {
  document.body.innerHTML = `
    <div id="genomeViewer">
      <div class="gene-track">
        <div class="track-content"><button id="geneHit">gene</button></div>
      </div>
    </div>
  `;
  return document.getElementById('genomeViewer');
}

describe('TabManager rendering cache', () => {
  let tabManager;

  beforeEach(() => {
    tabManager = createTabManager();
  });

  it('keeps event listeners alive across a cache round trip', () => {
    const viewer = renderTrack();
    const track = viewer.querySelector('.gene-track');
    const hit = document.getElementById('geneHit');

    let dragStarts = 0;
    let clicks = 0;
    const dragHandler = () => dragStarts++;
    track.addEventListener('mousedown', dragHandler);
    track._handleDragMouseDown = dragHandler;
    hit.addEventListener('click', () => clicks++);

    tabManager.cacheTabContent('tab-1');
    expect(viewer.childElementCount).toBe(0);
    expect(tabManager.tabCache.has('tab-1')).toBe(true);

    // Another tab renders into the viewer while tab-1 is parked
    viewer.innerHTML = '<div class="other-tab-content"></div>';

    expect(tabManager.restoreFromCache('tab-1')).toBe(true);
    expect(viewer.querySelector('.other-tab-content')).toBeNull();

    const restoredTrack = viewer.querySelector('.gene-track');
    expect(restoredTrack).toBe(track);
    expect(restoredTrack._handleDragMouseDown).toBe(dragHandler);

    restoredTrack.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true }));
    viewer.querySelector('#geneHit').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    expect(dragStarts).toBe(1);
    expect(clicks).toBe(1);
  });

  it('drops a restored entry so a spent fragment can never blank the viewer', () => {
    const viewer = renderTrack();

    tabManager.cacheTabContent('tab-1');
    expect(tabManager.restoreFromCache('tab-1')).toBe(true);

    // The fragment is empty now that its children live in the document again
    expect(tabManager.tabCache.has('tab-1')).toBe(false);
    expect(tabManager.restoreFromCache('tab-1')).toBe(false);
    expect(viewer.querySelector('.gene-track')).not.toBeNull();
  });

  it('restores scroll offsets recorded before the nodes were detached', () => {
    const viewer = renderTrack();
    const content = viewer.querySelector('.track-content');

    // jsdom has no layout, so drive the scroll properties directly
    Object.defineProperty(content, 'scrollTop', { value: 120, writable: true, configurable: true });
    Object.defineProperty(content, 'scrollLeft', { value: 45, writable: true, configurable: true });

    tabManager.cacheTabContent('tab-1');
    content.scrollTop = 0;
    content.scrollLeft = 0;

    expect(tabManager.restoreFromCache('tab-1')).toBe(true);
    expect(content.scrollTop).toBe(120);
    expect(content.scrollLeft).toBe(45);
  });

  it('never caches an empty viewer', () => {
    document.body.innerHTML = '<div id="genomeViewer"></div>';

    tabManager.cacheTabContent('tab-1');

    expect(tabManager.tabCache.has('tab-1')).toBe(false);
    expect(tabManager.restoreFromCache('tab-1')).toBe(false);
  });

  it('invalidates a cached tab whose position moved on', () => {
    renderTrack();
    tabManager.cacheTabContent('tab-1');

    tabManager.tabStates.get('tab-1').currentPosition = { start: 2000, end: 3000 };

    expect(tabManager.restoreFromCache('tab-1')).toBe(false);
    expect(tabManager.tabCache.has('tab-1')).toBe(false);
  });

  it('ignores the cache entirely while caching is disabled', () => {
    const viewer = renderTrack();
    tabManager.cacheSettings.enabled = false;

    tabManager.cacheTabContent('tab-1');

    expect(tabManager.tabCache.size).toBe(0);
    expect(viewer.childElementCount).toBe(1);
    expect(tabManager.restoreFromCache('tab-1')).toBe(false);
  });
});
