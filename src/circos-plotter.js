/**
 * Circos Genome Plotter - GenomeExplorer
 * A comprehensive circular genome visualization tool with AI-powered parameter control
 */

class CircosPlotter {
    constructor() {
        this.data = null;
        this.svg = null;
        this.width = 700;
        this.height = 700;
        this.radius = 250;
        this.innerRadiusRatio = 0.8;
        this.innerRadius = this.radius * this.innerRadiusRatio;
        this.chromosomeWidth = 12;
        this.gapAngle = 3;
        this.startAngle = 0;
        this.showLabels = true;
        this.showTicks = true;
        this.showGenes = true;
        this.showLinks = true;
        this.colorScheme = 'category10';
        this.backgroundColor = '#ffffff';
        this.strokeColor = '#ffffff';
        this.strokeWidth = 1;
        this.labelDistance = 25;
        this.geneHeight = 8;
        this.linkOpacity = 0.6;
        this.maxGenes = 200;
        this.maxLinks = 20;
        this.showGCContent = false;
        this.showGCSkew = false;
        this.showWigData = false;
        this.gcWindowSize = 10000;
        this.wigTrackHeight = 30;
        this.chromosomeOrder = 'default';
        
        // New track options
        this.showGCContent = false;
        this.showGCSkew = false;
        this.showWigData = false;
        this.gcWindowSize = 10000;
        this.wigTrackHeight = 30;
        this.chromosomeOrder = 'default'; // default, size, name, custom
        
        // Color schemes - using safe fallbacks
        this.colorSchemes = {
            category10: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'],
            rainbow: ['#ff0000', '#ff4000', '#ff8000', '#ffbf00', '#ffff00', '#bfff00', '#80ff00', '#40ff00', '#00ff00', '#00ff40', '#00ff80', '#00ffbf', '#00ffff', '#00bfff', '#0080ff', '#0040ff', '#0000ff', '#4000ff', '#8000ff', '#bf00ff', '#ff00ff', '#ff00bf', '#ff0080', '#ff0040'],
            blues: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b'],
            greens: ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#006d2c', '#00441b'],
            reds: ['#fff5f0', '#fee0d2', '#fcbba1', '#fc9272', '#fb6a4a', '#ef3b2c', '#cb181d', '#a50f15', '#67000d'],
            viridis: ['#440154', '#482777', '#3f4a8a', '#31678e', '#26838f', '#1f9d8a', '#6cce5a', '#b6de2b', '#fee825'],
            pastel: ['#fbb4ae', '#b3cde3', '#ccebc5', '#decbe4', '#fed9a6', '#ffffcc', '#e5d8bd', '#fddaec', '#f2f2f2'],
            dark: ['#1b9e77', '#d95f02', '#7570b3', '#e7298a', '#66a61e', '#e6ab02', '#a6761d', '#666666']
        };
        
        this.tracks = [];
        this.tooltip = null;
        
        // Initialize UI and check if successful
        if (!this.initializeUI()) {
            console.error('Failed to initialize UI');
            return;
        }
        
        this.setupEventListeners();
        this.calculateOptimalSize();
        this.loadExampleData();
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
            this.gapAngle = parseFloat(e.target.value);
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
        
        // Color controls
        document.getElementById('colorSchemeSelect').addEventListener('change', (e) => {
            this.colorScheme = e.target.value;
            this.redrawPlot();
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
            'gapValue': `${this.gapAngle}°`,
            'labelDistanceValue': `${this.labelDistance}px`,
            'strokeWidthValue': `${this.strokeWidth}px`,
            'geneHeightValue': `${this.geneHeight}px`,
            'linkOpacityValue': `${Math.round(this.linkOpacity * 100)}%`,
            'maxGenesValue': `${this.maxGenes}`,
            'maxLinksValue': `${this.maxLinks}`,
            'gcWindowValue': `${Math.round(this.gcWindowSize / 1000)}kb`,
            'wigHeightValue': `${this.wigTrackHeight}px`
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
        this.data.chromosomes.forEach((chr, chrIndex) => {
            const numGenes = Math.floor(Math.random() * 50) + 20; // 20-70 genes per chromosome
            for (let i = 0; i < numGenes; i++) {
                const start = Math.floor(Math.random() * (chr.length - 50000));
                const length = Math.floor(Math.random() * 10000) + 1000; // 1kb-11kb
                genes.push({
                    chromosome: chr.name,
                    start: start,
                    end: start + length,
                    name: `Gene_${chrIndex + 1}_${i + 1}`,
                    type: Math.random() > 0.7 ? 'non_coding' : 'protein_coding',
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
        
        // Create SVG with dynamic sizing
        this.svg = d3.select('#circosContainer')
            .append('svg')
            .attr('id', 'circos-svg')
            .attr('width', this.width)
            .attr('height', this.height)
            .style('background-color', this.backgroundColor);
        
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
        const totalGaps = this.data.chromosomes.length * this.gapAngle;
        const availableAngle = 360 - totalGaps;
        
        let currentAngle = 0;
        this.data.chromosomes.forEach(chr => {
            chr.startAngle = currentAngle;
            chr.endAngle = currentAngle + (chr.length / totalLength) * availableAngle;
            chr.midAngle = (chr.startAngle + chr.endAngle) / 2;
            currentAngle = chr.endAngle + this.gapAngle;
        });
    }

    drawChromosomes(g) {
        const arc = d3.arc()
            .innerRadius(this.innerRadius)
            .outerRadius(this.innerRadius + this.chromosomeWidth)
            .startAngle(d => d.startAngle * Math.PI / 180)
            .endAngle(d => d.endAngle * Math.PI / 180);
        
        const colors = this.colorSchemes[this.colorScheme];
        
        g.selectAll('.chromosome-arc')
            .data(this.data.chromosomes)
            .enter()
            .append('path')
            .attr('class', 'chromosome-arc')
            .attr('d', arc)
            .attr('fill', (d, i) => colors[i % colors.length])
            .attr('stroke', this.strokeColor)
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
                    .attr('y2', y2);
                
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
                        .text(`${(position / 1000000).toFixed(0)}M`);
                }
            }
        });
    }

    drawLabels(g) {
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
            .style('cursor', 'pointer')
            .on('click', (event, d) => {
                console.log(`Label clicked: ${d.name}`);
                this.updateStatus(`Chromosome ${d.name}: ${(d.length / 1000000).toFixed(1)} Mb, ${((d.endAngle - d.startAngle) / 360 * 100).toFixed(1)}% coverage`);
            });
    }

    drawGenesTrack(g) {
        if (!this.data.genes) return;
        
        const geneRadius = this.innerRadius + this.chromosomeWidth + 5;
        const geneHeight = this.geneHeight;
        
        this.data.genes.slice(0, 200).forEach(gene => { // Limit for performance
            const chr = this.data.chromosomes.find(c => c.name === gene.chromosome);
            if (!chr) return;
            
            const startAngle = chr.startAngle + (gene.start / chr.length) * (chr.endAngle - chr.startAngle);
            const endAngle = chr.startAngle + (gene.end / chr.length) * (chr.endAngle - chr.startAngle);
            
            const arc = d3.arc()
                .innerRadius(geneRadius)
                .outerRadius(geneRadius + geneHeight)
                .startAngle(startAngle * Math.PI / 180)
                .endAngle(endAngle * Math.PI / 180);
            
            g.append('path')
                .attr('d', arc)
                .attr('fill', gene.type === 'protein_coding' ? '#2ca02c' : gene.type === 'non_coding' ? '#ff7f0e' : '#d62728')
                .attr('opacity', 0.7)
                .style('cursor', 'pointer')
                .on('mouseover', (event) => {
                    this.showTooltip(event, `${gene.name}<br/>Type: ${gene.type}<br/>Position: ${gene.start.toLocaleString()}-${gene.end.toLocaleString()}`);
                })
                .on('mouseout', () => {
                    this.hideTooltip();
                });
        });
    }

    drawGCContentTrack(g, trackOffset) {
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
                .attr('stroke', '#ddd')
                .attr('stroke-width', 1)
                .attr('fill', 'none');
            
            // Draw GC content line
            g.append('path')
                .datum(gcData)
                .attr('d', line)
                .attr('stroke', '#2ca02c')
                .attr('stroke-width', 2)
                .attr('fill', 'none')
                .attr('opacity', 0.8);
        });
    }

    drawGCSkewTrack(g, trackOffset) {
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
                .attr('stroke', '#666')
                .attr('stroke-width', 1)
                .attr('fill', 'none');
            
            // Draw GC skew line
            g.append('path')
                .datum(skewData)
                .attr('d', line)
                .attr('stroke', '#d62728')
                .attr('stroke-width', 2)
                .attr('fill', 'none')
                .attr('opacity', 0.8);
        });
    }

    drawWigTrack(g, trackOffset) {
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
                .attr('fill', '#9467bd')
                .attr('opacity', 0.6);
        });
    }

    drawLinks(g) {
        if (!this.data.links) return;
        
        const linkGroup = g.append('g').attr('class', 'links');
        
        this.data.links.slice(0, 20).forEach(link => { // Limit for performance
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
            
            linkGroup.append('path')
                .attr('d', path.toString())
                .attr('class', 'link')
                .attr('stroke', d3.interpolateViridis(link.value))
                .attr('stroke-width', Math.max(1, link.value * 3))
                .attr('fill', 'none')
                .attr('opacity', 0.6)
                .style('cursor', 'pointer')
                .on('mouseover', (event) => {
                    this.showTooltip(event, `Link: ${link.source.chromosome} → ${link.target.chromosome}<br/>Strength: ${(link.value * 100).toFixed(1)}%`);
                })
                .on('mouseout', () => {
                    this.hideTooltip();
                });
        });
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
        this.radius = 250;
        this.innerRadiusRatio = 0.8;
        this.innerRadius = this.radius * this.innerRadiusRatio;
        this.chromosomeWidth = 12;
        this.gapAngle = 3;
        this.startAngle = 0;
        this.showLabels = true;
        this.showTicks = true;
        this.showGenes = true;
        this.showLinks = true;
        this.colorScheme = 'category10';
        this.backgroundColor = '#ffffff';
        this.strokeColor = '#ffffff';
        this.strokeWidth = 1;
        this.labelDistance = 25;
        this.geneHeight = 8;
        this.linkOpacity = 0.6;
        this.maxGenes = 200;
        this.maxLinks = 20;
        
        // Reset UI controls
        const controls = {
            'radiusSlider': 250,
            'innerRadiusSlider': 0.8,
            'startAngleSlider': 0,
            'chrWidthSlider': 12,
            'gapSlider': 3,
            'labelDistanceSlider': 25,
            'strokeWidthSlider': 1,
            'geneHeightSlider': 8,
            'linkOpacitySlider': 0.6,
            'maxGenesSlider': 200,
            'maxLinksSlider': 20,
            'showLabelsCheck': true,
            'showTicksCheck': true,
            'showGenesCheck': true,
            'showLinksCheck': true,
            'showGCContentCheck': false,
            'showGCSkewCheck': false,
            'showWigDataCheck': false,
            'gcWindowSlider': 10000,
            'wigHeightSlider': 30,
            'colorSchemeSelect': 'category10',
            'backgroundColorPicker': '#ffffff',
            'strokeColorPicker': '#ffffff',
            'chromosomeOrderSelect': 'default',
            'exportResolutionSelect': '1'
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