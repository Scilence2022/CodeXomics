/**
 * Circos Genome Plotter - CodeXomics
 * A comprehensive circular genome visualization tool with AI-powered parameter control
 */

class CircosPlotter {
  constructor() {
    // Canvas properties
    this.width = 800;
    this.height = 800;
    this.radius = 300;
    this.innerRadiusRatio = 0.8;
    this.innerRadius = this.radius * this.innerRadiusRatio;
    this.startAngle = -90;

    // Rendering mode properties
    this.renderingMode = 'canvas'; // 'svg' or 'canvas'
    this.canvas = null;
    this.ctx = null;
    this.svg = null;
    this.g = null;

    // Chromosome properties
    this.chromosomeWidth = 15;
    this.chromosomeGap = 2;
    this.labelDistance = 20;
    this.showLabels = true;
    this.showTicks = false;

    // Gene properties
    this.geneHeight = 8;
    this.showGenes = true;

    // Link properties
    this.showLinks = true;
    this.linkOpacity = 0.6;

    // Data track properties
    this.showGCContent = false;
    this.showGCSkew = false;
    this.showWigData = false;
    this.gcWindowSize = 10000;
    this.wigTrackHeight = 30;

    // Initialize multi-track gene manager
    this.multiTrackManager = null;

    // Unified data interface
    this.dataProcessor = new CircosDataProcessor(this);

  // Pre-computed data tracks from real genome (populated via IPC)
  // Computed at gcWindowSize=10000 in the main window; used when available
  // regardless of current gcWindowSize slider (which affects synthetic fallback)
  this.preComputedTracks = null;

    // Legend properties
    this.showLegend = true;
    this.legendPosition = 'top-right';
    this.legendOpacity = 0.95;

    // Chromosome ordering
    this.chromosomeOrder = 'default';
    this.originalChromosomeOrder = null;

    // Color themes - comprehensive design system for publications
    this.colorThemes = {
      scientific: {
        name: 'Scientific',
        description: 'Professional academic style for high-impact publications',
        chromosomes: [
          '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b',
          '#e377c2', '#7f7f7f', '#bcbd22', '#17becf', '#aec7e8', '#ffbb78',
          '#98df8a', '#ff9896', '#c5b0d5', '#c49c94', '#f7b6d3', '#c7c7c7',
          '#dbdb8d', '#9edae5', '#393b79', '#637939', '#8c6d31', '#843c39',
        ],
        background: '#ffffff',
        stroke: '#2c3e50',
        genes: {
          protein_coding: '#27ae60', non_coding: '#f39c12',
          pseudogene: '#e74c3c', regulatory: '#8e44ad', default: '#7f8c8d',
        },
        tracks: {
          gc_content: '#27ae60', gc_skew: '#e74c3c', wig_data: '#9b59b6',
          expression_high: '#e74c3c', expression_medium: '#f39c12',
          expression_low: '#3498db', baseline: '#bdc3c7',
        },
        links: {
          strong: '#2c3e50', medium: '#34495e', weak: '#7f8c8d',
          gradient: ['#3498db', '#e74c3c'],
        },
        text: '#2c3e50',
        ticks: '#7f8c8d',
        legend: { background: '#f8f9fa', border: '#dee2e6', text: '#2c3e50' },
      },
      nature: {
        name: 'Nature',
        description: 'Earth-tone palette for ecological and plant genomics',
        chromosomes: [
          '#2d5016', '#4a7c59', '#6b9080', '#a4c3a2', '#84a98c', '#52796f',
          '#354f52', '#2f3e46', '#588157', '#3a5a40', '#344e41', '#dad7cd',
          '#a3b18a', '#588157', '#3a5a40', '#606c38', '#283618', '#fefae0',
          '#dda15e', '#bc6c25', '#8b5cf6', '#a855f7', '#9333ea', '#7c3aed',
        ],
        background: '#fefae0',
        stroke: '#283618',
        genes: {
          protein_coding: '#2d5016', non_coding: '#bc6c25',
          pseudogene: '#8b5cf6', regulatory: '#6b9080', default: '#606c38',
        },
        tracks: {
          gc_content: '#2d5016', gc_skew: '#bc6c25', wig_data: '#8b5cf6',
          expression_high: '#8b5cf6', expression_medium: '#bc6c25',
          expression_low: '#6b9080', baseline: '#a3b18a',
        },
        links: {
          strong: '#2d5016', medium: '#4a7c59', weak: '#84a98c',
          gradient: ['#6b9080', '#bc6c25'],
        },
        text: '#283618', ticks: '#606c38',
        legend: { background: '#f7f3e9', border: '#d4c5a9', text: '#283618' },
      },
      ocean: {
        name: 'Ocean',
        description: 'Deep blue gradient for marine biology and aquatic genomics',
        chromosomes: [
          '#003f5c', '#2f4b7c', '#665191', '#a05195', '#d45087', '#f95d6a',
          '#ff7c43', '#ffa600', '#0077be', '#00a8cc', '#7dd3c0', '#d4f1f4',
          '#006ba6', '#0496c7', '#5fbdbd', '#7dd3c0', '#a2d5f2', '#bee9e8',
          '#62b6cb', '#1b4965', '#cae9ff', '#5fa8d3', '#1b4965', '#bee9e8',
        ],
        background: '#f0f9ff', stroke: '#1b4965',
        genes: {
          protein_coding: '#0077be', non_coding: '#ff7c43',
          pseudogene: '#a05195', regulatory: '#665191', default: '#5fbdbd',
        },
        tracks: {
          gc_content: '#0077be', gc_skew: '#ff7c43', wig_data: '#a05195',
          expression_high: '#d45087', expression_medium: '#ff7c43',
          expression_low: '#7dd3c0', baseline: '#bee9e8',
        },
        links: {
          strong: '#003f5c', medium: '#2f4b7c', weak: '#7dd3c0',
          gradient: ['#0077be', '#ff7c43'],
        },
        text: '#1b4965', ticks: '#006ba6',
        legend: { background: '#e6f3ff', border: '#b3d9ff', text: '#1b4965' },
      },
      sunset: {
        name: 'Sunset',
        description: 'Warm gradient palette for presentations and outreach',
        chromosomes: [
          '#ff6b35', '#f7931e', '#ffd23f', '#06ffa5', '#1fb3d3', '#5d737e',
          '#64b6ac', '#c0fdfb', '#daffef', '#fcf5c7', '#aafcb8', '#cf1259',
          '#f71735', '#fb8500', '#ffb700', '#8ecae6', '#219ebc', '#023047',
          '#ffb3c6', '#fb8500', '#8ecae6', '#219ebc', '#023047', '#ffb3c6',
        ],
        background: '#fff8f0', stroke: '#8b4513',
        genes: {
          protein_coding: '#06ffa5', non_coding: '#ff6b35',
          pseudogene: '#cf1259', regulatory: '#1fb3d3', default: '#5d737e',
        },
        tracks: {
          gc_content: '#06ffa5', gc_skew: '#ff6b35', wig_data: '#cf1259',
          expression_high: '#f71735', expression_medium: '#f7931e',
          expression_low: '#64b6ac', baseline: '#c0fdfb',
        },
        links: {
          strong: '#8b4513', medium: '#cf1259', weak: '#64b6ac',
          gradient: ['#ff6b35', '#06ffa5'],
        },
        text: '#8b4513', ticks: '#023047',
        legend: { background: '#fef7f0', border: '#f4d1ae', text: '#8b4513' },
      },
      arctic: {
        name: 'Arctic',
        description: 'Cool blue monochrome for cold adaptation studies',
        chromosomes: [
          '#e8f4f8', '#d1ecf1', '#b8e0ea', '#9fd3e2', '#85c5da', '#6bb6d2',
          '#52a6ca', '#3895c2', '#1f83ba', '#0570b0', '#045a8d', '#023858',
          '#74a9cf', '#2b8cbe', '#045a8d', '#023858', '#a6bddb', '#74a9cf',
          '#3690c0', '#0570b0', '#034e7b', '#012840', '#41b6c4', '#2c7fb8',
        ],
        background: '#f7fcfd', stroke: '#023858',
        genes: {
          protein_coding: '#0570b0', non_coding: '#41b6c4',
          pseudogene: '#2c7fb8', regulatory: '#3895c2', default: '#74a9cf',
        },
        tracks: {
          gc_content: '#0570b0', gc_skew: '#41b6c4', wig_data: '#2c7fb8',
          expression_high: '#023858', expression_medium: '#045a8d',
          expression_low: '#b8e0ea', baseline: '#d1ecf1',
        },
        links: {
          strong: '#023858', medium: '#0570b0', weak: '#85c5da',
          gradient: ['#023858', '#41b6c4'],
        },
        text: '#023858', ticks: '#045a8d',
        legend: { background: '#f0f8ff', border: '#c6e2ff', text: '#023858' },
      },
      cosmic: {
        name: 'Cosmic',
        description: 'Dark space theme for presentations and night mode',
        chromosomes: [
          '#0d1b2a', '#1b263b', '#415a77', '#778da9', '#e0e1dd', '#7209b7',
          '#a663cc', '#4cc9f0', '#7209b7', '#f72585', '#b5179e', '#7209b7',
          '#480ca8', '#3a0ca3', '#3f37c9', '#7209b7', '#f72585', '#4cc9f0',
          '#4361ee', '#4895ef', '#4cc9f0', '#00f5ff', '#7209b7', '#f72585',
        ],
        background: '#0d1b2a', stroke: '#e0e1dd',
        genes: {
          protein_coding: '#4cc9f0', non_coding: '#f72585',
          pseudogene: '#7209b7', regulatory: '#a663cc', default: '#778da9',
        },
        tracks: {
          gc_content: '#4cc9f0', gc_skew: '#f72585', wig_data: '#7209b7',
          expression_high: '#f72585', expression_medium: '#a663cc',
          expression_low: '#4cc9f0', baseline: '#415a77',
        },
        links: {
          strong: '#e0e1dd', medium: '#a663cc', weak: '#778da9',
          gradient: ['#4cc9f0', '#f72585'],
        },
        text: '#e0e1dd', ticks: '#778da9',
        legend: { background: '#1b263b', border: '#415a77', text: '#e0e1dd' },
      },
      forest: {
        name: 'Forest',
        description: 'Rich green palette for plant genomics and ecology',
        chromosomes: [
          '#2d5016', '#52734d', '#91c788', '#b7d3aa', '#c7d59f', '#e0e5b6',
          '#f3e8d0', '#8b5a3c', '#a0522d', '#cd853f', '#daa520', '#228b22',
          '#32cd32', '#9acd32', '#adff2f', '#7cfc00', '#00ff00', '#00ff7f',
          '#00fa9a', '#90ee90', '#98fb98', '#f0fff0', '#006400', '#008000',
        ],
        background: '#f5f5dc', stroke: '#2d5016',
        genes: {
          protein_coding: '#228b22', non_coding: '#cd853f',
          pseudogene: '#8b5a3c', regulatory: '#91c788', default: '#52734d',
        },
        tracks: {
          gc_content: '#228b22', gc_skew: '#cd853f', wig_data: '#8b5a3c',
          expression_high: '#006400', expression_medium: '#32cd32',
          expression_low: '#b7d3aa', baseline: '#c7d59f',
        },
        links: {
          strong: '#2d5016', medium: '#52734d', weak: '#91c788',
          gradient: ['#228b22', '#cd853f'],
        },
        text: '#2d5016', ticks: '#006400',
        legend: { background: '#f0f8f0', border: '#c8e6c8', text: '#2d5016' },
      },
      monochrome: {
        name: 'Monochrome',
        description: 'Grayscale palette for print publications and accessibility',
        chromosomes: [
          '#000000', '#1a1a1a', '#333333', '#4d4d4d', '#666666',
          '#808080', '#999999', '#b3b3b3', '#cccccc', '#e6e6e6',
          '#f2f2f2', '#0f0f0f', '#262626', '#404040', '#595959',
          '#737373', '#8c8c8c', '#a6a6a6', '#bfbfbf', '#d9d9d9',
          '#f0f0f0', '#1f1f1f', '#383838', '#525252',
        ],
        background: '#ffffff', stroke: '#000000',
        genes: {
          protein_coding: '#000000', non_coding: '#4d4d4d',
          pseudogene: '#808080', regulatory: '#333333', default: '#999999',
        },
        tracks: {
          gc_content: '#000000', gc_skew: '#4d4d4d', wig_data: '#666666',
          expression_high: '#000000', expression_medium: '#4d4d4d',
          expression_low: '#b3b3b3', baseline: '#cccccc',
        },
        links: {
          strong: '#000000', medium: '#4d4d4d', weak: '#999999',
          gradient: ['#000000', '#808080'],
        },
        text: '#000000', ticks: '#333333',
        legend: { background: '#f8f8f8', border: '#cccccc', text: '#000000' },
      },
    };

    // Current theme
    this.currentTheme = 'scientific';

    // Apply current theme colors
    this.applyTheme(this.currentTheme);

    // Data
    this.data = null;

    // Initialize tooltip
    this.tooltip = d3
      .select('body')
      .append('div')
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

    // Interactive features
    this.zoom = d3
      .zoom()
      .scaleExtent([0.5, 5])
      .on('zoom', event => this.handleZoom(event));

    this.panEnabled = true;
    this.zoomEnabled = true;
    this.currentZoom = 1;
    this.currentPan = { x: 0, y: 0 };

    // Performance optimization
    this.performanceMode = false;
    this.largeDatasetThreshold = 1000;
    this.animationDuration = 750;
    this.debounceDelay = 150;

    // Create debounced redraw
    this._debouncedRedraw = this._debounce(() => this._createPlot(), this.debounceDelay);

    // Initialize
    this.initializeUI();
    this.setupEventListeners();
    this.loadExampleData();

    // Try to load current genome data from main window
    this.loadCurrentGenomeData();
  }

  // ─── Utility ────────────────────────────────────────────

  _debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func.apply(this, args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // ─── Theme ──────────────────────────────────────────────

  applyTheme(themeName) {
    const theme = this.colorThemes[themeName];
    if (!theme) return;

    this.currentTheme = themeName;
    this.backgroundColor = theme.background;
    this.strokeColor = theme.stroke;
    this.strokeWidth = 1;

    // Update UI elements
    const bgPicker = document.getElementById('backgroundColorPicker');
    const strokePicker = document.getElementById('strokeColorPicker');
    if (bgPicker) bgPicker.value = theme.background;
    if (strokePicker) strokePicker.value = theme.stroke;

    // Update data track color buttons and pickers
    const trackColorSync = [
      { btnId: 'gcContentColorBtn', pickerId: 'gcContentColorPicker', color: theme.tracks.gc_content },
      { btnId: 'gcSkewColorBtn', pickerId: 'gcSkewColorPicker', color: theme.tracks.gc_skew },
      { btnId: 'wigDataColorBtn', pickerId: 'wigDataColorPicker', color: theme.tracks.wig_data },
    ];
    trackColorSync.forEach(({ btnId, pickerId, color }) => {
      const btn = document.getElementById(btnId);
      const picker = document.getElementById(pickerId);
      if (btn) btn.style.backgroundColor = color;
      if (picker) picker.value = color;
    });

    if (this.data) {
      this.redrawPlot();
    }
  }

  getCurrentTheme() {
    return this.colorThemes[this.currentTheme];
  }

  getGeneColor(gene, theme) {
    const geneType = gene.type || 'default';
    return (theme && theme.genes && theme.genes[geneType]) || theme.genes.default || '#95a5a6';
  }

  getTrackColor(trackType, theme) {
    const trackColorMap = {
      gc_content: theme.tracks.gc_content,
      gc_skew: theme.tracks.gc_skew,
      wig: theme.tracks.wig_data,
    };
    return trackColorMap[trackType] || '#95a5a6';
  }

  // ─── UI Initialization ──────────────────────────────────

  initializeUI() {
    const requiredElements = ['statusDot', 'statusText', 'tooltip'];
    for (const elementId of requiredElements) {
      if (!document.getElementById(elementId)) {
        console.error(`Required element #${elementId} not found`);
        return false;
      }
    }

    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    if (statusDot) statusDot.className = 'status-dot connected';
    if (statusText) statusText.textContent = 'Ready';

    this.tooltip = d3.select('#tooltip');
    this.updateParameterDisplays();
    return true;
  }

  calculateOptimalSize() {
    const container = document.getElementById('circosContainer');
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const padding = 40;
    const maxSize = Math.min(containerRect.width, containerRect.height) - padding;

    this.width = Math.max(400, maxSize);
    this.height = this.width;
    this.radius = Math.min(this.width, this.height) * 0.35;
    this.innerRadius = this.radius * this.innerRadiusRatio;

    const radiusSlider = document.getElementById('radiusSlider');
    if (radiusSlider) {
      radiusSlider.max = this.radius * 1.5;
      radiusSlider.value = this.radius;
    }

    this.updateParameterDisplays();
  }

  setupEventListeners() {
    // Toolbar buttons
    document.getElementById('loadDataBtn').addEventListener('click', () => this.loadDataFile());
    document.getElementById('exampleDataBtn').addEventListener('click', () => this.loadExampleData());
    document.getElementById('loadCurrentBtn').addEventListener('click', () => this.loadCurrentGenomeData());
    document.getElementById('exportBtn').addEventListener('click', () => this.exportSVG());
    document.getElementById('resetBtn').addEventListener('click', () => this.resetPlot());
    document.getElementById('helpBtn').addEventListener('click', () => this.showHelp());
    document.getElementById('resetZoomBtn').addEventListener('click', () => this.resetZoom());

    // Slider controls - all use debounced redraw for performance
    const sliderBindings = [
      ['radiusSlider', v => { this.radius = parseInt(v); this.innerRadius = this.radius * this.innerRadiusRatio; }],
      ['innerRadiusSlider', v => { this.innerRadiusRatio = parseFloat(v); this.innerRadius = this.radius * this.innerRadiusRatio; }],
      ['startAngleSlider', v => { this.startAngle = parseInt(v); }],
      ['chrWidthSlider', v => { this.chromosomeWidth = parseInt(v); }],
      ['gapSlider', v => { this.chromosomeGap = parseFloat(v); }],
      ['labelDistanceSlider', v => { this.labelDistance = parseInt(v); }],
      ['strokeWidthSlider', v => { this.strokeWidth = parseFloat(v); }],
      ['geneHeightSlider', v => { this.geneHeight = parseInt(v); }],
      ['linkOpacitySlider', v => { this.linkOpacity = parseFloat(v); }],
      ['gcWindowSlider', v => { this.gcWindowSize = parseInt(v); }],
      ['wigHeightSlider', v => { this.wigTrackHeight = parseInt(v); }],
      ['legendOpacitySlider', v => { this.legendOpacity = parseFloat(v); }],
    ];

    sliderBindings.forEach(([id, setter]) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', e => {
          setter(e.target.value);
          this.updateParameterDisplays();
          this.redrawPlot();
        });
      }
    });

    // Checkbox controls
    const checkboxBindings = [
      ['showLabelsCheck', v => { this.showLabels = v; }],
      ['showTicksCheck', v => { this.showTicks = v; }],
      ['showGenesCheck', v => { this.showGenes = v; }],
      ['showLinksCheck', v => { this.showLinks = v; }],
      ['showGCContentCheck', v => { this.showGCContent = v; }],
      ['showGCSkewCheck', v => { this.showGCSkew = v; }],
      ['showWigDataCheck', v => { this.showWigData = v; }],
      ['showLegendCheck', v => { this.showLegend = v; }],
    ];

    checkboxBindings.forEach(([id, setter]) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', e => {
          setter(e.target.checked);
          this.redrawPlot();
        });
      }
    });

    // Theme & rendering mode selects
    document.getElementById('themeSelect').addEventListener('change', e => {
      this.applyTheme(e.target.value);
    });

    document.getElementById('renderingModeSelect').addEventListener('change', e => {
      this.renderingMode = e.target.value;
      this.updateStatus(`Switched to ${this.renderingMode.toUpperCase()} rendering mode`);
      this.createPlot();
    });

    // Color pickers
    document.getElementById('backgroundColorPicker').addEventListener('input', e => {
      this.backgroundColor = e.target.value;
      this.redrawPlot();
    });

    document.getElementById('strokeColorPicker').addEventListener('input', e => {
      this.strokeColor = e.target.value;
      this.redrawPlot();
    });

    // Data track color pickers
    const trackColorBindings = [
      { btnId: 'gcContentColorBtn', pickerId: 'gcContentColorPicker', trackKey: 'gc_content' },
      { btnId: 'gcSkewColorBtn', pickerId: 'gcSkewColorPicker', trackKey: 'gc_skew' },
      { btnId: 'wigDataColorBtn', pickerId: 'wigDataColorPicker', trackKey: 'wig_data' },
    ];

    trackColorBindings.forEach(({ btnId, pickerId, trackKey }) => {
      const btn = document.getElementById(btnId);
      const picker = document.getElementById(pickerId);
      if (!btn || !picker) return;

      btn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        picker.click();
      });

      picker.addEventListener('input', e => {
        const theme = this.getCurrentTheme();
        theme.tracks[trackKey] = e.target.value;
        btn.style.backgroundColor = e.target.value;
        this.dataProcessor.clearCache();
        this.redrawPlot();
      });
    });

    // Sample data buttons
    document.getElementById('loadHumanBtn').addEventListener('click', () => this.loadHumanData());
    document.getElementById('loadEcoliBtn').addEventListener('click', () => this.loadEcoliData());
    document.getElementById('loadYeastBtn').addEventListener('click', () => this.loadYeastData());
    document.getElementById('loadDrosaBtn').addEventListener('click', () => this.loadDrosophilaData());
    document.getElementById('loadPlantBtn').addEventListener('click', () => this.loadPlantData());
    document.getElementById('loadVirusBtn').addEventListener('click', () => this.loadVirusData());

    // Chromosome order controls
    document.getElementById('chromosomeOrderSelect').addEventListener('change', e => {
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
    document.getElementById('legendPositionSelect').addEventListener('change', e => {
      this.legendPosition = e.target.value;
      this.redrawPlot();
    });

    // Window resize handler
    window.addEventListener('resize', () => {
      this.calculateOptimalSize();
      this.redrawPlot();
    }, { passive: true });
  }

  updateParameterDisplays() {
    const updates = {
      radiusValue: `${Math.round(this.radius)}px`,
      innerRadiusValue: `${Math.round(this.innerRadiusRatio * 100)}%`,
      startAngleValue: `${this.startAngle}°`,
      chrWidthValue: `${this.chromosomeWidth}px`,
      gapValue: `${this.chromosomeGap}°`,
      labelDistanceValue: `${this.labelDistance}px`,
      strokeWidthValue: `${this.strokeWidth}px`,
      geneHeightValue: `${this.geneHeight}px`,
      linkOpacityValue: `${Math.round(this.linkOpacity * 100)}%`,
      gcWindowValue: `${Math.round(this.gcWindowSize / 1000)}kb`,
      wigHeightValue: `${this.wigTrackHeight}px`,
      legendOpacityValue: `${Math.round(this.legendOpacity * 100)}%`,
    };

    Object.entries(updates).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    });
  }

  // ─── Status ─────────────────────────────────────────────

  updateStatus(message, type) {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');

    if (statusDot && type) {
      statusDot.className = `status-dot ${type}`;
    }
    if (statusText) {
      statusText.textContent = message;
    }
  }

  // ─── Data Loading ───────────────────────────────────────

  loadExampleData() {
    this.loadHumanData();
  }

  async loadCurrentGenomeData() {
    try {
      if (typeof require !== 'undefined' && require('electron')) {
        const { ipcRenderer } = require('electron');
        const result = await ipcRenderer.invoke('get-circos-genome-data');

        if (result && result.success) {
          this.data = result.data;
          this.preComputedTracks = result.preComputedTracks || {};
          this.sequenceData = null;

          const hasTracks = Object.keys(this.preComputedTracks).length > 0;
          this.updateStatus(
            hasTracks ? 'Connected — real sequence data available' : 'Connected — using synthetic data',
            'connected'
          );
          this.optimizeForLargeDataset();
          this.createPlot();
          this.updateDataInfo();
          return true;
        } else {
          console.error('IPC result error:', result?.error);
          this.updateStatus('Error: ' + (result?.error || 'No genome data loaded'), 'disconnected');
        }
      }
    } catch (error) {
      this.updateStatus('Standalone mode', 'disconnected');
    }
    return false;
  }

  showNoDataMessage() {
    const container = d3.select('#circosContainer');
    container.selectAll('*').remove();

    container
      .append('div')
      .style('display', 'flex')
      .style('flex-direction', 'column')
      .style('align-items', 'center')
      .style('justify-content', 'center')
      .style('height', '100%')
      .style('color', '#6b7280')
      .style('text-align', 'center')
      .html(`
        <i class="fas fa-dna" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
        <h3 style="margin-bottom: 8px; font-weight: 500;">No Genome Data</h3>
        <p style="margin-bottom: 16px;">Load genome data to create a Circos plot</p>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-primary" onclick="circosPlotter.loadCurrentGenomeData()">
            <i class="fas fa-dna"></i> Load Current Genome
          </button>
          <button class="btn btn-secondary" onclick="circosPlotter.loadExampleData()">
            <i class="fas fa-flask"></i> Load Example
          </button>
        </div>
      `);
  }

  updateDataInfo() {
    if (!this.data) return;

    const info = this.data.metadata;
    const statusText = document.getElementById('statusText');
    if (statusText) {
      let statusMessage = `${info.totalChromosomes} chromosomes, ${info.totalGenes} genes, ${(info.totalLength / 1000000).toFixed(1)}M bp`;

      const hasRealData = this.preComputedTracks && Object.keys(this.preComputedTracks).length > 0;
      if (hasRealData) {
        statusMessage += ' (Real sequence data available)';
      } else {
        statusMessage += ' (Using synthetic data)';
      }

      statusText.textContent = statusMessage;
    }
  }

  // ─── Zoom ───────────────────────────────────────────────

  handleZoom(event) {
    if (!this.zoomEnabled) return;

    const { transform } = event;
    this.currentZoom = transform.k;
    this.currentPan = { x: transform.x, y: transform.y };

    const g = this.svg.select('g');
    g.attr('transform',
      `translate(${this.width / 2 + transform.x}, ${this.height / 2 + transform.y}) rotate(${this.startAngle}) scale(${transform.k})`
    );

    this.updateStatus(`Zoom: ${(transform.k * 100).toFixed(0)}%`);
  }

  resetZoom() {
    this.currentZoom = 1;
    this.currentPan = { x: 0, y: 0 };
    if (this.svg) {
      this.svg.transition().duration(750).call(this.zoom.transform, d3.zoomIdentity);
    }
    this.updateStatus('Zoom reset');
  }

  zoomIn() {
    if (this.svg && this.zoom) {
      this.svg.transition().call(this.zoom.scaleBy, 1.5);
    }
  }

  zoomOut() {
    if (this.svg && this.zoom) {
      this.svg.transition().call(this.zoom.scaleBy, 1 / 1.5);
    }
  }

  fitToWindow() {
    if (this.svg && this.zoom) {
      this.svg.transition().call(this.zoom.transform, d3.zoomIdentity);
    }
  }

  resetView() {
    this.resetZoom();
  }

  // ─── Sample Data ────────────────────────────────────────

  loadHumanData() {
    this.data = {
      title: 'Human Genome (Homo sapiens)',
      chromosomes: [
        { name: 'chr1', length: 248956422 }, { name: 'chr2', length: 242193529 },
        { name: 'chr3', length: 198295559 }, { name: 'chr4', length: 190214555 },
        { name: 'chr5', length: 181538259 }, { name: 'chr6', length: 170805979 },
        { name: 'chr7', length: 159345973 }, { name: 'chr8', length: 145138636 },
        { name: 'chr9', length: 138394717 }, { name: 'chr10', length: 133797422 },
        { name: 'chr11', length: 135086622 }, { name: 'chr12', length: 133275309 },
        { name: 'chr13', length: 114364328 }, { name: 'chr14', length: 107043718 },
        { name: 'chr15', length: 101991189 }, { name: 'chr16', length: 90338345 },
        { name: 'chr17', length: 83257441 }, { name: 'chr18', length: 80373285 },
        { name: 'chr19', length: 58617616 }, { name: 'chr20', length: 64444167 },
        { name: 'chr21', length: 46709983 }, { name: 'chr22', length: 50818468 },
        { name: 'chrX', length: 156040895 }, { name: 'chrY', length: 57227415 },
      ],
      genes: [],
      links: [],
    };

    this.data.genes = this.generateHumanGenes();
    this.data.links = this.generateHumanLinks();
    this.data.metadata = {
      totalChromosomes: this.data.chromosomes.length,
      totalGenes: this.data.genes.length,
      totalLength: this.data.chromosomes.reduce((s, c) => s + c.length, 0),
    };

    this.updateStatus('Human genome loaded: 24 chromosomes');
    this.createPlot();
  }

  loadEcoliData() {
    this.data = {
      title: 'E. coli K-12 MG1655',
      chromosomes: [{ name: 'chromosome', length: 4641652 }],
      genes: [
        { chromosome: 'chromosome', start: 190, end: 255, name: 'thrL', type: 'protein_coding', value: 0.8 },
        { chromosome: 'chromosome', start: 337, end: 2799, name: 'thrA', type: 'protein_coding', value: 0.9 },
        { chromosome: 'chromosome', start: 2801, end: 3733, name: 'thrB', type: 'protein_coding', value: 0.85 },
        { chromosome: 'chromosome', start: 3734, end: 5020, name: 'thrC', type: 'protein_coding', value: 0.75 },
        { chromosome: 'chromosome', start: 5234, end: 5530, name: 'yaaX', type: 'protein_coding', value: 0.6 },
        { chromosome: 'chromosome', start: 336000, end: 336879, name: 'lacI', type: 'protein_coding', value: 0.95 },
        { chromosome: 'chromosome', start: 365000, end: 368200, name: 'lacZ', type: 'protein_coding', value: 0.92 },
        { chromosome: 'chromosome', start: 368284, end: 369350, name: 'lacY', type: 'protein_coding', value: 0.88 },
        { chromosome: 'chromosome', start: 369363, end: 370013, name: 'lacA', type: 'protein_coding', value: 0.78 },
      ],
      links: [],
    };

    this.data.genes = this.data.genes.concat(this.generateEcoliGenes());
    this.data.links = this.generateEcoliLinks();
    this.data.metadata = {
      totalChromosomes: this.data.chromosomes.length,
      totalGenes: this.data.genes.length,
      totalLength: this.data.chromosomes.reduce((s, c) => s + c.length, 0),
    };

    this.updateStatus('E. coli genome loaded: 1 chromosome');
    this.createPlot();
  }

  loadYeastData() {
    this.data = {
      title: 'Saccharomyces cerevisiae',
      chromosomes: [
        { name: 'chrI', length: 230218 }, { name: 'chrII', length: 813184 },
        { name: 'chrIII', length: 316620 }, { name: 'chrIV', length: 1531933 },
        { name: 'chrV', length: 576874 }, { name: 'chrVI', length: 270161 },
        { name: 'chrVII', length: 1090940 }, { name: 'chrVIII', length: 562643 },
        { name: 'chrIX', length: 439888 }, { name: 'chrX', length: 745751 },
        { name: 'chrXI', length: 666816 }, { name: 'chrXII', length: 1078177 },
        { name: 'chrXIII', length: 924431 }, { name: 'chrXIV', length: 784333 },
        { name: 'chrXV', length: 1091291 }, { name: 'chrXVI', length: 948066 },
      ],
      genes: [],
      links: [],
    };

    this.data.genes = this.generateYeastGenes();
    this.data.links = this.generateYeastLinks();
    this.data.metadata = {
      totalChromosomes: this.data.chromosomes.length,
      totalGenes: this.data.genes.length,
      totalLength: this.data.chromosomes.reduce((s, c) => s + c.length, 0),
    };

    this.updateStatus('Yeast genome loaded: 16 chromosomes');
    this.createPlot();
  }

  loadDrosophilaData() {
    this.data = {
      title: 'Drosophila melanogaster',
      chromosomes: [
        { name: 'chrX', length: 23542271 }, { name: 'chr2L', length: 23513712 },
        { name: 'chr2R', length: 25286936 }, { name: 'chr3L', length: 28110227 },
        { name: 'chr3R', length: 32079331 }, { name: 'chr4', length: 1348131 },
      ],
      genes: [],
      links: [],
    };

    this.data.genes = this.generateDrosophilaGenes();
    this.data.links = this.generateDrosophilaLinks();
    this.data.metadata = {
      totalChromosomes: this.data.chromosomes.length,
      totalGenes: this.data.genes.length,
      totalLength: this.data.chromosomes.reduce((s, c) => s + c.length, 0),
    };

    this.updateStatus('Drosophila genome loaded: 6 chromosomes');
    this.createPlot();
  }

  loadPlantData() {
    this.data = {
      title: 'Arabidopsis thaliana',
      chromosomes: [
        { name: 'chr1', length: 30427671 }, { name: 'chr2', length: 19698289 },
        { name: 'chr3', length: 23459830 }, { name: 'chr4', length: 18585056 },
        { name: 'chr5', length: 26975502 },
      ],
      genes: [],
      links: [],
    };

    this.data.genes = this.generatePlantGenes();
    this.data.links = this.generatePlantLinks();
    this.data.metadata = {
      totalChromosomes: this.data.chromosomes.length,
      totalGenes: this.data.genes.length,
      totalLength: this.data.chromosomes.reduce((s, c) => s + c.length, 0),
    };

    this.updateStatus('Plant genome loaded: 5 chromosomes');
    this.createPlot();
  }

  loadVirusData() {
    this.data = {
      title: 'SARS-CoV-2',
      chromosomes: [{ name: 'genome', length: 29903 }],
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
        { chromosome: 'genome', start: 29558, end: 29674, name: 'ORF10', type: 'protein_coding', value: 0.5 },
      ],
      links: [],
    };
    this.data.metadata = {
      totalChromosomes: this.data.chromosomes.length,
      totalGenes: this.data.genes.length,
      totalLength: this.data.chromosomes.reduce((s, c) => s + c.length, 0),
    };

    this.updateStatus('Virus genome loaded: 1 chromosome');
    this.createPlot();
  }

  // ─── Gene/Link Generation ───────────────────────────────

  generateHumanGenes() {
    const genes = [];
    const geneNames = [
      'BRCA1', 'TP53', 'EGFR', 'MYC', 'KRAS', 'PIK3CA', 'PTEN', 'RB1',
      'APC', 'VHL', 'CDKN2A', 'MLH1', 'BRCA2', 'ATM', 'CHEK2', 'PALB2',
      'CDH1', 'STK11', 'SMAD4', 'DCC', 'TERT', 'IDH1', 'ARID1A', 'CTNNB1', 'FBXW7',
    ];
    const geneTypes = ['protein_coding', 'non_coding', 'pseudogene', 'regulatory'];
    const typeWeights = [0.6, 0.2, 0.15, 0.05];

    this.data.chromosomes.forEach((chr, chrIndex) => {
      const numGenes = Math.floor(Math.random() * 30) + 15;
      for (let i = 0; i < numGenes; i++) {
        const start = Math.floor(Math.random() * (chr.length - 100000));
        const length = Math.floor(Math.random() * 95000) + 5000;

        const rand = Math.random();
        let geneType = 'protein_coding';
        let cumWeight = 0;
        for (let j = 0; j < geneTypes.length; j++) {
          cumWeight += typeWeights[j];
          if (rand <= cumWeight) { geneType = geneTypes[j]; break; }
        }

        genes.push({
          chromosome: chr.name,
          start, end: start + length,
          name: geneNames[Math.floor(Math.random() * geneNames.length)] + `_${chrIndex + 1}_${i + 1}`,
          type: geneType,
          expression: Math.random(),
          value: Math.random(),
        });
      }
    });
    return genes;
  }

  generateHumanLinks() {
    const links = [];
    for (let i = 0; i < 50; i++) {
      const chr1 = this.data.chromosomes[Math.floor(Math.random() * this.data.chromosomes.length)];
      const chr2 = this.data.chromosomes[Math.floor(Math.random() * this.data.chromosomes.length)];
      if (chr1.name !== chr2.name) {
        links.push({
          source: {
            chromosome: chr1.name,
            start: Math.floor(Math.random() * (chr1.length - 1000000)),
            end: Math.floor(Math.random() * 1000000) + 500000,
          },
          target: {
            chromosome: chr2.name,
            start: Math.floor(Math.random() * (chr2.length - 1000000)),
            end: Math.floor(Math.random() * 1000000) + 500000,
          },
          type: ['synteny', 'duplication', 'inversion'][Math.floor(Math.random() * 3)],
          value: Math.random(),
        });
      }
    }
    return links;
  }

  generateEcoliGenes() {
    const genes = [];
    const geneNames = ['dnaA', 'dnaB', 'dnaC', 'dnaG', 'dnaK', 'recA', 'rpoA', 'rpoB', 'rpoC', 'gyrA', 'gyrB'];
    for (let i = 0; i < 100; i++) {
      const start = Math.floor(Math.random() * (this.data.chromosomes[0].length - 5000));
      const length = Math.floor(Math.random() * 3000) + 500;
      genes.push({
        chromosome: 'chromosome', start, end: start + length,
        name: geneNames[i % geneNames.length] + `_${Math.floor(i / geneNames.length) + 1}`,
        type: 'protein_coding', value: Math.random() * 0.5 + 0.5,
      });
    }
    return genes;
  }

  generateEcoliLinks() { return []; }

  generateYeastGenes() {
    const genes = [];
    this.data.chromosomes.forEach(chr => {
      const numGenes = Math.floor(chr.length / 5000);
      for (let i = 0; i < numGenes; i++) {
        const start = Math.floor(Math.random() * (chr.length - 2000));
        const length = Math.floor(Math.random() * 1500) + 500;
        genes.push({
          chromosome: chr.name, start, end: start + length,
          name: `Y${chr.name.replace('chr', '')}${String(i + 1).padStart(3, '0')}C`,
          type: 'protein_coding', value: Math.random(),
        });
      }
    });
    return genes;
  }

  generateYeastLinks() {
    const links = [];
    for (let i = 0; i < 15; i++) {
      const chr1 = this.data.chromosomes[Math.floor(Math.random() * this.data.chromosomes.length)];
      const chr2 = this.data.chromosomes[Math.floor(Math.random() * this.data.chromosomes.length)];
      if (chr1.name !== chr2.name) {
        links.push({
          source: { chromosome: chr1.name, start: Math.floor(Math.random() * (chr1.length - 50000)), end: Math.floor(Math.random() * 50000) + 25000 },
          target: { chromosome: chr2.name, start: Math.floor(Math.random() * (chr2.length - 50000)), end: Math.floor(Math.random() * 50000) + 25000 },
          type: 'duplication', value: Math.random(),
        });
      }
    }
    return links;
  }

  generateDrosophilaGenes() {
    const genes = [];
    this.data.chromosomes.forEach(chr => {
      const numGenes = Math.floor(chr.length / 15000);
      for (let i = 0; i < numGenes; i++) {
        const start = Math.floor(Math.random() * (chr.length - 10000));
        const length = Math.floor(Math.random() * 8000) + 2000;
        genes.push({
          chromosome: chr.name, start, end: start + length,
          name: `Dm${chr.name.replace('chr', '')}${String(i + 1).padStart(4, '0')}`,
          type: Math.random() > 0.8 ? 'non_coding' : 'protein_coding', value: Math.random(),
        });
      }
    });
    return genes;
  }

  generateDrosophilaLinks() {
    const links = [];
    for (let i = 0; i < 12; i++) {
      const chr1 = this.data.chromosomes[Math.floor(Math.random() * this.data.chromosomes.length)];
      const chr2 = this.data.chromosomes[Math.floor(Math.random() * this.data.chromosomes.length)];
      if (chr1.name !== chr2.name) {
        links.push({
          source: { chromosome: chr1.name, start: Math.floor(Math.random() * (chr1.length - 100000)), end: Math.floor(Math.random() * 100000) + 50000 },
          target: { chromosome: chr2.name, start: Math.floor(Math.random() * (chr2.length - 100000)), end: Math.floor(Math.random() * 100000) + 50000 },
          type: 'inversion', value: Math.random(),
        });
      }
    }
    return links;
  }

  generatePlantGenes() {
    const genes = [];
    this.data.chromosomes.forEach((chr, chrIndex) => {
      const numGenes = Math.floor(chr.length / 8000);
      for (let i = 0; i < numGenes; i++) {
        const start = Math.floor(Math.random() * (chr.length - 5000));
        const length = Math.floor(Math.random() * 4000) + 1000;
        genes.push({
          chromosome: chr.name, start, end: start + length,
          name: `AT${chrIndex + 1}G${String(i + 1).padStart(5, '0')}`,
          type: 'protein_coding', value: Math.random(),
        });
      }
    });
    return genes;
  }

  generatePlantLinks() {
    const links = [];
    for (let i = 0; i < 10; i++) {
      const chr1 = this.data.chromosomes[Math.floor(Math.random() * this.data.chromosomes.length)];
      const chr2 = this.data.chromosomes[Math.floor(Math.random() * this.data.chromosomes.length)];
      if (chr1.name !== chr2.name) {
        links.push({
          source: { chromosome: chr1.name, start: Math.floor(Math.random() * (chr1.length - 200000)), end: Math.floor(Math.random() * 200000) + 100000 },
          target: { chromosome: chr2.name, start: Math.floor(Math.random() * (chr2.length - 200000)), end: Math.floor(Math.random() * 200000) + 100000 },
          type: 'synteny', value: Math.random(),
        });
      }
    }
    return links;
  }

  // ─── Chromosome Ordering ────────────────────────────────

  applyChromosomeOrder() {
    if (!this.data || !this.data.chromosomes) return;

    const originalOrder = [...this.data.chromosomes];

    switch (this.chromosomeOrder) {
      case 'size': this.data.chromosomes.sort((a, b) => b.length - a.length); break;
      case 'size_asc': this.data.chromosomes.sort((a, b) => a.length - b.length); break;
      case 'name': this.data.chromosomes.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'reverse': this.data.chromosomes.reverse(); break;
      case 'default':
      default:
        if (this.originalChromosomeOrder) {
          this.data.chromosomes = [...this.originalChromosomeOrder];
        }
        break;
    }

    if (!this.originalChromosomeOrder) {
      this.originalChromosomeOrder = originalOrder;
    }

    this.redrawPlot();
    this.updateStatus(`Chromosomes sorted by: ${this.chromosomeOrder}`);
  }

  shuffleChromosomes() {
    if (!this.data || !this.data.chromosomes) return;

    for (let i = this.data.chromosomes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.data.chromosomes[i], this.data.chromosomes[j]] = [this.data.chromosomes[j], this.data.chromosomes[i]];
    }

    this.chromosomeOrder = 'shuffled';
    document.getElementById('chromosomeOrderSelect').value = 'default';
    this.redrawPlot();
    this.updateStatus('Chromosomes shuffled randomly');
  }

  // ─── GC / WIG Data Calculation ──────────────────────────

  calculateGCContent(sequence, windowSize = 10000) {
    const gcData = [];
    for (let i = 0; i < sequence.length; i += windowSize) {
      const window = sequence.slice(i, i + windowSize);
      const gcCount = (window.match(/[GC]/gi) || []).length;
      gcData.push({ position: i + windowSize / 2, value: (gcCount / window.length) * 100 });
    }
    return gcData;
  }

  calculateGCSkew(sequence, windowSize = 10000) {
    const skewData = [];
    for (let i = 0; i < sequence.length; i += windowSize) {
      const window = sequence.slice(i, i + windowSize);
      const gCount = (window.match(/G/gi) || []).length;
      const cCount = (window.match(/C/gi) || []).length;
      const skew = (gCount - cCount) / (gCount + cCount) || 0;
      skewData.push({ position: i + windowSize / 2, value: skew });
    }
    return skewData;
  }

  _getSequenceForChromosome(chromosome) {
    return null;
  }

  _getPreComputedTrackData(chromosome, trackType) {
    const chrName = chromosome.name || chromosome.label || chromosome.id;
    if (this.preComputedTracks && this.preComputedTracks[chrName]) {
      const trackData = this.preComputedTracks[chrName][trackType];
      if (trackData && trackData.length > 0) return trackData;
    }
    return null;
  }

  generateRealGCData(chromosome) {
    if (this.preComputedTracks) {
      const preComputed = this._getPreComputedTrackData(chromosome, 'gc_content');
      if (preComputed && preComputed.length > 0) return preComputed;
    }

    const data = [];
    const chrLength = chromosome.length || chromosome.size || 0;
    const numPoints = Math.floor(chrLength / this.gcWindowSize);
    const sequence = this._getSequenceForChromosome(chromosome);

    for (let i = 0; i < numPoints; i++) {
      const start = i * this.gcWindowSize;
      const end = Math.min(start + this.gcWindowSize, chrLength);
      const position = start + this.gcWindowSize / 2;

      let gcContent;
      if (sequence) {
        const windowSeq = sequence.substring(start, end);
        const gcCount = (windowSeq.match(/[GC]/g) || []).length;
        gcContent = windowSeq.length > 0 ? (gcCount / windowSeq.length) * 100 : 0;
      } else {
        const baseGC = 40 + Math.sin(position / 100000) * 10;
        gcContent = Math.max(20, Math.min(80, baseGC + (Math.random() - 0.5) * 5));
      }

      data.push({ position, value: gcContent });
    }
    return data;
  }

  generateRealGCSkew(chromosome) {
    if (this.preComputedTracks) {
      const preComputed = this._getPreComputedTrackData(chromosome, 'gc_skew');
      if (preComputed && preComputed.length > 0) return preComputed;
    }

    const data = [];
    const chrLength = chromosome.length || chromosome.size || 0;
    const numPoints = Math.floor(chrLength / this.gcWindowSize);
    const sequence = this._getSequenceForChromosome(chromosome);

    for (let i = 0; i < numPoints; i++) {
      const start = i * this.gcWindowSize;
      const end = Math.min(start + this.gcWindowSize, chrLength);
      const position = start + this.gcWindowSize / 2;

      let gcSkew;
      if (sequence) {
        const windowSeq = sequence.substring(start, end);
        const gCount = (windowSeq.match(/G/g) || []).length;
        const cCount = (windowSeq.match(/C/g) || []).length;
        gcSkew = (gCount + cCount) > 0 ? (gCount - cCount) / (gCount + cCount) : 0;
      } else {
        const baseSkew = 0.1 * Math.sin(position / 200000) + 0.05 * Math.cos(position / 50000);
        gcSkew = Math.max(-0.3, Math.min(0.3, baseSkew + (Math.random() - 0.5) * 0.1));
      }

      data.push({ position, value: gcSkew });
    }
    return data;
  }

  generateRealWigData(chromosome) {
    if (this.preComputedTracks) {
      const preComputed = this._getPreComputedTrackData(chromosome, 'wig');
      if (preComputed && preComputed.length > 0) return preComputed;
    }

    const data = [];
    const chrLength = chromosome.length || chromosome.size || 0;
    const windowSize = this.gcWindowSize / 2;
    const numPoints = Math.floor(chrLength / windowSize);
    const sequence = this._getSequenceForChromosome(chromosome);

    for (let i = 0; i < numPoints; i++) {
      const start = i * windowSize;
      const end = Math.min(start + windowSize, chrLength);
      const position = start + windowSize / 4;

      let value;
      if (sequence) {
        const windowSeq = sequence.substring(start, end);
        const gcCount = (windowSeq.match(/[GC]/g) || []).length;
        const gcContent = windowSeq.length > 0 ? (gcCount / windowSeq.length) * 100 : 0;
        const complexity = this._calculateSequenceComplexity(windowSeq);
        value = Math.max(0, gcContent * 0.5 + complexity * 20 + (100 - gcContent) * 0.3 + Math.random() * 10);
      } else {
        const baseValue = 30 + 20 * Math.sin(position / 100000) + 10 * Math.cos(position / 25000);
        value = Math.max(0, baseValue + (Math.random() - 0.5) * 15);
      }

      data.push({ position, value });
    }
    return data;
  }

  _calculateSequenceComplexity(sequence) {
    if (sequence.length === 0) return 0;
    const counts = {};
    for (let i = 0; i < sequence.length; i++) {
      const char = sequence[i].toUpperCase();
      counts[char] = (counts[char] || 0) + 1;
    }
    let entropy = 0;
    const total = sequence.length;
    for (const char in counts) {
      const p = counts[char] / total;
      if (p > 0) entropy -= p * Math.log2(p);
    }
    return entropy;
  }

  // ─── Plot Creation ──────────────────────────────────────

  createPlot() {
    this._createPlot();
  }

  _createPlot() {
    d3.select('#circosContainer').selectAll('*').remove();

    if (!this.data || !this.data.chromosomes || this.data.chromosomes.length === 0) {
      this.showNoDataMessage();
      return;
    }

    if (!this.multiTrackManager) {
      this.multiTrackManager = new MultiTrackGeneManager(this);
    }

    const theme = this.getCurrentTheme();

    if (this.renderingMode === 'canvas') {
      this.createCanvasPlot(theme);
    } else {
      this.createSVGPlot(theme);
    }
  }

  redrawPlot() {
    if (this.data) {
      this.dataProcessor.clearCache();
      this._debouncedRedraw();
    }
  }

  // ─── Canvas Rendering ───────────────────────────────────

  createCanvasPlot(theme) {
    d3.select('#circosContainer').select('#circos-canvas').remove();

    this.canvas = d3
      .select('#circosContainer')
      .append('canvas')
      .attr('id', 'circos-canvas')
      .attr('width', this.width)
      .attr('height', this.height)
      .style('background-color', theme.background)
      .style('cursor', 'grab')
      .node();

    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';

    this.calculateChromosomeAngles();
    this.drawCanvasPlot(theme);
    this.setupCanvasEventListeners();
  }

  drawCanvasPlot(theme) {
    this.ctx.clearRect(0, 0, this.width, this.height);
    const centerX = this.width / 2;
    const centerY = this.height / 2;

    const processedChromosomes = this.dataProcessor.processChromosomes(this.data.chromosomes, theme);
    const processedLinks = this.dataProcessor.processLinks(this.data.links, processedChromosomes, theme);

    this.drawCanvasChromosomes(processedChromosomes, centerX, centerY);

    if (this.showTicks) this.drawCanvasTicks(processedChromosomes, centerX, centerY);
    if (this.showLabels) this.drawCanvasLabels(processedChromosomes, centerX, centerY);

    if (this.showGenes && this.data.genes && this.data.genes.length > 0) {
      this.drawCanvasGenesMultiTrack(centerX, centerY, theme);
    }

    let trackOffset = this._getGeneTrackOffset();

    if (this.showGCContent) {
      const gcTrackData = this.dataProcessor.processDataTrack(processedChromosomes, 'gc_content', theme);
      this.drawCanvasDataTrack(gcTrackData, centerX, centerY, trackOffset);
      trackOffset += this.wigTrackHeight + 5;
    }

    if (this.showGCSkew) {
      const skewTrackData = this.dataProcessor.processDataTrack(processedChromosomes, 'gc_skew', theme);
      this.drawCanvasDataTrack(skewTrackData, centerX, centerY, trackOffset);
      trackOffset += this.wigTrackHeight + 5;
    }

    if (this.showWigData) {
      const wigTrackData = this.dataProcessor.processDataTrack(processedChromosomes, 'wig', theme);
      this.drawCanvasDataTrack(wigTrackData, centerX, centerY, trackOffset);
      trackOffset += this.wigTrackHeight + 5;
    }

    if (this.showLinks && this.data.links && this.data.links.length > 0) {
      this.drawCanvasLinks(processedLinks, centerX, centerY);
    }

    if (this.showLegend) this.drawLegend();

    let statusText = `Canvas: ${this.data.chromosomes.length} chromosomes`;
    if (this.data.genes) statusText += `, ${this.data.genes.length} genes`;
    if (this.data.links) statusText += `, ${this.data.links.length} links`;
    this.updateStatus(statusText);
  }

  drawCanvasChromosomes(processedChromosomes, centerX, centerY) {
    if (!processedChromosomes || !Array.isArray(processedChromosomes)) return;

    this.ctx.save();
    this.ctx.translate(centerX, centerY);
    this.ctx.rotate((this.startAngle * Math.PI) / 180);

    processedChromosomes.forEach(chr => {
      this.ctx.beginPath();
      this.ctx.arc(0, 0, chr.outerRadius, chr.startRadians, chr.endRadians);
      this.ctx.arc(0, 0, chr.innerRadius, chr.endRadians, chr.startRadians, true);
      this.ctx.closePath();
      this.ctx.fillStyle = chr.color;
      this.ctx.fill();
      this.ctx.strokeStyle = this.strokeColor;
      this.ctx.lineWidth = this.strokeWidth;
      this.ctx.stroke();
    });

    this.ctx.restore();
  }

  drawCanvasGenesMultiTrack(centerX, centerY, theme) {
    if (!this.multiTrackManager) return;

    this.ctx.save();
    this.ctx.translate(centerX, centerY);
    this.ctx.rotate((this.startAngle * Math.PI) / 180);

    this.multiTrackManager.renderCanvasGeneTracks(this.ctx, this.data.genes, this.innerRadius, theme);

    this.ctx.restore();
  }

  drawCanvasDataTrack(trackData, centerX, centerY, trackOffset) {
    if (!trackData || !trackData.data || !Array.isArray(trackData.data)) return;

    this.ctx.save();
    this.ctx.translate(centerX, centerY);
    this.ctx.rotate((this.startAngle * Math.PI) / 180);

    const trackRadius = this.innerRadius + this.chromosomeWidth + this.geneHeight + 10 + trackOffset;

    trackData.data.forEach(chrData => {
      const points = chrData.points;
      if (!points || points.length === 0) return;

      if (trackData.type === 'gc_content') {
        this.ctx.beginPath();
        this.ctx.moveTo(points[0].x * trackRadius, points[0].y * trackRadius);
        for (let i = 1; i < points.length; i++) {
          const height = this._calculateTrackHeight(points[i].value, trackData.type);
          const outerR = trackRadius + height;
          this.ctx.lineTo(points[i].x * outerR, points[i].y * outerR);
        }
        for (let i = points.length - 1; i >= 0; i--) {
          this.ctx.lineTo(points[i].x * trackRadius, points[i].y * trackRadius);
        }
        this.ctx.closePath();
        this.ctx.fillStyle = trackData.color;
        this.ctx.globalAlpha = 0.7;
        this.ctx.fill();
        this.ctx.globalAlpha = 1;
      } else {
        this.ctx.beginPath();
        this.ctx.moveTo(points[0].x * trackRadius, points[0].y * trackRadius);
        for (let i = 1; i < points.length; i++) {
          const height = this._calculateTrackHeight(points[i].value, trackData.type);
          const outerR = trackRadius + height;
          this.ctx.lineTo(points[i].x * outerR, points[i].y * outerR);
        }
        this.ctx.strokeStyle = trackData.color;
        this.ctx.lineWidth = 2;
        this.ctx.globalAlpha = 0.8;
        this.ctx.stroke();
        this.ctx.globalAlpha = 1;
      }
    });

    this.ctx.restore();
  }

  _calculateTrackHeight(value, trackType) {
    switch (trackType) {
      case 'gc_content': return (value / 100) * this.wigTrackHeight;
      case 'gc_skew': return ((value + 0.3) / 0.6) * this.wigTrackHeight;
      case 'wig': return Math.min(value / 100, 1) * this.wigTrackHeight;
      default: return (value / 100) * this.wigTrackHeight;
    }
  }

  drawCanvasLinks(processedLinks, centerX, centerY) {
    if (!processedLinks || !Array.isArray(processedLinks)) return;

    const theme = this.getCurrentTheme();

    this.ctx.save();
    this.ctx.translate(centerX, centerY);
    this.ctx.rotate((this.startAngle * Math.PI) / 180);

    const linkRadius = this.innerRadius - 20;

    this.data.links.forEach(link => {
      const sourceChr = this.data.chromosomes.find(c => c.name === link.source.chromosome);
      const targetChr = this.data.chromosomes.find(c => c.name === link.target.chromosome);
      if (!sourceChr || !targetChr) return;

      const sourceAngle = sourceChr.startAngle + (link.source.start / sourceChr.length) * (sourceChr.endAngle - sourceChr.startAngle);
      const targetAngle = targetChr.startAngle + (link.target.start / targetChr.length) * (targetChr.endAngle - targetChr.startAngle);

      const sourceRadians = (sourceAngle * Math.PI) / 180;
      const targetRadians = (targetAngle * Math.PI) / 180;

      const sourceX = Math.cos(sourceRadians) * linkRadius;
      const sourceY = Math.sin(sourceRadians) * linkRadius;
      const targetX = Math.cos(targetRadians) * linkRadius;
      const targetY = Math.sin(targetRadians) * linkRadius;

      let linkColor, strokeWidth, dashPattern = [];
      if (link.value >= 0.7) {
        linkColor = theme.links.strong;
        strokeWidth = Math.max(3, link.value * 5);
      } else if (link.value >= 0.4) {
        linkColor = theme.links.medium;
        strokeWidth = Math.max(2, link.value * 4);
        dashPattern = [5, 2];
      } else {
        linkColor = theme.links.weak;
        strokeWidth = Math.max(1, link.value * 3);
        dashPattern = [3, 3];
      }

      this.ctx.beginPath();
      this.ctx.moveTo(sourceX, sourceY);
      this.ctx.quadraticCurveTo(0, 0, targetX, targetY);
      this.ctx.lineWidth = strokeWidth;
      this.ctx.strokeStyle = linkColor;
      this.ctx.globalAlpha = this.linkOpacity;
      this.ctx.setLineDash(dashPattern);
      this.ctx.stroke();
      this.ctx.globalAlpha = 1;
      this.ctx.setLineDash([]);
    });

    this.ctx.restore();
  }

  drawCanvasLabels(processedChromosomes, centerX, centerY) {
    if (!processedChromosomes || !Array.isArray(processedChromosomes)) return;

    const theme = this.getCurrentTheme();

    this.ctx.save();
    this.ctx.translate(centerX, centerY);
    this.ctx.rotate((this.startAngle * Math.PI) / 180);

    this.ctx.fillStyle = theme.text;
    this.ctx.font = '500 12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    processedChromosomes.forEach(chr => {
      const x = Math.cos(chr.midRadians) * chr.labelRadius;
      const y = Math.sin(chr.midRadians) * chr.labelRadius;
      const angleDeg = chr.midAngle;
      const needFlip = angleDeg > 90 && angleDeg < 270;
      const rotationDeg = needFlip ? angleDeg + 180 : angleDeg;

      this.ctx.save();
      this.ctx.translate(x, y);
      this.ctx.rotate((rotationDeg * Math.PI) / 180);
      this.ctx.fillText(chr.name || chr.label || chr.id || 'Unknown', 0, 0);
      this.ctx.restore();
    });

    this.ctx.restore();
  }

  drawCanvasTicks(processedChromosomes, centerX, centerY) {
    if (!processedChromosomes || !Array.isArray(processedChromosomes)) return;

    const theme = this.getCurrentTheme();
    const tickInterval = 50000000;

    this.ctx.save();
    this.ctx.translate(centerX, centerY);
    this.ctx.rotate((this.startAngle * Math.PI) / 180);

    this.data.chromosomes.forEach(chr => {
      const numTicks = Math.floor(chr.length / tickInterval);
      for (let i = 0; i <= numTicks; i++) {
        const position = i * tickInterval;
        const angle = chr.startAngle + (position / chr.length) * (chr.endAngle - chr.startAngle);
        const radians = (angle * Math.PI) / 180;

        const x1 = Math.cos(radians) * this.innerRadius;
        const y1 = Math.sin(radians) * this.innerRadius;
        const x2 = Math.cos(radians) * (this.innerRadius - 5);
        const y2 = Math.sin(radians) * (this.innerRadius - 5);

        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.strokeStyle = theme.ticks;
        this.ctx.lineWidth = 1;
        this.ctx.stroke();

        if (i % 2 === 0) {
          const labelRadius = this.innerRadius - 15;
          this.ctx.fillStyle = theme.text;
          this.ctx.font = '10px Arial';
          this.ctx.textAlign = 'center';
          this.ctx.textBaseline = 'middle';
          this.ctx.fillText(
            `${(position / 1000000).toFixed(0)}M`,
            Math.cos(radians) * labelRadius,
            Math.sin(radians) * labelRadius
          );
        }
      }
    });

    this.ctx.restore();
  }

  setupCanvasEventListeners() {
    if (!this.canvas) return;

    let isDragging = false;
    let lastX = 0;
    let lastY = 0;

    this.canvas.addEventListener('mousedown', e => {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      this.canvas.style.cursor = 'grabbing';
    });

    this.canvas.addEventListener('mousemove', e => {
      if (isDragging) {
        const deltaX = e.clientX - lastX;
        const deltaY = e.clientY - lastY;
        this.ctx.translate(deltaX, deltaY);
        this.drawCanvasPlot(this.getCurrentTheme());
        lastX = e.clientX;
        lastY = e.clientY;
      }
    });

    this.canvas.addEventListener('mouseup', () => {
      isDragging = false;
      this.canvas.style.cursor = 'grab';
    });

    this.canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const scale = e.deltaY > 0 ? 0.9 : 1.1;
      this.ctx.scale(scale, scale);
      this.drawCanvasPlot(this.getCurrentTheme());
    }, { passive: false });
  }

  // ─── SVG Rendering ──────────────────────────────────────

  createSVGPlot(theme) {
    this.svg = d3
      .select('#circosContainer')
      .append('svg')
      .attr('id', 'circos-svg')
      .attr('width', this.width)
      .attr('height', this.height)
      .style('background-color', theme.background)
      .call(this.zoom);

    const g = this.svg
      .append('g')
      .attr('transform', `translate(${this.width / 2}, ${this.height / 2}) rotate(${this.startAngle})`);

    this.calculateChromosomeAngles();

    const processedChromosomes = this.dataProcessor.processChromosomes(this.data.chromosomes, theme);
    const processedLinks = this.dataProcessor.processLinks(this.data.links, processedChromosomes, theme);

    this.drawChromosomes(g, processedChromosomes);

    if (this.showTicks) this.drawTicks(g);
    if (this.showLabels) this.drawLabels(g);

    if (this.showGenes && this.data.genes && this.data.genes.length > 0) {
      this.drawGenesTrack(g);
    }

    let trackOffset = this._getGeneTrackOffset();

    if (this.showGCContent) {
      const gcTrackData = this.dataProcessor.processDataTrack(processedChromosomes, 'gc_content', theme);
      this.drawDataTrackSVG(g, gcTrackData, trackOffset);
      trackOffset += this.wigTrackHeight + 5;
    }

    if (this.showGCSkew) {
      const skewTrackData = this.dataProcessor.processDataTrack(processedChromosomes, 'gc_skew', theme);
      this.drawDataTrackSVG(g, skewTrackData, trackOffset);
      trackOffset += this.wigTrackHeight + 5;
    }

    if (this.showWigData) {
      const wigTrackData = this.dataProcessor.processDataTrack(processedChromosomes, 'wig', theme);
      this.drawDataTrackSVG(g, wigTrackData, trackOffset);
      trackOffset += this.wigTrackHeight + 5;
    }

    if (this.showLinks && this.data.links && this.data.links.length > 0) {
      this.drawLinks(g);
    }

    if (this.showLegend) this.drawLegend();

    let statusText = `Plotted ${this.data.chromosomes.length} chromosomes`;
    if (this.data.genes) statusText += `, ${this.data.genes.length} genes`;
    if (this.data.links) statusText += `, ${this.data.links.length} links`;
    this.updateStatus(statusText);
  }

  _getGeneTrackOffset() {
    let trackOffset = 0;
    if (this.multiTrackManager) {
      const enabledTracks = Object.values(this.multiTrackManager.geneTracks).filter(track => track.enabled);
      const maxTrackNumber = Math.max(...enabledTracks.map(track => track.track), -1);
      trackOffset = (maxTrackNumber + 1) * (this.geneHeight + 2) + 10;

      if (this.multiTrackManager.geneTracks.protein_coding.enabled) {
        const cdsGenes = this.multiTrackManager.groupGenesByType(this.data.genes).protein_coding || [];
      }
    }
    return trackOffset;
  }

  calculateChromosomeAngles() {
    const totalLength = this.data.chromosomes.reduce((sum, chr) => sum + (chr.length || chr.size || 0), 0);
    if (totalLength <= 0) return;

    this.innerRadius = this.radius * this.innerRadiusRatio;
    const totalGaps = this.data.chromosomes.length * this.chromosomeGap;
    const availableAngle = 360 - totalGaps;

    let currentAngle = 0;
    this.data.chromosomes.forEach((chr, index) => {
      const length = chr.length || chr.size || 0;

      if (length <= 0) {
        chr.startAngle = currentAngle;
        chr.endAngle = currentAngle + 1;
        chr.midAngle = currentAngle + 0.5;
        currentAngle += 1 + this.chromosomeGap;
        return;
      }

      chr.startAngle = currentAngle;
      chr.endAngle = currentAngle + (length / totalLength) * availableAngle;
      chr.midAngle = (chr.startAngle + chr.endAngle) / 2;
      currentAngle = chr.endAngle + this.chromosomeGap;

      if (isNaN(chr.startAngle) || isNaN(chr.endAngle) || isNaN(chr.midAngle)) {
        chr.startAngle = currentAngle;
        chr.endAngle = currentAngle + 1;
        chr.midAngle = currentAngle + 0.5;
        currentAngle += 1 + this.chromosomeGap;
      }
    });
  }

  drawChromosomes(g, processedChromosomes) {
    if (!processedChromosomes || !Array.isArray(processedChromosomes)) return;

    const arc = d3
      .arc()
      .innerRadius(d => d.innerRadius)
      .outerRadius(d => d.outerRadius)
      .startAngle(d => d.startRadians)
      .endAngle(d => d.endRadians);

    g.selectAll('.chromosome-arc')
      .data(processedChromosomes)
      .enter()
      .append('path')
      .attr('class', 'chromosome-arc')
      .attr('d', arc)
      .attr('fill', d => d.color)
      .attr('stroke', this.strokeColor)
      .attr('stroke-width', this.strokeWidth)
      .style('cursor', 'pointer')
      .on('mouseover', (event, d) => {
        const length = d.length || 0;
        const label = d.name || d.label || d.id || 'Unknown';
        this.showTooltip(event, `${label}<br/>Length: ${length.toLocaleString()} bp<br/>Coverage: ${(((d.endAngle - d.startAngle) / 360) * 100).toFixed(1)}%`);
      })
      .on('mouseout', () => this.hideTooltip())
      .on('click', (event, d) => {
        const length = d.length || 0;
        const label = d.name || d.label || d.id || 'Unknown';
        this.updateStatus(`Selected: ${label} (${(length / 1000000).toFixed(1)} Mb)`);
        this.navigateToChromosome(label);
      });
  }

  drawTicks(g) {
    const theme = this.getCurrentTheme();
    const tickInterval = 50000000;

    this.data.chromosomes.forEach(chr => {
      const numTicks = Math.floor(chr.length / tickInterval);
      for (let i = 0; i <= numTicks; i++) {
        const position = i * tickInterval;
        const angle = chr.startAngle + (position / chr.length) * (chr.endAngle - chr.startAngle);
        const radians = (angle * Math.PI) / 180;

        const x1 = Math.cos(radians) * this.innerRadius;
        const y1 = Math.sin(radians) * this.innerRadius;
        const x2 = Math.cos(radians) * (this.innerRadius - 5);
        const y2 = Math.sin(radians) * (this.innerRadius - 5);

        g.append('line')
          .attr('class', 'tick')
          .attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2)
          .attr('stroke', theme.ticks).attr('stroke-width', 1);

        if (i % 2 === 0) {
          const labelRadius = this.innerRadius - 15;
          g.append('text')
            .attr('class', 'tick-label')
            .attr('x', Math.cos(radians) * labelRadius)
            .attr('y', Math.sin(radians) * labelRadius)
            .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
            .attr('fill', theme.text).attr('font-size', '10px')
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
        const radians = (angle * Math.PI) / 180;
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
        this.updateStatus(`Chromosome ${d.name}: ${(d.length / 1000000).toFixed(1)} Mb, ${(((d.endAngle - d.startAngle) / 360) * 100).toFixed(1)}% coverage`);
      });
  }

  drawGenesTrack(g) {
    if (!this.data.genes) return;
    const theme = this.getCurrentTheme();
    const baseRadius = this.innerRadius + this.chromosomeWidth + 5;

    if (!this.multiTrackManager) {
      this.multiTrackManager = new MultiTrackGeneManager(this);
    }

    this.multiTrackManager.renderGeneTracks(g, this.data.genes, baseRadius, theme);
  }

  drawDataTrackSVG(g, trackData, trackOffset) {
    const trackRadius = this.innerRadius + this.chromosomeWidth + this.geneHeight + 10 + trackOffset;
    const trackHeight = trackData.height || this.wigTrackHeight;

    const trackGroup = g.append('g').attr('class', `track ${trackData.type}-track`);

    trackData.data.forEach(chrData => {
      const chr = chrData.chromosome;
      const points = chrData.points;
      if (!points || points.length === 0) return;

      const line = d3.line()
        .x(d => d.x * trackRadius)
        .y(d => d.y * trackRadius)
        .curve(d3.curveLinear);

      const area = d3.area()
        .x(d => d.x * trackRadius)
        .y0(d => d.y * trackRadius)
        .y1(d => d.y * (trackRadius + trackHeight))
        .curve(d3.curveLinear);

      if (trackData.type === 'gc_content') {
        trackGroup.append('path').attr('d', area(points)).attr('fill', trackData.color).attr('opacity', 0.7);
      } else {
        trackGroup.append('path')
          .attr('d', line(points))
          .attr('fill', 'none').attr('stroke', trackData.color)
          .attr('stroke-width', 2).attr('opacity', 0.8);
      }
    });
  }

  drawLinks(g) {
    if (!this.data.links) return;

    const theme = this.getCurrentTheme();
    const linkGroup = g.append('g').attr('class', 'links');

    this.data.links.forEach(link => {
      const sourceChr = this.data.chromosomes.find(c => c.name === link.source.chromosome);
      const targetChr = this.data.chromosomes.find(c => c.name === link.target.chromosome);
      if (!sourceChr || !targetChr) return;

      const sourceAngle = sourceChr.startAngle + (link.source.start / sourceChr.length) * (sourceChr.endAngle - sourceChr.startAngle);
      const targetAngle = targetChr.startAngle + (link.target.start / targetChr.length) * (targetChr.endAngle - targetChr.startAngle);

      const sourceRadians = (sourceAngle * Math.PI) / 180;
      const targetRadians = (targetAngle * Math.PI) / 180;

      const linkRadius = this.innerRadius - 20;
      const sourceX = Math.cos(sourceRadians) * linkRadius;
      const sourceY = Math.sin(sourceRadians) * linkRadius;
      const targetX = Math.cos(targetRadians) * linkRadius;
      const targetY = Math.sin(targetRadians) * linkRadius;

      const path = d3.path();
      path.moveTo(sourceX, sourceY);
      path.quadraticCurveTo(0, 0, targetX, targetY);

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

      if (link.value >= 0.8) {
        const gradientId = `linkGradient${Math.random().toString(36).substr(2, 9)}`;
        const gradient = g.append('defs')
          .append('linearGradient')
          .attr('id', gradientId)
          .attr('gradientUnits', 'userSpaceOnUse')
          .attr('x1', sourceX).attr('y1', sourceY)
          .attr('x2', targetX).attr('y2', targetY);

        gradient.append('stop').attr('offset', '0%').attr('stop-color', theme.links.gradient[0]);
        gradient.append('stop').attr('offset', '100%').attr('stop-color', theme.links.gradient[1]);

        linkColor = `url(#${gradientId})`;
        strokeDasharray = 'none';
      }

      linkGroup
        .append('path')
        .attr('d', path.toString())
        .attr('class', 'link')
        .attr('stroke', linkColor)
        .attr('stroke-width', strokeWidth)
        .attr('stroke-dasharray', strokeDasharray)
        .attr('fill', 'none')
        .attr('opacity', this.linkOpacity)
        .style('cursor', 'pointer')
        .on('mouseover', event => {
          const strengthLabel = link.value >= 0.7 ? 'Strong' : link.value >= 0.4 ? 'Medium' : 'Weak';
          this.showTooltip(event, `<strong>Genomic Link</strong><br/>${link.source.chromosome} → ${link.target.chromosome}<br/>Strength: ${strengthLabel} (${(link.value * 100).toFixed(1)}%)<br/>Type: ${link.type || 'Synteny'}`);
        })
        .on('mouseout', () => this.hideTooltip());
    });
  }

  drawLegend() {
    d3.select('#legend-container').remove();

    const theme = this.getCurrentTheme();
    const container = d3.select('#circosContainer');

    let positionStyles = {};
    switch (this.legendPosition) {
      case 'top-left': positionStyles = { top: '20px', left: '20px' }; break;
      case 'bottom-left': positionStyles = { bottom: '20px', left: '20px' }; break;
      case 'bottom-right': positionStyles = { bottom: '20px', right: '20px' }; break;
      default: positionStyles = { top: '20px', right: '20px' };
    }

    const legendContainer = container
      .append('div')
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

    // Title
    legendContainer.append('div')
      .style('font-weight', 'bold').style('font-size', '14px')
      .style('margin-bottom', '12px').text(`${theme.name} Theme`);

    legendContainer.append('div')
      .style('font-size', '11px').style('opacity', '0.8')
      .style('margin-bottom', '16px').style('line-height', '1.4')
      .text(theme.description);

    // Chromosomes
    const chromSection = legendContainer.append('div').style('margin-bottom', '16px');
    chromSection.append('div').style('font-weight', '600').style('margin-bottom', '8px').text('Chromosomes');

    const chromGrid = chromSection.append('div')
      .style('display', 'grid').style('grid-template-columns', 'repeat(6, 1fr)').style('gap', '4px');

    theme.chromosomes.slice(0, 12).forEach((color, i) => {
      chromGrid.append('div')
        .style('width', '16px').style('height', '16px')
        .style('background-color', color).style('border-radius', '2px')
        .style('border', `1px solid ${theme.legend.border}`)
        .attr('title', `Chromosome ${i + 1}`);
    });

    // Genes
    if (this.showGenes && this.data.genes) {
      const geneSection = legendContainer.append('div').style('margin-bottom', '16px');
      geneSection.append('div').style('font-weight', '600').style('margin-bottom', '8px').text('Gene Types');

      const geneTypes = [
        { type: 'protein_coding', label: 'Protein Coding', color: theme.genes.protein_coding },
        { type: 'non_coding', label: 'Non-coding RNA', color: theme.genes.non_coding },
        { type: 'regulatory', label: 'Regulatory', color: theme.genes.regulatory },
        { type: 'pseudogene', label: 'Pseudogene', color: theme.genes.pseudogene },
      ];

      geneTypes.forEach(gene => {
        const geneItem = geneSection.append('div')
          .style('display', 'flex').style('align-items', 'center').style('margin-bottom', '4px');
        geneItem.append('div')
          .style('width', '12px').style('height', '12px')
          .style('background-color', gene.color).style('border-radius', '2px')
          .style('margin-right', '8px').style('border', `1px solid ${theme.legend.border}`);
        geneItem.append('span').style('font-size', '11px').text(gene.label);
      });
    }

    // Expression levels
    if (this.showGenes) {
      const exprSection = legendContainer.append('div').style('margin-bottom', '16px');
      exprSection.append('div').style('font-weight', '600').style('margin-bottom', '8px').text('Expression Levels');

      [
        { level: 'High (>70%)', color: theme.tracks.expression_high, height: '16px' },
        { level: 'Medium (40-70%)', color: theme.tracks.expression_medium, height: '12px' },
        { level: 'Low (<40%)', color: theme.tracks.expression_low, height: '8px' },
      ].forEach(expr => {
        const exprItem = exprSection.append('div')
          .style('display', 'flex').style('align-items', 'center').style('margin-bottom', '4px');
        exprItem.append('div')
          .style('width', '20px').style('height', expr.height)
          .style('background-color', expr.color).style('border-radius', '2px')
          .style('margin-right', '8px').style('border', `1px solid ${theme.legend.border}`);
        exprItem.append('span').style('font-size', '11px').text(expr.level);
      });
    }

    // Links
    if (this.showLinks && this.data.links) {
      const linkSection = legendContainer.append('div').style('margin-bottom', '16px');
      linkSection.append('div').style('font-weight', '600').style('margin-bottom', '8px').text('Link Strength');

      [
        { type: 'Strong (≥70%)', color: theme.links.strong, width: '3px', dash: 'none' },
        { type: 'Medium (40-70%)', color: theme.links.medium, width: '2px', dash: '5,2' },
        { type: 'Weak (<40%)', color: theme.links.weak, width: '1px', dash: '3,3' },
      ].forEach(link => {
        const linkItem = linkSection.append('div')
          .style('display', 'flex').style('align-items', 'center').style('margin-bottom', '6px');
        const linkSvg = linkItem.append('svg').attr('width', '24').attr('height', '8').style('margin-right', '8px');
        linkSvg.append('line')
          .attr('x1', '2').attr('y1', '4').attr('x2', '22').attr('y2', '4')
          .attr('stroke', link.color).attr('stroke-width', link.width).attr('stroke-dasharray', link.dash);
        linkItem.append('span').style('font-size', '11px').text(link.type);
      });
    }

    // Data tracks
    if (this.showGCContent || this.showGCSkew || this.showWigData) {
      const trackSection = legendContainer.append('div').style('margin-bottom', '16px');
      trackSection.append('div').style('font-weight', '600').style('margin-bottom', '8px').text('Data Tracks');

      const tracks = [];
      if (this.showGCContent) tracks.push({ name: 'GC Content', color: theme.tracks.gc_content });
      if (this.showGCSkew) tracks.push({ name: 'GC Skew', color: theme.tracks.gc_skew });
      if (this.showWigData) tracks.push({ name: 'Expression Data', color: theme.tracks.wig_data });

      tracks.forEach(track => {
        const trackItem = trackSection.append('div')
          .style('display', 'flex').style('align-items', 'center').style('margin-bottom', '4px');
        trackItem.append('div')
          .style('width', '16px').style('height', '3px')
          .style('background-color', track.color).style('margin-right', '8px').style('border-radius', '1px');
        trackItem.append('span').style('font-size', '11px').text(track.name);
      });
    }

    // Scale info
    const scaleSection = legendContainer.append('div')
      .style('border-top', `1px solid ${theme.legend.border}`)
      .style('padding-top', '12px').style('margin-top', '16px');

    scaleSection.append('div').style('font-weight', '600').style('margin-bottom', '8px').text('Scale Information');

    const totalLength = this.data.chromosomes.reduce((sum, chr) => sum + chr.length, 0);
    const avgLength = totalLength / this.data.chromosomes.length;

    scaleSection.append('div').style('font-size', '11px').style('margin-bottom', '4px')
      .text(`Total genome: ${(totalLength / 1e9).toFixed(2)} Gb`);
    scaleSection.append('div').style('font-size', '11px').style('margin-bottom', '4px')
      .text(`Avg chromosome: ${(avgLength / 1e6).toFixed(1)} Mb`);
    scaleSection.append('div').style('font-size', '11px').style('opacity', '0.7')
      .text(`Window size: ${(this.gcWindowSize / 1000).toFixed(0)} kb`);
  }

  // ─── Tooltip ────────────────────────────────────────────

  showTooltip(event, content) {
    this.tooltip
      .style('opacity', 1)
      .html(content)
      .style('left', event.pageX + 10 + 'px')
      .style('top', event.pageY - 10 + 'px');
  }

  hideTooltip() {
    this.tooltip.style('opacity', 0);
  }

  // ─── Export ─────────────────────────────────────────────

  exportSVG() {
    const svgElement = document.getElementById('circos-svg');
    if (!svgElement) return;

    const svgClone = svgElement.cloneNode(true);
    const styleElement = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleElement.textContent = `
      .chromosome-arc { cursor: pointer; }
      .chromosome-label { font-size: 12px; font-weight: 600; text-anchor: middle; cursor: pointer; }
      .tick { stroke: #666; stroke-width: 1; }
      .tick-label { font-size: 10px; fill: #666; text-anchor: middle; }
      .link { fill: none; stroke-width: 2; opacity: 0.6; }
    `;
    svgClone.insertBefore(styleElement, svgClone.firstChild);

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

  exportPNG() {
    const svgElement = document.getElementById('circos-svg');
    if (!svgElement) {
      this.updateStatus('Error: No plot to export');
      return;
    }

    const resolution = parseInt(document.getElementById('exportResolutionSelect')?.value || '2');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = this.width * resolution;
    canvas.height = this.height * resolution;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = this.backgroundColor || '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(blob => {
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `circos-plot-${new Date().toISOString().slice(0, 10)}-${resolution}x.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
        URL.revokeObjectURL(url);
        this.updateStatus(`PNG exported at ${resolution}x resolution`);
      });
    };

    img.onerror = () => {
      this.updateStatus('Error: Failed to export PNG');
      URL.revokeObjectURL(url);
    };

    img.src = url;
  }

  exportData() {
    if (!this.data) {
      this.updateStatus('No data to export');
      return;
    }

    const exportPayload = {
      metadata: {
        title: this.data.title || 'Circos Plot Data',
        timestamp: new Date().toISOString(),
        version: '1.0',
        parameters: {
          radius: this.radius, innerRadiusRatio: this.innerRadiusRatio,
          chromosomeWidth: this.chromosomeWidth, geneHeight: this.geneHeight,
          theme: this.currentTheme,
        },
      },
      chromosomes: this.data.chromosomes,
      genes: this.data.genes || [],
      links: this.data.links || [],
    };

    const jsonData = JSON.stringify(exportPayload, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `circos-data-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.updateStatus('Data exported successfully');
  }

  exportPDF() {
    this.updateStatus('PDF export not yet implemented');
  }

  // ─── File Loading ───────────────────────────────────────

  loadDataFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.tsv,.txt,.json';
    input.onchange = e => {
      const file = e.target.files[0];
      if (file) this.parseDataFile(file);
    };
    input.click();
  }

  parseDataFile(file) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const content = e.target.result;

        const fileNameLower = file.name.toLowerCase();
        
        if (fileNameLower.endsWith('.gbk') || fileNameLower.endsWith('.gb') || fileNameLower.endsWith('.fasta') || fileNameLower.endsWith('.fa')) {
          throw new Error('Please load genome files (.gbk/.fasta) in the main window and click "Load Current Genome".');
        }

        if (fileNameLower.endsWith('.json')) {
          this.data = JSON.parse(content);
        } else if (fileNameLower.endsWith('.csv') || fileNameLower.endsWith('.tsv') || fileNameLower.endsWith('.txt')) {
          const parsed = Papa.parse(content, { header: true });
          if (parsed.errors.length > 0 && parsed.data.length === 0) {
            throw new Error('Invalid CSV/TSV format.');
          }
          this.convertCSVToCircosData(parsed.data);
        } else {
          throw new Error('Unsupported file format. Please load a .csv, .tsv, .txt, or .json file.');
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
    this.data = { chromosomes: [], genes: [], links: [] };

    const chrMap = new Map();
    csvData.forEach(row => {
      if (row.chromosome) {
        chrMap.set(row.chromosome, Math.max(chrMap.get(row.chromosome) || 0, parseInt(row.end) || 0));
      }
    });

    chrMap.forEach((length, name) => {
      this.data.chromosomes.push({ name, length });
    });

    this.data.genes = csvData.filter(row => row.chromosome && row.start && row.end);
    this.data.metadata = {
      totalChromosomes: this.data.chromosomes.length,
      totalGenes: this.data.genes.length,
      totalLength: this.data.chromosomes.reduce((s, c) => s + (c.length || 0), 0),
    };
  }

  updateUISliders() {
    const updates = {
      radiusSlider: this.radius,
      innerRadiusSlider: this.innerRadiusRatio,
      chrWidthSlider: this.chromosomeWidth,
      geneHeightSlider: this.geneHeight,
    };

    Object.entries(updates).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.value = value;
    });

    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) themeSelect.value = this.currentTheme;

    const renderingModeSelect = document.getElementById('renderingModeSelect');
    if (renderingModeSelect) renderingModeSelect.value = this.renderingMode;

    this.updateParameterDisplays();
  }

  showOptimizationSuggestions(suggestions) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed; top: 20px; right: 20px; background: #10b981; color: white;
      padding: 16px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000; max-width: 300px; font-size: 14px;
    `;
    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <i class="fas fa-robot" style="font-size: 16px;"></i>
        <strong>AI Optimization Applied</strong>
      </div>
      <ul style="margin: 0; padding-left: 16px;">
        ${suggestions.map(s => `<li>${s}</li>`).join('')}
      </ul>
    `;

    document.body.appendChild(notification);
    setTimeout(() => { if (notification.parentNode) notification.parentNode.removeChild(notification); }, 5000);
  }

  // ─── Performance ────────────────────────────────────────

  enablePerformanceMode() {
    this.performanceMode = true;
    this.animationDuration = 0;
    this.updateStatus('Performance mode enabled');
  }

  disablePerformanceMode() {
    this.performanceMode = false;
    this.animationDuration = 750;
    this.updateStatus('Performance mode disabled');
  }

  optimizeForLargeDataset() {
    if (!this.data || !this.data.genes) return false;

    const geneCount = this.data.genes.length;
    if (geneCount > this.largeDatasetThreshold) {
      this.enablePerformanceMode();
      this.chromosomeWidth = Math.max(8, this.chromosomeWidth - 2);
      this.geneHeight = Math.max(4, this.geneHeight - 2);
      this.updateStatus(`Optimized for large dataset (${geneCount} genes)`);
      return true;
    }
    return false;
  }

  // ─── Navigation ─────────────────────────────────────────

  async navigateToChromosome(chromosomeName) {
    try {
      if (typeof require !== 'undefined' && require('electron')) {
        const { ipcRenderer } = require('electron');
        await ipcRenderer.invoke('navigate-to-chromosome', chromosomeName);
        this.updateStatus(`Navigated to ${chromosomeName} in main window`);
      }
    } catch (error) {
      // Silently fail in standalone mode
    }
  }

  async navigateToGene(gene) {
    try {
      if (typeof require !== 'undefined' && require('electron')) {
        const { ipcRenderer } = require('electron');
        await ipcRenderer.invoke('navigate-to-gene', {
          chromosome: gene.chromosome, start: gene.start,
          end: gene.end, name: gene.name || gene.id,
        });
        this.updateStatus(`Navigated to gene ${gene.name || gene.id} in main window`);
      }
    } catch (error) {
      // Silently fail in standalone mode
    }
  }

  // ─── Reset / Help / Toggle ──────────────────────────────

  resetPlot() {
    this.radius = 300;
    this.innerRadiusRatio = 0.8;
    this.innerRadius = this.radius * this.innerRadiusRatio;
    this.chromosomeWidth = 15;
    this.chromosomeGap = 2;
    this.startAngle = -90;
    this.showLabels = true;
    this.showTicks = false;
    this.showGenes = true;
    this.showLinks = true;
    this.linkOpacity = 0.6;
    this.geneHeight = 8;
    this.strokeWidth = 1;
    this.labelDistance = 20;
    this.currentTheme = 'scientific';
    this.applyTheme('scientific');

    const controls = {
      radiusSlider: 300, innerRadiusSlider: 0.8, startAngleSlider: -90,
      chrWidthSlider: 15, gapSlider: 2, labelDistanceSlider: 20,
      strokeWidthSlider: 1, geneHeightSlider: 8, linkOpacitySlider: 0.6,
      
      showLabelsCheck: true, showTicksCheck: false, showGenesCheck: true,
      showLinksCheck: true, showGCContentCheck: false, showGCSkewCheck: false,
      showWigDataCheck: false, gcWindowSlider: 10000, wigHeightSlider: 30,
      themeSelect: 'scientific', chromosomeOrderSelect: 'default',
      exportResolutionSelect: '1', showLegendCheck: true,
      legendPositionSelect: 'top-right', legendOpacitySlider: '0.95',
    };

    Object.entries(controls).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        if (element.type === 'checkbox') element.checked = value;
        else element.value = value;
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

  toggleGenes() {
    this.showGenes = !this.showGenes;
    this.createPlot();
    this.updateStatus(`Genes ${this.showGenes ? 'shown' : 'hidden'}`);
  }

  toggleGCContent() {
    this.showGCContent = !this.showGCContent;
    this.createPlot();
    this.updateStatus(`GC Content ${this.showGCContent ? 'shown' : 'hidden'}`);
  }

  toggleGCSkew() {
    this.showGCSkew = !this.showGCSkew;
    this.createPlot();
    this.updateStatus(`GC Skew ${this.showGCSkew ? 'shown' : 'hidden'}`);
  }

  toggleWigData() {
    this.showWigData = !this.showWigData;
    this.createPlot();
    this.updateStatus(`WIG Data ${this.showWigData ? 'shown' : 'hidden'}`);
  }

  refresh() {
    this.createPlot();
    this.updateStatus('Plot refreshed');
  }
}

/**
 * Unified Data Processor for Circos Plotter
 * Provides consistent data interface for both Canvas and SVG rendering modes
 */
class CircosDataProcessor {
  constructor(plotter) {
    this.plotter = plotter;
    this.cache = new Map();
  }

  processChromosomes(chromosomes, theme) {
    const cacheKey = `chr_${chromosomes?.length || 0}_${theme.name}_${this.plotter.innerRadius}_${this.plotter.chromosomeWidth}_${this.plotter.labelDistance}`;

    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

    if (!chromosomes || !Array.isArray(chromosomes)) return [];

    const processed = chromosomes.map((chr, index) => {
      const startAngle = chr.startAngle || 0;
      const endAngle = chr.endAngle || 0;
      const length = chr.length || chr.size || 0;

      return {
        ...chr,
        index,
        startAngle, endAngle, length,
        midAngle: (startAngle + endAngle) / 2,
        color: chr.color || theme.chromosomes[index % theme.chromosomes.length],
        startRadians: (startAngle * Math.PI) / 180,
        endRadians: (endAngle * Math.PI) / 180,
        midRadians: (((startAngle + endAngle) / 2) * Math.PI) / 180,
        innerRadius: this.plotter.innerRadius,
        outerRadius: this.plotter.innerRadius + this.plotter.chromosomeWidth,
        labelRadius: this.plotter.innerRadius + this.plotter.chromosomeWidth + this.plotter.labelDistance,
      };
    });

    this.cache.set(cacheKey, processed);
    return processed;
  }

  processGenes(genes, processedChromosomes, theme) {
    const cacheKey = `genes_${genes?.length || 0}_${processedChromosomes?.length || 0}_${theme.name}_${this.plotter.innerRadius}_${this.plotter.geneHeight}`;

    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

    if (!genes || !Array.isArray(genes)) return [];

    const processed = genes
      .map(gene => {
        const chr = processedChromosomes.find(
          c => c.name === gene.chromosome || c.label === gene.chromosome || c.id === gene.chromosome
        );
        if (!chr) return null;

        const chrLength = chr.length || 1;
        const geneStartAngle = chr.startAngle + (gene.start / chrLength) * (chr.endAngle - chr.startAngle);
        const geneEndAngle = chr.startAngle + (gene.end / chrLength) * (chr.endAngle - chr.startAngle);

        return {
          ...gene,
          chromosome: chr,
          startAngle: geneStartAngle, endAngle: geneEndAngle,
          midAngle: (geneStartAngle + geneEndAngle) / 2,
          startRadians: (geneStartAngle * Math.PI) / 180,
          endRadians: (geneEndAngle * Math.PI) / 180,
          midRadians: (((geneStartAngle + geneEndAngle) / 2) * Math.PI) / 180,
          innerRadius: chr.innerRadius + this.plotter.chromosomeWidth + 5,
          outerRadius: chr.innerRadius + this.plotter.chromosomeWidth + 5 + this.plotter.geneHeight,
          color: this.plotter.getGeneColor(gene, theme),
          length: gene.end - gene.start,
        };
      })
      .filter(gene => gene !== null);

    this.cache.set(cacheKey, processed);
    return processed;
  }

  processDataTrack(processedChromosomes, trackType, theme) {
    const cacheKey = `track_${trackType}_${processedChromosomes?.length || 0}_${theme.name}_${this.plotter.innerRadius}_${this.plotter.wigTrackHeight}_${this.plotter.gcWindowSize}`;

    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

    const trackData = {
      type: trackType,
      color: this.plotter.getTrackColor(trackType, theme),
      height: this.plotter.wigTrackHeight,
      data: [],
    };

    processedChromosomes.forEach(chr => {
      let data = [];

      switch (trackType) {
        case 'gc_content': data = this.plotter.generateRealGCData(chr); break;
        case 'gc_skew': data = this.plotter.generateRealGCSkew(chr); break;
        case 'wig': data = this.plotter.generateRealWigData(chr); break;
      }

      const processedData = data.map(d => {
        const angle = chr.startAngle + (d.position / chr.length) * (chr.endAngle - chr.startAngle);
        const radians = (angle * Math.PI) / 180;

        return {
          ...d,
          angle, radians,
          x: Math.cos(radians),
          y: Math.sin(radians),
          value: d.value || 0,
        };
      });

      trackData.data.push({ chromosome: chr, points: processedData });
    });

    this.cache.set(cacheKey, trackData);
    return trackData;
  }

  processLinks(links, processedChromosomes, theme) {
    const cacheKey = `links_${links?.length || 0}_${processedChromosomes?.length || 0}_${theme.name}_${this.plotter.innerRadius}`;

    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

    if (!links || !Array.isArray(links)) return [];

    const linksToProcess = links;

    const processed = linksToProcess
      .map(link => {
        const sourceChr = processedChromosomes.find(c => c.name === link.source.chromosome);
        const targetChr = processedChromosomes.find(c => c.name === link.target.chromosome);

        if (!sourceChr || !targetChr) return null;

        // Use link.source.start (matching the data structure), fallback to link.source.position
        const sourcePos = link.source.start ?? link.source.position ?? 0;
        const targetPos = link.target.start ?? link.target.position ?? 0;

        const sourceAngle = sourceChr.startAngle + (sourcePos / sourceChr.length) * (sourceChr.endAngle - sourceChr.startAngle);
        const targetAngle = targetChr.startAngle + (targetPos / targetChr.length) * (targetChr.endAngle - targetChr.startAngle);

        const sourceRadians = (sourceAngle * Math.PI) / 180;
        const targetRadians = (targetAngle * Math.PI) / 180;

        return {
          ...link,
          source: {
            ...link.source,
            chromosome: sourceChr,
            angle: sourceAngle, radians: sourceRadians,
            x: Math.cos(sourceRadians) * this.plotter.innerRadius,
            y: Math.sin(sourceRadians) * this.plotter.innerRadius,
          },
          target: {
            ...link.target,
            chromosome: targetChr,
            angle: targetAngle, radians: targetRadians,
            x: Math.cos(targetRadians) * this.plotter.innerRadius,
            y: Math.sin(targetRadians) * this.plotter.innerRadius,
          },
          color: theme.links.medium,
          opacity: this.plotter.linkOpacity,
        };
      })
      .filter(link => link !== null);

    this.cache.set(cacheKey, processed);
    return processed;
  }

  clearCache() {
    this.cache.clear();
  }
}

// Initialize the Circos plotter when the page loads
document.addEventListener('DOMContentLoaded', () => {
  if (typeof d3 === 'undefined') {
    const loadingEl = document.getElementById('loadingIndicator');
    if (loadingEl) {
      loadingEl.innerHTML = '<div class="spinner"></div><span style="color: red;">Error: D3.js library not found</span>';
    }
    return;
  }

  try {
    window.circosPlotter = new CircosPlotter();
  } catch (error) {
    const loadingEl = document.getElementById('loadingIndicator');
    if (loadingEl) {
      loadingEl.innerHTML = `<div class="spinner"></div><span style="color: red;">Error initializing: ${error.message}</span>`;
    }
  }
});
