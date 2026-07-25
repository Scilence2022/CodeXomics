/**
 * NavigationManager - Handles navigation, search, zoom, and position management
 */
class NavigationManager {
  constructor(genomeBrowser) {
    this.genomeBrowser = genomeBrowser;
    this.searchResults = [];
    this.currentSearchIndex = 0;
    this.searchResultsOriginalPosition = null; // Store original position for restoration

    // Centralized drag state
    this.dragState = {
      isDragging: false,
      hasDragged: false,
      element: null,
      chromosome: null,
      startX: 0,
      startPosition: 0,
      lastUpdateX: 0,
      cumulativeVisualDeltaX: 0,
      lastCalculatedStart: 0, // Store the last calculated position
      // Effective track width (px-per-base reference) captured once at drag
      // start. Reused for every move and for the final commit so the live
      // visual offset and the rendered position share one conversion factor.
      elementWidth: 0,
      dynamicUpdate: false, // Whether tracks re-render live during this drag (per global/per-track setting)
      canvasTransformsApplied: false, // Track if Canvas transforms were applied during this drag
    };

    // Throttle for full/sequence re-renders performed *during* a drag when the
    // real-time update options are enabled (defaults keep these off).
    this.dragRenderThrottle = {
      lastViewRenderTime: 0,
      lastSequenceRenderTime: 0,
      intervalMs: 80, // ~12fps cap for the heavy in-drag re-renders
    };

    // Ruler update throttling
    this.rulerUpdateThrottle = {
      lastUpdateTime: 0,
      updateInterval: 16, // 60fps (1000ms/60 ≈ 16ms)
      pendingUpdate: false,
    };

    // Global dragging setting - when enabled, all tracks update during drag
    this.globalDraggingEnabled = false;

    // Drag update behavior (both default OFF for best performance):
    //  - dragUpdateGeneFeatures: re-render genome tracks live during a drag so
    //    gene features fill in instead of leaving blank space on the trailing
    //    edge (otherwise only a lightweight CSS transform is applied).
    //  - dragRealtimeSequenceUpdate: re-render the bottom sequence panel live
    //    during a drag (otherwise it updates once, when the drag ends).
    this.dragUpdateGeneFeatures = false;
    this.dragRealtimeSequenceUpdate = false;

    // Circular browsing mode - when enabled, navigation wraps around sequence boundaries
    this.circularMode = false;

    // Wheel zoom configuration
    this.wheelZoomConfig = {
      enabled: true,
      sensitivity: 0.1, // Zoom factor per wheel step
      minRange: 100, // Minimum range in base pairs
      maxRange: 1000000, // Maximum range in base pairs
      smoothZoom: true, // Enable smooth zooming
      zoomToCursor: true, // DEPRECATED: Zoom towards cursor position (cursor system scheduled for removal)
    };

    // Initialize wheel zoom settings from GeneralSettingsManager
    this.initializeWheelZoomSettings();

    // Initialize aligned reads redraw timeout
    this.alignedReadsRedrawTimeout = null;

    // Wheel-zoom render coalescing: at most one commit per animation frame
    this.wheelZoomFrameHandle = null;
    this.pendingWheelZoom = null;

    // Bind methods and add global listeners once
    this.handleDocumentMouseMove = this.handleDocumentMouseMove.bind(this);
    this.handleDocumentMouseUp = this.handleDocumentMouseUp.bind(this);
    this.handleWheelZoom = this.handleWheelZoom.bind(this);
    document.addEventListener('mousemove', this.handleDocumentMouseMove);
    document.addEventListener('mouseup', this.handleDocumentMouseUp);
    document.addEventListener('wheel', this.handleWheelZoom, { passive: false });
  }

  // Navigation methods
  navigatePrevious() {
    const range = this.genomeBrowser.currentPosition.end - this.genomeBrowser.currentPosition.start;
    const newStart = Math.max(0, this.genomeBrowser.currentPosition.start - range);
    const newEnd = newStart + range;

    this.genomeBrowser.currentPosition = { start: newStart, end: newEnd };

    const currentChr = document.getElementById('chromosomeSelect').value;
    if (currentChr && this.genomeBrowser.currentSequence && this.genomeBrowser.currentSequence[currentChr]) {
      this.genomeBrowser.updateStatistics(currentChr, this.genomeBrowser.currentSequence[currentChr]);
      this.genomeBrowser.displayGenomeView(currentChr, this.genomeBrowser.currentSequence[currentChr]);
      // Update navigation bar
      this.genomeBrowser.genomeNavigationBar.update();

      // Update current tab title with new position (from navigation buttons)
      if (this.genomeBrowser.tabManager) {
        this.genomeBrowser.tabManager.updateCurrentTabPosition(currentChr, newStart + 1, newEnd, {
          source: 'navigation',
        });
      }
    }
  }

  navigateNext() {
    const currentChr = document.getElementById('chromosomeSelect').value;
    if (!currentChr || !this.genomeBrowser.currentSequence || !this.genomeBrowser.currentSequence[currentChr]) return;

    const sequence = this.genomeBrowser.currentSequence[currentChr];
    const range = this.genomeBrowser.currentPosition.end - this.genomeBrowser.currentPosition.start;
    const newStart = this.genomeBrowser.currentPosition.start + range;
    const newEnd = Math.min(sequence.length, newStart + range);

    if (newStart < sequence.length) {
      this.genomeBrowser.currentPosition = { start: newStart, end: newEnd };
      this.genomeBrowser.updateStatistics(currentChr, sequence);
      this.genomeBrowser.displayGenomeView(currentChr, sequence);
      // Update navigation bar
      this.genomeBrowser.genomeNavigationBar.update();

      // Update current tab title with new position (from navigation buttons)
      if (this.genomeBrowser.tabManager) {
        this.genomeBrowser.tabManager.updateCurrentTabPosition(currentChr, newStart + 1, newEnd, {
          source: 'navigation',
        });
      }
    }
  }

  // Zoom methods
  zoomIn(factor = 2) {
    const safeFactor = this.parseZoomFactor(factor);
    const currentChr = document.getElementById('chromosomeSelect').value;
    if (!currentChr || !this.genomeBrowser.currentSequence || !this.genomeBrowser.currentSequence[currentChr]) {
      return { success: false, error: 'No active chromosome or sequence loaded' };
    }

    const sequence = this.genomeBrowser.currentSequence[currentChr];
    const currentRange = this.genomeBrowser.currentPosition.end - this.genomeBrowser.currentPosition.start;
    const newRange = Math.max(100, Math.floor(currentRange / safeFactor));
    const center = Math.floor((this.genomeBrowser.currentPosition.start + this.genomeBrowser.currentPosition.end) / 2);
    const newStart = Math.max(0, center - Math.floor(newRange / 2));
    const newEnd = newStart + newRange;

    this.genomeBrowser.currentPosition = { start: newStart, end: newEnd };
    this.genomeBrowser.updateStatistics(currentChr, sequence);
    this.genomeBrowser.displayGenomeView(currentChr, sequence);
    this.genomeBrowser.genomeNavigationBar.update();

    if (this.genomeBrowser.tabManager) {
      this.genomeBrowser.tabManager.updateCurrentTabPosition(currentChr, newStart + 1, newEnd, { source: 'zoom' });
    }

    return { success: true, factor: safeFactor, newRange, position: { start: newStart, end: newEnd } };
  }

  zoomOut(factor = 2) {
    const safeFactor = this.parseZoomFactor(factor);
    const currentChr = document.getElementById('chromosomeSelect').value;
    if (!currentChr || !this.genomeBrowser.currentSequence || !this.genomeBrowser.currentSequence[currentChr]) {
      return { success: false, error: 'No active chromosome or sequence loaded' };
    }

    const sequence = this.genomeBrowser.currentSequence[currentChr];
    const currentRange = this.genomeBrowser.currentPosition.end - this.genomeBrowser.currentPosition.start;
    const newRange = Math.min(sequence.length, Math.floor(currentRange * safeFactor));
    const center = Math.floor((this.genomeBrowser.currentPosition.start + this.genomeBrowser.currentPosition.end) / 2);
    const newStart = Math.max(0, center - Math.floor(newRange / 2));
    const newEnd = Math.min(sequence.length, newStart + newRange);

    this.genomeBrowser.currentPosition = { start: newStart, end: newEnd };
    this.genomeBrowser.updateStatistics(currentChr, sequence);
    this.genomeBrowser.displayGenomeView(currentChr, sequence);
    this.genomeBrowser.genomeNavigationBar.update();

    if (this.genomeBrowser.tabManager) {
      this.genomeBrowser.tabManager.updateCurrentTabPosition(currentChr, newStart + 1, newEnd, { source: 'zoom' });
    }

    return { success: true, factor: safeFactor, newRange, position: { start: newStart, end: newEnd } };
  }

  parseZoomFactor(value) {
    let factor = 2;
    if (typeof value === 'number' && isFinite(value) && value > 0) {
      factor = value;
    } else if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase().replace(/×/g, 'x');
      const stripped = normalized.endsWith('x') ? normalized.slice(0, -1) : normalized;
      const numeric = parseFloat(stripped);
      if (isFinite(numeric) && numeric > 0) {
        factor = numeric;
      }
    } else if (typeof value === 'object' && value !== null) {
      const extracted = value.factor ?? value.zoomFactor ?? value.zoom;
      if (typeof extracted === 'number' && isFinite(extracted) && extracted > 0) {
        factor = extracted;
      } else if (typeof extracted === 'string') {
        return this.parseZoomFactor(extracted);
      }
    }
    return Math.min(factor, 10);
  }

  getCurrentRegion() {
    const currentChr = document.getElementById('chromosomeSelect').value;
    return {
      chromosome: currentChr || this.genomeBrowser.currentChromosome,
      start: this.genomeBrowser.currentPosition.start,
      end: this.genomeBrowser.currentPosition.end,
      length: this.genomeBrowser.currentPosition.end - this.genomeBrowser.currentPosition.start,
    };
  }

  navigateToPosition(chromosome, start, end) {
    const gb = this.genomeBrowser;
    const currentChr = document.getElementById('chromosomeSelect').value;

    if (currentChr !== chromosome) {
      if (typeof gb.selectChromosome === 'function') {
        gb.selectChromosome(chromosome);
      } else {
        const chrSelect = document.getElementById('chromosomeSelect');
        if (chrSelect) chrSelect.value = chromosome;
      }
    }

    const sequence = gb.currentSequence && gb.currentSequence[chromosome];
    if (!sequence) {
      return { success: false, error: `Chromosome ${chromosome} not found in loaded genome data` };
    }

    const validatedStart = Math.max(0, start - 1);
    const validatedEnd = Math.min(sequence.length, end);

    if (validatedStart >= validatedEnd) {
      return { success: false, error: `Invalid position range: ${start}-${end}` };
    }

    gb.currentPosition = { start: validatedStart, end: validatedEnd };
    gb.currentChromosome = chromosome;
    gb.updateStatistics(chromosome, sequence);
    gb.displayGenomeView(chromosome, sequence);

    if (gb.genomeNavigationBar) gb.genomeNavigationBar.update();
    if (gb.tabManager) {
      gb.tabManager.updateCurrentTabPosition(chromosome, validatedStart + 1, validatedEnd, { source: 'navigation' });
    }

    return { success: true, chromosome, start: validatedStart, end: validatedEnd };
  }

  jumpToGene(geneName) {
    const searchFn =
      (window.MicrobeGenomicsFunctions && window.MicrobeGenomicsFunctions.searchGeneByName) ||
      this.genomeBrowser.searchGeneByName;
    if (typeof searchFn !== 'function') {
      return { success: false, error: 'Gene search function not available' };
    }
    const gene = searchFn(geneName);
    if (!gene) {
      return { success: false, error: `Gene "${geneName}" not found`, geneName };
    }
    const navResult = this.navigateToPosition(gene.chromosome, gene.feature.start, gene.feature.end);
    return { ...navResult, gene };
  }

  scrollLeft(bp = 1000) {
    const region = this.getCurrentRegion();
    const newStart = Math.max(0, region.start - bp);
    const shift = region.start - newStart;
    const newEnd = region.end - shift;
    return this.navigateToPosition(region.chromosome, newStart + 1, newEnd);
  }

  scrollRight(bp = 1000) {
    const region = this.getCurrentRegion();
    const sequence = this.genomeBrowser.currentSequence && this.genomeBrowser.currentSequence[region.chromosome];
    const maxEnd = sequence ? sequence.length : Infinity;
    const newEnd = Math.min(maxEnd, region.end + bp);
    const shift = newEnd - region.end;
    const newStart = region.start + shift;
    return this.navigateToPosition(region.chromosome, newStart + 1, newEnd);
  }

  resetZoom() {
    const currentChr = document.getElementById('chromosomeSelect').value;
    if (!currentChr || !this.genomeBrowser.currentSequence || !this.genomeBrowser.currentSequence[currentChr]) return;

    const sequence = this.genomeBrowser.currentSequence[currentChr];
    this.genomeBrowser.currentPosition = { start: 0, end: Math.min(10000, sequence.length) };
    this.genomeBrowser.updateStatistics(currentChr, sequence);
    this.genomeBrowser.displayGenomeView(currentChr, sequence);
    // Update navigation bar
    this.genomeBrowser.genomeNavigationBar.update();
  }

  /**
   * Handle mouse wheel zoom functionality
   */
  handleWheelZoom(e) {
    // Check if wheel zoom is enabled
    if (!this.wheelZoomConfig.enabled) return;

    // Only handle wheel events on genome browser areas
    const genomeBrowserElement = e.target.closest(
      '.genome-browser, .sequence-track, .gene-track, .gc-track, .reads-track, .tracks-container'
    );
    if (!genomeBrowserElement) return;

    // Check if the event target is within a scrollable reads container
    const scrollableReadsContainer = e.target.closest('.reads-scroll-container');
    if (scrollableReadsContainer) {
      // Let the reads track handle its own scrolling unless modifier keys are pressed
      if (!e.ctrlKey && !e.metaKey) {
        console.log('🔍 [NavigationManager] Event in scrollable reads container, delegating to TrackRenderer');
        return; // Don't handle zoom, let TrackRenderer handle scrolling
      }
      console.log('🔍 [NavigationManager] Modifier key pressed in reads container, handling zoom');
    }

    // Prevent default scrolling behavior
    e.preventDefault();

    const currentChr = document.getElementById('chromosomeSelect').value;
    if (!currentChr || !this.genomeBrowser.currentSequence || !this.genomeBrowser.currentSequence[currentChr]) {
      return;
    }

    const sequence = this.genomeBrowser.currentSequence[currentChr];
    const currentRange = this.genomeBrowser.currentPosition.end - this.genomeBrowser.currentPosition.start;

    // Determine zoom direction and factor
    const zoomDirection = Math.sign(e.deltaY); // Positive = zoom out, negative = zoom in

    // Check if cursor is over genes track and if it has custom zoom sensitivity
    let sensitivity = this.wheelZoomConfig.sensitivity;
    const genesTrackElement = e.target.closest('.gene-track');
    if (genesTrackElement && this.genomeBrowser.trackRenderer) {
      const genesSettings = this.genomeBrowser.trackRenderer.getTrackSettings('genes');
      if (genesSettings.overrideGlobalZoom && genesSettings.wheelZoomSensitivity !== undefined) {
        sensitivity = genesSettings.wheelZoomSensitivity;
        console.log('🎯 Using genes track custom zoom sensitivity:', sensitivity);
      }
    }

    const zoomFactor = 1 + sensitivity * Math.abs(e.deltaY / 100);

    let newRange;
    if (zoomDirection > 0) {
      // Zoom out
      newRange = Math.min(this.wheelZoomConfig.maxRange, Math.min(sequence.length, currentRange * zoomFactor));
    } else {
      // Zoom in
      newRange = Math.max(this.wheelZoomConfig.minRange, currentRange / zoomFactor);
    }

    // If range hasn't changed significantly, skip update
    if (Math.abs(newRange - currentRange) < 1) return;

    let newStart;
    let newEnd;

    if (this.wheelZoomConfig.zoomToCursor) {
      // Calculate cursor position within the genome browser
      const browserRect = genomeBrowserElement.getBoundingClientRect();
      const relativeX = e.clientX - browserRect.left;
      const cursorRatio = relativeX / browserRect.width;

      // Calculate focal point in genomic coordinates
      const focalPoint = this.genomeBrowser.currentPosition.start + currentRange * cursorRatio;

      // Calculate new range around focal point
      const beforeFocal = newRange * cursorRatio;
      const afterFocal = newRange - beforeFocal;

      newStart = Math.max(0, Math.round(focalPoint - beforeFocal));
      newEnd = Math.min(sequence.length, Math.round(focalPoint + afterFocal));

      // Adjust if we hit boundaries
      if (newStart === 0) {
        newEnd = Math.min(sequence.length, newRange);
      } else if (newEnd === sequence.length) {
        newStart = Math.max(0, sequence.length - newRange);
      }
    } else {
      // Zoom to center
      const center = Math.floor(
        (this.genomeBrowser.currentPosition.start + this.genomeBrowser.currentPosition.end) / 2
      );
      newStart = Math.max(0, Math.round(center - newRange / 2));
      newEnd = Math.min(sequence.length, newStart + newRange);

      // Adjust if we hit boundaries
      if (newEnd === sequence.length) {
        newStart = Math.max(0, sequence.length - newRange);
      }
    }

    // Update position synchronously so rapid wheel events compound correctly
    // even though the render below is coalesced.
    this.genomeBrowser.currentPosition = { start: Math.round(newStart), end: Math.round(newEnd) };

    // A trackpad emits wheel events far faster than the display refreshes.
    // Committing the render per event stacked several full track rebuilds into
    // a single frame; coalescing collapses them to one commit per frame.
    this.scheduleWheelZoomCommit({ currentChr, sequence, zoomDirection });

    // Guarded explicitly: the four toLocaleString() calls below are *arguments*,
    // so they would still run on every wheel event even when console.log is a
    // no-op. Only build them when verbose logging is actually on.
    if (window.CodeXomicsDebug?.isEnabled?.()) {
      console.log('🔍 [WHEEL-ZOOM]', {
        direction: zoomDirection > 0 ? 'out' : 'in',
        oldRange: currentRange.toLocaleString(),
        newRange: Math.round(newEnd - newStart).toLocaleString(),
        position: `${newStart.toLocaleString()}-${newEnd.toLocaleString()}`,
        zoomToCursor: this.wheelZoomConfig.zoomToCursor,
      });
    }
  }

  /**
   * Coalesce wheel-zoom rendering into a single requestAnimationFrame.
   *
   * Only the latest pending state is kept: intermediate frames within the same
   * tick are superseded, since `currentPosition` has already been advanced by
   * every wheel event that arrived.
   */
  scheduleWheelZoomCommit(pending) {
    this.pendingWheelZoom = pending;
    if (this.wheelZoomFrameHandle !== null && this.wheelZoomFrameHandle !== undefined) return;

    const schedule =
      typeof requestAnimationFrame === 'function' ? requestAnimationFrame : callback => setTimeout(callback, 16);

    this.wheelZoomFrameHandle = schedule(() => {
      this.wheelZoomFrameHandle = null;
      const state = this.pendingWheelZoom;
      this.pendingWheelZoom = null;
      if (state) this.commitWheelZoom(state);
    });
  }

  /** Apply the visible effects of a wheel zoom. Runs at most once per frame. */
  commitWheelZoom({ currentChr, sequence, zoomDirection }) {
    const { start, end } = this.genomeBrowser.currentPosition;

    this.genomeBrowser.updateStatistics(currentChr, sequence);

    // Handle aligned reads track differently - use delayed redraw
    this.handleAlignedReadsZoom(currentChr, sequence);

    // Update navigation bar
    if (this.genomeBrowser.genomeNavigationBar) {
      this.genomeBrowser.genomeNavigationBar.update();
    }

    // Update current tab title with new position (from wheel zoom)
    if (this.genomeBrowser.tabManager) {
      this.genomeBrowser.tabManager.updateCurrentTabPosition(currentChr, start + 1, end, { source: 'zoom' });
    }

    // Show visual feedback
    this.showWheelZoomFeedback(zoomDirection, Math.round(end - start));
  }

  /**
   * Handle aligned reads track zoom with delayed redraw
   */
  handleAlignedReadsZoom(currentChr, sequence) {
    // Clear any existing timeout for aligned reads redraw
    if (this.alignedReadsRedrawTimeout) {
      clearTimeout(this.alignedReadsRedrawTimeout);
    }

    // Check if aligned reads track exists and is visible
    const readsTrack = document.querySelector('.reads-track');
    const hasAlignedReads = readsTrack && readsTrack.offsetParent !== null;

    if (hasAlignedReads) {
      // For aligned reads track: update other tracks immediately, but delay reads redraw
      console.log('🔍 [WHEEL-ZOOM] Aligned reads detected - using delayed redraw');

      // Immediately update non-reads tracks (sequence, genes, GC, etc.)
      this.updateNonReadsTracksOnly(currentChr, sequence);

      // Delay aligned reads track redraw until scrolling stops
      this.alignedReadsRedrawTimeout = setTimeout(() => {
        console.log('🔍 [WHEEL-ZOOM] Redrawing aligned reads track after zoom delay');
        this.updateAlignedReadsTrackOnly(currentChr, sequence);
      }, 300); // 300ms delay after last wheel event
    } else {
      // No aligned reads track - use normal immediate redraw
      this.genomeBrowser.displayGenomeView(currentChr, sequence);
    }
  }

  /**
   * Update only non-reads tracks for immediate zoom response
   */
  updateNonReadsTracksOnly(currentChr, sequence) {
    // Get current viewport
    const viewport = {
      start: this.genomeBrowser.currentPosition.start,
      end: this.genomeBrowser.currentPosition.end,
    };

    try {
      // Update sequence track
      const sequenceTrack = document.querySelector('.sequence-track .track-content');
      if (sequenceTrack) {
        const sequenceElement = this.genomeBrowser.trackRenderer.createSequenceLineTrack(currentChr, sequence);
        if (sequenceElement) {
          // Extract only the track content, not the entire track with header
          const sequenceContent = sequenceElement.querySelector('.track-content');
          if (sequenceContent) {
            sequenceTrack.innerHTML = '';
            // Copy child nodes one by one to avoid spread operator issues
            while (sequenceContent.firstChild) {
              sequenceTrack.appendChild(sequenceContent.firstChild);
            }
          }
        }
      }

      // Update genes track
      const genesTrack = document.querySelector('.gene-track .track-content');
      if (genesTrack) {
        const genesElement = this.genomeBrowser.trackRenderer.createGeneTrack(currentChr);
        if (genesElement) {
          // Extract only the track content, not the entire track with header
          const genesContent = genesElement.querySelector('.track-content');
          if (genesContent) {
            genesTrack.innerHTML = '';
            // Copy child nodes one by one to avoid spread operator issues
            while (genesContent.firstChild) {
              genesTrack.appendChild(genesContent.firstChild);
            }
          }
        }
      }

      // Update primer track
      const primerTrack = document.querySelector('.primer-track .track-content');
      if (primerTrack) {
        const primerElement = this.genomeBrowser.trackRenderer.createPrimerTrack(currentChr);
        if (primerElement) {
          const primerContent = primerElement.querySelector('.track-content');
          if (primerContent) {
            primerTrack.innerHTML = '';
            while (primerContent.firstChild) {
              primerTrack.appendChild(primerContent.firstChild);
            }
          }
        }
      }

      // Update GC track
      const gcTrack = document.querySelector('.gc-track .track-content');
      if (gcTrack) {
        const gcElement = this.genomeBrowser.trackRenderer.createGCTrack(currentChr, sequence);
        if (gcElement) {
          // Extract only the track content, not the entire track with header
          const gcContent = gcElement.querySelector('.track-content');
          if (gcContent) {
            gcTrack.innerHTML = '';
            // Copy child nodes one by one to avoid spread operator issues
            while (gcContent.firstChild) {
              gcTrack.appendChild(gcContent.firstChild);
            }
          }
        }
      }

      // Update variant tracks
      const variantTracks = document.querySelectorAll('.variant-track');
      variantTracks.forEach((variantTrack, index) => {
        try {
          const trackContent = variantTrack.querySelector('.track-content');
          if (!trackContent) return;

          const fileId = variantTrack.dataset.fileId;
          let newTrackContent;

          if (fileId) {
            // Multi-file mode: find the specific VCF file
            const vcfFiles = this.genomeBrowser.multiFileManager.getVcfFiles();
            const vcfFile = vcfFiles.find(f => f.metadata.id === fileId);

            if (vcfFile) {
              newTrackContent = this.genomeBrowser.trackRenderer.createVariantTrackContent(
                currentChr,
                vcfFile,
                viewport
              );
            }
          }

          if (!newTrackContent) {
            // Legacy mode or fallback
            newTrackContent = this.genomeBrowser.trackRenderer.createLegacyVariantTrackContent(currentChr, viewport);
          }

          if (newTrackContent) {
            trackContent.innerHTML = '';
            while (newTrackContent.firstChild) {
              trackContent.appendChild(newTrackContent.firstChild);
            }
            trackContent.style.height = newTrackContent.style.height || '80px';
          }
        } catch (error) {
          console.error(`🔍 [WHEEL-ZOOM] Error updating variant track ${index + 1}:`, error);
        }
      });

      console.log('🔍 [WHEEL-ZOOM] Updated non-reads tracks immediately');

      // Reposition persistent highlights for the new viewport. This partial
      // redraw path (used on wheel/trackpad zoom when a reads track is present)
      // bypasses displayGenomeView, so highlights would otherwise keep stale
      // positions until the next full render.
      this.genomeBrowser.highlightManager?.renderHighlights();
    } catch (error) {
      console.error('🔍 [WHEEL-ZOOM] Error updating non-reads tracks:', error);
      // Fallback to full redraw if partial update fails
      this.genomeBrowser.displayGenomeView(currentChr, sequence);
    }
  }

  /**
   * Update only aligned reads track after zoom delay
   */
  updateAlignedReadsTrackOnly(currentChr, sequence) {
    const viewport = {
      start: this.genomeBrowser.currentPosition.start,
      end: this.genomeBrowser.currentPosition.end,
    };

    try {
      // Find all reads tracks and update them
      const readsTracks = document.querySelectorAll('.reads-track .track-content');
      readsTracks.forEach(async (readsTrackContent, index) => {
        try {
          console.log(`🔍 [WHEEL-ZOOM] Updating reads track ${index + 1}/${readsTracks.length}`);

          // Get the parent reads track to identify which BAM file this belongs to
          const readsTrack = readsTrackContent.closest('.reads-track');
          const fileId = readsTrack?.dataset?.fileId;

          if (fileId) {
            // Find the specific BAM file
            const bamFiles = this.genomeBrowser.multiFileManager.getBamFiles();
            const bamFile = bamFiles.find(f => f.metadata.id === fileId);

            if (bamFile) {
              // Create only the track content (without header)
              const newTrackContent = await this.genomeBrowser.trackRenderer.createSingleReadsTrackContent(
                currentChr,
                bamFile,
                viewport
              );
              if (newTrackContent) {
                readsTrackContent.innerHTML = '';
                readsTrackContent.appendChild(newTrackContent);
              }
            }
          } else {
            // Fallback for tracks without fileId (legacy reads tracks)
            console.log(`🔍 [WHEEL-ZOOM] No fileId found, using legacy reads track content method`);
            const newTrackContent = await this.genomeBrowser.trackRenderer.createLegacyReadsTrackContent(
              currentChr,
              viewport
            );
            if (newTrackContent) {
              // Copy the inner content from the new track content to the existing track content
              readsTrackContent.innerHTML = '';
              while (newTrackContent.firstChild) {
                readsTrackContent.appendChild(newTrackContent.firstChild);
              }
              // Copy styles
              readsTrackContent.style.height = newTrackContent.style.height;
            }
          }
        } catch (error) {
          console.error(`🔍 [WHEEL-ZOOM] Error updating reads track ${index + 1}:`, error);
        }
      });

      console.log('🔍 [WHEEL-ZOOM] Aligned reads track redraw completed');
    } catch (error) {
      console.error('🔍 [WHEEL-ZOOM] Error updating aligned reads track:', error);
    }
  }

  /**
   * Configure wheel zoom settings
   */
  configureWheelZoom(config) {
    this.wheelZoomConfig = { ...this.wheelZoomConfig, ...config };
    console.log('🔍 [WHEEL-ZOOM] Configuration updated:', this.wheelZoomConfig);
  }

  /**
   * Enable/disable wheel zoom
   */
  setWheelZoomEnabled(enabled) {
    this.wheelZoomConfig.enabled = enabled;
    console.log(`🔍 [WHEEL-ZOOM] ${enabled ? 'Enabled' : 'Disabled'}`);
  }

  /**
   * Set circular browsing mode
   * When enabled, navigation wraps around from end to start and vice versa
   */
  setCircularMode(enabled) {
    this.circularMode = enabled;
    console.log(`🔄 [CIRCULAR-MODE] ${enabled ? 'Enabled' : 'Disabled'}`);
  }

  /**
   * Initialize wheel zoom settings from GeneralSettingsManager
   */
  initializeWheelZoomSettings() {
    // Wait for GeneralSettingsManager to be available
    setTimeout(() => {
      if (window.generalSettingsManager && window.generalSettingsManager.settings) {
        const settings = window.generalSettingsManager.settings;
        this.configureWheelZoom({
          enabled: settings.enableWheelZoom,
          sensitivity: settings.wheelZoomSensitivity,
          zoomToCursor: settings.wheelZoomToCursor,
          minRange: settings.wheelZoomMinRange,
          maxRange: settings.wheelZoomMaxRange,
        });
        console.log('🔍 [WHEEL-ZOOM] Settings initialized from GeneralSettingsManager');
      }
    }, 100);
  }

  /**
   * Show visual feedback for wheel zoom operations
   */
  showWheelZoomFeedback(direction, newRange) {
    // Create or get existing zoom indicator
    let indicator = document.getElementById('wheelZoomIndicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'wheelZoomIndicator';
      indicator.className = 'wheel-zoom-indicator';
      indicator.setAttribute('aria-live', 'polite');
      document.body.appendChild(indicator);
    }

    // Update indicator content
    const directionIcon = direction > 0 ? '🔍-' : '🔍+';
    const directionText = direction > 0 ? 'Zoom Out' : 'Zoom In';
    const directionClass = direction > 0 ? 'zoom-out' : 'zoom-in';

    indicator.innerHTML = `
            <span class="zoom-direction ${directionClass}">${directionIcon}</span>
            <span class="zoom-action">${directionText}</span>
            <span class="zoom-range">${this.formatRange(newRange)}</span>
        `;

    // Show indicator with animation
    indicator.classList.add('active', 'pulse');

    // Update genome browser cursor
    const genomeBrowser = document.querySelector('.genome-browser');
    if (genomeBrowser) {
      genomeBrowser.classList.add('wheel-zooming');
      if (direction > 0) {
        genomeBrowser.classList.add('zoom-out');
      } else {
        genomeBrowser.classList.remove('zoom-out');
      }
    }

    // Hide indicator after delay
    clearTimeout(this.zoomFeedbackTimeout);
    this.zoomFeedbackTimeout = setTimeout(() => {
      indicator.classList.remove('active', 'pulse');
      if (genomeBrowser) {
        genomeBrowser.classList.remove('wheel-zooming', 'zoom-out');
      }
    }, 1500);
  }

  /**
   * Format range for display
   */
  formatRange(range) {
    if (range >= 1000000) {
      return `${(range / 1000000).toFixed(1)}M bp`;
    } else if (range >= 1000) {
      return `${(range / 1000).toFixed(1)}K bp`;
    } else {
      return `${range} bp`;
    }
  }

  // Position navigation
  goToPosition() {
    const input = document.getElementById('positionInput').value.trim();
    this.parseAndGoToPosition(input);
  }

  performGoto() {
    const input = document.getElementById('modalPositionInput').value.trim();
    this.parseAndGoToPosition(input);
    document.getElementById('gotoModal').classList.remove('show');
  }

  parseAndGoToPosition(input) {
    if (!input) return;

    const currentChr = document.getElementById('chromosomeSelect').value;
    if (!currentChr || !this.genomeBrowser.currentSequence || !this.genomeBrowser.currentSequence[currentChr]) {
      alert('Please select a chromosome first');
      return;
    }

    const sequence = this.genomeBrowser.currentSequence[currentChr];
    let start;
    let end;

    // Parse different formats: "1000", "1000-2000", "chr1:1000-2000"
    if (input.includes(':')) {
      const [, range] = input.split(':');
      if (range.includes('-')) {
        const [s, e] = range.split('-');
        start = parseInt(s) - 1; // Convert to 0-based
        end = parseInt(e);
      } else {
        start = parseInt(range) - 1;
        end = start + 1000;
      }
    } else if (input.includes('-')) {
      const [s, e] = input.split('-');
      start = parseInt(s) - 1;
      end = parseInt(e);
    } else {
      start = parseInt(input) - 1;
      end = start + 1000;
    }

    // Validate and adjust bounds
    start = Math.max(0, start);
    end = Math.min(sequence.length, end);

    if (start >= end) {
      alert('Invalid position range');
      return;
    }

    this.genomeBrowser.currentPosition = { start, end };
    this.genomeBrowser.updateStatistics(currentChr, sequence);
    this.genomeBrowser.displayGenomeView(currentChr, sequence);
    // Update navigation bar
    this.genomeBrowser.genomeNavigationBar.update();

    // Update current tab title with new position (from position input)
    if (this.genomeBrowser.tabManager) {
      this.genomeBrowser.tabManager.updateCurrentTabPosition(currentChr, start + 1, end, { source: 'navigation' });
    }
  }

  // Search functionality
  showSearchModal() {
    const modal = document.getElementById('searchModal');
    if (modal) {
      modal.classList.add('show');
      document.getElementById('modalSearchInput').focus();
    }
  }

  showGotoModal() {
    const modal = document.getElementById('gotoModal');
    if (modal) {
      modal.classList.add('show');
      document.getElementById('modalPositionInput').focus();
    }
  }

  quickSearch() {
    const query = document.getElementById('searchInput').value.trim();
    if (query) {
      this.performSearch(query);
    }
  }

  performSearch(query = null) {
    const searchQuery = query || document.getElementById('searchInput').value.trim();
    if (!searchQuery) return;

    const currentChr = document.getElementById('chromosomeSelect').value;
    if (!currentChr || !this.genomeBrowser.currentSequence || !this.genomeBrowser.currentSequence[currentChr]) {
      alert('Please select a chromosome first');
      return;
    }

    // Get search settings
    const searchSettings = this.getCurrentSearchSettings();

    // Clear previous search results before starting new search
    this.clearSearchResults();
    this.clearSearchHighlights();

    const sequence = this.genomeBrowser.currentSequence[currentChr];
    const caseSensitive = searchSettings.caseSensitive;
    const includeReverseComplement = searchSettings.reverseComplement;

    // Prepare search query based on case sensitivity
    const searchTerm = caseSensitive ? searchQuery : searchQuery.toUpperCase();
    const sequenceToSearch = caseSensitive ? sequence : sequence.toUpperCase();

    const results = [];
    const startTime = Date.now();

    // 1. Search for gene names in annotations
    console.log('🔍 Search debug info:');
    console.log('  - searchSettings.searchGeneNames:', searchSettings.searchGeneNames);
    console.log('  - currentAnnotations exists:', !!this.genomeBrowser.currentAnnotations);
    console.log('  - currentChr:', currentChr);
    console.log('  - annotations for currentChr:', !!this.genomeBrowser.currentAnnotations?.[currentChr]);
    console.log('  - searchTerm:', searchTerm);
    console.log('  - caseSensitive:', caseSensitive);

    if (
      searchSettings.searchGeneNames &&
      this.genomeBrowser.currentAnnotations &&
      this.genomeBrowser.currentAnnotations[currentChr]
    ) {
      const annotations = this.genomeBrowser.currentAnnotations[currentChr];
      console.log('  - Total annotations to search:', annotations.length);

      // Parse search terms - support OR operator
      const searchTerms = this.parseSearchQuery(searchTerm);
      console.log('  - Parsed search terms:', searchTerms);

      let checkedCount = 0;
      annotations.forEach(annotation => {
        if (annotation.qualifiers) {
          checkedCount++;
          // Search in gene names
          const geneName = this.genomeBrowser.getQualifierValue(annotation.qualifiers, 'gene') || '';
          const locusTag = this.genomeBrowser.getQualifierValue(annotation.qualifiers, 'locus_tag') || '';
          const product = this.genomeBrowser.getQualifierValue(annotation.qualifiers, 'product') || '';
          const note = this.genomeBrowser.getQualifierValue(annotation.qualifiers, 'note') || '';

          const searchFields = [geneName, locusTag, product, note].join(' ');
          const fieldToSearch = caseSensitive ? searchFields : searchFields.toUpperCase();

          // Check if any of the search terms match
          const isMatch = searchTerms.some(term => fieldToSearch.includes(term));

          if (isMatch) {
            console.log('  - Found match:', { geneName, locusTag, product, searchFields });
            // Find which term(s) matched for highlighting
            const matchedTerms = searchTerms.filter(term => fieldToSearch.includes(term));

            // CRITICAL FIX: Create streamlined annotation without verbose note field to prevent token overflow
            const streamlinedAnnotation = {
              start: annotation.start,
              end: annotation.end,
              type: annotation.type,
              strand: annotation.strand,
              qualifiers: {
                gene: geneName,
                locus_tag: locusTag,
                product: product,
                // NOTE: Intentionally excluding 'note' field to prevent token overflow
                // as note fields can contain thousands of characters and cause LLM token limits
              },
            };

            results.push({
              type: 'gene',
              position: annotation.start,
              end: annotation.end,
              name: geneName || locusTag || annotation.type,
              details: `${annotation.type}: ${product || 'No description'}`,
              annotation: streamlinedAnnotation, // Use streamlined version instead of full annotation
              matchedTerms: matchedTerms,
            });
          }
        }
      });
      console.log('  - Checked annotations:', checkedCount);
      console.log('  - Found results:', results.length);
    } else {
      console.log('  - Gene name search skipped due to settings or missing data');
    }

    // 2. Search for exact sequence matches
    if (searchSettings.searchSequence && searchTerm.match(/^[ATGCN]+$/i)) {
      // Only search if it looks like a DNA sequence
      // Check minimum length requirement
      if (searchTerm.length >= searchSettings.minLength) {
        let index = sequenceToSearch.indexOf(searchTerm);
        while (index !== -1 && results.length < searchSettings.maxResults) {
          results.push({
            type: 'sequence',
            position: index,
            end: index + searchTerm.length,
            name: `Sequence match`,
            details: `Found "${searchQuery}" at position ${index + 1}`,
          });
          index = sequenceToSearch.indexOf(searchTerm, index + 1);
        }

        // 3. Search for reverse complement if requested
        if (includeReverseComplement && searchTerm.match(/^[ATGC]+$/i)) {
          const reverseComplement = this.getReverseComplement(searchTerm);
          const rcToSearch = caseSensitive ? reverseComplement : reverseComplement.toUpperCase();

          let rcIndex = sequenceToSearch.indexOf(rcToSearch);
          while (rcIndex !== -1 && results.length < searchSettings.maxResults) {
            results.push({
              type: 'sequence',
              position: rcIndex,
              end: rcIndex + rcToSearch.length,
              name: `Reverse complement match`,
              details: `Found reverse complement "${reverseComplement}" at position ${rcIndex + 1}`,
            });
            rcIndex = sequenceToSearch.indexOf(rcToSearch, rcIndex + 1);
          }
        }
      }
    }

    // Check for timeout
    const elapsedTime = Date.now() - startTime;
    if (elapsedTime > searchSettings.timeout * 1000) {
      this.genomeBrowser.updateStatus(`Search timed out after ${searchSettings.timeout} seconds`);
      return;
    }

    // Sort results by position
    results.sort((a, b) => a.position - b.position);

    // Store results for navigation
    this.searchResults = results;
    this.currentSearchIndex = 0;

    // Add to search history if enabled
    if (searchSettings.saveHistory) {
      const configManager = this.genomeBrowser.configManager;
      if (configManager) {
        configManager.addSearchToHistory(searchQuery, searchSettings);
      }
    }

    // Populate search results panel
    this.populateSearchResults(results, searchQuery);

    // Update tab manager with search results data
    if (this.genomeBrowser.tabManager) {
      this.genomeBrowser.tabManager.updateCurrentTabSearchResults(results);
    }

    if (results.length > 0) {
      // Navigate to first result automatically
      this.navigateToSearchResult(0);

      // Highlight all search matches in the current view if enabled
      if (searchSettings.highlightMatches) {
        this.highlightSearchMatches(results);
      }

      // Show brief success message
      const searchTerms = this.parseSearchQuery(searchQuery);
      const termInfo = searchTerms.length > 1 ? ` (${searchTerms.length} terms searched)` : '';
      this.genomeBrowser.updateStatus(
        `Found ${results.length} match${results.length > 1 ? 'es' : ''} for "${searchQuery}"${termInfo}`
      );
    } else {
      const searchTerms = this.parseSearchQuery(searchQuery);
      let searchInfo = `No matches found for "${searchQuery}"`;
      if (searchTerms.length > 1) {
        searchInfo += ` (searched for ${searchTerms.length} terms: ${searchTerms.join(', ')})`;
      }
      if (includeReverseComplement && searchQuery.match(/^[ATGC]+$/i)) {
        const rc = this.getReverseComplement(searchQuery);
        searchInfo += ` (also searched for reverse complement: "${rc}")`;
      }
      this.genomeBrowser.updateStatus(searchInfo);
    }
  }

  // Populate the search results panel
  populateSearchResults(results, searchQuery) {
    const searchResultsSection = document.getElementById('searchResultsSection');
    const searchResultsList = document.getElementById('searchResultsList');

    if (results.length === 0) {
      searchResultsList.innerHTML = '<p class="no-results">No search results</p>';
      searchResultsSection.style.display = 'none';
      // Restore original position when no results
      this.restoreSearchResultsPosition();
      return;
    }

    // Move search results panel to the top
    this.moveSearchResultsToTop();

    // Show the search results panel
    searchResultsSection.style.display = 'block';

    // Ensure sidebar is visible when showing search results
    this.genomeBrowser.uiManager.showSidebarIfHidden();

    // Update tab manager about search results panel state change
    if (this.genomeBrowser.tabManager) {
      this.genomeBrowser.tabManager.updateCurrentTabSidebarPanel(
        'searchResultsSection',
        true,
        searchResultsSection.innerHTML
      );
      // Also update search results data
      this.genomeBrowser.tabManager.updateCurrentTabSearchResults(results);
    }

    // Create header
    let html = `<div class="search-results-header">Found ${results.length} match${results.length > 1 ? 'es' : ''} for "${searchQuery}"</div>`;

    // Create result items
    results.forEach((result, index) => {
      html += `
                <div class="search-result-item" data-index="${index}">
                    <div class="search-result-header">
                        <span class="search-result-name">${result.name}</span>
                        <span class="search-result-type ${result.type}">${result.type}</span>
                    </div>
                    <div class="search-result-position">Position: ${result.position + 1}-${result.end}</div>
                    <div class="search-result-details">${result.details}</div>
                </div>
            `;
    });

    searchResultsList.innerHTML = html;

    // Add click handlers for navigation
    searchResultsList.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', e => {
        const index = parseInt(e.currentTarget.dataset.index);
        this.navigateToSearchResult(index);

        // Highlight selected result
        searchResultsList.querySelectorAll('.search-result-item').forEach(i => i.classList.remove('selected'));
        e.currentTarget.classList.add('selected');
      });
    });

    // Highlight first result as selected
    const firstItem = searchResultsList.querySelector('.search-result-item');
    if (firstItem) {
      firstItem.classList.add('selected');
    }

    // Update tab manager with final search results content
    if (this.genomeBrowser.tabManager) {
      this.genomeBrowser.tabManager.updateCurrentTabSidebarPanel(
        'searchResultsSection',
        true,
        searchResultsSection.innerHTML
      );
      // Also update search results data
      this.genomeBrowser.tabManager.updateCurrentTabSearchResults(results);
    }
  }

  // Navigate to a specific search result
  navigateToSearchResult(index) {
    if (!this.searchResults || index < 0 || index >= this.searchResults.length) return;

    const result = this.searchResults[index];
    const currentChr = document.getElementById('chromosomeSelect').value;
    const sequence = this.genomeBrowser.currentSequence[currentChr];

    // Calculate view range with context
    const start = Math.max(0, result.position - 500);
    const end = Math.min(sequence.length, result.end + 500);

    this.genomeBrowser.currentPosition = { start, end };
    this.genomeBrowser.updateStatistics(currentChr, sequence);
    this.genomeBrowser.displayGenomeView(currentChr, sequence);
    // Update navigation bar
    this.genomeBrowser.genomeNavigationBar.update();

    // Highlight search matches in sequence tracks (scrolling will be triggered automatically after highlighting)
    this.highlightSearchMatches([result]);

    // Update current tab title with new position (from search)
    if (this.genomeBrowser.tabManager) {
      this.genomeBrowser.tabManager.updateCurrentTabPosition(currentChr, start + 1, end, { source: 'navigation' });
    }

    this.currentSearchIndex = index;

    // Update status
    this.genomeBrowser.updateStatus(`Showing result ${index + 1} of ${this.searchResults.length}: ${result.name}`);
  }

  // Highlight search matches in sequence tracks
  highlightSearchMatches(matches) {
    // Highlight in bottom sequence panel (SequenceUtils)
    if (
      this.genomeBrowser.sequenceUtils &&
      typeof this.genomeBrowser.sequenceUtils.highlightSearchMatches === 'function'
    ) {
      this.genomeBrowser.sequenceUtils.highlightSearchMatches(matches);
    }

    // Also highlight in canvas sequence renderers for single-line tracks
    if (this.genomeBrowser.trackRenderer && this.genomeBrowser.trackRenderer.canvasRenderers) {
      this.genomeBrowser.trackRenderer.canvasRenderers.forEach((renderer, trackId) => {
        if (renderer && typeof renderer.highlightSearchMatches === 'function') {
          // Only highlight matches that are within the current viewport
          const currentPos = this.genomeBrowser.currentPosition;
          const viewportMatches = matches.filter(match => {
            return match.position >= currentPos.start && match.position <= currentPos.end;
          });

          if (viewportMatches.length > 0) {
            // Convert absolute positions to relative positions within the current view
            const relativeMatches = viewportMatches.map(match => ({
              ...match,
              position: match.position - currentPos.start,
              end: match.end - currentPos.start,
            }));
            renderer.highlightSearchMatches(relativeMatches);
          }
        }
      });
    }
  }

  // Auto-scroll to match position in sequence tracks
  scrollToMatchPosition(match) {
    // Scroll bottom sequence panel to show the match
    const sequenceContent = document.getElementById('sequenceContent');
    if (sequenceContent) {
      const sequenceView = sequenceContent.querySelector('.detailed-sequence-view');
      const scrollContainer = sequenceContent.querySelector('.detailed-sequence-view.virtualized') || sequenceContent;
      const isVirtualized = scrollContainer.classList?.contains('virtualized');
      // Calculate the line number where the match is located
      const currentPos = this.genomeBrowser.currentPosition;

      // Get actual bases per line from the first sequence line
      const firstSequenceLine = sequenceView?.querySelector('.sequence-line .sequence-bases');
      let basesPerLine = parseInt(sequenceView?.dataset?.basesPerLine, 10) || 100; // Default fallback

      if (firstSequenceLine && !isVirtualized) {
        // Count actual characters in the first line
        const textContent = firstSequenceLine.textContent || '';
        // Remove any whitespace and count actual bases
        const bases = textContent.replace(/\s/g, '');
        if (bases.length > 0) {
          basesPerLine = bases.length;
        }
      }

      // Get actual line height from rendered elements
      const firstLineGroup = sequenceView?.querySelector('.sequence-line-group');
      let lineHeight = parseFloat(sequenceView?.dataset?.lineHeight) || 40; // Default fallback

      if (firstLineGroup && !isVirtualized) {
        const rect = firstLineGroup.getBoundingClientRect();
        const style = window.getComputedStyle(firstLineGroup);
        const marginBottom = parseInt(style.marginBottom) || 0;
        lineHeight = rect.height + marginBottom;
      }

      const relativePosition = match.position - currentPos.start;
      const lineNumber = Math.floor(relativePosition / basesPerLine);
      const scrollPosition = lineNumber * lineHeight;

      console.log('🔍 Scrolling to match:', {
        matchPosition: match.position,
        currentStart: currentPos.start,
        relativePosition,
        basesPerLine,
        lineNumber,
        lineHeight,
        scrollPosition,
        scrollTarget: scrollContainer === sequenceContent ? 'sequenceContent' : 'virtualizedSequenceView',
      });

      // Scroll to the line containing the match
      scrollContainer.scrollTo({
        top: scrollPosition,
        behavior: 'smooth',
      });
    }

    // Also scroll sequence track containers
    const sequenceTracks = document.querySelectorAll('.sequence-track, .sequence-line-track');

    sequenceTracks.forEach(track => {
      const trackContent = track.querySelector('.track-content');
      if (trackContent) {
        // Calculate the relative position of the match within the current viewport
        const currentPos = this.genomeBrowser.currentPosition;
        const viewportWidth = currentPos.end - currentPos.start;
        const matchRelativePos = (match.position - currentPos.start) / viewportWidth;

        // Scroll to center the match in the viewport
        const trackWidth = trackContent.scrollWidth;
        const scrollPosition = Math.max(0, matchRelativePos * trackWidth - trackContent.clientWidth / 2);

        trackContent.scrollTo({
          left: scrollPosition,
          behavior: 'smooth',
        });
      }
    });
  }

  // Clear search highlights from all sequence tracks
  clearSearchHighlights() {
    // Clear highlights from bottom sequence panel (SequenceUtils)
    if (
      this.genomeBrowser.sequenceUtils &&
      typeof this.genomeBrowser.sequenceUtils.clearSearchHighlights === 'function'
    ) {
      this.genomeBrowser.sequenceUtils.clearSearchHighlights();
    }

    // Clear highlights from canvas sequence renderers
    if (this.genomeBrowser.trackRenderer && this.genomeBrowser.trackRenderer.canvasRenderers) {
      this.genomeBrowser.trackRenderer.canvasRenderers.forEach((renderer, trackId) => {
        if (renderer && typeof renderer.clearHighlights === 'function') {
          renderer.clearHighlights();
        }
      });
    }
  }

  // Helper method to parse search query - supports OR operator
  parseSearchQuery(query) {
    // Check if query contains OR operator (case insensitive)
    if (query.toLowerCase().includes(' or ')) {
      // Split by OR operator and clean up terms
      return query
        .split(/\s+or\s+/i)
        .map(term => term.trim())
        .filter(term => term.length > 0);
    } else {
      // Single search term
      return [query];
    }
  }

  // Helper method to get reverse complement
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
      a: 't',
      t: 'a',
      g: 'c',
      c: 'g',
      N: 'N',
      n: 'n',
    };

    return sequence
      .split('')
      .reverse()
      .map(base => complement[base] || base)
      .join('');
  }

  handleDocumentMouseMove(e) {
    if (!this.dragState.isDragging) return;

    // Don't update if a splitter is being resized
    if (document.body.hasAttribute('data-splitter-resizing')) return;

    const { element, startX, chromosome, startPosition } = this.dragState;
    const deltaX = e.clientX - startX;

    // Check if we've moved enough to consider this a drag
    if (!this.dragState.hasDragged && Math.abs(deltaX) > 5) {
      this.dragState.hasDragged = true;
      console.log('🔧 [DRAG-MOVE] Drag started, threshold exceeded');
    }

    if (!this.dragState.hasDragged) return;

    this.dragState.lastUpdateX = e.clientX;

    const currentRange = this.genomeBrowser.currentPosition.end - this.genomeBrowser.currentPosition.start;
    // Use the width captured at drag start so the px->base conversion and the
    // visual offset stay consistent even if a live re-render replaces the
    // dragged element mid-drag (which would make a re-measure return 0).
    const elementWidth = this.dragState.elementWidth || this.getEffectiveWidth(element);
    const sequence = this.genomeBrowser.currentSequence[chromosome];

    const positionChange = Math.round((deltaX * currentRange) / elementWidth);

    let newStart;
    let newEnd;

    if (this.circularMode) {
      // Circular mode: wrap positions around using modulo arithmetic
      const rawNewStart = startPosition - positionChange;
      const seqLen = sequence.length;

      // Use modulo to wrap position into [0, seqLen) range
      // JavaScript modulo can return negative, so we use ((n % m) + m) % m pattern
      // This ensures newStart is always non-negative, preventing issues with
      // sequence.substring() calls in GC and sequence rendering
      newStart = ((rawNewStart % seqLen) + seqLen) % seqLen;
      newEnd = newStart + currentRange;
    } else {
      // Linear mode: clamp to sequence boundaries
      newStart = Math.max(0, Math.min(sequence.length - currentRange, startPosition - positionChange));
      newEnd = newStart + currentRange;
    }

    // Store the calculated position
    this.dragState.lastCalculatedStart = newStart;

    // Update the position model that every track/ruler reads from
    this.genomeBrowser.currentPosition = { start: newStart, end: newEnd };

    // Drive the live visual offset as a PERCENTAGE of each track's own width,
    // snapped to the committed integer-base position. This is what makes the
    // drag preview match the final render exactly. A CSS `translateX(p%)` is
    // resolved against the element's OWN width - the very same width the
    // renderer maps the genomic range across - so the preview and the committed
    // view stay aligned even when our px-based width measurement is slightly off
    // (vertical scrollbar, border, inset, etc.). A px transform built from a
    // mismatched width is what made the view overshoot during the drag and
    // visibly snap back on release (drag left -> lands right, drag right ->
    // lands left). Using (startPosition - newStart)/range as the fraction makes
    // the preview reflect whole-base navigation, identical to the re-render.
    const shiftPercent = this.circularMode
      ? (deltaX / elementWidth) * 100
      : ((startPosition - newStart) / currentRange) * 100;

    if (this.dragState.dynamicUpdate) {
      // Re-render the genome tracks live so gene features / reads (and other
      // tracks) stay filled in instead of leaving blank space behind the drag.
      // Enabled by the global setting or by a per-track "update while dragging"
      // toggle (genes / reads). Computed once at drag start.
      this.requestDragViewRender(chromosome, sequence);
    } else if (this.globalDraggingEnabled) {
      // Update all tracks during drag when global dragging is enabled
      this.performGlobalDragUpdate(shiftPercent, chromosome);
    } else {
      // Only update the current track (default behavior)
      this.performVisualDragUpdate(shiftPercent, element);
    }

    // Optionally refresh the bottom sequence panel live. When a full track
    // re-render is already happening (dynamic update) the bottom panel is
    // refreshed through displayGenomeView, so this only needs to fire for the
    // lighter transform path.
    if (!this.dragState.dynamicUpdate && this.dragRealtimeSequenceUpdate) {
      this.requestDragSequenceRender(chromosome, sequence);
    }

    if (this.genomeBrowser.genomeNavigationBar) {
      this.genomeBrowser.genomeNavigationBar.update();
    }

    // Update detailed rulers during drag for real-time position display
    this.updateDetailedRulers();

    // Show real-time position feedback during drag
    this.showDragPositionFeedback(newStart, newEnd, chromosome);
  }

  /**
   * Throttled full genome-view re-render used during a drag when
   * `dragUpdateGeneFeatures` is enabled. The drag-end handler always performs a
   * final authoritative render, so dropping intermediate frames here is safe.
   */
  requestDragViewRender(chromosome, sequence) {
    const now = performance.now();
    if (now - this.dragRenderThrottle.lastViewRenderTime < this.dragRenderThrottle.intervalMs) return;
    this.dragRenderThrottle.lastViewRenderTime = now;
    this.genomeBrowser.displayGenomeView(chromosome, sequence);
  }

  /**
   * Throttled bottom-sequence re-render used during a drag when
   * `dragRealtimeSequenceUpdate` is enabled without full track re-rendering.
   */
  requestDragSequenceRender(chromosome, sequence) {
    const now = performance.now();
    if (now - this.dragRenderThrottle.lastSequenceRenderTime < this.dragRenderThrottle.intervalMs) return;
    this.dragRenderThrottle.lastSequenceRenderTime = now;
    if (this.genomeBrowser.sequenceUtils) {
      this.genomeBrowser.sequenceUtils.displayEnhancedSequence(chromosome, sequence);
    }
  }

  handleDocumentMouseUp(e) {
    if (!this.dragState.isDragging) return;

    const { element, hasDragged, chromosome, startPosition, startX } = this.dragState;

    console.log('🔧 [DRAG-END] === DRAG ENDING ===');
    console.log('🔧 [DRAG-END] hasDragged:', hasDragged);
    console.log('🔧 [DRAG-END] Total mouse movement:', e.clientX - startX, 'px');

    // Immediately reset dragging state
    this.dragState.isDragging = false;

    element.style.cursor = 'grab';
    element.classList.remove('dragging');
    document.body.style.userSelect = '';

    if (this.globalDraggingEnabled) {
      // Reset all tracks when global dragging is enabled
      this.resetGlobalVisualDragUpdates();
    } else {
      // Only reset the dragged element (default behavior)
      this.resetVisualDragUpdates(element);
    }

    // No Canvas-specific tracking needed with unified container approach

    // Clean up global drag update timeout if it exists
    if (this.globalDragUpdateTimeout) {
      clearTimeout(this.globalDragUpdateTimeout);
      this.globalDragUpdateTimeout = null;
    }

    // Dispatch custom drag end event immediately after resetting state
    document.dispatchEvent(
      new CustomEvent('genomeViewDragEnd', {
        detail: {
          chromosome,
          element,
          hasDragged,
          finalPosition: this.genomeBrowser.currentPosition,
        },
      })
    );
    console.log('🔧 [DRAG-END] genomeViewDragEnd event dispatched with details:', {
      chromosome,
      hasDragged,
      finalPosition: this.genomeBrowser.currentPosition,
    });

    if (!hasDragged) {
      this.dragState.hasDragged = false;
      console.log('🔧 [DRAG-END] No significant drag detected, no position change');
      return;
    }
    this.dragState.hasDragged = false;

    // Use the last calculated position as the final position
    const finalNewStart = this.dragState.lastCalculatedStart;
    const sequence = this.genomeBrowser.currentSequence[chromosome];
    const currentRange = this.genomeBrowser.currentPosition.end - this.genomeBrowser.currentPosition.start;
    const finalNewEnd = finalNewStart + currentRange;

    // Debug output for final position
    console.log('🔧 [DRAG-END] Final position calculation:');
    console.log('  - Original start position:', startPosition, 'bp');
    console.log('  - Last calculated start (from move):', finalNewStart, 'bp');
    console.log('  - Final calculated end:', finalNewEnd, 'bp');
    console.log('  - Total genome movement:', finalNewStart - startPosition, 'bp');
    console.log('  - Current range:', currentRange, 'bp');
    console.log('  - Sequence length:', sequence.length, 'bp');

    // Verify consistency with drag movement (use the width captured at drag
    // start; the element may have been replaced by a live re-render)
    const totalMouseDelta = e.clientX - startX;
    const elementWidth = this.dragState.elementWidth || this.getEffectiveWidth(element);
    const expectedPositionChange = Math.round((totalMouseDelta * currentRange) / elementWidth);
    const expectedNewStart = Math.max(
      0,
      Math.min(sequence.length - currentRange, startPosition - expectedPositionChange)
    );

    console.log('🔧 [DRAG-END] Consistency check:');
    console.log('  - Expected position change (recalculated):', expectedPositionChange, 'bp');
    console.log('  - Expected new start (recalculated):', expectedNewStart, 'bp');
    console.log('  - Actual new start (from last move):', finalNewStart, 'bp');
    console.log('  - Difference:', Math.abs(expectedNewStart - finalNewStart), 'bp');
    console.log('  - Match:', expectedNewStart === finalNewStart ? '✅ CONSISTENT' : '❌ MISMATCH');

    // Set the position before re-render
    const positionBeforeRender = { ...this.genomeBrowser.currentPosition };
    this.genomeBrowser.currentPosition = { start: finalNewStart, end: finalNewEnd };

    console.log('🔧 [DRAG-END] Position update:');
    console.log('  - Position before render:', positionBeforeRender);
    console.log('  - Position after update:', this.genomeBrowser.currentPosition);

    // Trigger a full re-render with the definitive new position
    console.log('🔧 [DRAG-END] Starting re-render...');
    this.genomeBrowser.updateStatistics(chromosome, sequence);
    this.genomeBrowser.displayGenomeView(chromosome, sequence);
    this.genomeBrowser.genomeNavigationBar.update();

    // Update current tab title with new position (from drag)
    if (this.genomeBrowser.tabManager) {
      this.genomeBrowser.tabManager.updateCurrentTabPosition(chromosome, finalNewStart + 1, finalNewEnd, {
        source: 'drag',
      });
    }

    // Update all detailed rulers after re-render (force update for final position)
    this.updateDetailedRulers(true);

    // Hide drag position feedback with delay
    setTimeout(() => this.hideDragPositionFeedback(), 1000);

    console.log('🔧 [DRAG-END] Re-render completed');
    console.log('🔧 [DRAG-END] Final position after render:', this.genomeBrowser.currentPosition);
  }

  // Show real-time position feedback during drag
  showDragPositionFeedback(start, end, chromosome) {
    // Remove existing feedback tooltip if any
    let tooltip = document.getElementById('drag-position-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'drag-position-tooltip';
      tooltip.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 8px 12px;
                border-radius: 4px;
                font-family: 'Courier New', monospace;
                font-size: 12px;
                z-index: 10000;
                pointer-events: none;
                white-space: nowrap;
            `;
      document.body.appendChild(tooltip);
    }

    // Format position with commas for readability. `start` is a 0-based
    // inclusive index and `end` is 0-based exclusive, so the 1-based inclusive
    // display range is (start + 1)..end - matching the bottom sequence title,
    // the tab title and the position input. (end + 1) was off by one base.
    const range = end - start;
    const displayStart = (start + 1).toLocaleString();
    const displayEnd = end.toLocaleString();

    tooltip.innerHTML = `
            <div><strong>${chromosome}</strong></div>
            <div>${displayStart} - ${displayEnd}</div>
            <div>Range: ${range.toLocaleString()} bp</div>
        `;

    // Auto-hide after drag ends
    if (!this.dragState.isDragging) {
      setTimeout(() => {
        if (tooltip && tooltip.parentNode) {
          tooltip.parentNode.removeChild(tooltip);
        }
      }, 1000);
    }
  }

  // Hide drag position feedback
  hideDragPositionFeedback() {
    const tooltip = document.getElementById('drag-position-tooltip');
    if (tooltip && tooltip.parentNode) {
      tooltip.parentNode.removeChild(tooltip);
    }
  }

  // Update viewport overlays to reflect the new position (with throttling)
  updateDetailedRulers(forceUpdate = false) {
    const now = performance.now();

    // Use throttling during drag operations to maintain performance
    if (!forceUpdate && this.dragState.isDragging) {
      if (now - this.rulerUpdateThrottle.lastUpdateTime < this.rulerUpdateThrottle.updateInterval) {
        // Schedule update if not already pending
        if (!this.rulerUpdateThrottle.pendingUpdate) {
          this.rulerUpdateThrottle.pendingUpdate = true;
          requestAnimationFrame(() => {
            this.updateDetailedRulers(true);
            this.rulerUpdateThrottle.pendingUpdate = false;
          });
        }
        return;
      }
    }

    this.rulerUpdateThrottle.lastUpdateTime = now;

    const detailedRulers = document.querySelectorAll('.detailed-ruler-container');
    console.log('🔧 [RULER-UPDATE] Found', detailedRulers.length, 'detailed rulers to update');

    detailedRulers.forEach((rulerContainer, index) => {
      if (rulerContainer._setupCanvas && typeof rulerContainer._setupCanvas === 'function') {
        console.log('🔧 [RULER-UPDATE] Updating detailed ruler', index + 1);
        try {
          rulerContainer._setupCanvas();
        } catch (error) {
          console.warn('🔧 [RULER-UPDATE] Error updating detailed ruler', index + 1, ':', error);
        }
      } else {
        console.warn('🔧 [RULER-UPDATE] No _setupCanvas function found for detailed ruler', index + 1);
      }
    });

    // Positional highlights are a separate overlay rather than children of the
    // track containers that receive the live drag transform. Repaint them from
    // the current viewport in the same throttled frame as the rulers so their
    // genomic positions follow the drag without requiring a full track redraw.
    this.genomeBrowser.highlightManager?.renderHighlights();
  }

  // Draggable functionality for tracks
  makeDraggable(element, chromosome) {
    element.style.cursor = 'grab';
    element.title = 'Drag left or right to navigate through the genome\nKeyboard: ← → arrows, Home, End';

    const handleMouseDown = e => {
      if (e.button !== 0) return;
      if (document.body.hasAttribute('data-splitter-resizing')) return;

      // Initialize centralized drag state
      Object.assign(this.dragState, {
        isDragging: true,
        hasDragged: false,
        element: element,
        chromosome: chromosome,
        startX: e.clientX,
        startPosition: this.genomeBrowser.currentPosition.start,
        lastCalculatedStart: this.genomeBrowser.currentPosition.start,
        // Capture the px-per-base reference once; reused for the whole drag
        elementWidth: this.getEffectiveWidth(element),
        // Decide once whether tracks should re-render live during this drag
        // (global setting OR a per-track "update while dragging" toggle).
        dynamicUpdate: this.isDynamicDragUpdateEnabled(),
        // No Canvas-specific tracking needed with unified container approach
      });

      // Reset in-drag render throttles so the first eligible frame renders
      this.dragRenderThrottle.lastViewRenderTime = 0;
      this.dragRenderThrottle.lastSequenceRenderTime = 0;

      element.style.cursor = 'grabbing';
      element.classList.add('dragging');

      if (this.globalDraggingEnabled) {
        // Cache transforms for all tracks when global dragging is enabled
        this.cacheAllTrackTransforms();
      } else {
        // Only cache the dragged element (default behavior)
        this.cacheOriginalTransforms(element);
      }

      document.body.style.userSelect = 'none';

      // Dispatch custom drag start event for performance optimization
      document.dispatchEvent(
        new CustomEvent('genomeViewDragStart', {
          detail: { chromosome, element },
        })
      );

      e.preventDefault();
    };

    // Cleanup previous listener if any, then add the new one
    if (element._handleDragMouseDown) {
      element.removeEventListener('mousedown', element._handleDragMouseDown);
    }
    element.addEventListener('mousedown', handleMouseDown);
    element._handleDragMouseDown = handleMouseDown;

    // Add keyboard navigation
    element.setAttribute('tabindex', '0');
    element.addEventListener('keydown', e => {
      const sequence = this.genomeBrowser.currentSequence[chromosome];
      const currentRange = this.genomeBrowser.currentPosition.end - this.genomeBrowser.currentPosition.start;
      const step = Math.max(1, Math.floor(currentRange * 0.1));

      let newStart = this.genomeBrowser.currentPosition.start;

      switch (e.key) {
        case 'ArrowLeft':
          if (this.circularMode) {
            newStart = this.genomeBrowser.currentPosition.start - step;
            // Wrap to non-negative using modulo arithmetic
            newStart = ((newStart % sequence.length) + sequence.length) % sequence.length;
          } else {
            newStart = Math.max(0, this.genomeBrowser.currentPosition.start - step);
          }
          break;
        case 'ArrowRight':
          if (this.circularMode) {
            newStart = this.genomeBrowser.currentPosition.start + step;
            // Wrap around using modulo
            newStart = newStart % sequence.length;
          } else {
            newStart = Math.min(sequence.length - currentRange, this.genomeBrowser.currentPosition.start + step);
          }
          break;
        case 'Home':
          newStart = 0;
          break;
        case 'End':
          newStart = Math.max(0, sequence.length - currentRange);
          break;
        default:
          return;
      }

      e.preventDefault();

      const newEnd = newStart + currentRange;

      // In circular mode, newEnd can exceed sequence length (wrapping)
      this.genomeBrowser.currentPosition = { start: newStart, end: newEnd };
      this.genomeBrowser.updateStatistics(chromosome, sequence);
      this.genomeBrowser.displayGenomeView(chromosome, sequence);
      this.genomeBrowser.genomeNavigationBar.update();

      // Update current tab title with new position (from circular drag)
      if (this.genomeBrowser.tabManager) {
        this.genomeBrowser.tabManager.updateCurrentTabPosition(chromosome, newStart + 1, newEnd, { source: 'drag' });
      }
    });
  }

  getEffectiveWidth(element) {
    if (!element) return 800;

    // Resolve the track-content wrapper for this draggable element.
    const trackContent = element.classList?.contains('track-content')
      ? element
      : element.querySelector?.('.track-content') || element;

    // Measure the ACTUAL drawing surface, not the track-content border box.
    // Each track maps the genomic range across the width of an inner surface
    // that is sized to the *content* box (SVG width:100%, fixed-width reads
    // canvas, etc.). The track-content border box additionally includes borders
    // and any inner scrollbar (e.g. the scrollable reads container), so
    // converting the mouse delta with it over-counts the available width. This
    // mainly affects the px->base "feel" now that the visual transform is
    // percentage-based, but keeping it accurate also keeps the committed
    // position matching the mouse 1:1.
    const surfaceSelectors = [
      '.unified-gene-container', // genes & features (SVG/Canvas live inside this)
      '.genes-svg-container',
      '.reads-svg-container',
      '.gc-svg-container',
      '.variant-svg-container',
      '.detailed-ruler-container',
      'canvas',
      'svg',
    ];

    for (const selector of surfaceSelectors) {
      const surface = trackContent.matches?.(selector) ? trackContent : trackContent.querySelector?.(selector);
      if (surface) {
        const surfaceWidth = surface.getBoundingClientRect().width;
        if (surfaceWidth > 1) {
          return surfaceWidth;
        }
      }
    }

    // Fallback: the track-content CONTENT box. clientWidth excludes the border
    // and any vertical scrollbar on the track-content itself, which is closer to
    // the true drawing width than getBoundingClientRect (the border box).
    if (trackContent && trackContent.nodeType === 1) {
      trackContent.style.width = '100%'; // Force layout calculation
      const contentWidth = trackContent.clientWidth || trackContent.getBoundingClientRect().width;
      if (contentWidth > 1) {
        return contentWidth;
      }
    }

    return element.clientWidth || element.offsetWidth || 800;
  }

  /**
   * Perform lightweight visual updates during dragging
   * Uses unified container approach for consistent movement
   */
  performVisualDragUpdate(shiftPercent, element) {
    // Percentage transforms keep the preview aligned with the eventual render
    // regardless of the exact track width (see handleDocumentMouseMove). SVG
    // transform attributes can't take percentages, so the legacy SVG-element
    // path uses a pixel value derived from the width captured at drag start.
    const svgDeltaX = (shiftPercent / 100) * (this.dragState.elementWidth || this.getEffectiveWidth(element));

    // Check if this is a reads track and handle it directly
    const readsTrackElement = element.closest('.reads-track');
    if (readsTrackElement) {
      const trackContent = readsTrackElement.querySelector('.track-content');
      if (trackContent) {
        // Cache original transform if not already cached. Guard on
        // `=== undefined` (not truthiness): a cached '' is a valid base, and
        // treating it as uncached would re-cache this frame's translateX next
        // frame and compound the offset (see cacheTrackTransform).
        if (trackContent.dataset.baseTransform === undefined) {
          trackContent.dataset.baseTransform = trackContent.style.transform || '';
        }

        const baseTransform = trackContent.dataset.baseTransform || '';
        trackContent.style.transform = baseTransform
          ? `${baseTransform} translateX(${shiftPercent}%)`
          : `translateX(${shiftPercent}%)`;
        return; // Early return for reads track
      }
    }

    // Try to find the unified gene container for genes track
    const unifiedContainer = document.querySelector('.unified-gene-container');

    if (unifiedContainer) {
      // Apply transform to the unified container only
      const baseTransform = unifiedContainer.dataset.baseTransform || '';
      unifiedContainer.style.transform = baseTransform
        ? `${baseTransform} translateX(${shiftPercent}%)`
        : `translateX(${shiftPercent}%)`;
    } else {
      // Fallback to individual element updates
      const allElements = document.querySelectorAll('[data-base-transform]');

      allElements.forEach(el => {
        const baseTransform = el.dataset.baseTransform || '';
        const isHTMLElement = el.classList.contains('gene-element');
        const isSVGElement = el.tagName === 'svg' || el.tagName === 'g' || el.classList.contains('svg-gene-element');

        if (isHTMLElement) {
          // HTML elements: use style.transform (percentage of own width)
          el.style.transform = baseTransform
            ? `${baseTransform} translateX(${shiftPercent}%)`
            : `translateX(${shiftPercent}%)`;
        } else if (isSVGElement) {
          // SVG elements: only use transform attribute (user units, px-derived)
          el.setAttribute(
            'transform',
            baseTransform ? `${baseTransform} translate(${svgDeltaX}, 0)` : `translate(${svgDeltaX}, 0)`
          );
        }
      });
    }

    // Add visual feedback class
    element.classList.add('visual-dragging');
  }

  // Perform global drag update - applies visual transforms to all tracks (no redraw during drag)
  performGlobalDragUpdate(shiftPercent, chromosome) {
    // Apply a width-relative shift to every track. HTML containers use a CSS
    // percentage (resolved against their own width = the render width, so the
    // preview matches the committed view). SVG elements don't honor percentage
    // translations reliably, so they get a pixel value derived from their own
    // measured width - which is equivalent and equally width-independent.
    const pxFor = el => (shiftPercent / 100) * (el.getBoundingClientRect().width || this.dragState.elementWidth || 0);

    // Handle genes & features track specially to match single-track behavior
    const unifiedContainer = document.querySelector('.unified-gene-container');

    if (unifiedContainer) {
      // For genes & features, use the same logic as performVisualDragUpdate
      this.cacheTrackTransform(unifiedContainer);
      const baseTransform = unifiedContainer.dataset.baseTransform || '';
      unifiedContainer.style.transform = baseTransform
        ? `${baseTransform} translateX(${shiftPercent}%)`
        : `translateX(${shiftPercent}%)`;
      unifiedContainer.classList.add('visual-dragging');
    } else {
      // Fallback: handle genes & features elements individually
      const geneElements = document.querySelectorAll('[data-base-transform]');
      geneElements.forEach(el => {
        const baseTransform = el.dataset.baseTransform || '';
        const isHTMLElement = el.classList.contains('gene-element');
        const isSVGElement = el.tagName === 'svg' || el.tagName === 'g' || el.classList.contains('svg-gene-element');

        if (isHTMLElement) {
          el.style.transform = baseTransform
            ? `${baseTransform} translateX(${shiftPercent}%)`
            : `translateX(${shiftPercent}%)`;
          el.classList.add('visual-dragging');
        } else if (isSVGElement) {
          const d = pxFor(el);
          el.setAttribute('transform', baseTransform ? `${baseTransform} translate(${d}, 0)` : `translate(${d}, 0)`);
          el.classList.add('visual-dragging');
        }
      });
    }

    // Handle all other tracks (non-genes) with regular track-content approach
    const allTrackContents = document.querySelectorAll('.track-content');
    allTrackContents.forEach(trackContent => {
      const track = trackContent.closest('[class*="-track"]');
      if (!track) return;

      // Skip genes & features track since we handled it above
      if (
        track.classList.contains('genes-track') ||
        trackContent.querySelector('.unified-gene-container') ||
        trackContent.querySelector('.genes-svg-container')
      ) {
        return;
      }

      // Cache the original transform if not already cached
      this.cacheTrackTransform(trackContent);

      // track-content is an HTML div -> percentage of its own width
      const baseTransform = trackContent.dataset.baseTransform || '';
      trackContent.style.transform = baseTransform
        ? `${baseTransform} translateX(${shiftPercent}%)`
        : `translateX(${shiftPercent}%)`;
      trackContent.classList.add('visual-dragging');
    });

    // Handle other specialized SVG containers (but not genes-svg-container).
    // These are <svg> elements, so use a px value from their own width.
    const otherSvgContainers = document.querySelectorAll('.gc-svg-container, .variant-svg-container');
    otherSvgContainers.forEach(svgContainer => {
      this.cacheTrackTransform(svgContainer);

      const baseTransform = svgContainer.dataset.baseTransform || '';
      const d = pxFor(svgContainer);
      svgContainer.style.transform = baseTransform ? `${baseTransform} translateX(${d}px)` : `translateX(${d}px)`;
      svgContainer.classList.add('visual-dragging');
    });
  }

  // Cache transform for a single track element.
  // Guard on `=== undefined`, NOT truthiness: the base transform is almost
  // always the empty string (freshly-rendered containers have no transform).
  // A `!element.dataset.baseTransform` check treats that cached '' as "not yet
  // cached", so the SECOND drag frame re-caches the FIRST frame's translateX as
  // the base — and every later frame then stacks the live shift on top of it.
  // That compounding made the view overshoot in the drag direction during the
  // drag and snap back on release (drag left -> sits left, then jumps right).
  cacheTrackTransform(element) {
    if (element.dataset.baseTransform === undefined) {
      const originalTransform = element.style.transform || '';
      element.dataset.baseTransform = originalTransform;
      console.log('🔧 [CACHE] Cached transform for element:', element.className, 'Transform:', originalTransform);
    }
  }

  // Reset visual transforms for all tracks (global dragging)
  resetGlobalVisualDragUpdates() {
    console.log('🌍 [GLOBAL-RESET] Resetting visual transforms for all tracks');

    // No Canvas-specific transforms to reset - using unified container approach

    // Reset genes & features track specially to match single-track behavior
    const unifiedContainer = document.querySelector('.unified-gene-container');
    let tracksReset = 0;

    if (unifiedContainer) {
      // For genes & features, use the same reset logic as resetVisualDragUpdates
      const baseTransform = unifiedContainer.dataset.baseTransform || '';
      unifiedContainer.style.transform = baseTransform;
      unifiedContainer.classList.remove('visual-dragging');
      tracksReset++;
      console.log('🌍 [GLOBAL-RESET] Reset unified container transform for genes & features');
    } else {
      // Fallback: reset genes & features elements individually
      const geneElements = document.querySelectorAll('[data-base-transform]');
      geneElements.forEach(el => {
        const baseTransform = el.dataset.baseTransform || '';
        const isHTMLElement = el.classList.contains('gene-element');
        const isSVGElement = el.tagName === 'svg' || el.tagName === 'g' || el.classList.contains('svg-gene-element');

        if (isHTMLElement) {
          // HTML elements: reset style.transform
          el.style.transform = baseTransform;
          el.classList.remove('visual-dragging');
          tracksReset++;
        } else if (isSVGElement) {
          // SVG elements: reset transform attribute
          if (baseTransform) {
            el.setAttribute('transform', baseTransform);
          } else {
            el.removeAttribute('transform');
          }
          el.classList.remove('visual-dragging');
          tracksReset++;
        }
      });
      console.log('🌍 [GLOBAL-RESET] Reset individual transforms for genes & features elements');
    }

    // Reset all other tracks (non-genes) with regular track-content approach
    const allTrackContents = document.querySelectorAll('.track-content');
    allTrackContents.forEach(trackContent => {
      const track = trackContent.closest('[class*="-track"]');
      if (!track) return;

      // Skip genes & features track since we handled it above
      if (
        track.classList.contains('genes-track') ||
        trackContent.querySelector('.unified-gene-container') ||
        trackContent.querySelector('.genes-svg-container')
      ) {
        return;
      }

      const baseTransform = trackContent.dataset.baseTransform || '';
      trackContent.style.transform = baseTransform;
      trackContent.classList.remove('visual-dragging');
      tracksReset++;
    });

    // Reset other specialized SVG containers (but not genes-svg-container)
    const otherSvgContainers = document.querySelectorAll('.gc-svg-container, .variant-svg-container');
    otherSvgContainers.forEach(svgContainer => {
      const baseTransform = svgContainer.dataset.baseTransform || '';
      svgContainer.style.transform = baseTransform;
      svgContainer.classList.remove('visual-dragging');
      tracksReset++;
    });

    console.log('🌍 [GLOBAL-RESET] Reset transforms for', tracksReset, 'track elements');
  }

  // Cache transforms for all tracks (global dragging)
  cacheAllTrackTransforms() {
    console.log('🌍 [GLOBAL-CACHE] Caching transforms for all tracks');

    // Cache genes & features track specially to match single-track behavior
    const unifiedContainer = document.querySelector('.unified-gene-container');

    if (unifiedContainer) {
      // For genes & features, use the same caching logic as cacheOriginalTransforms
      this.cacheTrackTransform(unifiedContainer);
      console.log('🌍 [GLOBAL-CACHE] Cached unified container transform for genes & features');
    } else {
      // Fallback: cache genes & features elements individually
      const geneElements = document.querySelectorAll('[data-base-transform]');
      geneElements.forEach(el => {
        this.cacheTrackTransform(el);
      });
      console.log('🌍 [GLOBAL-CACHE] Cached individual transforms for genes & features elements');
    }

    // Cache all other tracks (non-genes) with regular track-content approach
    const allTrackContents = document.querySelectorAll('.track-content');
    allTrackContents.forEach(trackContent => {
      const track = trackContent.closest('[class*="-track"]');
      if (!track) return;

      // Skip genes & features track since we handled it above
      if (
        track.classList.contains('genes-track') ||
        trackContent.querySelector('.unified-gene-container') ||
        trackContent.querySelector('.genes-svg-container')
      ) {
        return;
      }

      this.cacheTrackTransform(trackContent);
    });

    // Cache other specialized SVG containers (but not genes-svg-container)
    const otherSvgContainers = document.querySelectorAll('.gc-svg-container, .variant-svg-container');
    otherSvgContainers.forEach(svgContainer => {
      this.cacheTrackTransform(svgContainer);
    });

    console.log('🌍 [GLOBAL-CACHE] Cached transforms for all track elements');
  }

  /**
   * Cache original transforms before dragging starts
   */
  cacheOriginalTransforms(element) {
    // Find the unified gene container or fall back to individual elements
    const unifiedContainer = document.querySelector('.unified-gene-container');

    if (unifiedContainer) {
      // Cache transform for the unified container only
      console.log('🔧 [DRAG] Caching transform for unified container');
      const originalTransform = unifiedContainer.style.transform || '';
      unifiedContainer.dataset.baseTransform = originalTransform;
      console.log('🔧 [DRAG] Cached unified container transform:', originalTransform);
    } else {
      // Fallback to individual elements for backward compatibility
      const geneElements = document.querySelectorAll('.gene-element, .svg-gene-element, .genes-svg-container');

      console.log('🔧 [DRAG] Caching transforms for', geneElements.length, 'individual elements');

      geneElements.forEach(el => {
        const isHTMLElement = el.classList.contains('gene-element');
        const isSVGElement = el.tagName === 'svg' || el.tagName === 'g' || el.classList.contains('svg-gene-element');

        if (isHTMLElement) {
          // Cache HTML element's style.transform
          const originalTransform = el.style.transform || '';
          el.dataset.baseTransform = originalTransform;
          console.log('🔧 [DRAG] Cached HTML transform:', el.className, '-> "' + originalTransform + '"');
        } else if (isSVGElement) {
          // Cache SVG element's transform attribute
          const originalTransform = el.getAttribute('transform') || '';
          el.dataset.baseTransform = originalTransform;
          console.log('🔧 [DRAG] Cached SVG transform:', el.tagName, '-> "' + originalTransform + '"');
        }
      });
    }
  }

  /**
   * Reset visual transforms after drag ends
   */
  resetVisualDragUpdates(element) {
    // No Canvas-specific transforms to reset - using unified container approach

    // Check if this is a reads track and reset it directly
    const readsTrackElement = element.closest('.reads-track');
    if (readsTrackElement) {
      const trackContent = readsTrackElement.querySelector('.track-content');
      if (trackContent) {
        const baseTransform = trackContent.dataset.baseTransform || '';
        trackContent.style.transform = baseTransform;

        // Clean up cache
        delete trackContent.dataset.baseTransform;

        console.log('🔧 [DRAG-RESET] Reads track container reset:');
        console.log('  - Restored transform:', baseTransform || 'none');
        return; // Early return for reads track
      }
    }

    // Try to find the unified gene container for genes track
    const unifiedContainer = document.querySelector('.unified-gene-container');

    if (unifiedContainer) {
      // Reset the unified container only
      const baseTransform = unifiedContainer.dataset.baseTransform || '';
      unifiedContainer.style.transform = baseTransform;

      // Clean up cache
      delete unifiedContainer.dataset.baseTransform;

      console.log('🔧 [DRAG-RESET] Unified container reset:');
      console.log('  - Restored transform:', baseTransform || 'none');
    } else {
      // Fallback to individual element reset
      const cachedElements = document.querySelectorAll('[data-base-transform]');

      console.log('🔧 [DRAG-RESET] Fallback individual element reset:');
      console.log('  - Elements to reset:', cachedElements.length);

      let htmlElementsReset = 0;
      let svgElementsReset = 0;

      cachedElements.forEach(el => {
        const baseTransform = el.dataset.baseTransform || '';
        const isHTMLElement = el.classList.contains('gene-element');
        const isSVGElement = el.tagName === 'svg' || el.tagName === 'g' || el.classList.contains('svg-gene-element');

        if (isHTMLElement) {
          // Restore HTML element's style.transform
          el.style.transform = baseTransform;
          htmlElementsReset++;
          console.log('🔧 [DRAG-RESET] HTML element reset:', el.className, '-> "' + baseTransform + '"');
        } else if (isSVGElement) {
          // Restore SVG element's transform attribute
          el.setAttribute('transform', baseTransform);
          svgElementsReset++;
          console.log('🔧 [DRAG-RESET] SVG element reset:', el.tagName, '-> "' + baseTransform + '"');
        }

        // Clean up cache
        delete el.dataset.baseTransform;
      });

      console.log('🔧 [DRAG-RESET] Reset summary:');
      console.log('  - HTML elements reset:', htmlElementsReset);
      console.log('  - SVG elements reset:', svgElementsReset);
    }

    // Remove visual feedback class
    element.classList.remove('visual-dragging');
    console.log('🔧 [DRAG-RESET] Transform reset completed');
  }

  // Method to move Search Results panel to the top
  moveSearchResultsToTop() {
    const searchResultsSection = document.getElementById('searchResultsSection');
    const sidebar = document.getElementById('sidebar');

    if (!searchResultsSection || !sidebar) return;

    // Store the original position if not already stored
    if (!this.searchResultsOriginalPosition) {
      // Find the next sibling to know where to restore it
      this.searchResultsOriginalPosition = {
        nextSibling: searchResultsSection.nextElementSibling,
        parent: searchResultsSection.parentElement,
      };
    }

    // Move to the top (first child of sidebar)
    sidebar.insertBefore(searchResultsSection, sidebar.firstElementChild);
  }

  // Method to restore Search Results panel to its original position
  restoreSearchResultsPosition() {
    const searchResultsSection = document.getElementById('searchResultsSection');

    if (!searchResultsSection || !this.searchResultsOriginalPosition) return;

    const { nextSibling, parent } = this.searchResultsOriginalPosition;

    // Restore to original position
    if (nextSibling && nextSibling.parentElement === parent) {
      parent.insertBefore(searchResultsSection, nextSibling);
    } else {
      // If nextSibling doesn't exist, append to the end
      parent.appendChild(searchResultsSection);
    }
  }

  // Method to clear search results and restore position
  clearSearchResults() {
    const searchResultsSection = document.getElementById('searchResultsSection');
    const searchResultsList = document.getElementById('searchResultsList');

    if (searchResultsSection) {
      searchResultsSection.style.display = 'none';
    }

    // Update tab manager about search results panel state change
    if (this.genomeBrowser.tabManager) {
      this.genomeBrowser.tabManager.updateCurrentTabSidebarPanel('searchResultsSection', false, null);
    }

    if (searchResultsList) {
      searchResultsList.innerHTML = '<p class="no-results">No search results</p>';
    }

    // Restore original position
    this.restoreSearchResultsPosition();

    // Clear search results array
    this.searchResults = [];
    this.currentSearchIndex = 0;
  }

  /**
   * Re-attach event handlers for search result items
   * This method can be called when content is restored from tab state
   */
  reattachSearchResultEventHandlers() {
    const searchResultsList = document.getElementById('searchResultsList');
    if (!searchResultsList) return;

    // Find all search result items and re-attach click handlers
    const searchResultItems = searchResultsList.querySelectorAll('.search-result-item');
    searchResultItems.forEach(item => {
      // Remove any existing click listeners to avoid duplicates
      const newItem = item.cloneNode(true);
      item.parentNode.replaceChild(newItem, item);

      // Add click handler for navigation
      newItem.addEventListener('click', e => {
        const index = parseInt(e.currentTarget.dataset.index);
        this.navigateToSearchResult(index);

        // Highlight selected result
        searchResultsList.querySelectorAll('.search-result-item').forEach(i => i.classList.remove('selected'));
        e.currentTarget.classList.add('selected');
      });
    });

    console.log(
      `🔧 [NavigationManager] Re-attached event handlers for ${searchResultItems.length} search result items`
    );
  }

  // Set global dragging behavior
  setGlobalDragging(enabled) {
    this.globalDraggingEnabled = enabled;
    console.log(`🎯 NavigationManager: Global dragging ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Re-render gene features (and other tracks) live during a drag instead of
  // only applying a CSS transform. Eliminates trailing blank space at the cost
  // of extra rendering. Default OFF.
  setDragUpdateGeneFeatures(enabled) {
    this.dragUpdateGeneFeatures = enabled === true;
    console.log(
      `🧬 NavigationManager: Update gene features during drag ${this.dragUpdateGeneFeatures ? 'enabled' : 'disabled'}`
    );
  }

  // Update the bottom sequence panel live during a drag (real-time) versus only
  // once the drag ends (unified). Default OFF (unified).
  setDragRealtimeSequenceUpdate(enabled) {
    this.dragRealtimeSequenceUpdate = enabled === true;
    console.log(
      `🔤 NavigationManager: Real-time sequence update during drag ${this.dragRealtimeSequenceUpdate ? 'enabled' : 'disabled'}`
    );
  }

  // Decide whether tracks should re-render live during a drag. True when the
  // global setting is on, or when a per-track "update while dragging" toggle is
  // enabled for the genes or reads track (read from their saved track settings).
  isDynamicDragUpdateEnabled() {
    if (this.dragUpdateGeneFeatures) return true;
    const trackRenderer = this.genomeBrowser.trackRenderer;
    if (!trackRenderer || typeof trackRenderer.getTrackSettings !== 'function') return false;
    try {
      if (trackRenderer.getTrackSettings('genes')?.dynamicUpdateOnDrag === true) return true;
      if (trackRenderer.getTrackSettings('reads')?.dynamicUpdateOnDrag === true) return true;
    } catch (err) {
      console.warn('⚠️ [NavigationManager] Could not read per-track dynamic drag settings:', err);
    }
    return false;
  }

  /**
   * Get current search settings
   */
  getCurrentSearchSettings() {
    const configManager = this.genomeBrowser.configManager;
    if (!configManager) {
      console.warn('⚠️ ConfigManager not available, using default search settings');
      return this.getDefaultSearchSettings();
    }

    const settings = configManager.getSearchSettings();
    console.log('🔧 Retrieved search settings:', settings);

    // Ensure all required settings have default values
    const defaultSettings = this.getDefaultSearchSettings();
    const mergedSettings = { ...defaultSettings, ...settings };

    console.log('🔧 Merged search settings:', mergedSettings);
    return mergedSettings;
  }

  /**
   * Get default search settings
   */
  getDefaultSearchSettings() {
    return {
      caseSensitive: false,
      reverseComplement: false,
      partialMatches: true,
      searchGeneNames: true,
      searchSequence: true,
      searchFeatures: true,
      searchProtein: false,
      minLength: 3,
      maxResults: 100,
      timeout: 30,
      highlightMatches: true,
      showContext: true,
      contextLength: 50,
      saveHistory: true,
      historyLimit: 50,
    };
  }

  /**
   * Show search settings modal
   */
  showSearchSettingsModal() {
    const modal = document.getElementById('searchSettingsModal');
    if (modal) {
      this.loadSearchSettings();

      // Reset drag position so modal re-centers on open
      if (window.modalDragManager) {
        window.modalDragManager.resetPosition('#searchSettingsModal');
      }

      modal.classList.add('show');

      // Make modal draggable using ModalDragManager
      if (window.modalDragManager) {
        window.modalDragManager.makeDraggable('#searchSettingsModal');
      }

      // Initialize search settings tabs
      this.initializeSearchSettingsTabs();
    }
  }

  /**
   * Initialize search settings tab functionality
   */
  initializeSearchSettingsTabs() {
    const modal = document.getElementById('searchSettingsModal');
    if (!modal) return;

    const tabButtons = modal.querySelectorAll('.search-settings-tabs .tab-button');
    tabButtons.forEach(button => {
      // Remove existing listeners to prevent duplicates
      button.replaceWith(button.cloneNode(true));
    });

    // Re-select buttons after replacing
    modal.querySelectorAll('.search-settings-tabs .tab-button').forEach(button => {
      button.addEventListener('click', () => {
        this.switchSearchSettingsTab(button.dataset.tab);
      });
    });
  }

  /**
   * Switch to a specific search settings tab
   * @param {string} tabName - The name of the tab to switch to
   */
  switchSearchSettingsTab(tabName) {
    const modal = document.getElementById('searchSettingsModal');
    if (!modal) return;

    // Update tab buttons
    modal.querySelectorAll('.search-settings-tabs .tab-button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
      btn.blur();
    });

    // Update tab content panels
    modal.querySelectorAll('.search-settings-tab-content').forEach(panel => {
      panel.classList.toggle('active', panel.dataset.tab === tabName);
    });
  }

  /**
   * Load search settings from ConfigManager
   */
  loadSearchSettings() {
    const configManager = this.genomeBrowser.configManager;
    if (!configManager) return;

    const searchSettings = configManager.getSearchSettings();

    // Load basic options
    const caseSensitiveEl = document.getElementById('searchCaseSensitive');
    const reverseComplementEl = document.getElementById('searchReverseComplement');
    const partialMatchesEl = document.getElementById('searchPartialMatches');

    if (caseSensitiveEl) caseSensitiveEl.checked = searchSettings.caseSensitive;
    if (reverseComplementEl) reverseComplementEl.checked = searchSettings.reverseComplement;
    if (partialMatchesEl) partialMatchesEl.checked = searchSettings.partialMatches;

    // Load search scope
    const geneNamesEl = document.getElementById('searchGeneNames');
    const sequenceEl = document.getElementById('searchSequence');
    const featuresEl = document.getElementById('searchFeatures');
    const proteinEl = document.getElementById('searchProtein');

    if (geneNamesEl) geneNamesEl.checked = searchSettings.searchGeneNames;
    if (sequenceEl) sequenceEl.checked = searchSettings.searchSequence;
    if (featuresEl) featuresEl.checked = searchSettings.searchFeatures;
    if (proteinEl) proteinEl.checked = searchSettings.searchProtein;

    // Load advanced options
    const minLengthEl = document.getElementById('searchMinLength');
    const maxResultsEl = document.getElementById('searchMaxResults');
    const timeoutEl = document.getElementById('searchTimeout');

    if (minLengthEl) minLengthEl.value = searchSettings.minLength;
    if (maxResultsEl) maxResultsEl.value = searchSettings.maxResults;
    if (timeoutEl) timeoutEl.value = searchSettings.timeout;

    // Load display options
    const highlightEl = document.getElementById('searchHighlightMatches');
    const showContextEl = document.getElementById('searchShowContext');
    const contextLengthEl = document.getElementById('searchContextLength');

    if (highlightEl) highlightEl.checked = searchSettings.highlightMatches;
    if (showContextEl) showContextEl.checked = searchSettings.showContext;
    if (contextLengthEl) contextLengthEl.value = searchSettings.contextLength;

    // Load history options
    const saveHistoryEl = document.getElementById('searchSaveHistory');
    const historyLimitEl = document.getElementById('searchHistoryLimit');

    if (saveHistoryEl) saveHistoryEl.checked = searchSettings.saveHistory;
    if (historyLimitEl) historyLimitEl.value = searchSettings.historyLimit;
  }

  /**
   * Save search settings to ConfigManager
   */
  saveSearchSettings() {
    const configManager = this.genomeBrowser.configManager;
    if (!configManager) return;

    const searchSettings = {
      caseSensitive: document.getElementById('searchCaseSensitive')?.checked || false,
      reverseComplement: document.getElementById('searchReverseComplement')?.checked || false,
      partialMatches: document.getElementById('searchPartialMatches')?.checked || false,
      searchGeneNames: document.getElementById('searchGeneNames')?.checked || false,
      searchSequence: document.getElementById('searchSequence')?.checked || false,
      searchFeatures: document.getElementById('searchFeatures')?.checked || false,
      searchProtein: document.getElementById('searchProtein')?.checked || false,
      minLength: parseInt(document.getElementById('searchMinLength')?.value) || 3,
      maxResults: parseInt(document.getElementById('searchMaxResults')?.value) || 100,
      timeout: parseInt(document.getElementById('searchTimeout')?.value) || 30,
      highlightMatches: document.getElementById('searchHighlightMatches')?.checked || false,
      showContext: document.getElementById('searchShowContext')?.checked || false,
      contextLength: parseInt(document.getElementById('searchContextLength')?.value) || 50,
      saveHistory: document.getElementById('searchSaveHistory')?.checked || false,
      historyLimit: parseInt(document.getElementById('searchHistoryLimit')?.value) || 50,
    };

    configManager.setSearchSettings(searchSettings);
    console.log('Search settings saved:', searchSettings);
  }

  /**
   * Reset search settings to defaults
   */
  resetSearchSettings() {
    const defaultSettings = this.getDefaultSearchSettings();

    // Reset basic options
    const caseSensitiveEl = document.getElementById('searchCaseSensitive');
    const reverseComplementEl = document.getElementById('searchReverseComplement');
    const partialMatchesEl = document.getElementById('searchPartialMatches');

    if (caseSensitiveEl) caseSensitiveEl.checked = defaultSettings.caseSensitive;
    if (reverseComplementEl) reverseComplementEl.checked = defaultSettings.reverseComplement;
    if (partialMatchesEl) partialMatchesEl.checked = defaultSettings.partialMatches;

    // Reset search scope
    const geneNamesEl = document.getElementById('searchGeneNames');
    const sequenceEl = document.getElementById('searchSequence');
    const featuresEl = document.getElementById('searchFeatures');
    const proteinEl = document.getElementById('searchProtein');

    if (geneNamesEl) geneNamesEl.checked = defaultSettings.searchGeneNames;
    if (sequenceEl) sequenceEl.checked = defaultSettings.searchSequence;
    if (featuresEl) featuresEl.checked = defaultSettings.searchFeatures;
    if (proteinEl) proteinEl.checked = defaultSettings.searchProtein;

    // Reset advanced options
    const minLengthEl = document.getElementById('searchMinLength');
    const maxResultsEl = document.getElementById('searchMaxResults');
    const timeoutEl = document.getElementById('searchTimeout');

    if (minLengthEl) minLengthEl.value = defaultSettings.minLength;
    if (maxResultsEl) maxResultsEl.value = defaultSettings.maxResults;
    if (timeoutEl) timeoutEl.value = defaultSettings.timeout;

    // Reset display options
    const highlightEl = document.getElementById('searchHighlightMatches');
    const showContextEl = document.getElementById('searchShowContext');
    const contextLengthEl = document.getElementById('searchContextLength');

    if (highlightEl) highlightEl.checked = defaultSettings.highlightMatches;
    if (showContextEl) showContextEl.checked = defaultSettings.showContext;
    if (contextLengthEl) contextLengthEl.value = defaultSettings.contextLength;

    // Reset history options
    const saveHistoryEl = document.getElementById('searchSaveHistory');
    const historyLimitEl = document.getElementById('searchHistoryLimit');

    if (saveHistoryEl) saveHistoryEl.checked = defaultSettings.saveHistory;
    if (historyLimitEl) historyLimitEl.value = defaultSettings.historyLimit;
  }

  /**
   * Initialize modal drag and resize functionality
   */
  initializeModalDragResize(modal, modalContent) {
    let isDragging = false;
    let isResizing = false;
    let startX;
    let startY;
    let startWidth;
    let startHeight;

    // Drag functionality
    const header = modalContent.querySelector('.modal-header');
    if (header) {
      header.addEventListener('mousedown', e => {
        if (e.target.classList.contains('modal-close')) return;

        isDragging = true;
        modalContent.classList.add('dragging');

        const rect = modalContent.getBoundingClientRect();
        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;

        e.preventDefault();
      });
    }

    // Resize functionality - use a more robust approach
    const handleResizeStart = e => {
      console.log('Resize started on element:', e.target);
      console.log('Resize started at position:', { x: e.clientX, y: e.clientY });
      isResizing = true;
      modalContent.classList.add('resizing');

      const rect = modalContent.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startWidth = rect.width;
      startHeight = rect.height;

      console.log('Resize start values:', { startX, startY, startWidth, startHeight });
      console.log('Modal content current styles:', {
        width: modalContent.style.width,
        height: modalContent.style.height,
        position: modalContent.style.position,
      });

      e.preventDefault();
      e.stopPropagation();
    };

    // Add resize handles with proper event listeners
    const resizeHandleRight = modalContent.querySelector('.resize-handle-right');
    const resizeHandleBottom = modalContent.querySelector('.resize-handle-bottom');
    const resizeHandleCorner = modalContent.querySelector('.resize-handle-corner');

    console.log('Resize handles found:', {
      rightHandle: !!resizeHandleRight,
      bottomHandle: !!resizeHandleBottom,
      cornerHandle: !!resizeHandleCorner,
    });

    if (resizeHandleRight) {
      resizeHandleRight.addEventListener('mousedown', handleResizeStart);
      console.log('Right handle event listener added');
    }

    if (resizeHandleBottom) {
      resizeHandleBottom.addEventListener('mousedown', handleResizeStart);
      console.log('Bottom handle event listener added');
    }

    if (resizeHandleCorner) {
      resizeHandleCorner.addEventListener('mousedown', handleResizeStart);
      console.log('Corner handle event listener added');
    }

    // Handle corner resize and edge detection
    modalContent.addEventListener('mousedown', e => {
      const rect = modalContent.getBoundingClientRect();
      const handleSize = 24;
      const edgeSize = 12;

      // Check if mouse is in corner resize area
      const isInCornerArea = e.clientX >= rect.right - handleSize && e.clientY >= rect.bottom - handleSize;

      // Check if mouse is in right edge resize area
      const isInRightEdge =
        e.clientX >= rect.right - edgeSize &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top + edgeSize &&
        e.clientY <= rect.bottom - edgeSize;

      // Check if mouse is in bottom edge resize area
      const isInBottomEdge =
        e.clientY >= rect.bottom - edgeSize &&
        e.clientY <= rect.bottom &&
        e.clientX >= rect.left + edgeSize &&
        e.clientX <= rect.right - edgeSize;

      if (isInCornerArea || isInRightEdge || isInBottomEdge) {
        handleResizeStart(e);
      }
    });

    // Mouse move handler
    const handleMouseMove = e => {
      if (isDragging) {
        const newX = e.clientX - startX;
        const newY = e.clientY - startY;

        // Constrain to viewport
        const maxX = window.innerWidth - modalContent.offsetWidth;
        const maxY = window.innerHeight - modalContent.offsetHeight;

        const constrainedX = Math.max(0, Math.min(newX, maxX));
        const constrainedY = Math.max(0, Math.min(newY, maxY));

        modalContent.style.position = 'fixed';
        modalContent.style.left = constrainedX + 'px';
        modalContent.style.top = constrainedY + 'px';
        modalContent.style.margin = '0';
        modalContent.style.transform = 'none';
      } else if (isResizing) {
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        // Apply constraints
        const minWidth = 800;
        const minHeight = 500;
        const maxWidth = window.innerWidth * 0.95;
        const maxHeight = window.innerHeight * 0.9;

        let newWidth = startWidth + deltaX;
        let newHeight = startHeight + deltaY;

        // Constrain dimensions
        newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
        newHeight = Math.max(minHeight, Math.min(newHeight, maxHeight));

        console.log('Resizing modal:', {
          deltaX,
          deltaY,
          startWidth,
          startHeight,
          newWidth,
          newHeight,
          minWidth,
          minHeight,
          maxWidth,
          maxHeight,
        });

        modalContent.style.width = newWidth + 'px';
        modalContent.style.height = newHeight + 'px';

        console.log('Applied styles:', {
          width: modalContent.style.width,
          height: modalContent.style.height,
        });
      }
    };

    // Mouse up handler
    const handleMouseUp = () => {
      if (isDragging || isResizing) {
        isDragging = false;
        isResizing = false;
        modalContent.classList.remove('dragging', 'resizing');

        // Save position and size
        this.saveModalPosition(modalContent);
      }
    };

    // Add event listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Clean up on modal close
    const cleanup = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      modal.removeEventListener('click', cleanup);
    };

    modal.addEventListener('click', e => {
      if (e.target.classList.contains('modal-close')) {
        cleanup();
      }
    });
  }

  /**
   * Load modal position and size from ConfigManager
   */
  loadModalPosition(modalContent) {
    const configManager = this.genomeBrowser.configManager;
    if (!configManager) return;

    const modalSettings = configManager.getModalSettings();
    const searchModalSettings = modalSettings.searchSettings || {};

    if (searchModalSettings.position) {
      modalContent.style.position = 'fixed';
      modalContent.style.left = searchModalSettings.position.x + 'px';
      modalContent.style.top = searchModalSettings.position.y + 'px';
      modalContent.style.margin = '0';
      modalContent.style.transform = 'none';
    }

    if (searchModalSettings.size && searchModalSettings.size.width && searchModalSettings.size.height) {
      // Only load saved size if it's valid and within constraints
      const minWidth = 800;
      const minHeight = 500;
      const maxWidth = window.innerWidth * 0.95;
      const maxHeight = window.innerHeight * 0.9;

      const savedWidth = Math.max(minWidth, Math.min(searchModalSettings.size.width, maxWidth));
      const savedHeight = Math.max(minHeight, Math.min(searchModalSettings.size.height, maxHeight));

      modalContent.style.width = savedWidth + 'px';
      modalContent.style.height = savedHeight + 'px';

      console.log('Loaded saved size:', { width: savedWidth, height: savedHeight });
    } else {
      console.log('No valid saved size found, using default');
    }
  }

  /**
   * Save modal position and size to ConfigManager
   */
  saveModalPosition(modalContent) {
    const configManager = this.genomeBrowser.configManager;
    if (!configManager) return;

    const rect = modalContent.getBoundingClientRect();
    const modalSettings = configManager.getModalSettings();

    modalSettings.searchSettings = {
      position: {
        x: rect.left,
        y: rect.top,
      },
      size: {
        width: rect.width,
        height: rect.height,
      },
    };

    configManager.setModalSettings(modalSettings);
  }

  /**
   * Clean up NavigationManager resources
   */
  destroy() {
    // Clear any pending aligned reads redraw timeout
    if (this.alignedReadsRedrawTimeout) {
      clearTimeout(this.alignedReadsRedrawTimeout);
      this.alignedReadsRedrawTimeout = null;
    }

    // Remove event listeners
    document.removeEventListener('mousemove', this.handleDocumentMouseMove);
    document.removeEventListener('mouseup', this.handleDocumentMouseUp);
    document.removeEventListener('wheel', this.handleWheelZoom);

    console.log('🧹 [NavigationManager] Cleaned up resources');
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NavigationManager;
}
