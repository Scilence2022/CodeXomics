'use strict';

/**
 * @module FeatureGlyphLegend
 * @description Feature Glyph Legend modal for the Genes & Features track.
 *
 *              The legend is a reference guide for the track, so it must show
 *              what the track actually draws. Every preview is therefore
 *              produced by the track's own renderer — GeneShapeCreators in SVG
 *              mode, CanvasGenesRenderer in Canvas mode — using the live track
 *              settings (rendering mode, glyph height, border width, label
 *              font). Nothing here reimplements a glyph; when the track's
 *              rendering changes, the legend follows automatically.
 *
 *              Methods take the TrackRenderer instance as `self`, matching the
 *              convention used by GeneShapeCreators.
 */

// Prefixed to avoid colliding with the global SVG_NS declared by
// GeneShapeCreators.js — both are loaded as classic scripts, which share one
// global lexical scope, and a duplicate top-level const kills the second script.
const GLYPH_LEGEND_SVG_NS = 'http://www.w3.org/2000/svg';

// Colour getGeneOperonInfo() forces on user-defined features
const GLYPH_LEGEND_USER_DEFINED_COLOR = '#10b981';

// Previews map 1 bp to 1 px inside a box this wide
const GLYPH_LEGEND_PREVIEW_WIDTH = 200;

class FeatureGlyphLegend {
  // ---------------------------------------------------------------------------
  // Modal lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Open the legend, building it from the current track settings.
   * @param {Object} self - TrackRenderer instance
   */
  static open(self) {
    let modal = document.getElementById('featureGlyphLegendModal');
    if (!modal) {
      modal = FeatureGlyphLegend.createModal(self);
      document.body.appendChild(modal);

      // Initialize draggable and resizable after modal is in the DOM
      if (window.modalDragManager) {
        window.modalDragManager.makeDraggable('#featureGlyphLegendModal');
      }
      if (window.resizableModalManager) {
        window.resizableModalManager.makeResizable('#featureGlyphLegendModal');
      }
    }

    // Show before drawing: Canvas previews size themselves from their container,
    // and a hidden container measures zero.
    modal.classList.add('show');

    // Rebuild on every open so the legend always reflects the current
    // Genes & Features settings (rendering mode, glyph height, border width,
    // label font/colour).
    requestAnimationFrame(() => FeatureGlyphLegend.renderContent(self, modal));
  }

  /**
   * Close the legend and release its preview renderers.
   * @param {Object} self  - TrackRenderer instance
   * @param {HTMLElement} modal
   */
  static close(self, modal) {
    FeatureGlyphLegend.destroyPreviews(self);
    modal.classList.remove('show');
  }

  /**
   * Create the modal shell. The body is (re)built by renderContent().
   * @param {Object} self - TrackRenderer instance
   * @returns {HTMLElement}
   */
  static createModal(self) {
    const modal = document.createElement('div');
    modal.id = 'featureGlyphLegendModal';
    modal.className = 'modal';

    modal.innerHTML = `
      <div class="modal-content resizable" style="max-width: 1900px; width: 95vw; max-height: 85vh;">
        <div class="modal-header">
          <h3 id="featureGlyphLegendTitle">
            <i class="fas fa-shapes"></i> Feature Glyph Legend
          </h3>
          <div class="modal-controls">
            <button class="modal-close" id="closeFeatureGlyphLegendModal">&times;</button>
          </div>
        </div>
        <div class="modal-body" id="featureGlyphLegendBody" style="max-height: calc(85vh - 140px); overflow-y: auto;">
          <div id="glyphLegendIntro" style="margin-bottom: 20px; color: var(--text-secondary); font-size: 14px;"></div>
          <div id="glyphLegendGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px;">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary modal-close">Close</button>
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

    modal.addEventListener('click', e => {
      if (e.target.classList.contains('modal-close')) {
        FeatureGlyphLegend.close(self, modal);
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

    return modal;
  }

  /**
   * Build the legend cards and previews from the live track settings.
   * @param {Object} self  - TrackRenderer instance
   * @param {HTMLElement} modal
   */
  static renderContent(self, modal) {
    const grid = modal.querySelector('#glyphLegendGrid');
    const intro = modal.querySelector('#glyphLegendIntro');
    if (!grid) return;

    // Release the previous generation of Canvas previews before rebuilding
    FeatureGlyphLegend.destroyPreviews(self);

    const context = FeatureGlyphLegend.getContext(self);
    const entries = FeatureGlyphLegend.getEntries();

    if (intro) {
      intro.innerHTML = FeatureGlyphLegend.buildIntroHTML(context);
    }

    grid.innerHTML = entries.map(entry => FeatureGlyphLegend.buildCardHTML(self, entry, context)).join('');

    // Draw the previews through the real rendering pipeline
    grid.querySelectorAll('.glyph-legend-item').forEach((card, index) => {
      const container = card.querySelector('.glyph-preview-container');
      const entry = entries[index];
      if (!container || !entry) return;

      const preview =
        context.renderingMode === 'canvas'
          ? FeatureGlyphLegend.createCanvasPreview(self, entry, context)
          : FeatureGlyphLegend.createSVGPreview(self, entry, context);
      if (preview) {
        container.appendChild(preview);
      }
    });
  }

  /**
   * Destroy the Canvas renderers backing the previews.
   * @param {Object} self - TrackRenderer instance
   */
  static destroyPreviews(self) {
    if (!Array.isArray(self.glyphLegendRenderers)) {
      self.glyphLegendRenderers = [];
      return;
    }

    self.glyphLegendRenderers.forEach(renderer => {
      try {
        renderer.destroy();
      } catch (error) {
        console.warn('Failed to destroy glyph legend preview renderer:', error);
      }
    });
    self.glyphLegendRenderers = [];
  }

  // ---------------------------------------------------------------------------
  // Drawing parameters
  // ---------------------------------------------------------------------------

  /**
   * Shared drawing parameters for the previews. These mirror how
   * calculateGeneTrackLayout() and createSVGGeneElement() derive the values the
   * real track draws with, so previews and track stay in lockstep.
   * @param {Object} self - TrackRenderer instance
   * @returns {Object}
   */
  static getContext(self) {
    const settings = self.getTrackSettings('genes');

    // Same fallback as calculateGeneTrackLayout()
    const geneHeight = settings?.geneHeight || 12;

    // Same zoom-based formula as createSVGGeneElement()/CanvasGenesRenderer.render().
    // A preview maps 1 bp to 1 px, so its effective viewport range is the preview
    // width — using that here keeps the SVG and Canvas previews identical.
    const zoomFactor = 10000 / GLYPH_LEGEND_PREVIEW_WIDTH;
    const maxStrokeWidth = settings?.maxBorderWidth !== undefined ? settings.maxBorderWidth : 1;
    const strokeWidth = Math.min(maxStrokeWidth, Math.max(0.3, Math.min(2, 1.5 * zoomFactor)));

    // Promoters and terminators extend above their row; reserve the head room
    // the track reserves for them (calculateGeneTrackLayout).
    const topPadding = Math.max(2, Math.round(geneHeight * 0.8));

    return {
      settings,
      renderingMode: settings?.renderingMode === 'canvas' ? 'canvas' : 'svg',
      geneHeight,
      strokeWidth,
      previewWidth: GLYPH_LEGEND_PREVIEW_WIDTH,
      topPadding,
      previewHeight: topPadding + geneHeight + 6,
    };
  }

  /**
   * The palette the track assigns gene/operon colours from.
   * @param {Object} self - TrackRenderer instance
   * @returns {string[]}
   */
  static getPalette(self) {
    const palette = self.genomeBrowser?.operonColors;
    return Array.isArray(palette) && palette.length > 0 ? palette : ['#e74c3c', '#3498db', '#2ecc71'];
  }

  // ---------------------------------------------------------------------------
  // Catalogue
  // ---------------------------------------------------------------------------

  /**
   * Feature catalogue. Descriptions are written per rendering mode because the
   * SVG and Canvas renderers genuinely draw several types differently.
   * @returns {Object[]}
   */
  static getEntries() {
    return [
      {
        key: 'cds-forward',
        name: 'CDS (Forward)',
        type: 'CDS',
        strand: 1,
        width: 120,
        caption: 'Forward strand',
        descriptions: {
          svg: 'Protein-coding sequence. Right-pointing arrow whose head is 30% of the glyph width (capped at 15 px), filled with the gene colour and a 20% lighter tint.',
          canvas:
            'Protein-coding sequence. Right-pointing arrow whose head is 30% of the glyph width (capped at 15 px), filled with the gene colour and a 20% lighter tint.',
        },
      },
      {
        key: 'cds-reverse',
        name: 'CDS (Reverse)',
        type: 'CDS',
        strand: -1,
        width: 120,
        caption: 'Reverse strand',
        descriptions: {
          svg: 'Same arrow glyph mirrored to point left. Strand is the only difference from a forward CDS — colour never encodes strand.',
          canvas:
            'Same arrow glyph mirrored to point left. Strand is the only difference from a forward CDS — colour never encodes strand.',
        },
      },
      {
        key: 'gene',
        name: 'Gene',
        type: 'gene',
        strand: 1,
        width: 120,
        descriptions: {
          svg: 'General gene feature. Drawn with the identical directional arrow used for CDS — the track does not give gene and CDS different shapes or colours.',
          canvas:
            'General gene feature. Drawn with the identical directional arrow used for CDS — the track does not give gene and CDS different shapes or colours.',
        },
      },
      {
        key: 'mrna',
        name: 'mRNA',
        type: 'mRNA',
        strand: 1,
        width: 120,
        descriptions: {
          svg: 'Filled sine wave spanning the transcript, using the green mRNA gradient (#15803d → #4ade80). The outline takes the gene colour, darkened 20%.',
          canvas:
            'Canvas mode has no wave path: mRNA falls back to the directional arrow, filled with the green mRNA gradient (#15803d → #4ade80).',
        },
      },
      {
        key: 'trna',
        name: 'tRNA',
        type: 'tRNA',
        strand: 1,
        width: 120,
        descriptions: {
          svg: 'Hexagonal chevron (pointed at both ends above 20 px wide) with a vertical lime gradient (#a3e635 → #65a30d). Above 40 px a small accent dot is added near the tip.',
          canvas:
            'Simplified cloverleaf — a stem with three loops — filled with the green tRNA gradient (#166534 → #22c55e). Below 15 px it collapses to a rounded rectangle.',
        },
      },
      {
        key: 'rrna',
        name: 'rRNA',
        type: 'rRNA',
        strand: 1,
        width: 120,
        descriptions: {
          svg: 'Capsule/pill with fully rounded ends and an emerald gradient (#34d399 → #059669). Above 30 px wide, two translucent horizontal stripes are drawn inside.',
          canvas:
            'Ellipse spanning the feature (80% of the row height), filled with the green rRNA gradient (#14532d → #16a34a). No stripes in Canvas mode.',
        },
      },
      {
        key: 'promoter',
        name: 'Promoter',
        type: 'promoter',
        strand: 1,
        width: 60,
        descriptions: {
          svg: 'Purple (#a855f7) circle at the transcription start plus an arrow that rises above the row and points along the strand. The track reserves extra head room for this overhang.',
          canvas:
            'Bent arrow drawn inside the row (no overhang above it), filled with the blue promoter gradient (#1e40af → #3b82f6).',
        },
      },
      {
        key: 'terminator',
        name: 'Terminator',
        type: 'terminator',
        strand: 1,
        width: 60,
        descriptions: {
          svg: 'Red (#ef4444) lollipop centred on the feature: a vertical stem rising above the row with a filled circle on top. Stem width is 15% of the glyph width.',
          canvas:
            'T-shape drawn inside the row (no overhang above it), filled with the red terminator gradient (#7f1d1d → #dc2626).',
        },
      },
      {
        key: 'regulatory',
        name: 'Regulatory',
        type: 'regulatory',
        strand: 1,
        width: 60,
        descriptions: {
          svg: 'Diamond/rhombus filled with the orange regulatory gradient (#c2410c → #f97316), outlined in the gene colour darkened 20%.',
          canvas:
            'Canvas mode has no diamond path: regulatory features fall back to the directional arrow, filled with the orange regulatory gradient (#c2410c → #f97316).',
        },
      },
      {
        key: 'repeat-region',
        name: 'Repeat Region',
        type: 'repeat_region',
        strand: 1,
        width: 120,
        descriptions: {
          svg: 'Three stacked red (#ef4444) capsules spanning the feature; the capsules touch below 12 px row height and separate above it.',
          canvas:
            'Three stacked capsules spanning the feature, filled with the grey repeat gradient (#374151 → #6b7280).',
        },
      },
      {
        key: 'comment',
        name: 'Comment / Note',
        type: 'comment',
        strand: 1,
        width: 120,
        descriptions: {
          svg: 'Purple speech bubble (comment gradient #7c3aed → #a855f7) with a small tail at the bottom right. Below 15 px wide it becomes a rounded rectangle with an indicator dot.',
          canvas:
            'Canvas mode has no bubble path: comments fall back to the directional arrow, filled with the purple comment gradient (#7c3aed → #a855f7).',
        },
      },
      {
        key: 'misc-feature',
        name: 'Misc Feature',
        type: 'misc_feature',
        strand: 1,
        width: 120,
        caption: 'Shared with note',
        descriptions: {
          svg: 'misc_feature and note use exactly the same speech bubble glyph as comment — the three types are interchangeable in the renderer.',
          canvas:
            'misc_feature and note use exactly the same glyph as comment — the directional arrow with the purple comment gradient.',
        },
      },
      {
        key: 'other-type',
        name: 'Other Feature Types',
        type: 'exon',
        strand: 1,
        width: 120,
        caption: 'exon, ncRNA, source, …',
        descriptions: {
          svg: 'Any type without a dedicated glyph (exon, ncRNA, source, STS, …) falls back to the standard directional arrow with the gene colour.',
          canvas:
            'Any type without a dedicated glyph (exon, ncRNA, source, STS, …) falls back to the standard directional arrow with the gene colour.',
        },
      },
      {
        key: 'operon',
        name: 'Operon',
        type: 'CDS',
        strand: 1,
        layout: 'operon',
        colorRole: 'operon',
        widths: [52, 60, 46],
        strands: [1, 1, -1],
        descriptions: {
          svg: 'Co-transcribed genes placed on one row (enable “Show operons on same row”). Every member is drawn with its own arrow but shares a single operon colour — that shared colour is what marks them as one operon.',
          canvas:
            'Co-transcribed genes placed on one row (enable “Show operons on same row”). Every member is drawn with its own arrow but shares a single operon colour — that shared colour is what marks them as one operon.',
        },
      },
      {
        key: 'user-defined',
        name: 'User-Defined Feature',
        type: 'CDS',
        strand: 1,
        width: 120,
        colorRole: 'userDefined',
        descriptions: {
          svg: `Features you add in the app are forced to the success green (${GLYPH_LEGEND_USER_DEFINED_COLOR}) regardless of type, so they stand out from imported annotations.`,
          canvas: `Features you add in the app are forced to the success green (${GLYPH_LEGEND_USER_DEFINED_COLOR}) regardless of type, so they stand out from imported annotations.`,
        },
      },
      {
        key: 'small-feature',
        name: 'Small Feature',
        type: 'CDS',
        strand: 1,
        width: 6,
        caption: 'Zoomed out, under 8 px',
        descriptions: {
          svg: 'When a feature is narrower than 8 px the arrow collapses to a solid triangle pointing along the strand, and the label is dropped below 30 px.',
          canvas:
            'When a feature is narrower than 8 px the arrow collapses to a solid triangle pointing along the strand, and the label is dropped below 30 px.',
        },
      },
      {
        key: 'truncated',
        name: 'Truncated Feature',
        type: 'CDS',
        strand: 1,
        width: 150,
        truncate: 'right',
        caption: 'Continues past the view edge',
        descriptions: {
          svg: 'A feature running past the edge of the view is clipped there and gets a jagged edge on that side, so a partly visible feature is never mistaken for a complete one.',
          canvas:
            'A feature running past the edge of the view is clipped there and gets a zigzag edge on that side, so a partly visible feature is never mistaken for a complete one.',
        },
      },
    ];
  }

  // ---------------------------------------------------------------------------
  // Card markup
  // ---------------------------------------------------------------------------

  /**
   * Intro paragraph naming the settings the previews were drawn with.
   * @param {Object} context - from getContext()
   * @returns {string} HTML
   */
  static buildIntroHTML(context) {
    const modeLabel = context.renderingMode === 'canvas' ? 'Canvas' : 'SVG';
    return `
      <p style="margin: 0 0 8px 0;">
        Reference guide showing how each feature type is drawn in the Genes &amp; Features track.
        Every preview is produced by the track's own renderer with your current track settings —
        <strong>${modeLabel}</strong> rendering mode, ${context.geneHeight} px glyph height,
        ${context.strokeWidth} px border, ${context.settings?.fontSize || 11} px labels.
      </p>
      <p style="margin: 0;">
        Shape is decided by the feature type; the colours listed below are fixed per type. The base
        colour of arrow-shaped features (CDS, gene, other types) is <em>not</em> type-based — the track
        assigns it per gene/operon from a rotating palette, so the same feature type appears in
        different colours across the track. Previews use the first palette colour.
      </p>
    `;
  }

  /**
   * One legend card. The preview container is filled in afterwards by the
   * matching renderer.
   * @param {Object} self    - TrackRenderer instance
   * @param {Object} entry   - catalogue entry
   * @param {Object} context - from getContext()
   * @returns {string} HTML
   */
  static buildCardHTML(self, entry, context) {
    const description = entry.descriptions[context.renderingMode] || entry.descriptions.svg;

    return `
      <div class="glyph-legend-item" data-glyph-key="${entry.key}" style="
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      ">
        <div class="glyph-preview-container" style="
          background: #fafafa;
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
          ${
            entry.caption
              ? `<div style="margin: 0 0 4px 0; font-size: 11px; color: var(--text-secondary);">${entry.caption}</div>`
              : ''
          }
          <p style="margin: 0; font-size: 12px; color: var(--text-secondary); line-height: 1.5;">${description}</p>
          <div style="
            margin-top: 6px;
            font-size: 10px;
            color: #6c757d;
            font-family: monospace;
            padding: 3px 7px;
            background: #f8f9fa;
            border-radius: 3px;
            display: inline-block;
          ">${FeatureGlyphLegend.getMetaLabel(self, entry, context)}</div>
        </div>
      </div>
    `;
  }

  /**
   * Monospace meta line under each card.
   * @param {Object} self
   * @param {Object} entry
   * @param {Object} context
   * @returns {string}
   */
  static getMetaLabel(self, entry, context) {
    if (entry.layout === 'operon') {
      return `Type: ${entry.type} ×${entry.widths.length} · one row`;
    }

    const parts = FeatureGlyphLegend.getParts(self, entry, context);
    const width = parts.reduce((max, part) => Math.max(max, part.width), 0);
    return `Type: ${entry.type} · ${Math.round(width)} px wide`;
  }

  // ---------------------------------------------------------------------------
  // Preview geometry and rendering
  // ---------------------------------------------------------------------------

  /**
   * Turn a catalogue entry into the mock genes plus geometry the renderers need.
   * Coordinates map 1 bp to 1 px inside the preview box.
   * @param {Object} self
   * @param {Object} entry
   * @param {Object} context
   * @returns {Object[]} parts: { gene, x, width, isLeftTruncated, isRightTruncated, operonInfo }
   */
  static getParts(self, entry, context) {
    const { previewWidth } = context;
    const palette = FeatureGlyphLegend.getPalette(self);
    const isOperon = entry.colorRole === 'operon';
    const isUserDefined = entry.colorRole === 'userDefined';

    const operonInfo = {
      color: isUserDefined ? GLYPH_LEGEND_USER_DEFINED_COLOR : palette[isOperon ? 1 % palette.length : 0],
      operonName: isOperon ? 'sample operon' : null,
      isInOperon: isOperon,
    };

    const makeGene = strand => ({
      type: entry.type,
      strand,
      qualifiers: {},
      userDefined: isUserDefined,
    });

    if (entry.layout === 'operon') {
      const gap = 6;
      const total = entry.widths.reduce((sum, width) => sum + width, 0) + gap * (entry.widths.length - 1);
      let x = Math.max(0, Math.round((previewWidth - total) / 2));

      return entry.widths.map((width, index) => {
        const part = {
          gene: makeGene(entry.strands[index]),
          x,
          width,
          isLeftTruncated: false,
          isRightTruncated: false,
          operonInfo,
        };
        x += width + gap;
        return part;
      });
    }

    if (entry.truncate === 'right') {
      const x = Math.max(0, previewWidth - entry.width);
      return [
        {
          gene: makeGene(entry.strand),
          x,
          width: previewWidth - x,
          isLeftTruncated: false,
          isRightTruncated: true,
          operonInfo,
        },
      ];
    }

    const width = Math.min(entry.width, previewWidth);
    return [
      {
        gene: makeGene(entry.strand),
        x: Math.round((previewWidth - width) / 2),
        width,
        isLeftTruncated: false,
        isRightTruncated: false,
        operonInfo,
      },
    ];
  }

  /**
   * SVG preview — the same calls, in the same order, as createSVGGeneElement().
   * @param {Object} self
   * @param {Object} entry
   * @param {Object} context
   * @returns {SVGSVGElement}
   */
  static createSVGPreview(self, entry, context) {
    const { settings, geneHeight, strokeWidth, previewWidth, previewHeight, topPadding } = context;

    const svg = document.createElementNS(GLYPH_LEGEND_SVG_NS, 'svg');
    svg.setAttribute('width', previewWidth);
    svg.setAttribute('height', previewHeight);
    svg.setAttribute('viewBox', `0 0 ${previewWidth} ${previewHeight}`);
    svg.setAttribute('class', 'genes-svg-container glyph-legend-preview');
    svg.style.display = 'block';
    svg.style.flex = '0 0 auto';

    const defs = document.createElementNS(GLYPH_LEGEND_SVG_NS, 'defs');
    GeneShapeCreators.createSpecializedGradients(defs);
    svg.appendChild(defs);

    FeatureGlyphLegend.getParts(self, entry, context).forEach((part, index) => {
      const gradientId = `gene-gradient-legend-${entry.key}-${index}`;
      GeneShapeCreators.createSVGGeneGradient(self, defs, gradientId, part.operonInfo.color);

      const group = document.createElementNS(GLYPH_LEGEND_SVG_NS, 'g');
      group.setAttribute('class', `svg-gene-element ${part.gene.type.toLowerCase()}`);
      group.setAttribute('transform', `translate(${part.x}, ${topPadding})`);

      const shape = GeneShapeCreators.createSVGGeneShape(
        self,
        part.gene,
        part.width,
        geneHeight,
        gradientId,
        part.operonInfo,
        part.isLeftTruncated,
        part.isRightTruncated,
        strokeWidth
      );
      if (shape) {
        group.appendChild(shape);
      }

      // The track labels a feature once it is wider than 30 px
      if (part.width > 30 && self.genomeBrowser?.getQualifierValue) {
        const geneText = GeneShapeCreators.createSVGGeneText(self, part.gene, part.width, geneHeight, settings);
        if (geneText) {
          group.appendChild(geneText);
        }
      }

      svg.appendChild(group);
    });

    return svg;
  }

  /**
   * Canvas preview — drawn by CanvasGenesRenderer, the renderer the track uses
   * in Canvas mode, on a one-row viewport where 1 bp equals 1 px.
   * @param {Object} self
   * @param {Object} entry
   * @param {Object} context
   * @returns {HTMLElement}
   */
  static createCanvasPreview(self, entry, context) {
    if (typeof CanvasGenesRenderer === 'undefined') {
      // Fall back to SVG rather than showing an empty card
      return FeatureGlyphLegend.createSVGPreview(self, entry, context);
    }

    const { settings, geneHeight, previewWidth, previewHeight, topPadding } = context;

    const holder = document.createElement('div');
    holder.className = 'glyph-legend-preview';
    holder.style.cssText = `position: relative; flex: 0 0 auto; width: ${previewWidth}px; height: ${previewHeight}px;`;

    const genes = FeatureGlyphLegend.getParts(self, entry, context).map(part => ({
      ...part.gene,
      // 1-based inclusive coordinates, so start - 1 lands on the intended pixel
      start: part.x + 1,
      // Overshoot the viewport so the renderer flags the feature as truncated
      end: part.isRightTruncated ? previewWidth + 40 : part.x + part.width,
      __legendColor: part.operonInfo.color,
      __legendOperonName: part.operonInfo.operonName,
    }));

    const layout = {
      geneHeight,
      rowSpacing: 6,
      rulerHeight: 0,
      topPadding,
      bottomPadding: 0,
      maxRows: 1,
      effectiveRows: 1,
      totalHeight: previewHeight,
      layoutMode: 'packed',
    };

    const renderer = new CanvasGenesRenderer(
      holder,
      [genes],
      { start: 0, end: previewWidth },
      layout,
      [],
      settings,
      FeatureGlyphLegend.createBrowserProxy(self)
    );

    // Previews are illustrations, not clickable features
    if (renderer.canvas) {
      renderer.canvas.style.pointerEvents = 'none';
    }

    if (!Array.isArray(self.glyphLegendRenderers)) {
      self.glyphLegendRenderers = [];
    }
    self.glyphLegendRenderers.push(renderer);

    return holder;
  }

  /**
   * Genome browser stand-in for previews. Everything falls through to the real
   * instance except colour lookup: calling the real getGeneOperonInfo() would
   * register the mock genes in the operon colour map and shift the colours
   * assigned to real genes.
   * @param {Object} self
   * @returns {Object}
   */
  static createBrowserProxy(self) {
    const proxy = Object.create(self.genomeBrowser || {});
    proxy.getGeneOperonInfo = gene => ({
      color: gene?.__legendColor || FeatureGlyphLegend.getPalette(self)[0],
      operonName: gene?.__legendOperonName || null,
      isInOperon: Boolean(gene?.__legendOperonName),
    });
    // Never let a real selection add a highlight to a preview glyph
    proxy.selectedGene = null;
    return proxy;
  }
}

if (typeof window !== 'undefined') {
  window.FeatureGlyphLegend = FeatureGlyphLegend;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = FeatureGlyphLegend;
}
