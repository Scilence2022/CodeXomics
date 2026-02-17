# CodeXomics MCP Server - Cherry Studio Quick Start

## Setup Instructions

### 1. Start CodeXomics with MCP Server

```bash
# Option 1: Start MCP server and app together
npm run start-with-mcp

# Option 2: Start MCP server separately
npm run mcp-server

# Then start the app in another terminal
npm start
```

### 2. Configure Cherry Studio

Add this MCP server configuration to Cherry Studio:

```json
{
  "name": "CodeXomics",
  "type": "sse",
  "url": "http://localhost:3002/sse",
  "description": "Bioinformatics analysis platform"
}
```

Or use WebSocket transport:

```json
{
  "name": "CodeXomics",
  "type": "websocket",
  "url": "ws://localhost:3003",
  "description": "Bioinformatics analysis platform"
}
```

### 3. Verify Connection

Ask the AI to run:
```
Please check the CodeXomics server status using the ping tool.
```

## Quick Command Reference

### Load Data
- "Load the E. coli genome from `/path/to/ecoli.fasta`"
- "Load gene annotations from `/path/to/ecoli.gff`"
- "Load sequencing reads from `/path/to/reads.bam`"

### Navigate
- "Go to gene lacZ"
- "Navigate to chromosome 1, position 10000-20000"
- "Zoom in 2x on the current region"

### Analyze
- "Get the coding sequence for gene rpoB"
- "Calculate GC content of the current view"
- "Search for restriction site EcoRI (GAATTC)"

### Visualize
- "Show the genes track in compact mode"
- "Enable coverage visualization for reads"
- "Color variants by impact severity"

### Export
- "Export the current sequence as FASTA"
- "Export all CDS sequences to a file"

## Common Workflows

### Gene Analysis
```
"Find the dnaA gene, show its details, get its coding sequence, 
and check if it has a known protein structure"
```

### Track Configuration
```
"Configure the genes track: set layout to compact, gene height to 20px, 
and enable circular mode"
```

### Comparative Analysis
```
"Navigate to position 50000-60000, extract the sequence, 
translate it to protein, and analyze its domains"
```

## Tips for Best Results

1. **Be specific with file paths** - Always provide absolute paths
2. **Use gene names consistently** - Check exact names with search first
3. **Configure tracks before analysis** - Proper visualization helps interpretation
4. **Save important sequences** - Export results for downstream analysis
5. **Use batch operations** - Update multiple tracks at once when possible

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Server not found" | Make sure CodeXomics is running and MCP server is started |
| "Tool execution failed" | Check if required files are loaded (genome, annotations) |
| "Gene not found" | Use `search_gene_by_name` with partial matches |
| "Track not visible" | Use `toggle_track` to enable the track first |
| "Settings not applied" | Use `get_track_settings` to verify current configuration |

## Example Prompts

### For Gene Research
```
I want to study the lac operon in E. coli. Please:
1. Find all genes in the lac operon
2. Navigate to that region
3. Get the coding sequences for each gene
4. Analyze their protein domains
5. Check if there are any variants in this region
```

### For Sequencing Analysis
```
I have BAM files loaded. Please:
1. Configure the reads track to show coverage
2. Navigate to a region of interest
3. Adjust the sampling settings for better performance
4. Export the consensus sequence
```

### For Visualization
```
I need to prepare a figure showing:
1. Gene annotations in compact mode
2. GC content track
3. Variant positions colored by impact
4. Highlight a specific gene
Please configure the tracks accordingly and navigate to the region.
```

## Advanced Features

### Batch Track Configuration
```
Apply these settings to all tracks:
- Genes: compact layout, 20px height
- Reads: show coverage, 60px coverage height
- Variants: color by impact, show labels
```

### Protein Structure Analysis
```
For gene dnaA:
1. Get its protein sequence
2. Search AlphaFold database
3. Download the structure
4. Open in 3D viewer
5. Analyze functional domains
```

### Codon Usage Analysis
```
Analyze codon usage for:
1. A specific gene
2. All genes in the genome
3. Compare with reference tables
```

---

**Need more help?** Use the `list_available_tools` command to see all capabilities, or check the full documentation in `MCP_SERVER_PROMPT.md`.
