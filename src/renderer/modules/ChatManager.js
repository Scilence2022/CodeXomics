/**
 * ChatManager - Handles LLM chat interface and MCP communication
 */
class ChatManager {
    constructor(app) {
        this.app = app;
        this.mcpSocket = null;
        this.clientId = null;
        this.isConnected = false;
        this.messageHistory = [];
        this.activeRequests = new Map();
        this.pendingMessages = [];
        
        // Initialize LLM configuration manager
        this.llmConfigManager = new LLMConfigManager();
        
        this.setupMCPConnection();
        this.initializeUI();
    }

    async setupMCPConnection() {
        try {
            this.mcpSocket = new WebSocket('ws://localhost:3001');
            
            this.mcpSocket.onopen = () => {
                console.log('Connected to MCP server');
                this.isConnected = true;
                this.updateConnectionStatus(true);
                
                // Send any pending messages
                this.pendingMessages.forEach(msg => this.sendToMCP(msg));
                this.pendingMessages = [];
            };

            this.mcpSocket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMCPMessage(data);
                } catch (error) {
                    console.error('Error parsing MCP message:', error);
                }
            };

            this.mcpSocket.onclose = () => {
                console.log('Disconnected from MCP server');
                this.isConnected = false;
                this.updateConnectionStatus(false);
                
                // Attempt to reconnect after 5 seconds
                setTimeout(() => this.setupMCPConnection(), 5000);
            };

            this.mcpSocket.onerror = (error) => {
                console.error('MCP connection error:', error);
                this.updateConnectionStatus(false);
            };

        } catch (error) {
            console.error('Failed to setup MCP connection:', error);
            this.updateConnectionStatus(false);
        }
    }

    handleMCPMessage(data) {
        switch (data.type) {
            case 'connection':
                this.clientId = data.clientId;
                console.log('Received client ID:', this.clientId);
                break;
                
            case 'execute-tool':
                this.executeToolRequest(data);
                break;
                
            case 'tool-response':
                // Handle responses from tool executions
                if (this.activeRequests.has(data.requestId)) {
                    const resolve = this.activeRequests.get(data.requestId);
                    this.activeRequests.delete(data.requestId);
                    resolve(data);
                }
                break;
        }
    }

    async executeToolRequest(data) {
        const { requestId, toolName, parameters } = data;
        
        try {
            let result;
            
            switch (toolName) {
                case 'navigate_to_position':
                    result = await this.navigateToPosition(parameters);
                    break;
                    
                case 'search_features':
                    result = await this.searchFeatures(parameters);
                    break;
                    
                case 'get_current_state':
                    result = this.getCurrentState();
                    break;
                    
                case 'get_sequence':
                    result = await this.getSequence(parameters);
                    break;
                    
                case 'toggle_track':
                    result = await this.toggleTrack(parameters);
                    break;
                    
                case 'create_annotation':
                    result = await this.createAnnotation(parameters);
                    break;
                    
                case 'analyze_region':
                    result = await this.analyzeRegion(parameters);
                    break;
                    
                case 'export_data':
                    result = await this.exportData(parameters);
                    break;
                    
                default:
                    throw new Error(`Unknown tool: ${toolName}`);
            }

            this.sendToMCP({
                type: 'tool-response',
                requestId: requestId,
                success: true,
                result: result
            });

        } catch (error) {
            this.sendToMCP({
                type: 'tool-response',
                requestId: requestId,
                success: false,
                error: error.message
            });
        }
    }

    // Tool implementations
    async navigateToPosition(params) {
        const { chromosome, start, end } = params;
        
        // Use existing navigation functionality
        if (this.app && this.app.navigationManager) {
            await this.app.navigationManager.goToPosition(chromosome, start, end);
            
            return {
                success: true,
                chromosome: chromosome,
                start: start,
                end: end,
                message: `Navigated to ${chromosome}:${start}-${end}`
            };
        }
        
        throw new Error('Navigation manager not available');
    }

    async searchFeatures(params) {
        const { query, caseSensitive } = params;
        
        // Use existing search functionality
        if (this.app && this.app.search) {
            const results = await this.app.search(query, caseSensitive);
            
            return {
                query: query,
                caseSensitive: caseSensitive || false,
                results: results,
                count: results.length
            };
        }
        
        throw new Error('Search functionality not available');
    }

    getCurrentState() {
        if (!this.app) {
            throw new Error('Genome browser not initialized');
        }

        const state = {
            currentChromosome: this.app.currentChromosome,
            currentPosition: this.app.currentPosition,
            visibleTracks: this.getVisibleTracks(),
            loadedFiles: this.app.loadedFiles || [],
            sequenceLength: this.app.sequenceLength || 0,
            annotations: this.app.currentAnnotations || [],
            userDefinedFeatures: Object.keys(this.app.userDefinedFeatures || {}).length
        };

        return state;
    }

    async getSequence(params) {
        const { chromosome, start, end } = params;
        
        if (this.app && this.app.getSequenceForRegion) {
            const sequence = await this.app.getSequenceForRegion(chromosome, start, end);
            
            return {
                chromosome: chromosome,
                start: start,
                end: end,
                sequence: sequence,
                length: sequence.length
            };
        }
        
        throw new Error('Sequence retrieval not available');
    }

    async toggleTrack(params) {
        const { trackName, visible } = params;
        
        const trackCheckbox = document.getElementById(`track${trackName.charAt(0).toUpperCase() + trackName.slice(1)}`);
        if (trackCheckbox) {
            trackCheckbox.checked = visible;
            trackCheckbox.dispatchEvent(new Event('change'));
            
            return {
                track: trackName,
                visible: visible,
                message: `Track ${trackName} ${visible ? 'shown' : 'hidden'}`
            };
        }
        
        throw new Error(`Track ${trackName} not found`);
    }

    async createAnnotation(params) {
        const { type, name, chromosome, start, end, strand, description } = params;
        
        if (this.app && this.app.addUserDefinedFeature) {
            const feature = {
                type: type,
                name: name,
                chromosome: chromosome,
                start: start,
                end: end,
                strand: strand || 1,
                description: description || ''
            };
            
            const featureId = await this.app.addUserDefinedFeature(feature);
            
            return {
                success: true,
                featureId: featureId,
                feature: feature,
                message: `Created ${type} annotation: ${name}`
            };
        }
        
        throw new Error('Annotation creation not available');
    }

    async analyzeRegion(params) {
        const { chromosome, start, end, includeFeatures, includeGC } = params;
        
        const analysis = {
            chromosome: chromosome,
            start: start,
            end: end,
            length: end - start + 1
        };

        // Get sequence if available
        if (this.app && this.app.getSequenceForRegion) {
            analysis.sequence = await this.app.getSequenceForRegion(chromosome, start, end);
        }

        // Get features if requested
        if (includeFeatures && this.app.currentAnnotations) {
            analysis.features = this.app.currentAnnotations.filter(feature => 
                feature.chromosome === chromosome &&
                feature.start >= start && feature.end <= end
            );
        }

        // Calculate GC content if requested
        if (includeGC && analysis.sequence) {
            const gcCount = (analysis.sequence.match(/[GC]/gi) || []).length;
            analysis.gcContent = (gcCount / analysis.sequence.length * 100).toFixed(2);
        }

        return analysis;
    }

    async exportData(params) {
        const { format, chromosome, start, end } = params;
        
        if (this.app && this.app.exportManager) {
            let exportFunction;
            
            switch (format.toLowerCase()) {
                case 'fasta':
                    exportFunction = this.app.exportManager.exportFasta;
                    break;
                case 'genbank':
                    exportFunction = this.app.exportManager.exportGenBank;
                    break;
                case 'gff':
                    exportFunction = this.app.exportManager.exportGFF;
                    break;
                case 'bed':
                    exportFunction = this.app.exportManager.exportBED;
                    break;
                default:
                    throw new Error(`Unsupported export format: ${format}`);
            }
            
            const exportData = await exportFunction.call(this.app.exportManager, 
                chromosome, start, end);
            
            return {
                format: format,
                chromosome: chromosome,
                start: start,
                end: end,
                data: exportData,
                message: `Exported ${format} data for ${chromosome}:${start}-${end}`
            };
        }
        
        throw new Error('Export functionality not available');
    }

    getVisibleTracks() {
        const tracks = [];
        const trackCheckboxes = document.querySelectorAll('#trackCheckboxes input[type="checkbox"]');
        
        trackCheckboxes.forEach(checkbox => {
            if (checkbox.checked) {
                tracks.push(checkbox.value);
            }
        });
        
        return tracks;
    }

    sendToMCP(message) {
        if (this.isConnected && this.mcpSocket) {
            this.mcpSocket.send(JSON.stringify(message));
        } else {
            this.pendingMessages.push(message);
        }
    }

    // Send state updates to MCP server
    sendStateUpdate(partialState) {
        this.sendToMCP({
            type: 'state-update',
            state: partialState
        });
    }

    sendNavigationUpdate(chromosome, position) {
        this.sendToMCP({
            type: 'navigation',
            chromosome: chromosome,
            position: position
        });
    }

    sendSearchResults(results) {
        this.sendToMCP({
            type: 'search-results',
            results: results
        });
    }

    sendFeatureSelection(features) {
        this.sendToMCP({
            type: 'feature-selected',
            features: features
        });
    }

    sendTrackVisibility(tracks) {
        this.sendToMCP({
            type: 'track-visibility',
            tracks: tracks
        });
    }

    // UI Management
    initializeUI() {
        this.createChatInterface();
        this.setupEventListeners();
    }

    createChatInterface() {
        // Create chat panel HTML
        const chatHTML = `
            <div id="llmChatPanel" class="chat-panel">
                <div class="chat-header">
                    <div class="chat-title">
                        <i class="fas fa-robot"></i>
                        <span>AI Assistant</span>
                    </div>
                    <div class="chat-controls">
                        <div class="connection-status" id="connectionStatus">
                            <i class="fas fa-circle"></i>
                            <span>Connecting...</span>
                        </div>
                        <button id="minimizeChatBtn" class="btn btn-sm chat-btn">
                            <i class="fas fa-minus"></i>
                        </button>
                        <button id="closeChatBtn" class="btn btn-sm chat-btn">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <div class="chat-messages" id="chatMessages">
                    <div class="welcome-message">
                        <div class="message assistant-message">
                            <div class="message-content">
                                <i class="fas fa-robot message-icon"></i>
                                <div class="message-text">
                                    <p>Hello! I'm your AI assistant for the Genome Browser. I can help you:</p>
                                    <ul>
                                        <li>Navigate to specific genomic positions</li>
                                        <li>Search for genes and features</li>
                                        <li>Analyze genomic regions</li>
                                        <li>Create custom annotations</li>
                                        <li>Export sequence data</li>
                                        <li>Answer questions about your genome data</li>
                                    </ul>
                                    <p>Try asking me something like "Show me gene ABC123" or "What's the GC content of chr1:1000-2000?"</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="chat-input-container">
                    <div class="chat-input-wrapper">
                        <textarea id="chatInput" 
                                placeholder="Ask me anything about your genome data..." 
                                rows="1"></textarea>
                        <button id="sendChatBtn" class="btn btn-primary">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </div>
                    <div class="chat-actions">
                        <button id="clearChatBtn" class="btn btn-sm btn-secondary">
                            <i class="fas fa-trash"></i>
                            Clear Chat
                        </button>
                        <button id="suggestionsBtn" class="btn btn-sm btn-secondary">
                            <i class="fas fa-lightbulb"></i>
                            Suggestions
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Insert chat panel into the page
        const appDiv = document.getElementById('app');
        appDiv.insertAdjacentHTML('beforeend', chatHTML);

        // Initially minimized
        document.getElementById('llmChatPanel').classList.add('minimized');
    }

    setupEventListeners() {
        // Chat toggle button in toolbar
        this.addChatToggleButton();

        // Chat input handling
        const chatInput = document.getElementById('chatInput');
        const sendBtn = document.getElementById('sendChatBtn');

        if (chatInput && sendBtn) {
            // Auto-resize textarea
            chatInput.addEventListener('input', () => {
                chatInput.style.height = 'auto';
                chatInput.style.height = chatInput.scrollHeight + 'px';
            });

            // Send on Enter (Shift+Enter for new line)
            chatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });

            sendBtn.addEventListener('click', () => this.sendMessage());
        }

        // Chat controls
        document.getElementById('minimizeChatBtn')?.addEventListener('click', () => {
            this.toggleChatMinimize();
        });

        document.getElementById('closeChatBtn')?.addEventListener('click', () => {
            this.toggleChatVisibility();
        });

        document.getElementById('clearChatBtn')?.addEventListener('click', () => {
            this.clearChat();
        });

        document.getElementById('suggestionsBtn')?.addEventListener('click', () => {
            this.showSuggestions();
        });
    }

    addChatToggleButton() {
        const toolbar = document.querySelector('.toolbar');
        if (toolbar) {
            const chatSection = document.createElement('div');
            chatSection.className = 'toolbar-section';
            chatSection.innerHTML = `
                <label>AI Assistant:</label>
                <button id="toggleChatBtn" class="btn btn-sm toggle-btn">
                    <i class="fas fa-robot"></i>
                </button>
            `;
            
            toolbar.appendChild(chatSection);

            document.getElementById('toggleChatBtn').addEventListener('click', () => {
                this.toggleChatVisibility();
            });
        }
    }

    toggleChatVisibility() {
        const chatPanel = document.getElementById('llmChatPanel');
        if (chatPanel) {
            chatPanel.style.display = chatPanel.style.display === 'none' ? 'flex' : 'none';
        }
    }

    toggleChatMinimize() {
        const chatPanel = document.getElementById('llmChatPanel');
        if (chatPanel) {
            chatPanel.classList.toggle('minimized');
        }
    }

    updateConnectionStatus(connected) {
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            const icon = statusElement.querySelector('i');
            const text = statusElement.querySelector('span');
            
            if (connected) {
                icon.className = 'fas fa-circle connected';
                text.textContent = 'Connected';
            } else {
                icon.className = 'fas fa-circle disconnected';
                text.textContent = 'Disconnected';
            }
        }
    }

    async sendMessage() {
        const chatInput = document.getElementById('chatInput');
        const message = chatInput.value.trim();
        
        if (!message) return;

        // Add user message to chat
        this.addMessageToChat(message, 'user');
        chatInput.value = '';
        chatInput.style.height = 'auto';

        // Show typing indicator
        this.showTypingIndicator();

        try {
            // Send to LLM via MCP or direct API
            const response = await this.sendToLLM(message);
            this.removeTypingIndicator();
            this.addMessageToChat(response, 'assistant');
        } catch (error) {
            this.removeTypingIndicator();
            this.addMessageToChat('Sorry, I encountered an error. Please try again.', 'assistant', true);
            console.error('Chat error:', error);
        }
    }

    async sendToLLM(message) {
        // Check if LLM is configured
        if (!this.llmConfigManager.isConfigured()) {
            return "I need to be configured first. Please go to Options → Configure LLMs to set up your preferred AI provider (OpenAI, Anthropic, Google, or Local LLM).";
        }

        try {
            // Get current genome browser context
            const context = this.getCurrentContext();
            
            // Send message to configured LLM
            const response = await this.llmConfigManager.sendMessage(message, context);
            return response;
        } catch (error) {
            console.error('Error communicating with LLM:', error);
            return `Sorry, I encountered an error: ${error.message}. Please check your LLM configuration in Options → Configure LLMs.`;
        }
    }

    getCurrentContext() {
        // Build comprehensive context for the LLM
        const context = {
            genomeBrowser: {
                currentState: this.getCurrentState(),
                availableTools: [
                    'navigate_to_position',
                    'search_features', 
                    'get_current_state',
                    'get_sequence',
                    'toggle_track',
                    'create_annotation',
                    'analyze_region',
                    'export_data'
                ]
            }
        };

        return context;
    }

    addMessageToChat(message, sender, isError = false) {
        const messagesContainer = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message ${isError ? 'error' : ''}`;
        
        const timestamp = new Date().toLocaleTimeString();
        
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-icon">
                    <i class="fas fa-${sender === 'user' ? 'user' : 'robot'}"></i>
                </div>
                <div class="message-text">
                    ${this.formatMessage(message)}
                </div>
                <div class="message-time">${timestamp}</div>
            </div>
        `;
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        this.messageHistory.push({ message, sender, timestamp });
    }

    formatMessage(message) {
        // Convert markdown-like formatting
        return message
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
    }

    showTypingIndicator() {
        const messagesContainer = document.getElementById('chatMessages');
        const typingDiv = document.createElement('div');
        typingDiv.id = 'typingIndicator';
        typingDiv.className = 'message assistant-message typing';
        typingDiv.innerHTML = `
            <div class="message-content">
                <div class="message-icon">
                    <i class="fas fa-robot"></i>
                </div>
                <div class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
        
        messagesContainer.appendChild(typingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    removeTypingIndicator() {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    clearChat() {
        const messagesContainer = document.getElementById('chatMessages');
        const welcomeMessage = messagesContainer.querySelector('.welcome-message');
        messagesContainer.innerHTML = '';
        if (welcomeMessage) {
            messagesContainer.appendChild(welcomeMessage);
        }
        this.messageHistory = [];
    }

    showSuggestions() {
        const suggestions = [
            "Show me gene details for [gene name]",
            "Navigate to position chr1:1000-2000",
            "What's the GC content of this region?",
            "Find genes in the current view",
            "Export sequence data as FASTA",
            "Create a new gene annotation",
            "Show all variants in this region",
            "Toggle the GC content track"
        ];

        const suggestionsHTML = suggestions.map(s => 
            `<button class="suggestion-btn" onclick="document.getElementById('chatInput').value = '${s}'">${s}</button>`
        ).join('');

        this.addMessageToChat(
            `<div class="suggestions-container">
                <p>Here are some things you can try:</p>
                ${suggestionsHTML}
            </div>`,
            'assistant'
        );
    }
} 