# MCP Tools - Organized Architecture

This directory contains the organized architecture for the Claude MCP Server tools, providing a modular and maintainable approach to genomics tool integration.

## Architecture Overview

The new architecture eliminates the complex chain of legacy dependencies and provides direct integration with Claude Desktop:

```
Claude Desktop → Claude MCP Server → Genome AI Studio
```

### Previous Architecture (Complex)
```
Claude Desktop → Claude MCP Server → Legacy MCP Server → Genome AI Studio
```

## Directory Structure

```
src/mcp-tools/
├── navigation/          # Navigation & State Management Tools
├── sequence/           # Sequence Analysis Tools  
├── protein/            # Protein Structure Tools
├── database/           # Database Integration Tools
├── evo2/              # AI-Powered Analysis Tools (NVIDIA EVO2)
├── data/              # Data Management Tools
├── pathway/           # Pathway Analysis & BLAST Tools
├── ToolsIntegrator.js # Main tools coordinator
└── README.md          # This documentation
```

## Tool Categories

### 1. Navigation & State Management (7 tools)
**Location:** `navigation/NavigationTools.js`

Tools for genome browser navigation and state management:
- `navigate_to_position` - Navigate to genomic position
- `search_features` - Search genomic features
- `get_current_state` - Get browser state
- `jump_to_gene` - Jump to gene by name
- `get_genome_info` - Get genome information
- `search_gene_by_name` - Search specific gene
- `toggle_track` - Show/hide tracks

### 2. Sequence Analysis (8 tools)
**Location:** `sequence/SequenceTools.js`

Tools for DNA/RNA sequence analysis and manipulation:
- `get_sequence` - Get DNA sequence for region
- `compute_gc` - Calculate GC content
- `translate_dna` - Translate DNA to protein
- `reverse_complement` - Get reverse complement
- `find_orfs` - Find Open Reading Frames
- `search_sequence_motif` - Search sequence motifs
- `predict_promoter` - Predict promoter regions
- `get_coding_sequence` - Get coding sequence for gene

### 3. Protein Structure (7 tools)
**Location:** `protein/ProteinTools.js`

Tools for protein structure analysis and visualization:
- `fetch_protein_structure` - Fetch PDB structures
- `open_protein_viewer` - Open 3D viewer
- `search_protein_by_gene` - Search protein by gene
- `search_alphafold_by_gene` - Search AlphaFold by gene
- `fetch_alphafold_structure` - Fetch AlphaFold structure
- `search_alphafold_by_sequence` - Search AlphaFold by sequence
- `open_alphafold_viewer` - Open AlphaFold viewer

### 4. Database Integration (6 tools)
**Location:** `database/DatabaseTools.js`

Tools for accessing biological databases:
- `search_uniprot_database` - Search UniProt database
- `advanced_uniprot_search` - Advanced UniProt search
- `get_uniprot_entry` - Get UniProt entry details
- `analyze_interpro_domains` - Analyze protein domains
- `search_interpro_entry` - Search InterPro entries
- `get_interpro_entry_details` - Get InterPro details

### 5. AI-Powered Analysis (5 tools)
**Location:** `evo2/Evo2Tools.js`

NVIDIA EVO2 AI tools for sequence generation and analysis:
- `evo2_generate_sequence` - Generate DNA sequences
- `evo2_predict_function` - Predict gene function
- `evo2_design_crispr` - Design CRISPR systems
- `evo2_optimize_sequence` - Optimize sequences
- `evo2_analyze_essentiality` - Analyze gene essentiality

### 6. Data Management (4 tools)
**Location:** `data/DataTools.js`

Tools for data annotation, export, and analysis:
- `create_annotation` - Create annotations
- `analyze_region` - Analyze genomic regions
- `export_data` - Export data
- `codon_usage_analysis` - Analyze codon usage

### 7. Pathway & Search (3 tools)
**Location:** `pathway/PathwayTools.js`

Tools for metabolic pathway analysis and sequence search:
- `show_metabolic_pathway` - Display pathways
- `find_pathway_genes` - Find pathway genes
- `blast_search` - BLAST sequence search

## Key Components

### ToolsIntegrator.js
The main coordinator that:
- Combines all tool modules
- Routes tool execution to appropriate modules
- Provides unified interface for tool management
- Handles parameter validation
- Generates tool statistics and documentation

### Tool Module Pattern
Each tool module follows a consistent pattern:
```javascript
class ToolModule {
    constructor(server) {
        this.server = server;
    }
    
    getTools() {
        return {
            tool_name: {
                name: 'tool_name',
                description: 'Tool description',
                parameters: { /* JSON schema */ }
            }
        };
    }
    
    async executeTool(toolName, parameters, clientId) {
        // Tool execution logic
    }
}
```

## Benefits of New Architecture

### 1. Simplified Architecture
- **Before:** 4-layer chain with complex dependencies
- **After:** 2-layer direct integration

### 2. Better Performance
- Reduced latency from fewer network hops
- Direct tool execution without proxy layers
- Optimized parameter validation

### 3. Easier Maintenance
- Modular tool organization by functionality
- Clear separation of concerns
- Consistent interfaces across modules
- Better error handling and logging

### 4. Enhanced Scalability
- Easy to add new tool categories
- Simple tool registration process
- Organized code structure for team development

### 5. Improved Debugging
- Clear tool categorization
- Centralized error handling
- Comprehensive logging with emojis for visual clarity

## Usage Examples

### Basic Tool Execution
```javascript
const toolsIntegrator = new ToolsIntegrator(server);

// Execute a sequence analysis tool
const result = await toolsIntegrator.executeTool('compute_gc', {
    sequence: 'ATCGATCGATCG'
});

// Execute a protein structure tool
const proteinResult = await toolsIntegrator.executeTool('search_alphafold_by_gene', {
    geneName: 'p53',
    organism: 'Homo sapiens'
});
```

### Getting Tool Information
```javascript
// Get all available tools
const allTools = toolsIntegrator.getAvailableTools();

// Get tools by category
const categories = toolsIntegrator.getToolsByCategory();

// Get tool statistics
const stats = toolsIntegrator.getToolStatistics();
console.log(`Total tools: ${stats.totalTools}`);
console.log(`Server-side tools: ${stats.serverSideTools}`);
```

### Parameter Validation
```javascript
// Validate tool parameters before execution
try {
    toolsIntegrator.validateToolParameters('compute_gc', { sequence: 'ATCG' });
    console.log('Parameters valid');
} catch (error) {
    console.error('Validation failed:', error.message);
}
```

## Server-Side vs Client-Side Tools

### Server-Side Tools (16 tools)
Execute directly on the server with API calls:
- All protein structure tools
- All database integration tools  
- All EVO2 AI tools
- Some sequence analysis tools

### Client-Side Tools (24 tools)
Execute in the Genome AI Studio browser:
- All navigation tools
- Most sequence analysis tools
- All data management tools
- All pathway tools

## Development Guidelines

### Adding New Tools
1. Determine the appropriate category
2. Add tool definition to the relevant module
3. Implement execution logic
4. Update documentation
5. Test integration

### Adding New Categories
1. Create new directory under `src/mcp-tools/`
2. Implement tool module following the pattern
3. Add to `ToolsIntegrator.js`
4. Update documentation

### Best Practices
- Use consistent naming conventions
- Provide comprehensive parameter schemas
- Include proper error handling
- Add descriptive comments
- Follow the established module pattern

## Testing

The organized architecture makes testing easier:
- Unit tests for individual tool modules
- Integration tests for ToolsIntegrator
- End-to-end tests for complete workflows

## Migration from Legacy System

The new system maintains backward compatibility while providing a cleaner architecture. The migration process:

1. **Tool Analysis** - Categorized all 40+ existing tools
2. **Module Creation** - Organized tools into logical modules
3. **Integration** - Created unified interface
4. **Direct Server** - Eliminated legacy dependencies
5. **Testing** - Verified all tools work correctly

## Future Enhancements

The modular architecture enables:
- Easy addition of new bioinformatics tools
- Integration with additional databases
- Enhanced AI capabilities
- Better performance monitoring
- Improved user experience

## Support

For questions or issues with the MCP tools architecture:
1. Check the module-specific documentation
2. Review the ToolsIntegrator implementation
3. Examine the tool execution logs
4. Consult the main project documentation 