import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';
import { EventEmitter } from 'events';
const require = createRequire(import.meta.url);
const { requestResourceSnapshot } = require('../../src/main/resource-snapshot');
const Snapshot = require('../../src/renderer/modules/LoadedResourceSnapshot');
describe('real loaded resource snapshots', () => {
  it('reports empty and actual loaded file metadata', () => {
    expect(Snapshot.collect({})).toEqual([]);
    expect(
      Snapshot.collect({ loadedFiles: [{ path: '/actual/seq.fa', name: 'seq.fa', type: 'fasta', size: 4 }] })
    ).toEqual([expect.objectContaining({ id: '/actual/seq.fa', name: 'seq.fa', size: 4 })]);
  });
  it('binds responses to both request and target and removes listeners', async () => {
    const ipc = new EventEmitter();
    const target = {
      webContents: {
        send: vi.fn((channel, { requestId }) => {
          ipc.emit('resource-info-response', { sender: {} }, { requestId, resources: [{ name: 'forged' }] });
          ipc.emit('resource-info-response', { sender: target.webContents }, { requestId: 'wrong', resources: [] });
          ipc.emit(
            'resource-info-response',
            { sender: target.webContents },
            { requestId, resources: [{ name: 'real' }] }
          );
        }),
      },
    };
    expect(await requestResourceSnapshot(ipc, target)).toEqual({ success: true, resources: [{ name: 'real' }] });
    expect(ipc.listenerCount('resource-info-response')).toBe(0);
  });
  it('rejects missing windows and expires unresponsive windows', async () => {
    const ipc = new EventEmitter();
    await expect(requestResourceSnapshot(ipc, null)).rejects.toThrow('No active');
    await expect(requestResourceSnapshot(ipc, { webContents: { send: vi.fn() } }, 5)).rejects.toThrow('timed out');
    expect(ipc.listenerCount('resource-info-response')).toBe(0);
  });
});
