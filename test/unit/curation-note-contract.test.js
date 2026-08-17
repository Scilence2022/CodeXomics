/* eslint-disable no-new-func */
import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const SERVICE_PATH = path.join(process.cwd(), 'src/renderer/modules/chat/services/AnnotationChangeSetService.js');

function loadService() {
  const mockWindow = {};
  new Function('window', fs.readFileSync(SERVICE_PATH, 'utf8'))(mockWindow);
  return mockWindow.AnnotationChangeSetService;
}

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function authoritativeFixture() {
  const fact = {
    id: 'fact_1',
    category: 'function',
    field: 'product',
    value: 'RHS family protein YlbH',
    statement: 'product: RHS family protein YlbH',
    evidenceIds: ['evidence_1'],
    confidence: 0.9,
    directness: 'exact_target',
    evidenceLevel: 'reviewed_database',
    sourceDatabases: ['uniprot'],
  };
  const researchSummary = {
    schema: 'dgr.curation-summary.v1',
    headline: 'ylbH encodes an RHS family protein.',
    facts: [fact],
    literature: [
      { pmid: '9278503', title: 'The complete genome sequence of Escherichia coli K-12.', relevance: 'high' },
      { pmid: '12234664', title: 'A systematic investigation of probable pseudogenes.', relevance: 'high' },
    ],
    limitations: [],
  };
  const evidenceRecords = [{ id: 'evidence_1', type: 'database', label: 'UniProtKB:P77759 product', supporting: true }];
  return { fact, researchSummary, evidenceRecords };
}

function newContractNote() {
  const { evidenceRecords } = authoritativeFixture();
  const segmentText = 'Product: RHS family protein YlbH.';
  const citations = [
    { kind: 'pmid', id: '9278503', label: 'PMID:9278503', url: 'https://pubmed.ncbi.nlm.nih.gov/9278503/' },
    { kind: 'pmid', id: '12234664', label: 'PMID:12234664', url: 'https://pubmed.ncbi.nlm.nih.gov/12234664/' },
  ];
  const citationText = 'Supporting sources: PMID:9278503. PMID:12234664.';
  const text = `${segmentText} ${citationText}`;
  const note = {
    schema: 'dgr.curation-note.v1',
    text,
    textSha256: sha256(text),
    segments: [
      {
        category: 'function',
        text: segmentText,
        factIds: ['fact_1'],
        evidenceIds: ['evidence_1'],
        citations: [],
      },
    ],
    factIds: ['fact_1'],
    evidenceIds: ['evidence_1'],
    citationText,
    allSourceCitations: citations,
    coverage: {
      availableFactCount: 1,
      includedFactCount: 1,
      includedCategories: ['function'],
      omittedFactIds: [],
      citedSourceCount: 2,
      totalSourceCount: 2,
      omittedCitationLabels: [],
    },
  };
  const claims = [{ id: 'claim_1', field: 'note', value: text, evidenceIds: ['evidence_1'], confidence: 0.9 }];
  const operations = [{ op: 'addQualifier', field: 'note', value: text, claimIds: ['claim_1'] }];
  return { note, claims, operations, evidenceRecords };
}

describe('curation note contract validation', () => {
  it('accepts a new-contract note: authoritative narrative backed by the bibliography clause', async () => {
    const Service = loadService();
    const service = new Service({}, {});
    const { fact, researchSummary, evidenceRecords } = authoritativeFixture();
    const { note, claims, operations } = newContractNote();
    expect(fact.statement).toBeTruthy();

    const validated = await service._validateCurationNote(note, researchSummary, evidenceRecords, claims, operations);
    expect(validated.text).toBe(note.text);
    expect(validated.allSourceCitations).toHaveLength(2);
  });

  it('rejects a note with neither literature segments nor a bibliography clause', async () => {
    const Service = loadService();
    const service = new Service({}, {});
    const { researchSummary, evidenceRecords } = authoritativeFixture();
    const { note, claims, operations } = newContractNote();
    delete note.citationText;
    delete note.allSourceCitations;
    note.coverage.citedSourceCount = undefined;
    note.coverage.totalSourceCount = undefined;
    const text = note.segments[0].text;
    note.text = text;
    note.textSha256 = sha256(text);
    claims[0].value = text;
    operations[0].value = text;

    await expect(
      service._validateCurationNote(note, researchSummary, evidenceRecords, claims, operations)
    ).rejects.toThrow('must include citation-bound literature');
  });

  it('rejects a bibliography clause citing a PMID outside the research summary literature', async () => {
    const Service = loadService();
    const service = new Service({}, {});
    const { researchSummary, evidenceRecords } = authoritativeFixture();
    const { note, claims, operations } = newContractNote();
    note.allSourceCitations[1] = {
      kind: 'pmid',
      id: '99999999',
      label: 'PMID:99999999',
      url: 'https://pubmed.ncbi.nlm.nih.gov/99999999/',
    };

    await expect(
      service._validateCurationNote(note, researchSummary, evidenceRecords, claims, operations)
    ).rejects.toThrow('must include citation-bound literature');
  });

  it('rejects a tampered citation clause that no longer matches the text hash chain', async () => {
    const Service = loadService();
    const service = new Service({}, {});
    const { researchSummary, evidenceRecords } = authoritativeFixture();
    const { note, claims, operations } = newContractNote();
    // Swap the clause order: citationText no longer equals the rebuilt clause.
    note.citationText = 'Supporting sources: PMID:12234664. PMID:9278503.';

    await expect(
      service._validateCurationNote(note, researchSummary, evidenceRecords, claims, operations)
    ).rejects.toThrow('must include citation-bound literature');
  });

  it('still accepts an old-contract note with a direct literature segment and no clause', async () => {
    const Service = loadService();
    const service = new Service({}, {});
    const literatureAbstract = 'In Escherichia coli, lysC expression is repressed by lysine.';
    const fact = {
      id: 'fact_1',
      category: 'regulation',
      field: 'literature_finding',
      value: literatureAbstract,
      statement: literatureAbstract,
      evidenceIds: ['evidence_1'],
      confidence: null,
      directness: 'exact_target',
      evidenceLevel: 'target_literature',
      sourceDatabases: ['pubmed'],
      citation: {
        type: 'pmid',
        id: '38253429',
        label: 'PMID:38253429',
        url: 'https://pubmed.ncbi.nlm.nih.gov/38253429/',
      },
    };
    const researchSummary = {
      schema: 'dgr.curation-summary.v1',
      headline: 'lysC regulation summary.',
      facts: [fact],
      literature: [{ pmid: '38253429', title: 'Direct control of the lysC riboswitch.' }],
      limitations: [],
    };
    const evidenceRecords = [{ id: 'evidence_1', type: 'pmid', label: 'PMID:38253429', supporting: true }];
    const segmentText = 'In Escherichia coli, lysC expression is repressed by lysine.';
    const text = `${segmentText} (PMID:38253429).`;
    const note = {
      schema: 'dgr.curation-note.v1',
      text,
      textSha256: sha256(text),
      segments: [
        {
          category: 'regulation',
          text,
          factIds: ['fact_1'],
          evidenceIds: ['evidence_1'],
          citations: [
            { type: 'pmid', id: '38253429', label: 'PMID:38253429', url: 'https://pubmed.ncbi.nlm.nih.gov/38253429/' },
          ],
        },
      ],
      factIds: ['fact_1'],
      evidenceIds: ['evidence_1'],
      coverage: {
        availableFactCount: 1,
        includedFactCount: 1,
        includedCategories: ['regulation'],
        omittedFactIds: [],
      },
    };
    const claims = [{ id: 'claim_1', field: 'note', value: text, evidenceIds: ['evidence_1'], confidence: null }];
    const operations = [{ op: 'addQualifier', field: 'note', value: text, claimIds: ['claim_1'] }];

    const validated = await service._validateCurationNote(note, researchSummary, evidenceRecords, claims, operations);
    expect(validated.text).toBe(text);
  });
});
