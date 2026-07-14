/* eslint-disable no-new-func */
import { describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

const WORKFLOW_PATH = path.join(
  process.cwd(),
  'src/renderer/modules/chat/services/AnnotationResearchWorkflowService.js'
);

function loadWorkflowService() {
  const mockWindow = {};
  new Function('window', fs.readFileSync(WORKFLOW_PATH, 'utf8'))(mockWindow);
  return mockWindow.AnnotationResearchWorkflowService;
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
    };
    const executeToolOnServer = vi.fn(async () => ({ taskId: 'task-1', status: 'queued' }));
    const annotation = {
      resolveAnnotationTarget: vi.fn(async () => ({ target })),
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
      __executionContext: {
        authenticated: true,
        principal: 'different-researcher@example.org',
        permissions: ['annotation:research'],
      },
    });
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.workflow.initiatedBy).toBe('researcher@example.org');
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
