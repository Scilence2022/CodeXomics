/**
 * ChatManager - Handles LLM chat interface and MCP communication
 */
class ChatManager {
    constructor(app) {
        this.app = app;
        this.mcpSocket = null;
        this.clientId = null;
        this.isConnected = false;
        this.activeRequests = new Map();
        this.pendingMessages = [];
        
        // Initialize configuration manager
        this.configManager = new ConfigManager();
        
        // Initialize LLM configuration manager with config integration
        this.llmConfigManager = new LLMConfigManager(this.configManager);
        
        // Set global reference for copy button functionality
        window.chatManager = this;
        
        // Load chat history from config
        this.loadChatHistory();
        
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
                    
                case 'get_gene_details':
                    result = await this.getGeneDetails(parameters);
                    break;
                    
                case 'translate_sequence':
                    result = await this.translateSequence(parameters);
                    break;
                    
                case 'calculate_gc_content':
                    result = await this.calculateGCContent(parameters);
                    break;
                    
                case 'find_orfs':
                    result = await this.findOpenReadingFrames(parameters);
                    break;
                    
                case 'get_operons':
                    result = await this.getOperons(parameters);
                    break;
                    
                case 'zoom_to_gene':
                    result = await this.zoomToGene(parameters);
                    break;
                    
                case 'get_chromosome_list':
                    result = this.getChromosomeList();
                    break;
                    
                case 'get_track_status':
                    result = this.getTrackStatus();
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
        
        console.log('navigateToPosition called with params:', params);
        
        // Use existing navigation functionality
        if (this.app && this.app.navigationManager) {
            console.log('Using navigationManager.parseAndGoToPosition');
            
            // Format the position string as expected by parseAndGoToPosition
            const positionString = `${chromosome}:${start}-${end}`;
            console.log('Formatted position string:', positionString);
            
            // Call the parseAndGoToPosition method
            this.app.navigationManager.parseAndGoToPosition(positionString);
            
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
        
        console.log('searchFeatures called with params:', params);
        
        // Use existing search functionality from NavigationManager
        if (this.app && this.app.navigationManager) {
            console.log('Using navigationManager.performSearch');
            
            // Store original settings
            const originalCaseSensitive = document.getElementById('caseSensitive')?.checked;
            
            // Set case sensitivity for this search
            const caseSensitiveCheckbox = document.getElementById('caseSensitive');
            if (caseSensitiveCheckbox) {
                caseSensitiveCheckbox.checked = caseSensitive || false;
            }
            
            // Perform the search
            this.app.navigationManager.performSearch(query);
            
            // Get the results from NavigationManager
            const searchResults = this.app.navigationManager.searchResults || [];
            
            // Restore original setting
            if (caseSensitiveCheckbox && originalCaseSensitive !== undefined) {
                caseSensitiveCheckbox.checked = originalCaseSensitive;
            }
            
            console.log('Search completed, results:', searchResults);
            
            return {
                query: query,
                caseSensitive: caseSensitive || false,
                results: searchResults,
                count: searchResults.length
            };
        }
        
        throw new Error('Navigation manager not available');
    }

    getCurrentState() {
        if (!this.app) {
            throw new Error('Genome browser not initialized');
        }

        // Debug logging to understand the app state
        console.log('ChatManager getCurrentState - this.app:', this.app);
        console.log('ChatManager getCurrentState - this.app.currentChromosome:', this.app.currentChromosome);
        console.log('ChatManager getCurrentState - this.app.currentAnnotations:', this.app.currentAnnotations);
        console.log('ChatManager getCurrentState - this.app.currentPosition:', this.app.currentPosition);

        const state = {
            currentChromosome: this.app.currentChromosome,
            currentPosition: this.app.currentPosition,
            visibleTracks: this.getVisibleTracks(),
            loadedFiles: this.app.loadedFiles || [],
            sequenceLength: this.app.sequenceLength || 0,
            annotationsCount: (this.app.currentAnnotations || []).length,
            userDefinedFeaturesCount: Object.keys(this.app.userDefinedFeatures || {}).length
        };

        console.log('ChatManager getCurrentState - final state:', state);
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
            try {
                let exportResult;
                
                switch (format.toLowerCase()) {
                    case 'fasta':
                        if (chromosome && start && end) {
                            // Export specific region
                            const sequence = await this.app.getSequenceForRegion(chromosome, start, end);
                            const fastaContent = `>${chromosome}:${start}-${end}\n${sequence}`;
                            exportResult = { content: fastaContent, type: 'text' };
                        } else {
                            exportResult = await this.app.exportManager.exportFASTA();
                        }
                        break;
                    case 'genbank':
                    case 'gb':
                        exportResult = await this.app.exportManager.exportGenBank();
                        break;
                    case 'gff':
                    case 'gff3':
                        exportResult = await this.app.exportManager.exportGFF();
                        break;
                    case 'bed':
                        exportResult = await this.app.exportManager.exportBED();
                        break;
                    default:
                        throw new Error(`Unsupported export format: ${format}`);
                }
                
                return {
                    format: format,
                    chromosome: chromosome,
                    start: start,
                    end: end,
                    exported: true,
                    message: `Data exported as ${format.toUpperCase()}`
                };
            } catch (error) {
                throw new Error(`Export failed: ${error.message}`);
            }
        }
        
        throw new Error('Export manager not available');
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
                        <button id="exportChatBtn" class="btn btn-sm btn-secondary">
                            <i class="fas fa-download"></i>
                            Export
                        </button>
                        <button id="configBtn" class="btn btn-sm btn-secondary">
                            <i class="fas fa-cog"></i>
                            Settings
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

        document.getElementById('exportChatBtn')?.addEventListener('click', () => {
            this.exportChatHistory();
        });

        document.getElementById('configBtn')?.addEventListener('click', () => {
            this.showConfigOptions();
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

        console.log('=== ChatManager.sendToLLM DEBUG START ===');
        console.log('User message:', message);

        try {
            // Get current genome browser context
            const context = this.getCurrentContext();
            console.log('Context for LLM:', context);
            
            // Build conversation history including the new message
            const conversationHistory = this.buildConversationHistory(message);
            console.log('Conversation history length:', conversationHistory.length);
            console.log('System message preview:', conversationHistory[0].content.substring(0, 200) + '...');
            
            // Send conversation history to configured LLM
            console.log('Sending to LLM...');
            const response = await this.llmConfigManager.sendMessageWithHistory(conversationHistory, context);
            
            console.log('=== LLM Raw Response ===');
            console.log('Response type:', typeof response);
            console.log('Response length:', response ? response.length : 'null');
            console.log('Full response:', response);
            console.log('========================');
            
            // Check if the response is a tool call (JSON format)
            console.log('Attempting to parse tool call...');
            const toolCall = this.parseToolCall(response);
            console.log('Parsed tool call result:', toolCall);
            
            if (toolCall) {
                console.log('=== TOOL CALL DETECTED ===');
                console.log('Tool name:', toolCall.tool_name);
                console.log('Parameters:', toolCall.parameters);
                console.log('==========================');
                
                try {
                    console.log('Executing tool...');
                    // Execute the tool directly
                    const toolResult = await this.executeToolByName(toolCall.tool_name, toolCall.parameters);
                    console.log('Tool execution completed. Result:', toolResult);
                    
                    // If tool execution was successful, provide a user-friendly summary
                    if (toolResult && !toolResult.error) {
                        const formattedResult = this.formatToolResult(toolCall.tool_name, toolCall.parameters, toolResult);
                        console.log('Formatted result:', formattedResult);
                        console.log('=== ChatManager.sendToLLM DEBUG END (SUCCESS) ===');
                        return formattedResult;
                    } else {
                        const errorMessage = `I tried to execute ${toolCall.tool_name} but encountered an error: ${toolResult.error || 'Unknown error'}`;
                        console.log('Tool execution failed:', errorMessage);
                        console.log('=== ChatManager.sendToLLM DEBUG END (TOOL ERROR) ===');
                        return errorMessage;
                    }
                } catch (error) {
                    console.error('=== TOOL EXECUTION EXCEPTION ===');
                    console.error('Error:', error);
                    console.error('Stack:', error.stack);
                    console.error('================================');
                    const errorMessage = `Sorry, I encountered an error while executing the ${toolCall.tool_name} tool: ${error.message}`;
                    console.log('=== ChatManager.sendToLLM DEBUG END (EXCEPTION) ===');
                    return errorMessage;
                }
            } else {
                console.log('=== NO TOOL CALL DETECTED ===');
                console.log('Returning conversational response');
                console.log('===============================');
            }
            
            // If not a tool call, return the conversational response
            console.log('=== ChatManager.sendToLLM DEBUG END (CONVERSATION) ===');
            return response;
            
        } catch (error) {
            console.error('=== LLM COMMUNICATION ERROR ===');
            console.error('Error:', error);
            console.error('Stack:', error.stack);
            console.error('==============================');
            const errorMessage = `Sorry, I encountered an error: ${error.message}. Please check your LLM configuration in Options → Configure LLMs.`;
            console.log('=== ChatManager.sendToLLM DEBUG END (LLM ERROR) ===');
            return errorMessage;
        }
    }

    formatToolResult(toolName, parameters, result) {
        console.log('formatToolResult called with:', { toolName, parameters, result });
        
        switch (toolName) {
            case 'navigate_to_position':
                return `✅ Navigated to ${result.chromosome}:${result.start}-${result.end}`;
                
            case 'search_features':
                if (result.count > 0) {
                    return `🔍 Found ${result.count} features matching "${result.query}"`;
                } else {
                    return `🔍 No features found matching "${result.query}"`;
                }
                
            case 'get_current_state':
                return `📊 Current state: ${result.currentChromosome || 'No chromosome selected'}, position ${result.currentPosition?.start || 0}-${result.currentPosition?.end || 0}, ${result.annotationsCount || 0} annotations loaded`;
                
            case 'get_sequence':
                return `🧬 Retrieved ${result.length}bp sequence from ${result.chromosome}:${result.start}-${result.end}`;
                
            case 'toggle_track':
                return `👁️ Track "${parameters.trackName}" is now ${result.visible ? 'visible' : 'hidden'}`;
                
            case 'create_annotation':
                return `✨ Created ${result.type} annotation "${result.name}" at ${result.chromosome}:${result.start}-${result.end}`;
                
            case 'analyze_region':
                return `🔬 Analyzed region ${result.chromosome}:${result.start}-${result.end} (${result.length}bp, ${result.gcContent}% GC, ${result.featureCount || 0} features)`;
                
            case 'export_data':
                return `💾 Exported ${result.format.toUpperCase()} data successfully. File has been downloaded.`;
                
            case 'get_gene_details':
                if (result.found) {
                    return `🧬 Found ${result.count} gene(s) matching "${result.geneName}": ${result.genes.map(g => `${g.name} (${g.start}-${g.end}, ${g.product})`).slice(0, 3).join(', ')}${result.count > 3 ? '...' : ''}`;
                } else {
                    return `❌ No genes found matching "${result.geneName}" in ${result.chromosome}`;
                }
                
            case 'translate_sequence':
                return `🔬 Translated ${result.length.dna}bp DNA sequence to ${result.length.protein}aa protein from ${result.chromosome}:${result.start}-${result.end} (${result.strand} strand)`;
                
            case 'calculate_gc_content':
                return `📊 GC content analysis for ${result.chromosome}:${result.region}: Overall ${result.overallGCContent}% GC (${result.length}bp analyzed in ${result.totalWindows} windows)`;
                
            case 'find_orfs':
                return `🔍 Found ${result.orfsFound} ORFs ≥${result.minLength}bp in ${result.chromosome}:${result.region}`;
                
            case 'get_operons':
                return `🧬 Found ${result.operonsFound} operons in ${result.chromosome}: ${result.operons.slice(0, 3).map(op => `${op.name} (${op.geneCount} genes)`).join(', ')}${result.operonsFound > 3 ? '...' : ''}`;
                
            case 'zoom_to_gene':
                return `🔍 Zoomed to gene ${result.gene.name} at ${result.gene.start}-${result.gene.end} with ${result.padding}bp padding`;
                
            case 'get_chromosome_list':
                return `📋 Available chromosomes (${result.count}): ${result.chromosomes.map(chr => `${chr.name} (${(chr.length/1000000).toFixed(1)}Mbp)${chr.isSelected ? ' *' : ''}`).join(', ')}. Current: ${result.currentChromosome}`;
                
            case 'get_track_status':
                const visibleCount = result.visibleTracks.length;
                return `👁️ Track status: ${visibleCount}/${result.totalTracks} visible (${result.visibleTracks.join(', ')})`;
                
            default:
                return `✅ Tool ${toolName} executed successfully`;
        }
    }

    buildConversationHistory(newMessage) {
        const history = [];
        
        // Add system context message
        const systemMessage = this.buildSystemMessage();
        history.push({ role: 'system', content: systemMessage });
        
        // Get conversation memory setting
        const conversationMemory = this.configManager.get('llm.conversationMemory', 10);
        
        // Add previous conversation history from config
        const chatHistory = this.configManager.getChatHistory(conversationMemory * 2); // Get more to account for user+assistant pairs
        
        for (const msg of chatHistory) {
            if (msg.sender === 'user') {
                history.push({ role: 'user', content: msg.message });
            } else if (msg.sender === 'assistant') {
                history.push({ role: 'assistant', content: msg.message });
            }
        }
        
        // Add the new user message
        history.push({ role: 'user', content: newMessage });
        
        return history;
    }

    buildSystemMessage() {
        const context = this.getCurrentContext();
        
        return `You are an AI assistant for a genome browser application. You have access to the following tools and current state:

Current Genome Browser State:
- Current chromosome: ${context.genomeBrowser.currentState.currentChromosome || 'None'}
- Current position: ${JSON.stringify(context.genomeBrowser.currentState.currentPosition) || 'None'}
- Visible tracks: ${context.genomeBrowser.currentState.visibleTracks.join(', ') || 'None'}
- Loaded files: ${context.genomeBrowser.currentState.loadedFiles.length} files
- Sequence length: ${context.genomeBrowser.currentState.sequenceLength}
- Annotations count: ${context.genomeBrowser.currentState.annotationsCount}
- User-defined features: ${context.genomeBrowser.currentState.userDefinedFeaturesCount}

Available Tools:
${context.genomeBrowser.availableTools.map(tool => `- ${tool}`).join('\n')}

IMPORTANT: When a user asks you to perform an action that requires using one of these tools, you MUST respond with ONLY a JSON object in this exact format:

{
  "tool_name": "tool_name_here",
  "parameters": {
    "param1": "value1",
    "param2": "value2"
  }
}

Tool Examples:
- To navigate: {"tool_name": "navigate_to_position", "parameters": {"chromosome": "chr1", "start": 1000, "end": 2000}}
- To search: {"tool_name": "search_features", "parameters": {"query": "recA", "caseSensitive": false}}
- To get current state: {"tool_name": "get_current_state", "parameters": {}}
- To get sequence: {"tool_name": "get_sequence", "parameters": {"chromosome": "chr1", "start": 1000, "end": 1500}}
- To toggle track: {"tool_name": "toggle_track", "parameters": {"trackName": "genes", "visible": true}}
- To create annotation: {"tool_name": "create_annotation", "parameters": {"type": "gene", "name": "test_gene", "chromosome": "chr1", "start": 1000, "end": 2000, "strand": 1, "description": "Test gene"}}
- To analyze region: {"tool_name": "analyze_region", "parameters": {"chromosome": "chr1", "start": 1000, "end": 2000, "includeFeatures": true, "includeGC": true}}
- To export data: {"tool_name": "export_data", "parameters": {"format": "fasta", "chromosome": "chr1", "start": 1000, "end": 2000}}
- To get gene details: {"tool_name": "get_gene_details", "parameters": {"geneName": "bidA", "chromosome": "U00096"}}
- To translate sequence: {"tool_name": "translate_sequence", "parameters": {"chromosome": "U00096", "start": 1000, "end": 1500, "strand": 1}}
- To calculate GC content: {"tool_name": "calculate_gc_content", "parameters": {"chromosome": "U00096", "start": 1000, "end": 2000, "windowSize": 100}}
- To find ORFs: {"tool_name": "find_orfs", "parameters": {"chromosome": "U00096", "start": 1000, "end": 5000, "minLength": 300}}
- To get operons: {"tool_name": "get_operons", "parameters": {"chromosome": "U00096"}}
- To zoom to gene: {"tool_name": "zoom_to_gene", "parameters": {"geneName": "bidA", "padding": 1000}}
- To list chromosomes: {"tool_name": "get_chromosome_list", "parameters": {}}
- To check tracks: {"tool_name": "get_track_status", "parameters": {}}

Do NOT include any explanatory text, markdown formatting, or code blocks around the JSON. Return ONLY the raw JSON object.

If the user is asking a general question or doesn't need a tool, respond normally with conversational text.`;
    }

    parseToolCall(response) {
        console.log('=== parseToolCall DEBUG START ===');
        console.log('Input response:', response);
        console.log('Response type:', typeof response);
        console.log('Response length:', response ? response.length : 'null');
        
        try {
            // Clean the response by removing any leading/trailing whitespace
            let cleanResponse = response.trim();
            console.log('After trim:', cleanResponse);
            
            // If response contains thinking tags, extract content after them
            if (cleanResponse.includes('</think>')) {
                const thinkEndIndex = cleanResponse.lastIndexOf('</think>');
                cleanResponse = cleanResponse.substring(thinkEndIndex + 8).trim();
                console.log('After removing thinking tags:', cleanResponse);
            }
            
            // Remove any potential code block markers
            cleanResponse = cleanResponse.replace(/```json\s*|\s*```/gi, '').trim();
            cleanResponse = cleanResponse.replace(/```\s*|\s*```/g, '').trim();
            console.log('After removing code block markers:', cleanResponse);
            
            // Try to parse the entire response as JSON first (most direct approach)
            console.log('Attempting direct JSON parse...');
            try {
                const parsed = JSON.parse(cleanResponse);
                console.log('Direct parse successful:', parsed);
                if (parsed.tool_name && parsed.parameters !== undefined) {
                    console.log('Valid tool call found via direct parse');
                    console.log('=== parseToolCall DEBUG END (SUCCESS - DIRECT) ===');
                    return parsed;
                }
                console.log('Direct parse result does not have tool_name/parameters');
            } catch (e) {
                console.log('Direct parse failed:', e.message);
                // Continue to other parsing methods if direct parse fails
            }
            
            // Try to extract JSON from potential markdown or mixed content
            console.log('Attempting regex extraction...');
            const jsonMatches = cleanResponse.match(/\{[^{}]*"tool_name"[^{}]*"parameters"[^{}]*\}/);
            console.log('Regex matches:', jsonMatches);
            if (jsonMatches) {
                try {
                    const parsed = JSON.parse(jsonMatches[0]);
                    console.log('Regex parse successful:', parsed);
                    if (parsed.tool_name && parsed.parameters !== undefined) {
                        console.log('Valid tool call found via regex');
                        console.log('=== parseToolCall DEBUG END (SUCCESS - REGEX) ===');
                        return parsed;
                    }
                } catch (e) {
                    console.log('Regex parse failed:', e.message);
                    // Continue to next method
                }
            }
            
            // Try to find any valid JSON object that has tool_name and parameters
            console.log('Attempting to find any JSON with tool_name...');
            const allJsonMatches = cleanResponse.match(/\{[^}]*\}/g);
            console.log('All JSON matches found:', allJsonMatches);
            if (allJsonMatches) {
                for (let i = 0; i < allJsonMatches.length; i++) {
                    const match = allJsonMatches[i];
                    console.log(`Trying to parse match ${i}:`, match);
                    try {
                        const parsed = JSON.parse(match);
                        console.log(`Parse ${i} successful:`, parsed);
                        if (parsed.tool_name && parsed.parameters !== undefined) {
                            console.log(`Valid tool call found in match ${i}`);
                            console.log('=== parseToolCall DEBUG END (SUCCESS - SEARCH) ===');
                            return parsed;
                        }
                        console.log(`Match ${i} does not have tool_name/parameters`);
                    } catch (e) {
                        console.log(`Parse ${i} failed:`, e.message);
                        // Continue to next match
                    }
                }
            }
            
            // If no valid tool call found, return null
            console.log('No valid tool call found in response');
            console.log('=== parseToolCall DEBUG END (NO TOOL CALL) ===');
            return null;
            
        } catch (error) {
            console.error('=== parseToolCall ERROR ===');
            console.error('Error:', error);
            console.error('Stack:', error.stack);
            console.error('=======================');
            console.warn('Error parsing potential tool call:', error);
            return null;
        }
    }

    async executeToolByName(toolName, parameters) {
        console.log(`Executing tool: ${toolName} with parameters:`, parameters);
        
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
                    
                case 'get_gene_details':
                    result = await this.getGeneDetails(parameters);
                    break;
                    
                case 'translate_sequence':
                    result = await this.translateSequence(parameters);
                    break;
                    
                case 'calculate_gc_content':
                    result = await this.calculateGCContent(parameters);
                    break;
                    
                case 'find_orfs':
                    result = await this.findOpenReadingFrames(parameters);
                    break;
                    
                case 'get_operons':
                    result = await this.getOperons(parameters);
                    break;
                    
                case 'zoom_to_gene':
                    result = await this.zoomToGene(parameters);
                    break;
                    
                case 'get_chromosome_list':
                    result = this.getChromosomeList();
                    break;
                    
                case 'get_track_status':
                    result = this.getTrackStatus();
                    break;
                    
                default:
                    throw new Error(`Unknown tool: ${toolName}`);
            }
            
            console.log(`Tool ${toolName} execution result:`, result);
            return result;
            
        } catch (error) {
            console.error(`Error executing tool ${toolName}:`, error);
            return {
                success: false,
                error: error.message,
                tool: toolName,
                parameters: parameters
            };
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
                    'export_data',
                    'get_gene_details',
                    'translate_sequence',
                    'calculate_gc_content',
                    'find_orfs',
                    'get_operons',
                    'zoom_to_gene',
                    'get_chromosome_list',
                    'get_track_status'
                ]
            }
        };

        return context;
    }

    addMessageToChat(message, sender, isError = false) {
        const timestamp = new Date().toISOString();
        
        // Add to configuration manager for persistence
        const messageId = this.configManager.addChatMessage(message, sender, timestamp);
        
        // Display the message in UI
        this.displayChatMessage(message, sender, timestamp, messageId);
    }

    copyMessage(messageId) {
        const messageElement = document.getElementById(messageId);
        if (messageElement) {
            // Get the text content, stripping HTML but preserving line breaks
            let textContent = messageElement.innerText || messageElement.textContent;
            
            // Copy to clipboard
            navigator.clipboard.writeText(textContent).then(() => {
                // Show brief success indication
                const copyBtn = messageElement.parentElement.querySelector('.copy-message-btn');
                const originalHTML = copyBtn.innerHTML;
                copyBtn.innerHTML = '<i class="fas fa-check"></i>';
                copyBtn.style.color = '#10b981';
                
                setTimeout(() => {
                    copyBtn.innerHTML = originalHTML;
                    copyBtn.style.color = '';
                }, 1000);
            }).catch(err => {
                console.error('Failed to copy message: ', err);
                // Fallback: select the text
                const range = document.createRange();
                range.selectNodeContents(messageElement);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
            });
        }
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
        
        // Clear chat history from config
        this.configManager.clearChatHistory();
    }

    /**
     * Export chat history
     */
    async exportChatHistory(format = 'json') {
        try {
            const history = this.configManager.getChatHistory();
            const exportData = {
                exported: new Date().toISOString(),
                messageCount: history.length,
                format: format,
                messages: history
            };

            let content, filename, mimeType;

            switch (format.toLowerCase()) {
                case 'json':
                    content = JSON.stringify(exportData, null, 2);
                    filename = `chat-history-${new Date().toISOString().split('T')[0]}.json`;
                    mimeType = 'application/json';
                    break;
                    
                case 'txt':
                    content = history.map(msg => {
                        const time = new Date(msg.timestamp).toLocaleString();
                        return `[${time}] ${msg.sender.toUpperCase()}: ${msg.message}`;
                    }).join('\n\n');
                    filename = `chat-history-${new Date().toISOString().split('T')[0]}.txt`;
                    mimeType = 'text/plain';
                    break;
                    
                case 'csv':
                    const csvHeader = 'Timestamp,Sender,Message\n';
                    const csvContent = history.map(msg => {
                        const escapedMessage = msg.message.replace(/"/g, '""');
                        return `"${msg.timestamp}","${msg.sender}","${escapedMessage}"`;
                    }).join('\n');
                    content = csvHeader + csvContent;
                    filename = `chat-history-${new Date().toISOString().split('T')[0]}.csv`;
                    mimeType = 'text/csv';
                    break;
                    
                default:
                    throw new Error(`Unsupported export format: ${format}`);
            }

            // Download the file
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            console.log(`Chat history exported as ${format.toUpperCase()}: ${history.length} messages`);
            return true;
        } catch (error) {
            console.error('Error exporting chat history:', error);
            throw error;
        }
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

    /**
     * Load chat history from configuration
     */
    loadChatHistory() {
        try {
            const history = this.configManager.getChatHistory();
            this.displayChatHistory(history);
            console.log(`Loaded ${history.length} chat messages from configuration`);
        } catch (error) {
            console.error('Error loading chat history:', error);
        }
    }

    /**
     * Display chat history in the UI
     */
    displayChatHistory(history) {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) return;

        // Clear existing messages except welcome message
        const welcomeMessage = messagesContainer.querySelector('.welcome-message');
        messagesContainer.innerHTML = '';
        if (welcomeMessage) {
            messagesContainer.appendChild(welcomeMessage);
        }

        // Display historical messages
        history.forEach(msg => {
            this.displayChatMessage(msg.message, msg.sender, msg.timestamp, msg.id);
        });

        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    /**
     * Display a single chat message (used for history and new messages)
     */
    displayChatMessage(message, sender, timestamp, messageId) {
        const messagesContainer = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        
        const displayTime = timestamp ? new Date(timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
        const displayId = messageId || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-icon">
                    <i class="fas fa-${sender === 'user' ? 'user' : 'robot'}"></i>
                </div>
                <div class="message-text" id="${displayId}">
                    ${this.formatMessage(message)}
                </div>
                <div class="message-actions">
                    <button class="copy-message-btn" onclick="chatManager.copyMessage('${displayId}')" title="Copy message">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
            </div>
            <div class="message-time">${displayTime}</div>
        `;
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    showConfigOptions() {
        const options = [
            'Export chat history as JSON',
            'Export chat history as TXT', 
            'Export chat history as CSV',
            'Clear all chat history',
            'Export all configurations',
            'Show config summary',
            'Debug storage info'
        ];

        const optionsHTML = options.map((option, index) => 
            `<button class="suggestion-btn" onclick="chatManager.handleConfigOption(${index})">${option}</button>`
        ).join('');

        this.addMessageToChat(
            `<div class="config-options-container">
                <p><i class="fas fa-cog"></i> Configuration Options:</p>
                ${optionsHTML}
            </div>`,
            'assistant'
        );
    }

    async handleConfigOption(optionIndex) {
        try {
            switch(optionIndex) {
                case 0: // Export JSON
                    await this.exportChatHistory('json');
                    this.addMessageToChat('✅ Chat history exported as JSON', 'assistant');
                    break;
                case 1: // Export TXT
                    await this.exportChatHistory('txt');
                    this.addMessageToChat('✅ Chat history exported as TXT', 'assistant');
                    break;
                case 2: // Export CSV
                    await this.exportChatHistory('csv');
                    this.addMessageToChat('✅ Chat history exported as CSV', 'assistant');
                    break;
                case 3: // Clear history
                    this.clearChat();
                    this.addMessageToChat('🗑️ Chat history cleared', 'assistant');
                    break;
                case 4: // Export all config
                    await this.configManager.exportConfig();
                    this.addMessageToChat('✅ All configurations exported', 'assistant');
                    break;
                case 5: // Show summary
                    const summary = this.configManager.getConfigSummary();
                    this.addMessageToChat(
                        `📊 **Configuration Summary:**\n` +
                        `• Version: ${summary.version}\n` +
                        `• LLM Provider: ${summary.llmProvider || 'None'}\n` +
                        `• Enabled Providers: ${summary.llmProvidersEnabled.join(', ') || 'None'}\n` +
                        `• Theme: ${summary.theme}\n` +
                        `• Chat History: ${summary.chatHistoryLength} messages\n` +
                        `• Recent Files: ${summary.recentFilesCount}\n` +
                        `• Debug Mode: ${summary.debugMode ? 'On' : 'Off'}`,
                        'assistant'
                    );
                    break;
                case 6: // Debug storage info
                    const storageInfo = this.configManager.getStorageInfo();
                    this.addMessageToChat(
                        `🔧 **Storage Debug Info:**\n` +
                        `• Is Electron: ${storageInfo.isElectron}\n` +
                        `• Using Files: ${storageInfo.usingFiles}\n` +
                        `• Using localStorage: ${storageInfo.usingLocalStorage}\n` +
                        `• Is Initialized: ${storageInfo.isInitialized}\n` +
                        `• Config Path: ${storageInfo.configPath ? 'Available' : 'None'}\n` +
                        `• Storage Method: ${storageInfo.usingFiles ? 'File-based' : 'localStorage'}`,
                        'assistant'
                    );
                    break;
            }
        } catch (error) {
            this.addMessageToChat(`❌ Error: ${error.message}`, 'assistant', true);
        }
    }

    // New comprehensive function calls
    async getGeneDetails(params) {
        const { geneName, chromosome } = params;
        
        if (!this.app || !this.app.currentAnnotations) {
            throw new Error('No annotations loaded');
        }
        
        const chr = chromosome || this.app.currentChromosome;
        if (!chr) {
            throw new Error('No chromosome specified and none currently selected');
        }
        
        const annotations = this.app.currentAnnotations[chr] || [];
        const matchingGenes = annotations.filter(gene => {
            const name = gene.qualifiers?.gene || gene.qualifiers?.locus_tag || gene.qualifiers?.product || '';
            return name.toLowerCase().includes(geneName.toLowerCase());
        });
        
        if (matchingGenes.length === 0) {
            return {
                geneName: geneName,
                chromosome: chr,
                found: false,
                message: `No genes found matching "${geneName}" in ${chr}`
            };
        }
        
        const geneDetails = matchingGenes.map(gene => ({
            name: gene.qualifiers?.gene || gene.qualifiers?.locus_tag || 'Unknown',
            type: gene.type,
            start: gene.start,
            end: gene.end,
            strand: gene.strand === -1 ? '-' : '+',
            length: gene.end - gene.start + 1,
            product: gene.qualifiers?.product || 'Unknown function',
            locusTag: gene.qualifiers?.locus_tag || 'N/A',
            note: gene.qualifiers?.note || 'No additional notes'
        }));
        
        return {
            geneName: geneName,
            chromosome: chr,
            found: true,
            count: matchingGenes.length,
            genes: geneDetails
        };
    }

    async translateSequence(params) {
        const { chromosome, start, end, strand = 1, frame = 1 } = params;
        
        const chr = chromosome || this.app.currentChromosome;
        if (!chr) {
            throw new Error('No chromosome specified and none currently selected');
        }
        
        const sequence = await this.app.getSequenceForRegion(chr, start, end);
        const proteinSequence = this.app.translateDNA(sequence, strand);
        
        return {
            chromosome: chr,
            start: start,
            end: end,
            strand: strand === -1 ? '-' : '+',
            frame: frame,
            dnaSequence: sequence.substring(0, 60) + (sequence.length > 60 ? '...' : ''),
            proteinSequence: proteinSequence,
            length: {
                dna: sequence.length,
                protein: proteinSequence.length
            }
        };
    }

    async calculateGCContent(params) {
        const { chromosome, start, end, windowSize = 100 } = params;
        
        const chr = chromosome || this.app.currentChromosome;
        if (!chr) {
            throw new Error('No chromosome specified and none currently selected');
        }
        
        const sequence = await this.app.getSequenceForRegion(chr, start, end);
        
        // Overall GC content
        const gcCount = (sequence.match(/[GC]/gi) || []).length;
        const overallGC = (gcCount / sequence.length * 100).toFixed(2);
        
        // Windowed GC content
        const windows = [];
        for (let i = 0; i < sequence.length - windowSize; i += windowSize) {
            const window = sequence.substring(i, i + windowSize);
            const windowGC = (window.match(/[GC]/gi) || []).length;
            const windowGCPercent = (windowGC / windowSize * 100).toFixed(2);
            windows.push({
                start: start + i,
                end: start + i + windowSize,
                gcContent: parseFloat(windowGCPercent)
            });
        }
        
        return {
            chromosome: chr,
            region: `${start}-${end}`,
            length: sequence.length,
            overallGCContent: parseFloat(overallGC),
            windowSize: windowSize,
            windows: windows.slice(0, 10), // Limit to first 10 windows
            totalWindows: windows.length
        };
    }

    async findOpenReadingFrames(params) {
        const { chromosome, start, end, minLength = 300 } = params;
        
        const chr = chromosome || this.app.currentChromosome;
        if (!chr) {
            throw new Error('No chromosome specified and none currently selected');
        }
        
        const sequence = await this.app.getSequenceForRegion(chr, start, end);
        const orfs = [];
        
        // Find ORFs in all 6 reading frames
        for (let strand = 1; strand >= -1; strand -= 2) {
            const seq = strand === 1 ? sequence : this.reverseComplement(sequence);
            
            for (let frame = 0; frame < 3; frame++) {
                let currentORF = null;
                
                for (let i = frame; i < seq.length - 2; i += 3) {
                    const codon = seq.substring(i, i + 3);
                    
                    if (codon === 'ATG' && !currentORF) {
                        // Start codon
                        currentORF = { start: i, frame: frame + 1, strand: strand };
                    } else if (currentORF && ['TAA', 'TAG', 'TGA'].includes(codon)) {
                        // Stop codon
                        currentORF.end = i + 2;
                        currentORF.length = currentORF.end - currentORF.start + 1;
                        
                        if (currentORF.length >= minLength) {
                            // Convert to original coordinates
                            if (strand === 1) {
                                currentORF.start += start;
                                currentORF.end += start;
                            } else {
                                const temp = sequence.length - currentORF.end - 1 + start;
                                currentORF.end = sequence.length - currentORF.start - 1 + start;
                                currentORF.start = temp;
                            }
                            orfs.push(currentORF);
                        }
                        currentORF = null;
                    }
                }
            }
        }
        
        return {
            chromosome: chr,
            region: `${start}-${end}`,
            minLength: minLength,
            orfsFound: orfs.length,
            orfs: orfs.slice(0, 20) // Limit to first 20 ORFs
        };
    }

    reverseComplement(sequence) {
        const complement = { 'A': 'T', 'T': 'A', 'G': 'C', 'C': 'G' };
        return sequence.split('').reverse().map(base => complement[base] || base).join('');
    }

    async getOperons(params) {
        const { chromosome } = params;
        
        const chr = chromosome || this.app.currentChromosome;
        if (!chr) {
            throw new Error('No chromosome specified and none currently selected');
        }
        
        if (!this.app.currentAnnotations || !this.app.currentAnnotations[chr]) {
            throw new Error('No annotations loaded for chromosome');
        }
        
        const annotations = this.app.currentAnnotations[chr];
        const operons = this.app.detectOperons(annotations);
        
        const operonSummary = operons.map(operon => ({
            name: operon.name,
            start: operon.start,
            end: operon.end,
            strand: operon.strand === -1 ? '-' : '+',
            geneCount: operon.genes.length,
            genes: operon.genes.map(g => g.qualifiers?.gene || g.qualifiers?.locus_tag || 'Unknown').slice(0, 5),
            length: operon.end - operon.start + 1
        }));
        
        return {
            chromosome: chr,
            operonsFound: operons.length,
            operons: operonSummary
        };
    }

    async zoomToGene(params) {
        const { geneName, chromosome, padding = 1000 } = params;
        
        const geneDetails = await this.getGeneDetails({ geneName, chromosome });
        
        if (!geneDetails.found || geneDetails.genes.length === 0) {
            throw new Error(`Gene "${geneName}" not found`);
        }
        
        const gene = geneDetails.genes[0]; // Use first match
        const newStart = Math.max(0, gene.start - padding);
        const newEnd = gene.end + padding;
        
        // Navigate to the gene location
        await this.navigateToPosition({
            chromosome: geneDetails.chromosome,
            start: newStart,
            end: newEnd
        });
        
        return {
            geneName: geneName,
            gene: gene,
            zoomedRegion: `${newStart}-${newEnd}`,
            padding: padding,
            message: `Zoomed to gene ${gene.name} with ${padding}bp padding`
        };
    }

    getChromosomeList() {
        if (!this.app || !this.app.currentSequence) {
            return {
                chromosomes: [],
                count: 0,
                message: 'No genome sequence loaded'
            };
        }
        
        const chromosomes = Object.keys(this.app.currentSequence);
        const chromosomeInfo = chromosomes.map(chr => ({
            name: chr,
            length: this.app.currentSequence[chr].length,
            isSelected: chr === this.app.currentChromosome
        }));
        
        return {
            chromosomes: chromosomeInfo,
            count: chromosomes.length,
            currentChromosome: this.app.currentChromosome || 'None selected'
        };
    }

    getTrackStatus() {
        if (!this.app) {
            throw new Error('Genome browser not initialized');
        }
        
        const visibleTracks = this.getVisibleTracks();
        const allTracks = ['genes', 'sequence', 'gc', 'variants', 'reads', 'proteins'];
        
        const trackStatus = allTracks.map(track => ({
            name: track,
            visible: visibleTracks.includes(track),
            description: this.getTrackDescription(track)
        }));
        
        return {
            visibleTracks: visibleTracks,
            totalTracks: allTracks.length,
            tracks: trackStatus
        };
    }

    getTrackDescription(trackName) {
        const descriptions = {
            genes: 'Gene annotations and features',
            sequence: 'DNA sequence display',
            gc: 'GC content visualization',
            variants: 'VCF variant data',
            reads: 'Aligned sequencing reads',
            proteins: 'Protein coding sequences'
        };
        return descriptions[trackName] || 'Unknown track';
    }
} 