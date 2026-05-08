// @ts-check
/**
 * ChatMessageService - Message rendering and display extracted from ChatManager
 */
class ChatMessageService {
  constructor(app, chatManager) {
    this.app = app;
    this.chatManager = chatManager;
  }

  addMessageToChat(message, sender, isError = false) {
    const timestamp = new Date().toISOString();

    // Add to configuration manager for persistence (ChatBox原有功能)
    const messageId = this.chatManager.configManager.addChatMessage(message, sender, timestamp);

    // Add to Evolution data structure for detailed analysis
    this.chatManager.addToEvolutionData({
      type: 'message',
      timestamp: timestamp,
      messageId: messageId,
      sender: sender,
      content: message,
      isError: isError,
      metadata: {
        source: 'direct_message',
        visible: true,
      },
    });

    // Display the message in UI
    this.displayChatMessage(message, sender, timestamp, messageId);
  }

  copyMessage(messageId) {
    const messageElement = document.getElementById(messageId);
    if (messageElement) {
      // Get the text content, stripping HTML but preserving line breaks
      let textContent = messageElement.innerText || messageElement.textContent;

      // Copy to clipboard
      navigator.clipboard
        .writeText(textContent)
        .then(() => {
          // Show brief success indication
          const copyBtn = messageElement.parentElement.querySelector('.copy-message-btn');
          const originalHTML = copyBtn.innerHTML;
          copyBtn.innerHTML = '<i class="fas fa-check"></i>';
          copyBtn.style.color = '#10b981';

          setTimeout(() => {
            copyBtn.innerHTML = originalHTML;
            copyBtn.style.color = '';
          }, 1000);
        })
        .catch(err => {
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

  /**
   * Enhanced Markdown formatting with proper rendering
   * Handles code blocks, lists, headers, links, tables, and more
   */
  formatMessage(message) {
    if (!message || typeof message !== 'string') {
      return '';
    }
    // Trim leading/trailing whitespace
    let formattedMessage = message.trim();

    // Remove common leading whitespace while preserving relative indentation
    const lines = formattedMessage.split('\n');
    if (lines.length > 1) {
      const nonEmptyLines = lines.filter(line => line.trim().length > 0);
      if (nonEmptyLines.length > 0) {
        const minIndent = Math.min(
          ...nonEmptyLines.map(line => {
            const match = line.match(/^(\s*)/);
            return match ? match[1].length : 0;
          })
        );

        if (minIndent > 0) {
          formattedMessage = lines
            .map(line => {
              return line.length > 0 ? line.substring(minIndent) : line;
            })
            .join('\n');
        }
      }
    }

    // Preprocess: Convert relative MCP download URLs to absolute clickable links
    formattedMessage = this.chatManager.convertMCPDownloadUrls(formattedMessage);

    // Use marked library for proper Markdown rendering if available
    if (typeof marked !== 'undefined' && marked.parse) {
      try {
        // Configure marked options for better rendering
        marked.setOptions({
          breaks: true, // Enable GFM line breaks
          gfm: true, // Enable GitHub Flavored Markdown
          headerIds: false, // Disable header IDs for security
          mangle: false, // Don't mangle email addresses
          sanitize: false, // We'll handle sanitization separately
          smartLists: true, // Use smarter list behavior
          smartypants: true, // Use smart typography
          xhtml: false, // Don't use XHTML tags
        });

        // Parse markdown to HTML
        const htmlContent = marked.parse(formattedMessage);

        // Sanitize the HTML output to prevent XSS while preserving formatting
        const sanitizedHtml = this.sanitizeHTML(htmlContent);

        // Post-process to convert any remaining markdown-style MCP links to clickable HTML
        return this.postProcessMCPLinks(sanitizedHtml);
      } catch (error) {
        console.error('Markdown parsing error:', error);
        // Fallback to basic formatting if marked fails
        const basicHtml = this.basicMarkdownFormat(formattedMessage);
        return this.postProcessMCPLinks(basicHtml);
      }
    }

    // Fallback to basic formatting if marked is not available
    const basicHtml = this.basicMarkdownFormat(formattedMessage);
    return this.postProcessMCPLinks(basicHtml);
  }

  /**
   * Basic Markdown formatting fallback
   * Used when marked library is not available
   */
  basicMarkdownFormat(text) {
    return (
      text
        // Code blocks (```)
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Bold
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/__([^_]+)__/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/_([^_]+)_/g, '<em>$1</em>')
        // Headers
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
        // Unordered lists
        .replace(/^[*+-] (.+)$/gm, '<li>$1</li>')
        // Ordered lists
        .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
        // Line breaks
        .replace(/\n/g, '<br>')
    );
  }

  /**
   * Post-process HTML to convert remaining markdown-style links to clickable HTML links
   * Called after sanitizeHTML to handle cases where markdown wasn't parsed
   */
  postProcessMCPLinks(html) {
    if (!html || typeof html !== 'string') {
      return html;
    }

    try {
      // Get MCP base URL
      let baseUrl = 'http://localhost:3000';
      if (this.chatManager.mcpServerManager) {
        const deepGeneServer = this.chatManager.mcpServerManager.servers?.get('deep-gene-research');
        if (deepGeneServer && deepGeneServer.url) {
          try {
            const urlObj = new URL(deepGeneServer.url);
            baseUrl = `${urlObj.protocol}//${urlObj.host}`;
          } catch (e) {
            /* ignore */
          }
        }
      }

      // Convert escaped markdown links like [text](url) that weren't rendered
      // This handles cases where content wasn't markdown-parsed
      html = html.replace(/\[([^\]]+)\]\((http[s]?:\/\/[^\s\)]+\/api\/mcp\/[^\s\)]+)\)/g, (match, label, url) => {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="mcp-download-link">${label}</a>`;
      });

      // Also convert any remaining raw /api/mcp URLs to clickable links
      html = html.replace(/(?<!href="|">)(http[s]?:\/\/[^\s<>"]+\/api\/mcp\/download\/[^\s<>"]+)/g, (match, url) => {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="mcp-download-link">${url}</a>`;
      });

      return html;
    } catch (error) {
      console.error('Error post-processing MCP links:', error);
      return html;
    }
  }

  /**
   * Sanitize HTML to prevent XSS attacks while preserving formatting
   * Allows safe HTML tags and attributes
   */
  sanitizeHTML(html) {
    // Use DOMPurify via SanitizeService if available (much more robust than manual sanitization)
    if (typeof window !== 'undefined' && window.SanitizeService) {
      return window.SanitizeService.sanitizeMarkdown(html);
    }

    // Fallback: if DOMPurify is available directly
    if (typeof DOMPurify !== 'undefined' && DOMPurify.sanitize) {
      return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
          'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'code', 'pre',
          'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
          'a', 'img', 'blockquote', 'hr', 'table', 'thead', 'tbody',
          'tr', 'th', 'td', 'div', 'span', 'del', 'ins', 'sup', 'sub',
          'details', 'summary', 'mark', 'kbd', 'var', 'cite',
        ],
        ALLOWED_ATTR: [
          'href', 'title', 'target', 'rel', 'src', 'alt', 'width', 'height',
          'class', 'id', 'style',
        ],
        ALLOW_DATA_ATTR: true,
        FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed'],
        ADD_ATTR: ['target'],
      });
    }

    // Last resort fallback: original manual sanitization (less secure than DOMPurify)
    console.warn('[Security] DOMPurify not available, falling back to manual HTML sanitization');
    const allowedTags = [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'code', 'pre',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
      'a', 'img', 'blockquote', 'hr', 'table', 'thead', 'tbody',
      'tr', 'th', 'td', 'div', 'span', 'del', 'ins', 'sup', 'sub',
    ];

    const allowedAttributes = {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      code: ['class'],
      pre: ['class'],
      div: ['class', 'style'],
      span: ['class', 'style'],
    };

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    const sanitizeNode = node => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.cloneNode(true);
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName.toLowerCase();

        if (!allowedTags.includes(tagName)) {
          const textNode = document.createTextNode(node.textContent);
          return textNode;
        }

        const newElement = document.createElement(tagName);

        if (allowedAttributes[tagName]) {
          Array.from(node.attributes).forEach(attr => {
            if (allowedAttributes[tagName].includes(attr.name)) {
              if (tagName === 'a' && attr.name === 'href') {
                const href = attr.value;
                if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:')) {
                  newElement.setAttribute(attr.name, attr.value);
                }
              } else {
                newElement.setAttribute(attr.name, attr.value);
              }
            }
          });

          if (tagName === 'a' && !newElement.hasAttribute('target')) {
            newElement.setAttribute('target', '_blank');
          }
          if (tagName === 'a' && !newElement.hasAttribute('rel')) {
            newElement.setAttribute('rel', 'noopener noreferrer');
          }
        }

        Array.from(node.childNodes).forEach(child => {
          const sanitizedChild = sanitizeNode(child);
          if (sanitizedChild) {
            newElement.appendChild(sanitizedChild);
          }
        });

        return newElement;
      }

      return null;
    };

    const sanitizedDiv = document.createElement('div');
    Array.from(tempDiv.childNodes).forEach(child => {
      const sanitizedChild = sanitizeNode(child);
      if (sanitizedChild) {
        sanitizedDiv.appendChild(sanitizedChild);
      }
    });

    return sanitizedDiv.innerHTML;
  }

  /**
   * Display visualization DOM element in chat interface
   * @param {string} toolName - Name of the visualization tool
   * @param {HTMLElement} domElement - DOM element to display
   * @param {Object} parameters - Tool parameters for context
   */
  displayVisualizationInChat(toolName, domElement, parameters = {}) {
    try {
      console.log(`🎨 [ChatManager] Displaying visualization: ${toolName}`);

      const messagesContainer = document.getElementById('chatMessages');
      if (!messagesContainer) {
        console.error('❌ [ChatManager] Chat messages container not found');
        return;
      }

      // Create visualization message container
      const vizMessage = document.createElement('div');
      vizMessage.className = 'chat-message assistant-message visualization-message';
      vizMessage.style.cssText = `
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border: none;
                border-radius: 12px;
                padding: 0;
                margin: 12px 0;
                max-width: 90%;
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.25);
            `;

      // Create header
      const vizHeader = document.createElement('div');
      vizHeader.style.cssText = `
                padding: 12px 16px;
                border-bottom: 1px solid rgba(255,255,255,0.1);
                display: flex;
                align-items: center;
                justify-content: space-between;
                color: white;
                font-weight: 600;
                font-size: 14px;
            `;
      vizHeader.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-chart-network" style="font-size: 16px;"></i>
                    <span>🎨 Visualization: ${this.formatToolName(toolName)}</span>
                </div>
                <button class="viz-expand-btn" title="Expand" style="
                    background: rgba(255,255,255,0.2);
                    border: none;
                    color: white;
                    padding: 4px 8px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                ">
                    <i class="fas fa-expand-alt"></i>
                </button>
            `;

      // Create content container
      const vizContent = document.createElement('div');
      vizContent.className = 'visualization-content';
      vizContent.style.cssText = `
                background: white;
                padding: 16px;
                border-radius: 0 0 12px 12px;
                min-height: 200px;
                max-height: 600px;
                overflow: auto;
            `;

      // Validate and append DOM element
      if (domElement instanceof Node) {
        // Style the visualization element
        domElement.style.width = '100%';
        domElement.style.minHeight = '300px';
        vizContent.appendChild(domElement);
        console.log('✅ [ChatManager] Visualization DOM element appended successfully');
      } else {
        console.error('❌ [ChatManager] Invalid DOM element', domElement);
        vizContent.innerHTML =
          '<div style="color: #e74c3c; padding: 20px; text-align: center;">Invalid visualization element</div>';
      }

      // Assemble message
      vizMessage.appendChild(vizHeader);
      vizMessage.appendChild(vizContent);
      messagesContainer.appendChild(vizMessage);

      // Add expand functionality
      const expandBtn = vizHeader.querySelector('.viz-expand-btn');
      if (expandBtn) {
        expandBtn.addEventListener('click', () => {
          this.expandVisualization(domElement, toolName);
        });
      }

      // Scroll to show the visualization
      messagesContainer.scrollTop = messagesContainer.scrollHeight;

      // Track in Evolution data
      this.chatManager.addToEvolutionData({
        type: 'visualization_displayed',
        timestamp: new Date().toISOString(),
        toolName: toolName,
        parameters: parameters,
        success: true,
      });
    } catch (error) {
      console.error('❌ [ChatManager] Error displaying visualization:', error);
    }
  }

  /**
   * Format tool name for display
   * @param {string} toolName - Tool name (e.g., "protein-interaction-network.visualize")
   * @returns {string} Formatted name
   */
  formatToolName(toolName) {
    return toolName
      .split('.')
      .map(part => part.replace(/-/g, ' '))
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' → ');
  }

  /**
   * Expand visualization in full-screen modal
   * @param {HTMLElement} element - Visualization element
   * @param {string} toolName - Tool name
   */
  expandVisualization(element, toolName) {
    // Create modal
    const modal = document.createElement('div');
    modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0,0,0,0.9);
            z-index: 10000;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 20px;
        `;

    // Clone the element for modal display
    const clonedElement = element.cloneNode(true);
    clonedElement.style.width = '90%';
    clonedElement.style.height = '80%';
    clonedElement.style.maxWidth = '1200px';
    clonedElement.style.background = 'white';
    clonedElement.style.borderRadius = '8px';
    clonedElement.style.padding = '20px';

    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '<i class="fas fa-times"></i> Close';
    closeBtn.style.cssText = `
            position: absolute;
            top: 30px;
            right: 30px;
            background: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
    closeBtn.onclick = () => document.body.removeChild(modal);

    modal.appendChild(clonedElement);
    modal.appendChild(closeBtn);
    document.body.appendChild(modal);

    // Close on escape key
    const escHandler = e => {
      if (e.key === 'Escape' && document.body.contains(modal)) {
        document.body.removeChild(modal);
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
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

    // Clear chat input box
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
      chatInput.value = '';
      chatInput.style.height = 'auto'; // Reset height for auto-resize
    }

    // Clear chat history from config
    this.chatManager.configManager.clearChatHistory();
  }

  /**
   * Export chat history
   */
  async exportChatHistory(format = 'json') {
    try {
      const history = this.chatManager.configManager.getChatHistory();
      const exportData = {
        exported: new Date().toISOString(),
        messageCount: history.length,
        format: format,
        messages: history,
      };

      let content, filename, mimeType;

      switch (format.toLowerCase()) {
        case 'json':
          content = JSON.stringify(exportData, null, 2);
          filename = `chat-history-${new Date().toISOString().split('T')[0]}.json`;
          mimeType = 'application/json';
          break;

        case 'txt':
          content = history
            .map(msg => {
              const time = new Date(msg.timestamp).toLocaleString();
              return `[${time}] ${msg.sender.toUpperCase()}: ${msg.message}`;
            })
            .join('\n\n');
          filename = `chat-history-${new Date().toISOString().split('T')[0]}.txt`;
          mimeType = 'text/plain';
          break;

        case 'csv':
          const csvHeader = 'Timestamp,Sender,Message\n';
          const csvContent = history
            .map(msg => {
              const escapedMessage = msg.message.replace(/"/g, '""');
              return `"${msg.timestamp}","${msg.sender}","${escapedMessage}"`;
            })
            .join('\n');
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

  /**
   * Load chat history from configuration
   */
  loadChatHistory() {
    try {
      console.log('Loading chat history...');
      const history = this.chatManager.configManager.getChatHistory();
      console.log(`Found ${history.length} chat messages in history`);

      if (history.length > 0) {
        this.displayChatHistory(history);
        console.log(`Successfully loaded and displayed ${history.length} chat messages`);
      } else {
        console.log('No chat history found');
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
      this.chatManager.showNotification('⚠️ Could not load chat history', 'warning');
    }
  }

  /**
   * Display chat history in the UI
   */
  displayChatHistory(history) {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) {
      console.warn('Chat messages container not found, cannot display history');
      return;
    }

    console.log('Displaying chat history with', history.length, 'messages');

    // Preserve welcome message but clear other messages
    const welcomeMessage = messagesContainer.querySelector('.welcome-message');

    // Clear all messages except welcome
    const existingMessages = messagesContainer.querySelectorAll('.message:not(.welcome-message .message)');
    existingMessages.forEach(msg => msg.remove());

    // Display historical messages
    history.forEach((msg, index) => {
      console.log(`Displaying message ${index + 1}:`, msg.message.substring(0, 50) + '...');
      this.displayChatMessage(msg.message, msg.sender, msg.timestamp, msg.id);
    });

    // Scroll to bottom to show most recent messages
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    console.log('Chat history display completed');
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

    const safeMessage = this.formatMessage(message);
    const safeDisplayId = displayId.replace(/[^a-zA-Z0-9_-]/g, '');
    messageDiv.innerHTML = `<div class="message-content"><div class="message-icon"><i class="fas fa-${sender === 'user' ? 'user' : 'robot'}"></i></div><div class="message-text" id="${safeDisplayId}">${safeMessage}</div><div class="message-actions"><button class="copy-message-btn" onclick="chatManager.services.messaging.copyMessage('${safeDisplayId}')" title="Copy message"><i class="fas fa-copy"></i></button></div></div><div class="message-time">${displayTime}</div>`;

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  /**
   * Show full message in a popup
   */
  showFullMessage(messageId) {
    const history = this.chatManager.configManager.getChatHistory();
    const message = history.find(msg => msg.id === messageId);

    if (!message) {
      this.chatManager.showNotification('❌ Message not found', 'error');
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal message-detail-modal show';
    modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>
                        <i class="fas fa-${message.sender === 'user' ? 'user' : 'robot'}"></i>
                        ${message.sender === 'user' ? 'Your Message' : 'AI Assistant Message'}
                    </h3>
                    <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="message-metadata">
                        <strong>Time:</strong> ${new Date(message.timestamp).toLocaleString()}<br>
                        <strong>ID:</strong> ${message.id}
                    </div>
<div class="full-message-content">${this.formatMessage(message.message)}</div>
                    <div class="message-actions">
                        <button class="btn btn-sm btn-secondary" onclick="chatManager.services.messaging.copyHistoryMessage('${message.id}')">
                            <i class="fas fa-copy"></i>
                            Copy Message
                        </button>
                    </div>
                </div>
            </div>
        `;

    document.body.appendChild(modal);
  }

  /**
   * Copy a message from history
   */
  copyHistoryMessage(messageId) {
    const history = this.chatManager.configManager.getChatHistory();
    const message = history.find(msg => msg.id === messageId);

    if (!message) {
      this.chatManager.showNotification('❌ Message not found', 'error');
      return;
    }

    navigator.clipboard
      .writeText(message.message)
      .then(() => {
        this.chatManager.showNotification('Message copied to clipboard', 'success');
      })
      .catch(err => {
        console.error('Failed to copy message:', err);
        this.chatManager.showNotification('❌ Failed to copy message', 'error');
      });
  }

  /**
   * Delete a message from history
   */
  deleteHistoryMessage(messageId) {
    const confirmed = confirm('Are you sure you want to delete this message from history?');
    if (!confirmed) return;

    try {
      let history = this.chatManager.configManager.getChatHistory();
      const messageIndex = history.findIndex(msg => msg.id === messageId);

      if (messageIndex === -1) {
        this.chatManager.showNotification('❌ Message not found', 'error');
        return;
      }

      // Remove the message
      history.splice(messageIndex, 1);

      // Save updated history
      this.chatManager.configManager.setChatHistory(history);
      this.chatManager.configManager.save();

      this.chatManager.showNotification('Message deleted from history', 'success');

      // Refresh the modal
      this.chatManager.closeChatHistoryModal();
      setTimeout(() => this.chatManager.showChatHistoryModal(), 100);
    } catch (error) {
      console.error('Error deleting message:', error);
      this.chatManager.showNotification('❌ Failed to delete message', 'error');
    }
  }
}
window.ChatMessageService = ChatMessageService;
