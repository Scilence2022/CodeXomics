// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { EventEmitter } from 'events';
import { createRequire } from 'module';
import { loadScript } from '../helpers/load-script';
const require = createRequire(import.meta.url);
const AdmZip = require('adm-zip');
const { extractPluginArchive } = require('../../src/main/plugin-archive');
const { dispatchProjectManagerAction } = require('../../src/main/project-manager-dispatch');
const temporary = [];
afterEach(async () => {
  for (const dir of temporary.splice(0)) await fs.rm(dir, { recursive: true, force: true });
});
describe('project, archive and RPC capability contracts', () => {
  it('extracts actual nested plugin contents and returns the manifest directory', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cx-zip-'));
    temporary.push(root);
    const zip = new AdmZip();
    zip.addFile('sample/plugin.json', Buffer.from('{"id":"sample"}'));
    zip.addFile('sample/index.js', Buffer.from('actual source'));
    const filename = path.join(root, 'plugin.zip');
    await fs.writeFile(filename, zip.toBuffer());
    const result = await extractPluginArchive(filename, root);
    expect(await fs.readFile(path.join(result.extractPath, 'index.js'), 'utf8')).toBe('actual source');
  });
  it('rejects traversal archives before creating an extraction directory', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cx-zip-'));
    temporary.push(root);
    const zip = new AdmZip();
    zip.addFile('plugin.json', Buffer.from('{}'));
    zip.addFile('safe.js', Buffer.from('escape'));
    zip.getEntry('safe.js').entryName = '../evil.js';
    const filename = path.join(root, 'bad.zip');
    await fs.writeFile(filename, zip.toBuffer());
    await expect(extractPluginArchive(filename, root)).rejects.toThrow('Unsafe');
    expect(await fs.readdir(root)).toEqual(['bad.zip']);
  });
  it('waits for window loading before dispatching real project actions', async () => {
    const contents = new EventEmitter();
    contents.isLoading = () => true;
    contents.send = vi.fn();
    const request = dispatchProjectManagerAction(() => ({ webContents: contents }), {
      action: 'loadProjectFromFile',
      filePath: '/actual/project.prj',
    });
    expect(contents.send).not.toHaveBeenCalled();
    contents.emit('did-finish-load');
    expect(await request).toEqual({ success: true, action: 'requested' });
    expect(contents.send).toHaveBeenCalledWith('project-manager-action', {
      action: 'loadProjectFromFile',
      filePath: '/actual/project.prj',
    });
    expect(contents.listenerCount('did-fail-load')).toBe(0);
    await expect(dispatchProjectManagerAction(() => null, { action: 'invented' })).rejects.toThrow('Unsupported');
  });
  it('omits unsupported RPC methods and propagates inner operation failures', async () => {
    const ipc = { on: vi.fn(), send: vi.fn() };
    const { exported: RPC } = loadScript('src/renderer/modules/GenomeStudioRPCHandler.js', {
      window: { ipcRenderer: ipc },
    });
    const rpc = new RPC();
    expect(rpc.getAvailableMethods()).not.toContain('loadFile');
    await rpc.handleRPCCall({ requestId: 'unsupported', method: 'loadFile', parameters: {} });
    expect(ipc.send).toHaveBeenLastCalledWith(
      'genome-rpc-response',
      expect.objectContaining({ success: false, requestId: 'unsupported' })
    );
    rpc.executeMethod = async () => ({ success: false, message: 'actual failure' });
    await rpc.handleRPCCall({ requestId: 'failed', method: 'navigateToPosition', parameters: {} });
    expect(ipc.send).toHaveBeenLastCalledWith('genome-rpc-response', {
      requestId: 'failed',
      success: false,
      error: 'actual failure',
    });
  });
});
