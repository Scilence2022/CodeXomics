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
const { getMcpAuthConfig } = require('./main/mcp-auth-config.js');

const DEFAULT_MCP_JSON_PAYLOAD_LIMIT = '4mb';
const DEFAULT_WS_MAX_PAYLOAD_BYTES = 4 * 1024 * 1024;
const DEFAULT_SHUTDOWN_GRACE_MS = 2000;
const DEFAULT_SSE_HEARTBEAT_MS = 25000;
const DEFAULT_MAX_SSE_CONNECTIONS = 64;
const DEFAULT_MAX_SSE_CONNECTIONS_PER_PRINCIPAL = 8;
const MAX_SSE_MISSED_DRAINS = 3;

class StandardClaudeMCPServer extends EventEmitter {
  constructor(httpPort = 3002, wsPort = 3003, mainWindow = null, authConfig = {}) {
    super(); // Initialize EventEmitter
    this.httpPort = httpPort;
    this.wsPort = wsPort;
    this.mainWindow = mainWindow;
    this.pendingRequests = new Map();
    this.activeConnections = new Set();
    this.sseTransports = new Map();
    this.sseProtocolServers = new Map();
    this.sseConnectionIds = new Map();
    this.sseCleanupInProgress = new Set();
    this.sseHeartbeatTimers = new Map();
    this.sseExpiryTimers = new Map();
    this.sseBackpressureState = new Map();
    this.connectedProtocolServers = new Set();
    this.transportExecutionContexts = new Map();
    this.lifecycleState = 'idle';
    this._startPromise = null;
    this._stopPromise = null;
    this.shutdownGraceMs = Number.isFinite(authConfig.shutdownGraceMs)
      ? Math.max(25, Number(authConfig.shutdownGraceMs))
      : DEFAULT_SHUTDOWN_GRACE_MS;
    this.maxSSEConnections = Number.isInteger(authConfig.maxSSEConnections)
      ? Math.max(1, authConfig.maxSSEConnections)
      : DEFAULT_MAX_SSE_CONNECTIONS;
    this.maxSSEConnectionsPerPrincipal = Number.isInteger(authConfig.maxSSEConnectionsPerPrincipal)
      ? Math.max(1, authConfig.maxSSEConnectionsPerPrincipal)
      : DEFAULT_MAX_SSE_CONNECTIONS_PER_PRINCIPAL;

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
      enableLocalBypass: authConfig.enableLocalBypass === true,
      developmentMode: authConfig.developmentMode || false,
      masterKey: authConfig.masterKey || null,
      ...authConfig,
    });
    if (
      this.authManager.config.requireAuth &&
      !this.authManager.config.enableLocalBypass &&
      this.authManager.apiKeys.size === 0
    ) {
      this.authManager.destroy();
      throw new Error(
        'MCP authentication is enabled but no credentials are configured. Set CODEXOMICS_MCP_MASTER_KEY, configure scoped API keys, or explicitly enable local bypass.'
      );
    }

    // Initialize tool category manager
    this.toolCategoryManager = new ToolCategoryManager();

    // Initialize connection health monitor
    this.healthMonitor = new ConnectionHealthMonitor();
    this.healthMonitor.on('connectionExpired', connection => {
      const sseSessionId = connection?.metadata?.sseSessionId;
      if (!sseSessionId) return;
      this._cleanupSSESession(sseSessionId, { closeTransport: true }).catch(error => {
        this.serverLog('warn', `⚠️ Failed to close stale SSE connection: ${error.message}`);
      });
    });

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

    // Keep a configured protocol server for compatibility with callers that
    // inspect this property. Legacy SSE streams receive a dedicated protocol
    // server because the MCP SDK permits only one transport per Server.
    this.mcpServer = this._createProtocolServer();

    // Express app for SSE transport
    this.app = express();
    this.httpServer = null;

    // WebSocket server for legacy support
    this.wsServer = null;
    this.wsConnections = new Set();
    this._wsReadyPromise = null;

    this.setupMCPServer();
    this.setupExpressApp();
    this.setupIPCCommunication();
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
    const redactionOptions = {
      preserveApprovalToken: toolName === 'request_annotation_approval',
    };
    const content = [
      {
        type: 'text',
        text: JSON.stringify(this.redactImageData(result, new WeakSet(), redactionOptions), null, 2),
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

  redactImageData(value, seen = new WeakSet(), options = {}) {
    if (value === null || typeof value !== 'object') {
      return value;
    }

    if (seen.has(value)) {
      return '[circular]';
    }
    seen.add(value);

    if (Array.isArray(value)) {
      return value.map(item => this.redactImageData(item, seen, options));
    }

    const result = {};
    for (const [key, child] of Object.entries(value)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (
        [
          'authorization',
          'cookie',
          'approvaltoken',
          'token',
          'apikey',
          'password',
          'secret',
          'executioncontext',
          'userprompt',
          'prompt',
        ].includes(normalizedKey) &&
        !(normalizedKey === 'approvaltoken' && options.preserveApprovalToken === true)
      ) {
        result[key] = '[redacted]';
        continue;
      }
      if (key === 'imageData' || key === 'imageDataUrl' || key === 'imageDataURL') {
        result[key] = typeof child === 'string' ? `[base64 image data omitted: ${child.length} chars]` : '[omitted]';
        continue;
      }
      if (key === 'data' && value.type === 'image' && typeof child === 'string') {
        result[key] = `[base64 image data omitted: ${child.length} chars]`;
        continue;
      }
      result[key] = this.redactImageData(child, seen, options);
    }
    return result;
  }

  _executionContext(authValue) {
    if (!authValue) return null;
    const session = authValue.session || authValue;
    const principal = session.principal || session.keyId || session.clientId;
    if (!principal) return null;
    return {
      source: 'mcp',
      authenticated: true,
      principal: String(principal),
      permissions: Array.isArray(session.permissions)
        ? [...session.permissions]
        : Array.isArray(session.scopes)
          ? [...session.scopes]
          : [],
      isAdmin: session.isAdmin === true,
      sessionId: session.sessionId || authValue.sessionId || null,
      transportSessionId: session.transportSessionId || authValue.transportSessionId || null,
    };
  }

  _routingClientId(requestedClientId, executionContext) {
    if (executionContext?.authenticated) {
      // HTTP authentication deliberately reuses one auth session per API key.
      // Prefer the MCP transport session when available so two SSE clients that
      // share a scoped key cannot overwrite each other's default-window pin.
      return executionContext.transportSessionId || executionContext.sessionId || executionContext.principal;
    }
    return requestedClientId || null;
  }

  _releaseWebSocketAuthenticationSession(sessionId, connectionRole) {
    if (!sessionId || connectionRole !== 'external-client') return false;
    const session = this.authManager?.sessions?.get(sessionId);
    // AuthenticationManager deliberately reuses one local-bypass session.
    // Closing one compatibility socket must not revoke that shared session
    // from other local clients. Configured API-key WebSockets receive a fresh,
    // socket-owned session and should release it immediately on teardown.
    if (session?.isBypass === true) return false;
    this.sessionWindowPins?.delete(sessionId);
    return this.authManager?.invalidateSession?.(sessionId) === true;
  }

  _executionContextFromRequestExtra(extra = {}) {
    let authValue = extra.authInfo || null;
    if (!authValue && extra.sessionId) {
      const sessionValidation = this.authManager.validateSession(extra.sessionId);
      authValue = sessionValidation.valid ? sessionValidation : null;
    }
    return this._executionContext(authValue) || this.transportExecutionContexts.get(extra.sessionId) || null;
  }

  _requiredAnnotationPermission(toolName) {
    const permissionGroups = {
      'annotation:read': [
        'resolve_annotation_target',
        'get_annotation_changeset',
        'get_annotation_audit',
        'list_annotations',
        'get_annotation',
        'get_annotation_history',
        'search_annotations',
        'list_genome_windows',
        'switch_active_window',
      ],
      'annotation:propose': [
        'create_annotation_changeset',
        'update_annotation',
        'merge_gene_research_report',
        'bulk_update_annotations',
        'rollback_annotation_changeset',
      ],
      'annotation:research': [
        'start_annotation_research',
        'archive_annotation_research',
        'get_annotation_research_workflow',
        'cancel_annotation_research',
      ],
      'annotation:approve': ['request_annotation_approval', 'reject_annotation_changeset'],
      'annotation:commit': ['apply_annotation_changeset'],
      'annotation:structural': ['edit_annotation', 'delete_annotation', 'batch_create_annotations'],
    };
    return Object.entries(permissionGroups).find(([, tools]) => tools.includes(toolName))?.[0] || null;
  }

  _assertToolPermission(toolName, executionContext) {
    if (
      this.mode === 'agent' &&
      !['codexomics_chat', 'list_genome_windows', 'switch_active_window'].includes(toolName)
    ) {
      throw new Error(`Tool ${toolName} is not available while the MCP server is in agent mode`);
    }
    if (!this._isToolPermitted(toolName, executionContext)) {
      if (!executionContext) throw new Error('Authenticated MCP execution context is required');
      const required = this._requiredAnnotationPermission(toolName);
      if (required) throw new Error(`MCP permission "${required}" is required for ${toolName}`);
      throw new Error(`Non-admin MCP credentials are not permitted to execute unmapped tool ${toolName}`);
    }
  }

  _isToolPermitted(toolName, executionContext) {
    if (!executionContext) return false;
    const permissions = executionContext.permissions || [];
    if (executionContext.isAdmin || permissions.includes('*')) return true;
    const required = this._requiredAnnotationPermission(toolName);
    return Boolean(required && permissions.includes(required));
  }

  _getPermittedTools(executionContext) {
    return this.toolsIntegrator.getAvailableTools().filter(tool => this._isToolPermitted(tool.name, executionContext));
  }

  _executionContextWithDeadline(executionContext, timeoutMs) {
    if (!executionContext) return null;
    const startedAt = Date.now();
    const commitSafetyMarginMs = Math.min(2000, Math.max(250, Math.floor(timeoutMs / 10)));
    return Object.freeze({
      ...executionContext,
      requestDeadline: startedAt + timeoutMs,
      commitNotAfter: startedAt + Math.max(0, timeoutMs - commitSafetyMarginMs),
    });
  }

  _executionHopTimeoutMs(executionContext) {
    const maximum = this.mode === 'agent' ? 120000 : 30000;
    const requestDeadline = Number(executionContext?.requestDeadline);
    if (!Number.isFinite(requestDeadline)) return maximum;
    const remaining = Math.floor(requestDeadline - Date.now());
    if (remaining <= 0) throw new Error('The MCP request deadline elapsed before client execution began');
    return Math.min(maximum, remaining);
  }

  async _withTimeout(operation, timeoutMs, message) {
    let timeoutId;
    try {
      return await Promise.race([
        Promise.resolve().then(operation),
        new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
        }),
      ]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  _createProtocolServer() {
    return new Server(
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
  }

  setupMCPServer(mcpServer = this.mcpServer) {
    this.serverLog('info', '🔧 Setting up MCP Server handlers');

    // Handle initialization
    mcpServer.setRequestHandler(InitializeRequestSchema, async (request, extra = {}) => {
      this.serverLog('info', '🔄 Handling initialize request');
      this.serverLog('info', '📥 Client info:', JSON.stringify(request.params?.clientInfo, null, 2));
      this.serverLog('info', '📥 Protocol version:', request.params?.protocolVersion);

      this.clientInfo = request.params?.clientInfo;
      this.protocolVersion = request.params?.protocolVersion || '2024-11-05';

      const tools = this._getPermittedTools(this._executionContextFromRequestExtra(extra));
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
    mcpServer.setNotificationHandler(InitializedNotificationSchema, async notification => {
      this.serverLog('info', '✅ Received initialized notification');
      this.isInitialized = true;
      this.serverLog('info', '🎯 MCP Server is now fully initialized and ready');
    });

    // Handle list tools
    mcpServer.setRequestHandler(ListToolsRequestSchema, async (request, extra = {}) => {
      this.serverLog('info', '📋 Handling tools/list request');

      if (!this.isInitialized) {
        this.serverLog('warn', '⚠️  Tools list requested before initialization complete');
      }

      const tools = this._getPermittedTools(this._executionContextFromRequestExtra(extra));
      this.serverLog('info', `✅ Returning ${tools.length} tools`);

      return {
        tools: tools,
      };
    });

    // Handle tool execution
    mcpServer.setRequestHandler(CallToolRequestSchema, async (request, extra = {}) => {
      const { name: toolName, arguments: args } = request.params;
      this.serverLog('info', `🔧 Executing tool: ${toolName}`, {
        argumentKeys: Object.keys(args || {}).filter(key => key !== 'approvalToken'),
      });

      const startTime = Date.now();

      try {
        const baseExecutionContext = this._executionContextFromRequestExtra(extra);
        const timeout = this.mode === 'agent' ? 120000 : 30000;
        const executionContext = this._executionContextWithDeadline(baseExecutionContext, timeout);
        this._assertToolPermission(toolName, executionContext);
        // Agent mode: intercept all tool calls and route through the agent
        if (this.mode === 'agent' && toolName !== 'codexomics_chat') {
          this.serverLog('info', `🤖 [Agent Mode] Routing tool '${toolName}' through agent`);
          // In agent mode, we still execute individual tools, but also send
          // logging notifications to inform the MCP client about the execution flow
          this._notifyProtocolClient(mcpServer, 'info', `Executing tool: ${toolName}`);
        }

        // Execute tool with 30 second timeout (extended to 120s for agent mode)
        const result = await this._withTimeout(
          () =>
            this.toolsIntegrator.executeTool(
              toolName,
              args,
              this._routingClientId(args?.clientId, executionContext),
              executionContext
            ),
          timeout,
          `Tool execution timeout after ${timeout / 1000} seconds`
        );

        const executionTime = Date.now() - startTime;
        this.serverLog('info', `✅ Tool ${toolName} executed successfully in ${executionTime}ms`);

        // In agent mode, notify client about completion
        if (this.mode === 'agent' && toolName !== 'codexomics_chat') {
          this._notifyProtocolClient(mcpServer, 'info', `Tool ${toolName} completed in ${executionTime}ms`);
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
    mcpServer.setRequestHandler(PingRequestSchema, async request => {
      this.serverLog('info', '🏓 Handling ping request');
      return {
        status: 'pong',
        timestamp: Date.now(),
        serverReady: this.isInitialized,
        mainWindowReady: !!(this.mainWindow && !this.mainWindow.isDestroyed()),
      };
    });

    // Connection event handlers
    mcpServer.onclose = () => {
      this.serverLog('info', '🔌 MCP Server connection closed');
      this.connectedProtocolServers.delete(mcpServer);
      if (this.connectedProtocolServers.size === 0) this.isInitialized = false;
    };

    mcpServer.onerror = error => {
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
      if (req.path === '/health' || (req.path === '/mcp' && req.method === 'GET')) {
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
    this.app.get('/sse', this.authMiddleware, async (req, res) => {
      await this.handleSSEConnection(req, res);
    });

    // POST endpoint for MCP clients that use HTTP POST
    this.app.post('/sse', this.authMiddleware, async (req, res) => {
      await this.handleSSEPostRequest(req, res);
    });

    // Streamable JSON-RPC endpoint advertised to modern MCP clients.
    this.app.post('/mcp', this.authMiddleware, async (req, res) => {
      await this.handleMCPPostRequest(req, res);
    });

    // Root endpoint for other MCP clients
    this.app.get('/', this.authMiddleware, async (req, res) => {
      await this.handleSSEConnection(req, res);
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
      this.handleClientBridgeStatus(req, res);
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
    if (this.wsServer) return this._wsReadyPromise;
    this.serverLog('info', '🔧 Setting up WebSocket server');

    // Create WebSocket server
    this.wsServer = new WebSocket.Server({
      port: this.wsPort,
      host: process.env.CODEXOMICS_MCP_BIND_HOST || '127.0.0.1',
      perMessageDeflate: false,
      maxPayload: DEFAULT_WS_MAX_PAYLOAD_BYTES,
    });
    this._wsReadyPromise = new Promise(resolve => {
      let settled = false;
      const settle = error => {
        if (settled) return;
        settled = true;
        resolve(error || null);
      };
      this.wsServer.once('listening', () => settle(null));
      this.wsServer.once('error', error => settle(error));
    });

    this.wsServer.on('connection', (ws, req) => {
      this.serverLog('info', '🔗 New WebSocket connection from:', req.socket.remoteAddress);
      this.emit('client-connected', { type: 'websocket', address: req.socket.remoteAddress });

      // WebSocket connections need to authenticate via first message
      let authenticated = false;
      let sessionId = null;
      let connectionId = null;
      let connectionRole = 'unauthenticated';

      // Set authentication timeout
      const authTimeout = setTimeout(() => {
        if (!authenticated && ws.readyState === WebSocket.OPEN) {
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
              if (this.authManager.config.enableLocalBypass !== true) {
                ws.send(
                  JSON.stringify({
                    type: 'error',
                    error:
                      'Internal WebSocket bridge registration is disabled; use Electron IPC or explicitly enable the local-bypass compatibility mode',
                  })
                );
                ws.close(1008, 'Internal bridge disabled');
                return;
              }

              clearTimeout(authTimeout);
              authenticated = true;
              connectionRole = 'internal-bridge';
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
              const rawApiKey = message.apiKey ?? message.headers?.Authorization;
              if (rawApiKey !== undefined && rawApiKey !== null && typeof rawApiKey !== 'string') {
                ws.send(
                  JSON.stringify({
                    type: 'error',
                    error: 'API key must be a string',
                  })
                );
                ws.close(1008, 'Invalid API key');
                return;
              }

              const apiKey = typeof rawApiKey === 'string' ? rawApiKey.replace(/^Bearer\s+/i, '').trim() : '';

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

              // Keep the fail-closed timeout armed until authentication has
              // actually succeeded. Validation can throw (for example, if a
              // custom credential backend fails), and must not leave an idle,
              // unauthenticated socket open indefinitely.
              authenticated = true;
              clearTimeout(authTimeout);
              connectionRole = 'external-client';
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
            if (connectionRole !== 'internal-bridge') {
              ws.send(
                JSON.stringify({ type: 'error', error: 'Connection role cannot be changed after authentication' })
              );
              return;
            }
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
            if (connectionRole !== 'internal-bridge') {
              ws.send(JSON.stringify({ type: 'error', error: 'Only the internal bridge may submit tool results' }));
              return;
            }
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
            if (connectionRole !== 'internal-bridge') {
              ws.send(JSON.stringify({ type: 'error', error: 'Only the internal bridge may update genome state' }));
              return;
            }
            this.serverLog(
              'info',
              `[MCP Server] Client ${ws.windowId || connectionId} loaded genome: ${message.genomeName}`
            );
            ws.genomeName = message.genomeName;
            return;
          }

          this.serverLog('info', '📥 WebSocket message:', {
            type: message.type || null,
            method: message.method || null,
            tool: message.params?.name || null,
          });

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
        clearTimeout(authTimeout);
        this._releaseWebSocketAuthenticationSession(sessionId, connectionRole);
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
        clearTimeout(authTimeout);
        this._releaseWebSocketAuthenticationSession(sessionId, connectionRole);
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
    return this._wsReadyPromise;
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
      case 'initialize': {
        const tools = this._getPermittedTools(this._executionContext(sessionValidation));
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
              description: `CodeXomics MCP Server with ${tools.length} permitted genomics tools`,
            },
            instructions: this.getServerInstructions(),
          },
          id,
        };
      }

      case 'notifications/initialized':
      case 'initialized':
        this.isInitialized = true;
        return null;

      case 'tools/list': {
        const tools = this._getPermittedTools(this._executionContext(sessionValidation));
        return {
          jsonrpc: '2.0',
          result: { tools },
          id,
        };
      }

      case 'tools/call':
        try {
          const timeoutMs = this.mode === 'agent' ? 120000 : 30000;
          const executionContext = this._executionContextWithDeadline(
            this._executionContext(sessionValidation),
            timeoutMs
          );
          this._assertToolPermission(params.name, executionContext);
          const result = await this._withTimeout(
            () =>
              this.toolsIntegrator.executeTool(
                params.name,
                params.arguments,
                this._routingClientId(params.arguments?.clientId, executionContext),
                executionContext
              ),
            timeoutMs,
            `Tool execution timeout after ${timeoutMs / 1000} seconds`
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
        if (id === undefined && String(method || '').startsWith('notifications/')) return null;
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

  _sseCapacityError(executionContext) {
    if (this.sseTransports.size >= this.maxSSEConnections) {
      return `The MCP server already has ${this.maxSSEConnections} active SSE streams`;
    }
    const principal = executionContext?.principal;
    const principalConnections = Array.from(this.transportExecutionContexts.values()).filter(
      context => context?.principal === principal
    ).length;
    if (principalConnections >= this.maxSSEConnectionsPerPrincipal) {
      return `MCP principal "${principal}" already has ${this.maxSSEConnectionsPerPrincipal} active SSE streams`;
    }
    return null;
  }

  _startSSEMaintenance(sessionId, response, expiresAt) {
    const connectionId = this.sseConnectionIds.get(sessionId);
    const backpressure = { missedDrains: 0, waitingForDrain: false };
    this.sseBackpressureState.set(sessionId, backpressure);
    const heartbeat = setInterval(() => {
      try {
        if (response.destroyed || response.writableEnded) {
          void this._cleanupSSESession(sessionId);
          return;
        }
        const accepted = response.write(': keepalive\n\n');
        if (accepted) {
          backpressure.missedDrains = 0;
          if (connectionId) this.healthMonitor.updateActivity(connectionId);
          return;
        }

        backpressure.missedDrains += 1;
        if (!backpressure.waitingForDrain && typeof response.once === 'function') {
          backpressure.waitingForDrain = true;
          response.once('drain', () => {
            if (!this.sseTransports.has(sessionId)) return;
            backpressure.waitingForDrain = false;
            backpressure.missedDrains = 0;
            if (connectionId) this.healthMonitor.updateActivity(connectionId);
          });
        }
        if (backpressure.missedDrains >= MAX_SSE_MISSED_DRAINS) {
          void this._cleanupSSESession(sessionId, { closeTransport: true });
        }
      } catch (_error) {
        void this._cleanupSSESession(sessionId, { closeTransport: true });
      }
    }, DEFAULT_SSE_HEARTBEAT_MS);
    heartbeat.unref?.();
    this.sseHeartbeatTimers.set(sessionId, heartbeat);

    const expiryDelay = Number(expiresAt) - Date.now();
    if (Number.isFinite(expiryDelay)) {
      const expiry = setTimeout(
        () => void this._cleanupSSESession(sessionId, { closeTransport: true }),
        Math.max(0, expiryDelay)
      );
      expiry.unref?.();
      this.sseExpiryTimers.set(sessionId, expiry);
    }
  }

  async _cleanupSSESession(sessionId, { closeTransport = false } = {}) {
    if (!sessionId || this.sseCleanupInProgress.has(sessionId)) return;
    const transport = this.sseTransports.get(sessionId);
    const protocolServer = this.sseProtocolServers.get(sessionId);
    const connectionId = this.sseConnectionIds.get(sessionId);
    if (!transport && !protocolServer && !connectionId) return;

    this.sseCleanupInProgress.add(sessionId);
    this.sseTransports.delete(sessionId);
    this.sseProtocolServers.delete(sessionId);
    this.sseConnectionIds.delete(sessionId);
    this.transportExecutionContexts.delete(sessionId);
    // Transport-scoped routing pins must not survive a disconnected SSE
    // transport; a reconnect receives a new transport session identifier.
    this.sessionWindowPins?.delete(sessionId);
    const heartbeat = this.sseHeartbeatTimers.get(sessionId);
    const expiry = this.sseExpiryTimers.get(sessionId);
    if (heartbeat) clearInterval(heartbeat);
    if (expiry) clearTimeout(expiry);
    this.sseHeartbeatTimers.delete(sessionId);
    this.sseExpiryTimers.delete(sessionId);
    this.sseBackpressureState.delete(sessionId);
    if (transport) this.activeConnections.delete(transport);
    if (protocolServer) this.connectedProtocolServers.delete(protocolServer);

    try {
      if (closeTransport) {
        try {
          if (typeof protocolServer?.close === 'function') await protocolServer.close();
          else if (typeof transport?.close === 'function') await transport.close();
        } catch (error) {
          this.serverLog('warn', `⚠️ Failed to close SSE transport: ${error.message}`);
          if (typeof transport?.close === 'function') await transport.close().catch(() => undefined);
        }
      }
    } finally {
      if (connectionId) this.healthMonitor.unregisterConnection(connectionId);
      this.sseCleanupInProgress.delete(sessionId);
      this.serverLog('info', `📊 Active connections: ${this.activeConnections.size}`);
    }
  }

  async handleSSEConnection(req, res) {
    this.serverLog('info', '🔄 New SSE connection request');

    const executionContext = this._executionContext(req.mcpSession);
    const capacityError = this._sseCapacityError(executionContext);
    if (capacityError) {
      return res.status(429).json({ error: 'Too many SSE connections', message: capacityError });
    }

    let connectionId = null;
    let transport = null;
    let protocolServer = null;
    const cleanup = async ({ closeTransport = false } = {}) => {
      if (transport?.sessionId) {
        await this._cleanupSSESession(transport.sessionId, { closeTransport });
        return;
      }
      if (connectionId) this.healthMonitor.unregisterConnection(connectionId);
    };

    try {
      // Create connection ID
      connectionId = `sse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const sessionId = req.mcpSession?.sessionId;

      // Every legacy SSE stream needs its own SDK protocol server. The SDK
      // deliberately rejects connecting two transports to one Server object.
      transport = new SSEServerTransport('/sse', res);
      protocolServer = this._createProtocolServer();
      this.setupMCPServer(protocolServer);
      if (transport.sessionId) {
        this.sseTransports.set(transport.sessionId, transport);
        this.sseProtocolServers.set(transport.sessionId, protocolServer);
        this.sseConnectionIds.set(transport.sessionId, connectionId);
        this.transportExecutionContexts.set(transport.sessionId, executionContext);
      }

      this.healthMonitor.registerConnection(connectionId, {
        type: 'sse',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        sessionId,
        metadata: { sseSessionId: transport.sessionId },
      });

      // Track connection
      this.activeConnections.add(transport);
      this.serverLog('info', `📊 Active connections: ${this.activeConnections.size}`);

      // Install terminal handlers before connecting so an early disconnect
      // cannot leak the authenticated transport context.
      req.on('close', () => {
        this.serverLog('info', '🔌 SSE connection closed by client');
        void cleanup();
      });

      req.on('error', error => {
        this.serverLog('error', '❌ SSE connection error:', error);
        void cleanup({ closeTransport: true });
      });

      res.on('error', error => {
        this.serverLog('error', '❌ SSE response error:', error);
        void cleanup({ closeTransport: true });
      });

      res.on('close', () => {
        this.serverLog('info', '🔌 SSE response closed');
        void cleanup();
      });

      // Connect the per-stream MCP protocol server to its transport.
      this.connectedProtocolServers.add(protocolServer);
      await protocolServer.connect(transport);
      if (this.sseProtocolServers.get(transport.sessionId) !== protocolServer) {
        await protocolServer.close().catch(() => undefined);
        return;
      }
      this._startSSEMaintenance(transport.sessionId, res, req.mcpSession?.expiresAt);
      this.serverLog('info', '✅ SSE connection established and MCP server connected');
    } catch (error) {
      await cleanup({ closeTransport: true });
      this.serverLog('error', '❌ Failed to establish SSE connection:', error);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Failed to establish SSE connection',
          message: error.message,
        });
      }
    }
  }

  async handleSSEPostRequest(req, res) {
    const sessionId = typeof req.query?.sessionId === 'string' ? req.query.sessionId : '';
    const transport = sessionId ? this.sseTransports.get(sessionId) : null;
    if (!transport) {
      return res.status(404).json({ error: 'Unknown or expired SSE session' });
    }

    const expectedContext = this.transportExecutionContexts.get(sessionId);
    const requestContext = this._executionContext(req.mcpSession);
    if (
      !expectedContext ||
      !requestContext ||
      expectedContext.sessionId !== requestContext.sessionId ||
      expectedContext.principal !== requestContext.principal ||
      expectedContext.isAdmin !== requestContext.isAdmin
    ) {
      return res.status(403).json({ error: 'SSE session credential does not match the connection owner' });
    }

    try {
      // SSEServerTransport forwards req.auth as the SDK request authInfo. Bind
      // it to the context captured when this specific SSE stream was opened so
      // tools/list and tools/call use the same scoped authorization policy.
      req.auth = Object.freeze({
        ...expectedContext,
        permissions: Object.freeze([...(expectedContext.permissions || [])]),
        transportSessionId: sessionId,
      });
      const connectionId = this.sseConnectionIds.get(sessionId);
      if (connectionId) this.healthMonitor.updateActivity(connectionId);
      await transport.handlePostMessage(req, res, req.body);
      return undefined;
    } catch (error) {
      this.serverLog('error', `❌ SSE message handling failed: ${error.message}`);
      if (!res.headersSent) return res.status(500).json({ error: 'Failed to process SSE MCP message' });
      return undefined;
    }
  }

  async handleMCPPostRequest(req, res) {
    const startTime = Date.now();
    this.serverLog('info', '📮 Received POST request:', req.path);
    this.serverLog('info', '📦 JSON-RPC request:', {
      method: req.body?.method || null,
      tool: req.body?.params?.name || null,
      argumentKeys: Object.keys(req.body?.params?.arguments || {}).filter(key => key !== 'approvalToken'),
    });
    this.serverLog('info', '🔗 Client connection info:', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      connection: req.get('Connection'),
      contentLength: req.get('Content-Length'),
    });

    try {
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

          const tools = this._getPermittedTools(this._executionContext(req.mcpSession));
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
                description: `CodeXomics MCP Server with ${tools.length} permitted genomics tools`,
              },
              instructions: this.getServerInstructions(),
            },
            id,
          };
          break;
        }

        case 'notifications/initialized':
        case 'initialized':
          this.serverLog('info', '✅ Handling initialized notification');
          this.isInitialized = true;
          // Notifications don't need responses
          return res.status(204).send();

        case 'tools/list': {
          this.serverLog('info', '📋 Handling tools/list request');
          const availableTools = this._getPermittedTools(this._executionContext(req.mcpSession));
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
            const timeoutMs = this.mode === 'agent' ? 120000 : 30000;
            const executionContext = this._executionContextWithDeadline(
              this._executionContext(req.mcpSession),
              timeoutMs
            );
            this._assertToolPermission(toolName, executionContext);
            const result = await this._withTimeout(
              () =>
                this.toolsIntegrator.executeTool(
                  toolName,
                  args,
                  this._routingClientId(args?.clientId, executionContext),
                  executionContext
                ),
              timeoutMs,
              `Tool execution timeout after ${timeoutMs / 1000} seconds`
            );

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
          if (id === undefined && String(method).startsWith('notifications/')) {
            return res.status(204).send();
          }
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

  async executeToolOnClient(toolName, parameters, clientId, executionContext = null) {
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

    // Prefer the authenticated in-process Electron route. The localhost
    // WebSocket bridge is retained only as a compatibility fallback.
    if (this.windowRegistry.size > 0) {
      return await this.executeViaElectronIPC(toolName, parameters, clientId, targetWindowId, executionContext);
    }

    // Legacy: single mainWindow fallback. Preserve any explicit windowId the
    // client passed instead of silently dropping it (previously forced to null).
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      return await this.executeViaElectronIPC(toolName, parameters, clientId, targetWindowId, executionContext);
    }

    if (this.internalClients.size > 0) {
      return await this.executeViaInternalClient(toolName, parameters, clientId, targetWindowId, executionContext);
    }

    // Try client bridge if available
    if (this.clientBridges.size > 0) {
      return await this.executeViaClientBridge(toolName, parameters, clientId, executionContext);
    }

    throw new Error(
      `Tool '${toolName}' requires a connected CodeXomics client. ` +
        `No local client, internal WebSocket client, or remote bridge available. ` +
        `Please start CodeXomics application to enable this tool.`
    );
  }

  async executeViaInternalClient(toolName, parameters, clientId, targetWindowId, executionContext = null) {
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
    const timeoutMs = this._executionHopTimeoutMs(executionContext);

    // Convert snake_case tool name to camelCase method name
    const methodName = toolName.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Tool execution timeout for ${toolName} via internal client (window: ${resolvedWindowId})`));
      }, timeoutMs);

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
          executionContext,
        })
      );
    });
  }

  async executeViaElectronIPC(toolName, parameters, clientId, targetWindowId, executionContext = null) {
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
    const timeoutMs = this._executionHopTimeoutMs(executionContext);

    // Convert snake_case tool name to camelCase method name
    const methodName = toolName.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Tool execution timeout for ${toolName} (window: ${targetWindowId})`));
      }, timeoutMs);

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
        executionContext,
      });
    });
  }

  async executeViaClientBridge(toolName, parameters, clientId, executionContext = null) {
    const ownerSessionId = executionContext?.sessionId;
    if (!ownerSessionId) throw new Error('Authenticated MCP session is required for client bridge execution');
    const bridge = Array.from(this.clientBridges.values()).find(candidate => candidate.sessionId === ownerSessionId);

    if (!bridge) {
      throw new Error('No client bridge is registered for the authenticated MCP session');
    }

    const requestId = `bridge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timeoutMs = this._executionHopTimeoutMs(executionContext);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        bridge.pendingRequests.delete(requestId);
        reject(new Error(`Bridge tool execution timeout for ${toolName}`));
      }, timeoutMs);

      bridge.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeout,
        toolName,
        parameters,
        executionContext,
      });

      // Send execution request to bridge
      this.serverLog('info', `📡 [MCP Server] Sending tool execution via Bridge: ${toolName}`);

      // The bridge client will poll for pending requests
      bridge.lastActivity = Date.now();
    });
  }

  handleClientBridgeRegistration(req, res) {
    const { bridgeId, capabilities } = req.body;

    if (!this._isAuthorizedBridgeRequest(req)) {
      return res.status(403).json({ success: false, error: 'Client bridge access requires an admin credential' });
    }

    if (!bridgeId || !/^[A-Za-z0-9._-]{1,128}$/.test(String(bridgeId))) {
      return res.status(400).json({
        success: false,
        error: 'Bridge ID required',
      });
    }
    if (this.clientBridges.has(bridgeId)) {
      return res.status(409).json({ success: false, error: 'Bridge ID is already registered' });
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
    if (!this._isAuthorizedBridgeRequest(req)) {
      return res.status(403).json({ success: false, error: 'Client bridge access requires an admin credential' });
    }
    const bridge = this.clientBridges.get(bridgeId);
    if (bridge && bridge.sessionId !== req.mcpSession.sessionId) {
      return res.status(403).json({ success: false, error: 'Bridge belongs to a different MCP session' });
    }

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

    if (!this._isAuthorizedBridgeRequest(req)) {
      return res.status(403).json({ success: false, error: 'Client bridge access requires an admin credential' });
    }

    const bridge = this.clientBridges.get(bridgeId);

    if (!bridge) {
      return res.status(404).json({
        success: false,
        error: 'Bridge not found',
      });
    }
    if (bridge.sessionId !== req.mcpSession.sessionId) {
      return res.status(403).json({ success: false, error: 'Bridge belongs to a different MCP session' });
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
        return res.json({ success: true, message: 'Response recorded' });
      }
      return res.status(404).json({ success: false, error: 'Unknown bridge request ID' });
    }

    // Return any pending execution requests for this bridge
    const pending = Array.from(bridge.pendingRequests.entries()).map(([id, req]) => ({
      requestId: id,
      toolName: req.toolName,
      parameters: req.parameters,
      executionContext: req.executionContext,
    }));

    res.json({
      success: true,
      pendingRequests: pending,
    });
  }

  _isAuthorizedBridgeRequest(req) {
    const context = this._executionContext(req?.mcpSession);
    return Boolean(context?.isAdmin && context.sessionId);
  }

  handleClientBridgeStatus(req, res) {
    if (!this._isAuthorizedBridgeRequest(req)) {
      return res.status(403).json({ success: false, error: 'Client bridge access requires an admin credential' });
    }
    const bridges = Array.from(this.clientBridges.values())
      .filter(bridge => bridge.sessionId === req.mcpSession.sessionId)
      .map(bridge => ({
        id: bridge.id,
        registeredAt: bridge.registeredAt,
        lastActivity: bridge.lastActivity,
        capabilities: bridge.capabilities,
      }));
    return res.json({ registered: bridges.length > 0, bridges });
  }

  async _startServer() {
    this.serverLog('info', '🚀 Starting Standard Claude MCP Server');

    try {
      // Network listeners are created by start(), never by construction. This
      // keeps embedded/test instances inert until their lifecycle owner opts in.
      const initialWsError = await this.setupWebSocketServer();
      if (initialWsError || this._wsPortError) {
        const wsError = initialWsError || this._wsPortError;
        this._wsPortError = null;
        const error = new Error(
          wsError.code === 'EADDRINUSE'
            ? `WebSocket port ${this.wsPort} is already in use`
            : `Failed to bind WebSocket server on port ${this.wsPort}: ${wsError.message}`
        );
        error.mcpPortType = 'ws';
        throw error;
      }

      await new Promise((resolve, reject) => {
        const bindHost = process.env.CODEXOMICS_MCP_BIND_HOST || '127.0.0.1';
        const httpServer = this.app.listen(this.httpPort, bindHost);
        this.httpServer = httpServer;
        const onError = error => {
          httpServer.removeListener('listening', onListening);
          if (error.code === 'EADDRINUSE') {
            const bindError = new Error(`HTTP port ${this.httpPort} is already in use`);
            bindError.mcpPortType = 'http';
            reject(bindError);
          } else {
            const bindError = new Error(`Failed to start HTTP server on port ${this.httpPort}: ${error.message}`);
            bindError.mcpPortType = 'http';
            reject(bindError);
          }
        };
        const onListening = () => {
          httpServer.removeListener('error', onError);
          resolve();
        };
        httpServer.once('error', onError);
        httpServer.once('listening', onListening);
      });

      if (this.lifecycleState === 'stopping') {
        throw new Error('MCP server startup was cancelled by shutdown');
      }

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
      this.lifecycleState = 'running';
      this.emit('started', { httpPort: this.httpPort, wsPort: this.wsPort });
    } catch (error) {
      this.serverLog('error', `💥 Failed to start server: ${error.message}`);

      // Emit start-failed event so the main process can handle it gracefully
      const portType = error.mcpPortType || (error.message.includes('HTTP') ? 'http' : 'ws');
      const port = portType === 'http' ? this.httpPort : this.wsPort;
      this.emit('start-failed', { type: portType, port, error: error.message });

      // A partially bound server is never left alive after a failed start.
      await this._cleanupResources();
      this.lifecycleState = 'closed';
      throw error;
    }
  }

  start() {
    if (this.lifecycleState === 'running') return Promise.resolve();
    if (this._startPromise) return this._startPromise;
    if (this.lifecycleState !== 'idle') {
      return Promise.reject(new Error(`Cannot start an MCP server in lifecycle state "${this.lifecycleState}"`));
    }

    this.lifecycleState = 'starting';
    this._startPromise = this._startServer().finally(() => {
      this._startPromise = null;
    });
    return this._startPromise;
  }

  async _settleWithin(operation, timeoutMs = this.shutdownGraceMs) {
    let timeoutId;
    try {
      return await Promise.race([
        Promise.resolve()
          .then(operation)
          .then(
            () => true,
            () => true
          ),
        new Promise(resolve => {
          timeoutId = setTimeout(() => resolve(false), timeoutMs);
        }),
      ]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  async _cleanupResources() {
    // Reject request waiters before closing transports so callers do not hang.
    for (const [, bridge] of this.clientBridges.entries()) {
      for (const [, request] of bridge.pendingRequests.entries()) {
        clearTimeout(request.timeout);
        request.reject(new Error('Server stopping'));
      }
    }
    this.clientBridges.clear();
    for (const [, pendingRequest] of this.pendingRequests) {
      clearTimeout(pendingRequest.timeout);
      pendingRequest.reject(new Error('Server stopping'));
    }
    this.pendingRequests.clear();

    // SSE transports must close before the HTTP listener or server.close()
    // can wait forever on their long-lived responses.
    const sseSessionIds = Array.from(this.sseTransports.keys());
    const unsettledTransports = await Promise.all(
      sseSessionIds.map(async sessionId => {
        const transport = this.sseTransports.get(sessionId);
        const settled = await this._settleWithin(() => this._cleanupSSESession(sessionId, { closeTransport: true }));
        return settled ? null : transport;
      })
    );
    const transports = Array.from(new Set([...this.activeConnections, ...unsettledTransports.filter(Boolean)]));
    this.activeConnections.clear();
    this.sseTransports.clear();
    this.sseProtocolServers.clear();
    this.sseConnectionIds.clear();
    this.sseCleanupInProgress.clear();
    for (const timer of this.sseHeartbeatTimers.values()) clearInterval(timer);
    for (const timer of this.sseExpiryTimers.values()) clearTimeout(timer);
    this.sseHeartbeatTimers.clear();
    this.sseExpiryTimers.clear();
    this.sseBackpressureState.clear();
    this.connectedProtocolServers.clear();
    this.transportExecutionContexts.clear();
    await Promise.all(
      transports.map(transport =>
        this._settleWithin(async () => {
          if (typeof transport?.close === 'function') await transport.close();
        })
      )
    );

    const httpServer = this.httpServer;
    this.httpServer = null;
    if (httpServer) {
      const closeHttp = () =>
        new Promise(resolve => {
          try {
            httpServer.close(() => resolve());
          } catch (_error) {
            resolve();
          }
        });
      const closedGracefully = await this._settleWithin(closeHttp);
      if (!closedGracefully) {
        if (typeof httpServer.closeAllConnections === 'function') httpServer.closeAllConnections();
        if (typeof httpServer.closeIdleConnections === 'function') httpServer.closeIdleConnections();
        await this._settleWithin(closeHttp, Math.max(25, Math.floor(this.shutdownGraceMs / 2)));
      }
    }

    const wsServer = this.wsServer;
    this.wsServer = null;
    this._wsReadyPromise = null;
    const sockets = Array.from(this.wsConnections);
    for (const ws of sockets) {
      try {
        ws.close(1001, 'Server stopping');
      } catch (_error) {
        // Continue closing the remaining sockets.
      }
    }

    if (wsServer) {
      const closeWebSocketServer = () =>
        new Promise(resolve => {
          try {
            wsServer.close(() => resolve());
          } catch (_error) {
            resolve();
          }
        });
      const closedGracefully = await this._settleWithin(closeWebSocketServer);
      if (!closedGracefully) {
        for (const ws of sockets) {
          try {
            ws.terminate();
          } catch (_error) {
            // Continue terminating the remaining sockets.
          }
        }
        await this._settleWithin(closeWebSocketServer, Math.max(25, Math.floor(this.shutdownGraceMs / 2)));
      }
    }
    this.wsConnections.clear();
    this.internalClients.clear();
    this.internalClient = null;
    this.internalClientId = null;
    this.activeConnections.clear();

    if (this.healthMonitor) {
      this.healthMonitor.destroy();
    }
    if (this.authManager) {
      this.authManager.destroy();
    }
  }

  stop() {
    if (this._stopPromise) return this._stopPromise;
    if (this.lifecycleState === 'closed') return Promise.resolve();

    const startInFlight = this._startPromise;
    this.lifecycleState = 'stopping';
    this._stopPromise = (async () => {
      this.serverLog('info', '🛑 Stopping Standard Claude MCP Server');
      if (startInFlight) await startInFlight.catch(() => undefined);

      await this._cleanupResources();
      this.lifecycleState = 'closed';
      this.serverLog('info', '✅ Server stopped successfully');
      this.emit('stopped');
    })().catch(error => {
      this.lifecycleState = 'closed';
      this.serverLog('error', '❌ Error stopping server:', error.message);
    });
    return this._stopPromise;
  }

  // Utility methods

  /**
   * Send a logging notification to the MCP client.
   * Uses MCP SDK's sendLoggingMessage to push real-time progress info.
   * @param {'debug'|'info'|'notice'|'warning'|'error'} level - Log level
   * @param {string} message - Human-readable message
   * @param {Object} [data] - Optional structured data to include
   */
  _notifyProtocolClient(protocolServer, level, message, data = null) {
    try {
      if (typeof protocolServer?.sendLoggingMessage !== 'function') return;
      const params = {
        level,
        logger: 'codexomics-agent',
        data: data ? `${message} | ${JSON.stringify(data)}` : message,
      };
      protocolServer.sendLoggingMessage(params).catch(err => {
        // Silently ignore - client may not support logging notifications
        console.debug(`[MCP] Failed to send logging notification: ${err.message}`);
      });
    } catch (e) {
      // Silently ignore - this is best-effort
    }
  }

  _notifyClient(level, message, data = null) {
    for (const protocolServer of this.connectedProtocolServers || []) {
      this._notifyProtocolClient(protocolServer, level, message, data);
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
    const sessionId = String(progress.sessionId || '').trim();
    const transportSessionId = String(progress.transportSessionId || '').trim();
    if (!sessionId || !transportSessionId) {
      this.serverLog('warn', '⚠️ Dropping uncorrelated agent progress notification');
      return;
    }
    const context = this.transportExecutionContexts.get(transportSessionId);
    if (context?.sessionId !== sessionId) {
      this.serverLog('warn', '⚠️ Dropping agent progress with a mismatched MCP transport binding');
      return;
    }
    this._notifyProtocolClient(this.sseProtocolServers.get(transportSessionId), level, `[Agent] ${progress.message}`, {
      ...(progress.data || {}),
      requestId: progress.requestId || null,
    });
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
    for (const protocolServer of this.connectedProtocolServers || []) {
      if (typeof protocolServer?.sendToolListChanged === 'function') {
        protocolServer.sendToolListChanged().catch(() => {});
      }
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
      console.error(`⚠️  Invalid mode '${mode}'. Use 'tools' or 'agent'. Defaulting to 'tools'.`);
    }
  }

  const server = new StandardClaudeMCPServer(3002, 3003, null, getMcpAuthConfig());
  console.error(`🚀 Starting MCP Server in '${server.mode}' mode`);
  server.start().catch(error => {
    console.error('💥 Startup error:', error.message);
    process.exit(1);
  });

  let shutdownPromise = null;
  const shutdown = signal => {
    if (shutdownPromise) return shutdownPromise;
    console.error(`🛑 Received ${signal}; shutting down MCP Server`);
    shutdownPromise = server
      .stop()
      .then(() => {
        process.exitCode = 0;
      })
      .catch(error => {
        console.error('💥 Shutdown error:', error.message);
        process.exitCode = 1;
      });
    return shutdownPromise;
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}
