#!/usr/bin/env node

/**
 * Minimal MCP Server for Genome AI Studio
 * 
 * A clean, minimal implementation using the official @modelcontextprotocol/sdk
 * Focuses on core MCP protocol compliance and genomics tools integration
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
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

// Import tools integrator
const ToolsIntegrator = require('../mcp-tools/ToolsIntegrator.js');

class MinimalMCPServer {
    constructor(port = 3003) {
        this.port = port;
        this.mainWindow = null;
        this.pendingRequests = new Map();
        
        // Server state
        this.isInitialized = false;
        this.clientInfo = null;
        
        // Create MCP server
        this.server = new Server(
            {
                name: 'genome-ai-studio-minimal',
                version: '1.0.0',
            },
            {
                capabilities: {
                    tools: {},
                    logging: {}
                },
            }
        );
        
        // Initialize tools
        this.tools = new ToolsIntegrator(this);
        
        // Setup handlers
        this.setupHandlers();
        
        // Express app for HTTP/SSE transport
        this.app = express();
        this.setupExpress();
    }
    
    setupHandlers() {
        console.log('🔧 Setting up MCP handlers');
        
        // Initialize
        this.server.setRequestHandler(InitializeRequestSchema, async (request) => {
            console.log('🔄 Initialize request received');
            this.clientInfo = request.params?.clientInfo;
            
            const tools = this.tools.getAvailableTools();
            
            return {
                protocolVersion: request.params?.protocolVersion || '2024-11-05',
                capabilities: {
                    tools: {
                        listChanged: true
                    },
                    logging: {}
                },
                serverInfo: {
                    name: 'genome-ai-studio-minimal',
                    version: '1.0.0',
                    description: `Minimal Genome AI Studio MCP Server (${tools.length} tools)`
                }
            };
        });
        
        // Initialized notification
        this.server.setNotificationHandler(InitializedNotificationSchema, async () => {
            console.log('✅ Client initialized');
            this.isInitialized = true;
        });
        
        // List tools
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            console.log('📋 Tools list requested');
            const tools = this.tools.getAvailableTools();
            return { tools };
        });
        
        // Call tool
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            console.log(`🔧 Tool call: ${name}`);
            
            try {
                const result = await this.tools.executeTool(name, args, args?.clientId);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2)
                        }
                    ]
                };
            } catch (error) {
                console.error(`❌ Tool error: ${error.message}`);
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error: ${error.message}`
                        }
                    ],
                    isError: true
                };
            }
        });
        
        // Ping
        this.server.setRequestHandler(PingRequestSchema, async () => {
            console.log('🏓 Ping received');
            return {
                status: 'pong',
                timestamp: Date.now(),
                initialized: this.isInitialized
            };
        });
        
        console.log('✅ MCP handlers configured');
    }
    
    setupExpress() {
        // Basic middleware
        this.app.use(cors());
        this.app.use(express.json());
        
        // Logging
        this.app.use((req, res, next) => {
            console.log(`📥 ${req.method} ${req.path}`);
            next();
        });
        
        // Health endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'ok',
                initialized: this.isInitialized,
                tools: this.tools.getAvailableTools().length,
                timestamp: Date.now()
            });
        });
        
        // MCP info endpoint
        this.app.get('/mcp', (req, res) => {
            res.json({
                name: 'genome-ai-studio-minimal',
                version: '1.0.0',
                description: 'Minimal Genome AI Studio MCP Server',
                transport: {
                    sse: `http://localhost:${this.port}/sse`
                },
                tools: this.tools.getAvailableTools().length,
                initialized: this.isInitialized
            });
        });
        
        // SSE endpoint
        this.app.get('/sse', (req, res) => {
            console.log('🔄 SSE connection request');
            
            try {
                // Create SSE transport
                const transport = new SSEServerTransport('/sse', res);
                
                // Connect server
                this.server.connect(transport);
                
                console.log('✅ SSE connected');
                
                // Handle disconnect
                req.on('close', () => {
                    console.log('🔌 SSE disconnected');
                });
                
            } catch (error) {
                console.error('❌ SSE error:', error);
                if (!res.headersSent) {
                    res.status(500).json({ error: error.message });
                }
            }
        });
        
        // Root SSE endpoint
        this.app.get('/', (req, res) => {
            console.log('🔄 Root SSE connection request');
            
            try {
                const transport = new SSEServerTransport('/', res);
                this.server.connect(transport);
                console.log('✅ Root SSE connected');
                
                req.on('close', () => {
                    console.log('🔌 Root SSE disconnected');
                });
                
            } catch (error) {
                console.error('❌ Root SSE error:', error);
                if (!res.headersSent) {
                    res.status(500).json({ error: error.message });
                }
            }
        });
        
        // HTTP POST for JSON-RPC (direct protocol handling)
        this.app.post('/mcp', async (req, res) => {
            console.log('📮 Direct MCP JSON-RPC request');
            console.log('📦 Body:', JSON.stringify(req.body, null, 2));
            
            try {
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                
                const { method, params, id, jsonrpc } = req.body;
                
                if (jsonrpc !== '2.0') {
                    return res.status(400).json({
                        jsonrpc: '2.0',
                        error: { code: -32600, message: 'Invalid Request' },
                        id: id || null
                    });
                }
                
                let result;
                
                switch (method) {
                    case 'initialize':
                        this.clientInfo = params?.clientInfo;
                        const tools = this.tools.getAvailableTools();
                        result = {
                            protocolVersion: params?.protocolVersion || '2024-11-05',
                            capabilities: {
                                tools: { listChanged: true },
                                logging: {}
                            },
                            serverInfo: {
                                name: 'genome-ai-studio-minimal',
                                version: '1.0.0',
                                description: `Minimal Genome AI Studio MCP Server (${tools.length} tools)`
                            }
                        };
                        break;
                        
                    case 'initialized':
                        this.isInitialized = true;
                        return res.status(204).send(); // No response for notifications
                        
                    case 'tools/list':
                        result = { tools: this.tools.getAvailableTools() };
                        break;
                        
                    case 'tools/call':
                        try {
                            const toolResult = await this.tools.executeTool(
                                params.name, 
                                params.arguments, 
                                params.arguments?.clientId
                            );
                            result = {
                                content: [{
                                    type: 'text',
                                    text: JSON.stringify(toolResult, null, 2)
                                }]
                            };
                        } catch (error) {
                            result = {
                                content: [{
                                    type: 'text',
                                    text: `Error: ${error.message}`
                                }],
                                isError: true
                            };
                        }
                        break;
                        
                    case 'ping':
                        result = {
                            status: 'pong',
                            timestamp: Date.now(),
                            initialized: this.isInitialized
                        };
                        break;
                        
                    default:
                        return res.status(400).json({
                            jsonrpc: '2.0',
                            error: { code: -32601, message: 'Method not found' },
                            id
                        });
                }
                
                const response = {
                    jsonrpc: '2.0',
                    result,
                    id
                };
                
                console.log('✅ Response:', JSON.stringify(response, null, 2));
                res.json(response);
                
            } catch (error) {
                console.error('❌ MCP request error:', error);
                res.status(500).json({
                    jsonrpc: '2.0',
                    error: { code: -32603, message: 'Internal error', data: error.message },
                    id: req.body?.id || null
                });
            }
        });
        
        console.log('✅ Express configured');
    }
    
    // Set main window for IPC communication
    setMainWindow(mainWindow) {
        this.mainWindow = mainWindow;
        this.tools.setMainWindow(mainWindow);
        console.log('🪟 Main window set');
    }
    
    // Start the server
    async start() {
        console.log('🚀 Starting Minimal MCP Server');
        
        return new Promise((resolve, reject) => {
            this.httpServer = this.app.listen(this.port, (error) => {
                if (error) {
                    reject(error);
                    return;
                }
                
                console.log('✅ Minimal MCP Server started');
                console.log(`📡 HTTP: http://localhost:${this.port}`);
                console.log(`🌐 SSE: http://localhost:${this.port}/sse`);
                console.log(`📋 MCP: http://localhost:${this.port}/mcp`);
                console.log(`🔧 Tools: ${this.tools.getAvailableTools().length} available`);
                console.log('');
                
                resolve();
            });
        });
    }
    
    // Stop the server
    async stop() {
        console.log('🛑 Stopping server');
        
        if (this.httpServer) {
            await new Promise(resolve => this.httpServer.close(resolve));
        }
        
        // Clear pending requests
        for (const [id, request] of this.pendingRequests) {
            clearTimeout(request.timeout);
            request.reject(new Error('Server stopping'));
        }
        this.pendingRequests.clear();
        
        console.log('✅ Server stopped');
    }
    
    // Get server status
    getStatus() {
        return {
            initialized: this.isInitialized,
            tools: this.tools.getAvailableTools().length,
            clientInfo: this.clientInfo,
            mainWindow: !!this.mainWindow
        };
    }
}

// Export
module.exports = MinimalMCPServer;

// CLI usage
if (require.main === module) {
    const port = process.argv[2] ? parseInt(process.argv[2]) : 3003;
    const server = new MinimalMCPServer(port);
    
    // Handle shutdown
    process.on('SIGINT', async () => {
        await server.stop();
        process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
        await server.stop();
        process.exit(0);
    });
    
    // Start server
    server.start().catch(error => {
        console.error('💥 Failed to start server:', error);
        process.exit(1);
    });
}