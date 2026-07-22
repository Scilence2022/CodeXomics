/* eslint-disable no-new-func */
import { describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

const CHANGESET_PATH = path.join(process.cwd(), 'src/renderer/modules/chat/services/AnnotationChangeSetService.js');
const ANNOTATION_PATH = path.join(process.cwd(), 'src/renderer/modules/chat/services/AnnotationService.js');

function createService() {
  const mockWindow = {};
  new Function('window', fs.readFileSync(CHANGESET_PATH, 'utf8'))(mockWindow);
  new Function('window', fs.readFileSync(ANNOTATION_PATH, 'utf8'))(mockWindow);
  const sidecar = {};
  const annotations = [
    {
      id: 'gene-b0001',
      type: 'gene',
      start: 100,
      end: 399,
      strand: 1,
      qualifiers: { locus_tag: 'b0001', gene: 'poorA' },
    },
    {
      id: 'cds-b0001',
      type: 'CDS',
      start: 100,
      end: 399,
      strand: 1,
      qualifiers: { locus_tag: 'b0001', gene: 'poorA', product: 'hypothetical protein' },
    },
    {
      id: 'gene-b0002',
      type: 'gene',
      start: 500,
      end: 580,
      strand: -1,
      qualifiers: { locus_tag: 'b0002', gene: 'ffs' },
    },
    {
      id: 'ncrna-b0002',
      type: 'ncRNA',
      start: 500,
      end: 580,
      strand: -1,
      qualifiers: {
        locus_tag: 'b0002',
        gene: 'ffs',
        product: '4.5S RNA component of the signal recognition particle',
        note: 'Directly characterized RNA function [PMID:1]',
        db_xref: ['GeneID:123'],
      },
    },
    {
      id: 'trna-b0003',
      type: 'tRNA',
      start: 700,
      end: 775,
      strand: 1,
      qualifiers: { locus_tag: 'b0003', product: 'tRNA-Leu' },
    },
  ];
  const app = {
    loadedGenomePath: '/tmp/quality.gbk',
    currentChromosome: 'chr1',
    currentAnnotations: { chr1: annotations },
    sidecarManager: {
      get: vi.fn(async (_path, key) => sidecar[key] || {}),
      setAndForceSave: vi.fn(async (_path, key, value) => {
        sidecar[key] = structuredClone(value);
      }),
    },
  };
  return new mockWindow.AnnotationService(app, {
    _getChangeTracker: () => ({ recordChange: () => ({}) }),
  });
}

describe('AnnotationService quality prioritization', () => {
  it('ranks incomplete annotations and collapses co-located records with CDS preference', async () => {
    const service = createService();
    const result = await service.listAnnotationQualityCandidates({ maximumQualityScore: 100, limit: 0 });

    expect(result.total).toBe(3);
    expect(result.candidates[0]).toMatchObject({
      feature: { id: 'cds-b0001', featureType: 'CDS', locusTag: 'b0001' },
      coLocatedFeatureTypes: ['CDS', 'gene'],
      suppressedFeatureIds: ['gene-b0001'],
    });
    expect(result.candidates[0].qualityScore).toBeLessThan(50);
    expect(result.candidates.find(candidate => candidate.feature.id === 'ncrna-b0002').qualityScore).toBe(100);
  });

  it('filters by quality threshold and explains actionable defects', async () => {
    const service = createService();
    const result = await service.listAnnotationQualityCandidates({ maximumQualityScore: 30, limit: 0 });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].reasons.map(reason => reason.code)).toEqual(
      expect.arrayContaining(['generic_product', 'missing_functional_note', 'missing_translation'])
    );
    expect(result.candidates[0].recommendedResearchFocus).toContain('molecular function');
  });

  it('resolves a generic gene record to its co-located ncRNA before assessing quality', async () => {
    const service = createService();
    const result = await service.assessAnnotationQuality({ identifier: 'b0002', chromosome: 'chr1' });

    expect(result.target.featureType).toBe('ncRNA');
    expect(result.assessment.feature.id).toBe('ncrna-b0002');
    expect(result.assessment.recommendedResearchFocus).toEqual(
      expect.arrayContaining(['RNA function', 'RNA processing and structure'])
    );
  });

  it('excludes loci with multiple equally preferred feature records', async () => {
    const service = createService();
    service.app.currentAnnotations.chr1.push({
      id: 'cds-b0001-duplicate',
      type: 'CDS',
      start: 100,
      end: 399,
      strand: 1,
      qualifiers: { locus_tag: 'b0001', gene: 'poorA', product: 'hypothetical protein' },
    });

    const result = await service.listAnnotationQualityCandidates({ limit: 0 });

    expect(result.excludedAmbiguousLoci).toBe(1);
    expect(result.ambiguousLoci[0].featureIds).toEqual(['cds-b0001', 'cds-b0001-duplicate']);
    expect(result.candidates.some(candidate => candidate.feature.locusTag === 'b0001')).toBe(false);
  });

  it('uses the CodeXomics research ledger to exclude active and completed targets', async () => {
    const service = createService();
    service.chatManager.services = {
      annotationWorkflow: {
        getAnnotationResearchCoverageIndex: vi.fn(async () => ({
          refreshDays: null,
          entries: [
            {
              coverageState: 'completed',
              effectiveCovered: true,
              target: { chromosome: 'chr1', locusTag: 'b0001' },
            },
            {
              coverageState: 'active',
              effectiveCovered: true,
              target: { chromosome: 'chr1', locusTag: 'b0003' },
            },
          ],
        })),
        _researchTargetsOverlap(left, right) {
          return (
            String(left.chromosome).toLowerCase() === String(right.chromosome).toLowerCase() &&
            String(left.locusTag).toLowerCase() === String(right.locusTag).toLowerCase()
          );
        },
      },
    };

    const result = await service.listAnnotationQualityCandidates({
      researchHistoryPolicy: 'exclude-covered',
      limit: 0,
    });

    expect(result.excludedByResearchHistory).toBe(2);
    expect(result.candidates.map(candidate => candidate.feature.locusTag)).toEqual(['b0002']);
  });
});
