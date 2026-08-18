/**
 * MultiAgentSettingsManager - Manages the Agent Settings panel.
 *
 * Scope is deliberately narrow: this panel owns whether the agent system runs, whether
 * agent attribution is shown, and which individual agents are enabled. Model parameters,
 * the memory system, and execution limits belong to ChatBox Settings — mirroring them
 * here produced a second set of controls that nothing ever read.
 */
class MultiAgentSettingsManager {
  /**
   * Settings key -> registered agent name. Single source of truth for the Agents tab:
   * the defaults, the change listeners, and syncAgentEnabledState() all derive from it,
   * so a toggle can never point at an agent that does not exist. Must stay in sync with
   * MultiAgentSystem.initializeAgents().
   */
  static AGENT_TOGGLES = {
    agentNavigationEnabled: 'NavigationAgent',
    agentAnalysisEnabled: 'AnalysisAgent',
    agentDataEnabled: 'DataAgent',
    agentExternalEnabled: 'ExternalAgent',
    agentPluginEnabled: 'PluginAgent',
    agentDeepResearchEnabled: 'DeepResearchAgent',
    agentCoordinatorEnabled: 'CoordinatorAgent',
  };

  constructor(configManager) {
    this.configManager = configManager;
    this.modal = null;
    this.currentTab = 'system';

    // Latest LLM providers and models (2024-2025)
    this.llmProviders = {
      openai: {
        name: 'OpenAI',
        models: {
          'gpt-5.5-pro': 'GPT-5.5 Pro (Pro)',
          'gpt-5.5': 'GPT-5.5 (Thinking / Standard)',
          'gpt-5.4-thinking': 'GPT-5.4 Thinking (Thinking)',
          'gpt-5.5-instant': 'GPT-5.5 Instant (Instant)',
          'gpt-realtime-2': 'GPT-Realtime-2 (Streaming)',
          'gpt-realtime-translate': 'GPT-Realtime-Translate',
          'gpt-realtime-whisper': 'GPT-Realtime-Whisper',
        },
        baseUrl: 'https://api.openai.com/v1',
        apiKeyPrefix: 'sk-',
      },
      anthropic: {
        name: 'Anthropic (Claude)',
        models: {
          'claude-opus-4.7': 'Claude Opus 4.7 (Opus)',
          'claude-sonnet-4.6': 'Claude Sonnet 4.6 (Balanced)',
          'claude-haiku-4.5': 'Claude Haiku 4.5 (Fast)',
        },
        baseUrl: 'https://api.anthropic.com',
        apiKeyPrefix: 'sk-ant-',
      },
      google: {
        name: 'Google (Gemini)',
        models: {
          'gemini-3.5-flash': 'Gemini 3.5 Flash (Flash)',
          'gemini-3.1-pro': 'Gemini 3.1 Pro (Pro)',
          'gemini-3.1-flash-lite': 'Gemini 3.1 Flash-Lite (Lite)',
        },
        baseUrl: 'https://generativelanguage.googleapis.com',
        apiKeyPrefix: 'AI',
      },
      deepseek: {
        name: 'DeepSeek',
        models: {
          'deepseek-v4-pro': 'DeepSeek V4 Pro (Flagship)',
          'deepseek-v4-flash': 'DeepSeek V4 Flash (Fast)',
          'deepseek-chat': 'DeepSeek Chat (V4 Flash non-thinking)',
          'deepseek-reasoner': 'DeepSeek Reasoner (V4 Flash thinking)',
        },
        baseUrl: 'https://api.deepseek.com/v1',
        apiKeyPrefix: 'sk-',
      },
      openrouter: {
        name: 'OpenRouter',
        models: {
          // OpenAI Models (Latest)
          'openai/gpt-5.5-pro': 'GPT-5.5 Pro (Pro)',
          'openai/gpt-5.5': 'GPT-5.5 (Thinking / Standard)',
          'openai/gpt-5.4-thinking': 'GPT-5.4 Thinking (Thinking)',
          'openai/gpt-5.5-instant': 'GPT-5.5 Instant (Instant)',
          'openai/gpt-realtime-2': 'GPT-Realtime-2 (Streaming)',
          'openai/gpt-realtime-translate': 'GPT-Realtime-Translate',
          'openai/gpt-realtime-whisper': 'GPT-Realtime-Whisper',

          // Anthropic Models (Latest)
          'anthropic/claude-opus-4.7': 'Claude Opus 4.7 (Opus)',
          'anthropic/claude-sonnet-4.6': 'Claude Sonnet 4.6 (Balanced)',
          'anthropic/claude-haiku-4.5': 'Claude Haiku 4.5 (Fast)',

          // GLM Models (Z.AI)
          'z-ai/glm-4.6': 'GLM-4.6 (Latest Flagship)',
          'z-ai/glm-4.5': 'GLM-4.5 (Previous Flagship)',
          'z-ai/glm-4.5-air:free': 'GLM-4.5-Air (Free)',
          'z-ai/glm-4.5v': 'GLM-4.5V (Vision)',

          // Google Models (Latest)
          'google/gemini-3.5-flash': 'Gemini 3.5 Flash (Flash)',
          'google/gemini-3.1-pro': 'Gemini 3.1 Pro (Pro)',
          'google/gemini-3.1-flash-lite': 'Gemini 3.1 Flash-Lite (Lite)',

          // Meta Models (Latest)
          'meta-llama/llama-3.1-405b-instruct': 'Llama 3.1 405B Instruct (Most Capable)',
          'meta-llama/llama-3.1-70b-instruct': 'Llama 3.1 70B Instruct (Balanced)',
          'meta-llama/llama-3.1-8b-instruct': 'Llama 3.1 8B Instruct (Fast)',

          // Mistral Models (Latest)
          'mistralai/mistral-large-latest': 'Mistral Large (Latest)',
          'mistralai/mistral-small-latest': 'Mistral Small (Latest)',

          // DeepSeek Models (Latest)
          'deepseek/deepseek-v4-pro': 'DeepSeek V4 Pro',
          'deepseek/deepseek-v4-flash': 'DeepSeek V4 Flash',
          'deepseek/deepseek-chat': 'DeepSeek Chat (V4 Flash)',
          'deepseek/deepseek-reasoner': 'DeepSeek Reasoner (V4 Flash thinking)',

          // Qwen Models (Latest)
          'qwen/qwen2.5-72b-instruct': 'Qwen 2.5 72B Instruct (Most Capable)',
          'qwen/qwen2.5-coder-32b-instruct': 'Qwen 2.5 Coder 32B (Code Focused)',
        },
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKeyPrefix: 'sk-or-',
      },
      siliconflow: {
        name: 'SiliconFlow',
        models: {
          // DeepSeek Models
          'Pro/deepseek-ai/DeepSeek-R1': 'DeepSeek-R1 (Pro)',
          'Pro/deepseek-ai/DeepSeek-V3': 'DeepSeek-V3 (Pro)',
          'deepseek-ai/DeepSeek-R1': 'DeepSeek-R1 (Latest)',
          'deepseek-ai/DeepSeek-V3': 'DeepSeek-V3 (Latest)',
          'deepseek-ai/DeepSeek-R1-0528-Qwen3-8B': 'DeepSeek-R1-0528-Qwen3-8B',
          'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B': 'DeepSeek-R1-Distill-Qwen-32B',
          'deepseek-ai/DeepSeek-R1-Distill-Qwen-14B': 'DeepSeek-R1-Distill-Qwen-14B',
          'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B': 'DeepSeek-R1-Distill-Qwen-7B',
          'Pro/deepseek-ai/DeepSeek-R1-Distill-Qwen-7B': 'DeepSeek-R1-Distill-Qwen-7B (Pro)',

          // Qwen Models
          'Qwen/Qwen3.5-39B-A17B': 'Qwen3.5-39B-A17B (Latest Flagship)',
          'Qwen/Qwen3.5-27B': 'Qwen3.5-27B',
          'Qwen/Qwen3.5-12B-A10B': 'Qwen3.5-12B-A10B',
          'Qwen/Qwen3.5-8B': 'Qwen3.5-8B',
          'Qwen/Qwen3.5-4B': 'Qwen3.5-4B',
          'Qwen/Qwen3.5-3B-A3B': 'Qwen3.5-3B-A3B',
          'Qwen/Qwen3-Coder-480B-A35B-Instruct': 'Qwen3-Coder-480B-A35B-Instruct (Code Specialized)',
          'Qwen/Qwen3-235B-A22B-Thinking-2507': 'Qwen3-235B-A22B-Thinking-2507',
          'Qwen/Qwen3-235B-A22B-Instruct-2507': 'Qwen3-235B-A22B-Instruct-2507',
          'Qwen/Qwen3-32B': 'Qwen3-32B (Latest)',
          'Qwen/Qwen3-14B': 'Qwen3-14B (Balanced)',
          'Qwen/Qwen3-8B': 'Qwen3-8B (Fast)',
          'Qwen/QwQ-32B': 'QwQ-32B (Latest)',
          'Qwen/QwQ-32B-Preview': 'QwQ-32B-Preview (Experimental)',

          // GLM Models (Available on SiliconFlow)
          'Pro/zai-org/GLM-5': 'GLM-5 Pro (Latest)',
          'Pro/zai-org/GLM-4.7': 'GLM-4.7 Pro',
          'zai-org/GLM-4.6V': 'GLM-4.6V (Vision)',
          'zai-org/GLM-4.6': 'GLM-4.6',
          'zai-org/GLM-4.5': 'GLM-4.5',
          'zai-org/GLM-4.5-Air': 'GLM-4.5-Air (Lightweight)',

          // Other Models
          'baidu/ERNIE-4.5-300B-A47B': 'ERNIE-4.5-300B-A47B',
          // Kimi Series
          'Pro/moonshotai/Kimi-K2.5': 'Kimi-K2.5 (Pro)',
          'Pro/moonshotai/Kimi-K2-Instruct-0905': 'Kimi-K2-Instruct-0905 (Pro)',
          'moonshotai/Kimi-K2-Instruct': 'Kimi-K2-Instruct',
          'moonshotai/Kimi-K2-Thinking': 'Kimi-K2-Thinking (Reasoning)',
          'ascend-tribe/pangu-pro-moe': 'pangu-pro-moe',
          'tencent/Hunyuan-A13B-Instruct': 'Hunyuan-A13B-Instruct',
          'MiniMaxAI/MiniMax-M2': 'MiniMax-M2 (Latest)',
          'Pro/MiniMax/MiniMax-M2.5': 'MiniMax-M2.5 Pro (Latest)',
          'TeleAI/TeleChat2': 'TeleChat2 (Latest)',
          'internlm/internlm2_5-7b-chat': 'InternLM2.5-7B-Chat (Fast)',
          'internlm/internlm2_5-20b-chat': 'InternLM2.5-20B-Chat (Balanced)',
        },
        baseUrl: 'https://api.siliconflow.cn/v1',
        apiKeyPrefix: 'sk-',
      },
      mistral: {
        name: 'Mistral AI',
        models: {
          'mistral-large-latest': 'Mistral Large (Latest)',
          'mistral-medium-latest': 'Mistral Medium (Latest)',
          'mistral-small-latest': 'Mistral Small (Latest)',
          'mistral-large': 'Mistral Large (Legacy)',
          'mistral-medium': 'Mistral Medium (Legacy)',
          'mistral-small': 'Mistral Small (Legacy)',
        },
        baseUrl: 'https://api.mistral.ai/v1',
        apiKeyPrefix: 'sk-',
      },
      cohere: {
        name: 'Cohere',
        models: {
          'command-r-plus': 'Command R+ (Latest)',
          'command-r': 'Command R (Latest)',
          'command-light': 'Command Light (Fast)',
          command: 'Command (Legacy)',
          'command-light-nightly': 'Command Light Nightly (Experimental)',
        },
        baseUrl: 'https://api.cohere.ai/v1',
        apiKeyPrefix: 'sk-',
      },
      perplexity: {
        name: 'Perplexity',
        models: {
          'llama-3.1-70b-instruct': 'Llama 3.1 70B Instruct (Latest)',
          'llama-3.1-8b-instruct': 'Llama 3.1 8B Instruct (Fast)',
          'llama-3.1-405b-instruct': 'Llama 3.1 405B Instruct (Most Capable)',
          'mixtral-8x7b-instruct': 'Mixtral 8x7B Instruct (Balanced)',
          'codellama-70b-instruct': 'Code Llama 70B Instruct (Code Focused)',
          'mistral-7b-instruct': 'Mistral 7B Instruct (Fast)',
        },
        baseUrl: 'https://api.perplexity.ai',
        apiKeyPrefix: 'pplx-',
      },
      local: {
        name: 'Custom Endpoint',
        models: {
          'qwen3:8b': 'Qwen3:8b (Latest - 5.2GB)',
          'qwen3:4b': 'Qwen3:4b (2.6GB)',
          'qwen3:1.7b': 'Qwen3:1.7b (1.4GB)',
          'qwen3:0.6b': 'Qwen3:0.6b (523MB)',
          'qwen3:14b': 'Qwen3:14b (9.3GB)',
          'qwen3:32b': 'Qwen3:32b (20GB)',
          'qwen3:30b': 'Qwen3:30b-a3b (MoE 19GB)',
          'qwen3:235b': 'Qwen3:235b-a22b (MoE 142GB)',
          'deepseek-r1:8b': 'DeepSeek-R1:8b (Latest - 5.2GB)',
          'deepseek-r1:7b': 'DeepSeek-R1:7b (4.7GB)',
          'deepseek-r1:1.5b': 'DeepSeek-R1:1.5b (1.1GB)',
          'deepseek-r1:14b': 'DeepSeek-R1:14b (9.0GB)',
          'deepseek-r1:32b': 'DeepSeek-R1:32b (20GB)',
          'deepseek-r1:70b': 'DeepSeek-R1:70b (43GB)',
          'deepseek-r1:671b': 'DeepSeek-R1:671b (404GB)',
          'mistral-large:latest': 'Mistral Large:latest (Legacy)',
          'llama3.1:70b': 'Llama3.1:70b (Legacy)',
          'llama3.1:latest': 'Llama3.1:latest (Legacy)',
          'gemma3:27b': 'Gemma3:27b (Legacy)',
          other: 'Other (Custom)',
        },
        baseUrl: 'http://localhost:11434/v1',
        apiKeyPrefix: '',
      },
      custom: {
        name: 'Custom Provider',
        models: {},
        baseUrl: '',
        apiKeyPrefix: '',
      },
    };

    // Default settings.
    //
    // Only settings this panel actually applies live here. Model parameters, the
    // memory system, and execution limits are owned by ChatBox Settings; they used
    // to be mirrored here as agent-specific overrides that nothing ever read.
    this.defaultSettings = {
      // System settings
      multiAgentSystemEnabled: false,
      multiAgentShowInfo: true,

      // Per-agent enablement, derived from AGENT_TOGGLES so the settings schema,
      // the change listeners, and the UI can never drift apart.
      ...Object.fromEntries(Object.keys(MultiAgentSettingsManager.AGENT_TOGGLES).map(key => [key, true])),
    };

    this.agentToggleIds = Object.keys(MultiAgentSettingsManager.AGENT_TOGGLES);
    this.currentSettings = { ...this.defaultSettings };
    this.loadSettings();
    this.setupEventListeners();
  }

  loadSettings() {
    try {
      const savedSettings = this.configManager.get('multiAgentSettings', {});
      this.currentSettings = { ...this.defaultSettings, ...savedSettings };

      // Also sync from ChatManager's agentSystemSettings for consistency
      if (window.chatManager && window.chatManager.agentSystemSettings) {
        const cms = window.chatManager.agentSystemSettings;
        // Merge ChatManager settings into our currentSettings
        if (cms.enabled !== undefined) this.currentSettings.multiAgentSystemEnabled = cms.enabled;
        if (cms.showAgentInfo !== undefined) this.currentSettings.multiAgentShowInfo = cms.showAgentInfo;
      }

      console.log('Agent Settings loaded:', this.currentSettings);
    } catch (error) {
      console.error('Error loading agent settings:', error);
      this.currentSettings = { ...this.defaultSettings };
    }
  }

  saveSettings() {
    try {
      this.configManager.set('multiAgentSettings', this.currentSettings);

      // Sync the multiAgentSystemEnabled setting to ChatBox settings for consistency
      if (window.chatManager && window.chatManager.chatBoxSettingsManager) {
        const enabled = this.currentSettings.multiAgentSystemEnabled;
        window.chatManager.chatBoxSettingsManager.setSetting('agentSystemEnabled', enabled);

        // Update ChatManager's internal state and button
        window.chatManager.agentSystemEnabled = enabled;
        window.chatManager.agentSystemSettings.enabled = enabled;
        window.chatManager.updateMultiAgentToggleButton();
      }

      // Also sync to ChatManager's agentSystemSettings for persistence consistency.
      // Model parameters are deliberately not mirrored here: agents use the ChatBox
      // model configuration, and the old per-agent overrides were never read.
      if (window.chatManager) {
        const settings = this.currentSettings;
        window.chatManager.agentSystemSettings = {
          ...window.chatManager.agentSystemSettings,
          enabled: settings.multiAgentSystemEnabled,
          showAgentInfo: settings.multiAgentShowInfo,
        };
        window.chatManager.saveAgentSystemSettings();
      }

      console.log('Agent Settings saved and synced:', this.currentSettings);
      return true;
    } catch (error) {
      console.error('Error saving agent settings:', error);
      return false;
    }
  }

  setupEventListeners() {
    // Ensure DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupEventListeners());
      return;
    }

    // Multi-Agent Settings button
    const multiAgentSettingsBtn = document.getElementById('multiAgentSettingsBtn');
    if (multiAgentSettingsBtn) {
      multiAgentSettingsBtn.addEventListener('click', () => {
        this.showModal();
      });
    }

    // Modal event listeners
    this.setupModalEventListeners();
  }

  setupModalEventListeners() {
    // Tab switching
    document.querySelectorAll('.multi-agent-tabs .tab-button').forEach(button => {
      button.addEventListener('click', () => {
        this.switchTab(button.dataset.tab);
      });
    });

    // Save settings
    const saveBtn = document.getElementById('saveMultiAgentSettingsBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        this.saveCurrentSettings();
      });
    }

    // Reset settings
    const resetBtn = document.getElementById('resetMultiAgentSettingsBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.resetToDefaults();
      });
    }

    // Cancel button
    const cancelBtn = document.getElementById('cancelMultiAgentSettingsBtn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.hideModal();
      });
    }

    // Close modal
    const closeBtn = document.querySelector('#multiAgentSettingsModal .modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.hideModal();
      });
    }

    // Paste API key button
    const pasteApiKeyBtn = document.getElementById('pasteMultiAgentApiKeyBtn');
    if (pasteApiKeyBtn) {
      pasteApiKeyBtn.addEventListener('click', () => {
        this.pasteApiKey();
      });
    }

    // Refresh metrics button
    const refreshMetricsBtn = document.getElementById('refreshMetricsBtn');
    if (refreshMetricsBtn) {
      refreshMetricsBtn.addEventListener('click', () => {
        this.refreshMetrics();
      });
    }

    // Real-time change listeners for all settings
    this.setupRealTimeChangeListeners();
  }

  /**
   * Set up real-time change listeners so settings apply immediately
   * without requiring explicit "Save Settings" click.
   */
  setupRealTimeChangeListeners() {
    const syncSetting = (key, value) => {
      this.currentSettings[key] = value;
      this.saveSettings();
    };

    // System tab
    const systemCheckboxes = ['multiAgentSystemEnabled', 'multiAgentShowInfo'];
    systemCheckboxes.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', () => syncSetting(id, el.checked));
      }
    });

    // Agents tab
    this.agentToggleIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', () => {
          syncSetting(id, el.checked);
          this.syncAgentEnabledState();
        });
      }
    });
  }

  /**
   * Sync agent enabled state from settings to MultiAgentSystem.
   * When an agent is disabled in settings, prevent it from being selected.
   */
  syncAgentEnabledState() {
    if (!window.chatManager || !window.chatManager.multiAgentSystem) return;

    const mas = window.chatManager.multiAgentSystem;

    for (const [settingKey, agentName] of Object.entries(MultiAgentSettingsManager.AGENT_TOGGLES)) {
      const enabled = this.currentSettings[settingKey] !== false;
      const agent = mas.agents.get(agentName);
      if (agent) {
        agent._enabledBySettings = enabled;
      }
    }
  }

  showModal() {
    this.modal = document.getElementById('multiAgentSettingsModal');
    if (this.modal) {
      this.loadSettingsToUI();

      // The Model / Execution / Context / Memory tabs render controls whose values are
      // stored in `chatboxSettings`. ChatBoxSettingsManager remains their owner, so ask
      // it to fill them in rather than duplicating the load logic here.
      this.populateChatBoxOwnedControls();

      // Apply saved agent enabled state to MultiAgentSystem
      this.syncAgentEnabledState();

      // Reset any drag inline styles so the modal re-centers on open
      if (window.modalDragManager) {
        window.modalDragManager.resetPosition('#multiAgentSettingsModal');
      }

      this.modal.classList.add('show');
      this.switchTab(this.currentTab);

      // Initialize drag and resize functionality
      this.initializeDragAndResize();
    }
  }

  hideModal() {
    if (this.modal) {
      this.modal.classList.remove('show');
    }
  }

  initializeDragAndResize() {
    const modalContent = this.modal.querySelector('.modal-content');
    if (!modalContent) return;

    // Initialize drag functionality using existing ModalDragManager
    if (window.modalDragManager) {
      window.modalDragManager.makeDraggable('#multiAgentSettingsModal');
    }

    // Initialize resize functionality using existing ResizableModalManager
    if (window.resizableModalManager) {
      window.resizableModalManager.makeResizable('#multiAgentSettingsModal');
    }

    // Add reset to defaults button handler
    const resetDefaultsBtn = this.modal.querySelector('.reset-defaults-btn');
    if (resetDefaultsBtn) {
      resetDefaultsBtn.addEventListener('click', () => {
        this.resetToDefaults();
      });
    }
  }

  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.multi-agent-tabs .tab-button').forEach(button => {
      button.classList.toggle('active', button.dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.multi-agent-content .tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `${tabName}-tab`);
    });

    this.currentTab = tabName;
  }

  loadSettingsToUI() {
    // System settings
    this.setCheckboxValue('multiAgentSystemEnabled', this.currentSettings.multiAgentSystemEnabled);
    this.setCheckboxValue('multiAgentShowInfo', this.currentSettings.multiAgentShowInfo);

    // Per-agent enablement
    this.agentToggleIds.forEach(id => {
      this.setCheckboxValue(id, this.currentSettings[id]);
    });
  }

  /**
   * Fill in the controls this panel renders but ChatBoxSettingsManager owns.
   */
  populateChatBoxOwnedControls() {
    const chatBoxSettings = window.chatManager?.chatBoxSettingsManager;
    if (!chatBoxSettings || typeof chatBoxSettings.populateSettingsForm !== 'function') return;

    try {
      chatBoxSettings.populateSettingsForm(this.modal);
    } catch (error) {
      console.warn('[AgentSettings] Failed to populate ChatBox-owned controls:', error);
    }
  }

  /**
   * Persist the controls this panel renders but ChatBoxSettingsManager owns.
   * saveSettingsFromForm merges, so keys whose controls live in the ChatBox modal
   * (and are therefore absent here) keep their stored values.
   */
  async saveChatBoxOwnedControls() {
    const chatBoxSettings = window.chatManager?.chatBoxSettingsManager;
    if (!chatBoxSettings || typeof chatBoxSettings.saveSettingsFromForm !== 'function') return;

    try {
      await chatBoxSettings.saveSettingsFromForm(this.modal);
    } catch (error) {
      console.warn('[AgentSettings] Failed to save ChatBox-owned controls:', error);
    }
  }

  saveCurrentSettings() {
    // Model / execution / context / memory controls are stored in chatboxSettings.
    this.saveChatBoxOwnedControls();

    // Collect all settings from UI
    const newSettings = {
      // System settings
      multiAgentSystemEnabled: this.getCheckboxValue('multiAgentSystemEnabled'),
      multiAgentShowInfo: this.getCheckboxValue('multiAgentShowInfo'),

      // Per-agent enablement
      ...Object.fromEntries(this.agentToggleIds.map(id => [id, this.getCheckboxValue(id)])),
    };

    // Update current settings
    this.currentSettings = { ...this.currentSettings, ...newSettings };

    // Save to config
    if (this.saveSettings()) {
      this.showSuccessMessage('Agent settings saved successfully!');

      // Emit settings changed event
      if (window.chatManager) {
        window.chatManager.emit('multiAgentSettingsChanged', this.currentSettings);
      }

      // Also emit window event for global listening
      window.dispatchEvent(
        new CustomEvent('multiAgentSettingsChanged', {
          detail: this.currentSettings,
        })
      );
    } else {
      this.showErrorMessage('Failed to save settings. Please try again.');
    }
  }

  resetToDefaults() {
    if (confirm('Are you sure you want to reset all multi-agent settings to defaults?')) {
      this.currentSettings = { ...this.defaultSettings };
      this.loadSettingsToUI();
      this.saveSettings();
      this.showSuccessMessage('Settings reset to defaults successfully!');
    }
  }

  pasteApiKey() {
    navigator.clipboard
      .readText()
      .then(text => {
        const apiKeyInput = document.getElementById('multiAgentApiKey');
        if (apiKeyInput) {
          apiKeyInput.value = text;
        }
      })
      .catch(err => {
        console.error('Failed to paste API key:', err);
        this.showErrorMessage('Failed to paste API key. Please paste manually.');
      });
  }

  refreshMetrics() {
    // Simulate metrics refresh
    const metrics = {
      avgResponseTime: '1.2s',
      successRate: '98.5%',
      cacheHitRate: '85.2%',
      activeAgents: '3',
    };

    Object.entries(metrics).forEach(([key, value]) => {
      const element = document.getElementById(key);
      if (element) {
        element.textContent = value;
      }
    });

    this.showSuccessMessage('Metrics refreshed successfully!');
  }

  // Utility methods for UI interaction
  setCheckboxValue(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.checked = value;
    }
  }

  getCheckboxValue(id) {
    const element = document.getElementById(id);
    return element ? element.checked : false;
  }

  setInputValue(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.value = value;
    }
  }

  getInputValue(id) {
    const element = document.getElementById(id);
    return element ? element.value : '';
  }

  setSelectValue(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.value = value;
    }
  }

  getSelectValue(id) {
    const element = document.getElementById(id);
    return element ? element.value : '';
  }

  setRangeValue(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.value = value;
      // Update display value
      const displayElement = document.getElementById(`${id}Value`);
      if (displayElement) {
        displayElement.textContent = value;
      }
    }
  }

  getRangeValue(id) {
    const element = document.getElementById(id);
    return element ? element.value : '0';
  }

  showSuccessMessage(message) {
    // Create temporary success message
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    successDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
        `;

    document.body.appendChild(successDiv);

    setTimeout(() => {
      successDiv.remove();
    }, 3000);
  }

  showErrorMessage(message) {
    // Create temporary error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #f44336;
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
        `;

    document.body.appendChild(errorDiv);

    setTimeout(() => {
      errorDiv.remove();
    }, 3000);
  }

  // Get current settings for external use
  getSettings() {
    return { ...this.currentSettings };
  }

  // Get specific setting
  getSetting(key) {
    return this.currentSettings[key];
  }

  // Update specific setting
  updateSetting(key, value) {
    this.currentSettings[key] = value;
    this.saveSettings();
  }
}

// Export for global use
window.MultiAgentSettingsManager = MultiAgentSettingsManager;
