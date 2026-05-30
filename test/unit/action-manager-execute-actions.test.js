import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

let ActionManager;
let vmContext;
let lastExport;

function loadRendererClass(relativePath) {
  const filePath = path.join(repoRoot, relativePath);
  const source = fs.readFileSync(filePath, 'utf8');
  vm.runInContext(source, vmContext, { filename: filePath });
}

function installFakeGenBankExporter() {
  lastExport = null;

  class FakeGenBankExporter {
    exportGenBank({ chromosomes, getSequence, getFeatures, executedActions, executionId }) {
      lastExport = {};
      for (const chr of chromosomes) {
        lastExport[chr] = {
          sequence: getSequence(chr),
          features: getFeatures(chr),
        };
      }

      return JSON.stringify({
        executionId,
        executedActionCount: executedActions.length,
        chromosomes: lastExport,
      });
    }
  }

  vmContext.GenBankExporter = FakeGenBankExporter;
  window.GenBankExporter = FakeGenBankExporter;
}

function createManager(sequence, features = []) {
  const genomeBrowser = {
    currentSequence: { chr1: sequence },
    currentAnnotations: { chr1: features.map(feature => ({ ...feature })) },
    currentVariants: {},
    currentReads: {},
    exportManager: {},
    fileManager: {
      currentFile: { path: '/tmp/source.gbk' },
    },
    showNotification: vi.fn(),
  };

  const manager = new ActionManager(genomeBrowser);
  manager.updateActionListUI = vi.fn();
  manager.updateStats = vi.fn();
  manager.notifyActionsTrackUpdate = vi.fn();
  manager.autoOpenGeneratedGBK = vi.fn(async () => {});

  return { genomeBrowser, manager };
}

beforeAll(() => {
  vmContext = vm.createContext({
    window,
    document,
    console,
    performance,
    Date,
    Error,
    JSON,
    Map,
    Math,
    Number,
    Object,
    RegExp,
    Set,
    String,
    clearTimeout: vi.fn(),
    setTimeout: callback => {
      callback();
      return 0;
    },
  });

  loadRendererClass('src/renderer/modules/GenomeDataProxy.js');
  loadRendererClass('src/renderer/modules/ActionManager.js');
  vmContext.GenomeDataProxy = window.GenomeDataProxy;
  ActionManager = window.ActionManager;
});

beforeEach(() => {
  document.body.innerHTML = '';
  installFakeGenBankExporter();
  window.electronAPI = {
    writeFile: vi.fn(async () => ({ success: true })),
  };
});

describe('ActionManager execute_actions sequencing', () => {
  it('executes queued sequence edits against the working sequence and adjusts later coordinates', async () => {
    const { genomeBrowser, manager } = createManager('ACGTACGT');

    await manager.functionInsertSequence({ chromosome: 'chr1', position: 3, sequence: 'TT' });
    await manager.functionDeleteSequence({ chromosome: 'chr1', start: 6, end: 6 });

    const result = await manager.executeAllActionsInternal({ saveFile: '/tmp/ordered-actions.gbk' });

    expect(result.success).toBe(true);
    expect(result.executedActions).toBe(2);
    expect(result.totalActions).toBe(2);
    expect(result.pendingActions).toBe(2);
    expect(result.remainingActions).toBe(0);
    expect(lastExport.chr1.sequence).toBe('ACTTGTAGT');
    expect(genomeBrowser.currentSequence.chr1).toBe('ACGTACGT');
    expect(manager.actions).toHaveLength(0);
    expect(manager.actionHistory[0].actions[1].target).toBe('chr1:8-8(+)');
  });

  it('exports feature annotations updated from the same working-copy modifications', async () => {
    const originalFeatures = [
      { type: 'gene', name: 'deleted_gene', start: 2, end: 3 },
      { type: 'gene', name: 'shifted_gene', start: 6, end: 7 },
    ];
    const { genomeBrowser, manager } = createManager('ACGTACGT', originalFeatures);

    await manager.functionDeleteSequence({ chromosome: 'chr1', start: 2, end: 3 });

    const result = await manager.executeAllActionsInternal({ saveFile: '/tmp/features-actions.gbk' });

    expect(result.success).toBe(true);
    expect(lastExport.chr1.sequence).toBe('ATACGT');
    expect(lastExport.chr1.features).toEqual([
      expect.objectContaining({
        name: 'shifted_gene',
        start: 4,
        end: 5,
      }),
    ]);
    expect(genomeBrowser.currentAnnotations.chr1).toEqual(originalFeatures);
  });

  it('preserves the clipboard snapshot stored on queued paste actions', async () => {
    const { manager } = createManager('ACGTACGT');
    manager.clipboard = {
      type: 'copy',
      sequence: 'AA',
      source: 'manual-old',
      sourceInfo: { source: 'function_call' },
      comprehensiveData: { features: [], region: { chromosome: 'chr1', start: 1, end: 2, strand: '+' } },
    };

    await manager.functionPasteSequence({ chromosome: 'chr1', position: 3 });
    manager.clipboard = {
      type: 'copy',
      sequence: 'GGGG',
      source: 'manual-new',
      sourceInfo: { source: 'function_call' },
      comprehensiveData: { features: [], region: { chromosome: 'chr1', start: 1, end: 4, strand: '+' } },
    };

    const result = await manager.executeAllActionsInternal({ saveFile: '/tmp/paste-actions.gbk' });

    expect(result.success).toBe(true);
    expect(lastExport.chr1.sequence).toBe('ACAAGTACGT');
  });

  it('allows later insertions to adjust to the append boundary after earlier insertions', async () => {
    const { manager } = createManager('ACGTACGT');

    await manager.functionInsertSequence({ chromosome: 'chr1', position: 3, sequence: 'TT' });
    await manager.functionInsertSequence({ chromosome: 'chr1', position: 9, sequence: 'AA' });

    const result = await manager.executeAllActionsInternal({ saveFile: '/tmp/append-actions.gbk' });

    expect(result.success).toBe(true);
    expect(lastExport.chr1.sequence).toBe('ACTTGTACGTAA');
    expect(manager.actionHistory[0].actions[1].target).toBe('chr1:11');
  });

  it('executes UI-created insert actions with the same 1-based coordinates used by tool actions', async () => {
    const { manager } = createManager('ACGTACGT');

    manager.createInsertAction('chr1', 8, 'AA');

    const result = await manager.executeAllActionsInternal({ saveFile: '/tmp/ui-insert-actions.gbk' });

    expect(result.success).toBe(true);
    expect(lastExport.chr1.sequence).toBe('ACGTACGTAA');
    expect(manager.actionHistory[0].actions[0].target).toBe('chr1:9');
    expect(manager.actionHistory[0].actions[0].metadata.position).toBe(9);
  });

  it('applies sequence_edit actions to the exported working copy and shifts later coordinates', async () => {
    const { manager } = createManager('ACGTACGT');
    const sequenceEdit = manager.createAction(manager.ACTION_TYPES.SEQUENCE_EDIT, 'chr1:3-5(+)', 'Edit chr1:3-5', {
      chromosome: 'chr1',
      viewStart: 2,
      viewEnd: 5,
      originalSequence: 'GTA',
      changeSummary: {
        totalChanges: 2,
        substitutions: 0,
        insertions: 0,
        deletions: 1,
        originalLength: 3,
        newLength: 2,
        modifiedSequence: 'TT',
      },
    });
    manager.addAction(sequenceEdit);
    await manager.functionDeleteSequence({ chromosome: 'chr1', start: 7, end: 7 });

    const result = await manager.executeAllActionsInternal({ saveFile: '/tmp/sequence-edit-actions.gbk' });

    expect(result.success).toBe(true);
    expect(lastExport.chr1.sequence).toBe('ACTTCT');
    expect(manager.actionHistory[0].actions[1].target).toBe('chr1:6-6(+)');
  });

  it('keeps insertions at a deleted locus executable while invalidating deleted range reads', async () => {
    const { manager } = createManager('ACGTACGT');

    await manager.functionDeleteSequence({ chromosome: 'chr1', start: 3, end: 5 });
    await manager.functionInsertSequence({ chromosome: 'chr1', position: 4, sequence: 'AA' });

    const result = await manager.executeAllActionsInternal({ saveFile: '/tmp/delete-then-insert-actions.gbk' });

    expect(result.success).toBe(true);
    expect(lastExport.chr1.sequence).toBe('ACAACGT');
    expect(manager.actionHistory[0].actions[1].target).toBe('chr1:3');
  });

  it('can rebuild a chromosome when a full deletion is followed by an insertion', async () => {
    const { manager } = createManager('AC');

    await manager.functionDeleteSequence({ chromosome: 'chr1', start: 1, end: 2 });
    await manager.functionInsertSequence({ chromosome: 'chr1', position: 2, sequence: 'TT' });

    const result = await manager.executeAllActionsInternal({ saveFile: '/tmp/rebuild-actions.gbk' });

    expect(result.success).toBe(true);
    expect(lastExport.chr1.sequence).toBe('TT');
    expect(manager.actionHistory[0].actions[1].target).toBe('chr1:1');
  });

  it('exports an intentionally empty chromosome after a full deletion', async () => {
    const { manager } = createManager('AC');

    await manager.functionDeleteSequence({ chromosome: 'chr1', start: 1, end: 2 });

    const result = await manager.executeAllActionsInternal({ saveFile: '/tmp/delete-all-actions.gbk' });

    expect(result.success).toBe(true);
    expect(lastExport.chr1.sequence).toBe('');
  });

  it('clips copied features to the selected region before pasting annotations', async () => {
    const { manager } = createManager('AACCGGTT', [
      { type: 'gene', name: 'partial_left', start: 2, end: 5, strand: '+' },
      { type: 'gene', name: 'inside', start: 4, end: 6, strand: '+' },
    ]);

    await manager.functionCopySequence({ chromosome: 'chr1', start: 3, end: 6, strand: '+' });
    await manager.functionPasteSequence({ chromosome: 'chr1', position: 9 });

    const result = await manager.executeAllActionsInternal({ saveFile: '/tmp/clipped-feature-actions.gbk' });

    expect(result.success).toBe(true);
    expect(lastExport.chr1.sequence).toBe('AACCGGTTCCGG');

    const copiedPartial = lastExport.chr1.features.find(feature => feature.name?.startsWith('partial_left_copy_'));
    const copiedInside = lastExport.chr1.features.find(feature => feature.name?.startsWith('inside_copy_'));
    expect(copiedPartial).toEqual(expect.objectContaining({ start: 9, end: 11 }));
    expect(copiedPartial.note).toContain('Feature clipped');
    expect(copiedInside).toEqual(expect.objectContaining({ start: 10, end: 12 }));
  });

  it('reorients copied features when pasting reverse-strand selections', async () => {
    const { manager } = createManager('AAACCGTT', [
      { type: 'gene', name: 'rev_feature', start: 3, end: 4, strand: '+' },
    ]);

    await manager.functionCopySequence({ chromosome: 'chr1', start: 3, end: 6, strand: '-' });
    await manager.functionPasteSequence({ chromosome: 'chr1', position: 9 });

    const result = await manager.executeAllActionsInternal({ saveFile: '/tmp/reverse-feature-actions.gbk' });

    expect(result.success).toBe(true);
    expect(lastExport.chr1.sequence).toBe('AAACCGTTCGGT');

    const copiedFeature = lastExport.chr1.features.find(feature => feature.name?.startsWith('rev_feature_copy_'));
    expect(copiedFeature).toEqual(expect.objectContaining({ start: 11, end: 12, strand: '-' }));
  });

  it('does not execute or export actions that were invalidated by a prior edit', async () => {
    const { manager } = createManager('ACGTACGT');

    await manager.functionDeleteSequence({ chromosome: 'chr1', start: 3, end: 5 });
    await manager.functionReplaceSequence({ chromosome: 'chr1', start: 4, end: 4, sequence: 'A' });

    const result = await manager.executeAllActionsInternal({ saveFile: '/tmp/failed-actions.gbk' });

    expect(result.success).toBe(false);
    expect(result.executedActions).toBe(1);
    expect(result.failedActions).toBe(1);
    expect(result.message).toContain('cannot execute');
    expect(window.electronAPI.writeFile).not.toHaveBeenCalled();
    expect(lastExport).toBeNull();
  });
});
