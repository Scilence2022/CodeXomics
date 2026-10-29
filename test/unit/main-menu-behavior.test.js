import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const source = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

function harness(platform = 'darwin', savedProjects = {}) {
  let applicationMenu;
  const menus = {
    buildFromTemplate: templates => {
      const items = templates.map(item => ({
        ...item,
        ...(item.submenu ? { submenu: menus.buildFromTemplate(item.submenu) } : {}),
      }));
      return {
        items,
        getMenuItemById: id => flatten(items).find(item => item.id === id),
        clear: () => items.splice(0),
        append: item => items.push(item),
      };
    },
    setApplicationMenu: menu => {
      applicationMenu = menu;
    },
    getApplicationMenu: () => applicationMenu,
  };
  const contents = {
    isDestroyed: () => false,
    reload: vi.fn(),
    reloadIgnoringCache: vi.fn(),
    setZoomLevel: vi.fn(),
    getZoomLevel: () => 1,
    paste: vi.fn(),
    send: vi.fn(),
  };
  const handle = { windowId: 'genome-2', webContents: contents, isDestroyed: () => false };
  const host = { isDestroyed: () => false, webContents: { reload: vi.fn() } };
  const dialog = {
    showOpenDialog: vi.fn(async () => ({ canceled: true, filePaths: [] })),
    showMessageBox: vi.fn(async () => ({ response: 0 })),
  };
  const shell = { openExternal: vi.fn() };
  const send = vi.fn();
  const dispatch = vi.fn(async () => ({ success: true }));
  const dependencies = {
    APP_NAME: 'CodeXomics',
    VERSION_INFO: { appTitle: 'CodeXomics v0.722' },
    mainWindow: handle,
    currentActiveWindow: handle,
    getCurrentMainWindow: () => handle,
    sendToCurrentMainWindow: send,
  };
  for (const name of [
    'createWindow',
    'createProjectManagerWindow',
    'createCircosWindow',
    'createKEGGWindow',
    'createGOWindow',
    'createInterProWindow',
    'createDeepGeneResearchWindow',
    'createChopchopWindow',
    'createProGenFixerWindow',
    'createBlastDownloaderWindow',
    'createBlastConfigWindow',
    'createMCPServerManagerWindow',
    'arrangeWindowsOptimal',
    'arrangeWindowsSideBySide',
    'arrangeMainWindowFocus',
    'arrangeProjectManagerFocus',
    'arrangeWindowsVertical',
    'arrangeWindowsCascade',
    'resetWindowPositions',
    'closeWindowTab',
  ]) {
    dependencies[name] = vi.fn();
  }
  const context = {
    module: { exports: {} },
    process: { platform },
    console,
    setTimeout,
    clearTimeout,
    require: name => {
      if (name === 'electron') {
        return {
          Menu: menus,
          MenuItem: function (options) {
            return options;
          },
          dialog,
          shell,
          app: { quit: vi.fn(), getPath: () => '/tmp/menu-audit' },
          BrowserWindow: { getFocusedWindow: () => host },
        };
      }
      if (name === 'fs') return { promises: { readFile: async () => JSON.stringify(savedProjects) } };
      if (name === './security-utils') return { rememberApprovedDialogPaths: vi.fn() };
      if (name === './project-manager-dispatch') return { dispatchProjectManagerAction: dispatch };
      if (name === './updater') return { checkForUpdates: vi.fn() };
      if (name === './workspace-host-manager') {
        return {
          getActiveWindowIdForHost: win => (win === host ? handle.windowId : null),
          getViewHandle: () => handle,
          getNativeWindow: () => host,
          toggleDevToolsForHost: () => ({ handled: true }),
        };
      }
      return require(name);
    },
  };
  vm.runInNewContext(source('src/main/menu-builder.js'), context);
  const builder = context.module.exports;
  builder.setMenuDependencies(dependencies);
  builder.createMenu();
  return {
    builder,
    menus,
    send,
    dispatch,
    dialog,
    shell,
    contents,
    host,
    dependencies,
    items: () => flatten(applicationMenu.items),
    find: label => flatten(applicationMenu.items).find(item => item.label === label),
  };
}

function flatten(items) {
  return items.flatMap(item => [item, ...flatten(item.submenu?.items || item.submenu || [])]);
}

for (const platform of ['darwin', 'win32', 'linux']) {
  describe(`Main menu behavior (${platform})`, () => {
    it('has unique accelerators, including native role shortcuts', () => {
      const h = harness(platform);
      const seen = new Map();
      for (const item of h.items().filter(item => item.enabled !== false && item.accelerator)) {
        const key = item.accelerator
          .toLowerCase()
          .replace('cmdorctrl', platform === 'darwin' ? 'cmd' : 'ctrl')
          .replace('command', 'cmd')
          .split('+')
          .sort()
          .join('+');
        expect(seen.get(key), `${item.label} conflicts with ${seen.get(key)}`).toBeUndefined();
        seen.set(key, item.label);
      }
    });

    it('dispatches every enabled leaf without missing dependencies or blocked IPC channels', async () => {
      const h = harness(platform);
      const preload = source('src/preload.js');
      const channels = new Set(
        [
          ...preload
            .slice(preload.indexOf('const allowedListenChannels'), preload.indexOf('const allowedSendChannels'))
            .matchAll(/'([^']+)'/g),
        ].map(match => match[1])
      );
      const renderer = source('src/renderer/renderer-modular.js');
      const items = h.items().filter(item => item.click && item.enabled !== false);
      expect(items.length).toBeGreaterThan(75);
      for (const item of items) {
        await item.click();
        for (const [channel] of h.send.mock.calls) {
          expect(channels.has(channel), `${item.label}: ${channel} blocked in preload`).toBe(true);
          expect(renderer, `${item.label}: ${channel} has no receiver`).toContain(`ipcRenderer.on('${channel}'`);
        }
        h.send.mockClear();
      }
    });

    it('runs view commands on the selected genome view instead of the host page', async () => {
      const h = harness(platform);
      for (const label of ['Reload', 'Force Reload', 'Zoom In', 'Zoom Out', 'Actual Size']) await h.find(label).click();
      expect(h.contents.reload).toHaveBeenCalledOnce();
      expect(h.contents.reloadIgnoringCache).toHaveBeenCalledOnce();
      expect(h.contents.setZoomLevel.mock.calls).toEqual([[1.5], [0.5], [0]]);
      expect(h.host.webContents.reload).not.toHaveBeenCalled();
    });

    it('opens About and User Guide with functioning main-process actions', async () => {
      const h = harness(platform);
      await h.find('About CodeXomics').click();
      await h.find('User Guide').click();
      expect(h.dialog.showMessageBox).toHaveBeenCalledWith(expect.objectContaining({ message: 'CodeXomics v0.722' }));
      expect(h.shell.openExternal).toHaveBeenCalledWith(expect.stringContaining('/user-guides/GETTING_STARTED/'));
    });

    it('keeps recent projects across menu rebuilds and auxiliary-window menus', async () => {
      const h = harness(platform);
      h.menus.setApplicationMenu({ getMenuItemById: () => undefined });
      const project = { name: 'A & B', filePath: '/tmp/project.prj.GAI' };
      h.builder.updateRecentProjectsMenu([project]);
      h.builder.createMenu();
      const item = h.find('A && B');
      expect(item).toBeDefined();
      await item.click();
      expect(h.send).toHaveBeenCalledWith('open-recent-project', project);
      h.builder.updateRecentProjectsMenu([]);
      expect(h.find('No recent projects').enabled).toBe(false);
    });

    it('restores saved recent projects with legacy project paths on startup', async () => {
      const h = harness(platform, {
        recentProjects: ['p1'],
        projects: {
          p1: {
            name: 'Stored project',
            xmlFilePath: '/tmp/stored.prj.GAI',
          },
        },
      });
      await h.builder.loadRecentProjectsMenu();
      h.builder.createMenu();
      await h.find('Stored project').click();
      expect(h.send).toHaveBeenCalledWith(
        'open-recent-project',
        expect.objectContaining({ filePath: '/tmp/stored.prj.GAI' })
      );
    });

    it('handles cancellation and reports file-dialog errors without opening a window', async () => {
      const h = harness(platform);
      await h.find('Open (New Window)').click();
      expect(h.dependencies.createWindow).not.toHaveBeenCalled();
      h.dialog.showOpenDialog.mockRejectedValueOnce(new Error('Dialog failed'));
      const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        await h.find('Open File').click();
        expect(h.dialog.showMessageBox).toHaveBeenCalledWith(expect.objectContaining({ message: 'Dialog failed' }));
        expect(h.send).not.toHaveBeenCalled();
      } finally {
        errorLog.mockRestore();
      }
    });

    it('offers supported genome formats consistently in both Open menus', async () => {
      const h = harness(platform);
      await h.find('Open File').click();
      await h.find('Open (New Window)').click();
      const options = h.dialog.showOpenDialog.mock.calls.map(call => call[1]);
      expect(options[0].filters).toEqual(options[1].filters);
      expect(options[0].filters[0].extensions).toEqual(expect.arrayContaining(['gff3', 'gbff', 'fna', 'bw', 'wig']));
    });

    it('routes project creation and loading through the readiness-aware dispatcher', async () => {
      const h = harness(platform);
      await h.find('New Project').click();
      expect(h.dispatch).toHaveBeenCalledWith(h.dependencies.createProjectManagerWindow, {
        action: 'createNewProject',
        filePath: undefined,
      });
      h.dialog.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: ['/tmp/a.prj.GAI'] });
      await h.find('Open Project').click();
      expect(h.dispatch).toHaveBeenCalledWith(h.dependencies.createProjectManagerWindow, {
        action: 'loadProjectFromFile',
        filePath: '/tmp/a.prj.GAI',
      });
    });
  });
}

describe('Project menu readiness', () => {
  it('delivers new-project requests only after a slow window has loaded', async () => {
    const { dispatchProjectManagerAction } = require('../../src/main/project-manager-dispatch');
    const contents = Object.assign(new EventEmitter(), { isLoading: () => true, send: vi.fn() });
    const pending = dispatchProjectManagerAction(() => ({ webContents: contents }), { action: 'createNewProject' });
    expect(contents.send).not.toHaveBeenCalled();
    contents.emit('did-finish-load');
    await pending;
    expect(contents.send).toHaveBeenCalledWith('project-manager-action', {
      action: 'createNewProject',
      filePath: undefined,
    });
    expect(contents.listenerCount('did-fail-load')).toBe(0);
  });
});

describe('Main-menu renderer routes', () => {
  const routes = [
    ['menu-load-genome', 'fileManager', 'openSpecificFileType', ['genome']],
    ['menu-load-annotation-merge', 'fileManager', 'openSpecificFileType', ['annotation', { mergeWithExisting: true }]],
    ['menu-load-annotation-new', 'fileManager', 'openSpecificFileType', ['annotation', { mergeWithExisting: false }]],
    ['menu-load-variant', 'fileManager', 'openSpecificFileType', ['variant']],
    ['menu-load-reads', 'fileManager', 'openSpecificFileType', ['reads']],
    ['menu-load-wig', 'fileManager', 'openSpecificFileType', ['tracks']],
    ['menu-load-operon', 'fileManager', 'openSpecificFileType', ['operon']],
    ['menu-load-blast', 'fileManager', 'openSpecificFileType', ['blast']],
    ['menu-load-any', 'fileManager', 'openSpecificFileType', ['any']],
    ['menu-export-fasta', 'exportManager', 'exportAsFasta', []],
    ['menu-export-genbank', 'exportManager', 'exportAsGenBank', []],
    ['menu-export-cds', 'exportManager', 'exportCDSAsFasta', []],
    ['menu-export-protein', 'exportManager', 'exportProteinAsFasta', []],
    ['menu-export-gff', 'exportManager', 'exportAsGFF', []],
    ['menu-export-bed', 'exportManager', 'exportAsBED', []],
    ['menu-export-current-view', 'exportManager', 'exportCurrentViewAsFasta', []],
    ['menu-export-configure', 'exportManager', 'showExportConfigDialog', []],
    ['menu-capture-full-screenshot', 'screenshotManager', 'captureFullApplicationScreenshot', []],
    ['menu-capture-tracks-screenshot', 'screenshotManager', 'captureTracksScreenshot', []],
    ['show-search', 'navigationManager', 'showSearchModal', []],
    ['show-goto', 'navigationManager', 'showGotoModal', []],
    ['configure-search', 'navigationManager', 'showSearchSettingsModal', []],
    ['show-panel', 'uiManager', 'showPanel', ['featuresSection']],
    ['action-copy-sequence', 'actionManager', 'handleCopySequence', []],
    ['action-cut-sequence', 'actionManager', 'handleCutSequence', []],
    ['action-paste-sequence', 'actionManager', 'handlePasteSequence', []],
    ['action-paste-sequence-reverse', 'actionManager', 'handlePasteSequence', [true]],
    ['action-delete-sequence', 'actionManager', 'handleDeleteSequence', []],
    ['action-insert-sequence', 'actionManager', 'handleInsertSequence', []],
    ['action-insert-sequence-reverse', 'actionManager', 'handleInsertSequence', [true]],
    ['show-action-list', 'actionManager', 'showActionList', []],
    ['execute-all-actions', 'actionManager', 'executeAllActions', []],
    ['create-checkpoint', 'checkpointManager', 'createManualCheckpoint', []],
    ['rollback-checkpoint', 'checkpointManager', 'showCheckpointList', []],
  ];
  it.each(routes)('%s reaches the implemented %s.%s method', (channel, service, method, args) => {
    const renderer = source('src/renderer/renderer-modular.js');
    const listeners = new Map();
    const context = {
      window: { addEventListener: vi.fn() },
      console,
      ipcRenderer: { on: (name, callback) => listeners.set(name, callback) },
    };
    vm.runInNewContext(
      renderer.slice(
        renderer.indexOf('class GenomeBrowser {'),
        renderer.indexOf('// Initialize the CodeXomics when the page loads')
      ) + '\nglobalThis.Browser = GenomeBrowser;',
      context
    );
    const browser = Object.create(context.Browser.prototype);
    const className = service === 'uiManager' ? 'UIManager' : service[0].toUpperCase() + service.slice(1);
    const implementation = { window: {}, module: { exports: {} }, console };
    vm.runInNewContext(
      source(`src/renderer/modules/${className}.js`) + `\nglobalThis.Service = ${className};`,
      implementation
    );
    expect(typeof implementation.Service.prototype[method]).toBe('function');
    const callback = vi.fn();
    browser[service] = { [method]: callback };
    context.window[service] = browser[service];
    browser.setupIPC();
    const payload = channel === 'show-panel' ? args : [];
    listeners.get(channel)({}, ...payload);
    expect(callback).toHaveBeenCalledWith(...args);
  });
});
