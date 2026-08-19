/**
 * Agent-loop replay harness.
 *
 * Drives the real `ChatManager.sendToLLM()` round loop against a scripted fake
 * provider instead of a live LLM. The loop, the response analyzer, the
 * execution policy, the duplicate filter, the execution-state ledger and the
 * result sanitizer are all the shipped implementations — only the network call,
 * the tool side effects, and the DOM rendering are replaced.
 *
 * This exists so loop behaviour (protocol round-trips, abort, termination,
 * budgets) can be asserted on directly. Previously the only way to cover these
 * paths was to regex methods out of the source file and eval them, which tests
 * how the code is written rather than what it does.
 *
 * Usage:
 *   const harness = createAgentLoopHarness({
 *     responses: [openAiToolCall('jump_to_gene', { geneName: 'lysC' }), 'Done.'],
 *     tools: { jump_to_gene: () => ({ success: true }) },
 *   });
 *   const answer = await harness.send('jump to lysC');
 *   harness.requests[1]; // conversation history the second round received
 */

const ChatManager = require('../../src/renderer/modules/ChatManager.js');
const IntentParserService = require('../../src/renderer/modules/chat/services/IntentParserService.js');
const ToolCapabilityPolicy = require('../../src/renderer/modules/chat/services/ToolCapabilityPolicy.js');
// Loading ToolExecutionPolicy also publishes it on globalThis, which is how
// LLMContextService resolves its policy class at runtime.
require('../../src/renderer/modules/chat/services/ToolExecutionPolicy.js');
const LLMContextService = require('../../src/renderer/modules/chat/services/LLMContextService.js');

/** Minimal dot-path config store with the ConfigManager.get(path, fallback) contract. */
function createConfigManager(overrides = {}) {
  const values = {
    'llm.functionCallRounds': 6,
    'llm.enableEarlyCompletion': true,
    'llm.conversationMemory': 10,
    'multiAgentSettings.multiAgentSystemEnabled': false,
    'chatboxSettings.enableNativeFunctionCalling': true,
    'chatboxSettings.enableConstrainedToolOutput': true,
    ...overrides,
  };
  return {
    values,
    get(path, fallback) {
      return Object.prototype.hasOwnProperty.call(values, path) ? values[path] : fallback;
    },
    set(path, value) {
      values[path] = value;
    },
    getChatHistory() {
      return [];
    },
  };
}

/** OpenAI-shaped assistant message carrying native tool calls. */
function openAiToolCall(name, parameters = {}, options = {}) {
  return openAiToolCalls([{ name, parameters, id: options.id }], options);
}

/** OpenAI-shaped assistant message carrying several native tool calls. */
function openAiToolCalls(calls, options = {}) {
  return {
    role: 'assistant',
    content: options.content ?? null,
    tool_calls: calls.map((call, index) => ({
      id: call.id || `call_${index + 1}`,
      type: 'function',
      function: { name: call.name, arguments: JSON.stringify(call.parameters || {}) },
    })),
    finish_reason: options.finishReason ?? 'tool_calls',
    provider: options.provider || 'openai',
  };
}

/** Anthropic-shaped response carrying a tool_use block. */
function anthropicToolUse(name, parameters = {}, options = {}) {
  return {
    id: options.messageId || 'msg_1',
    type: 'message',
    role: 'assistant',
    provider: 'anthropic',
    stop_reason: options.stopReason ?? 'tool_use',
    content: [
      ...(options.text ? [{ type: 'text', text: options.text }] : []),
      { type: 'tool_use', id: options.id || 'toolu_1', name, input: parameters },
    ],
  };
}

/**
 * @param {object} spec
 * @param {Array<any|((ctx: object) => any)>} [spec.responses] scripted provider responses, one per round
 * @param {Record<string, Function>} [spec.tools] tool name -> implementation
 * @param {Record<string, any>} [spec.config] ConfigManager overrides
 * @param {string[]|null} [spec.advertisedTools] tool names the system prompt advertised
 */
function createAgentLoopHarness(spec = {}) {
  const { responses = [], tools = {}, config = {}, advertisedTools = null, systemPrompt = '[System] test' } = spec;

  const cm = Object.create(ChatManager.prototype);
  const requests = [];
  const toolCalls = [];
  const notifications = [];
  const streamedTokens = [];

  cm.app = {};
  cm.configManager = createConfigManager(config);
  cm.conversationState = {
    isProcessing: false,
    aborted: false,
    currentRequestId: null,
    abortController: null,
    startTime: null,
    processSteps: [],
    currentStep: 0,
  };
  cm.showThinkingProcess = false;
  cm.showToolCalls = false;
  cm.contextModeEnabled = false;
  cm.benchmarkAutomationActive = false;
  cm.smartExecutor = null;
  cm.isSmartExecutionEnabled = false;
  cm.dynamicTools = null;
  cm.currentNativeTools = [];
  cm.lastSystemPromptMetadata = advertisedTools ? { selectedTools: advertisedTools.map(name => ({ name })) } : null;
  cm.chatBoxSettingsManager = { getSetting: (_key, fallback) => fallback };

  // --- UI seams -------------------------------------------------------------
  cm.addThinkingMessage = () => {};
  cm.updateThinkingMessage = () => {};
  cm.beginActivityRound = () => {};
  cm.noteActivityRoundTools = () => {};
  cm.noteActivityRoundOutcome = () => {};
  cm.displayLLMThinking = () => {};
  cm.displayAvailableToolsInThinking = async () => {};
  cm.addMultiAgentActivationMessage = () => {};
  cm.addToolCallMessage = async () => {};
  cm.addToolResultMessage = () => {};
  cm.beginStreamingResponse = () => {};
  cm.endStreamingResponse = () => {};
  cm.resetStreamingResponse = () => {
    streamedTokens.length = 0;
  };
  cm.appendStreamingToken = token => streamedTokens.push(token);
  cm.appendStreamingReasoningToken = () => {};
  cm.showNotification = (message, type) => notifications.push({ message, type });
  cm.closeActivityRound = () => {};
  cm.finalizeCurrentThinkingProcess = () => {};
  cm.updateUIState = () => {};
  cm.removeTypingIndicator = () => {};

  // --- Context / memory seams ----------------------------------------------
  cm.getCurrentContext = () => ({});
  cm.getCurrentContextForDynamicTools = () => ({});
  cm.getMemoryContext = async () => null;
  cm.buildSystemMessage = async () => systemPrompt;
  cm.startDgrTaskPollingFromResults = () => {};

  // --- Services -------------------------------------------------------------
  // The intent parser, the execution policy and the completion heuristic are the
  // shipped implementations: they are the parts of the loop worth covering.
  void ToolCapabilityPolicy;
  cm.services = {
    intent: new IntentParserService(cm.app, cm),
    context: new LLMContextService(cm.app, cm),
  };

  // --- Tool execution seam --------------------------------------------------
  cm.executeToolByName = async (toolName, parameters) => {
    toolCalls.push({ tool_name: toolName, parameters });
    const impl = tools[toolName];
    if (!impl) throw new Error(`No fake implementation for tool '${toolName}'`);
    return await impl(parameters, { round: requests.length });
  };

  // --- Scripted provider ----------------------------------------------------
  const queue = [...responses];
  cm.llmConfigManager = {
    isConfigured: () => true,
    sendMessageWithHistory: async (conversationHistory, _context, _memory, options = {}) => {
      // Keep both: a snapshot per round, and the live array the loop keeps
      // appending to, so a turn that ends after one round can still be
      // inspected for what it wrote back.
      requests.push(JSON.parse(JSON.stringify(conversationHistory)));
      liveHistory = conversationHistory;
      lastOptions = options;
      if (options.signal?.aborted) {
        throw Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
      }
      const next = queue.length > 0 ? queue.shift() : 'No further scripted response.';
      const resolved = typeof next === 'function' ? await next({ conversationHistory, options, harness }) : next;
      if (resolved instanceof Error) throw resolved;
      return resolved;
    },
  };

  let lastOptions = null;
  let liveHistory = null;

  const harness = {
    chatManager: cm,
    /** Conversation history array as received by the provider, per round. */
    requests,
    /** Every tool the loop actually dispatched, in order. */
    toolCalls,
    notifications,
    streamedTokens,
    get lastRequest() {
      return requests[requests.length - 1];
    },
    /** The final conversation history, including what the last round appended. */
    get history() {
      return liveHistory || [];
    },
    get lastOptions() {
      return lastOptions;
    },
    get rounds() {
      return requests.length;
    },
    /** Push more scripted responses mid-test. */
    enqueue(...items) {
      queue.push(...items);
      return harness;
    },
    abort() {
      cm.abortCurrentConversation();
    },
    send(message, options = {}) {
      cm.startConversation();
      return cm.sendToLLM(message, options).finally(() => cm.endConversation());
    },
    /** Send without the start/end lifecycle, for tests that drive it themselves. */
    sendRaw(message, options = {}) {
      return cm.sendToLLM(message, options);
    },
  };

  return harness;
}

module.exports = {
  createAgentLoopHarness,
  createConfigManager,
  openAiToolCall,
  openAiToolCalls,
  anthropicToolUse,
};
