/**
 * PluginTestFramework - provides an independent test and demo interface for each plugin
 * Supports Tools-menu integration for visualization plugins and a consistent UI style
 */
class PluginTestFramework {
  constructor(pluginManager, configManager) {
    this.pluginManager = pluginManager;
    this.configManager = configManager;
    this.testWindows = new Map(); // store references to test windows
    this.demoWindows = new Map(); // store references to demo windows

    // Initialize the menu integration
    this.initializeToolsMenuIntegration();

    console.log('PluginTestFramework initialized');
  }

  /**
   * Register menu items in the Tools menu for visualization plugins
   */
  initializeToolsMenuIntegration() {
    // Listen for Tools-menu requests
    window.addEventListener('plugin-tools-menu-request', event => {
      this.openVisualizationTool(event.detail.pluginId);
    });
  }

  /**
   * Get the menu items for all visualization plugins
   */
  getVisualizationMenuItems() {
    const visualizationPlugins = this.pluginManager.getAvailableVisualizations();
    return visualizationPlugins.map(plugin => ({
      id: plugin.id,
      name: plugin.name,
      description: plugin.description,
      icon: this.getPluginIcon(plugin.id),
      category: this.getPluginCategory(plugin.id),
    }));
  }

  /**
   * Get the plugin icon
   */
  getPluginIcon(pluginId) {
    const iconMap = {
      'network-graph': 'fas fa-project-diagram',
      'protein-interaction-network': 'fas fa-share-alt-square',
      'gene-regulatory-network': 'fas fa-sitemap',
      'phylogenetic-tree': 'fas fa-tree',
      'gc-content-plot': 'fas fa-chart-line',
      heatmap: 'fas fa-th',
      'sequence-alignment': 'fas fa-align-left',
      'dot-plot': 'fas fa-chart-scatter',
    };
    return iconMap[pluginId] || 'fas fa-chart-bar';
  }

  /**
   * Get the plugin category
   */
  getPluginCategory(pluginId) {
    const categoryMap = {
      'network-graph': 'Network Analysis',
      'protein-interaction-network': 'Network Analysis',
      'gene-regulatory-network': 'Network Analysis',
      'phylogenetic-tree': 'Phylogenetics',
      'gc-content-plot': 'Sequence Analysis',
      heatmap: 'Data Visualization',
      'sequence-alignment': 'Sequence Analysis',
      'dot-plot': 'Comparative Analysis',
    };
    return categoryMap[pluginId] || 'General';
  }

  /**
   * Open the plugin test interface
   */
  openPluginTestInterface(pluginId, pluginData, pluginType) {
    // If the window is already open, focus it
    if (this.testWindows.has(pluginId)) {
      this.testWindows.get(pluginId).focus();
      return;
    }

    // Create a new test window
    const testWindow = this.createTestWindow(pluginId, pluginData, pluginType);
    this.testWindows.set(pluginId, testWindow);

    // Clean up the reference when the window closes
    testWindow.addEventListener('beforeunload', () => {
      this.testWindows.delete(pluginId);
    });
  }

  /**
   * Open the visualization tool interface
   */
  openVisualizationTool(pluginId) {
    // If the demo window is already open, focus it
    if (this.demoWindows.has(pluginId)) {
      this.demoWindows.get(pluginId).focus();
      return;
    }

    const plugin = this.pluginManager.visualizationPlugins.get(pluginId);
    if (!plugin) {
      console.error(`Visualization plugin ${pluginId} not found`);
      return;
    }

    // Create the demo window
    const demoWindow = this.createVisualizationDemoWindow(pluginId, plugin);
    this.demoWindows.set(pluginId, demoWindow);

    // Clean up the reference when the window closes
    demoWindow.addEventListener('beforeunload', () => {
      this.demoWindows.delete(pluginId);
    });
  }

  /**
   * Create a test window
   */
  createTestWindow(pluginId, pluginData, pluginType) {
    const testWindow = window.open(
      '',
      '_blank',
      'width=1400,height=900,scrollbars=yes,resizable=yes,menubar=no,toolbar=no'
    );

    const windowTitle = `${pluginData.name} - Plugin Test Suite`;

    testWindow.document.write(this.generateTestWindowHTML(pluginId, pluginData, pluginType, windowTitle));
    testWindow.document.close();
    testWindow.focus();

    // Inject the test script
    this.injectTestScript(testWindow, pluginId, pluginData, pluginType);

    return testWindow;
  }

  /**
   * Create a visualization demo window
   */
  createVisualizationDemoWindow(pluginId, pluginData) {
    const demoWindow = window.open(
      '',
      '_blank',
      'width=1200,height=800,scrollbars=yes,resizable=yes,menubar=no,toolbar=no'
    );

    const windowTitle = `${pluginData.name} - Visualization Tool`;

    demoWindow.document.write(this.generateVisualizationDemoHTML(pluginId, pluginData, windowTitle));
    demoWindow.document.close();
    demoWindow.focus();

    // Inject the demo script
    this.injectVisualizationScript(demoWindow, pluginId, pluginData);

    return demoWindow;
  }

  /**
   * Generate the test-window HTML
   */
  generateTestWindowHTML(pluginId, pluginData, pluginType, title) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <style>${this.getTestWindowStyles()}</style>
</head>
<body>
    <div class="test-framework-container">
        ${this.generateTestHeader(pluginData, pluginType)}
        ${this.generateTestDashboard()}
        ${this.generateTestContent(pluginId, pluginData, pluginType)}
    </div>
    <script src="https://d3js.org/d3.v7.min.js"></script>
</body>
</html>`;
  }

  /**
   * Generate the visualization demo-window HTML
   */
  generateVisualizationDemoHTML(pluginId, pluginData, title) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <style>${this.getVisualizationDemoStyles()}</style>
</head>
<body>
    <div class="demo-framework-container">
        ${this.generateDemoHeader(pluginData)}
        ${this.generateDemoControls(pluginId, pluginData)}
        ${this.generateVisualizationArea(pluginId)}
        ${this.generateDemoFooter()}
    </div>
    <script src="https://d3js.org/d3.v7.min.js"></script>
</body>
</html>`;
  }

  /**
   * Get the plugin's sample data
   */
  getPluginSampleData(pluginId, pluginType) {
    const sampleDataMap = {
      // Function-plugin sample data
      'genomic-analysis': {
        analyzeGCContent: {
          chromosome: 'chr1',
          start: 1000,
          end: 5000,
          windowSize: 100,
        },
        findMotifs: {
          chromosome: 'chr1',
          start: 1000,
          end: 3000,
          motif: 'GAATTC',
        },
      },
      // Visualization-plugin sample data
      'network-graph': {
        networkType: 'generic',
        nodes: [
          { id: 'A', name: 'Node A', size: 10, color: '#4ECDC4' },
          { id: 'B', name: 'Node B', size: 12, color: '#45B7D1' },
          { id: 'C', name: 'Node C', size: 8, color: '#F7DC6F' },
        ],
        edges: [
          { source: 'A', target: 'B', weight: 0.8 },
          { source: 'B', target: 'C', weight: 0.6 },
        ],
      },
      'protein-interaction-network': {
        networkType: 'protein-interaction',
        nodes: [
          { id: 'TP53', name: 'TP53', type: 'protein', size: 15, color: '#E74C3C' },
          { id: 'MDM2', name: 'MDM2', type: 'protein', size: 12, color: '#3498DB' },
        ],
        edges: [{ source: 'TP53', target: 'MDM2', weight: 0.9, type: 'physical' }],
      },
    };

    return sampleDataMap[pluginId] || {};
  }

  /**
   * Generate the test header
   */
  generateTestHeader(pluginData, pluginType) {
    return `
        <div class="test-header">
            <div class="header-logo">
                <i class="${this.getPluginIcon(pluginData.id)}"></i>
            </div>
            <div class="header-info">
                <h1>${pluginData.name} Test Suite</h1>
                <p>${pluginData.description}</p>
                <div class="header-meta">
                    <span class="meta-tag type-${pluginType}">${pluginType.toUpperCase()}</span>
                    <span class="meta-tag">v${pluginData.version}</span>
                    <span class="meta-tag">${pluginData.author || 'Unknown Author'}</span>
                </div>
            </div>
        </div>`;
  }

  /**
   * Generate the test dashboard
   */
  generateTestDashboard() {
    return `
        <div class="test-dashboard">
            <div class="dashboard-cards">
                <div class="card test-status">
                    <div class="card-icon">
                        <i class="fas fa-play-circle"></i>
                    </div>
                    <div class="card-content">
                        <h3>Test Status</h3>
                        <p class="status-text" id="testStatus">Ready to Start</p>
                    </div>
                </div>
                
                <div class="card test-progress">
                    <div class="card-icon">
                        <i class="fas fa-chart-line"></i>
                    </div>
                    <div class="card-content">
                        <h3>Progress</h3>
                        <div class="progress-bar">
                            <div class="progress-fill" id="progressFill" style="width: 0%"></div>
                        </div>
                        <p id="progressText">0% Complete</p>
                    </div>
                </div>
                
                <div class="card test-results">
                    <div class="card-icon">
                        <i class="fas fa-check-circle"></i>
                    </div>
                    <div class="card-content">
                        <h3>Results</h3>
                        <p><span id="passedCount">0</span> passed / <span id="totalCount">0</span> total</p>
                    </div>
                </div>
            </div>
        </div>`;
  }

  /**
   * Generate the test content area
   */
  generateTestContent(pluginId, pluginData, pluginType) {
    return `
        <div class="test-content">
            <div class="content-tabs">
                <button class="tab-button active" data-tab="overview">
                    <i class="fas fa-home"></i>
                    Overview
                </button>
                <button class="tab-button" data-tab="tests">
                    <i class="fas fa-vial"></i>
                    Tests
                </button>
                <button class="tab-button" data-tab="demo">
                    <i class="fas fa-play"></i>
                    Demo
                </button>
                <button class="tab-button" data-tab="logs">
                    <i class="fas fa-terminal"></i>
                    Logs
                </button>
            </div>
            
            <div class="tab-content active" id="overview-content">
                ${this.generateOverviewContent(pluginData, pluginType)}
            </div>
            
            <div class="tab-content" id="tests-content">
                ${this.generateTestsContent(pluginId, pluginData, pluginType)}
            </div>
            
            <div class="tab-content" id="demo-content">
                ${this.generateDemoContent(pluginId, pluginData)}
            </div>
            
            <div class="tab-content" id="logs-content">
                ${this.generateLogsContent()}
            </div>
        </div>`;
  }

  /**
   * Generate the overview content
   */
  generateOverviewContent(pluginData, pluginType) {
    return `
        <div class="overview-section">
            <div class="plugin-details">
                <h3>Plugin Information</h3>
                <table class="details-table">
                    <tr><td>Name:</td><td>${pluginData.name}</td></tr>
                    <tr><td>Type:</td><td>${pluginType}</td></tr>
                    <tr><td>Version:</td><td>${pluginData.version}</td></tr>
                    <tr><td>Author:</td><td>${pluginData.author || 'Unknown'}</td></tr>
                    <tr><td>Status:</td><td class="status-enabled">Enabled</td></tr>
                </table>
            </div>
            
            <div class="quick-actions">
                <h3>Quick Actions</h3>
                <div class="action-buttons">
                    <button class="action-btn primary" onclick="startQuickTest()">
                        <i class="fas fa-bolt"></i>
                        Quick Test
                    </button>
                    <button class="action-btn secondary" onclick="startFullTest()">
                        <i class="fas fa-play"></i>
                        Full Test Suite
                    </button>
                    <button class="action-btn info" onclick="openDemo()">
                        <i class="fas fa-eye"></i>
                        Open Demo
                    </button>
                </div>
            </div>
        </div>`;
  }

  /**
   * Generate the test content
   */
  generateTestsContent(pluginId, pluginData, pluginType) {
    return `
        <div class="tests-section">
            <div class="test-controls">
                <button class="test-btn primary" onclick="runAllTests()">
                    <i class="fas fa-play"></i>
                    Run All Tests
                </button>
                <button class="test-btn secondary" onclick="resetTests()">
                    <i class="fas fa-redo"></i>
                    Reset
                </button>
            </div>
            
            <div class="test-list" id="testList">
                ${this.generateTestList(pluginId, pluginData, pluginType)}
            </div>
        </div>`;
  }

  /**
   * Generate the demo content
   */
  generateDemoContent(pluginId, pluginData) {
    if (this.demoGenerator) {
      return this.demoGenerator.generateDemoInterface(pluginId, pluginData);
    }
    return `
        <div class="demo-section">
            <div class="demo-placeholder">
                <i class="fas fa-play-circle"></i>
                <h3>Demo Interface</h3>
                <p>Interactive demonstration for ${pluginData.name}</p>
                <button class="demo-btn" onclick="startDemo()">Start Demo</button>
            </div>
        </div>`;
  }

  /**
   * Generate the log content
   */
  generateLogsContent() {
    return `
        <div class="logs-section">
            <div class="logs-header">
                <h3>Test Execution Logs</h3>
                <button class="clear-logs-btn" onclick="clearLogs()">
                    <i class="fas fa-trash"></i>
                    Clear
                </button>
            </div>
            <div class="logs-container" id="logsContainer">
                <div class="log-entry info">
                    <span class="log-time">${new Date().toLocaleTimeString()}</span>
                    <span class="log-level">INFO</span>
                    <span class="log-message">Test framework initialized</span>
                </div>
            </div>
        </div>`;
  }

  /**
   * Generate the demo header
   */
  generateDemoHeader(pluginData) {
    return `
        <div class="demo-header">
            <div class="demo-title">
                <h1><i class="${this.getPluginIcon(pluginData.id)}"></i> ${pluginData.name}</h1>
                <p>${pluginData.description}</p>
            </div>
            <div class="demo-actions">
                <button class="demo-action-btn" onclick="refreshDemo()">
                    <i class="fas fa-sync"></i>
                    Refresh
                </button>
                <button class="demo-action-btn" onclick="saveDemo()">
                    <i class="fas fa-save"></i>
                    Save
                </button>
            </div>
        </div>`;
  }

  /**
   * Generate the demo control panel
   */
  generateDemoControls(pluginId, pluginData) {
    return `
        <div class="demo-controls-panel">
            <div class="controls-section">
                <h3>Controls</h3>
                <div class="control-grid">
                    <button class="control-btn" onclick="playDemo()">
                        <i class="fas fa-play"></i>
                        Play
                    </button>
                    <button class="control-btn" onclick="pauseDemo()">
                        <i class="fas fa-pause"></i>
                        Pause
                    </button>
                    <button class="control-btn" onclick="resetDemo()">
                        <i class="fas fa-stop"></i>
                        Reset
                    </button>
                </div>
            </div>
        </div>`;
  }

  /**
   * Generate the visualization area
   */
  generateVisualizationArea(pluginId) {
    return `
        <div class="visualization-main" id="visualizationMain">
            <div class="viz-placeholder">
                <i class="fas fa-chart-bar"></i>
                <p>Visualization will appear here</p>
            </div>
        </div>`;
  }

  /**
   * Generate the demo footer
   */
  generateDemoFooter() {
    return `
        <div class="demo-footer">
            <div class="footer-info">
                <span>GenomeExplorer Plugin Framework</span>
                <span>© 2024 GenomeExplorer Team</span>
            </div>
        </div>`;
  }

  /**
   * Test-window styles
   */
  getTestWindowStyles() {
    return `
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #f8fafc;
                color: #2d3748;
                line-height: 1.6;
            }
            .test-framework-container {
                min-height: 100vh;
                display: flex;
                flex-direction: column;
            }
            .test-header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 2rem;
                display: flex;
                align-items: center;
                gap: 2rem;
            }
            .header-logo i {
                font-size: 4rem;
                opacity: 0.9;
            }
            .header-info h1 {
                font-size: 2.5rem;
                margin-bottom: 0.5rem;
            }
            .header-meta {
                display: flex;
                gap: 1rem;
                margin-top: 1rem;
            }
            .meta-tag {
                background: rgba(255,255,255,0.2);
                padding: 0.25rem 0.75rem;
                border-radius: 1rem;
                font-size: 0.875rem;
            }
            .test-dashboard {
                background: white;
                border-bottom: 1px solid #e2e8f0;
                padding: 2rem;
            }
            .dashboard-cards {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 1.5rem;
            }
            .card {
                background: #f7fafc;
                border: 1px solid #e2e8f0;
                border-radius: 0.75rem;
                padding: 1.5rem;
                display: flex;
                align-items: center;
                gap: 1rem;
            }
            .card-icon {
                font-size: 2rem;
                color: #4299e1;
            }
            .progress-bar {
                width: 100%;
                height: 8px;
                background: #e2e8f0;
                border-radius: 4px;
                overflow: hidden;
                margin: 0.5rem 0;
            }
            .progress-fill {
                height: 100%;
                background: linear-gradient(90deg, #4299e1, #38b2ac);
                transition: width 0.3s ease;
            }
            .test-content {
                flex: 1;
                background: white;
            }
            .content-tabs {
                display: flex;
                background: #f7fafc;
                border-bottom: 1px solid #e2e8f0;
            }
            .tab-button {
                padding: 1rem 2rem;
                border: none;
                background: transparent;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 0.5rem;
                border-bottom: 3px solid transparent;
                transition: all 0.2s;
            }
            .tab-button:hover {
                background: #e2e8f0;
            }
            .tab-button.active {
                background: white;
                border-bottom-color: #4299e1;
                color: #4299e1;
            }
            .tab-content {
                display: none;
                padding: 2rem;
            }
            .tab-content.active {
                display: block;
            }
            .action-buttons {
                display: flex;
                gap: 1rem;
                flex-wrap: wrap;
            }
            .action-btn {
                padding: 0.75rem 1.5rem;
                border: none;
                border-radius: 0.5rem;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 0.5rem;
                font-weight: 600;
                transition: all 0.2s;
            }
            .action-btn.primary {
                background: #4299e1;
                color: white;
            }
            .action-btn.secondary {
                background: #718096;
                color: white;
            }
            .action-btn.info {
                background: #38b2ac;
                color: white;
            }
            .action-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }
            .details-table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 1rem;
            }
            .details-table td {
                padding: 0.75rem;
                border-bottom: 1px solid #e2e8f0;
            }
            .details-table td:first-child {
                font-weight: 600;
                width: 30%;
            }
            .status-enabled {
                color: #38a169;
                font-weight: 600;
            }
        `;
  }

  /**
   * Visualization demo styles
   */
  getVisualizationDemoStyles() {
    return (
      this.getTestWindowStyles() +
      `
            .demo-framework-container {
                min-height: 100vh;
                background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
            }
            .demo-header {
                background: white;
                padding: 2rem;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .demo-title h1 {
                font-size: 2rem;
                color: #2d3748;
                margin-bottom: 0.5rem;
            }
            .demo-actions {
                display: flex;
                gap: 1rem;
            }
            .demo-action-btn {
                padding: 0.5rem 1rem;
                border: 1px solid #e2e8f0;
                background: white;
                border-radius: 0.5rem;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 0.5rem;
                transition: all 0.2s;
            }
            .demo-action-btn:hover {
                background: #f7fafc;
                border-color: #cbd5e0;
            }
            .visualization-main {
                background: white;
                margin: 2rem;
                border-radius: 1rem;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                min-height: 500px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .viz-placeholder {
                text-align: center;
                color: #a0aec0;
            }
            .viz-placeholder i {
                font-size: 4rem;
                margin-bottom: 1rem;
            }
        `
    );
  }

  /**
   * Inject the test script
   */
  injectTestScript(testWindow, pluginId, pluginData, pluginType) {
    testWindow.eval(`
            // Tab switching functionality
            function switchTab(tabName) {
                const tabs = document.querySelectorAll('.tab-button');
                const contents = document.querySelectorAll('.tab-content');
                
                tabs.forEach(tab => tab.classList.remove('active'));
                contents.forEach(content => content.classList.remove('active'));
                
                document.querySelector('[data-tab="' + tabName + '"]').classList.add('active');
                document.getElementById(tabName + '-content').classList.add('active');
            }
            
            // Add click listeners to tabs
            document.querySelectorAll('.tab-button').forEach(button => {
                button.addEventListener('click', () => {
                    switchTab(button.dataset.tab);
                });
            });
            
            // Test functions
            function startQuickTest() {
                console.log('Starting quick test for ${pluginId}');
                updateTestStatus('Running Quick Test...');
            }
            
            function startFullTest() {
                console.log('Starting full test for ${pluginId}');
                updateTestStatus('Running Full Test Suite...');
            }
            
            function openDemo() {
                switchTab('demo');
            }
            
            function updateTestStatus(status) {
                document.getElementById('testStatus').textContent = status;
            }
            
            console.log('Test framework loaded for plugin: ${pluginId}');
        `);
  }

  /**
   * Inject the visualization script
   */
  injectVisualizationScript(demoWindow, pluginId, pluginData) {
    demoWindow.eval(`
            console.log('Visualization demo loaded for: ${pluginId}');
            
            function refreshDemo() {
                console.log('Refreshing demo...');
            }
            
            function saveDemo() {
                console.log('Saving demo...');
            }
            
            function playDemo() {
                console.log('Playing demo...');
            }
            
            function pauseDemo() {
                console.log('Pausing demo...');
            }
            
            function resetDemo() {
                console.log('Resetting demo...');
            }
        `);
  }

  // Other helper methods...
  generateTestList(pluginId, pluginData, pluginType) {
    // Simple test-list generation
    return `
        <div class="test-item">
            <div class="test-name">Basic Functionality Test</div>
            <div class="test-status pending">Pending</div>
        </div>
        <div class="test-item">
            <div class="test-name">Error Handling Test</div>
            <div class="test-status pending">Pending</div>
        </div>`;
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PluginTestFramework;
}
