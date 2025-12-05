# EcoCyc Pathway Analyzer

**Version:** 1.0.0  
**Author:** CodeXomics Team  
**License:** MIT

## Overview

EcoCyc Pathway Analyzer is a specialized CodeXomics plugin that integrates with the EcoCyc database (https://ecocyc.org/) to enable comprehensive E. coli biochemical pathway analysis, enzymatic reaction exploration, and visualization directly within the CodeXomics environment.

## Features

### 🔍 Database Integration
- **BioCyc Web Service API**: Query EcoCyc database in real-time
- **E. coli Specialization**: Optimized for E. coli K-12 MG1655
- **XML Query Support**: Advanced BioCyc query language support
- **Pathway Search**: Find pathways by keyword or identifier
- **Mock Data Support**: Demonstration data when API is unavailable

### 📊 Pathway Analysis
- **Pathway Search**: Search biochemical pathways by keyword
- **Detailed Pathway Data**: Retrieve comprehensive pathway information
- **Gene-Pathway Mapping**: Find all pathways containing specific genes
- **Enzyme Information**: Get detailed enzyme and protein data
- **Reaction Details**: Access detailed enzymatic reaction information
- **Substrate/Product Analysis**: Track metabolic flow through reactions

### 🎨 Visualization
- **Interactive Pathway Diagrams**: SVG-based pathway visualization
- **Multiple Layout Modes**:
  - Hierarchical layout (left-to-right metabolic flow)
  - Layered layout (substrate-reaction-product organization)
  - Radial layout (circular arrangement)
- **Node Type Differentiation**:
  - Circles for metabolic compounds
  - Hexagons for enzymatic reactions
- **Directional Edges**:
  - Blue arrows for substrate consumption
  - Green arrows for product formation
- **Interactive Elements**: Hover effects and node highlighting

## Usage

### Via AI Chat Interface

Ask CodeXomics AI to search and visualize pathways:

```
"Search EcoCyc for glycolysis pathway"

"Show me the TCA cycle in E. coli"

"Find all pathways containing the araA gene"

"Get enzyme information for hexokinase in EcoCyc"
```

### Via Commands

#### Search Pathway
```javascript
ecocyc-analyzer.searchPathway({
  query: "glycolysis",
  organism: "ECOLI"
})
```

#### Get Pathway Details
```javascript
ecocyc-analyzer.getPathwayDetails({
  pathwayId: "GLYCOLYSIS",
  organism: "ECOLI"
})
```

#### Get Gene Pathways
```javascript
ecocyc-analyzer.getGenePathways({
  gene: "araA",
  organism: "ECOLI"
})
```

#### Get Enzyme Information
```javascript
ecocyc-analyzer.getEnzymeInfo({
  enzymeId: "HEXOKI-MONOMER",
  organism: "ECOLI"
})
```

#### Get Reaction Details
```javascript
ecocyc-analyzer.getReactionDetails({
  reactionId: "GLUCOKIN-RXN",
  organism: "ECOLI"
})
```

## API Reference

### Commands

#### `ecocyc-analyzer.searchPathway`
Search for biochemical pathways in EcoCyc database.

**Parameters:**
- `query` (string): Search query
- `organism` (string, optional): BioCyc organism ID (default: "ECOLI")

**Returns:** List of matching pathways

#### `ecocyc-analyzer.getPathwayDetails`
Retrieve detailed pathway information.

**Parameters:**
- `pathwayId` (string): EcoCyc pathway identifier
- `organism` (string, optional): BioCyc organism ID (default: "ECOLI")

**Returns:** Pathway details with nodes, edges, and metadata

#### `ecocyc-analyzer.getGenePathways`
Find all pathways containing a specific gene.

**Parameters:**
- `gene` (string): Gene identifier
- `organism` (string, optional): BioCyc organism ID (default: "ECOLI")

**Returns:** List of pathways containing the gene

#### `ecocyc-analyzer.getEnzymeInfo`
Retrieve detailed enzyme information.

**Parameters:**
- `enzymeId` (string): EcoCyc enzyme identifier
- `organism` (string, optional): BioCyc organism ID (default: "ECOLI")

**Returns:** Enzyme details including genes and catalyzed reactions

#### `ecocyc-analyzer.getReactionDetails`
Retrieve detailed enzymatic reaction information.

**Parameters:**
- `reactionId` (string): EcoCyc reaction identifier
- `organism` (string, optional): BioCyc organism ID (default: "ECOLI")

**Returns:** Reaction details including substrates, products, and enzymes

## Supported Data Types

- `biochemical-pathway`: Biochemical pathway data
- `ecocyc-pathway`: EcoCyc-specific pathway format
- `metabolic-pathway`: General metabolic pathway data
- `generic`: Generic network data

## Pathway Data Format

```javascript
{
  nodes: [
    {
      id: "GLUCOSE",
      name: "Glucose",
      type: "compound"
    },
    {
      id: "HEX1",
      name: "Hexokinase",
      type: "reaction"
    }
  ],
  edges: [
    {
      id: "e1",
      source: "GLUCOSE",
      target: "HEX1",
      type: "substrate"
    },
    {
      id: "e2",
      source: "HEX1",
      target: "G6P",
      type: "product"
    }
  ],
  metadata: {
    source: "EcoCyc",
    format: "BioCyc XML"
  }
}
```

## BioCyc Organism IDs

EcoCyc focuses on E. coli, but BioCyc includes many organisms:
- `ECOLI`: Escherichia coli K-12 MG1655
- `HUMAN`: Homo sapiens
- `YEAST`: Saccharomyces cerevisiae
- `MOUSE`: Mus musculus
- `ARATH`: Arabidopsis thaliana

## Pathway Categories

EcoCyc organizes pathways into functional categories:
- **Biosynthesis**: Amino acid, nucleotide, vitamin biosynthesis
- **Degradation**: Compound degradation pathways
- **Energy Metabolism**: Respiration, fermentation, photosynthesis
- **Macromolecule Modification**: Protein, DNA, RNA modifications
- **Detoxification**: Xenobiotic degradation, stress response

## Requirements

- **CodeXomics**: Version 2.0.0 or higher
- **Internet Connection**: Optional (mock data available)
- **Permissions**: Network access, external API access
- **API Key**: Optional for enhanced access (free registration)

## Installation

Install via CodeXomics Plugin Marketplace:

1. Open CodeXomics
2. Navigate to **Options → Plugin Management**
3. Click **Browse Marketplace**
4. Search for "EcoCyc Pathway Analyzer"
5. Click **Install**

## API Key Configuration (Optional)

For enhanced access and higher rate limits:

1. Register at https://biocyc.org/
2. Obtain free API key
3. Configure in plugin settings
4. Enjoy increased query limits

## Security

This plugin:
- ✅ Uses secure HTTPS connections to BioCyc API
- ✅ Sandboxed execution environment
- ✅ No local storage of sensitive information
- ✅ Validated against CodeXomics security standards
- ✅ Mock data fallback for offline usage

## Citation

If you use this plugin in your research, please cite:

**EcoCyc Database:**
> Keseler IM, et al. (2021) The EcoCyc Database in 2021. Front Microbiol. 12:711077.

**BioCyc Collection:**
> Karp PD, et al. (2019) The BioCyc collection of microbial genomes and metabolic pathways. Brief Bioinform. 20:1085-1093.

**CodeXomics:**
> CodeXomics Team. EcoCyc Pathway Analyzer Plugin v1.0.0. https://github.com/codexomics/ecocyc-pathway-analyzer

## Known Limitations

- BioCyc API requires registration for full access
- Rate limiting applies to free tier
- XML parsing may be slow for very large pathways
- Mock data used when API is unavailable

## Advanced Features

### Custom Layout Algorithms
- **Hierarchical**: Optimized for metabolic flow visualization
- **Layered**: Separates compounds from reactions
- **Radial**: Circular arrangement for pathway overview

### Interactive Elements
- Hover effects on nodes and edges
- Click-to-zoom functionality
- Pathway statistics panel
- Real-time layout switching

## Support

- **Issues**: https://github.com/codexomics/ecocyc-pathway-analyzer/issues
- **Documentation**: https://github.com/codexomics/ecocyc-pathway-analyzer/wiki
- **Contact**: support@codexomics.org
- **EcoCyc Support**: https://ecocyc.org/contact.shtml

## License

MIT License - see LICENSE file for details

## Changelog

### Version 1.0.0 (2024-12-05)
- Initial release
- EcoCyc/BioCyc API integration
- Interactive pathway visualization
- Multiple layout modes (hierarchical, layered, radial)
- BioCyc XML parsing support
- Gene-pathway mapping
- Enzyme and reaction information retrieval
- Mock data support for demonstration
- AI chat interface integration
