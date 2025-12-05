# KEGG Pathway Viewer

**Version:** 1.0.0  
**Author:** CodeXomics Team  
**License:** MIT

## Overview

KEGG Pathway Viewer is a comprehensive CodeXomics plugin that integrates with the KEGG database (https://www.kegg.jp/) to enable metabolic pathway retrieval, analysis, and visualization directly within the CodeXomics environment.

## Features

### 🔍 Database Integration
- **KEGG REST API Access**: Query the KEGG database in real-time
- **Multi-Organism Support**: Search pathways across different organisms
- **Pathway Search**: Find pathways by keyword or identifier
- **KGML Parsing**: Parse and visualize KEGG Markup Language data

### 📊 Pathway Analysis
- **Pathway Search**: Search pathways by keyword
- **Detailed Pathway Information**: Retrieve comprehensive pathway data
- **Gene-Pathway Mapping**: Find all pathways containing specific genes
- **Compound Information**: Get detailed metabolic compound data
- **Reaction Details**: Access enzymatic reaction information

### 🎨 Visualization
- **Interactive Pathway Diagrams**: SVG-based pathway visualization
- **Multiple Layout Modes**:
  - Hierarchical layout
  - Circular layout
  - Grid layout
- **Node Type Differentiation**:
  - Rectangles for genes
  - Circles for compounds
  - Diamonds for enzymes
- **Reaction Flow**: Directional arrows showing metabolic flow
- **Color-Coded Elements**: Visual distinction between component types

## Usage

### Via AI Chat Interface

Ask CodeXomics AI to search and visualize pathways:

```
"Search KEGG for glycolysis pathway in human"

"Show me the TCA cycle pathway visualization"

"Find all pathways containing the BRCA1 gene"

"Get compound information for glucose in KEGG"
```

### Via Commands

#### Search Pathway
```javascript
kegg-viewer.searchPathway({
  keyword: "glycolysis",
  organism: "hsa"  // Human
})
```

#### Get Pathway Details
```javascript
kegg-viewer.getPathwayDetails({
  pathwayId: "hsa00010"  // Glycolysis
})
```

#### Find Pathways by Gene
```javascript
kegg-viewer.findPathwaysByGene({
  gene: "BRCA1",
  organism: "hsa"
})
```

#### Get Compound Information
```javascript
kegg-viewer.getCompoundInfo({
  compoundId: "C00031"  // D-Glucose
})
```

## API Reference

### Commands

#### `kegg-viewer.searchPathway`
Search for pathways by keyword in KEGG database.

**Parameters:**
- `keyword` (string): Search keyword
- `organism` (string, optional): KEGG organism code (default: "hsa" for human)

**Returns:** List of matching pathways

#### `kegg-viewer.getPathwayDetails`
Retrieve detailed pathway information including KGML data.

**Parameters:**
- `pathwayId` (string): KEGG pathway identifier (e.g., "hsa00010")

**Returns:** Pathway details with nodes, edges, and metadata

#### `kegg-viewer.findPathwaysByGene`
Find all pathways containing a specific gene.

**Parameters:**
- `gene` (string): Gene identifier
- `organism` (string, optional): KEGG organism code (default: "hsa")

**Returns:** List of pathways containing the gene

#### `kegg-viewer.getCompoundInfo`
Retrieve detailed compound information.

**Parameters:**
- `compoundId` (string): KEGG compound ID (e.g., "C00031")

**Returns:** Compound details from KEGG

## Supported Data Types

- `metabolic-pathway`: Generic metabolic pathway data
- `kegg-pathway`: KEGG-specific pathway format
- `pathway-data`: General pathway data
- `generic`: Generic network data

## Pathway Data Format

```javascript
{
  nodes: [
    {
      id: "1",
      name: "hsa:2645",  // KEGG gene ID
      type: "gene",
      x: 100,
      y: 200,
      properties: {
        fullName: "hsa:2645 hsa:5213 hsa:5214",
        graphics: { name: "GCK...", fgcolor: "#000000", bgcolor: "#BFFFBF" }
      }
    },
    {
      id: "2",
      name: "C00031",  // KEGG compound ID
      type: "compound",
      x: 150,
      y: 250,
      properties: { fullName: "cpd:C00031" }
    }
  ],
  edges: [
    {
      id: "rel-0",
      source: "1",
      target: "2",
      type: "relation-activation",
      properties: { relationType: "activation" }
    },
    {
      id: "rxn-0",
      source: "2",
      target: "3",
      type: "reaction",
      properties: {
        reactionId: "rn:R00299",
        reactionName: "R00299",
        reactionType: "irreversible"
      }
    }
  ],
  metadata: {
    source: "KEGG",
    format: "KGML"
  }
}
```

## Organism Codes

Common KEGG organism codes:
- `hsa`: Homo sapiens (Human)
- `mmu`: Mus musculus (Mouse)
- `rno`: Rattus norvegicus (Rat)
- `dme`: Drosophila melanogaster (Fruit fly)
- `cel`: Caenorhabditis elegans (Worm)
- `sce`: Saccharomyces cerevisiae (Yeast)
- `eco`: Escherichia coli K-12

## Pathway Categories

KEGG organizes pathways into categories:
- **Metabolism**: Carbohydrate, lipid, amino acid, nucleotide metabolism
- **Genetic Information Processing**: Transcription, translation, replication
- **Environmental Information Processing**: Signal transduction, membrane transport
- **Cellular Processes**: Cell growth, cell motility, immune system
- **Human Diseases**: Cancer, infectious diseases, neurodegenerative diseases

## Requirements

- **CodeXomics**: Version 2.0.0 or higher
- **Internet Connection**: Required for KEGG API access
- **Permissions**: Network access, external API access

## Installation

Install via CodeXomics Plugin Marketplace:

1. Open CodeXomics
2. Navigate to **Options → Plugin Management**
3. Click **Browse Marketplace**
4. Search for "KEGG Pathway Viewer"
5. Click **Install**

## Security

This plugin:
- ✅ Uses secure HTTPS connections to KEGG REST API
- ✅ Sandboxed execution environment
- ✅ No local data storage of sensitive information
- ✅ Validated against CodeXomics security standards

## Citation

If you use this plugin in your research, please cite:

**KEGG Database:**
> Kanehisa M, Furumichi M, Sato Y, Kawashima M, Ishiguro-Watanabe M. (2023) KEGG for taxonomy-based analysis of pathways and genomes. Nucleic Acids Res. 51:D587-D592.

**CodeXomics:**
> CodeXomics Team. KEGG Pathway Viewer Plugin v1.0.0. https://github.com/codexomics/kegg-pathway-viewer

## Known Limitations

- KEGG API has rate limiting; excessive requests may be throttled
- Some pathways may not have complete KGML data available
- Organism-specific pathway availability varies

## Support

- **Issues**: https://github.com/codexomics/kegg-pathway-viewer/issues
- **Documentation**: https://github.com/codexomics/kegg-pathway-viewer/wiki
- **Contact**: support@codexomics.org

## License

MIT License - see LICENSE file for details

## Changelog

### Version 1.0.0 (2024-12-05)
- Initial release
- KEGG REST API integration
- Interactive pathway visualization
- Multiple layout modes (hierarchical, circular, grid)
- KGML parsing support
- Gene-pathway mapping
- Compound information retrieval
- AI chat interface integration
