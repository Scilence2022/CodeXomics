import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

const require = createRequire(import.meta.url);
const CheckpointManager = require(path.join(process.cwd(), 'src/renderer/modules/CheckpointManager.js'));
const { registerCheckpointIpc } = require(path.join(process.cwd(), 'src/main/checkpoint-store.js'));

const GENOME_A = '/data/ECOLI.gbk';
const GENOME_B = '/data/BSUB.fasta';

describe('CheckpointManager with the per-genome store', () => {
  let storageDir;
  let handlers;
  let managers;
  let nextSenderId;

  beforeEach(async () => {
    storageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'checkpoint-manager-test-'));
    handlers = new Map();
    managers = [];
    nextSenderId = 1;
    localStorage.clear();
    delete window.actionManager;
    registerCheckpointIpc({
      ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
      app: null,
      storageDir,
      isRegisteredGenomeSender: () => true,
    });
  });

  afterEach(async () => {
    managers.forEach(manager => manager.destroy());
    vi.restoreAllMocks();
    await fs.rm(storageDir, { recursive: true, force: true });
  });

  // One genome view: its own renderer-side manager talking to the shared main-process store.
  async function createView(genomePath) {
    const listeners = [];
    const sender = {
      id: nextSenderId++,
      once: () => {},
      isDestroyed: () => false,
      send: (channel, payload) => listeners.forEach(listener => listener(payload)),
    };
    const storeApi = {
      invoke: (channel, params) => handlers.get(channel)({ sender }, structuredClone(params)),
      on: (channel, listener) => {
        if (channel === 'checkpoints:changed') listeners.push(listener);
      },
    };
    const genomeBrowser = {
      loadedGenomePath: genomePath,
      currentChromosome: 'chr1',
      currentPosition: { start: 0, end: 1000 },
      showNotification: vi.fn(),
    };
    const manager = new CheckpointManager(genomeBrowser, { storeApi });
    managers.push(manager);
    await manager.ready;
    return manager;
  }

  const flush = () => new Promise(resolve => setTimeout(resolve, 20));

  it('shares one checkpoint list between views of the same genome', async () => {
    const first = await createView(GENOME_A);
    const second = await createView(GENOME_A);

    await first.createCheckpoint('From first view');
    await flush();

    expect(second.checkpoints.map(cp => cp.name)).toEqual(['From first view']);

    await second.createCheckpoint('From second view');
    await flush();

    expect(first.checkpoints.map(cp => [cp.id, cp.name])).toEqual([
      [1, 'From first view'],
      [2, 'From second view'],
    ]);
  });

  it('keeps checkpoints of different genomes apart', async () => {
    const ecoli = await createView(GENOME_A);
    const bsub = await createView(GENOME_B);

    await ecoli.createCheckpoint('E. coli only');
    await flush();

    expect(bsub.checkpoints).toEqual([]);
  });

  it('shows the new genome checkpoints after the view loads another file', async () => {
    const view = await createView(GENOME_A);
    await view.createCheckpoint('On A');

    view.genomeBrowser.loadedGenomePath = GENOME_B;
    await view.refresh();
    expect(view.checkpoints).toEqual([]);

    view.genomeBrowser.loadedGenomePath = GENOME_A;
    await view.refresh();
    expect(view.checkpoints.map(cp => cp.name)).toEqual(['On A']);
  });

  it('propagates deletions to the other views', async () => {
    const first = await createView(GENOME_A);
    const second = await createView(GENOME_A);
    const id = await first.createCheckpoint('Doomed');
    await flush();
    vi.spyOn(second, 'showDeleteConfirmModal').mockResolvedValue(true);

    await second.deleteCheckpoint(id);
    await flush();

    expect(first.checkpoints).toEqual([]);
  });

  it('does not create checkpoints without a loaded genome', async () => {
    const view = await createView(null);

    await expect(view.createCheckpoint('Nothing loaded')).rejects.toThrow('Load a genome');
    expect(view.shouldCreateAutoCheckpoint({})).toBe(false);
  });

  it('stores the current file by reference and skips unchanged auto checkpoints', async () => {
    const view = await createView(GENOME_A);
    view.genomeBrowser.currentFile = {
      path: '/data/OperonSet.tsv',
      type: 'operon',
      info: { name: 'OperonSet.tsv' },
      data: Array.from({ length: 500 }, (_, i) => ({ name: `operon_${i}` })),
    };

    await view.createAutoCheckpoint();
    expect(view.checkpoints).toHaveLength(1);
    expect(view.checkpoints[0].state.genomeBrowser.currentFile).toEqual({
      path: '/data/OperonSet.tsv',
      type: 'operon',
      info: { name: 'OperonSet.tsv' },
    });

    view.checkpoints[0].timestamp = new Date(Date.now() - 10 * 60 * 1000);
    await view.createAutoCheckpoint();
    expect(view.checkpoints).toHaveLength(1);
  });

  it('moves legacy localStorage checkpoints into the store grouped by genome', async () => {
    const legacyState = (genomePath, chromosome) => ({
      timestamp: '2026-11-03T08:00:00.000Z',
      genomeBrowser: {
        currentChromosome: chromosome,
        currentFile: { path: '/data/OperonSet.tsv', type: 'operon', data: [{ name: 'operon_1' }] },
        loadedFiles: [
          { name: path.basename(genomePath), type: 'GenBank', path: genomePath },
          { name: 'reads.bam', type: 'BAM', path: '/data/reads.bam' },
        ],
      },
    });
    const legacyCheckpoint = (id, genomePath, chromosome, minute) => ({
      id,
      name: `Auto ${id}`,
      type: 'auto',
      timestamp: new Date(Date.UTC(2026, 10, 3, 8, minute)).toISOString(),
      state: legacyState(genomePath, chromosome),
      metadata: {},
    });
    localStorage.setItem(
      'genomeai_checkpoints',
      JSON.stringify({
        checkpoints: [
          legacyCheckpoint(1866, GENOME_A, 'chr1', 0),
          legacyCheckpoint(1867, GENOME_A, 'chr1', 5), // identical to the previous one
          legacyCheckpoint(1868, GENOME_B, 'chrB', 10),
          { id: 1869, name: 'No genome', type: 'auto', timestamp: '2026-11-03T08:15:00.000Z', state: {} },
        ],
        nextCheckpointId: 1870,
      })
    );

    const ecoli = await createView(GENOME_A);
    const bsub = await createView(GENOME_B);

    expect(localStorage.getItem('genomeai_checkpoints')).toBeNull();
    expect(ecoli.checkpoints.map(cp => [cp.id, cp.name])).toEqual([[1, 'Auto 1866']]);
    expect(ecoli.checkpoints[0].state.genomeBrowser.currentFile.data).toBeUndefined();
    expect(bsub.checkpoints.map(cp => cp.name)).toEqual(['Auto 1868']);
  });
});
