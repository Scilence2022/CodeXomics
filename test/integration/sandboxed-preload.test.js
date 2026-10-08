import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { registerPluginVersionIpc } = require('../../src/main/plugin-version-ipc');

function loadSandboxedPreload() {
  const exposed = {};
  const listeners = new Map();
  registerPluginVersionIpc({ on: (channel, listener) => listeners.set(channel, listener) });
  const ipcRenderer = {
    on: vi.fn(),
    sendSync: (channel, ...args) => {
      const event = {};
      listeners.get(channel)(event, ...args);
      return event.returnValue;
    },
  };
  vm.runInNewContext(fs.readFileSync('src/preload.js', 'utf8'), {
    require: name => {
      if (name !== 'electron') throw new Error(`module not found: ${name}`);
      return { ipcRenderer, contextBridge: { exposeInMainWorld: (key, value) => (exposed[key] = value) } };
    },
    process: { platform: 'darwin', arch: 'arm64', version: 'v22.0.0', argv: [] },
    console: { log: vi.fn(), warn: vi.fn() },
  });
  return { exposed, ipcRenderer };
}

describe('sandboxed preload startup', () => {
  it('finishes exposing menu and file APIs with only Electron available to require', () => {
    const { exposed } = loadSandboxedPreload();
    expect(typeof exposed.ipcRenderer.on).toBe('function');
    expect(typeof exposed.electronAPI.showOpenFileDialog).toBe('function');
    expect(typeof exposed.electronAPI.projectManagerAction).toBe('function');
    expect(exposed.require('electron').ipcRenderer).toBe(exposed.ipcRenderer);
    expect(() => exposed.require('semver')).toThrow('Blocked renderer require');
    expect(exposed.ipcRenderer.sendSync).toBeUndefined();
  });

  it('preserves synchronous semver behavior through the sandbox bridge', () => {
    const { pluginVersions } = loadSandboxedPreload().exposed.nodeAPI;
    expect(pluginVersions.compare('1.0.0-beta.1', '1.0.0')).toBe(-1);
    expect(pluginVersions.validRange('^0.2.3')).toBe('>=0.2.3 <0.3.0-0');
    expect(pluginVersions.validRange('invalid')).toBeNull();
    expect(pluginVersions.satisfies('0.2.4', '^0.2.3')).toBe(true);
    expect(pluginVersions.satisfies('0.3.0', '^0.2.3')).toBe(false);
    expect(() => pluginVersions.compare('invalid', '1.0.0')).toThrow('Invalid Version');
  });

  it.each([
    ['__proto__', []],
    ['readFile', ['/etc/passwd']],
    ['compare', ['1.0.0']],
    ['validRange', [null]],
    ['validRange', ['*'.repeat(4097)]],
  ])('rejects invalid operation %s without escaping the bridge', (operation, args) => {
    const { ipcRenderer } = loadSandboxedPreload();
    expect(ipcRenderer.sendSync('plugin-version-operation', operation, args)).toEqual({
      success: false,
      error: 'Invalid plugin version operation',
    });
  });
});
