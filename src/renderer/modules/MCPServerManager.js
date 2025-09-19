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
                autoConnect: false, // Changed: Disable auto-connection by default
                reconnectDelay: 5,
                category: 'genomics',
                capabilities: ['genome-navigation', 'sequence-analysis', 'annotation'],
                isBuiltin: true,
                protocol: 'websocket' // Legacy WebSocket protocol
            }],
            ['deep-research', {
                id: 'deep-research',
                name: 'Deep Research',
                description: 'Advanced research and analysis tools',
                url: 'http://localhost:3000/api/mcp',
                enabled: true,
                autoConnect: false,
                reconnectDelay: 5,
                category: 'research',
                capabilities: ['research', 'analysis', 'data-processing'],
                isBuiltin: false,
                protocol: 'streamable-http',
                transportType: 'streamable-http',
                timeout: 600,
                headers: {
                    'Content-Type': 'application/json'
                }
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
            autoConnect: serverConfig.autoConnect === true, // Changed: Default to false for auto-connection
            reconnectDelay: serverConfig.reconnectDelay || 5,
            category: serverConfig.category || 'general',
            capabilities: serverConfig.capabilities || [],
            isBuiltin: serverConfig.isBuiltin || false,
            protocol: serverConfig.protocol || 'websocket', // Default to WebSocket
            mcpConfig: serverConfig.mcpConfig || null,
            headers: serverConfig.headers || {}
        };
        
        console.log(`🔧 Adding server ${serverId}:`, {
            name: fullConfig.name,
            url: fullConfig.url,
            protocol: fullConfig.protocol,
            originalProtocol: serverConfig.protocol,
            originalTransportType: serverConfig.transportType
        });

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
            console.log(`🔍 Server configuration for ${serverId}:`, {
                name: server.name,
                url: server.url,
                protocol: server.protocol,
                transportType: server.transportType,
                enabled: server.enabled,
                autoConnect: server.autoConnect
            });
            this.emit('serverConnecting', { serverId, server });

            // Determine connection method based on protocol/transport type
            const transportType = server.protocol || server.transportType || 'websocket';
            console.log(`🔍 Connecting to server ${serverId}:`, {
                name: server.name,
                url: server.url,
                protocol: server.protocol,
                transportType: server.transportType,
                resolvedTransportType: transportType
            });
            
            if (transportType === 'claude-mcp') {
                await this.connectToClaudeMCPServer(serverId, server);
            } else if (transportType === 'websocket') {
                await this.connectToWebSocketServer(serverId, server);
            } else if (transportType === 'streamable-http' || transportType === 'http' || transportType === 'https') {
                await this.connectToHttpServer(serverId, server);
            } else if (transportType === 'sse' || transportType === 'server-sent-events') {
                await this.connectToSSEServer(serverId, server);
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

    // Connect to SSE-based MCP server
    async connectToSSEServer(serverId, server) {
        console.log(`Connecting to SSE MCP server: ${server.name} (${server.url})`);
        
        try {
            // For SSE servers, we need to establish an EventSource connection
            // But since we're in a browser environment, we'll use a different approach
            console.log(`📡 SSE MCP server detected - using HTTP fallback for tool discovery`);
            
            // Test the connection with a simple request
            const response = await fetch(server.url, {
                method: 'GET',
                headers: {
                    'Accept': 'text/event-stream, application/json',
                    ...(server.headers || {})
                },
                mode: 'cors'
            });
            
            if (response.ok || response.status === 404 || response.status === 405) {
                console.log(`SSE MCP server is reachable: ${server.name} (${response.status})`);
                
                // Store the server as "connected" for SSE-based servers
                this.connections.set(serverId, { type: 'sse', url: server.url, headers: server.headers });
                this.activeServers.add(serverId);
                this.emit('serverConnected', { serverId, server });
                
                // Try to discover tools from the SSE server
                await this.requestSSEServerTools(serverId, server);
                
            } else {
                throw new Error(`SSE server returned ${response.status} ${response.statusText}`);
            }
            
        } catch (error) {
            console.error(`Failed to connect to SSE server ${serverId}:`, error);
            throw new Error(`SSE connection failed: ${error.message}`);
        }
    }

    // Connect to HTTP-based MCP server
    async connectToHttpServer(serverId, server) {
        console.log(`Connecting to HTTP MCP server: ${server.name} (${server.url})`);
        
        try {
            // Test the connection with a simple request
            let response = await fetch(server.url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...(server.headers || {})
                },
                mode: 'cors'
            });
            
            // If GET returns 405 (Method Not Allowed), try POST with MCP JSON-RPC
            if (response.status === 405) {
                console.log(`Server doesn't support GET, trying POST with MCP JSON-RPC`);
                response = await fetch(server.url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        ...(server.headers || {})
                    },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'ping',
                        id: this.generateRequestId()
                    }),
                    mode: 'cors'
                });
            }
            
            if (response.ok || response.status === 404 || response.status === 405) {
                // Server is responding (even if endpoint doesn't exist)
                console.log(`HTTP MCP server is reachable: ${server.name} (${response.status})`);
                
                // Store the server as "connected" for HTTP-based servers
                this.connections.set(serverId, { type: 'http', url: server.url, headers: server.headers });
                this.activeServers.add(serverId);
                this.emit('serverConnected', { serverId, server });
                
                // Try to discover tools from the HTTP server
                await this.requestHttpServerTools(serverId, server);
                
            } else {
                throw new Error(`HTTP server returned ${response.status} ${response.statusText}`);
            }
            
        } catch (error) {
            console.error(`Failed to connect to HTTP server ${serverId}:`, error);
            throw new Error(`HTTP connection failed: ${error.message}`);
        }
    }
    
    // Request tools from SSE-based MCP server
    async requestSSEServerTools(serverId, server) {
        console.log(`🔍 Requesting tools from SSE server ${serverId}`);
        
        try {
            // For SSE servers, we'll try to get tools through HTTP endpoints
            // since SSE is primarily for real-time communication
            const toolEndpoints = [
                '/tools',
                '/api/tools',
                '/mcp/tools',
                '/api/mcp/tools',
                '/tools/list',
                '/api/tools/list'
            ];
            
            let tools = [];
            let foundTools = false;
            
            for (const endpoint of toolEndpoints) {
                try {
                    const toolUrl = server.url.endsWith('/') ? 
                        `${server.url}${endpoint.substring(1)}` : 
                        `${server.url}${endpoint}`;
                    
                    console.log(`🔍 Trying SSE tool endpoint: ${toolUrl}`);
                    
                    const response = await fetch(toolUrl, {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json, text/event-stream',
                            ...(server.headers || {})
                        },
                        mode: 'cors'
                    });
                    
                    if (response.ok) {
                        const responseText = await response.text();
                        console.log(`📋 SSE tool endpoint response:`, responseText.substring(0, 200) + '...');
                        
                        // Try to parse as JSON
                        try {
                            const data = JSON.parse(responseText);
                            if (data.tools && Array.isArray(data.tools)) {
                                tools = data.tools;
                                foundTools = true;
                                break;
                            } else if (Array.isArray(data)) {
                                tools = data;
                                foundTools = true;
                                break;
                            }
                        } catch (jsonError) {
                            console.log(`⚠️ SSE endpoint ${endpoint} response is not JSON`);
                        }
                    }
                } catch (endpointError) {
                    console.log(`⚠️ SSE endpoint ${endpoint} failed:`, endpointError.message);
                    continue;
                }
            }
            
            // Store the discovered tools
            this.serverTools.set(serverId, tools);
            
            if (tools.length > 0) {
                console.log(`✅ Discovered ${tools.length} tools from SSE server ${serverId}:`, tools.map(t => t.name || t.tool_name || 'unnamed'));
            } else {
                console.log(`⚠️ No tools discovered from SSE server ${serverId} - server may not implement tool discovery via HTTP endpoints`);
                console.log(`📡 SSE servers typically use real-time communication for tool discovery`);
            }
            
        } catch (error) {
            console.error(`❌ Failed to discover tools from SSE server ${serverId}:`, error);
            this.serverTools.set(serverId, []);
        }
    }

    // Request tools from HTTP-based MCP server
    async requestHttpServerTools(serverId, server) {
        console.log(`🔍 Requesting tools from HTTP server ${serverId}`);
        
        try {
            let tools = [];
            let foundTools = false;
            
            // First try MCP JSON-RPC request (most likely to work for MCP servers)
            try {
                console.log(`🔍 Trying MCP JSON-RPC tools/list on main endpoint`);
                const mcpResponse = await fetch(server.url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        ...(server.headers || {})
                    },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'tools/list',
                        id: this.generateRequestId()
                    }),
                    mode: 'cors'
                });
                
                if (mcpResponse.ok) {
                    const responseText = await mcpResponse.text();
                    console.log(`📋 Raw response:`, responseText.substring(0, 200) + '...');
                    
                    // Check if response is SSE format
                    if (responseText.startsWith('event:') || responseText.includes('data:')) {
                        console.log(`📋 Server uses SSE format, not JSON-RPC`);
                        console.log(`🔍 Parsing SSE response for tools...`);
                        
                        // Parse SSE format to extract tools
                        try {
                            const lines = responseText.split('\n');
                            let jsonData = null;
                            
                            for (const line of lines) {
                                if (line.startsWith('data: ')) {
                                    const jsonStr = line.substring(6); // Remove 'data: ' prefix
                                    try {
                                        jsonData = JSON.parse(jsonStr);
                                        break;
                                    } catch (e) {
                                        console.log(`⚠️ Failed to parse SSE data line: ${jsonStr}`);
                                    }
                                }
                            }
                            
                            if (jsonData) {
                                console.log(`📋 Parsed SSE JSON data:`, jsonData);
                                
                                if (jsonData.result && jsonData.result.tools) {
                                    tools = jsonData.result.tools;
                                    foundTools = true;
                                    console.log(`📋 SSE tools found (result.tools):`, tools);
                                } else if (jsonData.tools && Array.isArray(jsonData.tools)) {
                                    tools = jsonData.tools;
                                    foundTools = true;
                                    console.log(`📋 SSE tools found (direct tools):`, tools);
                                } else if (jsonData.result && Array.isArray(jsonData.result)) {
                                    tools = jsonData.result;
                                    foundTools = true;
                                    console.log(`📋 SSE tools found (result array):`, tools);
                                } else {
                                    console.log(`⚠️ SSE response doesn't contain tools in expected format`);
                                    console.log(`📋 Available data:`, JSON.stringify(jsonData, null, 2));
                                }
                            } else {
                                console.log(`⚠️ No valid JSON data found in SSE response`);
                            }
                        } catch (sseError) {
                            console.log(`⚠️ Failed to parse SSE response:`, sseError.message);
                        }
                    } else {
                        // Try to parse as JSON
                        try {
                            const mcpData = JSON.parse(responseText);
                            console.log(`📋 MCP JSON-RPC response:`, mcpData);
                            console.log(`📋 Response type:`, typeof mcpData);
                            console.log(`📋 Response keys:`, Object.keys(mcpData));
                            
                            if (mcpData.result && mcpData.result.tools) {
                                tools = mcpData.result.tools;
                                foundTools = true;
                                console.log(`📋 MCP JSON-RPC tools found (result.tools):`, tools);
                            } else if (mcpData.tools && Array.isArray(mcpData.tools)) {
                                tools = mcpData.tools;
                                foundTools = true;
                                console.log(`📋 MCP JSON-RPC tools found (direct tools):`, tools);
                            } else if (mcpData.result && Array.isArray(mcpData.result)) {
                                tools = mcpData.result;
                                foundTools = true;
                                console.log(`📋 MCP JSON-RPC tools found (result array):`, tools);
                            } else {
                                console.log(`⚠️ MCP JSON-RPC response doesn't contain tools in expected format`);
                                console.log(`📋 Available data:`, JSON.stringify(mcpData, null, 2));
                            }
                        } catch (jsonError) {
                            console.log(`⚠️ Response is not valid JSON:`, jsonError.message);
                            console.log(`📋 Raw response:`, responseText);
                        }
                    }
                } else {
                    console.log(`⚠️ MCP JSON-RPC request failed: ${mcpResponse.status} ${mcpResponse.statusText}`);
                }
            } catch (mcpError) {
                console.log(`⚠️ MCP JSON-RPC request failed:`, mcpError.message);
            }
            
            // If MCP JSON-RPC didn't work, try different common MCP endpoints for tool discovery
            if (!foundTools) {
                const toolEndpoints = [
                    '/tools',
                    '/api/tools',
                    '/mcp/tools',
                    '/api/mcp/tools',
                    '/tools/list',
                    '/api/tools/list'
                ];
                
                for (const endpoint of toolEndpoints) {
                    try {
                        const toolUrl = server.url.endsWith('/') ? 
                            `${server.url}${endpoint.substring(1)}` : 
                            `${server.url}${endpoint}`;
                        
                        console.log(`🔍 Trying tool endpoint: ${toolUrl}`);
                        
                        // Try POST first (since server seems to prefer POST)
                        let response = await fetch(toolUrl, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json',
                                ...(server.headers || {})
                            },
                            body: JSON.stringify({
                                jsonrpc: '2.0',
                                method: 'tools/list',
                                id: this.generateRequestId()
                            }),
                            mode: 'cors'
                        });
                        
                        // If POST fails, try GET
                        if (!response.ok && response.status !== 405) {
                            response = await fetch(toolUrl, {
                                method: 'GET',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Accept': 'application/json',
                                    ...(server.headers || {})
                                },
                                mode: 'cors'
                            });
                        }
                        
                        if (response.ok) {
                            const data = await response.json();
                            console.log(`📋 Tool endpoint response:`, data);
                            
                            // Handle different response formats
                            if (data.tools && Array.isArray(data.tools)) {
                                tools = data.tools;
                                foundTools = true;
                                break;
                            } else if (Array.isArray(data)) {
                                tools = data;
                                foundTools = true;
                                break;
                            } else if (data.result && Array.isArray(data.result.tools)) {
                                tools = data.result.tools;
                                foundTools = true;
                                break;
                            }
                        }
                    } catch (endpointError) {
                        console.log(`⚠️ Endpoint ${endpoint} failed:`, endpointError.message);
                        continue;
                    }
                }
            }
            
            // Store the discovered tools
            this.serverTools.set(serverId, tools);
            
            if (tools.length > 0) {
                console.log(`✅ Discovered ${tools.length} tools from HTTP server ${serverId}:`, tools.map(t => t.name || t.tool_name || 'unnamed'));
            } else {
                console.log(`⚠️ No tools discovered from HTTP server ${serverId} - server may not implement MCP tool discovery`);
                // For servers that don't implement tool discovery, we'll still mark them as connected
                // but with an empty tools list
            }
            
        } catch (error) {
            console.error(`❌ Failed to discover tools from HTTP server ${serverId}:`, error);
            // Don't throw here - we still want to mark the server as connected
            // even if tool discovery fails
            this.serverTools.set(serverId, []);
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
            if (connection.type === 'http' || connection.type === 'sse') {
                // For HTTP/SSE connections, just remove from active list
                console.log(`Disconnecting from ${connection.type.toUpperCase()} server: ${serverId}`);
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
                const server = this.servers.get(serverId);
                this.emit('serverError', { serverId, server, error: data.error });
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
                    const server = this.servers.get(serverId);
                    this.emit('serverError', { serverId, server, error: data.error });
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
                const server = this.servers.get(serverId);
                this.emit('serverError', { serverId, server, error: data.error });
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

        const transportType = server.protocol || server.transportType || 'websocket';
        
        if (transportType === 'claude-mcp') {
            return await this.executeClaudeMCPTool(serverId, toolName, parameters);
        } else if (transportType === 'websocket') {
            return await this.executeWebSocketTool(serverId, toolName, parameters);
        } else if (transportType === 'streamable-http' || transportType === 'http' || transportType === 'https') {
            return await this.executeHttpTool(serverId, toolName, parameters);
        } else if (transportType === 'sse' || transportType === 'server-sent-events') {
            return await this.executeSSETool(serverId, toolName, parameters);
        } else {
            // Default to WebSocket for unknown protocols
            return await this.executeWebSocketTool(serverId, toolName, parameters);
        }
    }

    // Execute tool on SSE-based MCP server
    async executeSSETool(serverId, toolName, parameters) {
        const connection = this.connections.get(serverId);
        if (!connection || connection.type !== 'sse') {
            throw new Error(`SSE server ${serverId} not connected`);
        }

        const server = this.servers.get(serverId);
        
        try {
            console.log(`🔧 Executing tool ${toolName} on SSE server ${serverId}`);
            
            // For SSE servers, try different tool execution endpoints
            const toolEndpoints = [
                '/tools/call',
                '/api/tools/call',
                '/mcp/tools/call',
                '/api/mcp/tools/call',
                '/tools/execute',
                '/api/tools/execute'
            ];
            
            let response = null;
            let foundEndpoint = false;
            
            for (const endpoint of toolEndpoints) {
                try {
                    const toolUrl = server.url.endsWith('/') ? 
                        `${server.url}${endpoint.substring(1)}` : 
                        `${server.url}${endpoint}`;
                    
                    console.log(`🔧 Trying SSE tool execution endpoint: ${toolUrl}`);
                    
                    response = await fetch(toolUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json, text/event-stream',
                            ...(server.headers || {})
                        },
                        body: JSON.stringify({
                            tool: toolName,
                            parameters: parameters
                        }),
                        mode: 'cors'
                    });
                    
                    if (response.ok) {
                        foundEndpoint = true;
                        break;
                    }
                } catch (endpointError) {
                    console.log(`⚠️ SSE tool endpoint ${endpoint} failed:`, endpointError.message);
                    continue;
                }
            }
            
            if (!foundEndpoint) {
                throw new Error(`No working tool execution endpoint found for SSE server ${serverId}`);
            }
            
            const responseText = await response.text();
            console.log(`✅ Tool execution result from SSE server ${serverId}:`, responseText.substring(0, 200) + '...');
            
            // Try to parse as JSON
            try {
                const result = JSON.parse(responseText);
                return result.result || result.data || result.response || result;
            } catch (jsonError) {
                // If not JSON, return the raw response
                return { result: responseText, type: 'text' };
            }
            
        } catch (error) {
            console.error(`❌ Failed to execute tool ${toolName} on SSE server ${serverId}:`, error);
            throw new Error(`SSE tool execution failed: ${error.message}`);
        }
    }

    // Execute tool on HTTP-based MCP server
    async executeHttpTool(serverId, toolName, parameters) {
        const connection = this.connections.get(serverId);
        if (!connection || connection.type !== 'http') {
            throw new Error(`HTTP server ${serverId} not connected`);
        }

        const server = this.servers.get(serverId);
        
        try {
            console.log(`🔧 Executing tool ${toolName} on HTTP server ${serverId}`);
            
            // Try different common MCP tool execution endpoints
            const toolEndpoints = [
                '/tools/call',
                '/api/tools/call',
                '/mcp/tools/call',
                '/api/mcp/tools/call',
                '/tools/execute',
                '/api/tools/execute'
            ];
            
            let response = null;
            let foundEndpoint = false;
            
            for (const endpoint of toolEndpoints) {
                try {
                    const toolUrl = server.url.endsWith('/') ? 
                        `${server.url}${endpoint.substring(1)}` : 
                        `${server.url}${endpoint}`;
                    
                    console.log(`🔧 Trying tool execution endpoint: ${toolUrl}`);
                    
                    response = await fetch(toolUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                            ...(server.headers || {})
                        },
                        body: JSON.stringify({
                            tool: toolName,
                            parameters: parameters
                        }),
                        mode: 'cors'
                    });
                    
                    if (response.ok) {
                        foundEndpoint = true;
                        break;
                    }
                } catch (endpointError) {
                    console.log(`⚠️ Tool endpoint ${endpoint} failed:`, endpointError.message);
                    continue;
                }
            }
            
            if (!foundEndpoint) {
                // If no specific tool endpoint found, try MCP JSON-RPC format
                try {
                    response = await fetch(server.url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                            ...(server.headers || {})
                        },
                        body: JSON.stringify({
                            jsonrpc: '2.0',
                            method: 'tools/call',
                            params: {
                                name: toolName,
                                arguments: parameters
                            },
                            id: this.generateRequestId()
                        }),
                        mode: 'cors'
                    });
                    
                    if (response.ok) {
                        foundEndpoint = true;
                    }
                } catch (mcpError) {
                    console.log(`⚠️ MCP JSON-RPC tool execution failed:`, mcpError.message);
                }
            }
            
            if (!foundEndpoint || !response.ok) {
                throw new Error(`No working tool execution endpoint found for HTTP server ${serverId}`);
            }
            
            const result = await response.json();
            console.log(`✅ Tool execution result from HTTP server ${serverId}:`, result);
            
            // Handle different response formats
            if (result.result) {
                return result.result;
            } else if (result.data) {
                return result.data;
            } else if (result.response) {
                return result.response;
            } else {
                return result;
            }
            
        } catch (error) {
            console.error(`❌ Failed to execute tool ${toolName} on HTTP server ${serverId}:`, error);
            throw new Error(`HTTP tool execution failed: ${error.message}`);
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
        // Check global auto-connect setting
        const globalSettings = this.configManager ? 
            this.configManager.get('mcpGlobalSettings', { enableAutoConnect: false }) : 
            { enableAutoConnect: false };
            
        if (!globalSettings.enableAutoConnect) {
            console.log('🚫 MCP auto-connect is disabled globally');
            return;
        }
        
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

    // Enable/disable global auto-connect
    setGlobalAutoConnect(enabled) {
        const globalSettings = this.configManager ? 
            this.configManager.get('mcpGlobalSettings', { enableAutoConnect: false }) : 
            { enableAutoConnect: false };
            
        globalSettings.enableAutoConnect = enabled;
        
        if (this.configManager) {
            this.configManager.set('mcpGlobalSettings', globalSettings);
        }
        
        console.log(`🔧 MCP global auto-connect ${enabled ? 'enabled' : 'disabled'}`);
        
        // If enabling and there are servers that should auto-connect, connect them now
        if (enabled) {
            this.setupAutoConnect();
        }
    }
    
    // Get global auto-connect status
    getGlobalAutoConnect() {
        const globalSettings = this.configManager ? 
            this.configManager.get('mcpGlobalSettings', { enableAutoConnect: false }) : 
            { enableAutoConnect: false };
        return globalSettings.enableAutoConnect;
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