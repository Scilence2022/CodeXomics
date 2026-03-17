#!/usr/bin/env node

/**
 * Startup script for Unified Claude MCP Server
 *
 * This script starts the unified MCP server that provides:
 * 1. MCP protocol interface for MCP Client (STDIO)
 * 2. WebSocket interface for CodeXomics
 * 3. HTTP REST API for external tools
 * 4. Authentication and security for remote access
 * 5. Client Bridge for remote tool execution
 *
 * Usage:
 * - For MCP Client: node start-unified-claude-mcp-server.js
 * - For CodeXomics: Use the Start button in the UI
 *
 * Environment Variables:
 * - MCP_AUTH_REQUIRED: Enable authentication (default: false for localhost)
 * - MCP_MASTER_KEY: Master API key for authentication
 * - MCP_DEV_MODE: Enable development mode with auto-generated key
 * - MCP_HTTP_PORT: HTTP server port (default: 3002)
 * - MCP_WS_PORT: WebSocket server port (default: 3003)
 */

const path = require('path');
const UnifiedClaudeMCPServer = require('../src/mcp-server-claude-unified.js');

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (name, defaultValue) => {
  const argIndex = args.indexOf(name);
  return argIndex !== -1 && args[argIndex + 1] ? args[argIndex + 1] : defaultValue;
};

// Default ports (can be overridden by command line arguments or environment variables)
const HTTP_PORT = parseInt(process.env.MCP_HTTP_PORT || getArg('--http-port', '3002'));
const WS_PORT = parseInt(process.env.MCP_WS_PORT || getArg('--ws-port', '3003'));

// Authentication configuration
const authConfig = {
  requireAuth: process.env.MCP_AUTH_REQUIRED === 'true' || args.includes('--require-auth'),
  enableLocalBypass: process.env.MCP_LOCAL_BYPASS !== 'false' && !args.includes('--no-local-bypass'),
  developmentMode: process.env.MCP_DEV_MODE === 'true' || args.includes('--dev-mode'),
  masterKey: process.env.MCP_MASTER_KEY || getArg('--master-key', null),
};

async function main() {
  try {
    // Create and start the unified server with authentication
    const server = new UnifiedClaudeMCPServer(HTTP_PORT, WS_PORT, null, authConfig);

    // Output startup information to stderr (won't interfere with MCP protocol on stdout)
    process.stderr.write(`🚀 Starting Unified Claude MCP Server...\n`);
    process.stderr.write(`📍 Working directory: ${process.cwd()}\n`);
    process.stderr.write(`🌐 HTTP Port: ${HTTP_PORT}\n`);
    process.stderr.write(`🔌 WebSocket Port: ${WS_PORT}\n`);
    process.stderr.write(`📡 MCP Protocol: STDIO\n`);
    process.stderr.write(`\n`);

    // Authentication info
    if (authConfig.requireAuth) {
      process.stderr.write(`🔐 Authentication: ENABLED\n`);
      if (authConfig.masterKey) {
        process.stderr.write(`🔑 Master Key: Configured\n`);
      }
      if (authConfig.developmentMode) {
        process.stderr.write(`🛠️  Development Mode: Enabled (API key will be printed)\n`);
      }
    } else {
      process.stderr.write(`🔓 Authentication: DISABLED (localhost bypass enabled)\n`);
    }
    process.stderr.write(`\n`);

    await server.start();

    // Server is now running and connected via STDIO to MCP Client
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
