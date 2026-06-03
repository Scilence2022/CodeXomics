import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(import.meta.url);
const securityUtils = require('../../src/main/security-utils.js');

function createMockApp(rootDir) {
  const paths = {
    userData: path.join(rootDir, 'userData'),
    temp: path.join(rootDir, 'temp'),
    downloads: path.join(rootDir, 'downloads'),
    documents: path.join(rootDir, 'documents'),
  };

  Object.values(paths).forEach(dir => fs.mkdirSync(dir, { recursive: true }));

  return {
    getPath(name) {
      if (!paths[name]) {
        throw new Error(`Unknown path: ${name}`);
      }
      return paths[name];
    },
    getAppPath() {
      return rootDir;
    },
  };
}

describe('security-utils', () => {
  let rootDir;
  let app;

  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codexomics-security-'));
    app = createMockApp(rootDir);
    securityUtils.approvedFilePaths.clear();
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
    securityUtils.approvedFilePaths.clear();
  });

  it('forces secure BrowserWindow preferences even when unsafe overrides are passed', () => {
    const prefs = securityUtils.createSecureWebPreferences({
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      allowRunningInsecureContent: true,
      sandbox: false,
    });

    expect(prefs.nodeIntegration).toBe(false);
    expect(prefs.contextIsolation).toBe(true);
    expect(prefs.webSecurity).toBe(true);
    expect(prefs.allowRunningInsecureContent).toBe(false);
    expect(prefs.enableRemoteModule).toBe(false);
    expect(prefs.sandbox).toBe(true);
    expect(prefs.preload).toContain(path.join('src', 'preload.js'));
  });

  it('allows file access inside Electron application data roots only', () => {
    const allowedPath = path.join(app.getPath('documents'), 'project', 'Project.GAI');
    const blockedPath = path.join(rootDir, 'outside', 'secret.txt');

    expect(securityUtils.assertAllowedFileAccess(app, allowedPath)).toBe(path.resolve(allowedPath));
    expect(() => securityUtils.assertAllowedFileAccess(app, blockedPath)).toThrow(/Blocked access/);
  });

  it('treats dialog-approved directories as scoped roots', () => {
    const approvedDir = path.join(rootDir, 'approved-project');
    const approvedChild = path.join(approvedDir, 'genomes', 'sample.fasta');
    securityUtils.rememberApprovedDialogPaths({
      canceled: false,
      filePaths: [approvedDir],
    });

    expect(securityUtils.assertAllowedFileAccess(app, approvedChild)).toBe(path.resolve(approvedChild));
  });

  it('rejects unsafe plugin ids and plugin paths outside user plugin roots', () => {
    expect(securityUtils.sanitizePluginId('safe.plugin-1')).toBe('safe.plugin-1');
    expect(() => securityUtils.sanitizePluginId('../escape')).toThrow(/Invalid plugin id/);

    const pluginPath = path.join(app.getPath('userData'), 'plugins', 'demo', 'index.js');
    const blockedPath = path.join(rootDir, 'not-plugins', 'demo', 'index.js');

    expect(securityUtils.assertPluginPath(app, pluginPath)).toBe(path.resolve(pluginPath));
    expect(() => securityUtils.assertPluginPath(app, blockedPath)).toThrow(/escapes user plugin directory/);
  });

  it('rejects archive entries that escape the extraction root', () => {
    expect(securityUtils.assertSafeArchiveEntry('plugin/index.js')).toBe('plugin/index.js');
    expect(() => securityUtils.assertSafeArchiveEntry('../index.js')).toThrow(/Unsafe archive entry/);
    expect(() => securityUtils.assertSafeArchiveEntry('/tmp/index.js')).toThrow(/Unsafe archive entry/);
  });

  it('extracts zip entries only under the plugin install directory', () => {
    const installPath = path.join(app.getPath('userData'), 'plugins', 'demo');
    const zip = {
      getEntries() {
        return [
          {
            entryName: 'plugin.json',
            isDirectory: false,
            getData: () => Buffer.from('{"id":"demo"}'),
          },
          {
            entryName: 'nested/',
            isDirectory: true,
            getData: () => Buffer.alloc(0),
          },
        ];
      },
    };

    securityUtils.safeExtractAdmZip(app, zip, installPath);

    expect(fs.existsSync(path.join(installPath, 'plugin.json'))).toBe(true);
    expect(fs.existsSync(path.join(installPath, 'nested'))).toBe(true);
  });
});
