/**
 * Circos Genome Plotter - GenomeExplorer
 * A comprehensive circular genome visualization tool with AI-powered parameter control
 */

class CircosPlotter {
    constructor() {
        this.data = null;
        this.svg = null;
        this.width = 600;
        this.height = 600;
        this.radius = 250;
        this.innerRadius = this.radius - 50;
        this.chromosomeWidth = 10;
        this.gapAngle = 3;
        this.showLabels = true;
        this.showTicks = true;
        this.colorScheme = 'category10';
        
        // Color schemes - using safe fallbacks
        this.colorSchemes = {
            category10: d3.schemeCategory10 || ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'],
            rainbow: ['#ff0000', '#ff8000', '#ffff00', '#80ff00', '#00ff00', '#00ff80', '#00ffff', '#0080ff', '#0000ff', '#8000ff'],
            blues: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b'],
            greens: ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#006d2c', '#00441b'],
            reds: ['#fff5f0', '#fee0d2', '#fcbba1', '#fc9272', '#fb6a4a', '#ef3b2c', '#cb181d', '#a50f15', '#67000d'],
            viridis: ['#440154', '#482777', '#3f4a8a', '#31678e', '#26838f', '#1f9d8a', '#6cce5a', '#b6de2b', '#fee825']
        };
        
        this.tracks = [];
        this.tooltip = null;
        this.chatHistory = [];
        
        // Initialize UI and check if successful
        if (!this.initializeUI()) {
            console.error('Failed to initialize UI');
            return;
        }
        
        this.setupEventListeners();
        this.loadExampleData();
    }

    initializeUI() {
        // Check if required DOM elements exist
        const requiredElements = ['statusDot', 'statusText', 'tooltip', 'radiusValue', 'chrWidthValue', 'gapValue'];
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
        
        // Add initial system message
        this.addChatMessage('AI Assistant initialized. Ready to help with your Circos plot!', 'assistant');
        
        return true;
    }

    setupEventListeners() {
        // Toolbar buttons
        document.getElementById('loadDataBtn').addEventListener('click', () => this.loadDataFile());
        document.getElementById('exampleDataBtn').addEventListener('click', () => this.loadExampleData());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportSVG());
        document.getElementById('resetBtn').addEventListener('click', () => this.resetPlot());
        document.getElementById('helpBtn').addEventListener('click', () => this.showHelp());
        
        // Chat functionality
        document.getElementById('sendBtn').addEventListener('click', () => this.sendChatMessage());
        document.getElementById('chatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendChatMessage();
            }
        });
        
        // Parameter controls
        document.getElementById('radiusSlider').addEventListener('input', (e) => {
            this.radius = parseInt(e.target.value);
            this.innerRadius = this.radius - 50;
            this.updateParameterDisplays();
            this.redrawPlot();
        });
        
        document.getElementById('chrWidthSlider').addEventListener('input', (e) => {
            this.chromosomeWidth = parseInt(e.target.value);
            this.updateParameterDisplays();
            this.redrawPlot();
        });
        
        document.getElementById('gapSlider').addEventListener('input', (e) => {
            this.gapAngle = parseInt(e.target.value);
            this.updateParameterDisplays();
            this.redrawPlot();
        });
        
        document.getElementById('showLabelsCheck').addEventListener('change', (e) => {
            this.showLabels = e.target.checked;
            this.redrawPlot();
        });
        
        document.getElementById('showTicksCheck').addEventListener('change', (e) => {
            this.showTicks = e.target.checked;
            this.redrawPlot();
        });
        
        document.getElementById('colorSchemeSelect').addEventListener('change', (e) => {
            this.colorScheme = e.target.value;
            this.redrawPlot();
        });
    }

    updateParameterDisplays() {
        document.getElementById('radiusValue').textContent = `${this.radius}px`;
        document.getElementById('chrWidthValue').textContent = `${this.chromosomeWidth}px`;
        document.getElementById('gapValue').textContent = `${this.gapAngle}°`;
    }

    loadExampleData() {
        // Generate example genome data (simplified human chromosomes)
        this.data = {
            chromosomes: [
                { name: 'chr1', length: 249250621, color: '#1f77b4' },
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
        this.data.genes = this.generateExampleGenes();
        this.data.links = this.generateExampleLinks();
        
        this.addChatMessage('Example human genome data loaded successfully! 24 chromosomes with sample genes and links.', 'assistant');
        this.createPlot();
    }

    generateExampleGenes() {
        const genes = [];
        this.data.chromosomes.forEach((chr, chrIndex) => {
            // Generate random genes for each chromosome
            const numGenes = Math.floor(chr.length / 1000000) + Math.random() * 50;
            for (let i = 0; i < numGenes; i++) {
                const start = Math.floor(Math.random() * chr.length);
                const end = start + Math.floor(Math.random() * 50000) + 1000;
                genes.push({
                    chromosome: chr.name,
                    start: start,
                    end: Math.min(end, chr.length),
                    name: `Gene_${chrIndex}_${i}`,
                    value: Math.random(),
                    type: ['protein_coding', 'non_coding', 'pseudogene'][Math.floor(Math.random() * 3)]
                });
            }
        });
        return genes;
    }

    generateExampleLinks() {
        const links = [];
        const numLinks = 50;
        
        for (let i = 0; i < numLinks; i++) {
            const chr1 = this.data.chromosomes[Math.floor(Math.random() * this.data.chromosomes.length)];
            const chr2 = this.data.chromosomes[Math.floor(Math.random() * this.data.chromosomes.length)];
            
            links.push({
                source: {
                    chromosome: chr1.name,
                    start: Math.floor(Math.random() * chr1.length),
                    end: Math.floor(Math.random() * chr1.length)
                },
                target: {
                    chromosome: chr2.name,
                    start: Math.floor(Math.random() * chr2.length),
                    end: Math.floor(Math.random() * chr2.length)
                },
                value: Math.random()
            });
        }
        
        return links;
    }

    createPlot() {
        // Clear previous plot
        d3.select('#circosContainer').selectAll('*').remove();
        
        // Create SVG
        this.svg = d3.select('#circosContainer')
            .append('svg')
            .attr('id', 'circos-svg')
            .attr('width', this.width)
            .attr('height', this.height);
        
        const g = this.svg.append('g')
            .attr('transform', `translate(${this.width/2}, ${this.height/2})`);
        
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
        
        // Draw genes track
        this.drawGenesTrack(g);
        
        // Draw links
        this.drawLinks(g);
        
        // Update status
        document.getElementById('statusText').textContent = `Plotted ${this.data.chromosomes.length} chromosomes`;
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
            .attr('stroke', '#fff')
            .attr('stroke-width', 1)
            .style('cursor', 'pointer')
            .on('mouseover', (event, d) => {
                this.showTooltip(event, `${d.name}<br/>Length: ${d.length.toLocaleString()} bp`);
            })
            .on('mouseout', () => {
                this.hideTooltip();
            })
            .on('click', (event, d) => {
                this.addChatMessage(`Clicked on ${d.name} (${d.length.toLocaleString()} bp)`, 'user');
                this.addChatMessage(`${d.name} is ${(d.length / 1000000).toFixed(1)} Mb long. This chromosome spans ${(d.endAngle - d.startAngle).toFixed(1)}° in the plot.`, 'assistant');
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
                const labelRadius = this.innerRadius + this.chromosomeWidth + 20;
                const x = Math.cos(radians) * labelRadius;
                const y = Math.sin(radians) * labelRadius;
                return `translate(${x}, ${y}) rotate(${angle > 90 && angle < 270 ? angle + 180 : angle})`;
            })
            .text(d => d.name)
            .style('cursor', 'pointer')
            .on('click', (event, d) => {
                this.addChatMessage(`Tell me about ${d.name}`, 'user');
                this.addChatMessage(`${d.name} is one of the human chromosomes. It contains ${(d.length / 1000000).toFixed(1)} million base pairs and represents ${((d.endAngle - d.startAngle) / 360 * 100).toFixed(1)}% of the genome in this visualization.`, 'assistant');
            });
    }

    drawGenesTrack(g) {
        if (!this.data.genes) return;
        
        const geneRadius = this.innerRadius + this.chromosomeWidth + 5;
        const geneHeight = 8;
        
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

    // Chat functionality
    sendChatMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        
        if (!message) return;
        
        this.addChatMessage(message, 'user');
        input.value = '';
        
        // Process AI command
        this.processAICommand(message);
    }

    addChatMessage(message, sender) {
        const messagesContainer = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        messageDiv.innerHTML = message;
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // Store in history
        this.chatHistory.push({ message, sender, timestamp: new Date() });
    }

    processAICommand(command) {
        const lowerCommand = command.toLowerCase();
        
        // Radius adjustments
        if (lowerCommand.includes('radius')) {
            const match = lowerCommand.match(/(\d+)/);
            if (match) {
                const newRadius = parseInt(match[1]);
                if (newRadius >= 150 && newRadius <= 400) {
                    this.radius = newRadius;
                    this.innerRadius = this.radius - 50;
                    document.getElementById('radiusSlider').value = newRadius;
                    this.updateParameterDisplays();
                    this.redrawPlot();
                    this.addChatMessage(`✅ Updated plot radius to ${newRadius}px`, 'assistant');
                } else {
                    this.addChatMessage(`❌ Radius must be between 150 and 400 pixels. You requested ${newRadius}px.`, 'assistant');
                }
            }
        }
        // Chromosome width adjustments
        else if (lowerCommand.includes('chromosome width') || lowerCommand.includes('chr width')) {
            const match = lowerCommand.match(/(\d+)/);
            if (match) {
                const newWidth = parseInt(match[1]);
                if (newWidth >= 5 && newWidth <= 20) {
                    this.chromosomeWidth = newWidth;
                    document.getElementById('chrWidthSlider').value = newWidth;
                    this.updateParameterDisplays();
                    this.redrawPlot();
                    this.addChatMessage(`✅ Updated chromosome width to ${newWidth}px`, 'assistant');
                } else {
                    this.addChatMessage(`❌ Chromosome width must be between 5 and 20 pixels.`, 'assistant');
                }
            }
        }
        // Color scheme changes
        else if (lowerCommand.includes('color')) {
            if (lowerCommand.includes('rainbow')) {
                this.colorScheme = 'rainbow';
                document.getElementById('colorSchemeSelect').value = 'rainbow';
                this.redrawPlot();
                this.addChatMessage(`🌈 Changed to rainbow color scheme!`, 'assistant');
            } else if (lowerCommand.includes('blue')) {
                this.colorScheme = 'blues';
                document.getElementById('colorSchemeSelect').value = 'blues';
                this.redrawPlot();
                this.addChatMessage(`🔵 Changed to blue color scheme!`, 'assistant');
            } else if (lowerCommand.includes('green')) {
                this.colorScheme = 'greens';
                document.getElementById('colorSchemeSelect').value = 'greens';
                this.redrawPlot();
                this.addChatMessage(`🟢 Changed to green color scheme!`, 'assistant');
            } else if (lowerCommand.includes('red')) {
                this.colorScheme = 'reds';
                document.getElementById('colorSchemeSelect').value = 'reds';
                this.redrawPlot();
                this.addChatMessage(`🔴 Changed to red color scheme!`, 'assistant');
            } else if (lowerCommand.includes('viridis')) {
                this.colorScheme = 'viridis';
                document.getElementById('colorSchemeSelect').value = 'viridis';
                this.redrawPlot();
                this.addChatMessage(`💜 Changed to viridis color scheme!`, 'assistant');
            }
        }
        // Label and tick toggles
        else if (lowerCommand.includes('hide labels') || lowerCommand.includes('remove labels')) {
            this.showLabels = false;
            document.getElementById('showLabelsCheck').checked = false;
            this.redrawPlot();
            this.addChatMessage(`👁️ Hidden chromosome labels`, 'assistant');
        }
        else if (lowerCommand.includes('show labels')) {
            this.showLabels = true;
            document.getElementById('showLabelsCheck').checked = true;
            this.redrawPlot();
            this.addChatMessage(`👁️ Showing chromosome labels`, 'assistant');
        }
        else if (lowerCommand.includes('hide ticks') || lowerCommand.includes('remove ticks')) {
            this.showTicks = false;
            document.getElementById('showTicksCheck').checked = false;
            this.redrawPlot();
            this.addChatMessage(`📏 Hidden ticks`, 'assistant');
        }
        else if (lowerCommand.includes('show ticks')) {
            this.showTicks = true;
            document.getElementById('showTicksCheck').checked = true;
            this.redrawPlot();
            this.addChatMessage(`📏 Showing ticks`, 'assistant');
        }
        // Export commands
        else if (lowerCommand.includes('export') || lowerCommand.includes('save')) {
            this.exportSVG();
            this.addChatMessage(`💾 Exported SVG file!`, 'assistant');
        }
        // Help and information
        else if (lowerCommand.includes('help') || lowerCommand.includes('commands')) {
            this.addChatMessage(`🤖 Available commands:
            
• "Change radius to [number]" - Adjust plot radius
• "Set chromosome width to [number]" - Adjust chromosome width  
• "Use rainbow/blue/green/red/viridis colors" - Change color scheme
• "Show/hide labels" - Toggle chromosome labels
• "Show/hide ticks" - Toggle tick marks
• "Export" or "Save" - Export as SVG
• "Load example" - Load sample data
• "Reset" - Reset to defaults

Try clicking on chromosomes and genes for more info!`, 'assistant');
        }
        // Default response
        else {
            this.addChatMessage(`🤔 I didn't understand that command. Try "help" to see available commands, or click on plot elements for information.`, 'assistant');
        }
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
                this.addChatMessage(`📁 Loaded data from ${file.name}`, 'assistant');
            } catch (error) {
                this.addChatMessage(`❌ Error loading file: ${error.message}`, 'assistant');
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
        this.radius = 250;
        this.innerRadius = 200;
        this.chromosomeWidth = 10;
        this.gapAngle = 3;
        this.showLabels = true;
        this.showTicks = true;
        this.colorScheme = 'category10';
        
        // Reset UI controls
        document.getElementById('radiusSlider').value = 250;
        document.getElementById('chrWidthSlider').value = 10;
        document.getElementById('gapSlider').value = 3;
        document.getElementById('showLabelsCheck').checked = true;
        document.getElementById('showTicksCheck').checked = true;
        document.getElementById('colorSchemeSelect').value = 'category10';
        
        this.updateParameterDisplays();
        this.redrawPlot();
        this.addChatMessage(`🔄 Reset plot to default parameters`, 'assistant');
    }

    showHelp() {
        this.addChatMessage(`📚 Circos Genome Plotter Help:

**Data Loading:**
• Click "Load Data" to upload CSV/JSON files
• Click "Load Example" for sample human genome data

**Plot Interaction:**
• Click chromosomes for information
• Hover over elements for tooltips
• Use mouse to explore genes and links

**AI Commands:**
• Type natural language commands in the chat
• Try "change radius to 300" or "use rainbow colors"
• Ask "help" for a full list of commands

**Export:**
• Click "Export SVG" or type "export" in chat
• High-resolution vector graphics suitable for publications

**Parameters:**
• Use sliders for quick adjustments
• AI chat for precise control
• Real-time updates as you change settings`, 'assistant');
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