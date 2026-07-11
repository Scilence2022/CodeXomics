/* eslint-disable no-new-func */
import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const CHANGESET_PATH = path.join(process.cwd(), 'src/renderer/modules/chat/services/AnnotationChangeSetService.js');
const ANNOTATION_PATH = path.join(process.cwd(), 'src/renderer/modules/chat/services/AnnotationService.js');

function loadServices() {
  const mockWindow = {};
  const changeSetCode = fs.readFileSync(CHANGESET_PATH, 'utf8');
  new Function('window', changeSetCode)(mockWindow);
  const annotationCode = fs.readFileSync(ANNOTATION_PATH, 'utf8');
  new Function('window', annotationCode)(mockWindow);
  return mockWindow;
}

describe('AnnotationChangeSetService', () => {
  let annotationService;
  let annotation;

  beforeEach(() => {
    const mockWindow = loadServices();
    annotation = {
      id: 'feature-1',
      type: 'CDS',
      start: 12,
      end: 120,
      strand: 1,
      qualifiers: { locus_tag: 'b0001', gene: 'thrL', product: 'hypothetical protein' },
    };
    const app = {
      currentChromosome: 'NC_000913.3',
      currentAnnotations: { 'NC_000913.3': [annotation] },
    };
    const chatManager = {
      _getChangeTracker: () => ({ recordChange: () => ({}) }),
    };
    annotationService = new mockWindow.AnnotationService(app, chatManager);
  });

  it('creates, approves, and atomically commits a constrained qualifier ChangeSet', async () => {
    const target = await annotationService.resolveAnnotationTarget({ identifier: 'b0001' });
    const created = await annotationService.createAnnotationChangeset({
      identifier: 'b0001',
      baseRevision: target.target.annotationRevision,
      operations: [{ op: 'addQualifier', field: 'go_terms', value: ['GO:0003674'] }],
      evidence: ['PMID:12345678'],
      principal: 'research-agent',
      idempotencyKey: 'test-thrL-go',
    });

    await expect(
      annotationService.requestAnnotationApproval({ changeSetId: created.changeSet.id, approver: 'research-agent' })
    ).rejects.toThrow('cannot self-approve');

    const approval = await annotationService.requestAnnotationApproval({
      changeSetId: created.changeSet.id,
      approver: 'curator@example.org',
    });
    const committed = await annotationService.applyAnnotationChangeset({
      changeSetId: created.changeSet.id,
      approvalToken: approval.approvalToken,
    });

    expect(committed.applied).toBe(true);
    expect(annotation.qualifiers.go_terms).toBe('GO:0003674');
    expect(committed.receipt.revision).toBe(1);
  });

  it('rejects structural annotation changes from research proposals', async () => {
    await expect(
      annotationService.createAnnotationChangeset({
        identifier: 'b0001',
        operations: [{ op: 'replaceQualifier', field: 'start', value: 1 }],
      })
    ).rejects.toThrow('not writable');
  });

  it('refuses a commit when the reviewed feature changed after ChangeSet creation', async () => {
    const created = await annotationService.createAnnotationChangeset({
      identifier: 'b0001',
      operations: [{ op: 'addQualifier', field: 'note', value: 'Research-backed note' }],
      principal: 'research-agent',
    });
    const approval = await annotationService.requestAnnotationApproval({
      changeSetId: created.changeSet.id,
      approver: 'curator@example.org',
    });
    annotation.qualifiers.product = 'human edit after preview';

    await expect(
      annotationService.applyAnnotationChangeset({
        changeSetId: created.changeSet.id,
        approvalToken: approval.approvalToken,
      })
    ).rejects.toThrow('target has changed');
  });
});
