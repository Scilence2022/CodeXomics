/**
 * ChatManagerCore - Base class with shared functionality for all ChatManager modules
 * Extracted from the original ChatManager.js God class
 */

class ChatManagerCore {
  constructor(app, configManager = null) {
    this.app = app;
    this.configManager = configManager;

    // Event emitter functionality
    this.eventHandlers = new Map();

    // Dock state
    this.isDocked = false;

    // Context mode toggle state
    this.contextModeEnabled = true;

    // Conversation state management
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
    this.detailedLogging = true;
    this.autoScrollToBottom = true;
    this.showTimestamps = false;
    this.maxHistoryMessages = 1000;
    this.responseTimeout = 30000;

    // Message history browsing state
    this.messageHistory = {
      userMessages: [],
      currentIndex: -1,
      originalContent: '',
      isBrowsing: false,
    };

    // Chat history
    this.chatHistory = [];
    this.currentMessage = null;

    // Set global reference
    window.chatManager = this;
  }

  // ==================== Event Emitter Methods ====================

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

    // Also dispatch as DOM event for cross-component communication
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(`chatmanager-${eventType}`, {
          detail: data,
          bubbles: true,
        })
      );
    }
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

  // ==================== HTML/Text Utilities ====================

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  sanitizeHTML(html) {
    if (!html || typeof html !== 'string') return '';

    const allowedTags = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'code', 'pre', 'span', 'div'];
    const allowedAttributes = ['class', 'style'];

    const temp = document.createElement('div');
    temp.innerHTML = html;

    const sanitizeNode = node => {
      if (node.nodeType === Node.TEXT_NODE) return;

      if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName.toLowerCase();

        if (!allowedTags.includes(tagName)) {
          const parent = node.parentNode;
          while (node.firstChild) {
            parent.insertBefore(node.firstChild, node);
          }
          parent.removeChild(node);
          return;
        }

        Array.from(node.attributes).forEach(attr => {
          if (!allowedAttributes.includes(attr.name.toLowerCase())) {
            node.removeAttribute(attr.name);
          }
        });
      }

      Array.from(node.childNodes).forEach(sanitizeNode);
    };

    Array.from(temp.childNodes).forEach(sanitizeNode);
    return temp.innerHTML;
  }

  // ==================== Settings Management ====================

  updateSettingsFromManager() {
    if (this.chatBoxSettingsManager) {
      this.showThinkingProcess = this.chatBoxSettingsManager.getSetting('showThinkingProcess', true);
      this.showToolCalls = this.chatBoxSettingsManager.getSetting('showToolCalls', true);
      this.showToolCallSource = this.chatBoxSettingsManager.getSetting('showToolCallSource', true);
      this.showDetailedToolData = this.chatBoxSettingsManager.getSetting('showDetailedToolData', true);
      this.autoScrollToBottom = this.chatBoxSettingsManager.getSetting('autoScrollToBottom', true);
      this.showTimestamps = this.chatBoxSettingsManager.getSetting('showTimestamps', false);
      this.maxHistoryMessages = this.chatBoxSettingsManager.getSetting('maxHistoryMessages', 1000);
      this.responseTimeout = this.chatBoxSettingsManager.getSetting('responseTimeout', 30000);
    }
  }

  // ==================== Notification ====================

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

      setTimeout(() => {
        notification.classList.add('show');
      }, 10);

      setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
      }, 3000);
    }
  }

  // ==================== Benchmark Mode Check ====================

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
    const context = {
      currentChromosome: this.app?.currentChromosome || null,
      currentPosition: this.app?.currentPosition || null,
      hasSequence: !!this.app?.currentSequence,
      hasAnnotations: !!this.app?.currentAnnotations,
      loadedFiles: this.getLoadedFilesList(),
      visibleTracks: this.getVisibleTracks(),
    };

    if (this.pluginFunctionCallsIntegrator) {
      context.pluginFunctions = this.pluginFunctionCallsIntegrator.getAvailableFunctions();
    }

    if (this.mcpServerManager) {
      context.mcpTools = this.mcpServerManager.getAllTools();
    }

    return context;
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
          tracks.push({
            name,
            type: this.getTrackDescription(name),
          });
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
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChatManagerCore;
}
