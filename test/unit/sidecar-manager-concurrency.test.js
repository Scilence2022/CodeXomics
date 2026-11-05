/* eslint-disable no-new-func */
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const SIDECAR_PATH = path.join(process.cwd(), 'src/renderer/modules/SidecarManager.js');

function loadSidecarManager(electronAPI) {
  const mockWindow = {
    electronAPI,
    path: {
      dirname: value => path.dirname(value),
      basename: (value, extension) => path.basename(value, extension),
      extname: value => path.extname(value),
      join: (...parts) => path.join(...parts),
    },
  };
  new Function('window', fs.readFileSync(SIDECAR_PATH, 'utf8'))(mockWindow);
  return mockWindow.SidecarManager;
}

describe('SidecarManager write serialization', () => {
  it('waits for the current durable edit before saving an annotation ledger', async () => {
    const genomePath = '/tmp/serialized.gbk';
    let disk = { version: '1.0', geneNotes: {} };
    let writes = 0;
    let releaseFirstWrite;
    let markFirstWriteStarted;
    const firstWriteStarted = new Promise(resolve => {
      markFirstWriteStarted = resolve;
    });
    const firstWriteGate = new Promise(resolve => {
      releaseFirstWrite = resolve;
    });
    const electronAPI = {
      loadSidecarFile: async () => ({
        success: true,
        exists: true,
        data: JSON.parse(JSON.stringify(disk)),
      }),
      saveSidecarFile: async (_path, payload) => {
        writes += 1;
        const snapshot = JSON.parse(JSON.stringify(payload));
        if (writes === 1) {
          markFirstWriteStarted();
          await firstWriteGate;
        }
        disk = snapshot;
        return { success: true };
      },
    };
    const SidecarManager = loadSidecarManager(electronAPI);
    const manager = new SidecarManager();
    const firstSave = manager.set(genomePath, 'geneNotes', { old: true });
    await firstWriteStarted;
    const forcedSave = manager.setAndForceSave(genomePath, 'annotationCuration', { revision: 1 });
    releaseFirstWrite();
    await Promise.all([firstSave, forcedSave]);

    expect(writes).toBeGreaterThanOrEqual(2);
    expect(disk.geneNotes).toEqual({ old: true });
    expect(disk.annotationCuration).toEqual({ revision: 1 });
    expect(manager.cache.get(genomePath).annotationCuration).toEqual({ revision: 1 });
  });

  it('invalidates a stale verified cache after a main-process CAS conflict', async () => {
    const genomePath = '/tmp/conflict.gbk';
    const SidecarManager = loadSidecarManager({
      loadSidecarFile: async () => ({
        success: true,
        exists: true,
        data: { version: '1.0', _storageRevision: 2 },
      }),
      saveSidecarFile: async () => ({
        success: false,
        conflict: true,
        code: 'SIDECAR_CONFLICT',
        currentRevision: 3,
        error: 'stale sidecar revision',
      }),
    });
    const manager = new SidecarManager();
    await manager.load(genomePath, { strict: true });
    expect(manager.cacheProvenance.get(genomePath)).toBe('verified');

    await expect(manager.setAndForceSave(genomePath, 'annotationCuration', { revision: 1 })).rejects.toMatchObject({
      code: 'SIDECAR_CONFLICT',
    });
    expect(manager.cache.has(genomePath)).toBe(false);
    expect(manager.cacheProvenance.has(genomePath)).toBe(false);
  });

  it('rebases edits to another field but rejects stale edits to the same field', async () => {
    const genomePath = '/tmp/shared.gbk';
    let disk = { _storageRevision: 1, geneNotes: { old: true }, primers: [] };
    const SidecarManager = loadSidecarManager({
      loadSidecarFile: async () => ({ success: true, exists: true, data: structuredClone(disk) }),
      saveSidecarFile: async (_path, payload) => {
        if (payload._storageRevision !== disk._storageRevision) {
          return { success: false, code: 'SIDECAR_CONFLICT' };
        }
        disk = { ...structuredClone(payload), _storageRevision: disk._storageRevision + 1 };
        return { success: true, storageRevision: disk._storageRevision };
      },
    });
    const first = new SidecarManager();
    const second = new SidecarManager();
    await Promise.all([
      first.get(genomePath, 'geneNotes'),
      second.get(genomePath, 'geneNotes'),
      second.get(genomePath, 'primers'),
    ]);

    await first.set(genomePath, 'geneNotes', { first: true });
    await second.set(genomePath, 'primers', ['second']);
    expect(disk).toMatchObject({ geneNotes: { first: true }, primers: ['second'] });
    await expect(second.set(genomePath, 'geneNotes', { second: true })).rejects.toMatchObject({
      code: 'SIDECAR_CONFLICT',
    });
    expect(disk.geneNotes).toEqual({ first: true });
  });
});
