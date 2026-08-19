/**
 * Requests have carried native tool schemas on every adapter for a while, so
 * models answer with real tool calls that have ids. This covers the other half
 * of that protocol: replaying the executed round back to the model the way the
 * provider defines it, instead of as a JSON blob in an assistant message
 * followed by a prose "[Tool Result]" user turn.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { createAgentLoopHarness, openAiToolCall, openAiToolCalls } = require('../helpers/agent-loop-harness.js');
const LLMConfigManager = require('../../src/renderer/modules/LLMConfigManager.js');

const createManager = () => new LLMConfigManager({}, { get: (_path, fallback) => fallback });

describe('native tool-protocol round trip', () => {
  it('replays the round as an assistant tool_calls turn plus bound tool messages', async () => {
    const harness = createAgentLoopHarness({
      responses: [openAiToolCall('jump_to_gene', { geneName: 'lysC' }, { id: 'call_lysc' }), 'Done.'],
      tools: { jump_to_gene: () => ({ success: true, position: '10-20' }) },
    });

    await harness.send('jump to lysC');

    const secondRound = harness.requests[1];
    const assistant = secondRound.find(message => message.role === 'assistant');
    expect(assistant.tool_calls).toEqual([
      { id: 'call_lysc', type: 'function', function: { name: 'jump_to_gene', arguments: '{"geneName":"lysC"}' } },
    ]);

    const toolMessage = secondRound.find(message => message.role === 'tool');
    expect(toolMessage.tool_call_id).toBe('call_lysc');
    expect(toolMessage.name).toBe('jump_to_gene');
    expect(toolMessage.content).toContain('"position":"10-20"');
  });

  it('binds every parallel result to the call it answers', async () => {
    const harness = createAgentLoopHarness({
      responses: [
        openAiToolCalls([
          { name: 'jump_to_gene', parameters: { geneName: 'lysC' }, id: 'call_a' },
          { name: 'zoom_in', parameters: {}, id: 'call_b' },
        ]),
        'Done.',
      ],
      tools: { jump_to_gene: () => ({ success: true, gene: 'lysC' }), zoom_in: () => ({ success: true, zoom: 2 }) },
    });

    await harness.send('jump to lysC and zoom in');

    const toolMessages = harness.history.filter(message => message.role === 'tool');
    expect(toolMessages.map(message => [message.tool_call_id, message.name])).toEqual([
      ['call_a', 'jump_to_gene'],
      ['call_b', 'zoom_in'],
    ]);
    expect(toolMessages[0].content).toContain('lysC');
    expect(toolMessages[1].content).toContain('"zoom":2');
  });

  it('leaves no tool_call without a matching tool message', async () => {
    const harness = createAgentLoopHarness({
      responses: [
        openAiToolCalls([
          { name: 'jump_to_gene', parameters: { geneName: 'lysC' }, id: 'call_a' },
          { name: 'zoom_in', parameters: {}, id: 'call_b' },
        ]),
        'Done.',
      ],
      tools: {
        jump_to_gene: () => ({ success: true }),
        zoom_in: () => {
          throw new Error('renderer offline');
        },
      },
    });

    await harness.send('jump to lysC and zoom in');

    const history = harness.requests[1];
    const callIds = history.flatMap(message => (message.tool_calls || []).map(call => call.id));
    const resultIds = history.filter(message => message.role === 'tool').map(message => message.tool_call_id);
    expect(new Set(resultIds)).toEqual(new Set(callIds));
  });

  it('reports a failed call in its own tool message rather than a separate prose turn', async () => {
    const harness = createAgentLoopHarness({
      responses: [openAiToolCall('jump_to_gene', { geneName: 'nope' }, { id: 'call_x' }), 'Could not find it.'],
      tools: { jump_to_gene: () => ({ success: false, error: 'gene not found' }) },
    });

    await harness.send('jump to the nope gene');

    const toolMessage = harness.requests[1].find(message => message.role === 'tool');
    expect(toolMessage.tool_call_id).toBe('call_x');
    expect(JSON.parse(toolMessage.content.split('\n')[0])).toEqual({ success: false, error: 'gene not found' });
    expect(harness.requests[1].some(message => String(message.content).includes('[Tool Execution Error]'))).toBe(false);
  });

  it('still keeps the anti-repeat guidance the loop depends on', async () => {
    const harness = createAgentLoopHarness({
      responses: [openAiToolCall('jump_to_gene', { geneName: 'lysC' }, { id: 'call_1' }), 'Done.'],
      tools: { jump_to_gene: () => ({ success: true }) },
    });

    await harness.send('jump to lysC');

    const toolMessage = harness.requests[1].find(message => message.role === 'tool');
    expect(toolMessage.content).toContain('These steps are done');
  });

  it('falls back to the prose envelope when the round has no tool-call ids', async () => {
    const harness = createAgentLoopHarness({
      responses: [JSON.stringify({ tool_name: 'jump_to_gene', parameters: { geneName: 'lysC' } }), 'Done.'],
      tools: { jump_to_gene: () => ({ success: true }) },
    });

    await harness.send('jump to lysC');

    const secondRound = harness.requests[1];
    expect(secondRound.some(message => message.role === 'tool')).toBe(false);
    expect(secondRound.some(message => String(message.content).includes('[Tool Result]'))).toBe(true);
  });

  it('still blocks a repeat call after a native round', async () => {
    // Duplicate suppression used to read the prose "<tool> executed
    // successfully" out of the transcript; the native transcript never contains
    // that sentence, so the structured ledger has to carry it.
    const harness = createAgentLoopHarness({
      responses: [
        openAiToolCall('jump_to_gene', { geneName: 'lysC' }, { id: 'call_1' }),
        openAiToolCall('jump_to_gene', { geneName: 'lysC' }, { id: 'call_2' }),
        'Already there.',
      ],
      tools: { jump_to_gene: () => ({ success: true }) },
    });

    await harness.send('jump to lysC');

    expect(harness.toolCalls).toHaveLength(1);
  });
});

describe('provider transcript translation', () => {
  const history = [
    { role: 'system', content: 'system prompt' },
    { role: 'user', content: 'jump to lysC and zoom in' },
    {
      role: 'assistant',
      content: null,
      tool_calls: [
        { id: 'call_a', type: 'function', function: { name: 'jump_to_gene', arguments: '{"geneName":"lysC"}' } },
        { id: 'call_b', type: 'function', function: { name: 'zoom_in', arguments: '{}' } },
      ],
    },
    { role: 'tool', tool_call_id: 'call_a', name: 'jump_to_gene', content: '{"success":true}' },
    { role: 'tool', tool_call_id: 'call_b', name: 'zoom_in', content: '{"zoom":2}' },
  ];

  it('maps tool calls and results onto Anthropic content blocks', () => {
    const messages = createManager().toAnthropicMessages(history);

    expect(messages.some(message => message.role === 'system')).toBe(false);
    const assistant = messages.find(message => message.role === 'assistant');
    expect(assistant.content).toEqual([
      { type: 'tool_use', id: 'call_a', name: 'jump_to_gene', input: { geneName: 'lysC' } },
      { type: 'tool_use', id: 'call_b', name: 'zoom_in', input: {} },
    ]);

    // Anthropic wants every tool_result for a turn in one user message.
    const results = messages[messages.length - 1];
    expect(results.role).toBe('user');
    expect(results.content.map(block => block.tool_use_id)).toEqual(['call_a', 'call_b']);
    expect(results.content.every(block => block.type === 'tool_result')).toBe(true);
  });

  it('keeps assistant text alongside its tool_use blocks', () => {
    const messages = createManager().toAnthropicMessages([
      { role: 'user', content: 'hi' },
      {
        role: 'assistant',
        content: 'Looking that up.',
        tool_calls: [{ id: 'c1', type: 'function', function: { name: 'zoom_in', arguments: '{}' } }],
      },
      { role: 'tool', tool_call_id: 'c1', name: 'zoom_in', content: '{}' },
    ]);

    expect(messages[1].content[0]).toEqual({ type: 'text', text: 'Looking that up.' });
    expect(messages[1].content[1].type).toBe('tool_use');
  });

  it('maps tool calls and results onto Gemini parts', () => {
    const contents = createManager().toGoogleContents(history);

    const model = contents.find(entry => entry.role === 'model');
    expect(model.parts).toEqual([
      { functionCall: { name: 'jump_to_gene', args: { geneName: 'lysC' } } },
      { functionCall: { name: 'zoom_in', args: {} } },
    ]);

    const responses = contents[contents.length - 1];
    expect(responses.role).toBe('user');
    expect(responses.parts).toEqual([
      { functionResponse: { name: 'jump_to_gene', response: { success: true } } },
      { functionResponse: { name: 'zoom_in', response: { zoom: 2 } } },
    ]);
  });

  it('never emits an empty Gemini text part for a null-content turn', () => {
    const contents = createManager().toGoogleContents([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: null },
      { role: 'user', content: 'still there?' },
    ]);

    expect(contents).toEqual([
      { role: 'user', parts: [{ text: 'hi' }] },
      { role: 'user', parts: [{ text: 'still there?' }] },
    ]);
  });

  it('tolerates malformed tool-call arguments instead of throwing', () => {
    const manager = createManager();
    const messages = manager.toAnthropicMessages([
      {
        role: 'assistant',
        content: null,
        tool_calls: [{ id: 'c1', type: 'function', function: { name: 'zoom_in', arguments: '{not json' } }],
      },
    ]);

    expect(messages[0].content[0].input).toEqual({});
  });

  it('wraps a non-object tool result for Gemini', () => {
    const contents = createManager().toGoogleContents([
      { role: 'tool', tool_call_id: 'c1', name: 'get_sequence', content: 'ATGC' },
    ]);

    expect(contents[0].parts[0].functionResponse.response).toEqual({ result: 'ATGC' });
  });
});
