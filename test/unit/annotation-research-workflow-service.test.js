/* eslint-disable no-new-func */
import { describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
import fs from 'fs';
import path from 'path';

const WORKFLOW_PATH = path.join(
  process.cwd(),
  'src/renderer/modules/chat/services/AnnotationResearchWorkflowService.js'
);

function loadWorkflowService(electronAPI = undefined) {
  const mockWindow = electronAPI ? { electronAPI } : {};
  new Function('window', fs.readFileSync(WORKFLOW_PATH, 'utf8'))(mockWindow);
  return mockWindow.AnnotationResearchWorkflowService;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        if (value[key] !== undefined) result[key] = canonicalize(value[key]);
        return result;
      }, {});
  }
  return value;
}

function currentAnnotationValidation(options) {
  return {
    schema: 'codexomics.dgr-current-annotation-validation.v1',
    verified: true,
    required: options.requireCurrentAnnotation === true,
    snapshotSha256: crypto
      .createHash('sha256')
      .update(JSON.stringify(canonicalize(options.currentAnnotation)))
      .digest('hex'),
    targetFeatureHash: options.target.featureHash,
  };
}

describe('AnnotationResearchWorkflowService', () => {
  it('derives organism metadata, forwards bounded research options, and records the authenticated initiator', async () => {
    const AnnotationResearchWorkflowService = loadWorkflowService();
    const target = {
      workspaceId: 'ws-1',
      genomeId: 'genome-1',
      annotationRevision: 0,
      featureId: 'feature-1',
      featureHash: 'hash-1',
      chromosome: 'chr1',
      locusTag: 'b0001',
      geneSymbol: 'thrL',
      organism: 'Escherichia coli',
      featureType: 'CDS',
    };
    const executeToolOnServer = vi.fn(async () => ({ taskId: 'task-1', status: 'queued' }));
    const annotation = {
      resolveAnnotationTarget: vi.fn(async () => ({
        target,
        annotation: {
          qualifiers: {
            product: [' hypothetical protein '],
            EC_number: [],
            ec_number: ['2.7.1.39', '2.7.1.39'],
            GO_terms: 'GO:0004413',
            KO: 'K00872',
            pathway: ['KEGG:eco00260'],
            db_xref: ['UniProtKB:P00547'],
            note: 'existing curator note',
          },
        },
      })),
    };
    const service = new AnnotationResearchWorkflowService(
      { currentChromosome: 'chr1', currentAnnotations: { chr1: [{}] } },
      {
        services: { annotation },
        mcpServerManager: {
          ensureServerConnected: vi.fn(async () => true),
          executeToolOnServer,
        },
      }
    );
    const context = {
      authenticated: true,
      principal: 'researcher@example.org',
      permissions: ['annotation:research'],
    };

    const result = await service.startAnnotationResearch({
      identifier: 'b0001',
      diseaseContext: 'metabolic disease',
      experimentalApproach: 'proteomics',
      language: 'zh-CN',
      maxResult: 8,
      forceRefresh: true,
      __executionContext: context,
    });

    expect(executeToolOnServer).toHaveBeenCalledWith(
      'deep-gene-research',
      'deep-gene-research',
      expect.objectContaining({
        organism: 'Escherichia coli',
        diseaseContext: 'metabolic disease',
        experimentalApproach: 'proteomics',
        language: 'zh-CN',
        maxResult: 8,
        forceRefresh: true,
        currentAnnotation: {
          product: 'hypothetical protein',
          note: ['existing curator note'],
          EC_number: ['2.7.1.39'],
          go_terms: ['GO:0004413'],
          ko: ['K00872'],
          pathway: ['KEGG:eco00260'],
          db_xref: ['UniProtKB:P00547'],
        },
        idempotencyKey: expect.stringContaining('genome-1'),
      })
    );
    expect(result.workflow.initiatedBy).toBe('researcher@example.org');

    const duplicate = await service.startAnnotationResearch({
      identifier: 'b0001',
      diseaseContext: 'metabolic disease',
      experimentalApproach: 'proteomics',
      language: 'zh-CN',
      maxResult: 8,
      forceRefresh: true,
      __executionContext: {
        authenticated: true,
        principal: 'different-researcher@example.org',
        permissions: ['annotation:research'],
      },
    });
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.workflow.initiatedBy).toBe('researcher@example.org');
  });

  it('starts exact CDS research when protein_id is the only stable target identifier', async () => {
    const Service = loadWorkflowService();
    const target = {
      workspaceId: 'ws-1',
      genomeId: 'genome-1',
      annotationRevision: 0,
      featureId: 'feature-protein-only',
      featureHash: 'hash-protein-only',
      chromosome: 'chr1',
      locusTag: null,
      geneSymbol: null,
      proteinId: 'NP_418448.1',
      organism: 'Escherichia coli',
      featureType: 'CDS',
    };
    const executeToolOnServer = vi.fn(async () => ({ taskId: 'task-protein-only', status: 'queued' }));
    const service = new Service(
      { currentChromosome: 'chr1', currentAnnotations: { chr1: [{}] } },
      {
        services: { annotation: { resolveAnnotationTarget: vi.fn(async () => ({ target })) } },
        mcpServerManager: { ensureServerConnected: vi.fn(async () => true), executeToolOnServer },
      }
    );

    await service.startAnnotationResearch({ identifier: 'NP_418448.1' });
    expect(executeToolOnServer).toHaveBeenCalledWith(
      'deep-gene-research',
      'deep-gene-research',
      expect.objectContaining({ geneSymbol: 'NP_418448.1', target })
    );
  });

  it.each([
    [{ featureType: 'tRNA', locusTag: 'b0001' }, 'restricted to resolved CDS features'],
    [{ featureType: 'CDS', locusTag: null, proteinId: null }, 'requires a stable locus tag or protein identifier'],
  ])('rejects identity-unsafe research targets before contacting DGR', async (targetOverrides, expectedError) => {
    const AnnotationResearchWorkflowService = loadWorkflowService();
    const executeToolOnServer = vi.fn();
    const target = {
      workspaceId: 'ws-1',
      genomeId: 'genome-1',
      annotationRevision: 0,
      featureId: 'feature-1',
      featureHash: 'hash-1',
      chromosome: 'chr1',
      locusTag: 'b0001',
      geneSymbol: 'thrL',
      organism: 'Escherichia coli',
      featureType: 'CDS',
      ...targetOverrides,
    };
    const service = new AnnotationResearchWorkflowService(
      { currentChromosome: 'chr1', currentAnnotations: { chr1: [{}] } },
      {
        services: { annotation: { resolveAnnotationTarget: vi.fn(async () => ({ target })) } },
        mcpServerManager: { ensureServerConnected: vi.fn(), executeToolOnServer },
      }
    );

    await expect(service.startAnnotationResearch({ identifier: 'b0001' })).rejects.toThrow(expectedError);
    expect(executeToolOnServer).not.toHaveBeenCalled();
  });

  it('persists evidence-free draft completion without repeatedly creating a ChangeSet', async () => {
    const AnnotationResearchWorkflowService = loadWorkflowService();
    const target = {
      workspaceId: 'ws-1',
      genomeId: 'genome-1',
      annotationRevision: 0,
      featureId: 'feature-1',
      featureHash: 'hash-1',
      chromosome: 'chr1',
      locusTag: 'b0001',
      geneSymbol: 'thrL',
      organism: 'Escherichia coli',
      featureType: 'CDS',
    };
    const createAnnotationChangeset = vi.fn(async () => {
      throw new Error('draft proposal must not be delegated');
    });
    const manager = {
      ensureServerConnected: vi.fn(async () => true),
      executeToolOnServer: vi.fn(async () => ({ taskId: 'task-draft', status: 'queued' })),
      checkTaskStatus: vi.fn(async () => ({
        status: 'completed',
        result: {
          annotationProposal: {
            schema: 'codexomics.annotation-change-set.v2',
            status: 'draft_requires_evidence',
          },
        },
      })),
    };
    const annotation = {
      resolveAnnotationTarget: vi.fn(async () => ({ target })),
      createAnnotationChangeset,
    };
    const service = new AnnotationResearchWorkflowService(
      { currentChromosome: 'chr1', currentAnnotations: { chr1: [{}] } },
      { services: { annotation }, mcpServerManager: manager }
    );

    await service.startAnnotationResearch({ identifier: 'b0001' });
    const first = await service.getAnnotationResearchWorkflow({ taskId: 'task-draft' });
    const second = await service.getAnnotationResearchWorkflow({ taskId: 'task-draft' });

    expect(first.workflow).toMatchObject({
      proposalStatus: 'draft_requires_evidence',
      changeSetStatus: 'not_created',
    });
    expect(first.workflow.proposalReason).toContain('no evidence-backed claims');
    expect(second.workflow.proposalHandledAt).toBe(first.workflow.proposalHandledAt);
    expect(createAnnotationChangeset).not.toHaveBeenCalled();
  });

  it('archives a completed full report once and registers a compact CDS attachment before proposal handling', async () => {
    const events = [];
    const archiveDgrTaskResult = vi.fn(async options => {
      events.push('archive');
      return {
        success: true,
        artifact: {
          taskId: options.taskId,
          fileName: 'DGR_task-archive_abc123.json',
          storedPath: '/private/dgr/DGR_task-archive_abc123.json',
          size: 4096,
          sha256: 'a'.repeat(64),
          currentAnnotationValidation: currentAnnotationValidation(options),
          storedAt: '2026-07-16T01:00:00.000Z',
          summary: { title: 'lysC full report', sourceCount: 39, confidence: 0.92 },
        },
      };
    });
    const AnnotationResearchWorkflowService = loadWorkflowService({ archiveDgrTaskResult });
    const target = {
      workspaceId: 'ws-1',
      genomeId: 'genome-1',
      annotationRevision: 0,
      featureId: 'feature-1',
      featureHash: 'hash-1',
      chromosome: 'chr1',
      locusTag: 'b4024',
      geneSymbol: 'lysC',
      organism: 'Escherichia coli',
      featureType: 'CDS',
    };
    const registerGeneratedAttachment = vi.fn(async () => {
      events.push('register');
      return { id: 'dgr:task-archive', filename: 'DGR_task-archive_abc123.json' };
    });
    const manager = {
      ensureServerConnected: vi.fn(async () => true),
      executeToolOnServer: vi.fn(async () => ({ taskId: 'task-archive', status: 'queued' })),
      checkTaskStatus: vi.fn(async () => ({
        status: 'completed',
        result: {
          annotationProposal: {
            schema: 'codexomics.annotation-change-set.v2',
            status: 'draft_requires_evidence',
          },
        },
      })),
    };
    const service = new AnnotationResearchWorkflowService(
      {
        currentChromosome: 'chr1',
        currentAnnotations: { chr1: [{}] },
        geneAttachmentsManager: { registerGeneratedAttachment },
      },
      {
        services: { annotation: { resolveAnnotationTarget: vi.fn(async () => ({ target })) } },
        mcpServerManager: manager,
      }
    );

    await service.startAnnotationResearch({ identifier: 'b4024' });
    const first = await service.getAnnotationResearchWorkflow({ taskId: 'task-archive' });
    await service.getAnnotationResearchWorkflow({ taskId: 'task-archive' });

    expect(events).toEqual(['archive', 'register']);
    expect(archiveDgrTaskResult).toHaveBeenCalledWith(expect.objectContaining({ taskId: 'task-archive', target }));
    expect(registerGeneratedAttachment).toHaveBeenCalledWith(
      'b4024',
      expect.objectContaining({ storedPath: '/private/dgr/DGR_task-archive_abc123.json' }),
      target
    );
    expect(first.workflow.reportAttachment).toEqual(
      expect.objectContaining({ attachmentId: 'dgr:task-archive', geneId: 'b4024', size: 4096 })
    );
    expect(first.workflow.reportAttachment).not.toHaveProperty('storedPath');
    expect(archiveDgrTaskResult).toHaveBeenCalledTimes(1);
  });

  it('does not create a ChangeSet when durable full-report archival fails', async () => {
    const archiveDgrTaskResult = vi.fn(async () => {
      throw new Error('artifact disk unavailable');
    });
    const AnnotationResearchWorkflowService = loadWorkflowService({ archiveDgrTaskResult });
    const target = {
      workspaceId: 'ws-1',
      genomeId: 'genome-1',
      annotationRevision: 0,
      featureId: 'feature-1',
      featureHash: 'hash-1',
      chromosome: 'chr1',
      locusTag: 'b4024',
      geneSymbol: 'lysC',
      organism: 'Escherichia coli',
      featureType: 'CDS',
    };
    const createAnnotationChangeset = vi.fn();
    const service = new AnnotationResearchWorkflowService(
      {
        currentChromosome: 'chr1',
        currentAnnotations: { chr1: [{}] },
        geneAttachmentsManager: { registerGeneratedAttachment: vi.fn() },
      },
      {
        services: {
          annotation: {
            resolveAnnotationTarget: vi.fn(async () => ({ target })),
            createAnnotationChangeset,
          },
        },
        mcpServerManager: {
          ensureServerConnected: vi.fn(async () => true),
          executeToolOnServer: vi.fn(async () => ({ taskId: 'task-archive-failure', status: 'queued' })),
          checkTaskStatus: vi.fn(async () => ({
            status: 'completed',
            result: {
              annotationProposal: {
                schema: 'codexomics.annotation-change-set.v2',
                status: 'ready_for_validation',
              },
            },
          })),
        },
      }
    );

    await service.startAnnotationResearch({ identifier: 'b4024' });
    await expect(service.getAnnotationResearchWorkflow({ taskId: 'task-archive-failure' })).rejects.toThrow(
      'artifact disk unavailable'
    );
    expect(createAnnotationChangeset).not.toHaveBeenCalled();
  });

  it('archives a directly started DGR task through the external MCP workflow', async () => {
    const target = {
      workspaceId: 'ws-1',
      genomeId: 'genome-1',
      annotationRevision: 0,
      featureId: 'feature-1',
      featureHash: 'hash-1',
      chromosome: 'chr1',
      locusTag: 'b4024',
      geneSymbol: 'lysC',
      organism: 'Escherichia coli',
      featureType: 'CDS',
    };
    const archiveDgrTaskResult = vi.fn(async options => ({
      success: true,
      artifact: {
        taskId: 'external-task-1',
        fileName: 'DGR_external-task-1.json',
        storedPath: '/private/dgr/DGR_external-task-1.json',
        size: 8192,
        sha256: 'a'.repeat(64),
        proposalSha256: 'b'.repeat(64),
        citationValidation: {
          schema: 'codexomics.dgr-citation-validation.v1',
          verified: true,
          factCount: 4,
        },
        currentAnnotationValidation: currentAnnotationValidation(options),
      },
    }));
    const registerGeneratedAttachment = vi.fn(async () => ({
      id: 'dgr:external-task-1',
      filename: 'DGR_external-task-1.json',
    }));
    const Service = loadWorkflowService({ archiveDgrTaskResult });
    const service = new Service(
      {
        currentChromosome: 'chr1',
        currentAnnotations: { chr1: [{}] },
        geneAttachmentsManager: { registerGeneratedAttachment },
      },
      {
        services: { annotation: { resolveAnnotationTarget: vi.fn(async () => ({ target })) } },
        mcpServerManager: {},
      }
    );
    const params = {
      taskId: 'external-task-1',
      correlationId: 'external-correlation-1',
      identifier: 'b4024',
      __executionContext: {
        authenticated: true,
        principal: 'external-agent',
        permissions: ['annotation:research'],
      },
    };

    const first = await service.archiveAnnotationResearch(params);
    const duplicate = await service.archiveAnnotationResearch(params);

    expect(first).toMatchObject({
      success: true,
      taskId: 'external-task-1',
      reportAttachment: {
        attachmentId: 'dgr:external-task-1',
        proposalSha256: 'b'.repeat(64),
      },
    });
    expect(first.reportAttachment).not.toHaveProperty('storedPath');
    expect(duplicate.reportAttachment).toEqual(first.reportAttachment);
    await expect(
      service.archiveAnnotationResearch({ ...params, correlationId: 'different-correlation' })
    ).rejects.toThrow('different annotation research workflow');
    expect(archiveDgrTaskResult).toHaveBeenCalledTimes(1);
    expect(archiveDgrTaskResult).toHaveBeenCalledWith(
      expect.objectContaining({
        currentAnnotation: {
          note: [],
          EC_number: [],
          go_terms: [],
          ko: [],
          pathway: [],
          db_xref: [],
        },
        requireCurrentAnnotation: true,
      })
    );
    expect(first.reportAttachment.currentAnnotationValidation).toMatchObject({
      verified: true,
      targetFeatureHash: target.featureHash,
    });
    expect(registerGeneratedAttachment).toHaveBeenCalledTimes(1);
  });

  it('checks external archive history capacity before writing an attachment', async () => {
    const target = {
      workspaceId: 'ws-1',
      genomeId: 'genome-1',
      annotationRevision: 0,
      featureId: 'feature-1',
      featureHash: 'hash-1',
      chromosome: 'chr1',
      locusTag: 'b4024',
      geneSymbol: 'lysC',
      organism: 'Escherichia coli',
      featureType: 'CDS',
    };
    const archiveDgrTaskResult = vi.fn();
    const Service = loadWorkflowService({ archiveDgrTaskResult });
    const service = new Service(
      { currentChromosome: 'chr1', currentAnnotations: { chr1: [{}] }, geneAttachmentsManager: {} },
      {
        services: { annotation: { resolveAnnotationTarget: vi.fn(async () => ({ target })) } },
        mcpServerManager: {},
      }
    );
    service.runLimits = Object.freeze({ ...service.runLimits, total: 0 });

    await expect(
      service.archiveAnnotationResearch({
        taskId: 'external-capacity-task',
        correlationId: 'external-capacity-correlation',
        identifier: 'b4024',
      })
    ).rejects.toThrow('retention ceiling');
    expect(archiveDgrTaskResult).not.toHaveBeenCalled();
  });

  it('rejects an annotation-mode proposal that differs from the citation-verified full archive', async () => {
    const target = {
      workspaceId: 'ws-1',
      genomeId: 'genome-1',
      annotationRevision: 0,
      featureId: 'feature-1',
      featureHash: 'hash-1',
      chromosome: 'chr1',
      locusTag: 'b4024',
      geneSymbol: 'lysC',
      organism: 'Escherichia coli',
      featureType: 'CDS',
    };
    const archiveDgrTaskResult = vi.fn(async options => ({
      success: true,
      artifact: {
        taskId: 'task-proposal-mismatch',
        fileName: 'DGR_mismatch.json',
        storedPath: '/private/dgr/mismatch.json',
        size: 4096,
        sha256: 'a'.repeat(64),
        proposalSha256: 'c'.repeat(64),
        citationValidation: { schema: 'codexomics.dgr-citation-validation.v1', verified: true, factCount: 1 },
        currentAnnotationValidation: currentAnnotationValidation(options),
      },
    }));
    const createAnnotationChangeset = vi.fn();
    const Service = loadWorkflowService({ archiveDgrTaskResult });
    const service = new Service(
      {
        currentChromosome: 'chr1',
        currentAnnotations: { chr1: [{}] },
        geneAttachmentsManager: {
          registerGeneratedAttachment: vi.fn(async () => ({ id: 'dgr:task-proposal-mismatch' })),
        },
      },
      {
        services: {
          annotation: { resolveAnnotationTarget: vi.fn(async () => ({ target })), createAnnotationChangeset },
        },
        mcpServerManager: {
          ensureServerConnected: vi.fn(async () => true),
          executeToolOnServer: vi.fn(async () => ({ taskId: 'task-proposal-mismatch', status: 'queued' })),
          checkTaskStatus: vi.fn(async () => ({
            status: 'completed',
            result: {
              annotationProposal: { schema: 'codexomics.annotation-change-set.v2', status: 'ready_for_validation' },
            },
          })),
        },
      }
    );

    await service.startAnnotationResearch({ identifier: 'b4024' });
    await expect(service.getAnnotationResearchWorkflow({ taskId: 'task-proposal-mismatch' })).rejects.toThrow(
      'does not match its archived full report'
    );
    expect(createAnnotationChangeset).not.toHaveBeenCalled();
  });

  it('preserves the authenticated context when materializing a completed research proposal', async () => {
    const AnnotationResearchWorkflowService = loadWorkflowService();
    const context = {
      authenticated: true,
      principal: 'researcher@example.org',
      permissions: ['annotation:research', 'annotation:propose'],
    };
    const target = {
      workspaceId: 'ws-1',
      genomeId: 'genome-1',
      annotationRevision: 0,
      featureId: 'feature-1',
      featureHash: 'hash-1',
      chromosome: 'chr1',
      locusTag: 'b0001',
      geneSymbol: 'thrL',
      organism: 'Escherichia coli',
      featureType: 'CDS',
    };
    const proposal = { schema: 'codexomics.annotation-change-set.v2', status: 'ready_for_validation' };
    const createAnnotationChangeset = vi.fn(async () => ({
      changeSet: { id: 'changeset-1', status: 'awaiting_approval' },
    }));
    const manager = {
      ensureServerConnected: vi.fn(async () => true),
      executeToolOnServer: vi.fn(async () => ({ taskId: 'task-ready', status: 'queued' })),
      checkTaskStatus: vi.fn(async () => ({ status: 'completed', result: { annotationProposal: proposal } })),
    };
    const service = new AnnotationResearchWorkflowService(
      { currentChromosome: 'chr1', currentAnnotations: { chr1: [{}] } },
      {
        services: {
          annotation: {
            resolveAnnotationTarget: vi.fn(async () => ({ target })),
            createAnnotationChangeset,
          },
        },
        mcpServerManager: manager,
      }
    );

    await service.startAnnotationResearch({ identifier: 'b0001', __executionContext: context });
    await service.getAnnotationResearchWorkflow({ taskId: 'task-ready', __executionContext: context });

    expect(createAnnotationChangeset).toHaveBeenCalledWith(
      expect.objectContaining({ annotationProposal: proposal, __executionContext: context })
    );
  });

  it('persists completed research for a research-only caller and defers ChangeSet creation', async () => {
    const AnnotationResearchWorkflowService = loadWorkflowService();
    const researchContext = {
      authenticated: true,
      principal: 'research-only@example.org',
      permissions: ['annotation:research'],
    };
    const proposeContext = {
      ...researchContext,
      permissions: ['annotation:research', 'annotation:propose'],
    };
    const target = {
      workspaceId: 'ws-1',
      genomeId: 'genome-1',
      annotationRevision: 0,
      featureId: 'feature-1',
      featureHash: 'hash-1',
      chromosome: 'chr1',
      locusTag: 'b0001',
      geneSymbol: 'thrL',
      organism: 'Escherichia coli',
      featureType: 'CDS',
    };
    const proposal = { schema: 'codexomics.annotation-change-set.v2', status: 'ready_for_validation' };
    const createAnnotationChangeset = vi.fn(async () => ({
      changeSet: { id: 'changeset-deferred', status: 'awaiting_approval' },
    }));
    const manager = {
      ensureServerConnected: vi.fn(async () => true),
      executeToolOnServer: vi.fn(async () => ({ taskId: 'task-deferred', status: 'queued' })),
      checkTaskStatus: vi.fn(async () => ({ status: 'completed', result: { annotationProposal: proposal } })),
    };
    const service = new AnnotationResearchWorkflowService(
      { currentChromosome: 'chr1', currentAnnotations: { chr1: [{}] } },
      {
        services: {
          annotation: {
            resolveAnnotationTarget: vi.fn(async () => ({ target })),
            createAnnotationChangeset,
          },
        },
        mcpServerManager: manager,
      }
    );

    await service.startAnnotationResearch({ identifier: 'b0001', __executionContext: researchContext });
    const deferred = await service.getAnnotationResearchWorkflow({
      taskId: 'task-deferred',
      __executionContext: researchContext,
    });

    expect(deferred.workflow).toMatchObject({
      status: 'completed',
      proposalAvailable: true,
      changeSetStatus: 'requires_annotation_propose',
    });
    expect(createAnnotationChangeset).not.toHaveBeenCalled();

    const materialized = await service.getAnnotationResearchWorkflow({
      taskId: 'task-deferred',
      __executionContext: proposeContext,
    });
    expect(materialized.workflow).toMatchObject({
      changeSetId: 'changeset-deferred',
      changeSetStatus: 'awaiting_approval',
    });
    expect(createAnnotationChangeset).toHaveBeenCalledTimes(1);
  });

  it('materializes the first durably bound proposal when a later DGR response omits it', async () => {
    const AnnotationResearchWorkflowService = loadWorkflowService();
    const researchContext = {
      authenticated: true,
      principal: 'research-only@example.org',
      permissions: ['annotation:research'],
    };
    const proposeContext = {
      ...researchContext,
      permissions: ['annotation:research', 'annotation:propose'],
    };
    const target = {
      workspaceId: 'ws-1',
      genomeId: 'genome-1',
      annotationRevision: 0,
      featureId: 'feature-1',
      featureHash: 'hash-1',
      chromosome: 'chr1',
      locusTag: 'b0001',
      geneSymbol: 'thrL',
      organism: 'Escherichia coli',
      featureType: 'CDS',
    };
    const firstProposal = {
      schema: 'codexomics.annotation-change-set.v2',
      status: 'ready_for_validation',
      updates: { product: 'first evidence-bound product' },
    };
    const createAnnotationChangeset = vi.fn(async () => ({
      changeSet: { id: 'changeset-bound', status: 'awaiting_approval' },
    }));
    const checkTaskStatus = vi
      .fn()
      .mockResolvedValueOnce({ status: 'completed', result: { annotationProposal: firstProposal } })
      .mockResolvedValueOnce({ status: 'completed', result: {} });
    const service = new AnnotationResearchWorkflowService(
      { currentChromosome: 'chr1', currentAnnotations: { chr1: [{}] } },
      {
        services: {
          annotation: {
            resolveAnnotationTarget: vi.fn(async () => ({ target })),
            createAnnotationChangeset,
          },
        },
        mcpServerManager: {
          ensureServerConnected: vi.fn(async () => true),
          executeToolOnServer: vi.fn(async () => ({ taskId: 'task-bound', status: 'queued' })),
          checkTaskStatus,
        },
      }
    );

    await service.startAnnotationResearch({ identifier: 'b0001', __executionContext: researchContext });
    const captured = await service.getAnnotationResearchWorkflow({
      taskId: 'task-bound',
      __executionContext: researchContext,
    });
    expect(captured.workflow.proposalHash).toEqual(expect.any(String));
    expect(captured.workflow.proposalSnapshot).toEqual(firstProposal);

    const materialized = await service.getAnnotationResearchWorkflow({
      taskId: 'task-bound',
      __executionContext: proposeContext,
    });
    expect(materialized.result.annotationProposal).toEqual(firstProposal);
    expect(createAnnotationChangeset).toHaveBeenCalledWith(
      expect.objectContaining({ annotationProposal: firstProposal })
    );
  });

  it('does not mutate the cached workflow object when durable persistence fails', async () => {
    const AnnotationResearchWorkflowService = loadWorkflowService();
    const persistedRuns = {
      'task-failed-save': {
        taskId: 'task-failed-save',
        status: 'queued',
        target: { featureId: 'feature-1', chromosome: 'chr1' },
        changeSetId: null,
      },
    };
    const service = new AnnotationResearchWorkflowService(
      {
        loadedGenomePath: '/tmp/workflow.gbk',
        currentChromosome: 'chr1',
        currentAnnotations: { chr1: [{}] },
        sidecarManager: {
          get: vi.fn(async () => persistedRuns),
          setAndForceSave: vi.fn(async () => {
            throw new Error('disk unavailable');
          }),
        },
      },
      {
        services: { annotation: {} },
        mcpServerManager: {
          checkTaskStatus: vi.fn(async () => ({ status: 'running', progress: 42, step: 'literature' })),
        },
      }
    );

    await expect(service.getAnnotationResearchWorkflow({ taskId: 'task-failed-save' })).rejects.toThrow(
      'disk unavailable'
    );
    expect(persistedRuns['task-failed-save']).toEqual({
      taskId: 'task-failed-save',
      status: 'queued',
      target: { featureId: 'feature-1', chromosome: 'chr1' },
      changeSetId: null,
    });
  });

  it('binds default research idempotency to the exact workspace and feature snapshot', async () => {
    const AnnotationResearchWorkflowService = loadWorkflowService();
    const targets = [
      {
        workspaceId: 'workspace-a',
        genomeId: 'same-assembly',
        annotationRevision: 0,
        featureId: 'feature-1',
        featureHash: 'qualifiers-a',
        chromosome: 'chr1',
        locusTag: 'b0001',
        geneSymbol: 'thrL',
        organism: 'Escherichia coli',
        featureType: 'CDS',
      },
      {
        workspaceId: 'workspace-b',
        genomeId: 'same-assembly',
        annotationRevision: 0,
        featureId: 'feature-1',
        featureHash: 'qualifiers-b',
        chromosome: 'chr1',
        locusTag: 'b0001',
        geneSymbol: 'thrL',
        organism: 'Escherichia coli',
        featureType: 'CDS',
      },
    ];
    const executeToolOnServer = vi
      .fn()
      .mockResolvedValueOnce({ taskId: 'task-a', status: 'queued' })
      .mockResolvedValueOnce({ taskId: 'task-b', status: 'queued' });
    const service = new AnnotationResearchWorkflowService(
      { currentChromosome: 'chr1', currentAnnotations: { chr1: [{}] } },
      {
        services: { annotation: { resolveAnnotationTarget: vi.fn(async () => ({ target: targets.shift() })) } },
        mcpServerManager: { ensureServerConnected: vi.fn(async () => true), executeToolOnServer },
      }
    );

    await service.startAnnotationResearch({ identifier: 'b0001' });
    await service.startAnnotationResearch({ identifier: 'b0001' });

    const firstKey = executeToolOnServer.mock.calls[0][2].idempotencyKey;
    const secondKey = executeToolOnServer.mock.calls[1][2].idempotencyKey;
    expect(firstKey).toContain('same-assembly');
    expect(secondKey).toContain('same-assembly');
    expect(firstKey).not.toBe(secondKey);
  });

  it('rejects explicit idempotency-key reuse when any exact target field changes', async () => {
    const AnnotationResearchWorkflowService = loadWorkflowService();
    const baseTarget = {
      workspaceId: 'workspace-a',
      genomeId: 'same-assembly',
      annotationRevision: 0,
      featureId: 'feature-1',
      featureHash: 'same-feature-hash',
      chromosome: 'chr1',
      locusTag: 'b0001',
      geneSymbol: 'thrL',
      organism: 'Escherichia coli',
      featureType: 'CDS',
    };
    const targets = [baseTarget, { ...baseTarget, annotationRevision: 1 }];
    const executeToolOnServer = vi.fn(async () => ({ taskId: 'task-exact', status: 'queued' }));
    const service = new AnnotationResearchWorkflowService(
      { currentChromosome: 'chr1', currentAnnotations: { chr1: [{}] } },
      {
        services: { annotation: { resolveAnnotationTarget: vi.fn(async () => ({ target: targets.shift() })) } },
        mcpServerManager: { ensureServerConnected: vi.fn(async () => true), executeToolOnServer },
      }
    );

    await service.startAnnotationResearch({ identifier: 'b0001', idempotencyKey: 'explicit-bound-key' });
    await expect(
      service.startAnnotationResearch({ identifier: 'b0001', idempotencyKey: 'explicit-bound-key' })
    ).rejects.toThrow('different bound request');
    expect(executeToolOnServer).toHaveBeenCalledTimes(1);
  });

  it('stores prototype-reserved DGR task IDs without colliding with object inheritance', async () => {
    const AnnotationResearchWorkflowService = loadWorkflowService();
    const target = {
      workspaceId: 'ws-1',
      genomeId: 'genome-1',
      annotationRevision: 0,
      featureId: 'feature-1',
      featureHash: 'hash-1',
      chromosome: 'chr1',
      locusTag: 'b0001',
      geneSymbol: 'thrL',
      organism: 'Escherichia coli',
      featureType: 'CDS',
    };
    const executeToolOnServer = vi
      .fn()
      .mockResolvedValueOnce({ taskId: 'constructor', status: 'queued' })
      .mockResolvedValueOnce({ taskId: '__proto__', status: 'queued' });
    const service = new AnnotationResearchWorkflowService(
      { currentChromosome: 'chr1', currentAnnotations: { chr1: [{}] } },
      {
        services: { annotation: { resolveAnnotationTarget: vi.fn(async () => ({ target })) } },
        mcpServerManager: { ensureServerConnected: vi.fn(async () => true), executeToolOnServer },
      }
    );

    const first = await service.startAnnotationResearch({ identifier: 'b0001', idempotencyKey: 'reserved-1' });
    const second = await service.startAnnotationResearch({ identifier: 'b0001', idempotencyKey: 'reserved-2' });

    expect(first.workflow.taskId).toBe('constructor');
    expect(second.workflow.taskId).toBe('__proto__');
    const runs = service.memoryRuns.get('chr1');
    expect(Object.prototype.hasOwnProperty.call(runs, 'constructor')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(runs, '__proto__')).toBe(true);
    expect(Object.prototype.taskId).toBeUndefined();
  });

  it('enforces workflow retention before creating another remote DGR task', async () => {
    const AnnotationResearchWorkflowService = loadWorkflowService();
    const target = {
      workspaceId: 'ws-1',
      genomeId: 'genome-1',
      annotationRevision: 0,
      featureId: 'feature-1',
      featureHash: 'hash-1',
      chromosome: 'chr1',
      locusTag: 'b0001',
      geneSymbol: 'thrL',
      organism: 'Escherichia coli',
      featureType: 'CDS',
    };
    const executeToolOnServer = vi.fn(async (_server, _tool, params) => ({
      taskId: `task-${params.idempotencyKey}`,
      status: 'queued',
    }));
    const service = new AnnotationResearchWorkflowService(
      { currentChromosome: 'chr1', currentAnnotations: { chr1: [{}] } },
      {
        services: { annotation: { resolveAnnotationTarget: vi.fn(async () => ({ target })) } },
        mcpServerManager: { ensureServerConnected: vi.fn(async () => true), executeToolOnServer },
      }
    );
    service.runLimits = { ...service.runLimits, total: 1 };

    await service.startAnnotationResearch({ identifier: 'b0001', idempotencyKey: 'one' });
    await expect(service.startAnnotationResearch({ identifier: 'b0001', idempotencyKey: 'two' })).rejects.toThrow(
      '1-run retention ceiling'
    );
    expect(executeToolOnServer).toHaveBeenCalledTimes(1);
  });

  it('projects the exact durable association size before starting a remote task', async () => {
    const AnnotationResearchWorkflowService = loadWorkflowService();
    const target = {
      workspaceId: 'ws-1',
      genomeId: 'genome-1',
      annotationRevision: 0,
      featureId: 'feature-1',
      featureHash: 'hash-1',
      chromosome: 'chr1',
      locusTag: 'b0001',
      geneSymbol: 'thrL',
      organism: 'Escherichia coli',
      featureType: 'CDS',
    };
    const executeToolOnServer = vi.fn(async () => ({ taskId: 'must-not-start', status: 'queued' }));
    const service = new AnnotationResearchWorkflowService(
      { currentChromosome: 'chr1', currentAnnotations: { chr1: [{}] } },
      {
        services: { annotation: { resolveAnnotationTarget: vi.fn(async () => ({ target })) } },
        mcpServerManager: { ensureServerConnected: vi.fn(async () => true), executeToolOnServer },
      }
    );
    service.runLimits = { ...service.runLimits, serializedBytes: 512 };

    await expect(service.startAnnotationResearch({ identifier: 'b0001' })).rejects.toThrow(
      '512-byte retention ceiling'
    );
    expect(executeToolOnServer).not.toHaveBeenCalled();
  });

  it('normalizes unbounded remote status metadata before durable association', async () => {
    const AnnotationResearchWorkflowService = loadWorkflowService();
    const target = {
      workspaceId: 'ws-1',
      genomeId: 'genome-1',
      annotationRevision: 0,
      featureId: 'feature-1',
      featureHash: 'hash-1',
      chromosome: 'chr1',
      locusTag: 'b0001',
      geneSymbol: 'thrL',
      organism: 'Escherichia coli',
      featureType: 'CDS',
    };
    const service = new AnnotationResearchWorkflowService(
      { currentChromosome: 'chr1', currentAnnotations: { chr1: [{}] } },
      {
        services: { annotation: { resolveAnnotationTarget: vi.fn(async () => ({ target })) } },
        mcpServerManager: {
          ensureServerConnected: vi.fn(async () => true),
          executeToolOnServer: vi.fn(async () => ({ taskId: 'task-bounded-status', status: 'x'.repeat(100_000) })),
        },
      }
    );

    const result = await service.startAnnotationResearch({ identifier: 'b0001' });

    expect(result.workflow.status).toBe('pending');
    expect(service.memoryRuns.get('chr1')['task-bounded-status'].status).toBe('pending');
  });

  it('requires a stable researcher identity for externally authenticated workflows', async () => {
    const AnnotationResearchWorkflowService = loadWorkflowService();
    const service = new AnnotationResearchWorkflowService({}, {});

    await expect(
      service.startAnnotationResearch({
        identifier: 'b0001',
        __executionContext: { authenticated: true, permissions: ['annotation:research'] },
      })
    ).rejects.toThrow('researcher identity is required');
  });
});
