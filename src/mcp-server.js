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
const net = require('net');

class MCPGenomeBrowserServer {
    constructor(port = 3000, wsPort = 3001) {
        this.port = port;
        this.wsPort = wsPort;
        this.app = express();
        this.clients = new Map(); // Store connected Genome AI Studio clients
        this.browserState = new Map(); // Store current state of each browser instance
        this.wss = null; // Will be created in start()
        this.server = null; // Will be created in start()
        
        this.setupExpress();
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
        try {
            this.wss = new WebSocket.Server({ port: this.wsPort });
        } catch (error) {
            throw new Error(`Failed to create WebSocket server on port ${this.wsPort}: ${error.message}`);
        }
        
        this.wss.on('error', (error) => {
            console.error('WebSocket server error:', error);
            throw error;
        });
        
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
            },

            jump_to_gene: {
                name: 'jump_to_gene',
                description: 'Jump directly to a gene location by name or locus tag',
                parameters: {
                    type: 'object',
                    properties: {
                        geneName: { type: 'string', description: 'Gene name or locus tag to search for' },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: ['geneName']
                }
            },

            get_genome_info: {
                name: 'get_genome_info',
                description: 'Get comprehensive information about the loaded genome',
                parameters: {
                    type: 'object',
                    properties: {
                        clientId: { type: 'string', description: 'Browser client ID' }
                    }
                }
            },

            search_gene_by_name: {
                name: 'search_gene_by_name',
                description: 'Search for a specific gene by name or locus tag',
                parameters: {
                    type: 'object',
                    properties: {
                        name: { type: 'string', description: 'Gene name or locus tag' },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: ['name']
                }
            },

            compute_gc: {
                name: 'compute_gc',
                description: 'Calculate GC content percentage for a DNA sequence',
                parameters: {
                    type: 'object',
                    properties: {
                        sequence: { type: 'string', description: 'DNA sequence' },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: ['sequence']
                }
            },

            translate_dna: {
                name: 'translate_dna',
                description: 'Translate DNA sequence to protein (amino acid sequence)',
                parameters: {
                    type: 'object',
                    properties: {
                        dna: { type: 'string', description: 'DNA sequence to translate' },
                        frame: { type: 'number', description: 'Reading frame (0, 1, or 2)', default: 0 },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: ['dna']
                }
            },

            reverse_complement: {
                name: 'reverse_complement',
                description: 'Get reverse complement of DNA sequence',
                parameters: {
                    type: 'object',
                    properties: {
                        dna: { type: 'string', description: 'DNA sequence' },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: ['dna']
                }
            },

            find_orfs: {
                name: 'find_orfs',
                description: 'Find Open Reading Frames (ORFs) in DNA sequence',
                parameters: {
                    type: 'object',
                    properties: {
                        dna: { type: 'string', description: 'DNA sequence' },
                        minLength: { type: 'number', description: 'Minimum ORF length in codons', default: 30 },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: ['dna']
                }
            },

            search_sequence_motif: {
                name: 'search_sequence_motif',
                description: 'Search for sequence motifs in the genome',
                parameters: {
                    type: 'object',
                    properties: {
                        pattern: { type: 'string', description: 'Sequence motif pattern' },
                        chromosome: { type: 'string', description: 'Chromosome to search (optional)' },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: ['pattern']
                }
            },

            predict_promoter: {
                name: 'predict_promoter',
                description: 'Predict promoter regions in DNA sequence',
                parameters: {
                    type: 'object',
                    properties: {
                        seq: { type: 'string', description: 'DNA sequence to analyze' },
                        motif: { type: 'string', description: 'Promoter motif pattern (optional)' },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: ['seq']
                }
            },

            blast_search: {
                name: 'blast_search',
                description: 'Perform BLAST sequence similarity search',
                parameters: {
                    type: 'object',
                    properties: {
                        sequence: { type: 'string', description: 'Query sequence' },
                        blastType: { type: 'string', description: 'BLAST type (blastn, blastp, blastx, tblastn, tblastx)' },
                        database: { type: 'string', description: 'Target database' },
                        evalue: { type: 'string', description: 'E-value threshold', default: '0.01' },
                        maxTargets: { type: 'number', description: 'Maximum number of targets', default: 50 },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: ['sequence', 'blastType', 'database']
                }
            },

            show_metabolic_pathway: {
                name: 'show_metabolic_pathway',
                description: 'Display metabolic pathway visualization (e.g., glycolysis, TCA cycle, etc.)',
                parameters: {
                    type: 'object',
                    properties: {
                        pathwayName: { type: 'string', description: 'Pathway name (glycolysis, tca_cycle, pentose_phosphate, etc.)' },
                        highlightGenes: { type: 'array', description: 'List of genes to highlight in the pathway' },
                        organism: { type: 'string', description: 'Organism name for pathway context' },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: ['pathwayName']
                }
            },

            find_pathway_genes: {
                name: 'find_pathway_genes',
                description: 'Find genes associated with a specific metabolic pathway',
                parameters: {
                    type: 'object',
                    properties: {
                        pathwayName: { type: 'string', description: 'Pathway name to search for' },
                        includeRegulation: { type: 'boolean', description: 'Include regulatory genes', default: false },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: ['pathwayName']
                }
            },

            // AlphaFold-specific tools
            search_alphafold_by_gene: {
                name: 'search_alphafold_by_gene',
                description: 'Search AlphaFold database for protein structures by gene name',
                parameters: {
                    type: 'object',
                    properties: {
                        geneName: { type: 'string', description: 'Gene name to search' },
                        organism: { type: 'string', description: 'Organism name (default: Homo sapiens)' },
                        maxResults: { type: 'number', description: 'Maximum number of results to return (default: 10)' },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: ['geneName']
                }
            },

            fetch_alphafold_structure: {
                name: 'fetch_alphafold_structure',
                description: 'Fetch AlphaFold protein structure by UniProt ID',
                parameters: {
                    type: 'object',
                    properties: {
                        uniprotId: { type: 'string', description: 'UniProt ID (e.g., P53_HUMAN)' },
                        geneName: { type: 'string', description: 'Gene name for display purposes' },
                        format: { type: 'string', description: 'Structure format (pdb or cif)', default: 'pdb' },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: ['uniprotId']
                }
            },

            search_alphafold_by_sequence: {
                name: 'search_alphafold_by_sequence',
                description: 'Search AlphaFold database by protein sequence using UniProt BLAST',
                parameters: {
                    type: 'object',
                    properties: {
                        sequence: { type: 'string', description: 'Protein sequence to search' },
                        evalue: { type: 'number', description: 'E-value threshold (default: 1e-10)' },
                        maxResults: { type: 'number', description: 'Maximum number of results to return (default: 10)' },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: ['sequence']
                }
            },

            open_alphafold_viewer: {
                name: 'open_alphafold_viewer',
                description: 'Open AlphaFold 3D structure viewer with enhanced features',
                parameters: {
                    type: 'object',
                    properties: {
                        structureData: { type: 'string', description: 'PDB/CIF structure data' },
                        uniprotId: { type: 'string', description: 'UniProt ID' },
                        geneName: { type: 'string', description: 'Gene name for display' },
                        confidenceData: { type: 'string', description: 'AlphaFold confidence scores (PAE data)' },
                        organism: { type: 'string', description: 'Source organism' },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: ['structureData', 'uniprotId']
                }
            },
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

        // Handle AlphaFold tools directly on server
        if (toolName === 'search_alphafold_by_gene') {
            return await this.searchAlphaFoldByGene(parameters);
        }
        
        if (toolName === 'fetch_alphafold_structure') {
            return await this.fetchAlphaFoldStructure(parameters);
        }
        
        if (toolName === 'search_alphafold_by_sequence') {
            return await this.searchAlphaFoldBySequence(parameters);
        }
        
        if (toolName === 'open_alphafold_viewer') {
            return await this.openAlphaFoldViewer(parameters, clientId);
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

    /**
     * ALPHAFOLD INTEGRATION METHODS
     */

    /**
     * Search AlphaFold database by gene name
     */
    async searchAlphaFoldByGene(parameters) {
        const { geneName, organism = 'Homo sapiens', maxResults = 10 } = parameters;
        
        console.log('=== MCP SERVER: SEARCH ALPHAFOLD BY GENE ===');
        console.log('Searching for gene:', geneName, 'in organism:', organism);
        
        try {
            // Step 1: Search UniProt for gene name to get UniProt IDs
            const uniprotResults = await this.searchUniProtByGene(geneName, organism, maxResults);
            
            if (uniprotResults.length === 0) {
                return {
                    success: true,
                    results: [],
                    message: `No UniProt entries found for gene: ${geneName} in ${organism}`
                };
            }
            
            // Step 2: Check which UniProt IDs have AlphaFold structures
            const alphaFoldResults = [];
            for (const uniprotEntry of uniprotResults) {
                try {
                    const hasStructure = await this.checkAlphaFoldStructureExists(uniprotEntry.uniprotId);
                    if (hasStructure) {
                        alphaFoldResults.push({
                            uniprotId: uniprotEntry.uniprotId,
                            geneName: geneName,
                            proteinName: uniprotEntry.proteinName,
                            organism: uniprotEntry.organism,
                            length: uniprotEntry.length,
                            hasAlphaFoldStructure: true,
                            alphaFoldUrl: `https://alphafold.ebi.ac.uk/entry/${uniprotEntry.uniprotId}`
                        });
                    }
                } catch (error) {
                    console.warn(`Failed to check AlphaFold structure for ${uniprotEntry.uniprotId}:`, error.message);
                }
            }
            
            console.log(`Found ${alphaFoldResults.length} AlphaFold structures for gene ${geneName}`);
            console.log('=== MCP SERVER: SEARCH ALPHAFOLD BY GENE END ===');
            
            return {
                success: true,
                results: alphaFoldResults,
                totalFound: alphaFoldResults.length
            };
            
        } catch (error) {
            console.error('Error in searchAlphaFoldByGene:', error.message);
            throw new Error(`Failed to search AlphaFold database: ${error.message}`);
        }
    }

    /**
     * Search UniProt database by gene name
     */
    async searchUniProtByGene(geneName, organism, maxResults) {
        try {
            // Build UniProt search query
            const query = `gene:${geneName} AND organism:"${organism}"`;
            const encodedQuery = encodeURIComponent(query);
            
            console.log('UniProt search query:', query);
            
            const response = await this.makeHTTPSRequest({
                hostname: 'rest.uniprot.org',
                path: `/uniprotkb/search?query=${encodedQuery}&format=json&size=${maxResults}`,
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            const data = JSON.parse(response);
            
            if (!data.results || data.results.length === 0) {
                return [];
            }
            
            return data.results.map(entry => ({
                uniprotId: entry.primaryAccession,
                proteinName: entry.proteinDescription?.recommendedName?.fullName?.value || 
                           entry.proteinDescription?.submissionNames?.[0]?.fullName?.value || 
                           'Unknown protein',
                organism: entry.organism?.scientificName || organism,
                length: entry.sequence?.length,
                geneNames: entry.genes?.map(gene => gene.geneName?.value).filter(Boolean) || []
            }));
            
        } catch (error) {
            throw new Error(`Failed to search UniProt: ${error.message}`);
        }
    }

    /**
     * Check if AlphaFold structure exists for a UniProt ID
     */
    async checkAlphaFoldStructureExists(uniprotId) {
        try {
            // Try to access the AlphaFold API summary endpoint
            await this.makeHTTPSRequest({
                hostname: 'alphafold.ebi.ac.uk',
                path: `/api/prediction/${uniprotId}`,
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            return true;
        } catch (error) {
            // If we get a 404 or other error, structure doesn't exist
            return false;
        }
    }

    /**
     * Fetch AlphaFold structure by UniProt ID
     */
    async fetchAlphaFoldStructure(parameters) {
        const { uniprotId, geneName, format = 'pdb' } = parameters;
        
        console.log('=== MCP SERVER: FETCH ALPHAFOLD STRUCTURE ===');
        console.log('Fetching AlphaFold structure for UniProt ID:', uniprotId);
        
        try {
            // Step 1: Get AlphaFold metadata
            const metadataResponse = await this.makeHTTPSRequest({
                hostname: 'alphafold.ebi.ac.uk',
                path: `/api/prediction/${uniprotId}`,
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            const metadata = JSON.parse(metadataResponse);
            console.log('AlphaFold metadata retrieved for:', uniprotId);
            
            // Step 2: Download structure file
            const fileExtension = format === 'cif' ? 'cif' : 'pdb';
            const structureData = await this.makeHTTPSRequest({
                hostname: 'alphafold.ebi.ac.uk',
                path: `/files/AF-${uniprotId}-F1-model_v4.${fileExtension}`,
                method: 'GET'
            });
            
            console.log(`AlphaFold ${format.toUpperCase()} file downloaded successfully, size:`, structureData.length, 'characters');
            
            // Step 3: Get confidence data (PAE - Predicted Aligned Error)
            let confidenceData = null;
            try {
                confidenceData = await this.makeHTTPSRequest({
                    hostname: 'alphafold.ebi.ac.uk',
                    path: `/files/AF-${uniprotId}-F1-predicted_aligned_error_v4.json`,
                    method: 'GET'
                });
                console.log('AlphaFold confidence data downloaded');
            } catch (error) {
                console.warn('Could not download confidence data:', error.message);
            }
            
            const result = {
                success: true,
                uniprotId: uniprotId,
                geneName: geneName || uniprotId,
                structureData: structureData,
                format: format,
                confidenceData: confidenceData,
                metadata: {
                    modelConfidence: metadata[0]?.pLDDT,
                    modelVersion: metadata[0]?.modelVersion || 'v4',
                    modelCreatedDate: metadata[0]?.modelCreatedDate,
                    latestVersion: metadata[0]?.latestVersion,
                    sequence: metadata[0]?.uniprotSequence
                },
                downloadedAt: new Date().toISOString(),
                alphaFoldUrl: `https://alphafold.ebi.ac.uk/entry/${uniprotId}`
            };
            
            console.log('AlphaFold structure fetched successfully for:', uniprotId);
            console.log('=== MCP SERVER: FETCH ALPHAFOLD STRUCTURE END ===');
            
            return result;
            
        } catch (error) {
            console.error('Error in fetchAlphaFoldStructure:', error.message);
            throw new Error(`Failed to fetch AlphaFold structure for ${uniprotId}: ${error.message}`);
        }
    }

    /**
     * Search AlphaFold database by protein sequence
     */
    async searchAlphaFoldBySequence(parameters) {
        const { sequence, evalue = 1e-10, maxResults = 10 } = parameters;
        
        console.log('=== MCP SERVER: SEARCH ALPHAFOLD BY SEQUENCE ===');
        console.log('Searching by sequence, length:', sequence.length);
        
        try {
            // Use UniProt BLAST to find similar sequences
            const blastResults = await this.runUniProtBLAST(sequence, evalue, maxResults);
            
            if (blastResults.length === 0) {
                return {
                    success: true,
                    results: [],
                    message: 'No similar sequences found in UniProt database'
                };
            }
            
            // Check which results have AlphaFold structures
            const alphaFoldResults = [];
            for (const hit of blastResults) {
                try {
                    const hasStructure = await this.checkAlphaFoldStructureExists(hit.uniprotId);
                    if (hasStructure) {
                        alphaFoldResults.push({
                            ...hit,
                            hasAlphaFoldStructure: true,
                            alphaFoldUrl: `https://alphafold.ebi.ac.uk/entry/${hit.uniprotId}`
                        });
                    }
                } catch (error) {
                    console.warn(`Failed to check AlphaFold structure for ${hit.uniprotId}:`, error.message);
                }
            }
            
            console.log(`Found ${alphaFoldResults.length} AlphaFold structures from sequence search`);
            console.log('=== MCP SERVER: SEARCH ALPHAFOLD BY SEQUENCE END ===');
            
            return {
                success: true,
                results: alphaFoldResults,
                totalFound: alphaFoldResults.length,
                querySequence: sequence.substring(0, 50) + (sequence.length > 50 ? '...' : '')
            };
            
        } catch (error) {
            console.error('Error in searchAlphaFoldBySequence:', error.message);
            throw new Error(`Failed to search AlphaFold by sequence: ${error.message}`);
        }
    }

    /**
     * Run BLAST search against UniProt database
     */
    async runUniProtBLAST(sequence, evalue, maxResults) {
        try {
            // This is a simplified implementation - in reality, you might want to use
            // a more sophisticated BLAST service or the EBI BLAST API
            // For now, we'll use UniProt's similarity search
            
            const query = encodeURIComponent(sequence);
            const response = await this.makeHTTPSRequest({
                hostname: 'rest.uniprot.org',
                path: `/uniprotkb/search?query=sequence:${query.substring(0, 100)}&format=json&size=${maxResults}`,
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            const data = JSON.parse(response);
            
            if (!data.results || data.results.length === 0) {
                return [];
            }
            
            return data.results.map(entry => ({
                uniprotId: entry.primaryAccession,
                proteinName: entry.proteinDescription?.recommendedName?.fullName?.value || 
                           'Unknown protein',
                organism: entry.organism?.scientificName || 'Unknown',
                length: entry.sequence?.length,
                similarity: 'High', // Simplified - real implementation would calculate this
                evalue: evalue
            }));
            
        } catch (error) {
            throw new Error(`Failed to run UniProt BLAST: ${error.message}`);
        }
    }

    /**
     * Open AlphaFold structure viewer
     */
    async openAlphaFoldViewer(parameters, clientId) {
        const { structureData, uniprotId, geneName, confidenceData, organism } = parameters;
        
        console.log('=== MCP SERVER: OPEN ALPHAFOLD VIEWER ===');
        console.log('Opening AlphaFold viewer for:', { uniprotId, geneName, organism });
        
        try {
            // Send structure data to client for 3D visualization
            const client = this.clients.get(clientId);
            if (client) {
                client.send(JSON.stringify({
                    type: 'open-alphafold-viewer',
                    data: {
                        structureData: structureData,
                        uniprotId: uniprotId,
                        geneName: geneName || uniprotId,
                        confidenceData: confidenceData,
                        organism: organism,
                        isAlphaFold: true,
                        viewerType: 'alphafold'
                    }
                }));
            }
            
            console.log('AlphaFold viewer request sent to client');
            console.log('=== MCP SERVER: OPEN ALPHAFOLD VIEWER END ===');
            
            return {
                success: true,
                message: `AlphaFold structure viewer opened for ${geneName || uniprotId}`,
                uniprotId: uniprotId,
                geneName: geneName
            };
            
        } catch (error) {
            console.error('Error in openAlphaFoldViewer:', error.message);
            throw new Error(`Failed to open AlphaFold viewer: ${error.message}`);
        }
    }

    /**
     * Check if a port is available
     */
    static checkPort(port) {
        return new Promise((resolve) => {
            const server = net.createServer();
            server.listen(port, (err) => {
                if (err) {
                    resolve(false); // Port is in use
                } else {
                    server.once('close', () => {
                        resolve(true); // Port is available
                    });
                    server.close();
                }
            });
            server.on('error', () => {
                resolve(false); // Port is in use
            });
        });
    }

    /**
     * Check if both HTTP and WebSocket ports are available
     */
    async checkPortsAvailable() {
        const httpAvailable = await MCPGenomeBrowserServer.checkPort(this.port);
        const wsAvailable = await MCPGenomeBrowserServer.checkPort(this.wsPort);
        
        return {
            httpAvailable,
            wsAvailable,
            bothAvailable: httpAvailable && wsAvailable
        };
    }

    start() {
        return new Promise(async (resolve, reject) => {
            try {
                // Check if ports are available before starting
                const portCheck = await this.checkPortsAvailable();
                
                if (!portCheck.bothAvailable) {
                    const unavailablePorts = [];
                    if (!portCheck.httpAvailable) unavailablePorts.push(`${this.port} (HTTP)`);
                    if (!portCheck.wsAvailable) unavailablePorts.push(`${this.wsPort} (WebSocket)`);
                    
                    reject(new Error(`Port(s) already in use: ${unavailablePorts.join(', ')}. Please check if another MCP server instance is already running.`));
                    return;
                }
                
                // Start HTTP server
                this.server = this.app.listen(this.port, (err) => {
                    if (err) {
                        reject(new Error(`Failed to start HTTP server on port ${this.port}: ${err.message}`));
                        return;
                    }
                    
                    try {
                        // Start WebSocket server only after HTTP server is ready
                        this.setupWebSocket();
                        
                        console.log(`MCP Server running on port ${this.port}`);
                        console.log(`WebSocket server running on port ${this.wsPort}`);
                        console.log(`MCP Server Tools: ${Object.keys(this.tools).length} tools available`);
                        console.log('Key tools:', Object.keys(this.tools).slice(0, 10).join(', '), Object.keys(this.tools).length > 10 ? '...' : '');
                        
                        resolve({
                            httpPort: this.port,
                            wsPort: this.wsPort,
                            message: `MCP Server started successfully on ports ${this.port} (HTTP) and ${this.wsPort} (WebSocket)`
                        });
                    } catch (wsError) {
                        // If WebSocket setup fails, close HTTP server
                        if (this.server) {
                            this.server.close();
                            this.server = null;
                        }
                        reject(new Error(`Failed to start WebSocket server on port ${this.wsPort}: ${wsError.message}`));
                    }
                });
                
                this.server.on('error', (err) => {
                    reject(new Error(`HTTP server error: ${err.message}`));
                });
                
            } catch (error) {
                reject(new Error(`Failed to start MCP server: ${error.message}`));
            }
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