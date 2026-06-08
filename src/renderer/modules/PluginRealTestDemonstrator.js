/**
 * Plugin Real Test Demonstrator
 * Showcases actual plugin functionality with interactive demonstrations
 *
 * This class serves as a UNIFIED ENTRY POINT that:
 * 1. Dynamically loads plugin-specific demo scripts (plugin/demo.js)
 * 2. Delegates demo execution to plugin-owned demo modules
 * 3. Provides UI framework and common utilities
 * 4. Requires PluginPathResolver to be initialized before use
 *
 * @version 4.0.0 - Strict Modular Architecture (No Legacy Fallback)
 * @author GenomeAIStudio Team
 */

class PluginRealTestDemonstrator {
  constructor(pluginManager) {
    this.pluginManager = pluginManager;
    this.demoModules = new Map(); // Plugin-specific demo modules
    this.testResults = new Map();
    // Note: pluginBasePath removed - now using dynamic path resolution per plugin
  }

  getPathApi() {
    if (typeof window !== 'undefined' && window.path) {
      return window.path;
    }

    return {
      join: (...parts) => parts.filter(Boolean).join('/').replace(/\/+/g, '/'),
      dirname: filePath => {
        const normalized = String(filePath || '').replace(/\\/g, '/');
        const index = normalized.lastIndexOf('/');
        return index <= 0 ? (index === 0 ? '/' : '.') : normalized.slice(0, index);
      },
    };
  }

  async checkFileExists(filePath) {
    const api = typeof window !== 'undefined' ? window.electronAPI : null;
    if (api?.checkPluginFileExists) {
      return Boolean(await api.checkPluginFileExists(filePath));
    }
    if (api?.checkFileExists) {
      return Boolean(await api.checkFileExists(filePath));
    }
    return false;
  }

  async looksLikeProjectRoot(dir) {
    const path = this.getPathApi();
    return (
      (await this.checkFileExists(path.join(dir, 'package.json'))) &&
      (await this.checkFileExists(path.join(dir, 'src', 'renderer', 'modules')))
    );
  }

  async getProjectBasePath() {
    const path = this.getPathApi();
    const api = typeof window !== 'undefined' ? window.electronAPI : null;
    const appPathsResult = api?.getAppPaths ? await api.getAppPaths() : null;
    const candidatePaths = [
      appPathsResult?.paths?.appPath,
      path.dirname(path.dirname(path.dirname(appPathsResult?.paths?.userData || ''))),
    ].filter(Boolean);

    for (const candidatePath of candidatePaths) {
      if (await this.looksLikeProjectRoot(candidatePath)) {
        return candidatePath;
      }
    }

    throw new Error('Unable to resolve application project root for plugin demo loading');
  }

  /**
   * Resolve demo.js path for a plugin
   * Searches multiple locations: installed plugins, marketplace source, built-in plugins
   * @param {string} pluginId - Plugin identifier
   * @param {string} version - Plugin version
   * @returns {string} Absolute path to demo.js
   * @throws {Error} If demo.js cannot be found in any location
   */
  async resolvePluginDemoPath(pluginId, version) {
    const path = this.getPathApi();
    const basePath = await this.getProjectBasePath();

    console.log(`🔍 Resolving demo path for ${pluginId}@${version}`);
    console.log(`  Base path: ${basePath}`);
    console.log(`  Has package.json: ${await this.checkFileExists(path.join(basePath, 'package.json'))}`);

    // Define search locations in priority order
    const searchLocations = [
      // 1. User-installed plugins directory
      path.join(basePath, 'src/renderer/modules/Plugins/UserInstalled', pluginId, version, 'demo.js'),

      // 2. Marketplace server source (development) - with version
      path.join(basePath, 'packages/marketplace-server/marketplace-data/plugins', pluginId, version, 'demo.js'),

      // 3. Built-in plugins directory
      path.join(basePath, 'src/renderer/modules/Plugins', pluginId, version, 'demo.js'),

      // 4. Marketplace without version subdirectory (fallback)
      path.join(basePath, 'packages/marketplace-server/marketplace-data/plugins', pluginId, 'demo.js'),
    ];

    // Search for demo.js in each location
    for (const demoPath of searchLocations) {
      console.log(`  Checking: ${demoPath}`);
      try {
        if (await this.checkFileExists(demoPath)) {
          console.log(`✅ Found demo.js at: ${demoPath}`);
          return demoPath;
        }
      } catch (error) {
        console.log(`  ⚠️ Error checking ${demoPath}:`, error.message);
      }
    }

    // If PathResolver is available, try its paths too
    const pathResolver = this.pluginManager?.pathResolver;
    if (pathResolver && pathResolver._isInitialized) {
      const userPluginsPath = pathResolver.getUserPluginsPath();
      const builtinPluginsPath = pathResolver.getBuiltinPluginsPath();

      const resolverPaths = [
        path.join(basePath, userPluginsPath, pluginId, version, 'demo.js'),
        path.join(basePath, builtinPluginsPath, pluginId, version, 'demo.js'),
      ];

      for (const demoPath of resolverPaths) {
        if (!searchLocations.includes(demoPath)) {
          console.log(`  Checking (resolver): ${demoPath}`);
          try {
            if (await this.checkFileExists(demoPath)) {
              console.log(`✅ Found demo.js at: ${demoPath}`);
              return demoPath;
            }
          } catch (error) {
            console.log(`  ⚠️ Error checking ${demoPath}:`, error.message);
          }
        }
      }
    }

    // Not found in any location
    throw new Error(
      `Demo file not found for plugin "${pluginId}@${version}".\n` +
        `Searched locations:\n` +
        searchLocations.map(p => `  - ${p}`).join('\n') +
        `\nEnsure demo.js exists in one of these locations.`
    );
  }

  /**
   * Dynamically load plugin demo module
   * @param {string} pluginId - Plugin identifier
   * @returns {Promise<Object|null>} Demo module instance or null
   */
  async loadPluginDemo(pluginId) {
    // Check if already loaded
    if (this.demoModules.has(pluginId)) {
      return this.demoModules.get(pluginId);
    }

    try {
      // Get plugin from registry to access version
      let plugin = null;
      if (this.pluginManager.pluginRegistry) {
        plugin =
          this.pluginManager.pluginRegistry.visualization.get(pluginId) ||
          this.pluginManager.pluginRegistry.function.get(pluginId);
      }

      if (!plugin) {
        console.warn(`⚠️ Plugin ${pluginId} not found in registry, cannot load demo module`);
        return null;
      }

      // Resolve path to plugin demo script - will throw if PathResolver not ready
      const version = plugin.version || '1.0.0';
      const demoPath = await this.resolvePluginDemoPath(pluginId, version);

      console.log(`🔍 Attempting to load demo module: ${demoPath}`);

      // Dynamic import (for ES modules)
      let DemoClass;
      try {
        // Try Node.js require() for Electron renderer process
        console.log(`  Trying require() for installed plugin demo...`);
        DemoClass = require(demoPath);

        // Handle ES module default export
        if (DemoClass && DemoClass.__esModule && DemoClass.default) {
          DemoClass = DemoClass.default;
        }
      } catch (requireError) {
        console.log(`  require() failed: ${requireError.message}`);
        console.log(`  Trying browser-style fetch fallback...`);

        try {
          // Fallback: Try browser-style script loading
          const response = await fetch(`file://${demoPath}`);
          if (!response.ok) throw new Error('Demo file not found via fetch');

          const scriptContent = await response.text();
          // eslint-disable-next-line no-eval -- intentional: dynamically loads a plugin demo script to define its class
          eval(scriptContent); // Execute script to define class

          // Get class from global scope based on plugin ID
          const className = this.getDemoClassName(pluginId);
          DemoClass = window[className];

          if (!DemoClass) {
            throw new Error(`Demo class ${className} not found after loading`);
          }
        } catch (fetchError) {
          throw new Error(`Both require() and fetch() failed. Demo file may not exist at: ${demoPath}`);
        }
      }

      // Get plugin instance (from _instance property stored during installation)
      const pluginInstance = plugin._instance || plugin.instance || plugin;

      // Instantiate demo module
      const demoInstance = new DemoClass(pluginInstance);
      this.demoModules.set(pluginId, demoInstance);

      console.log(`✅ Successfully loaded demo module for ${pluginId}`);
      console.log(`  Demo scenarios: ${Object.keys(demoInstance.demoData).join(', ')}`);

      return demoInstance;
    } catch (error) {
      // Re-throw initialization errors with clear context
      if (error.message.includes('PluginPathResolver not initialized')) {
        throw new Error(
          `Cannot load plugin demo: ${error.message}\n` +
            `Plugin: ${pluginId}\n` +
            `Please ensure the plugin system is fully initialized before running tests.`
        );
      }

      // Re-throw other errors with plugin context
      throw new Error(`Failed to load demo module for plugin "${pluginId}": ${error.message}`);
    }
  }

  /**
   * Get demo class name from plugin ID
   */
  getDemoClassName(pluginId) {
    const classMap = {
      'string-network-explorer': 'STRINGNetworkDemo',
      'kegg-pathway-viewer': 'KEGGPathwayDemo',
      'ecocyc-pathway-analyzer': 'EcoCycPathwayDemo',
      'protein-interaction-network': 'ProteinNetworkDemo',
    };
    return classMap[pluginId] || null;
  }

  /**
   * Get demo data for plugin - requires plugin-specific demo.js
   * @param {string} pluginId - Plugin identifier
   * @returns {Promise<Object>} Demo scenarios
   * @throws {Error} If demo module cannot be loaded
   */
  async getDemoData(pluginId) {
    // Load plugin-specific demo module (will throw if not available)
    const demoModule = await this.loadPluginDemo(pluginId);

    if (!demoModule || !demoModule.demoData) {
      throw new Error(
        `Plugin "${pluginId}" demo module loaded but does not provide demoData. ` +
          `Ensure the demo.js file exports a class with a demoData property.`
      );
    }

    console.log(`📦 Using modular demo data for ${pluginId}`);
    return demoModule.demoData;
  }

  /**
   * Generate interactive test interface for plugin
   * Now async to support dynamic demo loading
   */
  async generateInteractiveTestUI(pluginId, plugin, type) {
    const demoSets = await this.getDemoData(pluginId);

    return `
            <div class="real-test-container">
                <div class="test-header-banner">
                    <div class="banner-icon">
                        <i class="fas fa-vial"></i>
                    </div>
                    <div class="banner-content">
                        <h2>Interactive Plugin Demonstration</h2>
                        <p>Experience real ${plugin.name} functionality with biological data</p>
                        <span class="demo-architecture-badge">🔌 Modular Demo System v3.0</span>
                    </div>
                </div>

                <div class="demo-selector">
                    <h3><i class="fas fa-database"></i> Choose Demo Dataset</h3>
                    <div class="demo-options">
                        ${Object.entries(demoSets)
                          .map(
                            ([key, demo]) => `
                            <div class="demo-option" data-demo-key="${key}">
                                <input type="radio" name="demo-select" id="demo-${key}" value="${key}" ${key === 'basic' ? 'checked' : ''}>
                                <label for="demo-${key}">
                                    <strong>${demo.name}</strong>
                                    <span class="demo-desc">${demo.description}</span>
                                    ${demo.complexity ? `<span class="complexity-badge complexity-${demo.complexity}">${demo.complexity}</span>` : ''}
                                    ${demo.isRealTimeSearch ? '<span class="realtime-badge">⚡ Real-time</span>' : ''}
                                </label>
                            </div>
                        `
                          )
                          .join('')}
                    </div>
                </div>

                <div class="demo-controls">
                    <button class="demo-btn demo-btn-primary" id="runDemoBtn">
                        <i class="fas fa-play"></i> Run Demo
                    </button>
                    <button class="demo-btn demo-btn-secondary" id="viewDataBtn">
                        <i class="fas fa-code"></i> View Data
                    </button>
                    <button class="demo-btn demo-btn-info" id="exportResultBtn" disabled>
                        <i class="fas fa-download"></i> Export Result
                    </button>
                </div>

                <div class="demo-output-area">
                    <div class="output-header">
                        <h3><i class="fas fa-chart-bar"></i> Visualization Output</h3>
                        <div class="output-stats" id="outputStats"></div>
                    </div>
                    <div class="visualization-container" id="vizContainer">
                        <div class="placeholder-message">
                            <i class="fas fa-info-circle"></i>
                            <p>Click "Run Demo" to visualize the selected dataset</p>
                        </div>
                    </div>
                </div>

                <div class="demo-results-panel">
                    <div class="results-tabs">
                        <button class="result-tab active" data-tab="execution">
                            <i class="fas fa-terminal"></i> Execution Log
                        </button>
                        <button class="result-tab" data-tab="analysis">
                            <i class="fas fa-chart-line"></i> Analysis
                        </button>
                        <button class="result-tab" data-tab="data">
                            <i class="fas fa-table"></i> Data Details
                        </button>
                    </div>
                    
                    <div class="results-content">
                        <div class="result-panel active" id="execution-panel">
                            <pre class="execution-log" id="executionLog">Ready to run demo...</pre>
                        </div>
                        <div class="result-panel" id="analysis-panel">
                            <div id="analysisContent">Run a demo to see analysis results</div>
                        </div>
                        <div class="result-panel" id="data-panel">
                            <pre class="data-display" id="dataDisplay">Select a demo to view data structure</pre>
                        </div>
                    </div>
                </div>
            </div>
        `;
  }

  /**
   * Generate styles for real test UI
   */
  generateTestStyles() {
    return `
            <style>
                .real-test-container {
                    padding: 20px;
                    background: #f8f9fa;
                    min-height: 100vh;
                }

                .test-header-banner {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 30px;
                    border-radius: 12px;
                    margin-bottom: 30px;
                    display: flex;
                    align-items: center;
                    gap: 20px;
                    box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);
                }

                .banner-icon {
                    font-size: 48px;
                    opacity: 0.9;
                }

                .banner-content h2 {
                    margin: 0 0 8px 0;
                    font-size: 28px;
                    font-weight: 600;
                }

                .banner-content p {
                    margin: 0;
                    opacity: 0.9;
                    font-size: 16px;
                }

                .demo-architecture-badge {
                    display: inline-block;
                    background: rgba(255, 255, 255, 0.2);
                    padding: 4px 12px;
                    border-radius: 12px;
                    font-size: 12px;
                    margin-top: 8px;
                }

                .complexity-badge {
                    display: inline-block;
                    padding: 2px 8px;
                    border-radius: 10px;
                    font-size: 11px;
                    margin-left: 8px;
                    font-weight: 600;
                }

                .complexity-basic { background: #48bb78; color: white; }
                .complexity-complex { background: #4299e1; color: white; }
                .complexity-advanced { background: #ed8936; color: white; }
                .complexity-performance { background: #e53e3e; color: white; }

                .realtime-badge {
                    display: inline-block;
                    padding: 2px 8px;
                    border-radius: 10px;
                    font-size: 11px;
                    margin-left: 4px;
                    background: #9f7aea;
                    color: white;
                    font-weight: 600;
                }

                .demo-selector {
                    background: white;
                    padding: 25px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }

                .demo-selector h3 {
                    margin: 0 0 20px 0;
                    color: #2d3748;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .demo-options {
                    display: grid;
                    gap: 12px;
                }

                .demo-option {
                    padding: 16px;
                    border: 2px solid #e2e8f0;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .demo-option:hover {
                    border-color: #667eea;
                    background: #f7fafc;
                }

                .demo-option input[type="radio"] {
                    margin-right: 12px;
                }

                .demo-option label {
                    cursor: pointer;
                    display: block;
                }

                .demo-option label strong {
                    display: block;
                    color: #2d3748;
                    margin-bottom: 4px;
                }

                .demo-desc {
                    color: #718096;
                    font-size: 14px;
                }

                .demo-controls {
                    display: flex;
                    gap: 12px;
                    margin-bottom: 20px;
                }

                .demo-btn {
                    padding: 12px 24px;
                    border: none;
                    border-radius: 6px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    transition: all 0.2s;
                }

                .demo-btn-primary {
                    background: #667eea;
                    color: white;
                }

                .demo-btn-primary:hover:not(:disabled) {
                    background: #5568d3;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
                }

                .demo-btn-secondary {
                    background: #718096;
                    color: white;
                }

                .demo-btn-info {
                    background: #4299e1;
                    color: white;
                }

                .demo-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .demo-output-area {
                    background: white;
                    border-radius: 8px;
                    padding: 25px;
                    margin-bottom: 20px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }

                .output-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                }

                .output-header h3 {
                    margin: 0;
                    color: #2d3748;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .output-stats {
                    font-size: 14px;
                    color: #718096;
                }

                .visualization-container {
                    min-height: 400px;
                    border: 2px dashed #e2e8f0;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #f7fafc;
                }

                .placeholder-message {
                    text-align: center;
                    color: #a0aec0;
                }

                .placeholder-message i {
                    font-size: 48px;
                    margin-bottom: 16px;
                }

                .demo-results-panel {
                    background: white;
                    border-radius: 8px;
                    overflow: hidden;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }

                .results-tabs {
                    display: flex;
                    background: #f7fafc;
                    border-bottom: 1px solid #e2e8f0;
                }

                .result-tab {
                    flex: 1;
                    padding: 16px;
                    border: none;
                    background: none;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 600;
                    color: #718096;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                }

                .result-tab:hover {
                    background: #edf2f7;
                }

                .result-tab.active {
                    color: #667eea;
                    background: white;
                    border-bottom: 2px solid #667eea;
                }

                .results-content {
                    padding: 25px;
                }

                .result-panel {
                    display: none;
                }

                .result-panel.active {
                    display: block;
                }

                .execution-log, .data-display {
                    background: #2d3748;
                    color: #a0aec0;
                    padding: 16px;
                    border-radius: 6px;
                    font-family: 'Courier New', monospace;
                    font-size: 13px;
                    line-height: 1.6;
                    overflow-x: auto;
                    max-height: 400px;
                    overflow-y: auto;
                }

                #analysisContent {
                    color: #2d3748;
                }

                .analysis-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 16px;
                    margin-top: 16px;
                }

                .analysis-card {
                    background: #f7fafc;
                    padding: 16px;
                    border-radius: 8px;
                    border-left: 4px solid #667eea;
                }

                .analysis-card h4 {
                    margin: 0 0 8px 0;
                    color: #718096;
                    font-size: 12px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .analysis-card .value {
                    font-size: 24px;
                    font-weight: 700;
                    color: #2d3748;
                }
            </style>
        `;
  }

  /**
   * Generate interactive test script
   * Updated to support modular demo execution
   */
  async generateTestScript(pluginId, plugin, type) {
    // Pre-process demo data: generators cannot be serialized to JSON,
    // so we must execute them and store the result as static data
    const rawDemoData = await this.getDemoData(pluginId);
    const processedDemoData = {};

    for (const [key, demo] of Object.entries(rawDemoData)) {
      if (demo.generator && typeof demo.generator === 'function') {
        // Execute generator and store result as static data
        console.log(`📊 Pre-generating data for demo: ${demo.name}`);
        // Preserve all demo properties except generator, replace with generated data
        processedDemoData[key] = {
          ...demo, // Spread all existing properties (name, description, complexity, etc.)
          data: demo.generator(), // Execute the generator and store result
          generator: undefined, // Remove non-serializable generator function
        };
        // Clean up undefined to reduce JSON size
        delete processedDemoData[key].generator;
      } else if (demo.networkData) {
        // Demo has direct networkData property, use it as data
        processedDemoData[key] = {
          ...demo,
          data: demo.networkData, // Map networkData to data for consistency
        };
      } else {
        // Keep static data as-is
        processedDemoData[key] = demo;
      }
    }

    // Check if modular demo is available
    const hasModularDemo = this.demoModules.has(pluginId);

    const demoDataJSON = JSON.stringify(processedDemoData);

    return `
            const demoData = ${demoDataJSON};
            const pluginId = '${pluginId}';
            const hasModularDemo = ${hasModularDemo};
            let currentVisualization = null;
            let lastExecution = null;

            // Tab switching
            document.querySelectorAll('.result-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    const tabName = tab.dataset.tab;
                    document.querySelectorAll('.result-tab').forEach(t => t.classList.remove('active'));
                    document.querySelectorAll('.result-panel').forEach(p => p.classList.remove('active'));
                    tab.classList.add('active');
                    document.getElementById(tabName + '-panel').classList.add('active');
                });
            });

            // Demo selection
            document.querySelectorAll('input[name="demo-select"]').forEach(radio => {
                radio.addEventListener('change', (e) => {
                    const demoKey = e.target.value;
                    updateDataDisplay(demoKey);
                });
            });

            // Run demo button
            document.getElementById('runDemoBtn').addEventListener('click', async () => {
                const selectedDemo = document.querySelector('input[name="demo-select"]:checked').value;
                await runDemo(selectedDemo);
            });

            // View data button
            document.getElementById('viewDataBtn').addEventListener('click', () => {
                const dataPanelTab = document.querySelector('.result-tab[data-tab="data"]');
                dataPanelTab.click();
            });

            // Export result button
            document.getElementById('exportResultBtn').addEventListener('click', () => {
                if (lastExecution) {
                    exportResult(lastExecution);
                }
            });

            // Update data display
            function updateDataDisplay(demoKey) {
                const demo = demoData[demoKey];
                if (!demo) return;
                
                const dataDisplay = document.getElementById('dataDisplay');
                
                if (demo.isRealTimeSearch && demo.searchConfig) {
                    // Display search configuration for real-time demos
                    const displayData = {
                        demoType: 'Real-Time STRING Search',
                        searchConfiguration: demo.searchConfig,
                        note: 'This demo will fetch live data from STRING database when executed'
                    };
                    dataDisplay.textContent = JSON.stringify(displayData, null, 2);
                } else {
                    // Display static data
                    const data = demo.generator ? demo.generator() : demo.data;
                    dataDisplay.textContent = JSON.stringify(data, null, 2);
                }
            }

            // Run demo
            async function runDemo(demoKey) {
                const demo = demoData[demoKey];
                if (!demo) {
                    log('Demo not found: ' + demoKey, 'error');
                    return;
                }

                log('='.repeat(60), 'info');
                log('Starting Demo: ' + demo.name, 'info');
                log('='.repeat(60), 'info');
                
                const startTime = Date.now();
                
                try {
                    let data;
                    
                    // Check plugin type and handle real-time search appropriately
                    if (demo.isRealTimeSearch && demo.searchConfig) {
                        // Get plugin manager first (common for all real-time searches)
                        const pluginManager = window.opener?.pluginManager || window.pluginManager || window.opener?.pluginManagerV2 || window.pluginManagerV2;
                        if (!pluginManager) {
                            throw new Error('Plugin manager not available. Please ensure the parent window is open.');
                        }
                        log('✅ Plugin manager found', 'success');
                        
                        // Route to appropriate handler based on plugin ID
                        if ('${pluginId}' === 'string-network-explorer') {
                            // STRING Database Search
                            log('🔍 Fetching real-time data from STRING database...', 'info');
                            log('  Proteins: ' + demo.searchConfig.proteins.join(', '), 'info');
                            log('  Species: ' + demo.searchConfig.species + ' (Homo sapiens)', 'info');
                            log('  Required Score: ' + demo.searchConfig.requiredScore, 'info');
                        
                        // Get STRING plugin from visualization registry
                        const stringPlugin = pluginManager.pluginRegistry.visualization.get('string-network-explorer');
                        if (!stringPlugin) {
                            throw new Error('STRING Network Explorer plugin not found in visualization registry');
                        }
                        
                        log('✅ STRING plugin found in registry', 'success');
                        
                        // Debug: Log plugin structure
                        log('🔧 Plugin structure:', 'info');
                        log('  - Has _instance: ' + (!!stringPlugin._instance), 'info');
                        log('  - Has _commandHandlers: ' + (!!stringPlugin._commandHandlers), 'info');
                        log('  - Has executor: ' + (!!stringPlugin.executor), 'info');
                        
                        if (stringPlugin._commandHandlers) {
                            log('  - Command handlers count: ' + stringPlugin._commandHandlers.size, 'info');
                            log('  - Commands: ' + Array.from(stringPlugin._commandHandlers.keys()).join(', '), 'info');
                        }
                        
                        if (stringPlugin._instance) {
                            log('  - Instance methods: ' + Object.getOwnPropertyNames(Object.getPrototypeOf(stringPlugin._instance)).filter(m => m !== 'constructor').join(', '), 'info');
                        }
                        
                        log('📡 Calling STRING search method...', 'info');
                        
                        // Try to execute command via stored handler
                        let searchResult = null;
                        
                        if (stringPlugin._commandHandlers && stringPlugin._commandHandlers.has('string-explorer.search')) {
                            // Use stored command handler
                            log('  Using stored command handler', 'info');
                            const commandHandler = stringPlugin._commandHandlers.get('string-explorer.search');
                            searchResult = await commandHandler(demo.searchConfig);
                        } else if (stringPlugin._instance && typeof stringPlugin._instance.searchProteinInteractions === 'function') {
                            // Fallback: Use plugin instance method directly
                            log('  Using plugin instance method directly', 'info');
                            searchResult = await stringPlugin._instance.searchProteinInteractions(demo.searchConfig);
                        } else {
                            // Final fallback: Try to find the plugin instance and call method
                            const pluginInstance = stringPlugin._instance || stringPlugin.instance || stringPlugin;
                            if (pluginInstance && typeof pluginInstance.searchProteinInteractions === 'function') {
                                log('  Using fallback plugin instance', 'info');
                                searchResult = await pluginInstance.searchProteinInteractions(demo.searchConfig);
                            } else {
                                throw new Error('STRING search method not accessible. Plugin structure: ' + JSON.stringify({
                                    hasInstance: !!stringPlugin._instance,
                                    hasCommandHandlers: !!stringPlugin._commandHandlers,
                                    commandHandlerKeys: stringPlugin._commandHandlers ? Array.from(stringPlugin._commandHandlers.keys()) : [],
                                    availableKeys: Object.keys(stringPlugin)
                                }));
                            }
                        }
                        
                        if (!searchResult || !searchResult.success) {
                            throw new Error('STRING API search failed');
                        }
                        
                        data = searchResult.data;
                        log('✅ Real-time data retrieved from STRING database', 'success');
                        log('  Nodes: ' + data.nodes.length, 'info');
                        log('  Edges: ' + data.edges.length, 'info');
                        log('  Avg Confidence: ' + (data.edges.reduce((sum, e) => sum + (e.confidence || 0), 0) / data.edges.length).toFixed(2), 'info');
                        
                        } else if ('${pluginId}' === 'kegg-pathway-viewer') {
                            // KEGG Database Search
                            log('🔍 Fetching real-time data from KEGG database...', 'info');
                            log('  Pathway ID: ' + demo.searchConfig.pathwayId, 'info');
                            log('  Organism: ' + demo.searchConfig.organism, 'info');
                            log('  Pathway Name: ' + demo.searchConfig.pathwayName, 'info');
                        
                        const keggPlugin = pluginManager.pluginRegistry.visualization.get('kegg-pathway-viewer');
                        if (!keggPlugin) {
                            throw new Error('KEGG Pathway Viewer plugin not found');
                        }
                        
                        log('✅ KEGG plugin found in registry', 'success');
                        log('📡 Calling KEGG API...', 'info');
                        log('  API Endpoint: https://rest.kegg.jp', 'info');
                        log('  Pathway ID: ' + demo.searchConfig.pathwayId, 'info');
                        
                        let pathwayResult = null;
                        
                        try {
                            if (keggPlugin._commandHandlers && keggPlugin._commandHandlers.has('kegg-viewer.getPathwayDetails')) {
                                log('  Using stored command handler', 'info');
                                const commandHandler = keggPlugin._commandHandlers.get('kegg-viewer.getPathwayDetails');
                                pathwayResult = await commandHandler(demo.searchConfig);
                            } else if (keggPlugin._instance && typeof keggPlugin._instance.getPathwayDetails === 'function') {
                                log('  Using plugin instance method directly', 'info');
                                pathwayResult = await keggPlugin._instance.getPathwayDetails(demo.searchConfig);
                            } else {
                                const pluginInstance = keggPlugin._instance || keggPlugin.instance || keggPlugin;
                                if (pluginInstance && typeof pluginInstance.getPathwayDetails === 'function') {
                                    log('  Using fallback plugin instance', 'info');
                                    pathwayResult = await pluginInstance.getPathwayDetails(demo.searchConfig);
                                } else {
                                    throw new Error('KEGG getPathwayDetails method not accessible');
                                }
                            }
                        } catch (apiError) {
                            // Provide detailed error information
                            log('❌ KEGG API call failed', 'error');
                            log('  Error type: ' + apiError.name, 'error');
                            log('  Error message: ' + apiError.message, 'error');
                            
                            if (apiError.message.includes('Failed to fetch')) {
                                throw new Error(
                                    'Failed to fetch data from KEGG REST API. ' +
                                    'This may be due to: ' +
                                    '(1) CORS policy blocking the request, ' +
                                    '(2) Network connectivity issues, or ' +
                                    '(3) KEGG API temporarily unavailable. ' +
                                    'URL: https://rest.kegg.jp/get/' + demo.searchConfig.pathwayId
                                );
                            }
                            throw apiError;
                        }
                        
                        if (!pathwayResult || !pathwayResult.success) {
                            throw new Error('KEGG API search failed');
                        }
                        
                        data = pathwayResult.data;
                        log('✅ Real-time data retrieved from KEGG database', 'success');
                        log('  Nodes: ' + (data.nodes ? data.nodes.length : 'N/A'), 'info');
                        log('  Edges: ' + (data.edges ? data.edges.length : 'N/A'), 'info');
                        
                        } else if ('${pluginId}' === 'ecocyc-pathway-analyzer') {
                            // EcoCyc/BioCyc Database Search
                            log('🔍 Fetching real-time data from BioCyc database...', 'info');
                            log('  Pathway ID: ' + demo.searchConfig.pathwayId, 'info');
                            log('  Organism: ' + demo.searchConfig.organism, 'info');
                            log('  Pathway Name: ' + demo.searchConfig.pathwayName, 'info');
                        
                        const ecocycPlugin = pluginManager.pluginRegistry.visualization.get('ecocyc-pathway-analyzer');
                        if (!ecocycPlugin) {
                            throw new Error('EcoCyc Pathway Analyzer plugin not found');
                        }
                        
                        log('✅ EcoCyc plugin found in registry', 'success');
                        log('📡 Calling BioCyc API...', 'info');
                        log('  API Endpoint: https://websvc.biocyc.org', 'info');
                        log('  Pathway ID: ' + demo.searchConfig.pathwayId, 'info');
                        
                        let pathwayResult = null;
                        
                        try {
                            if (ecocycPlugin._commandHandlers && ecocycPlugin._commandHandlers.has('ecocyc-analyzer.getPathwayDetails')) {
                                log('  Using stored command handler', 'info');
                                const commandHandler = ecocycPlugin._commandHandlers.get('ecocyc-analyzer.getPathwayDetails');
                                pathwayResult = await commandHandler(demo.searchConfig);
                            } else if (ecocycPlugin._instance && typeof ecocycPlugin._instance.getPathwayDetails === 'function') {
                                log('  Using plugin instance method directly', 'info');
                                pathwayResult = await ecocycPlugin._instance.getPathwayDetails(demo.searchConfig);
                            } else {
                                const pluginInstance = ecocycPlugin._instance || ecocycPlugin.instance || ecocycPlugin;
                                if (pluginInstance && typeof pluginInstance.getPathwayDetails === 'function') {
                                    log('  Using fallback plugin instance', 'info');
                                    pathwayResult = await pluginInstance.getPathwayDetails(demo.searchConfig);
                                } else {
                                    throw new Error('EcoCyc getPathwayDetails method not accessible');
                                }
                            }
                        } catch (apiError) {
                            // Provide detailed error information
                            log('❌ BioCyc API call failed', 'error');
                            log('  Error type: ' + apiError.name, 'error');
                            log('  Error message: ' + apiError.message, 'error');
                            
                            if (apiError.message.includes('Failed to fetch')) {
                                throw new Error(
                                    'Failed to fetch data from BioCyc API. ' +
                                    'This may be due to: ' +
                                    '(1) CORS policy blocking the request, ' +
                                    '(2) Network connectivity issues, or ' +
                                    '(3) BioCyc API temporarily unavailable. ' +
                                    'Pathway: ' + demo.searchConfig.pathwayId
                                );
                            }
                            throw apiError;
                        }
                        
                        if (!pathwayResult || !pathwayResult.success) {
                            throw new Error('BioCyc API search failed');
                        }
                        
                        data = pathwayResult.data;
                        log('✅ Real-time data retrieved from BioCyc database', 'success');
                        log('  Nodes: ' + (data.nodes ? data.nodes.length : 'N/A'), 'info');
                        log('  Edges: ' + (data.edges ? data.edges.length : 'N/A'), 'info');
                        
                        } else {
                            // Unknown plugin type with real-time search
                            throw new Error(
                                'Unknown plugin type for real-time search: ${pluginId}. ' +
                                'Supported plugins: string-network-explorer, kegg-pathway-viewer, ecocyc-pathway-analyzer'
                            );
                        }
                    } else {
                        // Get static demo data
                        data = demo.data;
                        
                        if (!data) {
                            throw new Error(
                                'Demo data is missing. Demo object keys: ' + 
                                JSON.stringify(Object.keys(demo)) + 
                                '. Expected "data" property to contain network data.'
                            );
                        }
                        
                        log('Dataset loaded:', 'success');
                        log('  Nodes: ' + (data.nodes ? data.nodes.length : 'N/A'), 'info');
                        log('  Edges: ' + (data.edges ? data.edges.length : 'N/A'), 'info');
                    }
                    
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
                    
                    // Get plugin instance
                    let plugin = null;
                    
                    // Try to get from visualization registry first
                    if (pluginManager.pluginRegistry && pluginManager.pluginRegistry.visualization) {
                        plugin = pluginManager.pluginRegistry.visualization.get('${pluginId}');
                        log('Checked visualization registry: ' + (plugin ? 'Found' : 'Not found'), plugin ? 'success' : 'info');
                    }
                    
                    // Fallback to getPlugin method if available
                    if (!plugin && pluginManager.getPlugin) {
                        plugin = pluginManager.getPlugin('${pluginId}');
                        log('Checked getPlugin method: ' + (plugin ? 'Found' : 'Not found'), plugin ? 'success' : 'info');
                    }
                    
                    if (!plugin) {
                        throw new Error('Plugin "${pluginId}" not found in plugin manager. Available plugins: ' + 
                            (pluginManager.pluginRegistry?.visualization ? 
                                Array.from(pluginManager.pluginRegistry.visualization.keys()).join(', ') : 
                                'Unknown'));
                    }
                    
                    log('Plugin loaded: ' + (plugin.name || '${pluginId}'), 'success');
                    
                    // Render visualization
                    // Check for executor function first (from registerVisualization)
                    if (plugin.executor && typeof plugin.executor === 'function') {
                        currentVisualization = await plugin.executor(data);
                        container.appendChild(currentVisualization);
                    } else if (plugin.renderNetwork) {
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
                        throw new Error('Plugin does not have executor(), renderNetwork() or visualize() method. Available methods: ' + 
                            Object.keys(plugin).filter(k => typeof plugin[k] === 'function').join(', '));
                    }
                    
                    const duration = Date.now() - startTime;
                    
                    log('Visualization rendered successfully!', 'success');
                    log('Execution time: ' + duration + 'ms', 'info');
                    
                    // Update stats
                    document.getElementById('outputStats').innerHTML = 
                        '<i class="fas fa-check-circle" style="color: #48bb78;"></i> ' +
                        'Rendered in ' + duration + 'ms';
                    
                    // Update analysis
                    updateAnalysis(data, duration);
                    
                    // Enable export
                    document.getElementById('exportResultBtn').disabled = false;
                    
                    // Store execution
                    lastExecution = {
                        demo: demo.name,
                        data: data,
                        duration: duration,
                        timestamp: new Date().toISOString()
                    };
                    
                } catch (error) {
                    log('Error: ' + error.message, 'error');
                    console.error(error);
                    
                    document.getElementById('outputStats').innerHTML = 
                        '<i class="fas fa-times-circle" style="color: #f56565;"></i> ' +
                        'Error: ' + error.message;
                }
            }

            // Update analysis panel
            function updateAnalysis(data, duration) {
                const analysisContent = document.getElementById('analysisContent');
                
                const nodeCount = data.nodes ? data.nodes.length : 0;
                const edgeCount = data.edges ? data.edges.length : 0;
                const density = nodeCount > 1 ? (edgeCount / (nodeCount * (nodeCount - 1) / 2)).toFixed(3) : 0;
                const avgDegree = nodeCount > 0 ? (2 * edgeCount / nodeCount).toFixed(2) : 0;
                
                analysisContent.innerHTML = \`
                    <h3>Network Statistics</h3>
                    <div class="analysis-grid">
                        <div class="analysis-card">
                            <h4>Nodes</h4>
                            <div class="value">\${nodeCount}</div>
                        </div>
                        <div class="analysis-card">
                            <h4>Edges</h4>
                            <div class="value">\${edgeCount}</div>
                        </div>
                        <div class="analysis-card">
                            <h4>Density</h4>
                            <div class="value">\${density}</div>
                        </div>
                        <div class="analysis-card">
                            <h4>Avg Degree</h4>
                            <div class="value">\${avgDegree}</div>
                        </div>
                        <div class="analysis-card">
                            <h4>Render Time</h4>
                            <div class="value">\${duration}ms</div>
                        </div>
                    </div>
                    
                    <h3 style="margin-top: 20px;">Node Type Distribution</h3>
                    <div id="nodeTypeChart"></div>
                \`;
                
                // Add node type distribution
                if (data.nodes) {
                    const types = {};
                    data.nodes.forEach(node => {
                        const type = node.type || 'unknown';
                        types[type] = (types[type] || 0) + 1;
                    });
                    
                    const chartDiv = document.getElementById('nodeTypeChart');
                    chartDiv.innerHTML = Object.entries(types).map(([type, count]) => \`
                        <div style="margin: 8px 0;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                                <span>\${type}</span>
                                <span>\${count}</span>
                            </div>
                            <div style="background: #e2e8f0; height: 8px; border-radius: 4px;">
                                <div style="background: #667eea; height: 100%; width: \${(count / nodeCount * 100)}%; border-radius: 4px;"></div>
                            </div>
                        </div>
                    \`).join('');
                }
            }

            // Export result
            function exportResult(execution) {
                const exportData = {
                    plugin: '${plugin.name}',
                    version: '${plugin.version}',
                    demo: execution.demo,
                    timestamp: execution.timestamp,
                    duration: execution.duration,
                    data: execution.data
                };
                
                const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = \`\${execution.demo.replace(/\\s+/g, '_')}_\${Date.now()}.json\`;
                a.click();
                URL.revokeObjectURL(url);
                
                log('Result exported successfully', 'success');
            }

            // Logging function
            function log(message, type = 'info') {
                const logEl = document.getElementById('executionLog');
                const timestamp = new Date().toLocaleTimeString();
                const icon = {
                    'info': '📝',
                    'success': '✅',
                    'error': '❌',
                    'warning': '⚠️'
                }[type] || 'ℹ️';
                
                const color = {
                    'info': '#a0aec0',
                    'success': '#48bb78',
                    'error': '#f56565',
                    'warning': '#ed8936'
                }[type] || '#a0aec0';
                
                const line = \`<span style="color: #718096;">[\${timestamp}]</span> <span style="color: \${color};">\${icon} \${message}</span>\\n\`;
                
                if (logEl.textContent === 'Ready to run demo...') {
                    logEl.innerHTML = line;
                } else {
                    logEl.innerHTML += line;
                }
                
                logEl.scrollTop = logEl.scrollHeight;
            }

            // Initialize
            updateDataDisplay('basic');
            log('Interactive test demonstrator ready', 'success');
            log('Select a demo and click "Run Demo" to begin', 'info');
        `;
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PluginRealTestDemonstrator;
}
