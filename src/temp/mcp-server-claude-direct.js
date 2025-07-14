#!/usr/bin/env node

/**
 * Claude MCP Server for Genome AI Studio - Direct Integration
 * Provides comprehensive genomics tools for Claude Desktop MCP integration
 * 
 * This server directly integrates all tools without relying on the legacy MCP server,
 * providing better performance and easier maintenance.
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

// Import the original MCP server class for backend functionality
const MCPGenomeBrowserServer = require('./mcp-server.js');

// Import the organized tools integrator
const ToolsIntegrator = require('../mcp-tools/ToolsIntegrator.js');

class ClaudeDirectMCPServer {
    constructor(httpPort = 3002, wsPort = 3003) {
        this.httpPort = httpPort;
        this.wsPort = wsPort;
        
        this.server = new Server({
            name: 'genome-ai-studio-direct',
            version: '1.0.0',
        }, {
            capabilities: {
                tools: {
                    listChanged: false,
                },
            },
        });

        // Initialize the backend MCP server for complex operations with custom ports
        this.backendServer = new MCPGenomeBrowserServer(this.httpPort, this.wsPort);
        
        // Initialize the tools integrator
        this.toolsIntegrator = new ToolsIntegrator(this.backendServer);
        
        this.setupHandlers();
        this.setupErrorHandling();
    }

    setupHandlers() {
        // Handle tool listing
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            const tools = this.toolsIntegrator.getAvailableTools();
            return {
                tools: tools
            };
        });

        // Handle tool execution
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name: toolName, arguments: args } = request.params;

            try {
                // Validate parameters
                this.toolsIntegrator.validateToolParameters(toolName, args);

                // Execute the tool
                const result = await this.toolsIntegrator.executeTool(toolName, args, args.clientId);
                
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2)
                        }
                    ]
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                error: error.message,
                                toolName: toolName,
                                parameters: args
                            }, null, 2)
                        }
                    ],
                    isError: true
                };
            }
        });
    }

    setupErrorHandling() {
        this.server.onerror = (error) => {
            // Silent error handling to avoid JSON-RPC interference
        };

        process.on('SIGINT', async () => {
            await this.server.close();
            process.exit(0);
        });
    }

    async start() {
        try {
            // Start the backend server silently
            await this.backendServer.start();
            
            // Output port information to stderr to avoid JSON-RPC interference
            process.stderr.write(`🧬 Genome AI Studio Direct MCP Server started\n`);
            process.stderr.write(`📡 HTTP Server: http://localhost:${this.httpPort}\n`);
            process.stderr.write(`🔌 WebSocket: ws://localhost:${this.wsPort}\n`);
            process.stderr.write(`\n`);
            
            // Start the Claude MCP server silently
            const transport = new StdioServerTransport();
            await this.server.connect(transport);
            
        } catch (error) {
            process.stderr.write(`Failed to start server: ${error.message}\n`);
            process.exit(1);
        }
    }

    async stop() {
        try {
            // Stop the Claude MCP server
            if (this.server) {
                await this.server.close();
            }
            
            // Stop the backend server
            if (this.backendServer) {
                this.backendServer.stop();
            }
        } catch (error) {
            process.stderr.write(`Error stopping server: ${error.message}\n`);
        }
    }
}

// Export the class for external use
module.exports = ClaudeDirectMCPServer;

// Only start the server if this file is run directly
if (require.main === module) {
    const server = new ClaudeDirectMCPServer();
    server.start().catch((error) => {
        process.stderr.write(`💥 Startup error: ${error.message}\n`);
        process.exit(1);
    });
} 