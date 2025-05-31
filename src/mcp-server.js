/**
 * MCP Server for Genome Browser Integration
 * Provides tools for LLM to interact with the genome browser
 */

const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

class MCPGenomeBrowserServer {
    constructor(port = 3000, wsPort = 3001) {
        this.port = port;
        this.wsPort = wsPort;
        this.app = express();
        this.clients = new Map(); // Store connected genome browser clients
        this.browserState = new Map(); // Store current state of each browser instance
        
        this.setupExpress();
        this.setupWebSocket();
        this.setupMCPTools();
    }

    setupExpress() {
        this.app.use(cors());
        this.app.use(express.json());

        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({ status: 'healthy', clients: this.clients.size });
        });

        // MCP tools endpoint
        this.app.get('/tools', (req, res) => {
            res.json(this.getAvailableTools());
        });

        // Tool execution endpoint
        this.app.post('/execute-tool', async (req, res) => {
            try {
                const { toolName, parameters, clientId } = req.body;
                const result = await this.executeTool(toolName, parameters, clientId);
                res.json({ success: true, result });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });
    }

    setupWebSocket() {
        this.wss = new WebSocket.Server({ port: this.wsPort });
        
        this.wss.on('connection', (ws) => {
            const clientId = uuidv4();
            console.log(`New client connected: ${clientId}`);
            
            this.clients.set(clientId, ws);
            this.browserState.set(clientId, {
                currentChromosome: null,
                currentPosition: { start: 0, end: 0 },
                loadedFiles: [],
                visibleTracks: [],
                selectedFeatures: [],
                sequenceLength: 0,
                annotations: [],
                searchResults: []
            });

            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    this.handleBrowserMessage(clientId, data);
                } catch (error) {
                    console.error('Error parsing message:', error);
                }
            });

            ws.on('close', () => {
                console.log(`Client disconnected: ${clientId}`);
                this.clients.delete(clientId);
                this.browserState.delete(clientId);
            });

            // Send initial connection message
            ws.send(JSON.stringify({
                type: 'connection',
                clientId: clientId,
                message: 'Connected to MCP server'
            }));
        });
    }

    handleBrowserMessage(clientId, data) {
        const state = this.browserState.get(clientId);
        if (!state) return;

        switch (data.type) {
            case 'state-update':
                Object.assign(state, data.state);
                break;
            case 'file-loaded':
                state.loadedFiles.push(data.fileInfo);
                break;
            case 'navigation':
                state.currentPosition = data.position;
                state.currentChromosome = data.chromosome;
                break;
            case 'search-results':
                state.searchResults = data.results;
                break;
            case 'feature-selected':
                state.selectedFeatures = data.features;
                break;
            case 'track-visibility':
                state.visibleTracks = data.tracks;
                break;
        }
    }

    setupMCPTools() {
        this.tools = {
            // Navigation tools
            navigate_to_position: {
                name: 'navigate_to_position',
                description: 'Navigate to a specific genomic position',
                parameters: {
                    type: 'object',
                    properties: {
                        chromosome: { type: 'string', description: 'Chromosome name' },
                        start: { type: 'number', description: 'Start position' },
                        end: { type: 'number', description: 'End position' },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: ['chromosome', 'start', 'end']
                }
            },

            search_features: {
                name: 'search_features',
                description: 'Search for genes or features by name or sequence',
                parameters: {
                    type: 'object',
                    properties: {
                        query: { type: 'string', description: 'Search query (gene name or sequence)' },
                        caseSensitive: { type: 'boolean', description: 'Case sensitive search' },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: ['query']
                }
            },

            get_current_state: {
                name: 'get_current_state',
                description: 'Get current state of the genome browser',
                parameters: {
                    type: 'object',
                    properties: {
                        clientId: { type: 'string', description: 'Browser client ID' }
                    }
                }
            },

            get_sequence: {
                name: 'get_sequence',
                description: 'Get DNA sequence for a specific region',
                parameters: {
                    type: 'object',
                    properties: {
                        chromosome: { type: 'string', description: 'Chromosome name' },
                        start: { type: 'number', description: 'Start position' },
                        end: { type: 'number', description: 'End position' },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: ['chromosome', 'start', 'end']
                }
            },

            toggle_track: {
                name: 'toggle_track',
                description: 'Show or hide a specific track',
                parameters: {
                    type: 'object',
                    properties: {
                        trackName: { type: 'string', description: 'Track name (genes, gc, variants, reads, proteins)' },
                        visible: { type: 'boolean', description: 'Whether to show or hide the track' },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: ['trackName', 'visible']
                }
            },

            create_annotation: {
                name: 'create_annotation',
                description: 'Create a new user-defined annotation',
                parameters: {
                    type: 'object',
                    properties: {
                        type: { type: 'string', description: 'Feature type (gene, CDS, rRNA, tRNA, etc.)' },
                        name: { type: 'string', description: 'Feature name' },
                        chromosome: { type: 'string', description: 'Chromosome' },
                        start: { type: 'number', description: 'Start position' },
                        end: { type: 'number', description: 'End position' },
                        strand: { type: 'number', description: 'Strand (1 for forward, -1 for reverse)' },
                        description: { type: 'string', description: 'Feature description' },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: ['type', 'name', 'chromosome', 'start', 'end']
                }
            },

            analyze_region: {
                name: 'analyze_region',
                description: 'Analyze a genomic region and return features, GC content, etc.',
                parameters: {
                    type: 'object',
                    properties: {
                        chromosome: { type: 'string', description: 'Chromosome name' },
                        start: { type: 'number', description: 'Start position' },
                        end: { type: 'number', description: 'End position' },
                        includeFeatures: { type: 'boolean', description: 'Include gene/feature annotations' },
                        includeGC: { type: 'boolean', description: 'Include GC content analysis' },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: ['chromosome', 'start', 'end']
                }
            },

            export_data: {
                name: 'export_data',
                description: 'Export sequence or annotation data',
                parameters: {
                    type: 'object',
                    properties: {
                        format: { type: 'string', description: 'Export format (fasta, genbank, gff, bed)' },
                        chromosome: { type: 'string', description: 'Chromosome (optional for full export)' },
                        start: { type: 'number', description: 'Start position (optional)' },
                        end: { type: 'number', description: 'End position (optional)' },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: ['format']
                }
            }
        };
    }

    getAvailableTools() {
        return Object.values(this.tools);
    }

    async executeTool(toolName, parameters, clientId) {
        const tool = this.tools[toolName];
        if (!tool) {
            throw new Error(`Unknown tool: ${toolName}`);
        }

        const client = this.clients.get(clientId);
        if (!client) {
            // If no specific client, use the first available one
            const firstClient = this.clients.values().next().value;
            if (!firstClient) {
                throw new Error('No genome browser clients connected');
            }
            clientId = Array.from(this.clients.keys())[0];
        }

        return await this.executeToolOnClient(toolName, parameters, clientId);
    }

    async executeToolOnClient(toolName, parameters, clientId) {
        const client = this.clients.get(clientId);
        const state = this.browserState.get(clientId);

        return new Promise((resolve, reject) => {
            const requestId = uuidv4();
            const timeout = setTimeout(() => {
                reject(new Error('Tool execution timeout'));
            }, 30000);

            const messageHandler = (message) => {
                try {
                    const data = JSON.parse(message);
                    if (data.type === 'tool-response' && data.requestId === requestId) {
                        clearTimeout(timeout);
                        client.removeListener('message', messageHandler);
                        
                        if (data.success) {
                            resolve(data.result);
                        } else {
                            reject(new Error(data.error));
                        }
                    }
                } catch (error) {
                    console.error('Error parsing tool response:', error);
                }
            };

            client.on('message', messageHandler);

            // Send tool execution request
            client.send(JSON.stringify({
                type: 'execute-tool',
                requestId: requestId,
                toolName: toolName,
                parameters: parameters
            }));
        });
    }

    start() {
        this.server = this.app.listen(this.port, () => {
            console.log(`MCP Server running on port ${this.port}`);
            console.log(`WebSocket server running on port ${this.wsPort}`);
            console.log('Available tools:', Object.keys(this.tools).join(', '));
        });
    }

    stop() {
        if (this.server) {
            this.server.close();
        }
        if (this.wss) {
            this.wss.close();
        }
    }
}

module.exports = MCPGenomeBrowserServer;

// Start server if run directly
if (require.main === module) {
    const server = new MCPGenomeBrowserServer();
    server.start();
} 