# Plugin Marketplace and Management UI Synchronization Fix

## Issue Summary

**Problem**: Plugins successfully installed via Plugin Marketplace were not appearing in Plugin Management UI.

**Symptoms**:
- ✅ Plugin installation in marketplace showed success
- ✅ Plugin saved to `localStorage` under `marketplace.installed`
- ❌ Plugin Management UI showed no installed plugins
- ❌ Plugin registry appeared empty when opening Plugin Management

## Root Cause Analysis

### Multi-Layer Synchronization Gap

The issue stemmed from **three separate storage and registry layers** that were not properly synchronized:

1. **PluginMarketplace Registry** (`marketplace.installedPlugins` Map)
   - In-memory Map tracking installed plugins
   - Persisted to localStorage via ConfigManager at `marketplace.installed`

2. **PluginManagerV2 Registry** (`pluginRegistry.function/visualization` Maps)
   - In-memory Maps containing actual plugin instances
   - Required for plugins to be functional and visible in UI

3. **Plugin Management UI State** (`pluginStates` in localStorage)
   - Separate localStorage key for UI-specific plugin states
   - Used for enabled/disabled state tracking

### The Synchronization Problem

When a plugin was installed via marketplace:

```
Install Flow:
1. Marketplace downloads plugin ✅
2. Marketplace registers with PluginManagerV2 ✅
3. Marketplace saves to its own localStorage ✅
4. Plugin appears in PluginManagerV2 registry ✅

Open Plugin Management UI:
1. UI reads from its own pluginStates (empty) ❌
2. UI calls refreshPluginLists() immediately
3. refreshPluginLists() only shows plugins in PluginManagerV2 registry
4. BUT marketplace.restoreInstalledPlugins() may not have run yet ❌
5. Result: UI shows no plugins ❌
```

### Secondary Issue: False "Already Installed" Detection

When clicking "Install" multiple times, the marketplace would return "already up to date" even if the plugin wasn't actually registered in PluginManagerV2. This happened because the check only verified presence in `marketplace.installedPlugins` Map, not actual registration status.

## Solution Implementation

### 1. Expose Marketplace Globally

**File**: `src/renderer/modules/PluginManagerV2.js`

Added marketplace to global scope for Plugin Management UI access:

```javascript
// 8. Set global reference
if (typeof window !== 'undefined') {
    window.pluginManagerV2 = this;
    // Expose marketplace globally for Plugin Management UI
    if (this.marketplace) {
        window.pluginMarketplace = this.marketplace;
    }
}
```

**Why**: Plugin Management UI needs to access marketplace instance to trigger plugin restoration.

### 2. Ensure Marketplace Restoration Before Display

**File**: `src/renderer/modules/PluginManagementUI.js`

Modified `showPluginModal()` to be async and added restoration check:

```javascript
async showPluginModal() {
    const modal = document.getElementById('pluginManagementModal');
    if (modal) {
        modal.style.display = 'block';
        
        // Before refreshing, ensure marketplace has restored installed plugins
        await this.ensureMarketplacePluginsRestored();
        
        this.refreshPluginLists();
    }
}
```

Added new method `ensureMarketplacePluginsRestored()`:

```javascript
async ensureMarketplacePluginsRestored() {
    try {
        // Check if there's a marketplace instance available
        const marketplace = window.pluginMarketplace || this.pluginManager?.marketplace;
        
        if (!marketplace) {
            console.log('📋 No marketplace instance found, skipping restore check');
            return;
        }
        
        // Wait for marketplace initialization if needed
        if (!marketplace.isInitialized && marketplace.waitForInitialization) {
            console.log('⏳ Waiting for marketplace initialization...');
            await marketplace.waitForInitialization();
        }
        
        // Check if there are installed plugins in marketplace that aren't in registry
        const marketplaceInstalled = marketplace.installedPlugins || new Map();
        const registryFunctions = this.pluginManager.pluginRegistry.function;
        const registryVisualizations = this.pluginManager.pluginRegistry.visualization;
        
        console.log('🔍 Checking plugin sync status:', {
            marketplaceCount: marketplaceInstalled.size,
            registryFunctionCount: registryFunctions.size,
            registryVisualizationCount: registryVisualizations.size
        });
        
        // If marketplace has plugins but registry is empty or missing some, restore them
        if (marketplaceInstalled.size > 0) {
            const totalRegistryCount = registryFunctions.size + registryVisualizations.size;
            
            if (totalRegistryCount < marketplaceInstalled.size) {
                console.log('🔄 Marketplace has more plugins than registry, restoring...');
                
                // Trigger marketplace restore
                if (marketplace.restoreInstalledPlugins) {
                    await marketplace.restoreInstalledPlugins();
                    console.log('✅ Marketplace plugins restored to registry');
                }
            } else {
                console.log('✅ Plugin registry is up to date with marketplace');
            }
        } else {
            console.log('📋 No installed plugins found in marketplace');
        }
        
    } catch (error) {
        console.error('❌ Error ensuring marketplace plugins restored:', error);
        // Continue anyway - don't block UI from showing
    }
}
```

**Why**: This ensures that before displaying the UI, any plugins in marketplace storage are loaded into the active plugin registry.

**How it works**:
1. Check if marketplace instance exists
2. Wait for marketplace initialization if needed
3. Compare marketplace installed count vs registry count
4. If mismatch detected, trigger `restoreInstalledPlugins()`
5. Gracefully handle errors to not block UI

### 3. Fix "Already Installed" Check

**File**: `src/renderer/modules/PluginMarketplace.js`

Enhanced the installation check to verify actual registration:

```javascript
// 2. Check if already installed and registered
if (this.installedPlugins.has(pluginId) && !options.force) {
    const installed = this.installedPlugins.get(pluginId);
    if (this.compareVersions(installed.version, plugin.version) >= 0) {
        // Also verify it's actually registered in PluginManagerV2
        const isRegistered = this.pluginManager.getPlugin(pluginId);
        
        if (isRegistered) {
            console.log(`✅ Plugin ${pluginId} is already up to date and registered`);
            return { success: true, action: 'already-installed' };
        } else {
            console.log(`⚠️ Plugin ${pluginId} is in marketplace but not registered, re-registering...`);
            // Fall through to re-install and register
        }
    }
}
```

**Why**: Prevents false "already installed" messages when plugin exists in marketplace storage but not in active registry.

## Technical Deep Dive

### Storage Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         localStorage                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  marketplaceSettings (ConfigManager)                         │
│  {                                                            │
│    marketplace: {                                             │
│      installed: {                                             │
│        "plugin-id": {                                         │
│          id, version, manifest, dependencies, ...             │
│        }                                                      │
│      }                                                        │
│    }                                                          │
│  }                                                            │
│                                                               │
│  genomeexplorer-plugin-management-settings (Plugin Mgmt UI)  │
│  {                                                            │
│    pluginStates: {                                            │
│      "plugin-id": {                                           │
│        enabled: true/false,                                   │
│        lastUsed, usageCount                                   │
│      }                                                        │
│    }                                                          │
│  }                                                            │
│                                                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      In-Memory Registries                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  PluginMarketplace.installedPlugins (Map)                    │
│  └─ Tracks what SHOULD be installed                          │
│                                                               │
│  PluginManagerV2.pluginRegistry.function (Map)               │
│  └─ Actual registered function plugins                       │
│                                                               │
│  PluginManagerV2.pluginRegistry.visualization (Map)          │
│  └─ Actual registered visualization plugins                  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Restoration Flow

```
Application Startup:
├─ PluginManagerV2.initialize()
│  ├─ Create PluginMarketplace instance
│  ├─ await marketplace.waitForInitialization()
│  │  └─ marketplace.loadInstalledPlugins()
│  │     ├─ Read from localStorage (marketplace.installed)
│  │     ├─ Populate marketplace.installedPlugins Map
│  │     └─ await restoreInstalledPlugins()
│  │        └─ For each installed plugin:
│  │           ├─ Try load from disk
│  │           ├─ Fallback to localStorage manifest
│  │           └─ pluginManager.registerPlugin()
│  │
│  └─ window.pluginMarketplace = marketplace ✨ NEW
│
User Opens Plugin Management:
├─ pluginManagementUI.showPluginModal()
│  ├─ await ensureMarketplacePluginsRestored() ✨ NEW
│  │  ├─ Check marketplace.installedPlugins.size
│  │  ├─ Check registry total count
│  │  ├─ If mismatch: await marketplace.restoreInstalledPlugins()
│  │  └─ Sync complete
│  │
│  └─ refreshPluginLists()
│     └─ Display plugins from PluginManagerV2 registry
```

## Benefits

### Immediate
- ✅ Installed plugins now appear in Plugin Management UI
- ✅ Prevents false "already installed" messages
- ✅ Automatic synchronization when opening Plugin Management

### Long-term
- 🛡️ **Defensive Programming**: Handles edge cases where registry and storage are out of sync
- 🔄 **Self-Healing**: Automatically re-registers plugins if they're missing from registry
- 📊 **Better Diagnostics**: Detailed logging for troubleshooting sync issues
- 🎯 **Consistent State**: Single source of truth with automatic reconciliation

## Testing Recommendations

### Manual Testing Flow

1. **Install Plugin via Marketplace**
   ```
   - Open Plugin Marketplace
   - Search for plugin
   - Click Install
   - Verify "installed successfully" message
   ```

2. **Verify in Plugin Management**
   ```
   - Open Plugin Management UI
   - Check console for sync logs:
     🔍 Checking plugin sync status
     ✅ Plugin registry is up to date with marketplace
   - Verify plugin appears in installed list
   ```

3. **Test Re-installation**
   ```
   - Try installing same plugin again
   - Should show "already up to date and registered"
   - Should NOT re-download
   ```

4. **Test Recovery from Desync**
   ```
   - Manually clear window.pluginManagerV2 registry (dev tools)
   - Keep marketplace.installedPlugins intact
   - Open Plugin Management
   - Should automatically restore missing plugins
   ```

### Console Log Verification

Expected logs when opening Plugin Management with 1 installed plugin:

```
⏳ Waiting for marketplace initialization...
✅ ConfigManager initialization complete, loading installed plugins...
🔍 Direct localStorage check (marketplaceSettings): {hasInstalled: true, installedCount: 1, installedIds: ['protein-interaction-network']}
📊 ConfigManager returned installed data: {hasData: true, pluginCount: 1, pluginIds: ['protein-interaction-network']}
📋 Loaded 1 installed plugins from registry
🔄 Restoring 1 installed plugins to PluginManagerV2...
✅ Restored and verified plugin: protein-interaction-network
✅ Plugin restoration complete: 1 restored, 0 failed
🔍 Checking plugin sync status: {marketplaceCount: 1, registryFunctionCount: 0, registryVisualizationCount: 1}
✅ Plugin registry is up to date with marketplace
```

## Files Modified

1. **src/renderer/modules/PluginManagerV2.js**
   - Added `window.pluginMarketplace` global exposure

2. **src/renderer/modules/PluginManagementUI.js**
   - Changed `showPluginModal()` to async
   - Added `ensureMarketplacePluginsRestored()` method

3. **src/renderer/modules/PluginMarketplace.js**
   - Enhanced `installPlugin()` to verify actual registration status
   - Added check for `pluginManager.getPlugin()` before returning "already-installed"

## Related Memory Updates

This fix addresses issues documented in:
- **Plugin Installation Persistence Requirement** (memory)
- **Plugin Registry Registration on Startup** (memory)
- **Refresh Button Should Invalidate Cache and Re-fetch from Server** (memory)

## Conclusion

The fix establishes a **synchronization bridge** between Plugin Marketplace and Plugin Management UI by:
1. Making marketplace globally accessible
2. Adding pre-display synchronization checks
3. Implementing automatic restoration on mismatch detection
4. Verifying actual registration status during installation

This ensures that the UI always reflects the true state of installed plugins, regardless of timing issues or edge cases.
