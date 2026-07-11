#!/usr/bin/env node

/**
 * Standard Claude MCP Server for CodeXomics
 *
 * Dual-mode server:
 * - In-app mode: mainWindow is provided, IPC enabled, EventEmitter events
 *   consumed by Electron main process and forwarded to MCP Server Manager
 * - Standalone mode (npm start mcp-server): mainWindow is null, runs independently,
 *   EventEmitter events fire harmlessly, console.log output is primary interface
 *
 * Log streaming: Uses EventEmitter 'log' events in-app (captured by main.js
 * and forwarded to MCP Server Manager). Console.log always fires for standalone mode.
 *
 * Based on the official MCP TypeScript SDK
 */

const { EventEmitter } = require('events');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  InitializeRequestSchema,
  InitializedNotificationSchema,
  PingRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

const express = require('express');
const cors = require('cors');
require('path');
const WebSocket = require('ws');
require('http');

// Import the organized tools integrator
const ToolsIntegrator = require('./mcp-tools/ToolsIntegrator.js');
const AuthenticationManager = require('./mcp-tools/AuthenticationManager.js');
const ToolCategoryManager = require('./mcp-tools/ToolCategoryManager.js');
const ConnectionHealthMonitor = require('./mcp-tools/ConnectionHealthMonitor.js');

const DEFAULT_MCP_JSON_PAYLOAD_LIMIT = '96mb';
const DEFAULT_WS_MAX_PAYLOAD_BYTES = 96 * 1024 * 1024;

class StandardClaudeMCPServer extends EventEmitter {
  constructor(httpPort = 3002, wsPort = 3003, mainWindow = null, authConfig = {}) {
    super(); // Initialize EventEmitter
    this.httpPort = httpPort;
    this.wsPort = wsPort;
    this.mainWindow = mainWindow;
    this.pendingRequests = new Map();
    this.activeConnections = new Set();

    // MCP Server mode: 'tools' (default) or 'agent'
    // - 'tools': Standard MCP tool server - each tools/call maps to a specific tool
    // - 'agent': Agent mode - all prompts are routed through ChatManager's LLM loop,
    //           which autonomously decides which tools to call
    this.mode = (process.env.CODEXOMICS_MCP_MODE || authConfig.mode || 'tools').toLowerCase();
    if (!['tools', 'agent'].includes(this.mode)) {
      this.serverLog('warn', `⚠️  Unknown MCP mode '${this.mode}', defaulting to 'tools'`);
      this.mode = 'tools';
    }

    // Initialize authentication manager
    this.authManager = new AuthenticationManager({
      requireAuth: authConfig.requireAuth !== false,
      enableLocalBypass: authConfig.enableLocalBypass !== false,
      developmentMode: authConfig.developmentMode || false,
      masterKey: authConfig.masterKey || null,
      ...authConfig,
    });

    // Initialize tool category manager
    this.toolCategoryManager = new ToolCategoryManager();

    // Initialize connection health monitor
    this.healthMonitor = new ConnectionHealthMonitor();

    // Track client bridge connections (for remote tool execution)
    this.clientBridges = new Map();

    // Multi-window support: Map of windowId → WebSocket client
    this.internalClients = new Map();
    // Legacy single-client reference (for backward compatibility)
    this.internalClient = null;
    this.internalClientId = null;

    // Per-session default-window pins: Map of clientId → windowId. Set by
    // switch_active_window so an external client's later un-addressed calls
    // target a chosen window without depending on global OS focus.
    this.sessionWindowPins = new Map();
    // Last window explicitly activated via switch_active_window. Used as a
    // last-resort disambiguator when no windowId is passed, no per-session pin
    // applies, and no genome window is OS-focused (e.g. background automation).
    this.activeWindowId = null;

    // Multi-window support: Map of windowId → BrowserWindow (for IPC routing)
    // This is also used as a local cache; the authoritative registry is in main.js
    this.windowRegistry = new Map();
    // Reference to the authoritative windowRegistry in main.js (set via setMainWindowRegistry)
    this.mainWindowRegistry = null;

    // Connection state tracking
    this.isInitialized = false;
    this.clientInfo = null;
    this.protocolVersion = '2024-11-05';

    // Initialize tools integrator
    this.toolsIntegrator = new ToolsIntegrator(this);

    // Create MCP Server with proper server info
    this.mcpServer = new Server(
      {
        name: 'codexomics',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {
            listChanged: true,
          },
          logging: {},
        },
      }
    );

    // Express app for SSE transport
    this.app = express();
    this.httpServer = null;

    // WebSocket server for legacy support
    this.wsServer = null;
    this.wsConnections = new Set();

    this.setupMCPServer();
    this.setupExpressApp();
    this.setupWebSocketServer();
    this.setupIPCCommunication();
    this.setupErrorHandling();
  }

  /**
   * Central logging method - emits 'log' event and calls console.log.
   * Replaces direct console.log calls throughout the server.
   * In standalone mode (npm start), emit is a no-op since no one listens.
   * In-app mode, main.js captures events and forwards to MCP Server Manager.
   * @param {'debug'|'info'|'warn'|'error'} level
   * @param {string} message
   * @param {Object} [data] Optional structured data
   */
  serverLog(level, message, data = null) {
    // Always log to console (backward compatible for npm/standalone mode)
    const prefix = { debug: '🔍', info: 'ℹ️', warn: '⚠️', error: '❌' }[level] || '';
    if (data) {
      console.log(`${prefix} ${message}`, typeof data === 'object' ? JSON.stringify(data) : data);
    } else {
      console.log(`${prefix} ${message}`);
    }

    // Emit event for main process to capture
    this.emit('log', { level, message, data, timestamp: Date.now() });
  }

  formatToolResultContent(toolName, result) {
    const content = [
      {
        type: 'text',
        text: JSON.stringify(this.redactImageData(result), null, 2),
      },
    ];

    if (toolName === 'capture_screenshot') {
      content.push(...this.extractScreenshotImageContent(result));
    }

    return content;
  }

  extractScreenshotImageContent(result) {
    const payloads = [];
    const seen = new Set();

    const collect = value => {
      if (!value || typeof value !== 'object' || seen.has(value)) return;
      seen.add(value);

      if (typeof value.imageData === 'string' && value.imageData.length > 0) {
        payloads.push(value);
      }

      if (value.result && typeof value.result === 'object') {
        collect(value.result);
      }

      if (Array.isArray(value.tracks)) {
        value.tracks.forEach(track => collect(track));
      }
    };

    collect(result);

    return payloads.map(payload => ({
      type: 'image',
      data: payload.imageData,
      mimeType: payload.mimeType || this.getMimeTypeFromScreenshotFormat(payload.format),
    }));
  }

  getMimeTypeFromScreenshotFormat(format) {
    const normalized = String(format || 'png').toLowerCase();
    return normalized === 'jpeg' || normalized === 'jpg' ? 'image/jpeg' : 'image/png';
  }

  redactImageData(value, seen = new WeakSet()) {
    if (value === null || typeof value !== 'object') {
      return value;
    }

    if (seen.has(value)) {
      return '[circular]';
    }
    seen.add(value);

    if (Array.isArray(value)) {
      return value.map(item => this.redactImageData(item, seen));
    }

    const result = {};
    for (const [key, child] of Object.entries(value)) {
      if (key === 'imageData' || key === 'imageDataUrl' || key === 'imageDataURL') {
        result[key] = typeof child === 'string' ? `[base64 image data omitted: ${child.length} chars]` : '[omitted]';
        continue;
      }
      if (key === 'data' && value.type === 'image' && typeof child === 'string') {
        result[key] = `[base64 image data omitted: ${child.length} chars]`;
        continue;
      }
      result[key] = this.redactImageData(child, seen);
    }
    return result;
  }

  setupMCPServer() {
    this.serverLog('info', '🔧 Setting up MCP Server handlers');

    // Handle initialization
    this.mcpServer.setRequestHandler(InitializeRequestSchema, async request => {
      this.serverLog('info', '🔄 Handling initialize request');
      this.serverLog('info', '📥 Client info:', JSON.stringify(request.params?.clientInfo, null, 2));
      this.serverLog('info', '📥 Protocol version:', request.params?.protocolVersion);

      this.clientInfo = request.params?.clientInfo;
      this.protocolVersion = request.params?.protocolVersion || '2024-11-05';

      const tools = this.toolsIntegrator.getAvailableTools();
      this.serverLog('info', `📊 Server has ${tools.length} tools available`);

      const response = {
        protocolVersion: this.protocolVersion,
        capabilities: {
          tools: {
            listChanged: true,
          },
          logging: {},
          agent: {
            supported: true,
            modes: ['tools-only', 'single-agent', 'multi-agent'],
            defaultMode: this.mode === 'agent' ? 'single-agent' : 'tools-only',
            currentMode: this.mode,
          },
        },
        serverInfo: {
          name: 'codexomics',
          version: '1.0.0',
          description: `CodeXomics MCP Server (${this.mode} mode) with ${tools.length} genomics tools + AI agent capabilities`,
        },
        instructions: this.getServerInstructions(),
      };

      this.serverLog('info', '✅ Initialize response:', JSON.stringify(response, null, 2));
      return response;
    });

    // Handle initialized notification
    this.mcpServer.setNotificationHandler(InitializedNotificationSchema, async notification => {
      this.serverLog('info', '✅ Received initialized notification');
      this.isInitialized = true;
      this.serverLog('info', '🎯 MCP Server is now fully initialized and ready');
    });

    // Handle list tools
    this.mcpServer.setRequestHandler(ListToolsRequestSchema, async request => {
      this.serverLog('info', '📋 Handling tools/list request');

      if (!this.isInitialized) {
        this.serverLog('warn', '⚠️  Tools list requested before initialization complete');
      }

      const tools = this.toolsIntegrator.getAvailableTools();
      this.serverLog('info', `✅ Returning ${tools.length} tools`);

      return {
        tools: tools,
      };
    });

    // Handle tool execution
    this.mcpServer.setRequestHandler(CallToolRequestSchema, async request => {
      const { name: toolName, arguments: args } = request.params;
      this.serverLog('info', `🔧 Executing tool: ${toolName}`, JSON.stringify(args, null, 2));

      const startTime = Date.now();

      try {
        // Agent mode: intercept all tool calls and route through the agent
        if (this.mode === 'agent' && toolName !== 'codexomics_chat') {
          this.serverLog('info', `🤖 [Agent Mode] Routing tool '${toolName}' through agent`);
          // In agent mode, we still execute individual tools, but also send
          // logging notifications to inform the MCP client about the execution flow
          this._notifyClient('info', `Executing tool: ${toolName}`);
        }

        // Execute tool with 30 second timeout (extended to 120s for agent mode)
        const timeout = this.mode === 'agent' ? 120000 : 30000;
        const result = await Promise.race([
          this.toolsIntegrator.executeTool(toolName, args, args?.clientId),
          new Promise((_, reject) => {
            setTimeout(() => {
              reject(new Error(`Tool execution timeout after ${timeout / 1000} seconds`));
            }, timeout);
          }),
        ]);

        const executionTime = Date.now() - startTime;
        this.serverLog('info', `✅ Tool ${toolName} executed successfully in ${executionTime}ms`);

        // In agent mode, notify client about completion
        if (this.mode === 'agent' && toolName !== 'codexomics_chat') {
          this._notifyClient('info', `Tool ${toolName} completed in ${executionTime}ms`);
        }

        return {
          content: this.formatToolResultContent(toolName, result),
        };
      } catch (error) {
        this.serverLog('error', `❌ Tool ${toolName} execution failed:`, error);

        return {
          content: [
            {
              type: 'text',
              text: `Error executing tool ${toolName}: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });

    // Handle ping requests
    this.mcpServer.setRequestHandler(PingRequestSchema, async request => {
      this.serverLog('info', '🏓 Handling ping request');
      return {
        status: 'pong',
        timestamp: Date.now(),
        serverReady: this.isInitialized,
        mainWindowReady: !!(this.mainWindow && !this.mainWindow.isDestroyed()),
      };
    });

    // Connection event handlers
    this.mcpServer.onclose = () => {
      this.serverLog('info', '🔌 MCP Server connection closed');
      this.isInitialized = false;
    };

    this.mcpServer.onerror = error => {
      this.serverLog('error', '❌ MCP Server error:', error);
    };

    this.serverLog('info', '✅ MCP Server handlers configured');
  }

  setupExpressApp() {
    this.serverLog('info', '🌐 Setting up Express app');

    // Basic middleware
    this.app.use(
      cors({
        origin: process.env.CODEXOMICS_MCP_ALLOWED_ORIGIN || 'http://localhost',
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Cache-Control', 'Authorization'],
      })
    );

    this.app.use(express.json({ limit: DEFAULT_MCP_JSON_PAYLOAD_LIMIT }));

    // Authentication middleware for protected endpoints
    this.authMiddleware = (req, res, next) => {
      // Health check endpoint is always public
      if (req.path === '/health' || req.path === '/mcp') {
        return next();
      }

      const authResult = this.authManager.authenticateRequest(req);

      if (!authResult.valid) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: authResult.error || 'Invalid or missing authentication',
        });
      }

      // Attach session to request
      req.mcpSession = authResult;
      next();
    };

    // Request logging
    this.app.use((req, res, next) => {
      this.serverLog('info', `📥 ${req.method} ${req.path}`);
      if (req.method === 'POST') {
        const { authorization: _authorization, cookie: _cookie, ...safeHeaders } = req.headers;
        this.serverLog('info', `📦 POST Headers:`, safeHeaders);
      }
      next();
    });

    // Health check endpoint (public)
    this.app.get('/health', (req, res) => {
      const systemHealth = this.healthMonitor.getSystemHealth();

      res.json({
        status: systemHealth.status,
        serverReady: this.isInitialized,
        mainWindowReady: !!(this.mainWindow && !this.mainWindow.isDestroyed()),
        hasClientBridge: this.clientBridges.size > 0,
        connections: systemHealth.connections,
        protocolVersion: this.protocolVersion,
        uptime: systemHealth.uptime,
        metrics: systemHealth.metrics,
        timestamp: Date.now(),
      });
    });

    // Server info endpoint (public)
    this.app.get('/mcp', (req, res) => {
      const tools = this.toolsIntegrator.getAvailableTools();
      const categorized = this.toolCategoryManager.categorizeTools(tools);
      const authStats = this.authManager.getStatistics();

      res.json({
        name: 'codexomics',
        version: '1.0.0',
        description: 'CodeXomics MCP Server - Remote Bioinformatics Tool Access',
        protocolVersion: this.protocolVersion,
        capabilities: {
          tools: true,
          logging: true,
          authentication: this.authManager.config.requireAuth,
          clientBridge: this.clientBridges.size > 0,
        },
        toolCount: tools.length,
        toolCategories: {
          serverSide: categorized.serverOnly.length,
          clientSide: categorized.clientOnly.length,
          hybrid: categorized.hybrid.length,
        },
        transport: {
          sse: `http://localhost:${this.httpPort}/sse`,
          websocket: `ws://localhost:${this.wsPort}`,
          clientBridge: `http://localhost:${this.httpPort}/bridge`,
        },
        authentication: {
          required: this.authManager.config.requireAuth,
          localBypass: this.authManager.config.enableLocalBypass,
          activeSessions: authStats.activeSessions,
        },
        status: this.isInitialized ? 'ready' : 'initializing',
      });
    });

    // SSE endpoint for MCP Client
    this.app.get('/sse', this.authMiddleware, (req, res) => {
      this.handleSSEConnection(req, res);
    });

    // POST endpoint for MCP clients that use HTTP POST
    this.app.post('/sse', this.authMiddleware, async (req, res) => {
      // Monitor connection events
      req.on('close', () => {
        this.serverLog('info', '🔌 POST request connection closed');
      });
      req.on('error', error => {
        this.serverLog('info', '❌ POST request error:', error);
      });

      await this.handleMCPPostRequest(req, res);
    });

    // Root endpoint for other MCP clients
    this.app.get('/', this.authMiddleware, (req, res) => {
      this.handleSSEConnection(req, res);
    });

    // Client Bridge endpoints - For remote execution of client-side tools
    this.app.post('/bridge/register', this.authMiddleware, (req, res) => {
      this.handleClientBridgeRegistration(req, res);
    });

    this.app.post('/bridge/unregister', this.authMiddleware, (req, res) => {
      this.handleClientBridgeUnregistration(req, res);
    });

    this.app.post('/bridge/execute', this.authMiddleware, async (req, res) => {
      await this.handleClientBridgeExecution(req, res);
    });

    this.app.get('/bridge/status', this.authMiddleware, (req, res) => {
      res.json({
        registered: this.clientBridges.size > 0,
        bridges: Array.from(this.clientBridges.values()).map(b => ({
          id: b.id,
          registeredAt: b.registeredAt,
          lastActivity: b.lastActivity,
          capabilities: b.capabilities,
        })),
      });
    });

    // POST endpoint for root path
    this.app.post('/', this.authMiddleware, async (req, res) => {
      // Monitor connection events
      req.on('close', () => {
        this.serverLog('info', '🔌 POST request connection closed');
      });
      req.on('error', error => {
        this.serverLog('info', '❌ POST request error:', error);
      });

      await this.handleMCPPostRequest(req, res);
    });

    this.serverLog('info', '✅ Express app configured');
  }

  setupWebSocketServer() {
    this.serverLog('info', '🔧 Setting up WebSocket server');

    // Create WebSocket server
    this.wsServer = new WebSocket.Server({
      port: this.wsPort,
      host: process.env.CODEXOMICS_MCP_BIND_HOST || '127.0.0.1',
      perMessageDeflate: false,
      maxPayload: DEFAULT_WS_MAX_PAYLOAD_BYTES,
    });

    this.wsServer.on('connection', (ws, req) => {
      this.serverLog('info', '🔗 New WebSocket connection from:', req.socket.remoteAddress);
      this.emit('client-connected', { type: 'websocket', address: req.socket.remoteAddress });

      // WebSocket connections need to authenticate via first message
      let authenticated = false;
      let sessionId = null;
      let connectionId = null;

      // Set authentication timeout
      const authTimeout = setTimeout(() => {
        if (!authenticated) {
          this.serverLog('info', '❌ WebSocket authentication timeout');
          ws.send(
            JSON.stringify({
              type: 'error',
              error: 'Authentication timeout. Please send auth message within 10 seconds.',
            })
          );
          ws.close(1008, 'Authentication timeout');
        }
      }, 10000);

      // Track connection
      this.wsConnections.add(ws);
      this.serverLog('info', `📊 WebSocket connections: ${this.wsConnections.size}`);

      // Handle messages
      ws.on('message', async data => {
        try {
          const message = JSON.parse(data.toString());

          // Handle authentication message first
          if (!authenticated) {
            // Check for internal client from CodeXomics app (localhost only)
            if (message.type === 'internal-client') {
              const clientIp = req.socket.remoteAddress;
              const isLocalhost = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1';

              if (!isLocalhost) {
                ws.send(
                  JSON.stringify({
                    type: 'error',
                    error: 'Internal client connections only allowed from localhost',
                  })
                );
                ws.close(1008, 'Not localhost');
                return;
              }

              clearTimeout(authTimeout);
              authenticated = true;
              // Use a unique temporary ID if windowId is not yet available to avoid overwriting other connecting windows
              const clientWindowId =
                message.windowId || `pending_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
              sessionId = `internal_${clientWindowId}_${Date.now()}`;
              connectionId = `internal_client_${sessionId}`;

              // Store in multi-client Map keyed by windowId
              this.internalClients.set(clientWindowId, ws);
              ws.windowId = clientWindowId;

              // Also maintain legacy single-client reference (last connected)
              this.internalClient = ws;
              this.internalClientId = connectionId;

              // Register with health monitor
              this.healthMonitor.registerConnection(connectionId, {
                type: 'internal-client',
                ip: clientIp,
                userAgent: 'CodeXomics-App',
                windowId: clientWindowId,
              });

              // Send connection success
              ws.send(
                JSON.stringify({
                  type: 'internal-client-connected',
                  sessionId,
                  serverId: 'unified-claude-mcp',
                  capabilities: ['tools', 'logging'],
                  windowId: clientWindowId,
                })
              );

              this.serverLog(
                'info',
                `✅ Internal CodeXomics client connected: ${connectionId} (windowId: ${clientWindowId})`
              );
              this.emit('client-connected', { type: 'internal', connectionId, windowId: clientWindowId });
              return;
            }

            if (message.type === 'authenticate') {
              clearTimeout(authTimeout);

              const apiKey = message.apiKey || message.headers?.Authorization;

              if (!apiKey) {
                ws.send(
                  JSON.stringify({
                    type: 'error',
                    error: 'Missing API key in authentication message',
                  })
                );
                ws.close(1008, 'Missing API key');
                return;
              }

              // Validate API key
              const authResult = this.authManager.validateApiKey(apiKey, {
                type: 'websocket',
                ip: req.socket.remoteAddress,
                userAgent: req.headers['user-agent'],
              });

              if (!authResult.valid) {
                ws.send(
                  JSON.stringify({
                    type: 'error',
                    error: authResult.error || 'Authentication failed',
                  })
                );
                ws.close(1008, 'Authentication failed');
                return;
              }

              authenticated = true;
              sessionId = authResult.sessionId;
              connectionId = `ws_${sessionId}`;

              // Register with health monitor
              this.healthMonitor.registerConnection(connectionId, {
                type: 'websocket',
                ip: req.socket.remoteAddress,
                userAgent: req.headers['user-agent'],
                sessionId,
              });

              // Send authentication success
              ws.send(
                JSON.stringify({
                  type: 'authenticated',
                  sessionId,
                  serverId: 'unified-claude-mcp',
                  capabilities: ['tools', 'logging'],
                  expiresAt: authResult.expiresAt,
                })
              );

              this.serverLog('info', `✅ WebSocket authenticated: ${connectionId}`);
              return;
            } else {
              ws.send(
                JSON.stringify({
                  type: 'error',
                  error: 'Please authenticate first',
                })
              );
              return;
            }
          }

          // Update activity
          this.healthMonitor.updateActivity(connectionId);

          // Handle late re-identification for multi-window support (when windowId is assigned via IPC)
          if (authenticated && message.type === 'internal-client') {
            const newWindowId = message.windowId;
            if (newWindowId && ws.windowId !== newWindowId) {
              this.serverLog(
                'info',
                `[MCP Server] Internal client re-identified from ${ws.windowId} to ${newWindowId}`
              );

              // Remove old mapping if it was pointing to this exact websocket
              if (ws.windowId && this.internalClients.get(ws.windowId) === ws) {
                this.internalClients.delete(ws.windowId);
              }

              // Set new mapping
              this.internalClients.set(newWindowId, ws);
              ws.windowId = newWindowId;

              // Update legacy tracking reference if applicable
              if (this.internalClient === ws) {
                this.internalClientId = `internal_client_${newWindowId}`;
              }
            }
            return; // Don't process this message further
          }

          // Handle tool execution results from internal client
          if (message.type === 'tool-execution-result') {
            const { requestId, result, error } = message;
            const pending = this.pendingRequests.get(requestId);

            if (pending) {
              clearTimeout(pending.timeout);
              this.pendingRequests.delete(requestId);

              if (error) {
                this.serverLog('info', `❌ Tool execution failed via internal client: ${pending.toolName}`, error);
                pending.reject(new Error(error));
              } else {
                this.serverLog('info', `✅ Tool execution completed via internal client: ${pending.toolName}`);
                pending.resolve(result);
              }
            } else {
              this.serverLog('warn', `⚠️ Received tool result for unknown requestId: ${requestId}`);
            }
            return; // Don't process further
          }

          // Handle simple ping messages from internal client to keep connection alive
          if (message.type === 'ping') {
            // Already updated activity via this.healthMonitor.updateActivity(connectionId)
            ws.send(JSON.stringify({ type: 'pong' }));
            return;
          }

          // Handle genome loaded updates from internal client
          if (message.type === 'genome-loaded') {
            this.serverLog(
              'info',
              `[MCP Server] Client ${ws.windowId || connectionId} loaded genome: ${message.genomeName}`
            );
            ws.genomeName = message.genomeName;
            return;
          }

          this.serverLog('info', '📥 WebSocket message:', message);

          // Handle MCP-style messages
          const response = await this.handleWebSocketMessage(message, sessionId);
          if (response) {
            ws.send(JSON.stringify(response));
          }
        } catch (error) {
          this.serverLog('error', '❌ WebSocket message error:', error);
          ws.send(
            JSON.stringify({
              jsonrpc: '2.0',
              error: {
                code: -32700,
                message: 'Parse error',
                data: error.message,
              },
              id: null,
            })
          );
        }
      });

      // Handle connection close
      ws.on('close', () => {
        this.serverLog('info', '🔌 WebSocket connection closed');
        this.wsConnections.delete(ws);
        this.emit('client-disconnected', { type: 'websocket' });

        // Clean up internal client reference if this was the internal client
        if (ws.windowId && this.internalClients.get(ws.windowId) === ws) {
          this.serverLog('info', `🔌 Internal CodeXomics client disconnected (windowId: ${ws.windowId})`);
          this.emit('client-disconnected', { type: 'internal', windowId: ws.windowId });
          this.internalClients.delete(ws.windowId);
          this.clearSessionWindowPinsForWindow(ws.windowId);
        }
        if (this.internalClient === ws) {
          this.internalClient = null;
          this.internalClientId = null;
          // Promote another internal client as the legacy default if available
          if (this.internalClients.size > 0) {
            const [firstWindowId, firstWs] = this.internalClients.entries().next().value;
            this.internalClient = firstWs;
            this.internalClientId = `internal_client_${firstWindowId}`;
          }
        }

        if (connectionId) {
          this.healthMonitor.unregisterConnection(connectionId);
        }

        this.serverLog('info', `📊 WebSocket connections: ${this.wsConnections.size}`);
      });

      // Handle errors
      ws.on('error', error => {
        this.serverLog('error', '❌ WebSocket error:', error);
        this.wsConnections.delete(ws);

        if (connectionId) {
          this.healthMonitor.unregisterConnection(connectionId);
        }
      });

      // Send initial connection confirmation
      ws.send(
        JSON.stringify({
          type: 'connection',
          status: 'connected',
          serverId: 'unified-claude-mcp',
          capabilities: ['tools', 'logging'],
        })
      );
    });

    this.wsServer.on('error', error => {
      this.serverLog('error', '❌ WebSocket server error:', error);
      // If the error is port conflict, emit a specific event so the caller can handle it
      if (error.code === 'EADDRINUSE') {
        this._wsPortError = error;
      }
    });

    this.serverLog('info', '✅ WebSocket server configured');
  }

  async handleWebSocketMessage(message, sessionId) {
    const { method, params, id } = message;

    // Validate session
    const sessionValidation = this.authManager.validateSession(sessionId);
    if (!sessionValidation.valid) {
      return {
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: sessionValidation.error || 'Invalid session',
        },
        id,
      };
    }

    // Handle different message types
    switch (method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          result: {
            protocolVersion: this.protocolVersion,
            capabilities: {
              tools: { listChanged: true },
              logging: {},
            },
            serverInfo: {
              name: 'codexomics',
              version: '1.0.0',
            },
            instructions: this.getServerInstructions(),
          },
          id,
        };

      case 'tools/list': {
        const tools = this.toolsIntegrator.getAvailableTools();
        return {
          jsonrpc: '2.0',
          result: { tools },
          id,
        };
      }

      case 'tools/call':
        try {
          const result = await this.toolsIntegrator.executeTool(
            params.name,
            params.arguments,
            params.arguments?.clientId
          );
          return {
            jsonrpc: '2.0',
            result: {
              content: this.formatToolResultContent(params.name, result),
            },
            id,
          };
        } catch (error) {
          return {
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: error.message,
            },
            id,
          };
        }

      default:
        return {
          jsonrpc: '2.0',
          error: {
            code: -32601,
            message: `Method not found: ${method}`,
          },
          id,
        };
    }
  }

  handleSSEConnection(req, res) {
    this.serverLog('info', '🔄 New SSE connection request');

    try {
      // Create connection ID
      const connectionId = `sse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const sessionId = req.mcpSession?.sessionId;

      // Set CORS headers before creating transport
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Cache-Control, Authorization');

      // Register with health monitor
      this.healthMonitor.registerConnection(connectionId, {
        type: 'sse',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        sessionId,
      });

      // Create SSE transport - this will handle setting SSE headers
      const transport = new SSEServerTransport('/sse', res);

      // Track connection
      this.activeConnections.add(transport);
      this.serverLog('info', `📊 Active connections: ${this.activeConnections.size}`);

      // Connect MCP server to transport
      this.mcpServer.connect(transport);
      this.serverLog('info', '✅ SSE connection established and MCP server connected');

      // Handle connection events
      req.on('close', () => {
        this.serverLog('info', '🔌 SSE connection closed by client');
        this.activeConnections.delete(transport);
        this.healthMonitor.unregisterConnection(connectionId);
        this.serverLog('info', `📊 Active connections: ${this.activeConnections.size}`);
      });

      req.on('error', error => {
        this.serverLog('error', '❌ SSE connection error:', error);
        this.activeConnections.delete(transport);
        this.healthMonitor.unregisterConnection(connectionId);
      });

      res.on('error', error => {
        this.serverLog('error', '❌ SSE response error:', error);
        this.activeConnections.delete(transport);
        this.healthMonitor.unregisterConnection(connectionId);
      });

      res.on('close', () => {
        this.serverLog('info', '🔌 SSE response closed');
        this.activeConnections.delete(transport);
        this.healthMonitor.unregisterConnection(connectionId);
      });
    } catch (error) {
      this.serverLog('error', '❌ Failed to establish SSE connection:', error);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Failed to establish SSE connection',
          message: error.message,
        });
      }
    }
  }

  async handleMCPPostRequest(req, res) {
    const startTime = Date.now();
    this.serverLog('info', '📮 Received POST request:', req.path);
    this.serverLog('info', '📦 Request body:', JSON.stringify(req.body, null, 2));
    this.serverLog('info', '🔗 Client connection info:', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      connection: req.get('Connection'),
      contentLength: req.get('Content-Length'),
    });

    try {
      // Set CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control');
      res.setHeader('Content-Type', 'application/json');

      const request = req.body;
      const { method, params, id, jsonrpc } = request;

      // Validate JSON-RPC format
      if (jsonrpc !== '2.0') {
        return res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32600,
            message: 'Invalid Request - missing or invalid jsonrpc field',
          },
          id: id || null,
        });
      }

      if (!method) {
        return res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32600,
            message: 'Invalid Request - missing method field',
          },
          id: id || null,
        });
      }

      this.serverLog('info', `🔧 Processing MCP method: ${method}`);

      let response;

      switch (method) {
        case 'initialize': {
          this.serverLog('info', '🔄 Handling initialize request');
          this.clientInfo = params?.clientInfo;
          this.protocolVersion = params?.protocolVersion || '2024-11-05';

          const tools = this.toolsIntegrator.getAvailableTools();
          this.serverLog('info', `📊 Server has ${tools.length} tools available`);

          response = {
            jsonrpc: '2.0',
            result: {
              protocolVersion: this.protocolVersion,
              capabilities: {
                tools: {
                  listChanged: true,
                },
                logging: {},
              },
              serverInfo: {
                name: 'codexomics',
                version: '1.0.0',
                description: `CodeXomics MCP Server with ${tools.length} genomics tools`,
              },
              instructions: this.getServerInstructions(),
            },
            id,
          };
          break;
        }

        case 'initialized':
          this.serverLog('info', '✅ Handling initialized notification');
          this.isInitialized = true;
          // Notifications don't need responses
          return res.status(204).send();

        case 'tools/list': {
          this.serverLog('info', '📋 Handling tools/list request');
          const availableTools = this.toolsIntegrator.getAvailableTools();
          response = {
            jsonrpc: '2.0',
            result: {
              tools: availableTools,
            },
            id,
          };
          break;
        }

        case 'tools/call': {
          this.serverLog('info', '🔧 Handling tools/call request');
          const { name: toolName, arguments: args } = params;
          const startTime = Date.now();

          try {
            const result = await Promise.race([
              this.toolsIntegrator.executeTool(toolName, args, args?.clientId),
              new Promise((_, reject) => {
                setTimeout(() => {
                  reject(new Error(`Tool execution timeout after 30 seconds`));
                }, 30000);
              }),
            ]);

            const executionTime = Date.now() - startTime;
            this.serverLog('info', `✅ Tool ${toolName} executed in ${executionTime}ms`);

            response = {
              jsonrpc: '2.0',
              result: {
                content: this.formatToolResultContent(toolName, result),
              },
              id,
            };
          } catch (error) {
            this.serverLog('error', `❌ Tool ${toolName} failed:`, error);
            response = {
              jsonrpc: '2.0',
              result: {
                content: [
                  {
                    type: 'text',
                    text: `Error executing tool ${toolName}: ${error.message}`,
                  },
                ],
                isError: true,
              },
              id,
            };
          }
          break;
        }

        case 'ping':
          this.serverLog('info', '🏓 Handling ping request');
          response = {
            jsonrpc: '2.0',
            result: {
              status: 'pong',
              timestamp: Date.now(),
              serverReady: this.isInitialized,
              mainWindowReady: !!(this.mainWindow && !this.mainWindow.isDestroyed()),
            },
            id,
          };
          break;

        default:
          this.serverLog('info', `❓ Unknown method: ${method}`);
          response = {
            jsonrpc: '2.0',
            error: {
              code: -32601,
              message: `Method not found: ${method}`,
            },
            id,
          };
          break;
      }

      this.serverLog('info', '✅ Sending response:', JSON.stringify(this.redactImageData(response), null, 2));
      this.serverLog('info', '📡 Response headers being sent:', res.getHeaders());

      // Ensure response is sent properly
      res.json(response);

      // Ensure response is flushed
      if (res.flush) {
        res.flush();
      }

      this.serverLog('info', '📤 Response sent to client');
      this.serverLog('info', `⏱️  Total request processing time: ${Date.now() - startTime}ms`);
    } catch (error) {
      this.serverLog('error', '❌ POST request error:', error);
      const errorResponse = {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal error',
          data: error.message,
        },
        id: req.body?.id || null,
      };
      res.status(500).json(errorResponse);
    }
  }

  setupIPCCommunication() {
    if (!this.mainWindow) {
      this.serverLog('info', 'ℹ️  Running in standalone mode (no Electron main window)');
      this.serverLog('info', '   CodeXomics app can connect via WebSocket at ws://localhost:' + this.wsPort);
      return;
    }

    this.serverLog('info', '🔧 Setting up IPC communication');

    const { ipcMain } = require('electron');

    // Listen for tool responses
    ipcMain.on('mcp-tool-response', (event, response) => {
      this.handleToolResponse(response);
    });

    // Listen for server status updates
    ipcMain.on('internal-mcp-server-ready', () => {
      this.serverLog('info', '✅ Internal MCP Server is ready');
    });

    ipcMain.on('internal-mcp-server-stopped', () => {
      this.serverLog('info', '🛑 Internal MCP Server stopped');
    });

    // Listen for agent progress notifications from renderer process
    // These are forwarded to MCP clients via sendLoggingMessage
    ipcMain.on('mcp-agent-progress', (event, progress) => {
      this.sendAgentProgress(progress);
    });

    this.serverLog('info', '✅ IPC communication configured');
  }

  handleToolResponse(response) {
    const { requestId, success, result, error } = response;

    const pendingRequest = this.pendingRequests.get(requestId);
    if (!pendingRequest) {
      this.serverLog('warn', `❓ Received response for unknown request ID: ${requestId}`);
      return;
    }

    clearTimeout(pendingRequest.timeout);
    this.pendingRequests.delete(requestId);

    if (success) {
      pendingRequest.resolve(result);
    } else {
      pendingRequest.reject(new Error(error || 'Unknown tool execution error'));
    }
  }

  async executeToolOnClient(toolName, parameters, clientId) {
    // Check if this tool requires client-side execution
    const validation = this.toolCategoryManager.validateExecution(
      toolName,
      this.mainWindow || this.internalClients.size > 0 || this.clientBridges.size > 0
    );

    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Determine target windowId from parameters (Option C: default focused, optional override)
    let targetWindowId = parameters?.windowId || null;
    // Remove windowId from parameters before forwarding to avoid confusing tool handlers
    if (parameters?.windowId) {
      parameters = { ...parameters };
      delete parameters.windowId;
    }

    // If the client didn't address a window explicitly, fall back to its
    // per-session pin (set via switch_active_window) before resorting to focus.
    if (!targetWindowId && clientId) {
      const pinned = this.getSessionWindowPin(clientId);
      if (pinned) targetWindowId = pinned;
    }

    // Try WebSocket internal client first (multi-window aware)
    if (this.internalClients.size > 0) {
      return await this.executeViaInternalClient(toolName, parameters, clientId, targetWindowId);
    }

    // Try local Electron IPC if available (multi-window aware)
    if (this.windowRegistry.size > 0) {
      return await this.executeViaElectronIPC(toolName, parameters, clientId, targetWindowId);
    }

    // Legacy: single mainWindow fallback. Preserve any explicit windowId the
    // client passed instead of silently dropping it (previously forced to null).
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      return await this.executeViaElectronIPC(toolName, parameters, clientId, targetWindowId);
    }

    // Try client bridge if available
    if (this.clientBridges.size > 0) {
      return await this.executeViaClientBridge(toolName, parameters, clientId);
    }

    throw new Error(
      `Tool '${toolName}' requires a connected CodeXomics client. ` +
        `No local client, internal WebSocket client, or remote bridge available. ` +
        `Please start CodeXomics application to enable this tool.`
    );
  }

  async executeViaInternalClient(toolName, parameters, clientId, targetWindowId) {
    // Resolve the target WS client deterministically. This throws a loud,
    // actionable error for the dangerous case (multiple genome windows open,
    // none focused, no explicit windowId) instead of silently picking one.
    const { client: targetClient, windowId: resolvedWindowId } = this.resolveInternalClientTarget(
      toolName,
      targetWindowId
    );

    if (!targetClient || targetClient.readyState !== 1) {
      throw new Error(
        `No active WebSocket client for window '${targetWindowId || 'focused'}'. ` +
          `Available windows: [${this.describeInternalWindows()}]`
      );
    }

    const genomeName = targetClient.genomeName || null;
    const requestId = `mcp_ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Convert snake_case tool name to camelCase method name
    const methodName = toolName.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Tool execution timeout for ${toolName} via internal client (window: ${resolvedWindowId})`));
      }, 30000);

      this.pendingRequests.set(requestId, {
        // Echo the resolved window/genome on every result so clients can detect
        // and self-correct if a call landed on a different genome than intended.
        resolve: result => resolve(this._attachRoutingMeta(result, resolvedWindowId, genomeName)),
        reject,
        timeout,
        toolName,
        parameters,
      });

      // Send tool execution request via WebSocket to target window's client
      this.serverLog(
        'info',
        `📡 [MCP Server] Sending tool execution via WebSocket: ${toolName} -> ${methodName} (window: ${resolvedWindowId})`
      );
      targetClient.send(
        JSON.stringify({
          type: 'tool-execution',
          requestId,
          method: methodName,
          toolName,
          parameters,
          clientId,
        })
      );
    });
  }

  async executeViaElectronIPC(toolName, parameters, clientId, targetWindowId) {
    // Resolve the target BrowserWindow deterministically. Like the WS path, this
    // fails loudly when the target is ambiguous instead of silently picking the
    // "first available" window (the previous silent wrong-genome hazard).
    const {
      window: targetWindow,
      windowId: resolvedWindowId,
      genomeName,
    } = this.resolveElectronTarget(toolName, targetWindowId);
    targetWindowId = resolvedWindowId;

    if (!targetWindow || targetWindow.isDestroyed()) {
      throw new Error(
        `No active window for '${targetWindowId || 'focused'}'. Available: [${Array.from(this.windowRegistry.keys()).join(', ')}]`
      );
    }

    const requestId = `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Convert snake_case tool name to camelCase method name
    const methodName = toolName.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Tool execution timeout for ${toolName} (window: ${targetWindowId})`));
      }, 30000);

      this.pendingRequests.set(requestId, {
        // Echo the resolved window/genome on every result (see WS path).
        resolve: result => resolve(this._attachRoutingMeta(result, resolvedWindowId, genomeName)),
        reject,
        timeout,
        toolName,
        parameters,
      });

      // Send tool execution request to renderer process via IPC
      this.serverLog(
        'info',
        `📡 [MCP Server] Sending tool execution via Electron IPC: ${toolName} -> ${methodName} (window: ${targetWindowId})`
      );
      targetWindow.webContents.send('mcp-tool-call', {
        requestId,
        method: methodName,
        parameters,
        clientId,
      });
    });
  }

  async executeViaClientBridge(toolName, parameters, clientId) {
    // Get first available bridge (TODO: implement bridge selection strategy)
    const bridge = Array.from(this.clientBridges.values())[0];

    if (!bridge) {
      throw new Error('No client bridge available');
    }

    const requestId = `bridge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        bridge.pendingRequests.delete(requestId);
        reject(new Error(`Bridge tool execution timeout for ${toolName}`));
      }, 30000);

      bridge.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeout,
      });

      // Send execution request to bridge
      this.serverLog('info', `📡 [MCP Server] Sending tool execution via Bridge: ${toolName}`);

      // The bridge client will poll for pending requests
      bridge.lastActivity = Date.now();
    });
  }

  handleClientBridgeRegistration(req, res) {
    const { bridgeId, capabilities } = req.body;

    if (!bridgeId) {
      return res.status(400).json({
        success: false,
        error: 'Bridge ID required',
      });
    }

    const bridge = {
      id: bridgeId,
      sessionId: req.mcpSession.sessionId,
      registeredAt: Date.now(),
      lastActivity: Date.now(),
      capabilities: capabilities || [],
      pendingRequests: new Map(),
      responseQueue: [],
    };

    this.clientBridges.set(bridgeId, bridge);

    this.serverLog('info', `✅ Client bridge registered: ${bridgeId}`);

    res.json({
      success: true,
      bridgeId,
      message: 'Bridge registered successfully',
    });
  }

  handleClientBridgeUnregistration(req, res) {
    const { bridgeId } = req.body;

    if (this.clientBridges.delete(bridgeId)) {
      this.serverLog('info', `🔌 Client bridge unregistered: ${bridgeId}`);

      res.json({
        success: true,
        message: 'Bridge unregistered successfully',
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Bridge not found',
      });
    }
  }

  async handleClientBridgeExecution(req, res) {
    const { bridgeId, requestId, result, error } = req.body;

    const bridge = this.clientBridges.get(bridgeId);

    if (!bridge) {
      return res.status(404).json({
        success: false,
        error: 'Bridge not found',
      });
    }

    bridge.lastActivity = Date.now();

    // If this is a response to a pending request
    if (requestId) {
      const pendingRequest = bridge.pendingRequests.get(requestId);

      if (pendingRequest) {
        clearTimeout(pendingRequest.timeout);
        bridge.pendingRequests.delete(requestId);

        if (error) {
          pendingRequest.reject(new Error(error));
        } else {
          pendingRequest.resolve(result);
        }
      }

      return res.json({
        success: true,
        message: 'Response recorded',
      });
    }

    // Return any pending execution requests for this bridge
    const pending = Array.from(bridge.pendingRequests.entries()).map(([id, req]) => ({
      requestId: id,
      toolName: req.toolName,
      parameters: req.parameters,
    }));

    res.json({
      success: true,
      pendingRequests: pending,
    });
  }

  setupErrorHandling() {
    process.on('SIGINT', async () => {
      this.serverLog('info', '🛑 Received SIGINT, shutting down gracefully');
      await this.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      this.serverLog('info', '🛑 Received SIGTERM, shutting down gracefully');
      await this.stop();
      process.exit(0);
    });

    process.on('uncaughtException', error => {
      // Don't crash on EADDRINUSE - it will be caught by the start() method
      if (error.code === 'EADDRINUSE') {
        this.serverLog('error', `❌ Port already in use: ${error.port || 'unknown'} (${error.syscall || 'unknown'})`);
        return;
      }
      this.serverLog('error', '💥 Uncaught exception:', error);
      // Only exit in standalone mode
      if (!this.mainWindow) {
        process.exit(1);
      }
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.serverLog('error', '💥 Unhandled rejection at:', promise, 'reason:', reason);
      // Only exit in standalone mode
      if (!this.mainWindow) {
        process.exit(1);
      }
    });
  }

  async start() {
    this.serverLog('info', '🚀 Starting Standard Claude MCP Server');

    // Check if WebSocket server failed to bind during construction
    if (this._wsPortError) {
      const wsError = this._wsPortError;
      this._wsPortError = null;
      const errMsg =
        wsError.code === 'EADDRINUSE'
          ? `WebSocket port ${this.wsPort} is already in use`
          : `Failed to bind WebSocket server on port ${this.wsPort}: ${wsError.message}`;
      this.serverLog('error', `❌ ${errMsg}`);
      this.emit('start-failed', { type: 'ws', port: this.wsPort, error: errMsg });
      throw new Error(errMsg);
    }

    try {
      await new Promise((resolve, reject) => {
        const bindHost = process.env.CODEXOMICS_MCP_BIND_HOST || '127.0.0.1';
        this.httpServer = this.app.listen(this.httpPort, bindHost, error => {
          if (error) {
            if (error.code === 'EADDRINUSE') {
              reject(new Error(`HTTP port ${this.httpPort} is already in use`));
            } else {
              reject(new Error(`Failed to start HTTP server on port ${this.httpPort}: ${error.message}`));
            }
            return;
          }
          resolve();
        });
      });

      // Configure server timeouts
      this.httpServer.keepAliveTimeout = 61000; // 61 seconds
      this.httpServer.headersTimeout = 62000; // 62 seconds
      this.httpServer.timeout = 120000; // 2 minutes

      this.serverLog('info', '✅ Standard Claude MCP Server started successfully');
      this.serverLog('info', `📡 HTTP Server: http://localhost:${this.httpPort}`);
      this.serverLog('info', `🌐 SSE Endpoint: http://localhost:${this.httpPort}/sse`);
      this.serverLog('info', `📋 Server Info: http://localhost:${this.httpPort}/mcp`);
      this.serverLog('info', `🔗 WebSocket Server: ws://localhost:${this.wsPort}`);
      this.serverLog('info', `🔧 IPC Communication: ${!!this.mainWindow}`);
      this.serverLog('info', '');
      this.serverLog('info', '🎯 Ready for MCP Client connections!');
      this.serverLog('info', '');

      // Emit started event
      this.emit('started', { httpPort: this.httpPort, wsPort: this.wsPort });
    } catch (error) {
      this.serverLog('error', `💥 Failed to start server: ${error.message}`);

      // Emit start-failed event so the main process can handle it gracefully
      const portType = error.message.includes('HTTP') ? 'http' : 'ws';
      const port = portType === 'http' ? this.httpPort : this.wsPort;
      this.emit('start-failed', { type: portType, port, error: error.message });

      // In standalone mode (no mainWindow), exit with error
      // In-app mode, throw the error so the caller can handle it
      if (!this.mainWindow) {
        process.exit(1);
      } else {
        throw error;
      }
    }
  }

  async stop() {
    this.serverLog('info', '🛑 Stopping Standard Claude MCP Server');

    try {
      // Cleanup health monitor
      if (this.healthMonitor) {
        this.healthMonitor.destroy();
      }

      // Cleanup authentication manager
      if (this.authManager) {
        this.authManager.destroy();
      }

      // Close all client bridges
      for (const [, bridge] of this.clientBridges.entries()) {
        for (const [, req] of bridge.pendingRequests.entries()) {
          clearTimeout(req.timeout);
          req.reject(new Error('Server stopping'));
        }
      }
      this.clientBridges.clear();
      // Close HTTP server
      if (this.httpServer) {
        await new Promise(resolve => {
          this.httpServer.close(resolve);
        });
      }

      // Close WebSocket server
      if (this.wsServer) {
        // Close all WebSocket connections
        this.wsConnections.forEach(ws => {
          ws.close();
        });
        this.wsConnections.clear();

        // Close WebSocket server
        await new Promise(resolve => {
          this.wsServer.close(resolve);
        });
      }

      // Clear pending requests
      for (const [, pendingRequest] of this.pendingRequests) {
        clearTimeout(pendingRequest.timeout);
        pendingRequest.reject(new Error('Server stopping'));
      }
      this.pendingRequests.clear();

      // Clear active connections
      this.activeConnections.clear();

      this.serverLog('info', '✅ Server stopped successfully');

      // Emit stopped event
      this.emit('stopped');
    } catch (error) {
      this.serverLog('error', '❌ Error stopping server:', error.message);
    }
  }

  // Utility methods

  /**
   * Send a logging notification to the MCP client.
   * Uses MCP SDK's sendLoggingMessage to push real-time progress info.
   * @param {'debug'|'info'|'notice'|'warning'|'error'} level - Log level
   * @param {string} message - Human-readable message
   * @param {Object} [data] - Optional structured data to include
   */
  _notifyClient(level, message, data = null) {
    try {
      if (this.mcpServer && typeof this.mcpServer.sendLoggingMessage === 'function') {
        const params = {
          level,
          logger: 'codexomics-agent',
          data: data ? `${message} | ${JSON.stringify(data)}` : message,
        };
        this.mcpServer.sendLoggingMessage(params).catch(err => {
          // Silently ignore - client may not support logging notifications
          console.debug(`[MCP] Failed to send logging notification: ${err.message}`);
        });
      }
    } catch (e) {
      // Silently ignore - this is best-effort
    }
  }

  /**
   * Send agent progress notification to MCP client.
   * Used by ChatManager during agent-mode execution to push
   * intermediate processing information back to the MCP client.
   *
   * @param {Object} progress - Progress information
   * @param {string} progress.type - Type of progress event
   *   ('thinking', 'tool_call', 'tool_result', 'round_start', 'round_end', 'completion')
   * @param {string} progress.message - Human-readable description
   * @param {Object} [progress.data] - Optional structured data
   */
  sendAgentProgress(progress) {
    const levelMap = {
      thinking: 'info',
      tool_call: 'info',
      tool_result: 'info',
      round_start: 'notice',
      round_end: 'notice',
      completion: 'notice',
      error: 'error',
    };
    const level = levelMap[progress.type] || 'info';
    this._notifyClient(level, `[Agent] ${progress.message}`, progress.data);
  }

  /**
   * Set the MCP server mode at runtime.
   * @param {'tools'|'agent'} mode - The mode to set
   */
  setMode(mode) {
    if (!['tools', 'agent'].includes(mode)) {
      throw new Error(`Invalid mode '${mode}'. Must be 'tools' or 'agent'.`);
    }
    const previousMode = this.mode;
    this.mode = mode;
    this.serverLog('info', `🔄 MCP Server mode changed: ${previousMode} → ${mode}`);

    // Notify client about mode change
    this._notifyClient('notice', `Server mode changed to '${mode}'`, { previousMode, newMode: mode });

    // Notify tools list changed since agent mode affects tool availability
    if (this.mcpServer && typeof this.mcpServer.sendToolListChanged === 'function') {
      this.mcpServer.sendToolListChanged().catch(() => {});
    }
  }

  getStatus() {
    return {
      isInitialized: this.isInitialized,
      mode: this.mode,
      activeConnections: this.activeConnections.size,
      wsConnections: this.wsConnections.size,
      clientBridges: this.clientBridges.size,
      pendingRequests: this.pendingRequests.size,
      mainWindowReady: !!(this.mainWindow && !this.mainWindow.isDestroyed()),
      protocolVersion: this.protocolVersion,
      clientInfo: this.clientInfo,
      systemHealth: this.healthMonitor.getSystemHealth(),
      authenticationEnabled: this.authManager.config.requireAuth,
    };
  }

  getConnectedClientsCount() {
    return this.activeConnections.size + this.wsConnections.size;
  }

  // Multi-window support: Set reference to the authoritative windowRegistry from main.js
  setMainWindowRegistry(registry) {
    this.mainWindowRegistry = registry;
    this.serverLog('info', `📋 [MCP Server] Linked to main window registry (${registry.size} windows)`);
    // Log all windows in the registry
    for (const [windowId, entry] of registry.entries()) {
      const win = entry.window || entry;
      this.serverLog(
        'info',
        `📋 [MCP Server] Registry entry: ${windowId}, has window: ${!!win}, isDestroyed: ${win ? win.isDestroyed() : 'N/A'}`
      );
    }
  }

  // Multi-window support: Register a BrowserWindow for IPC routing
  registerWindow(windowId, browserWindow) {
    this.windowRegistry.set(windowId, { window: browserWindow, genomeName: null });
    this.serverLog('info', `📋 [MCP Server] Registered window: ${windowId} (total: ${this.windowRegistry.size})`);
    this.serverLog(
      'info',
      `📋 [MCP Server] Window isDestroyed: ${browserWindow.isDestroyed()}, mainWindowRegistry: ${this.mainWindowRegistry ? 'set' : 'not set'}`
    );
  }

  // Multi-window support: Unregister a BrowserWindow
  unregisterWindow(windowId) {
    this.windowRegistry.delete(windowId);
    // Also clean up any associated WS client
    if (this.internalClients.has(windowId)) {
      this.internalClients.delete(windowId);
    }
    // Drop any per-session pins that targeted this window.
    this.clearSessionWindowPinsForWindow(windowId);
    this.serverLog('info', `📋 [MCP Server] Unregistered window: ${windowId} (total: ${this.windowRegistry.size})`);
  }

  // Tools that are not bound to a specific genome window. For these, an
  // ambiguous target (multiple windows, none focused) is harmless, so we do not
  // force the caller to pass a windowId.
  isWindowAgnosticTool(toolName) {
    const WINDOW_AGNOSTIC = new Set(['ping', 'list_genome_windows', 'switch_active_window', 'run_on_windows']);
    return WINDOW_AGNOSTIC.has(toolName);
  }

  // Live WebSocket clients (readyState OPEN) across all windows.
  getLiveInternalClients() {
    return Array.from(this.internalClients.values()).filter(ws => ws && ws.readyState === 1);
  }

  // Authoritative window registry — the same source list_genome_windows uses, so
  // focus/targeting decisions stay consistent with what clients are told. In-app
  // the authoritative registry lives in main.js (mainWindowRegistry); the local
  // windowRegistry is only a cache and may be empty.
  getEffectiveWindowRegistry() {
    return this.mainWindowRegistry || this.windowRegistry;
  }

  // Strict focused-window lookup: returns the WS client of the focused genome
  // window, or null. Unlike getFocusedWindowClient() it does NOT fall back to a
  // legacy/first client, so callers can detect "no genome window is focused".
  getFocusedInternalClient() {
    const registry = this.getEffectiveWindowRegistry();
    for (const [windowId, entry] of registry.entries()) {
      const win = entry.window || entry;
      if (win && !win.isDestroyed() && win.isFocused()) {
        const client = this.internalClients.get(windowId);
        if (client && client.readyState === 1) {
          return client;
        }
      }
    }
    return null;
  }

  // Human-readable list of connected windows for error messages.
  describeInternalWindows() {
    return Array.from(this.internalClients.entries())
      .map(([wid, ws]) => `${wid}${ws && ws.genomeName ? ` (${ws.genomeName})` : ''}`)
      .join(', ');
  }

  // Resolve which WS internal client should receive a tool call.
  // Returns { client, windowId }. Throws on an unknown explicit windowId or on
  // an ambiguous default target (the wrong-genome hazard) for genome tools.
  resolveInternalClientTarget(toolName, targetWindowId) {
    if (targetWindowId) {
      if (this.internalClients.has(targetWindowId)) {
        return { client: this.internalClients.get(targetWindowId), windowId: targetWindowId };
      }
      // Explicit but unknown — fail loud rather than silently retargeting.
      throw new Error(
        `Requested windowId '${targetWindowId}' is not a connected CodeXomics window. ` +
          `Available windows: [${this.describeInternalWindows()}]. Call list_genome_windows to refresh.`
      );
    }

    // No explicit target: prefer the focused genome window.
    const focused = this.getFocusedInternalClient();
    if (focused) {
      return { client: focused, windowId: focused.windowId || 'default' };
    }

    // No focused genome window — decide based on how many live clients exist.
    const live = this.getLiveInternalClients();
    if (live.length === 1) {
      return { client: live[0], windowId: live[0].windowId || 'default' };
    }
    if (live.length === 0) {
      if (this.internalClient && this.internalClient.readyState === 1) {
        return { client: this.internalClient, windowId: this.internalClient.windowId || 'default' };
      }
      return { client: null, windowId: targetWindowId || 'focused' };
    }

    // Multiple live windows, none focused, no windowId given.
    if (this.isWindowAgnosticTool(toolName)) {
      return { client: live[0], windowId: live[0].windowId || 'default' };
    }
    // Last resort: the window most recently activated via switch_active_window.
    if (this.activeWindowId && this.internalClients.has(this.activeWindowId)) {
      const c = this.internalClients.get(this.activeWindowId);
      if (c && c.readyState === 1) {
        return { client: c, windowId: this.activeWindowId };
      }
    }
    throw new Error(
      `Ambiguous target: ${live.length} CodeXomics genome windows are open and none is focused. ` +
        `Pass an explicit windowId to target a genome (call list_genome_windows to see options), ` +
        `or call switch_active_window first. Available windows: [${this.describeInternalWindows()}]`
    );
  }

  // Resolve which BrowserWindow should receive a tool call via Electron IPC.
  // Returns { window, windowId, genomeName }. Same ambiguity rules as the WS path.
  resolveElectronTarget(toolName, targetWindowId) {
    const registry = this.getEffectiveWindowRegistry();
    if (targetWindowId) {
      if (registry.has(targetWindowId)) {
        const entry = registry.get(targetWindowId);
        return { window: entry.window || entry, windowId: targetWindowId, genomeName: entry.genomeName || null };
      }
      throw new Error(
        `Requested windowId '${targetWindowId}' is not a registered CodeXomics window. ` +
          `Available: [${Array.from(registry.keys()).join(', ')}]. Call list_genome_windows to refresh.`
      );
    }

    if (registry.size > 0) {
      // Prefer the focused window.
      for (const [wid, entry] of registry.entries()) {
        const win = entry.window || entry;
        if (win && !win.isDestroyed() && win.isFocused()) {
          return { window: win, windowId: wid, genomeName: entry.genomeName || null };
        }
      }
      // No focused window — collect live ones.
      const live = [];
      for (const [wid, entry] of registry.entries()) {
        const win = entry.window || entry;
        if (win && !win.isDestroyed()) live.push([wid, entry, win]);
      }
      if (live.length === 1) {
        const [wid, entry, win] = live[0];
        return { window: win, windowId: wid, genomeName: entry.genomeName || null };
      }
      if (live.length > 1 && !this.isWindowAgnosticTool(toolName)) {
        // Last resort: the window most recently activated via switch_active_window.
        if (this.activeWindowId && registry.has(this.activeWindowId)) {
          const entry = registry.get(this.activeWindowId);
          const win = entry.window || entry;
          if (win && !win.isDestroyed()) {
            return { window: win, windowId: this.activeWindowId, genomeName: entry.genomeName || null };
          }
        }
        const names = live
          .map(([wid, entry]) => `${wid}${entry.genomeName ? ` (${entry.genomeName})` : ''}`)
          .join(', ');
        throw new Error(
          `Ambiguous target: ${live.length} CodeXomics windows are open and none is focused. ` +
            `Pass an explicit windowId (call list_genome_windows), or call switch_active_window first. Available: [${names}]`
        );
      }
      if (live.length >= 1) {
        const [wid, entry, win] = live[0];
        return { window: win, windowId: wid, genomeName: entry.genomeName || null };
      }
    }

    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      return { window: this.mainWindow, windowId: 'legacy', genomeName: null };
    }
    return { window: null, windowId: targetWindowId || 'focused', genomeName: null };
  }

  // Attach routing metadata to a tool result so MCP clients can verify which
  // genome window actually answered. Object results get a merged `_meta`;
  // non-object results are wrapped so the metadata is still visible.
  _attachRoutingMeta(result, windowId, genomeName) {
    const meta = { windowId: windowId || null, genomeName: genomeName || null };
    try {
      if (result && typeof result === 'object' && !Array.isArray(result)) {
        const existing = result._meta && typeof result._meta === 'object' ? result._meta : {};
        return { ...result, _meta: { ...existing, ...meta } };
      }
    } catch (e) {
      // fall through to wrapping
    }
    return { _meta: meta, result };
  }

  // Standing guidance sent to MCP clients at initialize time (MCP `instructions`
  // field). Tells clients how to target the right genome window deterministically.
  getServerInstructions() {
    return [
      'CodeXomics opens each genome in its own window with fully isolated state. Every tool call is routed to one genome window.',
      '',
      'To work reliably when more than one genome may be open:',
      '1. Call list_genome_windows first. It returns each open window with its windowId, genomeName, and isFocused flag.',
      '2. Pass windowId on each genome tool call to target a window deterministically. Do not rely on which window is focused.',
      '3. Optionally also pass expected_genome (the genomeName from list_genome_windows). The call then fails loudly if that window has a different genome loaded, instead of answering from the wrong genome.',
      '',
      'If you omit windowId while multiple windows are open and none is focused, the call fails and lists the available windows so you can choose.',
      'Every tool result includes a _meta object with the windowId and genomeName that actually answered — verify it matches your intent.',
      'switch_active_window focuses a window and pins it as the default target for your subsequent un-addressed calls, but passing windowId per call is more reliable, especially with concurrent clients.',
    ].join('\n');
  }

  // Per-session window pin accessors (see this.sessionWindowPins).
  setSessionWindowPin(clientId, windowId) {
    if (!clientId || !windowId) return;
    this.sessionWindowPins.set(clientId, windowId);
  }

  getSessionWindowPin(clientId) {
    if (!clientId) return null;
    const windowId = this.sessionWindowPins.get(clientId);
    if (!windowId) return null;
    // Drop a stale pin if the target window is no longer connected/registered.
    const stillThere =
      this.internalClients.has(windowId) ||
      this.windowRegistry.has(windowId) ||
      (this.mainWindowRegistry && this.mainWindowRegistry.has(windowId));
    if (!stillThere) {
      this.sessionWindowPins.delete(clientId);
      return null;
    }
    return windowId;
  }

  clearSessionWindowPinsForWindow(windowId) {
    if (!windowId) return;
    for (const [clientId, wid] of this.sessionWindowPins.entries()) {
      if (wid === windowId) this.sessionWindowPins.delete(clientId);
    }
    if (this.activeWindowId === windowId) this.activeWindowId = null;
  }

  // Multi-window support: Get the WebSocket client for the currently focused window
  getFocusedWindowClient() {
    // Try to find the focused window in the authoritative registry
    for (const [windowId, entry] of this.getEffectiveWindowRegistry().entries()) {
      const win = entry.window || entry;
      if (win && !win.isDestroyed() && win.isFocused()) {
        const client = this.internalClients.get(windowId);
        if (client && client.readyState === 1) {
          return client;
        }
      }
    }
    // Fallback to legacy internalClient
    return this.internalClient;
  }

  // Multi-window support: List all registered windows with their genome info
  listWindows() {
    // Use the authoritative main.js registry if available, fall back to local copy
    const registry = this.mainWindowRegistry || this.windowRegistry;
    this.serverLog(
      'info',
      `[MCP Server] listWindows called, mainWindowRegistry: ${this.mainWindowRegistry ? 'set' : 'not set'}, windowRegistry: ${this.windowRegistry.size} entries, using: ${this.mainWindowRegistry ? 'mainWindowRegistry' : 'windowRegistry'}`
    );
    this.serverLog('info', `[MCP Server] Registry size: ${registry.size}`);
    const windows = [];
    for (const [windowId, entry] of registry.entries()) {
      const win = entry.window || entry;
      this.serverLog(
        'info',
        `[MCP Server] Checking window: ${windowId}, has window: ${!!win}, isDestroyed: ${win ? win.isDestroyed() : 'N/A'}`
      );
      if (!win || win.isDestroyed()) continue;
      windows.push({
        windowId,
        genomeName: entry.genomeName || 'No genome loaded',
        isFocused: win.isFocused(),
        isVisible: win.isVisible(),
        hasWsClient: this.internalClients.has(windowId),
        isDestroyed: false,
      });
    }

    // Fall back to standalone WebSocket clients if no registries are available or populated
    if (windows.length === 0 && this.internalClients.size > 0) {
      this.serverLog(
        'info',
        `[MCP Server] Using fallback: listing ${this.internalClients.size} standalone internal clients as windows.`
      );
      for (const [windowId, ws] of this.internalClients.entries()) {
        windows.push({
          windowId,
          genomeName: ws.genomeName || 'No genome loaded',
          isFocused: this.internalClient === ws,
          isVisible: true,
          hasWsClient: true,
          isDestroyed: false,
        });
      }
    }

    this.serverLog('info', `[MCP Server] Returning ${windows.length} windows`);
    return windows;
  }

  async ping() {
    try {
      const result = await this.executeToolOnClient('ping', {});
      return {
        success: true,
        result,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: Date.now(),
      };
    }
  }
}

// Export the class
module.exports = StandardClaudeMCPServer;

// Start server if run directly
if (require.main === module) {
  // Parse --mode argument
  const modeArg = process.argv.find(arg => arg.startsWith('--mode='));
  if (modeArg) {
    const mode = modeArg.split('=')[1];
    if (['tools', 'agent'].includes(mode)) {
      process.env.CODEXOMICS_MCP_MODE = mode;
    } else {
      this.serverLog('error', `⚠️  Invalid mode '${mode}'. Use 'tools' or 'agent'. Defaulting to 'tools'.`);
    }
  }

  const server = new StandardClaudeMCPServer();
  this.serverLog('info', `🚀 Starting MCP Server in '${server.mode}' mode`);
  server.start().catch(error => {
    this.serverLog('error', '💥 Startup error:', error.message);
    process.exit(1);
  });
}
