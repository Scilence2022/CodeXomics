/**
 * Settings window (SettingsCenter).
 *
 * The window adopts the existing settings modals rather than copying them, so
 * these tests mount the real markup from index.html and check the contract the
 * managers rely on: ids survive the move, showing a modal from anywhere opens
 * its panel, a manager hiding its modal after Save does not take the panel
 * away, and only the window's own close ends the session.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import NavigationManager from '../../src/renderer/modules/NavigationManager.js';
import SettingsCenter from '../../src/renderer/modules/SettingsCenter.js';

const indexHtml = fs.readFileSync(path.join(process.cwd(), 'src/renderer/index.html'), 'utf8');
const parsedIndex = new DOMParser().parseFromString(indexHtml, 'text/html');

const STATIC_MODALS = [
  'generalSettingsModal',
  'llmConfigModal',
  'multiAgentSettingsModal',
  'mcpSettingsModal',
  'searchSettingsModal',
  'geneDetailSettingsModal',
  'tabSettingsModal',
  'externalToolsModal',
  'pluginManagementModal',
];

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

function mount() {
  document.body.innerHTML = [
    parsedIndex.getElementById('settingsCenterModal').outerHTML,
    ...STATIC_MODALS.map(id => parsedIndex.getElementById(id).outerHTML),
  ].join('\n');
  return new SettingsCenter().init();
}

let center;

beforeEach(() => {
  globalThis.requestAnimationFrame = callback => setTimeout(callback, 0);
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  center?.destroy();
  center = null;
  delete window.genomeBrowser;
  delete window.generalSettingsManager;
  document.body.innerHTML = '';
  document.body.className = '';
});

describe('SettingsCenter structure', () => {
  it('gives every panel a group and a host, and every host at least one panel', () => {
    const groups = SettingsCenter.GROUPS.map(group => group.id);
    const ids = new Set();
    for (const pane of SettingsCenter.PANES) {
      expect(groups).toContain(pane.group);
      expect(SettingsCenter.HOSTS[pane.host]).toBeDefined();
      expect(ids.has(pane.id)).toBe(false);
      ids.add(pane.id);
    }
    for (const hostId of Object.keys(SettingsCenter.HOSTS)) {
      expect(SettingsCenter.PANES.some(pane => pane.host === hostId)).toBe(true);
    }
  });

  it('splits General Settings into one panel per tab, covering every tab', () => {
    const tabs = [...parsedIndex.querySelectorAll('#generalSettingsModal .llm-provider-tabs .tab-button')].map(
      button => button.dataset.tab
    );
    const paneTabs = SettingsCenter.PANES.filter(pane => pane.host === 'general').map(pane => pane.tab);
    expect([...paneTabs].sort()).toEqual([...tabs].sort());
  });

  it('ships the window markup and loads its script before the renderer', () => {
    expect(parsedIndex.getElementById('settingsCenterModal')).not.toBeNull();
    expect(indexHtml).toContain('href="css/settings-center.css"');
    expect(indexHtml.indexOf('modules/SettingsCenter.js')).toBeGreaterThan(0);
    expect(indexHtml.indexOf('modules/SettingsCenter.js')).toBeLessThan(indexHtml.indexOf('renderer-modular.js'));
  });

  it('every static host modal exists in index.html', () => {
    for (const host of Object.values(SettingsCenter.HOSTS)) {
      if (!host.modalId || ['chatboxSettingsModal', 'trackSettingsModal'].includes(host.modalId)) continue;
      expect(parsedIndex.getElementById(host.modalId)).not.toBeNull();
    }
  });

  it('has no duplicate clear-cache button ids (General Caching vs Tab Settings)', () => {
    expect(parsedIndex.querySelectorAll('#clearCacheBtn')).toHaveLength(1);
    expect(parsedIndex.querySelector('#tabSettingsModal #clearTabCacheBtn')).not.toBeNull();
  });
});

describe('SettingsCenter adoption and navigation', () => {
  it('moves the settings modals into the window without changing their ids', () => {
    center = mount();
    for (const id of STATIC_MODALS) {
      const modal = document.getElementById(id);
      expect(modal.closest('#settingsCenterModal')).not.toBeNull();
      expect(modal.classList.contains('settings-center-embedded')).toBe(true);
    }
    expect(center.nav.querySelectorAll('.settings-center-nav-item')).toHaveLength(SettingsCenter.PANES.length);
  });

  it('hides Cancel/Close buttons, which the window replaces', () => {
    center = mount();
    const cancel = [...document.querySelectorAll('#llmConfigModal .modal-footer button')].find(
      button => button.textContent.trim() === 'Cancel'
    );
    expect(cancel.classList.contains('settings-center-hidden')).toBe(true);
    expect(document.getElementById('saveLLMConfigBtn').classList.contains('settings-center-hidden')).toBe(false);
  });

  it('opens a panel through its manager and shows only that host', async () => {
    center = mount();
    const showConfigModal = vi.fn(() => document.getElementById('llmConfigModal').classList.add('show'));
    window.genomeBrowser = { llmConfigManager: { showConfigModal } };

    expect(center.open('ai.providers')).toBe(true);
    await flush();

    expect(showConfigModal).toHaveBeenCalledTimes(1);
    expect(center.isOpen).toBe(true);
    expect(document.body.classList.contains('settings-center-open')).toBe(true);
    expect(center.hostElements.get('llm').hidden).toBe(false);
    expect(center.hostElements.get('general').hidden).toBe(true);
    expect(document.getElementById('settingsCenterPaneTitle').textContent).toBe('Model Providers');

    // Returning to a panel in the same session does not reload it
    center.open('view.search');
    center.open('ai.providers');
    await flush();
    expect(showConfigModal).toHaveBeenCalledTimes(1);
  });

  it('opens the window at a panel whenever its modal is shown from elsewhere', async () => {
    center = mount();
    document.getElementById('mcpSettingsModal').classList.add('show');
    await flush();
    expect(center.isOpen).toBe(true);
    expect(center.activePaneId).toBe('ai.mcp');
  });

  it('treats an inline display (Tab Settings) as shown, too', async () => {
    center = mount();
    document.getElementById('tabSettingsModal').style.display = 'flex';
    await flush();
    expect(center.activePaneId).toBe('general.tabs');
  });

  it('keeps the panel when its manager hides the modal after Save', async () => {
    center = mount();
    const modal = document.getElementById('searchSettingsModal');
    modal.classList.add('show');
    await flush();

    modal.classList.remove('show');
    await flush();

    expect(center.isOpen).toBe(true);
    expect(modal.classList.contains('show')).toBe(true);
  });

  it('closes on the close button, on Escape, and when generic code hides the window', async () => {
    center = mount();
    center.open('view.search');
    document.querySelector('.settings-center-close').click();
    expect(center.isOpen).toBe(false);
    expect(document.getElementById('searchSettingsModal').classList.contains('show')).toBe(false);

    center.open('view.search');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(center.isOpen).toBe(false);

    center.open('view.search');
    document.getElementById('settingsCenterModal').classList.remove('show');
    await flush();
    expect(center.isOpen).toBe(false);
  });

  it('leaves Escape to a dialog opened on top of the window', () => {
    center = mount();
    center.open('ai.mcp');
    const dialog = document.createElement('div');
    dialog.className = 'modal show';
    document.body.appendChild(dialog);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(center.isOpen).toBe(true);
  });

  it('routes General Settings panels to the requested tab', async () => {
    center = mount();
    const switchTab = vi.fn();
    const showGeneralSettingsModal = vi.fn(async () => {});
    window.genomeBrowser = { showGeneralSettingsModal };
    window.generalSettingsManager = { switchTab };

    await center.selectPane(center.getPane('system.memory'));
    expect(showGeneralSettingsModal).toHaveBeenCalledWith('memory');
    expect(switchTab).toHaveBeenLastCalledWith('memory');

    await center.selectPane(center.getPane('general.appearance'));
    expect(showGeneralSettingsModal).toHaveBeenCalledTimes(1);
    expect(switchTab).toHaveBeenLastCalledWith('appearance');
  });

  it('keeps the latest General Settings tab when the initial load finishes', async () => {
    center = mount();
    let finish;
    const loading = new Promise(resolve => {
      finish = resolve;
    });
    const switchTab = vi.fn();
    window.genomeBrowser = { showGeneralSettingsModal: vi.fn(() => loading) };
    window.generalSettingsManager = { switchTab };

    center.open('general.appearance');
    center.open('system.memory');
    finish();
    await flush();

    expect(window.genomeBrowser.showGeneralSettingsModal).toHaveBeenCalledTimes(1);
    expect(switchTab.mock.calls).toEqual([['memory']]);
    expect(center.activePaneId).toBe('system.memory');
  });

  it('stays closed if a settings manager shows its modal after closing', async () => {
    center = mount();
    let finish;
    const loading = new Promise(resolve => {
      finish = resolve;
    });
    const modal = document.getElementById('generalSettingsModal');
    window.genomeBrowser = {
      showGeneralSettingsModal: async () => {
        await loading;
        modal.classList.add('show');
      },
    };

    center.open('general.appearance');
    center.close();
    finish();
    await flush();

    expect(center.isOpen).toBe(false);
    expect(modal.classList.contains('show')).toBe(false);
  });

  it('adopts a modal its manager builds on first use', async () => {
    center = mount();
    const modal = document.createElement('div');
    modal.id = 'chatboxSettingsModal';
    modal.className = 'modal show';
    modal.innerHTML = '<div class="modal-content"><div class="modal-body"></div></div>';
    document.body.appendChild(modal);
    await flush();
    expect(modal.closest('#settingsCenterModal')).not.toBeNull();
    expect(center.activePaneId).toBe('ai.chatbox');
  });

  it('answers toggle_settings_modal state questions', () => {
    center = mount();
    expect(center.managesModal('llmConfigModal')).toBe(true);
    expect(center.managesModal('literatureSettingsModal')).toBe(true);
    expect(center.managesModal('actionListModal')).toBe(false);
    center.open('ai.providers');
    expect(center.isModalShown('llmConfigModal')).toBe(true);
    expect(center.isModalShown('mcpSettingsModal')).toBe(false);
  });
});

describe('SettingsCenter search', () => {
  it('finds panels by name and by Chinese keyword', () => {
    center = mount();
    expect(center.search('model providers')[0].paneId).toBe('ai.providers');
    expect(center.search('主题')[0].paneId).toBe('general.appearance');
  });

  it('finds individual settings inside adopted panels, without their help text', () => {
    center = mount();
    const hit = center.search('reverse complement').find(entry => entry.kind === 'setting');
    expect(hit.paneId).toBe('view.search');
    expect(hit.text).toBe('Include Reverse Complement');

    const cache = center.search('cache size');
    expect(cache[0].paneId).toBe('system.caching');

    const apiKeys = center.search('api key').filter(entry => entry.kind === 'setting');
    expect(apiKeys.length).toBeGreaterThan(3);
  });

  it('opens a result on its panel and internal tab', async () => {
    center = mount();
    const switchSearchSettingsTab = vi.fn();
    window.genomeBrowser = { navigationManager: { showSearchSettingsModal: vi.fn() } };
    // The search panel's tab buttons are wired by NavigationManager
    document
      .querySelectorAll('#searchSettingsModal .tab-button')
      .forEach(button => button.addEventListener('click', () => switchSearchSettingsTab(button.dataset.tab)));

    center.searchInput.value = 'history limit';
    center.runSearch('history limit');
    const index = center.searchResults.findIndex(entry => entry.kind === 'setting');
    await center.openResult(index);

    expect(center.activePaneId).toBe('view.search');
    expect(switchSearchSettingsTab).toHaveBeenCalledWith('history');
  });

  it('opens a collapsed section from a search result and clears the results', async () => {
    center = mount();
    const url = document.getElementById('mcpServerUrl');
    const legacy = url.closest('details');
    center.open('ai.mcp');
    center.searchInput.value = 'legacy server url';
    center.runSearch(center.searchInput.value);
    expect(center.searchInput.getAttribute('aria-expanded')).toBe('true');
    expect(center.searchInput.getAttribute('aria-activedescendant')).toBe('settings-center-result-0');
    expect(legacy.open).toBe(false);

    await center.openResult(0);
    expect(legacy.open).toBe(true);
    expect(center.searchInput.value).toBe('');
    expect(center.nav.hidden).toBe(false);
  });

  it('shows a message when nothing matches and restores the sections when cleared', () => {
    center = mount();
    center.runSearch('zzzz-not-a-setting');
    expect(center.results.textContent).toContain('No settings match');
    expect(center.nav.hidden).toBe(true);
    center.runSearch('');
    expect(center.nav.hidden).toBe(false);
  });
});

describe('Settings entry points', () => {
  const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

  it('binds Cmd/Ctrl+, to the Settings window', () => {
    const menu = read('src/main/menu-builder.js');
    expect(menu).toMatch(
      /label: 'Settings…',\s*accelerator: 'Cmd\+,',\s*click: \(\) => \{\s*sendToCurrentMainWindow\('open-settings'\)/
    );
    expect(menu).toContain("accelerator: 'Ctrl+,'");
  });

  it('allows the IPC channels the window uses', () => {
    const preload = read('src/preload.js');
    expect(preload).toContain("'open-settings'");
    expect(preload).toContain("'open-blast-config-window'");
    expect(preload).toContain("'open-blast-downloader-window'");
    expect(read('src/main/ipc-handlers.js')).toContain("ipcMain.on('open-blast-config-window'");
    expect(read('src/renderer/renderer-modular.js')).toContain("ipcRenderer.on('open-settings'");
  });
});

describe('Search settings form', () => {
  it('keeps zero context length and opens the tab with an invalid number', async () => {
    center = mount();
    const setSearchSettings = vi.fn();
    const navigation = Object.create(NavigationManager.prototype);
    navigation.genomeBrowser = { configManager: { setSearchSettings } };
    window.genomeBrowser = { navigationManager: navigation };
    center.open('view.search');
    await flush();

    document.getElementById('searchContextLength').value = '0';
    expect(navigation.saveSearchSettings()).toBe(true);
    expect(setSearchSettings).toHaveBeenCalledWith(expect.objectContaining({ contextLength: 0 }));

    document.getElementById('searchTimeout').value = '301';
    expect(navigation.saveSearchSettings()).toBe(false);
    expect(document.querySelector('.search-settings-tab-content.active').dataset.tab).toBe('advanced');
    expect(setSearchSettings).toHaveBeenCalledTimes(1);
  });
});
