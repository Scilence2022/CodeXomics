/**
 * MCP Server for Genome AI Studio Integration
 * Provides tools for LLM to interact with the genome studio
 */

const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const https = require('https');
const fs = require('fs');
const path = require('path');

class MCPGenomeBrowserServer {
    constructor(port = 3000, wsPort = 3001) {
        this.port = port;
        this.wsPort = wsPort;
        this.app = express();
        this.clients = new Map(); // Store connected Genome AI Studio clients
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
            
            // Send available tools list
            ws.send(JSON.stringify({
                type: 'tools',
                tools: this.getAvailableTools()
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
            case 'request-tools':
                // Send available tools to the client
                const client = this.clients.get(clientId);
                if (client) {
                    client.send(JSON.stringify({
                        type: 'tools',
                        tools: this.getAvailableTools()
                    }));
                }
                break;
            case 'execute-tool':
                // Handle tool execution requests from WebSocket clients
                this.handleToolExecution(clientId, data);
                break;
        }
    }

    async handleToolExecution(clientId, data) {
        const client = this.clients.get(clientId);
        if (!client) return;

        try {
            const result = await this.executeTool(data.toolName, data.parameters, clientId);
            
            // Send successful response back to client
            client.send(JSON.stringify({
                type: 'tool-response',
                requestId: data.requestId,
                result: result,
                success: true
            }));
        } catch (error) {
            console.error(`Tool execution error for ${data.toolName}:`, error);
            
            // Send error response back to client
            client.send(JSON.stringify({
                type: 'tool-response',
                requestId: data.requestId,
                error: error.message,
                success: false
            }));
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
                description: 'Get current state of the Genome AI Studio',
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
            },

            fetch_protein_structure: {
                name: 'fetch_protein_structure',
                description: 'Fetch protein 3D structure from PDB database by gene name or PDB ID',
                parameters: {
                    type: 'object',
                    properties: {
                        geneName: { type: 'string', description: 'Gene name to search for protein structure' },
                        pdbId: { type: 'string', description: 'Direct PDB ID (alternative to gene name)' },
                        organism: { type: 'string', description: 'Organism name for more specific search' },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    }
                }
            },

            open_protein_viewer: {
                name: 'open_protein_viewer',
                description: 'Open 3D protein structure viewer in a separate window',
                parameters: {
                    type: 'object',
                    properties: {
                        pdbData: { type: 'string', description: 'PDB structure data' },
                        proteinName: { type: 'string', description: 'Protein name for display' },
                        pdbId: { type: 'string', description: 'PDB ID' },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: ['pdbData', 'proteinName']
                }
            },

            search_protein_by_gene: {
                name: 'search_protein_by_gene',
                description: 'Search for protein structures associated with a gene',
                parameters: {
                    type: 'object',
                    properties: {
                        geneName: { type: 'string', description: 'Gene name to search' },
                        organism: { type: 'string', description: 'Organism name (optional)' },
                        maxResults: { type: 'number', description: 'Maximum number of results to return' },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: ['geneName']
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

        // Handle protein structure tools directly on server
        if (toolName === 'fetch_protein_structure') {
            return await this.fetchProteinStructure(parameters);
        }
        
        if (toolName === 'search_protein_by_gene') {
            return await this.searchProteinByGene(parameters);
        }

        // For client-side tools, find client
        const client = this.clients.get(clientId);
        if (!client) {
            // If no specific client, use the first available one
            const firstClient = this.clients.values().next().value;
            if (!firstClient) {
                throw new Error('No Genome AI Studio clients connected');
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

    /**
     * Fetch protein structure from PDB database
     */
    async fetchProteinStructure(parameters) {
        const { geneName, pdbId, organism } = parameters;
        
        console.log('=== MCP SERVER: FETCH PROTEIN STRUCTURE ===');
        console.log('Received parameters:', { geneName, pdbId, organism });
        
        try {
            let targetPdbId = pdbId;
            
            // If no PDB ID provided, search by gene name
            if (!targetPdbId && geneName) {
                console.log('No PDB ID provided, searching by gene name:', geneName);
                const searchResults = await this.searchProteinByGene({ geneName, organism, maxResults: 1 });
                if (searchResults.length === 0) {
                    throw new Error(`No protein structures found for gene: ${geneName}`);
                }
                targetPdbId = searchResults[0].pdbId;
                console.log('Found PDB ID from gene search:', targetPdbId);
            }
            
            if (!targetPdbId) {
                throw new Error('No PDB ID specified or found');
            }
            
            console.log('Downloading PDB file for ID:', targetPdbId);
            
            // Download PDB file
            const pdbData = await this.downloadPDBFile(targetPdbId);
            
            console.log('PDB file downloaded successfully, size:', pdbData.length, 'characters');
            
            const result = {
                success: true,
                pdbId: targetPdbId,
                pdbData: pdbData,
                geneName: geneName || targetPdbId,
                downloadedAt: new Date().toISOString()
            };
            
            console.log('Returning result with PDB ID:', result.pdbId);
            console.log('=== MCP SERVER: FETCH PROTEIN STRUCTURE END ===');
            
            return result;
            
        } catch (error) {
            console.error('Error in fetchProteinStructure:', error.message);
            throw new Error(`Failed to fetch protein structure: ${error.message}`);
        }
    }

    /**
     * Search for protein structures by gene name using RCSB PDB API
     */
    async searchProteinByGene(parameters) {
        const { geneName, organism, maxResults = 10 } = parameters;
        
        try {
            // Create search query for RCSB PDB
            const searchQuery = {
                query: {
                    type: "group",
                    logical_operator: "and",
                    nodes: [
                        {
                            type: "terminal",
                            service: "text",
                            parameters: {
                                attribute: "rcsb_entity_source_organism.taxonomy_lineage.name",
                                operator: "contains_words",
                                value: organism || "Homo sapiens"
                            }
                        },
                        {
                            type: "terminal", 
                            service: "text",
                            parameters: {
                                attribute: "rcsb_polymer_entity.rcsb_gene_name.value",
                                operator: "exact_match",
                                value: geneName.toUpperCase()
                            }
                        }
                    ]
                },
                request_options: {
                    pager: {
                        start: 0,
                        rows: maxResults
                    }
                },
                return_type: "entry"
            };

            const searchResults = await this.makeHTTPSRequest({
                hostname: 'search.rcsb.org',
                path: '/rcsbsearch/v2/query',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            }, JSON.stringify(searchQuery));

            const results = JSON.parse(searchResults);
            
            if (!results.result_set || results.result_set.length === 0) {
                return [];
            }

            // Get detailed information for each structure
            const detailedResults = [];
            for (const result of results.result_set.slice(0, maxResults)) {
                try {
                    const details = await this.getPDBDetails(result.identifier);
                    detailedResults.push({
                        pdbId: result.identifier,
                        title: details.title || `Structure ${result.identifier}`,
                        resolution: details.resolution,
                        method: details.method,
                        organism: details.organism,
                        geneName: geneName,
                        releaseDate: details.releaseDate
                    });
                } catch (error) {
                    console.warn(`Failed to get details for PDB ${result.identifier}:`, error.message);
                }
            }

            return detailedResults;
            
        } catch (error) {
            throw new Error(`Failed to search protein structures: ${error.message}`);
        }
    }

    /**
     * Get detailed information about a PDB structure
     */
    async getPDBDetails(pdbId) {
        try {
            const response = await this.makeHTTPSRequest({
                hostname: 'data.rcsb.org',
                path: `/rest/v1/core/entry/${pdbId}`,
                method: 'GET'
            });

            const data = JSON.parse(response);
            
            return {
                title: data.struct?.title,
                resolution: data.rcsb_entry_info?.resolution_combined?.[0],
                method: data.exptl?.[0]?.method,
                organism: data.rcsb_entry_container_identifiers?.organism_names?.[0],
                releaseDate: data.rcsb_accession_info?.initial_release_date
            };
        } catch (error) {
            return {}; // Return empty object if details can't be fetched
        }
    }

    /**
     * Download PDB file content
     */
    async downloadPDBFile(pdbId) {
        try {
            const pdbData = await this.makeHTTPSRequest({
                hostname: 'files.rcsb.org',
                path: `/download/${pdbId}.pdb`,
                method: 'GET'
            });
            
            return pdbData;
        } catch (error) {
            throw new Error(`Failed to download PDB file for ${pdbId}: ${error.message}`);
        }
    }

    /**
     * Helper method to make HTTPS requests
     */
    makeHTTPSRequest(options, postData = null) {
        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(data);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    }
                });
            });
            
            req.on('error', (error) => {
                reject(error);
            });
            
            if (postData) {
                req.write(postData);
            }
            
            req.end();
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