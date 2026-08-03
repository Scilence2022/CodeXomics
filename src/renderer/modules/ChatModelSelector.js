// @ts-check
/**
 * ChatModelSelector - inline model picker in the ChatBox composer.
 *
 * The provider/model override already existed but was reachable only through
 * Settings, and nothing in the ChatBox showed which model was answering. This
 * surfaces both: the control doubles as the active-model indicator.
 *
 * It writes the same `chatboxLLMProvider` / `chatboxLLMModel` settings that the
 * Agent Settings → Model tab writes, so the two stay in sync in both directions.
 */
class ChatModelSelector {
  constructor(chatManager = null) {
    this.chatManager = chatManager || (typeof window !== 'undefined' ? window.chatManager : null);
    this.select = null;
    this.bound = false;

    this.handleSettingsChanged = () => this.refresh();
    this.initialize();
  }

  get settingsManager() {
    return this.chatManager?.chatBoxSettingsManager || null;
  }

  initialize() {
    if (typeof document === 'undefined') return;
    this.bind();

    if (typeof window !== 'undefined') {
      // Keep the composer in sync when the model is changed from Agent Settings.
      window.addEventListener('chatboxSettingsChanged', this.handleSettingsChanged);
    }
  }

  bind() {
    if (this.bound) return;
    this.select = document.getElementById('chatModelSelect');
    if (!this.select) return;

    this.select.addEventListener('change', () => this.applySelection());
    this.bound = true;
    this.refresh();
  }

  /**
   * Rebuild the option list from the configured providers and select the active model.
   */
  refresh() {
    if (!this.select) {
      this.bind();
      if (!this.select) return;
    }

    const settings = this.settingsManager;
    const provider = settings?.getSetting('chatboxLLMProvider', 'auto') || 'auto';
    const model = settings?.getSetting('chatboxLLMModel', 'auto') || 'auto';

    this.select.innerHTML = '';
    this.select.appendChild(this.createOption('auto::auto', 'Auto'));

    const providers = (typeof window !== 'undefined' && window.llmConfigManager?.providers) || {};
    for (const [providerKey, providerConfig] of Object.entries(providers)) {
      if (!providerConfig?.enabled) continue;

      const models = this.listModels(providerConfig);
      if (models.length === 0) continue;

      const group = document.createElement('optgroup');
      group.label = providerConfig.name || providerKey;
      for (const [modelId, modelLabel] of models) {
        group.appendChild(this.createOption(`${providerKey}::${modelId}`, modelLabel));
      }
      this.select.appendChild(group);
    }

    const desired = `${provider}::${model}`;
    // A previously chosen model can disappear if its provider was disabled; fall back
    // to Auto rather than silently showing the wrong model.
    const hasDesired = Array.from(this.select.querySelectorAll('option')).some(option => option.value === desired);
    this.select.value = hasDesired ? desired : 'auto::auto';
  }

  listModels(providerConfig) {
    if (providerConfig.models && typeof providerConfig.models === 'object') {
      return Object.entries(providerConfig.models);
    }
    if (Array.isArray(providerConfig.availableModels)) {
      return providerConfig.availableModels.map(id => [id, id]);
    }
    return [];
  }

  createOption(value, label) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    return option;
  }

  async applySelection() {
    const settings = this.settingsManager;
    if (!settings || typeof settings.setSetting !== 'function') return;

    const [provider, model] = String(this.select.value || 'auto::auto').split('::');
    try {
      await settings.setSetting('chatboxLLMProvider', provider || 'auto');
      await settings.setSetting('chatboxLLMModel', model || 'auto');
    } catch (error) {
      console.warn('[ChatModelSelector] Failed to persist model selection:', error);
    }
  }
}

window.ChatModelSelector = ChatModelSelector;
