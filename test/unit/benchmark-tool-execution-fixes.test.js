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

  it('export_data defaults to genbank when no format is supplied', async () => {
    const manager = Object.create(ChatManager.prototype);
    const exportAsGenBank = vi.fn(() => ({ ok: true }));
    manager.app = {
      exportManager: { exportAsGenBank, exportAsFasta: vi.fn(), exportAsGFF: vi.fn(), exportAsBED: vi.fn() },
    };

    const result = await manager.exportData({});

    expect(exportAsGenBank).toHaveBeenCalled();
    expect(result.success ?? true).toBe(true);
    expect(result.format).toBe('genbank');
    expect(result.exported).toBe(true);
  });

  it('export_data still honors an explicit format', async () => {
    const manager = Object.create(ChatManager.prototype);
    const exportAsFasta = vi.fn(() => ({ ok: true }));
    manager.app = {
      exportManager: { exportAsGenBank: vi.fn(), exportAsFasta, exportAsGFF: vi.fn(), exportAsBED: vi.fn() },
      getSequenceForRegion: vi.fn(async () => 'ACGT'),
    };

    const result = await manager.exportData({ format: 'fasta', chromosome: 'U00096', start: 1, end: 4 });

    expect(exportAsFasta).not.toHaveBeenCalled();
    expect(result.format).toBe('fasta');
    expect(manager.app.getSequenceForRegion).toHaveBeenCalledWith('U00096', 1, 4);
  });

  it('export_data without region coordinates uses the ExportManager fasta export', async () => {
    const manager = Object.create(ChatManager.prototype);
    const exportAsFasta = vi.fn(() => ({ ok: true }));
    manager.app = {
      exportManager: { exportAsGenBank: vi.fn(), exportAsFasta, exportAsGFF: vi.fn(), exportAsBED: vi.fn() },
    };

    const result = await manager.exportData({ format: 'fasta' });

    expect(exportAsFasta).toHaveBeenCalled();
    expect(result.format).toBe('fasta');
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
