#!/usr/bin/env node

/**
 * Start Claude MCP Server for Genome AI Studio - Direct Integration
 * 
 * This script starts the Claude MCP (Model Context Protocol) server
 * using the direct integration approach with organized tool modules.
 * 
 * Features:
 * - Direct integration without legacy MCP server dependency
 * - 40+ genomics tools across 7 categories
 * - Clean JSON-RPC 2.0 protocol compliance
 * - Modular tool organization for better maintainability
 */

const ClaudeDirectMCPServer = require('./src/temp/mcp-server-claude-direct.js');
const net = require('net');

// Function to find available port
async function findAvailablePort(startPort) {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.listen(startPort, () => {
            const port = server.address().port;
            server.close(() => resolve(port));
        });
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                findAvailablePort(startPort + 1).then(resolve).catch(reject);
            } else {
                reject(err);
            }
        });
    });
}

// Find available ports for HTTP and WebSocket servers
async function initializeServer() {
    try {
        const httpPort = await findAvailablePort(3002); // Start from 3002 to avoid conflict
        const wsPort = await findAvailablePort(httpPort + 1);
        
        // Create server with different ports
        const server = new ClaudeDirectMCPServer(httpPort, wsPort);
        return server;
    } catch (error) {
        process.stderr.write(`Failed to find available ports: ${error.message}\n`);
        process.exit(1);
    }
}

// Initialize server with available ports
initializeServer().then(server => {
    // Start the server silently
    server.start().catch(error => {
        process.stderr.write(`Failed to start Claude MCP Server: ${error}\n`);
        process.exit(1);
    });

    // Graceful shutdown handlers
    process.on('SIGINT', async () => {
        await server.stop();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        await server.stop();
        process.exit(0);
    });
}).catch(error => {
    process.stderr.write(`Failed to initialize server: ${error.message}\n`);
    process.exit(1);
}); 