/**
 * Reasoning state across a tool loop. A provider that thought before calling a
 * tool needs that thinking back on the next round of the same turn: Anthropic
 * verifies signed thinking blocks, Gemini 3 validates thought signatures on
 * function calls, and DeepSeek's thinking mode wants reasoning_content back.
 * The canonical transcript carries it on the assistant tool-call message, out of
 * band, and each provider adapter restores it in its own shape.
 */
import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const LLMConfigManager = require('../../src/renderer/modules/LLMConfigManager.js');
const { createAgentLoopHarness, openAiToolCall } = require('../helpers/agent-loop-harness.js');
const ConversationTranscriptService = require('../../src/renderer/modules/chat/services/ConversationTranscriptService.js');

const createManager = () => new LLMConfigManager({}, { get: (_path, fallback) => fallback });

function createTranscriptService(maxContextTokens) {
  return new ConversationTranscriptService(
    {},
    {
      normalizeToolParams: (_tool, params) => params,
      sanitizeResultForLLM: result => result,
      configManager: { get: (key, fallback) => (key === 'llm.maxContextTokens' ? maxContextTokens : fallback) },
    }
  );
}

const anthropicToolResponse = {
  provider: 'anthropic',
  stop_reason: 'tool_use',
  content: [
    { type: 'thinking', thinking: 'Need the lysC locus first.', signature: 'sig-abc' },
    { type: 'redacted_thinking', data: 'opaque-data' },
    { type: 'text', text: 'Looking it up.' },
    { type: 'tool_use', id: 'toolu_1', name: 'jump_to_gene', input: { geneName: 'lysC' } },
  ],
};

/** A turn: user asks, the model calls one tool, the result comes back. */
function buildTurn(service, reasoningReplay, earlierTurn = []) {
  const history = [
    { role: 'system', content: 'You are CodeXomics.' },
    ...earlierTurn,
    { role: 'user', content: 'jump to lysC' },
  ];
  service.appendToolRoundToHistory(history, {
    assistantText: 'Looking it up.',
    toolsToExecute: [{ tool_name: 'jump_to_gene', tool_call_id: 'toolu_1', parameters: { geneName: 'lysC' } }],
    toolResults: [
      { tool: 'jump_to_gene', tool_call_id: 'toolu_1', success: true, result: { ok: true }, parameters: {} },
    ],
    reasoningReplay,
  });
  return history;
}

describe('extracting reasoning state from a tool-call response', () => {
  const manager = createManager();

  it('keeps signed Anthropic thinking and redacted thinking blocks', () => {
    expect(manager.extractReasoningReplayState(anthropicToolResponse)).toEqual({
      family: 'anthropic',
      blocks: [
        { type: 'thinking', thinking: 'Need the lysC locus first.', signature: 'sig-abc' },
        { type: 'redacted_thinking', data: 'opaque-data' },
      ],
    });
  });

  it('drops an Anthropic thinking block that has no signature to verify', () => {
    const response = { provider: 'anthropic', content: [{ type: 'thinking', thinking: 'x' }, { type: 'tool_use' }] };
    expect(manager.extractReasoningReplayState(response)).toBeNull();
  });

  it('keeps Gemini thought signatures per function call', () => {
    const response = {
      provider: 'google',
      content: {
        parts: [
          { text: 'thinking', thought: true },
          { functionCall: { name: 'jump_to_gene', args: {} }, thoughtSignature: 'gsig-1' },
          { functionCall: { name: 'zoom_in', args: {} } },
        ],
      },
    };
    expect(manager.extractReasoningReplayState(response)).toEqual({
      family: 'google',
      functionCalls: [
        { name: 'jump_to_gene', thoughtSignature: 'gsig-1' },
        { name: 'zoom_in', thoughtSignature: null },
      ],
    });
  });

  it('keeps reasoning_content from an OpenAI-compatible provider', () => {
    const response = { provider: 'deepseek', reasoning_content: 'Plan: call the tool.', tool_calls: [{}] };
    expect(manager.extractReasoningReplayState(response)).toEqual({
      family: 'openai-compatible',
      provider: 'deepseek',
      reasoningContent: 'Plan: call the tool.',
    });
  });

  it('returns null for a plain-text answer', () => {
    expect(manager.extractReasoningReplayState('Done.')).toBeNull();
  });
});

describe('carrying reasoning state in the transcript', () => {
  it('attaches it to the assistant tool-call turn without serializing it', () => {
    const service = createTranscriptService();
    const replay = createManager().extractReasoningReplayState(anthropicToolResponse);
    const history = buildTurn(service, replay);
    const assistant = history.find(message => message.role === 'assistant');

    expect(service.getMessageReasoningReplay(assistant)).toBe(replay);
    expect(JSON.stringify(assistant)).not.toContain('sig-abc');
  });

  it('counts replayed reasoning toward the context estimate', () => {
    const service = createTranscriptService();
    const withReplay = buildTurn(service, {
      family: 'anthropic',
      blocks: [{ type: 'thinking', thinking: 'x'.repeat(4000), signature: 's' }],
    });
    const without = buildTurn(service, null);
    expect(service.estimateConversationTokens(withReplay)).toBeGreaterThan(
      service.estimateConversationTokens(without) + 900
    );
  });

  it('drops reasoning state after an earlier message is trimmed from the history', () => {
    const service = createTranscriptService(4000);
    const earlierTurn = [
      { role: 'user', content: 'earlier question' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [{ id: 'old', type: 'function', function: { name: 'search', arguments: '{}' } }],
      },
      { role: 'tool', tool_call_id: 'old', name: 'search', content: 'x'.repeat(40000) },
      { role: 'assistant', content: 'earlier answer' },
    ];
    const history = buildTurn(
      service,
      { family: 'anthropic', blocks: [{ type: 'thinking', thinking: '', signature: 's' }] },
      earlierTurn
    );
    const assistant = history[history.length - 2];

    const report = service.enforceConversationTokenBudget(history, { originalMessage: 'jump to lysC' });

    expect(report.compactedResults).toBe(1);
    expect(report.clearedReasoning).toBe(1);
    expect(service.getMessageReasoningReplay(assistant)).toBeNull();
  });
});

describe('restoring reasoning state per provider', () => {
  const service = createTranscriptService();

  it('puts Anthropic thinking blocks first in the replayed assistant turn', () => {
    const manager = createManager();
    const history = buildTurn(service, manager.extractReasoningReplayState(anthropicToolResponse));

    const assistant = manager.toAnthropicMessages(history).find(message => message.role === 'assistant');

    expect(assistant.content.map(block => block.type)).toEqual(['thinking', 'redacted_thinking', 'text', 'tool_use']);
    expect(assistant.content[0].signature).toBe('sig-abc');
  });

  it("treats the loop's own user-role messages as part of the turn", () => {
    const manager = createManager();
    const history = buildTurn(service, manager.extractReasoningReplayState(anthropicToolResponse));
    history.push({
      role: 'user',
      content: '[Tool Execution State]\nThis is execution state for the current user request',
    });

    const assistant = manager.toAnthropicMessages(history).find(message => message.role === 'assistant');
    expect(assistant.content[0].type).toBe('thinking');
  });

  it('uses the marked turn-start message as the boundary', () => {
    const manager = createManager();
    const history = buildTurn(service, null);
    const turnStart = history.findIndex(message => message.content === 'jump to lysC');
    history[turnStart] = service.createTurnStartMessage('jump to lysC');
    history.push({ role: 'user', content: 'Retry: the request still has an outstanding step.' });

    expect(manager.getCurrentTurnStart(history)).toBe(turnStart + 1);
  });

  it('does not replay thinking from an earlier turn', () => {
    const manager = createManager();
    const history = buildTurn(service, manager.extractReasoningReplayState(anthropicToolResponse));
    history.push({ role: 'assistant', content: 'Done.' }, { role: 'user', content: 'next question' });

    const assistant = manager.toAnthropicMessages(history).find(message => message.role === 'assistant');
    expect(assistant.content.map(block => block.type)).toEqual(['text', 'tool_use']);
  });

  it('omits thinking blocks when asked to', () => {
    const manager = createManager();
    const history = buildTurn(service, manager.extractReasoningReplayState(anthropicToolResponse));
    const assistant = manager
      .toAnthropicMessages(history, { omitReasoningReplay: true })
      .find(message => message.role === 'assistant');
    expect(assistant.content[0].type).toBe('text');
  });

  it('restores Gemini thought signatures on the function call parts', () => {
    const manager = createManager();
    const history = buildTurn(service, {
      family: 'google',
      functionCalls: [{ name: 'jump_to_gene', thoughtSignature: 'gsig-1' }],
    });

    const model = manager
      .toGoogleContents(history, { model: 'gemini-3.5-flash' })
      .find(content => content.role === 'model');

    expect(model.parts.find(part => part.functionCall).thoughtSignature).toBe('gsig-1');
  });

  it('gives a Gemini 3 function call with no real signature the documented bypass value', () => {
    const manager = createManager();
    const history = buildTurn(service, null);

    const gemini3 = manager.toGoogleContents(history, { model: 'gemini-3.1-pro' }).find(c => c.role === 'model');
    const gemini25 = manager.toGoogleContents(history, { model: 'gemini-2.5-flash' }).find(c => c.role === 'model');

    expect(gemini3.parts.find(part => part.functionCall).thoughtSignature).toBe('skip_thought_signature_validator');
    expect(gemini25.parts.find(part => part.functionCall).thoughtSignature).toBeUndefined();
  });

  it('adds reasoning_content for DeepSeek and leaves other providers untouched', () => {
    const manager = createManager();
    const history = buildTurn(service, {
      family: 'openai-compatible',
      provider: 'deepseek',
      reasoningContent: 'Plan.',
    });

    const deepseek = manager.buildOpenAICompatiblePayload({ model: 'deepseek-reasoner' }, history, {}, {}, 'deepseek');
    const openai = manager.buildOpenAICompatiblePayload({ model: 'gpt-5.5' }, history, {}, {}, 'openai');

    expect(deepseek.messages.find(message => message.role === 'assistant').reasoning_content).toBe('Plan.');
    expect(openai.messages).toBe(history);
    expect(JSON.stringify(openai.messages)).not.toContain('reasoning_content');
  });
});

describe('falling back when a provider rejects the replay', () => {
  it('retries once without the reasoning state on a 400 about thinking', async () => {
    const manager = createManager();
    const history = buildTurn(createTranscriptService(), manager.extractReasoningReplayState(anthropicToolResponse));
    const rejection = Object.assign(new Error('HTTP 400: Bad Request - invalid signature in thinking block'), {
      status: 400,
    });
    const send = vi.fn().mockRejectedValueOnce(rejection).mockResolvedValueOnce('ok');
    const onStreamReset = vi.fn();

    const result = await manager.withReasoningReplayFallback('anthropic', history, { onStreamReset }, send);

    expect(result).toBe('ok');
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0]).toMatchObject({ omitReasoningReplay: true });
    expect(onStreamReset).toHaveBeenCalled();
  });

  it('does not retry an unrelated failure or a transcript with nothing replayed', async () => {
    const manager = createManager();
    const history = buildTurn(createTranscriptService(), null);
    const rejection = Object.assign(new Error('HTTP 400: thinking budget too large'), { status: 400 });
    const send = vi.fn().mockRejectedValue(rejection);

    await expect(manager.withReasoningReplayFallback('anthropic', history, {}, send)).rejects.toBe(rejection);
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe('the ChatBox round loop', () => {
  it('carries the reasoning a tool-call round produced into the next round', async () => {
    const toolCall = {
      ...openAiToolCall('jump_to_gene', { geneName: 'lysC' }, { id: 'call_1', provider: 'deepseek' }),
    };
    toolCall.reasoning_content = 'Locate lysC before answering.';
    const harness = createAgentLoopHarness({
      responses: [toolCall, 'Done.'],
      tools: { jump_to_gene: () => ({ success: true }) },
    });
    const manager = createManager();
    harness.chatManager.llmConfigManager.extractReasoningReplayState = response =>
      manager.extractReasoningReplayState(response);

    await harness.send('jump to lysC');

    const assistant = harness.history.find(message => message.role === 'assistant' && message.tool_calls);
    expect(assistant.__codexomicsReasoning).toEqual({
      family: 'openai-compatible',
      provider: 'deepseek',
      reasoningContent: 'Locate lysC before answering.',
    });
    expect(
      manager.buildOpenAICompatiblePayload({ model: 'deepseek-reasoner' }, harness.history, {}, {}, 'deepseek').messages
    ).toContainEqual(
      expect.objectContaining({ role: 'assistant', reasoning_content: 'Locate lysC before answering.' })
    );
  });
});
