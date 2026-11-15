/**
 * Settings persistence and backup.
 *
 * Only sections with a config file survived a restart, so search, track,
 * agent, MCP server, skill and external-tool settings were silently lost.
 * They now travel in preferences.json. Export/import covers every setting,
 * never carries credentials, and keeps the ones already on this computer.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { runInNewContext } from 'vm';
import configurationCredentials from '../../src/shared/configuration-credentials.js';
import GeneralSettingsManager from '../../src/renderer/modules/GeneralSettingsManager.js';

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

function memoryStorage(initial = {}) {
  const store = { ...initial };
  return {
    store,
    getItem: key => (key in store ? store[key] : null),
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: key => {
      delete store[key];
    },
  };
}

function loadConfigManager(localStorage = memoryStorage()) {
  const ConfigManager = runInNewContext(`${read('src/renderer/modules/ConfigManager.js')}\nConfigManager`, {
    window: { configurationCredentials, VERSION_INFO: { fullVersion: '9.9.9' } },
    localStorage,
    structuredClone,
    console: { log() {}, warn() {}, error() {} },
  });
  const manager = Object.create(ConfigManager.prototype);
  manager.config = manager.getDefaultConfig();
  manager.waitForInitialization = async () => {};
  manager.saveConfig = vi.fn(async () => ({ success: true }));
  return { ConfigManager, manager, localStorage };
}

describe('preferences.json', () => {
  it('is a config file the main process reads and writes', () => {
    expect(read('src/main/ipc-handlers.js')).toMatch(/preferences: 'preferences\.json'/);
  });

  it('carries the preference sections and drops per-file track overrides', () => {
    const { manager } = loadConfigManager();
    manager.config.search = { settings: { caseSensitive: true }, history: [] };
    manager.config.mcpServers = { custom: { id: 'custom', url: 'http://localhost:1' } };
    manager.config.skills = { disabledIds: ['a'] };
    manager.config.tracks = { genes: { settings: { maxRows: 9 } }, 'reads::file-1': { settings: { x: 1 } } };
    manager.config.chatHistoryRuntime = { big: true };

    const persisted = manager.buildPersistableConfig();

    expect(persisted.preferences.search.settings.caseSensitive).toBe(true);
    expect(persisted.preferences.mcpServers.custom.url).toBe('http://localhost:1');
    expect(persisted.preferences.skills.disabledIds).toEqual(['a']);
    expect(Object.keys(persisted.preferences.tracks)).toEqual(['genes']);
    expect(persisted.preferences.chatHistoryRuntime).toBeUndefined();
  });

  it('restores stored sections over the defaults and ignores unknown keys', () => {
    const { manager } = loadConfigManager();
    manager.config.mcpServers = { 'deep-gene-research': { id: 'deep-gene-research' } };
    manager.applyPreferencesSection({
      mcpServers: { custom: { id: 'custom' } },
      literature: { pageSize: 25 },
      notAPreference: { injected: true },
    });

    expect(Object.keys(manager.config.mcpServers).sort()).toEqual(['custom', 'deep-gene-research']);
    expect(manager.config.literature.pageSize).toBe(25);
    expect(manager.config.notAPreference).toBeUndefined();
  });

  it('encrypts Authorization headers like other credentials', () => {
    expect(configurationCredentials.CONFIG_CREDENTIAL_FIELDS).toContain('authorization');
  });
});

describe('settings export and import', () => {
  it('exports every setting section without credentials or machine state', () => {
    const { manager } = loadConfigManager();
    manager.config.llm.providers.openai.apiKey = 'sk-secret';
    manager.config.mcpServers = { custom: { headers: { Authorization: 'Bearer token' } } };
    manager.config.app.recentFiles = ['/private/genome.gbk'];

    const exported = manager.buildSettingsExport();
    const text = JSON.stringify(exported);

    expect(exported.format).toBe('codexomics-settings');
    expect(exported.appVersion).toBe('9.9.9');
    expect(Object.keys(exported.sections)).toEqual(
      expect.arrayContaining(['generalSettings', 'llm', 'ui', 'app', 'mcpServers'])
    );
    expect(text).not.toContain('sk-secret');
    expect(text).not.toContain('Bearer token');
    expect(text).not.toContain('/private/genome.gbk');
  });

  it('imports settings and keeps the credentials stored on this computer', async () => {
    const { manager } = loadConfigManager();
    manager.config.llm.providers.openai.apiKey = 'sk-local';
    manager.config.mcpServers = { custom: { url: 'old', headers: { Authorization: 'Bearer local' } } };

    const file = manager.buildSettingsExport();
    file.sections.llm.providers.openai.model = 'gpt-imported';
    file.sections.mcpServers.custom.url = 'new';

    const imported = await manager.importSettingsExport(JSON.stringify(file));

    expect(imported).toEqual(expect.arrayContaining(['llm', 'mcpServers']));
    expect(manager.config.llm.providers.openai.apiKey).toBe('sk-local');
    expect(manager.config.llm.providers.openai.model).toBe('gpt-imported');
    expect(manager.config.mcpServers.custom).toEqual({ url: 'new', headers: { Authorization: 'Bearer local' } });
    expect(manager.saveConfig).toHaveBeenCalled();
  });

  it('accepts the older General Settings export format', async () => {
    const { manager } = loadConfigManager();
    await manager.importSettingsExport({ version: '1.0', settings: { compactMode: true } });
    expect(manager.config.generalSettings.compactMode).toBe(true);
  });

  it('rejects files that are not a settings export', async () => {
    const { manager } = loadConfigManager();
    await expect(manager.importSettingsExport({ hello: 'world' })).rejects.toThrow(/not a CodeXomics settings export/);
  });

  it('mirrors the BLAST+ setup between localStorage and preferences', () => {
    const storage = memoryStorage({ 'blast-config': JSON.stringify({ blastExecutablePath: '/usr/bin/blastn' }) });
    const { manager } = loadConfigManager(storage);
    manager.syncBlastToolsFromStorage();
    expect(manager.config.blastTools.blastExecutablePath).toBe('/usr/bin/blastn');

    storage.removeItem('blast-config');
    manager.restoreBlastToolsToStorage();
    expect(JSON.parse(storage.getItem('blast-config')).blastExecutablePath).toBe('/usr/bin/blastn');
  });
});

describe('General Settings fixes', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  function manager() {
    const instance = Object.create(GeneralSettingsManager.prototype);
    instance.defaultSettings = new GeneralSettingsManager(null).defaultSettings;
    instance.settings = { ...instance.defaultSettings, compactMode: true, fontSize: 'large' };
    instance.configManager = { set: vi.fn(async () => {}), saveConfig: vi.fn(async () => {}) };
    instance.updateUIFromSettings = vi.fn();
    instance.applySettings = vi.fn();
    instance.showNotification = vi.fn();
    return instance;
  }

  it('header Reset to Defaults restores the real defaults', async () => {
    const instance = manager();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await instance.resetToDefaults();
    expect(instance.settings).toEqual(instance.defaultSettings);
    expect(instance.configManager.set).toHaveBeenCalledWith('generalSettings', instance.defaultSettings);
    window.confirm.mockRestore();
  });

  it('Clear Cache leaves settings and user data in localStorage', async () => {
    const instance = manager();
    localStorage.setItem('localCustomConfigs', '[]');
    localStorage.setItem('blast-config', '{}');
    localStorage.setItem('genomeBrowser_literatureSettings', '{}');
    localStorage.setItem('chatHistory_win_1', '[]');
    localStorage.setItem('_uiStyleHint', 'midnight');
    localStorage.setItem('someCache', 'x');

    await instance.clearCache();

    expect(localStorage.getItem('someCache')).toBeNull();
    for (const key of [
      'localCustomConfigs',
      'blast-config',
      'genomeBrowser_literatureSettings',
      'chatHistory_win_1',
      '_uiStyleHint',
    ]) {
      expect(localStorage.getItem(key)).not.toBeNull();
    }
  });

  it('fills About with version and runtime data when opened', async () => {
    document.body.innerHTML = `
      <div id="security-tab"><div class="system-info"><span class="info-label">Renderer Node.js Guard:</span></div></div>
      <div id="about-tab"><p id="about-version"></p><div class="system-info">
        <span id="platformInfo">Loading...</span><span id="runtimeInfo">Loading...</span>
        <span id="memoryInfo">Loading...</span>
        <span id="languageInfo">Loading...</span></div></div>`;
    vi.stubGlobal('VERSION_INFO', { fullVersion: '1.2.3' });
    vi.stubGlobal('nodeAPI', { platform: 'darwin', version: 'v22.18.0' });
    vi.stubGlobal('os', { arch: () => 'arm64' });
    vi.stubGlobal('electronAPI', { getCurrentLanguage: vi.fn().mockResolvedValue('zh-CN') });
    const userAgent = vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Chrome/123.0.4 Electron/32.1.0');
    try {
      manager().switchTab('about');
      await Promise.resolve();
      expect(document.querySelector('#security-tab .info-label').textContent).toBe('Renderer Node.js Guard:');
      expect(document.getElementById('about-version').textContent).toBe('Version 1.2.3');
      expect(document.getElementById('platformInfo').textContent).toBe('macOS · arm64');
      expect(document.getElementById('runtimeInfo').textContent).toBe(
        'Electron 32.1.0 · Chromium 123.0.4 · Node.js v22.18.0'
      );
      expect(document.getElementById('languageInfo').textContent).toBe('zh-CN');
    } finally {
      userAgent.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it('opens the tab the Settings window asked for once loading finishes', () => {
    document.body.innerHTML = `<div id="generalSettingsModal"><div class="llm-provider-tabs">
      <button class="tab-button" data-tab="appearance"></button><button class="tab-button" data-tab="visualization"></button></div>
      <div id="appearance-tab" class="tab-content"></div><div id="visualization-tab" class="tab-content"></div></div>`;
    const instance = manager();
    instance.pendingTab = 'visualization';
    instance.initializeTabs();
    expect(document.getElementById('visualization-tab').classList.contains('active')).toBe(true);
    expect(instance.currentTab).toBe('visualization');
    expect(instance.pendingTab).toBeNull();
  });
});

describe('early readers wait for stored preferences', () => {
  it('MCPServerManager does not overwrite saved servers before the config loads', async () => {
    const MCPServerManager = runInNewContext(`${read('src/renderer/modules/MCPServerManager.js')}\nMCPServerManager`, {
      window: {},
      console: { log() {}, warn() {}, error() {} },
      setTimeout,
      Promise,
    });

    let resolveInit;
    const stored = { custom: { id: 'custom', name: 'Mine', url: 'http://x', enabled: false } };
    const config = {};
    const configManager = {
      isInitialized: false,
      waitForInit: () => new Promise(resolve => (resolveInit = resolve)),
      get: (key, fallback) => (key in config ? config[key] : fallback),
      set: vi.fn(),
    };

    const serverManager = new MCPServerManager(configManager);
    expect(configManager.set).not.toHaveBeenCalled();

    config.mcpServers = stored;
    configManager.isInitialized = true;
    resolveInit();
    await serverManager.configReady;

    expect(serverManager.servers.has('custom')).toBe(true);
    expect(serverManager.servers.has('deep-gene-research')).toBe(true);
  });
});

describe('Literature settings', () => {
  it('move from localStorage into ConfigManager once it has loaded', async () => {
    localStorage.setItem('genomeBrowser_literatureSettings', JSON.stringify({ pageSize: 20 }));
    const { default: LiteratureSettings } = await import('../../src/renderer/modules/LiteratureSettings.js');
    const values = {};
    window.genomeBrowser = {
      configManager: {
        isInitialized: true,
        get: (key, fallback) => (key in values ? values[key] : fallback),
        set: (key, value) => {
          values[key] = value;
        },
        saveConfig: vi.fn(),
      },
    };

    const literature = new LiteratureSettings();
    expect(literature.getPageSize()).toBe(20);
    expect(values.literature).toEqual({ pageSize: 20 });
    expect(localStorage.getItem('genomeBrowser_literatureSettings')).toBeNull();

    literature.setPageSize(30);
    expect(values.literature).toEqual({ pageSize: 30 });
    delete window.genomeBrowser;
  });

  it('opens the Settings window instead of its own overlay', async () => {
    const { default: LiteratureSettings } = await import('../../src/renderer/modules/LiteratureSettings.js');
    window.settingsCenter = { open: vi.fn(() => true) };
    new LiteratureSettings().showModal();
    expect(window.settingsCenter.open).toHaveBeenCalledWith('ai.literature');
    expect(document.getElementById('literatureSettingsModal')).toBeNull();
    delete window.settingsCenter;
  });
});
