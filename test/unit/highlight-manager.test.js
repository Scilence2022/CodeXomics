/**
 * HighlightManager - persistent positional region highlights.
 *
 * Guards two things:
 *  1. CRUD + normalization logic (add/remove/list/clear, 1-based normalization,
 *     palette cycling, multiple/overlapping regions).
 *  2. The 1-based -> pixel mapping in renderHighlights(), which must match the
 *     canvas gene/sequence renderers (gene.start - 1 - viewport.start over range).
 *     See canvas-genes-renderer-position.test.js for the sibling guard.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import HighlightManager from '../../src/renderer/modules/HighlightManager.js';

// Minimal DOM so renderHighlights() runs its real pixel math. The container and
// the ruler-axis canvas report fixed rects; appended boxes are captured.
function installDom(containerRect, axisRect) {
  const appended = [];
  const container = {
    getBoundingClientRect: () => containerRect,
    querySelector: sel => (sel === '.detailed-ruler-canvas' ? { getBoundingClientRect: () => axisRect } : null),
    appendChild: node => appended.push(node),
  };
  global.document = {
    querySelectorAll: () => [],
    querySelector: sel => (sel === '.genome-browser-container' ? container : null),
    createElement: () => ({ style: {}, dataset: {}, appendChild() {} }),
  };
  return appended;
}

function makeManager(currentPosition = { start: 1000, end: 1050 }, chromosome = 'chr1') {
  const gb = { currentChromosome: chromosome, currentPosition, highlights: [] };
  return new HighlightManager(gb);
}

describe('HighlightManager CRUD + normalization', () => {
  let mgr;
  beforeEach(() => {
    installDom({ left: 0, width: 1000 }, { left: 0, width: 1000 });
    mgr = makeManager();
  });
  afterEach(() => {
    delete global.document;
  });

  it('adds a highlight with defaults and 1-based coordinates', () => {
    const h = mgr.addHighlight({ start: 1010, end: 1020 });
    expect(h.start).toBe(1010);
    expect(h.end).toBe(1020);
    expect(h.chromosome).toBe('chr1');
    expect(h.color).toBe('#f59e0b'); // first palette color
    expect(h.id).toMatch(/^hl_/);
    expect(mgr.listHighlights()).toHaveLength(1);
  });

  it('normalizes reversed and out-of-range coordinates', () => {
    const h = mgr.addHighlight({ start: 20, end: 5 });
    expect(h.start).toBe(5);
    expect(h.end).toBe(20);
    const clamped = mgr.addHighlight({ start: -3, end: 10 });
    expect(clamped.start).toBe(1); // start clamped to >= 1
  });

  it('treats a single start or end coordinate as a 1 bp highlight', () => {
    const startOnly = mgr.addHighlight({ start: 311163 });
    expect(startOnly.start).toBe(311163);
    expect(startOnly.end).toBe(311163);

    const endOnly = mgr.addHighlight({ end: 25 });
    expect(endOnly.start).toBe(25);
    expect(endOnly.end).toBe(25);
  });

  it('supports multiple and overlapping highlights', () => {
    mgr.addHighlight({ start: 1000, end: 1030 });
    mgr.addHighlight({ start: 1010, end: 1040 }); // overlaps the first
    mgr.addHighlight({ start: 1010, end: 1040 }); // duplicate range, still distinct
    expect(mgr.listHighlights()).toHaveLength(3);
  });

  it('cycles palette colors for consecutive highlights', () => {
    const colors = [0, 1, 2, 3, 4, 5].map(() => mgr.addHighlight({ start: 1000, end: 1005 }).color);
    expect(colors.slice(0, 5)).toEqual(['#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4']);
    expect(colors[5]).toBe('#f59e0b'); // wraps around
  });

  it('honors an explicit color', () => {
    const h = mgr.addHighlight({ start: 1000, end: 1005, color: '#ef4444' });
    expect(h.color).toBe('#ef4444');
  });

  it('removes a highlight by id', () => {
    const a = mgr.addHighlight({ start: 1000, end: 1010 });
    mgr.addHighlight({ start: 1020, end: 1030 });
    const removed = mgr.removeHighlight({ id: a.id });
    expect(removed).toHaveLength(1);
    expect(mgr.listHighlights()).toHaveLength(1);
    expect(mgr.listHighlights()[0].start).toBe(1020);
  });

  it('removes a highlight by exact start/end', () => {
    mgr.addHighlight({ start: 1000, end: 1010 });
    mgr.addHighlight({ start: 1020, end: 1030 });
    const removed = mgr.removeHighlight({ start: 1000, end: 1010 });
    expect(removed).toHaveLength(1);
    expect(mgr.listHighlights()).toHaveLength(1);
  });

  it('returns no removal for a non-matching selector', () => {
    mgr.addHighlight({ start: 1000, end: 1010 });
    const removed = mgr.removeHighlight({ start: 5, end: 6 });
    expect(removed).toHaveLength(0);
    expect(mgr.listHighlights()).toHaveLength(1);
  });

  it('clears all highlights', () => {
    mgr.addHighlight({ start: 1000, end: 1010 });
    mgr.addHighlight({ start: 1020, end: 1030 });
    expect(mgr.clearHighlights()).toBe(2);
    expect(mgr.listHighlights()).toHaveLength(0);
  });

  it('rejects non-numeric coordinates', () => {
    expect(() => mgr.addHighlight({ start: 'x', end: 10 })).toThrow(/numeric/);
  });
});

describe('HighlightManager rendering (1-based -> pixel mapping)', () => {
  afterEach(() => {
    delete global.document;
  });

  it("maps a highlight's left edge and width like the gene renderer", () => {
    // viewport 1000-1050 (0-based, exclusive end) => range 50, 1000px => 20px/base.
    const appended = installDom({ left: 0, width: 1000 }, { left: 0, width: 1000 });
    const mgr = makeManager({ start: 1000, end: 1050 }, 'chr1');
    mgr.addHighlight({ start: 1010, end: 1020 }); // 1-based inclusive
    // gene-renderer formula: left = (1010-1-1000)/50*1000 = 180; right = (1020-1000)/50*1000 = 400.
    expect(appended).toHaveLength(1);
    expect(appended[0].style.left).toBe('180px');
    expect(appended[0].style.width).toBe('220px');
  });

  it('adds the axis left offset for a gutter', () => {
    const appended = installDom({ left: 0, width: 1000 }, { left: 40, width: 1000 });
    const mgr = makeManager({ start: 1000, end: 1050 }, 'chr1');
    mgr.addHighlight({ start: 1010, end: 1020 });
    expect(appended[0].style.left).toBe('220px'); // 40 (axisLeft) + 180
  });

  it('does not draw a highlight on a different chromosome', () => {
    const appended = installDom({ left: 0, width: 1000 }, { left: 0, width: 1000 });
    const mgr = makeManager({ start: 1000, end: 1050 }, 'chr1');
    mgr.addHighlight({ start: 1010, end: 1020, chromosome: 'chr2' });
    expect(appended).toHaveLength(0);
  });

  it('skips highlights entirely outside the viewport', () => {
    const appended = installDom({ left: 0, width: 1000 }, { left: 0, width: 1000 });
    const mgr = makeManager({ start: 1000, end: 1050 }, 'chr1');
    mgr.addHighlight({ start: 5000, end: 5100 });
    expect(appended).toHaveLength(0);
  });

  it('enforces a minimum visible width for tiny regions', () => {
    const appended = installDom({ left: 0, width: 1000 }, { left: 0, width: 1000 });
    // Very wide viewport so a 1bp highlight is sub-pixel.
    const mgr = makeManager({ start: 0, end: 1000000 }, 'chr1');
    mgr.addHighlight({ start: 500, end: 500 });
    expect(parseFloat(appended[0].style.width)).toBeGreaterThanOrEqual(2);
  });
});
