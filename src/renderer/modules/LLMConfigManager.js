/* eslint-disable no-unused-vars */
/**
 * LLMConfigManager - Manages LLM provider configurations and API communication
 */
class LLMConfigManager {
  constructor(genomeBrowser, configManager = null) {
    this.genomeBrowser = genomeBrowser;
    this.configManager = configManager;
    this.isInitialized = false;
    this._initPromise = null;
    this.providers = {
      // OpenAI Direct API - GPT-5 requires bringing your own API key (BYOK)
      openai: {
        name: 'OpenAI',
        apiKey: '',
        model: 'gpt-5.5',
        baseUrl: 'https://api.openai.com/v1',
        enabled: false,
        availableModels: [
          'gpt-5.5-pro',
          'gpt-5.5',
          'gpt-5.4-thinking',
          'gpt-5.5-instant',
          'gpt-realtime-2',
          'gpt-realtime-translate',
          'gpt-realtime-whisper',
        ],
      },
      anthropic: {
        name: 'Anthropic',
        apiKey: '',
        model: 'claude-sonnet-4.6', // Latest Claude Sonnet 4.6
        baseUrl: 'https://api.anthropic.com',
        enabled: false,
        availableModels: ['claude-opus-4.7', 'claude-sonnet-4.6', 'claude-haiku-4.5'],
      },
      // Google - Direct API access to Gemini models
      google: {
        name: 'Google',
        apiKey: '',
        model: 'gemini-3.5-flash',
        baseUrl: 'https://generativelanguage.googleapis.com',
        enabled: false,
        availableModels: ['gemini-3.5-flash', 'gemini-3.1-pro', 'gemini-3.1-flash-lite'],
      },
      deepseek: {
        name: 'DeepSeek',
        apiKey: '',
        model: 'deepseek-v4-flash',
        baseUrl: 'https://api.deepseek.com/v1',
        enabled: false,
        availableModels: ['deepseek-v4-pro', 'deepseek-v4-flash', 'deepseek-chat', 'deepseek-reasoner'],
      },
      siliconflow: {
        name: 'SiliconFlow',
        apiKey: '',
        model: 'Qwen/Qwen3.5-39B-A17B',
        baseUrl: 'https://api.siliconflow.cn/v1',
        enabled: false,
        availableModels: [
          // 🤖 Qwen Series (Arranged by size: high to low)
          // Qwen3.5 Series (Latest)
          'Qwen/Qwen3.5-39B-A17B', // 39B total, 17B active
          'Qwen/Qwen3.5-27B', // 27B
          'Qwen/Qwen3.5-12B-A10B', // 12B total, 10B active
          'Qwen/Qwen3.5-8B', // 8B
          'Qwen/Qwen3.5-4B', // 4B
          'Qwen/Qwen3.5-3B-A3B', // 3B total, 3B active

          // DeepSeek R1 Distilled Series (by size)
          'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B', // 32B Distilled
          'deepseek-ai/DeepSeek-R1-Distill-Qwen-14B', // 14B Distilled
          'deepseek-ai/DeepSeek-R1-0528-Qwen3-8B', // 8B R1
          'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B', // 7B Distilled

          // 🌙 Kimi Series (Moonshot AI)
          'Pro/moonshotai/Kimi-K2.6', // Kimi K2.6 Pro (Latest)
          'Pro/moonshotai/Kimi-K2.5', // Kimi K2.5 Pro
        ],
      },
      // OpenRouter - Access to GPT-5 series via OpenRouter API
      openrouter: {
        name: 'OpenRouter',
        apiKey: '',
        model: 'openai/gpt-5.5',
        baseUrl: 'https://openrouter.ai/api/v1',
        enabled: false,
        availableModels: [
          // OpenAI GPT-5.5/GPT-5.4 Series (Latest)
          'openai/gpt-5.5-pro',
          'openai/gpt-5.5',
          'openai/gpt-5.4-thinking',
          'openai/gpt-5.5-instant',
          'openai/gpt-realtime-2',
          'openai/gpt-realtime-translate',
          'openai/gpt-realtime-whisper',

          // Anthropic Claude Series (Latest)
          'anthropic/claude-opus-4.7',
          'anthropic/claude-sonnet-4.6',
          'anthropic/claude-haiku-4.5',

          // Google Gemini Series (Latest)
          'google/gemini-3.5-flash',
          'google/gemini-3.1-pro',
          'google/gemini-3.1-flash-lite',

          // GLM Series (Latest from Z.AI)
          'z-ai/glm-4.6', // GLM-4.6 (Latest flagship)
          'z-ai/glm-4.5', // GLM-4.5 (Previous flagship)
          'z-ai/glm-4.5-air:free', // GLM-4.5-Air (Free)
          'z-ai/glm-4.5v', // GLM-4.5V (Vision)

          // DeepSeek Series
          'deepseek/deepseek-v4-pro',
          'deepseek/deepseek-v4-flash',
          'deepseek/deepseek-chat',
          'deepseek/deepseek-reasoner',
        ],
      },
      minimax: {
        name: 'MiniMax (Global)',
        apiKey: '',
        model: 'MiniMax-M2.7',
        baseUrl: 'https://api.minimax.io/v1',
        enabled: false,
        availableModels: ['MiniMax-M2.7', 'MiniMax-M2.7-highspeed', 'MiniMax-M2.5', 'MiniMax-M2.5-highspeed', 'M2-her'],
      },
      minimax_cn: {
        name: 'MiniMax CN',
        apiKey: '',
        model: 'MiniMax-M2.7',
        baseUrl: 'https://api.minimaxi.com/v1',
        enabled: false,
        availableModels: ['MiniMax-M2.7', 'MiniMax-M2.7-highspeed', 'MiniMax-M2.5', 'MiniMax-M2.5-highspeed', 'M2-her'],
      },
      local: {
        name: 'Custom Endpoint',
        apiKey: '',
        model: 'qwen3:8b',
        baseUrl: 'http://localhost:11434/v1',
        streamingSupport: true,
        enabled: false,
      },
    };

    // Model type configurations with intelligent defaults
    this.modelTypes = {
      reasoning: {
        provider: 'auto',
        model: 'auto',
        description: 'For complex reasoning and analysis tasks',
        preferredProviders: ['anthropic', 'openai', 'google', 'deepseek', 'minimax', 'minimax_cn'],
        preferredModels: {
          anthropic: 'claude-sonnet-4.6',
          openai: 'gpt-5.5',
          google: 'gemini-3.1-pro',
          deepseek: 'deepseek-v4-pro',
          siliconflow: 'Qwen/Qwen3.5-39B-A17B',
          openrouter: 'openai/gpt-5.5',
          minimax: 'MiniMax-M2.7',
          minimax_cn: 'MiniMax-M2.7',
        },
      },
      task: {
        provider: 'auto',
        model: 'auto',
        description: 'For general task execution and completion',
        preferredProviders: ['openai', 'anthropic', 'siliconflow', 'google', 'minimax', 'minimax_cn'],
        preferredModels: {
          openai: 'gpt-5.5',
          anthropic: 'claude-sonnet-4.6',
          siliconflow: 'Qwen/Qwen3.5-39B-A17B',
          google: 'gemini-3.5-flash',
          deepseek: 'deepseek-v4-flash',
          openrouter: 'openai/gpt-5.5',
          minimax: 'MiniMax-M2.7',
          minimax_cn: 'MiniMax-M2.7',
        },
      },
      code: {
        provider: 'auto',
        model: 'auto',
        description: 'For code generation and programming tasks',
        preferredProviders: ['siliconflow', 'deepseek', 'openai', 'anthropic', 'minimax', 'minimax_cn'],
        preferredModels: {
          siliconflow: 'Qwen/Qwen3-Coder-30B-A3B-Instruct',
          deepseek: 'deepseek-v4-flash',
          openai: 'gpt-5.5',
          anthropic: 'claude-sonnet-4.6',
          openrouter: 'openai/gpt-5.5',
          local: 'deepseek-r1:70b',
          minimax: 'MiniMax-M2.7',
          minimax_cn: 'MiniMax-M2.7',
        },
      },
      voiceTTS: {
        provider: 'auto',
        model: 'auto',
        description: 'For text-to-speech conversion',
        preferredProviders: ['openai', 'google'],
        preferredModels: {
          openai: 'gpt-realtime-2',
          google: 'gemini-3.5-flash',
        },
      },
      voiceSTT: {
        provider: 'auto',
        model: 'auto',
        description: 'For speech-to-text conversion',
        preferredProviders: ['openai', 'google'],
        preferredModels: {
          openai: 'gpt-realtime-whisper',
          google: 'gemini-3.5-flash',
        },
      },
      image: {
        provider: 'auto',
        model: 'auto',
        description: 'For image analysis and generation',
        preferredProviders: ['openai', 'google', 'anthropic'],
        preferredModels: {
          openai: 'gpt-5.5',
          google: 'gemini-3.1-pro',
          anthropic: 'claude-sonnet-4.6',
        },
      },
      multimodal: {
        provider: 'auto',
        model: 'auto',
        description: 'For processing text, images, and other media',
        preferredProviders: ['google', 'openai', 'anthropic'],
        preferredModels: {
          google: 'gemini-3.1-pro',
          openai: 'gpt-5.5',
          anthropic: 'claude-sonnet-4.6',
        },
      },
    };

    // Initialize asynchronously to wait for ConfigManager
    this._initPromise = this.initializeAsync();
  }

  async waitForInitialization() {
    if (this.isInitialized) return;
    await this._initPromise;
  }

  async initializeAsync() {
    try {
      // Wait for ConfigManager to be initialized if available
      if (this.configManager && this.configManager.waitForInitialization) {
        console.log('LLMConfigManager: Waiting for ConfigManager initialization...');
        await this.configManager.waitForInitialization();
        console.log('LLMConfigManager: ConfigManager initialized, loading configuration...');
      }

      // Load configuration after ConfigManager is ready
      this.loadConfiguration();
      console.log('LLMConfigManager: Configuration loaded');

      // Initialize UI
      this.initializeUI();
      this.isInitialized = true;
    } catch (error) {
      console.error('LLMConfigManager initialization error:', error);
      // Fallback to immediate initialization
      this.loadConfiguration();
      this.initializeUI();
      this.isInitialized = true;
    }
  }

  initializeUI() {
    // Check if we're in a context where UI elements are available
    if (this.hasRequiredUIElements()) {
      this.setupEventListeners();
      this.updateUI();
    } else {
      console.log('LLMConfigManager: Running in headless mode (no UI elements available)');
    }
  }

  /**
   * Check if required UI elements are available
   */
  hasRequiredUIElements() {
    // Check for key UI elements that LLMConfigManager expects
    const requiredElements = ['optionsBtn', 'configureLLMBtn', 'saveLLMConfigBtn', 'testConnectionBtn'];

    return requiredElements.some(id => document.getElementById(id) !== null);
  }

  setupModelSelectionEventListeners() {
    // Main model selection
    const mainProviderSelect = document.getElementById('mainProvider');
    const mainModelSelect = document.getElementById('mainModel');

    if (mainProviderSelect) {
      mainProviderSelect.addEventListener('change', () => {
        this.updateModelTypeOptions('main');
      });
    }

    if (mainModelSelect) {
      mainModelSelect.addEventListener('change', () => {
        this.toggleCustomModelInput('main');
      });
    }

    // Specialized model types
    const modelTypes = ['voiceTTS', 'voiceSTT', 'image', 'multimodal'];

    modelTypes.forEach(type => {
      const providerSelect = document.getElementById(`${type}Provider`);
      const modelSelect = document.getElementById(`${type}Model`);

      if (providerSelect) {
        providerSelect.addEventListener('change', () => {
          this.updateModelTypeOptions(type);
        });
      }

      if (modelSelect) {
        modelSelect.addEventListener('change', () => {
          this.toggleCustomModelInput(type);
        });
      }
    });

    // Reset model selection button
    const resetBtn = document.getElementById('resetModelSelection');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.resetModelTypeSelection();
      });
    }

    // Test all models button
    const testBtn = document.getElementById('testModelSelection');
    if (testBtn) {
      testBtn.addEventListener('click', () => {
        this.testAllModelTypes();
      });
    }

    // Smart model selection button
    const smartSelectBtn = document.getElementById('smartModelSelection');
    if (smartSelectBtn) {
      smartSelectBtn.addEventListener('click', () => {
        this.applySmartModelSelection();
      });
    }
  }

  updateModelTypeOptions(type) {
    const providerSelect = document.getElementById(`${type}Provider`);
    const modelSelect = document.getElementById(`${type}Model`);

    if (!providerSelect || !modelSelect) return;

    const selectedProvider = providerSelect.value;
    const provider = this.providers[selectedProvider];

    // Clear existing options
    modelSelect.innerHTML = '<option value="auto">Auto (Use provider default)</option>';

    // Check if provider is enabled
    if (selectedProvider !== 'auto' && (!provider || !provider.enabled)) {
      const warningOption = document.createElement('option');
      warningOption.value = 'disabled';
      warningOption.textContent = '⚠️ Provider not configured or enabled';
      warningOption.disabled = true;
      modelSelect.appendChild(warningOption);

      // Show warning message
      this.showProviderWarning(selectedProvider, type);
      return;
    }

    // Populate models based on provider configuration
    if (provider && provider.models) {
      Object.entries(provider.models).forEach(([modelId, modelName]) => {
        const option = document.createElement('option');
        option.value = modelId;
        option.textContent = modelName;
        modelSelect.appendChild(option);
      });
    } else if (provider && provider.availableModels) {
      provider.availableModels.forEach(modelId => {
        const option = document.createElement('option');
        option.value = modelId;
        option.textContent = modelId;
        modelSelect.appendChild(option);
      });
    }

    // Always add Custom Model Name option for non-auto providers
    if (selectedProvider !== 'auto') {
      const customOption = document.createElement('option');
      customOption.value = 'custom';
      customOption.textContent = 'Custom Model Name';
      modelSelect.appendChild(customOption);
    }

    // Set intelligent default if model type has preferred models
    const modelTypeConfig = this.modelTypes[type];
    if (modelTypeConfig && modelTypeConfig.preferredModels && modelTypeConfig.preferredModels[selectedProvider]) {
      const preferredModel = modelTypeConfig.preferredModels[selectedProvider];
      const preferredOption = modelSelect.querySelector(`option[value="${preferredModel}"]`);
      if (preferredOption) {
        modelSelect.value = preferredModel;
        // Add indicator for recommended model
        preferredOption.textContent = `⭐ ${preferredOption.textContent} (Recommended)`;
      }
    }
  }

  resetModelTypeSelection() {
    if (confirm('Are you sure you want to reset all model type selections to defaults?')) {
      Object.keys(this.modelTypes).forEach(type => {
        this.modelTypes[type].provider = 'auto';
        this.modelTypes[type].model = 'auto';
      });

      this.loadModelTypeSelectionToUI();
      this.showNotification('Model type selections reset to defaults', 'success');
    }
  }

  /**
   * Show warning for unconfigured provider
   */
  showProviderWarning(providerName, modelType) {
    const providerDisplayName = this.providers[providerName]?.name || providerName;
    const message = `The ${providerDisplayName} provider is not configured or enabled. Please configure it in the provider tabs before using it for ${modelType} tasks.`;

    // Show a non-intrusive warning
    if (this.showNotification) {
      this.showNotification(message, 'warning', 4000);
    } else {
      console.warn(message);
    }
  }

  /**
   * Get intelligent model recommendation for a model type
   */
  getRecommendedProvider(modelType) {
    const modelTypeConfig = this.modelTypes[modelType];
    if (!modelTypeConfig || !modelTypeConfig.preferredProviders) {
      return this.getFirstEnabledProvider();
    }

    // Find first preferred provider that is enabled
    for (const providerKey of modelTypeConfig.preferredProviders) {
      if (this.providers[providerKey] && this.providers[providerKey].enabled) {
        return providerKey;
      }
    }

    // Fallback to any enabled provider
    return this.getFirstEnabledProvider();
  }

  /**
   * Get first enabled provider
   */
  getFirstEnabledProvider() {
    for (const [key, provider] of Object.entries(this.providers)) {
      if (provider.enabled) {
        return key;
      }
    }
    return null;
  }

  /**
   * Apply smart model selection based on enabled providers
   */
  async applySmartModelSelection() {
    const smartBtn = document.getElementById('smartModelSelection');
    if (!smartBtn) return;

    smartBtn.classList.add('loading');
    smartBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';

    try {
      let selectionsMade = 0;

      // Get enabled providers
      const enabledProviders = Object.keys(this.providers).filter(key => this.providers[key].enabled);

      if (enabledProviders.length === 0) {
        this.showNotification(
          'No LLM providers are enabled. Please configure and enable at least one provider first.',
          'warning'
        );
        return;
      }

      // Apply intelligent selection for each model type
      Object.keys(this.modelTypes).forEach(type => {
        const recommendedProvider = this.getRecommendedProvider(type);
        if (recommendedProvider) {
          const providerSelect = document.getElementById(`${type}Provider`);
          const modelSelect = document.getElementById(`${type}Model`);

          if (providerSelect && providerSelect.value === 'auto') {
            providerSelect.value = recommendedProvider;
            this.updateModelTypeOptions(type);

            // Set recommended model if available
            const modelTypeConfig = this.modelTypes[type];
            const preferredModel =
              modelTypeConfig.preferredModels && modelTypeConfig.preferredModels[recommendedProvider];
            if (preferredModel && modelSelect) {
              const modelOption = modelSelect.querySelector(`option[value="${preferredModel}"]`);
              if (modelOption) {
                modelSelect.value = preferredModel;
              }
            }

            selectionsMade++;
          }
        }
      });

      if (selectionsMade > 0) {
        this.showNotification(
          `Smart selection applied! Updated ${selectionsMade} model type configurations based on your enabled providers and task requirements.`,
          'success'
        );
      } else {
        this.showNotification('All model types are already configured. No changes were made.', 'info');
      }
    } catch (error) {
      this.showNotification(`Smart selection failed: ${error.message}`, 'error');
    } finally {
      smartBtn.classList.remove('loading');
      smartBtn.innerHTML = '<i class="fas fa-magic"></i> Smart Selection';
    }
  }

  async testAllModelTypes() {
    const testBtn = document.getElementById('testModelSelection');
    if (!testBtn) return;

    // Update button state
    testBtn.classList.add('testing');
    testBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...';

    try {
      const results = {};
      const modelTypes = ['reasoning', 'task', 'code', 'voiceTTS', 'voiceSTT', 'image', 'multimodal'];

      for (const type of modelTypes) {
        const providerSelect = document.getElementById(`${type}Provider`);
        const modelSelect = document.getElementById(`${type}Model`);

        if (providerSelect && modelSelect) {
          const provider = providerSelect.value;
          const model = modelSelect.value;

          if (provider !== 'auto' && model !== 'auto') {
            try {
              const providerConfig = this.providers[provider];
              if (providerConfig && providerConfig.enabled) {
                // Test the specific model
                await this.makeTestRequest(provider, providerConfig);
                results[type] = { success: true, provider, model };
              } else {
                results[type] = { success: false, error: 'Provider not enabled', provider, model };
              }
            } catch (error) {
              results[type] = { success: false, error: error.message, provider, model };
            }
          } else {
            results[type] = { success: true, provider: 'auto', model: 'auto', note: 'Using auto selection' };
          }
        }
      }

      // Show results
      const successCount = Object.values(results).filter(r => r.success).length;
      const totalCount = Object.keys(results).length;

      testBtn.classList.remove('testing');
      testBtn.classList.add('success');
      testBtn.innerHTML = `<i class="fas fa-check"></i> ${successCount}/${totalCount} Models OK`;

      this.showNotification(`Model testing completed: ${successCount}/${totalCount} models working`, 'success');
    } catch (error) {
      testBtn.classList.remove('testing');
      testBtn.classList.add('error');
      testBtn.innerHTML = '<i class="fas fa-times"></i> Test Failed';
      this.showNotification(`Model testing failed: ${error.message}`, 'error');
    }

    // Reset button after 3 seconds
    setTimeout(() => {
      testBtn.classList.remove('testing', 'success', 'error');
      testBtn.innerHTML = '<i class="fas fa-check"></i> Test All Models';
    }, 3000);
  }

  loadModelTypeSelectionToUI() {
    // Load main model configuration
    const mainProviderSelect = document.getElementById('mainProvider');
    const mainModelSelect = document.getElementById('mainModel');
    const mainCustomModelInput = document.getElementById('mainCustomModel');

    if (mainProviderSelect && this.modelTypes.main) {
      mainProviderSelect.value = this.modelTypes.main.provider || 'auto';
      this.updateModelTypeOptions('main');
    }

    if (mainModelSelect && this.modelTypes.main) {
      if (this.modelTypes.main.model && this.modelTypes.main.model !== 'auto') {
        // Check if it's a custom model name
        const isCustomModel = !this.isKnownModel(this.modelTypes.main.model, this.modelTypes.main.provider);
        if (isCustomModel) {
          mainModelSelect.value = 'custom';
          if (mainCustomModelInput) {
            mainCustomModelInput.value = this.modelTypes.main.model;
          }
          this.toggleCustomModelInput('main');
        } else {
          mainModelSelect.value = this.modelTypes.main.model;
        }
      } else {
        mainModelSelect.value = 'auto';
      }
    }

    // Load specialized model configurations
    const modelTypes = ['voiceTTS', 'voiceSTT', 'image', 'multimodal'];

    modelTypes.forEach(type => {
      const providerSelect = document.getElementById(`${type}Provider`);
      const modelSelect = document.getElementById(`${type}Model`);
      const customModelInput = document.getElementById(`${type}CustomModel`);

      if (providerSelect && this.modelTypes[type]) {
        providerSelect.value = this.modelTypes[type].provider || 'auto';
        this.updateModelTypeOptions(type);
      }

      if (modelSelect && this.modelTypes[type]) {
        if (this.modelTypes[type].model && this.modelTypes[type].model !== 'auto') {
          // Check if it's a custom model name
          const isCustomModel = !this.isKnownModel(this.modelTypes[type].model, this.modelTypes[type].provider);
          if (isCustomModel) {
            modelSelect.value = 'custom';
            if (customModelInput) {
              customModelInput.value = this.modelTypes[type].model;
            }
            this.toggleCustomModelInput(type);
          } else {
            modelSelect.value = this.modelTypes[type].model;
          }
        } else {
          modelSelect.value = 'auto';
        }
      }
    });
  }

  saveModelTypeSelection() {
    // Save main model configuration
    const mainProviderSelect = document.getElementById('mainProvider');
    const mainModelSelect = document.getElementById('mainModel');
    const mainCustomModelInput = document.getElementById('mainCustomModel');

    if (mainProviderSelect) {
      this.modelTypes.main = this.modelTypes.main || {};
      this.modelTypes.main.provider = mainProviderSelect.value;
    }

    if (mainModelSelect) {
      this.modelTypes.main = this.modelTypes.main || {};
      if (mainModelSelect.value === 'custom' && mainCustomModelInput) {
        this.modelTypes.main.model = mainCustomModelInput.value;
      } else {
        this.modelTypes.main.model = mainModelSelect.value;
      }
    }

    // Save specialized model configurations
    const modelTypes = ['voiceTTS', 'voiceSTT', 'image', 'multimodal'];

    modelTypes.forEach(type => {
      const providerSelect = document.getElementById(`${type}Provider`);
      const modelSelect = document.getElementById(`${type}Model`);
      const customModelInput = document.getElementById(`${type}CustomModel`);

      if (providerSelect) {
        this.modelTypes[type] = this.modelTypes[type] || {};
        this.modelTypes[type].provider = providerSelect.value;
      }

      if (modelSelect) {
        this.modelTypes[type] = this.modelTypes[type] || {};
        if (modelSelect.value === 'custom' && customModelInput) {
          this.modelTypes[type].model = customModelInput.value;
        } else {
          this.modelTypes[type].model = modelSelect.value;
        }
      }
    });
  }

  getModelTypeConfiguration(type) {
    return this.modelTypes[type] || { provider: 'auto', model: 'auto' };
  }

  setupEventListeners() {
    // Ensure DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupEventListeners());
      return;
    }

    // Double-check that UI elements are available before setting up listeners
    if (!this.hasRequiredUIElements()) {
      console.log('LLMConfigManager: Skipping event listener setup - no UI elements found');
      return;
    }

    console.log('Setting up LLM Config Manager event listeners...');

    // Options menu dropdown - Handled by UIManager now

    // Configure LLM button
    const configureLLMBtn = document.getElementById('configureLLMBtn');
    if (configureLLMBtn) {
      configureLLMBtn.addEventListener('click', () => {
        console.log('Configure LLM button clicked');
        this.showConfigModal();
      });
    }

    // Provider tabs - ONLY select tabs in LLM config modal
    document.querySelectorAll('#llmConfigModal .tab-button').forEach(button => {
      button.addEventListener('click', () => {
        this.switchProviderTab(button.dataset.provider);
      });
    });

    // Save configuration
    const saveLLMConfigBtn = document.getElementById('saveLLMConfigBtn');
    if (saveLLMConfigBtn) {
      saveLLMConfigBtn.addEventListener('click', () => {
        this.saveConfiguration();
      });
    }

    // Test connection
    const testConnectionBtn = document.getElementById('testConnectionBtn');
    if (testConnectionBtn) {
      testConnectionBtn.addEventListener('click', () => {
        this.testConnection();
      });
    }

    // Save Provider Info buttons
    const providerNames = [
      'openai',
      'anthropic',
      'google',
      'deepseek',
      'siliconflow',
      'openrouter',
      'minimax',
      'minimax_cn',
      'local',
    ];
    providerNames.forEach(provider => {
      const saveBtn = document.getElementById(`save${provider.charAt(0).toUpperCase() + provider.slice(1)}ProviderBtn`);
      if (saveBtn) {
        saveBtn.addEventListener('click', () => {
          this.saveProviderInfo(provider);
        });
      }
    });

    // Local model select change
    const localModelSelect = document.getElementById('localModel');
    if (localModelSelect) {
      localModelSelect.addEventListener('change', event => {
        const otherModelGroup = document.getElementById('localModelOtherGroup');
        if (event.target.value === 'other') {
          otherModelGroup.style.display = 'block';
        } else {
          otherModelGroup.style.display = 'none';
        }
      });
    }

    // Cloud provider model select change - toggle custom model name input
    const cloudProviders = [
      'openai',
      'anthropic',
      'google',
      'deepseek',
      'siliconflow',
      'openrouter',
      'minimax',
      'minimax_cn',
    ];
    cloudProviders.forEach(provider => {
      const modelSelect = document.getElementById(`${provider}Model`);
      if (modelSelect) {
        modelSelect.addEventListener('change', event => {
          const otherModelGroup = document.getElementById(`${provider}ModelOtherGroup`);
          if (otherModelGroup) {
            otherModelGroup.style.display = event.target.value === 'other' ? 'block' : 'none';
          }
        });
      }
    });

    // Add event listeners for all new paste buttons
    const pasteButtonConfigs = [
      { btnId: 'pasteOpenaiApiKeyBtn', inputId: 'openaiApiKey' },
      { btnId: 'pasteAnthropicApiKeyBtn', inputId: 'anthropicApiKey' },
      { btnId: 'pasteGoogleApiKeyBtn', inputId: 'googleApiKey' },
      { btnId: 'pasteDeepseekApiKeyBtn', inputId: 'deepseekApiKey' },
      { btnId: 'pasteSiliconflowApiKeyBtn', inputId: 'siliconflowApiKey' },
      { btnId: 'pasteOpenrouterApiKeyBtn', inputId: 'openrouterApiKey' },
      { btnId: 'pasteMinimaxApiKeyBtn', inputId: 'minimaxApiKey' },
      { btnId: 'pasteMinimax_cnApiKeyBtn', inputId: 'minimax_cnApiKey' },
      { btnId: 'pasteLocalApiKeyBtn', inputId: 'localApiKey' },
    ];

    // Model Selection tab event listeners
    this.setupModelSelectionEventListeners();

    pasteButtonConfigs.forEach(config => {
      const pasteBtn = document.getElementById(config.btnId);
      const apiKeyInput = document.getElementById(config.inputId);

      if (pasteBtn && apiKeyInput) {
        pasteBtn.addEventListener('click', async () => {
          try {
            const text = await navigator.clipboard.readText();
            apiKeyInput.value = text;
            console.log(`Pasted content into ${config.inputId}`);
          } catch (err) {
            console.error('Failed to read clipboard contents: ', err);
            this.showNotification(
              'Failed to paste from clipboard. Ensure permissions are granted if prompted.',
              'error'
            );
          }
        });
      }
    });

    // Close dropdown when clicking outside - Handled by UIManager now

    // Modal close handlers
    document.querySelectorAll('#llmConfigModal .modal-close').forEach(btn => {
      btn.addEventListener('click', () => {
        this.hideConfigModal();
      });
    });

    // Custom Endpoint - Saved Configuration management buttons
    const saveLocalConfigBtn = document.getElementById('saveLocalConfigBtn');
    if (saveLocalConfigBtn) {
      saveLocalConfigBtn.addEventListener('click', () => {
        this.saveLocalConfig();
      });
    }
    const deleteLocalConfigBtn = document.getElementById('deleteLocalConfigBtn');
    if (deleteLocalConfigBtn) {
      deleteLocalConfigBtn.addEventListener('click', () => {
        this.deleteLocalConfig();
      });
    }

    // New configuration button - clears the form for a new entry
    const newLocalConfigBtn = document.getElementById('newLocalConfigBtn');
    if (newLocalConfigBtn) {
      newLocalConfigBtn.addEventListener('click', () => {
        this.newLocalConfig();
      });
    }

    // When selecting a saved config from the dropdown, auto-load it
    const localSavedConfigsList = document.getElementById('localSavedConfigsList');
    if (localSavedConfigsList) {
      localSavedConfigsList.addEventListener('change', () => {
        if (localSavedConfigsList.value) {
          this.loadLocalConfig();
        }
      });
    }

    // Load saved configurations list on init
    this.refreshLocalSavedConfigs();
  }

  hideOptionsDropdown() {
    if (this.genomeBrowser && this.genomeBrowser.uiManager) {
      this.genomeBrowser.uiManager.closeOptionsDropdown();
    }
  }

  showConfigModal() {
    this.hideOptionsDropdown();
    this.loadConfigurationToUI();

    // Reset drag position so modal re-centers on open
    if (window.modalDragManager) {
      window.modalDragManager.resetPosition('#llmConfigModal');
    }

    document.getElementById('llmConfigModal').classList.add('show');

    // Ensure no element has initial focus to prevent blue scrollbar
    document.activeElement.blur();
  }

  hideConfigModal() {
    document.getElementById('llmConfigModal').classList.remove('show');
  }

  switchProviderTab(provider) {
    // Update tab buttons - ONLY in LLM config modal
    document.querySelectorAll('#llmConfigModal .tab-button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.provider === provider);
      // Remove focus from all buttons to prevent blue outline
      btn.blur();
    });

    // Update provider config panels
    document.querySelectorAll('.provider-config').forEach(panel => {
      panel.classList.toggle('active', panel.id === `${provider}-config`);
      // Ensure no element in the panel has focus
      if (panel.id === `${provider}-config`) {
        panel.focus();
      }
    });

    // Special handling for models tab
    if (provider === 'models') {
      this.loadModelTypeSelectionToUI();
    }
  }

  loadConfiguration() {
    console.log('=== LLMConfigManager.loadConfiguration Debug Start ===');
    try {
      if (this.configManager) {
        console.log('Using ConfigManager for loading LLM configuration');
        // Use ConfigManager if available
        const llmConfig = this.configManager.get('llm');
        console.log('Retrieved LLM config from ConfigManager:', llmConfig);

        if (llmConfig && llmConfig.providers) {
          console.log('LLM config has providers, merging...');
          console.log('Existing providers:', Object.keys(this.providers));
          console.log('Loaded providers:', Object.keys(llmConfig.providers));

          this.providers = { ...this.providers, ...llmConfig.providers };

          // Load model types if available
          if (llmConfig.modelTypes) {
            this.modelTypes = { ...this.modelTypes, ...llmConfig.modelTypes };
            console.log('Model types loaded:', this.modelTypes);
          }
          console.log('After merge - providers:', Object.keys(this.providers));

          // Debug each provider's status
          Object.entries(this.providers).forEach(([key, provider]) => {
            console.log(`Provider ${key}:`, {
              enabled: provider.enabled,
              hasApiKey: !!provider.apiKey,
              model: provider.model,
            });
          });
        } else {
          console.log('No LLM providers found in ConfigManager config');
        }

        // Restore saved local configs from ConfigManager (file-based storage)
        // so they survive Electron restarts. Only migrate if localStorage is empty
        // to avoid overwriting newer localStorage data.
        const savedLocalConfigs = this.configManager.get('llm.localCustomConfigs');
        if (savedLocalConfigs && Object.keys(savedLocalConfigs).length > 0) {
          const existingLocalConfigs = this.getLocalSavedConfigs();
          if (Object.keys(existingLocalConfigs).length === 0) {
            console.log('Restoring localCustomConfigs from ConfigManager:', Object.keys(savedLocalConfigs));
            this.persistLocalSavedConfigs(savedLocalConfigs);
          } else {
            console.log('localCustomConfigs already in localStorage, skipping ConfigManager restore');
          }
        }
      } else {
        console.log('No ConfigManager available, using localStorage fallback');
        // Fallback to localStorage
        const savedConfig = localStorage.getItem('llmConfiguration');
        if (savedConfig) {
          console.log('Found LLM configuration in localStorage');
          const config = JSON.parse(savedConfig);
          this.providers = { ...this.providers, ...config.providers };

          // Load model types if available
          if (config.modelTypes) {
            this.modelTypes = { ...this.modelTypes, ...config.modelTypes };
          }
        } else {
          console.log('No LLM configuration found in localStorage');
        }
      }
    } catch (error) {
      console.error('Error loading LLM configuration:', error);
    }
    console.log('=== LLMConfigManager.loadConfiguration Debug End ===');
  }

  /**
   * Save individual provider information without closing the modal
   */
  async saveProviderInfo(providerName) {
    try {
      const provider = this.providers[providerName];
      if (!provider) {
        console.error(`Provider ${providerName} not found`);
        return;
      }

      const prefix = providerName;

      // Update provider configuration from form fields
      const apiKeyField = document.getElementById(`${prefix}ApiKey`);
      if (apiKeyField) {
        provider.apiKey = apiKeyField.value;
      }

      if (providerName === 'local') {
        const localModelSelect = document.getElementById('localModel');
        if (localModelSelect && localModelSelect.value === 'other') {
          provider.model = document.getElementById('localModelOther').value;
        } else if (localModelSelect) {
          provider.model = localModelSelect.value;
        }
        provider.baseUrl = document.getElementById('localEndpoint').value;
        provider.streamingSupport = document.getElementById('localStreamingSupport').checked;
      } else {
        const modelField = document.getElementById(`${prefix}Model`);
        if (modelField) {
          if (modelField.value === 'other') {
            const otherModelInput = document.getElementById(`${prefix}ModelOther`);
            provider.model = otherModelInput ? otherModelInput.value : '';
          } else {
            provider.model = modelField.value;
          }
        }
        const baseUrlField = document.getElementById(`${prefix}BaseUrl`);
        if (baseUrlField) {
          provider.baseUrl = baseUrlField.value;
        }
      }

      // Set as enabled if it has required fields
      provider.enabled = !!(provider.apiKey || providerName === 'local') && provider.model;

      // Sync all providers' form values to in-memory state before persisting.
      // This prevents saveProviderInfo(providerA) from overwriting providerB's
      // unsaved form changes with stale in-memory values.
      this.syncAllProvidersFromForm();

      // Save to ConfigManager or localStorage
      if (this.configManager) {
        await this.configManager.set('llm.providers', this.providers);
        await this.configManager.set('llm.modelTypes', this.modelTypes);
        // Also persist localCustomConfigs to ConfigManager so saved endpoint
        // configurations survive across Electron restarts (file-based storage)
        const localCustomConfigs = this.getLocalSavedConfigs();
        await this.configManager.set('llm.localCustomConfigs', localCustomConfigs);
        await this.configManager.saveConfig();
      } else {
        localStorage.setItem(
          'llmConfiguration',
          JSON.stringify({
            providers: this.providers,
            modelTypes: this.modelTypes,
          })
        );
      }

      this.showNotification(`${provider.name} configuration saved successfully!`, 'success');
      console.log(`${provider.name} configuration saved:`, provider);
    } catch (error) {
      console.error(`Error saving ${providerName} configuration:`, error);
      this.showNotification(`Error saving ${providerName} configuration`, 'error');
    }
  }

  /**
   * Read all providers' form fields into this.providers so that a
   * per-provider save does not accidentally overwrite another provider's
   * unsaved form changes with stale in-memory values.
   */
  syncAllProvidersFromForm() {
    Object.keys(this.providers).forEach(providerKey => {
      const provider = this.providers[providerKey];
      const prefix = providerKey;

      const apiKeyField = document.getElementById(`${prefix}ApiKey`);
      if (apiKeyField) {
        provider.apiKey = apiKeyField.value;
      }

      if (providerKey === 'local') {
        const localModelSelect = document.getElementById('localModel');
        if (localModelSelect) {
          if (localModelSelect.value === 'other') {
            provider.model = document.getElementById('localModelOther')?.value || '';
          } else {
            provider.model = localModelSelect.value;
          }
        }
        const endpointField = document.getElementById('localEndpoint');
        if (endpointField) provider.baseUrl = endpointField.value;
        const streamingField = document.getElementById('localStreamingSupport');
        if (streamingField) provider.streamingSupport = streamingField.checked;
      } else {
        const modelField = document.getElementById(`${prefix}Model`);
        if (modelField) {
          if (modelField.value === 'other') {
            const otherModelInput = document.getElementById(`${prefix}ModelOther`);
            provider.model = otherModelInput ? otherModelInput.value : '';
          } else {
            provider.model = modelField.value;
          }
        }
        const baseUrlField = document.getElementById(`${prefix}BaseUrl`);
        if (baseUrlField) {
          provider.baseUrl = baseUrlField.value;
        }
      }

      provider.enabled = !!(provider.apiKey || providerKey === 'local') && provider.model;
    });
  }

  /**
   * Toggle custom model input visibility
   */
  toggleCustomModelInput(type) {
    const modelSelect = document.getElementById(`${type}Model`);
    const customGroup = document.getElementById(`${type}CustomModelGroup`);

    if (modelSelect && customGroup) {
      if (modelSelect.value === 'custom') {
        customGroup.style.display = 'block';
      } else {
        customGroup.style.display = 'none';
      }
    }
  }

  /**
   * Check if a model is a known model for a given provider
   */
  isKnownModel(modelName, providerName) {
    if (!modelName || modelName === 'auto' || modelName === 'custom' || modelName === 'other') {
      return true;
    }

    const provider = this.providers[providerName];
    if (!provider) {
      return false;
    }

    // Check if model is in provider's available models
    if (provider.availableModels && provider.availableModels.includes(modelName)) {
      return true;
    }

    // Check if model is in provider's models object
    if (provider.models && Object.values(provider.models).includes(modelName)) {
      return true;
    }

    // Check if model matches provider's default model
    if (provider.model === modelName) {
      return true;
    }

    return false;
  }

  async saveConfiguration() {
    try {
      // Update provider configurations from form fields
      Object.keys(this.providers).forEach(providerKey => {
        const provider = this.providers[providerKey];
        const prefix = providerKey;

        const apiKeyField = document.getElementById(`${prefix}ApiKey`);
        if (apiKeyField) {
          provider.apiKey = apiKeyField.value;
        }

        if (providerKey === 'local') {
          const localModelSelect = document.getElementById('localModel');
          if (localModelSelect.value === 'other') {
            provider.model = document.getElementById('localModelOther').value;
          } else {
            provider.model = localModelSelect.value;
          }
          provider.baseUrl = document.getElementById('localEndpoint').value;
          provider.streamingSupport = document.getElementById('localStreamingSupport').checked;
        } else {
          const modelField = document.getElementById(`${prefix}Model`);
          if (modelField) {
            if (modelField.value === 'other') {
              const otherModelInput = document.getElementById(`${prefix}ModelOther`);
              provider.model = otherModelInput ? otherModelInput.value : '';
            } else {
              provider.model = modelField.value;
            }
          }
          const baseUrlField = document.getElementById(`${prefix}BaseUrl`);
          if (baseUrlField) {
            provider.baseUrl = baseUrlField.value;
          }
        }

        // Set as enabled if it has required fields
        provider.enabled = !!(provider.apiKey || providerKey === 'local') && provider.model;
      });

      // Enable provider if it has valid configuration
      // No need to set a single "current provider" since we use model types now

      // Save model type selection
      this.saveModelTypeSelection();

      if (this.configManager) {
        // Use ConfigManager if available (now with async support)
        await this.configManager.set('llm.providers', this.providers);
        await this.configManager.set('llm.modelTypes', this.modelTypes);
        // Also persist localCustomConfigs so saved endpoint configurations
        // survive across Electron restarts (file-based storage)
        const localCustomConfigs = this.getLocalSavedConfigs();
        await this.configManager.set('llm.localCustomConfigs', localCustomConfigs);
        await this.configManager.saveConfig();
        console.log('Configuration saved via ConfigManager');
      } else {
        // Fallback to localStorage
        const config = {
          providers: this.providers,
          modelTypes: this.modelTypes,
        };
        localStorage.setItem('llmConfiguration', JSON.stringify(config));
        console.log('Configuration saved to localStorage');
      }

      this.updateUI();
      this.hideConfigModal();

      // Show success message
      this.showNotification('Configuration saved successfully!', 'success');
    } catch (error) {
      console.error('Error saving LLM configuration:', error);
      this.showNotification('Error saving configuration: ' + error.message, 'error');
    }
  }

  loadConfigurationToUI() {
    Object.keys(this.providers).forEach(providerKey => {
      const provider = this.providers[providerKey];
      const prefix = providerKey;

      const apiKeyField = document.getElementById(`${prefix}ApiKey`);
      const modelField = document.getElementById(`${prefix}Model`);
      const baseUrlField = document.getElementById(`${prefix}BaseUrl`);

      if (apiKeyField) {
        apiKeyField.value = provider.apiKey || '';

        // Ensure paste listener is attached
        if (!apiKeyField.dataset.pasteListenerAttached) {
          apiKeyField.addEventListener('paste', event => {
            console.log(`Paste event triggered for: ${apiKeyField.id}`);
            event.preventDefault();
            event.stopPropagation();
            const pasteData = (event.clipboardData || window.clipboardData).getData('text');
            console.log(`Pasted data for ${apiKeyField.id}: ${pasteData}`);
            apiKeyField.value = pasteData;
            console.log(`Set ${apiKeyField.id} value to: ${apiKeyField.value}`);
          });
          apiKeyField.dataset.pasteListenerAttached = 'true';
          console.log(`Paste listener added to ${apiKeyField.id}`);
        }
      }

      if (providerKey === 'local') {
        const localModelSelect = document.getElementById('localModel');
        const localModelOther = document.getElementById('localModelOther');
        const localModelOtherGroup = document.getElementById('localModelOtherGroup');
        const localEndpointField = document.getElementById('localEndpoint');
        const localStreamingField = document.getElementById('localStreamingSupport');

        if (localEndpointField) localEndpointField.value = provider.baseUrl || 'http://localhost:11434/v1';
        if (localStreamingField) localStreamingField.checked = provider.streamingSupport || false;

        let modelIsOther = true;
        if (localModelSelect) {
          for (let i = 0; i < localModelSelect.options.length; i++) {
            if (localModelSelect.options[i].value === provider.model) {
              localModelSelect.value = provider.model;
              modelIsOther = false;
              break;
            }
          }
        }
        if (modelIsOther && provider.model) {
          if (localModelSelect) localModelSelect.value = 'other';
          if (localModelOther) localModelOther.value = provider.model;
        }
        if (localModelOtherGroup) {
          localModelOtherGroup.style.display =
            localModelSelect && localModelSelect.value === 'other' ? 'block' : 'none';
        }
      } else {
        if (modelField) {
          // Check if the saved model is in the dropdown options
          let modelIsOther = true;
          for (let i = 0; i < modelField.options.length; i++) {
            if (modelField.options[i].value === provider.model) {
              modelField.value = provider.model;
              modelIsOther = false;
              break;
            }
          }
          if (modelIsOther && provider.model) {
            modelField.value = 'other';
            const otherModelInput = document.getElementById(`${prefix}ModelOther`);
            if (otherModelInput) otherModelInput.value = provider.model;
          }
          // Show/hide the custom model group
          const otherModelGroup = document.getElementById(`${prefix}ModelOtherGroup`);
          if (otherModelGroup) {
            otherModelGroup.style.display = modelField.value === 'other' ? 'block' : 'none';
          }
        }
        if (baseUrlField) baseUrlField.value = provider.baseUrl || '';
      }
    });

    // Load model type selection
    this.loadModelTypeSelectionToUI();
  }

  updateUI() {
    // Skip UI updates if not in UI mode
    if (!this.hasRequiredUIElements()) {
      return;
    }

    // No need to update current provider display since it's removed
    // UI updates can be added here for other purposes if needed
  }

  async testConnection() {
    const activeTab = document.querySelector('#llmConfigModal .tab-button.active').dataset.provider;
    const testBtn = document.getElementById('testConnectionBtn');

    // The "models" tab is not a provider — cannot test connection there
    if (activeTab === 'models') {
      this.showNotification('Please switch to a provider tab to test the connection.', 'warning');
      return;
    }

    // Update button state
    testBtn.classList.add('testing');
    testBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...';

    try {
      // Get current form values based on provider
      const provider = { ...this.providers[activeTab] };
      const prefix = activeTab;

      // Read API key from form
      const apiKeyField = document.getElementById(`${prefix}ApiKey`);
      if (apiKeyField) {
        provider.apiKey = apiKeyField.value;
      }

      // Read model from form (handle "other" custom model)
      const modelSelect = document.getElementById(`${prefix}Model`);
      if (modelSelect && modelSelect.value === 'other') {
        const otherModelInput = document.getElementById(`${prefix}ModelOther`);
        provider.model = otherModelInput ? otherModelInput.value : '';
      } else if (modelSelect) {
        provider.model = modelSelect.value;
      }

      // Read base URL from form (different ID for local provider)
      if (activeTab === 'local') {
        provider.baseUrl = document.getElementById('localEndpoint')?.value || provider.baseUrl;
      } else {
        const baseUrlField = document.getElementById(`${prefix}BaseUrl`);
        if (baseUrlField) {
          provider.baseUrl = baseUrlField.value;
        }
      }

      // Validate required fields before testing
      if (activeTab !== 'local' && !provider.apiKey) {
        throw new Error('API Key is required. Please enter your API key before testing.');
      }
      if (!provider.model) {
        throw new Error('Model is required. Please select or enter a model name before testing.');
      }
      if (activeTab === 'local' && !provider.baseUrl) {
        throw new Error('API Endpoint is required. Please enter the endpoint URL before testing.');
      }

      // Test the connection
      const result = await this.makeTestRequest(activeTab, provider);

      if (result.success) {
        testBtn.classList.remove('testing');
        testBtn.classList.add('success');
        testBtn.innerHTML = '<i class="fas fa-check"></i> Connected!';
        this.showNotification('Connection successful!', 'success');
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      testBtn.classList.remove('testing');
      testBtn.classList.add('error');
      testBtn.innerHTML = '<i class="fas fa-times"></i> Failed';
      this.showNotification(`Connection failed: ${error.message}`, 'error');
    }

    // Reset button after 3 seconds
    setTimeout(() => {
      testBtn.classList.remove('testing', 'success', 'error');
      testBtn.innerHTML = '<i class="fas fa-plug"></i> Test Connection';
    }, 3000);
  }

  async makeTestRequest(providerType, config) {
    try {
      switch (providerType) {
        case 'openai':
          return await this.testOpenAI(config);
        case 'anthropic':
          return await this.testAnthropic(config);
        case 'google':
          return await this.testGoogle(config);
        case 'deepseek':
          return await this.testDeepSeek(config);
        case 'siliconflow':
          return await this.testSiliconFlow(config);
        case 'openrouter':
          return await this.testOpenRouter(config);
        case 'minimax':
          return await this.testMinimax(config);
        case 'minimax_cn':
          return await this.testMinimax_cn(config);
        case 'local':
          return await this.testLocal(config);
        default:
          throw new Error('Unknown provider type');
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async testOpenAI(config) {
    const baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    const response = await fetch(`${baseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${response.statusText}${errorBody ? ` - ${errorBody}` : ''}`);
    }

    // Validate that the configured model is accessible
    try {
      const data = await response.json();
      const modelId = data?.data?.find(m => m.id === config.model);
      if (!modelId) {
        // Model not found in list, but API key is valid — still a success
        console.warn(`Model "${config.model}" not found in available models list, but API key is valid.`);
      }
    } catch (parseError) {
      // If we can't parse the model list, still report success since the API responded OK
    }

    return { success: true };
  }

  async testAnthropic(config) {
    const baseUrl = config.baseUrl || 'https://api.anthropic.com';
    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': config.apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }],
      }),
    });

    if (!response.ok) {
      let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.error?.message) {
          errorMsg += ` - ${errorData.error.message}`;
        }
      } catch (e) {
        // Ignore parse errors
      }
      throw new Error(errorMsg);
    }

    return { success: true };
  }

  async testGoogle(config) {
    const baseUrl = config.baseUrl || 'https://generativelanguage.googleapis.com';
    // Use the same v1beta API path as sendGoogleMessage
    const apiUrl = `${baseUrl}/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'test' }] }],
        generationConfig: { maxOutputTokens: 1 },
      }),
    });

    if (!response.ok) {
      let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorBody = await response.text();
        if (errorBody) errorMsg += ` - ${errorBody}`;
      } catch (e) {
        // Ignore parse errors
      }
      throw new Error(errorMsg);
    }

    return { success: true };
  }

  async testDeepSeek(config) {
    const baseUrl = config.baseUrl || 'https://api.deepseek.com/v1';
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
      }),
    });

    if (!response.ok) {
      let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.error?.message) {
          errorMsg += ` - ${errorData.error.message}`;
        }
      } catch (e) {
        // Ignore parse errors
      }
      throw new Error(errorMsg);
    }

    return { success: true };
  }

  async testSiliconFlow(config) {
    const baseUrl = config.baseUrl || 'https://api.siliconflow.cn/v1';
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
      }),
    });

    if (!response.ok) {
      let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.error?.message) {
          errorMsg += ` - ${errorData.error.message}`;
        } else if (errorData.message) {
          errorMsg += ` - ${errorData.message}`;
        }
      } catch (e) {
        // Ignore parse errors
      }
      throw new Error(errorMsg);
    }

    return { success: true };
  }

  async testOpenRouter(config) {
    const baseUrl = config.baseUrl || 'https://openrouter.ai/api/v1';
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'GenomeExplorer',
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
      }),
    });

    if (!response.ok) {
      let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.error?.message) {
          errorMsg += ` - ${errorData.error.message}`;
        }
      } catch (e) {
        // Ignore parse errors
      }
      throw new Error(errorMsg);
    }

    return { success: true };
  }

  async testMinimax(config) {
    const baseUrl = config.baseUrl || 'https://api.minimax.io/v1';
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
      }),
    });

    if (!response.ok) {
      let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.error?.message) {
          errorMsg += ` - ${errorData.error.message}`;
        } else if (errorData.message) {
          errorMsg += ` - ${errorData.message}`;
        }
      } catch (e) {
        // Ignore parse errors
      }
      throw new Error(errorMsg);
    }

    return { success: true };
  }

  async testMinimax_cn(config) {
    const baseUrl = config.baseUrl || 'https://api.minimaxi.com/v1';
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
      }),
    });

    if (!response.ok) {
      let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.error?.message) {
          errorMsg += ` - ${errorData.error.message}`;
        } else if (errorData.message) {
          errorMsg += ` - ${errorData.message}`;
        }
      } catch (e) {
        // Ignore parse errors
      }
      throw new Error(errorMsg);
    }

    return { success: true };
  }

  async testLocal(config) {
    const baseUrl = config.baseUrl || 'http://localhost:11434/v1';
    const response = await fetch(`${baseUrl}/models`, {
      headers: config.apiKey
        ? {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          }
        : {
            'Content-Type': 'application/json',
          },
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(
        `HTTP ${response.status}: ${response.statusText}${errorBody ? ` - ${errorBody}` : ''}. ` +
          `Make sure your local LLM server (Ollama, LMStudio, etc.) is running at ${baseUrl}`
      );
    }

    // Validate the model exists in local server
    try {
      const data = await response.json();
      const availableModels = data?.data?.map(m => m.id) || [];
      if (availableModels.length > 0 && config.model && !availableModels.includes(config.model)) {
        throw new Error(
          `Model "${config.model}" not found on local server. ` +
            `Available models: ${availableModels.slice(0, 10).join(', ')}${availableModels.length > 10 ? '...' : ''}`
        );
      }
    } catch (error) {
      // Re-throw model-not-found errors
      if (error.message.includes('not found on local server')) {
        throw error;
      }
      // If we can't parse the model list, still report success since the server responded
    }

    return { success: true };
  }

  async sendMessage(message, context = null, memoryContext = null) {
    // Get the best available provider for task model type
    const providerKey = this.getProviderForModelType('task');
    if (!providerKey) {
      throw new Error('No LLM provider configured');
    }

    const provider = this.providers[providerKey];

    try {
      switch (providerKey) {
        case 'openai':
          return await this.sendOpenAIMessage(provider, message, context, memoryContext);
        case 'anthropic':
          return await this.sendAnthropicMessage(provider, message, context, memoryContext);
        case 'google':
          return await this.sendGoogleMessage(provider, message, context, memoryContext);
        case 'deepseek':
          return await this.sendDeepSeekMessage(provider, message, context, memoryContext);
        case 'siliconflow':
          return await this.sendSiliconFlowMessage(provider, message, context, memoryContext);
        case 'openrouter':
          return await this.sendOpenRouterMessage(provider, message, context, memoryContext);
        case 'minimax':
          return await this.sendMinimaxMessage(provider, message, context, memoryContext);
        case 'minimax_cn':
          return await this.sendMinimax_cnMessage(provider, message, context, memoryContext);
        case 'local':
          return await this.sendLocalMessage(provider, message, context, memoryContext);
        default:
          throw new Error('Unknown provider type');
      }
    } catch (error) {
      console.error('Error sending message to LLM:', error);
      throw error;
    }
  }

  /**
   * @param {object} [options] Streaming hooks. `onToken(text)` receives visible
   *   text as it arrives; `onStreamReset()` is invoked if a stream fails partway
   *   so the caller can discard partial text before the non-streaming retry;
   *   `signal` aborts an in-flight stream.
   */
  async sendMessageWithHistory(conversationHistory, context = null, memoryContext = null, options = {}) {
    // Get the best available provider for task model type
    const primaryProvider = this.getProviderForModelType('task');
    if (!primaryProvider) {
      throw new Error('No LLM provider configured');
    }

    let lastError;

    // Try primary provider first
    try {
      return await this.sendMessageWithProvider(primaryProvider, conversationHistory, context, memoryContext, options);
    } catch (error) {
      lastError = error;
      console.warn(`Primary provider ${primaryProvider} failed:`, error.message);

      // Only try fallback if it's a service unavailable error and fallback is enabled
      if (this.shouldTryFallback(error)) {
        const fallbackProvider = this.getFallbackProvider(primaryProvider);

        if (fallbackProvider) {
          console.log(`Attempting fallback to ${fallbackProvider}...`);
          if (this.app && this.app.showNotification) {
            this.app.showNotification(
              `Primary LLM service unavailable. Trying fallback provider (${this.providers[fallbackProvider].name})...`,
              'warning',
              3000
            );
          }

          try {
            // Switching providers restarts generation, so drop any text the
            // failed provider already streamed into the view.
            options?.onStreamReset?.();

            const result = await this.sendMessageWithProvider(
              fallbackProvider,
              conversationHistory,
              context,
              memoryContext,
              options
            );

            // Notify user of successful fallback
            if (this.app && this.app.showNotification) {
              this.app.showNotification(
                `Successfully switched to fallback provider (${this.providers[fallbackProvider].name})`,
                'success',
                3000
              );
            }

            return result;
          } catch (fallbackError) {
            console.error(`Fallback provider ${fallbackProvider} also failed:`, fallbackError.message);
            // Use the original error message
          }
        }
      }

      throw lastError;
    }
  }

  /**
   * Send message using a specific provider
   */
  async sendMessageWithProvider(providerKey, conversationHistory, context, memoryContext = null, options = {}) {
    const provider = this.providers[providerKey];

    if (!provider || !provider.enabled) {
      throw new Error(`Provider ${providerKey} is not configured or enabled`);
    }

    switch (providerKey) {
      case 'openai':
        return await this.sendOpenAIMessageWithHistory(provider, conversationHistory, context, memoryContext, options);
      case 'anthropic':
        return await this.sendAnthropicMessageWithHistory(
          provider,
          conversationHistory,
          context,
          memoryContext,
          options
        );
      case 'google':
        return await this.sendGoogleMessageWithHistory(provider, conversationHistory, context, memoryContext, options);
      case 'deepseek':
        return await this.sendDeepSeekMessageWithHistory(
          provider,
          conversationHistory,
          context,
          memoryContext,
          options
        );
      case 'siliconflow':
        return await this.sendSiliconFlowMessageWithHistory(
          provider,
          conversationHistory,
          context,
          memoryContext,
          options
        );
      case 'openrouter':
        return await this.sendOpenRouterMessageWithHistory(
          provider,
          conversationHistory,
          context,
          memoryContext,
          options
        );
      case 'minimax':
        return await this.sendMinimaxMessageWithHistory(provider, conversationHistory, context, memoryContext, options);
      case 'minimax_cn':
        return await this.sendMinimax_cnMessageWithHistory(
          provider,
          conversationHistory,
          context,
          memoryContext,
          options
        );
      case 'local':
        return await this.sendLocalMessageWithHistory(provider, conversationHistory, context, memoryContext, options);
      default:
        throw new Error('Unknown provider type');
    }
  }

  /**
   * Check if fallback should be attempted based on error type
   */
  shouldTryFallback(error) {
    // Try fallback for service unavailable errors and rate limits
    return (
      error.message.includes('HTTP 503') ||
      error.message.includes('Service Unavailable') ||
      error.message.includes('HTTP 502') ||
      error.message.includes('HTTP 504') ||
      error.message.includes('HTTP 429')
    );
  }

  /**
   * Get fallback provider for a given primary provider
   */
  getFallbackProvider(primaryProvider) {
    // Define fallback chains based on reliability and availability
    const fallbackChains = {
      siliconflow: ['openrouter', 'openai', 'google', 'anthropic'],
      openrouter: ['openai', 'google', 'anthropic', 'siliconflow'],
      openai: ['google', 'anthropic', 'openrouter', 'siliconflow'],
      google: ['openai', 'anthropic', 'openrouter', 'siliconflow'],
      anthropic: ['openai', 'google', 'openrouter', 'siliconflow'],
      deepseek: ['siliconflow', 'openrouter', 'openai', 'google'],
      local: ['openrouter', 'openai', 'google', 'siliconflow'],
    };

    const fallbacks = fallbackChains[primaryProvider] || [];

    // Find the first enabled fallback provider
    for (const fallback of fallbacks) {
      if (this.providers[fallback] && this.providers[fallback].enabled) {
        return fallback;
      }
    }

    return null;
  }

  /**
   * Extract readable text from the content/reasoning shapes used by supported
   * providers. Structured response envelopes continue to retain their native
   * blocks; this helper is only used for the legacy plain-text return path.
   */
  extractProviderText(value) {
    if (typeof value === 'string') return value;
    if (!value) return '';

    if (Array.isArray(value)) {
      return value.map(item => this.extractProviderText(item)).join('');
    }

    if (typeof value !== 'object') return '';
    if (typeof value.text === 'string') return value.text;
    if (typeof value.summary === 'string') return value.summary;
    if (typeof value.content === 'string') return value.content;

    return '';
  }

  /**
   * Preserve the historical <think> representation for ordinary text while
   * making provider reasoning available even when the visible answer is empty.
   */
  formatProviderText(content, reasoning = null) {
    const contentText = this.extractProviderText(content);
    const reasoningText = this.extractProviderText(reasoning);

    if (!reasoningText || contentText.includes('<think>')) return contentText;
    return `<think>\n${reasoningText}\n</think>${contentText ? `\n${contentText}` : ''}`;
  }

  /**
   * Normalize an OpenAI Chat Completions-compatible response.
   *
   * Contract: a normal prose completion returns a string. A completion with
   * tool_calls, legacy function_call, refusal, or a non-terminal finish reason
   * returns the native message fields plus { provider, finish_reason }.
   */
  normalizeOpenAICompatibleResponse(data, provider = 'openai') {
    const choice = data?.choices?.[0];
    const message = choice?.message;
    if (!message || typeof message !== 'object') {
      throw new Error(`Invalid response structure from ${provider}. Expected choices[0].message.`);
    }

    const reasoning = message.reasoning_content ?? message.reasoning ?? message.reasoning_details ?? null;
    const formattedContent = this.formatProviderText(message.content, reasoning);
    const hasToolCalls = Array.isArray(message.tool_calls)
      ? message.tool_calls.length > 0
      : Boolean(message.tool_calls);
    const hasFunctionCall = Boolean(message.function_call);
    const finishReason = choice.finish_reason ?? choice.finishReason ?? null;
    const normalizedFinishReason = String(finishReason || '').toLowerCase();
    const hasAbnormalFinish =
      finishReason !== null && !['', 'stop', 'end_turn', 'stop_sequence'].includes(normalizedFinishReason);
    const hasRefusal = Boolean(message.refusal);

    if (!hasToolCalls && !hasFunctionCall && !hasAbnormalFinish && !hasRefusal) {
      return formattedContent;
    }

    return {
      ...message,
      // Keep structured content parts intact; string/null content can safely use
      // the reasoning-aware display form without changing tool-call structure.
      content:
        typeof message.content === 'string' || message.content === null || message.content === undefined
          ? formattedContent
          : message.content,
      finish_reason: finishReason,
      provider,
    };
  }

  normalizeLocalResponse(data) {
    const normalizedResponse = this.normalizeOpenAICompatibleResponse(data, 'local');
    if (typeof normalizedResponse !== 'string' || normalizedResponse.trim() !== '') {
      return normalizedResponse;
    }

    console.warn('Local LLM returned empty content, this might indicate a model issue');
    return 'I apologize, but the local LLM model returned an empty response. This could indicate:\n\n• The model is still loading or initializing\n• The model encountered an issue processing the request\n• The model requires different parameters\n\nPlease try:\n1. Waiting a moment and trying again\n2. Checking if the local LLM service is running properly\n3. Switching to a different LLM provider temporarily';
  }

  /**
   * Normalize an Anthropic Messages response while preserving mixed content
   * blocks (including tool_use and thinking blocks) whenever protocol state is
   * present.
   */
  normalizeAnthropicResponse(data) {
    if (!data || !Array.isArray(data.content)) {
      throw new Error('Invalid response structure from Anthropic. Expected a content block array.');
    }

    const hasToolUse = data.content.some(block => block?.type === 'tool_use');
    const stopReason = data.stop_reason ?? data.stopReason ?? null;
    const normalizedStopReason = String(stopReason || '').toLowerCase();
    const hasAbnormalStop = stopReason !== null && !['', 'end_turn', 'stop_sequence'].includes(normalizedStopReason);

    if (hasToolUse || hasAbnormalStop) {
      return {
        ...data,
        provider: 'anthropic',
      };
    }

    const visibleText = data.content
      .filter(block => block?.type === 'text')
      .map(block => block.text || '')
      .join('');
    const reasoningText = data.content
      .filter(block => block?.type === 'thinking')
      .map(block => block.thinking || block.text || '')
      .join('\n');
    return this.formatProviderText(visibleText, reasoningText);
  }

  /**
   * Normalize a Gemini generateContent response. Function calls and abnormal
   * finish states retain the complete first candidate, including its original
   * content.parts array.
   */
  normalizeGoogleResponse(data) {
    const candidate = data?.candidates?.[0];
    if (!candidate) {
      const blockReason = data?.promptFeedback?.blockReason ?? data?.prompt_feedback?.block_reason;
      if (blockReason) {
        return {
          ...data,
          provider: 'google',
          finishReason: blockReason,
        };
      }
      throw new Error('Invalid response structure from Google API. Expected at least one candidate.');
    }

    const finishReason = candidate.finishReason ?? candidate.finish_reason ?? null;
    const normalizedFinishReason = String(finishReason || '').toUpperCase();
    const hasAbnormalFinish =
      finishReason !== null && !['', 'STOP', 'END_TURN', 'STOP_SEQUENCE'].includes(normalizedFinishReason);
    const parts = candidate.content?.parts;

    if (!Array.isArray(parts)) {
      return {
        ...candidate,
        content: { ...(candidate.content || {}), parts: [] },
        provider: 'google',
      };
    }

    const hasFunctionCall = parts.some(part => Boolean(part?.functionCall));

    if (hasFunctionCall || hasAbnormalFinish) {
      return {
        ...candidate,
        provider: 'google',
      };
    }

    const visibleText = parts
      .filter(part => typeof part?.text === 'string' && part.thought !== true)
      .map(part => part.text)
      .join('');
    const reasoningText = parts
      .filter(part => typeof part?.text === 'string' && part.thought === true)
      .map(part => part.text)
      .join('\n');
    return this.formatProviderText(visibleText, reasoningText);
  }

  // ---------------------------------------------------------------------------
  // Token streaming
  //
  // Streaming is an additive fast path: each provider first attempts an SSE
  // request and, if anything about it is unsupported or fails, returns null so
  // the original non-streaming request runs unchanged. That keeps one response
  // contract (the normalize*Response methods) and preserves existing error,
  // retry, and tool-call behaviour.
  // ---------------------------------------------------------------------------

  /** Streaming is opt-out; it only engages when a caller supplies an onToken sink. */
  isStreamingEnabled() {
    try {
      // The owning app instance is stored as `genomeBrowser` (both construction
      // sites pass the app in as the first constructor argument); `app` is only
      // a defensive fallback.
      const host = this.genomeBrowser || this.app;
      const settings = host?.chatManager?.chatBoxSettingsManager;
      if (settings && typeof settings.getSetting === 'function') {
        return settings.getSetting('enableStreaming', true) !== false;
      }
    } catch (error) {
      console.warn('Could not read streaming setting, defaulting to enabled:', error);
    }
    return true;
  }

  getStreamClient() {
    return typeof LLMStreamClient !== 'undefined' ? LLMStreamClient : null;
  }

  /**
   * True when a streaming attempt is worth making. Without an onToken sink there
   * is no user-visible benefit, so the simpler non-streaming path is used.
   */
  shouldAttemptStream(options) {
    return Boolean(options?.onToken) && this.isStreamingEnabled() && Boolean(this.getStreamClient());
  }

  /**
   * Shared failure handling for a streaming attempt.
   * Aborts propagate; anything else discards partial text and falls through.
   */
  handleStreamFailure(error, providerLabel, options) {
    if (error?.name === 'AbortError' || options?.signal?.aborted) {
      throw error;
    }
    console.warn(`[${providerLabel}] Streaming attempt failed, falling back to non-streaming:`, error.message);
    // Partial text may already be on screen; clear it so the retry cannot duplicate it.
    options?.onStreamReset?.();
    return null;
  }

  /** Headers for the OpenAI-compatible /chat/completions family. */
  buildChatCompletionsHeaders(providerKey, provider) {
    const headers = { 'Content-Type': 'application/json' };
    if (provider.apiKey) {
      headers.Authorization = `Bearer ${provider.apiKey}`;
    }
    if (providerKey === 'openrouter') {
      headers['HTTP-Referer'] = typeof window !== 'undefined' ? window.location.origin : '';
      headers['X-Title'] = 'GenomeExplorer';
    }
    return headers;
  }

  /**
   * Streaming fast path for every OpenAI-compatible provider.
   * @returns normalized response, or null to fall back to non-streaming.
   */
  async tryStreamChatCompletions(providerKey, provider, conversationHistory, options = {}, normalizeFn = null) {
    if (!this.shouldAttemptStream(options)) return null;

    const streamClient = this.getStreamClient();
    const providerLabel = provider?.name || providerKey;

    try {
      const response = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.buildChatCompletionsHeaders(providerKey, provider),
        body: JSON.stringify({
          model: provider.model,
          messages: conversationHistory,
          max_tokens: this.getMaxTokens(provider),
          temperature: this.getTemperature(),
          stream: true,
        }),
        signal: options.signal || undefined,
      });

      // Let the established non-streaming path own error classification, retry
      // scheduling, and provider fallback rather than duplicating it here.
      if (!response.ok || !streamClient.isEventStream(response)) {
        console.warn(
          `[${providerLabel}] Streaming unavailable (status ${response.status}); using non-streaming request.`
        );
        return null;
      }

      const data = await streamClient.streamOpenAICompatible(response, {
        onToken: options.onToken,
        signal: options.signal,
      });

      return normalizeFn ? normalizeFn.call(this, data) : this.normalizeOpenAICompatibleResponse(data, providerKey);
    } catch (error) {
      return this.handleStreamFailure(error, providerLabel, options);
    }
  }

  /** Streaming fast path for Anthropic Messages. */
  async tryStreamAnthropic(provider, conversationHistory, options = {}) {
    if (!this.shouldAttemptStream(options)) return null;

    const streamClient = this.getStreamClient();
    const providerLabel = provider?.name || 'Anthropic';

    try {
      const systemMessage = conversationHistory.find(msg => msg.role === 'system');
      const payload = {
        model: provider.model,
        max_tokens: this.getMaxTokens(provider),
        temperature: this.getTemperature(),
        messages: conversationHistory.filter(msg => msg.role !== 'system'),
        stream: true,
      };
      if (systemMessage) payload.system = systemMessage.content;

      const response = await fetch(`${provider.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': provider.apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify(payload),
        signal: options.signal || undefined,
      });

      if (!response.ok || !streamClient.isEventStream(response)) {
        console.warn(
          `[${providerLabel}] Streaming unavailable (status ${response.status}); using non-streaming request.`
        );
        return null;
      }

      const data = await streamClient.streamAnthropic(response, {
        onToken: options.onToken,
        signal: options.signal,
      });

      return this.normalizeAnthropicResponse(data);
    } catch (error) {
      return this.handleStreamFailure(error, providerLabel, options);
    }
  }

  /** Streaming fast path for Gemini streamGenerateContent. */
  async tryStreamGoogle(provider, conversationHistory, options = {}) {
    if (!this.shouldAttemptStream(options)) return null;

    const streamClient = this.getStreamClient();
    const providerLabel = provider?.name || 'Google';

    try {
      const systemMessage = conversationHistory.find(msg => msg.role === 'system');
      const contents = conversationHistory
        .filter(msg => msg.role !== 'system')
        .map(msg => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        }));

      const payload = {
        contents,
        generationConfig: {
          maxOutputTokens: this.getMaxTokens(provider),
          temperature: this.getTemperature(),
        },
      };
      if (systemMessage?.content) {
        payload.systemInstruction = { parts: [{ text: systemMessage.content }] };
      }

      const apiUrl =
        `${provider.baseUrl}/v1beta/models/${provider.model}:streamGenerateContent` + `?alt=sse&key=${provider.apiKey}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: options.signal || undefined,
      });

      if (!response.ok || !streamClient.isEventStream(response)) {
        console.warn(
          `[${providerLabel}] Streaming unavailable (status ${response.status}); using non-streaming request.`
        );
        return null;
      }

      const data = await streamClient.streamGoogle(response, {
        onToken: options.onToken,
        signal: options.signal,
      });

      return this.normalizeGoogleResponse(data);
    } catch (error) {
      return this.handleStreamFailure(error, providerLabel, options);
    }
  }

  async sendOpenAIMessage(provider, message, context, memoryContext = null) {
    const messages = this.buildMessages(message, context, 'openai', memoryContext);
    console.log('Sending to OpenAI - Request Payload:', {
      model: provider.model,
      messages: messages,
      max_tokens: this.getMaxTokens(provider),
      temperature: this.getTemperature(),
    });

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: provider.model,
        messages: messages,
        max_tokens: this.getMaxTokens(provider),
        temperature: this.getTemperature(),
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return this.normalizeOpenAICompatibleResponse(data, 'openai');
  }

  async sendOpenAIMessageWithHistory(provider, conversationHistory, context, memoryContext = null, options = {}) {
    const streamed = await this.tryStreamChatCompletions('openai', provider, conversationHistory, options);
    if (streamed !== null) return streamed;

    console.log('Sending to OpenAI - Request Payload:', {
      model: provider.model,
      messages: conversationHistory,
      max_tokens: this.getMaxTokens(provider),
      temperature: this.getTemperature(),
    });

    return await this.makeRequestWithRetry(
      async () => {
        const response = await fetch(`${provider.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${provider.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: provider.model,
            messages: conversationHistory,
            max_tokens: this.getMaxTokens(provider),
            temperature: this.getTemperature(),
          }),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          const error = new Error(
            `HTTP ${response.status}: ${response.statusText}${errorText ? ' - ' + errorText : ''}`
          );
          error.status = response.status;
          error.isRetryable = this.isRetryableError(response.status);
          throw error;
        }

        return response;
      },
      'OpenAI',
      async response => {
        const data = await response.json();
        return this.normalizeOpenAICompatibleResponse(data, 'openai');
      }
    );
  }

  async sendAnthropicMessage(provider, message, context, memoryContext = null) {
    const messages = this.buildMessages(message, context, 'anthropic', memoryContext);
    console.log('Sending to Anthropic - Request Payload:', {
      model: provider.model,
      max_tokens: this.getMaxTokens(provider),
      temperature: this.getTemperature(),
      messages: messages,
    });

    const response = await fetch(`${provider.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': provider.apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: provider.model,
        max_tokens: this.getMaxTokens(provider),
        temperature: this.getTemperature(),
        messages: messages,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return this.normalizeAnthropicResponse(data);
  }

  async sendAnthropicMessageWithHistory(provider, conversationHistory, context, memoryContext = null, options = {}) {
    const streamed = await this.tryStreamAnthropic(provider, conversationHistory, options);
    if (streamed !== null) return streamed;

    // Anthropic requires separate system message
    const systemMessage = conversationHistory.find(msg => msg.role === 'system');
    const messages = conversationHistory.filter(msg => msg.role !== 'system');

    const payload = {
      model: provider.model,
      max_tokens: this.getMaxTokens(provider),
      temperature: this.getTemperature(),
      messages: messages,
    };

    if (systemMessage) {
      payload.system = systemMessage.content;
    }

    console.log('Sending to Anthropic - Request Payload:', payload);

    const response = await fetch(`${provider.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': provider.apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return this.normalizeAnthropicResponse(data);
  }

  async sendGoogleMessage(provider, message, context, memoryContext = null) {
    const systemMessage = this.buildSystemMessage(context, message, memoryContext);

    // Use systemInstruction for system prompts (proper Gemini API approach)
    const payload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: message }],
        },
      ],
      generationConfig: {
        maxOutputTokens: this.getMaxTokens(provider),
        temperature: this.getTemperature(),
      },
    };

    // Add systemInstruction for proper system prompt handling
    if (systemMessage) {
      payload.systemInstruction = {
        parts: [{ text: systemMessage }],
      };
      console.log('Google API (simple): Including systemInstruction with', systemMessage.length, 'chars');
    }

    console.log('Sending to Google - Request Payload:', payload);

    const apiUrl = `${provider.baseUrl}/v1beta/models/${provider.model}:generateContent?key=${provider.apiKey}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Google API Error:', response.status, errorBody);
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorBody}`);
    }

    const data = await response.json();
    return this.normalizeGoogleResponse(data);
  }

  async sendGoogleMessageWithHistory(provider, conversationHistory, context, memoryContext = null, options = {}) {
    const streamed = await this.tryStreamGoogle(provider, conversationHistory, options);
    if (streamed !== null) return streamed;

    // Google uses systemInstruction for system messages (not in contents array)
    const systemMessage = conversationHistory.find(msg => msg.role === 'system');
    const contents = [];

    for (const message of conversationHistory) {
      if (message.role === 'system') continue; // System message handled separately via systemInstruction

      let role = 'user';
      if (message.role === 'assistant') {
        role = 'model';
      }

      contents.push({
        role: role,
        parts: [{ text: message.content }],
      });
    }

    // Build the payload with systemInstruction if a system message exists
    const payload = {
      contents: contents,
      generationConfig: {
        maxOutputTokens: this.getMaxTokens(provider),
        temperature: this.getTemperature(),
      },
    };

    // CRITICAL FIX: Add systemInstruction to ensure system prompt and tools are included
    if (systemMessage && systemMessage.content) {
      payload.systemInstruction = {
        parts: [{ text: systemMessage.content }],
      };
      console.log('Google API: Including systemInstruction with', systemMessage.content.length, 'chars');
    } else {
      console.warn(
        'Google API: No system message found in conversation history - tools and system prompt will be missing!'
      );
    }

    console.log('Sending to Google - Request Payload:', payload);

    const apiUrl = `${provider.baseUrl}/v1beta/models/${provider.model}:generateContent?key=${provider.apiKey}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Google API Error:', response.status, errorBody);
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorBody}`);
    }

    const data = await response.json();
    return this.normalizeGoogleResponse(data);
  }

  async sendDeepSeekMessage(provider, message, context, memoryContext = null) {
    const messages = this.buildMessages(message, context, 'openai', memoryContext);
    console.log('Sending to DeepSeek - Request Payload:', {
      model: provider.model,
      messages: messages,
      max_tokens: this.getMaxTokens(provider),
      temperature: this.getTemperature(),
    });

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: provider.model,
        messages: messages,
        max_tokens: this.getMaxTokens(provider),
        temperature: this.getTemperature(),
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return this.normalizeOpenAICompatibleResponse(data, 'deepseek');
  }

  async sendDeepSeekMessageWithHistory(provider, conversationHistory, context, memoryContext = null, options = {}) {
    const streamed = await this.tryStreamChatCompletions('deepseek', provider, conversationHistory, options);
    if (streamed !== null) return streamed;

    console.log('Sending to DeepSeek - Request Payload:', {
      model: provider.model,
      messages: conversationHistory,
      max_tokens: this.getMaxTokens(provider),
      temperature: this.getTemperature(),
    });

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: provider.model,
        messages: conversationHistory,
        max_tokens: this.getMaxTokens(provider),
        temperature: this.getTemperature(),
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return this.normalizeOpenAICompatibleResponse(data, 'deepseek');
  }

  async sendSiliconFlowMessage(provider, message, context, memoryContext = null) {
    const messages = this.buildMessages(message, context, 'openai', memoryContext);
    console.log('Sending to SiliconFlow - Request Payload:', {
      model: provider.model,
      messages: messages,
      max_tokens: this.getMaxTokens(provider),
      temperature: this.getTemperature(),
    });

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: provider.model,
        messages: messages,
        max_tokens: this.getMaxTokens(provider),
        temperature: this.getTemperature(),
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return this.normalizeOpenAICompatibleResponse(data, 'siliconflow');
  }

  /**
   * Check if an HTTP status code indicates a retryable error
   */
  isRetryableError(status) {
    const retryableStatuses = [
      429, // Too Many Requests
      500, // Internal Server Error
      502, // Bad Gateway
      503, // Service Unavailable
      504, // Gateway Timeout
      520, // Unknown Error (Cloudflare)
      521, // Web Server Is Down (Cloudflare)
      522, // Connection Timed Out (Cloudflare)
      523, // Origin Is Unreachable (Cloudflare)
      524, // A Timeout Occurred (Cloudflare)
    ];
    return retryableStatuses.includes(status);
  }

  /**
   * Calculate exponential backoff delay with jitter
   */
  calculateRetryDelay(attempt, baseDelay = 1000, maxDelay = 30000) {
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.3 * exponentialDelay;
    return Math.floor(exponentialDelay + jitter);
  }

  /**
   * Show user notification for retry status
   */
  showRetryNotification(providerName, attempt, maxAttempts, delay) {
    if (this.app && this.app.showNotification) {
      const message = `${providerName} service temporarily unavailable. Retrying in ${Math.ceil(delay / 1000)}s (attempt ${attempt}/${maxAttempts})...`;
      this.app.showNotification(message, 'warning', 3000);
    } else {
      console.warn(`🔄 [${providerName}] Retrying in ${delay}ms (attempt ${attempt}/${maxAttempts})`);
    }
  }

  /**
   * Make HTTP request with automatic retry logic for service unavailable errors
   */
  async makeRequestWithRetry(requestFunction, providerName, responseProcessor, maxAttempts = 3) {
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await requestFunction();
        return await responseProcessor(response);
      } catch (error) {
        lastError = error;

        // Only retry if it's a retryable error and we have attempts left
        if (error.isRetryable && attempt < maxAttempts) {
          const delay = this.calculateRetryDelay(attempt);

          console.warn(
            `🔄 [${providerName}] HTTP ${error.status} error on attempt ${attempt}. Retrying in ${delay}ms...`
          );
          this.showRetryNotification(providerName, attempt + 1, maxAttempts, delay);

          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // No more retries or non-retryable error
          if (error.isRetryable) {
            console.error(
              `❌ [${providerName}] All ${maxAttempts} attempts failed. Service may be experiencing issues.`
            );
            if (this.app && this.app.showNotification) {
              this.app.showNotification(
                `${providerName} service is currently unavailable. Please try again later or switch to a different LLM provider.`,
                'error',
                5000
              );
            }
          }
          break;
        }
      }
    }

    throw lastError;
  }

  async sendSiliconFlowMessageWithHistory(provider, conversationHistory, context, memoryContext = null, options = {}) {
    const streamed = await this.tryStreamChatCompletions('siliconflow', provider, conversationHistory, options);
    if (streamed !== null) return streamed;

    console.log('Sending to SiliconFlow - Request Payload:', {
      model: provider.model,
      messages: conversationHistory,
      max_tokens: this.getMaxTokens(provider),
      temperature: this.getTemperature(),
    });

    return await this.makeRequestWithRetry(
      async () => {
        const response = await fetch(`${provider.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${provider.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: provider.model,
            messages: conversationHistory,
            max_tokens: this.getMaxTokens(provider),
            temperature: this.getTemperature(),
          }),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          const error = new Error(
            `HTTP ${response.status}: ${response.statusText}${errorText ? ' - ' + errorText : ''}`
          );
          error.status = response.status;
          error.isRetryable = this.isRetryableError(response.status);
          throw error;
        }

        return response;
      },
      'SiliconFlow',
      async response => {
        const data = await response.json();
        console.log('SiliconFlow Raw Response Data:', data);

        // Check if choices array exists and has content
        if (!data.choices || data.choices.length === 0) {
          console.error('SiliconFlow: No choices in response');
          throw new Error('No choices in LLM response');
        }

        const choice = data.choices[0];
        console.log('SiliconFlow Choice Object:', choice);

        if (!choice.message) {
          console.error('SiliconFlow: No message in choice');
          throw new Error('No message in LLM choice');
        }

        console.log('SiliconFlow Message Object:', choice.message);
        const normalizedResponse = this.normalizeOpenAICompatibleResponse(data, 'siliconflow');
        console.log('SiliconFlow Response Normalized:', normalizedResponse);
        return normalizedResponse;
      }
    );
  }

  getMaxTokens(provider) {
    // 1. Try chatboxSettings override first
    const chatboxSettings = this.configManager ? this.configManager.get('chatboxSettings') : null;
    if (chatboxSettings && chatboxSettings.chatboxLLMMaxTokens) {
      return parseInt(chatboxSettings.chatboxLLMMaxTokens, 10);
    }
    // 2. Try provider config
    if (provider && provider.maxTokens) {
      return parseInt(provider.maxTokens, 10);
    }
    // 3. Fallback to a safe default
    return 4000;
  }

  getTemperature() {
    const chatboxSettings = this.configManager ? this.configManager.get('chatboxSettings') : null;
    if (chatboxSettings && chatboxSettings.chatboxLLMTemperature !== undefined) {
      return parseFloat(chatboxSettings.chatboxLLMTemperature);
    }
    return 0.7;
  }

  async sendOpenRouterMessage(provider, message, context, memoryContext = null) {
    const messages = this.buildMessages(message, context, 'openai', memoryContext);
    console.log('Sending to OpenRouter - Request Payload:', {
      model: provider.model,
      messages: messages,
      max_tokens: this.getMaxTokens(provider),
      temperature: this.getTemperature(),
    });

    const doRequest = async modelToUse => {
      const resp = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'GenomeExplorer',
        },
        body: JSON.stringify({
          model: modelToUse,
          messages: messages,
          max_tokens: this.getMaxTokens(provider),
          temperature: this.getTemperature(),
        }),
      });
      return resp;
    };

    let response = await doRequest(provider.model);

    if (!response.ok) {
      const status = response.status;
      const errorText = await response.text().catch(() => '');
      // Handle unavailable/forbidden model with single-attempt fallback
      if (status === 403 || status === 404) {
        const fallbackModel = this.getOpenRouterFallbackModel(provider.model);
        if (fallbackModel && fallbackModel !== provider.model) {
          console.warn(`OpenRouter model unavailable (${provider.model}). Falling back to ${fallbackModel}.`);
          this.showNotification(
            `OpenRouter model not available (${provider.model}). Retrying with ${fallbackModel}...`,
            'error'
          );
          response = await doRequest(fallbackModel);
          if (!response.ok) {
            const fbText = await response.text().catch(() => '');
            throw new Error(`HTTP ${status}: ${response.statusText} - ${errorText || fbText}`);
          }
          const fbData = await response.json();
          return this.normalizeOpenAICompatibleResponse(fbData, 'openrouter');
        }
      }
      throw new Error(`HTTP ${status}: ${response.statusText}${errorText ? ' - ' + errorText : ''}`);
    }

    const data = await response.json();
    return this.normalizeOpenAICompatibleResponse(data, 'openrouter');
  }

  async sendOpenRouterMessageWithHistory(provider, conversationHistory, context, memoryContext = null, options = {}) {
    const streamed = await this.tryStreamChatCompletions('openrouter', provider, conversationHistory, options);
    if (streamed !== null) return streamed;

    console.log('Sending to OpenRouter - Request Payload:', {
      model: provider.model,
      messages: conversationHistory,
      max_tokens: this.getMaxTokens(provider),
      temperature: this.getTemperature(),
    });

    const doRequest = async modelToUse => {
      const resp = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'GenomeExplorer',
        },
        body: JSON.stringify({
          model: modelToUse,
          messages: conversationHistory,
          max_tokens: this.getMaxTokens(provider),
          temperature: this.getTemperature(),
        }),
      });
      return resp;
    };

    let response = await doRequest(provider.model);

    if (!response.ok) {
      const status = response.status;
      const errorText = await response.text().catch(() => '');
      if (status === 403 || status === 404) {
        const fallbackModel = this.getOpenRouterFallbackModel(provider.model);
        if (fallbackModel && fallbackModel !== provider.model) {
          console.warn(`OpenRouter model unavailable (${provider.model}). Falling back to ${fallbackModel}.`);
          this.showNotification(
            `OpenRouter model not available (${provider.model}). Retrying with ${fallbackModel}...`,
            'error'
          );
          response = await doRequest(fallbackModel);
          if (!response.ok) {
            const fbText = await response.text().catch(() => '');
            throw new Error(`HTTP ${status}: ${response.statusText} - ${errorText || fbText}`);
          }
          const fbData = await response.json();
          return this.normalizeOpenAICompatibleResponse(fbData, 'openrouter');
        }
      }
      throw new Error(`HTTP ${status}: ${response.statusText}${errorText ? ' - ' + errorText : ''}`);
    }

    const data = await response.json();
    return this.normalizeOpenAICompatibleResponse(data, 'openrouter');
  }

  getOpenRouterFallbackModel(originalModel) {
    if (!originalModel) return null;
    const model = String(originalModel).toLowerCase();

    // OpenAI GPT-5 series fallbacks
    if (model.startsWith('openai/')) {
      if (model.includes('gpt-5.5-pro')) return 'openai/gpt-5.5';
      if (model.includes('gpt-5.5') && !model.includes('pro') && !model.includes('instant')) {
        return 'openai/gpt-5.4-thinking';
      }
      if (model.includes('gpt-5.4-thinking')) return 'openai/gpt-5.5-instant';
      if (model.includes('gpt-5.5-instant')) return 'openai/gpt-5.5'; // fallback cycle/safeguard
      // legacy support
      if (model.includes('gpt-4o') || model.includes('gpt-4')) return 'openai/gpt-5.5';
    }

    // Google Gemini series fallbacks
    if (model.startsWith('google/')) {
      if (model.includes('gemini-3.5-flash')) return 'google/gemini-3.1-pro';
      if (model.includes('gemini-3.1-pro')) return 'google/gemini-3.1-flash-lite';
      if (model.includes('gemini-3.1-flash-lite')) return 'google/gemini-3.5-flash';
      // legacy support
      if (model.includes('gemini-2.5') || model.includes('gemini-2.0') || model.includes('gemini-1.5')) {
        return 'google/gemini-3.5-flash';
      }
    }

    // Anthropic fallbacks
    if (model.startsWith('anthropic/')) {
      if (model.includes('claude-opus-4.7')) return 'anthropic/claude-sonnet-4.6';
      if (model.includes('claude-sonnet-4.6')) return 'anthropic/claude-haiku-4.5';
      if (model.includes('claude-haiku-4.5')) return 'anthropic/claude-sonnet-4.6';
      // legacy support
      if (model.includes('claude-3-5') || model.includes('claude-3')) return 'anthropic/claude-sonnet-4.6';
    }

    // GLM fallbacks (different for different providers)
    if (model.startsWith('z-ai/')) {
      // OpenRouter GLM models
      if (model.includes('glm-4.6')) return 'z-ai/glm-4.5';
      if (model.includes('glm-4.5') && !model.includes('air')) return 'z-ai/glm-4.5-air:free';
      if (model.includes('glm-4.5-air')) return 'openai/gpt-5.5-instant';
    }

    if (model.startsWith('zai-org/')) {
      // SiliconFlow GLM models
      if (model.includes('glm-5')) return 'zai-org/GLM-4.7';
      if (model.includes('glm-4.7')) return 'zai-org/GLM-4.6';
      if (model.includes('glm-4.6') && !model.includes('v')) return 'zai-org/GLM-4.5';
      if (model.includes('glm-4.5') && !model.includes('air')) return 'zai-org/GLM-4.5-Air';
      if (model.includes('glm-4.5-air')) return 'Qwen/Qwen3.5-8B';
    }

    return null;
  }

  async sendMinimaxMessage(provider, message, context, memoryContext = null) {
    const messages = this.buildMessages(message, context, 'openai', memoryContext);
    console.log('Sending to MiniMax (Global) - Request Payload:', {
      model: provider.model,
      messages: messages,
      max_tokens: this.getMaxTokens(provider),
      temperature: this.getTemperature(),
    });

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: provider.model,
        messages: messages,
        max_tokens: this.getMaxTokens(provider),
        temperature: this.getTemperature(),
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${response.statusText}${errorBody ? ` - ${errorBody}` : ''}`);
    }

    const data = await response.json();
    return this.normalizeOpenAICompatibleResponse(data, 'minimax');
  }

  async sendMinimaxMessageWithHistory(provider, conversationHistory, context, memoryContext = null, options = {}) {
    const streamed = await this.tryStreamChatCompletions('minimax', provider, conversationHistory, options);
    if (streamed !== null) return streamed;

    console.log('Sending to MiniMax (Global) - Request Payload:', {
      model: provider.model,
      messages: conversationHistory,
      max_tokens: this.getMaxTokens(provider),
      temperature: this.getTemperature(),
    });

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: provider.model,
        messages: conversationHistory,
        max_tokens: this.getMaxTokens(provider),
        temperature: this.getTemperature(),
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${response.statusText}${errorBody ? ` - ${errorBody}` : ''}`);
    }

    const data = await response.json();
    return this.normalizeOpenAICompatibleResponse(data, 'minimax');
  }

  async sendMinimax_cnMessage(provider, message, context, memoryContext = null) {
    const messages = this.buildMessages(message, context, 'openai', memoryContext);
    console.log('Sending to MiniMax CN - Request Payload:', {
      model: provider.model,
      messages: messages,
      max_tokens: this.getMaxTokens(provider),
      temperature: this.getTemperature(),
    });

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: provider.model,
        messages: messages,
        max_tokens: this.getMaxTokens(provider),
        temperature: this.getTemperature(),
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${response.statusText}${errorBody ? ` - ${errorBody}` : ''}`);
    }

    const data = await response.json();
    return this.normalizeOpenAICompatibleResponse(data, 'minimax_cn');
  }

  async sendMinimax_cnMessageWithHistory(provider, conversationHistory, context, memoryContext = null, options = {}) {
    const streamed = await this.tryStreamChatCompletions('minimax_cn', provider, conversationHistory, options);
    if (streamed !== null) return streamed;

    console.log('Sending to MiniMax CN - Request Payload:', {
      model: provider.model,
      messages: conversationHistory,
      max_tokens: this.getMaxTokens(provider),
      temperature: this.getTemperature(),
    });

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: provider.model,
        messages: conversationHistory,
        max_tokens: this.getMaxTokens(provider),
        temperature: this.getTemperature(),
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${response.statusText}${errorBody ? ` - ${errorBody}` : ''}`);
    }

    const data = await response.json();
    return this.normalizeOpenAICompatibleResponse(data, 'minimax_cn');
  }

  async sendLocalMessage(provider, message, context, memoryContext = null) {
    const rawMessages = this.buildMessages(message, context, 'openai', memoryContext);

    // Modify "system" role to "SystemInstruction" to support model providers that don't allow "system"
    const messages = rawMessages.map(msg => ({
      ...msg,
      role: msg.role === 'system' ? 'Instruction' : msg.role,
    }));

    const apiUrl = `${provider.baseUrl}/chat/completions`;
    const payload = {
      model: provider.model,
      messages: messages,
      max_tokens: this.getMaxTokens(provider),
      temperature: this.getTemperature(),
      stream: false, // Assuming stream is false for now based on previous setup
    };
    console.log(`Sending local LLM request to: ${apiUrl} with model: ${provider.model}`);
    console.log('Sending to Local LLM - Request Payload:', payload);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: provider.apiKey
        ? {
            Authorization: `Bearer ${provider.apiKey}`,
            'Content-Type': 'application/json',
          }
        : {
            'Content-Type': 'application/json',
          },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text(); // Get error body as text
      console.error(`Local LLM API Error (${response.status}): ${errorBody}`);
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorBody}`);
    }

    const data = await response.json();
    // Log the full raw response from the local LLM
    console.log('Full raw response from Local LLM:', data);

    return this.normalizeLocalResponse(data);
  }

  async sendLocalMessageWithHistory(provider, conversationHistory, context, memoryContext = null, options = {}) {
    const streamed = await this.tryStreamChatCompletions(
      'local',
      provider,
      conversationHistory,
      options,
      this.normalizeLocalResponse
    );
    if (streamed !== null) return streamed;

    const apiUrl = `${provider.baseUrl}/chat/completions`;

    // Modify "system" role to "SystemInstruction" to support model providers that don't allow "system"
    const messages = conversationHistory.map(msg => ({
      ...msg,
      role: msg.role === 'system' ? 'system' : msg.role,
    }));

    const payload = {
      model: provider.model,
      messages: messages,
      max_tokens: this.getMaxTokens(provider),
      temperature: this.getTemperature(),
      stream: false,
    };

    console.log(`Sending local LLM request to: ${apiUrl} with model: ${provider.model}`);
    console.log('Sending to Local LLM - Request Payload:', payload);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: provider.apiKey
        ? {
            Authorization: `Bearer ${provider.apiKey}`,
            'Content-Type': 'application/json',
          }
        : {
            'Content-Type': 'application/json',
          },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Local LLM API Error (${response.status}): ${errorBody}`);
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorBody}`);
    }

    const data = await response.json();
    console.log('Full raw response from Local LLM:', data);

    return this.normalizeLocalResponse(data);
  }

  buildMessages(userMessage, context, providerType = 'openai', memoryContext = null) {
    const messages = [];

    // System message with context
    const systemMessage = this.buildSystemMessage(context, userMessage, memoryContext);

    if (providerType === 'anthropic') {
      // Anthropic doesn't use system messages in the same way
      messages.push({
        role: 'user',
        content: systemMessage + '\n\nUser: ' + userMessage,
      });
    } else {
      messages.push({
        role: 'system',
        content: systemMessage,
      });
      messages.push({
        role: 'user',
        content: userMessage,
      });
    }

    return messages;
  }

  buildGooglePrompt(userMessage, context, memoryContext = null) {
    const systemMessage = this.buildSystemMessage(context, userMessage, memoryContext);
    return `${systemMessage}

User: ${userMessage}

Assistant:`;
  }

  buildSystemMessage(context, userQuery = '', memoryContext = null) {
    let systemMessage = `You are an AI assistant for a CodeXomics application. You help users analyze genomic data, navigate sequences, search for genes, and understand biological features.

You have access to tools that can:
- Navigate to specific genomic positions (use tool: 'navigate_to_position', parameters: {chromosome: string, start: number, end: number})
- Zoom in/out the current view (use tool: 'zoom_in' or 'zoom_out', parameters: {factor?: number}) - Default factor is 2x, maximum 10x
- Search for genes and features BY NAME/DESCRIPTION (use tool: 'search_features', parameters: {query: string, caseSensitive: boolean}) - Use this when users want to find genes by name, product description, or any text-based search like "DNA polymerase", "ribosomal", "lacZ", etc. This will display results in the search panel.
- Find features near a specific genomic position (use tool: 'get_nearby_features', parameters: {position: number, distance: number, featureTypes?: array}) - Use this only when users want to find what's near a specific coordinate/position, not for name-based searches.
- Get current browser state (use tool: 'get_current_state') - This will provide general information including counts of annotations and user-defined features.
- Retrieve DNA sequences (use tool: 'get_sequence', parameters: {chromosome: string, start: number, end: number})
- Toggle track visibility (use tool: 'toggle_track', parameters: {trackName: string, visible: boolean})
- Create annotations (use tool: 'create_annotation', parameters: {type: string, name: string, chromosome: string, start: number, end: number, strand: number, description?: string})
- Export data (use tool: 'export_data', parameters: {format: string, chromosome?: string, start?: number, end?: number})

CRITICAL FUNCTION SELECTION RULES:
- For ANY text-based search (gene names, products, descriptions): ALWAYS use 'search_features'
  Examples: "find DNA polymerase", "search for lacZ", "show ribosomal genes" → use search_features
- For position-based searches: ONLY use 'get_nearby_features' 
  Examples: "what's near position 12345", "features around coordinate 50000" → use get_nearby_features

CRITICAL: When a user's request requires one of these actions, you MUST respond with ONLY a JSON object in this exact format:

{"tool_name": "tool_name_here", "parameters": {"param1": "value1", "param2": "value2"}}

Do NOT include any explanation, markdown formatting, or code blocks. Return ONLY the raw JSON object.

Examples:
- For navigation: {"tool_name": "navigate_to_position", "parameters": {"chromosome": "chr1", "start": 1000, "end": 2000}}
- For zoom in: {"tool_name": "zoom_in", "parameters": {"factor": 2}} or {"tool_name": "zoom_in", "parameters": {"factor": 1.5}}
- For zoom out: {"tool_name": "zoom_out", "parameters": {"factor": 3}} or {"tool_name": "zoom_out", "parameters": {}}
- For gene/text search: {"tool_name": "search_features", "parameters": {"query": "DNA polymerase", "caseSensitive": false}}
- For position search: {"tool_name": "get_nearby_features", "parameters": {"position": 12345, "distance": 5000}}

If the user is asking a general question that doesn't require a tool, respond normally with conversational text.`;

    // Add memory context if available
    if (memoryContext) {
      systemMessage += `\n\n[Memory Context]\n${memoryContext}`;
    }

    if (context && context.genomeBrowser && context.genomeBrowser.currentState) {
      // Debug: Log the actual context structure
      console.log('Context structure for system message:', context);
      console.log('Current state:', context.genomeBrowser.currentState);

      // Only append a summary of the context, not the whole thing if it's still too large.
      // For now, the main change is that the LLM knows annotationsCount is a count.
      // We can be more sophisticated here later if needed.
      const currentState = context.genomeBrowser.currentState;
      systemMessage += `

Current context summary:
- Chromosome: ${currentState.currentChromosome || 'N/A'}
- Position: ${currentState.currentPosition ? `${currentState.currentPosition.start}-${currentState.currentPosition.end}` : 'N/A'}
- Annotations Loaded: ${currentState.annotationsCount || 0}
- User Features: ${currentState.userDefinedFeaturesCount || 0}`;
    } else if (context) {
      // Fallback for a differently structured context, though less likely now
      console.log('Context provided but not in expected structure:', context);
      systemMessage += `\n\n(Partial context provided)`;
    }

    return systemMessage;
  }

  previewSystemPrompt(memoryContext = null) {
    const systemPromptField = document.getElementById('systemPrompt');
    if (!systemPromptField) return;

    const userPrompt = systemPromptField.value.trim();
    let previewPrompt;

    if (userPrompt) {
      // Process the user-defined prompt with sample variables
      previewPrompt = this.processSystemPromptVariables(userPrompt, {
        currentChromosome: 'chr1',
        currentPosition: { start: 1000, end: 5000 },
        annotationsCount: 125,
        userDefinedFeaturesCount: 8,
      });
    } else {
      // Show the default system prompt with sample context
      const sampleContext = {
        genomeBrowser: {
          currentState: {
            currentChromosome: 'chr1',
            currentPosition: { start: 1000, end: 5000 },
            annotationsCount: 125,
            userDefinedFeaturesCount: 8,
          },
        },
      };
      previewPrompt = this.buildSystemMessage(sampleContext, '', memoryContext);
    }

    // Create modal to show preview
    this.showSystemPromptPreview(previewPrompt, userPrompt ? 'Custom' : 'Default');
  }

  processSystemPromptVariables(systemPrompt, context = {}) {
    let processedPrompt = systemPrompt;

    // Replace variables with context values
    const variables = {
      '{{CURRENT_CHROMOSOME}}': context.currentChromosome || 'N/A',
      '{{CURRENT_POSITION}}': context.currentPosition
        ? `${context.currentPosition.start}-${context.currentPosition.end}`
        : 'N/A',
      '{{ANNOTATIONS_COUNT}}': context.annotationsCount || 0,
      '{{USER_FEATURES_COUNT}}': context.userDefinedFeaturesCount || 0,
    };

    for (const [variable, value] of Object.entries(variables)) {
      processedPrompt = processedPrompt.replace(new RegExp(variable, 'g'), value);
    }

    return processedPrompt;
  }

  showSystemPromptPreview(prompt, type) {
    // Remove any existing modal first
    const existingModal = document.getElementById('systemPromptPreviewModal');
    if (existingModal) {
      existingModal.remove();
    }

    // Create modal HTML
    const modalHtml = `
            <div class="modal" id="systemPromptPreviewModal" style="z-index: 10001;">
                <div class="modal-content" style="max-width: 800px; max-height: 80vh;">
                    <div class="modal-header">
                        <h3>${type} System Prompt Preview</h3>
                        <button class="modal-close" type="button">&times;</button>
                    </div>
                    <div class="modal-body" style="overflow-y: auto;">
                        <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 6px; padding: 15px; font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; font-size: 13px; line-height: 1.4; white-space: pre-wrap; color: #374151;">${prompt}</div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn modal-close" type="button">Close</button>
                    </div>
                </div>
            </div>
        `;

    // Add to DOM
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Get the modal element
    const modal = document.getElementById('systemPromptPreviewModal');

    // Function to close the modal
    const closeModal = () => {
      if (modal && modal.parentNode) {
        modal.remove();
      }
    };

    // Add event listeners
    const closeButtons = modal.querySelectorAll('.modal-close');
    closeButtons.forEach(btn => {
      btn.addEventListener('click', closeModal);
    });

    // Close only on close button click, not background
    modal.addEventListener('click', e => {
      if (e.target.classList.contains('modal-close')) {
        closeModal();
      }
    });

    // Close on Escape key
    const handleEscape = e => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    // Show the modal
    setTimeout(() => {
      modal.classList.add('show');
    }, 10);
  }

  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;

    // Add to page
    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => notification.classList.add('show'), 100);

    // Remove after 3 seconds
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
  }

  getConfiguration() {
    return {
      providers: this.providers,
      modelTypes: this.modelTypes,
    };
  }

  isConfigured() {
    // Check if at least one provider is enabled
    return Object.values(this.providers).some(provider => provider.enabled);
  }

  /**
   * Get the provider for a specific model type with improved logic
   * @param {string} modelType - The type of model (reasoning, task, code, etc.)
   * @returns {string|null} - The provider key or null if not configured
   */
  getProviderForModelType(modelType) {
    // For general tasks, reasoning, and code, use the main model configuration
    if (modelType === 'task' || modelType === 'reasoning' || modelType === 'code') {
      const mainConfig = this.modelTypes.main;

      // Check if main model is configured and not set to 'auto'
      if (mainConfig && mainConfig.provider !== 'auto') {
        const providerKey = mainConfig.provider;
        if (this.providers[providerKey] && this.providers[providerKey].enabled) {
          return providerKey;
        } else {
          console.warn(`Configured provider '${providerKey}' for main model is not enabled`);
        }
      }
    } else {
      // For specialized model types, check their specific configuration
      const modelTypeConfig = this.modelTypes[modelType];

      // Check if model type is configured and not set to 'auto'
      if (modelTypeConfig && modelTypeConfig.provider !== 'auto') {
        const providerKey = modelTypeConfig.provider;
        if (this.providers[providerKey] && this.providers[providerKey].enabled) {
          return providerKey;
        } else {
          console.warn(`Configured provider '${providerKey}' for model type '${modelType}' is not enabled`);
        }
      }
    }

    // Use intelligent recommendation based on model type
    const recommendedProvider = this.getRecommendedProvider(modelType);
    if (recommendedProvider) {
      return recommendedProvider;
    }

    // Final fallback to first available enabled provider
    for (const [key, provider] of Object.entries(this.providers)) {
      if (provider.enabled) {
        return key;
      }
    }

    return null;
  }

  /**
   * Get the model for a specific model type
   * @param {string} modelType - The type of model (reasoning, task, code, etc.)
   * @returns {string|null} - The model name or null if not configured
   */
  getModelForModelType(modelType) {
    const providerKey = this.getProviderForModelType(modelType);
    if (!providerKey) return null;

    // For general tasks, reasoning, and code, use the main model configuration
    if (modelType === 'task' || modelType === 'reasoning' || modelType === 'code') {
      const mainConfig = this.modelTypes.main;
      if (mainConfig && mainConfig.model !== 'auto') {
        return mainConfig.model;
      }
    } else {
      // For specialized model types, check their specific configuration
      if (this.modelTypes[modelType] && this.modelTypes[modelType].model !== 'auto') {
        return this.modelTypes[modelType].model;
      }
    }

    // Fallback to provider's default model
    return this.providers[providerKey].model;
  }

  // ==========================================
  // Custom Endpoint - Saved Models Management
  // ==========================================

  /**
   * Get all saved configurations for the Custom Endpoint provider
   * Returns an object keyed by user-defined name, each value contains:
   * { baseUrl, model, apiKey, streamingSupport, savedAt }
   */
  getLocalSavedConfigs() {
    try {
      const data = localStorage.getItem('localCustomConfigs');
      return data ? JSON.parse(data) : {};
    } catch (e) {
      console.error('Error loading local saved configs:', e);
      return {};
    }
  }

  /**
   * Persist saved configurations to localStorage
   */
  persistLocalSavedConfigs(configs) {
    try {
      localStorage.setItem('localCustomConfigs', JSON.stringify(configs));
    } catch (e) {
      console.error('Error saving local configs:', e);
      this.showNotification('Error saving configuration: ' + e.message, 'error');
    }
  }

  /**
   * Refresh the saved configurations dropdown and the optgroup in the model select
   */
  refreshLocalSavedConfigs() {
    const configs = this.getLocalSavedConfigs();
    const names = Object.keys(configs);

    // Update the optgroup inside the main model select
    const optgroup = document.getElementById('localSavedModelsOptgroup');
    if (optgroup) {
      optgroup.innerHTML = '';
      if (names.length > 0) {
        optgroup.style.display = '';
        names.forEach(name => {
          const option = document.createElement('option');
          option.value = configs[name].model;
          option.textContent = `${name} (${configs[name].model})`;
          option.dataset.configName = name;
          optgroup.appendChild(option);
        });
      } else {
        optgroup.style.display = 'none';
      }
    }

    // Update the saved configurations list dropdown
    const listSelect = document.getElementById('localSavedConfigsList');
    if (listSelect) {
      listSelect.innerHTML = '<option value="">-- Select a saved configuration --</option>';
      names.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        const cfg = configs[name];
        const date = cfg.savedAt ? new Date(cfg.savedAt).toLocaleDateString() : '';
        option.textContent = `${name} - ${cfg.model} @ ${cfg.baseUrl || 'default'}${date ? ` (${date})` : ''}`;
        listSelect.appendChild(option);
      });
    }
  }

  /**
   * Collect current Custom Endpoint form values into a config object
   */
  collectLocalConfig() {
    const config = {};

    const nameField = document.getElementById('localConfigName');
    if (nameField) config.name = nameField.value.trim();

    const endpointField = document.getElementById('localEndpoint');
    if (endpointField) config.baseUrl = endpointField.value;

    const modelSelect = document.getElementById('localModel');
    if (modelSelect) {
      if (modelSelect.value === 'other') {
        const otherInput = document.getElementById('localModelOther');
        config.model = otherInput ? otherInput.value : '';
      } else {
        config.model = modelSelect.value;
      }
    }

    const apiKeyField = document.getElementById('localApiKey');
    if (apiKeyField) config.apiKey = apiKeyField.value;

    const streamingField = document.getElementById('localStreamingSupport');
    if (streamingField) config.streamingSupport = streamingField.checked;

    return config;
  }

  /**
   * Apply a saved configuration to the Custom Endpoint form fields
   */
  applyLocalConfig(config) {
    const nameField = document.getElementById('localConfigName');
    if (nameField) nameField.value = config.name || '';

    const endpointField = document.getElementById('localEndpoint');
    if (endpointField) endpointField.value = config.baseUrl || 'http://localhost:11434/v1';

    const apiKeyField = document.getElementById('localApiKey');
    if (apiKeyField) apiKeyField.value = config.apiKey || '';

    const streamingField = document.getElementById('localStreamingSupport');
    if (streamingField) streamingField.checked = !!config.streamingSupport;

    // Set model: try to find it in the dropdown, otherwise use "other"
    const modelSelect = document.getElementById('localModel');
    const otherGroup = document.getElementById('localModelOtherGroup');
    const otherInput = document.getElementById('localModelOther');

    if (modelSelect && config.model) {
      let found = false;
      for (let i = 0; i < modelSelect.options.length; i++) {
        if (modelSelect.options[i].value === config.model) {
          modelSelect.value = config.model;
          found = true;
          break;
        }
      }
      if (!found) {
        modelSelect.value = 'other';
        if (otherInput) otherInput.value = config.model;
      }
      // Show/hide the "other" input
      if (otherGroup) {
        otherGroup.style.display = modelSelect.value === 'other' ? 'block' : 'none';
      }
    }
  }

  /**
   * Save current Custom Endpoint settings as a named configuration
   */
  saveLocalConfig() {
    const config = this.collectLocalConfig();

    if (!config.model) {
      this.showNotification('Please select or enter a model name before saving', 'warning');
      return;
    }

    const name = config.name;
    if (!name) {
      this.showNotification('Please enter a configuration name before saving', 'warning');
      return;
    }

    const configs = this.getLocalSavedConfigs();

    // Check for overwrite
    if (configs[name]) {
      if (!confirm(`Configuration "${name}" already exists. Overwrite?`)) {
        return;
      }
    }

    config.savedAt = new Date().toISOString();
    configs[name] = config;
    this.persistLocalSavedConfigs(configs);
    this.refreshLocalSavedConfigs();

    // Select the newly saved config in the list
    const listSelect = document.getElementById('localSavedConfigsList');
    if (listSelect) listSelect.value = name;

    // Also update the active local provider so this.providers.local
    // stays in sync with what the user just saved to the named config.
    this.providers.local.model = config.model;
    this.providers.local.baseUrl = config.baseUrl || this.providers.local.baseUrl;
    this.providers.local.apiKey = config.apiKey ?? this.providers.local.apiKey;
    this.providers.local.streamingSupport = config.streamingSupport ?? this.providers.local.streamingSupport;
    this.providers.local.enabled = !!this.providers.local.model;

    // Persist active provider and saved configs to ConfigManager
    this.persistLocalConfigToConfigManager();

    this.showNotification(`Configuration "${name}" saved`, 'success');
  }

  /**
   * Clear the Custom Endpoint form for creating a new configuration
   */
  newLocalConfig() {
    // Clear all form fields
    const nameField = document.getElementById('localConfigName');
    if (nameField) nameField.value = '';

    const endpointField = document.getElementById('localEndpoint');
    if (endpointField) endpointField.value = 'http://localhost:11434/v1';

    const modelSelect = document.getElementById('localModel');
    if (modelSelect) modelSelect.value = 'qwen3:8b';

    const otherGroup = document.getElementById('localModelOtherGroup');
    if (otherGroup) otherGroup.style.display = 'none';

    const otherInput = document.getElementById('localModelOther');
    if (otherInput) otherInput.value = '';

    const apiKeyField = document.getElementById('localApiKey');
    if (apiKeyField) apiKeyField.value = '';

    const streamingField = document.getElementById('localStreamingSupport');
    if (streamingField) streamingField.checked = true;

    // Deselect in the saved configs dropdown
    const listSelect = document.getElementById('localSavedConfigsList');
    if (listSelect) listSelect.value = '';

    // Focus on the name field for immediate input
    if (nameField) nameField.focus();

    this.showNotification('Form cleared — enter a name and configure your new endpoint', 'info');
  }

  /**
   * Load a selected configuration from the dropdown and apply it
   */
  loadLocalConfig() {
    const listSelect = document.getElementById('localSavedConfigsList');
    if (!listSelect || !listSelect.value) {
      this.showNotification('Please select a configuration to load', 'warning');
      return;
    }

    const configName = listSelect.value;
    const configs = this.getLocalSavedConfigs();
    const config = configs[configName];

    if (!config) {
      this.showNotification(`Configuration "${configName}" not found`, 'error');
      return;
    }

    // Ensure the name field is present (backward compatibility for old data)
    if (!config.name) {
      config.name = configName;
    }

    this.applyLocalConfig(config);
    this.showNotification(`Configuration "${configName}" loaded`, 'success');
  }

  /**
   * Delete a selected configuration from the saved list
   */
  deleteLocalConfig() {
    const listSelect = document.getElementById('localSavedConfigsList');
    if (!listSelect || !listSelect.value) {
      this.showNotification('Please select a configuration to delete', 'warning');
      return;
    }

    const configName = listSelect.value;
    if (!confirm(`Delete configuration "${configName}"?`)) {
      return;
    }

    const configs = this.getLocalSavedConfigs();
    delete configs[configName];
    this.persistLocalSavedConfigs(configs);
    this.refreshLocalSavedConfigs();

    // Sync deletion to ConfigManager
    this.persistLocalConfigToConfigManager();

    this.showNotification(`Configuration "${configName}" deleted`, 'success');
  }

  /**
   * Persist the active local provider and saved local configs to ConfigManager
   * so they survive across Electron restarts (file-based storage).
   * Falls back to localStorage when ConfigManager is unavailable.
   */
  async persistLocalConfigToConfigManager() {
    try {
      const localCustomConfigs = this.getLocalSavedConfigs();
      if (this.configManager) {
        await this.configManager.set('llm.providers', this.providers);
        await this.configManager.set('llm.localCustomConfigs', localCustomConfigs);
        await this.configManager.saveConfig();
      } else {
        localStorage.setItem(
          'llmConfiguration',
          JSON.stringify({
            providers: this.providers,
            modelTypes: this.modelTypes,
          })
        );
      }
    } catch (error) {
      console.error('Error persisting local config to ConfigManager:', error);
    }
  }
}
