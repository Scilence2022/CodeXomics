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
    fs.mkdirSync(path.dirname(approvedChild), { recursive: true });
    fs.writeFileSync(approvedChild, '>sample\nATGC\n');
    securityUtils.rememberApprovedDialogPaths({
      canceled: false,
      filePaths: [approvedDir],
    });

    expect(securityUtils.assertAllowedFileAccess(app, approvedChild)).toBe(path.resolve(approvedChild));
  });

  it('treats dialog-approved files as exact file grants, not parent directory grants', () => {
    const selectedFile = path.join(rootDir, 'outside', 'selected.gbk');
    const siblingFile = path.join(rootDir, 'outside', 'sibling.gbk');
    fs.mkdirSync(path.dirname(selectedFile), { recursive: true });
    fs.writeFileSync(selectedFile, 'LOCUS       demo\n');
    fs.writeFileSync(siblingFile, 'LOCUS       sibling\n');

    securityUtils.rememberApprovedDialogPaths({
      canceled: false,
      filePaths: [selectedFile],
    });

    expect(
      securityUtils.assertAllowedFileAccess(app, selectedFile, {
        operation: 'read file',
        mustExist: true,
      })
    ).toBe(path.resolve(selectedFile));
    expect(
      securityUtils.assertAllowedFileAccess(app, selectedFile, {
        operation: 'write file',
      })
    ).toBe(path.resolve(selectedFile));
    expect(() =>
      securityUtils.assertAllowedFileAccess(app, siblingFile, {
        operation: 'read file',
        mustExist: true,
      })
    ).toThrow(/Blocked read file/);
  });

  it('grants write access to exact save-dialog paths outside default roots', () => {
    const savePath = path.join(rootDir, 'desktop-like', 'exported.gbk');
    const siblingPath = path.join(rootDir, 'desktop-like', 'other.gbk');

    securityUtils.rememberApprovedDialogPaths({
      canceled: false,
      filePath: savePath,
    });

    expect(
      securityUtils.assertAllowedFileAccess(app, savePath, {
        operation: 'write file',
      })
    ).toBe(path.resolve(savePath));
    expect(() =>
      securityUtils.assertAllowedFileAccess(app, siblingPath, {
        operation: 'write file',
      })
    ).toThrow(/Blocked write file/);
  });

  it('enforces granted capabilities when checking approved paths', () => {
    const executablePath = path.join(rootDir, 'tools', 'blastn');
    fs.mkdirSync(path.dirname(executablePath), { recursive: true });
    fs.writeFileSync(executablePath, '#!/bin/sh\n');

    securityUtils.permissionBroker.grantPath(executablePath, {
      source: 'test',
      capabilities: [securityUtils.FILE_CAPABILITIES.READ],
      recursive: false,
    });

    expect(
      securityUtils.assertAllowedFileAccess(app, executablePath, {
        operation: 'read file',
      })
    ).toBe(path.resolve(executablePath));
    expect(() =>
      securityUtils.assertAllowedFileAccess(app, executablePath, {
        operation: 'execute configured BLAST binary',
      })
    ).toThrow(/Blocked execute configured BLAST binary/);
  });

  it('grants explicit file loads exact-path read access only', () => {
    const loadPath = path.join(rootDir, 'external-data', 'genome.fasta');
    const siblingPath = path.join(rootDir, 'external-data', 'private.txt');
    fs.mkdirSync(path.dirname(loadPath), { recursive: true });
    fs.writeFileSync(loadPath, '>sample\nATGC\n');
    fs.writeFileSync(siblingPath, 'private');

    expect(securityUtils.grantReadOnlyFileLoadPath(loadPath)).toBe(path.resolve(loadPath));
    expect(
      securityUtils.assertAllowedFileAccess(app, loadPath, {
        operation: 'read file',
        mustExist: true,
      })
    ).toBe(path.resolve(loadPath));
    expect(() =>
      securityUtils.assertAllowedFileAccess(app, loadPath, {
        operation: 'write file',
      })
    ).toThrow(/Blocked write file/);
    expect(() =>
      securityUtils.assertAllowedFileAccess(app, siblingPath, {
        operation: 'read file',
        mustExist: true,
      })
    ).toThrow(/Blocked read file/);
  });

  it('rejects directories and missing paths as file-load grants', () => {
    const directoryPath = path.join(rootDir, 'external-data');
    fs.mkdirSync(directoryPath, { recursive: true });

    expect(() => securityUtils.grantReadOnlyFileLoadPath(directoryPath)).toThrow(/regular file/);
    expect(() => securityUtils.grantReadOnlyFileLoadPath(path.join(directoryPath, 'missing.fa'))).toThrow(
      /File does not exist/
    );
  });

  it('clears PermissionBroker grants when the legacy approved path set is cleared', () => {
    const approvedDir = path.join(rootDir, 'approved-to-clear');
    const child = path.join(approvedDir, 'child.txt');
    fs.mkdirSync(approvedDir, { recursive: true });
    fs.writeFileSync(child, 'demo');

    securityUtils.rememberApprovedPath(approvedDir);
    expect(securityUtils.assertAllowedFileAccess(app, child, { operation: 'read file' })).toBe(path.resolve(child));

    securityUtils.approvedFilePaths.clear();
    expect(() => securityUtils.assertAllowedFileAccess(app, child, { operation: 'read file' })).toThrow(
      /Blocked read file/
    );
  });

  it('rejects unsafe plugin ids and plugin paths outside user plugin roots', () => {
    expect(securityUtils.sanitizePluginId('safe.plugin-1')).toBe('safe.plugin-1');
    expect(() => securityUtils.sanitizePluginId('../escape')).toThrow(/Invalid plugin id/);

    const pluginPath = path.join(app.getPath('userData'), 'plugins', 'demo', 'index.js');
    const blockedPath = path.join(rootDir, 'not-plugins', 'demo', 'index.js');

    expect(securityUtils.assertPluginPath(app, pluginPath)).toBe(path.resolve(pluginPath));
    expect(() => securityUtils.assertPluginPath(app, blockedPath)).toThrow(/escapes user plugin directory/);
  });

  it('permits the user-installed plugin directory only when plugin roots are added to allowedRoots', () => {
    const pluginRoots = securityUtils.getUserPluginRoots(app);
    const userInstalled = pluginRoots.find(root => root.endsWith(path.join('Plugins', 'UserInstalled')));
    expect(userInstalled).toBeDefined();

    // Default writable roots alone reject the source-tree plugin dir — this was the
    // ensure-directory regression that blocked plugin setup in dev mode.
    expect(() => securityUtils.assertAllowedFileAccess(app, userInstalled, { operation: 'create directory' })).toThrow(
      /Blocked create directory/
    );

    // The ensure-directory handler widens allowedRoots to include the plugin roots.
    const allowedRoots = [...securityUtils.getDefaultWritableRoots(app), ...pluginRoots];
    expect(
      securityUtils.assertAllowedFileAccess(app, userInstalled, { operation: 'create directory', allowedRoots })
    ).toBe(path.resolve(userInstalled));
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
