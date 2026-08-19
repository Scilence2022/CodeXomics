/**
 * Deep Gene Research async task handling tests
 *
 * The DGR MCP server answers deep-gene-research immediately with a queued task
 * descriptor (taskId, status: 'pending') and runs the research asynchronously
 * (~10 min). These tests pin the ChatBox-side contract: polling-friendly tool
 * policies, URL-mode submission defaults, server-URL resolution, queued-task
 * detection, and the ChatManager wiring that keeps the chat bubble updated.
 */
/* eslint-disable no-new-func */
import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const MCPServerManager = require('../../src/renderer/modules/MCPServerManager.js');

function evaluateRendererGlobal(relativePath, globalName) {
  const filePath = path.join(process.cwd(), relativePath);
  const content = fs.readFileSync(filePath, 'utf-8');
  const fn = new Function(`${content}; return globalThis.${globalName};`);
  return fn();
}

function loadPolicyClasses() {
  const ToolCapabilityPolicy = evaluateRendererGlobal(
    'src/renderer/modules/chat/services/ToolCapabilityPolicy.js',
    'ToolCapabilityPolicy'
  );
  const ToolExecutionPolicy = evaluateRendererGlobal(
    'src/renderer/modules/chat/services/ToolExecutionPolicy.js',
    'ToolExecutionPolicy'
  );
  return { ToolCapabilityPolicy, ToolExecutionPolicy };
}

function createPolicyChatManager(overrides = {}) {
  return {
    configManager: {
      get: (key, fallback) => {
        if (key === 'chatboxSettings') return {};
        return fallback;
      },
    },
    getToolExecutionKey: (toolName, parameters) => `${toolName}:${JSON.stringify(parameters)}`,
    getToolExecutionCount: () => 0,
    getToolExecutionCountByName: () => 0,
    wasToolExecutedSuccessfully: () => false,
    findExistingExecution: () => null,
    ...overrides,
  };
}

function createManager() {
  return new MCPServerManager({
    get: (_key, fallback) => fallback,
    set: vi.fn(),
  });
}

/**
 * Extract a single method from ChatManager (browser script) into a testable
 * mock class, following the tool-policy-robustness.test.js pattern.
 */
function loadChatManagerMethod(methodSignature, nextMemberAnchor) {
  const content = fs.readFileSync(path.join(process.cwd(), 'src/renderer/modules/ChatManager.js'), 'utf-8');
  const match = content.match(
    new RegExp(`\\n\\s{2}${methodSignature}\\s*\\{[\\s\\S]*?\\n\\s{2}\\}\\n\\n\\s{2}${nextMemberAnchor}`)
  );
  if (!match) throw new Error(`Could not extract ChatManager method: ${methodSignature}`);
  const methodCode = match[0].replace(new RegExp(`\\n\\n\\s{2}${nextMemberAnchor}$`), '');
  const fn = new Function(`return class MockChatManager { ${methodCode} };`);
  return fn();
}

describe('Deep Gene Research tool execution policy', () => {
  it('classifies polling tools as research_task_polling / always_allowed', () => {
    const { ToolCapabilityPolicy } = loadPolicyClasses();
    const capabilityPolicy = new ToolCapabilityPolicy();

    expect(capabilityPolicy.getPolicyForTool('get-task-status')).toEqual({
      name: 'research_task_polling',
      policy: expect.objectContaining({ policy: 'always_allowed' }),
    });
    expect(capabilityPolicy.getPolicyForTool('cancel-research-run')).toEqual({
      name: 'research_task_polling',
      policy: expect.objectContaining({ policy: 'always_allowed' }),
    });
    // The annotation-workflow status poll must also be repeatable: it is a
    // read + idempotent finalization, and the ChatBox polls it programmatically.
    expect(capabilityPolicy.getPolicyForTool('get_annotation_research_workflow')).toEqual({
      name: 'research_task_polling',
      policy: expect.objectContaining({ policy: 'always_allowed' }),
    });
  });

  it('allows repeated identical get-task-status calls (exempt from global caps)', () => {
    const { ToolExecutionPolicy } = loadPolicyClasses();
    const policy = new ToolExecutionPolicy({
      chatManager: createPolicyChatManager({
        // Simulate a task that has already been polled many times
        getToolExecutionCount: () => 99,
        getToolExecutionCountByName: () => 99,
        wasToolExecutedSuccessfully: () => true,
      }),
    });
    const call = { tool_name: 'get-task-status', parameters: { taskId: 'dgr-task-1' } };
    expect(policy.shouldAllowToolExecution(call, [])).toBe(true);
  });

  it('classifies deep-gene-research as research_task_submission / parameter_based', () => {
    const { ToolCapabilityPolicy } = loadPolicyClasses();
    const capabilityPolicy = new ToolCapabilityPolicy();

    expect(capabilityPolicy.getPolicyForTool('deep-gene-research')).toEqual({
      name: 'research_task_submission',
      policy: expect.objectContaining({ policy: 'parameter_based' }),
    });
  });

  it('blocks resubmitting deep-gene-research with identical parameters after success', () => {
    const { ToolExecutionPolicy } = loadPolicyClasses();
    const policy = new ToolExecutionPolicy({
      chatManager: createPolicyChatManager({
        findExistingExecution: () => ({ success: true }),
      }),
    });
    const call = { tool_name: 'deep-gene-research', parameters: { geneSymbol: 'sbmC', organism: 'E. coli' } };
    expect(policy.shouldAllowToolExecution(call, [])).toBe(false);
  });

  it('allows a deep-gene-research submission with new parameters', () => {
    const { ToolExecutionPolicy } = loadPolicyClasses();
    const policy = new ToolExecutionPolicy({ chatManager: createPolicyChatManager() });
    const call = { tool_name: 'deep-gene-research', parameters: { geneSymbol: 'ygeK', organism: 'E. coli' } };
    expect(policy.shouldAllowToolExecution(call, [])).toBe(true);
  });
});

describe('MCPServerManager DGR submission defaults', () => {
  function captureProxyCall(manager, payload = { taskId: 't1', status: 'pending' }) {
    const calls = [];
    manager._requestDgrProxy = vi.fn(async body => {
      calls.push(body);
      return { result: { content: [{ type: 'text', text: JSON.stringify(payload) }] } };
    });
    return calls;
  }

  it('defaults returnReportAsUrl/returnDetailsAsUrl on for deep-gene-research', async () => {
    const manager = createManager();
    const calls = captureProxyCall(manager);

    const result = await manager._executeDgrProxyTool('deep-gene-research', {
      geneSymbol: 'sbmC',
      organism: 'Escherichia coli',
    });

    expect(result).toEqual({ taskId: 't1', status: 'pending' });
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('tools/call');
    expect(calls[0].params.name).toBe('deep-gene-research');
    expect(calls[0].params.arguments.returnReportAsUrl).toBe(true);
    expect(calls[0].params.arguments.returnDetailsAsUrl).toBe(true);
    expect(calls[0].params.arguments.geneSymbol).toBe('sbmC');
  });

  it('respects explicit URL-mode flags from the caller', async () => {
    const manager = createManager();
    const calls = captureProxyCall(manager);

    await manager._executeDgrProxyTool('deep-gene-research', {
      geneSymbol: 'sbmC',
      organism: 'Escherichia coli',
      returnReportAsUrl: false,
    });

    expect(calls[0].params.arguments.returnReportAsUrl).toBe(false);
    expect(calls[0].params.arguments.returnDetailsAsUrl).toBe(true);
  });

  it('does not add URL-mode flags to other DGR tools', async () => {
    const manager = createManager();
    const calls = captureProxyCall(manager, { taskId: 't1', status: 'in_progress', progress: 40 });

    await manager._executeDgrProxyTool('get-task-status', { taskId: 't1' });

    expect(calls[0].params.arguments).toEqual({ taskId: 't1' });
  });
});

describe('MCPServerManager.resolveServerUrl', () => {
  it('resolves relative URLs against the configured server origin', () => {
    const manager = createManager();
    manager.servers.set('deep-gene-research', { url: 'http://localhost:3000/api/mcp' });

    expect(manager.resolveServerUrl('deep-gene-research', '/api/mcp/download/abc123/report')).toBe(
      'http://localhost:3000/api/mcp/download/abc123/report'
    );
  });

  it('passes absolute URLs through unchanged', () => {
    const manager = createManager();
    manager.servers.set('deep-gene-research', { url: 'http://localhost:3000/api/mcp' });

    expect(manager.resolveServerUrl('deep-gene-research', 'https://dgr.example.com/api/mcp/download/x/report')).toBe(
      'https://dgr.example.com/api/mcp/download/x/report'
    );
  });

  it('returns an empty string for empty input', () => {
    const manager = createManager();
    expect(manager.resolveServerUrl('deep-gene-research', '')).toBe('');
  });
});

describe('ChatManager.extractDgrTaskDescriptor', () => {
  const MockChatManager = loadChatManagerMethod(
    'extractDgrTaskDescriptor\\s*\\(resultData,\\s*toolParameters\\s*=\\s*\\{\\}\\)',
    '\\/\\*\\*'
  );
  const manager = new MockChatManager();

  it('detects a queued task descriptor and takes the gene symbol from tool parameters', () => {
    const descriptor = manager.extractDgrTaskDescriptor(
      {
        taskId: '38ed5077-346e-437c-a9c1-7a790e71488f',
        status: 'pending',
        message: 'Research task has been queued.',
        taskUrl: '/api/mcp/tasks/38ed5077',
        progressUrl: '/api/mcp/tasks/38ed5077/progress',
      },
      { geneSymbol: 'sbmC', organism: 'Escherichia coli' }
    );

    expect(descriptor).not.toBeNull();
    expect(descriptor.taskId).toBe('38ed5077-346e-437c-a9c1-7a790e71488f');
    expect(descriptor.status).toBe('pending');
    expect(descriptor.geneSymbol).toBe('sbmC');
    expect(descriptor.taskUrl).toBe('/api/mcp/tasks/38ed5077');
  });

  it('detects an in_progress get-task-status envelope', () => {
    const descriptor = manager.extractDgrTaskDescriptor(
      { taskId: 't1', status: 'in_progress', progress: 62, step: 'gene-llm-queries' },
      {}
    );
    expect(descriptor).not.toBeNull();
    expect(descriptor.status).toBe('in_progress');
  });

  it('returns null for envelopes that already carry the final payload', () => {
    expect(
      manager.extractDgrTaskDescriptor({ taskId: 't1', status: 'completed', result: { finalReport: '# R' } }, {})
    ).toBeNull();
    expect(manager.extractDgrTaskDescriptor({ taskId: 't1', status: 'completed', finalReport: '# R' }, {})).toBeNull();
  });

  it('treats terminal envelopes without a result payload as descriptors (cache-hit/idempotent resubmit)', () => {
    // deep-gene-research can return an already-completed task envelope with no
    // inline result; the client must still fetch the final results instead of
    // rendering the envelope as a report.
    const descriptor = manager.extractDgrTaskDescriptor({ taskId: 't1', status: 'completed' }, {});
    expect(descriptor).not.toBeNull();
    expect(descriptor.status).toBe('completed');
    expect(manager.extractDgrTaskDescriptor({ taskId: 't1', status: 'failed', error: 'x' }, {})).not.toBeNull();
    expect(manager.extractDgrTaskDescriptor({ taskId: 't1', status: 'cancelled' }, {})).not.toBeNull();
  });

  it('detects an annotation-workflow envelope (start_annotation_research / get_annotation_research_workflow)', () => {
    const descriptor = manager.extractDgrTaskDescriptor(
      {
        success: true,
        workflow: {
          taskId: 'e2a42c2e-a583-40fb-a7c0-3d49f2584493',
          status: 'in_progress',
          progress: 70,
          step: 'gene-search',
          geneSymbol: 'xapA',
        },
        result: null,
      },
      {}
    );

    expect(descriptor).not.toBeNull();
    expect(descriptor.kind).toBe('workflow');
    expect(descriptor.taskId).toBe('e2a42c2e-a583-40fb-a7c0-3d49f2584493');
    expect(descriptor.geneSymbol).toBe('xapA');
    expect(descriptor.progress).toBe(70);
    expect(descriptor.currentStep).toBe('gene-search');
  });

  it('returns null for a completed workflow poll carrying its result payload', () => {
    expect(
      manager.extractDgrTaskDescriptor(
        {
          success: true,
          workflow: { taskId: 't1', status: 'completed' },
          result: { annotationProposal: {}, download: {} },
        },
        {}
      )
    ).toBeNull();
  });

  it('marks direct MCP envelopes as kind mcp', () => {
    const descriptor = manager.extractDgrTaskDescriptor({ taskId: 't1', status: 'pending' }, {});
    expect(descriptor.kind).toBe('mcp');
  });

  it('returns null for non-task results', () => {
    expect(manager.extractDgrTaskDescriptor({ report: '# Final report' }, {})).toBeNull();
    expect(manager.extractDgrTaskDescriptor('a plain string', {})).toBeNull();
    expect(manager.extractDgrTaskDescriptor(null, {})).toBeNull();
  });
});

describe('ChatManager DGR async wiring (source contract)', () => {
  const chatManagerSource = fs.readFileSync(path.join(process.cwd(), 'src/renderer/modules/ChatManager.js'), 'utf-8');
  const llmContextSource = fs.readFileSync(
    path.join(process.cwd(), 'src/renderer/modules/chat/services/LLMContextService.js'),
    'utf-8'
  );

  it('starts programmatic polling from executed tool results', () => {
    expect(chatManagerSource).toContain('startDgrTaskPollingFromResults(successfulResults)');
  });

  it('locates chat bubbles with the real .message structure, not the defunct .chat-message class', () => {
    expect(chatManagerSource).toContain("querySelectorAll('#chatMessages .message')");
    expect(chatManagerSource).not.toContain("querySelectorAll('.chat-message')");
  });

  it('creates a dedicated task status bubble instead of relying on the LLM answer text', () => {
    expect(chatManagerSource).toContain('createTaskStatusBubble(taskInfo)');
    expect(chatManagerSource).toContain('ensureTaskMessageElement(taskInfo)');
    expect(chatManagerSource).toContain('lastElementChild');
  });

  it('renders task updates through formatMessage (renderMarkdown does not exist)', () => {
    expect(chatManagerSource).not.toContain('renderMarkdown');
    expect(chatManagerSource).toContain('this.formatMessage(updatedContent)');
  });

  it('keeps polling idempotent per taskId', () => {
    expect(chatManagerSource).toContain('const existing = this.activeTasks.get(taskInfo.taskId);');
  });

  it('tells the LLM not to poll research tasks itself after a queued submission', () => {
    expect(chatManagerSource).toContain(
      'Do NOT poll the task yourself (get-task-status, get_annotation_research_workflow)'
    );
  });

  it('polls workflow-kind tasks through the annotation workflow service', () => {
    expect(chatManagerSource).toContain("taskInfo.kind === 'workflow'");
    expect(chatManagerSource).toContain('checkWorkflowTaskStatus');
    expect(chatManagerSource).toContain('getAnnotationResearchWorkflow({ taskId: taskInfo.taskId })');
  });

  it('resolves download URLs and persists the outcome message on completion', () => {
    expect(chatManagerSource).toContain('resolveServerUrl(taskInfo.serverId');
    expect(chatManagerSource).toContain('persistTaskOutcomeMessage(content)');
    expect(chatManagerSource).toContain('archiveDgrTaskResult');
  });

  it('renders a task-started card instead of saving the queued descriptor as a report', () => {
    expect(llmContextSource).toContain('Deep Gene Research Started');
    expect(llmContextSource).toContain('extractDgrTaskDescriptor(resultData, result.parameters)');
  });
});
