/* eslint-disable no-new-func */
/**
 * Verifies the streaming fast path in LLMConfigManager produces exactly the
 * response contract the non-streaming path produces, and that it degrades
 * safely when a provider cannot stream.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

const STREAM_CLIENT_PATH = path.join(process.cwd(), 'src/renderer/modules/LLMStreamClient.js');
const LLM_CONFIG_MANAGER_PATH = path.join(process.cwd(), 'src/renderer/modules/LLMConfigManager.js');

/**
 * Load both modules into one scope so LLMConfigManager resolves the
 * LLMStreamClient global exactly as it does from index.html script tags.
 */
function loadLLMConfigManager() {
  const streamCode = fs.readFileSync(STREAM_CLIENT_PATH, 'utf-8');
  const configCode = fs.readFileSync(LLM_CONFIG_MANAGER_PATH, 'utf-8');
  return new Function(`${streamCode}\n${configCode}\nreturn LLMConfigManager;`)();
}

function makeSSEResponse(chunks) {
  const encoder = new TextEncoder();
  let index = 0;
  return {
    ok: true,
    status: 200,
    headers: { get: name => (String(name).toLowerCase() === 'content-type' ? 'text/event-stream' : null) },
    body: {
      getReader: () => ({
        read: async () =>
          index < chunks.length ? { done: false, value: encoder.encode(chunks[index++]) } : { done: true },
        cancel: async () => {},
        releaseLock: () => {},
      }),
    },
  };
}

function makeJSONResponse(payload, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    headers: { get: name => (String(name).toLowerCase() === 'content-type' ? 'application/json' : null) },
    body: {},
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  };
}

const sse = obj => `data: ${JSON.stringify(obj)}\n\n`;

describe('LLMConfigManager streaming integration', () => {
  let LLMConfigManager;
  let manager;
  const provider = {
    name: 'OpenAI',
    apiKey: 'test-key',
    model: 'gpt-5.5',
    baseUrl: 'https://api.openai.com/v1',
    enabled: true,
  };

  beforeAll(() => {
    LLMConfigManager = loadLLMConfigManager();
  });

  beforeEach(() => {
    manager = new LLMConfigManager(null, null);
    // Keep the test focused on transport, not on token budgeting.
    manager.getMaxTokens = () => 1000;
    manager.getTemperature = () => 0.7;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('streams prose and returns the same plain string the non-streaming path returns', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        makeSSEResponse([
          sse({ choices: [{ delta: { role: 'assistant', content: 'Hello' } }] }),
          sse({ choices: [{ delta: { content: ' world' } }] }),
          sse({ choices: [{ delta: {}, finish_reason: 'stop' }] }),
          'data: [DONE]\n\n',
        ])
      )
    );

    const tokens = [];
    const result = await manager.sendOpenAIMessageWithHistory(provider, [{ role: 'user', content: 'hi' }], null, null, {
      onToken: t => tokens.push(t),
    });

    expect(tokens).toEqual(['Hello', ' world']);
    // Contract: ordinary prose normalizes to a bare string.
    expect(result).toBe('Hello world');
  });

  it('sends stream:true only when a token sink is supplied', async () => {
    const fetchMock = vi.fn(async () => makeSSEResponse([sse({ choices: [{ delta: { content: 'x' } }] })]));
    vi.stubGlobal('fetch', fetchMock);

    await manager.sendOpenAIMessageWithHistory(provider, [{ role: 'user', content: 'hi' }], null, null, {
      onToken: () => {},
    });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).stream).toBe(true);
  });

  it('skips streaming entirely when no onToken sink is given', async () => {
    const fetchMock = vi.fn(async () =>
      makeJSONResponse({ choices: [{ message: { role: 'assistant', content: 'plain' }, finish_reason: 'stop' }] })
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await manager.sendOpenAIMessageWithHistory(provider, [{ role: 'user', content: 'hi' }], null, null);

    expect(result).toBe('plain');
    // Exactly one request, and it must not have asked for a stream.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).stream).toBeUndefined();
  });

  it('preserves the structured tool-call envelope when streaming', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        makeSSEResponse([
          sse({
            choices: [
              {
                delta: {
                  tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name: 'navigate_to' } }],
                },
              },
            ],
          }),
          sse({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"chr":"chr1"}' } }] } }] }),
          sse({ choices: [{ delta: {}, finish_reason: 'tool_calls' }] }),
          'data: [DONE]\n\n',
        ])
      )
    );

    const result = await manager.sendOpenAIMessageWithHistory(provider, [{ role: 'user', content: 'go' }], null, null, {
      onToken: () => {},
    });

    // Contract: tool calls normalize to an object, never a string.
    expect(typeof result).toBe('object');
    expect(result.tool_calls).toHaveLength(1);
    expect(result.tool_calls[0].function.name).toBe('navigate_to');
    expect(result.finish_reason).toBe('tool_calls');
    expect(result.provider).toBe('openai');
  });

  it('falls back to the non-streaming request when the provider answers with JSON', async () => {
    const fetchMock = vi
      .fn()
      // Provider ignored stream:true and replied with a normal JSON body.
      .mockResolvedValueOnce(
        makeJSONResponse({ choices: [{ message: { role: 'assistant', content: 'fallback' }, finish_reason: 'stop' }] })
      )
      .mockResolvedValueOnce(
        makeJSONResponse({ choices: [{ message: { role: 'assistant', content: 'fallback' }, finish_reason: 'stop' }] })
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await manager.sendOpenAIMessageWithHistory(provider, [{ role: 'user', content: 'hi' }], null, null, {
      onToken: () => {},
    });

    expect(result).toBe('fallback');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).stream).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).stream).toBeUndefined();
  });

  it('clears partial text via onStreamReset when a stream breaks mid-flight', async () => {
    const brokenStream = {
      ok: true,
      status: 200,
      headers: { get: () => 'text/event-stream' },
      body: {
        getReader: () => ({
          read: async () => {
            throw new Error('socket closed');
          },
          cancel: async () => {},
          releaseLock: () => {},
        }),
      },
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(brokenStream)
      .mockResolvedValueOnce(
        makeJSONResponse({ choices: [{ message: { role: 'assistant', content: 'recovered' }, finish_reason: 'stop' }] })
      );
    vi.stubGlobal('fetch', fetchMock);

    const onStreamReset = vi.fn();
    const result = await manager.sendOpenAIMessageWithHistory(provider, [{ role: 'user', content: 'hi' }], null, null, {
      onToken: () => {},
      onStreamReset,
    });

    // Partial text must be discarded so the retry cannot duplicate it.
    expect(onStreamReset).toHaveBeenCalled();
    expect(result).toBe('recovered');
  });

  it('propagates aborts instead of silently retrying', async () => {
    const controller = new AbortController();
    const abortError = new Error('AbortError');
    abortError.name = 'AbortError';

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        controller.abort();
        throw abortError;
      })
    );

    await expect(
      manager.sendOpenAIMessageWithHistory(provider, [{ role: 'user', content: 'hi' }], null, null, {
        onToken: () => {},
        signal: controller.signal,
      })
    ).rejects.toThrow(/AbortError/);
  });

  it('honours the enableStreaming setting being turned off', async () => {
    // Both construction sites pass the app instance as the first constructor
    // argument, so it lands on `genomeBrowser` — reading it from anywhere else
    // would silently ignore the user's setting.
    manager.genomeBrowser = {
      chatManager: {
        chatBoxSettingsManager: {
          getSetting: (key, fallback) => (key === 'enableStreaming' ? false : fallback),
        },
      },
    };

    const fetchMock = vi.fn(async () =>
      makeJSONResponse({ choices: [{ message: { role: 'assistant', content: 'no-stream' }, finish_reason: 'stop' }] })
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await manager.sendOpenAIMessageWithHistory(provider, [{ role: 'user', content: 'hi' }], null, null, {
      onToken: () => {},
    });

    expect(result).toBe('no-stream');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).stream).toBeUndefined();
  });

  it('streams Anthropic tool_use into the structured envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        makeSSEResponse([
          `event: content_block_start\ndata: ${JSON.stringify({
            index: 0,
            content_block: { type: 'tool_use', id: 'toolu_1', name: 'search_genes', input: {} },
          })}\n\n`,
          `event: content_block_delta\ndata: ${JSON.stringify({
            index: 0,
            delta: { type: 'input_json_delta', partial_json: '{"q":"lacZ"}' },
          })}\n\n`,
          `event: content_block_stop\ndata: ${JSON.stringify({ index: 0 })}\n\n`,
          `event: message_delta\ndata: ${JSON.stringify({ delta: { stop_reason: 'tool_use' } })}\n\n`,
        ])
      )
    );

    const anthropicProvider = { ...provider, name: 'Anthropic', baseUrl: 'https://api.anthropic.com' };
    const result = await manager.sendAnthropicMessageWithHistory(
      anthropicProvider,
      [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'find lacZ' },
      ],
      null,
      null,
      { onToken: () => {} }
    );

    expect(typeof result).toBe('object');
    expect(result.provider).toBe('anthropic');
    expect(result.content[0].type).toBe('tool_use');
    expect(result.content[0].input).toEqual({ q: 'lacZ' });
  });

  it('streams Google text through the SSE endpoint', async () => {
    const fetchMock = vi.fn(async () =>
      makeSSEResponse([
        sse({ candidates: [{ content: { parts: [{ text: 'Gene ' }] } }] }),
        sse({ candidates: [{ content: { parts: [{ text: 'found' }] }, finishReason: 'STOP' }] }),
      ])
    );
    vi.stubGlobal('fetch', fetchMock);

    const googleProvider = {
      ...provider,
      name: 'Google',
      baseUrl: 'https://generativelanguage.googleapis.com',
      model: 'gemini-pro',
    };
    const tokens = [];
    const result = await manager.sendGoogleMessageWithHistory(
      googleProvider,
      [{ role: 'user', content: 'hi' }],
      null,
      null,
      { onToken: t => tokens.push(t) }
    );

    expect(fetchMock.mock.calls[0][0]).toContain('streamGenerateContent');
    expect(fetchMock.mock.calls[0][0]).toContain('alt=sse');
    expect(tokens).toEqual(['Gene ', 'found']);
    expect(result).toBe('Gene found');
  });
});
