# Protein Interaction Network Visualizer

Interactive protein-protein interaction network analysis and visualization plugin for GenomeExplorer.

## Version

1.8.3

## Features

- **Interactive Network Visualization**: Render protein-protein interaction networks as interactive graphs
- **Multiple Layout Algorithms**: Support for force-directed, circular, hierarchical, and grid layouts
- **Confidence Scoring**: Visual representation of interaction confidence levels
- **Node Classification**: Different colors for protein types (protein, enzyme, receptor)
- **Hover Tooltips**: Interactive information display on node hover
- **Flexible Data Input**: Supports multiple data formats (JSON, custom objects)

## Installation

This plugin can be installed directly from the GenomeExplorer Plugin Marketplace.

## Usage

### Visualize Network

```javascript
// Example network data
const networkData = {
  nodes: [
    { id: 'P1', name: 'Protein A', type: 'protein' },
    { id: 'P2', name: 'Protein B', type: 'enzyme' },
    { id: 'P3', name: 'Protein C', type: 'receptor' },
  ],
  edges: [
    { source: 'P1', target: 'P2', confidence: 0.9 },
    { source: 'P2', target: 'P3', confidence: 0.75 },
  ],
};

// Visualize the network
await plugin.visualizeNetwork(networkData);
```

### Change Layout

```javascript
// Switch to circular layout
plugin.changeLayout('circular');
```

## Supported Data Types

- `protein-interaction`: Standard protein interaction format
- `ppi-network`: Protein-protein interaction network
- `generic`: Generic network data

## API

### Methods

#### `activate(context)`

Activates the plugin and registers commands and visualizations.

#### `deactivate()`

Deactivates the plugin and cleans up resources.

#### `visualizeNetwork(data)`

Creates an interactive visualization of the protein network.

**Parameters:**

- `data` (Object|String): Network data containing nodes and edges

**Returns:**

- Promise<Object>: Visualization result with networkId and statistics

#### `changeLayout(layoutType)`

Changes the network layout algorithm.

**Parameters:**

- `layoutType` (String): One of 'force-directed', 'circular', 'hierarchical', 'grid'

**Returns:**

- Object: Success status and selected layout

### Data Format

```javascript
{
  nodes: [
    {
      id: string,           // Unique node identifier
      name: string,         // Display name
      type: string,         // Node type (protein, enzyme, receptor)
      properties: object    // Additional properties
    }
  ],
  edges: [
    {
      source: string,       // Source node ID
      target: string,       // Target node ID
      confidence: number,   // Confidence score (0-1)
      type: string,         // Interaction type
      properties: object    // Additional properties
    }
  ],
  metadata: object          // Optional metadata
}
```

## Configuration

No additional configuration required. The plugin works out of the box.

## Compatibility

- **GenomeExplorer**: >=2.0.0
- **Platforms**: Windows, macOS, Linux

## Changelog

### 1.8.3 (Current)

- Performance improvements for large networks (1000+ nodes)
- Optimized rendering engine
- Improved memory management

### 1.8.2

- Added circular and hierarchical layout algorithms
- Enhanced edge confidence visualization
- Bug fixes for node positioning

### 1.8.0

- Interactive filtering and search
- Node type classification
- Tooltip information display

## License

Apache-2.0

## Author

NetworkBioLab

## Support

For issues, questions, or contributions:

- GitHub: https://github.com/genomeexplorer/protein-networks
- Email: support@networkbiolab.org

## Credits

Built with modern web technologies and optimized for bioinformatics workflows.
