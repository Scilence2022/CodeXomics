/* eslint-disable no-new-func */
/**
 * Deep Gene Research progress dock tests
 *
 * A research run takes minutes, and its transcript bubble is pinned where the
 * run was submitted — so it scrolls out of view as soon as the conversation
 * moves on and the run looks stalled. ResearchProgressService mirrors every
 * tracked run into a dock between the transcript and the composer that never
 * scrolls away. These tests pin that behaviour plus the ChatManager wiring
 * that feeds it.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

const SERVICE_PATH = path.join(process.cwd(), 'src/renderer/modules/chat/services/ResearchProgressService.js');

function loadService() {
  const code = fs
    .readFileSync(SERVICE_PATH, 'utf-8')
    .replace('window.ResearchProgressService = ResearchProgressService;', '');
  return new Function(`${code}; return ResearchProgressService;`)();
}

const ResearchProgressService = loadService();

/** Build the minimal ChatBox panel the dock inserts itself into. */
function mountChatPanel() {
  document.body.innerHTML = `
    <div id="app">
      <div id="llmChatPanel" class="chat-panel">
        <div class="chat-header"></div>
        <div class="chat-messages" id="chatMessages"></div>
        <div class="chat-input-container"></div>
      </div>
    </div>
  `;
}

function createService(chatManager = {}) {
  return new ResearchProgressService({}, chatManager);
}

function makeTask(overrides = {}) {
  return {
    taskId: 'task-1',
    serverId: 'deep-gene-research',
    kind: 'mcp',
    geneSymbol: 'yhcA',
    status: 'in_progress',
    createdAt: new Date(Date.now() - 65000).toISOString(),
    progress: 60,
    currentStep: 'gene-search',
    ...overrides,
  };
}

const dock = () => document.getElementById('researchProgressDock');
const rows = () => Array.from(document.querySelectorAll('.research-progress-item'));

describe('ResearchProgressService - dock rendering', () => {
  beforeEach(() => {
    mountChatPanel();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('renders the dock as a sibling of the transcript so it never scrolls away', () => {
    const service = createService();
    service.upsert(makeTask());

    const panel = document.getElementById('llmChatPanel');
    expect(dock()).toBeTruthy();
    expect(dock().parentElement).toBe(panel);
    // Between the transcript and the composer, not inside the scrolling list.
    expect(document.getElementById('chatMessages').contains(dock())).toBe(false);
    expect(dock().nextElementSibling.className).toBe('chat-input-container');
  });

  it('shows gene, status, step and percentage for a running task', () => {
    const service = createService();
    service.upsert(makeTask());

    const row = rows()[0];
    expect(row.querySelector('.research-progress-gene').textContent).toBe('yhcA');
    expect(row.querySelector('.research-progress-status').textContent).toBe('Researching');
    expect(row.querySelector('.research-progress-step').textContent).toContain('Gene search');
    expect(row.querySelector('.research-progress-percent').textContent).toBe('60%');
    expect(row.querySelector('.research-progress-fill').getAttribute('style')).toContain('width: 60%');
  });

  it('stays hidden until a task exists and hides again once all are dismissed', () => {
    const service = createService();
    service.render();
    expect(dock()).toBeNull();

    service.upsert(makeTask());
    expect(dock().style.display).toBe('block');

    service.dismiss('task-1');
    expect(dock().style.display).toBe('none');
  });

  it('updates the existing row in place instead of stacking rows', () => {
    const service = createService();
    service.upsert(makeTask({ progress: 20, currentStep: 'literature-search' }));
    service.upsert(makeTask({ progress: 75, currentStep: 'gene-llm-queries' }));

    expect(rows()).toHaveLength(1);
    expect(rows()[0].querySelector('.research-progress-percent').textContent).toBe('75%');
    expect(rows()[0].querySelector('.research-progress-step').textContent).toContain('Gene llm queries');
  });

  it('falls back to an indeterminate bar when the server reports no percentage', () => {
    const service = createService();
    service.upsert(makeTask({ status: 'pending', progress: undefined, currentStep: null }));

    const fill = rows()[0].querySelector('.research-progress-fill');
    expect(fill.classList.contains('indeterminate')).toBe(true);
    expect(rows()[0].querySelector('.research-progress-status').textContent).toBe('Queued');
    expect(rows()[0].querySelector('.research-progress-percent').textContent).toBe('');
  });

  it('keeps a running task percentage after a poll that omits progress', () => {
    const service = createService();
    service.upsert(makeTask({ progress: 45 }));
    service.upsert(makeTask({ progress: undefined }));

    expect(service.entries.get('task-1').progress).toBe(45);
  });

  it('summarises the run in the header so a collapsed dock still reports progress', () => {
    const service = createService();
    service.upsert(makeTask());

    expect(document.getElementById('researchProgressSummary').textContent).toBe('yhcA · 60% · Gene search');

    document.getElementById('researchProgressHeader').click();
    expect(service.isCollapsed).toBe(true);
    expect(document.getElementById('researchProgressList').style.display).toBe('none');
    expect(dock().classList.contains('collapsed')).toBe(true);
  });

  it('reports the number of concurrent runs in the header', () => {
    const service = createService();
    service.upsert(makeTask({ taskId: 'a', geneSymbol: 'yhcA' }));
    service.upsert(makeTask({ taskId: 'b', geneSymbol: 'sbmC' }));

    expect(rows()).toHaveLength(2);
    expect(document.getElementById('researchProgressSummary').textContent).toBe('2 runs in progress');
  });

  it('escapes gene symbols and error text instead of injecting markup', () => {
    const service = createService();
    service.upsert(makeTask({ geneSymbol: '<img src=x onerror=alert(1)>', error: '<b>boom</b>' }));

    expect(document.querySelector('#researchProgressList img')).toBeNull();
    expect(document.querySelector('#researchProgressList b')).toBeNull();
    expect(rows()[0].querySelector('.research-progress-gene').textContent).toBe('<img src=x onerror=alert(1)>');
  });
});

describe('ResearchProgressService - lifecycle', () => {
  beforeEach(() => {
    mountChatPanel();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('auto-dismisses a completed run after the linger window', () => {
    const service = createService();
    service.upsert(makeTask({ status: 'completed', progress: 100 }));

    expect(rows()[0].classList.contains('is-completed')).toBe(true);
    // No cancel button once the run is terminal.
    expect(rows()[0].querySelector('[data-action="cancel"]')).toBeNull();

    vi.advanceTimersByTime(service.completedLingerMs + 10);
    expect(service.entries.size).toBe(0);
    expect(dock().style.display).toBe('none');
  });

  it('keeps a failed run on screen until it is dismissed', () => {
    const service = createService();
    service.upsert(makeTask({ status: 'failed', error: 'server unreachable' }));

    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(service.entries.size).toBe(1);
    expect(rows()[0].querySelector('.research-progress-error').textContent).toBe('server unreachable');

    rows()[0].querySelector('[data-action="dismiss"]').click();
    expect(service.entries.size).toBe(0);
  });

  it('ticks the elapsed clock while a run is active and stops when it ends', () => {
    const service = createService();
    const startedAt = Date.now() - 65000;
    service.upsert(makeTask({ createdAt: new Date(startedAt).toISOString() }));

    expect(document.querySelector('.research-progress-elapsed').textContent).toBe('01:05');
    expect(service._ticker).not.toBeNull();

    vi.advanceTimersByTime(5000);
    expect(document.querySelector('.research-progress-elapsed').textContent).toBe('01:10');

    service.upsert(makeTask({ status: 'completed', createdAt: new Date(startedAt).toISOString() }));
    vi.advanceTimersByTime(1000);
    expect(service._ticker).toBeNull();
  });

  it('formats elapsed time as mm:ss and h:mm:ss', () => {
    const service = createService();
    expect(service._formatElapsed(0)).toBe('00:00');
    expect(service._formatElapsed(9000)).toBe('00:09');
    expect(service._formatElapsed(605000)).toBe('10:05');
    expect(service._formatElapsed(3725000)).toBe('1:02:05');
  });
});

describe('ResearchProgressService - row actions', () => {
  beforeEach(() => {
    mountChatPanel();
  });

  it('scrolls the transcript bubble into view and flashes it', () => {
    const bubble = document.createElement('div');
    bubble.className = 'message assistant-message';
    bubble.scrollIntoView = vi.fn();
    document.getElementById('chatMessages').appendChild(bubble);

    const ensureTaskMessageElement = vi.fn(() => bubble);
    const service = createService({ ensureTaskMessageElement });
    service.upsert(makeTask());

    rows()[0].querySelector('[data-action="locate"]').click();

    expect(ensureTaskMessageElement).toHaveBeenCalledTimes(1);
    expect(bubble.scrollIntoView).toHaveBeenCalled();
    expect(bubble.classList.contains('research-progress-highlight')).toBe(true);
  });

  it('cancels a direct MCP run through cancel-research-run', async () => {
    const executeToolOnServer = vi.fn().mockResolvedValue({ status: 'cancelled' });
    const service = createService({ mcpServerManager: { executeToolOnServer } });
    service.upsert(makeTask());

    vi.stubGlobal('confirm', () => true);
    await service._cancel('task-1');
    vi.unstubAllGlobals();

    expect(executeToolOnServer).toHaveBeenCalledWith('deep-gene-research', 'cancel-research-run', {
      taskId: 'task-1',
    });
  });

  it('cancels a workflow run through the annotation workflow service', async () => {
    const cancelAnnotationResearch = vi.fn().mockResolvedValue({ success: true });
    const service = createService({ services: { annotationWorkflow: { cancelAnnotationResearch } } });
    service.upsert(makeTask({ kind: 'workflow' }));

    vi.stubGlobal('confirm', () => true);
    await service._cancel('task-1');
    vi.unstubAllGlobals();

    expect(cancelAnnotationResearch).toHaveBeenCalledWith({ taskId: 'task-1' });
  });

  it('does nothing when the user declines the cancel confirmation', async () => {
    const executeToolOnServer = vi.fn();
    const service = createService({ mcpServerManager: { executeToolOnServer } });
    service.upsert(makeTask());

    vi.stubGlobal('confirm', () => false);
    await service._cancel('task-1');
    vi.unstubAllGlobals();

    expect(executeToolOnServer).not.toHaveBeenCalled();
    expect(service.entries.get('task-1').status).toBe('in_progress');
  });

  it('restores the running status and surfaces the reason when cancelling fails', async () => {
    const executeToolOnServer = vi.fn().mockRejectedValue(new Error('offline'));
    const service = createService({ mcpServerManager: { executeToolOnServer } });
    service.upsert(makeTask());

    vi.stubGlobal('confirm', () => true);
    await service._cancel('task-1');
    vi.unstubAllGlobals();

    expect(service.entries.get('task-1').status).toBe('in_progress');
    expect(rows()[0].querySelector('.research-progress-error').textContent).toBe('Cancel failed: offline');
  });
});

describe('ChatManager wiring for the progress dock (source contract)', () => {
  const chatManagerSource = fs.readFileSync(path.join(process.cwd(), 'src/renderer/modules/ChatManager.js'), 'utf-8');

  it('registers ResearchProgressService in the service registry', () => {
    expect(chatManagerSource).toContain("['researchProgress', 'ResearchProgressService']");
  });

  it('feeds the dock when polling starts and on every status poll', () => {
    // Once for a brand new task, once for a re-submitted already-tracked task,
    // once per poll, and once on the persistent-error path.
    const upserts = chatManagerSource.match(/services\?\.researchProgress\?\.upsert\(/g) || [];
    expect(upserts.length).toBeGreaterThanOrEqual(4);
  });

  it('re-renders the dock when the chat panel is (re)created', () => {
    expect(chatManagerSource).toContain('services?.researchProgress?.render()');
  });

  it('loads the service script before ChatManager uses it', () => {
    const indexHtml = fs.readFileSync(path.join(process.cwd(), 'src/renderer/index.html'), 'utf-8');
    expect(indexHtml).toContain('modules/chat/services/ResearchProgressService.js');
  });
});

describe('ResearchProgressService - cancel re-entrancy', () => {
  beforeEach(() => {
    mountChatPanel();
  });

  it('ignores a second cancel while the first request is still in flight', async () => {
    let resolveCancel;
    const executeToolOnServer = vi.fn(() => new Promise(resolve => (resolveCancel = resolve)));
    const service = createService({ mcpServerManager: { executeToolOnServer } });
    service.upsert(makeTask());

    vi.stubGlobal('confirm', () => true);
    const first = service._cancel('task-1');
    await service._cancel('task-1');
    vi.unstubAllGlobals();

    expect(executeToolOnServer).toHaveBeenCalledTimes(1);
    expect(rows()[0].querySelector('.research-progress-status').textContent).toBe('Cancelling…');

    resolveCancel({ status: 'cancelled' });
    await first;
  });

  it('clears the in-flight flag once a poll reports the server status', async () => {
    const executeToolOnServer = vi.fn().mockResolvedValue({ status: 'cancel_requested' });
    const service = createService({ mcpServerManager: { executeToolOnServer } });
    service.upsert(makeTask());

    vi.stubGlobal('confirm', () => true);
    await service._cancel('task-1');
    vi.unstubAllGlobals();
    expect(service.entries.get('task-1').cancelling).toBe(true);

    service.upsert(makeTask({ status: 'in_progress', progress: 62 }));
    expect(service.entries.get('task-1').cancelling).toBe(false);
  });
});
