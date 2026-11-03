import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);
const CHECKPOINT_MANAGER_PATH = path.join(process.cwd(), 'src/renderer/modules/CheckpointManager.js');
const STORAGE_KEY = 'genomeai_checkpoints';

// Mirrors what FileManager.loadOperonFile() leaves on genomeBrowser.currentFile.
function operonFile(count = 2000) {
  return {
    path: '/data/OperonSet.tsv',
    info: { name: 'OperonSet.tsv', size: 123456, extension: '.tsv' },
    type: 'operon',
    data: Array.from({ length: count }, (_, i) => ({
      name: `operon_${i}`,
      genes: ['geneA', 'geneB', 'geneC'],
      start: i * 1000,
      end: i * 1000 + 900,
      strand: '+',
    })),
  };
}

function createGenomeBrowser(overrides = {}) {
  return {
    currentFile: operonFile(),
    currentChromosome: 'chr1',
    currentPosition: { start: 0, end: 10000 },
    zoomLevel: 1,
    showNotification: vi.fn(),
    ...overrides,
  };
}

function legacyState(currentFile) {
  return {
    timestamp: '2026-11-03T08:00:00.000Z',
    version: '1.0.0',
    genomeBrowser: { currentFile, currentChromosome: 'chr1', currentPosition: { start: 0, end: 10000 } },
    actionManager: null,
    ui: {},
    fileManager: null,
    plugins: {},
    settings: {},
  };
}

describe('CheckpointManager storage budget', () => {
  let CheckpointManager;
  let managers;

  beforeEach(() => {
    localStorage.clear();
    delete window.actionManager;
    CheckpointManager = require(CHECKPOINT_MANAGER_PATH);
    managers = [];
  });

  afterEach(() => {
    managers.forEach(manager => clearInterval(manager.autoSaveTimer));
    vi.restoreAllMocks();
  });

  function createManager(genomeBrowser = createGenomeBrowser()) {
    const manager = new CheckpointManager(genomeBrowser);
    managers.push(manager);
    return manager;
  }

  it('stores the current file by reference, without its parsed data', async () => {
    const manager = createManager();

    await manager.createCheckpoint('Manual', manager.CHECKPOINT_TYPES.MANUAL);

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.checkpoints[0].state.genomeBrowser.currentFile).toEqual({
      path: '/data/OperonSet.tsv',
      type: 'operon',
      info: { name: 'OperonSet.tsv', size: 123456, extension: '.tsv' },
    });
    expect(localStorage.getItem(STORAGE_KEY).length).toBeLessThan(5000);
  });

  it('skips an auto checkpoint when nothing changed since the last one', async () => {
    const manager = createManager();
    await manager.createAutoCheckpoint();
    manager.checkpoints[0].timestamp = new Date(Date.now() - 10 * 60 * 1000);

    await manager.createAutoCheckpoint();
    expect(manager.checkpoints).toHaveLength(1);

    manager.genomeBrowser.currentChromosome = 'chr2';
    await manager.createAutoCheckpoint();
    expect(manager.checkpoints).toHaveLength(2);
  });

  it('shrinks oversized legacy storage on load', () => {
    const legacy = {
      checkpoints: Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        name: `Auto ${i}`,
        type: 'auto',
        timestamp: new Date(Date.UTC(2026, 10, 3, 8, i * 5)).toISOString(),
        state: legacyState(operonFile(600)),
        metadata: {},
        size: 0,
      })),
      nextCheckpointId: 51,
      lastSaved: '2026-11-03T12:00:00.000Z',
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));
    expect(localStorage.getItem(STORAGE_KEY).length).toBeGreaterThan(2 * 1024 * 1024);

    const manager = createManager();

    expect(manager.checkpoints).toHaveLength(1);
    expect(manager.checkpoints[0].state.genomeBrowser.currentFile.data).toBeUndefined();
    expect(manager.nextCheckpointId).toBe(51);
    expect(localStorage.getItem(STORAGE_KEY).length).toBeLessThan(5000);
  });

  it('keeps the serialized value within the budget by dropping the oldest auto checkpoints first', async () => {
    const manager = createManager(createGenomeBrowser({ currentFile: null }));
    manager.maxStorageChars = 20000;
    window.actionManager = { getState: () => ({ actions: [], clipboard: 'A'.repeat(3000), nextActionId: 1 }) };

    await manager.createCheckpoint('Keep me', manager.CHECKPOINT_TYPES.MANUAL);
    for (let i = 0; i < 10; i++) {
      manager.genomeBrowser.currentPosition = { start: i, end: i + 100 };
      await manager.createCheckpoint(`Auto ${i}`, manager.CHECKPOINT_TYPES.AUTO);
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    const stored = JSON.parse(raw);
    expect(raw.length).toBeLessThanOrEqual(20000);
    expect(stored.checkpoints.map(cp => cp.name)).toContain('Keep me');
    expect(stored.checkpoints.map(cp => cp.name)).toContain('Auto 9');
    expect(stored.checkpoints.map(cp => cp.name)).not.toContain('Auto 0');
    expect(manager.checkpoints.map(cp => cp.id)).toEqual(stored.checkpoints.map(cp => cp.id));
  });

  it('keeps a checkpoint larger than the whole budget in memory only', async () => {
    const manager = createManager(createGenomeBrowser({ currentFile: null }));
    manager.maxStorageChars = 2000;
    window.actionManager = { getState: () => ({ actions: [], clipboard: 'A'.repeat(5000), nextActionId: 1 }) };
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await manager.createCheckpoint('Huge', manager.CHECKPOINT_TYPES.MANUAL);

    expect(manager.checkpoints).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).checkpoints).toHaveLength(0);
  });
});
