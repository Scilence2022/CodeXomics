# Plugin Demo Architecture - Separation of Concerns

## Overview

This document defines the architectural pattern for plugin interactive demo testing, implementing a **delegated architecture** where `PluginRealTestDemonstrator.js` serves as a unified entry point that dynamically discovers and delegates to plugin-specific demo scripts.

## Architecture Principles

### 1. Plugin Autonomy

Each plugin owns its demo data, test scenarios, and execution logic within its own directory structure.

### 2. Dynamic Discovery

The central demonstrator automatically discovers and loads plugin demo modules without hardcoded references.

### 3. Separation of Concerns

- **PluginRealTestDemonstrator.js**: UI framework, orchestration, common utilities
- **Plugin demo.js**: Plugin-specific data, scenarios, validation logic

### 4. Backward Compatibility

Supports both legacy centralized demos and new modular demos during migration.

## Directory Structure

```
packages/marketplace-server/marketplace-data/plugins/
├── string-network-explorer/
│   └── 1.0.0/
│       ├── index.js              (Main plugin class)
│       ├── manifest.json          (Plugin metadata)
│       ├── README.md              (Documentation)
│       └── demo.js                (Demo script - NEW)
│
├── kegg-pathway-viewer/
│   └── 1.0.0/
│       ├── index.js
│       ├── manifest.json
│       ├── README.md
│       └── demo.js                (Demo script - NEW)
│
└── ecocyc-pathway-analyzer/
    └── 1.0.0/
        ├── index.js
        ├── manifest.json
        ├── README.md
        └── demo.js                (Demo script - NEW)
```

## Plugin Demo Script Interface

Each plugin's `demo.js` must export a standard interface:

```javascript
/**
 * Plugin Demo Script Interface
 * @module PluginDemo
 */

class PluginDemo {
  constructor(pluginInstance) {
    this.plugin = pluginInstance;
    this.demoData = this.initializeDemoData();
  }

  /**
   * Returns demo datasets for this plugin
   * @returns {Object} Map of demo scenarios
   */
  initializeDemoData() {
    return {
      basic: {
        name: 'Demo Name',
        description: 'Demo description',
        searchConfig: {
          /* config */
        },
        isRealTimeSearch: true,
      },
      complex: {
        /* ... */
      },
      advanced: {
        /* ... */
      },
    };
  }

  /**
   * Execute demo with given configuration
   * @param {string} demoKey - Demo scenario identifier
   * @param {Function} logger - Logging callback
   * @returns {Promise<Object>} Demo execution result
   */
  async executeDemo(demoKey, logger) {
    const demo = this.demoData[demoKey];
    if (!demo) {
      throw new Error(`Demo "${demoKey}" not found`);
    }

    // Plugin-specific execution logic
    logger(`Starting demo: ${demo.name}`, 'info');

    // Real-time data fetching
    if (demo.isRealTimeSearch) {
      return await this.fetchRealTimeData(demo.searchConfig, logger);
    }

    // Static data
    return { data: demo.data };
  }

  /**
   * Fetch real-time data from external database
   * @param {Object} config - Search configuration
   * @param {Function} logger - Logging callback
   * @returns {Promise<Object>} Search result
   */
  async fetchRealTimeData(config, logger) {
    // Plugin-specific API calls
    throw new Error('Must be implemented by plugin');
  }

  /**
   * Validate demo result
   * @param {Object} result - Demo execution result
   * @returns {Object} Validation report
   */
  validateResult(result) {
    return {
      isValid: true,
      nodeCount: result.data?.nodes?.length || 0,
      edgeCount: result.data?.edges?.length || 0,
      warnings: [],
      errors: [],
    };
  }
}

module.exports = PluginDemo;
```

## Demonstrator Orchestrator (Updated)

`PluginRealTestDemonstrator.js` becomes a **discovery and orchestration layer**:

```javascript
class PluginRealTestDemonstrator {
  constructor(pluginManager) {
    this.pluginManager = pluginManager;
    this.demoModules = new Map(); // Plugin demo modules
    this.legacyDemoData = this.initializeLegacyDemoData(); // Backward compatibility
  }

  /**
   * Load plugin demo module dynamically
   */
  async loadPluginDemo(pluginId, pluginPath) {
    try {
      const demoPath = `${pluginPath}/demo.js`;
      const DemoClass = await import(demoPath);

      const plugin = this.pluginManager.getPlugin(pluginId);
      const demoInstance = new DemoClass(plugin);

      this.demoModules.set(pluginId, demoInstance);
      console.log(`✅ Loaded demo module for ${pluginId}`);

      return demoInstance;
    } catch (error) {
      console.warn(`⚠️ No demo module found for ${pluginId}, using legacy data`);
      return null;
    }
  }

  /**
   * Get demo data - tries plugin demo first, falls back to legacy
   */
  async getDemoData(pluginId) {
    // Try plugin-specific demo module
    let demoModule = this.demoModules.get(pluginId);

    if (!demoModule) {
      demoModule = await this.loadPluginDemo(pluginId, this.getPluginPath(pluginId));
    }

    if (demoModule) {
      return demoModule.demoData;
    }

    // Fallback to legacy centralized data
    return this.legacyDemoData[pluginId] || {};
  }

  /**
   * Execute demo - delegates to plugin demo module
   */
  async executeDemo(pluginId, demoKey, logger) {
    const demoModule = this.demoModules.get(pluginId);

    if (demoModule) {
      // Use plugin's own demo execution
      return await demoModule.executeDemo(demoKey, logger);
    } else {
      // Fallback to legacy execution
      return await this.executeLegacyDemo(pluginId, demoKey, logger);
    }
  }
}
```

## Migration Strategy

### Phase 1: Infrastructure (Week 1)

1. ✅ Update `PluginRealTestDemonstrator.js` with dynamic discovery logic
2. ✅ Create base `PluginDemoBase.js` abstract class
3. ✅ Add demo module loading to plugin installation process
4. ✅ Implement fallback mechanism for backward compatibility

### Phase 2: Plugin Migration (Week 2)

1. ✅ Create `demo.js` for STRING Network Explorer
2. ✅ Create `demo.js` for KEGG Pathway Viewer
3. ✅ Create `demo.js` for EcoCyc Pathway Analyzer
4. ✅ Test each plugin demo independently

### Phase 3: Legacy Removal (Week 3)

1. ⏳ Migrate all remaining plugins
2. ⏳ Remove legacy demo data from `PluginRealTestDemonstrator.js`
3. ⏳ Update documentation
4. ⏳ Add plugin demo validation to marketplace submission process

## Benefits

### For Plugin Developers

- **Autonomy**: Define demos in plugin directory
- **Testing**: Test demos independently during development
- **Flexibility**: Use plugin-specific validation and data generation
- **Version Control**: Demo versioning tied to plugin version

### For System Maintainers

- **Scalability**: New plugins auto-discovered
- **Maintainability**: Changes isolated to plugin directories
- **Debugging**: Easier to identify plugin-specific issues
- **Code Quality**: Smaller, focused modules

### For Users

- **Consistency**: All plugins follow same demo interface
- **Quality**: Plugins ship with tested demos
- **Documentation**: Demos serve as live examples

## Security Considerations

1. **Sandboxing**: Plugin demos run in same sandbox as plugin code
2. **Resource Limits**: Enforce timeout/memory limits on demo execution
3. **Validation**: Validate demo results before rendering
4. **Error Isolation**: Plugin demo errors don't crash demonstrator

## Testing Requirements

Each plugin demo must include:

1. **Unit Tests**: Test demo data generation
2. **Integration Tests**: Test with real plugin API calls
3. **Performance Tests**: Ensure demos complete within timeout
4. **Validation Tests**: Verify result data structure

## Documentation Requirements

Each `demo.js` must include:

1. **JSDoc Comments**: Full API documentation
2. **README Section**: Usage examples in plugin README.md
3. **Demo Metadata**: Name, description, complexity level
4. **Expected Results**: Sample output for validation

## Example: STRING Network Explorer Demo

See implementation in:

- `packages/marketplace-server/marketplace-data/plugins/string-network-explorer/1.0.0/demo.js`

## Future Enhancements

1. **Demo Marketplace**: Share demo scenarios between users
2. **Interactive Builder**: Visual demo configuration builder
3. **Benchmark Mode**: Use demos for performance testing
4. **A/B Testing**: Compare plugin versions via demo results
5. **AI Integration**: AI generates demo scenarios automatically

## References

- Plugin Architecture: `/docs/architecture/PLUGIN_SYSTEM.md`
- ExtensionContext API: `/src/renderer/modules/core/ExtensionContext.js`
- Plugin Manifest Schema: `/docs/schemas/plugin-manifest-schema.json`
