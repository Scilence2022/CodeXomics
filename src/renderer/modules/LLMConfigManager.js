/**
 * LLMConfigManager - Manages LLM provider configurations and API communication
 */
class LLMConfigManager {
    constructor() {
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
            local: {
                name: 'Local LLM',
                apiKey: '',
                model: 'llama3.2',
                baseUrl: 'http://localhost:11434/v1',
                streamingSupport: true,
                enabled: false
            }
        };
        
        this.loadConfiguration();
        this.initializeUI();
    }

    initializeUI() {
        this.setupEventListeners();
        this.updateUI();
    }

    setupEventListeners() {
        // Ensure DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupEventListeners());
            return;
        }
        
        console.log('Setting up LLM Config Manager event listeners...');
        
        // Options menu dropdown
        const optionsBtn = document.getElementById('optionsBtn');
        console.log('Options button found:', optionsBtn);
        
        if (optionsBtn) {
            optionsBtn.addEventListener('click', (e) => {
                console.log('Options button clicked');
                e.stopPropagation();
                this.toggleOptionsDropdown();
            });
        } else {
            console.error('Options button not found in DOM');
        }

        // Check if dropdown menu exists
        const optionsDropdownMenu = document.getElementById('optionsDropdownMenu');
        console.log('Options dropdown menu found:', optionsDropdownMenu);
        
        if (!optionsDropdownMenu) {
            console.error('Options dropdown menu not found in DOM');
        }

        // Configure LLM button
        const configureLLMBtn = document.getElementById('configureLLMBtn');
        console.log('Configure LLM button found:', configureLLMBtn);
        
        if (configureLLMBtn) {
            configureLLMBtn.addEventListener('click', () => {
                console.log('Configure LLM button clicked');
                this.showConfigModal();
            });
        } else {
            console.error('Configure LLM button not found in DOM');
        }

        // Provider tabs
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', () => {
                this.switchProviderTab(button.dataset.provider);
            });
        });

        // Save configuration
        document.getElementById('saveLLMConfigBtn').addEventListener('click', () => {
            this.saveConfiguration();
        });

        // Test connection
        document.getElementById('testConnectionBtn').addEventListener('click', () => {
            this.testConnection();
        });

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
            { btnId: 'pasteLocalApiKeyBtn', inputId: 'localApiKey' }
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
            } else {
                console.warn(`Could not find paste button or input for: ${config.btnId}/${config.inputId}`);
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

        // Click outside modal to close
        document.getElementById('llmConfigModal').addEventListener('click', (e) => {
            if (e.target.id === 'llmConfigModal') {
                this.hideConfigModal();
            }
        });
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
        try {
            const savedConfig = localStorage.getItem('llmConfiguration');
            if (savedConfig) {
                const config = JSON.parse(savedConfig);
                this.providers = { ...this.providers, ...config.providers };
                this.currentProvider = config.currentProvider;
            }
        } catch (error) {
            console.error('Error loading LLM configuration:', error);
        }
    }

    saveConfiguration() {
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
                provider.enabled = !!(provider.apiKey || providerKey === 'local') && provider.model;
            });

            // Set current provider to the active tab if it's enabled
            if (this.providers[currentTab].enabled) {
                this.currentProvider = currentTab;
            }

            // Save to localStorage
            const config = {
                providers: this.providers,
                currentProvider: this.currentProvider
            };
            localStorage.setItem('llmConfiguration', JSON.stringify(config));
            
            this.updateUI();
            this.hideConfigModal();
            
            // Show success message
            this.showNotification('Configuration saved successfully!', 'success');
        } catch (error) {
            console.error('Error saving LLM configuration:', error);
            this.showNotification('Error saving configuration', 'error');
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

            } else {
                if (modelField) modelField.value = provider.model || '';
                if (baseUrlField) baseUrlField.value = provider.baseUrl || '';
            }
        });
    }

    updateUI() {
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
            provider.model = document.getElementById(`${prefix}Model`).value;
            provider.baseUrl = document.getElementById(`${prefix}BaseUrl`)?.value || 
                             document.getElementById('localEndpoint')?.value;
            
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
                case 'local':
                    return await this.sendLocalMessage(provider, message, context);
                default:
                    throw new Error('Unknown provider type');
            }
        } catch (error) {
            console.error('Error sending message to LLM:', error);
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
        let systemMessage = `You are an AI assistant for a Genome Browser application. You help users analyze genomic data, navigate sequences, search for genes, and understand biological features.

You have access to tools that can:
- Navigate to specific genomic positions (use tool: 'navigate_to_position', parameters: {chromosome: string, start: number, end: number})
- Search for genes and features (use tool: 'search_features', parameters: {query: string, caseSensitive: boolean}) - Use this to get details about annotations if needed.
- Get current browser state (use tool: 'get_current_state') - This will provide general information including counts of annotations and user-defined features.
- Retrieve DNA sequences (use tool: 'get_sequence', parameters: {chromosome: string, start: number, end: number})
- Toggle track visibility (use tool: 'toggle_track', parameters: {trackName: string, visible: boolean})
- Create annotations (use tool: 'create_annotation', parameters: {type: string, name: string, chromosome: string, start: number, end: number, strand: number, description?: string})
- Analyze genomic regions (use tool: 'analyze_region', parameters: {chromosome: string, start: number, end: number, includeFeatures?: boolean, includeGC?: boolean})
- Export data (use tool: 'export_data', parameters: {format: string, chromosome?: string, start?: number, end?: number})

When a user's request requires one of these actions, you should respond ONLY with a JSON object describing the tool call. For example:
To navigate, respond with: {"tool_name": "navigate_to_position", "parameters": {"chromosome": "chr1", "start": 1000, "end": 2000}}
To search, respond with: {"tool_name": "search_features", "parameters": {"query": "recA", "caseSensitive": false}}
If you are just providing information or answering a question, respond normally.
Your primary goal is to assist the user by utilizing these tools effectively when appropriate.

The current browser state (obtained via 'get_current_state' or provided in context) includes 'annotationsCount' and 'userDefinedFeaturesCount', which are the total numbers of annotations and user-defined features, respectively. To get details about specific annotations, use the 'search_features' tool.`;

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