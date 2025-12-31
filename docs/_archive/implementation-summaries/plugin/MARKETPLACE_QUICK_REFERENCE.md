# Plugin Marketplace - Quick Reference

## Current Status ✅

**Total Plugins:** 1  
**Featured Plugin:** Protein Interaction Network Visualizer v1.8.3  
**Server:** http://localhost:3001  
**Status:** Running

## Available Plugin

### Protein Interaction Network Visualizer
- **Category:** network-analysis
- **Type:** visualization
- **Author:** NetworkBioLab
- **Rating:** ⭐⭐⭐⭐⭐ (4.9/5.0)
- **Downloads:** 8,954
- **License:** Apache-2.0
- **Tags:** protein, interaction, network, ppi, visualization, p53, pathway

**Description:**  
Interactive protein-protein interaction network analysis and visualization with real biological data

**Key Features:**
- Real biological pathway data (p53 tumor suppressor pathway)
- Interactive network visualization
- Multiple demo datasets (Basic, Complex, Performance)
- Network analysis and statistics
- Force-directed layout algorithms

**Demo Datasets:**
1. **Basic** - 3 proteins (TP53, MDM2, ATM)
2. **Complex** - 8 proteins (DNA damage response network)
3. **Performance** - 50+ proteins (large-scale network testing)

## How to Use

### 1. Open Plugin Marketplace
```
Tools → Plugin Management → Marketplace button
```

### 2. View Available Plugins
The marketplace will display the Protein Interaction Network Visualizer

### 3. Install Plugin
Click the **Install** button on the plugin card

### 4. Test Plugin
- Navigate to Plugin Management
- Find "Protein Interaction Network Visualizer"
- Click **Test** button
- Select demo dataset (Basic/Complex/Performance)
- Click **Run Demo**
- View real-time protein network visualization

### 5. Use in Analysis
The plugin integrates with the main application for protein network analysis workflows

## API Endpoints

### Get All Plugins
```bash
curl http://localhost:3001/api/v1/plugins
```

### Get Statistics
```bash
curl http://localhost:3001/api/v1/stats
```

### Get Plugin Details
```bash
curl http://localhost:3001/api/v1/plugins/protein-interaction-network
```

### Health Check
```bash
curl http://localhost:3001/api/v1/health
```

## Troubleshooting

### Marketplace Shows No Plugins
1. Verify server is running: `curl http://localhost:3001/api/v1/health`
2. Check plugin count: `curl http://localhost:3001/api/v1/stats`
3. Reload the application (Cmd+R or restart)
4. Clear cache in Plugin Marketplace configuration

### Server Not Running
```bash
cd packages/marketplace-server
npm start
```

### Reset to Clean State
```bash
# Stop server
lsof -ti:3001 | xargs kill -9

# Delete metadata cache
rm -f marketplace-data/metadata.json

# Restart
npm start
```

## Development Notes

### Adding New Plugins
Edit `plugin-marketplace-server.js` → `initializeSamplePlugins()` function

### Plugin Structure
```javascript
{
    id: 'plugin-id',
    name: 'Display Name',
    description: 'Plugin description',
    version: 'x.y.z',
    author: 'Author Name',
    category: 'category-name',
    type: 'visualization|function|utility',
    tags: ['tag1', 'tag2'],
    dependencies: [],
    rating: 4.9,
    downloads: 1000,
    status: 'published'
}
```

## Interactive Demo Integration

The Protein Interaction Network Visualizer includes **PluginRealTestDemonstrator** integration:

- Real p53 pathway data from STRING database
- Interactive dataset selection
- Live network rendering
- Statistical analysis panel
- Export functionality
- Detailed execution logging

## Recent Changes

**December 3, 2024:**
- ✅ Removed 3 sample plugins (variant-caller, rna-seq, phylo-tree)
- ✅ Retained only Protein Interaction Network Visualizer
- ✅ Updated plugin metadata with enhanced tags
- ✅ Cleared dependencies array
- ✅ Refreshed timestamps and security scan dates
- ✅ Regenerated metadata.json with clean state

## Support

For issues or questions:
1. Check server logs in terminal
2. Verify API responses with curl commands
3. Review documentation in `docs/implementation-summaries/plugin/`
4. Test with interactive demo to verify plugin functionality

---
**Last Updated:** December 3, 2024  
**Marketplace Version:** 1.1.0  
**Server Port:** 3001
