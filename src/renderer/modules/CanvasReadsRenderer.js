/**
 * CanvasReadsRenderer - High-performance Canvas-based aligned reads renderer
 * Replaces SVG-based rendering for significant performance improvements
 */
class CanvasReadsRenderer {
    constructor(container, readRows, viewport, options = {}) {
        this.container = container;
        this.readRows = readRows;
        this.viewport = viewport;
        this.options = {
            readHeight: 14,
            rowSpacing: 2,
            topPadding: 10,
            bottomPadding: 10,
            showSequences: false,
            showReference: true,
            autoFontSize: true,
            minFontSize: 8,
            maxFontSize: 14,
            qualityColoring: true,
            strandColoring: true,
            mismatchHighlight: true,
            showCoverage: false,
            backgroundColor: 'transparent',
            ...options
        };
        
        // Read rendering colors (use options if provided, otherwise defaults)
        this.readColors = {
            forward: this.options.forwardColor || '#4285F4',      // Blue for forward reads
            reverse: this.options.reverseColor || '#EA4335',      // Red for reverse reads
            forwardPaired: this.options.pairedColor || '#34A853', // Green for forward paired
            reversePaired: this.options.pairedColor || '#FBBC05', // Yellow for reverse paired
            unpaired: '#9AA0A6',     // Gray for unpaired
            lowQuality: '#F4B400',   // Orange for low quality
            duplicate: '#9C27B0',    // Purple for duplicates
            secondary: '#607D8B'     // Blue-gray for secondary
        };
        
        // Base colors for sequence display
        this.baseColors = {
            'A': '#e74c3c', 'T': '#3498db', 'G': '#2ecc71', 'C': '#f39c12',
            'a': '#e74c3c', 't': '#3498db', 'g': '#2ecc71', 'c': '#f39c12',
            'N': '#95a5a6', 'n': '#95a5a6'
        };
        
        // Mismatch highlighting
        this.mismatchColor = this.options.mismatchColor || '#ff6b6b';
        
        // Canvas and rendering context
        this.canvas = null;
        this.ctx = null;
        this.devicePixelRatio = window.devicePixelRatio || 1;
        
        // Rendering metrics
        this.canvasWidth = 0;
        this.canvasHeight = 0;
        this.charWidth = 0;
        this.charHeight = 0;
        this.actualFontSize = 0;
        
        // Performance tracking
        this.renderCount = 0;
        this.lastRenderTime = 0;
        
        this.initialize();
    }
    
    initialize() {
        console.log('🎨 [CanvasReadsRenderer] Initializing Canvas reads renderer');
        
        // Calculate total height needed
        const totalRows = this.readRows.length;
        const totalHeight = this.options.topPadding + 
                           (totalRows * (this.options.readHeight + this.options.rowSpacing)) + 
                           this.options.bottomPadding;
        
        // Create canvas element
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'reads-canvas';
        this.canvas.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: ${totalHeight}px;
            display: block;
            image-rendering: crisp-edges;
            image-rendering: pixelated;
            z-index: 10;
            background: transparent;
        `;
        
        // Get 2D context with alpha for transparency
        this.ctx = this.canvas.getContext('2d', { alpha: true });
        
        // Setup canvas container
        this.setupContainer();
        
        // Setup canvas dimensions
        this.setupCanvas();
        
        // Calculate text metrics if sequences will be shown
        if (this.options.showSequences) {
            this.calculateTextMetrics();
        }
        
        // Setup resize observer for responsive updates
        this.setupResizeObserver();
        
        // Note: Don't render immediately in constructor - wait for explicit render() call
        
        console.log('✅ [CanvasReadsRenderer] Canvas reads renderer initialized successfully');
    }
    
    setupContainer() {
        // Apply container styles for Canvas rendering
        this.container.style.cssText = `
            position: relative;
            width: 100%;
            height: auto;
            overflow: hidden;
            background: ${this.options.backgroundColor};
        `;
        
        // Append canvas to container
        this.container.appendChild(this.canvas);
    }
    
    setupCanvas() {
        // Get container dimensions
        const containerRect = this.container.getBoundingClientRect();
        this.canvasWidth = Math.max(containerRect.width, 800);
        
        // Calculate canvas height based on read rows
        const totalRows = this.readRows.length;
        this.canvasHeight = this.options.topPadding + 
                           (totalRows * (this.options.readHeight + this.options.rowSpacing)) + 
                           this.options.bottomPadding;
        
        // Set canvas size accounting for device pixel ratio
        this.canvas.width = this.canvasWidth * this.devicePixelRatio;
        this.canvas.height = this.canvasHeight * this.devicePixelRatio;
        
        // Scale CSS size back to logical pixels
        this.canvas.style.width = this.canvasWidth + 'px';
        this.canvas.style.height = this.canvasHeight + 'px';
        
        // Scale context for crisp rendering on high-DPI displays
        this.ctx.scale(this.devicePixelRatio, this.devicePixelRatio);
        
        // Update container height to match canvas
        this.container.style.height = this.canvasHeight + 'px';
        
        console.log('🖼️ [CanvasReadsRenderer] Canvas setup:', {
            canvasWidth: this.canvasWidth,
            canvasHeight: this.canvasHeight,
            devicePixelRatio: this.devicePixelRatio,
            totalRows: this.readRows.length
        });
    }
    
    calculateTextMetrics() {
        // Set font for text measurement
        this.actualFontSize = this.options.autoFontSize ? 
            this.calculateOptimalFontSize() : this.options.maxFontSize;
        
        this.ctx.font = `${this.actualFontSize}px 'Courier New', monospace`;
        
        // Measure character dimensions
        const metrics = this.ctx.measureText('M');
        this.charWidth = metrics.width;
        this.charHeight = this.actualFontSize * 1.2; // Approximate height
        
        console.log('📏 [CanvasReadsRenderer] Text metrics:', {
            fontSize: this.actualFontSize,
            charWidth: this.charWidth.toFixed(2),
            charHeight: this.charHeight.toFixed(2)
        });
    }
    
    calculateOptimalFontSize() {
        const viewportRange = this.viewport.end - this.viewport.start;
        const availableWidth = this.canvasWidth * 0.9; // Use 90% of width
        const maxCharWidth = availableWidth / viewportRange;
        
        // Calculate font size that would fit
        let fontSize = this.options.maxFontSize;
        let testCharWidth = fontSize * 0.6; // Monospace approximation
        
        while (testCharWidth > maxCharWidth && fontSize > this.options.minFontSize) {
            fontSize -= 0.5;
            testCharWidth = fontSize * 0.6;
        }
        
        return Math.max(this.options.minFontSize, Math.min(this.options.maxFontSize, fontSize));
    }
    
    render() {
        const startTime = performance.now();
        this.renderCount++;
        
        console.log('🎨 [CanvasReadsRenderer] Starting render:', {
            readRows: this.readRows.length,
            totalReads: this.readRows.reduce((sum, row) => sum + row.length, 0),
            canvasSize: `${this.canvasWidth}x${this.canvasHeight}`,
            viewport: `${this.viewport.start}-${this.viewport.end}`
        });
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
        
        // Draw a test rectangle to verify Canvas is working
        this.ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        this.ctx.fillRect(0, 0, 100, 20);
        this.ctx.fillStyle = '#000';
        this.ctx.font = '12px Arial';
        this.ctx.fillText('Canvas Test', 5, 15);
        
        // Render reference sequence if enabled
        if (this.options.showReference) {
            this.renderReferenceSequence();
        }
        
        // Render coverage visualization if enabled
        if (this.options.showCoverage) {
            this.renderCoverage();
        }
        
        // Render read rows
        this.readRows.forEach((rowReads, rowIndex) => {
            console.log(`🎨 [CanvasReadsRenderer] Rendering row ${rowIndex} with ${rowReads.length} reads`);
            this.renderReadRow(rowReads, rowIndex);
        });
        
        // Performance tracking
        this.lastRenderTime = performance.now() - startTime;
        
        if (this.renderCount % 50 === 0) {
            console.log('⚡ [CanvasReadsRenderer] Performance stats:', {
                renderCount: this.renderCount,
                lastRenderTime: this.lastRenderTime.toFixed(2) + 'ms',
                totalReads: this.readRows.reduce((sum, row) => sum + row.length, 0),
                avgRenderTime: (this.lastRenderTime / this.readRows.reduce((sum, row) => sum + row.length, 0) * 1000).toFixed(3) + 'μs per read'
            });
        }
    }
    
    renderReferenceSequence() {
        // Reference sequence rendering would need access to the reference genome
        // This is a placeholder for future implementation
        const y = 5;
        this.ctx.fillStyle = '#666';
        this.ctx.font = `10px 'Courier New', monospace`;
        this.ctx.fillText('Reference sequence (placeholder)', 10, y);
    }
    
    renderCoverage() {
        // Coverage visualization placeholder
        // Would calculate read depth at each position
        const coverageHeight = 30;
        const y = this.options.showReference ? 20 : 5;
        
        this.ctx.fillStyle = 'rgba(100, 149, 237, 0.3)';
        this.ctx.fillRect(0, y, this.canvasWidth, coverageHeight);
        
        this.ctx.fillStyle = '#666';
        this.ctx.font = `10px 'Courier New', monospace`;
        this.ctx.fillText('Coverage visualization (placeholder)', 10, y + 15);
    }
    
    renderReadRow(rowReads, rowIndex) {
        const y = this.options.topPadding + (rowIndex * (this.options.readHeight + this.options.rowSpacing));
        
        rowReads.forEach(read => {
            this.renderRead(read, y);
        });
    }
    
    renderRead(read, y) {
        // Calculate read position and dimensions
        const readStart = Math.max(read.pos, this.viewport.start);
        const readEnd = Math.min(read.pos + read.sequence.length, this.viewport.end);
        
        if (readEnd <= readStart) return; // Read not visible
        
        // Calculate screen coordinates
        const viewportRange = this.viewport.end - this.viewport.start;
        const x = ((readStart - this.viewport.start) / viewportRange) * this.canvasWidth;
        const width = ((readEnd - readStart) / viewportRange) * this.canvasWidth;
        
        // Skip reads that are too narrow to see
        if (width < 1) return;
        
        // Determine read color based on properties
        const readColor = this.getReadColor(read);
        
        // Draw read rectangle
        this.ctx.fillStyle = readColor;
        this.ctx.fillRect(x, y, width, this.options.readHeight);
        
        // Draw read border for better visibility
        this.ctx.strokeStyle = this.darkenColor(readColor, 0.2);
        this.ctx.lineWidth = 0.5;
        this.ctx.strokeRect(x, y, width, this.options.readHeight);
        
        // Draw sequence if enabled and zoom level allows
        if (this.options.showSequences && this.shouldShowSequenceDetails(width)) {
            this.renderReadSequence(read, x, y, width);
        }
        
        // Highlight mismatches if enabled
        if (this.options.mismatchHighlight && read.mismatches) {
            this.renderMismatches(read, x, y, width);
        }
    }
    
    getReadColor(read) {
        // Color reads based on strand and pairing information
        if (this.options.qualityColoring && read.mapq !== undefined && read.mapq < 20) {
            return this.readColors.lowQuality;
        }
        
        if (read.flag !== undefined) {
            // SAM flag interpretation
            const isReverse = (read.flag & 0x10) !== 0;
            const isPaired = (read.flag & 0x1) !== 0;
            const isDuplicate = (read.flag & 0x400) !== 0;
            const isSecondary = (read.flag & 0x100) !== 0;
            
            if (isDuplicate) return this.readColors.duplicate;
            if (isSecondary) return this.readColors.secondary;
            
            if (this.options.strandColoring) {
                if (isPaired) {
                    return isReverse ? this.readColors.reversePaired : this.readColors.forwardPaired;
                } else {
                    return isReverse ? this.readColors.reverse : this.readColors.forward;
                }
            }
        }
        
        // Default coloring based on strand
        return read.strand === '-' ? this.readColors.reverse : this.readColors.forward;
    }
    
    shouldShowSequenceDetails(readWidth) {
        // Show sequence details if read is wide enough and font size is reasonable
        return readWidth > 50 && this.actualFontSize >= this.options.minFontSize;
    }
    
    renderReadSequence(read, x, y, width) {
        if (!read.sequence || !this.charWidth) return;
        
        const sequence = read.sequence;
        const charSpacing = width / sequence.length;
        
        // Only render if characters won't be too cramped
        if (charSpacing < this.charWidth * 0.5) return;
        
        this.ctx.font = `${this.actualFontSize}px 'Courier New', monospace`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        const textY = y + this.options.readHeight / 2;
        
        for (let i = 0; i < sequence.length; i++) {
            const base = sequence[i];
            const baseX = x + (i * charSpacing) + (charSpacing / 2);
            
            // Set base color
            this.ctx.fillStyle = this.baseColors[base] || this.baseColors['N'];
            
            // Render character
            this.ctx.fillText(base, baseX, textY);
        }
    }
    
    renderMismatches(read, x, y, width) {
        if (!read.mismatches) return;
        
        // Highlight mismatch positions
        read.mismatches.forEach(mismatch => {
            const mismatchPos = mismatch.pos - read.pos;
            if (mismatchPos >= 0 && mismatchPos < read.sequence.length) {
                const mismatchX = x + (mismatchPos / read.sequence.length) * width;
                const mismatchWidth = Math.max(2, width / read.sequence.length);
                
                this.ctx.fillStyle = this.mismatchColor;
                this.ctx.fillRect(mismatchX, y - 1, mismatchWidth, this.options.readHeight + 2);
            }
        });
    }
    
    darkenColor(color, factor) {
        // Simple color darkening function
        if (color.startsWith('#')) {
            const r = parseInt(color.slice(1, 3), 16);
            const g = parseInt(color.slice(3, 5), 16);
            const b = parseInt(color.slice(5, 7), 16);
            
            return `rgb(${Math.floor(r * (1 - factor))}, ${Math.floor(g * (1 - factor))}, ${Math.floor(b * (1 - factor))})`;
        }
        return color;
    }
    
    setupResizeObserver() {
        if (typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver((entries) => {
                for (let entry of entries) {
                    if (entry.target === this.container) {
                        this.handleResize();
                    }
                }
            });
            
            this.resizeObserver.observe(this.container);
        } else {
            // Fallback to window resize
            this.resizeHandler = () => this.handleResize();
            window.addEventListener('resize', this.resizeHandler);
        }
    }
    
    handleResize() {
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }
        
        this.resizeTimeout = setTimeout(() => {
            console.log('🔄 [CanvasReadsRenderer] Handling resize');
            this.setupCanvas();
            if (this.options.showSequences) {
                this.calculateTextMetrics();
            }
            this.render();
        }, 100);
    }
    
    // High-performance drag transform
    applyDragTransform(deltaX, deltaY = 0) {
        this.canvas.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    }
    
    resetDragTransform() {
        this.canvas.style.transform = '';
    }
    
    // Update with new read data
    updateReads(newReadRows, newViewport = null) {
        console.log('🔄 [CanvasReadsRenderer] Updating reads data');
        
        this.readRows = newReadRows;
        if (newViewport) {
            this.viewport = newViewport;
        }
        
        // Recalculate canvas size if needed
        this.setupCanvas();
        
        // Recalculate text metrics if showing sequences
        if (this.options.showSequences) {
            this.calculateTextMetrics();
        }
        
        // Re-render with new data
        this.render();
    }
    
    // Update rendering options
    updateOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
        
        // Recalculate metrics if font options changed
        if (newOptions.showSequences !== undefined || 
            newOptions.autoFontSize !== undefined ||
            newOptions.minFontSize !== undefined ||
            newOptions.maxFontSize !== undefined) {
            this.calculateTextMetrics();
        }
        
        this.render();
    }
    
    // Get performance statistics
    getPerformanceStats() {
        const totalReads = this.readRows.reduce((sum, row) => sum + row.length, 0);
        return {
            renderCount: this.renderCount,
            lastRenderTime: this.lastRenderTime,
            avgTimePerRead: totalReads > 0 ? this.lastRenderTime / totalReads : 0,
            canvasSize: `${this.canvas.width}x${this.canvas.height}`,
            totalReads: totalReads,
            totalRows: this.readRows.length
        };
    }
    
    // Clean up resources
    destroy() {
        console.log('🧹 [CanvasReadsRenderer] Cleaning up Canvas reads renderer');
        
        // Remove resize observer/handler
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        } else if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
        }
        
        // Clear timeouts
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }
        
        // Clear canvas
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        // Remove canvas from DOM
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
        
        // Reset references
        this.canvas = null;
        this.ctx = null;
        this.container = null;
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CanvasReadsRenderer;
} else if (typeof window !== 'undefined') {
    window.CanvasReadsRenderer = CanvasReadsRenderer;
}