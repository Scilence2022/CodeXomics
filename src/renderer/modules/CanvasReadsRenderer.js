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
        
        // Click detection data
        this.readPositions = []; // Store rendered read positions for click detection
        
        this.initialize();
    }
    
    initialize() {
        console.log('🎨 [CanvasReadsRenderer] Initializing Canvas reads renderer');
        
        // Calculate total height needed including reference and coverage space
        const totalRows = this.readRows.length;
        let totalHeight = this.options.topPadding;
        
        // Add space for reference sequence if enabled
        if (this.options.showReference) {
            totalHeight += 20; // Reference sequence height + spacing
        }
        
        // Add space for coverage if enabled
        if (this.options.showCoverage) {
            totalHeight += 35; // Coverage height + spacing
        }
        
        // Add space for reads
        totalHeight += (totalRows * (this.options.readHeight + this.options.rowSpacing)) + 
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
            z-index: 50;
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
        
        // Setup click event listener for read selection
        this.setupClickHandlers();
    }
    
    setupCanvas() {
        // Get container dimensions
        const containerRect = this.container.getBoundingClientRect();
        this.canvasWidth = Math.max(containerRect.width, 800);
        
        // Calculate canvas height based on read rows plus reference/coverage space
        const totalRows = this.readRows.length;
        let totalHeight = this.options.topPadding;
        
        // Add space for reference sequence if enabled
        if (this.options.showReference) {
            totalHeight += 20; // Reference sequence height + spacing
        }
        
        // Add space for coverage if enabled
        if (this.options.showCoverage) {
            totalHeight += 35; // Coverage height + spacing
        }
        
        // Add space for reads
        totalHeight += (totalRows * (this.options.readHeight + this.options.rowSpacing)) + 
                      this.options.bottomPadding;
                      
        this.canvasHeight = totalHeight;
        
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
    
    setupClickHandlers() {
        console.log('🖱️ [CanvasReadsRenderer] Setting up click handlers');
        
        // Bind event handlers to preserve 'this' context
        this.clickHandler = (event) => this.handleCanvasClick(event);
        this.mouseMoveHandler = (event) => {
            const read = this.getReadAtPosition(event);
            this.canvas.style.cursor = read ? 'pointer' : 'default';
        };
        
        // Add event listeners to canvas
        this.canvas.addEventListener('click', this.clickHandler);
        this.canvas.addEventListener('mousemove', this.mouseMoveHandler);
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
        
        // Clear read positions for click detection
        this.readPositions = [];
        
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
        // Calculate Y position accounting for reference sequence and coverage
        let yOffset = this.options.topPadding;
        
        // Add space for reference sequence if enabled
        if (this.options.showReference) {
            yOffset += 20; // Reference sequence height + spacing
        }
        
        // Add space for coverage if enabled  
        if (this.options.showCoverage) {
            yOffset += 35; // Coverage height + spacing
        }
        
        const y = yOffset + (rowIndex * (this.options.readHeight + this.options.rowSpacing));
        
        rowReads.forEach(read => {
            this.renderRead(read, y);
        });
    }
    
    renderRead(read, y) {
        // Calculate read position and dimensions - match SVG logic for consistency
        const readStart = Math.max(read.start, this.viewport.start);
        const readEnd = Math.min(read.end, this.viewport.end); // Use read.end directly like SVG
        
        if (readEnd <= readStart) return; // Read not visible
        
        // Calculate screen coordinates
        const viewportRange = this.viewport.end - this.viewport.start;
        const x = ((readStart - this.viewport.start) / viewportRange) * this.canvasWidth;
        let width = ((readEnd - readStart) / viewportRange) * this.canvasWidth;
        
        // Ensure minimum width like SVG - don't filter out narrow reads, just make them visible
        const minWidth = this.options.minWidth || 2;
        width = Math.max(width, minWidth);
        
        // Determine read color based on properties
        const readColor = this.getReadColor(read);
        
        // Store read position for click detection
        this.readPositions.push({
            read: read,
            x: x,
            y: y,
            width: width,
            height: this.options.readHeight
        });
        
        // GUARANTEED VISIBILITY APPROACH: Always ensure something is rendered
        // This eliminates any possibility of reads disappearing during zoom transitions
        
        let sequenceRendered = false;
        
        // First, try to render sequence if conditions are met
        if (this.options.showSequences && read.sequence) {
            // Get TrackRenderer instance to use unified shouldShowSequences method
            const trackRenderer = window.genomeBrowser && window.genomeBrowser.trackRenderer;
            let shouldTrySequence = false;
            
            if (trackRenderer && trackRenderer.shouldShowSequences) {
                // Use unified threshold logic from TrackRenderer
                shouldTrySequence = trackRenderer.shouldShowSequences(this.viewport.start, this.viewport.end, this.canvasWidth, this.options);
            } else {
                // Fallback to local method if TrackRenderer not available
                shouldTrySequence = this.shouldShowSequenceDetails(width);
            }
            
            if (shouldTrySequence) {
                // Try to render sequence directly
                sequenceRendered = this.renderReadSequence(read, x, y, width, readStart, readEnd);
                
                // Debug logging for sequence rendering failures
                if (!sequenceRendered) {
                    console.log('🔍 [CanvasReadsRenderer] Sequence rendering failed for read:', read.id, 'width:', width);
                }
            }
        }
        
        // GUARANTEE: Always draw visual rectangle representation if sequence was not rendered
        // This ensures reads are NEVER invisible during zoom transitions
        if (!sequenceRendered) {
            this.ctx.fillStyle = readColor;
            this.ctx.fillRect(x, y, width, this.options.readHeight);
            
            // Draw read border for better visibility
            this.ctx.strokeStyle = this.darkenColor(readColor, 0.2);
            this.ctx.lineWidth = 0.5;
            this.ctx.strokeRect(x, y, width, this.options.readHeight);
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
        // More lenient threshold for sequence display - show sequences for narrower reads
        return readWidth > 15; // Reduced from 30 to 15 pixels to show sequences earlier in zoom
    }
    
    renderReadSequence(read, x, y, width, visibleStart, visibleEnd) {
        if (!read.sequence) return false;
        
        // Calculate the actual read length based on genomic coordinates (inclusive)
        const genomicReadLength = read.end - read.start + 1;
        const sequenceLength = read.sequence.length;
        
        // Debug log coordinate mismatches
        if (genomicReadLength !== sequenceLength) {
            console.log(`🔧 [Canvas] Read coordinate/sequence length mismatch:`, {
                readId: read.id,
                genomicStart: read.start,
                genomicEnd: read.end,
                genomicLength: genomicReadLength,
                sequenceLength: sequenceLength
            });
        }
        
        // CRITICAL FIX: Ensure reads sequence aligns with reference sequence boundaries (match SVG logic)
        const shouldExtractFullRead = (visibleStart === read.start) && (visibleEnd === read.end);
        
        if (shouldExtractFullRead) {
            const visibleSequence = read.sequence;
            console.log(`🔧 [Canvas] Full read matches viewport bounds exactly:`, { 
                readId: read.id, 
                readStart: read.start,
                readEnd: read.end,
                visibleStart,
                visibleEnd,
                sequenceLength: visibleSequence.length 
            });
            
            if (!visibleSequence || visibleSequence.length === 0) return false;
            
            // Continue with rendering logic using complete sequence
            return this.renderCompleteSequence(read, x, y, width, visibleSequence);
        }
        
        // For partial reads, extract the portion that corresponds to visibleStart-visibleEnd
        console.log(`🔧 [Canvas] Extracting partial read sequence:`, { 
            readId: read.id, 
            readStart: read.start,
            readEnd: read.end,
            visibleStart,
            visibleEnd,
            extractingRange: `${visibleStart}-${visibleEnd}`
        });
        
        // Calculate offset within the read for the visible portion
        const startOffset = Math.max(0, visibleStart - read.start);
        const endOffset = Math.min(genomicReadLength - 1, visibleEnd - read.start);
        
        // Map to sequence indices for partial display
        let startIndex, endIndex;
        if (genomicReadLength <= 1) {
            startIndex = 0;
            endIndex = sequenceLength - 1;
        } else {
            startIndex = Math.max(0, Math.floor((startOffset / (genomicReadLength - 1)) * (sequenceLength - 1)));
            endIndex = Math.min(sequenceLength - 1, Math.ceil((endOffset / (genomicReadLength - 1)) * (sequenceLength - 1)));
        }
        
        // Get the visible portion of the sequence
        const visibleSequence = read.sequence.substring(startIndex, endIndex + 1);
        
        console.log(`🔧 [Canvas] Partial sequence display:`, {
            readId: read.id,
            readStart: read.start,
            readEnd: read.end,
            visibleStart, visibleEnd,
            startOffset, endOffset,
            startIndex, endIndex,
            visibleLength: visibleSequence.length,
            originalLength: read.sequence.length,
            isCompleteReadInViewport: isCompleteReadInViewport
        });
        
        if (!visibleSequence || visibleSequence.length === 0) return false;
        
        // Continue with partial sequence rendering
        return this.renderSequenceText(visibleSequence, x, y, width);
    }
    
    /**
     * Render complete sequence (most common case)
     */
    renderCompleteSequence(read, x, y, width, sequence) {
        return this.renderSequenceText(sequence, x, y, width);
    }
    
    /**
     * Common sequence text rendering logic
     */
    renderSequenceText(visibleSequence, x, y, width) {
        const charSpacing = width / visibleSequence.length;
        
        // Choose font size based on auto-calculate setting - match SVG logic
        let fontSize;
        if (this.options.autoFontSize !== false) {
            // Auto-calculate mode: calculate optimal font size for this visible sequence portion
            fontSize = this.calculateOptimalSequenceFontSize(visibleSequence.length, width, this.options.readHeight);
            
            // Be more lenient with font size - use minimum font size as absolute floor
            if (fontSize < (this.options.minFontSize || 4)) {
                fontSize = this.options.minFontSize || 4; // Use minimum viable font size
            }
        } else {
            // Manual mode: use user-specified font size settings
            fontSize = this.options.sequenceFontSize || 6;
            
            // Be more lenient with character spacing - allow tighter packing at high zoom
            if (charSpacing < fontSize * 0.4) { // More lenient threshold
                fontSize = Math.max(charSpacing / 0.4, this.options.minFontSize || 4); // Scale down font if needed
            }
        }
        
        // Set font with chosen size
        this.ctx.font = `${fontSize}px 'Courier New', monospace`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        const textY = y + this.options.readHeight / 2;
        
        // Calculate character width for proper positioning
        const actualCharWidth = this.ctx.measureText('M').width;
        
        // Render only the visible portion of the sequence
        let charactersRendered = 0;
        for (let i = 0; i < visibleSequence.length; i++) {
            const base = visibleSequence[i].toUpperCase();
            const baseX = x + (i * charSpacing) + (charSpacing / 2);
            
            // More lenient character spacing - allow tighter packing at high zoom levels
            if (actualCharWidth <= charSpacing * 1.5) { // Even more lenient overlap allowance
                // Set base color
                this.ctx.fillStyle = this.baseColors[base] || this.baseColors['N'];
                
                // Render character
                this.ctx.fillText(base, baseX, textY);
                charactersRendered++;
            }
        }
        
        // Return true if at least some characters were rendered
        return charactersRendered > 0;
    }
    
    /**
     * Calculate optimal font size for sequence display - matches SVG logic
     */
    calculateOptimalSequenceFontSize(sequenceLength, availableWidth, readHeight) {
        // Calculate pixels per base
        const pixelsPerBase = availableWidth / sequenceLength;
        
        // Calculate font size constraints
        const minFontSize = this.options.minFontSize || 4;
        const maxFontSize = this.options.maxFontSize || 14;
        
        // Font size based on available width per character (leave padding)
        let widthBasedFontSize = Math.floor(pixelsPerBase * 0.8);
        
        // Font size based on read height (leave some vertical padding)
        let heightBasedFontSize = Math.floor(readHeight * 0.7);
        
        // Use the smaller of the two constraints
        let optimalFontSize = Math.min(widthBasedFontSize, heightBasedFontSize);
        
        // Apply min/max constraints
        optimalFontSize = Math.max(minFontSize, Math.min(maxFontSize, optimalFontSize));
        
        return optimalFontSize;
    }
    
    renderMismatches(read, x, y, width) {
        if (!read.mismatches) return;
        
        // Highlight mismatch positions
        read.mismatches.forEach(mismatch => {
            const mismatchPos = mismatch.pos - read.start;
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
    
    handleCanvasClick(event) {
        console.log('🖱️ [CanvasReadsRenderer] Canvas clicked');
        
        const clickedRead = this.getReadAtPosition(event);
        if (clickedRead) {
            console.log('🖱️ [CanvasReadsRenderer] Read clicked:', clickedRead.id);
            this.showReadDetails(clickedRead);
        }
    }
    
    getReadAtPosition(event) {
        // Get canvas coordinates
        const rect = this.canvas.getBoundingClientRect();
        const canvasX = event.clientX - rect.left;
        const canvasY = event.clientY - rect.top;
        
        // Check if click is within any read
        for (const readPos of this.readPositions) {
            if (canvasX >= readPos.x && 
                canvasX <= readPos.x + readPos.width &&
                canvasY >= readPos.y && 
                canvasY <= readPos.y + readPos.height) {
                return readPos.read;
            }
        }
        
        return null;
    }
    
    showReadDetails(read) {
        // Get file info if available - same logic as SVG mode
        let fileInfo = null;
        if (window.genomeBrowser && window.genomeBrowser.multiFileManager && window.genomeBrowser.multiFileManager.files) {
            // Try to find the file info for this read
            const files = window.genomeBrowser.multiFileManager.files.reads || [];
            if (files.length > 0) {
                // For now, use the first file or try to match by read properties
                fileInfo = files[0];
            }
        }
        
        // Call the same selectRead method used in SVG mode
        if (window.genomeBrowser && window.genomeBrowser.selectRead) {
            window.genomeBrowser.selectRead(read, fileInfo);
        } else {
            console.warn('🖱️ [CanvasReadsRenderer] genomeBrowser.selectRead method not available');
            // Fallback: show simple alert with read info
            alert(`Read: ${read.id}\nPosition: ${read.start}-${read.end}\nStrand: ${read.strand}\nMapping Quality: ${read.mappingQuality}`);
        }
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
        // Apply the transform directly without any scaling to match SVG behavior
        this.canvas.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
        console.log(`🎨 [CanvasReadsRenderer] Applied drag transform: translateX(${deltaX}px)`);
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
        
        // Remove click event listeners
        if (this.canvas) {
            this.canvas.removeEventListener('click', this.clickHandler);
            this.canvas.removeEventListener('mousemove', this.mouseMoveHandler);
        }
        
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
        
        // Clear read positions array
        this.readPositions = [];
        
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