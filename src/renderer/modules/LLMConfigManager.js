/**
 * LLMConfigManager - Manages LLM provider configurations and API communication
 */
class LLMConfigManager {
    constructor(configManager = null) {
        this.configManager = configManager;
        this.currentProvider = null;
        this.providers = {
            openai: {
                name: 'OpenAI',
                apiKey: '',
                model: 'gpt-4o',
                baseUrl: 'https://api.openai.com/v1',
                enabled: false
            },
            anthropic: {
                name: 'Anthropic',
                apiKey: '',
                model: 'claude-3-5-sonnet-20241022',
                baseUrl: 'https://api.anthropic.com',
                enabled: false
            },
            google: {
                name: 'Google',
                apiKey: '',
                model: 'gemini-2.0-flash',
                baseUrl: 'https://generativelanguage.googleapis.com',
                enabled: false
            },
            deepseek: {
                name: 'DeepSeek',
                apiKey: '',
                model: 'deepseek-chat',
                baseUrl: 'https://api.deepseek.com/v1',
                enabled: false
            },
            siliconflow: {
                name: 'SiliconFlow',
                apiKey: '',
                model: 'Qwen/Qwen2.5-72B-Instruct',
                baseUrl: 'https://api.siliconflow.cn/v1',
                enabled: false
            },
            local: {
                name: 'Local LLM',
                apiKey: '',
                model: 'qwen3:8b',
                baseUrl: 'http://localhost:11434/v1',
                streamingSupport: true,
                enabled: false
            },
            custom: {
                name: 'Custom Provider',
                providerName: 'My Custom Provider',
                apiKey: '',
                model: '',
                baseUrl: '',
                apiFormat: 'openai',
                customHeaders: {},
                maxTokens: 4096,
                temperature: 0.7,
                streamingSupport: false,
                enabled: false
            }
        };
        
        // Initialize asynchronously to wait for ConfigManager
        this.initializeAsync();
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
        } catch (error) {
            console.error('LLMConfigManager initialization error:', error);
            // Fallback to immediate initialization
            this.loadConfiguration();
            this.initializeUI();
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
        const requiredElements = [
            'optionsBtn',
            'configureLLMBtn',
            'saveLLMConfigBtn',
            'testConnectionBtn'
        ];
        
        return requiredElements.some(id => document.getElementById(id) !== null);
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
        
        // Options menu dropdown
        const optionsBtn = document.getElementById('optionsBtn');
        if (optionsBtn) {
            optionsBtn.addEventListener('click', (e) => {
                console.log('Options button clicked');
                e.stopPropagation();
                this.toggleOptionsDropdown();
            });
        }

        // Configure LLM button
        const configureLLMBtn = document.getElementById('configureLLMBtn');
        if (configureLLMBtn) {
            configureLLMBtn.addEventListener('click', () => {
                console.log('Configure LLM button clicked');
                this.showConfigModal();
            });
        }

        // Provider tabs
        document.querySelectorAll('.tab-button').forEach(button => {
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

        // System prompt controls
        const resetSystemPromptBtn = document.getElementById('resetSystemPrompt');
        if (resetSystemPromptBtn) {
            resetSystemPromptBtn.addEventListener('click', () => {
                const systemPromptField = document.getElementById('systemPrompt');
                if (systemPromptField) {
                    systemPromptField.value = '';
                    this.showNotification('System prompt reset to default', 'success');
                }
            });
        }

        const previewSystemPromptBtn = document.getElementById('previewSystemPrompt');
        if (previewSystemPromptBtn) {
            previewSystemPromptBtn.addEventListener('click', () => {
                this.previewSystemPrompt();
            });
        }

        // Local model select change
        const localModelSelect = document.getElementById('localModel');
        if (localModelSelect) {
            localModelSelect.addEventListener('change', (event) => {
                const otherModelGroup = document.getElementById('localModelOtherGroup');
                if (event.target.value === 'other') {
                    otherModelGroup.style.display = 'block';
                } else {
                    otherModelGroup.style.display = 'none';
                }
            });
        }

        // Add event listeners for all new paste buttons
        const pasteButtonConfigs = [
            { btnId: 'pasteOpenaiApiKeyBtn', inputId: 'openaiApiKey' },
            { btnId: 'pasteAnthropicApiKeyBtn', inputId: 'anthropicApiKey' },
            { btnId: 'pasteGoogleApiKeyBtn', inputId: 'googleApiKey' },
            { btnId: 'pasteDeepseekApiKeyBtn', inputId: 'deepseekApiKey' },
            { btnId: 'pasteSiliconflowApiKeyBtn', inputId: 'siliconflowApiKey' },
            { btnId: 'pasteLocalApiKeyBtn', inputId: 'localApiKey' },
            { btnId: 'pasteCustomApiKeyBtn', inputId: 'customApiKey' }
        ];

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
                        this.showNotification('Failed to paste from clipboard. Ensure permissions are granted if prompted.', 'error');
                    }
                });
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const optionsDropdownMenu = document.getElementById('optionsDropdownMenu');
            if (optionsDropdownMenu && !e.target.closest('.file-menu-container')) {
                this.hideOptionsDropdown();
            }
        });

        // Modal close handlers
        document.querySelectorAll('#llmConfigModal .modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                this.hideConfigModal();
            });
        });
        
        // Completion threshold slider handler
        const completionThresholdSlider = document.getElementById('completionThreshold');
        const completionThresholdValue = document.getElementById('completionThresholdValue');
        if (completionThresholdSlider && completionThresholdValue) {
            completionThresholdSlider.addEventListener('input', (e) => {
                completionThresholdValue.textContent = parseFloat(e.target.value).toFixed(2);
            });
        }

        // Custom temperature slider handler
        const customTemperatureSlider = document.getElementById('customTemperature');
        const customTemperatureValue = document.getElementById('customTemperatureValue');
        if (customTemperatureSlider && customTemperatureValue) {
            customTemperatureSlider.addEventListener('input', (e) => {
                customTemperatureValue.textContent = parseFloat(e.target.value).toFixed(1);
            });
        }
    }

    toggleOptionsDropdown() {
        const dropdown = document.getElementById('optionsDropdownMenu');
        const isVisible = dropdown.classList.contains('show');
        
        // Hide all other dropdowns first
        document.querySelectorAll('.dropdown-menu').forEach(menu => {
            menu.classList.remove('show');
        });
        
        if (!isVisible) {
            dropdown.classList.add('show');
        }
    }

    hideOptionsDropdown() {
        document.getElementById('optionsDropdownMenu').classList.remove('show');
    }

    showConfigModal() {
        this.hideOptionsDropdown();
        this.loadConfigurationToUI();
        document.getElementById('llmConfigModal').classList.add('show');
    }

    hideConfigModal() {
        document.getElementById('llmConfigModal').classList.remove('show');
    }

    switchProviderTab(provider) {
        // Update tab buttons
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.provider === provider);
        });

        // Update provider config panels
        document.querySelectorAll('.provider-config').forEach(panel => {
            panel.classList.toggle('active', panel.id === `${provider}-config`);
        });
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
                    this.currentProvider = llmConfig.currentProvider;
                    
                    console.log('After merge - current provider:', this.currentProvider);
                    console.log('After merge - providers:', Object.keys(this.providers));
                    
                    // Debug each provider's status
                    Object.entries(this.providers).forEach(([key, provider]) => {
                        console.log(`Provider ${key}:`, {
                            enabled: provider.enabled,
                            hasApiKey: !!provider.apiKey,
                            model: provider.model
                        });
                    });
                } else {
                    console.log('No LLM providers found in ConfigManager config');
                }
            } else {
                console.log('No ConfigManager available, using localStorage fallback');
                // Fallback to localStorage
                const savedConfig = localStorage.getItem('llmConfiguration');
                if (savedConfig) {
                    console.log('Found LLM configuration in localStorage');
                    const config = JSON.parse(savedConfig);
                    this.providers = { ...this.providers, ...config.providers };
                    this.currentProvider = config.currentProvider;
                    console.log('Loaded from localStorage - current provider:', this.currentProvider);
                } else {
                    console.log('No LLM configuration found in localStorage');
                }
            }
        } catch (error) {
            console.error('Error loading LLM configuration:', error);
        }
        console.log('=== LLMConfigManager.loadConfiguration Debug End ===');
    }

    async saveConfiguration() {
        try {
            // Collect configuration from UI
            const currentTab = document.querySelector('.tab-button.active').dataset.provider;
            
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
                } else if (providerKey === 'custom') {
                    provider.providerName = document.getElementById('customProviderName').value || 'My Custom Provider';
                    provider.model = document.getElementById('customModel').value;
                    provider.baseUrl = document.getElementById('customBaseUrl').value;
                    provider.apiFormat = document.getElementById('customApiFormat').value;
                    provider.maxTokens = parseInt(document.getElementById('customMaxTokens').value) || 4096;
                    provider.temperature = parseFloat(document.getElementById('customTemperature').value) || 0.7;
                    provider.streamingSupport = document.getElementById('customStreamingSupport').checked;
                    
                    // Parse custom headers
                    try {
                        const headersText = document.getElementById('customHeaders').value.trim();
                        provider.customHeaders = headersText ? JSON.parse(headersText) : {};
                    } catch (error) {
                        console.error('Invalid custom headers JSON:', error);
                        provider.customHeaders = {};
                    }
                    
                    // Update the display name
                    provider.name = provider.providerName;
                } else {
                    const modelField = document.getElementById(`${prefix}Model`);
                    if (modelField) {
                        provider.model = modelField.value;
                    }
                    const baseUrlField = document.getElementById(`${prefix}BaseUrl`);
                    if (baseUrlField) {
                        provider.baseUrl = baseUrlField.value;
                    }
                }
                
                // Set as enabled if it has required fields
                provider.enabled = !!(provider.apiKey || providerKey === 'local' || providerKey === 'custom') && provider.model;
            });

            // Set current provider to the active tab if it's enabled
            if (this.providers[currentTab].enabled) {
                this.currentProvider = currentTab;
            }

            // Get function call rounds setting
            const functionCallRoundsField = document.getElementById('functionCallRounds');
            const functionCallRounds = functionCallRoundsField ? parseInt(functionCallRoundsField.value) : 3;

            // Get early completion settings
            const enableEarlyCompletionField = document.getElementById('enableEarlyCompletion');
            const enableEarlyCompletion = enableEarlyCompletionField ? enableEarlyCompletionField.checked : true;
            
            const completionThresholdField = document.getElementById('completionThreshold');
            const completionThreshold = completionThresholdField ? parseFloat(completionThresholdField.value) : 0.7;

            // Get system prompt setting
            const systemPromptField = document.getElementById('systemPrompt');
            const systemPrompt = systemPromptField ? systemPromptField.value.trim() : '';

            if (this.configManager) {
                // Use ConfigManager if available (now with async support)
                await this.configManager.set('llm.providers', this.providers);
                await this.configManager.set('llm.currentProvider', this.currentProvider);
                await this.configManager.set('llm.functionCallRounds', functionCallRounds);
                await this.configManager.set('llm.enableEarlyCompletion', enableEarlyCompletion);
                await this.configManager.set('llm.completionThreshold', completionThreshold);
                await this.configManager.set('llm.systemPrompt', systemPrompt);
                await this.configManager.saveConfig();
                console.log('Configuration saved via ConfigManager');
            } else {
                // Fallback to localStorage
                const config = {
                    providers: this.providers,
                    currentProvider: this.currentProvider
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
                    apiKeyField.addEventListener('paste', (event) => {
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
                    localModelOtherGroup.style.display = (localModelSelect && localModelSelect.value === 'other') ? 'block' : 'none';
                }

            } else if (providerKey === 'custom') {
                // Handle custom provider UI loading
                const customProviderNameField = document.getElementById('customProviderName');
                const customModelField = document.getElementById('customModel');
                const customBaseUrlField = document.getElementById('customBaseUrl');
                const customApiFormatField = document.getElementById('customApiFormat');
                const customHeadersField = document.getElementById('customHeaders');
                const customMaxTokensField = document.getElementById('customMaxTokens');
                const customTemperatureField = document.getElementById('customTemperature');
                const customTemperatureValueField = document.getElementById('customTemperatureValue');
                const customStreamingField = document.getElementById('customStreamingSupport');

                if (customProviderNameField) customProviderNameField.value = provider.providerName || 'My Custom Provider';
                if (customModelField) customModelField.value = provider.model || '';
                if (customBaseUrlField) customBaseUrlField.value = provider.baseUrl || '';
                if (customApiFormatField) customApiFormatField.value = provider.apiFormat || 'openai';
                if (customHeadersField) {
                    const headersText = provider.customHeaders ? JSON.stringify(provider.customHeaders, null, 2) : '';
                    customHeadersField.value = headersText;
                }
                if (customMaxTokensField) customMaxTokensField.value = provider.maxTokens || 4096;
                if (customTemperatureField) customTemperatureField.value = provider.temperature || 0.7;
                if (customTemperatureValueField) customTemperatureValueField.textContent = (provider.temperature || 0.7).toFixed(1);
                if (customStreamingField) customStreamingField.checked = provider.streamingSupport || false;
            } else {
                if (modelField) modelField.value = provider.model || '';
                if (baseUrlField) baseUrlField.value = provider.baseUrl || '';
            }
        });

        // Load function call rounds setting
        if (this.configManager) {
            const functionCallRounds = this.configManager.get('llm.functionCallRounds', 3);
            const functionCallRoundsField = document.getElementById('functionCallRounds');
            if (functionCallRoundsField) {
                functionCallRoundsField.value = functionCallRounds;
            }

            // Load early completion settings
            const enableEarlyCompletion = this.configManager.get('llm.enableEarlyCompletion', true);
            const enableEarlyCompletionField = document.getElementById('enableEarlyCompletion');
            if (enableEarlyCompletionField) {
                enableEarlyCompletionField.checked = enableEarlyCompletion;
            }
            
            const completionThreshold = this.configManager.get('llm.completionThreshold', 0.7);
            const completionThresholdField = document.getElementById('completionThreshold');
            const completionThresholdValueField = document.getElementById('completionThresholdValue');
            if (completionThresholdField) {
                completionThresholdField.value = completionThreshold;
            }
            if (completionThresholdValueField) {
                completionThresholdValueField.textContent = completionThreshold.toFixed(2);
            }

            // Load system prompt setting
            const systemPrompt = this.configManager.get('llm.systemPrompt', '');
            const systemPromptField = document.getElementById('systemPrompt');
            if (systemPromptField) {
                systemPromptField.value = systemPrompt;
            }
        }
    }

    updateUI() {
        // Skip UI updates if not in UI mode
        if (!this.hasRequiredUIElements()) {
            return;
        }
        
        // Update current provider display
        const currentProviderElement = document.getElementById('currentProvider');
        if (currentProviderElement) {
            if (this.currentProvider && this.providers[this.currentProvider]) {
                currentProviderElement.textContent = this.providers[this.currentProvider].name;
            } else {
                currentProviderElement.textContent = 'None';
            }
        }
    }

    async testConnection() {
        const activeTab = document.querySelector('.tab-button.active').dataset.provider;
        const testBtn = document.getElementById('testConnectionBtn');
        
        // Update button state
        testBtn.classList.add('testing');
        testBtn.innerHTML = '<i class="fas fa-spinner"></i> Testing...';
        
        try {
            // Get current form values
            const provider = { ...this.providers[activeTab] };
            const prefix = activeTab === 'local' ? 'local' : activeTab;
            
            provider.apiKey = document.getElementById(`${prefix}ApiKey`).value;
            
            if (activeTab === 'custom') {
                provider.model = document.getElementById('customModel').value;
                provider.baseUrl = document.getElementById('customBaseUrl').value;
                provider.apiFormat = document.getElementById('customApiFormat').value;
                try {
                    const headersText = document.getElementById('customHeaders').value.trim();
                    provider.customHeaders = headersText ? JSON.parse(headersText) : {};
                } catch (error) {
                    provider.customHeaders = {};
                }
            } else {
                provider.model = document.getElementById(`${prefix}Model`).value;
                provider.baseUrl = document.getElementById(`${prefix}BaseUrl`)?.value || 
                                 document.getElementById('localEndpoint')?.value;
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
                case 'local':
                    return await this.testLocal(config);
                case 'custom':
                    return await this.testCustom(config);
                default:
                    throw new Error('Unknown provider type');
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async testOpenAI(config) {
        const response = await fetch(`${config.baseUrl}/models`, {
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return { success: true };
    }

    async testAnthropic(config) {
        const response = await fetch(`${config.baseUrl}/v1/messages`, {
            method: 'POST',
            headers: {
                'x-api-key': config.apiKey,
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: config.model,
                max_tokens: 1,
                messages: [{ role: 'user', content: 'test' }]
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return { success: true };
    }

    async testGoogle(config) {
        const response = await fetch(`${config.baseUrl}/v1/models?key=${config.apiKey}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return { success: true };
    }

    async testDeepSeek(config) {
        const response = await fetch(`${config.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: config.model,
                messages: [{ role: 'user', content: 'Hello, can you confirm you are working?' }],
                max_tokens: 10
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return { success: true };
    }

    async testSiliconFlow(config) {
        const response = await fetch(`${config.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: config.model,
                messages: [{ role: 'user', content: 'Hello, can you confirm you are working?' }],
                max_tokens: 10
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return { success: true };
    }

    async testLocal(config) {
        const response = await fetch(`${config.baseUrl}/models`, {
            headers: config.apiKey ? {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json'
            } : {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return { success: true };
    }

    async testCustom(config) {
        try {
            let testEndpoint;
            let testMethod = 'POST';
            let testHeaders = {
                'Content-Type': 'application/json',
                ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` }),
                ...config.customHeaders
            };
            let testBody;

            // Based on API format, determine how to test
            switch (config.apiFormat) {
                case 'openai':
                    testEndpoint = `${config.baseUrl}/models`;
                    testMethod = 'GET';
                    break;
                case 'anthropic':
                    testEndpoint = `${config.baseUrl}/v1/messages`;
                    testBody = JSON.stringify({
                        model: config.model,
                        max_tokens: 10,
                        messages: [{ role: 'user', content: 'test' }]
                    });
                    break;
                case 'google':
                    testEndpoint = `${config.baseUrl}/v1beta/models/${config.model}:generateContent`;
                    testBody = JSON.stringify({
                        contents: [{ parts: [{ text: 'test' }] }],
                        generationConfig: { maxOutputTokens: 10 }
                    });
                    break;
                default:
                    // For custom format, try a simple GET to /models or base URL
                    testEndpoint = config.baseUrl.includes('/models') ? config.baseUrl : `${config.baseUrl}/models`;
                    testMethod = 'GET';
            }

            const response = await fetch(testEndpoint, {
                method: testMethod,
                headers: testHeaders,
                ...(testBody && { body: testBody })
            });

            if (response.ok || response.status === 400) { // 400 might be expected for test requests
                return { success: true };
            } else {
                return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async sendMessage(message, context = null) {
        if (!this.currentProvider || !this.providers[this.currentProvider].enabled) {
            throw new Error('No LLM provider configured');
        }

        const provider = this.providers[this.currentProvider];
        
        try {
            switch (this.currentProvider) {
                case 'openai':
                    return await this.sendOpenAIMessage(provider, message, context);
                case 'anthropic':
                    return await this.sendAnthropicMessage(provider, message, context);
                case 'google':
                    return await this.sendGoogleMessage(provider, message, context);
                case 'deepseek':
                    return await this.sendDeepSeekMessage(provider, message, context);
                case 'siliconflow':
                    return await this.sendSiliconFlowMessage(provider, message, context);
                case 'local':
                    return await this.sendLocalMessage(provider, message, context);
                case 'custom':
                    return await this.sendCustomMessage(provider, message, context);
                default:
                    throw new Error('Unknown provider type');
            }
        } catch (error) {
            console.error('Error sending message to LLM:', error);
            throw error;
        }
    }

    async sendMessageWithHistory(conversationHistory, context = null) {
        if (!this.currentProvider || !this.providers[this.currentProvider].enabled) {
            throw new Error('No LLM provider configured');
        }

        const provider = this.providers[this.currentProvider];
        
        try {
            switch (this.currentProvider) {
                case 'openai':
                    return await this.sendOpenAIMessageWithHistory(provider, conversationHistory, context);
                case 'anthropic':
                    return await this.sendAnthropicMessageWithHistory(provider, conversationHistory, context);
                case 'google':
                    return await this.sendGoogleMessageWithHistory(provider, conversationHistory, context);
                case 'deepseek':
                    return await this.sendDeepSeekMessageWithHistory(provider, conversationHistory, context);
                case 'siliconflow':
                    return await this.sendSiliconFlowMessageWithHistory(provider, conversationHistory, context);
                case 'local':
                    return await this.sendLocalMessageWithHistory(provider, conversationHistory, context);
                case 'custom':
                    return await this.sendCustomMessageWithHistory(provider, conversationHistory, context);
                default:
                    throw new Error('Unknown provider type');
            }
        } catch (error) {
            console.error('Error sending message with history to LLM:', error);
            throw error;
        }
    }

    async sendOpenAIMessage(provider, message, context) {
        const messages = this.buildMessages(message, context);
        console.log('Sending to OpenAI - Request Payload:', JSON.stringify({
            model: provider.model,
            messages: messages,
            max_tokens: 2000,
            temperature: 0.7
        }, null, 2));
        
        const response = await fetch(`${provider.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${provider.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: provider.model,
                messages: messages,
                max_tokens: 2000,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    async sendOpenAIMessageWithHistory(provider, conversationHistory, context) {
        console.log('Sending to OpenAI - Request Payload:', JSON.stringify({
            model: provider.model,
            messages: conversationHistory,
            max_tokens: 2000,
            temperature: 0.7
        }, null, 2));
        
        const response = await fetch(`${provider.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${provider.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: provider.model,
                messages: conversationHistory,
                max_tokens: 2000,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    async sendAnthropicMessage(provider, message, context) {
        const messages = this.buildMessages(message, context, 'anthropic');
        console.log('Sending to Anthropic - Request Payload:', JSON.stringify({
            model: provider.model,
            max_tokens: 2000,
            messages: messages
        }, null, 2));
        
        const response = await fetch(`${provider.baseUrl}/v1/messages`, {
            method: 'POST',
            headers: {
                'x-api-key': provider.apiKey,
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: provider.model,
                max_tokens: 2000,
                messages: messages
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data.content[0].text;
    }

    async sendAnthropicMessageWithHistory(provider, conversationHistory, context) {
        // Anthropic requires separate system message
        const systemMessage = conversationHistory.find(msg => msg.role === 'system');
        const messages = conversationHistory.filter(msg => msg.role !== 'system');
        
        const payload = {
            model: provider.model,
            max_tokens: 2000,
            messages: messages
        };
        
        if (systemMessage) {
            payload.system = systemMessage.content;
        }
        
        console.log('Sending to Anthropic - Request Payload:', JSON.stringify(payload, null, 2));
        
        const response = await fetch(`${provider.baseUrl}/v1/messages`, {
            method: 'POST',
            headers: {
                'x-api-key': provider.apiKey,
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data.content[0].text;
    }

    async sendGoogleMessage(provider, message, context) {
        const prompt = this.buildGooglePrompt(message, context);
        const payload = {
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                maxOutputTokens: 2000,
                temperature: 0.7
            }
        };
        console.log('Sending to Google - Request Payload:', JSON.stringify(payload, null, 2));
        
        const apiUrl = `${provider.baseUrl}/v1beta/models/${provider.model}:generateContent?key=${provider.apiKey}`;
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error('Google API Error:', response.status, errorBody);
            throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorBody}`);
        }

        const data = await response.json();
        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts.length > 0) {
            return data.candidates[0].content.parts[0].text;
        } else {
            console.error('Invalid response structure from Google API:', data);
            throw new Error('Invalid response structure from Google API. Check console for details.');
        }
    }

    async sendGoogleMessageWithHistory(provider, conversationHistory, context) {
        // Google uses a different conversation format
        const contents = [];
        
        for (const message of conversationHistory) {
            if (message.role === 'system') continue; // Skip system messages for Google
            
            let role = 'user';
            if (message.role === 'assistant') {
                role = 'model';
            }
            
            contents.push({
                role: role,
                parts: [{ text: message.content }]
            });
        }
        
        const payload = {
            contents: contents,
            generationConfig: {
                maxOutputTokens: 2000,
                temperature: 0.7
            }
        };
        
        console.log('Sending to Google - Request Payload:', JSON.stringify(payload, null, 2));
        
        const apiUrl = `${provider.baseUrl}/v1beta/models/${provider.model}:generateContent?key=${provider.apiKey}`;
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error('Google API Error:', response.status, errorBody);
            throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorBody}`);
        }

        const data = await response.json();
        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts.length > 0) {
            return data.candidates[0].content.parts[0].text;
        } else {
            console.error('Invalid response structure from Google API:', data);
            throw new Error('Invalid response structure from Google API. Check console for details.');
        }
    }

    async sendDeepSeekMessage(provider, message, context) {
        const messages = this.buildMessages(message, context);
        console.log('Sending to DeepSeek - Request Payload:', JSON.stringify({
            model: provider.model,
            messages: messages,
            max_tokens: 2000,
            temperature: 0.7
        }, null, 2));
        
        const response = await fetch(`${provider.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${provider.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: provider.model,
                messages: messages,
                max_tokens: 2000,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    async sendDeepSeekMessageWithHistory(provider, conversationHistory, context) {
        console.log('Sending to DeepSeek - Request Payload:', JSON.stringify({
            model: provider.model,
            messages: conversationHistory,
            max_tokens: 2000,
            temperature: 0.7
        }, null, 2));
        
        const response = await fetch(`${provider.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${provider.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: provider.model,
                messages: conversationHistory,
                max_tokens: 2000,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    async sendSiliconFlowMessage(provider, message, context) {
        const messages = this.buildMessages(message, context);
        console.log('Sending to SiliconFlow - Request Payload:', JSON.stringify({
            model: provider.model,
            messages: messages,
            max_tokens: 2000,
            temperature: 0.7
        }, null, 2));
        
        const response = await fetch(`${provider.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${provider.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: provider.model,
                messages: messages,
                max_tokens: 2000,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    async sendSiliconFlowMessageWithHistory(provider, conversationHistory, context) {
        console.log('Sending to SiliconFlow - Request Payload:', JSON.stringify({
            model: provider.model,
            messages: conversationHistory,
            max_tokens: 2000,
            temperature: 0.7
        }, null, 2));
        
        const response = await fetch(`${provider.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${provider.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: provider.model,
                messages: conversationHistory,
                max_tokens: 2000,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

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
        const content = choice.message.content;
        console.log('SiliconFlow Content Extracted:', content);
        console.log('Content type:', typeof content);
        console.log('Content length:', content ? content.length : 'null/undefined');
        
        // Handle empty content
        if (!content || content === null || content === undefined || content.trim() === '') {
            console.warn('SiliconFlow: Empty content returned, completion_tokens:', data.usage?.completion_tokens);
            // Don't throw error immediately - let ChatManager handle empty responses and check history
            console.warn('SiliconFlow: Returning empty content to ChatManager for history check');
            return ''; // Return empty string for ChatManager to process
        }
        
        return content;
    }

    async sendLocalMessage(provider, message, context) {
        const messages = this.buildMessages(message, context);
        
        const apiUrl = `${provider.baseUrl}/chat/completions`;
        const payload = {
            model: provider.model,
            messages: messages,
            max_tokens: 2000,
            temperature: 0.7,
            stream: false // Assuming stream is false for now based on previous setup
        };
        console.log(`Sending local LLM request to: ${apiUrl} with model: ${provider.model}`);
        console.log('Sending to Local LLM - Request Payload:', JSON.stringify(payload, null, 2));

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: provider.apiKey ? {
                'Authorization': `Bearer ${provider.apiKey}`,
                'Content-Type': 'application/json'
            } : {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBody = await response.text(); // Get error body as text
            console.error(`Local LLM API Error (${response.status}): ${errorBody}`);
            throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorBody}`);
        }

        const data = await response.json();
        // Log the full raw response from the local LLM
        console.log('Full raw response from Local LLM:', JSON.stringify(data, null, 2));

        // Check if the response structure indicates a tool call (OpenAI-like pattern)
        if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.tool_calls) {
            console.log('Local LLM appears to be requesting a tool call:', data.choices[0].message.tool_calls);
            // Return the entire message object, which includes tool_calls, so ChatManager can process it.
            return data.choices[0].message;
        } else if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
            // Standard text response
            return data.choices[0].message.content;
        } else {
            console.error('Unexpected response structure from Local LLM:', data);
            throw new Error('Unexpected response structure from Local LLM. Check console for details.');
        }
    }

    async sendLocalMessageWithHistory(provider, conversationHistory, context) {
        const apiUrl = `${provider.baseUrl}/chat/completions`;
        const payload = {
            model: provider.model,
            messages: conversationHistory,
            max_tokens: 2000,
            temperature: 0.7,
            stream: false
        };
        
        console.log(`Sending local LLM request to: ${apiUrl} with model: ${provider.model}`);
        console.log('Sending to Local LLM - Request Payload:', JSON.stringify(payload, null, 2));

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: provider.apiKey ? {
                'Authorization': `Bearer ${provider.apiKey}`,
                'Content-Type': 'application/json'
            } : {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`Local LLM API Error (${response.status}): ${errorBody}`);
            throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorBody}`);
        }

        const data = await response.json();
        console.log('Full raw response from Local LLM:', JSON.stringify(data, null, 2));

        if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.tool_calls) {
            console.log('Local LLM appears to be requesting a tool call:', data.choices[0].message.tool_calls);
            return data.choices[0].message;
        } else if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
            return data.choices[0].message.content;
        } else {
            console.error('Unexpected response structure from Local LLM:', data);
            throw new Error('Unexpected response structure from Local LLM. Check console for details.');
        }
    }

    async sendCustomMessage(provider, message, context) {
        const messages = this.buildMessages(message, context, provider.apiFormat);
        
        // Build request based on API format
        return await this.sendCustomRequest(provider, messages, false);
    }

    async sendCustomMessageWithHistory(provider, conversationHistory, context) {
        // Use the conversation history directly
        return await this.sendCustomRequest(provider, conversationHistory, true);
    }

    async sendCustomRequest(provider, messages, isHistory) {
        console.log(`Sending custom LLM request to: ${provider.baseUrl} with model: ${provider.model}`);
        console.log('Custom provider config:', {
            apiFormat: provider.apiFormat,
            maxTokens: provider.maxTokens,
            temperature: provider.temperature,
            streamingSupport: provider.streamingSupport
        });
        
        let endpoint, requestBody, requestHeaders;
        
        // Build request based on API format
        switch (provider.apiFormat) {
            case 'openai':
                endpoint = `${provider.baseUrl}/chat/completions`;
                requestHeaders = {
                    'Authorization': `Bearer ${provider.apiKey}`,
                    'Content-Type': 'application/json',
                    ...provider.customHeaders
                };
                requestBody = {
                    model: provider.model,
                    messages: messages,
                    max_tokens: provider.maxTokens || 2000,
                    temperature: provider.temperature || 0.7
                };
                break;
                
            case 'anthropic':
                endpoint = `${provider.baseUrl}/v1/messages`;
                requestHeaders = {
                    'x-api-key': provider.apiKey,
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    ...provider.customHeaders
                };
                
                // Anthropic requires separate system message
                const systemMessage = messages.find(msg => msg.role === 'system');
                const messagesWithoutSystem = messages.filter(msg => msg.role !== 'system');
                
                requestBody = {
                    model: provider.model,
                    max_tokens: provider.maxTokens || 2000,
                    messages: messagesWithoutSystem
                };
                
                if (systemMessage) {
                    requestBody.system = systemMessage.content;
                }
                break;
                
            case 'google':
                endpoint = `${provider.baseUrl}/v1beta/models/${provider.model}:generateContent`;
                requestHeaders = {
                    'Content-Type': 'application/json',
                    ...provider.customHeaders
                };
                
                // Add API key to URL for Google
                if (provider.apiKey) {
                    endpoint += `?key=${provider.apiKey}`;
                }
                
                // Convert messages to Google format
                const contents = messages.filter(msg => msg.role !== 'system').map(msg => ({
                    parts: [{ text: msg.content }],
                    role: msg.role === 'assistant' ? 'model' : 'user'
                }));
                
                requestBody = {
                    contents: contents,
                    generationConfig: {
                        maxOutputTokens: provider.maxTokens || 2000,
                        temperature: provider.temperature || 0.7
                    }
                };
                break;
                
            default:
                // Custom format - assume OpenAI-like structure
                endpoint = `${provider.baseUrl}/chat/completions`;
                requestHeaders = {
                    'Authorization': `Bearer ${provider.apiKey}`,
                    'Content-Type': 'application/json',
                    ...provider.customHeaders
                };
                requestBody = {
                    model: provider.model,
                    messages: messages,
                    max_tokens: provider.maxTokens || 2000,
                    temperature: provider.temperature || 0.7
                };
        }
        
        console.log('Sending to Custom Provider - Request Payload:', JSON.stringify(requestBody, null, 2));
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: requestHeaders,
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`Custom LLM API Error (${response.status}): ${errorBody}`);
            throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorBody}`);
        }

        const data = await response.json();
        console.log('Full raw response from Custom Provider:', JSON.stringify(data, null, 2));

        // Parse response based on API format
        switch (provider.apiFormat) {
            case 'openai':
                if (data.choices && data.choices[0] && data.choices[0].message) {
                    if (data.choices[0].message.tool_calls) {
                        return data.choices[0].message;
                    } else {
                        return data.choices[0].message.content;
                    }
                }
                break;
                
            case 'anthropic':
                if (data.content && data.content[0]) {
                    return data.content[0].text;
                }
                break;
                
            case 'google':
                if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                    return data.candidates[0].content.parts[0].text;
                }
                break;
                
            default:
                // Try OpenAI format first, then fallback
                if (data.choices && data.choices[0] && data.choices[0].message) {
                    return data.choices[0].message.content;
                } else if (data.content) {
                    return data.content;
                } else if (data.response) {
                    return data.response;
                }
        }
        
        console.error('Unexpected response structure from Custom Provider:', data);
        throw new Error('Unexpected response structure from Custom Provider. Check console for details.');
    }

    buildMessages(userMessage, context, providerType = 'openai') {
        const messages = [];
        
        // System message with context
        const systemMessage = this.buildSystemMessage(context);
        
        if (providerType === 'anthropic') {
            // Anthropic doesn't use system messages in the same way
            messages.push({
                role: 'user',
                content: systemMessage + '\n\nUser: ' + userMessage
            });
        } else {
            messages.push({
                role: 'system',
                content: systemMessage
            });
            messages.push({
                role: 'user',
                content: userMessage
            });
        }
        
        return messages;
    }

    buildGooglePrompt(userMessage, context) {
        const systemMessage = this.buildSystemMessage(context);
        return `${systemMessage}\n\nUser: ${userMessage}\n\nAssistant:`;
    }

    buildSystemMessage(context) {
        let systemMessage = `You are an AI assistant for a Genome AI Studio application. You help users analyze genomic data, navigate sequences, search for genes, and understand biological features.

You have access to tools that can:
- Navigate to specific genomic positions (use tool: 'navigate_to_position', parameters: {chromosome: string, start: number, end: number})
- Search for genes and features BY NAME/DESCRIPTION (use tool: 'search_features', parameters: {query: string, caseSensitive: boolean}) - Use this when users want to find genes by name, product description, or any text-based search like "DNA polymerase", "ribosomal", "lacZ", etc. This will display results in the search panel.
- Find features near a specific genomic position (use tool: 'get_nearby_features', parameters: {position: number, distance: number, featureTypes?: array}) - Use this only when users want to find what's near a specific coordinate/position, not for name-based searches.
- Get current browser state (use tool: 'get_current_state') - This will provide general information including counts of annotations and user-defined features.
- Retrieve DNA sequences (use tool: 'get_sequence', parameters: {chromosome: string, start: number, end: number})
- Toggle track visibility (use tool: 'toggle_track', parameters: {trackName: string, visible: boolean})
- Create annotations (use tool: 'create_annotation', parameters: {type: string, name: string, chromosome: string, start: number, end: number, strand: number, description?: string})
- Analyze genomic regions (use tool: 'analyze_region', parameters: {chromosome: string, start: number, end: number, includeFeatures?: boolean, includeGC?: boolean})
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
- For gene/text search: {"tool_name": "search_features", "parameters": {"query": "DNA polymerase", "caseSensitive": false}}
- For position search: {"tool_name": "get_nearby_features", "parameters": {"position": 12345, "distance": 5000}}

If the user is asking a general question that doesn't require a tool, respond normally with conversational text.`;

        if (context && context.genomeBrowser && context.genomeBrowser.currentState) {
            // Debug: Log the actual context structure
            console.log('Context structure for system message:', JSON.stringify(context, null, 2));
            console.log('Current state:', context.genomeBrowser.currentState);
            
            // Only append a summary of the context, not the whole thing if it's still too large.
            // For now, the main change is that the LLM knows annotationsCount is a count.
            // We can be more sophisticated here later if needed.
            const currentState = context.genomeBrowser.currentState;
            systemMessage += `\n\nCurrent context summary:\n- Chromosome: ${currentState.currentChromosome || 'N/A'}\n- Position: ${currentState.currentPosition ? `${currentState.currentPosition.start}-${currentState.currentPosition.end}` : 'N/A'}\n- Annotations Loaded: ${currentState.annotationsCount || 0}\n- User Features: ${currentState.userDefinedFeaturesCount || 0}`;
        } else if (context) {
            // Fallback for a differently structured context, though less likely now
            console.log('Context provided but not in expected structure:', context);
            systemMessage += `\n\n(Partial context provided)`;
        }

        return systemMessage;
    }

    previewSystemPrompt() {
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
                userDefinedFeaturesCount: 8
            });
        } else {
            // Show the default system prompt with sample context
            const sampleContext = {
                genomeBrowser: {
                    currentState: {
                        currentChromosome: 'chr1',
                        currentPosition: { start: 1000, end: 5000 },
                        annotationsCount: 125,
                        userDefinedFeaturesCount: 8
                    }
                }
            };
            previewPrompt = this.buildSystemMessage(sampleContext);
        }

        // Create modal to show preview
        this.showSystemPromptPreview(previewPrompt, userPrompt ? 'Custom' : 'Default');
    }

    processSystemPromptVariables(systemPrompt, context = {}) {
        let processedPrompt = systemPrompt;
        
        // Replace variables with context values
        const variables = {
            '{{CURRENT_CHROMOSOME}}': context.currentChromosome || 'N/A',
            '{{CURRENT_POSITION}}': context.currentPosition ? 
                `${context.currentPosition.start}-${context.currentPosition.end}` : 'N/A',
            '{{ANNOTATIONS_COUNT}}': context.annotationsCount || 0,
            '{{USER_FEATURES_COUNT}}': context.userDefinedFeaturesCount || 0
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

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });

        // Close on Escape key
        const handleEscape = (e) => {
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
            currentProvider: this.currentProvider,
            providers: this.providers
        };
    }

    isConfigured() {
        return this.currentProvider && this.providers[this.currentProvider].enabled;
    }
} 