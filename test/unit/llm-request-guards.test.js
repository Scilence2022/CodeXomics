/**
 * Every provider request must be cancellable and time-bounded. Before these
 * guards existed only the streaming paths passed an abort signal, so pressing
 * stop during a non-streaming round (or during benchmark automation, which
 * disables streaming) did nothing, and a connection that accepted the request
 * and never answered blocked the round loop forever.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const LLMConfigManager = require('../../src/renderer/modules/LLMConfigManager.js');

function createManager(configValues = {}) {
  const configManager = {
    get: (path, fallback) => (path in configValues ? configValues[path] : fallback),
  };
  return new LLMConfigManager({}, configManager);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('provider request guards', () => {
  it('passes an abort signal to fetch', async () => {
    let seenInit = null;
    vi.stubGlobal('fetch', async (_url, init) => {
      seenInit = init;
      return { ok: true };
    });

    const manager = createManager();
    await manager.fetchWithGuards('https://example.invalid/v1', { method: 'POST' }, {});

    expect(seenInit.signal).toBeInstanceOf(AbortSignal);
    expect(seenInit.method).toBe('POST');
  });

  it('aborts the request when the caller aborts', async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      'fetch',
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => {
            reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }));
          });
        })
    );

    const manager = createManager();
    const pending = manager.fetchWithGuards('https://example.invalid/v1', {}, { signal: controller.signal });
    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('refuses a request whose signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal('fetch', (_url, init) => {
      if (init.signal.aborted) {
        return Promise.reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      }
      return Promise.resolve({ ok: true });
    });

    const manager = createManager();
    await expect(
      manager.fetchWithGuards('https://example.invalid/v1', {}, { signal: controller.signal })
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('reports a timeout as a timeout, not as a user cancellation', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => {
            reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }));
          });
        })
    );

    const manager = createManager({ 'llm.requestTimeoutMs': 5000 });
    const pending = manager.fetchWithGuards('https://example.invalid/v1', {}, {});
    const assertion = expect(pending).rejects.toMatchObject({ name: 'TimeoutError', isTimeout: true });
    await vi.advanceTimersByTimeAsync(5001);
    await assertion;
  });

  it('falls back to the default timeout for an invalid configured value', () => {
    expect(createManager({ 'llm.requestTimeoutMs': 'soon' }).getRequestTimeoutMs()).toBe(180000);
    expect(createManager({ 'llm.requestTimeoutMs': -1 }).getRequestTimeoutMs()).toBe(180000);
    expect(createManager({ 'llm.requestTimeoutMs': 30000 }).getRequestTimeoutMs()).toBe(30000);
  });

  it('leaves no pending timer behind after a successful request', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', async () => ({ ok: true }));

    const manager = createManager({ 'llm.requestTimeoutMs': 5000 });
    await manager.fetchWithGuards('https://example.invalid/v1', {}, {});

    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('makeRequestWithRetry', () => {
  it('retries a retryable status', async () => {
    const manager = createManager();
    manager.calculateRetryDelay = () => 0;
    let attempts = 0;

    const result = await manager.makeRequestWithRetry(
      async () => {
        attempts += 1;
        if (attempts < 2) {
          throw Object.assign(new Error('HTTP 503'), { isRetryable: true, status: 503 });
        }
        return 'response';
      },
      'Test',
      async response => response
    );

    expect(attempts).toBe(2);
    expect(result).toBe('response');
  });

  it('does not retry after the user aborts', async () => {
    const manager = createManager();
    manager.calculateRetryDelay = () => 0;
    let attempts = 0;

    await expect(
      manager.makeRequestWithRetry(
        async () => {
          attempts += 1;
          throw Object.assign(new Error('aborted'), { name: 'AbortError', isRetryable: true });
        },
        'Test',
        async response => response
      )
    ).rejects.toMatchObject({ name: 'AbortError' });

    expect(attempts).toBe(1);
  });

  it('does not retry a timed-out request', async () => {
    const manager = createManager();
    manager.calculateRetryDelay = () => 0;
    let attempts = 0;

    await expect(
      manager.makeRequestWithRetry(
        async () => {
          attempts += 1;
          throw Object.assign(new Error('timeout'), { name: 'TimeoutError', isTimeout: true, isRetryable: true });
        },
        'Test',
        async response => response
      )
    ).rejects.toMatchObject({ isTimeout: true });

    expect(attempts).toBe(1);
  });
});
