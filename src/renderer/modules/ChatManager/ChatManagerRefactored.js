/**
 * ChatManagerRefactored - Main facade class that coordinates all chat functionality
 * 
 * This is a refactored version of the original 21,954-line ChatManager.js God class.
 * It uses a modular architecture with specialized managers for different concerns:
 * 
 * - ChatUIManager: UI creation, event handling, positioning
 * - ChatHistoryManager: Message history, browsing, persistence
 * - ToolExecutionManager: Tool calling, execution, result formatting
 * - MCPManager: MCP server connections and communication
 * - GenomicsToolManager: Genome analysis functions
 * - ProteinStructureManager: PDB/AlphaFold integration
 * - PrimerDesignManager: PCR/qPCR primer design
 * - ExportManager: Data export functionality
 * 
 * The original ChatManager.js is preserved for reference but should be replaced
 * with this refactored version.
 */

class ChatManagerRefactored {
  constructor(app, configManager = null) {
    // Core dependencies
    this.app = app;
    this.configManager = configManager;

    // State
    this.chatHistory = [];
    this.currentMessage = null;
    this.contextModeEnabled = true;
    this.isConnected = false;

    // Conversation state
    this.conversationState = {
      isProcessing: false,
      currentRequestId: null,
      abortController: null,
      startTime: null,
      processSteps: [],
      currentStep: 0,
    };

    // Display settings
    this.showThinkingProcess = true;
    this.showToolCalls = true;
    this.showToolCallSource = true;
    this.showDetailedToolData = true;
    this.autoScrollToBottom = true;

    // Message history browsing
    this.messageHistory = {
      userMessages: [],
      currentIndex: -1,
      originalContent: '',
      isBrowsing: false,
    };

    // Event handlers
    this.eventHandlers = new Map();

    // Initialize subsystems
    this.initializeSubsystems();

    // Set global reference
    window.chatManager = this;
  }

  async initializeSubsystems() {
    // Initialize UI Manager
    this.uiManager = new ChatUIManager(this);
    this.uiManager.initialize();

    // Initialize LLM Config Manager
    this.llmConfigManager = new LLMConfigManager(this.configManager);

    // Initialize MCP Server Manager
    this.mcpServerManager = new MCPServerManager(this.configManager);
    this.setupMCPServerEventHandlers();

    // Initialize other managers (lazy loaded as needed)
    this._historyManager = null;
    this._toolExecutionManager = null;
    this._genomicsManager = null;
    this._proteinManager = null;
    this._primerManager = null;
    this._exportManager = null;

    // Initialize working directory
    this.initializeWorkingDirectory();

    // Load chat history after UI is ready
    setTimeout(() => {
      this.loadChatHistory();
    }, 100);
  }

  // ==================== Lazy-loaded Managers ====================

  get historyManager() {
    if (!this._historyManager) {
      this._historyManager = new ChatHistoryManager(this);
    }
    return this._historyManager;
  }

  get toolExecutionManager() {
    if (!this._toolExecutionManager) {
      this._toolExecutionManager = new ToolExecutionManager(this);
    }
    return this._toolExecutionManager;
  }

  get genomicsManager() {
    if (!this._genomicsManager) {
      this._genomicsManager = new GenomicsToolManager(this);
    }
    return this._genomicsManager;
  }

  get proteinManager() {
    if (!this._proteinManager) {
      this._proteinManager = new ProteinStructureManager(this);
    }
    return this._proteinManager;
  }

  get primerManager() {
    if (!this._primerManager) {
      this._primerManager = new PrimerDesignManager(this);
    }
    return this._primerManager;
  }

  get exportManager() {
    if (!this._exportManager) {
      this._exportManager = new ExportManager(this);
    }
    return this._exportManager;
  }

  // ==================== Event Emitter ====================

  on(eventType, handler) {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType).push(handler);
  }

  off(eventType, handler) {
    if (this.eventHandlers.has(eventType)) {
      const handlers = this.eventHandlers.get(eventType);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  emit(eventType, data) {
    if (this.eventHandlers.has(eventType)) {
      this.eventHandlers.get(eventType).forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${eventType}:`, error);
        }
      });
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(`chatmanager-${eventType}`, { detail: data, bubbles: true })
      );
    }
  }

  // ==================== Core Chat Methods ====================

  async sendMessage() {
    const chatInput = document.getElementById('chatInput');
    if (!chatInput) return;

    const message = chatInput.value.trim();
    if (!message) return;

    if (this.conversationState.isProcessing) {
      this.showNotification('Please wait for the current response to complete', 'warning');
      return;
    }

    // Exit history browsing if active
    if (this.messageHistory.isBrowsing) {
      this.exitHistoryBrowsing();
    }

    // Clear input
    chatInput.value = '';
    chatInput.style.height = 'auto';

    // Store current message
    this.currentMessage = message;

    // Add user message to chat
    this.addMessageToChat(message, 'user');

    // Show typing indicator
    this.showTypingIndicator();

    try {
      // Start conversation processing
      this.startConversation();

      // Send to LLM
      await this.sendToLLM(message);
    } catch (error) {
      console.error('Error sending message:', error);
      this.addMessageToChat(`Error: ${error.message}`, 'assistant', true);
    } finally {
      this.removeTypingIndicator();
      this.endConversation();
    }
  }

  async sendMessageProgrammatically(message) {
    if (this.conversationState.isProcessing) {
      throw new Error('Already processing a message');
    }

    this.currentMessage = message;
    this.addMessageToChat(message, 'user');
    this.showTypingIndicator();

    try {
      this.startConversation();
      await this.sendToLLM(message);
    } catch (error) {
      this.addMessageToChat(`Error: ${error.message}`, 'assistant', true);
      throw error;
    } finally {
      this.removeTypingIndicator();
      this.endConversation();
    }
  }

  async sendToLLM(message, options = {}) {
    // Delegate to tool execution manager
    return this.toolExecutionManager.sendToLLM(message, options);
  }

  // ==================== UI Delegation ====================

  toggleChatVisibility() {
    this.uiManager.toggleChatVisibility();
  }

  toggleChatMinimize() {
    this.uiManager.toggleChatMinimize();
  }

  toggleDockState() {
    this.uiManager.toggleDockState();
  }

  dockChat() {
    this.uiManager.dockChat();
  }

  undockChat() {
    this.uiManager.undockChat();
  }

  resetChatPosition() {
    this.uiManager.resetChatPosition();
  }

  showChatBox() {
    this.uiManager.showChatBox();
  }

  hideChatBox() {
    this.uiManager.hideChatBox();
  }

  updateConnectionStatus(connected) {
    this.uiManager.updateConnectionStatus(connected);
  }

  showNotification(message, type = 'info') {
    const existingNotification = document.querySelector('.chat-notification');
    if (existingNotification) {
      existingNotification.remove();
    }

    const notification = document.createElement('div');
    notification.className = `chat-notification notification-${type}`;
    notification.textContent = message;

    const chatPanel = document.getElementById('chatPanel');
    if (chatPanel) {
      chatPanel.appendChild(notification);
      setTimeout(() => notification.classList.add('show'), 10);
      setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
      }, 3000);
    }
  }

  // ==================== History Delegation ====================

  loadChatHistory() {
    return this.historyManager.loadChatHistory();
  }

  displayChatHistory(history) {
    return this.historyManager.displayChatHistory(history);
  }

  addMessageToChat(message, sender, isError = false) {
    return this.historyManager.addMessageToChat(message, sender, isError);
  }

  clearChat() {
    return this.historyManager.clearChat();
  }

  startNewChat() {
    return this.historyManager.startNewChat();
  }

  exportChatHistory(format = 'json') {
    return this.historyManager.exportChatHistory(format);
  }

  showChatHistoryModal() {
    return this.historyManager.showChatHistoryModal();
  }

  browseHistoryUp() {
    return this.historyManager.browseHistoryUp();
  }

  browseHistoryDown() {
    return this.historyManager.browseHistoryDown();
  }

  cancelHistoryBrowsing() {
    return this.historyManager.cancelHistoryBrowsing();
  }

  exitHistoryBrowsing() {
    return this.historyManager.exitHistoryBrowsing();
  }

  // ==================== Tool Execution Delegation ====================

  async executeToolByName(toolName, parameters) {
    return this.toolExecutionManager.executeToolByName(toolName, parameters);
  }

  async parseToolCall(response) {
    return this.toolExecutionManager.parseToolCall(response);
  }

  async parseMultipleToolCalls(response) {
    return this.toolExecutionManager.parseMultipleToolCalls(response);
  }

  formatToolResult(toolName, parameters, result) {
    return this.toolExecutionManager.formatToolResult(toolName, parameters, result);
  }

  showTypingIndicator() {
    return this.toolExecutionManager.showTypingIndicator();
  }

  removeTypingIndicator() {
    return this.toolExecutionManager.removeTypingIndicator();
  }

  clearThinkingHistory() {
    return this.toolExecutionManager.clearThinkingHistory();
  }

  toggleThinkingHistory() {
    return this.toolExecutionManager.toggleThinkingHistory();
  }

  showSuggestions() {
    return this.toolExecutionManager.showSuggestions();
  }

  // ==================== MCP Methods ====================

  setupMCPServerEventHandlers() {
    if (!this.mcpServerManager) return;

    this.mcpServerManager.on('server-connected', data => {
      this.emit('mcp-server-connected', data);
    });

    this.mcpServerManager.on('server-disconnected', data => {
      this.emit('mcp-server-disconnected', data);
    });

    this.mcpServerManager.on('tools-updated', data => {
      this.emit('mcp-tools-updated', data);
    });
  }

  async toggleMCPConnection() {
    if (!this.mcpServerManager) return;

    const isConnected = this.mcpServerManager.isConnected;
    if (isConnected) {
      await this.mcpServerManager.disconnect();
    } else {
      await this.mcpServerManager.connect();
    }

    this.updateConnectionStatus(this.mcpServerManager.isConnected);
  }

  // ==================== Genomics Delegation ====================

  async navigateToPosition(params) {
    return this.genomicsManager.navigateToPosition(params);
  }

  async searchGeneByName(params) {
    return this.genomicsManager.searchGeneByName(params);
  }

  async getSequence(params) {
    return this.genomicsManager.getSequence(params);
  }

  async analyzeRegion(params) {
    return this.genomicsManager.analyzeRegion(params);
  }

  async calculateGCContent(params) {
    return this.genomicsManager.calculateGCContent(params);
  }

  async findOpenReadingFrames(params) {
    return this.genomicsManager.findOpenReadingFrames(params);
  }

  async searchMotif(params) {
    return this.genomicsManager.searchMotif(params);
  }

  async findRestrictionSites(params) {
    return this.genomicsManager.findRestrictionSites(params);
  }

  async virtualDigest(params) {
    return this.genomicsManager.virtualDigest(params);
  }

  async codonUsageAnalysis(params) {
    return this.genomicsManager.codonUsageAnalysis(params);
  }

  // ==================== Protein Structure Delegation ====================

  async openProteinViewer(params) {
    return this.proteinManager.openProteinViewer(params);
  }

  async fetchProteinStructure(parameters) {
    return this.proteinManager.fetchProteinStructure(parameters);
  }

  async searchPDBStructures(parameters) {
    return this.proteinManager.searchPDBStructures(parameters);
  }

  async searchAlphaFoldByGene(parameters) {
    return this.proteinManager.searchAlphaFoldByGene(parameters);
  }

  async fetchAlphaFoldStructure(parameters) {
    return this.proteinManager.fetchAlphaFoldStructure(parameters);
  }

  // ==================== Primer Design Delegation ====================

  async designPCRPrimers(parameters) {
    return this.primerManager.designPCRPrimers(parameters);
  }

  async designqPCRPrimers(parameters) {
    return this.primerManager.designqPCRPrimers(parameters);
  }

  async designPrimersForGene(parameters) {
    return this.primerManager.designPrimersForGene(parameters);
  }

  async analyzePrimerStructure(parameters) {
    return this.primerManager.analyzePrimerStructure(parameters);
  }

  async calculateTm(parameters) {
    return this.primerManager.calculateTm(parameters);
  }

  // ==================== Export Delegation ====================

  async exportData(params) {
    return this.exportManager.exportData(params);
  }

  async exportFastaSequence(parameters) {
    return this.exportManager.exportFastaSequence(parameters);
  }

  async exportGenBankFormat(parameters) {
    return this.exportManager.exportGenBankFormat(parameters);
  }

  async exportCDSFasta(parameters) {
    return this.exportManager.exportCDSFasta(parameters);
  }

  async exportProteinFasta(parameters) {
    return this.exportManager.exportProteinFasta(parameters);
  }

  async exportGFFAnnotations(parameters) {
    return this.exportManager.exportGFFAnnotations(parameters);
  }

  // ==================== Utility Methods ====================

  loadScript(src) {
    return new Promise((resolve, reject) => {
      const existingScript = document.querySelector(`script[src="${src}"]`);
      if (existingScript) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  getSessionId() {
    if (!this._sessionId) {
      this._sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    return this._sessionId;
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ==================== Working Directory ====================

  initializeWorkingDirectory() {
    if (this.configManager) {
      const savedDir = this.configManager.get('workingDirectory');
      if (savedDir) {
        this.configManager.set('workingDirectory', savedDir);
      }
    }
  }

  getCurrentWorkingDirectory() {
    if (this.configManager) {
      return this.configManager.get('workingDirectory');
    }
    return null;
  }

  // ==================== State Management ====================

  getLastUserQuery() {
    if (this.currentMessage) {
      return this.currentMessage;
    }

    if (this.chatHistory.length === 0) return '';
    const lastMessage = this.chatHistory[this.chatHistory.length - 1];
    return lastMessage.role === 'user' ? lastMessage.content : '';
  }

  getCurrentContext() {
    return {
      currentChromosome: this.app?.currentChromosome || null,
      currentPosition: this.app?.currentPosition || null,
      hasSequence: !!this.app?.currentSequence,
      hasAnnotations: !!this.app?.currentAnnotations,
      loadedFiles: this.getLoadedFilesList(),
      visibleTracks: this.getVisibleTracks(),
    };
  }

  getLoadedFilesList() {
    if (!this.app || !this.app.loadedFiles) {
      return [];
    }

    return this.app.loadedFiles.map(file => ({
      name: file.name,
      type: file.type,
      size: file.size,
      path: file.path,
    }));
  }

  getVisibleTracks() {
    if (!this.app) return [];

    const tracks = [];
    if (this.app.trackVisibility) {
      Object.entries(this.app.trackVisibility).forEach(([name, visible]) => {
        if (visible) {
          tracks.push({ name, type: this.getTrackDescription(name) });
        }
      });
    }
    return tracks;
  }

  getTrackDescription(trackName) {
    const descriptions = {
      genes: 'Gene annotations',
      sequence: 'DNA sequence',
      gc: 'GC content',
      reads: 'Sequencing reads',
      variants: 'Variant calls',
      actions: 'User actions',
      blast: 'BLAST hits',
    };
    return descriptions[trackName] || trackName;
  }

  // ==================== Conversation State ====================

  startConversation() {
    this.conversationState.isProcessing = true;
    this.conversationState.startTime = Date.now();
    this.conversationState.currentRequestId = this.generateId();
    this.conversationState.abortController = new AbortController();
    this.conversationState.processSteps = [];
    this.conversationState.currentStep = 0;

    this.updateUIState();
  }

  endConversation() {
    this.conversationState.isProcessing = false;
    this.conversationState.currentRequestId = null;
    this.conversationState.abortController = null;
    this.conversationState.startTime = null;

    this.updateUIState();
  }

  abortCurrentConversation() {
    if (this.conversationState.isProcessing && this.conversationState.abortController) {
      this.conversationState.abortController.abort();
      this.addMessageToChat('Conversation aborted by user', 'system');
      this.endConversation();
    }
  }

  updateUIState() {
    const sendBtn = document.getElementById('sendChatBtn');
    const abortBtn = document.getElementById('abortChatBtn');
    const chatInput = document.getElementById('chatInput');

    if (this.conversationState.isProcessing) {
      if (sendBtn) sendBtn.style.display = 'none';
      if (abortBtn) abortBtn.style.display = 'flex';
      if (chatInput) chatInput.disabled = true;
    } else {
      if (sendBtn) sendBtn.style.display = 'flex';
      if (abortBtn) abortBtn.style.display = 'none';
      if (chatInput) chatInput.disabled = false;
      if (chatInput) chatInput.focus();
    }
  }

  isBenchmarkMode() {
    const benchmarkInterface = document.getElementById('benchmarkInterface');
    if (benchmarkInterface && benchmarkInterface.style.display !== 'none') {
      return true;
    }

    if (window.benchmarkUI && window.benchmarkUI.isRunning) {
      return true;
    }

    if (this.app?.benchmarkManager?.isRunning) {
      return true;
    }

    return false;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChatManagerRefactored;
}
