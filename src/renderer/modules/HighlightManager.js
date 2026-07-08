// @ts-check
/**
 * HighlightManager - persistent, per-tab positional region highlights.
 *
 * This is a NEW layer, deliberately independent of the single-slot sequence
 * "selection" (used for copy/extract) and of the search-match highlighter. It
 * owns a collection of named regions drawn as full-height overlay boxes across
 * the coordinate ruler + track stack, and they survive pan / zoom / tab switch.
 *
 * The canonical array lives on `genomeBrowser.highlights`; TabManager snapshots
 * and restores it per tab (session-only, never written to the project file).
 *
 * Coordinates are 1-based inclusive [start, end] to match `select_sequence_region`
 * and gene selection. The single 1-based -> pixel conversion happens in
 * renderHighlights(): the viewport (`currentPosition`) is 0-based with an
 * exclusive end (see NavigationManager.navigateToPosition), so a 1-based
 * inclusive base S occupies 0-based [S-1, S) in that space.
 */
class HighlightManager {
  constructor(genomeBrowser) {
    this.gb = genomeBrowser;
    this.overlayClass = 'highlight-region-box';
    // Categorical palette, deliberately excluding the reserved blue (#3b82f6,
    // sequence selection / secondary-ruler) and red (#ef4444, variant /
    // feature-highlight) so concurrent highlights stay visually distinct.
    this.palette = ['#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4'];
    this._seq = 0;
    if (!Array.isArray(this.gb.highlights)) this.gb.highlights = [];
  }

  /** Canonical per-tab collection (also snapshotted by TabManager). */
  get highlights() {
    if (!Array.isArray(this.gb.highlights)) this.gb.highlights = [];
    return this.gb.highlights;
  }

  _nextColor() {
    return this.palette[this.highlights.length % this.palette.length];
  }

  _genId() {
    this._seq += 1;
    return `hl_${Date.now()}_${this._seq}`;
  }

  // --- Mutations -----------------------------------------------------------

  /**
   * Add a highlight region. Coordinates are 1-based inclusive; they are
   * normalized so start <= end and start >= 1. If only one coordinate is
   * supplied, it becomes a 1 bp highlight at that position.
   * @param {{id?:string, chromosome?:string, start?:number, end?:number, label?:string, color?:string, createdBy?:string}} region
   * @returns {object} the stored highlight
   */
  addHighlight(region = {}) {
    const hasStart = region.start !== undefined && region.start !== null && region.start !== '';
    const hasEnd = region.end !== undefined && region.end !== null && region.end !== '';
    if (!hasStart && !hasEnd) {
      throw new Error('Highlight requires at least one numeric position');
    }

    const rawStart = hasStart ? Number(region.start) : Number(region.end);
    const rawEnd = hasEnd ? Number(region.end) : Number(region.start);
    if (!Number.isFinite(rawStart) || !Number.isFinite(rawEnd)) {
      throw new Error('Highlight position must be a valid numeric value');
    }

    const start = Math.max(1, Math.round(Math.min(rawStart, rawEnd)));
    const end = Math.max(1, Math.round(Math.max(rawStart, rawEnd)));
    const chromosome = region.chromosome || this.gb.currentChromosome || null;

    const highlight = {
      id: region.id || this._genId(),
      chromosome,
      start,
      end,
      label: region.label ? String(region.label) : '',
      color: region.color || this._nextColor(),
      createdBy: region.createdBy === 'ai' ? 'ai' : region.createdBy || 'gui',
    };

    this.highlights.push(highlight);
    this._afterChange();
    return highlight;
  }

  /**
   * Remove a highlight by id, or by exact 1-based start/end match.
   * @param {{id?:string, start?:number, end?:number}} selector
   * @returns {object[]} the removed highlight(s)
   */
  removeHighlight(selector = {}) {
    const before = this.highlights.length;
    let removed = [];

    if (selector.id != null) {
      removed = this.highlights.filter(h => h.id === selector.id);
      this.gb.highlights = this.highlights.filter(h => h.id !== selector.id);
    } else if (selector.start != null && selector.end != null) {
      const s = Math.round(Math.min(Number(selector.start), Number(selector.end)));
      const e = Math.round(Math.max(Number(selector.start), Number(selector.end)));
      removed = this.highlights.filter(h => h.start === s && h.end === e);
      this.gb.highlights = this.highlights.filter(h => !(h.start === s && h.end === e));
    } else {
      throw new Error('removeHighlight requires an id or start+end');
    }

    if (this.highlights.length !== before) this._afterChange();
    return removed;
  }

  /** @returns {object[]} a shallow copy of all highlights */
  listHighlights() {
    return this.highlights.map(h => ({ ...h }));
  }

  /** Remove every highlight. @returns {number} count removed */
  clearHighlights() {
    const count = this.highlights.length;
    this.gb.highlights = [];
    if (count) this._afterChange();
    return count;
  }

  _afterChange() {
    this.renderHighlights();
    this.gb.highlightsUI?.refreshIfOpen?.();
  }

  // --- Rendering -----------------------------------------------------------

  /**
   * Repaint overlay boxes for the current viewport. Idempotent: clears then
   * draws. Hooked at the end of GenomeBrowser.displayGenomeView so highlights
   * survive every pan / zoom / navigate redraw.
   */
  renderHighlights() {
    // Idempotent redraw: remove previously-drawn boxes anywhere in the document.
    document.querySelectorAll(`.${this.overlayClass}`).forEach(el => el.remove());

    const container = document.querySelector('.genome-browser-container');
    if (!container) return;

    const highlights = this.highlights;
    if (!highlights.length) return;

    const chromosome = this.gb.currentChromosome;
    const pos = this.gb.currentPosition || { start: 0, end: 0 };
    const viewStart = Number(pos.start) || 0; // 0-based index of leftmost base
    const viewEnd = Number(pos.end) || 0; // 0-based, exclusive end
    const range = viewEnd - viewStart;
    if (range <= 0) return;

    // Horizontal reference: the coordinate ruler canvas defines the axis. Fall
    // back to the first track content, then the container itself. Measuring the
    // reference rect keeps highlights aligned regardless of borders / padding.
    const containerRect = container.getBoundingClientRect();
    const axisEl =
      container.querySelector('.detailed-ruler-canvas') || container.querySelector('.track-content') || container;
    const axisRect = axisEl.getBoundingClientRect();
    const axisLeft = axisRect.left - containerRect.left;
    const axisWidth = axisRect.width || containerRect.width;
    if (axisWidth <= 0) return;

    highlights.forEach(h => {
      // Skip highlights that belong to a different chromosome.
      if (h.chromosome && chromosome && h.chromosome !== chromosome) return;

      // 1-based inclusive [start, end] -> 0-based [start-1, end) in viewport space.
      const left0 = h.start - 1 - viewStart;
      const right0 = h.end - viewStart;
      if (right0 <= 0 || left0 >= range) return; // entirely outside the viewport

      let xLeft = (left0 / range) * axisWidth;
      let xRight = (right0 / range) * axisWidth;
      xLeft = Math.max(0, Math.min(xLeft, axisWidth));
      xRight = Math.max(0, Math.min(xRight, axisWidth));
      const width = Math.max(xRight - xLeft, 2); // keep sub-pixel regions visible

      const color = h.color || this.palette[0];
      const box = document.createElement('div');
      box.className = this.overlayClass;
      box.dataset.highlightId = h.id;
      box.style.left = `${axisLeft + xLeft}px`;
      box.style.width = `${width}px`;
      box.style.background = this._fillFor(color);
      box.style.borderLeftColor = color;
      box.style.borderRightColor = color;
      box.title = this._tooltip(h);

      const chip = document.createElement('span');
      chip.className = 'highlight-region-label';
      chip.textContent = h.label || this._coordinateLabel(h); // textContent auto-escapes
      chip.style.background = color;
      box.appendChild(chip);

      container.appendChild(box);
    });
  }

  /** Alias for external callers that want an explicit repaint. */
  refresh() {
    this.renderHighlights();
  }

  // --- Helpers -------------------------------------------------------------

  /** Convert #rrggbb to an rgba fill at ~18% alpha. */
  _fillFor(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex));
    if (!m) return 'rgba(245, 158, 11, 0.18)';
    const r = parseInt(m[1], 16);
    const g = parseInt(m[2], 16);
    const b = parseInt(m[3], 16);
    return `rgba(${r}, ${g}, ${b}, 0.18)`;
  }

  _tooltip(h) {
    const chr = h.chromosome ? `${h.chromosome}:` : '';
    const label = `${h.label || this._coordinateLabel(h)} — `;
    const len = h.end - h.start + 1;
    return `${label}${chr}${h.start.toLocaleString()}-${h.end.toLocaleString()} (${len.toLocaleString()} bp)`;
  }

  _coordinateLabel(h) {
    const start = String(h.start);
    const end = String(h.end);
    return h.start === h.end ? start : `${start}-${end}`;
  }
}

// Export (dual: CommonJS for tests, global for the browser script tag)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HighlightManager;
} else if (typeof window !== 'undefined') {
  window.HighlightManager = HighlightManager;
}
