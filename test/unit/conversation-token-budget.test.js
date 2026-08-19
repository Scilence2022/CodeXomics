/**
 * `sanitizeResultForLLM` bounds one tool result to 50KB, but nothing bounded
 * their sum: a long agentic turn could append twenty of them and overflow the
 * provider's context window. The overflow surfaced as a generic
 * "Unexpected Error" with the real reason inside a provider response body.
 *
 * Trimming has to stay protocol-safe. An assistant `tool_calls` entry whose
 * `tool` message was dropped is rejected outright by OpenAI-compatible
 * providers, so the budget may never split that pair.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ChatManager = require('../../src/renderer/modules/ChatManager.js');
const { createAgentLoopHarness, openAiToolCall } = require('../helpers/agent-loop-harness.js');

function createManager(maxContextTokens) {
  const cm = Object.create(ChatManager.prototype);
  cm.configManager = { get: (path, fallback) => (path === 'llm.maxContextTokens' ? maxContextTokens : fallback) };
  return cm;
}

const toolRound = (id, resultSize) => [
  {
    role: 'assistant',
    content: null,
    tool_calls: [{ id, type: 'function', function: { name: 'search_features', arguments: '{}' } }],
  },
  { role: 'tool', tool_call_id: id, name: 'search_features', content: 'x'.repeat(resultSize) },
];

describe('conversation token budget', () => {
  it('leaves a transcript inside the budget untouched', () => {
    const manager = createManager(100000);
    const history = [
      { role: 'system', content: 'system' },
      { role: 'user', content: 'find things' },
      ...toolRound('call_1', 100),
    ];
    const before = JSON.parse(JSON.stringify(history));

    expect(manager.enforceConversationTokenBudget(history, { originalMessage: 'find things' })).toBeNull();
    expect(history).toEqual(before);
  });

  it('compacts old tool results before dropping anything', () => {
    const manager = createManager(4000);
    const history = [
      { role: 'system', content: 'system' },
      { role: 'user', content: 'find things' },
      ...toolRound('call_1', 40000),
      ...toolRound('call_2', 40000),
      ...toolRound('call_3', 200),
    ];

    const report = manager.enforceConversationTokenBudget(history, { originalMessage: 'find things' });

    expect(report).not.toBeNull();
    expect(report.compactedResults).toBeGreaterThan(0);
    expect(report.after).toBeLessThan(report.before);
    // Compaction keeps the message, so the pairing survives.
    expect(history.filter(message => message.role === 'tool')).toHaveLength(3);
    expect(history.find(message => message.tool_call_id === 'call_1').content).toContain('Result omitted');
  });

  it('never leaves a tool_call without its tool message', () => {
    const manager = createManager(4000);
    const history = [
      { role: 'system', content: 'system' },
      { role: 'user', content: 'find things' },
      ...toolRound('call_1', 200000),
      ...toolRound('call_2', 200000),
      ...toolRound('call_3', 200000),
      ...toolRound('call_4', 200000),
      { role: 'user', content: 'and now summarise' },
    ];

    manager.enforceConversationTokenBudget(history, { originalMessage: 'find things' });

    const callIds = history.flatMap(message => (message.tool_calls || []).map(call => call.id));
    const resultIds = history.filter(message => message.role === 'tool').map(message => message.tool_call_id);
    expect(new Set(resultIds)).toEqual(new Set(callIds));
  });

  it('protects the system message and the request being worked on', () => {
    const manager = createManager(4000);
    const history = [
      { role: 'system', content: 'system prompt that must survive' },
      { role: 'user', content: 'the original request' },
      ...toolRound('call_1', 200000),
      ...toolRound('call_2', 200000),
      ...toolRound('call_3', 200000),
    ];

    manager.enforceConversationTokenBudget(history, { originalMessage: 'the original request' });

    expect(history[0].content).toBe('system prompt that must survive');
    expect(history.some(message => message.content === 'the original request')).toBe(true);
  });

  it('reports nothing when every oversized message is still needed', () => {
    const manager = createManager(4000);
    const history = [
      { role: 'system', content: 'system' },
      { role: 'user', content: 'req' },
      ...toolRound('only', 500000),
    ];

    expect(manager.enforceConversationTokenBudget(history, { originalMessage: 'req' })).toBeNull();
    expect(history).toHaveLength(4);
  });

  it('keeps the most recent exchange intact', () => {
    const manager = createManager(4000);
    const history = [
      { role: 'system', content: 'system' },
      { role: 'user', content: 'req' },
      ...toolRound('old', 200000),
      ...toolRound('recent', 300),
    ];

    manager.enforceConversationTokenBudget(history, { originalMessage: 'req' });

    const recent = history.find(message => message.tool_call_id === 'recent');
    expect(recent.content).toBe('x'.repeat(300));
  });

  it('is disabled by a non-positive configured budget', () => {
    const manager = createManager(0);
    const history = [{ role: 'system', content: 'system' }, ...toolRound('call_1', 500000)];

    expect(manager.enforceConversationTokenBudget(history, {})).toBeNull();
    expect(manager.getConversationTokenBudget()).toBe(0);
  });

  it('floors an unusably small configured budget', () => {
    expect(createManager(10).getConversationTokenBudget()).toBe(4000);
    expect(createManager('nonsense').getConversationTokenBudget()).toBe(120000);
  });

  it('bounds a real multi-round turn instead of growing without limit', async () => {
    const bigResult = { rows: Array.from({ length: 4000 }, (_, index) => `row-${index}`) };
    const harness = createAgentLoopHarness({
      config: { 'llm.functionCallRounds': 6, 'llm.maxContextTokens': 6000 },
      responses: [
        openAiToolCall('search_features', { query: 'a' }, { id: 'c1' }),
        openAiToolCall('search_features', { query: 'b' }, { id: 'c2' }),
        openAiToolCall('search_features', { query: 'c' }, { id: 'c3' }),
        'Here is the summary.',
      ],
      tools: { search_features: () => ({ success: true, ...bigResult }) },
    });

    await harness.send('search for a, then b, then c, then summarise');

    const manager = harness.chatManager;
    const finalTokens = manager.estimateConversationTokens(harness.lastRequest);
    expect(finalTokens).toBeLessThanOrEqual(6000);

    // Still a valid exchange after trimming.
    const callIds = harness.lastRequest.flatMap(message => (message.tool_calls || []).map(call => call.id));
    const resultIds = harness.lastRequest
      .filter(message => message.role === 'tool')
      .map(message => message.tool_call_id);
    expect(new Set(resultIds)).toEqual(new Set(callIds));
  });
});
