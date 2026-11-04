/**
 * PrimerDetailsPanel.js
 * Builds and renders the Primer Details sidebar for a selected primer binding site.
 *
 * buildModel() is pure (no DOM) so the oligo / tail / genome-window bookkeeping
 * and the QC numbers can be unit-tested; render() turns the model into markup
 * and wires the action buttons. The panel is re-rendered from the primer object
 * (never restored from saved HTML), so its listeners always exist.
 */
class PrimerDetailsPanel {
  constructor(genomeBrowser, options = {}) {
    this.genomeBrowser = genomeBrowser;
    this.designer = options.designer || null;
  }

  /** Qualifiers that are internal fields or already shown elsewhere in the panel. */
  static HIDDEN_QUALIFIERS = new Set([
    'gene',
    'label',
    'product',
    'note',
    'sequence',
    'primer_sequence',
    'oligo_sequence',
    'binding_sequence',
    'five_prime_phosphate',
    'five_prime_tail',
    'user_defined',
    'color',
  ]);

  static STATUS_ICONS = {
    good: 'fa-check-circle',
    acceptable: 'fa-minus-circle',
    warning: 'fa-exclamation-triangle',
    info: 'fa-info-circle',
  };

  static cleanSequence(value) {
    return String(value || '')
      .toUpperCase()
      .replace(/[^ATCGN]/g, '');
  }

  static reverseComplement(sequence) {
    const complement = { A: 'T', T: 'A', G: 'C', C: 'G', N: 'N' };
    return String(sequence)
      .split('')
      .reverse()
      .map(base => complement[base] || base)
      .join('');
  }

  static escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  _getDesigner() {
    if (this.designer) return this.designer;
    if (typeof window !== 'undefined' && window.PrimerDesigner) {
      this.designer = window.PrimerDesigner;
    } else if (typeof require === 'function') {
      try {
        this.designer = require('./PrimerDesigner');
      } catch (e) {
        this.designer = null;
      }
    }
    return this.designer;
  }

  _qualifier(primer, key) {
    const value = primer?.qualifiers?.[key];
    return Array.isArray(value) ? value[0] : value;
  }

  /**
   * Gather everything the panel shows for one primer binding site.
   * @param {Object} primer - renderable binding site (or legacy primer feature)
   * @param {Object} [context] - { chromosome, chromosomeSequence }
   */
  buildModel(primer, context = {}) {
    const clean = PrimerDetailsPanel.cleanSequence;
    const source = primer?.sourcePrimer || {};
    const start = Math.min(primer.start, primer.end);
    const end = Math.max(primer.start, primer.end);
    const isReverse = primer.strand === -1 || primer.strand === '-';
    const chromosome = primer.chromosome || context.chromosome || '';

    const oligo = clean(
      primer.sequence ||
        source.sequence ||
        this._qualifier(primer, 'sequence') ||
        this._qualifier(primer, 'primer_sequence') ||
        this._qualifier(primer, 'oligo_sequence')
    );
    const tail = clean(primer.fivePrimeTail ?? source.fivePrimeTail ?? this._qualifier(primer, 'five_prime_tail'));
    const tailLength = tail && oligo.startsWith(tail) && tail.length < oligo.length ? tail.length : 0;

    let genomeWindow = clean(primer.bindingSequence);
    if (!genomeWindow && context.chromosomeSequence) {
      const slice = context.chromosomeSequence.substring(start - 1, end).toUpperCase();
      genomeWindow = clean(isReverse ? PrimerDetailsPanel.reverseComplement(slice) : slice);
    }

    const fullOligo = oligo || genomeWindow;
    const annealing = oligo ? oligo.slice(tailLength) : genomeWindow;

    const comparable = Boolean(annealing && genomeWindow && annealing.length === genomeWindow.length);
    const mismatchPositions = [];
    if (comparable) {
      for (let i = 0; i < annealing.length; i++) {
        if (annealing[i] !== genomeWindow[i]) mismatchPositions.push(i);
      }
    }

    const designer = this._getDesigner();
    let quality = null;
    if (fullOligo && designer?.assessPrimerQuality) {
      try {
        quality = designer.assessPrimerQuality(fullOligo, { fivePrimeTail: tailLength ? tail : '' });
      } catch (e) {
        quality = null;
      }
    }

    // A mismatched site anneals more weakly than the oligo's own (perfect-match) Tm.
    let siteBinding = null;
    if (comparable && mismatchPositions.length > 0 && designer?._calculateBindingTm) {
      try {
        const thermo = designer._calculateBindingTm(annealing, genomeWindow, quality?.conditions);
        siteBinding = { tm: thermo.tm, deltaG: thermo.deltaG };
      } catch (e) {
        siteBinding = null;
      }
    }

    // Legacy annotations without a usable sequence may still carry Tm/GC in their note.
    const description = primer.description || primer.notes || this._qualifier(primer, 'note') || '';
    let fallback = null;
    if (!quality) {
      const tmMatch = String(description).match(/Tm:\s*([\d.]+)/i);
      const gcMatch = String(description).match(/GC:\s*([\d.]+)/i);
      fallback = {
        tm: tmMatch ? parseFloat(tmMatch[1]) : null,
        gcContent: gcMatch ? parseFloat(gcMatch[1]) : null,
      };
    }

    const product = this._qualifier(primer, 'product') || '';
    const infoItems = [];
    if (product) infoItems.push({ label: 'Product', value: String(product) });
    if (description && description !== product) infoItems.push({ label: 'Note', value: String(description) });
    if (Array.isArray(source.tags) && source.tags.length) {
      infoItems.push({ label: 'Tags', value: source.tags.join(', ') });
    }
    Object.entries(primer.qualifiers || {}).forEach(([key, value]) => {
      if (PrimerDetailsPanel.HIDDEN_QUALIFIERS.has(key)) return;
      const text = Array.isArray(value) ? value.join(', ') : String(value ?? '');
      if (text.trim() && text !== 'Unknown' && text !== 'false') {
        infoItems.push({ label: key.replace(/_/g, ' '), value: text });
      }
    });

    return {
      name: primer.name || this._qualifier(primer, 'label') || this._qualifier(primer, 'gene') || 'Unnamed Primer',
      chromosome,
      start,
      end,
      siteLength: end - start + 1,
      isReverse,
      origin: primer.origin || null,
      fivePrimePhosphate: primer.fivePrimePhosphate === true || source.fivePrimePhosphate === true,
      oligo: fullOligo,
      tail: tailLength ? tail : '',
      tailLength,
      annealing,
      genomeWindow,
      comparable,
      mismatchPositions,
      threePrimeMismatches: mismatchPositions.filter(index => annealing.length - 1 - index < 5).length,
      siteBinding,
      quality,
      fallback,
      infoItems,
    };
  }

  // --- Rendering ------------------------------------------------------------

  _baseSpans(sequence, mismatchPositions = [], className = '') {
    const mismatches = new Set(mismatchPositions);
    const esc = PrimerDetailsPanel.escapeHtml;
    return String(sequence)
      .split('')
      .map((base, index) => {
        const classes = ['primer-base', `primer-base-${base}`];
        if (className) classes.push(className);
        if (mismatches.has(index)) classes.push('primer-base-mismatch');
        return `<span class="${classes.join(' ')}">${esc(base)}</span>`;
      })
      .join('');
  }

  _formatValue(check) {
    if (check.value === null || check.value === undefined) return '—';
    switch (check.id) {
      case 'tm':
      case 'fullTm':
        return `${check.value.toFixed(1)} °C`;
      case 'gc':
        return `${check.value.toFixed(1)}%`;
      case 'length':
        return `${check.value} nt`;
      case 'gcClamp':
        return `${check.value} / 5`;
      case 'repeats':
        return check.status === 'warning' ? 'Found' : 'None';
      default:
        return `${check.value.toFixed(1)} kcal/mol`;
    }
  }

  /** Value with its unit set smaller, so ΔG cards do not wrap in a narrow sidebar. */
  _valueHtml(check) {
    const esc = PrimerDetailsPanel.escapeHtml;
    const text = this._formatValue(check);
    const match = /^(-?[\d.]+)\s+(.+)$/.exec(text);
    if (!match) return esc(text);
    return `${esc(match[1])}<span class="primer-prop-unit">${esc(match[2])}</span>`;
  }

  _card(check) {
    const esc = PrimerDetailsPanel.escapeHtml;
    const icon = PrimerDetailsPanel.STATUS_ICONS[check.status] || PrimerDetailsPanel.STATUS_ICONS.info;
    return `
      <div class="primer-prop-card quality-${check.status}" data-check="${esc(check.id)}">
        <div class="primer-prop-label">${esc(check.label)}</div>
        <div class="primer-prop-value">${this._valueHtml(check)}</div>
        <div class="primer-prop-quality"><i class="fas ${icon}"></i> ${esc(check.message)}</div>
      </div>`;
  }

  _qualityHtml(model) {
    const esc = PrimerDetailsPanel.escapeHtml;
    const quality = model.quality;
    if (!quality) {
      const { tm, gcContent } = model.fallback || {};
      if (tm == null && gcContent == null) return '';
      const cards = [];
      if (tm != null)
        cards.push(this._card({ id: 'tm', label: 'Tm', value: tm, status: 'info', message: 'From note' }));
      if (gcContent != null) {
        cards.push(
          this._card({ id: 'gc', label: 'GC content', value: gcContent, status: 'info', message: 'From note' })
        );
      }
      return `<div class="primer-properties-section">
        <div class="primer-section-title"><i class="fas fa-thermometer-half"></i> Thermodynamic Properties</div>
        <div class="primer-props-grid">${cards.join('')}</div></div>`;
    }

    const byId = Object.fromEntries(quality.checks.map(check => [check.id, check]));
    const primary = [byId.tm];
    if (quality.fullTm !== null) {
      primary.push({
        id: 'fullTm',
        label: 'Tm (full oligo)',
        value: quality.fullTm,
        status: 'info',
        message: "Applies once the 5' tail is copied",
      });
    }
    primary.push(byId.gc, byId.length, byId.hairpin, byId.selfDimer);

    const secondary = [byId.gcClamp, byId.threePrimeStability, byId.repeats].filter(Boolean);
    const rows = secondary
      .map(check => {
        const icon = PrimerDetailsPanel.STATUS_ICONS[check.status] || PrimerDetailsPanel.STATUS_ICONS.info;
        return `<div class="primer-check-row quality-${check.status}" data-check="${esc(check.id)}">
          <i class="fas ${icon}"></i>
          <span class="primer-check-label">${esc(check.label)}</span>
          <span class="primer-check-value">${esc(this._formatValue(check))}</span>
          <span class="primer-check-message">${esc(check.message)}</span>
        </div>`;
      })
      .join('');

    const structures = [];
    if (quality.hairpin) {
      structures.push(`<div class="primer-structure-label">Hairpin (${quality.hairpin.deltaG.toFixed(1)} kcal/mol)</div>
        <pre class="primer-structure">5' ${esc(quality.sequence)} 3'\n   ${esc(quality.hairpin.dotBracket)}</pre>`);
    }
    if (quality.selfDimer) {
      structures.push(`<div class="primer-structure-label">Self-dimer (${quality.selfDimer.deltaG.toFixed(1)} kcal/mol)</div>
        <pre class="primer-structure">${esc(quality.selfDimer.alignment.join('\n'))}</pre>`);
    }
    const structuresFlagged = Boolean(quality.hairpin?.flagged || quality.selfDimer?.flagged);

    const overallText = { good: 'Passes', acceptable: 'Acceptable', warning: 'Needs review' }[quality.overall];
    return `
      <div class="primer-properties-section">
        <div class="primer-section-title">
          <i class="fas fa-thermometer-half"></i> Primer QC
          <span class="primer-qc-overall quality-${quality.overall}">${esc(overallText)}</span>
        </div>
        <div class="primer-qc-conditions" title="Reaction conditions used for Tm and ΔG">${esc(quality.conditionsLabel)}</div>
        <div class="primer-props-grid">${primary
          .filter(Boolean)
          .map(check => this._card(check))
          .join('')}</div>
        <div class="primer-check-list">${rows}</div>
        ${
          structures.length
            ? `<details class="primer-structures"${structuresFlagged ? ' open' : ''}>
          <summary>Strongest secondary structures</summary>${structures.join('')}</details>`
            : ''
        }
      </div>`;
  }

  _sequenceHtml(model) {
    if (!model.oligo) return '';
    const tailHtml = model.tailLength ? this._baseSpans(model.tail, [], 'primer-base-tail') : '';
    const annealHtml = this._baseSpans(model.annealing, model.mismatchPositions);
    const phosphate = model.fivePrimePhosphate
      ? '<span class="primer-phosphate-badge primer-phosphate-badge-seq" title="5\' phosphate">5P</span>'
      : '';

    let html = `
      <div class="primer-sequence-section">
        <div class="primer-section-title"><i class="fas fa-dna"></i> Primer Oligo Sequence (5' to 3')</div>
        <div class="primer-sequence-display">${phosphate}${tailHtml}${annealHtml}</div>`;
    if (model.tailLength) {
      html += `<div class="primer-sequence-legend"><span class="primer-legend-swatch primer-base-tail">■</span>
        ${model.tailLength} nt 5' tail (does not anneal) · ${model.annealing.length} nt annealing region</div>`;
    }

    if (model.genomeWindow) {
      const strandNote = model.isReverse ? 'reverse-complemented' : 'forward';
      const pad = model.tailLength
        ? `<span class="primer-sequence-pad" aria-hidden="true">${'·'.repeat(model.tailLength)}</span>`
        : '';
      html += `
        <div class="primer-section-title primer-genome-binding-title"><i class="fas fa-map-pin"></i> Genomic Binding Window (${strandNote})</div>
        <div class="primer-sequence-display primer-genome-sequence">${pad}${this._baseSpans(model.genomeWindow, model.mismatchPositions)}</div>
        <div class="primer-mismatch-summary">${this._mismatchSummary(model)}</div>`;
    }
    html += '</div>';
    return html;
  }

  _mismatchSummary(model) {
    const esc = PrimerDetailsPanel.escapeHtml;
    if (!model.comparable) {
      return 'Annealing region and genome window lengths differ, so base-by-base comparison was skipped.';
    }
    const region = model.tailLength ? 'The annealing region' : 'The primer';
    if (model.mismatchPositions.length === 0) {
      return `${region} matches the loaded genome at this binding window.`;
    }
    const count = model.mismatchPositions.length;
    const positions = model.mismatchPositions.map(index => index + model.tailLength + 1).join(', ');
    let text = `${count} base difference${count === 1 ? '' : 's'} versus the loaded genome at oligo position${
      count === 1 ? '' : 's'
    } ${positions}`;
    if (model.threePrimeMismatches) {
      text += ` (${model.threePrimeMismatches} within 5 nt of the 3' end)`;
    }
    text += '.';
    if (model.siteBinding) {
      text += ` Predicted binding at this site: Tm ${model.siteBinding.tm.toFixed(1)} °C, ΔG ${model.siteBinding.deltaG.toFixed(
        1
      )} kcal/mol.`;
    }
    return esc(text);
  }

  renderHtml(model) {
    const esc = PrimerDetailsPanel.escapeHtml;
    const strand = model.isReverse ? 'Reverse (-)' : 'Forward (+)';
    const strandIcon = model.isReverse ? 'fa-long-arrow-alt-left' : 'fa-long-arrow-alt-right';
    const originBadge = model.origin
      ? `<span class="primer-origin-badge ${esc(model.origin)}">${model.origin === 'pinned' ? 'Pinned site' : 'Predicted site'}</span>`
      : '';

    let html = `
      <div class="primer-identity-card">
        <div class="primer-name">${esc(model.name)}</div>
        <div class="primer-badges">
          <span class="primer-type-badge"><i class="fas fa-vial"></i> primer</span>
          <span class="primer-strand-badge ${model.isReverse ? 'reverse' : 'forward'}">
            <i class="fas ${strandIcon}"></i> ${strand}
          </span>
          ${originBadge}
        </div>
        <div class="primer-position">
          <i class="fas fa-map-marker-alt"></i>
          ${esc(model.chromosome || 'chr')}:${model.start.toLocaleString()}-${model.end.toLocaleString()}
          <span class="primer-length-badge">${model.siteLength} bp</span>
        </div>
      </div>
      <div class="primer-actions">
        <button class="primer-action-btn primer-zoom-btn" title="Zoom to primer region">
          <i class="fas fa-search-plus"></i> Zoom to
        </button>
        <button class="primer-action-btn primer-copy-btn" title="Copy the full oligo (5' to 3')" ${
          model.oligo ? '' : 'disabled'
        }>
          <i class="fas fa-copy"></i> Copy Seq
        </button>
      </div>`;

    html += this._qualityHtml(model);
    html += this._sequenceHtml(model);

    if (model.infoItems.length) {
      html += `<div class="primer-info-section">
        <div class="primer-section-title"><i class="fas fa-info-circle"></i> Additional Information</div>
        ${model.infoItems
          .map(
            item => `<div class="primer-info-row">
            <span class="primer-info-label">${esc(item.label)}</span>
            <span class="primer-info-value">${esc(item.value)}</span>
          </div>`
          )
          .join('')}
      </div>`;
    }

    html += `
      <div class="primer-ai-section">
        <button class="primer-ai-btn primer-analyze-btn">
          <i class="fas fa-robot"></i> Analyze with AI
        </button>
        <button class="primer-ai-btn primer-binding-btn">
          <i class="fas fa-crosshairs"></i> Find Binding Sites
        </button>
      </div>`;
    return html;
  }

  /** Render the panel for `primer` into `container` and wire its buttons. */
  render(container, primer, context = {}) {
    if (!container || !primer) return null;
    const model = this.buildModel(primer, context);
    container.innerHTML = this.renderHtml(model);
    this._bindActions(container, model);
    return model;
  }

  _notify(message, type) {
    this.genomeBrowser?.showNotification?.(message, type);
  }

  _bindActions(container, model) {
    container.querySelector('.primer-zoom-btn')?.addEventListener('click', () => {
      const padding = Math.max(200, model.siteLength * 3);
      const start = Math.max(1, model.start - padding);
      const end = model.end + padding;
      const navigation = this.genomeBrowser?.navigationManager;
      if (!navigation?.navigateToPosition) return;
      const result = navigation.navigateToPosition(model.chromosome, start, end);
      if (result && result.success === false) this._notify(result.error, 'error');
    });

    container.querySelector('.primer-copy-btn')?.addEventListener('click', () => {
      if (!model.oligo) return;
      const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : null;
      if (!clipboard?.writeText) {
        this._notify('Clipboard is not available', 'error');
        return;
      }
      clipboard.writeText(model.oligo).then(
        () => this._notify('Primer sequence copied', 'success'),
        error => this._notify(`Could not copy sequence: ${error?.message || error}`, 'error')
      );
    });

    const chatBox = () => (typeof window !== 'undefined' ? window.chatBox : null);
    container.querySelector('.primer-analyze-btn')?.addEventListener('click', () => {
      const chat = chatBox();
      if (!chat) return;
      chat.setInputText(`Please calculate the properties of this primer sequence: ${model.oligo || model.name}`);
      chat.focusInput();
    });

    container.querySelector('.primer-binding-btn')?.addEventListener('click', () => {
      const chat = chatBox();
      if (!chat) return;
      chat.setInputText(`Find binding sites for primer ${model.name} in the current genome`);
      chat.focusInput();
    });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PrimerDetailsPanel;
}
if (typeof window !== 'undefined') {
  window.PrimerDetailsPanel = PrimerDetailsPanel;
}
