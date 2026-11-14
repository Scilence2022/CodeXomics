/**
 * SequenceUtils - Handles sequence processing, display, and biological utilities
 *
 * DEPRECATION NOTICE: View-mode cursor system (styles, status updates, and positioning)
 * is scheduled for removal. Do not introduce new dependencies on cursor behavior.
 * Code paths remain for validation only until final removal.
 */
class SequenceUtils {
  constructor(genomeBrowser) {
    this.genomeBrowser = genomeBrowser;

    // Make this instance globally accessible for click handlers
    window.sequenceUtils = this;
    // VSCode editor and SequenceEditor removed - only using view mode

    // Only using view mode - edit mode functionality removed

    // Sequence line height configuration (in pixels)
    this.lineHeight = 28; // Default increased from 24px to 28px for better readability

    // Sequence line spacing configuration (margin between lines in pixels)
    this.lineSpacing = 8; // Default spacing between sequence lines
    this.minLineSpacing = 12; // Minimum line spacing to maintain readability (configurable in settings)
    this.strandLabelWidth = 20; // Width of the 5'/3' label before sequence bases

    // Performance optimization caches
    this.renderCache = new Map(); // Cache for rendered sequence lines
    this.featureCache = new Map(); // Cache for feature lookups
    this.lineFeatureCache = new Map(); // Cache for per-line feature indexes
    this.proteinTranslationCache = new Map(); // Cache for CDS translations used by aligned protein rows
    this.colorCache = new Map(); // Cache for color calculations
    this.svgCache = new Map(); // Cache for SVG indicators
    this.renderedOperonContexts = new Map(); // Reuse operons already calculated for visible sequence indicators
    this.lastRenderParams = null; // Track last render parameters

    // Search highlighting
    this.searchHighlights = [];
    this.highlightColor = 'rgba(255, 215, 0, 0.7)'; // Gold highlighting
    this.lastHighlightedMatches = [];

    // Performance monitoring
    this.performanceStats = {
      renderTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      lastRenderStart: 0,
    };

    // Cursor management for sequence editing/insertion
    this.cursor = {
      position: -1, // Absolute genome position where cursor is placed
      lineNumber: -1, // Line number in sequence display
      offset: -1, // Position within the line
      element: null, // DOM element for cursor
      visible: false, // Cursor visibility state
      blinking: true, // Blinking animation state (active by default)
      color: '#007bff', // Cursor color (blue)
    };

    // Drag optimization
    this.dragOptimization = {
      isDragging: false,
      pendingRender: null,
      renderThrottle: 100, // ms
      lastRenderTime: 0,
    };

    // Listen for drag events to optimize rendering
    this.setupDragOptimization();

    // Load minimum line spacing from settings
    this.loadMinLineSpacingFromSettings();

    // Cursor system removed

    // Cursor system removed
  }

  /**
   * Setup drag optimization listeners with enhanced stability
   */
  setupDragOptimization() {
    // Listen for standard drag events
    document.addEventListener('dragstart', () => {
      this.dragOptimization.isDragging = true;
      console.log('🔧 [SequenceUtils] Drag started - enabling render optimization');
    });

    document.addEventListener('dragend', () => {
      this.dragOptimization.isDragging = false;
      console.log('🔧 [SequenceUtils] Drag ended - disabling render optimization');

      // Execute any pending render
      this.executePendingRender('dragend');
    });

    // Listen for custom drag events from NavigationManager (more reliable for genome view dragging)
    document.addEventListener('genomeViewDragStart', () => {
      this.dragOptimization.isDragging = true;
      this.dragOptimization.lastRenderTime = Date.now();
      console.log('🔧 [SequenceUtils] Genome view drag started');
    });

    document.addEventListener('genomeViewDragEnd', () => {
      this.dragOptimization.isDragging = false;
      console.log('🔧 [SequenceUtils] Genome view drag ended');

      // Execute any pending render with retry mechanism
      this.executePendingRender('genomeViewDragEnd');
    });

    // Enhanced safety: Listen for mouse up events to catch missed drag ends
    document.addEventListener('mouseup', () => {
      if (this.dragOptimization.isDragging) {
        console.log('🔧 [SequenceUtils] Force ending drag on mouseup (safety net)');
        this.dragOptimization.isDragging = false;
        this.executePendingRender('mouseup-fallback');
      }
    });

    // Periodic check to recover from a *stuck* drag state (e.g. a mouseup that
    // was never delivered). This must NOT fire during a legitimately long drag,
    // otherwise the bottom sequence would auto-update while the user is still
    // holding the mouse - which is exactly the behavior we want to avoid in the
    // default "unified" mode. So we only recover when the genome view is no
    // longer actively being dragged.
    setInterval(() => {
      if (!this.dragOptimization.isDragging) return;

      // Still actively dragging (mouse held down)? Leave it alone - the view is
      // updated when the drag ends.
      const navDragging = window.genomeBrowser?.navigationManager?.dragState?.isDragging;
      if (navDragging) return;

      const now = Date.now();
      const timeSinceDrag = now - this.dragOptimization.lastRenderTime;

      // No active drag but our flag is still set after a long pause => stuck.
      if (timeSinceDrag > 5000) {
        console.warn('⚠️ [SequenceUtils] Recovering stuck drag-optimization state after 5s with no active drag');
        this.dragOptimization.isDragging = false;
        this.executePendingRender('timeout-reset');

        // Additional fallback if pending render fails
        setTimeout(() => {
          if (!this.dragOptimization.pendingRender) {
            this.forceSequenceRerender();
          }
        }, 100);
      }
    }, 1000);
  }

  /**
   * Execute pending render with enhanced error handling and recovery
   */
  executePendingRender(trigger) {
    if (this.dragOptimization.pendingRender) {
      console.log(`🔧 [SequenceUtils] Executing pending render (triggered by: ${trigger})`);
      try {
        const renderFunction = this.dragOptimization.pendingRender;
        this.dragOptimization.pendingRender = null; // Clear immediately to prevent re-entry

        renderFunction();
        console.log('✅ [SequenceUtils] Pending render executed successfully');
      } catch (error) {
        console.error('❌ [SequenceUtils] Error executing pending render:', error);
        console.error('🔧 [SequenceUtils] Error details:', {
          trigger,
          errorMessage: error.message,
          stack: error.stack,
        });

        // Try to recover by forcing a re-render with delay to avoid infinite loops
        setTimeout(() => {
          this.forceSequenceRerender();
        }, 50);
      }
    } else if (trigger === 'genomeViewDragEnd') {
      // Special case: if drag end but no pending render, ensure we still have content
      console.log('🔧 [SequenceUtils] Drag ended but no pending render - checking for blank content');
      const container = document.getElementById('sequenceContent');
      if (container && container.children.length === 0) {
        console.warn('⚠️ [SequenceUtils] Blank content detected after drag - forcing rerender');
        this.forceSequenceRerender();
      }
    }
  }

  /**
   * Force a sequence re-render as fallback
   */
  forceSequenceRerender() {
    console.log('🔧 [SequenceUtils] Force re-rendering sequence as fallback');
    try {
      const chromosome = this.genomeBrowser.currentChromosome;
      const sequenceData = this.genomeBrowser.currentSequence;
      if (chromosome && sequenceData && sequenceData[chromosome]) {
        const sequence = sequenceData[chromosome];
        // Clear caches to force fresh render
        this.clearRenderCache();
        this.displayEnhancedSequence(chromosome, sequence);
      }
    } catch (error) {
      console.error('❌ [SequenceUtils] Error in force re-render:', error);
    }
  }

  /**
   * Check if rendering should be throttled during drag
   */
  shouldThrottleRender() {
    if (!this.dragOptimization.isDragging) return false;

    const now = Date.now();
    const timeSinceLastRender = now - this.dragOptimization.lastRenderTime;

    return timeSinceLastRender < this.dragOptimization.renderThrottle;
  }

  /**
   * Throttled render wrapper for drag optimization
   */
  throttledRender(renderFunction) {
    if (this.shouldThrottleRender()) {
      console.log('🔧 [SequenceUtils] Render throttled during drag - queuing for later');
      this.dragOptimization.pendingRender = renderFunction;
      return false; // Render was throttled
    }

    this.dragOptimization.lastRenderTime = Date.now();
    renderFunction();
    return true; // Render was executed
  }

  /**
   * Set cursor position at a specific genome location
   * @param {number} position - Absolute genome position (0-based)
   */
  setCursorPosition(position) {
    console.log('📌 [SequenceUtils] Setting cursor at position:', position);

    this.cursor.position = position;
    this.cursor.chromosome = this.genomeBrowser.currentChromosome;
    this.cursor.genome = this.genomeBrowser.currentSequence;
    this.cursor.visible = true;

    // Update cursor visual in the sequence display
    this.renderCursor();
  }

  /**
   * Get current cursor position
   * @returns {number} Absolute genome position or -1 if no cursor
   */
  getCursorPosition() {
    const sameGenome = this.cursor.genome === this.genomeBrowser.currentSequence;
    const sameChromosome = this.cursor.chromosome === this.genomeBrowser.currentChromosome;
    return this.cursor.visible && sameGenome && sameChromosome ? this.cursor.position : -1;
  }

  /**
   * Set cursor color
   * @param {string} color - CSS color value (e.g., '#007bff', 'red', 'rgb(0,0,255)')
   */
  setCursorColor(color) {
    console.log('🎨 [SequenceUtils] Setting cursor color:', color);
    this.cursor.color = color;

    // Re-render cursor if visible to apply new color
    if (this.cursor.visible && this.cursor.element) {
      this.renderCursor();
    }
  }

  /**
   * Clear cursor from display
   */
  clearCursor() {
    if (this.cursor.element && this.cursor.element.parentNode) {
      this.cursor.element.parentNode.removeChild(this.cursor.element);
    }

    this.cursor.position = -1;
    this.cursor.visible = false;
    this.cursor.element = null;
    this.cursor.genome = null;

    console.log('📌 [SequenceUtils] Cursor cleared');
  }

  /**
   * Render cursor at current position in sequence display
   */
  renderCursor() {
    if (this.getCursorPosition() < 0) {
      return;
    }

    // Clear existing cursor
    if (this.cursor.element && this.cursor.element.parentNode) {
      this.cursor.element.parentNode.removeChild(this.cursor.element);
      this.cursor.element = null;
    }

    // Find the position in the sequence display
    const sequenceContent = document.getElementById('sequenceContent');
    if (!sequenceContent) return;

    // Create cursor element
    const cursorElement = document.createElement('span');
    cursorElement.className = 'sequence-cursor';
    cursorElement.style.cssText = `
            display: inline-block;
            width: 2px;
            height: 1.2em;
            background-color: ${this.cursor.color};
            margin: 0 -1px;
            vertical-align: text-bottom;
            animation: cursor-blink 1s step-end infinite;
        `;

    const targetSpan = sequenceContent.querySelector(`.sequence-bases span[data-position="${this.cursor.position}"]`);
    if (targetSpan) {
      const basesDiv = targetSpan.closest('.sequence-bases');
      const targetLine = targetSpan.closest('.sequence-line-group');
      const baseSpans = Array.from(basesDiv.querySelectorAll('span[data-position]'));
      const posInLine = baseSpans.indexOf(targetSpan);
      const sequenceLines = Array.from(sequenceContent.querySelectorAll('.sequence-line-group'));
      const lineIndex = sequenceLines.indexOf(targetLine);

      basesDiv.insertBefore(cursorElement, targetSpan);
      this.cursor.element = cursorElement;
      this.cursor.lineNumber = lineIndex;
      this.cursor.offset = posInLine;

      console.log(`✅ [SequenceUtils] Cursor rendered at line ${lineIndex}, offset ${posInLine}`);
      return;
    }

    const start = this.genomeBrowser.currentPosition.start;
    const relativePos = this.cursor.position - start;

    // Check if cursor is in visible range
    if (relativePos < 0) {
      console.log('📌 [SequenceUtils] Cursor before visible range');
      return;
    }

    // Find the correct line and position within that line
    const sequenceLines = sequenceContent.querySelectorAll('.sequence-line');
    let basesPerLine = 100; // Default

    // Get actual bases per line from first line
    if (sequenceLines.length > 0) {
      const firstBasesDiv = sequenceLines[0].querySelector('.sequence-bases');
      if (firstBasesDiv) {
        const spans = firstBasesDiv.querySelectorAll('span');
        basesPerLine = spans.length;
      }
    }

    const lineIndex = Math.floor(relativePos / basesPerLine);
    const posInLine = relativePos % basesPerLine;

    if (lineIndex >= sequenceLines.length) {
      console.log('📌 [SequenceUtils] Cursor after visible range');
      return;
    }

    const targetLine = sequenceLines[lineIndex];
    const basesDiv = targetLine.querySelector('.sequence-bases');
    if (!basesDiv) return;

    const baseSpans = basesDiv.querySelectorAll('span');

    // Insert cursor before the target base
    if (posInLine < baseSpans.length) {
      basesDiv.insertBefore(cursorElement, baseSpans[posInLine]);
    } else {
      // Cursor at end of line
      basesDiv.appendChild(cursorElement);
    }

    this.cursor.element = cursorElement;
    this.cursor.lineNumber = lineIndex;
    this.cursor.offset = posInLine;

    console.log(`✅ [SequenceUtils] Cursor rendered at line ${lineIndex}, offset ${posInLine}`);
  }

  /**
   * Handle click on sequence base to position cursor
   * This is called on mouseup, after determining it was a click (not drag)
   * @param {MouseEvent} event - Click event
   * @param {HTMLElement} targetSpan - The clicked base span element
   */
  handleSequenceClick(event, targetSpan) {
    // Get the position of the clicked base
    const position = this.getSequencePosition(targetSpan);
    console.log('📌 [SequenceUtils] getSequencePosition returned:', position);

    if (position === null || position === undefined) {
      console.warn('⚠️ [SequenceUtils] Failed to get sequence position from clicked element');
      return;
    }

    // Determine if click is on left or right half of base
    const rect = targetSpan.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const baseWidth = rect.width;

    // If clicked on right half, position cursor after the base
    const cursorPosition = clickX > baseWidth / 2 ? position + 1 : position;

    console.log(`🖌️ [SequenceUtils] Placing cursor at position ${cursorPosition}`);

    // Set cursor at this position
    this.setCursorPosition(cursorPosition);
  }

  /**
   * Get absolute genome position from a base span element
   * @param {HTMLElement} baseSpan - The span element containing a base
   * @returns {number|null} Absolute genome position or null if not found
   */
  getSequencePosition(baseSpan) {
    if (!baseSpan) {
      console.warn('⚠️ [SequenceUtils] getSequencePosition called with null/undefined baseSpan');
      return null;
    }

    const positionedSpan =
      baseSpan.dataset?.position !== undefined ? baseSpan : baseSpan.closest?.('span[data-position]');
    if (positionedSpan?.dataset?.position !== undefined) {
      const position = parseInt(positionedSpan.dataset.position, 10);
      return Number.isNaN(position) ? null : position;
    }

    // Find the parent sequence line
    const lineGroup = baseSpan.closest('.sequence-line-group');
    if (!lineGroup) {
      console.warn('⚠️ [SequenceUtils] Could not find .sequence-line-group parent');
      return null;
    }

    const sequenceLine = lineGroup.querySelector('.sequence-line');
    if (!sequenceLine) {
      console.warn('⚠️ [SequenceUtils] Could not find .sequence-line in line group');
      return null;
    }

    // Get the position label to determine line start
    const positionSpan = sequenceLine.querySelector('.sequence-position');
    if (!positionSpan) {
      console.warn('⚠️ [SequenceUtils] Could not find .sequence-position in sequence line');
      return null;
    }

    // Parse the position (it's 1-based, so convert to 0-based)
    const positionText = positionSpan.textContent.replace(/,/g, '');
    const lineStartPos = parseInt(positionText) - 1;

    if (isNaN(lineStartPos)) {
      console.warn('⚠️ [SequenceUtils] Failed to parse position from:', positionSpan.textContent);
      return null;
    }

    // Find the offset within the line
    const basesDiv = sequenceLine.querySelector('.sequence-bases');
    if (!basesDiv) {
      console.warn('⚠️ [SequenceUtils] Could not find .sequence-bases in sequence line');
      return null;
    }

    const baseSpans = Array.from(basesDiv.querySelectorAll('span'));
    const offset = baseSpans.indexOf(baseSpan);

    if (offset === -1) {
      console.warn('⚠️ [SequenceUtils] Base span not found in bases list');
      return null;
    }

    const absolutePosition = lineStartPos + offset;
    console.log(
      `✅ [SequenceUtils] Calculated position: ${absolutePosition} (line start: ${lineStartPos}, offset: ${offset})`
    );

    return absolutePosition;
  }

  /**
   * Attach event handlers to sequence container
   * Note: Cursor placement is now handled by the selection system's mouseup handler
   * to properly distinguish between clicks and drags
   * @param {HTMLElement} container - The sequence content container
   */
  attachSequenceClickHandlers(container) {
    // Only attach mouseleave handler to hide cursor when mouse exits
    const existingLeaveHandler = container._cursorLeaveHandler;
    if (existingLeaveHandler) {
      container.removeEventListener('mouseleave', existingLeaveHandler);
    }

    // Create mouseleave handler - keep event framework but don't clear cursor
    const leaveHandler = () => {
      console.log('🖱️ [SequenceUtils] Mouse left sequence area - cursor persistence maintained');
      // Note: Cursor is NOT cleared on mouseleave to maintain persistence
      // this.clearCursor(); // Commented out to preserve cursor
    };
    container.addEventListener('mouseleave', leaveHandler);

    // Store reference for cleanup
    container._cursorLeaveHandler = leaveHandler;

    const existingIndicatorClickHandler = container._geneIndicatorClickHandler;
    if (existingIndicatorClickHandler) {
      container.removeEventListener('click', existingIndicatorClickHandler);
    }

    const indicatorClickHandler = event => {
      const target = event.target.closest?.('.gene-indicator-click-target');
      if (!target || !container.contains(target)) return;

      event.preventDefault();
      event.stopPropagation();
      this.handleGeneIndicatorClick(target);
    };
    container.addEventListener('click', indicatorClickHandler);
    container._geneIndicatorClickHandler = indicatorClickHandler;

    const existingPrimerClickHandler = container._primerSelectClickHandler;
    if (existingPrimerClickHandler) {
      container.removeEventListener('click', existingPrimerClickHandler);
    }

    const primerClickHandler = event => {
      const target = event.target.closest?.('.primer-select-target');
      if (!target || !container.contains(target)) return;

      event.preventDefault();
      event.stopPropagation();
      this.handlePrimerSelectClick(target);
    };
    container.addEventListener('click', primerClickHandler);
    container._primerSelectClickHandler = primerClickHandler;

    console.log('✅ [SequenceUtils] Cursor mouseleave handler attached (persistence mode)');
  }

  handlePrimerSelectClick(target) {
    const primer = this.findPrimerFromSelectTarget(target);
    if (!primer) {
      console.warn('⚠️ [SequenceUtils] Could not resolve clicked primer:', target?.dataset || {});
      return;
    }
    this.genomeBrowser.selectPrimer?.(primer);
  }

  findPrimerFromSelectTarget(target) {
    const chromosome = target.dataset.chromosome || this.genomeBrowser.currentChromosome;
    const id = target.dataset.primerId || '';
    const start = parseInt(target.dataset.primerStart, 10);
    const end = parseInt(target.dataset.primerEnd, 10);
    const strand = target.dataset.primerStrand === '-' ? -1 : 1;

    const candidates = this.getPrimerBindingFeatures(chromosome);
    if (id) {
      const byId = candidates.find(candidate => candidate.id != null && String(candidate.id) === id);
      if (byId) return byId;
    }
    return candidates.find(candidate => {
      const candidateReverse = candidate.strand === -1 || candidate.strand === '-';
      return candidate.start === start && candidate.end === end && candidateReverse === (strand === -1);
    });
  }

  handleGeneIndicatorClick(target) {
    const gene = this.findGeneFromIndicatorTarget(target);
    if (!gene) {
      console.warn('⚠️ [SequenceUtils] Could not resolve clicked gene indicator:', target?.dataset || {});
      return;
    }

    const chromosome = target.dataset.chromosome || this.genomeBrowser.currentChromosome;
    const annotations = this.genomeBrowser.currentAnnotations?.[chromosome] || [];
    const renderedContext = this.renderedOperonContexts.get(chromosome);
    const operons =
      renderedContext?.annotations === annotations && renderedContext.annotationCount === annotations.length
        ? renderedContext.operons
        : this.genomeBrowser.detectOperons
          ? this.genomeBrowser.detectOperons(annotations, chromosome)
          : [];
    const operonInfo = this.genomeBrowser.getGeneOperonInfo(gene, operons);

    if (this.genomeBrowser.trackRenderer?.showGeneDetails) {
      this.genomeBrowser.trackRenderer.showGeneDetails(gene, operonInfo, {
        scrollBottomSequence: false,
      });
      return;
    }

    this.genomeBrowser.selectGene?.(gene, operonInfo);
    this.genomeBrowser.showGeneDetailsPanel?.();
    this.genomeBrowser.populateGeneDetails?.(gene, operonInfo);
    this.genomeBrowser.highlightGeneSequence?.(gene);
  }

  findGeneFromIndicatorTarget(target) {
    const chromosome = target.dataset.chromosome || this.genomeBrowser.currentChromosome;
    const annotations = this.genomeBrowser.currentAnnotations?.[chromosome] || [];
    const sourceStart = parseInt(target.dataset.geneStart, 10);
    const sourceEnd = parseInt(target.dataset.geneEnd, 10);
    const type = (target.dataset.geneType || '').toLowerCase();
    const geneName = target.dataset.geneName || '';
    const locusTag = target.dataset.locusTag || '';

    return annotations.find(annotation => {
      if (!annotation) return false;
      const annotationType = (annotation.type || '').toLowerCase();
      if (type && annotationType !== type) return false;
      if (annotation.start !== sourceStart || annotation.end !== sourceEnd) return false;

      if (!geneName && !locusTag) return true;

      const annotationGeneName = this.genomeBrowser.getQualifierValue?.(annotation.qualifiers, 'gene') || '';
      const annotationLocusTag = this.genomeBrowser.getQualifierValue?.(annotation.qualifiers, 'locus_tag') || '';
      return (!geneName || annotationGeneName === geneName) && (!locusTag || annotationLocusTag === locusTag);
    });
  }

  getGeneIndicatorGeometry(barHeight, settings = {}) {
    const heightCorrection = (settings.heightCorrection || 100) / 100;
    const correctedBarHeight = barHeight * heightCorrection;
    const startMarkerHeightPercent = settings.startMarkerHeight || 200;
    const arrowHeightPercent = settings.arrowHeight || 200;
    const markerHeight =
      settings.showStartMarkers !== false ? (correctedBarHeight * startMarkerHeightPercent) / 100 : 0;
    const arrowHeight = settings.showEndArrows !== false ? (correctedBarHeight * arrowHeightPercent) / 100 : 0;
    const hitHeight = Math.max(correctedBarHeight, markerHeight, arrowHeight);

    return {
      correctedBarHeight,
      hitHeight,
      yOffset: (hitHeight - correctedBarHeight) / 2,
    };
  }

  getGeneIndicatorHitHeight(barHeight, settings = {}) {
    return this.getGeneIndicatorGeometry(barHeight, settings).hitHeight;
  }

  escapeHtmlAttribute(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  createGeneIndicatorDataAttributes(gene, extraClass = '') {
    const sourceStart = gene._sourceStart || gene.start;
    const sourceEnd = gene._sourceEnd || gene.end;
    const geneName = this.genomeBrowser.getQualifierValue?.(gene.qualifiers, 'gene') || '';
    const locusTag = this.genomeBrowser.getQualifierValue?.(gene.qualifiers, 'locus_tag') || '';
    const chromosome = this.genomeBrowser.currentChromosome || '';
    const classes = ['gene-indicator-click-target', extraClass].filter(Boolean).join(' ');

    return [
      `class="${this.escapeHtmlAttribute(classes)}"`,
      `data-gene-start="${this.escapeHtmlAttribute(sourceStart)}"`,
      `data-gene-end="${this.escapeHtmlAttribute(sourceEnd)}"`,
      `data-gene-type="${this.escapeHtmlAttribute(gene.type || '')}"`,
      `data-gene-name="${this.escapeHtmlAttribute(geneName)}"`,
      `data-locus-tag="${this.escapeHtmlAttribute(locusTag)}"`,
      `data-chromosome="${this.escapeHtmlAttribute(chromosome)}"`,
      'style="cursor: pointer;"',
    ].join(' ');
  }

  createGeneIndicatorHitTarget(gene, x, width, hitHeight, settings = {}) {
    const tooltip =
      this.genomeBrowser.getQualifierValue?.(gene.qualifiers, 'gene') ||
      this.genomeBrowser.getQualifierValue?.(gene.qualifiers, 'locus_tag') ||
      gene.type;
    const tooltipAttr = settings.showTooltips !== false ? `title="${this.escapeHtmlAttribute(tooltip)}"` : '';
    const targetAttrs = this.createGeneIndicatorDataAttributes(gene, 'gene-indicator-hit-area');
    return `<rect x="${x}" y="0" width="${width}" height="${hitHeight}" fill="transparent" pointer-events="all" ${tooltipAttr} ${targetAttrs}/>`;
  }

  // Sequence display methods
  displayEnhancedSequence(chromosome, sequence) {
    // During an active genome-view drag in "unified" mode (the default), leave
    // the bottom sequence panel exactly as-is. It is re-rendered once when the
    // drag ends (NavigationManager calls displayGenomeView on mouseup, at which
    // point isDragging is already false). This is what makes the panel update
    // only after release instead of jumping mid-drag. Real-time mode falls
    // through and renders (throttled) on every move.
    const nav = this.genomeBrowser.navigationManager;
    if (nav && nav.dragState && nav.dragState.isDragging && nav.dragRealtimeSequenceUpdate !== true) {
      return;
    }

    const start = this.genomeBrowser.currentPosition.start;
    const end = this.genomeBrowser.currentPosition.end;

    // Update sequence title
    const sequenceTitle = document.getElementById('sequenceTitle');
    if (sequenceTitle) {
      sequenceTitle.textContent = this.formatSequenceRange(chromosome, start, end);
    }

    // Show sequence display section and splitter if not already visible
    const sequenceDisplaySection = document.getElementById('sequenceDisplaySection');
    const sequenceDisplay = document.getElementById('sequenceDisplay');
    const isSequenceCollapsed =
      sequenceDisplaySection?.classList.contains('collapsed') || sequenceDisplay?.classList.contains('collapsed');
    if (sequenceDisplaySection.style.display === 'none') {
      sequenceDisplaySection.style.display = 'flex';
      document.getElementById('splitter').style.display = isSequenceCollapsed ? 'none' : 'flex';

      // Ensure proper initial layout balance
      const genomeViewerSection = document.getElementById('genomeViewerSection');
      if (genomeViewerSection) {
        // Reset to balanced flex properties
        genomeViewerSection.style.flex = '1';
        genomeViewerSection.style.maxHeight = '70%';
      }
    }
    if (sequenceDisplay) {
      sequenceDisplay.style.display = 'flex'; // Ensure the header/content wrapper is visible
    }

    // Only using view mode - no edit mode functionality

    // Line height / spacing controls now live in the sequence track Settings
    // panel (Indicators tab), so no dynamic header selectors are injected here.
    this.syncSequenceHeaderToggleButtons(this.getSequenceTrackSettings());
    if (isSequenceCollapsed) return;

    // Update CSS variables for line height
    this.updateSequenceLineHeightCSS();

    // Display sequence using traditional detailed sequence display
    this.displayDetailedSequence(chromosome, sequence, start, end);
  }

  isCircularModeEnabled() {
    if (this.genomeBrowser.trackRenderer?.isCircularModeEnabled) {
      return this.genomeBrowser.trackRenderer.isCircularModeEnabled();
    }

    const genesSettings = this.genomeBrowser.trackRenderer?.getTrackSettings?.('genes');
    return Boolean(genesSettings?.circularMode || this.genomeBrowser.navigationManager?.circularMode);
  }

  getSequenceLength(chromosome = null) {
    const currentChr = chromosome || this.genomeBrowser.currentChromosome;
    const sequence = this.genomeBrowser.currentSequence;
    const chromosomeSequence = typeof sequence === 'object' && currentChr ? sequence[currentChr] : sequence;
    return typeof chromosomeSequence === 'string' ? chromosomeSequence.length : 0;
  }

  normalizeCircularPosition(position, sequenceLength) {
    if (!sequenceLength || sequenceLength <= 0) return position;
    return ((position % sequenceLength) + sequenceLength) % sequenceLength;
  }

  displayToSourcePosition(displayPosition, chromosome = null) {
    const sequenceLength = this.getSequenceLength(chromosome);
    if (!this.isCircularModeEnabled() || sequenceLength <= 0) {
      return displayPosition;
    }

    return this.normalizeCircularPosition(displayPosition, sequenceLength);
  }

  getViewportSequence(fullSequence, viewStart, viewEnd, chromosome = null) {
    if (this.genomeBrowser.trackRenderer?.getWrappedSequence) {
      return this.genomeBrowser.trackRenderer.getWrappedSequence(fullSequence, viewStart, viewEnd, chromosome);
    }

    if (!this.isCircularModeEnabled() || !fullSequence || viewEnd <= viewStart) {
      return fullSequence.substring(Math.max(0, viewStart), Math.min(fullSequence.length, viewEnd));
    }

    const sequenceLength = fullSequence.length;
    let cursor = viewStart;
    let sequence = '';

    while (cursor < viewEnd) {
      const sourceStart = this.normalizeCircularPosition(cursor, sequenceLength);
      const basesToBoundary = sourceStart === 0 ? sequenceLength : sequenceLength - sourceStart;
      const displayEnd = Math.min(viewEnd, cursor + basesToBoundary);
      sequence += fullSequence.substring(sourceStart, sourceStart + (displayEnd - cursor));
      cursor = displayEnd;
    }

    return sequence;
  }

  formatSequenceRange(chromosome, viewStart, viewEnd) {
    const windowSize = viewEnd - viewStart;
    const sequenceLength = this.getSequenceLength(chromosome);

    // Header shows positional coordinates only — the chromosome/sequence name is
    // intentionally omitted here (it is already shown in the genome navigation bar).
    if (!this.isCircularModeEnabled() || sequenceLength <= 0) {
      return `${viewStart + 1}-${viewEnd} (${windowSize} bp)`;
    }

    const segments = this.genomeBrowser.trackRenderer?.getViewportSegments
      ? this.genomeBrowser.trackRenderer.getViewportSegments({ start: viewStart, end: viewEnd }, chromosome)
      : this.getViewportDisplaySegments(viewStart, viewEnd, sequenceLength);
    const segmentLabels = segments.map(segment => `${segment.sourceStart + 1}-${segment.sourceEnd}`);

    return `${segmentLabels.join(' / ')} (${windowSize} bp)`;
  }

  getLineDisplayLabel(lineStartPos, chromosome = null) {
    const sourcePosition = this.displayToSourcePosition(lineStartPos, chromosome);
    return (sourcePosition + 1).toLocaleString();
  }

  getViewportDisplaySegments(viewStart, viewEnd, sequenceLength) {
    const segments = [];
    let cursor = viewStart;

    while (cursor < viewEnd) {
      const sourceStart = this.normalizeCircularPosition(cursor, sequenceLength);
      const basesToBoundary = sourceStart === 0 ? sequenceLength : sequenceLength - sourceStart;
      const displayEnd = Math.min(viewEnd, cursor + basesToBoundary);
      segments.push({
        sourceStart,
        sourceEnd: sourceStart + (displayEnd - cursor),
        displayStart: cursor,
        displayEnd,
      });
      cursor = displayEnd;
    }

    return segments;
  }

  annotationOverlapsSourcePosition(annotation, sourcePosition1Based) {
    if (!annotation || !this.genomeBrowser.shouldShowGeneType(annotation.type)) return false;

    if (annotation.start <= annotation.end) {
      return sourcePosition1Based >= annotation.start && sourcePosition1Based <= annotation.end;
    }

    return sourcePosition1Based >= annotation.start || sourcePosition1Based <= annotation.end;
  }

  getAnnotationDisplaySegments(annotation, lineStartAbs, lineEndAbs, chromosome = null) {
    if (!this.isCircularModeEnabled()) return [annotation];

    if (this.genomeBrowser.trackRenderer?.getFeatureRangeDisplaySegments) {
      return this.genomeBrowser.trackRenderer
        .getFeatureRangeDisplaySegments(
          annotation.start - 1,
          annotation.end,
          { start: lineStartAbs, end: lineEndAbs },
          {
            includeZeroLength: false,
            chromosome,
          }
        )
        .map(segment => ({
          ...annotation,
          start: segment.start + 1,
          end: segment.end,
          _sourceStart: annotation.start,
          _sourceEnd: annotation.end,
        }));
    }

    const sequenceLength = this.getSequenceLength(chromosome);
    if (sequenceLength <= 0) return [annotation];

    const segments = [];
    for (let displayPos = lineStartAbs; displayPos < lineEndAbs; displayPos++) {
      const sourcePos1Based = this.normalizeCircularPosition(displayPos, sequenceLength) + 1;
      if (!this.annotationOverlapsSourcePosition(annotation, sourcePos1Based)) continue;

      const lastSegment = segments[segments.length - 1];
      if (lastSegment && lastSegment.end === displayPos) {
        lastSegment.end = displayPos + 1;
      } else {
        segments.push({
          ...annotation,
          start: displayPos + 1,
          end: displayPos + 1,
          _sourceStart: annotation.start,
          _sourceEnd: annotation.end,
        });
      }
    }

    return segments;
  }

  toggleSequenceTrackSetting(settingKey) {
    const trackRenderer = this.genomeBrowser.trackRenderer;
    if (!trackRenderer?.getTrackSettings || !trackRenderer?.saveTrackSettings) return;

    const settings = { ...trackRenderer.getTrackSettings('sequence') };
    settings[settingKey] = !settings[settingKey];
    trackRenderer.saveTrackSettings('sequence', settings);
    this.clearRenderCache();
    this.syncSequenceHeaderToggleButtons(settings);

    const chromosome = this.genomeBrowser.currentChromosome;
    const sequenceData = this.genomeBrowser.currentSequence;
    if (chromosome && sequenceData && sequenceData[chromosome]) {
      this.displayEnhancedSequence(chromosome, sequenceData[chromosome]);
    }
  }

  setSequenceTrackSetting(settingKey, settingValue) {
    const trackRenderer = this.genomeBrowser.trackRenderer;
    if (!trackRenderer?.getTrackSettings || !trackRenderer?.saveTrackSettings) return;

    const settings = { ...trackRenderer.getTrackSettings('sequence') };
    settings[settingKey] = settingValue;
    trackRenderer.saveTrackSettings('sequence', settings);
    this.syncSequenceHeaderToggleButtons(settings);
  }

  toggleSequenceCopyFormat() {
    const settings = this.getSequenceTrackSettings();
    const nextFormat = settings.copyFormat === 'fasta' ? 'clean' : 'fasta';
    this.setSequenceTrackSetting('copyFormat', nextFormat);
  }

  syncSequenceHeaderToggleButtons(settings = this.getSequenceTrackSettings()) {
    const setButtonHint = (button, hint) => {
      if (!button) return;
      const trackRenderer = this.genomeBrowser.trackRenderer;
      if (trackRenderer?.setTrackControlHint) {
        trackRenderer.setTrackControlHint(button, hint);
        return;
      }
      button.title = hint;
      button.dataset.tooltip = hint;
      button.setAttribute('aria-label', hint);
    };

    const toggleButton = (id, isActive, onTitle, offTitle) => {
      const button = document.getElementById(id);
      if (!button) return;
      button.classList.toggle('active', Boolean(isActive));
      button.setAttribute('aria-pressed', Boolean(isActive).toString());
      setButtonHint(button, isActive ? onTitle : offTitle);
    };

    toggleButton(
      'toggleProteinSequenceBtn',
      settings.showProteinSequence,
      'Hide the protein translation shown beneath each visible CDS',
      'Show the translated protein sequence aligned beneath each visible CDS'
    );
    toggleButton(
      'togglePrimerSequenceBtn',
      settings.showPrimers,
      'Hide primer binding footprints beneath the sequence',
      'Show primer binding footprints aligned with the DNA sequence'
    );
    toggleButton(
      'toggleComplementaryStrandBtn',
      settings.showComplementary,
      'Hide the reverse-complement strand',
      'Show the reverse-complement strand below the forward sequence'
    );

    const copyFormatButton = document.getElementById('toggleSequenceCopyFormatBtn');
    if (copyFormatButton) {
      const copyAsFasta = settings.copyFormat === 'fasta';
      copyFormatButton.classList.toggle('active', copyAsFasta);
      copyFormatButton.setAttribute('aria-pressed', copyAsFasta.toString());
      setButtonHint(
        copyFormatButton,
        copyAsFasta
          ? 'Copy format: FASTA (includes a header line). Click to switch to a clean sequence.'
          : 'Copy format: clean sequence (bases only). Click to switch to FASTA.'
      );
      const label = copyFormatButton.querySelector('span');
      if (label) {
        label.textContent = copyAsFasta ? 'FASTA' : 'Clean';
      }
    }
  }

  updateSequenceLineHeightCSS() {
    this.syncLineMetricsFromSettings();

    const style = document.documentElement.style;
    const lineHeightRatio = Math.max(1.2, this.lineHeight / 16);
    style.setProperty('--sequence-line-height', `${this.lineHeight}px`, 'important');
    style.setProperty('--sequence-line-ratio', String(lineHeightRatio), 'important');
    style.setProperty('--sequence-line-spacing', `${this.lineSpacing}px`, 'important');
    style.setProperty('--min-sequence-line-spacing', `${this.minLineSpacing}px`, 'important');
  }

  /**
   * Pull line height / spacing from the persisted sequence track settings into
   * the live instance fields. These are edited in the Settings panel (Indicators
   * tab); this keeps every render path in sync with the saved values.
   */
  syncLineMetricsFromSettings() {
    const settings = this.getSequenceTrackSettings();
    const lineHeight = Number(settings.lineHeight);
    if (Number.isFinite(lineHeight) && lineHeight > 0) {
      this.lineHeight = lineHeight;
    }
    const lineSpacing = Number(settings.lineSpacing);
    if (Number.isFinite(lineSpacing) && lineSpacing >= 0) {
      this.lineSpacing = lineSpacing;
    }
  }

  /**
   * Collapse/expand the bottom sequence track. When collapsed only the header
   * bar remains visible; the content area and resize splitter are hidden and the
   * genome viewer expands to fill the reclaimed space. Toggling again restores
   * the previous panel/genome sizes.
   */
  toggleSequenceTrackCollapse(forceState) {
    const display = document.getElementById('sequenceDisplay');
    const section = document.getElementById('sequenceDisplaySection');
    const splitter = document.getElementById('splitter');
    const genomeSection = document.getElementById('genomeViewerSection');
    const button = document.getElementById('toggleSequenceCollapseBtn');
    if (!display || !section) return;

    const shouldCollapse = typeof forceState === 'boolean' ? forceState : !display.classList.contains('collapsed');

    if (shouldCollapse) {
      // Remember the live layout so we can restore it on expand.
      this._collapsedLayout = {
        sectionFlex: section.style.flex,
        sectionHeight: section.style.height,
        sectionMinHeight: section.style.minHeight,
        sectionMaxHeight: section.style.maxHeight,
        genomeFlex: genomeSection ? genomeSection.style.flex : '',
        genomeHeight: genomeSection ? genomeSection.style.height : '',
        genomeMaxHeight: genomeSection ? genomeSection.style.maxHeight : '',
      };

      display.classList.add('collapsed');
      section.classList.add('collapsed');
      section.style.flex = '0 0 auto';
      section.style.height = 'auto';
      section.style.minHeight = '0';
      section.style.maxHeight = 'none';
      if (splitter) splitter.style.display = 'none';
      if (genomeSection) {
        genomeSection.style.flex = '1';
        genomeSection.style.height = 'auto';
        genomeSection.style.maxHeight = 'none';
      }
    } else {
      display.classList.remove('collapsed');
      section.classList.remove('collapsed');
      const saved = this._collapsedLayout || {};
      section.style.flex = saved.sectionFlex || '';
      section.style.height = saved.sectionHeight || '';
      section.style.minHeight = saved.sectionMinHeight || '';
      section.style.maxHeight = saved.sectionMaxHeight || '';
      if (splitter) splitter.style.display = 'flex';
      if (genomeSection) {
        genomeSection.style.flex = saved.genomeFlex || '';
        genomeSection.style.height = saved.genomeHeight || '';
        genomeSection.style.maxHeight = saved.genomeMaxHeight || '';
      }
    }

    if (button) {
      const icon = button.querySelector('i');
      const label = button.querySelector('span');
      if (icon) icon.className = shouldCollapse ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
      if (label) label.textContent = shouldCollapse ? 'Expand' : 'Collapse';
      button.setAttribute('aria-expanded', (!shouldCollapse).toString());
      const hint = shouldCollapse
        ? 'Expand the sequence track to show the sequence content again'
        : 'Collapse the sequence track (keep only the header visible)';
      const trackRenderer = this.genomeBrowser.trackRenderer;
      if (trackRenderer?.setTrackControlHint) {
        trackRenderer.setTrackControlHint(button, hint);
      } else {
        button.title = hint;
        button.dataset.tooltip = hint;
        button.setAttribute('aria-label', hint);
      }
    }

    // Let dependent layouts (canvas widths, virtual scroll) recompute.
    window.dispatchEvent(new Event('resize'));
  }

  /**
   * Clean up container styles to prevent mode interference
   */
  cleanupContainer() {
    const container = document.getElementById('sequenceContent');
    if (!container) return;

    console.log('🔧 [SequenceUtils] Cleaning up container for view mode');

    // VSCode editor and SequenceEditor removed - only using view mode

    // Clear container content
    container.innerHTML = '';

    // Only using view mode - clean up any remaining edit mode styles
    const editModeStyles = [
      'font-family',
      'font-size',
      'background',
      'color',
      'overflow',
      'position',
      'min-height',
      'height',
    ];

    editModeStyles.forEach(prop => {
      container.style.removeProperty(prop);
    });

    // Reset container class to default sequence content
    container.className = 'sequence-content';

    // Remove VS Code editor specific classes
    container.classList.remove('vscode-sequence-editor');

    // Immediately restore View Mode CSS variables with verification
    this.updateSequenceLineHeightCSS();

    // Force style recalculation and verify
    setTimeout(() => {
      const currentVars = {
        lineHeight: getComputedStyle(document.documentElement).getPropertyValue('--sequence-line-height'),
        lineRatio: getComputedStyle(document.documentElement).getPropertyValue('--sequence-line-ratio'),
        lineSpacing: getComputedStyle(document.documentElement).getPropertyValue('--sequence-line-spacing'),
      };

      console.log('✅ [SequenceUtils] View Mode CSS variables verification:', {
        expected: { lineHeight: this.lineHeight + 'px', lineSpacing: this.lineSpacing + 'px' },
        actual: currentVars,
      });
    }, 10);

    // Clear any problematic inline styles from child elements
    const inlineStyles = container.querySelectorAll('[style]');
    inlineStyles.forEach(element => {
      // Only clear if it's not a sequence-specific style we want to keep
      if (
        !element.classList.contains('sequence-line') &&
        !element.classList.contains('sequence-position') &&
        !element.classList.contains('gene-indicator-line') &&
        !element.classList.contains('sequence-bases')
      ) {
        element.removeAttribute('style');
      }
    });

    // Clear render cache to ensure fresh rendering
    this.clearRenderCache();

    console.log('✅ [SequenceUtils] Container cleanup completed for view mode');
  }

  // VSCode sequence editor method removed - only using view mode

  measureSequenceLayout(view, chromosome, viewStart, settings, renderContext) {
    // Measure an actual sequence row so padding, the scrollbar gutter, and the
    // base pitch all match the space available to the rendered columns.
    const probe = this.renderSequenceLine(
      'A',
      viewStart,
      chromosome,
      [],
      [],
      1,
      settings,
      new Map(),
      { indicators: [], cds: [], primers: [] },
      renderContext
    );
    // Use an empty aligned row with the same children as a real marker row.
    const proteinRow = this.createAlignedSequenceRow({
      className: 'sequence-protein-row',
      label: 'A',
      marks: [],
      charWidth: 1,
      lineLength: 1,
    });
    const primerRow = proteinRow.cloneNode(true);
    primerRow.className = 'sequence-aligned-row sequence-primer-binding-row';
    probe.append(proteinRow, primerRow);
    probe.style.visibility = 'hidden';
    view.appendChild(probe);

    const groupRect = probe.getBoundingClientRect();
    const bases = probe.querySelector('.main-strand-row .sequence-bases');
    const basesRect = bases.getBoundingClientRect();
    const viewRect = view.getBoundingClientRect();
    const paddingRight = parseFloat(getComputedStyle(view).paddingRight) || 0;
    const availableWidth = viewRect.right - paddingRight - basesRect.left;
    const charWidth = bases.firstElementChild.getBoundingClientRect().width || 9.4;
    const proteinHeight = this.getSequenceRowHeight(proteinRow);
    const primerHeight = this.getSequenceRowHeight(primerRow);
    const baseHeight = this.getSequenceRowHeight(probe, groupRect.height) - proteinHeight - primerHeight;
    const basesPerLine = Math.max(1, Math.floor(availableWidth / charWidth));
    probe.remove();

    return { charWidth, basesPerLine, baseHeight, proteinHeight, primerHeight };
  }

  getSequenceRowHeight(row, height = row.getBoundingClientRect().height) {
    const style = getComputedStyle(row);
    return height + (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0);
  }

  displayDetailedSequence(chromosome, fullSequence, viewStart, viewEnd) {
    // Use throttled render for drag optimization
    const renderFunction = () => {
      this.performDetailedSequenceRender(chromosome, fullSequence, viewStart, viewEnd);
    };

    // If not throttled, render immediately; otherwise queue for later
    if (!this.throttledRender(renderFunction)) {
      console.log('🔧 [SequenceUtils] Sequence render throttled during drag');
    }
  }

  /**
   * Perform the actual detailed sequence render
   */
  performDetailedSequenceRender(chromosome, fullSequence, viewStart, viewEnd) {
    // Start performance monitoring
    this.performanceStats.lastRenderStart = performance.now();
    this.performanceStats.cacheHits = 0;
    this.performanceStats.cacheMisses = 0;

    const container = document.getElementById('sequenceContent');

    if (this.sequenceScrollHandler) {
      container.removeEventListener('scroll', this.sequenceScrollHandler);
      this.sequenceScrollHandler = null;
    }
    container.replaceChildren();
    container.className = 'sequence-content';
    container.scrollTop = 0;

    const subsequence = this.getViewportSequence(fullSequence, viewStart, viewEnd, chromosome);
    const annotations = this.genomeBrowser.currentAnnotations[chromosome] || [];
    const operons = this.genomeBrowser.detectOperons ? this.genomeBrowser.detectOperons(annotations, chromosome) : [];
    this.renderedOperonContexts.set(chromosome, {
      annotations,
      annotationCount: annotations.length,
      operons,
    });

    // Get sequence track settings
    const sequenceSettings = this.getSequenceTrackSettings();
    const primerBindings = sequenceSettings.showPrimers
      ? this.getPrimerBindingFeatures(chromosome, viewStart, viewEnd)
      : [];

    // Check if we should invalidate cache
    if (this.shouldInvalidateCache(chromosome, viewStart, viewEnd, annotations, sequenceSettings)) {
      this.clearRenderCache();
      console.log('🔧 [SequenceUtils] Cache invalidated due to parameter changes');
    }

    const sequenceView = document.createElement('div');
    sequenceView.className = 'detailed-sequence-view';
    container.appendChild(sequenceView);

    const renderContext = this.createRenderContext(chromosome);
    const layout = this.measureSequenceLayout(sequenceView, chromosome, viewStart, sequenceSettings, renderContext);
    const { charWidth, basesPerLine } = layout;
    const totalLines = Math.ceil(subsequence.length / basesPerLine);
    const featureLookup = this.buildFeatureLookup(annotations, viewStart, viewEnd, chromosome);
    const lineFeatureIndex = this.buildLineFeatureIndex(
      annotations,
      viewStart,
      viewStart + subsequence.length,
      basesPerLine,
      chromosome,
      sequenceSettings,
      primerBindings
    );
    const offsets = this.getSequenceLineOffsets(lineFeatureIndex, layout);
    sequenceView.dataset.basesPerLine = String(basesPerLine);
    this.sequenceLayout = { container, sequenceView, viewStart, basesPerLine, offsets };

    const renderLine = lineIndex => {
      const offset = lineIndex * basesPerLine;
      return this.renderSequenceLine(
        subsequence.slice(offset, offset + basesPerLine),
        viewStart + offset,
        chromosome,
        annotations,
        operons,
        charWidth,
        sequenceSettings,
        featureLookup,
        lineFeatureIndex[lineIndex],
        renderContext
      );
    };

    const enableVirtualScrolling = totalLines > 50;
    if (enableVirtualScrolling) {
      this.renderVirtualizedSequence(offsets, renderLine);
    } else {
      this.renderSequenceLinesBatch(sequenceView, totalLines, renderLine);
    }

    this.attachSequenceClickHandlers(container);
    if (this.getCursorPosition() >= 0) this.renderCursor();

    // Update render parameters
    this.updateLastRenderParams(chromosome, viewStart, viewEnd, annotations, sequenceSettings);

    // Log performance stats
    this.performanceStats.renderTime = performance.now() - this.performanceStats.lastRenderStart;
    console.log('🔧 [SequenceUtils] Render completed:', {
      renderTime: this.performanceStats.renderTime.toFixed(2) + 'ms',
      cacheHits: this.performanceStats.cacheHits,
      cacheMisses: this.performanceStats.cacheMisses,
      totalLines: totalLines,
      virtualScrolling: enableVirtualScrolling,
    });
  }

  /**
   * Build optimized feature lookup table
   */
  buildFeatureLookup(annotations, viewStart, viewEnd, chromosome = null) {
    const lookupKey = [
      viewStart,
      viewEnd,
      chromosome || '',
      this.isCircularModeEnabled() ? 'circular' : 'linear',
      this.getSequenceLength(chromosome),
      this.getAnnotationHash(annotations),
    ].join(':');

    if (this.featureCache.has(lookupKey)) {
      this.performanceStats.cacheHits++;
      return this.featureCache.get(lookupKey);
    }

    this.performanceStats.cacheMisses++;

    const lookup = new Map();
    const lookupPriorities = new Map();
    const typeOrder = {
      CDS: 1,
      cds: 1,
      protein_coding: 1,
      mRNA: 2,
      tRNA: 2,
      rRNA: 2,
      promoter: 3,
      terminator: 3,
      regulatory: 3,
      gene: 4,
    };
    const relevantAnnotations = annotations.filter(f => this.shouldShowAnnotationType(f));

    relevantAnnotations.forEach(annotation => {
      const priority = typeOrder[annotation.type] || 5;
      const segments = this.getAnnotationDisplaySegments(annotation, viewStart, viewEnd, chromosome);

      segments.forEach(segment => {
        const segmentStart = Math.max(viewStart, segment.start - 1);
        const segmentEnd = Math.min(viewEnd, segment.end);
        if (segmentEnd <= segmentStart) return;

        for (let displayPos = segmentStart; displayPos < segmentEnd; displayPos++) {
          const lookupKeyForPos = displayPos + 1;
          const existingPriority = lookupPriorities.get(lookupKeyForPos);
          if (existingPriority == null || priority < existingPriority) {
            lookup.set(lookupKeyForPos, segment);
            lookupPriorities.set(lookupKeyForPos, priority);
          }
        }
      });
    });

    this.featureCache.set(lookupKey, lookup);
    return lookup;
  }

  createRenderContext(chromosome = null) {
    const sequenceLength = this.getSequenceLength(chromosome);
    return {
      chromosome,
      sequenceLength,
      circularMode: this.isCircularModeEnabled() && sequenceLength > 0,
    };
  }

  displayToSourcePositionFast(displayPosition, context) {
    if (!context?.circularMode) return displayPosition;
    return ((displayPosition % context.sequenceLength) + context.sequenceLength) % context.sequenceLength;
  }

  buildLineFeatureIndex(
    annotations,
    viewStart,
    viewEnd,
    optimalLineLength,
    chromosome = null,
    settings = {},
    primerBindings = []
  ) {
    const cacheKey = [
      'line-index',
      viewStart,
      viewEnd,
      optimalLineLength,
      chromosome || '',
      this.isCircularModeEnabled() ? 'circular' : 'linear',
      this.getSequenceLength(chromosome),
      this.getAnnotationHash(annotations),
      this.getAnnotationHash(primerBindings),
      this.getSettingsHash(settings),
    ].join(':');

    if (this.lineFeatureCache.has(cacheKey)) {
      this.performanceStats.cacheHits++;
      return this.lineFeatureCache.get(cacheKey);
    }

    this.performanceStats.cacheMisses++;

    const totalLines = Math.ceil((viewEnd - viewStart) / optimalLineLength);
    const index = Array.from({ length: totalLines }, () => ({
      indicators: [],
      cds: [],
      primers: [],
    }));

    annotations.forEach(annotation => {
      if (!this.shouldRenderAnnotationInSequence(annotation, settings)) return;

      const segments = this.getAnnotationDisplaySegments(annotation, viewStart, viewEnd, chromosome);
      segments.forEach(segment => {
        const segmentStart = Math.max(viewStart, segment.start - 1);
        const segmentEnd = Math.min(viewEnd, segment.end);
        if (segmentEnd <= segmentStart) return;

        const firstLine = Math.max(0, Math.floor((segmentStart - viewStart) / optimalLineLength));
        const lastLine = Math.min(
          totalLines - 1,
          Math.floor((Math.max(segmentStart, segmentEnd - 1) - viewStart) / optimalLineLength)
        );

        for (let lineIndex = firstLine; lineIndex <= lastLine; lineIndex++) {
          const lineFeatures = index[lineIndex];
          lineFeatures.indicators.push(segment);

          if (this.isProteinCodingFeature(annotation) && settings.showProteinSequence) {
            if (!lineFeatures.cds.includes(annotation)) {
              lineFeatures.cds.push(annotation);
            }
          }
        }
      });
    });

    if (settings.showPrimers) {
      primerBindings.forEach(primer => {
        const segmentStart = Math.max(viewStart, primer.start - 1);
        const segmentEnd = Math.min(viewEnd, primer.end);
        if (segmentEnd <= segmentStart) return;

        const firstLine = Math.max(0, Math.floor((segmentStart - viewStart) / optimalLineLength));
        const lastLine = Math.min(
          totalLines - 1,
          Math.floor((Math.max(segmentStart, segmentEnd - 1) - viewStart) / optimalLineLength)
        );

        for (let lineIndex = firstLine; lineIndex <= lastLine; lineIndex++) {
          const lineFeatures = index[lineIndex];
          if (!lineFeatures.primers.includes(primer)) {
            lineFeatures.primers.push(primer);
          }
        }
      });
    }

    this.lineFeatureCache.set(cacheKey, index);
    return index;
  }

  shouldRenderAnnotationInSequence(annotation, settings = {}) {
    if (!annotation || !this.shouldShowAnnotationType(annotation)) return false;

    const geneType = (annotation.type || '').toLowerCase();
    if (geneType === 'primer' || geneType === 'primer_bind' || geneType === 'primer_binding') return false;
    if (this.isProteinCodingFeature(annotation) && settings.showCDS === false) return false;
    if (['trna', 'rrna', 'mrna'].includes(geneType) && settings.showRNA === false) return false;
    if (geneType === 'promoter' && settings.showPromoter === false) return false;
    if (geneType === 'terminator' && settings.showTerminator === false) return false;
    if (geneType === 'regulatory' && settings.showRegulatory === false) return false;
    if (geneType === 'source' && settings.showSource === false) return false;

    return true;
  }

  shouldShowAnnotationType(annotation) {
    if (!annotation) return false;
    if (this.genomeBrowser.shouldShowGeneType?.(annotation.type)) return true;
    return this.isProteinCodingFeature(annotation) && this.genomeBrowser.shouldShowGeneType?.('CDS') !== false;
  }

  isProteinCodingFeature(feature) {
    const type = String(feature?.type || '').toLowerCase();
    if (type === 'cds' || type === 'protein_coding' || type === 'coding_sequence') return true;
    return Boolean(this.genomeBrowser.getQualifierValue?.(feature?.qualifiers, 'translation'));
  }

  getSequenceLineOffsets(lineFeatures, { baseHeight, proteinHeight, primerHeight }) {
    const offsets = new Float64Array(lineFeatures.length + 1);
    lineFeatures.forEach(({ cds, primers }, index) => {
      // A CDS that only touches the edge may have no residue on this line.
      // Reserving one slot per overlapping CDS keeps the other rows clear.
      offsets[index + 1] = offsets[index] + baseHeight + cds.length * proteinHeight + primers.length * primerHeight;
    });
    return offsets;
  }

  renderSequenceLinesBatch(view, totalLines, renderLine, batchStart = 0) {
    if (this.dragOptimization.isDragging || !view.isConnected) return;

    const batchEnd = Math.min(batchStart + 10, totalLines);
    for (let lineIndex = batchStart; lineIndex < batchEnd; lineIndex++) {
      view.appendChild(renderLine(lineIndex));
    }

    if (batchEnd < totalLines) {
      requestAnimationFrame(() => this.renderSequenceLinesBatch(view, totalLines, renderLine, batchEnd));
    } else {
      this.restoreSequenceHighlight(view);
      if (this.sequenceLayout?.sequenceView === view && this.sequenceLayout.pendingNavigation) {
        const { position, mode } = this.sequenceLayout.pendingNavigation;
        this.scrollToPosition(position, mode);
      }
    }
  }

  /**
   * Render individual sequence line with caching
   */
  renderSequenceLine(
    lineSubsequence,
    lineStartPos,
    chromosome,
    annotations,
    operons,
    charWidth,
    sequenceSettings,
    featureLookup,
    lineFeatureSet = null,
    renderContext = null
  ) {
    const cacheKey = [
      this.getSequenceLineCacheKey(lineSubsequence, lineStartPos, chromosome),
      charWidth,
      this.getAnnotationHash(lineFeatureSet?.indicators || []),
      this.getAnnotationHash(lineFeatureSet?.cds || []),
      this.getAnnotationHash(lineFeatureSet?.primers || []),
      this.getSettingsHash(sequenceSettings),
    ].join(':');

    if (this.renderCache.has(cacheKey)) {
      this.performanceStats.cacheHits++;
      return this.renderCache.get(cacheKey).cloneNode(true);
    }

    this.performanceStats.cacheMisses++;

    // Calculate indicator positioning first for dynamic sequence line spacing
    const positionWidth = 100; // position span width
    const marginRight = 15; // margin-right of position span
    const alignmentOffset = positionWidth + marginRight;

    // Apply position and size corrections from settings
    const horizontalOffset = sequenceSettings.horizontalOffset || 0;
    const verticalOffset = sequenceSettings.verticalOffset || 0;
    // Position indicator directly below the sequence text with minimal gap
    const indicatorMarginBottom = 4; // Small gap before next sequence line
    const correctedMarginBottom = indicatorMarginBottom - verticalOffset;

    const lineGroup = document.createElement('div');
    lineGroup.className = 'sequence-line-group';
    lineGroup.dataset.displayStart = String(lineStartPos);
    const context = renderContext || this.createRenderContext(chromosome);
    lineGroup.dataset.sourceStart = String(this.displayToSourcePositionFast(lineStartPos, context));
    const sequenceLine = document.createElement('div');
    sequenceLine.className = 'sequence-line';

    // Position label
    const positionSpan = document.createElement('span');
    positionSpan.className = 'sequence-position';
    positionSpan.style.cssText =
      'width: 100px; color: #6c757d; font-weight: 600; margin-right: 15px; text-align: right; flex-shrink: 0; align-self: flex-start; margin-top: 4px;';
    positionSpan.dataset.displayStart = String(lineStartPos);
    positionSpan.dataset.sourceStart = String(this.displayToSourcePositionFast(lineStartPos, context));
    positionSpan.textContent = this.getLineDisplayLabel(lineStartPos, chromosome);

    // Sequence bases
    const basesDiv = document.createElement('div');
    basesDiv.className = 'sequence-bases';
    basesDiv.style.cssText =
      'flex: 1; white-space: nowrap; font-family: "Courier New", monospace; font-size: 14px; line-height: 1.6; letter-spacing: 1px; overflow: hidden;';
    basesDiv.innerHTML = this.colorizeSequenceWithFeaturesOptimized(
      lineSubsequence,
      lineStartPos,
      featureLookup,
      operons,
      chromosome
    );

    // Apply search highlighting if any highlights overlap with this line
    this.applySearchHighlightToLine(basesDiv, lineStartPos, lineSubsequence.length);

    // Create a container for both strands so they stack vertically
    const strandContainer = document.createElement('div');
    strandContainer.className = 'strand-container';
    strandContainer.style.cssText = 'flex: 1; display: flex; flex-direction: column; overflow: hidden;';

    // Main Row
    const mainRow = document.createElement('div');
    mainRow.className = 'strand-row main-strand-row';
    mainRow.style.cssText = 'display: flex; align-items: center; width: 100%;';
    const mainLabel = document.createElement('span');
    mainLabel.textContent = "5'";
    mainLabel.style.cssText =
      'width: 20px; color: #888; font-size: 10px; font-weight: 600; flex-shrink: 0; user-select: none; font-family: sans-serif;';
    mainRow.appendChild(mainLabel);
    mainRow.appendChild(basesDiv);
    strandContainer.appendChild(mainRow);

    if (sequenceSettings.showComplementary) {
      const compSequence = this.getComplement(lineSubsequence);
      const compBasesDiv = document.createElement('div');
      compBasesDiv.className = 'sequence-bases complement-bases';
      compBasesDiv.style.cssText =
        'flex: 1; white-space: nowrap; font-family: "Courier New", monospace; font-size: 14px; line-height: 1.6; letter-spacing: 1px; overflow: hidden; opacity: 0.75;';
      compBasesDiv.innerHTML = this.colorizeSequenceWithFeaturesOptimized(
        compSequence,
        lineStartPos,
        featureLookup,
        operons,
        chromosome
      );

      // Apply search highlighting if any highlights overlap with this line
      this.applySearchHighlightToLine(compBasesDiv, lineStartPos, compSequence.length);

      const compRow = document.createElement('div');
      compRow.className = 'strand-row complement-strand-row';
      compRow.style.cssText = 'display: flex; align-items: center; width: 100%; margin-top: 2px;';
      const compLabel = document.createElement('span');
      compLabel.textContent = "3'";
      compLabel.style.cssText =
        'width: 20px; color: #888; font-size: 10px; font-weight: 600; flex-shrink: 0; user-select: none; font-family: sans-serif;';
      compRow.appendChild(compLabel);
      compRow.appendChild(compBasesDiv);
      strandContainer.appendChild(compRow);
    }

    sequenceLine.appendChild(positionSpan);
    sequenceLine.appendChild(strandContainer);

    // Gene indicator line - use pre-calculated values
    const indicatorLine = document.createElement('div');
    indicatorLine.className = 'gene-indicator-line';

    const finalLeftMargin = alignmentOffset + this.strandLabelWidth + horizontalOffset;
    const correctedHeight = this.getGeneIndicatorHitHeight(sequenceSettings.indicatorHeight || 8, sequenceSettings);

    // Use both inline styles and CSS variables to ensure our spacing takes effect
    indicatorLine.style.cssText = `height: ${correctedHeight}px; margin-left: ${finalLeftMargin}px; margin-bottom: ${correctedMarginBottom}px; margin-top: ${verticalOffset}px;`;

    indicatorLine.innerHTML = this.createGeneIndicatorBarOptimized(
      lineSubsequence,
      lineStartPos,
      lineFeatureSet?.indicators || annotations,
      operons,
      charWidth,
      false,
      sequenceSettings,
      chromosome,
      Boolean(lineFeatureSet)
    );

    if (sequenceSettings.showPrimers) {
      this.createAlignedPrimerRows(
        lineSubsequence.length,
        lineStartPos,
        chromosome,
        annotations,
        charWidth,
        lineFeatureSet?.primers || null,
        context,
        '+'
      ).forEach(row => lineGroup.appendChild(row));
    }

    lineGroup.appendChild(sequenceLine);

    if (sequenceSettings.showPrimers) {
      this.createAlignedPrimerRows(
        lineSubsequence.length,
        lineStartPos,
        chromosome,
        annotations,
        charWidth,
        lineFeatureSet?.primers || null,
        context,
        '-'
      ).forEach(row => lineGroup.appendChild(row));
    }

    if (sequenceSettings.showProteinSequence) {
      this.createAlignedProteinRows(
        lineSubsequence.length,
        lineStartPos,
        chromosome,
        annotations,
        charWidth,
        lineFeatureSet?.cds || null,
        context
      ).forEach(row => lineGroup.appendChild(row));
    }

    if (sequenceSettings.showIndicators !== false) lineGroup.appendChild(indicatorLine);

    // Cache the rendered line
    this.renderCache.set(cacheKey, lineGroup.cloneNode(true));

    return lineGroup;
  }

  createAlignedProteinRows(
    lineLength,
    lineStartAbs,
    chromosome,
    annotations,
    charWidth,
    indexedCdsFeatures = null,
    renderContext = null
  ) {
    const fullSequence = this.genomeBrowser.currentSequence?.[chromosome];
    if (!fullSequence) return [];

    const lineEndAbs = lineStartAbs + lineLength;
    const cdsFeatures =
      indexedCdsFeatures ||
      annotations.filter(feature => {
        if (!this.isProteinCodingFeature(feature)) return false;
        if (!this.shouldShowAnnotationType(feature)) return false;
        return this.featureOverlapsDisplayRange(feature, lineStartAbs, lineEndAbs, chromosome);
      });
    const context = renderContext || this.createRenderContext(chromosome);

    return cdsFeatures
      .map(cds => {
        const proteinSequence = this.getCachedProteinTranslation(cds, fullSequence, chromosome);
        const marks = [];

        for (let i = 0; i < lineLength; i++) {
          const sourcePos1Based = this.displayToSourcePositionFast(lineStartAbs + i, context) + 1;
          if (!this.positionWithinFeature(sourcePos1Based, cds)) continue;

          const aaIndex =
            cds.strand === -1 || cds.strand === '-'
              ? (cds.end - 1 - sourcePos1Based) / 3
              : (sourcePos1Based - (cds.start + 1)) / 3;

          if (!Number.isInteger(aaIndex) || aaIndex < 0 || aaIndex >= proteinSequence.length) continue;
          // The residue is drawn over the middle base of its codon (true for both
          // strands here), so the codon occupies the three contiguous display
          // positions centered on the marker. Record them for hover association.
          const anchorDisplay = lineStartAbs + i;
          marks.push({
            index: i,
            text: proteinSequence[aaIndex],
            title: this.getFeatureDisplayName(cds),
            codonPositions: [anchorDisplay - 1, anchorDisplay, anchorDisplay + 1],
            aa: proteinSequence[aaIndex],
          });
        }

        if (marks.length === 0) return null;
        return this.createAlignedSequenceRow({
          className: 'sequence-protein-row',
          label: this.truncateLabel(this.getFeatureDisplayName(cds), 12),
          marks,
          charWidth,
          lineLength,
          strandLabelWidth: this.strandLabelWidth,
          color: '#065f46',
          background: aa => this.getAminoAcidBackground(aa),
          borderColor: '#86efac',
        });
      })
      .filter(Boolean);
  }

  getCachedProteinTranslation(cds, fullSequence, chromosome) {
    const startIndex = Math.max(0, cds.start - 1);
    const endIndex = Math.min(fullSequence.length, cds.end);
    const dnaSequence = fullSequence.substring(startIndex, endIndex);
    const cacheKey = [
      chromosome || '',
      cds.start,
      cds.end,
      cds.strand || 1,
      dnaSequence.length,
      dnaSequence.substring(0, 12),
      dnaSequence.substring(Math.max(0, dnaSequence.length - 12)),
    ].join(':');

    if (this.proteinTranslationCache.has(cacheKey)) {
      this.performanceStats.cacheHits++;
      return this.proteinTranslationCache.get(cacheKey);
    }

    this.performanceStats.cacheMisses++;
    const proteinSequence = this.translateDNA(dnaSequence, cds.strand, cds);
    this.proteinTranslationCache.set(cacheKey, proteinSequence);
    return proteinSequence;
  }

  getPrimerBindingFeatures(chromosome, viewStart = null, viewEnd = null) {
    const viewport = Number.isFinite(viewStart) && Number.isFinite(viewEnd) ? { start: viewStart, end: viewEnd } : null;

    if (this.genomeBrowser.primerManager) {
      return this.genomeBrowser.primerManager.getRenderableBindingSites(chromosome, viewport);
    }

    const annotations = this.genomeBrowser.currentAnnotations?.[chromosome] || [];
    return annotations
      .filter(feature => {
        const type = (feature.type || '').toLowerCase();
        if (type !== 'primer' && type !== 'primer_bind') return false;
        if (!viewport) return true;
        return this.featureOverlapsDisplayRange(feature, viewport.start, viewport.end, chromosome);
      })
      .map(feature => ({
        ...feature,
        chromosome: feature.chromosome || chromosome,
        primerSequence: this.getPrimerSequence(feature),
        bindingSequence: this.getPrimerSequence(feature),
      }));
  }

  createAlignedPrimerRows(
    lineLength,
    lineStartAbs,
    chromosome,
    annotations,
    charWidth,
    indexedPrimers = null,
    renderContext = null,
    strandFilter = null
  ) {
    void renderContext;
    const lineEndAbs = lineStartAbs + lineLength;
    const primers =
      indexedPrimers ||
      annotations.filter(feature => {
        const type = (feature.type || '').toLowerCase();
        if (type !== 'primer' && type !== 'primer_bind') return false;
        return this.featureOverlapsDisplayRange(feature, lineStartAbs, lineEndAbs, chromosome);
      });
    return primers
      .filter(primer => {
        const isReverse = primer.strand === -1 || primer.strand === '-';
        if (strandFilter === '+') return !isReverse;
        if (strandFilter === '-') return isReverse;
        return true;
      })
      .map(primer => {
        const primerSequence = primer.primerSequence || this.getPrimerSequence(primer);
        const isReverse = primer.strand === -1 || primer.strand === '-';
        const start = Math.min(primer.start, primer.end);
        const end = Math.max(primer.start, primer.end);
        const visibleStart = Math.max(start, lineStartAbs + 1);
        const visibleEnd = Math.min(end, lineStartAbs + lineLength);
        if (visibleEnd < visibleStart) return null;

        const visibleBases = [];
        const mismatchIndexes = new Set((primer.mismatches || []).map(mismatch => mismatch.primerIndex));
        for (let sourcePos1Based = visibleStart; sourcePos1Based <= visibleEnd; sourcePos1Based++) {
          const sequenceIndex = isReverse ? end - sourcePos1Based : sourcePos1Based - start;
          const primerBase = primerSequence ? primerSequence[sequenceIndex] || '' : '';
          visibleBases.push({
            text: primerBase || (isReverse ? '<' : '>'),
            mismatch: mismatchIndexes.has(sequenceIndex),
          });
        }

        // Which physical termini fall on this line? A primer points 5'→3', so the
        // arrowhead belongs at the 3' end and the rounded cap at the 5' end. For a
        // forward primer 5' is at `start` and 3' at `end`; reverse is mirrored. When
        // the primer wraps across lines, the off-line edge stays flat (a continuation).
        const is3PrimeEnd = isReverse ? visibleStart === start : visibleEnd === end;
        const is5PrimeEnd = isReverse ? visibleEnd === end : visibleStart === start;
        const accentColor = primer.color || (isReverse ? '#0d9488' : '#7c3aed');
        const isFivePrimePhosphate = primer.fivePrimePhosphate === true;

        return this.createPrimerBindingRow({
          className: `sequence-primer-row ${isReverse ? 'reverse' : 'forward'}${
            isFivePrimePhosphate ? ' phosphorylated' : ''
          }`,
          label: this.truncateLabel(this.getFeatureDisplayName(primer), 12),
          charWidth,
          lineLength,
          startIndex: visibleStart - (lineStartAbs + 1),
          visibleLength: visibleEnd - visibleStart + 1,
          bases: visibleBases,
          isReverse,
          strandLabelWidth: this.strandLabelWidth,
          accentColor,
          isFivePrimePhosphate,
          // Letters are a darkened blend of the accent so they stay legible on the
          // light tinted fill regardless of a custom primer colour.
          letterColor: `color-mix(in srgb, ${accentColor} 60%, #0f172a)`,
          is3PrimeEnd,
          is5PrimeEnd,
          title: `${this.getFeatureDisplayName(primer)} primer ${primer.start}-${primer.end} (${isReverse ? '-' : '+'})${
            isFivePrimePhosphate ? " · 5' phosphorylated" : ''
          }`,
          // Identity for the delegated click handler that opens the primer details
          // sidebar. Encoded as data attributes (not a listener) so the value
          // survives the renderCache's cloneNode reuse, mirroring gene indicators.
          selectDataset: {
            primerId: primer.id != null ? String(primer.id) : '',
            primerStart: String(primer.start),
            primerEnd: String(primer.end),
            primerStrand: isReverse ? '-' : '+',
            chromosome: primer.chromosome || chromosome || '',
          },
        });
      })
      .filter(Boolean);
  }

  createPrimerBindingRow({
    className,
    label,
    charWidth,
    lineLength,
    startIndex,
    visibleLength,
    bases,
    isReverse,
    strandLabelWidth = 20,
    accentColor,
    isFivePrimePhosphate = false,
    letterColor,
    is3PrimeEnd = true,
    is5PrimeEnd = true,
    title,
    selectDataset = null,
  }) {
    const ARROW_W = 9; // arrowhead width in px (height tracks the bar height via CSS)
    const RADIUS = '5px';
    // Flag a node as a click target for the delegated primer-select handler and
    // stamp it with the primer's identity. Using data attributes (resolved at click
    // time) instead of a per-node listener keeps selection working after the
    // renderCache reuses a line via cloneNode, which drops listeners.
    const markSelectable = node => {
      if (!selectDataset) return;
      node.classList.add('primer-select-target');
      node.style.cursor = 'pointer';
      node.dataset.primerId = selectDataset.primerId;
      node.dataset.primerStart = selectDataset.primerStart;
      node.dataset.primerEnd = selectDataset.primerEnd;
      node.dataset.primerStrand = selectDataset.primerStrand;
      node.dataset.chromosome = selectDataset.chromosome;
    };

    const row = document.createElement('div');
    row.className = `sequence-aligned-row sequence-primer-binding-row ${className}`;

    const labelElement = document.createElement('span');
    labelElement.className = `sequence-position sequence-aligned-label sequence-primer-label ${isReverse ? 'reverse' : 'forward'}`;
    labelElement.textContent = label;
    labelElement.style.color = letterColor;
    labelElement.style.borderColor = accentColor;
    labelElement.title = title;
    markSelectable(labelElement);

    const strandSpacer = document.createElement('span');
    strandSpacer.className = 'sequence-aligned-strand-spacer';
    strandSpacer.style.width = `${strandLabelWidth}px`;
    strandSpacer.style.flex = `0 0 ${strandLabelWidth}px`;

    const basesElement = document.createElement('div');
    basesElement.className = 'sequence-aligned-bases sequence-primer-binding-bases';
    basesElement.style.width = `${Math.max(1, lineLength * charWidth)}px`;

    // The primer body: a filled, bordered bar drawn as a directional shape. It is
    // rounded at the true 5' terminus and runs flat into the arrowhead at the 3'
    // terminus; edges that continue onto another line stay flat. Per-base letters
    // are layered on top in their own genome-aligned columns.
    const box = document.createElement('div');
    box.className = `sequence-primer-binding-box ${isReverse ? 'reverse' : 'forward'}`;
    box.title = title;
    box.style.left = `${startIndex * charWidth}px`;
    box.style.width = `${Math.max(charWidth, visibleLength * charWidth)}px`;
    box.style.borderColor = accentColor;
    box.style.background =
      `linear-gradient(180deg, color-mix(in srgb, ${accentColor} 18%, transparent), ` +
      `color-mix(in srgb, ${accentColor} 8%, transparent))`;
    if (isReverse) {
      // 5' end (rounded cap) is on the right; 3' end (arrowhead) on the left.
      box.style.borderRadius = is5PrimeEnd ? `0 ${RADIUS} ${RADIUS} 0` : '0';
      if (is3PrimeEnd) box.style.borderLeftWidth = '0';
    } else {
      box.style.borderRadius = is5PrimeEnd ? `${RADIUS} 0 0 ${RADIUS}` : '0';
      if (is3PrimeEnd) box.style.borderRightWidth = '0';
    }
    if (selectDataset) box.setAttribute('role', 'button');
    markSelectable(box);
    basesElement.appendChild(box);

    if (isFivePrimePhosphate && is5PrimeEnd) {
      const phosphate = document.createElement('span');
      phosphate.className = `sequence-primer-phosphate ${isReverse ? 'reverse' : 'forward'}`;
      phosphate.textContent = '5P';
      phosphate.title = "5' phosphorylated";
      const phosphateLeft = isReverse ? (startIndex + visibleLength) * charWidth - 18 : startIndex * charWidth - 2;
      phosphate.style.left = `${Math.max(0, phosphateLeft)}px`;
      phosphate.style.borderColor = accentColor;
      if (selectDataset) {
        phosphate.style.pointerEvents = 'auto';
        markSelectable(phosphate);
      }
      basesElement.appendChild(phosphate);
    }

    // One absolutely-positioned cell per base, each exactly charWidth wide and
    // anchored at its genome column so primer letters sit directly above/below the
    // matching genome bases (charWidth === the genome row's monospace pitch).
    bases.forEach((base, i) => {
      const cell = document.createElement('span');
      cell.className = `sequence-primer-binding-base${base.mismatch ? ' mismatch' : ''}`;
      cell.textContent = base.text || '';
      cell.style.left = `${(startIndex + i) * charWidth}px`;
      cell.style.width = `${charWidth}px`;
      if (!base.mismatch) cell.style.color = letterColor;
      basesElement.appendChild(cell);
    });

    // Solid arrowhead flush with the bar at the 3' terminus, drawn as a CSS
    // triangle so it crisply tracks the bar height and points along the strand.
    if (is3PrimeEnd) {
      const direction = document.createElement('span');
      direction.className = `sequence-primer-direction ${isReverse ? 'reverse' : 'forward'}`;
      if (isReverse) {
        direction.style.left = `${startIndex * charWidth - ARROW_W}px`;
        direction.style.borderRightColor = accentColor;
      } else {
        direction.style.left = `${(startIndex + visibleLength) * charWidth}px`;
        direction.style.borderLeftColor = accentColor;
      }
      if (selectDataset) {
        direction.style.pointerEvents = 'auto';
        markSelectable(direction);
      }
      basesElement.appendChild(direction);
    }

    row.appendChild(labelElement);
    row.appendChild(strandSpacer);
    row.appendChild(basesElement);
    return row;
  }

  createAlignedSequenceRow({
    className,
    label,
    marks,
    charWidth,
    lineLength,
    strandLabelWidth = 20,
    color,
    background,
    borderColor,
  }) {
    const row = document.createElement('div');
    row.className = `sequence-aligned-row ${className}`;

    const labelElement = document.createElement('span');
    labelElement.className = 'sequence-position sequence-aligned-label';
    labelElement.textContent = label;

    const strandSpacer = document.createElement('span');
    strandSpacer.className = 'sequence-aligned-strand-spacer';
    strandSpacer.style.width = `${strandLabelWidth}px`;
    strandSpacer.style.flex = `0 0 ${strandLabelWidth}px`;

    const basesElement = document.createElement('div');
    basesElement.className = 'sequence-aligned-bases';
    basesElement.style.width = `${Math.max(1, lineLength * charWidth)}px`;

    marks.forEach(mark => {
      const marker = document.createElement('span');
      marker.className = 'sequence-aligned-marker';
      marker.textContent = mark.text;
      marker.title = mark.title;
      marker.style.left = `${mark.index * charWidth}px`;
      marker.style.width = `${Math.max(1, charWidth)}px`;
      marker.style.color = color;
      marker.style.background = typeof background === 'function' ? background(mark.text) : background;
      marker.style.borderColor = borderColor;
      // Codon <-> residue hover association metadata (used by initializeSequenceSelection)
      if (mark.codonPositions) marker.dataset.codonPositions = mark.codonPositions.join(' ');
      if (mark.aa) marker.dataset.aa = mark.aa;
      basesElement.appendChild(marker);
    });

    row.appendChild(labelElement);
    row.appendChild(strandSpacer);
    row.appendChild(basesElement);
    return row;
  }

  featureOverlapsDisplayRange(feature, lineStartAbs, lineEndAbs, chromosome) {
    for (let displayPos = lineStartAbs; displayPos < lineEndAbs; displayPos++) {
      const sourcePos1Based = this.displayToSourcePosition(displayPos, chromosome) + 1;
      if (this.positionWithinFeature(sourcePos1Based, feature)) return true;
    }
    return false;
  }

  positionWithinFeature(sourcePos1Based, feature) {
    if (!feature) return false;
    if (feature.start <= feature.end) {
      return sourcePos1Based >= feature.start && sourcePos1Based <= feature.end;
    }
    return sourcePos1Based >= feature.start || sourcePos1Based <= feature.end;
  }

  getFeatureDisplayName(feature) {
    return (
      this.genomeBrowser.getQualifierValue?.(feature.qualifiers, 'gene') ||
      this.genomeBrowser.getQualifierValue?.(feature.qualifiers, 'locus_tag') ||
      this.genomeBrowser.getQualifierValue?.(feature.qualifiers, 'label') ||
      feature.name ||
      feature.type ||
      'feature'
    );
  }

  getPrimerSequence(primer) {
    return (
      primer.primerSequence ||
      primer.sequence ||
      this.genomeBrowser.getQualifierValue?.(primer.qualifiers, 'sequence') ||
      this.genomeBrowser.getQualifierValue?.(primer.qualifiers, 'primer_sequence') ||
      this.genomeBrowser.getQualifierValue?.(primer.qualifiers, 'oligo_sequence') ||
      ''
    ).toUpperCase();
  }

  truncateLabel(label, maxLength) {
    const text = String(label || '');
    return text.length > maxLength ? `${text.substring(0, maxLength - 1)}.` : text;
  }

  getAminoAcidBackground(aminoAcid) {
    const colors = {
      A: '#fef3c7',
      V: '#fef3c7',
      L: '#fef3c7',
      I: '#fef3c7',
      M: '#fef3c7',
      F: '#fef3c7',
      W: '#fef3c7',
      P: '#fef3c7',
      S: '#dbeafe',
      T: '#dbeafe',
      Y: '#dbeafe',
      N: '#dbeafe',
      Q: '#dbeafe',
      C: '#dbeafe',
      K: '#fee2e2',
      R: '#fee2e2',
      H: '#fee2e2',
      D: '#dcfce7',
      E: '#dcfce7',
      G: '#f3f4f6',
      '*': '#fecaca',
    };
    return colors[aminoAcid] || '#f3f4f6';
  }

  /**
   * Optimized sequence colorization with feature lookup
   */
  colorizeSequenceWithFeaturesOptimized(sequence, lineStartAbs, featureLookup, operons, chromosome = null) {
    const baseFontSize = '14px';
    const fragments = [];

    for (let i = 0; i < sequence.length; i++) {
      const base = sequence[i];
      const displayPos = lineStartAbs + i;
      const displayPos1Based = displayPos + 1;
      const sourcePos = this.displayToSourcePosition(displayPos, chromosome);
      const baseTextColor = this.getBaseColor(base);

      let featureHexColor = null;
      let featureTitle = '';

      // Use optimized feature lookup
      const mainFeature = featureLookup.get(displayPos1Based);
      if (mainFeature) {
        const operonInfo =
          operons && mainFeature.type !== 'promoter' && mainFeature.type !== 'terminator'
            ? this.genomeBrowser.getGeneOperonInfo(mainFeature, operons)
            : null;
        featureHexColor = operonInfo ? operonInfo.color : this.getFeatureTypeColor(mainFeature.type);
        const featureStart = mainFeature._sourceStart || mainFeature.start;
        const featureEnd = mainFeature._sourceEnd || mainFeature.end;
        featureTitle = `${
          this.genomeBrowser.getQualifierValue(mainFeature.qualifiers, 'gene') ||
          this.genomeBrowser.getQualifierValue(mainFeature.qualifiers, 'locus_tag') ||
          mainFeature.type
        } (${featureStart}-${featureEnd})`;
      }

      // Use cached color calculations
      const colorKey = `${base}:${featureHexColor || 'none'}`;
      let style;

      if (this.colorCache.has(colorKey)) {
        style = this.colorCache.get(colorKey);
        // Ensure cursor text is included even for cached styles
        if (!style.includes('cursor: text')) {
          style += ' cursor: text;';
        }
        this.performanceStats.cacheHits++;
      } else {
        style = `color: ${baseTextColor}; font-size: ${baseFontSize}; display: inline-block; padding: 0; margin: 0; vertical-align: top; cursor: text;`;
        if (featureHexColor) {
          const backgroundColorRgba = this.hexToRgba(featureHexColor, 0.1);
          style += ` background-color: ${backgroundColorRgba};`;
        } else {
          style += ` background-color: transparent;`;
        }
        this.colorCache.set(colorKey, style);
        this.performanceStats.cacheMisses++;
      }

      const className = `base-${base.toLowerCase()}`;
      const titleAttr = featureTitle ? ` title="${featureTitle}"` : '';
      // Removed click handler for cursor positioning
      fragments.push(
        `<span class="${className}" style="${style}" data-position="${sourcePos}" ` +
          `data-display-position="${displayPos}"${titleAttr}>${base}</span>`
      );
    }

    return fragments.join('');
  }

  /**
   * Optimized gene indicator bar creation
   */
  createGeneIndicatorBarOptimized(
    sequence,
    lineStartAbs,
    annotations,
    operons,
    charWidth,
    simplified = false,
    settings = {},
    chromosome = null,
    annotationsAreDisplaySegments = false
  ) {
    // Check if indicators should be shown
    if (settings.showIndicators === false) {
      return '<div style="height: 0px;"></div>';
    }

    // Include settings hash in cache key to ensure cache is invalidated when settings change
    const settingsHash = settings ? this.getSettingsHash(settings) : '';
    const cacheKey = [
      'indicator',
      charWidth,
      lineStartAbs,
      sequence.length,
      chromosome || '',
      this.isCircularModeEnabled() ? 'circular' : 'linear',
      this.getSequenceLength(chromosome),
      this.getAnnotationHash(annotations),
      settingsHash,
    ].join(':');

    if (this.svgCache.has(cacheKey)) {
      this.performanceStats.cacheHits++;
      return this.svgCache.get(cacheKey);
    }

    this.performanceStats.cacheMisses++;

    const barHeight = settings.indicatorHeight || 8;
    const svgHeight = this.getGeneIndicatorHitHeight(barHeight, settings);
    const widthCorrection = (settings.widthCorrection || 100) / 100;
    const lineWidth = sequence.length * charWidth * widthCorrection;
    const lineEndAbs = lineStartAbs + sequence.length;

    const displayGenes = annotationsAreDisplaySegments
      ? annotations
      : annotations.flatMap(gene => this.getAnnotationDisplaySegments(gene, lineStartAbs, lineEndAbs, chromosome));

    // Pre-filter overlapping genes
    const overlappingGenes = displayGenes.filter(gene => {
      if (gene.start > lineEndAbs || gene.end < lineStartAbs + 1) return false;
      if (!this.genomeBrowser.shouldShowGeneType(gene.type)) return false;

      const geneType = gene.type.toLowerCase();
      if (geneType === 'cds' && settings.showCDS === false) return false;
      if (['trna', 'rrna', 'mrna'].includes(geneType) && settings.showRNA === false) return false;
      if (geneType === 'promoter' && settings.showPromoter === false) return false;
      if (geneType === 'terminator' && settings.showTerminator === false) return false;
      if (geneType === 'regulatory' && settings.showRegulatory === false) return false;
      if (geneType === 'source' && settings.showSource === false) return false;

      return true;
    });

    if (overlappingGenes.length === 0) {
      const result =
        `<svg class="gene-indicator-svg" style="width: ${lineWidth}px; ` +
        `height: ${svgHeight}px; margin-left: 0;" viewBox="0 0 ${lineWidth} ${svgHeight}"></svg>`;
      this.svgCache.set(cacheKey, result);
      return result;
    }

    // Build SVG content
    const svgParts = [
      `<svg class="gene-indicator-svg" style="width: ${lineWidth}px; height: ${svgHeight}px; margin-left: 0;" viewBox="0 0 ${lineWidth} ${svgHeight}">`,
    ];

    overlappingGenes.forEach(gene => {
      const indicator = this.createGeneIndicator(
        gene,
        lineStartAbs,
        lineEndAbs,
        charWidth,
        barHeight,
        operons,
        settings
      );
      if (indicator) svgParts.push(indicator);
    });

    svgParts.push('</svg>');

    const result = svgParts.join('');
    this.svgCache.set(cacheKey, result);
    return result;
  }

  renderVirtualizedSequence(offsets, renderLine) {
    const { container, sequenceView } = this.sequenceLayout;
    sequenceView.classList.add('virtualized');

    const viewport = document.createElement('div');
    viewport.className = 'virtual-viewport';
    viewport.style.height = `${offsets[offsets.length - 1]}px`;
    sequenceView.appendChild(viewport);

    let scrollFrame = null;
    let renderedStart = -1;
    let renderedEnd = -1;
    const update = () => {
      if (!viewport.isConnected) return;

      const visibleHeight = container.clientHeight;
      const scrollTop = container.scrollTop - this.getSequenceViewContentTop(sequenceView);
      const start = this.findSequenceLineAtOffset(offsets, scrollTop - visibleHeight);
      const end = this.findSequenceLineAtOffset(offsets, scrollTop + visibleHeight * 2) + 1;
      if (start === renderedStart && end === renderedEnd) return;

      const rows = document.createDocumentFragment();
      for (let lineIndex = start; lineIndex < end; lineIndex++) {
        const row = renderLine(lineIndex);
        row.style.top = `${offsets[lineIndex]}px`;
        rows.appendChild(row);
      }
      viewport.replaceChildren(rows);
      renderedStart = start;
      renderedEnd = end;
      this.restoreSequenceHighlight(viewport);
    };

    this.sequenceScrollHandler = () => {
      if (scrollFrame !== null) return;
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = null;
        update();
      });
    };
    this.sequenceLayout.updateVisibleRows = update;
    container.addEventListener('scroll', this.sequenceScrollHandler);
    update();
  }

  findSequenceLineAtOffset(offsets, top) {
    let first = 0;
    let last = offsets.length - 2;
    while (first < last) {
      const middle = Math.floor((first + last + 1) / 2);
      if (offsets[middle] <= top) {
        first = middle;
      } else {
        last = middle - 1;
      }
    }
    return first;
  }

  getSequenceViewContentTop(view) {
    return view.offsetTop + (parseFloat(getComputedStyle(view).paddingTop) || 0);
  }

  scrollToPosition(position, mode = 'smooth') {
    const layout = this.sequenceLayout;
    if (!layout?.sequenceView.isConnected || !layout.container.clientHeight) return;

    // A new click supersedes a request waiting for batched rows to finish.
    layout.pendingNavigation = null;
    const { container, sequenceView, viewStart, basesPerLine, offsets } = layout;
    const lineIndex = Math.floor((position - viewStart) / basesPerLine);
    if (!Number.isInteger(lineIndex) || lineIndex < 0 || lineIndex >= offsets.length - 1) return;

    const virtualized = sequenceView.classList.contains('virtualized');
    const row = virtualized ? null : sequenceView.children[lineIndex];
    const top = row
      ? sequenceView.offsetTop + row.offsetTop
      : this.getSequenceViewContentTop(sequenceView) + offsets[lineIndex];
    if (mode === 'smooth') {
      container.scrollTo({ top, behavior: 'smooth' });
      return;
    }

    if (!virtualized && sequenceView.children.length < offsets.length - 1) {
      // Layout and scroll height are final once the last batch is mounted.
      layout.pendingNavigation = { position, mode };
      container.scrollTo({ top: container.scrollTop, behavior: 'instant' });
      return;
    }

    const { clientHeight, scrollHeight, scrollTop } = container;
    const visibleRow =
      row || sequenceView.querySelector(`[data-display-start="${viewStart + lineIndex * basesPerLine}"]`);
    const bases = visibleRow?.querySelector('.sequence-line');
    let basesTop = top;
    let basesBottom = top + offsets[lineIndex + 1] - offsets[lineIndex];
    if (bases) {
      const viewportTop = container.getBoundingClientRect().top + container.clientTop;
      const bounds = bases.getBoundingClientRect();
      basesTop = scrollTop + bounds.top - viewportTop;
      basesBottom = scrollTop + bounds.bottom - viewportTop;
    }
    if (basesTop >= scrollTop && basesBottom <= scrollTop + clientHeight) {
      // Cancel any smooth scroll from the previous click.
      container.scrollTo({ top: scrollTop, behavior: 'instant' });
      return;
    }

    if (
      mode === 'smooth-nearby' &&
      !document.body.classList.contains('no-animations') &&
      !window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    ) {
      const nearestTop = Math.max(basesBottom - clientHeight, Math.min(scrollTop, basesTop));
      const nearbyTop = Math.max(0, Math.min(nearestTop, scrollHeight - clientHeight));
      if (Math.abs(nearbyTop - scrollTop) <= clientHeight) {
        container.scrollTo({ top: nearbyTop, behavior: 'smooth' });
        return;
      }
    }

    container.scrollTo({ top, behavior: 'instant' });
    // Render the destination before the next scroll event or paint.
    layout.updateVisibleRows?.();
  }

  restoreActiveGeneSequenceHighlight(container = document.getElementById('sequenceContent') || document) {
    const geneSelection = this.genomeBrowser?.sequenceSelection;
    if (!geneSelection?.active || geneSelection.source !== 'gene') {
      return 0;
    }

    const selectionStart = parseInt(geneSelection.start, 10);
    const selectionEnd = parseInt(geneSelection.end, 10);
    if (Number.isNaN(selectionStart) || Number.isNaN(selectionEnd)) {
      return 0;
    }

    const selection = { start: selectionStart, end: selectionEnd };
    let highlightedCount = 0;

    if (!container || (geneSelection.chromosome && geneSelection.chromosome !== this.genomeBrowser.currentChromosome)) {
      return 0;
    }

    container.querySelectorAll('.sequence-bases span[data-position]').forEach(baseElement => {
      const sourcePosition = Number(baseElement.dataset.position) + 1;
      const isSelected = this.positionWithinFeature(sourcePosition, selection);
      baseElement.classList.toggle('sequence-selected', isSelected);
      baseElement.classList.toggle('gene-sequence-selected', isSelected);
      if (isSelected) highlightedCount++;
    });

    return highlightedCount;
  }

  // Biological utilities
  translateDNA(dnaSequence, strand = 1, feature = null) {
    // Use unified translation implementation
    if (window.UnifiedDNATranslation) {
      const options =
        typeof this.genomeBrowser?.getTranslationOptions === 'function'
          ? this.genomeBrowser.getTranslationOptions(feature)
          : {};
      const result = window.UnifiedDNATranslation.strandBasedTranslateDNA(dnaSequence, strand, options);
      return result;
    }

    // Fallback to original implementation if unified module not available
    const geneticCode = {
      TTT: 'F',
      TTC: 'F',
      TTA: 'L',
      TTG: 'L',
      TCT: 'S',
      TCC: 'S',
      TCA: 'S',
      TCG: 'S',
      TAT: 'Y',
      TAC: 'Y',
      TAA: '*',
      TAG: '*',
      TGT: 'C',
      TGC: 'C',
      TGA: '*',
      TGG: 'W',
      CTT: 'L',
      CTC: 'L',
      CTA: 'L',
      CTG: 'L',
      CCT: 'P',
      CCC: 'P',
      CCA: 'P',
      CCG: 'P',
      CAT: 'H',
      CAC: 'H',
      CAA: 'Q',
      CAG: 'Q',
      CGT: 'R',
      CGC: 'R',
      CGA: 'R',
      CGG: 'R',
      ATT: 'I',
      ATC: 'I',
      ATA: 'I',
      ATG: 'M',
      ACT: 'T',
      ACC: 'T',
      ACA: 'T',
      ACG: 'T',
      AAT: 'N',
      AAC: 'N',
      AAA: 'K',
      AAG: 'K',
      AGT: 'S',
      AGC: 'S',
      AGA: 'R',
      AGG: 'R',
      GTT: 'V',
      GTC: 'V',
      GTA: 'V',
      GTG: 'V',
      GCT: 'A',
      GCC: 'A',
      GCA: 'A',
      GCG: 'A',
      GAT: 'D',
      GAC: 'D',
      GAA: 'E',
      GAG: 'E',
      GGT: 'G',
      GGC: 'G',
      GGA: 'G',
      GGG: 'G',
    };

    let sequence = dnaSequence.toUpperCase();

    // Reverse complement if on negative strand
    if (strand === -1) {
      sequence = this.getReverseComplement(sequence);
    }

    let protein = '';
    for (let i = 0; i < sequence.length - 2; i += 3) {
      const codon = sequence.substring(i, i + 3);
      protein += geneticCode[codon] || 'X';
    }

    return protein;
  }

  getReverseComplement(sequence) {
    const processing =
      typeof module !== 'undefined' && module.exports
        ? require('./UnifiedSequenceProcessing')
        : window.UnifiedSequenceProcessing;
    return processing.reverseComplement(sequence, { caseSensitive: false, validateInput: false }).sequence;
  }

  getComplement(sequence) {
    const complement = {
      A: 'T',
      T: 'A',
      G: 'C',
      C: 'G',
      a: 't',
      t: 'a',
      g: 'c',
      c: 'g',
      N: 'N',
      n: 'n',
      R: 'Y',
      Y: 'R',
      S: 'S',
      W: 'W',
      K: 'M',
      M: 'K',
      B: 'V',
      D: 'H',
      H: 'D',
      V: 'B',
      r: 'y',
      y: 'r',
      s: 's',
      w: 'w',
      k: 'm',
      m: 'k',
      b: 'v',
      d: 'h',
      h: 'd',
      v: 'b',
    };
    return sequence
      .split('')
      .map(base => complement[base] || base)
      .join('');
  }

  // Sequence operations
  /**
   * Copy sequence to system clipboard with proper error handling and optional FASTA formatting
   * @param {string} sequence - The DNA sequence to copy
   * @param {object} selectionInfo - Information about the selection (chromosome, start, end, name)
   * @param {string} copyMessage - Custom message to display (optional)
   * @returns {Promise<boolean>} - True if copy succeeded, false otherwise
   */
  async copyToSystemClipboard(sequence, selectionInfo, copyMessage = null) {
    try {
      const settings = this.getSequenceTrackSettings();
      const copyFormat = settings.copyFormat || 'clean';
      const clipboardContent =
        copyFormat === 'fasta' && selectionInfo ? `${this.createFastaHeader(selectionInfo)}\n${sequence}` : sequence;

      // Try using navigator.clipboard API
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(clipboardContent);
        console.log('✅ [SequenceUtils] Sequence copied to system clipboard (API)');
      } else {
        // Fallback: Use textarea to copy
        const textArea = document.createElement('textarea');
        textArea.value = clipboardContent;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        console.log('✅ [SequenceUtils] Sequence copied to system clipboard (fallback)');
      }

      // Show success notification
      const message = copyMessage || `✅ Copied ${sequence.length} bp to clipboard`;
      console.log('🔔 [SequenceUtils] Attempting to show notification:', message);
      console.log('🔔 [SequenceUtils] genomeBrowser available:', !!this.genomeBrowser);
      console.log('🔔 [SequenceUtils] uiManager available:', !!(this.genomeBrowser && this.genomeBrowser.uiManager));

      if (this.genomeBrowser && this.genomeBrowser.uiManager) {
        console.log('📢 [SequenceUtils] Using UIManager.updateStatus');
        this.genomeBrowser.uiManager.updateStatus(message, {
          highlight: true,
          color: '#10b981',
          duration: 4000,
        });
      } else if (this.genomeBrowser && typeof this.genomeBrowser.showNotification === 'function') {
        console.log('📢 [SequenceUtils] Using showNotification');
        this.genomeBrowser.showNotification(message, 'success');
      } else {
        // Fallback to status bar
        console.log('📢 [SequenceUtils] Using fallback status bar');
        const statusElement = document.getElementById('statusText');
        console.log('📢 [SequenceUtils] statusElement found:', !!statusElement);
        if (statusElement) {
          statusElement.textContent = message;
          statusElement.style.color = '#10b981';
          statusElement.style.fontWeight = 'bold';
          statusElement.style.fontSize = '14px';
          setTimeout(() => {
            statusElement.style.color = '';
            statusElement.style.fontWeight = '';
            statusElement.style.fontSize = '';
          }, 4000);
        }
      }

      return true;
    } catch (err) {
      console.error('❌ [SequenceUtils] Failed to copy to system clipboard:', err);

      // Show error notification
      const errorMessage = '❌ Failed to copy to clipboard';
      if (this.genomeBrowser && this.genomeBrowser.uiManager) {
        this.genomeBrowser.uiManager.updateStatus(errorMessage, {
          highlight: true,
          color: '#ef4444',
          duration: 3000,
        });
      }

      return false;
    }
  }

  createFastaHeader(selectionInfo) {
    const chromosome = selectionInfo.chromosome || this.genomeBrowser.currentChromosome || 'sequence';
    if (selectionInfo.segments?.length > 1) {
      const range = selectionInfo.segments.map(segment => `${segment.start}-${segment.end}`).join('/');
      return `>${selectionInfo.name || `${chromosome}:${range}`}`;
    }

    const startValue = parseInt(selectionInfo.start, 10);
    const endValue = parseInt(selectionInfo.end, 10);
    const isZeroBased = selectionInfo.coordinateSystem === 'zero-based-inclusive';
    const start = Number.isNaN(startValue) ? 1 : startValue + (isZeroBased ? 1 : 0);
    const end = Number.isNaN(endValue) ? start : endValue + (isZeroBased ? 1 : 0);
    const label = selectionInfo.name || `${chromosome}:${start}-${end}`;
    return `>${label}`;
  }

  getManualSelectionSourceRange(selection) {
    const segments = this.getManualSelectionSourceSegments(selection);
    return segments.length === 1 ? segments[0] : null;
  }

  getManualSelectionSourceSegments(selection) {
    if (!selection) return [];

    if (Array.isArray(selection.segments) && selection.segments.length > 0) {
      const offset = selection.coordinateSystem === 'zero-based-inclusive' ? 0 : 1;
      return selection.segments
        .map(segment => {
          const start = parseInt(segment.start, 10);
          const end = parseInt(segment.end, 10);
          if (Number.isNaN(start) || Number.isNaN(end)) return null;
          return {
            start: Math.max(0, Math.min(start, end) - offset),
            end: Math.max(0, Math.max(start, end) - offset),
          };
        })
        .filter(Boolean);
    }

    const rawStart = parseInt(selection.start, 10);
    const rawEnd = parseInt(selection.end, 10);
    if (Number.isNaN(rawStart) || Number.isNaN(rawEnd)) return [];

    const start = Math.min(rawStart, rawEnd);
    const end = Math.max(rawStart, rawEnd);
    if (selection.coordinateSystem === 'zero-based-inclusive') {
      return [{ start, end }];
    }

    return [
      {
        start: Math.max(0, start - 1),
        end: Math.max(0, end - 1),
      },
    ];
  }

  getCopySequenceOptions(eventOrOptions = {}) {
    const shiftKey = Boolean(eventOrOptions?.shiftKey);
    const reverseComplement = Boolean(eventOrOptions?.reverseComplement || shiftKey);
    const copyMode = reverseComplement ? 'reverse-complement' : 'forward';

    return {
      reverseComplement,
      copyMode,
      copyModeLabel: reverseComplement ? 'reverse-complement' : 'forward',
    };
  }

  formatSequenceCopyMessage(sourceLabel, length, unit, copyOptions) {
    return `Copied ${copyOptions.copyModeLabel} ${sourceLabel} (${length} ${unit}) to clipboard`;
  }

  applySequenceCopyMode(sequence, copyOptions) {
    if (!copyOptions.reverseComplement) return sequence;
    return this.getReverseComplement(sequence);
  }

  copySequence(eventOrOptions = {}) {
    const chromosome = document.getElementById('chromosomeSelect')?.value;
    const sequence = this.genomeBrowser.currentSequence?.[chromosome];
    if (!chromosome || !sequence) {
      if (this.genomeBrowser.uiManager) {
        this.genomeBrowser.uiManager.updateStatus('No sequence to copy');
      } else {
        const statusElement = document.getElementById('statusText');
        if (statusElement) statusElement.textContent = 'No sequence to copy';
      }
      return;
    }

    const copyOptions = this.getCopySequenceOptions(eventOrOptions);
    const { sequenceSelection: gene, currentSequenceSelection: manual } = this.genomeBrowser;
    if (gene?.active && gene.source === 'gene' && (!gene.chromosome || gene.chromosome === chromosome)) {
      const selected =
        gene.start > gene.end
          ? sequence.substring(gene.start - 1) + sequence.substring(0, gene.end)
          : sequence.substring(gene.start - 1, gene.end);
      const text = this.applySequenceCopyMode(selected, copyOptions);
      const selectionInfo = {
        chromosome,
        start: gene.start - 1,
        end: gene.end - 1,
        coordinateSystem: 'zero-based-inclusive',
        name: gene.geneName,
      };
      const message = this.formatSequenceCopyMessage(`${gene.geneName} sequence`, text.length, 'bp', copyOptions);
      return this.copyToSystemClipboard(text, selectionInfo, message);
    }

    if (manual && manual.active !== false && (!manual.chromosome || manual.chromosome === chromosome)) {
      const segments = this.getManualSelectionSourceSegments(manual);
      if (!segments.length) return;
      const selected = segments.map(segment => sequence.substring(segment.start, segment.end + 1)).join('');
      const text = this.applySequenceCopyMode(selected, copyOptions);
      const selectionInfo = { ...manual, chromosome, name: null };
      const message = this.formatSequenceCopyMessage('selected sequence', text.length, 'bp', copyOptions);
      return this.copyToSystemClipboard(text, selectionInfo, message);
    }

    const copyModePrompt = copyOptions.reverseComplement
      ? 'Reverse-complement copy mode is active.'
      : 'Forward copy mode is active.';
    if (
      !confirm(
        `No sequence selected. ${copyModePrompt} Click OK to copy the entire visible sequence, or Cancel to select a specific region first.`
      )
    ) {
      const message = 'Click a gene in the Gene Track or drag to select a sequence, then click Copy again.';
      if (this.genomeBrowser.uiManager) {
        this.genomeBrowser.uiManager.updateStatus(message);
      } else {
        const statusElement = document.getElementById('statusText');
        if (statusElement) statusElement.textContent = message;
      }
      return;
    }

    const { start, end } = this.genomeBrowser.currentPosition;
    const text = this.applySequenceCopyMode(this.getViewportSequence(sequence, start, end, chromosome), copyOptions);
    const message = this.formatSequenceCopyMessage('visible sequence', text.length, 'bases', copyOptions);
    return this.copyToSystemClipboard(text, null, message);
  }

  // Statistics and analysis
  updateStatistics(chromosome, sequence) {
    const length = sequence.length;
    const gcCount = (sequence.match(/[GC]/g) || []).length;
    const gcContent = ((gcCount / length) * 100).toFixed(2);

    const sequenceLength = document.getElementById('sequenceLength');
    const gcContentElement = document.getElementById('gcContent');
    const currentPosition = document.getElementById('currentPosition');

    if (sequenceLength) sequenceLength.textContent = length.toLocaleString();
    if (gcContentElement) gcContentElement.textContent = `${gcContent}%`;
    if (currentPosition) {
      currentPosition.textContent = `${this.genomeBrowser.currentPosition.start + 1}-${this.genomeBrowser.currentPosition.end}`;
    }
  }

  // Chromosome management
  populateChromosomeSelect() {
    const select = document.getElementById('chromosomeSelect');
    select.innerHTML = '<option value="">Select chromosome...</option>';

    if (this.genomeBrowser.currentSequence) {
      Object.keys(this.genomeBrowser.currentSequence).forEach(chr => {
        const option = document.createElement('option');
        option.value = chr;
        option.textContent = chr;
        select.appendChild(option);
      });
    }
  }

  selectChromosome(chromosome) {
    if (!chromosome || !this.genomeBrowser.currentSequence[chromosome]) return;

    const sequence = this.genomeBrowser.currentSequence[chromosome];
    this.genomeBrowser.currentPosition = { start: 0, end: Math.min(10000, sequence.length) };

    // Set the current chromosome property for chat interface
    this.genomeBrowser.currentChromosome = chromosome;

    // Update chromosome select
    document.getElementById('chromosomeSelect').value = chromosome;

    // Update statistics
    this.updateStatistics(chromosome, sequence);

    // Show sequence and annotations
    this.genomeBrowser.displayGenomeView(chromosome, sequence);

    // Update current tab title with new chromosome and position (from chromosome switch)
    if (this.genomeBrowser.tabManager) {
      this.genomeBrowser.tabManager.updateCurrentTabPosition(
        chromosome,
        this.genomeBrowser.currentPosition.start + 1,
        this.genomeBrowser.currentPosition.end,
        { source: 'navigation' }
      );
    }
  }

  /**
   * Create gene indicator bar below sequence line - simple narrow shapes with track-consistent colors
   */
  createGeneIndicatorBar(
    sequence,
    lineStartAbs,
    annotations,
    operons,
    charWidth,
    simplified = false,
    settings = {},
    chromosome = null
  ) {
    // Check if indicators should be shown
    if (settings.showIndicators === false) {
      return '<div style="height: 0px;"></div>';
    }

    const barHeight = settings.indicatorHeight || 8; // Use settings or default
    const svgHeight = this.getGeneIndicatorHitHeight(barHeight, settings);
    const lineWidth = sequence.length * charWidth;

    // Create SVG for the indicator bar
    let svg = `<svg class="gene-indicator-svg" style="width: ${lineWidth}px; height: ${svgHeight}px; margin-left: 0;" viewBox="0 0 ${lineWidth} ${svgHeight}">`;

    // Process genes that overlap with this sequence line
    const lineEndAbs = lineStartAbs + sequence.length;
    const displayGenes = annotations.flatMap(gene =>
      this.getAnnotationDisplaySegments(gene, lineStartAbs, lineEndAbs, chromosome)
    );
    const overlappingGenes = displayGenes.filter(gene => {
      if (gene.start > lineEndAbs || gene.end < lineStartAbs + 1) return false;
      if (!this.genomeBrowser.shouldShowGeneType(gene.type)) return false;

      // Apply gene type filters from settings
      const geneType = gene.type.toLowerCase();
      if (geneType === 'cds' && settings.showCDS === false) return false;
      if (['trna', 'rrna', 'mrna'].includes(geneType) && settings.showRNA === false) return false;
      if (geneType === 'promoter' && settings.showPromoter === false) return false;
      if (geneType === 'terminator' && settings.showTerminator === false) return false;
      if (geneType === 'regulatory' && settings.showRegulatory === false) return false;
      if (geneType === 'source' && settings.showSource === false) return false;

      return true;
    });

    // Draw gene indicators for each overlapping gene
    overlappingGenes.forEach(gene => {
      svg += this.createGeneIndicator(gene, lineStartAbs, lineEndAbs, charWidth, barHeight, operons, settings);
    });

    svg += '</svg>';
    return svg;
  }

  /**
   * Create individual gene indicator with start line, gene body, and end arrow
   */
  createGeneIndicator(gene, lineStartAbs, lineEndAbs, charWidth, barHeight, operons, settings = {}) {
    // Get gene color - same as Genes & Features track
    const operonInfo = this.genomeBrowser.getGeneOperonInfo(gene, operons);
    const geneColor = operonInfo ? operonInfo.color : this.getFeatureTypeColor(gene.type);

    // Calculate positions relative to the sequence line with precise alignment
    // Gene coordinates are 1-based, sequence display is 0-based
    // lineStartAbs is 0-based position of the first character in the line

    // Calculate the actual start and end positions within this line
    const geneStart1Based = gene.start;
    const geneEnd1Based = gene.end;
    const lineStart1Based = lineStartAbs + 1; // Convert to 1-based
    const lineEnd1Based = lineEndAbs; // lineEndAbs is already 1-based equivalent

    // Find the portion of the gene that overlaps with this line
    const visibleStart1Based = Math.max(geneStart1Based, lineStart1Based);
    const visibleEnd1Based = Math.min(geneEnd1Based, lineEnd1Based);

    // Convert to 0-based positions relative to the start of this line
    const geneStartInLine = visibleStart1Based - lineStart1Based;
    const geneEndInLine = visibleEnd1Based - lineStart1Based;

    // Convert to edge-based pixel positions so indicators share the same origin as base spans.
    const widthCorrection = (settings.widthCorrection || 100) / 100;
    const correctedCharWidth = charWidth * widthCorrection;
    const startX = geneStartInLine * correctedCharWidth;
    const endX = (geneEndInLine + 1) * correctedCharWidth;
    const width = endX - startX;

    if (width <= 0) return '';

    const isForward = gene.strand !== -1;
    const geneType = gene.type.toLowerCase();
    const tooltipStart = gene._sourceStart || gene.start;
    const tooltipEnd = gene._sourceEnd || gene.end;

    const indicatorGeometry = this.getGeneIndicatorGeometry(barHeight, settings);
    const correctedBarHeight = indicatorGeometry.correctedBarHeight;

    let indicatorContent = '';

    // Gene body shape with corrected height
    indicatorContent += this.createGeneBodyShape(
      { ...gene, start: tooltipStart, end: tooltipEnd },
      startX,
      width,
      correctedBarHeight,
      geneColor,
      geneType,
      settings
    );

    // For forward genes: start marker at left, end arrow at right
    // For reverse genes: start marker at right, end arrow at left
    if (isForward) {
      // Start marker (vertical line) - only if gene actually starts in this line and enabled
      if (
        settings.showStartMarkers !== false &&
        geneStart1Based >= lineStart1Based &&
        geneStart1Based <= lineEnd1Based
      ) {
        const markerWidth = settings.startMarkerWidth || 6;
        const markerHeightPercent = settings.startMarkerHeight || 200;
        const markerHeight = (correctedBarHeight * markerHeightPercent) / 100;
        const markerOffset = (correctedBarHeight - markerHeight) / 2;
        const markerAttrs = this.createGeneIndicatorDataAttributes(gene);
        const markerLabel =
          this.genomeBrowser.getQualifierValue?.(gene.qualifiers, 'gene') ||
          this.genomeBrowser.getQualifierValue?.(gene.qualifiers, 'locus_tag') ||
          gene.type;
        indicatorContent += `<line x1="${startX}" y1="${markerOffset}" x2="${startX}" y2="${markerOffset + markerHeight}" 
                                   stroke="${this.darkenHexColor(geneColor, 30)}" stroke-width="${markerWidth}" opacity="0.9"
                                   ${settings.showTooltips !== false ? `title="Gene start: ${this.escapeHtmlAttribute(markerLabel)}"` : ''} ${markerAttrs}/>`;
      }

      // End marker (arrow) - only if gene actually ends in this line and enabled
      if (settings.showEndArrows !== false && geneEnd1Based >= lineStart1Based && geneEnd1Based <= lineEnd1Based) {
        indicatorContent += this.createGeneEndArrow(endX, correctedBarHeight, geneColor, isForward, gene, settings);
      }
    } else {
      // For reverse genes: start marker at right (gene's actual start), end arrow at left (transcription direction)
      // Start marker (vertical line) - only if gene actually starts in this line and enabled
      if (
        settings.showStartMarkers !== false &&
        geneStart1Based >= lineStart1Based &&
        geneStart1Based <= lineEnd1Based
      ) {
        const markerWidth = settings.startMarkerWidth || 6;
        const markerHeightPercent = settings.startMarkerHeight || 200;
        const markerHeight = (correctedBarHeight * markerHeightPercent) / 100;
        const markerOffset = (correctedBarHeight - markerHeight) / 2;
        // For reverse genes, the start marker should be at the RIGHT end (where gene actually starts)
        const markerAttrs = this.createGeneIndicatorDataAttributes(gene);
        const markerLabel =
          this.genomeBrowser.getQualifierValue?.(gene.qualifiers, 'gene') ||
          this.genomeBrowser.getQualifierValue?.(gene.qualifiers, 'locus_tag') ||
          gene.type;
        indicatorContent += `<line x1="${endX}" y1="${markerOffset}" x2="${endX}" y2="${markerOffset + markerHeight}" 
                                   stroke="${this.darkenHexColor(geneColor, 30)}" stroke-width="${markerWidth}" opacity="0.9"
                                   ${settings.showTooltips !== false ? `title="Gene start: ${this.escapeHtmlAttribute(markerLabel)}"` : ''} ${markerAttrs}/>`;
      }

      // End marker (arrow) - for reverse genes, show arrow at the FIRST line where gene appears (gene start position)
      if (settings.showEndArrows !== false && geneStart1Based >= lineStart1Based && geneStart1Based <= lineEnd1Based) {
        // For reverse genes, the transcription arrow should be at the LEFT end (first appearance in sequence display)
        indicatorContent += this.createGeneEndArrow(startX, correctedBarHeight, geneColor, isForward, gene, settings);
      }
    }

    return [
      this.createGeneIndicatorHitTarget(gene, startX, width, indicatorGeometry.hitHeight, settings),
      `<g transform="translate(0 ${indicatorGeometry.yOffset})">${indicatorContent}</g>`,
    ].join('');
  }

  /**
   * Create gene body shape based on gene type
   */
  createGeneBodyShape(gene, x, width, height, color, geneType, settings = {}) {
    const isForward = gene.strand !== -1;
    const opacity = settings.indicatorOpacity || 0.7;
    const geneLabel =
      this.genomeBrowser.getQualifierValue?.(gene.qualifiers, 'gene') ||
      this.genomeBrowser.getQualifierValue?.(gene.qualifiers, 'locus_tag') ||
      gene.type;
    const tooltipAttr = settings.showTooltips !== false ? `title="${this.escapeHtmlAttribute(geneLabel)}"` : '';
    const hoverClass = settings.showHoverEffects !== false ? 'gene-indicator-hover' : '';
    const targetAttrs = this.createGeneIndicatorDataAttributes(gene, hoverClass);

    let shape = '';

    if (geneType === 'promoter') {
      // Simple arrow for promoter
      if (isForward) {
        shape = `<path d="M ${x} 3 L ${x + width - 6} 3 L ${x + width} ${height / 2} L ${x + width - 6} ${height - 3} L ${x} ${height - 3} Z" 
                               fill="${color}" opacity="${opacity}" ${tooltipAttr} ${targetAttrs}/>`;
      } else {
        shape = `<path d="M ${x + 6} 3 L ${x + width} 3 L ${x + width} ${height - 3} L ${x + 6} ${height - 3} L ${x} ${height / 2} Z" 
                               fill="${color}" opacity="${opacity}" ${tooltipAttr} ${targetAttrs}/>`;
      }
    } else if (geneType === 'terminator') {
      // Rectangle with rounded ends for terminator
      shape = `<rect x="${x}" y="3" width="${width}" height="${height - 6}" rx="3" ry="3" 
                           fill="${color}" opacity="${opacity}" ${tooltipAttr} ${targetAttrs}/>`;
    } else if (['trna', 'rrna', 'mrna'].includes(geneType)) {
      // Wavy shape for RNA
      const waveHeight = 2;
      shape = `<path d="M ${x} ${3 + waveHeight} 
                            Q ${x + width / 4} 3 ${x + width / 2} ${3 + waveHeight / 2}
                            Q ${x + (3 * width) / 4} 3 ${x + width} ${3 + waveHeight}
                            L ${x + width} ${height - 3}
                            L ${x} ${height - 3} Z" 
                            fill="${color}" opacity="${opacity}" ${tooltipAttr} ${targetAttrs}/>`;
    } else {
      // Default rectangle for CDS and others
      shape = `<rect x="${x}" y="3" width="${width}" height="${height - 6}" 
                           fill="${color}" opacity="${opacity}" ${tooltipAttr} ${targetAttrs}/>`;
    }

    return shape;
  }

  /**
   * Create end arrow marker to show gene direction and termination
   */
  createGeneEndArrow(x, height, color, isForward, gene, settings = {}) {
    const arrowSize = settings.arrowSize || 12; // Use settings or default
    const arrowHeightPercent = settings.arrowHeight || 200;
    const arrowHeight = (height * arrowHeightPercent) / 100;
    const arrowOffset = (height - arrowHeight) / 2;
    const darkColor = this.darkenHexColor(color, 40);
    const geneLabel =
      this.genomeBrowser.getQualifierValue?.(gene.qualifiers, 'gene') ||
      this.genomeBrowser.getQualifierValue?.(gene.qualifiers, 'locus_tag') ||
      gene.type;
    const tooltipAttr =
      settings.showTooltips !== false
        ? `title="Gene end (${this.escapeHtmlAttribute(geneLabel)}) ${isForward ? '→' : '←'}"`
        : '';
    const hoverClass = settings.showHoverEffects !== false ? 'gene-indicator-hover' : '';
    const targetAttrs = this.createGeneIndicatorDataAttributes(gene, hoverClass);

    let arrow = '';

    const arrowTop = arrowOffset;
    const arrowMiddle = height / 2;
    const arrowBottom = arrowOffset + arrowHeight;

    if (isForward) {
      // Right-pointing arrow
      arrow = `<path d="M ${x - arrowSize} ${arrowTop} L ${x} ${arrowMiddle} L ${x - arrowSize} ${arrowBottom} Z" 
                           fill="${darkColor}" opacity="1" ${tooltipAttr} ${targetAttrs}/>`;
    } else {
      // Left-pointing arrow
      arrow = `<path d="M ${x + arrowSize} ${arrowTop} L ${x} ${arrowMiddle} L ${x + arrowSize} ${arrowBottom} Z" 
                           fill="${darkColor}" opacity="1" ${tooltipAttr} ${targetAttrs}/>`;
    }

    return arrow;
  }

  /**
   * Create simple indicator shape with colors consistent with Genes & Features track
   */
  createSimpleIndicatorShape(feature, x, width, height, operons) {
    const operonInfo = this.genomeBrowser.getGeneOperonInfo(feature, operons);
    const geneType = feature.type.toLowerCase();
    const isForward = feature.strand !== -1;

    // Use the same colors as Genes & Features track
    const fillColor = operonInfo ? operonInfo.color : this.getFeatureTypeColor(feature.type);

    let shape = '';

    if (geneType === 'promoter') {
      // Simple arrow for promoter
      if (isForward) {
        shape = `<path d="M ${x} 1 L ${x + width - 3} 1 L ${x + width} ${height / 2} L ${x + width - 3} ${height - 1} L ${x} ${height - 1} Z" 
                               fill="${fillColor}" opacity="0.8" title="${feature.qualifiers?.gene || feature.type}"/>`;
      } else {
        shape = `<path d="M ${x + 3} 1 L ${x + width} 1 L ${x + width} ${height - 1} L ${x + 3} ${height - 1} L ${x} ${height / 2} Z" 
                               fill="${fillColor}" opacity="0.8" title="${feature.qualifiers?.gene || feature.type}"/>`;
      }
    } else if (geneType === 'terminator') {
      // Rounded rectangle for terminator
      shape = `<rect x="${x}" y="1" width="${width}" height="${height - 2}" rx="2" ry="2" 
                           fill="${fillColor}" opacity="0.8" title="${feature.qualifiers?.gene || feature.type}"/>`;
    } else if (['trna', 'rrna', 'mrna'].includes(geneType)) {
      // Wavy top for RNA
      const waveHeight = 1;
      shape = `<path d="M ${x} ${1 + waveHeight} 
                            Q ${x + width / 4} 1 ${x + width / 2} ${1 + waveHeight / 2}
                            Q ${x + (3 * width) / 4} 1 ${x + width} ${1 + waveHeight}
                            L ${x + width} ${height - 1}
                            L ${x} ${height - 1} Z" 
                            fill="${fillColor}" opacity="0.8" title="${feature.qualifiers?.gene || feature.type}"/>`;
    } else {
      // Simple rectangle for CDS and others
      shape = `<rect x="${x}" y="1" width="${width}" height="${height - 2}" 
                           fill="${fillColor}" opacity="0.8" title="${feature.qualifiers?.gene || feature.type}"/>`;
    }

    return shape;
  }

  /**
   * Get sequence track settings from trackRenderer
   */
  getSequenceTrackSettings() {
    // Try to get settings from trackRenderer if available
    if (this.genomeBrowser.trackRenderer && this.genomeBrowser.trackRenderer.getTrackSettings) {
      return this.genomeBrowser.trackRenderer.getTrackSettings('sequence');
    }

    // Return default settings if trackRenderer not available
    return {
      showIndicators: true,
      showProteinSequence: false,
      showPrimers: false,
      showComplementary: false,
      copyFormat: 'clean',
      indicatorHeight: 8,
      indicatorOpacity: 0.7,
      showStartMarkers: false,
      showEndArrows: true,
      startMarkerWidth: 6,
      startMarkerHeight: 200,
      arrowSize: 12,
      arrowHeight: 200,
      showCDS: true,
      showRNA: true,
      showPromoter: true,
      showTerminator: true,
      showRegulatory: true,
      showSource: false, // Default: don't show source features
      showTooltips: true,
      showHoverEffects: true,
      // Cursor settings
      cursorColor: '#000000',
      // Position & Size Corrections
      horizontalOffset: 0,
      verticalOffset: 0,
      heightCorrection: 100,
      widthCorrection: 100,
    };
  }

  /**
   * Clear all performance caches
   */
  clearRenderCache() {
    this.renderCache.clear();
    this.featureCache.clear();
    this.lineFeatureCache.clear();
    this.proteinTranslationCache.clear();
    this.colorCache.clear();
    this.svgCache.clear();
    console.log('🔧 [SequenceUtils] Performance caches cleared');
  }

  /**
   * Get cache key for sequence line
   */
  getSequenceLineCacheKey(lineSubsequence, lineStartPos, chromosome) {
    return [
      chromosome,
      lineStartPos,
      lineSubsequence.length,
      this.isCircularModeEnabled() ? 'circular' : 'linear',
      this.getSequenceLength(chromosome),
      lineSubsequence.substring(0, 10),
    ].join(':');
  }

  /**
   * Check if render parameters have changed significantly
   */
  shouldInvalidateCache(chromosome, viewStart, viewEnd, annotations, settings) {
    if (!this.lastRenderParams) return true;

    const params = this.lastRenderParams;

    // Check if settings have changed
    let settingsChanged = false;
    if (settings && params.settingsHash) {
      const currentSettingsHash = this.getSettingsHash(settings);
      settingsChanged = params.settingsHash !== currentSettingsHash;
    } else if (settings || params.settingsHash) {
      // One has settings, the other doesn't
      settingsChanged = true;
    }

    return (
      params.chromosome !== chromosome ||
      params.viewStart !== viewStart ||
      params.viewEnd !== viewEnd ||
      params.circularMode !== this.isCircularModeEnabled() ||
      params.sequenceLength !== this.getSequenceLength(chromosome) ||
      params.annotationCount !== annotations.length ||
      params.annotationHash !== this.getAnnotationHash(annotations) ||
      settingsChanged
    );
  }

  /**
   * Get hash for settings to detect changes
   */
  getSettingsHash(settings) {
    if (!settings) return '';
    // Create a simple hash of key settings that affect rendering
    const keySettings = [
      settings.showIndicators,
      settings.showProteinSequence,
      settings.showPrimers,
      settings.showComplementary,
      settings.indicatorHeight,
      settings.indicatorOpacity,
      settings.showStartMarkers,
      settings.showEndArrows,
      settings.startMarkerWidth,
      settings.startMarkerHeight,
      settings.arrowSize,
      settings.arrowHeight,
      settings.showCDS,
      settings.showRNA,
      settings.showPromoter,
      settings.showTerminator,
      settings.showRegulatory,
      settings.showSource,
      settings.showTooltips,
      settings.showHoverEffects,
      settings.cursorColor,
      settings.horizontalOffset,
      settings.verticalOffset,
      settings.heightCorrection,
      settings.widthCorrection,
    ];
    return keySettings.join('|');
  }

  /**
   * Get simple hash for annotations to detect changes
   */
  getAnnotationHash(annotations) {
    if (!annotations || annotations.length === 0) return '0';
    return (
      annotations.length +
      ':' +
      annotations
        .slice(0, 3)
        .map(a => `${a.start}-${a.end}-${a.type}`)
        .join(',')
    );
  }

  /**
   * Update last render parameters
   */
  updateLastRenderParams(chromosome, viewStart, viewEnd, annotations, settings) {
    this.lastRenderParams = {
      chromosome,
      viewStart,
      viewEnd,
      annotationCount: annotations.length,
      annotationHash: this.getAnnotationHash(annotations),
      settingsHash: settings ? this.getSettingsHash(settings) : '',
      circularMode: this.isCircularModeEnabled(),
      sequenceLength: this.getSequenceLength(chromosome),
      timestamp: Date.now(),
    };
  }

  // Color and styling utility methods

  /**
   * Get color for DNA base
   */
  getBaseColor(base) {
    const colors = {
      A: '#e74c3c', // Red
      T: '#3498db', // Blue
      G: '#2ecc71', // Green
      C: '#f39c12', // Orange
      N: '#95a5a6', // Gray for unknown
    };
    return colors[base.toUpperCase()] || colors['N'];
  }

  /**
   * Get color for feature type
   */
  getFeatureTypeColor(featureType) {
    const colors = {
      CDS: '#4CAF50', // Green
      mRNA: '#2196F3', // Blue
      tRNA: '#2196F3', // Blue
      rRNA: '#2196F3', // Blue
      promoter: '#FF9800', // Orange
      terminator: '#E91E63', // Pink
      regulatory: '#9C27B0', // Purple
      gene: '#607D8B', // Blue Gray
      misc_feature: '#795548', // Brown
    };
    return colors[featureType] || colors['misc_feature'];
  }

  /**
   * Convert hex color to rgba
   */
  hexToRgba(hex, alpha = 1) {
    // Remove # if present
    hex = hex.replace('#', '');

    // Parse hex values
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /**
   * Darken a hex color by a percentage
   */
  darkenHexColor(hex, percent) {
    // Remove # if present
    hex = hex.replace('#', '');

    // Parse hex values
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Darken by reducing each component
    const factor = (100 - percent) / 100;
    const newR = Math.round(r * factor);
    const newG = Math.round(g * factor);
    const newB = Math.round(b * factor);

    // Convert back to hex
    const toHex = n => {
      const hex = n.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
  }

  /**
   * Set minimum line spacing value to prevent overly tight spacing
   * @param {number} minSpacing - Minimum spacing in pixels (default: 6)
   */
  setMinimumLineSpacing(minSpacing = 6) {
    const oldMin = this.minLineSpacing;
    this.minLineSpacing = Math.max(2, Math.floor(minSpacing)); // Ensure at least 2px minimum

    console.log(`🔧 [SequenceUtils] Minimum line spacing updated: ${oldMin}px → ${this.minLineSpacing}px`);

    // If current spacing is below new minimum, adjust it
    if (this.lineSpacing < this.minLineSpacing) {
      this.lineSpacing = this.minLineSpacing;
      this.updateSequenceLineHeightCSS();

      // Update the UI selector if it exists
      const spacingSelector = document.getElementById('sequenceLineSpacingSelector');
      if (spacingSelector) {
        spacingSelector.value = this.lineSpacing;
      }

      console.log(`🔧 [SequenceUtils] Line spacing adjusted to meet minimum: ${this.lineSpacing}px`);
    }
  }

  /**
   * Load minimum line spacing from general settings
   */
  loadMinLineSpacingFromSettings() {
    // Try to get settings from GeneralSettingsManager
    if (this.genomeBrowser && this.genomeBrowser.generalSettingsManager) {
      const settingsManager = this.genomeBrowser.generalSettingsManager;
      if (settingsManager.getSetting) {
        const minSpacing = settingsManager.getSetting('minLineSpacing', 12);
        if (minSpacing !== this.minLineSpacing) {
          console.log(`🔧 [SequenceUtils] Loading minimum line spacing from settings: ${minSpacing}px`);
          this.setMinimumLineSpacing(minSpacing);
        }
      }
    } else {
      // Fallback: try to get from localStorage
      try {
        const generalSettings = JSON.parse(localStorage.getItem('generalSettings') || '{}');
        if (generalSettings.minLineSpacing && generalSettings.minLineSpacing !== this.minLineSpacing) {
          console.log(
            `🔧 [SequenceUtils] Loading minimum line spacing from localStorage: ${generalSettings.minLineSpacing}px`
          );
          this.setMinimumLineSpacing(generalSettings.minLineSpacing);
        }
      } catch (error) {
        console.warn('⚠️ [SequenceUtils] Could not load minimum line spacing from localStorage:', error);
      }
    }
  }

  /**
   * Load cursor settings from sequence track settings
   */
  loadCursorSettings() {
    const settings = this.getSequenceTrackSettings();
    if (settings.cursorColor) {
      this.cursor.color = settings.cursorColor;
    }
  }

  restoreSequenceHighlight(container = document.getElementById('sequenceContent')) {
    const manualSelection = this.genomeBrowser.currentSequenceSelection;
    if (manualSelection && manualSelection.active !== false) {
      this.restoreManualSelection(manualSelection, container);
    } else {
      this.restoreActiveGeneSequenceHighlight(container);
    }
  }

  /**
   * Restore visible bases from the saved interval, including when only part
   * of the selection is currently rendered by the virtual scroller.
   */
  restoreManualSelection(selectionInfo, container = document.getElementById('sequenceContent')) {
    if (!container || !selectionInfo || selectionInfo.active === false) return;
    if (selectionInfo.chromosome && selectionInfo.chromosome !== this.genomeBrowser.currentChromosome) return;

    const segments = this.getManualSelectionSourceSegments(selectionInfo);
    container.querySelectorAll('.sequence-bases span[data-position]').forEach(base => {
      const position = Number(base.dataset.position);
      const selected = segments.some(({ start, end }) => position >= start && position <= end);
      base.classList.toggle('sequence-selected', selected);
      base.classList.toggle('gene-sequence-selected', selected);
    });
  }

  /**
   * Add search highlight range
   */
  addSearchHighlight(start, end) {
    this.searchHighlights.push({ start, end });
    this.refreshSequenceDisplay();
  }

  /**
   * Clear all search highlights
   */
  clearSearchHighlights() {
    this.searchHighlights = [];
    this.lastHighlightedMatches = [];
    this.refreshSequenceDisplay();
  }

  /**
   * Highlight search matches in the sequence display
   */
  highlightSearchMatches(matches) {
    this.clearSearchHighlights();
    matches.forEach(match => {
      if (match.type === 'sequence') {
        this.searchHighlights.push({
          start: match.position,
          end: match.end - 1,
        });
      }
    });
    this.refreshSequenceDisplay();

    // Store matches for potential scrolling after render
    this.lastHighlightedMatches = matches;
  }

  /**
   * Apply search highlighting to a specific sequence line
   */
  applySearchHighlightToLine(basesDiv, lineStartPos, lineLength) {
    if (this.searchHighlights.length === 0) return;

    const overlappingHighlights = [];
    let activeRange = null;

    for (let offset = 0; offset < lineLength; offset++) {
      const sourcePosition = this.displayToSourcePosition(lineStartPos + offset, this.genomeBrowser.currentChromosome);
      const isHighlighted = this.searchHighlights.some(highlight => {
        if (highlight.start <= highlight.end) {
          return sourcePosition >= highlight.start && sourcePosition <= highlight.end;
        }
        return sourcePosition >= highlight.start || sourcePosition <= highlight.end;
      });

      if (isHighlighted && !activeRange) {
        activeRange = { relativeStart: offset, relativeEnd: offset };
      } else if (isHighlighted) {
        activeRange.relativeEnd = offset;
      } else if (activeRange) {
        overlappingHighlights.push(activeRange);
        activeRange = null;
      }
    }

    if (activeRange) {
      overlappingHighlights.push(activeRange);
    }

    if (overlappingHighlights.length === 0) return;

    // Apply highlighting by wrapping the highlighted text in spans
    let innerHTML = basesDiv.innerHTML;

    // Apply highlights in reverse order to maintain character positions
    for (let i = overlappingHighlights.length - 1; i >= 0; i--) {
      const highlight = overlappingHighlights[i];

      // Apply highlighting by adding background style to existing spans
      innerHTML = this.addHighlightToHTML(innerHTML, highlight.relativeStart, highlight.relativeEnd);
    }

    basesDiv.innerHTML = innerHTML;
  }

  /**
   * Add highlighting to HTML content at specified positions
   */
  addHighlightToHTML(html, start, end) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    let charCount = 0;
    const walker = document.createTreeWalker(tempDiv, NodeFilter.SHOW_TEXT, null, false);

    const nodesToHighlight = [];
    let node;

    while ((node = walker.nextNode())) {
      const nodeStart = charCount;
      const nodeEnd = charCount + node.textContent.length - 1;

      if (nodeEnd >= start && nodeStart <= end) {
        // This text node overlaps with the highlight range
        const highlightStartInNode = Math.max(0, start - nodeStart);
        const highlightEndInNode = Math.min(node.textContent.length - 1, end - nodeStart);

        nodesToHighlight.push({
          node: node,
          startOffset: highlightStartInNode,
          endOffset: highlightEndInNode,
        });
      }

      charCount += node.textContent.length;
    }

    // Apply highlighting to identified nodes
    nodesToHighlight.forEach(({ node, startOffset, endOffset }) => {
      const parent = node.parentNode;
      const text = node.textContent;

      // Split the text node into three parts if needed
      const beforeText = text.substring(0, startOffset);
      const highlightText = text.substring(startOffset, endOffset + 1);
      const afterText = text.substring(endOffset + 1);

      // Create new nodes
      const fragment = document.createDocumentFragment();

      if (beforeText) {
        fragment.appendChild(document.createTextNode(beforeText));
      }

      if (highlightText) {
        const highlightSpan = document.createElement('span');
        highlightSpan.style.backgroundColor = this.highlightColor;
        highlightSpan.style.borderRadius = '2px';
        highlightSpan.textContent = highlightText;
        fragment.appendChild(highlightSpan);
      }

      if (afterText) {
        fragment.appendChild(document.createTextNode(afterText));
      }

      // Replace the original text node
      parent.replaceChild(fragment, node);
    });

    return tempDiv.innerHTML;
  }

  /**
   * Calculate molecular weight of DNA, RNA, or Protein sequence
   * @param {string} sequence - Sequence to calculate molecular weight for
   * @param {string} [type='auto'] - Sequence type ('dna', 'protein', or 'auto')
   * @returns {number} Molecular weight in Daltons
   */
  calculateMolecularWeight(sequence, type = 'auto') {
    if (
      window.MicrobeGenomicsFunctions &&
      typeof window.MicrobeGenomicsFunctions.calculateMolecularWeight === 'function'
    ) {
      return window.MicrobeGenomicsFunctions.calculateMolecularWeight(sequence, type);
    }

    // Self-contained fallback
    if (!sequence || typeof sequence !== 'string') return 0;
    const cleanSeq = sequence
      .trim()
      .toUpperCase()
      .replace(/[\s\d-]/g, '');
    if (cleanSeq.length === 0) return 0;

    let detectedType = type;
    if (type === 'auto') {
      if (/^[ATGCNU]+$/.test(cleanSeq)) {
        detectedType = 'dna';
      } else {
        detectedType = 'protein';
      }
    }

    if (detectedType === 'dna' || detectedType === 'rna') {
      const weights = { A: 331.2, T: 322.2, G: 347.2, C: 307.2, U: 308.2, N: 327.0 };
      let weight = 0;
      for (const base of cleanSeq) {
        weight += weights[base] || weights.N;
      }
      return weight - (cleanSeq.length - 1) * 18.01;
    } else {
      const weights = {
        A: 71.08,
        R: 156.19,
        N: 114.1,
        D: 115.09,
        C: 103.14,
        E: 129.12,
        Q: 128.13,
        G: 57.05,
        H: 137.14,
        I: 113.16,
        L: 113.16,
        K: 128.17,
        M: 131.2,
        F: 147.18,
        P: 97.12,
        S: 87.08,
        T: 101.11,
        W: 186.21,
        Y: 163.18,
        V: 99.13,
        U: 150.03,
        O: 237.3,
        '*': 0,
        X: 110.0,
      };
      let weight = 0;
      for (const aa of cleanSeq) {
        weight += weights[aa] || weights.X;
      }
      return weight + 18.02;
    }
  }

  /**
   * Refresh the sequence display to apply highlighting
   */
  refreshSequenceDisplay() {
    // Clear the render cache to force re-rendering with highlights
    this.renderCache.clear();

    // Re-render the current sequence
    const currentChr = document.getElementById('chromosomeSelect')?.value;
    if (currentChr && this.genomeBrowser.currentSequence && this.genomeBrowser.currentSequence[currentChr]) {
      this.displayEnhancedSequence(currentChr, this.genomeBrowser.currentSequence[currentChr]);

      // Trigger scroll after render completes if we have highlighted matches
      if (this.lastHighlightedMatches && this.lastHighlightedMatches.length > 0) {
        setTimeout(() => {
          // Notify NavigationManager to handle scrolling
          if (this.genomeBrowser.navigationManager) {
            this.genomeBrowser.navigationManager.scrollToMatchPosition(this.lastHighlightedMatches[0]);
          }
        }, 100); // Small delay to ensure rendering is complete
      }
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SequenceUtils;
}
