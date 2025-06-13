/**
 * Circos Genome Plotter - GenomeExplorer
 * A comprehensive circular genome visualization tool with AI-powered parameter control
 */

class CircosPlotter {
    constructor() {
        // Canvas properties
        this.width = 800;
        this.height = 800;
        this.radius = 300;
        this.innerRadiusRatio = 0.3;
        this.innerRadius = this.radius * this.innerRadiusRatio;
        this.startAngle = -90;
        
        // Chromosome properties
        this.chromosomeWidth = 15;
        this.chromosomeGap = 2;
        this.labelDistance = 20;
        this.showLabels = true;
        this.showTicks = false;
        
        // Gene properties
        this.geneHeight = 8;
        this.showGenes = true;
        this.maxGenes = 200;
        
        // Link properties
        this.showLinks = true;
        this.linkOpacity = 0.3;
        this.maxLinks = 50;
        
        // Data track properties
        this.showGCContent = false;
        this.showGCSkew = false;
        this.showWigData = false;
        this.gcWindowSize = 10000;
        this.wigTrackHeight = 30;
        
        // Legend properties
        this.showLegend = true;
        this.legendPosition = 'top-right';
        this.legendOpacity = 0.95;
        
        // Chromosome ordering
        this.chromosomeOrder = 'default';
        this.originalChromosomeOrder = null;
        
        // Color themes - comprehensive design system for CNS-level publications
        this.colorThemes = {
            scientific: {
                name: 'Scientific',
                description: 'Professional academic style for high-impact publications',
                chromosomes: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf', '#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5', '#c49c94', '#f7b6d3', '#c7c7c7', '#dbdb8d', '#9edae5', '#393b79', '#637939', '#8c6d31', '#843c39'],
                background: '#ffffff',
                stroke: '#2c3e50',
                genes: {
                    protein_coding: '#27ae60',
                    non_coding: '#f39c12',
                    pseudogene: '#e74c3c',
                    regulatory: '#8e44ad',
                    default: '#7f8c8d'
                },
                tracks: {
                    gc_content: '#27ae60',
                    gc_skew: '#e74c3c',
                    wig_data: '#9b59b6',
                    expression_high: '#e74c3c',
                    expression_medium: '#f39c12',
                    expression_low: '#3498db',
                    baseline: '#bdc3c7'
                },
                links: {
                    strong: '#2c3e50',
                    medium: '#34495e',
                    weak: '#7f8c8d',
                    gradient: ['#3498db', '#e74c3c']
                },
                text: '#2c3e50',
                ticks: '#7f8c8d',
                legend: {
                    background: '#f8f9fa',
                    border: '#dee2e6',
                    text: '#2c3e50'
                }
            },
                         nature: {
                 name: 'Nature',
                 description: 'Earth-tone palette for ecological and plant genomics',
                 chromosomes: ['#2d5016', '#4a7c59', '#6b9080', '#a4c3a2', '#84a98c', '#52796f', '#354f52', '#2f3e46', '#588157', '#3a5a40', '#344e41', '#dad7cd', '#a3b18a', '#588157', '#3a5a40', '#606c38', '#283618', '#fefae0', '#dda15e', '#bc6c25', '#8b5cf6', '#a855f7', '#9333ea', '#7c3aed'],
                 background: '#fefae0',
                 stroke: '#283618',
                 genes: {
                     protein_coding: '#2d5016',
                     non_coding: '#bc6c25',
                     pseudogene: '#8b5cf6',
                     regulatory: '#6b9080',
                     default: '#606c38'
                 },
                 tracks: {
                     gc_content: '#2d5016',
                     gc_skew: '#bc6c25',
                     wig_data: '#8b5cf6',
                     expression_high: '#8b5cf6',
                     expression_medium: '#bc6c25',
                     expression_low: '#6b9080',
                     baseline: '#a3b18a'
                 },
                 links: {
                     strong: '#2d5016',
                     medium: '#4a7c59',
                     weak: '#84a98c',
                     gradient: ['#6b9080', '#bc6c25']
                 },
                 text: '#283618',
                 ticks: '#606c38',
                 legend: {
                     background: '#f7f3e9',
                     border: '#d4c5a9',
                     text: '#283618'
                 }
             },
                         ocean: {
                 name: 'Ocean',
                 description: 'Deep blue gradient for marine biology and aquatic genomics',
                 chromosomes: ['#003f5c', '#2f4b7c', '#665191', '#a05195', '#d45087', '#f95d6a', '#ff7c43', '#ffa600', '#0077be', '#00a8cc', '#7dd3c0', '#d4f1f4', '#006ba6', '#0496c7', '#5fbdbd', '#7dd3c0', '#a2d5f2', '#bee9e8', '#62b6cb', '#1b4965', '#cae9ff', '#5fa8d3', '#1b4965', '#bee9e8'],
                 background: '#f0f9ff',
                 stroke: '#1b4965',
                 genes: {
                     protein_coding: '#0077be',
                     non_coding: '#ff7c43',
                     pseudogene: '#a05195',
                     regulatory: '#665191',
                     default: '#5fbdbd'
                 },
                 tracks: {
                     gc_content: '#0077be',
                     gc_skew: '#ff7c43',
                     wig_data: '#a05195',
                     expression_high: '#d45087',
                     expression_medium: '#ff7c43',
                     expression_low: '#7dd3c0',
                     baseline: '#bee9e8'
                 },
                 links: {
                     strong: '#003f5c',
                     medium: '#2f4b7c',
                     weak: '#7dd3c0',
                     gradient: ['#0077be', '#ff7c43']
                 },
                 text: '#1b4965',
                 ticks: '#006ba6',
                 legend: {
                     background: '#e6f3ff',
                     border: '#b3d9ff',
                     text: '#1b4965'
                 }
             },
                         sunset: {
                 name: 'Sunset',
                 description: 'Warm gradient palette for presentations and outreach',
                 chromosomes: ['#ff6b35', '#f7931e', '#ffd23f', '#06ffa5', '#1fb3d3', '#5d737e', '#64b6ac', '#c0fdfb', '#daffef', '#fcf5c7', '#aafcb8', '#cf1259', '#f71735', '#fb8500', '#ffb700', '#8ecae6', '#219ebc', '#023047', '#ffb3c6', '#fb8500', '#8ecae6', '#219ebc', '#023047', '#ffb3c6'],
                 background: '#fff8f0',
                 stroke: '#8b4513',
                 genes: {
                     protein_coding: '#06ffa5',
                     non_coding: '#ff6b35',
                     pseudogene: '#cf1259',
                     regulatory: '#1fb3d3',
                     default: '#5d737e'
                 },
                 tracks: {
                     gc_content: '#06ffa5',
                     gc_skew: '#ff6b35',
                     wig_data: '#cf1259',
                     expression_high: '#f71735',
                     expression_medium: '#f7931e',
                     expression_low: '#64b6ac',
                     baseline: '#c0fdfb'
                 },
                 links: {
                     strong: '#8b4513',
                     medium: '#cf1259',
                     weak: '#64b6ac',
                     gradient: ['#ff6b35', '#06ffa5']
                 },
                 text: '#8b4513',
                 ticks: '#023047',
                 legend: {
                     background: '#fef7f0',
                     border: '#f4d1ae',
                     text: '#8b4513'
                 }
             },
                         arctic: {
                 name: 'Arctic',
                 description: 'Cool blue monochrome for cold adaptation studies',
                 chromosomes: ['#e8f4f8', '#d1ecf1', '#b8e0ea', '#9fd3e2', '#85c5da', '#6bb6d2', '#52a6ca', '#3895c2', '#1f83ba', '#0570b0', '#045a8d', '#023858', '#74a9cf', '#2b8cbe', '#045a8d', '#023858', '#a6bddb', '#74a9cf', '#3690c0', '#0570b0', '#034e7b', '#012840', '#41b6c4', '#2c7fb8'],
                 background: '#f7fcfd',
                 stroke: '#023858',
                 genes: {
                     protein_coding: '#0570b0',
                     non_coding: '#41b6c4',
                     pseudogene: '#2c7fb8',
                     regulatory: '#3895c2',
                     default: '#74a9cf'
                 },
                 tracks: {
                     gc_content: '#0570b0',
                     gc_skew: '#41b6c4',
                     wig_data: '#2c7fb8',
                     expression_high: '#023858',
                     expression_medium: '#045a8d',
                     expression_low: '#b8e0ea',
                     baseline: '#d1ecf1'
                 },
                 links: {
                     strong: '#023858',
                     medium: '#0570b0',
                     weak: '#85c5da',
                     gradient: ['#023858', '#41b6c4']
                 },
                 text: '#023858',
                 ticks: '#045a8d',
                 legend: {
                     background: '#f0f8ff',
                     border: '#c6e2ff',
                     text: '#023858'
                 }
             },
                         cosmic: {
                 name: 'Cosmic',
                 description: 'Dark space theme for presentations and night mode',
                 chromosomes: ['#0d1b2a', '#1b263b', '#415a77', '#778da9', '#e0e1dd', '#7209b7', '#a663cc', '#4cc9f0', '#7209b7', '#f72585', '#b5179e', '#7209b7', '#480ca8', '#3a0ca3', '#3f37c9', '#7209b7', '#f72585', '#4cc9f0', '#4361ee', '#4895ef', '#4cc9f0', '#00f5ff', '#7209b7', '#f72585'],
                 background: '#0d1b2a',
                 stroke: '#e0e1dd',
                 genes: {
                     protein_coding: '#4cc9f0',
                     non_coding: '#f72585',
                     pseudogene: '#7209b7',
                     regulatory: '#a663cc',
                     default: '#778da9'
                 },
                 tracks: {
                     gc_content: '#4cc9f0',
                     gc_skew: '#f72585',
                     wig_data: '#7209b7',
                     expression_high: '#f72585',
                     expression_medium: '#a663cc',
                     expression_low: '#4cc9f0',
                     baseline: '#415a77'
                 },
                 links: {
                     strong: '#e0e1dd',
                     medium: '#a663cc',
                     weak: '#778da9',
                     gradient: ['#4cc9f0', '#f72585']
                 },
                 text: '#e0e1dd',
                 ticks: '#778da9',
                 legend: {
                     background: '#1b263b',
                     border: '#415a77',
                     text: '#e0e1dd'
                 }
             },
                         forest: {
                 name: 'Forest',
                 description: 'Rich green palette for plant genomics and ecology',
                 chromosomes: ['#2d5016', '#52734d', '#91c788', '#b7d3aa', '#c7d59f', '#e0e5b6', '#f3e8d0', '#8b5a3c', '#a0522d', '#cd853f', '#daa520', '#228b22', '#32cd32', '#9acd32', '#adff2f', '#7cfc00', '#00ff00', '#00ff7f', '#00fa9a', '#90ee90', '#98fb98', '#f0fff0', '#006400', '#008000'],
                 background: '#f5f5dc',
                 stroke: '#2d5016',
                 genes: {
                     protein_coding: '#228b22',
                     non_coding: '#cd853f',
                     pseudogene: '#8b5a3c',
                     regulatory: '#91c788',
                     default: '#52734d'
                 },
                 tracks: {
                     gc_content: '#228b22',
                     gc_skew: '#cd853f',
                     wig_data: '#8b5a3c',
                     expression_high: '#006400',
                     expression_medium: '#32cd32',
                     expression_low: '#b7d3aa',
                     baseline: '#c7d59f'
                 },
                 links: {
                     strong: '#2d5016',
                     medium: '#52734d',
                     weak: '#91c788',
                     gradient: ['#228b22', '#cd853f']
                 },
                 text: '#2d5016',
                 ticks: '#006400',
                 legend: {
                     background: '#f0f8f0',
                     border: '#c8e6c8',
                     text: '#2d5016'
                 }
             },
                         monochrome: {
                 name: 'Monochrome',
                 description: 'Grayscale palette for print publications and accessibility',
                 chromosomes: ['#000000', '#1a1a1a', '#333333', '#4d4d4d', '#666666', '#808080', '#999999', '#b3b3b3', '#cccccc', '#e6e6e6', '#f2f2f2', '#0f0f0f', '#262626', '#404040', '#595959', '#737373', '#8c8c8c', '#a6a6a6', '#bfbfbf', '#d9d9d9', '#f0f0f0', '#1f1f1f', '#383838', '#525252'],
                 background: '#ffffff',
                 stroke: '#000000',
                 genes: {
                     protein_coding: '#000000',
                     non_coding: '#4d4d4d',
                     pseudogene: '#808080',
                     regulatory: '#333333',
                     default: '#999999'
                 },
                 tracks: {
                     gc_content: '#000000',
                     gc_skew: '#4d4d4d',
                     wig_data: '#666666',
                     expression_high: '#000000',
                     expression_medium: '#4d4d4d',
                     expression_low: '#b3b3b3',
                     baseline: '#cccccc'
                 },
                 links: {
                     strong: '#000000',
                     medium: '#4d4d4d',
                     weak: '#999999',
                     gradient: ['#000000', '#808080']
                 },
                 text: '#000000',
                 ticks: '#333333',
                 legend: {
                     background: '#f8f8f8',
                     border: '#cccccc',
                     text: '#000000'
                 }
             }
        };
        
        // Current theme
        this.currentTheme = 'scientific';
        
        // Legacy color scheme support (for backward compatibility)
        this.colorScheme = 'category10';
        this.colorSchemes = {
            category10: this.colorThemes.scientific.chromosomes,
            rainbow: this.colorThemes.sunset.chromosomes,
            blues: this.colorThemes.ocean.chromosomes,
            greens: this.colorThemes.forest.chromosomes,
            reds: this.colorThemes.sunset.chromosomes,
            viridis: this.colorThemes.nature.chromosomes,
            pastel: this.colorThemes.arctic.chromosomes,
            dark: this.colorThemes.cosmic.chromosomes
        };
        
        // Apply current theme colors
        this.applyTheme(this.currentTheme);
        
        // Data
        this.data = null;
        
        // SVG reference
        this.svg = null;
        
        // Initialize tooltip
        this.tooltip = d3.select('body').append('div')
            .attr('class', 'tooltip')
            .style('position', 'absolute')
            .style('padding', '10px')
            .style('background', 'rgba(0, 0, 0, 0.8)')
            .style('color', 'white')
            .style('border-radius', '5px')
            .style('pointer-events', 'none')
            .style('opacity', 0)
            .style('font-size', '12px')
            .style('z-index', '1000');
        
        // Initialize
        this.initializeUI();
        this.setupEventListeners();
        this.loadExampleData();
    }
    
    applyTheme(themeName) {
        const theme = this.colorThemes[themeName];
        if (!theme) return;
        
        this.currentTheme = themeName;
        this.backgroundColor = theme.background;
        this.strokeColor = theme.stroke;
        this.strokeWidth = 1;
        
        // Update UI elements
        if (document.getElementById('backgroundColorPicker')) {
            document.getElementById('backgroundColorPicker').value = theme.background;
        }
        if (document.getElementById('strokeColorPicker')) {
            document.getElementById('strokeColorPicker').value = theme.stroke;
        }
        
        // Force redraw if data exists
        if (this.data) {
            this.redrawPlot();
        }
    }
    
    getCurrentTheme() {
        return this.colorThemes[this.currentTheme];
    }

    initializeUI() {
        // Check if required DOM elements exist
        const requiredElements = ['statusDot', 'statusText', 'tooltip'];
        for (const elementId of requiredElements) {
            if (!document.getElementById(elementId)) {
                console.error(`Required element #${elementId} not found`);
                return false;
            }
        }
        
        // Hide loading indicator and show ready status
        document.getElementById('statusDot').className = 'status-dot connected';
        document.getElementById('statusText').textContent = 'Ready';
        
        // Initialize tooltip
        this.tooltip = d3.select('#tooltip');
        
        // Initialize parameter values
        this.updateParameterDisplays();
        
        console.log('CircosPlotter UI initialized successfully');
        
        return true;
    }

    calculateOptimalSize() {
        const container = document.getElementById('circosContainer');
        if (!container) return;
        
        const containerRect = container.getBoundingClientRect();
        const padding = 40; // Total padding around the plot
        
        // Calculate the maximum square size that fits in the container
        const maxSize = Math.min(containerRect.width, containerRect.height) - padding;
        
        this.width = Math.max(400, maxSize); // Minimum 400px
        this.height = this.width; // Keep it square
        
        // Adjust radius to fit nicely in the new size
        this.radius = Math.min(this.width, this.height) * 0.35; // 35% of the smaller dimension
        this.innerRadius = this.radius * this.innerRadiusRatio;
        
        // Update the radius slider to match
        const radiusSlider = document.getElementById('radiusSlider');
        if (radiusSlider) {
            radiusSlider.max = this.radius * 1.5;
            radiusSlider.value = this.radius;
        }
        
        this.updateParameterDisplays();
        
        console.log(`Calculated optimal size: ${this.width}x${this.height}, radius: ${this.radius}`);
    }

    setupEventListeners() {
        // Toolbar buttons
        document.getElementById('loadDataBtn').addEventListener('click', () => this.loadDataFile());
        document.getElementById('exampleDataBtn').addEventListener('click', () => this.loadExampleData());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportSVG());
        document.getElementById('resetBtn').addEventListener('click', () => this.resetPlot());
        document.getElementById('helpBtn').addEventListener('click', () => this.showHelp());
        
        // Basic parameter controls
        document.getElementById('radiusSlider').addEventListener('input', (e) => {
            this.radius = parseInt(e.target.value);
            this.innerRadius = this.radius * this.innerRadiusRatio;
            this.updateParameterDisplays();
            this.redrawPlot();
        });
        
        document.getElementById('innerRadiusSlider').addEventListener('input', (e) => {
            this.innerRadiusRatio = parseFloat(e.target.value);
            this.innerRadius = this.radius * this.innerRadiusRatio;
            this.updateParameterDisplays();
            this.redrawPlot();
        });
        
        document.getElementById('startAngleSlider').addEventListener('input', (e) => {
            this.startAngle = parseInt(e.target.value);
            this.updateParameterDisplays();
            this.redrawPlot();
        });
        
        // Chromosome controls
        document.getElementById('chrWidthSlider').addEventListener('input', (e) => {
            this.chromosomeWidth = parseInt(e.target.value);
            this.updateParameterDisplays();
            this.redrawPlot();
        });
        
        document.getElementById('gapSlider').addEventListener('input', (e) => {
            this.chromosomeGap = parseFloat(e.target.value);
            this.updateParameterDisplays();
            this.redrawPlot();
        });
        
        document.getElementById('labelDistanceSlider').addEventListener('input', (e) => {
            this.labelDistance = parseInt(e.target.value);
            this.updateParameterDisplays();
            this.redrawPlot();
        });
        
        // Checkbox controls
        document.getElementById('showLabelsCheck').addEventListener('change', (e) => {
            this.showLabels = e.target.checked;
            this.redrawPlot();
        });
        
        document.getElementById('showTicksCheck').addEventListener('change', (e) => {
            this.showTicks = e.target.checked;
            this.redrawPlot();
        });
        
        document.getElementById('showGenesCheck').addEventListener('change', (e) => {
            this.showGenes = e.target.checked;
            this.redrawPlot();
        });
        
        document.getElementById('showLinksCheck').addEventListener('change', (e) => {
            this.showLinks = e.target.checked;
            this.redrawPlot();
        });
        
        // Theme controls
        document.getElementById('themeSelect').addEventListener('change', (e) => {
            this.applyTheme(e.target.value);
        });
        
        document.getElementById('backgroundColorPicker').addEventListener('input', (e) => {
            this.backgroundColor = e.target.value;
            this.redrawPlot();
        });
        
        document.getElementById('strokeColorPicker').addEventListener('input', (e) => {
            this.strokeColor = e.target.value;
            this.redrawPlot();
        });
        
        document.getElementById('strokeWidthSlider').addEventListener('input', (e) => {
            this.strokeWidth = parseFloat(e.target.value);
            this.updateParameterDisplays();
            this.redrawPlot();
        });
        
        // Track controls
        document.getElementById('geneHeightSlider').addEventListener('input', (e) => {
            this.geneHeight = parseInt(e.target.value);
            this.updateParameterDisplays();
            this.redrawPlot();
        });
        
        document.getElementById('linkOpacitySlider').addEventListener('input', (e) => {
            this.linkOpacity = parseFloat(e.target.value);
            this.updateParameterDisplays();
            this.redrawPlot();
        });
        
        document.getElementById('maxGenesSlider').addEventListener('input', (e) => {
            this.maxGenes = parseInt(e.target.value);
            this.updateParameterDisplays();
            this.redrawPlot();
        });
        
        document.getElementById('maxLinksSlider').addEventListener('input', (e) => {
            this.maxLinks = parseInt(e.target.value);
            this.updateParameterDisplays();
            this.redrawPlot();
        });
        
        // Sample data buttons
        document.getElementById('loadHumanBtn').addEventListener('click', () => this.loadHumanData());
        document.getElementById('loadEcoliBtn').addEventListener('click', () => this.loadEcoliData());
        document.getElementById('loadYeastBtn').addEventListener('click', () => this.loadYeastData());
        document.getElementById('loadDrosaBtn').addEventListener('click', () => this.loadDrosophilaData());
        document.getElementById('loadPlantBtn').addEventListener('click', () => this.loadPlantData());
        document.getElementById('loadVirusBtn').addEventListener('click', () => this.loadVirusData());
        
        // Data track controls
        document.getElementById('showGCContentCheck').addEventListener('change', (e) => {
            this.showGCContent = e.target.checked;
            this.redrawPlot();
        });
        
        document.getElementById('showGCSkewCheck').addEventListener('change', (e) => {
            this.showGCSkew = e.target.checked;
            this.redrawPlot();
        });
        
        document.getElementById('showWigDataCheck').addEventListener('change', (e) => {
            this.showWigData = e.target.checked;
            this.redrawPlot();
        });
        
        document.getElementById('gcWindowSlider').addEventListener('input', (e) => {
            this.gcWindowSize = parseInt(e.target.value);
            this.updateParameterDisplays();
            if (this.showGCContent || this.showGCSkew) {
                this.redrawPlot();
            }
        });
        
        document.getElementById('wigHeightSlider').addEventListener('input', (e) => {
            this.wigTrackHeight = parseInt(e.target.value);
            this.updateParameterDisplays();
            this.redrawPlot();
        });
        
        // Chromosome order controls
        document.getElementById('chromosomeOrderSelect').addEventListener('change', (e) => {
            this.chromosomeOrder = e.target.value;
            this.applyChromosomeOrder();
        });
        
        document.getElementById('shuffleOrderBtn').addEventListener('click', () => {
            this.shuffleChromosomes();
        });
        
        document.getElementById('applyOrderBtn').addEventListener('click', () => {
            this.applyChromosomeOrder();
        });
        
        // Export buttons
        document.getElementById('exportSvgBtn').addEventListener('click', () => this.exportSVG());
        document.getElementById('exportPngBtn').addEventListener('click', () => this.exportPNG());
        
        // Legend controls
        document.getElementById('showLegendCheck').addEventListener('change', (e) => {
            this.showLegend = e.target.checked;
            this.redrawPlot();
        });
        
        document.getElementById('legendPositionSelect').addEventListener('change', (e) => {
            this.legendPosition = e.target.value;
            this.redrawPlot();
        });
        
        document.getElementById('legendOpacitySlider').addEventListener('input', (e) => {
            this.legendOpacity = parseFloat(e.target.value);
            this.updateParameterDisplays();
            this.redrawPlot();
        });
        
        // Window resize handler
        window.addEventListener('resize', () => {
            this.calculateOptimalSize();
            this.redrawPlot();
        });
    }

    updateParameterDisplays() {
        // Safe updates with existence checks
        const updates = {
            'radiusValue': `${Math.round(this.radius)}px`,
            'innerRadiusValue': `${Math.round(this.innerRadiusRatio * 100)}%`,
            'startAngleValue': `${this.startAngle}°`,
            'chrWidthValue': `${this.chromosomeWidth}px`,
            'gapValue': `${this.chromosomeGap}°`,
            'labelDistanceValue': `${this.labelDistance}px`,
            'strokeWidthValue': `${this.strokeWidth}px`,
            'geneHeightValue': `${this.geneHeight}px`,
            'linkOpacityValue': `${Math.round(this.linkOpacity * 100)}%`,
            'maxGenesValue': `${this.maxGenes}`,
            'maxLinksValue': `${this.maxLinks}`,
            'gcWindowValue': `${Math.round(this.gcWindowSize / 1000)}kb`,
            'wigHeightValue': `${this.wigTrackHeight}px`,
            'legendOpacityValue': `${Math.round(this.legendOpacity * 100)}%`
        };
        
        Object.entries(updates).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
    }

    loadExampleData() {
        this.loadHumanData();
    }

    loadHumanData() {
        // Human genome data (GRCh38)
        this.data = {
            title: 'Human Genome (Homo sapiens)',
            chromosomes: [
                { name: 'chr1', length: 248956422, color: '#1f77b4' },
                { name: 'chr2', length: 242193529, color: '#ff7f0e' },
                { name: 'chr3', length: 198295559, color: '#2ca02c' },
                { name: 'chr4', length: 190214555, color: '#d62728' },
                { name: 'chr5', length: 181538259, color: '#9467bd' },
                { name: 'chr6', length: 170805979, color: '#8c564b' },
                { name: 'chr7', length: 159345973, color: '#e377c2' },
                { name: 'chr8', length: 145138636, color: '#7f7f7f' },
                { name: 'chr9', length: 138394717, color: '#bcbd22' },
                { name: 'chr10', length: 133797422, color: '#17becf' },
                { name: 'chr11', length: 135086622, color: '#aec7e8' },
                { name: 'chr12', length: 133275309, color: '#ffbb78' },
                { name: 'chr13', length: 114364328, color: '#98df8a' },
                { name: 'chr14', length: 107043718, color: '#ff9896' },
                { name: 'chr15', length: 101991189, color: '#c5b0d5' },
                { name: 'chr16', length: 90338345, color: '#c49c94' },
                { name: 'chr17', length: 83257441, color: '#f7b6d3' },
                { name: 'chr18', length: 80373285, color: '#c7c7c7' },
                { name: 'chr19', length: 58617616, color: '#dbdb8d' },
                { name: 'chr20', length: 64444167, color: '#9edae5' },
                { name: 'chr21', length: 46709983, color: '#ad494a' },
                { name: 'chr22', length: 50818468, color: '#8c6d31' },
                { name: 'chrX', length: 156040895, color: '#756bb1' },
                { name: 'chrY', length: 57227415, color: '#636363' }
            ],
            genes: [],
            links: []
        };
        
        // Generate example genes and links
        this.data.genes = this.generateHumanGenes();
        this.data.links = this.generateHumanLinks();
        
        this.updateStatus('Human genome loaded: 24 chromosomes');
        this.createPlot();
    }

    updateStatus(message) {
        const statusText = document.getElementById('statusText');
        if (statusText) {
            statusText.textContent = message;
        }
        console.log('Status:', message);
    }

    loadEcoliData() {
        // E. coli K-12 MG1655 genome
        this.data = {
            title: 'E. coli K-12 MG1655',
            chromosomes: [
                { name: 'chromosome', length: 4641652, color: '#2ca02c' }
            ],
            genes: [
                { chromosome: 'chromosome', start: 190, end: 255, name: 'thrL', type: 'protein_coding', value: 0.8 },
                { chromosome: 'chromosome', start: 337, end: 2799, name: 'thrA', type: 'protein_coding', value: 0.9 },
                { chromosome: 'chromosome', start: 2801, end: 3733, name: 'thrB', type: 'protein_coding', value: 0.85 },
                { chromosome: 'chromosome', start: 3734, end: 5020, name: 'thrC', type: 'protein_coding', value: 0.75 },
                { chromosome: 'chromosome', start: 5234, end: 5530, name: 'yaaX', type: 'protein_coding', value: 0.6 },
                { chromosome: 'chromosome', start: 336000, end: 336879, name: 'lacI', type: 'protein_coding', value: 0.95 },
                { chromosome: 'chromosome', start: 365000, end: 368200, name: 'lacZ', type: 'protein_coding', value: 0.92 },
                { chromosome: 'chromosome', start: 368284, end: 369350, name: 'lacY', type: 'protein_coding', value: 0.88 },
                { chromosome: 'chromosome', start: 369363, end: 370013, name: 'lacA', type: 'protein_coding', value: 0.78 }
            ],
            links: []
        };
        
        // Generate additional E. coli genes
        this.data.genes = this.data.genes.concat(this.generateEcoliGenes());
        this.data.links = this.generateEcoliLinks();
        
        this.updateStatus('E. coli genome loaded: 1 chromosome');
        this.createPlot();
    }

    loadYeastData() {
        // S. cerevisiae genome
        this.data = {
            title: 'Saccharomyces cerevisiae',
            chromosomes: [
                { name: 'chrI', length: 230218, color: '#ff6b6b' },
                { name: 'chrII', length: 813184, color: '#4ecdc4' },
                { name: 'chrIII', length: 316620, color: '#45b7d1' },
                { name: 'chrIV', length: 1531933, color: '#f9ca24' },
                { name: 'chrV', length: 576874, color: '#f0932b' },
                { name: 'chrVI', length: 270161, color: '#eb4d4b' },
                { name: 'chrVII', length: 1090940, color: '#6c5ce7' },
                { name: 'chrVIII', length: 562643, color: '#a29bfe' },
                { name: 'chrIX', length: 439888, color: '#fd79a8' },
                { name: 'chrX', length: 745751, color: '#fdcb6e' },
                { name: 'chrXI', length: 666816, color: '#e17055' },
                { name: 'chrXII', length: 1078177, color: '#00b894' },
                { name: 'chrXIII', length: 924431, color: '#00cec9' },
                { name: 'chrXIV', length: 784333, color: '#0984e3' },
                { name: 'chrXV', length: 1091291, color: '#74b9ff' },
                { name: 'chrXVI', length: 948066, color: '#e84393' }
            ],
            genes: [],
            links: []
        };
        
        this.data.genes = this.generateYeastGenes();
        this.data.links = this.generateYeastLinks();
        
        this.updateStatus('Yeast genome loaded: 16 chromosomes');
        this.createPlot();
    }

    loadDrosophilaData() {
        // Drosophila melanogaster genome
        this.data = {
            title: 'Drosophila melanogaster',
            chromosomes: [
                { name: 'chrX', length: 23542271, color: '#e74c3c' },
                { name: 'chr2L', length: 23513712, color: '#3498db' },
                { name: 'chr2R', length: 25286936, color: '#2ecc71' },
                { name: 'chr3L', length: 28110227, color: '#f39c12' },
                { name: 'chr3R', length: 32079331, color: '#9b59b6' },
                { name: 'chr4', length: 1348131, color: '#1abc9c' }
            ],
            genes: [],
            links: []
        };
        
        this.data.genes = this.generateDrosophilaGenes();
        this.data.links = this.generateDrosophilaLinks();
        
        this.updateStatus('Drosophila genome loaded: 6 chromosomes');
        this.createPlot();
    }

    loadPlantData() {
        // Arabidopsis thaliana genome
        this.data = {
            title: 'Arabidopsis thaliana',
            chromosomes: [
                { name: 'chr1', length: 30427671, color: '#27ae60' },
                { name: 'chr2', length: 19698289, color: '#2ecc71' },
                { name: 'chr3', length: 23459830, color: '#16a085' },
                { name: 'chr4', length: 18585056, color: '#1abc9c' },
                { name: 'chr5', length: 26975502, color: '#52c41a' }
            ],
            genes: [],
            links: []
        };
        
        this.data.genes = this.generatePlantGenes();
        this.data.links = this.generatePlantLinks();
        
        this.updateStatus('Plant genome loaded: 5 chromosomes');
        this.createPlot();
    }

    loadVirusData() {
        // SARS-CoV-2 genome
        this.data = {
            title: 'SARS-CoV-2',
            chromosomes: [
                { name: 'genome', length: 29903, color: '#e74c3c' }
            ],
            genes: [
                { chromosome: 'genome', start: 266, end: 21555, name: 'ORF1ab', type: 'protein_coding', value: 0.95 },
                { chromosome: 'genome', start: 21563, end: 25384, name: 'S', type: 'protein_coding', value: 0.98 },
                { chromosome: 'genome', start: 25393, end: 26220, name: 'ORF3a', type: 'protein_coding', value: 0.7 },
                { chromosome: 'genome', start: 26245, end: 26472, name: 'E', type: 'protein_coding', value: 0.8 },
                { chromosome: 'genome', start: 26523, end: 27191, name: 'M', type: 'protein_coding', value: 0.9 },
                { chromosome: 'genome', start: 27202, end: 27387, name: 'ORF6', type: 'protein_coding', value: 0.6 },
                { chromosome: 'genome', start: 27394, end: 27759, name: 'ORF7a', type: 'protein_coding', value: 0.65 },
                { chromosome: 'genome', start: 27756, end: 27887, name: 'ORF7b', type: 'protein_coding', value: 0.55 },
                { chromosome: 'genome', start: 27894, end: 28259, name: 'ORF8', type: 'protein_coding', value: 0.7 },
                { chromosome: 'genome', start: 28274, end: 29533, name: 'N', type: 'protein_coding', value: 0.92 },
                { chromosome: 'genome', start: 29558, end: 29674, name: 'ORF10', type: 'protein_coding', value: 0.5 }
            ],
            links: []
        };
        
        this.updateStatus('Virus genome loaded: 1 chromosome');
        this.createPlot();
    }

    generateHumanGenes() {
        const genes = [];
        const geneNames = ['BRCA1', 'TP53', 'EGFR', 'MYC', 'KRAS', 'PIK3CA', 'PTEN', 'RB1', 'APC', 'VHL', 'CDKN2A', 'MLH1', 'BRCA2', 'ATM', 'CHEK2', 'PALB2', 'CDH1', 'STK11', 'SMAD4', 'DCC', 'TERT', 'IDH1', 'ARID1A', 'CTNNB1', 'FBXW7'];
        const geneTypes = ['protein_coding', 'non_coding', 'pseudogene', 'regulatory'];
        const typeWeights = [0.6, 0.2, 0.15, 0.05]; // Realistic distribution
        
        this.data.chromosomes.forEach((chr, chrIndex) => {
            const numGenes = Math.floor(Math.random() * 30) + 15; // 15-45 genes per chromosome
            for (let i = 0; i < numGenes; i++) {
                const start = Math.floor(Math.random() * (chr.length - 100000));
                const length = Math.floor(Math.random() * 95000) + 5000; // 5-100kb genes
                
                // Weighted random selection for gene type
                const rand = Math.random();
                let geneType = 'protein_coding';
                let cumWeight = 0;
                for (let j = 0; j < geneTypes.length; j++) {
                    cumWeight += typeWeights[j];
                    if (rand <= cumWeight) {
                        geneType = geneTypes[j];
                        break;
                    }
                }
                
                // Generate realistic expression levels
                let expression = undefined;
                if (geneType === 'protein_coding') {
                    expression = Math.random() * 0.8 + 0.2; // 20-100% for protein coding
                } else if (geneType === 'regulatory') {
                    expression = Math.random() * 0.6 + 0.4; // 40-100% for regulatory
                } else if (geneType === 'non_coding') {
                    expression = Math.random() * 0.7 + 0.1; // 10-80% for non-coding
                } else {
                    expression = Math.random() * 0.3; // 0-30% for pseudogenes
                }
                
                genes.push({
                    chromosome: chr.name,
                    start: start,
                    end: start + length,
                    name: geneNames[Math.floor(Math.random() * geneNames.length)] + `_${chrIndex + 1}_${i + 1}`,
                    type: geneType,
                    expression: expression,
                    value: Math.random()
                });
            }
        });
        return genes.slice(0, this.maxGenes);
    }

    generateHumanLinks() {
        const links = [];
        // Generate some example synteny/duplication links
        for (let i = 0; i < this.maxLinks; i++) {
            const chr1 = this.data.chromosomes[Math.floor(Math.random() * this.data.chromosomes.length)];
            const chr2 = this.data.chromosomes[Math.floor(Math.random() * this.data.chromosomes.length)];
            
            if (chr1.name !== chr2.name) {
                links.push({
                    source: {
                        chromosome: chr1.name,
                        start: Math.floor(Math.random() * (chr1.length - 1000000)),
                        end: Math.floor(Math.random() * 1000000) + 500000
                    },
                    target: {
                        chromosome: chr2.name,
                        start: Math.floor(Math.random() * (chr2.length - 1000000)),
                        end: Math.floor(Math.random() * 1000000) + 500000
                    },
                    type: ['synteny', 'duplication', 'inversion'][Math.floor(Math.random() * 3)],
                    value: Math.random()
                });
            }
        }
        return links;
    }

    generateEcoliGenes() {
        const genes = [];
        const geneNames = ['dnaA', 'dnaB', 'dnaC', 'dnaG', 'dnaK', 'recA', 'rpoA', 'rpoB', 'rpoC', 'gyrA', 'gyrB'];
        for (let i = 0; i < Math.min(100, this.maxGenes - 9); i++) {
            const start = Math.floor(Math.random() * (this.data.chromosomes[0].length - 5000));
            const length = Math.floor(Math.random() * 3000) + 500;
            genes.push({
                chromosome: 'chromosome',
                start: start,
                end: start + length,
                name: geneNames[i % geneNames.length] + `_${Math.floor(i / geneNames.length) + 1}`,
                type: 'protein_coding',
                value: Math.random() * 0.5 + 0.5
            });
        }
        return genes;
    }

    generateEcoliLinks() {
        return []; // E. coli is single chromosome, no inter-chromosomal links
    }

    generateYeastGenes() {
        const genes = [];
        this.data.chromosomes.forEach((chr, chrIndex) => {
            const numGenes = Math.floor(chr.length / 5000); // ~1 gene per 5kb
            for (let i = 0; i < Math.min(numGenes, Math.floor(this.maxGenes / this.data.chromosomes.length)); i++) {
                const start = Math.floor(Math.random() * (chr.length - 2000));
                const length = Math.floor(Math.random() * 1500) + 500;
                genes.push({
                    chromosome: chr.name,
                    start: start,
                    end: start + length,
                    name: `Y${chr.name.replace('chr', '')}${String(i + 1).padStart(3, '0')}C`,
                    type: 'protein_coding',
                    value: Math.random()
                });
            }
        });
        return genes;
    }

    generateYeastLinks() {
        const links = [];
        for (let i = 0; i < Math.min(this.maxLinks, 15); i++) {
            const chr1 = this.data.chromosomes[Math.floor(Math.random() * this.data.chromosomes.length)];
            const chr2 = this.data.chromosomes[Math.floor(Math.random() * this.data.chromosomes.length)];
            
            if (chr1.name !== chr2.name) {
                links.push({
                    source: {
                        chromosome: chr1.name,
                        start: Math.floor(Math.random() * (chr1.length - 50000)),
                        end: Math.floor(Math.random() * 50000) + 25000
                    },
                    target: {
                        chromosome: chr2.name,
                        start: Math.floor(Math.random() * (chr2.length - 50000)),
                        end: Math.floor(Math.random() * 50000) + 25000
                    },
                    type: 'duplication',
                    value: Math.random()
                });
            }
        }
        return links;
    }

    generateDrosophilaGenes() {
        const genes = [];
        this.data.chromosomes.forEach((chr, chrIndex) => {
            const numGenes = Math.floor(chr.length / 15000); // ~1 gene per 15kb
            for (let i = 0; i < Math.min(numGenes, Math.floor(this.maxGenes / this.data.chromosomes.length)); i++) {
                const start = Math.floor(Math.random() * (chr.length - 10000));
                const length = Math.floor(Math.random() * 8000) + 2000;
                genes.push({
                    chromosome: chr.name,
                    start: start,
                    end: start + length,
                    name: `Dm${chr.name.replace('chr', '')}${String(i + 1).padStart(4, '0')}`,
                    type: Math.random() > 0.8 ? 'non_coding' : 'protein_coding',
                    value: Math.random()
                });
            }
        });
        return genes;
    }

    generateDrosophilaLinks() {
        const links = [];
        for (let i = 0; i < Math.min(this.maxLinks, 12); i++) {
            const chr1 = this.data.chromosomes[Math.floor(Math.random() * this.data.chromosomes.length)];
            const chr2 = this.data.chromosomes[Math.floor(Math.random() * this.data.chromosomes.length)];
            
            if (chr1.name !== chr2.name) {
                links.push({
                    source: {
                        chromosome: chr1.name,
                        start: Math.floor(Math.random() * (chr1.length - 100000)),
                        end: Math.floor(Math.random() * 100000) + 50000
                    },
                    target: {
                        chromosome: chr2.name,
                        start: Math.floor(Math.random() * (chr2.length - 100000)),
                        end: Math.floor(Math.random() * 100000) + 50000
                    },
                    type: 'inversion',
                    value: Math.random()
                });
            }
        }
        return links;
    }

    generatePlantGenes() {
        const genes = [];
        this.data.chromosomes.forEach((chr, chrIndex) => {
            const numGenes = Math.floor(chr.length / 8000); // ~1 gene per 8kb
            for (let i = 0; i < Math.min(numGenes, Math.floor(this.maxGenes / this.data.chromosomes.length)); i++) {
                const start = Math.floor(Math.random() * (chr.length - 5000));
                const length = Math.floor(Math.random() * 4000) + 1000;
                genes.push({
                    chromosome: chr.name,
                    start: start,
                    end: start + length,
                    name: `AT${chrIndex + 1}G${String(i + 1).padStart(5, '0')}`,
                    type: 'protein_coding',
                    value: Math.random()
                });
            }
        });
        return genes;
    }

    // Chromosome ordering methods
    applyChromosomeOrder() {
        if (!this.data || !this.data.chromosomes) return;
        
        const originalOrder = [...this.data.chromosomes];
        
        switch (this.chromosomeOrder) {
            case 'size':
                this.data.chromosomes.sort((a, b) => b.length - a.length);
                break;
            case 'size_asc':
                this.data.chromosomes.sort((a, b) => a.length - b.length);
                break;
            case 'name':
                this.data.chromosomes.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'reverse':
                this.data.chromosomes.reverse();
                break;
            case 'default':
            default:
                // Restore original order if we have it stored
                if (this.originalChromosomeOrder) {
                    this.data.chromosomes = [...this.originalChromosomeOrder];
                }
                break;
        }
        
        // Store original order if not already stored
        if (!this.originalChromosomeOrder) {
            this.originalChromosomeOrder = originalOrder;
        }
        
        this.redrawPlot();
        this.updateStatus(`Chromosomes sorted by: ${this.chromosomeOrder}`);
    }

    shuffleChromosomes() {
        if (!this.data || !this.data.chromosomes) return;
        
        // Fisher-Yates shuffle
        for (let i = this.data.chromosomes.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.data.chromosomes[i], this.data.chromosomes[j]] = [this.data.chromosomes[j], this.data.chromosomes[i]];
        }
        
        this.chromosomeOrder = 'shuffled';
        document.getElementById('chromosomeOrderSelect').value = 'default';
        this.redrawPlot();
        this.updateStatus('Chromosomes shuffled randomly');
    }

    // GC content calculation
    calculateGCContent(sequence, windowSize = 10000) {
        const gcData = [];
        for (let i = 0; i < sequence.length; i += windowSize) {
            const window = sequence.slice(i, i + windowSize);
            const gcCount = (window.match(/[GC]/gi) || []).length;
            const gcPercent = (gcCount / window.length) * 100;
            gcData.push({
                position: i + windowSize / 2,
                value: gcPercent
            });
        }
        return gcData;
    }

    // GC skew calculation
    calculateGCSkew(sequence, windowSize = 10000) {
        const skewData = [];
        for (let i = 0; i < sequence.length; i += windowSize) {
            const window = sequence.slice(i, i + windowSize);
            const gCount = (window.match(/G/gi) || []).length;
            const cCount = (window.match(/C/gi) || []).length;
            const skew = (gCount - cCount) / (gCount + cCount) || 0;
            skewData.push({
                position: i + windowSize / 2,
                value: skew
            });
        }
        return skewData;
    }

    // Generate mock GC content data
    generateMockGCData(chromosome) {
        const data = [];
        const numPoints = Math.floor(chromosome.length / this.gcWindowSize);
        
        for (let i = 0; i < numPoints; i++) {
            const position = i * this.gcWindowSize + this.gcWindowSize / 2;
            // Generate realistic GC content (30-70%)
            const baseGC = 45; // Base GC content
            const variation = 15 * Math.sin(i * 0.1) + 10 * Math.random() - 5;
            const gcContent = Math.max(30, Math.min(70, baseGC + variation));
            
            data.push({
                position: position,
                value: gcContent
            });
        }
        return data;
    }

    // Generate mock GC skew data
    generateMockGCSkew(chromosome) {
        const data = [];
        const numPoints = Math.floor(chromosome.length / this.gcWindowSize);
        
        for (let i = 0; i < numPoints; i++) {
            const position = i * this.gcWindowSize + this.gcWindowSize / 2;
            // Generate realistic GC skew (-0.3 to 0.3)
            const skew = 0.2 * Math.sin(i * 0.05) + 0.1 * Math.random() - 0.05;
            
            data.push({
                position: position,
                value: skew
            });
        }
        return data;
    }

    // Generate mock WIG data
    generateMockWigData(chromosome) {
        const data = [];
        const numPoints = Math.floor(chromosome.length / (this.gcWindowSize / 2));
        
        for (let i = 0; i < numPoints; i++) {
            const position = i * (this.gcWindowSize / 2) + this.gcWindowSize / 4;
            // Generate mock expression/coverage data
            const value = Math.max(0, 50 + 30 * Math.sin(i * 0.02) + 20 * Math.random());
            
            data.push({
                position: position,
                value: value
            });
        }
        return data;
    }

    generatePlantLinks() {
        const links = [];
        for (let i = 0; i < Math.min(this.maxLinks, 10); i++) {
            const chr1 = this.data.chromosomes[Math.floor(Math.random() * this.data.chromosomes.length)];
            const chr2 = this.data.chromosomes[Math.floor(Math.random() * this.data.chromosomes.length)];
            
            if (chr1.name !== chr2.name) {
                links.push({
                    source: {
                        chromosome: chr1.name,
                        start: Math.floor(Math.random() * (chr1.length - 200000)),
                        end: Math.floor(Math.random() * 200000) + 100000
                    },
                    target: {
                        chromosome: chr2.name,
                        start: Math.floor(Math.random() * (chr2.length - 200000)),
                        end: Math.floor(Math.random() * 200000) + 100000
                    },
                    type: 'synteny',
                    value: Math.random()
                });
            }
        }
        return links;
    }

    createPlot() {
        // Clear previous plot
        d3.select('#circosContainer').selectAll('*').remove();
        
        const theme = this.getCurrentTheme();
        
        // Create SVG with dynamic sizing
        this.svg = d3.select('#circosContainer')
            .append('svg')
            .attr('id', 'circos-svg')
            .attr('width', this.width)
            .attr('height', this.height)
            .style('background-color', theme.background);
        
        const g = this.svg.append('g')
            .attr('transform', `translate(${this.width/2}, ${this.height/2}) rotate(${this.startAngle})`);
        
        // Calculate angles for chromosomes
        this.calculateChromosomeAngles();
        
        // Draw chromosomes
        this.drawChromosomes(g);
        
        // Draw ticks if enabled
        if (this.showTicks) {
            this.drawTicks(g);
        }
        
        // Draw chromosome labels if enabled
        if (this.showLabels) {
            this.drawLabels(g);
        }
        
        // Draw genes track if enabled
        if (this.showGenes && this.data.genes) {
            this.drawGenesTrack(g);
        }
        
        // Draw data tracks
        let trackOffset = 0;
        if (this.showGCContent) {
            this.drawGCContentTrack(g, trackOffset);
            trackOffset += this.wigTrackHeight + 5;
        }
        
        if (this.showGCSkew) {
            this.drawGCSkewTrack(g, trackOffset);
            trackOffset += this.wigTrackHeight + 5;
        }
        
        if (this.showWigData) {
            this.drawWigTrack(g, trackOffset);
            trackOffset += this.wigTrackHeight + 5;
        }
        
        // Draw links if enabled
        if (this.showLinks && this.data.links) {
            this.drawLinks(g);
        }
        
        // Draw legend if enabled
        if (this.showLegend) {
            this.drawLegend();
        }
        
        // Update status
        let statusText = `Plotted ${this.data.chromosomes.length} chromosomes`;
        if (this.data.genes) {
            statusText += `, ${this.data.genes.length} genes`;
        }
        if (this.data.links) {
            statusText += `, ${this.data.links.length} links`;
        }
        this.updateStatus(statusText);
    }

    calculateChromosomeAngles() {
        const totalLength = this.data.chromosomes.reduce((sum, chr) => sum + chr.length, 0);
        const totalGaps = this.data.chromosomes.length * this.chromosomeGap;
        const availableAngle = 360 - totalGaps;
        
        let currentAngle = 0;
        this.data.chromosomes.forEach(chr => {
            chr.startAngle = currentAngle;
            chr.endAngle = currentAngle + (chr.length / totalLength) * availableAngle;
            chr.midAngle = (chr.startAngle + chr.endAngle) / 2;
            currentAngle = chr.endAngle + this.chromosomeGap;
        });
    }

    drawChromosomes(g) {
        const arc = d3.arc()
            .innerRadius(this.innerRadius)
            .outerRadius(this.innerRadius + this.chromosomeWidth)
            .startAngle(d => d.startAngle * Math.PI / 180)
            .endAngle(d => d.endAngle * Math.PI / 180);
        
        const theme = this.getCurrentTheme();
        const colors = theme.chromosomes;
        
        g.selectAll('.chromosome-arc')
            .data(this.data.chromosomes)
            .enter()
            .append('path')
            .attr('class', 'chromosome-arc')
            .attr('d', arc)
            .attr('fill', (d, i) => colors[i % colors.length])
            .attr('stroke', theme.stroke)
            .attr('stroke-width', this.strokeWidth)
            .style('cursor', 'pointer')
            .on('mouseover', (event, d) => {
                this.showTooltip(event, `${d.name}<br/>Length: ${d.length.toLocaleString()} bp<br/>Coverage: ${((d.endAngle - d.startAngle) / 360 * 100).toFixed(1)}%`);
            })
            .on('mouseout', () => {
                this.hideTooltip();
            })
            .on('click', (event, d) => {
                console.log(`Clicked on ${d.name}: ${d.length.toLocaleString()} bp`);
                this.updateStatus(`Selected: ${d.name} (${(d.length / 1000000).toFixed(1)} Mb)`);
            });
    }

    drawTicks(g) {
        const tickInterval = 50000000; // 50 Mb
        const theme = this.getCurrentTheme();
        
        this.data.chromosomes.forEach(chr => {
            const numTicks = Math.floor(chr.length / tickInterval);
            for (let i = 0; i <= numTicks; i++) {
                const position = i * tickInterval;
                const angle = chr.startAngle + (position / chr.length) * (chr.endAngle - chr.startAngle);
                const radians = angle * Math.PI / 180;
                
                const x1 = Math.cos(radians) * this.innerRadius;
                const y1 = Math.sin(radians) * this.innerRadius;
                const x2 = Math.cos(radians) * (this.innerRadius - 5);
                const y2 = Math.sin(radians) * (this.innerRadius - 5);
                
                g.append('line')
                    .attr('class', 'tick')
                    .attr('x1', x1)
                    .attr('y1', y1)
                    .attr('x2', x2)
                    .attr('y2', y2)
                    .attr('stroke', theme.ticks)
                    .attr('stroke-width', 1);
                
                // Add tick labels for major ticks
                if (i % 2 === 0) {
                    const labelRadius = this.innerRadius - 15;
                    const labelX = Math.cos(radians) * labelRadius;
                    const labelY = Math.sin(radians) * labelRadius;
                    
                    g.append('text')
                        .attr('class', 'tick-label')
                        .attr('x', labelX)
                        .attr('y', labelY)
                        .attr('text-anchor', 'middle')
                        .attr('dominant-baseline', 'middle')
                        .attr('fill', theme.text)
                        .attr('font-size', '10px')
                        .text(`${(position / 1000000).toFixed(0)}M`);
                }
            }
        });
    }

    drawLabels(g) {
        const theme = this.getCurrentTheme();
        
        g.selectAll('.chromosome-label')
            .data(this.data.chromosomes)
            .enter()
            .append('text')
            .attr('class', 'chromosome-label')
            .attr('transform', d => {
                const angle = d.midAngle;
                const radians = angle * Math.PI / 180;
                const labelRadius = this.innerRadius + this.chromosomeWidth + this.labelDistance;
                const x = Math.cos(radians) * labelRadius;
                const y = Math.sin(radians) * labelRadius;
                return `translate(${x}, ${y}) rotate(${angle > 90 && angle < 270 ? angle + 180 : angle})`;
            })
            .text(d => d.name)
            .attr('fill', theme.text)
            .attr('font-size', '12px')
            .attr('font-weight', '500')
            .attr('text-anchor', 'middle')
            .style('cursor', 'pointer')
            .on('click', (event, d) => {
                console.log(`Label clicked: ${d.name}`);
                this.updateStatus(`Chromosome ${d.name}: ${(d.length / 1000000).toFixed(1)} Mb, ${((d.endAngle - d.startAngle) / 360 * 100).toFixed(1)}% coverage`);
            });
    }

    drawGenesTrack(g) {
        if (!this.data.genes) return;
        
        const theme = this.getCurrentTheme();
        const geneRadius = this.innerRadius + this.chromosomeWidth + 5;
        const geneHeight = this.geneHeight;
        
        this.data.genes.slice(0, this.maxGenes).forEach(gene => {
            const chr = this.data.chromosomes.find(c => c.name === gene.chromosome);
            if (!chr) return;
            
            const startAngle = chr.startAngle + (gene.start / chr.length) * (chr.endAngle - chr.startAngle);
            const endAngle = chr.startAngle + (gene.end / chr.length) * (chr.endAngle - chr.startAngle);
            
            // Adjust height based on expression level if available
            let adjustedHeight = geneHeight;
            let opacity = 0.8;
            
            if (gene.expression !== undefined) {
                if (gene.expression >= 0.7) {
                    adjustedHeight = geneHeight * 1.5;
                    opacity = 0.9;
                } else if (gene.expression >= 0.4) {
                    adjustedHeight = geneHeight * 1.2;
                    opacity = 0.85;
                } else {
                    adjustedHeight = geneHeight * 0.8;
                    opacity = 0.6;
                }
            }
            
            const arc = d3.arc()
                .innerRadius(geneRadius)
                .outerRadius(geneRadius + adjustedHeight)
                .startAngle(startAngle * Math.PI / 180)
                .endAngle(endAngle * Math.PI / 180);
            
            // Get gene color from theme with expression-based modification
            let geneColor = theme.genes.default;
            if (gene.type === 'protein_coding') geneColor = theme.genes.protein_coding;
            else if (gene.type === 'non_coding') geneColor = theme.genes.non_coding;
            else if (gene.type === 'pseudogene') geneColor = theme.genes.pseudogene;
            else if (gene.type === 'regulatory') geneColor = theme.genes.regulatory;
            
            // Apply expression-based color intensity
            if (gene.expression !== undefined) {
                if (gene.expression >= 0.7) {
                    geneColor = theme.tracks.expression_high;
                } else if (gene.expression >= 0.4) {
                    geneColor = theme.tracks.expression_medium;
                } else {
                    geneColor = theme.tracks.expression_low;
                }
            }
            
            // Add pattern for special gene types
            let strokeDasharray = 'none';
            if (gene.type === 'pseudogene') {
                strokeDasharray = '2,2';
            } else if (gene.type === 'regulatory') {
                strokeDasharray = '4,1';
            }
            
            g.append('path')
                .attr('d', arc)
                .attr('fill', geneColor)
                .attr('opacity', opacity)
                .attr('stroke', theme.stroke)
                .attr('stroke-width', 0.5)
                .attr('stroke-dasharray', strokeDasharray)
                .style('cursor', 'pointer')
                .on('mouseover', (event) => {
                    const expressionText = gene.expression !== undefined ? 
                        `<br/>Expression: ${(gene.expression * 100).toFixed(1)}%` : '';
                    const lengthKb = ((gene.end - gene.start) / 1000).toFixed(1);
                    
                    this.showTooltip(event, `
                        <strong>${gene.name}</strong><br/>
                        Type: ${gene.type}<br/>
                        Length: ${lengthKb} kb<br/>
                        Position: ${gene.start.toLocaleString()}-${gene.end.toLocaleString()}${expressionText}
                    `);
                })
                .on('mouseout', () => {
                    this.hideTooltip();
                });
        });
    }

    drawGCContentTrack(g, trackOffset) {
        const theme = this.getCurrentTheme();
        const trackRadius = this.innerRadius + this.chromosomeWidth + this.geneHeight + 10 + trackOffset;
        
        this.data.chromosomes.forEach(chr => {
            const gcData = this.generateMockGCData(chr);
            
            // Create line generator
            const line = d3.line()
                .x(d => {
                    const angle = chr.startAngle + (d.position / chr.length) * (chr.endAngle - chr.startAngle);
                    const radians = angle * Math.PI / 180;
                    const radius = trackRadius + (d.value - 30) / 40 * this.wigTrackHeight; // Scale 30-70% to track height
                    return Math.cos(radians) * radius;
                })
                .y(d => {
                    const angle = chr.startAngle + (d.position / chr.length) * (chr.endAngle - chr.startAngle);
                    const radians = angle * Math.PI / 180;
                    const radius = trackRadius + (d.value - 30) / 40 * this.wigTrackHeight;
                    return Math.sin(radians) * radius;
                })
                .curve(d3.curveCardinal);
            
            // Draw baseline
            const baselineArc = d3.arc()
                .innerRadius(trackRadius)
                .outerRadius(trackRadius)
                .startAngle(chr.startAngle * Math.PI / 180)
                .endAngle(chr.endAngle * Math.PI / 180);
            
            g.append('path')
                .attr('d', baselineArc)
                .attr('stroke', theme.tracks.baseline)
                .attr('stroke-width', 1)
                .attr('fill', 'none');
            
            // Draw GC content line
            g.append('path')
                .datum(gcData)
                .attr('d', line)
                .attr('stroke', theme.tracks.gc_content)
                .attr('stroke-width', 2)
                .attr('fill', 'none')
                .attr('opacity', 0.9);
        });
    }

    drawGCSkewTrack(g, trackOffset) {
        const theme = this.getCurrentTheme();
        const trackRadius = this.innerRadius + this.chromosomeWidth + this.geneHeight + 10 + trackOffset;
        
        this.data.chromosomes.forEach(chr => {
            const skewData = this.generateMockGCSkew(chr);
            
            // Create line generator
            const line = d3.line()
                .x(d => {
                    const angle = chr.startAngle + (d.position / chr.length) * (chr.endAngle - chr.startAngle);
                    const radians = angle * Math.PI / 180;
                    const radius = trackRadius + (d.value + 0.3) / 0.6 * this.wigTrackHeight; // Scale -0.3 to 0.3 to track height
                    return Math.cos(radians) * radius;
                })
                .y(d => {
                    const angle = chr.startAngle + (d.position / chr.length) * (chr.endAngle - chr.startAngle);
                    const radians = angle * Math.PI / 180;
                    const radius = trackRadius + (d.value + 0.3) / 0.6 * this.wigTrackHeight;
                    return Math.sin(radians) * radius;
                })
                .curve(d3.curveCardinal);
            
            // Draw baseline (zero line)
            const baselineArc = d3.arc()
                .innerRadius(trackRadius + this.wigTrackHeight / 2)
                .outerRadius(trackRadius + this.wigTrackHeight / 2)
                .startAngle(chr.startAngle * Math.PI / 180)
                .endAngle(chr.endAngle * Math.PI / 180);
            
            g.append('path')
                .attr('d', baselineArc)
                .attr('stroke', theme.tracks.baseline)
                .attr('stroke-width', 1)
                .attr('fill', 'none');
            
            // Draw GC skew line
            g.append('path')
                .datum(skewData)
                .attr('d', line)
                .attr('stroke', theme.tracks.gc_skew)
                .attr('stroke-width', 2)
                .attr('fill', 'none')
                .attr('opacity', 0.9);
        });
    }

    drawWigTrack(g, trackOffset) {
        const theme = this.getCurrentTheme();
        const trackRadius = this.innerRadius + this.chromosomeWidth + this.geneHeight + 10 + trackOffset;
        
        this.data.chromosomes.forEach(chr => {
            const wigData = this.generateMockWigData(chr);
            const maxValue = Math.max(...wigData.map(d => d.value));
            
            // Create area generator for filled track
            const area = d3.area()
                .x(d => {
                    const angle = chr.startAngle + (d.position / chr.length) * (chr.endAngle - chr.startAngle);
                    const radians = angle * Math.PI / 180;
                    return Math.cos(radians) * trackRadius;
                })
                .y(d => {
                    const angle = chr.startAngle + (d.position / chr.length) * (chr.endAngle - chr.startAngle);
                    const radians = angle * Math.PI / 180;
                    return Math.sin(radians) * trackRadius;
                })
                .x1(d => {
                    const angle = chr.startAngle + (d.position / chr.length) * (chr.endAngle - chr.startAngle);
                    const radians = angle * Math.PI / 180;
                    const radius = trackRadius + (d.value / maxValue) * this.wigTrackHeight;
                    return Math.cos(radians) * radius;
                })
                .y1(d => {
                    const angle = chr.startAngle + (d.position / chr.length) * (chr.endAngle - chr.startAngle);
                    const radians = angle * Math.PI / 180;
                    const radius = trackRadius + (d.value / maxValue) * this.wigTrackHeight;
                    return Math.sin(radians) * radius;
                })
                .curve(d3.curveCardinal);
            
            // Draw WIG data as filled area
            g.append('path')
                .datum(wigData)
                .attr('d', area)
                .attr('fill', theme.tracks.wig_data)
                .attr('stroke', theme.tracks.wig_data)
                .attr('stroke-width', 1)
                .attr('opacity', 0.7);
        });
    }

    drawLinks(g) {
        if (!this.data.links) return;
        
        const theme = this.getCurrentTheme();
        const linkGroup = g.append('g').attr('class', 'links');
        
        this.data.links.slice(0, this.maxLinks).forEach(link => {
            const sourceChr = this.data.chromosomes.find(c => c.name === link.source.chromosome);
            const targetChr = this.data.chromosomes.find(c => c.name === link.target.chromosome);
            
            if (!sourceChr || !targetChr) return;
            
            const sourceAngle = sourceChr.startAngle + (link.source.start / sourceChr.length) * (sourceChr.endAngle - sourceChr.startAngle);
            const targetAngle = targetChr.startAngle + (link.target.start / targetChr.length) * (targetChr.endAngle - targetChr.startAngle);
            
            const sourceRadians = sourceAngle * Math.PI / 180;
            const targetRadians = targetAngle * Math.PI / 180;
            
            const linkRadius = this.innerRadius - 20;
            const sourceX = Math.cos(sourceRadians) * linkRadius;
            const sourceY = Math.sin(sourceRadians) * linkRadius;
            const targetX = Math.cos(targetRadians) * linkRadius;
            const targetY = Math.sin(targetRadians) * linkRadius;
            
            const path = d3.path();
            path.moveTo(sourceX, sourceY);
            path.quadraticCurveTo(0, 0, targetX, targetY);
            
            // Determine link color and style based on strength
            let linkColor, strokeWidth, strokeDasharray = 'none';
            
            if (link.value >= 0.7) {
                linkColor = theme.links.strong;
                strokeWidth = Math.max(3, link.value * 5);
            } else if (link.value >= 0.4) {
                linkColor = theme.links.medium;
                strokeWidth = Math.max(2, link.value * 4);
                strokeDasharray = '5,2';
            } else {
                linkColor = theme.links.weak;
                strokeWidth = Math.max(1, link.value * 3);
                strokeDasharray = '3,3';
            }
            
            // Create gradient for high-strength links
            if (link.value >= 0.8) {
                const gradientId = `linkGradient${Math.random().toString(36).substr(2, 9)}`;
                const gradient = g.append('defs').append('linearGradient')
                    .attr('id', gradientId)
                    .attr('gradientUnits', 'userSpaceOnUse')
                    .attr('x1', sourceX).attr('y1', sourceY)
                    .attr('x2', targetX).attr('y2', targetY);
                
                gradient.append('stop')
                    .attr('offset', '0%')
                    .attr('stop-color', theme.links.gradient[0]);
                
                gradient.append('stop')
                    .attr('offset', '100%')
                    .attr('stop-color', theme.links.gradient[1]);
                
                linkColor = `url(#${gradientId})`;
                strokeDasharray = 'none';
            }
            
            linkGroup.append('path')
                .attr('d', path.toString())
                .attr('class', 'link')
                .attr('stroke', linkColor)
                .attr('stroke-width', strokeWidth)
                .attr('stroke-dasharray', strokeDasharray)
                .attr('fill', 'none')
                .attr('opacity', this.linkOpacity)
                .style('cursor', 'pointer')
                .on('mouseover', (event) => {
                    const strengthLabel = link.value >= 0.7 ? 'Strong' : link.value >= 0.4 ? 'Medium' : 'Weak';
                    this.showTooltip(event, `
                        <strong>Genomic Link</strong><br/>
                        ${link.source.chromosome} → ${link.target.chromosome}<br/>
                        Strength: ${strengthLabel} (${(link.value * 100).toFixed(1)}%)<br/>
                        Type: ${link.type || 'Synteny'}
                    `);
                })
                .on('mouseout', () => {
                    this.hideTooltip();
                });
        });
    }

    drawLegend() {
        // Remove existing legend
        d3.select('#legend-container').remove();
        
        const theme = this.getCurrentTheme();
        const container = d3.select('#circosContainer');
        
        // Determine legend position
        let positionStyles = {};
        switch (this.legendPosition) {
            case 'top-left':
                positionStyles = { top: '20px', left: '20px' };
                break;
            case 'top-right':
                positionStyles = { top: '20px', right: '20px' };
                break;
            case 'bottom-left':
                positionStyles = { bottom: '20px', left: '20px' };
                break;
            case 'bottom-right':
                positionStyles = { bottom: '20px', right: '20px' };
                break;
            default:
                positionStyles = { top: '20px', right: '20px' };
        }
        
        // Create legend container
        const legendContainer = container.append('div')
            .attr('id', 'legend-container')
            .style('position', 'absolute')
            .style('top', positionStyles.top || 'auto')
            .style('right', positionStyles.right || 'auto')
            .style('bottom', positionStyles.bottom || 'auto')
            .style('left', positionStyles.left || 'auto')
            .style('background', theme.legend.background)
            .style('border', `1px solid ${theme.legend.border}`)
            .style('border-radius', '8px')
            .style('padding', '16px')
            .style('font-family', 'Arial, sans-serif')
            .style('font-size', '12px')
            .style('color', theme.legend.text)
            .style('box-shadow', '0 4px 12px rgba(0,0,0,0.15)')
            .style('max-width', '250px')
            .style('opacity', this.legendOpacity)
            .style('z-index', '1000');
        
        // Legend title
        legendContainer.append('div')
            .style('font-weight', 'bold')
            .style('font-size', '14px')
            .style('margin-bottom', '12px')
            .style('color', theme.legend.text)
            .text(`${theme.name} Theme`);
        
        // Theme description
        legendContainer.append('div')
            .style('font-size', '11px')
            .style('color', theme.legend.text)
            .style('opacity', '0.8')
            .style('margin-bottom', '16px')
            .style('line-height', '1.4')
            .text(theme.description);
        
        // Chromosomes section
        const chromSection = legendContainer.append('div')
            .style('margin-bottom', '16px');
        
        chromSection.append('div')
            .style('font-weight', '600')
            .style('margin-bottom', '8px')
            .text('Chromosomes');
        
        const chromGrid = chromSection.append('div')
            .style('display', 'grid')
            .style('grid-template-columns', 'repeat(6, 1fr)')
            .style('gap', '4px');
        
        theme.chromosomes.slice(0, 12).forEach((color, i) => {
            chromGrid.append('div')
                .style('width', '16px')
                .style('height', '16px')
                .style('background-color', color)
                .style('border-radius', '2px')
                .style('border', `1px solid ${theme.legend.border}`)
                .attr('title', `Chromosome ${i + 1}`);
        });
        
        // Genes section
        if (this.showGenes && this.data.genes) {
            const geneSection = legendContainer.append('div')
                .style('margin-bottom', '16px');
            
            geneSection.append('div')
                .style('font-weight', '600')
                .style('margin-bottom', '8px')
                .text('Gene Types');
            
            const geneTypes = [
                { type: 'protein_coding', label: 'Protein Coding', color: theme.genes.protein_coding },
                { type: 'non_coding', label: 'Non-coding RNA', color: theme.genes.non_coding },
                { type: 'regulatory', label: 'Regulatory', color: theme.genes.regulatory },
                { type: 'pseudogene', label: 'Pseudogene', color: theme.genes.pseudogene }
            ];
            
            geneTypes.forEach(gene => {
                const geneItem = geneSection.append('div')
                    .style('display', 'flex')
                    .style('align-items', 'center')
                    .style('margin-bottom', '4px');
                
                geneItem.append('div')
                    .style('width', '12px')
                    .style('height', '12px')
                    .style('background-color', gene.color)
                    .style('border-radius', '2px')
                    .style('margin-right', '8px')
                    .style('border', `1px solid ${theme.legend.border}`);
                
                geneItem.append('span')
                    .style('font-size', '11px')
                    .text(gene.label);
            });
        }
        
        // Expression levels section
        if (this.showGenes) {
            const exprSection = legendContainer.append('div')
                .style('margin-bottom', '16px');
            
            exprSection.append('div')
                .style('font-weight', '600')
                .style('margin-bottom', '8px')
                .text('Expression Levels');
            
            const exprLevels = [
                { level: 'High (>70%)', color: theme.tracks.expression_high, height: '16px' },
                { level: 'Medium (40-70%)', color: theme.tracks.expression_medium, height: '12px' },
                { level: 'Low (<40%)', color: theme.tracks.expression_low, height: '8px' }
            ];
            
            exprLevels.forEach(expr => {
                const exprItem = exprSection.append('div')
                    .style('display', 'flex')
                    .style('align-items', 'center')
                    .style('margin-bottom', '4px');
                
                exprItem.append('div')
                    .style('width', '20px')
                    .style('height', expr.height)
                    .style('background-color', expr.color)
                    .style('border-radius', '2px')
                    .style('margin-right', '8px')
                    .style('border', `1px solid ${theme.legend.border}`);
                
                exprItem.append('span')
                    .style('font-size', '11px')
                    .text(expr.level);
            });
        }
        
        // Links section
        if (this.showLinks && this.data.links) {
            const linkSection = legendContainer.append('div')
                .style('margin-bottom', '16px');
            
            linkSection.append('div')
                .style('font-weight', '600')
                .style('margin-bottom', '8px')
                .text('Link Strength');
            
            const linkTypes = [
                { type: 'Strong (≥70%)', color: theme.links.strong, width: '3px', dash: 'none' },
                { type: 'Medium (40-70%)', color: theme.links.medium, width: '2px', dash: '5,2' },
                { type: 'Weak (<40%)', color: theme.links.weak, width: '1px', dash: '3,3' }
            ];
            
            linkTypes.forEach(link => {
                const linkItem = linkSection.append('div')
                    .style('display', 'flex')
                    .style('align-items', 'center')
                    .style('margin-bottom', '6px');
                
                const linkSvg = linkItem.append('svg')
                    .attr('width', '24')
                    .attr('height', '8')
                    .style('margin-right', '8px');
                
                linkSvg.append('line')
                    .attr('x1', '2')
                    .attr('y1', '4')
                    .attr('x2', '22')
                    .attr('y2', '4')
                    .attr('stroke', link.color)
                    .attr('stroke-width', link.width)
                    .attr('stroke-dasharray', link.dash);
                
                linkItem.append('span')
                    .style('font-size', '11px')
                    .text(link.type);
            });
        }
        
        // Data tracks section
        if (this.showGCContent || this.showGCSkew || this.showWigData) {
            const trackSection = legendContainer.append('div')
                .style('margin-bottom', '16px');
            
            trackSection.append('div')
                .style('font-weight', '600')
                .style('margin-bottom', '8px')
                .text('Data Tracks');
            
            const tracks = [];
            if (this.showGCContent) tracks.push({ name: 'GC Content', color: theme.tracks.gc_content });
            if (this.showGCSkew) tracks.push({ name: 'GC Skew', color: theme.tracks.gc_skew });
            if (this.showWigData) tracks.push({ name: 'Expression Data', color: theme.tracks.wig_data });
            
            tracks.forEach(track => {
                const trackItem = trackSection.append('div')
                    .style('display', 'flex')
                    .style('align-items', 'center')
                    .style('margin-bottom', '4px');
                
                trackItem.append('div')
                    .style('width', '16px')
                    .style('height', '3px')
                    .style('background-color', track.color)
                    .style('margin-right', '8px')
                    .style('border-radius', '1px');
                
                trackItem.append('span')
                    .style('font-size', '11px')
                    .text(track.name);
            });
        }
        
        // Scale information
        const scaleSection = legendContainer.append('div')
            .style('border-top', `1px solid ${theme.legend.border}`)
            .style('padding-top', '12px')
            .style('margin-top', '16px');
        
        scaleSection.append('div')
            .style('font-weight', '600')
            .style('margin-bottom', '8px')
            .text('Scale Information');
        
        const totalLength = this.data.chromosomes.reduce((sum, chr) => sum + chr.length, 0);
        const avgLength = totalLength / this.data.chromosomes.length;
        
        scaleSection.append('div')
            .style('font-size', '11px')
            .style('margin-bottom', '4px')
            .text(`Total genome: ${(totalLength / 1e9).toFixed(2)} Gb`);
        
        scaleSection.append('div')
            .style('font-size', '11px')
            .style('margin-bottom', '4px')
            .text(`Avg chromosome: ${(avgLength / 1e6).toFixed(1)} Mb`);
        
        scaleSection.append('div')
            .style('font-size', '11px')
            .style('color', theme.legend.text)
            .style('opacity', '0.7')
            .text(`Window size: ${(this.gcWindowSize / 1000).toFixed(0)} kb`);
    }

    redrawPlot() {
        if (this.data) {
            this.createPlot();
        }
    }

    showTooltip(event, content) {
        this.tooltip
            .style('opacity', 1)
            .html(content)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');
    }

    hideTooltip() {
        this.tooltip.style('opacity', 0);
    }

    exportPNG() {
        const svgElement = document.getElementById('circos-svg');
        if (!svgElement) {
            this.updateStatus('Error: No plot to export');
            return;
        }
        
        const resolution = parseInt(document.getElementById('exportResolutionSelect').value) || 1;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas size based on resolution
        canvas.width = this.width * resolution;
        canvas.height = this.height * resolution;
        
        // Create image from SVG
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        
        const img = new Image();
        img.onload = () => {
            // Fill background
            ctx.fillStyle = this.backgroundColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw SVG
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            // Download PNG
            canvas.toBlob((blob) => {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `circos-plot-${new Date().toISOString().slice(0, 10)}-${resolution}x.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(a.href);
                
                this.updateStatus(`PNG exported at ${resolution}x resolution`);
            });
            
            URL.revokeObjectURL(url);
        };
        
        img.onerror = () => {
            this.updateStatus('Error: Failed to export PNG');
            URL.revokeObjectURL(url);
        };
        
        img.src = url;
    }

    // File operations
    loadDataFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv,.tsv,.txt,.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                this.parseDataFile(file);
            }
        };
        input.click();
    }

    parseDataFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target.result;
                
                if (file.name.endsWith('.json')) {
                    this.data = JSON.parse(content);
                } else {
                    // Parse CSV/TSV
                    const parsed = Papa.parse(content, { header: true });
                    this.convertCSVToCircosData(parsed.data);
                }
                
                this.createPlot();
                this.updateStatus(`Loaded data from ${file.name}`);
            } catch (error) {
                this.updateStatus(`Error loading file: ${error.message}`);
            }
        };
        reader.readAsText(file);
    }

    convertCSVToCircosData(csvData) {
        // Convert CSV to Circos format
        // This is a simplified example - in reality, you'd need more sophisticated parsing
        this.data = {
            chromosomes: [],
            genes: [],
            links: []
        };
        
        // Extract unique chromosomes
        const chrMap = new Map();
        csvData.forEach(row => {
            if (row.chromosome) {
                chrMap.set(row.chromosome, Math.max(chrMap.get(row.chromosome) || 0, parseInt(row.end) || 0));
            }
        });
        
        chrMap.forEach((length, name) => {
            this.data.chromosomes.push({ name, length });
        });
        
        // Extract genes
        this.data.genes = csvData.filter(row => row.chromosome && row.start && row.end);
    }

    exportSVG() {
        const svgElement = document.getElementById('circos-svg');
        if (!svgElement) return;
        
        // Create a copy of the SVG with embedded styles
        const svgClone = svgElement.cloneNode(true);
        
        // Add CSS styles to the SVG
        const styleElement = document.createElementNS('http://www.w3.org/2000/svg', 'style');
        styleElement.textContent = `
            .chromosome-arc { cursor: pointer; }
            .chromosome-label { font-size: 12px; font-weight: 600; text-anchor: middle; cursor: pointer; }
            .tick { stroke: #666; stroke-width: 1; }
            .tick-label { font-size: 10px; fill: #666; text-anchor: middle; }
            .link { fill: none; stroke-width: 2; opacity: 0.6; }
        `;
        svgClone.insertBefore(styleElement, svgClone.firstChild);
        
        // Convert to blob and download
        const svgString = new XMLSerializer().serializeToString(svgClone);
        const blob = new Blob([svgString], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `circos-plot-${new Date().toISOString().slice(0, 10)}.svg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    resetPlot() {
        // Reset all parameters to defaults
        this.radius = 300;
        this.innerRadiusRatio = 0.3;
        this.innerRadius = this.radius * this.innerRadiusRatio;
        this.chromosomeWidth = 15;
        this.chromosomeGap = 2;
        this.startAngle = -90;
        this.showLabels = true;
        this.showTicks = false;
        this.showGenes = true;
        this.showLinks = true;
        this.currentTheme = 'scientific';
        this.applyTheme('scientific');
        this.strokeWidth = 1;
        this.labelDistance = 20;
        this.geneHeight = 8;
        this.linkOpacity = 0.3;
        this.maxGenes = 200;
        this.maxLinks = 50;
        
        // Reset UI controls
        const controls = {
            'radiusSlider': 300,
            'innerRadiusSlider': 0.3,
            'startAngleSlider': -90,
            'chrWidthSlider': 15,
            'gapSlider': 2,
            'labelDistanceSlider': 20,
            'strokeWidthSlider': 1,
            'geneHeightSlider': 8,
            'linkOpacitySlider': 0.3,
            'maxGenesSlider': 200,
            'maxLinksSlider': 50,
            'showLabelsCheck': true,
            'showTicksCheck': false,
            'showGenesCheck': true,
            'showLinksCheck': true,
            'showGCContentCheck': false,
            'showGCSkewCheck': false,
            'showWigDataCheck': false,
            'gcWindowSlider': 10000,
            'wigHeightSlider': 30,
            'themeSelect': 'scientific',
            'chromosomeOrderSelect': 'default',
            'exportResolutionSelect': '1',
            'showLegendCheck': true,
            'legendPositionSelect': 'top-right',
            'legendOpacitySlider': '0.95'
        };
        
        Object.entries(controls).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = value;
                } else {
                    element.value = value;
                }
            }
        });
        
        this.updateParameterDisplays();
        this.redrawPlot();
        this.updateStatus('Reset to default parameters');
    }

    showHelp() {
        const helpText = `Circos Genome Plotter Help:

Data Loading:
• Click "Load Data" to upload CSV/JSON files
• Use sample data buttons for different organisms

Plot Interaction:
• Click chromosomes for information
• Hover over elements for tooltips
• Use mouse to explore genes and links

Parameters:
• Use sliders and controls for real-time adjustments
• Detailed parameter sections for fine-tuning
• Export options for SVG and PNG formats

Export:
• SVG for vector graphics (publications)
• PNG for raster images (presentations)
• Multiple resolution options available`;
        
        alert(helpText);
        this.updateStatus('Help displayed');
    }
}

// Initialize the Circos plotter when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded');
    
    // Check if D3 is loaded
    if (typeof d3 === 'undefined') {
        console.error('D3.js is not loaded. Please ensure the D3.js library is properly included.');
        const loadingEl = document.getElementById('loadingIndicator');
        if (loadingEl) {
            loadingEl.innerHTML = `
                <div class="spinner"></div>
                <span style="color: red;">Error: D3.js library not found</span>
            `;
        }
        return;
    }
    
    console.log('D3.js version:', d3.version);
    console.log('D3.js schemes available:', {
        category10: !!d3.schemeCategory10,
        blues: !!d3.schemeBlues,
        greens: !!d3.schemeGreens,
        reds: !!d3.schemeReds,
        viridis: !!d3.schemeViridis
    });
    
    // Initialize CircosPlotter
    try {
        console.log('Initializing CircosPlotter...');
        new CircosPlotter();
        console.log('CircosPlotter initialized successfully');
    } catch (error) {
        console.error('Failed to initialize CircosPlotter:', error);
        const loadingEl = document.getElementById('loadingIndicator');
        if (loadingEl) {
            loadingEl.innerHTML = `
                <div style="color: red;">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>Initialization Error: ${error.message}</span>
                    <br><small>Check console for details</small>
                </div>
            `;
        }
    }
}); 