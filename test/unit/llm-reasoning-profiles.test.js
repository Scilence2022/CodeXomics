/**
 * The ChatBox thinking level: which models expose one, how each provider
 * spells it in the request, and the composer control that sets it.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const LLMReasoningProfiles = require('../../src/renderer/modules/LLMReasoningProfiles.js');
const LLMConfigManager = require('../../src/renderer/modules/LLMConfigManager.js');
const { createAgentLoopHarness } = require('../helpers/agent-loop-harness.js');

new Function(fs.readFileSync(path.join(process.cwd(), 'src/renderer/modules/ChatModelSelector.js'), 'utf-8'))();
const ChatModelSelector = window.ChatModelSelector;

const createManager = (chatboxSettings = {}) =>
  new LLMConfigManager({}, { get: (key, fallback) => (key === 'chatboxSettings' ? chatboxSettings : fallback) });

const history = [
  { role: 'system', content: 'You are CodeXomics.' },
  { role: 'user', content: 'jump to lysC' },
];
const tools = [
  { type: 'function', function: { name: 'jump_to_gene', parameters: { type: 'object', properties: {} } } },
];

function anthropicPayload(model, reasoningEffort, options = {}) {
  return createManager().buildAnthropicPayload({ model }, options.history || history, {
    tools,
    reasoningEffort,
    ...options,
  });
}

describe('which models expose a thinking control', () => {
  it.each([
    ['anthropic', 'claude-sonnet-4.6', ['off', 'low', 'medium', 'high']],
    ['anthropic', 'claude-opus-5-5', ['low', 'medium', 'high']],
    ['anthropic', 'claude-sonnet-5-5', ['off', 'low', 'medium', 'high']],
    ['anthropic', 'claude-haiku-4-5-20251001', ['off', 'low', 'medium', 'high']],
    ['google', 'gemini-3.1-pro', ['low', 'medium', 'high']],
    ['google', 'gemini-3.5-flash', ['off', 'low', 'medium', 'high']],
    ['openai', 'gpt-5.5', ['low', 'medium', 'high']],
    ['deepseek', 'deepseek-chat', ['off', 'low', 'medium', 'high']],
    ['siliconflow', 'Qwen/Qwen3.5-39B-A17B', ['off', 'low', 'medium', 'high']],
    ['openrouter', 'anthropic/claude-sonnet-4.6', ['off', 'low', 'medium', 'high']],
  ])('%s %s offers %j', (providerKey, model, levels) => {
    expect(LLMReasoningProfiles.getProfile(providerKey, model).levels).toEqual(levels);
  });

  it.each([
    ['anthropic', 'claude-3-5-sonnet-20241022'],
    ['openai', 'gpt-5.5-instant'],
    ['openai', 'gpt-realtime-2'],
    ['deepseek', 'deepseek-reasoner'],
    ['siliconflow', 'Qwen/Qwen3-235B-A22B-Thinking-2507'],
    ['minimax', 'MiniMax-M2.7'],
    ['local', 'qwen3:8b'],
  ])('%s %s has none the app can set', (providerKey, model) => {
    expect(LLMReasoningProfiles.getProfile(providerKey, model)).toBeNull();
  });

  it('treats a level the model does not accept as the default', () => {
    expect(LLMReasoningProfiles.resolveLevel('anthropic', 'claude-opus-5-5', 'off')).toBe('default');
    expect(LLMReasoningProfiles.resolveLevel('anthropic', 'claude-opus-5-5', 'high')).toBe('high');
    expect(LLMReasoningProfiles.resolveLevel('anthropic', 'claude-opus-5-5', 'bogus')).toBe('default');
  });
});

describe('Anthropic requests', () => {
  it('sends adaptive thinking with an effort level and drops temperature', () => {
    const payload = anthropicPayload('claude-sonnet-4.6', 'high');

    expect(payload.thinking).toEqual({ type: 'adaptive' });
    expect(payload.output_config).toEqual({ effort: 'high' });
    expect(payload).not.toHaveProperty('temperature');
    expect(payload.max_tokens).toBe(16384);
  });

  it('asks newer models for summarized thinking so the panel has text to show', () => {
    expect(anthropicPayload('claude-opus-4-8', 'medium').thinking).toEqual({ type: 'adaptive', display: 'summarized' });
  });

  it('never sends temperature to a model that rejects sampling parameters', () => {
    const payload = anthropicPayload('claude-opus-4-7', 'default');
    expect(payload).not.toHaveProperty('temperature');
    expect(payload).not.toHaveProperty('thinking');
    expect(anthropicPayload('claude-sonnet-4.6', 'default')).toHaveProperty('temperature');
  });

  it('turns thinking off the way each model allows', () => {
    expect(anthropicPayload('claude-sonnet-5-5', 'off').thinking).toEqual({ type: 'between_tools' });
    expect(anthropicPayload('claude-opus-5', 'off').thinking).toEqual({ type: 'disabled' });
    expect(anthropicPayload('claude-sonnet-4.6', 'off')).not.toHaveProperty('thinking');
    expect(anthropicPayload('claude-opus-5-5', 'off')).not.toHaveProperty('thinking');
  });

  it('gives budget-thinking models a token budget below max_tokens', () => {
    const payload = anthropicPayload('claude-haiku-4.5', 'medium');
    expect(payload.thinking).toEqual({ type: 'enabled', budget_tokens: 4096 });
    expect(payload.max_tokens).toBeGreaterThan(4096);
  });

  it('runs a budget-thinking round without thinking when the tool turn it continues has none', () => {
    const toolTurn = [
      ...history,
      {
        role: 'assistant',
        content: null,
        tool_calls: [{ id: 't1', type: 'function', function: { name: 'jump_to_gene', arguments: '{}' } }],
      },
      { role: 'tool', tool_call_id: 't1', name: 'jump_to_gene', content: '{}' },
    ];
    expect(anthropicPayload('claude-haiku-4.5', 'high', { history: toolTurn })).not.toHaveProperty('thinking');
  });

  it('leaves thinking off when a specific tool is forced', () => {
    expect(anthropicPayload('claude-sonnet-4.6', 'high', { toolChoice: 'any' })).not.toHaveProperty('thinking');
  });
});

describe('OpenAI-compatible requests', () => {
  const build = (providerKey, model, reasoningEffort) =>
    createManager().buildOpenAICompatiblePayload({ model }, history, { reasoningEffort }, {}, providerKey);

  it('sends reasoning_effort to an OpenAI reasoning model with its token parameter', () => {
    const payload = build('openai', 'gpt-5.5', 'low');
    expect(payload.reasoning_effort).toBe('low');
    expect(payload.max_completion_tokens).toBe(8192);
    expect(payload).not.toHaveProperty('max_tokens');
    expect(payload).not.toHaveProperty('temperature');
  });

  it('leaves a non-reasoning model and the default level untouched', () => {
    expect(build('openai', 'gpt-5.5-instant', 'high')).not.toHaveProperty('reasoning_effort');
    const payload = build('openai', 'gpt-5.5', 'default');
    expect(payload).not.toHaveProperty('reasoning_effort');
    expect(payload).toHaveProperty('max_tokens');
  });

  it('maps the level onto OpenRouter, DeepSeek and SiliconFlow', () => {
    expect(build('openrouter', 'openai/gpt-5.5', 'off').reasoning).toEqual({ enabled: false });
    expect(build('openrouter', 'openai/gpt-5.5', 'medium').reasoning).toEqual({ effort: 'medium' });
    expect(build('deepseek', 'deepseek-chat', 'high').thinking).toEqual({ type: 'enabled' });
    expect(build('deepseek', 'deepseek-chat', 'off').thinking).toEqual({ type: 'disabled' });
    expect(build('deepseek', 'deepseek-reasoner', 'off')).not.toHaveProperty('thinking');
    expect(build('siliconflow', 'Qwen/Qwen3-8B', 'low')).toMatchObject({
      enable_thinking: true,
      thinking_budget: 2048,
    });
    expect(build('siliconflow', 'Qwen/Qwen3-8B', 'off')).toMatchObject({ enable_thinking: false });
  });

  it('applies the level to the streaming request too', () => {
    const payload = createManager().buildOpenAICompatiblePayload(
      { model: 'gpt-5.5' },
      history,
      { reasoningEffort: 'high' },
      { stream: true },
      'openai'
    );
    expect(payload).toMatchObject({ stream: true, reasoning_effort: 'high' });
  });
});

describe('Gemini requests', () => {
  const build = (model, reasoningEffort) => createManager().buildGooglePayload({ model }, history, { reasoningEffort });

  it('sends a thinking level to Gemini 3 and a token budget to Gemini 2.5', () => {
    expect(build('gemini-3.1-pro', 'high').generationConfig.thinkingConfig).toEqual({
      thinkingLevel: 'high',
      includeThoughts: true,
    });
    expect(build('gemini-2.5-pro', 'low').generationConfig.thinkingConfig).toEqual({
      thinkingBudget: 2048,
      includeThoughts: true,
    });
  });

  it('turns thinking off only where the model allows it', () => {
    expect(build('gemini-2.5-flash', 'off').generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
    expect(build('gemini-3.5-flash', 'off').generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'minimal' });
    expect(build('gemini-3.1-pro', 'off').generationConfig).not.toHaveProperty('thinkingConfig');
  });
});

describe('output token sizing', () => {
  it('raises the configured limit while thinking and reserves it for trimming', () => {
    const manager = createManager({ chatboxLLMMaxTokens: 4000 });
    expect(manager.getRequestOutputTokens('anthropic', 'claude-sonnet-4.6', 'default')).toBe(4000);
    expect(manager.getRequestOutputTokens('anthropic', 'claude-sonnet-4.6', 'medium')).toBe(12288);
    expect(manager.getRequestOutputTokens('local', 'qwen3:8b', 'high', { baseUrl: 'http://example' })).toBe(4000);
  });

  it('keeps a configured limit that is already higher', () => {
    const manager = createManager({ chatboxLLMMaxTokens: 30000 });
    expect(manager.getRequestOutputTokens('anthropic', 'claude-sonnet-4.6', 'high')).toBe(30000);
  });
});

describe('the ChatBox request', () => {
  it('carries the thinking level from ChatBox settings', async () => {
    const harness = createAgentLoopHarness({ responses: ['Done.'] });
    harness.chatManager.chatBoxSettingsManager = {
      getSetting: (key, fallback) => (key === 'chatboxReasoningEffort' ? 'high' : fallback),
    };

    await harness.send('what is lysC?');

    expect(harness.lastOptions.reasoningEffort).toBe('high');
  });

  it('lets an oracle-assisted benchmark run override it', async () => {
    const harness = createAgentLoopHarness({ responses: ['Done.'] });
    harness.chatManager.chatBoxSettingsManager = {
      getSetting: (key, fallback) => (key === 'chatboxReasoningEffort' ? 'high' : fallback),
    };
    harness.chatManager.benchmarkAutomationActive = true;
    harness.chatManager.benchmarkHarnessProfile = { reasoningEffort: 'default' };

    await harness.send('what is lysC?');

    expect(harness.lastOptions.reasoningEffort).toBe('default');
  });
});

describe('ChatBox thinking control', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <select id="chatModelSelect"><option value="auto::auto">Auto</option></select>
      <div id="chatReasoningPicker" hidden><select id="chatReasoningSelect"></select></div>
    `;
  });

  function createSelector(settingsValues = {}) {
    const llmConfigManager = createManager();
    llmConfigManager.providers.anthropic.enabled = true;
    llmConfigManager.providers.anthropic.apiKey = 'test';
    llmConfigManager.providers.local.enabled = true;
    llmConfigManager.modelTypes.main = { provider: 'anthropic', model: 'auto' };
    const values = {
      chatboxLLMProvider: 'auto',
      chatboxLLMModel: 'auto',
      chatboxReasoningEffort: 'default',
      ...settingsValues,
    };
    const chatBoxSettingsManager = {
      values,
      getSetting: (key, fallback) => (key in values ? values[key] : fallback),
      setSetting: vi.fn(async (key, value) => {
        values[key] = value;
      }),
    };
    return { selector: new ChatModelSelector({ llmConfigManager, chatBoxSettingsManager }), chatBoxSettingsManager };
  }

  const options = select => Array.from(select.options).map(option => [option.value, option.disabled]);

  it('appears for a model with a thinking control and offers its levels', () => {
    const { selector } = createSelector();

    expect(document.getElementById('chatReasoningPicker').hidden).toBe(false);
    expect(options(selector.reasoningSelect)).toEqual([
      ['default', false],
      ['off', false],
      ['low', false],
      ['medium', false],
      ['high', false],
    ]);
  });

  it('greys out a level the model refuses and says the saved one does not apply', () => {
    const { selector } = createSelector({
      chatboxLLMProvider: 'anthropic',
      chatboxLLMModel: 'claude-opus-5-5',
      chatboxReasoningEffort: 'off',
    });

    expect(options(selector.reasoningSelect)[1]).toEqual(['off', true]);
    expect(selector.reasoningSelect.value).toBe('default');
    expect(selector.reasoningSelect.title).toContain('does not apply');
  });

  it('hides for a model without one', () => {
    createSelector({ chatboxLLMProvider: 'local', chatboxLLMModel: 'qwen3:8b' });
    expect(document.getElementById('chatReasoningPicker').hidden).toBe(true);
  });

  it('persists the chosen level', async () => {
    const { selector, chatBoxSettingsManager } = createSelector();
    selector.reasoningSelect.value = 'medium';

    await selector.applyReasoningLevel();

    expect(chatBoxSettingsManager.values.chatboxReasoningEffort).toBe('medium');
  });
});
