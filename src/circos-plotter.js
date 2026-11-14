/* global CircosData */

const CIRCOS_CONTROLS = {
  radiusSlider: ['radius', 250, 'px'],
  innerRadiusSlider: ['innerRadiusRatio', 0.8, '%'],
  startAngleSlider: ['startAngle', -90, '°'],
  chrWidthSlider: ['chromosomeWidth', 15, 'px'],
  gapSlider: ['chromosomeGap', 2, '°'],
  labelDistanceSlider: ['labelDistance', 20, 'px'],
  strokeWidthSlider: ['strokeWidth', 1, 'px'],
  geneHeightSlider: ['geneHeight', 8, 'px'],
  linkOpacitySlider: ['linkOpacity', 0.6, '%'],
  gcWindowSlider: ['gcWindowSize', 10000, 'kb'],
  wigHeightSlider: ['wigTrackHeight', 30, 'px'],
  legendOpacitySlider: ['legendOpacity', 0.95, '%'],
  showLabelsCheck: ['showLabels', true],
  showTicksCheck: ['showTicks', false],
  showGenesCheck: ['showGenes', true],
  showLinksCheck: ['showLinks', true],
  showGCContentCheck: ['showGCContent', false],
  showGCSkewCheck: ['showGCSkew', false],
  showWigDataCheck: ['showWigData', false],
  showLegendCheck: ['showLegend', true],
  legendPositionSelect: ['legendPosition', 'top-right'],
  renderingModeSelect: ['renderingMode', 'canvas'],
  backgroundColorPicker: ['backgroundColor', '#ffffff'],
  strokeColorPicker: ['strokeColor', '#2c3e50'],
};

class CircosPlotter {
  constructor() {
    this.colorThemes = {
      scientific: {
        name: 'Scientific',

        chromosomes: [
          '#1f77b4',
          '#ff7f0e',
          '#2ca02c',
          '#d62728',
          '#9467bd',
          '#8c564b',
          '#e377c2',
          '#7f7f7f',
          '#bcbd22',
          '#17becf',
          '#aec7e8',
          '#ffbb78',
          '#98df8a',
          '#ff9896',
          '#c5b0d5',
          '#c49c94',
          '#f7b6d3',
          '#c7c7c7',
          '#dbdb8d',
          '#9edae5',
          '#393b79',
          '#637939',
          '#8c6d31',
          '#843c39',
        ],
        background: '#ffffff',
        stroke: '#2c3e50',
        genes: {
          protein_coding: '#27ae60',
          non_coding: '#f39c12',
          pseudogene: '#e74c3c',
          regulatory: '#8e44ad',
          default: '#7f8c8d',
        },
        tracks: {
          gc_content: '#27ae60',
          gc_skew: '#e74c3c',
          wig_data: '#9b59b6',

          baseline: '#bdc3c7',
        },
        links: {
          strong: '#2c3e50',
          medium: '#34495e',
          weak: '#7f8c8d',
        },
        text: '#2c3e50',
        ticks: '#7f8c8d',
        legend: { background: '#f8f9fa', border: '#dee2e6', text: '#2c3e50' },
      },
      nature: {
        name: 'Nature',

        chromosomes: [
          '#2d5016',
          '#4a7c59',
          '#6b9080',
          '#a4c3a2',
          '#84a98c',
          '#52796f',
          '#354f52',
          '#2f3e46',
          '#588157',
          '#3a5a40',
          '#344e41',
          '#dad7cd',
          '#a3b18a',
          '#588157',
          '#3a5a40',
          '#606c38',
          '#283618',
          '#fefae0',
          '#dda15e',
          '#bc6c25',
          '#8b5cf6',
          '#a855f7',
          '#9333ea',
          '#7c3aed',
        ],
        background: '#fefae0',
        stroke: '#283618',
        genes: {
          protein_coding: '#2d5016',
          non_coding: '#bc6c25',
          pseudogene: '#8b5cf6',
          regulatory: '#6b9080',
          default: '#606c38',
        },
        tracks: {
          gc_content: '#2d5016',
          gc_skew: '#bc6c25',
          wig_data: '#8b5cf6',

          baseline: '#a3b18a',
        },
        links: {
          strong: '#2d5016',
          medium: '#4a7c59',
          weak: '#84a98c',
        },
        text: '#283618',
        ticks: '#606c38',
        legend: { background: '#f7f3e9', border: '#d4c5a9', text: '#283618' },
      },
      ocean: {
        name: 'Ocean',

        chromosomes: [
          '#003f5c',
          '#2f4b7c',
          '#665191',
          '#a05195',
          '#d45087',
          '#f95d6a',
          '#ff7c43',
          '#ffa600',
          '#0077be',
          '#00a8cc',
          '#7dd3c0',
          '#d4f1f4',
          '#006ba6',
          '#0496c7',
          '#5fbdbd',
          '#7dd3c0',
          '#a2d5f2',
          '#bee9e8',
          '#62b6cb',
          '#1b4965',
          '#cae9ff',
          '#5fa8d3',
          '#1b4965',
          '#bee9e8',
        ],
        background: '#f0f9ff',
        stroke: '#1b4965',
        genes: {
          protein_coding: '#0077be',
          non_coding: '#ff7c43',
          pseudogene: '#a05195',
          regulatory: '#665191',
          default: '#5fbdbd',
        },
        tracks: {
          gc_content: '#0077be',
          gc_skew: '#ff7c43',
          wig_data: '#a05195',

          baseline: '#bee9e8',
        },
        links: {
          strong: '#003f5c',
          medium: '#2f4b7c',
          weak: '#7dd3c0',
        },
        text: '#1b4965',
        ticks: '#006ba6',
        legend: { background: '#e6f3ff', border: '#b3d9ff', text: '#1b4965' },
      },
      sunset: {
        name: 'Sunset',

        chromosomes: [
          '#ff6b35',
          '#f7931e',
          '#ffd23f',
          '#06ffa5',
          '#1fb3d3',
          '#5d737e',
          '#64b6ac',
          '#c0fdfb',
          '#daffef',
          '#fcf5c7',
          '#aafcb8',
          '#cf1259',
          '#f71735',
          '#fb8500',
          '#ffb700',
          '#8ecae6',
          '#219ebc',
          '#023047',
          '#ffb3c6',
          '#fb8500',
          '#8ecae6',
          '#219ebc',
          '#023047',
          '#ffb3c6',
        ],
        background: '#fff8f0',
        stroke: '#8b4513',
        genes: {
          protein_coding: '#06ffa5',
          non_coding: '#ff6b35',
          pseudogene: '#cf1259',
          regulatory: '#1fb3d3',
          default: '#5d737e',
        },
        tracks: {
          gc_content: '#06ffa5',
          gc_skew: '#ff6b35',
          wig_data: '#cf1259',

          baseline: '#c0fdfb',
        },
        links: {
          strong: '#8b4513',
          medium: '#cf1259',
          weak: '#64b6ac',
        },
        text: '#8b4513',
        ticks: '#023047',
        legend: { background: '#fef7f0', border: '#f4d1ae', text: '#8b4513' },
      },
      arctic: {
        name: 'Arctic',

        chromosomes: [
          '#e8f4f8',
          '#d1ecf1',
          '#b8e0ea',
          '#9fd3e2',
          '#85c5da',
          '#6bb6d2',
          '#52a6ca',
          '#3895c2',
          '#1f83ba',
          '#0570b0',
          '#045a8d',
          '#023858',
          '#74a9cf',
          '#2b8cbe',
          '#045a8d',
          '#023858',
          '#a6bddb',
          '#74a9cf',
          '#3690c0',
          '#0570b0',
          '#034e7b',
          '#012840',
          '#41b6c4',
          '#2c7fb8',
        ],
        background: '#f7fcfd',
        stroke: '#023858',
        genes: {
          protein_coding: '#0570b0',
          non_coding: '#41b6c4',
          pseudogene: '#2c7fb8',
          regulatory: '#3895c2',
          default: '#74a9cf',
        },
        tracks: {
          gc_content: '#0570b0',
          gc_skew: '#41b6c4',
          wig_data: '#2c7fb8',

          baseline: '#d1ecf1',
        },
        links: {
          strong: '#023858',
          medium: '#0570b0',
          weak: '#85c5da',
        },
        text: '#023858',
        ticks: '#045a8d',
        legend: { background: '#f0f8ff', border: '#c6e2ff', text: '#023858' },
      },
      cosmic: {
        name: 'Cosmic',

        chromosomes: [
          '#0d1b2a',
          '#1b263b',
          '#415a77',
          '#778da9',
          '#e0e1dd',
          '#7209b7',
          '#a663cc',
          '#4cc9f0',
          '#7209b7',
          '#f72585',
          '#b5179e',
          '#7209b7',
          '#480ca8',
          '#3a0ca3',
          '#3f37c9',
          '#7209b7',
          '#f72585',
          '#4cc9f0',
          '#4361ee',
          '#4895ef',
          '#4cc9f0',
          '#00f5ff',
          '#7209b7',
          '#f72585',
        ],
        background: '#0d1b2a',
        stroke: '#e0e1dd',
        genes: {
          protein_coding: '#4cc9f0',
          non_coding: '#f72585',
          pseudogene: '#7209b7',
          regulatory: '#a663cc',
          default: '#778da9',
        },
        tracks: {
          gc_content: '#4cc9f0',
          gc_skew: '#f72585',
          wig_data: '#7209b7',

          baseline: '#415a77',
        },
        links: {
          strong: '#e0e1dd',
          medium: '#a663cc',
          weak: '#778da9',
        },
        text: '#e0e1dd',
        ticks: '#778da9',
        legend: { background: '#1b263b', border: '#415a77', text: '#e0e1dd' },
      },
      forest: {
        name: 'Forest',

        chromosomes: [
          '#2d5016',
          '#52734d',
          '#91c788',
          '#b7d3aa',
          '#c7d59f',
          '#e0e5b6',
          '#f3e8d0',
          '#8b5a3c',
          '#a0522d',
          '#cd853f',
          '#daa520',
          '#228b22',
          '#32cd32',
          '#9acd32',
          '#adff2f',
          '#7cfc00',
          '#00ff00',
          '#00ff7f',
          '#00fa9a',
          '#90ee90',
          '#98fb98',
          '#f0fff0',
          '#006400',
          '#008000',
        ],
        background: '#f5f5dc',
        stroke: '#2d5016',
        genes: {
          protein_coding: '#228b22',
          non_coding: '#cd853f',
          pseudogene: '#8b5a3c',
          regulatory: '#91c788',
          default: '#52734d',
        },
        tracks: {
          gc_content: '#228b22',
          gc_skew: '#cd853f',
          wig_data: '#8b5a3c',

          baseline: '#c7d59f',
        },
        links: {
          strong: '#2d5016',
          medium: '#52734d',
          weak: '#91c788',
        },
        text: '#2d5016',
        ticks: '#006400',
        legend: { background: '#f0f8f0', border: '#c8e6c8', text: '#2d5016' },
      },
      monochrome: {
        name: 'Monochrome',

        chromosomes: [
          '#000000',
          '#1a1a1a',
          '#333333',
          '#4d4d4d',
          '#666666',
          '#808080',
          '#999999',
          '#b3b3b3',
          '#cccccc',
          '#e6e6e6',
          '#f2f2f2',
          '#0f0f0f',
          '#262626',
          '#404040',
          '#595959',
          '#737373',
          '#8c8c8c',
          '#a6a6a6',
          '#bfbfbf',
          '#d9d9d9',
          '#f0f0f0',
          '#1f1f1f',
          '#383838',
          '#525252',
        ],
        background: '#ffffff',
        stroke: '#000000',
        genes: {
          protein_coding: '#000000',
          non_coding: '#4d4d4d',
          pseudogene: '#808080',
          regulatory: '#333333',
          default: '#999999',
        },
        tracks: {
          gc_content: '#000000',
          gc_skew: '#4d4d4d',
          wig_data: '#666666',

          baseline: '#cccccc',
        },
        links: {
          strong: '#000000',
          medium: '#4d4d4d',
          weak: '#999999',
        },
        text: '#000000',
        ticks: '#333333',
        legend: { background: '#f8f8f8', border: '#cccccc', text: '#000000' },
      },
    };

    this.container = document.getElementById('circosContainer');
    this.tooltip = document.getElementById('tooltip');
    this.api = window.electronAPI;
    this.title = document.getElementById('circosDataTitle');
    this.data = null;
    this.trackData = {};
    this.originalChromosomeOrder = [];
    this.chromosomeOrder = 'default';
    this.loadRequest = 0;
    this.gcRequest = 0;
    this.wigRequest = 0;
    this.zoomTransform = d3.zoomIdentity;
    this.linkHitContext = document.createElement('canvas').getContext('2d');
    this.zoom = d3
      .zoom()
      .scaleExtent([0.5, 8])
      .on('start', () => this.hideTooltip())
      .on('zoom', event => {
        this.zoomTransform = event.transform;
        this.drawView();
      });
    for (const [, [property, value]] of Object.entries(CIRCOS_CONTROLS)) this[property] = value;
    this.trackColors = {};
    this.applyTheme('scientific');
    this.multiTrackManager = new window.MultiTrackGeneManager(this);
    this.bindControls();
    this.updateControls();
    this.resizeObserver = new ResizeObserver(() => this.redrawPlot());
    this.resizeObserver.observe(this.container);
    this.createPlot();
    if (this.api?.getCircosGenome) this.loadCurrentGenomeData();
  }

  bindControls() {
    for (const [id, [property, defaultValue]] of Object.entries(CIRCOS_CONTROLS)) {
      const input = document.getElementById(id);
      const live = input.type === 'range' || input.type === 'color';
      input.addEventListener(live ? 'input' : 'change', () => {
        this[property] =
          typeof defaultValue === 'boolean'
            ? input.checked
            : typeof defaultValue === 'number'
              ? input.valueAsNumber
              : input.value;
        this.updateControl(id);
        if (['showGCContent', 'showGCSkew'].includes(property)) this.loadGCTracks();
        if (property === 'showWigData') this.loadWigTrack();
        this.redrawPlot();
      });
      if (property === 'gcWindowSize') input.addEventListener('change', () => this.loadGCTracks());
    }

    const buttons = {
      loadDataBtn: () => this.loadDataFile(),
      exampleDataBtn: () => this.loadExampleData(),
      loadCurrentBtn: () => this.loadCurrentGenomeData(),
      exportBtn: () => this.exportSVG(),
      exportSvgBtn: () => this.exportSVG(),
      exportPngBtn: () => this.exportPNG(),
      exportDataBtn: () => this.exportData(),
      resetBtn: () => this.resetPlot(),
      resetZoomBtn: () => this.resetZoom(),
      helpBtn: () => this.showHelp(),
      shuffleOrderBtn: () => this.shuffleChromosomes(),
      loadHumanBtn: () => this.loadHumanData(),
      loadEcoliBtn: () => this.loadEcoliData(),
      loadYeastBtn: () => this.loadYeastData(),
      loadDrosaBtn: () => this.loadDrosophilaData(),
      loadPlantBtn: () => this.loadPlantData(),
      loadVirusBtn: () => this.loadVirusData(),
    };
    for (const [id, action] of Object.entries(buttons)) document.getElementById(id).addEventListener('click', action);

    document.getElementById('themeSelect').addEventListener('change', event => this.applyTheme(event.target.value));
    document.getElementById('chromosomeOrderSelect').addEventListener('change', event => {
      this.chromosomeOrder = event.target.value;
      this.applyChromosomeOrder();
    });
    document.getElementById('wigTrackSelect').addEventListener('change', event => {
      this.wigName = event.target.value;
      this.loadWigTrack();
      this.redrawPlot();
    });

    for (const [key, id] of Object.entries({ gc_content: 'gcContent', gc_skew: 'gcSkew', wig: 'wigData' })) {
      const input = document.getElementById(`${id}ColorPicker`);
      const button = document.getElementById(`${id}ColorBtn`);
      button.addEventListener('click', event => {
        event.preventDefault();
        input.click();
      });
      input.addEventListener('input', () => {
        this.trackColors[key] = input.value;
        button.style.backgroundColor = input.value;
        this.redrawPlot();
      });
    }
  }

  updateControl(id) {
    const [property, defaultValue, unit] = CIRCOS_CONTROLS[id];
    const input = document.getElementById(id);
    const value = this[property];
    if (typeof defaultValue === 'boolean') input.checked = value;
    else input.value = value;
    const display = document.getElementById(id.replace(/Slider$/, 'Value'));
    if (unit && display) {
      const number = unit === '%' ? Math.round(value * 100) : unit === 'kb' ? value / 1000 : value;
      display.textContent = `${number}${unit === 'kb' ? ' ' : ''}${unit}`;
    }
  }

  updateControls() {
    for (const id of Object.keys(CIRCOS_CONTROLS)) this.updateControl(id);
    const canCalculate = this.source === 'genome';
    for (const [key, checkId, controlId] of [
      ['gc_content', 'showGCContentCheck', 'gcContent'],
      ['gc_skew', 'showGCSkewCheck', 'gcSkew'],
      ['wig', 'showWigDataCheck', 'wigData'],
    ]) {
      const available = (key === 'wig' ? this.wigNames?.length : canCalculate) || this.trackData[key]?.length;
      document.getElementById(checkId).disabled = !available;
      document.getElementById(`${controlId}ColorBtn`).style.backgroundColor = this.trackColors[key];
      document.getElementById(`${controlId}ColorPicker`).value = this.trackColors[key];
    }
    document.getElementById('gcWindowSlider').disabled = !canCalculate;
    const select = document.getElementById('wigTrackSelect');
    select.parentElement.hidden = !this.wigNames?.length;
    select.replaceChildren(...(this.wigNames || []).map(name => new Option(name, name)));
    select.value = this.wigName || '';
    document.getElementById('gcWindowHint').textContent = !canCalculate
      ? this.data?.metadata.gcWindowSize
        ? `Stored window: ${window.CircosScene.formatBp(this.data.metadata.gcWindowSize)}`
        : 'Load a genome from the browser to calculate GC tracks.'
      : 'Calculated from A, C, G and T. GC content omits windows without A/C/G/T. Skew omits windows without G/C.';
    document.getElementById('wigTrackHint').hidden = Boolean(this.wigNames?.length || this.trackData.wig?.length);
    document.getElementById('themeSelect').value = this.currentTheme;
    document.getElementById('chromosomeOrderSelect').value = this.chromosomeOrder;
    for (const id of ['exportBtn', 'exportSvgBtn', 'exportPngBtn', 'exportDataBtn']) {
      document.getElementById(id).disabled = !this.data;
    }
    document.getElementById('loadCurrentBtn').disabled = !this.api?.getCircosGenome;
  }

  getCurrentTheme() {
    return this.colorThemes[this.currentTheme];
  }

  getTrackColor(key) {
    return this.trackColors[key];
  }

  applyTheme(name) {
    if (!Object.hasOwn(this.colorThemes, name)) return;
    this.currentTheme = name;
    const theme = this.getCurrentTheme();
    this.backgroundColor = theme.background;
    this.strokeColor = theme.stroke;
    this.trackColors = {
      gc_content: theme.tracks.gc_content,
      gc_skew: theme.tracks.gc_skew,
      wig: theme.tracks.wig_data,
    };
    this.multiTrackManager?.setTheme(theme);
    if (this.data) {
      this.data.chromosomes.forEach(chr => delete chr.color);
      this.updateControls();
      this.updateChromosomeColors();
      this.redrawPlot();
    }
  }

  updateStatus(message, type = this.data ? 'connected' : '') {
    document.getElementById('statusText').textContent = message;
    document.getElementById('statusDot').className = `status-dot ${type}`;
  }

  showDataStatus() {
    if (!this.data) return;
    const { totalChromosomes, totalGenes, totalLength, invalidFeatures } = this.data.metadata;
    this.title.textContent = this.data.title || this.data.metadata.title || 'Circos Genome Plotter';
    const label =
      this.source === 'genome' ? 'Genome browser' : this.source === 'sample' ? 'Example data' : 'Imported data';
    this.updateStatus(
      `${label} · ${totalChromosomes} seq · ${totalGenes.toLocaleString()} features · ${window.CircosScene.formatBp(totalLength)}${invalidFeatures ? ` · ${invalidFeatures} features skipped` : ''}`
    );
  }

  setData(input, source, wigNames = []) {
    const data = CircosData.normalize(input);
    this.data = data;
    this.source = source;
    this.loadRequest++;
    this.gcRequest++;
    this.wigRequest++;
    this.wigNames = wigNames;
    this.wigName = wigNames[0] || '';
    this.trackData = { ...data.tracks };
    this.trackWindowSize = Number.isSafeInteger(data.metadata.gcWindowSize) ? data.metadata.gcWindowSize : null;
    this.requestedGCWindow = null;
    this.renderedWigName = null;
    this.zoomTransform = d3.zoomIdentity;
    this.chromosomeOrder = 'default';
    this.originalChromosomeOrder = [...data.chromosomes];
    if (source !== 'genome') this.restoreSettings(data.metadata.parameters);
    this.updateControls();
    this.updateChromosomeColors();
    this.createPlot();
    this.showDataStatus();
    if (source === 'genome') {
      this.loadGCTracks();
      this.loadWigTrack();
    }
  }

  async loadCurrentGenomeData() {
    if (!this.api?.getCircosGenome) return;
    const request = ++this.loadRequest;
    this.updateStatus('Loading current genome…', 'loading');
    try {
      const result = await this.api.getCircosGenome();
      if (request !== this.loadRequest) return;
      if (!result.success) throw new Error(result.error);
      this.setData(result.data, 'genome', result.wigTracks);
    } catch (error) {
      if (request === this.loadRequest) this.updateStatus(error.message, 'error');
    }
  }

  async loadGCTracks() {
    if (
      this.source !== 'genome' ||
      !(this.showGCContent || this.showGCSkew) ||
      this.requestedGCWindow === this.gcWindowSize
    ) {
      return;
    }
    const request = ++this.gcRequest;
    const windowSize = this.gcWindowSize;
    this.requestedGCWindow = windowSize;
    delete this.trackData.gc_content;
    delete this.trackData.gc_skew;
    this.trackWindowSize = null;
    this.redrawPlot();
    document.getElementById('gcWindowHint').textContent = 'Calculating GC tracks…';
    try {
      const result = await this.api.getCircosTracks({ windowSize });
      if (request !== this.gcRequest) return;
      if (!result.success) throw new Error(result.error);
      this.trackData.gc_content = result.gc_content;
      this.trackData.gc_skew = result.gc_skew;
      this.trackWindowSize = result.windowSize;
      document.getElementById('gcWindowHint').textContent =
        result.windowSize === windowSize
          ? `Computed at ${window.CircosScene.formatBp(result.windowSize)} · A/C/G/T bases`
          : `Computed at ${window.CircosScene.formatBp(result.windowSize)} to limit the number of windows.`;
      this.redrawPlot();
    } catch (error) {
      if (request !== this.gcRequest) return;
      this.requestedGCWindow = null;
      document.getElementById('gcWindowHint').textContent = error.message;
      this.updateStatus(error.message, 'error');
    }
  }

  async loadWigTrack() {
    if (this.source !== 'genome' || !this.showWigData || !this.wigName || this.renderedWigName === this.wigName) return;
    const request = ++this.wigRequest;
    const wigName = this.wigName;
    delete this.trackData.wig;
    this.renderedWigName = null;
    this.redrawPlot();
    this.updateStatus(`Loading WIG track ${wigName}…`, 'loading');
    try {
      const result = await this.api.getCircosTracks({ wigName });
      if (request !== this.wigRequest || wigName !== this.wigName) return;
      if (!result.success) throw new Error(result.error);
      this.trackData.wig = result.wig;
      this.renderedWigName = wigName;
      this.showDataStatus();
      this.redrawPlot();
    } catch (error) {
      if (request === this.wigRequest) this.updateStatus(error.message, 'error');
    }
  }

  async navigate(target) {
    if (!target || this.source !== 'genome') return;
    const { chromosome, start, end } = target;
    const dataset = this.data;
    try {
      const result = await this.api.navigateFromCircos({ chromosome, start, end });
      if (!result.success) throw new Error(result.error);
    } catch (error) {
      if (dataset === this.data) this.updateStatus(error.message, 'error');
    }
  }

  async loadDataFile() {
    if (this.api?.showOpenFileDialog) {
      const request = ++this.loadRequest;
      try {
        const result = await this.api.showOpenFileDialog({
          title: 'Open Circos Data',
          properties: ['openFile'],
          filters: [{ name: 'Circos Data', extensions: ['json', 'csv', 'tsv', 'txt'] }],
        });
        if (request !== this.loadRequest || result.canceled) return;
        if (!result.success) throw new Error(result.error);
        const filePath = result.filePaths[0];
        const fileName = filePath.split(/[\\/]/).pop();
        await this.parseDataFile({
          name: fileName,
          text: async () => {
            const result = await this.api.readFile(filePath);
            if (!result.success) throw new Error(result.error);
            return result.data;
          },
        });
      } catch (error) {
        if (request === this.loadRequest) this.updateStatus(error.message, 'error');
      }
      return;
    }
    const input = document.getElementById('circosFileInput');
    input.value = '';
    input.click();
  }

  async parseDataFile(file) {
    const request = ++this.loadRequest;
    try {
      const content = await file.text();
      if (request !== this.loadRequest) return;
      const extension = file.name.split('.').pop().toLowerCase();
      let data;
      if (extension === 'json') {
        data = JSON.parse(content);
      } else if (['csv', 'tsv', 'txt'].includes(extension)) {
        const parsed = Papa.parse(content, {
          header: true,
          skipEmptyLines: 'greedy',
          ...(extension === 'tsv' ? { delimiter: '\t' } : {}),
        });
        if (parsed.errors.length > 0) throw new Error(parsed.errors[0].message);
        data = CircosData.fromTable(parsed.data);
      } else {
        throw new Error('Choose a Circos JSON, CSV or TSV file. Load genome formats in the genome browser.');
      }
      this.setData(data, data.metadata?.source === 'Example' ? 'sample' : 'file');
    } catch (error) {
      if (request === this.loadRequest) this.updateStatus(`${file.name}: ${error.message}`, 'error');
    }
  }

  loadExampleData() {
    this.loadHumanData();
  }

  loadSample(sample) {
    this.setData({ ...sample, metadata: { source: 'Example' } }, 'sample');
  }

  sampleRandom() {
    // Fixed seed per example makes previews and exported demos reproducible.
    this.sampleSeed = (Math.imul(1664525, this.sampleSeed) + 1013904223) >>> 0;
    return this.sampleSeed / 4294967296;
  }

  loadHumanData() {
    this.sampleSeed = 42;
    const sample = {
      title: 'Human Genome (Homo sapiens)',
      chromosomes: [
        { name: 'chr1', length: 248956422 },
        { name: 'chr2', length: 242193529 },
        { name: 'chr3', length: 198295559 },
        { name: 'chr4', length: 190214555 },
        { name: 'chr5', length: 181538259 },
        { name: 'chr6', length: 170805979 },
        { name: 'chr7', length: 159345973 },
        { name: 'chr8', length: 145138636 },
        { name: 'chr9', length: 138394717 },
        { name: 'chr10', length: 133797422 },
        { name: 'chr11', length: 135086622 },
        { name: 'chr12', length: 133275309 },
        { name: 'chr13', length: 114364328 },
        { name: 'chr14', length: 107043718 },
        { name: 'chr15', length: 101991189 },
        { name: 'chr16', length: 90338345 },
        { name: 'chr17', length: 83257441 },
        { name: 'chr18', length: 80373285 },
        { name: 'chr19', length: 58617616 },
        { name: 'chr20', length: 64444167 },
        { name: 'chr21', length: 46709983 },
        { name: 'chr22', length: 50818468 },
        { name: 'chrX', length: 156040895 },
        { name: 'chrY', length: 57227415 },
      ],
      genes: [],
      links: [],
    };

    sample.genes = this.generateHumanGenes(sample.chromosomes);
    sample.links = this.generateHumanLinks(sample.chromosomes);
    this.loadSample(sample);
  }

  loadEcoliData() {
    this.sampleSeed = 42;
    const sample = {
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

    sample.genes = sample.genes.concat(this.generateEcoliGenes(sample.chromosomes));
    this.loadSample(sample);
  }

  loadYeastData() {
    this.sampleSeed = 42;
    const sample = {
      title: 'Saccharomyces cerevisiae',
      chromosomes: [
        { name: 'chrI', length: 230218 },
        { name: 'chrII', length: 813184 },
        { name: 'chrIII', length: 316620 },
        { name: 'chrIV', length: 1531933 },
        { name: 'chrV', length: 576874 },
        { name: 'chrVI', length: 270161 },
        { name: 'chrVII', length: 1090940 },
        { name: 'chrVIII', length: 562643 },
        { name: 'chrIX', length: 439888 },
        { name: 'chrX', length: 745751 },
        { name: 'chrXI', length: 666816 },
        { name: 'chrXII', length: 1078177 },
        { name: 'chrXIII', length: 924431 },
        { name: 'chrXIV', length: 784333 },
        { name: 'chrXV', length: 1091291 },
        { name: 'chrXVI', length: 948066 },
      ],
      genes: [],
      links: [],
    };

    sample.genes = this.generateYeastGenes(sample.chromosomes);
    sample.links = this.generateYeastLinks(sample.chromosomes);
    this.loadSample(sample);
  }

  loadDrosophilaData() {
    this.sampleSeed = 42;
    const sample = {
      title: 'Drosophila melanogaster',
      chromosomes: [
        { name: 'chrX', length: 23542271 },
        { name: 'chr2L', length: 23513712 },
        { name: 'chr2R', length: 25286936 },
        { name: 'chr3L', length: 28110227 },
        { name: 'chr3R', length: 32079331 },
        { name: 'chr4', length: 1348131 },
      ],
      genes: [],
      links: [],
    };

    sample.genes = this.generateDrosophilaGenes(sample.chromosomes);
    sample.links = this.generateDrosophilaLinks(sample.chromosomes);
    this.loadSample(sample);
  }

  loadPlantData() {
    this.sampleSeed = 42;
    const sample = {
      title: 'Arabidopsis thaliana',
      chromosomes: [
        { name: 'chr1', length: 30427671 },
        { name: 'chr2', length: 19698289 },
        { name: 'chr3', length: 23459830 },
        { name: 'chr4', length: 18585056 },
        { name: 'chr5', length: 26975502 },
      ],
      genes: [],
      links: [],
    };

    sample.genes = this.generatePlantGenes(sample.chromosomes);
    sample.links = this.generatePlantLinks(sample.chromosomes);
    this.loadSample(sample);
  }

  loadVirusData() {
    const sample = {
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
    this.loadSample(sample);
  }

  // ─── Gene/Link Generation ───────────────────────────────

  generateHumanGenes(chromosomes) {
    const genes = [];
    const geneNames = [
      'BRCA1',
      'TP53',
      'EGFR',
      'MYC',
      'KRAS',
      'PIK3CA',
      'PTEN',
      'RB1',
      'APC',
      'VHL',
      'CDKN2A',
      'MLH1',
      'BRCA2',
      'ATM',
      'CHEK2',
      'PALB2',
      'CDH1',
      'STK11',
      'SMAD4',
      'DCC',
      'TERT',
      'IDH1',
      'ARID1A',
      'CTNNB1',
      'FBXW7',
    ];
    const geneTypes = ['protein_coding', 'non_coding', 'pseudogene', 'regulatory'];
    const typeWeights = [0.6, 0.2, 0.15, 0.05];

    chromosomes.forEach((chr, chrIndex) => {
      const numGenes = Math.floor(this.sampleRandom() * 30) + 15;
      for (let i = 0; i < numGenes; i++) {
        const start = Math.floor(this.sampleRandom() * (chr.length - 100000));
        const length = Math.floor(this.sampleRandom() * 95000) + 5000;

        const rand = this.sampleRandom();
        let geneType = 'protein_coding';
        let cumWeight = 0;
        for (let j = 0; j < geneTypes.length; j++) {
          cumWeight += typeWeights[j];
          if (rand <= cumWeight) {
            geneType = geneTypes[j];
            break;
          }
        }

        genes.push({
          chromosome: chr.name,
          start,
          end: start + length,
          name: geneNames[Math.floor(this.sampleRandom() * geneNames.length)] + `_${chrIndex + 1}_${i + 1}`,
          type: geneType,
          expression: this.sampleRandom(),
          value: this.sampleRandom(),
        });
      }
    });
    return genes;
  }

  generateHumanLinks(chromosomes) {
    const links = [];
    for (let i = 0; i < 50; i++) {
      const chr1 = chromosomes[Math.floor(this.sampleRandom() * chromosomes.length)];
      const chr2 = chromosomes[Math.floor(this.sampleRandom() * chromosomes.length)];
      if (chr1.name !== chr2.name) {
        links.push({
          source: {
            chromosome: chr1.name,
            start: Math.floor(this.sampleRandom() * (chr1.length - 1000000)),
          },
          target: {
            chromosome: chr2.name,
            start: Math.floor(this.sampleRandom() * (chr2.length - 1000000)),
          },
          type: ['synteny', 'duplication', 'inversion'][Math.floor(this.sampleRandom() * 3)],
          value: this.sampleRandom(),
        });
      }
    }
    return links;
  }

  generateEcoliGenes(chromosomes) {
    const genes = [];
    const geneNames = ['dnaA', 'dnaB', 'dnaC', 'dnaG', 'dnaK', 'recA', 'rpoA', 'rpoB', 'rpoC', 'gyrA', 'gyrB'];
    for (let i = 0; i < 100; i++) {
      const start = Math.floor(this.sampleRandom() * (chromosomes[0].length - 5000));
      const length = Math.floor(this.sampleRandom() * 3000) + 500;
      genes.push({
        chromosome: 'chromosome',
        start,
        end: start + length,
        name: geneNames[i % geneNames.length] + `_${Math.floor(i / geneNames.length) + 1}`,
        type: 'protein_coding',
        value: this.sampleRandom() * 0.5 + 0.5,
      });
    }
    return genes;
  }

  generateYeastGenes(chromosomes) {
    const genes = [];
    chromosomes.forEach(chr => {
      const numGenes = Math.floor(chr.length / 5000);
      for (let i = 0; i < numGenes; i++) {
        const start = Math.floor(this.sampleRandom() * (chr.length - 2000));
        const length = Math.floor(this.sampleRandom() * 1500) + 500;
        genes.push({
          chromosome: chr.name,
          start,
          end: start + length,
          name: `Y${chr.name.replace('chr', '')}${String(i + 1).padStart(3, '0')}C`,
          type: 'protein_coding',
          value: this.sampleRandom(),
        });
      }
    });
    return genes;
  }

  generateYeastLinks(chromosomes) {
    const links = [];
    for (let i = 0; i < 15; i++) {
      const chr1 = chromosomes[Math.floor(this.sampleRandom() * chromosomes.length)];
      const chr2 = chromosomes[Math.floor(this.sampleRandom() * chromosomes.length)];
      if (chr1.name !== chr2.name) {
        links.push({
          source: {
            chromosome: chr1.name,
            start: Math.floor(this.sampleRandom() * (chr1.length - 50000)),
          },
          target: {
            chromosome: chr2.name,
            start: Math.floor(this.sampleRandom() * (chr2.length - 50000)),
          },
          type: 'duplication',
          value: this.sampleRandom(),
        });
      }
    }
    return links;
  }

  generateDrosophilaGenes(chromosomes) {
    const genes = [];
    chromosomes.forEach(chr => {
      const numGenes = Math.floor(chr.length / 15000);
      for (let i = 0; i < numGenes; i++) {
        const start = Math.floor(this.sampleRandom() * (chr.length - 10000));
        const length = Math.floor(this.sampleRandom() * 8000) + 2000;
        genes.push({
          chromosome: chr.name,
          start,
          end: start + length,
          name: `Dm${chr.name.replace('chr', '')}${String(i + 1).padStart(4, '0')}`,
          type: this.sampleRandom() > 0.8 ? 'non_coding' : 'protein_coding',
          value: this.sampleRandom(),
        });
      }
    });
    return genes;
  }

  generateDrosophilaLinks(chromosomes) {
    const links = [];
    for (let i = 0; i < 12; i++) {
      const chr1 = chromosomes[Math.floor(this.sampleRandom() * chromosomes.length)];
      const chr2 = chromosomes[Math.floor(this.sampleRandom() * chromosomes.length)];
      if (chr1.name !== chr2.name) {
        links.push({
          source: {
            chromosome: chr1.name,
            start: Math.floor(this.sampleRandom() * (chr1.length - 100000)),
          },
          target: {
            chromosome: chr2.name,
            start: Math.floor(this.sampleRandom() * (chr2.length - 100000)),
          },
          type: 'inversion',
          value: this.sampleRandom(),
        });
      }
    }
    return links;
  }

  generatePlantGenes(chromosomes) {
    const genes = [];
    chromosomes.forEach((chr, chrIndex) => {
      const numGenes = Math.floor(chr.length / 8000);
      for (let i = 0; i < numGenes; i++) {
        const start = Math.floor(this.sampleRandom() * (chr.length - 5000));
        const length = Math.floor(this.sampleRandom() * 4000) + 1000;
        genes.push({
          chromosome: chr.name,
          start,
          end: start + length,
          name: `AT${chrIndex + 1}G${String(i + 1).padStart(5, '0')}`,
          type: 'protein_coding',
          value: this.sampleRandom(),
        });
      }
    });
    return genes;
  }

  generatePlantLinks(chromosomes) {
    const links = [];
    for (let i = 0; i < 10; i++) {
      const chr1 = chromosomes[Math.floor(this.sampleRandom() * chromosomes.length)];
      const chr2 = chromosomes[Math.floor(this.sampleRandom() * chromosomes.length)];
      if (chr1.name !== chr2.name) {
        links.push({
          source: {
            chromosome: chr1.name,
            start: Math.floor(this.sampleRandom() * (chr1.length - 200000)),
          },
          target: {
            chromosome: chr2.name,
            start: Math.floor(this.sampleRandom() * (chr2.length - 200000)),
          },
          type: 'synteny',
          value: this.sampleRandom(),
        });
      }
    }
    return links;
  }

  applyChromosomeOrder() {
    if (!this.data) return;
    const order = [...this.originalChromosomeOrder];
    switch (this.chromosomeOrder) {
      case 'size':
        order.sort((a, b) => b.length - a.length);
        break;
      case 'size_asc':
        order.sort((a, b) => a.length - b.length);
        break;
      case 'name':
        order.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        break;
      case 'reverse':
        order.reverse();
        break;
    }
    this.data.chromosomes = order;
    this.updateChromosomeColors();
    this.redrawPlot();
  }

  shuffleChromosomes() {
    if (!this.data) return;
    const order = this.data.chromosomes;
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    this.chromosomeOrder = 'shuffled';
    document.getElementById('chromosomeOrderSelect').value = 'shuffled';
    this.updateChromosomeColors();
    this.redrawPlot();
  }

  updateChromosomeColors() {
    const list = document.getElementById('chromosomeColorList');
    list.replaceChildren();
    if (!this.data) return;
    const { chromosomes } = this.getCurrentTheme();
    this.data.chromosomes.forEach((chr, index) => {
      const label = document.createElement('label');
      label.className = 'chromosome-color-item';
      const color = document.createElement('input');
      color.type = 'color';
      color.value = chr.color || chromosomes[index % chromosomes.length];
      color.addEventListener('input', () => {
        chr.color = color.value;
        this.redrawPlot();
      });
      const text = document.createElement('span');
      text.textContent = chr.name;
      text.title = chr.name;
      label.append(color, text);
      list.append(label);
    });
  }

  redrawPlot() {
    if (this.redrawFrame) return;
    this.redrawFrame = requestAnimationFrame(() => {
      this.redrawFrame = null;
      this.createPlot();
    });
  }

  measure() {
    const styles = getComputedStyle(this.container);
    const availableWidth =
      this.container.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
    const availableHeight =
      this.container.clientHeight - parseFloat(styles.paddingTop) - parseFloat(styles.paddingBottom);
    this.width = Math.max(1, Math.floor(availableWidth));
    this.height = Math.max(1, Math.floor(availableHeight));
    this.fitScale = Math.min(1, Math.max(1, Math.min(this.width, this.height) / 2 - 12) / this.scene.extent);
    const legendWidth = this.legendEntries().length ? 210 : 0;
    this.fitScale = Math.min(this.fitScale, Math.max(1, this.width - legendWidth - 24) / (this.scene.extent * 2));
  }

  createPlot() {
    this.hideTooltip();
    if (!this.data) {
      this.view = null;
      this.scene = null;
      this.container.replaceChildren(document.getElementById('circosEmptyState').content.cloneNode(true));
      return;
    }
    this.scene = window.CircosScene.layout(this);
    this.measure();
    if (!this.view || this.activeMode !== this.renderingMode) {
      this.container.replaceChildren();
      this.activeMode = this.renderingMode;
      const selection = d3
        .select(this.container)
        .append(this.activeMode === 'canvas' ? 'canvas' : 'svg')
        .attr('class', 'circos-view')
        .attr('aria-label', 'Circular genome plot')
        .call(this.zoom)
        .on('pointermove.circos', event => this.handlePointer(event))
        .on('pointerleave.circos', () => this.hideTooltip())
        .on('click.circos', event => this.navigate(this.hitTest(event)?.target));
      this.view = selection.node();
    }
    d3.select(this.view).property('__zoom', this.zoomTransform);
    if (this.activeMode === 'canvas') {
      this.pixelRatio = window.devicePixelRatio || 1;
      this.view.width = this.width * this.pixelRatio;
      this.view.height = this.height * this.pixelRatio;
      this.view.style.width = `${this.width}px`;
      this.view.style.height = `${this.height}px`;
      for (const path of this.scene.paths) path.canvasPath = new Path2D(path.d);
      this.drawView();
    } else {
      this.renderSVG(d3.select(this.view), this.zoomTransform);
    }
  }

  legendEntries() {
    if (!this.showLegend) return [];
    const title = this.data.title || this.data.metadata.title;
    const label = this.source === 'sample' ? 'Example data' : typeof title === 'string' ? title : '';
    return [
      ...(label ? [{ label }] : []),
      {
        label: `${this.data.metadata.totalChromosomes} seq · ${window.CircosScene.formatBp(this.data.metadata.totalLength)}`,
      },
      ...this.scene.legend,
      ...((this.showGCContent || this.showGCSkew) && this.trackWindowSize
        ? [{ label: `GC window · ${window.CircosScene.formatBp(this.trackWindowSize)}` }]
        : []),
    ];
  }

  legendLayout() {
    const rows = this.legendEntries();
    const width = 194;
    const height = 14 + rows.length * 17;
    const left = this.legendPosition.endsWith('left');
    const x = left ? 10 : this.width - width - 10;
    const y = this.legendPosition.startsWith('top') ? 10 : this.height - height - 10;
    return { rows, width, height, x, y, theme: this.getCurrentTheme().legend };
  }

  plotCenter() {
    const legend = this.legendLayout();
    const inset = legend.rows.length ? legend.width + 16 : 0;
    const left = this.legendPosition.endsWith('left');
    return [this.width / 2 + (left ? inset / 2 : -inset / 2), this.height / 2];
  }

  sceneTransform(view) {
    const [x, y] = this.plotCenter();
    return d3.zoomIdentity.translate(view.x + x * view.k, view.y + y * view.k).scale(this.fitScale * view.k);
  }

  drawView() {
    if (!this.view || !this.scene) return;
    const transform = this.sceneTransform(this.zoomTransform);
    if (this.activeMode === 'svg') {
      this.view.querySelector('.circos-geometry')?.setAttribute('transform', transform.toString());
      return;
    }
    const context = this.view.getContext('2d');
    const ratio = this.pixelRatio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = this.backgroundColor;
    context.fillRect(0, 0, this.width, this.height);
    context.save();
    context.translate(transform.x, transform.y);
    context.scale(transform.k, transform.k);
    for (const path of this.scene.paths) {
      context.globalAlpha = path.opacity ?? 1;
      if (path.fill) {
        context.fillStyle = path.fill;
        context.fill(path.canvasPath);
      }
      if (path.stroke && path.width > 0) {
        context.strokeStyle = path.stroke;
        context.lineWidth = path.width;
        context.setLineDash(path.dash || []);
        context.stroke(path.canvasPath);
      }
    }
    context.globalAlpha = 1;
    context.fillStyle = this.scene.textColor;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    for (const label of this.scene.labels) {
      context.save();
      context.translate(label.x, label.y);
      context.rotate(label.rotation);
      context.font = `${label.size}px Arial, sans-serif`;
      context.fillText(label.text, 0, 0);
      context.restore();
    }
    context.restore();
    this.drawCanvasLegend(context);
  }

  drawCanvasLegend(context) {
    const { rows, x, y, width, height, theme } = this.legendLayout();
    if (!rows.length) return;
    context.save();
    context.globalAlpha = this.legendOpacity;
    context.fillStyle = theme.background;
    context.fillRect(x, y, width, height);
    context.globalAlpha = 1;
    context.strokeStyle = theme.border;
    context.strokeRect(x, y, width, height);
    context.textBaseline = 'middle';
    context.font = '11px Arial, sans-serif';
    rows.forEach((row, index) => {
      const top = y + 8 + index * 17;
      if (row.color) {
        context.fillStyle = row.color;
        context.fillRect(x + 8, top + 2, row.negative ? 5 : 10, 10);
        if (row.negative) {
          context.fillStyle = row.negative;
          context.fillRect(x + 13, top + 2, 5, 10);
        }
      }
      context.fillStyle = theme.text;
      context.fillText(this.legendLabel(row.label), x + (row.color ? 24 : 8), top + 7);
    });
    context.restore();
  }

  legendLabel(label) {
    return label.length > 29 ? `${label.slice(0, 28)}…` : label;
  }

  renderSVG(svg, view) {
    const scene = this.scene;
    svg.selectAll('*').remove();
    svg
      .attr('width', this.width)
      .attr('height', this.height)
      .attr('viewBox', `0 0 ${this.width} ${this.height}`)
      .attr('font-family', 'Arial, sans-serif');
    const title = this.data.title || this.data.metadata.title || 'Circos Genome Plot';
    svg.append('title').text(this.source === 'sample' ? `Example data · ${title}` : title);
    svg.append('rect').attr('width', this.width).attr('height', this.height).attr('fill', this.backgroundColor);
    const g = svg.append('g').attr('class', 'circos-geometry').attr('transform', this.sceneTransform(view).toString());
    g.selectAll('path')
      .data(scene.paths)
      .join('path')
      .attr('d', path => path.d)
      .attr('fill', path => path.fill || 'none')
      .attr('stroke', path => path.stroke)
      .attr('stroke-width', path => path.width)
      .attr('stroke-dasharray', path => path.dash?.join(' '))
      .attr('opacity', path => path.opacity);
    g.selectAll('text')
      .data(scene.labels)
      .join('text')
      .attr('transform', label => `translate(${label.x},${label.y}) rotate(${(label.rotation * 180) / Math.PI})`)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', scene.textColor)
      .attr('font-size', label => label.size)
      .text(label => label.text);
    const { rows, x, y, width, height, theme } = this.legendLayout();
    if (!rows.length) return;
    const legend = svg.append('g').attr('transform', `translate(${x},${y})`);
    legend
      .append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', theme.background)
      .attr('fill-opacity', this.legendOpacity)
      .attr('stroke', theme.border);
    rows.forEach((row, index) => {
      const top = 8 + index * 17;
      if (row.color) {
        legend
          .append('rect')
          .attr('x', 8)
          .attr('y', top + 2)
          .attr('width', row.negative ? 5 : 10)
          .attr('height', 10)
          .attr('fill', row.color);
      }
      if (row.negative) {
        legend
          .append('rect')
          .attr('x', 13)
          .attr('y', top + 2)
          .attr('width', 5)
          .attr('height', 10)
          .attr('fill', row.negative);
      }
      legend
        .append('text')
        .attr('x', row.color ? 24 : 8)
        .attr('y', top + 7)
        .attr('dominant-baseline', 'middle')
        .attr('font-size', 11)
        .attr('fill', theme.text)
        .text(this.legendLabel(row.label));
    });
  }

  hitTest(event) {
    if (!this.scene) return null;
    const [pointerX, pointerY] = d3.pointer(event, this.view);
    const legend = this.legendLayout();
    if (
      legend.rows.length &&
      pointerX >= legend.x &&
      pointerX <= legend.x + legend.width &&
      pointerY >= legend.y &&
      pointerY <= legend.y + legend.height
    ) {
      return null;
    }
    const [x, y] = this.sceneTransform(this.zoomTransform).invert([pointerX, pointerY]);
    const radius = Math.hypot(x, y);
    const origin = (this.startAngle * Math.PI) / 180;
    const relative = Math.atan2(y, x) - origin;
    const angle = origin + (((relative % window.CircosScene.TAU) + window.CircosScene.TAU) % window.CircosScene.TAU);
    for (const band of this.scene.hitBands) {
      if (radius < band.lower || radius > band.upper) continue;
      const index = d3.bisector(region => region.startAngle).right(band.regions, angle) - 1;
      for (let i = index; i >= 0 && band.regions[i].furthestEnd >= angle; i--) {
        const region = band.regions[i];
        if (region.endAngle >= angle) return region;
      }
    }
    if (radius < this.scene.inner && this.linkHitContext) {
      const hit = this.linkHitContext;
      for (let index = this.scene.linkHits.length - 1; index >= 0; index--) {
        const link = this.scene.linkHits[index];
        hit.lineWidth = Math.max(5, link.width);
        if (hit.isPointInStroke(link.path, x, y)) return link;
      }
    }
    return null;
  }

  handlePointer(event) {
    if (event.buttons) return;
    const region = this.hitTest(event);
    this.view.style.cursor = region?.target && this.source === 'genome' ? 'pointer' : 'grab';
    if (!region) {
      this.hideTooltip();
      return;
    }
    this.tooltip.textContent = region.tooltip.join('\n');
    this.tooltip.style.opacity = '1';
    const { width, height } = this.tooltip.getBoundingClientRect();
    this.tooltip.style.left = `${Math.max(0, Math.min(event.clientX + 12, window.innerWidth - width - 8))}px`;
    this.tooltip.style.top = `${Math.max(0, Math.min(event.clientY + 12, window.innerHeight - height - 8))}px`;
  }

  hideTooltip() {
    this.tooltip.style.opacity = '0';
  }

  resetZoom() {
    if (this.view) d3.select(this.view).call(this.zoom.transform, d3.zoomIdentity);
  }

  zoomBy(factor) {
    if (this.view) d3.select(this.view).call(this.zoom.scaleBy, factor, this.plotCenter());
  }

  exportSVGBlob() {
    this.createPlot();
    const svg = d3.select(document.createElementNS('http://www.w3.org/2000/svg', 'svg'));
    this.renderSVG(svg, d3.zoomIdentity);
    return new Blob([new XMLSerializer().serializeToString(svg.node())], { type: 'image/svg+xml;charset=utf-8' });
  }

  async download(blob, extension, suffix = '') {
    const base = String(this.data?.title || 'circos-plot')
      .replace(/[^\p{L}\p{N}_.-]+/gu, '-')
      .slice(0, 100);
    const fileName = `${base}${suffix}.${extension}`;
    if (this.api?.showSaveDialog) {
      try {
        const destination = await this.api.showSaveDialog({
          title: 'Save Circos Plot',
          defaultPath: fileName,
          filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
        });
        if (destination.error) throw new Error(destination.error);
        if (destination.canceled || !destination.filePath) return;
        const output = await this.api.writeFile(destination.filePath, new Uint8Array(await blob.arrayBuffer()));
        if (!output.success) throw new Error(output.error);
        this.updateStatus(`Saved ${output.fileName}`);
      } catch (error) {
        this.updateStatus(`Save failed: ${error.message}`, 'error');
      }
      return;
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.download = fileName;
    anchor.href = url;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.updateStatus(`Download started for ${fileName}`);
  }

  exportSVG() {
    if (this.data) this.download(this.exportSVGBlob(), 'svg');
  }

  async exportPNG() {
    if (!this.data) return;
    const blob = this.exportSVGBlob();
    const width = this.width;
    const height = this.height;
    const resolution = Number(document.getElementById('exportResolutionSelect').value);
    const url = URL.createObjectURL(blob);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = width * resolution;
      canvas.height = height * resolution;
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      const png = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!png) throw new Error('Image is too large to encode.');
      await this.download(png, 'png', `-${resolution}x`);
    } catch (error) {
      this.updateStatus(`PNG export failed: ${error.message}`, 'error');
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  exportData() {
    if (!this.data) return;
    const parameters = Object.fromEntries(
      Object.values(CIRCOS_CONTROLS).map(([property]) => [property, this[property]])
    );
    const data = {
      ...this.data,
      tracks: this.trackData,
      metadata: {
        ...this.data.metadata,
        wigName: this.renderedWigName || this.data.metadata.wigName,
        gcWindowSize: this.trackWindowSize,
        parameters: {
          ...parameters,
          exportResolution: Number(document.getElementById('exportResolutionSelect').value),
          theme: this.currentTheme,
          trackColors: this.trackColors,
          geneTracks: this.multiTrackManager.geneTracks,
          cdsDensityTracks: this.multiTrackManager.cdsDensityTracks,
        },
      },
    };
    this.download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), 'json');
  }

  restoreSettings(parameters) {
    if (!parameters || typeof parameters !== 'object') return;
    const { theme, trackColors, geneTracks, cdsDensityTracks, exportResolution } = parameters;
    if ([1, 2, 3, 4].includes(exportResolution)) {
      document.getElementById('exportResolutionSelect').value = exportResolution;
    }
    // Preserve explicit per-chromosome colors in saved plots.
    const chromosomeColors = this.data.chromosomes.map(chr => chr.color);
    if (theme) this.applyTheme(theme);
    chromosomeColors.forEach((color, index) => {
      if (color) this.data.chromosomes[index].color = color;
    });
    for (const [id, [property, defaultValue]] of Object.entries(CIRCOS_CONTROLS)) {
      const value = parameters[property];
      const input = document.getElementById(id);
      if (typeof defaultValue === 'number' && Number.isFinite(value)) {
        this[property] = Math.max(Number(input.min), Math.min(Number(input.max), value));
      } else if (typeof defaultValue === 'boolean' && typeof value === 'boolean') {
        this[property] = value;
      } else if (input.type === 'select-one' && [...input.options].some(option => option.value === value)) {
        this[property] = value;
      } else if (input.type === 'color' && typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) {
        this[property] = value;
      }
    }
    for (const key of Object.keys(this.trackColors)) {
      const color = trackColors?.[key];
      if (typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)) this.trackColors[key] = color;
    }
    for (const [key, config] of Object.entries(this.multiTrackManager.geneTracks)) {
      const saved = geneTracks?.[key];
      if (typeof saved?.enabled === 'boolean') config.enabled = saved.enabled;
      if (typeof saved?.color === 'string' && /^#[0-9a-f]{6}$/i.test(saved.color)) config.color = saved.color;
      document.getElementById(`track-${key}`).checked = config.enabled;
      document.getElementById(`trackColorPicker-${key}`).value = config.color;
    }
    if (Number.isInteger(cdsDensityTracks) && cdsDensityTracks >= 1 && cdsDensityTracks <= 5) {
      this.multiTrackManager.cdsDensityTracks = cdsDensityTracks;
      document.getElementById('cds-density-tracks').value = cdsDensityTracks;
    }
  }

  resetPlot() {
    for (const [, [property, value]] of Object.entries(CIRCOS_CONTROLS)) this[property] = value;
    this.chromosomeOrder = 'default';
    this.applyTheme('scientific');
    this.applyChromosomeOrder();
    for (const [type, config] of Object.entries(this.multiTrackManager.geneTracks)) {
      config.enabled = type !== 'other';
      document.getElementById(`track-${type}`).checked = config.enabled;
    }
    this.multiTrackManager.cdsDensityTracks = 3;
    document.getElementById('cds-density-tracks').value = 3;
    document.getElementById('exportResolutionSelect').value = 1;
    this.resetZoom();
    this.updateControls();
    this.redrawPlot();
    this.showDataStatus();
  }

  clearPlot() {
    this.loadRequest++;
    this.gcRequest++;
    this.wigRequest++;
    this.data = null;
    this.trackData = {};
    this.source = null;
    this.wigNames = [];
    this.wigName = '';
    this.zoomTransform = d3.zoomIdentity;
    this.chromosomeOrder = 'default';
    this.originalChromosomeOrder = [];
    this.multiTrackManager.groupGenesByType([]);
    this.updateControls();
    this.updateChromosomeColors();
    this.createPlot();
    this.title.textContent = 'Circos Genome Plotter';
    this.updateStatus('Ready');
  }

  showHelp() {
    document.getElementById('circosHelp').showModal();
  }

  toggle(id) {
    const control = document.getElementById(id);
    if (!control.disabled) control.click();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  try {
    const plotter = new CircosPlotter();
    window.circosPlotter = plotter;
    document.getElementById('circosFileInput').addEventListener('change', event => {
      const file = event.target.files[0];
      if (file) plotter.parseDataFile(file);
    });
    const actions = {
      'clear-plot': () => plotter.clearPlot(),
      'open-data': () => plotter.loadDataFile(),
      'load-current': () => plotter.loadCurrentGenomeData(),
      'export-data': () => plotter.exportData(),
      'export-svg': () => plotter.exportSVG(),
      'export-png': () => plotter.exportPNG(),
      'zoom-in': () => plotter.zoomBy(1.5),
      'zoom-out': () => plotter.zoomBy(1 / 1.5),
      'fit-to-window': () => plotter.resetZoom(),
      'toggle-parameters-panel': () => {
        const panel = document.getElementById('parametersPanel');
        document.getElementById(panel.classList.contains('collapsed') ? 'panelExpandBtn' : 'panelToggleBtn').click();
      },
      'toggle-genes': () => plotter.toggle('showGenesCheck'),
      'toggle-gc-content': () => plotter.toggle('showGCContentCheck'),
      'toggle-gc-skew': () => plotter.toggle('showGCSkewCheck'),
      'toggle-wig-data': () => plotter.toggle('showWigDataCheck'),
      refresh: () => (plotter.source === 'genome' ? plotter.loadCurrentGenomeData() : plotter.createPlot()),
      help: () => plotter.showHelp(),
    };
    window.electronAPI?.onCircosMenuAction(action => actions[action]?.());
  } catch (error) {
    document.getElementById('statusText').textContent = error.message;
    const loading = document.getElementById('loadingIndicator');
    if (loading) loading.textContent = 'Could not initialize Circos Genome Plotter.';
    console.error('Circos initialization failed:', error);
  }
});
