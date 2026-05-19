/**
 * MCPBridge - Auto-connect bridge between CodeXomics app and standalone MCP server
 *
 * When the standalone MCP server is running (npm run codexomics-mcp-server),
 * this module automatically connects via WebSocket and handles tool execution
 * requests from external AI agents (like MCP Client).
 */
class MCPBridge {
  constructor(options = {}) {
    this.wsUrl = options.wsUrl || 'ws://localhost:3003';
    this.baseReconnectInterval = options.baseReconnectInterval || 5000; // Base interval: 5 seconds
    this.maxReconnectInterval = options.maxReconnectInterval || 60000; // Max interval: 60 seconds
    this.ws = null;
    this.connected = false;
    this.internalMCPServer = null;
    this.reconnectTimer = null;
    this.connectionAttempts = 0;
    this.maxReconnectAttempts = options.maxReconnectAttempts || Infinity;
    this.quiet = false; // Suppress repeated "not available" logs
    this.windowId = options.windowId || null; // Multi-window support: unique window identifier
    this.enabled = false; // Is the bridge enabled/started?

    console.log('[MCPBridge] Initialized, will attempt connection to:', this.wsUrl);
  }

  /**
   * Set reference to InternalMCPServer for tool execution delegation
   */
  setInternalMCPServer(server) {
    this.internalMCPServer = server;
  }

  /**
   * Set the windowId for multi-window support
   * Called when the main process sends the window identifier via IPC
   */
  setWindowId(windowId) {
    this.windowId = windowId;
    console.log(`[MCPBridge] Window ID set to: ${windowId}`);
    // If socket is open, immediately inform the server of the new identity
    // (even if we haven't received 'internal-client-connected' yet)
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'internal-client',
          windowId: this.windowId,
        })
      );
    }
  }

  /**
   * Report the currently loaded genome to the MCP server
   * Allows list_genome_windows to accurately describe the active window
   */
  reportGenomeLoaded(genomeName) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'genome-loaded',
          genomeName: genomeName,
        })
      );
    } else {
      // Store to send once connected
      this.pendingGenomeName = genomeName;
    }
  }

  /**
   * Start automatic connection attempts
   */
  start() {
    this.enabled = true;
    this.connect();
  }

  /**
   * Stop bridge and close connection
   */
  stop() {
    console.log('[MCPBridge] Stopping bridge');
    this.enabled = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  /**
   * Attempt to connect to MCP server
   */
  connect() {
    if (!this.enabled) {
      return;
    }
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return; // Already connecting or connected
    }

    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        console.log('[MCPBridge] WebSocket connected to MCP server');
        this.connectionAttempts = 0;
        this.quiet = false;

        // Send internal client identification with windowId (no API key needed for localhost)
        this.ws.send(
          JSON.stringify({
            type: 'internal-client',
            windowId: this.windowId,
          })
        );

        if (this.pendingGenomeName) {
          this.ws.send(
            JSON.stringify({
              type: 'genome-loaded',
              genomeName: this.pendingGenomeName,
            })
          );
          this.pendingGenomeName = null;
        }

        // Keep connection alive to prevent server's ConnectionHealthMonitor from marking it stale
        this.pingInterval = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 15000); // 15 seconds
      };

      this.ws.onmessage = event => {
        this.handleMessage(event.data);
      };

      this.ws.onclose = () => {
        if (this.pingInterval) {
          clearInterval(this.pingInterval);
          this.pingInterval = null;
        }

        if (this.connected) {
          console.log('[MCPBridge] Disconnected from MCP server');
        }
        this.connected = false;
        this.scheduleReconnect();
      };

      this.ws.onerror = error => {
        // Only log on first attempt or after being connected
        if (!this.quiet) {
          console.log('[MCPBridge] MCP server not available, will retry...');
          this.quiet = true;
        }
      };
    } catch (error) {
      if (!this.quiet) {
        console.log('[MCPBridge] Failed to connect:', error.message);
        this.quiet = true;
      }
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule reconnection attempt with exponential backoff
   */
  scheduleReconnect() {
    if (!this.enabled) {
      return;
    }
    if (this.reconnectTimer) {
      return; // Already scheduled
    }

    this.connectionAttempts++;

    if (this.connectionAttempts > this.maxReconnectAttempts) {
      console.log('[MCPBridge] Max reconnect attempts reached, stopping');
      return;
    }

    // Calculate exponential backoff interval
    // Formula: baseInterval * 2^attempts, capped at maxReconnectInterval
    const backoffInterval = Math.min(
      this.maxReconnectInterval,
      this.baseReconnectInterval * Math.pow(2, Math.min(this.connectionAttempts - 1, 5))
    );

    if (!this.quiet) {
      console.log(
        `[MCPBridge] Reconnecting in ${(backoffInterval / 1000).toFixed(1)}s (attempt ${this.connectionAttempts})`
      );
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, backoffInterval);
  }

  /**
   * Handle incoming messages from MCP server
   */
  handleMessage(data) {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'connection':
          // Initial connection confirmation
          break;

        case 'internal-client-connected':
          this.connected = true;
          console.log('[MCPBridge] ✅ Registered as internal client, session:', message.sessionId);
          this.notifyConnectionStatus(true);
          break;

        case 'tool-execution':
          this.handleToolExecution(message);
          break;

        case 'error':
          console.error('[MCPBridge] Server error:', message.error);
          break;

        default:
          console.log('[MCPBridge] Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('[MCPBridge] Failed to parse message:', error);
    }
  }

  /**
   * Handle tool execution request from MCP server
   */
  async handleToolExecution(message) {
    const { requestId, method, toolName, parameters } = message;

    console.log(`[MCPBridge] Received tool execution request: ${method} (${toolName})`);

    if (!this.internalMCPServer) {
      this.sendResult(requestId, null, 'InternalMCPServer not initialized');
      return;
    }

    try {
      // Delegate to InternalMCPServer.executeMethod
      const result = await this.internalMCPServer.executeMethod(method, parameters);
      this.sendResult(requestId, result, null);
    } catch (error) {
      console.error(`[MCPBridge] Tool execution failed: ${method}`, error);
      this.sendResult(requestId, null, error.message);
    }
  }

  /**
   * Send tool execution result back to MCP server
   */
  sendResult(requestId, result, error) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[MCPBridge] Cannot send result - WebSocket not connected');
      return;
    }

    this.ws.send(
      JSON.stringify({
        type: 'tool-execution-result',
        requestId,
        result,
        error,
      })
    );
  }

  /**
   * Notify UI of connection status change
   */
  notifyConnectionStatus(connected) {
    // Dispatch custom event for UI to listen to
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('mcp-bridge-status', {
          detail: { connected },
        })
      );
    }
  }

  /**
   * Get current connection status
   */
  isConnected() {
    return this.connected;
  }
}

// Export for use in renderer
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MCPBridge;
}
