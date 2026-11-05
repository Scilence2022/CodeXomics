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
 *
 * The option list comes from `LLMConfigManager.getModelCatalog()`, the catalog
 * the Default Model tab also builds from, so both show the same friendly labels
 * and both offer models entered through "Other (specify below)".
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

  /**
   * The live LLMConfigManager. It is owned by ChatManager / GenomeBrowser and is not
   * published on `window`, so resolve it from its actual owners rather than assuming
   * a global — reading `window.llmConfigManager` yields undefined and an empty list.
   */
  get llmConfig() {
    return (
      this.chatManager?.llmConfigManager ||
      (typeof window !== 'undefined' &&
        (window.chatManager?.llmConfigManager || window.genomeBrowser?.llmConfigManager)) ||
      null
    );
  }

  initialize() {
    if (typeof document === 'undefined') return;
    this.bind();

    if (typeof window !== 'undefined') {
      // Keep the composer in sync when the model is changed from Agent Settings
      // or the LLM configuration is saved.
      window.addEventListener('chatbox-settingsChanged', this.handleSettingsChanged);
      window.addEventListener('llmConfigurationChanged', this.handleSettingsChanged);
    }

    this.refreshWhenConfigReady();
  }

  bind() {
    if (this.bound) return;
    this.select = document.getElementById('chatModelSelect');
    if (!this.select) return;

    this.select.addEventListener('change', () => this.applySelection());
    // Rebuild on open. LLM configuration loads asynchronously and can change from
    // Configure LLM Providers at any time, so the list is built when it is about to be read
    // rather than relying on startup ordering.
    this.select.addEventListener('mousedown', () => this.refresh());
    this.select.addEventListener('focus', () => this.refresh());
    this.bound = true;
    this.refresh();
  }

  /**
   * Populate once LLM configuration has loaded, so the collapsed control shows the
   * real model without needing the user to open it first.
   */
  async refreshWhenConfigReady() {
    const llmConfig = this.llmConfig;
    try {
      if (llmConfig && typeof llmConfig.waitForInitialization === 'function') {
        await llmConfig.waitForInitialization();
      }
    } catch (error) {
      console.warn('[ChatModelSelector] LLM config initialization failed:', error);
    }
    this.refresh();
  }

  /** The persisted ChatBox selection, as `{ provider, model }`. */
  getStoredSelection() {
    const settings = this.settingsManager;
    return {
      provider: settings?.getSetting('chatboxLLMProvider', 'auto') || 'auto',
      model: settings?.getSetting('chatboxLLMModel', 'auto') || 'auto',
    };
  }

  /**
   * The provider and model a ChatBox request would use with Auto selected, so the
   * Auto entry can say what it resolves to instead of reading as an unknown.
   * @returns {{providerKey: string, model: string}|null}
   */
  resolveAutoSelection() {
    const llmConfig = this.llmConfig;
    if (!llmConfig || typeof llmConfig.getRequestModelSelection !== 'function') return null;
    try {
      const selection = llmConfig.getRequestModelSelection('task', {
        modelType: this.settingsManager?.getSetting('chatboxModelType', 'auto'),
        providerOverride: 'auto',
        modelOverride: 'auto',
      });
      return selection?.providerKey && selection?.model ? selection : null;
    } catch (error) {
      return null;
    }
  }

  /** The model the next ChatBox request will use, whatever the selector shows. */
  getEffectiveSelection() {
    const { provider, model } = this.getStoredSelection();
    if (provider === 'auto') return this.resolveAutoSelection();
    const providerConfig = this.llmConfig?.providers?.[provider];
    if (!providerConfig?.enabled) return this.resolveAutoSelection();
    const resolvedModel = model && model !== 'auto' ? model : providerConfig.model;
    return resolvedModel ? { providerKey: provider, model: resolvedModel } : null;
  }

  describe(providerKey, modelId) {
    const llmConfig = this.llmConfig;
    if (llmConfig && typeof llmConfig.describeModel === 'function') {
      return llmConfig.describeModel(providerKey, modelId);
    }
    return { label: modelId, shortLabel: modelId };
  }

  buildAutoOption() {
    const resolved = this.resolveAutoSelection();
    if (!resolved) return this.createOption('auto::auto', 'Auto', 'Follows the default in Configure LLM Providers');
    const providerName = this.llmConfig?.providers?.[resolved.providerKey]?.name || resolved.providerKey;
    const { label, shortLabel } = this.describe(resolved.providerKey, resolved.model);
    return this.createOption(
      'auto::auto',
      `Auto · ${shortLabel}`,
      `Auto follows the default in Configure LLM Providers — currently ${providerName} / ${label}`
    );
  }

  /**
   * Rebuild the option list from the configured providers and select the active model.
   */
  refresh() {
    if (!this.select) {
      this.bind();
      if (!this.select) return;
    }

    const { provider, model } = this.getStoredSelection();

    this.select.innerHTML = '';
    this.select.appendChild(this.buildAutoOption());

    // A stored model a list refresh has since dropped stays selectable while its
    // provider is enabled, instead of silently snapping the picker back to Auto.
    const extraModels = provider !== 'auto' && model !== 'auto' ? { [provider]: [model] } : {};
    const catalog = this.getCatalog(extraModels);
    let listed = 0;
    for (const entry of catalog) {
      if (entry.models.length === 0) continue;

      const group = document.createElement('optgroup');
      group.label = entry.providerName;
      for (const item of entry.models) {
        const title = item.label === item.id ? item.id : `${item.label} — ${item.id}`;
        const text = item.source === 'custom' ? `${item.shortLabel} (custom)` : item.shortLabel;
        group.appendChild(this.createOption(`${entry.providerKey}::${item.id}`, text, title));
      }
      this.select.appendChild(group);
      listed += entry.models.length;
    }

    // Auto on its own is indistinguishable from a broken picker. Say why the list is empty.
    if (listed === 0) {
      const hint = this.createOption(
        'auto::auto',
        'No models — configure a provider in Options → Configure LLM Providers'
      );
      hint.disabled = true;
      this.select.appendChild(hint);
    }

    const desired = `${provider}::${model}`;
    // A previously chosen model can disappear if its provider was disabled; fall back
    // to Auto rather than silently showing the wrong model.
    const hasDesired = Array.from(this.select.querySelectorAll('option')).some(option => option.value === desired);
    this.select.value = hasDesired ? desired : 'auto::auto';
    this.select.title = this.select.selectedOptions?.[0]?.title || '';
  }

  /**
   * Enabled providers and their models. Falls back to the raw provider lists for
   * an LLMConfigManager that predates the shared catalog.
   */
  getCatalog(extraModels = {}) {
    const llmConfig = this.llmConfig;
    if (llmConfig && typeof llmConfig.getModelCatalog === 'function') {
      return llmConfig.getModelCatalog({ extraModels });
    }
    return Object.entries(llmConfig?.providers || {})
      .filter(([, providerConfig]) => providerConfig?.enabled)
      .map(([providerKey, providerConfig]) => ({
        providerKey,
        providerName: providerConfig.name || providerKey,
        models: (Array.isArray(providerConfig.availableModels) ? providerConfig.availableModels : []).map(id => ({
          id,
          label: id,
          shortLabel: id,
          source: 'builtin',
        })),
      }));
  }

  createOption(value, label, title = '') {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    if (title) option.title = title;
    return option;
  }

  async applySelection() {
    const settings = this.settingsManager;
    if (!settings || typeof settings.setSetting !== 'function') return;

    const [provider, model] = String(this.select.value || 'auto::auto').split('::');
    this.select.title = this.select.selectedOptions?.[0]?.title || '';
    try {
      await settings.setSetting('chatboxLLMProvider', provider || 'auto');
      await settings.setSetting('chatboxLLMModel', model || 'auto');
    } catch (error) {
      console.warn('[ChatModelSelector] Failed to persist model selection:', error);
    }
  }
}

window.ChatModelSelector = ChatModelSelector;
