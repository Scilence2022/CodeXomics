#!/usr/bin/env node

/**
 * Start Direct Integration MCP Server for Genome AI Studio
 * 
 * This script starts the Direct MCP Server with proper port configuration
 * to avoid conflicts with the existing Genome AI Studio backend.
 * 
 * Port Configuration:
 * - Genome AI Studio: HTTP 3000, WebSocket 3001
 * - Direct MCP Server: HTTP 3002, WebSocket 3003
 */

const ClaudeDirectMCPServer = require('./src/mcp-server-claude-direct.js');

// Create server with custom ports to avoid conflicts
const server = new ClaudeDirectMCPServer(3002, 3003);

// Start the server
server.start().catch(error => {
    process.stderr.write(`Failed to start Direct MCP Server: ${error}\n`);
    process.exit(1);
});

// Graceful shutdown handlers
process.on('SIGINT', async () => {
    process.stderr.write('\n🛑 Shutting down Direct MCP Server...\n');
    await server.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    process.stderr.write('\n🛑 Shutting down Direct MCP Server...\n');
    await server.stop();
    process.exit(0);
});

// Output startup information
process.stderr.write('🚀 Starting Direct MCP Server for Genome AI Studio...\n');
process.stderr.write('📡 HTTP Server: http://localhost:3002\n');
process.stderr.write('🔌 WebSocket: ws://localhost:3003\n');
process.stderr.write('🎯 Claude MCP: stdio transport\n');
process.stderr.write('✅ Ready for Claude Desktop integration\n\n'); 