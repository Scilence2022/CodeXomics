/* eslint-disable no-new-func */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

const REVIEW_MANAGER_PATH = path.join(process.cwd(), 'src/renderer/modules/AnnotationReviewManager.js');
const RENDERER_INDEX_PATH = path.join(process.cwd(), 'src/renderer/index.html');

function loadManager(mockWindow) {
  const code = fs.readFileSync(REVIEW_MANAGER_PATH, 'utf8');
  new Function('window', code)(mockWindow);
  return mockWindow.AnnotationReviewManager;
}

function reviewDom() {
  document.body.innerHTML = `
    <div id="annotationReviewModal">
      <button class="annotation-review-nav-btn" data-review-tab="queue"><span class="annotation-review-applied-count" hidden>0</span></button>
      <button class="annotation-review-nav-btn" data-review-tab="applied"></button>
      <section class="annotation-review-panel active" data-review-panel="queue"></section>
      <section class="annotation-review-panel" data-review-panel="applied"></section>
    </div>
    <button id="annotationReviewHeaderBtn"></button>
    <input id="annotationReviewSearch" value="">
    <select id="annotationReviewFilter"><option value="active" selected>active</option></select>
    <select id="annotationReviewRiskFilter"><option value="" selected>all</option></select>
    <button id="annotationReviewRefreshBtn"></button>
    <label id="annotationReviewSelectAllLabel">
      <input id="annotationReviewSelectAll" type="checkbox">
      <span id="annotationReviewEligibleLabel">0 eligible</span>
    </label>
    <span id="annotationReviewTotal"></span>
    <span id="annotationReviewSelectedCount"></span>
    <p id="annotationReviewActionHint" hidden></p>
    <button id="annotationReviewApproveBtn"></button>
    <button id="annotationReviewApproveApplyBtn"></button>
    <button id="annotationReviewRejectBtn"></button>
    <button id="annotationReviewArchiveBtn"></button>
    <button id="annotationReviewDeleteBtn"></button>
    <button id="annotationReviewRestoreBtn"></button>
    <select id="annotationReviewArchiveFilter"><option value="visible">visible</option><option value="archived">archived</option><option value="all">all</option></select>
    <div id="annotationReviewQueue"></div>
    <aside id="annotationReviewDetail"></aside>
    <input id="annotationCuratorIdentity" value="local-curator">
    <input id="annotationApprovalExpiry" value="30">
    <input id="annotationBatchLimit" value="50">
    <input id="annotationBatchReviewEnabled" type="checkbox" checked>
    <button id="annotationGovernanceSaveBtn"></button>
    <input id="annotationAppliedSearch" value="">
    <select id="annotationAppliedSort"><option value="recent" selected>recent</option></select>
    <input id="annotationAppliedShowArchived" type="checkbox">
    <button id="annotationAppliedRefreshBtn"></button>
    <span id="annotationAppliedTotal"></span>
    <div id="annotationAppliedGenes"></div>
    <button id="annotationReviewBadgeHost"><span class="annotation-review-badge" hidden>0</span></button>
  `;
}

// The manager is evaluated with `window` bound to a stub, so a test that
// exercises the ledger broadcast needs one that carries real event plumbing.
// Each stub gets its own target, keeping one test's manager deaf to the events
// of the next.
function browserWindow(extra = {}) {
  const events = new EventTarget();
  return {
    confirm: vi.fn(),
    prompt: vi.fn(),
    alert: vi.fn(),
    addEventListener: (...args) => events.addEventListener(...args),
    removeEventListener: (...args) => events.removeEventListener(...args),
    dispatchEvent: (...args) => events.dispatchEvent(...args),
    ...extra,
  };
}

function summary(id, gene, hash) {
  return {
    id,
    status: 'awaiting_approval',
    createdAt: '2026-07-16T00:00:00.000Z',
    createdBy: 'research-agent',
    changeSetHash: hash,
    target: { geneSymbol: gene, locusTag: `${gene}-tag`, featureType: 'CDS' },
    riskLevel: 'medium',
    operationCount: 1,
    evidenceCount: 1,
    preview: [{ op: 'addQualifier', field: 'note', before: null, after: `${gene} note` }],
  };
}

function appliedSummary(id, gene, overrides = {}) {
  return {
    id,
    status: 'committed',
    createdAt: '2026-07-16T00:00:00.000Z',
    createdBy: 'research-agent',
    committedAt: '2026-07-17T10:00:00.000Z',
    committedBy: 'local-curator',
    resultingRevision: 4,
    riskLevel: 'medium',
    operationCount: 1,
    evidenceCount: 2,
    fields: ['product'],
    target: {
      featureId: `feat-${gene}`,
      geneSymbol: gene,
      locusTag: `${gene}-tag`,
      featureType: 'CDS',
      chromosome: 'U00096.3',
      coordinates: { start: 100, end: 400, strand: 1 },
    },
    preview: [{ op: 'replaceQualifier', field: 'product', before: 'hypothetical protein', after: `${gene} synthase` }],
    ...overrides,
  };
}

function actionFixture(records, config = {}) {
  const mockWindow = { confirm: vi.fn(() => true), alert: vi.fn() };
  const service = {
    listAnnotationChangesets: vi.fn(async params => ({
      success: true,
      statusCounts: {},
      changeSets: records.filter(
        record =>
          (!params.statuses?.length || params.statuses.includes(record.status)) &&
          (params.archivedOnly ? Boolean(record.archivedAt) : params.includeArchived || !record.archivedAt)
      ),
      total: records.length,
    })),
    getAnnotationChangeset: vi.fn(async ({ changeSetId }) => ({
      changeSet: records.find(record => record.id === changeSetId),
    })),
    rejectAnnotationChangeset: vi.fn(async ({ changeSetId }) => {
      const record = records.find(record => record.id === changeSetId);
      const decision = await manager.confirmAnnotationChangeSet({ action: 'reject', changeSet: record });
      expect(decision.rejected).toBe(true);
      record.status = 'rejected';
      return { success: true };
    }),
    requestAnnotationApproval: vi.fn(async ({ changeSetId }) => ({ approvalToken: `token-${changeSetId}` })),
    applyAnnotationChangeset: vi.fn(async () => ({ success: true, applied: true })),
    setAnnotationChangesetArchived: vi.fn(async ({ changeSetId, archived }) => {
      const record = records.find(record => record.id === changeSetId);
      const decision = await manager.confirmAnnotationChangeSet({
        action: archived ? 'archive' : 'restore',
        changeSet: record,
      });
      expect(decision.confirmed).toBe(true);
      if (archived) record.archivedAt = '2026-10-12T00:00:00Z';
      else delete record.archivedAt;
      return { success: true };
    }),
    deleteAnnotationChangeset: vi.fn(async ({ changeSetId }) => {
      const record = records.find(record => record.id === changeSetId);
      const decision = await manager.confirmAnnotationChangeSet({ action: 'delete', changeSet: record });
      expect(decision.confirmed).toBe(true);
      records.splice(records.indexOf(record), 1);
      return { success: true, deleted: true, changeSetId };
    }),
    rollbackAnnotationChangeset: vi.fn(),
  };
  const app = {
    configManager: { get: () => config, set: vi.fn(), save: vi.fn() },
    chatManager: { services: { annotation: service } },
    showNotification: vi.fn(),
  };
  const Manager = loadManager(mockWindow);
  const manager = new Manager(app);
  manager.changeSets = new Map(records.map(record => [record.id, record]));
  manager._renderQueue({ total: records.length, changeSets: records });
  return { manager, app, service, mockWindow };
}

describe('AnnotationReviewManager', () => {
  beforeEach(() => {
    reviewDom();
  });

  it('opens the review center from the global header entry', () => {
    const mockWindow = { confirm: vi.fn(), prompt: vi.fn(), alert: vi.fn() };
    const Manager = loadManager(mockWindow);
    const manager = new Manager({ configManager: null });
    const showReviewCenter = vi.spyOn(manager, 'showReviewCenter').mockImplementation(() => {});

    document.getElementById('annotationReviewHeaderBtn').click();

    expect(showReviewCenter).toHaveBeenCalledOnce();
  });

  it('keeps one labeled global Review entry beside Options in the header', () => {
    const html = fs.readFileSync(RENDERER_INDEX_PATH, 'utf8');
    const headerRightIndex = html.indexOf('<div class="header-right">');
    const reviewIndex = html.indexOf('id="annotationReviewHeaderBtn"');
    const optionsIndex = html.indexOf('id="optionsBtn"');

    expect(reviewIndex).toBeGreaterThan(headerRightIndex);
    expect(reviewIndex).toBeLessThan(optionsIndex);
    expect(html).toMatch(/id="annotationReviewHeaderBtn"[\s\S]*?<span>Review<\/span>/);
    expect(html).not.toContain('id="annotationReviewToolbarBtn"');
    expect(html).not.toContain('id="annotationReviewBtn"');
  });

  it('uses one explicit batch confirmation while issuing independent approvals and commits', async () => {
    const mockWindow = {
      confirm: vi.fn(() => true),
      prompt: vi.fn(() => 'curator_rejected'),
      alert: vi.fn(),
    };
    const first = summary('cs-1', 'lysC', 'hash-1');
    const second = summary('cs-2', 'thrB', 'hash-2');
    const state = { manager: null };
    const requestAnnotationApproval = vi.fn(async ({ changeSetId }) => {
      const changeSet = changeSetId === first.id ? first : second;
      const decision = await state.manager.app.confirmAnnotationChangeSet({ changeSet });
      expect(decision).toMatchObject({ approved: true, principal: 'local-curator' });
      return { success: true, approvalToken: `cap-${changeSetId}` };
    });
    const applyAnnotationChangeset = vi.fn(async ({ changeSetId, approvalToken }) => ({
      success: true,
      applied: true,
      changeSetId,
      approvalToken,
    }));
    const listAnnotationChangesets = vi.fn(async () => ({
      success: true,
      total: 0,
      statusCounts: {},
      changeSets: [],
    }));
    const app = {
      configManager: { get: vi.fn(() => ({})), set: vi.fn(), save: vi.fn() },
      chatManager: {
        services: {
          annotation: { requestAnnotationApproval, applyAnnotationChangeset, listAnnotationChangesets },
        },
      },
      showNotification: vi.fn(),
    };
    const Manager = loadManager(mockWindow);
    const manager = new Manager(app);
    state.manager = manager;
    manager.changeSets = new Map([
      [first.id, first],
      [second.id, second],
    ]);
    document.getElementById('annotationReviewQueue').innerHTML = `
      <input class="annotation-review-checkbox" type="checkbox" value="${first.id}" checked>
      <input class="annotation-review-checkbox" type="checkbox" value="${second.id}" checked>`;

    await manager.approveSelected(true);

    expect(mockWindow.confirm).toHaveBeenCalledTimes(1);
    expect(requestAnnotationApproval).toHaveBeenCalledTimes(2);
    expect(applyAnnotationChangeset).toHaveBeenNthCalledWith(1, {
      changeSetId: first.id,
      approvalToken: 'cap-cs-1',
    });
    expect(applyAnnotationChangeset).toHaveBeenNthCalledWith(2, {
      changeSetId: second.id,
      approvalToken: 'cap-cs-2',
    });
    expect(app.showNotification).toHaveBeenCalledWith('2/2 ChangeSets applied.', 'success');
  });

  it('collects the rejection reason in an in-app dialog because Electron has no window.prompt', async () => {
    const mockWindow = {
      confirm: vi.fn(() => true),
      prompt: vi.fn(() => {
        throw new Error('prompt() is not supported.');
      }),
      alert: vi.fn(),
    };
    const pending = summary('cs-reject', 'ygaQ', 'hash-reject');
    const rejectAnnotationChangeset = vi.fn(async () => ({ success: true }));
    const listAnnotationChangesets = vi.fn(async () => ({
      success: true,
      total: 0,
      statusCounts: {},
      changeSets: [],
    }));
    const app = {
      configManager: { get: vi.fn(() => ({})), set: vi.fn(), save: vi.fn() },
      chatManager: { services: { annotation: { rejectAnnotationChangeset, listAnnotationChangesets } } },
      showNotification: vi.fn(),
    };
    const Manager = loadManager(mockWindow);
    const manager = new Manager(app);
    manager.changeSets = new Map([[pending.id, pending]]);
    document.getElementById('annotationReviewQueue').innerHTML =
      `<input class="annotation-review-checkbox" type="checkbox" value="${pending.id}" checked>`;

    const rejection = manager.rejectSelected();
    const dialog = await vi.waitFor(() => {
      const element = document.getElementById('annotationReviewReasonDialog');
      expect(element).not.toBeNull();
      return element;
    });
    expect(dialog.textContent).toContain('ygaQ');

    dialog.querySelector('#annotationReviewReasonInput').value = 'insufficient evidence';
    dialog.querySelector('[data-reason-action="confirm"]').click();
    await rejection;

    expect(mockWindow.prompt).not.toHaveBeenCalled();
    expect(rejectAnnotationChangeset).toHaveBeenCalledWith({
      changeSetId: pending.id,
      reason: 'insufficient evidence',
    });
    expect(document.getElementById('annotationReviewReasonDialog')).toBeNull();
    expect(app.showNotification).toHaveBeenCalledWith('1/1 ChangeSets rejected.', 'success');
  });

  it('leaves the queue untouched when the rejection dialog is cancelled', async () => {
    const mockWindow = { confirm: vi.fn(() => true), prompt: vi.fn(), alert: vi.fn() };
    const pending = summary('cs-reject-cancel', 'pinH', 'hash-reject-cancel');
    const rejectAnnotationChangeset = vi.fn();
    const app = {
      configManager: { get: vi.fn(() => ({})), set: vi.fn(), save: vi.fn() },
      chatManager: { services: { annotation: { rejectAnnotationChangeset } } },
      showNotification: vi.fn(),
    };
    const Manager = loadManager(mockWindow);
    const manager = new Manager(app);
    manager.changeSets = new Map([[pending.id, pending]]);
    document.getElementById('annotationReviewQueue').innerHTML =
      `<input class="annotation-review-checkbox" type="checkbox" value="${pending.id}" checked>`;

    const rejection = manager.rejectSelected();
    const dialog = await vi.waitFor(() => {
      const element = document.getElementById('annotationReviewReasonDialog');
      expect(element).not.toBeNull();
      return element;
    });
    dialog.querySelector('[data-reason-action="cancel"]').click();
    await rejection;

    expect(rejectAnnotationChangeset).not.toHaveBeenCalled();
    expect(document.getElementById('annotationReviewReasonDialog')).toBeNull();
  });

  it('blocks a batch when the configured reviewer is also a ChangeSet creator', async () => {
    const mockWindow = { confirm: vi.fn(() => true), prompt: vi.fn(), alert: vi.fn() };
    const conflict = summary('cs-conflict', 'lysC', 'hash-conflict');
    conflict.createdBy = 'local-curator';
    const requestAnnotationApproval = vi.fn();
    const app = {
      configManager: { get: vi.fn(() => ({})), set: vi.fn(), save: vi.fn() },
      chatManager: {
        services: {
          annotation: {
            requestAnnotationApproval,
            listAnnotationChangesets: vi.fn(async () => ({ total: 0, statusCounts: {}, changeSets: [] })),
          },
        },
      },
      showNotification: vi.fn(),
    };
    const Manager = loadManager(mockWindow);
    const manager = new Manager(app);
    manager.changeSets = new Map([[conflict.id, conflict]]);
    document.getElementById('annotationReviewQueue').innerHTML = `
      <input class="annotation-review-checkbox" type="checkbox" value="${conflict.id}" checked>`;

    await manager.approveSelected(false);

    expect(requestAnnotationApproval).not.toHaveBeenCalled();
    expect(mockWindow.confirm).not.toHaveBeenCalled();
    expect(app.showNotification).toHaveBeenCalledWith(
      'The reviewer identity must be different from every selected ChangeSet creator.',
      'error'
    );
  });

  it('blocks approval of multiple ChangeSets bound to the same target feature', async () => {
    const mockWindow = { confirm: vi.fn(() => true), prompt: vi.fn(), alert: vi.fn() };
    const first = summary('cs-duplicate-1', 'lysC', 'hash-1');
    const second = summary('cs-duplicate-2', 'lysC', 'hash-2');
    first.target.featureId = 'feat-lysC';
    second.target.featureId = 'feat-lysC';
    const requestAnnotationApproval = vi.fn();
    const app = {
      configManager: { get: vi.fn(() => ({})), set: vi.fn(), save: vi.fn() },
      chatManager: {
        services: {
          annotation: {
            requestAnnotationApproval,
            listAnnotationChangesets: vi.fn(async () => ({ total: 0, statusCounts: {}, changeSets: [] })),
          },
        },
      },
      showNotification: vi.fn(),
    };
    const Manager = loadManager(mockWindow);
    const manager = new Manager(app);
    manager.changeSets = new Map([
      [first.id, first],
      [second.id, second],
    ]);
    document.getElementById('annotationReviewQueue').innerHTML = `
      <input class="annotation-review-checkbox" type="checkbox" value="${first.id}" checked>
      <input class="annotation-review-checkbox" type="checkbox" value="${second.id}" checked>`;

    await manager.approveSelected(true);

    expect(requestAnnotationApproval).not.toHaveBeenCalled();
    expect(mockWindow.confirm).not.toHaveBeenCalled();
    expect(app.showNotification).toHaveBeenCalledWith(
      'Select only one ChangeSet per target before approval. Conflicting targets: lysC.',
      'error'
    );
  });

  it('allows history selection for archive while disabling approval and rejection', () => {
    const mockWindow = { confirm: vi.fn(), prompt: vi.fn(), alert: vi.fn() };
    const applied = summary('cs-applied', 'lysC', 'hash-applied');
    const stale = summary('cs-stale', 'lysC', 'hash-stale');
    applied.status = 'committed';
    stale.status = 'stale';
    const app = {
      configManager: { get: vi.fn(() => ({})), set: vi.fn(), save: vi.fn() },
      chatManager: { services: { annotation: {} } },
      showNotification: vi.fn(),
    };
    const Manager = loadManager(mockWindow);
    const manager = new Manager(app);

    manager._renderQueue({ total: 2, changeSets: [applied, stale] });

    manager.changeSets = new Map([
      [applied.id, applied],
      [stale.id, stale],
    ]);
    expect(document.querySelectorAll('.annotation-review-checkbox')).toHaveLength(2);
    document.getElementById('annotationReviewSelectAll').click();
    expect(document.getElementById('annotationReviewApproveBtn').disabled).toBe(true);
    expect(document.getElementById('annotationReviewRejectBtn').disabled).toBe(true);
    expect(document.getElementById('annotationReviewArchiveBtn').disabled).toBe(false);
    expect(document.getElementById('annotationReviewEligibleLabel').textContent).toBe('2 selectable');
    expect(document.getElementById('annotationReviewQueue').textContent).toContain('Already applied');
    expect(document.getElementById('annotationReviewQueue').textContent).toContain('Stale because');
  });

  it('allows both row selection and select-all for an eligible pending ChangeSet', () => {
    const mockWindow = { confirm: vi.fn(), prompt: vi.fn(), alert: vi.fn() };
    const pending = summary('cs-pending', 'thrB', 'hash-pending');
    const app = {
      configManager: { get: vi.fn(() => ({})), set: vi.fn(), save: vi.fn() },
      chatManager: { services: { annotation: {} } },
      showNotification: vi.fn(),
    };
    const Manager = loadManager(mockWindow);
    const manager = new Manager(app);
    manager.changeSets = new Map([[pending.id, pending]]);
    manager._renderQueue({ total: 1, changeSets: [pending] });

    const rowCheckbox = document.querySelector('.annotation-review-checkbox');
    rowCheckbox.click();
    expect(rowCheckbox.checked).toBe(true);
    expect(document.getElementById('annotationReviewSelectedCount').textContent).toBe('1 selected');

    rowCheckbox.click();
    document.getElementById('annotationReviewSelectAll').click();
    expect(rowCheckbox.checked).toBe(true);
    expect(document.getElementById('annotationReviewSelectedCount').textContent).toBe('1 selected');
    expect(document.getElementById('annotationReviewEligibleLabel').textContent).toBe('1 selectable');
  });

  it('opens a ChangeSet detail view when its queue item is clicked or keyboard-activated', async () => {
    const mockWindow = { confirm: vi.fn(), prompt: vi.fn(), alert: vi.fn() };
    const pending = summary('cs-details', 'thrB', 'hash-details');
    const getAnnotationChangeset = vi.fn(async () => ({
      changeSet: {
        ...pending,
        baseRevision: 'revision-1',
        operations: [{ op: 'addQualifier', field: 'note', value: 'Reviewed note', claimIds: [] }],
        evidence: ['curated evidence'],
        proposalMetadata: {
          archivedDgrReport: {
            attachmentId: 'dgr:task-details',
            summary: { fullTextSourceCount: 3, fullTextFindingCount: 7 },
            citationValidation: { verifiedFullTextSourceCount: 2 },
          },
        },
      },
    }));
    const app = {
      configManager: { get: vi.fn(() => ({})), set: vi.fn(), save: vi.fn() },
      chatManager: { services: { annotation: { getAnnotationChangeset } } },
      showNotification: vi.fn(),
    };
    const Manager = loadManager(mockWindow);
    const manager = new Manager(app);
    manager.changeSets = new Map([[pending.id, pending]]);
    manager._renderQueue({ total: 1, changeSets: [pending] });

    const item = document.querySelector('.annotation-review-item');
    const itemMain = item.querySelector('.annotation-review-item-main');
    expect(itemMain.getAttribute('role')).toBe('button');
    expect(itemMain.getAttribute('tabindex')).toBe('0');

    itemMain.click();
    await vi.waitFor(() => expect(getAnnotationChangeset).toHaveBeenCalledWith({ changeSetId: pending.id }));
    expect(document.getElementById('annotationReviewDetail').textContent).toContain('Reviewed note');
    expect(document.getElementById('annotationReviewDetail').textContent).toContain(
      'Full text: 2/3 evidence-linked sources, 7 findings'
    );
    expect(item.classList.contains('is-active')).toBe(true);
    expect(itemMain.getAttribute('aria-expanded')).toBe('true');

    getAnnotationChangeset.mockClear();
    itemMain.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await vi.waitFor(() => expect(getAnnotationChangeset).toHaveBeenCalledWith({ changeSetId: pending.id }));
  });

  it('keeps queue selection separate from opening ChangeSet details', () => {
    const mockWindow = { confirm: vi.fn(), prompt: vi.fn(), alert: vi.fn() };
    const pending = summary('cs-select-only', 'thrB', 'hash-select-only');
    const getAnnotationChangeset = vi.fn();
    const app = {
      configManager: { get: vi.fn(() => ({})), set: vi.fn(), save: vi.fn() },
      chatManager: { services: { annotation: { getAnnotationChangeset } } },
      showNotification: vi.fn(),
    };
    const Manager = loadManager(mockWindow);
    const manager = new Manager(app);
    manager.changeSets = new Map([[pending.id, pending]]);
    manager._renderQueue({ total: 1, changeSets: [pending] });

    document.querySelector('.annotation-review-checkbox').click();

    expect(getAnnotationChangeset).not.toHaveBeenCalled();
    expect(document.getElementById('annotationReviewSelectedCount').textContent).toBe('1 selected');
  });

  it('clears the detail pane once the reviewed ChangeSet leaves the queue', async () => {
    const pending = summary('cs-applied', 'ygeF', 'hash-applied');
    const getAnnotationChangeset = vi.fn(async () => ({
      success: true,
      changeSet: {
        id: pending.id,
        target: { geneSymbol: 'ygeF', locusTag: 'b2850', chromosome: 'U00096' },
        baseRevision: 63,
        riskLevel: 'medium',
        createdBy: 'local-bypass',
        operations: [{ op: 'addQualifier', field: 'pathway', value: 'KEGG:ecj:JW2818' }],
        evidence: [],
      },
    }));
    const requestAnnotationApproval = vi.fn(async () => ({ success: true, approvalToken: 'cap-applied' }));
    const applyAnnotationChangeset = vi.fn(async () => ({ success: true, applied: true }));
    // Applying moves the ChangeSet to committed, so the "Needs action" filter
    // no longer returns it.
    const listAnnotationChangesets = vi.fn(async () => ({
      success: true,
      total: 0,
      statusCounts: { committed: 1 },
      changeSets: [],
    }));
    const app = {
      configManager: { get: vi.fn(() => ({})), set: vi.fn(), save: vi.fn() },
      chatManager: {
        services: {
          annotation: {
            getAnnotationChangeset,
            requestAnnotationApproval,
            applyAnnotationChangeset,
            listAnnotationChangesets,
          },
        },
      },
      showNotification: vi.fn(),
    };
    const Manager = loadManager(browserWindow({ confirm: vi.fn(() => true) }));
    const manager = new Manager(app);
    manager.changeSets = new Map([[pending.id, pending]]);
    manager._renderQueue({ total: 1, changeSets: [pending] });
    document.querySelector('.annotation-review-checkbox').click();
    await manager.viewChangeSet(pending.id);
    expect(document.getElementById('annotationReviewDetail').textContent).toContain('ygeF');

    await manager.approveSelected(true);

    expect(applyAnnotationChangeset).toHaveBeenCalledOnce();
    expect(document.getElementById('annotationReviewDetail').innerHTML).toBe('');
    expect(manager.activeChangeSetId).toBeNull();
    clearInterval(manager.badgeWatchTimer);
  });

  it('keeps the detail pane open for a ChangeSet that is still queued', async () => {
    const pending = summary('cs-still-queued', 'lysC', 'hash-still-queued');
    const getAnnotationChangeset = vi.fn(async () => ({
      success: true,
      changeSet: {
        id: pending.id,
        target: { geneSymbol: 'lysC', locusTag: 'b4024' },
        baseRevision: 12,
        operations: [{ op: 'addQualifier', field: 'note', value: 'still pending' }],
        evidence: [],
      },
    }));
    const listAnnotationChangesets = vi.fn(async () => ({
      success: true,
      total: 1,
      statusCounts: { awaiting_approval: 1 },
      changeSets: [pending],
    }));
    const app = {
      configManager: { get: vi.fn(() => ({})), set: vi.fn(), save: vi.fn() },
      chatManager: { services: { annotation: { getAnnotationChangeset, listAnnotationChangesets } } },
      showNotification: vi.fn(),
    };
    const Manager = loadManager(browserWindow());
    const manager = new Manager(app);
    manager.changeSets = new Map([[pending.id, pending]]);
    manager._renderQueue({ total: 1, changeSets: [pending] });
    await manager.viewChangeSet(pending.id);

    await manager.refreshQueue();

    expect(document.getElementById('annotationReviewDetail').textContent).toContain('lysC');
    expect(manager.activeChangeSetId).toBe(pending.id);
    clearInterval(manager.badgeWatchTimer);
  });

  it('paints the modal before the ledger read starts', async () => {
    const listAnnotationChangesets = vi.fn(
      () =>
        new Promise(resolve =>
          setTimeout(() => resolve({ success: true, total: 0, statusCounts: {}, changeSets: [] }), 0)
        )
    );
    const app = {
      configManager: { get: vi.fn(() => ({})), set: vi.fn(), save: vi.fn() },
      chatManager: { services: { annotation: { listAnnotationChangesets } } },
      showNotification: vi.fn(),
    };
    const Manager = loadManager(browserWindow());
    const manager = new Manager(app);
    listAnnotationChangesets.mockClear();

    manager.showReviewCenter();

    // The click handler must hand the frame back with the modal already
    // visible; the queue load is what waits, not the button.
    expect(document.getElementById('annotationReviewModal').classList.contains('show')).toBe(true);
    expect(document.getElementById('annotationReviewQueue').textContent).toContain('Loading ChangeSets');
    expect(listAnnotationChangesets).not.toHaveBeenCalled();

    await vi.waitFor(() => expect(listAnnotationChangesets).toHaveBeenCalled());
    clearInterval(manager.badgeWatchTimer);
    clearTimeout(manager.modalBehaviorTimer);
  });

  it('shows the pending count on start without the curator opening the Review Center', async () => {
    const listAnnotationChangesets = vi.fn(async () => ({
      success: true,
      total: 1,
      statusCounts: { awaiting_approval: 3, committed: 12 },
      changeSets: [],
    }));
    const app = {
      configManager: { get: vi.fn(() => ({})), set: vi.fn(), save: vi.fn() },
      chatManager: { services: { annotation: { listAnnotationChangesets } } },
      showNotification: vi.fn(),
    };
    const appWindow = browserWindow();
    const Manager = loadManager(appWindow);
    const manager = new Manager(app);

    const badge = document.querySelector('.annotation-review-badge');
    await vi.waitFor(() => expect(badge.textContent).toBe('3'));
    expect(badge.hidden).toBe(false);
    // The badge poll must not pay for queue previews it never renders.
    expect(listAnnotationChangesets).toHaveBeenCalledWith({ statuses: ['awaiting_approval'], limit: 1 });
    expect(document.getElementById('annotationReviewQueue').innerHTML).toBe('');
    clearInterval(manager.badgeWatchTimer);
  });

  it('updates the header badge as soon as a ChangeSet is written to the ledger', async () => {
    const app = {
      configManager: { get: vi.fn(() => ({})), set: vi.fn(), save: vi.fn() },
      chatManager: { services: {} },
      showNotification: vi.fn(),
    };
    const appWindow = browserWindow();
    const Manager = loadManager(appWindow);
    const manager = new Manager(app);
    const badge = document.querySelector('.annotation-review-badge');
    expect(badge.hidden).toBe(true);

    appWindow.dispatchEvent(
      new CustomEvent('annotation-ledger-changed', {
        detail: { reason: 'ledger-saved', statusCounts: { awaiting_approval: 1, approved: 1, rejected: 4 } },
      })
    );

    expect(badge.textContent).toBe('2');
    expect(badge.hidden).toBe(false);
    clearInterval(manager.badgeWatchTimer);
  });

  it('leaves an in-progress review alone when the ledger changes underneath it', async () => {
    const pending = summary('cs-open', 'lysC', 'hash-open');
    const listAnnotationChangesets = vi.fn(async () => ({
      success: true,
      total: 1,
      statusCounts: { awaiting_approval: 1 },
      changeSets: [pending],
    }));
    const app = {
      configManager: { get: vi.fn(() => ({})), set: vi.fn(), save: vi.fn() },
      chatManager: { services: { annotation: { listAnnotationChangesets } } },
      showNotification: vi.fn(),
    };
    const appWindow = browserWindow();
    const Manager = loadManager(appWindow);
    const manager = new Manager(app);
    document.getElementById('annotationReviewModal').classList.add('show');
    manager.changeSets = new Map([[pending.id, pending]]);
    manager._renderQueue({ total: 1, changeSets: [pending] });
    document.querySelector('.annotation-review-checkbox').click();
    await vi.waitFor(() => expect(listAnnotationChangesets).toHaveBeenCalled());
    listAnnotationChangesets.mockClear();

    appWindow.dispatchEvent(
      new CustomEvent('annotation-ledger-changed', {
        detail: { reason: 'ledger-saved', statusCounts: { awaiting_approval: 2 } },
      })
    );

    expect(document.querySelector('.annotation-review-badge').textContent).toBe('2');
    expect(listAnnotationChangesets).not.toHaveBeenCalled();
    expect(document.getElementById('annotationReviewSelectedCount').textContent).toBe('1 selected');
    clearInterval(manager.badgeWatchTimer);
  });

  it('lists one annotated gene per target with its applied ChangeSet history', async () => {
    const first = appliedSummary('cs-a1', 'lysC');
    const second = appliedSummary('cs-a2', 'lysC', {
      committedAt: '2026-07-18T10:00:00.000Z',
      resultingRevision: 6,
      committedBy: 'second-curator',
      fields: ['note'],
      preview: [{ op: 'addQualifier', field: 'note', before: null, after: 'kinase activity confirmed' }],
    });
    const third = appliedSummary('cs-a3', 'thrB');
    const listAnnotationChangesets = vi.fn(async () => ({
      success: true,
      total: 3,
      statusCounts: { committed: 3, awaiting_approval: 0 },
      changeSets: [first, second, third],
    }));
    const app = {
      configManager: { get: vi.fn(() => ({})), set: vi.fn(), save: vi.fn() },
      chatManager: { services: { annotation: { listAnnotationChangesets } } },
      showNotification: vi.fn(),
    };
    const Manager = loadManager(browserWindow());
    const manager = new Manager(app);

    manager.showModalTab('applied');
    await vi.waitFor(() => {
      expect(document.querySelectorAll('.annotation-applied-item').length).toBe(2);
    });

    expect(listAnnotationChangesets).toHaveBeenCalledWith({
      statuses: ['committed'],
      includeArchived: false,
      query: '',
      limit: 1000,
    });
    const items = Array.from(document.querySelectorAll('.annotation-applied-item'));
    // Most recently applied gene first, and its two commits are one entry.
    expect(items[0].textContent).toContain('lysC');
    expect(items[0].textContent).toContain('2 applied');
    expect(items[1].textContent).toContain('thrB');
    expect(document.getElementById('annotationAppliedTotal').textContent).toBe('2 genes · 3 applied ChangeSets');
    expect(document.querySelector('.annotation-review-applied-count').textContent).toBe('3');

    items[0].querySelector('.annotation-applied-main').click();
    const expanded = document.querySelectorAll('.annotation-applied-item')[0];
    expect(expanded.querySelector('.annotation-applied-history').hidden).toBe(false);
    const records = expanded.querySelectorAll('.annotation-applied-record');
    expect(records.length).toBe(2);
    // Newest commit first, showing the value that was written.
    expect(records[0].textContent).toContain('cs-a2');
    expect(records[0].textContent).toContain('kinase activity confirmed');
    expect(records[1].textContent).toContain('cs-a1');
  });

  it('navigates the genome view to an applied gene and closes the review center', async () => {
    const listAnnotationChangesets = vi.fn(async () => ({
      success: true,
      total: 1,
      statusCounts: { committed: 1 },
      changeSets: [appliedSummary('cs-a4', 'ygaQ')],
    }));
    const navigateToPosition = vi.fn(() => ({ success: true }));
    const app = {
      configManager: { get: vi.fn(() => ({})), set: vi.fn(), save: vi.fn() },
      chatManager: { services: { annotation: { listAnnotationChangesets } } },
      navigationManager: { navigateToPosition },
      showNotification: vi.fn(),
    };
    const Manager = loadManager(browserWindow());
    const manager = new Manager(app);
    document.getElementById('annotationReviewModal').classList.add('show');

    await manager.refreshAppliedGenes();
    document.querySelector('[data-action="applied-locate"]').click();

    expect(navigateToPosition).toHaveBeenCalledWith('U00096.3', 100, 400);
    expect(document.getElementById('annotationReviewModal').classList.contains('show')).toBe(false);
    expect(app.showNotification).toHaveBeenCalledWith('Navigated to ygaQ.', 'success');
  });

  it('reports targets without recorded coordinates instead of navigating', async () => {
    const listAnnotationChangesets = vi.fn(async () => ({
      success: true,
      total: 1,
      statusCounts: { committed: 1 },
      changeSets: [
        appliedSummary('cs-a5', 'pinH', {
          target: { featureId: 'feat-pinH', geneSymbol: 'pinH', featureType: 'CDS' },
        }),
      ],
    }));
    const navigateToPosition = vi.fn();
    const app = {
      configManager: { get: vi.fn(() => ({})), set: vi.fn(), save: vi.fn() },
      chatManager: { services: { annotation: { listAnnotationChangesets } } },
      navigationManager: { navigateToPosition },
      showNotification: vi.fn(),
    };
    const Manager = loadManager(browserWindow());
    const manager = new Manager(app);

    await manager.refreshAppliedGenes();
    const locateButton = document.querySelector('[data-action="applied-locate"]');

    expect(locateButton.disabled).toBe(true);
    manager.locateAppliedGene('feat-pinH');
    expect(navigateToPosition).not.toHaveBeenCalled();
    expect(app.showNotification).toHaveBeenCalledWith(
      'This ChangeSet target has no recorded coordinates to navigate to.',
      'warning'
    );
  });

  it('opens an applied audit record back in the review queue', async () => {
    const applied = appliedSummary('cs-a6', 'metL');
    const listAnnotationChangesets = vi.fn(async () => ({
      success: true,
      total: 1,
      statusCounts: { committed: 1 },
      changeSets: [applied],
    }));
    const getAnnotationChangeset = vi.fn(async () => ({
      success: true,
      changeSet: { id: applied.id, target: applied.target, operations: [], evidence: [] },
    }));
    const app = {
      configManager: { get: vi.fn(() => ({})), set: vi.fn(), save: vi.fn() },
      chatManager: { services: { annotation: { listAnnotationChangesets, getAnnotationChangeset } } },
      showNotification: vi.fn(),
    };
    const Manager = loadManager(browserWindow());
    const manager = new Manager(app);
    document.getElementById('annotationReviewFilter').innerHTML =
      '<option value="active" selected>active</option><option value="committed">committed</option>';

    await manager.refreshAppliedGenes();
    manager.toggleAppliedGene('feat-metL');
    await manager.openAppliedRecord(applied.id);

    expect(document.getElementById('annotationReviewFilter').value).toBe('committed');
    expect(document.querySelector('[data-review-panel="queue"]').classList.contains('active')).toBe(true);
    expect(getAnnotationChangeset).toHaveBeenCalledWith({ changeSetId: applied.id });
    expect(listAnnotationChangesets).toHaveBeenCalledWith(
      expect.objectContaining({ query: applied.id, includeArchived: true, riskLevels: [] })
    );
  });

  it('exposes the annotated genes tab and panel in the review center markup', () => {
    const html = fs.readFileSync(RENDERER_INDEX_PATH, 'utf8');

    expect(html).toContain('data-review-tab="applied"');
    expect(html).toContain('data-review-panel="applied"');
    expect(html).toContain('id="annotationAppliedGenes"');
    expect(html.indexOf('data-review-tab="applied"')).toBeLessThan(html.indexOf('data-review-tab="governance"'));
  });
  it.each([
    ['awaiting_approval', false, true, true, true, false],
    ['approved', false, true, true, true, false],
    ['committed', false, false, false, true, false],
    ['rejected', false, false, false, true, false],
    ['stale', false, false, false, true, false],
    ['awaiting_approval', true, false, false, false, true],
    ['committed', true, false, false, false, true],
  ])('enforces the button state for %s (archived=%s)', (status, archived, approve, reject, archive, restore) => {
    const record = { ...summary('cs-state', 'thrB', 'hash'), status, archivedAt: archived ? '2026-10-12' : null };
    actionFixture([record]);
    document.querySelector('.annotation-review-checkbox').click();
    for (const [id, enabled] of Object.entries({
      annotationReviewDeleteBtn: status !== 'committed',
      annotationReviewApproveBtn: approve,
      annotationReviewApproveApplyBtn: approve,
      annotationReviewRejectBtn: reject,
      annotationReviewArchiveBtn: archive,
      annotationReviewRestoreBtn: restore,
    })) {
      expect(document.getElementById(id).disabled).toBe(!enabled);
    }
  });

  it('allows rejection and archiving by the creator while preventing self-approval', () => {
    actionFixture([{ ...summary('cs-own', 'thrB', 'hash'), createdBy: 'local-curator' }]);
    document.querySelector('.annotation-review-checkbox').click();
    expect(document.getElementById('annotationReviewApproveBtn').disabled).toBe(true);
    expect(document.getElementById('annotationReviewRejectBtn').disabled).toBe(false);
    expect(document.getElementById('annotationReviewArchiveBtn').disabled).toBe(false);
  });

  it('blocks every batch write when batch review is disabled', async () => {
    const { manager, service, mockWindow } = actionFixture([summary('a', 'thrB', 'ha'), summary('b', 'thrC', 'hb')], {
      batchReviewEnabled: false,
    });
    document.querySelectorAll('.annotation-review-checkbox').forEach(input => input.click());
    for (const id of [
      'annotationReviewApproveBtn',
      'annotationReviewApproveApplyBtn',
      'annotationReviewRejectBtn',
      'annotationReviewArchiveBtn',
      'annotationReviewDeleteBtn',
    ]) {
      expect(document.getElementById(id).disabled).toBe(true);
    }
    await manager.rejectSelected();
    await manager.archiveSelected(true);
    expect(service.rejectAnnotationChangeset).not.toHaveBeenCalled();
    expect(mockWindow.confirm).not.toHaveBeenCalled();
    expect(document.getElementById('annotationReviewReasonDialog')).toBeNull();
  });

  it('deletes through the real button with one permanent confirmation and ignores double clicks', async () => {
    const { manager, service, mockWindow } = actionFixture([summary('a', 'thrB', 'ha'), summary('b', 'thrC', 'hb')]);
    manager.toggleSelectAll(true);
    manager.approvalTokens.set('a', 'old-token');
    const button = document.getElementById('annotationReviewDeleteBtn');
    expect(button.disabled).toBe(false);
    button.click();
    button.click();
    await vi.waitFor(() => expect(manager.isActing).toBe(false));
    expect(mockWindow.confirm).toHaveBeenCalledTimes(1);
    expect(mockWindow.confirm.mock.calls[0][0]).toContain('Deletion cannot be undone');
    expect(service.deleteAnnotationChangeset).toHaveBeenCalledTimes(2);
    expect(manager.approvalTokens.has('a')).toBe(false);
    expect(document.querySelectorAll('.annotation-review-checkbox')).toHaveLength(0);
  });

  it('cancels permanent deletion without touching records', async () => {
    const { manager, service, mockWindow } = actionFixture([summary('a', 'thrB', 'ha')]);
    manager.toggleSelectAll(true);
    mockWindow.confirm.mockReturnValue(false);
    await manager.deleteSelected();
    expect(service.deleteAnnotationChangeset).not.toHaveBeenCalled();
    expect(manager.changeSets.has('a')).toBe(true);
    expect(document.getElementById('annotationReviewDeleteBtn').disabled).toBe(false);
  });

  it('blocks deletion of applied records and mixed batches before confirmation', async () => {
    const { manager, service, mockWindow } = actionFixture([
      summary('a', 'thrB', 'ha'),
      { ...summary('b', 'thrC', 'hb'), status: 'committed' },
    ]);
    manager.toggleSelectAll(true);
    expect(document.getElementById('annotationReviewDeleteBtn').disabled).toBe(true);
    expect(document.getElementById('annotationReviewDeleteBtn').title).toContain('archive instead');
    await manager.deleteSelected();
    expect(mockWindow.confirm).not.toHaveBeenCalled();
    expect(service.deleteAnnotationChangeset).not.toHaveBeenCalled();
    expect(
      manager._renderChangeSetDetail(manager.changeSets.get('b'), {}).match(/data-action="delete"[^>]*disabled/)
    ).not.toBeNull();
  });

  it('deletes only the requested detail record and isolates batch failures', async () => {
    const records = [summary('a', 'thrB', 'ha'), summary('b', 'thrC', 'hb')];
    const { manager, service, app } = actionFixture(records);
    await manager.viewChangeSet('a');
    document.querySelector('#annotationReviewDetail [data-action="delete"]').click();
    await vi.waitFor(() => expect(manager.isActing).toBe(false));
    expect(service.deleteAnnotationChangeset).toHaveBeenCalledExactlyOnceWith({ changeSetId: 'a' });
    expect(manager.changeSets.has('b')).toBe(true);
    expect(document.getElementById('annotationReviewDetail').textContent).toBe('');
    records.push(summary('c', 'thrD', 'hc'));
    await manager.refreshQueue();
    manager.toggleSelectAll(true);
    service.deleteAnnotationChangeset.mockRejectedValueOnce(new Error('disk full'));
    await manager.deleteSelected();
    expect(manager.changeSets.has('b')).toBe(true);
    expect(manager.changeSets.has('c')).toBe(false);
    expect(app.showNotification).toHaveBeenCalledWith('1/2 ChangeSets deleted; 1 failed (disk full).', 'warning');
  });

  it('selects an actionable batch from 52 records sharing one target and rejects through the button', async () => {
    const records = Array.from({ length: 52 }, (_, i) => summary(`cs-batch-${i}`, 'benchmark_bulk_gene', `hash-${i}`));
    const { manager, service } = actionFixture(records);
    const selectAll = document.getElementById('annotationReviewSelectAll');
    selectAll.click();

    expect(manager._selectedChangeSets()).toHaveLength(50);
    expect(selectAll.checked).toBe(true);
    expect(selectAll.indeterminate).toBe(false);
    expect(document.getElementById('annotationReviewEligibleLabel').textContent).toBe('50 of 52 selectable');
    expect(document.getElementById('annotationReviewArchiveBtn').disabled).toBe(false);
    expect(document.getElementById('annotationReviewRejectBtn').disabled).toBe(false);
    expect(document.getElementById('annotationReviewApproveBtn').disabled).toBe(true);
    expect(document.getElementById('annotationReviewApproveBtn').title).toContain('one proposal per target');
    const hint = document.getElementById('annotationReviewActionHint');
    expect(hint.hidden).toBe(false);
    expect(hint.textContent).toContain('up to 50 records');
    expect(hint.textContent).toContain('benchmark_bulk_gene');

    document.getElementById('annotationReviewRejectBtn').click();
    document.getElementById('annotationReviewReasonInput').value = 'Duplicate benchmark proposals';
    document.querySelector('[data-reason-action="confirm"]').click();
    await vi.waitFor(() => expect(manager.isActing).toBe(false));
    expect(service.rejectAnnotationChangeset).toHaveBeenCalledTimes(50);
    expect(records.slice(0, 50).every(record => record.status === 'rejected')).toBe(true);
    expect(records.slice(50).every(record => record.status === 'awaiting_approval')).toBe(true);
    selectAll.click();
    expect(manager._selectedChangeSets()).toHaveLength(2);
    expect(document.getElementById('annotationReviewRejectBtn').disabled).toBe(false);
    selectAll.click();
    expect(manager._selectedChangeSets()).toHaveLength(0);
  });

  it('selects a single actionable record when batch review is disabled', () => {
    const { manager } = actionFixture([summary('a', 'thrB', 'ha'), summary('b', 'thrC', 'hb')], {
      batchReviewEnabled: false,
    });
    const selectAll = document.getElementById('annotationReviewSelectAll');
    selectAll.click();
    expect(manager._selectedChangeSets()).toHaveLength(1);
    expect(document.getElementById('annotationReviewApproveBtn').disabled).toBe(false);
    expect(document.getElementById('annotationReviewRejectBtn').disabled).toBe(false);
    expect(document.getElementById('annotationReviewArchiveBtn').disabled).toBe(false);
    selectAll.click();
    expect(manager._selectedChangeSets()).toHaveLength(0);
  });

  it('explains a manual over-limit selection and re-enables actions when it is corrected', async () => {
    const { manager, service, app } = actionFixture([summary('a', 'thrB', 'ha'), summary('b', 'thrC', 'hb')], {
      batchSizeLimit: 1,
    });
    const checkboxes = document.querySelectorAll('.annotation-review-checkbox');
    checkboxes.forEach(input => input.click());
    const archive = document.getElementById('annotationReviewArchiveBtn');
    expect(archive.disabled).toBe(true);
    expect(document.getElementById('annotationReviewDeleteBtn').disabled).toBe(true);
    expect(archive.title).toContain('no more than 1');
    expect(document.getElementById('annotationReviewActionHint').textContent).toContain(
      'raise the limit in Governance'
    );
    await manager.archiveSelected(true);
    expect(service.setAnnotationChangesetArchived).not.toHaveBeenCalled();
    expect(app.showNotification).toHaveBeenCalledWith(archive.title, 'warning');
    checkboxes[1].click();
    expect(archive.disabled).toBe(false);
    expect(archive.title).toBe('');
    expect(archive.hasAttribute('aria-description')).toBe(false);
    expect(document.getElementById('annotationReviewApproveBtn').disabled).toBe(false);
  });

  it('keeps a capped archive batch actionable and restores through the button', async () => {
    const records = Array.from({ length: 3 }, (_, i) => summary(`archive-${i}`, 'thrB', `hash-${i}`));
    const { manager, service } = actionFixture(records, { batchSizeLimit: 2 });
    document.getElementById('annotationReviewSelectAll').click();
    document.getElementById('annotationReviewArchiveBtn').click();
    await vi.waitFor(() => expect(manager.isActing).toBe(false));
    expect(service.setAnnotationChangesetArchived).toHaveBeenCalledTimes(2);
    expect(records[2].archivedAt).toBeUndefined();
    document.getElementById('annotationReviewArchiveFilter').value = 'archived';
    await manager.refreshQueue();
    document.getElementById('annotationReviewSelectAll').click();
    expect(document.getElementById('annotationReviewRestoreBtn').disabled).toBe(false);
    document.getElementById('annotationReviewRestoreBtn').click();
    await vi.waitFor(() => expect(manager.isActing).toBe(false));
    expect(service.setAnnotationChangesetArchived).toHaveBeenCalledTimes(4);
    expect(records.every(record => !record.archivedAt)).toBe(true);
  });

  it('rejects through the real button with one dialog, ignores double clicks and prevents blank reasons', async () => {
    const { manager, service, mockWindow } = actionFixture([summary('cs-reject-button', 'thrB', 'hash')]);
    document.querySelector('.annotation-review-checkbox').click();
    const button = document.getElementById('annotationReviewRejectBtn');
    button.click();
    button.click();
    const extra = manager.rejectSelected();
    expect(document.querySelectorAll('#annotationReviewReasonDialog')).toHaveLength(1);
    const input = document.getElementById('annotationReviewReasonInput');
    input.value = '   ';
    document.querySelector('[data-reason-action="confirm"]').click();
    expect(input.classList.contains('is-invalid')).toBe(true);
    expect(service.rejectAnnotationChangeset).not.toHaveBeenCalled();
    input.value = 'Evidence is insufficient';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await extra;
    await vi.waitFor(() => expect(manager.isActing).toBe(false));
    expect(service.rejectAnnotationChangeset).toHaveBeenCalledExactlyOnceWith({
      changeSetId: 'cs-reject-button',
      reason: 'Evidence is insufficient',
    });
    expect(mockWindow.confirm).not.toHaveBeenCalled();
  });

  it('cancels rejection on Escape, keeps focus inside the dialog and honors Enter on Cancel', async () => {
    const { manager, service } = actionFixture([summary('cs-cancel-keys', 'thrB', 'hash')]);
    manager.toggleSelectAll(true);
    const pending = manager.rejectSelected();
    const input = document.getElementById('annotationReviewReasonInput');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
    expect(document.activeElement.dataset.reasonAction).toBe('confirm');
    const cancel = document.querySelector('[data-reason-action="cancel"]');
    cancel.focus();
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    cancel.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(false);
    expect(service.rejectAnnotationChangeset).not.toHaveBeenCalled();
    const bubble = vi.fn();
    document.addEventListener('keydown', bubble);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await pending;
    document.removeEventListener('keydown', bubble);
    expect(bubble).not.toHaveBeenCalled();
    expect(service.rejectAnnotationChangeset).not.toHaveBeenCalled();
    expect(manager.isActing).toBe(false);
  });

  it('archives and restores using the selected buttons and preserves the independent confirmation sessions', async () => {
    const record = summary('cs-archive-buttons', 'thrB', 'hash');
    const { manager, service, mockWindow } = actionFixture([record]);
    manager.toggleSelectAll(true);
    document.getElementById('annotationReviewArchiveBtn').click();
    await vi.waitFor(() => expect(manager.isActing).toBe(false));
    expect(service.setAnnotationChangesetArchived).toHaveBeenCalledWith({ changeSetId: record.id, archived: true });
    expect(document.querySelector('.annotation-review-checkbox')).toBeNull();
    document.getElementById('annotationReviewArchiveFilter').value = 'archived';
    document.getElementById('annotationReviewArchiveFilter').dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(document.querySelector('.annotation-review-checkbox')).not.toBeNull());
    manager.toggleSelectAll(true);
    document.getElementById('annotationReviewRestoreBtn').click();
    await vi.waitFor(() => expect(manager.isActing).toBe(false));
    expect(service.setAnnotationChangesetArchived).toHaveBeenCalledWith({ changeSetId: record.id, archived: false });
    expect(mockWindow.confirm).toHaveBeenCalledTimes(2);
  });

  it('creates a rollback proposal through detail actions and clears filters before opening it', async () => {
    const record = appliedSummary('cs-applied-rollback', 'thrB');
    const { manager, service } = actionFixture([record]);
    const proposal = summary('cs-rollback', 'thrB', 'rollback-hash');
    service.rollbackAnnotationChangeset.mockImplementation(async () => {
      // Fixture list reads the same mutable array used by actionFixture.
      service.listAnnotationChangesets.mockResolvedValue({ total: 1, changeSets: [proposal], statusCounts: {} });
      service.getAnnotationChangeset.mockResolvedValue({ changeSet: proposal });
      return { changeSet: proposal };
    });
    await manager.viewChangeSet(record.id);
    document.getElementById('annotationReviewRiskFilter').innerHTML =
      '<option value="high">high</option><option value="">all</option>';
    document.getElementById('annotationReviewSearch').value = 'old query';
    document.querySelector('[data-action="rollback"]').click();
    await vi.waitFor(() => expect(manager.isActing).toBe(false));
    expect(service.rollbackAnnotationChangeset).toHaveBeenCalledExactlyOnceWith({ changeSetId: record.id });
    expect(service.applyAnnotationChangeset).not.toHaveBeenCalled();
    expect(manager.activeChangeSetId).toBe(proposal.id);
    expect(document.getElementById('annotationReviewSearch').value).toBe('');
    expect(document.getElementById('annotationReviewRiskFilter').value).toBe('');
  });

  it('isolates batch failures, clears busy state and reports failed actions', async () => {
    const { manager, service, app } = actionFixture([summary('fail', 'thrB', 'hf'), summary('ok', 'thrC', 'ho')]);
    service.setAnnotationChangesetArchived.mockImplementation(async ({ changeSetId }) => {
      if (changeSetId === 'fail') throw new Error('disk full');
      return { success: true };
    });
    manager.toggleSelectAll(true);
    await manager.archiveSelected(true);
    expect(service.setAnnotationChangesetArchived).toHaveBeenCalledTimes(2);
    expect(app.showNotification).toHaveBeenCalledWith('1/2 ChangeSets archived; 1 failed (disk full).', 'warning');
    expect(manager.isActing).toBe(false);
    expect(manager.activeDecisionSession).toBeNull();
  });

  it('does not authorize an action against a genome changed while the reason dialog was open', async () => {
    const { manager, service, app } = actionFixture([summary('cs-workspace', 'thrB', 'hash')]);
    manager.toggleSelectAll(true);
    const pending = manager.rejectSelected();
    app.loadedGenomePath = '/another/genome.gbk';
    document.querySelector('[data-reason-action="confirm"]').click();
    await pending;
    expect(service.rejectAnnotationChangeset).not.toHaveBeenCalled();
    expect(app.showNotification).toHaveBeenCalledWith(expect.stringContaining('workspace changed'), 'warning');
  });

  it('refreshes a retained detail after approval and ignores late detail responses after closing', async () => {
    const record = summary('cs-detail-refresh', 'thrB', 'hash');
    const { manager, service } = actionFixture([record]);
    await manager.viewChangeSet(record.id);
    record.status = 'approved';
    await manager.refreshQueue();
    expect(document.getElementById('annotationReviewDetail').textContent).toContain('Status: Approved');
    let finish;
    service.getAnnotationChangeset.mockReturnValueOnce(
      new Promise(resolve => {
        finish = resolve;
      })
    );
    const late = manager.viewChangeSet(record.id);
    await manager._handleQueueClick({ target: { closest: () => ({ dataset: { action: 'close-details' } }) } });
    finish({ changeSet: record });
    await late;
    expect(document.getElementById('annotationReviewDetail').innerHTML).toBe('');
  });

  it('queues filter refreshes while a ledger request is pending', async () => {
    const { manager, service } = actionFixture([]);
    let finish;
    service.listAnnotationChangesets.mockReturnValueOnce(
      new Promise(resolve => {
        finish = resolve;
      })
    );
    const first = manager.refreshQueue();
    document.getElementById('annotationReviewArchiveFilter').value = 'archived';
    await manager.refreshQueue();
    finish({ total: 0, changeSets: [], statusCounts: {} });
    await first;
    expect(service.listAnnotationChangesets).toHaveBeenLastCalledWith(
      expect.objectContaining({ archivedOnly: true, includeArchived: true })
    );
  });

  it('keeps the reason dialog above the production modal and exposes archive controls in the shipped markup', () => {
    const css = fs.readFileSync(path.join(process.cwd(), 'src/renderer/css/annotation-review.css'), 'utf8');
    const modalCss = fs.readFileSync(path.join(process.cwd(), 'src/renderer/css/modals.css'), 'utf8');
    const reasonLayer = Number(css.match(/\.annotation-review-reason-dialog\s*\{[^}]*z-index:\s*(\d+)/)[1]);
    const modalLayer = Number(modalCss.match(/\.modal\s*\{[^}]*z-index:\s*(\d+)/)[1]);
    expect(reasonLayer).toBeGreaterThan(modalLayer);
    const html = fs.readFileSync(RENDERER_INDEX_PATH, 'utf8');
    for (const id of [
      'annotationReviewArchiveBtn',
      'annotationReviewRestoreBtn',
      'annotationReviewArchiveFilter',
      'annotationAppliedShowArchived',
    ]) {
      expect(html).toContain(`id="${id}"`);
    }
  });
  it('saves reviewer preferences through the button and rejects empty identities', async () => {
    const { manager, app } = actionFixture([]);
    const identity = document.getElementById('annotationCuratorIdentity');
    identity.value = '  ';
    document.getElementById('annotationGovernanceSaveBtn').click();
    await vi.waitFor(() =>
      expect(app.showNotification).toHaveBeenCalledWith('Curator identity must contain 1–128 characters.', 'error')
    );
    expect(app.configManager.set).not.toHaveBeenCalled();
    identity.value = 'new-curator';
    document.getElementById('annotationApprovalExpiry').value = '40';
    document.getElementById('annotationBatchLimit').value = '10';
    document.getElementById('annotationBatchReviewEnabled').checked = false;
    document.getElementById('annotationGovernanceSaveBtn').click();
    await vi.waitFor(() => expect(manager.settings.curatorIdentity).toBe('new-curator'));
    expect(app.configManager.set).toHaveBeenCalledWith('generalSettings.annotationGovernance', {
      curatorIdentity: 'new-curator',
      approvalExpiryMinutes: 40,
      batchSizeLimit: 10,
      batchReviewEnabled: false,
    });
    expect(app.localCuratorIdentity).toBe('new-curator');
  });

  it('does not publish new reviewer settings when persistence fails', async () => {
    const { manager, app } = actionFixture([]);
    app.configManager.save.mockRejectedValue(new Error('settings write failed'));
    document.getElementById('annotationCuratorIdentity').value = 'failed-curator';
    await expect(manager.saveGovernanceSettings()).rejects.toThrow('settings write failed');
    expect(manager.settings.curatorIdentity).toBe('local-curator');
    expect(app.localCuratorIdentity).toBe('local-curator');
    expect(document.getElementById('annotationGovernanceSaveBtn').disabled).toBe(false);
    expect(app.showNotification).not.toHaveBeenCalledWith('Annotation governance preferences saved.', 'success');
  });

  it('opens research reports through the detail button and supports closing, Escape and read errors', async () => {
    const record = {
      ...summary('cs-report-button', 'thrB', 'hash'),
      researchRun: 'task-report',
      reportAttachment: 'dgr:task-report',
    };
    const { manager, app, mockWindow } = actionFixture([record]);
    const reader = vi.fn().mockResolvedValue({
      success: true,
      title: 'Research report',
      taskId: 'task-report',
      reportMarkdown: '# Evidence report',
    });
    mockWindow.electronAPI = { readDgrReportAttachment: reader };
    await manager.viewChangeSet(record.id);
    document.querySelector('[data-action="open-report"]').click();
    await vi.waitFor(() => expect(document.getElementById('dgrReportOverlay')).not.toBeNull());
    expect(reader).toHaveBeenCalledWith('', 'task-report');
    expect(document.getElementById('dgrReportOverlay').textContent).toContain('# Evidence report');
    document.querySelector('#dgrReportOverlay button').click();
    expect(document.getElementById('dgrReportOverlay')).toBeNull();
    document.querySelector('[data-action="open-report"]').click();
    await vi.waitFor(() => expect(document.getElementById('dgrReportOverlay')).not.toBeNull());
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.getElementById('dgrReportOverlay')).toBeNull();
    reader.mockRejectedValue(new Error('attachment missing'));
    document.querySelector('[data-action="open-report"]').click();
    await vi.waitFor(() =>
      expect(app.showNotification).toHaveBeenCalledWith('Failed to read research report: attachment missing', 'error')
    );
  });

  it('refreshes both lists from their buttons and passes the archived toggle and applied sort', async () => {
    const { manager, service } = actionFixture([]);
    document.getElementById('annotationReviewRefreshBtn').click();
    await vi.waitFor(() =>
      expect(service.listAnnotationChangesets).toHaveBeenCalledWith(
        expect.objectContaining({ statuses: ['awaiting_approval', 'approved'] })
      )
    );
    document.getElementById('annotationAppliedShowArchived').click();
    await vi.waitFor(() =>
      expect(service.listAnnotationChangesets).toHaveBeenCalledWith(
        expect.objectContaining({ statuses: ['committed'], includeArchived: true })
      )
    );
    document.getElementById('annotationAppliedRefreshBtn').click();
    await vi.waitFor(() => expect(manager.isAppliedLoading).toBe(false));
    document.getElementById('annotationAppliedSort').innerHTML = '<option value="gene" selected>gene</option>';
    const groups = [
      { label: 'thrC', changeSets: [] },
      { label: 'thrA', changeSets: [] },
    ];
    expect(manager._sortAppliedGroups(groups).map(group => group.label)).toEqual(['thrA', 'thrC']);
  });

  it.each([null, { start: null, end: 20 }, { start: 10, end: null }, { start: 30, end: 20 }])(
    'disables Go to gene for invalid coordinates %s',
    coordinates => {
      const { manager, app } = actionFixture([]);
      app.navigationManager = { navigateToPosition: vi.fn() };
      const group = manager._groupAppliedChangeSets([
        appliedSummary('cs-invalid-location', 'thrB', {
          target: { featureId: 'f1', geneSymbol: 'thrB', chromosome: 'chr1', coordinates },
        }),
      ])[0];
      manager.appliedGeneGroups.set(group.key, group);
      manager._renderAppliedGenes([group]);
      expect(document.querySelector('[data-action="applied-locate"]').disabled).toBe(true);
      manager.locateAppliedGene(group.key);
      expect(app.navigationManager.navigateToPosition).not.toHaveBeenCalled();
    }
  );

  it('does not reuse an approval token after its expiry', async () => {
    const record = {
      ...summary('cs-expired', 'thrB', 'hash'),
      status: 'approved',
      approval: { expiresAt: '2000-01-01', approver: 'local-curator' },
    };
    const { manager, service } = actionFixture([record]);
    manager.approvalTokens.set(record.id, 'expired-token');
    manager.toggleSelectAll(true);
    await manager.approveSelected(true);
    expect(service.requestAnnotationApproval).toHaveBeenCalledOnce();
    expect(service.applyAnnotationChangeset).toHaveBeenCalledWith({
      changeSetId: record.id,
      approvalToken: `token-${record.id}`,
    });
  });
});
