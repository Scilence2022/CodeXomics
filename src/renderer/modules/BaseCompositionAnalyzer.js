/**
 * BaseCompositionAnalyzer - compute and display the base composition (pileup)
 * of aligned reads at a single reference coordinate.
 *
 * Given a chromosome + 1-based position, it extracts the aligned base each
 * covering read contributes (CIGAR-aware, so insertions / deletions /
 * soft-clips are handled correctly), tallies A/C/G/T/N counts + percentages +
 * per-strand breakdown, and reports deletions and adjacent insertions.
 *
 * The tally / extraction helpers are pure static methods (no DOM, no
 * genomeBrowser) so they can be unit-tested directly. The instance methods own
 * data fetching and the popup UI.
 *
 * Coordinate conventions (see plan / TrackRenderer):
 *   - read.start is 1-based (both BamReader and the SAM ReadsManager path).
 *   - currentSequenceSelection.start is 1-based inclusive.
 *   - currentPosition / viewport is 0-based.
 *   - reference base at 1-based P: currentSequence[chr][P - 1].
 */
class BaseCompositionAnalyzer {
  constructor(genomeBrowser) {
    this.genomeBrowser = genomeBrowser;
    this.modalId = 'baseCompositionModal';
    this._busy = false;
    this._lastResult = null;
    this._activeFileId = null;
    this._activeChromosome = null;

    // Base colors mirror CanvasReadsRenderer for visual consistency.
    this.baseColors = { A: '#e74c3c', T: '#3498db', G: '#2ecc71', C: '#f39c12', N: '#95a5a6' };
  }

  // ---------------------------------------------------------------------------
  // Pure helpers (unit-testable)
  // ---------------------------------------------------------------------------

  /**
   * Parse a CIGAR string into [{ len, op }]. Empty / '*' yields [].
   */
  static parseCigar(cigar) {
    const ops = [];
    if (!cigar || cigar === '*') return ops;
    const re = /(\d+)([MIDNSHP=X])/g;
    let m;
    while ((m = re.exec(cigar)) !== null) {
      ops.push({ len: parseInt(m[1], 10), op: m[2] });
    }
    return ops;
  }

  /**
   * What a read contributes at 1-based reference position refPos.
   * @returns {{kind:'base'|'del'|'skip'|'none', base?:string, followingInsertion?:string}}
   *   base  - an aligned base is present (M/=/X)
   *   del   - a deletion (D) spans the column
   *   skip  - a reference skip / intron (N) spans the column
   *   none  - the read does not reach the column
   */
  static baseAtReference(read, refPos) {
    if (!read || typeof read.start !== 'number') return { kind: 'none' };
    const seqStr = read.sequence || '';
    const ops = BaseCompositionAnalyzer.parseCigar(read.cigar);

    // Fallback: no usable CIGAR -> assume an ungapped alignment from read.start.
    if (ops.length === 0) {
      const idx = refPos - read.start;
      if (idx >= 0 && idx < seqStr.length) return { kind: 'base', base: seqStr[idx] };
      return { kind: 'none' };
    }

    let ref = read.start; // 1-based reference position of the next ref-consuming op
    let seq = 0; // 0-based index into read.sequence
    let result = null;
    let followingInsertion = null;

    for (let k = 0; k < ops.length; k++) {
      const { len, op } = ops[k];
      switch (op) {
        case 'M':
        case '=':
        case 'X':
          if (!result && refPos >= ref && refPos < ref + len) {
            result = { kind: 'base', base: seqStr[seq + (refPos - ref)] };
          }
          ref += len;
          seq += len;
          break;
        case 'D':
          if (!result && refPos >= ref && refPos < ref + len) result = { kind: 'del' };
          ref += len;
          break;
        case 'N':
          if (!result && refPos >= ref && refPos < ref + len) result = { kind: 'skip' };
          ref += len;
          break;
        case 'I':
          // An insertion sits between (ref-1) and ref. When it immediately
          // follows our column (boundary === refPos + 1), record its bases.
          if (ref === refPos + 1) followingInsertion = seqStr.substr(seq, len);
          seq += len;
          break;
        case 'S':
          seq += len;
          break;
        case 'H':
        case 'P':
        default:
          break;
      }
      // Once we've captured the column and advanced past any adjacent insertion,
      // there is nothing more to find (keeps long-read CIGARs cheap).
      if (result && ref > refPos + 1) break;
    }

    if (!result) return { kind: 'none' };
    if (followingInsertion) result.followingInsertion = followingInsertion;
    return result;
  }

  /**
   * Tally the base composition of `reads` at 1-based `refPos`.
   * Percentages for bases are over the aligned total (A+C+G+T+N); the deletion
   * percentage is over depth (aligned + deletions). Reference skips (N) are
   * reported separately and excluded from depth.
   */
  static tally(reads, refPos) {
    const counts = { A: 0, C: 0, G: 0, T: 0, N: 0 };
    const strand = {
      A: { '+': 0, '-': 0 },
      C: { '+': 0, '-': 0 },
      G: { '+': 0, '-': 0 },
      T: { '+': 0, '-': 0 },
      N: { '+': 0, '-': 0 },
    };
    let deletions = 0;
    let skips = 0;
    let insCount = 0;
    const insSeqs = {};

    for (const read of reads || []) {
      const r = BaseCompositionAnalyzer.baseAtReference(read, refPos);
      const st = read && read.strand === '-' ? '-' : '+';

      if (r.kind === 'base') {
        let b = (r.base || 'N').toUpperCase();
        if (b !== 'A' && b !== 'C' && b !== 'G' && b !== 'T') b = 'N';
        counts[b]++;
        strand[b][st]++;
      } else if (r.kind === 'del') {
        deletions++;
      } else if (r.kind === 'skip') {
        skips++;
      } else {
        continue; // read does not cover the column
      }

      if (r.followingInsertion) {
        insCount++;
        const s = r.followingInsertion.toUpperCase();
        insSeqs[s] = (insSeqs[s] || 0) + 1;
      }
    }

    const aligned = counts.A + counts.C + counts.G + counts.T + counts.N;
    const depth = aligned + deletions;
    const round1 = n => Math.round(n * 10) / 10;
    const pctBase = n => (aligned > 0 ? round1((n / aligned) * 100) : 0);
    const percentages = {
      A: pctBase(counts.A),
      C: pctBase(counts.C),
      G: pctBase(counts.G),
      T: pctBase(counts.T),
      N: pctBase(counts.N),
      del: depth > 0 ? round1((deletions / depth) * 100) : 0,
    };

    return {
      position: refPos,
      depth,
      aligned,
      counts,
      strand,
      deletions,
      skips,
      insertions: { count: insCount, sequences: insSeqs },
      percentages,
    };
  }

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  _getReadsFile(fileId) {
    const mfm = this.genomeBrowser && this.genomeBrowser.multiFileManager;
    if (fileId && mfm && typeof mfm.getFile === 'function') {
      const f = mfm.getFile(fileId);
      if (f && f.reader) return f;
    }
    return null;
  }

  /**
   * Track settings for the reads track, with sampling forced off so the
   * composition reflects every covering read (not the display sample).
   */
  _readsSettings(fileId) {
    let settings = {};
    try {
      const tr = this.genomeBrowser && this.genomeBrowser.trackRenderer;
      if (tr && typeof tr.getTrackSettings === 'function') {
        settings = JSON.parse(JSON.stringify(tr.getTrackSettings('reads', fileId) || {}));
      }
    } catch (e) {
      settings = {};
    }
    settings.enableSampling = false;
    return settings;
  }

  async _fetchCoveringReads(chromosome, position, fileId) {
    const settings = this._readsSettings(fileId);
    const bamFile = this._getReadsFile(fileId);
    let reads = [];

    if (bamFile && bamFile.reader && typeof bamFile.reader.getRecordsForRange === 'function') {
      // BamReader.getRecordsForRange is 0-based half-open; a single-base window
      // returns every read overlapping the column (long reads included).
      reads = await bamFile.reader.getRecordsForRange(chromosome, position - 1, position, settings);
    } else if (this.genomeBrowser && this.genomeBrowser.readsManager) {
      // ReadsManager.getReadsForRegion is 1-based inclusive.
      reads = await this.genomeBrowser.readsManager.getReadsForRegion(chromosome, position, position, settings);
    }

    return Array.isArray(reads) ? reads : [];
  }

  _referenceBase(chromosome, position) {
    try {
      let seq = this.genomeBrowser && this.genomeBrowser.currentSequence;
      if (seq && typeof seq === 'object') seq = seq[chromosome];
      if (typeof seq === 'string' && position >= 1 && position <= seq.length) {
        return seq[position - 1].toUpperCase();
      }
    } catch (e) {
      /* ignore */
    }
    return null;
  }

  /**
   * Public, reusable entry point: compute the base composition at a locus.
   * @returns the tally result augmented with { chromosome, referenceBase, fileId }.
   */
  async computeBaseComposition(chromosome, position, { fileId = null } = {}) {
    const reads = await this._fetchCoveringReads(chromosome, position, fileId);
    const result = BaseCompositionAnalyzer.tally(reads, position);
    result.chromosome = chromosome;
    result.referenceBase = this._referenceBase(chromosome, position);
    result.fileId = fileId;
    return result;
  }

  // ---------------------------------------------------------------------------
  // Target resolution
  // ---------------------------------------------------------------------------

  _defaultPosition() {
    const gb = this.genomeBrowser || {};
    const sel = gb.currentSequenceSelection;
    if (sel && Number.isFinite(Number(sel.start))) {
      return Math.round(Number(sel.start)); // already 1-based
    }
    const pos = gb.currentPosition;
    if (pos && Number.isFinite(Number(pos.start)) && Number.isFinite(Number(pos.end))) {
      // currentPosition is 0-based; take the centre and convert to 1-based.
      return Math.floor((Number(pos.start) + Number(pos.end)) / 2) + 1;
    }
    return 1;
  }

  _defaultChromosome(preferred) {
    if (preferred) return preferred;
    const gb = this.genomeBrowser || {};
    if (gb.currentChromosome) return gb.currentChromosome;
    const select = typeof document !== 'undefined' && document.getElementById('chromosomeSelect');
    return (select && select.value) || '';
  }

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------

  /**
   * Open the popup for the given reads track. `fileId` is null for the legacy
   * single-file track (served by ReadsManager).
   */
  open({ fileId = null, chromosome = null } = {}) {
    const modal = this._ensureModal();
    this._activeFileId = fileId;
    this._activeChromosome = this._defaultChromosome(chromosome);

    this._populateFileSelect(fileId);

    const chrEl = modal.querySelector('#bcaChromosome');
    if (chrEl) chrEl.textContent = this._activeChromosome || '(none)';

    const posInput = modal.querySelector('#bcaPosition');
    if (posInput) posInput.value = String(this._defaultPosition());

    modal.classList.add('show');
    this.refresh();
  }

  _ensureModal() {
    let modal = document.getElementById(this.modalId);
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = this.modalId;
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content resizable" style="max-width: 640px; width: 90vw; max-height: 85vh;">
        <div class="modal-header">
          <h3><i class="fas fa-chart-column"></i> Base Composition at Position</h3>
          <div class="modal-controls">
            <button class="modal-close" title="Close">&times;</button>
          </div>
        </div>
        <div class="modal-body" style="max-height: calc(85vh - 150px); overflow-y: auto;">
          <div style="display:flex; flex-wrap:wrap; gap:12px; align-items:flex-end; margin-bottom:16px;">
            <label style="display:flex; flex-direction:column; font-size:12px; color:var(--text-secondary,#666); gap:3px;">
              File
              <select id="bcaFile" class="form-input" style="min-width:150px; height:30px;"></select>
            </label>
            <label style="display:flex; flex-direction:column; font-size:12px; color:var(--text-secondary,#666); gap:3px;">
              Chromosome
              <span id="bcaChromosome" style="font-weight:600; color:var(--text-primary,#222); height:30px; line-height:30px;"></span>
            </label>
            <label style="display:flex; flex-direction:column; font-size:12px; color:var(--text-secondary,#666); gap:3px;">
              Position (1-based)
              <input id="bcaPosition" type="number" min="1" class="form-input" style="width:130px; height:30px;">
            </label>
            <button id="bcaAnalyze" class="btn btn-primary" style="height:30px;">Analyze</button>
          </div>
          <div id="bcaResults"></div>
        </div>
        <div class="modal-footer" style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
          <span id="bcaFooterNote" style="font-size:11px; color:var(--text-secondary,#888);"></span>
          <div style="display:flex; gap:8px;">
            <button id="bcaCopy" class="btn btn-secondary">Copy TSV</button>
            <button class="btn btn-secondary modal-close">Close</button>
          </div>
        </div>
        <div class="resize-handle resize-handle-n"></div>
        <div class="resize-handle resize-handle-s"></div>
        <div class="resize-handle resize-handle-e"></div>
        <div class="resize-handle resize-handle-w"></div>
        <div class="resize-handle resize-handle-ne"></div>
        <div class="resize-handle resize-handle-nw"></div>
        <div class="resize-handle resize-handle-se"></div>
        <div class="resize-handle resize-handle-sw"></div>
      </div>`;

    document.body.appendChild(modal);

    modal.addEventListener('click', e => {
      if (e.target.classList.contains('modal-close')) modal.classList.remove('show');
    });
    modal.querySelector('#bcaAnalyze').addEventListener('click', () => this.refresh());
    modal.querySelector('#bcaPosition').addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.refresh();
      }
    });
    modal.querySelector('#bcaFile').addEventListener('change', e => {
      this._activeFileId = e.target.value || null;
      this.refresh();
    });
    modal.querySelector('#bcaCopy').addEventListener('click', () => this._copyTsv());

    if (window.modalDragManager) window.modalDragManager.makeDraggable('#' + this.modalId);
    if (window.resizableModalManager) window.resizableModalManager.makeResizable('#' + this.modalId);

    return modal;
  }

  _populateFileSelect(selectedId) {
    const sel = document.getElementById('bcaFile');
    if (!sel) return;
    sel.innerHTML = '';

    const mfm = this.genomeBrowser && this.genomeBrowser.multiFileManager;
    const bamFiles = mfm && typeof mfm.getBamFiles === 'function' ? mfm.getBamFiles() : [];

    if (bamFiles.length > 0) {
      bamFiles.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.metadata.id;
        opt.textContent = f.metadata.name || f.metadata.filename || f.metadata.id;
        if (selectedId && f.metadata.id === selectedId) opt.selected = true;
        sel.appendChild(opt);
      });
      if (!selectedId || !bamFiles.some(f => f.metadata.id === selectedId)) {
        sel.value = bamFiles[0].metadata.id;
        this._activeFileId = bamFiles[0].metadata.id;
      }
      if (sel.parentElement) sel.parentElement.style.display = bamFiles.length > 1 ? '' : 'none';
    } else {
      // Legacy ReadsManager mode (no multi-file BAM entries).
      const opt = document.createElement('option');
      opt.value = '';
      const cf = this.genomeBrowser && this.genomeBrowser.readsManager && this.genomeBrowser.readsManager.currentFile;
      opt.textContent = cf ? String(cf).split(/[\\/]/).pop() : 'Loaded reads';
      opt.selected = true;
      sel.appendChild(opt);
      this._activeFileId = null;
      if (sel.parentElement) sel.parentElement.style.display = 'none';
    }
  }

  async refresh() {
    const modal = document.getElementById(this.modalId);
    if (!modal) return;

    const resultsEl = modal.querySelector('#bcaResults');
    const noteEl = modal.querySelector('#bcaFooterNote');
    const posInput = modal.querySelector('#bcaPosition');
    const analyzeBtn = modal.querySelector('#bcaAnalyze');

    const position = parseInt(posInput.value, 10);
    const chromosome = this._activeChromosome;

    if (!Number.isFinite(position) || position < 1) {
      resultsEl.innerHTML = '<div style="color:#c0392b; padding:12px;">Enter a valid 1-based position.</div>';
      if (noteEl) noteEl.textContent = '';
      return;
    }
    if (!chromosome) {
      resultsEl.innerHTML = '<div style="color:#c0392b; padding:12px;">No chromosome is currently loaded.</div>';
      if (noteEl) noteEl.textContent = '';
      return;
    }
    if (this._busy) return;

    this._busy = true;
    if (analyzeBtn) analyzeBtn.disabled = true;
    resultsEl.innerHTML = '<div style="padding:14px; color:var(--text-secondary,#888);">Analyzing…</div>';

    try {
      const result = await this.computeBaseComposition(chromosome, position, { fileId: this._activeFileId });
      this._lastResult = result;
      resultsEl.innerHTML = this._renderResult(result);
      if (noteEl) noteEl.textContent = this._filtersNote(result);
    } catch (err) {
      console.error('[BaseCompositionAnalyzer] compute failed:', err);
      resultsEl.innerHTML = `<div style="color:#c0392b; padding:12px;">Failed: ${this._escape((err && err.message) || String(err))}</div>`;
    } finally {
      this._busy = false;
      if (analyzeBtn) analyzeBtn.disabled = false;
    }
  }

  _renderResult(r) {
    if (!r || r.depth === 0) {
      const loc = r ? `${this._escape(r.chromosome)}:${r.position.toLocaleString()}` : '';
      return `<div style="padding:14px; color:var(--text-secondary,#888);">No reads cover ${loc}.</div>`;
    }

    const ref = r.referenceBase;
    const rows = ['A', 'C', 'G', 'T', 'N'].map(b => this._baseRow(b, r, ref)).join('');
    const delRow = r.deletions > 0 ? this._delRow(r) : '';
    const insRow = r.insertions.count > 0 ? this._insRow(r) : '';

    const header = `
      <div style="margin-bottom:12px; font-size:13px; color:var(--text-primary,#222);">
        <strong>${this._escape(r.chromosome)}:${r.position.toLocaleString()}</strong>
        &nbsp;·&nbsp; Depth <strong>${r.depth.toLocaleString()}</strong>
        ${ref ? `&nbsp;·&nbsp; Reference <strong style="color:${this.baseColors[ref] || '#333'}">${ref}</strong>` : ''}
      </div>`;

    return (
      header +
      `<table style="width:100%; border-collapse:collapse; font-size:13px;">
        <thead>
          <tr style="text-align:left; color:var(--text-secondary,#666); border-bottom:1px solid var(--border-color,#e0e0e0);">
            <th style="padding:4px 6px;">Base</th>
            <th style="padding:4px 6px;">Count</th>
            <th style="padding:4px 6px;">%</th>
            <th style="padding:4px 6px;">+ / −</th>
            <th style="padding:4px 6px; width:38%;"></th>
          </tr>
        </thead>
        <tbody>${rows}${delRow}${insRow}</tbody>
      </table>`
    );
  }

  _baseRow(b, r, ref) {
    const count = r.counts[b];
    const pctVal = r.percentages[b];
    const color = this.baseColors[b] || '#888';
    const isRef = ref && b === ref;
    const barW = Math.max(0, Math.min(100, pctVal));
    return `
      <tr style="border-bottom:1px solid var(--border-color,#f0f0f0);">
        <td style="padding:5px 6px; font-weight:700; color:${color};">${b}${isRef ? ' <span style="font-weight:400;color:#888;font-size:11px;">(ref)</span>' : ''}</td>
        <td style="padding:5px 6px;">${count.toLocaleString()}</td>
        <td style="padding:5px 6px;">${pctVal.toFixed(1)}%</td>
        <td style="padding:5px 6px; color:#888; font-size:12px;">${r.strand[b]['+']} / ${r.strand[b]['-']}</td>
        <td style="padding:5px 6px;"><div style="background:${color}; opacity:${count > 0 ? 0.85 : 0.15}; height:12px; width:${barW}%; border-radius:2px; min-width:${count > 0 ? 2 : 0}px;"></div></td>
      </tr>`;
  }

  _delRow(r) {
    const barW = Math.max(0, Math.min(100, r.percentages.del));
    return `
      <tr style="border-bottom:1px solid var(--border-color,#f0f0f0);">
        <td style="padding:5px 6px; font-weight:700; color:#7f8c8d;">Del</td>
        <td style="padding:5px 6px;">${r.deletions.toLocaleString()}</td>
        <td style="padding:5px 6px;">${r.percentages.del.toFixed(1)}%</td>
        <td style="padding:5px 6px; color:#888; font-size:12px;">—</td>
        <td style="padding:5px 6px;"><div style="background:#7f8c8d; height:12px; width:${barW}%; border-radius:2px;"></div></td>
      </tr>`;
  }

  _insRow(r) {
    const seqs = Object.entries(r.insertions.sequences)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([s, n]) => `${this._escape(s)}×${n}`)
      .join(', ');
    return `
      <tr>
        <td style="padding:5px 6px; font-weight:700; color:#8e44ad;">Ins</td>
        <td style="padding:5px 6px;">${r.insertions.count.toLocaleString()}</td>
        <td style="padding:5px 6px; color:#888;">after</td>
        <td style="padding:5px 6px; color:#888; font-size:12px;" colspan="2">${seqs}</td>
      </tr>`;
  }

  _filtersNote(r) {
    const parts = ['% of aligned bases · Del % of depth'];
    if (r.skips > 0) parts.push(`${r.skips} ref-skip (N) read(s) excluded`);
    const s = this._readsSettings(r.fileId);
    if (s && Number(s.minMappingQuality) > 0) parts.push(`MAPQ ≥ ${s.minMappingQuality}`);
    return parts.join(' · ');
  }

  _copyTsv() {
    const r = this._lastResult;
    if (!r) return;
    const lines = [];
    lines.push(`# ${r.chromosome}:${r.position}\tdepth=${r.depth}\tref=${r.referenceBase || 'NA'}`);
    lines.push('base\tcount\tpercent\tplus\tminus');
    ['A', 'C', 'G', 'T', 'N'].forEach(b => {
      lines.push(`${b}\t${r.counts[b]}\t${r.percentages[b]}\t${r.strand[b]['+']}\t${r.strand[b]['-']}`);
    });
    lines.push(`del\t${r.deletions}\t${r.percentages.del}\t\t`);
    lines.push(`ins\t${r.insertions.count}\t\t\t`);
    const tsv = lines.join('\n');

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(tsv)
        .then(() => {
          if (this.genomeBrowser && this.genomeBrowser.showNotification) {
            this.genomeBrowser.showNotification('Base composition copied (TSV)', 'success');
          }
        })
        .catch(() => {});
    }
  }

  _escape(s) {
    return String(s == null ? '' : s).replace(
      /[&<>"]/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]
    );
  }
}

// Export for Node (tests) and attach to window (browser).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BaseCompositionAnalyzer;
} else if (typeof window !== 'undefined') {
  window.BaseCompositionAnalyzer = BaseCompositionAnalyzer;
}
