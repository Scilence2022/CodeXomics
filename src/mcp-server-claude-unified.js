#!/usr/bin/env node

/**
 * Standard Claude MCP Server for CodeXomics
 * 
 * This is a standard MCP server implementation that:
 * 1. Follows the official MCP protocol specification
 * 2. Uses proper SSE transport for Claude Desktop
 * 3. Handles initialization handshake correctly
 * 4. Communicates with CodeXomics via Electron IPC
 * 
 * Based on the official MCP TypeScript SDK
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    InitializeRequestSchema,
    InitializedNotificationSchema,
    PingRequestSchema
} = require('@modelcontextprotocol/sdk/types.js');

const express = require('express');
const cors = require('cors');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');

// Import the organized tools integrator
const ToolsIntegrator = require('./mcp-tools/ToolsIntegrator.js');
const AuthenticationManager = require('./mcp-tools/AuthenticationManager.js');
const ToolCategoryManager = require('./mcp-tools/ToolCategoryManager.js');
const ConnectionHealthMonitor = require('./mcp-tools/ConnectionHealthMonitor.js');

class StandardClaudeMCPServer {
    constructor(httpPort = 3002, wsPort = 3003, mainWindow = null, authConfig = {}) {
        this.httpPort = httpPort;
        this.wsPort = wsPort;
        this.mainWindow = mainWindow;
        this.pendingRequests = new Map();
        this.activeConnections = new Set();

        // Initialize authentication manager
        this.authManager = new AuthenticationManager({
            requireAuth: authConfig.requireAuth !== false,
            enableLocalBypass: authConfig.enableLocalBypass !== false,
            developmentMode: authConfig.developmentMode || false,
            masterKey: authConfig.masterKey || null,
            ...authConfig
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
        this.mcpServer = new Server({
            name: 'codexomics',
            version: '1.0.0',
        }, {
            capabilities: {
                tools: {
                    listChanged: true
                },
                logging: {}
            },
        });

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

    setupMCPServer() {
        console.log('🔧 Setting up MCP Server handlers');

        // Handle initialization
        this.mcpServer.setRequestHandler(InitializeRequestSchema, async (request) => {
            console.log('🔄 Handling initialize request');
            console.log('📥 Client info:', JSON.stringify(request.params?.clientInfo, null, 2));
            console.log('📥 Protocol version:', request.params?.protocolVersion);

            this.clientInfo = request.params?.clientInfo;
            this.protocolVersion = request.params?.protocolVersion || '2024-11-05';

            const tools = this.toolsIntegrator.getAvailableTools();
            console.log(`📊 Server has ${tools.length} tools available`);

            const response = {
                protocolVersion: this.protocolVersion,
                capabilities: {
                    tools: {
                        listChanged: true
                    },
                    logging: {}
                },
                serverInfo: {
                    name: 'codexomics',
                    version: '1.0.0',
                    description: `CodeXomics MCP Server with ${tools.length} genomics tools`
                }
            };

            console.log('✅ Initialize response:', JSON.stringify(response, null, 2));
            return response;
        });

        // Handle initialized notification
        this.mcpServer.setNotificationHandler(InitializedNotificationSchema, async (notification) => {
            console.log('✅ Received initialized notification');
            this.isInitialized = true;
            console.log('🎯 MCP Server is now fully initialized and ready');
        });

        // Handle list tools
        this.mcpServer.setRequestHandler(ListToolsRequestSchema, async (request) => {
            console.log('📋 Handling tools/list request');

            if (!this.isInitialized) {
                console.warn('⚠️  Tools list requested before initialization complete');
            }

            const tools = this.toolsIntegrator.getAvailableTools();
            console.log(`✅ Returning ${tools.length} tools`);

            return {
                tools: tools
            };
        });

        // Handle tool execution
        this.mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name: toolName, arguments: args } = request.params;
            console.log(`🔧 Executing tool: ${toolName}`, JSON.stringify(args, null, 2));

            const startTime = Date.now();

            try {
                // Execute tool with 30 second timeout
                const result = await Promise.race([
                    this.toolsIntegrator.executeTool(toolName, args, args?.clientId),
                    new Promise((_, reject) => {
                        setTimeout(() => {
                            reject(new Error(`Tool execution timeout after 30 seconds`));
                        }, 30000);
                    })
                ]);

                const executionTime = Date.now() - startTime;
                console.log(`✅ Tool ${toolName} executed successfully in ${executionTime}ms`);

                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2)
                        }
                    ]
                };

            } catch (error) {
                console.error(`❌ Tool ${toolName} execution failed:`, error);

                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error executing tool ${toolName}: ${error.message}`
                        }
                    ],
                    isError: true
                };
            }
        });

        // Handle ping requests
        this.mcpServer.setRequestHandler(PingRequestSchema, async (request) => {
            console.log('🏓 Handling ping request');
            return {
                status: 'pong',
                timestamp: Date.now(),
                serverReady: this.isInitialized,
                mainWindowReady: !!(this.mainWindow && !this.mainWindow.isDestroyed())
            };
        });

        // Connection event handlers
        this.mcpServer.onclose = () => {
            console.log('🔌 MCP Server connection closed');
            this.isInitialized = false;
        };

        this.mcpServer.onerror = (error) => {
            console.error('❌ MCP Server error:', error);
        };

        console.log('✅ MCP Server handlers configured');
    }

    setupExpressApp() {
        console.log('🌐 Setting up Express app');

        // Basic middleware
        this.app.use(cors({
            origin: '*',
            methods: ['GET', 'POST', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Cache-Control', 'Authorization']
        }));

        this.app.use(express.json());

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
                    message: authResult.error || 'Invalid or missing authentication'
                });
            }

            // Attach session to request
            req.mcpSession = authResult;
            next();
        };

        // Request logging
        this.app.use((req, res, next) => {
            console.log(`📥 ${req.method} ${req.path}`);
            if (req.method === 'POST') {
                console.log(`📦 POST Headers:`, req.headers);
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
                timestamp: Date.now()
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
                    clientBridge: this.clientBridges.size > 0
                },
                toolCount: tools.length,
                toolCategories: {
                    serverSide: categorized.serverOnly.length,
                    clientSide: categorized.clientOnly.length,
                    hybrid: categorized.hybrid.length
                },
                transport: {
                    sse: `http://localhost:${this.httpPort}/sse`,
                    websocket: `ws://localhost:${this.wsPort}`,
                    clientBridge: `http://localhost:${this.httpPort}/bridge`
                },
                authentication: {
                    required: this.authManager.config.requireAuth,
                    localBypass: this.authManager.config.enableLocalBypass,
                    activeSessions: authStats.activeSessions
                },
                status: this.isInitialized ? 'ready' : 'initializing'
            });
        });

        // SSE endpoint for Claude Desktop
        this.app.get('/sse', this.authMiddleware, (req, res) => {
            this.handleSSEConnection(req, res);
        });

        // POST endpoint for MCP clients that use HTTP POST
        this.app.post('/sse', this.authMiddleware, async (req, res) => {
            // Monitor connection events
            req.on('close', () => {
                console.log('🔌 POST request connection closed');
            });
            req.on('error', (error) => {
                console.log('❌ POST request error:', error);
            });

            await this.handleMCPPostRequest(req, res);
        });

        // Root endpoint for other MCP clients
        this.app.get('/', (req, res) => {
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
                    capabilities: b.capabilities
                }))
            });
        });

        // POST endpoint for root path
        this.app.post('/', this.authMiddleware, async (req, res) => {
            // Monitor connection events
            req.on('close', () => {
                console.log('🔌 POST request connection closed');
            });
            req.on('error', (error) => {
                console.log('❌ POST request error:', error);
            });

            await this.handleMCPPostRequest(req, res);
        });

        console.log('✅ Express app configured');
    }

    setupWebSocketServer() {
        console.log('🔧 Setting up WebSocket server');

        // Create WebSocket server
        this.wsServer = new WebSocket.Server({
            port: this.wsPort,
            perMessageDeflate: false,
            maxPayload: 1024 * 1024 // 1MB max payload
        });

        this.wsServer.on('connection', (ws, req) => {
            console.log('🔗 New WebSocket connection from:', req.socket.remoteAddress);

            // WebSocket connections need to authenticate via first message
            let authenticated = false;
            let sessionId = null;
            let connectionId = null;

            // Set authentication timeout
            const authTimeout = setTimeout(() => {
                if (!authenticated) {
                    console.log('❌ WebSocket authentication timeout');
                    ws.send(JSON.stringify({
                        type: 'error',
                        error: 'Authentication timeout. Please send auth message within 10 seconds.'
                    }));
                    ws.close(1008, 'Authentication timeout');
                }
            }, 10000);

            // Track connection
            this.wsConnections.add(ws);
            console.log(`📊 WebSocket connections: ${this.wsConnections.size}`);

            // Handle messages
            ws.on('message', async (data) => {
                try {
                    const message = JSON.parse(data.toString());

                    // Handle authentication message first
                    if (!authenticated) {
                        // Check for internal client from CodeXomics app (localhost only)
                        if (message.type === 'internal-client') {
                            const clientIp = req.socket.remoteAddress;
                            const isLocalhost = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1';

                            if (!isLocalhost) {
                                ws.send(JSON.stringify({
                                    type: 'error',
                                    error: 'Internal client connections only allowed from localhost'
                                }));
                                ws.close(1008, 'Not localhost');
                                return;
                            }

                            clearTimeout(authTimeout);
                            authenticated = true;
                            const clientWindowId = message.windowId || 'default';
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
                                windowId: clientWindowId
                            });

                            // Send connection success
                            ws.send(JSON.stringify({
                                type: 'internal-client-connected',
                                sessionId,
                                serverId: 'unified-claude-mcp',
                                capabilities: ['tools', 'logging'],
                                windowId: clientWindowId
                            }));

                            console.log(`✅ Internal CodeXomics client connected: ${connectionId} (windowId: ${clientWindowId})`);
                            return;
                        }

                        if (message.type === 'authenticate') {
                            clearTimeout(authTimeout);

                            const apiKey = message.apiKey || message.headers?.Authorization;

                            if (!apiKey) {
                                ws.send(JSON.stringify({
                                    type: 'error',
                                    error: 'Missing API key in authentication message'
                                }));
                                ws.close(1008, 'Missing API key');
                                return;
                            }

                            // Validate API key
                            const authResult = this.authManager.validateApiKey(apiKey, {
                                type: 'websocket',
                                ip: req.socket.remoteAddress,
                                userAgent: req.headers['user-agent']
                            });

                            if (!authResult.valid) {
                                ws.send(JSON.stringify({
                                    type: 'error',
                                    error: authResult.error || 'Authentication failed'
                                }));
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
                                sessionId
                            });

                            // Send authentication success
                            ws.send(JSON.stringify({
                                type: 'authenticated',
                                sessionId,
                                serverId: 'unified-claude-mcp',
                                capabilities: ['tools', 'logging'],
                                expiresAt: authResult.expiresAt
                            }));

                            console.log(`✅ WebSocket authenticated: ${connectionId}`);
                            return;
                        } else {
                            ws.send(JSON.stringify({
                                type: 'error',
                                error: 'Please authenticate first'
                            }));
                            return;
                        }
                    }

                    // Update activity
                    this.healthMonitor.updateActivity(connectionId);

                    // Handle tool execution results from internal client
                    if (message.type === 'tool-execution-result') {
                        const { requestId, result, error } = message;
                        const pending = this.pendingRequests.get(requestId);

                        if (pending) {
                            clearTimeout(pending.timeout);
                            this.pendingRequests.delete(requestId);

                            if (error) {
                                console.log(`❌ Tool execution failed via internal client: ${pending.toolName}`, error);
                                pending.reject(new Error(error));
                            } else {
                                console.log(`✅ Tool execution completed via internal client: ${pending.toolName}`);
                                pending.resolve(result);
                            }
                        } else {
                            console.warn(`⚠️ Received tool result for unknown requestId: ${requestId}`);
                        }
                        return; // Don't process further
                    }

                    console.log('📥 WebSocket message:', message);

                    // Handle MCP-style messages
                    const response = await this.handleWebSocketMessage(message, sessionId);
                    if (response) {
                        ws.send(JSON.stringify(response));
                    }
                } catch (error) {
                    console.error('❌ WebSocket message error:', error);
                    ws.send(JSON.stringify({
                        jsonrpc: '2.0',
                        error: {
                            code: -32700,
                            message: 'Parse error',
                            data: error.message
                        },
                        id: null
                    }));
                }
            });

            // Handle connection close
            ws.on('close', () => {
                console.log('🔌 WebSocket connection closed');
                this.wsConnections.delete(ws);

                // Clean up internal client reference if this was the internal client
                if (ws.windowId && this.internalClients.has(ws.windowId)) {
                    console.log(`🔌 Internal CodeXomics client disconnected (windowId: ${ws.windowId})`);
                    this.internalClients.delete(ws.windowId);
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

                console.log(`📊 WebSocket connections: ${this.wsConnections.size}`);
            });

            // Handle errors
            ws.on('error', (error) => {
                console.error('❌ WebSocket error:', error);
                this.wsConnections.delete(ws);

                if (connectionId) {
                    this.healthMonitor.unregisterConnection(connectionId);
                }
            });

            // Send initial connection confirmation
            ws.send(JSON.stringify({
                type: 'connection',
                status: 'connected',
                serverId: 'unified-claude-mcp',
                capabilities: ['tools', 'logging']
            }));
        });

        this.wsServer.on('error', (error) => {
            console.error('❌ WebSocket server error:', error);
        });

        console.log('✅ WebSocket server configured');
    }

    async handleWebSocketMessage(message, sessionId) {
        const { method, params, id, jsonrpc } = message;

        // Validate session
        const sessionValidation = this.authManager.validateSession(sessionId);
        if (!sessionValidation.valid) {
            return {
                jsonrpc: '2.0',
                error: {
                    code: -32001,
                    message: sessionValidation.error || 'Invalid session'
                },
                id
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
                            logging: {}
                        },
                        serverInfo: {
                            name: 'codexomics',
                            version: '1.0.0'
                        }
                    },
                    id
                };

            case 'tools/list':
                const tools = this.toolsIntegrator.getAvailableTools();
                return {
                    jsonrpc: '2.0',
                    result: { tools },
                    id
                };

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
                            content: [{
                                type: 'text',
                                text: JSON.stringify(result, null, 2)
                            }]
                        },
                        id
                    };
                } catch (error) {
                    return {
                        jsonrpc: '2.0',
                        error: {
                            code: -32603,
                            message: error.message
                        },
                        id
                    };
                }

            default:
                return {
                    jsonrpc: '2.0',
                    error: {
                        code: -32601,
                        message: `Method not found: ${method}`
                    },
                    id
                };
        }
    }

    handleSSEConnection(req, res) {
        console.log('🔄 New SSE connection request');

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
                sessionId
            });

            // Create SSE transport - this will handle setting SSE headers
            const transport = new SSEServerTransport('/sse', res);

            // Track connection
            this.activeConnections.add(transport);
            console.log(`📊 Active connections: ${this.activeConnections.size}`);

            // Connect MCP server to transport
            this.mcpServer.connect(transport);
            console.log('✅ SSE connection established and MCP server connected');

            // Handle connection events
            req.on('close', () => {
                console.log('🔌 SSE connection closed by client');
                this.activeConnections.delete(transport);
                this.healthMonitor.unregisterConnection(connectionId);
                console.log(`📊 Active connections: ${this.activeConnections.size}`);
            });

            req.on('error', (error) => {
                console.error('❌ SSE connection error:', error);
                this.activeConnections.delete(transport);
                this.healthMonitor.unregisterConnection(connectionId);
            });

            res.on('error', (error) => {
                console.error('❌ SSE response error:', error);
                this.activeConnections.delete(transport);
                this.healthMonitor.unregisterConnection(connectionId);
            });

            res.on('close', () => {
                console.log('🔌 SSE response closed');
                this.activeConnections.delete(transport);
                this.healthMonitor.unregisterConnection(connectionId);
            });

        } catch (error) {
            console.error('❌ Failed to establish SSE connection:', error);
            if (!res.headersSent) {
                res.status(500).json({
                    error: 'Failed to establish SSE connection',
                    message: error.message
                });
            }
        }
    }

    async handleMCPPostRequest(req, res) {
        const startTime = Date.now();
        console.log('📮 Received POST request:', req.path);
        console.log('📦 Request body:', JSON.stringify(req.body, null, 2));
        console.log('🔗 Client connection info:', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            connection: req.get('Connection'),
            contentLength: req.get('Content-Length')
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
                        message: 'Invalid Request - missing or invalid jsonrpc field'
                    },
                    id: id || null
                });
            }

            if (!method) {
                return res.status(400).json({
                    jsonrpc: '2.0',
                    error: {
                        code: -32600,
                        message: 'Invalid Request - missing method field'
                    },
                    id: id || null
                });
            }

            console.log(`🔧 Processing MCP method: ${method}`);

            let response;

            switch (method) {
                case 'initialize':
                    console.log('🔄 Handling initialize request');
                    this.clientInfo = params?.clientInfo;
                    this.protocolVersion = params?.protocolVersion || '2024-11-05';

                    const tools = this.toolsIntegrator.getAvailableTools();
                    console.log(`📊 Server has ${tools.length} tools available`);

                    response = {
                        jsonrpc: '2.0',
                        result: {
                            protocolVersion: this.protocolVersion,
                            capabilities: {
                                tools: {
                                    listChanged: true
                                },
                                logging: {}
                            },
                            serverInfo: {
                                name: 'codexomics',
                                version: '1.0.0',
                                description: `CodeXomics MCP Server with ${tools.length} genomics tools`
                            }
                        },
                        id
                    };
                    break;

                case 'initialized':
                    console.log('✅ Handling initialized notification');
                    this.isInitialized = true;
                    // Notifications don't need responses
                    return res.status(204).send();

                case 'tools/list':
                    console.log('📋 Handling tools/list request');
                    const availableTools = this.toolsIntegrator.getAvailableTools();
                    response = {
                        jsonrpc: '2.0',
                        result: {
                            tools: availableTools
                        },
                        id
                    };
                    break;

                case 'tools/call':
                    console.log('🔧 Handling tools/call request');
                    const { name: toolName, arguments: args } = params;
                    const startTime = Date.now();

                    try {
                        const result = await Promise.race([
                            this.toolsIntegrator.executeTool(toolName, args, args?.clientId),
                            new Promise((_, reject) => {
                                setTimeout(() => {
                                    reject(new Error(`Tool execution timeout after 30 seconds`));
                                }, 30000);
                            })
                        ]);

                        const executionTime = Date.now() - startTime;
                        console.log(`✅ Tool ${toolName} executed in ${executionTime}ms`);

                        response = {
                            jsonrpc: '2.0',
                            result: {
                                content: [
                                    {
                                        type: 'text',
                                        text: JSON.stringify(result, null, 2)
                                    }
                                ]
                            },
                            id
                        };

                    } catch (error) {
                        console.error(`❌ Tool ${toolName} failed:`, error);
                        response = {
                            jsonrpc: '2.0',
                            result: {
                                content: [
                                    {
                                        type: 'text',
                                        text: `Error executing tool ${toolName}: ${error.message}`
                                    }
                                ],
                                isError: true
                            },
                            id
                        };
                    }
                    break;

                case 'ping':
                    console.log('🏓 Handling ping request');
                    response = {
                        jsonrpc: '2.0',
                        result: {
                            status: 'pong',
                            timestamp: Date.now(),
                            serverReady: this.isInitialized,
                            mainWindowReady: !!(this.mainWindow && !this.mainWindow.isDestroyed())
                        },
                        id
                    };
                    break;

                default:
                    console.log(`❓ Unknown method: ${method}`);
                    response = {
                        jsonrpc: '2.0',
                        error: {
                            code: -32601,
                            message: `Method not found: ${method}`
                        },
                        id
                    };
                    break;
            }

            console.log('✅ Sending response:', JSON.stringify(response, null, 2));
            console.log('📡 Response headers being sent:', res.getHeaders());

            // Ensure response is sent properly
            res.json(response);

            // Ensure response is flushed
            if (res.flush) {
                res.flush();
            }

            console.log('📤 Response sent to client');
            console.log(`⏱️  Total request processing time: ${Date.now() - startTime}ms`);

        } catch (error) {
            console.error('❌ POST request error:', error);
            const errorResponse = {
                jsonrpc: '2.0',
                error: {
                    code: -32603,
                    message: 'Internal error',
                    data: error.message
                },
                id: req.body?.id || null
            };
            res.status(500).json(errorResponse);
        }
    }

    setupIPCCommunication() {
        if (!this.mainWindow) {
            console.log('ℹ️  Running in standalone mode (no Electron main window)');
            console.log('   CodeXomics app can connect via WebSocket at ws://localhost:' + this.wsPort);
            return;
        }

        console.log('🔧 Setting up IPC communication');

        const { ipcMain } = require('electron');

        // Listen for tool responses
        ipcMain.on('mcp-tool-response', (event, response) => {
            this.handleToolResponse(response);
        });

        // Listen for server status updates
        ipcMain.on('internal-mcp-server-ready', () => {
            console.log('✅ Internal MCP Server is ready');
        });

        ipcMain.on('internal-mcp-server-stopped', () => {
            console.log('🛑 Internal MCP Server stopped');
        });

        console.log('✅ IPC communication configured');
    }

    handleToolResponse(response) {
        const { requestId, success, result, error } = response;

        const pendingRequest = this.pendingRequests.get(requestId);
        if (!pendingRequest) {
            console.warn(`❓ Received response for unknown request ID: ${requestId}`);
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
        const targetWindowId = parameters?.windowId || null;
        // Remove windowId from parameters before forwarding to avoid confusing tool handlers
        if (parameters?.windowId) {
            parameters = { ...parameters };
            delete parameters.windowId;
        }

        // Try WebSocket internal client first (multi-window aware)
        if (this.internalClients.size > 0) {
            return await this.executeViaInternalClient(toolName, parameters, clientId, targetWindowId);
        }

        // Try local Electron IPC if available (multi-window aware)
        if (this.windowRegistry.size > 0) {
            return await this.executeViaElectronIPC(toolName, parameters, clientId, targetWindowId);
        }

        // Legacy: single mainWindow fallback
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            return await this.executeViaElectronIPC(toolName, parameters, clientId, null);
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
        // Resolve the target WS client
        let targetClient = null;
        let resolvedWindowId = targetWindowId;

        if (targetWindowId && this.internalClients.has(targetWindowId)) {
            // Explicit windowId specified — use that client
            targetClient = this.internalClients.get(targetWindowId);
        } else {
            // Default: find the focused window's client, or fall back to first available
            targetClient = this.getFocusedWindowClient() || this.internalClient;
            if (targetClient) {
                resolvedWindowId = targetClient.windowId || 'default';
            }
        }

        if (!targetClient || targetClient.readyState !== 1) {
            throw new Error(
                `No active WebSocket client for window '${targetWindowId || 'focused'}'. ` +
                `Available windows: [${Array.from(this.internalClients.keys()).join(', ')}]`
            );
        }

        const requestId = `mcp_ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Convert snake_case tool name to camelCase method name
        const methodName = toolName.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error(`Tool execution timeout for ${toolName} via internal client (window: ${resolvedWindowId})`));
            }, 30000);

            this.pendingRequests.set(requestId, {
                resolve,
                reject,
                timeout,
                toolName,
                parameters
            });

            // Send tool execution request via WebSocket to target window's client
            console.log(`📡 [MCP Server] Sending tool execution via WebSocket: ${toolName} -> ${methodName} (window: ${resolvedWindowId})`);
            targetClient.send(JSON.stringify({
                type: 'tool-execution',
                requestId,
                method: methodName,
                toolName,
                parameters,
                clientId
            }));
        });
    }


    async executeViaElectronIPC(toolName, parameters, clientId, targetWindowId) {
        // Resolve the target BrowserWindow
        let targetWindow = null;

        if (targetWindowId && this.windowRegistry.has(targetWindowId)) {
            const entry = this.windowRegistry.get(targetWindowId);
            targetWindow = entry.window || entry;
        } else if (this.windowRegistry.size > 0) {
            // Default: find the focused window, or fall back to first available
            for (const [wid, entry] of this.windowRegistry.entries()) {
                const win = entry.window || entry;
                if (win && !win.isDestroyed() && win.isFocused()) {
                    targetWindow = win;
                    targetWindowId = wid;
                    break;
                }
            }
            // Fallback to first available window
            if (!targetWindow) {
                for (const [wid, entry] of this.windowRegistry.entries()) {
                    const win = entry.window || entry;
                    if (win && !win.isDestroyed()) {
                        targetWindow = win;
                        targetWindowId = wid;
                        break;
                    }
                }
            }
        } else if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            // Legacy fallback
            targetWindow = this.mainWindow;
            targetWindowId = 'legacy';
        }

        if (!targetWindow || targetWindow.isDestroyed()) {
            throw new Error(`No active window for '${targetWindowId || 'focused'}'. Available: [${Array.from(this.windowRegistry.keys()).join(', ')}]`);
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
                resolve,
                reject,
                timeout,
                toolName,
                parameters
            });

            // Send tool execution request to renderer process via IPC
            console.log(`📡 [MCP Server] Sending tool execution via Electron IPC: ${toolName} -> ${methodName} (window: ${targetWindowId})`);
            targetWindow.webContents.send('mcp-tool-call', {
                requestId,
                method: methodName,
                parameters,
                clientId
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
                timeout
            });

            // Send execution request to bridge
            console.log(`📡 [MCP Server] Sending tool execution via Bridge: ${toolName}`);

            // The bridge client will poll for pending requests
            bridge.lastActivity = Date.now();
        });
    }

    handleClientBridgeRegistration(req, res) {
        const { bridgeId, capabilities } = req.body;

        if (!bridgeId) {
            return res.status(400).json({
                success: false,
                error: 'Bridge ID required'
            });
        }

        const bridge = {
            id: bridgeId,
            sessionId: req.mcpSession.sessionId,
            registeredAt: Date.now(),
            lastActivity: Date.now(),
            capabilities: capabilities || [],
            pendingRequests: new Map(),
            responseQueue: []
        };

        this.clientBridges.set(bridgeId, bridge);

        console.log(`✅ Client bridge registered: ${bridgeId}`);

        res.json({
            success: true,
            bridgeId,
            message: 'Bridge registered successfully'
        });
    }

    handleClientBridgeUnregistration(req, res) {
        const { bridgeId } = req.body;

        if (this.clientBridges.delete(bridgeId)) {
            console.log(`🔌 Client bridge unregistered: ${bridgeId}`);

            res.json({
                success: true,
                message: 'Bridge unregistered successfully'
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Bridge not found'
            });
        }
    }

    async handleClientBridgeExecution(req, res) {
        const { bridgeId, requestId, result, error } = req.body;

        const bridge = this.clientBridges.get(bridgeId);

        if (!bridge) {
            return res.status(404).json({
                success: false,
                error: 'Bridge not found'
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
                message: 'Response recorded'
            });
        }

        // Return any pending execution requests for this bridge
        const pending = Array.from(bridge.pendingRequests.entries())
            .map(([id, req]) => ({
                requestId: id,
                toolName: req.toolName,
                parameters: req.parameters
            }));

        res.json({
            success: true,
            pendingRequests: pending
        });
    }

    setupErrorHandling() {
        process.on('SIGINT', async () => {
            console.log('🛑 Received SIGINT, shutting down gracefully');
            await this.stop();
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            console.log('🛑 Received SIGTERM, shutting down gracefully');
            await this.stop();
            process.exit(0);
        });

        process.on('uncaughtException', (error) => {
            console.error('💥 Uncaught exception:', error);
            process.exit(1);
        });

        process.on('unhandledRejection', (reason, promise) => {
            console.error('💥 Unhandled rejection at:', promise, 'reason:', reason);
            process.exit(1);
        });
    }

    async start() {
        console.log('🚀 Starting Standard Claude MCP Server');

        try {
            await new Promise((resolve, reject) => {
                this.httpServer = this.app.listen(this.httpPort, (error) => {
                    if (error) {
                        reject(new Error(`Failed to start HTTP server on port ${this.httpPort}: ${error.message}`));
                        return;
                    }
                    resolve();
                });
            });

            // Configure server timeouts
            this.httpServer.keepAliveTimeout = 61000; // 61 seconds
            this.httpServer.headersTimeout = 62000; // 62 seconds
            this.httpServer.timeout = 120000; // 2 minutes

            console.log('✅ Standard Claude MCP Server started successfully');
            console.log(`📡 HTTP Server: http://localhost:${this.httpPort}`);
            console.log(`🌐 SSE Endpoint: http://localhost:${this.httpPort}/sse`);
            console.log(`📋 Server Info: http://localhost:${this.httpPort}/mcp`);
            console.log(`🔗 WebSocket Server: ws://localhost:${this.wsPort}`);
            console.log(`🔧 IPC Communication: ${!!this.mainWindow}`);
            console.log('');
            console.log('🎯 Ready for Claude Desktop connections!');
            console.log('');

        } catch (error) {
            console.error('💥 Failed to start server:', error.message);
            process.exit(1);
        }
    }

    async stop() {
        console.log('🛑 Stopping Standard Claude MCP Server');

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
            for (const [bridgeId, bridge] of this.clientBridges.entries()) {
                for (const [reqId, req] of bridge.pendingRequests.entries()) {
                    clearTimeout(req.timeout);
                    req.reject(new Error('Server stopping'));
                }
            }
            this.clientBridges.clear();
            // Close HTTP server
            if (this.httpServer) {
                await new Promise((resolve) => {
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
                await new Promise((resolve) => {
                    this.wsServer.close(resolve);
                });
            }

            // Clear pending requests
            for (const [requestId, pendingRequest] of this.pendingRequests) {
                clearTimeout(pendingRequest.timeout);
                pendingRequest.reject(new Error('Server stopping'));
            }
            this.pendingRequests.clear();

            // Clear active connections
            this.activeConnections.clear();

            console.log('✅ Server stopped successfully');

        } catch (error) {
            console.error('❌ Error stopping server:', error.message);
        }
    }

    // Utility methods
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            activeConnections: this.activeConnections.size,
            wsConnections: this.wsConnections.size,
            clientBridges: this.clientBridges.size,
            pendingRequests: this.pendingRequests.size,
            mainWindowReady: !!(this.mainWindow && !this.mainWindow.isDestroyed()),
            protocolVersion: this.protocolVersion,
            clientInfo: this.clientInfo,
            systemHealth: this.healthMonitor.getSystemHealth(),
            authenticationEnabled: this.authManager.config.requireAuth
        };
    }

    getConnectedClientsCount() {
        return this.activeConnections.size + this.wsConnections.size;
    }

    // Multi-window support: Set reference to the authoritative windowRegistry from main.js
    setMainWindowRegistry(registry) {
        this.mainWindowRegistry = registry;
        console.log(`📋 [MCP Server] Linked to main window registry (${registry.size} windows)`);
    }

    // Multi-window support: Register a BrowserWindow for IPC routing
    registerWindow(windowId, browserWindow) {
        this.windowRegistry.set(windowId, { window: browserWindow, genomeName: null });
        console.log(`📋 [MCP Server] Registered window: ${windowId} (total: ${this.windowRegistry.size})`);
    }

    // Multi-window support: Unregister a BrowserWindow
    unregisterWindow(windowId) {
        this.windowRegistry.delete(windowId);
        // Also clean up any associated WS client
        if (this.internalClients.has(windowId)) {
            this.internalClients.delete(windowId);
        }
        console.log(`📋 [MCP Server] Unregistered window: ${windowId} (total: ${this.windowRegistry.size})`);
    }

    // Multi-window support: Get the WebSocket client for the currently focused window
    getFocusedWindowClient() {
        // Try to find the focused window in our registry
        for (const [windowId, entry] of this.windowRegistry.entries()) {
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
        const windows = [];
        for (const [windowId, entry] of registry.entries()) {
            const win = entry.window || entry;
            if (!win || win.isDestroyed()) continue;
            windows.push({
                windowId,
                genomeName: entry.genomeName || null,
                isFocused: win.isFocused(),
                hasWsClient: this.internalClients.has(windowId),
                isDestroyed: false
            });
        }
        return windows;
    }

    async ping() {
        try {
            const result = await this.executeToolOnClient('ping', {});
            return {
                success: true,
                result,
                timestamp: Date.now()
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                timestamp: Date.now()
            };
        }
    }
}

// Export the class
module.exports = StandardClaudeMCPServer;

// Start server if run directly
if (require.main === module) {
    const server = new StandardClaudeMCPServer();
    server.start().catch((error) => {
        console.error('💥 Startup error:', error.message);
        process.exit(1);
    });
}