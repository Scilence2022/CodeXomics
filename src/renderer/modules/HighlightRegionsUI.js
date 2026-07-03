// @ts-check
/**
 * HighlightRegionsUI - management panel for positional region highlights.
 *
 * Lists the current tab's highlights (see HighlightManager), and provides GUI
 * controls to add a region (by coordinates or from the current view), remove a
 * single region, and clear all. Mirrors the PrimerLibraryUI modal pattern
 * (lazy `.modal` construction, `.modal.show` visibility, delegated click
 * handling, `_esc()` for interpolated strings).
 */
class HighlightRegionsUI {
  constructor(genomeBrowser) {
    this.gb = genomeBrowser;
    this.modalId = 'highlightRegionsModal';
  }

  get manager() {
    return this.gb?.highlightManager || null;
  }

  get currentChromosome() {
    return document.getElementById('chromosomeSelect')?.value || this.gb?.currentChromosome || null;
  }

  // --- Open / close --------------------------------------------------------

  open() {
    if (!this.manager) {
      alert('Highlight manager is not available');
      return;
    }
    this.ensureModal();
    this.refresh();
    if (this._getSelectedRange()) {
      this._fillFromCurrentView();
    }
    document.getElementById(this.modalId)?.classList.add('show');
    if (window.modalDragManager && typeof window.modalDragManager.makeDraggable === 'function') {
      window.modalDragManager.makeDraggable(`#${this.modalId}`);
    }
  }

  close() {
    document.getElementById(this.modalId)?.classList.remove('show');
  }

  isOpen() {
    return Boolean(document.getElementById(this.modalId)?.classList.contains('show'));
  }

  refreshIfOpen() {
    if (this.isOpen()) this.refresh();
  }

  // --- Modal construction --------------------------------------------------

  ensureModal() {
    if (document.getElementById(this.modalId)) return;

    const modal = document.createElement('div');
    modal.id = this.modalId;
    modal.className = 'modal highlight-regions-modal';
    modal.innerHTML = `
      <div class="modal-content large">
        <div class="modal-header">
          <h3><i class="fas fa-highlighter"></i> Highlighted regions</h3>
          <div class="modal-controls">
            <button class="modal-close" data-action="close" title="Close">&times;</button>
          </div>
        </div>
        <div class="modal-body">
          <div class="highlight-regions-add">
            <label class="hl-field"><span>Start</span><input type="number" min="1" step="1" data-role="hl-start" placeholder="start"></label>
            <label class="hl-field"><span>End</span><input type="number" min="1" step="1" data-role="hl-end" placeholder="end"></label>
            <label class="hl-field hl-field-label"><span>Label (optional)</span><input type="text" data-role="hl-label" placeholder="e.g. promoter"></label>
            <label class="hl-field hl-field-color"><span>Color</span><input type="color" data-role="hl-color" value="#f59e0b"></label>
            <button class="btn btn-primary btn-sm" data-action="add"><i class="fas fa-plus"></i> Add</button>
            <button class="btn btn-secondary btn-sm" data-action="fill-current" title="Fill start/end from the current view or selection"><i class="fas fa-crop-alt"></i> Use current view</button>
          </div>
          <div class="highlight-regions-toolbar">
            <button class="btn btn-danger btn-sm" data-action="clear-all"><i class="fas fa-trash"></i> Clear all</button>
          </div>
          <div class="highlight-regions-table-wrap">
            <table class="highlight-regions-table">
              <thead>
                <tr>
                  <th></th><th>Chromosome</th><th>Start</th><th>End</th><th>Length</th><th>Label</th><th></th>
                </tr>
              </thead>
              <tbody data-role="highlight-rows"></tbody>
            </table>
          </div>
        </div>
      </div>`;

    document.body.appendChild(modal);

    // Event delegation for all controls.
    modal.addEventListener('click', e => this._onClick(e));
    // Enter in a numeric field triggers Add.
    modal.querySelectorAll('[data-role="hl-start"], [data-role="hl-end"]').forEach(input => {
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') this._addFromForm();
      });
    });
    // Click on the backdrop closes the modal.
    modal.addEventListener('mousedown', e => {
      if (e.target === modal) this.close();
    });

    this._syncColorField();
  }

  // --- Rendering -----------------------------------------------------------

  refresh() {
    const modal = document.getElementById(this.modalId);
    if (!modal) return;
    this._renderRows(modal.querySelector('[data-role="highlight-rows"]'));
  }

  _renderRows(tbody) {
    if (!tbody) return;
    const highlights = this.manager.listHighlights();
    if (highlights.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="highlight-regions-empty">No highlights yet. Add a region above, or ask the AI to "highlight" a region.</td></tr>`;
      return;
    }
    tbody.innerHTML = highlights.map(h => this._rowHtml(h)).join('');
  }

  _rowHtml(h) {
    const len = h.end - h.start + 1;
    const color = h.color || '#f59e0b';
    return `
      <tr data-highlight-id="${this._esc(h.id)}">
        <td><span class="highlight-regions-swatch" style="background:${this._esc(color)}"></span></td>
        <td>${this._esc(h.chromosome || '—')}</td>
        <td>${Number(h.start).toLocaleString()}</td>
        <td>${Number(h.end).toLocaleString()}</td>
        <td>${len.toLocaleString()} bp</td>
        <td>${h.label ? this._esc(h.label) : '—'}</td>
        <td class="highlight-regions-actions">
          <button class="btn btn-xs" data-action="locate" title="Go to this region"><i class="fas fa-crosshairs"></i></button>
          <button class="btn btn-xs btn-danger" data-action="remove" title="Remove highlight"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`;
  }

  // --- Event handling ------------------------------------------------------

  _onClick(e) {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.getAttribute('data-action');
    const row = e.target.closest('[data-highlight-id]');
    const id = row?.getAttribute('data-highlight-id');

    try {
      switch (action) {
        case 'close':
          this.close();
          break;
        case 'add':
          this._addFromForm();
          break;
        case 'fill-current':
          this._fillFromCurrentView();
          break;
        case 'clear-all':
          this._clearAll();
          break;
        case 'remove':
          if (id) {
            this.manager.removeHighlight({ id });
            this.refresh();
          }
          break;
        case 'locate':
          if (id) this._locate(id);
          break;
        default:
          break;
      }
    } catch (err) {
      this._notify(err?.message || 'Highlight action failed', 'error');
    }
  }

  _addFromForm() {
    const modal = document.getElementById(this.modalId);
    if (!modal) return;
    const startEl = modal.querySelector('[data-role="hl-start"]');
    const endEl = modal.querySelector('[data-role="hl-end"]');
    const labelEl = modal.querySelector('[data-role="hl-label"]');
    const colorEl = modal.querySelector('[data-role="hl-color"]');

    const start = parseInt(startEl?.value, 10);
    const end = parseInt(endEl?.value, 10);
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      this._notify('Enter numeric start and end positions', 'warn');
      return;
    }

    this.manager.addHighlight({
      chromosome: this.currentChromosome,
      start,
      end,
      label: labelEl?.value?.trim() || '',
      color: colorEl?.value || undefined,
      createdBy: 'gui',
    });

    // Reset the form for the next entry and advance the default color.
    if (startEl) startEl.value = '';
    if (endEl) endEl.value = '';
    if (labelEl) labelEl.value = '';
    this._syncColorField();
    this.refresh();
  }

  _fillFromCurrentView() {
    const modal = document.getElementById(this.modalId);
    if (!modal) return;

    // Prefer an active sequence selection (1-based inclusive), else the viewport.
    const selection = this._getSelectedRange();
    let start = selection?.start;
    let end = selection?.end;
    if (!selection) {
      const pos = this.gb?.currentPosition || { start: 0, end: 0 };
      const sequenceLength = this.gb?.currentSequence?.[this.currentChromosome]?.length || 0;
      if (sequenceLength > 0 && (Number(pos.start) >= sequenceLength || Number(pos.end) > sequenceLength)) {
        this._notify('A cross-origin circular view cannot prefill one linear highlight interval', 'warn');
        return;
      }
      start = (Number(pos.start) || 0) + 1; // 0-based -> 1-based inclusive
      end = Number(pos.end) || start;
    }

    const startEl = modal.querySelector('[data-role="hl-start"]');
    const endEl = modal.querySelector('[data-role="hl-end"]');
    if (startEl) startEl.value = String(start);
    if (endEl) endEl.value = String(end);
  }

  _getSelectedRange() {
    // Manual sequence-track selections are stored separately from gene/ruler
    // selections. Prefer the manual selection because it is the latest
    // explicit range chosen by the user.
    const manual = this.gb?.currentSequenceSelection;
    const active = this.gb?.sequenceSelection;
    const candidates = [manual, active?.active ? active : null];
    for (const selection of candidates) {
      if (!selection) continue;
      if (selection.wrapsOrigin || selection.segments?.length > 1) continue;
      const rawStart = Number.parseInt(selection.start, 10);
      const rawEnd = Number.parseInt(selection.end, 10);
      if (!Number.isFinite(rawStart) || !Number.isFinite(rawEnd)) continue;
      const offset = selection.coordinateSystem === 'zero-based-inclusive' ? 1 : 0;
      return {
        start: Math.min(rawStart, rawEnd) + offset,
        end: Math.max(rawStart, rawEnd) + offset,
      };
    }
    return null;
  }

  _clearAll() {
    const count = this.manager.listHighlights().length;
    if (count === 0) return;
    if (typeof window.confirm === 'function' && !window.confirm(`Remove all ${count} highlight(s)?`)) {
      return;
    }
    this.manager.clearHighlights();
    this.refresh();
  }

  _locate(id) {
    const h = this.manager.listHighlights().find(x => x.id === id);
    if (!h) return;
    const nav = this.gb?.navigationManager;
    const chromosome = h.chromosome || this.currentChromosome;
    if (nav && typeof nav.navigateToPosition === 'function') {
      nav.navigateToPosition(chromosome, h.start, h.end);
    }
  }

  /** Set the color field to the manager's next palette color so adds cycle. */
  _syncColorField() {
    const modal = document.getElementById(this.modalId);
    const colorEl = modal?.querySelector('[data-role="hl-color"]');
    if (!colorEl || !this.manager) return;
    const palette = this.manager.palette || [];
    if (palette.length) {
      colorEl.value = palette[this.manager.listHighlights().length % palette.length];
    }
  }

  _notify(message, type = 'warn') {
    if (typeof window._notificationService?.toast === 'function') {
      window._notificationService.toast(message, type);
    } else if (typeof this.gb?.showNotification === 'function') {
      this.gb.showNotification(message, type);
    } else if (type === 'error') {
      alert(message);
    }
  }

  _esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => {
      switch (ch) {
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '"':
          return '&quot;';
        default:
          return '&#39;';
      }
    });
  }
}

if (typeof window !== 'undefined') {
  window.HighlightRegionsUI = HighlightRegionsUI;
}
