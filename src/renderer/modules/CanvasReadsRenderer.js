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
      ...options,
    };

    // Read rendering colors (use options if provided, otherwise defaults)
    this.readColors = {
      forward: this.options.forwardColor || '#4285F4', // Blue for forward reads
      reverse: this.options.reverseColor || '#EA4335', // Red for reverse reads
      forwardPaired: this.options.pairedColor || '#34A853', // Green for forward paired
      reversePaired: this.options.pairedColor || '#FBBC05', // Yellow for reverse paired
      unpaired: '#9AA0A6', // Gray for unpaired
      lowQuality: '#F4B400', // Orange for low quality
      duplicate: '#9C27B0', // Purple for duplicates
      secondary: '#607D8B', // Blue-gray for secondary
    };

    // Base colors for sequence display
    this.baseColors = {
      A: '#e74c3c',
      T: '#3498db',
      G: '#2ecc71',
      C: '#f39c12',
      a: '#e74c3c',
      t: '#3498db',
      g: '#2ecc71',
      c: '#f39c12',
      N: '#95a5a6',
      n: '#95a5a6',
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

    // Add space for coverage if enabled (top-most)
    if (this.options.showCoverage) {
      const coverageHeight = this.options.coverageHeight || 50;
      totalHeight += coverageHeight + 5; // Coverage height + spacing (5)
    }

    // Add space for reference sequence if enabled
    if (this.options.showReference) {
      totalHeight += 25; // Reference sequence height (20) + spacing (5)
    }

    // Add space for reads
    totalHeight += totalRows * (this.options.readHeight + this.options.rowSpacing) + this.options.bottomPadding;

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
            opacity: 0;
            transition: opacity 0.1s ease-out;
        `;

    // Get 2D context with alpha for transparency
    this.ctx = this.canvas.getContext('2d', { alpha: true });

    // Setup canvas container
    this.setupContainer();

    // Defer setupCanvas to next frame so the container has time to be
    // inserted into the DOM, giving getBoundingClientRect() accurate dimensions.
    this.setupResizeObserver();

    // Use requestAnimationFrame to defer initial canvas setup until the
    // container is in the DOM and has proper layout dimensions
    this._pendingInitialRender = requestAnimationFrame(() => {
      this._pendingInitialRender = null;
      this.setupCanvas();
      // Calculate text metrics if sequences will be shown
      if (this.options.showSequences) {
        this.calculateTextMetrics();
      }
      // Fade in the canvas now that it has correct dimensions
      this.canvas.style.opacity = '1';
    });

    console.log('✅ [CanvasReadsRenderer] Canvas reads renderer initialized successfully (deferred setup)');
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
    // Get container dimensions — try multiple strategies to get accurate width
    const containerRect = this.container.getBoundingClientRect();
    let width = containerRect.width;

    // If container not in DOM yet (width = 0), try parent chain
    if (!width || width <= 0) {
      let parent = this.container.parentElement;
      while (parent) {
        const parentRect = parent.getBoundingClientRect();
        if (parentRect.width > 0) {
          width = parentRect.width;
          break;
        }
        parent = parent.parentElement;
      }
    }

    // Final fallback: estimate from window width minus typical sidebar/padding
    if (!width || width <= 0) {
      const sidebarEl = document.querySelector('.sidebar, #sidebar, .side-panel');
      const sidebarWidth = sidebarEl ? sidebarEl.offsetWidth : 300;
      width = window.innerWidth - sidebarWidth - 40;
    }

    this.canvasWidth = Math.max(width, 200);

    // Resolve the effective per-read height for the current zoom (grows when
    // sequence letters are shown so they fit). Now that canvasWidth is known,
    // getPixelsPerBp() is meaningful.
    this.effectiveReadHeight = this.getEffectiveReadHeight();

    // Calculate canvas height based on read rows plus reference/coverage space
    const totalRows = this.readRows.length;
    let totalHeight = this.options.topPadding;

    // Add space for coverage if enabled (top-most)
    if (this.options.showCoverage) {
      const coverageHeight = this.options.coverageHeight || 50;
      totalHeight += coverageHeight + 5; // Coverage height + spacing (5)
    }

    // Add space for reference sequence if enabled
    if (this.options.showReference) {
      totalHeight += 25; // Reference sequence height (20) + spacing (5)
    }

    // Add space for reads (uses effective height so taller sequence rows fit)
    totalHeight += totalRows * (this.effectiveReadHeight + this.options.rowSpacing) + this.options.bottomPadding;

    this.canvasHeight = totalHeight;

    // Set canvas size accounting for device pixel ratio
    this.canvas.width = this.canvasWidth * this.devicePixelRatio;
    this.canvas.height = this.canvasHeight * this.devicePixelRatio;

    // Scale CSS size back to logical pixels
    this.canvas.style.width = this.canvasWidth + 'px';
    this.canvas.style.height = this.canvasHeight + 'px';

    // Reset transform before applying DPR scale to prevent accumulation
    this.ctx.setTransform(this.devicePixelRatio, 0, 0, this.devicePixelRatio, 0, 0);

    // Update container height to match canvas
    this.container.style.height = this.canvasHeight + 'px';

    // Ensure the host track row reserves enough height for the (possibly taller)
    // sequence canvas so it is not clipped or overlapping the next track. We use
    // min-height — not height — so we never fight an explicit/splitter-set height,
    // and it relaxes automatically when zooming back out shrinks the canvas.
    const host = this.container.parentElement;
    if (host) {
      host.style.minHeight = `${this.canvasHeight}px`;
    }

    console.log('🖼️ [CanvasReadsRenderer] Canvas setup:', {
      canvasWidth: this.canvasWidth,
      canvasHeight: this.canvasHeight,
      devicePixelRatio: this.devicePixelRatio,
      totalRows: this.readRows.length,
    });
  }

  setupClickHandlers() {
    console.log('🖱️ [CanvasReadsRenderer] Setting up click handlers');

    // Bind event handlers to preserve 'this' context
    this.clickHandler = event => this.handleCanvasClick(event);
    this.mouseMoveHandler = event => {
      const read = this.getReadAtPosition(event);
      this.canvas.style.cursor = read ? 'pointer' : 'default';
    };

    // Add event listeners to canvas
    this.canvas.addEventListener('click', this.clickHandler);
    this.canvas.addEventListener('mousemove', this.mouseMoveHandler);
  }

  calculateTextMetrics() {
    // Set font for text measurement
    this.actualFontSize = this.options.autoFontSize ? this.calculateOptimalFontSize() : this.options.maxFontSize;

    this.ctx.font = `${this.actualFontSize}px 'Courier New', monospace`;

    // Measure character dimensions
    const metrics = this.ctx.measureText('M');
    this.charWidth = metrics.width;
    this.charHeight = this.actualFontSize * 1.2; // Approximate height

    console.log('📏 [CanvasReadsRenderer] Text metrics:', {
      fontSize: this.actualFontSize,
      charWidth: this.charWidth.toFixed(2),
      charHeight: this.charHeight.toFixed(2),
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

  /**
   * Horizontal scale of the current viewport (CSS pixels per base pair).
   * This is the single scale shared by the reference band and the reads, so a
   * base occupies the same width in both.
   */
  getPixelsPerBp() {
    const range = this.viewport.end - this.viewport.start;
    return range > 0 ? this.canvasWidth / range : 0;
  }

  /**
   * Unified letter size for sequence display. Both the reference sequence and the
   * aligned reads use this so that read bases render at the SAME size as the
   * reference bases at any given zoom level (previously reads were shackled to the
   * tiny readHeight, making them far smaller than the reference). Sized purely from
   * the horizontal zoom, exactly like the reference band.
   */
  getSequenceLetterFontSize(pixelsPerBp = this.getPixelsPerBp()) {
    // Cap matches the reference font (referenceFontSize, default 12) so the two
    // never diverge; fall back to maxFontSize when no reference cap is configured.
    const cap = this.options.referenceFontSize || this.options.maxFontSize || 12;
    return Math.min(cap, Math.floor(pixelsPerBp * 0.8));
  }

  /**
   * Font size actually used to draw read bases at the current zoom (auto mode
   * mirrors the reference; manual mode honours the user's sequenceFontSize).
   */
  getReadSequenceFontSize(pixelsPerBp = this.getPixelsPerBp()) {
    if (this.options.autoFontSize === false) {
      return this.options.sequenceFontSize || 6;
    }
    return Math.max(this.options.minFontSize || 6, this.getSequenceLetterFontSize(pixelsPerBp));
  }

  /**
   * Effective per-read row height. Reads are thin bars when zoomed out, but once
   * bases become wide enough to render letters we grow the row so the (now
   * reference-sized) letters fit without overlapping neighbouring rows.
   */
  getEffectiveReadHeight() {
    const base = this.options.readHeight;
    if (!this.options.showSequences) return base;
    const pixelsPerBp = this.getPixelsPerBp();
    // Only grow once bases are wide enough that letters are actually drawn.
    if (pixelsPerBp < 3) return base;
    return Math.max(base, this.getReadSequenceFontSize(pixelsPerBp) + 4);
  }

  render() {
    const startTime = performance.now();
    this.renderCount++;

    // CRITICAL FIX: Always reset drag transform when rendering
    // This ensures resize operations don't leave the canvas shifted
    this.resetDragTransform();

    // Keep the effective read height in sync with the current zoom for all the
    // per-row drawing below (setupCanvas also sets it for height calculations).
    this.effectiveReadHeight = this.getEffectiveReadHeight();

    console.log('🎨 [CanvasReadsRenderer] Starting render:', {
      readRows: this.readRows.length,
      totalReads: this.readRows.reduce((sum, row) => sum + row.length, 0),
      canvasSize: `${this.canvasWidth}x${this.canvasHeight}`,
      viewport: `${this.viewport.start}-${this.viewport.end}`,
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

    // Render read rows only if showReads is true (default to true if undefined)
    if (this.options.showReads !== false) {
      this.readRows.forEach((rowReads, rowIndex) => {
        // Removed excessive logging - only log in debug mode
        if (window.DEBUG_MODE) {
          console.log(`🎨 [CanvasReadsRenderer] Rendering row ${rowIndex} with ${rowReads.length} reads`);
        }
        this.renderReadRow(rowReads, rowIndex);
      });
    }

    // Performance tracking
    this.lastRenderTime = performance.now() - startTime;

    if (this.renderCount % 50 === 0) {
      console.log('⚡ [CanvasReadsRenderer] Performance stats:', {
        renderCount: this.renderCount,
        lastRenderTime: this.lastRenderTime.toFixed(2) + 'ms',
        totalReads: this.readRows.reduce((sum, row) => sum + row.length, 0),
        avgRenderTime:
          ((this.lastRenderTime / this.readRows.reduce((sum, row) => sum + row.length, 0)) * 1000).toFixed(3) +
          'μs per read',
      });
    }
  }

  renderReferenceSequence() {
    if (!this.options.showReference || !this.options.referenceSequence) return;

    const referenceHeight = 20;
    const sequence = this.options.referenceSequence;
    const bpLength = this.viewport.end - this.viewport.start;

    if (bpLength <= 0 || sequence.length === 0) return;

    // Position reference below coverage if enabled
    let y = this.options.topPadding || 10;
    if (this.options.showCoverage) {
      const coverageHeight = this.options.coverageHeight || 50;
      y += coverageHeight + 5; // Coverage height + spacing (5)
    }

    // Draw background
    this.ctx.fillStyle = 'rgba(240, 243, 244, 0.6)';
    this.ctx.fillRect(0, y, this.canvasWidth, referenceHeight);

    // Calculate pixels per base pair
    const pixelsPerBp = this.canvasWidth / bpLength;

    // Only render if we have a reasonable width per base
    if (pixelsPerBp > 0.1) {
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';

      // Choose font size based on zoom level (shared with read sequences so the
      // two render at the same size).
      const showLetters = pixelsPerBp >= 8;
      if (showLetters) {
        const fontSize = this.getSequenceLetterFontSize(pixelsPerBp);
        this.ctx.font = `bold ${fontSize}px sans-serif`;
      }

      // Loop through sequence and draw color-coded bases
      // We use the sequence string directly
      for (let i = 0; i < sequence.length; i++) {
        const base = sequence[i];
        const x = i * pixelsPerBp;

        // Get color for base
        this.ctx.fillStyle = this.baseColors[base] || '#95a5a6';

        if (pixelsPerBp >= 1) {
          // Draw block
          this.ctx.fillRect(x, y, pixelsPerBp, referenceHeight);

          // Draw letter if zoomed in enough
          if (showLetters) {
            this.ctx.fillStyle = 'white';
            this.ctx.fillText(base, x + pixelsPerBp / 2, y + referenceHeight / 2 + 1);
          }
        } else {
          // Very small - draw as a line or thin block to avoid overhead
          // For performance, we could batch these but for 10kb reference it's fine
          this.ctx.fillRect(x, y, pixelsPerBp + 0.5, referenceHeight);
        }
      }
    }
  }

  renderCoverage() {
    if (!this.options.showCoverage) return;

    const coverageHeight = this.options.coverageHeight || 50;
    // Position coverage at the top (respecting top padding) - draw ABOVE reference
    const y = this.options.topPadding || 10;

    // Draw faint background for the coverage track area
    this.ctx.fillStyle = 'rgba(240, 243, 244, 0.4)';
    this.ctx.fillRect(0, y, this.canvasWidth, coverageHeight);

    // Calculate coverage based on visible reads
    const startBp = this.viewport.start;
    const endBp = this.viewport.end;
    const bpLength = endBp - startBp;

    if (bpLength <= 0) return;

    // Use a typed array for efficient coverage counting
    // We only need to track coverage within the viewport
    const coverage = new Uint32Array(bpLength);
    let maxCoverage = 0;

    // Iterate through all reads to build coverage map
    // Flatten the readRows structure which contains all visible reads for this view
    for (const row of this.readRows) {
      for (const read of row) {
        // read.start is 1-based, convert to 0-based relative to viewport
        const readStartRel = read.start - 1 - startBp;
        const readEndRel = read.end - startBp; // read.end is usually 0-based exclusive from backend or normalized

        // Clamp to viewport boundaries
        const start = Math.max(0, readStartRel);
        const end = Math.min(bpLength, readEndRel);

        // Increment coverage for each base covered by the read
        for (let i = start; i < end; i++) {
          coverage[i]++;
          if (coverage[i] > maxCoverage) maxCoverage = coverage[i];
        }
      }
    }

    if (maxCoverage === 0) return;

    // Get coverage color from options (with alpha for fill)
    const coverageColor = this.options.coverageColor || '#4a90e2';
    // Create a lighter version of the color for fill (with alpha)
    const coverageFillColor = this.hexToRgba(coverageColor, 0.4);

    // Draw the histogram
    this.ctx.fillStyle = coverageFillColor;
    this.ctx.strokeStyle = coverageColor;
    this.ctx.lineWidth = 1;

    this.ctx.beginPath();
    this.ctx.moveTo(0, y + coverageHeight);

    // Calculate pixels per base pair to determine drawing strategy
    const pixelsPerBp = this.canvasWidth / bpLength;

    if (pixelsPerBp < 1) {
      // [ZOOOMED OUT] BP is smaller than a pixel - need to bin/aggregate
      const bpPerPixel = 1 / pixelsPerBp;

      for (let px = 0; px < this.canvasWidth; px++) {
        const bpStart = Math.floor(px * bpPerPixel);
        const bpEnd = Math.min(bpLength, Math.floor((px + 1) * bpPerPixel));

        // Calculate max coverage in this pixel bin (peak detection for visibility)
        let localMax = 0;
        for (let i = bpStart; i < bpEnd; i++) {
          if (coverage[i] > localMax) localMax = coverage[i];
        }

        const barHeight = (localMax / maxCoverage) * (coverageHeight - 5); // 5px padding at top
        const yPos = y + coverageHeight - barHeight;

        this.ctx.lineTo(px, yPos);
        // Draw 'step' style for cleaner look
        if (px < this.canvasWidth - 1) {
          this.ctx.lineTo(px + 1, yPos);
        }
      }
    } else {
      // [ZOOMED IN] BP is wider than a pixel - draw exact bars
      for (let i = 0; i < bpLength; i++) {
        const x = i * pixelsPerBp;
        const barHeight = (coverage[i] / maxCoverage) * (coverageHeight - 5);
        const yPos = y + coverageHeight - barHeight;

        this.ctx.lineTo(x, yPos);
        this.ctx.lineTo(x + pixelsPerBp, yPos);
      }
    }

    // Close the path at the bottom right
    this.ctx.lineTo(this.canvasWidth, y + coverageHeight);
    this.ctx.closePath();

    // Fill and stroke
    this.ctx.fill();
    this.ctx.stroke();

    // Add max coverage label
    this.ctx.fillStyle = '#666';
    this.ctx.font = '10px sans-serif';
    this.ctx.textAlign = 'right';
    this.ctx.fillText(`Max: ${maxCoverage}x`, this.canvasWidth - 5, y + 12);
  }

  renderReadRow(rowReads, rowIndex) {
    // Calculate Y position accounting for reference sequence and coverage
    // Reads are always at the bottom
    let yOffset = this.options.topPadding;

    // Coverage is now top-most (if enabled)
    if (this.options.showCoverage) {
      const coverageHeight = this.options.coverageHeight || 50;
      yOffset += coverageHeight + 5; // Coverage height + spacing (5)
    }

    // Reference sequence follows coverage (if enabled)
    if (this.options.showReference) {
      yOffset += 25; // Reference sequence height (20) + spacing (5)
    }

    const readHeight = this.effectiveReadHeight || this.options.readHeight;
    const y = yOffset + rowIndex * (readHeight + this.options.rowSpacing);

    rowReads.forEach(read => {
      this.renderRead(read, y);
    });
  }

  renderRead(read, y) {
    // Calculate read position and dimensions - match SVG logic for consistency
    // CRITICAL FIX: Convert read coordinates for comparison with viewport
    const readStart0Based = read.start - 1; // Convert 1-based to 0-based
    const readEnd0Based = read.end; // read.end is already 0-based exclusive
    const readStart = Math.max(readStart0Based, this.viewport.start);
    const readEnd = Math.min(readEnd0Based, this.viewport.end + 1); // Convert viewport.end to 0-based exclusive

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

    // Effective row height (grows when sequence letters are shown)
    const readHeight = this.effectiveReadHeight || this.options.readHeight;

    // Store read position for click detection
    this.readPositions.push({
      read: read,
      x: x,
      y: y,
      width: width,
      height: readHeight,
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
        shouldTrySequence = trackRenderer.shouldShowSequences(
          this.viewport.start,
          this.viewport.end,
          this.canvasWidth,
          this.options
        );
      } else {
        // Fallback to local method if TrackRenderer not available
        shouldTrySequence = this.shouldShowSequenceDetails(width);
      }

      if (shouldTrySequence) {
        // Try to render sequence directly
        sequenceRendered = this.renderReadSequence(read, x, y, width, readStart, readEnd);

        // Debug logging for sequence rendering failures - only in debug mode
        if (!sequenceRendered && window.DEBUG_MODE) {
          console.log('🔍 [CanvasReadsRenderer] Sequence rendering failed for read:', read.id, 'width:', width);
        }
      }
    }

    // GUARANTEE: Always draw visual rectangle representation if sequence was not rendered
    // This ensures reads are NEVER invisible during zoom transitions
    if (!sequenceRendered) {
      if (read.isMultiMapping) {
        this.ctx.strokeStyle = readColor;
        this.ctx.lineWidth = Math.max(1, this.options.borderWidth || 1);
        this.ctx.strokeRect(x, y, width, readHeight);
      } else {
        this.ctx.fillStyle = readColor;
        this.ctx.fillRect(x, y, width, readHeight);

        // Draw read border for better visibility
        this.ctx.strokeStyle = this.darkenColor(readColor, 0.2);
        this.ctx.lineWidth = 0.5;
        this.ctx.strokeRect(x, y, width, readHeight);
      }
    }

    // Highlight mismatches if enabled
    if (this.options.mismatchHighlight && read.mismatches) {
      this.renderMismatches(read, x, y, width);
    }

    // Show mutations if enabled
    if (this.options.showMutations && read.mutations) {
      this.renderMutations(read, x, y, width);
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

    // CRITICAL FIX: Use sequence length as source of truth instead of coordinate calculation
    // The issue is that genomic coordinates vs sequence length mismatch indicates a fundamental
    // coordinate system inconsistency somewhere in the BAM parsing chain
    const genomicReadLength = read.end - read.start + 1; // Theoretical length based on 1-based inclusive coordinates
    const sequenceLength = read.sequence.length; // Actual sequence length

    // Use sequence length as source of truth for all calculations
    const actualReadLength = sequenceLength;

    // Debug log coordinate mismatches but proceed with sequence-based calculations
    if (genomicReadLength !== sequenceLength) {
      // Removed excessive logging - only log in debug mode
      if (window.DEBUG_MODE) {
        console.log(
          `🔧 [Canvas] Read coordinate/sequence length mismatch - using sequence length as source of truth:`,
          {
            readId: read.id,
            genomicStart: read.start,
            genomicEnd: read.end,
            theoreticalGenomicLength: genomicReadLength,
            actualSequenceLength: sequenceLength,
            fixApplied: 'using sequenceLength for all calculations',
          }
        );
      }
    }

    // CRITICAL FIX: Ensure reads sequence aligns with reference sequence boundaries (match SVG logic)
    // Fix coordinate system mismatch: read.start is 1-based, read.end is 0-based exclusive, visibleStart/visibleEnd are 0-based
    const readStart0Based = read.start - 1; // Convert 1-based to 0-based
    const readEnd0Based = read.end; // read.end is already 0-based exclusive
    const shouldExtractFullRead = visibleStart === readStart0Based && visibleEnd === readEnd0Based;

    if (shouldExtractFullRead) {
      const visibleSequence = read.sequence;
      // Removed excessive logging - only log in debug mode
      if (window.DEBUG_MODE) {
        console.log(`🔧 [Canvas] Full read matches viewport bounds exactly:`, {
          readId: read.id,
          readStart: read.start,
          readEnd: read.end,
          visibleStart,
          visibleEnd,
          sequenceLength: visibleSequence.length,
        });
      }

      if (!visibleSequence || visibleSequence.length === 0) return false;

      // Continue with rendering logic using complete sequence
      return this.renderCompleteSequence(read, x, y, width, visibleSequence);
    }

    // For partial reads, extract the portion that corresponds to visibleStart-visibleEnd
    // Removed excessive logging - only log in debug mode
    if (window.DEBUG_MODE) {
      console.log(`🔧 [Canvas] Extracting partial read sequence:`, {
        readId: read.id,
        readStart: read.start,
        readEnd: read.end,
        visibleStart,
        visibleEnd,
        extractingRange: `${visibleStart}-${visibleEnd}`,
      });
    }

    // CRITICAL FIX: Calculate offset using actual sequence length, not theoretical genomic length
    // This fixes the coordinate mismatch that was causing the "left端多一个碱基" issue
    // Use 0-based coordinates for consistent calculation
    const genomicStart = readStart0Based; // Use 0-based coordinate
    const genomicEnd = readEnd0Based; // Use 0-based exclusive end coordinate

    const startOffset = Math.max(0, visibleStart - genomicStart);
    const endOffset = Math.min(actualReadLength - 1, visibleEnd - genomicStart - 1); // Convert visibleEnd from 0-based exclusive to 0-based inclusive

    // FIX: Simplify index calculation to match SVG mode logic
    // Direct mapping from genomic offset to sequence index
    let startIndex;
    let endIndex;
    if (actualReadLength <= 1) {
      startIndex = 0;
      endIndex = actualReadLength - 1;
    } else {
      // Simple direct mapping: genomic offset = sequence index
      startIndex = Math.max(0, startOffset);
      endIndex = Math.min(actualReadLength - 1, endOffset);
    }

    // Get the visible portion of the sequence
    const visibleSequence = read.sequence.substring(startIndex, endIndex + 1);

    // Removed excessive logging - only log in debug mode
    if (window.DEBUG_MODE) {
      console.log(`🔧 [Canvas] Partial sequence display (FIXED coordinate system):`, {
        readId: read.id,
        originalGenomicStart: read.start,
        originalGenomicEnd: read.end,
        correctedGenomicStart: genomicStart,
        correctedGenomicEnd: genomicEnd,
        visibleStart,
        visibleEnd,
        startOffset,
        endOffset,
        startIndex,
        endIndex,
        visibleLength: visibleSequence.length,
        actualSequenceLength: actualReadLength,
        coordinateSystemFix: 'using sequence length as source of truth',
      });
    }

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
    const readHeight = this.effectiveReadHeight || this.options.readHeight;

    // Choose font size based on auto-calculate setting.
    let fontSize;
    if (this.options.autoFontSize !== false) {
      // Auto mode: size read bases exactly like the reference sequence (purely
      // from the horizontal zoom) so they render at the same, readable size
      // instead of being shrunk to fit the thin read bar.
      fontSize = this.getReadSequenceFontSize();
    } else {
      // Manual mode: use user-specified font size settings
      fontSize = this.options.sequenceFontSize || 6;

      // Be more lenient with character spacing - allow tighter packing at high zoom
      if (charSpacing < fontSize * 0.4) {
        // More lenient threshold
        fontSize = Math.max(charSpacing / 0.4, this.options.minFontSize || 4); // Scale down font if needed
      }
    }

    // Set font with chosen size. Bold matches the reference band for legibility.
    this.ctx.font = `bold ${fontSize}px 'Courier New', monospace`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    const textY = y + readHeight / 2;

    // Calculate character width for proper positioning
    const actualCharWidth = this.ctx.measureText('M').width;

    // Render only the visible portion of the sequence
    let charactersRendered = 0;
    for (let i = 0; i < visibleSequence.length; i++) {
      const base = visibleSequence[i].toUpperCase();
      const baseX = x + i * charSpacing + charSpacing / 2;

      // More lenient character spacing - allow tighter packing at high zoom levels
      if (actualCharWidth <= charSpacing * 1.5) {
        // Even more lenient overlap allowance
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

  renderMismatches(read, x, y, width) {
    if (!read.mismatches) return;

    // Highlight mismatch positions
    read.mismatches.forEach(mismatch => {
      const mismatchPos = mismatch.pos - read.start;
      if (mismatchPos >= 0 && mismatchPos < read.sequence.length) {
        const mismatchX = x + (mismatchPos / read.sequence.length) * width;
        const mismatchWidth = Math.max(2, width / read.sequence.length);

        this.ctx.fillStyle = this.mismatchColor;
        this.ctx.fillRect(mismatchX, y - 1, mismatchWidth, (this.effectiveReadHeight || this.options.readHeight) + 2);
      }
    });
  }

  renderMutations(read, x, y, width) {
    if (!read.mutations) return;

    read.mutations.forEach(mutation => {
      const mutationPosInRead = mutation.position - read.start;
      const readLength = read.sequence ? read.sequence.length : read.end - read.start + 1;

      if (mutationPosInRead >= 0 && mutationPosInRead <= readLength) {
        const relativeX = x + (mutationPosInRead / readLength) * width;

        this.ctx.strokeStyle = mutation.color;

        if (mutation.type === 'insertion') {
          this.ctx.lineWidth = 1.5;
          this.ctx.setLineDash([2, 1]);
        } else if (mutation.type === 'deletion') {
          this.ctx.lineWidth = 2;
          this.ctx.setLineDash([]);
        } else {
          this.ctx.lineWidth = 1;
          this.ctx.setLineDash([]);
        }

        this.ctx.beginPath();
        this.ctx.moveTo(relativeX, y);
        this.ctx.lineTo(relativeX, y + (this.effectiveReadHeight || this.options.readHeight));
        this.ctx.stroke();

        // Reset dashed line
        this.ctx.setLineDash([]);
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

  hexToRgba(hex, alpha) {
    // Convert hex color to rgba string
    if (hex.startsWith('#')) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    // If already rgb/rgba, return as is or handle conversion
    if (hex.startsWith('rgb')) {
      return hex;
    }
    return hex;
  }

  handleCanvasClick(event) {
    console.log('🖱️ [CanvasReadsRenderer] Canvas clicked');

    // Get canvas coordinates
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;

    for (const readPos of this.readPositions) {
      if (
        canvasX >= readPos.x &&
        canvasX <= readPos.x + readPos.width &&
        canvasY >= readPos.y &&
        canvasY <= readPos.y + readPos.height
      ) {
        const read = readPos.read;

        const clickedMutation = this.findClickableMutationAt(read, readPos, canvasX);
        if (clickedMutation) {
          if (window.genomeBrowser && window.genomeBrowser.selectMutation) {
            window.genomeBrowser.selectMutation(read, clickedMutation);
            return;
          }
        }

        // If no mutation clicked, handle read selection
        this.showReadDetails(read);
        return;
      }
    }
  }

  findClickableMutationAt(read, readPos, canvasX) {
    if (!read.mutations || read.mutations.length === 0) return null;
    if (readPos.width < 50) return null;

    const readLength = read.sequence ? read.sequence.length : read.end - read.start + 1;
    const items = [];
    for (const mutation of read.mutations) {
      const offset = mutation.position - read.start;
      if (offset >= 0 && offset <= readLength) {
        const mx = readPos.x + (offset / readLength) * readPos.width;
        items.push({ mutation, mx });
      }
    }
    if (items.length === 0) return null;

    items.sort((a, b) => a.mx - b.mx);

    let best = null;
    let bestDist = Infinity;
    for (let i = 0; i < items.length; i++) {
      const dist = Math.abs(canvasX - items[i].mx);
      const prevGap = i > 0 ? items[i].mx - items[i - 1].mx : Infinity;
      const nextGap = i < items.length - 1 ? items[i + 1].mx - items[i].mx : Infinity;
      const minGap = Math.min(prevGap, nextGap);
      if (minGap < 5) continue;
      const tolerance = Math.min(3, minGap / 2);
      if (dist <= tolerance && dist < bestDist) {
        bestDist = dist;
        best = items[i].mutation;
      }
    }
    return best;
  }

  getReadAtPosition(event) {
    // Get canvas coordinates
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;

    // Check if click is within any read
    for (const readPos of this.readPositions) {
      if (
        canvasX >= readPos.x &&
        canvasX <= readPos.x + readPos.width &&
        canvasY >= readPos.y &&
        canvasY <= readPos.y + readPos.height
      ) {
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
      alert(
        `Read: ${read.id}\nPosition: ${read.start}-${read.end}\nStrand: ${read.strand}\nMapping Quality: ${read.mappingQuality}`
      );
    }
  }

  setupResizeObserver() {
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
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

  // Update canvas width after container size changes (e.g., splitter adjustment)
  updateWidth() {
    console.log('🔄 [CanvasReadsRenderer] Updating canvas width after container resize');

    const oldWidth = this.canvasWidth;

    // Re-run full canvas setup: a width change alters pixels-per-bp, which can
    // change the effective read height (and therefore the canvas/host height)
    // when sequence letters are shown, so width and height must be recomputed
    // together.
    this.setupCanvas();

    console.log('📐 [CanvasReadsRenderer] Width update:', {
      oldWidth: oldWidth,
      newWidth: this.canvasWidth,
      changed: oldWidth !== this.canvasWidth,
    });

    // Only re-render if width actually changed
    if (oldWidth !== this.canvasWidth) {
      // Update text metrics if showing sequences
      if (this.options.showSequences) {
        this.calculateTextMetrics();
      }

      // Re-render with new width
      this.render();
    }
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

    // Recalculate metrics + canvas size if options that affect the row height or
    // sequence display changed (these change the effective read height and thus
    // the canvas/host height, not just the drawing).
    if (
      newOptions.showSequences !== undefined ||
      newOptions.autoFontSize !== undefined ||
      newOptions.minFontSize !== undefined ||
      newOptions.maxFontSize !== undefined ||
      newOptions.referenceFontSize !== undefined ||
      newOptions.sequenceFontSize !== undefined ||
      newOptions.readHeight !== undefined
    ) {
      this.setupCanvas();
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
      totalRows: this.readRows.length,
    };
  }

  // Clean up resources
  destroy() {
    console.log('🧹 [CanvasReadsRenderer] Cleaning up Canvas reads renderer');

    // Cancel pending initial render if any
    if (this._pendingInitialRender) {
      cancelAnimationFrame(this._pendingInitialRender);
      this._pendingInitialRender = null;
    }

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
