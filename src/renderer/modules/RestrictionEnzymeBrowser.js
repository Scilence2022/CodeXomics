/**
 * Read-only browser for the catalog shared with the restriction digest tools.
 */
class RestrictionEnzymeBrowser {
  static endLabels = {
    "5'_overhang": '5′ overhang',
    "3'_overhang": '3′ overhang',
    blunt: 'Blunt',
    nick: 'Single-strand nick',
  };

  static catalogSets = {
    commercial: enzyme => enzyme.commercial,
    nonredundant: enzyme => enzyme.commercial,
    long: enzyme => !enzyme.nicking && enzyme.recognitionLength >= 6,
    outside: enzyme => !enzyme.nicking && enzyme.cutsOutsideSite,
    typeIIs: enzyme => enzyme.isotype === 'typeIIs',
    nicking: enzyme => enzyme.nicking,
  };

  constructor() {
    this.enzymes = [];
    this.matches = [];
    this.copyRequest = 0;
    this.createDialog();
  }

  createDialog() {
    this.dialog = document.createElement('dialog');
    this.dialog.id = 'enzymeBrowserModal';
    this.dialog.className = 'modal floating-tool-window';
    this.dialog.setAttribute('aria-labelledby', 'enzymeBrowserTitle');
    this.dialog.innerHTML = `
      <div class="modal-content">
        <header class="modal-header">
          <h3 id="enzymeBrowserTitle"><i class="fas fa-cut" aria-hidden="true"></i> Restriction Enzyme Browser</h3>
          <button type="button" class="modal-close" aria-label="Close enzyme browser">&times;</button>
        </header>
        <div class="enzyme-browser-workspace">
          <div class="enzyme-browser-filters" role="group" aria-label="Filter enzymes">
            <label class="enzyme-browser-search">
              Search enzymes
              <span>
                <i class="fas fa-search" aria-hidden="true"></i>
                <input id="enzymeBrowserSearch" data-field="search" type="search"
                  placeholder="Name, alias, or recognition sequence" spellcheck="false" autofocus>
              </span>
            </label>
            <label>End type
              <select data-field="end"><option value="">All ends</option></select>
            </label>
            <label>Site length
              <select data-field="length"><option value="">Any length</option></select>
            </label>
            <label>Enzyme set
              <select data-field="set">
                <option value="">All enzymes</option>
                <option value="commercial">Commercial listings</option>
                <option value="nonredundant">Nonredundant commercial</option>
                <option value="long">6+ bp cutters</option>
                <option value="outside">Outside-site cutters</option>
                <option value="typeIIs">Type IIS (verified)</option>
                <option value="nicking">Nicking enzymes</option>
              </select>
            </label>
            <label>Supplier
              <select data-field="supplier"><option value="">All suppliers</option></select>
            </label>
          </div>
          <div class="enzyme-browser-layout">
            <section class="enzyme-browser-catalog" aria-label="Enzyme catalog">
              <div class="enzyme-browser-result-bar">
                <p data-field="count" role="status"></p>
                <button type="button" class="btn enzyme-browser-button" data-action="clear">Clear filters</button>
              </div>
              <div id="enzymeBrowserResults" role="radiogroup" aria-label="Matching enzymes"></div>
              <p class="enzyme-browser-empty" hidden></p>
            </section>
            <section class="enzyme-browser-detail" aria-label="Enzyme details" hidden>
              <div class="enzyme-browser-identity">
                <p data-field="typeLabel"></p>
                <h4 data-field="name"></h4>
              </div>
              <dl class="enzyme-browser-metrics">
                <div><dt>Recognition sequence</dt><dd><code data-field="recognition"></code></dd></div>
                <div><dt>Site length</dt><dd data-field="lengthLabel"></dd></div>
                <div><dt>Cleavage end</dt><dd data-field="endLabel"></dd></div>
              </dl>
              <figure class="enzyme-browser-cleavage" aria-labelledby="enzymeBrowserCleavageTitle">
                <figcaption>
                  <strong id="enzymeBrowserCleavageTitle">Cleavage pattern</strong>
                  <button type="button" class="btn enzyme-browser-button" data-action="copy">
                    <i class="far fa-copy" aria-hidden="true"></i> Copy sequence
                  </button>
                </figcaption>
                <div class="enzyme-browser-strands" aria-hidden="true"></div>
                <div class="enzyme-browser-offsets">
                  <dl>
                    <div><dt>Top strand offset</dt><dd data-field="topCut"></dd></div>
                    <div><dt>Bottom strand offset</dt><dd data-field="bottomCut"></dd></div>
                  </dl>
                  <p data-field="offsetHint"></p>
                </div>
              </figure>
              <p class="enzyme-browser-copy-status" role="status"></p>
              <dl class="enzyme-browser-catalog-details">
                <div><dt>Listed suppliers</dt><dd data-field="suppliers"></dd></div>
                <div><dt>Data source</dt><dd data-field="source"></dd></div>
                <div data-field="aliasesRow"><dt>Lookup aliases</dt><dd data-field="aliases"></dd></div>
              </dl>
              <section class="enzyme-browser-related" aria-labelledby="enzymeBrowserRelatedTitle" hidden>
                <h5 id="enzymeBrowserRelatedTitle">Same recognition sequence</h5>
                <ul></ul>
              </section>
            </section>
          </div>
        </div>
      </div>
    `;
    document.body.append(this.dialog);

    this.fields = Object.fromEntries(
      Array.from(this.dialog.querySelectorAll('[data-field]'), element => [element.dataset.field, element])
    );
    this.results = this.dialog.querySelector('#enzymeBrowserResults');
    this.empty = this.dialog.querySelector('.enzyme-browser-empty');
    this.detail = this.dialog.querySelector('.enzyme-browser-detail');
    this.strands = this.dialog.querySelector('.enzyme-browser-strands');
    this.related = this.dialog.querySelector('.enzyme-browser-related');
    this.relatedList = this.related.querySelector('ul');
    this.copyStatus = this.dialog.querySelector('.enzyme-browser-copy-status');
    this.clearButton = this.dialog.querySelector('[data-action="clear"]');

    const filters = this.dialog.querySelector('.enzyme-browser-filters');
    this.fields.search.addEventListener('input', () => this.renderResults());
    filters.addEventListener('change', event => {
      if (event.target.matches('select')) this.renderResults();
    });
    this.clearButton.addEventListener('click', () => {
      this.clearFilters();
      this.renderResults();
      this.fields.search.focus();
    });
    this.results.addEventListener('change', event => {
      this.renderDetails(this.matches.find(enzyme => enzyme.name === event.target.value));
    });
    this.relatedList.addEventListener('click', event => {
      const button = event.target.closest('button[data-enzyme]');
      if (button) this.showRelatedEnzyme(button.dataset.enzyme);
    });
    this.dialog.querySelector('[data-action="copy"]').addEventListener('click', () => this.copyRecognition());
    this.dialog.querySelector('.modal-close').addEventListener('click', () => this.dialog.close());
    this.dialog.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || event.isComposing || event.defaultPrevented) return;
      event.preventDefault();
      event.stopPropagation();
      this.dialog.close();
    });
    this.dialog.addEventListener('close', () => {
      if (this.dialog.open) return;
      this.dialog.classList.remove('show', 'is-front');
      this.clearCopyStatus();
    });

    for (const [value, label] of Object.entries(RestrictionEnzymeBrowser.endLabels)) {
      this.fields.end.add(new Option(label, value));
    }
  }

  open(database) {
    if (this.dialog.open) {
      window.modalDragManager?.raiseFloatingWindow(this.dialog);
      this.fields.search.focus();
      return;
    }

    const catalog = database ?? this.database ?? this.getBundledDatabase();
    if (catalog !== this.database) {
      this.database = catalog;
      const collator = new Intl.Collator(undefined, { numeric: true });
      this.enzymes = (catalog?.getAll() ?? []).sort((a, b) => collator.compare(a.name, b.name));
      const lengths = [...new Set(this.enzymes.map(enzyme => enzyme.recognitionLength))].sort((a, b) => a - b);
      const previousLength = this.fields.length.value;
      this.fields.length.replaceChildren(
        new Option('Any length', ''),
        ...lengths.map(length => new Option(`${length} bp`, String(length)))
      );
      this.fields.length.value = lengths.includes(Number(previousLength)) ? previousLength : '';

      const selectedSupplier = this.fields.supplier.value;
      const suppliers = Object.entries(catalog?.supplierNames ?? {}).sort((a, b) => collator.compare(a[1], b[1]));
      this.fields.supplier.replaceChildren(
        new Option('All suppliers', ''),
        ...suppliers.map(([code, name]) => new Option(name, code))
      );
      this.fields.supplier.value = Object.hasOwn(catalog?.supplierNames ?? {}, selectedSupplier)
        ? selectedSupplier
        : '';
    }
    const dragManager = window.modalDragManager;
    if (!this.dialog.querySelector('.draggable-handle')) dragManager?.makeDraggable('#enzymeBrowserModal');
    dragManager?.resetPosition('#enzymeBrowserModal');
    this.clearCopyStatus();
    this.renderResults();
    this.dialog.classList.add('show');
    this.dialog.show();
    dragManager?.raiseFloatingWindow(this.dialog);
    this.fields.search.focus();
    this.revealSelection();
  }

  getBundledDatabase() {
    const Database = window.RestrictionEnzymeDatabase;
    return Database ? new Database() : undefined;
  }

  clearFilters() {
    const { search, end, length, set, supplier } = this.fields;
    search.value = end.value = length.value = set.value = supplier.value = '';
  }

  renderResults(preferredName = this.selected?.name) {
    const { search, end, length, set, supplier, count } = this.fields;
    const terms = search.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const inSet = RestrictionEnzymeBrowser.catalogSets[set.value];
    this.matches = this.enzymes.filter(enzyme => {
      if (end.value && enzyme.overhangType !== end.value) return false;
      if (length.value && enzyme.recognitionLength !== Number(length.value)) return false;
      if (inSet && !inSet(enzyme)) return false;
      if (supplier.value && !enzyme.supplierCodes.includes(supplier.value)) return false;
      const searchable = [enzyme.name, enzyme.recognition, ...enzyme.aliases].map(value => value.toLowerCase());
      return terms.every(term => searchable.some(value => value.includes(term)));
    });

    if (set.value === 'nonredundant') {
      const unique = new Map();
      for (const enzyme of this.matches) {
        if (!unique.has(enzyme.cleavageKey) || enzyme.name === preferredName) unique.set(enzyme.cleavageKey, enzyme);
      }
      this.matches = [...unique.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    }

    this.clearButton.disabled = !search.value && !end.value && !length.value && !set.value && !supplier.value;
    count.textContent = `${this.matches.length} of ${this.enzymes.length} enzymes`;
    this.results.hidden = this.matches.length === 0;
    this.empty.hidden = this.matches.length > 0;
    this.empty.textContent = this.enzymes.length
      ? 'No enzymes match these filters.'
      : 'The enzyme catalog is unavailable.';

    const selected = this.matches.find(enzyme => enzyme.name === preferredName) ?? this.matches[0];
    this.results.replaceChildren(...this.matches.map(enzyme => this.createRow(enzyme, enzyme === selected)));
    this.results.scrollTop = 0;
    this.renderDetails(selected);
    if (this.dialog.open) this.revealSelection();
  }

  createRow(enzyme, checked) {
    const row = document.createElement('label');
    row.className = 'enzyme-browser-row';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'enzyme-browser-choice';
    radio.value = enzyme.name;
    radio.checked = checked;

    const name = document.createElement('strong');
    name.textContent = enzyme.name;
    const end = document.createElement('span');
    end.className = 'enzyme-browser-row-end';
    end.textContent = RestrictionEnzymeBrowser.endLabels[enzyme.overhangType];
    const recognition = document.createElement('code');
    recognition.textContent = enzyme.recognition;
    row.append(radio, name, end, recognition);
    return row;
  }

  renderDetails(enzyme) {
    if (this.selected === enzyme) return;
    this.selected = enzyme;
    this.detail.hidden = !enzyme;
    this.clearCopyStatus();
    if (!enzyme) return;

    this.detail.scrollTop = 0;
    const fields = this.fields;
    fields.name.textContent = enzyme.name;
    fields.typeLabel.textContent = enzyme.nicking
      ? 'Nicking enzyme · Catalog only'
      : enzyme.isotype === 'typeIIs'
        ? 'Type IIS'
        : 'Double-strand cutter';
    fields.recognition.textContent = enzyme.recognition;
    fields.lengthLabel.textContent = `${enzyme.recognitionLength} bp`;
    const endLabel = RestrictionEnzymeBrowser.endLabels[enzyme.overhangType];
    fields.endLabel.textContent = enzyme.overhangLength ? `${endLabel} · ${enzyme.overhangLength} nt` : endLabel;
    fields.topCut.textContent = enzyme.topCut === null ? 'No cut' : `${enzyme.topCut} nt`;
    fields.bottomCut.textContent = enzyme.bottomCut === null ? 'No cut' : `${enzyme.bottomCut} nt`;
    fields.suppliers.textContent = enzyme.suppliers.join(', ') || 'No supplier listed in the source';
    fields.source.textContent = enzyme.rebaseId
      ? `REBASE EMBOSS 404 (2024) · REBASE ID ${enzyme.rebaseId}`
      : 'New England Biolabs recognition sequence reference';
    fields.aliasesRow.hidden = enzyme.aliases.length === 0;
    fields.aliases.textContent = enzyme.aliases.join(', ');

    this.renderCleavage(enzyme);
    this.renderRelated(enzyme);
  }

  renderCleavage(enzyme) {
    const { recognition, topCut, bottomCut } = enzyme;
    const start = Math.min(0, topCut, bottomCut);
    const end = Math.max(recognition.length, topCut, bottomCut);
    const complementary = Array.from(this.database.reverseComplementIUPAC(recognition)).reverse().join('');
    this.strands.replaceChildren(
      this.createStrand(recognition, start, end, topCut, '5′', '3′'),
      this.createStrand(complementary, start, end, bottomCut, '3′', '5′')
    );

    const hasFlanks = start < 0 || end > recognition.length;
    this.fields.offsetHint.textContent =
      'Catalog offsets are measured from the 5′ end of the top recognition strand.' +
      (hasFlanks ? ' Dots indicate flanking bases.' : '');
  }

  createStrand(sequence, start, end, cut, leftLabel, rightLabel) {
    const row = document.createElement('div');
    row.className = 'enzyme-browser-strand';
    const left = document.createElement('span');
    left.textContent = leftLabel;
    const bases = document.createElement('code');
    const right = document.createElement('span');
    right.textContent = rightLabel;

    for (let position = start; position < end; position++) {
      const base = document.createElement('span');
      base.className = sequence[position] ? 'enzyme-browser-base' : 'enzyme-browser-flank';
      base.textContent = sequence[position] ?? '·';
      bases.append(base);
    }
    if (cut !== null) {
      const marker = document.createElement('i');
      marker.className = 'enzyme-browser-cut';
      bases.insertBefore(marker, bases.children[cut - start] ?? null);
    }

    row.append(left, bases, right);
    return row;
  }

  renderRelated(enzyme) {
    const related = this.enzymes.filter(entry => entry !== enzyme && entry.recognitionKey === enzyme.recognitionKey);
    this.related.hidden = related.length === 0;
    this.relatedList.replaceChildren(
      ...related.map(entry => {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn enzyme-browser-button';
        button.dataset.enzyme = entry.name;
        button.textContent = entry.name;
        if (entry.cleavageKey !== enzyme.cleavageKey) {
          button.textContent += ' · different cut';
        }
        item.append(button);
        return item;
      })
    );
  }

  showRelatedEnzyme(name) {
    if (!this.matches.some(enzyme => enzyme.name === name)) {
      this.clearFilters();
      this.renderResults(name);
    }
    const radio = Array.from(this.results.querySelectorAll('input')).find(input => input.value === name);
    radio.click();
    radio.focus({ preventScroll: true });
    this.revealSelection();
  }

  revealSelection() {
    this.results.querySelector(':checked')?.closest('label').scrollIntoView({ block: 'nearest', container: 'nearest' });
  }

  clearCopyStatus() {
    this.copyRequest++;
    this.copyStatus.textContent = '';
  }

  async copyRecognition() {
    const recognition = this.selected?.recognition;
    if (!recognition) return;
    const request = ++this.copyRequest;
    let message;
    try {
      await navigator.clipboard.writeText(recognition);
      message = 'Recognition sequence copied.';
    } catch {
      message = 'Could not copy the recognition sequence.';
    }
    if (this.dialog.open && request === this.copyRequest) this.copyStatus.textContent = message;
  }
}

if (typeof window !== 'undefined') {
  window.RestrictionEnzymeBrowser = RestrictionEnzymeBrowser;
}
