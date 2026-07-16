/* eslint-disable no-new-func */
import { describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

const MANAGER_PATH = path.join(process.cwd(), 'src/renderer/modules/GeneAttachmentsManager.js');

function loadManager(windowMock = {}) {
  const module = { exports: {} };
  new Function('window', 'module', fs.readFileSync(MANAGER_PATH, 'utf8'))(windowMock, module);
  return module.exports;
}

function target() {
  return {
    workspaceId: 'ws-1',
    genomeId: 'genome-1',
    annotationRevision: 0,
    featureId: 'feature-1',
    featureHash: 'hash-1',
    chromosome: 'chr1',
    locusTag: 'b4024',
    geneSymbol: 'lysC',
    proteinId: 'NP_418448.1',
    featureType: 'CDS',
  };
}

function descriptor() {
  return {
    taskId: 'task-lysC',
    fileName: 'DGR_task-lysC_abc123.json',
    storedPath: '/app-data/gene_attachments/dgr/report.json',
    size: 8192,
    sha256: 'a'.repeat(64),
    proposalSha256: 'b'.repeat(64),
    storedAt: '2026-07-16T01:00:00.000Z',
    citationValidation: {
      schema: 'codexomics.dgr-citation-validation.v1',
      verified: true,
      factCount: 18,
      pubMedSourceCount: 38,
      verifiedPubMedSourceCount: 14,
    },
    currentAnnotationValidation: {
      schema: 'codexomics.dgr-current-annotation-validation.v1',
      verified: true,
      required: true,
      snapshotSha256: 'c'.repeat(64),
      targetFeatureHash: 'hash-1',
    },
    summary: {
      title: 'lysC full research report',
      sourceCount: 39,
      confidence: 0.9,
      literatureCount: 38,
      directLiteratureCount: 14,
      geneLinkedContextCount: 24,
      citationBoundFactCount: 18,
    },
  };
}

describe('GeneAttachmentsManager generated DGR reports', () => {
  it('normalizes array qualifiers to a stable scalar gene identifier', () => {
    const Manager = loadManager();
    const manager = new Manager({}, { get: () => ({}) });
    expect(
      manager.getGeneIdentifier({
        type: 'CDS',
        start: 1,
        end: 100,
        qualifiers: { locus_tag: ['b4024'], gene: ['lysC'] },
      })
    ).toBe('b4024');
  });

  it('durably registers an idempotent CDS-bound report and opens it in the verified JSON viewer', async () => {
    const openDgrJsonViewer = vi.fn(async () => ({ success: true }));
    const Manager = loadManager({
      electronAPI: {
        checkFileExists: vi.fn(async () => ({ exists: true })),
        openDgrJsonViewer,
      },
    });
    const setAndForceSave = vi.fn(async () => true);
    const refreshGeneAttachments = vi.fn();
    const manager = new Manager(
      {
        fileManager: { currentFile: { path: '/genomes/ecoli.gbk' } },
        selectedGene: { gene: { type: 'CDS', start: 1, end: 100, qualifiers: { locus_tag: ['b4024'] } } },
        refreshGeneAttachments,
      },
      null,
      { get: vi.fn(async () => ({})), setAndForceSave }
    );

    const first = await manager.registerGeneratedAttachment('b4024', descriptor(), target());
    const duplicate = await manager.registerGeneratedAttachment('b4024', descriptor(), target());

    expect(first).toMatchObject({
      id: 'dgr:task-lysC',
      kind: 'dgr-research-report',
      geneId: 'b4024',
      sha256: 'a'.repeat(64),
      proposalSha256: 'b'.repeat(64),
      citationValidation: expect.objectContaining({ verified: true, factCount: 18 }),
      currentAnnotationValidation: expect.objectContaining({
        verified: true,
        snapshotSha256: 'c'.repeat(64),
        targetFeatureHash: 'hash-1',
      }),
      summary: expect.objectContaining({
        literatureCount: 38,
        directLiteratureCount: 14,
        geneLinkedContextCount: 24,
        citationBoundFactCount: 18,
      }),
    });
    expect(duplicate).toBe(first);
    expect(setAndForceSave).toHaveBeenCalledTimes(1);
    expect(setAndForceSave).toHaveBeenCalledWith(
      '/genomes/ecoli.gbk',
      'geneAttachments',
      expect.objectContaining({ b4024: [expect.objectContaining({ id: 'dgr:task-lysC' })] })
    );
    expect(refreshGeneAttachments).toHaveBeenCalledWith('b4024');

    await expect(manager.openAttachment(first.id, 'b4024')).resolves.toBe(true);
    expect(openDgrJsonViewer).toHaveBeenCalledWith({
      storedPath: descriptor().storedPath,
      expectedSha256: descriptor().sha256,
      title: 'lysC full research report',
    });
  });

  it('rolls back generated attachment metadata when durable sidecar persistence fails', async () => {
    const Manager = loadManager({ electronAPI: { checkFileExists: vi.fn(async () => ({ exists: true })) } });
    const manager = new Manager({ fileManager: { currentFile: { path: '/genomes/ecoli.gbk' } } }, null, {
      get: vi.fn(async () => ({})),
      setAndForceSave: vi.fn(async () => {
        throw new Error('disk unavailable');
      }),
    });

    await expect(manager.registerGeneratedAttachment('b4024', descriptor(), target())).rejects.toThrow(
      'disk unavailable'
    );
    expect(manager.getAttachmentsForGene('b4024')).toEqual([]);
  });

  it('accepts a generated report for a supported non-CDS target', async () => {
    const Manager = loadManager();
    const manager = new Manager(
      { fileManager: { currentFile: { path: '/genomes/ecoli.gbk' } } },
      { get: () => ({}) },
      { get: vi.fn(async () => ({})), setAndForceSave: vi.fn(async () => undefined) }
    );
    await expect(
      manager.registerGeneratedAttachment('b4024', descriptor(), { ...target(), featureType: 'ncRNA' })
    ).resolves.toMatchObject({ target: { featureType: 'ncRNA' } });
  });

  it('rejects a generated report for an unsupported target type', async () => {
    const Manager = loadManager();
    const manager = new Manager({}, { get: () => ({}) });
    await expect(
      manager.registerGeneratedAttachment('b4024', descriptor(), { ...target(), featureType: 'exon' })
    ).rejects.toThrow('supported gene annotation feature');
  });

  it('fails closed for an unsaved genome instead of leaking reports through global metadata', async () => {
    const Manager = loadManager();
    const manager = new Manager({}, null, null);
    await expect(manager.registerGeneratedAttachment('b4024', descriptor(), target())).rejects.toThrow(
      'Save the genome before archiving'
    );
  });
});
