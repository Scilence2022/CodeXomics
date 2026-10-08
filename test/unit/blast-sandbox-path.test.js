import { describe, expect, it, vi } from 'vitest';
import { loadScript } from '../helpers/load-script';

function createManager(getAppPaths) {
  const { exported: BlastManager } = loadScript('src/renderer/modules/BlastManager.js', {
    window: {
      os: { homedir: () => '', platform: () => 'darwin' },
      electronAPI: { getAppPaths, blast: { runCommand: vi.fn() } },
    },
  });
  const manager = Object.create(BlastManager.prototype);
  manager.app = {};
  manager.config = { localDbPath: null };
  manager.enableLocalBlast = vi.fn();
  manager.checkBlastInstallation = vi.fn(async () => true);
  manager.loadLocalDatabases = vi.fn();
  return manager;
}

describe('local BLAST paths in sandboxed renderer', () => {
  it('resolves application data before detecting BLAST and listing databases', async () => {
    let resolvePaths;
    const manager = createManager(() => new Promise(resolve => (resolvePaths = resolve)));
    expect(manager.getPlatformDbPath()).toBeNull();
    const initialization = manager.initializeLocalBlast();
    expect(manager.checkBlastInstallation).not.toHaveBeenCalled();
    resolvePaths({ success: true, paths: { userData: '/Users/test/Library/Application Support/CodeXomics' } });
    await initialization;
    expect(manager.config.localDbPath).toBe('/Users/test/Library/Application Support/CodeXomics/blast/db');
    expect(manager.loadLocalDatabases).toHaveBeenCalledOnce();
    expect(manager.getCurrentDatabasePath()).toBe(manager.config.localDbPath);
  });

  it('keeps databases beside the loaded genome while retaining the application fallback', async () => {
    const manager = createManager(async () => ({ success: true, paths: { userData: '/app/data' } }));
    manager.app.loadedGenomePath = '/genomes/example.fasta';
    await manager.initializeLocalDatabasePath();
    expect(manager.config.localDbPath).toBe('/genomes/blast_db');
    manager.app.loadedGenomePath = null;
    expect(manager.getPlatformDbPath()).toBe('/app/data/blast/db');
  });

  it.each([
    { success: false, error: 'IPC unavailable' },
    { success: true, paths: {} },
  ])('does not issue BLAST commands against invented paths when path resolution fails', async result => {
    const manager = createManager(async () => result);
    await manager.initializeLocalBlast();
    expect(manager.checkBlastInstallation).not.toHaveBeenCalled();
    expect(manager.loadLocalDatabases).not.toHaveBeenCalled();
    expect(manager.config.localDbPath).toBeNull();
    expect(manager.enableLocalBlast).toHaveBeenCalledOnce();
  });
});
