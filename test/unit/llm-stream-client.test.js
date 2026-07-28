/* eslint-disable no-new-func */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';

const STREAM_CLIENT_PATH = path.join(process.cwd(), 'src/renderer/modules/LLMStreamClient.js');

function loadStreamClient() {
  const code = fs.readFileSync(STREAM_CLIENT_PATH, 'utf-8');
  return new Function(`${code}; return LLMStreamClient;`)();
}

/**
 * Build a minimal fetch Response stand-in that yields `chunks` verbatim, so
 * tests can reproduce arbitrary network chunk boundaries.
 */
function makeResponse(chunks, { contentType = 'text/event-stream', ok = true, status = 200 } = {}) {
  const encoder = new TextEncoder();
  let index = 0;

  return {
    ok,
    status,
    headers: {
      get: name => (String(name).toLowerCase() === 'content-type' ? contentType : null),
    },
    body: {
      getReader() {
        return {
          read: async () =>
            index < chunks.length ? { done: false, value: encoder.encode(chunks[index++]) } : { done: true },
          cancel: async () => {},
          releaseLock: () => {},
        };
      },
    },
  };
}

const sse = obj => `data: ${JSON.stringify(obj)}\n\n`;

describe('LLMStreamClient', () => {
  let LLMStreamClient;

  beforeAll(() => {
    LLMStreamClient = loadStreamClient();
  });

  describe('SSE parsing', () => {
    it('reassembles events split across chunk boundaries', () => {
      const parser = LLMStreamClient.createSSEParser();

      expect(parser.push('data: {"a"')).toEqual([]);
      expect(parser.push(':1}\n')).toEqual([]);
      const events = parser.push('\n');

      expect(events).toHaveLength(1);
      expect(JSON.parse(events[0].data)).toEqual({ a: 1 });
    });

    it('handles multiple events in a single chunk', () => {
      const parser = LLMStreamClient.createSSEParser();
      const events = parser.push('data: 1\n\ndata: 2\n\n');

      expect(events.map(e => e.data)).toEqual(['1', '2']);
    });

    it('normalizes CRLF line endings', () => {
      const parser = LLMStreamClient.createSSEParser();
      const events = parser.push('event: ping\r\ndata: {"x":1}\r\n\r\n');

      expect(events).toHaveLength(1);
      expect(events[0].event).toBe('ping');
      expect(JSON.parse(events[0].data)).toEqual({ x: 1 });
    });

    it('ignores comment/keep-alive lines', () => {
      const parser = LLMStreamClient.createSSEParser();

      expect(parser.push(': keep-alive\n\n')).toEqual([]);
    });

    it('emits a trailing event that never received its blank-line terminator', () => {
      const parser = LLMStreamClient.createSSEParser();

      expect(parser.push('data: {"final":true}\n')).toEqual([]);
      const flushed = parser.flush();

      expect(flushed).toHaveLength(1);
      expect(JSON.parse(flushed[0].data)).toEqual({ final: true });
    });
  });

  describe('streamOpenAICompatible', () => {
    it('accumulates content deltas and emits tokens in order', async () => {
      const response = makeResponse([
        sse({ choices: [{ delta: { role: 'assistant', content: 'Hello' } }] }),
        sse({ choices: [{ delta: { content: ' world' } }] }),
        sse({ choices: [{ delta: {}, finish_reason: 'stop' }] }),
        'data: [DONE]\n\n',
      ]);

      const tokens = [];
      const data = await LLMStreamClient.streamOpenAICompatible(response, { onToken: t => tokens.push(t) });

      expect(tokens).toEqual(['Hello', ' world']);
      expect(data.choices[0].message.content).toBe('Hello world');
      expect(data.choices[0].message.role).toBe('assistant');
      expect(data.choices[0].finish_reason).toBe('stop');
    });

    it('reassembles fragmented tool calls into a complete tool_calls array', async () => {
      const response = makeResponse([
        sse({
          choices: [
            {
              delta: { tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name: 'navigate_to' } }] },
            },
          ],
        }),
        sse({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"chr":' } }] } }] }),
        sse({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"chr1"}' } }] } }] }),
        sse({ choices: [{ delta: {}, finish_reason: 'tool_calls' }] }),
        'data: [DONE]\n\n',
      ]);

      const data = await LLMStreamClient.streamOpenAICompatible(response, {});
      const toolCalls = data.choices[0].message.tool_calls;

      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].id).toBe('call_1');
      expect(toolCalls[0].function.name).toBe('navigate_to');
      expect(JSON.parse(toolCalls[0].function.arguments)).toEqual({ chr: 'chr1' });
      expect(data.choices[0].finish_reason).toBe('tool_calls');
    });

    it('orders multiple parallel tool calls by their index', async () => {
      const response = makeResponse([
        sse({
          choices: [
            {
              delta: {
                tool_calls: [
                  { index: 1, id: 'b', function: { name: 'second', arguments: '{}' } },
                  { index: 0, id: 'a', function: { name: 'first', arguments: '{}' } },
                ],
              },
            },
          ],
        }),
        'data: [DONE]\n\n',
      ]);

      const data = await LLMStreamClient.streamOpenAICompatible(response, {});

      expect(data.choices[0].message.tool_calls.map(c => c.function.name)).toEqual(['first', 'second']);
    });

    it('collects reasoning deltas without emitting them as visible tokens', async () => {
      const response = makeResponse([
        sse({ choices: [{ delta: { reasoning_content: 'thinking...' } }] }),
        sse({ choices: [{ delta: { content: 'answer' } }] }),
        'data: [DONE]\n\n',
      ]);

      const tokens = [];
      const data = await LLMStreamClient.streamOpenAICompatible(response, { onToken: t => tokens.push(t) });

      expect(tokens).toEqual(['answer']);
      expect(data.choices[0].message.reasoning_content).toBe('thinking...');
    });

    it('streams reasoning deltas to onReasoningToken as they arrive', async () => {
      const response = makeResponse([
        sse({ choices: [{ delta: { reasoning_content: 'first ' } }] }),
        sse({ choices: [{ delta: { reasoning: 'second' } }] }),
        sse({ choices: [{ delta: { content: 'answer' } }] }),
        'data: [DONE]\n\n',
      ]);

      const tokens = [];
      const reasoningTokens = [];
      const data = await LLMStreamClient.streamOpenAICompatible(response, {
        onToken: t => tokens.push(t),
        onReasoningToken: t => reasoningTokens.push(t),
      });

      // Each delta is surfaced individually, and the two sinks stay disjoint.
      expect(reasoningTokens).toEqual(['first ', 'second']);
      expect(tokens).toEqual(['answer']);
      expect(data.choices[0].message.reasoning_content).toBe('first second');
    });

    it('reports content as null when only tool calls were returned', async () => {
      const response = makeResponse([
        sse({
          choices: [{ delta: { tool_calls: [{ index: 0, id: 'x', function: { name: 'f', arguments: '{}' } }] } }],
        }),
        'data: [DONE]\n\n',
      ]);

      const data = await LLMStreamClient.streamOpenAICompatible(response, {});

      expect(data.choices[0].message.content).toBeNull();
    });

    it('throws when the stream carries a provider error', async () => {
      const response = makeResponse([sse({ error: { message: 'rate limited' } })]);

      await expect(LLMStreamClient.streamOpenAICompatible(response, {})).rejects.toThrow(/rate limited/);
    });

    it('throws when the stream yields no usable chunks', async () => {
      const response = makeResponse(['data: [DONE]\n\n']);

      await expect(LLMStreamClient.streamOpenAICompatible(response, {})).rejects.toThrow(/no usable chunks/);
    });
  });

  describe('streamAnthropic', () => {
    it('accumulates text blocks and the stop reason', async () => {
      const response = makeResponse([
        `event: message_start\ndata: ${JSON.stringify({ message: { id: 'msg_1', role: 'assistant', model: 'claude' } })}\n\n`,
        `event: content_block_start\ndata: ${JSON.stringify({ index: 0, content_block: { type: 'text', text: '' } })}\n\n`,
        `event: content_block_delta\ndata: ${JSON.stringify({ index: 0, delta: { type: 'text_delta', text: 'Hi' } })}\n\n`,
        `event: content_block_delta\ndata: ${JSON.stringify({ index: 0, delta: { type: 'text_delta', text: ' there' } })}\n\n`,
        `event: content_block_stop\ndata: ${JSON.stringify({ index: 0 })}\n\n`,
        `event: message_delta\ndata: ${JSON.stringify({ delta: { stop_reason: 'end_turn' } })}\n\n`,
      ]);

      const tokens = [];
      const data = await LLMStreamClient.streamAnthropic(response, { onToken: t => tokens.push(t) });

      expect(tokens).toEqual(['Hi', ' there']);
      expect(data.content).toEqual([{ type: 'text', text: 'Hi there' }]);
      expect(data.stop_reason).toBe('end_turn');
      expect(data.id).toBe('msg_1');
    });

    it('parses tool_use blocks from streamed partial JSON', async () => {
      const response = makeResponse([
        `event: content_block_start\ndata: ${JSON.stringify({
          index: 0,
          content_block: { type: 'tool_use', id: 'toolu_1', name: 'search_genes', input: {} },
        })}\n\n`,
        `event: content_block_delta\ndata: ${JSON.stringify({
          index: 0,
          delta: { type: 'input_json_delta', partial_json: '{"query":' },
        })}\n\n`,
        `event: content_block_delta\ndata: ${JSON.stringify({
          index: 0,
          delta: { type: 'input_json_delta', partial_json: '"lacZ"}' },
        })}\n\n`,
        `event: content_block_stop\ndata: ${JSON.stringify({ index: 0 })}\n\n`,
        `event: message_delta\ndata: ${JSON.stringify({ delta: { stop_reason: 'tool_use' } })}\n\n`,
      ]);

      const data = await LLMStreamClient.streamAnthropic(response, {});

      expect(data.content[0].type).toBe('tool_use');
      expect(data.content[0].name).toBe('search_genes');
      expect(data.content[0].input).toEqual({ query: 'lacZ' });
      expect(data.stop_reason).toBe('tool_use');
    });

    it('defaults tool input to an empty object when no JSON deltas arrive', async () => {
      const response = makeResponse([
        `event: content_block_start\ndata: ${JSON.stringify({
          index: 0,
          content_block: { type: 'tool_use', id: 't', name: 'noargs', input: {} },
        })}\n\n`,
        `event: content_block_stop\ndata: ${JSON.stringify({ index: 0 })}\n\n`,
      ]);

      const data = await LLMStreamClient.streamAnthropic(response, {});

      expect(data.content[0].input).toEqual({});
    });

    it('captures thinking blocks without emitting them as visible tokens', async () => {
      const response = makeResponse([
        `event: content_block_start\ndata: ${JSON.stringify({ index: 0, content_block: { type: 'thinking' } })}\n\n`,
        `event: content_block_delta\ndata: ${JSON.stringify({
          index: 0,
          delta: { type: 'thinking_delta', thinking: 'reasoning' },
        })}\n\n`,
        `event: content_block_stop\ndata: ${JSON.stringify({ index: 0 })}\n\n`,
      ]);

      const tokens = [];
      const data = await LLMStreamClient.streamAnthropic(response, { onToken: t => tokens.push(t) });

      expect(tokens).toEqual([]);
      expect(data.content[0]).toMatchObject({ type: 'thinking', thinking: 'reasoning' });
    });

    it('streams thinking deltas to onReasoningToken as they arrive', async () => {
      const response = makeResponse([
        `event: content_block_start\ndata: ${JSON.stringify({ index: 0, content_block: { type: 'thinking' } })}\n\n`,
        `event: content_block_delta\ndata: ${JSON.stringify({
          index: 0,
          delta: { type: 'thinking_delta', thinking: 'step one ' },
        })}\n\n`,
        `event: content_block_delta\ndata: ${JSON.stringify({
          index: 0,
          delta: { type: 'thinking_delta', thinking: 'step two' },
        })}\n\n`,
        `event: content_block_stop\ndata: ${JSON.stringify({ index: 0 })}\n\n`,
        `event: content_block_start\ndata: ${JSON.stringify({ index: 1, content_block: { type: 'text', text: '' } })}\n\n`,
        `event: content_block_delta\ndata: ${JSON.stringify({ index: 1, delta: { type: 'text_delta', text: 'Hi' } })}\n\n`,
      ]);

      const tokens = [];
      const reasoningTokens = [];
      await LLMStreamClient.streamAnthropic(response, {
        onToken: t => tokens.push(t),
        onReasoningToken: t => reasoningTokens.push(t),
      });

      expect(reasoningTokens).toEqual(['step one ', 'step two']);
      expect(tokens).toEqual(['Hi']);
    });
  });

  describe('streamGoogle', () => {
    it('concatenates text parts and preserves the finish reason', async () => {
      const response = makeResponse([
        sse({ candidates: [{ content: { parts: [{ text: 'Gene ' }] } }] }),
        sse({ candidates: [{ content: { parts: [{ text: 'lacZ' }] }, finishReason: 'STOP' }] }),
      ]);

      const tokens = [];
      const data = await LLMStreamClient.streamGoogle(response, { onToken: t => tokens.push(t) });

      expect(tokens).toEqual(['Gene ', 'lacZ']);
      expect(data.candidates[0].content.parts).toEqual([{ text: 'Gene lacZ' }]);
      expect(data.candidates[0].finishReason).toBe('STOP');
    });

    it('preserves functionCall parts alongside text', async () => {
      const response = makeResponse([
        sse({ candidates: [{ content: { parts: [{ text: 'calling' }] } }] }),
        sse({
          candidates: [
            {
              content: { parts: [{ functionCall: { name: 'navigate_to', args: { chr: 'chr1' } } }] },
              finishReason: 'STOP',
            },
          ],
        }),
      ]);

      const data = await LLMStreamClient.streamGoogle(response, {});
      const parts = data.candidates[0].content.parts;

      expect(parts.find(p => p.functionCall)).toBeDefined();
      expect(parts.find(p => p.functionCall).functionCall.name).toBe('navigate_to');
    });

    it('separates thought parts from visible text', async () => {
      const response = makeResponse([
        sse({ candidates: [{ content: { parts: [{ text: 'internal', thought: true }, { text: 'visible' }] } }] }),
      ]);

      const tokens = [];
      const data = await LLMStreamClient.streamGoogle(response, { onToken: t => tokens.push(t) });

      expect(tokens).toEqual(['visible']);
      expect(data.candidates[0].content.parts).toEqual([{ text: 'internal', thought: true }, { text: 'visible' }]);
    });

    it('streams thought parts to onReasoningToken as they arrive', async () => {
      const response = makeResponse([
        sse({ candidates: [{ content: { parts: [{ text: 'why ', thought: true }] } }] }),
        sse({ candidates: [{ content: { parts: [{ text: 'because', thought: true }, { text: 'visible' }] } }] }),
      ]);

      const tokens = [];
      const reasoningTokens = [];
      await LLMStreamClient.streamGoogle(response, {
        onToken: t => tokens.push(t),
        onReasoningToken: t => reasoningTokens.push(t),
      });

      expect(reasoningTokens).toEqual(['why ', 'because']);
      expect(tokens).toEqual(['visible']);
    });
  });

  describe('isEventStream', () => {
    it('detects an SSE content type regardless of charset or case', () => {
      expect(LLMStreamClient.isEventStream(makeResponse([], { contentType: 'text/event-stream' }))).toBe(true);
      expect(LLMStreamClient.isEventStream(makeResponse([], { contentType: 'TEXT/EVENT-STREAM; charset=utf-8' }))).toBe(
        true
      );
    });

    it('rejects a plain JSON response so the caller can fall back', () => {
      expect(LLMStreamClient.isEventStream(makeResponse([], { contentType: 'application/json' }))).toBe(false);
    });
  });
});
