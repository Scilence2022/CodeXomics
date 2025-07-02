# Protein 3D Structure Viewer Integration

This document describes the implementation of protein 3D structure visualization functionality in Genome AI Studio using the PDB database and NGL Viewer.

## Overview

The protein structure functionality allows users to:
- Search for protein structures by gene name
- Download PDB structures directly by PDB ID
- Visualize 3D protein structures in a separate window
- Interact with structures using various representation styles

## Implementation Components

### 1. MCP Server Tools (`src/mcp-server.js`)

Three new MCP tools were added:

#### `fetch_protein_structure`
- **Description**: Fetch protein 3D structure from PDB database by gene name or PDB ID
- **Parameters**:
  - `geneName` (string, optional): Gene name to search for protein structure
  - `pdbId` (string, optional): Direct PDB ID (alternative to gene name)
  - `organism` (string, optional): Organism name for more specific search
  - `clientId` (string, optional): Browser client ID

#### `search_protein_by_gene`
- **Description**: Search for protein structures associated with a gene
- **Parameters**:
  - `geneName` (string, required): Gene name to search
  - `organism` (string, optional): Organism name (default: "Homo sapiens")
  - `maxResults` (number, optional): Maximum number of results to return (default: 10)
  - `clientId` (string, optional): Browser client ID

#### `open_protein_viewer`
- **Description**: Open 3D protein structure viewer in a separate window
- **Parameters**:
  - `pdbData` (string, required): PDB structure data
  - `proteinName` (string, required): Protein name for display
  - `pdbId` (string, optional): PDB ID
  - `clientId` (string, optional): Browser client ID

### 2. Frontend Module (`src/renderer/modules/ProteinStructureViewer.js`)

The `ProteinStructureViewer` class provides:
- A user interface for searching protein structures
- Integration with the MCP server for data retrieval
- 3D visualization using NGL Viewer in popup windows
- Interactive controls for structure manipulation

### 3. Integration with Existing System

#### Chat Manager Integration
- Added `openProteinViewer` method to handle MCP tool requests
- Tool execution case added to `executeToolRequest` method

#### HTML Integration
- Added script import for `ProteinStructureViewer.js`
- NGL Viewer loaded from CDN in popup windows

#### Package Dependencies
- Added `ngl@2.3.1` to package.json for 3D molecular visualization

## Usage

### Via User Interface
1. Click the "3D Proteins" button in the toolbar
2. Enter a gene name (e.g., "TP53", "BRCA1") or PDB ID
3. Optionally specify organism (defaults to "Homo sapiens")
4. Click "Search Structures" to find available structures
5. Click on a result to load and view the 3D structure

### Via MCP Tools (Programmatic)
```javascript
// Search for protein structures
const searchResults = await mcpServerManager.executeTool('search_protein_by_gene', {
    geneName: 'TP53',
    organism: 'Homo sapiens',
    maxResults: 5
});

// Fetch specific structure
const structureData = await mcpServerManager.executeTool('fetch_protein_structure', {
    pdbId: '1TUP',
    geneName: 'TP53'
});

// Open 3D viewer
await mcpServerManager.executeTool('open_protein_viewer', {
    pdbData: structureData.pdbData,
    proteinName: 'TP53 Tumor Suppressor',
    pdbId: '1TUP'
});
```

## Technical Details

### Data Sources
- **RCSB PDB Search API**: Used for gene name-based protein structure searches
- **RCSB PDB Data API**: Used for retrieving structure metadata
- **RCSB PDB Files**: Direct download of PDB structure files

### 3D Visualization
- **NGL Viewer**: WebGL-based molecular visualization library
- **Representation Styles**: Cartoon, ball+stick, spacefill, surface, backbone
- **Interactive Controls**: Zoom, rotate, reset view, auto-rotate, style switching

### Popup Window Features
- Clean, modern interface with gradient header
- Real-time loading indicators
- Error handling with user-friendly messages
- Responsive design that adapts to window resizing
- Control panel with visualization options

## File Structure

```
src/
├── mcp-server.js                           # MCP server with protein tools
└── renderer/
    ├── index.html                          # Added script import
    └── modules/
        ├── ProteinStructureViewer.js       # Main protein viewer module
        └── ChatManager.js                  # Added openProteinViewer method
```

## API Integration

### RCSB PDB Search Query Format
```json
{
    "query": {
        "type": "group",
        "logical_operator": "and",
        "nodes": [
            {
                "type": "terminal",
                "service": "text",
                "parameters": {
                    "attribute": "rcsb_entity_source_organism.taxonomy_lineage.name",
                    "operator": "contains_words",
                    "value": "Homo sapiens"
                }
            },
            {
                "type": "terminal",
                "service": "text",
                "parameters": {
                    "attribute": "rcsb_polymer_entity.rcsb_gene_name.value",
                    "operator": "exact_match",
                    "value": "TP53"
                }
            }
        ]
    },
    "request_options": {
        "pager": {
            "start": 0,
            "rows": 10
        }
    },
    "return_type": "entry"
}
```

## Error Handling

The implementation includes comprehensive error handling for:
- Network connection issues
- Invalid gene names or PDB IDs
- Missing or malformed structure data
- Popup blocking by browsers
- NGL Viewer initialization failures

## Future Enhancements

Potential improvements could include:
- Structure comparison tools
- Sequence-to-structure mapping
- Protein domain highlighting
- Save/export structure views
- Integration with protein sequence data from genome annotations
- Multi-structure alignment visualization

## Dependencies

- **NGL Viewer** (2.3.1): 3D molecular visualization
- **RCSB PDB APIs**: Protein structure search and download
- **WebSocket**: Real-time communication with MCP server
- **Modern Browser**: WebGL support required for 3D rendering 