# Quick Start Guide: Testing Database Integration Plugins

## How to Test Plugins from Plugin Management UI

### For STRING Network Explorer

1. **Open Plugin Management**
   - In the application, click the Plugin Management icon (🧩)
   - Navigate to the "Installed Plugins" tab
   - Find "STRING Network Explorer" under "Visualization Plugins"

2. **Launch Interactive Test**
   - Click the blue **"Test"** button next to STRING Network Explorer
   - A new window will open with the title "Plugin Interactive Demo - STRING Network Explorer"

3. **Select Demo Dataset**
   You will see two demo options:
   
   **Option 1: Basic Demo - p53 Tumor Suppressor Network**
   - 3 proteins (TP53, MDM2, ATM)
   - 2 protein-protein interactions
   - ~100ms render time
   - Perfect for quick functionality check
   
   **Option 2: Complex Demo - DNA Damage Response Network**
   - 8 proteins involved in DNA repair
   - 8 interactions showing pathway cascade
   - ~200-300ms render time
   - Tests performance with larger networks

4. **Run the Demo**
   - Click the dataset card you want to test
   - Click the "Run Demo" button
   - Watch the network visualization render in real-time

5. **Review Results**
   The analysis panel will show:
   - ✅ Network statistics (node count, edge count)
   - ✅ Execution time
   - ✅ Database source (STRING)
   - ✅ Organism (Homo sapiens)
   - ✅ Biological pathway context

---

### For KEGG Pathway Viewer

1. **Open Plugin Management**
   - Find "KEGG Pathway Viewer" under "Visualization Plugins"
   - Click the blue **"Test"** button

2. **Select Demo Dataset**
   
   **Option 1: Basic Demo - Glycolysis Initial Steps**
   - First 3 reactions of glycolysis
   - 5 nodes (compounds + reactions)
   - KEGG compound IDs: C00031, C00668, C00085
   - KEGG reaction IDs: R00299, R00771
   
   **Option 2: Complex Demo - Complete Glycolysis Pathway**
   - Full pathway from glucose to pyruvate
   - 10 compounds, 8 reactions
   - Tests complete metabolic pathway rendering
   - KEGG pathway ID: map00010

3. **Run and Verify**
   - Click dataset → Click "Run Demo"
   - Verify KEGG compound IDs appear correctly (CXXXXX format)
   - Verify reaction nodes display properly (RXXXXX format)
   - Check pathway flow from substrate to product

---

### For EcoCyc Pathway Analyzer

1. **Open Plugin Management**
   - Find "EcoCyc Pathway Analyzer" under "Visualization Plugins"
   - Click the blue **"Test"** button

2. **Select Demo Dataset**
   
   **Option 1: Basic Demo - L-Arabinose Degradation**
   - E. coli sugar metabolism pathway
   - 5 nodes (compounds + reactions)
   - BioCyc nomenclature: L-ARABINOSE, ARAA-RXN, ARAB-RXN
   - Simple linear pathway
   
   **Option 2: Complex Demo - TCA Cycle in E. coli**
   - Complete tricarboxylic acid cycle
   - 10 TCA cycle intermediates
   - Demonstrates cyclical pathway handling
   - BioCyc organism: Escherichia coli K-12

3. **Run and Verify**
   - Click dataset → Click "Run Demo"
   - Verify BioCyc nomenclature (uppercase with hyphens)
   - Check reaction IDs end with -RXN suffix
   - Verify cyclical pathway displays correctly

---

## What to Expect

### Successful Test Indicators

✅ **Demo window opens** without popup blocking  
✅ **Dataset cards** display with descriptions  
✅ **"Run Demo" button** is clickable  
✅ **Visualization renders** within 1 second  
✅ **SVG/Canvas element** appears in viz container  
✅ **Analysis panel** shows network statistics  
✅ **Execution time** is under 500ms for basic demos  
✅ **No console errors** appear in browser DevTools  

### If Demo Window Doesn't Open

**Problem**: Browser blocked popup window

**Solution**:
1. Look for popup blocker notification in browser address bar
2. Click "Allow popups from this site"
3. Click the "Test" button again

### If Visualization Doesn't Render

**Problem**: Plugin not enabled or not installed

**Solution**:
1. Check plugin status badge shows "Enabled" (green)
2. If disabled, click "Enable" button first
3. If not installed, go to "Available Plugins" tab and install

### If Demo Data Looks Wrong

**Problem**: Plugin needs reinstallation

**Solution**:
1. Click "Uninstall" button
2. Go to "Available Plugins" tab
3. Click "Install" for the plugin
4. Return to "Installed Plugins" and test again

---

## Developer Console Verification

For developers wanting to verify the implementation:

1. **Open Browser DevTools** (F12 or Cmd+Option+I)
2. **Go to Console tab**
3. **Click "Test" button**
4. **Look for these log messages**:

```
🔗 Plugin manager attached to window for demo access
🔍 Checking for plugin manager in opener window...
✅ Plugin manager successfully loaded from opener
Dataset loaded:
  Plugin: string-network-explorer
  Demo: basic
  Nodes: 3
  Edges: 2
Plugin manager found
Rendering visualization...
Checked visualization registry: Found
Plugin loaded: STRING Network Explorer
Visualization rendered successfully!
Execution time: 143ms
```

---

## Biological Data Context

### STRING Plugin - Why p53 Pathway?

The **p53 tumor suppressor pathway** is one of the most studied pathways in cancer biology. Over 50% of human cancers have mutations in the TP53 gene, making this pathway immediately recognizable to bioinformatics researchers. The demo data includes:

- **TP53**: "Guardian of the genome" - prevents cancer formation
- **MDM2**: Negative regulator of p53 - targets it for degradation
- **ATM**: DNA damage sensor - activates p53 in response to DNA breaks

This pathway is taught in every molecular biology course and frequently appears in research papers, making it an excellent demonstration dataset.

### KEGG Plugin - Why Glycolysis?

**Glycolysis** is the most fundamental metabolic pathway, converting glucose to pyruvate. It's:

- Present in virtually all living organisms
- Taught in every biochemistry course
- One of the oldest metabolic pathways (evolved billions of years ago)
- Well-documented in KEGG database with official compound/reaction IDs

Using glycolysis ensures users immediately recognize the pathway and can verify the plugin is displaying data correctly.

### EcoCyc Plugin - Why E. coli Pathways?

**Escherichia coli K-12** is the most studied bacterial organism in biology:

- Complete genome sequenced and annotated
- EcoCyc database contains thousands of validated pathways
- Standard model organism for microbiology and systems biology
- BioCyc database family uses E. coli as reference organism

The **TCA cycle** (Krebs cycle) demo tests the plugin's ability to handle **cyclical pathways**, where the final product regenerates the starting compound.

---

## Tips for Effective Testing

### Test Both Basic and Complex Demos

- **Basic demos** verify core functionality works
- **Complex demos** test performance with realistic data sizes
- Always test both to ensure plugin handles edge cases

### Compare Execution Times

- Basic demos should render in **under 200ms**
- Complex demos should render in **under 500ms**
- If times are longer, plugin may need optimization

### Verify Biological Accuracy

- Check protein/compound names match standard nomenclature
- Verify database IDs follow official formats
- Ensure pathway flow makes biological sense

### Use DevTools Console

- Console logs provide detailed execution information
- Errors appear here if plugin has issues
- Network tab shows if plugin tries to fetch external data

---

## Next Steps After Testing

### If Tests Pass ✅

You can confidently use the plugin for your research:
1. Prepare your data in the same format as demo data
2. Use the plugin through Plugin Management or ChatBox
3. Export visualizations for publication

### If Tests Fail ❌

Report the issue with these details:
1. Which plugin failed
2. Which demo dataset (basic or complex)
3. Error message from console
4. Screenshot of the failed visualization
5. Browser version and OS

---

## Additional Resources

- [Full Implementation Documentation](file:///Users/song/Github-Repos/GenomeAIStudio_1/docs/implementation-summaries/plugin/DATABASE_PLUGINS_INTERACTIVE_TEST_IMPLEMENTATION.md)
- [Plugin System Overview](file:///Users/song/Github-Repos/GenomeAIStudio_1/docs/implementation-summaries/misc/MODERN_PLUGIN_SYSTEM_IMPLEMENTATION.md)
- [STRING Plugin README](file:///Users/song/Github-Repos/GenomeAIStudio_1/packages/marketplace-server/marketplace-data/plugins/string-network-explorer/1.0.0/README.md)
- [KEGG Plugin README](file:///Users/song/Github-Repos/GenomeAIStudio_1/packages/marketplace-server/marketplace-data/plugins/kegg-pathway-viewer/1.0.0/README.md)
- [EcoCyc Plugin README](file:///Users/song/Github-Repos/GenomeAIStudio_1/packages/marketplace-server/marketplace-data/plugins/ecocyc-pathway-analyzer/1.0.0/README.md)

---

**Status**: ✅ All three database integration plugins now support interactive testing from the Plugin Management UI!
