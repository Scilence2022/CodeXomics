/**
 * Drag visual-transform compounding regression.
 *
 * During a pan-drag the live preview applies `translateX(shiftPercent%)` to the
 * track containers, layered on a cached "base" transform. The base must be
 * cached exactly ONCE (at drag start) and never mutated by later frames.
 *
 * The bug: the cache guard used truthiness (`if (!el.dataset.baseTransform)`).
 * Freshly-rendered containers have an empty-string transform, so the cached ''
 * read as "not cached", and the SECOND move re-cached the FIRST move's
 * translateX as the base. Every later frame then stacked the live shift on top
 * of move-1's shift, so the view overshot in the drag direction during the drag
 * and snapped back on release (drag left -> sits left, then jumps right).
 *
 * The fix guards on `=== undefined`, so '' is a valid cached base.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import NavigationManager from '../../src/renderer/modules/NavigationManager.js';

function countTranslate(transform) {
  return (transform.match(/translateX\(/g) || []).length;
}

function makeNM() {
  const nm = Object.create(NavigationManager.prototype);
  nm.dragState = { elementWidth: 1000 };
  nm.globalDraggingEnabled = true;
  return nm;
}

describe('NavigationManager drag transform caching', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('cacheTrackTransform', () => {
    it('caches an empty base once and does NOT re-cache after a transform is applied', () => {
      const nm = makeNM();
      const el = document.createElement('div');
      document.body.appendChild(el);

      nm.cacheTrackTransform(el); // drag start: base is ''
      expect(el.dataset.baseTransform).toBe('');

      // A move applies a transform; the next cache call must be a no-op.
      el.style.transform = 'translateX(-4.15%)';
      nm.cacheTrackTransform(el);
      expect(el.dataset.baseTransform).toBe(''); // NOT 'translateX(-4.15%)'
    });

    it('preserves a genuine pre-existing base transform', () => {
      const nm = makeNM();
      const el = document.createElement('div');
      el.style.transform = 'rotate(0deg)';
      document.body.appendChild(el);
      nm.cacheTrackTransform(el);
      el.style.transform = 'rotate(0deg) translateX(-5%)';
      nm.cacheTrackTransform(el);
      expect(el.dataset.baseTransform).toBe('rotate(0deg)');
    });
  });

  describe('performGlobalDragUpdate (global dragging)', () => {
    let nm;
    let uc;
    beforeEach(() => {
      nm = makeNM();
      uc = document.createElement('div');
      uc.className = 'unified-gene-container';
      document.body.appendChild(uc);
    });

    it('does not compound translateX across successive drag frames', () => {
      // Simulate three move frames (as in a real drag).
      nm.performGlobalDragUpdate(-4.15, 'chr');
      nm.performGlobalDragUpdate(-8.3, 'chr');
      nm.performGlobalDragUpdate(-12.15, 'chr');

      // Exactly one translateX, reflecting only the latest frame.
      expect(countTranslate(uc.style.transform)).toBe(1);
      expect(uc.style.transform).toBe('translateX(-12.15%)');
    });

    it('final preview shift equals the committed shift (no snap-back)', () => {
      // The committed position corresponds to the last frame's shift; the visual
      // transform must match it exactly so release produces no jump.
      const finalShift = -12.15;
      nm.performGlobalDragUpdate(-4.15, 'chr');
      nm.performGlobalDragUpdate(finalShift, 'chr');
      expect(uc.style.transform).toBe(`translateX(${finalShift}%)`);
    });
  });

  describe('performVisualDragUpdate (reads track, default mode)', () => {
    it('does not compound translateX on the reads track across frames', () => {
      const nm = makeNM();
      const readsTrack = document.createElement('div');
      readsTrack.className = 'reads-track';
      const content = document.createElement('div');
      content.className = 'track-content';
      readsTrack.appendChild(content);
      document.body.appendChild(readsTrack);

      nm.performVisualDragUpdate(-4.15, readsTrack);
      nm.performVisualDragUpdate(-8.3, readsTrack);
      nm.performVisualDragUpdate(-12.15, readsTrack);

      expect(countTranslate(content.style.transform)).toBe(1);
      expect(content.style.transform).toBe('translateX(-12.15%)');
    });
  });

  describe('drag viewport overlays', () => {
    it('repositions highlights in the same update as the detailed rulers', () => {
      const nm = makeNM();
      const setupCanvas = vi.fn();
      const renderHighlights = vi.fn();
      const ruler = document.createElement('div');
      ruler.className = 'detailed-ruler-container';
      ruler._setupCanvas = setupCanvas;
      document.body.appendChild(ruler);

      nm.genomeBrowser = { highlightManager: { renderHighlights } };
      nm.dragState.isDragging = true;
      nm.rulerUpdateThrottle = {
        lastUpdateTime: 0,
        updateInterval: 16,
        pendingUpdate: false,
      };

      nm.updateDetailedRulers(true);

      expect(setupCanvas).toHaveBeenCalledOnce();
      expect(renderHighlights).toHaveBeenCalledOnce();
    });
  });
});
