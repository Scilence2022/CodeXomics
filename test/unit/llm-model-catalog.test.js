/* eslint-disable no-new-func */
/**
 * The model catalog every picker builds from: friendly labels from the shipped
 * markup, custom models entered through "Other", and the ChatBox composer
 * picker that reports what Auto resolves to.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = relative => fs.readFileSync(path.join(process.cwd(), relative), 'utf-8');

const LLMConfigManagerClass = new Function(
  `${read('src/renderer/modules/LLMConfigManager.js')}; return LLMConfigManager;`
)();
new Function(read('src/renderer/modules/ChatModelSelector.js'))();
const ChatModelSelector = window.ChatModelSelector;

function renderMarkup() {
  document.body.innerHTML = `
    <select id="anthropicModel">
      <option value="claude-sonnet-4.6">Claude Sonnet 4.6 (Balanced - $3/$15 per M)</option>
      <option value="claude-haiku-4.5">Claude Haiku 4.5 (Fast - $0.25/$1.25 per M)</option>
      <option value="other">Other (specify below)</option>
    </select>
    <select id="openaiModel">
      <option value="gpt-5.5">GPT-5.5 (Thinking / Standard - $5/$30 per M)</option>
      <option value="other">Other (specify below)</option>
    </select>
    <select id="mainProvider">
      <option value="auto">Auto</option>
      <option value="anthropic">Anthropic</option>
      <option value="openai">OpenAI</option>
    </select>
    <select id="mainModel"><option value="auto">Auto</option></select>
    <select id="chatModelSelect"><option value="auto::auto">Auto</option></select>
  `;
}

function createManager() {
  const manager = Object.create(LLMConfigManagerClass.prototype);
  manager.staticModelOptionsHtml = {};
  manager.providers = {
    anthropic: {
      name: 'Anthropic',
      enabled: true,
      model: 'claude-sonnet-4.6',
      availableModels: ['claude-sonnet-4.6', 'claude-haiku-4.5'],
    },
    openai: {
      name: 'OpenAI',
      enabled: true,
      model: 'my-finetuned-gpt',
      availableModels: ['gpt-5.5'],
    },
    google: { name: 'Google', enabled: false, model: 'gemini-3.5-flash', availableModels: ['gemini-3.5-flash'] },
  };
  manager.modelTypes = { main: { provider: 'anthropic', model: 'auto' }, task: { preferredProviders: ['anthropic'] } };
  return manager;
}

function createSettings(initial = {}) {
  const values = { chatboxLLMProvider: 'auto', chatboxLLMModel: 'auto', chatboxModelType: 'auto', ...initial };
  return {
    values,
    getSetting: (key, fallback) => (key in values ? values[key] : fallback),
    setSetting: vi.fn(async (key, value) => {
      values[key] = value;
      return true;
    }),
  };
}

describe('LLMConfigManager model catalog', () => {
  beforeEach(renderMarkup);

  it('labels models from the shipped markup and lists only enabled providers by default', () => {
    const catalog = createManager().getModelCatalog();

    expect(catalog.map(entry => entry.providerKey)).toEqual(['anthropic', 'openai']);
    const sonnet = catalog[0].models.find(model => model.id === 'claude-sonnet-4.6');
    expect(sonnet).toMatchObject({
      label: 'Claude Sonnet 4.6 (Balanced - $3/$15 per M)',
      shortLabel: 'Claude Sonnet 4.6',
      source: 'builtin',
    });
  });

  it('includes a provider default entered through "Other" as a custom model', () => {
    const openai = createManager()
      .getModelCatalog()
      .find(entry => entry.providerKey === 'openai');

    expect(openai.models.map(model => [model.id, model.source])).toEqual([
      ['gpt-5.5', 'builtin'],
      ['my-finetuned-gpt', 'custom'],
    ]);
  });

  it('includes disabled providers only on request', () => {
    const catalog = createManager().getModelCatalog({ includeDisabled: true });
    expect(catalog.find(entry => entry.providerKey === 'google')).toMatchObject({ enabled: false });
  });

  it('marks models from a provider refresh as remote and keeps shipped labels for them', () => {
    const manager = createManager();
    manager.providers.anthropic.modelsSource = 'remote';
    manager.providers.anthropic.availableModels = ['claude-sonnet-4.6', 'claude-new-model'];

    const models = manager.getModelCatalog().find(entry => entry.providerKey === 'anthropic').models;
    expect(models[0]).toMatchObject({ shortLabel: 'Claude Sonnet 4.6', source: 'remote' });
    expect(models[1]).toMatchObject({ id: 'claude-new-model', label: 'claude-new-model', source: 'remote' });
  });

  it('builds the Default Model tab from the same catalog', () => {
    const manager = createManager();
    manager.showProviderWarning = vi.fn();
    document.getElementById('mainProvider').value = 'openai';

    manager.updateModelTypeOptions('main');

    const options = Array.from(document.getElementById('mainModel').options).map(option => [
      option.value,
      option.textContent,
    ]);
    expect(options).toEqual([
      ['auto', 'Auto (Use provider default)'],
      ['gpt-5.5', 'GPT-5.5 (Thinking / Standard - $5/$30 per M)'],
      ['my-finetuned-gpt', 'my-finetuned-gpt (custom)'],
      ['custom', 'Custom Model Name'],
    ]);
  });
});

describe('ChatModelSelector', () => {
  beforeEach(renderMarkup);

  function createSelector(settingsValues) {
    const llmConfigManager = createManager();
    const chatBoxSettingsManager = createSettings(settingsValues);
    const selector = new ChatModelSelector({ llmConfigManager, chatBoxSettingsManager });
    return { selector, llmConfigManager, chatBoxSettingsManager };
  }

  it('names the model Auto resolves to', () => {
    const { selector } = createSelector();
    const auto = selector.select.querySelector('option[value="auto::auto"]');

    expect(auto.textContent).toBe('Auto · Claude Sonnet 4.6');
    expect(auto.title).toContain('Anthropic / Claude Sonnet 4.6 (Balanced - $3/$15 per M)');
  });

  it('shows short labels, with the full label and id in the tooltip', () => {
    const { selector } = createSelector();
    const option = selector.select.querySelector('option[value="anthropic::claude-haiku-4.5"]');

    expect(option.textContent).toBe('Claude Haiku 4.5');
    expect(option.title).toBe('Claude Haiku 4.5 (Fast - $0.25/$1.25 per M) — claude-haiku-4.5');
  });

  it('offers custom models and keeps a stored model a refresh dropped', () => {
    const { selector } = createSelector({ chatboxLLMProvider: 'anthropic', chatboxLLMModel: 'claude-retired' });

    expect(selector.select.querySelector('option[value="openai::my-finetuned-gpt"]').textContent).toBe(
      'my-finetuned-gpt (custom)'
    );
    expect(selector.select.value).toBe('anthropic::claude-retired');
  });

  it('falls back to Auto when the stored provider is disabled', () => {
    const { selector } = createSelector({ chatboxLLMProvider: 'google', chatboxLLMModel: 'gemini-3.5-flash' });
    expect(selector.select.value).toBe('auto::auto');
  });

  it('persists a selection as provider and model settings', async () => {
    const { selector, chatBoxSettingsManager } = createSelector();
    selector.select.value = 'openai::gpt-5.5';

    await selector.applySelection();

    expect(chatBoxSettingsManager.values).toMatchObject({ chatboxLLMProvider: 'openai', chatboxLLMModel: 'gpt-5.5' });
  });

  it('rebuilds when the LLM configuration is saved', () => {
    const { selector, llmConfigManager } = createSelector();
    llmConfigManager.providers.google.enabled = true;

    window.dispatchEvent(new CustomEvent('llmConfigurationChanged'));

    expect(selector.select.querySelector('option[value="google::gemini-3.5-flash"]')).not.toBeNull();
  });
});
