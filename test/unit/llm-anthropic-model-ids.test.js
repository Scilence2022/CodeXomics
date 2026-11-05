/**
 * Claude model ids. The Anthropic API names models with dashes
 * ("claude-sonnet-4-6"); earlier releases shipped dotted ids
 * ("claude-sonnet-4.6") the API does not know, and those survive in saved
 * configurations.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const LLMConfigManager = require('../../src/renderer/modules/LLMConfigManager.js');
const ChatBoxSettingsManager = require('../../src/renderer/modules/ChatBoxSettingsManager.js');

const DOTTED_CLAUDE_ID = /claude-(opus|sonnet|haiku)-\d+\.\d+/;

describe('Claude model ids', () => {
  it.each([
    ['claude-sonnet-4.6', 'claude-sonnet-4-6'],
    ['claude-opus-4.7', 'claude-opus-4-7'],
    ['claude-haiku-4.5', 'claude-haiku-4-5'],
    ['claude-sonnet-4-6', 'claude-sonnet-4-6'],
    ['claude-haiku-4-5-20251001', 'claude-haiku-4-5-20251001'],
    ['claude-3-5-sonnet-20241022', 'claude-3-5-sonnet-20241022'],
    ['gpt-5.5', 'gpt-5.5'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(LLMConfigManager.normalizeAnthropicModelId(input)).toBe(expected);
  });

  it('ships only ids the Anthropic API accepts', () => {
    const manager = new LLMConfigManager({}, null);
    expect(manager.providers.anthropic.availableModels.filter(id => DOTTED_CLAUDE_ID.test(id))).toEqual([]);
    expect(manager.providers.anthropic.model).toBe('claude-sonnet-4-6');

    const markup = fs.readFileSync(path.join(process.cwd(), 'src/renderer/index.html'), 'utf-8');
    const anthropicSelect = /<select id="anthropicModel"[\s\S]*?<\/select>/.exec(markup)[0];
    expect(anthropicSelect).not.toMatch(DOTTED_CLAUDE_ID);
  });

  it('migrates dotted ids in a saved configuration', () => {
    const saved = {
      providers: { anthropic: { name: 'Anthropic', apiKey: 'test', enabled: true, model: 'claude-opus-4.7' } },
      modelTypes: {
        main: { provider: 'anthropic', model: 'claude-haiku-4.5' },
        task: { provider: 'auto', model: 'auto', preferredModels: { anthropic: 'claude-sonnet-4.6' } },
      },
    };
    const manager = new LLMConfigManager({}, { get: (key, fallback) => (key === 'llm' ? saved : fallback) });

    manager.loadConfiguration();

    expect(manager.providers.anthropic.model).toBe('claude-opus-4-7');
    expect(manager.modelTypes.main.model).toBe('claude-haiku-4-5');
    expect(manager.modelTypes.task.preferredModels.anthropic).toBe('claude-sonnet-4-6');
  });

  it('never sends a dotted id to the Anthropic API', () => {
    const manager = new LLMConfigManager({}, { get: (_key, fallback) => fallback });
    const payload = manager.buildAnthropicPayload({ model: 'claude-sonnet-4.6' }, [{ role: 'user', content: 'hi' }]);
    expect(payload.model).toBe('claude-sonnet-4-6');
  });

  it('migrates a dotted ChatBox model override', async () => {
    const saved = { chatboxLLMProvider: 'anthropic', chatboxLLMModel: 'claude-sonnet-4.6' };
    const configManager = {
      get: (key, fallback) => (key === 'chatboxSettings' ? saved : fallback),
      set: async () => {},
    };
    const settings = new ChatBoxSettingsManager(configManager);
    await settings._initPromise;
    expect(settings.getSetting('chatboxLLMModel')).toBe('claude-sonnet-4-6');
  });
});
