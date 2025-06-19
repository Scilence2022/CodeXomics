/**
 * PluginDemoGenerator - 为不同类型的插件生成专门的演示界面
 */
class PluginDemoGenerator {
    constructor(pluginManager) {
        this.pluginManager = pluginManager;
    }

    /**
     * 生成网络可视化演示界面
     */
    generateNetworkVisualizationDemo(pluginId, pluginData) {
        return `
        <div class="demo-section">
            <div class="demo-header">
                <h2><i class="fas fa-project-diagram"></i> ${pluginData.name}</h2>
                <p>${pluginData.description}</p>
            </div>
            
            <div class="demo-controls">
                <div class="control-group">
                    <label>Network Type:</label>
                    <select id="networkType" class="demo-select">
                        <option value="protein-interaction">Protein Interaction</option>
                        <option value="gene-regulatory">Gene Regulatory</option>
                        <option value="metabolic">Metabolic Pathway</option>
                        <option value="generic">Generic Network</option>
                    </select>
                </div>
                
                <div class="control-group">
                    <label>Layout:</label>
                    <select id="layoutType" class="demo-select">
                        <option value="force">Force-directed</option>
                        <option value="circular">Circular</option>
                        <option value="hierarchical">Hierarchical</option>
                        <option value="grid">Grid</option>
                    </select>
                </div>
                
                <div class="control-group">
                    <label>Node Size:</label>
                    <input type="range" id="nodeSize" min="5" max="25" value="10" class="demo-slider">
                    <span id="nodeSizeValue">10</span>
                </div>
                
                <div class="control-group">
                    <button id="generateNetwork" class="demo-btn demo-btn-primary">
                        <i class="fas fa-play"></i> Generate Network
                    </button>
                    <button id="randomizeData" class="demo-btn demo-btn-secondary">
                        <i class="fas fa-random"></i> Randomize
                    </button>
                    <button id="exportNetwork" class="demo-btn demo-btn-success">
                        <i class="fas fa-download"></i> Export
                    </button>
                </div>
            </div>
            
            <div class="visualization-area" id="networkVisualization">
                <div class="visualization-placeholder">
                    <i class="fas fa-network-wired"></i>
                    <p>Click "Generate Network" to start visualization</p>
                </div>
            </div>
            
            <div class="demo-stats" id="networkStats">
                <div class="stat-card">
                    <span class="stat-label">Nodes</span>
                    <span class="stat-value" id="nodeCount">0</span>
                </div>
                <div class="stat-card">
                    <span class="stat-label">Edges</span>
                    <span class="stat-value" id="edgeCount">0</span>
                </div>
                <div class="stat-card">
                    <span class="stat-label">Density</span>
                    <span class="stat-value" id="networkDensity">0</span>
                </div>
                <div class="stat-card">
                    <span class="stat-label">Components</span>
                    <span class="stat-value" id="componentCount">0</span>
                </div>
            </div>
        </div>`;
    }

    /**
     * 生成序列分析演示界面
     */
    generateSequenceAnalysisDemo(pluginId, pluginData) {
        return `
        <div class="demo-section">
            <div class="demo-header">
                <h2><i class="fas fa-dna"></i> ${pluginData.name}</h2>
                <p>${pluginData.description}</p>
            </div>
            
            <div class="demo-controls">
                <div class="control-group">
                    <label>Analysis Type:</label>
                    <select id="analysisType" class="demo-select">
                        <option value="gc-content">GC Content Analysis</option>
                        <option value="motif-finding">Motif Finding</option>
                        <option value="diversity">Sequence Diversity</option>
                        <option value="comparison">Region Comparison</option>
                    </select>
                </div>
                
                <div class="control-group">
                    <label>Sample Data:</label>
                    <select id="sampleData" class="demo-select">
                        <option value="ecoli">E. coli K-12</option>
                        <option value="human">Human Chromosome 1</option>
                        <option value="yeast">S. cerevisiae</option>
                        <option value="custom">Custom Sequence</option>
                    </select>
                </div>
                
                <div class="control-group" id="customSequenceGroup" style="display: none;">
                    <label>Custom Sequence:</label>
                    <textarea id="customSequence" class="demo-textarea" 
                        placeholder="Enter DNA sequence (ATGC)..."></textarea>
                </div>
                
                <div class="control-group">
                    <button id="runAnalysis" class="demo-btn demo-btn-primary">
                        <i class="fas fa-play"></i> Run Analysis
                    </button>
                    <button id="clearResults" class="demo-btn demo-btn-secondary">
                        <i class="fas fa-trash"></i> Clear
                    </button>
                </div>
            </div>
            
            <div class="visualization-area" id="analysisVisualization">
                <div class="visualization-placeholder">
                    <i class="fas fa-chart-line"></i>
                    <p>Select analysis type and click "Run Analysis"</p>
                </div>
            </div>
            
            <div class="demo-results" id="analysisResults"></div>
        </div>`;
    }

    /**
     * 生成系统发育分析演示界面
     */
    generatePhylogeneticsDemo(pluginId, pluginData) {
        return `
        <div class="demo-section">
            <div class="demo-header">
                <h2><i class="fas fa-tree"></i> ${pluginData.name}</h2>
                <p>${pluginData.description}</p>
            </div>
            
            <div class="demo-controls">
                <div class="control-group">
                    <label>Tree Type:</label>
                    <select id="treeType" class="demo-select">
                        <option value="neighbor-joining">Neighbor Joining</option>
                        <option value="maximum-likelihood">Maximum Likelihood</option>
                        <option value="upgma">UPGMA</option>
                        <option value="parsimony">Maximum Parsimony</option>
                    </select>
                </div>
                
                <div class="control-group">
                    <label>Distance Method:</label>
                    <select id="distanceMethod" class="demo-select">
                        <option value="p-distance">P-distance</option>
                        <option value="jukes-cantor">Jukes-Cantor</option>
                        <option value="kimura-2p">Kimura 2-parameter</option>
                        <option value="tamura-nei">Tamura-Nei</option>
                    </select>
                </div>
                
                <div class="control-group">
                    <label>Sample Dataset:</label>
                    <select id="phyloDataset" class="demo-select">
                        <option value="mammals">Mammalian Species</option>
                        <option value="bacteria">Bacterial 16S rRNA</option>
                        <option value="viruses">Viral Sequences</option>
                        <option value="plants">Plant Chloroplast</option>
                    </select>
                </div>
                
                <div class="control-group">
                    <button id="buildTree" class="demo-btn demo-btn-primary">
                        <i class="fas fa-play"></i> Build Tree
                    </button>
                    <button id="rootTree" class="demo-btn demo-btn-secondary">
                        <i class="fas fa-seedling"></i> Root Tree
                    </button>
                    <button id="exportTree" class="demo-btn demo-btn-success">
                        <i class="fas fa-download"></i> Export Newick
                    </button>
                </div>
            </div>
            
            <div class="visualization-area" id="treeVisualization">
                <div class="visualization-placeholder">
                    <i class="fas fa-tree"></i>
                    <p>Select parameters and click "Build Tree"</p>
                </div>
            </div>
            
            <div class="demo-stats" id="treeStats">
                <div class="stat-card">
                    <span class="stat-label">Taxa</span>
                    <span class="stat-value" id="taxaCount">0</span>
                </div>
                <div class="stat-card">
                    <span class="stat-label">Branch Length</span>
                    <span class="stat-value" id="totalBranchLength">0</span>
                </div>
                <div class="stat-card">
                    <span class="stat-label">Tree Height</span>
                    <span class="stat-value" id="treeHeight">0</span>
                </div>
            </div>
        </div>`;
    }

    /**
     * 获取演示界面的样式
     */
    getDemoStyles() {
        return `
            .demo-section {
                padding: 2rem;
                background: white;
                border-radius: 1rem;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                margin: 1rem;
            }
            
            .demo-header {
                text-align: center;
                margin-bottom: 2rem;
                padding-bottom: 1rem;
                border-bottom: 2px solid #e2e8f0;
            }
            
            .demo-header h2 {
                font-size: 2rem;
                color: #2d3748;
                margin-bottom: 0.5rem;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 1rem;
            }
            
            .demo-header p {
                color: #718096;
                font-size: 1.1rem;
            }
            
            .demo-controls {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 1.5rem;
                margin-bottom: 2rem;
                padding: 1.5rem;
                background: #f7fafc;
                border-radius: 0.75rem;
                border: 1px solid #e2e8f0;
            }
            
            .control-group {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            }
            
            .control-group label {
                font-weight: 600;
                color: #4a5568;
                font-size: 0.9rem;
            }
            
            .demo-select,
            .demo-textarea {
                padding: 0.75rem;
                border: 2px solid #e2e8f0;
                border-radius: 0.5rem;
                font-size: 1rem;
                transition: border-color 0.2s ease;
            }
            
            .demo-select:focus,
            .demo-textarea:focus {
                outline: none;
                border-color: #4299e1;
                box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
            }
            
            .demo-slider {
                appearance: none;
                height: 8px;
                border-radius: 4px;
                background: #e2e8f0;
                outline: none;
            }
            
            .demo-slider::-webkit-slider-thumb {
                appearance: none;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: #4299e1;
                cursor: pointer;
            }
            
            .demo-btn {
                padding: 0.75rem 1.5rem;
                border: none;
                border-radius: 0.5rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.5rem;
                font-size: 0.95rem;
            }
            
            .demo-btn-primary {
                background: linear-gradient(135deg, #4299e1, #38b2ac);
                color: white;
            }
            
            .demo-btn-secondary {
                background: #718096;
                color: white;
            }
            
            .demo-btn-success {
                background: #48bb78;
                color: white;
            }
            
            .demo-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            }
            
            .visualization-area {
                width: 100%;
                height: 500px;
                border: 2px solid #e2e8f0;
                border-radius: 0.75rem;
                margin-bottom: 2rem;
                position: relative;
                overflow: hidden;
                background: white;
            }
            
            .visualization-placeholder {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100%;
                color: #a0aec0;
                font-size: 1.1rem;
            }
            
            .visualization-placeholder i {
                font-size: 4rem;
                margin-bottom: 1rem;
                opacity: 0.5;
            }
            
            .demo-stats {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 1rem;
                margin-top: 1rem;
            }
            
            .stat-card {
                background: #f7fafc;
                border: 1px solid #e2e8f0;
                border-radius: 0.5rem;
                padding: 1rem;
                text-align: center;
                transition: transform 0.2s ease;
            }
            
            .stat-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            }
            
            .stat-label {
                display: block;
                font-size: 0.875rem;
                color: #718096;
                margin-bottom: 0.5rem;
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }
            
            .stat-value {
                display: block;
                font-size: 1.5rem;
                font-weight: bold;
                color: #2d3748;
            }
            
            .demo-results {
                background: #f7fafc;
                border-radius: 0.75rem;
                padding: 1.5rem;
                border: 1px solid #e2e8f0;
                margin-top: 1rem;
            }
        `;
    }

    /**
     * 为插件生成适当的演示界面
     */
    generateDemoInterface(pluginId, pluginData) {
        const category = this.getPluginCategory(pluginId);
        
        switch (category) {
            case 'Network Analysis':
                return this.generateNetworkVisualizationDemo(pluginId, pluginData);
            case 'Sequence Analysis':
                return this.generateSequenceAnalysisDemo(pluginId, pluginData);
            case 'Phylogenetics':
                return this.generatePhylogeneticsDemo(pluginId, pluginData);
            default:
                return this.generateGenericDemo(pluginId, pluginData);
        }
    }

    /**
     * 生成通用演示界面
     */
    generateGenericDemo(pluginId, pluginData) {
        return `
        <div class="demo-section">
            <div class="demo-header">
                <h2><i class="fas fa-chart-bar"></i> ${pluginData.name}</h2>
                <p>${pluginData.description}</p>
            </div>
            
            <div class="demo-controls">
                <div class="control-group">
                    <label>Data Type:</label>
                    <select id="dataType" class="demo-select">
                        <option value="sample">Sample Data</option>
                        <option value="random">Random Data</option>
                        <option value="custom">Custom Data</option>
                    </select>
                </div>
                
                <div class="control-group">
                    <button id="generateVisualization" class="demo-btn demo-btn-primary">
                        <i class="fas fa-play"></i> Generate
                    </button>
                </div>
            </div>
            
            <div class="visualization-area" id="genericVisualization">
                <div class="visualization-placeholder">
                    <i class="fas fa-chart-bar"></i>
                    <p>Click "Generate" to create visualization</p>
                </div>
            </div>
        </div>`;
    }

    /**
     * 获取插件分类
     */
    getPluginCategory(pluginId) {
        const categoryMap = {
            'network-graph': 'Network Analysis',
            'protein-interaction-network': 'Network Analysis',
            'gene-regulatory-network': 'Network Analysis',
            'phylogenetic-tree': 'Phylogenetics',
            'gc-content-plot': 'Sequence Analysis',
            'sequence-alignment': 'Sequence Analysis',
            'heatmap': 'Data Visualization',
            'dot-plot': 'Comparative Analysis'
        };
        return categoryMap[pluginId] || 'General';
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PluginDemoGenerator;
} 