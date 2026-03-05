/**
 * ChatHistoryManager - Handles message history, persistence, and browsing
 */

class ChatHistoryManager {
  constructor(chatManager) {
    this.chatManager = chatManager;
    this.configManager = chatManager.configManager;
  }

  loadChatHistory() {
    if (!this.configManager) return;

    const history = this.configManager.getChatHistory() || [];
    this.chatManager.chatHistory = history;
    this.displayChatHistory(history);
  }

  displayChatHistory(history) {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;

    messagesContainer.innerHTML = '';

    history.forEach(msg => {
      this.displayChatMessage(msg.message, msg.sender, msg.timestamp, msg.id);
    });

    this.scrollToBottom();
  }

  displayChatMessage(message, sender, timestamp = null, messageId = null) {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;

    const id = messageId || this.chatManager.generateId();
    const time = timestamp || new Date().toISOString();

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    messageDiv.id = `msg-${id}`;

    const isError = sender === 'assistant' && message.startsWith('Error:');
    if (isError) {
      messageDiv.classList.add('error-message');
    }

    const formattedContent = this.formatMessage(message);

    messageDiv.innerHTML = `
      <div class="message-content">
        <i class="fas ${sender === 'user' ? 'fa-user' : 'fa-robot'} message-icon"></i>
        <div class="message-text">${formattedContent}</div>
        ${sender === 'assistant' ? `
          <div class="message-actions">
            <button class="msg-action-btn copy-btn" onclick="window.chatManager.copyMessage('${id}')" title="Copy">
              <i class="fas fa-copy"></i>
            </button>
          </div>
        ` : ''}
      </div>
      <div class="message-time">${new Date(time).toLocaleTimeString()}</div>
    `;

    messagesContainer.appendChild(messageDiv);
    this.scrollToBottom();

    // Save to config
    if (this.configManager) {
      this.configManager.addChatMessage(message, sender);
    }

    // Add to history array
    this.chatManager.chatHistory.push({
      id,
      message,
      sender,
      timestamp: time,
      role: sender,
      content: message,
    });
  }

  addMessageToChat(message, sender, isError = false) {
    this.displayChatMessage(message, sender);
  }

  formatMessage(message) {
    if (!message) return '';

    // Basic markdown formatting
    let formatted = this.escapeHtml(message);

    // Code blocks
    formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');

    // Inline code
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Italic
    formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Line breaks
    formatted = formatted.replace(/\n/g, '<br>');

    return formatted;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  clearChat() {
    const messagesContainer = document.getElementById('chatMessages');
    if (messagesContainer) {
      messagesContainer.innerHTML = this.generateWelcomeMessage();
    }

    this.chatManager.chatHistory = [];

    if (this.configManager) {
      this.configManager.clearChatHistory();
    }
  }

  startNewChat() {
    this.clearChat();

    if (this.configManager) {
      this.configManager.addChatMessage('--- CONVERSATION_SEPARATOR ---', 'system');
    }

    this.chatManager.showNotification('New conversation started', 'success');
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
            </div>
          </div>
        </div>
      </div>
    `;
  }

  async exportChatHistory(format = 'json') {
    const history = this.chatManager.chatHistory;

    let content, filename, mimeType;

    switch (format) {
      case 'json':
        content = JSON.stringify(history, null, 2);
        filename = `chat-history-${new Date().toISOString().split('T')[0]}.json`;
        mimeType = 'application/json';
        break;
      case 'markdown':
        content = this.convertToMarkdown(history);
        filename = `chat-history-${new Date().toISOString().split('T')[0]}.md`;
        mimeType = 'text/markdown';
        break;
      case 'txt':
        content = this.convertToText(history);
        filename = `chat-history-${new Date().toISOString().split('T')[0]}.txt`;
        mimeType = 'text/plain';
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    this.downloadFile(content, filename, mimeType);
  }

  convertToMarkdown(history) {
    return history.map(msg => {
      const role = msg.sender === 'user' ? '**User**' : '**Assistant**';
      return `${role} (${new Date(msg.timestamp).toLocaleString()}):\n${msg.message}\n`;
    }).join('\n---\n\n');
  }

  convertToText(history) {
    return history.map(msg => {
      const role = msg.sender === 'user' ? 'User' : 'Assistant';
      return `[${new Date(msg.timestamp).toLocaleString()}] ${role}:\n${msg.message}\n`;
    }).join('\n' + '='.repeat(50) + '\n\n');
  }

  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  showChatHistoryModal() {
    // Implementation for showing chat history modal
    console.log('Chat history modal not yet implemented');
  }

  browseHistoryUp() {
    const chatInput = document.getElementById('chatInput');
    if (!chatInput) return;

    this.updateUserMessageHistory();

    if (this.chatManager.messageHistory.userMessages.length === 0) {
      return;
    }

    if (!this.chatManager.messageHistory.isBrowsing) {
      this.chatManager.messageHistory.originalContent = chatInput.value;
      this.chatManager.messageHistory.isBrowsing = true;
      this.chatManager.messageHistory.currentIndex = this.chatManager.messageHistory.userMessages.length - 1;
    } else {
      if (this.chatManager.messageHistory.currentIndex > 0) {
        this.chatManager.messageHistory.currentIndex--;
      } else {
        this.chatManager.messageHistory.currentIndex = this.chatManager.messageHistory.userMessages.length - 1;
      }
    }

    const currentMessage = this.chatManager.messageHistory.userMessages[this.chatManager.messageHistory.currentIndex];
    chatInput.value = currentMessage;
    chatInput.style.height = 'auto';
    chatInput.style.height = chatInput.scrollHeight + 'px';
    chatInput.setSelectionRange(chatInput.value.length, chatInput.value.length);
  }

  browseHistoryDown() {
    const chatInput = document.getElementById('chatInput');
    if (!chatInput || !this.chatManager.messageHistory.isBrowsing) return;

    if (this.chatManager.messageHistory.currentIndex < this.chatManager.messageHistory.userMessages.length - 1) {
      this.chatManager.messageHistory.currentIndex++;
      const currentMessage = this.chatManager.messageHistory.userMessages[this.chatManager.messageHistory.currentIndex];
      chatInput.value = currentMessage;
    } else {
      chatInput.value = this.chatManager.messageHistory.originalContent;
      this.exitHistoryBrowsing();
    }

    chatInput.style.height = 'auto';
    chatInput.style.height = chatInput.scrollHeight + 'px';
    chatInput.setSelectionRange(chatInput.value.length, chatInput.value.length);
  }

  cancelHistoryBrowsing() {
    const chatInput = document.getElementById('chatInput');
    if (!chatInput || !this.chatManager.messageHistory.isBrowsing) return;

    chatInput.value = this.chatManager.messageHistory.originalContent;
    this.exitHistoryBrowsing();

    chatInput.style.height = 'auto';
    chatInput.style.height = chatInput.scrollHeight + 'px';
  }

  exitHistoryBrowsing() {
    this.chatManager.messageHistory.isBrowsing = false;
    this.chatManager.messageHistory.currentIndex = -1;
    this.chatManager.messageHistory.originalContent = '';
  }

  updateUserMessageHistory() {
    try {
      const fullHistory = this.configManager?.getChatHistory() || [];
      this.chatManager.messageHistory.userMessages = fullHistory
        .filter(msg => msg.sender === 'user')
        .map(msg => msg.message);
    } catch (error) {
      this.chatManager.messageHistory.userMessages = [];
    }
  }

  scrollToBottom() {
    const messagesContainer = document.getElementById('chatMessages');
    if (messagesContainer && this.chatManager.autoScrollToBottom) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  copyMessage(messageId) {
    const message = this.chatManager.chatHistory.find(m => m.id === messageId);
    if (message) {
      navigator.clipboard.writeText(message.message).then(() => {
        this.chatManager.showNotification('Message copied to clipboard', 'success');
      });
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChatHistoryManager;
}
