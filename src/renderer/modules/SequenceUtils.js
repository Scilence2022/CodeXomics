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
    this._cachedCharWidth = null; // Cache for character width measurement
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
    this.lastRenderParams = null; // Track last render parameters

    // Virtual scrolling parameters - FIXED: Use actual line height + spacing
    this.virtualScrolling = {
      enabled: false,
      visibleLines: 20,
      bufferLines: 5,
      lineHeight: 36, // FIXED: lineHeight + lineSpacing = 28 + 8 = 36
      scrollTop: 0,
    };

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

    // Periodic check to ensure drag state doesn't get stuck with enhanced recovery
    setInterval(() => {
      if (this.dragOptimization.isDragging) {
        const now = Date.now();
        const timeSinceDrag = now - this.dragOptimization.lastRenderTime;

        // If dragging for more than 5 seconds, force reset with fallback render
        if (timeSinceDrag > 5000) {
          console.warn('⚠️ [SequenceUtils] Force resetting stuck drag state after 5s timeout');
          this.dragOptimization.isDragging = false;
          this.executePendingRender('timeout-reset');

          // Additional fallback if pending render fails
          setTimeout(() => {
            if (!this.dragOptimization.pendingRender) {
              this.forceSequenceRerender();
            }
          }, 100);
        }
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
    this.cursor.visible = true;

    // Update cursor visual in the sequence display
    this.renderCursor();

    // Notify ActionManager about cursor position change
    if (this.genomeBrowser.actionManager) {
      this.genomeBrowser.actionManager.cursorPosition = position;
    }
  }

  /**
   * Get current cursor position
   * @returns {number} Absolute genome position or -1 if no cursor
   */
  getCursorPosition() {
    return this.cursor.visible ? this.cursor.position : -1;
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

    console.log('📌 [SequenceUtils] Cursor cleared');
  }

  /**
   * Render cursor at current position in sequence display
   */
  renderCursor() {
    if (!this.cursor.visible || this.cursor.position < 0) {
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

    console.log('✅ [SequenceUtils] Cursor mouseleave handler attached (persistence mode)');
  }

  // Sequence display methods
  displayEnhancedSequence(chromosome, sequence) {
    const start = this.genomeBrowser.currentPosition.start;
    const end = this.genomeBrowser.currentPosition.end;

    // Update sequence title
    const sequenceTitle = document.getElementById('sequenceTitle');
    if (sequenceTitle) {
      sequenceTitle.textContent = this.formatSequenceRange(chromosome, start, end);
    }

    // Show sequence display section and splitter if not already visible
    const sequenceDisplaySection = document.getElementById('sequenceDisplaySection');
    if (sequenceDisplaySection.style.display === 'none') {
      sequenceDisplaySection.style.display = 'flex';
      document.getElementById('splitter').style.display = 'flex';

      // Ensure proper initial layout balance
      const genomeViewerSection = document.getElementById('genomeViewerSection');
      if (genomeViewerSection) {
        // Reset to balanced flex properties
        genomeViewerSection.style.flex = '1';
        genomeViewerSection.style.maxHeight = '70%';
      }
    }
    document.getElementById('sequenceDisplay').style.display = 'flex'; // Ensure content area is visible

    // Only using view mode - no edit mode functionality

    this.addSequenceDisplayControls();
    this.syncSequenceHeaderToggleButtons(this.getSequenceTrackSettings());

    // Update CSS variables for line height
    this.updateSequenceLineHeightCSS();

    // Display sequence using traditional detailed sequence display
    this.displayDetailedSequence(chromosome, sequence, start, end);

    // Re-highlight selected gene sequence if there is one
    if (this.genomeBrowser.selectedGene && this.genomeBrowser.selectedGene.gene) {
      // Use setTimeout to ensure the DOM is updated before highlighting
      setTimeout(() => {
        this.genomeBrowser.highlightGeneSequence(this.genomeBrowser.selectedGene.gene);
      }, 100);
    }

    // Re-highlight manual text selection if there is one
    if (this.genomeBrowser.currentSequenceSelection) {
      // Use setTimeout to ensure the DOM is updated before highlighting
      setTimeout(() => {
        this.restoreManualSelection(this.genomeBrowser.currentSequenceSelection);
      }, 100);
    }
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

    if (!this.isCircularModeEnabled() || sequenceLength <= 0) {
      return `${chromosome}:${viewStart + 1}-${viewEnd} (${windowSize} bp)`;
    }

    const segments = this.genomeBrowser.trackRenderer?.getViewportSegments
      ? this.genomeBrowser.trackRenderer.getViewportSegments({ start: viewStart, end: viewEnd }, chromosome)
      : this.getViewportDisplaySegments(viewStart, viewEnd, sequenceLength);
    const segmentLabels = segments.map(segment => `${segment.sourceStart + 1}-${segment.sourceEnd}`);

    return `${chromosome}:${segmentLabels.join(' / ')} (${windowSize} bp)`;
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

  /**
   * Add sequence display controls for View Mode
   */
  addSequenceDisplayControls() {
    const sequenceControls = document.querySelector('.sequence-controls') || this.createSequenceControlsContainer();
    this.addLineHeightSelector(sequenceControls);
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

  syncSequenceHeaderToggleButtons(settings = this.getSequenceTrackSettings()) {
    const toggleButton = (id, isActive, onTitle, offTitle) => {
      const button = document.getElementById(id);
      if (!button) return;
      button.classList.toggle('active', Boolean(isActive));
      button.setAttribute('aria-pressed', Boolean(isActive).toString());
      button.title = isActive ? onTitle : offTitle;
    };

    toggleButton(
      'toggleProteinSequenceBtn',
      settings.showProteinSequence,
      'Hide Protein Sequence',
      'Show Protein Sequence'
    );
    toggleButton('togglePrimerSequenceBtn', settings.showPrimers, 'Hide Primers', 'Show Primers');
    toggleButton(
      'toggleComplementaryStrandBtn',
      settings.showComplementary,
      'Hide Complementary Strand',
      'Show Complementary Strand'
    );
  }

  /**
   * Update sequence line height CSS variables and recalculate virtual scrolling
   */
  updateSequenceLineHeightCSS() {
    const root = document.documentElement;

    // Remove existing properties first
    root.style.removeProperty('--sequence-line-height');
    root.style.removeProperty('--sequence-line-ratio');
    root.style.removeProperty('--sequence-line-spacing');
    root.style.removeProperty('--min-sequence-line-spacing');

    // Calculate line height ratio for better text rendering
    const lineHeightRatio = Math.max(1.2, this.lineHeight / 16); // Ensure minimum ratio of 1.2

    // Set CSS custom properties with important flag
    root.style.setProperty('--sequence-line-height', `${this.lineHeight}px`, 'important');
    root.style.setProperty('--sequence-line-ratio', lineHeightRatio.toString(), 'important');
    root.style.setProperty('--sequence-line-spacing', `${this.lineSpacing}px`, 'important');
    root.style.setProperty('--min-sequence-line-spacing', `${this.minLineSpacing}px`, 'important');

    // FIXED: Update virtual scrolling line height to match actual rendering
    this.virtualScrolling.lineHeight = this.lineHeight + this.lineSpacing;

    console.log(
      `🔧 [SequenceUtils] Updated line height: ${this.lineHeight}px, spacing: ${this.lineSpacing}px, virtual line height: ${this.virtualScrolling.lineHeight}px`
    );

    // Verify the CSS properties were applied correctly
    setTimeout(() => {
      const appliedLineHeight = getComputedStyle(root).getPropertyValue('--sequence-line-height');
      const appliedSpacing = getComputedStyle(root).getPropertyValue('--sequence-line-spacing');
      console.log(`🔧 [SequenceUtils] Applied CSS - line height: ${appliedLineHeight}, spacing: ${appliedSpacing}`);
    }, 10);
  }

  /**
   * Add line height selector to sequence controls
   */
  addLineHeightSelector(sequenceControls) {
    // Check if selector already exists
    if (document.getElementById('sequenceLineHeightSelector')) {
      return;
    }

    const lineHeightContainer = document.createElement('div');
    lineHeightContainer.className = 'sequence-line-height-container';
    lineHeightContainer.style.cssText = `
            display: inline-flex;
            align-items: center;
            margin-left: 10px;
            gap: 8px;
        `;

    const label = document.createElement('label');
    label.textContent = 'Line Height:';
    label.style.cssText = `
            font-size: 12px;
            color: #6c757d;
            font-weight: 500;
        `;

    const selector = document.createElement('select');
    selector.id = 'sequenceLineHeightSelector';
    selector.className = 'sequence-line-height-select';
    selector.style.cssText = `
            padding: 4px 8px;
            border: 1px solid #ced4da;
            border-radius: 4px;
            font-size: 12px;
            background-color: white;
            color: #495057;
            cursor: pointer;
            min-width: 80px;
        `;

    const heightOptions = [
      { value: 20, text: 'Compact' },
      { value: 24, text: 'Normal' },
      { value: 28, text: 'Comfortable' },
      { value: 32, text: 'Spacious' },
      { value: 36, text: 'Extra Large' },
    ];

    heightOptions.forEach(option => {
      const optionElement = document.createElement('option');
      optionElement.value = option.value;
      optionElement.textContent = option.text;
      optionElement.selected = option.value === this.lineHeight;
      selector.appendChild(optionElement);
    });

    selector.addEventListener('change', e => {
      this.lineHeight = parseInt(e.target.value);

      // Update CSS variables for new line height
      this.updateSequenceLineHeightCSS();

      // Clear render cache to force re-render with new line height
      this.clearRenderCache();

      // Re-render the sequence with new line height
      const chromosome = this.genomeBrowser.currentChromosome;
      const sequenceData = this.genomeBrowser.currentSequence;
      if (chromosome && sequenceData && sequenceData[chromosome]) {
        const sequence = sequenceData[chromosome];
        this.displayEnhancedSequence(chromosome, sequence);
      }
    });

    lineHeightContainer.appendChild(label);
    lineHeightContainer.appendChild(selector);

    // Add line spacing selector
    this.addLineSpacingSelector(lineHeightContainer);

    sequenceControls.appendChild(lineHeightContainer);
  }

  /**
   * Add line spacing selector to line height container
   */
  addLineSpacingSelector(lineHeightContainer) {
    // Check if selector already exists
    if (document.getElementById('sequenceLineSpacingSelector')) {
      return;
    }

    const spacingLabel = document.createElement('label');
    spacingLabel.textContent = 'Spacing:';
    spacingLabel.style.cssText = `
            font-size: 12px;
            color: #6c757d;
            font-weight: 500;
            margin-left: 15px;
        `;

    const spacingSelector = document.createElement('select');
    spacingSelector.id = 'sequenceLineSpacingSelector';
    spacingSelector.className = 'sequence-line-spacing-select';
    spacingSelector.style.cssText = `
            padding: 4px 8px;
            border: 1px solid #ced4da;
            border-radius: 4px;
            font-size: 12px;
            background-color: white;
            color: #495057;
            cursor: pointer;
            min-width: 70px;
        `;

    const spacingOptions = [
      { value: 2, text: 'Tight' },
      { value: 4, text: 'Close' },
      { value: 6, text: 'Normal' },
      { value: 8, text: 'Relaxed' },
      { value: 12, text: 'Loose' },
      { value: 16, text: 'Wide' },
    ];

    spacingOptions.forEach(option => {
      const optionElement = document.createElement('option');
      optionElement.value = option.value;
      optionElement.textContent = option.text;
      optionElement.selected = option.value === this.lineSpacing;
      spacingSelector.appendChild(optionElement);
    });

    spacingSelector.addEventListener('change', e => {
      this.lineSpacing = parseInt(e.target.value);

      // Update CSS variables for new line spacing
      this.updateSequenceLineHeightCSS();

      // Clear render cache to force re-render with new line spacing
      this.clearRenderCache();

      // Re-render the sequence with new line spacing
      const chromosome = this.genomeBrowser.currentChromosome;
      const sequenceData = this.genomeBrowser.currentSequence;
      if (chromosome && sequenceData && sequenceData[chromosome]) {
        const sequence = sequenceData[chromosome];
        this.displayEnhancedSequence(chromosome, sequence);
      }
    });

    lineHeightContainer.appendChild(spacingLabel);
    lineHeightContainer.appendChild(spacingSelector);
  }

  /**
   * Create or get sequence controls container
   */
  createSequenceControlsContainer() {
    let sequenceControls = document.querySelector('.sequence-controls');
    if (!sequenceControls) {
      sequenceControls = document.createElement('div');
      sequenceControls.className = 'sequence-controls';
      sequenceControls.style.cssText = `
                display: flex;
                align-items: center;
                padding: 8px 15px;
                background-color: #f8f9fa;
                border-bottom: 1px solid #dee2e6;
                gap: 10px;
            `;

      const sequenceDisplay = document.getElementById('sequenceDisplay');
      if (sequenceDisplay) {
        sequenceDisplay.insertBefore(sequenceControls, sequenceDisplay.firstChild);
      }
    }
    return sequenceControls;
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

  measureCharacterWidth(container) {
    // Return cached value if available
    if (this._cachedCharWidth) {
      return this._cachedCharWidth;
    }

    // Use multiple measurements for better accuracy
    const measurements = [];
    const charCounts = [16, 32, 64]; // Use different character counts for validation

    charCounts.forEach(count => {
      const testElement = document.createElement('span');
      testElement.textContent = 'ATCG'.repeat(count / 4);
      testElement.style.cssText = `
                font-family: 'Courier New', monospace;
                font-size: 14px;
                font-weight: 600;
                visibility: hidden;
                position: absolute;
                white-space: nowrap;
                letter-spacing: 1px;
            `;

      container.appendChild(testElement);
      const totalWidth = testElement.offsetWidth;
      const charWidth = totalWidth / count;
      container.removeChild(testElement);

      if (charWidth > 0) {
        measurements.push(charWidth);
      }
    });

    // Calculate average and standard deviation for validation
    const average = measurements.reduce((a, b) => a + b, 0) / measurements.length;
    const variance = measurements.reduce((a, b) => a + Math.pow(b - average, 2), 0) / measurements.length;
    const stdDev = Math.sqrt(variance);

    // Use the most consistent measurement (lowest variance)
    const mostConsistent = measurements.reduce((prev, current) =>
      Math.abs(current - average) < Math.abs(prev - average) ? current : prev
    );

    // Use actual measured width, with a fallback if measurement fails
    this._cachedCharWidth = mostConsistent > 0 ? mostConsistent : 9.5;

    console.log('🔧 [SequenceUtils] Character width measurement:', {
      measurements: measurements.map(m => m.toFixed(3)),
      average: average.toFixed(3),
      stdDev: stdDev.toFixed(3),
      selectedWidth: this._cachedCharWidth.toFixed(3),
      effectiveCharWidth: (this._cachedCharWidth + 1).toFixed(3),
    });

    return this._cachedCharWidth;
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

    // Clean container and reset styles for view mode
    container.innerHTML = '';
    container.style.removeProperty('font-family');
    container.style.removeProperty('background');
    container.style.removeProperty('color');
    // Reset overflow and height - they will be set properly in render methods
    container.style.removeProperty('overflow');
    container.style.removeProperty('height');
    container.className = '';

    const subsequence = this.getViewportSequence(fullSequence, viewStart, viewEnd, chromosome);
    const annotations = this.genomeBrowser.currentAnnotations[chromosome] || [];
    const operons = this.genomeBrowser.detectOperons ? this.genomeBrowser.detectOperons(annotations, chromosome) : [];

    // Get sequence track settings
    const sequenceSettings = this.getSequenceTrackSettings();

    // Check if we should invalidate cache
    if (this.shouldInvalidateCache(chromosome, viewStart, viewEnd, annotations, sequenceSettings)) {
      this.clearRenderCache();
      console.log('🔧 [SequenceUtils] Cache invalidated due to parameter changes');
    }

    const containerWidth = container.offsetWidth || 800;
    const charWidth = this.measureCharacterWidth(container);
    const positionWidth = 100;
    const marginRight = 15; // Position span margin-right
    const padding = 30; // Container padding
    const strandLabelWidth = 20; // 5'/3' label width
    const availableWidth = containerWidth - positionWidth - marginRight - padding - strandLabelWidth;

    // Calculate optimal line length with better precision
    // FIX: Letter-spacing is already included in character width measurement
    const effectiveCharWidth = charWidth; // Remove +1 extra spacing
    let optimalLineLength = Math.max(10, Math.floor(availableWidth / effectiveCharWidth));

    // Calculate actual width that will be used
    const actualUsedWidth = optimalLineLength * effectiveCharWidth;
    const remainingWidth = availableWidth - actualUsedWidth;

    console.log('🔧 [SequenceUtils] Width calculation details:', {
      containerWidth,
      availableWidth,
      charWidth,
      effectiveCharWidth,
      optimalLineLength,
      actualUsedWidth,
      remainingWidth,
    });

    console.log('🔧 [SequenceUtils] Line calculation:', {
      containerWidth,
      charWidth,
      effectiveCharWidth,
      availableWidth,
      optimalLineLength,
      actualUsedWidth,
      remainingWidth,
      utilizationPercentage: ((actualUsedWidth / availableWidth) * 100).toFixed(1) + '%',
    });

    // If there's significant unused space, try to optimize
    if (remainingWidth > effectiveCharWidth && optimalLineLength < 100) {
      const additionalChars = Math.floor(remainingWidth / effectiveCharWidth);
      const newOptimalLength = optimalLineLength + additionalChars;
      console.log('🔧 [SequenceUtils] Optimizing line length:', {
        originalLength: optimalLineLength,
        additionalChars,
        newLength: newOptimalLength,
        newUsedWidth: newOptimalLength * effectiveCharWidth,
      });
      // Use the optimized length if it doesn't exceed container
      if (newOptimalLength * effectiveCharWidth <= availableWidth) {
        optimalLineLength = newOptimalLength;
      }
    }

    // Pre-compute feature lookups for better performance
    const featureLookup = this.buildFeatureLookup(annotations, viewStart, viewEnd, chromosome);

    // Enable virtual scrolling for sequences that actually need it
    const totalLines = Math.ceil(subsequence.length / optimalLineLength);
    const lineFeatureIndex = this.buildLineFeatureIndex(
      annotations,
      viewStart,
      viewEnd,
      optimalLineLength,
      chromosome,
      sequenceSettings
    );
    const renderContext = this.createRenderContext(chromosome);
    this.applySequenceSpacingVariables(sequenceSettings);
    // Estimate if the content will overflow the container
    const estimatedContentHeight = totalLines * this.getSequenceLineBlockHeight(sequenceSettings);
    const estimatedContainerHeight = container.getBoundingClientRect().height || 400;
    const enableVirtualScrolling = totalLines > 50 && estimatedContentHeight > estimatedContainerHeight * 1.5;

    if (enableVirtualScrolling) {
      this.renderVirtualizedSequence(
        container,
        chromosome,
        subsequence,
        viewStart,
        annotations,
        operons,
        charWidth,
        optimalLineLength,
        sequenceSettings,
        featureLookup,
        lineFeatureIndex,
        renderContext
      );
    } else {
      this.renderFullSequence(
        container,
        chromosome,
        subsequence,
        viewStart,
        annotations,
        operons,
        charWidth,
        optimalLineLength,
        sequenceSettings,
        featureLookup,
        lineFeatureIndex,
        renderContext
      );
    }

    // Update render parameters
    this.updateLastRenderParams(chromosome, viewStart, viewEnd, annotations, sequenceSettings);

    // Log performance stats
    this.performanceStats.renderTime = performance.now() - this.performanceStats.lastRenderStart;
    console.log('🔧 [SequenceUtils] Render completed:', {
      renderTime: this.performanceStats.renderTime.toFixed(2) + 'ms',
      cacheHits: this.performanceStats.cacheHits,
      cacheMisses: this.performanceStats.cacheMisses,
      totalLines: totalLines,
      estimatedContentHeight: estimatedContentHeight,
      estimatedContainerHeight: estimatedContainerHeight,
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
    const typeOrder = { CDS: 1, mRNA: 2, tRNA: 2, rRNA: 2, promoter: 3, terminator: 3, regulatory: 3, gene: 4 };
    const relevantAnnotations = annotations.filter(f => this.genomeBrowser.shouldShowGeneType(f.type));

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

  buildLineFeatureIndex(annotations, viewStart, viewEnd, optimalLineLength, chromosome = null, settings = {}) {
    const cacheKey = [
      'line-index',
      viewStart,
      viewEnd,
      optimalLineLength,
      chromosome || '',
      this.isCircularModeEnabled() ? 'circular' : 'linear',
      this.getSequenceLength(chromosome),
      this.getAnnotationHash(annotations),
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

          if (annotation.type === 'CDS' && settings.showProteinSequence) {
            if (!lineFeatures.cds.includes(annotation)) {
              lineFeatures.cds.push(annotation);
            }
          }

          const type = (annotation.type || '').toLowerCase();
          if (settings.showPrimers && (type === 'primer' || type === 'primer_bind')) {
            if (!lineFeatures.primers.includes(annotation)) {
              lineFeatures.primers.push(annotation);
            }
          }
        }
      });
    });

    this.lineFeatureCache.set(cacheKey, index);
    return index;
  }

  shouldRenderAnnotationInSequence(annotation, settings = {}) {
    if (!annotation || !this.genomeBrowser.shouldShowGeneType(annotation.type)) return false;

    const geneType = (annotation.type || '').toLowerCase();
    if (geneType === 'cds' && settings.showCDS === false) return false;
    if (['trna', 'rrna', 'mrna'].includes(geneType) && settings.showRNA === false) return false;
    if (geneType === 'promoter' && settings.showPromoter === false) return false;
    if (geneType === 'terminator' && settings.showTerminator === false) return false;
    if (geneType === 'regulatory' && settings.showRegulatory === false) return false;
    if (geneType === 'source' && settings.showSource === false) return false;

    return true;
  }

  applySequenceSpacingVariables(sequenceSettings = {}) {
    const verticalOffset = sequenceSettings.verticalOffset || 0;
    const indicatorMarginBottom = 4;
    const correctedMarginBottom = indicatorMarginBottom - verticalOffset;

    document.documentElement.style.setProperty('--sequence-line-spacing', `${Math.max(4, correctedMarginBottom)}px`);
    document.documentElement.style.setProperty(
      '--min-sequence-line-spacing',
      `${Math.max(4, correctedMarginBottom)}px`
    );
  }

  /**
   * Render full sequence (for smaller sequences)
   */
  renderFullSequence(
    container,
    chromosome,
    subsequence,
    viewStart,
    annotations,
    operons,
    charWidth,
    optimalLineLength,
    sequenceSettings,
    featureLookup,
    lineFeatureIndex,
    renderContext
  ) {
    // Ensure parent container has proper scrolling enabled
    container.style.overflow = 'auto';
    container.style.height = '100%';

    const tempDiv = document.createElement('div');
    tempDiv.className = 'detailed-sequence-view';

    // Batch DOM operations
    const linesToRender = [];
    for (let i = 0; i < subsequence.length; i += optimalLineLength) {
      const lineSubsequence = subsequence.substring(i, i + optimalLineLength);
      const lineStartPos = viewStart + i;
      linesToRender.push({ lineSubsequence, lineStartPos, index: i });
    }

    this.renderSequenceLinesBatch(
      tempDiv,
      linesToRender,
      chromosome,
      annotations,
      operons,
      charWidth,
      sequenceSettings,
      featureLookup,
      0,
      lineFeatureIndex,
      viewStart,
      optimalLineLength,
      renderContext
    );

    container.appendChild(tempDiv);

    // Add click event listener for cursor positioning
    this.attachSequenceClickHandlers(container);

    // Restore cursor if it was visible before render
    if (this.cursor.visible && this.cursor.position >= 0) {
      console.log('🔄 [SequenceUtils] Re-rendering cursor after full sequence render');
      this.renderCursor();
    }

    // Log container info for debugging
    const totalLines = Math.ceil(subsequence.length / optimalLineLength);
    console.log('🔧 [SequenceUtils] Full sequence render:', {
      totalLines,
      containerHeight: container.getBoundingClientRect().height,
      scrollHeight: container.scrollHeight,
      needsScrolling: container.scrollHeight > container.clientHeight,
    });
  }

  /**
   * Render sequence lines in batches to avoid UI blocking
   */
  renderSequenceLinesBatch(
    container,
    linesToRender,
    chromosome,
    annotations,
    operons,
    charWidth,
    sequenceSettings,
    featureLookup,
    batchStart,
    lineFeatureIndex = null,
    viewStart = 0,
    optimalLineLength = 1,
    renderContext = null
  ) {
    // Skip rendering if we're dragging (optimization)
    if (this.dragOptimization.isDragging) {
      console.log('🔧 [SequenceUtils] Skipping batch render during drag');
      return;
    }

    const batchSize = 10; // Render 10 lines at a time
    const batchEnd = Math.min(batchStart + batchSize, linesToRender.length);

    for (let i = batchStart; i < batchEnd; i++) {
      const { lineSubsequence, lineStartPos } = linesToRender[i];
      const lineElement = this.renderSequenceLine(
        lineSubsequence,
        lineStartPos,
        chromosome,
        annotations,
        operons,
        charWidth,
        sequenceSettings,
        featureLookup,
        this.getLineFeatureSet(lineFeatureIndex, lineStartPos, viewStart, optimalLineLength),
        renderContext
      );
      container.appendChild(lineElement);
    }

    // Continue with next batch if there are more lines
    if (batchEnd < linesToRender.length) {
      // Use requestAnimationFrame to avoid blocking the UI
      requestAnimationFrame(() => {
        // Check again if we're still not dragging before continuing
        if (!this.dragOptimization.isDragging) {
          this.renderSequenceLinesBatch(
            container,
            linesToRender,
            chromosome,
            annotations,
            operons,
            charWidth,
            sequenceSettings,
            featureLookup,
            batchEnd,
            lineFeatureIndex,
            viewStart,
            optimalLineLength,
            renderContext
          );
        } else {
          console.log('🔧 [SequenceUtils] Stopping batch render due to drag start');
        }
      });
    }
  }

  getLineFeatureSet(lineFeatureIndex, lineStartPos, viewStart, optimalLineLength) {
    if (!lineFeatureIndex) return null;
    const lineIndex = Math.floor((lineStartPos - viewStart) / optimalLineLength);
    return lineFeatureIndex[lineIndex] || null;
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
    const cacheKey = this.getSequenceLineCacheKey(lineSubsequence, lineStartPos, chromosome);

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
    const heightCorrection = (sequenceSettings.heightCorrection || 100) / 100;

    // Position indicator directly below the sequence text with minimal gap
    const indicatorMarginTop = -6; // Negative to move up closer to sequence text
    const indicatorMarginBottom = 4; // Small gap before next sequence line
    const correctedMarginTop = indicatorMarginTop + verticalOffset;
    const correctedMarginBottom = indicatorMarginBottom - verticalOffset;

    const lineGroup = document.createElement('div');
    lineGroup.className = 'sequence-line-group';
    lineGroup.dataset.displayStart = String(lineStartPos);
    const context = renderContext || this.createRenderContext(chromosome);
    lineGroup.dataset.sourceStart = String(this.displayToSourcePositionFast(lineStartPos, context));
    lineGroup.style.marginBottom = `${this.lineSpacing}px`;

    // Create sequence line with configurable height to prevent compression
    const sequenceLine = document.createElement('div');
    sequenceLine.className = 'sequence-line';
    // Use configurable line height with appropriate line-height ratio
    const lineHeightRatio = Math.max(1.2, this.lineHeight / 16); // Ensure minimum ratio of 1.2
    // Use dynamic margin-bottom that works with gene indicator positioning
    const sequenceLineMarginBottom = Math.max(4, correctedMarginBottom + 6); // Ensure enough space for gene indicators
    sequenceLine.style.cssText = `display: flex; margin-bottom: ${sequenceLineMarginBottom}px; font-family: "Courier New", monospace; font-size: 14px; line-height: ${lineHeightRatio}; min-height: ${this.lineHeight}px; padding: 4px 0;`;

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
    const correctedHeight = 12 * heightCorrection;

    // Use both inline styles and CSS variables to ensure our spacing takes effect
    indicatorLine.style.cssText = `height: ${correctedHeight}px; margin-left: ${finalLeftMargin}px; margin-bottom: ${correctedMarginBottom}px; margin-top: ${correctedMarginTop}px;`;

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

    lineGroup.appendChild(sequenceLine);

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

    if (sequenceSettings.showPrimers) {
      this.createAlignedPrimerRows(
        lineSubsequence.length,
        lineStartPos,
        chromosome,
        annotations,
        charWidth,
        lineFeatureSet?.primers || null,
        context
      ).forEach(row => lineGroup.appendChild(row));
    }

    lineGroup.appendChild(indicatorLine);

    // Cache the rendered line
    this.renderCache.set(cacheKey, lineGroup.cloneNode(true));

    return lineGroup;
  }

  getSequenceLineBlockHeight(settings = {}) {
    const indicatorHeight = settings.showIndicators === false ? 0 : (settings.indicatorHeight || 8) + 8;
    const proteinHeight = settings.showProteinSequence ? 22 : 0;
    const primerHeight = settings.showPrimers ? 20 : 0;
    const complementaryHeight = settings.showComplementary ? 22 : 0;
    return this.lineHeight + this.lineSpacing + indicatorHeight + proteinHeight + primerHeight + complementaryHeight;
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
        if (feature.type !== 'CDS') return false;
        if (!this.genomeBrowser.shouldShowGeneType('CDS')) return false;
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
          marks.push({ index: i, text: proteinSequence[aaIndex], title: this.getFeatureDisplayName(cds) });
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
    const proteinSequence = this.translateDNA(dnaSequence, cds.strand);
    this.proteinTranslationCache.set(cacheKey, proteinSequence);
    return proteinSequence;
  }

  createAlignedPrimerRows(
    lineLength,
    lineStartAbs,
    chromosome,
    annotations,
    charWidth,
    indexedPrimers = null,
    renderContext = null
  ) {
    const lineEndAbs = lineStartAbs + lineLength;
    const primers =
      indexedPrimers ||
      annotations.filter(feature => {
        const type = (feature.type || '').toLowerCase();
        if (type !== 'primer' && type !== 'primer_bind') return false;
        return this.featureOverlapsDisplayRange(feature, lineStartAbs, lineEndAbs, chromosome);
      });
    const context = renderContext || this.createRenderContext(chromosome);

    return primers
      .map(primer => {
        const primerSequence = this.getPrimerSequence(primer);
        const isReverse = primer.strand === -1 || primer.strand === '-';
        const marks = [];
        const start = Math.min(primer.start, primer.end);
        const end = Math.max(primer.start, primer.end);

        for (let i = 0; i < lineLength; i++) {
          const sourcePos1Based = this.displayToSourcePositionFast(lineStartAbs + i, context) + 1;
          if (sourcePos1Based < start || sourcePos1Based > end) continue;

          const sequenceIndex = isReverse ? end - sourcePos1Based : sourcePos1Based - start;
          const primerBase = primerSequence ? primerSequence[sequenceIndex] || '' : '';
          marks.push({
            index: i,
            text: primerBase || (isReverse ? '<' : '>'),
            title: `${this.getFeatureDisplayName(primer)} primer`,
          });
        }

        if (marks.length === 0) return null;
        return this.createAlignedSequenceRow({
          className: `sequence-primer-row ${isReverse ? 'reverse' : 'forward'}`,
          label: this.truncateLabel(this.getFeatureDisplayName(primer), 12),
          marks,
          charWidth,
          lineLength,
          strandLabelWidth: this.strandLabelWidth,
          color: isReverse ? '#7c2d12' : '#1e3a8a',
          background: () => (isReverse ? 'rgba(251, 146, 60, 0.2)' : 'rgba(96, 165, 250, 0.2)'),
          borderColor: isReverse ? '#fdba74' : '#93c5fd',
        });
      })
      .filter(Boolean);
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
        `height: ${barHeight}px; margin-left: 0;"></svg>`;
      this.svgCache.set(cacheKey, result);
      return result;
    }

    // Build SVG content
    const svgParts = [
      `<svg class="gene-indicator-svg" style="width: ${lineWidth}px; height: ${barHeight}px; margin-left: 0;">`,
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

  /**
   * Render virtualized sequence with corrected line height calculation
   */
  renderVirtualizedSequence(
    container,
    chromosome,
    subsequence,
    viewStart,
    annotations,
    operons,
    charWidth,
    optimalLineLength,
    sequenceSettings,
    featureLookup,
    lineFeatureIndex,
    renderContext
  ) {
    console.log('🔧 [SequenceUtils] Using virtualized rendering for large sequence');

    const totalLines = Math.ceil(subsequence.length / optimalLineLength);

    const actualLineHeight = this.getSequenceLineBlockHeight(sequenceSettings);

    // Calculate actual available height from the parent container
    const parentContainer = document.getElementById('sequenceContent');
    const sequenceDisplaySection = document.getElementById('sequenceDisplaySection');
    let availableHeight = 400; // Default fallback

    if (parentContainer) {
      // Get the actual available height from the parent container
      const parentRect = parentContainer.getBoundingClientRect();
      const parentStyles = window.getComputedStyle(parentContainer);
      const paddingTop = parseInt(parentStyles.paddingTop) || 0;
      const paddingBottom = parseInt(parentStyles.paddingBottom) || 0;
      availableHeight = Math.max(200, parentRect.height - paddingTop - paddingBottom);

      console.log('🔧 [SequenceUtils] Parent container height calculation:', {
        parentHeight: parentRect.height,
        paddingTop,
        paddingBottom,
        availableHeight,
      });
    } else if (sequenceDisplaySection) {
      const sectionRect = sequenceDisplaySection.getBoundingClientRect();
      const sequenceHeader = document.querySelector('.sequence-header');
      const headerHeight = sequenceHeader ? sequenceHeader.offsetHeight : 60;
      availableHeight = Math.max(200, sectionRect.height - headerHeight - 40);
    }

    // Calculate total content height
    const maxPossibleHeight = totalLines * actualLineHeight;

    // Determine if we need scrolling based on content exceeding available space
    const needsScrolling = maxPossibleHeight > availableHeight;
    const containerHeight = needsScrolling ? availableHeight : maxPossibleHeight;

    // Calculate how many lines can fit in the available height
    const dynamicVisibleLines = Math.floor(availableHeight / actualLineHeight);

    console.log(
      `🔧 [SequenceUtils] Container sizing: available=${availableHeight}px, calculated=${containerHeight}px, lines=${totalLines}, visible=${dynamicVisibleLines}, needsScrolling=${needsScrolling}, actualLineHeight=${actualLineHeight}px`
    );

    // Disable parent container scrolling to avoid conflicts
    container.style.overflow = 'hidden';
    container.style.height = '100%';

    // Create virtualized container that takes full parent space
    const virtualContainer = document.createElement('div');
    virtualContainer.className = 'detailed-sequence-view virtualized';
    virtualContainer.style.cssText = `
            height: 100%;
            width: 100%;
            overflow-y: ${needsScrolling ? 'auto' : 'hidden'};
            overflow-x: hidden;
            position: relative;
            box-sizing: border-box;
        `;

    // Viewport for visible lines - set proper height for scrolling
    const viewport = document.createElement('div');
    viewport.className = 'virtual-viewport';
    viewport.style.cssText = `
            height: ${maxPossibleHeight}px;
            position: relative;
            width: 100%;
        `;

    // Visible content container
    const visibleContent = document.createElement('div');
    visibleContent.className = 'virtual-visible-content';
    visibleContent.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
        `;

    viewport.appendChild(visibleContent);
    virtualContainer.appendChild(viewport);

    // Store dynamic parameters for scroll handling
    const virtualScrollingParams = {
      ...this.virtualScrolling,
      lineHeight: actualLineHeight, // FIXED: Use actual line height
      visibleLines: dynamicVisibleLines,
      containerHeight: containerHeight,
      totalLines: totalLines,
      needsScrolling: needsScrolling,
    };

    this.updateVirtualizedContent(
      visibleContent,
      0,
      chromosome,
      subsequence,
      viewStart,
      annotations,
      operons,
      charWidth,
      optimalLineLength,
      sequenceSettings,
      featureLookup,
      totalLines,
      virtualScrollingParams,
      lineFeatureIndex,
      renderContext
    );

    // Scroll handler for virtual scrolling (only if scrolling is needed)
    if (needsScrolling) {
      let scrollTimeout;
      virtualContainer.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          const scrollTop = virtualContainer.scrollTop;
          this.updateVirtualizedContent(
            visibleContent,
            scrollTop,
            chromosome,
            subsequence,
            viewStart,
            annotations,
            operons,
            charWidth,
            optimalLineLength,
            sequenceSettings,
            featureLookup,
            totalLines,
            virtualScrollingParams,
            lineFeatureIndex,
            renderContext
          );
        }, 16); // ~60fps
      });
    }

    container.appendChild(virtualContainer);

    // Add click event listener for cursor positioning
    this.attachSequenceClickHandlers(container);

    // Restore cursor if it was visible before render
    if (this.cursor.visible && this.cursor.position >= 0) {
      console.log('🔄 [SequenceUtils] Re-rendering cursor after virtualized sequence render');
      this.renderCursor();
    }
  }

  /**
   * Update virtualized content based on scroll position with corrected line height
   */
  updateVirtualizedContent(
    visibleContent,
    scrollTop,
    chromosome,
    subsequence,
    viewStart,
    annotations,
    operons,
    charWidth,
    optimalLineLength,
    sequenceSettings,
    featureLookup,
    totalLines,
    virtualScrollingParams = null,
    lineFeatureIndex = null,
    renderContext = null
  ) {
    // Use dynamic parameters if provided, otherwise fall back to instance parameters
    const params = virtualScrollingParams || this.virtualScrolling;
    const lineHeight = params.lineHeight || this.lineHeight + this.lineSpacing; // FIXED: Use actual line height
    const visibleLines = params.visibleLines;
    const bufferLines = params.bufferLines;

    const startLine = Math.max(0, Math.floor(scrollTop / lineHeight) - bufferLines);
    const endLine = Math.min(totalLines, startLine + visibleLines + bufferLines * 2);

    // FIXED: Save selection state before clearing content
    const savedSelection = this.saveSelectionState();

    // Clear existing content
    visibleContent.innerHTML = '';

    // Render visible lines
    for (let lineIndex = startLine; lineIndex < endLine; lineIndex++) {
      const i = lineIndex * optimalLineLength;
      if (i >= subsequence.length) break;

      const lineSubsequence = subsequence.substring(i, i + optimalLineLength);
      const lineStartPos = viewStart + i;

      const lineElement = this.renderSequenceLine(
        lineSubsequence,
        lineStartPos,
        chromosome,
        annotations,
        operons,
        charWidth,
        sequenceSettings,
        featureLookup,
        this.getLineFeatureSet(lineFeatureIndex, lineStartPos, viewStart, optimalLineLength),
        renderContext
      );
      lineElement.style.position = 'absolute';
      lineElement.style.top = `${lineIndex * lineHeight}px`; // FIXED: Use correct line height
      lineElement.style.left = '0';
      // Calculate actual width needed instead of using right: 0
      const effectiveCharWidth = charWidth; // FIX: Remove +1 extra spacing
      const positionWidth = 100;
      const marginRight = 15;
      const padding = 30;
      const actualLineWidth = positionWidth + marginRight + lineSubsequence.length * effectiveCharWidth + padding;
      lineElement.style.width = `${actualLineWidth}px`;

      visibleContent.appendChild(lineElement);
    }

    // FIXED: Restore selection state after content update - use setTimeout to ensure DOM is ready
    if (savedSelection) {
      setTimeout(() => {
        this.restoreSelectionState(savedSelection);
      }, 0);
    }

    console.log(
      `🔧 [SequenceUtils] Virtual scroll update: lines ${startLine}-${endLine} of ${totalLines}, scrollTop=${scrollTop}px, lineHeight=${lineHeight}px`
    );
  }

  // Biological utilities
  translateDNA(dnaSequence, strand = 1) {
    // Use unified translation implementation
    if (window.UnifiedDNATranslation) {
      const result = window.UnifiedDNATranslation.strandBasedTranslateDNA(dnaSequence, strand);
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
    // Use unified sequence processing implementation
    if (window.UnifiedSequenceProcessing) {
      const result = window.UnifiedSequenceProcessing.legacyReverseComplement(sequence);
      return result;
    }

    // Fallback to original implementation if unified module not available
    const complement = {
      A: 'T',
      T: 'A',
      G: 'C',
      C: 'G',
      N: 'N',
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
    };

    return sequence
      .split('')
      .reverse()
      .map(base => complement[base] || base)
      .join('');
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
   * Copy sequence to system clipboard with proper error handling and FASTA formatting
   * @param {string} sequence - The DNA sequence to copy
   * @param {object} selectionInfo - Information about the selection (chromosome, start, end, name)
   * @param {string} copyMessage - Custom message to display (optional)
   * @returns {Promise<boolean>} - True if copy succeeded, false otherwise
   */
  async copyToSystemClipboard(sequence, selectionInfo, copyMessage = null) {
    try {
      // Format as FASTA
      const fastaHeader = `>${selectionInfo.name || selectionInfo.chromosome}:${selectionInfo.start + 1}-${selectionInfo.end + 1}`;
      const fastaContent = `${fastaHeader}\n${sequence}`;

      // Try using navigator.clipboard API
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(fastaContent);
        console.log('✅ [SequenceUtils] Sequence copied to system clipboard (API)');
      } else {
        // Fallback: Use textarea to copy
        const textArea = document.createElement('textarea');
        textArea.value = fastaContent;
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

  copySequence() {
    console.log('🔖 [SequenceUtils] copySequence() called!');

    const currentChr = document.getElementById('chromosomeSelect').value;
    if (!currentChr || !this.genomeBrowser.currentSequence || !this.genomeBrowser.currentSequence[currentChr]) {
      const errorMessage = 'No sequence to copy';
      if (this.genomeBrowser && this.genomeBrowser.uiManager) {
        this.genomeBrowser.uiManager.updateStatus(errorMessage);
      } else {
        const statusElement = document.getElementById('statusText');
        if (statusElement) {
          statusElement.textContent = errorMessage;
        }
      }
      return;
    }

    const sequence = this.genomeBrowser.currentSequence[currentChr];
    let textToCopy;
    let copyMessage;
    let copySource;

    // Priority 1: Check if there's a selected gene sequence
    if (
      this.genomeBrowser.sequenceSelection &&
      this.genomeBrowser.sequenceSelection.active &&
      this.genomeBrowser.sequenceSelection.source === 'gene'
    ) {
      const geneSeq = this.genomeBrowser.sequenceSelection;
      textToCopy = sequence.substring(geneSeq.start - 1, geneSeq.end); // Convert to 0-based indexing
      copyMessage = `Copied ${geneSeq.geneName} sequence (${textToCopy.length} bp) to clipboard`;
      copySource = 'gene';
    } else if (this.genomeBrowser.currentSequenceSelection) {
      // Priority 2: Check if there's a manual sequence selection (drag selection)
      const manualSelection = this.genomeBrowser.currentSequenceSelection;
      console.log('Manual selection:', manualSelection);
      // Convert to 0-based indexing for substring
      const startIdx = manualSelection.start;
      const endIdx = manualSelection.end + 1; // Include end position
      textToCopy = sequence.substring(startIdx, endIdx);
      console.log('Extracted sequence:', textToCopy);
      copyMessage = `Copied selected sequence (${textToCopy.length} bp) to clipboard`;
      copySource = 'manual';
    } else {
      // Priority 3: Check if there's a text selection
      const selection = window.getSelection();
      if (selection.toString().length > 0) {
        // Use selected text
        textToCopy = selection.toString().replace(/\s+/g, '').replace(/\d+/g, '');
        copyMessage = `Copied text selection (${textToCopy.length} bases) to clipboard`;
        copySource = 'text';
      } else {
        // Priority 4: Use entire visible sequence
        const userChoice = confirm(
          'No sequence selected. Click OK to copy the entire visible sequence, or Cancel to select a specific region first.'
        );
        if (!userChoice) {
          const errorMessage =
            'Please click on a gene in the Gene Track or drag to select sequence, then click Copy again.';
          if (this.genomeBrowser && this.genomeBrowser.uiManager) {
            this.genomeBrowser.uiManager.updateStatus(errorMessage);
          } else {
            const statusElement = document.getElementById('statusText');
            if (statusElement) {
              statusElement.textContent = errorMessage;
            }
          }
          return;
        }
        textToCopy = sequence.substring(
          this.genomeBrowser.currentPosition.start,
          this.genomeBrowser.currentPosition.end
        );
        copyMessage = `Copied visible sequence (${textToCopy.length} bases) to clipboard`;
        copySource = 'visible';
      }
    }

    // Create FASTA format for gene sequences and manual selections
    let selectionInfo;
    if (copySource === 'gene') {
      const geneSeq = this.genomeBrowser.sequenceSelection;
      selectionInfo = {
        chromosome: currentChr,
        start: geneSeq.start - 1,
        end: geneSeq.end,
        name: geneSeq.geneName,
      };
    } else if (copySource === 'manual') {
      const manualSelection = this.genomeBrowser.currentSequenceSelection;
      selectionInfo = {
        chromosome: currentChr,
        start: manualSelection.start,
        end: manualSelection.end + 1,
        name: null,
      };
    } else {
      // For text and visible selections, just use navigator.clipboard directly
      navigator.clipboard
        .writeText(textToCopy)
        .then(() => {
          // ... existing code ...
          console.log('🔧 [SequenceUtils] Copy successful, updating status:', copyMessage);
          console.log(
            '🔧 [SequenceUtils] UIManager available:',
            !!(this.genomeBrowser && this.genomeBrowser.uiManager)
          );

          if (this.genomeBrowser && this.genomeBrowser.uiManager) {
            this.genomeBrowser.uiManager.updateStatus(copyMessage, {
              highlight: true,
              color: '#10b981',
              duration: 4000,
            });
          }
          // ... existing code ...
          if (this.genomeBrowser && typeof this.genomeBrowser.showNotification === 'function') {
            this.genomeBrowser.showNotification(copyMessage, 'success');
          } else {
            const statusElement = document.getElementById('statusText');
            if (statusElement) {
              console.log('📐 [SequenceUtils] Using fallback status update');
              statusElement.textContent = copyMessage;
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
        })
        .catch(err => {
          console.error('Failed to copy: ', err);
          const errorMessage = '❌ Failed to copy to clipboard';
          if (this.genomeBrowser && this.genomeBrowser.uiManager) {
            this.genomeBrowser.uiManager.updateStatus(errorMessage, {
              highlight: true,
              color: '#ef4444',
              duration: 3000,
            });
          }
          if (this.genomeBrowser && typeof this.genomeBrowser.showNotification === 'function') {
            this.genomeBrowser.showNotification(errorMessage, 'error');
          } else {
            const statusElement = document.getElementById('statusText');
            if (statusElement) {
              statusElement.textContent = errorMessage;
            }
          }
        });
      return;
    }

    // Use copyToSystemClipboard for gene and manual selections
    this.copyToSystemClipboard(textToCopy, selectionInfo, copyMessage);
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
    const lineWidth = sequence.length * charWidth;

    // Create SVG for the indicator bar
    let svg = `<svg class="gene-indicator-svg" style="width: ${lineWidth}px; height: ${barHeight}px; margin-left: 0;">`;

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

    // Apply height correction to barHeight
    const heightCorrection = (settings.heightCorrection || 100) / 100;
    const correctedBarHeight = barHeight * heightCorrection;

    let indicator = '';

    // Gene body shape with corrected height
    indicator += this.createGeneBodyShape(
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
        indicator += `<line x1="${startX}" y1="${markerOffset}" x2="${startX}" y2="${markerOffset + markerHeight}" 
                                   stroke="${this.darkenHexColor(geneColor, 30)}" stroke-width="${markerWidth}" opacity="0.9"
                                   ${settings.showTooltips !== false ? `title="Gene start: ${gene.qualifiers?.gene || gene.type}"` : ''}/>`;
      }

      // End marker (arrow) - only if gene actually ends in this line and enabled
      if (settings.showEndArrows !== false && geneEnd1Based >= lineStart1Based && geneEnd1Based <= lineEnd1Based) {
        indicator += this.createGeneEndArrow(endX, correctedBarHeight, geneColor, isForward, gene, settings);
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
        indicator += `<line x1="${endX}" y1="${markerOffset}" x2="${endX}" y2="${markerOffset + markerHeight}" 
                                   stroke="${this.darkenHexColor(geneColor, 30)}" stroke-width="${markerWidth}" opacity="0.9"
                                   ${settings.showTooltips !== false ? `title="Gene start: ${gene.qualifiers?.gene || gene.type}"` : ''}/>`;
      }

      // End marker (arrow) - for reverse genes, show arrow at the FIRST line where gene appears (gene start position)
      if (settings.showEndArrows !== false && geneStart1Based >= lineStart1Based && geneStart1Based <= lineEnd1Based) {
        // For reverse genes, the transcription arrow should be at the LEFT end (first appearance in sequence display)
        indicator += this.createGeneEndArrow(startX, correctedBarHeight, geneColor, isForward, gene, settings);
      }
    }

    return indicator;
  }

  /**
   * Create gene body shape based on gene type
   */
  createGeneBodyShape(gene, x, width, height, color, geneType, settings = {}) {
    const isForward = gene.strand !== -1;
    const opacity = settings.indicatorOpacity || 0.7;
    const tooltipAttr = settings.showTooltips !== false ? `title="${gene.qualifiers?.gene || gene.type}"` : '';
    const hoverClass = settings.showHoverEffects !== false ? 'gene-indicator-hover' : '';

    let shape = '';

    if (geneType === 'promoter') {
      // Simple arrow for promoter
      if (isForward) {
        shape = `<path d="M ${x} 3 L ${x + width - 6} 3 L ${x + width} ${height / 2} L ${x + width - 6} ${height - 3} L ${x} ${height - 3} Z" 
                               fill="${color}" opacity="${opacity}" ${tooltipAttr} class="${hoverClass}"/>`;
      } else {
        shape = `<path d="M ${x + 6} 3 L ${x + width} 3 L ${x + width} ${height - 3} L ${x + 6} ${height - 3} L ${x} ${height / 2} Z" 
                               fill="${color}" opacity="${opacity}" ${tooltipAttr} class="${hoverClass}"/>`;
      }
    } else if (geneType === 'terminator') {
      // Rectangle with rounded ends for terminator
      shape = `<rect x="${x}" y="3" width="${width}" height="${height - 6}" rx="3" ry="3" 
                           fill="${color}" opacity="${opacity}" ${tooltipAttr} class="${hoverClass}"/>`;
    } else if (['trna', 'rrna', 'mrna'].includes(geneType)) {
      // Wavy shape for RNA
      const waveHeight = 2;
      shape = `<path d="M ${x} ${3 + waveHeight} 
                            Q ${x + width / 4} 3 ${x + width / 2} ${3 + waveHeight / 2}
                            Q ${x + (3 * width) / 4} 3 ${x + width} ${3 + waveHeight}
                            L ${x + width} ${height - 3}
                            L ${x} ${height - 3} Z" 
                            fill="${color}" opacity="${opacity}" ${tooltipAttr} class="${hoverClass}"/>`;
    } else {
      // Default rectangle for CDS and others
      shape = `<rect x="${x}" y="3" width="${width}" height="${height - 6}" 
                           fill="${color}" opacity="${opacity}" ${tooltipAttr} class="${hoverClass}"/>`;
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
    const tooltipAttr =
      settings.showTooltips !== false
        ? `title="Gene end (${gene.qualifiers?.gene || gene.type}) ${isForward ? '→' : '←'}"`
        : '';
    const hoverClass = settings.showHoverEffects !== false ? 'gene-indicator-hover' : '';

    let arrow = '';

    const arrowTop = arrowOffset;
    const arrowMiddle = height / 2;
    const arrowBottom = arrowOffset + arrowHeight;

    if (isForward) {
      // Right-pointing arrow
      arrow = `<path d="M ${x - arrowSize} ${arrowTop} L ${x} ${arrowMiddle} L ${x - arrowSize} ${arrowBottom} Z" 
                           fill="${darkColor}" opacity="1" ${tooltipAttr} class="${hoverClass}"/>`;
    } else {
      // Left-pointing arrow
      arrow = `<path d="M ${x + arrowSize} ${arrowTop} L ${x} ${arrowMiddle} L ${x + arrowSize} ${arrowBottom} Z" 
                           fill="${darkColor}" opacity="1" ${tooltipAttr} class="${hoverClass}"/>`;
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
      indicatorHeight: 8,
      indicatorOpacity: 0.7,
      showStartMarkers: true,
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
      A: '#FF6B6B', // Red
      T: '#4ECDC4', // Teal
      G: '#45B7D1', // Blue
      C: '#96CEB4', // Green
      N: '#95A5A6', // Gray for unknown
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

  /**
   * Save current text selection state for virtual scrolling
   */
  saveSelectionState() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return null;
    }

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;

    // Find the sequence container - handle both element and text nodes
    let sequenceContainer;
    if (container.nodeType === Node.ELEMENT_NODE) {
      sequenceContainer = container.closest('.detailed-sequence-view');
    } else {
      // If it's a text node, check its parent element
      sequenceContainer = container.parentElement?.closest('.detailed-sequence-view');
    }
    if (!sequenceContainer) {
      return null;
    }

    const startNode = range.startContainer;
    const endNode = range.endContainer;

    // Get genomic positions if possible
    let startPos = null;
    let endPos = null;

    // Try to extract genomic position from sequence spans - improved method
    startPos = this.extractGenomicPositionFromNode(startNode, range.startOffset);
    endPos = this.extractGenomicPositionFromNode(endNode, range.endOffset);

    // Fallback: try to find position from line context
    if (startPos === null || endPos === null) {
      const startLineElement =
        startNode.nodeType === Node.TEXT_NODE
          ? startNode.parentElement?.closest('.sequence-line-group')
          : startNode.closest?.('.sequence-line-group');
      const endLineElement =
        endNode.nodeType === Node.TEXT_NODE
          ? endNode.parentElement?.closest('.sequence-line-group')
          : endNode.closest?.('.sequence-line-group');

      if (startLineElement && startPos === null) {
        startPos = this.extractPositionFromLineElement(startLineElement, startNode, range.startOffset);
      }
      if (endLineElement && endPos === null) {
        endPos = this.extractPositionFromLineElement(endLineElement, endNode, range.endOffset);
      }
    }

    return {
      startPos,
      endPos,
      startOffset: range.startOffset,
      endOffset: range.endOffset,
      startContainer: startNode,
      endContainer: endNode,
      collapsed: range.collapsed,
      timestamp: Date.now(),
    };
  }

  /**
   * Extract genomic position from a DOM node
   */
  extractGenomicPositionFromNode(node, offset) {
    if (node.nodeType === Node.TEXT_NODE && node.parentElement) {
      const span =
        node.parentElement.closest('.sequence-bases span[data-position]') ||
        node.parentElement.closest('.sequence-bases span');
      if (span?.dataset?.position !== undefined) {
        const position = parseInt(span.dataset.position, 10);
        return Number.isNaN(position) ? null : position + offset;
      }

      if (span && span.onclick) {
        const match = span.onclick.toString().match(/handleSequenceClick\(event,\s*(\d+)\)/);
        if (match) {
          return parseInt(match[1]) + offset;
        }
      }
    }
    return null;
  }

  /**
   * Extract position from line element context
   */
  extractPositionFromLineElement(lineElement, node, offset) {
    // Find the position span within the line
    const positionSpan = lineElement.querySelector('.sequence-position');
    if (!positionSpan) return null;

    let lineStartPos;
    const lineStartDataset = positionSpan.dataset?.displayStart;
    if (lineStartDataset !== undefined) {
      lineStartPos = parseInt(lineStartDataset, 10);
    } else {
      // Extract the line start position from the position span
      const positionText = positionSpan.textContent;
      const lineStartMatch = positionText.match(/^(\d+)/);
      if (!lineStartMatch) return null;

      lineStartPos = parseInt(lineStartMatch[1], 10) - 1; // Convert to 0-based
    }

    if (Number.isNaN(lineStartPos)) return null;

    // Calculate character offset within the line
    const sequenceBases = lineElement.querySelector('.sequence-bases');
    if (!sequenceBases) return null;

    // Walk through text nodes to find offset
    let charOffset = 0;
    const walker = document.createTreeWalker(sequenceBases, NodeFilter.SHOW_TEXT, null, false);

    let currentNode;
    while ((currentNode = walker.nextNode())) {
      if (currentNode === node) {
        return this.displayToSourcePosition(lineStartPos + charOffset + offset, this.genomeBrowser.currentChromosome);
      }
      charOffset += currentNode.textContent.length;
    }

    return this.displayToSourcePosition(lineStartPos + charOffset, this.genomeBrowser.currentChromosome);
  }

  /**
   * Find DOM node and offset for a given genomic position
   */
  findNodeAtGenomicPosition(genomicPosition, sequenceContainer) {
    if (!sequenceContainer) return null;

    const directSpan = sequenceContainer.querySelector(`.sequence-bases span[data-position="${genomicPosition}"]`);
    const directTextNode = directSpan
      ? document.createTreeWalker(directSpan, NodeFilter.SHOW_TEXT, null, false).nextNode()
      : null;
    if (directTextNode) {
      return {
        node: directTextNode,
        offset: 0,
      };
    }

    // Find all sequence lines
    const sequenceLines = sequenceContainer.querySelectorAll('.sequence-line-group');

    for (const lineElement of sequenceLines) {
      // Get the position span to find the line start position
      const positionSpan = lineElement.querySelector('.sequence-position');
      if (!positionSpan) continue;

      let lineStartPos;
      const lineStartDataset = positionSpan.dataset?.displayStart;
      if (lineStartDataset !== undefined) {
        lineStartPos = parseInt(lineStartDataset, 10);
      } else {
        // Extract the line start position
        const positionText = positionSpan.textContent;
        const lineStartMatch = positionText.match(/^(\d+)/);
        if (!lineStartMatch) continue;

        lineStartPos = parseInt(lineStartMatch[1], 10) - 1; // Convert to 0-based
      }

      if (Number.isNaN(lineStartPos)) continue;

      // Get the sequence bases container
      const sequenceBases = lineElement.querySelector('.sequence-bases');
      if (!sequenceBases) continue;

      // Calculate the total length of this line
      let lineLength = 0;
      const walker = document.createTreeWalker(sequenceBases, NodeFilter.SHOW_TEXT, null, false);

      let node;
      while ((node = walker.nextNode())) {
        lineLength += node.textContent.length;
      }

      const lineEndPos = lineStartPos + lineLength;

      // Check if our genomic position falls within this line
      if (genomicPosition >= lineStartPos && genomicPosition < lineEndPos) {
        // Find the exact node and offset within this line
        const targetOffset = genomicPosition - lineStartPos;
        let currentOffset = 0;

        // Walk through text nodes again to find the exact position
        const nodeWalker = document.createTreeWalker(sequenceBases, NodeFilter.SHOW_TEXT, null, false);

        let textNode;
        while ((textNode = nodeWalker.nextNode())) {
          const nodeLength = textNode.textContent.length;

          if (currentOffset + nodeLength >= targetOffset) {
            // Found the node containing our position
            const offsetInNode = targetOffset - currentOffset;
            return {
              node: textNode,
              offset: offsetInNode,
            };
          }

          currentOffset += nodeLength;
        }
      }
    }

    return null;
  }

  /**
   * Restore manual text selection visual highlighting after sequence re-render
   */
  restoreManualSelection(selectionInfo) {
    if (!selectionInfo || !selectionInfo.active) {
      console.log('🔧 [SequenceUtils] No active manual selection to restore');
      return;
    }

    console.log('🔧 [SequenceUtils] Restoring manual selection highlighting:', selectionInfo);

    const sequenceContainer = document.getElementById('sequenceContent');
    if (!sequenceContainer) {
      console.warn('🔧 [SequenceUtils] Sequence container not found for manual selection restore');
      return;
    }

    // Find the DOM nodes for the selection range
    const startResult = this.findNodeAtGenomicPosition(selectionInfo.start, sequenceContainer);
    const endResult = this.findNodeAtGenomicPosition(selectionInfo.end, sequenceContainer);

    if (!startResult || !endResult) {
      console.warn('🔧 [SequenceUtils] Could not find DOM nodes for manual selection restore:', {
        startPos: selectionInfo.start,
        endPos: selectionInfo.end,
        startResult: !!startResult,
        endResult: !!endResult,
      });
      return;
    }

    // Create and apply the selection
    const selection = window.getSelection();
    const range = document.createRange();

    try {
      // Set range with calculated positions
      range.setStart(startResult.node, startResult.offset);
      range.setEnd(endResult.node, endResult.offset);

      // Apply selection
      selection.removeAllRanges();
      selection.addRange(range);

      console.log('✅ [SequenceUtils] Manual selection highlighting restored successfully');
    } catch (error) {
      console.warn('🔧 [SequenceUtils] Error restoring manual selection highlighting:', error);
    }
  }

  /**
   * Restore text selection state after virtual scrolling
   */
  restoreSelectionState(savedSelection) {
    if (!savedSelection || savedSelection.startPos === null || savedSelection.endPos === null) {
      console.log('🔧 [SequenceUtils] No valid selection to restore');
      return;
    }

    // Find the sequence container
    const sequenceContainer = document.querySelector('.detailed-sequence-view');
    if (!sequenceContainer) {
      console.warn('🔧 [SequenceUtils] Sequence container not found');
      return;
    }

    // Use improved position finding
    const startResult = this.findNodeAtGenomicPosition(savedSelection.startPos, sequenceContainer);
    const endResult = this.findNodeAtGenomicPosition(savedSelection.endPos, sequenceContainer);

    if (!startResult || !endResult) {
      console.warn('🔧 [SequenceUtils] Could not find nodes for positions:', {
        startPos: savedSelection.startPos,
        endPos: savedSelection.endPos,
        startResult: !!startResult,
        endResult: !!endResult,
      });
      return;
    }

    // Create new selection
    const selection = window.getSelection();
    const range = document.createRange();

    try {
      // Set range with calculated offsets
      range.setStart(startResult.node, startResult.offset);
      range.setEnd(endResult.node, endResult.offset);

      // Apply selection
      selection.removeAllRanges();
      selection.addRange(range);

      // Update genome browser selection state if it exists
      if (window.genomeBrowser && window.genomeBrowser.currentSequenceSelection) {
        window.genomeBrowser.currentSequenceSelection = {
          start: savedSelection.startPos,
          end: savedSelection.endPos,
          active: true,
          length: savedSelection.endPos - savedSelection.startPos + 1,
        };
      }

      console.log(
        `🔧 [SequenceUtils] Selection restored: ${savedSelection.startPos}-${savedSelection.endPos} (${savedSelection.endPos - savedSelection.startPos + 1} bp)`
      );
    } catch (error) {
      console.warn('🔧 [SequenceUtils] Failed to restore selection:', error);
    }
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
