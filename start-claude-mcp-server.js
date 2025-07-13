#!/usr/bin/env node

/**
 * Start Claude MCP Server for Genome AI Studio
 * 
 * This script starts the Claude MCP (Model Context Protocol) server
 * using the official Claude MCP TypeScript SDK for proper protocol compliance.
 */

const ClaudeMCPGenomeServer = require('./src/mcp-server-claude.js');

console.log('🧬 Starting Genome AI Studio Claude MCP Server...');
console.log('📋 Using official Claude MCP TypeScript SDK');
console.log('');

const server = new ClaudeMCPGenomeServer();

// Start the server
server.start().catch(error => {
    console.error('❌ Failed to start Claude MCP Server:', error);
    process.exit(1);
});

// Graceful shutdown handlers
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down Claude MCP Server...');
    await server.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down Claude MCP Server...');
    await server.stop();
    process.exit(0);
});

console.log('💡 Claude MCP Server Usage Instructions:');
console.log('1. Keep this server running');
console.log('2. Configure Claude Desktop to connect to this server');
console.log('3. Use stdio transport for Claude Desktop integration');
console.log('4. Launch the Genome AI Studio application');
console.log('5. The server will handle communication between Claude and the browser');
console.log('');
console.log('🔧 Claude Desktop Configuration:');
console.log('Add this to your Claude Desktop MCP settings:');
console.log('{');
console.log('  "mcpServers": {');
console.log('    "genome-ai-studio": {');
console.log('      "command": "node",');
console.log('      "args": ["' + __filename + '"],');
console.log('      "env": {}');
console.log('    }');
console.log('  }');
console.log('}');
console.log('');
console.log('📚 Available Tools (Full List):');
console.log('');
console.log('🧭 Navigation & State:');
console.log('- navigate_to_position: Navigate to genomic coordinates');
console.log('- get_current_state: Get browser state information');
console.log('- jump_to_gene: Jump directly to gene location');
console.log('- get_genome_info: Get comprehensive genome information');
console.log('');
console.log('🔍 Search & Discovery:');
console.log('- search_features: Search for genes and features');
console.log('- search_gene_by_name: Search for specific gene by name');
console.log('- search_sequence_motif: Search for sequence motifs');
console.log('');
console.log('🧬 Sequence Analysis:');
console.log('- get_sequence: Extract DNA sequences');
console.log('- compute_gc: Calculate GC content');
console.log('- translate_dna: Translate DNA to protein');
console.log('- reverse_complement: Get reverse complement');
console.log('- find_orfs: Find Open Reading Frames');
console.log('- get_coding_sequence: Get coding sequence for genes');
console.log('- codon_usage_analysis: Analyze codon usage patterns');
console.log('');
console.log('🔬 Advanced Analysis:');
console.log('- analyze_region: Analyze genomic regions');
console.log('- predict_promoter: Predict promoter regions');
console.log('- blast_search: BLAST sequence similarity search');
console.log('');
console.log('🧪 Protein Structure:');
console.log('- fetch_protein_structure: Download protein 3D structure from PDB');
console.log('- search_protein_by_gene: Search protein structures by gene name');
console.log('- open_protein_viewer: Open 3D protein structure viewer');
console.log('- search_alphafold_by_gene: Search AlphaFold structures by gene');
console.log('- fetch_alphafold_structure: Fetch AlphaFold structures');
console.log('- search_alphafold_by_sequence: Search AlphaFold by sequence');
console.log('- open_alphafold_viewer: Open AlphaFold structure viewer');
console.log('');
console.log('🗃️ Database Integration:');
console.log('- search_uniprot_database: Search UniProt database');
console.log('- advanced_uniprot_search: Advanced UniProt search');
console.log('- get_uniprot_entry: Get detailed UniProt entry');
console.log('- analyze_interpro_domains: Analyze protein domains');
console.log('- search_interpro_entry: Search InterPro database');
console.log('- get_interpro_entry_details: Get InterPro entry details');
console.log('');
console.log('🤖 AI-Powered Tools (NVIDIA Evo2):');
console.log('- evo2_generate_sequence: Generate DNA sequences');
console.log('- evo2_predict_function: Predict gene function');
console.log('- evo2_design_crispr: Design CRISPR systems');
console.log('- evo2_optimize_sequence: Optimize DNA sequences');
console.log('- evo2_analyze_essentiality: Analyze gene essentiality');
console.log('');
console.log('📊 Data Management:');
console.log('- toggle_track: Show/hide visualization tracks');
console.log('- create_annotation: Create custom annotations');
console.log('- export_data: Export sequence/annotation data');
console.log('- show_metabolic_pathway: Display metabolic pathways');
console.log('- find_pathway_genes: Find pathway-associated genes');
console.log('');
console.log('🔗 Connection Info:');
console.log('- Protocol: JSON-RPC 2.0 (Claude MCP Standard)');
console.log('- Transport: stdio (for Claude Desktop)');
console.log('- WebSocket: ws://localhost:3001 (Browser connection)');
console.log('- Total Tools: 40+ comprehensive genomics tools');
console.log(''); 