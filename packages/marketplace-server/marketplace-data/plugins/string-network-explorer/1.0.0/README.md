# STRING Network Explorer

**Version:** 1.0.0  
**Author:** CodeXomics Team  
**License:** MIT

## Overview

STRING Network Explorer is a powerful CodeXomics plugin that integrates with the STRING database (https://string-db.org/) to enable seamless protein-protein interaction network retrieval, visualization, and analysis directly within the CodeXomics environment.

## Features

### 🔍 Database Integration

- **Direct STRING API Access**: Query the STRING database in real-time
- **Multi-Species Support**: Search protein interactions across different organisms
- **Confidence Filtering**: Filter interactions by confidence score (0-1000)
- **Network Type Selection**: Choose between physical and functional interactions

### 📊 Network Analysis

- **Interactive Network Search**: Search proteins by identifier or name
- **Interaction Partners**: Find all interaction partners for query proteins
- **Functional Enrichment**: Perform GO enrichment analysis (Process, Component, Function)
- **Combined Scores**: Access detailed interaction evidence scores

### 🎨 Visualization

- **Interactive Network Graphs**: SVG-based interactive network visualization
- **Multiple Layout Algorithms**:
  - Force-directed layout
  - Circular layout
  - Hierarchical layout
- **Confidence-Based Coloring**: Edge colors reflect interaction confidence
  - Green: High confidence (>700)
  - Orange: Medium confidence (400-700)
  - Red: Low confidence (<400)
- **Node Hover Effects**: Interactive tooltips and highlighting

## Usage

### Via AI Chat Interface

Ask CodeXomics AI to search and visualize protein networks:

```
"Search STRING for interactions between TP53, MDM2, and ATM proteins"

"Visualize the protein network for BRCA1 with confidence threshold 600"

"Get enrichment analysis for proteins: EGFR, MYC, KRAS, PIK3CA"
```

### Via Commands

#### Search Protein Interactions

```javascript
string -
  explorer.search({
    proteins: ['TP53', 'MDM2', 'ATM'],
    species: '9606', // Human
    requiredScore: 400,
    networkType: 'physical',
  });
```

#### Get Protein Network

```javascript
string -
  explorer.getNetwork({
    proteins: ['BRCA1'],
    species: '9606',
    requiredScore: 600,
    limit: 50,
  });
```

#### Get Enrichment Analysis

```javascript
string -
  explorer.getEnrichment({
    proteins: ['EGFR', 'MYC', 'KRAS', 'PIK3CA'],
    species: '9606',
    categories: ['Process', 'Component', 'Function'],
  });
```

## API Reference

### Commands

#### `string-explorer.search`

Search for protein interactions in STRING database.

**Parameters:**

- `proteins` (Array<string>): List of protein identifiers
- `species` (string, optional): NCBI taxonomy ID (default: "9606" for human)
- `requiredScore` (number, optional): Minimum confidence score 0-1000 (default: 400)
- `networkType` (string, optional): "physical" or "functional" (default: "physical")

**Returns:** Network data with nodes and edges

#### `string-explorer.getNetwork`

Retrieve detailed protein network including interaction partners.

**Parameters:**

- `proteins` (Array<string>): List of protein identifiers
- `species` (string, optional): NCBI taxonomy ID (default: "9606")
- `requiredScore` (number, optional): Minimum confidence score (default: 400)
- `limit` (number, optional): Maximum number of partners (default: 50)

**Returns:** Extended network data

#### `string-explorer.getEnrichment`

Perform functional enrichment analysis.

**Parameters:**

- `proteins` (Array<string>): List of protein identifiers
- `species` (string, optional): NCBI taxonomy ID (default: "9606")
- `categories` (Array<string>, optional): Enrichment categories (default: ["Process", "Component", "Function"])

**Returns:** Enrichment results by category

## Supported Data Types

- `protein-interaction`: Generic protein interaction data
- `string-network`: STRING-specific network format
- `ppi-network`: Protein-protein interaction networks
- `generic`: Generic network data

## Network Data Format

```javascript
{
  nodes: [
    {
      id: "TP53",
      name: "TP53",
      type: "protein",
      stringId: "9606.ENSP00000269305",
      ncbiTaxonId: "9606"
    }
  ],
  edges: [
    {
      id: "edge-0",
      source: "TP53",
      target: "MDM2",
      confidence: 0.999,
      type: "protein-interaction",
      properties: {
        combinedScore: 999,
        nscore: 0,
        fscore: 0.9,
        pscore: 0.95,
        // ... other evidence scores
      }
    }
  ],
  metadata: {
    source: "STRING",
    queryProteins: ["TP53", "MDM2"],
    timestamp: "2024-12-05T..."
  }
}
```

## Species Codes

Common NCBI taxonomy IDs:

- `9606`: Homo sapiens (Human)
- `10090`: Mus musculus (Mouse)
- `10116`: Rattus norvegicus (Rat)
- `7227`: Drosophila melanogaster (Fruit fly)
- `6239`: Caenorhabditis elegans (Worm)
- `511145`: Escherichia coli K-12

## Requirements

- **CodeXomics**: Version 2.0.0 or higher
- **Internet Connection**: Required for STRING API access
- **Permissions**: Network access, external API access

## Installation

Install via CodeXomics Plugin Marketplace:

1. Open CodeXomics
2. Navigate to **Options → Plugin Management**
3. Click **Browse Marketplace**
4. Search for "STRING Network Explorer"
5. Click **Install**

## Security

This plugin:

- ✅ Uses secure HTTPS connections to STRING API
- ✅ Sandboxed execution environment
- ✅ No local data storage of sensitive information
- ✅ Validated against CodeXomics security standards

## Citation

If you use this plugin in your research, please cite:

**STRING Database:**

> Szklarczyk D, et al. (2023) The STRING database in 2023: protein-protein association networks and functional enrichment analyses for any sequenced genome of interest. Nucleic Acids Res. 51:D638-D646.

**CodeXomics:**

> CodeXomics Team. STRING Network Explorer Plugin v1.0.0. https://github.com/codexomics/string-network-explorer

## Support

- **Issues**: https://github.com/codexomics/string-network-explorer/issues
- **Documentation**: https://github.com/codexomics/string-network-explorer/wiki
- **Contact**: support@codexomics.org

## License

MIT License - see LICENSE file for details

## Changelog

### Version 1.0.0 (2024-12-05)

- Initial release
- STRING API integration
- Interactive network visualization
- Multiple layout algorithms
- Enrichment analysis support
- AI chat interface integration
