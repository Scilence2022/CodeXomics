# Claude MCP Usage Guide

## Quick Start

GenomeExplorer now supports Claude MCP (Model Context Protocol) for seamless integration with Claude Desktop and other MCP-compliant clients.

### Prerequisites

- Node.js installed
- GenomeExplorer project setup
- Claude Desktop (for Claude integration)

### Installation

1. **Install Dependencies**
   ```bash
   cd GenomeExplorer
   npm install
   ```

2. **Start Claude MCP Server**
   ```bash
   npm run claude-mcp-server
   ```

3. **Start Application (Optional)**
   ```bash
   npm run start-with-claude-mcp
   ```

## Claude Desktop Integration

### Configuration

Add to your Claude Desktop MCP settings (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "genome-ai-studio": {
      "command": "node",
      "args": ["/path/to/GenomeExplorer/start-claude-mcp-server.js"],
      "env": {}
    }
  }
}
```

### Usage in Claude Desktop

Once configured, you can use natural language to interact with GenomeExplorer:

**Navigation Examples:**
- "Navigate to chromosome 1 position 1000 to 2000"
- "Jump to the lacZ gene"
- "Show me the current genome state"

**Sequence Analysis:**
- "Calculate GC content of sequence ATGCGCTATCG"
- "Translate DNA sequence ATGAAATAG to protein"
- "Find ORFs in sequence ATGAAATAG"

**Protein Structure:**
- "Search for p53 protein structure"
- "Fetch AlphaFold structure for TP53 gene"
- "Open protein viewer for PDB ID 1TUP"

**Database Queries:**
- "Search UniProt for p53 proteins"
- "Analyze protein domains in sequence MKELLKAGWKELQP..."
- "Get InterPro entry details for IPR000001"

**AI-Powered Analysis:**
- "Generate DNA sequence starting with ATGAAA"
- "Predict function of sequence ATGAAATAG"
- "Design CRISPR guide for target sequence"

## Available Tools

### 🧭 Navigation & State
- `navigate_to_position` - Navigate to genomic coordinates
- `get_current_state` - Get current browser state
- `jump_to_gene` - Jump to gene location
- `get_genome_info` - Get genome information

### 🔍 Search & Discovery
- `search_features` - Search for genomic features
- `search_gene_by_name` - Search specific genes
- `search_sequence_motif` - Find sequence motifs

### 🧬 Sequence Analysis
- `get_sequence` - Extract DNA sequences
- `compute_gc` - Calculate GC content
- `translate_dna` - DNA to protein translation
- `reverse_complement` - Get reverse complement
- `find_orfs` - Find Open Reading Frames
- `get_coding_sequence` - Get gene coding sequences
- `codon_usage_analysis` - Analyze codon usage

### 🧪 Protein Structure
- `fetch_protein_structure` - Get PDB structures
- `search_protein_by_gene` - Search protein structures
- `open_protein_viewer` - Open 3D viewer
- `search_alphafold_by_gene` - Search AlphaFold database
- `fetch_alphafold_structure` - Get AlphaFold structures
- `search_alphafold_by_sequence` - Sequence-based AlphaFold search
- `open_alphafold_viewer` - Open AlphaFold viewer

### 🗃️ Database Integration
- `search_uniprot_database` - Search UniProt
- `advanced_uniprot_search` - Advanced UniProt queries
- `get_uniprot_entry` - Get UniProt entry details
- `analyze_interpro_domains` - Analyze protein domains
- `search_interpro_entry` - Search InterPro database
- `get_interpro_entry_details` - Get InterPro details

### 🤖 AI-Powered Tools
- `evo2_generate_sequence` - Generate DNA sequences
- `evo2_predict_function` - Predict gene function
- `evo2_design_crispr` - Design CRISPR systems
- `evo2_optimize_sequence` - Optimize sequences
- `evo2_analyze_essentiality` - Analyze gene essentiality

### 🔬 Advanced Analysis
- `blast_search` - BLAST sequence similarity
- `analyze_region` - Analyze genomic regions
- `predict_promoter` - Predict promoter regions

### 📊 Data Management
- `toggle_track` - Show/hide tracks
- `create_annotation` - Create annotations
- `export_data` - Export data
- `show_metabolic_pathway` - Display pathways
- `find_pathway_genes` - Find pathway genes

## Testing

### Integration Test Suite

Open the test suite to verify functionality:

```bash
open test/integration-tests/test-claude-mcp-integration.html
```

### Test Categories

1. **Connection Tests** - Verify server connectivity
2. **Protocol Tests** - Validate MCP compliance
3. **Tool Tests** - Test all 40+ tools
4. **Performance Tests** - Benchmark execution times
5. **Batch Tests** - Run multiple tests simultaneously

### Running Tests

- **Individual Tests**: Click any test button
- **Core Tests**: Test essential functionality
- **Server-Side Tests**: Test database and AI tools
- **All Tests**: Comprehensive testing suite

## Troubleshooting

### Common Issues

**Server Not Starting**
```bash
# Check if port is available
lsof -i :3001

# Kill existing process
pkill -f "claude-mcp-server"

# Restart server
npm run claude-mcp-server
```

**Claude Desktop Not Connecting**
1. Verify configuration path is correct
2. Check server is running
3. Restart Claude Desktop
4. Check logs for errors

**Tool Execution Fails**
1. Verify tool name spelling
2. Check parameter requirements
3. Review error messages
4. Test with integration suite

### Debug Mode

Enable debug logging:

```javascript
// In start-claude-mcp-server.js
const server = new ClaudeMCPGenomeServer();
server.debug = true;
server.start();
```

### Log Files

Server logs are displayed in console:
- Connection events
- Tool execution details
- Error messages
- Performance metrics

## Advanced Usage

### Custom Tool Development

Add new tools to the server:

```javascript
// In src/mcp-server-claude.js
{
    name: "custom_tool",
    description: "Custom genomics analysis tool",
    inputSchema: {
        type: "object",
        properties: {
            parameter: { type: "string" }
        },
        required: ["parameter"]
    }
}
```

### Batch Operations

Execute multiple tools in sequence:

```javascript
// Example batch analysis
const results = await Promise.all([
    executeTool('get_sequence', { chromosome: 'chr1', start: 1000, end: 2000 }),
    executeTool('compute_gc', { sequence: 'ATGCGC...' }),
    executeTool('find_orfs', { dna: 'ATGCGC...' })
]);
```

### Performance Optimization

1. **Use Appropriate Tools**: Choose client-side tools for speed
2. **Batch Related Operations**: Group similar requests
3. **Cache Results**: Store frequently accessed data
4. **Monitor Resources**: Track memory and CPU usage

## Best Practices

### Tool Selection

- **Navigation**: Use for genome browsing
- **Sequence Analysis**: For basic DNA/protein operations
- **Database Tools**: For comprehensive searches
- **AI Tools**: For advanced predictions and generation

### Error Handling

Always check tool responses:

```javascript
try {
    const result = await executeTool('tool_name', parameters);
    if (result.success) {
        // Process result
    } else {
        // Handle error
    }
} catch (error) {
    console.error('Tool execution failed:', error);
}
```

### Resource Management

- Close unused connections
- Clear large result sets
- Monitor memory usage
- Use appropriate timeouts

## Examples

### Basic Workflow

```javascript
// 1. Navigate to region
await executeTool('navigate_to_position', {
    chromosome: 'chr1',
    start: 1000,
    end: 2000
});

// 2. Get sequence
const sequence = await executeTool('get_sequence', {
    chromosome: 'chr1',
    start: 1000,
    end: 2000
});

// 3. Analyze GC content
const gcContent = await executeTool('compute_gc', {
    sequence: sequence.result
});

// 4. Find ORFs
const orfs = await executeTool('find_orfs', {
    dna: sequence.result,
    minLength: 30
});
```

### Protein Analysis

```javascript
// 1. Search protein structure
const structure = await executeTool('fetch_protein_structure', {
    geneName: 'p53',
    organism: 'Homo sapiens'
});

// 2. Analyze domains
const domains = await executeTool('analyze_interpro_domains', {
    sequence: 'MKELLKAGWKELQP...'
});

// 3. Search database
const uniprotData = await executeTool('search_uniprot_database', {
    query: 'p53',
    searchType: 'gene_name',
    limit: 5
});
```

### AI-Powered Analysis

```javascript
// 1. Generate sequence
const generated = await executeTool('evo2_generate_sequence', {
    prompt: 'ATGAAA',
    maxTokens: 100
});

// 2. Predict function
const function_prediction = await executeTool('evo2_predict_function', {
    sequence: generated.result
});

// 3. Design CRISPR
const crispr = await executeTool('evo2_design_crispr', {
    targetSequence: generated.result,
    casType: 'Cas9'
});
```

## Support

For issues and questions:

1. Check the troubleshooting section
2. Review the integration test results
3. Examine server logs
4. Check Claude Desktop configuration
5. Verify tool parameters and usage

## Updates

The Claude MCP integration is actively maintained. Check for updates:

```bash
npm update @modelcontextprotocol/sdk
```

Regular updates include:
- New tool additions
- Performance improvements
- Bug fixes
- Protocol enhancements 