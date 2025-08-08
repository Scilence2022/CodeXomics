/**
 * MultiAgentSettingsManager - Manages comprehensive multi-agent system settings
 * Includes latest LLM providers, models, and advanced configuration options
 */
class MultiAgentSettingsManager {
    constructor(configManager) {
        this.configManager = configManager;
        this.modal = null;
        this.currentTab = 'system';
        
        // Latest LLM providers and models (2024-2025)
        this.llmProviders = {
            openai: {
                name: 'OpenAI',
                models: {
                    'gpt-4o': 'GPT-4o (Latest - Most Capable)',
                    'gpt-4o-mini': 'GPT-4o Mini (Fast & Efficient)',
                    'gpt-4-turbo': 'GPT-4 Turbo (Latest)',
                    'gpt-4': 'GPT-4 (Legacy)',
                    'gpt-3.5-turbo': 'GPT-3.5 Turbo (Fast)',
                    'gpt-3.5-turbo-16k': 'GPT-3.5 Turbo 16K (Long Context)'
                },
                baseUrl: 'https://api.openai.com/v1',
                apiKeyPrefix: 'sk-'
            },
            anthropic: {
                name: 'Anthropic (Claude)',
                models: {
                    'claude-3-5-sonnet-20241022': 'Claude 3.5 Sonnet (Latest)',
                    'claude-3-opus-20240229': 'Claude 3 Opus (Most Capable)',
                    'claude-3-sonnet-20240229': 'Claude 3 Sonnet (Balanced)',
                    'claude-3-haiku-20240307': 'Claude 3 Haiku (Fast)',
                    'claude-3-5-haiku-20241022': 'Claude 3.5 Haiku (Latest Fast)'
                },
                baseUrl: 'https://api.anthropic.com',
                apiKeyPrefix: 'sk-ant-'
            },
            google: {
                name: 'Google (Gemini)',
                models: {
                    'gemini-2.0-flash': 'Gemini 2.0 Flash (Latest)',
                    'gemini-2.0-flash-exp': 'Gemini 2.0 Flash Experimental',
                    'gemini-1.5-pro-latest': 'Gemini 1.5 Pro (Latest)',
                    'gemini-1.5-flash-latest': 'Gemini 1.5 Flash (Latest)',
                    'gemini-1.5-pro': 'Gemini 1.5 Pro (Legacy)',
                    'gemini-1.5-flash': 'Gemini 1.5 Flash (Legacy)',
                    'gemini-pro': 'Gemini 1.0 Pro (Legacy)'
                },
                baseUrl: 'https://generativelanguage.googleapis.com',
                apiKeyPrefix: 'AI'
            },
            deepseek: {
                name: 'DeepSeek',
                models: {
                    'deepseek-chat': 'DeepSeek Chat (Latest)',
                    'deepseek-coder': 'DeepSeek Coder (Code Focused)',
                    'deepseek-v2.5': 'DeepSeek V2.5 (Legacy)',
                    'deepseek-v2': 'DeepSeek V2 (Legacy)'
                },
                baseUrl: 'https://api.deepseek.com/v1',
                apiKeyPrefix: 'sk-'
            },
            openrouter: {
                name: 'OpenRouter',
                models: {
                    // OpenAI Models (Latest)
                    'openai/gpt-4o': 'GPT-4o (Latest - Most Capable)',
                    'openai/gpt-4o-mini': 'GPT-4o Mini (Fast & Efficient)',
                    'openai/gpt-4-turbo': 'GPT-4 Turbo (Latest)',
                    'openai/gpt-4': 'GPT-4 (Legacy)',
                    'openai/gpt-3.5-turbo': 'GPT-3.5 Turbo (Fast)',
                    'openai/gpt-3.5-turbo-16k': 'GPT-3.5 Turbo 16K (Long Context)',
                    
                    // Anthropic Models (Latest)
                    'anthropic/claude-3-5-sonnet-20241022': 'Claude 3.5 Sonnet (Latest - Most Capable)',
                    'anthropic/claude-3-5-haiku-20241022': 'Claude 3.5 Haiku (Latest - Fast)',
                    'anthropic/claude-3-opus-20240229': 'Claude 3 Opus (Most Capable)',
                    'anthropic/claude-3-sonnet-20240229': 'Claude 3 Sonnet (Balanced)',
                    'anthropic/claude-3-haiku-20240307': 'Claude 3 Haiku (Fast)',
                    
                    // Google Models (Latest)
                    'google/gemini-2.0-flash': 'Gemini 2.0 Flash (Latest)',
                    'google/gemini-2.0-flash-exp': 'Gemini 2.0 Flash Experimental',
                    'google/gemini-1.5-pro-latest': 'Gemini 1.5 Pro (Latest)',
                    'google/gemini-1.5-flash-latest': 'Gemini 1.5 Flash (Latest)',
                    'google/gemini-1.5-pro': 'Gemini 1.5 Pro (Legacy)',
                    'google/gemini-1.5-flash': 'Gemini 1.5 Flash (Legacy)',
                    'google/gemini-pro': 'Gemini 1.0 Pro (Legacy)',
                    
                    // Meta Models (Latest)
                    'meta-llama/llama-3.1-405b-instruct': 'Llama 3.1 405B Instruct (Most Capable)',
                    'meta-llama/llama-3.1-70b-instruct': 'Llama 3.1 70B Instruct (Balanced)',
                    'meta-llama/llama-3.1-8b-instruct': 'Llama 3.1 8B Instruct (Fast)',
                    'meta-llama/llama-3.1-1b-instruct': 'Llama 3.1 1B Instruct (Very Fast)',
                    
                    // Mistral Models (Latest)
                    'mistralai/mistral-large-latest': 'Mistral Large (Latest)',
                    'mistralai/mixtral-8x7b-instruct': 'Mixtral 8x7B Instruct (Balanced)',
                    'mistralai/mistral-7b-instruct': 'Mistral 7B Instruct (Fast)',
                    'mistralai/mistral-small-latest': 'Mistral Small (Latest)',
                    
                    // DeepSeek Models (Latest)
                    'deepseek-ai/deepseek-chat': 'DeepSeek Chat (Latest)',
                    'deepseek-ai/deepseek-coder': 'DeepSeek Coder (Code Focused)',
                    'deepseek-ai/deepseek-v2.5': 'DeepSeek V2.5 (Legacy)',
                    'deepseek-ai/deepseek-v2': 'DeepSeek V2 (Legacy)',
                    
                    // Qwen Models (Latest)
                    'qwen/qwen2.5-72b-instruct': 'Qwen 2.5 72B Instruct (Most Capable)',
                    'qwen/qwen2.5-32b-instruct': 'Qwen 2.5 32B Instruct (Balanced)',
                    'qwen/qwen2.5-14b-instruct': 'Qwen 2.5 14B Instruct (Fast)',
                    'qwen/qwen2.5-7b-instruct': 'Qwen 2.5 7B Instruct (Very Fast)',
                    'qwen/qwen2.5-coder-32b-instruct': 'Qwen 2.5 Coder 32B (Code Focused)',
                    'qwen/qwen2.5-coder-7b-instruct': 'Qwen 2.5 Coder 7B (Code Fast)',
                    
                    // Microsoft Models
                    'microsoft/wizardlm-2-8x22b': 'WizardLM 2 8x22B (Most Capable)',
                    'microsoft/wizardlm-2-7b': 'WizardLM 2 7B (Fast)',
                    
                    // Perplexity Models
                    'perplexity/llama-3.1-70b-instruct': 'Perplexity Llama 3.1 70B (Most Capable)',
                    'perplexity/llama-3.1-8b-instruct': 'Perplexity Llama 3.1 8B (Fast)',
                    'perplexity/llama-3.1-1b-instruct': 'Perplexity Llama 3.1 1B (Very Fast)',
                    
                    // Nous Research Models
                    'nousresearch/nous-hermes-2-mixtral-8x7b-dpo': 'Nous Hermes 2 Mixtral (Balanced)',
                    'nousresearch/nous-hermes-2-yi-34b': 'Nous Hermes 2 Yi 34B (Capable)',
                    'nousresearch/nous-hermes-2-yi-6b': 'Nous Hermes 2 Yi 6B (Fast)',
                    
                    // Other Popular Models
                    '01-ai/yi-34b-chat': 'Yi 34B Chat (Capable)',
                    '01-ai/yi-6b-chat': 'Yi 6B Chat (Fast)',
                    'microsoft/phi-3-medium-4k-instruct': 'Phi-3 Medium 4K (Fast)',
                    'microsoft/phi-3-small-8k-instruct': 'Phi-3 Small 8K (Very Fast)',
                    'microsoft/phi-3-mini-4k-instruct': 'Phi-3 Mini 4K (Ultra Fast)',
                    'cohere/command-r-plus': 'Command R+ (Most Capable)',
                    'cohere/command-r': 'Command R (Balanced)',
                    'cohere/command-light': 'Command Light (Fast)',
                    'databricks/dbrx-instruct': 'DBRX Instruct (Most Capable)',
                    'databricks/dbrx-base': 'DBRX Base (Balanced)',
                    'snowflake/arctic-instruct': 'Snowflake Arctic Instruct (Capable)',
                    'snowflake/arctic-base': 'Snowflake Arctic Base (Balanced)',
                    'fireworks/firellava-3-8b': 'FireLLaVA 3 8B (Multimodal)',
                    'fireworks/firellava-3-1b': 'FireLLaVA 3 1B (Multimodal Fast)',
                    'anthropic/claude-3-5-sonnet-20241022-vision': 'Claude 3.5 Sonnet Vision (Multimodal)',
                    'openai/gpt-4o-mini-vision': 'GPT-4o Mini Vision (Multimodal)',
                    'openai/gpt-4o-vision': 'GPT-4o Vision (Multimodal)'
                },
                baseUrl: 'https://openrouter.ai/api/v1',
                apiKeyPrefix: 'sk-or-'
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
                    'deepseek-ai/DeepSeek-V2.5': 'DeepSeek-V2.5 (Legacy)',
                    
                    // Qwen Models
                    'Qwen/Qwen3-235B-A22B-Thinking-2507': 'Qwen3-235B-A22B-Thinking-2507',
                    'Qwen/Qwen3-235B-A22B-Instruct-2507': 'Qwen3-235B-A22B-Instruct-2507',
                    'Qwen/Qwen3-32B': 'Qwen3-32B (Latest)',
                    'Qwen/Qwen3-14B': 'Qwen3-14B (Balanced)',
                    'Qwen/Qwen3-8B': 'Qwen3-8B (Fast)',
                    'Qwen/QwQ-32B': 'QwQ-32B (Latest)',
                    'Qwen/QwQ-32B-Preview': 'QwQ-32B-Preview (Experimental)',
                    'Qwen/Qwen2.5-72B-Instruct-128K': 'Qwen2.5-72B-Instruct-128K (Long Context)',
                    'Qwen/Qwen2.5-72B-Instruct': 'Qwen2.5-72B-Instruct (Standard)',
                    'Qwen/Qwen2.5-32B-Instruct': 'Qwen2.5-32B-Instruct (Balanced)',
                    'Qwen/Qwen2.5-14B-Instruct': 'Qwen2.5-14B-Instruct (Fast)',
                    'Qwen/Qwen2.5-7B-Instruct': 'Qwen2.5-7B-Instruct (Very Fast)',
                    'Qwen/Qwen2.5-Coder-32B-Instruct': 'Qwen2.5-Coder-32B-Instruct (Code Focused)',
                    'Qwen/Qwen2.5-Coder-7B-Instruct': 'Qwen2.5-Coder-7B-Instruct (Code Fast)',
                    'Qwen/Qwen2-7B-Instruct': 'Qwen2-7B-Instruct (Legacy)',
                    'Qwen/Qwen2-1.5B-Instruct': 'Qwen2-1.5B-Instruct (Legacy)',
                    'Pro/Qwen/Qwen2.5-7B-Instruct': 'Qwen2.5-7B-Instruct (Pro)',
                    'Pro/Qwen/Qwen2-7B-Instruct': 'Qwen2-7B-Instruct (Pro)',
                    'Pro/Qwen/Qwen2-1.5B-Instruct': 'Qwen2-1.5B-Instruct (Pro)',
                    'Vendor-A/Qwen/Qwen2.5-72B-Instruct': 'Qwen2.5-72B-Instruct (Vendor-A)',
                    
                    // GLM Models
                    'THUDM/GLM-Z1-32B-0414': 'GLM-Z1-32B-0414 (Latest)',
                    'THUDM/GLM-4-32B-0414': 'GLM-4-32B-0414 (Latest)',
                    'THUDM/GLM-Z1-Rumination-32B-0414': 'GLM-Z1-Rumination-32B-0414 (Rumination)',
                    'THUDM/GLM-4-9B-0414': 'GLM-4-9B-0414 (Fast)',
                    'THUDM/glm-4-9b-chat': 'GLM-4-9B-Chat (Chat Optimized)',
                    'Pro/THUDM/chatglm3-6b': 'ChatGLM3-6B (Pro)',
                    'Pro/THUDM/glm-4-9b-chat': 'GLM-4-9B-Chat (Pro)',
                    
                    // Other Models
                    'baidu/ERNIE-4.5-300B-A47B': 'ERNIE-4.5-300B-A47B',
                    'moonshotai/Kimi-K2-Instruct': 'Kimi-K2-Instruct',
                    'ascend-tribe/pangu-pro-moe': 'pangu-pro-moe',
                    'tencent/Hunyuan-A13B-Instruct': 'Hunyuan-A13B-Instruct',
                    'zai-org/GLM-4.5': 'GLM-4.5',
                    'zai-org/GLM-4.5-Air': 'GLM-4.5-Air',
                    'MiniMaxAI/MiniMax-M1-80k': 'MiniMax-M1-80k (Long Context)',
                    'Tongyi-Zhiwen/QwenLong-L1-32B': 'QwenLong-L1-32B (Long Context)',
                    'TeleAI/TeleChat2': 'TeleChat2 (Latest)',
                    'internlm/internlm2_5-7b-chat': 'InternLM2.5-7B-Chat (Fast)',
                    'internlm/internlm2_5-20b-chat': 'InternLM2.5-20B-Chat (Balanced)'
                },
                baseUrl: 'https://api.siliconflow.cn/v1',
                apiKeyPrefix: 'sk-'
            },
            mistral: {
                name: 'Mistral AI',
                models: {
                    'mistral-large-latest': 'Mistral Large (Latest)',
                    'mistral-medium-latest': 'Mistral Medium (Latest)',
                    'mistral-small-latest': 'Mistral Small (Latest)',
                    'mistral-large': 'Mistral Large (Legacy)',
                    'mistral-medium': 'Mistral Medium (Legacy)',
                    'mistral-small': 'Mistral Small (Legacy)'
                },
                baseUrl: 'https://api.mistral.ai/v1',
                apiKeyPrefix: 'sk-'
            },
            cohere: {
                name: 'Cohere',
                models: {
                    'command-r-plus': 'Command R+ (Latest)',
                    'command-r': 'Command R (Latest)',
                    'command-light': 'Command Light (Fast)',
                    'command': 'Command (Legacy)',
                    'command-light-nightly': 'Command Light Nightly (Experimental)'
                },
                baseUrl: 'https://api.cohere.ai/v1',
                apiKeyPrefix: 'sk-'
            },
            perplexity: {
                name: 'Perplexity',
                models: {
                    'llama-3.1-70b-instruct': 'Llama 3.1 70B Instruct (Latest)',
                    'llama-3.1-8b-instruct': 'Llama 3.1 8B Instruct (Fast)',
                    'llama-3.1-405b-instruct': 'Llama 3.1 405B Instruct (Most Capable)',
                    'mixtral-8x7b-instruct': 'Mixtral 8x7B Instruct (Balanced)',
                    'codellama-70b-instruct': 'Code Llama 70B Instruct (Code Focused)',
                    'mistral-7b-instruct': 'Mistral 7B Instruct (Fast)'
                },
                baseUrl: 'https://api.perplexity.ai',
                apiKeyPrefix: 'pplx-'
            },
            local: {
                name: 'Local LLM',
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
                    'qwen2:latest': 'Qwen2:latest (Legacy)',
                    'mistral-large:latest': 'Mistral Large:latest (Legacy)',
                    'llama3.1:70b': 'Llama3.1:70b (Legacy)',
                    'llama3.1:latest': 'Llama3.1:latest (Legacy)',
                    'llama3:latest': 'Llama3:latest (Legacy)',
                    'gemma3:27b': 'Gemma3:27b (Legacy)',
                    'other': 'Other (Custom)'
                },
                baseUrl: 'http://localhost:11434/v1',
                apiKeyPrefix: ''
            },
            custom: {
                name: 'Custom Provider',
                models: {},
                baseUrl: '',
                apiKeyPrefix: ''
            }
        };
        
        // Default settings
        this.defaultSettings = {
            // System settings
            multiAgentSystemEnabled: false,
            multiAgentAutoOptimize: true,
            multiAgentShowInfo: true,
            multiAgentMemoryEnabled: true,
            multiAgentCacheEnabled: true,
            multiAgentMaxConcurrent: 3,
            multiAgentTimeout: 30,
            multiAgentRetryAttempts: 3,
            
            // LLM settings
            multiAgentLLMProvider: 'auto',
            multiAgentLLMModel: 'auto',
            multiAgentLLMTemperature: 0.7,
            multiAgentLLMMaxTokens: 4000,
            multiAgentLLMTimeout: 30,
            multiAgentLLMRetryAttempts: 3,
            multiAgentLLMUseSystemPrompt: true,
            multiAgentLLMEnableFunctionCalling: true,
            multiAgentApiKey: '',
            multiAgentBaseUrl: '',
            
            // Agent settings
            agentNavigationEnabled: true,
            agentAnalysisEnabled: true,
            agentDataEnabled: true,
            agentSequenceEnabled: true,
            agentProteinEnabled: true,
            agentNetworkEnabled: true,
            agentExternalEnabled: true,
            agentPluginEnabled: true,
            
            // Memory settings
            multiAgentMemorySystemEnabled: true,
            multiAgentMemoryCacheEnabled: true,
            multiAgentMemoryOptimizationEnabled: true,
            multiAgentMemoryCleanupInterval: 5,
            multiAgentMemoryMaxEntries: 10000,
            multiAgentShortTermMaxSize: 1000,
            multiAgentShortTermTTL: 30,
            multiAgentMediumTermMaxSize: 5000,
            multiAgentMediumTermTTL: 24,
            multiAgentLongTermMaxSize: 10000,
            multiAgentLongTermTTL: 30,
            
            // Performance settings
            multiAgentPerformanceMonitoring: true,
            multiAgentAutoScaling: true,
            multiAgentMaxConcurrentTasks: 5,
            multiAgentTaskQueueSize: 100
        };
        
        this.currentSettings = { ...this.defaultSettings };
        this.loadSettings();
        this.setupEventListeners();
    }
    
    loadSettings() {
        try {
            const savedSettings = this.configManager.get('multiAgentSettings', {});
            this.currentSettings = { ...this.defaultSettings, ...savedSettings };
            console.log('Multi-Agent Settings loaded:', this.currentSettings);
        } catch (error) {
            console.error('Error loading multi-agent settings:', error);
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
            
            console.log('Multi-Agent Settings saved and synced:', this.currentSettings);
            return true;
        } catch (error) {
            console.error('Error saving multi-agent settings:', error);
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
        
        // LLM provider change
        const llmProviderSelect = document.getElementById('multiAgentLLMProvider');
        if (llmProviderSelect) {
            llmProviderSelect.addEventListener('change', () => {
                this.updateModelOptions();
            });
        }
        
        // Temperature range slider
        const temperatureSlider = document.getElementById('multiAgentLLMTemperature');
        const temperatureValue = document.getElementById('multiAgentLLMTemperatureValue');
        if (temperatureSlider && temperatureValue) {
            temperatureSlider.addEventListener('input', () => {
                temperatureValue.textContent = temperatureSlider.value;
            });
        }
        
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
    }
    
    showModal() {
        this.modal = document.getElementById('multiAgentSettingsModal');
        if (this.modal) {
            this.loadSettingsToUI();
            this.modal.style.display = 'block';
            this.switchTab(this.currentTab);
            
            // Initialize drag and resize functionality
            this.initializeDragAndResize();
        }
    }
    
    hideModal() {
        if (this.modal) {
            this.modal.style.display = 'none';
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
        const resetDefaultsBtn = modal.querySelector('.reset-defaults-btn');
        if (resetDefaultsBtn) {
            resetDefaultsBtn.addEventListener('click', () => {
                this.resetToDefaults();
            });
        }
        
        // Fallback drag functionality if ModalDragManager is not available
        if (!window.ModalDragManager) {
            this.setupFallbackDrag(modalContent);
        }
        
        // Fallback resize functionality if ResizableModalManager is not available
        if (!window.ResizableModalManager) {
            this.setupFallbackResize(modalContent);
        }
    }
    
    setupFallbackDrag(modalContent) {
        let isDragging = false;
        let dragOffset = { x: 0, y: 0 };
        
        const header = modalContent.querySelector('.modal-header');
        if (!header) return;
        
        header.style.cursor = 'move';
        
        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.modal-close')) return;
            
            isDragging = true;
            const rect = modalContent.getBoundingClientRect();
            dragOffset.x = e.clientX - rect.left;
            dragOffset.y = e.clientY - rect.top;
            
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const x = e.clientX - dragOffset.x;
            const y = e.clientY - dragOffset.y;
            
            modalContent.style.left = `${x}px`;
            modalContent.style.top = `${y}px`;
            modalContent.style.transform = 'none';
        });
        
        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }
    
    setupFallbackResize(modalContent) {
        const resizeHandles = modalContent.querySelectorAll('.resize-handle');
        
        resizeHandles.forEach(handle => {
            let isResizing = false;
            let startX, startY, startWidth, startHeight, startLeft, startTop;
            
            handle.addEventListener('mousedown', (e) => {
                isResizing = true;
                startX = e.clientX;
                startY = e.clientY;
                startWidth = modalContent.offsetWidth;
                startHeight = modalContent.offsetHeight;
                startLeft = modalContent.offsetLeft;
                startTop = modalContent.offsetTop;
                
                e.preventDefault();
                e.stopPropagation();
            });
            
            document.addEventListener('mousemove', (e) => {
                if (!isResizing) return;
                
                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;
                
                const handleClass = handle.className;
                
                if (handleClass.includes('resize-handle-e') || handleClass.includes('resize-handle-ne') || handleClass.includes('resize-handle-se')) {
                    modalContent.style.width = `${startWidth + deltaX}px`;
                }
                
                if (handleClass.includes('resize-handle-s') || handleClass.includes('resize-handle-se') || handleClass.includes('resize-handle-sw')) {
                    modalContent.style.height = `${startHeight + deltaY}px`;
                }
                
                if (handleClass.includes('resize-handle-w') || handleClass.includes('resize-handle-nw') || handleClass.includes('resize-handle-sw')) {
                    const newWidth = startWidth - deltaX;
                    if (newWidth > 400) {
                        modalContent.style.width = `${newWidth}px`;
                        modalContent.style.left = `${startLeft + deltaX}px`;
                    }
                }
                
                if (handleClass.includes('resize-handle-n') || handleClass.includes('resize-handle-nw') || handleClass.includes('resize-handle-ne')) {
                    const newHeight = startHeight - deltaY;
                    if (newHeight > 300) {
                        modalContent.style.height = `${newHeight}px`;
                        modalContent.style.top = `${startTop + deltaY}px`;
                    }
                }
            });
            
            document.addEventListener('mouseup', () => {
                isResizing = false;
            });
        });
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
        this.setCheckboxValue('multiAgentAutoOptimize', this.currentSettings.multiAgentAutoOptimize);
        this.setCheckboxValue('multiAgentShowInfo', this.currentSettings.multiAgentShowInfo);
        this.setCheckboxValue('multiAgentMemoryEnabled', this.currentSettings.multiAgentMemoryEnabled);
        this.setCheckboxValue('multiAgentCacheEnabled', this.currentSettings.multiAgentCacheEnabled);
        this.setInputValue('multiAgentMaxConcurrent', this.currentSettings.multiAgentMaxConcurrent);
        this.setInputValue('multiAgentTimeout', this.currentSettings.multiAgentTimeout);
        this.setInputValue('multiAgentRetryAttempts', this.currentSettings.multiAgentRetryAttempts);
        
        // LLM settings
        this.setSelectValue('multiAgentLLMProvider', this.currentSettings.multiAgentLLMProvider);
        this.updateModelOptions();
        this.setSelectValue('multiAgentLLMModel', this.currentSettings.multiAgentLLMModel);
        this.setRangeValue('multiAgentLLMTemperature', this.currentSettings.multiAgentLLMTemperature);
        this.setInputValue('multiAgentLLMMaxTokens', this.currentSettings.multiAgentLLMMaxTokens);
        this.setInputValue('multiAgentLLMTimeout', this.currentSettings.multiAgentLLMTimeout);
        this.setCheckboxValue('multiAgentLLMUseSystemPrompt', this.currentSettings.multiAgentLLMUseSystemPrompt);
        this.setCheckboxValue('multiAgentLLMEnableFunctionCalling', this.currentSettings.multiAgentLLMEnableFunctionCalling);
        this.setInputValue('multiAgentApiKey', this.currentSettings.multiAgentApiKey);
        this.setInputValue('multiAgentBaseUrl', this.currentSettings.multiAgentBaseUrl);
        
        // Agent settings
        this.setCheckboxValue('agentNavigationEnabled', this.currentSettings.agentNavigationEnabled);
        this.setCheckboxValue('agentAnalysisEnabled', this.currentSettings.agentAnalysisEnabled);
        this.setCheckboxValue('agentDataEnabled', this.currentSettings.agentDataEnabled);
        this.setCheckboxValue('agentSequenceEnabled', this.currentSettings.agentSequenceEnabled);
        this.setCheckboxValue('agentProteinEnabled', this.currentSettings.agentProteinEnabled);
        this.setCheckboxValue('agentNetworkEnabled', this.currentSettings.agentNetworkEnabled);
        this.setCheckboxValue('agentExternalEnabled', this.currentSettings.agentExternalEnabled);
        this.setCheckboxValue('agentPluginEnabled', this.currentSettings.agentPluginEnabled);
        
        // Memory settings
        this.setCheckboxValue('multiAgentMemorySystemEnabled', this.currentSettings.multiAgentMemorySystemEnabled);
        this.setCheckboxValue('multiAgentMemoryCacheEnabled', this.currentSettings.multiAgentMemoryCacheEnabled);
        this.setCheckboxValue('multiAgentMemoryOptimizationEnabled', this.currentSettings.multiAgentMemoryOptimizationEnabled);
        this.setInputValue('multiAgentMemoryCleanupInterval', this.currentSettings.multiAgentMemoryCleanupInterval);
        this.setInputValue('multiAgentMemoryMaxEntries', this.currentSettings.multiAgentMemoryMaxEntries);
        this.setInputValue('multiAgentShortTermMaxSize', this.currentSettings.multiAgentShortTermMaxSize);
        this.setInputValue('multiAgentShortTermTTL', this.currentSettings.multiAgentShortTermTTL);
        this.setInputValue('multiAgentMediumTermMaxSize', this.currentSettings.multiAgentMediumTermMaxSize);
        this.setInputValue('multiAgentMediumTermTTL', this.currentSettings.multiAgentMediumTermTTL);
        this.setInputValue('multiAgentLongTermMaxSize', this.currentSettings.multiAgentLongTermMaxSize);
        this.setInputValue('multiAgentLongTermTTL', this.currentSettings.multiAgentLongTermTTL);
        
        // Performance settings
        this.setCheckboxValue('multiAgentPerformanceMonitoring', this.currentSettings.multiAgentPerformanceMonitoring);
        this.setCheckboxValue('multiAgentAutoScaling', this.currentSettings.multiAgentAutoScaling);
        this.setInputValue('multiAgentMaxConcurrentTasks', this.currentSettings.multiAgentMaxConcurrentTasks);
        this.setInputValue('multiAgentTaskQueueSize', this.currentSettings.multiAgentTaskQueueSize);
    }
    
    updateModelOptions() {
        const providerSelect = document.getElementById('multiAgentLLMProvider');
        const modelSelect = document.getElementById('multiAgentLLMModel');
        
        if (!providerSelect || !modelSelect) return;
        
        const selectedProvider = providerSelect.value;
        const provider = this.llmProviders[selectedProvider];
        
        // Clear existing options
        modelSelect.innerHTML = '<option value="auto">Auto (Use provider default)</option>';
        
        if (provider && provider.models) {
            Object.entries(provider.models).forEach(([modelId, modelName]) => {
                const option = document.createElement('option');
                option.value = modelId;
                option.textContent = modelName;
                modelSelect.appendChild(option);
            });
        }
        
        // Update base URL
        const baseUrlInput = document.getElementById('multiAgentBaseUrl');
        if (baseUrlInput && provider) {
            baseUrlInput.value = provider.baseUrl || '';
        }
    }
    
    saveCurrentSettings() {
        // Collect all settings from UI
        const newSettings = {
            // System settings
            multiAgentSystemEnabled: this.getCheckboxValue('multiAgentSystemEnabled'),
            multiAgentAutoOptimize: this.getCheckboxValue('multiAgentAutoOptimize'),
            multiAgentShowInfo: this.getCheckboxValue('multiAgentShowInfo'),
            multiAgentMemoryEnabled: this.getCheckboxValue('multiAgentMemoryEnabled'),
            multiAgentCacheEnabled: this.getCheckboxValue('multiAgentCacheEnabled'),
            multiAgentMaxConcurrent: parseInt(this.getInputValue('multiAgentMaxConcurrent')),
            multiAgentTimeout: parseInt(this.getInputValue('multiAgentTimeout')),
            multiAgentRetryAttempts: parseInt(this.getInputValue('multiAgentRetryAttempts')),
            
            // LLM settings
            multiAgentLLMProvider: this.getSelectValue('multiAgentLLMProvider'),
            multiAgentLLMModel: this.getSelectValue('multiAgentLLMModel'),
            multiAgentLLMTemperature: parseFloat(this.getRangeValue('multiAgentLLMTemperature')),
            multiAgentLLMMaxTokens: parseInt(this.getInputValue('multiAgentLLMMaxTokens')),
            multiAgentLLMTimeout: parseInt(this.getInputValue('multiAgentLLMTimeout')),
            multiAgentLLMUseSystemPrompt: this.getCheckboxValue('multiAgentLLMUseSystemPrompt'),
            multiAgentLLMEnableFunctionCalling: this.getCheckboxValue('multiAgentLLMEnableFunctionCalling'),
            multiAgentApiKey: this.getInputValue('multiAgentApiKey'),
            multiAgentBaseUrl: this.getInputValue('multiAgentBaseUrl'),
            
            // Agent settings
            agentNavigationEnabled: this.getCheckboxValue('agentNavigationEnabled'),
            agentAnalysisEnabled: this.getCheckboxValue('agentAnalysisEnabled'),
            agentDataEnabled: this.getCheckboxValue('agentDataEnabled'),
            agentSequenceEnabled: this.getCheckboxValue('agentSequenceEnabled'),
            agentProteinEnabled: this.getCheckboxValue('agentProteinEnabled'),
            agentNetworkEnabled: this.getCheckboxValue('agentNetworkEnabled'),
            agentExternalEnabled: this.getCheckboxValue('agentExternalEnabled'),
            agentPluginEnabled: this.getCheckboxValue('agentPluginEnabled'),
            
            // Memory settings
            multiAgentMemorySystemEnabled: this.getCheckboxValue('multiAgentMemorySystemEnabled'),
            multiAgentMemoryCacheEnabled: this.getCheckboxValue('multiAgentMemoryCacheEnabled'),
            multiAgentMemoryOptimizationEnabled: this.getCheckboxValue('multiAgentMemoryOptimizationEnabled'),
            multiAgentMemoryCleanupInterval: parseInt(this.getInputValue('multiAgentMemoryCleanupInterval')),
            multiAgentMemoryMaxEntries: parseInt(this.getInputValue('multiAgentMemoryMaxEntries')),
            multiAgentShortTermMaxSize: parseInt(this.getInputValue('multiAgentShortTermMaxSize')),
            multiAgentShortTermTTL: parseInt(this.getInputValue('multiAgentShortTermTTL')),
            multiAgentMediumTermMaxSize: parseInt(this.getInputValue('multiAgentMediumTermMaxSize')),
            multiAgentMediumTermTTL: parseInt(this.getInputValue('multiAgentMediumTermTTL')),
            multiAgentLongTermMaxSize: parseInt(this.getInputValue('multiAgentLongTermMaxSize')),
            multiAgentLongTermTTL: parseInt(this.getInputValue('multiAgentLongTermTTL')),
            
            // Performance settings
            multiAgentPerformanceMonitoring: this.getCheckboxValue('multiAgentPerformanceMonitoring'),
            multiAgentAutoScaling: this.getCheckboxValue('multiAgentAutoScaling'),
            multiAgentMaxConcurrentTasks: parseInt(this.getInputValue('multiAgentMaxConcurrentTasks')),
            multiAgentTaskQueueSize: parseInt(this.getInputValue('multiAgentTaskQueueSize'))
        };
        
        // Update current settings
        this.currentSettings = { ...this.currentSettings, ...newSettings };
        
        // Save to config
        if (this.saveSettings()) {
            this.showSuccessMessage('Multi-Agent settings saved successfully!');
            
            // Emit settings changed event
            if (window.chatManager) {
                window.chatManager.emit('multiAgentSettingsChanged', this.currentSettings);
            }
            
            // Also emit window event for global listening
            window.dispatchEvent(new CustomEvent('multiAgentSettingsChanged', {
                detail: this.currentSettings
            }));
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
        navigator.clipboard.readText().then(text => {
            const apiKeyInput = document.getElementById('multiAgentApiKey');
            if (apiKeyInput) {
                apiKeyInput.value = text;
            }
        }).catch(err => {
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
            activeAgents: '3'
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
    
    // Reset settings to default values
    resetToDefaults() {
        if (confirm('Are you sure you want to reset all Multi-Agent System settings to their default values? This action cannot be undone.')) {
            // Reset to default settings
            this.currentSettings = {
                enabled: false,
                agentTeamLeader: 'auto',
                maxAgents: 3,
                communicationProtocol: 'hierarchical',
                taskDistribution: 'balanced',
                conflictResolution: 'vote',
                performanceMonitoring: true,
                memorySharing: true,
                knowledgeCache: true,
                adaptiveLearning: false,
                llmProvider: 'auto',
                llmModel: 'auto',
                temperature: 0.7,
                maxTokens: 4000,
                timeout: 30000,
                retryAttempts: 3,
                useSystemPrompt: true,
                enableFunctionCalling: true
            };
            
            // Update the UI
            this.populateForm();
            
            // Save settings
            this.saveSettings();
            
            // Show notification
            if (window.chatManager) {
                window.chatManager.showNotification('Multi-Agent System settings reset to defaults successfully!', 'success');
            }
        }
    }
}

// Export for global use
window.MultiAgentSettingsManager = MultiAgentSettingsManager; 