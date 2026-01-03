/**
 * CanvasGenesRenderer - High-performance Canvas-based gene track renderer
 * Replaces SVG-based rendering for significant performance improvements
 * while maintaining visual parity.
 */
class CanvasGenesRenderer {
    constructor(container, geneRows, viewport, layout, operons, settings = {}, genomeBrowser = null) {
        this.container = container;
        this.geneRows = geneRows;
        this.viewport = viewport;
        this.layout = layout;
        this.operons = operons;
        this.genomeBrowser = genomeBrowser;

        // Settings with defaults matching SVG renderer
        this.settings = {
            fontSize: 11,
            fontFamily: 'Arial, sans-serif',
            maxBorderWidth: 1,
            backgroundColor: 'transparent',
            highlightEffect: 'pulse',
            maxRows: 6,
            geneHeight: 12,
            ...settings
        };

        // Cache for gene gradients to avoid recreating them constantly
        this.gradientCache = new Map();

        // Track gene positions for interaction
        this.geneHitRegions = [];

        // Canvas and context
        this.canvas = null;
        this.ctx = null;
        this.devicePixelRatio = window.devicePixelRatio || 1;

        // Rendering metrics
        this.canvasWidth = 0;
        this.canvasHeight = 0;

        // Performance tracking
        this.renderCount = 0;
        this.lastRenderTime = 0;

        this.initialize();
    }

    initialize() {
        console.log('🎨 [CanvasGenesRenderer] Initializing Canvas genes renderer');

        // Create canvas element
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'genes-canvas';
        this.canvas.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            width: 100%;
            height: 100%;
            display: block;
            image-rendering: crisp-edges;
            z-index: 10;
            pointer-events: auto;
        `;

        // Get 2D context
        this.ctx = this.canvas.getContext('2d', { alpha: true });

        // Setup canvas container
        this.setupContainer();

        // Setup canvas dimensions
        this.setupCanvas();

        // Render initial view
        this.render();

        // Setup resize observer
        this.setupResizeObserver();

        // Setup interaction handlers
        this.setupInteractionHandlers();

        console.log('✅ [CanvasGenesRenderer] Initialized successfully');
    }

    setupContainer() {
        // Clear SVG or other content if any, but preserve ruler if it exists as a separate sibling
        // In the unified container model, this container is dedicated to genes content
        this.container.innerHTML = '';
        this.container.appendChild(this.canvas);
    }

    setupCanvas() {
        // Measure container
        const rect = this.container.getBoundingClientRect();
        this.canvasWidth = rect.width || 800; // Fallback width

        // Height provided by layout
        const contentHeight = this.layout.totalHeight - this.layout.rulerHeight;
        this.canvasHeight = contentHeight;

        // Set canvas dimensions with DPR scaling
        this.canvas.width = this.canvasWidth * this.devicePixelRatio;
        this.canvas.height = this.canvasHeight * this.devicePixelRatio;

        // Set logical CSS dimensions
        this.canvas.style.width = `${this.canvasWidth}px`;
        this.canvas.style.height = `${this.canvasHeight}px`;

        // Scale context
        this.ctx.scale(this.devicePixelRatio, this.devicePixelRatio);
    }

    setupInteractionHandlers() {
        // Click handler
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));

        // Hover/Cursor handler
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));

        // Mouse leave
        this.canvas.addEventListener('mouseleave', () => {
            this.canvas.style.cursor = 'default';
        });
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
            // Fallback
            this.resizeHandler = () => this.handleResize();
            window.addEventListener('resize', this.resizeHandler);
        }
    }

    handleResize() {
        if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {
            console.log('🔄 [CanvasGenesRenderer] Handling resize');
            this.setupCanvas();
            this.render();
        }, 100);
    }

    /**
     * Main render method
     */
    render() {
        const startTime = performance.now();
        this.renderCount++;

        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

        // Clear hit regions
        this.geneHitRegions = [];

        // Calculate common rendering parameters
        const containerWidth = this.canvasWidth;
        const viewportRange = this.viewport.end - this.viewport.start;
        const baseRange = 10000;
        const zoomFactor = baseRange / viewportRange;
        const maxStrokeWidth = this.settings.maxBorderWidth !== undefined ? this.settings.maxBorderWidth : 1;
        const strokeWidth = Math.min(maxStrokeWidth, Math.max(0.3, Math.min(2, 1.5 * zoomFactor)));

        // Render each row
        this.geneRows.forEach((rowGenes, rowIndex) => {
            if (rowIndex >= this.layout.maxRows) return;

            rowGenes.forEach(gene => {
                this.renderGene(gene, rowIndex, strokeWidth);
            });
        });

        this.lastRenderTime = performance.now() - startTime;

        if (window.DEBUG_MODE && this.renderCount % 50 === 0) {
            console.log(`⚡ [CanvasGenesRenderer] Render time: ${this.lastRenderTime.toFixed(2)}ms`);
        }
    }

    /**
     * Render a single gene element
     */
    renderGene(gene, rowIndex, strokeWidth) {
        // Calculate dimensions and position
        const geneStart = Math.max(gene.start, this.viewport.start);
        const geneEnd = Math.min(gene.end, this.viewport.end);

        const leftPercent = ((geneStart - this.viewport.start) / (this.viewport.end - this.viewport.start));
        const widthPercent = ((geneEnd - geneStart) / (this.viewport.end - this.viewport.start));

        // Don't render invisible items
        if (widthPercent <= 0) return;

        // Calculate pixel coordinates
        const x = leftPercent * this.canvasWidth;
        const width = widthPercent * this.canvasWidth;
        const y = this.layout.topPadding + rowIndex * (this.layout.geneHeight + this.layout.rowSpacing);
        const height = this.layout.geneHeight;

        // Determine min width based on type
        const geneType = gene.type ? gene.type.toLowerCase() : 'gene';
        const isSpecialized = this.shouldUseSpecializedShape(geneType);
        const isSmallMinWidthType = ['trna', 'rrna', 'mrna', 'repeat_region'].includes(geneType);
        const minWidth = isSpecialized ? (isSmallMinWidthType ? 1 : 8) : 1;
        const elementWidth = Math.max(width, minWidth);

        // Truncation flags
        const isLeftTruncated = gene.start < this.viewport.start;
        const isRightTruncated = gene.end > this.viewport.end;

        // Get operon info for color
        const operonInfo = this.genomeBrowser.getGeneOperonInfo(gene, this.operons);

        // Store hit region for interactivity
        this.geneHitRegions.push({
            gene,
            operonInfo,
            x, y, width: elementWidth, height,
            rowIndex
        });

        // Save context for this gene
        this.ctx.save();
        this.ctx.translate(x, y);

        // Draw the shape
        this.drawGeneShape(gene, elementWidth, height, operonInfo, isLeftTruncated, isRightTruncated, strokeWidth);

        // Draw label if space permits
        if (elementWidth > 30) {
            this.drawGeneLabel(gene, elementWidth, height);
        }

        this.ctx.restore();
    }

    /**
     * Draw the gene shape with gradients and borders
     */
    drawGeneShape(gene, width, height, operonInfo, isLeftTruncated, isRightTruncated, strokeWidth) {
        const geneType = gene.type.toLowerCase();
        const gradientId = this.getGradientId(geneType);

        // Set fill style (gradient)
        // Note: Canvas gradients are relative to coordinate system, so we create one for this specific rect
        const gradient = this.ctx.createLinearGradient(0, 0, width, height);
        const colors = this.getGradientColors(geneType, operonInfo.color);
        gradient.addColorStop(0, colors.start);
        gradient.addColorStop(1, colors.end);
        this.ctx.fillStyle = gradient;

        // Set stroke style
        if (strokeWidth > 0) {
            this.ctx.strokeStyle = this.darkenColor(operonInfo.color, 20);
            this.ctx.lineWidth = strokeWidth;
        } else {
            this.ctx.strokeStyle = 'rgba(0,0,0,0)';
        }

        // Draw specific path
        this.ctx.beginPath();

        if (this.shouldUseSpecializedShape(geneType)) {
            this.drawSpecializedShapePath(gene, width, height, isLeftTruncated, isRightTruncated);
        } else {
            this.drawStandardShapePath(gene, width, height, isLeftTruncated, isRightTruncated);
        }

        this.ctx.fill();
        if (strokeWidth > 0) {
            this.ctx.stroke();
        }
    }

    /**
     * Draw label text for the gene
     */
    drawGeneLabel(gene, width, height) {
        const geneName = this.getGeneName(gene);

        // Font sizing logic matching SVG
        const baseFontSize = this.settings.fontSize || 11;
        const maxFontSize = Math.min(baseFontSize, height * 0.7);
        const minFontSize = 8;
        const fontSize = Math.max(minFontSize, Math.min(maxFontSize, baseFontSize));

        // Approximate character width
        const estimatedCharWidth = fontSize * 0.6;
        const maxChars = Math.floor(width / estimatedCharWidth);

        let displayText = geneName;
        if (geneName.length > maxChars && maxChars > 3) {
            displayText = geneName.substring(0, maxChars - 3) + '...';
        } else if (maxChars <= 3) {
            displayText = '...';
        }

        this.ctx.font = `500 ${fontSize}px ${this.settings.fontFamily}`;
        this.ctx.fillStyle = '#333';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        // Save state to prevent stretching/scaling effects on text if we were using transforms
        // But here we are drawing effectively 1:1 pixel mapping, so standard text drawing is fine
        this.ctx.fillText(displayText, width / 2, height / 2);
    }

    /**
     * Draw standard gene arrow/triangle path
     */
    drawStandardShapePath(gene, width, height, isLeftTruncated, isRightTruncated) {
        const isForward = gene.strand != -1; // Use loose equality to handle string "-1"
        const arrowSize = Math.max(2, Math.min(width * 0.3, 15));

        if (width < 8) {
            // Triangle shape for small genes
            if (isForward) {
                // Forward Triangle
                this.ctx.moveTo(0, 0);
                this.ctx.lineTo(width, height / 2);
                this.ctx.lineTo(0, height);
            } else {
                // Reverse Triangle
                this.ctx.moveTo(width, 0);
                this.ctx.lineTo(0, height / 2);
                this.ctx.lineTo(width, height);
            }
        } else {
            // Arrow shape
            if (isForward) {
                // Forward Arrow
                this.ctx.moveTo(0, 0);
                this.ctx.lineTo(width - arrowSize, 0);
                this.ctx.lineTo(width, height / 2);
                this.ctx.lineTo(width - arrowSize, height);
                this.ctx.lineTo(0, height);
            } else {
                // Reverse Arrow
                this.ctx.moveTo(arrowSize, 0);
                this.ctx.lineTo(width, 0);
                this.ctx.lineTo(width, height);
                this.ctx.lineTo(arrowSize, height);
                this.ctx.lineTo(0, height / 2);
            }
        }

        this.ctx.closePath();
    }

    /**
     * Draw specialized shapes
     */
    drawSpecializedShapePath(gene, width, height, isLeftTruncated, isRightTruncated) {
        const geneType = gene.type.toLowerCase();
        const isForward = gene.strand != -1; // Use loose equality to handle string "-1"

        switch (geneType) {
            case 'promoter':
                this.drawPromoterPath(width, height, isForward);
                break;
            case 'terminator':
                this.drawTerminatorPath(width, height, isForward);
                break;
            case 'regulatory':
            case 'repeat_region':
            case 'trna':
            case 'rrna':
            case 'mrna':
            case 'comment':
            case 'note':
            case 'misc_feature':
                // Most of these use a boxy shape or arrow similar to standard but with specific coloring
                // Using standard arrow shape for now as specialized logic in SVG is complex 
                // and mostly differs by gradient/color which is handled separately
                this.drawStandardShapePath(gene, width, height, isLeftTruncated, isRightTruncated);
                break;
            default:
                this.drawStandardShapePath(gene, width, height, isLeftTruncated, isRightTruncated);
        }
    }

    drawPromoterPath(width, height, isForward) {
        // Bent arrow shape
        if (isForward) {
            this.ctx.moveTo(0, height);
            this.ctx.lineTo(0, height * 0.3);
            this.ctx.lineTo(width * 0.7, height * 0.3);
            this.ctx.lineTo(width * 0.7, 0);
            this.ctx.lineTo(width, height * 0.3); // Arrow tip top
            this.ctx.lineTo(width * 0.7, height * 0.6);
            this.ctx.lineTo(width * 0.7, height * 0.3);
        } else {
            this.ctx.moveTo(width, height);
            this.ctx.lineTo(width, height * 0.3);
            this.ctx.lineTo(width * 0.3, height * 0.3);
            this.ctx.lineTo(width * 0.3, 0);
            this.ctx.lineTo(0, height * 0.3); // Arrow tip top
            this.ctx.lineTo(width * 0.3, height * 0.6);
            this.ctx.lineTo(width * 0.3, height * 0.3);
        }
        this.ctx.closePath();
    }

    drawTerminatorPath(width, height, isForward) {
        // T-shape
        const stemWidth = Math.max(2, width * 0.2);
        const centerX = width / 2;

        this.ctx.moveTo(centerX - stemWidth / 2, height);
        this.ctx.lineTo(centerX - stemWidth / 2, height * 0.3);
        this.ctx.lineTo(0, height * 0.3);
        this.ctx.lineTo(0, 0);
        this.ctx.lineTo(width, 0);
        this.ctx.lineTo(width, height * 0.3);
        this.ctx.lineTo(centerX + stemWidth / 2, height * 0.3);
        this.ctx.lineTo(centerX + stemWidth / 2, height);
        this.ctx.closePath();
    }

    /**
     * Get colors for gradient based on gene type
     */
    getGradientColors(geneType, baseColor) {
        // Default color derivation matching SVG logic
        if (!this.shouldUseSpecializedShape(geneType)) {
            return {
                start: baseColor,
                end: this.lightenColor(baseColor, 20)
            };
        }

        // Specialized colors
        switch (geneType) {
            case 'promoter': return { start: '#1e40af', end: '#3b82f6' };
            case 'terminator': return { start: '#7f1d1d', end: '#dc2626' };
            case 'regulatory': return { start: '#c2410c', end: '#f97316' };
            case 'repeat_region': return { start: '#374151', end: '#6b7280' };
            case 'trna': return { start: '#166534', end: '#22c55e' };
            case 'rrna': return { start: '#14532d', end: '#16a34a' };
            case 'mrna': return { start: '#15803d', end: '#4ade80' };
            case 'comment':
            case 'note':
            case 'misc_feature': return { start: '#7c3aed', end: '#a855f7' };
            default: return { start: baseColor, end: this.lightenColor(baseColor, 20) };
        }
    }

    shouldUseSpecializedShape(geneType) {
        const specializedTypes = ['promoter', 'terminator', 'regulatory', 'repeat_region', 'trna', 'rrna', 'mrna', 'comment', 'note', 'misc_feature'];
        return specializedTypes.includes(geneType);
    }

    getGradientId(geneType) {
        // Simplified ID generation for cache key if implemented, acts as type normalizer here
        return geneType;
    }

    getGeneName(gene) {
        // Helper to extract name with same priority logic as SVG renderer
        if (!this.genomeBrowser) return gene.type;
        return this.genomeBrowser.getQualifierValue(gene.qualifiers, 'gene') ||
            this.genomeBrowser.getQualifierValue(gene.qualifiers, 'locus_tag') ||
            this.genomeBrowser.getQualifierValue(gene.qualifiers, 'product') || gene.type;
    }

    // Interaction handlers
    handleCanvasClick(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Find clicked gene (reverse order to hit top-most if overlap)
        for (let i = this.geneHitRegions.length - 1; i >= 0; i--) {
            const region = this.geneHitRegions[i];
            if (x >= region.x && x <= region.x + region.width &&
                y >= region.y && y <= region.y + region.height) {

                console.log('Canvas gene clicked:', region.gene);

                // Trigger selection in GenomeBrowser
                if (this.genomeBrowser && this.genomeBrowser.handleGeneClick) {
                    // Create a synthetic event or pass what's needed
                    // The SVG version just triggers handleGeneClick(gene, event)
                    // We need to pass the gene object and operon info

                    // Emulate the DOM element that would be expected if needed,
                    // but usually handleGeneClick uses the gene data object
                    this.genomeBrowser.handleGeneClick(region.gene, event);
                }
                return;
            }
        }
    }

    handleMouseMove(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        let hovered = false;
        for (let i = this.geneHitRegions.length - 1; i >= 0; i--) {
            const region = this.geneHitRegions[i];
            if (x >= region.x && x <= region.x + region.width &&
                y >= region.y && y <= region.y + region.height) {
                hovered = true;
                break;
            }
        }

        this.canvas.style.cursor = hovered ? 'pointer' : 'default';

        // Could implement tooltip showing here by calling out to a tooltip manager
        // similar to how SVG titles or tippy.js works
    }

    // Utility for dragging
    applyDragTransform(deltaX, deltaY = 0) {
        this.canvas.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    }

    resetDragTransform() {
        this.canvas.style.transform = '';
    }

    updateData(geneRows, viewport, layout, operons) {
        this.geneRows = geneRows;
        this.viewport = viewport;
        this.layout = layout;
        this.operons = operons;

        // If layout changed sizing, need to resize canvas
        const contentHeight = this.layout.totalHeight - this.layout.rulerHeight;
        if (Math.abs(contentHeight - this.canvasHeight) > 1) {
            this.setupCanvas();
        }

        this.render();
    }

    destroy() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
        }
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }

        this.canvas.remove();
        this.canvas = null;
        this.ctx = null;
    }

    // Color helpers - simplified versions of what's likely available in utils or TrackRenderer
    lightenColor(color, percent) {
        // Implementation depend on color format, assuming hex for simplicity
        // In real integration, use the existing helper method from TrackRenderer context or utils
        return this.genomeBrowser ? this.genomeBrowser.trackRenderer.lightenColor(color, percent) : color;
    }

    darkenColor(color, percent) {
        return this.genomeBrowser ? this.genomeBrowser.trackRenderer.darkenColor(color, percent) : color;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CanvasGenesRenderer;
} else if (typeof window !== 'undefined') {
    window.CanvasGenesRenderer = CanvasGenesRenderer;
}
