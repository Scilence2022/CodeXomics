/**
 * MCPServerManager - Manages multiple MCP server connections and their tools
 * Now supports both legacy WebSocket servers and Claude MCP protocol servers
 */
class MCPServerManager {
    constructor(configManager = null) {
        this.configManager = configManager;
        this.servers = new Map(); // serverId -> serverConfig
        this.connections = new Map(); // serverId -> WebSocket connection
        this.serverTools = new Map(); // serverId -> array of tools
        this.activeServers = new Set(); // Set of connected server IDs
        this.eventHandlers = new Map(); // event -> handlers
        
        // Claude MCP specific properties
        this.claudeMCPServers = new Map(); // serverId -> Claude MCP server info
        this.claudeMCPConnections = new Map(); // serverId -> Claude MCP connection
        
        this.loadServerConfigurations();
        this.setupAutoConnect();
    }

    // Event system for server status changes
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
    }

    emit(event, data) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).forEach(handler => handler(data));
        }
    }

    // Load server configurations from storage
    loadServerConfigurations() {
        const defaultServers = new Map([
            ['genome-studio', {
                id: 'genome-studio',
                name: 'Genome AI Studio',
                description: 'Built-in genome analysis tools',
                url: 'ws://localhost:3003',
                enabled: true,
                autoConnect: true,
                reconnectDelay: 5,
                category: 'genomics',
                capabilities: ['genome-navigation', 'sequence-analysis', 'annotation'],
                isBuiltin: true,
                protocol: 'websocket' // Legacy WebSocket protocol
            }],
            // Unified Claude MCP Server (disabled by default to prevent conflicts)
            ['unified-claude-mcp', {
                id: 'unified-claude-mcp',
                name: 'Unified Claude MCP Server',
                description: 'Unified Claude MCP server with direct RPC communication and integrated genomics tools',
                url: 'ws://localhost:3003', // Fixed URL to prevent null errors
                enabled: false, // Disabled by default
                autoConnect: false, // No auto-connect to prevent multiple connections
                reconnectDelay: 5,
                category: 'genomics',
                capabilities: ['genome-navigation', 'sequence-analysis', 'annotation', 'protein-structure', 'database-integration', 'mcp-protocol', 'direct-rpc'],
                isBuiltin: true,
                protocol: 'rpc',
                mcpConfig: {
                    stdio: false,
                    serverPath: './src/mcp-server-claude-unified.js',
                    communicationType: 'direct-rpc'
                }
            }],
            // Claude MCP Server (disabled by default to prevent conflicts)
            ['claude-mcp-genome', {
                id: 'claude-mcp-genome',
                name: 'Claude MCP Genome Server',
                description: 'Claude MCP compliant genome analysis server',
                url: 'ws://localhost:3003', // WebSocket URL for browser communication
                enabled: false, // Disabled by default
                autoConnect: false, // No auto-connect to prevent multiple connections
                reconnectDelay: 5,
                category: 'genomics',
                capabilities: ['genome-navigation', 'sequence-analysis', 'annotation', 'protein-structure', 'database-integration'],
                isBuiltin: true,
                protocol: 'claude-mcp', // Claude MCP protocol
                mcpConfig: {
                    stdio: false, // Use WebSocket for browser integration
                    serverPath: './src/mcp-server-claude.js'
                }
            }],
            // Example local development server
            ['dev-local', {
                id: 'dev-local',
                name: 'Local Development Tools',
                url: 'ws://localhost:3003',
                enabled: false,
                autoConnect: false,
                reconnectDelay: 5,
                category: 'development',
                capabilities: ['testing', 'debugging'],
                isBuiltin: false,
                protocol: 'websocket'
            }]
        ]);

        // Load from config or use defaults
        const savedServers = this.configManager ? 
            this.configManager.get('mcpServers', defaultServers) : 
            defaultServers;

        // Convert to Map if it's an object
        if (savedServers instanceof Map) {
            this.servers = savedServers;
        } else {
            this.servers = new Map(Object.entries(savedServers));
        }

        // Ensure default servers exist
        defaultServers.forEach((server, id) => {
            if (!this.servers.has(id)) {
                this.servers.set(id, server);
        }
        });
    }

    // Save server configurations to storage
    saveServerConfigurations() {
        if (this.configManager) {
            // Convert Map to object for storage
            const serversObj = Object.fromEntries(this.servers);
            this.configManager.set('mcpServers', serversObj);
        }
    }

    // Add a new server configuration
    addServer(serverConfig) {
        const serverId = serverConfig.id || this.generateServerId();
        
        const fullConfig = {
            id: serverId,
            name: serverConfig.name || 'Unknown Server',
            description: serverConfig.description || '',
            url: serverConfig.url,
            enabled: serverConfig.enabled !== false,
            autoConnect: serverConfig.autoConnect !== false,
            reconnectDelay: serverConfig.reconnectDelay || 5,
            category: serverConfig.category || 'general',
            capabilities: serverConfig.capabilities || [],
            isBuiltin: serverConfig.isBuiltin || false,
            protocol: serverConfig.protocol || 'websocket', // Default to WebSocket
            mcpConfig: serverConfig.mcpConfig || null,
            headers: serverConfig.headers || {}
        };

        this.servers.set(serverId, fullConfig);
        this.saveServerConfigurations();
        
        this.emit('serverAdded', { serverId, server: fullConfig });
        return serverId;
    }

    // Remove a server configuration
    removeServer(serverId) {
        const server = this.servers.get(serverId);
        if (!server) {
            return false;
        }

        // Don't allow removal of builtin servers
        if (server.isBuiltin) {
            console.warn(`Cannot remove builtin server: ${serverId}`);
            return false;
        }

        // Disconnect if connected
        this.disconnectFromServer(serverId);
        
        this.servers.delete(serverId);
        this.saveServerConfigurations();
        
        this.emit('serverRemoved', { serverId, server });
        return true;
    }

    // Update server configuration
    updateServer(serverId, updates) {
        const server = this.servers.get(serverId);
        if (!server) {
            return false;
        }

        // Merge updates
        const updatedServer = { ...server, ...updates };
        this.servers.set(serverId, updatedServer);
        this.saveServerConfigurations();
        
        this.emit('serverUpdated', { serverId, server: updatedServer });
        return true;
    }

    // Connect to a specific server
    async connectToServer(serverId) {
        const server = this.servers.get(serverId);
        if (!server) {
            throw new Error(`Server ${serverId} not found`);
        }

        if (this.connections.has(serverId) || this.claudeMCPConnections.has(serverId)) {
            console.log(`Already connected to server ${serverId}`);
            return;
        }

        // Prevent connecting to servers with null or invalid URLs
        if (!server.url || server.url === 'null') {
            throw new Error(`Server ${serverId} has invalid URL: ${server.url}`);
        }

        try {
            console.log(`Connecting to MCP server: ${server.name} (${server.url})`);
            this.emit('serverConnecting', { serverId, server });

            if (server.protocol === 'claude-mcp') {
                await this.connectToClaudeMCPServer(serverId, server);
            } else {
                await this.connectToWebSocketServer(serverId, server);
            }

        } catch (error) {
            console.error(`Failed to connect to server ${serverId}:`, error);
            this.emit('serverError', { serverId, server, error });
            throw error;
        }
    }

    // Connect to Claude MCP server
    async connectToClaudeMCPServer(serverId, server) {
        // For browser integration, we still use WebSocket to communicate with the Claude MCP server
        // The Claude MCP server handles the protocol conversion
        const ws = new WebSocket(server.url);
        
        ws.onopen = () => {
            console.log(`Connected to Claude MCP server: ${server.name}`);
            this.claudeMCPConnections.set(serverId, ws);
            this.activeServers.add(serverId);
            this.emit('serverConnected', { serverId, server });
            
            // Send identification message for Claude MCP
            ws.send(JSON.stringify({
                type: 'claude-mcp-client',
                clientId: this.generateClientId(),
                protocol: 'claude-mcp',
                capabilities: ['tool-execution', 'state-sync']
            }));

            // Request available tools
            this.requestClaudeMCPTools(serverId);
        };

        ws.onmessage = (event) => {
            this.handleClaudeMCPMessage(serverId, event);
        };

        ws.onerror = (error) => {
            console.error(`Claude MCP server error (${serverId}):`, error);
            this.emit('serverError', { serverId, server, error });
        };

        ws.onclose = () => {
            console.log(`Claude MCP server disconnected: ${server.name}`);
            this.claudeMCPConnections.delete(serverId);
            this.activeServers.delete(serverId);
            this.serverTools.delete(serverId);
            this.emit('serverDisconnected', { serverId, server });
            
            // Auto-reconnect if enabled
            if (server.autoConnect && server.enabled) {
                setTimeout(() => {
                    this.connectToServer(serverId);
                }, server.reconnectDelay * 1000);
            }
        };
    }

    // Connect to legacy WebSocket server
    async connectToWebSocketServer(serverId, server) {
            const ws = new WebSocket(server.url);
            
            // Add authentication headers if needed
            if (server.headers && Object.keys(server.headers).length > 0) {
                // Note: WebSocket API doesn't support custom headers directly
                // For authentication, we'll send them in the first message
                ws.authHeaders = server.headers;
            }

            ws.onopen = () => {
            console.log(`Connected to WebSocket server: ${server.name}`);
                this.connections.set(serverId, ws);
                this.activeServers.add(serverId);
                this.emit('serverConnected', { serverId, server });
                
                // Send authentication if headers are present
                if (ws.authHeaders) {
                    ws.send(JSON.stringify({
                        type: 'authenticate',
                        headers: ws.authHeaders
                    }));
                }

                // Request available tools
                this.requestServerTools(serverId);
            };

            ws.onmessage = (event) => {
                this.handleServerMessage(serverId, event);
            };

        ws.onerror = (error) => {
            console.error(`WebSocket server error (${serverId}):`, error);
            this.emit('serverError', { serverId, server, error });
        };

            ws.onclose = () => {
            console.log(`WebSocket server disconnected: ${server.name}`);
                this.connections.delete(serverId);
                this.activeServers.delete(serverId);
                this.serverTools.delete(serverId);
                this.emit('serverDisconnected', { serverId, server });

            // Auto-reconnect if enabled
            if (server.autoConnect && server.enabled) {
                    setTimeout(() => {
                        this.connectToServer(serverId);
                    }, server.reconnectDelay * 1000);
                }
            };
    }

    // Disconnect from a server
    disconnectFromServer(serverId) {
        const ws = this.connections.get(serverId);
        const claudeWs = this.claudeMCPConnections.get(serverId);
        
        if (ws) {
            ws.close();
        this.connections.delete(serverId);
        }
        
        if (claudeWs) {
            claudeWs.close();
            this.claudeMCPConnections.delete(serverId);
        }
        
        this.activeServers.delete(serverId);
        this.serverTools.delete(serverId);
        
        const server = this.servers.get(serverId);
        this.emit('serverDisconnected', { serverId, server });
    }

    // Handle Claude MCP server messages
    handleClaudeMCPMessage(serverId, event) {
        try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'tools-list') {
                // Handle tools list from Claude MCP server
                this.serverTools.set(serverId, data.tools || []);
                this.emit('toolsUpdated', { serverId, tools: data.tools });
            } else if (data.type === 'tool-response') {
                // Handle tool execution response
                this.emit('toolResponse', { serverId, data });
            } else if (data.type === 'error') {
                console.error(`Claude MCP server error (${serverId}):`, data.error);
                this.emit('serverError', { serverId, error: data.error });
            }
        } catch (error) {
            console.error(`Error parsing Claude MCP message from ${serverId}:`, error);
        }
    }

    // Handle legacy WebSocket server messages
    handleServerMessage(serverId, event) {
        try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'tools') {
                // Handle tools list from legacy server
                    this.serverTools.set(serverId, data.tools || []);
                    this.emit('toolsUpdated', { serverId, tools: data.tools });
            } else if (data.type === 'tool-response') {
                // Handle tool execution response
                this.emit('toolResponse', { serverId, data });
            } else if (data.type === 'error') {
                console.error(`Server error (${serverId}):`, data.error);
                this.emit('serverError', { serverId, error: data.error });
            }
        } catch (error) {
            console.error(`Error parsing message from ${serverId}:`, error);
        }
    }

    // Request tools from Claude MCP server
    requestClaudeMCPTools(serverId) {
        const ws = this.claudeMCPConnections.get(serverId);
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'list-tools',
                requestId: this.generateRequestId()
            }));
        }
    }

    // Request tools from legacy server
    requestServerTools(serverId) {
        const ws = this.connections.get(serverId);
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'get-tools',
                requestId: this.generateRequestId()
            }));
        }
    }

    // Execute tool on a specific server
    async executeToolOnServer(serverId, toolName, parameters) {
        const server = this.servers.get(serverId);
        if (!server) {
            throw new Error(`Server ${serverId} not found`);
        }

        if (server.protocol === 'claude-mcp') {
            return await this.executeClaudeMCPTool(serverId, toolName, parameters);
        } else {
            return await this.executeWebSocketTool(serverId, toolName, parameters);
        }
    }

    // Execute tool on Claude MCP server
    async executeClaudeMCPTool(serverId, toolName, parameters) {
        const ws = this.claudeMCPConnections.get(serverId);
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            throw new Error(`Claude MCP server ${serverId} not connected`);
        }

        return new Promise((resolve, reject) => {
            const requestId = this.generateRequestId();
            const timeout = setTimeout(() => {
                reject(new Error(`Tool execution timeout: ${toolName}`));
            }, 30000);

            const handler = (data) => {
                if (data.serverId === serverId && data.data.requestId === requestId) {
                    clearTimeout(timeout);
                    this.off('toolResponse', handler);
                    
                    if (data.data.success) {
                        resolve(data.data.result);
                    } else {
                        reject(new Error(data.data.error || 'Tool execution failed'));
                    }
                }
            };

            this.on('toolResponse', handler);
            
            // Send Claude MCP tool execution request
            ws.send(JSON.stringify({
                type: 'call-tool',
                requestId: requestId,
                toolName: toolName,
                parameters: parameters
            }));
        });
    }

    // Execute tool on legacy WebSocket server
    async executeWebSocketTool(serverId, toolName, parameters) {
        const ws = this.connections.get(serverId);
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            throw new Error(`Server ${serverId} not connected`);
        }
        
        return new Promise((resolve, reject) => {
            const requestId = this.generateRequestId();
            const timeout = setTimeout(() => {
                reject(new Error(`Tool execution timeout: ${toolName}`));
            }, 30000);

            const handler = (data) => {
                if (data.serverId === serverId && data.data.requestId === requestId) {
                    clearTimeout(timeout);
                    this.off('toolResponse', handler);
                    
                    if (data.data.success) {
                        resolve(data.data.result);
                    } else {
                        reject(new Error(data.data.error || 'Tool execution failed'));
                    }
                }
            };

            this.on('toolResponse', handler);

            // Send legacy tool execution request
            ws.send(JSON.stringify({
                type: 'execute-tool',
                requestId: requestId,
                toolName: toolName,
                parameters: parameters
            }));
        });
    }

    // Get all available tools from all connected servers
    getAllAvailableTools() {
        const allTools = [];
        
        for (const [serverId, tools] of this.serverTools) {
            const server = this.servers.get(serverId);
            if (server && this.activeServers.has(serverId)) {
                tools.forEach(tool => {
                    allTools.push({
                        ...tool,
                        serverId: serverId,
                        serverName: server.name,
                        serverCategory: server.category,
                        protocol: server.protocol || 'websocket'
                    });
                });
            }
        }
        
        return allTools;
    }

    // Get tools grouped by category
    getToolsByCategory() {
        const categories = {};
        
        for (const [serverId, tools] of this.serverTools) {
            const server = this.servers.get(serverId);
            if (server && this.activeServers.has(serverId)) {
                const category = server.category || 'general';
            if (!categories[category]) {
                categories[category] = [];
            }
                
                tools.forEach(tool => {
                    categories[category].push({
                        ...tool,
                        serverId: serverId,
                        serverName: server.name,
                        protocol: server.protocol || 'websocket'
                    });
        });
            }
        }
        
        return categories;
    }

    // Execute tool on any available server
    async executeTool(toolName, parameters) {
        const allTools = this.getAllAvailableTools();
        const tool = allTools.find(t => t.name === toolName);
        
        if (!tool) {
            throw new Error(`Tool ${toolName} not found on any connected server`);
        }
        
        return await this.executeToolOnServer(tool.serverId, toolName, parameters);
    }

    // Setup auto-connect for enabled servers
    setupAutoConnect() {
        // Auto-connect to enabled servers after a short delay
        setTimeout(() => {
            for (const [serverId, server] of this.servers) {
                if (server.enabled && server.autoConnect) {
                    // Additional check for valid URL
                    if (server.url && server.url !== 'null') {
                        this.connectToServer(serverId).catch(error => {
                            console.warn(`Failed to auto-connect to server ${serverId}:`, error.message);
                        });
                    } else {
                        console.warn(`Skipping auto-connect for server ${serverId} - invalid URL: ${server.url}`);
                    }
                }
            }
        }, 1000);
    }

    // Get server status information
    getServerStatus() {
        const status = [];
        
        for (const [serverId, server] of this.servers) {
            const connected = this.activeServers.has(serverId);
            const tools = this.serverTools.get(serverId) || [];
            
            status.push({
                id: serverId,
                name: server.name,
                description: server.description,
                url: server.url,
                category: server.category,
                protocol: server.protocol || 'websocket',
                connected: connected,
                enabled: server.enabled,
                autoConnect: server.autoConnect,
                toolCount: tools.length,
                isBuiltin: server.isBuiltin,
                capabilities: server.capabilities || []
            });
        }
        
        return status;
    }

    // Remove event handler
    off(event, handler) {
        if (this.eventHandlers.has(event)) {
            const handlers = this.eventHandlers.get(event);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    // Generate unique server ID
    generateServerId() {
        return 'server-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    // Generate unique request ID
    generateRequestId() {
        return 'req-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    // Generate unique client ID
    generateClientId() {
        return 'client-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    // Get count of connected servers
    getConnectedServersCount() {
        return this.activeServers.size;
    }

    // Get server by ID
    getServer(serverId) {
        return this.servers.get(serverId);
    }

    // Get all servers
    getAllServers() {
        return Array.from(this.servers.values());
    }

    // Test server connection
    async testServerConnection(serverConfig) {
        return new Promise((resolve, reject) => {
            const testWs = new WebSocket(serverConfig.url);
            
            const timeout = setTimeout(() => {
                testWs.close();
                reject(new Error('Connection timeout'));
            }, 5000);
            
            testWs.onopen = () => {
                clearTimeout(timeout);
                testWs.close();
                resolve(true);
            };
            
            testWs.onerror = (error) => {
                clearTimeout(timeout);
                reject(error);
            };
        });
    }

    // Disconnect from all servers
    disconnectAll() {
        for (const serverId of this.activeServers) {
            this.disconnectFromServer(serverId);
        }
    }

    // Connect to all enabled servers
    connectAll() {
        for (const [serverId, server] of this.servers) {
            if (server.enabled && !this.activeServers.has(serverId)) {
                this.connectToServer(serverId).catch(error => {
                    console.warn(`Failed to connect to server ${serverId}:`, error.message);
                });
            }
        }
    }

    // Reconnect to all servers
    reconnectAll() {
        this.disconnectAll();
        setTimeout(() => {
            this.connectAll();
        }, 1000);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MCPServerManager;
} else if (typeof window !== 'undefined') {
    window.MCPServerManager = MCPServerManager;
} 