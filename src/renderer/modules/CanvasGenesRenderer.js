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
      ...settings,
    };

    // Cache for gene gradients to avoid recreating them constantly
    this.gradientCache = new Map();

    // Track gene positions for interaction
    this.geneHitRegions = [];
    this.hoveredGene = null;

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
            height: 100%;
            display: block;
            image-rendering: crisp-edges;
            z-index: 10;
            pointer-events: auto;
            opacity: 0;
            transition: opacity 0.1s ease-out;
        `;

    // Get 2D context
    this.ctx = this.canvas.getContext('2d', { alpha: true });

    // Setup canvas container
    this.setupContainer();

    // Defer setupCanvas + render to next frame so the container has time
    // to be inserted into the DOM, giving getBoundingClientRect() accurate dimensions.
    // Without this, the container is not yet in the DOM during constructor,
    // so getBoundingClientRect() returns 0 and we fall back to 800px,
    // causing a visible "shrink then expand" flash on navigation.
    this.setupInteractionHandlers();
    this.setupResizeObserver();

    // Use requestAnimationFrame to defer initial render until the container
    // is in the DOM and has proper layout dimensions
    this._pendingInitialRender = requestAnimationFrame(() => {
      this._pendingInitialRender = null;
      this.setupCanvas();
      this.render();
      // Fade in the canvas now that it has correct dimensions
      this.canvas.style.opacity = '1';
    });

    console.log('✅ [CanvasGenesRenderer] Initialized successfully (deferred render)');
  }

  setupContainer() {
    // Clear SVG or other content if any, but preserve ruler if it exists as a separate sibling
    // In the unified container model, this container is dedicated to genes content
    this.container.innerHTML = '';
    this.container.appendChild(this.canvas);
  }

  setupCanvas() {
    // Measure container — try multiple strategies to get an accurate width
    // 1. Direct container rect (works when container is in DOM)
    const rect = this.container.getBoundingClientRect();
    let width = rect.width;

    // 2. If container not in DOM yet (width = 0), try parent chain
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

    // 3. Final fallback: estimate from window width minus typical sidebar/padding
    if (!width || width <= 0) {
      const sidebarEl = document.querySelector('.sidebar, #sidebar, .side-panel');
      const sidebarWidth = sidebarEl ? sidebarEl.offsetWidth : 300;
      width = window.innerWidth - sidebarWidth - 40;
    }

    this.canvasWidth = Math.max(width, 200); // Minimum reasonable width

    // Height provided by layout
    const contentHeight = this.layout.totalHeight - this.layout.rulerHeight;
    this.canvasHeight = contentHeight;

    // Set canvas dimensions with DPR scaling
    this.canvas.width = this.canvasWidth * this.devicePixelRatio;
    this.canvas.height = this.canvasHeight * this.devicePixelRatio;

    // Set logical CSS dimensions
    this.canvas.style.width = `${this.canvasWidth}px`;
    this.canvas.style.height = `${this.canvasHeight}px`;

    // Reset transform before applying DPR scale to prevent accumulation
    this.ctx.setTransform(this.devicePixelRatio, 0, 0, this.devicePixelRatio, 0, 0);
  }

  setupInteractionHandlers() {
    // Click handler
    this.canvas.addEventListener('click', e => this.handleCanvasClick(e));

    // Hover/Cursor handler
    this.canvas.addEventListener('mousemove', e => this.handleMouseMove(e));

    // Right-click context menu
    this.canvas.addEventListener('contextmenu', e => this.handleCanvasContextMenu(e));

    // Mouse leave
    this.canvas.addEventListener('mouseleave', () => {
      this.canvas.style.cursor = 'default';
    });
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
    // Calculate dimensions and position.
    // Gene coordinates are 1-based (GFF/GenBank), while the viewport and the
    // base/sequence/ruler rendering treat positions as 0-based array indices.
    // Subtract 1 from the start so the gene's left edge aligns with the left
    // edge of its first base cell — matching the SVG renderer
    // (createSVGGeneElement), the HTML positioner (setGeneElementPosition) and
    // the secondary coordinate ruler. Without this, canvas-rendered genes sit
    // one base to the right of (and one base narrower than) the secondary scale
    // and the sequence track. The end needs no adjustment: a 1-based inclusive
    // end maps to the same value as a 0-based exclusive end.
    const geneStart = Math.max(gene.start - 1, this.viewport.start);
    const geneEnd = Math.min(gene.end, this.viewport.end);

    const leftPercent = (geneStart - this.viewport.start) / (this.viewport.end - this.viewport.start);
    const widthPercent = (geneEnd - geneStart) / (this.viewport.end - this.viewport.start);

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
      x,
      y,
      width: elementWidth,
      height,
      rowIndex,
    });

    // Save context for this gene
    this.ctx.save();
    this.ctx.translate(x, y);

    // Check for selection state (matching SVG logic)
    const isSelected =
      this.genomeBrowser &&
      this.genomeBrowser.selectedGene &&
      this.genomeBrowser.selectedGene.gene &&
      this.genomeBrowser.selectedGene.gene.start === gene.start &&
      this.genomeBrowser.selectedGene.gene.end === gene.end &&
      this.genomeBrowser.selectedGene.gene.type === gene.type;

    if (isSelected) {
      this.ctx.shadowBlur = 10;
      this.ctx.shadowColor = 'rgba(0, 100, 200, 0.8)';
      // Also subtly scale selected gene if desired, but shadow is the main SVG effect
    }

    // Apply hover effects (consistent with SVG)
    const isHovered =
      this.hoveredGene &&
      this.hoveredGene.start === gene.start &&
      this.hoveredGene.end === gene.end &&
      this.hoveredGene.type === gene.type;

    if (isHovered) {
      this.ctx.globalAlpha = 0.8;
      this.ctx.scale(1.02, 1.02); // subtle scale (SVG is 1.05, but canvas scaling might clipping edges if not careful)
      // Center scaling by adjusting translation
      const scaleOffsetW = (elementWidth * 0.02) / 2;
      const scaleOffsetH = (height * 0.02) / 2;
      this.ctx.translate(-scaleOffsetW, -scaleOffsetH);
    }

    // Draw the shape
    this.drawGeneShape(gene, elementWidth, height, operonInfo, isLeftTruncated, isRightTruncated, strokeWidth);

    // Reset global alpha and shadow for text and other elements
    this.ctx.globalAlpha = 1.0;
    this.ctx.shadowBlur = 0;
    this.ctx.shadowColor = 'transparent';

    // Draw label if space permits (matching SVG behavior which ignores compact mode if safe)
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
    this.getGradientId(geneType);

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
    this.ctx.font = `500 ${fontSize}px ${this.settings.fontFamily}`;
    this.ctx.fillStyle = this.settings.geneNameColor || '#333333';
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
    const isForward = gene.strand !== -1 && gene.strand !== '-1'; // Handle numeric and string "-1"
    const arrowSize = Math.max(2, Math.min(width * 0.3, 15));

    // Zigzag parameters
    const zDepth = 4; // Depth of the zigzag notch
    const numZigzags = 3;
    const zStep = height / numZigzags;

    // If gene is very small AND NOT truncated, draw simple triangle
    // If it is truncated, we treat it as a bar/arrow regardless of width to maintain continuity
    if (width < 8 && !isLeftTruncated && !isRightTruncated) {
      // Triangle shape for small genes (only when fully visible)
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
      // Arrow / Bar shape with potential zigzags
      if (isForward) {
        // === Forward Gene ===

        // 1. Start / Left Edge
        if (isLeftTruncated) {
          this.ctx.moveTo(0, 0);
        } else {
          this.ctx.moveTo(0, 0);
        }

        // 2. Top Edge -> Right Edge
        if (isRightTruncated) {
          this.ctx.lineTo(width, 0);
          // Zigzag Down on Right Edge
          for (let i = 0; i < numZigzags; i++) {
            const yTop = i * zStep;
            this.ctx.lineTo(width - zDepth, yTop + zStep / 2); // Notch In
            this.ctx.lineTo(width, (i + 1) * zStep); // Point Out
          }
        } else {
          // Standard Arrow Head
          this.ctx.lineTo(width - arrowSize, 0);
          this.ctx.lineTo(width, height / 2);
          this.ctx.lineTo(width - arrowSize, height);
        }

        // 3. Bottom Edge -> Left Edge
        this.ctx.lineTo(0, height);

        if (isLeftTruncated) {
          // Zigzag Up on Left Edge
          for (let i = 0; i < numZigzags; i++) {
            // Going UP from bottom
            const yBottom = height - i * zStep;
            this.ctx.lineTo(zDepth, yBottom - zStep / 2); // Notch In
            this.ctx.lineTo(0, yBottom - zStep); // Point Out
          }
        } else {
          // Close back to top-left
          this.ctx.lineTo(0, 0);
        }
      } else {
        // === Reverse Gene ===

        // 1. Start / Left Edge (Arrow Head or Zigzag)
        if (isLeftTruncated) {
          this.ctx.moveTo(0, 0);
        } else {
          this.ctx.moveTo(arrowSize, 0);
        }

        // 2. Top Edge -> Right Edge
        this.ctx.lineTo(width, 0);

        if (isRightTruncated) {
          // Zigzag Down on Right Edge
          for (let i = 0; i < numZigzags; i++) {
            const yTop = i * zStep;
            this.ctx.lineTo(width - zDepth, yTop + zStep / 2); // Notch In
            this.ctx.lineTo(width, (i + 1) * zStep); // Point Out
          }
        } else {
          // Flat Right Edge
          this.ctx.lineTo(width, height);
        }

        // 3. Bottom Edge -> Left Edge
        if (isLeftTruncated) {
          this.ctx.lineTo(0, height);
          // Zigzag Up on Left Edge
          for (let i = 0; i < numZigzags; i++) {
            const yBottom = height - i * zStep;
            this.ctx.lineTo(zDepth, yBottom - zStep / 2); // Notch In
            this.ctx.lineTo(0, yBottom - zStep); // Point Out
          }
        } else {
          this.ctx.lineTo(arrowSize, height);
          // Arrow Head Pointing Left
          this.ctx.lineTo(0, height / 2);
          this.ctx.lineTo(arrowSize, 0);
        }
      }
    }

    this.ctx.closePath();
  }

  /**
   * Draw specialized shapes
   */
  drawSpecializedShapePath(gene, width, height, isLeftTruncated, isRightTruncated) {
    const geneType = gene.type.toLowerCase();
    const isForward = gene.strand !== -1 && gene.strand !== '-1';

    // Custom shapes for specific types
    if (geneType === 'rrna') {
      // rRNA: Geometric Ellipse
      const rx = width / 2;
      const ry = (height * 0.8) / 2;
      this.ctx.beginPath();
      this.ctx.ellipse(width / 2, height / 2, rx, ry, 0, 0, 2 * Math.PI);
      this.ctx.closePath();
      return;
    }

    if (geneType === 'trna') {
      // tRNA: Cloverleaf or Rounded Rect
      if (width < 15) {
        // Simple rounded rect for small
        const r = Math.min(height * 0.3, width * 0.2, 3);
        this.ctx.beginPath();
        this.ctx.roundRect(0, 0, width, height, r);
        this.ctx.closePath();
        return;
      }

      // Simplified Cloverleaf for Canvas
      const centerX = width / 2;
      const loopRadius = Math.min(height * 0.15, width * 0.12);
      const stemWidth = Math.max(2, width * 0.15);
      const loopY = height * 0.35;

      // Visual approximation of cloverleaf using arcs and rects
      this.ctx.beginPath();
      // Stem
      this.ctx.moveTo(centerX - stemWidth / 2, height);
      this.ctx.lineTo(centerX - stemWidth / 2, loopY);
      // Stem Crossbar (Loops base)
      this.ctx.lineTo(centerX - stemWidth / 2 - loopRadius, loopY);
      // Left Loop
      this.ctx.arc(centerX - stemWidth / 2 - loopRadius, loopY - loopRadius, loopRadius, 0.5 * Math.PI, 2.5 * Math.PI);
      // Top Loop
      this.ctx.moveTo(centerX + loopRadius, loopY - loopRadius * 2);
      this.ctx.arc(centerX, loopY - loopRadius * 2, loopRadius, 0, 2 * Math.PI);
      // Right Loop
      this.ctx.moveTo(centerX + stemWidth / 2 + loopRadius * 2, loopY - loopRadius);
      this.ctx.arc(centerX + stemWidth / 2 + loopRadius, loopY - loopRadius, loopRadius, -0.5 * Math.PI, 1.5 * Math.PI);
      // Back to stem
      this.ctx.lineTo(centerX + stemWidth / 2, loopY);
      this.ctx.lineTo(centerX + stemWidth / 2, height);
      this.ctx.closePath();
      return;
    }

    if (geneType === 'repeat_region') {
      // Repeat Region: Stacked Capsules
      const capsuleCount = 3;
      const spacing = height < 12 ? 0 : height / 20;
      const totalSpacing = spacing * (capsuleCount - 1);
      const capsuleHeight = (height - totalSpacing) / capsuleCount;
      const rx = capsuleHeight / 2;

      this.ctx.beginPath();
      for (let i = 0; i < capsuleCount; i++) {
        const y = i * (capsuleHeight + spacing);
        this.ctx.roundRect(0, y, width, capsuleHeight, rx);
      }
      // Note: closePath not needed for disjoint rects but good practice
      return;
    }

    switch (geneType) {
      case 'promoter':
        this.drawPromoterPath(width, height, isForward);
        break;
      case 'terminator':
        this.drawTerminatorPath(width, height, isForward);
        break;
      default:
        // Fallback to standard arrow for others (mrna, etc)
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
        end: this.lightenColor(baseColor, 20),
      };
    }

    // Specialized colors
    switch (geneType) {
      case 'promoter':
        return { start: '#1e40af', end: '#3b82f6' };
      case 'terminator':
        return { start: '#7f1d1d', end: '#dc2626' };
      case 'regulatory':
        return { start: '#c2410c', end: '#f97316' };
      case 'repeat_region':
        return { start: '#374151', end: '#6b7280' };
      case 'trna':
        return { start: '#166534', end: '#22c55e' };
      case 'rrna':
        return { start: '#14532d', end: '#16a34a' };
      case 'mrna':
        return { start: '#15803d', end: '#4ade80' };
      case 'comment':
      case 'note':
      case 'misc_feature':
        return { start: '#7c3aed', end: '#a855f7' };
      default:
        return { start: baseColor, end: this.lightenColor(baseColor, 20) };
    }
  }

  shouldUseSpecializedShape(geneType) {
    const specializedTypes = [
      'promoter',
      'terminator',
      'regulatory',
      'repeat_region',
      'trna',
      'rrna',
      'mrna',
      'comment',
      'note',
      'misc_feature',
    ];
    return specializedTypes.includes(geneType);
  }

  getGradientId(geneType) {
    // Simplified ID generation for cache key if implemented, acts as type normalizer here
    return geneType;
  }

  getGeneName(gene) {
    // Helper to extract name with same priority logic as SVG renderer
    if (!this.genomeBrowser) return gene.type;
    return (
      this.genomeBrowser.getQualifierValue(gene.qualifiers, 'gene') ||
      this.genomeBrowser.getQualifierValue(gene.qualifiers, 'locus_tag') ||
      this.genomeBrowser.getQualifierValue(gene.qualifiers, 'product') ||
      gene.type
    );
  }

  // Interaction handlers
  handleCanvasClick(event) {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Find clicked gene (reverse order to hit top-most if overlap)
    for (let i = this.geneHitRegions.length - 1; i >= 0; i--) {
      const region = this.geneHitRegions[i];
      if (x >= region.x && x <= region.x + region.width && y >= region.y && y <= region.y + region.height) {
        console.log('Canvas gene clicked:', region.gene);

        // Trigger selection in TrackRenderer (consistent with SVG)
        if (this.genomeBrowser && this.genomeBrowser.trackRenderer) {
          this.genomeBrowser.trackRenderer.showGeneDetails(region.gene, region.operonInfo);
        }
        return;
      }
    }
  }

  handleCanvasContextMenu(event) {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Find clicked gene
    for (let i = this.geneHitRegions.length - 1; i >= 0; i--) {
      const region = this.geneHitRegions[i];
      if (x >= region.x && x <= region.x + region.width && y >= region.y && y <= region.y + region.height) {
        event.preventDefault();
        console.log('Canvas gene context menu:', region.gene);

        if (this.genomeBrowser && this.genomeBrowser.trackRenderer) {
          this.genomeBrowser.trackRenderer.showGeneContextMenu(event, region.gene);
        }
        return;
      }
    }
  }

  handleMouseMove(event) {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    let newHoveredGene = null;
    for (let i = this.geneHitRegions.length - 1; i >= 0; i--) {
      const region = this.geneHitRegions[i];
      if (x >= region.x && x <= region.x + region.width && y >= region.y && y <= region.y + region.height) {
        newHoveredGene = region.gene;
        break;
      }
    }

    // Only re-render if hover state changed
    const isSameGene = (a, b) => {
      if (!a || !b) return a === b;
      return a.start === b.start && a.end === b.end && a.type === b.type;
    };

    if (!isSameGene(this.hoveredGene, newHoveredGene)) {
      this.hoveredGene = newHoveredGene;
      this.canvas.style.cursor = this.hoveredGene ? 'pointer' : 'default';

      // Update tooltip (title attribute)
      if (this.hoveredGene) {
        const region = this.geneHitRegions.find(r => r.gene === this.hoveredGene);
        this.canvas.title = this.formatTooltip(this.hoveredGene, region ? region.rowIndex : 0);
      } else {
        this.canvas.title = '';
      }

      this.render(); // Re-render for hover effect
    }
  }

  formatTooltip(gene, rowIndex) {
    const geneName = this.getGeneName(gene);
    const geneInfo = `${geneName} (${gene.type})`;
    const positionInfo = `${gene.start}-${gene.end} (${gene.strand === -1 ? '-' : '+'} strand)`;

    // Get operon info
    const operonInfo = this.genomeBrowser
      ? this.genomeBrowser.getGeneOperonInfo(gene, this.operons)
      : { isInOperon: false };
    const operonDisplay = operonInfo.isInOperon ? `\nOperon: ${operonInfo.operonName}` : '\nSingle gene';
    const rowInfo = `\nRow: ${rowIndex + 1}`;

    // Add truncation info if needed
    let truncationInfo = '';
    if (gene.start < this.viewport.start && gene.end > this.viewport.end) {
      truncationInfo = '\n⚠️ Gene extends beyond both edges';
    } else if (gene.start < this.viewport.start) {
      truncationInfo = '\n⚠️ Gene extends beyond left edge';
    } else if (gene.end > this.viewport.end) {
      truncationInfo = '\n⚠️ Gene extends beyond right edge';
    }

    return `${geneInfo}\nPosition: ${positionInfo}${operonDisplay}${rowInfo}${truncationInfo}`;
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
    if (this._pendingInitialRender) {
      cancelAnimationFrame(this._pendingInitialRender);
      this._pendingInitialRender = null;
    }
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
