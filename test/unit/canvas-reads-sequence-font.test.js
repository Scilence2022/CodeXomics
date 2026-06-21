/**
 * CanvasReadsRenderer — read-sequence font sizing
 *
 * Regression guard for the bug where, after zooming in far enough to show read
 * sequences, the read bases rendered far smaller than the reference bases.
 *
 * Root cause: the read font was capped by the (tiny, default 4px) read row
 * height while the reference font scaled with the horizontal zoom. The fix sizes
 * read bases with the SAME horizontal rule as the reference and grows the read
 * row so they fit. These tests exercise the real pure sizing helpers (no canvas
 * / DOM needed) on a lightweight instance whose prototype is the real class, so
 * the helpers' internal calls to one another resolve normally.
 */
import { describe, it, expect } from 'vitest';
import CanvasReadsRenderer from '../../src/renderer/modules/CanvasReadsRenderer.js';

// Build a minimal instance (prototype-linked, but without running the
// DOM/canvas constructor) that exposes the real sizing helpers.
function makeRenderer({ canvasWidth = 900, start = 0, end = 60, options = {} } = {}) {
  const self = Object.create(CanvasReadsRenderer.prototype);
  self.canvasWidth = canvasWidth;
  self.viewport = { start, end };
  self.options = {
    readHeight: 4,
    showSequences: true,
    autoFontSize: true,
    minFontSize: 8,
    maxFontSize: 14,
    referenceFontSize: 12,
    sequenceFontSize: 6,
    ...options,
  };
  return self;
}

describe('CanvasReadsRenderer sequence font sizing', () => {
  it('computes pixels-per-bp from canvas width and viewport range', () => {
    const r = makeRenderer({ canvasWidth: 900, start: 0, end: 60 }); // 900 / 60 = 15
    expect(r.getPixelsPerBp()).toBe(15);
  });

  it('renders read bases at the SAME size as reference bases when zoomed in', () => {
    // ~15 px/bp — the zoom in the reported screenshot (reference clearly legible).
    const r = makeRenderer({ canvasWidth: 900, start: 0, end: 60 });
    const px = r.getPixelsPerBp();

    const readFont = r.getReadSequenceFontSize(px);
    const refFont = r.getSequenceLetterFontSize(px); // exactly what the reference band uses

    expect(readFont).toBe(refFont); // parity is the whole point of the fix
    expect(readFont).toBe(12); // capped at referenceFontSize
  });

  it('no longer caps the read font by the tiny read row height', () => {
    // The old behaviour produced floor(readHeight*0.7)=2 -> clamped to 8 here.
    // With a 4px row and 15 px/bp the read font must now be the full 12px.
    const r = makeRenderer({ canvasWidth: 900, start: 0, end: 60, options: { readHeight: 4 } });
    const readFont = r.getReadSequenceFontSize(r.getPixelsPerBp());
    expect(readFont).toBe(12);
    expect(readFont).toBeGreaterThan(8); // strictly bigger than the old clamp floor
  });

  it('keeps read font from ever being smaller than the reference font', () => {
    // Sweep a range of zoom levels; reads should match-or-exceed the reference,
    // never fall below it.
    for (let end = 20; end <= 200; end += 10) {
      const r = makeRenderer({ canvasWidth: 900, start: 0, end });
      const px = r.getPixelsPerBp();
      expect(r.getReadSequenceFontSize(px)).toBeGreaterThanOrEqual(r.getSequenceLetterFontSize(px));
    }
  });

  it('grows the effective read height so reference-sized letters fit', () => {
    const r = makeRenderer({ canvasWidth: 900, start: 0, end: 60, options: { readHeight: 4 } });
    // 12px font + 4px padding, well above the 4px bar height.
    expect(r.getEffectiveReadHeight()).toBe(16);
  });

  it('does not grow the row when zoomed out (reads stay thin bars)', () => {
    // 900 / 9000 = 0.1 px/bp — far below the letter threshold.
    const r = makeRenderer({ canvasWidth: 900, start: 0, end: 9000, options: { readHeight: 4 } });
    expect(r.getEffectiveReadHeight()).toBe(4);
  });

  it('does not grow the row when sequence display is disabled', () => {
    const r = makeRenderer({ canvasWidth: 900, start: 0, end: 60, options: { showSequences: false, readHeight: 4 } });
    expect(r.getEffectiveReadHeight()).toBe(4);
  });

  it('honours an explicit (manual) sequence font size when auto is off', () => {
    const r = makeRenderer({
      canvasWidth: 900,
      start: 0,
      end: 60,
      options: { autoFontSize: false, sequenceFontSize: 10 },
    });
    expect(r.getReadSequenceFontSize(r.getPixelsPerBp())).toBe(10);
  });

  it('caps the read font at the reference cap at extreme zoom', () => {
    const r = makeRenderer({ canvasWidth: 9000, start: 0, end: 60 }); // 150 px/bp
    expect(r.getReadSequenceFontSize(r.getPixelsPerBp())).toBe(12);
  });
});
