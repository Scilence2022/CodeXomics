#!/usr/bin/env node

/**
 * Startup script for Unified Claude MCP Server
 * 
 * This script starts the unified MCP server that provides:
 * 1. MCP protocol interface for Claude Desktop (STDIO)
 * 2. WebSocket interface for Genome AI Studio
 * 3. HTTP REST API for external tools
 * 
 * Usage:
 * - For Claude Desktop: node start-unified-claude-mcp-server.js
 * - For Genome AI Studio: Use the Start button in the UI
 */

const path = require('path');
const UnifiedClaudeMCPServer = require('./src/mcp-server-claude-unified.js');

// Default ports (can be overridden by command line arguments)
const HTTP_PORT = process.argv[2] ? parseInt(process.argv[2]) : 3002;
const WS_PORT = process.argv[3] ? parseInt(process.argv[3]) : 3003;

async function main() {
    try {
        // Create and start the unified server
        const server = new UnifiedClaudeMCPServer(HTTP_PORT, WS_PORT);
        
        // Output startup information to stderr (won't interfere with MCP protocol on stdout)
        process.stderr.write(`🚀 Starting Unified Claude MCP Server...\n`);
        process.stderr.write(`📍 Working directory: ${process.cwd()}\n`);
        process.stderr.write(`🌐 HTTP Port: ${HTTP_PORT}\n`);
        process.stderr.write(`🔌 WebSocket Port: ${WS_PORT}\n`);
        process.stderr.write(`📡 MCP Protocol: STDIO\n`);
        process.stderr.write(`\n`);
        
        await server.start();
        
        // Server is now running and connected via STDIO to Claude Desktop
        
    } catch (error) {
        process.stderr.write(`💥 Failed to start Unified Claude MCP Server: ${error.message}\n`);
        process.stderr.write(`📊 Stack trace: ${error.stack}\n`);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    process.stderr.write(`\n🛑 Received SIGINT, shutting down gracefully...\n`);
    process.exit(0);
});

process.on('SIGTERM', () => {
    process.stderr.write(`\n🛑 Received SIGTERM, shutting down gracefully...\n`);
    process.exit(0);
});

// Start the server
main();