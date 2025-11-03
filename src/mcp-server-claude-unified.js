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

class StandardClaudeMCPServer {
    constructor(httpPort = 3002, wsPort = 3003, mainWindow = null) {
        this.httpPort = httpPort;
        this.wsPort = wsPort;
        this.mainWindow = mainWindow;
        this.pendingRequests = new Map();
        this.activeConnections = new Set();
        
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
            allowedHeaders: ['Content-Type', 'Cache-Control']
        }));
        
        this.app.use(express.json());
        
        // Request logging
        this.app.use((req, res, next) => {
            console.log(`📥 ${req.method} ${req.path}`);
            if (req.method === 'POST') {
                console.log(`📦 POST Headers:`, req.headers);
            }
            next();
        });
        
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                serverReady: this.isInitialized,
                mainWindowReady: !!(this.mainWindow && !this.mainWindow.isDestroyed()),
                activeConnections: this.activeConnections.size,
                protocolVersion: this.protocolVersion,
                timestamp: Date.now()
            });
        });
        
        // Server info endpoint
        this.app.get('/mcp', (req, res) => {
            const tools = this.toolsIntegrator.getAvailableTools();
            res.json({
                name: 'codexomics',
                version: '1.0.0',
                description: 'CodeXomics MCP Server',
                protocolVersion: this.protocolVersion,
                capabilities: {
                    tools: true,
                    logging: true
                },
                toolCount: tools.length,
                transport: {
                    sse: `http://localhost:${this.httpPort}/sse`
                },
                status: this.isInitialized ? 'ready' : 'initializing'
            });
        });
        
        // SSE endpoint for Claude Desktop
        this.app.get('/sse', (req, res) => {
            this.handleSSEConnection(req, res);
        });
        
        // POST endpoint for MCP clients that use HTTP POST
        this.app.post('/sse', async (req, res) => {
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
        
        // POST endpoint for root path
        this.app.post('/', async (req, res) => {
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
            
            // Track connection
            this.wsConnections.add(ws);
            console.log(`📊 WebSocket connections: ${this.wsConnections.size}`);
            
            // Handle messages
            ws.on('message', async (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    console.log('📥 WebSocket message:', message);
                    
                    // Handle MCP-style messages
                    const response = await this.handleWebSocketMessage(message);
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
                console.log(`📊 WebSocket connections: ${this.wsConnections.size}`);
            });
            
            // Handle errors
            ws.on('error', (error) => {
                console.error('❌ WebSocket error:', error);
                this.wsConnections.delete(ws);
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
    
    async handleWebSocketMessage(message) {
        const { method, params, id, jsonrpc } = message;
        
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
            // Set CORS headers before creating transport
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
            
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
                console.log(`📊 Active connections: ${this.activeConnections.size}`);
            });
            
            req.on('error', (error) => {
                console.error('❌ SSE connection error:', error);
                this.activeConnections.delete(transport);
            });
            
            res.on('error', (error) => {
                console.error('❌ SSE response error:', error);
                this.activeConnections.delete(transport);
            });
            
            res.on('close', () => {
                console.log('🔌 SSE response closed');
                this.activeConnections.delete(transport);
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
            console.warn('⚠️  No main window available for IPC communication');
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
        if (!this.mainWindow || this.mainWindow.isDestroyed()) {
            throw new Error('Main window not available. Please ensure CodeXomics is running.');
        }
        
        const requestId = `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error(`Tool execution timeout for ${toolName}`));
            }, 30000);
            
            this.pendingRequests.set(requestId, {
                resolve,
                reject,
                timeout,
                toolName,
                parameters
            });
            
            // Send tool execution request to main process
            console.log(`📡 [MCP Server] Sending tool execution to main process: ${toolName}`);
            this.mainWindow.webContents.send('tool-execution', {
                requestId,
                toolName,
                parameters,
                clientId
            });
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
            pendingRequests: this.pendingRequests.size,
            mainWindowReady: !!(this.mainWindow && !this.mainWindow.isDestroyed()),
            protocolVersion: this.protocolVersion,
            clientInfo: this.clientInfo
        };
    }
    
    getConnectedClientsCount() {
        return this.activeConnections.size + this.wsConnections.size;
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