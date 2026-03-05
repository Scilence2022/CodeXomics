/**
 * ChatUIManager - Handles all UI-related functionality for the chat interface
 * Extracted from ChatManager.js to separate UI concerns
 */

class ChatUIManager {
  constructor(chatManager) {
    this.chatManager = chatManager;
    this.configManager = chatManager.configManager;
    this.isDocked = false;
  }

  initialize() {
    this.createChatInterface();
    this.setupEventListeners();
  }

  createChatInterface() {
    const defaultSize = { width: 400, height: 600 };
    const defaultPosition = this.getDefaultChatPosition();

    const savedPosition = this.configManager.get('chat.position', defaultPosition);
    const savedSize = this.configManager.get('chat.size', defaultSize);

    const chatHTML = this.generateChatHTML(savedPosition, savedSize);

    const appDiv = document.getElementById('app');
    appDiv.insertAdjacentHTML('beforeend', chatHTML);

    const chatPanel = document.getElementById('llmChatPanel');
    if (chatPanel) {
      const savedVisibility = this.configManager.get('chat.visible', true);
      chatPanel.style.display = savedVisibility ? 'flex' : 'none';
    }

    this.setupChatDragging();
    this.setupChatResizing();
    this.setupWindowResizeHandler();

    setTimeout(() => {
      this.restoreChatPosition();
    }, 50);
  }

  generateChatHTML(position, size) {
    return `
      <div id="llmChatPanel" class="chat-panel resizable-movable" 
           style="left: ${position.x}px; top: ${position.y}px; width: ${size.width}px; height: ${size.height}px;">
        <div class="chat-header" id="chatHeader">
          <div class="chat-title">
            <i class="fas fa-robot"></i>
            <button id="multiAgentToggleBtn" class="btn btn-sm chat-btn multi-agent-toggle" title="Enable Multi-Agent System" data-enabled="false">
              <i class="fas fa-users-cog"></i>
              <span class="toggle-text">OFF</span>
            </button>
            <div class="connection-status" id="connectionStatus">
              <i class="fas fa-circle"></i>
              <span>Connecting...</span>
            </div>
          </div>
          <div class="chat-controls">
            <button id="dockChatBtn" class="btn btn-sm chat-btn" title="Dock to right side">
              <i class="fas fa-columns"></i>
            </button>
            <button id="chatBoxSettingsBtn" class="btn btn-sm chat-btn" title="ChatBox Settings">
              <i class="fas fa-cog"></i>
            </button>
            <button id="resetChatPositionBtn" class="btn btn-sm chat-btn" title="Reset position and size">
              <i class="fas fa-home"></i>
            </button>
            <button id="minimizeChatBtn" class="btn btn-sm chat-btn">
              <i class="fas fa-minus"></i>
            </button>
            <button id="closeChatBtn" class="btn btn-sm chat-btn">
              <i class="fas fa-eye-slash"></i>
            </button>
          </div>
        </div>
        <div class="chat-messages" id="chatMessages">
          ${this.generateWelcomeMessage()}
        </div>
        <div class="chat-input-container">
          <div class="chat-input-options">
            <div class="context-mode-toggle">
              <label class="toggle-label">
                <input type="checkbox" id="contextModeToggle" checked />
                <span class="toggle-slider"></span>
                <span class="toggle-text">Current message only</span>
              </label>
            </div>
          </div>
          <div class="chat-input-wrapper">
            <textarea id="chatInput" placeholder="Ask me anything about your genome data..." rows="1"></textarea>
            <div class="chat-send-controls">
              <button id="sendChatBtn" class="btn btn-primary">
                <i class="fas fa-paper-plane"></i>
              </button>
              <button id="abortChatBtn" class="btn btn-secondary chat-abort-btn" style="display: none;">
                <i class="fas fa-stop"></i>
              </button>
            </div>
          </div>
          <div class="chat-actions">
            <button id="newChatBtn" class="btn btn-sm btn-primary">
              <i class="fas fa-plus"></i> New Chat
            </button>
            <button id="mcpToggleBtn" class="btn btn-sm btn-secondary mcp-tools-btn" title="Toggle MCP Tools" data-connected="false">
              <i class="fas fa-microchip"></i> MCP Tools
            </button>
          </div>
          <div class="chat-actions secondary-actions">
            <button id="chatHistoryBtn" class="btn btn-sm btn-secondary">
              <i class="fas fa-history"></i> History
            </button>
            <button id="clearThinkingBtn" class="btn btn-sm btn-secondary">
              <i class="fas fa-brain"></i> Clear Thinking
            </button>
            <button id="exportChatBtn" class="btn btn-sm btn-secondary">
              <i class="fas fa-download"></i> Export
            </button>
            <button id="suggestionsBtn" class="btn btn-sm btn-secondary">
              <i class="fas fa-lightbulb"></i> Examples
            </button>
          </div>
        </div>
        ${this.generateResizeHandles()}
      </div>
    `;
  }

  generateWelcomeMessage() {
    return `
      <div class="welcome-message">
        <div class="message assistant-message">
          <div class="message-content">
            <i class="fas fa-robot message-icon"></i>
            <div class="message-text">
              <div class="welcome-hero">
                <div class="welcome-hero-icon">🧬</div>
                <div class="welcome-hero-text">
                  <h3>Welcome to CodeXomics AI</h3>
                  <p>Your intelligent genomics assistant</p>
                </div>
              </div>
              <div class="welcome-cards-grid">
                <div class="welcome-card welcome-card-search">
                  <div class="welcome-card-header">
                    <span class="welcome-card-icon">🔍</span>
                    <span class="welcome-card-title">Navigation & Search</span>
                  </div>
                  <div class="welcome-card-examples">
                    <button class="welcome-example-btn" data-prompt="Navigate to E. coli origin of replication">Navigate to E. coli origin</button>
                    <button class="welcome-example-btn" data-prompt="Search for DNA polymerase genes">Search for DNA polymerase</button>
                  </div>
                </div>
                <div class="welcome-card welcome-card-molbio">
                  <div class="welcome-card-header">
                    <span class="welcome-card-icon">🧪</span>
                    <span class="welcome-card-title">Molecular Biology</span>
                  </div>
                  <div class="welcome-card-examples">
                    <button class="welcome-example-btn" data-prompt="Find EcoRI restriction sites">Find EcoRI sites</button>
                    <button class="welcome-example-btn" data-prompt="Virtual digest with EcoRI and BamHI">Virtual digest</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  generateResizeHandles() {
    const directions = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
    return directions.map(d => `<div class="resize-handle resize-handle-${d}" data-direction="${d}"></div>`).join('');
  }

  getDefaultChatPosition() {
    const defaultSize = { width: 400, height: 600 };
    const viewportWidth = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    const viewportHeight = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);

    return {
      x: Math.max(20, viewportWidth - defaultSize.width - 20),
      y: Math.max(20, viewportHeight - defaultSize.height - 20)
    };
  }

  restoreChatPosition() {
    const chatPanel = document.getElementById('llmChatPanel');
    if (!chatPanel) return;

    const currentPos = this.configManager.get('chat.position');
    const freshDefaultPos = this.getDefaultChatPosition();

    if (!currentPos || currentPos.y < window.innerHeight * 0.3) {
      chatPanel.style.left = freshDefaultPos.x + 'px';
      chatPanel.style.top = freshDefaultPos.y + 'px';
    }

    const savedDockState = this.configManager.get('chat.docked', false);
    if (savedDockState) {
      this.dockChat();
    }
  }

  setupEventListeners() {
    this.addChatToggleButton();

    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendChatBtn');

    if (chatInput && sendBtn) {
      chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = chatInput.scrollHeight + 'px';
        if (this.chatManager.messageHistory?.isBrowsing) {
          this.chatManager.exitHistoryBrowsing();
        }
      });

      chatInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.chatManager.sendMessage();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.chatManager.browseHistoryUp();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.chatManager.browseHistoryDown();
        } else if (this.chatManager.messageHistory?.isBrowsing && e.key === 'Escape') {
          e.preventDefault();
          this.chatManager.cancelHistoryBrowsing();
        }
      });

      sendBtn.addEventListener('click', () => this.chatManager.sendMessage());
    }

    document.getElementById('abortChatBtn')?.addEventListener('click', () => this.chatManager.abortCurrentConversation());
    document.getElementById('minimizeChatBtn')?.addEventListener('click', () => this.toggleChatMinimize());
    document.getElementById('closeChatBtn')?.addEventListener('click', () => this.toggleChatVisibility());
    document.getElementById('clearThinkingBtn')?.addEventListener('click', () => this.chatManager.clearThinkingHistory());
    document.getElementById('exportChatBtn')?.addEventListener('click', () => this.chatManager.exportChatHistory());
    document.getElementById('suggestionsBtn')?.addEventListener('click', () => this.chatManager.showSuggestions());
    document.getElementById('multiAgentToggleBtn')?.addEventListener('click', () => this.chatManager.toggleMultiAgentSystem());
    document.getElementById('newChatBtn')?.addEventListener('click', () => this.chatManager.startNewChat());
    document.getElementById('chatHistoryBtn')?.addEventListener('click', () => this.chatManager.showChatHistoryModal());
    document.getElementById('resetChatPositionBtn')?.addEventListener('click', () => this.resetChatPosition());
    document.getElementById('dockChatBtn')?.addEventListener('click', () => this.toggleDockState());
    document.getElementById('contextModeToggle')?.addEventListener('change', e => {
      this.chatManager.contextModeEnabled = e.target.checked;
    });

    const messagesContainer = document.getElementById('chatMessages');
    if (messagesContainer) {
      messagesContainer.addEventListener('click', e => {
        const exampleBtn = e.target.closest('.welcome-example-btn');
        if (exampleBtn) {
          const prompt = exampleBtn.getAttribute('data-prompt');
          if (prompt) {
            const chatInput = document.getElementById('chatInput');
            if (chatInput) {
              chatInput.value = prompt;
              chatInput.style.height = 'auto';
              chatInput.style.height = chatInput.scrollHeight + 'px';
              chatInput.focus();
            }
          }
        }
      });
    }
  }

  addChatToggleButton() {
    const toolbar = document.getElementById('mainToolbar');
    if (!toolbar) return;

    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'chatToggleBtn';
    toggleBtn.className = 'toolbar-btn';
    toggleBtn.title = 'Toggle AI Chat';
    toggleBtn.innerHTML = '<i class="fas fa-robot"></i>';
    toggleBtn.addEventListener('click', () => this.toggleChatVisibility());

    toolbar.appendChild(toggleBtn);
  }

  toggleChatVisibility() {
    const chatPanel = document.getElementById('llmChatPanel');
    if (!chatPanel) return;

    const isVisible = chatPanel.style.display !== 'none';
    chatPanel.style.display = isVisible ? 'none' : 'flex';
    this.configManager.set('chat.visible', !isVisible);
  }

  toggleChatMinimize() {
    const chatPanel = document.getElementById('llmChatPanel');
    if (!chatPanel) return;

    chatPanel.classList.toggle('minimized');
  }

  toggleDockState() {
    if (this.isDocked) {
      this.undockChat();
    } else {
      this.dockChat();
    }
  }

  dockChat() {
    const chatPanel = document.getElementById('llmChatPanel');
    const genomeBrowser = document.getElementById('genomeBrowser');
    const dockBtn = document.getElementById('dockChatBtn');

    if (!chatPanel || !genomeBrowser) return;

    chatPanel.classList.add('docked');
    genomeBrowser.classList.add('chat-docked');
    this.isDocked = true;

    if (dockBtn) {
      dockBtn.innerHTML = '<i class="fas fa-columns"></i>';
      dockBtn.title = 'Undock chat';
    }

    this.configManager.set('chat.docked', true);
    this.setupDockSplitterDragging();
  }

  undockChat() {
    const chatPanel = document.getElementById('llmChatPanel');
    const genomeBrowser = document.getElementById('genomeBrowser');
    const dockBtn = document.getElementById('dockChatBtn');

    if (!chatPanel || !genomeBrowser) return;

    chatPanel.classList.remove('docked');
    genomeBrowser.classList.remove('chat-docked');
    this.isDocked = false;

    if (dockBtn) {
      dockBtn.innerHTML = '<i class="fas fa-columns"></i>';
      dockBtn.title = 'Dock to right side';
    }

    this.configManager.set('chat.docked', false);
  }

  setupDockSplitterDragging() {
    // Implementation for dock splitter dragging
  }

  setupChatDragging() {
    const chatPanel = document.getElementById('llmChatPanel');
    const chatHeader = document.getElementById('chatHeader');
    if (!chatPanel || !chatHeader) return;

    let isDragging = false;
    let startX, startY, startLeft, startTop;

    chatHeader.addEventListener('mousedown', e => {
      if (this.isDocked) return;
      if (e.target.closest('button')) return;

      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = parseInt(chatPanel.style.left, 10);
      startTop = parseInt(chatPanel.style.top, 10);

      chatPanel.style.transition = 'none';
      document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', e => {
      if (!isDragging) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      chatPanel.style.left = `${startLeft + dx}px`;
      chatPanel.style.top = `${startTop + dy}px`;
    });

    document.addEventListener('mouseup', () => {
      if (!isDragging) return;

      isDragging = false;
      chatPanel.style.transition = '';
      document.body.style.userSelect = '';

      this.saveChatPosition();
    });
  }

  setupChatResizing() {
    const chatPanel = document.getElementById('llmChatPanel');
    if (!chatPanel) return;

    const handles = chatPanel.querySelectorAll('.resize-handle');
    let isResizing = false;
    let currentHandle = null;
    let startX, startY, startWidth, startHeight, startLeft, startTop;

    handles.forEach(handle => {
      handle.addEventListener('mousedown', e => {
        if (this.isDocked) return;

        isResizing = true;
        currentHandle = handle.dataset.direction;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = parseInt(chatPanel.style.width, 10);
        startHeight = parseInt(chatPanel.style.height, 10);
        startLeft = parseInt(chatPanel.style.left, 10);
        startTop = parseInt(chatPanel.style.top, 10);

        chatPanel.style.transition = 'none';
        document.body.style.userSelect = 'none';
        e.preventDefault();
      });
    });

    document.addEventListener('mousemove', e => {
      if (!isResizing) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      const minWidth = 300;
      const minHeight = 400;

      if (currentHandle.includes('e')) {
        chatPanel.style.width = `${Math.max(minWidth, startWidth + dx)}px`;
      }
      if (currentHandle.includes('w')) {
        const newWidth = Math.max(minWidth, startWidth - dx);
        chatPanel.style.width = `${newWidth}px`;
        chatPanel.style.left = `${startLeft + (startWidth - newWidth)}px`;
      }
      if (currentHandle.includes('s')) {
        chatPanel.style.height = `${Math.max(minHeight, startHeight + dy)}px`;
      }
      if (currentHandle.includes('n')) {
        const newHeight = Math.max(minHeight, startHeight - dy);
        chatPanel.style.height = `${newHeight}px`;
        chatPanel.style.top = `${startTop + (startHeight - newHeight)}px`;
      }
    });

    document.addEventListener('mouseup', () => {
      if (!isResizing) return;

      isResizing = false;
      currentHandle = null;
      chatPanel.style.transition = '';
      document.body.style.userSelect = '';

      this.saveChatSize();
    });
  }

  setupWindowResizeHandler() {
    window.addEventListener('resize', () => {
      const chatPanel = document.getElementById('llmChatPanel');
      if (!chatPanel) return;

      const viewportWidth = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
      const viewportHeight = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);

      const currentLeft = parseInt(chatPanel.style.left, 10);
      const currentTop = parseInt(chatPanel.style.top, 10);
      const panelWidth = parseInt(chatPanel.style.width, 10);
      const panelHeight = parseInt(chatPanel.style.height, 10);

      const maxLeft = viewportWidth - panelWidth - 10;
      const maxTop = viewportHeight - panelHeight - 10;

      if (currentLeft > maxLeft) {
        chatPanel.style.left = Math.max(10, maxLeft) + 'px';
      }
      if (currentTop > maxTop) {
        chatPanel.style.top = Math.max(10, maxTop) + 'px';
      }
    });
  }

  saveChatPosition() {
    const chatPanel = document.getElementById('llmChatPanel');
    if (!chatPanel || this.isDocked) return;

    const position = {
      x: parseInt(chatPanel.style.left, 10),
      y: parseInt(chatPanel.style.top, 10)
    };

    this.configManager.set('chat.position', position);
  }

  saveChatSize() {
    const chatPanel = document.getElementById('llmChatPanel');
    if (!chatPanel) return;

    const size = {
      width: parseInt(chatPanel.style.width, 10),
      height: parseInt(chatPanel.style.height, 10)
    };

    this.configManager.set('chat.size', size);
  }

  resetChatPosition() {
    const chatPanel = document.getElementById('llmChatPanel');
    if (!chatPanel) return;

    const defaultPosition = this.getDefaultChatPosition();
    const defaultSize = { width: 400, height: 600 };

    chatPanel.style.left = defaultPosition.x + 'px';
    chatPanel.style.top = defaultPosition.y + 'px';
    chatPanel.style.width = defaultSize.width + 'px';
    chatPanel.style.height = defaultSize.height + 'px';

    this.configManager.set('chat.position', defaultPosition);
    this.configManager.set('chat.size', defaultSize);

    if (this.isDocked) {
      this.undockChat();
    }
  }

  showChatBox() {
    const chatPanel = document.getElementById('llmChatPanel');
    if (chatPanel) {
      chatPanel.style.display = 'flex';
      this.configManager.set('chat.visible', true);
    }
  }

  hideChatBox() {
    const chatPanel = document.getElementById('llmChatPanel');
    if (chatPanel) {
      chatPanel.style.display = 'none';
      this.configManager.set('chat.visible', false);
    }
  }

  updateConnectionStatus(connected) {
    const statusElement = document.getElementById('connectionStatus');
    if (!statusElement) return;

    const icon = statusElement.querySelector('i');
    const text = statusElement.querySelector('span');

    if (connected) {
      icon.className = 'fas fa-circle text-success';
      text.textContent = 'Connected';
    } else {
      icon.className = 'fas fa-circle text-danger';
      text.textContent = 'Disconnected';
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChatUIManager;
}
