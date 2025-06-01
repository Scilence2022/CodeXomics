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
                    
                case 'search_motif':
                    result = await this.searchMotif(parameters);
                    break;
                    
                case 'search_pattern':
                    result = await this.searchPattern(parameters);
                    break;
                    
                case 'get_nearby_features':
                    result = await this.getNearbyFeatures(parameters);
                    break;
                    
                case 'find_intergenic_regions':
                    result = await this.findIntergenicRegions(parameters);
                    break;
                    
                case 'find_restriction_sites':
                    result = await this.findRestrictionSites(parameters);
                    break;
                    
                case 'virtual_digest':
                    result = await this.virtualDigest(parameters);
                    break;
                    
                case 'sequence_statistics':
                    result = await this.sequenceStatistics(parameters);
                    break;
                    
                case 'codon_usage_analysis':
                    result = await this.codonUsageAnalysis(parameters);
                    break;
                    
                case 'bookmark_position':
                    result = await this.bookmarkPosition(parameters);
                    break;
                    
                case 'get_bookmarks':
                    result = this.getBookmarks(parameters);
                    break;
                    
                case 'save_view_state':
                    result = await this.saveViewState(parameters);
                    break;
                    
                case 'compare_regions':
                    result = await this.compareRegions(parameters);
                    break;
                    
                case 'find_similar_sequences':
                    result = await this.findSimilarSequences(parameters);
                    break;
                    
                case 'edit_annotation':
                    result = await this.editAnnotation(parameters);
                    break;
                    
                case 'delete_annotation':
                    result = await this.deleteAnnotation(parameters);
                    break;
                    
                case 'batch_create_annotations':
                    result = await this.batchCreateAnnotations(parameters);
                    break;
                    
                case 'get_file_info':
                    result = this.getFileInfo(parameters);
                    break;
                    
                case 'export_region_features':
                    result = await this.exportRegionFeatures(parameters);
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
                return `Track Status:\n${Object.entries(result).map(([track, status]) => 
                    `• ${track}: ${status ? 'visible' : 'hidden'}`).join('\n')}`;
                    
            case 'search_motif':
                return `Motif Search Results for "${result.pattern}":\n` +
                    `• Found ${result.matchesFound} matches in ${result.searchRegion}\n` +
                    `• Allowing up to ${result.allowedMismatches} mismatches\n` +
                    (result.matches.length > 0 ? 
                        `• Top matches:\n${result.matches.slice(0, 5).map(m => 
                            `  - Position ${m.position}: ${m.sequence} (${m.strand} strand, ${m.mismatches} mismatches)`
                        ).join('\n')}` : '• No matches found');

            case 'search_pattern':
                return `Pattern Search Results for "${result.regex}":\n` +
                    `• Found ${result.matchesFound} matches in ${result.searchRegion}\n` +
                    (result.matches.length > 0 ? 
                        `• Matches:\n${result.matches.slice(0, 10).map(m => 
                            `  - Position ${m.position}: ${m.sequence} (length: ${m.length})`
                        ).join('\n')}` : '• No matches found');

            case 'get_nearby_features':
                return `Nearby Features (within ${result.searchDistance} bp of position ${result.position}):\n` +
                    `• Found ${result.featuresFound} features\n` +
                    (result.features.length > 0 ? 
                        `• Features:\n${result.features.map(f => 
                            `  - ${f.name} (${f.type}): ${f.start}-${f.end} ${f.strand} strand, ${f.distance} bp ${f.direction}`
                        ).join('\n')}` : '• No features found in range');

            case 'find_intergenic_regions':
                return `Intergenic Regions (min ${result.minLength} bp):\n` +
                    `• Found ${result.regionsFound} regions\n` +
                    `• Total intergenic length: ${result.totalIntergenicLength.toLocaleString()} bp\n` +
                    (result.regions.length > 0 ? 
                        `• Largest regions:\n${result.regions.slice(0, 5).map(r => 
                            `  - ${r.start}-${r.end} (${r.length.toLocaleString()} bp) between ${r.upstreamGene} and ${r.downstreamGene}`
                        ).join('\n')}` : '• No intergenic regions found');

            case 'find_restriction_sites':
                return `Restriction Sites for ${result.enzyme} (${result.recognitionSite}):\n` +
                    `• Found ${result.sitesFound} sites in ${result.searchRegion}\n` +
                    (result.sites.length > 0 ? 
                        `• Sites:\n${result.sites.map(s => 
                            `  - Position ${s.position}: ${s.site} (${s.strand} strand)`
                        ).join('\n')}` : '• No restriction sites found');

            case 'virtual_digest':
                return `Virtual Digest with ${result.enzymes.join(', ')}:\n` +
                    `• Total cut sites: ${result.totalSites}\n` +
                    `• Fragments generated: ${result.fragments}\n` +
                    `• Average fragment size: ${result.averageFragmentSize.toLocaleString()} bp\n` +
                    `• Size range: ${result.smallestFragment.toLocaleString()} - ${result.largestFragment.toLocaleString()} bp\n` +
                    (result.fragmentDetails.length > 0 ? 
                        `• Largest fragments:\n${result.fragmentDetails.slice(0, 5).map(f => 
                            `  - ${f.start}-${f.end} (${f.length.toLocaleString()} bp) cut by ${f.cutBy}`
                        ).join('\n')}` : '');

            case 'sequence_statistics':
                let statsOutput = `Sequence Statistics for ${result.region}:\n`;
                if (result.statistics.composition) {
                    const comp = result.statistics.composition;
                    statsOutput += `• Length: ${comp.length.toLocaleString()} bp\n`;
                    statsOutput += `• Composition: A=${comp.A.percentage}%, T=${comp.T.percentage}%, G=${comp.G.percentage}%, C=${comp.C.percentage}%\n`;
                    statsOutput += `• GC content: ${comp.GC.percentage}%\n`;
                }
                if (result.statistics.complexity) {
                    statsOutput += `• Low complexity regions: ${result.statistics.complexity.lowComplexityRegions}\n`;
                }
                if (result.statistics.skew) {
                    statsOutput += `• AT/GC skew analysis: ${result.statistics.skew.length} data points\n`;
                }
                return statsOutput;

            case 'codon_usage_analysis':
                return `Codon Usage Analysis for ${result.geneName}:\n` +
                    `• Total codons: ${result.totalCodons}\n` +
                    `• Unique codons used: ${result.uniqueCodons}/64\n` +
                    `• Most frequent codons:\n${result.mostFrequentCodons.map(c => 
                        `  - ${c.codon} (${c.aminoAcid}): ${c.count} times (${c.frequency}%)`
                    ).join('\n')}`;

            case 'bookmark_position':
                return `✓ ${result.message}\n` +
                    `• Bookmark ID: ${result.bookmark.id}\n` +
                    `• Created: ${new Date(result.bookmark.created).toLocaleString()}\n` +
                    (result.bookmark.notes ? `• Notes: ${result.bookmark.notes}` : '');

            case 'get_bookmarks':
                return `Bookmarks ${result.chromosome !== 'all' ? `for ${result.chromosome}` : ''}:\n` +
                    `• Total bookmarks: ${result.totalBookmarks}\n` +
                    `• Showing: ${result.filteredBookmarks}\n` +
                    (result.bookmarks.length > 0 ? 
                        `• Bookmarks:\n${result.bookmarks.map(b => 
                            `  - ${b.name}: ${b.chromosome}:${b.start}-${b.end} (${new Date(b.created).toLocaleDateString()})`
                        ).join('\n')}` : '• No bookmarks found');

            case 'save_view_state':
                return `✓ ${result.message}\n` +
                    `• State ID: ${result.viewState.id}\n` +
                    `• Position: ${result.viewState.chromosome}:${result.viewState.position?.start}-${result.viewState.position?.end}\n` +
                    `• Visible tracks: ${result.viewState.visibleTracks?.join(', ') || 'none'}\n` +
                    `• Created: ${new Date(result.viewState.created).toLocaleString()}`;

            case 'compare_regions':
                return `Region Comparison:\n` +
                    `• Region 1: ${result.region1} (${result.length1.toLocaleString()} bp)\n` +
                    `• Region 2: ${result.region2} (${result.length2.toLocaleString()} bp)\n` +
                    `• Similarity: ${result.similarity}%\n` +
                    `• Identity: ${result.identity}%\n` +
                    `• Preview:\n  Region 1: ${result.sequenceData.region1}\n  Region 2: ${result.sequenceData.region2}`;

            case 'find_similar_sequences':
                return `Similar Sequence Search:\n` +
                    `• Query: ${result.querySequence}\n` +
                    `• Found ${result.resultsFound} similar regions (≥${result.minSimilarity} similarity)\n` +
                    (result.results.length > 0 ? 
                        `• Top matches:\n${result.results.slice(0, 5).map(r => 
                            `  - ${r.start}-${r.end}: ${r.similarity} similarity\n    ${r.sequence}`
                        ).join('\n')}` : '• No similar sequences found');

            case 'edit_annotation':
                return `✓ ${result.message}\n` +
                    `• Annotation: ${result.updatedAnnotation.qualifiers?.gene || result.updatedAnnotation.qualifiers?.locus_tag || result.annotationId}\n` +
                    `• Type: ${result.updatedAnnotation.type}\n` +
                    `• Position: ${result.updatedAnnotation.start}-${result.updatedAnnotation.end}`;

            case 'delete_annotation':
                return `✓ ${result.message}\n` +
                    `• Deleted: ${result.deletedAnnotation.qualifiers?.gene || result.deletedAnnotation.qualifiers?.locus_tag || result.annotationId}\n` +
                    `• Type: ${result.deletedAnnotation.type}\n` +
                    `• Position: ${result.deletedAnnotation.start}-${result.deletedAnnotation.end}`;

            case 'batch_create_annotations':
                return `✓ Batch created ${result.annotationsCreated} annotations on ${result.chromosome}\n` +
                    (result.annotations.length > 0 ? 
                        `• Created annotations:\n${result.annotations.map(a => 
                            `  - ${a.type}: ${a.start}-${a.end} (${a.qualifiers?.gene || a.id})`
                        ).join('\n')}` : '');

            case 'get_file_info':
                let fileOutput = `File Information ${result.fileType !== 'all' ? `(${result.fileType})` : ''}:\n`;
                
                if (result.fileInfo.genome) {
                    const genome = result.fileInfo.genome;
                    fileOutput += `• Genome: ${genome.chromosomes} chromosome(s), ${genome.totalLength.toLocaleString()} bp total\n`;
                    fileOutput += `• Current: ${genome.currentChromosome || 'none'}\n`;
                }
                
                if (result.fileInfo.annotations) {
                    const ann = result.fileInfo.annotations;
                    fileOutput += `• Annotations: ${ann.totalFeatures.toLocaleString()} features across ${ann.chromosomes} chromosome(s)\n`;
                    fileOutput += `• Feature types: ${ann.featureTypes.join(', ')}\n`;
                }
                
                if (result.fileInfo.tracks) {
                    const tracks = Object.entries(result.fileInfo.tracks);
                    const visible = tracks.filter(([_, status]) => status).length;
                    fileOutput += `• Tracks: ${visible}/${tracks.length} visible\n`;
                }
                
                return fileOutput;

            case 'export_region_features':
                return `✓ Exported ${result.featuresExported} features from ${result.chromosome}:${result.region}\n` +
                    `• Format: ${result.format}\n` +
                    `• Data ready for download`;

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

Advanced Genomics Tools:
- Search DNA motifs: {"tool_name": "search_motif", "parameters": {"pattern": "GAATTC", "chromosome": "U00096", "allowMismatches": 0}}
- Pattern search: {"tool_name": "search_pattern", "parameters": {"regex": "ATG.{30,100}(TAG|TAA|TGA)", "description": "ORF pattern"}}
- Find nearby features: {"tool_name": "get_nearby_features", "parameters": {"position": 123456, "distance": 5000, "featureTypes": ["gene", "CDS"]}}
- Find intergenic regions: {"tool_name": "find_intergenic_regions", "parameters": {"minLength": 500}}
- Restriction sites: {"tool_name": "find_restriction_sites", "parameters": {"enzyme": "EcoRI"}}
- Virtual digest: {"tool_name": "virtual_digest", "parameters": {"enzymes": ["EcoRI", "BamHI"]}}
- Sequence statistics: {"tool_name": "sequence_statistics", "parameters": {"include": ["composition", "skew", "complexity"]}}
- Codon usage: {"tool_name": "codon_usage_analysis", "parameters": {"geneName": "lacZ"}}
- Bookmark position: {"tool_name": "bookmark_position", "parameters": {"name": "Origin region", "notes": "oriC location"}}
- Get bookmarks: {"tool_name": "get_bookmarks", "parameters": {"chromosome": "U00096"}}
- Save view state: {"tool_name": "save_view_state", "parameters": {"name": "Gene cluster view"}}
- Compare regions: {"tool_name": "compare_regions", "parameters": {"region1": "U00096:1000-2000", "region2": "U00096:5000-6000"}}
- Find similar sequences: {"tool_name": "find_similar_sequences", "parameters": {"querySequence": "ATGCGATCG", "minSimilarity": 0.8}}
- Edit annotation: {"tool_name": "edit_annotation", "parameters": {"annotationId": "lacZ", "updates": {"qualifiers": {"product": "new description"}}}}
- Delete annotation: {"tool_name": "delete_annotation", "parameters": {"annotationId": "b0344"}}
- Batch create annotations: {"tool_name": "batch_create_annotations", "parameters": {"annotations": [{"type": "CDS", "start": 1000, "end": 2000}]}}
- Get file info: {"tool_name": "get_file_info", "parameters": {"fileType": "genome"}}
- Export region features: {"tool_name": "export_region_features", "parameters": {"start": 1000, "end": 5000, "format": "json"}}

Function Call Examples:
- "search for EcoRI sites" → find_restriction_sites
- "find genes near position 123456" → get_nearby_features  
- "what's the GC content of this region" → sequence_statistics
- "bookmark this interesting region" → bookmark_position
- "search for TATAAA motifs allowing 1 mismatch" → search_motif
- "compare these two regions" → compare_regions
- "analyze codon usage in lacZ gene" → codon_usage_analysis
- "virtual digest with multiple enzymes" → virtual_digest

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
                    
                case 'search_motif':
                    result = await this.searchMotif(parameters);
                    break;
                    
                case 'search_pattern':
                    result = await this.searchPattern(parameters);
                    break;
                    
                case 'get_nearby_features':
                    result = await this.getNearbyFeatures(parameters);
                    break;
                    
                case 'find_intergenic_regions':
                    result = await this.findIntergenicRegions(parameters);
                    break;
                    
                case 'find_restriction_sites':
                    result = await this.findRestrictionSites(parameters);
                    break;
                    
                case 'virtual_digest':
                    result = await this.virtualDigest(parameters);
                    break;
                    
                case 'sequence_statistics':
                    result = await this.sequenceStatistics(parameters);
                    break;
                    
                case 'codon_usage_analysis':
                    result = await this.codonUsageAnalysis(parameters);
                    break;
                    
                case 'bookmark_position':
                    result = await this.bookmarkPosition(parameters);
                    break;
                    
                case 'get_bookmarks':
                    result = this.getBookmarks(parameters);
                    break;
                    
                case 'save_view_state':
                    result = await this.saveViewState(parameters);
                    break;
                    
                case 'compare_regions':
                    result = await this.compareRegions(parameters);
                    break;
                    
                case 'find_similar_sequences':
                    result = await this.findSimilarSequences(parameters);
                    break;
                    
                case 'edit_annotation':
                    result = await this.editAnnotation(parameters);
                    break;
                    
                case 'delete_annotation':
                    result = await this.deleteAnnotation(parameters);
                    break;
                    
                case 'batch_create_annotations':
                    result = await this.batchCreateAnnotations(parameters);
                    break;
                    
                case 'get_file_info':
                    result = this.getFileInfo(parameters);
                    break;
                    
                case 'export_region_features':
                    result = await this.exportRegionFeatures(parameters);
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
                    'get_track_status',
                    'search_motif',
                    'search_pattern',
                    'get_nearby_features',
                    'find_intergenic_regions',
                    'find_restriction_sites',
                    'virtual_digest',
                    'sequence_statistics',
                    'codon_usage_analysis',
                    'bookmark_position',
                    'get_bookmarks',
                    'save_view_state',
                    'compare_regions',
                    'find_similar_sequences',
                    'edit_annotation',
                    'delete_annotation',
                    'batch_create_annotations',
                    'get_file_info',
                    'export_region_features'
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

    // ========================================
    // NEW COMPREHENSIVE GENOMICS FUNCTION CALLS
    // ========================================

    // 1. MOTIF AND PATTERN SEARCHING
    async searchMotif(params) {
        const { pattern, chromosome, start, end, allowMismatches = 0 } = params;
        
        const chr = chromosome || this.app.currentChromosome;
        if (!chr) {
            throw new Error('No chromosome specified and none currently selected');
        }
        
        const regionStart = start || this.app.currentPosition?.start || 0;
        const regionEnd = end || this.app.currentPosition?.end || this.app.currentSequence[chr]?.length || 0;
        
        const sequence = await this.app.getSequenceForRegion(chr, regionStart, regionEnd);
        const motifPattern = pattern.toUpperCase();
        const matches = [];
        
        // Search for exact matches and with mismatches
        for (let i = 0; i <= sequence.length - motifPattern.length; i++) {
            const subsequence = sequence.substring(i, i + motifPattern.length);
            const mismatches = this.countMismatches(subsequence, motifPattern);
            
            if (mismatches <= allowMismatches) {
                matches.push({
                    position: regionStart + i,
                    sequence: subsequence,
                    mismatches: mismatches,
                    strand: '+'
                });
            }
        }
        
        // Search reverse complement
        const reverseComplement = this.reverseComplement(motifPattern);
        for (let i = 0; i <= sequence.length - reverseComplement.length; i++) {
            const subsequence = sequence.substring(i, i + reverseComplement.length);
            const mismatches = this.countMismatches(subsequence, reverseComplement);
            
            if (mismatches <= allowMismatches) {
                matches.push({
                    position: regionStart + i,
                    sequence: subsequence,
                    mismatches: mismatches,
                    strand: '-'
                });
            }
        }
        
        return {
            pattern: pattern,
            chromosome: chr,
            searchRegion: `${regionStart}-${regionEnd}`,
            allowedMismatches: allowMismatches,
            matchesFound: matches.length,
            matches: matches.slice(0, 50) // Limit to first 50 matches
        };
    }

    async searchPattern(params) {
        const { regex, chromosome, start, end, description = 'Custom pattern' } = params;
        
        const chr = chromosome || this.app.currentChromosome;
        if (!chr) {
            throw new Error('No chromosome specified and none currently selected');
        }
        
        const regionStart = start || this.app.currentPosition?.start || 0;
        const regionEnd = end || this.app.currentPosition?.end || this.app.currentSequence[chr]?.length || 0;
        
        const sequence = await this.app.getSequenceForRegion(chr, regionStart, regionEnd);
        const pattern = new RegExp(regex, 'gi');
        const matches = [];
        
        let match;
        while ((match = pattern.exec(sequence)) !== null) {
            matches.push({
                position: regionStart + match.index,
                sequence: match[0],
                length: match[0].length
            });
            
            // Prevent infinite loop on zero-length matches
            if (match.index === pattern.lastIndex) {
                pattern.lastIndex++;
            }
        }
        
        return {
            regex: regex,
            description: description,
            chromosome: chr,
            searchRegion: `${regionStart}-${regionEnd}`,
            matchesFound: matches.length,
            matches: matches.slice(0, 50)
        };
    }

    // 2. NEARBY FEATURES AND CONTEXT
    async getNearbyFeatures(params) {
        const { chromosome, position, distance = 5000, featureTypes = [] } = params;
        
        const chr = chromosome || this.app.currentChromosome;
        if (!chr) {
            throw new Error('No chromosome specified and none currently selected');
        }
        
        if (!this.app.currentAnnotations || !this.app.currentAnnotations[chr]) {
            throw new Error('No annotations loaded for chromosome');
        }
        
        const annotations = this.app.currentAnnotations[chr];
        const nearbyFeatures = annotations.filter(feature => {
            if (featureTypes.length > 0 && !featureTypes.includes(feature.type)) {
                return false;
            }
            
            const featureDistance = Math.min(
                Math.abs(feature.start - position),
                Math.abs(feature.end - position)
            );
            
            return featureDistance <= distance;
        });
        
        // Sort by distance
        nearbyFeatures.sort((a, b) => {
            const distA = Math.min(Math.abs(a.start - position), Math.abs(a.end - position));
            const distB = Math.min(Math.abs(b.start - position), Math.abs(b.end - position));
            return distA - distB;
        });
        
        const featureSummary = nearbyFeatures.map(feature => ({
            name: feature.qualifiers?.gene || feature.qualifiers?.locus_tag || 'Unknown',
            type: feature.type,
            start: feature.start,
            end: feature.end,
            strand: feature.strand === -1 ? '-' : '+',
            distance: Math.min(Math.abs(feature.start - position), Math.abs(feature.end - position)),
            direction: feature.start > position ? 'downstream' : feature.end < position ? 'upstream' : 'overlapping'
        }));
        
        return {
            chromosome: chr,
            position: position,
            searchDistance: distance,
            featuresFound: nearbyFeatures.length,
            features: featureSummary.slice(0, 20)
        };
    }

    async findIntergenicRegions(params) {
        const { chromosome, minLength = 100 } = params;
        
        const chr = chromosome || this.app.currentChromosome;
        if (!chr) {
            throw new Error('No chromosome specified and none currently selected');
        }
        
        if (!this.app.currentAnnotations || !this.app.currentAnnotations[chr]) {
            throw new Error('No annotations loaded for chromosome');
        }
        
        const annotations = this.app.currentAnnotations[chr];
        const genes = annotations.filter(f => f.type === 'gene' || f.type === 'CDS').sort((a, b) => a.start - b.start);
        const intergenicRegions = [];
        
        for (let i = 0; i < genes.length - 1; i++) {
            const currentGene = genes[i];
            const nextGene = genes[i + 1];
            const intergenicStart = currentGene.end + 1;
            const intergenicEnd = nextGene.start - 1;
            const length = intergenicEnd - intergenicStart + 1;
            
            if (length >= minLength) {
                intergenicRegions.push({
                    start: intergenicStart,
                    end: intergenicEnd,
                    length: length,
                    upstreamGene: currentGene.qualifiers?.gene || currentGene.qualifiers?.locus_tag || 'Unknown',
                    downstreamGene: nextGene.qualifiers?.gene || nextGene.qualifiers?.locus_tag || 'Unknown'
                });
            }
        }
        
        return {
            chromosome: chr,
            minLength: minLength,
            regionsFound: intergenicRegions.length,
            totalIntergenicLength: intergenicRegions.reduce((sum, region) => sum + region.length, 0),
            regions: intergenicRegions.slice(0, 20)
        };
    }

    // 3. RESTRICTION ENZYME ANALYSIS
    async findRestrictionSites(params) {
        const { enzyme, chromosome, start, end } = params;
        
        const chr = chromosome || this.app.currentChromosome;
        if (!chr) {
            throw new Error('No chromosome specified and none currently selected');
        }
        
        const regionStart = start || this.app.currentPosition?.start || 0;
        const regionEnd = end || this.app.currentPosition?.end || this.app.currentSequence[chr]?.length || 0;
        
        const sequence = await this.app.getSequenceForRegion(chr, regionStart, regionEnd);
        
        // Common restriction enzyme recognition sites
        const restrictionSites = {
            'EcoRI': 'GAATTC',
            'BamHI': 'GGATCC',
            'HindIII': 'AAGCTT',
            'XhoI': 'CTCGAG',
            'SalI': 'GTCGAC',
            'SpeI': 'ACTAGT',
            'NotI': 'GCGGCCGC',
            'KpnI': 'GGTACC',
            'SacI': 'GAGCTC',
            'PstI': 'CTGCAG'
        };
        
        const recognitionSite = restrictionSites[enzyme];
        if (!recognitionSite) {
            throw new Error(`Unknown restriction enzyme: ${enzyme}. Supported: ${Object.keys(restrictionSites).join(', ')}`);
        }
        
        const sites = [];
        const siteLength = recognitionSite.length;
        
        // Search forward strand
        for (let i = 0; i <= sequence.length - siteLength; i++) {
            const subsequence = sequence.substring(i, i + siteLength);
            if (subsequence === recognitionSite) {
                sites.push({
                    position: regionStart + i,
                    site: subsequence,
                    strand: '+'
                });
            }
        }
        
        // Search reverse strand
        const reverseComplement = this.reverseComplement(recognitionSite);
        for (let i = 0; i <= sequence.length - siteLength; i++) {
            const subsequence = sequence.substring(i, i + siteLength);
            if (subsequence === reverseComplement) {
                sites.push({
                    position: regionStart + i,
                    site: subsequence,
                    strand: '-'
                });
            }
        }
        
        return {
            enzyme: enzyme,
            recognitionSite: recognitionSite,
            chromosome: chr,
            searchRegion: `${regionStart}-${regionEnd}`,
            sitesFound: sites.length,
            sites: sites
        };
    }

    async virtualDigest(params) {
        const { enzymes, chromosome } = params;
        
        const chr = chromosome || this.app.currentChromosome;
        if (!chr) {
            throw new Error('No chromosome specified and none currently selected');
        }
        
        const sequenceLength = this.app.currentSequence[chr]?.length || 0;
        const allSites = [];
        
        // Find all restriction sites for all enzymes
        for (const enzyme of enzymes) {
            const result = await this.findRestrictionSites({ enzyme, chromosome: chr, start: 0, end: sequenceLength });
            result.sites.forEach(site => {
                allSites.push({ ...site, enzyme });
            });
        }
        
        // Sort all sites by position
        allSites.sort((a, b) => a.position - b.position);
        
        // Calculate fragment sizes
        const fragments = [];
        let lastPosition = 0;
        
        allSites.forEach(site => {
            const fragmentLength = site.position - lastPosition;
            if (fragmentLength > 0) {
                fragments.push({
                    start: lastPosition,
                    end: site.position,
                    length: fragmentLength,
                    cutBy: site.enzyme
                });
            }
            lastPosition = site.position;
        });
        
        // Add final fragment
        if (lastPosition < sequenceLength) {
            fragments.push({
                start: lastPosition,
                end: sequenceLength,
                length: sequenceLength - lastPosition,
                cutBy: 'terminal'
            });
        }
        
        return {
            enzymes: enzymes,
            chromosome: chr,
            totalSites: allSites.length,
            fragments: fragments.length,
            averageFragmentSize: Math.round(fragments.reduce((sum, f) => sum + f.length, 0) / fragments.length),
            largestFragment: Math.max(...fragments.map(f => f.length)),
            smallestFragment: Math.min(...fragments.map(f => f.length)),
            fragmentDetails: fragments.slice(0, 20) // Show first 20 fragments
        };
    }

    // 4. ENHANCED SEQUENCE STATISTICS
    async sequenceStatistics(params) {
        const { chromosome, start, end, include = ['basic', 'composition', 'complexity'] } = params;
        
        const chr = chromosome || this.app.currentChromosome;
        if (!chr) {
            throw new Error('No chromosome specified and none currently selected');
        }
        
        const regionStart = start || this.app.currentPosition?.start || 0;
        const regionEnd = end || this.app.currentPosition?.end || this.app.currentSequence[chr]?.length || 0;
        
        const sequence = await this.app.getSequenceForRegion(chr, regionStart, regionEnd);
        const stats = {};
        
        // Basic composition
        if (include.includes('basic') || include.includes('composition')) {
            const counts = { A: 0, T: 0, G: 0, C: 0, N: 0 };
            for (const base of sequence) {
                counts[base] = (counts[base] || 0) + 1;
            }
            
            const length = sequence.length;
            stats.composition = {
                length: length,
                A: { count: counts.A, percentage: (counts.A / length * 100).toFixed(2) },
                T: { count: counts.T, percentage: (counts.T / length * 100).toFixed(2) },
                G: { count: counts.G, percentage: (counts.G / length * 100).toFixed(2) },
                C: { count: counts.C, percentage: (counts.C / length * 100).toFixed(2) },
                GC: { percentage: ((counts.G + counts.C) / length * 100).toFixed(2) },
                AT: { percentage: ((counts.A + counts.T) / length * 100).toFixed(2) }
            };
        }
        
        // AT/GC skew
        if (include.includes('skew') || include.includes('at_skew') || include.includes('gc_skew')) {
            const windowSize = Math.max(100, Math.floor(sequence.length / 50));
            const skewData = [];
            
            for (let i = 0; i < sequence.length - windowSize; i += windowSize) {
                const window = sequence.substring(i, i + windowSize);
                const A = (window.match(/A/g) || []).length;
                const T = (window.match(/T/g) || []).length;
                const G = (window.match(/G/g) || []).length;
                const C = (window.match(/C/g) || []).length;
                
                const atSkew = (A - T) / (A + T) || 0;
                const gcSkew = (G - C) / (G + C) || 0;
                
                skewData.push({
                    position: regionStart + i + windowSize / 2,
                    atSkew: parseFloat(atSkew.toFixed(3)),
                    gcSkew: parseFloat(gcSkew.toFixed(3))
                });
            }
            
            stats.skew = skewData.slice(0, 20); // Limit data points
        }
        
        // Complexity (low complexity regions)
        if (include.includes('complexity')) {
            const windowSize = 50;
            const lowComplexityRegions = [];
            
            for (let i = 0; i < sequence.length - windowSize; i += windowSize) {
                const window = sequence.substring(i, i + windowSize);
                const uniqueBases = new Set(window).size;
                const complexity = uniqueBases / 4; // Normalized to 0-1
                
                if (complexity < 0.6) { // Low complexity threshold
                    lowComplexityRegions.push({
                        start: regionStart + i,
                        end: regionStart + i + windowSize,
                        complexity: parseFloat(complexity.toFixed(3))
                    });
                }
            }
            
            stats.complexity = {
                lowComplexityRegions: lowComplexityRegions.length,
                regions: lowComplexityRegions.slice(0, 10)
            };
        }
        
        return {
            chromosome: chr,
            region: `${regionStart}-${regionEnd}`,
            analysisTypes: include,
            statistics: stats
        };
    }

    async codonUsageAnalysis(params) {
        const { geneName, chromosome } = params;
        
        const geneDetails = await this.getGeneDetails({ geneName, chromosome });
        if (!geneDetails.found || geneDetails.genes.length === 0) {
            throw new Error(`Gene "${geneName}" not found`);
        }
        
        const gene = geneDetails.genes.find(g => g.type === 'CDS') || geneDetails.genes[0];
        const chr = geneDetails.chromosome;
        
        const sequence = await this.app.getSequenceForRegion(chr, gene.start, gene.end);
        const codonCounts = {};
        const aminoAcidCounts = {};
        
        // Genetic code
        const geneticCode = {
            'TTT': 'F', 'TTC': 'F', 'TTA': 'L', 'TTG': 'L',
            'TCT': 'S', 'TCC': 'S', 'TCA': 'S', 'TCG': 'S',
            'TAT': 'Y', 'TAC': 'Y', 'TAA': '*', 'TAG': '*',
            'TGT': 'C', 'TGC': 'C', 'TGA': '*', 'TGG': 'W',
            'CTT': 'L', 'CTC': 'L', 'CTA': 'L', 'CTG': 'L',
            'CCT': 'P', 'CCC': 'P', 'CCA': 'P', 'CCG': 'P',
            'CAT': 'H', 'CAC': 'H', 'CAA': 'Q', 'CAG': 'Q',
            'CGT': 'R', 'CGC': 'R', 'CGA': 'R', 'CGG': 'R',
            'ATT': 'I', 'ATC': 'I', 'ATA': 'I', 'ATG': 'M',
            'ACT': 'T', 'ACC': 'T', 'ACA': 'T', 'ACG': 'T',
            'AAT': 'N', 'AAC': 'N', 'AAA': 'K', 'AAG': 'K',
            'AGT': 'S', 'AGC': 'S', 'AGA': 'R', 'AGG': 'R',
            'GTT': 'V', 'GTC': 'V', 'GTA': 'V', 'GTG': 'V',
            'GCT': 'A', 'GCC': 'A', 'GCA': 'A', 'GCG': 'A',
            'GAT': 'D', 'GAC': 'D', 'GAA': 'E', 'GAG': 'E',
            'GGT': 'G', 'GGC': 'G', 'GGA': 'G', 'GGG': 'G'
        };
        
        // Count codons
        for (let i = 0; i < sequence.length - 2; i += 3) {
            const codon = sequence.substring(i, i + 3);
            const aminoAcid = geneticCode[codon];
            
            if (aminoAcid) {
                codonCounts[codon] = (codonCounts[codon] || 0) + 1;
                aminoAcidCounts[aminoAcid] = (aminoAcidCounts[aminoAcid] || 0) + 1;
            }
        }
        
        const totalCodons = Object.values(codonCounts).reduce((sum, count) => sum + count, 0);
        
        // Calculate relative usage
        const codonUsage = Object.entries(codonCounts).map(([codon, count]) => ({
            codon: codon,
            aminoAcid: geneticCode[codon],
            count: count,
            frequency: parseFloat((count / totalCodons * 100).toFixed(2))
        })).sort((a, b) => b.frequency - a.frequency);
        
        return {
            geneName: geneName,
            gene: gene,
            totalCodons: totalCodons,
            uniqueCodons: Object.keys(codonCounts).length,
            codonUsage: codonUsage,
            aminoAcidComposition: aminoAcidCounts,
            mostFrequentCodons: codonUsage.slice(0, 10)
        };
    }

    // 5. BOOKMARK AND SESSION MANAGEMENT
    async bookmarkPosition(params) {
        const { name, chromosome, start, end, notes = '' } = params;
        
        const chr = chromosome || this.app.currentChromosome;
        const bookmarkStart = start || this.app.currentPosition?.start;
        const bookmarkEnd = end || this.app.currentPosition?.end;
        
        if (!chr || bookmarkStart === undefined || bookmarkEnd === undefined) {
            throw new Error('Invalid bookmark parameters');
        }
        
        const bookmark = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            name: name,
            chromosome: chr,
            start: bookmarkStart,
            end: bookmarkEnd,
            notes: notes,
            created: new Date().toISOString()
        };
        
        // Store in configuration
        let bookmarks = this.configManager.get('bookmarks', []);
        bookmarks.push(bookmark);
        this.configManager.set('bookmarks', bookmarks);
        await this.configManager.save();
        
        return {
            success: true,
            bookmark: bookmark,
            message: `Bookmarked "${name}" at ${chr}:${bookmarkStart}-${bookmarkEnd}`
        };
    }

    getBookmarks(params) {
        const { chromosome } = params;
        const bookmarks = this.configManager.get('bookmarks', []);
        
        let filteredBookmarks = bookmarks;
        if (chromosome) {
            filteredBookmarks = bookmarks.filter(b => b.chromosome === chromosome);
        }
        
        return {
            totalBookmarks: bookmarks.length,
            filteredBookmarks: filteredBookmarks.length,
            chromosome: chromosome || 'all',
            bookmarks: filteredBookmarks
        };
    }

    async saveViewState(params) {
        const { name, description = '' } = params;
        
        const viewState = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            name: name,
            description: description,
            chromosome: this.app.currentChromosome,
            position: this.app.currentPosition,
            visibleTracks: this.getVisibleTracks(),
            created: new Date().toISOString()
        };
        
        let savedStates = this.configManager.get('viewStates', []);
        savedStates.push(viewState);
        this.configManager.set('viewStates', savedStates);
        await this.configManager.save();
        
        return {
            success: true,
            viewState: viewState,
            message: `Saved view state "${name}"`
        };
    }

    // Helper methods
    countMismatches(seq1, seq2) {
        if (seq1.length !== seq2.length) return Infinity;
        let mismatches = 0;
        for (let i = 0; i < seq1.length; i++) {
            if (seq1[i] !== seq2[i]) mismatches++;
        }
        return mismatches;
    }

    // 6. SEQUENCE COMPARISON AND ANALYSIS
    async compareRegions(params) {
        const { region1, region2, alignmentType = 'simple' } = params;
        
        // Parse regions (format: "chr:start-end")
        const parseRegion = (regionStr) => {
            const parts = regionStr.split(':');
            const chromosome = parts[0];
            const [start, end] = parts[1].split('-').map(Number);
            return { chromosome, start, end };
        };
        
        const reg1 = parseRegion(region1);
        const reg2 = parseRegion(region2);
        
        const seq1 = await this.app.getSequenceForRegion(reg1.chromosome, reg1.start, reg1.end);
        const seq2 = await this.app.getSequenceForRegion(reg2.chromosome, reg2.start, reg2.end);
        
        // Simple comparison metrics
        const similarity = this.calculateSimilarity(seq1, seq2);
        const identity = this.calculateIdentity(seq1, seq2);
        
        return {
            region1: region1,
            region2: region2,
            length1: seq1.length,
            length2: seq2.length,
            similarity: parseFloat(similarity.toFixed(2)),
            identity: parseFloat(identity.toFixed(2)),
            sequenceData: {
                region1: seq1.substring(0, 100) + (seq1.length > 100 ? '...' : ''),
                region2: seq2.substring(0, 100) + (seq2.length > 100 ? '...' : '')
            }
        };
    }

    async findSimilarSequences(params) {
        const { querySequence, chromosome, minSimilarity = 0.8, maxResults = 20 } = params;
        
        const chr = chromosome || this.app.currentChromosome;
        if (!chr) {
            throw new Error('No chromosome specified and none currently selected');
        }
        
        const chromosomeSequence = this.app.currentSequence[chr];
        if (!chromosomeSequence) {
            throw new Error('No sequence loaded for chromosome');
        }
        
        const queryLength = querySequence.length;
        const similarRegions = [];
        
        // Sliding window search
        for (let i = 0; i <= chromosomeSequence.length - queryLength; i += 100) { // Step by 100 for efficiency
            const subsequence = chromosomeSequence.substring(i, i + queryLength);
            const similarity = this.calculateSimilarity(querySequence, subsequence);
            
            if (similarity >= minSimilarity) {
                similarRegions.push({
                    start: i,
                    end: i + queryLength,
                    similarity: parseFloat(similarity.toFixed(3)),
                    sequence: subsequence.substring(0, 50) + (subsequence.length > 50 ? '...' : '')
                });
            }
        }
        
        // Sort by similarity
        similarRegions.sort((a, b) => b.similarity - a.similarity);
        
        return {
            querySequence: querySequence.substring(0, 50) + (querySequence.length > 50 ? '...' : ''),
            chromosome: chr,
            minSimilarity: minSimilarity,
            resultsFound: similarRegions.length,
            results: similarRegions.slice(0, maxResults)
        };
    }

    // 7. ANNOTATION MANAGEMENT (CRUD)
    async editAnnotation(params) {
        const { annotationId, updates } = params;
        
        if (!this.app.currentAnnotations) {
            throw new Error('No annotations loaded');
        }
        
        let annotationFound = false;
        let updatedAnnotation = null;
        
        // Find and update annotation across all chromosomes
        Object.keys(this.app.currentAnnotations).forEach(chr => {
            const annotations = this.app.currentAnnotations[chr];
            const annotationIndex = annotations.findIndex(a => 
                a.id === annotationId || 
                a.qualifiers?.locus_tag === annotationId ||
                a.qualifiers?.gene === annotationId
            );
            
            if (annotationIndex !== -1) {
                annotationFound = true;
                const annotation = annotations[annotationIndex];
                
                // Apply updates
                Object.keys(updates).forEach(key => {
                    if (key === 'qualifiers') {
                        annotation.qualifiers = { ...annotation.qualifiers, ...updates.qualifiers };
                    } else {
                        annotation[key] = updates[key];
                    }
                });
                
                updatedAnnotation = annotation;
                annotations[annotationIndex] = annotation;
            }
        });
        
        if (!annotationFound) {
            throw new Error(`Annotation "${annotationId}" not found`);
        }
        
        return {
            success: true,
            annotationId: annotationId,
            updatedAnnotation: updatedAnnotation,
            message: `Updated annotation "${annotationId}"`
        };
    }

    async deleteAnnotation(params) {
        const { annotationId } = params;
        
        if (!this.app.currentAnnotations) {
            throw new Error('No annotations loaded');
        }
        
        let annotationFound = false;
        let deletedAnnotation = null;
        
        // Find and delete annotation across all chromosomes
        Object.keys(this.app.currentAnnotations).forEach(chr => {
            const annotations = this.app.currentAnnotations[chr];
            const annotationIndex = annotations.findIndex(a => 
                a.id === annotationId || 
                a.qualifiers?.locus_tag === annotationId ||
                a.qualifiers?.gene === annotationId
            );
            
            if (annotationIndex !== -1) {
                annotationFound = true;
                deletedAnnotation = annotations[annotationIndex];
                annotations.splice(annotationIndex, 1);
            }
        });
        
        if (!annotationFound) {
            throw new Error(`Annotation "${annotationId}" not found`);
        }
        
        return {
            success: true,
            annotationId: annotationId,
            deletedAnnotation: deletedAnnotation,
            message: `Deleted annotation "${annotationId}"`
        };
    }

    async batchCreateAnnotations(params) {
        const { annotations, chromosome } = params;
        
        const chr = chromosome || this.app.currentChromosome;
        if (!chr) {
            throw new Error('No chromosome specified');
        }
        
        if (!this.app.currentAnnotations) {
            this.app.currentAnnotations = {};
        }
        
        if (!this.app.currentAnnotations[chr]) {
            this.app.currentAnnotations[chr] = [];
        }
        
        const createdAnnotations = [];
        
        annotations.forEach(annotationData => {
            const annotation = {
                id: Date.now() + Math.random().toString(36).substr(2, 9),
                type: annotationData.type || 'feature',
                start: annotationData.start,
                end: annotationData.end,
                strand: annotationData.strand || 1,
                qualifiers: annotationData.qualifiers || {},
                created: new Date().toISOString()
            };
            
            this.app.currentAnnotations[chr].push(annotation);
            createdAnnotations.push(annotation);
        });
        
        return {
            success: true,
            chromosome: chr,
            annotationsCreated: createdAnnotations.length,
            annotations: createdAnnotations
        };
    }

    // 8. FILE AND DATA MANAGEMENT
    getFileInfo(params) {
        const { fileType } = params;
        
        const fileInfo = {
            genome: null,
            annotations: null,
            tracks: null
        };
        
        // Get genome file info
        if (this.app.currentSequence && Object.keys(this.app.currentSequence).length > 0) {
            const chromosomes = Object.keys(this.app.currentSequence);
            const totalLength = chromosomes.reduce((sum, chr) => 
                sum + (this.app.currentSequence[chr]?.length || 0), 0);
            
            fileInfo.genome = {
                chromosomes: chromosomes.length,
                chromosomeList: chromosomes,
                totalLength: totalLength,
                currentChromosome: this.app.currentChromosome
            };
        }
        
        // Get annotation file info
        if (this.app.currentAnnotations) {
            const chromosomes = Object.keys(this.app.currentAnnotations);
            const totalFeatures = chromosomes.reduce((sum, chr) => 
                sum + (this.app.currentAnnotations[chr]?.length || 0), 0);
            
            const featureTypes = new Set();
            chromosomes.forEach(chr => {
                this.app.currentAnnotations[chr]?.forEach(feature => {
                    featureTypes.add(feature.type);
                });
            });
            
            fileInfo.annotations = {
                chromosomes: chromosomes.length,
                totalFeatures: totalFeatures,
                featureTypes: Array.from(featureTypes),
                chromosomeList: chromosomes
            };
        }
        
        // Get track info
        fileInfo.tracks = this.getTrackStatus();
        
        if (fileType && fileInfo[fileType]) {
            return { fileType, info: fileInfo[fileType] };
        }
        
        return {
            fileType: fileType || 'all',
            fileInfo: fileInfo
        };
    }

    async exportRegionFeatures(params) {
        const { chromosome, start, end, featureTypes = [], format = 'json' } = params;
        
        const chr = chromosome || this.app.currentChromosome;
        if (!chr) {
            throw new Error('No chromosome specified');
        }
        
        if (!this.app.currentAnnotations || !this.app.currentAnnotations[chr]) {
            throw new Error('No annotations loaded for chromosome');
        }
        
        const regionStart = start || this.app.currentPosition?.start || 0;
        const regionEnd = end || this.app.currentPosition?.end || this.app.currentSequence[chr]?.length || 0;
        
        const annotations = this.app.currentAnnotations[chr];
        const regionFeatures = annotations.filter(feature => {
            // Filter by position overlap
            const overlaps = feature.start <= regionEnd && feature.end >= regionStart;
            
            // Filter by feature type if specified
            const typeMatch = featureTypes.length === 0 || featureTypes.includes(feature.type);
            
            return overlaps && typeMatch;
        });
        
        const exportData = {
            region: `${chr}:${regionStart}-${regionEnd}`,
            featureCount: regionFeatures.length,
            exportDate: new Date().toISOString(),
            features: regionFeatures
        };
        
        return {
            chromosome: chr,
            region: `${regionStart}-${regionEnd}`,
            featuresExported: regionFeatures.length,
            format: format,
            data: exportData
        };
    }

    // Helper methods for similarity calculations
    calculateSimilarity(seq1, seq2) {
        const maxLength = Math.max(seq1.length, seq2.length);
        if (maxLength === 0) return 1;
        
        const minLength = Math.min(seq1.length, seq2.length);
        let matches = 0;
        
        for (let i = 0; i < minLength; i++) {
            if (seq1[i] === seq2[i]) matches++;
        }
        
        return matches / maxLength;
    }

    calculateIdentity(seq1, seq2) {
        const minLength = Math.min(seq1.length, seq2.length);
        if (minLength === 0) return 0;
        
        let matches = 0;
        for (let i = 0; i < minLength; i++) {
            if (seq1[i] === seq2[i]) matches++;
        }
        
        return matches / minLength;
    }

    getVisibleTracks() {
        // Return list of currently visible tracks
        const visibleTracks = [];
        
        if (this.app.trackManager && this.app.trackManager.tracks) {
            Object.entries(this.app.trackManager.tracks).forEach(([trackName, track]) => {
                if (track.visible !== false) {
                    visibleTracks.push(trackName);
                }
            });
        }
        
        return visibleTracks;
    }
} 