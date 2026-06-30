/**
 * CanvasGenesRenderer gene-position alignment.
 *
 * Regression guard for the 1-based -> 0-based coordinate fix: gene coordinates
 * are 1-based (GFF/GenBank) but the viewport / sequence / secondary ruler are
 * 0-based. The canvas renderer must subtract 1 from the gene start so a gene's
 * left edge lands on the left edge of its first base cell — identical to the
 * SVG renderer (createSVGGeneElement) and HTML positioner (setGeneElementPosition).
 * Without the -1, canvas genes sat one base to the right of the secondary scale.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import CanvasGenesRenderer from '../../src/renderer/modules/CanvasGenesRenderer.js';

// Build a renderer instance WITHOUT running the constructor (which sets up a
// real canvas + requestAnimationFrame). We only exercise renderGene's pure
// coordinate math and read back the recorded hit region.
function makeRenderer(viewport, canvasWidth) {
  const r = Object.create(CanvasGenesRenderer.prototype);
  r.viewport = viewport;
  r.canvasWidth = canvasWidth;
  r.layout = { topPadding: 10, geneHeight: 12, rowSpacing: 4, maxRows: 10 };
  r.operons = [];
  r.geneHitRegions = [];
  r.hoveredGene = null;
  r.genomeBrowser = { selectedGene: null, getGeneOperonInfo: () => ({ color: '#888888' }) };
  // No-op canvas context: renderGene only calls save/translate/restore directly
  // (scale is hover-only) and assigns a few style properties.
  r.ctx = { save() {}, translate() {}, restore() {}, scale() {} };
  // Stub the actual drawing so we isolate the positioning logic.
  r.shouldUseSpecializedShape = () => false;
  r.drawGeneShape = () => {};
  r.drawGeneLabel = () => {};
  return r;
}

describe('CanvasGenesRenderer gene positioning', () => {
  let renderer;
  const viewport = { start: 1000, end: 1050 }; // 50 bp, zoomed to base level
  const canvasWidth = 1000; // 20 px / base

  beforeEach(() => {
    renderer = makeRenderer(viewport, canvasWidth);
  });

  it("maps a gene's left edge to its 0-based first base cell (1-based -> 0-based)", () => {
    // Gene starts at 1-based position 1010 -> 0-based cell index 9 within the
    // viewport -> left edge at 9 * 20px = 180px.
    renderer.renderGene({ start: 1010, end: 1020, type: 'gene', strand: 1 }, 0, 1);
    const region = renderer.geneHitRegions[0];
    expect(region.x).toBeCloseTo(180, 5);
  });

  it('spans the full inclusive base range (1-based inclusive end needs no shift)', () => {
    // 1-based [1010, 1020] inclusive = 11 bases -> 11 * 20px = 220px wide.
    renderer.renderGene({ start: 1010, end: 1020, type: 'gene', strand: 1 }, 0, 1);
    expect(renderer.geneHitRegions[0].width).toBeCloseTo(220, 5);
  });

  it('aligns the canvas gene with the SVG/HTML renderer formula', () => {
    const gene = { start: 1023, end: 1031, type: 'CDS', strand: -1 };
    renderer.renderGene(gene, 0, 1);
    // SVG/HTML: ((gene.start - 1 - viewport.start) / range) * width
    const reference = ((gene.start - 1 - viewport.start) / (viewport.end - viewport.start)) * canvasWidth;
    expect(renderer.geneHitRegions[0].x).toBeCloseTo(reference, 5);
  });
});
