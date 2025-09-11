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

        // Clean up duplicate/obsolete servers
        this.cleanupObsoleteServers();
        
        // Ensure default servers exist
        defaultServers.forEach((server, id) => {
            if (!this.servers.has(id)) {
                this.servers.set(id, server);
            }
        });
    }

    // Clean up obsolete/duplicate servers
    cleanupObsoleteServers() {
        const obsoleteServerIds = [
            'unified-claude-mcp',
            'claude-mcp-genome',
            'dev-local'
        ];
        
        obsoleteServerIds.forEach(serverId => {
            if (this.servers.has(serverId)) {
                console.log(`Removing obsolete server: ${serverId}`);
                this.servers.delete(serverId);
            }
        });
        
        // Save the cleaned configuration
        this.saveServerConfigurations();
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

            // Determine connection method based on protocol/transport type
            const transportType = server.protocol || server.transportType || 'websocket';
            
            if (transportType === 'claude-mcp') {
                await this.connectToClaudeMCPServer(serverId, server);
            } else if (transportType === 'websocket') {
                await this.connectToWebSocketServer(serverId, server);
            } else if (transportType === 'streamable-http' || transportType === 'http' || transportType === 'https') {
                await this.connectToHttpServer(serverId, server);
            } else {
                // Default to WebSocket for unknown protocols
                console.warn(`Unknown transport type '${transportType}', defaulting to WebSocket`);
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
            const handshake = {
                type: 'claude-mcp-client',
                clientId: this.generateClientId(),
                protocol: 'claude-mcp',
                capabilities: ['tool-execution', 'state-sync']
            };
            console.log(`📤 Sending handshake to ${serverId}:`, handshake);
            ws.send(JSON.stringify(handshake));

            // Request available tools
            this.requestClaudeMCPTools(serverId);
            
            // Also request tools after a delay to handle any timing issues
            setTimeout(() => {
                this.requestClaudeMCPTools(serverId);
            }, 1000);
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

    // Connect to HTTP-based MCP server
    async connectToHttpServer(serverId, server) {
        console.log(`Connecting to HTTP MCP server: ${server.name} (${server.url})`);
        
        // For HTTP servers, we don't maintain a persistent connection
        // Instead, we'll make HTTP requests when needed
        // This is a placeholder implementation - in practice, you might want to:
        // 1. Test the connection with a simple GET request
        // 2. Store the server configuration for later use
        // 3. Implement HTTP-based MCP protocol if needed
        
        try {
            // Test the connection with a simple request
            const response = await fetch(server.url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...(server.headers || {})
                },
                mode: 'cors'
            });
            
            if (response.ok || response.status === 404 || response.status === 405) {
                // Server is responding (even if endpoint doesn't exist)
                console.log(`HTTP MCP server is reachable: ${server.name}`);
                
                // Store the server as "connected" for HTTP-based servers
                this.connections.set(serverId, { type: 'http', url: server.url, headers: server.headers });
                this.activeServers.add(serverId);
                this.emit('serverConnected', { serverId, server });
                
                // For HTTP servers, we might not have tools in the traditional sense
                // But we can still register the server as available
                this.serverTools.set(serverId, []);
                
            } else {
                throw new Error(`HTTP server returned ${response.status} ${response.statusText}`);
            }
            
        } catch (error) {
            console.error(`Failed to connect to HTTP server ${serverId}:`, error);
            throw new Error(`HTTP connection failed: ${error.message}`);
        }
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
        const connection = this.connections.get(serverId);
        const claudeWs = this.claudeMCPConnections.get(serverId);
        
        if (connection) {
            if (connection.type === 'http') {
                // For HTTP connections, just remove from active list
                console.log(`Disconnecting from HTTP server: ${serverId}`);
            } else if (connection.close) {
                // For WebSocket connections, close the connection
                connection.close();
            }
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
            console.log(`📨 Received message from Claude MCP server ${serverId}:`, data);
            
            if (data.type === 'tools-list') {
                // Handle tools list from Claude MCP server
                console.log(`🔧 Received tools-list from Claude MCP server ${serverId}:`, data.tools?.length || 0, 'tools');
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
            console.log(`📨 Received message from legacy server ${serverId}:`, data);
            
            // Handle JSON-RPC responses
            if (data.jsonrpc === '2.0') {
                if (data.result && data.result.tools) {
                    // Handle tools list from JSON-RPC response
                    console.log(`🔧 Received JSON-RPC tools from server ${serverId}:`, data.result.tools.length, 'tools');
                    this.serverTools.set(serverId, data.result.tools || []);
                    this.emit('toolsUpdated', { serverId, tools: data.result.tools });
                } else if (data.result && data.result.content) {
                    // Handle tool execution response from JSON-RPC
                    this.emit('toolResponse', { 
                        serverId, 
                        data: { 
                            requestId: data.id, 
                            success: true, 
                            result: data.result 
                        } 
                    });
                } else if (data.error) {
                    console.error(`JSON-RPC error from server ${serverId}:`, data.error);
                    this.emit('serverError', { serverId, error: data.error });
                    // Also emit as tool response error if it has an ID (could be tool execution error)
                    if (data.id) {
                        this.emit('toolResponse', { 
                            serverId, 
                            data: { 
                                requestId: data.id, 
                                success: false, 
                                error: data.error.message 
                            } 
                        });
                    }
                }
            }
            // Handle legacy message format
            else if (data.type === 'tools') {
                // Handle tools list from legacy server
                console.log(`🔧 Received legacy tools from server ${serverId}:`, data.tools?.length || 0, 'tools');
                this.serverTools.set(serverId, data.tools || []);
                this.emit('toolsUpdated', { serverId, tools: data.tools });
            } else if (data.type === 'tool-response') {
                // Handle tool execution response
                this.emit('toolResponse', { serverId, data });
            } else if (data.type === 'error') {
                console.error(`Legacy server error (${serverId}):`, data.error);
                this.emit('serverError', { serverId, error: data.error });
            } else if (data.type === 'connection') {
                // Handle connection confirmation
                console.log(`📡 Connection confirmed from server ${serverId}:`, data.status);
            }
        } catch (error) {
            console.error(`Error parsing message from ${serverId}:`, error);
        }
    }

    // Request tools from Claude MCP server
    requestClaudeMCPTools(serverId) {
        const ws = this.claudeMCPConnections.get(serverId);
        if (ws && ws.readyState === WebSocket.OPEN) {
            console.log(`🔍 Requesting tools from Claude MCP server ${serverId}`);
            ws.send(JSON.stringify({
                type: 'list-tools',
                requestId: this.generateRequestId()
            }));
        } else {
            console.warn(`❌ Cannot request tools from Claude MCP server ${serverId}: connection not ready`);
        }
    }

    // Request tools from legacy server
    requestServerTools(serverId) {
        const ws = this.connections.get(serverId);
        if (ws && ws.readyState === WebSocket.OPEN) {
            console.log(`🔍 Requesting tools from legacy server ${serverId}`);
            const requestId = this.generateRequestId();
            
            // Use JSON-RPC format for MCP protocol compatibility
            const request = {
                jsonrpc: '2.0',
                method: 'tools/list',
                id: requestId
            };
            console.log(`📤 Sending JSON-RPC request:`, request);
            ws.send(JSON.stringify(request));
        } else {
            console.warn(`❌ Cannot request tools from legacy server ${serverId}: connection not ready`);
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

            // Send JSON-RPC tool execution request
            ws.send(JSON.stringify({
                jsonrpc: '2.0',
                method: 'tools/call',
                params: {
                    name: toolName,
                    arguments: parameters
                },
                id: requestId
            }));
        });
    }

    // Get all available tools from all connected servers
    getAllAvailableTools() {
        const allTools = [];
        
        // Debug logging
        console.log('🔍 getAllAvailableTools debug:');
        console.log('📊 serverTools size:', this.serverTools.size);
        console.log('📊 activeServers size:', this.activeServers.size);
        console.log('📊 servers size:', this.servers.size);
        
        for (const [serverId, tools] of this.serverTools) {
            console.log(`🔧 Server ${serverId}: ${tools.length} tools`);
            const server = this.servers.get(serverId);
            const isActive = this.activeServers.has(serverId);
            console.log(`📡 Server ${serverId} - exists: ${!!server}, active: ${isActive}`);
            
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
                console.log(`✅ Added ${tools.length} tools from server ${serverId}`);
            }
        }
        
        console.log(`🎯 Total tools found: ${allTools.length}`);
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
            // Validate URL first
            if (!serverConfig.url || serverConfig.url === 'null') {
                reject(new Error('Invalid server URL'));
                return;
            }
            
            // Determine transport type
            const transportType = serverConfig.transportType || 'websocket';
            
            if (transportType === 'websocket') {
                this.testWebSocketConnection(serverConfig, resolve, reject);
            } else if (transportType === 'streamable-http' || transportType === 'http' || transportType === 'https') {
                this.testHttpConnection(serverConfig, resolve, reject);
            } else {
                reject(new Error(`Unsupported transport type: ${transportType}`));
            }
        });
    }
    
    // Test WebSocket connection
    testWebSocketConnection(serverConfig, resolve, reject) {
        const testWs = new WebSocket(serverConfig.url);
        
        const timeout = setTimeout(() => {
            testWs.close();
            reject(new Error('WebSocket connection timeout (5 seconds)'));
        }, 5000);
        
        testWs.onopen = () => {
            clearTimeout(timeout);
            testWs.close();
            resolve(true);
        };
        
        testWs.onerror = (error) => {
            clearTimeout(timeout);
            // Provide more specific error messages
            if (serverConfig.url.includes('localhost:3000')) {
                reject(new Error('WebSocket connection failed: No MCP server running on localhost:3000. Please start the MCP server first.'));
            } else if (serverConfig.url.includes('localhost:3003')) {
                reject(new Error('WebSocket connection failed: No MCP server running on localhost:3003. Please start the Genome AI Studio MCP server first.'));
            } else {
                reject(new Error(`WebSocket connection failed: ${error.message || 'Connection refused'}`));
            }
        };
        
        testWs.onclose = (event) => {
            clearTimeout(timeout);
            if (event.code !== 1000) { // Not a normal closure
                reject(new Error(`WebSocket connection closed unexpectedly (code: ${event.code})`));
            }
        };
    }
    
    // Test HTTP/HTTPS connection
    testHttpConnection(serverConfig, resolve, reject) {
        const timeout = setTimeout(() => {
            reject(new Error('HTTP connection timeout (5 seconds)'));
        }, 5000);
        
        // Create a simple HTTP request to test the connection
        const url = serverConfig.url;
        const headers = serverConfig.headers || {};
        
        // Add default headers for MCP
        const requestHeaders = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...headers
        };
        
        // Use fetch for HTTP/HTTPS testing
        fetch(url, {
            method: 'GET',
            headers: requestHeaders,
            mode: 'cors'
        })
        .then(response => {
            clearTimeout(timeout);
            if (response.ok || response.status === 404 || response.status === 405) {
                // Server is responding (even if endpoint doesn't exist)
                resolve(true);
            } else {
                reject(new Error(`HTTP connection failed: Server returned ${response.status} ${response.statusText}`));
            }
        })
        .catch(error => {
            clearTimeout(timeout);
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                reject(new Error(`HTTP connection failed: Cannot connect to ${url}. Please check if the server is running.`));
            } else {
                reject(new Error(`HTTP connection failed: ${error.message}`));
            }
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