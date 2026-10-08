// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';
import { loadScript } from '../helpers/load-script';
const require = createRequire(import.meta.url);
const { inspectPluginPackage } = require('../../src/main/plugin-package-inspector');
const AdmZip = require('adm-zip');
const { exported: Validator } = loadScript('src/renderer/modules/PluginSecurityValidator.js');
const { exported: Marketplace, sandbox: marketplaceEnvironment } = loadScript(
  'src/renderer/modules/PluginMarketplace.js'
);
const manifest = { id: 'real-plugin', version: '1.0.0', permissions: [] };
function evidence(code, extra = {}) {
  return inspectPluginPackage({
    pluginId: manifest.id,
    version: manifest.version,
    manifest: { ...manifest, ...extra },
    data: { 'index.js': code },
  });
}
function plugin(contents) {
  return { id: manifest.id, version: manifest.version, source: { id: 'official' }, packageEvidence: contents };
}
describe('real plugin package inspection', () => {
  it('binds deterministic validation to actual code and reports actual file/line', async () => {
    const validator = new Validator();
    const safe = await validator.validatePlugin(plugin(evidence('console.log("safe");')));
    expect(safe.approved).toBe(true);
    const dangerous = await validator.validatePlugin(plugin(evidence('\n\neval("unsafe");')));
    expect(dangerous.approved).toBe(false);
    expect(dangerous.issues[0]).toMatchObject({ file: 'index.js', line: 3, severity: 'critical' });
    expect(dangerous.packageSha256).not.toBe(safe.packageSha256);
    expect(await validator.validatePlugin(plugin(evidence('\n\neval("unsafe");')))).toEqual(dangerous);
  });
  it('reads declared permissions instead of inventing them', async () => {
    const result = await new Validator().validatePlugin(
      plugin(evidence('console.log("safe")', { permissions: ['eval'] }))
    );
    expect(result.approved).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ permission: 'eval', type: 'dangerous_permission' }));
  });
  it('refuses metadata without actual package evidence', async () => {
    await expect(new Validator().validatePlugin({ id: 'real-plugin', version: '1.0.0' })).rejects.toThrow(
      'Inspected plugin package'
    );
  });
  it('inspects ZIP contents and rejects traversal or a different version', () => {
    const zip = new AdmZip();
    zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest)));
    zip.addFile('index.js', Buffer.from('eval("real-code")'));
    const contents = inspectPluginPackage({
      pluginId: manifest.id,
      version: manifest.version,
      data: Array.from(zip.toBuffer()),
    });
    expect(contents.files[0].content).toBe('eval("real-code")');
    expect(() =>
      inspectPluginPackage({ pluginId: manifest.id, version: '2.0.0', data: Array.from(zip.toBuffer()) })
    ).toThrow('identity/version');
    expect(() =>
      inspectPluginPackage({
        pluginId: manifest.id,
        version: manifest.version,
        manifest,
        data: { '../index.js': 'unsafe' },
      })
    ).toThrow('Unsafe');
  });
  it('changes the content digest when payload or manifest changes', () => {
    expect(evidence('one').sha256).not.toBe(evidence('two').sha256);
    expect(evidence('one').sha256).not.toBe(evidence('one', { permissions: ['fetch'] }).sha256);
  });
  it('downloads and validates the same package that the installation consumes', async () => {
    const marketplace = Object.create(Marketplace.prototype);
    const item = { id: manifest.id, version: manifest.version };
    const downloaded = {
      pluginId: item.id,
      version: item.version,
      manifest,
      data: { 'index.js': 'console.log("safe")' },
    };
    marketplace.options = { enableSecurityValidation: true };
    marketplace.installedPlugins = new Map();
    marketplace.stats = { totalInstalls: 0, failedInstalls: 0 };
    marketplace.findPlugin = vi.fn().mockResolvedValue(item);
    marketplace.dependencyResolver = { createInstallPlan: vi.fn().mockResolvedValue({ plugins: [item] }) };
    marketplace.downloadPlugin = vi.fn().mockResolvedValue(downloaded);
    marketplace.securityValidator = { validateInstallPlan: vi.fn().mockResolvedValue({ approved: true }) };
    marketplace.executeInstallPlan = vi.fn().mockResolvedValue([{ success: true }]);
    marketplace.emitEvent = vi.fn();
    // The real inspector executes behind the IPC boundary substitute.
    const inspector = vi.fn(async options => ({ success: true, evidence: inspectPluginPackage(options) }));
    const original = marketplaceEnvironment.window.electronAPI;
    marketplaceEnvironment.window.electronAPI = { inspectPluginPackage: inspector };
    try {
      await marketplace.installPlugin(item.id);
      expect(marketplace.downloadPlugin).toHaveBeenCalledTimes(1);
      expect(item.packageEvidence.files[0].content).toContain('safe');
      const downloads = marketplace.executeInstallPlan.mock.calls[0][1];
      expect(downloads.get(item.id)).toBe(downloaded);
      expect(downloaded.packageSha256).toBe(item.packageEvidence.sha256);
    } finally {
      marketplaceEnvironment.window.electronAPI = original;
    }
  });
});
