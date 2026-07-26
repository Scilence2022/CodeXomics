/**
 * Feature Glyph Legend / Genes & Features track parity.
 *
 * The legend is a reference guide for the track, so its previews must be drawn
 * by the track's own renderer with the track's own settings — not by a parallel
 * implementation with hard-coded sizes and colours. These tests pin the parts
 * that silently drift: glyph height, border width, shape dispatch, the operon
 * colour rule, and the descriptions that change with the rendering mode.
 */
import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import TrackRenderer from '../../src/renderer/modules/TrackRenderer.js';
import GeneShapeCreators from '../../src/renderer/modules/tracks/GeneShapeCreators.js';
import FeatureGlyphLegend from '../../src/renderer/modules/tracks/FeatureGlyphLegend.js';

const OPERON_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12'];

function makeGenomeBrowser() {
  return {
    operonColors: [...OPERON_COLORS],
    operonColorIndex: 0,
    operonColorMap: new Map(),
    selectedGene: null,
    getQualifierValue(qualifiers, key) {
      if (!qualifiers || !qualifiers[key]) return null;
      const value = qualifiers[key];
      return Array.isArray(value) ? value[0] || null : value;
    },
    getGeneOperonInfo: vi.fn(() => ({ color: '#123456', operonName: null, isInOperon: false })),
  };
}

function makeRenderer(settingsOverrides = {}) {
  const genomeBrowser = makeGenomeBrowser();
  const renderer = new TrackRenderer(genomeBrowser);
  genomeBrowser.trackRenderer = renderer;
  // Seed the settings cache the same way the settings modal does
  renderer.trackSettings = {
    genes: { ...renderer._getDefaultTrackSettings('genes'), ...settingsOverrides },
  };
  return { renderer, genomeBrowser };
}

/** Render one legend entry to SVG and hand back the entry + rendered root. */
function previewFor(renderer, key) {
  const context = FeatureGlyphLegend.getContext(renderer);
  const entry = FeatureGlyphLegend.getEntries().find(e => e.key === key);
  expect(entry, `legend entry "${key}"`).toBeDefined();
  return { entry, context, svg: FeatureGlyphLegend.createSVGPreview(renderer, entry, context) };
}

describe('Feature Glyph Legend parity with the genes track', () => {
  beforeAll(() => {
    global.GeneShapeCreators = GeneShapeCreators;
    window.GeneShapeCreators = GeneShapeCreators;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  describe('drawing parameters come from live track settings', () => {
    it('uses the track glyph height, not a fixed preview height', () => {
      const { renderer } = makeRenderer({ geneHeight: 32 });
      expect(FeatureGlyphLegend.getContext(renderer).geneHeight).toBe(32);
    });

    it('falls back to the same default as calculateGeneTrackLayout', () => {
      const { renderer } = makeRenderer({ geneHeight: undefined });
      expect(FeatureGlyphLegend.getContext(renderer).geneHeight).toBe(12);
    });

    it('caps the border width with the maxBorderWidth setting', () => {
      const { renderer } = makeRenderer({ maxBorderWidth: 0.5 });
      expect(FeatureGlyphLegend.getContext(renderer).strokeWidth).toBe(0.5);
    });

    it('reserves the same head room the track reserves for promoters/terminators', () => {
      const { renderer } = makeRenderer({ geneHeight: 24 });
      // calculateGeneTrackLayout: Math.max(2, Math.round(geneHeight * 0.8))
      expect(FeatureGlyphLegend.getContext(renderer).topPadding).toBe(19);
    });

    it('follows the track rendering mode', () => {
      const { renderer } = makeRenderer({ renderingMode: 'canvas' });
      expect(FeatureGlyphLegend.getContext(renderer).renderingMode).toBe('canvas');
      const { renderer: svgRenderer } = makeRenderer({ renderingMode: 'svg' });
      expect(FeatureGlyphLegend.getContext(svgRenderer).renderingMode).toBe('svg');
    });
  });

  describe('previews go through the track shape dispatcher', () => {
    let renderer;

    beforeEach(() => {
      ({ renderer } = makeRenderer({ geneHeight: 24, maxBorderWidth: 1 }));
    });

    it('draws a CDS with the same path the track would draw', () => {
      const { entry, context, svg } = previewFor(renderer, 'cds-forward');
      const [part] = FeatureGlyphLegend.getParts(renderer, entry, context);

      const trackShape = GeneShapeCreators.createSVGGeneShape(
        renderer,
        part.gene,
        part.width,
        context.geneHeight,
        'gene-gradient-track',
        part.operonInfo,
        false,
        false,
        context.strokeWidth
      );

      const previewShape = svg.querySelector('path.gene-arrow');
      expect(previewShape).not.toBeNull();
      expect(previewShape.getAttribute('d')).toBe(trackShape.getAttribute('d'));
      expect(previewShape.getAttribute('stroke-width')).toBe(trackShape.getAttribute('stroke-width'));
    });

    it('renders specialized types with their specialized glyph', () => {
      expect(previewFor(renderer, 'promoter').svg.querySelector('g.gene-promoter')).not.toBeNull();
      expect(previewFor(renderer, 'terminator').svg.querySelector('g.gene-terminator')).not.toBeNull();
      expect(previewFor(renderer, 'rrna').svg.querySelector('g.gene-rrna')).not.toBeNull();
      expect(previewFor(renderer, 'trna').svg.querySelector('g.gene-trna')).not.toBeNull();
      expect(previewFor(renderer, 'mrna').svg.querySelector('path.gene-mrna')).not.toBeNull();
      expect(previewFor(renderer, 'regulatory').svg.querySelector('path.gene-regulatory')).not.toBeNull();
      expect(previewFor(renderer, 'repeat-region').svg.querySelector('g.gene-repeat')).not.toBeNull();
      expect(previewFor(renderer, 'comment').svg.querySelector('g.gene-comment')).not.toBeNull();
      expect(previewFor(renderer, 'misc-feature').svg.querySelector('g.gene-comment')).not.toBeNull();
    });

    it('shows the triangle the track falls back to below 8 px', () => {
      const { svg } = previewFor(renderer, 'small-feature');
      expect(svg.querySelector('path.gene-triangle')).not.toBeNull();
      expect(svg.querySelector('path.gene-arrow')).toBeNull();
    });

    it('shows the jagged edge the track uses for features crossing the view edge', () => {
      const { svg } = previewFor(renderer, 'truncated');
      expect(svg.querySelector('path.right-truncated')).not.toBeNull();
    });

    it('labels a glyph exactly when the track would (wider than 30 px)', () => {
      expect(previewFor(renderer, 'cds-forward').svg.querySelector('text')).not.toBeNull();
      expect(previewFor(renderer, 'small-feature').svg.querySelector('text')).toBeNull();
    });

    it('sizes every glyph to the track glyph height', () => {
      const { entry, context } = previewFor(renderer, 'rrna');
      const [part] = FeatureGlyphLegend.getParts(renderer, entry, context);
      const capsule = previewFor(renderer, 'rrna').svg.querySelector('rect');
      // createRRNAShape: height - 2 * (height * 0.1)
      expect(Number(capsule.getAttribute('height'))).toBeCloseTo(context.geneHeight * 0.8, 5);
      expect(part.width).toBeGreaterThan(0);
    });
  });

  describe('colours follow the track colour rules', () => {
    it('takes the base colour from the browser operon palette', () => {
      const { renderer } = makeRenderer();
      const context = FeatureGlyphLegend.getContext(renderer);
      const entry = FeatureGlyphLegend.getEntries().find(e => e.key === 'cds-forward');
      const [part] = FeatureGlyphLegend.getParts(renderer, entry, context);
      expect(part.operonInfo.color).toBe(OPERON_COLORS[0]);
    });

    it('gives every operon member the same colour, like getGeneOperonInfo does', () => {
      const { renderer } = makeRenderer();
      const context = FeatureGlyphLegend.getContext(renderer);
      const entry = FeatureGlyphLegend.getEntries().find(e => e.key === 'operon');
      const parts = FeatureGlyphLegend.getParts(renderer, entry, context);

      expect(parts).toHaveLength(3);
      expect(new Set(parts.map(p => p.operonInfo.color)).size).toBe(1);
      expect(parts.every(p => p.operonInfo.isInOperon)).toBe(true);
    });

    it('uses the user-defined green for user-added features', () => {
      const { renderer } = makeRenderer();
      const context = FeatureGlyphLegend.getContext(renderer);
      const entry = FeatureGlyphLegend.getEntries().find(e => e.key === 'user-defined');
      const [part] = FeatureGlyphLegend.getParts(renderer, entry, context);
      expect(part.operonInfo.color).toBe('#10b981');
      expect(part.gene.userDefined).toBe(true);
    });

    it('never registers preview glyphs in the operon colour map', () => {
      const { renderer, genomeBrowser } = makeRenderer();
      const context = FeatureGlyphLegend.getContext(renderer);
      FeatureGlyphLegend.getEntries().forEach(entry => {
        FeatureGlyphLegend.createSVGPreview(renderer, entry, context);
      });
      expect(genomeBrowser.getGeneOperonInfo).not.toHaveBeenCalled();
      expect(genomeBrowser.operonColorMap.size).toBe(0);
      expect(genomeBrowser.operonColorIndex).toBe(0);
    });

    it('shields the canvas renderer from the real colour map too', () => {
      const { renderer, genomeBrowser } = makeRenderer();
      const proxy = FeatureGlyphLegend.createBrowserProxy(renderer);
      const info = proxy.getGeneOperonInfo({ __legendColor: '#abcdef', __legendOperonName: 'ops' });

      expect(info).toEqual({ color: '#abcdef', operonName: 'ops', isInOperon: true });
      expect(genomeBrowser.getGeneOperonInfo).not.toHaveBeenCalled();
      expect(proxy.selectedGene).toBeNull();
      // Everything else still resolves to the real browser
      expect(proxy.getQualifierValue({ gene: ['thrA'] }, 'gene')).toBe('thrA');
    });
  });

  describe('descriptions match the active renderer', () => {
    it('describes the SVG glyph in SVG mode and the Canvas glyph in Canvas mode', () => {
      const { renderer } = makeRenderer();
      const entries = FeatureGlyphLegend.getEntries();

      entries.forEach(entry => {
        expect(entry.descriptions.svg, `${entry.key} svg description`).toBeTruthy();
        expect(entry.descriptions.canvas, `${entry.key} canvas description`).toBeTruthy();
      });

      // Types the two renderers genuinely draw differently must not share text
      ['rrna', 'trna', 'promoter', 'terminator', 'mrna', 'regulatory', 'comment'].forEach(key => {
        const entry = entries.find(e => e.key === key);
        expect(entry.descriptions.svg, `${key} descriptions should differ per mode`).not.toBe(
          entry.descriptions.canvas
        );
      });
    });

    it('covers every feature type the renderers special-case', () => {
      const { renderer } = makeRenderer();
      const covered = new Set(FeatureGlyphLegend.getEntries().map(e => e.type.toLowerCase()));
      ['promoter', 'terminator', 'regulatory', 'repeat_region', 'trna', 'rrna', 'mrna', 'misc_feature'].forEach(
        type => {
          expect(GeneShapeCreators.shouldUseSpecializedShape(type), `${type} is specialized`).toBe(true);
          expect(covered.has(type), `legend covers ${type}`).toBe(true);
        }
      );
    });
  });

  describe('legend modal lifecycle', () => {
    it('rebuilds the cards from current settings each time it is opened', () => {
      const { renderer } = makeRenderer({ geneHeight: 24 });
      const modal = FeatureGlyphLegend.createModal(renderer);
      document.body.appendChild(modal);

      FeatureGlyphLegend.renderContent(renderer, modal);
      const firstHeight = modal.querySelector('.glyph-preview-container svg').getAttribute('height');

      renderer.trackSettings.genes.geneHeight = 40;
      FeatureGlyphLegend.renderContent(renderer, modal);
      const secondHeight = modal.querySelector('.glyph-preview-container svg').getAttribute('height');

      expect(secondHeight).not.toBe(firstHeight);
      expect(modal.querySelectorAll('.glyph-legend-item').length).toBe(FeatureGlyphLegend.getEntries().length);
      // One preview per card, never stacked from a previous render
      modal.querySelectorAll('.glyph-preview-container').forEach(container => {
        expect(container.childElementCount).toBe(1);
      });
    });

    it('destroys canvas preview renderers when the legend closes', () => {
      const { renderer } = makeRenderer();
      const destroy = vi.fn();
      renderer.glyphLegendRenderers = [{ destroy }];

      const modal = FeatureGlyphLegend.createModal(renderer);
      document.body.appendChild(modal);
      modal.classList.add('show');
      FeatureGlyphLegend.close(renderer, modal);

      expect(destroy).toHaveBeenCalledTimes(1);
      expect(renderer.glyphLegendRenderers).toHaveLength(0);
      expect(modal.classList.contains('show')).toBe(false);
    });
  });

  describe('classic-script loading', () => {
    // index.html loads these as plain <script> tags, so their top-level const
    // declarations share one global lexical scope. A name declared by two of
    // them is a SyntaxError that stops the second script from defining its
    // class at all — the legend button then throws "is not defined".
    const topLevelConsts = source => [...source.matchAll(/^const\s+([A-Za-z0-9_$]+)/gm)].map(match => match[1]);

    it('does not redeclare a top-level const that GeneShapeCreators owns', () => {
      const legendSource = fs.readFileSync(
        path.join(process.cwd(), 'src/renderer/modules/tracks/FeatureGlyphLegend.js'),
        'utf-8'
      );
      const shapeSource = fs.readFileSync(
        path.join(process.cwd(), 'src/renderer/modules/tracks/GeneShapeCreators.js'),
        'utf-8'
      );

      const shared = topLevelConsts(legendSource).filter(name => topLevelConsts(shapeSource).includes(name));
      expect(shared).toEqual([]);
    });

    it('is loaded by index.html', () => {
      const html = fs.readFileSync(path.join(process.cwd(), 'src/renderer/index.html'), 'utf-8');
      expect(html).toContain('modules/tracks/FeatureGlyphLegend.js');
    });
  });
});
