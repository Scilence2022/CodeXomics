#!/usr/bin/env node

/**
 * Start MCP Server for Genome AI Studio
 * 
 * This script starts the MCP (Model Context Protocol) server
 * that enables LLM integration with the Genome AI Studio.
 */

const MCPGenomeBrowserServer = require('./src/temp/mcp-server.js');

console.log('🧬 Starting Genome AI Studio MCP Server...');
console.log('');

const server = new MCPGenomeBrowserServer();
server.start();

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down MCP Server...');
    server.stop();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down MCP Server...');
    server.stop();
    process.exit(0);
});

console.log('💡 Usage Instructions:');
console.log('1. Keep this server running');
console.log('2. Launch the Genome AI Studio');
console.log('3. Click the AI Assistant button in the toolbar');
console.log('4. Configure your LLM integration (see documentation)');
console.log('');
console.log('📚 MCP Server Tools (Subset of Available Tools):');
console.log('Navigation & State:');
console.log('- navigate_to_position: Navigate to genomic coordinates');
console.log('- get_current_state: Get browser state information');
console.log('- jump_to_gene: Jump directly to gene location');
console.log('');
console.log('Search & Discovery:');
console.log('- search_features: Search for genes and features');
console.log('- search_gene_by_name: Search for specific gene by name');
console.log('- search_sequence_motif: Search for sequence motifs');
console.log('');
console.log('Sequence Analysis:');
console.log('- get_sequence: Extract DNA sequences');
console.log('- compute_gc: Calculate GC content');
console.log('- translate_dna: Translate DNA to protein');
console.log('- reverse_complement: Get reverse complement');
console.log('- find_orfs: Find Open Reading Frames');
console.log('');
console.log('Advanced Analysis:');
console.log('- analyze_region: Analyze genomic regions');
console.log('- predict_promoter: Predict promoter regions');
console.log('- blast_search: BLAST sequence similarity search');
console.log('');
console.log('Data Management:');
console.log('- get_genome_info: Get genome information');
console.log('- toggle_track: Show/hide visualization tracks');
console.log('- create_annotation: Create custom annotations');
console.log('- export_data: Export sequence/annotation data');
console.log('');
console.log('Protein Structure:');
console.log('- fetch_protein_structure: Download protein 3D structure from PDB');
console.log('- search_pdb_structures: Search protein structures by gene name');
console.log('- open_protein_viewer: Open 3D protein structure viewer');
console.log('');
console.log('ℹ️  Note: Additional tools are available through the ChatManager');
console.log('   including MicrobeGenomicsFunctions and plugin system tools');
console.log('');
console.log('🔗 Endpoints:');
console.log('- WebSocket: ws://localhost:3001 (Browser connection)');
console.log('- HTTP API: http://localhost:3000 (LLM integration)');
console.log('- Health: http://localhost:3000/health');
console.log('- Tools: http://localhost:3000/tools');
console.log(''); 