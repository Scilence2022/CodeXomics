/* eslint-disable no-new-func */
/**
 * Regression tests for tool execution fixes that were surfaced by the in-app
 * benchmark's real-execution evidence (the "task-completion-execution" tier).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const REPO_ROOT = process.cwd();

function loadViaWindow(relativePath) {
  const mockWindow = {};
  const code = fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
  new Function('window', code)(mockWindow);
  return mockWindow;
}

describe('ChatManager benchmark tool execution fixes', () => {
  const ChatManager = require('../../src/renderer/modules/ChatManager.js');

  // export_data used to call ExportManager's menu handlers, which save through an
  // anchor download with a hard-coded filename — a tool call could only ever open a
  // native save dialog. It now delegates to the same FileOperationService exports the
  // export_* tools use, so filename/auto_save are honored.
  function createExportDataManager() {
    const manager = Object.create(ChatManager.prototype);
    const exportManager = {
      exportAsGenBank: vi.fn(),
      exportAsFasta: vi.fn(),
      exportAsGFF: vi.fn(),
      exportAsBED: vi.fn(),
    };
    const fileService = {
      exportGenBankFormat: vi.fn(async () => ({ success: true, file_path: '/tmp/genome.gbk' })),
      exportFastaSequence: vi.fn(async () => ({ success: true, file_path: '/tmp/genome.fasta' })),
      exportGffAnnotations: vi.fn(async () => ({ success: true, file_path: '/tmp/features.gff3' })),
      exportBedFormat: vi.fn(async () => ({ success: true, file_path: '/tmp/features.bed' })),
      exportCdsFasta: vi.fn(async () => ({ success: true })),
      exportProteinFasta: vi.fn(async () => ({ success: true })),
      shouldAutoSaveExport: params => Boolean(params.auto_save || params.filename),
      getExportFilename: (params, fallback) => params.filename || fallback,
      saveExportContent: vi.fn(async (content, filename) => ({ success: true, filePath: filename })),
    };
    manager.app = { exportManager, getSequenceForRegion: vi.fn(async () => 'ACGT') };
    manager.services = { file: fileService };
    return { manager, exportManager, fileService };
  }

  it('export_data defaults to genbank when no format is supplied', async () => {
    const { manager, exportManager, fileService } = createExportDataManager();

    const result = await manager.exportData({ auto_save: true, filename: '/tmp/genome.gbk' });

    expect(fileService.exportGenBankFormat).toHaveBeenCalled();
    expect(exportManager.exportAsGenBank).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.format).toBe('genbank');
    expect(result.delegated_tool).toBe('export_genbank_format');
  });

  it('export_data still honors an explicit format', async () => {
    const { manager, exportManager } = createExportDataManager();

    const result = await manager.exportData({ format: 'fasta', chromosome: 'U00096', start: 1, end: 4 });

    expect(exportManager.exportAsFasta).not.toHaveBeenCalled();
    expect(result.format).toBe('fasta');
    expect(result.content).toBe('>U00096:1-4\nACGT\n');
    expect(manager.app.getSequenceForRegion).toHaveBeenCalledWith('U00096', 1, 4);
  });

  it('export_data without region coordinates exports the whole genome without a dialog', async () => {
    const { manager, exportManager, fileService } = createExportDataManager();

    const result = await manager.exportData({ format: 'fasta', auto_save: true, filename: '/tmp/genome.fasta' });

    expect(fileService.exportFastaSequence).toHaveBeenCalledWith(
      expect.objectContaining({ auto_save: true, filename: '/tmp/genome.fasta' })
    );
    expect(exportManager.exportAsFasta).not.toHaveBeenCalled();
    expect(result.format).toBe('fasta');
    expect(result.delegated_tool).toBe('export_fasta_sequence');
  });

  it('configure_export_settings opens the export configuration dialog', async () => {
    const manager = Object.create(ChatManager.prototype);
    const showExportConfigDialog = vi.fn();
    manager.app = { exportManager: { showExportConfigDialog } };

    const result = await manager.configureExportSettings({});

    expect(showExportConfigDialog).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it('translate_sequence routes through translateDNA and accepts the dna parameter', async () => {
    const manager = Object.create(ChatManager.prototype);
    manager.MicrobeFns = { translateDNA: vi.fn((seq, frame) => `MK*:${frame}`) };

    const result = await manager.translateSequence({ dna: 'ATGAAATAA', reading_frame: 1 });

    expect(manager.MicrobeFns.translateDNA).toHaveBeenCalledWith('ATGAAATAA', 0);
    expect(result.success).toBe(true);
    expect(result.value).toBe('MK*:0');
  });

  it('records benchmark tool calls into the request-local execution data', () => {
    const content = fs.readFileSync(path.join(REPO_ROOT, 'src/renderer/modules/ChatManager.js'), 'utf8');
    expect(content).toContain('executionData.functionCalls.push');
    expect(content).not.toContain('this.lastExecutionData.functionCalls.push');
  });
});

describe('AnnotationService structural permission gate', () => {
  const mockWindow = loadViaWindow('src/renderer/modules/chat/services/AnnotationService.js');
  const AnnotationService = mockWindow.AnnotationService;
  const changesetService = { createAnnotationChangeset: vi.fn(), constructor: {} };
  const app = {
    currentAnnotations: {
      U00096: [
        {
          id: 'user_1',
          start: 500000,
          end: 501500,
          type: 'gene',
          qualifiers: { gene: 'fakG', user_defined: true },
        },
      ],
    },
  };
  let service;

  beforeEach(() => {
    service = new AnnotationService(app, {
      configManager: { get: vi.fn(() => undefined) },
    });
    service._getChangeSetService = () => changesetService;
    service._getChangeTracker = () => ({ recordChange: vi.fn() });
  });

  it('allows local built-in calls without an MCP execution context', async () => {
    const result = await service.deleteAnnotation({ identifier: 'fakG' });
    expect(result.success).toBe(true);
    expect(result.deletedAnnotation.qualifiers.gene).toBe('fakG');
  });

  it('still rejects external MCP callers without structural permission', async () => {
    await expect(
      service.deleteAnnotation({
        identifier: 'fakG',
        __executionContext: { authenticated: true, permissions: [] },
      })
    ).rejects.toThrow('annotation:structural');
  });
});

describe('ProteinService interpro parameter aliases', () => {
  const mockWindow = loadViaWindow('src/renderer/modules/chat/services/ProteinService.js');
  const ProteinService = mockWindow.ProteinService;

  it('accepts the registry spelling interpro_id', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        metadata: {
          accession: 'IPR000322',
          name: { name: 'Test domain' },
          type: 'domain',
          description: [],
          go_terms: [],
          member_databases: {},
          literature: {},
        },
        protein_count: 1,
      }),
    }));
    try {
      const service = new ProteinService({}, {});
      const result = await service.getInterproEntryDetails({ interpro_id: 'IPR000322', output_format: 'minimal' });
      expect(result.success).toBe(true);
      expect(result.details.interproId).toBe('IPR000322');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
