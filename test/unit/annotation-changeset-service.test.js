/* eslint-disable no-new-func */
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

async function legacyRawHash(value) {
  const input = JSON.stringify(value);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256Text(value) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

function legacyScalar(value) {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

async function legacyFeatureTarget(annotation, genomePath, chromosome, revision = 0) {
  const qualifiers = annotation.qualifiers || {};
  const locusTag = legacyScalar(qualifiers.locus_tag);
  const geneSymbol = legacyScalar(qualifiers.gene);
  const proteinId = legacyScalar(qualifiers.protein_id);
  const stableInput = {
    chromosome,
    id: annotation.id || null,
    locusTag,
    proteinId,
    start: annotation.start,
    end: annotation.end,
    strand: annotation.strand,
    type: annotation.type,
  };
  const featureId = annotation.codexomicsFeatureId || `feat_${await legacyRawHash(stableInput)}`;
  const featureHash = await legacyRawHash({
    ...stableInput,
    qualifiers,
  });
  const genomeHash = await legacyRawHash(genomePath);
  return {
    workspaceId: `ws_${genomeHash}`,
    genomeId: `genome_${genomeHash}`,
    annotationRevision: revision,
    featureId,
    featureHash,
    chromosome,
    locusTag: locusTag || null,
    geneSymbol: geneSymbol || null,
    proteinId: proteinId || null,
    coordinates: {
      start: annotation.start,
      end: annotation.end,
      strand: annotation.strand,
    },
    featureType: annotation.type || null,
  };
}

function applyLegacyOperation(annotation, operation) {
  if (!annotation.qualifiers) annotation.qualifiers = {};
  const oldValue = annotation.qualifiers[operation.field];
  if (operation.op === 'removeQualifier') {
    delete annotation.qualifiers[operation.field];
  } else if (operation.op === 'replaceQualifier') {
    annotation.qualifiers[operation.field] = Array.isArray(operation.value) ? [...operation.value] : operation.value;
  } else {
    const normalize = value =>
      (Array.isArray(value) ? value : [value])
        .filter(item => item !== undefined && item !== null)
        .map(item => String(item).trim())
        .filter(Boolean);
    const merged = [];
    const seen = new Set();
    for (const value of [...normalize(oldValue), ...normalize(operation.value)]) {
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(value);
    }
    annotation.qualifiers[operation.field] = merged.length === 1 ? merged[0] : merged;
  }
  return oldValue;
}

async function buildLiteralLegacyV2Fixture({
  annotation,
  genomePath = '/tmp/legacy.gbk',
  chromosome = 'NC_000913.3',
  status = 'awaiting_approval',
} = {}) {
  const preState = JSON.parse(JSON.stringify(annotation));
  const target = await legacyFeatureTarget(preState, genomePath, chromosome, 0);
  const operation = { op: 'addQualifier', field: 'note', value: 'legacy reviewed note' };
  const changeSet = {
    schema: 'codexomics.annotation-change-set.v2',
    id: 'cs_legacy_v2',
    status: 'awaiting_approval',
    createdAt: '2026-01-02T03:04:05.000Z',
    createdBy: 'legacy-research-agent',
    idempotencyKey: 'legacy-v2-request',
    baseRevision: 0,
    target,
    evidence: ['PMID:12345678'],
    researchRun: 'legacy-run-1',
    manifestHash: null,
    operations: [operation],
    riskLevel: 'low',
    requiresHumanApproval: true,
    validation: {
      valid: true,
      checkedAt: '2026-01-02T03:04:05.000Z',
      allowedFields: ['note'],
    },
  };
  changeSet.changeSetHash = await legacyRawHash({ ...changeSet, changeSetHash: undefined });

  const approvals = {};
  const committedIdempotencyKeys = {};
  const audit = [
    {
      id: 'audit_legacy_created',
      event: 'changeset_created',
      changeSetId: changeSet.id,
      principal: changeSet.createdBy,
      timestamp: changeSet.createdAt,
      target,
    },
  ];
  let approval = null;
  let postState = null;
  if (status === 'approved' || status === 'stale' || status === 'committed') {
    approval = {
      id: 'approval_legacy_v2',
      changeSetId: changeSet.id,
      changeSetHash: changeSet.changeSetHash,
      baseRevision: changeSet.baseRevision,
      approver: 'legacy-curator@example.org',
      approvedAt: '2026-01-02T04:00:00.000Z',
      expiresAt: '2036-01-02T04:30:00.000Z',
      token: 'cap_legacy_plaintext_secret',
    };
    approvals[approval.id] = approval;
    changeSet.status = 'approved';
    changeSet.approvalId = approval.id;
    audit.push({
      id: 'audit_legacy_approved',
      event: 'changeset_approved',
      changeSetId: changeSet.id,
      principal: approval.approver,
      timestamp: approval.approvedAt,
    });
    if (status === 'stale') changeSet.status = 'stale';
  }
  let revision = 0;
  if (status === 'committed') {
    postState = JSON.parse(JSON.stringify(preState));
    const oldValue = applyLegacyOperation(postState, operation);
    const receipt = {
      id: 'commit_legacy_v2',
      changeSetId: changeSet.id,
      committedAt: '2026-01-02T04:05:00.000Z',
      principal: approval.approver,
      previousRevision: 0,
      revision: 1,
      target,
      appliedOperations: [{ ...operation, oldValue }],
      evidence: changeSet.evidence,
      manifestHash: changeSet.manifestHash,
    };
    receipt.receiptHash = await legacyRawHash(receipt);
    changeSet.status = 'committed';
    changeSet.commitReceipt = receipt;
    committedIdempotencyKeys[changeSet.idempotencyKey] = receipt;
    revision = 1;
    audit.push({
      id: 'audit_legacy_committed',
      event: 'changeset_committed',
      changeSetId: changeSet.id,
      principal: approval.approver,
      timestamp: receipt.committedAt,
      receiptId: receipt.id,
    });
  }
  const changeSets = { [changeSet.id]: changeSet };
  return {
    changeSetId: changeSet.id,
    approvalId: approval?.id || null,
    preState,
    postState,
    legacyChangeSetHash: changeSet.changeSetHash,
    ledger: {
      schema: 'codexomics.annotation-ledger.v2',
      revision,
      changeSets,
      approvals,
      audit,
      committedIdempotencyKeys,
      createdAt: '2026-01-02T03:00:00.000Z',
      updatedAt: '2026-01-02T04:05:00.000Z',
    },
  };
}

function createLegacyFixtureService({ ledger, liveAnnotation, genomePath = '/tmp/legacy.gbk', onSave } = {}) {
  const mockWindow = loadServices();
  let storedLedger = JSON.parse(JSON.stringify(ledger));
  const setAndForceSave = vi.fn(async (_path, _key, value) => {
    if (onSave) onSave(value);
    storedLedger = JSON.parse(JSON.stringify(value));
  });
  const app = {
    loadedGenomePath: genomePath,
    currentFile: { path: genomePath },
    currentChromosome: 'NC_000913.3',
    currentAnnotations: { 'NC_000913.3': [liveAnnotation] },
    sidecarManager: {
      get: vi.fn(async () => JSON.parse(JSON.stringify(storedLedger))),
      setAndForceSave,
    },
  };
  const service = new mockWindow.AnnotationService(app, {
    _getChangeTracker: () => ({ recordChange: () => ({}) }),
  });
  return { service, app, setAndForceSave, getStoredLedger: () => storedLedger };
}

describe('AnnotationChangeSetService', () => {
  let annotationService;
  let annotation;
  const agentContext = {
    authenticated: true,
    source: 'mcp',
    principal: 'research-agent',
    permissions: ['annotation:propose'],
  };
  const curatorContext = {
    authenticated: true,
    source: 'mcp',
    principal: 'curator@example.org',
    permissions: ['annotation:approve', 'annotation:commit'],
  };

  beforeEach(() => {
    const mockWindow = loadServices();
    const sidecarData = {};
    annotation = {
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
      _sidecarData: sidecarData,
    };
    const chatManager = {
      _getChangeTracker: () => ({ recordChange: () => ({}) }),
    };
    annotationService = new mockWindow.AnnotationService(app, chatManager);
  });

  it('prefers the CDS when a GenBank gene/CDS pair shares a locus tag', async () => {
    annotationService.app.currentAnnotations['NC_000913.3'].unshift({
      id: 'gene-1',
      type: 'gene',
      start: 12,
      end: 120,
      strand: 1,
      qualifiers: { locus_tag: 'b0001', gene: 'thrL' },
    });

    const resolved = await annotationService.resolveAnnotationTarget({ identifier: 'b0001' });

    expect(resolved.annotation.id).toBe('feature-1');
    expect(resolved.target.featureType).toBe('CDS');
  });

  it('creates, approves, and atomically commits a constrained qualifier ChangeSet', async () => {
    const target = await annotationService.resolveAnnotationTarget({ identifier: 'b0001' });
    const created = await annotationService.createAnnotationChangeset({
      identifier: 'b0001',
      baseRevision: target.target.annotationRevision,
      operations: [{ op: 'addQualifier', field: 'go_terms', value: ['GO:0003674'] }],
      evidence: ['PMID:12345678'],
      principal: 'research-agent',
      __executionContext: agentContext,
      idempotencyKey: 'test-thrL-go',
    });

    await expect(
      annotationService.requestAnnotationApproval({
        changeSetId: created.changeSet.id,
        __executionContext: { ...curatorContext, principal: 'research-agent' },
      })
    ).rejects.toThrow('cannot self-approve');

    const approval = await annotationService.requestAnnotationApproval({
      changeSetId: created.changeSet.id,
      __executionContext: curatorContext,
    });
    const committed = await annotationService.applyAnnotationChangeset({
      changeSetId: created.changeSet.id,
      approvalToken: approval.approvalToken,
      __executionContext: curatorContext,
    });

    expect(committed.applied).toBe(true);
    expect(annotation.qualifiers.go_terms).toBe('GO:0003674');
    expect(committed.receipt.revision).toBe(1);
  });

  it('lists lightweight ChangeSet summaries for filtered batch review without approval secrets', async () => {
    const first = await annotationService.createAnnotationChangeset({
      identifier: 'b0001',
      operations: [{ op: 'addQualifier', field: 'note', value: 'reviewed regulatory summary' }],
      evidence: ['PMID:12345678'],
      principal: 'research-agent',
      __executionContext: agentContext,
      idempotencyKey: 'review-queue-first',
    });
    const approval = await annotationService.requestAnnotationApproval({
      changeSetId: first.changeSet.id,
      __executionContext: curatorContext,
    });

    const result = await annotationService.listAnnotationChangesets({
      statuses: ['approved'],
      query: 'thrL',
      __executionContext: { ...curatorContext, permissions: ['annotation:read'] },
    });

    expect(result.total).toBe(1);
    expect(result.statusCounts.approved).toBe(1);
    expect(result.changeSets[0]).toMatchObject({
      id: first.changeSet.id,
      status: 'approved',
      operationCount: 1,
      fields: ['note'],
      evidenceCount: 1,
      targetAvailable: true,
      approval: {
        approver: 'curator@example.org',
      },
    });
    expect(result.changeSets[0].preview[0]).toMatchObject({
      field: 'note',
      before: null,
      after: 'reviewed regulatory summary',
    });
    expect(result.changeSets[0].approval).not.toHaveProperty('tokenHash');
    expect(JSON.stringify(result)).not.toContain(approval.approvalToken);
    expect(result.changeSets[0]).not.toHaveProperty('evidenceManifest');
  });

  it('bounds and deduplicates queue previews while full ChangeSets remain available separately', async () => {
    const longNote = `Evidence-backed summary: ${'x'.repeat(1200)}`;
    const created = await annotationService.createAnnotationChangeset({
      identifier: 'b0001',
      operations: [
        { op: 'addQualifier', field: 'note', value: longNote },
        { op: 'addQualifier', field: 'note', value: 'second note operation' },
      ],
      evidence: ['PMID:12345678'],
      principal: 'research-agent',
      __executionContext: agentContext,
      idempotencyKey: 'review-queue-bounded-preview',
    });

    const result = await annotationService.listAnnotationChangesets({
      statuses: ['awaiting_approval'],
      query: 'thrL',
      __executionContext: { ...curatorContext, permissions: ['annotation:read'] },
    });
    const full = await annotationService.getAnnotationChangeset({
      changeSetId: created.changeSet.id,
      __executionContext: { ...curatorContext, permissions: ['annotation:read'] },
    });

    expect(result.changeSets[0].preview).toHaveLength(1);
    expect(result.changeSets[0].preview[0].previewTruncated).toBe(true);
    expect(result.changeSets[0].preview[0].after.length).toBeLessThanOrEqual(240);
    expect(JSON.stringify(result)).not.toContain(longNote);
    expect(full.changeSet.operations[0].value).toBe(longNote);
  });

  it('refuses approval when the genome has no durable sidecar ledger', async () => {
    const mockWindow = loadServices();
    const unsavedService = new mockWindow.AnnotationService(
      {
        currentChromosome: 'chr1',
        currentAnnotations: {
          chr1: [
            {
              id: 'unsaved-1',
              type: 'CDS',
              start: 1,
              end: 9,
              strand: 1,
              qualifiers: { locus_tag: 'unsaved1' },
            },
          ],
        },
      },
      { _getChangeTracker: () => ({ recordChange: () => ({}) }) }
    );
    const created = await unsavedService.createAnnotationChangeset({
      identifier: 'unsaved1',
      operations: [{ op: 'addQualifier', field: 'note', value: 'pending only' }],
      __executionContext: agentContext,
    });

    await expect(
      unsavedService.requestAnnotationApproval({
        changeSetId: created.changeSet.id,
        __executionContext: curatorContext,
      })
    ).rejects.toThrow('durable sidecar persistence');
  });

  it('requires evidence for scientific qualifiers and bounds untrusted proposal cardinality', async () => {
    await expect(
      annotationService.createAnnotationChangeset({
        identifier: 'b0001',
        operations: [{ op: 'addQualifier', field: 'go_terms', value: 'GO:0003674' }],
        __executionContext: agentContext,
      })
    ).rejects.toThrow('require at least one bounded evidence reference');

    await expect(
      annotationService.createAnnotationChangeset({
        identifier: 'b0001',
        operations: Array.from({ length: 101 }, (_value, index) => ({
          op: 'addQualifier',
          field: 'note',
          value: `bounded-${index}`,
        })),
        __executionContext: agentContext,
      })
    ).rejects.toThrow('maximum of 100 operations');
  });

  it('rejects all-no-op qualifier proposals and prunes no-ops from mixed ChangeSets', async () => {
    annotation.qualifiers.go_terms = ['GO:0003674'];
    annotation.qualifiers.db_xref = 'GeneID:123';
    await expect(
      annotationService.createAnnotationChangeset({
        identifier: 'b0001',
        operations: [{ op: 'addQualifier', field: 'go_terms', value: 'GO:0003674' }],
        evidence: ['PMID:12345678'],
        __executionContext: agentContext,
      })
    ).rejects.toThrow('no effective annotation changes');

    const created = await annotationService.createAnnotationChangeset({
      identifier: 'b0001',
      operations: [
        { op: 'addQualifier', field: 'go_terms', value: 'GO:0003674' },
        { op: 'addDbxref', field: 'db_xref', value: 'GeneID:456' },
      ],
      evidence: ['PMID:12345678'],
      __executionContext: agentContext,
    });
    expect(created.changeSet.operations).toEqual([
      expect.objectContaining({ op: 'addDbxref', field: 'db_xref', value: 'GeneID:456' }),
    ]);
  });

  it('bounds durable ledger growth and outstanding proposals per authenticated principal', async () => {
    const limits = annotationService.changeSetService.ledgerLimits;
    annotationService.changeSetService.ledgerLimits = { ...limits, pendingChangeSetsPerPrincipal: 1 };
    const first = await annotationService.createAnnotationChangeset({
      identifier: 'b0001',
      operations: [{ op: 'addQualifier', field: 'note', value: 'first pending review' }],
      idempotencyKey: 'pending-limit-1',
      __executionContext: agentContext,
    });
    await expect(
      annotationService.createAnnotationChangeset({
        identifier: 'b0001',
        operations: [{ op: 'addQualifier', field: 'note', value: 'second pending review' }],
        idempotencyKey: 'pending-limit-2',
        __executionContext: agentContext,
      })
    ).rejects.toThrow('pending annotation ChangeSets');

    await expect(
      annotationService.rejectAnnotationChangeset({
        changeSetId: first.changeSet.id,
        reason: 'research agent cannot reject its own queue',
        __executionContext: agentContext,
      })
    ).rejects.toThrow('annotation:approve');
    const rejected = await annotationService.rejectAnnotationChangeset({
      changeSetId: first.changeSet.id,
      reason: 'insufficient evidence quality',
      __executionContext: curatorContext,
    });
    expect(rejected.changeSet).toMatchObject({
      status: 'rejected',
      rejectedBy: curatorContext.principal,
      rejectionReason: 'insufficient evidence quality',
    });
    await expect(
      annotationService.createAnnotationChangeset({
        identifier: 'b0001',
        operations: [{ op: 'addQualifier', field: 'note', value: 'replacement pending review' }],
        idempotencyKey: 'pending-limit-3',
        __executionContext: agentContext,
      })
    ).resolves.toMatchObject({ success: true });

    annotationService.changeSetService.ledgerLimits = { ...limits, changeSets: 0 };
    await expect(annotationService.getAnnotationAudit({})).rejects.toThrow('retention limit');
  });

  it('rejects structural annotation changes from research proposals', async () => {
    await expect(
      annotationService.createAnnotationChangeset({
        identifier: 'b0001',
        operations: [{ op: 'replaceQualifier', field: 'start', value: 1 }],
      })
    ).rejects.toThrow('not writable');
  });

  it('executes raw structural edit and batch creation only with the exact MCP scope', async () => {
    const approveOnlyContext = {
      authenticated: true,
      source: 'mcp',
      principal: 'approval-only-curator',
      permissions: ['annotation:approve'],
    };
    const structuralContext = {
      authenticated: true,
      source: 'mcp',
      principal: 'structural-curator',
      permissions: ['annotation:structural'],
    };
    const recordMultiFieldUpdate = vi.fn();
    annotationService.chatManager._getChangeTracker = () => ({ recordMultiFieldUpdate });

    await expect(
      annotationService.editAnnotation({
        annotationId: 'feature-1',
        updates: { start: 20, end: 140, strand: -1 },
        __executionContext: approveOnlyContext,
      })
    ).rejects.toThrow('annotation:structural');
    await expect(
      annotationService.batchCreateAnnotations({
        chromosome: 'NC_000913.3',
        annotations: [{ type: 'gene', start: 200, end: 260 }],
        __executionContext: approveOnlyContext,
      })
    ).rejects.toThrow('annotation:structural');
    expect(annotation.start).toBe(12);
    expect(annotationService.app.currentAnnotations['NC_000913.3']).toHaveLength(1);

    await expect(
      annotationService.editAnnotation({
        annotationId: 'feature-1',
        updates: { start: 20, end: 140, strand: -1 },
        __executionContext: structuralContext,
      })
    ).resolves.toMatchObject({ success: true, annotationId: 'feature-1' });
    expect(annotation).toMatchObject({ start: 20, end: 140, strand: -1 });
    expect(recordMultiFieldUpdate).toHaveBeenCalledWith(
      'feature-1',
      'NC_000913.3',
      { start: 20, end: 140, strand: -1 },
      { start: 12, end: 120, strand: 1 },
      'structural-curator',
      'mcp'
    );

    await expect(
      annotationService.batchCreateAnnotations({
        chromosome: 'NC_000913.3',
        annotations: [{ type: 'gene', start: 200, end: 260, strand: 1, qualifiers: { locus_tag: 'structural_1' } }],
        __executionContext: structuralContext,
      })
    ).resolves.toMatchObject({ success: true, chromosome: 'NC_000913.3', annotationsCreated: 1 });
    expect(annotationService.app.currentAnnotations['NC_000913.3']).toHaveLength(2);
  });

  it('refuses a commit when the reviewed feature changed after ChangeSet creation', async () => {
    const created = await annotationService.createAnnotationChangeset({
      identifier: 'b0001',
      operations: [{ op: 'addQualifier', field: 'note', value: 'Research-backed note' }],
      principal: 'research-agent',
      __executionContext: agentContext,
    });
    const approval = await annotationService.requestAnnotationApproval({
      changeSetId: created.changeSet.id,
      __executionContext: curatorContext,
    });
    annotation.qualifiers.product = 'human edit after preview';

    await expect(
      annotationService.applyAnnotationChangeset({
        changeSetId: created.changeSet.id,
        approvalToken: approval.approvalToken,
        __executionContext: curatorContext,
      })
    ).rejects.toThrow('target has changed');
  });

  it('does not begin a durable commit after the authenticated MCP deadline', async () => {
    const created = await annotationService.createAnnotationChangeset({
      identifier: 'b0001',
      operations: [{ op: 'addQualifier', field: 'note', value: 'deadline-bound update' }],
      idempotencyKey: 'deadline-bound-update',
      __executionContext: agentContext,
    });
    const approval = await annotationService.requestAnnotationApproval({
      changeSetId: created.changeSet.id,
      __executionContext: curatorContext,
    });

    await expect(
      annotationService.applyAnnotationChangeset({
        changeSetId: created.changeSet.id,
        approvalToken: approval.approvalToken,
        __executionContext: { ...curatorContext, commitNotAfter: Date.now() - 1 },
      })
    ).rejects.toThrow('deadline elapsed');
    expect(annotation.qualifiers.note).toBeUndefined();
  });

  it('revokes an issued approval capability when the curator rejects the ChangeSet', async () => {
    const created = await annotationService.createAnnotationChangeset({
      identifier: 'b0001',
      operations: [{ op: 'addQualifier', field: 'note', value: 'later rejected update' }],
      idempotencyKey: 'approved-then-rejected',
      __executionContext: agentContext,
    });
    const approval = await annotationService.requestAnnotationApproval({
      changeSetId: created.changeSet.id,
      __executionContext: curatorContext,
    });
    await annotationService.rejectAnnotationChangeset({
      changeSetId: created.changeSet.id,
      reason: 'curator found contradictory evidence',
      __executionContext: curatorContext,
    });

    const ledger = annotationService.app._sidecarData.annotationCuration;
    const storedApproval = ledger.approvals[approval.approval.id];
    expect(storedApproval).toMatchObject({
      revokedBy: curatorContext.principal,
      revocationReason: 'changeset_rejected',
    });
    expect(storedApproval.revokedAt).toEqual(expect.any(String));
    expect(ledger.audit).toContainEqual(
      expect.objectContaining({
        event: 'annotation_approval_revoked',
        changeSetId: created.changeSet.id,
        approvalId: approval.approval.id,
        principal: curatorContext.principal,
        reason: 'changeset_rejected',
      })
    );
    expect(ledger.audit).toContainEqual(
      expect.objectContaining({
        event: 'changeset_rejected',
        changeSetId: created.changeSet.id,
        approvalId: approval.approval.id,
      })
    );

    await expect(
      annotationService.applyAnnotationChangeset({
        changeSetId: created.changeSet.id,
        approvalToken: approval.approvalToken,
        __executionContext: curatorContext,
      })
    ).rejects.toThrow('ChangeSet is rejected');
    expect(annotation.qualifiers.note).toBeUndefined();
  });

  it('marks a tampered ChangeSet stale instead of recording a curator rejection', async () => {
    const created = await annotationService.createAnnotationChangeset({
      identifier: 'b0001',
      operations: [{ op: 'addQualifier', field: 'note', value: 'reviewed rejection target' }],
      idempotencyKey: 'tampered-before-rejection',
      __executionContext: agentContext,
    });
    const approval = await annotationService.requestAnnotationApproval({
      changeSetId: created.changeSet.id,
      __executionContext: curatorContext,
    });
    annotationService.app._sidecarData.annotationCuration.changeSets[created.changeSet.id].operations[0].value =
      'tampered rejection target';

    await expect(
      annotationService.rejectAnnotationChangeset({
        changeSetId: created.changeSet.id,
        reason: 'unauthorized stale-state attempt',
        __executionContext: agentContext,
      })
    ).rejects.toThrow('annotation:approve');
    expect(annotationService.app._sidecarData.annotationCuration.changeSets[created.changeSet.id].status).toBe(
      'approved'
    );

    await expect(
      annotationService.rejectAnnotationChangeset({
        changeSetId: created.changeSet.id,
        reason: 'do not legitimize a modified record',
        __executionContext: curatorContext,
      })
    ).rejects.toThrow('marked stale instead of rejected');

    const ledger = annotationService.app._sidecarData.annotationCuration;
    expect(ledger.changeSets[created.changeSet.id].status).toBe('stale');
    expect(ledger.approvals[approval.approval.id]).toMatchObject({
      revokedBy: 'validation-service',
      revocationReason: 'changeset_stale:immutable_changeset_payload_changed_before_rejection',
    });
    expect(ledger.audit).toContainEqual(
      expect.objectContaining({
        event: 'annotation_approval_revoked',
        approvalId: approval.approval.id,
        reason: 'changeset_stale:immutable_changeset_payload_changed_before_rejection',
      })
    );
    expect(ledger.audit.some(event => event.event === 'changeset_rejected')).toBe(false);
    expect(annotation.qualifiers.note).toBeUndefined();
  });

  it('marks an approved ChangeSet stale when its approval record is missing', async () => {
    const created = await annotationService.createAnnotationChangeset({
      identifier: 'b0001',
      operations: [{ op: 'addQualifier', field: 'note', value: 'orphaned approval' }],
      idempotencyKey: 'missing-approval-on-reject',
      __executionContext: agentContext,
    });
    const approval = await annotationService.requestAnnotationApproval({
      changeSetId: created.changeSet.id,
      __executionContext: curatorContext,
    });
    delete annotationService.app._sidecarData.annotationCuration.approvals[approval.approval.id];

    await expect(
      annotationService.rejectAnnotationChangeset({
        changeSetId: created.changeSet.id,
        reason: 'corrupt relationship',
        __executionContext: curatorContext,
      })
    ).rejects.toThrow('missing approval record and was marked stale');
    const ledger = annotationService.app._sidecarData.annotationCuration;
    expect(ledger.changeSets[created.changeSet.id].status).toBe('stale');
    expect(ledger.audit).toContainEqual(
      expect.objectContaining({
        event: 'changeset_stale',
        changeSetId: created.changeSet.id,
        reason: 'approved_changeset_missing_approval_record',
      })
    );
  });

  it('does not expose ChangeSet status before external curator authorization', async () => {
    await expect(
      annotationService.rejectAnnotationChangeset({
        changeSetId: 'does-not-exist',
        __executionContext: agentContext,
      })
    ).rejects.toThrow('annotation:approve');
    await expect(
      annotationService.rejectAnnotationChangeset({
        changeSetId: 'does-not-exist',
        __executionContext: {
          authenticated: true,
          source: 'mcp',
          principal: '   ',
          permissions: ['annotation:approve'],
        },
      })
    ).rejects.toThrow('curator identity is missing');
  });

  it('never revokes another ChangeSet approval through a corrupt cross-link', async () => {
    const first = await annotationService.createAnnotationChangeset({
      identifier: 'b0001',
      operations: [{ op: 'addQualifier', field: 'note', value: 'first proposal' }],
      idempotencyKey: 'cross-link-first',
      __executionContext: agentContext,
    });
    const firstApproval = await annotationService.requestAnnotationApproval({
      changeSetId: first.changeSet.id,
      __executionContext: curatorContext,
    });
    const second = await annotationService.createAnnotationChangeset({
      identifier: 'b0001',
      operations: [{ op: 'addQualifier', field: 'note', value: 'second proposal' }],
      idempotencyKey: 'cross-link-second',
      __executionContext: agentContext,
    });
    const secondApproval = await annotationService.requestAnnotationApproval({
      changeSetId: second.changeSet.id,
      __executionContext: curatorContext,
    });
    annotationService.app._sidecarData.annotationCuration.changeSets[first.changeSet.id].approvalId =
      secondApproval.approval.id;

    await expect(
      annotationService.rejectAnnotationChangeset({
        changeSetId: first.changeSet.id,
        reason: 'cross-link integrity test',
        __executionContext: curatorContext,
      })
    ).rejects.toThrow('approval binding is invalid');

    let ledger = annotationService.app._sidecarData.annotationCuration;
    expect(ledger.changeSets[first.changeSet.id].status).toBe('stale');
    expect(ledger.changeSets[second.changeSet.id].status).toBe('approved');
    expect(ledger.approvals[firstApproval.approval.id].revokedAt).toBeUndefined();
    expect(ledger.approvals[secondApproval.approval.id].revokedAt).toBeUndefined();
    expect(ledger.audit).toContainEqual(
      expect.objectContaining({
        event: 'annotation_approval_binding_invalid',
        changeSetId: first.changeSet.id,
        referencedApprovalId: secondApproval.approval.id,
        referencedApprovalChangeSetId: second.changeSet.id,
      })
    );

    await expect(
      annotationService.applyAnnotationChangeset({
        changeSetId: second.changeSet.id,
        approvalToken: secondApproval.approvalToken,
        __executionContext: curatorContext,
      })
    ).resolves.toMatchObject({ success: true });
    ledger = annotationService.app._sidecarData.annotationCuration;
    expect(ledger.changeSets[second.changeSet.id].status).toBe('committed');
    expect(annotation.qualifiers.note).toBe('second proposal');
  });

  it('treats a CDS phase change as a stale reviewed target', async () => {
    const created = await annotationService.createAnnotationChangeset({
      identifier: 'b0001',
      operations: [{ op: 'addQualifier', field: 'note', value: 'phase-sensitive review' }],
      __executionContext: agentContext,
    });
    const approval = await annotationService.requestAnnotationApproval({
      changeSetId: created.changeSet.id,
      __executionContext: curatorContext,
    });
    annotation.phase = 1;

    await expect(
      annotationService.applyAnnotationChangeset({
        changeSetId: created.changeSet.id,
        approvalToken: approval.approvalToken,
        __executionContext: curatorContext,
      })
    ).rejects.toThrow('target has changed');
  });

  it('recomputes assembly identity after an in-place sequence mutation', async () => {
    annotationService.app.currentSequence = { 'NC_000913.3': 'ATGAAATAG' };
    const before = await annotationService.resolveAnnotationTarget({ identifier: 'b0001' });

    annotationService.app.currentSequence['NC_000913.3'] = 'ATGCCCTAG';
    const after = await annotationService.resolveAnnotationTarget({ identifier: 'b0001' });

    expect(after.target.assemblySha256).not.toBe(before.target.assemblySha256);
    expect(after.target.genomeId).not.toBe(before.target.genomeId);
    expect(after.target.featureHash).not.toBe(before.target.featureHash);
  });

  it('does not allow a versioned proposal to omit available assembly, protein, or coordinate bindings', async () => {
    annotation.qualifiers.translation = 'MKT';
    annotationService.app.currentSequence = { 'NC_000913.3': 'ATGAAAACTTAG' };
    const resolved = await annotationService.resolveAnnotationTarget({ identifier: 'b0001' });
    const target = resolved.target;

    for (const omitted of ['assemblySha256', 'proteinSha256', 'coordinates']) {
      const downgraded = JSON.parse(JSON.stringify(target));
      delete downgraded[omitted];
      expect(() => annotationService.changeSetService._assertProposalTarget(downgraded, target, true)).toThrow(
        'missing required'
      );
    }
  });

  it('deduplicates pending requests and rejects idempotency-key reuse with different payloads', async () => {
    const params = {
      identifier: 'b0001',
      operations: [{ op: 'addQualifier', field: 'note', value: 'same request' }],
      idempotencyKey: 'stable-request-key',
      __executionContext: agentContext,
    };
    const first = await annotationService.createAnnotationChangeset(params);
    const duplicate = await annotationService.createAnnotationChangeset(params);

    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.changeSet.id).toBe(first.changeSet.id);
    await expect(
      annotationService.createAnnotationChangeset({
        ...params,
        operations: [{ op: 'addQualifier', field: 'note', value: 'different request' }],
      })
    ).rejects.toThrow('different annotation request');
  });

  it('stores prototype-reserved idempotency keys as ordinary durable keys', async () => {
    for (const idempotencyKey of ['constructor', '__proto__']) {
      const params = {
        identifier: 'b0001',
        operations: [{ op: 'addQualifier', field: 'note', value: `reserved key ${idempotencyKey}` }],
        idempotencyKey,
        __executionContext: agentContext,
      };
      const created = await annotationService.createAnnotationChangeset(params);
      const duplicate = await annotationService.createAnnotationChangeset(params);
      expect(duplicate).toMatchObject({ duplicate: true });
      expect(duplicate.changeSet.id).toBe(created.changeSet.id);
    }

    const ledger = annotationService.app._sidecarData.annotationCuration;
    expect(Object.prototype.hasOwnProperty.call(ledger.idempotencyKeys, 'constructor')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(ledger.idempotencyKeys, '__proto__')).toBe(true);
    expect(ledger.idempotencyKeys.constructor.changeSetId).toEqual(expect.any(String));
    expect(ledger.idempotencyKeys.__proto__.changeSetId).toEqual(expect.any(String));
    expect(Object.prototype.changeSetId).toBeUndefined();
  });

  it('migrates an exact legacy-v2 approved record, revokes plaintext capability, and makes its key opaque', async () => {
    const fixture = await buildLiteralLegacyV2Fixture({ annotation, status: 'approved' });
    const liveAnnotation = JSON.parse(JSON.stringify(fixture.preState));
    const { service, getStoredLedger } = createLegacyFixtureService({
      ledger: fixture.ledger,
      liveAnnotation,
    });

    const result = await service.getAnnotationChangeset({ changeSetId: fixture.changeSetId });
    const stored = getStoredLedger();
    const migrated = stored.changeSets[fixture.changeSetId];
    const approval = stored.approvals[fixture.approvalId];

    expect(stored.integrityVersion).toBe(2);
    expect(stored.migration).toMatchObject({
      fromIntegrityVersion: 1,
      legacyHashVersion: 'raw-json-v1',
      currentHashVersion: 'canonical-json-v1',
      sourceLedgerSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(result.changeSet.status).toBe('awaiting_approval');
    expect(migrated).toMatchObject({
      hashVersion: 'canonical-json-v1',
      legacyIntegrity: {
        hashVersion: 'raw-json-v1',
        changeSetHash: fixture.legacyChangeSetHash,
      },
      requestHash: null,
      proposalBaseRevision: 0,
    });
    expect(stored.idempotencyKeys['legacy-v2-request']).toEqual({
      changeSetId: fixture.changeSetId,
      requestHash: null,
      legacyOpaque: true,
    });
    expect(approval).toMatchObject({
      source: 'legacy-v2-migrated',
      revokedBy: 'legacy-ledger-migration',
      revocationReason: 'legacy_plaintext_capability_revoked',
    });
    expect(approval.revokedAt).toEqual(expect.any(String));
    expect(approval.token).toBeUndefined();
    expect(approval.tokenHash).toBeUndefined();

    await expect(
      service.createAnnotationChangeset({
        identifier: 'b0001',
        operations: [{ op: 'addQualifier', field: 'note', value: 'legacy reviewed note' }],
        idempotencyKey: 'legacy-v2-request',
        __executionContext: agentContext,
      })
    ).rejects.toThrow('original request identity is unavailable');
    await expect(
      service.requestAnnotationApproval({
        changeSetId: fixture.changeSetId,
        __executionContext: curatorContext,
      })
    ).resolves.toMatchObject({ approvalToken: expect.stringMatching(/^[a-f0-9]{64}$/) });
  });

  it('persists a verified legacy commit migration before replaying a pre-state overlay', async () => {
    const fixture = await buildLiteralLegacyV2Fixture({ annotation, status: 'committed' });
    const liveAnnotation = JSON.parse(JSON.stringify(fixture.preState));
    const saveObservedStates = [];
    const { service, getStoredLedger } = createLegacyFixtureService({
      ledger: fixture.ledger,
      liveAnnotation,
      onSave: () => saveObservedStates.push(liveAnnotation.qualifiers.note),
    });

    await service.restoreCommittedAnnotationOverlay();

    const stored = getStoredLedger();
    const migrated = stored.changeSets[fixture.changeSetId];
    expect(saveObservedStates).toEqual([undefined]);
    expect(liveAnnotation.qualifiers.note).toBe('legacy reviewed note');
    expect(migrated.commitReceipt).toMatchObject({
      hashVersion: 'canonical-json-v1',
      approvedBy: 'legacy-curator@example.org',
      resultingFeatureHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      legacyIntegrity: {
        hashVersion: 'raw-json-v1',
        receiptHash: fixture.ledger.changeSets[fixture.changeSetId].commitReceipt.receiptHash,
      },
    });
    expect(stored.committedIdempotencyKeys['legacy-v2-request']).toEqual(migrated.commitReceipt);
    await expect(service.restoreCommittedAnnotationOverlay()).resolves.toMatchObject({
      revision: 1,
      committedChangeSets: 1,
    });
  });

  it('migrates a legacy committed overlay from a reversibly proven post-state without rewriting it', async () => {
    const fixture = await buildLiteralLegacyV2Fixture({ annotation, status: 'committed' });
    const liveAnnotation = JSON.parse(JSON.stringify(fixture.postState));
    const { service, setAndForceSave } = createLegacyFixtureService({
      ledger: fixture.ledger,
      liveAnnotation,
    });

    await service.restoreCommittedAnnotationOverlay();

    expect(setAndForceSave).toHaveBeenCalledTimes(1);
    expect(liveAnnotation).toEqual(fixture.postState);
  });

  it('fails closed on a legacy receipt whose live feature is neither pre-state nor reversible post-state', async () => {
    const fixture = await buildLiteralLegacyV2Fixture({ annotation, status: 'committed' });
    const liveAnnotation = JSON.parse(JSON.stringify(fixture.preState));
    liveAnnotation.qualifiers.product = 'unrelated manual edit';
    const before = JSON.parse(JSON.stringify(liveAnnotation));
    const { service, setAndForceSave } = createLegacyFixtureService({
      ledger: fixture.ledger,
      liveAnnotation,
    });

    await expect(service.restoreCommittedAnnotationOverlay()).rejects.toThrow(
      'neither at a proven pre-state nor a reversible receipt post-state'
    );
    expect(setAndForceSave).not.toHaveBeenCalled();
    expect(liveAnnotation).toEqual(before);
  });

  it('preserves an already-stale legacy target as read-only history when the live feature diverged', async () => {
    const fixture = await buildLiteralLegacyV2Fixture({ annotation, status: 'stale' });
    const liveAnnotation = JSON.parse(JSON.stringify(fixture.preState));
    liveAnnotation.qualifiers.product = 'manual edit that made the legacy proposal stale';
    const { service, getStoredLedger } = createLegacyFixtureService({
      ledger: fixture.ledger,
      liveAnnotation,
    });

    const result = await service.getAnnotationChangeset({ changeSetId: fixture.changeSetId });
    const stored = getStoredLedger();

    expect(result.changeSet).toMatchObject({
      status: 'stale',
      targetFormat: 'legacy-v2-read-only',
      hashVersion: 'canonical-json-v1',
    });
    expect(result.changeSet.target).toEqual(fixture.ledger.changeSets[fixture.changeSetId].target);
    expect(stored.approvals[fixture.approvalId]).toMatchObject({
      revocationReason: 'legacy_plaintext_capability_revoked',
    });
    expect(stored.approvals[fixture.approvalId].token).toBeUndefined();
    await expect(
      service.requestAnnotationApproval({
        changeSetId: fixture.changeSetId,
        __executionContext: curatorContext,
      })
    ).rejects.toThrow('not eligible for approval');
  });

  it('preserves duplicate uncommitted legacy idempotency owners as stale history behind a tombstone', async () => {
    const fixture = await buildLiteralLegacyV2Fixture({ annotation, status: 'approved' });
    const duplicate = JSON.parse(JSON.stringify(fixture.ledger.changeSets[fixture.changeSetId]));
    duplicate.id = 'cs_legacy_duplicate';
    duplicate.status = 'awaiting_approval';
    delete duplicate.approvalId;
    delete duplicate.changeSetHash;
    duplicate.changeSetHash = await legacyRawHash({ ...duplicate, changeSetHash: undefined });
    fixture.ledger.changeSets[duplicate.id] = duplicate;
    const liveAnnotation = JSON.parse(JSON.stringify(fixture.preState));
    const { service, getStoredLedger, setAndForceSave } = createLegacyFixtureService({
      ledger: fixture.ledger,
      liveAnnotation,
    });

    await expect(service.getAnnotationChangeset({ changeSetId: fixture.changeSetId })).resolves.toMatchObject({
      changeSet: { id: fixture.changeSetId, status: 'stale' },
    });
    await expect(service.getAnnotationChangeset({ changeSetId: duplicate.id })).resolves.toMatchObject({
      changeSet: { id: duplicate.id, status: 'stale' },
    });

    const stored = getStoredLedger();
    const ownerIds = [fixture.changeSetId, duplicate.id].sort();
    const migratedOwners = ownerIds.map(changeSetId => stored.changeSets[changeSetId]);
    expect(setAndForceSave).toHaveBeenCalledTimes(1);
    expect(migratedOwners).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: fixture.changeSetId, status: 'stale' }),
        expect.objectContaining({ id: duplicate.id, status: 'stale' }),
      ])
    );
    expect(migratedOwners.map(changeSet => changeSet.idempotencyKey)).toEqual([
      expect.stringMatching(/^legacy-ambiguous-owner:/),
      expect.stringMatching(/^legacy-ambiguous-owner:/),
    ]);
    expect(new Set(migratedOwners.map(changeSet => changeSet.idempotencyKey)).size).toBe(2);
    for (const changeSet of migratedOwners) {
      expect(changeSet.legacyIntegrity.idempotencyAmbiguity).toEqual({
        originalKey: 'legacy-v2-request',
        ownerIds,
        migratedKey: changeSet.idempotencyKey,
        readOnly: true,
      });
      expect(stored.idempotencyKeys[changeSet.idempotencyKey]).toEqual({
        changeSetId: changeSet.id,
        requestHash: null,
        legacyOpaque: true,
      });
    }
    expect(stored.idempotencyKeys['legacy-v2-request']).toEqual({
      legacyAmbiguous: true,
      legacyOpaque: true,
      ownerIds,
      committedOwnerId: null,
    });
    expect(stored.approvals[fixture.approvalId]).toMatchObject({
      revokedBy: 'legacy-ledger-migration',
      revocationReason: 'legacy_plaintext_capability_revoked',
    });
    expect(stored.approvals[fixture.approvalId].token).toBeUndefined();
    expect(stored.changeSets[fixture.changeSetId].approvalId).toBeUndefined();
    expect(stored.audit).toContainEqual(
      expect.objectContaining({
        event: 'annotation_legacy_idempotency_ambiguous',
        originalKey: 'legacy-v2-request',
        ownerIds,
        committedOwnerId: null,
        resolution: 'uncommitted_owners_preserved_as_stale_read_only_history',
      })
    );
    await expect(
      service.createAnnotationChangeset({
        identifier: 'b0001',
        operations: [{ op: 'addQualifier', field: 'note', value: 'new request' }],
        idempotencyKey: 'legacy-v2-request',
        __executionContext: agentContext,
      })
    ).rejects.toThrow('ambiguous migrated legacy key');
    await expect(
      service.requestAnnotationApproval({
        changeSetId: duplicate.id,
        __executionContext: curatorContext,
      })
    ).rejects.toThrow('not eligible for approval');
  });

  it('rejects a legacy ChangeSet whose exact creation-time raw JSON hash no longer matches', async () => {
    const fixture = await buildLiteralLegacyV2Fixture({ annotation, status: 'awaiting_approval' });
    fixture.ledger.changeSets[fixture.changeSetId].operations[0].value = 'tampered after hashing';
    const liveAnnotation = JSON.parse(JSON.stringify(fixture.preState));
    const { service, setAndForceSave } = createLegacyFixtureService({
      ledger: fixture.ledger,
      liveAnnotation,
    });

    await expect(service.getAnnotationChangeset({ changeSetId: fixture.changeSetId })).rejects.toThrow(
      'failed exact creation-payload verification'
    );
    expect(setAndForceSave).not.toHaveBeenCalled();
  });

  it('rejects a re-hashed legacy receipt whose operations differ from the reviewed ChangeSet', async () => {
    const fixture = await buildLiteralLegacyV2Fixture({ annotation, status: 'committed' });
    const receipt = fixture.ledger.changeSets[fixture.changeSetId].commitReceipt;
    receipt.appliedOperations[0].value = 'forged receipt operation';
    delete receipt.receiptHash;
    receipt.receiptHash = await legacyRawHash(receipt);
    fixture.ledger.committedIdempotencyKeys['legacy-v2-request'] = JSON.parse(JSON.stringify(receipt));
    const liveAnnotation = JSON.parse(JSON.stringify(fixture.preState));
    const { service, setAndForceSave } = createLegacyFixtureService({
      ledger: fixture.ledger,
      liveAnnotation,
    });

    await expect(service.restoreCommittedAnnotationOverlay()).rejects.toThrow(
      'operations differ from the reviewed legacy payload'
    );
    expect(setAndForceSave).not.toHaveBeenCalled();
    expect(liveAnnotation).toEqual(fixture.preState);
  });

  it('fails closed when a pending ChangeSet has a forged committed-idempotency receipt', async () => {
    const created = await annotationService.createAnnotationChangeset({
      identifier: 'b0001',
      operations: [{ op: 'addQualifier', field: 'note', value: 'must remain pending' }],
      idempotencyKey: 'forged-commit-index',
      __executionContext: agentContext,
    });
    const ledger = annotationService.app._sidecarData.annotationCuration;
    ledger.committedIdempotencyKeys['forged-commit-index'] = {
      id: 'commit-forged',
      changeSetId: created.changeSet.id,
      receiptHash: 'forged-receipt-hash',
    };

    await expect(
      annotationService.applyAnnotationChangeset({
        changeSetId: created.changeSet.id,
        approvalToken: 'forged-capability',
        __executionContext: curatorContext,
      })
    ).rejects.toThrow('committed idempotency index is inconsistent');
    expect(annotation.qualifiers.note).toBeUndefined();
  });

  it('fails closed when a committed ChangeSet is missing its idempotency receipt index', async () => {
    const created = await annotationService.createAnnotationChangeset({
      identifier: 'b0001',
      operations: [{ op: 'addQualifier', field: 'note', value: 'indexed commit' }],
      idempotencyKey: 'missing-commit-index',
      __executionContext: agentContext,
    });
    const approval = await annotationService.requestAnnotationApproval({
      changeSetId: created.changeSet.id,
      __executionContext: curatorContext,
    });
    await annotationService.applyAnnotationChangeset({
      changeSetId: created.changeSet.id,
      approvalToken: approval.approvalToken,
      __executionContext: curatorContext,
    });
    delete annotationService.app._sidecarData.annotationCuration.committedIdempotencyKeys['missing-commit-index'];

    await expect(annotationService.restoreCommittedAnnotationOverlay()).rejects.toThrow(
      'committed idempotency index is inconsistent'
    );
  });

  it('rejects an ambiguous identifier unless a unique chromosome is supplied', async () => {
    annotationService.app.currentAnnotations.other = [
      {
        id: 'feature-2',
        type: 'CDS',
        start: 1,
        end: 90,
        strand: 1,
        qualifiers: { locus_tag: 'other_1', gene: 'thrL', product: 'second copy' },
      },
    ];

    await expect(annotationService.resolveAnnotationTarget({ identifier: 'thrL' })).rejects.toThrow('ambiguous');
    const resolved = await annotationService.resolveAnnotationTarget({
      identifier: 'thrL',
      chromosome: 'NC_000913.3',
    });
    expect(resolved.target.annotationId).toBe('feature-1');
  });

  it('resolves common GFF IDs, names, gene IDs, transcript IDs, and aliases', async () => {
    const gffFeature = {
      id: 'cds-42',
      name: 'dnaA',
      type: 'CDS',
      start: 500,
      end: 900,
      strand: 1,
      phase: 2,
      source: 'RefSeq',
      score: 7.5,
      qualifiers: {
        ID: 'cds-42',
        Name: 'dnaA',
        gene_id: 'gene-42',
        transcript_id: 'rna-42',
        Alias: 'oriC_regulator,replication_initiator',
      },
    };
    annotationService.app.currentAnnotations = { chrGff: [gffFeature] };
    annotationService.app.currentChromosome = 'chrGff';

    for (const identifier of ['cds-42', 'dnaA', 'gene-42', 'rna-42', 'oriC_regulator']) {
      const resolved = await annotationService.resolveAnnotationTarget({ identifier });
      expect(resolved.target.annotationId).toBe('cds-42');
      expect(resolved.target.geneSymbol).toBe('dnaA');
    }
  });

  it('validates a citation-rich DGR curation note against its exact research facts', async () => {
    const statement = 'The Escherichia coli lysC riboswitch regulates gene expression through translation initiation.';
    const segmentText = `${statement} (PMID:38253429).`;
    const researchSummary = {
      schema: 'dgr.curation-summary.v1',
      headline: 'lysC has an evidence-backed regulatory function.',
      facts: [
        {
          id: 'fact_1',
          category: 'regulation',
          field: 'literature_finding',
          value: statement,
          statement,
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
            title: 'Exact lysC study',
          },
        },
      ],
      literature: [],
      limitations: [],
    };
    const evidenceRecords = [{ id: 'evidence_1', supporting: true }];
    const claims = [
      {
        id: 'claim_1',
        field: 'note',
        value: segmentText,
        evidenceIds: ['evidence_1'],
        confidence: 0.8,
      },
    ];
    const operations = [
      {
        op: 'addQualifier',
        field: 'note',
        value: segmentText,
        claimIds: ['claim_1'],
      },
    ];
    const note = {
      schema: 'dgr.curation-note.v1',
      text: segmentText,
      textSha256: await sha256Text(segmentText),
      segments: [
        {
          category: 'regulation',
          text: segmentText,
          factIds: ['fact_1'],
          evidenceIds: ['evidence_1'],
          citations: [
            {
              type: 'pmid',
              id: '38253429',
              label: 'PMID:38253429',
              url: 'https://pubmed.ncbi.nlm.nih.gov/38253429/',
            },
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

    await expect(
      annotationService.changeSetService._validateCurationNote(
        note,
        researchSummary,
        evidenceRecords,
        claims,
        operations
      )
    ).resolves.toEqual(note);

    note.segments[0].text = 'Invented uncited regulation statement. (PMID:38253429).';
    await expect(
      annotationService.changeSetService._validateCurationNote(
        note,
        researchSummary,
        evidenceRecords,
        claims,
        operations
      )
    ).rejects.toThrow('exact citation-bound research fact');
  });

  it('validates and preserves versioned claims and evidence while retaining proposal metadata operations', async () => {
    const resolved = await annotationService.resolveAnnotationTarget({ identifier: 'b0001' });
    const literatureExcerpt = 'The Escherichia coli thrL target controls transcriptional attenuation.';
    const literatureExcerptSha256 = await sha256Text(literatureExcerpt);
    const proposal = {
      schema: 'codexomics.annotation-change-set.v2',
      status: 'ready_for_validation',
      target: resolved.target,
      baseRevision: resolved.target.annotationRevision,
      evidenceManifest: {
        schema: 'dgr.evidence-manifest.v1',
        generatedAt: '2026-01-01T00:00:00.000Z',
        pipelineVersion: 'test',
        sourceRecords: [
          {
            id: 'evidence_1',
            label: 'PMID:123456',
            sourceId: '123456',
            url: 'https://pubmed.ncbi.nlm.nih.gov/123456/',
            database: 'pubmed',
            sourceHash: 'a'.repeat(64),
            retrievedAt: '2026-01-01T00:00:00.000Z',
            type: 'pmid',
            supporting: true,
          },
          {
            id: 'evidence_2',
            label: 'PMID:123456',
            sourceId: '123456',
            url: 'https://pubmed.ncbi.nlm.nih.gov/123456/',
            database: 'pubmed',
            identifiers: [{ scheme: 'pmid', value: '123456' }],
            sourceBinding: {
              schema: 'dgr.evidence-source-binding.v1',
              sourceCollection: 'sources',
              selector: {
                database: 'pubmed',
                identifier: { scheme: 'pmid', value: '123456' },
              },
              content: {
                relativeJsonPointer: '/structuredData/literatureReferences/0/abstract',
                canonicalization: 'dgr.pubmed-abstract.v1',
                sha256: literatureExcerptSha256,
                hashEncoding: 'utf8',
                length: literatureExcerpt.length,
                lengthEncoding: 'utf16_code_units',
              },
            },
            sourceHash: 'b'.repeat(64),
            retrievedAt: '2026-01-01T00:00:00.000Z',
            type: 'pmid',
            supporting: false,
          },
        ],
      },
      claims: [
        {
          id: 'claim_1',
          field: 'go_terms',
          value: ['GO:0003674'],
          evidenceIds: ['evidence_1'],
          confidence: 0.8,
        },
      ],
      operations: [{ op: 'addQualifier', field: 'go_terms', value: ['GO:0003674'], claimIds: ['claim_1'] }],
      summary: 'Evidence-backed function',
      confidence: 0.8,
      reportUrl: 'https://example.test/report',
      detailsUrl: 'https://example.test/details',
      generatedAt: '2026-01-01T00:00:00.000Z',
      researchSummary: {
        schema: 'dgr.curation-summary.v1',
        headline: 'thrL has an evidence-backed regulatory function.',
        facts: [
          {
            id: 'fact_1',
            category: 'function',
            field: 'molecular_function',
            value: 'attenuation control',
            statement: 'molecular function: attenuation control',
            evidenceIds: ['evidence_1'],
            confidence: 0.8,
            directness: 'exact_target',
            evidenceLevel: 'authoritative_database',
            sourceDatabases: ['pubmed'],
          },
          {
            id: 'fact_2',
            category: 'regulation',
            field: 'literature_finding',
            value: literatureExcerpt,
            statement: literatureExcerpt,
            evidenceIds: ['evidence_2'],
            confidence: null,
            directness: 'exact_target',
            evidenceLevel: 'target_literature',
            sourceDatabases: ['pubmed'],
            citation: {
              type: 'pmid',
              id: '123456',
              label: 'PMID:123456',
              url: 'https://pubmed.ncbi.nlm.nih.gov/123456/',
              title: 'Exact-target study',
            },
            literatureBasis: {
              kind: 'pubmed_abstract_span',
              evidenceId: 'evidence_2',
              pmid: '123456',
              excerpt: literatureExcerpt,
              excerptSha256: literatureExcerptSha256,
              hashEncoding: 'utf8',
              excerptStart: 0,
              excerptEnd: literatureExcerpt.length,
              abstractSha256: literatureExcerptSha256,
              abstractLength: literatureExcerpt.length,
              canonicalization: 'dgr.pubmed-abstract.v1',
              offsetEncoding: 'utf16_code_units',
            },
          },
        ],
        literature: [
          {
            title: 'Exact-target study',
            pmid: '123456',
            url: 'https://pubmed.ncbi.nlm.nih.gov/123456/',
            relevance: 'high',
            relevanceReason: 'Exact target and organism are present.',
            evidenceIds: ['evidence_2'],
          },
        ],
        limitations: [],
      },
    };
    const proposalSha256 = await annotationService.changeSetService._hash(proposal);
    const archivedAttachment = {
      id: 'dgr:dgr-task-123',
      kind: 'dgr-research-report',
      taskId: 'dgr-task-123',
      sha256: 'd'.repeat(64),
      proposalSha256,
      citationValidation: {
        schema: 'codexomics.dgr-citation-validation.v1',
        verified: true,
        factCount: 1,
      },
      currentAnnotationValidation: {
        schema: 'codexomics.dgr-current-annotation-validation.v1',
        verified: true,
        required: true,
        snapshotSha256: 'c'.repeat(64),
        targetFeatureHash: resolved.target.featureHash,
      },
      target: resolved.target,
    };
    annotationService.app.geneAttachmentsManager = {
      ready: Promise.resolve(),
      getAttachmentsForGene: () => [archivedAttachment],
    };

    const created = await annotationService.createAnnotationChangeset({
      identifier: 'b0001',
      annotationProposal: proposal,
      researchRun: 'dgr-task-123',
      idempotencyKey: 'v2-proposal',
      __executionContext: agentContext,
    });

    expect(created.changeSet.claims).toEqual(proposal.claims);
    expect(created.changeSet.evidenceManifest).toEqual(proposal.evidenceManifest);
    expect(created.changeSet.manifestHash).toMatch(/^[a-f0-9]{64}$/);
    expect(created.changeSet.operations.map(operation => operation.field)).toEqual(['go_terms']);
    expect(created.changeSet.proposalMetadata).toMatchObject({
      summary: 'Evidence-backed function',
      confidence: 0.8,
      reportUrl: 'https://example.test/report',
      detailsUrl: 'https://example.test/details',
      researchSummary: proposal.researchSummary,
      archivedDgrReport: expect.objectContaining({
        taskId: 'dgr-task-123',
        proposalSha256,
        currentAnnotationValidation: expect.objectContaining({
          verified: true,
          snapshotSha256: 'c'.repeat(64),
        }),
      }),
    });

    const verifiedCurrentAnnotation = archivedAttachment.currentAnnotationValidation;
    delete archivedAttachment.currentAnnotationValidation;
    await expect(
      annotationService.createAnnotationChangeset({
        identifier: 'b0001',
        annotationProposal: proposal,
        researchRun: 'dgr-task-123',
        idempotencyKey: 'missing-current-annotation-receipt-v2-proposal',
        __executionContext: agentContext,
      })
    ).rejects.toThrow('has not passed current-annotation snapshot validation');
    archivedAttachment.currentAnnotationValidation = {
      ...verifiedCurrentAnnotation,
      targetFeatureHash: 'different-feature-hash',
    };
    await expect(
      annotationService.createAnnotationChangeset({
        identifier: 'b0001',
        annotationProposal: proposal,
        researchRun: 'dgr-task-123',
        idempotencyKey: 'mismatched-current-annotation-receipt-v2-proposal',
        __executionContext: agentContext,
      })
    ).rejects.toThrow('has not passed current-annotation snapshot validation');
    archivedAttachment.currentAnnotationValidation = verifiedCurrentAnnotation;

    annotationService.app.geneAttachmentsManager.getAttachmentsForGene = () => [];
    await expect(
      annotationService.createAnnotationChangeset({
        identifier: 'b0001',
        annotationProposal: proposal,
        researchRun: 'dgr-task-123',
        idempotencyKey: 'missing-archive-v2-proposal',
        __executionContext: agentContext,
      })
    ).rejects.toThrow('Archive DGR research task');
    annotationService.app.geneAttachmentsManager.getAttachmentsForGene = () => [archivedAttachment];
    archivedAttachment.proposalSha256 = 'e'.repeat(64);
    await expect(
      annotationService.createAnnotationChangeset({
        identifier: 'b0001',
        annotationProposal: proposal,
        researchRun: 'dgr-task-123',
        idempotencyKey: 'mismatched-archive-v2-proposal',
        __executionContext: agentContext,
      })
    ).rejects.toThrow('does not contain this exact annotation proposal');
    archivedAttachment.proposalSha256 = proposalSha256;

    proposal.researchSummary.literature[0].pmid = '654321';
    await expect(
      annotationService.createAnnotationChangeset({
        identifier: 'b0001',
        annotationProposal: proposal,
        researchRun: 'dgr-task-123',
        idempotencyKey: 'citation-mismatch-v2-proposal',
        __executionContext: agentContext,
      })
    ).rejects.toThrow('does not match its PubMed URL');
    proposal.researchSummary.literature[0].pmid = '123456';

    proposal.researchSummary.facts[1].literatureBasis.excerptSha256 = 'c'.repeat(64);
    await expect(
      annotationService.createAnnotationChangeset({
        identifier: 'b0001',
        annotationProposal: proposal,
        researchRun: 'dgr-task-123',
        idempotencyKey: 'bad-literature-span-v2-proposal',
        __executionContext: agentContext,
      })
    ).rejects.toThrow('excerpt hash does not match');
    proposal.researchSummary.facts[1].literatureBasis.excerptSha256 = literatureExcerptSha256;

    proposal.researchSummary.facts[1].citation.url = 'https://pubmed.ncbi.nlm.nih.gov/654321/';
    await expect(
      annotationService.createAnnotationChangeset({
        identifier: 'b0001',
        annotationProposal: proposal,
        researchRun: 'dgr-task-123',
        idempotencyKey: 'bad-literature-url-v2-proposal',
        __executionContext: agentContext,
      })
    ).rejects.toThrow('citation does not match');
    proposal.researchSummary.facts[1].citation.url = 'https://pubmed.ncbi.nlm.nih.gov/123456/';

    proposal.operations[0].claimIds = ['missing_claim'];
    await expect(
      annotationService.createAnnotationChangeset({
        identifier: 'b0001',
        annotationProposal: proposal,
        researchRun: 'dgr-task-123',
        idempotencyKey: 'invalid-v2-proposal',
        __executionContext: agentContext,
      })
    ).rejects.toThrow('unknown claimId');

    proposal.operations[0].claimIds = ['claim_1'];
    proposal.evidenceManifest.sourceRecords[0].supporting = false;
    await expect(
      annotationService.createAnnotationChangeset({
        identifier: 'b0001',
        annotationProposal: proposal,
        researchRun: 'dgr-task-123',
        idempotencyKey: 'non-supporting-v2-proposal',
        __executionContext: agentContext,
      })
    ).rejects.toThrow('not marked as supporting');
  });

  it('does not trust caller-provided approval identities or expose plaintext capabilities in the ledger', async () => {
    const created = await annotationService.createAnnotationChangeset({
      identifier: 'b0001',
      operations: [{ op: 'addQualifier', field: 'note', value: 'curated' }],
      __executionContext: agentContext,
    });
    await expect(
      annotationService.requestAnnotationApproval({
        changeSetId: created.changeSet.id,
        approver: 'curator@example.org',
      })
    ).rejects.toThrow('trusted interactive curator confirmation UI');

    const approval = await annotationService.requestAnnotationApproval({
      changeSetId: created.changeSet.id,
      approver: 'forged@example.org',
      allowSelfApproval: true,
      __executionContext: curatorContext,
    });
    expect(approval.approval.approver).toBe('curator@example.org');
    expect(approval.approval).not.toHaveProperty('tokenHash');
    const ledger = annotationService.changeSetService.memoryLedgers.get('/tmp/test.gbk');
    const storedApproval = ledger.approvals[approval.approval.id];
    expect(storedApproval).not.toHaveProperty('token');
    expect(storedApproval.tokenHash).not.toBe(approval.approvalToken);
  });

  it('detects immutable-payload tampering after approval', async () => {
    const created = await annotationService.createAnnotationChangeset({
      identifier: 'b0001',
      operations: [{ op: 'addQualifier', field: 'note', value: 'reviewed value' }],
      __executionContext: agentContext,
    });
    const approval = await annotationService.requestAnnotationApproval({
      changeSetId: created.changeSet.id,
      __executionContext: curatorContext,
    });
    const ledger = annotationService.app._sidecarData.annotationCuration;
    ledger.changeSets[created.changeSet.id].operations[0].value = 'tampered value';

    await expect(
      annotationService.applyAnnotationChangeset({
        changeSetId: created.changeSet.id,
        approvalToken: approval.approvalToken,
        __executionContext: curatorContext,
      })
    ).rejects.toThrow('payload changed after approval');
    const persistedLedger = annotationService.app._sidecarData.annotationCuration;
    expect(persistedLedger.approvals[approval.approval.id]).toMatchObject({
      revokedBy: 'validation-service',
      revocationReason: 'changeset_stale:immutable_changeset_payload_changed_after_approval',
    });
    expect(persistedLedger.audit).toContainEqual(
      expect.objectContaining({
        event: 'annotation_approval_revoked',
        approvalId: approval.approval.id,
        reason: 'changeset_stale:immutable_changeset_payload_changed_after_approval',
      })
    );
    expect(annotation.qualifiers.note).toBeUndefined();
  });

  it('serializes concurrent commits so only one ChangeSet at the same revision can commit', async () => {
    const first = await annotationService.createAnnotationChangeset({
      identifier: 'b0001',
      operations: [{ op: 'addQualifier', field: 'note', value: 'first' }],
      __executionContext: agentContext,
    });
    const second = await annotationService.createAnnotationChangeset({
      identifier: 'b0001',
      operations: [{ op: 'addQualifier', field: 'go_terms', value: 'GO:0003674' }],
      evidence: ['GO:0003674 evidence'],
      __executionContext: agentContext,
    });
    const firstApproval = await annotationService.requestAnnotationApproval({
      changeSetId: first.changeSet.id,
      __executionContext: curatorContext,
    });
    const secondApproval = await annotationService.requestAnnotationApproval({
      changeSetId: second.changeSet.id,
      __executionContext: curatorContext,
    });

    const results = await Promise.allSettled([
      annotationService.applyAnnotationChangeset({
        changeSetId: first.changeSet.id,
        approvalToken: firstApproval.approvalToken,
        __executionContext: curatorContext,
      }),
      annotationService.applyAnnotationChangeset({
        changeSetId: second.changeSet.id,
        approvalToken: secondApproval.approvalToken,
        __executionContext: curatorContext,
      }),
    ]);

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect(results.find(result => result.status === 'rejected').reason.message).toContain('stale');
  });

  it('rebases approved ChangeSets for different unchanged features onto the current global revision', async () => {
    const secondAnnotation = {
      id: 'feature-2',
      type: 'CDS',
      start: 200,
      end: 320,
      strand: 1,
      qualifiers: { locus_tag: 'b0002', gene: 'thrA', product: 'hypothetical protein' },
    };
    annotationService.app.currentAnnotations['NC_000913.3'].push(secondAnnotation);
    const first = await annotationService.createAnnotationChangeset({
      identifier: 'b0001',
      operations: [{ op: 'addQualifier', field: 'note', value: 'first feature' }],
      __executionContext: agentContext,
    });
    const second = await annotationService.createAnnotationChangeset({
      identifier: 'b0002',
      operations: [{ op: 'addQualifier', field: 'note', value: 'second feature' }],
      __executionContext: agentContext,
    });
    const firstApproval = await annotationService.requestAnnotationApproval({
      changeSetId: first.changeSet.id,
      __executionContext: curatorContext,
    });
    const secondApproval = await annotationService.requestAnnotationApproval({
      changeSetId: second.changeSet.id,
      __executionContext: curatorContext,
    });

    const firstCommit = await annotationService.applyAnnotationChangeset({
      changeSetId: first.changeSet.id,
      approvalToken: firstApproval.approvalToken,
      __executionContext: curatorContext,
    });
    const secondCommit = await annotationService.applyAnnotationChangeset({
      changeSetId: second.changeSet.id,
      approvalToken: secondApproval.approvalToken,
      __executionContext: curatorContext,
    });

    expect(firstCommit.receipt).toMatchObject({ previousRevision: 0, revision: 1 });
    expect(secondCommit.receipt).toMatchObject({ previousRevision: 1, revision: 2 });
    expect(annotation.qualifiers.note).toBe('first feature');
    expect(secondAnnotation.qualifiers.note).toBe('second feature');
  });

  it('keeps replay chains separate when renderer feature IDs collide across chromosomes', async () => {
    annotation.codexomicsFeatureId = 'shared-renderer-id';
    const otherAnnotation = {
      id: 'feature-other',
      codexomicsFeatureId: 'shared-renderer-id',
      type: 'CDS',
      start: 12,
      end: 120,
      strand: 1,
      qualifiers: { locus_tag: 'other0001', gene: 'otherGene', product: 'hypothetical protein' },
    };
    annotationService.app.currentAnnotations.otherChromosome = [otherAnnotation];
    const first = await annotationService.createAnnotationChangeset({
      identifier: 'b0001',
      chromosome: 'NC_000913.3',
      operations: [{ op: 'addQualifier', field: 'note', value: 'first chromosome' }],
      __executionContext: agentContext,
    });
    const second = await annotationService.createAnnotationChangeset({
      identifier: 'other0001',
      chromosome: 'otherChromosome',
      operations: [{ op: 'addQualifier', field: 'note', value: 'other chromosome' }],
      __executionContext: agentContext,
    });
    const firstApproval = await annotationService.requestAnnotationApproval({
      changeSetId: first.changeSet.id,
      __executionContext: curatorContext,
    });
    const secondApproval = await annotationService.requestAnnotationApproval({
      changeSetId: second.changeSet.id,
      __executionContext: curatorContext,
    });
    await annotationService.applyAnnotationChangeset({
      changeSetId: first.changeSet.id,
      approvalToken: firstApproval.approvalToken,
      __executionContext: curatorContext,
    });
    await annotationService.applyAnnotationChangeset({
      changeSetId: second.changeSet.id,
      approvalToken: secondApproval.approvalToken,
      __executionContext: curatorContext,
    });

    await expect(annotationService.restoreCommittedAnnotationOverlay()).resolves.toMatchObject({
      revision: 2,
      committedChangeSets: 2,
    });
    expect(annotation.qualifiers.note).toBe('first chromosome');
    expect(otherAnnotation.qualifiers.note).toBe('other chromosome');
  });

  it('materializes an older DGR proposal only when its exact target hash remains unchanged', async () => {
    const secondAnnotation = {
      id: 'feature-2',
      type: 'CDS',
      start: 200,
      end: 320,
      strand: 1,
      qualifiers: { locus_tag: 'b0002', gene: 'thrA', product: 'hypothetical protein' },
    };
    annotationService.app.currentAnnotations['NC_000913.3'].push(secondAnnotation);
    const researchedTarget = (await annotationService.resolveAnnotationTarget({ identifier: 'b0002' })).target;
    const unrelated = await annotationService.createAnnotationChangeset({
      identifier: 'b0001',
      operations: [{ op: 'addQualifier', field: 'note', value: 'unrelated commit' }],
      __executionContext: agentContext,
    });
    const unrelatedApproval = await annotationService.requestAnnotationApproval({
      changeSetId: unrelated.changeSet.id,
      __executionContext: curatorContext,
    });
    await annotationService.applyAnnotationChangeset({
      changeSetId: unrelated.changeSet.id,
      approvalToken: unrelatedApproval.approvalToken,
      __executionContext: curatorContext,
    });
    await expect(
      annotationService.createAnnotationChangeset({
        identifier: 'b0002',
        annotationProposal: {
          target: { annotationRevision: researchedTarget.annotationRevision },
          operations: [{ op: 'addQualifier', field: 'note', value: 'under-bound old proposal' }],
        },
        __executionContext: agentContext,
      })
    ).rejects.toThrow('requires exact feature and assembly hash bindings');

    const proposal = {
      schema: 'codexomics.annotation-change-set.v2',
      status: 'ready_for_validation',
      target: researchedTarget,
      baseRevision: researchedTarget.annotationRevision,
      evidenceManifest: {
        schema: 'dgr.evidence-manifest.v1',
        generatedAt: '2026-01-01T00:00:00.000Z',
        pipelineVersion: 'test',
        sourceRecords: [
          {
            id: 'evidence_old_target',
            label: 'PMID:123',
            sourceHash: 'b'.repeat(64),
            retrievedAt: '2026-01-01T00:00:00.000Z',
            type: 'pmid',
            supporting: true,
          },
        ],
      },
      claims: [
        {
          id: 'claim_old_target',
          field: 'note',
          value: 'old snapshot, exact feature hash',
          evidenceIds: ['evidence_old_target'],
          confidence: 0.9,
        },
      ],
      operations: [
        {
          op: 'addQualifier',
          field: 'note',
          value: 'old snapshot, exact feature hash',
          claimIds: ['claim_old_target'],
        },
      ],
    };
    secondAnnotation.qualifiers.product = 'manual edit after research';
    await expect(
      annotationService.createAnnotationChangeset({
        identifier: 'b0002',
        baseRevision: researchedTarget.annotationRevision,
        annotationProposal: proposal,
        __executionContext: agentContext,
      })
    ).rejects.toThrow('featureHash does not match');
    secondAnnotation.qualifiers.product = 'hypothetical protein';

    const created = await annotationService.createAnnotationChangeset({
      identifier: 'b0002',
      baseRevision: researchedTarget.annotationRevision,
      annotationProposal: proposal,
      __executionContext: agentContext,
    });
    expect(created.changeSet).toMatchObject({ baseRevision: 1, proposalBaseRevision: 0 });
    const approval = await annotationService.requestAnnotationApproval({
      changeSetId: created.changeSet.id,
      __executionContext: curatorContext,
    });
    const committed = await annotationService.applyAnnotationChangeset({
      changeSetId: created.changeSet.id,
      approvalToken: approval.approvalToken,
      __executionContext: curatorContext,
    });

    expect(committed.receipt).toMatchObject({ previousRevision: 1, revision: 2 });
    expect(secondAnnotation.qualifiers.note).toBe('old snapshot, exact feature hash');
  });

  it('collapses rollback operations to the original value for fields changed more than once', async () => {
    const created = await annotationService.createAnnotationChangeset({
      identifier: 'b0001',
      operations: [
        { op: 'addQualifier', field: 'note', value: 'first note' },
        { op: 'addQualifier', field: 'note', value: 'second note' },
      ],
      __executionContext: agentContext,
    });
    const approval = await annotationService.requestAnnotationApproval({
      changeSetId: created.changeSet.id,
      __executionContext: curatorContext,
    });
    await annotationService.applyAnnotationChangeset({
      changeSetId: created.changeSet.id,
      approvalToken: approval.approvalToken,
      __executionContext: curatorContext,
    });

    const rollback = await annotationService.rollbackAnnotationChangeset({
      changeSetId: created.changeSet.id,
      __executionContext: agentContext,
    });
    expect(rollback.changeSet.operations).toHaveLength(1);
    expect(rollback.changeSet.operations[0]).toMatchObject({ op: 'removeQualifier', field: 'note' });
  });

  it('replays only the missing tail of a multi-commit feature chain after reopening', async () => {
    const originalAnnotation = JSON.parse(JSON.stringify(annotation));
    const first = await annotationService.createAnnotationChangeset({
      identifier: 'b0001',
      operations: [{ op: 'addQualifier', field: 'note', value: 'persisted note' }],
      __executionContext: agentContext,
    });
    const firstApproval = await annotationService.requestAnnotationApproval({
      changeSetId: first.changeSet.id,
      __executionContext: curatorContext,
    });
    await annotationService.applyAnnotationChangeset({
      changeSetId: first.changeSet.id,
      approvalToken: firstApproval.approvalToken,
      __executionContext: curatorContext,
    });

    const second = await annotationService.createAnnotationChangeset({
      identifier: 'b0001',
      operations: [{ op: 'addQualifier', field: 'go_terms', value: 'GO:0003674' }],
      evidence: ['GO:0003674 evidence'],
      __executionContext: agentContext,
    });
    const secondApproval = await annotationService.requestAnnotationApproval({
      changeSetId: second.changeSet.id,
      __executionContext: curatorContext,
    });
    await annotationService.applyAnnotationChangeset({
      changeSetId: second.changeSet.id,
      approvalToken: secondApproval.approvalToken,
      __executionContext: curatorContext,
    });

    const persistedLedger = JSON.parse(
      JSON.stringify(annotationService.changeSetService.memoryLedgers.get('/tmp/test.gbk'))
    );
    const mockWindow = loadServices();
    const reopenedAnnotation = JSON.parse(JSON.stringify(originalAnnotation));
    const reopenedApp = {
      currentFile: { path: '/tmp/reopened.gbk' },
      currentChromosome: 'NC_000913.3',
      currentAnnotations: { 'NC_000913.3': [reopenedAnnotation] },
      sidecarManager: {
        get: async () => JSON.parse(JSON.stringify(persistedLedger)),
        setAndForceSave: async () => {},
      },
    };
    const reopenedService = new mockWindow.AnnotationService(reopenedApp, {
      _getChangeTracker: () => ({ recordChange: () => ({}) }),
    });

    await reopenedService.restoreCommittedAnnotationOverlay();
    await reopenedService.restoreCommittedAnnotationOverlay();
    expect(reopenedAnnotation.qualifiers.note).toBe('persisted note');
    expect(reopenedAnnotation.qualifiers.go_terms).toBe('GO:0003674');
  });

  it('rejects a receipt that was re-hashed after injecting a protected-field operation', async () => {
    const originalAnnotation = JSON.parse(JSON.stringify(annotation));
    const created = await annotationService.createAnnotationChangeset({
      identifier: 'b0001',
      operations: [{ op: 'addQualifier', field: 'note', value: 'reviewed note' }],
      __executionContext: agentContext,
    });
    const approval = await annotationService.requestAnnotationApproval({
      changeSetId: created.changeSet.id,
      __executionContext: curatorContext,
    });
    await annotationService.applyAnnotationChangeset({
      changeSetId: created.changeSet.id,
      approvalToken: approval.approvalToken,
      __executionContext: curatorContext,
    });

    const persistedLedger = JSON.parse(
      JSON.stringify(annotationService.changeSetService.memoryLedgers.get('/tmp/test.gbk'))
    );
    const receipt = persistedLedger.changeSets[created.changeSet.id].commitReceipt;
    receipt.appliedOperations[0].field = 'start';
    delete receipt.receiptHash;
    receipt.receiptHash = await annotationService.changeSetService._hash(receipt);

    const mockWindow = loadServices();
    const reopenedService = new mockWindow.AnnotationService(
      {
        currentFile: { path: '/tmp/tampered.gbk' },
        currentChromosome: 'NC_000913.3',
        currentAnnotations: { 'NC_000913.3': [originalAnnotation] },
        sidecarManager: {
          get: async () => JSON.parse(JSON.stringify(persistedLedger)),
          setAndForceSave: async () => {},
        },
      },
      { _getChangeTracker: () => ({ recordChange: () => ({}) }) }
    );

    await expect(reopenedService.restoreCommittedAnnotationOverlay()).rejects.toThrow('unsafe annotation operation');
    expect(originalAnnotation.start).toBe(12);
    expect(originalAnnotation.qualifiers.note).toBeUndefined();
  });

  it('rejects missing committed ledger revisions even when the altered receipt is re-hashed', async () => {
    const originalAnnotation = JSON.parse(JSON.stringify(annotation));
    const created = await annotationService.createAnnotationChangeset({
      identifier: 'b0001',
      operations: [{ op: 'addQualifier', field: 'note', value: 'revision-bound note' }],
      __executionContext: agentContext,
    });
    const approval = await annotationService.requestAnnotationApproval({
      changeSetId: created.changeSet.id,
      __executionContext: curatorContext,
    });
    await annotationService.applyAnnotationChangeset({
      changeSetId: created.changeSet.id,
      approvalToken: approval.approvalToken,
      __executionContext: curatorContext,
    });
    const persistedLedger = JSON.parse(
      JSON.stringify(annotationService.changeSetService.memoryLedgers.get('/tmp/test.gbk'))
    );
    persistedLedger.revision = 2;
    const tamperedChangeSet = persistedLedger.changeSets[created.changeSet.id];
    tamperedChangeSet.baseRevision = 1;
    tamperedChangeSet.changeSetHash = await annotationService.changeSetService._hash(
      annotationService.changeSetService._immutableChangeSetPayload(tamperedChangeSet)
    );
    const receipt = tamperedChangeSet.commitReceipt;
    receipt.previousRevision = 1;
    receipt.revision = 2;
    delete receipt.receiptHash;
    receipt.receiptHash = await annotationService.changeSetService._hash(receipt);
    persistedLedger.committedIdempotencyKeys[tamperedChangeSet.idempotencyKey] = JSON.parse(JSON.stringify(receipt));

    const mockWindow = loadServices();
    const reopenedService = new mockWindow.AnnotationService(
      {
        currentFile: { path: '/tmp/missing-revision.gbk' },
        currentChromosome: 'NC_000913.3',
        currentAnnotations: { 'NC_000913.3': [originalAnnotation] },
        sidecarManager: {
          get: async () => JSON.parse(JSON.stringify(persistedLedger)),
          setAndForceSave: async () => {},
        },
      },
      { _getChangeTracker: () => ({ recordChange: () => ({}) }) }
    );

    await expect(reopenedService.restoreCommittedAnnotationOverlay()).rejects.toThrow('unique and contiguous');
  });

  it('rejects a committed overlay when a different assembly replaces the genome at the same path', async () => {
    annotationService.app.loadedGenomePath = '/tmp/same-path.gbk';
    annotationService.app.currentSequence = { 'NC_000913.3': 'ATGAAATAG' };
    const originalAnnotation = JSON.parse(JSON.stringify(annotation));
    const created = await annotationService.createAnnotationChangeset({
      identifier: 'b0001',
      operations: [{ op: 'addQualifier', field: 'note', value: 'assembly-bound note' }],
      __executionContext: agentContext,
    });
    const approval = await annotationService.requestAnnotationApproval({
      changeSetId: created.changeSet.id,
      __executionContext: curatorContext,
    });
    await annotationService.applyAnnotationChangeset({
      changeSetId: created.changeSet.id,
      approvalToken: approval.approvalToken,
      __executionContext: curatorContext,
    });
    const persistedLedger = JSON.parse(
      JSON.stringify(annotationService.changeSetService.memoryLedgers.get('/tmp/same-path.gbk'))
    );

    const mockWindow = loadServices();
    const replacementAnnotation = JSON.parse(JSON.stringify(originalAnnotation));
    const reopenedService = new mockWindow.AnnotationService(
      {
        loadedGenomePath: '/tmp/same-path.gbk',
        currentSequence: { 'NC_000913.3': 'ATGCCCTAG' },
        currentChromosome: 'NC_000913.3',
        currentAnnotations: { 'NC_000913.3': [replacementAnnotation] },
        sidecarManager: {
          get: async () => JSON.parse(JSON.stringify(persistedLedger)),
          setAndForceSave: async () => {},
        },
      },
      { _getChangeTracker: () => ({ recordChange: () => ({}) }) }
    );

    await expect(reopenedService.restoreCommittedAnnotationOverlay()).rejects.toThrow(
      'conflicts with the loaded genome'
    );
    expect(replacementAnnotation.qualifiers.note).toBeUndefined();
  });

  it('reissues a lost approval capability while revoking the previous token', async () => {
    const created = await annotationService.createAnnotationChangeset({
      identifier: 'b0001',
      operations: [{ op: 'addQualifier', field: 'note', value: 'reissued approval' }],
      __executionContext: agentContext,
    });
    const first = await annotationService.requestAnnotationApproval({
      changeSetId: created.changeSet.id,
      __executionContext: curatorContext,
    });
    const replacement = await annotationService.requestAnnotationApproval({
      changeSetId: created.changeSet.id,
      __executionContext: curatorContext,
    });

    expect(first.approvalToken).toMatch(/^[a-f0-9]{64}$/);
    expect(replacement.approvalToken).toMatch(/^[a-f0-9]{64}$/);
    expect(replacement.approvalToken).not.toBe(first.approvalToken);
    expect(replacement.approval.replacesApprovalId).toBe(first.approval.id);
    await expect(
      annotationService.applyAnnotationChangeset({
        changeSetId: created.changeSet.id,
        approvalToken: first.approvalToken,
        __executionContext: curatorContext,
      })
    ).rejects.toThrow('valid, unexpired');
    await expect(
      annotationService.applyAnnotationChangeset({
        changeSetId: created.changeSet.id,
        approvalToken: replacement.approvalToken,
        __executionContext: curatorContext,
      })
    ).resolves.toMatchObject({ applied: true });
  });

  it('aborts a delayed ledger read if the loaded genome changes mid-operation', async () => {
    const mockWindow = loadServices();
    let releaseRead;
    let markReadStarted;
    const readStarted = new Promise(resolve => {
      markReadStarted = resolve;
    });
    const delayedRead = new Promise(resolve => {
      releaseRead = resolve;
    });
    const app = {
      loadedGenomePath: '/tmp/genome-a.gbk',
      currentChromosome: 'chrA',
      currentAnnotations: {
        chrA: [
          {
            id: 'a1',
            type: 'CDS',
            start: 1,
            end: 9,
            strand: 1,
            qualifiers: { locus_tag: 'a1' },
          },
        ],
      },
      sidecarManager: {
        get: async () => {
          markReadStarted();
          await delayedRead;
          return {};
        },
      },
    };
    const service = new mockWindow.AnnotationService(app, {
      _getChangeTracker: () => ({ recordChange: () => ({}) }),
    });
    const pending = service.resolveAnnotationTarget({ identifier: 'a1' });
    await readStarted;
    app.loadedGenomePath = '/tmp/genome-b.gbk';
    app.currentChromosome = 'chrB';
    app.currentAnnotations = {
      chrB: [
        {
          id: 'b1',
          type: 'CDS',
          start: 1,
          end: 9,
          strand: 1,
          qualifiers: { locus_tag: 'b1' },
        },
      ],
    };
    releaseRead();

    await expect(pending).rejects.toThrow('workspace changed');
  });

  it('does not overwrite an in-place manual edit made while the commit receipt is saving', async () => {
    const mockWindow = loadServices();
    const liveAnnotation = {
      id: 'feature-live',
      type: 'CDS',
      start: 1,
      end: 90,
      strand: 1,
      qualifiers: { locus_tag: 'live1', product: 'hypothetical protein' },
    };
    let storedLedger = {};
    let releaseCommitSave;
    let markCommitSaveStarted;
    const commitSaveStarted = new Promise(resolve => {
      markCommitSaveStarted = resolve;
    });
    const commitSaveGate = new Promise(resolve => {
      releaseCommitSave = resolve;
    });
    let delayed = false;
    const app = {
      loadedGenomePath: '/tmp/live.gbk',
      currentChromosome: 'chr1',
      currentAnnotations: { chr1: [liveAnnotation] },
      sidecarManager: {
        get: async () => JSON.parse(JSON.stringify(storedLedger)),
        setAndForceSave: async (_path, _key, value) => {
          if (!delayed && Object.values(value.changeSets || {}).some(changeSet => changeSet.status === 'committed')) {
            delayed = true;
            markCommitSaveStarted();
            await commitSaveGate;
          }
          storedLedger = JSON.parse(JSON.stringify(value));
        },
      },
    };
    const service = new mockWindow.AnnotationService(app, {
      _getChangeTracker: () => ({ recordChange: () => ({}) }),
    });
    const created = await service.createAnnotationChangeset({
      identifier: 'live1',
      operations: [{ op: 'addQualifier', field: 'go_terms', value: 'GO:0003674' }],
      evidence: ['GO:0003674 evidence'],
      __executionContext: agentContext,
    });
    const approval = await service.requestAnnotationApproval({
      changeSetId: created.changeSet.id,
      __executionContext: curatorContext,
    });
    const pendingCommit = service.applyAnnotationChangeset({
      changeSetId: created.changeSet.id,
      approvalToken: approval.approvalToken,
      __executionContext: curatorContext,
    });
    await commitSaveStarted;
    liveAnnotation.qualifiers.product = 'manual curator edit during save';
    releaseCommitSave();

    await expect(pendingCommit).rejects.toThrow('reconciliation is required');
    expect(liveAnnotation.qualifiers.product).toBe('manual curator edit during save');
    expect(liveAnnotation.qualifiers.go_terms).toBeUndefined();
    expect(storedLedger.changeSets[created.changeSet.id].reconciliationConflict).toBeTruthy();
  });

  it('validates every committed feature chain before materializing any overlay', async () => {
    const secondAnnotation = {
      id: 'feature-2',
      type: 'CDS',
      start: 200,
      end: 320,
      strand: 1,
      qualifiers: { locus_tag: 'b0002', gene: 'thrA', product: 'hypothetical protein' },
    };
    annotationService.app.currentAnnotations['NC_000913.3'].push(secondAnnotation);
    const originalFirst = JSON.parse(JSON.stringify(annotation));
    const originalSecond = JSON.parse(JSON.stringify(secondAnnotation));

    const first = await annotationService.createAnnotationChangeset({
      identifier: 'b0001',
      operations: [{ op: 'addQualifier', field: 'note', value: 'first overlay' }],
      __executionContext: agentContext,
    });
    const firstApproval = await annotationService.requestAnnotationApproval({
      changeSetId: first.changeSet.id,
      __executionContext: curatorContext,
    });
    await annotationService.applyAnnotationChangeset({
      changeSetId: first.changeSet.id,
      approvalToken: firstApproval.approvalToken,
      __executionContext: curatorContext,
    });
    const second = await annotationService.createAnnotationChangeset({
      identifier: 'b0002',
      operations: [{ op: 'addQualifier', field: 'note', value: 'second overlay' }],
      __executionContext: agentContext,
    });
    const secondApproval = await annotationService.requestAnnotationApproval({
      changeSetId: second.changeSet.id,
      __executionContext: curatorContext,
    });
    await annotationService.applyAnnotationChangeset({
      changeSetId: second.changeSet.id,
      approvalToken: secondApproval.approvalToken,
      __executionContext: curatorContext,
    });
    const persistedLedger = JSON.parse(
      JSON.stringify(annotationService.changeSetService.memoryLedgers.get('/tmp/test.gbk'))
    );

    const reopenedFirst = JSON.parse(JSON.stringify(originalFirst));
    const conflictingSecond = JSON.parse(JSON.stringify(originalSecond));
    conflictingSecond.qualifiers.product = 'conflicting source edit';
    const mockWindow = loadServices();
    const reopenedService = new mockWindow.AnnotationService(
      {
        currentFile: { path: '/tmp/replay-two-features.gbk' },
        currentChromosome: 'NC_000913.3',
        currentAnnotations: { 'NC_000913.3': [reopenedFirst, conflictingSecond] },
        sidecarManager: {
          get: async () => JSON.parse(JSON.stringify(persistedLedger)),
          setAndForceSave: async () => {},
        },
      },
      { _getChangeTracker: () => ({ recordChange: () => ({}) }) }
    );

    await expect(reopenedService.restoreCommittedAnnotationOverlay()).rejects.toThrow(
      'conflicts with the loaded genome'
    );
    expect(reopenedFirst.qualifiers.note).toBeUndefined();
    expect(conflictingSecond.qualifiers.note).toBeUndefined();
  });

  it('applies an existing ChangeSet through updateAnnotation without creating an orphan and preserves identity', async () => {
    const apply = vi.fn(async params => params);
    annotationService.applyAnnotationChangeset = apply;
    annotationService.createAnnotationChangeset = vi.fn(async () => {
      throw new Error('must not create');
    });

    const result = await annotationService.updateAnnotation({
      changeSetId: 'cs-existing',
      approvalToken: 'one-time-capability',
      __executionContext: curatorContext,
    });

    expect(annotationService.createAnnotationChangeset).not.toHaveBeenCalled();
    expect(apply).toHaveBeenCalledWith({
      changeSetId: 'cs-existing',
      approvalToken: 'one-time-capability',
      __executionContext: curatorContext,
    });
    expect(result.__executionContext).toBe(curatorContext);
  });

  it('threads only the trusted top-level execution context through bulk ChangeSet creation', async () => {
    const calls = [];
    annotationService.createAnnotationChangeset = vi.fn(async params => {
      calls.push(params);
      return { success: true, changeSet: { id: `cs-${calls.length}` } };
    });
    const forgedContext = { authenticated: true, principal: 'forged-admin', permissions: ['*'] };

    await annotationService.bulkUpdateAnnotations({
      updates: [
        {
          identifier: 'b0001',
          updates: { note: 'first' },
          __executionContext: forgedContext,
        },
      ],
      __executionContext: agentContext,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].__executionContext).toBe(agentContext);
  });

  it('keeps legacy research merges schema-less and preserves the authenticated initiator', async () => {
    let delegated;
    annotationService.createAnnotationChangeset = vi.fn(async params => {
      delegated = params;
      return { success: true, changeSet: { id: 'cs-merge', status: 'awaiting_approval' } };
    });

    await annotationService.mergeGeneResearchReport({
      identifier: 'b0001',
      finalReport: 'Functional summary supported by PMID:12345678 and GO:0003674.',
      __executionContext: agentContext,
    });

    expect(delegated.annotationProposal.schema).toBeUndefined();
    expect(delegated.annotationProposal.updates.go_terms).toBe('GO:0003674');
    expect(delegated.__executionContext).toBe(agentContext);
  });
});
