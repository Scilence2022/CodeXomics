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
    <div id="annotationReviewModal"></div>
    <button id="annotationReviewToolbarBtn"></button>
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
    <button id="annotationReviewApproveBtn"></button>
    <button id="annotationReviewApproveApplyBtn"></button>
    <button id="annotationReviewRejectBtn"></button>
    <div id="annotationReviewQueue"></div>
    <aside id="annotationReviewDetail"></aside>
    <input id="annotationCuratorIdentity" value="local-curator">
    <input id="annotationApprovalExpiry" value="30">
    <input id="annotationBatchLimit" value="50">
    <input id="annotationBatchReviewEnabled" type="checkbox" checked>
    <button id="annotationGovernanceSaveBtn"></button>
  `;
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

describe('AnnotationReviewManager', () => {
  beforeEach(() => {
    reviewDom();
  });

  it('opens the review center from the global toolbar entry', () => {
    const mockWindow = { confirm: vi.fn(), prompt: vi.fn(), alert: vi.fn() };
    const Manager = loadManager(mockWindow);
    const manager = new Manager({ configManager: null });
    const showReviewCenter = vi.spyOn(manager, 'showReviewCenter').mockImplementation(() => {});

    document.getElementById('annotationReviewToolbarBtn').click();

    expect(showReviewCenter).toHaveBeenCalledOnce();
  });

  it('keeps a labeled global Review entry in the renderer toolbar', () => {
    const html = fs.readFileSync(RENDERER_INDEX_PATH, 'utf8');

    expect(html).toContain('id="annotationReviewToolbarBtn"');
    expect(html).toMatch(/id="annotationReviewToolbarBtn"[\s\S]*?<span>Review<\/span>/);
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

  it('renders applied and stale ChangeSets as explicit read-only history instead of broken checkboxes', () => {
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

    expect(document.querySelectorAll('.annotation-review-checkbox')).toHaveLength(0);
    expect(document.querySelectorAll('.annotation-review-read-only')).toHaveLength(2);
    expect(document.getElementById('annotationReviewSelectAll').disabled).toBe(true);
    expect(document.getElementById('annotationReviewEligibleLabel').textContent).toBe('0 eligible');
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
    expect(document.getElementById('annotationReviewEligibleLabel').textContent).toBe('1 eligible');
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
});
