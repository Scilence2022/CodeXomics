// @ts-check
/**
 * PrimerLibraryUI - Management panel for the primer library.
 *
 * Presents primers as first-class oligos (not annotations): list/search, view
 * computed properties and live binding-site counts, create pairs, locate the best
 * binding site, import/export (CSV/FASTA), tune prediction stringency, and an
 * explicit opt-in export of binding sites to a separate GFF / GenBank file (the
 * source genome file is never modified).
 */
class PrimerLibraryUI {
  constructor(genomeBrowser) {
    this.gb = genomeBrowser;
    this.modalId = 'primerLibraryModal';
    this.editId = 'primerEditModal';
    this.searchTerm = '';

    const svc = this.gb?.primerManager?.bindingService;
    if (svc && typeof svc.onSitesUpdated === 'function') {
      svc.onSitesUpdated(() => this.refreshIfOpen());
    }
  }

  get manager() {
    return this.gb?.primerManager || null;
  }
  get designer() {
    return (typeof window !== 'undefined' && window.PrimerDesigner) || null;
  }
  get currentChromosome() {
    return document.getElementById('chromosomeSelect')?.value || this.gb?.currentChromosome || null;
  }

  // --- Open / close --------------------------------------------------------

  open() {
    if (!this.manager) {
      alert('Primer manager is not available');
      return;
    }
    this.ensureModal();
    this.refresh();
    document.getElementById(this.modalId)?.classList.add('show');
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
    modal.className = 'modal primer-library-modal';
    modal.innerHTML = `
      <div class="modal-content large">
        <div class="modal-header">
          <h3><i class="fas fa-vials"></i> Primer library</h3>
          <div class="modal-controls">
            <button class="modal-close" data-action="close" title="Close">&times;</button>
          </div>
        </div>
        <div class="modal-body">
          <div class="primer-lib-toolbar">
            <button class="btn btn-primary btn-sm" data-action="add"><i class="fas fa-plus"></i> Add primer</button>
            <button class="btn btn-secondary btn-sm" data-action="import-csv"><i class="fas fa-file-csv"></i> Import CSV</button>
            <button class="btn btn-secondary btn-sm" data-action="import-fasta"><i class="fas fa-dna"></i> Import FASTA</button>
            <button class="btn btn-secondary btn-sm" data-action="export-csv"><i class="fas fa-download"></i> Export CSV</button>
            <button class="btn btn-secondary btn-sm" data-action="export-fasta"><i class="fas fa-download"></i> Export FASTA</button>
            <button class="btn btn-secondary btn-sm" data-action="export-gff" title="Export predicted + pinned binding sites as a separate GFF file">Sites → GFF</button>
            <button class="btn btn-secondary btn-sm" data-action="export-gbk" title="Export an annotated genome copy with primer_bind features (separate file)">Genome + primers → GBK</button>
            <input type="search" class="input-full primer-lib-search" placeholder="Search primers…" data-role="search" />
          </div>
          <div class="primer-lib-stringency" data-role="stringency"></div>
          <div class="primer-lib-table-wrap">
            <table class="primer-lib-table">
              <thead>
                <tr>
                  <th>Name</th><th>Sequence (5'→3')</th><th>Len</th><th>Tm</th><th>GC%</th>
                  <th>Tags</th><th>Sites</th><th>Pair</th><th></th>
                </tr>
              </thead>
              <tbody data-role="primer-rows"></tbody>
            </table>
          </div>
          <div class="primer-lib-pairs" data-role="pairs"></div>
        </div>
      </div>`;

    document.body.appendChild(modal);

    // Hidden file input for imports.
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.csv,.tsv,.txt,.fa,.fasta,.fna';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', e => this._handleImportFile(e));
    modal.appendChild(fileInput);
    this._fileInput = fileInput;

    // Event delegation for all controls.
    modal.addEventListener('click', e => this._onClick(e));
    modal.querySelector('[data-role="search"]').addEventListener('input', e => {
      this.searchTerm = String(e.target.value || '').toLowerCase();
      this.refresh();
    });
    // Click on the backdrop closes the modal.
    modal.addEventListener('mousedown', e => {
      if (e.target === modal) this.close();
    });
  }

  // --- Rendering -----------------------------------------------------------

  refresh() {
    const modal = document.getElementById(this.modalId);
    if (!modal) return;
    this._renderStringency(modal.querySelector('[data-role="stringency"]'));
    this._renderRows(modal.querySelector('[data-role="primer-rows"]'));
    this._renderPairs(modal.querySelector('[data-role="pairs"]'));
  }

  _renderStringency(container) {
    if (!container) return;
    const svc = this.manager.bindingService;
    const s = svc ? svc.getStringency() : null;
    if (!s) {
      container.innerHTML = '';
      return;
    }
    container.innerHTML = `
      <span class="primer-lib-stringency-label">Prediction stringency:</span>
      <label>max mismatches <input type="number" min="0" max="10" value="${s.maxMismatches}" data-role="str-maxmm" style="width:48px"></label>
      <label>max 3' mismatches <input type="number" min="0" max="5" value="${s.max3PrimeMismatches}" data-role="str-max3" style="width:48px"></label>
      <label>mode
        <select data-role="str-mode">
          <option value="fast" ${s.scoringMode === 'fast' ? 'selected' : ''}>fast</option>
          <option value="thermodynamic" ${s.scoringMode === 'thermodynamic' ? 'selected' : ''}>thermodynamic</option>
        </select>
      </label>
      <button class="btn btn-secondary btn-sm" data-action="apply-stringency">Apply</button>`;
  }

  _renderRows(tbody) {
    if (!tbody) return;
    const primers = this.manager.listPrimers().filter(p => this._matchesSearch(p));
    if (primers.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="primer-lib-empty">No primers yet. Use “Add primer”, import a CSV/FASTA, or design primers in the chat.</td></tr>`;
      return;
    }
    tbody.innerHTML = primers.map(primer => this._rowHtml(primer)).join('');
  }

  _rowHtml(primer) {
    const props = this._props(primer.sequence);
    const tm = props && Number.isFinite(props.tm) ? `${props.tm}°C` : '—';
    const gc = props && Number.isFinite(props.gcContent) ? `${props.gcContent}` : '—';
    const len = primer.sequence ? primer.sequence.length : 0;
    const tags = (primer.tags || []).map(t => `<span class="primer-tag">${this._esc(t)}</span>`).join(' ');
    const pair = this.manager.getPairForPrimer(primer.id);
    const pairLabel = pair ? this._esc(pair.name) : '—';
    const seq = primer.sequence
      ? `${this._esc(primer.sequence.slice(0, 28))}${primer.sequence.length > 28 ? '…' : ''}`
      : '<em>no sequence</em>';
    return `
      <tr data-primer-id="${this._esc(primer.id)}">
        <td class="primer-lib-name">${this._esc(primer.name)}</td>
        <td class="primer-lib-seq" title="${this._esc(primer.sequence || '')}">${seq}</td>
        <td>${len || '—'}</td>
        <td>${tm}</td>
        <td>${gc}</td>
        <td class="primer-lib-tags">${tags || '—'}</td>
        <td class="primer-lib-sites">${this._siteSummary(primer)}</td>
        <td>${pairLabel}</td>
        <td class="primer-lib-actions">
          <button class="btn btn-xs" data-action="locate" title="Go to best binding site"><i class="fas fa-crosshairs"></i></button>
          <button class="btn btn-xs" data-action="edit" title="Edit primer"><i class="fas fa-pen"></i></button>
          <button class="btn btn-xs btn-danger" data-action="delete" title="Delete primer"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`;
  }

  _renderPairs(container) {
    if (!container) return;
    const primers = this.manager.listPrimers();
    const pairs = this.manager.listPairs();
    const options = primers.map(p => `<option value="${this._esc(p.id)}">${this._esc(p.name)}</option>`).join('');

    const pairRows = pairs.length
      ? pairs
          .map(pair => {
            const fwd = this.manager.getPrimer(pair.forwardId);
            const rev = this.manager.getPrimer(pair.reverseId);
            const size = Number.isFinite(pair.expectedProductBp) ? `${pair.expectedProductBp} bp` : '—';
            return `<li data-pair-id="${this._esc(pair.id)}">
              <strong>${this._esc(pair.name)}</strong>: ${this._esc(fwd?.name || '?')} / ${this._esc(rev?.name || '?')} · ${size}
              <button class="btn btn-xs btn-danger" data-action="delete-pair" title="Delete pair"><i class="fas fa-trash"></i></button>
            </li>`;
          })
          .join('')
      : '<li class="primer-lib-empty">No pairs defined.</li>';

    container.innerHTML = `
      <h4>Primer pairs</h4>
      <ul class="primer-lib-pair-list">${pairRows}</ul>
      <div class="primer-lib-pair-create">
        <input type="text" placeholder="Pair name" data-role="pair-name" />
        <label>F <select data-role="pair-fwd">${options}</select></label>
        <label>R <select data-role="pair-rev">${options}</select></label>
        <button class="btn btn-secondary btn-sm" data-action="create-pair">Create pair</button>
      </div>`;
  }

  // --- Event handling ------------------------------------------------------

  async _onClick(e) {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.getAttribute('data-action');
    const row = e.target.closest('[data-primer-id]');
    const primerId = row?.getAttribute('data-primer-id');

    try {
      switch (action) {
        case 'close':
          this.close();
          break;
        case 'add':
          this.openEdit(null);
          break;
        case 'edit':
          this.openEdit(primerId);
          break;
        case 'delete':
          await this._deletePrimer(primerId);
          break;
        case 'locate':
          this._locate(primerId);
          break;
        case 'import-csv':
        case 'import-fasta':
          this._importKind = action === 'import-csv' ? 'csv' : 'fasta';
          this._fileInput?.click();
          break;
        case 'export-csv':
          this._download(this.manager.exportToCSV(), 'primers.csv', 'text/csv');
          break;
        case 'export-fasta':
          this._download(this.manager.exportToFasta(), 'primers.fasta', 'text/plain');
          break;
        case 'export-gff':
          this._download(this._buildSitesGFF(), 'primer_binding_sites.gff3', 'text/plain');
          break;
        case 'export-gbk':
          this._download(this._buildGenomeWithPrimersGenBank(), 'genome_with_primers.gbk', 'text/plain');
          break;
        case 'apply-stringency':
          this._applyStringency();
          break;
        case 'create-pair':
          await this._createPair();
          break;
        case 'delete-pair': {
          const pairId = e.target.closest('[data-pair-id]')?.getAttribute('data-pair-id');
          if (pairId) {
            await this.manager.removePair(pairId);
            this.refresh();
          }
          break;
        }
        default:
          break;
      }
    } catch (err) {
      console.error('PrimerLibraryUI action failed:', err);
      alert(`Action failed: ${err.message}`);
    }
  }

  async _deletePrimer(primerId) {
    if (!primerId) return;
    const primer = this.manager.getPrimer(primerId);
    if (!primer) return;
    if (!confirm(`Delete primer "${primer.name}"? This also removes any pair that uses it.`)) return;
    await this.manager.removePrimer(primerId);
    this.refresh();
  }

  _locate(primerId) {
    if (!primerId) return;
    const chr = this.currentChromosome;
    const svc = this.manager.bindingService;
    const primer = this.manager.getPrimer(primerId);
    if (!primer) return;

    let sites = (primer.pinnedSites || []).filter(s => !chr || s.chromosome === chr).slice();
    const cached = (svc && chr && svc.getCachedSites(primerId, chr)) || [];
    sites = sites.concat(cached);

    if (!sites.length) {
      if (svc && chr) svc.ensureSites(primer, chr);
      this.gb.updateStatus?.('Scanning for binding sites… try Locate again in a moment', { duration: 3000 });
      return;
    }
    const best = sites.sort(
      (a, b) =>
        (b.bindingScore || 0) - (a.bindingScore || 0) || (a.mismatches?.length || 0) - (b.mismatches?.length || 0)
    )[0];
    this.gb.navigationManager?.navigateToPosition(best.chromosome || chr, best.start, best.end);
    this.close();
  }

  _applyStringency() {
    const modal = document.getElementById(this.modalId);
    const maxmm = parseInt(modal.querySelector('[data-role="str-maxmm"]')?.value, 10);
    const max3 = parseInt(modal.querySelector('[data-role="str-max3"]')?.value, 10);
    const mode = modal.querySelector('[data-role="str-mode"]')?.value;
    const profile = {};
    if (Number.isFinite(maxmm)) profile.maxMismatches = maxmm;
    if (Number.isFinite(max3)) profile.max3PrimeMismatches = max3;
    if (mode) profile.scoringMode = mode;
    this.manager.setStringency(profile);
    this.gb.configManager?.set?.('primers.stringency', this.manager.getStringency());
    this.manager.refreshPrimerViews();
    this.refresh();
  }

  async _createPair() {
    const modal = document.getElementById(this.modalId);
    const name = modal.querySelector('[data-role="pair-name"]')?.value?.trim();
    const forwardId = modal.querySelector('[data-role="pair-fwd"]')?.value;
    const reverseId = modal.querySelector('[data-role="pair-rev"]')?.value;
    if (!forwardId || !reverseId || forwardId === reverseId) {
      alert('Select two different primers for the pair');
      return;
    }
    await this.manager.addPair({ name: name || undefined, forwardId, reverseId });
    this.refresh();
  }

  async _handleImportFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const text = await file.text();
    let imported = 0;
    if (this._importKind === 'fasta' || /\.(fa|fasta|fna)$/i.test(file.name)) {
      imported = await this.manager.importFromFasta(text);
    } else {
      imported = await this.manager.importFromCSV(text);
    }
    this.gb.updateStatus?.(`Imported ${imported} primer${imported === 1 ? '' : 's'}`, { duration: 3000 });
    this.refresh();
  }

  // --- Add / edit dialog ---------------------------------------------------

  openEdit(primerId) {
    const primer = primerId ? this.manager.getPrimer(primerId) : null;
    this._ensureEditModal();
    const modal = document.getElementById(this.editId);
    modal.querySelector('[data-role="edit-title"]').textContent = primer ? 'Edit primer' : 'Add primer';
    modal.querySelector('[data-role="f-id"]').value = primer?.id || '';
    modal.querySelector('[data-role="f-name"]').value = primer?.name || '';
    modal.querySelector('[data-role="f-seq"]').value = primer?.sequence || this._selectionSequence() || '';
    modal.querySelector('[data-role="f-tail"]').value = primer?.fivePrimeTail || '';
    modal.querySelector('[data-role="f-tags"]').value = (primer?.tags || []).join(', ');
    modal.querySelector('[data-role="f-notes"]').value = primer?.notes || '';
    modal.classList.add('show');
  }

  _ensureEditModal() {
    if (document.getElementById(this.editId)) return;
    const modal = document.createElement('div');
    modal.id = this.editId;
    modal.className = 'modal primer-edit-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3 data-role="edit-title">Add primer</h3>
          <div class="modal-controls"><button class="modal-close" data-action="edit-cancel">&times;</button></div>
        </div>
        <div class="modal-body">
          <input type="hidden" data-role="f-id" />
          <div class="form-group"><label>Name</label><input type="text" class="input-full" data-role="f-name" placeholder="e.g. lacZ_F" /></div>
          <div class="form-group"><label>Sequence (5'→3')</label><input type="text" class="input-full" data-role="f-seq" placeholder="ATGC… (the oligo as ordered)" /></div>
          <div class="form-group"><label>5' tail (optional)</label><input type="text" class="input-full" data-role="f-tail" placeholder="non-templated 5' extension, e.g. a restriction site" /></div>
          <div class="form-group"><label>Tags (comma-separated)</label><input type="text" class="input-full" data-role="f-tags" placeholder="cloning, qPCR" /></div>
          <div class="form-group"><label>Notes</label><textarea class="input-full" rows="2" data-role="f-notes"></textarea></div>
          <div class="help-text">Binding sites are predicted automatically in real time. Use the genome selection + “Add primer” to pin a manual placement.</div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" data-action="edit-cancel">Cancel</button>
          <button class="btn btn-primary" data-action="edit-save">Save</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => {
      const action = e.target.closest('[data-action]')?.getAttribute('data-action');
      if (action === 'edit-cancel' || e.target === modal) {
        modal.classList.remove('show');
      } else if (action === 'edit-save') {
        this._saveEdit();
      }
    });
  }

  async _saveEdit() {
    const modal = document.getElementById(this.editId);
    const id = modal.querySelector('[data-role="f-id"]').value;
    const name = modal.querySelector('[data-role="f-name"]').value.trim();
    const sequence = modal.querySelector('[data-role="f-seq"]').value.trim();
    const fivePrimeTail = modal.querySelector('[data-role="f-tail"]').value.trim();
    const tags = modal
      .querySelector('[data-role="f-tags"]')
      .value.split(',')
      .map(t => t.trim())
      .filter(Boolean);
    const notes = modal.querySelector('[data-role="f-notes"]').value.trim();

    if (!sequence) {
      alert('A primer sequence is required');
      return;
    }
    if (id) {
      await this.manager.updatePrimer(id, { name, sequence, fivePrimeTail, tags, notes });
    } else {
      await this.manager.addPrimer({
        name: name || undefined,
        sequence,
        fivePrimeTail,
        tags,
        notes,
        source: 'library',
      });
    }
    modal.classList.remove('show');
    this.refresh();
  }

  // --- Binding-site exports (opt-in, separate files) -----------------------

  _gatherSites() {
    const records = [];
    const svc = this.manager.bindingService;
    const chromosomes = Object.keys(this.gb.currentSequence || {});
    for (const primer of this.manager.listPrimers()) {
      (primer.pinnedSites || []).forEach(site => records.push(this._siteRecord(primer, site, 'pinned')));
      if (svc && primer.sequence) {
        chromosomes.forEach(chr => {
          const cached = svc.getCachedSites(primer.id, chr);
          if (cached) cached.forEach(site => records.push(this._siteRecord(primer, site, 'predicted')));
        });
      }
    }
    return records;
  }

  _siteRecord(primer, site, origin) {
    return {
      chromosome: site.chromosome,
      start: site.start,
      end: site.end,
      strand: site.strand === '-' ? '-' : '+',
      name: primer.name,
      primerSequence: primer.sequence || '',
      bindingSequence: site.bindingSequence || '',
      mismatches: site.mismatches?.length || 0,
      origin: site.origin || origin,
    };
  }

  _buildSitesGFF() {
    const sites = this._gatherSites();
    let gff = '##gff-version 3\n';
    sites.forEach((s, i) => {
      const attrs = [
        `ID=primer_site_${i + 1}`,
        `Name=${s.name}`,
        `primer_sequence=${s.primerSequence}`,
        `binding_sequence=${s.bindingSequence}`,
        `mismatches=${s.mismatches}`,
        `origin=${s.origin}`,
      ].join(';');
      gff += `${s.chromosome}\tCodeXomics\tprimer_bind\t${s.start}\t${s.end}\t.\t${s.strand}\t.\t${attrs}\n`;
    });
    return gff;
  }

  _buildGenomeWithPrimersGenBank() {
    // Full annotated-genome copy with primer_bind features appended. This is the
    // explicit opt-in interoperability path; the source genome file is untouched.
    const gb = this.gb;
    const sites = this._gatherSites();
    const sitesByChr = {};
    sites.forEach(s => {
      (sitesByChr[s.chromosome] = sitesByChr[s.chromosome] || []).push(s);
    });

    let content = '';
    const chromosomes = Object.keys(gb.currentSequence || {});
    chromosomes.forEach(chr => {
      const sequence = gb.currentSequence[chr];
      const exportable =
        gb.exportManager?.getExportableFeatures(chr) ||
        (gb.currentAnnotations?.[chr] || []).filter(f => {
          const t = String(f?.type || '').toLowerCase();
          return t !== 'primer' && t !== 'primer_bind';
        });

      content += `LOCUS       ${chr.padEnd(16)} ${sequence.length} bp    DNA     linear   UNK\n`;
      content += `DEFINITION  ${chr} (with predicted/pinned primers)\n`;
      content += `ACCESSION   ${chr}\nVERSION     ${chr}\nKEYWORDS    .\nSOURCE      .\n  ORGANISM  .\n`;
      content += `FEATURES             Location/Qualifiers\n`;
      content += `     source          1..${sequence.length}\n`;

      exportable.forEach(feature => {
        const location =
          feature.strand === '-' ? `complement(${feature.start}..${feature.end})` : `${feature.start}..${feature.end}`;
        content += `     ${String(feature.type).padEnd(15)} ${location}\n`;
        const gene = feature.qualifiers?.gene || feature.name;
        if (gene) content += `                     /gene="${gene}"\n`;
      });

      (sitesByChr[chr] || []).forEach(s => {
        const location = s.strand === '-' ? `complement(${s.start}..${s.end})` : `${s.start}..${s.end}`;
        content += `     ${'primer_bind'.padEnd(15)} ${location}\n`;
        content += `                     /label="${s.name}"\n`;
        if (s.primerSequence) content += `                     /sequence="${s.primerSequence}"\n`;
        content += `                     /note="origin=${s.origin}; mismatches=${s.mismatches}"\n`;
      });

      content += `ORIGIN\n`;
      for (let i = 0; i < sequence.length; i += 60) {
        const lineNum = (i + 1).toString().padStart(9);
        const seqLine = sequence.substring(i, i + 60).toLowerCase();
        const formatted = seqLine.match(/.{1,10}/g)?.join(' ') || seqLine;
        content += `${lineNum} ${formatted}\n`;
      }
      content += `//\n\n`;
    });
    return content;
  }

  // --- Small helpers -------------------------------------------------------

  _siteSummary(primer) {
    const chr = this.currentChromosome;
    const pinned = (primer.pinnedSites || []).filter(s => !chr || s.chromosome === chr).length;
    let predicted = '';
    const svc = this.manager.bindingService;
    if (svc && primer.sequence && chr) {
      const summary = svc.getOffTargetSummary({ id: primer.id, sequence: primer.sequence }, chr);
      if (summary) {
        predicted = `${summary.total} pred`;
      } else {
        svc.ensureSites({ id: primer.id, sequence: primer.sequence }, chr);
        predicted = '<span class="primer-lib-scanning">scanning…</span>';
      }
    }
    const parts = [];
    if (predicted) parts.push(predicted);
    if (pinned) parts.push(`${pinned} pinned`);
    return parts.join(' · ') || '—';
  }

  _props(sequence) {
    if (!sequence || !this.designer) return null;
    try {
      return this.designer.calculateProperties(sequence);
    } catch (e) {
      return null;
    }
  }

  _matchesSearch(primer) {
    if (!this.searchTerm) return true;
    const haystack = [primer.name, primer.sequence, (primer.tags || []).join(' '), primer.notes]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(this.searchTerm);
  }

  _selectionSequence() {
    // Prefill the sequence field from an active genome selection, if available.
    // The selection state lives in gb.sequenceSelection ({start,end,active,chromosome},
    // 1-based inclusive); derive the substring from the loaded sequence.
    try {
      const sel = this.gb?.sequenceSelection;
      if (!sel || !sel.active) return '';
      const chr = sel.chromosome || this.currentChromosome;
      const seq = this.gb?.currentSequence?.[chr];
      const start = Number.parseInt(sel.start, 10);
      const end = Number.parseInt(sel.end, 10);
      if (!seq || !Number.isFinite(start) || !Number.isFinite(end)) return '';
      const lo = Math.max(0, Math.min(start, end) - 1);
      const hi = Math.min(seq.length, Math.max(start, end));
      return seq.substring(lo, hi).toUpperCase();
    } catch (e) {
      return '';
    }
  }

  _download(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PrimerLibraryUI;
}
if (typeof window !== 'undefined') {
  window.PrimerLibraryUI = PrimerLibraryUI;
}
