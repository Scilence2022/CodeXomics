# Claude Desktop Integration Setup Instructions

## 🎯 Quick Fix for Configuration Issues

If you're getting "Unexpected token" or "not valid JSON" errors in Claude Desktop, follow these steps:

### Step 1: Run the Automatic Fixer
```bash
node fix-claude-desktop-config.js
```

This script will:
- ✅ Backup your existing configuration
- ✅ Create a clean, valid JSON configuration
- ✅ Validate the configuration format
- ✅ Show you the final configuration

### Step 2: Restart Claude Desktop
**Important:** Completely quit and restart Claude Desktop after configuration changes.

### Step 3: Start the MCP Server
```bash
node start-claude-mcp-server.js
```

The server will:
- 🔍 Automatically find an available port (starting from 3001)
- 📡 Start both stdio (for Claude Desktop) and WebSocket (for browser) transports
- 🛠️ Register all 40+ genomics tools
- 📋 Display connection information

## 🔧 Manual Configuration (if needed)

If the automatic fixer doesn't work, manually edit your Claude Desktop configuration:

**Location:** `~/Library/Application Support/Claude/claude_desktop_config.json`

**Content:**
```json
{
  "mcpServers": {
    "genome-ai-studio": {
      "command": "node",
      "args": ["/Users/song/Github-Repos/GenomeExplorer/start-claude-mcp-server.js"],
      "env": {}
    }
  }
}
```

## 🔍 Troubleshooting

### Problem: "Unexpected token" Error ✅ FIXED
**Cause:** Console output interfering with JSON-RPC protocol
**Solution:** 
1. The server now properly separates JSON-RPC messages (stdout) from informational messages (stderr)
2. Run `node fix-claude-desktop-config.js` to ensure clean configuration
3. Restart Claude Desktop

### Problem: "Address already in use" Error ✅ FIXED
**Cause:** Port 3001 is occupied
**Solution:** The server now automatically finds available ports (3001, 3002, 3003, etc.)

### Problem: MCP Server Not Appearing in Claude Desktop
**Solutions:**
1. Ensure the server is running: `node start-claude-mcp-server.js`
2. Check the configuration path is correct
3. Restart Claude Desktop completely
4. Check Claude Desktop's MCP server status

### Problem: "not valid JSON" Errors ✅ FIXED
**Cause:** Server output mixing with JSON-RPC protocol
**Solution:** Server now uses stderr for all informational output, stdout only for JSON-RPC

## 🧪 Testing the Integration

### Test 1: Check Server Status
```bash
node validate-claude-config.js
```

### Test 2: Run Integration Tests
```bash
open test/integration-tests/test-claude-mcp-integration.html
```

### Test 3: Verify in Claude Desktop
1. Start the MCP server
2. Open Claude Desktop
3. Look for "genome-ai-studio" in the MCP servers list
4. Try asking Claude to use genomics tools

## 📋 Available Tools

Once connected, Claude Desktop will have access to 40+ genomics tools:

### 🧭 Navigation & State (4 tools)
- navigate_to_position, get_current_state, jump_to_gene, get_genome_info

### 🔍 Search & Discovery (3 tools)
- search_features, search_gene_by_name, search_sequence_motif

### 🧬 Sequence Analysis (7 tools)
- get_sequence, compute_gc, translate_dna, reverse_complement, find_orfs, get_coding_sequence, codon_usage_analysis

### 🔬 Advanced Analysis (3 tools)
- analyze_region, predict_promoter, blast_search

### 🧪 Protein Structure (7 tools)
- fetch_protein_structure, search_protein_by_gene, open_protein_viewer, search_alphafold_by_gene, fetch_alphafold_structure, search_alphafold_by_sequence, open_alphafold_viewer

### 🗃️ Database Integration (6 tools)
- search_uniprot_database, advanced_uniprot_search, get_uniprot_entry, analyze_interpro_domains, search_interpro_entry, get_interpro_entry_details

### 🤖 AI-Powered Tools (5 tools)
- evo2_generate_sequence, evo2_predict_function, evo2_design_crispr, evo2_optimize_sequence, evo2_analyze_essentiality

### 📊 Data Management (5 tools)
- toggle_track, create_annotation, export_data, show_metabolic_pathway, find_pathway_genes

## 🚀 Usage Examples

Once set up, you can ask Claude Desktop:

```
"Navigate to position 1000-2000 on chromosome 1"
"Search for genes containing 'insulin'"
"Translate this DNA sequence: ATGCGATCG"
"Find protein structure for gene TP53"
"Analyze GC content of this sequence"
"Design CRISPR system for gene editing"
```

## 📞 Support

If you encounter issues:
1. Check the server logs for error messages
2. Verify the configuration with `node validate-claude-config.js`
3. Restart both the MCP server and Claude Desktop
4. Check that all required Node.js dependencies are installed

## 🔄 Updates

To update the MCP server:
1. Pull latest changes from git
2. Run `npm install` to update dependencies
3. Restart the MCP server
4. Configuration should remain unchanged 