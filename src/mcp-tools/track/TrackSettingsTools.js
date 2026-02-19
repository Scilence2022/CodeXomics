/**
 * Track Settings Tools Module
 * Provides MCP tools for AI to get and set track settings
 */

class TrackSettingsTools {
  constructor(server) {
    this.server = server;
  }

  getTools() {
    return {
      // Get track settings
      get_track_settings: {
        name: 'get_track_settings',
        description:
          'Get current settings for a specific track type (genes, reads, sequence, gc, variants, actions, blast, wigTracks, sequenceLine)',
        parameters: {
          type: 'object',
          properties: {
            track_type: {
              type: 'string',
              description: 'Type of track to get settings for',
              enum: ['genes', 'reads', 'sequence', 'gc', 'variants', 'actions', 'blast', 'wigTracks', 'sequenceLine'],
            },
          },
          required: ['track_type'],
        },
      },

      // Set track settings
      set_track_settings: {
        name: 'set_track_settings',
        description: 'Set settings for a specific track type. Only provided parameters will be updated.',
        parameters: {
          type: 'object',
          properties: {
            track_type: {
              type: 'string',
              description: 'Type of track to configure',
              enum: ['genes', 'reads', 'sequence', 'gc', 'variants', 'actions', 'blast', 'wigTracks', 'sequenceLine'],
            },
            settings: {
              type: 'object',
              description: 'Settings object with parameters to update',
            },
          },
          required: ['track_type', 'settings'],
        },
      },

      // Get all track settings
      get_all_track_settings: {
        name: 'get_all_track_settings',
        description: 'Get current settings for all track types',
        parameters: {
          type: 'object',
          properties: {},
        },
      },

      // Reset track settings to defaults
      reset_track_settings: {
        name: 'reset_track_settings',
        description: 'Reset track settings to default values',
        parameters: {
          type: 'object',
          properties: {
            track_type: {
              type: 'string',
              description: 'Type of track to reset (or "all" to reset all tracks)',
              enum: [
                'genes',
                'reads',
                'sequence',
                'gc',
                'variants',
                'actions',
                'blast',
                'wigTracks',
                'sequenceLine',
                'all',
              ],
            },
          },
          required: ['track_type'],
        },
      },

      // Get track settings schema
      get_track_settings_schema: {
        name: 'get_track_settings_schema',
        description: 'Get the complete schema of available settings for all track types',
        parameters: {
          type: 'object',
          properties: {},
        },
      },

      // Set multiple track settings at once
      batch_set_track_settings: {
        name: 'batch_set_track_settings',
        description: 'Set settings for multiple tracks in a single operation',
        parameters: {
          type: 'object',
          properties: {
            settings_map: {
              type: 'object',
              description: 'Map of track_type -> settings object',
              additionalProperties: {
                type: 'object',
              },
            },
          },
          required: ['settings_map'],
        },
      },
    };
  }

  async executeClientTool(toolName, parameters, clientId) {
    return await this.server.executeToolOnClient(toolName, parameters, clientId);
  }

  // Get default settings for all track types
  getDefaultSettingsSchema() {
    return {
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
          layoutMode: {
            type: 'string',
            enum: ['expanded', 'compact', 'groupByType'],
            default: 'compact',
            description: 'Layout mode',
          },
          enableGlobalDragging: { type: 'boolean', default: true, description: 'Enable global track dragging' },
          highlightEffect: {
            type: 'string',
            enum: ['pulse', 'border', 'both'],
            default: 'pulse',
            description: 'Highlight effect for selected genes',
          },
          autoHighlightSequence: {
            type: 'boolean',
            default: false,
            description: 'Auto-highlight sequence region when gene is selected',
          },
          showSequence: { type: 'boolean', default: false, description: 'Show reference sequence' },
          sequenceHeight: {
            type: 'number',
            min: 15,
            max: 50,
            default: 25,
            description: 'Reference sequence height in pixels',
          },
          circularMode: {
            type: 'boolean',
            default: false,
            description: 'Enable circular browsing mode for circular genomes',
          },
          wheelZoomSensitivity: {
            type: 'number',
            min: 0.01,
            max: 0.5,
            default: 0.1,
            description: 'Mouse wheel zoom sensitivity',
          },
          overrideGlobalZoom: { type: 'boolean', default: false, description: 'Override global zoom settings' },
          maxBorderWidth: {
            type: 'number',
            min: 0.5,
            max: 5,
            default: 1,
            description: 'Maximum border width for gene elements',
          },
        },
      },

      reads: {
        description: 'Aligned Reads Track Settings',
        settings: {
          renderingMode: {
            type: 'string',
            enum: ['canvas', 'svg'],
            default: 'canvas',
            description: 'Rendering method',
          },
          showCoverage: { type: 'boolean', default: true, description: 'Show coverage visualization' },
          coverageHeight: {
            type: 'number',
            min: 30,
            max: 100,
            default: 50,
            description: 'Coverage track height in pixels',
          },
          coverageColor: { type: 'string', format: 'color', default: '#4a90e2', description: 'Coverage area color' },
          coverageStrokeColor: {
            type: 'string',
            format: 'color',
            default: '#2c5aa0',
            description: 'Coverage stroke/border color',
          },
          showReference: { type: 'boolean', default: true, description: 'Show reference sequence' },
          referenceHeight: {
            type: 'number',
            min: 15,
            max: 50,
            default: 25,
            description: 'Reference sequence height in pixels',
          },
          referenceFontSize: {
            type: 'number',
            min: 8,
            max: 20,
            default: 12,
            description: 'Reference sequence font size',
          },
          referenceFontFamily: { type: 'string', default: 'monospace', description: 'Reference sequence font family' },
          readHeight: { type: 'number', min: 2, max: 30, default: 4, description: 'Height of each read in pixels' },
          readSpacing: { type: 'number', min: 1, max: 10, default: 2, description: 'Spacing between reads in pixels' },
          enableVerticalScroll: { type: 'boolean', default: false, description: 'Enable vertical scrolling' },
          maxVisibleRows: {
            type: 'number',
            min: 5,
            max: 30,
            default: 10,
            description: 'Maximum visible rows when scrolling is enabled',
          },
          maxRows: {
            type: 'number',
            min: 5,
            max: 50,
            default: 20,
            description: 'Maximum visible rows when scrolling is disabled',
          },
          forwardColor: {
            type: 'string',
            format: 'color',
            default: '#00b894',
            description: 'Forward reads fill color',
          },
          reverseColor: {
            type: 'string',
            format: 'color',
            default: '#f39c12',
            description: 'Reverse reads fill color',
          },
          pairedColor: { type: 'string', format: 'color', default: '#6c5ce7', description: 'Paired reads fill color' },
          borderColor: { type: 'string', format: 'color', default: '#ffffff', description: 'Border color for reads' },
          borderWidth: { type: 'number', min: 0, max: 3, default: 0, description: 'Border width in pixels' },
          opacity: { type: 'number', min: 0.1, max: 1, default: 0.9, description: 'Read opacity (0-1)' },
          showDirectionArrows: { type: 'boolean', default: true, description: 'Show direction arrows' },
          showQualityColors: { type: 'boolean', default: false, description: 'Color reads by mapping quality' },
          showMutations: { type: 'boolean', default: false, description: 'Show mutations' },
          minMappingQuality: {
            type: 'number',
            min: 0,
            max: 60,
            default: 0,
            description: 'Minimum mapping quality filter',
          },
          showUnmapped: { type: 'boolean', default: false, description: 'Show unmapped reads' },
          showSecondary: { type: 'boolean', default: true, description: 'Show secondary alignments' },
          showSupplementary: { type: 'boolean', default: true, description: 'Show supplementary alignments' },
          height: { type: 'number', min: 100, max: 500, default: 150, description: 'Total track height in pixels' },
          enableSampling: { type: 'boolean', default: true, description: 'Enable read sampling for large datasets' },
          samplingThreshold: {
            type: 'number',
            min: 1000,
            max: 100000,
            default: 10000,
            description: 'Sampling threshold',
          },
          samplingMode: {
            type: 'string',
            enum: ['percentage', 'fixed'],
            default: 'percentage',
            description: 'Sampling mode',
          },
          samplingPercentage: { type: 'number', min: 1, max: 100, default: 20, description: 'Sampling percentage' },
          samplingCount: { type: 'number', min: 1000, max: 50000, default: 5000, description: 'Fixed sampling count' },
          showSamplingInfo: { type: 'boolean', default: true, description: 'Show sampling information' },
          showSequences: { type: 'boolean', default: true, description: 'Show read sequences when zoomed in' },
          forceSequences: { type: 'boolean', default: false, description: 'Force show sequences regardless of zoom' },
          autoFontSize: { type: 'boolean', default: true, description: 'Auto-adjust font size for sequences' },
          sequenceThreshold: {
            type: 'number',
            min: 0.1,
            max: 10,
            default: 1.0,
            description: 'Sequence display threshold (bp/px)',
          },
          sequenceFontSize: {
            type: 'number',
            min: 8,
            max: 16,
            default: 10,
            description: 'Sequence font size in pixels',
          },
          sequenceHeight: {
            type: 'number',
            min: 10,
            max: 30,
            default: 14,
            description: 'Sequence text height in pixels',
          },
          highlightMismatches: { type: 'boolean', default: true, description: 'Highlight mismatches' },
          showMismatches: {
            type: 'boolean',
            default: true,
            description: 'Show mismatches (alias for highlightMismatches)',
          },
          mismatchColor: {
            type: 'string',
            format: 'color',
            default: '#ff6b6b',
            description: 'Mismatch highlight color',
          },
        },
      },

      sequence: {
        description: 'Sequence Track Settings',
        settings: {
          showIndicators: { type: 'boolean', default: true, description: 'Show gene indicator bars' },
          indicatorHeight: {
            type: 'number',
            min: 6,
            max: 20,
            default: 8,
            description: 'Indicator bar height in pixels',
          },
          indicatorOpacity: { type: 'number', min: 0.3, max: 1, default: 0.7, description: 'Indicator opacity (0-1)' },
          showStartMarkers: { type: 'boolean', default: true, description: 'Show gene start markers' },
          showEndArrows: { type: 'boolean', default: true, description: 'Show gene end arrows' },
          startMarkerWidth: { type: 'number', min: 1, max: 6, default: 3, description: 'Start marker width in pixels' },
          startMarkerHeight: {
            type: 'number',
            min: 50,
            max: 100,
            default: 85,
            description: 'Start marker height (% of bar)',
          },
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
          horizontalOffset: {
            type: 'number',
            min: -50,
            max: 50,
            default: 0,
            description: 'Horizontal offset in pixels',
          },
          verticalOffset: { type: 'number', min: -20, max: 20, default: 0, description: 'Vertical offset in pixels' },
          heightCorrection: { type: 'number', min: 50, max: 200, default: 100, description: 'Height correction (%)' },
          widthCorrection: { type: 'number', min: 50, max: 200, default: 100, description: 'Width correction (%)' },
          colorMode: {
            type: 'string',
            enum: ['uniform', 'geneColors', 'baseColors'],
            default: 'uniform',
            description: 'Color mode for DNA bases',
          },
          uniformColor: {
            type: 'string',
            format: 'color',
            default: '#000000',
            description: 'Uniform color for all bases',
          },
          intergenicColor: {
            type: 'string',
            format: 'color',
            default: '#666666',
            description: 'Intergenic region color',
          },
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
          skewPositiveColor: {
            type: 'string',
            format: 'color',
            default: '#10b981',
            description: 'GC skew positive color',
          },
          skewNegativeColor: {
            type: 'string',
            format: 'color',
            default: '#ef4444',
            description: 'GC skew negative color',
          },
          lineWidth: { type: 'number', min: 1, max: 5, default: 2, description: 'Line width' },
          height: { type: 'number', min: 80, max: 300, default: 140, description: 'Track height in pixels' },
        },
      },

      variants: {
        description: 'Variants Track Settings',
        settings: {
          height: { type: 'number', min: 50, max: 300, default: 80, description: 'Track height in pixels' },
          elementHeight: {
            type: 'number',
            min: 8,
            max: 30,
            default: 12,
            description: 'Variant element height in pixels',
          },
          rowSpacing: { type: 'number', min: 2, max: 20, default: 8, description: 'Row spacing in pixels' },
          colorMode: {
            type: 'string',
            enum: ['type', 'impact', 'quality', 'custom'],
            default: 'type',
            description: 'Color mode',
          },
          customColor: { type: 'string', format: 'color', default: '#e74c3c', description: 'Custom variant color' },
          snpColor: { type: 'string', format: 'color', default: '#e74c3c', description: 'SNP color' },
          indelColor: { type: 'string', format: 'color', default: '#3498db', description: 'INDEL color' },
          svColor: { type: 'string', format: 'color', default: '#9b59b6', description: 'Structural variant color' },
          highImpactColor: { type: 'string', format: 'color', default: '#e74c3c', description: 'HIGH impact color' },
          moderateImpactColor: {
            type: 'string',
            format: 'color',
            default: '#f39c12',
            description: 'MODERATE impact color',
          },
          lowImpactColor: { type: 'string', format: 'color', default: '#2ecc71', description: 'LOW impact color' },
          modifierImpactColor: {
            type: 'string',
            format: 'color',
            default: '#95a5a6',
            description: 'MODIFIER impact color',
          },
          minQuality: { type: 'number', min: 0, max: 1000, default: 0, description: 'Minimum quality score filter' },
          maxDisplayCount: {
            type: 'number',
            min: 10,
            max: 1000,
            default: 200,
            description: 'Maximum number of variants to display',
          },
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
          actionHeight: {
            type: 'number',
            min: 5,
            max: 30,
            default: 10,
            description: 'Action element height in pixels',
          },
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
          showProteinTranslation: {
            type: 'boolean',
            default: false,
            description: 'Show protein translation sequences',
          },
          proteinTranslationMode: {
            type: 'string',
            enum: ['all_frames', 'cds_only'],
            default: 'all_frames',
            description: 'Translation mode',
          },
          proteinFramesToShow: {
            type: 'array',
            items: { type: 'number', enum: [1, 2, 3] },
            default: [1, 2, 3],
            description: 'Reading frames to display',
          },
          proteinFontSize: { type: 'number', min: 8, max: 16, default: 12, description: 'Protein font size in pixels' },
        },
      },

      wigTracks: {
        description: 'WIG Tracks Settings',
        settings: {
          trackSpacing: {
            type: 'number',
            min: 0,
            max: 20,
            default: 5,
            description: 'Spacing between tracks in pixels',
          },
          defaultTrackHeight: {
            type: 'number',
            min: 20,
            max: 100,
            default: 30,
            description: 'Default track height in pixels',
          },
          trackHeights: { type: 'object', description: 'Individual track heights (trackName -> height)' },
        },
      },
    };
  }
}

module.exports = TrackSettingsTools;
