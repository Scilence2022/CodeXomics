/**
 * MCPServerManager - Manages multiple MCP server connections and their tools
 */
class MCPServerManager {
    constructor(configManager = null) {
        this.configManager = configManager;
        this.servers = new Map(); // serverId -> serverConfig
        this.connections = new Map(); // serverId -> WebSocket connection
        this.serverTools = new Map(); // serverId -> array of tools
        this.activeServers = new Set(); // Set of connected server IDs
        this.eventHandlers = new Map(); // event -> handlers
        
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
                url: 'ws://localhost:3001',
                enabled: true,
                autoConnect: true,
                reconnectDelay: 5,
                category: 'genomics',
                capabilities: ['genome-navigation', 'sequence-analysis', 'annotation'],
                isBuiltin: true
            }]
        ]);

        if (this.configManager) {
            const savedServers = this.configManager.get('mcpServers', {});
            // Merge default servers with saved servers
            for (const [id, config] of Object.entries(savedServers)) {
                this.servers.set(id, config);
            }
            // Ensure built-in server is always present
            if (!this.servers.has('genome-studio')) {
                this.servers.set('genome-studio', defaultServers.get('genome-studio'));
            }
        } else {
            this.servers = defaultServers;
        }
    }

    // Save server configurations to storage
    saveServerConfigurations() {
        if (this.configManager) {
            const serversObj = {};
            for (const [id, config] of this.servers.entries()) {
                serversObj[id] = config;
            }
            this.configManager.set('mcpServers', serversObj);
        }
    }

    // Add a new MCP server
    addServer(serverConfig) {
        const id = serverConfig.id || this.generateServerId();
        
        const config = {
            id: id,
            name: serverConfig.name || 'Unnamed Server',
            description: serverConfig.description || '',
            url: serverConfig.url,
            enabled: serverConfig.enabled !== false,
            autoConnect: serverConfig.autoConnect !== false,
            reconnectDelay: serverConfig.reconnectDelay || 5,
            category: serverConfig.category || 'general',
            capabilities: serverConfig.capabilities || [],
            apiKey: serverConfig.apiKey || '',
            headers: serverConfig.headers || {},
            isBuiltin: false
        };

        this.servers.set(id, config);
        this.saveServerConfigurations();
        this.emit('serverAdded', config);
        
        if (config.enabled && config.autoConnect) {
            this.connectToServer(id);
        }

        return id;
    }

    // Remove an MCP server
    removeServer(serverId) {
        const server = this.servers.get(serverId);
        if (!server) {
            throw new Error(`Server ${serverId} not found`);
        }

        if (server.isBuiltin) {
            throw new Error('Cannot remove built-in servers');
        }

        this.disconnectFromServer(serverId);
        this.servers.delete(serverId);
        this.serverTools.delete(serverId);
        this.saveServerConfigurations();
        this.emit('serverRemoved', { serverId, server });
    }

    // Update server configuration
    updateServer(serverId, updates) {
        const server = this.servers.get(serverId);
        if (!server) {
            throw new Error(`Server ${serverId} not found`);
        }

        const wasConnected = this.activeServers.has(serverId);
        
        // Disconnect if URL changed
        if (updates.url && updates.url !== server.url && wasConnected) {
            this.disconnectFromServer(serverId);
        }

        Object.assign(server, updates);
        this.servers.set(serverId, server);
        this.saveServerConfigurations();
        this.emit('serverUpdated', server);

        // Reconnect if it was connected and enabled
        if (wasConnected && server.enabled && server.autoConnect) {
            this.connectToServer(serverId);
        }
    }

    // Connect to a specific server
    async connectToServer(serverId) {
        const server = this.servers.get(serverId);
        if (!server) {
            throw new Error(`Server ${serverId} not found`);
        }

        if (this.connections.has(serverId)) {
            console.log(`Already connected to server ${serverId}`);
            return;
        }

        try {
            console.log(`Connecting to MCP server: ${server.name} (${server.url})`);
            this.emit('serverConnecting', { serverId, server });

            const ws = new WebSocket(server.url);
            
            // Add authentication headers if needed
            if (server.headers && Object.keys(server.headers).length > 0) {
                // Note: WebSocket API doesn't support custom headers directly
                // For authentication, we'll send them in the first message
                ws.authHeaders = server.headers;
            }

            ws.onopen = () => {
                console.log(`Connected to MCP server: ${server.name}`);
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

            ws.onclose = () => {
                console.log(`Disconnected from MCP server: ${server.name}`);
                this.connections.delete(serverId);
                this.activeServers.delete(serverId);
                this.serverTools.delete(serverId);
                this.emit('serverDisconnected', { serverId, server });

                // Auto-reconnect if enabled
                if (server.enabled && server.autoConnect) {
                    setTimeout(() => {
                        this.connectToServer(serverId);
                    }, server.reconnectDelay * 1000);
                }
            };

            ws.onerror = (error) => {
                console.error(`MCP server connection error (${server.name}):`, error);
                this.emit('serverError', { serverId, server, error });
            };

        } catch (error) {
            console.error(`Failed to connect to MCP server ${server.name}:`, error);
            this.emit('serverError', { serverId, server, error });
        }
    }

    // Disconnect from a specific server
    disconnectFromServer(serverId) {
        const ws = this.connections.get(serverId);
        if (ws) {
            ws.close();
        }
        this.connections.delete(serverId);
        this.activeServers.delete(serverId);
        this.serverTools.delete(serverId);
        
        const server = this.servers.get(serverId);
        this.emit('serverDisconnected', { serverId, server });
    }

    // Handle messages from MCP servers
    handleServerMessage(serverId, event) {
        try {
            const data = JSON.parse(event.data);
            
            switch (data.type) {
                case 'tools':
                    this.serverTools.set(serverId, data.tools || []);
                    this.emit('toolsUpdated', { serverId, tools: data.tools });
                    break;
                    
                case 'tool-response':
                    this.emit('toolResponse', { serverId, ...data });
                    break;
                    
                case 'connection':
                    // Handle connection acknowledgment
                    break;
                    
                default:
                    this.emit('serverMessage', { serverId, data });
            }
        } catch (error) {
            console.error(`Error parsing message from server ${serverId}:`, error);
        }
    }

    // Request tools from a server
    requestServerTools(serverId) {
        const ws = this.connections.get(serverId);
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'request-tools'
            }));
        }
    }

    // Execute a tool on a specific server
    async executeToolOnServer(serverId, toolName, parameters) {
        const ws = this.connections.get(serverId);
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            throw new Error(`Server ${serverId} is not connected`);
        }

        const requestId = this.generateRequestId();
        
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Tool execution timeout for ${toolName} on server ${serverId}`));
            }, 30000);

            const handler = (data) => {
                if (data.requestId === requestId) {
                    clearTimeout(timeout);
                    this.off('toolResponse', handler);
                    
                    if (data.error) {
                        reject(new Error(data.error));
                    } else {
                        resolve(data.result);
                    }
                }
            };

            this.on('toolResponse', handler);

            ws.send(JSON.stringify({
                type: 'execute-tool',
                requestId,
                toolName,
                parameters
            }));
        });
    }

    // Get all available tools across all connected servers
    getAllAvailableTools() {
        const allTools = [];
        
        for (const [serverId, tools] of this.serverTools.entries()) {
            const server = this.servers.get(serverId);
            if (server && this.activeServers.has(serverId)) {
                tools.forEach(tool => {
                    allTools.push({
                        ...tool,
                        serverId,
                        serverName: server.name,
                        category: server.category
                    });
                });
            }
        }
        
        return allTools;
    }

    // Get tools by category
    getToolsByCategory() {
        const categories = {};
        const allTools = this.getAllAvailableTools();
        
        allTools.forEach(tool => {
            const category = tool.category || 'general';
            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category].push(tool);
        });
        
        return categories;
    }

    // Execute a tool on the best available server
    async executeTool(toolName, parameters) {
        const allTools = this.getAllAvailableTools();
        const tool = allTools.find(t => t.name === toolName);
        
        if (!tool) {
            throw new Error(`Tool ${toolName} not found on any connected server`);
        }
        
        return this.executeToolOnServer(tool.serverId, toolName, parameters);
    }

    // Setup auto-connect for enabled servers
    setupAutoConnect() {
        for (const [serverId, server] of this.servers.entries()) {
            if (server.enabled && server.autoConnect) {
                this.connectToServer(serverId);
            }
        }
    }

    // Get server status information
    getServerStatus() {
        const status = [];
        
        for (const [serverId, server] of this.servers.entries()) {
            const isConnected = this.activeServers.has(serverId);
            const tools = this.serverTools.get(serverId) || [];
            
            status.push({
                ...server,
                connected: isConnected,
                toolCount: tools.length,
                tools: tools.map(t => t.name)
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
        return 'mcp-server-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    // Generate unique request ID
    generateRequestId() {
        return 'req-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    // Get connected servers count
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

    // Test connection to a server
    async testServerConnection(serverConfig) {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(serverConfig.url);
            
            const timeout = setTimeout(() => {
                ws.close();
                reject(new Error('Connection timeout'));
            }, 10000);
            
            ws.onopen = () => {
                clearTimeout(timeout);
                ws.close();
                resolve(true);
            };
            
            ws.onerror = (error) => {
                clearTimeout(timeout);
                reject(error);
            };
        });
    }

    // Disconnect all servers
    disconnectAll() {
        for (const serverId of this.activeServers) {
            this.disconnectFromServer(serverId);
        }
    }

    // Connect all enabled servers
    connectAll() {
        for (const [serverId, server] of this.servers.entries()) {
            if (server.enabled) {
                this.connectToServer(serverId);
            }
        }
    }

    // Reconnect all enabled servers
    reconnectAll() {
        for (const [serverId, server] of this.servers.entries()) {
            if (server.enabled && server.autoConnect) {
                this.connectToServer(serverId);
            }
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MCPServerManager;
} 