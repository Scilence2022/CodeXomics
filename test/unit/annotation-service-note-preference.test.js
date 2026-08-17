/* eslint-disable no-new-func */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SERVICE_PATH = path.join(process.cwd(), 'src/renderer/modules/chat/services/AnnotationService.js');

function loadAnnotationService() {
  const mockWindow = {};
  new Function('window', fs.readFileSync(SERVICE_PATH, 'utf8'))(mockWindow);
  return mockWindow.AnnotationService;
}

function annotationWithNote() {
  return {
    qualifiers: {
      product: ['hypothetical protein'],
      note: ['existing curator note'],
    },
  };
}

function dgrProposal() {
  return {
    summary: 'Generic summary derived from the report text.',
    evidence: ['PMID:38253429'],
    updates: { note: 'lysC expression is repressed by lysine (PMID:38253429).' },
    curationNote: {
      schema: 'dgr.curation-note.v1',
      text: 'lysC expression is repressed by lysine (PMID:38253429).',
      textSha256: 'c'.repeat(64),
      segments: [],
      factIds: [],
      evidenceIds: [],
      coverage: { availableFactCount: 3, includedFactCount: 1, includedCategories: ['regulation'], omittedFactIds: [] },
    },
    ecNumbers: [],
    goTerms: [],
    koTerms: [],
    pathwayTerms: [],
    dbXrefs: [],
    reportUrl: null,
    detailsUrl: null,
  };
}

describe('AnnotationService DGR note preference', () => {
  it('preserves curationNote through proposal normalization', () => {
    const AnnotationService = loadAnnotationService();
    const service = new AnnotationService({}, {});
    const normalized = service._normalizeAnnotationProposal(dgrProposal(), '', [], { identifier: 'lysC' });

    expect(normalized.curationNote).toMatchObject({
      schema: 'dgr.curation-note.v1',
      text: expect.stringContaining('PMID:38253429'),
    });
    expect(normalized.updates.note).toContain('PMID:38253429');
  });

  it('prefers the citation-bound DGR note over the generic summary-derived note', () => {
    const AnnotationService = loadAnnotationService();
    const service = new AnnotationService({}, {});
    const proposal = dgrProposal();
    const updates = service._buildDeepResearchUpdates(annotationWithNote(), proposal, {});

    // The DGR note text must survive verbatim; the generic
    // "Deep Gene Research (<date>): ..." fallback must not replace it.
    expect(updates.note).toEqual(['existing curator note', 'lysC expression is repressed by lysine (PMID:38253429).']);
  });

  it('falls back to the generic summary note when DGR produced no curation note', () => {
    const AnnotationService = loadAnnotationService();
    const service = new AnnotationService({}, {});
    const proposal = { ...dgrProposal(), curationNote: null, updates: {} };
    const updates = service._buildDeepResearchUpdates(annotationWithNote(), proposal, {});

    expect(updates.note).toEqual(expect.arrayContaining([expect.stringContaining('Deep Gene Research (')]));
  });
});
