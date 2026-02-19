#!/usr/bin/env node

/**
 * Start CodeXomics MCP Server
 * 
 * This script starts the CodeXomics MCP (Model Context Protocol) server
 * using the official Claude MCP TypeScript SDK for proper protocol compliance.
 */

const StandardClaudeMCPServer = require('../src/mcp-server-claude-unified.js');

// Use stderr for all output to avoid interfering with JSON-RPC on stdout
process.stderr.write('🧬 Starting CodeXomics MCP Server...\n');
process.stderr.write('📋 Using official Claude MCP TypeScript SDK\n');
process.stderr.write('\n');

const server = new StandardClaudeMCPServer();

// Start the server
server.start().catch(error => {
    process.stderr.write(`❌ Failed to start CodeXomics MCP Server: ${error}\n`);
    process.exit(1);
});

// Graceful shutdown handlers
process.on('SIGINT', async () => {
    process.stderr.write('\n🛑 Shutting down CodeXomics MCP Server...\n');
    await server.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    process.stderr.write('\n🛑 Shutting down CodeXomics MCP Server...\n');
    await server.stop();
    process.exit(0);
});

process.stderr.write('💡 CodeXomics MCP Server Usage Instructions:\n');
process.stderr.write('1. Keep this server running\n');
process.stderr.write('2. Configure your MCP client to connect to this server\n');
process.stderr.write('3. Use stdio transport for MCP Client integration\n');
process.stderr.write('4. Launch the CodeXomics application\n');
process.stderr.write('5. The server will handle communication between the AI and the browser\n');
process.stderr.write('\n');
process.stderr.write('🔧 MCP Client Configuration:\n');
process.stderr.write('Add this to your MCP Client MCP settings:\n');
process.stderr.write('{\n');
process.stderr.write('  "mcpServers": {\n');
process.stderr.write('    "CodeXomics": {\n');
process.stderr.write('      "command": "node",\n');
process.stderr.write('      "args": ["' + __filename + '"],\n');
process.stderr.write('      "env": {}\n');
process.stderr.write('    }\n');
process.stderr.write('  }\n');
process.stderr.write('}\n');
process.stderr.write('\n');
// Output tool information to stderr to avoid interfering with JSON-RPC
const toolInfo = `📚 Available Tools (Full List):

🧭 Navigation & State:
- navigate_to_position: Navigate to genomic coordinates
- get_current_state: Get browser state information
- jump_to_gene: Jump directly to gene location
- get_genome_info: Get comprehensive genome information
- zoom_in: Zoom into the current view
- zoom_out: Zoom out of the current view
- pan_left: Pan view left
- pan_right: Pan view right

🔍 Search & Discovery:
- search_features: Search for genes and features
- search_gene_by_name: Search for specific gene by name
- search_sequence_motif: Search for sequence motifs

🧬 Sequence Analysis:
- get_sequence: Extract DNA sequences
- compute_gc: Calculate GC content
- translate_dna: Translate DNA to protein
- reverse_complement: Get reverse complement
- get_coding_sequence: Get coding sequence for genes
- codon_usage_analysis: Analyze codon usage patterns

🔬 Advanced Analysis:
- analyze_region: Analyze genomic regions
- blast_search: BLAST sequence similarity search

🧪 Protein Structure:
- fetch_protein_structure: Download protein 3D structure from PDB
- search_pdb_structures: Search protein structures by gene name
- open_protein_viewer: Open 3D protein structure viewer
- search_alphafold_by_gene: Search AlphaFold structures by gene
- fetch_alphafold_structure: Fetch AlphaFold structures
- search_alphafold_by_sequence: Search AlphaFold by sequence
- open_alphafold_viewer: Open AlphaFold structure viewer

🗃️ Database Integration:
- search_uniprot_database: Search UniProt database
- advanced_uniprot_search: Advanced UniProt search
- get_uniprot_entry: Get detailed UniProt entry
- analyze_interpro_domains: Analyze protein domains
- search_interpro_entry: Search InterPro database
- get_interpro_entry_details: Get InterPro entry details

📊 Data Management:
- toggle_track: Show/hide visualization tracks
- create_annotation: Create custom annotations
- export_data: Export sequence/annotation data
- show_metabolic_pathway: Display metabolic pathways
- find_pathway_genes: Find pathway-associated genes

🪟 Multi-Window Management:
- list_genome_windows: List all open CodeXomics windows
- switch_active_window: Focus a specific window by ID

🔗 Connection Info:
- Protocol: JSON-RPC 2.0 (Claude MCP Standard)
- Transport: stdio (for MCP Client)
- WebSocket: ws://localhost:3003 (Browser connection)
- HTTP/SSE: http://localhost:3002
- Total Tools: 40+ comprehensive genomics tools

`;

process.stderr.write(toolInfo);