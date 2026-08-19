/**
 * Two defaults on the critical path.
 *
 * buildSystemMessage() runs once per user message and refetched the MCP system
 * prompt every time — a round-trip before the first token, for content that
 * only changes when the server does.
 *
 * Temperature defaulted to 0.7, a prose-writing value, even though nearly every
 * request carries native tool schemas and is judged on schema-exact arguments.
 */
import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ChatManager = require('../../src/renderer/modules/ChatManager.js');
const LLMConfigManager = require('../../src/renderer/modules/LLMConfigManager.js');

function createChatManager(getPrompt) {
  const cm = Object.create(ChatManager.prototype);
  cm.mcpServerManager = { getPrompt };
  return cm;
}

describe('MCP prompt cache', () => {
  it('fetches a prompt once and serves it from cache afterwards', async () => {
    const getPrompt = vi.fn().mockResolvedValue({ messages: [{ content: 'prompt body' }] });
    const cm = createChatManager(getPrompt);

    const first = await cm.getCachedMcpPrompt('server-1', 'deep-gene-research-agent');
    const second = await cm.getCachedMcpPrompt('server-1', 'deep-gene-research-agent');

    expect(getPrompt).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it('keys the cache by server and prompt name', async () => {
    const getPrompt = vi.fn().mockImplementation(async (serverId, name) => ({ serverId, name }));
    const cm = createChatManager(getPrompt);

    await cm.getCachedMcpPrompt('server-1', 'prompt-a');
    await cm.getCachedMcpPrompt('server-1', 'prompt-b');
    await cm.getCachedMcpPrompt('server-2', 'prompt-a');

    expect(getPrompt).toHaveBeenCalledTimes(3);
  });

  it('refetches after that server is invalidated', async () => {
    const getPrompt = vi.fn().mockResolvedValue({ messages: [] });
    const cm = createChatManager(getPrompt);

    await cm.getCachedMcpPrompt('server-1', 'prompt-a');
    cm.invalidateMcpPromptCache('server-1');
    await cm.getCachedMcpPrompt('server-1', 'prompt-a');

    expect(getPrompt).toHaveBeenCalledTimes(2);
  });

  it('leaves other servers cached when one is invalidated', async () => {
    const getPrompt = vi.fn().mockResolvedValue({ messages: [] });
    const cm = createChatManager(getPrompt);

    await cm.getCachedMcpPrompt('server-1', 'prompt-a');
    await cm.getCachedMcpPrompt('server-2', 'prompt-a');
    cm.invalidateMcpPromptCache('server-1');
    await cm.getCachedMcpPrompt('server-2', 'prompt-a');

    expect(getPrompt).toHaveBeenCalledTimes(2);
  });

  it('clears everything when no server is named', async () => {
    const getPrompt = vi.fn().mockResolvedValue({ messages: [] });
    const cm = createChatManager(getPrompt);

    await cm.getCachedMcpPrompt('server-1', 'prompt-a');
    await cm.getCachedMcpPrompt('server-2', 'prompt-a');
    cm.invalidateMcpPromptCache();
    await cm.getCachedMcpPrompt('server-1', 'prompt-a');

    expect(getPrompt).toHaveBeenCalledTimes(3);
  });

  it('is safe to invalidate before anything was cached', () => {
    expect(() => createChatManager(vi.fn()).invalidateMcpPromptCache('server-1')).not.toThrow();
  });
});

describe('sampling temperature', () => {
  const managerWith = chatboxSettings =>
    new LLMConfigManager({}, { get: (path, fallback) => (path === 'chatboxSettings' ? chatboxSettings : fallback) });

  it('defaults low, for tool selection rather than prose', () => {
    expect(managerWith(null).getTemperature()).toBe(0.3);
  });

  it('respects a configured temperature', () => {
    expect(managerWith({ chatboxLLMTemperature: 0.9 }).getTemperature()).toBe(0.9);
    expect(managerWith({ chatboxLLMTemperature: 0 }).getTemperature()).toBe(0);
  });

  it('lets the benchmark pin temperature 0 per request', () => {
    expect(managerWith(null).getRequestTemperature({ temperatureOverride: 0 })).toBe(0);
  });
});
