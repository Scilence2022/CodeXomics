/**
 * GenomeNavigationBar - Interactive ruler-style navigation for the genome viewer
 */
class GenomeNavigationBar {
    constructor(genomeBrowser) {
        this.genomeBrowser = genomeBrowser;
        this.container = null;
        this.canvas = null;
        this.ctx = null;
        this.isVisible = false;
        this.height = 60; // Height of the navigation bar
        this.majorTickHeight = 20;
        this.minorTickHeight = 10;
        this.labelOffset = 35;
        this.currentChromosome = null;
        this.sequenceLength = 0;
        
        this.initialize();
    }

    initialize() {
        this.createNavigationBar();
        this.setupEventListeners();
    }

    createNavigationBar() {
        // Create the navigation bar container
        this.container = document.createElement('div');
        this.container.id = 'genomeNavigationBar';
        this.container.className = 'genome-navigation-bar';
        this.container.style.display = 'none'; // Initially hidden
        
        // Create canvas for drawing the ruler
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'navigation-canvas';
        this.ctx = this.canvas.getContext('2d');
        
        // Set up canvas styling
        this.canvas.style.cursor = 'crosshair';
        this.canvas.style.display = 'block';
        this.canvas.style.width = '100%';
        this.canvas.style.height = `${this.height}px`;
        
        // Create position indicator
        this.positionIndicator = document.createElement('div');
        this.positionIndicator.className = 'position-indicator';
        
        // Create range indicator (shows current view)
        this.rangeIndicator = document.createElement('div');
        this.rangeIndicator.className = 'range-indicator';
        
        // Add tooltip for position display
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'navigation-tooltip';
        this.tooltip.style.display = 'none';
        
        // Assemble the navigation bar
        this.container.appendChild(this.canvas);
        this.container.appendChild(this.positionIndicator);
        this.container.appendChild(this.rangeIndicator);
        this.container.appendChild(this.tooltip);
        
        // Insert the navigation bar above the genome viewer
        const genomeViewerSection = document.getElementById('genomeViewerSection');
        if (genomeViewerSection) {
            genomeViewerSection.insertBefore(this.container, genomeViewerSection.firstChild);
        }
        
        console.log('GenomeNavigationBar: Navigation bar created and inserted');
    }

    setupEventListeners() {
        // Handle canvas resizing
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                this.resizeCanvas();
                this.draw();
            }
        });
        resizeObserver.observe(this.container);

        // Mouse events for navigation
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        this.canvas.addEventListener('dblclick', (e) => this.handleDoubleClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseenter', (e) => this.handleMouseEnter(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handleMouseLeave(e));
        
        // Keyboard navigation
        this.canvas.addEventListener('keydown', (e) => this.handleKeyDown(e));
        this.canvas.setAttribute('tabindex', '0');
        
        console.log('GenomeNavigationBar: Event listeners set up');
    }

    resizeCanvas() {
        const rect = this.container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = this.height * dpr;
        
        this.ctx.scale(dpr, dpr);
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = this.height + 'px';
    }

    show(chromosome, sequenceLength) {
        this.currentChromosome = chromosome;
        this.sequenceLength = sequenceLength;
        this.isVisible = true;
        
        this.container.style.display = 'block';
        this.resizeCanvas();
        this.draw();
        
        console.log(`GenomeNavigationBar: Showing navigation for ${chromosome} (${sequenceLength} bp)`);
    }

    hide() {
        this.isVisible = false;
        this.container.style.display = 'none';
        console.log('GenomeNavigationBar: Hidden');
    }

    update() {
        if (this.isVisible) {
            this.draw();
        }
    }

    draw() {
        if (!this.ctx || !this.isVisible || this.sequenceLength === 0) return;
        
        const width = this.canvas.width / (window.devicePixelRatio || 1);
        const height = this.height;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Set font and styles
        this.ctx.font = '11px Inter, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.strokeStyle = '#64748b';
        this.ctx.fillStyle = '#334155';
        this.ctx.lineWidth = 1;
        
        // Draw background
        this.ctx.fillStyle = '#f8fafc';
        this.ctx.fillRect(0, 0, width, height);
        
        // Calculate scale and tick intervals
        const scale = width / this.sequenceLength;
        const { majorInterval, minorInterval } = this.calculateTickIntervals();
        
        // Draw minor ticks
        this.ctx.strokeStyle = '#cbd5e1';
        this.ctx.lineWidth = 0.5;
        for (let pos = 0; pos <= this.sequenceLength; pos += minorInterval) {
            const x = pos * scale;
            this.ctx.beginPath();
            this.ctx.moveTo(x, height - this.minorTickHeight);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
        }
        
        // Draw major ticks and labels
        this.ctx.strokeStyle = '#64748b';
        this.ctx.fillStyle = '#334155';
        this.ctx.lineWidth = 1;
        
        for (let pos = 0; pos <= this.sequenceLength; pos += majorInterval) {
            const x = pos * scale;
            
            // Draw major tick
            this.ctx.beginPath();
            this.ctx.moveTo(x, height - this.majorTickHeight);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
            
            // Draw label
            const label = this.formatPosition(pos);
            this.ctx.fillText(label, x, this.labelOffset);
        }
        
        // Draw current view range indicator
        this.drawRangeIndicator();
        
        // Draw ruler border
        this.ctx.strokeStyle = '#cbd5e1';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(0, 0, width, height);
    }

    calculateTickIntervals() {
        const width = this.canvas.width / (window.devicePixelRatio || 1);
        const pixelsPerBp = width / this.sequenceLength;
        
        // Aim for ticks every 50-100 pixels
        const targetMajorPixels = 80;
        const targetMinorPixels = 20;
        
        const baseMajorInterval = targetMajorPixels / pixelsPerBp;
        const baseMinorInterval = targetMinorPixels / pixelsPerBp;
        
        // Round to nice numbers (powers of 10 * 1, 2, or 5)
        const majorInterval = this.roundToNiceNumber(baseMajorInterval);
        const minorInterval = this.roundToNiceNumber(baseMinorInterval);
        
        return { majorInterval, minorInterval };
    }

    roundToNiceNumber(value) {
        const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
        const normalized = value / magnitude;
        
        let nice;
        if (normalized <= 1) nice = 1;
        else if (normalized <= 2) nice = 2;
        else if (normalized <= 5) nice = 5;
        else nice = 10;
        
        return nice * magnitude;
    }

    formatPosition(position) {
        if (position === 0) return '0';
        
        if (position >= 1000000) {
            return (position / 1000000).toFixed(1) + 'M';
        } else if (position >= 1000) {
            return (position / 1000).toFixed(1) + 'K';
        } else {
            return position.toString();
        }
    }

    drawRangeIndicator() {
        if (!this.genomeBrowser.currentPosition) return;
        
        const width = this.canvas.width / (window.devicePixelRatio || 1);
        const scale = width / this.sequenceLength;
        
        const startX = this.genomeBrowser.currentPosition.start * scale;
        const endX = this.genomeBrowser.currentPosition.end * scale;
        const rangeWidth = endX - startX;
        
        // Draw highlighted range
        this.ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
        this.ctx.fillRect(startX, 0, rangeWidth, this.height);
        
        // Draw range borders
        this.ctx.strokeStyle = '#3b82f6';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(startX, 0);
        this.ctx.lineTo(startX, this.height);
        this.ctx.moveTo(endX, 0);
        this.ctx.lineTo(endX, this.height);
        this.ctx.stroke();
    }

    handleClick(e) {
        const position = this.getPositionFromEvent(e);
        if (position !== null) {
            this.navigateToPosition(position);
        }
    }

    handleDoubleClick(e) {
        const position = this.getPositionFromEvent(e);
        if (position !== null) {
            this.navigateToPositionAndZoom(position);
        }
    }

    handleMouseMove(e) {
        const position = this.getPositionFromEvent(e);
        if (position !== null) {
            this.showTooltip(e, position);
        }
    }

    handleMouseEnter(e) {
        this.tooltip.style.display = 'block';
    }

    handleMouseLeave(e) {
        this.tooltip.style.display = 'none';
    }

    handleKeyDown(e) {
        const currentRange = this.genomeBrowser.currentPosition.end - this.genomeBrowser.currentPosition.start;
        const step = Math.max(1, Math.floor(currentRange * 0.1));
        
        let newStart = this.genomeBrowser.currentPosition.start;
        
        switch(e.key) {
            case 'ArrowLeft':
                newStart = Math.max(0, this.genomeBrowser.currentPosition.start - step);
                break;
            case 'ArrowRight':
                newStart = Math.min(this.sequenceLength - currentRange, this.genomeBrowser.currentPosition.start + step);
                break;
            case 'Home':
                newStart = 0;
                break;
            case 'End':
                newStart = Math.max(0, this.sequenceLength - currentRange);
                break;
            default:
                return;
        }
        
        e.preventDefault();
        
        const newEnd = newStart + currentRange;
        this.genomeBrowser.currentPosition = { start: newStart, end: newEnd };
        this.genomeBrowser.updateStatistics(this.currentChromosome, this.genomeBrowser.currentSequence[this.currentChromosome]);
        this.genomeBrowser.displayGenomeView(this.currentChromosome, this.genomeBrowser.currentSequence[this.currentChromosome]);
    }

    getPositionFromEvent(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;
        
        if (x < 0 || x > width) return null;
        
        const position = Math.round((x / width) * this.sequenceLength);
        return Math.max(0, Math.min(this.sequenceLength, position));
    }

    showTooltip(e, position) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        
        this.tooltip.style.left = `${x}px`;
        this.tooltip.style.top = `${this.height + 5}px`;
        this.tooltip.textContent = `Position: ${position.toLocaleString()} bp`;
    }

    navigateToPosition(position) {
        // Center the view on the clicked position
        const currentRange = this.genomeBrowser.currentPosition ? 
            (this.genomeBrowser.currentPosition.end - this.genomeBrowser.currentPosition.start) : 
            Math.min(10000, this.sequenceLength);
        
        const newStart = Math.max(0, position - Math.floor(currentRange / 2));
        const newEnd = Math.min(this.sequenceLength, newStart + currentRange);
        
        this.genomeBrowser.currentPosition = { start: newStart, end: newEnd };
        
        // Update the display
        const sequence = this.genomeBrowser.currentSequence[this.currentChromosome];
        this.genomeBrowser.updateStatistics(this.currentChromosome, sequence);
        this.genomeBrowser.displayGenomeView(this.currentChromosome, sequence);
        
        console.log(`GenomeNavigationBar: Navigated to position ${position}`);
    }

    navigateToPositionAndZoom(position) {
        // Double-click zooms in and centers on position
        const zoomRange = Math.max(1000, this.sequenceLength * 0.01); // 1% of sequence or 1kb minimum
        
        const newStart = Math.max(0, position - Math.floor(zoomRange / 2));
        const newEnd = Math.min(this.sequenceLength, newStart + zoomRange);
        
        this.genomeBrowser.currentPosition = { start: newStart, end: newEnd };
        
        // Update the display
        const sequence = this.genomeBrowser.currentSequence[this.currentChromosome];
        this.genomeBrowser.updateStatistics(this.currentChromosome, sequence);
        this.genomeBrowser.displayGenomeView(this.currentChromosome, sequence);
        
        console.log(`GenomeNavigationBar: Zoomed to position ${position} with range ${zoomRange}`);
    }
} 