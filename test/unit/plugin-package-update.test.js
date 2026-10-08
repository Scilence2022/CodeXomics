// @vitest-environment node
import { afterEach, describe, it, expect, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { loadScript } from '../helpers/load-script';
const require = createRequire(import.meta.url);
const { installPackage, backupPackage, restorePackage } = require('../../src/main/plugin-package-store');
const temporary = [];
afterEach(async () => {
  for (const dir of temporary.splice(0)) await fs.rm(dir, { recursive: true, force: true });
});
const pkg = (installPath, version, code) => ({
  pluginId: 'sample',
  installPath,
  manifest: { id: 'sample', version },
  data: { 'index.js': code },
});
describe('durable plugin updates', () => {
  it('detaches a registered plugin for replacement without deleting files or emitting uninstall', async () => {
    const Manager = require('../../src/renderer/modules/PluginManagerV2');
    const deletion = vi.fn();
    globalThis.window = { electronAPI: { deletePluginFiles: deletion } };
    const manager = Object.assign(Object.create(Manager.prototype), {
      pluginRegistry: { function: new Map([['sample', { type: 'function' }]]) },
      pathResolver: { getInstallPath: () => '/sample' },
      extensionContexts: new Map(),
      pluginMetadata: new Map(),
      pluginExecutors: new Map(),
      metrics: { pluginUsageStats: new Map() },
      emitEvent: vi.fn(),
    });
    try {
      await manager.uninstallPlugin('sample', { keepFiles: true, notify: false });
      expect(deletion).not.toHaveBeenCalled();
      expect(manager.emitEvent).not.toHaveBeenCalled();
      expect(manager.getPlugin('sample')).toBeNull();
    } finally {
      delete globalThis.window;
    }
  });
  it('replaces actual files and restores full backups without stale files', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cx-update-'));
    temporary.push(root);
    const target = path.join(root, 'sample');
    const backups = path.join(root, 'backups');
    await installPackage(pkg(target, '1.0.0', 'old source'));
    await fs.writeFile(path.join(target, 'old-only.txt'), 'old');
    const snapshot = await backupPackage(target, backups, 'sample', '1.0.0');
    await installPackage(pkg(target, '2.0.0', 'new source'));
    expect(await fs.readFile(path.join(target, 'index.js'), 'utf8')).toBe('new source');
    await expect(fs.access(path.join(target, 'old-only.txt'))).rejects.toThrow();
    await restorePackage(target, backups, 'sample', snapshot.snapshotId);
    expect(await fs.readFile(path.join(target, 'index.js'), 'utf8')).toBe('old source');
    expect(await fs.readFile(path.join(target, 'old-only.txt'), 'utf8')).toBe('old');
    expect(JSON.parse(await fs.readFile(path.join(target, 'plugin.json'), 'utf8')).version).toBe('1.0.0');
    await expect(restorePackage(target, backups, 'other', snapshot.snapshotId)).rejects.toThrow('identity');
  });
  it('leaves installed bytes intact when package inspection fails', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cx-update-'));
    temporary.push(root);
    const target = path.join(root, 'sample');
    await installPackage(pkg(target, '1.0.0', 'old'));
    await expect(installPackage({ ...pkg(target, '2.0.0', 'new'), data: [1, 2, 3] })).rejects.toThrow();
    expect(await fs.readFile(path.join(target, 'index.js'), 'utf8')).toBe('old');
  });
  it('requires actual install completion and preserves fromVersion', async () => {
    const { exported: Updates, sandbox } = loadScript('src/renderer/modules/PluginUpdateManager.js');
    const old = { id: 'sample', version: '1.0.0' };
    const marketplace = {
      installedPlugins: new Map([['sample', old]]),
      emitEvent: vi.fn(),
      installPlugin: vi.fn(async (id, options) => {
        expect(options.requireDisk).toBe(true);
        old.version = '2.0.0';
        return { success: true, results: [{ success: true }] };
      }),
    };
    const manager = Object.assign(Object.create(Updates.prototype), {
      marketplace,
      stats: { totalUpdates: 0, manualUpdates: 0 },
      createRollbackPoint: vi.fn(),
      recordUpdateHistory: vi.fn(),
      checkPluginUpdate: async () => ({
        hasUpdate: true,
        latestVersion: '2.0.0',
        plugin: { id: 'sample', version: '2.0.0' },
      }),
    });
    sandbox.window.electronAPI = {};
    const result = await manager.updatePlugin('sample');
    expect(result.fromVersion).toBe('1.0.0');
    expect(manager.recordUpdateHistory).toHaveBeenCalledWith(
      'sample',
      expect.objectContaining({ fromVersion: '1.0.0' })
    );
    expect(manager.isSecurityUpdate({})).toBe(false);
    expect(manager.isSecurityUpdate({ securityUpdate: true })).toBe(true);
  });
  it('fails when installation fails and attempts actual rollback', async () => {
    const { exported: Updates } = loadScript('src/renderer/modules/PluginUpdateManager.js');
    const manager = Object.assign(Object.create(Updates.prototype), {
      marketplace: {
        installedPlugins: new Map([['sample', { version: '1.0.0' }]]),
        installPlugin: async () => {
          throw new Error('disk failed');
        },
      },
      stats: { failedUpdates: 0 },
      createRollbackPoint: vi.fn(),
      rollbackPlugin: vi.fn(),
      checkPluginUpdate: async () => ({ hasUpdate: true, latestVersion: '2.0.0', plugin: {} }),
    });
    await expect(manager.updatePlugin('sample')).rejects.toThrow('disk failed');
    expect(manager.rollbackPlugin).toHaveBeenCalledWith('sample');
  });
});
