/* eslint-disable no-new-func */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

const LLM_CONFIG_MANAGER_PATH = path.join(process.cwd(), 'src/renderer/modules/LLMConfigManager.js');

function loadLLMConfigManager() {
  const code = fs.readFileSync(LLM_CONFIG_MANAGER_PATH, 'utf-8');
  const fn = new Function(`${code}; return LLMConfigManager;`);
  return fn();
}

describe('LLM model selection request routing', () => {
  let LLMConfigManagerClass;

  beforeAll(() => {
    LLMConfigManagerClass = loadLLMConfigManager();
  });

  function createManager() {
    const manager = Object.create(LLMConfigManagerClass.prototype);
    manager.providers = {
      openai: {
        name: 'OpenAI',
        enabled: true,
        model: 'provider-default',
      },
      anthropic: {
        name: 'Anthropic',
        enabled: true,
        model: 'anthropic-default',
      },
    };
    manager.modelTypes = {
      main: {
        provider: 'openai',
        model: 'selected-model',
      },
      task: {
        preferredProviders: ['openai', 'anthropic'],
      },
    };
    return manager;
  }

  it('uses the selected main model for history requests without changing the provider default', async () => {
    const manager = createManager();
    manager.sendOpenAIMessageWithHistory = vi.fn().mockResolvedValue('ok');

    await manager.sendMessageWithHistory([{ role: 'user', content: 'hello' }]);

    expect(manager.sendOpenAIMessageWithHistory).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'selected-model' }),
      expect.any(Array),
      null,
      null,
      {}
    );
    expect(manager.providers.openai.model).toBe('provider-default');
  });

  it('uses the selected main model for single-message requests', async () => {
    const manager = createManager();
    manager.sendOpenAIMessage = vi.fn().mockResolvedValue('ok');

    await manager.sendMessage('hello');

    expect(manager.sendOpenAIMessage).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'selected-model' }),
      'hello',
      null,
      null
    );
  });

  it('honors request-scoped ChatBox provider and model overrides', async () => {
    const manager = createManager();
    manager.sendAnthropicMessageWithHistory = vi.fn().mockResolvedValue('ok');

    await manager.sendMessageWithHistory([{ role: 'user', content: 'hello' }], null, null, {
      providerOverride: 'anthropic',
      modelOverride: 'claude-selected',
    });

    expect(manager.sendAnthropicMessageWithHistory).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-selected' }),
      expect.any(Array),
      null,
      null,
      expect.objectContaining({ providerOverride: 'anthropic', modelOverride: 'claude-selected' })
    );
    expect(manager.providers.anthropic.model).toBe('anthropic-default');
  });

  it('uses the overridden provider default when only the ChatBox provider is selected', () => {
    const manager = createManager();

    expect(manager.getRequestModelSelection('task', { providerOverride: 'anthropic' })).toEqual({
      providerKey: 'anthropic',
      model: 'anthropic-default',
    });
  });

  it('uses the fallback provider default instead of the primary model override', async () => {
    const manager = createManager();
    manager.sendOpenAIMessageWithHistory = vi.fn().mockRejectedValue(new Error('HTTP 503 Service Unavailable'));
    manager.sendAnthropicMessageWithHistory = vi.fn().mockResolvedValue('fallback');

    const result = await manager.sendMessageWithHistory([{ role: 'user', content: 'hello' }]);

    expect(result).toBe('fallback');
    expect(manager.sendAnthropicMessageWithHistory).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'anthropic-default' }),
      expect.any(Array),
      null,
      null,
      {}
    );
  });

  it('does not apply a model selected for a disabled provider to an automatic fallback', () => {
    const manager = createManager();
    manager.providers.openai.enabled = false;

    expect(manager.getProviderForModelType('task')).toBe('anthropic');
    expect(manager.getModelForModelType('task')).toBe('anthropic-default');
  });
});

describe('ChatManager.getChatboxModelSelection', () => {
  const CHAT_MANAGER_PATH = path.join(process.cwd(), 'src/renderer/modules/ChatManager.js');

  function loadMethod() {
    const source = fs.readFileSync(CHAT_MANAGER_PATH, 'utf8');
    const start = source.indexOf('\n  getChatboxModelSelection() {');
    if (start === -1) throw new Error('getChatboxModelSelection not found');
    const end = source.indexOf('\n  }\n', start);
    if (end === -1) throw new Error('getChatboxModelSelection not bounded');
    // eslint-disable-next-line no-new-func -- loads the real source method into an isolated class
    return new Function(`return class Extracted {\n${source.slice(start + 1, end + 4)}\n}`)();
  }

  function makeChatManager(resolvedSelection, throwOnResolve = false) {
    const Extracted = loadMethod();
    const chatManager = new Extracted();
    chatManager.chatBoxSettingsManager = {
      getSetting: vi.fn((key, fallback) => {
        const settings = { chatboxModelType: 'auto', chatboxLLMProvider: 'deepseek', chatboxLLMModel: 'auto' };
        return settings[key] ?? fallback;
      }),
    };
    chatManager.llmConfigManager = {
      getRequestModelSelection: throwOnResolve
        ? vi.fn().mockImplementation(() => {
            throw new Error('Provider disabled');
          })
        : vi.fn().mockReturnValue(resolvedSelection),
    };
    return chatManager;
  }

  it('resolves through the request-scoped ChatBox overrides', () => {
    const chatManager = makeChatManager({ providerKey: 'deepseek', model: 'deepseek-v4-flash' });

    expect(chatManager.getChatboxModelSelection()).toEqual({
      providerKey: 'deepseek',
      model: 'deepseek-v4-flash',
    });
    expect(chatManager.llmConfigManager.getRequestModelSelection).toHaveBeenCalledWith('task', {
      modelType: 'auto',
      providerOverride: 'deepseek',
      modelOverride: 'auto',
    });
  });

  it('returns null when an explicit provider override is invalid', () => {
    const chatManager = makeChatManager(null, true);

    expect(chatManager.getChatboxModelSelection()).toBeNull();
  });

  it('returns null when the LLM config manager is unavailable', () => {
    const Extracted = loadMethod();
    const chatManager = new Extracted();
    chatManager.chatBoxSettingsManager = { getSetting: vi.fn() };

    expect(chatManager.getChatboxModelSelection()).toBeNull();
  });
});
