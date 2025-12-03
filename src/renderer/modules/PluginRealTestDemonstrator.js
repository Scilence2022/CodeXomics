/**
 * Plugin Real Test Demonstrator
 * Showcases actual plugin functionality with interactive demonstrations
 * 
 * @version 2.0.0
 * @author GenomeAIStudio Team
 */

class PluginRealTestDemonstrator {
    constructor(pluginManager) {
        this.pluginManager = pluginManager;
        this.demoData = this.initializeDemoData();
        this.testResults = new Map();
    }

    /**
     * Initialize comprehensive demo data for different plugin types
     */
    initializeDemoData() {
        return {
            'protein-interaction-network': this.getProteinNetworkDemoData(),
            'gene-regulatory-network': this.getGeneNetworkDemoData(),
            'phylogenetic-tree': this.getPhylogeneticDemoData(),
            'sequence-alignment': this.getAlignmentDemoData()
        };
    }

    /**
     * Get protein interaction network demo data
     * Real biological example: p53 tumor suppressor pathway
     */
    getProteinNetworkDemoData() {
        return {
            basic: {
                name: 'Basic Protein-Protein Interactions',
                description: 'Simple 3-protein interaction network',
                data: {
                    nodes: [
                        { 
                            id: 'TP53', 
                            name: 'TP53 (Tumor protein p53)', 
                            type: 'protein',
                            properties: {
                                function: 'Tumor suppressor',
                                location: 'Nucleus',
                                mw: '43.7 kDa',
                                expression: 0.85
                            }
                        },
                        { 
                            id: 'MDM2', 
                            name: 'MDM2 (E3 ubiquitin-protein ligase)', 
                            type: 'enzyme',
                            properties: {
                                function: 'Ubiquitin ligase',
                                location: 'Nucleus/Cytoplasm',
                                mw: '56.9 kDa',
                                expression: 0.72
                            }
                        },
                        { 
                            id: 'ATM', 
                            name: 'ATM (Serine-protein kinase)', 
                            type: 'enzyme',
                            properties: {
                                function: 'DNA damage response',
                                location: 'Nucleus',
                                mw: '350.6 kDa',
                                expression: 0.68
                            }
                        }
                    ],
                    edges: [
                        { 
                            source: 'TP53', 
                            target: 'MDM2', 
                            confidence: 0.95,
                            type: 'regulation',
                            properties: {
                                interaction: 'Direct binding',
                                effect: 'MDM2 ubiquitinates p53',
                                evidence: 'Experimental'
                            }
                        },
                        { 
                            source: 'ATM', 
                            target: 'TP53', 
                            confidence: 0.88,
                            type: 'phosphorylation',
                            properties: {
                                interaction: 'Post-translational modification',
                                effect: 'Stabilizes p53',
                                evidence: 'Experimental'
                            }
                        }
                    ],
                    metadata: {
                        organism: 'Homo sapiens',
                        pathway: 'p53 signaling pathway',
                        database: 'STRING v12.0'
                    }
                }
            },
            complex: {
                name: 'DNA Damage Response Network',
                description: 'Complex network with 8 proteins involved in DNA damage response',
                data: {
                    nodes: [
                        { id: 'TP53', name: 'TP53', type: 'protein', properties: { function: 'Tumor suppressor', expression: 0.85 } },
                        { id: 'MDM2', name: 'MDM2', type: 'enzyme', properties: { function: 'E3 ubiquitin ligase', expression: 0.72 } },
                        { id: 'ATM', name: 'ATM', type: 'enzyme', properties: { function: 'Kinase', expression: 0.68 } },
                        { id: 'CHEK2', name: 'CHEK2', type: 'enzyme', properties: { function: 'Checkpoint kinase', expression: 0.65 } },
                        { id: 'BRCA1', name: 'BRCA1', type: 'protein', properties: { function: 'DNA repair', expression: 0.78 } },
                        { id: 'RAD51', name: 'RAD51', type: 'enzyme', properties: { function: 'Recombinase', expression: 0.71 } },
                        { id: 'PTEN', name: 'PTEN', type: 'enzyme', properties: { function: 'Phosphatase', expression: 0.63 } },
                        { id: 'AKT1', name: 'AKT1', type: 'enzyme', properties: { function: 'Kinase', expression: 0.81 } }
                    ],
                    edges: [
                        { source: 'TP53', target: 'MDM2', confidence: 0.95, type: 'regulation' },
                        { source: 'ATM', target: 'TP53', confidence: 0.88, type: 'phosphorylation' },
                        { source: 'ATM', target: 'CHEK2', confidence: 0.91, type: 'phosphorylation' },
                        { source: 'CHEK2', target: 'TP53', confidence: 0.85, type: 'phosphorylation' },
                        { source: 'ATM', target: 'BRCA1', confidence: 0.87, type: 'phosphorylation' },
                        { source: 'BRCA1', target: 'RAD51', confidence: 0.82, type: 'recruitment' },
                        { source: 'PTEN', target: 'AKT1', confidence: 0.92, type: 'inhibition' },
                        { source: 'AKT1', target: 'MDM2', confidence: 0.79, type: 'phosphorylation' },
                        { source: 'MDM2', target: 'TP53', confidence: 0.95, type: 'ubiquitination' }
                    ],
                    metadata: {
                        organism: 'Homo sapiens',
                        pathway: 'DNA damage response',
                        networkType: 'protein-interaction'
                    }
                }
            },
            performance: {
                name: 'Large Scale Network (Performance Test)',
                description: 'Stress test with 50 proteins and 100+ interactions',
                generator: () => {
                    const nodes = [];
                    const edges = [];
                    const proteinTypes = ['protein', 'enzyme', 'receptor', 'transcription_factor'];
                    
                    // Generate 50 nodes
                    for (let i = 0; i < 50; i++) {
                        nodes.push({
                            id: `PROT${i}`,
                            name: `Protein ${i}`,
                            type: proteinTypes[i % proteinTypes.length],
                            properties: {
                                expression: Math.random(),
                                mw: `${(20 + Math.random() * 80).toFixed(1)} kDa`
                            }
                        });
                    }
                    
                    // Generate random interactions
                    for (let i = 0; i < 120; i++) {
                        const source = Math.floor(Math.random() * 50);
                        const target = Math.floor(Math.random() * 50);
                        if (source !== target) {
                            edges.push({
                                source: `PROT${source}`,
                                target: `PROT${target}`,
                                confidence: 0.5 + Math.random() * 0.5,
                                type: ['binding', 'phosphorylation', 'regulation'][Math.floor(Math.random() * 3)]
                            });
                        }
                    }
                    
                    return { nodes, edges, metadata: { networkType: 'large-scale-test' } };
                }
            }
        };
    }

    /**
     * Get gene regulatory network demo data
     */
    getGeneNetworkDemoData() {
        return {
            basic: {
                name: 'Lac Operon Regulatory Network',
                description: 'Classic bacterial gene regulation system',
                data: {
                    nodes: [
                        { id: 'lacI', name: 'lacI', type: 'transcription_factor', properties: { regulation: 'repressor' } },
                        { id: 'lacZ', name: 'lacZ', type: 'gene', properties: { product: 'β-galactosidase' } },
                        { id: 'lacY', name: 'lacY', type: 'gene', properties: { product: 'Permease' } },
                        { id: 'lacA', name: 'lacA', type: 'gene', properties: { product: 'Transacetylase' } }
                    ],
                    edges: [
                        { source: 'lacI', target: 'lacZ', type: 'repression', confidence: 0.95 },
                        { source: 'lacI', target: 'lacY', type: 'repression', confidence: 0.95 },
                        { source: 'lacI', target: 'lacA', type: 'repression', confidence: 0.95 }
                    ]
                }
            }
        };
    }

    /**
     * Get phylogenetic tree demo data
     */
    getPhylogeneticDemoData() {
        return {
            basic: {
                name: 'Mammalian Evolution',
                description: 'Phylogenetic relationship of common mammals',
                data: {
                    newick: '((Human:0.1,Chimp:0.1):0.2,(Gorilla:0.15,(Orangutan:0.2,Gibbon:0.25):0.1):0.15);',
                    metadata: {
                        type: 'phylogenetic',
                        method: 'Maximum Likelihood',
                        species: 5
                    }
                }
            }
        };
    }

    /**
     * Get sequence alignment demo data
     */
    getAlignmentDemoData() {
        return {
            basic: {
                name: 'BRCA1 Gene Alignment',
                description: 'Multiple sequence alignment of BRCA1 across species',
                data: {
                    sequences: [
                        { id: 'Human', sequence: 'ATGGATTTATCTGCTCTTCGCGTTGAAGAAGTACAAAATGTCATTAATGCTATGCAGA' },
                        { id: 'Mouse', sequence: 'ATGGATTTATCTGCTCTTCGTGTTGAAGAAGTACAAAATGTCATTAATGCTATGCAGA' },
                        { id: 'Rat', sequence: 'ATGGATTTATCTGCTCTTCGTGTTGAAGAAGTACAAAATGTCATTAATGCTATGCAGA' }
                    ],
                    metadata: {
                        gene: 'BRCA1',
                        region: 'Exon 1'
                    }
                }
            }
        };
    }

    /**
     * Generate interactive test interface for plugin
     */
    generateInteractiveTestUI(pluginId, plugin, type) {
        const demoSets = this.demoData[pluginId] || {};
        
        return `
            <div class="real-test-container">
                <div class="test-header-banner">
                    <div class="banner-icon">
                        <i class="fas fa-vial"></i>
                    </div>
                    <div class="banner-content">
                        <h2>Interactive Plugin Demonstration</h2>
                        <p>Experience real ${plugin.name} functionality with biological data</p>
                    </div>
                </div>

                <div class="demo-selector">
                    <h3><i class="fas fa-database"></i> Choose Demo Dataset</h3>
                    <div class="demo-options">
                        ${Object.entries(demoSets).map(([key, demo]) => `
                            <div class="demo-option" data-demo-key="${key}">
                                <input type="radio" name="demo-select" id="demo-${key}" value="${key}" ${key === 'basic' ? 'checked' : ''}>
                                <label for="demo-${key}">
                                    <strong>${demo.name}</strong>
                                    <span class="demo-desc">${demo.description}</span>
                                </label>
                            </div>
                        `).join('')}
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
     */
    generateTestScript(pluginId, plugin, type) {
        const demoDataJSON = JSON.stringify(this.demoData[pluginId] || {});
        
        return `
            const demoData = ${demoDataJSON};
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
                const data = demo.generator ? demo.generator() : demo.data;
                dataDisplay.textContent = JSON.stringify(data, null, 2);
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
                    // Get data
                    const data = demo.generator ? demo.generator() : demo.data;
                    log('Dataset loaded:', 'success');
                    log('  Nodes: ' + (data.nodes ? data.nodes.length : 'N/A'), 'info');
                    log('  Edges: ' + (data.edges ? data.edges.length : 'N/A'), 'info');
                    
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
