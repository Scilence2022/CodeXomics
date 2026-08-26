/**
 * Seven of the nine providers speak the same OpenAI /chat/completions dialect,
 * but each had its own copy of the request path. The copies had drifted:
 * DeepSeek discarded the provider's error body, only OpenAI and SiliconFlow
 * retried a 429, and SiliconFlow carried response validation the shared
 * normalizer already does. None of that was a deliberate per-provider decision.
 *
 * These pin the behaviour every OpenAI-compatible provider should share, plus
 * the deviations that are real (OpenRouter's attribution headers and model
 * fallback, the local endpoint's optional key).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const LLMConfigManager = require('../../src/renderer/modules/LLMConfigManager.js');

const PROVIDERS = [
  { key: 'openai', method: 'sendOpenAIMessageWithHistory' },
  { key: 'deepseek', method: 'sendDeepSeekMessageWithHistory' },
  { key: 'siliconflow', method: 'sendSiliconFlowMessageWithHistory' },
  { key: 'openrouter', method: 'sendOpenRouterMessageWithHistory' },
  { key: 'minimax', method: 'sendMinimaxMessageWithHistory' },
  { key: 'minimax_cn', method: 'sendMinimax_cnMessageWithHistory' },
  { key: 'zhongkeyu', method: 'sendZhongkeyuMessageWithHistory' },
  { key: 'local', method: 'sendLocalMessageWithHistory' },
];

function createManager() {
  const manager = new LLMConfigManager({}, { get: (_path, fallback) => fallback });
  manager.calculateRetryDelay = () => 0;
  manager.showNotification = () => {};
  return manager;
}

const provider = (overrides = {}) => ({
  baseUrl: 'https://api.example.invalid/v1',
  apiKey: 'secret-key',
  model: 'test-model',
  ...overrides,
});

const okResponse = (message = { role: 'assistant', content: 'hello' }) => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  json: async () => ({ choices: [{ message, finish_reason: 'stop' }] }),
  text: async () => '',
});

const errorResponse = (status, statusText, body = '') => ({
  ok: false,
  status,
  statusText,
  json: async () => ({}),
  text: async () => body,
});

const history = [
  { role: 'system', content: 'system prompt' },
  { role: 'user', content: 'hi' },
];

function stubFetch(responses) {
  const calls = [];
  const queue = Array.isArray(responses) ? [...responses] : [responses];
  vi.stubGlobal('fetch', async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return queue.length > 1 ? queue.shift() : queue[0];
  });
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe.each(PROVIDERS)('$key provider request path', ({ key, method }) => {
  it('posts the OpenAI-compatible payload to /chat/completions', async () => {
    const calls = stubFetch(okResponse());

    await createManager()[method](provider(), history, null, null, {});

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.example.invalid/v1/chat/completions');
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].body.model).toBe('test-model');
    expect(calls[0].body.messages).toEqual(history);
  });

  it('sends the api key as a bearer token', async () => {
    const calls = stubFetch(okResponse());

    await createManager()[method](provider(), history, null, null, {});

    expect(calls[0].init.headers.Authorization).toBe('Bearer secret-key');
    expect(calls[0].init.headers['Content-Type']).toBe('application/json');
  });

  it('runs under the caller abort signal', async () => {
    const calls = stubFetch(okResponse());

    await createManager()[method](provider(), history, null, null, {});

    expect(calls[0].init.signal).toBeInstanceOf(AbortSignal);
  });

  it('includes the provider error body in the thrown error', async () => {
    stubFetch(errorResponse(400, 'Bad Request', '{"error":{"message":"context_length_exceeded"}}'));

    await expect(createManager()[method](provider(), history, null, null, {})).rejects.toThrow(
      /context_length_exceeded/
    );
  });

  it('retries a rate-limited request', async () => {
    const calls = stubFetch([errorResponse(429, 'Too Many Requests', 'slow down'), okResponse()]);

    const result = await createManager()[method](provider(), history, null, null, {});

    expect(calls).toHaveLength(2);
    expect(result).toContain('hello');
  });

  it('does not retry a client error', async () => {
    const calls = stubFetch(errorResponse(400, 'Bad Request', 'nope'));

    await expect(createManager()[method](provider(), history, null, null, {})).rejects.toThrow(/HTTP 400/);
    expect(calls).toHaveLength(1);
  });

  it('passes native tool schemas through when they are supplied', async () => {
    const calls = stubFetch(okResponse());
    const tools = [
      {
        type: 'function',
        function: { name: 'zoom_in', description: 'Zoom', parameters: { type: 'object', properties: {} } },
      },
    ];

    await createManager()[method](provider(), history, null, null, { tools, nativeFunctionCalling: true });

    expect(calls[0].body.tools).toHaveLength(1);
    expect(calls[0].body.tools[0].function.name).toBe('zoom_in');
    expect(calls[0].body.tool_choice).toBe('auto');
  });

  it(`tags the normalized response as ${key} when it carries protocol state`, async () => {
    stubFetch(
      okResponse({
        role: 'assistant',
        content: null,
        tool_calls: [{ id: 'c1', type: 'function', function: { name: 'zoom_in', arguments: '{}' } }],
      })
    );

    const result = await createManager()[method](provider(), history, null, null, {});

    expect(result.provider).toBe(key);
  });
});

describe('provider-specific deviations', () => {
  it('sends OpenRouter attribution headers', async () => {
    const calls = stubFetch(okResponse());

    await createManager().sendOpenRouterMessageWithHistory(provider(), history, null, null, {});

    expect(calls[0].init.headers['HTTP-Referer']).toBe(window.location.origin);
    expect(calls[0].init.headers['X-Title']).toBe('GenomeExplorer');
  });

  it('retries OpenRouter with a fallback model when the requested one is unavailable', async () => {
    const calls = stubFetch([errorResponse(404, 'Not Found', 'no such model'), okResponse()]);
    const manager = createManager();
    manager.getOpenRouterFallbackModel = () => 'fallback-model';

    const result = await manager.sendOpenRouterMessageWithHistory(
      provider({ model: 'missing-model' }),
      history,
      null,
      null,
      {}
    );

    expect(calls).toHaveLength(2);
    expect(calls[0].body.model).toBe('missing-model');
    expect(calls[1].body.model).toBe('fallback-model');
    expect(result).toContain('hello');
  });

  it('does not use the OpenRouter fallback model when fallback is disabled', async () => {
    const calls = stubFetch(errorResponse(404, 'Not Found', 'no such model'));
    const manager = createManager();
    manager.getOpenRouterFallbackModel = () => 'fallback-model';

    await expect(
      manager.sendOpenRouterMessageWithHistory(provider(), history, null, null, { disableFallback: true })
    ).rejects.toThrow(/HTTP 404/);
    expect(calls).toHaveLength(1);
  });

  it('omits the auth header for a local endpoint without a key', async () => {
    const calls = stubFetch(okResponse());

    await createManager().sendLocalMessageWithHistory(
      provider({ apiKey: '', baseUrl: 'http://localhost:11434/v1' }),
      history,
      null,
      null,
      {}
    );

    expect(calls[0].init.headers.Authorization).toBeUndefined();
    expect(calls[0].init.headers['Content-Type']).toBe('application/json');
  });

  it('asks the local endpoint for a non-streaming completion', async () => {
    const calls = stubFetch(okResponse());

    await createManager().sendLocalMessageWithHistory(provider(), history, null, null, {});

    expect(calls[0].body.stream).toBe(false);
  });

  it('explains an empty local completion instead of returning a blank answer', async () => {
    stubFetch(okResponse({ role: 'assistant', content: '' }));

    const result = await createManager().sendLocalMessageWithHistory(provider(), history, null, null, {});

    expect(result).toContain('empty response');
  });
});

/**
 * Anthropic and Gemini need their own request shape, but not their own error or
 * retry policy. Anthropic used to throw a bare "HTTP 400" with the provider's
 * reason discarded, and neither retried a rate limit the way every
 * OpenAI-compatible provider did.
 */
describe('Anthropic and Gemini share the request policy', () => {
  const anthropicOk = () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({ content: [{ type: 'text', text: 'hello' }], stop_reason: 'end_turn' }),
    text: async () => '',
  });
  const googleOk = () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({
      candidates: [{ content: { parts: [{ text: 'hello' }] }, finishReason: 'STOP' }],
    }),
    text: async () => '',
  });

  it('includes the Anthropic error body', async () => {
    stubFetch(errorResponse(400, 'Bad Request', '{"error":{"message":"max_tokens too large"}}'));

    await expect(createManager().sendAnthropicMessageWithHistory(provider(), history, null, null, {})).rejects.toThrow(
      /max_tokens too large/
    );
  });

  it('retries a rate-limited Anthropic request', async () => {
    const calls = stubFetch([errorResponse(429, 'Too Many Requests', 'slow down'), anthropicOk()]);

    const result = await createManager().sendAnthropicMessageWithHistory(provider(), history, null, null, {});

    expect(calls).toHaveLength(2);
    expect(result).toContain('hello');
  });

  it('retries a rate-limited Gemini request', async () => {
    const calls = stubFetch([errorResponse(429, 'Too Many Requests', 'slow down'), googleOk()]);

    const result = await createManager().sendGoogleMessageWithHistory(provider(), history, null, null, {});

    expect(calls).toHaveLength(2);
    expect(result).toContain('hello');
  });

  it('sends the Gemini key as a header, never in the URL', async () => {
    const calls = stubFetch(googleOk());

    await createManager().sendGoogleMessageWithHistory(provider(), history, null, null, {});

    expect(calls[0].url).not.toContain('secret-key');
    expect(calls[0].url).not.toContain('key=');
    expect(calls[0].init.headers['x-goog-api-key']).toBe('secret-key');
  });
});
