/* eslint-disable no-new-func */
/**
 * Automatic annotation ChangeSet creation after Deep Gene Research
 *
 * A completed direct `deep-gene-research` run used to stop at a chat message
 * telling the curator to run `create_annotation_changeset` by hand — research
 * finished and then nothing happened. ChatManager.autoCreateResearchChangeSet
 * now materializes the proposal as a reviewable ChangeSet. It is created
 * `awaiting_approval` and never applied, and a proposal DGR could not ground
 * is reported rather than forced through.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

const CHAT_MANAGER_PATH = path.join(process.cwd(), 'src/renderer/modules/ChatManager.js');
const CHANGESET_PATH = path.join(process.cwd(), 'src/renderer/modules/chat/services/AnnotationChangeSetService.js');
const ANNOTATION_PATH = path.join(process.cwd(), 'src/renderer/modules/chat/services/AnnotationService.js');

const chatManagerSource = fs.readFileSync(CHAT_MANAGER_PATH, 'utf8');

/**
 * Extract the auto-ChangeSet methods into a standalone testable class, the
 * pattern the other ChatManager unit tests use for browser-script methods.
 */
function loadAutoChangeSetMethods() {
  const start = chatManagerSource.indexOf(
    '  async autoCreateResearchChangeSet(taskInfo, { geneSymbol, payload, proposal }) {'
  );
  const end = chatManagerSource.indexOf('   * Record a failed/cancelled research task', start);
  if (start === -1 || end === -1) throw new Error('Could not extract the ChatManager auto-ChangeSet methods');
  const methodCode = chatManagerSource.slice(start, end).replace(/ {2}\/\*\*\s*$/, '');
  return new Function(`return class MockChatManager { ${methodCode} };`)();
}

const MockChatManager = loadAutoChangeSetMethods();

/** Load the real annotation services into an isolated window stand-in. */
function loadAnnotationServices() {
  const mockWindow = {};
  new Function('window', fs.readFileSync(CHANGESET_PATH, 'utf8'))(mockWindow);
  new Function('window', fs.readFileSync(ANNOTATION_PATH, 'utf8'))(mockWindow);
  return mockWindow;
}

function createManager({ mergeGeneResearchReport, currentAnnotations = { 'NC_000913.3': [] } } = {}) {
  const manager = new MockChatManager();
  manager.app = { currentAnnotations };
  manager.services = {
    annotation: mergeGeneResearchReport === null ? {} : { mergeGeneResearchReport },
  };
  return manager;
}

const TASK = { taskId: 'dgr-task-42' };

function makeProposal(overrides = {}) {
  return {
    status: 'ready_for_validation',
    confidence: 0.82,
    updates: { product: 'putative fimbrial chaperone' },
    evidence: ['PMID:12345678'],
    ...overrides,
  };
}

describe('ChatManager.autoCreateResearchChangeSet', () => {
  beforeEach(() => {
    window.AnnotationChangeSetService = { NO_EFFECTIVE_CHANGES: 'NO_EFFECTIVE_ANNOTATION_CHANGES' };
  });

  afterEach(() => {
    delete window.AnnotationChangeSetService;
  });

  it('creates the ChangeSet and binds it to the research run', async () => {
    let received;
    const merge = vi.fn(async params => {
      received = params;
      return {
        success: true,
        changeSet: {
          id: 'cs-001',
          status: 'awaiting_approval',
          riskLevel: 'medium',
          operations: [
            { op: 'replaceQualifier', field: 'product' },
            { op: 'addQualifier', field: 'go_terms' },
            { op: 'addQualifier', field: 'go_terms' },
          ],
        },
      };
    });
    const manager = createManager({ mergeGeneResearchReport: merge });

    const text = await manager.autoCreateResearchChangeSet(TASK, {
      geneSymbol: 'yhcA',
      payload: { finalReport: '# Report' },
      proposal: makeProposal(),
    });

    expect(merge).toHaveBeenCalledTimes(1);
    expect(received.identifier).toBe('yhcA');
    expect(received.researchRun).toBe('dgr-task-42');
    expect(received.principal).toBe('deep-gene-research');
    expect(received.annotationProposal).toEqual(makeProposal());

    expect(text).toContain('`cs-001`');
    expect(text).toContain('(awaiting_approval)');
    expect(text).toContain('**Qualifiers**: product, go_terms');
    expect(text).toContain('**Risk**: medium');
    expect(text).toContain('has **not** been applied');
    // The outcome is persisted into the transcript, so it must also stop the
    // model from creating a second ChangeSet for the same run.
    expect(text).toContain('Do NOT call `create_annotation_changeset`');
  });

  it('reports a ChangeSet that already existed for this run', async () => {
    const manager = createManager({
      mergeGeneResearchReport: async () => ({
        success: true,
        duplicate: true,
        changeSet: { id: 'cs-001', status: 'awaiting_approval' },
      }),
    });

    const text = await manager.autoCreateResearchChangeSet(TASK, {
      geneSymbol: 'yhcA',
      payload: {},
      proposal: makeProposal(),
    });

    expect(text).toContain('already created for this research run');
  });

  it('reuses the ledger ChangeSet for the run instead of creating a second one', async () => {
    // The merge stamps the proposal with the current time, so a fixed
    // idempotency key would be rejected as a conflicting reuse rather than
    // returning the existing ChangeSet. The ledger lookup is what dedupes.
    const merge = vi.fn();
    const manager = createManager({ mergeGeneResearchReport: merge });
    manager.services.annotation.listAnnotationChangesets = async () => ({
      changeSets: [
        { id: 'cs-other', researchRun: 'some-other-task' },
        {
          id: 'cs-existing',
          status: 'awaiting_approval',
          researchRun: 'dgr-task-42',
          riskLevel: 'low',
          // The ledger listing projects operations down to qualifier names.
          fields: ['product', 'note'],
        },
      ],
    });

    const text = await manager.autoCreateResearchChangeSet(TASK, {
      geneSymbol: 'yhcA',
      payload: {},
      proposal: makeProposal(),
    });

    expect(merge).not.toHaveBeenCalled();
    expect(text).toContain('`cs-existing`');
    expect(text).toContain('**Qualifiers**: product, note');
    expect(text).toContain('already created for this research run');
  });

  it('still creates the ChangeSet when the ledger cannot be listed', async () => {
    const merge = vi.fn(async () => ({ success: true, changeSet: { id: 'cs-003', status: 'awaiting_approval' } }));
    const manager = createManager({ mergeGeneResearchReport: merge });
    manager.services.annotation.listAnnotationChangesets = async () => {
      throw new Error('sidecar unavailable');
    };

    const text = await manager.autoCreateResearchChangeSet(TASK, {
      geneSymbol: 'yhcA',
      payload: {},
      proposal: makeProposal(),
    });

    expect(merge).toHaveBeenCalledTimes(1);
    expect(text).toContain('`cs-003`');
  });

  it('omits the identifier for an unknown gene so the merge falls back to the selection', async () => {
    let received;
    const manager = createManager({
      mergeGeneResearchReport: async params => {
        received = params;
        return { success: true, changeSet: { id: 'cs-002', status: 'awaiting_approval' } };
      },
    });

    await manager.autoCreateResearchChangeSet(TASK, {
      geneSymbol: 'Unknown',
      payload: {},
      proposal: makeProposal(),
    });

    expect(received.identifier).toBeUndefined();
  });

  it.each([
    ['draft_requires_evidence', 'no evidence-backed claims'],
    ['draft_requires_target', 'could not bind its proposal to an exact genome target'],
  ])('refuses to materialize a %s proposal', async (status, reason) => {
    const merge = vi.fn();
    const manager = createManager({ mergeGeneResearchReport: merge });

    const text = await manager.autoCreateResearchChangeSet(TASK, {
      geneSymbol: 'yhcA',
      payload: {},
      proposal: makeProposal({ status }),
    });

    expect(merge).not.toHaveBeenCalled();
    expect(text).toContain('not created');
    expect(text).toContain(reason);
    expect(text).toContain(status);
  });

  it('skips creation when no genome annotations are loaded', async () => {
    const merge = vi.fn();
    const manager = createManager({ mergeGeneResearchReport: merge, currentAnnotations: null });

    const text = await manager.autoCreateResearchChangeSet(TASK, {
      geneSymbol: 'yhcA',
      payload: {},
      proposal: makeProposal(),
    });

    expect(merge).not.toHaveBeenCalled();
    expect(text).toContain('no genome annotations are loaded');
  });

  it('skips creation when the annotation service is unavailable', async () => {
    const manager = createManager({ mergeGeneResearchReport: null });

    const text = await manager.autoCreateResearchChangeSet(TASK, {
      geneSymbol: 'yhcA',
      payload: {},
      proposal: makeProposal(),
    });

    expect(text).toContain('annotation service is unavailable');
  });

  it('reports an already-satisfied annotation as a no-op rather than a failure', async () => {
    const manager = createManager({
      mergeGeneResearchReport: async () => {
        const error = new Error('ChangeSet contains no effective annotation changes');
        error.code = 'NO_EFFECTIVE_ANNOTATION_CHANGES';
        throw error;
      },
    });

    const text = await manager.autoCreateResearchChangeSet(TASK, {
      geneSymbol: 'yhcA',
      payload: {},
      proposal: makeProposal(),
    });

    expect(text).toContain('not needed');
    expect(text).toContain('yhcA already carries everything this research proposed');
  });

  it('surfaces a provenance failure verbatim and points at the target-bound workflow', async () => {
    const manager = createManager({
      mergeGeneResearchReport: async () => {
        throw new Error('Archive DGR research task dgr-task-42 as a gene report before creating its ChangeSet');
      },
    });

    const text = await manager.autoCreateResearchChangeSet(TASK, {
      geneSymbol: 'yhcA',
      payload: {},
      proposal: makeProposal(),
    });

    expect(text).toContain('Archive DGR research task dgr-task-42 as a gene report');
    expect(text).toContain('`start_annotation_research`');
  });
});

describe('autoCreateResearchChangeSet against the real annotation services', () => {
  let annotationService;
  let annotation;

  beforeEach(() => {
    window.AnnotationChangeSetService = { NO_EFFECTIVE_CHANGES: 'NO_EFFECTIVE_ANNOTATION_CHANGES' };
    const mockWindow = loadAnnotationServices();
    const sidecarData = {};
    annotation = {
      id: 'feature-1',
      type: 'CDS',
      start: 12,
      end: 120,
      strand: 1,
      qualifiers: { locus_tag: 'b3215', gene: 'yhcA', product: 'hypothetical protein' },
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
    annotationService = new mockWindow.AnnotationService(app, {
      _getChangeTracker: () => ({ recordChange: () => ({}) }),
    });
  });

  afterEach(() => {
    delete window.AnnotationChangeSetService;
  });

  function managerFor() {
    const manager = new MockChatManager();
    manager.app = annotationService.app;
    manager.services = { annotation: annotationService };
    return manager;
  }

  it('turns a completed research payload into a reviewable ChangeSet that is not applied', async () => {
    const text = await managerFor().autoCreateResearchChangeSet(TASK, {
      geneSymbol: 'yhcA',
      payload: {
        finalReport: 'YhcA is a fimbrial chaperone supported by PMID:12345678 and GO:0003674.',
      },
      proposal: makeProposal(),
    });

    expect(text).toContain('**Annotation ChangeSet**');
    expect(text).toContain('(awaiting_approval)');
    expect(text).toContain('has **not** been applied');

    const listed = await annotationService.listAnnotationChangesets({});
    expect(listed.changeSets).toHaveLength(1);
    expect(listed.changeSets[0].status).toBe('awaiting_approval');
    expect(listed.changeSets[0].researchRun).toBe('dgr-task-42');
    // The live annotation is untouched until a curator approves and applies.
    expect(annotation.qualifiers.product).toBe('hypothetical protein');
  });

  it('returns the same ChangeSet when the same completed task is processed twice', async () => {
    const manager = managerFor();
    const context = {
      geneSymbol: 'yhcA',
      payload: { finalReport: 'YhcA is a fimbrial chaperone supported by PMID:12345678.' },
      proposal: makeProposal(),
    };

    const first = await manager.autoCreateResearchChangeSet(TASK, context);
    const second = await manager.autoCreateResearchChangeSet(TASK, context);

    const listed = await annotationService.listAnnotationChangesets({});
    expect(listed.changeSets).toHaveLength(1);
    const id = listed.changeSets[0].id;
    expect(first).toContain(id);
    expect(second).toContain(id);
    expect(second).toContain('already created for this research run');
    // The reused summary reads the same as the freshly created one.
    expect(second).toContain('**Qualifiers**:');
  });
});

describe('getFinalTaskResults wiring (source contract)', () => {
  it('auto-creates the ChangeSet only on the direct-MCP completion path', () => {
    // Workflow runs are finalized by AnnotationResearchWorkflowService, which
    // creates their ChangeSet with the full archived provenance chain.
    const call = 'content += await this.autoCreateResearchChangeSet(taskInfo, { geneSymbol, payload, proposal });';
    expect(chatManagerSource).toContain(call);
    const before = chatManagerSource.slice(0, chatManagerSource.indexOf(call));
    expect(before.lastIndexOf('if (!isWorkflow) {')).toBeGreaterThan(before.lastIndexOf('if (isWorkflow'));
  });

  it('no longer tells the curator to run create_annotation_changeset by hand', () => {
    expect(chatManagerSource).not.toContain(
      'Use the annotation change-set workflow (`create_annotation_changeset`) to review and merge'
    );
  });
});
