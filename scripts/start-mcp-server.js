#!/usr/bin/env node

/**
 * Start CodeXomics MCP Server
 *
 * This script starts the CodeXomics MCP (Model Context Protocol) server
 * using the official Claude MCP TypeScript SDK for proper protocol compliance.
 *
 * Usage:
 *   node scripts/start-mcp-server.js [--mode=tools|agent]
 *
 * Modes:
 *   tools  - Standard MCP tool server (default). Each tools/call maps to a specific tool.
 *   agent  - Agent mode. Prompts are routed through CodeXomics's AI agent (ChatManager),
 *            which autonomously decides which tools to call. Progress notifications
 *            are sent back to the MCP client.
 */

const StandardMCPServer = require('../src/mcp-server.js');
const { getMcpAuthConfig } = require('../src/main/mcp-auth-config.js');

// Parse --mode argument
const modeArg = process.argv.find(arg => arg.startsWith('--mode='));
if (modeArg) {
  const mode = modeArg.split('=')[1];
  if (['tools', 'agent'].includes(mode)) {
    process.env.CODEXOMICS_MCP_MODE = mode;
  } else {
    process.stderr.write(`⚠️  Invalid mode '${mode}'. Use 'tools' or 'agent'. Defaulting to 'tools'.\n`);
  }
}

const currentMode = process.env.CODEXOMICS_MCP_MODE || 'tools';

// Use stderr for all output to avoid interfering with JSON-RPC on stdout
process.stderr.write('🧬 Starting CodeXomics MCP Server...\n');
process.stderr.write(
  `📋 Mode: ${currentMode}${currentMode === 'agent' ? ' (AI agent will handle prompts autonomously)' : ' (direct tool execution)'}\n`
);
process.stderr.write('📋 Using official Claude MCP TypeScript SDK\n');
process.stderr.write('\n');

let server;
try {
  server = new StandardMCPServer(3002, 3003, null, getMcpAuthConfig());
} catch (error) {
  process.stderr.write(`❌ Failed to configure CodeXomics MCP Server: ${error.message}\n`);
  process.exit(1);
}

// Start the server
server.start().catch(error => {
  process.stderr.write(`❌ Failed to start CodeXomics MCP Server: ${error}\n`);
  process.exit(1);
});

let shutdownPromise = null;
const shutdown = signal => {
  if (shutdownPromise) return shutdownPromise;
  process.stderr.write(`\n🛑 Received ${signal}; shutting down CodeXomics MCP Server...\n`);
  shutdownPromise = server
    .stop()
    .then(() => {
      process.exitCode = 0;
    })
    .catch(error => {
      process.stderr.write(`❌ Failed to stop CodeXomics MCP Server: ${error.message}\n`);
      process.exitCode = 1;
    });
  return shutdownPromise;
};
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

process.stderr.write('💡 CodeXomics MCP Server Usage Instructions:\n');
process.stderr.write('1. Keep this server running\n');
process.stderr.write('2. Configure an admin or scoped API key in the server environment\n');
process.stderr.write('3. Connect your MCP client to http://127.0.0.1:3002/mcp\n');
process.stderr.write('4. Send the key as Authorization: Bearer <key>\n');
process.stderr.write('5. Launch CodeXomics for tools that require the renderer\n');
process.stderr.write('\n');
process.stderr.write('🔧 MCP Client Configuration:\n');
process.stderr.write('Use the equivalent URL/header settings supported by your MCP client:\n');
process.stderr.write('{\n');
process.stderr.write('  "url": "http://127.0.0.1:3002/mcp",\n');
process.stderr.write('  "headers": { "Authorization": "Bearer <configured-key>" }\n');
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
- find_gene_by_name: Search for specific gene by name
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
- search_alphafold_structures: Search AlphaFold structures by gene
- fetch_alphafold_structure: Fetch AlphaFold structures
- search_alphafold_by_sequence: Search AlphaFold by sequence

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
- Transport: authenticated HTTP POST http://127.0.0.1:3002/mcp
- Legacy SSE (authenticated): http://127.0.0.1:3002/sse
- WebSocket compatibility endpoint: ws://127.0.0.1:3003
- Total Tools: 40+ comprehensive genomics tools

`;

process.stderr.write(toolInfo);
