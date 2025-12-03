# Plugin Demo Window - Plugin Manager Access Fix

## Problem Analysis

### Error Encountered
```
Error: Plugin manager not available
    at runDemo (<anonymous>:82:31)
    at HTMLButtonElement.<anonymous> (<anonymous>:32:23)
```

### Root Cause
The interactive plugin demo window failed to access the plugin manager from the parent window due to the following issues:

1. **Missing Global Reference**: `this.pluginManager` in PluginManagementUI was not exposed as `window.pluginManager`, preventing child windows from accessing it via `window.opener.pluginManager`

2. **Insufficient Error Handling**: The demo script didn't provide detailed diagnostics when the plugin manager was unavailable

3. **Limited Plugin Lookup**: The code only tried `pluginManager.getPlugin()` method without checking the plugin registries directly

## Solution Implementation

### 1. Global Plugin Manager Exposure

**File**: `src/renderer/modules/PluginManagementUI.js`  
**Method**: `showRealTestDemonstration()`

```javascript
showRealTestDemonstration(pluginId, plugin, type) {
    // Make plugin manager globally accessible for the demo window
    if (!window.pluginManager) {
        window.pluginManager = this.pluginManager;
        console.log('🔗 Plugin manager attached to window for demo access');
    }
    
    // Create test window
    const testWindow = window.open('', '_blank', 'width=1400,height=900,scrollbars=yes,resizable=yes');
    
    if (!testWindow) {
        this.showMessage('Failed to open demo window. Please allow popups.', 'error');
        return;
    }
    // ... rest of implementation
}
```

**Key Changes**:
- Attach plugin manager to `window.pluginManager` before opening demo window
- Add popup blocker detection and user notification
- Enhanced console logging for debugging

### 2. Enhanced Demo Window Script

**Improved Plugin Manager Detection**:
```javascript
// Make plugin manager available from opener window
console.log('🔍 Checking for plugin manager in opener window...');

if (window.opener && window.opener.pluginManager) {
    window.pluginManager = window.opener.pluginManager;
    console.log('✅ Plugin manager successfully loaded from opener');
} else {
    console.error('❌ Plugin manager not found in opener window');
    console.log('Available in opener:', window.opener ? 
        Object.keys(window.opener).filter(k => k.includes('plugin') || k.includes('Plugin')) : 
        'No opener');
}
```

**Benefits**:
- Detailed logging of plugin manager availability
- Debug information showing available properties in opener window
- Clear success/failure indicators

### 3. Robust Plugin Retrieval

**File**: `src/renderer/modules/PluginRealTestDemonstrator.js`  
**Function**: `runDemo()`

```javascript
// Get plugin from opener window
const pluginManager = window.opener?.pluginManager || window.pluginManager;
if (!pluginManager) {
    throw new Error('Plugin manager not available. Please ensure the parent window is open.');
}

log('Plugin manager found', 'success');
log('Rendering visualization...', 'info');

// Clear previous visualization
const container = document.getElementById('vizContainer');
container.innerHTML = '';

// Get plugin instance with multiple fallback strategies
let plugin = null;

// Try to get from visualization registry first
if (pluginManager.pluginRegistry && pluginManager.pluginRegistry.visualization) {
    plugin = pluginManager.pluginRegistry.visualization.get('${pluginId}');
    log('Checked visualization registry: ' + (plugin ? 'Found' : 'Not found'), 
        plugin ? 'success' : 'info');
}

// Fallback to getPlugin method if available
if (!plugin && pluginManager.getPlugin) {
    plugin = pluginManager.getPlugin('${pluginId}');
    log('Checked getPlugin method: ' + (plugin ? 'Found' : 'Not found'), 
        plugin ? 'success' : 'info');
}

if (!plugin) {
    throw new Error('Plugin "${pluginId}" not found in plugin manager. Available plugins: ' + 
        (pluginManager.pluginRegistry?.visualization ? 
            Array.from(pluginManager.pluginRegistry.visualization.keys()).join(', ') : 
            'Unknown'));
}

log('Plugin loaded: ' + (plugin.name || '${pluginId}'), 'success');

// Render visualization with multiple method support
if (plugin.renderNetwork) {
    currentVisualization = await plugin.renderNetwork(data);
    container.appendChild(currentVisualization);
} else if (plugin.visualize) {
    currentVisualization = await plugin.visualize(data);
    if (currentVisualization instanceof HTMLElement) {
        container.appendChild(currentVisualization);
    } else {
        container.innerHTML = currentVisualization;
    }
} else {
    throw new Error('Plugin does not have renderNetwork() or visualize() method. Available methods: ' + 
        Object.keys(plugin).filter(k => typeof plugin[k] === 'function').join(', '));
}
```

**Key Improvements**:

1. **Multiple Lookup Strategies**:
   - First: Direct registry access (`pluginRegistry.visualization.get()`)
   - Second: Manager method (`getPlugin()`)
   - Clear logging at each step

2. **Detailed Error Messages**:
   - Lists available plugins when target not found
   - Shows available methods when render method missing
   - Provides actionable debugging information

3. **Multiple Render Method Support**:
   - Primary: `renderNetwork()` (specific to network plugins)
   - Fallback: `visualize()` (generic visualization method)
   - Handles both DOM elements and HTML strings

## Testing Flow

### Expected Behavior
1. User opens Plugin Management
2. Clicks "Test" on Protein Interaction Network Visualizer
3. System checks for PluginRealTestDemonstrator support
4. Attaches plugin manager to `window.pluginManager`
5. Opens demo window with interactive UI
6. Demo window accesses plugin manager via `window.opener.pluginManager`
7. User selects demo dataset (Basic/Complex/Performance)
8. Clicks "Run Demo"
9. Plugin renders actual biological network visualization
10. Results display in analysis panel

### Debug Logging Sequence
```
🔗 Plugin manager attached to window for demo access
🔍 Checking for plugin manager in opener window...
✅ Plugin manager successfully loaded from opener
Dataset loaded:
  Nodes: 3
  Edges: 2
Plugin manager found
Rendering visualization...
Checked visualization registry: Found
Plugin loaded: Protein Interaction Network Visualizer
Visualization rendered successfully!
Execution time: 45ms
```

## Error Scenarios Handled

### 1. Popup Blocked
```javascript
if (!testWindow) {
    this.showMessage('Failed to open demo window. Please allow popups.', 'error');
    return;
}
```

### 2. Plugin Manager Unavailable
```
Error: Plugin manager not available. Please ensure the parent window is open.
```
Shows in execution log with detailed context.

### 3. Plugin Not Found
```
Error: Plugin "protein-interaction-network" not found in plugin manager. 
Available plugins: phylogenetic-tree, sequence-alignment, gene-regulatory-network
```

### 4. Missing Render Method
```
Error: Plugin does not have renderNetwork() or visualize() method. 
Available methods: initialize, getData, processData, cleanup
```

## Impact

### Before Fix
- ❌ Demo window always failed with "Plugin manager not available"
- ❌ No diagnostic information
- ❌ Users couldn't test plugin functionality
- ❌ No visibility into what was wrong

### After Fix
- ✅ Demo window successfully accesses plugin manager
- ✅ Detailed logging at each step
- ✅ Multiple fallback strategies for plugin lookup
- ✅ Clear error messages with actionable information
- ✅ Users can interactively test real plugin functionality
- ✅ Demonstrates actual biological data visualization

## Files Modified

1. **`src/renderer/modules/PluginManagementUI.js`**
   - Added `window.pluginManager` exposure
   - Enhanced demo window creation with error handling
   - Improved logging for debugging

2. **`src/renderer/modules/PluginRealTestDemonstrator.js`**
   - Robust plugin retrieval with multiple strategies
   - Detailed error messages with context
   - Support for multiple render methods
   - Enhanced execution logging

## Technical Considerations

### Window Communication
- Parent-child window communication via `window.opener`
- Global reference ensures accessibility
- Fallback to `window.pluginManager` if opener unavailable

### Plugin Registry Access
- Direct registry access is more reliable than method calls
- Visualization plugins stored in `pluginRegistry.visualization`
- Uses Map.get() for O(1) lookup

### Method Polymorphism
- Different plugins may use different render methods
- `renderNetwork()` for network-specific visualizations
- `visualize()` for generic visualization plugins
- Graceful handling of both DOM and HTML string returns

## Future Enhancements

1. **Plugin Communication API**: Create dedicated API for plugin-demo window communication
2. **Demo State Persistence**: Save demo preferences and results
3. **Multi-Plugin Demos**: Compare multiple plugins side-by-side
4. **Custom Data Input**: Allow users to upload their own datasets
5. **Performance Profiling**: Add detailed performance metrics to demo

## Conclusion

The fix successfully resolves the plugin manager accessibility issue in demo windows by establishing a proper communication channel between parent and child windows. Enhanced error handling and logging provide excellent debugging capabilities, while multiple fallback strategies ensure robust plugin retrieval and execution. The implementation now enables users to interactively experience real plugin functionality with actual biological data, significantly improving the plugin testing and demonstration experience.

---
**Implementation Date**: December 3, 2024  
**Status**: ✅ Fixed and Enhanced  
**Impact**: High - Enables interactive plugin demonstrations with real biological data
