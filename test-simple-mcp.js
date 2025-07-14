#!/usr/bin/env node

/**
 * Simple MCP Server for Cherry Studio Testing
 */

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    if (req.body && Object.keys(req.body).length > 0) {
        console.log('Body:', JSON.stringify(req.body, null, 2));
    }
    next();
});

// SSE endpoint for Cherry Studio
app.get('/', (req, res) => {
    console.log('→ Setting up SSE connection');
    
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });
    
    // Keep connection alive
    const keepAlive = setInterval(() => {
        res.write('data: {"type":"ping"}\n\n');
    }, 30000);
    
    req.on('close', () => {
        console.log('→ SSE connection closed');
        clearInterval(keepAlive);
    });
    
    console.log('→ SSE connection established');
});

// Simple MCP handlers  
app.post('/', async (req, res) => {
    const { method, params, id, jsonrpc } = req.body;
    
    if (jsonrpc !== '2.0') {
        return res.json({
            jsonrpc: '2.0',
            error: { code: -32600, message: 'Invalid Request' },
            id: id || null
        });
    }
    
    switch (method) {
        case 'initialize':
            console.log('→ Handling initialize');
            res.json({
                jsonrpc: '2.0',
                result: {
                    protocolVersion: '2025-03-26',
                    capabilities: {
                        tools: { listChanged: true }
                    },
                    serverInfo: {
                        name: 'simple-test-server',
                        version: '1.0.0'
                    }
                },
                id
            });
            break;
            
        case 'initialized':
            console.log('→ Handling initialized notification');
            res.status(204).send();
            break;
            
        case 'tools/list':
            console.log('→ Handling tools/list');
            res.json({
                jsonrpc: '2.0',
                result: {
                    tools: [
                        {
                            name: 'test_tool',
                            description: 'A simple test tool',
                            inputSchema: {
                                type: 'object',
                                properties: {
                                    message: { type: 'string' }
                                }
                            }
                        }
                    ]
                },
                id
            });
            break;
            
        default:
            res.json({
                jsonrpc: '2.0',
                error: { code: -32601, message: 'Method not found' },
                id
            });
    }
});

// Start server
const PORT = 3003;
app.listen(PORT, () => {
    console.log(`Simple MCP Test Server running on http://localhost:${PORT}`);
    console.log('Try connecting Cherry Studio to: http://localhost:3003');
});