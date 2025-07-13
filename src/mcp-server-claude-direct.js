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
const ToolsIntegrator = require('./mcp-tools/ToolsIntegrator.js');

class ClaudeDirectMCPServer {
    constructor() {
        this.server = new Server({
            name: 'genome-ai-studio-direct',
            version: '1.0.0',
        }, {
            capabilities: {
                tools: {},
            },
        });

        // Initialize the backend MCP server for complex operations
        this.backendServer = new MCPGenomeBrowserServer();
        
        // Initialize the tools integrator
        this.toolsIntegrator = new ToolsIntegrator(this.backendServer);
        
        this.setupHandlers();
        this.setupErrorHandling();
    }

    setupHandlers() {
        // Handle tool listing
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            const tools = this.toolsIntegrator.getAvailableTools();
            const categories = this.toolsIntegrator.getToolsByCategory();
            const statistics = this.toolsIntegrator.getToolStatistics();

            process.stderr.write(`📊 Loaded ${statistics.totalTools} tools across ${statistics.categories} categories\n`);
            process.stderr.write(`📂 Categories: ${Object.keys(categories).join(', ')}\n`);

            return {
                tools: tools
            };
        });

        // Handle tool execution
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name: toolName, arguments: args } = request.params;
            
            process.stderr.write(`🔧 Executing tool: ${toolName}\n`);
            process.stderr.write(`📋 Parameters: ${JSON.stringify(args, null, 2)}\n`);

            try {
                // Validate parameters
                this.toolsIntegrator.validateToolParameters(toolName, args);

                // Execute the tool
                const result = await this.toolsIntegrator.executeTool(toolName, args, args.clientId);
                
                process.stderr.write(`✅ Tool execution successful: ${toolName}\n`);
                
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2)
                        }
                    ]
                };
            } catch (error) {
                process.stderr.write(`❌ Tool execution failed: ${toolName}\n`);
                process.stderr.write(`💥 Error: ${error.message}\n`);
                
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
            process.stderr.write(`🚨 Server error: ${error.message}\n`);
        };

        process.on('SIGINT', async () => {
            process.stderr.write('🛑 Shutting down server...\n');
            await this.server.close();
            process.exit(0);
        });
    }

    async start() {
        try {
            // Start the backend server
            process.stderr.write('🚀 Starting backend MCP server...\n');
            await this.backendServer.start();
            
            // Start the Claude MCP server
            process.stderr.write('🎯 Starting Claude MCP server...\n');
            const transport = new StdioServerTransport();
            await this.server.connect(transport);
            
            const statistics = this.toolsIntegrator.getToolStatistics();
            process.stderr.write(`✨ Claude MCP Server started successfully!\n`);
            process.stderr.write(`📊 Available tools: ${statistics.totalTools}\n`);
            process.stderr.write(`🔧 Server-side tools: ${statistics.serverSideTools}\n`);
            process.stderr.write(`🖥️  Client-side tools: ${statistics.clientSideTools}\n`);
            
            // Log tool categories
            const categories = this.toolsIntegrator.getToolsByCategory();
            for (const [key, category] of Object.entries(categories)) {
                process.stderr.write(`📁 ${category.name}: ${category.tools.length} tools\n`);
            }
            
        } catch (error) {
            process.stderr.write(`💥 Failed to start server: ${error.message}\n`);
            process.exit(1);
        }
    }
}

// Start the server
const server = new ClaudeDirectMCPServer();
server.start().catch((error) => {
    process.stderr.write(`💥 Startup error: ${error.message}\n`);
    process.exit(1);
}); 