/* eslint-disable no-new-func */
/**
 * A DGR proposal is a structured, citation-verified artifact. When a model
 * retyped one into a `create_annotation_changeset` call instead of forwarding
 * it, three things went wrong in sequence — a transcribed featureId that bound
 * to nothing, an invented `ec_number` qualifier, an unwritable `geneSymbol` —
 * and a fourth, worse one silently: because the archived-report verification
 * keyed off the proposal's own shape, paraphrasing it away turned the entire
 * citation and archive chain off without a word.
 *
 * These cover the stored snapshot being authoritative, the verification gate
 * keying off the research run rather than the payload shape, and the error
 * messages that should have made the first three self-correcting.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const CHANGESET_PATH = path.join(process.cwd(), 'src/renderer/modules/chat/services/AnnotationChangeSetService.js');
const ANNOTATION_PATH = path.join(process.cwd(), 'src/renderer/modules/chat/services/AnnotationService.js');

function loadServices() {
  const mockWindow = {};
  new Function('window', fs.readFileSync(CHANGESET_PATH, 'utf8'))(mockWindow);
  new Function('window', fs.readFileSync(ANNOTATION_PATH, 'utf8'))(mockWindow);
  return mockWindow;
}

const agentContext = {
  authenticated: true,
  source: 'mcp',
  principal: 'research-agent',
  permissions: ['annotation:propose'],
};

describe('annotation ChangeSet research binding', () => {
  let mockWindow;
  let annotationService;
  let storedProposals;

  beforeEach(() => {
    mockWindow = loadServices();
    const sidecarData = {};
    storedProposals = new Map();

    const annotation = {
      id: 'feature-1',
      type: 'CDS',
      start: 12,
      end: 120,
      strand: 1,
      qualifiers: { locus_tag: 'b0001', gene: 'thrL', product: 'hypothetical protein' },
    };
    const app = {
      loadedGenomePath: '/tmp/test.gbk',
      currentChromosome: 'NC_000913.3',
      currentAnnotations: { 'NC_000913.3': [annotation] },
      sidecarManager: {
        get: async (_genomePath, key) => JSON.parse(JSON.stringify(sidecarData[key] || {})),
        setAndForceSave: async (_genomePath, key, value) => {
          sidecarData[key] = JSON.parse(JSON.stringify(value));
        },
      },
    };
    const chatManager = {
      _getChangeTracker: () => ({ recordChange: () => ({}) }),
      services: {
        annotationWorkflow: {
          getStoredResearchProposal: async taskId =>
            storedProposals.has(taskId)
              ? { exists: true, proposal: storedProposals.get(taskId) }
              : { exists: false, proposal: null },
        },
      },
    };
    annotationService = new mockWindow.AnnotationService(app, chatManager);
  });

  const create = params =>
    annotationService.createAnnotationChangeset({
      identifier: 'b0001',
      principal: 'research-agent',
      __executionContext: agentContext,
      ...params,
    });

  describe('writable field vocabulary', () => {
    it('accepts the lower-case spelling of EC_number in the updates map', async () => {
      const created = await create({
        updates: { ec_number: ['1.1.1.1'] },
        evidence: ['PMID:12345678'],
        idempotencyKey: 'ec-lowercase',
      });

      const fields = created.changeSet.operations.map(operation => operation.field);
      expect(fields).toContain('EC_number');
      expect(fields).not.toContain('ec_number');
    });

    it('keeps an explicit operation list strict', async () => {
      // An operations array names its target qualifier deliberately; only the
      // free-form updates map is forgiving about case.
      await expect(
        create({
          operations: [{ op: 'addQualifier', field: 'ec_number', value: ['1.1.1.1'] }],
          evidence: ['PMID:12345678'],
          idempotencyKey: 'ec-strict',
        })
      ).rejects.toThrow(/not writable/);
    });

    it('names the writable vocabulary and the intended field when it rejects one', async () => {
      const error = await create({
        operations: [{ op: 'addQualifier', field: 'ec_number', value: ['1.1.1.1'] }],
        evidence: ['PMID:12345678'],
        idempotencyKey: 'ec-message',
      }).catch(caught => caught);

      expect(error.message).toContain('did you mean "EC_number"');
      expect(error.message).toContain('Writable fields:');
      expect(error.message).toContain('go_terms');
    });

    it('still refuses a field that is not writable at all', async () => {
      const error = await create({
        updates: { geneSymbol: 'thrL' },
        evidence: ['PMID:12345678'],
        idempotencyKey: 'gene-symbol',
      }).catch(caught => caught);

      expect(error.message).toContain('"geneSymbol" is not writable');
      expect(error.message).not.toContain('did you mean');
      expect(error.message).toContain('Writable fields:');
    });
  });

  describe('proposal target mismatch', () => {
    it('reports both the proposed and the resolved value', async () => {
      const error = await create({
        annotationProposal: {
          target: { featureId: 'feat_something_else', locusTag: 'b0001' },
          updates: { note: 'x' },
        },
        evidence: ['PMID:12345678'],
        idempotencyKey: 'target-mismatch',
      }).catch(caught => caught);

      expect(error.message).toContain('feat_something_else');
      expect(error.message).toMatch(/resolved CDS: feat_[a-f0-9]{64}/);
    });
  });

  describe('stored research proposal is authoritative', () => {
    it('rejects a proposal that does not match the archived one', async () => {
      storedProposals.set('task-1', { updates: { note: 'archived text' } });

      const error = await create({
        researchRun: 'task-1',
        annotationProposal: { updates: { note: 'text the model retyped' } },
        evidence: ['PMID:12345678'],
        idempotencyKey: 'paraphrased',
      }).catch(caught => caught);

      expect(error.message).toContain('already holds a verified annotation proposal');
      expect(error.message).toContain('Pass only researchRun');
    });

    it('derives operations from the archived proposal, not the request', () => {
      const service = annotationService.changeSetService;
      const stored = { updates: { note: 'archived text' } };

      const operations = service._proposalToOperations(
        { annotationProposal: { updates: { note: 'retyped text' } } },
        stored
      );

      expect(operations).toEqual([{ op: 'addQualifier', field: 'note', value: 'archived text' }]);
    });

    it('prefers a v2 archived proposal operation list over anything in the request', () => {
      const service = annotationService.changeSetService;
      const stored = {
        schema: 'codexomics.annotation-change-set.v2',
        operations: [{ op: 'replaceQualifier', field: 'product', value: 'archived product' }],
      };

      const operations = service._proposalToOperations(
        { operations: [{ op: 'addQualifier', field: 'note', value: 'retyped' }] },
        stored
      );

      expect(operations).toEqual([{ op: 'replaceQualifier', field: 'product', value: 'archived product' }]);
    });
  });

  describe('archived-report verification gate', () => {
    it('demands the archive when researchRun names a real task, whatever the payload looks like', async () => {
      // Previously this returned null unless the proposal itself carried
      // researchSummary.schema, so dropping that one field skipped the whole
      // citation and archive chain in silence.
      storedProposals.set('task-2', null);

      const error = await create({
        researchRun: 'task-2',
        updates: { note: 'text' },
        evidence: ['PMID:12345678'],
        idempotencyKey: 'gate-fires',
      }).catch(caught => caught);

      expect(error.message).toMatch(/report attachment store|Archive DGR research task/);
    });

    it('leaves a synthetic run id that names no research task alone', async () => {
      const created = await create({
        researchRun: 'rollback:changeset-123',
        updates: { note: 'text' },
        evidence: ['PMID:12345678'],
        idempotencyKey: 'synthetic-run',
      });

      expect(created.changeSet.researchRun).toBe('rollback:changeset-123');
    });
  });
});
