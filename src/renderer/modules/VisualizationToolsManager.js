/**
 * VisualizationToolsManager - 管理和展示可视化插件工具
 * 为Tools菜单下的Visualization Tools提供完整的功能界面
 */
class VisualizationToolsManager {
    constructor(app, configManager) {
        this.app = app;
        this.configManager = configManager;
        this.activeWindows = new Map();
        this.pluginManager = null;
        
        // 等待插件管理器初始化
        this.initializePluginManager();
        
        console.log('VisualizationToolsManager initialized');
    }

    async initializePluginManager() {
        // 等待插件管理器可用
        const waitForPluginManager = () => {
            if (window.pluginManager) {
                this.pluginManager = window.pluginManager;
                console.log('PluginManager connected to VisualizationToolsManager');
            } else {
                setTimeout(waitForPluginManager, 100);
            }
        };
        waitForPluginManager();
    }

    /**
     * 打开可视化工具界面
     */
    openVisualizationTool(pluginId) {
        // 检查窗口是否已经打开
        if (this.activeWindows.has(pluginId)) {
            const existingWindow = this.activeWindows.get(pluginId);
            if (!existingWindow.closed) {
                existingWindow.focus();
                return;
            } else {
                this.activeWindows.delete(pluginId);
            }
        }

        // 获取插件配置
        const pluginConfig = this.getPluginConfig(pluginId);
        
        // 创建新窗口
        const toolWindow = window.open('', '_blank', 
            'width=1400,height=900,scrollbars=yes,resizable=yes,menubar=no,toolbar=no');
        
        // 生成工具界面HTML
        toolWindow.document.write(this.generateToolHTML(pluginId, pluginConfig));
        toolWindow.document.close();
        
        // 注入脚本和功能
        this.injectToolScripts(toolWindow, pluginId, pluginConfig);
        
        // 记录窗口
        this.activeWindows.set(pluginId, toolWindow);
        
        // 窗口关闭清理
        toolWindow.addEventListener('beforeunload', () => {
            this.activeWindows.delete(pluginId);
        });
        
        toolWindow.focus();
    }

    /**
     * 获取插件配置信息
     */
    getPluginConfig(pluginId) {
        const configs = {
            'network-graph': {
                name: 'Network Graph Viewer',
                description: 'Interactive network visualization for biological networks',
                icon: 'fas fa-project-diagram',
                category: 'Network Analysis',
                testDataTypes: ['protein-network', 'gene-network', 'metabolic-network', 'custom'],
                parameters: [
                    { name: 'nodeRadius', type: 'range', min: 3, max: 20, default: 8, label: 'Node Size' },
                    { name: 'linkDistance', type: 'range', min: 50, max: 300, default: 100, label: 'Link Distance' },
                    { name: 'charge', type: 'range', min: -1000, max: -50, default: -300, label: 'Node Repulsion' },
                    { name: 'showLabels', type: 'checkbox', default: true, label: 'Show Labels' },
                    { name: 'enableDrag', type: 'checkbox', default: true, label: 'Enable Dragging' },
                    { name: 'colorScheme', type: 'select', options: ['type', 'function', 'expression'], default: 'type', label: 'Color Scheme' }
                ]
            },
            'protein-interaction-network': {
                name: 'Protein Interaction Network',
                description: 'Visualize protein-protein interaction networks with biological annotations',
                icon: 'fas fa-atom',
                category: 'Protein Analysis',
                testDataTypes: ['sample-ppi', 'ecoli-proteins', 'human-proteins', 'custom'],
                parameters: [
                    { name: 'confidenceThreshold', type: 'range', min: 0.1, max: 1.0, step: 0.1, default: 0.7, label: 'Confidence Threshold' },
                    { name: 'maxNodes', type: 'range', min: 10, max: 200, default: 50, label: 'Max Nodes' },
                    { name: 'includeComplexes', type: 'checkbox', default: true, label: 'Show Protein Complexes' },
                    { name: 'showDomains', type: 'checkbox', default: false, label: 'Show Protein Domains' }
                ]
            },
            'gene-regulatory-network': {
                name: 'Gene Regulatory Network',
                description: 'Visualize gene regulatory relationships and transcriptional control',
                icon: 'fas fa-dna',
                category: 'Gene Regulation',
                testDataTypes: ['lac-operon', 'ara-operon', 'trp-operon', 'custom'],
                parameters: [
                    { name: 'regulationType', type: 'select', options: ['all', 'activation', 'repression'], default: 'all', label: 'Regulation Type' },
                    { name: 'tissueType', type: 'select', options: ['general', 'liver', 'brain', 'muscle'], default: 'general', label: 'Tissue Context' },
                    { name: 'showTFs', type: 'checkbox', default: true, label: 'Show Transcription Factors' },
                    { name: 'showModules', type: 'checkbox', default: false, label: 'Highlight Regulatory Modules' }
                ]
            },
            'phylogenetic-tree': {
                name: 'Phylogenetic Tree Viewer',
                description: 'Interactive phylogenetic tree visualization and analysis',
                icon: 'fas fa-tree',
                category: 'Evolutionary Analysis',
                testDataTypes: ['bacterial-16s', 'mammalian-genes', 'viral-sequences', 'custom'],
                parameters: [
                    { name: 'treeLayout', type: 'select', options: ['circular', 'rectangular', 'radial'], default: 'rectangular', label: 'Tree Layout' },
                    { name: 'showBootstrap', type: 'checkbox', default: true, label: 'Show Bootstrap Values' },
                    { name: 'showBranchLength', type: 'checkbox', default: true, label: 'Show Branch Lengths' },
                    { name: 'colorByGroup', type: 'checkbox', default: false, label: 'Color by Group' }
                ]
            },
            'sequence-alignment': {
                name: 'Sequence Alignment Viewer',
                description: 'Multiple sequence alignment visualization with conservation analysis',
                icon: 'fas fa-align-left',
                category: 'Sequence Analysis',
                testDataTypes: ['protein-alignment', 'dna-alignment', 'conserved-domains', 'custom'],
                parameters: [
                    { name: 'colorScheme', type: 'select', options: ['clustalx', 'conservation', 'hydrophobicity'], default: 'clustalx', label: 'Color Scheme' },
                    { name: 'showConsensus', type: 'checkbox', default: true, label: 'Show Consensus' },
                    { name: 'showRuler', type: 'checkbox', default: true, label: 'Show Position Ruler' },
                    { name: 'highlightConserved', type: 'checkbox', default: false, label: 'Highlight Conserved Regions' }
                ]
            }
        };
        
        return configs[pluginId] || {
            name: pluginId.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
            description: 'Advanced visualization tool',
            icon: 'fas fa-chart-bar',
            category: 'Visualization',
            testDataTypes: ['sample', 'random'],
            parameters: []
        };
    }

    /**
     * 生成工具界面HTML
     */
    generateToolHTML(pluginId, config) {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.name} - GenomeExplorer</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <style>
        ${this.generateToolCSS()}
    </style>
</head>
<body>
    <div class="tool-container">
        <!-- Header -->
        <div class="tool-header">
            <div class="tool-title">
                <i class="${config.icon}"></i>
                <h1>${config.name}</h1>
                <span class="tool-category">${config.category}</span>
            </div>
            <div class="tool-actions">
                <button id="helpBtn" class="btn btn-secondary">
                    <i class="fas fa-question-circle"></i> Help
                </button>
                <button id="exportBtn" class="btn btn-secondary">
                    <i class="fas fa-download"></i> Export
                </button>
            </div>
        </div>

        <!-- Control Panel -->
        <div class="control-panel">
            <div class="panel-section">
                <h3><i class="fas fa-database"></i> Test Data</h3>
                <div class="data-controls">
                    <select id="dataType" class="form-control">
                        ${config.testDataTypes.map(type => 
                            `<option value="${type}">${this.formatDataTypeName(type)}</option>`
                        ).join('')}
                    </select>
                    <button id="generateBtn" class="btn btn-primary">
                        <i class="fas fa-play"></i> Generate
                    </button>
                </div>
            </div>

            <div class="panel-section">
                <h3><i class="fas fa-sliders-h"></i> Parameters</h3>
                <div class="parameters">
                    ${this.generateParameterControls(config.parameters)}
                </div>
            </div>

            <div class="panel-section">
                <h3><i class="fas fa-info-circle"></i> Status</h3>
                <div class="status-info">
                    <div class="status-item">
                        <span>Status:</span>
                        <span id="statusText" class="status-ready">Ready</span>
                    </div>
                    <div class="status-item">
                        <span>Data:</span>
                        <span id="dataInfo">No data loaded</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Visualization Area -->
        <div class="visualization-area">
            <div class="viz-header">
                <h3><i class="fas fa-chart-area"></i> Visualization</h3>
                <div class="viz-controls">
                    <button id="resetViewBtn" class="btn btn-sm">Reset View</button>
                    <button id="fullscreenBtn" class="btn btn-sm">Fullscreen</button>
                </div>
            </div>
            <div id="visualizationContainer" class="viz-container">
                <div class="viz-placeholder">
                    <i class="${config.icon}"></i>
                    <p>Click "Generate" to create visualization</p>
                    <small>${config.description}</small>
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;
    }

    /**
     * 生成CSS样式
     */
    generateToolCSS() {
        return `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f7fa;
            color: #333;
            overflow: hidden;
        }
        
        .tool-container {
            display: grid;
            grid-template-areas: 
                "header header"
                "control viz";
            grid-template-columns: 350px 1fr;
            grid-template-rows: auto 1fr;
            height: 100vh;
        }
        
        .tool-header {
            grid-area: header;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .tool-title {
            display: flex;
            align-items: center;
            gap: 15px;
        }
        
        .tool-title i {
            font-size: 32px;
        }
        
        .tool-title h1 {
            font-size: 24px;
            font-weight: 600;
        }
        
        .tool-category {
            background: rgba(255,255,255,0.2);
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
        }
        
        .tool-actions {
            display: flex;
            gap: 10px;
        }
        
        .control-panel {
            grid-area: control;
            background: white;
            border-right: 1px solid #e1e8ed;
            padding: 20px;
            overflow-y: auto;
        }
        
        .panel-section {
            margin-bottom: 30px;
        }
        
        .panel-section h3 {
            font-size: 16px;
            margin-bottom: 15px;
            padding-bottom: 8px;
            border-bottom: 2px solid #667eea;
            color: #667eea;
        }
        
        .data-controls {
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
        }
        
        .form-control {
            flex: 1;
            padding: 8px 12px;
            border: 2px solid #e1e8ed;
            border-radius: 6px;
            font-size: 14px;
        }
        
        .form-control:focus {
            outline: none;
            border-color: #667eea;
        }
        
        .parameters {
            space-y: 15px;
        }
        
        .parameter-group {
            margin-bottom: 15px;
        }
        
        .parameter-label {
            display: block;
            font-size: 14px;
            font-weight: 500;
            margin-bottom: 5px;
            color: #555;
        }
        
        .parameter-input {
            width: 100%;
            padding: 8px 12px;
            border: 2px solid #e1e8ed;
            border-radius: 6px;
            font-size: 14px;
        }
        
        .parameter-value {
            font-size: 12px;
            color: #667eea;
            font-weight: 500;
        }
        
        .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }
        
        .btn-primary {
            background: #667eea;
            color: white;
        }
        
        .btn-primary:hover {
            background: #5a6fd8;
            transform: translateY(-1px);
        }
        
        .btn-secondary {
            background: #6c757d;
            color: white;
        }
        
        .btn-secondary:hover {
            background: #5a6268;
        }
        
        .btn-sm {
            padding: 6px 12px;
            font-size: 12px;
        }
        
        .status-info {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 6px;
            border-left: 4px solid #667eea;
        }
        
        .status-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
        }
        
        .status-ready { color: #28a745; font-weight: 500; }
        .status-loading { color: #ffc107; font-weight: 500; }
        .status-error { color: #dc3545; font-weight: 500; }
        
        .visualization-area {
            grid-area: viz;
            background: white;
            display: flex;
            flex-direction: column;
        }
        
        .viz-header {
            padding: 20px;
            border-bottom: 1px solid #e1e8ed;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .viz-controls {
            display: flex;
            gap: 10px;
        }
        
        .viz-container {
            flex: 1;
            padding: 20px;
            overflow: auto;
            position: relative;
        }
        
        .viz-placeholder {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            color: #999;
        }
        
        .viz-placeholder i {
            font-size: 64px;
            margin-bottom: 20px;
            opacity: 0.3;
        }
        
        .viz-placeholder p {
            font-size: 18px;
            margin-bottom: 10px;
        }
        
        .viz-placeholder small {
            font-size: 14px;
            opacity: 0.7;
        }
        
        /* 可视化组件样式 */
        .network-viz svg {
            border: 1px solid #e1e8ed;
            border-radius: 6px;
        }
        
        .loading {
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }
        
        .loading::after {
            content: '';
            width: 16px;
            height: 16px;
            border: 2px solid #f3f3f3;
            border-top: 2px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }`;
    }

    /**
     * 生成参数控件HTML
     */
    generateParameterControls(parameters) {
        return parameters.map(param => {
            let inputHTML = '';
            
            switch (param.type) {
                case 'range':
                    inputHTML = `
                        <input type="range" 
                               id="${param.name}" 
                               class="parameter-input"
                               min="${param.min}" 
                               max="${param.max}" 
                               step="${param.step || 1}"
                               value="${param.default}">
                        <span class="parameter-value" id="${param.name}_value">${param.default}</span>`;
                    break;
                case 'checkbox':
                    inputHTML = `
                        <label>
                            <input type="checkbox" 
                                   id="${param.name}" 
                                   ${param.default ? 'checked' : ''}> 
                            ${param.label}
                        </label>`;
                    break;
                case 'select':
                    inputHTML = `
                        <select id="${param.name}" class="parameter-input">
                            ${param.options.map(opt => 
                                `<option value="${opt}" ${opt === param.default ? 'selected' : ''}>${opt}</option>`
                            ).join('')}
                        </select>`;
                    break;
                default:
                    inputHTML = `<input type="text" id="${param.name}" class="parameter-input" value="${param.default || ''}">`;
            }
            
            return `
                <div class="parameter-group">
                    <label class="parameter-label">${param.label || param.name}</label>
                    ${inputHTML}
                </div>`;
        }).join('');
    }

    /**
     * 格式化数据类型名称
     */
    formatDataTypeName(type) {
        return type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    /**
     * 注入工具脚本和功能
     */
    injectToolScripts(toolWindow, pluginId, config) {
        const script = toolWindow.document.createElement('script');
        script.innerHTML = this.generateToolScript(pluginId, config);
        toolWindow.document.head.appendChild(script);
    }

    /**
     * 生成工具功能脚本
     */
    generateToolScript(pluginId, config) {
        return `
        class VisualizationTool {
            constructor() {
                this.pluginId = '${pluginId}';
                this.config = ${JSON.stringify(config)};
                this.currentData = null;
                this.parameters = {};
                
                this.initializeEventListeners();
                this.initializeParameters();
                
                console.log('VisualizationTool initialized for:', this.pluginId);
            }
            
            initializeEventListeners() {
                // 生成按钮
                document.getElementById('generateBtn').addEventListener('click', () => {
                    this.generateVisualization();
                });
                
                // 参数变化监听
                this.config.parameters.forEach(param => {
                    const element = document.getElementById(param.name);
                    if (element) {
                        if (param.type === 'range') {
                            element.addEventListener('input', (e) => {
                                document.getElementById(param.name + '_value').textContent = e.target.value;
                                this.parameters[param.name] = parseFloat(e.target.value);
                                this.updateVisualization();
                            });
                        } else if (param.type === 'checkbox') {
                            element.addEventListener('change', (e) => {
                                this.parameters[param.name] = e.target.checked;
                                this.updateVisualization();
                            });
                        } else {
                            element.addEventListener('change', (e) => {
                                this.parameters[param.name] = e.target.value;
                                this.updateVisualization();
                            });
                        }
                    }
                });
                
                // 其他按钮
                document.getElementById('resetViewBtn').addEventListener('click', () => {
                    this.resetView();
                });
                
                document.getElementById('exportBtn').addEventListener('click', () => {
                    this.exportVisualization();
                });
                
                document.getElementById('helpBtn').addEventListener('click', () => {
                    this.showHelp();
                });
            }
            
            initializeParameters() {
                this.config.parameters.forEach(param => {
                    this.parameters[param.name] = param.default;
                });
            }
            
            async generateVisualization() {
                const dataType = document.getElementById('dataType').value;
                
                this.setStatus('loading', 'Generating test data...');
                
                try {
                    // 生成测试数据
                    this.currentData = await this.generateTestData(dataType);
                    
                    // 更新数据信息
                    this.updateDataInfo(this.currentData);
                    
                    // 创建可视化
                    await this.createVisualization(this.currentData);
                    
                    this.setStatus('ready', 'Visualization generated successfully');
                    
                } catch (error) {
                    console.error('Error generating visualization:', error);
                    this.setStatus('error', 'Failed to generate visualization: ' + error.message);
                }
            }
            
            async generateTestData(dataType) {
                // 根据插件类型和数据类型生成相应的测试数据
                switch (this.pluginId) {
                    case 'network-graph':
                        return this.generateNetworkTestData(dataType);
                    case 'protein-interaction-network':
                        return this.generateProteinNetworkData(dataType);
                    case 'gene-regulatory-network':
                        return this.generateGeneNetworkData(dataType);
                    case 'phylogenetic-tree':
                        return this.generatePhylogeneticData(dataType);
                    case 'sequence-alignment':
                        return this.generateAlignmentData(dataType);
                    default:
                        return this.generateGenericData(dataType);
                }
            }
            
            generateNetworkTestData(dataType) {
                const nodeCount = 20;
                const nodes = [];
                const edges = [];
                
                // 生成节点
                for (let i = 0; i < nodeCount; i++) {
                    nodes.push({
                        id: 'N' + i,
                        name: 'Node ' + i,
                        type: ['protein', 'gene', 'metabolite'][i % 3],
                        size: 5 + Math.random() * 10,
                        color: this.getNodeColor(['protein', 'gene', 'metabolite'][i % 3])
                    });
                }
                
                // 生成边
                for (let i = 0; i < nodeCount * 1.5; i++) {
                    const source = Math.floor(Math.random() * nodeCount);
                    const target = Math.floor(Math.random() * nodeCount);
                    if (source !== target) {
                        edges.push({
                            source: 'N' + source,
                            target: 'N' + target,
                            weight: Math.random(),
                            type: 'interaction'
                        });
                    }
                }
                
                return {
                    networkType: 'generic',
                    nodes: nodes,
                    edges: edges,
                    metadata: {
                        dataType: dataType,
                        nodeCount: nodes.length,
                        edgeCount: edges.length
                    }
                };
            }
            
            generateProteinNetworkData(dataType) {
                const proteins = [
                    { id: 'P1', name: 'DNA_GYRA', function: 'DNA replication', expression: 0.85 },
                    { id: 'P2', name: 'DNA_GYRB', function: 'DNA replication', expression: 0.78 },
                    { id: 'P3', name: 'SSB_PROTEIN', function: 'DNA binding', expression: 0.92 },
                    { id: 'P4', name: 'DNA_HELICASE', function: 'DNA unwinding', expression: 0.67 },
                    { id: 'P5', name: 'DNA_PRIMASE', function: 'RNA primer synthesis', expression: 0.54 },
                    { id: 'P6', name: 'DNA_POLYMERASE', function: 'DNA synthesis', expression: 0.89 }
                ];
                
                const interactions = [
                    { source: 'P1', target: 'P2', confidence: 0.95, type: 'complex' },
                    { source: 'P3', target: 'P4', confidence: 0.87, type: 'binding' },
                    { source: 'P4', target: 'P5', confidence: 0.76, type: 'sequential' },
                    { source: 'P5', target: 'P6', confidence: 0.82, type: 'sequential' }
                ];
                
                return {
                    networkType: 'protein-interaction',
                    nodes: proteins.map(p => ({
                        ...p,
                        size: 8 + p.expression * 12,
                        color: this.getProteinColor(p.function)
                    })),
                    edges: interactions,
                    metadata: {
                        dataType: dataType,
                        nodeCount: proteins.length,
                        edgeCount: interactions.length
                    }
                };
            }
            
            generateGeneNetworkData(dataType) {
                const genes = [
                    { id: 'G1', name: 'lacI', type: 'transcription_factor', regulation: 'repressor' },
                    { id: 'G2', name: 'lacZ', type: 'gene', regulation: 'regulated' },
                    { id: 'G3', name: 'lacY', type: 'gene', regulation: 'regulated' },
                    { id: 'G4', name: 'lacA', type: 'gene', regulation: 'regulated' },
                    { id: 'G5', name: 'crp', type: 'transcription_factor', regulation: 'activator' }
                ];
                
                const regulations = [
                    { source: 'G1', target: 'G2', type: 'repression', strength: 0.8 },
                    { source: 'G1', target: 'G3', type: 'repression', strength: 0.8 },
                    { source: 'G1', target: 'G4', type: 'repression', strength: 0.8 },
                    { source: 'G5', target: 'G2', type: 'activation', strength: 0.6 },
                    { source: 'G5', target: 'G3', type: 'activation', strength: 0.6 }
                ];
                
                return {
                    networkType: 'gene-regulatory',
                    nodes: genes.map(g => ({
                        ...g,
                        size: g.type === 'transcription_factor' ? 12 : 8,
                        color: this.getGeneColor(g.type)
                    })),
                    edges: regulations,
                    metadata: {
                        dataType: dataType,
                        nodeCount: genes.length,
                        edgeCount: regulations.length
                    }
                };
            }
            
            generatePhylogeneticData(dataType) {
                // Generate phylogenetic tree data
                const species = [
                    { id: 'S1', name: 'E.coli', group: 'Bacteria', distance: 0.1 },
                    { id: 'S2', name: 'S.cerevisiae', group: 'Fungi', distance: 0.3 },
                    { id: 'S3', name: 'H.sapiens', group: 'Mammals', distance: 0.8 },
                    { id: 'S4', name: 'M.musculus', group: 'Mammals', distance: 0.75 },
                    { id: 'S5', name: 'D.melanogaster', group: 'Insects', distance: 0.6 },
                    { id: 'S6', name: 'C.elegans', group: 'Nematodes', distance: 0.5 }
                ];
                
                // Create hierarchical tree structure
                const treeData = {
                    name: 'Common Ancestor',
                    children: [
                        {
                            name: 'Prokaryotes',
                            children: [{ name: 'E.coli', species: 'S1', distance: 0.1 }]
                        },
                        {
                            name: 'Eukaryotes',
                            children: [
                                {
                                    name: 'Fungi',
                                    children: [{ name: 'S.cerevisiae', species: 'S2', distance: 0.3 }]
                                },
                                {
                                    name: 'Animals',
                                    children: [
                                        {
                                            name: 'Vertebrates',
                                            children: [
                                                { name: 'H.sapiens', species: 'S3', distance: 0.8 },
                                                { name: 'M.musculus', species: 'S4', distance: 0.75 }
                                            ]
                                        },
                                        { name: 'D.melanogaster', species: 'S5', distance: 0.6 },
                                        { name: 'C.elegans', species: 'S6', distance: 0.5 }
                                    ]
                                }
                            ]
                        }
                    ]
                };
                
                return {
                    treeType: 'phylogenetic',
                    tree: treeData,
                    species: species,
                    metadata: {
                        dataType: dataType,
                        speciesCount: species.length,
                        treeFormat: 'hierarchical'
                    }
                };
            }
            
            generateAlignmentData(dataType) {
                // Generate sequence alignment data
                const sequences = [
                    {
                        id: 'Seq1',
                        name: 'Human BRCA1',
                        sequence: 'ATGGATTTATCTGCTCTTCGCGTTGAAGAAGTACAAAATGTCATTAATGCTATGCAGAAAATC',
                        length: 60
                    },
                    {
                        id: 'Seq2', 
                        name: 'Mouse BRCA1',
                        sequence: 'ATGGATTTATCTGCTCTTCGCGTTGAAGAAGTACAAAATGTCATTAATGCTATGCAGAAAATC',
                        length: 60
                    },
                    {
                        id: 'Seq3',
                        name: 'Chimp BRCA1', 
                        sequence: 'ATGGATTTATCTGCTCTTCGCGTTGAAGAAGTACAAAATGTCATTAATGCTATGCAGAAAATC',
                        length: 60
                    }
                ];
                
                // Create alignment with consensus
                const alignment = {
                    sequences: sequences,
                    consensus: 'ATGGATTTATCTGCTCTTCGCGTTGAAGAAGTACAAAATGTCATTAATGCTATGCAGAAAATC',
                    conservation: Array(60).fill(1), // All positions conserved for simplicity
                    gaps: Array(60).fill(false)
                };
                
                return {
                    alignmentType: 'multiple',
                    alignment: alignment,
                    metadata: {
                        dataType: dataType,
                        sequenceCount: sequences.length,
                        alignmentLength: 60,
                        conservationScore: 1.0
                    }
                };
            }
            
            generateGenericData(dataType) {
                // Generate generic visualization data
                return {
                    dataType: dataType,
                    title: 'Generic Visualization',
                    description: 'This is a placeholder for ' + dataType + ' visualization',
                    data: {
                        items: [
                            { id: 1, name: 'Item 1', value: Math.random() * 100 },
                            { id: 2, name: 'Item 2', value: Math.random() * 100 },
                            { id: 3, name: 'Item 3', value: Math.random() * 100 },
                            { id: 4, name: 'Item 4', value: Math.random() * 100 },
                            { id: 5, name: 'Item 5', value: Math.random() * 100 }
                        ]
                    },
                    metadata: {
                        dataType: dataType,
                        itemCount: 5
                    }
                };
            }
            
            async createVisualization(data) {
                const container = document.getElementById('visualizationContainer');
                container.innerHTML = ''; // 清空容器
                
                // 根据插件类型创建相应的可视化
                switch (this.pluginId) {
                    case 'network-graph':
                    case 'protein-interaction-network':
                    case 'gene-regulatory-network':
                        await this.createNetworkVisualization(data, container);
                        break;
                    default:
                        await this.createGenericVisualization(data, container);
                }
            }
            
            async createNetworkVisualization(data, container) {
                const width = container.clientWidth - 40;
                const height = container.clientHeight - 40;
                
                // 创建SVG
                const svg = d3.select(container)
                    .append('svg')
                    .attr('width', width)
                    .attr('height', height)
                    .style('border', '1px solid #e1e8ed')
                    .style('border-radius', '6px');
                
                // 添加缩放功能
                const g = svg.append('g');
                const zoom = d3.zoom()
                    .scaleExtent([0.1, 10])
                    .on('zoom', (event) => {
                        g.attr('transform', event.transform);
                    });
                svg.call(zoom);
                
                // 创建力模拟
                const simulation = d3.forceSimulation(data.nodes)
                    .force('link', d3.forceLink(data.edges).id(d => d.id).distance(this.parameters.linkDistance || 100))
                    .force('charge', d3.forceManyBody().strength(this.parameters.charge || -300))
                    .force('center', d3.forceCenter(width / 2, height / 2))
                    .force('collision', d3.forceCollide().radius(d => (d.size || 8) + 2));
                
                // 创建连线
                const links = g.append('g')
                    .selectAll('line')
                    .data(data.edges)
                    .enter().append('line')
                    .attr('stroke', '#999')
                    .attr('stroke-opacity', 0.6)
                    .attr('stroke-width', d => Math.sqrt((d.weight || d.confidence || 1) * 3));
                
                // 创建节点
                const nodes = g.append('g')
                    .selectAll('circle')
                    .data(data.nodes)
                    .enter().append('circle')
                    .attr('r', d => d.size || this.parameters.nodeRadius || 8)
                    .attr('fill', d => d.color || '#4ECDC4')
                    .attr('stroke', '#fff')
                    .attr('stroke-width', 2)
                    .call(d3.drag()
                        .on('start', dragstarted)
                        .on('drag', dragged)
                        .on('end', dragended));
                
                // 添加标签
                if (this.parameters.showLabels !== false) {
                    const labels = g.append('g')
                        .selectAll('text')
                        .data(data.nodes)
                        .enter().append('text')
                        .text(d => d.name || d.id)
                        .attr('font-size', '10px')
                        .attr('text-anchor', 'middle')
                        .attr('dy', d => (d.size || 8) + 12)
                        .attr('fill', '#333');
                        
                    simulation.on('tick', () => {
                        links
                            .attr('x1', d => d.source.x)
                            .attr('y1', d => d.source.y)
                            .attr('x2', d => d.target.x)
                            .attr('y2', d => d.target.y);
                            
                        nodes
                            .attr('cx', d => d.x)
                            .attr('cy', d => d.y);
                            
                        labels
                            .attr('x', d => d.x)
                            .attr('y', d => d.y);
                    });
                } else {
                    simulation.on('tick', () => {
                        links
                            .attr('x1', d => d.source.x)
                            .attr('y1', d => d.source.y)
                            .attr('x2', d => d.target.x)
                            .attr('y2', d => d.target.y);
                            
                        nodes
                            .attr('cx', d => d.x)
                            .attr('cy', d => d.y);
                    });
                }
                
                // 拖拽函数
                function dragstarted(event, d) {
                    if (!event.active) simulation.alphaTarget(0.3).restart();
                    d.fx = d.x;
                    d.fy = d.y;
                }
                
                function dragged(event, d) {
                    d.fx = event.x;
                    d.fy = event.y;
                }
                
                function dragended(event, d) {
                    if (!event.active) simulation.alphaTarget(0);
                    d.fx = null;
                    d.fy = null;
                }
                
                // 存储可视化引用
                this.currentVisualization = { svg, simulation, nodes, links };
            }
            
            async createGenericVisualization(data, container) {
                const width = container.clientWidth - 40;
                const height = container.clientHeight - 40;
                
                // Create a simple visualization based on data type
                if (data.treeType === 'phylogenetic') {
                    this.createPhylogeneticTree(data, container, width, height);
                } else if (data.alignmentType === 'multiple') {
                    this.createSequenceAlignment(data, container, width, height);
                } else {
                    this.createDefaultVisualization(data, container, width, height);
                }
            }
            
            createPhylogeneticTree(data, container, width, height) {
                const svg = d3.select(container)
                    .append('svg')
                    .attr('width', width)
                    .attr('height', height)
                    .style('border', '1px solid #e1e8ed')
                    .style('border-radius', '6px');
                
                const g = svg.append('g')
                    .attr('transform', 'translate(40,20)');
                
                // Create tree layout
                const tree = d3.tree()
                    .size([height - 40, width - 80]);
                
                const root = d3.hierarchy(data.tree);
                tree(root);
                
                // Create links
                g.selectAll('.link')
                    .data(root.descendants().slice(1))
                    .enter().append('path')
                    .attr('class', 'link')
                    .attr('d', d => {
                        const midX = (d.y + d.parent.y) / 2;
                        return 'M' + d.y + ',' + d.x + 'C' + midX + ',' + d.x + ' ' + midX + ',' + d.parent.x + ' ' + d.parent.y + ',' + d.parent.x;
                    })
                    .style('fill', 'none')
                    .style('stroke', '#ccc')
                    .style('stroke-width', 2);
                
                // Create nodes
                const node = g.selectAll('.node')
                    .data(root.descendants())
                    .enter().append('g')
                    .attr('class', 'node')
                    .attr('transform', d => 'translate(' + d.y + ',' + d.x + ')');
                
                node.append('circle')
                    .attr('r', 6)
                    .style('fill', d => d.children ? '#555' : '#999')
                    .style('stroke', '#fff')
                    .style('stroke-width', 2);
                
                node.append('text')
                    .attr('dy', '.35em')
                    .attr('x', d => d.children ? -13 : 13)
                    .style('text-anchor', d => d.children ? 'end' : 'start')
                    .text(d => d.data.name)
                    .style('font-size', '12px')
                    .style('fill', '#333');
                
                this.currentVisualization = { svg };
            }
            
            createSequenceAlignment(data, container, width, height) {
                const svg = d3.select(container)
                    .append('svg')
                    .attr('width', width)
                    .attr('height', height)
                    .style('border', '1px solid #e1e8ed')
                    .style('border-radius', '6px');
                
                const g = svg.append('g')
                    .attr('transform', 'translate(10,20)');
                
                const sequences = data.alignment.sequences;
                const charWidth = 12;
                const lineHeight = 25;
                
                // Color scheme for nucleotides
                const colorScheme = {
                    'A': '#ff4444',
                    'T': '#4444ff', 
                    'G': '#44ff44',
                    'C': '#ffff44'
                };
                
                sequences.forEach((seq, i) => {
                    // Sequence name
                    g.append('text')
                        .attr('x', 0)
                        .attr('y', i * lineHeight + 15)
                        .text(seq.name)
                        .style('font-family', 'monospace')
                        .style('font-size', '12px')
                        .style('fill', '#333');
                    
                    // Sequence characters
                    const chars = seq.sequence.split('');
                    chars.forEach((char, j) => {
                        g.append('text')
                            .attr('x', 120 + j * charWidth)
                            .attr('y', i * lineHeight + 15)
                            .text(char)
                            .style('font-family', 'monospace')
                            .style('font-size', '12px')
                            .style('fill', colorScheme[char] || '#333')
                            .style('font-weight', 'bold');
                    });
                });
                
                this.currentVisualization = { svg };
            }
            
            createDefaultVisualization(data, container, width, height) {
                const svg = d3.select(container)
                    .append('svg')
                    .attr('width', width)
                    .attr('height', height)
                    .style('border', '1px solid #e1e8ed')
                    .style('border-radius', '6px');
                
                const g = svg.append('g')
                    .attr('transform', 'translate(40,40)');
                
                // Create a simple bar chart for generic data
                if (data.data && data.data.items) {
                    const items = data.data.items;
                    const barWidth = (width - 80) / items.length;
                    const maxValue = d3.max(items, d => d.value);
                    const scale = (height - 80) / maxValue;
                    
                    items.forEach((item, i) => {
                        const barHeight = item.value * scale;
                        
                        // Bar
                        g.append('rect')
                            .attr('x', i * barWidth + 10)
                            .attr('y', height - 80 - barHeight)
                            .attr('width', barWidth - 20)
                            .attr('height', barHeight)
                            .style('fill', '#4ECDC4')
                            .style('stroke', '#fff')
                            .style('stroke-width', 1);
                        
                        // Label
                        g.append('text')
                            .attr('x', i * barWidth + barWidth/2)
                            .attr('y', height - 60)
                            .text(item.name)
                            .style('text-anchor', 'middle')
                            .style('font-size', '10px')
                            .style('fill', '#333');
                        
                        // Value
                        g.append('text')
                            .attr('x', i * barWidth + barWidth/2)
                            .attr('y', height - 80 - barHeight - 5)
                            .text(Math.round(item.value))
                            .style('text-anchor', 'middle')
                            .style('font-size', '10px')
                            .style('fill', '#333');
                    });
                } else {
                    // Fallback text
                    g.append('text')
                        .attr('x', width/2 - 40)
                        .attr('y', height/2)
                        .text(data.title || 'Visualization')
                        .style('font-size', '16px')
                        .style('fill', '#333');
                        
                    g.append('text')
                        .attr('x', width/2 - 40)
                        .attr('y', height/2 + 25)
                        .text(data.description || 'No data to display')
                        .style('font-size', '12px')
                        .style('fill', '#666');
                }
                
                this.currentVisualization = { svg };
            }
            
            updateVisualization() {
                if (this.currentData && this.currentVisualization) {
                    // 重新创建可视化以应用新参数
                    setTimeout(() => {
                        this.createVisualization(this.currentData);
                    }, 100);
                }
            }
            
            resetView() {
                if (this.currentVisualization && this.currentVisualization.svg) {
                    // 重置缩放
                    const svg = this.currentVisualization.svg;
                    svg.transition().duration(750).call(
                        d3.zoom().transform,
                        d3.zoomIdentity
                    );
                }
            }
            
            exportVisualization() {
                if (this.currentVisualization && this.currentVisualization.svg) {
                    // 导出SVG
                    const svgElement = this.currentVisualization.svg.node();
                    const serializer = new XMLSerializer();
                    const svgString = serializer.serializeToString(svgElement);
                    
                    const blob = new Blob([svgString], { type: 'image/svg+xml' });
                    const url = URL.createObjectURL(blob);
                    
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = this.pluginId + '_visualization.svg';
                    a.click();
                    
                    URL.revokeObjectURL(url);
                }
            }
            
            showHelp() {
                alert('Help for ' + this.config.name + ':\\n\\n' + this.config.description + '\\n\\nControls:\\n- Use mouse wheel to zoom\\n- Drag to pan\\n- Drag nodes to reposition');
            }
            
            setStatus(type, message) {
                const statusText = document.getElementById('statusText');
                statusText.textContent = message;
                statusText.className = 'status-' + type;
            }
            
            updateDataInfo(data) {
                const dataInfo = document.getElementById('dataInfo');
                if (data.metadata) {
                    dataInfo.textContent = data.metadata.nodeCount + ' nodes, ' + data.metadata.edgeCount + ' edges';
                } else {
                    dataInfo.textContent = 'Data loaded successfully';
                }
            }
            
            getNodeColor(type) {
                const colors = {
                    'protein': '#ff6b6b',
                    'gene': '#4ecdc4',
                    'metabolite': '#45b7d1',
                    'transcription_factor': '#96ceb4',
                    'default': '#95a5a6'
                };
                return colors[type] || colors.default;
            }
            
            getProteinColor(func) {
                const colors = {
                    'DNA replication': '#e74c3c',
                    'DNA binding': '#3498db',
                    'DNA unwinding': '#f39c12',
                    'RNA primer synthesis': '#9b59b6',
                    'DNA synthesis': '#27ae60',
                    'default': '#95a5a6'
                };
                return colors[func] || colors.default;
            }
            
            getGeneColor(type) {
                const colors = {
                    'transcription_factor': '#e67e22',
                    'gene': '#2ecc71',
                    'default': '#95a5a6'
                };
                return colors[type] || colors.default;
            }
        }
        
        // 初始化工具
        const tool = new VisualizationTool();
        `;
    }
}

// 全局导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VisualizationToolsManager;
} else {
    window.VisualizationToolsManager = VisualizationToolsManager;
} 