// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

const require = createRequire(import.meta.url);
const { CheckpointStore, registerCheckpointIpc } = require('../../src/main/checkpoint-store');

const GENOME_A = '/data/ECOLI.gbk';
const GENOME_B = '/data/BSUB.fasta';

function checkpoint(name, overrides = {}) {
  return {
    name,
    type: 'manual',
    timestamp: new Date(Date.UTC(2026, 10, 3, 8, 0)).toISOString(),
    state: { genomeBrowser: { currentChromosome: 'chr1' } },
    metadata: {},
    ...overrides,
  };
}

let storageDir;

beforeEach(async () => {
  storageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'checkpoint-store-test-'));
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(storageDir, { recursive: true, force: true });
});

describe('CheckpointStore', () => {
  it('keeps one list per genome file and assigns increasing ids', async () => {
    const store = new CheckpointStore({ storageDir });

    await store.add(GENOME_A, [checkpoint('a1'), checkpoint('a2')]);
    await store.add(GENOME_B, [checkpoint('b1')]);

    const listA = await store.list(GENOME_A);
    const listB = await store.list(GENOME_B);
    expect(listA.checkpoints.map(cp => [cp.id, cp.name])).toEqual([
      [1, 'a1'],
      [2, 'a2'],
    ]);
    expect(listB.checkpoints.map(cp => [cp.id, cp.name])).toEqual([[1, 'b1']]);
  });

  it('persists across store instances', async () => {
    await new CheckpointStore({ storageDir }).add(GENOME_A, [checkpoint('a1')]);

    const reopened = new CheckpointStore({ storageDir });
    await reopened.add(GENOME_A, [checkpoint('a2')]);

    expect((await reopened.list(GENOME_A)).checkpoints.map(cp => cp.id)).toEqual([1, 2]);
  });

  it('never hands out the same id to concurrent writers', async () => {
    const store = new CheckpointStore({ storageDir });

    await Promise.all(Array.from({ length: 10 }, (_, i) => store.add(GENOME_A, [checkpoint(`cp${i}`)])));

    const ids = (await store.list(GENOME_A)).checkpoints.map(cp => cp.id);
    expect(ids).toHaveLength(10);
    expect(new Set(ids).size).toBe(10);
  });

  it('evicts the oldest auto checkpoints first when over the count limit', async () => {
    const store = new CheckpointStore({ storageDir, maxCheckpoints: 3 });
    const at = minute => new Date(Date.UTC(2026, 10, 3, 8, minute)).toISOString();

    await store.add(GENOME_A, [
      checkpoint('manual-old', { timestamp: at(0) }),
      checkpoint('auto-1', { type: 'auto', timestamp: at(1) }),
      checkpoint('auto-2', { type: 'auto', timestamp: at(2) }),
      checkpoint('auto-3', { type: 'auto', timestamp: at(3) }),
    ]);

    const names = (await store.list(GENOME_A)).checkpoints.map(cp => cp.name);
    expect(names).toEqual(['manual-old', 'auto-2', 'auto-3']);
  });

  it('keeps the stored list within the byte budget', async () => {
    const store = new CheckpointStore({ storageDir, maxBytes: 5000 });
    const padded = name => checkpoint(name, { type: 'auto', state: { padding: 'x'.repeat(1500) } });

    for (let i = 0; i < 6; i++) {
      await store.add(GENOME_A, [padded(`auto-${i}`)]);
    }

    const { checkpoints } = await store.list(GENOME_A);
    expect(Buffer.byteLength(JSON.stringify(checkpoints))).toBeLessThanOrEqual(5000);
    expect(checkpoints.map(cp => cp.name)).toContain('auto-5');
    expect(checkpoints.map(cp => cp.name)).not.toContain('auto-0');
  });

  it('rejects a checkpoint that alone exceeds the byte budget', async () => {
    const store = new CheckpointStore({ storageDir, maxBytes: 1000 });

    const result = await store.add(GENOME_A, [checkpoint('huge', { state: { padding: 'x'.repeat(2000) } })]);

    expect(result.added).toEqual([]);
    expect(result.rejected).toEqual(['huge']);
    expect((await store.list(GENOME_A)).checkpoints).toEqual([]);
  });

  it('removes selected checkpoints or all of them', async () => {
    const store = new CheckpointStore({ storageDir });
    await store.add(GENOME_A, [checkpoint('a1'), checkpoint('a2'), checkpoint('a3')]);

    expect((await store.remove(GENOME_A, { ids: [2] })).checkpoints.map(cp => cp.id)).toEqual([1, 3]);
    expect((await store.remove(GENOME_A, { all: true })).checkpoints).toEqual([]);

    const next = await store.add(GENOME_A, [checkpoint('a4')]);
    expect(next.added).toEqual([4]);
  });

  it('rejects relative genome paths and malformed checkpoints', async () => {
    const store = new CheckpointStore({ storageDir });

    await expect(store.list('relative/genome.gbk')).rejects.toThrow('absolute');
    await expect(store.add(GENOME_A, [{ name: 'no state' }])).rejects.toThrow('state');
  });

  it('moves an unreadable file aside instead of overwriting it', async () => {
    const store = new CheckpointStore({ storageDir });
    await fs.writeFile(store.documentPath(GENOME_A), '{not json', 'utf8');
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect((await store.list(GENOME_A)).checkpoints).toEqual([]);

    const files = await fs.readdir(storageDir);
    expect(files.some(file => file.includes('.corrupt-'))).toBe(true);
  });

  it('imports legacy checkpoints only once', async () => {
    const store = new CheckpointStore({ storageDir });
    const groups = [{ genomePath: GENOME_A, checkpoints: [checkpoint('legacy', { id: 1868 })] }];

    const [first, second] = await Promise.all([store.importLegacy(groups), store.importLegacy(groups)]);

    expect([first.imported, second.imported].sort()).toEqual([0, 1]);
    const { checkpoints } = await store.list(GENOME_A);
    expect(checkpoints.map(cp => [cp.id, cp.name])).toEqual([[1, 'legacy']]);
  });
});

describe('registerCheckpointIpc', () => {
  function setup() {
    const handlers = new Map();
    const ipcMain = { handle: (channel, handler) => handlers.set(channel, handler) };
    const registered = new Set();
    registerCheckpointIpc({
      ipcMain,
      app: null,
      storageDir,
      isRegisteredGenomeSender: event => registered.has(event.sender),
    });

    let nextId = 1;
    const createView = () => {
      const sender = { id: nextId++, send: vi.fn(), once: vi.fn(), isDestroyed: () => false };
      registered.add(sender);
      return {
        sender,
        invoke: (channel, params) => handlers.get(channel)({ sender }, params),
      };
    };
    return { handlers, createView };
  }

  it('notifies other views of the same genome, not the writer or other genomes', async () => {
    const { createView } = setup();
    const writer = createView();
    const sameGenome = createView();
    const otherGenome = createView();

    await sameGenome.invoke('checkpoints:list', { genomePath: GENOME_A });
    await otherGenome.invoke('checkpoints:list', { genomePath: GENOME_B });
    const result = await writer.invoke('checkpoints:add', { genomePath: GENOME_A, checkpoints: [checkpoint('a1')] });

    expect(result).toMatchObject({ success: true, added: [1] });
    expect(sameGenome.sender.send).toHaveBeenCalledWith('checkpoints:changed', { genomePath: GENOME_A });
    expect(writer.sender.send).not.toHaveBeenCalled();
    expect(otherGenome.sender.send).not.toHaveBeenCalled();
  });

  it('stops notifying a view once it switches to another genome', async () => {
    const { createView } = setup();
    const writer = createView();
    const switcher = createView();

    await switcher.invoke('checkpoints:list', { genomePath: GENOME_A });
    await switcher.invoke('checkpoints:list', { genomePath: GENOME_B });
    await writer.invoke('checkpoints:add', { genomePath: GENOME_A, checkpoints: [checkpoint('a1')] });

    expect(switcher.sender.send).not.toHaveBeenCalled();
  });

  it('notifies views of genomes that received legacy checkpoints', async () => {
    const { createView } = setup();
    const importer = createView();
    const viewer = createView();
    await viewer.invoke('checkpoints:list', { genomePath: GENOME_A });

    const result = await importer.invoke('checkpoints:import-legacy', {
      groups: [{ genomePath: GENOME_A, checkpoints: [checkpoint('legacy')] }],
    });

    expect(result).toMatchObject({ success: true, imported: 1, genomePaths: [GENOME_A] });
    expect(viewer.sender.send).toHaveBeenCalledWith('checkpoints:changed', { genomePath: GENOME_A });
  });

  it('refuses senders that are not genome views', async () => {
    const { handlers } = setup();

    const result = await handlers.get('checkpoints:list')(
      { sender: { id: 99, send: vi.fn(), once: vi.fn() } },
      { genomePath: GENOME_A }
    );

    expect(result).toEqual({ success: false, error: 'Checkpoints are only available in genome views.' });
  });
});
