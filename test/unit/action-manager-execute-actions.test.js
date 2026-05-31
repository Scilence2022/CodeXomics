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
  vmContext.require = undefined;
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

  it('opens generated GBK files in a new genome window when window creation is available', async () => {
    const { genomeBrowser, manager } = createManager('ACGT');
    manager.autoOpenGeneratedGBK = ActionManager.prototype.autoOpenGeneratedGBK.bind(manager);
    genomeBrowser.fileManager.parseGenBank = vi.fn(async () => {});
    window.electronAPI.createNewMainWindow = vi.fn(async () => ({ success: true, windowId: 'window-test' }));

    await manager.autoOpenGeneratedGBK('LOCUS test\n//\n', '/tmp/generated-actions.gbk');

    expect(window.electronAPI.createNewMainWindow).toHaveBeenCalledWith('/tmp/generated-actions.gbk');
    expect(genomeBrowser.fileManager.parseGenBank).not.toHaveBeenCalled();
    expect(genomeBrowser.fileManager.currentFile.path).toBe('/tmp/source.gbk');
  });

  it('uses direct IPC to open generated GBK files when preload APIs are unavailable', async () => {
    const { genomeBrowser, manager } = createManager('ACGT');
    const ipcRenderer = {
      invoke: vi.fn(async () => ({ success: true, windowId: 'window-ipc' })),
    };
    manager.autoOpenGeneratedGBK = ActionManager.prototype.autoOpenGeneratedGBK.bind(manager);
    genomeBrowser.fileManager.parseGenBank = vi.fn(async () => {});
    vmContext.require = vi.fn(moduleName => {
      if (moduleName === 'electron') {
        return { ipcRenderer };
      }
      throw new Error(`Unexpected module: ${moduleName}`);
    });

    const opened = await manager.autoOpenGeneratedGBK('LOCUS test\n//\n', '/tmp/generated-actions.gbk');

    expect(opened).toBe(true);
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('createNewMainWindow', '/tmp/generated-actions.gbk');
    expect(genomeBrowser.fileManager.parseGenBank).not.toHaveBeenCalled();
    expect(genomeBrowser.fileManager.currentFile.path).toBe('/tmp/source.gbk');
  });

  it('does not load generated GBK files into the current window when new-window opening fails', async () => {
    const { genomeBrowser, manager } = createManager('ACGT');
    manager.autoOpenGeneratedGBK = ActionManager.prototype.autoOpenGeneratedGBK.bind(manager);
    genomeBrowser.fileManager.parseGenBank = vi.fn(async () => {});
    window.electronAPI.createNewMainWindow = vi.fn(async () => ({ success: false, error: 'Window failed' }));

    const opened = await manager.autoOpenGeneratedGBK('LOCUS test\n//\n', '/tmp/generated-actions.gbk');

    expect(opened).toBe(false);
    expect(genomeBrowser.fileManager.parseGenBank).not.toHaveBeenCalled();
    expect(genomeBrowser.fileManager.currentFile.path).toBe('/tmp/source.gbk');
  });

  it('executes cut and later paste as an ordered move on the working sequence', async () => {
    const { genomeBrowser, manager } = createManager('AAAACCCC');

    await manager.functionCutSequence({ chromosome: 'chr1', start: 2, end: 4 });
    await manager.functionPasteSequence({ chromosome: 'chr1', position: 9 });

    const result = await manager.executeAllActionsInternal({ saveFile: '/tmp/cut-paste-actions.gbk' });

    expect(result.success).toBe(true);
    expect(result.executedActions).toBe(2);
    expect(lastExport.chr1.sequence).toBe('ACCCCAAA');
    expect(genomeBrowser.currentSequence.chr1).toBe('AAAACCCC');
    expect(manager.actionHistory[0].actions[1].target).toBe('chr1:6');
  });

  it('executes replace_sequence actions against the working sequence and removes replaced features', async () => {
    const { genomeBrowser, manager } = createManager('ACGTACGT', [
      { type: 'gene', name: 'replaced_gene', start: 3, end: 4, strand: '+' },
      { type: 'gene', name: 'shifted_gene', start: 7, end: 8, strand: '+' },
    ]);

    await manager.functionReplaceSequence({ chromosome: 'chr1', start: 3, end: 4, sequence: 'TTAA' });

    const result = await manager.executeAllActionsInternal({ saveFile: '/tmp/replace-actions.gbk' });

    expect(result.success).toBe(true);
    expect(lastExport.chr1.sequence).toBe('ACTTAAACGT');
    expect(lastExport.chr1.features).toEqual([
      expect.objectContaining({
        name: 'shifted_gene',
        start: 9,
        end: 10,
      }),
    ]);
    expect(genomeBrowser.currentSequence.chr1).toBe('ACGTACGT');
  });

  it('converts reverse-strand replace_sequence replacements back to genomic orientation', async () => {
    const { manager } = createManager('AACCGG');

    await manager.functionReplaceSequence({
      chromosome: 'chr1',
      start: 2,
      end: 5,
      strand: '-',
      sequence: 'ATGC',
    });

    const result = await manager.executeAllActionsInternal({ saveFile: '/tmp/reverse-replace-actions.gbk' });

    expect(result.success).toBe(true);
    expect(lastExport.chr1.sequence).toBe('AGCATG');
    expect(manager.actionHistory[0].actions[0].result).toEqual(
      expect.objectContaining({
        operation: 'replace',
        strand: '-',
        inputSequence: 'ATGC',
        newSequence: 'GCAT',
      })
    );
  });

  it('reverse-complements insert_sequence input before execute_actions applies it', async () => {
    const { manager } = createManager('AACCGG');

    await manager.functionInsertSequence({
      chromosome: 'chr1',
      position: 3,
      sequence: 'ATGC',
      reverse_complement: true,
    });

    const result = await manager.executeAllActionsInternal({ saveFile: '/tmp/reverse-insert-actions.gbk' });

    expect(result.success).toBe(true);
    expect(lastExport.chr1.sequence).toBe('AAGCATCCGG');
    expect(manager.actionHistory[0].actions[0].result).toEqual(
      expect.objectContaining({
        operation: 'insert',
        reverseComplement: true,
        inputSequence: 'ATGC',
        insertedSequence: 'GCAT',
      })
    );
  });

  it('reverse-complements paste_sequence clipboard snapshots before execute_actions applies them', async () => {
    const { manager } = createManager('AACCGG');
    manager.clipboard = {
      type: 'copy',
      sequence: 'ATGC',
      source: 'manual',
      sourceInfo: { source: 'function_call' },
      comprehensiveData: { features: [], region: { chromosome: 'chr1', start: 1, end: 4, strand: '+' } },
    };

    await manager.functionPasteSequence({ chromosome: 'chr1', position: 3, reverse_complement: true });

    const result = await manager.executeAllActionsInternal({ saveFile: '/tmp/reverse-paste-actions.gbk' });

    expect(result.success).toBe(true);
    expect(lastExport.chr1.sequence).toBe('AAGCATCCGG');
    expect(manager.clipboard.sequence).toBe('ATGC');
    expect(manager.actionHistory[0].actions[0].result).toEqual(
      expect.objectContaining({
        operation: 'paste-insert',
        reverseComplement: true,
        inputSequence: 'ATGC',
        pastedSequence: 'GCAT',
      })
    );
  });

  it('reports a clear error for reverse-strand replace_sequence actions missing replacement bases', async () => {
    const { manager } = createManager('AACCGG');
    const replaceAction = manager.createAction(
      manager.ACTION_TYPES.REPLACE_SEQUENCE,
      'chr1:2-5(-)',
      'Malformed reverse-strand replace',
      {
        chromosome: 'chr1',
        start: 2,
        end: 5,
        strand: '-',
      }
    );
    manager.addAction(replaceAction);

    const result = await manager.executeAllActionsInternal({ saveFile: '/tmp/missing-replace-actions.gbk' });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Replace sequence action missing sequence data');
    expect(window.electronAPI.writeFile).not.toHaveBeenCalled();
    expect(lastExport).toBeNull();
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

  it('executes UI-created reverse-complement insert actions', async () => {
    const { manager } = createManager('AACCGG');

    manager.createInsertAction('chr1', 2, 'ATGC', { reverseComplement: true });

    const result = await manager.executeAllActionsInternal({ saveFile: '/tmp/ui-reverse-insert-actions.gbk' });

    expect(result.success).toBe(true);
    expect(lastExport.chr1.sequence).toBe('AAGCATCCGG');
    expect(manager.actionHistory[0].actions[0].metadata.reverseComplement).toBe(true);
  });

  it('queues reverse-complement paste actions from the UI handler', () => {
    const { manager } = createManager('AACCGG');
    manager.cursorPosition = 3;
    manager.clipboard = {
      type: 'copy',
      sequence: 'ATGC',
      source: 'manual',
      sourceInfo: null,
      comprehensiveData: { features: [], region: { chromosome: 'chr1', start: 1, end: 4, strand: '+' } },
    };

    manager.handlePasteSequence(true);

    expect(manager.actions).toHaveLength(1);
    expect(manager.actions[0].metadata).toEqual(
      expect.objectContaining({
        pasteMode: 'insert',
        reverseComplement: true,
        reverse_complement: true,
      })
    );
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

  it('converts reverse-strand sequence_edit replacements back to genomic orientation', async () => {
    const { manager } = createManager('AACCGG');
    const sequenceEdit = manager.createAction(
      manager.ACTION_TYPES.SEQUENCE_EDIT,
      'chr1:2-5(-)',
      'Edit chr1:2-5 on reverse strand',
      {
        chromosome: 'chr1',
        start: 2,
        end: 5,
        strand: '-',
        originalSequence: 'CGGT',
        changeSummary: {
          totalChanges: 4,
          substitutions: 4,
          insertions: 0,
          deletions: 0,
          originalLength: 4,
          newLength: 4,
          modifiedSequence: 'ATGC',
        },
      }
    );
    manager.addAction(sequenceEdit);

    const result = await manager.executeAllActionsInternal({ saveFile: '/tmp/reverse-sequence-edit-actions.gbk' });

    expect(result.success).toBe(true);
    expect(lastExport.chr1.sequence).toBe('AGCATG');
    expect(manager.actionHistory[0].actions[0].result).toEqual(
      expect.objectContaining({
        operation: 'sequence_edit',
        strand: '-',
        newLength: 4,
      })
    );
  });

  it('reverse-complements IUPAC ambiguity bases for reverse-strand sequence_edit actions', async () => {
    const { manager } = createManager('AACCGG');
    const sequenceEdit = manager.createAction(
      manager.ACTION_TYPES.SEQUENCE_EDIT,
      'chr1:2-5(-)',
      'Edit chr1:2-5 on reverse strand with ambiguity bases',
      {
        chromosome: 'chr1',
        start: 2,
        end: 5,
        strand: '-',
        originalSequence: 'CGGT',
        changeSummary: {
          totalChanges: 4,
          substitutions: 4,
          insertions: 0,
          deletions: 0,
          originalLength: 4,
          newLength: 4,
          modifiedSequence: 'RYKM',
        },
      }
    );
    manager.addAction(sequenceEdit);

    const result = await manager.executeAllActionsInternal({
      saveFile: '/tmp/reverse-sequence-edit-iupac-actions.gbk',
    });

    expect(result.success).toBe(true);
    expect(lastExport.chr1.sequence).toBe('AKMRYG');
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

  it('reorients copied features when pasting in reverse-complement mode', async () => {
    const { manager } = createManager('AAACCGTT', [
      { type: 'gene', name: 'rc_paste_feature', start: 3, end: 4, strand: '+' },
    ]);

    await manager.functionCopySequence({ chromosome: 'chr1', start: 3, end: 6, strand: '+' });
    await manager.functionPasteSequence({ chromosome: 'chr1', position: 9, reverse_complement: true });

    const result = await manager.executeAllActionsInternal({ saveFile: '/tmp/reverse-paste-feature-actions.gbk' });

    expect(result.success).toBe(true);
    expect(lastExport.chr1.sequence).toBe('AAACCGTTCGGT');

    const copiedFeature = lastExport.chr1.features.find(feature => feature.name?.startsWith('rc_paste_feature_copy_'));
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

  it('opens the replacement modal with the selected strand when replace uses manual region selection', async () => {
    const { manager } = createManager('AACCGG');
    document.body.innerHTML = `
      <select id="chromosomeSelectSeq"><option value="chr1" selected>chr1</option></select>
      <input id="startPositionSeq" value="2" />
      <input id="endPositionSeq" value="5" />
      <select id="strandSelectSeq"><option value="-">-</option></select>
    `;
    manager.currentOperation = 'replace';
    manager.closeSequenceSelectionModal = vi.fn();
    manager.showSequenceReplaceModal = vi.fn();

    await manager.confirmSequenceSelection();

    expect(manager.actions).toHaveLength(0);
    expect(manager.closeSequenceSelectionModal).toHaveBeenCalled();
    expect(manager.showSequenceReplaceModal).toHaveBeenCalledWith(
      expect.objectContaining({
        chromosome: 'chr1',
        start: 2,
        end: 5,
        strand: '-',
      })
    );
  });
});
