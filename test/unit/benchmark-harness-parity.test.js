/**
 * The in-app benchmark harness must run a test through the same ChatBox
 * pipeline a user message takes. These tests pin the places where it used to
 * diverge:
 *
 * - sendToLLM() ran outside startConversation(), so the conversation was never
 *   "processing": a timed-out test could not be aborted, a sticky abort left by
 *   an earlier chat failed every test, and a user could start a second loop on
 *   top of the running test.
 * - The test oracle ended the round loop, and temperature / streaming / tool
 *   limit / Smart Executor / agent routing were forced, even though the
 *   in-app numbers were documented as reflecting shipped behaviour. Those are
 *   now the explicit `oracle-assisted` mode; the default is production parity.
 * - Smart Executor (on by default in ChatBox) dropped tool_call_id, so a round
 *   of native calls fell back to the prose transcript in production but not in
 *   the benchmark.
 */
import { describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ChatManager = require('../../src/renderer/modules/ChatManager.js');
const SmartExecutor = require('../../src/renderer/modules/SmartExecutor.js');

function loadFrameworkClass() {
  const source = fs.readFileSync(path.join(process.cwd(), 'src/renderer/modules/LLMBenchmarkFramework.js'), 'utf8');
  // eslint-disable-next-line no-new-func -- loads the real renderer class without its global side effects
  return new Function('window', `${source}\nreturn LLMBenchmarkFramework;`)({});
}

const LLMBenchmarkFramework = loadFrameworkClass();

function makeChatManager({ settings = {} } = {}) {
  const cm = Object.create(ChatManager.prototype);
  cm.conversationState = {
    isProcessing: false,
    aborted: false,
    currentRequestId: null,
    abortController: null,
    startTime: null,
    processSteps: [],
    currentStep: 0,
  };
  cm.configManager = { get: (key, fallback) => (key in settings ? settings[key] : fallback) };
  cm.updateUIState = vi.fn();
  cm.finalizeCurrentThinkingProcess = vi.fn();
  return cm;
}

function makeFramework(chatManager) {
  const framework = Object.create(LLMBenchmarkFramework.prototype);
  framework.chatManager = chatManager;
  framework.harnessProfile = null;
  return framework;
}

describe('harness profile resolution', () => {
  const framework = makeFramework(null);

  it('defaults to production parity', () => {
    const profile = framework.resolveHarnessProfile({});
    expect(profile.harness_mode).toBe('production-parity');
    expect(profile.oracleEarlyStop).toBe(false);
    expect(profile.temperature).toBeNull();
    expect(profile.disableStreaming).toBe(false);
    expect(profile.toolSelectionLimit).toBeNull();
    expect(profile.forceAgentSystemOff).toBe(false);
    expect(profile.forceSmartExecutionOff).toBe(false);
  });

  it('keeps the legacy controlled configuration as oracle-assisted', () => {
    const profile = framework.resolveHarnessProfile({ harnessMode: 'oracle-assisted' });
    expect(profile).toMatchObject({
      harness_mode: 'oracle-assisted',
      oracleEarlyStop: true,
      temperature: 0,
      disableStreaming: true,
      toolSelectionLimit: 24,
      forceAgentSystemOff: true,
      forceSmartExecutionOff: true,
    });
    expect(framework.resolveHarnessProfile({ productionParity: false }).harness_mode).toBe('oracle-assisted');
  });

  it('refuses an unknown mode instead of mislabelling the run', () => {
    expect(() => framework.resolveHarnessProfile({ harnessMode: 'fast' })).toThrow(/Unknown benchmark harness mode/);
  });

  it('gives a test run outside runAllBenchmarks() production parity', () => {
    expect(framework.getActiveHarnessProfile().harness_mode).toBe('production-parity');
  });
});

describe('request overrides', () => {
  it('changes nothing outside a benchmark run', () => {
    const cm = makeChatManager();
    expect(cm.getBenchmarkRequestOverrides()).toEqual({});
  });

  it('only disables provider fallback in a production-parity run', () => {
    const cm = makeChatManager();
    cm.benchmarkAutomationActive = true;
    cm.benchmarkHarnessProfile = makeFramework(null).resolveHarnessProfile({});
    expect(cm.getBenchmarkRequestOverrides()).toEqual({ disableFallback: true });
  });

  it('pins temperature and turns streaming off only when oracle-assisted', () => {
    const cm = makeChatManager();
    cm.benchmarkAutomationActive = true;
    cm.benchmarkHarnessProfile = makeFramework(null).resolveHarnessProfile({ harnessMode: 'oracle-assisted' });
    expect(cm.getBenchmarkRequestOverrides()).toEqual({
      disableFallback: true,
      temperatureOverride: 0,
      disableStreaming: true,
    });
  });

  it('records the temperature the request is really sent with', () => {
    const cm = makeChatManager();
    cm.llmConfigManager = { getTemperature: () => 0.3 };
    const framework = makeFramework(cm);
    expect(framework.getEffectiveRequestTemperature({ temperature: 0.7 })).toBe(0.3);

    framework.harnessProfile = framework.resolveHarnessProfile({ harnessMode: 'oracle-assisted' });
    expect(framework.getEffectiveRequestTemperature({ temperature: 0.7 })).toBe(0);
  });
});

describe('tool selection limit', () => {
  it('follows the ChatBox setting in a production-parity run', () => {
    const cm = makeChatManager({ settings: { 'chatboxSettings.limitDynamicToolsSelection': false } });
    cm.benchmarkAutomationActive = true;
    cm.benchmarkHarnessProfile = makeFramework(null).resolveHarnessProfile({});
    expect(cm.getDynamicToolsSelectionLimit()).toBe(Infinity);
  });

  it('pins 24 tools when oracle-assisted', () => {
    const cm = makeChatManager({ settings: { 'chatboxSettings.limitDynamicToolsSelection': false } });
    cm.benchmarkAutomationActive = true;
    cm.benchmarkHarnessProfile = makeFramework(null).resolveHarnessProfile({ harnessMode: 'oracle-assisted' });
    expect(cm.getDynamicToolsSelectionLimit()).toBe(24);
  });
});

describe('benchmark mode detection', () => {
  it('is tied to a run, not to the benchmark panel being visible', () => {
    const panel = document.createElement('div');
    panel.id = 'benchmarkInterface';
    panel.style.display = 'block';
    document.body.appendChild(panel);
    try {
      const cm = makeChatManager();
      expect(cm.isBenchmarkMode()).toBe(false);
      cm.benchmarkAutomationActive = true;
      expect(cm.isBenchmarkMode()).toBe(true);
    } finally {
      panel.remove();
    }
  });
});

describe('each test runs inside a ChatBox conversation', () => {
  it('marks the conversation as processing and clears a sticky abort', () => {
    const cm = makeChatManager();
    cm.conversationState.aborted = true; // left behind by an earlier aborted chat
    const framework = makeFramework(cm);

    const handle = framework.beginBenchmarkConversation('auto_01');

    expect(cm.conversationState.isProcessing).toBe(true);
    expect(cm.conversationState.aborted).toBe(false);
    expect(handle.requestId).toBe(cm.conversationState.currentRequestId);

    framework.endBenchmarkConversation(handle);
    expect(cm.conversationState.isProcessing).toBe(false);
  });

  it('refuses to start a test on top of a running conversation', () => {
    const cm = makeChatManager();
    cm.conversationState.isProcessing = true;
    expect(() => makeFramework(cm).beginBenchmarkConversation('auto_02')).toThrow(/busy/);
  });

  it('lets the timeout path abort the test it is racing', () => {
    const cm = makeChatManager();
    cm.showNotification = vi.fn();
    cm.removeTypingIndicator = vi.fn();
    const framework = makeFramework(cm);
    framework.beginBenchmarkConversation('auto_03');
    const controller = new AbortController();
    cm.conversationState.abortController = controller;

    framework.abortTimedOutConversation({ id: 'auto_03' }, new Error('Test timeout after 1000ms'));

    expect(controller.signal.aborted).toBe(true);
    expect(cm.conversationState.isProcessing).toBe(false);
  });

  it('does not let an abandoned test end the next test’s conversation', () => {
    const cm = makeChatManager();
    const framework = makeFramework(cm);
    const timedOut = framework.beginBenchmarkConversation('auto_04');
    cm.endConversation(); // abortCurrentConversation() ends it on the spot
    const next = framework.beginBenchmarkConversation('auto_05');

    framework.endBenchmarkConversation(timedOut); // the abandoned promise unwinds late

    expect(cm.conversationState.isProcessing).toBe(true);
    expect(cm.conversationState.currentRequestId).toBe(next.requestId);
  });

  it('only runs the oracle early stop when oracle-assisted', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/renderer/modules/LLMBenchmarkFramework.js'), 'utf8');
    expect(source).toContain('harnessProfile.oracleEarlyStop ? { shouldStopAfterRound } : {}');
  });
});

describe('conversation lifecycle', () => {
  it('endConversation(expectedRequestId) leaves a newer request alone', () => {
    const cm = makeChatManager();
    cm.startConversation();
    const first = cm.conversationState.currentRequestId;
    cm.endConversation();
    cm.startConversation();
    const second = cm.conversationState.currentRequestId;

    cm.endConversation(first);

    expect(first).not.toBe(second);
    expect(cm.conversationState.isProcessing).toBe(true);
    expect(cm.conversationState.currentRequestId).toBe(second);
  });

  it('an unwinding request still sees its own abort after the state was reset', () => {
    const cm = makeChatManager();
    const cancelled = new AbortController();
    cancelled.abort();
    cm.startConversation(); // the next request resets the sticky flag

    expect(() => cm.throwIfConversationAborted()).not.toThrow();
    expect(() => cm.throwIfConversationAborted(cancelled)).toThrow(/aborted/i);
  });
});

describe('Smart Executor execution records', () => {
  function makeExecutor(planOrder) {
    const executor = Object.create(SmartExecutor.prototype);
    executor.chatManager = {
      executeToolByName: vi.fn(async name => ({ success: true, name })),
      isAbortError: error => error?.name === 'AbortError',
      throwIfConversationAborted: ChatManager.prototype.throwIfConversationAborted,
      isConversationAborted: () => false,
      createAbortError: ChatManager.prototype.createAbortError,
    };
    executor.app = {};
    executor.executionMetrics = { totalExecutions: 0, averageTime: 0, successRate: 0, categoryPerformance: new Map() };
    executor.organizer = {
      getFunctionCategory: () => null,
      optimizeExecution: async () => ({
        strategy: {
          executionPlan: planOrder.map((name, index) => ({
            priority: index + 1,
            phase: `phase ${index}`,
            tools: [{ tool: name }],
            parallelizable: false,
          })),
        },
      }),
    };
    executor.generateExecutionReport = () => null;
    return executor;
  }

  it('keeps tool_call_id and reports results in call order', async () => {
    const executor = makeExecutor(['navigate_to_position', 'search_gene_by_name']);
    const calls = [
      { tool_name: 'search_gene_by_name', parameters: { name: 'lacZ' }, tool_call_id: 'call_1' },
      { tool_name: 'navigate_to_position', parameters: { position: 10 }, tool_call_id: 'call_2' },
    ];

    const outcome = await executor.smartExecute('find lacZ', calls);

    expect(outcome.success).toBe(true);
    expect(outcome.results.map(r => r.tool_call_id)).toEqual(['call_1', 'call_2']);
    expect(outcome.results.map(r => r.tool_name)).toEqual(['search_gene_by_name', 'navigate_to_position']);
    expect(outcome.results.every(r => Number.isFinite(r.executionTime))).toBe(true);
    expect(outcome.results.some(r => 'request' in r)).toBe(false);
  });

  it('stops between tools once the request is cancelled', async () => {
    const executor = makeExecutor(['search_gene_by_name', 'navigate_to_position']);
    const controller = new AbortController();
    executor.chatManager.executeToolByName = vi.fn(async () => {
      controller.abort();
      return { success: true };
    });
    const calls = [
      { tool_name: 'search_gene_by_name', parameters: {}, tool_call_id: 'call_1' },
      { tool_name: 'navigate_to_position', parameters: {}, tool_call_id: 'call_2' },
    ];

    await expect(executor.smartExecute('x', calls, { abortController: controller })).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(executor.chatManager.executeToolByName).toHaveBeenCalledTimes(1);
  });
});
