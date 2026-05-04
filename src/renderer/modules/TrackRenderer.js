/**
 * TrackRenderer - Handles all track creation and visualization
 * Optimized with improved function calling structure and workflow
 */
class TrackRenderer {
  constructor(genomeBrowser) {
    this.genomeBrowser = genomeBrowser;

    // Canvas renderers for high-performance tracks
    this.canvasRenderers = new Map();

    // Track configuration for consistent styling and behavior
    this.trackConfig = {
      genes: {
        defaultHeight: '120px',
        header: 'Genes & Features',
        className: 'gene-track',
        requiresData: true,
        dataSource: 'currentAnnotations',
      },
      sequence: {
        defaultHeight: '30px',
        header: 'Bottom Sequence Panel',
        className: 'sequence-track',
        requiresData: true,
        dataSource: 'currentSequence',
      },
      sequenceLine: {
        defaultHeight: '30px',
        header: 'Single-line Sequence',
        className: 'sequence-line-track',
        requiresData: true,
        dataSource: 'currentSequence',
      },
      gc: {
        defaultHeight: '140px',
        header: 'GC Content & Skew',
        className: 'gc-track',
        requiresData: true,
        dataSource: 'currentSequence',
      },
      variants: {
        defaultHeight: '60px',
        header: 'VCF Variants',
        className: 'variant-track',
        requiresData: false,
        dataSource: 'currentVariants',
      },
      reads: {
        defaultHeight: '80px',
        header: 'Aligned Reads',
        className: 'reads-track',
        requiresData: false,
        dataSource: 'readsManager',
      },
      proteins: {
        defaultHeight: '80px',
        header: 'Proteins',
        className: 'protein-track',
        requiresData: true,
        dataSource: 'currentAnnotations',
      },
      wigTracks: {
        defaultHeight: '120px',
        header: 'WIG Tracks',
        className: 'wig-track',
        requiresData: false,
        dataSource: 'currentWIGTracks',
      },
      actions: {
        defaultHeight: '120px',
        header: 'Actions',
        className: 'actions-track',
        requiresData: false,
        dataSource: 'actionManager',
        actionHeight: 10, // Default action element height in pixels
      },
      blast: {
        defaultHeight: '100px',
        header: 'BLAST Results',
        className: 'blast-track',
        requiresData: false,
        dataSource: 'blastResults',
      },
    };

    // Track header visibility state - survives track recreation
    this.headerStates = new Map();

    // UI Element visibility states - persists across navigation
    this.elementVisibilityStates = {
      genesRuler: true,
      wigManagement: true,
      readsCoverage: true,
      readsReference: true,
      readsReads: true,
    };

    // Track settings storage
    this.trackSettings = {};

    // Common styles for reuse
    this.commonStyles = {
      noDataMessage: `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: #666;
                font-style: italic;
                font-size: 12px;
            `,
      statsElement: `
                position: absolute;
                top: 5px;
                right: 10px;
                background: rgba(255,255,255,0.9);
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 10px;
                color: #666;
                border: 1px solid #ddd;
            `,
    };
  }

  // ============================================================================
  // CORE TRACK CREATION METHODS
  // ============================================================================

  /**
   * Generic track factory method - reduces code duplication
   */
  createTrackBase(trackType, chromosome) {
    const config = this.trackConfig[trackType];
    if (!config) {
      throw new Error(`Unknown track type: ${trackType}`);
    }

    const track = document.createElement('div');
    track.className = config.className;

    const trackHeader = this.createTrackHeader(config.header, trackType);
    track.appendChild(trackHeader);

    const trackContent = this.createTrackContent(config.defaultHeight, chromosome);
    track.appendChild(trackContent);

    return { track, trackContent, config };
  }

  /**
   * Create standardized track header
   */
  createTrackHeader(title, trackType, fileId = null, isRenameable = false) {
    const trackHeader = document.createElement('div');
    trackHeader.className = 'track-header';

    // Store fileId for later reference
    if (fileId) {
      trackHeader.dataset.fileId = fileId;
    }

    // Create title element
    const titleElement = document.createElement('span');
    titleElement.className = 'track-title';

    if (isRenameable && fileId) {
      // Create editable title for file-specific tracks
      titleElement.textContent = title;
      titleElement.style.cursor = 'pointer';
      titleElement.title = 'Click to rename';

      titleElement.addEventListener('click', e => {
        e.stopPropagation();
        this.makeTrackTitleEditable(titleElement, fileId);
      });
    } else {
      titleElement.textContent = title;
    }

    trackHeader.appendChild(titleElement);

    // Add sampling percentage control for reads track
    if (trackType === 'reads') {
      const samplingContainer = document.createElement('div');
      samplingContainer.className = 'track-sampling-control';
      samplingContainer.style.cssText = `
                display: inline-flex;
                align-items: center;
                margin-left: 15px;
                gap: 5px;
                font-size: 12px;
                color: #666;
            `;

      const samplingLabel = document.createElement('span');
      samplingLabel.textContent = 'Sample:';
      samplingLabel.style.cssText = 'font-size: 11px; color: #888;';

      const samplingInput = document.createElement('select');
      samplingInput.className = 'track-sampling-input';
      samplingInput.style.cssText = `
                width: 60px;
                height: 20px;
                padding: 1px 2px;
                border: 1px solid #ddd;
                border-radius: 3px;
                font-size: 11px;
                background: white;
                cursor: pointer;
            `;

      // Get current sampling percentage from settings (instance-specific if fileId exists)
      const currentSettings = this.getTrackSettings('reads', fileId);
      const currentPct = currentSettings.samplingPercentage || 20;

      const presets = [1, 2, 5, 10, 20, 30, 50, 75, 100];
      presets.forEach(preset => {
        const option = document.createElement('option');
        option.value = preset;
        option.textContent = preset + '%';
        if (preset === currentPct) {
          option.selected = true;
        }
        samplingInput.appendChild(option);
      });

      // If current percentage is not in preset list, add it as a custom option
      if (!presets.includes(currentPct)) {
        const customOption = document.createElement('option');
        customOption.value = currentPct;
        customOption.textContent = currentPct + '%';
        customOption.selected = true;
        samplingInput.insertBefore(customOption, samplingInput.firstChild);
      }

      // Handle selection change
      samplingInput.addEventListener('change', e => {
        const percentage = parseInt(e.target.value);
        if (!isNaN(percentage)) {
          this.updateSamplingPercentage(percentage, fileId);
        }
      });

      samplingContainer.appendChild(samplingLabel);
      samplingContainer.appendChild(samplingInput);
      trackHeader.appendChild(samplingContainer);

      // --- Add toggle buttons for Reads track components ---
      const readsTogglesContainer = document.createElement('div');
      readsTogglesContainer.className = 'track-reads-toggles';
      readsTogglesContainer.style.cssText = `display: inline-flex; align-items: center; margin-left: 15px; gap: 4px;`;

      const coverageBtn = this.createReadsToggleButton('chart-area', 'Coverage', 'readsCoverage');
      readsTogglesContainer.appendChild(coverageBtn);

      const referenceBtn = this.createReadsToggleButton('dna', 'Reference', 'readsReference');
      readsTogglesContainer.appendChild(referenceBtn);

      const readsBtn = this.createReadsToggleButton('align-left', 'Reads', 'readsReads');
      readsTogglesContainer.appendChild(readsBtn);

      trackHeader.appendChild(readsTogglesContainer);
    }

    // Create buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'track-buttons';

    // ============================================================
    // BUTTON ORDER (optimized for usability):
    // 1. View/Info buttons (gallery, layout, ruler) - leftmost
    // 2. Action buttons (selection, settings)
    // 3. Control buttons (lock, hide header)
    // 4. Close/Hide button - rightmost (standard UI pattern)
    // ============================================================

    // === GROUP 1: View/Info buttons (track-specific, leftmost) ===

    // Add gallery button for Genes & Features track
    if (trackType === 'genes') {
      const galleryBtn = document.createElement('button');
      galleryBtn.className = 'track-btn track-gallery-btn';
      galleryBtn.innerHTML = '<i class="fas fa-images"></i>';
      galleryBtn.title = 'Feature Glyph Legend';
      galleryBtn.addEventListener('click', e => {
        e.stopPropagation();
        this.openFeatureGlyphLegend();
      });
      buttonsContainer.appendChild(galleryBtn);

      // Add layout mode toggle button
      const layoutBtn = document.createElement('button');
      layoutBtn.className = 'track-btn track-layout-btn';
      // Set initial icon based on current settings
      const currentLayout = this.getTrackSettings('genes').layoutMode || 'expanded';
      layoutBtn.innerHTML =
        currentLayout === 'compact' ? '<i class="fas fa-compress-alt"></i>' : '<i class="fas fa-expand-alt"></i>';
      layoutBtn.title = `Switch to ${currentLayout === 'compact' ? 'Expanded' : 'Compact'} Layout`;

      layoutBtn.addEventListener('click', e => {
        e.stopPropagation();
        this.toggleTrackLayout(trackType, layoutBtn);
      });
      buttonsContainer.appendChild(layoutBtn);

      // Add ruler toggle button
      const rulerBtn = document.createElement('button');
      rulerBtn.className = 'track-btn track-ruler-btn';
      rulerBtn.innerHTML = '<i class="fas fa-ruler-horizontal"></i>';
      rulerBtn.title = 'Show/Hide Ruler';

      // Set initial state based on persistent storage
      if (!this.elementVisibilityStates.genesRuler) {
        rulerBtn.classList.add('active');
        rulerBtn.style.color = '#ccc';
      }

      rulerBtn.addEventListener('click', e => {
        e.stopPropagation();
        // Find the track content and then the ruler container
        const trackElement = trackHeader.parentElement;
        const rulerContainer = trackElement.querySelector('.detailed-ruler-container');

        // Toggle state
        this.elementVisibilityStates.genesRuler = !this.elementVisibilityStates.genesRuler;

        if (rulerContainer) {
          if (this.elementVisibilityStates.genesRuler) {
            rulerContainer.style.display = 'block';
            rulerBtn.classList.remove('active');
            rulerBtn.style.color = '';
          } else {
            rulerContainer.style.display = 'none';
            rulerBtn.classList.add('active');
            rulerBtn.style.color = '#ccc';
          }
        }
      });
      buttonsContainer.appendChild(rulerBtn);

      // Add circular mode toggle button
      const circularBtn = document.createElement('button');
      circularBtn.className = 'track-btn track-circular-btn';
      const isCircular = this.getTrackSettings('genes').circularMode || false;
      circularBtn.innerHTML = isCircular
        ? '<i class="fas fa-circle-notch"></i>'
        : '<i class="fas fa-long-arrow-alt-right"></i>';
      circularBtn.title = isCircular
        ? 'Circular Mode: ON (click to disable)'
        : 'Circular Mode: OFF (click to enable for seamless wraparound navigation)';
      if (isCircular) {
        circularBtn.classList.add('active');
      }

      circularBtn.addEventListener('click', e => {
        e.stopPropagation();
        this.toggleCircularMode(circularBtn);
      });
      buttonsContainer.appendChild(circularBtn);
    }

    // Add WIG Track Management toggle button
    if (trackType === 'wigTracks') {
      const wiggleBtn = document.createElement('button');
      wiggleBtn.className = 'track-btn track-wiggle-btn';
      wiggleBtn.innerHTML = '<i class="fas fa-sliders-h"></i>';
      wiggleBtn.title = 'Toggle Management Interface';

      // Set initial state based on persistent storage
      if (!this.elementVisibilityStates.wigManagement) {
        wiggleBtn.classList.add('active');
        wiggleBtn.style.color = '#ccc';
      }

      wiggleBtn.addEventListener('click', e => {
        e.stopPropagation();

        // Find the management header
        const trackElement = trackHeader.parentElement;
        const managementHeader = trackElement.querySelector('.wig-management-header');

        // Toggle state
        this.elementVisibilityStates.wigManagement = !this.elementVisibilityStates.wigManagement;

        if (managementHeader) {
          if (this.elementVisibilityStates.wigManagement) {
            managementHeader.style.display = 'block';
            wiggleBtn.classList.remove('active');
            wiggleBtn.style.color = '';
          } else {
            managementHeader.style.display = 'none';
            wiggleBtn.classList.add('active');
            wiggleBtn.style.color = '#ccc';
          }
        }
      });
      buttonsContainer.appendChild(wiggleBtn);
    }

    // === GROUP 2: Action buttons ===

    // Add sequence selection button for Genes & Features track
    if (trackType === 'genes') {
      const selectionBtn = document.createElement('button');
      selectionBtn.className = 'track-btn track-selection-btn';
      selectionBtn.innerHTML = '<i class="fas fa-mouse-pointer"></i>';
      selectionBtn.title = 'Toggle sequence selection mode';
      selectionBtn.addEventListener('click', e => {
        e.stopPropagation();
        this.toggleSecondaryRulerSelection(trackType);
      });
      buttonsContainer.appendChild(selectionBtn);
    }

    // Settings button
    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'track-btn track-settings-btn';
    settingsBtn.innerHTML = '<i class="fas fa-cog"></i>';
    settingsBtn.title = 'Track Settings';
    settingsBtn.addEventListener('click', e => {
      e.stopPropagation();
      this.openTrackSettings(trackType, fileId);
    });
    buttonsContainer.appendChild(settingsBtn);

    // === GROUP 3: Control buttons ===

    // Toggle controls button
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'track-btn track-toggle-btn';
    toggleBtn.innerHTML = '<i class="fas fa-lock-open"></i>';
    toggleBtn.title = 'Lock/Unlock Track Controls';
    toggleBtn.dataset.locked = 'false';
    toggleBtn.addEventListener('click', e => {
      e.stopPropagation();
      console.log('Toggle button clicked for track:', trackType);
      try {
        this.toggleTrackControls(trackType, toggleBtn);
      } catch (error) {
        console.error('Error in toggleTrackControls:', error);
      }
    });
    buttonsContainer.appendChild(toggleBtn);

    // Hide header button
    const hideHeaderBtn = document.createElement('button');
    hideHeaderBtn.className = 'track-btn track-hide-header-btn';
    hideHeaderBtn.innerHTML = '<i class="fas fa-minus"></i>';
    hideHeaderBtn.title = 'Minimize Track Header';
    hideHeaderBtn.addEventListener('click', e => {
      e.stopPropagation();
      this.toggleTrackHeader(trackType, hideHeaderBtn);
    });
    buttonsContainer.appendChild(hideHeaderBtn);

    // === GROUP 4: Close/Hide button (rightmost - standard UI pattern) ===

    const closeBtn = document.createElement('button');
    closeBtn.className = 'track-btn track-close-btn';

    if (fileId) {
      // File-specific track - show remove icon and update functionality
      closeBtn.innerHTML = '<i class="fas fa-times"></i>';
      closeBtn.title = 'Remove Track';
      closeBtn.addEventListener('click', e => {
        e.stopPropagation();
        this.removeFileTrack(fileId, trackType);
      });
    } else {
      // Regular track - show hide icon
      closeBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
      closeBtn.title = 'Hide Track';
      closeBtn.addEventListener('click', e => {
        e.stopPropagation();
        this.closeTrack(trackType);
      });
    }
    buttonsContainer.appendChild(closeBtn);

    trackHeader.appendChild(buttonsContainer);

    return trackHeader;
  }

  /**
   * Create standardized track content container
   */
  createTrackContent(height, chromosome) {
    const trackContent = document.createElement('div');
    trackContent.className = 'track-content';
    trackContent.style.height = height;

    // Add draggable functionality
    this.genomeBrowser.makeDraggable(trackContent, chromosome);

    return trackContent;
  }

  /**
   * Create standardized no-data message
   */
  createNoDataMessage(message, className = 'no-data-message') {
    const noDataMsg = document.createElement('div');
    noDataMsg.className = className;
    noDataMsg.textContent = message;
    noDataMsg.style.cssText = this.commonStyles.noDataMessage;
    return noDataMsg;
  }

  /**
   * Create standardized statistics element
   */
  createStatsElement(text, className = 'track-stats', additionalStyles = '') {
    const statsElement = document.createElement('div');
    statsElement.className = className;
    statsElement.style.cssText = this.commonStyles.statsElement + additionalStyles;
    statsElement.textContent = text;
    return statsElement;
  }

  /**
   * Get current viewport data for consistent access
   */
  getCurrentViewport() {
    if (this.genomeBrowser && this.genomeBrowser.currentPosition) {
      const start = this.genomeBrowser.currentPosition.start || 0;
      const end = this.genomeBrowser.currentPosition.end || 1000;

      // Ensure start and end are valid numbers
      const validStart = typeof start === 'number' && !isNaN(start) ? start : 0;
      const validEnd = typeof end === 'number' && !isNaN(end) ? end : 1000;

      // Ensure end is greater than start
      const finalEnd = validEnd > validStart ? validEnd : validStart + 1000;

      return {
        start: validStart,
        end: finalEnd,
        range: finalEnd - validStart,
      };
    }
    // Fallback if genome browser is not available
    return { start: 0, end: 1000, range: 1000 };
  }

  /**
   * Save header visibility state before track recreation
   */
  saveHeaderStates() {
    const container = document.getElementById('genomeViewer');
    if (!container) return;

    const existingTracks = container.querySelectorAll('[class*="-track"]');
    existingTracks.forEach(track => {
      const trackHeader = track.querySelector('.track-header');
      if (trackHeader) {
        // Determine track type from class name
        let trackType = null;
        for (const className of track.classList) {
          if (className.endsWith('-track')) {
            trackType = className.replace('-track', '');

            // Map specific track class names to track types
            const typeMapping = {
              gene: 'genes',
              variant: 'variants',
              wig: 'wigTracks',
              'sequence-line': 'sequence-line', // Ensure consistency for sequence-line track
            };
            trackType = typeMapping[trackType] || trackType;
            break;
          }
        }

        if (trackType) {
          const isHidden = trackHeader.style.display === 'none';
          this.headerStates.set(trackType, isHidden);
          console.log(`Saved header state for ${trackType}: ${isHidden ? 'hidden' : 'visible'}`);
        }
      }
    });
  }

  /**
   * Restore header visibility state after track recreation
   */
  restoreHeaderState(trackElement, trackType) {
    // Update sampling input value for reads track
    if (trackType === 'reads') {
      this.updateSamplingInputValue(trackElement);
    }

    if (!this.headerStates.has(trackType)) {
      console.log(`🔧 [TrackRenderer] No saved header state found for track type: ${trackType}`);
      return;
    }

    const shouldBeHidden = this.headerStates.get(trackType);
    console.log(`🔧 [TrackRenderer] Restoring header state for ${trackType}: ${shouldBeHidden ? 'hidden' : 'visible'}`);
    if (!shouldBeHidden) return; // If not hidden, no need to restore

    const trackHeader = trackElement.querySelector('.track-header');
    const hideHeaderBtn = trackHeader?.querySelector('.track-hide-header-btn');

    if (trackHeader && hideHeaderBtn) {
      // Hide the header
      trackHeader.style.display = 'none';
      hideHeaderBtn.innerHTML = '<i class="fas fa-plus"></i>';
      hideHeaderBtn.title = 'Show Track Header';

      // Add floating button
      this.createFloatingHeaderButton(trackElement, trackType);

      // Adjust track content
      const trackContent = trackElement.querySelector('.track-content');
      if (trackContent) {
        trackContent.style.marginTop = '5px';
      }

      console.log(`Restored hidden header state for ${trackType}`);
    }
  }

  /**
   * Update sampling input value to match current settings
   */
  updateSamplingInputValue(trackElement) {
    const samplingInput = trackElement.querySelector('.track-sampling-input');
    if (samplingInput) {
      const currentSettings = this.getTrackSettings('reads');
      const currentPercentage = currentSettings.samplingPercentage || 20;
      if (parseInt(samplingInput.value) !== currentPercentage) {
        if (samplingInput.tagName === 'SELECT') {
          this.syncSamplingHeaderUI(currentPercentage);
        } else {
          samplingInput.value = currentPercentage;
        }
        console.log(`🎲 Updated sampling input value to ${currentPercentage}%`);
      }
    }
  }

  /**
   * Update sampling display based on whether sampling was applied
   * When sampling is not applied (reads below threshold), show 100%
   * @param {number} readsCount - The number of reads displayed
   * @param {boolean} isSampled - Whether sampling was applied (has _samplingInfo)
   */
  updateSamplingDisplayBasedOnReadsCount(readsCount, isSampled) {
    const currentSettings = this.getTrackSettings('reads');

    // Get the sampling control elements
    const readsTrack = document.querySelector('.reads-track');
    if (!readsTrack) return;

    const trackHeader = readsTrack.querySelector('.track-header');
    if (!trackHeader) return;

    const samplingLabel = trackHeader.querySelector('.track-sampling-control span:first-child');
    const samplingInput = trackHeader.querySelector('.track-sampling-input');

    if (!isSampled) {
      // Sampling was NOT applied (reads count <= threshold) - show 100% and disable controls
      console.log(`🎲 [TrackRenderer] Reads count (${readsCount}) is below threshold, showing 100%`);
      if (samplingLabel) {
        samplingLabel.textContent = 'Sample:';
        samplingLabel.style.color = '#888';
      }
      if (samplingInput) {
        samplingInput.value = 100;
        samplingInput.disabled = true;
        samplingInput.style.background = '#f0f0f0';
        samplingInput.style.cursor = 'not-allowed';
      }

      // Update select to show 100% as active
      this.syncSamplingHeaderUI(100);
    } else {
      // Sampling WAS applied (reads count > threshold) - enable controls and show actual percentage
      console.log(`🎲 [TrackRenderer] Sampling applied, showing ${currentSettings.samplingPercentage || 20}%`);
      if (samplingLabel) {
        samplingLabel.textContent = 'Sample:';
        samplingLabel.style.color = '#888';
      }
      if (samplingInput) {
        // Set value via syncSamplingHeaderUI to handle custom values
        this.syncSamplingHeaderUI(currentSettings.samplingPercentage || 20);
        samplingInput.disabled = false;
        samplingInput.style.background = 'white';
        samplingInput.style.cursor = 'pointer';
      }
    }
  }

  /**
   * Filter features by current viewport with validation
   */
  filterFeaturesByViewport(features, viewport) {
    if (!Array.isArray(features)) return [];

    return features.filter(
      feature =>
        feature && feature.start && feature.end && feature.start <= viewport.end && feature.end >= viewport.start
    );
  }

  // ============================================================================
  // SPECIFIC TRACK IMPLEMENTATIONS
  // ============================================================================

  createGeneTrack(chromosome) {
    const { track, trackContent } = this.createTrackBase('genes', chromosome);
    const viewport = this.getCurrentViewport();

    // Get track settings
    const settings = this.getTrackSettings('genes');
    console.log('Retrieved gene track settings:', settings);

    // Add detailed ruler for current viewing region
    const detailedRuler = this.createDetailedRuler(chromosome);
    trackContent.appendChild(detailedRuler);

    // Add sequence display if enabled
    if (settings.showSequence) {
      const sequenceHeight = settings.sequenceHeight || 25;
      this.createGenesSequenceVisualization(trackContent, viewport, sequenceHeight, settings);
    }

    // Get and validate data
    const annotations = this.genomeBrowser.currentAnnotations[chromosome] || [];
    const operons = this.genomeBrowser.detectOperons(annotations, chromosome);
    console.log(`Detected ${operons.length} operons in chromosome ${chromosome}`);

    // Filter genes using the new helper method
    const visibleGenes = this.filterGeneAnnotations(annotations, viewport);
    console.log(`Displaying ${visibleGenes.length} genes/features in region ${viewport.start}-${viewport.end}`);

    if (visibleGenes.length === 0) {
      const noGenesMsg = this.createNoDataMessage(
        'No genes/features in this region or all filtered out',
        'no-genes-message'
      );
      trackContent.appendChild(noGenesMsg);
      trackContent.style.height = '80px';
      return track;
    }

    // Process and render genes with settings (includes statistics in unified container)
    this.renderGeneElements(trackContent, visibleGenes, viewport, operons, settings);

    // Restore header state if it was previously hidden
    this.restoreHeaderState(track, 'genes');

    return track;
  }

  /**
   * Create a separate annotation track for a specific annotation set
   */
  createAnnotationTrack(chromosome, annotationTrack) {
    const viewport = this.getCurrentViewport();

    // Create track base directly (similar to createSingleVariantTrack)
    const track = document.createElement('div');
    track.className = 'gene-track'; // Reuse gene track styling
    track.dataset.trackId = annotationTrack.id;

    // Get per-instance settings
    const settings = this.getTrackSettings('genes', annotationTrack.id);

    // Create track header
    const trackHeader = this.createTrackHeader(
      annotationTrack.name,
      'genes', // Use genes track type for header functionality
      annotationTrack.id
    );
    track.appendChild(trackHeader);

    // Create track content
    const trackContent = this.createTrackContent(settings.height || this.trackConfig.genes?.defaultHeight || 120, chromosome);
    track.appendChild(trackContent);

    // Add detailed ruler for current viewing region
    const detailedRuler = this.createDetailedRuler(chromosome);
    trackContent.appendChild(detailedRuler);

    // Get annotations for this track and chromosome
    const annotations = annotationTrack.annotations[chromosome] || [];

    // Filter annotations using the gene annotation filter (reuse existing logic)
    const visibleAnnotations = this.filterGeneAnnotations(annotations, viewport);
    console.log(
      `Displaying ${visibleAnnotations.length} annotations in track ${annotationTrack.name} for region ${viewport.start}-${viewport.end}`
    );

    if (visibleAnnotations.length === 0) {
      const noDataMsg = this.createNoDataMessage(
        `No annotations in this region for track ${annotationTrack.name}`,
        'no-annotations-message'
      );
      trackContent.appendChild(noDataMsg);
      trackContent.style.height = '80px';
      return track;
    }

    // Process and render annotations with settings
    // Use instance-specific settings already fetched above, apply custom track color
    const customSettings = {
      ...settings,
      trackColor: annotationTrack.color,
    };

    // Render annotations using existing gene rendering logic
    this.renderGeneElements(trackContent, visibleAnnotations, viewport, [], customSettings);

    // Add track-specific styling
    trackContent.style.borderLeft = `4px solid ${annotationTrack.color}`;

    // Restore header state if it was previously hidden
    this.restoreHeaderState(track, 'genes'); // Use genes for header state management

    return track;
  }

  /**
   * Create BLAST Results track with SVG rendering
   */
  createBlastTrack(chromosome) {
    const { track, trackContent } = this.createTrackBase('blast', chromosome);
    const viewport = this.getCurrentViewport();

    // Get track settings
    const settings = this.getTrackSettings('blast');

    // Add detailed ruler for current viewing region if enabled in settings
    if (settings.showRuler) {
      const detailedRuler = this.createDetailedRuler(chromosome);
      trackContent.appendChild(detailedRuler);
    }

    // Get all BLAST results for the chromosome, not just in the current range
    const allBlastResults = this.genomeBrowser.blastManager.getAllBlastResults(chromosome);

    if (!allBlastResults || allBlastResults.length === 0) {
      const noResultsMsg = this.createNoDataMessage(
        'No BLAST results available for this chromosome',
        'no-blast-results-message'
      );
      trackContent.appendChild(noResultsMsg);
      trackContent.style.height = `${settings.height}px`;
      return track;
    }

    // Filter results by viewport
    const visibleResults = this.filterBlastResultsByViewport(allBlastResults, viewport);
    const outOfViewResults = allBlastResults.filter(result => {
      const resultStart = result.hitRange.from;
      const resultEnd = result.hitRange.to;
      return !(resultStart <= viewport.end && resultEnd >= viewport.start);
    });

    console.log(
      `Displaying ${visibleResults.length} BLAST results in region ${viewport.start}-${viewport.end}, ${outOfViewResults.length} results outside view`
    );

    // Create main container for all blast results content
    const mainContainer = document.createElement('div');
    mainContainer.className = 'blast-results-container';
    mainContainer.style.cssText = `
            position: relative;
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 8px;
        `;

    // Create container for visible blast results
    const visibleContainer = document.createElement('div');
    visibleContainer.className = 'visible-blast-results';
    visibleContainer.style.position = 'relative';

    // Display out-of-view results information if there are any
    if (outOfViewResults.length > 0) {
      const outOfViewInfo = document.createElement('div');
      outOfViewInfo.className = 'blast-out-of-view-info';
      outOfViewInfo.style.cssText = `
                position: absolute;
                top: 2px;
                left: 10px;
                background: rgba(255, 255, 255, 0.9);
                padding: 2px 8px;
                border-radius: 10px;
                font-size: 10px;
                color: #666;
                border: 1px solid #ddd;
                z-index: 15;
            `;
      outOfViewInfo.textContent = `${outOfViewResults.length} result(s) outside current view`;
      visibleContainer.appendChild(outOfViewInfo);
    }

    if (visibleResults.length === 0) {
      const noResultsMsg = this.createNoDataMessage('No BLAST results in this region', 'no-blast-results-message');
      visibleContainer.appendChild(noResultsMsg);
    } else {
      // Process and render blast results with settings
      this.renderBlastElements(visibleContainer, visibleResults, viewport, settings);
    }

    mainContainer.appendChild(visibleContainer);

    // Handle out-of-view results section
    if (outOfViewResults.length > 0) {
      const outOfViewSection = this.createOutOfViewBlastSection(outOfViewResults, viewport, chromosome);
      mainContainer.appendChild(outOfViewSection);
    }

    trackContent.appendChild(mainContainer);

    // Set track height based on content
    const totalHeight = Math.max(mainContainer.scrollHeight, settings.height);
    trackContent.style.height = `${totalHeight}px`;

    // Add statistics
    let statsText;
    if (outOfViewResults.length > 0) {
      statsText = `${visibleResults.length} in view, ${outOfViewResults.length} out of view`;
    } else {
      statsText = `${visibleResults.length} BLAST results visible`;
    }
    const statsElement = this.createStatsElement(statsText, 'blast-track-stats');
    trackContent.appendChild(statsElement);

    // Restore header state if it was previously hidden
    this.restoreHeaderState(track, 'blast');

    return track;
  }

  /**
   * Create section for out-of-view BLAST results with navigation options
   */
  createOutOfViewBlastSection(outOfViewResults, viewport, chromosome) {
    const container = document.createElement('div');
    container.className = 'out-of-view-blast-section';
    container.style.cssText = `
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            padding: 8px 12px;
            margin-top: 4px;
        `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
            font-weight: 600;
            font-size: 12px;
            color: #495057;
            margin-bottom: 6px;
        `;
    header.textContent = `${outOfViewResults.length} BLAST result(s) outside current view:`;
    container.appendChild(header);

    // Results list
    outOfViewResults.forEach((result, index) => {
      const resultElement = this.createOutOfViewBlastItem(result, viewport, chromosome);
      container.appendChild(resultElement);
    });

    return container;
  }

  /**
   * Create individual BLAST result item for out-of-view results
   */
  createOutOfViewBlastItem(result, viewport, chromosome) {
    const resultStart = result.hitRange.from;
    const resultEnd = result.hitRange.to;
    const resultLength = Math.abs(resultEnd - resultStart) + 1;

    const item = document.createElement('div');
    item.className = 'out-of-view-blast-item';
    item.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 4px 8px;
            margin-bottom: 2px;
            background: white;
            border-radius: 3px;
            font-size: 11px;
            border-left: 3px solid #3b82f6;
        `;

    // Result info
    const info = document.createElement('div');
    info.style.cssText = `
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 2px;
        `;

    const resultName = document.createElement('div');
    resultName.style.cssText = `
            font-weight: 500;
            color: #2d3748;
        `;
    resultName.textContent = result.accession || 'Unknown accession';

    const resultDetails = document.createElement('div');
    resultDetails.style.cssText = `
            font-size: 10px;
            color: #6b7280;
        `;
    resultDetails.textContent = `${result.description || 'No description'}`;

    const resultPosition = document.createElement('div');
    resultPosition.style.cssText = `
            font-size: 10px;
            color: #6b7280;
        `;
    resultPosition.textContent = `${chromosome}:${resultStart}-${resultEnd} (${resultLength} bp)`;

    info.appendChild(resultName);
    info.appendChild(resultDetails);
    info.appendChild(resultPosition);

    // Navigation button
    const navButton = document.createElement('button');
    navButton.className = 'blast-nav-btn';
    navButton.innerHTML = '<i class="fas fa-eye"></i> View';
    navButton.style.cssText = `
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 3px;
            padding: 4px 8px;
            font-size: 10px;
            cursor: pointer;
            transition: background-color 0.2s;
        `;
    navButton.title = `Jump to ${chromosome}:${resultStart}-${resultEnd}`;

    // Add click event to jump to this result
    navButton.addEventListener('click', e => {
      e.stopPropagation();
      // Calculate appropriate viewport to show the result
      const viewportSize = viewport.end - viewport.start;
      const newStart = Math.max(0, Math.min(resultStart - viewportSize / 3, resultEnd - viewportSize));
      const newEnd = newStart + viewportSize;

      // Navigate to the new position
      this.genomeBrowser.currentPosition = { start: newStart, end: newEnd };
      if (this.genomeBrowser.currentSequence && this.genomeBrowser.currentSequence[chromosome]) {
        this.genomeBrowser.displayGenomeView(chromosome, this.genomeBrowser.currentSequence[chromosome]);
        if (this.genomeBrowser.genomeNavigationBar) {
          this.genomeBrowser.genomeNavigationBar.update();
        }
        if (this.genomeBrowser.tabManager) {
          this.genomeBrowser.tabManager.updateCurrentTabPosition(chromosome, newStart + 1, newEnd, { source: 'navigation' });
        }
      }
    });

    // Add click event to show result details
    item.addEventListener('click', e => {
      if (e.target !== navButton && !navButton.contains(e.target)) {
        this.genomeBrowser.blastManager.showResultDetails(result);
      }
    });

    item.appendChild(info);
    item.appendChild(navButton);

    return item;
  }

  /**
   * Filter BLAST results by viewport
   */
  filterBlastResultsByViewport(results, viewport) {
    return results.filter(result => {
      const resultStart = result.hitRange.from;
      const resultEnd = result.hitRange.to;
      return resultStart <= viewport.end && resultEnd >= viewport.start;
    });
  }

  /**
   * Render BLAST elements with improved organization
   */
  renderBlastElements(trackContent, visibleResults, viewport, settings) {
    console.log(`🔍 [BLAST Render] Rendering ${visibleResults.length} BLAST results`);
    console.log(
      `🔍 [BLAST Render] Viewport: ${viewport.start}-${viewport.end} (range: ${viewport.end - viewport.start})`
    );

    // Create SVG container
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    // Ensure SVG takes full width of track content, with proper positioning
    // Calculate SVG width properly - ensure it's always positive
    const containerWidth = trackContent.offsetWidth || 800; // Fallback to 800px if offsetWidth is 0
    const svgWidth = Math.max(0, containerWidth - 10); // Ensure positive width
    const svgHeight = settings.height || 120; // Use track height from settings

    console.log(`🔍 [BLAST Render] SVG dimensions: ${svgWidth}x${svgHeight}`);

    // Set SVG attributes - only set viewBox if width is positive
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', svgHeight);
    if (svgWidth > 0) {
      svg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
    }
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('class', 'blast-results-svg');

    // Position SVG correctly based on ruler visibility
    const svgTop = settings.showRuler ? '35px' : '0px';

    svg.style.cssText = `
            position: absolute;
            top: ${svgTop};
            left: 0;
            width: 100%;
            height: ${svgHeight}px;
        `;

    // Create defs for gradients and filters
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svg.appendChild(defs);

    // Create blast gradient
    const blastGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    blastGradient.setAttribute('id', 'blast-gradient');
    blastGradient.setAttribute('x1', '0%');
    blastGradient.setAttribute('y1', '0%');
    blastGradient.setAttribute('x2', '100%');
    blastGradient.setAttribute('y2', '100%');

    const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', '#3b82f6');

    const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', '#1e40af');

    blastGradient.appendChild(stop1);
    blastGradient.appendChild(stop2);
    defs.appendChild(blastGradient);

    // Calculate scale factor and position
    const viewportWidth = viewport.end - viewport.start;
    // Ensure scale factor is always positive and reasonable
    const scaleFactor = viewportWidth > 0 ? svgWidth / viewportWidth : 0.08; // Default to 0.08 if viewportWidth is 0

    // Determine if we're zoomed in enough to show detailed alignment
    const isZoomedIn = viewportWidth < 500; // Show detailed info when viewport is less than 500 bp

    console.log(
      `🔍 [BLAST Render] Scale factor: ${scaleFactor}, Zoom level: ${viewportWidth} bp, Show detailed alignment: ${isZoomedIn}`
    );

    // Render each blast result
    visibleResults.forEach((result, index) => {
      // Get raw start and end positions
      let resultStart = result.hitRange.from;
      let resultEnd = result.hitRange.to;

      // Determine hit direction for BLAST results
      // For reverse alignments (start > end), arrow should point left
      // For BLAST results, we rely solely on hitRange comparison since strand property is not available
      const isForward = resultStart < resultEnd;

      // For reverse alignments, we need to swap start and end for proper width calculation
      // while maintaining the direction indicator
      let actualStart = resultStart;
      let actualEnd = resultEnd;
      if (resultStart > resultEnd) {
        // Reverse alignment - swap start and end for position calculation
        actualStart = resultEnd;
        actualEnd = resultStart;
      }

      const resultWidth = actualEnd - actualStart;

      console.log(
        `🔍 [BLAST Render] Result ${index}: ${resultStart}-${resultEnd} (actual: ${actualStart}-${actualEnd}, width: ${resultWidth}, direction: ${isForward ? 'Forward' : 'Reverse'})`
      );

      // Calculate x position and width
      // Ensure result is within viewport bounds
      const visibleStart = Math.max(actualStart, viewport.start);
      const visibleEnd = Math.min(actualEnd, viewport.end);
      const visibleWidth = visibleEnd - visibleStart;

      // Calculate x position and width - ensure they are positive
      const x = Math.max(0, (visibleStart - viewport.start) * scaleFactor);
      const width = Math.max(5, visibleWidth * scaleFactor); // Minimum width of 5px

      console.log(`🔍 [BLAST Render] Result ${index} rendered as: x=${x}, width=${width}`);

      // Use a different row for each result to avoid overlapping
      // Adjust Y position based on ruler visibility
      const y = (index % 5) * settings.resultSpacing;
      // Increase result height for better visibility
      const height = Math.max(settings.resultHeight || 12, 15);

      // Create blast result with direction indicator
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');

      if (width > 10) {
        // For longer hits, create an arrow shape
        const arrowSize = Math.min(height * 0.8, 15);

        // Create arrow path
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        let pathData;

        if (isForward) {
          // Forward arrow (pointing right)
          pathData = `M ${x} ${y}
                               L ${x + width - arrowSize} ${y}
                               L ${x + width} ${y + height / 2}
                               L ${x + width - arrowSize} ${y + height}
                               L ${x} ${y + height}
                               Z`;
        } else {
          // Reverse arrow (pointing left)
          pathData = `M ${x + arrowSize} ${y}
                               L ${x + width} ${y}
                               L ${x + width} ${y + height}
                               L ${x + arrowSize} ${y + height}
                               L ${x} ${y + height / 2}
                               Z`;
        }

        path.setAttribute('d', pathData);
        path.setAttribute('fill', 'url(#blast-gradient)');
        path.setAttribute('stroke', '#1e3a8a');
        path.setAttribute('stroke-width', '1');
        group.appendChild(path);
      } else {
        // For very short hits, use a triangle
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        let pathData;

        if (isForward) {
          // Forward triangle (pointing right)
          pathData = `M ${x} ${y}
                               L ${x + width} ${y + height / 2}
                               L ${x} ${y + height}
                               Z`;
        } else {
          // Reverse triangle (pointing left)
          pathData = `M ${x + width} ${y}
                               L ${x} ${y + height / 2}
                               L ${x + width} ${y + height}
                               Z`;
        }

        path.setAttribute('d', pathData);
        path.setAttribute('fill', 'url(#blast-gradient)');
        path.setAttribute('stroke', '#1e3a8a');
        path.setAttribute('stroke-width', '1');
        group.appendChild(path);
      }

      // Add tooltip with result information
      const tooltip = `${result.accession} - ${result.description}\nScore: ${result.score}, E-value: ${result.evalue}\nIdentity: ${result.identity}%, Coverage: ${result.coverage}%\nDirection: ${isForward ? 'Forward' : 'Reverse'}`;

      // Add title element for tooltip
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = tooltip;
      group.appendChild(title);

      // Add click event to show detailed information
      group.addEventListener('click', () => {
        this.genomeBrowser.blastManager.showResultDetails(result);
      });

      // Add detailed alignment information if zoomed in enough
      if (isZoomedIn && width > 20) {
        // Create text element for alignment information
        const alignmentText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        // Use smaller font for alignment info
        const fontSize = Math.max(8, Math.min(width / 10, 12));

        // Calculate position below the blast result
        const textX = x + 5;
        const textY = y + height + fontSize + 5;

        // Use identity as alignment detail for now - can be extended to show actual alignment
        const alignmentDetail = result.identity ? `${result.identity}% identity` : 'Alignment';

        alignmentText.setAttribute('x', textX);
        alignmentText.setAttribute('y', textY);
        alignmentText.setAttribute('fill', '#374151');
        alignmentText.setAttribute('font-size', fontSize);
        alignmentText.setAttribute('font-family', 'Arial, sans-serif');
        alignmentText.setAttribute('font-weight', 'bold');
        alignmentText.textContent = alignmentDetail;

        // Add title for more detailed info
        const alignmentTooltip = `${result.accession}\n${result.description}\nScore: ${result.score}\nE-value: ${result.evalue}\nIdentity: ${result.identity}%\nCoverage: ${result.coverage}%\n${result.alignments?.[0]?.alignment || 'Detailed alignment available'}`;

        const alignmentTitle = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        alignmentTitle.textContent = alignmentTooltip;
        alignmentText.appendChild(alignmentTitle);

        group.appendChild(alignmentText);
      }

      svg.appendChild(group);
    });

    // Add SVG to track content
    trackContent.appendChild(svg);
  }

  /**
   * Filter gene annotations with type validation
   * Supports circular mode where viewport can wrap around sequence boundary
   */
  filterGeneAnnotations(annotations, viewport) {
    const validTypes = [
      'gene',
      'CDS',
      'mRNA',
      'tRNA',
      'rRNA',
      'misc_feature',
      'regulatory',
      'promoter',
      'terminator',
      'repeat_region',
      'comment',
      'note',
      'BED_feature',
    ];

    const settings = this.getTrackSettings('genes');
    const isCircular = settings.circularMode || false;

    return annotations
      .filter(feature => {
        return (
          (validTypes.includes(feature.type) || feature.type.includes('RNA')) &&
          this.genomeBrowser.shouldShowGeneType(feature.type)
        );
      })
      .filter(gene => {
        if (isCircular) {
          return this.isFeatureVisibleCircular(gene, viewport);
        }
        return this.filterFeaturesByViewport([gene], viewport).length > 0;
      });
  }

  /**
   * Check if a feature is visible in circular mode
   * Handles wrapped viewport (when viewport.end > sequenceLength)
   */
  isFeatureVisibleCircular(gene, viewport) {
    const chromosome = this.genomeBrowser.currentChromosome;
    const sequence = this.genomeBrowser.currentSequence[chromosome];
    const seqLen = sequence ? sequence.length : 0;

    if (seqLen === 0) {
      return false;
    }

    // Unwrapped (normal) case - viewport doesn't cross origin
    if (viewport.end <= seqLen && viewport.start >= 0) {
      return gene.start < viewport.end && gene.end > viewport.start;
    }

    // Wrapped viewport: viewport spans from start to (end % seqLen) via origin
    // This happens when we've scrolled past the end or before the start
    const wrappedEnd = viewport.end % seqLen;
    const wrappedStart = viewport.start < 0 ? seqLen + viewport.start : viewport.start;

    // Feature visible if it's in the pre-origin region OR post-origin region
    // Pre-origin: gene overlaps with [wrappedStart, seqLen)
    const visibleInPreOrigin = gene.start < seqLen && gene.end >= wrappedStart;
    // Post-origin: gene overlaps with [0, wrappedEnd]
    const visibleInPostOrigin = gene.start < wrappedEnd && gene.end > 0;

    return visibleInPreOrigin || visibleInPostOrigin;
  }

  /**
   * Render gene elements with improved organization and unified dragging
   */
  renderGeneElements(trackContent, visibleGenes, viewport, operons, settings) {
    const geneRows = this.arrangeGenesInRows(visibleGenes, viewport.start, viewport.end, operons, settings);
    const layout = this.calculateGeneTrackLayout(geneRows, settings);

    // Calculate offset for gene elements if sequence is shown
    const sequenceOffset = settings.showSequence ? settings.sequenceHeight || 25 : 0;

    // Set calculated height including sequence space
    trackContent.style.height = `${Math.max(layout.totalHeight + sequenceOffset, 120)}px`;

    // Create unified draggable container for all gene track elements
    const unifiedContainer = document.createElement('div');
    unifiedContainer.className = 'unified-gene-container';
    unifiedContainer.style.cssText = `
            position: relative;
            width: 100%;
            height: 100%;
            top: ${sequenceOffset}px;
            left: 0;
        `;

    // Dispatch based on rendering mode
    if (settings.renderingMode === 'canvas') {
      this.renderGeneElementsCanvas(unifiedContainer, geneRows, viewport, layout, operons, settings);
    } else {
      // Create SVG-based gene visualization
      this.renderGeneElementsSVG(unifiedContainer, geneRows, viewport, operons, layout, settings);
    }

    // Add statistics and update operons panel
    this.addGeneTrackStatistics(trackContent, visibleGenes, operons, settings, layout);

    // Add the unified container to trackContent
    trackContent.appendChild(unifiedContainer);
  }

  /**
   * Create Canvas-based gene visualization
   */
  renderGeneElementsCanvas(container, geneRows, viewport, layout, operons, settings) {
    // Create or update Canvas renderer
    // Note: We use a lightweight wrapper or check if one exists for this container
    // Since the container is recreated on each render, we might need to be careful with resource management

    // Ensure container is empty or properly set up
    container.innerHTML = '';

    // Clean up any previous genes canvas renderer
    this.cleanupCanvasRenderer('genes');

    // We can instantiate the CanvasGenesRenderer directly
    // It handles its own canvas creation and lifecycle
    const renderer = new CanvasGenesRenderer(
      container,
      geneRows,
      viewport,
      layout,
      operons,
      settings,
      this.genomeBrowser
    );

    // Store reference for cleanup and updates
    this.canvasRenderers.set('genes', renderer);
  }

  /**
   * Create SVG-based gene visualization
   */
  renderGeneElementsSVG(trackContent, geneRows, viewport, operons, layout, settings) {
    // Force layout calculation to get accurate width
    trackContent.style.width = '100%';

    // Improved width calculation with better fallback to prevent distortion
    let searchWidth = 0;
    if (trackContent.getBoundingClientRect().width > 100) {
      searchWidth = trackContent.getBoundingClientRect().width;
    } else if (trackContent.offsetWidth > 100) {
      searchWidth = trackContent.offsetWidth;
    } else {
      // Fallback: try to find parent track-container or use window width
      const parent = trackContent.closest('.track-content') || trackContent.parentElement;
      if (parent && parent.getBoundingClientRect().width > 100) {
        searchWidth = parent.getBoundingClientRect().width;
      } else {
        // Last resort: window width minus approximate sidebar/padding
        searchWidth = window.innerWidth - 300; // Approx sidebar width
      }
    }
    const containerWidth = searchWidth || 800;

    // Create SVG container that fills width but preserves text aspect ratio
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    // Calculate SVG content height (excluding ruler)
    const svgContentHeight = layout.totalHeight - layout.rulerHeight;

    // Use 100% width to ensure it always fills the available space (User Request)
    // We use preserveAspectRatio="none" to allow exact fitting, but we rely on
    // accurate containerWidth for the viewBox to minimize distortion.
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', svgContentHeight);
    svg.setAttribute('viewBox', `0 0 ${containerWidth} ${svgContentHeight}`);
    svg.setAttribute('preserveAspectRatio', 'none'); // Safe now because width matches viewBox width
    svg.setAttribute('class', 'genes-svg-container');
    svg.style.position = 'relative';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.pointerEvents = 'all';

    // Create definitions for gradients and patterns
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    this.createSpecializedGradients(defs); // Add specialized gradients for different gene types
    svg.appendChild(defs);

    // Create gene elements as SVG paths/rectangles
    geneRows.forEach((rowGenes, rowIndex) => {
      if (rowIndex >= layout.maxRows) return; // Skip hidden rows

      rowGenes.forEach(gene => {
        const geneGroup = this.createSVGGeneElement(
          gene,
          viewport,
          operons,
          rowIndex,
          layout,
          settings,
          defs,
          containerWidth
        );
        if (geneGroup) {
          svg.appendChild(geneGroup);
        }
      });
    });

    trackContent.appendChild(svg);
  }

  /**
   * Create individual SVG gene element
   */
  createSVGGeneElement(gene, viewport, operons, rowIndex, layout, settings, defs, containerWidth) {
    // Handle circular mode positioning
    const isCircular = settings.circularMode || false;
    const chromosome = this.genomeBrowser.currentChromosome;
    const sequence = this.genomeBrowser.currentSequence[chromosome];
    const seqLen = sequence ? sequence.length : 0;

    let adjustedGeneStart = gene.start;
    let adjustedGeneEnd = gene.end;

    // In circular mode, adjust gene positions for viewport that wraps around
    if (isCircular && seqLen > 0) {
      // Check if viewport wraps around (end > seqLen or start < 0)
      if (viewport.end > seqLen) {
        // Viewport wraps from end to start
        const wrappedEnd = viewport.end % seqLen;

        // Case 1: Gene entirely in post-origin region [0, wrappedEnd]
        if (gene.start < wrappedEnd && gene.end <= wrappedEnd) {
          adjustedGeneStart = gene.start + seqLen;
          adjustedGeneEnd = gene.end + seqLen;
        }
        // Case 2: Gene spans origin (start > wrappedEnd, end <= wrappedEnd)
        // This means gene.start is near seqLen and gene.end is near 0
        else if (gene.start > wrappedEnd && gene.end <= wrappedEnd) {
          // Gene spans origin - shift the end portion to come after start
          adjustedGeneStart = gene.start;
          adjustedGeneEnd = gene.end + seqLen;
        }
        // Otherwise: Gene is entirely in pre-origin region, no adjustment needed
      } else if (viewport.start < 0) {
        // Viewport wraps from start to end (scrolling left past origin)
        const wrappedStart = seqLen + viewport.start; // Convert negative to positive position

        // Case 1: Gene entirely in pre-origin region [wrappedStart, seqLen)
        if (gene.start >= wrappedStart && gene.end > wrappedStart) {
          adjustedGeneStart = gene.start - seqLen;
          adjustedGeneEnd = gene.end - seqLen;
        }
        // Case 2: Gene spans origin (start >= wrappedStart, end < wrappedStart)
        else if (gene.start >= wrappedStart && gene.end < wrappedStart) {
          // Gene spans origin - shift the start portion to come before end
          adjustedGeneStart = gene.start - seqLen;
          adjustedGeneEnd = gene.end;
        }
        // Otherwise: Gene is entirely in post-origin region, no adjustment needed
      }
    }

    // Calculate position and dimensions using adjusted coordinates
    const geneStart = Math.max(adjustedGeneStart, viewport.start);
    const geneEnd = Math.min(adjustedGeneEnd, viewport.end);
    const left = ((geneStart - viewport.start) / (viewport.end - viewport.start)) * 100;
    const width = ((geneEnd - geneStart) / (viewport.end - viewport.start)) * 100;

    // Check for meaningful overlap (allow small tolerance for floating-point precision)
    // Genes with width very close to 0 due to rounding should still be visible
    if (width < -0.001) return null;

    // Get positioning parameters - use accurate container width (no ruler offset in SVG)
    const y = layout.topPadding + rowIndex * (layout.geneHeight + layout.rowSpacing);
    const x = (left / 100) * containerWidth;
    // Determine minimum width based on gene type
    // Specialized shapes (promoters, etc.) behave like icons and need a larger minimum width
    // Regular genes should be allowed to shrink to trigger the simplified triangular mode
    // tRNA and rRNA should scale proportionally, so use smaller minimum width for them
    const geneType = gene.type ? gene.type.toLowerCase() : 'gene';
    const isSpecialized = this.shouldUseSpecializedShape(geneType);
    // RNA types and repeat regions should scale proportionally down to 1px
    const isSmallMinWidthType = ['trna', 'rrna', 'mrna', 'repeat_region'].includes(geneType);
    // Use 1px min for these types to allow proper scaling when zoomed out
    const minWidth = isSpecialized ? (isSmallMinWidthType ? 1 : 8) : 1;

    const elementWidth = Math.max((width / 100) * containerWidth, minWidth);
    const elementHeight = layout.geneHeight;

    // Check if gene is partially visible (truncated at left or right edges)
    // Use adjusted coordinates to properly handle circular mode wrapping
    const isLeftTruncated = adjustedGeneStart < viewport.start;
    const isRightTruncated = adjustedGeneEnd > viewport.end;

    // Create SVG group for the gene
    const geneGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    geneGroup.setAttribute('class', `svg-gene-element ${gene.type.toLowerCase()}`);
    geneGroup.setAttribute('transform', `translate(${x}, ${y})`);

    // Get operon information and color
    const operonInfo = this.genomeBrowser.getGeneOperonInfo(gene, operons);

    // Calculate zoom-based stroke width (consistent for all elements at same zoom level)
    // Base range for "normal" zoom (e.g., 10,000 bp = strokeWidth 1.5)
    const viewportRange = viewport.end - viewport.start;
    const baseRange = 10000;
    const zoomFactor = baseRange / viewportRange;
    // Cap stroke width at user-defined maximum (default 1)
    const maxStrokeWidth = settings.maxBorderWidth !== undefined ? settings.maxBorderWidth : 1;
    const strokeWidth = Math.min(maxStrokeWidth, Math.max(0.3, Math.min(2, 1.5 * zoomFactor)));

    // Create gradient for gene background
    const gradientId = `gene-gradient-${gene.start}-${gene.end}-${rowIndex}`;
    const gradient = this.createSVGGeneGradient(defs, gradientId, operonInfo.color);

    // Create gene shape based on strand direction and truncation state
    const geneShape = this.createSVGGeneShape(
      gene,
      elementWidth,
      elementHeight,
      gradientId,
      operonInfo,
      isLeftTruncated,
      isRightTruncated,
      strokeWidth
    );
    geneGroup.appendChild(geneShape);

    // Add gene text label if there's enough space
    if (elementWidth > 30) {
      const geneText = this.createSVGGeneText(gene, elementWidth, elementHeight, settings);
      if (geneText) {
        geneGroup.appendChild(geneText);
      }
    }

    // Add interaction handlers
    this.addSVGGeneInteraction(geneGroup, gene, operons, operonInfo, rowIndex);

    return geneGroup;
  }

  /**
   * Create SVG gradient for gene visualization
   */
  createSVGGeneGradient(defs, gradientId, baseColor) {
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gradient.setAttribute('id', gradientId);
    gradient.setAttribute('x1', '0%');
    gradient.setAttribute('y1', '0%');
    gradient.setAttribute('x2', '100%');
    gradient.setAttribute('y2', '100%');

    const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', baseColor);

    const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', this.lightenColor(baseColor, 20));

    gradient.appendChild(stop1);
    gradient.appendChild(stop2);
    defs.appendChild(gradient);

    return gradient;
  }

  /**
   * Create specialized gradients for different gene types
   */
  createSpecializedGradients(defs) {
    const gradients = [
      { id: 'promoter-gradient', color1: '#1e40af', color2: '#3b82f6' },
      { id: 'terminator-gradient', color1: '#7f1d1d', color2: '#dc2626' },
      { id: 'regulatory-gradient', color1: '#c2410c', color2: '#f97316' },
      { id: 'repeat-gradient', color1: '#374151', color2: '#6b7280' },
      { id: 'trna-gradient', color1: '#166534', color2: '#22c55e' },
      { id: 'rrna-gradient', color1: '#14532d', color2: '#16a34a' },
      { id: 'mrna-gradient', color1: '#15803d', color2: '#4ade80' },
      { id: 'comment-gradient', color1: '#7c3aed', color2: '#a855f7' },
    ];

    gradients.forEach(gradientDef => {
      const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
      gradient.setAttribute('id', gradientDef.id);
      gradient.setAttribute('x1', '0%');
      gradient.setAttribute('y1', '0%');
      gradient.setAttribute('x2', '100%');
      gradient.setAttribute('y2', '100%');

      const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stop1.setAttribute('offset', '0%');
      stop1.setAttribute('stop-color', gradientDef.color1);

      const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stop2.setAttribute('offset', '100%');
      stop2.setAttribute('stop-color', gradientDef.color2);

      gradient.appendChild(stop1);
      gradient.appendChild(stop2);
      defs.appendChild(gradient);
    });
  }

  /**
   * Create SVG shape for gene (with directional indicators based on size and specialized shapes by type)
   * @param {number} strokeWidth - Zoom-based stroke width for consistent borders
   */
  createSVGGeneShape(
    gene,
    width,
    height,
    gradientId,
    operonInfo,
    isLeftTruncated = false,
    isRightTruncated = false,
    strokeWidth = 1
  ) {
    const isForward = gene.strand !== -1;
    const geneType = gene.type.toLowerCase();

    // Create specialized shapes for specific gene types
    if (this.shouldUseSpecializedShape(geneType)) {
      return this.createSpecializedGeneShape(
        gene,
        width,
        height,
        gradientId,
        operonInfo,
        isLeftTruncated,
        isRightTruncated,
        strokeWidth
      );
    }

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    let pathData;

    if (width < 8) {
      // For small genes, use triangle shape as requested by user
      // Triangle width matches gene width exactly
      if (isForward) {
        // Forward triangle (pointing right)
        if (isLeftTruncated) {
          // Add jagged left edge
          pathData = this.createJaggedTrianglePath(width, height, true, false, isForward);
        } else if (isRightTruncated) {
          // Add jagged right edge
          pathData = this.createJaggedTrianglePath(width, height, false, true, isForward);
        } else {
          // Normal triangle - exact width match
          pathData = `M 0 0
                               L ${width} ${height / 2}
                               L 0 ${height}
                               Z`;
        }
      } else {
        // Reverse triangle (pointing left)
        if (isLeftTruncated) {
          // Add jagged left edge
          pathData = this.createJaggedTrianglePath(width, height, true, false, isForward);
        } else if (isRightTruncated) {
          // Add jagged right edge
          pathData = this.createJaggedTrianglePath(width, height, false, true, isForward);
        } else {
          // Normal triangle - exact width match
          pathData = `M ${width} 0
                               L 0 ${height / 2}
                               L ${width} ${height}
                               Z`;
        }
      }
      path.setAttribute(
        'class',
        `gene-triangle ${isLeftTruncated ? 'left-truncated' : ''} ${isRightTruncated ? 'right-truncated' : ''}`
      );
    } else {
      // For larger genes, use arrow shape with dynamic arrow size
      // Calculate appropriate arrow size based on gene width
      const arrowSize = Math.max(2, Math.min(width * 0.3, 15));

      if (isForward) {
        // Forward arrow (pointing right)
        if (isLeftTruncated) {
          // Add jagged left edge
          pathData = this.createJaggedArrowPath(width, height, arrowSize, true, false, isForward);
        } else if (isRightTruncated) {
          // Add jagged right edge (but keep arrow tip)
          pathData = this.createJaggedArrowPath(width, height, arrowSize, false, true, isForward);
        } else {
          // Normal forward arrow
          pathData = `M 0 0
                               L ${width - arrowSize} 0
                               L ${width} ${height / 2}
                               L ${width - arrowSize} ${height}
                               L 0 ${height}
                               Z`;
        }
      } else {
        // Reverse arrow (pointing left)
        if (isLeftTruncated) {
          // Add jagged left edge (but keep arrow tip)
          pathData = this.createJaggedArrowPath(width, height, arrowSize, true, false, isForward);
        } else if (isRightTruncated) {
          // Add jagged right edge
          pathData = this.createJaggedArrowPath(width, height, arrowSize, false, true, isForward);
        } else {
          // Normal reverse arrow
          pathData = `M ${arrowSize} 0
                               L ${width} 0
                               L ${width} ${height}
                               L ${arrowSize} ${height}
                               L 0 ${height / 2}
                               Z`;
        }
      }
      path.setAttribute(
        'class',
        `gene-arrow ${isLeftTruncated ? 'left-truncated' : ''} ${isRightTruncated ? 'right-truncated' : ''}`
      );
    }

    path.setAttribute('d', pathData);
    path.setAttribute('fill', `url(#${gradientId})`);

    // Use zoom-based stroke width (passed as parameter)
    if (strokeWidth > 0) {
      path.setAttribute('stroke', this.darkenColor(operonInfo.color, 20));
      path.setAttribute('stroke-width', strokeWidth.toString());
    } else {
      path.setAttribute('stroke', 'transparent');
      path.setAttribute('stroke-width', '0');
    }
    return path;
  }

  /**
   * Check if gene type should use specialized shape
   */
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

  /**
   * Create specialized shapes for specific gene types
   * @param {number} strokeWidth - Zoom-based stroke width for consistent borders
   */
  createSpecializedGeneShape(
    gene,
    width,
    height,
    gradientId,
    operonInfo,
    isLeftTruncated = false,
    isRightTruncated = false,
    strokeWidth = 1
  ) {
    const geneType = gene.type.toLowerCase();
    const isForward = gene.strand !== -1;

    switch (geneType) {
      case 'promoter':
        return this.createPromoterShape(
          width,
          height,
          'promoter-gradient',
          operonInfo,
          isLeftTruncated,
          isRightTruncated,
          isForward,
          strokeWidth
        );
      case 'terminator':
        return this.createTerminatorShape(
          width,
          height,
          'terminator-gradient',
          operonInfo,
          isLeftTruncated,
          isRightTruncated,
          isForward,
          strokeWidth
        );
      case 'regulatory':
        return this.createRegulatoryShape(
          width,
          height,
          'regulatory-gradient',
          operonInfo,
          isLeftTruncated,
          isRightTruncated,
          isForward,
          strokeWidth
        );
      case 'repeat_region':
        return this.createRepeatShape(
          width,
          height,
          'repeat-gradient',
          operonInfo,
          isLeftTruncated,
          isRightTruncated,
          isForward,
          strokeWidth
        );
      case 'trna':
        return this.createTRNAShape(
          width,
          height,
          'trna-gradient',
          operonInfo,
          isLeftTruncated,
          isRightTruncated,
          isForward,
          strokeWidth
        );
      case 'rrna':
        return this.createRRNAShape(
          width,
          height,
          'rrna-gradient',
          operonInfo,
          isLeftTruncated,
          isRightTruncated,
          isForward,
          strokeWidth
        );
      case 'mrna':
        return this.createMRNAShape(
          width,
          height,
          'mrna-gradient',
          operonInfo,
          isLeftTruncated,
          isRightTruncated,
          isForward,
          strokeWidth
        );
      case 'comment':
      case 'note':
      case 'misc_feature':
        return this.createCommentShape(
          width,
          height,
          'comment-gradient',
          operonInfo,
          isLeftTruncated,
          isRightTruncated,
          isForward,
          strokeWidth
        );
      default:
        // Fallback to regular arrow/triangle
        return null;
    }
  }

  /**
   * Create promoter shape - bent elbow arrow indicating transcription start
   * Design: A distinctive bent arrow (⌐ or ⌙ shape) that clearly shows direction
   * @param {number} strokeWidth - Zoom-based stroke width for consistent borders
   */
  createPromoterShape(
    width,
    height,
    gradientId,
    operonInfo,
    isLeftTruncated,
    isRightTruncated,
    isForward,
    strokeWidth = 1
  ) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute(
      'class',
      `gene-promoter ${isLeftTruncated ? 'left-truncated' : ''} ${isRightTruncated ? 'right-truncated' : ''}`
    );

    // Purple color scheme for promoter (matching reference)
    const fillColor = '#a855f7'; // Purple
    const strokeColor = '#7c3aed'; // Darker purple

    if (isLeftTruncated || isRightTruncated) {
      // For truncated promoters, use simplified jagged shape
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      let pathData;
      if (isLeftTruncated) {
        pathData = this.createJaggedPromoterPath(width, height, true, false);
      } else {
        pathData = this.createJaggedPromoterPath(width, height, false, true);
      }
      path.setAttribute('d', pathData);
      path.setAttribute('fill', fillColor);
      path.setAttribute('stroke', strokeColor);
      path.setAttribute('stroke-width', strokeWidth.toString());
      group.appendChild(path);
      return group;
    }

    // New design: Circle at origin + horizontal arrow extending upward
    // The arrow extends into negative Y space (above the element's bounding box)
    const circleRadius = Math.max(3, Math.min(height * 0.25, width * 0.15));
    const arrowThickness = Math.max(2, height * 0.15);
    const arrowHeadSize = Math.max(4, height * 0.3);

    // Upward extension amount (how far the arrow goes above y=0)
    const upwardExtension = height * 0.6;

    // Circle position (at the bottom, center of element width for origin point)
    const circleX = isForward ? circleRadius + 2 : width - circleRadius - 2;
    const circleY = height - circleRadius - 2;

    // Create the circle at the origin
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', circleX);
    circle.setAttribute('cy', circleY);
    circle.setAttribute('r', circleRadius);
    circle.setAttribute('fill', fillColor);
    circle.setAttribute('stroke', strokeColor);
    circle.setAttribute('stroke-width', strokeWidth.toString());
    group.appendChild(circle);

    // Create the arrow line (horizontal with arrowhead)
    // Arrow starts from circle, goes up briefly, then horizontally to the arrowhead
    const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const arrowY = -upwardExtension + height * 0.5; // Y position of arrow (extends upward)

    let arrowPathData;
    if (isForward) {
      // Arrow pointing right
      const arrowStartX = circleX;
      const arrowEndX = width - 2;

      arrowPathData = `
                M ${arrowStartX} ${circleY - circleRadius}
                L ${arrowStartX} ${arrowY}
                L ${arrowEndX - arrowHeadSize} ${arrowY}
                L ${arrowEndX - arrowHeadSize} ${arrowY - arrowHeadSize / 2}
                L ${arrowEndX} ${arrowY + arrowThickness / 2}
                L ${arrowEndX - arrowHeadSize} ${arrowY + arrowThickness + arrowHeadSize / 2}
                L ${arrowEndX - arrowHeadSize} ${arrowY + arrowThickness}
                L ${arrowStartX + arrowThickness} ${arrowY + arrowThickness}
                L ${arrowStartX + arrowThickness} ${circleY - circleRadius}
                Z
            `;
    } else {
      // Arrow pointing left
      const arrowStartX = circleX;
      const arrowEndX = 2;

      arrowPathData = `
                M ${arrowStartX} ${circleY - circleRadius}
                L ${arrowStartX} ${arrowY}
                L ${arrowEndX + arrowHeadSize} ${arrowY}
                L ${arrowEndX + arrowHeadSize} ${arrowY - arrowHeadSize / 2}
                L ${arrowEndX} ${arrowY + arrowThickness / 2}
                L ${arrowEndX + arrowHeadSize} ${arrowY + arrowThickness + arrowHeadSize / 2}
                L ${arrowEndX + arrowHeadSize} ${arrowY + arrowThickness}
                L ${arrowStartX - arrowThickness} ${arrowY + arrowThickness}
                L ${arrowStartX - arrowThickness} ${circleY - circleRadius}
                Z
            `;
    }

    arrowPath.setAttribute('d', arrowPathData);
    arrowPath.setAttribute('fill', fillColor);
    arrowPath.setAttribute('stroke', strokeColor);
    arrowPath.setAttribute('stroke-width', strokeWidth.toString());
    arrowPath.setAttribute('stroke-linejoin', 'round');
    group.appendChild(arrowPath);

    return group;
  }

  /**
   * Create terminator shape - T-shaped stem-loop/hairpin design
   * Design: A T-shaped form with a stem and a loop/ball at top, representing transcription termination
   * @param {number} strokeWidth - Zoom-based stroke width for consistent borders
   */
  createTerminatorShape(
    width,
    height,
    gradientId,
    operonInfo,
    isLeftTruncated,
    isRightTruncated,
    isForward,
    strokeWidth = 1
  ) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute(
      'class',
      `gene-terminator ${isLeftTruncated ? 'left-truncated' : ''} ${isRightTruncated ? 'right-truncated' : ''}`
    );

    // Red color scheme for terminator (matching reference)
    const fillColor = '#ef4444'; // Red
    const strokeColor = '#b91c1c'; // Darker red

    if (isLeftTruncated || isRightTruncated) {
      // For truncated terminators, use simplified jagged shape
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      let pathData;
      if (isLeftTruncated) {
        pathData = this.createJaggedTerminatorPath(width, height, true, false);
      } else {
        pathData = this.createJaggedTerminatorPath(width, height, false, true);
      }
      path.setAttribute('d', pathData);
      path.setAttribute('fill', fillColor);
      path.setAttribute('stroke', strokeColor);
      path.setAttribute('stroke-width', strokeWidth.toString());
      group.appendChild(path);
      return group;
    }

    // New design: Lollipop shape (vertical stem + filled circle at top)
    // The element extends into negative Y space (above the element's bounding box)
    const stemWidth = Math.max(2, width * 0.15);
    const circleRadius = Math.max(3, Math.min(height * 0.3, width * 0.25));

    // Upward extension amount
    const upwardExtension = height * 0.6;

    // Stem position (center of element width)
    const centerX = width / 2;
    const stemBottom = height - 2;
    const stemTop = -upwardExtension + circleRadius + 2; // Top of stem, leaving room for circle

    // Create the vertical stem
    const stem = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    stem.setAttribute('x', centerX - stemWidth / 2);
    stem.setAttribute('y', stemTop);
    stem.setAttribute('width', stemWidth);
    stem.setAttribute('height', stemBottom - stemTop);
    stem.setAttribute('fill', fillColor);
    stem.setAttribute('stroke', strokeColor);
    stem.setAttribute('stroke-width', strokeWidth.toString());
    group.appendChild(stem);

    // Create the circle at the top
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', centerX);
    circle.setAttribute('cy', stemTop - circleRadius + 2);
    circle.setAttribute('r', circleRadius);
    circle.setAttribute('fill', fillColor);
    circle.setAttribute('stroke', strokeColor);
    circle.setAttribute('stroke-width', strokeWidth.toString());
    group.appendChild(circle);

    return group;
  }

  /**
   * Create regulatory shape (diamond/rhombus)
   * @param {number} strokeWidth - Zoom-based stroke width for consistent borders
   */
  createRegulatoryShape(
    width,
    height,
    gradientId,
    operonInfo,
    isLeftTruncated,
    isRightTruncated,
    isForward,
    strokeWidth = 1
  ) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    let pathData;

    if (isLeftTruncated) {
      pathData = this.createJaggedRegulatoryPath(width, height, true, false);
    } else if (isRightTruncated) {
      pathData = this.createJaggedRegulatoryPath(width, height, false, true);
    } else {
      // Diamond shape
      pathData = `M ${width / 2} 0
                       L ${width} ${height / 2}
                       L ${width / 2} ${height}
                       L 0 ${height / 2} Z`;
    }

    path.setAttribute('d', pathData);
    path.setAttribute('fill', `url(#${gradientId})`);

    // Use zoom-based stroke width (passed as parameter)
    if (strokeWidth > 0) {
      path.setAttribute('stroke', this.darkenColor(operonInfo.color, 20));
      path.setAttribute('stroke-width', strokeWidth.toString());
    } else {
      path.setAttribute('stroke', 'transparent');
      path.setAttribute('stroke-width', '0');
    }
    path.setAttribute(
      'class',
      `gene-regulatory ${isLeftTruncated ? 'left-truncated' : ''} ${isRightTruncated ? 'right-truncated' : ''}`
    );
    return path;
  }

  /**
   * Create repeat region shape (wavy rectangle)
   * @param {number} strokeWidth - Zoom-based stroke width for consistent borders
   */
  /**
   * Create repeat region shape (stacked capsules)
   * @param {number} strokeWidth - Zoom-based stroke width for consistent borders
   */
  createRepeatShape(
    width,
    height,
    gradientId,
    operonInfo,
    isLeftTruncated,
    isRightTruncated,
    isForward,
    strokeWidth = 1
  ) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute(
      'class',
      `gene-repeat ${isLeftTruncated ? 'left-truncated' : ''} ${isRightTruncated ? 'right-truncated' : ''}`
    );

    // Colors from user request
    const fillColor = '#ef4444'; // Solid red
    const strokeColor = '#991b1b'; // Darker red stroke

    if (isLeftTruncated || isRightTruncated) {
      // Keep jagged edges for truncated repeats
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      let pathData;

      if (isLeftTruncated) {
        pathData = this.createJaggedRepeatPath(width, height, true, false);
      } else {
        pathData = this.createJaggedRepeatPath(width, height, false, true);
      }

      path.setAttribute('d', pathData);
      path.setAttribute('fill', fillColor);

      if (strokeWidth > 0) {
        path.setAttribute('stroke', strokeColor);
        path.setAttribute('stroke-width', strokeWidth.toString());
      } else {
        path.setAttribute('stroke', 'transparent');
        path.setAttribute('stroke-width', '0');
      }
      group.appendChild(path);
    } else {
      // Stacked capsules design (3 stacked rounded rectangles)
      const capsuleCount = 3;
      // Add small spacing between capsules if height allows, otherwise stick together
      const spacing = height < 12 ? 0 : height / 20;
      const totalSpacing = spacing * (capsuleCount - 1);
      const capsuleHeight = (height - totalSpacing) / capsuleCount;
      const rx = capsuleHeight / 2; // Full rounding

      for (let i = 0; i < capsuleCount; i++) {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', 0);
        rect.setAttribute('y', i * (capsuleHeight + spacing));
        rect.setAttribute('width', width);
        rect.setAttribute('height', capsuleHeight);
        rect.setAttribute('rx', rx); // Rounded ends
        rect.setAttribute('ry', rx);

        rect.setAttribute('fill', fillColor);

        if (strokeWidth > 0) {
          rect.setAttribute('stroke', strokeColor);
          rect.setAttribute('stroke-width', strokeWidth.toString());
        } else {
          rect.setAttribute('stroke', 'transparent');
          rect.setAttribute('stroke-width', '0');
        }
        group.appendChild(rect);
      }
    }

    return group;
  }

  /**
   * Create tRNA shape - elegant rounded chevron design
   * Design: A professional-looking rounded chevron that represents tRNA
   * @param {number} strokeWidth - Zoom-based stroke width for consistent borders
   */
  createTRNAShape(
    width,
    height,
    gradientId,
    operonInfo,
    isLeftTruncated,
    isRightTruncated,
    isForward,
    strokeWidth = 1
  ) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute(
      'class',
      `gene-trna ${isLeftTruncated ? 'left-truncated' : ''} ${isRightTruncated ? 'right-truncated' : ''}`
    );

    // Use tRNA-specific colors - vibrant lime green (different from rRNA's emerald)
    const fillColor = '#65a30d'; // Lime green for tRNA
    const fillColorLight = '#a3e635'; // Lighter lime for gradient
    const strokeColor = '#4d7c0f'; // Darker lime stroke

    // Create gradient definition for depth
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const gradId = `trna-grad-${Math.random().toString(36).substr(2, 9)}`;
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gradient.setAttribute('id', gradId);
    gradient.setAttribute('x1', '0%');
    gradient.setAttribute('y1', '0%');
    gradient.setAttribute('x2', '0%');
    gradient.setAttribute('y2', '100%');

    const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', fillColorLight);

    const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', fillColor);

    gradient.appendChild(stop1);
    gradient.appendChild(stop2);
    defs.appendChild(gradient);
    group.appendChild(defs);

    // Calculate shape dimensions with proper padding
    const verticalPadding = height * 0.1;
    const shapeHeight = height - verticalPadding * 2;
    const shapeY = verticalPadding;
    const cornerRadius = Math.min(shapeHeight / 3, 6);

    // Chevron indent (pointing inward from the side)
    const chevronIndent = Math.min(width * 0.12, 8);

    if (isLeftTruncated || isRightTruncated) {
      // For truncated tRNA, use clean zigzag edges
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const zigzagDepth = Math.min(3, height * 0.12);
      const zigzagCount = 3;
      const zigzagStep = shapeHeight / zigzagCount;

      let pathData;
      if (isLeftTruncated) {
        // Left edge has clean zigzag, right edge is chevron
        pathData = `M ${zigzagDepth} ${shapeY}`;
        for (let i = 0; i < zigzagCount; i++) {
          const y = shapeY + zigzagStep * i;
          pathData += ` L 0 ${y + zigzagStep / 2}`;
          pathData += ` L ${zigzagDepth} ${y + zigzagStep}`;
        }
        pathData += ` L ${width - chevronIndent} ${shapeY + shapeHeight}`;
        pathData += ` L ${width} ${shapeY + shapeHeight / 2}`;
        pathData += ` L ${width - chevronIndent} ${shapeY}`;
        pathData += ` Z`;
      } else {
        // Right edge has clean zigzag, left edge is chevron
        pathData = `M ${chevronIndent} ${shapeY}`;
        pathData += ` L ${width - zigzagDepth} ${shapeY}`;
        for (let i = 0; i < zigzagCount; i++) {
          const y = shapeY + zigzagStep * i;
          pathData += ` L ${width} ${y + zigzagStep / 2}`;
          pathData += ` L ${width - zigzagDepth} ${y + zigzagStep}`;
        }
        pathData += ` L ${chevronIndent} ${shapeY + shapeHeight}`;
        pathData += ` L 0 ${shapeY + shapeHeight / 2}`;
        pathData += ` Z`;
      }

      path.setAttribute('d', pathData);
      path.setAttribute('fill', `url(#${gradId})`);
      path.setAttribute('stroke', strokeColor);
      path.setAttribute('stroke-width', strokeWidth.toString());
      path.setAttribute('stroke-linejoin', 'round');
      group.appendChild(path);
    } else {
      // Full chevron/hexagon shape
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

      // Create a hexagon-like chevron shape (pointed on both ends if wide enough)
      let pathData;
      if (width > 20) {
        // Wide enough for proper chevron on both sides
        pathData = `M ${chevronIndent} ${shapeY}
                           L ${width - chevronIndent} ${shapeY}
                           L ${width} ${shapeY + shapeHeight / 2}
                           L ${width - chevronIndent} ${shapeY + shapeHeight}
                           L ${chevronIndent} ${shapeY + shapeHeight}
                           L 0 ${shapeY + shapeHeight / 2}
                           Z`;
      } else {
        // Narrow - just use rounded rectangle with chevron on right
        pathData = `M ${cornerRadius} ${shapeY}
                           L ${width - chevronIndent} ${shapeY}
                           L ${width} ${shapeY + shapeHeight / 2}
                           L ${width - chevronIndent} ${shapeY + shapeHeight}
                           L ${cornerRadius} ${shapeY + shapeHeight}
                           Q 0 ${shapeY + shapeHeight} 0 ${shapeY + shapeHeight - cornerRadius}
                           L 0 ${shapeY + cornerRadius}
                           Q 0 ${shapeY} ${cornerRadius} ${shapeY}
                           Z`;
      }

      path.setAttribute('d', pathData);
      path.setAttribute('fill', `url(#${gradId})`);
      path.setAttribute('stroke', strokeColor);
      path.setAttribute('stroke-width', strokeWidth.toString());
      path.setAttribute('stroke-linejoin', 'round');
      group.appendChild(path);
    }

    // Add a small decorative circle at the pointed end when wide enough
    if (width > 40 && height > 10) {
      const dotRadius = Math.min(height * 0.12, 3);
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', (width - chevronIndent - dotRadius - 2).toString());
      dot.setAttribute('cy', (height / 2).toString());
      dot.setAttribute('r', dotRadius.toString());
      dot.setAttribute('fill', fillColorLight);
      dot.setAttribute('opacity', '0.6');
      group.appendChild(dot);
    }

    return group;
  }

  /**
   * Create rRNA shape - elegant capsule/pill design with decorative stripes
   * Design: A professional-looking rounded capsule that clearly differentiates rRNA
   * @param {number} strokeWidth - Zoom-based stroke width for consistent borders
   */
  createRRNAShape(
    width,
    height,
    gradientId,
    operonInfo,
    isLeftTruncated,
    isRightTruncated,
    isForward,
    strokeWidth = 1
  ) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute(
      'class',
      `gene-rrna ${isLeftTruncated ? 'left-truncated' : ''} ${isRightTruncated ? 'right-truncated' : ''}`
    );

    // Use rRNA-specific colors - elegant emerald green
    const fillColor = '#059669'; // Emerald green for rRNA
    const fillColorLight = '#34d399'; // Lighter emerald for gradient
    const strokeColor = '#047857'; // Darker emerald stroke
    const stripeColor = '#10b981'; // Stripe accent color

    // Create gradient definition for depth
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const gradId = `rrna-grad-${Math.random().toString(36).substr(2, 9)}`;
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gradient.setAttribute('id', gradId);
    gradient.setAttribute('x1', '0%');
    gradient.setAttribute('y1', '0%');
    gradient.setAttribute('x2', '0%');
    gradient.setAttribute('y2', '100%');

    const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', fillColorLight);

    const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', fillColor);

    gradient.appendChild(stop1);
    gradient.appendChild(stop2);
    defs.appendChild(gradient);
    group.appendChild(defs);

    // Calculate capsule dimensions with proper padding
    const verticalPadding = height * 0.1;
    const capsuleHeight = height - verticalPadding * 2;
    const capsuleY = verticalPadding;
    const cornerRadius = Math.min(capsuleHeight / 2, 8);

    if (isLeftTruncated || isRightTruncated) {
      // For truncated rRNA, use clean zigzag edges instead of ugly jagged
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const zigzagDepth = Math.min(3, height * 0.12);
      const zigzagCount = 3;
      const zigzagStep = capsuleHeight / zigzagCount;

      let pathData;
      if (isLeftTruncated) {
        // Left edge has clean zigzag, right edge is rounded
        pathData = `M ${zigzagDepth} ${capsuleY}`;
        for (let i = 0; i < zigzagCount; i++) {
          const y = capsuleY + zigzagStep * i;
          pathData += ` L 0 ${y + zigzagStep / 2}`;
          pathData += ` L ${zigzagDepth} ${y + zigzagStep}`;
        }
        pathData += ` L ${width - cornerRadius} ${capsuleY + capsuleHeight}`;
        pathData += ` Q ${width} ${capsuleY + capsuleHeight} ${width} ${capsuleY + capsuleHeight - cornerRadius}`;
        pathData += ` L ${width} ${capsuleY + cornerRadius}`;
        pathData += ` Q ${width} ${capsuleY} ${width - cornerRadius} ${capsuleY}`;
        pathData += ` Z`;
      } else {
        // Right edge has clean zigzag, left edge is rounded
        pathData = `M ${cornerRadius} ${capsuleY}`;
        pathData += ` L ${width - zigzagDepth} ${capsuleY}`;
        for (let i = 0; i < zigzagCount; i++) {
          const y = capsuleY + zigzagStep * i;
          pathData += ` L ${width} ${y + zigzagStep / 2}`;
          pathData += ` L ${width - zigzagDepth} ${y + zigzagStep}`;
        }
        pathData += ` L ${cornerRadius} ${capsuleY + capsuleHeight}`;
        pathData += ` Q 0 ${capsuleY + capsuleHeight} 0 ${capsuleY + capsuleHeight - cornerRadius}`;
        pathData += ` L 0 ${capsuleY + cornerRadius}`;
        pathData += ` Q 0 ${capsuleY} ${cornerRadius} ${capsuleY}`;
        pathData += ` Z`;
      }

      path.setAttribute('d', pathData);
      path.setAttribute('fill', `url(#${gradId})`);
      path.setAttribute('stroke', strokeColor);
      path.setAttribute('stroke-width', strokeWidth.toString());
      group.appendChild(path);
    } else {
      // Full capsule/pill shape with rounded ends
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', '0');
      rect.setAttribute('y', capsuleY.toString());
      rect.setAttribute('width', width.toString());
      rect.setAttribute('height', capsuleHeight.toString());
      rect.setAttribute('rx', cornerRadius.toString());
      rect.setAttribute('ry', cornerRadius.toString());
      rect.setAttribute('fill', `url(#${gradId})`);
      rect.setAttribute('stroke', strokeColor);
      rect.setAttribute('stroke-width', strokeWidth.toString());
      group.appendChild(rect);
    }

    // Add decorative horizontal stripes for visual distinction (if wide enough)
    if (width > 30 && height > 8) {
      const stripeCount = 2;
      const stripeSpacing = capsuleHeight / (stripeCount + 1);
      const stripeWidth = Math.min(width * 0.7, width - 10);
      const stripeX = (width - stripeWidth) / 2;

      for (let i = 1; i <= stripeCount; i++) {
        const stripe = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        const stripeY = capsuleY + stripeSpacing * i;
        stripe.setAttribute('x1', stripeX.toString());
        stripe.setAttribute('y1', stripeY.toString());
        stripe.setAttribute('x2', (stripeX + stripeWidth).toString());
        stripe.setAttribute('y2', stripeY.toString());
        stripe.setAttribute('stroke', stripeColor);
        stripe.setAttribute('stroke-width', Math.max(1, height * 0.08).toString());
        stripe.setAttribute('stroke-linecap', 'round');
        stripe.setAttribute('opacity', '0.4');
        group.appendChild(stripe);
      }
    }

    return group;
  }

  /**
   * Create mRNA shape (wavy line/sine wave)
   * @param {number} strokeWidth - Zoom-based stroke width for consistent borders
   */
  createMRNAShape(
    width,
    height,
    gradientId,
    operonInfo,
    isLeftTruncated,
    isRightTruncated,
    isForward,
    strokeWidth = 1
  ) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    let pathData;

    if (isLeftTruncated || isRightTruncated) {
      if (isLeftTruncated) {
        pathData = this.createJaggedRNAPath(width, height, true, false);
      } else {
        pathData = this.createJaggedRNAPath(width, height, false, true);
      }
    } else {
      // Sine wave shape
      const waveCount = Math.max(2, Math.floor(width / 10));
      const waveHeight = height * 0.3;
      const centerY = height / 2;

      pathData = `M 0 ${centerY}`;

      for (let i = 0; i <= waveCount * 4; i++) {
        const x = (i / (waveCount * 4)) * width;
        const y = centerY + Math.sin((i / waveCount) * Math.PI) * waveHeight;
        pathData += ` L ${x} ${y}`;
      }

      // Create filled shape by adding bottom path
      pathData += ` L ${width} ${centerY + waveHeight * 0.5}`;
      for (let i = waveCount * 4; i >= 0; i--) {
        const x = (i / (waveCount * 4)) * width;
        const y = centerY + Math.sin((i / waveCount) * Math.PI) * waveHeight * 0.5 + waveHeight * 0.25;
        pathData += ` L ${x} ${y}`;
      }
      pathData += ` Z`;
    }

    path.setAttribute('d', pathData);
    path.setAttribute('fill', `url(#${gradientId})`);

    // Use zoom-based stroke width (passed as parameter)
    if (strokeWidth > 0) {
      path.setAttribute('stroke', this.darkenColor(operonInfo.color, 20));
      path.setAttribute('stroke-width', strokeWidth.toString());
    } else {
      path.setAttribute('stroke', 'transparent');
      path.setAttribute('stroke-width', '0');
    }
    path.setAttribute(
      'class',
      `gene-mrna ${isLeftTruncated ? 'left-truncated' : ''} ${isRightTruncated ? 'right-truncated' : ''}`
    );
    return path;
  }

  /**
   * Create comment/note shape (speech bubble or annotation marker)
   * @param {number} strokeWidth - Zoom-based stroke width for consistent borders
   */
  createCommentShape(
    width,
    height,
    gradientId,
    operonInfo,
    isLeftTruncated,
    isRightTruncated,
    isForward,
    strokeWidth = 1
  ) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute(
      'class',
      `gene-comment ${isLeftTruncated ? 'left-truncated' : ''} ${isRightTruncated ? 'right-truncated' : ''}`
    );

    if (isLeftTruncated || isRightTruncated) {
      // For truncated comments, use simplified shape
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      let pathData;

      if (isLeftTruncated) {
        pathData = this.createJaggedCommentPath(width, height, true, false);
      } else {
        pathData = this.createJaggedCommentPath(width, height, false, true);
      }

      path.setAttribute('d', pathData);
      path.setAttribute('fill', `url(#${gradientId})`);
      path.setAttribute('stroke', this.darkenColor(operonInfo.color, 20));
      path.setAttribute('stroke-width', strokeWidth.toString());
      group.appendChild(path);
      return group;
    }

    if (width < 15) {
      // Small comment - simple rounded rectangle with corner indicator
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', 0);
      rect.setAttribute('y', height * 0.1);
      rect.setAttribute('width', width);
      rect.setAttribute('height', height * 0.8);
      rect.setAttribute('rx', Math.min(3, width * 0.2));
      rect.setAttribute('ry', Math.min(3, height * 0.15));
      rect.setAttribute('fill', `url(#${gradientId})`);
      rect.setAttribute('stroke', this.darkenColor(operonInfo.color, 20));
      rect.setAttribute('stroke-width', strokeWidth.toString());

      // Small indicator dot
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', width * 0.8);
      dot.setAttribute('cy', height * 0.8);
      dot.setAttribute('r', Math.min(2, width * 0.1));
      dot.setAttribute('fill', this.darkenColor(operonInfo.color, 30));

      group.appendChild(rect);
      group.appendChild(dot);
    } else {
      // Large comment - speech bubble shape
      const bubbleHeight = height * 0.7;
      const bubbleY = height * 0.1;
      const cornerRadius = Math.min(4, height * 0.15);
      const tailSize = Math.min(6, height * 0.2);

      // Main bubble body (rounded rectangle)
      const bubble = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bubble.setAttribute('x', 0);
      bubble.setAttribute('y', bubbleY);
      bubble.setAttribute('width', width * 0.85);
      bubble.setAttribute('height', bubbleHeight);
      bubble.setAttribute('rx', cornerRadius);
      bubble.setAttribute('ry', cornerRadius);
      bubble.setAttribute('fill', `url(#${gradientId})`);
      bubble.setAttribute('stroke', this.darkenColor(operonInfo.color, 20));
      bubble.setAttribute('stroke-width', '1');

      // Speech bubble tail (small triangle pointing down-right)
      const tail = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const tailX = width * 0.75;
      const tailY = bubbleY + bubbleHeight;
      const tailPath = `M ${tailX} ${tailY}
                             L ${tailX + tailSize} ${tailY + tailSize}
                             L ${tailX + tailSize * 0.5} ${tailY} Z`;
      tail.setAttribute('d', tailPath);
      tail.setAttribute('fill', `url(#${gradientId})`);
      tail.setAttribute('stroke', this.darkenColor(operonInfo.color, 20));
      tail.setAttribute('stroke-width', '1');

      // Comment icon (three dots inside bubble)
      const dotSpacing = width * 0.15;
      const dotY = bubbleY + bubbleHeight * 0.5;
      const dotRadius = Math.min(1.5, height * 0.08);

      for (let i = 0; i < 3; i++) {
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', width * 0.2 + i * dotSpacing);
        dot.setAttribute('cy', dotY);
        dot.setAttribute('r', dotRadius);
        dot.setAttribute('fill', this.darkenColor(operonInfo.color, 40));
        group.appendChild(dot);
      }

      group.appendChild(bubble);
      group.appendChild(tail);
    }

    return group;
  }

  /**
   * Create jagged path for truncated triangular genes
   */
  createJaggedTrianglePath(width, height, isLeftJagged, isRightJagged, isForward) {
    const jaggedDepth = Math.min(4, height * 0.2); // Depth of jagged cuts
    const jaggedStep = Math.max(2, height / 6); // Height of each jagged tooth
    const arrowSize = Math.max(8, Math.min(width * 0.3, height * 0.8)); // Dynamic arrow size

    if (isForward) {
      // Forward triangle (pointing right)
      if (isLeftJagged) {
        // Left edge (截断面) is jagged - vertical jagged line
        return `M ${jaggedDepth} 0
                       L 0 ${jaggedStep}
                       L ${jaggedDepth} ${jaggedStep * 2}
                       L 0 ${jaggedStep * 3}
                       L ${jaggedDepth} ${jaggedStep * 4}
                       L 0 ${height}
                       L ${width} ${height / 2}
                       L ${jaggedDepth} 0
                       Z`;
      } else if (isRightJagged) {
        // Right edge (截断面) is jagged - vertical jagged line
        return `M 0 0
                       L ${width - jaggedDepth} ${jaggedStep}
                       L ${width} 0
                       L ${width - jaggedDepth} ${jaggedStep * 2}
                       L ${width} ${jaggedStep * 3}
                       L ${width - jaggedDepth} ${jaggedStep * 4}
                       L ${width} ${height}
                       L 0 ${height}
                       Z`;
      }
    } else {
      // Reverse triangle (pointing left)
      if (isLeftJagged) {
        // Left edge (截断面) is jagged - vertical jagged line
        return `M ${jaggedDepth} 0
                       L 0 ${jaggedStep}
                       L ${jaggedDepth} ${jaggedStep * 2}
                       L 0 ${jaggedStep * 3}
                       L ${jaggedDepth} ${jaggedStep * 4}
                       L 0 ${height}
                       L ${width} ${height}
                       L ${width} 0
                       Z`;
      } else if (isRightJagged) {
        // Right edge (截断面) is jagged - vertical jagged line
        return `M ${arrowSize} 0
                       L ${width - jaggedDepth} 0
                       L ${width} ${jaggedStep}
                       L ${width - jaggedDepth} ${jaggedStep * 2}
                       L ${width} ${jaggedStep * 3}
                       L ${width - jaggedDepth} ${jaggedStep * 4}
                       L ${width} ${height}
                       L ${arrowSize} ${height}
                       L 0 ${height / 2}
                       Z`;
      }
    }

    // Fallback - return normal arrow if no jagged edges
    if (isForward) {
      return `M 0 0 L ${width - arrowSize} 0 L ${width} ${height / 2} L ${width - arrowSize} ${height} L 0 ${height} Z`;
    } else {
      return `M ${arrowSize} 0 L ${width} 0 L ${width} ${height} L ${arrowSize} ${height} L 0 ${height / 2} Z`;
    }
  }

  /**
   * Create jagged arrow path for truncated arrow-shaped genes
   */
  createJaggedArrowPath(width, height, arrowSize, isLeftJagged, isRightJagged, isForward) {
    const jaggedDepth = Math.min(4, height * 0.2);
    const jaggedStep = Math.max(2, height / 6);

    if (isForward) {
      // Forward arrow (pointing right)
      if (isLeftJagged) {
        // Left edge is jagged
        return `M ${jaggedDepth} 0
                       L 0 ${jaggedStep}
                       L ${jaggedDepth} ${jaggedStep * 2}
                       L 0 ${jaggedStep * 3}
                       L ${jaggedDepth} ${jaggedStep * 4}
                       L 0 ${height}
                       L ${width - arrowSize} ${height}
                       L ${width} ${height / 2}
                       L ${width - arrowSize} 0
                       L ${jaggedDepth} 0
                       Z`;
      } else if (isRightJagged) {
        // Right edge is completely jagged (no arrow tip for truncated genes)
        return `M 0 0
                       L ${width - jaggedDepth} 0
                       L ${width} ${jaggedStep}
                       L ${width - jaggedDepth} ${jaggedStep * 2}
                       L ${width} ${jaggedStep * 3}
                       L ${width - jaggedDepth} ${jaggedStep * 4}
                       L ${width} ${height}
                       L 0 ${height}
                       Z`;
      }
    } else {
      // Reverse arrow (pointing left)
      if (isLeftJagged) {
        // Left edge is completely jagged (no arrow tip for truncated genes)
        return `M ${jaggedDepth} 0
                       L 0 ${jaggedStep}
                       L ${jaggedDepth} ${jaggedStep * 2}
                       L 0 ${jaggedStep * 3}
                       L ${jaggedDepth} ${jaggedStep * 4}
                       L 0 ${height}
                       L ${width} ${height}
                       L ${width} 0
                       Z`;
      } else if (isRightJagged) {
        // Right edge is jagged
        return `M ${arrowSize} 0
                       L ${width - jaggedDepth} 0
                       L ${width} ${jaggedStep}
                       L ${width - jaggedDepth} ${jaggedStep * 2}
                       L ${width} ${jaggedStep * 3}
                       L ${width - jaggedDepth} ${jaggedStep * 4}
                       L ${width} ${height}
                       L ${arrowSize} ${height}
                       L 0 ${height / 2}
                       Z`;
      }
    }

    // Fallback - return normal arrow
    if (isForward) {
      return `M 0 0 L ${width - arrowSize} 0 L ${width} ${height / 2} L ${width - arrowSize} ${height} L 0 ${height} Z`;
    } else {
      return `M ${arrowSize} 0 L ${width} 0 L ${width} ${height} L ${arrowSize} ${height} L 0 ${height / 2} Z`;
    }
  }

  /**
   * Helper functions for creating jagged paths for specialized shapes
   */
  createJaggedPromoterPath(width, height, isLeftJagged, isRightJagged, isForward) {
    const jaggedDepth = Math.min(4, height * 0.2);
    const jaggedStep = Math.max(2, height / 6);
    const flagHeight = height * 0.6;

    if (isLeftJagged) {
      return `M ${jaggedDepth} ${height}
                   L 0 ${height - jaggedStep}
                   L ${jaggedDepth} ${height - jaggedStep * 2}
                   L 0 ${height - jaggedStep * 3}
                   L ${jaggedDepth} ${height - flagHeight}
                   L ${width * 0.8} ${height - flagHeight}
                   L ${width} ${height - flagHeight + height * 0.15}
                   L ${width * 0.8} ${height - flagHeight + height * 0.3}
                   L ${jaggedDepth} ${height - flagHeight + height * 0.3}
                   L ${jaggedDepth} ${height} Z`;
    } else {
      return `M 0 ${height}
                   L 0 ${height - flagHeight}
                   L ${width * 0.8} ${height - flagHeight}
                   L ${width} ${height - flagHeight + height * 0.15}
                   L ${width * 0.8} ${height - flagHeight + height * 0.3}
                   L 0 ${height - flagHeight + height * 0.3}
                   L 0 ${height} Z`;
    }
  }

  createJaggedTerminatorPath(width, height, isLeftJagged, isRightJagged) {
    const jaggedDepth = Math.min(4, height * 0.2);
    const jaggedStep = Math.max(2, height / 6);
    const stemWidth = Math.max(4, width * 0.2);
    const barHeight = height * 0.3;

    if (isLeftJagged) {
      return `M ${jaggedDepth} 0
                   L 0 ${jaggedStep}
                   L ${jaggedDepth} ${jaggedStep * 2}
                   L 0 ${jaggedStep * 3}
                   L ${jaggedDepth} ${barHeight}
                   L ${width / 2 - stemWidth / 2} ${barHeight}
                   L ${width / 2 - stemWidth / 2} ${height}
                   L ${width / 2 + stemWidth / 2} ${height}
                   L ${width / 2 + stemWidth / 2} ${barHeight}
                   L ${width} ${barHeight}
                   L ${width} 0
                   L ${jaggedDepth} 0 Z`;
    } else {
      return `M 0 0
                   L ${width - jaggedDepth} 0
                   L ${width} ${jaggedStep}
                   L ${width - jaggedDepth} ${jaggedStep * 2}
                   L ${width} ${jaggedStep * 3}
                   L ${width - jaggedDepth} ${barHeight}
                   L ${width / 2 + stemWidth / 2} ${barHeight}
                   L ${width / 2 + stemWidth / 2} ${height}
                   L ${width / 2 - stemWidth / 2} ${height}
                   L ${width / 2 - stemWidth / 2} ${barHeight}
                   L 0 ${barHeight} Z`;
    }
  }

  createJaggedRegulatoryPath(width, height, isLeftJagged, isRightJagged) {
    const jaggedDepth = Math.min(4, height * 0.2);
    const jaggedStep = Math.max(2, height / 6);

    if (isLeftJagged) {
      return `M ${jaggedDepth} ${height * 0.2}
                   L 0 ${jaggedStep}
                   L ${jaggedDepth} ${jaggedStep * 2}
                   L 0 ${jaggedStep * 3}
                   L ${jaggedDepth} ${height * 0.8}
                   L ${width / 2} ${height}
                   L ${width} ${height / 2}
                   L ${width / 2} 0
                   L ${jaggedDepth} ${height * 0.2} Z`;
    } else {
      return `M ${width / 2} 0
                   L ${width - jaggedDepth} ${height * 0.2}
                   L ${width} ${jaggedStep}
                   L ${width - jaggedDepth} ${jaggedStep * 2}
                   L ${width} ${jaggedStep * 3}
                   L ${width - jaggedDepth} ${height * 0.8}
                   L ${width / 2} ${height}
                   L 0 ${height / 2} Z`;
    }
  }

  createJaggedRepeatPath(width, height, isLeftJagged, isRightJagged) {
    const jaggedDepth = Math.min(4, height * 0.2);
    const jaggedStep = Math.max(2, height / 6);

    if (isLeftJagged) {
      return `M ${jaggedDepth} 0
                   L 0 ${jaggedStep}
                   L ${jaggedDepth} ${jaggedStep * 2}
                   L 0 ${jaggedStep * 3}
                   L ${jaggedDepth} ${jaggedStep * 4}
                   L 0 ${height}
                   L ${width} ${height}
                   L ${width} 0
                   L ${jaggedDepth} 0 Z`;
    } else {
      return `M 0 0
                   L ${width - jaggedDepth} 0
                   L ${width} ${jaggedStep}
                   L ${width - jaggedDepth} ${jaggedStep * 2}
                   L ${width} ${jaggedStep * 3}
                   L ${width - jaggedDepth} ${jaggedStep * 4}
                   L ${width} ${height}
                   L 0 ${height} Z`;
    }
  }

  createJaggedRNAPath(width, height, isLeftJagged, isRightJagged) {
    const jaggedDepth = Math.min(4, height * 0.2);
    const jaggedStep = Math.max(2, height / 6);

    if (isLeftJagged) {
      return `M ${jaggedDepth} 0
                   L 0 ${jaggedStep}
                   L ${jaggedDepth} ${jaggedStep * 2}
                   L 0 ${jaggedStep * 3}
                   L ${jaggedDepth} ${jaggedStep * 4}
                   L 0 ${height}
                   L ${width} ${height}
                   L ${width} 0
                   L ${jaggedDepth} 0 Z`;
    } else {
      return `M 0 0
                   L ${width - jaggedDepth} 0
                   L ${width} ${jaggedStep}
                   L ${width - jaggedDepth} ${jaggedStep * 2}
                   L ${width} ${jaggedStep * 3}
                   L ${width - jaggedDepth} ${jaggedStep * 4}
                   L ${width} ${height}
                   L 0 ${height} Z`;
    }
  }

  createJaggedCommentPath(width, height, isLeftJagged, isRightJagged) {
    const jaggedDepth = Math.min(4, height * 0.2);
    const jaggedStep = Math.max(2, height / 6);
    const bubbleHeight = height * 0.7;
    const bubbleY = height * 0.1;

    if (isLeftJagged) {
      return `M ${jaggedDepth} ${bubbleY}
                   L 0 ${bubbleY + jaggedStep}
                   L ${jaggedDepth} ${bubbleY + jaggedStep * 2}
                   L 0 ${bubbleY + jaggedStep * 3}
                   L ${jaggedDepth} ${bubbleY + bubbleHeight}
                   L ${width * 0.85} ${bubbleY + bubbleHeight}
                   L ${width * 0.85} ${bubbleY}
                   L ${jaggedDepth} ${bubbleY} Z`;
    } else {
      return `M 0 ${bubbleY}
                   L ${width * 0.85 - jaggedDepth} ${bubbleY}
                   L ${width * 0.85} ${bubbleY + jaggedStep}
                   L ${width * 0.85 - jaggedDepth} ${bubbleY + jaggedStep * 2}
                   L ${width * 0.85} ${bubbleY + jaggedStep * 3}
                   L ${width * 0.85 - jaggedDepth} ${bubbleY + bubbleHeight}
                   L 0 ${bubbleY + bubbleHeight}
                   L 0 ${bubbleY} Z`;
    }
  }

  /**
   * Create SVG text label for gene with advanced anti-stretch protection
   */
  createSVGGeneText(gene, width, height, settings) {
    const geneName =
      this.genomeBrowser.getQualifierValue(gene.qualifiers, 'gene') ||
      this.genomeBrowser.getQualifierValue(gene.qualifiers, 'locus_tag') ||
      this.genomeBrowser.getQualifierValue(gene.qualifiers, 'product') ||
      gene.type;

    // Use fixed font size to prevent stretching, with reasonable scaling
    const baseFontSize = settings?.fontSize || 11;
    const maxFontSize = Math.min(baseFontSize, height * 0.7);
    const minFontSize = 8;
    const fontSize = Math.max(minFontSize, Math.min(maxFontSize, baseFontSize));

    // Smart text truncation based on available width and font size
    let displayText = geneName;
    const estimatedCharWidth = fontSize * 0.6; // Approximate character width
    const maxChars = Math.floor(width / estimatedCharWidth);

    if (geneName.length > maxChars && maxChars > 3) {
      displayText = geneName.substring(0, maxChars - 3) + '...';
    } else if (maxChars <= 3) {
      displayText = '...';
    }

    // Create a transform group to isolate text from SVG stretching
    const textGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    textGroup.setAttribute('class', 'svg-text-protected');

    // Add resize-resistant attributes
    textGroup.setAttribute('data-original-width', width);
    textGroup.setAttribute('data-original-height', height);
    textGroup.setAttribute('data-gene-name', geneName);

    // Create text element with fixed sizing
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', width / 2);
    text.setAttribute('y', height / 2);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'central');
    text.setAttribute('font-size', `${fontSize}px`); // Use px for consistent sizing
    text.setAttribute('font-family', settings?.fontFamily || 'Arial, sans-serif');
    text.setAttribute('font-weight', '500'); // Slightly bold for better readability
    text.setAttribute('fill', settings?.geneNameColor || '#333333');
    text.setAttribute('pointer-events', 'none');

    // Enhanced protection against stretching
    text.style.vectorEffect = 'non-scaling-stroke';
    text.style.transformOrigin = 'center';
    text.style.transform = 'scale(1, 1)'; // Force 1:1 aspect ratio

    // Additional resize protection attributes
    text.setAttribute('data-original-font-size', fontSize);
    text.setAttribute('data-resize-protected', 'true');

    text.textContent = displayText;
    textGroup.appendChild(text);

    return textGroup;
  }

  /**
   * Update SVG text elements to handle window resize properly
   * This method recalculates text sizes and positions after resize
   */
  updateSVGTextForResize(svgContainer, containerWidth) {
    if (!svgContainer) return;

    const textElements = svgContainer.querySelectorAll('text[data-resize-protected="true"]');

    textElements.forEach(textElement => {
      const originalFontSize = parseFloat(textElement.getAttribute('data-original-font-size'));
      const geneGroup = textElement.closest('g.svg-gene-element');

      if (geneGroup && originalFontSize) {
        // Get the current transform to understand positioning
        const transform = geneGroup.getAttribute('transform');
        if (transform) {
          const translateMatch = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
          if (translateMatch) {
            const x = parseFloat(translateMatch[1]);
            const y = parseFloat(translateMatch[2]);

            // Recalculate text positioning based on new container width
            const textGroup = textElement.parentElement;
            const originalWidth = parseFloat(textGroup.getAttribute('data-original-width'));
            const originalHeight = parseFloat(textGroup.getAttribute('data-original-height'));

            if (originalWidth && originalHeight) {
              // Update text position within its group
              textElement.setAttribute('x', originalWidth / 2);
              textElement.setAttribute('y', originalHeight / 2);

              // Maintain original font size to prevent stretching
              textElement.setAttribute('font-size', `${originalFontSize}px`);

              // Ensure transform protection is maintained
              textElement.style.vectorEffect = 'non-scaling-stroke';
              textElement.style.transform = 'scale(1, 1)';
            }
          }
        }
      }
    });

    console.log('🔤 Updated', textElements.length, 'SVG text elements for resize');
  }

  /**
   * Add interaction handlers to SVG gene element
   */
  addSVGGeneInteraction(geneGroup, gene, operons, operonInfo, rowIndex) {
    // Add data attributes for reliable gene identification
    geneGroup.setAttribute('data-gene-start', gene.start);
    geneGroup.setAttribute('data-gene-end', gene.end);
    geneGroup.setAttribute('data-gene-type', gene.type);
    const geneNameAttr = this.genomeBrowser.getQualifierValue(gene.qualifiers, 'gene');
    if (geneNameAttr) {
      geneGroup.setAttribute('data-gene-name', geneNameAttr);
    }
    const locusTagAttr = this.genomeBrowser.getQualifierValue(gene.qualifiers, 'locus_tag');
    if (locusTagAttr) {
      geneGroup.setAttribute('data-locus-tag', locusTagAttr);
    }

    // Create comprehensive tooltip
    const geneName =
      this.genomeBrowser.getQualifierValue(gene.qualifiers, 'gene') ||
      this.genomeBrowser.getQualifierValue(gene.qualifiers, 'locus_tag') ||
      this.genomeBrowser.getQualifierValue(gene.qualifiers, 'product') ||
      gene.type;
    const geneInfo = `${geneName} (${gene.type})`;
    const positionInfo = `${gene.start}-${gene.end} (${gene.strand === -1 ? '-' : '+'} strand)`;
    const operonDisplay = operonInfo.isInOperon ? `\nOperon: ${operonInfo.operonName}` : '\nSingle gene';
    const rowInfo = `\nRow: ${rowIndex + 1}`;

    // Add truncation info for partially visible genes
    const viewport = this.getCurrentViewport();
    const isLeftTruncated = gene.start < viewport.start;
    const isRightTruncated = gene.end > viewport.end;
    let truncationInfo = '';

    if (isLeftTruncated && isRightTruncated) {
      truncationInfo = '\n⚠️ Gene extends beyond both edges of current view';
    } else if (isLeftTruncated) {
      truncationInfo = '\n⚠️ Gene extends beyond left edge of current view';
    } else if (isRightTruncated) {
      truncationInfo = '\n⚠️ Gene extends beyond right edge of current view';
    }

    // Add tooltip using title element
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = `${geneInfo}\nPosition: ${positionInfo}${operonDisplay}${rowInfo}${truncationInfo}`;
    geneGroup.appendChild(title);

    // Add hover effects
    geneGroup.style.cursor = 'pointer';
    geneGroup.addEventListener('mouseenter', () => {
      geneGroup.style.opacity = '0.8';
      geneGroup.style.transform = geneGroup.getAttribute('transform') + ' scale(1.05)';
    });

    geneGroup.addEventListener('mouseleave', () => {
      geneGroup.style.opacity = '1';
      geneGroup.style.transform = geneGroup.getAttribute('transform');
    });

    // Add click handler
    geneGroup.addEventListener('click', () => {
      this.showGeneDetails(gene, operonInfo);
    });

    // Add right-click context menu for opening in new tab
    geneGroup.addEventListener('contextmenu', e => {
      e.preventDefault();
      this.showGeneContextMenu(e, gene);
    });

    // Handle selection state
    if (
      this.genomeBrowser.selectedGene &&
      this.genomeBrowser.selectedGene.gene &&
      this.genomeBrowser.selectedGene.gene.start === gene.start &&
      this.genomeBrowser.selectedGene.gene.end === gene.end &&
      this.genomeBrowser.selectedGene.gene.type === gene.type
    ) {
      geneGroup.setAttribute('class', geneGroup.getAttribute('class') + ' selected');
      geneGroup.style.filter = 'drop-shadow(0 0 6px rgba(0,100,200,0.8))';
    }
  }

  /**
   * Toggle track layout mode (Expanded → Compact → Group by Type → Expanded)
   */
  toggleTrackLayout(trackType, buttonElement) {
    if (trackType !== 'genes') return;

    const settings = this.getTrackSettings('genes');
    const currentMode = settings.layoutMode || 'expanded';

    // Cycle through modes: expanded → compact → groupByType → expanded
    let newMode;
    if (currentMode === 'expanded') {
      newMode = 'compact';
    } else if (currentMode === 'compact') {
      newMode = 'groupByType';
    } else {
      newMode = 'expanded';
    }

    console.log(`Switching ${trackType} layout from ${currentMode} to ${newMode}`);

    // Update settings
    settings.layoutMode = newMode;
    this.trackSettings['genes'] = settings; // Ensure it's saved back

    // Update button appearance
    this.updateLayoutButtonAppearance(buttonElement, newMode);

    // Refresh the track to apply changes
    this.refreshTrack(trackType);
  }

  /**
   * Toggle circular browsing mode for genes track
   * When enabled, navigation wraps around from end to start and vice versa
   */
  toggleCircularMode(button) {
    const currentSettings = this.getTrackSettings('genes');
    const newCircularMode = !currentSettings.circularMode;

    console.log(`🔄 Toggling circular mode: ${currentSettings.circularMode} → ${newCircularMode}`);

    // Update settings
    this.trackSettings = this.trackSettings || {};
    this.trackSettings.genes = { ...currentSettings, circularMode: newCircularMode };

    // Save to config
    if (this.genomeBrowser.configManager) {
      this.genomeBrowser.configManager.set('tracks.genes.settings.circularMode', newCircularMode);
    }

    // Update button appearance
    button.innerHTML = newCircularMode
      ? '<i class="fas fa-circle-notch"></i>'
      : '<i class="fas fa-long-arrow-alt-right"></i>';
    button.title = newCircularMode
      ? 'Circular Mode: ON (click to disable)'
      : 'Circular Mode: OFF (click to enable for seamless wraparound navigation)';
    button.classList.toggle('active', newCircularMode);

    // Update navigation manager with circular mode state
    if (this.genomeBrowser.navigationManager) {
      this.genomeBrowser.navigationManager.setCircularMode(newCircularMode);
    }

    // Refresh the current view to apply changes
    if (this.genomeBrowser.refreshCurrentView) {
      this.genomeBrowser.refreshCurrentView();
    } else {
      // Fallback: refresh the genes track directly
      this.refreshTrack('genes');
    }

    console.log(`🔄 Circular mode ${newCircularMode ? 'enabled' : 'disabled'}`);
  }

  /**
   * Update circular mode button display to match current trackSettings
   * Called when switching tabs to sync button UI with restored settings
   */
  updateCircularModeButton() {
    const circularBtn = document.querySelector('.track-circular-btn');
    if (!circularBtn) return;

    const isCircular = this.getTrackSettings('genes').circularMode || false;
    circularBtn.innerHTML = isCircular
      ? '<i class="fas fa-circle-notch"></i>'
      : '<i class="fas fa-long-arrow-alt-right"></i>';
    circularBtn.title = isCircular
      ? 'Circular Mode: ON (click to disable)'
      : 'Circular Mode: OFF (click to enable for seamless wraparound navigation)';
    circularBtn.classList.toggle('active', isCircular);
  }

  /**
   * Update the layout toggle button appearance based on mode
   */
  updateLayoutButtonAppearance(buttonElement, mode) {
    if (!buttonElement) return;

    let icon, title;
    switch (mode) {
      case 'compact':
        icon = '<i class="fas fa-compress-alt"></i>';
        title = 'Switch to Group by Type Layout';
        break;
      case 'groupByType':
        icon = '<i class="fas fa-layer-group"></i>';
        title = 'Switch to Expanded Layout';
        break;
      default: // expanded
        icon = '<i class="fas fa-expand-alt"></i>';
        title = 'Switch to Compact Layout';
    }

    buttonElement.innerHTML = icon;
    buttonElement.title = title;
  }

  /**
   * Sync the genes layout button with current settings (called after settings modal save)
   */
  syncGenesLayoutButton() {
    const layoutBtn = document.querySelector('.gene-track .track-layout-btn');
    if (!layoutBtn) return;

    const settings = this.getTrackSettings('genes');
    const currentMode = settings.layoutMode || 'expanded';
    this.updateLayoutButtonAppearance(layoutBtn, currentMode);
  }

  /**
   * Calculate layout parameters for gene track
   */
  calculateGeneTrackLayout(geneRows, settings) {
    const layoutMode = settings?.layoutMode || 'expanded';
    const isCompact = layoutMode === 'compact';

    const geneHeight = settings?.geneHeight || (isCompact ? 8 : 12);
    const rowSpacing = isCompact ? 2 : 6;
    const rulerHeight = 35;
    const bottomPadding = 0;

    // Apply maximal rows setting
    const maxRows = settings?.maxRows || 6;
    const effectiveRows = Math.min(geneRows.length, maxRows);

    // Check if first row contains upward-extending elements (promoters/terminators)
    // These elements extend above their bounding box and need extra top padding
    let topPadding = 2;
    if (geneRows.length > 0 && geneRows[0] && geneRows[0].length > 0) {
      const hasUpwardElements = geneRows[0].some(gene => {
        const geneType = (gene.type || '').toLowerCase();
        return geneType === 'promoter' || geneType === 'terminator';
      });
      if (hasUpwardElements) {
        // Add extra padding for upward-extending elements (approximately geneHeight * 0.8)
        topPadding = Math.max(2, Math.round(geneHeight * 0.8));
      }
    }

    return {
      geneHeight,
      rowSpacing,
      rulerHeight,
      topPadding,
      bottomPadding,
      maxRows,
      effectiveRows,
      totalHeight: rulerHeight + topPadding + effectiveRows * (geneHeight + rowSpacing) - rowSpacing + bottomPadding,
      layoutMode, // Pass this through for renderer to use
    };
  }

  /**
   * Get current gene track settings for refresh operations
   */
  getGeneTrackSettings() {
    // Delegate to the unified getTrackSettings method
    return this.getTrackSettings('genes');
  }

  /**
   * Create individual gene element with improved structure
   */
  createGeneElement(gene, viewport, operons, rowIndex, layout, settings) {
    const geneElement = document.createElement('div');

    // Configure element class and style
    this.configureGeneElementAppearance(geneElement, gene, viewport, operons, settings);

    // Set position
    this.setGeneElementPosition(geneElement, gene, viewport, rowIndex, layout, settings);

    // Add interaction handlers
    this.addGeneElementHandlers(geneElement, gene, operons);

    return geneElement;
  }

  /**
   * Configure gene element appearance and styling
   */
  configureGeneElementAppearance(geneElement, gene, viewport, operons, settings) {
    // Normalize gene type for CSS class
    let geneType = gene.type.toLowerCase();
    if (geneType.includes('rna') && !['mrna', 'trna', 'rrna'].includes(geneType)) {
      geneType = 'misc_feature';
    }

    geneElement.className = `gene-element ${geneType}`;

    // Add data attributes for reliable gene identification
    geneElement.setAttribute('data-gene-start', gene.start);
    geneElement.setAttribute('data-gene-end', gene.end);
    geneElement.setAttribute('data-gene-type', gene.type);
    const geneNameAttr2 = this.genomeBrowser.getQualifierValue(gene.qualifiers, 'gene');
    if (geneNameAttr2) {
      geneElement.setAttribute('data-gene-name', geneNameAttr2);
    }
    const locusTagAttr2 = this.genomeBrowser.getQualifierValue(gene.qualifiers, 'locus_tag');
    if (locusTagAttr2) {
      geneElement.setAttribute('data-locus-tag', locusTagAttr2);
    }

    // Get operon information and assign color
    const operonInfo = this.genomeBrowser.getGeneOperonInfo(gene, operons);

    // Override CSS background with operon-based color, UNLESS it's a primer
    if (geneType !== 'primer') {
      geneElement.style.background = `linear-gradient(135deg, ${operonInfo.color}, ${this.lightenColor(operonInfo.color, 20)})`;
      geneElement.style.borderColor = this.darkenColor(operonInfo.color, 20);
    }

    // Add operon-specific CSS classes
    if (operonInfo.isInOperon) {
      geneElement.classList.add('in-operon');
    } else {
      geneElement.classList.add('single-gene');
    }

    // Add user-defined feature styling
    if (gene.userDefined) {
      geneElement.classList.add('user-defined-feature');
    }

    if (gene.strand === -1) {
      geneElement.classList.add('reverse-strand');
    }

    // Check if this gene should be selected (maintain selection state)
    if (
      this.genomeBrowser.selectedGene &&
      this.genomeBrowser.selectedGene.gene &&
      this.genomeBrowser.selectedGene.gene.start === gene.start &&
      this.genomeBrowser.selectedGene.gene.end === gene.end &&
      this.genomeBrowser.selectedGene.gene.type === gene.type
    ) {
      geneElement.classList.add('selected');
    }
  }

  /**
   * Set gene element position and dimensions
   */
  setGeneElementPosition(geneElement, gene, viewport, rowIndex, layout, settings) {
    const geneStart = Math.max(gene.start, viewport.start);
    const geneEnd = Math.min(gene.end, viewport.end);
    const left = ((geneStart - viewport.start) / (viewport.end - viewport.start)) * 100;
    const width = ((geneEnd - geneStart) / (viewport.end - viewport.start)) * 100;

    geneElement.style.left = `${left}%`;
    geneElement.style.width = `${Math.max(width, 0.3)}%`;

    // Ensure minimum visibility
    if (width < 0.5) {
      geneElement.style.minWidth = '8px';
    }

    // Position based on row arrangement - only show if within maxRows
    if (rowIndex < layout.maxRows) {
      geneElement.style.top = `${layout.rulerHeight + layout.topPadding + rowIndex * (layout.geneHeight + layout.rowSpacing)}px`;
      geneElement.style.height = `${layout.geneHeight}px`;
      geneElement.style.display = 'block';
    } else {
      // Hide genes beyond maxRows
      geneElement.style.display = 'none';
      return; // Don't process text content for hidden genes
    }

    // Apply font settings
    const fontSize = settings?.fontSize || 11;
    const fontFamily = settings?.fontFamily || 'Arial, sans-serif';
    geneElement.style.fontSize = `${fontSize}px`;
    geneElement.style.fontFamily = fontFamily;
    geneElement.style.lineHeight = `${layout.geneHeight}px`;

    // Set text content and shape based on available space
    const geneName =
      this.genomeBrowser.getQualifierValue(gene.qualifiers, 'gene') ||
      this.genomeBrowser.getQualifierValue(gene.qualifiers, 'locus_tag') ||
      this.genomeBrowser.getQualifierValue(gene.qualifiers, 'product') ||
      gene.type;

    if (width < 1.0) {
      // Very small genes: use triangle shape with directional indicator
      geneElement.classList.add('gene-triangle-shape');
      geneElement.innerHTML = gene.strand === -1 ? '◀' : '▶';
      geneElement.style.textAlign = 'center';
      geneElement.style.fontSize = '10px';
      geneElement.style.lineHeight = `${layout.geneHeight}px`;
      geneElement.style.fontWeight = 'bold';
    } else if (width < 2.0) {
      // Small genes: use arrow indicator with abbreviated name
      geneElement.classList.add('gene-arrow-shape');
      const arrow = gene.strand === -1 ? '◂' : '▸';
      const shortName = geneName.length > 2 ? geneName.substring(0, 2) : geneName;
      geneElement.innerHTML = `${arrow}${shortName}`;
      geneElement.style.fontSize = '9px';
      geneElement.style.fontWeight = 'bold';
    } else if (width > 2) {
      geneElement.textContent = geneName.length > 12 ? geneName.substring(0, 12) + '...' : geneName;
    } else {
      geneElement.textContent = geneName.substring(0, 3);
    }

    // Create comprehensive tooltip
    this.setGeneElementTooltip(geneElement, gene, geneName, rowIndex);
  }

  /**
   * Set comprehensive tooltip for gene element
   */
  setGeneElementTooltip(geneElement, gene, geneName, rowIndex) {
    const geneInfo = `${geneName} (${gene.type})`;
    const positionInfo = `${gene.start}-${gene.end} (${gene.strand === -1 ? '-' : '+'} strand)`;
    const operonInfo = this.genomeBrowser.getGeneOperonInfo(gene, []);
    const operonInfo_display = operonInfo.isInOperon ? `\nOperon: ${operonInfo.operonName}` : '\nSingle gene';
    const rowInfo = `\nRow: ${rowIndex + 1}`;

    geneElement.title = `${geneInfo}\nPosition: ${positionInfo}${operonInfo_display}${rowInfo}`;
  }

  /**
   * Add interaction handlers to gene element
   */
  addGeneElementHandlers(geneElement, gene, operons) {
    geneElement.addEventListener('click', () => {
      const operonInfo = this.genomeBrowser.getGeneOperonInfo(gene, operons);
      this.showGeneDetails(gene, operonInfo);
    });
  }

  /**
   * Add statistics and update sidebar with improved organization
   */
  addGeneTrackStatistics(container, visibleGenes, operons, settings, layout) {
    // If layout not provided, calculate it (for backward compatibility)
    if (!layout) {
      const geneRows = this.arrangeGenesInRows(
        visibleGenes,
        this.getCurrentViewport().start,
        this.getCurrentViewport().end,
        operons,
        settings
      );
      layout = this.calculateGeneTrackLayout(geneRows, settings);
    }

    const geneRows = this.arrangeGenesInRows(
      visibleGenes,
      this.getCurrentViewport().start,
      this.getCurrentViewport().end,
      operons,
      settings
    );

    // Count visible and hidden genes
    const totalGenes = visibleGenes.length;
    let visibleGenesCount = 0;
    let hiddenGenesCount = 0;

    geneRows.forEach((rowGenes, rowIndex) => {
      if (rowIndex < layout.maxRows) {
        visibleGenesCount += rowGenes.length;
      } else {
        hiddenGenesCount += rowGenes.length;
      }
    });

    // Create statistics text
    let statsText = `${visibleGenesCount} features in ${Math.min(geneRows.length, layout.maxRows)} rows`;
    if (hiddenGenesCount > 0) {
      statsText += ` (${hiddenGenesCount} hidden)`;
    }

    const statsElement = this.createStatsElement(statsText, 'gene-stats', `top: ${layout.rulerHeight + 5}px;`);
    container.appendChild(statsElement);

    // Update sidebar operons panel
    const visibleOperons = new Set();
    geneRows.forEach((rowGenes, rowIndex) => {
      if (rowIndex < layout.maxRows) {
        rowGenes.forEach(gene => {
          const operonInfo = this.genomeBrowser.getGeneOperonInfo(gene, operons);
          if (operonInfo.isInOperon) {
            visibleOperons.add(operonInfo.operonName);
          }
        });
      }
    });

    this.updateOperonsPanel(operons, visibleOperons);
  }

  createSequenceLineTrack(chromosome, sequence) {
    const { track, trackContent } = this.createTrackBase('sequenceLine', chromosome);
    const viewport = this.getCurrentViewport();

    // Get subsequence for current viewport
    const subsequence = sequence.substring(viewport.start, viewport.end);

    // Get track settings for sequence line track
    const settings = this.getTrackSettings('sequenceLine');
    console.log('🔧 [createSequenceLineTrack] Using settings:', settings);

    // Create single-line sequence display with settings
    const seqDisplay = this.createSequenceDisplay(subsequence, viewport, settings);
    trackContent.appendChild(seqDisplay);

    // Restore header state if it was previously hidden
    console.log('🔧 [TrackRenderer] Restoring header state for sequence-line track');
    this.restoreHeaderState(track, 'sequence-line');

    return track;
  }

  /**
   * Create high-performance Canvas-based sequence display
   */
  createSequenceDisplay(subsequence, viewport, settings = {}) {
    // Create container for Canvas renderer
    const seqDisplay = document.createElement('div');
    seqDisplay.className = 'sequence-single-line sequence-canvas-container';
    seqDisplay.style.cssText = `
            position: relative;
            min-height: 20px;
            height: auto;
            max-height: ${settings.maxHeight || 50}px;
            overflow: hidden;
            width: 100%;
        `;

    // Generate unique ID for this track instance
    const trackId = `sequence-track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    seqDisplay.setAttribute('data-track-id', trackId);

    console.log('🎨 [TrackRenderer] Creating Canvas-based sequence display:', {
      subsequenceLength: subsequence.length,
      viewport: viewport,
      trackId: trackId,
    });

    // Check if CanvasSequenceRenderer is available
    if (typeof CanvasSequenceRenderer === 'undefined') {
      console.warn('⚠️ [TrackRenderer] CanvasSequenceRenderer not available, falling back to DOM rendering');
      return this.createSequenceDisplayFallback(subsequence, viewport);
    }

    // Create Canvas renderer with settings-based options
    const canvasOptions = {
      fontSize: settings.fontSize || 14,
      fontFamily: settings.fontFamily || 'Courier New, monospace',
      fontWeight: 'bold',
      backgroundColor: 'transparent',
      adaptiveHeight: settings.adaptiveHeight !== false,
      minHeight: 20,
      maxHeight: settings.maxHeight || 50,
      padding: 2,
      // Protein translation options
      showProteinTranslation: settings.showProteinTranslation || false,
      proteinTranslationMode: settings.proteinTranslationMode || 'all_frames',
      proteinFramesToShow: settings.proteinFramesToShow || [1, 2, 3],
      proteinFontSize: settings.proteinFontSize || 12,
    };

    try {
      const canvasRenderer = new CanvasSequenceRenderer(
        seqDisplay,
        subsequence,
        viewport,
        canvasOptions,
        this.genomeBrowser
      );

      // Store renderer for cleanup and updates
      this.canvasRenderers.set(trackId, canvasRenderer);

      // Update parent track content height after renderer is ready
      setTimeout(() => {
        this.updateSequenceTrackHeight(seqDisplay, canvasRenderer.canvasHeight);
      }, 100);

      console.log('✅ [TrackRenderer] Canvas sequence renderer created successfully');

      return seqDisplay;
    } catch (error) {
      console.error('❌ [TrackRenderer] Failed to create Canvas renderer:', error);
      // Fall back to DOM rendering if Canvas fails
      return this.createSequenceDisplayFallback(subsequence, viewport);
    }
  }

  /**
   * Fallback DOM-based sequence display for compatibility
   */
  createSequenceDisplayFallback(subsequence, viewport) {
    console.log('🔄 [TrackRenderer] Using DOM fallback for sequence display');

    const seqDisplay = document.createElement('div');
    seqDisplay.className = 'sequence-single-line sequence-dom-fallback';
    seqDisplay.style.cssText = `
            position: relative;
            min-height: 20px;
            height: auto;
            max-height: 50px;
            overflow: hidden;
            width: 100%;
            white-space: nowrap;
        `;

    // Simplified DOM rendering with basic adaptive sizing
    const sequenceLength = viewport.end - viewport.start;
    const adaptiveHeight = Math.max(20, 14 * 1.4);
    seqDisplay.style.height = `${adaptiveHeight}px`;

    // Create sequence bases with basic positioning
    for (let i = 0; i < subsequence.length; i++) {
      const baseElement = this.createBaseElement(subsequence[i], i, viewport, 14, 9.5);
      seqDisplay.appendChild(baseElement);
    }

    // Apply basic adaptive sizing
    setTimeout(() => {
      this.adjustSequenceDisplay(seqDisplay, subsequence, viewport);
    }, 100);

    return seqDisplay;
  }

  /**
   * Adjust sequence display after DOM is rendered
   */
  adjustSequenceDisplay(seqDisplay, subsequence, viewport) {
    if (!seqDisplay.parentElement) return;

    // Get actual container width
    const containerWidth = seqDisplay.parentElement.getBoundingClientRect().width || 800;
    const sequenceLength = viewport.end - viewport.start;

    // Measure actual character width for accurate calculation
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
      document.body.appendChild(testElement);
      const totalWidth = testElement.offsetWidth;
      const charWidth = totalWidth / count;
      document.body.removeChild(testElement);

      if (charWidth > 0) {
        measurements.push(charWidth);
      }
    });

    // Calculate average and use most consistent measurement
    const average = measurements.reduce((a, b) => a + b, 0) / measurements.length;
    const mostConsistent = measurements.reduce((prev, current) =>
      Math.abs(current - average) < Math.abs(prev - average) ? current : prev
    );

    const measuredCharWidth = mostConsistent > 0 ? mostConsistent : 9.5;

    // Use measured width or fallback
    const charWidth = measuredCharWidth > 0 ? measuredCharWidth : 9.5;
    // FIX: Don't add extra spacing - letter-spacing is already included in measurement
    const effectiveCharWidth = charWidth; // Remove +1 extra spacing

    // Recalculate with actual dimensions and measured character width - ADAPTIVE
    const maxFontSize = 20; // Increased max for better visibility
    const minFontSize = 6; // Increased min for readability
    const availableWidth = containerWidth; // FIX: Use 100% of container width
    const maxCharWidth = availableWidth / sequenceLength;

    let fontSize = maxFontSize;
    let estimatedCharWidth = fontSize * 0.6;

    // More sophisticated adaptive sizing with finer control
    while (estimatedCharWidth > maxCharWidth && fontSize > minFontSize) {
      fontSize -= 0.25; // Smaller increments for finer control
      estimatedCharWidth = fontSize * 0.6;
    }

    const finalFontSize = Math.max(minFontSize, Math.min(maxFontSize, fontSize));
    const finalCharWidth = availableWidth / sequenceLength;

    // Update container height based on final font size
    const adaptiveHeight = Math.max(20, finalFontSize * 1.4);
    seqDisplay.style.height = `${adaptiveHeight}px`;

    console.log('🔧 [TrackRenderer] Adjusted sequence display:', {
      containerWidth,
      sequenceLength,
      charWidth,
      effectiveCharWidth,
      finalFontSize,
      finalCharWidth,
      measurements: measurements.map(m => m.toFixed(3)),
      average: average.toFixed(3),
      selectedWidth: measuredCharWidth.toFixed(3),
    });

    // FIX: Update all base elements with percentage-based positioning for exact fit
    const baseElements = seqDisplay.querySelectorAll('.sequence-base-inline');
    const totalSequenceLength = baseElements.length;
    const exactCharWidth = 100 / totalSequenceLength; // Use percentage

    baseElements.forEach((element, index) => {
      const leftPosition = index * exactCharWidth;
      element.style.left = `${leftPosition}%`;
      element.style.width = `${exactCharWidth}%`;
      element.style.fontSize = `${finalFontSize}px`;
      element.style.boxSizing = 'border-box';
    });
  }

  /**
   * Create individual base element
   */
  createBaseElement(base, index, viewport, fontSize, charWidth) {
    const baseElement = document.createElement('span');
    baseElement.className = `base-${base.toLowerCase()} sequence-base-inline`;
    baseElement.textContent = base;

    // FIX: Calculate exact positioning to fill entire container
    const totalSequenceLength = viewport.end - viewport.start;
    // Each character should take exactly its portion of the available space
    const exactCharWidth = 100 / totalSequenceLength; // Use percentage-based width
    const leftPosition = index * exactCharWidth;

    baseElement.style.cssText = `
            position: absolute;
            left: ${leftPosition}%;
            width: ${exactCharWidth}%;
            height: 100%;
            font-size: ${fontSize}px;
            font-family: 'Courier New', Consolas, Monaco, monospace;
            font-weight: bold;
            text-align: center;
            line-height: 1.2;
            overflow: hidden;
            white-space: nowrap;
            box-sizing: border-box;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

    // Add tooltip with position info
    // FIX: Remove +1 offset - index is already 0-based within the subsequence
    const position = viewport.start + index;
    baseElement.title = `Position: ${position}, Base: ${base}`;

    return baseElement;
  }

  createGCTrack(chromosome, sequence) {
    const { track, trackContent } = this.createTrackBase('gc', chromosome);
    const viewport = this.getCurrentViewport();

    // Get subsequence for current viewport
    const subsequence = sequence.substring(viewport.start, viewport.end);

    // Create enhanced GC content and skew visualization
    const gcDisplay = this.createEnhancedGCVisualization(subsequence, viewport.start, viewport.end);
    trackContent.appendChild(gcDisplay);

    // Restore header state if it was previously hidden
    this.restoreHeaderState(track, 'gc');

    return track;
  }

  createVariantTrack(chromosome) {
    // Check if we have multiple VCF files
    const vcfFiles = this.genomeBrowser.multiFileManager.getVcfFiles();

    if (vcfFiles.length > 1) {
      // Create multiple variant tracks
      return this.createMultipleVariantTracks(chromosome, vcfFiles);
    } else if (vcfFiles.length === 1) {
      // Create single variant track with file-specific header
      return this.createSingleVariantTrack(chromosome, vcfFiles[0]);
    } else {
      // Fallback to legacy mode
      return this.createLegacyVariantTrack(chromosome);
    }
  }

  createLegacyVariantTrack(chromosome) {
    const { track, trackContent } = this.createTrackBase('variants', chromosome);
    const viewport = this.getCurrentViewport();

    // Get variant track settings
    const settings = this.getTrackSettings('variants');

    // Check if we have any variant data at all
    if (!this.genomeBrowser.currentVariants || Object.keys(this.genomeBrowser.currentVariants).length === 0) {
      const noDataMsg = this.createNoDataMessage(
        'No VCF file loaded. Load a VCF file to see variants.',
        'no-variants-message'
      );
      trackContent.appendChild(noDataMsg);
      return track;
    }

    // Get and filter variants
    const variants = this.genomeBrowser.currentVariants[chromosome] || [];
    const visibleVariants = this.filterFeaturesByViewport(variants, viewport);

    console.log(`Displaying ${visibleVariants.length} variants in region ${viewport.start}-${viewport.end}`);

    if (visibleVariants.length === 0) {
      const noVariantsMsg = this.createNoDataMessage('No variants in this region', 'no-variants-message');
      trackContent.appendChild(noVariantsMsg);
    } else {
      this.renderVariantElements(trackContent, visibleVariants, viewport, settings);
    }

    // Restore header state if it was previously hidden
    this.restoreHeaderState(track, 'variants');

    return track;
  }

  /**
   * Render variant elements
   */
  renderVariantElements(trackContent, visibleVariants, viewport, settings = {}) {
    // Apply quality filter if set
    let filteredVariants = visibleVariants;
    if (settings.minQuality > 0) {
      filteredVariants = visibleVariants.filter(v => (v.quality || 0) >= settings.minQuality);
    }

    // Apply max display count limit
    const maxDisplayCount = settings.maxDisplayCount || 200;
    if (filteredVariants.length > maxDisplayCount) {
      filteredVariants = filteredVariants.slice(0, maxDisplayCount);
    }

    // Assign row indices for vertical stacking if needed
    filteredVariants = this.assignVariantRowIndices(filteredVariants, viewport);

    filteredVariants.forEach((variant, index) => {
      const variantElement = this.createVariantElement(variant, viewport, settings);
      trackContent.appendChild(variantElement);
    });
  }

  /**
   * Assign row indices to variants for vertical stacking
   */
  assignVariantRowIndices(variants, viewport) {
    // Simple row assignment - variants that overlap get different rows
    const rows = [];

    variants.forEach(variant => {
      let assignedRow = 0;

      // Find a row where this variant doesn't overlap with existing variants
      for (let i = 0; i < rows.length; i++) {
        const canFit = !rows[i].some(existingVariant => {
          return !(variant.end < existingVariant.start || variant.start > existingVariant.end);
        });

        if (canFit) {
          assignedRow = i;
          break;
        }

        // If can't fit in this row, try next row
        assignedRow = i + 1;
      }

      // Initialize row if needed
      if (!rows[assignedRow]) {
        rows[assignedRow] = [];
      }

      rows[assignedRow].push(variant);
      variant.rowIndex = assignedRow;
    });

    return variants;
  }

  /**
   * Create individual variant element
   */
  createVariantElement(variant, viewport, settings = {}) {
    const variantElement = document.createElement('div');
    variantElement.className = 'variant-element';

    // Calculate position and dimensions
    const variantStart = Math.max(variant.start, viewport.start);
    const variantEnd = Math.min(variant.end, viewport.end);
    const left = ((variantStart - viewport.start) / (viewport.end - viewport.start)) * 100;
    const width = Math.max(((variantEnd - variantStart) / (viewport.end - viewport.start)) * 100, 0.2);

    // Get variant color based on settings
    const variantColor = this.getVariantColor(variant, settings);

    // Get dimensions from settings
    const elementHeight = settings.elementHeight || 12;
    const rowSpacing = settings.rowSpacing || 8;

    variantElement.style.cssText = `
            left: ${left}%;
            width: ${width}%;
            height: ${elementHeight}px;
            top: ${20 + (variant.rowIndex || 0) * (elementHeight + rowSpacing)}px;
            position: absolute;
            background: ${variantColor};
            border-radius: 2px;
            cursor: pointer;
        `;

    // Create variant tooltip and click handler
    this.addVariantInteraction(variantElement, variant);

    return variantElement;
  }

  /**
   * Get variant color based on settings
   */
  getVariantColor(variant, settings = {}) {
    const colorMode = settings.colorMode || 'type';

    switch (colorMode) {
      case 'type':
        return this.getVariantColorByType(variant, settings);
      case 'impact':
        return this.getVariantColorByImpact(variant, settings);
      case 'quality':
        return this.getVariantColorByQuality(variant, settings);
      case 'custom':
        return settings.customColor || '#e74c3c';
      default:
        return '#e74c3c';
    }
  }

  /**
   * Get variant color by type (SNP/INDEL/SV)
   */
  getVariantColorByType(variant, settings = {}) {
    const type = this.classifyVariantType(variant);

    switch (type) {
      case 'SNP':
        return settings.snpColor || '#e74c3c';
      case 'INDEL':
        return settings.indelColor || '#3498db';
      case 'SV':
        return settings.svColor || '#9b59b6';
      default:
        return '#e74c3c';
    }
  }

  /**
   * Get variant color by impact severity
   */
  getVariantColorByImpact(variant, settings = {}) {
    // Try to get impact from variant info or analysis
    const impact = variant.impact || variant.severity || 'MODIFIER';

    switch (impact.toUpperCase()) {
      case 'HIGH':
        return settings.highImpactColor || '#e74c3c';
      case 'MODERATE':
        return settings.moderateImpactColor || '#f39c12';
      case 'LOW':
        return settings.lowImpactColor || '#2ecc71';
      case 'MODIFIER':
      default:
        return settings.modifierImpactColor || '#95a5a6';
    }
  }

  /**
   * Get variant color by quality score
   */
  getVariantColorByQuality(variant, settings = {}) {
    const quality = parseFloat(variant.quality) || 0;
    const minQuality = settings.minQuality || 0;
    const maxQuality = 100; // Assume max quality is 100

    if (quality < minQuality) {
      return '#cccccc'; // Gray for low quality
    }

    // Gradient from red (low) to green (high)
    const ratio = Math.min(quality / maxQuality, 1);
    const r = Math.floor(255 * (1 - ratio));
    const g = Math.floor(255 * ratio);
    const b = 0;

    return `rgb(${r}, ${g}, ${b})`;
  }

  /**
   * Classify variant type based on ref and alt alleles
   */
  classifyVariantType(variant) {
    const ref = (variant.ref || '').toUpperCase();
    const alt = (variant.alt || '').toUpperCase();

    // Check for structural variants
    if (variant.type) {
      const type = variant.type.toUpperCase();
      if (
        type.includes('SV') ||
        type.includes('DEL') ||
        type.includes('DUP') ||
        type.includes('INV') ||
        type.includes('BND') ||
        type.includes('CNV')
      ) {
        return 'SV';
      }
      if (type.includes('SNP') || type.includes('SNV')) {
        return 'SNP';
      }
      if (type.includes('INDEL') || type.includes('INS') || type.includes('DEL')) {
        return 'INDEL';
      }
    }

    // Classify based on allele lengths
    const refLen = ref.length;
    const altLen = alt.length;

    // SNP: single nucleotide substitution
    if (refLen === 1 && altLen === 1 && ref !== alt) {
      return 'SNP';
    }

    // INDEL: insertion or deletion
    if (refLen !== altLen) {
      return 'INDEL';
    }

    // Multi-nucleotide substitution (MNP)
    if (refLen > 1 && refLen === altLen) {
      return 'SNP'; // Treat as SNP for coloring purposes
    }

    // Structural variant: large changes
    if (Math.abs(refLen - altLen) > 50 || refLen > 50 || altLen > 50) {
      return 'SV';
    }

    // Default to SNP
    return 'SNP';
  }

  /**
   * Add interaction handlers to variant element
   */
  addVariantInteraction(variantElement, variant) {
    // Basic tooltip for quick info
    const variantInfo =
      `Variant: ${variant.id || 'Unknown'}\n` +
      `Position: ${variant.start + 1}\n` + // Convert to 1-based
      `Ref: ${variant.ref || 'N/A'}\n` +
      `Alt: ${variant.alt || 'N/A'}\n` +
      `Quality: ${variant.quality || 'N/A'}`;

    variantElement.title = variantInfo;

    // Enhanced click handler with detailed analysis
    variantElement.addEventListener('click', async event => {
      event.stopPropagation();

      try {
        // Show loading state
        this.showVariantAnalysisLoading();

        // Initialize variant analyzer if not already done
        if (!this.variantAnalyzer) {
          this.variantAnalyzer = new VariantAnalyzer(this.genomeBrowser);
        }

        // Perform comprehensive analysis
        const analysis = await this.variantAnalyzer.analyzeVariant(variant);

        // Display results in sidebar
        this.displayVariantAnalysis(analysis);
      } catch (error) {
        console.error('Error analyzing variant:', error);
        this.showVariantAnalysisError(error.message);
      }
    });

    // Add hover effects
    variantElement.addEventListener('mouseenter', () => {
      variantElement.style.transform = 'scaleY(1.2)';
      variantElement.style.zIndex = '10';
    });

    variantElement.addEventListener('mouseleave', () => {
      variantElement.style.transform = 'scaleY(1)';
      variantElement.style.zIndex = '1';
    });
  }

  /**
   * Show loading state for variant analysis
   */
  showVariantAnalysisLoading() {
    const variantSection = document.getElementById('variantDetailsSection');
    const variantContent = document.getElementById('variantDetailsContent');

    if (!variantSection || !variantContent) {
      console.error('Variant details section not found in sidebar');
      return;
    }

    // Show loading content
    variantContent.innerHTML = `
            <div class="variant-loading">
                <div class="loading-spinner">
                    <i class="fas fa-spinner fa-spin"></i>
                </div>
                <p>Analyzing variant impact...</p>
                <div class="loading-steps">
                    <div class="step active">📍 Identifying genomic location</div>
                    <div class="step">🧬 Finding affected genes</div>
                    <div class="step">⚡ Predicting functional impact</div>
                    <div class="step">🔬 Analyzing amino acid changes</div>
                </div>
            </div>
        `;

    // Show variant details panel and scroll sidebar to it
    this.genomeBrowser.showVariantDetailsPanel();
  }

  /**
   * Display comprehensive variant analysis results
   */
  displayVariantAnalysis(analysis) {
    const variantContent = document.getElementById('variantDetailsContent');

    if (!variantContent) {
      console.error('Variant details content area not found');
      return;
    }

    // Generate detailed HTML report
    const reportHTML = this.variantAnalyzer.generateVariantReport(analysis);

    // Reset section header if it was changed by read mutation selection
    const variantDetailsSection = document.getElementById('variantDetailsSection');
    if (variantDetailsSection) {
      const header = variantDetailsSection.querySelector('h3');
      if (header) {
        header.textContent = 'Variant Details';
        header.classList.remove('read-mutation-title');
      }
    }

    // Add analysis timestamp and summary stats
    const summaryHTML = `
            <div class="analysis-summary">
                <div class="analysis-timestamp">
                    <i class="fas fa-clock"></i>
                    Analysis completed: ${new Date().toLocaleTimeString()}
                </div>
                <div class="analysis-stats">
                    <span class="stat-item">
                        <i class="fas fa-dna"></i>
                        ${analysis.affectedGenes.length} features affected
                    </span>
                    <span class="stat-item">
                        <i class="fas fa-exclamation-triangle"></i>
                        ${analysis.impact.severity} impact
                    </span>
                </div>
            </div>
        `;

    variantContent.innerHTML = summaryHTML + reportHTML;

    // Scroll to top of analysis
    variantContent.scrollTop = 0;

    // Show variant details panel and scroll sidebar to it
    this.genomeBrowser.showVariantDetailsPanel();

    console.log('Variant analysis displayed:', analysis);
  }

  /**
   * Show error message for variant analysis
   */
  showVariantAnalysisError(errorMessage) {
    const variantContent = document.getElementById('variantDetailsContent');

    if (!variantContent) {
      return;
    }

    variantContent.innerHTML = `
            <div class="variant-analysis-error">
                <div class="error-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <h4>Analysis Failed</h4>
                <p>Unable to complete variant analysis:</p>
                <div class="error-details">${errorMessage}</div>
                <button class="btn btn-sm retry-analysis" onclick="location.reload()">
                    <i class="fas fa-redo"></i> Retry
                </button>
            </div>
        `;
  }

  /**
   * Create multiple variant tracks for multiple VCF files
   */
  createMultipleVariantTracks(chromosome, vcfFiles) {
    const tracksContainer = document.createElement('div');
    tracksContainer.className = 'multi-variant-tracks-container';

    for (let i = 0; i < vcfFiles.length; i++) {
      const vcfFile = vcfFiles[i];

      if (this.genomeBrowser.multiFileManager.getTrackVisibility(vcfFile.trackId)) {
        const track = this.createSingleVariantTrack(chromosome, vcfFile);
        if (track) {
          tracksContainer.appendChild(track);

          // Add splitter between variant tracks (except after the last one)
          if (i < vcfFiles.length - 1) {
            const nextVcfFile = vcfFiles[i + 1];
            if (this.genomeBrowser.multiFileManager.getTrackVisibility(nextVcfFile.trackId)) {
              const splitter = this.genomeBrowser.createTrackSplitter(
                `variant-${vcfFile.metadata.id}`,
                `variant-${nextVcfFile.metadata.id}`
              );
              splitter.classList.add('multi-file-splitter');
              splitter.setAttribute('data-file-type', 'variant');
              tracksContainer.appendChild(splitter);
            }
          }
        }
      }
    }

    return tracksContainer;
  }

  /**
   * Create single variant track with file-specific header
   */
  createSingleVariantTrack(chromosome, vcfFile) {
    const viewport = this.getCurrentViewport();

    // Get instance-specific variant track settings
    const settings = this.getTrackSettings('variants', vcfFile.metadata.id);

    // Create track base
    const track = document.createElement('div');
    track.className = 'variant-track';
    track.dataset.fileId = vcfFile.metadata.id;

    // Create file-specific header with rename capability
    const trackHeader = this.createTrackHeader(
      vcfFile.metadata.name,
      'variants',
      vcfFile.metadata.id,
      true // isRenameable
    );
    track.appendChild(trackHeader);

    // Create track content
    const trackContent = this.createTrackContent(settings.height || 80, chromosome);
    track.appendChild(trackContent);

    try {
      // Get variants for this specific file
      const variants = vcfFile.data[chromosome] || [];
      const visibleVariants = this.filterFeaturesByViewport(variants, viewport);

      console.log(
        `Displaying ${visibleVariants.length} variants from ${vcfFile.metadata.name} in region ${viewport.start}-${viewport.end}`
      );

      if (visibleVariants.length === 0) {
        const noVariantsMsg = this.createNoDataMessage(
          `No variants found in this region for ${vcfFile.metadata.name}`,
          'no-variants-message'
        );
        trackContent.appendChild(noVariantsMsg);
      } else {
        this.renderVariantElements(trackContent, visibleVariants, viewport, settings);

        // Add file-specific statistics
        const statsText = `${vcfFile.metadata.name}: ${visibleVariants.length} variants`;
        const statsElement = this.createStatsElement(statsText, 'variant-track-stats');
        trackContent.appendChild(statsElement);
      }
    } catch (error) {
      console.error(`Error loading variants for ${vcfFile.metadata.name}:`, error);
      const errorMsg = this.createNoDataMessage(`Error loading variants: ${error.message}`, 'variant-error-message');
      trackContent.appendChild(errorMsg);
    }

    // Restore header state if it was previously hidden
    this.restoreHeaderState(track, 'variants');

    return track;
  }

  /**
   * Create variant track content without header (for zoom updates)
   */
  createVariantTrackContent(chromosome, vcfFile, viewport = null) {
    viewport = viewport || this.getCurrentViewport();

    // Get instance-specific variant track settings
    const settings = this.getTrackSettings('variants', vcfFile.metadata.id);

    const trackContent = this.createTrackContent(settings.height || 80, chromosome);

    try {
      // Get variants for this specific file
      const variants = vcfFile.data[chromosome] || [];
      const visibleVariants = this.filterFeaturesByViewport(variants, viewport);

      console.log(
        `[createVariantTrackContent] Displaying ${visibleVariants.length} variants from ${vcfFile.metadata.name} in region ${viewport.start}-${viewport.end}`
      );

      if (visibleVariants.length === 0) {
        const noVariantsMsg = this.createNoDataMessage(
          `No variants found in this region for ${vcfFile.metadata.name}`,
          'no-variants-message'
        );
        trackContent.appendChild(noVariantsMsg);
      } else {
        this.renderVariantElements(trackContent, visibleVariants, viewport, settings);

        // Add file-specific statistics
        const statsText = `${vcfFile.metadata.name}: ${visibleVariants.length} variants`;
        const statsElement = this.createStatsElement(statsText, 'variant-track-stats');
        trackContent.appendChild(statsElement);
      }
    } catch (error) {
      console.error(`Error loading variants for ${vcfFile.metadata.name}:`, error);
      const errorMsg = this.createNoDataMessage(`Error loading variants: ${error.message}`, 'variant-error-message');
      trackContent.appendChild(errorMsg);
    }

    return trackContent;
  }

  /**
   * Create legacy variant track content without header (for zoom updates)
   */
  createLegacyVariantTrackContent(chromosome, viewport = null) {
    viewport = viewport || this.getCurrentViewport();

    // Get variant track settings
    const settings = this.getTrackSettings('variants');

    const trackContent = this.createTrackContent(settings.height || 80, chromosome);

    // Check if we have any variant data at all
    if (!this.genomeBrowser.currentVariants || Object.keys(this.genomeBrowser.currentVariants).length === 0) {
      const noDataMsg = this.createNoDataMessage(
        'No VCF file loaded. Load a VCF file to see variants.',
        'no-variants-message'
      );
      trackContent.appendChild(noDataMsg);
      return trackContent;
    }

    // Get and filter variants
    const variants = this.genomeBrowser.currentVariants[chromosome] || [];
    const visibleVariants = this.filterFeaturesByViewport(variants, viewport);

    console.log(
      `[createLegacyVariantTrackContent] Displaying ${visibleVariants.length} variants in region ${viewport.start}-${viewport.end}`
    );

    if (visibleVariants.length === 0) {
      const noVariantsMsg = this.createNoDataMessage('No variants in this region', 'no-variants-message');
      trackContent.appendChild(noVariantsMsg);
    } else {
      this.renderVariantElements(trackContent, visibleVariants, viewport, settings);

      // Add statistics
      const statsText = `${visibleVariants.length} variants`;
      const statsElement = this.createStatsElement(statsText, 'variant-track-stats');
      trackContent.appendChild(statsElement);
    }

    return trackContent;
  }

  async createReadsTrack(chromosome) {
    console.log('🔧 [DEBUG] [createReadsTrack] Entry point called for chromosome:', chromosome);
    // Check if we have multiple BAM files
    const bamFiles = this.genomeBrowser.multiFileManager.getBamFiles();
    console.log('🔧 [DEBUG] [createReadsTrack] Found BAM files:', bamFiles.length);

    if (bamFiles.length > 1) {
      // Create multiple reads tracks
      return this.createMultipleReadsTracks(chromosome, bamFiles);
    } else if (bamFiles.length === 1) {
      // Create single reads track with file-specific header
      return this.createSingleReadsTrack(chromosome, bamFiles[0]);
    } else {
      // Fallback to legacy mode
      return this.createLegacyReadsTrack(chromosome);
    }
  }

  /**
   * Create legacy reads track content without header (for zoom updates)
   */
  async createLegacyReadsTrackContent(chromosome, viewport = null) {
    viewport = viewport || this.getCurrentViewport();
    const trackContent = this.createTrackContent(this.trackConfig.reads.defaultHeight, chromosome);

    // CRITICAL FIX: Get and apply track settings for reads track content updates during zoom
    const rawSettings = this.getTrackSettings('reads');
    const settings = JSON.parse(JSON.stringify(rawSettings));

    // BUGFIX: Ensure critical display settings are properly initialized
    settings.opacity = settings.opacity ?? 0.9;
    settings.readHeight = settings.readHeight ?? 4;
    settings.readSpacing = settings.readSpacing ?? 2;
    settings.minWidth = settings.minWidth ?? 2;
    settings.forwardColor = settings.forwardColor ?? '#00b894';
    settings.reverseColor = settings.reverseColor ?? '#f39c12';
    settings.borderColor = settings.borderColor ?? '#ffffff';
    settings.borderWidth = settings.borderWidth ?? 0;
    settings.showCoverage = settings.showCoverage ?? true;
    // CRITICAL FIX: Force showReference to true if undefined/null to prevent reads not showing
    settings.showReference = settings.showReference !== false ? true : false;

    console.log(`🔍 [createLegacyReadsTrackContent] Applied settings during zoom:`, settings);

    // Check if ReadsManager has data loaded (either in-memory, streaming, or BAM mode)
    const hasReadsData =
      this.genomeBrowser.readsManager.rawReadsData ||
      this.genomeBrowser.readsManager.isStreaming ||
      this.genomeBrowser.readsManager.isBamMode ||
      this.genomeBrowser.readsManager.currentFile;

    if (!hasReadsData) {
      const noDataMsg = document.createElement('div');
      noDataMsg.className = 'no-reads-message';
      noDataMsg.textContent = 'No SAM/BAM file loaded. Load a SAM/BAM file to see aligned reads.';
      noDataMsg.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: #666;
                font-style: italic;
                font-size: 14px;
                text-align: center;
            `;
      trackContent.appendChild(noDataMsg);
      trackContent.style.height = '100px'; // Default height for empty track
    } else {
      // Get reads for current region using ReadsManager with settings
      const visibleReads = await this.genomeBrowser.readsManager.getReadsForRegion(
        chromosome,
        viewport.start,
        viewport.end,
        settings
      );

      // Update sampling display based on whether sampling was applied
      const isSampled = visibleReads._samplingInfo !== undefined;
      this.updateSamplingDisplayBasedOnReadsCount(visibleReads.length, isSampled);

      if (visibleReads.length === 0) {
        const noReadsMsg = this.createNoDataMessage('No reads in this region or all filtered out', 'no-reads-message');
        trackContent.appendChild(noReadsMsg);
      } else {
        // Render the reads using the same logic as the main track
        const readsContainer = this.createReadsVisualization(visibleReads, viewport.start, viewport.end, settings);
        trackContent.appendChild(readsContainer);

        // Update track height based on reads content
        if (readsContainer.style.height) {
          trackContent.style.height = readsContainer.style.height;
        }
      }
      trackContent.style.height = '100px';
    }

    return trackContent;
  }

  async createLegacyReadsTrack(chromosome) {
    const { track, trackContent } = this.createTrackBase('reads', chromosome);
    const viewport = this.getCurrentViewport();

    // Check if ReadsManager has data loaded (either in-memory, streaming, or BAM mode)
    const hasReadsData =
      this.genomeBrowser.readsManager.rawReadsData ||
      this.genomeBrowser.readsManager.isStreaming ||
      this.genomeBrowser.readsManager.isBamMode ||
      this.genomeBrowser.readsManager.currentFile;

    if (!hasReadsData) {
      const noDataMsg = document.createElement('div');
      noDataMsg.className = 'no-reads-message';
      noDataMsg.textContent = 'No SAM/BAM file loaded. Load a SAM/BAM file to see aligned reads.';
      noDataMsg.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: #666;
                font-style: italic;
                font-size: 12px;
            `;
      trackContent.appendChild(noDataMsg);
      trackContent.style.height = '80px'; // Default height for empty track

      // Restore header state if it was previously hidden
      this.restoreHeaderState(track, 'reads');
      return track;
    }

    // Show loading indicator while fetching reads
    const loadingMsg = document.createElement('div');
    loadingMsg.className = 'reads-loading';
    loadingMsg.textContent = 'Loading reads...';
    loadingMsg.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: #666;
            font-style: italic;
            font-size: 12px;
        `;
    trackContent.appendChild(loadingMsg);

    try {
      // Get track settings first and create a deep copy to avoid modifying defaults
      const rawSettings = this.getTrackSettings('reads');
      const settings = JSON.parse(JSON.stringify(rawSettings));

      // BUGFIX: Ensure critical display settings are properly initialized
      // The issue was that reads weren't showing initially due to incomplete settings
      settings.opacity = settings.opacity ?? 0.9;
      settings.readHeight = settings.readHeight ?? 4;
      settings.readSpacing = settings.readSpacing ?? 2;
      settings.minWidth = settings.minWidth ?? 2;
      settings.forwardColor = settings.forwardColor ?? '#00b894';
      settings.reverseColor = settings.reverseColor ?? '#f39c12';
      settings.borderColor = settings.borderColor ?? '#ffffff';
      settings.borderWidth = settings.borderWidth ?? 0;
      settings.showCoverage = settings.showCoverage ?? true;
      // CRITICAL FIX: Force showReference to true if undefined/null to prevent reads not showing
      settings.showReference = settings.showReference !== false ? true : false;

      // Apply the corrected settings immediately to ensure proper rendering
      this.trackSettings = this.trackSettings || {};
      this.trackSettings['reads'] = settings;

      console.log(`🎯 [TrackRenderer] === READS TRACK CREATION DEBUG START ===`);
      console.log(`🎯 [TrackRenderer] Creating reads track for region ${chromosome}:${viewport.start}-${viewport.end}`);
      console.log(`🎯 [TrackRenderer] Track settings (with defaults):`, settings);
      console.log(`🔍 [DEBUG] showReference setting: ${settings.showReference}`);

      // Get reads for current region using ReadsManager with settings
      const visibleReads = await this.genomeBrowser.readsManager.getReadsForRegion(
        chromosome,
        viewport.start,
        viewport.end,
        settings
      );

      console.log(`🎯 [TrackRenderer] Retrieved reads for sequence display check:`, {
        readsCount: visibleReads.length,
        hasSequenceData: visibleReads.length > 0 && visibleReads.some(read => read.sequence),
        sampleReads: visibleReads.slice(0, 3).map(read => ({
          id: read.id,
          hasSequence: !!read.sequence,
          sequenceLength: read.sequence ? read.sequence.length : 0,
          sequencePreview: read.sequence ? read.sequence.substring(0, 10) + '...' : 'NO_SEQUENCE',
        })),
      });

      // Remove loading message
      trackContent.removeChild(loadingMsg);

      console.log(
        `🎯 [TrackRenderer] Retrieved ${visibleReads.length} reads for display in region ${viewport.start}-${viewport.end}`
      );

      // Update sampling display based on whether sampling was applied
      // Check _samplingInfo to determine if sampling was applied
      const isSampled = visibleReads._samplingInfo !== undefined;
      this.updateSamplingDisplayBasedOnReadsCount(visibleReads.length, isSampled);

      // Check if we have any potential filtering issues
      if (visibleReads.length === 0) {
        console.warn(`⚠️ [TrackRenderer] NO READS TO DISPLAY! Debugging info:`);
        console.warn(`   - Chromosome: ${chromosome}`);
        console.warn(`   - Region: ${viewport.start}-${viewport.end}`);
        console.warn(`   - Settings:`, settings);
        console.warn(`   - ReadsManager mode: ${this.genomeBrowser.readsManager.isBamMode ? 'BAM' : 'SAM'}`);
        console.warn(`   - Current file: ${this.genomeBrowser.readsManager.currentFile}`);
      } else {
        // Log sample reads and their properties
        console.log(
          `🎯 [TrackRenderer] Sample reads (first 3):`,
          visibleReads.slice(0, 3).map(read => ({
            id: read.id,
            chromosome: read.chromosome,
            position: `${read.start}-${read.end}`,
            strand: read.strand,
            mappingQuality: read.mappingQuality,
            flags: read.flags,
          }))
        );

        // Check mapping quality distribution
        const mappingQualities = visibleReads.map(read => read.mappingQuality || 0);
        const minMQ = Math.min(...mappingQualities);
        const maxMQ = Math.max(...mappingQualities);
        const avgMQ = mappingQualities.reduce((a, b) => a + b, 0) / mappingQualities.length;

        console.log(`🎯 [TrackRenderer] Mapping quality stats:`, {
          min: minMQ,
          max: maxMQ,
          average: avgMQ.toFixed(1),
          count: visibleReads.length,
        });
      }

      if (visibleReads.length === 0) {
        const noReadsMsg = document.createElement('div');
        noReadsMsg.className = 'no-reads-message';
        noReadsMsg.textContent = 'No reads in this region';
        noReadsMsg.style.cssText = `
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    color: #666;
                    font-style: italic;
                    font-size: 12px;
                `;
        trackContent.appendChild(noReadsMsg);
        trackContent.style.height = '80px'; // Default height for empty track
      } else {
        // Create coverage visualization if enabled (respect toggle state)
        const showCoverage = settings.showCoverage !== false && this.elementVisibilityStates.readsCoverage;
        let coverageHeight = 0;

        // Only create SVG coverage if NOT using canvas mode (CanvasReadsRenderer handles its own coverage)
        const isCanvasMode = (settings.renderingMode || 'canvas') === 'canvas';

        if (showCoverage && !isCanvasMode) {
          coverageHeight = parseInt(settings.coverageHeight) || 50;
          this.createCoverageVisualization(trackContent, visibleReads, viewport, coverageHeight, settings);
        } else if (showCoverage && isCanvasMode) {
          // For Canvas mode, we don't create SVG but we might need to know the height for calculations if we were mixing,
          // but since Canvas handles everything, we can treat external coverage height as 0
          // and let CanvasReadsRenderer handle the layout internally.
          coverageHeight = 0;
        }

        // Create fixed reference visualization above reads (respect toggle state)
        let referenceHeight = 0;
        const showReference = settings.showReference !== false && this.elementVisibilityStates.readsReference;
        if (showReference) {
          referenceHeight = parseInt(settings.referenceHeight) || 25;
          this.createReferenceVisualization(trackContent, viewport, referenceHeight, settings);
        }

        // Arrange reads into non-overlapping rows
        const readRows = this.arrangeReadsInRows(visibleReads, viewport.start, viewport.end);

        const readHeight = settings.readHeight || 14;
        const rowSpacing = settings.readSpacing || 2;
        // Adjust top padding based on fixed elements above (coverage + reference)
        const topPadding = showCoverage || referenceHeight > 0 ? coverageHeight + referenceHeight + 2 : 10;
        const bottomPadding = 10;

        // Total height above reads (coverage + reference + spacing)
        const totalTopHeight = coverageHeight + referenceHeight;

        // Check if vertical scrolling is enabled and needed (disabled by default to match original Canvas behavior)
        const enableVerticalScroll =
          settings.enableVerticalScroll === true && readRows.length > (settings.maxVisibleRows || 10);

        if (enableVerticalScroll) {
          // Create scrollable reads track with all rows
          this.createScrollableReadsTrack(
            trackContent,
            readRows,
            viewport,
            readHeight,
            rowSpacing,
            topPadding,
            bottomPadding,
            settings
          );
        } else {
          // Use traditional limited rows approach
          const maxRows = settings.maxRows || 20;
          const limitedReadRows = readRows.slice(0, maxRows);

          // Calculate adaptive track height including reference sequence
          let trackHeight;
          if (renderingMode === 'canvas') {
            // For Canvas mode, we calculate height based on internal canvas layout
            // coverage (55) + reference (25) + reads
            let canvasTopSpace = 5;
            if (showCoverage) canvasTopSpace += 55;
            if (showReference) canvasTopSpace += 25;
            trackHeight = canvasTopSpace + limitedReadRows.length * (readHeight + rowSpacing) + bottomPadding;
          } else {
            // For SVG mode, we account for separate DOM elements
            trackHeight =
              totalTopHeight +
              topPadding +
              limitedReadRows.length * (readHeight + rowSpacing) -
              rowSpacing +
              bottomPadding;
          }

          trackHeight = Math.max(trackHeight, settings.height || 150);
          trackContent.style.height = `${trackHeight}px`;

          // Render reads using Canvas or SVG based on settings
          const renderingMode = settings.renderingMode || 'canvas';
          console.log(
            `🔧 [DEBUG] [TrackRenderer] Selected rendering mode: ${renderingMode} (from settings: ${settings.renderingMode})`
          );
          console.log(`🔧 [DEBUG] [TrackRenderer] Full settings object:`, settings);

          if (renderingMode === 'canvas') {
            console.log(`🎨 [DEBUG] [TrackRenderer] Switching to Canvas rendering mode`);
          } else {
            console.log(`🖼️ [DEBUG] [TrackRenderer] Switching to SVG rendering mode`);
          }

          if (this.elementVisibilityStates.readsReads) {
            if (renderingMode === 'canvas') {
              // Fetch reference sequence if needed for Canvas rendering
              const referenceSequence =
                settings.showReference !== false
                  ? this.getReferenceSequence(viewport.start, viewport.end, chromosome)
                  : null;

              // Use Canvas rendering for high performance
              this.renderReadsElementsCanvas(
                trackContent,
                limitedReadRows,
                viewport,
                readHeight,
                rowSpacing,
                topPadding,
                trackHeight,
                settings,
                referenceSequence
              );
            } else {
              // Create SVG-based read visualization
              // Pass just topPadding - reads SVG will be positioned after coverage automatically
              this.renderReadsElementsSVG(
                trackContent,
                limitedReadRows,
                viewport.start,
                viewport.end,
                viewport.end - viewport.start,
                readHeight,
                rowSpacing,
                topPadding,
                trackHeight,
                settings
              );
            }
          }
        }

        // Add reads statistics with cache info and sampling info
        const stats = this.genomeBrowser.readsManager.getCacheStats();
        let statsText;

        if (enableVerticalScroll) {
          // Scrollable mode statistics
          const totalReadsCount = readRows.reduce((sum, row) => sum + row.length, 0);
          const maxVisibleRows = settings.maxVisibleRows || 10;
          statsText = `${totalReadsCount} reads in ${readRows.length} rows (${Math.min(maxVisibleRows, readRows.length)} visible, scrollable)`;
        } else {
          // Traditional mode statistics
          const maxRows = settings.maxRows || 20;
          const limitedReadRows = readRows.slice(0, maxRows);
          const hiddenRowsCount = Math.max(0, readRows.length - limitedReadRows.length);
          const visibleReadsCount = limitedReadRows.reduce((sum, row) => sum + row.length, 0);

          statsText = `${visibleReadsCount} reads in ${limitedReadRows.length} rows`;
          if (hiddenRowsCount > 0) {
            const hiddenReadsTotal = readRows.slice(maxRows).reduce((sum, row) => sum + row.length, 0);
            statsText += ` (${hiddenReadsTotal} hidden)`;
          }
        }

        // Add sampling information if available and enabled
        if (settings.showSamplingInfo !== false) {
          if (visibleReads._samplingInfo) {
            // Sampling was applied
            const samplingInfo = visibleReads._samplingInfo;
            const samplingPercent = Math.round((samplingInfo.sampledCount / samplingInfo.originalCount) * 100);
            statsText += ` | Sampled: ${samplingInfo.sampledCount}/${samplingInfo.originalCount} (${samplingPercent}%)`;

            if (samplingInfo.mode === 'percentage') {
              statsText += ` [${samplingInfo.percentage}% mode]`;
            } else {
              statsText += ` [max ${samplingInfo.fixedCount} mode]`;
            }
          } else {
            // No sampling applied - show 100%
            const totalReadsCount = enableVerticalScroll
              ? readRows.reduce((sum, row) => sum + row.length, 0)
              : visibleReadsCount;
            statsText += ` | All reads shown (100%)`;
          }
        }

        statsText += ` | Cache: ${stats.cacheSize}/${stats.maxCacheSize} (${Math.round(stats.hitRate * 100)}% hit rate)`;

        const statsElement = this.createStatsElement(statsText, 'reads-stats');
        trackContent.appendChild(statsElement);
      }
    } catch (error) {
      // Remove loading message
      if (trackContent.contains(loadingMsg)) {
        trackContent.removeChild(loadingMsg);
      }

      // Show error message
      const errorMsg = document.createElement('div');
      errorMsg.className = 'reads-error';
      errorMsg.textContent = `Error loading reads: ${error.message}`;
      errorMsg.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: #d32f2f;
                font-style: italic;
                font-size: 12px;
            `;
      trackContent.appendChild(errorMsg);
      trackContent.style.height = '80px'; // Default height for error track
    }

    // Restore header state if it was previously hidden
    this.restoreHeaderState(track, 'reads');

    return track;
  }

  /**
   * Create multiple reads tracks for multiple BAM files
   */
  async createMultipleReadsTracks(chromosome, bamFiles) {
    const tracksContainer = document.createElement('div');
    tracksContainer.className = 'multi-reads-tracks-container';

    for (let i = 0; i < bamFiles.length; i++) {
      const bamFile = bamFiles[i];

      if (this.genomeBrowser.multiFileManager.getTrackVisibility(bamFile.trackId)) {
        const track = await this.createSingleReadsTrack(chromosome, bamFile);
        if (track) {
          tracksContainer.appendChild(track);

          // Add splitter between reads tracks (except after the last one)
          if (i < bamFiles.length - 1) {
            const nextBamFile = bamFiles[i + 1];
            if (this.genomeBrowser.multiFileManager.getTrackVisibility(nextBamFile.trackId)) {
              const splitter = this.genomeBrowser.createTrackSplitter(
                `reads-${bamFile.metadata.id}`,
                `reads-${nextBamFile.metadata.id}`
              );
              splitter.classList.add('multi-file-splitter');
              splitter.setAttribute('data-file-type', 'reads');
              tracksContainer.appendChild(splitter);
            }
          }
        }
      }
    }

    return tracksContainer;
  }

  /**
   * Create single reads track content without header (for zoom updates)
   */
  async createSingleReadsTrackContent(chromosome, bamFile, viewport = null) {
    viewport = viewport || this.getCurrentViewport();

    // Create track content
    const trackContent = this.createTrackContent(this.trackConfig.reads.defaultHeight, chromosome);

    // CRITICAL FIX: Get and apply instance-specific track settings for reads track content updates during zoom
    const rawSettings = this.getTrackSettings('reads', bamFile.metadata.id);
    const settings = JSON.parse(JSON.stringify(rawSettings));

    // BUGFIX: Ensure critical display settings are properly initialized
    settings.opacity = settings.opacity ?? 0.9;
    settings.readHeight = settings.readHeight ?? 4;
    settings.readSpacing = settings.readSpacing ?? 2;
    settings.minWidth = settings.minWidth ?? 2;
    settings.forwardColor = settings.forwardColor ?? '#00b894';
    settings.reverseColor = settings.reverseColor ?? '#f39c12';
    settings.borderColor = settings.borderColor ?? '#ffffff';
    settings.borderWidth = settings.borderWidth ?? 0;
    settings.showCoverage = settings.showCoverage ?? true;
    // CRITICAL FIX: Force showReference to true if undefined/null to prevent reads not showing
    settings.showReference = settings.showReference !== false ? true : false;

    console.log(
      `🔍 [createSingleReadsTrackContent] Applied settings during zoom for ${bamFile.metadata.filename}:`,
      settings
    );

    try {
      // Load reads using the specific BAM reader
      // Both viewport and BAM coordinates are 0-based - no conversion needed
      const bamStart = Math.max(0, viewport.start);
      const bamEnd = Math.max(bamStart + 1, viewport.end);

      console.log(`🔍 [TrackRenderer] Querying BAM for reads (content only):`, {
        chromosome,
        bamStart,
        bamEnd,
        fileName: bamFile.metadata.name,
        hasReferences: bamFile.reader.references?.length || 0,
        availableReferences: bamFile.reader.references?.slice(0, 5).map(ref => ref.name) || [],
      });

      const reads = await bamFile.reader.getRecordsForRange(
        chromosome,
        bamStart,
        bamEnd,
        settings // CRITICAL FIX: Pass settings to BAM reader
      );

      console.log(`📊 [TrackRenderer] BAM query result (content only):`, {
        readsFound: reads.length,
        region: `${chromosome}:${bamStart}-${bamEnd}`,
        fileName: bamFile.metadata.name,
      });

      // Apply sampling via ReadsManager (consistent with SAM path)
      const sampledReads = this.genomeBrowser.readsManager.applySampling(reads, settings);
      const isSampled = sampledReads._samplingInfo !== undefined;
      this.updateSamplingDisplayBasedOnReadsCount(sampledReads.length, isSampled);

      if (sampledReads.length === 0) {
        // Try to provide helpful diagnostic information
        let diagnosticMessage = `No reads found in region ${chromosome}:${viewport.start}-${viewport.end}`;

        if (bamFile.reader.references?.length === 0) {
          diagnosticMessage += `\n⚠️ BAM file has no reference sequences - file may be corrupted`;
        } else if (bamFile.reader.references?.length > 0) {
          const availableRefs = bamFile.reader.references.slice(0, 10).map(ref => ref.name);
          diagnosticMessage += `\n💡 Available references: ${availableRefs.join(', ')}`;

          if (!availableRefs.includes(chromosome)) {
            diagnosticMessage += `\n❓ Current chromosome "${chromosome}" not found in BAM references`;
          }
        }

        const noReadsMsg = this.createNoDataMessage(diagnosticMessage, 'no-reads-message');
        trackContent.appendChild(noReadsMsg);
      } else {
        // Use the settings already configured at the method start

        // Apply the corrected settings immediately
        this.trackSettings = this.trackSettings || {};
        this.trackSettings['reads'] = settings;

        // Create coverage visualization if enabled (respect toggle state)
        const showCoverage = settings.showCoverage !== false && this.elementVisibilityStates.readsCoverage;
        let coverageHeight = 0;

        // Only create SVG coverage if NOT using canvas mode
        const isCanvasMode = (settings.renderingMode || 'canvas') === 'canvas';

        if (showCoverage && !isCanvasMode) {
          coverageHeight = parseInt(settings.coverageHeight) || 50;
          this.createCoverageVisualization(trackContent, reads, viewport, coverageHeight, settings);
        }

        // Create reference visualization (respect toggle state)
        let referenceHeight = 0;
        // Only create separate reference visualization if NOT using canvas mode
        // CanvasReadsRenderer handles its own reference sequence rendering to ensure proper stacking
        if (!isCanvasMode) {
          const showReference = settings.showReference !== false && this.elementVisibilityStates.readsReference;
          if (showReference) {
            referenceHeight = parseInt(settings.referenceHeight) || 25;
            this.createReferenceVisualization(trackContent, viewport, referenceHeight, settings);
          }
        } else if (settings.showReference !== false && this.elementVisibilityStates.readsReference) {
          // In Canvas mode, we acknowledge the reference exists but don't draw it separately
          // We set referenceHeight to 0 here because the canvas renderer manages its own internal offsets
          // and we don't want to push the canvas container down by this amount in the DOM layout
          referenceHeight = 0;
        }

        // Arrange sampled reads into rows (use sampledReads for display, reads for coverage above)
        const readRows = this.arrangeReadsInRows(sampledReads, viewport.start, viewport.end);

        // Calculate rendering parameters
        const readHeight = settings.readHeight || 4;
        const rowSpacing = settings.readSpacing || 2;
        // Adjust top padding based on fixed elements above (coverage + reference)
        const topPadding = showCoverage || referenceHeight > 0 ? coverageHeight + referenceHeight + 2 : 0;
        const bottomPadding = 0;

        // Check if we should use scrollable mode (disabled by default to match original Canvas behavior)
        const forceScrollable = settings.forceScrollable === true && readRows.length > (settings.maxRows || 20);
        console.log('🔧 [DEBUG] [createSingleReadsTrack] Scrollable check:', {
          forceScrollable: settings.forceScrollable,
          readRowsLength: readRows.length,
          maxRows: settings.maxRows || 20,
          result: forceScrollable,
        });

        if (forceScrollable) {
          // Use new scrollable track system for performance
          this.createScrollableReadsTrack(
            trackContent,
            readRows,
            viewport,
            readHeight,
            rowSpacing,
            topPadding,
            bottomPadding,
            settings
          );
        } else {
          // Use traditional limited rows approach
          console.log('🔧 [DEBUG] [createSingleReadsTrack] Using traditional limited rows approach');
          const maxRows = settings.maxRows || 20;
          const limitedReadRows = readRows.slice(0, maxRows);
          console.log('🔧 [DEBUG] [createSingleReadsTrack] Limited rows created, count:', limitedReadRows.length);

          // Calculate adaptive track height including reference sequence
          let trackHeight;
          if (isCanvasMode) {
            let canvasTopSpace = 5;
            if (showCoverage) canvasTopSpace += 55;
            const showReference = settings.showReference !== false && this.elementVisibilityStates.readsReference;
            if (showReference) canvasTopSpace += 25;
            trackHeight = canvasTopSpace + limitedReadRows.length * (readHeight + rowSpacing) + bottomPadding;
          } else {
            trackHeight =
              coverageHeight +
              referenceHeight +
              topPadding +
              limitedReadRows.length * (readHeight + rowSpacing) -
              rowSpacing +
              bottomPadding;
          }
          trackHeight = Math.max(trackHeight, settings.height || 150);
          trackContent.style.height = `${trackHeight}px`;

          // Render reads using Canvas or SVG based on settings
          const renderingMode = settings.renderingMode || 'canvas';
          console.log(
            `🔧 [DEBUG] [createSingleReadsTrack] Selected rendering mode: ${renderingMode} (from settings: ${settings.renderingMode})`
          );
          console.log(`🔧 [DEBUG] [createSingleReadsTrack] Full settings object:`, settings);

          if (this.elementVisibilityStates.readsReads) {
            if (renderingMode === 'canvas') {
              console.log(`🎨 [DEBUG] [createSingleReadsTrackContent] Switching to Canvas rendering mode`);

              // Fetch reference sequence if needed for Canvas rendering
              const referenceSequence =
                settings.showReference !== false
                  ? this.getReferenceSequence(viewport.start, viewport.end, chromosome)
                  : null;

              // Use Canvas rendering for high performance
              this.renderReadsElementsCanvas(
                trackContent,
                limitedReadRows,
                viewport,
                readHeight,
                rowSpacing,
                topPadding,
                trackHeight,
                settings,
                referenceSequence
              );
            } else {
              // ... SVG rendering ...
              this.renderReadsElementsSVG(
                trackContent,
                limitedReadRows,
                viewport.start,
                viewport.end,
                viewport.end - viewport.start,
                readHeight,
                rowSpacing,
                topPadding,
                trackHeight,
                settings
              );
            }
          }
        }
        // Add file-specific statistics
        const statsText = `${bamFile.metadata.name}: ${reads.length} reads, ${readRows.length} rows`;
        console.log(`📊 [TrackRenderer] ${statsText}`);
        const statsElement = this.createStatsElement(statsText, 'reads-track-stats');
        trackContent.appendChild(statsElement);
      }
    } catch (error) {
      console.error('🔍 [TrackRenderer] Error creating reads track content:', error);

      // Show error message
      const errorMsg = document.createElement('div');
      errorMsg.className = 'reads-error';
      errorMsg.textContent = `Error loading reads: ${error.message}`;
      errorMsg.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: #d32f2f;
                font-style: italic;
                font-size: 12px;
            `;
      trackContent.appendChild(errorMsg);
      trackContent.style.height = '80px'; // Default height for error track
    }

    return trackContent;
  }

  /**
   * Create single reads track with file-specific header
   */
  async createSingleReadsTrack(chromosome, bamFile) {
    const viewport = this.getCurrentViewport();

    // CRITICAL FIX: Get and apply track settings for single reads track (instance-specific)
    const rawSettings = this.getTrackSettings('reads', bamFile.metadata.id);
    const settings = JSON.parse(JSON.stringify(rawSettings));

    // BUGFIX: Ensure critical display settings are properly initialized
    settings.opacity = settings.opacity ?? 0.9;
    settings.readHeight = settings.readHeight ?? 4;
    settings.readSpacing = settings.readSpacing ?? 2;
    settings.minWidth = settings.minWidth ?? 2;
    settings.forwardColor = settings.forwardColor ?? '#00b894';
    settings.reverseColor = settings.reverseColor ?? '#f39c12';
    settings.borderColor = settings.borderColor ?? '#ffffff';
    settings.borderWidth = settings.borderWidth ?? 0;
    settings.showCoverage = settings.showCoverage ?? true;
    // CRITICAL FIX: Force showReference to true if undefined/null to prevent reads not showing
    settings.showReference = settings.showReference !== false ? true : false;

    console.log(`🔍 [createSingleReadsTrack] Applied settings for ${bamFile.metadata.filename}:`, settings);

    // Create track base
    const track = document.createElement('div');
    track.className = 'reads-track';
    track.dataset.fileId = bamFile.metadata.id;

    // Create file-specific header with rename capability
    const trackHeader = this.createTrackHeader(
      bamFile.metadata.name,
      'reads',
      bamFile.metadata.id,
      true // isRenameable
    );
    track.appendChild(trackHeader);

    // Create track content
    const trackContent = this.createTrackContent(this.trackConfig.reads.defaultHeight, chromosome);
    track.appendChild(trackContent);

    try {
      // Load reads using the specific BAM reader
      // Both viewport and BAM coordinates are 0-based - no conversion needed
      const bamStart = Math.max(0, viewport.start);
      const bamEnd = Math.max(bamStart + 1, viewport.end);

      console.log(`🔍 [TrackRenderer] Querying BAM for reads:`, {
        chromosome,
        bamStart,
        bamEnd,
        fileName: bamFile.metadata.name,
        hasReferences: bamFile.reader.references?.length || 0,
        availableReferences: bamFile.reader.references?.slice(0, 5).map(ref => ref.name) || [],
        isInitialized: bamFile.reader.isInitialized,
        readerType: bamFile.reader.constructor.name,
      });

      // Check if reader is properly initialized
      if (!bamFile.reader.isInitialized) {
        throw new Error('BAM reader is not properly initialized');
      }

      // Check if we have references for this chromosome
      const hasReferences = bamFile.reader.references && bamFile.reader.references.length > 0;
      if (!hasReferences) {
        console.warn(`⚠️ [TrackRenderer] No references found in BAM file - attempting query anyway`);
      }

      console.log('🔧 [DEBUG] [createSingleReadsTrack] About to call BAM getRecordsForRange...');
      const reads = await bamFile.reader.getRecordsForRange(
        chromosome,
        bamStart,
        bamEnd,
        settings // CRITICAL FIX: Pass settings to BAM reader
      );
      console.log('🔧 [DEBUG] [createSingleReadsTrack] BAM getRecordsForRange completed, reads count:', reads.length);

      // Check the path we'll take based on reads count
      if (reads.length === 0) {
        console.log('🔧 [DEBUG] [createSingleReadsTrack] No reads found - will show no data message');
      } else {
        console.log('🔧 [DEBUG] [createSingleReadsTrack] Reads found - will proceed to rendering logic');
      }

      console.log(`📊 [TrackRenderer] BAM query result:`, {
        readsFound: reads.length,
        region: `${chromosome}:${bamStart}-${bamEnd}`,
        fileName: bamFile.metadata.name,
      });

      // Apply sampling via ReadsManager (consistent with SAM path)
      const sampledReads = this.genomeBrowser.readsManager.applySampling(reads, settings);
      const isSampled = sampledReads._samplingInfo !== undefined;
      this.updateSamplingDisplayBasedOnReadsCount(sampledReads.length, isSampled);

      if (sampledReads.length === 0) {
        // Try to provide helpful diagnostic information
        let diagnosticMessage = `No reads found in region ${chromosome}:${viewport.start}-${viewport.end}`;

        if (bamFile.reader.references?.length === 0) {
          diagnosticMessage += `\n⚠️ BAM file has no reference sequences - file may be corrupted`;
        } else if (bamFile.reader.references?.length > 0) {
          const availableRefs = bamFile.reader.references.slice(0, 10).map(ref => ref.name);
          diagnosticMessage += `\n💡 Available references: ${availableRefs.join(', ')}`;

          if (!availableRefs.includes(chromosome)) {
            diagnosticMessage += `\n❓ Current chromosome "${chromosome}" not found in BAM references`;
          }
        }

        const noReadsMsg = this.createNoDataMessage(diagnosticMessage, 'no-reads-message');
        trackContent.appendChild(noReadsMsg);
        trackContent.style.height = '80px'; // Default height for empty track
      } else {
        // Use the settings already configured at the method start

        // Apply the corrected settings immediately
        this.trackSettings = this.trackSettings || {};
        this.trackSettings['reads'] = settings;

        let coverageHeight = 0;
        let referenceHeight = 0;

        // Create coverage visualization if enabled (respect toggle state)
        const showCoverage = settings.showCoverage !== false && this.elementVisibilityStates.readsCoverage;
        const isCanvasMode = (settings.renderingMode || 'canvas') === 'canvas';

        if (showCoverage && !isCanvasMode) {
          coverageHeight = parseInt(settings.coverageHeight) || 50;
          this.createCoverageVisualization(trackContent, reads, viewport, coverageHeight, settings);
        }

        // Create reference visualization (respect toggle state)
        // Create reference visualization (respect toggle state)
        const showReference = settings.showReference !== false && this.elementVisibilityStates.readsReference;

        // Only create separate reference visualization if NOT using canvas mode
        if (showReference && !isCanvasMode) {
          referenceHeight = parseInt(settings.referenceHeight) || 25;
          this.createReferenceVisualization(trackContent, viewport, referenceHeight, settings);
        } else if (showReference && isCanvasMode) {
          // For Canvas mode, the renderer handles reference internally
          referenceHeight = 0;
        }

        // Arrange sampled reads in rows (use sampledReads for display, reads for coverage above)
        const readRows = this.arrangeReadsInRows(sampledReads, viewport.start, viewport.end);

        // Calculate track height and spacing
        const readHeight = parseInt(settings.readHeight) || 8;
        const rowSpacing = parseInt(settings.rowSpacing) || 2;

        const topPadding =
          showCoverage || referenceHeight > 0
            ? coverageHeight + referenceHeight + 2
            : parseInt(settings.topPadding) || 10;
        const bottomPadding = parseInt(settings.bottomPadding) || 10;

        // Total height above reads (coverage + reference)
        const totalTopHeight = coverageHeight + referenceHeight;

        let trackHeight;
        if (isCanvasMode) {
          let canvasTopSpace = 5;
          if (showCoverage) canvasTopSpace += 55;
          if (showReference) canvasTopSpace += 25;
          trackHeight = canvasTopSpace + readRows.length * (readHeight + rowSpacing) + bottomPadding;
        } else {
          trackHeight = totalTopHeight + topPadding + readRows.length * (readHeight + rowSpacing) + bottomPadding;
        }

        trackContent.style.height = `${trackHeight}px`;

        // Check if vertical scrolling is needed
        const maxVisibleRows = parseInt(settings.maxVisibleRows) || 50;
        const enableVerticalScroll = settings.enableVerticalScroll === true;

        if (enableVerticalScroll && readRows.length > maxVisibleRows) {
          this.createScrollableReadsTrack(
            trackContent,
            readRows,
            viewport,
            readHeight,
            rowSpacing,
            topPadding,
            bottomPadding,
            settings
          );
        } else {
          // Render all reads normally
          const renderingMode = settings.renderingMode || 'canvas';
          console.log(`🔧 [DEBUG] [createMultiReadsTrack] Selected rendering mode: ${renderingMode}`);

          // Only render reads if toggle is on
          if (this.elementVisibilityStates.readsReads) {
            if (renderingMode === 'canvas') {
              console.log(`🎨 [DEBUG] [createMultiReadsTrack] Switching to Canvas rendering mode`);

              // Fetch reference sequence if needed for Canvas rendering
              const referenceSequence =
                settings.showReference !== false
                  ? this.getReferenceSequence(viewport.start, viewport.end, chromosome)
                  : null;

              this.renderReadsElementsCanvas(
                trackContent,
                readRows,
                viewport,
                readHeight,
                rowSpacing,
                topPadding,
                trackHeight,
                settings,
                referenceSequence
              );
            } else {
              console.log(`🔧 [DEBUG] [createMultiReadsTrack] Calling renderReadsElementsSVG`);
              this.renderReadsElementsSVG(
                trackContent,
                readRows,
                viewport.start,
                viewport.end,
                viewport.end - viewport.start,
                readHeight,
                rowSpacing,
                topPadding,
                trackHeight,
                settings
              );
            }
          }
        }

        // Add file-specific statistics
        const statsText = `${bamFile.metadata.name}: ${reads.length} reads, ${readRows.length} rows`;
        const statsElement = this.createStatsElement(statsText, 'reads-track-stats');
        trackContent.appendChild(statsElement);
      }
    } catch (error) {
      console.error(`❌ Error loading reads for ${bamFile.metadata.name}:`, error);
      console.error(`   Region: ${chromosome}:${viewport.start}-${viewport.end}`);
      console.error(`   BAM file has ${bamFile.reader.references?.length || 0} references`);

      let errorMessage = `Error loading reads: ${error.message}`;

      // Add helpful context based on error type
      if (error.message.includes('not found') || error.message.includes('chromosome')) {
        errorMessage += `\n💡 This might be a chromosome naming issue (e.g., "chr1" vs "1")`;
      } else if (error.message.includes('index') || error.message.includes('bai')) {
        errorMessage += `\n💡 BAM index file (.bai) might be missing or corrupted`;
      } else if (bamFile.reader.references?.length === 0) {
        errorMessage += `\n⚠️ BAM file appears to have no reference sequences`;
      }

      const errorMsg = this.createNoDataMessage(errorMessage, 'reads-error-message');
      trackContent.appendChild(errorMsg);
    }

    // Restore header state if it was previously hidden
    this.restoreHeaderState(track, 'reads');

    return track;
  }

  /**
   * Create scrollable reads track with vertical scrolling capability
   */
  createScrollableReadsTrack(
    trackContent,
    readRows,
    viewport,
    readHeight,
    rowSpacing,
    topPadding,
    bottomPadding,
    settings
  ) {
    const maxVisibleRows = settings.maxVisibleRows || 10;
    const scrollbarWidth = 16; // Standard scrollbar width

    // Calculate dimensions
    const rowHeight = readHeight + rowSpacing;
    const totalContentHeight = topPadding + readRows.length * rowHeight - rowSpacing + bottomPadding;
    const visibleHeight = Math.min(
      totalContentHeight,
      topPadding + maxVisibleRows * rowHeight - rowSpacing + bottomPadding
    );
    const trackHeight = Math.max(visibleHeight, settings.height || 150);

    // Set track content height
    trackContent.style.height = `${trackHeight}px`;
    trackContent.style.position = 'relative';
    trackContent.style.overflow = 'hidden';

    // Create scrollable container - extend to full width for alignment with other tracks
    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'reads-scroll-container';
    scrollContainer.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            overflow: hidden;
        `;

    // Create content viewport
    const contentViewport = document.createElement('div');
    contentViewport.className = 'reads-content-viewport';
    contentViewport.style.cssText = `
            position: relative;
            width: 100%;
            height: ${totalContentHeight}px;
            transform: translateY(0px);
            will-change: transform;
        `;

    // Create vertical scrollbar
    const scrollbar = this.createVerticalScrollbar(trackHeight, totalContentHeight, contentViewport, scrollContainer);

    // Store scroll state
    let currentScrollTop = 0;
    let visibleRowStart = 0;
    let visibleRowEnd = Math.min(readRows.length, maxVisibleRows + 2); // +2 for buffer

    // Initial render of visible rows - start from top to eliminate gap
    this.renderVisibleRows(
      contentViewport,
      readRows,
      viewport,
      readHeight,
      rowSpacing,
      topPadding,
      visibleRowStart,
      visibleRowEnd,
      settings
    );

    // Handle scrolling
    const handleScroll = scrollTop => {
      currentScrollTop = scrollTop;

      // Calculate which rows should be visible
      const firstVisibleRow = Math.max(0, Math.floor((scrollTop - topPadding) / rowHeight));
      const lastVisibleRow = Math.min(readRows.length, firstVisibleRow + maxVisibleRows + 4); // +4 for buffer

      // Only re-render if visible range changed significantly
      if (Math.abs(firstVisibleRow - visibleRowStart) > 2 || Math.abs(lastVisibleRow - visibleRowEnd) > 2) {
        visibleRowStart = firstVisibleRow;
        visibleRowEnd = lastVisibleRow;

        // Clear and re-render visible rows
        contentViewport.innerHTML = '';
        this.renderVisibleRows(
          contentViewport,
          readRows,
          viewport,
          readHeight,
          rowSpacing,
          topPadding,
          visibleRowStart,
          visibleRowEnd,
          settings
        );
      }

      // Update viewport position
      contentViewport.style.transform = `translateY(${-scrollTop}px)`;
    };

    // Store scroll handler for external access
    scrollContainer._handleScroll = handleScroll;
    scrollContainer._scrollState = {
      totalRows: readRows.length,
      visibleRows: maxVisibleRows,
      currentScrollTop: () => currentScrollTop,
      scrollToRow: rowIndex => {
        const targetScrollTop = Math.max(
          0,
          Math.min(totalContentHeight - visibleHeight, topPadding + rowIndex * rowHeight)
        );
        handleScroll(targetScrollTop);
        scrollbar._updateScrollPosition(targetScrollTop);
      },
    };

    scrollContainer.appendChild(contentViewport);
    trackContent.appendChild(scrollContainer);
    trackContent.appendChild(scrollbar);

    // Set initial scroll position to eliminate gap with coverage track
    if (topPadding > 0) {
      const initialScrollTop = topPadding;
      handleScroll(initialScrollTop);
      if (scrollbar._updateScrollPosition) {
        scrollbar._updateScrollPosition(initialScrollTop);
      }
    }

    console.log(
      `📜 [ScrollableReads] Created scrollable track: ${readRows.length} total rows, ${maxVisibleRows} visible, ${totalContentHeight}px total height`
    );
  }

  /**
   * Create vertical scrollbar for reads track
   */
  createVerticalScrollbar(trackHeight, contentHeight, contentViewport, scrollContainer) {
    const scrollbarWidth = 16;

    // Scrollbar container - positioned above content with higher z-index
    const scrollbar = document.createElement('div');
    scrollbar.className = 'reads-vertical-scrollbar';
    scrollbar.style.cssText = `
            position: absolute;
            top: 0;
            right: 0;
            width: ${scrollbarWidth}px;
            height: ${trackHeight}px;
            background-color: rgba(240, 240, 240, 0.9);
            border-left: 1px solid #ddd;
            cursor: default;
            z-index: 100;
        `;

    // Scrollbar thumb
    const thumb = document.createElement('div');
    thumb.className = 'scrollbar-thumb';
    const thumbHeight = Math.max(20, (trackHeight / contentHeight) * trackHeight);
    thumb.style.cssText = `
            position: absolute;
            top: 0;
            left: 2px;
            right: 2px;
            height: ${thumbHeight}px;
            background-color: #888;
            border-radius: 6px;
            cursor: pointer;
            transition: background-color 0.2s;
        `;

    // Thumb hover effect
    thumb.addEventListener('mouseenter', () => {
      thumb.style.backgroundColor = '#555';
    });
    thumb.addEventListener('mouseleave', () => {
      thumb.style.backgroundColor = '#888';
    });

    // Scrolling logic
    let isDragging = false;
    let dragStartY = 0;
    let dragStartScrollTop = 0;

    const updateScrollPosition = scrollTop => {
      const maxScrollTop = contentHeight - trackHeight;
      const clampedScrollTop = Math.max(0, Math.min(maxScrollTop, scrollTop));
      const thumbTop = (clampedScrollTop / maxScrollTop) * (trackHeight - thumbHeight);
      thumb.style.top = `${thumbTop}px`;

      if (scrollContainer._handleScroll) {
        scrollContainer._handleScroll(clampedScrollTop);
      }
    };

    // Mouse down on thumb
    thumb.addEventListener('mousedown', e => {
      e.preventDefault();
      isDragging = true;
      dragStartY = e.clientY;
      dragStartScrollTop = parseFloat(thumb.style.top) || 0;
      document.body.style.userSelect = 'none';
    });

    // Mouse move (document level)
    document.addEventListener('mousemove', e => {
      if (!isDragging) return;

      const deltaY = e.clientY - dragStartY;
      const maxScrollTop = contentHeight - trackHeight;
      const scrollRatio = deltaY / (trackHeight - thumbHeight);
      const newScrollTop = dragStartScrollTop + scrollRatio * maxScrollTop;

      updateScrollPosition(newScrollTop);
    });

    // Mouse up (document level)
    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        document.body.style.userSelect = '';
      }
    });

    // Click on scrollbar track
    scrollbar.addEventListener('click', e => {
      if (e.target === scrollbar) {
        const rect = scrollbar.getBoundingClientRect();
        const clickY = e.clientY - rect.top;
        const maxScrollTop = contentHeight - trackHeight;
        const newScrollTop = (clickY / trackHeight) * maxScrollTop;
        updateScrollPosition(newScrollTop);
      }
    });

    // Mouse wheel scrolling on scroll container
    scrollContainer.addEventListener('wheel', e => {
      // Check if wheel zoom is enabled in NavigationManager
      const isWheelZoomEnabled = window.genomeBrowser?.navigationManager?.wheelZoomConfig?.enabled;

      // Calculate if this track needs vertical scrolling
      const maxScrollTop = contentHeight - trackHeight;
      const needsVerticalScrolling = maxScrollTop > 0;

      console.log('🔍 [TrackRenderer] Wheel event in scrollable reads track:', {
        zoomEnabled: isWheelZoomEnabled,
        needsScrolling: needsVerticalScrolling,
        hasModifier: e.ctrlKey || e.metaKey,
        deltaY: e.deltaY,
      });

      // Priority 1: Modifier keys (Ctrl/Cmd) always trigger zoom, never scroll
      if (e.ctrlKey || e.metaKey) {
        console.log('🔍 [TrackRenderer] Modifier key detected, delegating to NavigationManager for zoom');
        return; // Let NavigationManager handle zoom (it will preventDefault)
      }

      // Priority 2: If no vertical scrolling is needed, delegate to zoom
      if (!needsVerticalScrolling) {
        console.log('🔍 [TrackRenderer] No scrolling needed, delegating to NavigationManager for zoom');
        return; // Let NavigationManager handle zoom
      }

      // Priority 3: If zoom is disabled, always handle scrolling when needed
      if (!isWheelZoomEnabled && needsVerticalScrolling) {
        e.preventDefault();
        const currentScrollTop = scrollContainer._scrollState?.currentScrollTop() || 0;
        const scrollDelta = e.deltaY * 2;
        updateScrollPosition(currentScrollTop + scrollDelta);
        console.log('🔍 [TrackRenderer] Zoom disabled, handling vertical scroll');
        return;
      }

      // Priority 4: Both zoom and scroll are available - use smart boundary detection
      if (isWheelZoomEnabled && needsVerticalScrolling) {
        const currentScrollTop = scrollContainer._scrollState?.currentScrollTop() || 0;
        const scrollBuffer = Math.max(20, trackHeight * 0.1); // Dynamic buffer based on track height
        const isNearTop = currentScrollTop <= scrollBuffer;
        const isNearBottom = currentScrollTop >= maxScrollTop - scrollBuffer;

        // At boundaries, prefer zoom. In middle, prefer scroll.
        if (isNearTop || isNearBottom) {
          console.log('🔍 [TrackRenderer] Near scroll boundary, delegating to NavigationManager for zoom');
          return; // Let NavigationManager handle zoom
        } else {
          // Handle scrolling in the middle range
          e.preventDefault();
          const scrollDelta = e.deltaY * 2;
          updateScrollPosition(currentScrollTop + scrollDelta);
          console.log('🔍 [TrackRenderer] Handling vertical scroll in middle range');
          return;
        }
      }

      // Default: Let NavigationManager handle zoom
      console.log('🔍 [TrackRenderer] Default case, delegating to NavigationManager');
    });

    // Store update function for external use
    scrollbar._updateScrollPosition = updateScrollPosition;

    // Initialize scrollbar position to top (scrollTop = 0)
    updateScrollPosition(0);

    scrollbar.appendChild(thumb);
    return scrollbar;
  }

  /**
   * Render only visible rows for performance
   */
  renderVisibleRows(container, readRows, viewport, readHeight, rowSpacing, topPadding, startRow, endRow, settings) {
    // Force layout calculation to get accurate width
    const containerWidth = container.parentElement?.getBoundingClientRect().width || 800;

    // Check rendering mode - support Canvas in scrollable reads
    const renderingMode = settings.renderingMode || 'canvas';
    console.log(`🔧 [DEBUG] [renderVisibleRows] Using rendering mode: ${renderingMode}`);

    if (renderingMode === 'canvas') {
      // Use Canvas rendering for scrollable reads
      this.renderVisibleRowsCanvas(
        container,
        readRows,
        viewport,
        readHeight,
        rowSpacing,
        topPadding,
        startRow,
        endRow,
        settings,
        containerWidth
      );
      return;
    }

    // Create SVG for visible rows (default behavior)
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const visibleRowCount = endRow - startRow;
    const svgHeight = visibleRowCount * (readHeight + rowSpacing);

    svg.setAttribute('width', '100%');
    svg.setAttribute('height', svgHeight);
    svg.setAttribute('viewBox', `0 0 ${containerWidth} ${svgHeight}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('class', 'reads-svg-container scrollable');
    svg.style.position = 'absolute';
    svg.style.top = `${topPadding + startRow * (readHeight + rowSpacing)}px`;
    svg.style.left = '0';
    svg.style.pointerEvents = 'all';

    // Create definitions for gradients
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    this.createReadGradients(defs, settings);
    svg.appendChild(defs);

    // Check if we should show sequences based on zoom level
    console.log(`🎯 [ScrollableReads] Sequence display check in renderVisibleRows:`, {
      showSequencesSetting: settings.showSequences,
      forceSequencesSetting: settings.forceSequences,
      autoFontSizeSetting: settings.autoFontSize,
      allSettings: settings,
    });

    const showSequences =
      settings.showSequences && this.shouldShowSequences(viewport.start, viewport.end, containerWidth, settings);

    console.log(`🎯 [ScrollableReads] Final sequence display decision: ${showSequences}`);

    // Reference sequence is now handled as fixed element above the scrollable area

    // Render visible rows
    for (let rowIndex = startRow; rowIndex < endRow && rowIndex < readRows.length; rowIndex++) {
      const rowReads = readRows[rowIndex];
      const relativeRowIndex = rowIndex - startRow;

      rowReads.forEach(read => {
        // In scrollable mode, calculate reference spacing separately
        const referenceSpacing = settings.showReference !== false ? readHeight + 5 : 0;
        const readGroup = this.createSVGReadElement(
          read,
          viewport.start,
          viewport.end,
          viewport.end - viewport.start,
          readHeight,
          relativeRowIndex,
          rowSpacing,
          referenceSpacing, // Pass reference spacing as topPadding in scrollable mode
          containerWidth,
          settings
        );
        if (readGroup) {
          svg.appendChild(readGroup);

          // Add sequence text if zoom level is sufficient
          if (showSequences && read.sequence) {
            console.log(`🧬 [ScrollableReads] Creating sequence for read:`, {
              readId: read.id,
              sequence: read.sequence ? read.sequence.substring(0, 20) + '...' : 'NO_SEQUENCE',
              sequenceLength: read.sequence ? read.sequence.length : 0,
            });
            const sequenceGroup = this.createSVGSequenceElement(
              read,
              viewport.start,
              viewport.end,
              viewport.end - viewport.start,
              readHeight,
              relativeRowIndex,
              rowSpacing,
              0,
              containerWidth,
              settings
            ); // Use 0 padding in scrollable mode
            if (sequenceGroup) {
              svg.appendChild(sequenceGroup);
              console.log(`✅ [ScrollableReads] Sequence element added for read: ${read.id}`);
            } else {
              console.log(`❌ [ScrollableReads] No sequence element created for read: ${read.id}`);
            }
          } else if (showSequences && !read.sequence) {
            console.log(`⚠️ [ScrollableReads] Sequence display enabled but read has no sequence:`, {
              readId: read.id,
              hasSequence: !!read.sequence,
              showSequences: showSequences,
            });
          }
        }
      });
    }

    container.appendChild(svg);

    console.log(`📜 [ScrollableReads] Rendered rows ${startRow}-${endRow - 1} (${visibleRowCount} rows) in SVG`);
  }

  /**
   * Render visible rows using Canvas for high performance
   */
  renderVisibleRowsCanvas(
    container,
    readRows,
    viewport,
    readHeight,
    rowSpacing,
    topPadding,
    startRow,
    endRow,
    settings,
    containerWidth
  ) {
    console.log(`🎨 [ScrollableReads] Rendering rows ${startRow}-${endRow - 1} with Canvas`);

    const visibleRowCount = endRow - startRow;
    const canvasHeight = visibleRowCount * (readHeight + rowSpacing);

    // Create canvas element
    const canvas = document.createElement('canvas');
    canvas.style.cssText = `
            width: 100%;
            height: ${canvasHeight}px;
            display: block;
            image-rendering: crisp-edges;
            image-rendering: pixelated;
        `;

    // Set up canvas with device pixel ratio
    const devicePixelRatio = window.devicePixelRatio || 1;
    canvas.width = containerWidth * devicePixelRatio;
    canvas.height = canvasHeight * devicePixelRatio;

    const ctx = canvas.getContext('2d', { alpha: true });
    ctx.scale(devicePixelRatio, devicePixelRatio);

    // Clear canvas
    ctx.clearRect(0, 0, containerWidth, canvasHeight);

    // Get visible rows to render
    const visibleRows = readRows.slice(startRow, endRow);

    // Render each visible row
    visibleRows.forEach((rowReads, rowIndex) => {
      const actualRowIndex = startRow + rowIndex;
      const y = rowIndex * (readHeight + rowSpacing);

      this.renderReadRowCanvas(ctx, rowReads, viewport, y, readHeight, settings, containerWidth);
    });

    // Add canvas to container
    container.appendChild(canvas);

    console.log(`🎨 [ScrollableReads] Rendered rows ${startRow}-${endRow - 1} (${endRow - startRow} rows) in Canvas`);
  }

  /**
   * Render a single row of reads on Canvas
   */
  renderReadRowCanvas(ctx, rowReads, viewport, y, readHeight, settings, containerWidth) {
    const viewportRange = viewport.end - viewport.start;

    // Base colors for reads
    const baseColors = {
      forward: settings.forwardColor || '#00b894',
      reverse: settings.reverseColor || '#f39c12',
      paired: settings.pairedColor || '#6c5ce7',
    };

    rowReads.forEach(read => {
      // Calculate read position and dimensions
      const readStart = Math.max(read.start, viewport.start);
      const readEnd = Math.min(read.end || read.start + read.sequence.length, viewport.end);

      if (readEnd <= readStart) return; // Read not visible

      // Calculate screen coordinates
      const x = ((readStart - viewport.start) / viewportRange) * containerWidth;
      const width = ((readEnd - readStart) / viewportRange) * containerWidth;

      // Skip reads that are too narrow to see
      if (width < 1) return;

      // Determine read color
      let readColor = baseColors.forward;
      if (read.strand === '-') {
        readColor = baseColors.reverse;
      } else if (read.isPaired) {
        readColor = baseColors.paired;
      }

      // Draw read rectangle
      ctx.fillStyle = readColor;
      ctx.fillRect(x, y, width, readHeight);

      // Draw read border
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x, y, width, readHeight);
    });
  }

  // New method to arrange reads into non-overlapping rows
  arrangeReadsInRows(reads, viewStart, viewEnd) {
    console.log('🔧 [DEBUG] [arrangeReadsInRows] Input:', {
      readsCount: reads.length,
      viewStart,
      viewEnd,
      firstReadStart: reads[0]?.start,
      lastReadStart: reads[reads.length - 1]?.start,
    });

    // Sort reads by start position
    const sortedReads = [...reads].sort((a, b) => a.start - b.start);
    const rows = [];

    console.log('🔧 [DEBUG] [arrangeReadsInRows] After sorting:', {
      sortedReadsCount: sortedReads.length,
      firstSortedStart: sortedReads[0]?.start,
      lastSortedStart: sortedReads[sortedReads.length - 1]?.start,
    });

    sortedReads.forEach(read => {
      let placed = false;

      // Try to place read in existing rows
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex];
        let canPlace = true;

        // Check if read overlaps with any read in this row
        for (const existingRead of row) {
          if (this.readsOverlap(read, existingRead)) {
            canPlace = false;
            break;
          }
        }

        if (canPlace) {
          row.push(read);
          placed = true;
          break;
        }
      }

      // If couldn't place in existing row, create new row
      if (!placed) {
        rows.push([read]);
      }
    });

    console.log('🔧 [DEBUG] [arrangeReadsInRows] Result:', {
      rowsCount: rows.length,
      totalReadsArranged: rows.reduce((sum, row) => sum + row.length, 0),
      firstRowLength: rows[0]?.length || 0,
      lastRowLength: rows[rows.length - 1]?.length || 0,
    });

    return rows;
  }

  // Helper method to check if two reads overlap
  readsOverlap(read1, read2) {
    return !(read1.end < read2.start || read2.end < read1.start);
  }

  /**
   * Create SVG-based reads visualization
   */
  renderReadsElementsSVG(
    trackContent,
    readRows,
    start,
    end,
    range,
    readHeight,
    rowSpacing,
    topPadding,
    trackHeight,
    settings = {}
  ) {
    console.log('🔧 [DEBUG] [renderReadsElementsSVG] Entry point called');
    console.log('🔧 [DEBUG] [renderReadsElementsSVG] Parameters:', {
      readRowsCount: readRows.length,
      totalReads: readRows.reduce((sum, row) => sum + row.length, 0),
      start,
      end,
      range,
      renderingMode: settings.renderingMode,
    });

    // Force layout calculation to get accurate width
    trackContent.style.width = '100%';
    const containerWidth = trackContent.getBoundingClientRect().width || trackContent.offsetWidth || 800;
    console.log('🔧 [DEBUG] [renderReadsElementsSVG] Container width:', containerWidth);

    // Check if coverage and reference visualizations exist to calculate proper SVG positioning
    const coverageElement = trackContent.querySelector('.coverage-visualization');
    const coverageHeight = coverageElement ? parseInt(coverageElement.style.height) || 0 : 0;

    const referenceElement = trackContent.querySelector('.reference-sequence-visualization');
    const referenceHeight = referenceElement ? parseInt(referenceElement.style.height) || 0 : 0;

    const totalTopHeight = coverageHeight + referenceHeight;

    // Create SVG container that fills width but preserves text aspect ratio
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', trackHeight);
    svg.setAttribute('viewBox', `0 0 ${containerWidth} ${trackHeight}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('class', 'reads-svg-container');
    svg.style.position = 'absolute';
    // Position SVG right after coverage and reference elements with minimal spacing
    svg.style.top = `${totalTopHeight + 2}px`; // Only 2px spacing instead of topPadding
    svg.style.left = '0';
    svg.style.pointerEvents = 'all';

    // Create definitions for gradients and patterns
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svg.appendChild(defs);

    // Create read gradients with current settings
    this.createReadGradients(defs, settings);

    // Check if we should show sequences based on zoom level
    console.log(`🎯 [TrackRenderer] Sequence display check in renderReadsElementsSVG:`, {
      showSequencesSetting: settings.showSequences,
      forceSequencesSetting: settings.forceSequences,
      autoFontSizeSetting: settings.autoFontSize,
      allSettings: settings,
    });

    const showSequences = settings.showSequences && this.shouldShowSequences(start, end, containerWidth, settings);

    console.log(`🎯 [TrackRenderer] Final sequence display decision: ${showSequences}`);

    // Reference sequence is now handled as fixed element above the SVG area

    // Create read elements as SVG rectangles
    readRows.forEach((rowReads, rowIndex) => {
      rowReads.forEach(read => {
        // Reference is now handled separately, so use original topPadding
        const readGroup = this.createSVGReadElement(
          read,
          start,
          end,
          range,
          readHeight,
          rowIndex,
          rowSpacing,
          topPadding,
          containerWidth,
          settings
        );
        if (readGroup) {
          svg.appendChild(readGroup);

          // Add sequence text if zoom level is sufficient
          if (showSequences && read.sequence) {
            console.log(`🧬 [TrackRenderer] Creating sequence for read:`, {
              readId: read.id,
              sequence: read.sequence ? read.sequence.substring(0, 20) + '...' : 'NO_SEQUENCE',
              sequenceLength: read.sequence ? read.sequence.length : 0,
            });
            const sequenceGroup = this.createSVGSequenceElement(
              read,
              start,
              end,
              range,
              readHeight,
              rowIndex,
              rowSpacing,
              topPadding,
              containerWidth,
              settings
            );
            if (sequenceGroup) {
              svg.appendChild(sequenceGroup);
              console.log(`✅ [TrackRenderer] Sequence element added for read: ${read.id}`);
            } else {
              console.log(`❌ [TrackRenderer] Sequence rendering failed, creating fallback read shape for: ${read.id}`);
              // Sequence rendering failed, create a fallback read shape
              const fallbackReadGroup = this.createSVGReadElement(
                read,
                start,
                end,
                range,
                readHeight,
                rowIndex,
                rowSpacing,
                topPadding,
                containerWidth,
                { ...settings, showSequences: false }
              );
              if (fallbackReadGroup) {
                svg.appendChild(fallbackReadGroup);
              }
            }
          } else if (showSequences && !read.sequence) {
            console.log(`⚠️ [TrackRenderer] Sequence display enabled but read has no sequence:`, {
              readId: read.id,
              hasSequence: !!read.sequence,
              showSequences: showSequences,
            });
          }
        }
      });
    });

    // Note: Drag functionality is handled by the unified makeDraggable system
    // applied to the track-content container in createTrackContent()

    trackContent.appendChild(svg);
    console.log('🔧 [DEBUG] [renderReadsElementsSVG] SVG appended to trackContent');
    console.log('🔧 [DEBUG] [renderReadsElementsSVG] SVG element:', svg);
    console.log('🔧 [DEBUG] [renderReadsElementsSVG] Track content children count:', trackContent.children.length);
  }

  /**
   * Render reads elements using Canvas for high performance
   */
  renderReadsElementsCanvas(
    trackContent,
    readRows,
    viewport,
    readHeight,
    rowSpacing,
    topPadding,
    trackHeight,
    settings = {},
    referenceSequence = null
  ) {
    console.log('🎨 [TrackRenderer] Rendering reads with Canvas for high performance');

    // Check if CanvasReadsRenderer is available
    if (typeof CanvasReadsRenderer === 'undefined') {
      console.warn('⚠️ [TrackRenderer] CanvasReadsRenderer not available, falling back to SVG rendering');
      return this.renderReadsElementsSVG(
        trackContent,
        readRows,
        viewport.start,
        viewport.end,
        viewport.end - viewport.start,
        readHeight,
        rowSpacing,
        topPadding,
        trackHeight,
        settings
      );
    }

    // Generate unique ID for this track instance
    const trackId = `reads-track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create Canvas container
    // Check if coverage and reference visualizations exist to calculate proper positioning
    const coverageElement = trackContent.querySelector('.coverage-visualization');
    const coverageHeight = coverageElement ? parseInt(coverageElement.style.height) || 0 : 0;

    const referenceElement = trackContent.querySelector('.reference-sequence-visualization');
    const referenceHeight = referenceElement ? parseInt(referenceElement.style.height) || 0 : 0;

    const totalTopHeight = coverageHeight + referenceHeight;

    const canvasContainer = document.createElement('div');
    canvasContainer.className = 'reads-canvas-container';
    canvasContainer.setAttribute('data-track-id', trackId);
    canvasContainer.style.cssText = `
            position: absolute;
            top: ${totalTopHeight + 2}px;
            left: 0;
            width: 100%;
            height: ${trackHeight - totalTopHeight - 2}px;
            overflow: hidden;
            z-index: 49;
        `;

    // Prepare Canvas renderer options from settings
    const canvasOptions = {
      readHeight: readHeight,
      rowSpacing: rowSpacing,
      topPadding: 5, // Minimal padding inside canvas - container is already positioned correctly
      bottomPadding: settings.bottomPadding || 10,
      showSequences: settings.showSequences || false,
      showReference: settings.showReference !== false,
      referenceSequence: referenceSequence, // Pass the fetched sequence data
      autoFontSize: settings.autoFontSize !== false,
      minFontSize: 8,
      maxFontSize: 14,
      qualityColoring: settings.showQualityColors || false,
      strandColoring: !settings.showQualityColors, // Use strand coloring when not using quality
      mismatchHighlight: settings.highlightMismatches !== false,
      showMutations: settings.showMutations || false,
      showCoverage: settings.showCoverage !== false,
      coverageHeight: settings.coverageHeight || 50,
      coverageColor: settings.coverageColor || '#4a90e2',
      backgroundColor: 'transparent',
      // Color settings from track settings
      forwardColor: settings.forwardColor || '#00b894',
      reverseColor: settings.reverseColor || '#f39c12',
      pairedColor: settings.pairedColor || '#6c5ce7',
      mismatchColor: settings.mismatchColor || '#ff6b6b',
      opacity: settings.opacity || 0.9,
    };

    try {
      // Create Canvas renderer
      const canvasRenderer = new CanvasReadsRenderer(canvasContainer, readRows, viewport, canvasOptions);

      // Store renderer for cleanup and updates (extend the existing canvas renderers)
      if (!this.canvasRenderers) {
        this.canvasRenderers = new Map();
      }
      this.canvasRenderers.set(trackId, canvasRenderer);

      // CRITICAL: Store renderer globally for UIManager to access during splitter resize
      if (typeof window !== 'undefined') {
        if (!window.canvasReadsRenderers) {
          window.canvasReadsRenderers = [];
        }
        window.canvasReadsRenderers.push(canvasRenderer);
      }

      // Append canvas container to track content
      trackContent.appendChild(canvasContainer);

      // Now render with proper settings
      console.log('🎨 [TrackRenderer] Rendering Canvas with settings:', canvasOptions);
      canvasRenderer.render();

      console.log('✅ [TrackRenderer] Canvas reads renderer created successfully', {
        trackId: trackId,
        readRows: readRows.length,
        totalReads: readRows.reduce((sum, row) => sum + row.length, 0),
      });
    } catch (error) {
      console.error('❌ [TrackRenderer] Failed to create Canvas reads renderer:', error);
      // Fall back to SVG rendering if Canvas fails
      return this.renderReadsElementsSVG(
        trackContent,
        readRows,
        viewport.start,
        viewport.end,
        viewport.end - viewport.start,
        readHeight,
        rowSpacing,
        topPadding,
        trackHeight,
        settings
      );
    }
  }

  /**
   * Create gradients for read visualization
   */
  createReadGradients(defs, settings = {}) {
    // Get colors from settings with defaults
    const forwardColor = settings.forwardColor || '#00b894';
    const reverseColor = settings.reverseColor || '#f39c12';
    const pairedColor = settings.pairedColor || '#6c5ce7';

    // Forward strand gradient
    const forwardGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    forwardGradient.setAttribute('id', 'read-forward-gradient');
    forwardGradient.setAttribute('x1', '0%');
    forwardGradient.setAttribute('y1', '0%');
    forwardGradient.setAttribute('x2', '100%');
    forwardGradient.setAttribute('y2', '100%');

    const forwardStop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    forwardStop1.setAttribute('offset', '0%');
    forwardStop1.setAttribute('stop-color', forwardColor);

    const forwardStop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    forwardStop2.setAttribute('offset', '100%');
    forwardStop2.setAttribute('stop-color', this.darkenColor(forwardColor, 10));

    forwardGradient.appendChild(forwardStop1);
    forwardGradient.appendChild(forwardStop2);
    defs.appendChild(forwardGradient);

    // Reverse strand gradient
    const reverseGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    reverseGradient.setAttribute('id', 'read-reverse-gradient');
    reverseGradient.setAttribute('x1', '0%');
    reverseGradient.setAttribute('y1', '0%');
    reverseGradient.setAttribute('x2', '100%');
    reverseGradient.setAttribute('y2', '100%');

    const reverseStop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    reverseStop1.setAttribute('offset', '0%');
    reverseStop1.setAttribute('stop-color', reverseColor);

    const reverseStop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    reverseStop2.setAttribute('offset', '100%');
    reverseStop2.setAttribute('stop-color', this.darkenColor(reverseColor, 10));

    reverseGradient.appendChild(reverseStop1);
    reverseGradient.appendChild(reverseStop2);
    defs.appendChild(reverseGradient);

    // Paired reads gradient
    const pairedGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    pairedGradient.setAttribute('id', 'read-paired-gradient');
    pairedGradient.setAttribute('x1', '0%');
    pairedGradient.setAttribute('y1', '0%');
    pairedGradient.setAttribute('x2', '100%');
    pairedGradient.setAttribute('y2', '100%');

    const pairedStop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    pairedStop1.setAttribute('offset', '0%');
    pairedStop1.setAttribute('stop-color', pairedColor);

    const pairedStop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    pairedStop2.setAttribute('offset', '100%');
    pairedStop2.setAttribute('stop-color', this.darkenColor(pairedColor, 10));

    pairedGradient.appendChild(pairedStop1);
    pairedGradient.appendChild(pairedStop2);
    defs.appendChild(pairedGradient);
  }

  /**
   * Create individual SVG read element
   */
  createSVGReadElement(
    read,
    start,
    end,
    range,
    readHeight,
    rowIndex,
    rowSpacing,
    topPadding,
    containerWidth,
    settings = {}
  ) {
    // Calculate position and dimensions
    const readStart = Math.max(read.start, start);
    const readEnd = Math.min(read.end, end);
    const left = ((readStart - start) / range) * 100;
    const width = Math.max(((readEnd - readStart) / range) * 100, 0.2);

    if (width <= 0) return null;

    // Calculate pixel positions - use accurate container width
    const x = (left / 100) * containerWidth;
    const minWidth = settings.minWidth || 2;
    const elementWidth = Math.max((width / 100) * containerWidth, minWidth);

    // Calculate Y position - SVG container is already positioned after coverage/reference, so minimal padding
    const y = 5 + rowIndex * (readHeight + rowSpacing); // Just 5px internal padding

    // Check if we should show sequences using unified threshold logic
    const showSequences = settings.showSequences && this.shouldShowSequences(start, end, containerWidth, settings);

    // Create SVG group for the read
    const readGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    readGroup.setAttribute('class', 'svg-read-element');
    readGroup.setAttribute('transform', `translate(${x}, ${y})`);

    // Apply opacity setting
    const opacity = settings.opacity || 0.9;
    readGroup.setAttribute('opacity', opacity);

    // Always show SOMETHING - either sequences or read shapes, never nothing
    // Only skip read shape if we're supposed to show sequences AND the read has sequence data
    // The actual sequence rendering success/failure will be handled in the main rendering loop
    const shouldShowReadShape = !showSequences || !read.sequence;

    if (shouldShowReadShape) {
      // Create read shape when not showing sequences OR when read lacks sequence data
      const readShape = this.createSVGReadShape(read, elementWidth, readHeight, settings);
      readGroup.appendChild(readShape);

      // Add mutation visualization if enabled
      if (settings.showMutations && read.mutations && read.mutations.length > 0) {
        const mutationElements = this.createSVGMutations(
          read,
          elementWidth,
          readHeight,
          start,
          end,
          range,
          containerWidth,
          settings
        );
        mutationElements.forEach(mutationElement => {
          readGroup.appendChild(mutationElement);
        });
      }
    }

    // Add interaction handlers (work for both shapes and sequences)
    this.addSVGReadInteraction(readGroup, read, rowIndex);

    return readGroup;
  }

  /**
   * Create SVG sequence text element for read
   */
  createSVGSequenceElement(
    read,
    start,
    end,
    range,
    readHeight,
    rowIndex,
    rowSpacing,
    topPadding,
    containerWidth,
    settings = {}
  ) {
    // Calculate position and dimensions
    const readStart = Math.max(read.start, start);
    const readEnd = Math.min(read.end, end);
    const left = ((readStart - start) / range) * 100;
    const width = Math.max(((readEnd - readStart) / range) * 100, 0.2);

    if (width <= 0) return null;

    // Calculate pixel positions
    const x = (left / 100) * containerWidth;
    const elementWidth = Math.max((width / 100) * containerWidth, 2);

    // Calculate Y position - SVG container is already positioned after coverage/reference
    const referenceSpacing = settings.showReference !== false ? readHeight + 5 : 0;
    const y = 5 + referenceSpacing + rowIndex * (readHeight + rowSpacing); // Just 5px internal padding

    // Create SVG group for the sequence
    const sequenceGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    sequenceGroup.setAttribute('class', 'svg-sequence-element');
    sequenceGroup.setAttribute('transform', `translate(${x}, ${y})`);

    // Calculate visible sequence portion
    const visibleSequence = this.getVisibleSequencePortion(read, readStart, readEnd);

    // Add sequence text based on display mode
    const basesPerPixel = range / containerWidth;
    let shouldRenderText = false;
    let effectiveSettings = { ...settings };

    if (settings.forceSequences) {
      // Force mode - calculate optimal font size if auto sizing is enabled
      shouldRenderText = true;
      if (settings.autoFontSize !== false) {
        const optimalFontSize = this.calculateOptimalFontSize(
          visibleSequence.length,
          elementWidth,
          readHeight,
          settings
        );
        effectiveSettings.sequenceFontSize = optimalFontSize;
        console.log(
          `🎯 [TrackRenderer] Auto font size for read: ${optimalFontSize}px (sequence length: ${visibleSequence.length})`
        );
      }
    } else {
      // Standard mode - check pixel threshold
      const minPixelsPerBase = 8;
      shouldRenderText = basesPerPixel * minPixelsPerBase <= 1;
    }

    if (shouldRenderText && visibleSequence && visibleSequence.length > 0) {
      const referenceSequence = settings.showMismatches ? this.getReferenceSequence(readStart, readEnd) : null;
      const sequenceText = this.createSVGSequenceText(
        visibleSequence,
        elementWidth,
        readHeight,
        effectiveSettings,
        referenceSequence
      );
      if (sequenceText) {
        sequenceGroup.appendChild(sequenceText);

        // Add interaction handlers to sequence elements for click functionality
        this.addSVGReadInteraction(sequenceGroup, read, rowIndex);

        return sequenceGroup;
      }
    }

    // If sequence rendering failed or was skipped, return null
    // This signals that a fallback read shape should be used instead
    return null;
  }

  /**
   * Get the visible portion of read sequence for the current viewport
   */
  getVisibleSequencePortion(read, visibleStart, visibleEnd) {
    if (!read.sequence) return '';

    // CRITICAL FIX: Use sequence length as source of truth (matching Canvas renderer fix)
    // The issue was that genomic coordinates vs sequence length mismatch indicates a fundamental
    // coordinate system inconsistency somewhere in the BAM parsing chain
    const genomicReadLength = read.end - read.start + 1; // Theoretical length based on 1-based inclusive coordinates
    const sequenceLength = read.sequence.length; // Actual sequence length

    // Use sequence length as source of truth for all calculations
    const actualReadLength = sequenceLength;

    // Debug log coordinate mismatches but proceed with sequence-based calculations
    if (genomicReadLength !== sequenceLength) {
      console.log(`🔧 [SVG] Read coordinate/sequence length mismatch - using sequence length as source of truth:`, {
        readId: read.id,
        genomicStart: read.start,
        genomicEnd: read.end,
        theoreticalGenomicLength: genomicReadLength,
        actualSequenceLength: sequenceLength,
        fixApplied: 'using sequenceLength for all calculations',
      });
    }

    // CRITICAL FIX: Calculate offset using actual sequence length (matching Canvas renderer fix)
    // This fixes the coordinate mismatch that was causing the "left端多一个碱基" issue
    const genomicStart = read.start;
    const genomicEnd = read.end; // Use BAM end coordinate directly (0-based exclusive)

    const startOffset = Math.max(0, visibleStart - genomicStart);
    const endOffset = Math.min(actualReadLength - 1, visibleEnd - genomicStart - 1); // Convert visibleEnd from 0-based exclusive to 0-based inclusive

    // Map to sequence indices using actual sequence length
    let startIndex, endIndex;

    if (actualReadLength <= 1) {
      // Handle single base reads
      startIndex = 0;
      endIndex = actualReadLength - 1;
    } else {
      // Calculate indices for multi-base reads using actual sequence length
      startIndex = Math.max(0, Math.floor((startOffset / (actualReadLength - 1)) * (actualReadLength - 1)));
      endIndex = Math.min(
        actualReadLength - 1,
        Math.ceil((endOffset / (actualReadLength - 1)) * (actualReadLength - 1))
      );
    }

    // CRITICAL FIX: Ensure reads sequence aligns with reference sequence boundaries
    // The key insight is that we should extract sequence that corresponds to the exact
    // visibleStart-visibleEnd coordinate range, not the full read sequence

    // When visibleStart equals read.start, we should start from the beginning of sequence
    // When visibleEnd equals read.end, we should end at the end of sequence
    // But when they don't match, we need precise coordinate mapping

    const shouldExtractFullRead = visibleStart === read.start && visibleEnd === read.end;

    if (shouldExtractFullRead) {
      console.log(`🔧 [SVG] Full read matches viewport bounds exactly:`, {
        readId: read.id,
        readStart: read.start,
        readEnd: read.end,
        visibleStart,
        visibleEnd,
        sequenceLength: read.sequence.length,
      });
      return read.sequence; // Return complete sequence
    }

    // For partial reads, we need to extract the portion that corresponds to visibleStart-visibleEnd
    console.log(`🔧 [SVG] Extracting partial read sequence:`, {
      readId: read.id,
      readStart: read.start,
      readEnd: read.end,
      visibleStart,
      visibleEnd,
      extractingRange: `${visibleStart}-${visibleEnd}`,
    });

    // Ensure we include the end base by using endIndex + 1 for substring
    const result = read.sequence.substring(startIndex, endIndex + 1);

    console.log(`🔧 [SVG] Partial sequence calculation:`, {
      readId: read.id,
      readStart: read.start,
      readEnd: read.end,
      visibleStart,
      visibleEnd,
      startOffset,
      endOffset,
      startIndex,
      endIndex,
      resultLength: result.length,
      originalSequenceLength: read.sequence.length,
      shouldExtractFullRead: shouldExtractFullRead,
    });

    return result;
  }

  /**
   * Create SVG text element for sequence with optional mismatch highlighting
   */
  createSVGSequenceText(sequence, width, height, settings = {}, referenceSequence = null) {
    const fontSize = settings.sequenceFontSize || 10;
    const fontFamily = settings.sequenceFontFamily || 'monospace';
    const mismatchColor = settings.mismatchColor || '#dc3545';
    const baseColors = this.getDNABaseColors(settings);

    // Create group for the sequence (no background like reference)
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'svg-sequence-text');

    if (referenceSequence && settings.showMismatches && referenceSequence.length === sequence.length) {
      // Create individual character elements with mismatch highlighting
      const charWidth = width / sequence.length;

      for (let i = 0; i < sequence.length; i++) {
        const char = sequence[i];
        const refChar = referenceSequence[i];
        const isMismatch = char.toUpperCase() !== refChar.toUpperCase();

        // Create subtle mismatch background (circle instead of rectangle)
        if (isMismatch) {
          const mismatchBg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          mismatchBg.setAttribute('cx', i * charWidth + charWidth / 2);
          mismatchBg.setAttribute('cy', height / 2);
          mismatchBg.setAttribute('r', Math.min(charWidth, height) / 3);
          mismatchBg.setAttribute('fill', 'rgba(220, 53, 69, 0.2)');
          group.appendChild(mismatchBg);
        }

        // Create character text with base colors or mismatch color
        const charText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        charText.setAttribute('x', i * charWidth + charWidth / 2);
        charText.setAttribute('y', height / 2 + fontSize / 3);
        charText.setAttribute('font-family', fontFamily);
        charText.setAttribute('font-size', fontSize);
        charText.setAttribute(
          'fill',
          isMismatch ? mismatchColor : baseColors[char.toUpperCase()] || baseColors.default
        );
        charText.setAttribute('font-weight', isMismatch ? 'bold' : 'normal');
        charText.setAttribute('text-anchor', 'middle');
        charText.setAttribute('dominant-baseline', 'middle');
        charText.textContent = char.toUpperCase();
        group.appendChild(charText);
      }
    } else {
      // Create individual colored bases for consistent appearance with reference
      const charWidth = width / sequence.length;

      sequence.split('').forEach((char, index) => {
        const charText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        charText.setAttribute('x', index * charWidth + charWidth / 2);
        charText.setAttribute('y', height / 2 + fontSize / 3);
        charText.setAttribute('font-family', fontFamily);
        charText.setAttribute('font-size', fontSize);
        charText.setAttribute('fill', baseColors[char.toUpperCase()] || baseColors.default);
        charText.setAttribute('text-anchor', 'middle');
        charText.setAttribute('dominant-baseline', 'middle');
        charText.textContent = char.toUpperCase();
        group.appendChild(charText);
      });
    }

    return group;
  }

  /**
   * Create SVG reference sequence element
   */
  createSVGReferenceSequence(start, end, range, readHeight, topPadding, containerWidth, settings = {}) {
    console.log(
      `🔍 [createSVGReferenceSequence] Called with start=${start}, end=${end}, containerWidth=${containerWidth}`
    );

    // Get reference sequence from genome browser
    const referenceSequence = this.getReferenceSequence(start, end);
    console.log(
      `🔍 [createSVGReferenceSequence] Got reference sequence:`,
      referenceSequence
        ? `length=${referenceSequence.length}, preview="${referenceSequence.substring(0, 20)}..."`
        : 'null/empty'
    );

    if (!referenceSequence) {
      console.warn(`🔍 [createSVGReferenceSequence] No reference sequence available for ${start}-${end}`);
      return null;
    }

    // Create SVG group for the reference sequence
    const referenceGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    referenceGroup.setAttribute('class', 'svg-reference-sequence');

    // Position at the top of the reads area (after coverage, before reads)
    const y = topPadding;
    referenceGroup.setAttribute('transform', `translate(0, ${y})`);

    // Add background for reference sequence
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x', '0');
    bg.setAttribute('y', '0');
    bg.setAttribute('width', containerWidth);
    bg.setAttribute('height', readHeight);
    bg.setAttribute('fill', '#f8f9fa');
    bg.setAttribute('stroke', '#dee2e6');
    bg.setAttribute('stroke-width', '1');
    referenceGroup.appendChild(bg);

    // Always show reference sequence text when reference is enabled
    const basesPerPixel = range / containerWidth;
    let effectiveRefSettings = { ...settings };

    // Calculate optimal font size if auto sizing is enabled
    if (settings.autoFontSize !== false) {
      const optimalFontSize = this.calculateOptimalFontSize(range, containerWidth, readHeight, settings);
      effectiveRefSettings.referenceFontSize = Math.min(optimalFontSize, 14);
      console.log(`🎯 [TrackRenderer] Auto font size for reference: ${effectiveRefSettings.referenceFontSize}px`);
    }

    // Always create reference text when reference sequence is available
    const sequenceText = this.createSVGReferenceText(
      referenceSequence,
      containerWidth,
      readHeight,
      effectiveRefSettings
    );
    if (sequenceText) {
      referenceGroup.appendChild(sequenceText);
    }

    // Add label
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', '5');
    label.setAttribute('y', readHeight / 2 + 2);
    label.setAttribute('font-family', 'Arial, sans-serif');
    label.setAttribute('font-size', '10');
    label.setAttribute('font-weight', 'bold');
    label.setAttribute('fill', '#6c757d');
    label.setAttribute('dominant-baseline', 'middle');
    // REF label removed as requested
    // referenceGroup.appendChild(label);

    return referenceGroup;
  }

  /**
   * Get reference sequence for the specified region
   */
  getReferenceSequence(start, end, chromosome = null) {
    console.log(`🔍 [getReferenceSequence] Called with start=${start}, end=${end}, chromosome=${chromosome}`);

    // Try to get reference sequence from the genome browser
    if (this.genomeBrowser && this.genomeBrowser.currentSequence) {
      console.log(`🔍 [getReferenceSequence] genomeBrowser.currentSequence available`);

      // Get the current chromosome if not provided
      const currentChr =
        chromosome || document.getElementById('chromosomeSelect')?.value || this.genomeBrowser.currentChromosome;
      console.log(`🔍 [getReferenceSequence] Using chromosome: ${currentChr}`);

      // Get sequence for the specific chromosome
      let sequence = this.genomeBrowser.currentSequence;
      if (typeof sequence === 'object' && currentChr) {
        sequence = sequence[currentChr];
      }

      // Check if we have a valid string sequence
      if (typeof sequence === 'string' && sequence.length > 0) {
        // The start and end parameters are already 0-based coordinates from viewport
        // No coordinate conversion needed - they can be used directly with substring()
        const startIndex = Math.max(0, start);
        const endIndex = Math.min(sequence.length, end);
        const result = sequence.substring(startIndex, endIndex);

        console.log(`🔍 [getReferenceSequence] Fixed coordinate mapping:`, {
          inputStart: start,
          inputEnd: end,
          startIndex: startIndex,
          endIndex: endIndex,
          resultLength: result.length,
          preview: result.substring(0, 20) + '...',
        });

        return result;
      } else {
        console.log(
          `🔍 [getReferenceSequence] Invalid sequence type or empty: ${typeof sequence}, length: ${sequence?.length}`
        );
      }
    }
    return null;
  }

  /**
   * Get consistent DNA base colors
   */
  getDNABaseColors(settings = {}) {
    return {
      A: '#FF4136', // Red
      T: '#0074D9', // Blue
      G: '#2ECC40', // Green
      C: '#FF851B', // Orange
      U: '#0074D9', // Blue (same as T)
      N: '#AAAAAA', // Gray
      default: '#495057', // Dark gray
    };
  }

  /**
   * Create SVG text element for reference sequence
   */
  createSVGReferenceText(sequence, width, height, settings = {}) {
    const fontSize = settings.referenceFontSize || 12;
    const fontFamily = settings.referenceFontFamily || 'monospace';
    const baseColors = this.getDNABaseColors(settings);

    // Create group for reference sequence bases
    const textGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    textGroup.setAttribute('class', 'reference-text-group');

    // Calculate spacing for individual bases to match full width
    const charWidth = width / sequence.length;
    const startX = 0;

    // Create individual text elements for each base with specific colors
    sequence.split('').forEach((base, index) => {
      const charElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      charElement.setAttribute('x', startX + index * charWidth);
      charElement.setAttribute('y', height / 2 + fontSize / 3);
      charElement.setAttribute('font-family', fontFamily);
      charElement.setAttribute('font-size', fontSize);
      charElement.setAttribute('fill', baseColors[base.toUpperCase()] || baseColors.default);
      charElement.setAttribute('text-anchor', 'middle');
      charElement.textContent = base.toUpperCase();
      textGroup.appendChild(charElement);
    });

    return textGroup;
  }

  /**
   * Create SVG shape for read
   */
  createSVGReadShape(read, width, height, settings = {}) {
    const isForward = read.strand === '+';
    const showQualityColors = settings.showQualityColors || false;
    const showDirectionArrows = settings.showDirectionArrows !== false; // Default to true

    // Determine fill color based on settings
    let fillColor, strokeColor;

    if (showQualityColors && read.mappingQuality !== undefined) {
      // Color by mapping quality
      const quality = read.mappingQuality;
      if (quality >= 30) {
        fillColor = settings.forwardColor || '#00b894'; // High quality - green
        strokeColor = settings.borderColor || '#2d3436';
      } else if (quality >= 10) {
        fillColor = settings.pairedColor || '#6c5ce7'; // Medium quality - purple
        strokeColor = settings.borderColor || '#2d3436';
      } else {
        fillColor = settings.reverseColor || '#f39c12'; // Low quality - orange
        strokeColor = settings.borderColor || '#2d3436';
      }
    } else {
      // Color by strand
      if (isForward) {
        fillColor = settings.forwardColor || '#00b894';
      } else {
        fillColor = settings.reverseColor || '#f39c12';
      }
      strokeColor = settings.borderColor || '#2d3436';
    }

    let borderWidth = settings.borderWidth || 1;

    if (read.isMultiMapping) {
      strokeColor = fillColor;
      fillColor = 'transparent';
      borderWidth = Math.max(1, borderWidth);
    }

    if (width < 10) {
      // Simple rectangle for very small reads
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', '0');
      rect.setAttribute('y', '0');
      rect.setAttribute('width', width);
      rect.setAttribute('height', height);
      rect.setAttribute('fill', fillColor);
      rect.setAttribute('stroke', strokeColor);
      rect.setAttribute('stroke-width', borderWidth);
      rect.setAttribute('rx', '1');
      return rect;
    } else {
      // Slightly rounded rectangle with optional directional indicator
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', '0');
      rect.setAttribute('y', '0');
      rect.setAttribute('width', width);
      rect.setAttribute('height', height);
      rect.setAttribute('fill', fillColor);
      rect.setAttribute('stroke', strokeColor);
      rect.setAttribute('stroke-width', borderWidth);
      rect.setAttribute('rx', '2');

      // Add small directional arrow if enabled and there's space
      if (showDirectionArrows && width > 15) {
        const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        const arrowSize = Math.min(height * 0.3, 3);
        const arrowX = isForward ? width - arrowSize - 2 : 2;
        const arrowY = height / 2;

        let points;
        if (isForward) {
          points = `${arrowX},${arrowY - arrowSize} ${arrowX + arrowSize},${arrowY} ${arrowX},${arrowY + arrowSize}`;
        } else {
          points = `${arrowX + arrowSize},${arrowY - arrowSize} ${arrowX},${arrowY} ${arrowX + arrowSize},${arrowY + arrowSize}`;
        }

        arrow.setAttribute('points', points);
        arrow.setAttribute('fill', 'rgba(255,255,255,0.8)');
        arrow.setAttribute('pointer-events', 'none');

        // Group the rectangle and arrow
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.appendChild(rect);
        g.appendChild(arrow);
        return g;
      }

      return rect;
    }
  }

  /**
   * Create SVG elements for mutations on a read
   */
  createSVGMutations(read, readWidth, readHeight, viewStart, viewEnd, range, containerWidth, settings) {
    const mutationElements = [];

    if (!read.mutations || read.mutations.length === 0) {
      return mutationElements;
    }

    // Filter mutations that are visible in the current view
    const visibleMutations = read.mutations.filter(mutation => {
      return mutation.position >= viewStart && mutation.position <= viewEnd;
    });

    visibleMutations.forEach(mutation => {
      // CRITICAL FIX: Calculate position within the read using actual sequence length
      const mutationPosInRead = mutation.position - read.start;
      const readLength = read.sequence ? read.sequence.length : read.end - read.start + 1;

      // Skip if mutation is outside the read bounds
      if (mutationPosInRead < 0 || mutationPosInRead > readLength) {
        return;
      }

      // Calculate x position within the read element
      const relativeX = (mutationPosInRead / readLength) * readWidth;

      // Create mutation line
      const mutationLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      mutationLine.setAttribute('class', 'mutation-line');
      mutationLine.setAttribute('x1', relativeX);
      mutationLine.setAttribute('y1', 0);
      mutationLine.setAttribute('x2', relativeX);
      mutationLine.setAttribute('y2', readHeight);
      mutationLine.setAttribute('stroke', mutation.color);
      mutationLine.setAttribute('stroke-width', this.getMutationLineWidth(mutation, settings));
      mutationLine.setAttribute('opacity', settings.mutationOpacity || 0.8);

      // Add mutation-specific styling
      switch (mutation.type) {
        case 'insertion':
          mutationLine.setAttribute('stroke-dasharray', '2,1');
          break;
        case 'deletion':
          mutationLine.setAttribute('stroke-width', Math.max(2, this.getMutationLineWidth(mutation, settings)));
          break;
        case 'mismatch':
          mutationLine.setAttribute('stroke-width', 1);
          break;
      }

      // Add tooltip with mutation information
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = this.formatMutationTooltip(mutation);
      mutationLine.appendChild(title);

      // Add click handler for mutation details
      mutationLine.style.cursor = 'pointer';
      mutationLine.addEventListener('click', e => {
        e.stopPropagation();
        if (this.genomeBrowser && this.genomeBrowser.selectMutation) {
          this.genomeBrowser.selectMutation(read, mutation);
        }
      });

      mutationElements.push(mutationLine);
    });

    return mutationElements;
  }

  /**
   * Get mutation line width based on type and settings
   */
  getMutationLineWidth(mutation, settings) {
    const baseWidth = settings.mutationLineWidth || 1;

    switch (mutation.type) {
      case 'insertion':
        return baseWidth * 1.5;
      case 'deletion':
        return baseWidth * 2;
      case 'mismatch':
        return baseWidth;
      default:
        return baseWidth;
    }
  }

  /**
   * Format mutation tooltip text
   */
  formatMutationTooltip(mutation) {
    switch (mutation.type) {
      case 'insertion':
        return `Insertion at ${mutation.position}: +${mutation.sequence} (${mutation.length}bp)`;
      case 'deletion':
        return `Deletion at ${mutation.position}: -${mutation.length}bp`;
      case 'mismatch':
        return `Mismatch at ${mutation.position}: ${mutation.refSequence}→${mutation.sequence}`;
      default:
        return `${mutation.type} at ${mutation.position}`;
    }
  }

  /**
   * Calculate if sequences should be displayed based on zoom level
   */
  shouldShowSequences(start, end, containerWidth, settings = {}) {
    // Use Canvas-style simple logic: check if reads will be wide enough to display sequences clearly
    const range = end - start;
    const basesPerPixel = range / containerWidth;

    // Check for force mode first
    if (settings.forceSequences) {
      // Removed excessive logging - only log in debug mode
      if (window.DEBUG_MODE) {
        console.log(`🔍 [TrackRenderer] Force sequence display - always show`);
      }
      return true;
    }

    // Use Canvas-style threshold: calculate average read width
    // Assume average read length of 150bp (typical Illumina read)
    const averageReadLength = 150;
    const averageReadWidthPixels = (averageReadLength / range) * containerWidth;

    // Show sequences if average read width > 50px (same as Canvas logic)
    const shouldShow = averageReadWidthPixels > 50;

    // Removed excessive logging - only log in debug mode
    if (window.DEBUG_MODE) {
      console.log(`🔍 [TrackRenderer] Canvas-style sequence display check:`, {
        range: range,
        containerWidth: containerWidth,
        basesPerPixel: basesPerPixel.toFixed(3),
        averageReadLength: averageReadLength,
        averageReadWidthPixels: averageReadWidthPixels.toFixed(1),
        threshold: 50,
        shouldShow: shouldShow,
      });
    }

    return shouldShow;
  }

  /**
   * Calculate adaptive threshold based on window size and sequence length
   */
  calculateAdaptiveSequenceThreshold(range, containerWidth, settings = {}) {
    // Get general settings for minimum line spacing
    const generalSettings = this.genomeBrowser.generalSettingsManager?.getSettings() || {};
    const minLineSpacing = generalSettings.minLineSpacing || 12;
    const sequenceFontSize = settings.sequenceFontSize || 10;

    // Calculate minimum pixels per base needed for readable text
    const minPixelsPerBase = Math.max(8, sequenceFontSize * 0.8);

    // Adjust threshold based on window width (larger windows can show more detail)
    let windowSizeFactor = 1.0;
    if (containerWidth > 1200) {
      windowSizeFactor = 1.5; // Allow more detail on large screens
    } else if (containerWidth < 800) {
      windowSizeFactor = 0.7; // Be more restrictive on small screens
    }

    // Adjust threshold based on sequence range (shorter ranges can show more detail)
    let rangeFactor = 1.0;
    if (range < 100) {
      rangeFactor = 2.0; // Very short ranges - show lots of detail
    } else if (range < 500) {
      rangeFactor = 1.5; // Short ranges - show more detail
    } else if (range > 10000) {
      rangeFactor = 0.5; // Long ranges - be more restrictive
    }

    // Calculate adaptive threshold
    const baseThreshold = containerWidth / (range * minPixelsPerBase);
    const adaptiveThreshold = baseThreshold * windowSizeFactor * rangeFactor;

    // Removed excessive logging - only log in debug mode
    if (window.DEBUG_MODE) {
      console.log(`📊 [TrackRenderer] Adaptive threshold calculation:`, {
        minPixelsPerBase: minPixelsPerBase,
        minLineSpacing: minLineSpacing,
        windowSizeFactor: windowSizeFactor,
        rangeFactor: rangeFactor,
        baseThreshold: baseThreshold.toFixed(3),
        adaptiveThreshold: adaptiveThreshold.toFixed(3),
      });
    }

    return adaptiveThreshold;
  }

  /**
   * Calculate optimal font size for sequence display based on available space
   */
  calculateOptimalFontSize(range, containerWidth, readHeight, settings = {}) {
    // Calculate available space per base
    const pixelsPerBase = containerWidth / range;

    // Get constraints
    const minFontSize = 4; // Very small minimum for force mode
    const maxFontSize = Math.min(16, Math.max(6, readHeight + 2)); // Allow font to be slightly larger than read height
    const minPixelsPerChar = 4; // Minimum pixels needed per character
    const maxPixelsPerChar = 12; // Maximum useful pixels per character

    // Calculate font size based on available space
    let optimalFontSize = Math.floor(pixelsPerBase * 0.8); // Leave some padding

    // Apply constraints
    optimalFontSize = Math.max(minFontSize, optimalFontSize);
    optimalFontSize = Math.min(maxFontSize, optimalFontSize);

    // Adjust based on read density (more reads = smaller font)
    const readDensityFactor = Math.min(1.0, 100 / range); // Reduce font size for dense regions
    optimalFontSize = Math.floor(optimalFontSize * (0.7 + readDensityFactor * 0.3));

    // Removed excessive logging - only log in debug mode
    if (window.DEBUG_MODE) {
      console.log(`📏 [TrackRenderer] Font size calculation:`, {
        range: range,
        containerWidth: containerWidth,
        pixelsPerBase: pixelsPerBase.toFixed(2),
        readHeight: readHeight,
        readDensityFactor: readDensityFactor.toFixed(2),
        rawFontSize: Math.floor(pixelsPerBase * 0.8),
        optimalFontSize: optimalFontSize,
        constraints: { minFontSize, maxFontSize },
      });
    }

    return Math.max(minFontSize, optimalFontSize);
  }

  /**
   * Check if sequences should be rendered (even very small) in force mode
   */
  canRenderSequencesInForceMode(range, containerWidth, readHeight) {
    const pixelsPerBase = containerWidth / range;
    const minViablePixelsPerBase = 0.5; // Minimum space to attempt rendering
    const minReadHeight = 2; // Very lenient minimum height for force mode

    const canRender = pixelsPerBase >= minViablePixelsPerBase && readHeight >= minReadHeight;

    // Removed excessive logging - only log in debug mode
    if (window.DEBUG_MODE) {
      console.log(`🔍 [TrackRenderer] canRenderSequencesInForceMode details:`, {
        range: range,
        containerWidth: containerWidth,
        pixelsPerBase: pixelsPerBase.toFixed(3),
        minViablePixelsPerBase: minViablePixelsPerBase,
        readHeight: readHeight,
        minReadHeight: minReadHeight,
        pixelsPerBaseOK: pixelsPerBase >= minViablePixelsPerBase,
        readHeightOK: readHeight >= minReadHeight,
        canRender: canRender,
      });
    }

    return canRender;
  }

  /**
   * Add interaction handlers to SVG read element
   */
  addSVGReadInteraction(readGroup, read, rowIndex) {
    // Create comprehensive tooltip
    const readInfo =
      `Read: ${read.id || 'Unknown'}\n` +
      `Position: ${read.start}-${read.end}\n` +
      `Strand: ${read.strand || 'N/A'}\n` +
      `Mapping Quality: ${read.mappingQuality || 'N/A'}\n` +
      `Row: ${rowIndex + 1}`;

    // Add tooltip using title element
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = readInfo;
    readGroup.appendChild(title);

    // Add hover effects
    readGroup.style.cursor = 'pointer';
    readGroup.addEventListener('mouseenter', () => {
      readGroup.style.opacity = '0.8';
      readGroup.style.filter = 'brightness(1.1)';
    });

    readGroup.addEventListener('mouseleave', () => {
      readGroup.style.opacity = '1';
      readGroup.style.filter = 'none';
    });

    // Add click handler for detailed info
    readGroup.addEventListener('click', () => {
      this.showReadDetails(read, readInfo);
    });
  }

  /**
   * Show detailed read information
   */
  showReadDetails(read, readInfo) {
    // Use the new read details sidebar functionality
    // Get file info if available
    let fileInfo = null;
    if (this.genomeBrowser.multiFileManager && this.genomeBrowser.multiFileManager.files) {
      // Try to find the file info for this read
      const files = this.genomeBrowser.multiFileManager.files.reads || [];
      if (files.length > 0) {
        // For now, use the first file or try to match by read properties
        fileInfo = files[0];
      }
    }

    // Call the new selectRead method from GenomeBrowser
    this.genomeBrowser.selectRead(read, fileInfo);
  }

  createProteinTrack(chromosome) {
    const { track, trackContent } = this.createTrackBase('proteins', chromosome);
    const viewport = this.getCurrentViewport();

    // Get and filter proteins
    const annotations = this.genomeBrowser.currentAnnotations[chromosome] || [];
    const proteins = this.filterProteinAnnotations(annotations, viewport);

    console.log(`Displaying ${proteins.length} proteins in region ${viewport.start}-${viewport.end}`);

    if (proteins.length === 0) {
      const noProteinsMsg = this.createNoDataMessage(
        'No proteins in this region or CDS filtered out',
        'no-proteins-message'
      );
      trackContent.appendChild(noProteinsMsg);
    } else {
      this.renderProteinElements(trackContent, proteins, viewport);
    }

    // Restore header state if it was previously hidden
    this.restoreHeaderState(track, 'proteins');

    return track;
  }

  /**
   * Filter protein annotations (CDS features)
   */
  filterProteinAnnotations(annotations, viewport) {
    return annotations
      .filter(feature => feature.type === 'CDS' && this.genomeBrowser.shouldShowGeneType('CDS'))
      .filter(protein => this.filterFeaturesByViewport([protein], viewport).length > 0);
  }

  /**
   * Render protein elements
   */
  renderProteinElements(trackContent, proteins, viewport) {
    proteins.forEach((protein, index) => {
      const proteinElement = this.createProteinElement(protein, viewport);
      trackContent.appendChild(proteinElement);
    });
  }

  /**
   * Create individual protein element
   */
  createProteinElement(protein, viewport) {
    const proteinElement = document.createElement('div');
    proteinElement.className = 'protein-element';

    // Calculate position and dimensions
    const proteinStart = Math.max(protein.start, viewport.start);
    const proteinEnd = Math.min(protein.end, viewport.end);
    const left = ((proteinStart - viewport.start) / (viewport.end - viewport.start)) * 100;
    const width = Math.max(((proteinEnd - proteinStart) / (viewport.end - viewport.start)) * 100, 0.3);

    proteinElement.style.left = `${left}%`;
    proteinElement.style.width = `${Math.max(width, 0.3)}%`;

    if (protein.strand === -1) {
      proteinElement.classList.add('reverse-strand');
    }

    // Set protein label and tooltip
    this.setProteinElementContent(proteinElement, protein, width);

    // Add interaction handlers
    this.addProteinElementHandlers(proteinElement, protein);

    return proteinElement;
  }

  /**
   * Set protein element content and tooltip
   */
  setProteinElementContent(proteinElement, protein, width) {
    const proteinName =
      this.genomeBrowser.getQualifierValue(protein.qualifiers, 'product') ||
      this.genomeBrowser.getQualifierValue(protein.qualifiers, 'gene') ||
      this.genomeBrowser.getQualifierValue(protein.qualifiers, 'locus_tag') ||
      'Protein';
    const proteinInfo = `${proteinName} (CDS)`;
    const positionInfo = `${protein.start}-${protein.end} (${protein.strand === -1 ? '-' : '+'} strand)`;

    proteinElement.title = `${proteinInfo}\nPosition: ${positionInfo}`;

    // Set text content based on available space
    if (width > 2) {
      proteinElement.textContent = proteinName.length > 10 ? proteinName.substring(0, 10) + '...' : proteinName;
    } else if (width > 0.8) {
      proteinElement.textContent = proteinName.substring(0, 3);
    } else {
      proteinElement.textContent = '';
    }
  }

  /**
   * Add interaction handlers to protein element
   */
  addProteinElementHandlers(proteinElement, protein) {
    proteinElement.addEventListener('click', () => {
      this.showProteinDetails(protein, this.genomeBrowser.currentChromosome);
    });
  }

  createEnhancedGCVisualization(sequence, viewStart, viewEnd) {
    const container = document.createElement('div');
    container.className = 'gc-content-skew-display';

    // Get GC track settings
    const settings = this.getTrackSettings('gc');
    const trackHeight = settings.height || 140;

    container.style.cssText = `
            position: relative;
            height: ${trackHeight}px;
            background: linear-gradient(to bottom, #f8f9fa 0%, #e9ecef 50%, #f8f9fa 100%);
            border: 1px solid #dee2e6;
            border-radius: 6px;
            overflow: hidden;
        `;

    // Calculate actual container width dynamically
    const gcTrack = document.querySelector('.gc-track .track-content');
    let containerWidth = 800; // Default fallback
    if (gcTrack) {
      // Force layout recalculation and get actual width
      gcTrack.style.width = '100%';
      containerWidth = gcTrack.getBoundingClientRect().width || gcTrack.offsetWidth || 800;
    }

    // Create SVG for crisp, scalable visualization
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', `0 0 ${containerWidth} ${trackHeight}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            cursor: crosshair;
        `;

    // Calculate dynamic window size based on sequence length and current zoom level
    const currentRange = viewEnd - viewStart;
    const basePairsPerPixel = currentRange / containerWidth; // Use actual container width

    // Adaptive window size: smaller for zoomed-in views, larger for zoomed-out views
    let windowSize;
    if (basePairsPerPixel <= 1) {
      // Very zoomed in - use small windows for high resolution
      windowSize = Math.max(10, Math.floor(currentRange / 200));
    } else if (basePairsPerPixel <= 10) {
      // Moderately zoomed in
      windowSize = Math.max(50, Math.floor(currentRange / 100));
    } else {
      // Zoomed out - use larger windows
      windowSize = Math.max(100, Math.floor(currentRange / 50));
    }

    // Ensure window size doesn't exceed sequence length
    windowSize = Math.min(windowSize, sequence.length);

    // Calculate step size for smooth visualization
    const stepSize = Math.max(1, Math.floor(windowSize / 4));

    console.log(
      `Dynamic GC analysis: containerWidth=${containerWidth}px, range=${currentRange}, bpPerPixel=${basePairsPerPixel.toFixed(2)}, windowSize=${windowSize}, stepSize=${stepSize}`
    );

    // Calculate GC content and skew data with dynamic parameters
    const analysisData = this.calculateDynamicGCData(sequence, windowSize, stepSize);

    if (!analysisData || analysisData.positions.length === 0) {
      // No data to display
      const noDataMsg = document.createElement('div');
      noDataMsg.textContent = 'Sequence too short for GC analysis';
      noDataMsg.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: #6c757d;
                font-size: 12px;
                font-style: italic;
            `;
      container.appendChild(noDataMsg);
      return container;
    }

    // Create SVG visualization with settings
    this.renderSVGGCVisualization(svg, analysisData, containerWidth, settings);

    // Add interactive tooltip
    this.addSVGGCTooltip(container, svg, analysisData, viewStart, windowSize);

    // Add legend
    const legend = this.createGCLegend();
    container.appendChild(legend);

    container.appendChild(svg);

    return container;
  }

  calculateDynamicGCData(sequence, windowSize, stepSize) {
    const gcData = [];
    const skewData = [];
    const positions = [];
    const detailedData = []; // Store detailed composition data

    // Process sequence in windows with specified step size
    for (let i = 0; i <= sequence.length - windowSize; i += stepSize) {
      const window = sequence.substring(i, i + windowSize);
      const analysis = this.analyzeGCWindow(window);

      if (analysis.totalValidBases > 0) {
        gcData.push(analysis.gcPercent);
        skewData.push(analysis.gcSkew);
        positions.push(i + windowSize / 2); // Center position of window
        detailedData.push({
          position: i + windowSize / 2,
          windowStart: i,
          windowEnd: i + windowSize,
          ...analysis,
        });
      }
    }

    if (gcData.length === 0) {
      return null;
    }

    // Calculate statistics for scaling
    const gcMin = Math.min(...gcData);
    const gcMax = Math.max(...gcData);
    const skewMin = Math.min(...skewData);
    const skewMax = Math.max(...skewData);

    // Add some padding to the ranges for better visualization
    const gcRange = gcMax - gcMin;
    const skewRange = skewMax - skewMin;
    const gcPadding = Math.max(1, gcRange * 0.1);
    const skewPadding = Math.max(0.01, skewRange * 0.1);

    return {
      gcData,
      skewData,
      positions,
      detailedData,
      gcMin: gcMin - gcPadding,
      gcMax: gcMax + gcPadding,
      skewMin: skewMin - skewPadding,
      skewMax: skewMax + skewPadding,
      sequenceLength: sequence.length,
      windowSize,
      stepSize,
    };
  }

  analyzeGCWindow(window) {
    const bases = window.toUpperCase();
    const gCount = (bases.match(/G/g) || []).length;
    const cCount = (bases.match(/C/g) || []).length;
    const aCount = (bases.match(/A/g) || []).length;
    const tCount = (bases.match(/T/g) || []).length;
    const nCount = (bases.match(/N/g) || []).length;
    const totalValidBases = gCount + cCount + aCount + tCount;
    const totalBases = totalValidBases + nCount;

    if (totalValidBases === 0) {
      return {
        gcPercent: 0,
        gcSkew: 0,
        atSkew: 0,
        gCount,
        cCount,
        aCount,
        tCount,
        nCount,
        totalValidBases,
        totalBases,
      };
    }

    const gcPercent = ((gCount + cCount) / totalValidBases) * 100;
    const gcSkew = gCount + cCount > 0 ? (gCount - cCount) / (gCount + cCount) : 0;
    const atSkew = aCount + tCount > 0 ? (aCount - tCount) / (aCount + tCount) : 0;

    return {
      gcPercent,
      gcSkew,
      atSkew,
      gCount,
      cCount,
      aCount,
      tCount,
      nCount,
      totalValidBases,
      totalBases,
    };
  }

  renderSVGGCVisualization(svg, data, containerWidth = 800, settings = {}) {
    const { gcData, skewData, positions, gcMin, gcMax, skewMin, skewMax, sequenceLength } = data;

    // Get settings with defaults
    const contentColor = settings.contentColor || '#3b82f6';
    const skewPositiveColor = settings.skewPositiveColor || '#10b981';
    const skewNegativeColor = settings.skewNegativeColor || '#ef4444';
    const lineWidth = settings.lineWidth || 2;
    const trackHeight = settings.height || 140;

    // Clear any existing content
    svg.innerHTML = '';

    // Define dimensions and layout with minimal padding
    const viewWidth = containerWidth; // Use dynamic container width
    const viewHeight = trackHeight;
    const padding = 2; // Reduced from 20 to 2 for minimal padding
    const plotWidth = viewWidth - 2 * padding;
    const plotHeight = viewHeight - 2 * padding;
    const centerY = viewHeight / 2;
    const gcHeight = centerY - padding;
    const skewHeight = centerY - padding;

    // Create gradient definitions
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

    // GC content gradient
    const gcGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gcGradient.setAttribute('id', 'gcGradient');
    gcGradient.setAttribute('x1', '0%');
    gcGradient.setAttribute('y1', '0%');
    gcGradient.setAttribute('x2', '0%');
    gcGradient.setAttribute('y2', '100%');

    const gcStop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    gcStop1.setAttribute('offset', '0%');
    gcStop1.setAttribute('stop-color', contentColor);
    gcStop1.setAttribute('stop-opacity', '0.8');

    const gcStop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    gcStop2.setAttribute('offset', '100%');
    gcStop2.setAttribute('stop-color', contentColor);
    gcStop2.setAttribute('stop-opacity', '0.2');

    gcGradient.appendChild(gcStop1);
    gcGradient.appendChild(gcStop2);

    // GC skew gradients (positive and negative)
    const skewPosGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    skewPosGradient.setAttribute('id', 'skewPosGradient');
    skewPosGradient.setAttribute('x1', '0%');
    skewPosGradient.setAttribute('y1', '0%');
    skewPosGradient.setAttribute('x2', '0%');
    skewPosGradient.setAttribute('y2', '100%');

    const skewPosStop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    skewPosStop1.setAttribute('offset', '0%');
    skewPosStop1.setAttribute('stop-color', skewPositiveColor);
    skewPosStop1.setAttribute('stop-opacity', '0.8');

    const skewPosStop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    skewPosStop2.setAttribute('offset', '100%');
    skewPosStop2.setAttribute('stop-color', skewPositiveColor);
    skewPosStop2.setAttribute('stop-opacity', '0.2');

    skewPosGradient.appendChild(skewPosStop1);
    skewPosGradient.appendChild(skewPosStop2);

    const skewNegGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    skewNegGradient.setAttribute('id', 'skewNegGradient');
    skewNegGradient.setAttribute('x1', '0%');
    skewNegGradient.setAttribute('y1', '0%');
    skewNegGradient.setAttribute('x2', '0%');
    skewNegGradient.setAttribute('y2', '100%');

    const skewNegStop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    skewNegStop1.setAttribute('offset', '0%');
    skewNegStop1.setAttribute('stop-color', skewNegativeColor);
    skewNegStop1.setAttribute('stop-opacity', '0.2');

    const skewNegStop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    skewNegStop2.setAttribute('offset', '100%');
    skewNegStop2.setAttribute('stop-color', skewNegativeColor);
    skewNegStop2.setAttribute('stop-opacity', '0.8');

    skewNegGradient.appendChild(skewNegStop1);
    skewNegGradient.appendChild(skewNegStop2);

    defs.appendChild(gcGradient);
    defs.appendChild(skewPosGradient);
    defs.appendChild(skewNegGradient);
    svg.appendChild(defs);

    // Draw background grid
    this.drawSVGGrid(svg, padding, plotWidth, plotHeight, centerY);

    // Draw GC content area and line with settings
    this.drawSVGGCContent(
      svg,
      gcData,
      positions,
      sequenceLength,
      padding,
      plotWidth,
      gcHeight,
      gcMin,
      gcMax,
      contentColor,
      lineWidth
    );

    // Draw GC skew areas and line with settings
    this.drawSVGGCSkew(
      svg,
      skewData,
      positions,
      sequenceLength,
      padding,
      plotWidth,
      centerY,
      plotHeight,
      skewMin,
      skewMax,
      skewPositiveColor,
      skewNegativeColor,
      lineWidth
    );

    // Draw axis labels with custom colors
    this.drawSVGAxisLabels(
      svg,
      viewWidth,
      viewHeight,
      gcMin,
      gcMax,
      skewMin,
      skewMax,
      contentColor,
      skewPositiveColor,
      skewNegativeColor
    );
  }

  drawSVGGrid(svg, padding, plotWidth, plotHeight, centerY) {
    const gridGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gridGroup.setAttribute('class', 'grid-lines');

    // Grid line style
    const gridStyle = 'stroke: #e9ecef; stroke-width: 0.5; stroke-dasharray: 2,2; opacity: 0.6;';

    // Horizontal grid lines for GC content (upper half)
    for (let i = 1; i <= 3; i++) {
      const y = padding + (i * (centerY - padding)) / 4;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', padding);
      line.setAttribute('y1', y);
      line.setAttribute('x2', padding + plotWidth);
      line.setAttribute('y2', y);
      line.setAttribute('style', gridStyle);
      gridGroup.appendChild(line);
    }

    // Horizontal grid lines for GC skew (lower half)
    for (let i = 1; i <= 3; i++) {
      const y = centerY + padding + (i * (plotHeight - centerY - padding)) / 4;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', padding);
      line.setAttribute('y1', y);
      line.setAttribute('x2', padding + plotWidth);
      line.setAttribute('y2', y);
      line.setAttribute('style', gridStyle);
      gridGroup.appendChild(line);
    }

    // Center line (zero line for GC skew)
    const centerLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    centerLine.setAttribute('x1', padding);
    centerLine.setAttribute('y1', centerY);
    centerLine.setAttribute('x2', padding + plotWidth);
    centerLine.setAttribute('y2', centerY);
    centerLine.setAttribute('style', 'stroke: #6c757d; stroke-width: 1; opacity: 0.8;');
    gridGroup.appendChild(centerLine);

    svg.appendChild(gridGroup);
  }

  drawSVGGCContent(
    svg,
    gcData,
    positions,
    sequenceLength,
    padding,
    plotWidth,
    maxHeight,
    gcMin,
    gcMax,
    contentColor = '#3b82f6',
    lineWidth = 2
  ) {
    if (gcData.length < 2) return;

    const gcRange = gcMax - gcMin;

    // Create path for filled area
    const areaPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    let pathData = `M ${padding} ${maxHeight}`;

    // Add points for the area
    for (let i = 0; i < gcData.length; i++) {
      const x = padding + (positions[i] / sequenceLength) * plotWidth;
      const normalizedGC = gcRange > 0 ? (gcData[i] - gcMin) / gcRange : 0.5;
      const y = maxHeight - normalizedGC * (maxHeight - padding);
      pathData += ` L ${x} ${y}`;
    }

    pathData += ` L ${padding + plotWidth} ${maxHeight} Z`;

    areaPath.setAttribute('d', pathData);
    areaPath.setAttribute('fill', 'url(#gcGradient)');
    areaPath.setAttribute('stroke', 'none');
    svg.appendChild(areaPath);

    // Create path for line
    const linePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    let lineData = '';

    for (let i = 0; i < gcData.length; i++) {
      const x = padding + (positions[i] / sequenceLength) * plotWidth;
      const normalizedGC = gcRange > 0 ? (gcData[i] - gcMin) / gcRange : 0.5;
      const y = maxHeight - normalizedGC * (maxHeight - padding);

      if (i === 0) {
        lineData = `M ${x} ${y}`;
      } else {
        lineData += ` L ${x} ${y}`;
      }
    }

    linePath.setAttribute('d', lineData);
    linePath.setAttribute('fill', 'none');
    linePath.setAttribute('stroke', contentColor);
    linePath.setAttribute('stroke-width', lineWidth);
    linePath.setAttribute('stroke-linecap', 'round');
    linePath.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(linePath);
  }

  drawSVGGCSkew(
    svg,
    skewData,
    positions,
    sequenceLength,
    padding,
    plotWidth,
    centerY,
    plotHeight,
    skewMin,
    skewMax,
    skewPositiveColor = '#10b981',
    skewNegativeColor = '#ef4444',
    lineWidth = 2
  ) {
    if (skewData.length < 2) return;

    const skewRange = skewMax - skewMin;

    // Calculate zero line position in the lower half
    const skewHalfHeight = plotHeight - centerY;
    const zeroRatio = skewRange > 0 ? Math.abs(skewMin) / skewRange : 0.5;
    const zeroY = centerY + zeroRatio * skewHalfHeight;

    // Create continuous area paths for positive and negative regions
    let posAreaData = '';
    let negAreaData = '';
    let hasPositive = false;
    let hasNegative = false;

    // Build continuous area paths
    for (let i = 0; i < skewData.length; i++) {
      const x = padding + (positions[i] / sequenceLength) * plotWidth;
      const normalizedSkew = skewRange > 0 ? (skewData[i] - skewMin) / skewRange : 0.5;
      const y = centerY + (1 - normalizedSkew) * skewHalfHeight;

      if (skewData[i] >= 0) {
        if (!hasPositive) {
          posAreaData = `M ${x} ${zeroY}`;
          hasPositive = true;
        }
        posAreaData += ` L ${x} ${Math.min(y, zeroY)}`;
      }

      if (skewData[i] <= 0) {
        if (!hasNegative) {
          negAreaData = `M ${x} ${zeroY}`;
          hasNegative = true;
        }
        negAreaData += ` L ${x} ${Math.max(y, zeroY)}`;
      }
    }

    // Close positive area path
    if (hasPositive && posAreaData) {
      posAreaData += ` L ${padding + plotWidth} ${zeroY} L ${padding} ${zeroY} Z`;
      const posPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      posPath.setAttribute('d', posAreaData);
      posPath.setAttribute('fill', 'url(#skewPosGradient)');
      posPath.setAttribute('stroke', 'none');
      svg.appendChild(posPath);
    }

    // Close negative area path
    if (hasNegative && negAreaData) {
      negAreaData += ` L ${padding + plotWidth} ${zeroY} L ${padding} ${zeroY} Z`;
      const negPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      negPath.setAttribute('d', negAreaData);
      negPath.setAttribute('fill', 'url(#skewNegGradient)');
      negPath.setAttribute('stroke', 'none');
      svg.appendChild(negPath);
    }

    // Create path for skew line
    const linePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    let lineData = '';

    for (let i = 0; i < skewData.length; i++) {
      const x = padding + (positions[i] / sequenceLength) * plotWidth;
      const normalizedSkew = skewRange > 0 ? (skewData[i] - skewMin) / skewRange : 0.5;
      const y = centerY + (1 - normalizedSkew) * skewHalfHeight;

      if (i === 0) {
        lineData = `M ${x} ${y}`;
      } else {
        lineData += ` L ${x} ${y}`;
      }
    }

    linePath.setAttribute('d', lineData);
    linePath.setAttribute('fill', 'none');
    linePath.setAttribute('stroke', skewPositiveColor);
    linePath.setAttribute('stroke-width', lineWidth);
    linePath.setAttribute('stroke-linecap', 'round');
    linePath.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(linePath);
  }

  drawSVGAxisLabels(
    svg,
    viewWidth,
    viewHeight,
    gcMin,
    gcMax,
    skewMin,
    skewMax,
    contentColor = '#3b82f6',
    skewPositiveColor = '#10b981',
    skewNegativeColor = '#ef4444'
  ) {
    const labelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    labelGroup.setAttribute('class', 'axis-labels');

    const labelStyle = 'font-family: Inter, sans-serif; font-size: 10px;';

    // Track labels (right side) - adjusted for reduced padding
    const gcLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    gcLabel.setAttribute('x', viewWidth - 25); // Moved further right to account for reduced padding
    gcLabel.setAttribute('y', '15');
    gcLabel.setAttribute('text-anchor', 'start');
    gcLabel.setAttribute('style', labelStyle + ` fill: ${contentColor}; font-weight: 600;`);
    gcLabel.textContent = 'GC%';

    const skewLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    skewLabel.setAttribute('x', viewWidth - 25); // Moved further right to account for reduced padding
    skewLabel.setAttribute('y', viewHeight - 5);
    skewLabel.setAttribute('text-anchor', 'start');
    skewLabel.setAttribute('style', labelStyle + ` fill: ${skewPositiveColor}; font-weight: 600;`);
    skewLabel.textContent = 'Skew';

    labelGroup.appendChild(gcLabel);
    labelGroup.appendChild(skewLabel);

    svg.appendChild(labelGroup);
  }

  addSVGGCTooltip(container, svg, data, viewStart, windowSize) {
    const tooltip = document.createElement('div');
    tooltip.className = 'gc-tooltip';
    tooltip.style.cssText = `
            position: absolute;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 11px;
            line-height: 1.4;
            pointer-events: none;
            z-index: 1000;
            display: none;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            max-width: 200px;
            white-space: nowrap;
        `;
    container.appendChild(tooltip);

    svg.addEventListener('mousemove', e => {
      const rect = svg.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;

      // Find closest data point
      const sequencePos = x * data.sequenceLength;
      let closestIndex = 0;
      let minDistance = Math.abs(data.positions[0] - sequencePos);

      for (let i = 1; i < data.positions.length; i++) {
        const distance = Math.abs(data.positions[i] - sequencePos);
        if (distance < minDistance) {
          minDistance = distance;
          closestIndex = i;
        }
      }

      if (closestIndex < data.detailedData.length) {
        const detail = data.detailedData[closestIndex];
        const absolutePos = viewStart + detail.position;
        const windowStart = viewStart + detail.windowStart;
        const windowEnd = viewStart + detail.windowEnd;

        tooltip.innerHTML = `
                    <div style="font-weight: 600; margin-bottom: 4px; color: #ffc107;">Position: ${Math.round(absolutePos).toLocaleString()}</div>
                    <div style="color: #28a745;">GC Content: ${detail.gcPercent.toFixed(2)}%</div>
                    <div style="color: #495057;">GC Skew: ${detail.gcSkew.toFixed(4)}</div>
                    <div style="color: #17a2b8;">AT Skew: ${detail.atSkew.toFixed(4)}</div>
                    <div style="margin-top: 4px; color: #6c757d; font-size: 10px;">
                        Window: ${windowStart.toLocaleString()}-${windowEnd.toLocaleString()}<br>
                        G:${detail.gCount} C:${detail.cCount} A:${detail.aCount} T:${detail.tCount}
                    </div>
                `;

        tooltip.style.display = 'block';

        // Position tooltip near cursor but keep it within container bounds
        const containerRect = container.getBoundingClientRect();
        const tooltipX = Math.min(e.clientX - containerRect.left + 10, containerRect.width - 220);
        const tooltipY = Math.max(e.clientY - containerRect.top - 60, 10);

        tooltip.style.left = `${tooltipX}px`;
        tooltip.style.top = `${tooltipY}px`;
      }
    });

    svg.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });
  }

  showGeneDetails(gene, operonInfo) {
    // Call the main CodeXomics's gene selection methods
    this.genomeBrowser.selectGene(gene, operonInfo);
    this.genomeBrowser.showGeneDetailsPanel();
    this.genomeBrowser.populateGeneDetails(gene, operonInfo);
    this.genomeBrowser.highlightGeneSequence(gene);
  }

  showProteinDetails(protein, chromosome) {
    const sequence = this.genomeBrowser.currentSequence[chromosome];
    // protein.start and protein.end are already 0-based coordinates, consistent with viewport coordinates
    const dnaSequence = sequence.substring(protein.start, protein.end);
    const proteinSequence = this.genomeBrowser.translateDNA(dnaSequence, protein.strand);

    console.log(`🔍 [showProteinDetails] Fixed protein coordinate mapping:`, {
      proteinStart: protein.start,
      proteinEnd: protein.end,
      dnaSequenceLength: dnaSequence.length,
      expectedLength: protein.end - protein.start,
    });

    const details = [];
    details.push(`Type: Protein (CDS)`);
    details.push(`Position: ${protein.start}-${protein.end}`);
    details.push(`Strand: ${protein.strand === -1 ? 'Reverse (-)' : 'Forward (+)'}`);
    details.push(
      `Length: ${protein.end - protein.start + 1} bp (${Math.floor((protein.end - protein.start + 1) / 3)} aa)`
    );
    details.push(`DNA Sequence: ${dnaSequence.substring(0, 60)}${dnaSequence.length > 60 ? '...' : ''}`);
    details.push(`Protein Sequence: ${proteinSequence.substring(0, 20)}${proteinSequence.length > 20 ? '...' : ''}`);

    if (protein.qualifiers) {
      Object.entries(protein.qualifiers).forEach(([key, value]) => {
        // Convert value to string and check if it's meaningful
        const stringValue = value != null ? String(value) : '';
        if (stringValue && stringValue !== 'Unknown') {
          details.push(`${key}: ${stringValue}`);
        }
      });
    }

    alert(details.join('\n'));
  }

  lightenColor(color, percent) {
    const num = parseInt(color.slice(1), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = ((num >> 8) & 0x00ff) + amt;
    const B = (num & 0x0000ff) + amt;
    return (
      '#' +
      (0x1000000 + (R < 255 ? R : 255) * 0x10000 + (G < 255 ? G : 255) * 0x100 + (B < 255 ? B : 255))
        .toString(16)
        .slice(1)
    );
  }

  darkenColor(color, percent) {
    const num = parseInt(color.slice(1), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) - amt;
    const G = ((num >> 8) & 0x00ff) - amt;
    const B = (num & 0x0000ff) - amt;
    return (
      '#' + (0x1000000 + (R < 0 ? 0 : R) * 0x10000 + (G < 0 ? 0 : G) * 0x100 + (B < 0 ? 0 : B)).toString(16).slice(1)
    );
  }

  updateOperonsPanel(operons, visibleOperons) {
    const operonsList = document.getElementById('operonsList');

    if (!operonsList) return;

    // Clear existing content
    operonsList.innerHTML = '';

    if (visibleOperons.size === 0) {
      const noOperons = document.createElement('p');
      noOperons.className = 'no-operons';
      noOperons.textContent = 'No operons detected in current view';
      operonsList.appendChild(noOperons);
      return;
    }

    // Create operon items for visible operons
    Array.from(visibleOperons).forEach(operonName => {
      // Find the operon data
      const operonData = operons.find(op => op.name === operonName);
      if (!operonData) return;

      const color = this.genomeBrowser.assignOperonColor(operonName);

      const operonItem = document.createElement('div');
      operonItem.className = 'operon-item';

      // Color indicator
      const colorIndicator = document.createElement('div');
      colorIndicator.className = 'operon-color-indicator';
      colorIndicator.style.background = `linear-gradient(135deg, ${color}, ${this.lightenColor(color, 20)})`;
      colorIndicator.style.borderColor = this.darkenColor(color, 20);

      // Operon info
      const operonInfo = document.createElement('div');
      operonInfo.className = 'operon-info';

      const operonNameEl = document.createElement('div');
      operonNameEl.className = 'operon-name';
      operonNameEl.textContent = operonName.replace('_operon', '');

      const operonDetails = document.createElement('div');
      operonDetails.className = 'operon-details';
      operonDetails.textContent = `${operonData.start.toLocaleString()}-${operonData.end.toLocaleString()} (${operonData.strand === -1 ? '-' : '+'})`;

      operonInfo.appendChild(operonNameEl);
      operonInfo.appendChild(operonDetails);

      // Gene count badge
      const geneCount = document.createElement('div');
      geneCount.className = 'operon-gene-count';
      geneCount.textContent = operonData.genes.length.toString();
      geneCount.title = `${operonData.genes.length} genes in this operon`;

      // Add click handler to navigate to operon
      operonItem.addEventListener('click', () => {
        this.navigateToOperon(operonData);
      });

      operonItem.appendChild(colorIndicator);
      operonItem.appendChild(operonInfo);
      operonItem.appendChild(geneCount);

      operonsList.appendChild(operonItem);
    });
  }

  navigateToOperon(operonData) {
    // Navigate to the operon location
    const padding = Math.max(1000, (operonData.end - operonData.start) * 0.2);
    const newStart = Math.max(0, operonData.start - padding);
    const newEnd = operonData.end + padding;

    this.genomeBrowser.currentPosition = { start: newStart, end: newEnd };

    // Refresh the view
    const currentChr = document.getElementById('chromosomeSelect').value;
    if (currentChr && this.genomeBrowser.currentSequence && this.genomeBrowser.currentSequence[currentChr]) {
      this.genomeBrowser.displayGenomeView(currentChr, this.genomeBrowser.currentSequence[currentChr]);
    }

    // Update statistics
    this.genomeBrowser.updateStatistics(currentChr, this.genomeBrowser.currentSequence[currentChr]);
  }

  // New method to dispatch gene arrangement based on layout mode
  arrangeGenesInRows(genes, viewStart, viewEnd, operons, settings) {
    const layoutMode = settings?.layoutMode || 'compact';
    console.log(`Arranging genes with layout mode: ${layoutMode}`);

    if (layoutMode === 'groupByType') {
      return this.arrangeGenesByType(genes, settings);
    }
    // Default to compact mode
    return this.arrangeGenesCompactly(genes, operons, settings);
  }

  // New: Arranges genes by feature type - consolidates all same-type elements on a single row
  arrangeGenesByType(genes, settings) {
    const sortedGenes = [...genes].sort((a, b) => a.start - b.start);
    const typeMap = new Map();

    // Define a canonical order for feature types
    const typeOrder = [
      'CDS',
      'gene',
      'mRNA',
      'promoter',
      'terminator',
      'regulatory',
      'tRNA',
      'rRNA',
      'repeat_region',
      'misc_feature',
    ];

    // Initialize the map to maintain order
    typeOrder.forEach(type => typeMap.set(type, []));

    // Group genes by their type
    sortedGenes.forEach(gene => {
      const type = typeOrder.includes(gene.type) ? gene.type : 'misc_feature';
      if (!typeMap.has(type)) {
        // For types not in our canonical order
        typeMap.set(type, []);
      }
      typeMap.get(type).push(gene);
    });

    const finalRows = [];
    // Iterate over the ordered map to build final rows
    // CHANGE: Consolidate all elements of the same type onto a SINGLE row (allowing overlaps)
    for (const [type, genesForType] of typeMap.entries()) {
      if (genesForType.length === 0) continue;

      // All genes of this type go on ONE row (overlaps are allowed)
      finalRows.push(genesForType);
    }

    console.log(`arrangeGenesByType result: created ${finalRows.length} rows (one per type with elements)`);
    return finalRows;
  }

  // New: Arranges genes compactly, forcing into maxRows and allowing overlaps
  arrangeGenesCompactly(genes, operons, settings) {
    const maxRows = settings?.maxRows || 6;
    const showOperonsSameRow = settings?.showOperonsSameRow || false;

    const sortedGenes = [...genes].sort((a, b) => a.start - b.start);
    let idealRows = [];

    // First, arrange into ideal non-overlapping rows
    if (showOperonsSameRow && operons && operons.length > 0) {
      // Complex logic to group operons (simplified for brevity, can be enhanced)
      const operonGroups = new Map();
      const singleGenes = [];

      sortedGenes.forEach(gene => {
        const operonInfo = this.genomeBrowser.getGeneOperonInfo(gene, operons);
        if (operonInfo.isInOperon) {
          if (!operonGroups.has(operonInfo.operonName)) operonGroups.set(operonInfo.operonName, []);
          operonGroups.get(operonInfo.operonName).push(gene);
        } else {
          singleGenes.push(gene);
        }
      });

      const placeInRows = (geneList, rows) => {
        geneList.forEach(gene => {
          let placed = false;
          for (let i = 0; i < rows.length; i++) {
            if (!rows[i].some(existing => this.genesOverlap(gene, existing))) {
              rows[i].push(gene);
              placed = true;
              break;
            }
          }
          if (!placed) rows.push([gene]);
        });
      };

      for (const operonGenes of operonGroups.values()) {
        placeInRows(operonGenes, idealRows); // Simplified handling
      }
      placeInRows(singleGenes, idealRows);
    } else {
      // Original simpler algorithm for non-operon mode or no operons
      sortedGenes.forEach(gene => {
        let placed = false;
        for (const row of idealRows) {
          if (!row.some(existingGene => this.genesOverlap(gene, existingGene))) {
            row.push(gene);
            placed = true;
            break;
          }
        }
        if (!placed) {
          idealRows.push([gene]);
        }
      });
    }

    // Now, squash rows if they exceed maxRows
    if (idealRows.length > maxRows) {
      const finalRows = idealRows.slice(0, maxRows);
      for (let i = maxRows; i < idealRows.length; i++) {
        for (const gene of idealRows[i]) {
          // Distribute genes from extra rows into the allowed rows
          finalRows[i % maxRows].push(gene);
        }
      }
      console.log(`arrangeGenesCompactly result: squashed ${idealRows.length} rows into ${finalRows.length}`);
      return finalRows;
    } else {
      console.log(`arrangeGenesCompactly result: created ${idealRows.length} rows`);
      return idealRows;
    }
  }

  // Old method, kept for reference. New method dispatches based on layout mode.
  arrangeGenesInRows_legacy(genes, viewStart, viewEnd, operons, settings) {
    // Get settings with defaults
    const maxRows = settings?.maxRows || 6;
    const showOperonsSameRow = settings?.showOperonsSameRow || false;

    console.log(
      `arrangeGenesInRows: maxRows=${maxRows}, showOperonsSameRow=${showOperonsSameRow}, totalGenes=${genes.length}`
    );

    // Sort genes by start position
    const sortedGenes = [...genes].sort((a, b) => a.start - b.start);
    const rows = [];

    if (showOperonsSameRow && operons && operons.length > 0) {
      // Group genes by operons first
      const operonGroups = new Map();
      const singleGenes = [];

      sortedGenes.forEach(gene => {
        const operonInfo = this.genomeBrowser.getGeneOperonInfo(gene, operons);
        if (operonInfo.isInOperon) {
          if (!operonGroups.has(operonInfo.operonName)) {
            operonGroups.set(operonInfo.operonName, []);
          }
          operonGroups.get(operonInfo.operonName).push(gene);
        } else {
          singleGenes.push(gene);
        }
      });

      // Process operon groups first (try to place all genes of an operon in the same row)
      for (const [operonName, operonGenes] of operonGroups) {
        // Sort operon genes by position
        operonGenes.sort((a, b) => a.start - b.start);

        // Try to find a row that can fit all operon genes
        let placedInExistingRow = false;

        for (let rowIndex = 0; rowIndex < rows.length && rowIndex < maxRows; rowIndex++) {
          const row = rows[rowIndex];
          let canPlaceAll = true;

          // Check if all operon genes can fit in this row
          for (const operonGene of operonGenes) {
            let conflicts = false;
            for (const existingGene of row) {
              if (this.genesOverlap(operonGene, existingGene)) {
                conflicts = true;
                break;
              }
            }
            if (conflicts) {
              canPlaceAll = false;
              break;
            }
          }

          if (canPlaceAll) {
            // Add all operon genes to this row
            row.push(...operonGenes);
            placedInExistingRow = true;
            break;
          }
        }

        // If couldn't place in existing row and we haven't reached max rows, create new row
        if (!placedInExistingRow && rows.length < maxRows) {
          rows.push([...operonGenes]);
        } else if (!placedInExistingRow) {
          // If we've reached max rows, place operon genes in available rows with space
          operonGenes.forEach(gene => {
            let placed = false;
            for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
              const row = rows[rowIndex];
              let canPlace = true;

              for (const existingGene of row) {
                if (this.genesOverlap(gene, existingGene)) {
                  canPlace = false;
                  break;
                }
              }

              if (canPlace) {
                row.push(gene);
                placed = true;
                break;
              }
            }

            // If still can't place, add to the last row (genes will overlap)
            if (!placed && rows.length > 0) {
              rows[rows.length - 1].push(gene);
            }
          });
        }
      }

      // Process single genes
      singleGenes.forEach(gene => {
        let placed = false;

        // Try to place in existing rows
        for (let rowIndex = 0; rowIndex < rows.length && rowIndex < maxRows; rowIndex++) {
          const row = rows[rowIndex];
          let canPlace = true;

          for (const existingGene of row) {
            if (this.genesOverlap(gene, existingGene)) {
              canPlace = false;
              break;
            }
          }

          if (canPlace) {
            row.push(gene);
            placed = true;
            break;
          }
        }

        // If couldn't place in existing row and we haven't reached max rows, create new row
        if (!placed && rows.length < maxRows) {
          rows.push([gene]);
        } else if (!placed && rows.length > 0) {
          // If we've reached max rows, add to the last row (genes will overlap)
          rows[rows.length - 1].push(gene);
        }
      });
    } else {
      // Original algorithm: place genes without operon grouping
      sortedGenes.forEach(gene => {
        let placed = false;

        // Try to place gene in existing rows (up to maxRows)
        for (let rowIndex = 0; rowIndex < rows.length && rowIndex < maxRows; rowIndex++) {
          const row = rows[rowIndex];
          let canPlace = true;

          // Check if gene overlaps with any gene in this row
          for (const existingGene of row) {
            if (this.genesOverlap(gene, existingGene)) {
              canPlace = false;
              break;
            }
          }

          if (canPlace) {
            row.push(gene);
            placed = true;
            break;
          }
        }

        // If couldn't place in existing row and we haven't reached max rows, create new row
        if (!placed && rows.length < maxRows) {
          rows.push([gene]);
        } else if (!placed && rows.length > 0) {
          // If we've reached max rows, add to the last row (genes will overlap)
          rows[rows.length - 1].push(gene);
        }
      });
    }

    console.log(`arrangeGenesInRows result: created ${rows.length} rows`);
    return rows;
  }

  // Helper to check if two genes overlap with a buffer
  /**
   * Create a toggle button for Reads track components (Coverage, Reference, Reads)
   */
  createReadsToggleButton(iconName, labelText, stateKey) {
    const btn = document.createElement('button');
    btn.className = 'track-btn track-reads-toggle-btn';
    btn.innerHTML = `<i class="fas fa-${iconName}"></i>`;
    btn.title = `Toggle ${labelText}`;
    btn.style.cssText = `padding: 2px 5px; font-size: 11px; border: 1px solid #ccc; border-radius: 3px; background: white; cursor: pointer; transition: background 0.2s, color 0.2s;`;

    // Map state keys to renderer options for lookup
    const optionMap = {
      readsCoverage: 'showCoverage',
      readsReference: 'showReference',
      readsReads: 'showReads',
    };
    const optionKey = optionMap[stateKey];

    // Initialize elementVisibilityStates based on trackSettings if available
    if (this.trackSettings && this.trackSettings['reads'] && this.trackSettings['reads'][stateKey] !== undefined) {
      // If setting exists, use it
      this.elementVisibilityStates[stateKey] = this.trackSettings['reads'][stateKey] !== false;
    }

    // If we have a mapped setting key, check that too (it's the preferred key)
    if (
      optionKey &&
      this.trackSettings &&
      this.trackSettings['reads'] &&
      this.trackSettings['reads'][optionKey] !== undefined
    ) {
      this.elementVisibilityStates[stateKey] = this.trackSettings['reads'][optionKey] !== false;
    }

    // Default to true if no setting is found
    if (this.elementVisibilityStates[stateKey] === undefined) {
      this.elementVisibilityStates[stateKey] = true;
    }

    if (!this.elementVisibilityStates[stateKey]) {
      btn.style.background = '#eee';
      btn.style.color = '#aaa';
      btn.classList.remove('active');
    } else {
      btn.classList.add('active');
    }

    // Mark button for easy finding later
    btn.dataset.toggleType = stateKey;

    btn.addEventListener('click', e => {
      e.stopPropagation();

      // Toggle state
      this.elementVisibilityStates[stateKey] = !this.elementVisibilityStates[stateKey];
      const newValue = this.elementVisibilityStates[stateKey];

      // Update visuals
      if (newValue) {
        btn.style.background = 'white';
        btn.style.color = '#333';
        btn.classList.add('active');
      } else {
        btn.style.background = '#eee';
        btn.style.color = '#aaa';
        btn.classList.remove('active');
      }

      // Update settings if mapped
      if (optionKey) {
        // Detect fileId from the track element for instance-level settings
        const trackElement = btn.closest('.reads-track');
        const fileId = trackElement?.dataset?.fileId || null;
        const settingsKey = fileId ? `reads::${fileId}` : 'reads';

        // Get current settings or init
        if (!this.trackSettings) this.trackSettings = {};
        if (!this.trackSettings[settingsKey]) {
          // Initialize with type-level defaults merged
          this.trackSettings[settingsKey] = { ...(this.trackSettings['reads'] || {}) };
        }

        // Update and save
        this.trackSettings[settingsKey][optionKey] = newValue;
        // Also update the legacy key if it exists to be safe
        this.trackSettings[settingsKey][stateKey] = newValue;

        // Persist settings
        if (typeof this.saveTrackSettings === 'function') {
          this.saveTrackSettings('reads', this.trackSettings[settingsKey], fileId);
        }
      }

      // Update all active CanvasReadsRenderers
      if (this.canvasRenderers) {
        this.canvasRenderers.forEach(renderer => {
          // Check if it has the updateOptions method (is a CanvasReadsRenderer)
          if (renderer && typeof renderer.updateOptions === 'function') {
            renderer.updateOptions({
              [optionKey]: newValue,
            });
          }
        });
      }

      // Force immediate update by invalidating cache if possible or just calling update
      // Using requestAnimationFrame to ensure the click event propagates first
      if (this.genomeBrowser && typeof this.genomeBrowser.updateCurrentView === 'function') {
        requestAnimationFrame(() => {
          this.genomeBrowser.updateCurrentView();
        });
      }
    });

    return btn;
  }

  genesOverlap(gene1, gene2) {
    const buffer = 10; // Reduced buffer from 50bp to 10bp for tighter packing
    return gene1.start < gene2.end + buffer && gene1.end + buffer > gene2.start;
  }

  // Create detailed ruler for current viewing region
  createDetailedRuler(chromosome) {
    const rulerContainer = document.createElement('div');
    rulerContainer.className = 'detailed-ruler-container';

    // Apply persistent visibility state
    const displayStyle = this.elementVisibilityStates && !this.elementVisibilityStates.genesRuler ? 'none' : 'block';

    rulerContainer.style.cssText = `
            position: relative;
            height: 35px;
            background: linear-gradient(to bottom, #f8f9fa, #e9ecef);
            border-bottom: 1px solid #dee2e6;
            margin-bottom: 0px;
            z-index: 10;
            overflow: visible;
            display: ${displayStyle};
        `;

    const canvas = document.createElement('canvas');
    canvas.className = 'detailed-ruler-canvas';
    canvas.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 11;
        `;

    rulerContainer.appendChild(canvas);

    // Store the initial position for this ruler instance
    rulerContainer._chromosome = chromosome;
    rulerContainer._position = {
      start: this.genomeBrowser.currentPosition.start,
      end: this.genomeBrowser.currentPosition.end,
    };

    // Setup canvas for high-DPI displays
    const setupCanvas = () => {
      const rect = rulerContainer.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      canvas.width = rect.width * dpr;
      canvas.height = 35 * dpr;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = '35px';

      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);

      // Always use current browser position for real-time updates during drag
      const currentPosition = {
        start: this.genomeBrowser.currentPosition.start,
        end: this.genomeBrowser.currentPosition.end,
      };

      // Update the stored position to match current position
      rulerContainer._position = currentPosition;

      // Draw with current position for dynamic updates
      this.drawDetailedRulerWithPosition(ctx, rect.width, chromosome, currentPosition);
    };

    // Initial setup
    setTimeout(setupCanvas, 100);

    // Redraw on window resize
    const resizeObserver = new ResizeObserver(setupCanvas);
    resizeObserver.observe(rulerContainer);

    // Store reference for updates
    rulerContainer._setupCanvas = setupCanvas;

    return rulerContainer;
  }

  // Draw the detailed ruler
  drawDetailedRuler(ctx, width, chromosome) {
    const start = this.genomeBrowser.currentPosition.start;
    const end = this.genomeBrowser.currentPosition.end;
    const position = { start, end };
    this.drawDetailedRulerWithPosition(ctx, width, chromosome, position);
  }

  // Draw the detailed ruler with specific position
  drawDetailedRulerWithPosition(ctx, width, chromosome, position) {
    const start = position.start;
    const end = position.end;
    const range = end - start;

    if (range <= 0 || width <= 0) return;

    // Get circular mode state
    const settings = this.getTrackSettings('genes');
    const isCircular = settings.circularMode || false;
    const sequence = this.genomeBrowser.currentSequence[chromosome];
    const seqLen = sequence ? sequence.length : 0;

    // Clear canvas
    ctx.clearRect(0, 0, width, 35);

    // Fill background
    const gradient = ctx.createLinearGradient(0, 0, 0, 35);
    gradient.addColorStop(0, '#f8f9fa');
    gradient.addColorStop(1, '#e9ecef');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, 35);

    // Calculate intelligent tick spacing
    const { majorInterval, minorInterval } = this.calculateDetailedTickSpacing(range, width);

    // Draw ticks and labels with reduced internal height
    ctx.strokeStyle = '#6c757d';
    ctx.fillStyle = '#495057';
    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Major ticks - track drawn X positions for spacing checks (not sequence positions)
    const firstMajorTick = Math.ceil(start / majorInterval) * majorInterval;
    const drawnXPositions = []; // Track X positions to avoid label overlap

    for (let pos = firstMajorTick; pos <= end; pos += majorInterval) {
      const x = ((pos - start) / range) * width;

      if (x >= 0 && x <= width) {
        // Draw major tick - reduced height from 22 to 16
        ctx.beginPath();
        ctx.moveTo(x, 3);
        ctx.lineTo(x, 19);
        ctx.stroke();

        // In circular mode, normalize the position for display
        let displayPos = pos;
        if (isCircular && seqLen > 0) {
          displayPos = ((pos % seqLen) + seqLen) % seqLen;
        }

        // Draw label with minimum spacing check - moved up from 32 to 28
        const label = this.formatDetailedPosition(displayPos);
        const labelWidth = ctx.measureText(label).width;

        // Check if there's enough space using X positions (works correctly in circular mode)
        let canDrawLabel = true;
        for (const prevX of drawnXPositions) {
          if (Math.abs(x - prevX) < labelWidth + 10) {
            // 10px minimum spacing
            canDrawLabel = false;
            break;
          }
        }

        if (canDrawLabel) {
          ctx.fillText(label, x, 28);
          drawnXPositions.push(x);
        }
      }
    }

    // Minor ticks (if there's enough space) - reduced height from 10 to 7
    if (width / (range / minorInterval) > 8) {
      // Only show if ticks are spaced enough
      ctx.strokeStyle = '#adb5bd';
      const firstMinorTick = Math.ceil(start / minorInterval) * minorInterval;
      for (let pos = firstMinorTick; pos <= end; pos += minorInterval) {
        // Normalize position for major interval check in circular mode
        let checkPos = pos;
        if (isCircular && seqLen > 0) {
          checkPos = ((pos % seqLen) + seqLen) % seqLen;
        }

        // Skip positions that have major ticks (using normalized position)
        if (checkPos % majorInterval !== 0) {
          const x = ((pos - start) / range) * width;

          if (x >= 0 && x <= width) {
            ctx.beginPath();
            ctx.moveTo(x, 3);
            ctx.lineTo(x, 10);
            ctx.stroke();
          }
        }
      }
    }

    // In circular mode, draw origin marker LAST (after all ticks for higher z-order)
    if (isCircular && seqLen > 0) {
      // Check if origin (position 0/seqLen) is in view
      let originInView = false;
      let originX = -1;

      if (start < 0) {
        // Viewport wraps left - origin is at position 0 in the adjusted space
        originX = ((0 - start) / range) * width;
        originInView = originX >= 0 && originX <= width;
      } else if (end > seqLen) {
        // Viewport wraps right - origin is at seqLen position
        originX = ((seqLen - start) / range) * width;
        originInView = originX >= 0 && originX <= width;
      }

      if (originInView && originX >= 0) {
        // Draw origin indicator (vertical line with label)
        ctx.save();
        ctx.strokeStyle = '#10b981'; // Green for origin
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(originX, 0);
        ctx.lineTo(originX, 35);
        ctx.stroke();

        // Draw origin label
        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('Origin', originX, 10);
        ctx.restore();
      }
    }

    // Draw border
    ctx.strokeStyle = '#dee2e6';
    ctx.beginPath();
    ctx.moveTo(0, 34.5);
    ctx.lineTo(width, 34.5);
    ctx.stroke();
  }

  // Calculate intelligent tick spacing for detailed view
  calculateDetailedTickSpacing(range, width) {
    const targetMajorTicks = Math.max(3, Math.min(8, width / 100));
    const targetMinorTicks = targetMajorTicks * 5;

    // Base intervals to choose from
    const baseIntervals = [
      1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000, 25000, 50000, 100000,
    ];

    // Find best major interval
    let majorInterval = baseIntervals[0];
    for (const interval of baseIntervals) {
      const tickCount = range / interval;
      if (tickCount <= targetMajorTicks) {
        majorInterval = interval;
        break;
      }
    }

    // Minor interval is typically 1/5 or 1/10 of major
    let minorInterval = majorInterval / 5;
    if (majorInterval % 10 === 0) {
      minorInterval = majorInterval / 10;
    } else if (majorInterval % 4 === 0) {
      minorInterval = majorInterval / 4;
    }

    return { majorInterval, minorInterval };
  }

  // Format position for detailed ruler
  formatDetailedPosition(position) {
    if (position >= 1000) {
      return Math.round(position / 1000) + 'K';
    } else {
      return position.toString();
    }
  }

  createGCLegend() {
    const legend = document.createElement('div');
    legend.className = 'gc-legend';
    legend.style.cssText = `
            position: absolute;
            top: 5px;
            right: 5px;
            background: rgba(255, 255, 255, 0.95);
            border: 1px solid #dee2e6;
            border-radius: 4px;
            padding: 6px 8px;
            font-size: 10px;
            line-height: 1.2;
            color: #495057;
            pointer-events: none;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        `;

    legend.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 2px;">
                <div style="width: 12px; height: 3px; background: #28a745; margin-right: 4px; border-radius: 1px;"></div>
                <span>GC Content</span>
            </div>
            <div style="display: flex; align-items: center;">
                <div style="width: 12px; height: 3px; background: linear-gradient(to right, #dc3545, #495057, #ffc107); margin-right: 4px; border-radius: 1px;"></div>
                <span>GC Skew</span>
            </div>
        `;

    return legend;
  }

  createWIGTrack(chromosome) {
    const { track, trackContent } = this.createTrackBase('wigTracks', chromosome);
    const viewport = this.getCurrentViewport();

    // Get WIG tracks data
    const wigTracks = this.genomeBrowser.currentWIGTracks || {};

    // Check if we have any WIG data at all
    if (!wigTracks || Object.keys(wigTracks).length === 0) {
      const noDataMsg = this.createNoDataMessage(
        'No WIG file loaded. Load a WIG file to see track data.',
        'no-wig-message'
      );
      trackContent.appendChild(noDataMsg);
      return track;
    }

    // Create WIG track management header
    const managementHeader = this.createWIGManagementHeader(wigTracks);
    trackContent.appendChild(managementHeader);

    // Create container for all WIG tracks
    const wigContainer = document.createElement('div');
    wigContainer.className = 'wig-tracks-container';
    wigContainer.style.cssText = `
            position: relative;
            width: 100%;
            height: 100%;
        `;

    let trackOffset = 0;
    // Get track settings
    const settings = this.getTrackSettings('wigTracks');
    // Use track spacing from settings or default
    const trackSpacing = settings.trackSpacing || 5;

    // Ensure stable track order exists
    if (!this.genomeBrowser.wigTrackOrder) {
      this.genomeBrowser.wigTrackOrder = Object.keys(wigTracks);
    }

    // Pre-calculate track offsets for all visible tracks to avoid race conditions in async rendering
    const visibleTrackNames = this.genomeBrowser.wigTrackOrder.filter(name => {
      const track = wigTracks[name];
      return track && !track.hidden;
    });

    const trackOffsets = {};
    let currentOffset = 0;
    visibleTrackNames.forEach(name => {
      trackOffsets[name] = currentOffset;
      const trackHeight = settings.trackHeights?.[name] || 30;
      currentOffset += trackHeight + trackSpacing;
    });

    // Render each visible WIG track using the stable pre-calculated offsets
    visibleTrackNames.forEach(async (trackName, index) => {
      const wigTrack = wigTracks[trackName];
      const trackHeight = settings.trackHeights?.[trackName] || 30;
      const trackTop = trackOffsets[trackName];

      let trackData = wigTrack.data[chromosome] || [];
      let visibleData = [];

      // Check if this is a BigWig track
      if (wigTrack.bigWigFile) {
        try {
          // Load BigWig data for the current viewport
          const { BigWig } = require('@gmod/bbi');
          const { LocalFile } = require('generic-filehandle2');

          // Initialize the BigWig file
          const file = new BigWig({
            filehandle: new LocalFile(wigTrack.bigWigFile),
          });

          // Get features for the current viewport
          visibleData = await file.getFeatures(chromosome, viewport.start, viewport.end, {
            scale: 1, // Optional: zoom level (1 = unzoomed)
          });

          // Convert BigWig features to our internal format
          visibleData = visibleData.map(feature => ({
            start: feature.start,
            end: feature.end,
            value: feature.score,
          }));
        } catch (error) {
          console.error('Error loading BigWig data:', error);
          // Create error track placeholder
          const errorTrack = document.createElement('div');
          errorTrack.className = 'wig-track-error';
          errorTrack.style.cssText = `
                        position: absolute;
                        top: ${trackTop}px;
                        left: 0;
                        right: 0;
                        height: ${trackHeight}px;
                        border: 1px solid #e0e0e0;
                        border-radius: 3px;
                        background: #fff5f5;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 11px;
                        color: #dc3545;
                    `;
          errorTrack.textContent = `${trackName}: Error loading data`;
          wigContainer.appendChild(errorTrack);
          return;
        }
      } else {
        // Regular WIG track - use pre-loaded data
        // Filter data points in current viewport
        visibleData = trackData.filter(point => point.start <= viewport.end && point.end >= viewport.start);
      }

      if (visibleData.length === 0) {
        // Create empty track placeholder
        const emptyTrack = document.createElement('div');
        emptyTrack.className = 'wig-track-empty';
        emptyTrack.style.cssText = `
                    position: absolute;
                    top: ${trackTop}px;
                    left: 0;
                    right: 0;
                    height: ${trackHeight}px;
                    border: 1px solid #e0e0e0;
                    border-radius: 3px;
                    background: #f9f9f9;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 11px;
                    color: #999;
                `;
        emptyTrack.textContent = `${trackName}: No data in this region`;
        wigContainer.appendChild(emptyTrack);
        return;
      }

      // Calculate value range for scaling
      const values = visibleData.map(point => point.value);
      const minValue = Math.min(...values);
      const maxValue = Math.max(...values);
      const valueRange = maxValue - minValue;

      // Create track element
      const trackElement = document.createElement('div');
      trackElement.className = 'wig-track-data';
      trackElement.setAttribute('data-track-name', trackName);
      trackElement.style.cssText = `
                position: absolute;
                top: ${trackTop}px;
                left: 0;
                right: 0;
                height: ${trackHeight}px;
                border: 1px solid #ccc;
                border-radius: 3px;
                background: white;
                overflow: hidden;
            `;

      // Create SVG for data visualization
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.style.cssText = `
                width: 100%;
                height: 100%;
                display: block;
            `;

      // Parse track color
      const trackColor = this.parseWIGColor(wigTrack.color);

      // Create data visualization
      if (visibleData.length > 0) {
        // Create area chart or bar chart based on data density
        const dataPointsPerPixel = visibleData.length / (trackElement.offsetWidth || 800);

        if (dataPointsPerPixel > 2) {
          // High density - use area chart
          this.createWIGAreaChart(svg, visibleData, viewport, minValue, maxValue, trackColor);
        } else {
          // Low density - use bar chart
          this.createWIGBarChart(svg, visibleData, viewport, minValue, maxValue, trackColor);
        }
      }

      // Add track label
      const label = document.createElement('div');
      label.className = 'wig-track-label';
      label.style.cssText = `
                position: absolute;
                top: 1px;
                left: 3px;
                font-size: 10px;
                font-weight: bold;
                color: #333;
                background: rgba(255,255,255,0.8);
                padding: 1px 3px;
                border-radius: 2px;
                pointer-events: none;
                z-index: 10;
            `;
      label.textContent = trackName;

      // Add value range indicator
      const rangeIndicator = document.createElement('div');
      rangeIndicator.className = 'wig-value-range';
      rangeIndicator.style.cssText = `
                position: absolute;
                top: 1px;
                right: 3px;
                font-size: 9px;
                color: #666;
                background: rgba(255,255,255,0.8);
                padding: 1px 3px;
                border-radius: 2px;
                pointer-events: none;
                z-index: 10;
            `;
      rangeIndicator.textContent = `${minValue.toFixed(2)} - ${maxValue.toFixed(2)}`;

      trackElement.appendChild(svg);
      trackElement.appendChild(label);
      trackElement.appendChild(rangeIndicator);

      // Add interaction
      this.addWIGTrackInteraction(trackElement, wigTrack, visibleData, trackName);

      wigContainer.appendChild(trackElement);
      trackOffset += trackHeight + trackSpacing;
    });

    // Update track content height based on number of visible tracks
    const visibleTracks = Object.values(wigTracks).filter(track => !track.hidden);
    const totalHeight = Math.max(100, trackOffset);
    trackContent.style.height = `${totalHeight + 40}px`; // Add space for management header

    trackContent.appendChild(wigContainer);

    // Add summary statistics
    const totalTracks = Object.keys(wigTracks).length;
    const visibleTracksCount = visibleTracks.length;
    const tracksWithData = visibleTracks.filter(
      track => track.data[chromosome] && track.data[chromosome].length > 0
    ).length;

    const statsText = `${tracksWithData}/${visibleTracksCount} visible tracks with data (${totalTracks} total)`;
    const statsElement = this.createStatsElement(statsText, 'wig-track-stats');
    trackContent.appendChild(statsElement);

    // Restore header state if it was previously hidden
    this.restoreHeaderState(track, 'wigTracks');

    return track;
  }

  /**
   * Create Actions track with SVG rendering similar to genes
   */
  createActionsTrack(chromosome) {
    const { track, trackContent } = this.createTrackBase('actions', chromosome);
    const viewport = this.getCurrentViewport();

    // Get actions from ActionManager
    const actionManager = this.genomeBrowser.actionManager;
    if (!actionManager || !actionManager.actions || actionManager.actions.length === 0) {
      const noDataMsg = this.createNoDataMessage(
        'No actions in queue. Use the Action menu to add sequence operations.',
        'no-actions-message'
      );
      trackContent.appendChild(noDataMsg);
      return track;
    }

    // Filter actions that have position information for current chromosome
    // and assign execution order numbers based on position in the full actions list
    const chromosomeActions = [];
    actionManager.actions.forEach((action, globalIndex) => {
      // Only show actions with position information
      if (!action.target || !action.details) return;

      // Parse position from target (e.g., "chr1:1000-2000" or "chr1:1000-2000(+)")
      const positionMatch = action.target.match(/([^:]+):(\d+)-(\d+)(?:\([+-]\))?/);
      if (!positionMatch) return;

      const actionChr = positionMatch[1];

      // Show all actions for current chromosome (not limited to viewport)
      if (actionChr === chromosome) {
        // Store the execution order (1-based index from full actions list)
        action._actionOrder = globalIndex + 1;
        chromosomeActions.push(action);
      }
    });

    // Separate actions into in-view and out-of-view
    const visibleActions = chromosomeActions.filter(action => {
      const positionMatch = action.target.match(/([^:]+):(\d+)-(\d+)(?:\([+-]\))?/);
      const actionStart = parseInt(positionMatch[2]);
      const actionEnd = parseInt(positionMatch[3]);

      return actionEnd >= viewport.start && actionStart <= viewport.end;
    });

    const outOfViewActions = chromosomeActions.filter(action => {
      const positionMatch = action.target.match(/([^:]+):(\d+)-(\d+)(?:\([+-]\))?/);
      const actionStart = parseInt(positionMatch[2]);
      const actionEnd = parseInt(positionMatch[3]);

      return !(actionEnd >= viewport.start && actionStart <= viewport.end);
    });

    if (chromosomeActions.length === 0) {
      // No actions for this chromosome at all
      const totalActions = actionManager.actions.length;
      const actionsWithPosition = actionManager.actions.filter(action => {
        return action.target && action.target.match(/(\w+):(\d+)-(\d+)/);
      }).length;

      let message;
      if (totalActions === 0) {
        message = 'No actions in queue. Use the Action menu to add sequence operations.';
      } else if (actionsWithPosition === 0) {
        message = `${totalActions} action(s) in queue. Open Action List to view and manage actions.`;
      } else {
        message = `No actions for chromosome ${chromosome}. ${actionsWithPosition} positioned action(s) on other chromosomes.`;
      }

      const noDataMsg = this.createNoDataMessage(message, 'no-actions-message');
      trackContent.appendChild(noDataMsg);
      return track;
    }

    // Get track settings
    const settings = this.getActionTrackSettings();

    // Create main container for all action elements
    const mainContainer = document.createElement('div');
    mainContainer.className = 'actions-track-container';
    mainContainer.style.cssText = `
            position: relative;
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 8px;
        `;

    // Handle in-view actions
    if (visibleActions.length > 0) {
      // Arrange visible actions in rows to prevent overlap
      const actionRows = this.arrangeActionsInRows(visibleActions, viewport.start, viewport.end, settings);

      // Calculate layout
      const layout = this.calculateActionTrackLayout(actionRows, settings);

      // Create container for visible actions
      const visibleContainer = document.createElement('div');
      visibleContainer.className = 'visible-actions-container';
      visibleContainer.style.cssText = `
                position: relative;
                width: 100%;
                height: ${Math.max(layout.totalHeight, 60)}px;
            `;

      // Create SVG-based action visualization for visible actions
      this.renderActionElementsSVG(visibleContainer, actionRows, viewport, layout, settings);

      mainContainer.appendChild(visibleContainer);
    }

    // Handle out-of-view actions
    if (outOfViewActions.length > 0) {
      const outOfViewContainer = this.createOutOfViewActionsSection(outOfViewActions, viewport, chromosome);
      mainContainer.appendChild(outOfViewContainer);
    }

    // Set container height and add to track
    const totalHeight = Math.max(mainContainer.scrollHeight, 80);
    trackContent.style.height = `${totalHeight}px`;
    trackContent.appendChild(mainContainer);

    // Add statistics
    let statsText;
    if (outOfViewActions.length > 0) {
      statsText = `${visibleActions.length} in view, ${outOfViewActions.length} out of view`;
    } else {
      statsText = `${visibleActions.length} actions visible`;
    }
    const statsElement = this.createStatsElement(statsText, 'actions-track-stats');
    trackContent.appendChild(statsElement);

    // Restore header state if it was previously hidden
    this.restoreHeaderState(track, 'actions');

    return track;
  }

  /**
   * Create section for out-of-view actions with navigation options
   */
  createOutOfViewActionsSection(outOfViewActions, viewport, chromosome) {
    const container = document.createElement('div');
    container.className = 'out-of-view-actions-section';
    container.style.cssText = `
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            padding: 8px 12px;
            margin-top: 4px;
        `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
            font-weight: 600;
            font-size: 12px;
            color: #495057;
            margin-bottom: 6px;
        `;
    header.textContent = `${outOfViewActions.length} action(s) outside current view:`;
    container.appendChild(header);

    // Actions list
    outOfViewActions.forEach((action, index) => {
      const actionElement = this.createOutOfViewActionItem(action, viewport, chromosome);
      container.appendChild(actionElement);
    });

    return container;
  }

  /**
   * Create individual action item for out-of-view actions
   */
  createOutOfViewActionItem(action, viewport, chromosome) {
    const positionMatch = action.target.match(/([^:]+):(\d+)-(\d+)(?:\([+-]\))?/);
    const actionStart = parseInt(positionMatch[2]);
    const actionEnd = parseInt(positionMatch[3]);
    const actionLength = actionEnd - actionStart + 1;

    const item = document.createElement('div');
    item.className = 'out-of-view-action-item';
    item.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 4px 8px;
            margin-bottom: 2px;
            background: white;
            border-radius: 3px;
            font-size: 11px;
            border-left: 3px solid ${this.getActionTypeColor(action.type)};
        `;

    // Action info
    const info = document.createElement('div');
    info.style.cssText = `
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 2px;
        `;

    const actionName = document.createElement('div');
    actionName.style.cssText = `
            font-weight: 600;
            color: #212529;
        `;
    const orderPrefix = action._actionOrder ? `${action._actionOrder}. ` : '';
    actionName.textContent = `${orderPrefix}${action.type.replace('_', ' ').toUpperCase()}`;

    const position = document.createElement('div');
    position.style.cssText = `
            color: #6c757d;
            font-size: 10px;
        `;
    position.textContent = `${actionStart.toLocaleString()}-${actionEnd.toLocaleString()} (${actionLength.toLocaleString()} bp)`;

    info.appendChild(actionName);
    info.appendChild(position);

    // Navigation button
    const navButton = document.createElement('button');
    navButton.className = 'btn btn-sm';
    navButton.style.cssText = `
            padding: 2px 6px;
            font-size: 10px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 3px;
            cursor: pointer;
            margin-left: 8px;
        `;
    navButton.textContent = 'Go to';
    navButton.title = `Navigate to ${action.target}`;

    // Add click handler for navigation
    navButton.addEventListener('click', () => {
      this.navigateToAction(action, chromosome);
    });

    item.appendChild(info);
    item.appendChild(navButton);

    return item;
  }

  /**
   * Navigate to an action's position
   */
  navigateToAction(action, chromosome) {
    const positionMatch = action.target.match(/([^:]+):(\d+)-(\d+)(?:\([+-]\))?/);
    if (!positionMatch) return;

    const actionStart = parseInt(positionMatch[2]);
    const actionEnd = parseInt(positionMatch[3]);
    const center = Math.floor((actionStart + actionEnd) / 2);

    // Calculate a reasonable view range around the action
    const actionLength = actionEnd - actionStart + 1;
    const viewRange = Math.max(actionLength * 5, 10000); // Show at least 10kb or 5x action length
    const newStart = Math.max(1, center - Math.floor(viewRange / 2));
    const newEnd = center + Math.floor(viewRange / 2);

    console.log(`🎯 Navigating to action at ${action.target}`);

    // Use genome browser's navigation functionality
    if (this.genomeBrowser && this.genomeBrowser.navigateToPosition) {
      this.genomeBrowser.navigateToPosition(chromosome, newStart, newEnd);
    } else {
      // Fallback: update position and refresh view
      this.genomeBrowser.currentPosition = { start: newStart, end: newEnd };
      const sequence = this.genomeBrowser.currentSequence[chromosome];
      if (sequence) {
        this.genomeBrowser.displayGenomeView(chromosome, sequence);
      }
    }
  }

  /**
   * Get color for action type
   */
  getActionTypeColor(actionType) {
    const colors = {
      copy_sequence: '#28a745',
      cut_sequence: '#dc3545',
      paste_sequence: '#17a2b8',
      delete_sequence: '#fd7e14',
      insert_sequence: '#6f42c1',
      replace_sequence: '#20c997',
      sequence_edit: '#6c757d',
    };
    return colors[actionType] || '#6c757d';
  }

  /**
   * Create SVG-based action visualization similar to genes
   */
  renderActionElementsSVG(trackContent, actionRows, viewport, layout, settings) {
    const containerWidth = trackContent.getBoundingClientRect().width || trackContent.offsetWidth || 800;

    // Create SVG container
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const svgContentHeight = layout.totalHeight - layout.rulerHeight;

    svg.setAttribute('width', '100%');
    svg.setAttribute('height', svgContentHeight);
    svg.setAttribute('viewBox', `0 0 ${containerWidth} ${svgContentHeight}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('class', 'actions-svg-container');
    svg.style.position = 'relative';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.pointerEvents = 'all';

    // Create definitions for gradients
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    this.createActionGradients(defs);
    svg.appendChild(defs);

    // Create action elements as SVG shapes
    actionRows.forEach((rowActions, rowIndex) => {
      if (rowIndex >= layout.maxRows) return;

      rowActions.forEach(action => {
        const actionGroup = this.createSVGActionElement(
          action,
          viewport,
          rowIndex,
          layout,
          settings,
          defs,
          containerWidth
        );
        if (actionGroup) {
          svg.appendChild(actionGroup);
        }
      });
    });

    trackContent.appendChild(svg);
  }

  /**
   * Create individual SVG action element
   */
  createSVGActionElement(action, viewport, rowIndex, layout, settings, defs, containerWidth) {
    // Parse position from target
    const positionMatch = action.target.match(/([^:]+):(\d+)-(\d+)(?:\([+-]\))?/);
    if (!positionMatch) return null;

    const actionStart = parseInt(positionMatch[2]);
    const actionEnd = parseInt(positionMatch[3]);

    // Calculate position and dimensions
    const left = ((actionStart - viewport.start) / (viewport.end - viewport.start)) * 100;
    const width = ((actionEnd - actionStart) / (viewport.end - viewport.start)) * 100;

    if (width <= 0) return null;

    // Get positioning parameters
    const y = layout.topPadding + rowIndex * (layout.actionHeight + layout.rowSpacing);
    const x = (left / 100) * containerWidth;
    const elementWidth = Math.max((width / 100) * containerWidth, 8);
    const elementHeight = layout.actionHeight;

    // Create SVG group for the action
    const actionGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    actionGroup.setAttribute('class', `svg-action-element ${action.type.toLowerCase().replace('_', '-')}`);
    actionGroup.setAttribute('transform', `translate(${x}, ${y})`);

    // Get action color based on type and status
    const actionColor = this.getActionColor(action);

    // Create gradient for action background
    const gradientId = `action-gradient-${action.id}`;
    const gradient = this.createSVGActionGradient(defs, gradientId, actionColor);

    // Create action layout with separate symbol and text areas
    if (elementWidth > 30) {
      // Calculate layout dimensions
      const symbolWidth = Math.min(elementHeight, 20); // Square symbol area
      const textWidth = elementWidth - symbolWidth - 2; // Remaining space for text with 2px gap

      // Create background rectangle
      const backgroundRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      backgroundRect.setAttribute('x', '0');
      backgroundRect.setAttribute('y', '0');
      backgroundRect.setAttribute('width', elementWidth);
      backgroundRect.setAttribute('height', elementHeight);
      backgroundRect.setAttribute('rx', '3');
      backgroundRect.setAttribute('ry', '3');
      backgroundRect.setAttribute('fill', `url(#${gradientId})`);
      backgroundRect.setAttribute('stroke', this.getActionColor(action));
      backgroundRect.setAttribute('stroke-width', '1');
      backgroundRect.setAttribute('class', `action-${action.type.toLowerCase().replace('_', '-')}`);

      // Add status-based styling to background
      if (action.status === 'executing') {
        backgroundRect.setAttribute('stroke-width', '2');
        backgroundRect.setAttribute('stroke-dasharray', '3,3');
      } else if (action.status === 'completed') {
        backgroundRect.setAttribute('opacity', '0.7');
      } else if (action.status === 'failed') {
        backgroundRect.setAttribute('stroke', '#ef4444');
        backgroundRect.setAttribute('stroke-width', '2');
      }

      actionGroup.appendChild(backgroundRect);

      // Create symbol in left area
      if (symbolWidth >= 12) {
        const symbolGroup = this.createActionSymbol(action.type, symbolWidth, elementHeight);
        if (symbolGroup) {
          actionGroup.appendChild(symbolGroup);
        }
      }

      // Create text in right area
      if (textWidth > 20) {
        const actionText = this.createSVGActionText(action, textWidth, elementHeight, settings, symbolWidth + 2);
        if (actionText) {
          actionGroup.appendChild(actionText);
        }
      }
    } else {
      // For narrow elements, use the original single shape approach
      const actionShape = this.createSVGActionShape(action, elementWidth, elementHeight, gradientId);
      actionGroup.appendChild(actionShape);
    }

    // Add interaction handlers
    this.addSVGActionInteraction(actionGroup, action, rowIndex);

    return actionGroup;
  }

  /**
   * Create action gradients for different action types
   */
  createActionGradients(defs) {
    const gradients = [
      { id: 'copy-gradient', color: '#3b82f6' },
      { id: 'cut-gradient', color: '#ef4444' },
      { id: 'paste-gradient', color: '#10b981' },
      { id: 'delete-gradient', color: '#f59e0b' },
      { id: 'insert-gradient', color: '#8b5cf6' },
      { id: 'replace-gradient', color: '#06b6d4' },
      { id: 'default-gradient', color: '#6b7280' },
    ];

    gradients.forEach(({ id, color }) => {
      const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
      gradient.setAttribute('id', id);
      gradient.setAttribute('x1', '0%');
      gradient.setAttribute('y1', '0%');
      gradient.setAttribute('x2', '0%');
      gradient.setAttribute('y2', '100%');

      const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stop1.setAttribute('offset', '0%');
      stop1.setAttribute('stop-color', this.lightenColor(color, 20));

      const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stop2.setAttribute('offset', '100%');
      stop2.setAttribute('stop-color', color);

      gradient.appendChild(stop1);
      gradient.appendChild(stop2);
      defs.appendChild(gradient);
    });
  }

  /**
   * Create gradient for specific action
   */
  createSVGActionGradient(defs, gradientId, baseColor) {
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gradient.setAttribute('id', gradientId);
    gradient.setAttribute('x1', '0%');
    gradient.setAttribute('y1', '0%');
    gradient.setAttribute('x2', '0%');
    gradient.setAttribute('y2', '100%');

    const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', this.lightenColor(baseColor, 20));

    const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', baseColor);

    gradient.appendChild(stop1);
    gradient.appendChild(stop2);
    defs.appendChild(gradient);

    return gradient;
  }

  /**
   * Create action shape based on action type - now uses rectangles for all with symbols
   */
  createSVGActionShape(action, width, height, gradientId) {
    // Create container group for rectangle and symbol
    const shapeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    shapeGroup.setAttribute('class', `action-shape-${action.type.toLowerCase().replace('_', '-')}`);

    // Create rectangle base for all action types
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', '0');
    rect.setAttribute('y', '0');
    rect.setAttribute('width', width);
    rect.setAttribute('height', height);
    rect.setAttribute('rx', '3'); // Rounded corners
    rect.setAttribute('ry', '3');
    rect.setAttribute('fill', `url(#${gradientId})`);
    rect.setAttribute('stroke', this.getActionColor(action));
    rect.setAttribute('stroke-width', '1');
    rect.setAttribute('class', `action-${action.type.toLowerCase().replace('_', '-')}`);

    // Add status-based styling
    if (action.status === 'executing') {
      rect.setAttribute('stroke-width', '2');
      rect.setAttribute('stroke-dasharray', '3,3');
    } else if (action.status === 'completed') {
      rect.setAttribute('opacity', '0.7');
    } else if (action.status === 'failed') {
      rect.setAttribute('stroke', '#ef4444');
      rect.setAttribute('stroke-width', '2');
    }

    shapeGroup.appendChild(rect);

    // Add action type symbol if there's enough space
    if (width >= 16 && height >= 12) {
      const symbol = this.createActionSymbol(action.type, width, height);
      if (symbol) {
        shapeGroup.appendChild(symbol);
      }
    }

    return shapeGroup;
  }

  /**
   * Create symbol for specific action type
   */
  createActionSymbol(actionType, containerWidth, containerHeight) {
    const symbolGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    symbolGroup.setAttribute('class', 'action-symbol');

    // Calculate symbol size and position
    const symbolSize = Math.min(containerWidth * 0.6, containerHeight * 0.6, 12);
    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2;

    let symbolPath;

    switch (actionType) {
      case 'copy_sequence':
        // Duplicate/copy symbol - two overlapping rectangles
        const rect1 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect1.setAttribute('x', centerX - symbolSize / 2 + 1);
        rect1.setAttribute('y', centerY - symbolSize / 2 + 1);
        rect1.setAttribute('width', symbolSize * 0.7);
        rect1.setAttribute('height', symbolSize * 0.7);
        rect1.setAttribute('fill', 'none');
        rect1.setAttribute('stroke', '#ffffff');
        rect1.setAttribute('stroke-width', '1.5');
        rect1.setAttribute('rx', '1');

        const rect2 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect2.setAttribute('x', centerX - symbolSize / 2 - 1);
        rect2.setAttribute('y', centerY - symbolSize / 2 - 1);
        rect2.setAttribute('width', symbolSize * 0.7);
        rect2.setAttribute('height', symbolSize * 0.7);
        rect2.setAttribute('fill', 'none');
        rect2.setAttribute('stroke', '#ffffff');
        rect2.setAttribute('stroke-width', '1.5');
        rect2.setAttribute('rx', '1');

        symbolGroup.appendChild(rect2);
        symbolGroup.appendChild(rect1);
        break;

      case 'cut_sequence':
        // Vertical scissors symbol with heads pointing up
        const leftBlade = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const leftBladePath = `
                    M ${centerX - symbolSize / 6} ${centerY - symbolSize / 3}
                    L ${centerX - symbolSize / 12} ${centerY - symbolSize / 6}
                    L ${centerX - symbolSize / 4} ${centerY - symbolSize / 4}
                `;
        leftBlade.setAttribute('d', leftBladePath);
        leftBlade.setAttribute('stroke', '#ffffff');
        leftBlade.setAttribute('stroke-width', '1.5');
        leftBlade.setAttribute('fill', 'none');
        leftBlade.setAttribute('stroke-linecap', 'round');
        leftBlade.setAttribute('stroke-linejoin', 'round');

        const rightBlade = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const rightBladePath = `
                    M ${centerX + symbolSize / 6} ${centerY - symbolSize / 3}
                    L ${centerX + symbolSize / 12} ${centerY - symbolSize / 6}
                    L ${centerX + symbolSize / 4} ${centerY - symbolSize / 4}
                `;
        rightBlade.setAttribute('d', rightBladePath);
        rightBlade.setAttribute('stroke', '#ffffff');
        rightBlade.setAttribute('stroke-width', '1.5');
        rightBlade.setAttribute('fill', 'none');
        rightBlade.setAttribute('stroke-linecap', 'round');
        rightBlade.setAttribute('stroke-linejoin', 'round');

        // Vertical handles (finger grips)
        const leftHandle = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
        leftHandle.setAttribute('cx', centerX - symbolSize / 6);
        leftHandle.setAttribute('cy', centerY + symbolSize / 4);
        leftHandle.setAttribute('rx', '1.5');
        leftHandle.setAttribute('ry', '2.5');
        leftHandle.setAttribute('fill', 'none');
        leftHandle.setAttribute('stroke', '#ffffff');
        leftHandle.setAttribute('stroke-width', '1');

        const rightHandle = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
        rightHandle.setAttribute('cx', centerX + symbolSize / 6);
        rightHandle.setAttribute('cy', centerY + symbolSize / 4);
        rightHandle.setAttribute('rx', '1.5');
        rightHandle.setAttribute('ry', '2.5');
        rightHandle.setAttribute('fill', 'none');
        rightHandle.setAttribute('stroke', '#ffffff');
        rightHandle.setAttribute('stroke-width', '1');

        // Connecting arms from blades to handles
        const leftArm = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        leftArm.setAttribute('x1', centerX - symbolSize / 12);
        leftArm.setAttribute('y1', centerY - symbolSize / 6);
        leftArm.setAttribute('x2', centerX - symbolSize / 6);
        leftArm.setAttribute('y2', centerY + symbolSize / 6);
        leftArm.setAttribute('stroke', '#ffffff');
        leftArm.setAttribute('stroke-width', '1.5');
        leftArm.setAttribute('stroke-linecap', 'round');

        const rightArm = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        rightArm.setAttribute('x1', centerX + symbolSize / 12);
        rightArm.setAttribute('y1', centerY - symbolSize / 6);
        rightArm.setAttribute('x2', centerX + symbolSize / 6);
        rightArm.setAttribute('y2', centerY + symbolSize / 6);
        rightArm.setAttribute('stroke', '#ffffff');
        rightArm.setAttribute('stroke-width', '1.5');
        rightArm.setAttribute('stroke-linecap', 'round');

        // Central pivot point
        const pivot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        pivot.setAttribute('cx', centerX);
        pivot.setAttribute('cy', centerY);
        pivot.setAttribute('r', '1');
        pivot.setAttribute('fill', '#ffffff');

        symbolGroup.appendChild(leftBlade);
        symbolGroup.appendChild(rightBlade);
        symbolGroup.appendChild(leftArm);
        symbolGroup.appendChild(rightArm);
        symbolGroup.appendChild(leftHandle);
        symbolGroup.appendChild(rightHandle);
        symbolGroup.appendChild(pivot);
        break;

      case 'paste_sequence':
        // Clipboard symbol
        const clipboardBase = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        clipboardBase.setAttribute('x', centerX - symbolSize / 3);
        clipboardBase.setAttribute('y', centerY - symbolSize / 2);
        clipboardBase.setAttribute('width', symbolSize * 0.6);
        clipboardBase.setAttribute('height', symbolSize * 0.8);
        clipboardBase.setAttribute('fill', 'none');
        clipboardBase.setAttribute('stroke', '#ffffff');
        clipboardBase.setAttribute('stroke-width', '1.5');
        clipboardBase.setAttribute('rx', '1');

        const clipboardTop = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        clipboardTop.setAttribute('x', centerX - symbolSize / 6);
        clipboardTop.setAttribute('y', centerY - symbolSize / 2 - 1);
        clipboardTop.setAttribute('width', symbolSize * 0.3);
        clipboardTop.setAttribute('height', '3');
        clipboardTop.setAttribute('fill', '#ffffff');
        clipboardTop.setAttribute('rx', '1');

        symbolGroup.appendChild(clipboardBase);
        symbolGroup.appendChild(clipboardTop);
        break;

      case 'delete_sequence':
        // Enhanced trash/delete symbol with better proportions
        const trashBase = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        trashBase.setAttribute('x', centerX - symbolSize / 3);
        trashBase.setAttribute('y', centerY - symbolSize / 6);
        trashBase.setAttribute('width', symbolSize * 0.65);
        trashBase.setAttribute('height', symbolSize * 0.5);
        trashBase.setAttribute('fill', 'none');
        trashBase.setAttribute('stroke', '#ffffff');
        trashBase.setAttribute('stroke-width', '1.5');
        trashBase.setAttribute('rx', '1');

        // Lid of trash can
        const trashLid = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        trashLid.setAttribute('x1', centerX - symbolSize / 2.5);
        trashLid.setAttribute('y1', centerY - symbolSize / 6);
        trashLid.setAttribute('x2', centerX + symbolSize / 2.5);
        trashLid.setAttribute('y2', centerY - symbolSize / 6);
        trashLid.setAttribute('stroke', '#ffffff');
        trashLid.setAttribute('stroke-width', '2');
        trashLid.setAttribute('stroke-linecap', 'round');

        // Handle of trash can
        const trashHandle = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        trashHandle.setAttribute('x', centerX - symbolSize / 8);
        trashHandle.setAttribute('y', centerY - symbolSize / 3);
        trashHandle.setAttribute('width', symbolSize / 4);
        trashHandle.setAttribute('height', '2');
        trashHandle.setAttribute('fill', 'none');
        trashHandle.setAttribute('stroke', '#ffffff');
        trashHandle.setAttribute('stroke-width', '1.5');
        trashHandle.setAttribute('rx', '1');

        // Vertical lines inside trash can
        const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line1.setAttribute('x1', centerX - symbolSize / 6);
        line1.setAttribute('y1', centerY - symbolSize / 12);
        line1.setAttribute('x2', centerX - symbolSize / 6);
        line1.setAttribute('y2', centerY + symbolSize / 6);
        line1.setAttribute('stroke', '#ffffff');
        line1.setAttribute('stroke-width', '1');
        line1.setAttribute('stroke-linecap', 'round');

        const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line2.setAttribute('x1', centerX);
        line2.setAttribute('y1', centerY - symbolSize / 12);
        line2.setAttribute('x2', centerX);
        line2.setAttribute('y2', centerY + symbolSize / 6);
        line2.setAttribute('stroke', '#ffffff');
        line2.setAttribute('stroke-width', '1');
        line2.setAttribute('stroke-linecap', 'round');

        const line3 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line3.setAttribute('x1', centerX + symbolSize / 6);
        line3.setAttribute('y1', centerY - symbolSize / 12);
        line3.setAttribute('x2', centerX + symbolSize / 6);
        line3.setAttribute('y2', centerY + symbolSize / 6);
        line3.setAttribute('stroke', '#ffffff');
        line3.setAttribute('stroke-width', '1');
        line3.setAttribute('stroke-linecap', 'round');

        symbolGroup.appendChild(trashBase);
        symbolGroup.appendChild(trashLid);
        symbolGroup.appendChild(trashHandle);
        symbolGroup.appendChild(line1);
        symbolGroup.appendChild(line2);
        symbolGroup.appendChild(line3);
        break;

      case 'insert_sequence':
        // Plus/insert symbol
        const plusH = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        plusH.setAttribute('x1', centerX - symbolSize / 3);
        plusH.setAttribute('y1', centerY);
        plusH.setAttribute('x2', centerX + symbolSize / 3);
        plusH.setAttribute('y2', centerY);
        plusH.setAttribute('stroke', '#ffffff');
        plusH.setAttribute('stroke-width', '2');
        plusH.setAttribute('stroke-linecap', 'round');

        const plusV = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        plusV.setAttribute('x1', centerX);
        plusV.setAttribute('y1', centerY - symbolSize / 3);
        plusV.setAttribute('x2', centerX);
        plusV.setAttribute('y2', centerY + symbolSize / 3);
        plusV.setAttribute('stroke', '#ffffff');
        plusV.setAttribute('stroke-width', '2');
        plusV.setAttribute('stroke-linecap', 'round');

        symbolGroup.appendChild(plusH);
        symbolGroup.appendChild(plusV);
        break;

      case 'replace_sequence':
        // Refresh/replace symbol
        symbolPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const replacePath = `
                    M ${centerX - symbolSize / 3} ${centerY}
                    A ${symbolSize / 3} ${symbolSize / 3} 0 1 1 ${centerX + symbolSize / 3} ${centerY}
                    M ${centerX + symbolSize / 4} ${centerY - symbolSize / 6}
                    L ${centerX + symbolSize / 3} ${centerY}
                    L ${centerX + symbolSize / 4} ${centerY + symbolSize / 6}
                `;
        symbolPath.setAttribute('d', replacePath);
        symbolPath.setAttribute('stroke', '#ffffff');
        symbolPath.setAttribute('stroke-width', '1.5');
        symbolPath.setAttribute('fill', 'none');
        symbolPath.setAttribute('stroke-linecap', 'round');
        symbolGroup.appendChild(symbolPath);
        break;

      default:
        // Default: simple dot
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', centerX);
        circle.setAttribute('cy', centerY);
        circle.setAttribute('r', symbolSize / 4);
        circle.setAttribute('fill', '#ffffff');
        symbolGroup.appendChild(circle);
        break;
    }

    return symbolGroup;
  }

  /**
   * Create action text label
   */
  createSVGActionText(action, width, height, settings, xOffset = 0) {
    const actionName = this.getActionDisplayName(action);
    const baseFontSize = settings?.fontSize || 10;
    const fontSize = Math.max(8, Math.min(baseFontSize, height * 0.6));

    // Smart text truncation
    let displayText = actionName;
    const estimatedCharWidth = fontSize * 0.6;
    const maxChars = Math.floor(width / estimatedCharWidth);

    if (actionName.length > maxChars && maxChars > 3) {
      displayText = actionName.substring(0, maxChars - 3) + '...';
    }

    const textGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    textGroup.setAttribute('class', 'svg-action-text-protected');

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');

    // Position text based on whether there's an offset (separate symbol area)
    if (xOffset > 0) {
      // Text area starts at xOffset, use left alignment with some padding
      text.setAttribute('x', xOffset + 4);
      text.setAttribute('text-anchor', 'start');
    } else {
      // Center text in the full width
      text.setAttribute('x', width / 2);
      text.setAttribute('text-anchor', 'middle');
    }

    text.setAttribute('y', height / 2);
    text.setAttribute('dominant-baseline', 'central');
    text.setAttribute('font-size', `${fontSize}px`);
    text.setAttribute('font-family', 'Arial, sans-serif');
    text.setAttribute('font-weight', '500');
    text.setAttribute('fill', '#ffffff');
    text.setAttribute('pointer-events', 'none');
    text.style.vectorEffect = 'non-scaling-stroke';
    text.textContent = displayText;

    textGroup.appendChild(text);
    return textGroup;
  }

  /**
   * Add interaction handlers to action elements
   */
  addSVGActionInteraction(actionGroup, action, rowIndex) {
    // Add data attributes for easier access
    actionGroup.setAttribute('data-action-id', action.id);
    actionGroup.setAttribute('data-action-type', action.type);
    actionGroup.setAttribute('data-action-status', action.status);

    // Create tooltip
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = this.getActionTooltip(action);
    actionGroup.appendChild(title);

    // Add hover effects
    actionGroup.style.cursor = 'pointer';
    actionGroup.addEventListener('mouseenter', () => {
      actionGroup.style.opacity = '0.8';
    });
    actionGroup.addEventListener('mouseleave', () => {
      actionGroup.style.opacity = '1';
    });

    // Add click handler
    actionGroup.addEventListener('click', e => {
      e.stopPropagation();
      this.showActionDetails(action);
    });
  }

  /**
   * Get action color based on type and status
   */
  getActionColor(action) {
    const statusColors = {
      pending: '#6b7280',
      executing: '#3b82f6',
      completed: '#10b981',
      failed: '#ef4444',
    };

    const typeColors = {
      copy_sequence: '#3b82f6',
      cut_sequence: '#ef4444',
      paste_sequence: '#10b981',
      delete_sequence: '#f59e0b',
      insert_sequence: '#8b5cf6',
      replace_sequence: '#06b6d4',
    };

    // Use status color if status is not pending, otherwise use type color
    if (action.status !== 'pending') {
      return statusColors[action.status] || statusColors['pending'];
    }

    return typeColors[action.type] || typeColors['copy_sequence'];
  }

  /**
   * Get display name for action
   */
  getActionDisplayName(action) {
    const typeNames = {
      copy_sequence: 'Copy',
      cut_sequence: 'Cut',
      paste_sequence: 'Paste',
      delete_sequence: 'Delete',
      insert_sequence: 'Insert',
      replace_sequence: 'Replace',
    };

    const baseName = typeNames[action.type] || action.type;
    // Prefix with execution order number if available
    if (action._actionOrder) {
      return `${action._actionOrder}. ${baseName}`;
    }
    return baseName;
  }

  /**
   * Get tooltip text for action
   */
  getActionTooltip(action) {
    const typeName = this.getActionDisplayName(action);
    const statusText = action.status.charAt(0).toUpperCase() + action.status.slice(1);
    const orderText = action._actionOrder ? `Execution Order: #${action._actionOrder}\n` : '';

    return `${typeName} Action (${statusText})
${orderText}Target: ${action.target}
Details: ${action.details}
Created: ${new Date(action.timestamp).toLocaleString()}`;
  }

  /**
   * Show action details in modal
   */
  showActionDetails(action) {
    // Use existing action list modal or create a simple alert
    if (this.genomeBrowser.actionManager && this.genomeBrowser.actionManager.showActionList) {
      this.genomeBrowser.actionManager.showActionList();
    } else {
      alert(this.getActionTooltip(action));
    }
  }

  /**
   * Arrange actions in rows to prevent overlap
   */
  arrangeActionsInRows(actions, viewStart, viewEnd, settings) {
    const rows = [];

    // Sort actions by start position
    const sortedActions = [...actions].sort((a, b) => {
      const aMatch = a.target.match(/([^:]+):(\d+)-(\d+)(?:\([+-]\))?/);
      const bMatch = b.target.match(/([^:]+):(\d+)-(\d+)(?:\([+-]\))?/);
      if (!aMatch || !bMatch) return 0;
      return parseInt(aMatch[2]) - parseInt(bMatch[2]);
    });

    // Place actions in rows
    sortedActions.forEach(action => {
      const positionMatch = action.target.match(/([^:]+):(\d+)-(\d+)(?:\([+-]\))?/);
      if (!positionMatch) return;

      const actionStart = parseInt(positionMatch[2]);
      const actionEnd = parseInt(positionMatch[3]);

      // Find first row where action fits
      let placed = false;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const canPlace = row.every(existingAction => {
          const existingMatch = existingAction.target.match(/(\w+):(\d+)-(\d+)/);
          if (!existingMatch) return true;

          const existingStart = parseInt(existingMatch[2]);
          const existingEnd = parseInt(existingMatch[3]);

          // Check if they don't overlap
          return actionEnd < existingStart || actionStart > existingEnd;
        });

        if (canPlace) {
          row.push(action);
          placed = true;
          break;
        }
      }

      // If not placed, create new row
      if (!placed) {
        rows.push([action]);
      }
    });

    return rows;
  }

  /**
   * Calculate action track layout
   */
  calculateActionTrackLayout(actionRows, settings) {
    const actionHeight = settings?.actionHeight || 10;
    const rowSpacing = settings?.rowSpacing || 2;
    const topPadding = settings?.topPadding || 5;
    const bottomPadding = settings?.bottomPadding || 5;
    const rulerHeight = settings?.rulerHeight || 20;
    const maxRows = settings?.maxRows || 10;

    const visibleRows = Math.min(actionRows.length, maxRows);
    const contentHeight = visibleRows * actionHeight + (visibleRows - 1) * rowSpacing;
    const totalHeight = topPadding + contentHeight + bottomPadding + rulerHeight;

    return {
      actionHeight,
      rowSpacing,
      topPadding,
      bottomPadding,
      rulerHeight,
      maxRows,
      visibleRows,
      contentHeight,
      totalHeight,
    };
  }

  /**
   * Update actions track in real-time when actions change
   */
  updateActionsTrack() {
    const currentChromosome = this.genomeBrowser.currentChromosome;
    if (!currentChromosome) {
      console.warn('No current chromosome, cannot update actions track');
      return;
    }

    // Find the existing actions track
    const existingActionsTrack = document.querySelector('.actions-track');
    if (!existingActionsTrack) {
      // Actions track not yet created - this is normal during initial load
      console.log('[TrackRenderer] Actions track not yet in DOM, will be created on next render');
      return;
    }

    // Create new actions track
    const newActionsTrack = this.createActionsTrack(currentChromosome);

    // Replace the existing track with the new one
    existingActionsTrack.parentNode.replaceChild(newActionsTrack, existingActionsTrack);

    // Make the new track draggable and resizable
    this.genomeBrowser.makeTrackDraggable(newActionsTrack, 'actions');
    this.genomeBrowser.addTrackResizeHandle(newActionsTrack, 'actions');

    console.log('✅ Actions track updated successfully');
  }

  /**
   * Get action track settings
   */
  getActionTrackSettings() {
    return this.getTrackSettings('actions');
  }

  createWIGAreaChart(svg, data, viewport, minValue, maxValue, color) {
    // Get the actual height from the SVG's parent element or use default
    const parentHeight = svg.parentElement ? svg.parentElement.clientHeight : 30;
    const svgWidth = 800; // Default width, will be scaled by CSS
    const svgHeight = parentHeight;
    const padding = 2;

    svg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
    svg.setAttribute('preserveAspectRatio', 'none');

    // Create area path
    let pathData = `M 0,${svgHeight - padding}`;

    data.forEach((point, index) => {
      const x = ((point.start - viewport.start) / (viewport.end - viewport.start)) * svgWidth;
      const normalizedValue = (point.value - minValue) / (maxValue - minValue);
      const y = svgHeight - padding - normalizedValue * (svgHeight - 2 * padding);

      if (index === 0) {
        pathData += ` L ${x},${y}`;
      } else {
        pathData += ` L ${x},${y}`;
      }
    });

    pathData += ` L ${svgWidth},${svgHeight - padding} Z`;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('fill', color);
    path.setAttribute('fill-opacity', '0.6');
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', '0.5');

    svg.appendChild(path);
  }

  createWIGBarChart(svg, data, viewport, minValue, maxValue, color) {
    // Get the actual height from the SVG's parent element or use default
    const parentHeight = svg.parentElement ? svg.parentElement.clientHeight : 30;
    const svgWidth = 800;
    const svgHeight = parentHeight;
    const padding = 2;

    svg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
    svg.setAttribute('preserveAspectRatio', 'none');

    data.forEach(point => {
      const x = ((point.start - viewport.start) / (viewport.end - viewport.start)) * svgWidth;
      const width = Math.max(1, ((point.end - point.start) / (viewport.end - viewport.start)) * svgWidth);
      const normalizedValue = (point.value - minValue) / (maxValue - minValue);
      const height = normalizedValue * (svgHeight - 2 * padding);
      const y = svgHeight - padding - height;

      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', x);
      rect.setAttribute('y', y);
      rect.setAttribute('width', width);
      rect.setAttribute('height', height);
      rect.setAttribute('fill', color);
      rect.setAttribute('stroke', 'none');

      svg.appendChild(rect);
    });
  }

  parseWIGColor(colorString) {
    // Parse WIG color format (R,G,B) to CSS color
    if (!colorString || colorString === '0,0,0') {
      return '#2196F3'; // Default blue
    }

    const parts = colorString.split(',');
    if (parts.length === 3) {
      const r = parseInt(parts[0]) || 0;
      const g = parseInt(parts[1]) || 0;
      const b = parseInt(parts[2]) || 0;
      return `rgb(${r},${g},${b})`;
    }

    return '#2196F3'; // Fallback to blue
  }

  addWIGTrackInteraction(trackElement, wigTrack, visibleData, trackName) {
    // Add tooltip on hover
    trackElement.addEventListener('mouseover', e => {
      const rect = trackElement.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const relativeX = x / rect.width;

      const viewport = this.getCurrentViewport();
      const genomicPosition = viewport.start + relativeX * (viewport.end - viewport.start);

      // Find closest data point
      const closestPoint = visibleData.reduce((closest, point) => {
        const pointCenter = (point.start + point.end) / 2;
        const currentDistance = Math.abs(genomicPosition - pointCenter);
        const closestDistance = Math.abs(genomicPosition - (closest.start + closest.end) / 2);
        return currentDistance < closestDistance ? point : closest;
      });

      if (closestPoint) {
        const tooltip = document.createElement('div');
        tooltip.className = 'wig-tooltip';
        tooltip.style.cssText = `
                    position: fixed;
                    background: rgba(0,0,0,0.8);
                    color: white;
                    padding: 5px 8px;
                    border-radius: 4px;
                    font-size: 11px;
                    pointer-events: none;
                    z-index: 1000;
                    white-space: nowrap;
                `;
        tooltip.innerHTML = `
                    <div><strong>${trackName}</strong></div>
                    <div>Position: ${closestPoint.start.toLocaleString()}-${closestPoint.end.toLocaleString()}</div>
                    <div>Value: ${closestPoint.value.toFixed(3)}</div>
                `;
        tooltip.style.left = `${e.clientX + 10}px`;
        tooltip.style.top = `${e.clientY - 10}px`;

        document.body.appendChild(tooltip);

        trackElement._tooltip = tooltip;
      }
    });

    trackElement.addEventListener('mousemove', e => {
      if (trackElement._tooltip) {
        trackElement._tooltip.style.left = `${e.clientX + 10}px`;
        trackElement._tooltip.style.top = `${e.clientY - 10}px`;
      }
    });

    trackElement.addEventListener('mouseleave', () => {
      if (trackElement._tooltip) {
        document.body.removeChild(trackElement._tooltip);
        trackElement._tooltip = null;
      }
    });
  }

  createWIGManagementHeader(wigTracks) {
    const header = document.createElement('div');
    header.className = 'wig-management-header';

    // Apply persistent visibility state
    const displayStyle = this.elementVisibilityStates && !this.elementVisibilityStates.wigManagement ? 'none' : 'block';

    header.style.cssText = `
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            padding: 8px;
            margin-bottom: 10px;
            font-size: 12px;
            display: ${displayStyle};
        `;

    const title = document.createElement('div');
    title.style.cssText = `
            font-weight: bold;
            margin-bottom: 8px;
            color: #495057;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
    title.innerHTML = `
            <span><i class="fas fa-chart-line"></i> WIG Track Management</span>
            <button class="clear-all-wig-btn" style="
                background: #dc3545;
                color: white;
                border: none;
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 10px;
                cursor: pointer;
            " title="Remove all WIG tracks">
                <i class="fas fa-trash"></i> Clear All
            </button>
        `;

    const tracksList = document.createElement('div');
    tracksList.className = 'wig-tracks-list';
    tracksList.style.cssText = `
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        `;

    // Ensure stable track order exists
    if (!this.genomeBrowser.wigTrackOrder) {
      this.genomeBrowser.wigTrackOrder = Object.keys(wigTracks);
    }

    this.genomeBrowser.wigTrackOrder.forEach(trackName => {
      const wigTrack = wigTracks[trackName];
      if (!wigTrack) return;

      const trackItem = document.createElement('div');
      trackItem.className = 'wig-track-item';
      trackItem.setAttribute('draggable', 'true');
      trackItem.setAttribute('data-track-name', trackName);
      trackItem.style.cssText = `
                display: flex;
                align-items: center;
                background: white;
                border: 1px solid #ced4da;
                border-radius: 3px;
                padding: 3px 6px;
                font-size: 11px;
                cursor: grab;
                user-select: none;
                z-index: 100;
                ${wigTrack.hidden ? 'opacity: 0.5;' : ''}
            `;

      // Prevent mousedown from bubbling to genome browser zoom/pan
      trackItem.addEventListener('mousedown', e => {
        e.stopPropagation();
      });

      // Add a drag handle icon
      const dragHandle = document.createElement('span');
      dragHandle.className = 'drag-handle';
      dragHandle.innerHTML = '<i class="fas fa-grip-vertical"></i>';
      dragHandle.style.cssText = `
                margin-right: 6px;
                color: #adb5bd;
                cursor: grab;
                flex-shrink: 0;
            `;
      trackItem.appendChild(dragHandle);

      const colorDot = document.createElement('div');
      colorDot.style.cssText = `
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: ${this.parseWIGColor(wigTrack.color)};
                margin-right: 4px;
                flex-shrink: 0;
            `;

      const trackNameSpan = document.createElement('span');
      trackNameSpan.textContent = trackName;
      trackNameSpan.style.cssText = `
                margin-right: 6px;
                max-width: 120px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            `;
      trackNameSpan.title = trackName; // Full name on hover

      const toggleBtn = document.createElement('button');
      toggleBtn.innerHTML = wigTrack.hidden ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
      toggleBtn.style.cssText = `
                background: none;
                border: none;
                color: #6c757d;
                cursor: pointer;
                padding: 1px 3px;
                margin-right: 3px;
                font-size: 10px;
            `;
      toggleBtn.title = wigTrack.hidden ? 'Show track' : 'Hide track';
      toggleBtn.addEventListener('click', () => this.toggleWIGTrack(trackName));

      const removeBtn = document.createElement('button');
      removeBtn.innerHTML = '<i class="fas fa-times"></i>';
      removeBtn.style.cssText = `
                background: none;
                border: none;
                color: #dc3545;
                cursor: pointer;
                padding: 1px 3px;
                font-size: 10px;
            `;
      removeBtn.title = 'Remove track';
      removeBtn.addEventListener('click', () => this.removeWIGTrack(trackName));

      trackItem.appendChild(colorDot);
      trackItem.appendChild(trackNameSpan);
      trackItem.appendChild(toggleBtn);
      trackItem.appendChild(removeBtn);

      // Add drag and drop events
      trackItem.addEventListener('dragstart', e => this.handleWIGTrackDragStart(e));
      trackItem.addEventListener('dragenter', e => this.handleWIGTrackDragEnter(e));
      trackItem.addEventListener('dragover', e => this.handleWIGTrackDragOver(e));
      trackItem.addEventListener('dragleave', e => this.handleWIGTrackDragLeave(e));
      trackItem.addEventListener('drop', e => this.handleWIGTrackDrop(e));
      trackItem.addEventListener('dragend', e => this.handleWIGTrackDragEnd(e));

      tracksList.appendChild(trackItem);
    });

    // Add clear all functionality
    const clearAllBtn = title.querySelector('.clear-all-wig-btn');
    clearAllBtn.addEventListener('click', () => this.clearAllWIGTracks());

    header.appendChild(title);
    header.appendChild(tracksList);

    return header;
  }

  toggleWIGTrack(trackName) {
    const wigTracks = this.genomeBrowser.currentWIGTracks;
    if (wigTracks && wigTracks[trackName]) {
      wigTracks[trackName].hidden = !wigTracks[trackName].hidden;
      this.genomeBrowser.updateStatus(`${wigTracks[trackName].hidden ? 'Hidden' : 'Shown'} WIG track: ${trackName}`);
      this.refreshCurrentView();
    }
  }

  /**
   * Toggle the visibility of the BLAST Results track
   * @param {boolean} visible - Whether to show or hide the track
   */
  toggleBlastTrack(visible) {
    // Check if blast results exist
    if (!this.genomeBrowser.blastManager || !this.genomeBrowser.blastManager.searchResults) {
      this.genomeBrowser.updateStatus('No BLAST results to display', 'warning');
      return;
    }

    // Find the blast track element
    const blastTrack = document.querySelector('.blast-track');

    if (visible) {
      if (!blastTrack) {
        // If track doesn't exist, it will be created during the view refresh
        this.genomeBrowser.updateStatus('Showing BLAST Results track');
      } else {
        // If track exists but is hidden, show it
        blastTrack.style.display = 'block';
        this.genomeBrowser.updateStatus('Showing BLAST Results track');
      }

      // Add blast to visible tracks if not already present
      if (this.genomeBrowser.visibleTracks && !this.genomeBrowser.visibleTracks.has('blast')) {
        this.genomeBrowser.visibleTracks.add('blast');
      }
    } else {
      if (blastTrack) {
        // If track exists, hide it
        blastTrack.style.display = 'none';
        this.genomeBrowser.updateStatus('Hiding BLAST Results track');
      }

      // Remove blast from visible tracks
      if (this.genomeBrowser.visibleTracks && this.genomeBrowser.visibleTracks.has('blast')) {
        this.genomeBrowser.visibleTracks.delete('blast');
      }
    }

    // Refresh the current view to reflect changes
    this.refreshCurrentView();
  }

  removeWIGTrack(trackName) {
    const wigTracks = this.genomeBrowser.currentWIGTracks;
    if (wigTracks && wigTracks[trackName]) {
      // Confirm removal
      if (confirm(`Remove WIG track "${trackName}"? This action cannot be undone.`)) {
        delete wigTracks[trackName];

        // Remove from stable order
        if (this.genomeBrowser.wigTrackOrder) {
          const index = this.genomeBrowser.wigTrackOrder.indexOf(trackName);
          if (index > -1) {
            this.genomeBrowser.wigTrackOrder.splice(index, 1);
          }
        }

        this.genomeBrowser.updateStatus(`Removed WIG track: ${trackName}`);
        this.refreshCurrentView();
      }
    }
  }

  // ============================================================================
  // WIG TRACK DRAG AND DROP METHODS
  // ============================================================================

  handleWIGTrackDragStart(e) {
    const trackName = e.currentTarget.getAttribute('data-track-name');
    this._draggedWIGTrackName = trackName; // Internal tracking for reliability
    e.dataTransfer.setData('text/plain', trackName);
    e.currentTarget.classList.add('wig-track-dragging');
    e.dataTransfer.effectAllowed = 'move';

    // Stop propagation to prevent genome browser from seeing this as a selection drag
    e.stopPropagation();

    // Create a ghost image or just styling
    setTimeout(() => {
      e.currentTarget.style.opacity = '0.4';
    }, 0);
  }

  handleWIGTrackDragEnd(e) {
    e.currentTarget.classList.remove('wig-track-dragging');
    e.currentTarget.style.opacity = '1';
    
    // Remove any drag-over indicators from items
    const items = document.querySelectorAll('.wig-track-item');
    items.forEach(item => {
      item.style.borderLeft = '';
      item.style.paddingLeft = '';
    });
  }

  handleWIGTrackDragOver(e) {
    if (e.preventDefault) {
      e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
  }

  handleWIGTrackDragEnter(e) {
    e.preventDefault();

    const draggedName = this._draggedWIGTrackName || e.dataTransfer.getData('text/plain');
    const targetItem = e.currentTarget.closest('.wig-track-item');
    if (targetItem && targetItem.getAttribute('data-track-name') !== draggedName) {
      targetItem.style.borderLeft = '2px solid #007bff';
      targetItem.style.paddingLeft = '4px';
    }
  }

  handleWIGTrackDragLeave(e) {
    const targetItem = e.currentTarget.closest('.wig-track-item');
    if (targetItem) {
      targetItem.style.borderLeft = '';
      targetItem.style.paddingLeft = '';
    }
  }

  handleWIGTrackDrop(e) {
    if (e.stopPropagation) {
      e.stopPropagation();
    }
    e.preventDefault();

    const draggedName = this._draggedWIGTrackName || e.dataTransfer.getData('text/plain');
    const targetItem = e.currentTarget.closest('.wig-track-item');
    if (!targetItem) return;

    const targetName = targetItem.getAttribute('data-track-name');

    if (draggedName && targetName && draggedName !== targetName) {
      console.log(`[WIG Drag] Dropping ${draggedName} onto ${targetName}`);
      this.reorderWIGTracks(draggedName, targetName);
    }

    // Explicitly cleanup after drop
    targetItem.style.borderLeft = '';
    targetItem.style.paddingLeft = '';

    return false;
  }

  handleWIGTrackDragEnd(e) {
    e.currentTarget.style.opacity = '1';
    e.currentTarget.classList.remove('wig-track-dragging');
    this._draggedWIGTrackName = null; // Clear internal tracking

    // Remove indicators from all items
    const items = document.querySelectorAll('.wig-track-item');
    items.forEach(item => {
      item.style.borderTop = '';
    });
  }

  reorderWIGTracks(draggedName, targetName) {
    const order = this.genomeBrowser.wigTrackOrder;
    if (!order) return;

    const draggedIndex = order.indexOf(draggedName);
    const targetIndex = order.indexOf(targetName);

    if (draggedIndex > -1 && targetIndex > -1) {
      // Remove from old position
      order.splice(draggedIndex, 1);
      // Insert at new position
      order.splice(targetIndex, 0, draggedName);

      this.genomeBrowser.updateStatus(`Reordered WIG tracks: ${draggedName} moved to position ${targetIndex + 1}`);

      // Sync with TabManager if active
      if (this.genomeBrowser.tabManager && this.genomeBrowser.tabManager.onWIGTrackOrderChanged) {
        this.genomeBrowser.tabManager.onWIGTrackOrderChanged(order);
      }

      this.refreshCurrentView();
    }
  }

  clearAllWIGTracks() {
    const wigTracks = this.genomeBrowser.currentWIGTracks;
    if (wigTracks && Object.keys(wigTracks).length > 0) {
      const count = Object.keys(wigTracks).length;
      if (confirm(`Remove all ${count} WIG tracks? This action cannot be undone.`)) {
        this.genomeBrowser.currentWIGTracks = {};
        this.genomeBrowser.updateStatus(`Removed all ${count} WIG tracks`);
        this.refreshCurrentView();
      }
    }
  }

  refreshCurrentView() {
    // Refresh the current genome view to reflect changes (use full redraw for consistency with drag-end)
    console.log('refreshCurrentView called - using full redraw like drag-end');
    const currentChr = document.getElementById('chromosomeSelect')?.value;
    console.log('Current chromosome:', currentChr);

    if (currentChr && this.genomeBrowser.currentSequence && this.genomeBrowser.currentSequence[currentChr]) {
      console.log('Calling displayGenomeView to refresh tracks...');
      this.genomeBrowser.displayGenomeView(currentChr, this.genomeBrowser.currentSequence[currentChr]);
    } else {
      console.warn('Cannot refresh view - missing chromosome or sequence data');
      // Don't show error to user if no genome is loaded yet
      if (!this.genomeBrowser.currentSequence) {
        console.log('No genome data loaded yet, skipping refresh');
        return;
      }
    }
  }

  // ============================================================================
  // TRACK BUTTON FUNCTIONALITY METHODS
  // ============================================================================

  /**
   * Open track-specific settings modal
   */
  openTrackSettings(trackType, fileId = null) {
    console.log(`Opening settings for track: ${trackType}${fileId ? ` (file: ${fileId})` : ''}`);

    // Create modal if it doesn't exist
    let modal = document.getElementById('trackSettingsModal');
    const isNewModal = !modal;
    if (isNewModal) {
      modal = this.createTrackSettingsModal();
      document.body.appendChild(modal);

      // Initialize draggable and resizable after modal is in the DOM
      if (window.modalDragManager) {
        window.modalDragManager.makeDraggable('#trackSettingsModal');
      }
      if (window.resizableModalManager) {
        window.resizableModalManager.makeResizable('#trackSettingsModal');
      }
    }

    // Reset any drag inline styles so the modal re-centers on open
    if (window.modalDragManager) {
      window.modalDragManager.resetPosition('#trackSettingsModal');
    }

    // Load track-specific settings
    this.loadTrackSpecificSettings(trackType, modal, fileId);

    // Show modal
    modal.classList.add('show');
  }

  /**
   * Toggle track controls (resize, reorder, close)
   */
  toggleTrackControls(trackType, button) {
    console.log('toggleTrackControls called with:', trackType, button);

    const isLocked = button.dataset.locked === 'true';
    const newLocked = !isLocked;

    console.log('Current lock state:', isLocked, 'New lock state:', newLocked);

    button.dataset.locked = newLocked.toString();
    button.innerHTML = newLocked ? '<i class="fas fa-lock"></i>' : '<i class="fas fa-lock-open"></i>';
    button.title = newLocked ? 'Unlock Track Controls' : 'Lock Track Controls';

    // Find the track element using multiple strategies
    let trackElement = button.closest('[class*="-track"]');

    // Fallback: try to find by specific track class names
    if (!trackElement) {
      const trackClasses = [
        'gene-track',
        'gc-track',
        'variant-track',
        'reads-track',
        'protein-track',
        'wig-track',
        'sequence-track',
      ];
      for (const trackClass of trackClasses) {
        trackElement = button.closest(`.${trackClass}`);
        if (trackElement) break;
      }
    }

    // Final fallback: traverse up to find any element with a track-related class
    if (!trackElement) {
      let element = button.parentElement;
      while (element && element !== document.body) {
        for (const className of element.classList) {
          if (className.endsWith('-track')) {
            trackElement = element;
            break;
          }
        }
        if (trackElement) break;
        element = element.parentElement;
      }
    }

    console.log('Found track element:', trackElement);
    console.log('Track element classes:', trackElement ? Array.from(trackElement.classList) : 'none');

    if (trackElement) {
      if (newLocked) {
        trackElement.classList.add('controls-locked');
        // Disable dragging and resizing
        trackElement.draggable = false;

        // Additional visual feedback
        trackElement.style.boxShadow = '0 0 0 2px #f59e0b';
        trackElement.title = 'Track controls are locked';

        console.log('Added controls-locked class and disabled dragging');
      } else {
        trackElement.classList.remove('controls-locked');
        // Enable dragging and resizing
        trackElement.draggable = true;

        // Remove visual feedback
        trackElement.style.boxShadow = '';
        trackElement.title = '';

        console.log('Removed controls-locked class and enabled dragging');
      }

      // Add a brief animation to show the state change
      trackElement.style.transition = 'box-shadow 0.3s ease, opacity 0.3s ease';
    } else {
      console.warn('Could not find track element for button:', button);
      console.warn('Button parent hierarchy:', button.parentElement, button.parentElement?.parentElement);
    }

    console.log(`Track ${trackType} controls ${newLocked ? 'locked' : 'unlocked'}`);

    // Create a temporary notification to show the action worked
    this.showLockNotification(trackType, newLocked);
  }

  /**
   * Show a temporary notification for lock state changes
   */
  showLockNotification(trackType, isLocked) {
    const notification = document.createElement('div');
    notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${isLocked ? '#f59e0b' : '#10b981'};
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            z-index: 10000;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideInRight 0.3s ease;
        `;

    notification.innerHTML = `
            <i class="fas fa-${isLocked ? 'lock' : 'lock-open'}"></i>
            ${trackType.charAt(0).toUpperCase() + trackType.slice(1)} track ${isLocked ? 'locked' : 'unlocked'}
        `;

    document.body.appendChild(notification);

    // Auto-remove after 2 seconds
    setTimeout(() => {
      notification.style.animation = 'slideOutRight 0.3s ease';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 2000);
  }

  /**
   * Toggle track header visibility
   */
  toggleTrackHeader(trackType, button) {
    console.log(`Toggling header for track: ${trackType}`);

    // Find the track element
    const trackElement = button.closest('[class*="-track"]');
    if (!trackElement) return;

    const trackHeader = trackElement.querySelector('.track-header');
    if (!trackHeader) return;

    const isHidden = trackHeader.style.display === 'none';

    if (isHidden) {
      // Show header
      trackHeader.style.display = '';
      button.innerHTML = '<i class="fas fa-minus"></i>';
      button.title = 'Hide Track Header';

      // Update state
      this.headerStates.set(trackType, false);

      // Adjust track content top position
      const trackContent = trackElement.querySelector('.track-content');
      if (trackContent) {
        trackContent.style.marginTop = '';
      }
    } else {
      // Hide header
      trackHeader.style.display = 'none';
      button.innerHTML = '<i class="fas fa-plus"></i>';
      button.title = 'Show Track Header';

      // Update state
      this.headerStates.set(trackType, true);

      // Add a small floating button to show header again
      this.createFloatingHeaderButton(trackElement, trackType);

      // Adjust track content to fill the space
      const trackContent = trackElement.querySelector('.track-content');
      if (trackContent) {
        trackContent.style.marginTop = '5px';
      }
    }
  }

  /**
   * Toggle secondary ruler selection mode for Genes & Features track
   */
  toggleSecondaryRulerSelection(trackType) {
    if (trackType !== 'genes') return;

    // Find the detailed ruler in the gene track
    const geneTrack = document.querySelector('.gene-track');
    if (!geneTrack) {
      console.warn('Gene track not found');
      return;
    }

    const detailedRuler = geneTrack.querySelector('.detailed-ruler-container');
    if (!detailedRuler) {
      console.warn('Detailed ruler not found in gene track');
      return;
    }

    // Find the track content for drag control
    const trackContent = geneTrack.querySelector('.track-content');
    if (!trackContent) {
      console.warn('Track content not found in gene track');
      return;
    }

    // Toggle selection mode
    const isSelecting = detailedRuler.classList.contains('selecting');

    if (isSelecting) {
      // Exit selection mode
      detailedRuler.classList.remove('selecting');
      detailedRuler.style.cursor = 'default';

      // Re-enable dragging for the track content
      this.enableTrackDragging(trackContent);

      // Clear any existing selection
      this.clearSecondaryRulerSelection();

      // Update button appearance
      const selectionBtn = document.querySelector('.track-selection-btn');
      if (selectionBtn) {
        selectionBtn.style.background = 'rgba(255, 255, 255, 0.8)';
        selectionBtn.style.color = '#6c757d';
      }

      console.log('Secondary ruler selection mode disabled - dragging re-enabled');
    } else {
      // Enter selection mode
      detailedRuler.classList.add('selecting');
      detailedRuler.style.cursor = 'crosshair';

      // Disable dragging for the track content
      this.disableTrackDragging(trackContent);

      // Update button appearance
      const selectionBtn = document.querySelector('.track-selection-btn');
      if (selectionBtn) {
        selectionBtn.style.background = '#3b82f6';
        selectionBtn.style.color = '#ffffff';
      }

      console.log('Secondary ruler selection mode enabled - dragging disabled');
    }

    // Add mouse event listeners for selection
    this.setupSecondaryRulerSelection(detailedRuler);
  }

  /**
   * Disable track dragging functionality
   */
  disableTrackDragging(trackContent) {
    if (!trackContent) return;

    // Store original cursor and title
    trackContent.dataset.originalCursor = trackContent.style.cursor;
    trackContent.dataset.originalTitle = trackContent.title;

    // Disable dragging
    trackContent.style.cursor = 'default';
    trackContent.title = 'Sequence selection mode active - dragging disabled';
    trackContent.style.pointerEvents = 'none';

    // Remove drag event listeners
    if (trackContent._handleDragMouseDown) {
      trackContent.removeEventListener('mousedown', trackContent._handleDragMouseDown);
      trackContent._handleDragMouseDown = null;
    }

    console.log('Track dragging disabled for sequence selection mode');
  }

  /**
   * Enable track dragging functionality
   */
  enableTrackDragging(trackContent) {
    if (!trackContent) return;

    // Restore original cursor and title
    if (trackContent.dataset.originalCursor) {
      trackContent.style.cursor = trackContent.dataset.originalCursor;
      delete trackContent.dataset.originalCursor;
    } else {
      trackContent.style.cursor = 'grab';
    }

    if (trackContent.dataset.originalTitle) {
      trackContent.title = trackContent.dataset.originalTitle;
      delete trackContent.dataset.originalTitle;
    } else {
      trackContent.title = 'Drag left or right to navigate through the genome\nKeyboard: ← → arrows, Home, End';
    }

    // Re-enable pointer events
    trackContent.style.pointerEvents = 'auto';

    // Re-add drag functionality through NavigationManager
    if (this.genomeBrowser && this.genomeBrowser.navigationManager) {
      this.genomeBrowser.navigationManager.makeDraggable(trackContent, this.genomeBrowser.currentChromosome);
    }

    console.log('Track dragging re-enabled');
  }

  /**
   * Setup secondary ruler selection functionality
   */
  setupSecondaryRulerSelection(detailedRuler) {
    // Remove existing listeners to avoid duplicates
    detailedRuler.removeEventListener('mousedown', this.handleSecondaryRulerMouseDown);
    detailedRuler.removeEventListener('mousemove', this.handleSecondaryRulerMouseMove);
    detailedRuler.removeEventListener('mouseup', this.handleSecondaryRulerMouseUp);

    // Add new listeners
    detailedRuler.addEventListener('mousedown', this.handleSecondaryRulerMouseDown.bind(this));
    detailedRuler.addEventListener('mousemove', this.handleSecondaryRulerMouseMove.bind(this));
    detailedRuler.addEventListener('mouseup', this.handleSecondaryRulerMouseUp.bind(this));
  }

  /**
   * Handle mouse down on secondary ruler
   */
  handleSecondaryRulerMouseDown(e) {
    if (!e.target.classList.contains('detailed-ruler-canvas')) return;

    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const viewport = this.getCurrentViewport();
    const startPos = Math.round(viewport.start + (x / rect.width) * (viewport.end - viewport.start));

    this.secondaryRulerSelection = {
      start: startPos,
      end: startPos,
      isSelecting: true,
    };

    // Create selection indicator
    this.createSecondaryRulerSelectionIndicator(e.target);
  }

  /**
   * Handle mouse move on secondary ruler
   */
  handleSecondaryRulerMouseMove(e) {
    if (!this.secondaryRulerSelection || !this.secondaryRulerSelection.isSelecting) return;

    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const viewport = this.getCurrentViewport();
    const currentPos = Math.round(viewport.start + (x / rect.width) * (viewport.end - viewport.start));

    this.secondaryRulerSelection.end = currentPos;
    this.updateSecondaryRulerSelectionIndicator();
  }

  /**
   * Handle mouse up on secondary ruler
   */
  handleSecondaryRulerMouseUp(e) {
    if (!this.secondaryRulerSelection) return;

    this.secondaryRulerSelection.isSelecting = false;

    // Apply the selection
    const start = Math.min(this.secondaryRulerSelection.start, this.secondaryRulerSelection.end);
    const end = Math.max(this.secondaryRulerSelection.start, this.secondaryRulerSelection.end);

    if (start !== end) {
      this.applySecondaryRulerSelection(start, end);
    }
  }

  /**
   * Create selection indicator for secondary ruler
   */
  createSecondaryRulerSelectionIndicator(canvas) {
    // Remove existing indicator
    const existingIndicator = canvas.parentElement.querySelector('.secondary-ruler-selection');
    if (existingIndicator) {
      existingIndicator.remove();
    }

    // Create new indicator
    const indicator = document.createElement('div');
    indicator.className = 'secondary-ruler-selection';
    indicator.style.cssText = `
            position: absolute;
            top: 0;
            height: 100%;
            background: rgba(59, 130, 246, 0.3);
            border: 2px solid #3b82f6;
            pointer-events: none;
            z-index: 20;
        `;

    canvas.parentElement.appendChild(indicator);
  }

  /**
   * Update secondary ruler selection indicator
   */
  updateSecondaryRulerSelectionIndicator() {
    if (!this.secondaryRulerSelection) return;

    const indicator = document.querySelector('.secondary-ruler-selection');
    if (!indicator) return;

    const viewport = this.getCurrentViewport();
    const canvas = document.querySelector('.detailed-ruler-canvas');
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const start = Math.min(this.secondaryRulerSelection.start, this.secondaryRulerSelection.end);
    const end = Math.max(this.secondaryRulerSelection.start, this.secondaryRulerSelection.end);

    const startX = ((start - viewport.start) / (viewport.end - viewport.start)) * rect.width;
    const endX = ((end - viewport.start) / (viewport.end - viewport.start)) * rect.width;

    indicator.style.left = `${startX}px`;
    indicator.style.width = `${endX - startX}px`;
  }

  /**
   * Apply secondary ruler selection
   */
  applySecondaryRulerSelection(start, end) {
    // Clear any existing selection
    this.genomeBrowser.clearSequenceSelection();

    // Set the sequence selection
    this.genomeBrowser.currentSequenceSelection = {
      chromosome: this.genomeBrowser.currentChromosome,
      start: start,
      end: end,
    };

    // Update sequence selection state
    this.genomeBrowser.sequenceSelection = {
      start: start,
      end: end,
      active: true,
      source: 'secondary-ruler',
    };

    // Highlight the selected region in Genes & Features track
    this.highlightSelectedRegion(start, end);

    // Update copy button state
    this.genomeBrowser.updateCopyButtonState();

    // Show notification
    this.genomeBrowser.showNotification(
      `Sequence selected: ${this.genomeBrowser.currentChromosome}:${start}-${end} (${end - start + 1} bp)`,
      'success'
    );

    // Update status bar with selection information
    const selectionLength = end - start + 1;
    const statusMessage = `🔵 Secondary Ruler Selection: ${this.genomeBrowser.currentChromosome}:${start.toLocaleString()}-${end.toLocaleString()} (${selectionLength.toLocaleString()} bp)`;

    if (this.genomeBrowser.uiManager) {
      this.genomeBrowser.uiManager.updateStatus(statusMessage);
    } else {
      const statusElement = document.getElementById('statusText');
      if (statusElement) {
        statusElement.textContent = statusMessage;
        statusElement.style.color = '#3b82f6';
        statusElement.style.fontWeight = 'bold';

        // Reset to normal after 5 seconds
        setTimeout(() => {
          statusElement.style.color = '';
          statusElement.style.fontWeight = '';
          statusElement.textContent = 'Ready';
        }, 5000);
      }
    }

    console.log(`Secondary ruler selection applied: ${start}-${end}`);
  }

  /**
   * Clear secondary ruler selection
   */
  clearSecondaryRulerSelection() {
    // Remove selection indicator
    const indicator = document.querySelector('.secondary-ruler-selection');
    if (indicator) {
      indicator.remove();
    }

    // Clear selection state
    this.secondaryRulerSelection = null;

    // Clear feature highlights
    document.querySelectorAll('.feature-highlighted').forEach(el => {
      el.classList.remove('feature-highlighted');
    });
  }

  /**
   * Highlight selected region in Genes & Features track
   */
  highlightSelectedRegion(start, end) {
    // Find features that overlap with the selection
    const chromosome = this.genomeBrowser.currentChromosome;
    if (this.genomeBrowser.currentAnnotations && this.genomeBrowser.currentAnnotations[chromosome]) {
      const annotations = this.genomeBrowser.currentAnnotations[chromosome];
      const overlappingFeatures = annotations.filter(feature => feature.start <= end && feature.end >= start);

      // Clear previous highlights
      document.querySelectorAll('.feature-highlighted').forEach(el => {
        el.classList.remove('feature-highlighted');
      });

      // Highlight overlapping features
      overlappingFeatures.forEach(feature => {
        const featureElements = document.querySelectorAll(`[data-feature-id="${feature.id}"]`);
        featureElements.forEach(el => {
          el.classList.add('feature-highlighted');
        });
      });

      console.log(`TrackRenderer: Highlighted ${overlappingFeatures.length} features in selected region`);
    }
  }

  /**
   * Create floating button to restore hidden header
   */
  createFloatingHeaderButton(trackElement, trackType) {
    // Remove existing floating button if any
    const existingBtn = trackElement.querySelector('.floating-header-btn');
    if (existingBtn) {
      existingBtn.remove();
    }

    const floatingBtn = document.createElement('button');
    floatingBtn.className = 'floating-header-btn';
    floatingBtn.innerHTML = '<i class="fas fa-plus"></i>';
    floatingBtn.title = 'Show Track Header';
    floatingBtn.style.cssText = `
            position: absolute;
            top: 5px;
            right: 5px;
            z-index: 100;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            border: none;
            border-radius: 3px;
            width: 20px;
            height: 20px;
            font-size: 10px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0.6;
            transition: opacity 0.2s;
        `;

    floatingBtn.addEventListener('click', e => {
      e.stopPropagation();
      const trackHeader = trackElement.querySelector('.track-header');
      if (trackHeader) {
        trackHeader.style.display = '';

        // Update state
        this.headerStates.set(trackType, false);

        // Update the hide header button
        const hideHeaderBtn = trackHeader.querySelector('.track-hide-header-btn');
        if (hideHeaderBtn) {
          hideHeaderBtn.innerHTML = '<i class="fas fa-minus"></i>';
          hideHeaderBtn.title = 'Hide Track Header';
        }

        // Adjust track content
        const trackContent = trackElement.querySelector('.track-content');
        if (trackContent) {
          trackContent.style.marginTop = '';
        }
      }
      floatingBtn.remove();
    });

    floatingBtn.addEventListener('mouseenter', () => {
      floatingBtn.style.opacity = '1';
    });

    floatingBtn.addEventListener('mouseleave', () => {
      floatingBtn.style.opacity = '0.6';
    });

    trackElement.appendChild(floatingBtn);
  }

  /**
   * Close/hide track
   */
  /**
   * Close/hide track (instance-aware)
   */
  closeTrack(trackType) {
    console.log(`Closing track: ${trackType}`);

    // If it's a base track, it's in visibleTracks
    if (this.genomeBrowser.visibleTracks.has(trackType)) {
      this.genomeBrowser.visibleTracks.delete(trackType);
    } else {
      // Check if it's an instance ID (e.g., annotation_1)
      this.genomeBrowser.visibleTracks.delete(trackType);
    }

    // Use the unified synchronization and refresh logic
    this.genomeBrowser.updateTrackVisibilityUI();

    // Trigger view refresh
    const currentChr = document.getElementById('chromosomeSelect').value;
    if (currentChr && this.genomeBrowser.currentSequence && this.genomeBrowser.currentSequence[currentChr]) {
      this.genomeBrowser.displayGenomeView(currentChr, this.genomeBrowser.currentSequence[currentChr]);
    }

    // Notify TabManager
    if (this.genomeBrowser.tabManager) {
      this.genomeBrowser.tabManager.onTrackVisibilityChanged();
    }
  }

  /**
   * Make track title editable for renaming
   */
  makeTrackTitleEditable(titleElement, fileId) {
    const currentName = titleElement.textContent;

    // Create input element
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.className = 'track-title-input';
    input.style.cssText = `
            background: white;
            border: 1px solid #007bff;
            border-radius: 3px;
            padding: 2px 6px;
            font-size: 14px;
            font-weight: 600;
            width: 200px;
            color: #495057;
        `;

    // Replace title with input
    titleElement.parentNode.replaceChild(input, titleElement);
    input.focus();
    input.select();

    const finishEdit = (save = true) => {
      const newName = input.value.trim();

      if (save && newName && newName !== currentName) {
        try {
          // Update file name in multi-file manager
          this.genomeBrowser.multiFileManager.renameFile(fileId, newName);
          titleElement.textContent = newName;
          console.log(`File renamed: ${currentName} -> ${newName}`);
        } catch (error) {
          console.error('Error renaming file:', error);
          alert(`Failed to rename file: ${error.message}`);
          titleElement.textContent = currentName;
        }
      } else {
        titleElement.textContent = currentName;
      }

      // Replace input with title
      input.parentNode.replaceChild(titleElement, input);
    };

    // Handle events
    input.addEventListener('blur', () => finishEdit(true));
    input.addEventListener('keypress', e => {
      if (e.key === 'Enter') {
        finishEdit(true);
      } else if (e.key === 'Escape') {
        finishEdit(false);
      }
    });
  }

  /**
   * Remove file-specific track and cleanup
   */
  async removeFileTrack(fileId, trackType) {
    const metadata = this.genomeBrowser.multiFileManager.getFileMetadata(fileId);
    if (!metadata) {
      console.error(`File not found: ${fileId}`);
      return;
    }

    const confirmMessage = `Remove "${metadata.name}" and its track?

This will:
- Remove the file from memory
- Close the associated track
- Clear all related data

This action cannot be undone.`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      console.log(`Removing file track: ${fileId} (${metadata.name})`);

      // Remove file from multi-file manager
      await this.genomeBrowser.multiFileManager.removeFile(fileId);

      // Find and remove the track element
      const trackElement = document.querySelector(`[data-file-id="${fileId}"]`)?.closest('[class*="-track"]');
      if (trackElement) {
        trackElement.remove();
      }

      // Update status
      this.genomeBrowser.updateStatus(`Removed file: ${metadata.name}`);

      // Refresh view if needed
      const currentChr = document.getElementById('chromosomeSelect').value;
      if (currentChr && this.genomeBrowser.currentSequence && this.genomeBrowser.currentSequence[currentChr]) {
        this.genomeBrowser.displayGenomeView(currentChr, this.genomeBrowser.currentSequence[currentChr]);
      }
    } catch (error) {
      console.error('Error removing file track:', error);
      alert(`Failed to remove file: ${error.message}`);
    }
  }

  /**
   * Create track settings modal with draggable and resizable functionality
   */
  createTrackSettingsModal() {
    const modal = document.createElement('div');
    modal.id = 'trackSettingsModal';
    modal.className = 'modal';
    modal.innerHTML = `
            <div class="modal-content resizable resizable-modal-content" style="max-width: 700px;">
                <div class="modal-header">
                    <h3 id="trackSettingsTitle"><i class="fas fa-cog"></i> Track Settings</h3>
                    <div class="modal-controls">
                        <button class="reset-position-btn" title="Reset Position">
                            <i class="fas fa-crosshairs"></i>
                        </button>
                        <button class="reset-defaults-btn" title="Reset to Defaults">
                            <i class="fas fa-undo"></i>
                        </button>
                        <button class="modal-close" id="closeTrackSettingsModal">&times;</button>
                    </div>
                </div>
                <div class="modal-body" id="trackSettingsBody">
                    <!-- Settings will be loaded here -->
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary modal-close">Cancel</button>
                    <button class="btn btn-primary" id="applyTrackSettings">Apply</button>
                </div>
                <!-- Resize handles -->
                <div class="resize-handle resize-handle-n"></div>
                <div class="resize-handle resize-handle-s"></div>
                <div class="resize-handle resize-handle-e"></div>
                <div class="resize-handle resize-handle-w"></div>
                <div class="resize-handle resize-handle-ne"></div>
                <div class="resize-handle resize-handle-nw"></div>
                <div class="resize-handle resize-handle-se"></div>
                <div class="resize-handle resize-handle-sw"></div>
            </div>
        `;

    // Add event listeners
    modal.addEventListener('click', e => {
      // Only close when clicking the close button, not the background
      if (e.target.classList.contains('modal-close')) {
        modal.classList.remove('show');
      }
    });

    const applyButton = modal.querySelector('#applyTrackSettings');
    if (applyButton) {
      applyButton.addEventListener('click', e => {
        console.log('🔧 [DEBUG] Apply button clicked!');
        console.log('🔧 [DEBUG] Event target:', e.target);
        console.log('🔧 [DEBUG] Modal dataset:', modal.dataset);
        e.preventDefault();
        e.stopPropagation();
        this.applyTrackSettings();
      });
      console.log('🔧 [DEBUG] Apply button event listener attached');
    } else {
      console.error('🔧 [DEBUG] Apply button not found in modal!');
    }

    // Note: Draggable/resizable initialization is done in openTrackSettings()
    // after the modal is appended to the DOM

    // Add reset to defaults button handler
    const resetDefaultsBtn = modal.querySelector('.reset-defaults-btn');
    if (resetDefaultsBtn) {
      resetDefaultsBtn.addEventListener('click', () => {
        this.resetTrackSettingsToDefaults();
      });
    }

    return modal;
  }

  /**
   * Load track-specific settings content
   */
  loadTrackSpecificSettings(trackType, modal, fileId = null) {
    console.log('⚙️ loadTrackSpecificSettings called with trackType:', trackType, 'fileId:', fileId);

    const titleElement = modal.querySelector('#trackSettingsTitle');
    const bodyElement = modal.querySelector('#trackSettingsBody');
    console.log('⚙️ Modal elements found - title:', !!titleElement, 'body:', !!bodyElement);

    // Get current settings for this track (instance-specific if fileId provided)
    const currentSettings = this.getTrackSettings(trackType, fileId);
    console.log('⚙️ Current settings for', trackType, ':', currentSettings);

    switch (trackType) {
      case 'genes':
        titleElement.textContent = 'Genes & Features Track Settings';
        bodyElement.innerHTML = this.createGenesSettingsContent(currentSettings);

        // Add event listeners for genes settings
        setTimeout(() => {
          this.setupGenesSettingsEventListeners(bodyElement);
        }, 100);
        break;

      case 'gc':
        titleElement.textContent = 'GC Content & Skew Track Settings';
        bodyElement.innerHTML = this.createGCSettingsContent(currentSettings);
        break;

      case 'reads':
        titleElement.textContent = 'Aligned Reads Track Settings';
        bodyElement.innerHTML = this.createReadsSettingsContent(currentSettings);

        // Add event listeners for reads settings
        setTimeout(() => {
          this.setupReadsSettingsEventListeners(bodyElement);
        }, 100);
        break;

      case 'sequence':
        console.log('⚙️ Loading sequence track settings...');
        titleElement.textContent = 'Sequence Track Settings';
        const sequenceContent = this.createSequenceSettingsContent(currentSettings);
        console.log('⚙️ Generated sequence content length:', sequenceContent.length);
        bodyElement.innerHTML = sequenceContent;
        console.log('⚙️ Sequence settings loaded into modal body');

        // Debug: Check if tabs are actually in the DOM and set up tab functionality
        setTimeout(() => {
          const tabButtons = bodyElement.querySelectorAll('.tab-button');
          const tabPanels = bodyElement.querySelectorAll('.tab-panel');
          console.log('🔍 Tab buttons found:', tabButtons.length);
          console.log('🔍 Tab panels found:', tabPanels.length);

          // Check each tab panel individually
          tabPanels.forEach((panel, index) => {
            console.log(
              `🔍 Panel ${index}:`,
              panel.id,
              'has active:',
              panel.classList.contains('active'),
              'display:',
              getComputedStyle(panel).display
            );
          });

          // Check each tab button
          tabButtons.forEach((button, index) => {
            console.log(
              `🔍 Button ${index}:`,
              button.getAttribute('data-tab'),
              'has active:',
              button.classList.contains('active')
            );
          });

          console.log('🔍 Active tab panel (.tab-panel.active):', bodyElement.querySelector('.tab-panel.active'));
          console.log(
            '🔍 Active tab panel (.sequence-settings-tabs .tab-panel.active):',
            bodyElement.querySelector('.sequence-settings-tabs .tab-panel.active')
          );
          console.log('🔍 Just active class (.active):', bodyElement.querySelectorAll('.active'));
          console.log('🔍 All tab panels:', bodyElement.querySelectorAll('.tab-panel'));
          console.log('🔍 Tab content div:', bodyElement.querySelector('.tab-content'));
          console.log('🔍 Sequence settings tabs div:', bodyElement.querySelector('.sequence-settings-tabs'));

          // Let's check what's actually inside the active panel
          const activePanelForDebug = bodyElement.querySelector('.tab-panel.active');
          if (activePanelForDebug) {
            console.log('🔍 Active panel content length:', activePanelForDebug.innerHTML.length);
            console.log('🔍 Active panel first 200 chars:', activePanelForDebug.innerHTML.substring(0, 200));
          }

          console.log('🔍 Modal body innerHTML length:', bodyElement.innerHTML.length);
          console.log('🔍 Modal body first 500 chars:', bodyElement.innerHTML.substring(0, 500));

          // Force show the active tab if it's hidden
          const activePanel = bodyElement.querySelector('.tab-panel.active') || bodyElement.querySelector('.tab-panel');
          if (activePanel) {
            console.log('🔧 Forcing active panel to show');
            activePanel.style.cssText =
              'visibility: visible !important; opacity: 1 !important; height: auto !important; overflow: visible !important; position: static !important; left: auto !important;';
            activePanel.classList.add('active');
            console.log('🔧 Applied inline styles to panel:', activePanel.id);
          }

          // Debug modal positioning and visibility
          console.log('🔍 Modal element:', modal);
          console.log('🔍 Modal display:', getComputedStyle(modal).display);
          console.log('🔍 Modal visibility:', getComputedStyle(modal).visibility);
          console.log('🔍 Modal z-index:', getComputedStyle(modal).zIndex);
          console.log('🔍 Modal position:', getComputedStyle(modal).position);
          console.log('🔍 Modal top:', getComputedStyle(modal).top);
          console.log('🔍 Modal left:', getComputedStyle(modal).left);

          console.log('🔍 Body element:', bodyElement);
          console.log('🔍 Body display:', getComputedStyle(bodyElement).display);
          console.log('🔍 Body visibility:', getComputedStyle(bodyElement).visibility);
          console.log('🔍 Body height:', getComputedStyle(bodyElement).height);
          console.log('🔍 Body max-height:', getComputedStyle(bodyElement).maxHeight);
          console.log('🔍 Body overflow:', getComputedStyle(bodyElement).overflow);

          // Force modal body to have sufficient height - this was the key fix!
          console.log('🔧 Forcing modal body height...');
          bodyElement.style.cssText =
            'height: auto !important; min-height: 400px !important; max-height: 600px !important; overflow-y: auto !important; display: block !important; visibility: visible !important; padding: 20px !important;';
          console.log('🔍 After forcing - Body height:', getComputedStyle(bodyElement).height);
          console.log('🔍 After forcing - Body overflow:', getComputedStyle(bodyElement).overflow);

          // Tab panels should now be visible with proper modal body height
          tabPanels.forEach((panel, index) => {
            console.log(`✅ Panel ${index} should now be visible`);
            console.log(`✅ Panel ${index} innerHTML length:`, panel.innerHTML.length);
          });

          // Manually set up tab functionality since script tags in innerHTML don't execute
          console.log('🔧 Setting up tab button event listeners');
          tabButtons.forEach(button => {
            button.addEventListener('click', e => {
              e.preventDefault();
              const targetTab = button.getAttribute('data-tab');
              console.log('🔧 Tab clicked:', targetTab);

              // Remove active class from all buttons and panels
              tabButtons.forEach(btn => btn.classList.remove('active'));
              tabPanels.forEach(panel => panel.classList.remove('active'));

              // Add active class to clicked button
              button.classList.add('active');

              // Show corresponding panel
              const targetPanel = bodyElement.querySelector(`#${targetTab}-tab`);
              if (targetPanel) {
                targetPanel.classList.add('active');
                targetPanel.style.display = 'block !important';
                console.log('🔧 Activated panel:', targetTab);
              } else {
                console.error('🔧 Target panel not found:', `${targetTab}-tab`);
              }
            });
          });

          // Set up color mode switching for sequence settings
          const colorModeSelect = bodyElement.querySelector('#sequenceColorMode');
          if (colorModeSelect) {
            console.log('🎨 Setting up color mode switching');

            const uniformSettings = bodyElement.querySelector('#uniformColorSettings');
            const geneColorSettings = bodyElement.querySelector('#geneColorSettings');
            const baseColorSettings = bodyElement.querySelector('#baseColorSettings');

            const switchColorMode = mode => {
              console.log('🎨 Switching to color mode:', mode);

              // Hide all color mode settings
              if (uniformSettings) uniformSettings.style.display = 'none';
              if (geneColorSettings) geneColorSettings.style.display = 'none';
              if (baseColorSettings) baseColorSettings.style.display = 'none';

              // Show the selected mode settings
              switch (mode) {
                case 'uniform':
                  if (uniformSettings) uniformSettings.style.display = 'block';
                  break;
                case 'geneColors':
                  if (geneColorSettings) geneColorSettings.style.display = 'block';
                  break;
                case 'baseColors':
                  if (baseColorSettings) baseColorSettings.style.display = 'block';
                  break;
              }
            };

            colorModeSelect.addEventListener('change', e => {
              switchColorMode(e.target.value);
            });

            // Initialize with current mode
            switchColorMode(colorModeSelect.value);
          }
        }, 100);
        break;

      case 'sequenceLine':
        console.log('⚙️ Loading sequence line track settings...');
        titleElement.textContent = 'Single-line Sequence Track Settings';
        bodyElement.innerHTML = this.createSequenceLineSettingsContent(currentSettings);

        // Setup event listeners for sequence line settings
        setTimeout(() => {
          this.setupSequenceLineSettingsEventListeners(bodyElement);
        }, 100);
        break;

      case 'wigTracks':
        titleElement.textContent = 'WIG Tracks Settings';
        bodyElement.innerHTML = this.createWIGTracksSettingsContent(currentSettings);
        break;

      case 'variants':
        titleElement.textContent = 'Variants Track Settings';
        bodyElement.innerHTML = this.createVariantsSettingsContent(currentSettings);

        // Add event listeners for variants settings
        setTimeout(() => {
          this.setupVariantsSettingsEventListeners(bodyElement);
        }, 100);
        break;

      case 'actions':
        titleElement.textContent = 'Actions Track Settings';
        bodyElement.innerHTML = this.createActionsSettingsContent(currentSettings);
        break;

      default:
        titleElement.textContent = `${trackType} Track Settings`;
        bodyElement.innerHTML = this.createDefaultSettingsContent(trackType, currentSettings);
        break;
    }

    // Store current track type and file ID for applying settings
    modal.dataset.trackType = trackType;
    modal.dataset.fileId = fileId || '';
  }

  /**
   * Create genes track settings content
   */
  createGenesSettingsContent(settings) {
    return `
            <div class="settings-section">
                <h4>Display Options</h4>
                <div class="form-group">
                    <label for="genesRenderingMode">Rendering Mode:</label>
                    <select id="genesRenderingMode">
                        <option value="svg" ${settings.renderingMode === 'svg' ? 'selected' : ''}>SVG (Default)</option>
                        <option value="canvas" ${settings.renderingMode === 'canvas' ? 'selected' : ''}>Canvas (Better Performance)</option>
                    </select>
                    <div class="help-text">Canvas mode offers improved performance for large datasets.</div>
                </div>
                <div class="form-group">
                    <label for="genesMaxRows">Maximal rows for displaying features:</label>
                    <input type="number" id="genesMaxRows" min="1" max="20" value="${settings.maxRows || 6}">
                    <div class="help-text">Limits the number of rows shown. Features beyond this limit will be hidden or merged depending on the layout mode.</div>
                </div>
                <div class="form-group">
                    <label for="genesLayoutMode">Layout Mode:</label>
                    <select id="genesLayoutMode">
                        <option value="expanded" ${settings.layoutMode === 'expanded' || !settings.layoutMode ? 'selected' : ''}>Expanded</option>
                        <option value="compact" ${settings.layoutMode === 'compact' ? 'selected' : ''}>Compact</option>
                        <option value="groupByType" ${settings.layoutMode === 'groupByType' ? 'selected' : ''}>Group by Type</option>
                    </select>
                    <div class="help-text">"Expanded": Full-size features with labels. "Compact": Smaller features without labels. "Group by Type": Separates features into dedicated rows by type.</div>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="genesShowOperonsSameRow" ${settings.showOperonsSameRow ? 'checked' : ''}>
                        Group genes in the same operon
                    </label>
                    <div class="help-text">When enabled, genes belonging to the same operon will be grouped together in the same row when possible (in Compact mode).</div>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="genesShowSequence" ${settings.showSequence ? 'checked' : ''}>
                        Show reference sequence
                    </label>
                    <div class="help-text">When enabled, displays the reference sequence between the secondary ruler and gene elements for better context.</div>
                </div>
                <div class="form-group">
                    <label for="genesSequenceHeight">Reference Sequence Height (px):</label>
                    <input type="number" id="genesSequenceHeight" min="15" max="50" value="${settings.sequenceHeight || 25}" ${settings.showSequence ? '' : 'disabled'}>
                    <div class="help-text">Height of the reference sequence display area.</div>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="genesCircularMode" ${settings.circularMode ? 'checked' : ''}>
                        Enable circular browsing mode
                    </label>
                    <div class="help-text">When enabled, enables wraparound navigation for circular genomes (e.g., plasmids, bacterial chromosomes).</div>
                </div>
            </div>
            <div class="settings-section">
                <h4>Gene Selection Highlight</h4>
                <div class="form-group">
                    <label for="genesHighlightEffect">Highlight Effect:</label>
                    <select id="genesHighlightEffect">
                        <option value="pulse" ${settings.highlightEffect === 'pulse' ? 'selected' : ''}>Breathing Pulse (Default)</option>
                        <option value="border" ${settings.highlightEffect === 'border' ? 'selected' : ''}>Border Thickening</option>
                        <option value="both" ${settings.highlightEffect === 'both' ? 'selected' : ''}>Both Effects</option>
                    </select>
                    <div class="help-text">Choose the visual effect when a gene is selected. "Breathing Pulse" creates a pulsing glow effect, "Border Thickening" creates a thick animated border, and "Both" combines both effects.</div>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="genesAutoHighlightSequence" ${settings.autoHighlightSequence ? 'checked' : ''}>
                        Auto-highlight sequence region when gene is selected
                    </label>
                    <div class="help-text">When enabled, automatically highlights the corresponding sequence region in the reference sequence when a gene is selected.</div>
                </div>
            </div>
            <div class="settings-section">
                <h4>Interactive Features</h4>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="genesEnableGlobalDragging" ${settings.enableGlobalDragging !== false ? 'checked' : ''}>
                        Enable Global Track Dragging
                    </label>
                    <div class="help-text">When enabled, this track will update dynamically during drag operations, providing real-time navigation feedback. Disable for better performance on slower devices.</div>
                </div>
                <div class="form-group">
                    <label for="genesWheelZoomSensitivity">Wheel Zoom Sensitivity:</label>
                    <input type="range" id="genesWheelZoomSensitivity" min="0.01" max="0.5" step="0.01" value="${settings.wheelZoomSensitivity || 0.1}">
                    <div class="range-display">Current: <span id="genesWheelZoomSensitivityValue">${settings.wheelZoomSensitivity || 0.1}</span></div>
                    <div class="help-text">Adjust mouse wheel zoom sensitivity when cursor is over the Genes track. Lower values = slower zoom, higher values = faster zoom. (0.01 = very slow, 0.5 = very fast)</div>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="genesOverrideGlobalZoom" ${settings.overrideGlobalZoom ? 'checked' : ''}>
                        Override Global Zoom Settings
                    </label>
                    <div class="help-text">When enabled, the Genes track will use its own zoom sensitivity instead of the global wheel zoom settings when the cursor is over this track.</div>
                </div>
            </div>
            <div class="settings-section">
                <h4>Visual Settings</h4>
                <div class="form-group">
                    <label for="genesTrackHeight">Track Height (px):</label>
                    <input type="number" id="genesTrackHeight" min="60" max="400" value="${settings.height || 120}">
                </div>
                <div class="form-group">
                    <label for="genesGeneHeight">Gene Element Height (px):</label>
                    <input type="number" id="genesGeneHeight" min="12" max="60" value="${settings.geneHeight || 24}">
                    <div class="help-text">Height of individual gene elements. Affects spacing between gene rows.</div>
                </div>
                <div class="form-group">
                    <label for="genesFontSize">Gene Name Font Size (px):</label>
                    <input type="number" id="genesFontSize" min="8" max="48" value="${settings.fontSize || 24}">
                    <div class="help-text">Font size for gene names and labels.</div>
                </div>
                <div class="form-group">
                    <label for="genesGeneNameColor">Gene Name Color:</label>
                    <input type="color" id="genesGeneNameColor" value="${settings.geneNameColor || '#333333'}">
                    <div class="help-text">Color of the gene name text labels.</div>
                </div>
                <div class="form-group">
                    <label for="genesMaxBorderWidth">Maximum Border Width (px):</label>
                    <input type="number" id="genesMaxBorderWidth" min="0.5" max="5" step="0.1" value="${settings.maxBorderWidth !== undefined ? settings.maxBorderWidth : 1}">
                    <div class="help-text">Maximum thickness of gene borders when zoomed in.</div>
                </div>
                <div class="form-group">
                    <label for="genesFontFamily">Gene Name Font Family:</label>
                    <select id="genesFontFamily">
                        <option value="Arial, sans-serif" ${(settings.fontFamily || 'Arial, sans-serif') === 'Arial, sans-serif' ? 'selected' : ''}>Arial</option>
                        <option value="Inter, sans-serif" ${(settings.fontFamily || 'Arial, sans-serif') === 'Inter, sans-serif' ? 'selected' : ''}>Inter</option>
                        <option value="Helvetica, sans-serif" ${(settings.fontFamily || 'Arial, sans-serif') === 'Helvetica, sans-serif' ? 'selected' : ''}>Helvetica</option>
                        <option value="monospace" ${(settings.fontFamily || 'Arial, sans-serif') === 'monospace' ? 'selected' : ''}>Monospace</option>
                        <option value="Georgia, serif" ${(settings.fontFamily || 'Arial, sans-serif') === 'Georgia, serif' ? 'selected' : ''}>Georgia</option>
                    </select>
                </div>
            </div>
        `;
  }

  /**
   * Create GC track settings content
   */
  createGCSettingsContent(settings) {
    return `
            <div class="settings-section">
                <h4>Colors & Styles</h4>
                <div class="form-group">
                    <label for="gcContentColor">GC Content Color:</label>
                    <input type="color" id="gcContentColor" value="${settings.contentColor || '#3b82f6'}">
                </div>
                <div class="form-group">
                    <label for="gcSkewPositiveColor">GC Skew Positive Color:</label>
                    <input type="color" id="gcSkewPositiveColor" value="${settings.skewPositiveColor || '#10b981'}">
                </div>
                <div class="form-group">
                    <label for="gcSkewNegativeColor">GC Skew Negative Color:</label>
                    <input type="color" id="gcSkewNegativeColor" value="${settings.skewNegativeColor || '#ef4444'}">
                </div>
                <div class="form-group">
                    <label for="gcLineWidth">Line Width:</label>
                    <input type="number" id="gcLineWidth" min="1" max="5" step="0.5" value="${settings.lineWidth || 2}">
                </div>
                <div class="form-group">
                    <label for="gcTrackHeight">Track Height (px):</label>
                    <input type="number" id="gcTrackHeight" min="80" max="300" value="${settings.height || 140}">
                </div>
            </div>
        `;
  }

  /**
   * Create actions track settings content
   */
  createActionsSettingsContent(settings) {
    return `
            <div class="settings-section">
                <h4>Display Options</h4>
                <div class="form-group">
                    <label for="actionsTrackHeight">Track Height (px):</label>
                    <input type="number" id="actionsTrackHeight" min="60" max="300" value="${settings.height || 120}">
                    <div class="help-text">Total height of the actions track container.</div>
                </div>
                <div class="form-group">
                    <label for="actionsActionHeight">Action Element Height (px):</label>
                    <input type="number" id="actionsActionHeight" min="5" max="30" value="${settings.actionHeight || 10}">
                    <div class="help-text">Height of each individual action element (marker/arrow).</div>
                </div>
                <div class="form-group">
                    <label for="actionsRowSpacing">Row Spacing (px):</label>
                    <input type="number" id="actionsRowSpacing" min="0" max="10" value="${settings.rowSpacing || 2}">
                    <div class="help-text">Vertical spacing between action rows.</div>
                </div>
            </div>
            <div class="settings-section">
                <h4>Padding & Layout</h4>
                <div class="form-group">
                    <label for="actionsTopPadding">Top Padding (px):</label>
                    <input type="number" id="actionsTopPadding" min="0" max="20" value="${settings.topPadding || 5}">
                    <div class="help-text">Padding at the top of the track.</div>
                </div>
                <div class="form-group">
                    <label for="actionsBottomPadding">Bottom Padding (px):</label>
                    <input type="number" id="actionsBottomPadding" min="0" max="20" value="${settings.bottomPadding || 5}">
                    <div class="help-text">Padding at the bottom of the track.</div>
                </div>
            </div>
            <div class="settings-section">
                <h4>Text Settings</h4>
                <div class="form-group">
                    <label for="actionsFontSize">Font Size (px):</label>
                    <input type="number" id="actionsFontSize" min="8" max="16" value="${settings.fontSize || 10}">
                    <div class="help-text">Font size for action labels and text.</div>
                </div>
                <div class="form-group">
                    <label for="actionsFontFamily">Font Family:</label>
                    <select id="actionsFontFamily">
                        <option value="Arial, sans-serif" ${(settings.fontFamily || 'Arial, sans-serif') === 'Arial, sans-serif' ? 'selected' : ''}>Arial</option>
                        <option value="Helvetica, sans-serif" ${settings.fontFamily === 'Helvetica, sans-serif' ? 'selected' : ''}>Helvetica</option>
                        <option value="monospace" ${settings.fontFamily === 'monospace' ? 'selected' : ''}>Monospace</option>
                    </select>
                    <div class="help-text">Font family for action text display.</div>
                </div>
            </div>
        `;
  }

  /**
   * Create WIG tracks settings content
   */
  createWIGTracksSettingsContent(settings) {
    // Get current WIG tracks data
    const wigTracks = this.genomeBrowser.currentWIGTracks || {};
    const trackCount = Object.keys(wigTracks).length;

    // Start building the settings HTML
    let html = `
            <div class="settings-section">
                <h4>Track Heights</h4>
                <p>Set individual heights for each WIG track. Changes will be applied immediately.</p>
                <div class="wig-track-heights-container">
        `;

    // Add height controls for each WIG track
    Object.entries(wigTracks).forEach(([trackName, wigTrack], index) => {
      // Get current height from settings or use default
      const currentHeight = settings.trackHeights?.[trackName] || 30;

      html += `
                <div class="form-group">
                    <label for="wigTrackHeight-${index}">${trackName} Height (px):</label>
                    <input type="number" 
                           id="wigTrackHeight-${index}" 
                           class="wig-track-height-input"
                           data-track-name="${trackName}"
                           min="15" 
                           max="100" 
                           value="${currentHeight}">
                    <div class="help-text">Height of the "${trackName}" track visualization.</div>
                </div>
            `;
    });

    // Add global track height option if no tracks are present
    if (trackCount === 0) {
      html += `
                <div class="form-group">
                    <label for="wigDefaultTrackHeight">Default Track Height (px):</label>
                    <input type="number" 
                           id="wigDefaultTrackHeight" 
                           min="15" 
                           max="100" 
                           value="${settings.defaultTrackHeight || 30}">
                    <div class="help-text">Default height for new WIG tracks.</div>
                </div>
            `;
    }

    // Add track spacing option
    html += `
                </div>
            </div>
            <div class="settings-section">
                <h4>General Settings</h4>
                <div class="form-group">
                    <label for="wigTrackSpacing">Track Spacing (px):</label>
                    <input type="number" 
                           id="wigTrackSpacing" 
                           min="0" 
                           max="20" 
                           value="${settings.trackSpacing || 5}">
                    <div class="help-text">Space between WIG tracks.</div>
                </div>
            </div>
        `;

    return html;
  }

  /**
   * Create variants track settings content
   */
  createVariantsSettingsContent(settings) {
    return `
            <div class="settings-section">
                <h4>Display Options</h4>
                <div class="form-group">
                    <label for="variantsHeight">Track Height (px):</label>
                    <input type="number" id="variantsHeight" min="50" max="300" value="${settings.height || 80}">
                    <div class="help-text">Total height of the variants track container.</div>
                </div>
                <div class="form-group">
                    <label for="variantsElementHeight">Variant Element Height (px):</label>
                    <input type="number" id="variantsElementHeight" min="8" max="30" value="${settings.elementHeight || 12}">
                    <div class="help-text">Height of individual variant bars.</div>
                </div>
                <div class="form-group">
                    <label for="variantsRowSpacing">Row Spacing (px):</label>
                    <input type="number" id="variantsRowSpacing" min="2" max="20" value="${settings.rowSpacing || 8}">
                    <div class="help-text">Vertical spacing between variant rows.</div>
                </div>
            </div>

            <div class="settings-section">
                <h4>Color Scheme</h4>
                <div class="form-group">
                    <label for="variantsColorMode">Color by:</label>
                    <select id="variantsColorMode">
                        <option value="type" ${settings.colorMode === 'type' || !settings.colorMode ? 'selected' : ''}>Variant Type</option>
                        <option value="impact" ${settings.colorMode === 'impact' ? 'selected' : ''}>Impact Severity</option>
                        <option value="quality" ${settings.colorMode === 'quality' ? 'selected' : ''}>Quality Score</option>
                        <option value="custom" ${settings.colorMode === 'custom' ? 'selected' : ''}>Custom Color</option>
                    </select>
                    <div class="help-text">Choose how variants are colored. Type: SNP/INDEL/SV. Impact: HIGH/MODERATE/LOW. Quality: Based on VCF quality score.</div>
                </div>
                <div id="customColorGroup" style="display: ${settings.colorMode === 'custom' ? 'block' : 'none'};">
                    <div class="form-group">
                        <label for="variantsCustomColor">Custom Variant Color:</label>
                        <input type="color" id="variantsCustomColor" value="${settings.customColor || '#e74c3c'}">
                        <div class="help-text">Custom color for all variants when 'Custom Color' mode is selected.</div>
                    </div>
                </div>
            </div>

            <div class="settings-section">
                <h4>Type Colors (when Color by Type)</h4>
                <div class="form-group">
                    <label for="variantsSNPColor">SNP Color:</label>
                    <input type="color" id="variantsSNPColor" value="${settings.snpColor || '#e74c3c'}">
                </div>
                <div class="form-group">
                    <label for="variantsINDELColor">INDEL Color:</label>
                    <input type="color" id="variantsINDELColor" value="${settings.indelColor || '#3498db'}">
                </div>
                <div class="form-group">
                    <label for="variantsSVColor">Structural Variant Color:</label>
                    <input type="color" id="variantsSVColor" value="${settings.svColor || '#9b59b6'}">
                </div>
            </div>

            <div class="settings-section">
                <h4>Impact Colors (when Color by Impact)</h4>
                <div class="form-group">
                    <label for="variantsHighImpactColor">HIGH Impact:</label>
                    <input type="color" id="variantsHighImpactColor" value="${settings.highImpactColor || '#e74c3c'}">
                </div>
                <div class="form-group">
                    <label for="variantsModerateImpactColor">MODERATE Impact:</label>
                    <input type="color" id="variantsModerateImpactColor" value="${settings.moderateImpactColor || '#f39c12'}">
                </div>
                <div class="form-group">
                    <label for="variantsLowImpactColor">LOW Impact:</label>
                    <input type="color" id="variantsLowImpactColor" value="${settings.lowImpactColor || '#2ecc71'}">
                </div>
                <div class="form-group">
                    <label for="variantsModifierImpactColor">MODIFIER Impact:</label>
                    <input type="color" id="variantsModifierImpactColor" value="${settings.modifierImpactColor || '#95a5a6'}">
                </div>
            </div>

            <div class="settings-section">
                <h4>Filtering Options</h4>
                <div class="form-group">
                    <label for="variantsMinQuality">Minimum Quality Score:</label>
                    <input type="number" id="variantsMinQuality" min="0" max="1000" value="${settings.minQuality || 0}">
                    <div class="help-text">Filter out variants with quality score below this value. Set to 0 to show all variants.</div>
                </div>
                <div class="form-group">
                    <label for="variantsMaxDisplayCount">Maximum Display Count:</label>
                    <input type="number" id="variantsMaxDisplayCount" min="10" max="1000" value="${settings.maxDisplayCount || 200}">
                    <div class="help-text">Maximum number of variants to display. Higher values may impact performance.</div>
                </div>
            </div>

            <div class="settings-section">
                <h4>Label Options</h4>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="variantsShowLabels" ${settings.showLabels !== false ? 'checked' : ''}>
                        Show Variant Labels
                    </label>
                    <div class="help-text">Display variant IDs or gene names above variants when space permits.</div>
                </div>
                <div class="form-group">
                    <label for="variantsLabelFontSize">Label Font Size (px):</label>
                    <input type="number" id="variantsLabelFontSize" min="8" max="16" value="${settings.labelFontSize || 10}">
                </div>
            </div>

            <div class="settings-section">
                <h4>Multi-VCF Options</h4>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="variantsGroupByFile" ${settings.groupByFile ? 'checked' : ''}>
                        Group Variants by VCF File
                    </label>
                    <div class="help-text">When multiple VCF files are loaded, group variants by source file.</div>
                </div>
                <div class="form-group">
                    <label for="variantsFileSpacing">Spacing Between Files (px):</label>
                    <input type="number" id="variantsFileSpacing" min="0" max="30" value="${settings.fileSpacing || 10}">
                </div>
            </div>
        `;
  }

  /**
   * Create reads track settings content
   */
  createReadsSettingsContent(settings) {
    return `
            <div class="settings-section">
                <h4>Coverage Visualization</h4>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="readsShowCoverage" ${settings.showCoverage !== false ? 'checked' : ''}>
                        Show coverage visualization
                    </label>
                    <div class="help-text">Display read coverage track above the reads for better depth visualization.</div>
                </div>
                <div class="form-group" id="coverageHeightGroup" style="display: ${settings.showCoverage !== false ? 'block' : 'none'}">
                    <label for="coverageHeight">Coverage track height (px):</label>
                    <input type="number" id="coverageHeight" min="30" max="100" value="${settings.coverageHeight || 50}">
                    <div class="help-text">Height of the coverage visualization track.</div>
                </div>
                <div class="form-group" id="coverageColorGroup" style="display: ${settings.showCoverage !== false ? 'block' : 'none'}">
                    <label for="coverageColor">Coverage color:</label>
                    <input type="color" id="coverageColor" value="${settings.coverageColor || '#4a90e2'}">
                    <div class="help-text">Color for the coverage visualization area.</div>
                </div>
                <div class="form-group" id="coverageStrokeColorGroup" style="display: ${settings.showCoverage !== false ? 'block' : 'none'}">
                    <label for="coverageStrokeColor">Coverage stroke color:</label>
                    <input type="color" id="coverageStrokeColor" value="${settings.coverageStrokeColor || '#2c5aa0'}">
                    <div class="help-text">Stroke/border color for the coverage area outline.</div>
                </div>
            </div>
            <div class="settings-section">
                <h4>Reference Sequence</h4>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="readsShowReference" ${settings.showReference !== false ? 'checked' : ''}>
                        Show reference sequence
                    </label>
                    <div class="help-text">Display reference genome sequence between coverage and reads for comparison.</div>
                </div>
                <div class="form-group" id="referenceHeightGroup" style="display: ${settings.showReference !== false ? 'block' : 'none'}">
                    <label for="referenceHeight">Reference sequence height (px):</label>
                    <input type="number" id="referenceHeight" min="15" max="50" value="${settings.referenceHeight || 25}">
                    <div class="help-text">Height of the reference sequence visualization.</div>
                </div>
                <div class="form-group" id="referenceFontSizeGroup" style="display: ${settings.showReference !== false ? 'block' : 'none'}">
                    <label for="referenceFontSize">Reference font size (px):</label>
                    <input type="number" id="referenceFontSize" min="8" max="20" value="${settings.referenceFontSize || 12}">
                    <div class="help-text">Font size for reference sequence text.</div>
                </div>
                <div class="form-group" id="referenceFontFamilyGroup" style="display: ${settings.showReference !== false ? 'block' : 'none'}">
                    <label for="referenceFontFamily">Reference font family:</label>
                    <select id="referenceFontFamily">
                        <option value="monospace" ${(settings.referenceFontFamily || 'monospace') === 'monospace' ? 'selected' : ''}>Monospace</option>
                        <option value="Courier New, monospace" ${settings.referenceFontFamily === 'Courier New, monospace' ? 'selected' : ''}>Courier New</option>
                        <option value="Consolas, monospace" ${settings.referenceFontFamily === 'Consolas, monospace' ? 'selected' : ''}>Consolas</option>
                    </select>
                    <div class="help-text">Font family for reference sequence display.</div>
                </div>
            </div>
            <div class="settings-section">
                <h4>Rendering Method</h4>
                <div class="form-group">
                    <label for="readsRenderingMode">Rendering method:</label>
                    <select id="readsRenderingMode">
                        <option value="canvas" ${settings.renderingMode === 'canvas' ? 'selected' : ''}>Canvas (High Performance)</option>
                        <option value="svg" ${settings.renderingMode === 'svg' ? 'selected' : ''}>SVG (Legacy)</option>
                    </select>
                    <div class="help-text">Choose rendering method. Canvas provides better performance for large datasets, while SVG maintains DOM interaction capabilities. <strong>Click Apply to apply changes.</strong></div>
                </div>
            </div>
            <div class="settings-section">
                <h4>Read Display</h4>
                <div class="form-group">
                    <label for="readsHeight">Height of each read (px):</label>
                    <input type="number" id="readsHeight" min="2" max="30" value="${settings.readHeight || 4}">
                    <div class="help-text">Height of individual read elements in pixels.</div>
                </div>
                <div class="form-group">
                    <label for="readsSpacing">Spacing between reads (px):</label>
                    <input type="number" id="readsSpacing" min="1" max="10" value="${settings.readSpacing || 2}">
                    <div class="help-text">Vertical spacing between read rows.</div>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="readsEnableVerticalScroll" ${settings.enableVerticalScroll === true ? 'checked' : ''}>
                        Enable vertical scrolling
                    </label>
                    <div class="help-text">Enable vertical scrolling when reads exceed the maximum visible rows. When disabled, excess reads are simply hidden.</div>
                </div>
                <div class="form-group" id="readsMaxVisibleRowsGroup" style="display: ${settings.enableVerticalScroll === true ? 'block' : 'none'}">
                    <label for="readsMaxVisibleRows">Maximum visible rows (scrollable):</label>
                    <input type="number" id="readsMaxVisibleRows" min="5" max="30" value="${settings.maxVisibleRows || 10}">
                    <div class="help-text">Maximum number of read rows visible at once when scrolling is enabled. Additional rows can be accessed by scrolling.</div>
                </div>
                <div class="form-group" id="readsMaxRowsGroup" style="display: ${settings.enableVerticalScroll === true ? 'none' : 'block'}">
                    <label for="readsMaxRows">Maximum visible rows:</label>
                    <input type="number" id="readsMaxRows" min="5" max="50" value="${settings.maxRows || 20}">
                    <div class="help-text">Maximum number of read rows to display. Additional reads will be hidden to improve performance.</div>
                </div>
                <div class="form-group">
                    <label for="readsTrackHeight">Track Height (px):</label>
                    <input type="number" id="readsTrackHeight" min="100" max="500" value="${settings.height || 150}">
                    <div class="help-text">Total height of the reads track container.</div>
                </div>
            </div>
            <div class="settings-section">
                <h4>Read Sampling (Performance)</h4>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="readsEnableSampling" ${settings.enableSampling !== false ? 'checked' : ''}>
                        Enable read sampling for large datasets
                    </label>
                    <div class="help-text">Automatically sample reads when the number exceeds the threshold to improve performance.</div>
                </div>
                <div class="form-group">
                    <label for="readsSamplingThreshold">Sampling threshold:</label>
                    <input type="number" id="readsSamplingThreshold" min="1000" max="100000" step="1000" value="${settings.samplingThreshold || 10000}">
                    <div class="help-text">Number of reads above which sampling will be applied. Default: 10,000 reads.</div>
                </div>
                <div class="form-group">
                    <label for="readsSamplingMode">Sampling mode:</label>
                    <select id="readsSamplingMode">
                        <option value="percentage" ${(settings.samplingMode || 'percentage') === 'percentage' ? 'selected' : ''}>Percentage-based</option>
                        <option value="fixed" ${settings.samplingMode === 'fixed' ? 'selected' : ''}>Fixed count</option>
                    </select>
                    <div class="help-text">Choose whether to sample by percentage or fixed number of reads.</div>
                </div>
                <div class="form-group" id="readsSamplingPercentageGroup" style="display: ${(settings.samplingMode || 'percentage') === 'percentage' ? 'block' : 'none'}">
                    <label for="readsSamplingPercentage">Sampling percentage (%):</label>
                    <input type="number" id="readsSamplingPercentage" min="1" max="100" value="${settings.samplingPercentage || 20}">
                    <div class="help-text">Percentage of reads to randomly sample when threshold is exceeded. Default: 20%.</div>
                </div>
                <div class="form-group" id="readsSamplingCountGroup" style="display: ${settings.samplingMode === 'fixed' ? 'block' : 'none'}">
                    <label for="readsSamplingCount">Maximum reads to display:</label>
                    <input type="number" id="readsSamplingCount" min="1000" max="50000" step="1000" value="${settings.samplingCount || 5000}">
                    <div class="help-text">Maximum number of reads to display when sampling is active. Default: 5,000 reads.</div>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="readsShowSamplingInfo" ${settings.showSamplingInfo !== false ? 'checked' : ''}>
                        Show sampling information in track statistics
                    </label>
                    <div class="help-text">Display information about sampling in the track statistics panel.</div>
                </div>
            </div>
            <div class="settings-section">
                <h4>Colors & Styles</h4>
                <div class="form-group">
                    <label for="readsForwardColor">Forward reads fill color:</label>
                    <input type="color" id="readsForwardColor" value="${settings.forwardColor || '#00b894'}">
                    <div class="help-text">Fill color for reads on the forward strand.</div>
                </div>
                <div class="form-group">
                    <label for="readsReverseColor">Reverse reads fill color:</label>
                    <input type="color" id="readsReverseColor" value="${settings.reverseColor || '#f39c12'}">
                    <div class="help-text">Fill color for reads on the reverse strand.</div>
                </div>
                <div class="form-group">
                    <label for="readsPairedColor">Paired reads fill color:</label>
                    <input type="color" id="readsPairedColor" value="${settings.pairedColor || '#6c5ce7'}">
                    <div class="help-text">Fill color for properly paired reads.</div>
                </div>
                <div class="form-group">
                    <label for="readsBorderColor">Border color:</label>
                    <input type="color" id="readsBorderColor" value="${settings.borderColor || '#ffffff'}">
                    <div class="help-text">Border color for all read elements.</div>
                </div>
                <div class="form-group">
                    <label for="readsBorderWidth">Border width (px):</label>
                    <input type="number" id="readsBorderWidth" min="0" max="3" step="0.5" value="${settings.borderWidth || 0}">
                    <div class="help-text">Width of the border around read elements. Set to 0 for no border.</div>
                </div>
                <div class="form-group">
                    <label for="readsOpacity">Read opacity (0-1):</label>
                    <input type="number" id="readsOpacity" min="0.1" max="1" step="0.1" value="${settings.opacity || 0.9}">
                    <div class="help-text">Transparency level of read elements. 1.0 = fully opaque, 0.1 = very transparent.</div>
                </div>
            </div>
            <div class="settings-section">
                <h4>Read Sequence Display</h4>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="readsShowSequences" ${settings.showSequences !== false ? 'checked' : ''}>
                        Show read sequences when zoomed in
                    </label>
                    <div class="help-text">Display individual read sequences and reference sequence when the zoom level is sufficient.</div>
                </div>
                <div class="form-group" id="readsForceSequencesGroup" style="display: ${settings.showSequences ? 'block' : 'none'}">
                    <label>
                        <input type="checkbox" id="readsForceSequences" ${settings.forceSequences ? 'checked' : ''}>
                        Force show sequences (ignore zoom threshold)
                    </label>
                    <div class="help-text">Always show sequences regardless of zoom level, with automatic font sizing for optimal readability.</div>
                </div>
                <div class="form-group" id="readsAutoFontSizeGroup" style="display: ${settings.showSequences && settings.forceSequences ? 'block' : 'none'}">
                    <label>
                        <input type="checkbox" id="readsAutoFontSize" ${settings.autoFontSize !== false ? 'checked' : ''}>
                        Auto-calculate font size
                    </label>
                    <div class="help-text">Automatically calculate optimal font size based on available space and sequence density.</div>
                </div>
                <div class="form-group" id="readsSequenceThresholdGroup" style="display: ${settings.showSequences && !settings.forceSequences ? 'block' : 'none'}">
                    <label for="readsSequenceThreshold">Sequence display threshold (bp/px):</label>
                    <input type="number" id="readsSequenceThreshold" min="0.1" max="10" step="0.1" value="${settings.sequenceThreshold || 1.0}">
                    <div class="help-text">Maximum bases per pixel to trigger sequence display. Lower values require more zoom. Default: 1.0 bp/px.</div>
                </div>
                <div class="form-group" id="readsAutoFontSizeGroup" style="display: ${settings.showSequences ? 'block' : 'none'}">
                    <label>
                        <input type="checkbox" id="readsAutoFontSize" ${settings.autoFontSize !== false ? 'checked' : ''}>
                        Auto-adjust font size for optimal display
                    </label>
                    <div class="help-text">Automatically calculate the best font size for sequence display based on zoom level and available space. Default: enabled.</div>
                </div>
                <div class="form-group" id="readsSequenceFontSizeGroup" style="display: ${settings.showSequences ? 'block' : 'none'}">
                    <label for="readsSequenceFontSize">Sequence font size (px):</label>
                    <input type="number" id="readsSequenceFontSize" min="8" max="16" value="${settings.sequenceFontSize || 10}">
                    <div class="help-text">Font size for sequence text. Smaller fonts allow more sequences to fit.</div>
                </div>
                <div class="form-group" id="readsSequenceHeightGroup" style="display: ${settings.showSequences ? 'block' : 'none'}">
                    <label for="readsSequenceHeight">Sequence text height (px):</label>
                    <input type="number" id="readsSequenceHeight" min="10" max="30" value="${settings.sequenceHeight || 14}">
                    <div class="help-text">Height of each sequence text line. Should be slightly larger than font size.</div>
                </div>
                <div class="form-group" id="readsHighlightMismatchesGroup" style="display: ${settings.showSequences ? 'block' : 'none'}">
                    <label>
                        <input type="checkbox" id="readsHighlightMismatches" ${settings.highlightMismatches !== false ? 'checked' : ''}>
                        Highlight mismatches
                    </label>
                    <div class="help-text">Highlight bases that differ from the reference sequence.</div>
                </div>
                <div class="form-group" id="readsMismatchColorGroup" style="display: ${settings.showSequences && settings.highlightMismatches !== false ? 'block' : 'none'}">
                    <label for="readsMismatchColor">Mismatch highlight color:</label>
                    <input type="color" id="readsMismatchColor" value="${settings.mismatchColor || '#ff6b6b'}">
                    <div class="help-text">Color used to highlight mismatched bases.</div>
                </div>
            </div>
            <div class="settings-section">
                <h4>Advanced Options</h4>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="readsShowDirectionArrows" ${settings.showDirectionArrows ? 'checked' : ''}>
                        Show direction arrows
                    </label>
                    <div class="help-text">Display small arrows indicating read direction for reads that are wide enough.</div>
                </div>

                <div class="form-group">
                    <label>
                        <input type="checkbox" id="readsShowQualityColors" ${settings.showQualityColors ? 'checked' : ''}>
                        Color by mapping quality
                    </label>
                    <div class="help-text">Color reads based on their mapping quality scores instead of strand direction.</div>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="readsShowMutations" ${settings.showMutations ? 'checked' : ''}>
                        Show mutations
                    </label>
                    <div class="help-text">Display mutations as colored vertical lines on reads. Shows insertions (red), deletions (cyan), and mismatches (yellow).</div>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="readsIgnoreChromosome" ${settings.ignoreChromosome ? 'checked' : ''}>
                        Ignore chromosome information
                    </label>
                    <div class="help-text">Force display reads based on position only, ignoring chromosome mismatch. Useful for reads with missing or incorrect chromosome information.</div>
                </div>
                <div class="form-group">
                    <label for="readsMinWidth">Minimum read width (px):</label>
                    <input type="number" id="readsMinWidth" min="1" max="10" value="${settings.minWidth || 2}">
                    <div class="help-text">Minimum width for very short reads to ensure they remain visible.</div>
                </div>
                <div class="form-group">
                    <label for="readsStreamingThreshold">Streaming threshold (MB):</label>
                    <input type="number" id="readsStreamingThreshold" min="10" max="1000" value="${settings.streamingThreshold || 50}">
                    <div class="help-text">File size threshold in MB above which SAM files will be loaded using streaming mode for better memory management.</div>
                </div>
                <div class="form-group">
                    <label for="readsMinMappingQuality">Minimum mapping quality:</label>
                    <input type="number" id="readsMinMappingQuality" min="0" max="60" value="${settings.minMappingQuality || 0}">
                    <div class="help-text">Minimum mapping quality (MAPQ) required for reads to be displayed. Set to 0 to show all reads regardless of quality.</div>
            </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="readsShowUnmapped" ${settings.showUnmapped ? 'checked' : ''}>
                        Show unmapped reads
                    </label>
                    <div class="help-text">Include unmapped reads in the display (reads with mapping quality 0 and unmapped flag).</div>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="readsShowSecondary" ${settings.showSecondary !== false ? 'checked' : ''}>
                        Show secondary alignments
                    </label>
                    <div class="help-text">Include secondary alignments (reads with flag 256).</div>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="readsShowSupplementary" ${settings.showSupplementary !== false ? 'checked' : ''}>
                        Show supplementary alignments
                    </label>
                    <div class="help-text">Include supplementary alignments (reads with flag 2048).</div>
                </div>
            </div>
            
            <script>
                // Add event listener for sampling mode change and vertical scroll toggle
                document.addEventListener('DOMContentLoaded', function() {
                    const samplingModeSelect = document.getElementById('readsSamplingMode');
                    if (samplingModeSelect) {
                        samplingModeSelect.addEventListener('change', function() {
                            const mode = this.value;
                            const percentageGroup = document.getElementById('readsSamplingPercentageGroup');
                            const countGroup = document.getElementById('readsSamplingCountGroup');
                            
                            if (mode === 'percentage') {
                                percentageGroup.style.display = 'block';
                                countGroup.style.display = 'none';
                            } else {
                                percentageGroup.style.display = 'none';
                                countGroup.style.display = 'block';
                            }
                        });
                    }
                    
                    // Handle vertical scroll toggle
                    const verticalScrollCheckbox = document.getElementById('readsEnableVerticalScroll');
                    if (verticalScrollCheckbox) {
                        verticalScrollCheckbox.addEventListener('change', function() {
                            const isEnabled = this.checked;
                            const maxVisibleRowsGroup = document.getElementById('readsMaxVisibleRowsGroup');
                            const maxRowsGroup = document.getElementById('readsMaxRowsGroup');
                            
                            if (isEnabled) {
                                maxVisibleRowsGroup.style.display = 'block';
                                maxRowsGroup.style.display = 'none';
                            } else {
                                maxVisibleRowsGroup.style.display = 'none';
                                maxRowsGroup.style.display = 'block';
                            }
                        });
                    }
                });
            </script>
        `;
  }

  /**
   * Create default settings content for other tracks
   */
  createDefaultSettingsContent(trackType, settings) {
    // Blast-specific settings
    if (trackType === 'blast') {
      return `
                <div class="settings-section">
                    <h4>BLAST Track Settings</h4>
                    <div class="form-group">
                        <label for="blastTrackHeight">Track Height (px):</label>
                        <input type="number" id="blastTrackHeight" min="50" max="300" value="${settings.height || 120}">
                    </div>
                    <div class="form-group">
                        <label for="blastShowRuler">
                            <input type="checkbox" id="blastShowRuler" ${settings.showRuler ? 'checked' : ''}>
                            Show Track Ruler
                        </label>
                    </div>
                    <div class="form-group">
                        <label for="blastResultHeight">Result Height (px):</label>
                        <input type="number" id="blastResultHeight" min="8" max="30" value="${settings.resultHeight || 12}">
                    </div>
                    <div class="form-group">
                        <label for="blastResultSpacing">Result Spacing (px):</label>
                        <input type="number" id="blastResultSpacing" min="5" max="30" value="${settings.resultSpacing || 14}">
                    </div>
                </div>
            `;
    }

    // Default settings for other track types
    return `
            <div class="settings-section">
                <h4>Basic Settings</h4>
                <div class="form-group">
                    <label for="defaultTrackHeight">Track Height (px):</label>
                    <input type="number" id="defaultTrackHeight" min="50" max="300" value="${settings.height || 80}">
                </div>
                <p>More settings for ${trackType} track can be added here.</p>
            </div>
        `;
  }

  /**
   * Get current settings for a track
   */
  /**
   * Build the instance-level settings key.
   * Format: 'trackType' (no fileId) or 'trackType::fileId' (with fileId).
   */
  _instanceSettingsKey(trackType, fileId = null) {
    return fileId ? `${trackType}::${fileId}` : trackType;
  }

  getTrackSettings(trackType, fileId = null) {
    const instanceKey = this._instanceSettingsKey(trackType, fileId);
    console.log(`🔍 [getTrackSettings] Getting settings for ${instanceKey}`);

    // First check if we have instance-level saved settings
    if (fileId && this.trackSettings && this.trackSettings[instanceKey]) {
      console.log(`🔍 [getTrackSettings] Using instance-level settings for ${instanceKey}`);
      // Merge type-level defaults with instance overrides
      const typeDefaults = this.trackSettings[trackType] || this._getDefaultTrackSettings(trackType);
      return { ...typeDefaults, ...this.trackSettings[instanceKey] };
    }

    // Then check if we have type-level saved settings from applySettingsToTrack
    if (this.trackSettings && this.trackSettings[trackType]) {
      console.log(`🔍 [getTrackSettings] Using saved ${trackType} track settings:`, this.trackSettings[trackType]);
      console.log(`🔍 [getTrackSettings] Saved renderingMode: ${this.trackSettings[trackType].renderingMode}`);
      console.log(
        `🔍 [getTrackSettings] showReference from saved settings: ${this.trackSettings[trackType].showReference}`
      );
      return this.trackSettings[trackType];
    } else {
      console.log(`🔍 [getTrackSettings] No saved settings found for ${trackType}, using defaults`);
    }

    // Get settings from ConfigManager or default values
    return this._getDefaultTrackSettingsWithFallback(trackType);
  }

  /**
   * Get default track settings (inline definition)
   */
  _getDefaultTrackSettings(trackType) {
    const defaultSettings = {
      genes: {
        maxRows: 6,
        showOperonsSameRow: false,
        height: 120, // Default track height
        geneHeight: 24, // Updated default to 24px as requested
        displayType: 'standard',
        fontSize: 24, // Updated default to 24px as requested
        geneNameColor: '#333333', // Default gene name color
        fontFamily: 'Arial, sans-serif',
        layoutMode: 'compact', // 'compact' or 'groupByType'
        enableGlobalDragging: this.genomeBrowser?.generalSettingsManager?.getSettings()?.enableGlobalDragging !== false, // Inherit from global setting, default to true
        highlightEffect: 'pulse', // 'pulse', 'border', 'both'
        autoHighlightSequence: false, // Auto-highlight sequence region when gene is selected
        showSequence: false, // Show reference sequence
        sequenceHeight: 25, // Height of reference sequence display
        renderingMode: 'svg', // 'svg' or 'canvas'
        circularMode: false, // Circular browsing mode for wraparound navigation
        wheelZoomSensitivity: 0.1, // Mouse wheel zoom sensitivity
        overrideGlobalZoom: false, // Override global zoom settings
        maxBorderWidth: 1, // Maximum border width for gene elements
      },

      sequence: {
        visible: true,
        height: 60,
        displayMode: 'letters',
        showCoordinates: true,
        fontSize: 12,
        renderingMode: 'canvas', // Default rendering mode for sequence track
      },
      sequenceLine: {
        fontSize: 14,
        fontFamily: 'Courier New, monospace',
        maxHeight: 50,
        adaptiveHeight: true,
        showProteinTranslation: false,
        proteinTranslationMode: 'all_frames',
        proteinFramesToShow: [1, 2, 3],
        proteinFontSize: 12,
      },
      gc: {
        contentColor: '#3b82f6',
        skewPositiveColor: '#10b981',
        skewNegativeColor: '#ef4444',
        lineWidth: 2,
        height: 140,
      },
      variants: {
        height: 80,
        elementHeight: 12,
        rowSpacing: 8,
        colorMode: 'type', // 'type', 'impact', 'quality', 'custom'
        customColor: '#e74c3c',
        // Type colors
        snpColor: '#e74c3c',
        indelColor: '#3498db',
        svColor: '#9b59b6',
        // Impact colors
        highImpactColor: '#e74c3c',
        moderateImpactColor: '#f39c12',
        lowImpactColor: '#2ecc71',
        modifierImpactColor: '#95a5a6',
        // Filtering
        minQuality: 0,
        maxDisplayCount: 200,
        // Labels
        showLabels: true,
        labelFontSize: 10,
        // Multi-VCF
        groupByFile: false,
        fileSpacing: 10,
      },
      reads: {
        readHeight: 4,
        readSpacing: 2,
        maxRows: 20,
        forwardColor: '#00b894',
        reverseColor: '#f39c12',
        pairedColor: '#6c5ce7',
        borderColor: '#ffffff',
        borderWidth: 0,
        opacity: 0.9,
        showDirectionArrows: true,
        showQualityColors: false,
        ignoreChromosome: false,
        minWidth: 2,
        height: 150,
        streamingThreshold: 50,
        minMappingQuality: 0,
        showUnmapped: false,
        showSecondary: true,
        showSupplementary: true,
        // Sampling settings
        enableSampling: true,
        samplingThreshold: 10000,
        samplingMode: 'percentage',
        samplingPercentage: 20,
        samplingCount: 5000,
        showSamplingInfo: true,
        // Rendering method (use Canvas by default for better performance)
        renderingMode: 'canvas',
        // Coverage visualization settings
        showCoverage: true,
        coverageHeight: 50,
        coverageColor: '#4a90e2',
        coverageStrokeColor: '#2c5aa0',
        // Reference sequence settings
        showReference: true,
        referenceHeight: 25,
        referenceFontSize: 12,
        referenceFontFamily: 'monospace',
        // Sequence display settings
        showSequences: true,
        forceSequences: false,
        autoFontSize: true,
        sequenceThreshold: 1.0,
        sequenceFontSize: 6,
        sequenceHeight: 6,
        highlightMismatches: true,
        showMismatches: true,
        mismatchColor: '#ff6b6b',
        sequenceFontFamily: 'monospace',
      },
      blast: {
        // Rendering method
        renderingMode: 'svg',
        // Track settings
        height: 120,
        // Ruler settings - default to false to hide ruler
        showRuler: false,
        // Blast result settings
        resultHeight: 12,
        resultSpacing: 14,
        startYPosition: 40, // Start rendering results below the 35px ruler
      },
      actions: {
        actionHeight: 10, // Height of each action element in pixels
        rowSpacing: 2, // Spacing between action rows
        topPadding: 5, // Top padding for action track
        bottomPadding: 5, // Bottom padding for action track
        height: 120, // Total track height
        fontSize: 10, // Font size for action text
        fontFamily: 'Arial, sans-serif',
      },
    };

    return defaultSettings[trackType] || {};
  }

  /**
   * Get default track settings with ConfigManager/localStorage fallback.
   * This is the full resolution chain: defaults → persisted → merged.
   * Used by getTrackSettings when no in-memory settings exist.
   */
  _getDefaultTrackSettingsWithFallback(trackType) {
    const defaultSettings = this._getDefaultTrackSettings(trackType);

    // Try to get saved settings from ConfigManager or localStorage
    let savedSettings = {};
    if (this.genomeBrowser.configManager) {
      savedSettings = this.genomeBrowser.configManager.get(`tracks.${trackType}.settings`) || {};
    } else {
      const stored = localStorage.getItem(`trackSettings_${trackType}`);
      if (stored) {
        try {
          savedSettings = JSON.parse(stored);
        } catch (e) {
          console.warn('Failed to parse saved track settings:', e);
        }
      }
    }

    return { ...defaultSettings, ...savedSettings };
  }

  /**
   * Apply track settings
   */
  applyTrackSettings() {
    console.log('🔧 [DEBUG] applyTrackSettings called');
    const modal = document.getElementById('trackSettingsModal');
    const trackType = modal.dataset.trackType;

    console.log('🔧 [DEBUG] Track type:', trackType);
    if (!trackType) {
      console.error('🔧 [DEBUG] No track type found!');
      return;
    }

    const fileId = modal.dataset.fileId || null;
    console.log('🔧 [DEBUG] File ID:', fileId);

    const settings = this.collectSettingsFromModal(trackType, modal);
    console.log('🔧 [DEBUG] Collected settings:', settings);
    console.log('🔧 [DEBUG] renderingMode in settings:', settings.renderingMode);

    this.saveTrackSettings(trackType, settings, fileId);

    // Apply settings immediately
    this.applySettingsToTrack(trackType, settings, fileId);

    // Close modal
    modal.classList.remove('show');
  }

  /**
   * Open Feature Glyph Legend modal
   */
  openFeatureGlyphLegend() {
    let modal = document.getElementById('featureGlyphLegendModal');
    if (!modal) {
      modal = this.createFeatureGlyphLegendModal();
      document.body.appendChild(modal);
      // Render canvas previews after the modal is in the DOM
      requestAnimationFrame(() => this.renderGlyphLegendPreviews(modal));
    }

    // Reset any drag inline styles so the modal re-centers on open
    if (window.modalDragManager) {
      window.modalDragManager.resetPosition('#featureGlyphLegendModal');
    }

    modal.classList.add('show');
  }

  /**
   * Create Feature Glyph Legend modal
   */
  createFeatureGlyphLegendModal() {
    const modal = document.createElement('div');
    modal.id = 'featureGlyphLegendModal';
    modal.className = 'modal';

    // Define all feature types with descriptions
    const entries = [
      {
        name: 'CDS (Forward)',
        type: 'CDS',
        strand: 1,
        description: 'Protein-coding sequence on the forward strand. Displayed as a right-pointing arrow.',
      },
      {
        name: 'CDS (Reverse)',
        type: 'CDS',
        strand: -1,
        description: 'Protein-coding sequence on the reverse strand. Displayed as a left-pointing arrow.',
      },
      {
        name: 'Gene',
        type: 'gene',
        strand: 1,
        description: 'General gene feature with a directional arrow shape.',
      },
      {
        name: 'mRNA',
        type: 'mRNA',
        strand: 1,
        description: 'Messenger RNA transcript displayed as a sine wave / wavy shape.',
      },
      {
        name: 'tRNA',
        type: 'tRNA',
        strand: 1,
        description: 'Transfer RNA gene displayed as a chevron / hexagonal shape with gradient.',
      },
      {
        name: 'rRNA',
        type: 'rRNA',
        strand: 1,
        description: 'Ribosomal RNA gene displayed as a capsule / pill shape with decorative stripes.',
      },
      {
        name: 'Promoter',
        type: 'promoter',
        strand: 1,
        description: 'Promoter region shown as a circle at origin with a directional arrow extending upward.',
      },
      {
        name: 'Terminator',
        type: 'terminator',
        strand: 1,
        description: 'Terminator region displayed as a lollipop shape (vertical stem + filled circle at top).',
      },
      {
        name: 'Regulatory',
        type: 'regulatory',
        strand: 1,
        description: 'Regulatory element displayed as a diamond / rhombus shape.',
      },
      {
        name: 'Repeat Region',
        type: 'repeat_region',
        strand: 1,
        description: 'Repeat region displayed as stacked horizontal capsule shapes in red.',
      },
      {
        name: 'Comment / Note',
        type: 'comment',
        strand: 1,
        description: 'Comment or annotation feature displayed as a speech bubble with three dots inside.',
      },
      {
        name: 'Misc Feature',
        type: 'misc_feature',
        strand: 1,
        description: 'Miscellaneous feature displayed as a speech bubble with three dots inside.',
      },
      {
        name: 'Operon',
        type: 'operon',
        strand: 0,
        description: 'Multiple co-transcribed genes displayed on the same row, each as a directional arrow.',
      },
    ];

    modal.innerHTML = `
      <div class="modal-content resizable" style="max-width: 950px; max-height: 85vh;">
        <div class="modal-header">
          <h3 id="featureGlyphLegendTitle">
            <i class="fas fa-shapes"></i> Feature Glyph Legend
          </h3>
          <div class="modal-controls">
            <button class="modal-close" id="closeFeatureGlyphLegendModal">&times;</button>
          </div>
        </div>
        <div class="modal-body" id="featureGlyphLegendBody" style="max-height: calc(85vh - 140px); overflow-y: auto;">
          <div style="margin-bottom: 20px; color: var(--text-secondary); font-size: 14px;">
            <p>Reference guide showing how each feature type is rendered in the Genes &amp; Features track. Previews are generated using the same rendering engine as the actual track.</p>
          </div>
          <div id="glyphLegendGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;">
            ${entries
              .map(
                entry => `
              <div class="glyph-legend-item" style="
                background: var(--bg-secondary);
                border: 1px solid var(--border-color);
                border-radius: var(--radius-md);
                padding: 14px;
                display: flex;
                flex-direction: column;
                gap: 10px;
                transition: transform 0.2s ease, box-shadow 0.2s ease;
              ">
                <div class="glyph-preview-container" data-glyph-type="${entry.type}" data-glyph-strand="${entry.strand}" style="
                  background: white;
                  border: 1px solid #e9ecef;
                  border-radius: 4px;
                  padding: 10px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  min-height: 70px;
                  overflow: hidden;
                ">
                </div>
                <div>
                  <h4 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: var(--text-primary);">${entry.name}</h4>
                  <p style="margin: 0; font-size: 12px; color: var(--text-secondary); line-height: 1.5;">${entry.description}</p>
                  <div style="
                    margin-top: 6px;
                    font-size: 10px;
                    color: #6c757d;
                    font-family: monospace;
                    padding: 3px 7px;
                    background: #f8f9fa;
                    border-radius: 3px;
                    display: inline-block;
                  ">Type: ${entry.type}</div>
                </div>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary modal-close">Close</button>
        </div>
      </div>
    `;

    // Event listeners
    modal.addEventListener('click', e => {
      if (e.target.classList.contains('modal-close')) {
        modal.classList.remove('show');
      }
    });

    // Hover effects
    modal.addEventListener('mouseover', e => {
      const item = e.target.closest('.glyph-legend-item');
      if (item) {
        item.style.transform = 'translateY(-2px)';
        item.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
      }
    });
    modal.addEventListener('mouseout', e => {
      const item = e.target.closest('.glyph-legend-item');
      if (item) {
        item.style.transform = '';
        item.style.boxShadow = '';
      }
    });

    // Drag and resize
    if (window.modalDragManager) {
      window.modalDragManager.makeDraggable('#featureGlyphLegendModal');
    }
    if (window.resizableModalManager) {
      window.resizableModalManager.makeResizable('#featureGlyphLegendModal');
    }

    return modal;
  }

  /**
   * Render Canvas-based glyph previews in the legend modal
   * Uses the actual CanvasGenesRenderer drawing methods for visual parity
   */
  renderGlyphLegendPreviews(modal) {
    const containers = modal.querySelectorAll('.glyph-preview-container');
    containers.forEach(container => {
      const type = container.dataset.glyphType;
      const strand = parseInt(container.dataset.glyphStrand) || 1;

      if (type === 'operon') {
        this.renderOperonPreview(container);
        return;
      }

      const canvas = this.createGlyphCanvas(type, strand);
      if (canvas) {
        container.appendChild(canvas);
      }
    });
  }

  /**
   * Create a canvas element with a rendered feature glyph
   * Reuses the actual SVG shape rendering from TrackRenderer for exact visual parity
   */
  createGlyphCanvas(type, strand) {
    const previewWidth = 220;
    const previewHeight = 50;
    const geneWidth = type === 'regulatory' ? 50 : 120;
    const geneHeight = 14;

    // Create SVG that matches what the track actually renders
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', previewWidth);
    svg.setAttribute('height', previewHeight);
    svg.setAttribute('viewBox', `0 0 ${previewWidth} ${previewHeight}`);
    svg.style.display = 'block';

    // Create defs for gradients
    const defs = document.createElementNS(svgNS, 'defs');
    this.createSpecializedGradients(defs);
    svg.appendChild(defs);

    // Create a mock gene object
    const mockGene = {
      type: type,
      strand: strand,
      start: 0,
      end: geneWidth,
      qualifiers: {},
    };

    // Get operon info with default color
    const operonInfo = this.getGlyphOperonInfo(type);

    // Calculate gradient ID
    const gradientId = this.getGlyphGradientId(type);

    // Create a group for the gene shape, centered in the preview
    const group = document.createElementNS(svgNS, 'g');
    const offsetX = (previewWidth - geneWidth) / 2;
    const offsetY = (previewHeight - geneHeight) / 2;
    group.setAttribute('transform', `translate(${offsetX}, ${offsetY})`);

    // Create the shape using the same method as the actual track
    const geneType = type.toLowerCase();
    const strokeWidth = 1;

    if (this.shouldUseSpecializedShape(geneType)) {
      const shape = this.createSpecializedGeneShape(
        mockGene,
        geneWidth,
        geneHeight,
        gradientId,
        operonInfo,
        false, // not truncated
        false,
        strokeWidth
      );
      if (shape) {
        group.appendChild(shape);
      }
    } else {
      // Standard gene (CDS, gene) - use arrow shape
      const shape = this.createSVGGeneShape(
        mockGene,
        geneWidth,
        geneHeight,
        `gene-gradient-glyph-${type}-${strand}`,
        operonInfo,
        false,
        false,
        strokeWidth
      );
      if (shape) {
        // Create the gradient for this specific gene
        const geneGrad = document.createElementNS(svgNS, 'linearGradient');
        geneGrad.setAttribute('id', `gene-gradient-glyph-${type}-${strand}`);
        geneGrad.setAttribute('x1', '0%');
        geneGrad.setAttribute('y1', '0%');
        geneGrad.setAttribute('x2', '100%');
        geneGrad.setAttribute('y2', '100%');
        const s1 = document.createElementNS(svgNS, 'stop');
        s1.setAttribute('offset', '0%');
        s1.setAttribute('stop-color', operonInfo.color);
        const s2 = document.createElementNS(svgNS, 'stop');
        s2.setAttribute('offset', '100%');
        s2.setAttribute('stop-color', this.lightenColor(operonInfo.color, 20));
        geneGrad.appendChild(s1);
        geneGrad.appendChild(s2);
        defs.appendChild(geneGrad);
        group.appendChild(shape);
      }
    }

    svg.appendChild(group);

    // Add strand direction label below the shape
    if (geneType === 'cds' || geneType === 'gene') {
      const label = document.createElementNS(svgNS, 'text');
      label.setAttribute('x', previewWidth / 2);
      label.setAttribute('y', previewHeight - 2);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-size', '10');
      label.setAttribute('fill', '#888');
      label.textContent = strand === 1 ? '→ Forward strand' : '← Reverse strand';
      svg.appendChild(label);
    }

    return svg;
  }

  /**
   * Get operon info (color) for a glyph type in the legend
   */
  getGlyphOperonInfo(type) {
    const colorMap = {
      cds: '#3b82f6',
      gene: '#6366f1',
      mrna: '#4ade80',
      trna: '#65a30d',
      rrna: '#059669',
      promoter: '#a855f7',
      terminator: '#ef4444',
      regulatory: '#f97316',
      repeat_region: '#ef4444',
      comment: '#7c3aed',
      note: '#7c3aed',
      misc_feature: '#7c3aed',
    };
    const color = colorMap[type.toLowerCase()] || '#6366f1';
    return { color: color, operonName: null };
  }

  /**
   * Get the gradient ID for a feature type in the legend
   */
  getGlyphGradientId(type) {
    const gradientMap = {
      promoter: 'promoter-gradient',
      terminator: 'terminator-gradient',
      regulatory: 'regulatory-gradient',
      repeat_region: 'repeat-gradient',
      trna: 'trna-gradient',
      rrna: 'rrna-gradient',
      mrna: 'mrna-gradient',
      comment: 'comment-gradient',
      note: 'comment-gradient',
      misc_feature: 'comment-gradient',
    };
    return gradientMap[type.toLowerCase()] || null;
  }

  /**
   * Render operon preview with multiple genes on the same row
   */
  renderOperonPreview(container) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const previewWidth = 220;
    const previewHeight = 50;

    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', previewWidth);
    svg.setAttribute('height', previewHeight);
    svg.setAttribute('viewBox', `0 0 ${previewWidth} ${previewHeight}`);
    svg.style.display = 'block';

    // Create defs for gradients
    const defs = document.createElementNS(svgNS, 'defs');
    this.createSpecializedGradients(defs);
    svg.appendChild(defs);

    // Three genes in an operon on the same row
    const geneConfigs = [
      { width: 55, color: '#3b82f6', strand: 1 },
      { width: 65, color: '#6366f1', strand: 1 },
      { width: 50, color: '#8b5cf6', strand: -1 },
    ];
    const gap = 8;
    const geneHeight = 14;
    const totalGenesWidth = geneConfigs.reduce((sum, g) => sum + g.width, 0) + gap * (geneConfigs.length - 1);
    const startX = (previewWidth - totalGenesWidth) / 2;
    const startY = (previewHeight - geneHeight) / 2;

    let x = startX;
    geneConfigs.forEach((cfg, i) => {
      const mockGene = { type: 'CDS', strand: cfg.strand, start: 0, end: cfg.width, qualifiers: {} };
      const operonInfo = { color: cfg.color, operonName: null };

      // Create gradient for this gene
      const gradId = `operon-glyph-grad-${i}`;
      const geneGrad = document.createElementNS(svgNS, 'linearGradient');
      geneGrad.setAttribute('id', gradId);
      geneGrad.setAttribute('x1', '0%');
      geneGrad.setAttribute('y1', '0%');
      geneGrad.setAttribute('x2', '100%');
      geneGrad.setAttribute('y2', '100%');
      const s1 = document.createElementNS(svgNS, 'stop');
      s1.setAttribute('offset', '0%');
      s1.setAttribute('stop-color', cfg.color);
      const s2 = document.createElementNS(svgNS, 'stop');
      s2.setAttribute('offset', '100%');
      s2.setAttribute('stop-color', this.lightenColor(cfg.color, 20));
      geneGrad.appendChild(s1);
      geneGrad.appendChild(s2);
      defs.appendChild(geneGrad);

      const group = document.createElementNS(svgNS, 'g');
      group.setAttribute('transform', `translate(${x}, ${startY})`);

      const shape = this.createSVGGeneShape(mockGene, cfg.width, geneHeight, gradId, operonInfo, false, false, 1);
      if (shape) {
        group.appendChild(shape);
      }
      svg.appendChild(group);
      x += cfg.width + gap;
    });

    container.appendChild(svg);
  }

  /**
   * Collect settings from modal inputs
   */
  collectSettingsFromModal(trackType, modal) {
    const settings = {};

    switch (trackType) {
      case 'genes':
        const renderingModeElement = modal.querySelector('#genesRenderingMode');
        const maxRowsElement = modal.querySelector('#genesMaxRows');
        const showOperonsElement = modal.querySelector('#genesShowOperonsSameRow');
        const heightElement = modal.querySelector('#genesTrackHeight');
        const geneHeightElement = modal.querySelector('#genesGeneHeight');
        const fontSizeElement = modal.querySelector('#genesFontSize');
        const geneNameColorElement = modal.querySelector('#genesGeneNameColor');
        const fontFamilyElement = modal.querySelector('#genesFontFamily');
        const layoutModeElement = modal.querySelector('#genesLayoutMode');
        const enableGlobalDraggingElement = modal.querySelector('#genesEnableGlobalDragging');
        const wheelZoomSensitivityElement = modal.querySelector('#genesWheelZoomSensitivity');
        const overrideGlobalZoomElement = modal.querySelector('#genesOverrideGlobalZoom');
        const showSequenceElement = modal.querySelector('#genesShowSequence');
        const sequenceHeightElement = modal.querySelector('#genesSequenceHeight');
        const highlightEffectElement = modal.querySelector('#genesHighlightEffect');
        const autoHighlightSequenceElement = modal.querySelector('#genesAutoHighlightSequence');

        console.log('Form elements found:', {
          renderingModeElement: !!renderingModeElement,
          maxRowsElement: !!maxRowsElement,
          showOperonsElement: !!showOperonsElement,
          heightElement: !!heightElement,
          geneHeightElement: !!geneHeightElement,
          fontSizeElement: !!fontSizeElement,
          fontFamilyElement: !!fontFamilyElement,
          layoutModeElement: !!layoutModeElement,
          enableGlobalDraggingElement: !!enableGlobalDraggingElement,
          wheelZoomSensitivityElement: !!wheelZoomSensitivityElement,
          overrideGlobalZoomElement: !!overrideGlobalZoomElement,
        });

        settings.renderingMode = renderingModeElement?.value || 'svg';
        settings.maxRows = parseInt(maxRowsElement?.value) || 6;
        settings.showOperonsSameRow = showOperonsElement?.checked || false;
        settings.height = parseInt(heightElement?.value) || 120;
        settings.geneHeight = parseInt(geneHeightElement?.value) || 12;
        settings.geneHeight = parseInt(geneHeightElement?.value) || 12;
        settings.fontSize = parseInt(fontSizeElement?.value) || 11;
        settings.geneNameColor = geneNameColorElement?.value || '#333333';
        settings.fontFamily = fontFamilyElement?.value || 'Arial, sans-serif';
        settings.layoutMode = layoutModeElement?.value || 'expanded';
        settings.enableGlobalDragging = enableGlobalDraggingElement?.checked !== false; // Default to true
        settings.wheelZoomSensitivity = parseFloat(wheelZoomSensitivityElement?.value) || 0.1;
        settings.overrideGlobalZoom = overrideGlobalZoomElement?.checked || false;
        settings.showSequence = showSequenceElement?.checked || false; // Default to false (hidden)
        settings.sequenceHeight = parseInt(sequenceHeightElement?.value) || 25;
        settings.highlightEffect = highlightEffectElement?.value || 'pulse';
        settings.autoHighlightSequence = autoHighlightSequenceElement?.checked || false;

        const maxBorderWidthElement = modal.querySelector('#genesMaxBorderWidth');
        settings.maxBorderWidth = parseFloat(maxBorderWidthElement?.value) || 1;

        const circularModeElement = modal.querySelector('#genesCircularMode');
        settings.circularMode = circularModeElement?.checked || false;

        console.log('Collected gene settings from form:', settings);
        break;

      case 'gc':
        settings.contentColor = modal.querySelector('#gcContentColor').value;
        settings.skewPositiveColor = modal.querySelector('#gcSkewPositiveColor').value;
        settings.skewNegativeColor = modal.querySelector('#gcSkewNegativeColor').value;
        settings.lineWidth = parseFloat(modal.querySelector('#gcLineWidth').value) || 2;
        settings.height = parseInt(modal.querySelector('#gcTrackHeight').value) || 140;
        break;

      case 'reads':
        // Rendering method settings
        const renderingModeSelect = modal.querySelector('#readsRenderingMode');
        settings.renderingMode = renderingModeSelect ? renderingModeSelect.value : 'canvas';

        // Coverage settings
        settings.showCoverage = modal.querySelector('#readsShowCoverage').checked;
        settings.coverageHeight = parseInt(modal.querySelector('#coverageHeight').value) || 50;
        settings.coverageColor = modal.querySelector('#coverageColor').value || '#4a90e2';
        settings.coverageStrokeColor = modal.querySelector('#coverageStrokeColor')?.value || '#2c5aa0';

        // Reference sequence settings
        settings.showReference = modal.querySelector('#readsShowReference').checked;
        settings.referenceFontSize = parseInt(modal.querySelector('#referenceFontSize')?.value) || 12;
        settings.referenceFontFamily = modal.querySelector('#referenceFontFamily')?.value || 'monospace';
        console.log(
          `🔍 [collectSettingsFromModal] Collected showReference: ${settings.showReference} from checkbox checked: ${modal.querySelector('#readsShowReference').checked}`
        );
        settings.referenceHeight = parseInt(modal.querySelector('#referenceHeight').value) || 25;

        settings.readHeight = parseInt(modal.querySelector('#readsHeight').value) || 4;
        settings.readSpacing = parseInt(modal.querySelector('#readsSpacing').value) || 2;
        // Vertical scrolling settings
        settings.enableVerticalScroll = modal.querySelector('#readsEnableVerticalScroll').checked;
        if (settings.enableVerticalScroll) {
          settings.maxVisibleRows = parseInt(modal.querySelector('#readsMaxVisibleRows').value) || 10;
        } else {
          settings.maxRows = parseInt(modal.querySelector('#readsMaxRows').value) || 20;
        }
        settings.forwardColor = modal.querySelector('#readsForwardColor').value;
        settings.reverseColor = modal.querySelector('#readsReverseColor').value;
        settings.pairedColor = modal.querySelector('#readsPairedColor').value;
        settings.borderColor = modal.querySelector('#readsBorderColor').value;
        settings.borderWidth = parseFloat(modal.querySelector('#readsBorderWidth').value) || 0;
        settings.opacity = parseFloat(modal.querySelector('#readsOpacity').value) || 0.9;
        settings.showDirectionArrows = modal.querySelector('#readsShowDirectionArrows').checked;
        settings.showQualityColors = modal.querySelector('#readsShowQualityColors').checked;
        settings.showMutations = modal.querySelector('#readsShowMutations').checked;
        settings.ignoreChromosome = modal.querySelector('#readsIgnoreChromosome').checked;
        settings.minWidth = parseInt(modal.querySelector('#readsMinWidth').value) || 2;
        settings.streamingThreshold = parseInt(modal.querySelector('#readsStreamingThreshold').value) || 50;
        settings.minMappingQuality = parseInt(modal.querySelector('#readsMinMappingQuality').value) || 0;
        settings.showUnmapped = modal.querySelector('#readsShowUnmapped').checked;
        settings.showSecondary = modal.querySelector('#readsShowSecondary').checked;
        settings.showSupplementary = modal.querySelector('#readsShowSupplementary').checked;
        settings.height = parseInt(modal.querySelector('#readsTrackHeight').value) || 150;
        // Sampling settings (with validation/clamping)
        settings.enableSampling = modal.querySelector('#readsEnableSampling').checked;
        settings.samplingThreshold = Math.min(100000, Math.max(1000, parseInt(modal.querySelector('#readsSamplingThreshold').value) || 10000));
        settings.samplingMode = modal.querySelector('#readsSamplingMode').value || 'percentage';
        settings.samplingPercentage = Math.min(100, Math.max(1, parseInt(modal.querySelector('#readsSamplingPercentage').value) || 20));
        settings.samplingCount = Math.min(50000, Math.max(1000, parseInt(modal.querySelector('#readsSamplingCount').value) || 5000));
        settings.showSamplingInfo = modal.querySelector('#readsShowSamplingInfo').checked;

        // Sequence display settings
        settings.showSequences = modal.querySelector('#readsShowSequences').checked;
        settings.forceSequences = modal.querySelector('#readsForceSequences').checked;
        settings.autoFontSize = modal.querySelector('#readsAutoFontSize').checked;
        settings.sequenceThreshold = parseFloat(modal.querySelector('#readsSequenceThreshold').value) || 1.0;
        settings.sequenceFontSize = parseInt(modal.querySelector('#readsSequenceFontSize').value) || 10;
        settings.sequenceHeight = parseInt(modal.querySelector('#readsSequenceHeight').value) || 14;
        settings.highlightMismatches = modal.querySelector('#readsHighlightMismatches').checked;
        settings.showMismatches = modal.querySelector('#readsHighlightMismatches').checked; // Alias for compatibility
        settings.mismatchColor = modal.querySelector('#readsMismatchColor').value;
        break;

      case 'sequence':
        // View Mode settings (traditional sequence view)
        const showIndicatorsEl = modal.querySelector('#sequenceShowIndicators');
        if (showIndicatorsEl) settings.showIndicators = showIndicatorsEl.checked;

        const indicatorHeightEl = modal.querySelector('#sequenceIndicatorHeight');
        if (indicatorHeightEl) settings.indicatorHeight = parseInt(indicatorHeightEl.value) || 8;

        const indicatorOpacityEl = modal.querySelector('#sequenceIndicatorOpacity');
        if (indicatorOpacityEl) settings.indicatorOpacity = parseFloat(indicatorOpacityEl.value) || 0.7;

        const showStartMarkersEl = modal.querySelector('#sequenceShowStartMarkers');
        if (showStartMarkersEl) settings.showStartMarkers = showStartMarkersEl.checked;

        const showEndArrowsEl = modal.querySelector('#sequenceShowEndArrows');
        if (showEndArrowsEl) settings.showEndArrows = showEndArrowsEl.checked;

        const startMarkerWidthEl = modal.querySelector('#sequenceStartMarkerWidth');
        if (startMarkerWidthEl) settings.startMarkerWidth = parseFloat(startMarkerWidthEl.value) || 3;

        const startMarkerHeightEl = modal.querySelector('#sequenceStartMarkerHeight');
        if (startMarkerHeightEl) settings.startMarkerHeight = parseInt(startMarkerHeightEl.value) || 85;

        const arrowSizeEl = modal.querySelector('#sequenceArrowSize');
        if (arrowSizeEl) settings.arrowSize = parseInt(arrowSizeEl.value) || 6;

        const arrowHeightEl = modal.querySelector('#sequenceArrowHeight');
        if (arrowHeightEl) settings.arrowHeight = parseInt(arrowHeightEl.value) || 85;

        const showCDSEl = modal.querySelector('#sequenceShowCDS');
        if (showCDSEl) settings.showCDS = showCDSEl.checked;

        const showRNAEl = modal.querySelector('#sequenceShowRNA');
        if (showRNAEl) settings.showRNA = showRNAEl.checked;

        const showPromoterEl = modal.querySelector('#sequenceShowPromoter');
        if (showPromoterEl) settings.showPromoter = showPromoterEl.checked;

        const showTerminatorEl = modal.querySelector('#sequenceShowTerminator');
        if (showTerminatorEl) settings.showTerminator = showTerminatorEl.checked;

        const showRegulatoryEl = modal.querySelector('#sequenceShowRegulatory');
        if (showRegulatoryEl) settings.showRegulatory = showRegulatoryEl.checked;

        const showTooltipsEl = modal.querySelector('#sequenceShowTooltips');
        if (showTooltipsEl) settings.showTooltips = showTooltipsEl.checked;

        const showHoverEffectsEl = modal.querySelector('#sequenceShowHoverEffects');
        if (showHoverEffectsEl) settings.showHoverEffects = showHoverEffectsEl.checked;

        // Cursor Settings
        const cursorColorEl = modal.querySelector('#sequenceCursorColor');
        if (cursorColorEl) settings.cursorColor = cursorColorEl.value;
        break;

      case 'wigTracks':
        // Collect track spacing
        const trackSpacingEl = modal.querySelector('#wigTrackSpacing');
        if (trackSpacingEl) {
          settings.trackSpacing = parseInt(trackSpacingEl.value) || 5;
        }

        // Collect individual track heights
        const heightInputs = modal.querySelectorAll('.wig-track-height-input');
        if (heightInputs.length > 0) {
          settings.trackHeights = {};
          heightInputs.forEach(input => {
            const trackName = input.dataset.trackName;
            const height = parseInt(input.value) || 30;
            settings.trackHeights[trackName] = height;
          });
        }

        // Collect default track height if no tracks are present
        const defaultHeightEl = modal.querySelector('#wigDefaultTrackHeight');
        if (defaultHeightEl) {
          settings.defaultTrackHeight = parseInt(defaultHeightEl.value) || 30;
        }

        // Position & Size Corrections
        const horizontalOffsetEl = modal.querySelector('#sequenceHorizontalOffset');
        if (horizontalOffsetEl) settings.horizontalOffset = parseFloat(horizontalOffsetEl.value) || 0;

        const verticalOffsetEl = modal.querySelector('#sequenceVerticalOffset');
        if (verticalOffsetEl) settings.verticalOffset = parseFloat(verticalOffsetEl.value) || 0;

        const heightCorrectionEl = modal.querySelector('#sequenceHeightCorrection');
        if (heightCorrectionEl) settings.heightCorrection = parseInt(heightCorrectionEl.value) || 100;

        const widthCorrectionEl = modal.querySelector('#sequenceWidthCorrection');
        if (widthCorrectionEl) settings.widthCorrection = parseInt(widthCorrectionEl.value) || 100;

        // DNA Base Colors (View Mode)
        const colorModeEl = modal.querySelector('#sequenceColorMode');
        if (colorModeEl) settings.colorMode = colorModeEl.value;

        const uniformColorEl = modal.querySelector('#sequenceUniformColor');
        if (uniformColorEl) settings.uniformColor = uniformColorEl.value;

        const intergenicColorEl = modal.querySelector('#sequenceIntergenicColor');
        if (intergenicColorEl) settings.intergenicColor = intergenicColorEl.value;

        const geneColorOpacityEl = modal.querySelector('#sequenceGeneColorOpacity');
        if (geneColorOpacityEl) settings.geneColorOpacity = parseFloat(geneColorOpacityEl.value) || 0.8;

        const colorAEl = modal.querySelector('#sequenceColorA');
        if (colorAEl) settings.colorA = colorAEl.value;

        const colorTEl = modal.querySelector('#sequenceColorT');
        if (colorTEl) settings.colorT = colorTEl.value;

        const colorGEl = modal.querySelector('#sequenceColorG');
        if (colorGEl) settings.colorG = colorGEl.value;

        const colorCEl = modal.querySelector('#sequenceColorC');
        if (colorCEl) settings.colorC = colorCEl.value;

        const colorNEl = modal.querySelector('#sequenceColorN');
        if (colorNEl) settings.colorN = colorNEl.value;

        // Edit Mode settings removed - only using view mode

        break;

      case 'sequenceLine':
        // Basic display settings
        settings.fontSize = parseInt(modal.querySelector('#sequenceLineFontSize').value) || 14;
        settings.fontFamily = modal.querySelector('#sequenceLineFontFamily').value || 'Courier New, monospace';

        // Protein translation settings
        settings.showProteinTranslation = modal.querySelector('#sequenceLineShowProteinTranslation').checked;
        settings.proteinTranslationMode =
          modal.querySelector('#sequenceLineProteinTranslationMode').value || 'all_frames';

        // Reading frames selection
        const frame1 = modal.querySelector('#sequenceLineFrame1').checked;
        const frame2 = modal.querySelector('#sequenceLineFrame2').checked;
        const frame3 = modal.querySelector('#sequenceLineFrame3').checked;
        settings.proteinFramesToShow = [];
        if (frame1) settings.proteinFramesToShow.push(1);
        if (frame2) settings.proteinFramesToShow.push(2);
        if (frame3) settings.proteinFramesToShow.push(3);

        settings.proteinFontSize = parseInt(modal.querySelector('#sequenceLineProteinFontSize').value) || 12;

        // Height settings
        settings.maxHeight = parseInt(modal.querySelector('#sequenceLineMaxHeight').value) || 50;
        settings.adaptiveHeight = modal.querySelector('#sequenceLineAdaptiveHeight').checked;
        break;

      case 'blast':
        // BLAST-specific settings collection
        settings.height = parseInt(modal.querySelector('#blastTrackHeight').value) || 120;
        settings.showRuler = modal.querySelector('#blastShowRuler').checked;
        settings.resultHeight = parseInt(modal.querySelector('#blastResultHeight').value) || 12;
        settings.resultSpacing = parseInt(modal.querySelector('#blastResultSpacing').value) || 14;
        break;

      case 'actions':
        // Actions track settings collection
        settings.height = parseInt(modal.querySelector('#actionsTrackHeight')?.value) || 120;
        settings.actionHeight = parseInt(modal.querySelector('#actionsActionHeight')?.value) || 10;
        settings.rowSpacing = parseInt(modal.querySelector('#actionsRowSpacing')?.value) || 2;
        settings.topPadding = parseInt(modal.querySelector('#actionsTopPadding')?.value) || 5;
        settings.bottomPadding = parseInt(modal.querySelector('#actionsBottomPadding')?.value) || 5;
        settings.fontSize = parseInt(modal.querySelector('#actionsFontSize')?.value) || 10;
        settings.fontFamily = modal.querySelector('#actionsFontFamily')?.value || 'Arial, sans-serif';
        break;

      case 'variants':
        // Display options
        settings.height = parseInt(modal.querySelector('#variantsHeight').value) || 80;
        settings.elementHeight = parseInt(modal.querySelector('#variantsElementHeight').value) || 12;
        settings.rowSpacing = parseInt(modal.querySelector('#variantsRowSpacing').value) || 8;

        // Color scheme
        settings.colorMode = modal.querySelector('#variantsColorMode').value || 'type';
        settings.customColor = modal.querySelector('#variantsCustomColor')?.value || '#e74c3c';

        // Type colors
        settings.snpColor = modal.querySelector('#variantsSNPColor').value || '#e74c3c';
        settings.indelColor = modal.querySelector('#variantsINDELColor').value || '#3498db';
        settings.svColor = modal.querySelector('#variantsSVColor').value || '#9b59b6';

        // Impact colors
        settings.highImpactColor = modal.querySelector('#variantsHighImpactColor').value || '#e74c3c';
        settings.moderateImpactColor = modal.querySelector('#variantsModerateImpactColor').value || '#f39c12';
        settings.lowImpactColor = modal.querySelector('#variantsLowImpactColor').value || '#2ecc71';
        settings.modifierImpactColor = modal.querySelector('#variantsModifierImpactColor').value || '#95a5a6';

        // Filtering options
        settings.minQuality = parseInt(modal.querySelector('#variantsMinQuality').value) || 0;
        settings.maxDisplayCount = parseInt(modal.querySelector('#variantsMaxDisplayCount').value) || 200;

        // Label options
        settings.showLabels = modal.querySelector('#variantsShowLabels').checked;
        settings.labelFontSize = parseInt(modal.querySelector('#variantsLabelFontSize').value) || 10;

        // Multi-VCF options
        settings.groupByFile = modal.querySelector('#variantsGroupByFile').checked;
        settings.fileSpacing = parseInt(modal.querySelector('#variantsFileSpacing').value) || 10;
        break;

      default:
        // For other track types that use the default track height input
        const defaultHeightInput = modal.querySelector('#defaultTrackHeight');
        settings.height = defaultHeightInput ? parseInt(defaultHeightInput.value) : 80;
        break;
    }

    return settings;
  }

  /**
   * Create settings content for sequence line track
   */
  createSequenceLineSettingsContent(settings) {
    return `
            <div class="settings-section">
                <h4>Display Settings</h4>
                <div class="form-group">
                    <label for="sequenceLineFontSize">Font size (px):</label>
                    <input type="number" id="sequenceLineFontSize" min="10" max="20" value="${settings.fontSize || 14}">
                    <div class="help-text">Size of the DNA sequence text.</div>
                </div>
                <div class="form-group">
                    <label for="sequenceLineFontFamily">Font family:</label>
                    <select id="sequenceLineFontFamily">
                        <option value="Courier New, monospace" ${(settings.fontFamily || 'Courier New, monospace') === 'Courier New, monospace' ? 'selected' : ''}>Courier New</option>
                        <option value="Monaco, monospace" ${settings.fontFamily === 'Monaco, monospace' ? 'selected' : ''}>Monaco</option>
                        <option value="Consolas, monospace" ${settings.fontFamily === 'Consolas, monospace' ? 'selected' : ''}>Consolas</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="sequenceLineMaxHeight">Maximum height (px):</label>
                    <input type="number" id="sequenceLineMaxHeight" min="30" max="200" value="${settings.maxHeight || 50}">
                    <div class="help-text">Maximum height of the sequence track.</div>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="sequenceLineAdaptiveHeight" ${settings.adaptiveHeight !== false ? 'checked' : ''}>
                        Adaptive height based on content
                    </label>
                    <div class="help-text">Automatically adjust height based on displayed content.</div>
                </div>
            </div>
            
            <div class="settings-section">
                <h4>Protein Translation Settings</h4>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="sequenceLineShowProteinTranslation" ${settings.showProteinTranslation ? 'checked' : ''}>
                        Show protein translation sequences
                    </label>
                    <div class="help-text">Display amino acid translations below the DNA sequence.</div>
                </div>
                
                <div class="form-group" id="sequenceLineTranslationModeGroup" style="display: ${settings.showProteinTranslation ? 'block' : 'none'}">
                    <label for="sequenceLineProteinTranslationMode">Translation mode:</label>
                    <select id="sequenceLineProteinTranslationMode">
                        <option value="all_frames" ${(settings.proteinTranslationMode || 'all_frames') === 'all_frames' ? 'selected' : ''}>All frames (ignore CDS)</option>
                        <option value="cds_only" ${settings.proteinTranslationMode === 'cds_only' ? 'selected' : ''}>CDS regions only</option>
                    </select>
                    <div class="help-text">Choose whether to show translation for all DNA or only CDS regions.</div>
                </div>
                
                <div class="form-group" id="sequenceLineFramesGroup" style="display: ${settings.showProteinTranslation ? 'block' : 'none'}">
                    <label>Reading frames to display:</label>
                    <div class="checkbox-group">
                        <label>
                            <input type="checkbox" id="sequenceLineFrame1" ${!settings.proteinFramesToShow || settings.proteinFramesToShow.includes(1) ? 'checked' : ''}>
                            Frame 1
                        </label>
                        <label>
                            <input type="checkbox" id="sequenceLineFrame2" ${!settings.proteinFramesToShow || settings.proteinFramesToShow.includes(2) ? 'checked' : ''}>
                            Frame 2
                        </label>
                        <label>
                            <input type="checkbox" id="sequenceLineFrame3" ${!settings.proteinFramesToShow || settings.proteinFramesToShow.includes(3) ? 'checked' : ''}>
                            Frame 3
                        </label>
                    </div>
                    <div class="help-text">Select which reading frames to display. Each frame shows translation starting from a different position.</div>
                </div>
                
                <div class="form-group" id="sequenceLineProteinFontSizeGroup" style="display: ${settings.showProteinTranslation ? 'block' : 'none'}">
                    <label for="sequenceLineProteinFontSize">Protein font size (px):</label>
                    <input type="number" id="sequenceLineProteinFontSize" min="8" max="16" value="${settings.proteinFontSize || 12}">
                    <div class="help-text">Size of the amino acid text.</div>
                </div>
            </div>
        `;
  }

  /**
   * Update the sequence track container height to match the canvas height
   */
  updateSequenceTrackHeight(seqDisplay, canvasHeight) {
    const trackElement = seqDisplay.closest('.sequence-line-track');
    if (trackElement) {
      const trackContent = trackElement.querySelector('.track-content');
      if (trackContent) {
        const newHeight = Math.max(canvasHeight, 20); // Ensure minimum height
        trackContent.style.height = newHeight + 'px';
        console.log('🔧 [updateSequenceTrackHeight] Updated track content height to:', newHeight + 'px');
      }
    }
  }

  /**
   * Setup event listeners for sequence line settings
   */
  setupSequenceLineSettingsEventListeners(bodyElement) {
    const showProteinTranslationCheckbox = bodyElement.querySelector('#sequenceLineShowProteinTranslation');
    const translationModeGroup = bodyElement.querySelector('#sequenceLineTranslationModeGroup');
    const framesGroup = bodyElement.querySelector('#sequenceLineFramesGroup');
    const proteinFontSizeGroup = bodyElement.querySelector('#sequenceLineProteinFontSizeGroup');

    if (showProteinTranslationCheckbox && translationModeGroup && framesGroup && proteinFontSizeGroup) {
      const toggleProteinSettings = () => {
        const isVisible = showProteinTranslationCheckbox.checked;
        translationModeGroup.style.display = isVisible ? 'block' : 'none';
        framesGroup.style.display = isVisible ? 'block' : 'none';
        proteinFontSizeGroup.style.display = isVisible ? 'block' : 'none';
      };

      showProteinTranslationCheckbox.addEventListener('change', toggleProteinSettings);

      // Initialize visibility
      toggleProteinSettings();
    }
  }

  /**
   * Save track settings
   */
  saveTrackSettings(trackType, settings, fileId = null) {
    const instanceKey = this._instanceSettingsKey(trackType, fileId);
    console.log(`🔧 [TrackRenderer] Saving settings for ${instanceKey}:`, settings);

    // CRITICAL: Update in-memory trackSettings so refreshViewAfterSettingsChange preserves them
    if (!this.trackSettings) {
      this.trackSettings = {};
    }
    if (fileId) {
      this.trackSettings[instanceKey] = { ...settings };
    } else {
      this.trackSettings[trackType] = { ...settings };
    }

    // Always save type-level settings (the base defaults)
    if (!fileId) {
      if (this.genomeBrowser.configManager) {
        this.genomeBrowser.configManager.set(`tracks.${trackType}.settings`, settings);
        this.genomeBrowser.configManager.saveConfig();
        console.log(`🔧 [TrackRenderer] Settings saved via ConfigManager for ${trackType}`);
      } else {
        localStorage.setItem(`trackSettings_${trackType}`, JSON.stringify(settings));
        console.log(`🔧 [TrackRenderer] Settings saved via localStorage for ${trackType}`);
      }
    } else {
      // For instance-level settings, save with fileId qualifier
      if (this.genomeBrowser.configManager) {
        this.genomeBrowser.configManager.set(`tracks.${instanceKey}.settings`, settings);
        this.genomeBrowser.configManager.saveConfig();
        console.log(`🔧 [TrackRenderer] Instance settings saved via ConfigManager for ${instanceKey}`);
      } else {
        localStorage.setItem(`trackSettings_${instanceKey}`, JSON.stringify(settings));
        console.log(`🔧 [TrackRenderer] Instance settings saved via localStorage for ${instanceKey}`);
      }
    }

    // Verify the settings were saved
    const savedSettings = this.getTrackSettings(trackType, fileId);
    console.log(`🔧 [TrackRenderer] Verified saved settings for ${instanceKey}:`, savedSettings);
  }

  /**
   * Apply settings to track immediately
   */
  applySettingsToTrack(trackType, settings, fileId = null) {
    const instanceKey = this._instanceSettingsKey(trackType, fileId);
    console.log(`🔧 [applySettingsToTrack] Called for ${instanceKey} with settings:`, settings);
    console.log(`🔧 [applySettingsToTrack] Settings renderingMode: ${settings.renderingMode}`);

    // Store settings for use during rendering
    if (!this.trackSettings) {
      this.trackSettings = {};
    }
    this.trackSettings[instanceKey] = settings;

    console.log(`🔧 [applySettingsToTrack] Stored settings for ${trackType}:`, this.trackSettings[trackType]);
    console.log(`🔧 [applySettingsToTrack] Stored renderingMode: ${this.trackSettings[trackType].renderingMode}`);

    // Sync UI Buttons (specifically for Reads track)
    if (trackType === 'reads') {
      this.syncReadsToggleButtons(settings);

      // Sync sampling header UI when sampling settings change
      if (settings.samplingPercentage !== undefined) {
        this.syncSamplingHeaderUI(settings.samplingPercentage);
      }
    }

    // Sync UI Buttons (specifically for Genes track layout button)
    if (trackType === 'genes') {
      this.syncGenesLayoutButton();
    }

    // Special handling for sequence track settings
    if (trackType === 'sequence' && this.genomeBrowser.sequenceUtils) {
      console.log('🔧 [TrackRenderer] Applying sequence settings...');
      console.log('🔧 [TrackRenderer] Settings to apply:', settings);

      // Apply cursor color to SequenceUtils (View Mode)
      if (settings.cursorColor) {
        this.genomeBrowser.sequenceUtils.setCursorColor(settings.cursorColor);
      }

      // VSCodeSequenceEditor settings removed - only using view mode
    }

    // Special handling for sequence line track settings
    if (trackType === 'sequenceLine') {
      console.log('🔧 [TrackRenderer] Applying sequence line settings...');
      console.log('🔧 [TrackRenderer] Settings to apply:', settings);

      // Update existing canvas renderers with new settings
      this.canvasRenderers.forEach((renderer, trackId) => {
        if (renderer.container && renderer.container.classList.contains('sequence-canvas-container')) {
          console.log('🔧 [TrackRenderer] Updating canvas renderer with new settings:', trackId);

          // Update renderer options
          renderer.options = {
            ...renderer.options,
            fontSize: settings.fontSize || 14,
            fontFamily: settings.fontFamily || 'Courier New, monospace',
            maxHeight: settings.maxHeight || 50,
            adaptiveHeight: settings.adaptiveHeight !== false,
            showProteinTranslation: settings.showProteinTranslation || false,
            proteinTranslationMode: settings.proteinTranslationMode || 'all_frames',
            proteinFramesToShow: settings.proteinFramesToShow || [1, 2, 3],
            proteinFontSize: settings.proteinFontSize || 12,
          };

          // Force recalculation and re-render
          renderer.calculateMetrics();
          renderer.setupCanvas();
          renderer.render();

          // Update the track container height to match the new canvas height
          const trackElement = renderer.container.closest('.sequence-line-track');
          if (trackElement) {
            const trackContent = trackElement.querySelector('.track-content');
            if (trackContent) {
              trackContent.style.height = renderer.canvasHeight + 'px';
              console.log('🔧 [TrackRenderer] Updated track content height to:', renderer.canvasHeight + 'px');
            }
          }
        }
      });
    }

    // Store settings - the complete redraw will handle applying all settings including height
    console.log(`Settings stored for ${trackType}, will be applied during complete redraw`);

    // Notify TabManager about track settings change to preserve settings
    if (this.genomeBrowser.tabManager) {
      console.log('🔍 [applySettingsToTrack] Notifying TabManager about settings change');
      this.genomeBrowser.tabManager.onTrackSettingsChanged();
    }

    // Trigger the same complete redraw that drag-end uses for consistency
    console.log('Calling complete view redraw after applying settings (same as drag-end)...');
    this.refreshViewAfterSettingsChange(true); // Force full redraw for consistency
  }

  // VSCodeSequenceEditor settings method removed - only using view mode

  /**
   * Update sampling percentage for reads track
   */
  updateSamplingPercentage(percentage, fileId = null) {
    // Validate and clamp percentage to valid range [1, 100]
    percentage = Math.min(100, Math.max(1, parseInt(percentage) || 20));

    console.log(`🎲 [TrackRenderer] Updating sampling percentage to ${percentage}%${fileId ? ` for file ${fileId}` : ''}`);

    try {
      // Get current settings (instance-specific if fileId provided)
      const currentSettings = this.getTrackSettings('reads', fileId);

      // Update sampling settings
      currentSettings.samplingPercentage = percentage;
      currentSettings.enableSampling = true; // Ensure sampling is enabled
      currentSettings.samplingMode = 'percentage'; // Set to percentage mode

      // Save the updated settings
      this.saveTrackSettings('reads', currentSettings, fileId);

      // Sync the header UI (input and preset buttons)
      this.syncSamplingHeaderUI(percentage);

      // Check if reads track is currently visible
      const readsTrack = document.querySelector('.reads-track');
      if (readsTrack) {
        // Refresh the reads track immediately
        console.log(`🎲 [TrackRenderer] Refreshing reads track with new sampling: ${percentage}%`);
        this.refreshViewAfterSettingsChange(true); // Force full redraw for reads track

        // Show a brief feedback message
        this.showSamplingUpdateFeedback(percentage);
      }
    } catch (error) {
      console.error('Error updating sampling percentage:', error);
    }
  }

  /**
   * Sync the sampling header UI (input and preset buttons) with the current percentage
   */
  syncSamplingHeaderUI(percentage) {
    const readsTrack = document.querySelector('.reads-track');
    if (!readsTrack) return;

    const trackHeader = readsTrack.querySelector('.track-header');
    if (!trackHeader) return;

    // Update select value
    const samplingInput = trackHeader.querySelector('.track-sampling-input');
    if (samplingInput && samplingInput.tagName === 'SELECT') {
      // Check if the percentage exists as an option
      const existingOption = samplingInput.querySelector(`option[value="${percentage}"]`);
      if (existingOption) {
        samplingInput.value = percentage;
      } else {
        // Remove any previous custom option
        const prevCustom = samplingInput.querySelector('option[data-custom="true"]');
        if (prevCustom) prevCustom.remove();
        // Add custom option for this percentage
        const customOption = document.createElement('option');
        customOption.value = percentage;
        customOption.textContent = percentage + '%';
        customOption.dataset.custom = 'true';
        customOption.selected = true;
        samplingInput.insertBefore(customOption, samplingInput.firstChild);
      }
    }

    console.log(`🎲 [TrackRenderer] Synced sampling header UI to ${percentage}%`);
  }

  /**
   * Show brief feedback when sampling percentage is updated
   */
  showSamplingUpdateFeedback(percentage) {
    // Remove any existing feedback
    const existingFeedback = document.querySelector('.sampling-feedback');
    if (existingFeedback) {
      existingFeedback.remove();
    }

    // Create feedback element
    const feedback = document.createElement('div');
    feedback.className = 'sampling-feedback';
    feedback.textContent = `Sampling updated to ${percentage}%`;
    feedback.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 10000;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            animation: fadeInOut 2s ease-in-out;
        `;

    // Add CSS animation
    if (!document.querySelector('#sampling-feedback-styles')) {
      const style = document.createElement('style');
      style.id = 'sampling-feedback-styles';
      style.textContent = `
                @keyframes fadeInOut {
                    0% { opacity: 0; transform: translateY(-10px); }
                    20%, 80% { opacity: 1; transform: translateY(0); }
                    100% { opacity: 0; transform: translateY(-10px); }
                }
            `;
      document.head.appendChild(style);
    }

    document.body.appendChild(feedback);

    // Remove after animation
    setTimeout(() => {
      if (feedback.parentNode) {
        feedback.remove();
      }
    }, 2000);
  }

  /**
   * Unified view refresh function for settings changes and window resize
   */
  refreshViewAfterSettingsChange(forceFullRedraw = false) {
    const currentChr = document.getElementById('chromosomeSelect').value;
    console.log(
      '🔄 [refreshViewAfterSettingsChange] Called for chromosome:',
      currentChr,
      'forceFullRedraw:',
      forceFullRedraw
    );

    // CRITICAL: Preserve trackSettings before redraw
    const preservedTrackSettings = this.trackSettings ? JSON.parse(JSON.stringify(this.trackSettings)) : {};
    console.log('🔄 [refreshViewAfterSettingsChange] Preserving trackSettings:', preservedTrackSettings);

    // Clean up all Canvas renderers before redraw to ensure proper switching between rendering modes
    if (forceFullRedraw) {
      console.log('🧹 [refreshViewAfterSettingsChange] Cleaning up Canvas renderers before full redraw');
      this.cleanupAllCanvasRenderers();
    }

    if (currentChr && this.genomeBrowser.currentSequence && this.genomeBrowser.currentSequence[currentChr]) {
      if (forceFullRedraw) {
        console.log('🔄 [refreshViewAfterSettingsChange] Performing full view redraw...');

        // CRITICAL FIX: Apply preserved settings BEFORE redraw, not after
        this.trackSettings = preservedTrackSettings;
        console.log('🔄 [refreshViewAfterSettingsChange] Applied trackSettings BEFORE redraw:', this.trackSettings);
        console.log(
          '🔧 [DEBUG] [refreshViewAfterSettingsChange] Reads renderingMode BEFORE redraw:',
          this.trackSettings?.reads?.renderingMode
        );

        // Perform complete redraw of all tracks
        this.genomeBrowser.displayGenomeView(currentChr, this.genomeBrowser.currentSequence[currentChr]);
      } else {
        console.log('Triggering optimized view refresh...');

        // Update navigation bar canvas if it exists
        if (this.genomeBrowser.genomeNavigationBar) {
          this.genomeBrowser.genomeNavigationBar.resizeCanvas();
          this.genomeBrowser.genomeNavigationBar.draw();
        }

        // Force recalculation of container widths and SVG dimensions
        this.updateAllSVGTracks();

        // Update sequence display if visible
        if (this.genomeBrowser.visibleTracks.has('sequence')) {
          this.genomeBrowser.displayEnhancedSequence(currentChr, this.genomeBrowser.currentSequence[currentChr]);
        }

        console.log('✅ Optimized view refresh completed');
      }
    } else {
      console.warn('Cannot refresh view - missing chromosome or sequence data');
    }
  }

  /**
   * Update all SVG-based tracks with proper dimensions
   */
  updateAllSVGTracks() {
    const currentChr = document.getElementById('chromosomeSelect').value;
    if (!currentChr || !this.genomeBrowser.currentSequence || !this.genomeBrowser.currentSequence[currentChr]) {
      console.log('⚠️ No current chromosome/sequence, skipping SVG update');
      return;
    }

    const sequence = this.genomeBrowser.currentSequence[currentChr];

    // 🔒 CRITICAL: Validate sequence is a string before using
    if (typeof sequence !== 'string') {
      console.error('❌ [updateAllSVGTracks] Invalid sequence type:', typeof sequence);
      console.error('Expected string, got:', sequence);
      console.error(
        'This indicates currentSequence was corrupted - possibly stored as length instead of actual sequence'
      );
      return;
    }

    const annotations = this.genomeBrowser.currentAnnotations[currentChr] || [];
    const operons = this.genomeBrowser.detectOperons(annotations, currentChr);

    console.log('🔄 Updating all SVG tracks for chromosome:', currentChr);

    // Update gene track SVG
    if (this.genomeBrowser.visibleTracks.has('genes') && annotations.length > 0) {
      this.updateGeneTrackSVG(currentChr, sequence, annotations, operons);
    }

    // Update reads track SVG
    if (this.genomeBrowser.visibleTracks.has('reads')) {
      this.updateReadsTrackSVG(currentChr);
    }

    // Update GC track if needed
    if (this.genomeBrowser.visibleTracks.has('gc') && sequence) {
      this.updateGCTrackSVG(currentChr, sequence);
    }

    // Update other tracks
    this.updateOtherTracksSVG(currentChr, sequence);

    console.log('✅ All SVG tracks updated');
  }

  /**
   * Update gene track SVG with proper dimensions
   */
  updateGeneTrackSVG(chromosome, sequence, annotations, operons) {
    const geneTrack = document.querySelector('.gene-track');
    if (!geneTrack) return;

    const trackContent = geneTrack.querySelector('.track-content');
    if (!trackContent) return;

    const svgContainer = trackContent.querySelector('.genes-svg-container');
    if (svgContainer) {
      // Force layout recalculation to get accurate width
      trackContent.style.width = '100%';
      const containerWidth = trackContent.getBoundingClientRect().width || trackContent.offsetWidth || 800;

      // Update text elements for proper sizing after changes
      this.updateSVGTextForResize(svgContainer, containerWidth);
      console.log('🧬 Gene track SVG updated with container width:', containerWidth);
    }

    // Update operons panel when gene track is updated
    const viewport = this.getCurrentViewport();
    const visibleGenes = this.filterGeneAnnotations(annotations, viewport);
    if (visibleGenes.length > 0) {
      this.addGeneTrackStatistics(trackContent, visibleGenes, operons, this.getTrackSettings('genes'));
    }
  }

  /**
   * Update reads track SVG with proper dimensions
   */
  updateReadsTrackSVG(chromosome) {
    const readsTrack = document.querySelector('.reads-track');
    if (!readsTrack) return;

    const trackContent = readsTrack.querySelector('.track-content');
    if (!trackContent) return;

    const svgContainer = trackContent.querySelector('svg');
    if (svgContainer) {
      // Force layout recalculation
      trackContent.style.width = '100%';
      const containerWidth = trackContent.getBoundingClientRect().width || trackContent.offsetWidth || 800;

      // Update SVG dimensions - get numeric height value
      const svgHeight = svgContainer.getBoundingClientRect().height || svgContainer.offsetHeight || 150;
      svgContainer.setAttribute('width', '100%');
      svgContainer.setAttribute('viewBox', `0 0 ${containerWidth} ${svgHeight}`);
      console.log('📊 Reads track SVG updated with container width:', containerWidth);
    }
  }

  /**
   * Update GC track SVG with proper dimensions
   *
   * @param {string} chromosome - Chromosome identifier
   * @param {string|number} sequence - Sequence string or length
   */
  updateGCTrackSVG(chromosome, sequence) {
    const gcTrack = document.querySelector('.gc-track');
    if (!gcTrack) return;

    const trackContent = gcTrack.querySelector('.track-content');
    if (!trackContent) return;

    // 🔒 CRITICAL: Validate sequence is a string, not a number
    if (typeof sequence !== 'string') {
      console.warn(
        '⚠️ [updateGCTrackSVG] Sequence is not a string (type:',
        typeof sequence,
        '), skipping GC track update'
      );
      console.warn('This might happen if sequence was stored as length instead of actual sequence data');
      return;
    }

    if (!sequence || sequence.length === 0) {
      console.warn('⚠️ [updateGCTrackSVG] Empty sequence, skipping GC track update');
      return;
    }

    // Clear existing content first
    trackContent.innerHTML = '';

    // Regenerate GC visualization with current viewport and sequence
    const viewport = this.getCurrentViewport();
    const subsequence = sequence.substring(viewport.start, viewport.end);

    // Create new enhanced GC content and skew visualization
    const gcDisplay = this.createEnhancedGCVisualization(subsequence, viewport.start, viewport.end);
    trackContent.appendChild(gcDisplay);

    console.log('📈 GC track fully regenerated for window resize with viewport:', viewport);
  }

  /**
   * Update other tracks' SVG elements
   */
  updateOtherTracksSVG(chromosome, sequence) {
    // Update WIG tracks if present
    const wigTracks = document.querySelectorAll('.wig-track');
    wigTracks.forEach(wigTrack => {
      const trackContent = wigTrack.querySelector('.track-content');
      if (trackContent) {
        const svgContainer = trackContent.querySelector('svg');
        if (svgContainer) {
          trackContent.style.width = '100%';
          const containerWidth = trackContent.getBoundingClientRect().width || trackContent.offsetWidth || 800;
          const svgHeight = svgContainer.getBoundingClientRect().height || svgContainer.offsetHeight || 30;
          svgContainer.setAttribute('width', '100%');
          svgContainer.setAttribute('viewBox', `0 0 ${containerWidth} ${svgHeight}`);
        }
      }
    });

    // Update variant tracks if present
    const variantTracks = document.querySelectorAll('.variant-track');
    variantTracks.forEach(variantTrack => {
      const trackContent = variantTrack.querySelector('.track-content');
      if (trackContent) {
        const svgContainer = trackContent.querySelector('svg');
        if (svgContainer) {
          trackContent.style.width = '100%';
          const containerWidth = trackContent.getBoundingClientRect().width || trackContent.offsetWidth || 800;
          const svgHeight = svgContainer.getBoundingClientRect().height || svgContainer.offsetHeight || 30;
          svgContainer.setAttribute('width', '100%');
          svgContainer.setAttribute('viewBox', `0 0 ${containerWidth} ${svgHeight}`);
        }
      }
    });
  }

  /**
   * Get current sequence view mode from SequenceUtils
   */
  getCurrentSequenceViewMode() {
    try {
      // Try to access the current sequence display mode
      if (this.genomeBrowser && this.genomeBrowser.sequenceUtils) {
        return this.genomeBrowser.sequenceUtils.displayMode || 'view';
      }

      // Fallback: check if VS Code editor is active
      const sequenceContent = document.getElementById('sequenceContent');
      if (sequenceContent && sequenceContent.querySelector('.vscode-sequence-editor')) {
        return 'edit';
      }

      return 'view';
    } catch (error) {
      console.warn('Could not determine sequence view mode:', error);
      return 'view';
    }
  }

  /**
   * Create View Mode specific settings content
   */
  createViewModeSettingsContent(settings) {
    console.log('👁️ createViewModeSettingsContent called with settings:', settings);

    const content = `
            <div class="mode-indicator">
                <i class="fas fa-eye"></i>
                These settings apply to the traditional sequence view mode with gene indicator bars.
            </div>
            
            <div class="settings-section">
                <h4>Gene Indicator Bar Settings</h4>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="sequenceShowIndicators" ${settings.showIndicators !== false ? 'checked' : ''}>
                        Show gene indicator bars below sequence lines
                    </label>
                    <div class="help-text">Display colored bars below each sequence line showing gene locations and types.</div>
                </div>
                <div class="form-group">
                    <label for="sequenceIndicatorHeight">Indicator bar height (px):</label>
                    <input type="number" id="sequenceIndicatorHeight" min="6" max="20" value="${settings.indicatorHeight || 8}">
                    <div class="help-text">Height of the gene indicator bars below sequence lines.</div>
                </div>
                <div class="form-group">
                    <label for="sequenceIndicatorOpacity">Indicator opacity (0-1):</label>
                    <input type="number" id="sequenceIndicatorOpacity" min="0.3" max="1" step="0.1" value="${settings.indicatorOpacity || 0.7}">
                    <div class="help-text">Transparency level of gene indicator bars.</div>
                </div>
                
                <h5 style="margin-top: 20px; margin-bottom: 10px; color: #495057; font-size: 14px;">Position & Size Corrections</h5>
                <div class="form-group">
                    <label for="sequenceHorizontalOffset">Horizontal offset (px):</label>
                    <input type="number" id="sequenceHorizontalOffset" min="-50" max="50" step="0.5" value="${settings.horizontalOffset || 0}">
                    <div class="help-text">Horizontal position adjustment for gene indicators (positive = right, negative = left).</div>
                </div>
                <div class="form-group">
                    <label for="sequenceVerticalOffset">Vertical offset (px):</label>
                    <input type="number" id="sequenceVerticalOffset" min="-20" max="20" step="0.5" value="${settings.verticalOffset || 0}">
                    <div class="help-text">Vertical position adjustment for gene indicators (positive = down, negative = up).</div>
                </div>
                <div class="form-group">
                    <label for="sequenceHeightCorrection">Height correction (%):</label>
                    <input type="number" id="sequenceHeightCorrection" min="50" max="200" step="5" value="${settings.heightCorrection || 100}">
                    <div class="help-text">Height scaling for gene indicators (100% = normal, 150% = 1.5x height, 75% = 0.75x height).</div>
                </div>
                <div class="form-group">
                    <label for="sequenceWidthCorrection">Width correction (%):</label>
                    <input type="number" id="sequenceWidthCorrection" min="50" max="200" step="5" value="${settings.widthCorrection || 100}">
                    <div class="help-text">Width scaling for gene indicators (100% = normal, 120% = 1.2x width, 80% = 0.8x width).</div>
                </div>
            </div>
            
            <div class="settings-section">
                <h4>Gene Markers</h4>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="sequenceShowStartMarkers" ${settings.showStartMarkers !== false ? 'checked' : ''}>
                        Show gene start markers (vertical lines)
                    </label>
                    <div class="help-text">Display vertical lines at gene start positions.</div>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="sequenceShowEndArrows" ${settings.showEndArrows !== false ? 'checked' : ''}>
                        Show gene end arrows
                    </label>
                    <div class="help-text">Display directional arrows at gene end positions showing strand direction.</div>
                </div>
                <div class="form-group">
                    <label for="sequenceStartMarkerWidth">Start marker width (px):</label>
                    <input type="number" id="sequenceStartMarkerWidth" min="1" max="6" step="0.5" value="${settings.startMarkerWidth || 3}">
                    <div class="help-text">Width of the vertical start marker lines.</div>
                </div>
                <div class="form-group">
                    <label for="sequenceStartMarkerHeight">Start marker height (% of bar):</label>
                    <input type="number" id="sequenceStartMarkerHeight" min="50" max="100" value="${settings.startMarkerHeight || 85}">
                    <div class="help-text">Height of start markers as percentage of indicator bar height (50-100%).</div>
                </div>
                <div class="form-group">
                    <label for="sequenceArrowSize">End arrow size (px):</label>
                    <input type="number" id="sequenceArrowSize" min="3" max="12" value="${settings.arrowSize || 6}">
                    <div class="help-text">Size of the directional arrows at gene ends.</div>
                </div>
                <div class="form-group">
                    <label for="sequenceArrowHeight">End arrow height (% of bar):</label>
                    <input type="number" id="sequenceArrowHeight" min="50" max="100" value="${settings.arrowHeight || 85}">
                    <div class="help-text">Height of end arrows as percentage of indicator bar height (50-100%).</div>
                </div>
            </div>
            
            <div class="settings-section">
                <h4>Gene Type Filters</h4>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="sequenceShowCDS" ${settings.showCDS !== false ? 'checked' : ''}>
                        Show CDS genes
                    </label>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="sequenceShowRNA" ${settings.showRNA !== false ? 'checked' : ''}>
                        Show RNA genes (tRNA, rRNA, mRNA)
                    </label>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="sequenceShowPromoter" ${settings.showPromoter !== false ? 'checked' : ''}>
                        Show promoters
                    </label>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="sequenceShowTerminator" ${settings.showTerminator !== false ? 'checked' : ''}>
                        Show terminators
                    </label>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="sequenceShowRegulatory" ${settings.showRegulatory !== false ? 'checked' : ''}>
                        Show regulatory elements
                    </label>
                </div>
            </div>
            
            <div class="settings-section">
                <h4>DNA Base Colors</h4>
                <div class="form-group">
                    <label for="sequenceColorMode">Color mode:</label>
                    <select id="sequenceColorMode" class="select">
                        <option value="uniform" ${(settings.colorMode || 'uniform') === 'uniform' ? 'selected' : ''}>Uniform color (single color for all bases)</option>
                        <option value="geneColors" ${(settings.colorMode || 'uniform') === 'geneColors' ? 'selected' : ''}>Gene colors (use colors from Genes & Features Track)</option>
                        <option value="baseColors" ${(settings.colorMode || 'uniform') === 'baseColors' ? 'selected' : ''}>Individual base colors (ATGCN)</option>
                    </select>
                    <div class="help-text">Choose how DNA bases are colored in the sequence view.</div>
                </div>
                
                <!-- Uniform Color Settings -->
                <div id="uniformColorSettings" class="color-mode-settings" style="display: ${(settings.colorMode || 'uniform') === 'uniform' ? 'block' : 'none'};">
                    <div class="form-group">
                        <label for="sequenceUniformColor">Base color:</label>
                        <input type="color" id="sequenceUniformColor" value="${settings.uniformColor || '#000000'}">
                        <div class="help-text">Single color used for all DNA bases (default: black).</div>
                    </div>
                </div>
                
                <!-- Gene Colors Settings -->
                <div id="geneColorSettings" class="color-mode-settings" style="display: ${(settings.colorMode || 'uniform') === 'geneColors' ? 'block' : 'none'};">
                    <div class="form-group">
                        <div class="help-text">
                            <i class="fas fa-info-circle"></i>
                            DNA bases will be colored according to the gene they belong to, using the same colors as the Genes & Features Track. 
                            Non-coding regions will use the uniform color below.
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="sequenceIntergenicColor">Intergenic region color:</label>
                        <input type="color" id="sequenceIntergenicColor" value="${settings.intergenicColor || '#666666'}">
                        <div class="help-text">Color for bases in intergenic regions (between genes).</div>
                    </div>
                    <div class="form-group">
                        <label for="sequenceGeneColorOpacity">Gene color opacity:</label>
                        <input type="number" id="sequenceGeneColorOpacity" min="0.3" max="1" step="0.1" value="${settings.geneColorOpacity || 0.8}">
                        <div class="help-text">Transparency level for gene-based colors (0.3 = very transparent, 1.0 = opaque).</div>
                    </div>
                </div>
                
                <!-- Individual Base Colors Settings -->
                <div id="baseColorSettings" class="color-mode-settings" style="display: ${(settings.colorMode || 'uniform') === 'baseColors' ? 'block' : 'none'};">
                    <div class="form-group">
                        <label for="sequenceColorA">Adenine (A) color:</label>
                        <input type="color" id="sequenceColorA" value="${settings.colorA || '#FF0000'}">
                        <div class="help-text">Color for adenine bases.</div>
                    </div>
                    <div class="form-group">
                        <label for="sequenceColorT">Thymine (T) color:</label>
                        <input type="color" id="sequenceColorT" value="${settings.colorT || '#0000FF'}">
                        <div class="help-text">Color for thymine bases.</div>
                    </div>
                    <div class="form-group">
                        <label for="sequenceColorG">Guanine (G) color:</label>
                        <input type="color" id="sequenceColorG" value="${settings.colorG || '#00FF00'}">
                        <div class="help-text">Color for guanine bases.</div>
                    </div>
                    <div class="form-group">
                        <label for="sequenceColorC">Cytosine (C) color:</label>
                        <input type="color" id="sequenceColorC" value="${settings.colorC || '#FFFF00'}">
                        <div class="help-text">Color for cytosine bases.</div>
                    </div>
                    <div class="form-group">
                        <label for="sequenceColorN">Unknown (N) color:</label>
                        <input type="color" id="sequenceColorN" value="${settings.colorN || '#888888'}">
                        <div class="help-text">Color for unknown or ambiguous bases.</div>
                    </div>
                </div>
            </div>
            
            <div class="settings-section">
                <h4>Cursor Settings</h4>
                <div class="form-group">
                    <label for="sequenceCursorColor">Cursor color:</label>
                    <input type="color" id="sequenceCursorColor" value="${settings.cursorColor || '#000000'}">
                    <div class="help-text">Color of the blinking cursor when clicking on sequence positions.</div>
                </div>
            </div>
            
            <div class="settings-section">
                <h4>Tooltips & Interaction</h4>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="sequenceShowTooltips" ${settings.showTooltips !== false ? 'checked' : ''}>
                        Show tooltips on hover
                    </label>
                    <div class="help-text">Display gene information when hovering over indicator elements.</div>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="sequenceShowHoverEffects" ${settings.showHoverEffects !== false ? 'checked' : ''}>
                        Enable hover effects
                    </label>
                    <div class="help-text">Highlight indicator elements when hovering over them.</div>
                </div>
            </div>
        `;

    console.log('👁️ View mode content generated, length:', content.length);
    return content;
  }

  // Edit Mode settings method removed - only using view mode

  /**
   * Create sequence track settings content with tabs for different view modes
   */
  createSequenceSettingsContent(settings) {
    console.log('🔧 createSequenceSettingsContent called with settings:', settings);

    const viewModeContent = this.createViewModeSettingsContent(settings);
    console.log('👁️ View mode content length:', viewModeContent.length);

    // Only show view mode settings - no tabs needed
    const result = `
            <div class="sequence-settings-content">
                        ${viewModeContent}
            </div>
        `;

    console.log('🎨 Final result length:', result.length);
    console.log('🎨 Final result preview:', result.substring(0, 200) + '...');

    return result;
  }

  /**
   * Create coverage visualization above reads
   */
  createCoverageVisualization(trackContent, reads, viewport, coverageHeight, settings) {
    // Calculate coverage data
    const coverageData = this.calculateCoverage(reads, viewport.start, viewport.end);
    const maxCoverage = Math.max(...coverageData, 1);

    // Create coverage container
    const coverageContainer = document.createElement('div');
    coverageContainer.className = 'coverage-visualization';
    coverageContainer.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: ${coverageHeight}px;
            background: linear-gradient(to bottom, #f8f9fa 0%, #e9ecef 100%);
            border-bottom: 1px solid #dee2e6;
            margin-bottom: 0;
            z-index: 1;
        `;

    // Create SVG for coverage visualization
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', coverageHeight);
    svg.setAttribute('viewBox', `0 0 100 ${coverageHeight}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('class', 'coverage-svg');
    svg.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%;';

    // Create coverage path
    let pathData = `M 0 ${coverageHeight}`;
    for (let i = 0; i < coverageData.length; i++) {
      const x = (i / (coverageData.length - 1)) * 100;
      const y = coverageHeight - (coverageData[i] / maxCoverage) * (coverageHeight - 5);
      pathData += ` L ${x} ${y}`;
    }
    pathData += ` L 100 ${coverageHeight} Z`;

    const coveragePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    coveragePath.setAttribute('d', pathData);
    coveragePath.setAttribute('fill', settings.coverageColor || '#4a90e2');
    coveragePath.setAttribute('fill-opacity', '0.6');
    coveragePath.setAttribute('stroke', settings.coverageStrokeColor || '#2c5aa0');
    coveragePath.setAttribute('stroke-width', '1');
    coveragePath.setAttribute('vector-effect', 'non-scaling-stroke');

    svg.appendChild(coveragePath);
    coverageContainer.appendChild(svg);

    // Add coverage statistics
    const avgCoverage = (coverageData.reduce((sum, val) => sum + val, 0) / coverageData.length).toFixed(1);
    const statsDiv = document.createElement('div');
    statsDiv.className = 'coverage-stats';
    statsDiv.style.cssText = `
            position: absolute;
            top: 5px;
            right: 10px;
            background: rgba(255,255,255,0.9);
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 10px;
            color: #666;
            border: 1px solid #ddd;
        `;
    statsDiv.textContent = `Max: ${maxCoverage}x | Avg: ${avgCoverage}x`;
    coverageContainer.appendChild(statsDiv);

    trackContent.appendChild(coverageContainer);
  }

  /**
   * Create reference sequence visualization above reads (fixed position like coverage)
   * Using Single-line sequence track renderer for better performance and display quality
   */
  createReferenceVisualization(trackContent, viewport, referenceHeight, settings) {
    if (settings.showReference === false) return 0;

    console.log(
      `🔍 [createReferenceVisualization] Creating reference for viewport: ${viewport.start}-${viewport.end}, height: ${referenceHeight}`
    );

    // Get reference sequence from genome browser
    const referenceSequence = this.getReferenceSequence(viewport.start, viewport.end);
    console.log(
      `🔍 [createReferenceVisualization] Got reference sequence: ${referenceSequence ? referenceSequence.length + ' bases' : 'null'}`
    );

    // Check if coverage exists to position reference below it
    const coverageElement = trackContent.querySelector('.coverage-visualization');
    const coverageHeight = coverageElement ? parseInt(coverageElement.style.height) || 0 : 0;

    // Create reference container (fixed position like coverage)
    const referenceContainer = document.createElement('div');
    referenceContainer.className = 'reference-sequence-visualization';
    referenceContainer.style.cssText = `
            position: absolute;
            top: ${coverageHeight}px;
            left: 0;
            right: 0;
            height: ${referenceHeight}px;
            background: linear-gradient(to bottom, #f1f3f4 0%, #e8eaed 100%);
            border-bottom: 1px solid #dadce0;
            margin-bottom: 0;
            z-index: 2;
            overflow: hidden;
        `;

    if (!referenceSequence) {
      console.warn(`🔍 [createReferenceVisualization] No reference sequence available, creating placeholder`);

      // Create placeholder text when no reference sequence is available
      // Do not create placeholder text when no reference sequence is available
      // Just return early to collapse the section
      console.warn(`🔍 [createReferenceVisualization] No reference sequence available, skipping (clean view)`);
      return 0; // Return 0 height
    } else {
      // Use the same high-quality renderer as Single-line sequence track
      const referenceDisplay = this.createReferenceSequenceDisplay(
        referenceSequence,
        viewport,
        referenceHeight,
        settings
      );
      referenceContainer.appendChild(referenceDisplay);
    }

    trackContent.appendChild(referenceContainer);

    return referenceHeight;
  }

  /**
   * Create reference sequence display using Single-line sequence track renderer
   */
  createReferenceSequenceDisplay(subsequence, viewport, referenceHeight, settings) {
    console.log(
      `🔍 [createReferenceSequenceDisplay] Creating high-quality reference display for ${subsequence.length} bases`
    );

    // Create container for the reference sequence display
    const seqDisplay = document.createElement('div');
    seqDisplay.className = 'reference-sequence-display reference-canvas-container';
    seqDisplay.style.cssText = `
            position: relative;
            width: 100%;
            height: 100%;
            overflow: hidden;
        `;

    // Generate unique ID for this reference display instance
    const displayId = `reference-display-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    seqDisplay.setAttribute('data-display-id', displayId);

    // Check if CanvasSequenceRenderer is available
    if (typeof CanvasSequenceRenderer === 'undefined') {
      console.warn(
        '⚠️ [createReferenceSequenceDisplay] CanvasSequenceRenderer not available, falling back to DOM rendering'
      );
      return this.createReferenceSequenceDisplayFallback(subsequence, viewport, referenceHeight);
    }

    // Create Canvas renderer with optimized options for reference display
    const canvasOptions = {
      fontSize: 12, // Slightly smaller for reference
      fontFamily: 'Courier New, monospace',
      fontWeight: 'bold',
      backgroundColor: 'transparent',
      adaptiveHeight: true,
      minHeight: referenceHeight,
      maxHeight: referenceHeight,
      padding: 1, // Minimal padding for reference
    };

    try {
      const canvasRenderer = new CanvasSequenceRenderer(seqDisplay, subsequence, viewport, canvasOptions);

      // Store renderer for cleanup and updates (use WeakMap to avoid circular references)
      if (!this.referenceCanvasRenderers) {
        this.referenceCanvasRenderers = new Map();
      }
      this.referenceCanvasRenderers.set(displayId, canvasRenderer);

      console.log('✅ [createReferenceSequenceDisplay] Canvas reference renderer created successfully');

      return seqDisplay;
    } catch (error) {
      console.error('❌ [createReferenceSequenceDisplay] Failed to create Canvas renderer:', error);
      // Fall back to DOM rendering if Canvas fails
      return this.createReferenceSequenceDisplayFallback(subsequence, viewport, referenceHeight);
    }
  }

  /**
   * Fallback DOM-based reference sequence display for compatibility
   */
  createReferenceSequenceDisplayFallback(subsequence, viewport, referenceHeight) {
    console.log('🔄 [createReferenceSequenceDisplayFallback] Using DOM fallback for reference display');

    const seqDisplay = document.createElement('div');
    seqDisplay.className = 'reference-sequence-display reference-dom-fallback';
    seqDisplay.style.cssText = `
            position: relative;
            width: 100%;
            height: 100%;
            overflow: hidden;
            white-space: nowrap;
            display: flex;
            align-items: center;
        `;

    // Use simplified DOM rendering with adaptive sizing
    const sequenceLength = subsequence.length;

    // Create sequence bases with positioning
    for (let i = 0; i < subsequence.length; i++) {
      const baseElement = this.createReferenceBaseElement(subsequence[i], i, viewport, sequenceLength, referenceHeight);
      seqDisplay.appendChild(baseElement);
    }

    // Apply adaptive sizing after DOM is rendered
    setTimeout(() => {
      this.adjustReferenceSequenceDisplay(seqDisplay, subsequence, viewport, referenceHeight);
    }, 50);

    return seqDisplay;
  }

  /**
   * Create individual base element for reference sequence
   */
  createReferenceBaseElement(base, index, viewport, sequenceLength, height) {
    const baseElement = document.createElement('span');
    baseElement.className = `base-${base.toLowerCase()} reference-base-inline`;
    baseElement.textContent = base;

    // Calculate exact positioning to fill entire container
    const exactCharWidth = 100 / sequenceLength; // Use percentage-based width
    const leftPosition = index * exactCharWidth;

    baseElement.style.cssText = `
            position: absolute;
            left: ${leftPosition}%;
            width: ${exactCharWidth}%;
            height: 100%;
            font-size: 12px;
            font-family: 'Courier New', monospace;
            font-weight: bold;
            color: ${this.getBaseColor(base)};
            display: flex;
            align-items: center;
            justify-content: center;
            box-sizing: border-box;
        `;

    // Add tooltip with position info
    // FIX: Remove +1 offset - index is already 0-based within the subsequence
    const position = viewport.start + index;
    baseElement.title = `Position: ${position}, Base: ${base}`;

    return baseElement;
  }

  /**
   * Adjust reference sequence display after DOM is rendered
   */
  adjustReferenceSequenceDisplay(seqDisplay, subsequence, viewport, height) {
    if (!seqDisplay.parentElement) return;

    // Get actual container width
    const containerWidth = seqDisplay.parentElement.getBoundingClientRect().width || 800;
    const sequenceLength = subsequence.length;

    // Calculate optimal font size for reference display
    const availableWidth = containerWidth;
    const maxCharWidth = availableWidth / sequenceLength;

    // Reference sequence should be slightly smaller than main sequence
    const maxFontSize = Math.min(height * 0.7, 14); // 70% of height, max 14px
    const minFontSize = 6;

    let fontSize = maxFontSize;
    let estimatedCharWidth = fontSize * 0.6;

    // Adjust font size to fit
    while (estimatedCharWidth > maxCharWidth && fontSize > minFontSize) {
      fontSize -= 0.25;
      estimatedCharWidth = fontSize * 0.6;
    }

    const finalFontSize = Math.max(minFontSize, Math.min(maxFontSize, fontSize));

    console.log('🔧 [adjustReferenceSequenceDisplay] Adjusted reference display:', {
      containerWidth,
      sequenceLength,
      finalFontSize,
      maxCharWidth: maxCharWidth.toFixed(2),
    });

    // Update all base elements with new font size
    const baseElements = seqDisplay.querySelectorAll('.reference-base-inline');
    const exactCharWidth = 100 / baseElements.length;

    baseElements.forEach((element, index) => {
      const leftPosition = index * exactCharWidth;
      element.style.left = `${leftPosition}%`;
      element.style.width = `${exactCharWidth}%`;
      element.style.fontSize = `${finalFontSize}px`;
    });
  }

  /**
   * Get base color for reference sequence display
   */
  getBaseColor(base) {
    const baseColors = {
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
    return baseColors[base] || baseColors['N'];
  }

  /**
   * Create sequence visualization for Genes & Features track
   * Positioned between secondary ruler and gene elements
   */
  createGenesSequenceVisualization(trackContent, viewport, sequenceHeight, settings) {
    console.log(
      `🧬 [createGenesSequenceVisualization] Creating sequence display for genes track: ${viewport.start}-${viewport.end}, height: ${sequenceHeight}`
    );

    // Get reference sequence from genome browser
    const referenceSequence = this.getReferenceSequence(viewport.start, viewport.end);
    console.log(
      `🧬 [createGenesSequenceVisualization] Got reference sequence: ${referenceSequence ? referenceSequence.length + ' bases' : 'null'}`
    );

    // Check if detailed ruler exists to position sequence below it
    const detailedRulerElement = trackContent.querySelector('.detailed-ruler-container');
    let topOffset = 0;
    if (detailedRulerElement) {
      const rulerHeight = parseInt(getComputedStyle(detailedRulerElement).height) || 35;
      topOffset = rulerHeight;
    }

    // Create sequence container
    const sequenceContainer = document.createElement('div');
    sequenceContainer.className = 'genes-sequence-visualization';
    sequenceContainer.style.cssText = `
            position: absolute;
            top: ${topOffset}px;
            left: 0;
            right: 0;
            height: ${sequenceHeight}px;
            background: linear-gradient(to bottom, #f8f9fa 0%, #e9ecef 100%);
            border-bottom: 1px solid #ced4da;
            margin-bottom: 2px;
            z-index: 5;
            overflow: hidden;
        `;

    if (!referenceSequence) {
      console.warn(`🧬 [createGenesSequenceVisualization] No reference sequence available, creating placeholder`);

      // Create placeholder text when no reference sequence is available
      // Do not create placeholder text when no reference sequence is available
      console.warn(`🧬 [createGenesSequenceVisualization] No reference sequence available, skipping (clean view)`);
      return 0; // Return 0 height
    } else {
      // Use the same high-quality renderer as Single-line sequence track
      const sequenceDisplay = this.createReferenceSequenceDisplay(
        referenceSequence,
        viewport,
        sequenceHeight,
        settings
      );
      sequenceContainer.appendChild(sequenceDisplay);
    }

    trackContent.appendChild(sequenceContainer);

    console.log(
      `✅ [createGenesSequenceVisualization] Genes sequence visualization created with height: ${sequenceHeight}px`
    );

    return sequenceHeight;
  }

  /**
   * Render reference sequence text in SVG
   */
  renderReferenceSequenceInSVG(svg, referenceSequence, viewport, height, settings) {
    console.log(
      `🔍 [renderReferenceSequenceInSVG] Rendering ${referenceSequence.length} bases, viewport: ${viewport.start}-${viewport.end}`
    );

    // Calculate optimal font size based on available space for each base
    const availableWidth = 100; // SVG viewBox width
    const availableHeight = height;

    // Calculate space per base and determine optimal font size
    const spacePerBase = availableWidth / referenceSequence.length;

    // Font size calculation: balance between height constraint and width constraint
    const heightBasedFontSize = availableHeight * 0.6; // 60% of available height
    const widthBasedFontSize = spacePerBase * 0.8; // 80% of available width per base

    // Use the smaller of the two constraints, with reasonable min/max limits
    const optimalFontSize = Math.min(
      heightBasedFontSize,
      widthBasedFontSize,
      14 // max font size
    );
    const fontSize = Math.max(optimalFontSize, 4); // min font size

    // Determine if font is readable (not too small)
    const isReadable = fontSize >= 6;

    console.log(
      `🔍 [renderReferenceSequenceInSVG] spacePerBase: ${spacePerBase.toFixed(2)}, fontSize: ${fontSize.toFixed(1)}, isReadable: ${isReadable}`
    );

    if (isReadable) {
      // Font is readable - show actual sequence bases
      if (spacePerBase >= 8) {
        // Enough space per base - show all bases
        console.log(`🔍 [renderReferenceSequenceInSVG] Showing all ${referenceSequence.length} bases`);
        for (let i = 0; i < referenceSequence.length; i++) {
          const base = referenceSequence[i];
          const x = ((i + 0.5) / referenceSequence.length) * 100; // Center each base
          this.createBaseElement(svg, base, x, height / 2, fontSize, settings);
        }
      } else {
        // Limited space - show sampled bases with intelligent spacing
        const minSpacePerBase = 6; // Minimum 6px per base for visibility
        const maxBases = Math.max(1, Math.floor(availableWidth / minSpacePerBase));
        const sampleStep = Math.ceil(referenceSequence.length / maxBases);
        console.log(
          `🔍 [renderReferenceSequenceInSVG] Showing sampled bases: ${maxBases} of ${referenceSequence.length} (step: ${sampleStep})`
        );

        for (let i = 0; i < referenceSequence.length && Math.floor(i / sampleStep) < maxBases; i += sampleStep) {
          const base = referenceSequence[i];
          const sampleIndex = Math.floor(i / sampleStep);
          const x = ((sampleIndex + 0.5) / maxBases) * 100;
          this.createBaseElement(svg, base, x, height / 2, fontSize, settings);
        }
      }
    } else {
      // Font too small to be readable - show background pattern only
      console.log(
        `🔍 [renderReferenceSequenceInSVG] Font too small (${fontSize.toFixed(1)}px), showing background pattern`
      );

      // Create subtle background pattern to indicate reference sequence presence
      const backgroundRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      backgroundRect.setAttribute('x', '0');
      backgroundRect.setAttribute('y', '0');
      backgroundRect.setAttribute('width', '100');
      backgroundRect.setAttribute('height', height);
      backgroundRect.setAttribute('fill', '#f8f9fa');
      backgroundRect.setAttribute('stroke', '#dee2e6');
      backgroundRect.setAttribute('stroke-width', '0.5');
      svg.appendChild(backgroundRect);

      // Add subtle pattern to indicate this is reference sequence area
      const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      const patternDef = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
      patternDef.setAttribute('id', 'refPattern');
      patternDef.setAttribute('x', '0');
      patternDef.setAttribute('y', '0');
      patternDef.setAttribute('width', '4');
      patternDef.setAttribute('height', '4');
      patternDef.setAttribute('patternUnits', 'userSpaceOnUse');

      const patternRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      patternRect.setAttribute('width', '2');
      patternRect.setAttribute('height', '2');
      patternRect.setAttribute('fill', '#e9ecef');

      patternDef.appendChild(patternRect);
      pattern.appendChild(patternDef);
      svg.appendChild(pattern);

      const patternOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      patternOverlay.setAttribute('x', '0');
      patternOverlay.setAttribute('y', '0');
      patternOverlay.setAttribute('width', '100');
      patternOverlay.setAttribute('height', height);
      patternOverlay.setAttribute('fill', 'url(#refPattern)');
      svg.appendChild(patternOverlay);
    }
  }

  /**
   * Create a single base element for reference sequence display with optimal positioning
   */
  createBaseElement(svg, base, x, y, fontSize, settings) {
    const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textElement.setAttribute('x', x);
    textElement.setAttribute('y', y);
    textElement.setAttribute('font-size', `${fontSize}px`);
    textElement.setAttribute('font-family', settings.referenceFontFamily || 'Monaco, "Courier New", monospace');
    textElement.setAttribute('font-weight', '600'); // Slightly bold for better visibility
    textElement.setAttribute('text-anchor', 'middle');
    textElement.setAttribute('dominant-baseline', 'central');
    textElement.setAttribute('fill', this.getBaseColor(base));
    textElement.textContent = base.toUpperCase();

    svg.appendChild(textElement);
  }

  /**
   * Get color for DNA base - using standard biochemical color scheme
   */
  getBaseColor(base) {
    const colors = {
      A: '#FF0000', // Bright Red (Adenine)
      T: '#0000FF', // Bright Blue (Thymine)
      G: '#00AA00', // Bright Green (Guanine)
      C: '#FF8800', // Bright Orange (Cytosine)
      U: '#0000FF', // Bright Blue (Uracil, same as T)
      N: '#666666', // Dark Gray (Unknown/any base)
    };
    return colors[base.toUpperCase()] || '#333333';
  }

  /**
   * Calculate coverage data for visualization
   */
  calculateCoverage(reads, start, end) {
    const range = end - start;
    const binSize = Math.max(1, Math.floor(range / 1000)); // 1000 bins max
    const numBins = Math.ceil(range / binSize);
    const coverage = new Array(numBins).fill(0);

    reads.forEach(read => {
      const readStart = Math.max(read.start, start);
      const readEnd = Math.min(read.end, end);

      if (readStart <= readEnd) {
        const startBin = Math.floor((readStart - start) / binSize);
        const endBin = Math.min(Math.floor((readEnd - start) / binSize), numBins - 1);

        for (let i = startBin; i <= endBin; i++) {
          coverage[i]++;
        }
      }
    });

    return coverage;
  }

  /**
   * Create reference sequence visualization between coverage and reads
   */
  createReferenceSequenceVisualization(trackContent, chromosome, viewport, referenceHeight, coverageHeight, settings) {
    // Get reference sequence for current viewport
    const sequence = this.getReferenceSequence(viewport.start, viewport.end, chromosome);
    if (!sequence || sequence.length === 0) {
      console.warn('No reference sequence available for viewport:', viewport);
      return;
    }

    // Calculate how many bases can fit in the current view
    // Use the viewport width calculation that matches the main tracks
    const containerWidth =
      this.getCurrentViewport().pixelWidth ||
      trackContent.getBoundingClientRect().width ||
      trackContent.offsetWidth ||
      800;

    // Create reference container
    const referenceContainer = document.createElement('div');
    referenceContainer.className = 'reference-sequence-visualization';
    referenceContainer.style.cssText = `
            position: absolute;
            top: ${coverageHeight}px;
            left: 0;
            width: ${containerWidth}px;
            height: ${referenceHeight}px;
            background: linear-gradient(to bottom, #f0f8ff 0%, #e6f3ff 100%);
            border-bottom: 1px solid #b3d9ff;
            border-top: 1px solid #b3d9ff;
            overflow: hidden;
            z-index: 2;
            font-family: 'Courier New', 'Monaco', 'Consolas', monospace;
        `;
    const viewRange = viewport.end - viewport.start;
    const basesPerPixel = viewRange / containerWidth;

    // Determine display mode based on zoom level
    if (basesPerPixel <= 1) {
      // High zoom - show individual bases
      this.renderIndividualBases(referenceContainer, sequence, viewport, referenceHeight, containerWidth);
    } else if (basesPerPixel <= 10) {
      // Medium zoom - show bases with reduced detail
      this.renderReducedBases(referenceContainer, sequence, viewport, referenceHeight, containerWidth);
    } else {
      // Low zoom - show summary information
      this.renderSequenceSummary(referenceContainer, sequence, viewport, referenceHeight);
    }

    // Add position labels
    this.addReferencePositionLabels(referenceContainer, viewport, referenceHeight);

    trackContent.appendChild(referenceContainer);

    console.log(
      `🧬 Reference sequence visualization created: ${sequence.length} bases, zoom level: ${basesPerPixel.toFixed(2)} bp/px`
    );
  }

  /**
   * Render individual bases for high zoom levels
   */
  renderIndividualBases(container, sequence, viewport, height, containerWidth) {
    const basesContainer = document.createElement('div');
    basesContainer.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 100%;
            display: flex;
            align-items: center;
            padding: 0 2px;
            box-sizing: border-box;
        `;

    const baseWidth = containerWidth / sequence.length;
    const fontSize = Math.min(12, Math.max(8, baseWidth * 0.8));

    for (let i = 0; i < sequence.length; i++) {
      const base = sequence[i].toUpperCase();
      const baseElement = document.createElement('div');
      baseElement.textContent = base;
      baseElement.style.cssText = `
                width: ${baseWidth}px;
                height: ${height - 4}px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: ${fontSize}px;
                font-weight: bold;
                color: ${this.getBaseColor(base)};
                background: ${this.getBaseBackground(base)};
                border: 1px solid rgba(0,0,0,0.1);
                box-sizing: border-box;
                text-align: center;
                line-height: 1;
                flex-shrink: 0;
            `;
      basesContainer.appendChild(baseElement);
    }

    container.appendChild(basesContainer);
  }

  /**
   * Render bases with reduced detail for medium zoom levels
   */
  renderReducedBases(container, sequence, viewport, height, containerWidth) {
    const basesContainer = document.createElement('div');
    basesContainer.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 100%;
            display: flex;
            align-items: center;
            padding: 0 2px;
            box-sizing: border-box;
        `;

    // Group bases into chunks for better visibility
    const chunkSize = Math.max(1, Math.floor(sequence.length / 100));
    const chunks = [];

    for (let i = 0; i < sequence.length; i += chunkSize) {
      const chunk = sequence.substring(i, Math.min(i + chunkSize, sequence.length));
      chunks.push(chunk);
    }

    const chunkWidth = containerWidth / chunks.length;

    chunks.forEach((chunk, index) => {
      const chunkElement = document.createElement('div');
      const dominantBase = this.getDominantBase(chunk);
      chunkElement.textContent = dominantBase;
      chunkElement.style.cssText = `
                width: ${chunkWidth}px;
                height: ${height - 4}px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 10px;
                font-weight: bold;
                color: ${this.getBaseColor(dominantBase)};
                background: ${this.getBaseBackground(dominantBase)};
                border: 1px solid rgba(0,0,0,0.1);
                box-sizing: border-box;
                flex-shrink: 0;
            `;
      basesContainer.appendChild(chunkElement);
    });

    container.appendChild(basesContainer);
  }

  /**
   * Render sequence summary for low zoom levels
   */
  renderSequenceSummary(container, sequence, viewport, height) {
    const summaryDiv = document.createElement('div');
    const gcContent = this.calculateGCContent(sequence);
    const length = sequence.length;

    summaryDiv.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(255,255,255,0.9);
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 600;
            color: #495057;
            text-align: center;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        `;
    summaryDiv.textContent = `${length.toLocaleString()} bp | GC: ${gcContent.toFixed(1)}%`;

    container.appendChild(summaryDiv);
  }

  /**
   * Add position labels to reference sequence
   */
  addReferencePositionLabels(container, viewport, height) {
    const labelsDiv = document.createElement('div');
    labelsDiv.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 10px;
            font-size: 8px;
            color: #6c757d;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0 2px;
            pointer-events: none;
        `;

    const startLabel = document.createElement('span');
    startLabel.textContent = viewport.start.toLocaleString();
    const endLabel = document.createElement('span');
    endLabel.textContent = viewport.end.toLocaleString();

    labelsDiv.appendChild(startLabel);
    labelsDiv.appendChild(endLabel);

    container.appendChild(labelsDiv);
  }

  /**
   * Get color for DNA base
   */
  getBaseColor(base) {
    const colors = {
      A: '#e74c3c',
      T: '#3498db',
      G: '#2ecc71',
      C: '#f39c12',
      N: '#95a5a6',
    };
    return colors[base] || '#95a5a6';
  }

  /**
   * Get background color for DNA base
   */
  getBaseBackground(base) {
    const backgrounds = {
      A: 'rgba(231, 76, 60, 0.1)',
      T: 'rgba(52, 152, 219, 0.1)',
      G: 'rgba(46, 204, 113, 0.1)',
      C: 'rgba(243, 156, 18, 0.1)',
      N: 'rgba(149, 165, 166, 0.1)',
    };
    return backgrounds[base] || 'rgba(149, 165, 166, 0.1)';
  }

  /**
   * Get dominant base in a sequence chunk
   */
  getDominantBase(sequence) {
    const counts = { A: 0, T: 0, G: 0, C: 0, N: 0 };
    for (const base of sequence.toUpperCase()) {
      if (counts[base] !== undefined) counts[base]++;
    }
    return Object.keys(counts).reduce((a, b) => (counts[a] > counts[b] ? a : b));
  }

  /**
   * Calculate GC content percentage
   */
  calculateGCContent(sequence) {
    const gc = (sequence.match(/[GC]/gi) || []).length;
    return (gc / sequence.length) * 100;
  }

  /**
   * Setup event listeners for reads settings
   */
  setupGenesSettingsEventListeners(bodyElement) {
    // Wheel zoom sensitivity slider
    const zoomSensitivitySlider = bodyElement.querySelector('#genesWheelZoomSensitivity');
    const zoomSensitivityValue = bodyElement.querySelector('#genesWheelZoomSensitivityValue');

    if (zoomSensitivitySlider && zoomSensitivityValue) {
      // Update display value in real-time as user drags slider
      zoomSensitivitySlider.addEventListener('input', e => {
        zoomSensitivityValue.textContent = e.target.value;
      });

      // Note: Setting will be applied when Apply button is clicked
      zoomSensitivitySlider.addEventListener('change', e => {
        console.log(
          `🔧 [setupGenesSettingsEventListeners] Zoom sensitivity changed to: ${e.target.value} (will apply on Apply button)`
        );
      });
    }

    // Override global zoom checkbox - setting will be applied when Apply button is clicked
    const overrideGlobalZoomCheckbox = bodyElement.querySelector('#genesOverrideGlobalZoom');
    if (overrideGlobalZoomCheckbox) {
      overrideGlobalZoomCheckbox.addEventListener('change', e => {
        console.log(
          `🔧 [setupGenesSettingsEventListeners] Override global zoom changed to: ${e.target.checked} (will apply on Apply button)`
        );
      });
    }

    // Sequence display checkbox - enables/disables sequence height input
    const showSequenceCheckbox = bodyElement.querySelector('#genesShowSequence');
    const sequenceHeightInput = bodyElement.querySelector('#genesSequenceHeight');

    if (showSequenceCheckbox && sequenceHeightInput) {
      showSequenceCheckbox.addEventListener('change', e => {
        sequenceHeightInput.disabled = !e.target.checked;
        console.log(
          `🔧 [setupGenesSettingsEventListeners] Show sequence changed to: ${e.target.checked} (will apply on Apply button)`
        );
      });
    }

    // Highlight effect selection - setting will be applied when Apply button is clicked
    const highlightEffectSelect = bodyElement.querySelector('#genesHighlightEffect');
    if (highlightEffectSelect) {
      highlightEffectSelect.addEventListener('change', e => {
        console.log(
          `🔧 [setupGenesSettingsEventListeners] Highlight effect changed to: ${e.target.value} (will apply on Apply button)`
        );
      });
    }

    // Auto-highlight sequence checkbox - setting will be applied when Apply button is clicked
    const autoHighlightSequenceCheckbox = bodyElement.querySelector('#genesAutoHighlightSequence');
    if (autoHighlightSequenceCheckbox) {
      autoHighlightSequenceCheckbox.addEventListener('change', e => {
        console.log(
          `🔧 [setupGenesSettingsEventListeners] Auto-highlight sequence changed to: ${e.target.checked} (will apply on Apply button)`
        );
      });
    }
  }

  setupReadsSettingsEventListeners(bodyElement) {
    // Rendering mode selection - no immediate application, only on Apply button
    const renderingModeSelect = bodyElement.querySelector('#readsRenderingMode');
    if (renderingModeSelect) {
      // Only add visual feedback, actual application happens on Apply button
      renderingModeSelect.addEventListener('change', () => {
        console.log(
          `🔧 [setupReadsSettingsEventListeners] Rendering mode selection changed to: ${renderingModeSelect.value} (will apply on Apply button)`
        );
      });
    }

    // Coverage visualization toggle
    const coverageCheckbox = bodyElement.querySelector('#readsShowCoverage');
    const coverageHeightGroup = bodyElement.querySelector('#coverageHeightGroup');
    const coverageColorGroup = bodyElement.querySelector('#coverageColorGroup');

    if (coverageCheckbox && coverageHeightGroup && coverageColorGroup) {
      const toggleCoverageSettings = () => {
        const isChecked = coverageCheckbox.checked;
        coverageHeightGroup.style.display = isChecked ? 'block' : 'none';
        coverageColorGroup.style.display = isChecked ? 'block' : 'none';
      };

      coverageCheckbox.addEventListener('change', toggleCoverageSettings);
      toggleCoverageSettings(); // Initial state
    }

    // Reference sequence visualization toggle
    const referenceCheckbox = bodyElement.querySelector('#readsShowReference');
    const referenceHeightGroup = bodyElement.querySelector('#referenceHeightGroup');

    if (referenceCheckbox && referenceHeightGroup) {
      const toggleReferenceSettings = () => {
        const isChecked = referenceCheckbox.checked;
        referenceHeightGroup.style.display = isChecked ? 'block' : 'none';
      };

      referenceCheckbox.addEventListener('change', toggleReferenceSettings);
      toggleReferenceSettings(); // Initial state
    }

    // Vertical scrolling toggle
    const verticalScrollCheckbox = bodyElement.querySelector('#readsEnableVerticalScroll');
    const maxVisibleRowsGroup = bodyElement.querySelector('#readsMaxVisibleRowsGroup');
    const maxRowsGroup = bodyElement.querySelector('#readsMaxRowsGroup');

    if (verticalScrollCheckbox && maxVisibleRowsGroup && maxRowsGroup) {
      const toggleScrollSettings = () => {
        const isChecked = verticalScrollCheckbox.checked;
        maxVisibleRowsGroup.style.display = isChecked ? 'block' : 'none';
        maxRowsGroup.style.display = isChecked ? 'none' : 'block';
      };

      verticalScrollCheckbox.addEventListener('change', toggleScrollSettings);
      toggleScrollSettings(); // Initial state
    }

    // Sequence display toggle
    const sequenceCheckbox = bodyElement.querySelector('#readsShowSequences');
    const forceSequencesGroup = bodyElement.querySelector('#readsForceSequencesGroup');
    const autoFontSizeGroup = bodyElement.querySelector('#readsAutoFontSizeGroup');
    const sequenceThresholdGroup = bodyElement.querySelector('#readsSequenceThresholdGroup');
    const referenceFontGroup = bodyElement.querySelector('#readsReferenceFontGroup');
    const sequenceFontGroup = bodyElement.querySelector('#readsSequenceFontGroup');
    const mismatchColorGroup = bodyElement.querySelector('#readsMismatchColorGroup');

    // Force sequences toggle - define first so it can be used by main toggle
    const forceSequenceCheckbox = bodyElement.querySelector('#readsForceSequences');
    let updateForceSequenceSettings = () => { }; // Default empty function

    if (forceSequenceCheckbox) {
      updateForceSequenceSettings = () => {
        const isSequenceEnabled = sequenceCheckbox ? sequenceCheckbox.checked : false;
        const isForceEnabled = forceSequenceCheckbox.checked;

        if (sequenceThresholdGroup) {
          sequenceThresholdGroup.style.display = isSequenceEnabled && !isForceEnabled ? 'block' : 'none';
        }
        if (autoFontSizeGroup) {
          autoFontSizeGroup.style.display = isSequenceEnabled && isForceEnabled ? 'block' : 'none';
        }
        if (sequenceFontGroup) {
          // Hide manual font size when auto font size is enabled
          const autoFontCheckbox = bodyElement.querySelector('#readsAutoFontSize');
          const isAutoFont = autoFontCheckbox ? autoFontCheckbox.checked : true;
          const shouldShowFontGroup = isSequenceEnabled && (!isForceEnabled || !isAutoFont);
          sequenceFontGroup.style.display = shouldShowFontGroup ? 'block' : 'none';
        }
      };

      forceSequenceCheckbox.addEventListener('change', updateForceSequenceSettings);
      updateForceSequenceSettings(); // Initial state
    }

    if (sequenceCheckbox) {
      const toggleSequenceSettings = () => {
        const isChecked = sequenceCheckbox.checked;
        if (forceSequencesGroup) forceSequencesGroup.style.display = isChecked ? 'block' : 'none';
        if (sequenceFontGroup) sequenceFontGroup.style.display = isChecked ? 'block' : 'none';
        if (mismatchColorGroup) mismatchColorGroup.style.display = isChecked ? 'block' : 'none';

        // Update force sequences dependent controls
        updateForceSequenceSettings();
      };

      sequenceCheckbox.addEventListener('change', toggleSequenceSettings);
      toggleSequenceSettings(); // Initial state
    }

    // Auto font size toggle
    const autoFontCheckbox = bodyElement.querySelector('#readsAutoFontSize');
    if (autoFontCheckbox) {
      const updateAutoFontSettings = () => {
        const isAutoEnabled = autoFontCheckbox.checked;
        if (sequenceFontGroup) {
          const sequenceEnabled = sequenceCheckbox ? sequenceCheckbox.checked : false;
          const forceEnabled = forceSequenceCheckbox ? forceSequenceCheckbox.checked : false;
          const shouldShowFontGroup = sequenceEnabled && (!forceEnabled || !isAutoEnabled);
          sequenceFontGroup.style.display = shouldShowFontGroup ? 'block' : 'none';
        }
      };

      autoFontCheckbox.addEventListener('change', updateAutoFontSettings);
      updateAutoFontSettings(); // Initial state
    }

    // Reference sequence font toggle
    const referenceFontCheckbox = bodyElement.querySelector('#readsShowReference');
    if (referenceFontCheckbox && referenceFontGroup) {
      const toggleReferenceFontSettings = () => {
        const isChecked = referenceFontCheckbox.checked;
        referenceFontGroup.style.display = isChecked ? 'block' : 'none';
      };

      referenceFontCheckbox.addEventListener('change', toggleReferenceFontSettings);
      toggleReferenceFontSettings(); // Initial state
    }
  }

  /**
   * Setup event listeners for variants track settings
   */
  setupVariantsSettingsEventListeners(bodyElement) {
    // Color mode selection - show/hide custom color group
    const colorModeSelect = bodyElement.querySelector('#variantsColorMode');
    const customColorGroup = bodyElement.querySelector('#customColorGroup');

    if (colorModeSelect && customColorGroup) {
      const toggleCustomColor = () => {
        const isCustom = colorModeSelect.value === 'custom';
        customColorGroup.style.display = isCustom ? 'block' : 'none';
      };

      colorModeSelect.addEventListener('change', toggleCustomColor);
      toggleCustomColor(); // Initial state
    }
  }

  /**
   * Show context menu for gene elements
   */
  showGeneContextMenu(event, gene) {
    // Remove any existing context menu
    const existingMenu = document.querySelector('.gene-context-menu');
    if (existingMenu) {
      existingMenu.remove();
    }

    // Create context menu
    const menu = document.createElement('div');
    menu.className = 'gene-context-menu';
    menu.style.cssText = `
            position: fixed;
            left: ${event.clientX}px;
            top: ${event.clientY}px;
            background: white;
            border: 1px solid #ccc;
            border-radius: 4px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            z-index: 10000;
            min-width: 180px;
            font-size: 14px;
        `;

    // Create menu items
    const menuItems = [
      {
        text: 'View Details',
        icon: 'fas fa-info-circle',
        action: () => this.showGeneDetails(gene),
      },
      {
        text: 'Open in New Tab',
        icon: 'fas fa-external-link-alt',
        action: () => {
          if (this.genomeBrowser.tabManager) {
            this.genomeBrowser.tabManager.createTabForGene(gene);
          }
        },
      },
      {
        text: 'Copy Gene Info',
        icon: 'fas fa-copy',
        action: () => {
          const geneInfo = `Gene: ${gene.name || gene.id || 'Unknown'}\nPosition: ${gene.start}-${gene.end}\nStrand: ${gene.strand}\nType: ${gene.type}`;
          navigator.clipboard.writeText(geneInfo);
        },
      },
    ];

    menuItems.forEach((item, index) => {
      const menuItem = document.createElement('div');
      menuItem.className = 'context-menu-item';
      menuItem.style.cssText = `
                padding: 8px 12px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 8px;
                border-bottom: ${index < menuItems.length - 1 ? '1px solid #eee' : 'none'};
            `;

      menuItem.innerHTML = `
                <i class="${item.icon}" style="color: #666; width: 14px;"></i>
                <span>${item.text}</span>
            `;

      menuItem.addEventListener('mouseenter', () => {
        menuItem.style.backgroundColor = '#f5f5f5';
      });

      menuItem.addEventListener('mouseleave', () => {
        menuItem.style.backgroundColor = 'transparent';
      });

      menuItem.addEventListener('click', () => {
        item.action();
        menu.remove();
      });

      menu.appendChild(menuItem);
    });

    // Add to document
    document.body.appendChild(menu);

    // Remove menu when clicking elsewhere
    const removeMenu = e => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', removeMenu);
      }
    };

    setTimeout(() => {
      document.addEventListener('click', removeMenu);
    }, 0);

    // Adjust menu position if it goes off screen
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = event.clientX - rect.width + 'px';
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = event.clientY - rect.height + 'px';
    }
  }

  /**
   * Make modal draggable
   */
  makeModalDraggable(modal) {
    const header = modal.querySelector('.draggable-header');
    if (!header) return;

    let isDragging = false;
    let startX, startY, startLeft, startTop;

    header.addEventListener('mousedown', e => {
      if (e.target.classList.contains('modal-close')) return;

      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;

      const rect = modal.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;

      modal.classList.add('dragging');
      e.preventDefault();
    });

    document.addEventListener('mousemove', e => {
      if (!isDragging) return;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      const newLeft = startLeft + deltaX;
      const newTop = startTop + deltaY;

      // Keep modal within viewport bounds
      const maxLeft = window.innerWidth - modal.offsetWidth;
      const maxTop = window.innerHeight - modal.offsetHeight;

      modal.style.left = Math.max(0, Math.min(newLeft, maxLeft)) + 'px';
      modal.style.top = Math.max(0, Math.min(newTop, maxTop)) + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        modal.classList.remove('dragging');
      }
    });
  }

  /**
   * Make modal resizable
   */
  makeModalResizable(modal) {
    const content = modal.querySelector('.resizable-modal-content');
    if (!content) return;

    const handles = modal.querySelectorAll('.resize-handle');
    let isResizing = false;
    let currentHandle = null;
    let startX, startY, startWidth, startHeight, startLeft, startTop;

    handles.forEach(handle => {
      handle.addEventListener('mousedown', e => {
        isResizing = true;
        currentHandle = handle;
        startX = e.clientX;
        startY = e.clientY;

        const rect = content.getBoundingClientRect();
        startWidth = rect.width;
        startHeight = rect.height;
        startLeft = rect.left;
        startTop = rect.top;

        e.preventDefault();
        e.stopPropagation();
      });
    });

    document.addEventListener('mousemove', e => {
      if (!isResizing || !currentHandle) return;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      const handleClass = currentHandle.className;
      let newWidth = startWidth;
      let newHeight = startHeight;
      let newLeft = startLeft;
      let newTop = startTop;

      // Handle different resize directions
      if (handleClass.includes('e')) {
        newWidth = Math.max(400, startWidth + deltaX);
      }
      if (handleClass.includes('w')) {
        const widthChange = Math.min(deltaX, startWidth - 400);
        newWidth = startWidth - widthChange;
        newLeft = startLeft + widthChange;
      }
      if (handleClass.includes('s')) {
        newHeight = Math.max(300, startHeight + deltaY);
      }
      if (handleClass.includes('n')) {
        const heightChange = Math.min(deltaY, startHeight - 300);
        newHeight = startHeight - heightChange;
        newTop = startTop + heightChange;
      }

      // Apply new dimensions
      content.style.width = newWidth + 'px';
      content.style.height = newHeight + 'px';

      // Update modal dimensions to match content
      modal.style.width = newWidth + 'px';
      modal.style.height = newHeight + 'px';

      // Adjust position if resizing from left or top
      if (handleClass.includes('w') || handleClass.includes('n')) {
        modal.style.left = newLeft + 'px';
        modal.style.top = newTop + 'px';
      }
    });

    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        currentHandle = null;
      }
    });
  }

  /**
   * Reset track settings to default values
   */
  resetTrackSettingsToDefaults() {
    const modal = document.getElementById('trackSettingsModal');
    const trackType = modal?.dataset.trackType;

    if (!trackType) {
      console.warn('No track type specified for reset');
      return;
    }

    if (
      confirm(
        `Are you sure you want to reset ${trackType} track settings to their default values? This action cannot be undone.`
      )
    ) {
      // Define default settings for different track types
      const defaultSettings = {
        sequence: {
          visible: true,
          height: 60,
          displayMode: 'letters',
          showCoordinates: true,
          fontSize: 12,
        },
        genes: {
          visible: true,
          height: 120,
          showLabels: true,
          showArrows: true,
          colorBy: 'type',
          fontSize: 10,
          wheelZoomSensitivity: 0.1,
          overrideGlobalZoom: false,
        },
        gc: {
          visible: true,
          height: 80,
          windowSize: 100,
          showAverage: true,
          color: '#4CAF50',
        },
        reads: {
          visible: true,
          height: 200,
          showSequences: false,
          maxReads: 1000,
          colorBy: 'base',
        },
      };

      const settings = defaultSettings[trackType] || {};

      // Apply default settings to form
      Object.keys(settings).forEach(key => {
        const element = modal.querySelector(`[name="${key}"], #${key}`);
        if (element) {
          if (element.type === 'checkbox') {
            element.checked = settings[key];
          } else {
            element.value = settings[key];
          }
        }
      });

      // Show notification
      if (this.genomeBrowser && this.genomeBrowser.showNotification) {
        this.genomeBrowser.showNotification(`${trackType} track settings reset to defaults successfully!`, 'success');
      }
    }
  }

  /**
   * Canvas renderer management methods
   */

  /**
   * Apply drag transform to Canvas-based sequence tracks
   */
  applyCanvasDragTransform(deltaX, deltaY = 0, targetTrackType = null) {
    this.canvasRenderers.forEach((renderer, trackId) => {
      try {
        // If targetTrackType is specified, only apply to that track type
        if (targetTrackType) {
          const trackElement = document.querySelector(`[data-track-id="${trackId}"]`);
          const trackContainer = trackElement ? trackElement.closest(`[data-track-type]`) : null;
          const trackType = trackContainer ? trackContainer.getAttribute('data-track-type') : null;

          if (trackType !== targetTrackType) {
            return; // Skip this renderer
          }
        }

        renderer.applyDragTransform(deltaX, deltaY);
      } catch (error) {
        console.error(`Failed to apply drag transform to Canvas renderer ${trackId}:`, error);
      }
    });
  }

  /**
   * Reset drag transforms for all Canvas renderers
   */
  resetCanvasDragTransforms() {
    this.canvasRenderers.forEach((renderer, trackId) => {
      try {
        renderer.resetDragTransform();
      } catch (error) {
        console.error(`Failed to reset drag transform for Canvas renderer ${trackId}:`, error);
      }
    });
  }

  /**
   * Update Canvas renderers with new sequence data
   */
  updateCanvasSequence(newSequence, newViewport) {
    this.canvasRenderers.forEach((renderer, trackId) => {
      try {
        renderer.updateSequence(newSequence, newViewport);
      } catch (error) {
        console.error(`Failed to update Canvas renderer ${trackId}:`, error);
      }
    });
  }

  /**
   * Get performance statistics from all Canvas renderers
   */
  getCanvasPerformanceStats() {
    const stats = {};
    this.canvasRenderers.forEach((renderer, trackId) => {
      try {
        stats[trackId] = renderer.getPerformanceStats();
      } catch (error) {
        console.error(`Failed to get performance stats from Canvas renderer ${trackId}:`, error);
        stats[trackId] = { error: error.message };
      }
    });
    return stats;
  }

  /**
   * Clean up Canvas renderers when tracks are removed
   */
  cleanupCanvasRenderer(trackId) {
    const renderer = this.canvasRenderers.get(trackId);
    if (renderer) {
      try {
        renderer.destroy();
        this.canvasRenderers.delete(trackId);
        console.log(`✅ [TrackRenderer] Canvas renderer ${trackId} cleaned up successfully`);
      } catch (error) {
        console.error(`❌ [TrackRenderer] Failed to cleanup Canvas renderer ${trackId}:`, error);
      }
    }
  }

  /**
   * Clean up all Canvas renderers
   */
  cleanupAllCanvasRenderers() {
    console.log(`🧹 [TrackRenderer] Cleaning up ${this.canvasRenderers.size} Canvas renderers`);

    const trackIds = Array.from(this.canvasRenderers.keys());
    trackIds.forEach(trackId => {
      this.cleanupCanvasRenderer(trackId);
    });

    console.log('✅ [TrackRenderer] All Canvas renderers cleaned up');
  }

  /**
   * Clean up Canvas renderers for removed tracks
   */
  cleanupRemovedCanvasRenderers() {
    const existingTrackIds = new Set();

    // Check which Canvas containers still exist in DOM
    document.querySelectorAll('[data-track-id]').forEach(element => {
      const trackId = element.getAttribute('data-track-id');
      if (trackId) {
        existingTrackIds.add(trackId);
      }
    });

    // Clean up renderers for tracks that no longer exist
    const renderersToCleanup = [];
    this.canvasRenderers.forEach((renderer, trackId) => {
      if (!existingTrackIds.has(trackId)) {
        renderersToCleanup.push(trackId);
      }
    });

    renderersToCleanup.forEach(trackId => {
      this.cleanupCanvasRenderer(trackId);
    });

    if (renderersToCleanup.length > 0) {
      console.log(`🧹 [TrackRenderer] Cleaned up ${renderersToCleanup.length} orphaned Canvas renderers`);
    }
  }

  /**
   * Refresh a specific track to apply new settings
   */
  /**
   * Update a specific setting for a track and optionally refresh it
   */
  updateTrackSetting(trackType, settingKey, settingValue, applyImmediately = false) {
    console.log(`🔧 [updateTrackSetting] Updating ${trackType}.${settingKey} = ${settingValue}`);

    // Ensure trackSettings exists
    if (!this.trackSettings) {
      this.trackSettings = {};
    }

    // Ensure track settings exist
    if (!this.trackSettings[trackType]) {
      this.trackSettings[trackType] = this.getTrackSettings(trackType);
    }

    // Update the specific setting
    this.trackSettings[trackType][settingKey] = settingValue;

    console.log(`🔧 [updateTrackSetting] Updated ${trackType} settings:`, this.trackSettings[trackType]);

    // Save the updated settings
    this.saveTrackSettings(trackType, this.trackSettings[trackType]);

    // Apply settings immediately if requested
    if (applyImmediately) {
      console.log(`🔧 [updateTrackSetting] Applying settings immediately for ${trackType}`);
      this.applySettingsToTrack(trackType, this.trackSettings[trackType]);
    }
  }

  /**
   * Sync header toggle buttons with current settings
   */
  syncReadsToggleButtons(settings) {
    // Map settings keys to toggle types
    const settingToToggle = {
      showCoverage: 'readsCoverage',
      showReference: 'readsReference',
      showReads: 'readsReads',
    };

    Object.keys(settingToToggle).forEach(settingKey => {
      const toggleType = settingToToggle[settingKey];
      // Find buttons with this toggle type
      const buttons = document.querySelectorAll(`.track-reads-toggle-btn[data-toggle-type="${toggleType}"]`);

      buttons.forEach(btn => {
        // Determine state: default to true if undefined, otherwise use setting value
        const isActive = settings[settingKey] !== false;

        // Update internal state
        this.elementVisibilityStates[toggleType] = isActive;

        // Update visual state
        if (isActive) {
          btn.style.background = 'white';
          btn.style.color = '#333';
          btn.classList.add('active');
        } else {
          btn.style.background = '#eee';
          btn.style.color = '#aaa';
          btn.classList.remove('active');
        }
      });
    });

    // Also update any active renderers to ensure they match current settings
    // This handles the case where settings change from the panel -> renderers need update
    if (this.canvasRenderers) {
      this.canvasRenderers.forEach(renderer => {
        if (renderer && typeof renderer.updateOptions === 'function') {
          renderer.updateOptions(settings);
        }
      });
    }
  }

  refreshTrack(trackType) {
    console.log(`🔄 [TrackRenderer] Refreshing ${trackType} track`);

    const currentChr = document.getElementById('chromosomeSelect')?.value;
    if (!currentChr) {
      console.warn('No chromosome selected for track refresh');
      return;
    }

    // Find and remove existing track
    const existingTrack = document.querySelector(`[data-track-type="${trackType}"]`);
    if (existingTrack) {
      // Clean up any Canvas renderers for this track
      const trackId = existingTrack.querySelector('[data-track-id]')?.getAttribute('data-track-id');
      if (trackId) {
        this.cleanupCanvasRenderer(trackId);
      }
      existingTrack.remove();
    }

    // Recreate the track with new settings
    this.genomeBrowser.displayGenomeView(currentChr, this.genomeBrowser.currentSequence[currentChr]);
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TrackRenderer;
}
