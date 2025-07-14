#!/usr/bin/env node

/**
 * True SSE MCP Server for Cherry Studio Testing
 * All communication happens over SSE stream
 */

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

let sseConnections = new Map();

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
});

// SSE endpoint - all MCP communication happens here
app.get('/', (req, res) => {
    console.log('→ Setting up SSE MCP connection');
    
    const connectionId = Date.now().toString();
    
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
    });
    
    // Store connection
    sseConnections.set(connectionId, res);
    
    // Send initial connection message and simulate MCP handshake
    res.write(`data: {"type":"connection","id":"${connectionId}"}\n\n`);
    
    // After a short delay, simulate server-initiated MCP protocol
    setTimeout(() => {
        console.log('→ Sending server capabilities via SSE');
        
        // Send server capabilities
        const serverInfo = {
            jsonrpc: '2.0',
            method: 'notifications/initialized',
            params: {
                protocolVersion: '2025-03-26',
                capabilities: {
                    tools: { listChanged: true }
                },
                serverInfo: {
                    name: 'sse-test-server',
                    version: '1.0.0'
                }
            }
        };
        res.write(`data: ${JSON.stringify(serverInfo)}\n\n`);
        
        // Send available tools
        setTimeout(() => {
            console.log('→ Sending tools list via SSE');
            const toolsList = {
                jsonrpc: '2.0',
                method: 'tools/list',
                result: {
                    tools: [
                        {
                            name: 'test_tool',
                            description: 'A simple test tool',
                            inputSchema: {
                                type: 'object',
                                properties: {
                                    message: { type: 'string', description: 'Test message' }
                                },
                                required: ['message']
                            }
                        }
                    ]
                }
            };
            res.write(`data: ${JSON.stringify(toolsList)}\n\n`);
        }, 1000);
        
    }, 1000);
    
    // Handle connection close
    req.on('close', () => {
        console.log('→ SSE connection closed');
        sseConnections.delete(connectionId);
    });
    
    req.on('error', (error) => {
        console.log('→ SSE connection error:', error);
        sseConnections.delete(connectionId);
    });
    
    console.log('→ SSE MCP connection established, ID:', connectionId);
});

// Handle MCP messages sent via POST to SSE endpoint
app.post('/', async (req, res) => {
    console.log('→ Received MCP message via POST:', JSON.stringify(req.body, null, 2));
    
    const { method, params, id, jsonrpc } = req.body;
    
    if (jsonrpc !== '2.0') {
        return res.json({
            jsonrpc: '2.0',
            error: { code: -32600, message: 'Invalid Request' },
            id: id || null
        });
    }
    
    let response;
    
    switch (method) {
        case 'initialize':
            console.log('→ Handling initialize');
            response = {
                jsonrpc: '2.0',
                result: {
                    protocolVersion: '2025-03-26',
                    capabilities: {
                        tools: { listChanged: true }
                    },
                    serverInfo: {
                        name: 'sse-test-server',
                        version: '1.0.0'
                    }
                },
                id
            };
            break;
            
        case 'initialized':
            console.log('→ Handling initialized notification');
            // Send response via SSE to all connections
            const initMessage = `data: ${JSON.stringify({
                jsonrpc: '2.0',
                method: 'notification/initialized',
                params: {}
            })}\n\n`;
            
            sseConnections.forEach((connection) => {
                connection.write(initMessage);
            });
            
            return res.status(204).send();
            
        case 'tools/list':
            console.log('→ Handling tools/list');
            response = {
                jsonrpc: '2.0',
                result: {
                    tools: [
                        {
                            name: 'test_tool',
                            description: 'A simple test tool',
                            inputSchema: {
                                type: 'object',
                                properties: {
                                    message: { type: 'string', description: 'Test message' }
                                },
                                required: ['message']
                            }
                        },
                        {
                            name: 'echo_tool',
                            description: 'Echo back the input',
                            inputSchema: {
                                type: 'object',
                                properties: {
                                    text: { type: 'string', description: 'Text to echo' }
                                },
                                required: ['text']
                            }
                        }
                    ]
                },
                id
            };
            break;
            
        default:
            response = {
                jsonrpc: '2.0',
                error: { code: -32601, message: 'Method not found' },
                id
            };
    }
    
    // Send response both via HTTP and SSE
    res.json(response);
    
    // Also send via SSE to all connections
    const sseMessage = `data: ${JSON.stringify(response)}\n\n`;
    sseConnections.forEach((connection) => {
        connection.write(sseMessage);
    });
});

// Start server
const PORT = 3003;
app.listen(PORT, () => {
    console.log(`SSE MCP Test Server running on http://localhost:${PORT}`);
    console.log('Try connecting Cherry Studio to: http://localhost:3003');
    console.log('Active SSE connections will be logged');
});