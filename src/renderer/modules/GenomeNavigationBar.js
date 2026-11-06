/**
 * GenomeNavigationBar - Interactive ruler-style navigation for the genome viewer
 *
 * The viewer has two rulers:
 * - this primary ruler: a whole-chromosome overview used only for navigation
 *   (click to jump, drag/resize the viewport box, double-click to zoom);
 * - the secondary coordinate ruler (TrackRenderer.createCoordinateRulerBar):
 *   the viewport axis aligned with the tracks, which owns sequence selection.
 *
 * Their visibility is one persisted setting, `ui.rulerDisplayMode`:
 * - 'full':    primary expanded, secondary shown
 * - 'compact': primary collapsed, secondary shown (default)
 * - 'minimal': primary collapsed, secondary hidden
 */
/* eslint-disable no-unused-vars */
class GenomeNavigationBar {
  static RULER_DISPLAY_MODES = ['full', 'compact', 'minimal'];
  static DEFAULT_RULER_DISPLAY_MODE = 'compact';
  static RULER_DISPLAY_CONFIG_KEY = 'ui.rulerDisplayMode';
  static RULER_DISPLAY_LABELS = {
    full: { label: 'Full', icon: 'fa-ruler-combined', detail: 'overview and coordinate rulers' },
    compact: { label: 'Compact', icon: 'fa-ruler-horizontal', detail: 'slim overview and coordinate ruler' },
    minimal: { label: 'Minimal', icon: 'fa-minus', detail: 'slim overview only' },
  };

  static normalizeRulerDisplayMode(mode) {
    return GenomeNavigationBar.RULER_DISPLAY_MODES.includes(mode)
      ? mode
      : GenomeNavigationBar.DEFAULT_RULER_DISPLAY_MODE;
  }

  constructor(genomeBrowser) {
    this.genomeBrowser = genomeBrowser;
    this.container = null;
    this.canvas = null;
    this.ctx = null;
    this.isVisible = false;
    this.rulerDisplayMode = GenomeNavigationBar.DEFAULT_RULER_DISPLAY_MODE;
    this.height = 60; // Height of the navigation bar
    this.collapsedHeight = 28; // Height when collapsed
    this.majorTickHeight = 20;
    this.minorTickHeight = 10;
    this.labelOffset = 35;
    this.currentChromosome = null;
    this.sequenceLength = 0;

    // Range interaction state
    this.isDragging = false;
    this.isResizing = false;
    this.resizeHandle = null; // 'left', 'right', or null
    this.dragStartX = 0;
    this.dragStartRange = { start: 0, end: 0 };
    this.tempRange = null; // Temporary range during drag/resize operations
    this.handleWidth = 8; // Width of resize handles

    this.initialize();
  }

  /** The primary ruler is drawn slim in every mode except 'full'. */
  get isRulerCollapsed() {
    return this.rulerDisplayMode !== 'full';
  }

  get currentHeight() {
    return this.isRulerCollapsed ? this.collapsedHeight : this.height;
  }

  initialize() {
    this.createNavigationBar();
    this.setupEventListeners();
    this.applyRulerDisplayLayout();
    this.applySavedRulerDisplayMode();
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

    // Single ruler display control: cycles Full -> Compact -> Minimal. It is
    // the only place to show/hide the secondary coordinate ruler, so it works
    // even for FASTA files that have no Genes & Features track.
    this.rulerModeToggle = document.createElement('button');
    this.rulerModeToggle.type = 'button';
    this.rulerModeToggle.className = 'ruler-mode-toggle-btn';
    this.rulerModeToggle.style.cssText = `
            position: absolute;
            top: 2px;
            right: 2px;
            width: 24px;
            height: 24px;
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            background: #ffffff;
            cursor: pointer;
            z-index: 10;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            color: #64748b;
            transition: all 0.2s ease;
        `;

    // Add tooltip for position display
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'navigation-tooltip';
    this.tooltip.style.display = 'none';

    // Assemble the navigation bar
    this.container.appendChild(this.canvas);
    this.container.appendChild(this.positionIndicator);
    this.container.appendChild(this.rangeIndicator);
    this.container.appendChild(this.rulerModeToggle);
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
    const resizeObserver = new ResizeObserver(() => {
      this.resizeCanvas();
      this.draw();
    });
    resizeObserver.observe(this.container);

    // Mouse events for navigation and range interaction
    this.canvas.addEventListener('mousedown', e => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', e => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseup', e => this.handleMouseUp(e));
    this.canvas.addEventListener('mouseleave', e => this.handleMouseLeave(e));
    this.canvas.addEventListener('dblclick', e => this.handleDoubleClick(e));

    // Ruler display mode (Full / Compact / Minimal)
    this.rulerModeToggle.addEventListener('click', e => {
      e.preventDefault();
      this.cycleRulerDisplayMode();
    });

    // Keyboard navigation
    this.canvas.addEventListener('keydown', e => this.handleKeyDown(e));
    this.canvas.setAttribute('tabindex', '0');

    console.log('GenomeNavigationBar: Event listeners set up');
  }

  resizeCanvas() {
    const rect = this.container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const currentHeight = this.currentHeight;

    this.canvas.width = rect.width * dpr;
    this.canvas.height = currentHeight * dpr;

    this.ctx.scale(dpr, dpr);
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = currentHeight + 'px';
  }

  show(chromosome, sequenceLength) {
    this.currentChromosome = chromosome;
    this.sequenceLength = sequenceLength;
    this.isVisible = true;

    this.container.style.display = 'block';
    this.resizeCanvas();
    this.draw();

    // show() runs before the tracks are rebuilt, so the coordinate ruler bar
    // created next picks up the current display mode.
    this.syncSecondaryRuler();

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
    const height = this.currentHeight;

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Set font and styles
    this.ctx.font = this.isRulerCollapsed ? '9px Inter, sans-serif' : '11px Inter, sans-serif';
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

    // Adjust heights and offsets for collapsed mode
    const majorH = this.isRulerCollapsed ? 6 : this.majorTickHeight;
    const minorH = this.isRulerCollapsed ? 3 : this.minorTickHeight;
    const labelY = this.isRulerCollapsed ? 12 : this.labelOffset;

    // Draw minor ticks (only if not collapsed for better clarity)
    if (!this.isRulerCollapsed) {
      this.ctx.strokeStyle = '#cbd5e1';
      this.ctx.lineWidth = 0.5;
      for (let pos = 0; pos <= this.sequenceLength; pos += minorInterval) {
        const x = pos * scale;
        this.ctx.beginPath();
        this.ctx.moveTo(x, height - minorH);
        this.ctx.lineTo(x, height);
        this.ctx.stroke();
      }
    }

    // Draw major ticks and labels
    this.ctx.strokeStyle = '#64748b';
    this.ctx.fillStyle = '#334155';
    this.ctx.lineWidth = 1;

    for (let pos = 0; pos <= this.sequenceLength; pos += majorInterval) {
      const x = pos * scale;

      // Draw major tick
      this.ctx.beginPath();
      this.ctx.moveTo(x, height - majorH);
      this.ctx.lineTo(x, height);
      this.ctx.stroke();

      // Draw label (simplified in collapsed mode)
      if (!this.isRulerCollapsed || pos % (majorInterval * 2) === 0) {
        const label = this.formatPosition(pos);
        this.ctx.fillText(label, x, labelY);
      }
    }

    // Draw origin marker in circular mode
    if (this.isCircularModeEnabled()) {
      this.drawOriginMarker();
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

  /**
   * Check if circular browsing mode is enabled
   * @returns {boolean} True if circular mode is active
   */
  isCircularModeEnabled() {
    return this.genomeBrowser?.navigationManager?.circularMode || false;
  }

  /**
   * Draw origin marker at position 0 when in circular mode
   */
  drawOriginMarker() {
    const originX = 0; // Origin is always at position 0

    // Draw dashed vertical line at origin
    this.ctx.save();
    this.ctx.strokeStyle = '#22c55e'; // Green color for origin
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([4, 4]);
    this.ctx.beginPath();
    this.ctx.moveTo(originX, 0);
    this.ctx.lineTo(originX, this.height);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    // Draw "Origin" label
    this.ctx.fillStyle = '#22c55e';
    this.ctx.font = 'bold 9px Inter, sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.fillText('Origin', originX + 4, 12);
    this.ctx.restore();
  }

  drawRangeIndicator() {
    if (!this.genomeBrowser.currentPosition) return;

    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const scale = width / this.sequenceLength;
    const isCircular = this.isCircularModeEnabled();

    // Use temporary range if dragging/resizing, otherwise use current position
    const range = this.tempRange || this.genomeBrowser.currentPosition;

    // Check if viewport wraps around in circular mode
    const wrapsRight = isCircular && range.end > this.sequenceLength;
    const wrapsLeft = isCircular && range.start < 0;

    if (wrapsRight) {
      // Viewport wraps: draw two segments (start to seqLen, 0 to wrappedEnd)
      const wrappedEnd = range.end % this.sequenceLength;

      // First segment: from start to sequence end
      const startX1 = range.start * scale;
      const endX1 = this.sequenceLength * scale;
      this.drawRangeSegment(startX1, endX1);

      // Second segment: from 0 to wrapped end
      const startX2 = 0;
      const endX2 = wrappedEnd * scale;
      this.drawRangeSegment(startX2, endX2);

      // Draw resize handles at the actual visual positions
      this.drawResizeHandles(startX1, endX2);
    } else if (wrapsLeft) {
      // Left wrap: viewport.start < 0
      const normalizedStart = this.sequenceLength + range.start; // e.g., -1000 -> seqLen - 1000

      // First segment: from normalizedStart to sequence end
      const startX1 = normalizedStart * scale;
      const endX1 = this.sequenceLength * scale;
      this.drawRangeSegment(startX1, endX1);

      // Second segment: from 0 to end
      const startX2 = 0;
      const endX2 = range.end * scale;
      this.drawRangeSegment(startX2, endX2);

      // Draw resize handles
      this.drawResizeHandles(startX1, endX2);
    } else {
      // Normal case: no wrapping
      const startX = range.start * scale;
      const endX = range.end * scale;
      const rangeWidth = endX - startX;
      const height = this.currentHeight;

      // Draw highlighted range
      this.ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
      this.ctx.fillRect(startX, 0, rangeWidth, height);

      // Draw range borders
      this.ctx.strokeStyle = '#3b82f6';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(startX, 0);
      this.ctx.lineTo(startX, height);
      this.ctx.moveTo(endX, 0);
      this.ctx.lineTo(endX, height);
      this.ctx.stroke();

      // Draw resize handles
      this.drawResizeHandles(startX, endX);
    }
  }

  /**
   * Draw a single range segment (used for circular wrapping)
   */
  drawRangeSegment(startX, endX) {
    const rangeWidth = endX - startX;
    const height = this.currentHeight;

    // Draw highlighted range
    this.ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
    this.ctx.fillRect(startX, 0, rangeWidth, height);

    // Draw range borders
    this.ctx.strokeStyle = '#3b82f6';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(startX, 0);
    this.ctx.lineTo(startX, height);
    this.ctx.moveTo(endX, 0);
    this.ctx.lineTo(endX, height);
    this.ctx.stroke();
  }

  drawResizeHandles(startX, endX) {
    const height = this.currentHeight;
    const halfH = height / 2;
    const hw = this.handleWidth;

    // Left handle: top half only — easier to distinguish from right handle at small ranges
    this.ctx.fillStyle = '#3b82f6';
    this.ctx.fillRect(startX - hw / 2, 0, hw, halfH);
    // Highlight
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    this.ctx.fillRect(startX - hw / 2 + 1, 2, hw - 2, halfH - 4);

    // Right handle: bottom half only
    this.ctx.fillStyle = '#3b82f6';
    this.ctx.fillRect(endX - hw / 2, halfH, hw, halfH);
    // Highlight
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    this.ctx.fillRect(endX - hw / 2 + 1, halfH + 2, hw - 2, halfH - 4);
  }

  getInteractionType(x, y) {
    if (!this.genomeBrowser.currentPosition) return 'none';

    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const scale = width / this.sequenceLength;
    const halfH = this.currentHeight / 2;

    const range = this.tempRange || this.genomeBrowser.currentPosition;
    const startX = range.start * scale;
    const endX = range.end * scale;

    // Check for resize handles (left=top half, right=bottom half)
    if (Math.abs(x - startX) <= this.handleWidth / 2 && y <= halfH) {
      return 'resize-left';
    }
    if (Math.abs(x - endX) <= this.handleWidth / 2 && y > halfH) {
      return 'resize-right';
    }

    // Fallback: check full-height handles for easier targeting when range is wide enough
    if (Math.abs(x - startX) <= this.handleWidth / 2 && y > halfH) {
      return 'resize-left';
    }
    if (Math.abs(x - endX) <= this.handleWidth / 2 && y <= halfH) {
      return 'resize-right';
    }

    // Check if inside range for dragging
    if (x >= startX && x <= endX) {
      return 'drag';
    }

    return 'navigate';
  }

  updateCursor(interactionType) {
    switch (interactionType) {
      case 'resize-left':
      case 'resize-right':
        this.canvas.style.cursor = 'ew-resize';
        break;
      case 'drag':
        this.canvas.style.cursor = this.isDragging ? 'grabbing' : 'grab';
        break;
      default:
        this.canvas.style.cursor = 'crosshair';
    }
  }

  handleMouseDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const interactionType = this.getInteractionType(x, y);

    if (interactionType === 'resize-left' || interactionType === 'resize-right') {
      this.isResizing = true;
      this.resizeHandle = interactionType === 'resize-left' ? 'left' : 'right';
      this.dragStartX = x;
      this.dragStartRange = { ...this.genomeBrowser.currentPosition };
      this.tempRange = { ...this.genomeBrowser.currentPosition };
      this.canvas.style.cursor = 'ew-resize';
      // Add visual feedback
      this.container.classList.add('resizing', 'active-resize');
      this.canvas.classList.add('resizing');
      e.preventDefault();
    } else if (interactionType === 'drag') {
      this.isDragging = true;
      this.dragStartX = x;
      this.dragStartRange = { ...this.genomeBrowser.currentPosition };
      this.tempRange = { ...this.genomeBrowser.currentPosition };
      this.canvas.style.cursor = 'grabbing';
      // Add visual feedback
      this.container.classList.add('dragging', 'active-drag');
      this.canvas.classList.add('dragging');
      e.preventDefault();
    } else if (interactionType === 'navigate') {
      // Handle single click navigation
      const position = this.getPositionFromEvent(e);
      if (position !== null) {
        this.navigateToPosition(position);
      }
    }
  }

  handleMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (this.isResizing && this.tempRange) {
      const width = rect.width;
      const scale = this.sequenceLength / width;
      const deltaX = x - this.dragStartX;
      const deltaPosition = deltaX * scale;

      if (this.resizeHandle === 'left') {
        const newStart = Math.max(0, this.dragStartRange.start + deltaPosition);
        const newEnd = this.dragStartRange.end;
        if (newStart < newEnd - 100) {
          // Minimum range of 100bp
          this.tempRange = { start: newStart, end: newEnd };
        }
      } else if (this.resizeHandle === 'right') {
        const newStart = this.dragStartRange.start;
        const newEnd = Math.min(this.sequenceLength, this.dragStartRange.end + deltaPosition);
        if (newEnd > newStart + 100) {
          // Minimum range of 100bp
          this.tempRange = { start: newStart, end: newEnd };
        }
      }

      this.draw();
      this.showRangeTooltip(e, this.tempRange.start, this.tempRange.end);
    } else if (this.isDragging && this.tempRange) {
      const width = rect.width;
      const scale = this.sequenceLength / width;
      const deltaX = x - this.dragStartX;
      const deltaPosition = deltaX * scale;

      const rangeSize = this.dragStartRange.end - this.dragStartRange.start;
      let newStart = this.dragStartRange.start + deltaPosition;
      let newEnd = this.dragStartRange.end + deltaPosition;

      // Keep within bounds
      if (newStart < 0) {
        newStart = 0;
        newEnd = rangeSize;
      }
      if (newEnd > this.sequenceLength) {
        newEnd = this.sequenceLength;
        newStart = this.sequenceLength - rangeSize;
      }

      this.tempRange = { start: newStart, end: newEnd };
      this.draw();
      this.showRangeTooltip(e, this.tempRange.start, this.tempRange.end);
    } else {
      // Update cursor based on hover state
      const interactionType = this.getInteractionType(x, y);
      this.updateCursor(interactionType);

      // Add CSS classes for hover states
      this.canvas.classList.remove('hovering-handle', 'hovering-range');
      if (interactionType === 'resize-left' || interactionType === 'resize-right') {
        this.canvas.classList.add('hovering-handle');
      } else if (interactionType === 'drag') {
        this.canvas.classList.add('hovering-range');
      }

      // Show position tooltip
      const position = this.getPositionFromEvent(e);
      if (position !== null) {
        this.showTooltip(e, position);
      }
    }
  }

  handleMouseUp(e) {
    if (this.isResizing || this.isDragging) {
      // Apply the temporary range to the CodeXomics
      if (this.tempRange) {
        this.genomeBrowser.currentPosition = {
          start: Math.round(this.tempRange.start),
          end: Math.round(this.tempRange.end),
        };

        // Update the CodeXomics display
        const sequence = this.genomeBrowser.currentSequence[this.currentChromosome];
        this.genomeBrowser.updateStatistics(this.currentChromosome, sequence);
        this.genomeBrowser.displayGenomeView(this.currentChromosome, sequence);

        // Update current tab title with new position (from ruler navigation)
        if (this.genomeBrowser.tabManager) {
          this.genomeBrowser.tabManager.updateCurrentTabPosition(
            this.currentChromosome,
            this.genomeBrowser.currentPosition.start + 1,
            this.genomeBrowser.currentPosition.end,
            { source: 'ruler' }
          );
        }

        console.log(
          `GenomeNavigationBar: Range updated to ${this.genomeBrowser.currentPosition.start}-${this.genomeBrowser.currentPosition.end}`
        );
      }

      // Reset interaction state and remove visual feedback
      this.isResizing = false;
      this.isDragging = false;
      this.resizeHandle = null;
      this.tempRange = null;

      // Remove visual feedback classes
      this.container.classList.remove('resizing', 'dragging', 'active-resize', 'active-drag');
      this.canvas.classList.remove('resizing', 'dragging');

      // Update cursor
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const interactionType = this.getInteractionType(x, y);
      this.updateCursor(interactionType);

      this.draw();
    }
  }

  handleMouseLeave(e) {
    this.tooltip.style.display = 'none';

    // Remove hover state classes
    this.canvas.classList.remove('hovering-handle', 'hovering-range');

    // If we're in the middle of an operation, don't reset cursor
    if (!this.isResizing && !this.isDragging) {
      this.canvas.style.cursor = 'crosshair';
    }
  }

  handleDoubleClick(e) {
    const position = this.getPositionFromEvent(e);
    if (position !== null) {
      this.navigateToPositionAndZoom(position);
    }
  }

  handleKeyDown(e) {
    const currentRange = this.genomeBrowser.currentPosition.end - this.genomeBrowser.currentPosition.start;
    const step = Math.max(1, Math.floor(currentRange * 0.1));

    let newStart = this.genomeBrowser.currentPosition.start;

    switch (e.key) {
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
    this.genomeBrowser.updateStatistics(
      this.currentChromosome,
      this.genomeBrowser.currentSequence[this.currentChromosome]
    );
    this.genomeBrowser.displayGenomeView(
      this.currentChromosome,
      this.genomeBrowser.currentSequence[this.currentChromosome]
    );
  }

  getPositionFromEvent(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;

    if (x < 0 || x > width) return null;

    const position = Math.floor((x / width) * this.sequenceLength);
    return Math.max(0, Math.min(this.sequenceLength - 1, position));
  }

  showTooltip(e, startPos, endPos = null) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;

    this.tooltip.style.left = `${x}px`;
    this.tooltip.style.top = `${this.currentHeight + 5}px`;
    this.tooltip.style.display = 'block';

    if (endPos !== null) {
      // Show range tooltip with special styling
      const rangeStart = Math.min(startPos, endPos);
      const rangeEnd = Math.max(startPos, endPos);
      const rangeSize = Math.round(rangeEnd - rangeStart + 1);
      this.tooltip.textContent = `Range: ${Math.round(rangeStart + 1).toLocaleString()}-${Math.round(rangeEnd + 1).toLocaleString()} bp (${rangeSize.toLocaleString()} bp)`;
      this.tooltip.classList.add('range-tooltip');
    } else {
      // Show position tooltip
      this.tooltip.textContent = `Position: ${(startPos + 1).toLocaleString()} bp`;
      this.tooltip.classList.remove('range-tooltip');
    }
  }

  showRangeTooltip(e, startPos, endPos) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;

    this.tooltip.style.left = `${x}px`;
    this.tooltip.style.top = `${this.currentHeight + 5}px`;
    this.tooltip.style.display = 'block';

    const rangeSize = Math.round(endPos - startPos);
    this.tooltip.textContent = `Range: ${Math.round(startPos + 1).toLocaleString()}-${Math.round(endPos).toLocaleString()} bp (${rangeSize.toLocaleString()} bp)`;
    this.tooltip.classList.add('range-tooltip');
  }

  navigateToPosition(position) {
    // Center the view on the clicked position
    const currentRange = this.genomeBrowser.currentPosition
      ? this.genomeBrowser.currentPosition.end - this.genomeBrowser.currentPosition.start
      : Math.min(10000, this.sequenceLength);

    const newStart = Math.max(0, position - Math.floor(currentRange / 2));
    const newEnd = Math.min(this.sequenceLength, newStart + currentRange);

    this.genomeBrowser.currentPosition = { start: newStart, end: newEnd };

    // Update the display
    const sequence = this.genomeBrowser.currentSequence[this.currentChromosome];
    this.genomeBrowser.updateStatistics(this.currentChromosome, sequence);
    this.genomeBrowser.displayGenomeView(this.currentChromosome, sequence);

    // Update current tab title with new position (from ruler click navigation)
    if (this.genomeBrowser.tabManager) {
      this.genomeBrowser.tabManager.updateCurrentTabPosition(this.currentChromosome, newStart + 1, newEnd, {
        source: 'ruler',
      });
    }

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

    // Update current tab title with new position (from ruler double-click zoom)
    if (this.genomeBrowser.tabManager) {
      this.genomeBrowser.tabManager.updateCurrentTabPosition(this.currentChromosome, newStart + 1, newEnd, {
        source: 'ruler',
      });
    }

    console.log(`GenomeNavigationBar: Zoomed to position ${position} with range ${zoomRange}`);
  }

  /**
   * Read the saved ruler display mode once the config has loaded. The
   * constructor runs before ConfigManager finishes initializing, so the bar
   * starts in the default mode and switches here without persisting.
   */
  async applySavedRulerDisplayMode() {
    const configManager = this.genomeBrowser && this.genomeBrowser.configManager;
    if (!configManager || typeof configManager.get !== 'function') return;

    try {
      if (typeof configManager.waitForInitialization === 'function') {
        await configManager.waitForInitialization();
      }
      const saved = configManager.get(GenomeNavigationBar.RULER_DISPLAY_CONFIG_KEY, null);
      if (saved !== null) {
        this.setRulerDisplayMode(saved, { persist: false });
      }
    } catch (error) {
      console.warn('GenomeNavigationBar: Could not load saved ruler display mode:', error);
    }
  }

  /** Advance Full -> Compact -> Minimal -> Full. */
  cycleRulerDisplayMode() {
    const modes = GenomeNavigationBar.RULER_DISPLAY_MODES;
    const next = modes[(modes.indexOf(this.rulerDisplayMode) + 1) % modes.length];
    this.setRulerDisplayMode(next);
  }

  /**
   * Apply a ruler display mode to both rulers and, by default, persist it.
   * Unknown values fall back to the default mode.
   */
  setRulerDisplayMode(mode, { persist = true } = {}) {
    this.rulerDisplayMode = GenomeNavigationBar.normalizeRulerDisplayMode(mode);
    this.applyRulerDisplayLayout();

    if (persist) {
      this.persistRulerDisplayMode();
    }

    return this.rulerDisplayMode;
  }

  /**
   * Save the mode right away. ConfigManager.set() only writes after
   * ui.autoSaveInterval (30 s) of quiet and nothing flushes it on quit, so a
   * change followed by a quick restart would otherwise be lost. This is a
   * rare, deliberate click, so the immediate write is cheap.
   */
  persistRulerDisplayMode() {
    const configManager = this.genomeBrowser && this.genomeBrowser.configManager;
    if (!configManager) return;

    const key = GenomeNavigationBar.RULER_DISPLAY_CONFIG_KEY;
    let pending = null;
    if (typeof configManager.setAndSaveImmediate === 'function') {
      pending = configManager.setAndSaveImmediate(key, this.rulerDisplayMode);
    } else if (typeof configManager.set === 'function') {
      pending = configManager.set(key, this.rulerDisplayMode);
    }

    Promise.resolve(pending).catch(error =>
      console.warn('GenomeNavigationBar: Could not save ruler display mode:', error)
    );
  }

  /** Lay out the primary ruler, the secondary ruler and the toggle for the current mode. */
  applyRulerDisplayLayout() {
    if (this.container) {
      this.container.style.height = `${this.currentHeight}px`;
    }
    this.updateRulerModeToggleAppearance();
    this.syncSecondaryRuler();

    if (this.isVisible) {
      this.resizeCanvas();
      this.draw();
    }
  }

  /**
   * Push the secondary-ruler visibility into TrackRenderer, which owns the
   * coordinate ruler bar. Updates the bar on screen and the state the next
   * rebuilt bar reads.
   */
  syncSecondaryRuler() {
    const trackRenderer = this.genomeBrowser && this.genomeBrowser.trackRenderer;
    if (!trackRenderer) return;

    if (!trackRenderer.elementVisibilityStates) trackRenderer.elementVisibilityStates = {};
    trackRenderer.elementVisibilityStates.genesRuler = this.rulerDisplayMode !== 'minimal';

    if (typeof trackRenderer.applyCoordinateRulerVisibility === 'function') {
      trackRenderer.applyCoordinateRulerVisibility();
    }
  }

  updateRulerModeToggleAppearance() {
    if (!this.rulerModeToggle) return;

    const labels = GenomeNavigationBar.RULER_DISPLAY_LABELS;
    const modes = GenomeNavigationBar.RULER_DISPLAY_MODES;
    const current = labels[this.rulerDisplayMode];
    const next = labels[modes[(modes.indexOf(this.rulerDisplayMode) + 1) % modes.length]];

    this.rulerModeToggle.innerHTML = `<i class="fas ${current.icon}"></i>`;
    this.rulerModeToggle.dataset.mode = this.rulerDisplayMode;
    this.rulerModeToggle.title = `Rulers: ${current.label} (${current.detail}). Click for ${next.label}.`;
    this.rulerModeToggle.setAttribute('aria-label', this.rulerModeToggle.title);
  }
}
