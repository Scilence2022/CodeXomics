// @ts-check
/**
 * TrackSettingsBridgeService - Track settings bridge between ChatManager and TrackRenderer
 */
class TrackSettingsBridgeService {
  constructor(app, chatManager) {
    this.app = app;
    this.chatManager = chatManager;
  }

  async toggleTrack(params) {
    // Support both camelCase and snake_case parameter names
    const trackName = params.trackName || params.track_name;
    let visible = params.visible;
    const action = params.action;

    if (!trackName) {
      throw new Error('trackName or track_name parameter is required');
    }

    // Convert action to visible if visible is not specified
    if (visible === undefined && action) {
      if (action === 'show') {
        visible = true;
      } else if (action === 'hide') {
        visible = false;
      } else {
        throw new Error('Invalid action parameter. Must be "show" or "hide"');
      }
    }

    // Map track names to checkbox IDs
    const trackMapping = {
      genes: 'trackGenes',
      gc: 'trackGC',
      variants: 'trackVariants',
      reads: 'trackReads',
      proteins: 'trackProteins',
      wigTracks: 'trackWIG',
      sequence: 'trackSequence',
      actions: 'trackActions',
      action: 'trackActions',
      blast: 'trackBlast',
      blast_results: 'trackBlast',
    };

    const checkboxId = trackMapping[trackName];
    if (!checkboxId) {
      throw new Error(`Unknown track: ${trackName}. Available tracks: ${Object.keys(trackMapping).join(', ')}`);
    }

    const trackCheckbox = document.getElementById(checkboxId);
    if (!trackCheckbox) {
      throw new Error(`Track checkbox not found: ${checkboxId}`);
    }

    // If visible not specified, toggle current state
    if (visible === undefined) {
      visible = !trackCheckbox.checked;
    }

    // Check current state before making changes
    const currentState = trackCheckbox.checked;

    // If the track is already in the desired state, no need to change it
    if (currentState === visible) {
      return {
        success: true,
        track: trackName,
        visible: visible,
        message: `Track ${trackName} is already ${visible ? 'shown' : 'hidden'}`,
        noChangeNeeded: true,
      };
    }

    trackCheckbox.checked = visible;
    trackCheckbox.dispatchEvent(new Event('change'));

    // Also sync with sidebar checkbox
    const sidebarCheckboxId = 'sidebar' + checkboxId.charAt(0).toUpperCase() + checkboxId.slice(1);
    const sidebarCheckbox = document.getElementById(sidebarCheckboxId);
    if (sidebarCheckbox) {
      sidebarCheckbox.checked = visible;
      sidebarCheckbox.dispatchEvent(new Event('change'));
    }

    return {
      success: true,
      track: trackName,
      visible: visible,
      message: `Track ${trackName} ${visible ? 'shown' : 'hidden'}`,
    };
  }

  async toggleAnnotationTrack(params) {
    // Alias for toggleTrack for annotation-specific tracks
    return await this.toggleTrack(params);
  }

  getVisibleTracks() {
    const tracks = [];

    // Define track mappings with their checkbox IDs
    const trackMappings = [
      { name: 'genes', id: 'trackGenes' },
      { name: 'gc', id: 'trackGC' },
      { name: 'variants', id: 'trackVariants' },
      { name: 'reads', id: 'trackReads' },
      { name: 'proteins', id: 'trackProteins' },
      { name: 'wigTracks', id: 'trackWIG' },
      { name: 'sequence', id: 'trackSequence' },
      { name: 'actions', id: 'trackActions' },
      { name: 'blast', id: 'trackBlast' },
      { name: 'blast_results', id: 'trackBlast' },
    ];

    // Check each track checkbox
    trackMappings.forEach(track => {
      const checkbox = document.getElementById(track.id);
      if (checkbox && checkbox.checked) {
        tracks.push(track.name);
      }
    });

    return tracks;
  }

  getTrackStatus() {
    if (!this.chatManager.app) {
      throw new Error('Genome browser not initialized');
    }

    const visibleTracks = this.getVisibleTracks();
    const allTracks = ['genes', 'sequence', 'gc', 'variants', 'reads', 'proteins'];

    const trackStatus = allTracks.map(track => ({
      name: track,
      visible: visibleTracks.includes(track),
      description: this.getTrackDescription(track),
    }));

    return {
      visibleTracks: visibleTracks,
      totalTracks: allTracks.length,
      tracks: trackStatus,
    };
  }

  getTrackDescription(trackName) {
    const descriptions = {
      genes: 'Gene annotations and features',
      sequence: 'DNA sequence display',
      gc: 'GC content visualization',
      variants: 'VCF variant data',
      reads: 'Aligned sequencing reads',
      proteins: 'Protein coding sequences',
    };
    return descriptions[trackName] || 'Unknown track';
  }

  async getTrackSettings(parameters) {
    const { track_type } = parameters;

    if (!track_type) {
      throw new Error('track_type parameter is required');
    }

    const validTrackTypes = [
      'genes',
      'reads',
      'sequence',
      'gc',
      'variants',
      'actions',
      'blast',
      'wigTracks',
      'sequenceLine',
    ];
    if (!validTrackTypes.includes(track_type)) {
      throw new Error(`Invalid track_type: ${track_type}. Valid types: ${validTrackTypes.join(', ')}`);
    }

    if (!this.chatManager.genomeBrowser?.trackRenderer) {
      throw new Error('TrackRenderer not available');
    }

    const settings = this.chatManager.genomeBrowser.trackRenderer.getTrackSettings(track_type);

    return {
      success: true,
      track_type,
      settings,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Set settings for a specific track type
   */
  async setTrackSettings(parameters) {
    const { track_type, settings } = parameters;

    if (!track_type) {
      throw new Error('track_type parameter is required');
    }

    if (!settings || typeof settings !== 'object') {
      throw new Error('settings parameter must be an object');
    }

    const validTrackTypes = [
      'genes',
      'reads',
      'sequence',
      'gc',
      'variants',
      'actions',
      'blast',
      'wigTracks',
      'sequenceLine',
    ];
    if (!validTrackTypes.includes(track_type)) {
      throw new Error(`Invalid track_type: ${track_type}. Valid types: ${validTrackTypes.join(', ')}`);
    }

    if (!this.chatManager.genomeBrowser?.trackRenderer) {
      throw new Error('TrackRenderer not available');
    }

    // Get current settings and merge with new settings
    const currentSettings = this.chatManager.genomeBrowser.trackRenderer.getTrackSettings(track_type);
    const mergedSettings = { ...currentSettings, ...settings };

    // Save and apply settings
    this.chatManager.genomeBrowser.trackRenderer.saveTrackSettings(track_type, mergedSettings);
    this.chatManager.genomeBrowser.trackRenderer.applySettingsToTrack(track_type, mergedSettings);

    return {
      success: true,
      track_type,
      updated_settings: settings,
      applied_settings: mergedSettings,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get all track settings
   */
  async getAllTrackSettings(parameters = {}) {
    const trackTypes = [
      'genes',
      'reads',
      'sequence',
      'gc',
      'variants',
      'actions',
      'blast',
      'wigTracks',
      'sequenceLine',
    ];
    const allSettings = {};
    const trackRenderer = this.chatManager.genomeBrowser?.trackRenderer;

    if (!trackRenderer) {
      // TrackRenderer not yet initialized — return a minimal summary so the LLM
      // still receives a useful (non-error) response during benchmark / early load.
      console.warn('[getAllTrackSettings] TrackRenderer not available — returning defaults');
      for (const trackType of trackTypes) {
        allSettings[trackType] = { _note: 'TrackRenderer not available; showing defaults only', height: undefined };
      }
      return {
        success: true,
        settings: allSettings,
        track_count: trackTypes.length,
        note: 'TrackRenderer not yet initialized. Values shown are placeholders; load a genome file first.',
        timestamp: new Date().toISOString(),
      };
    }

    for (const trackType of trackTypes) {
      try {
        allSettings[trackType] = trackRenderer.getTrackSettings(trackType);
      } catch (error) {
        console.warn(`Failed to get settings for ${trackType}:`, error.message);
        allSettings[trackType] = { error: error.message };
      }
    }

    return {
      success: true,
      settings: allSettings,
      track_count: trackTypes.length,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Reset track settings to defaults
   */
  async resetTrackSettings(parameters) {
    const { track_type } = parameters;

    if (!track_type) {
      throw new Error('track_type parameter is required');
    }

    if (!this.chatManager.genomeBrowser?.trackRenderer) {
      throw new Error('TrackRenderer not available');
    }

    if (track_type === 'all') {
      // Reset all tracks
      const trackTypes = [
        'genes',
        'reads',
        'sequence',
        'gc',
        'variants',
        'actions',
        'blast',
        'wigTracks',
        'sequenceLine',
      ];
      const results = {};

      for (const type of trackTypes) {
        try {
          // Clear saved settings from storage
          if (this.chatManager.genomeBrowser.configManager) {
            this.chatManager.genomeBrowser.configManager.set(`tracks.${type}.settings`, {});
          }
          localStorage.removeItem(`trackSettings_${type}`);

          // Get fresh default settings
          const defaultSettings = this.chatManager.genomeBrowser.trackRenderer.getTrackSettings(type);
          this.chatManager.genomeBrowser.trackRenderer.applySettingsToTrack(type, defaultSettings);

          results[type] = { success: true };
        } catch (error) {
          results[type] = { success: false, error: error.message };
        }
      }

      // Save config changes
      if (this.chatManager.genomeBrowser.configManager) {
        this.chatManager.genomeBrowser.configManager.saveConfig();
      }

      return {
        success: true,
        track_type: 'all',
        results,
        timestamp: new Date().toISOString(),
      };
    } else {
      // Reset specific track
      const validTrackTypes = [
        'genes',
        'reads',
        'sequence',
        'gc',
        'variants',
        'actions',
        'blast',
        'wigTracks',
        'sequenceLine',
      ];
      if (!validTrackTypes.includes(track_type)) {
        throw new Error(`Invalid track_type: ${track_type}`);
      }

      // Clear saved settings from storage
      if (this.chatManager.genomeBrowser.configManager) {
        this.chatManager.genomeBrowser.configManager.set(`tracks.${track_type}.settings`, {});
      }
      localStorage.removeItem(`trackSettings_${track_type}`);

      // Get fresh default settings
      const defaultSettings = this.chatManager.genomeBrowser.trackRenderer.getTrackSettings(track_type);
      this.chatManager.genomeBrowser.trackRenderer.applySettingsToTrack(track_type, defaultSettings);

      // Save config changes
      if (this.chatManager.genomeBrowser.configManager) {
        this.chatManager.genomeBrowser.configManager.saveConfig();
      }

      return {
        success: true,
        track_type,
        default_settings: defaultSettings,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get track settings schema
   * Schema is inlined here to avoid require() calls that fail in the renderer (browser) context.
   */
  async getTrackSettingsSchema(parameters = {}) {
    const schema = {
      genes: {
        description: 'Genes and Features Track Settings',
        settings: {
          renderingMode: { type: 'string', enum: ['svg', 'canvas'], default: 'svg', description: 'Rendering mode' },
          maxRows: { type: 'number', min: 1, max: 20, default: 6, description: 'Maximum rows for displaying features' },
          showOperonsSameRow: { type: 'boolean', default: false, description: 'Group genes in the same operon' },
          height: { type: 'number', min: 60, max: 400, default: 120, description: 'Track height in pixels' },
          geneHeight: { type: 'number', min: 12, max: 60, default: 24, description: 'Gene element height in pixels' },
          fontSize: { type: 'number', min: 8, max: 48, default: 24, description: 'Gene name font size in pixels' },
          geneNameColor: { type: 'string', format: 'color', default: '#333333', description: 'Gene name color' },
          fontFamily: { type: 'string', default: 'Arial, sans-serif', description: 'Gene name font family' },
          layoutMode: { type: 'string', enum: ['expanded', 'compact', 'groupByType'], default: 'compact', description: 'Layout mode' },
          enableGlobalDragging: { type: 'boolean', default: true, description: 'Enable global track dragging' },
          highlightEffect: { type: 'string', enum: ['pulse', 'border', 'both'], default: 'pulse', description: 'Highlight effect for selected genes' },
          autoHighlightSequence: { type: 'boolean', default: false, description: 'Auto-highlight sequence region when gene is selected' },
          showSequence: { type: 'boolean', default: false, description: 'Show reference sequence' },
          sequenceHeight: { type: 'number', min: 15, max: 50, default: 25, description: 'Reference sequence height in pixels' },
          circularMode: { type: 'boolean', default: false, description: 'Enable circular browsing mode for circular genomes' },
          wheelZoomSensitivity: { type: 'number', min: 0.01, max: 0.5, default: 0.1, description: 'Mouse wheel zoom sensitivity' },
          overrideGlobalZoom: { type: 'boolean', default: false, description: 'Override global zoom settings' },
          maxBorderWidth: { type: 'number', min: 0.5, max: 5, default: 1, description: 'Maximum border width for gene elements' },
        },
      },
      reads: {
        description: 'Aligned Reads Track Settings',
        settings: {
          renderingMode: { type: 'string', enum: ['canvas', 'svg'], default: 'canvas', description: 'Rendering method' },
          showCoverage: { type: 'boolean', default: true, description: 'Show coverage visualization' },
          coverageHeight: { type: 'number', min: 30, max: 100, default: 50, description: 'Coverage track height in pixels' },
          coverageColor: { type: 'string', format: 'color', default: '#4a90e2', description: 'Coverage area color' },
          coverageStrokeColor: { type: 'string', format: 'color', default: '#2c5aa0', description: 'Coverage stroke/border color' },
          showReference: { type: 'boolean', default: true, description: 'Show reference sequence' },
          referenceHeight: { type: 'number', min: 15, max: 50, default: 25, description: 'Reference sequence height in pixels' },
          referenceFontSize: { type: 'number', min: 8, max: 20, default: 12, description: 'Reference sequence font size' },
          referenceFontFamily: { type: 'string', default: 'monospace', description: 'Reference sequence font family' },
          readHeight: { type: 'number', min: 2, max: 30, default: 4, description: 'Height of each read in pixels' },
          readSpacing: { type: 'number', min: 1, max: 10, default: 2, description: 'Spacing between reads in pixels' },
          enableVerticalScroll: { type: 'boolean', default: false, description: 'Enable vertical scrolling' },
          maxVisibleRows: { type: 'number', min: 5, max: 30, default: 10, description: 'Maximum visible rows when scrolling is enabled' },
          maxRows: { type: 'number', min: 5, max: 50, default: 20, description: 'Maximum visible rows when scrolling is disabled' },
          forwardColor: { type: 'string', format: 'color', default: '#00b894', description: 'Forward reads fill color' },
          reverseColor: { type: 'string', format: 'color', default: '#f39c12', description: 'Reverse reads fill color' },
          pairedColor: { type: 'string', format: 'color', default: '#6c5ce7', description: 'Paired reads fill color' },
          borderColor: { type: 'string', format: 'color', default: '#ffffff', description: 'Border color for reads' },
          borderWidth: { type: 'number', min: 0, max: 3, default: 0, description: 'Border width in pixels' },
          opacity: { type: 'number', min: 0.1, max: 1, default: 0.9, description: 'Read opacity (0-1)' },
          showDirectionArrows: { type: 'boolean', default: true, description: 'Show direction arrows' },
          showQualityColors: { type: 'boolean', default: false, description: 'Color reads by mapping quality' },
          showMutations: { type: 'boolean', default: false, description: 'Show mutations' },
          minMappingQuality: { type: 'number', min: 0, max: 60, default: 0, description: 'Minimum mapping quality filter' },
          showUnmapped: { type: 'boolean', default: false, description: 'Show unmapped reads' },
          showSecondary: { type: 'boolean', default: true, description: 'Show secondary alignments' },
          showSupplementary: { type: 'boolean', default: true, description: 'Show supplementary alignments' },
          height: { type: 'number', min: 100, max: 500, default: 150, description: 'Total track height in pixels' },
          enableSampling: { type: 'boolean', default: true, description: 'Enable read sampling for large datasets' },
          samplingThreshold: { type: 'number', min: 1000, max: 100000, default: 10000, description: 'Sampling threshold' },
          samplingMode: { type: 'string', enum: ['percentage', 'fixed'], default: 'percentage', description: 'Sampling mode' },
          samplingPercentage: { type: 'number', min: 1, max: 100, default: 20, description: 'Sampling percentage' },
          samplingCount: { type: 'number', min: 1000, max: 50000, default: 5000, description: 'Fixed sampling count' },
          showSamplingInfo: { type: 'boolean', default: true, description: 'Show sampling information' },
          showSequences: { type: 'boolean', default: true, description: 'Show read sequences when zoomed in' },
          forceSequences: { type: 'boolean', default: false, description: 'Force show sequences regardless of zoom' },
          autoFontSize: { type: 'boolean', default: true, description: 'Auto-adjust font size for sequences' },
          sequenceThreshold: { type: 'number', min: 0.1, max: 10, default: 1.0, description: 'Sequence display threshold (bp/px)' },
          sequenceFontSize: { type: 'number', min: 8, max: 16, default: 10, description: 'Sequence font size in pixels' },
          sequenceHeight: { type: 'number', min: 10, max: 30, default: 14, description: 'Sequence text height in pixels' },
          highlightMismatches: { type: 'boolean', default: true, description: 'Highlight mismatches' },
          showMismatches: { type: 'boolean', default: true, description: 'Show mismatches (alias for highlightMismatches)' },
          mismatchColor: { type: 'string', format: 'color', default: '#ff6b6b', description: 'Mismatch highlight color' },
        },
      },
      sequence: {
        description: 'Sequence Track Settings',
        settings: {
          showIndicators: { type: 'boolean', default: true, description: 'Show gene indicator bars' },
          indicatorHeight: { type: 'number', min: 6, max: 20, default: 8, description: 'Indicator bar height in pixels' },
          indicatorOpacity: { type: 'number', min: 0.3, max: 1, default: 0.7, description: 'Indicator opacity (0-1)' },
          showStartMarkers: { type: 'boolean', default: true, description: 'Show gene start markers' },
          showEndArrows: { type: 'boolean', default: true, description: 'Show gene end arrows' },
          startMarkerWidth: { type: 'number', min: 1, max: 6, default: 3, description: 'Start marker width in pixels' },
          startMarkerHeight: { type: 'number', min: 50, max: 100, default: 85, description: 'Start marker height (% of bar)' },
          arrowSize: { type: 'number', min: 3, max: 12, default: 6, description: 'End arrow size in pixels' },
          arrowHeight: { type: 'number', min: 50, max: 100, default: 85, description: 'End arrow height (% of bar)' },
          showCDS: { type: 'boolean', default: true, description: 'Show CDS genes' },
          showRNA: { type: 'boolean', default: true, description: 'Show RNA genes' },
          showPromoter: { type: 'boolean', default: true, description: 'Show promoters' },
          showTerminator: { type: 'boolean', default: true, description: 'Show terminators' },
          showRegulatory: { type: 'boolean', default: true, description: 'Show regulatory elements' },
          showTooltips: { type: 'boolean', default: true, description: 'Show tooltips on hover' },
          showHoverEffects: { type: 'boolean', default: true, description: 'Enable hover effects' },
          cursorColor: { type: 'string', format: 'color', default: '#000000', description: 'Cursor color' },
          horizontalOffset: { type: 'number', min: -50, max: 50, default: 0, description: 'Horizontal offset in pixels' },
          verticalOffset: { type: 'number', min: -20, max: 20, default: 0, description: 'Vertical offset in pixels' },
          heightCorrection: { type: 'number', min: 50, max: 200, default: 100, description: 'Height correction (%)' },
          widthCorrection: { type: 'number', min: 50, max: 200, default: 100, description: 'Width correction (%)' },
          colorMode: { type: 'string', enum: ['uniform', 'geneColors', 'baseColors'], default: 'uniform', description: 'Color mode for DNA bases' },
          uniformColor: { type: 'string', format: 'color', default: '#000000', description: 'Uniform color for all bases' },
          intergenicColor: { type: 'string', format: 'color', default: '#666666', description: 'Intergenic region color' },
          geneColorOpacity: { type: 'number', min: 0.3, max: 1, default: 0.8, description: 'Gene color opacity' },
          colorA: { type: 'string', format: 'color', default: '#FF0000', description: 'Adenine color' },
          colorT: { type: 'string', format: 'color', default: '#0000FF', description: 'Thymine color' },
          colorG: { type: 'string', format: 'color', default: '#00FF00', description: 'Guanine color' },
          colorC: { type: 'string', format: 'color', default: '#FFFF00', description: 'Cytosine color' },
          colorN: { type: 'string', format: 'color', default: '#888888', description: 'Unknown base color' },
        },
      },
      gc: {
        description: 'GC Content Track Settings',
        settings: {
          contentColor: { type: 'string', format: 'color', default: '#3b82f6', description: 'GC content color' },
          skewPositiveColor: { type: 'string', format: 'color', default: '#10b981', description: 'GC skew positive color' },
          skewNegativeColor: { type: 'string', format: 'color', default: '#ef4444', description: 'GC skew negative color' },
          lineWidth: { type: 'number', min: 1, max: 5, default: 2, description: 'Line width' },
          height: { type: 'number', min: 80, max: 300, default: 140, description: 'Track height in pixels' },
        },
      },
      variants: {
        description: 'Variants Track Settings',
        settings: {
          height: { type: 'number', min: 50, max: 300, default: 80, description: 'Track height in pixels' },
          elementHeight: { type: 'number', min: 8, max: 30, default: 12, description: 'Variant element height in pixels' },
          rowSpacing: { type: 'number', min: 2, max: 20, default: 8, description: 'Row spacing in pixels' },
          colorMode: { type: 'string', enum: ['type', 'impact', 'quality', 'custom'], default: 'type', description: 'Color mode' },
          customColor: { type: 'string', format: 'color', default: '#e74c3c', description: 'Custom variant color' },
          snpColor: { type: 'string', format: 'color', default: '#e74c3c', description: 'SNP color' },
          indelColor: { type: 'string', format: 'color', default: '#3498db', description: 'INDEL color' },
          svColor: { type: 'string', format: 'color', default: '#9b59b6', description: 'Structural variant color' },
          highImpactColor: { type: 'string', format: 'color', default: '#e74c3c', description: 'HIGH impact color' },
          moderateImpactColor: { type: 'string', format: 'color', default: '#f39c12', description: 'MODERATE impact color' },
          lowImpactColor: { type: 'string', format: 'color', default: '#2ecc71', description: 'LOW impact color' },
          modifierImpactColor: { type: 'string', format: 'color', default: '#95a5a6', description: 'MODIFIER impact color' },
          minQuality: { type: 'number', min: 0, max: 1000, default: 0, description: 'Minimum quality score filter' },
          maxDisplayCount: { type: 'number', min: 10, max: 1000, default: 200, description: 'Maximum number of variants to display' },
          showLabels: { type: 'boolean', default: true, description: 'Show variant labels' },
          labelFontSize: { type: 'number', min: 8, max: 16, default: 10, description: 'Label font size in pixels' },
          groupByFile: { type: 'boolean', default: false, description: 'Group variants by VCF file' },
          fileSpacing: { type: 'number', min: 0, max: 30, default: 10, description: 'Spacing between files in pixels' },
        },
      },
      actions: {
        description: 'Actions Track Settings',
        settings: {
          height: { type: 'number', min: 60, max: 300, default: 120, description: 'Track height in pixels' },
          actionHeight: { type: 'number', min: 5, max: 30, default: 10, description: 'Action element height in pixels' },
          rowSpacing: { type: 'number', min: 0, max: 10, default: 2, description: 'Row spacing in pixels' },
          topPadding: { type: 'number', min: 0, max: 20, default: 5, description: 'Top padding in pixels' },
          bottomPadding: { type: 'number', min: 0, max: 20, default: 5, description: 'Bottom padding in pixels' },
          fontSize: { type: 'number', min: 8, max: 16, default: 10, description: 'Font size in pixels' },
          fontFamily: { type: 'string', default: 'Arial, sans-serif', description: 'Font family' },
        },
      },
      blast: {
        description: 'BLAST Results Track Settings',
        settings: {
          height: { type: 'number', min: 60, max: 300, default: 120, description: 'Track height in pixels' },
          showRuler: { type: 'boolean', default: false, description: 'Show ruler' },
          resultHeight: { type: 'number', min: 8, max: 30, default: 12, description: 'Result height in pixels' },
          resultSpacing: { type: 'number', min: 5, max: 30, default: 14, description: 'Result spacing in pixels' },
        },
      },
      sequenceLine: {
        description: 'Single-line Sequence Track Settings',
        settings: {
          fontSize: { type: 'number', min: 10, max: 20, default: 14, description: 'Font size in pixels' },
          fontFamily: { type: 'string', default: 'Courier New, monospace', description: 'Font family' },
          maxHeight: { type: 'number', min: 30, max: 200, default: 50, description: 'Maximum height in pixels' },
          adaptiveHeight: { type: 'boolean', default: true, description: 'Adaptive height based on content' },
          showProteinTranslation: { type: 'boolean', default: false, description: 'Show protein translation sequences' },
          proteinTranslationMode: { type: 'string', enum: ['all_frames', 'cds_only'], default: 'all_frames', description: 'Translation mode' },
          proteinFramesToShow: { type: 'array', items: { type: 'number', enum: [1, 2, 3] }, default: [1, 2, 3], description: 'Reading frames to display' },
          proteinFontSize: { type: 'number', min: 8, max: 16, default: 12, description: 'Protein font size in pixels' },
        },
      },
      wigTracks: {
        description: 'WIG Tracks Settings',
        settings: {
          trackSpacing: { type: 'number', min: 0, max: 20, default: 5, description: 'Spacing between tracks in pixels' },
          defaultTrackHeight: { type: 'number', min: 20, max: 100, default: 30, description: 'Default track height in pixels' },
          trackHeights: { type: 'object', description: 'Individual track heights (trackName -> height)' },
        },
      },
    };

    return {
      success: true,
      schema,
      description: 'Complete schema of available track settings with types, defaults, and validation rules',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Batch set track settings for multiple tracks
   */
  async batchSetTrackSettings(parameters) {
    const { settings_map } = parameters;

    if (!settings_map || typeof settings_map !== 'object') {
      throw new Error('settings_map parameter must be an object');
    }

    const results = {};
    const errors = [];

    for (const [trackType, settings] of Object.entries(settings_map)) {
      try {
        const result = await this.setTrackSettings({
          track_type: trackType,
          settings: settings,
        });
        results[trackType] = result;
      } catch (error) {
        results[trackType] = { success: false, error: error.message };
        errors.push(`${trackType}: ${error.message}`);
      }
    }

    return {
      success: errors.length === 0,
      track_count: Object.keys(settings_map).length,
      successful_updates: Object.keys(settings_map).length - errors.length,
      failed_updates: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    };
  }
}
window.TrackSettingsBridgeService = TrackSettingsBridgeService;
