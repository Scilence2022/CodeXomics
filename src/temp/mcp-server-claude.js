/**
 * Claude MCP Server for Genome AI Studio Integration
 * Uses official Claude MCP TypeScript SDK for proper protocol compliance
 */

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { 
  CallToolRequestSchema, 
  ListToolsRequestSchema 
} = require("@modelcontextprotocol/sdk/types.js");
const WebSocket = require('ws');
const https = require('https');
const { v4: uuidv4 } = require('uuid');
const net = require('net');

class ClaudeMCPGenomeServer {
    constructor() {
        this.server = new Server({
            name: "genome-ai-studio-server",
            version: "1.0.0",
            description: "Claude MCP Server for Genome AI Studio - Comprehensive genomics analysis tools"
        }, {
            capabilities: {
                tools: {}
            }
        });
        
        this.clients = new Map(); // Store connected Genome AI Studio clients
        this.browserState = new Map(); // Store current state of each browser instance
        this.wsServer = null;
        this.wsPort = 3001;
        
        this.setupToolHandlers();
        this.setupWebSocketServer();
    }

    // Find available port
    async findAvailablePort(startPort = 3001) {
        return new Promise((resolve, reject) => {
            const server = net.createServer();
            server.listen(startPort, () => {
                const port = server.address().port;
                server.close(() => resolve(port));
            });
            server.on('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    this.findAvailablePort(startPort + 1).then(resolve).catch(reject);
                } else {
                    reject(err);
                }
            });
        });
    }

    async setupWebSocketServer() {
        try {
            this.wsPort = await this.findAvailablePort(3001);
            this.wsServer = new WebSocket.Server({ port: this.wsPort });
            
            this.wsServer.on('connection', (ws) => {
                const clientId = uuidv4();
                process.stderr.write(`New client connected: ${clientId}\n`);
                
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
                        process.stderr.write(`Error parsing message: ${error}\n`);
                    }
                });

                ws.on('close', () => {
                    process.stderr.write(`Client disconnected: ${clientId}\n`);
                    this.clients.delete(clientId);
                    this.browserState.delete(clientId);
                });
            });
            
            process.stderr.write(`WebSocket server started on port ${this.wsPort}\n`);
        } catch (error) {
            process.stderr.write(`Failed to start WebSocket server: ${error}\n`);
        }
    }

    handleBrowserMessage(clientId, data) {
        if (data.type === 'state-update') {
            // Update browser state
            const state = this.browserState.get(clientId);
            if (state) {
                Object.assign(state, data.state);
            }
        } else if (data.type === 'tool-response') {
            // Handle tool execution responses from browser
            this.handleToolResponse(clientId, data);
        }
    }

    handleToolResponse(clientId, data) {
        // Handle responses from browser-side tool execution
        console.log(`Tool response from client ${clientId}:`, data);
    }

    setupToolHandlers() {
        // List all available tools
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    // Navigation tools
                    {
                        name: "navigate_to_position",
                        description: "Navigate to a specific genomic position",
                        inputSchema: {
                            type: "object",
                            properties: {
                                chromosome: { type: "string", description: "Chromosome name" },
                                start: { type: "number", description: "Start position" },
                                end: { type: "number", description: "End position" },
                                clientId: { type: "string", description: "Browser client ID" }
                            },
                            required: ["chromosome", "start", "end"]
                        }
                    },
                    {
                        name: "search_features",
                        description: "Search for genomic features",
                        inputSchema: {
                            type: "object",
                            properties: {
                                query: { type: "string", description: "Search query" },
                                featureType: { type: "string", description: "Type of feature to search for" },
                                clientId: { type: "string", description: "Browser client ID" }
                            },
                            required: ["query"]
                        }
                    },
                    {
                        name: "get_current_state",
                        description: "Get current state of the Genome AI Studio",
                        inputSchema: {
                            type: "object",
                            properties: {
                                clientId: { type: "string", description: "Browser client ID" }
                            }
                        }
                    },
                    {
                        name: "get_sequence",
                        description: "Get DNA sequence for a specific region",
                        inputSchema: {
                            type: "object",
                            properties: {
                                chromosome: { type: "string", description: "Chromosome name" },
                                start: { type: "number", description: "Start position" },
                                end: { type: "number", description: "End position" },
                                clientId: { type: "string", description: "Browser client ID" }
                            },
                            required: ["chromosome", "start", "end"]
                        }
                    },
                    {
                        name: "toggle_track",
                        description: "Show or hide a specific track",
                        inputSchema: {
                            type: "object",
                            properties: {
                                trackName: { type: "string", description: "Track name (genes, gc, variants, reads, proteins)" },
                                visible: { type: "boolean", description: "Whether to show or hide the track" },
                                clientId: { type: "string", description: "Browser client ID" }
                            },
                            required: ["trackName", "visible"]
                        }
                    },
                    {
                        name: "create_annotation",
                        description: "Create a new user-defined annotation",
                        inputSchema: {
                            type: "object",
                            properties: {
                                type: { type: "string", description: "Feature type (gene, CDS, rRNA, tRNA, etc.)" },
                                name: { type: "string", description: "Feature name" },
                                chromosome: { type: "string", description: "Chromosome" },
                                start: { type: "number", description: "Start position" },
                                end: { type: "number", description: "End position" },
                                strand: { type: "number", description: "Strand (1 for forward, -1 for reverse)" },
                                description: { type: "string", description: "Feature description" },
                                clientId: { type: "string", description: "Browser client ID" }
                            },
                            required: ["type", "name", "chromosome", "start", "end"]
                        }
                    },
                    {
                        name: "analyze_region",
                        description: "Analyze a genomic region and return features, GC content, etc.",
                        inputSchema: {
                            type: "object",
                            properties: {
                                chromosome: { type: "string", description: "Chromosome name" },
                                start: { type: "number", description: "Start position" },
                                end: { type: "number", description: "End position" },
                                includeFeatures: { type: "boolean", description: "Include gene/feature annotations" },
                                includeGC: { type: "boolean", description: "Include GC content analysis" },
                                clientId: { type: "string", description: "Browser client ID" }
                            },
                            required: ["chromosome", "start", "end"]
                        }
                    },
                    {
                        name: "export_data",
                        description: "Export sequence or annotation data",
                        inputSchema: {
                            type: "object",
                            properties: {
                                format: { type: "string", description: "Export format (fasta, genbank, gff, bed)" },
                                chromosome: { type: "string", description: "Chromosome (optional for full export)" },
                                start: { type: "number", description: "Start position (optional)" },
                                end: { type: "number", description: "End position (optional)" },
                                clientId: { type: "string", description: "Browser client ID" }
                            },
                            required: ["format"]
                        }
                    },
                    // Gene and sequence analysis tools
                    {
                        name: "jump_to_gene",
                        description: "Jump directly to a gene location by name or locus tag",
                        inputSchema: {
                            type: "object",
                            properties: {
                                geneName: { type: "string", description: "Gene name or locus tag to search for" },
                                clientId: { type: "string", description: "Browser client ID" }
                            },
                            required: ["geneName"]
                        }
                    },
                    {
                        name: "get_genome_info",
                        description: "Get comprehensive information about the loaded genome",
                        inputSchema: {
                            type: "object",
                            properties: {
                                clientId: { type: "string", description: "Browser client ID" }
                            }
                        }
                    },
                    {
                        name: "search_gene_by_name",
                        description: "Search for a specific gene by name or locus tag",
                        inputSchema: {
                            type: "object",
                            properties: {
                                name: { type: "string", description: "Gene name or locus tag" },
                                clientId: { type: "string", description: "Browser client ID" }
                            },
                            required: ["name"]
                        }
                    },
                    {
                        name: "compute_gc",
                        description: "Calculate GC content percentage for a DNA sequence",
                        inputSchema: {
                            type: "object",
                            properties: {
                                sequence: { type: "string", description: "DNA sequence" },
                                clientId: { type: "string", description: "Browser client ID" }
                            },
                            required: ["sequence"]
                        }
                    },
                    {
                        name: "translate_dna",
                        description: "Translate DNA sequence to protein (amino acid sequence)",
                        inputSchema: {
                            type: "object",
                            properties: {
                                dna: { type: "string", description: "DNA sequence to translate" },
                                frame: { type: "number", description: "Reading frame (0, 1, or 2)", default: 0 },
                                clientId: { type: "string", description: "Browser client ID" }
                            },
                            required: ["dna"]
                        }
                    },
                    {
                        name: "reverse_complement",
                        description: "Get reverse complement of DNA sequence",
                        inputSchema: {
                            type: "object",
                            properties: {
                                dna: { type: "string", description: "DNA sequence" },
                                clientId: { type: "string", description: "Browser client ID" }
                            },
                            required: ["dna"]
                        }
                    },
                    {
                        name: "find_orfs",
                        description: "Find Open Reading Frames (ORFs) in DNA sequence",
                        inputSchema: {
                            type: "object",
                            properties: {
                                dna: { type: "string", description: "DNA sequence" },
                                minLength: { type: "number", description: "Minimum ORF length in codons", default: 30 },
                                clientId: { type: "string", description: "Browser client ID" }
                            },
                            required: ["dna"]
                        }
                    },
                    {
                        name: "search_sequence_motif",
                        description: "Search for sequence motifs in the genome",
                        inputSchema: {
                            type: "object",
                            properties: {
                                pattern: { type: "string", description: "Sequence motif pattern" },
                                chromosome: { type: "string", description: "Chromosome to search (optional)" },
                                clientId: { type: "string", description: "Browser client ID" }
                            },
                            required: ["pattern"]
                        }
                    },
                    {
                        name: "predict_promoter",
                        description: "Predict promoter regions in DNA sequence",
                        inputSchema: {
                            type: "object",
                            properties: {
                                seq: { type: "string", description: "DNA sequence to analyze" },
                                motif: { type: "string", description: "Promoter motif pattern (optional)" },
                                clientId: { type: "string", description: "Browser client ID" }
                            },
                            required: ["seq"]
                        }
                    },
                    {
                        name: "blast_search",
                        description: "Perform BLAST sequence similarity search",
                        inputSchema: {
                            type: "object",
                            properties: {
                                sequence: { type: "string", description: "Query sequence" },
                                blastType: { type: "string", description: "BLAST type (blastn, blastp, blastx, tblastn, tblastx)" },
                                database: { type: "string", description: "Target database" },
                                evalue: { type: "string", description: "E-value threshold", default: "0.01" },
                                maxTargets: { type: "number", description: "Maximum number of targets", default: 50 },
                                clientId: { type: "string", description: "Browser client ID" }
                            },
                            required: ["sequence", "blastType", "database"]
                        }
                    },
                    // Protein structure tools
                    {
                        name: "fetch_protein_structure",
                        description: "Fetch protein 3D structure from PDB database by gene name or PDB ID",
                        inputSchema: {
                            type: "object",
                            properties: {
                                geneName: { type: "string", description: "Gene name to search for protein structure" },
                                pdbId: { type: "string", description: "Direct PDB ID (alternative to gene name)" },
                                organism: { type: "string", description: "Organism name for more specific search" },
                                clientId: { type: "string", description: "Browser client ID" }
                            }
                        }
                    },
                    {
                        name: "open_protein_viewer",
                        description: "Open 3D protein structure viewer in a separate window",
                        inputSchema: {
                            type: "object",
                            properties: {
                                pdbData: { type: "string", description: "PDB structure data" },
                                proteinName: { type: "string", description: "Protein name for display" },
                                pdbId: { type: "string", description: "PDB ID" },
                                clientId: { type: "string", description: "Browser client ID" }
                            },
                            required: ["pdbData", "proteinName"]
                        }
                    },
                    {
                        name: "search_pdb_structures",
                        description: "Search PDB database for experimental protein structures by gene name",
                        inputSchema: {
                            type: "object",
                            properties: {
                                geneName: { type: "string", description: "Gene name to search for experimental structures" },
                                organism: { type: "string", description: "Organism name (optional)" },
                                maxResults: { type: "number", description: "Maximum number of results to return" },
                                clientId: { type: "string", description: "Browser client ID" }
                            },
                            required: ["geneName"]
                        }
                    },
                    // AlphaFold tools
                    {
                        name: "search_alphafold_by_gene",
                        description: "Search AlphaFold database for protein structures by gene name",
                        inputSchema: {
                            type: "object",
                            properties: {
                                geneName: { type: "string", description: "Gene name to search" },
                                organism: { type: "string", description: "Organism name (default: Homo sapiens)" },
                                maxResults: { type: "number", description: "Maximum number of results to return (default: 10)" },
                                clientId: { type: "string", description: "Browser client ID" }
                            },
                            required: ["geneName"]
                        }
                    },
                    {
                        name: "fetch_alphafold_structure",
                        description: "Fetch AlphaFold protein structure by UniProt ID",
                        inputSchema: {
                            type: "object",
                            properties: {
                                uniprotId: { type: "string", description: "UniProt ID (e.g., P53_HUMAN)" },
                                geneName: { type: "string", description: "Gene name for display purposes" },
                                format: { type: "string", description: "Structure format (pdb or cif)", default: "pdb" },
                                clientId: { type: "string", description: "Browser client ID" }
                            },
                            required: ["uniprotId"]
                        }
                    },
                    {
                        name: "search_alphafold_by_sequence",
                        description: "Search AlphaFold database by protein sequence using UniProt BLAST",
                        inputSchema: {
                            type: "object",
                            properties: {
                                sequence: { type: "string", description: "Protein sequence to search" },
                                evalue: { type: "number", description: "E-value threshold (default: 1e-10)" },
                                maxResults: { type: "number", description: "Maximum number of results to return (default: 10)" },
                                clientId: { type: "string", description: "Browser client ID" }
                            },
                            required: ["sequence"]
                        }
                    },
                    {
                        name: "open_alphafold_viewer",
                        description: "Open AlphaFold 3D structure viewer with enhanced features",
                        inputSchema: {
                            type: "object",
                            properties: {
                                structureData: { type: "string", description: "PDB/CIF structure data" },
                                uniprotId: { type: "string", description: "UniProt ID" },
                                geneName: { type: "string", description: "Gene name for display" },
                                confidenceData: { type: "string", description: "AlphaFold confidence scores (PAE data)" },
                                organism: { type: "string", description: "Source organism" },
                                clientId: { type: "string", description: "Browser client ID" }
                            },
                            required: ["structureData", "uniprotId"]
                        }
                    },
                    // UniProt database tools
                    {
                        name: "search_uniprot_database",
                        description: "Search UniProt database with various search types and filters",
                        inputSchema: {
                            type: "object",
                            properties: {
                                query: { type: "string", description: "Search query term" },
                                searchType: { 
                                    type: "string", 
                                    description: "Type of search: protein_name, gene_name, uniprot_id, organism, keyword, annotation, or sequence",
                                    enum: ["protein_name", "gene_name", "uniprot_id", "organism", "keyword", "annotation", "sequence"]
                                },
                                organism: { type: "string", description: "Organism filter (taxon ID or scientific name)" },
                                reviewedOnly: { type: "boolean", description: "Only return reviewed (SwissProt) entries" },
                                minLength: { type: "number", description: "Minimum protein sequence length" },
                                maxLength: { type: "number", description: "Maximum protein sequence length" },
                                limit: { type: "number", description: "Maximum number of results to return", default: 50 },
                                includeSequence: { type: "boolean", description: "Include protein sequences in results", default: true },
                                includeFeatures: { type: "boolean", description: "Include protein features in results", default: true }
                            },
                            required: ["query", "searchType"]
                        }
                    },
                    {
                        name: "advanced_uniprot_search",
                        description: "Advanced UniProt search with multiple query fields",
                        inputSchema: {
                            type: "object",
                            properties: {
                                proteinName: { type: "string", description: "Protein name query" },
                                geneName: { type: "string", description: "Gene name query" },
                                organism: { type: "string", description: "Organism filter" },
                                keywords: { type: "array", items: { type: "string" }, description: "Keyword filters" },
                                subcellularLocation: { type: "string", description: "Subcellular location filter" },
                                function: { type: "string", description: "Protein function filter" },
                                reviewedOnly: { type: "boolean", description: "Only reviewed entries" },
                                limit: { type: "number", description: "Maximum results", default: 25 }
                            }
                        }
                    },
                    {
                        name: "get_uniprot_entry",
                        description: "Get detailed information for a specific UniProt entry",
                        inputSchema: {
                            type: "object",
                            properties: {
                                uniprotId: { type: "string", description: "UniProt accession ID" },
                                includeSequence: { type: "boolean", description: "Include protein sequence", default: true },
                                includeFeatures: { type: "boolean", description: "Include protein features", default: true },
                                includeCrossRefs: { type: "boolean", description: "Include cross-references", default: false }
                            },
                            required: ["uniprotId"]
                        }
                    },
                    // InterPro domain analysis tools
                    {
                        name: "analyze_interpro_domains",
                        description: "Analyze protein domains and features using InterPro database",
                        inputSchema: {
                            type: "object",
                            properties: {
                                sequence: { type: "string", description: "Protein sequence in single-letter amino acid code" },
                                applications: { 
                                    type: "array", 
                                    items: { type: "string" },
                                    description: "InterPro member databases to search (e.g., Pfam, SMART, PROSITE)",
                                    default: ["Pfam", "SMART", "PROSITE", "PANTHER", "PRINTS"]
                                },
                                goterms: { type: "boolean", description: "Include Gene Ontology terms", default: true },
                                pathways: { type: "boolean", description: "Include pathway information", default: true },
                                includeMatchSequence: { type: "boolean", description: "Include matched sequence regions", default: true }
                            },
                            required: ["sequence"]
                        }
                    },
                    {
                        name: "search_interpro_entry",
                        description: "Search InterPro database for specific entries by ID or text",
                        inputSchema: {
                            type: "object",
                            properties: {
                                query: { type: "string", description: "InterPro ID (e.g., IPR000001) or search text" },
                                searchType: { 
                                    type: "string", 
                                    description: "Type of search: entry_id, name, or text",
                                    enum: ["entry_id", "name", "text"],
                                    default: "text"
                                },
                                includeProteins: { type: "boolean", description: "Include associated proteins", default: false },
                                includeStructures: { type: "boolean", description: "Include structure information", default: false },
                                limit: { type: "number", description: "Maximum number of results", default: 50 }
                            },
                            required: ["query"]
                        }
                    },
                    {
                        name: "get_interpro_entry_details",
                        description: "Get detailed information for a specific InterPro entry",
                        inputSchema: {
                            type: "object",
                            properties: {
                                interproId: { type: "string", description: "InterPro entry ID (e.g., IPR000001)" },
                                includeProteins: { type: "boolean", description: "Include associated proteins", default: true },
                                includeStructures: { type: "boolean", description: "Include structure information", default: true },
                                includeTaxonomy: { type: "boolean", description: "Include taxonomic distribution", default: false }
                            },
                            required: ["interproId"]
                        }
                    },
                    // NVIDIA Evo2 tools
                    {
                        name: "evo2_generate_sequence",
                        description: "Generate DNA sequences using NVIDIA Evo2 model",
                        inputSchema: {
                            type: "object",
                            properties: {
                                prompt: { type: "string", description: "Input DNA sequence as starting prompt or empty for de novo generation", default: "" },
                                maxTokens: { type: "number", description: "Maximum length of generated sequence (up to 1048576)", default: 1000 },
                                temperature: { type: "number", description: "Generation temperature (0.0-2.0)", default: 1.0 },
                                topP: { type: "number", description: "Top-p sampling (0.0-1.0)", default: 0.9 },
                                seed: { type: "number", description: "Random seed for reproducible generation" },
                                taxonomy: { type: "string", description: "Target organism taxonomy" },
                                stopSequences: { type: "array", items: { type: "string" }, description: "Stop generation at these sequences", default: [] },
                                stream: { type: "boolean", description: "Stream the response", default: false }
                            }
                        }
                    },
                    {
                        name: "evo2_predict_function",
                        description: "Predict gene function from DNA sequence using Evo2 zero-shot capabilities",
                        inputSchema: {
                            type: "object",
                            properties: {
                                sequence: { type: "string", description: "DNA sequence for function prediction" },
                                taxonomy: { type: "string", description: "Organism taxonomy context" },
                                analysisType: { type: "string", enum: ["function", "essentiality", "regulation"], description: "Type of functional analysis", default: "function" }
                            },
                            required: ["sequence"]
                        }
                    },
                    {
                        name: "evo2_design_crispr",
                        description: "Design CRISPR-Cas molecular complexes using Evo2 multi-element generation",
                        inputSchema: {
                            type: "object",
                            properties: {
                                targetSequence: { type: "string", description: "Target DNA sequence for CRISPR design" },
                                casType: { type: "string", enum: ["Cas9", "Cas12", "Cas13", "Auto"], description: "CRISPR-Cas system type", default: "Auto" },
                                pamSequence: { type: "string", description: "Preferred PAM sequence motif" },
                                guideLength: { type: "number", description: "Guide RNA length (15-25)", default: 20 },
                                organism: { type: "string", description: "Target organism for optimization" }
                            },
                            required: ["targetSequence"]
                        }
                    },
                    {
                        name: "evo2_optimize_sequence",
                        description: "Optimize DNA sequences for specific properties using Evo2",
                        inputSchema: {
                            type: "object",
                            properties: {
                                sequence: { type: "string", description: "Input DNA sequence to optimize" },
                                optimizationGoal: { type: "string", enum: ["expression", "stability", "codingDensity", "gc_content"], description: "Optimization objective" },
                                constraints: { type: "object", description: "Optimization constraints (GC content, codon usage, etc.)" },
                                targetOrganism: { type: "string", description: "Target organism for optimization" },
                                preserveFunction: { type: "boolean", description: "Preserve original function during optimization", default: true }
                            },
                            required: ["sequence", "optimizationGoal"]
                        }
                    },
                    {
                        name: "evo2_analyze_essentiality",
                        description: "Analyze gene essentiality at nucleotide resolution using Evo2",
                        inputSchema: {
                            type: "object",
                            properties: {
                                sequence: { type: "string", description: "DNA sequence for essentiality analysis" },
                                organism: { type: "string", description: "Target organism context" },
                                resolution: { type: "string", enum: ["nucleotide", "codon", "domain"], description: "Analysis resolution", default: "nucleotide" },
                                includeVisualization: { type: "boolean", description: "Include visualization data", default: true }
                            },
                            required: ["sequence"]
                        }
                    },
                    // Additional analysis tools
                    {
                        name: "get_coding_sequence",
                        description: "Get the coding sequence (DNA) for a specific gene or locus tag",
                        inputSchema: {
                            type: "object",
                            properties: {
                                identifier: { type: "string", description: "Gene name or locus tag (e.g., b0062, araA)" },
                                clientId: { type: "string", description: "Browser client ID" }
                            },
                            required: ["identifier"]
                        }
                    },
                    {
                        name: "codon_usage_analysis",
                        description: "Analyze codon usage patterns in a DNA coding sequence",
                        inputSchema: {
                            type: "object",
                            properties: {
                                sequence: { type: "string", description: "DNA coding sequence to analyze" },
                                geneName: { type: "string", description: "Gene name for context (optional)" },
                                organism: { type: "string", description: "Organism name for comparison (optional)", default: "E. coli" },
                                includeStatistics: { type: "boolean", description: "Include detailed statistics", default: true },
                                clientId: { type: "string", description: "Browser client ID" }
                            },
                            required: ["sequence"]
                        }
                    },
                    // Metabolic pathway tools
                    {
                        name: "show_metabolic_pathway",
                        description: "Display metabolic pathway visualization (e.g., glycolysis, TCA cycle, etc.)",
                        inputSchema: {
                            type: "object",
                            properties: {
                                pathwayName: { type: "string", description: "Pathway name (glycolysis, tca_cycle, pentose_phosphate, etc.)" },
                                highlightGenes: { type: "array", description: "List of genes to highlight in the pathway" },
                                organism: { type: "string", description: "Organism name for pathway context" },
                                clientId: { type: "string", description: "Browser client ID" }
                            },
                            required: ["pathwayName"]
                        }
                    },
                    {
                        name: "find_pathway_genes",
                        description: "Find genes associated with a specific metabolic pathway",
                        inputSchema: {
                            type: "object",
                            properties: {
                                pathwayName: { type: "string", description: "Pathway name to search for" },
                                includeRegulation: { type: "boolean", description: "Include regulatory genes", default: false },
                                clientId: { type: "string", description: "Browser client ID" }
                            },
                            required: ["pathwayName"]
                        }
                    }
                ]
            };
        });

        // Handle tool execution
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            
            try {
                console.log(`Executing tool: ${name} with arguments:`, args);
                
                // Handle different tool types
                const result = await this.executeTool(name, args);
                
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result, null, 2)
                        }
                    ]
                };
            } catch (error) {
                console.error(`Error executing tool ${name}:`, error);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error executing tool ${name}: ${error.message}`
                        }
                    ],
                    isError: true
                };
            }
        });
    }

    async executeTool(toolName, parameters) {
        const clientId = parameters.clientId || this.getFirstAvailableClientId();
        
        // Handle server-side tools first
        if (this.isServerSideTool(toolName)) {
            return await this.executeServerSideTool(toolName, parameters);
        }
        
        // For client-side tools, delegate to browser
        return await this.executeClientSideTool(toolName, parameters, clientId);
    }

    isServerSideTool(toolName) {
        const serverSideTools = [
            'fetch_protein_structure',
            'search_pdb_structures',
            'fetch_alphafold_structure',
            'search_alphafold_by_sequence',
            'search_uniprot_database',
            'advanced_uniprot_search',
            'get_uniprot_entry',
            'analyze_interpro_domains',
            'search_interpro_entry',
            'get_interpro_entry_details',
            'evo2_generate_sequence',
            'evo2_predict_function',
            'evo2_design_crispr',
            'evo2_optimize_sequence',
            'evo2_analyze_essentiality',
            'codon_usage_analysis'
        ];
        
        return serverSideTools.includes(toolName);
    }

    async executeServerSideTool(toolName, parameters) {
        // Import and use the original implementation for server-side tools
        const MCPGenomeBrowserServer = require('./mcp-server.js');
        const originalServer = new MCPGenomeBrowserServer();
        
        // Execute the tool using the original implementation
        return await originalServer.executeTool(toolName, parameters, parameters.clientId);
    }

    async executeClientSideTool(toolName, parameters, clientId) {
        const client = this.clients.get(clientId);
        if (!client) {
            throw new Error('No Genome AI Studio clients connected');
        }

        return new Promise((resolve, reject) => {
            const requestId = uuidv4();
            const timeout = setTimeout(() => {
                reject(new Error(`Tool execution timeout: ${toolName}`));
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
                            reject(new Error(data.error || 'Tool execution failed'));
                        }
                    }
                } catch (error) {
                    // Ignore parsing errors for non-response messages
                }
            };

            client.on('message', messageHandler);
            
            // Send tool execution request to browser
            client.send(JSON.stringify({
                type: 'tool-request',
                requestId: requestId,
                toolName: toolName,
                parameters: parameters
            }));
        });
    }

    getFirstAvailableClientId() {
        const clientIds = Array.from(this.clients.keys());
        return clientIds.length > 0 ? clientIds[0] : null;
    }

    async start() {
        try {
            // For stdio transport, we must not output to stdout - only stderr
            process.stderr.write('🧬 Starting Claude MCP Genome Server...\n');
            
            // Connect to stdio transport
            const transport = new StdioServerTransport();
            await this.server.connect(transport);
            
            process.stderr.write('✅ Claude MCP Server started successfully\n');
            process.stderr.write(`📡 WebSocket server running on port ${this.wsPort}\n`);
            process.stderr.write('🔗 Ready for Claude Desktop integration\n');
            
            return {
                success: true,
                message: 'Claude MCP Server started successfully',
                wsPort: this.wsPort
            };
        } catch (error) {
            process.stderr.write(`❌ Failed to start Claude MCP Server: ${error}\n`);
            throw error;
        }
    }

    async stop() {
        try {
            process.stderr.write('🛑 Stopping Claude MCP Server...\n');
            
            // Close WebSocket server
            if (this.wsServer) {
                this.wsServer.close();
            }
            
            // Close all client connections
            for (const client of this.clients.values()) {
                client.close();
            }
            
            this.clients.clear();
            this.browserState.clear();
            
            console.log('✅ Claude MCP Server stopped successfully');
        } catch (error) {
            console.error('❌ Error stopping Claude MCP Server:', error);
            throw error;
        }
    }
}

module.exports = ClaudeMCPGenomeServer;

// If run directly, start the server
if (require.main === module) {
    const server = new ClaudeMCPGenomeServer();
    
    server.start().catch(error => {
        console.error('Failed to start server:', error);
        process.exit(1);
    });
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n🛑 Received SIGINT, shutting down...');
        await server.stop();
        process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
        console.log('\n🛑 Received SIGTERM, shutting down...');
        await server.stop();
        process.exit(0);
    });
} 