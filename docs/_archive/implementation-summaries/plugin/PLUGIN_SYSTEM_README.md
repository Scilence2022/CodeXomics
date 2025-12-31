# GenomeExplorer Plugin System

A comprehensive plugin system for the GenomeExplorer application that provides extensible function calling and data visualization capabilities, specifically designed for seamless integration with LLM ChatBox.

## Overview

The GenomeExplorer Plugin System consists of four main components:

1. **PluginManager** - Core plugin management and orchestration
2. **PluginUtils** - Utility functions for genomic data analysis
3. **PluginImplementations** - Concrete implementations of plugin functions
4. **PluginVisualization** - Data visualization rendering functions

## Features

### Core Capabilities
- **Function Calling Plugins**: Extensible genomic analysis functions
- **Data Visualization Plugins**: Interactive charts, plots, and visualizations
- **LLM ChatBox Integration**: Seamless tool calling from conversational AI
- **Security Sandbox**: Safe execution environment for plugin code
- **Event System**: Plugin lifecycle and execution event handling

### Built-in Plugin Categories

#### 1. Genomic Analysis Functions
- **GC Content Analysis**: Window-based GC content calculation
- **Motif Finding**: Sequence motif search with strand specificity
- **Sequence Diversity**: Shannon and Simpson diversity metrics
- **Region Comparison**: Multi-region comparative analysis

#### 2. Phylogenetic Analysis Functions
- **Phylogenetic Tree Building**: Neighbor-joining and UPGMA methods
- **Evolutionary Distance**: Multiple distance calculation models
- **Sequence Clustering**: K-means, hierarchical, and DBSCAN clustering

#### 3. Machine Learning Functions
- **Gene Function Prediction**: CNN and RNN-based prediction
- **Sequence Classification**: Automated sequence categorization
- **Feature Extraction**: Genomic feature vector generation

#### 4. Visualization Plugins
- **Phylogenetic Trees**: Interactive tree visualizations
- **Sequence Alignments**: Multiple sequence alignment display
- **GC Content Plots**: Distribution and window-based plots
- **Heatmaps**: Gene expression and comparative analysis
- **Network Graphs**: Protein-protein interaction networks
- **Dot Plots**: Sequence similarity comparisons

## Installation & Setup

### 1. File Structure
```
src/renderer/modules/
├── PluginManager.js         # Core plugin manager
├── PluginUtils.js          # Utility functions
├── PluginImplementations.js # Function implementations
└── PluginVisualization.js  # Visualization functions
```

### 2. Integration with ChatManager

The plugin system is automatically integrated with the ChatManager. No additional setup is required for basic functionality.

```javascript
// The ChatManager automatically initializes the plugin system
const chatManager = new ChatManager(app, configManager);
// Plugin system is now available via chatManager.pluginManager
```

### 3. Manual Initialization (Advanced)

```javascript
// Create plugin manager instance
const pluginManager = new PluginManager(app, configManager);

// Listen to plugin events
pluginManager.on('functionExecuted', (data) => {
    console.log('Plugin function executed:', data);
});

pluginManager.on('visualizationRendered', (data) => {
    console.log('Visualization rendered:', data);
});
```

## Usage Examples

### 1. LLM ChatBox Function Calling

The plugin system supports standard JSON tool calling format for LLM integration:

#### GC Content Analysis
```json
{
    "tool_name": "genomic-analysis.analyzeGCContent",
    "parameters": {
        "chromosome": "chr1",
        "start": 1000,
        "end": 5000,
        "windowSize": 1000
    }
}
```

#### Motif Finding
```json
{
    "tool_name": "genomic-analysis.findMotifs",
    "parameters": {
        "chromosome": "chr1",
        "start": 1000,
        "end": 5000,
        "motif": "GAATTC",
        "strand": "both"
    }
}
```

#### Phylogenetic Analysis
```json
{
    "tool_name": "phylogenetic-analysis.buildPhylogeneticTree",
    "parameters": {
        "sequences": [
            {"id": "seq1", "sequence": "ATGCGATCG", "name": "Sequence 1"},
            {"id": "seq2", "sequence": "ATGCGATCG", "name": "Sequence 2"}
        ],
        "method": "nj",
        "distanceMetric": "hamming"
    }
}
```

#### Machine Learning Functions
```json
{
    "tool_name": "ml-analysis.predictGeneFunction",
    "parameters": {
        "sequence": "ATGCGATCGAATTC",
        "model": "cnn",
        "threshold": 0.7
    }
}
```

### 2. Programmatic Usage

```javascript
// Execute a plugin function
const result = await pluginManager.executeFunctionByName(
    'genomic-analysis.analyzeGCContent',
    {
        chromosome: 'chr1',
        start: 1000,
        end: 5000,
        windowSize: 1000
    }
);

// Render a visualization
const container = document.getElementById('viz-container');
await pluginManager.renderVisualization(
    'gc-content-plot',
    result,
    container
);

// Get available functions for LLM
const availableFunctions = pluginManager.getAvailableFunctions();
console.log('Available functions:', availableFunctions);
```

### 3. Custom Plugin Development

#### Creating a Function Plugin
```javascript
pluginManager.registerFunctionPlugin('my-plugin', {
    name: 'My Custom Plugin',
    description: 'Custom genomic analysis functions',
    version: '1.0.0',
    author: 'Developer Name',
    functions: {
        customAnalysis: {
            description: 'Perform custom analysis',
            parameters: {
                type: 'object',
                properties: {
                    sequence: { type: 'string', description: 'Input sequence' },
                    threshold: { type: 'number', description: 'Analysis threshold' }
                },
                required: ['sequence']
            },
            execute: async (params) => {
                // Custom analysis implementation
                return {
                    result: 'analysis complete',
                    data: params
                };
            }
        }
    }
});
```

#### Creating a Visualization Plugin
```javascript
pluginManager.registerVisualizationPlugin('my-viz', {
    name: 'My Custom Visualization',
    description: 'Custom data visualization',
    version: '1.0.0',
    supportedDataTypes: ['analysis-result'],
    render: async (data, container, options) => {
        // Custom visualization implementation
        container.innerHTML = '<div>Custom Visualization</div>';
        return { type: 'custom-viz', element: container };
    }
});
```

## API Reference

### PluginManager

#### Methods

##### `executeFunctionByName(functionName, parameters)`
Execute a plugin function by its full name.

- **functionName**: String in format "pluginId.functionName"
- **parameters**: Object with function parameters
- **Returns**: Promise resolving to function result

##### `renderVisualization(pluginId, data, container, options)`
Render a data visualization.

- **pluginId**: ID of the visualization plugin
- **data**: Data to visualize
- **container**: DOM element container
- **options**: Rendering options object
- **Returns**: Promise resolving to render result

##### `getAvailableFunctions()`
Get list of all available plugin functions.

- **Returns**: Array of function descriptors

##### `getAvailableVisualizations()`
Get list of all available visualization plugins.

- **Returns**: Array of visualization descriptors

##### `registerFunctionPlugin(id, plugin)`
Register a new function plugin.

- **id**: Unique plugin identifier
- **plugin**: Plugin configuration object

##### `registerVisualizationPlugin(id, plugin)`
Register a new visualization plugin.

- **id**: Unique plugin identifier
- **plugin**: Plugin configuration object

#### Events

##### `functionExecuted`
Fired when a plugin function is executed successfully.

##### `visualizationRendered`
Fired when a visualization is rendered successfully.

##### `functionError`
Fired when a plugin function execution fails.

##### `visualizationError`
Fired when a visualization rendering fails.

### PluginUtils

#### Static Methods

##### `calculateGCContent(sequence)`
Calculate GC content percentage of a DNA sequence.

##### `calculateSequenceDiversity(sequences, metric)`
Calculate sequence diversity using Shannon or Simpson metrics.

##### `reverseComplement(sequence)`
Get reverse complement of a DNA sequence.

##### `translateDNA(sequence, frame)`
Translate DNA sequence to protein.

##### `findORFs(sequence, minLength)`
Find open reading frames in a DNA sequence.

## Testing

### Automated Tests

Run the Node.js test script:
```bash
node test-plugin-system.js
```

### Browser Integration Tests

Open the HTML test file in a browser:
```bash
# Serve the files with a local server
python -m http.server 8000
# Then open http://localhost:8000/test-plugin-integration.html
```

### Test Coverage

The test suite covers:
- ✅ Plugin system initialization
- ✅ Function plugin registration
- ✅ Visualization plugin registration  
- ✅ Function execution
- ✅ Visualization rendering
- ✅ Error handling
- ✅ ChatManager integration
- ✅ LLM tool calling format

## Architecture

### Design Principles

1. **Modularity**: Each component has clear responsibilities
2. **Extensibility**: Easy to add new plugins and functions
3. **Security**: Sandboxed execution environment
4. **Performance**: Efficient function execution and caching
5. **Integration**: Seamless ChatBox and LLM integration

### Security Model

- **Restricted Globals**: Limited access to browser APIs
- **Parameter Validation**: Input sanitization and type checking
- **Execution Sandbox**: Isolated execution context
- **Error Handling**: Graceful failure and error reporting

### Event Flow

```
LLM Request → ChatManager → PluginManager → Plugin Function → Result → Visualization
     ↑                                                                        ↓
ChatBox Response ← Format Result ← Event Handler ← Plugin Events ← Execution Complete
```

## Troubleshooting

### Common Issues

#### 1. Plugin Manager Not Initialized
**Problem**: `Cannot read properties of undefined (reading 'executeFunctionByName')`
**Solution**: Ensure ChatManager is properly initialized and PluginManager loaded.

#### 2. Function Not Found
**Problem**: `Unknown tool: function-name`
**Solution**: Check function name format (use `pluginId.functionName`) and verify plugin registration.

#### 3. Visualization Container Error
**Problem**: Visualization fails to render
**Solution**: Ensure container element exists and has proper dimensions.

#### 4. Browser vs Node.js Environment
**Problem**: `window is not defined` or `require is not defined`
**Solution**: The system automatically detects environment and uses appropriate loading mechanism.

### Debug Mode

Enable debug logging:
```javascript
// Set debug flag in console
localStorage.setItem('pluginDebug', 'true');
// Reload page to see detailed plugin execution logs
```

## Contributing

### Adding New Functions

1. Add function implementation to `PluginImplementations.js`
2. Register function in `PluginManager.js` built-in plugins
3. Add parameter schema and description
4. Write tests for the new function
5. Update documentation

### Adding New Visualizations

1. Add visualization implementation to `PluginVisualization.js`
2. Register visualization in `PluginManager.js`
3. Define supported data types
4. Add example usage
5. Write integration tests

### Best Practices

- **Function Naming**: Use descriptive, consistent naming
- **Parameter Validation**: Always validate input parameters
- **Error Handling**: Provide meaningful error messages
- **Documentation**: Include JSDoc comments for all functions
- **Testing**: Write comprehensive tests for new features

## License

This plugin system is part of the GenomeExplorer project and follows the same license terms.

## Support

For issues, questions, or contributions, please refer to the main GenomeExplorer repository. 