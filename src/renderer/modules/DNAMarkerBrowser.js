/**
 * Browse the same ladder catalog used by the virtual gel tool.
 */
class DNAMarkerBrowser {
  static categories = {
    ladder: 'DNA ladder',
    digest_marker: 'Digest marker',
  };

  static ticks = [20_000, 10_000, 5_000, 2_000, 1_000, 500, 200, 100, 50];

  constructor() {
    this.format = new Intl.NumberFormat();
    this.selectedId = '';
    this.copyRequest = 0;
    this.createDialog();
  }

  createDialog() {
    this.dialog = document.createElement('dialog');
    this.dialog.id = 'dnaMarkerBrowserModal';
    this.dialog.className = 'modal floating-tool-window';
    this.dialog.setAttribute('aria-labelledby', 'dnaMarkerBrowserTitle');
    this.dialog.innerHTML = `
      <div class="modal-content">
        <header class="modal-header">
          <h3 id="dnaMarkerBrowserTitle"><i class="fas fa-dna" aria-hidden="true"></i> DNA Marker / Ladder Browser</h3>
          <button type="button" class="modal-close" aria-label="Close marker browser">&times;</button>
        </header>
        <div class="marker-browser-layout">
          <section class="marker-browser-catalog" aria-label="Marker catalog">
            <div class="marker-browser-filters">
              <label for="dnaMarkerBrowserSearch">Search markers</label>
              <input id="dnaMarkerBrowserSearch" type="search" placeholder="Name, brand, tag, or ID" autofocus>
              <div class="marker-browser-fields">
                <label>Brand <select data-field="brand"><option value="">All brands</option></select></label>
                <label>Type
                  <select data-field="category">
                    <option value="">All types</option>
                    <option value="ladder">DNA ladder</option>
                    <option value="digest_marker">Digest marker</option>
                  </select>
                </label>
              </div>
              <fieldset>
                <legend>Cover fragment range (bp)</legend>
                <div class="marker-browser-fields">
                  <input data-field="min" type="number" min="1" step="1" placeholder="From"
                    aria-label="From (bp)" aria-describedby="dnaMarkerRangeError">
                  <input data-field="max" type="number" min="1" step="1" placeholder="To"
                    aria-label="To (bp)" aria-describedby="dnaMarkerRangeError">
                </div>
                <p id="dnaMarkerRangeError" class="marker-browser-error" aria-live="polite"></p>
              </fieldset>
            </div>
            <div class="marker-browser-result-bar">
              <p data-field="count" role="status"></p>
              <button type="button" class="btn marker-browser-button" data-action="clear">Clear filters</button>
            </div>
            <div class="marker-browser-results" role="radiogroup" aria-label="Matching markers"></div>
            <p class="marker-browser-empty" hidden></p>
          </section>
          <section class="marker-browser-detail" aria-label="Marker details" hidden>
            <div class="marker-browser-selection">
              <div class="marker-browser-identity">
                <p data-field="summary"></p>
                <h4 data-field="name"></h4>
              </div>
              <label class="marker-browser-compare">Compare with
                <select data-field="compare"></select>
              </label>
            </div>
            <div class="marker-browser-profile">
              <figure class="marker-browser-figure">
                <figcaption>
                  <strong>Band profile</strong>
                  <span>Log scale (bp) · schematic</span>
                </figcaption>
                <div class="marker-browser-chart" aria-hidden="true"></div>
                <p class="marker-browser-shared-bands" hidden></p>
              </figure>
              <div class="marker-browser-band-details"></div>
            </div>
            <p class="marker-browser-copy-status" role="status"></p>
          </section>
        </div>
      </div>
    `;
    document.body.append(this.dialog);

    this.fields = Object.fromEntries(
      Array.from(this.dialog.querySelectorAll('[data-field]'), el => [el.dataset.field, el])
    );
    this.fields.search = this.dialog.querySelector('#dnaMarkerBrowserSearch');
    this.results = this.dialog.querySelector('.marker-browser-results');
    this.empty = this.dialog.querySelector('.marker-browser-empty');
    this.detail = this.dialog.querySelector('.marker-browser-detail');
    this.chart = this.dialog.querySelector('.marker-browser-chart');
    this.sharedBands = this.dialog.querySelector('.marker-browser-shared-bands');
    this.bandDetails = this.dialog.querySelector('.marker-browser-band-details');
    this.rangeError = this.dialog.querySelector('#dnaMarkerRangeError');
    this.copyStatus = this.dialog.querySelector('.marker-browser-copy-status');
    this.clearButton = this.dialog.querySelector('[data-action="clear"]');

    const filters = this.dialog.querySelector('.marker-browser-filters');
    filters.addEventListener('input', () => this.renderResults());
    this.clearButton.addEventListener('click', () => {
      const { search, brand, category, min, max } = this.fields;
      search.value = brand.value = category.value = min.value = max.value = '';
      search.focus();
      this.renderResults();
    });
    this.results.addEventListener('change', event => this.selectMarker(event.target.value));
    this.fields.compare.addEventListener('change', () => this.renderDetails());
    this.bandDetails.addEventListener('click', event => {
      const action = event.target.closest('button[data-copy]');
      if (action) this.copyMarkerValue(action);
    });
    this.dialog.querySelector('.modal-close').addEventListener('click', () => this.dialog.close());
    this.dialog.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.stopPropagation();
        this.dialog.close();
      }
    });
    this.dialog.addEventListener('close', () => {
      if (this.dialog.open) return;
      this.dialog.classList.remove('show');
      this.copyRequest++;
      this.copyStatus.textContent = '';
    });
  }

  open(database) {
    if (this.dialog.open) {
      this.fields.search.focus();
      return;
    }

    if (!this.database) {
      this.database = database ?? (window.DNAMarkerDatabase && new window.DNAMarkerDatabase());
      this.markers = this.database?.getAll() ?? [];
      const brands = this.database?.getBrands().sort((a, b) => a.localeCompare(b)) ?? [];
      this.fields.brand.append(...brands.map(brand => new Option(brand, brand)));
      const sizes = this.markers.flatMap(marker => marker.sizes);
      this.chartMax = Math.max(DNAMarkerBrowser.ticks[0], ...sizes);
      this.chartMin = Math.min(DNAMarkerBrowser.ticks.at(-1), ...sizes);
    }

    window.modalDragManager?.makeDraggable('#dnaMarkerBrowserModal');
    window.modalDragManager?.resetPosition('#dnaMarkerBrowserModal');
    this.renderResults();
    this.dialog.classList.add('show');
    this.dialog.show();
    window.modalDragManager?.raiseFloatingWindow(this.dialog);
  }

  static searchTerms(text) {
    return text
      .toLowerCase()
      .replace(/[_/-]+/g, ' ')
      .replace(/(\d)\s+(?=(?:bp|kb)\b)/g, '$1')
      .trim();
  }

  getFragmentRange() {
    const { min, max } = this.fields;
    const invalidNumber = input => !input.validity.valid || (input.value && !Number.isSafeInteger(input.valueAsNumber));
    const invalidMin = invalidNumber(min);
    const invalidMax = invalidNumber(max);
    const lower = min.valueAsNumber || max.valueAsNumber;
    const upper = max.valueAsNumber || min.valueAsNumber;
    const reversed = lower > upper;
    min.setAttribute('aria-invalid', Boolean(invalidMin || reversed));
    max.setAttribute('aria-invalid', Boolean(invalidMax || reversed));

    let message = '';
    if (invalidMin || invalidMax) message = 'Enter positive whole numbers in bp.';
    else if (reversed) message = 'From must be less than or equal to To.';
    this.rangeError.textContent = message;
    return { lower, upper, invalid: Boolean(message) };
  }

  renderResults() {
    const { search, brand, category, count } = this.fields;
    const range = this.getFragmentRange();
    const terms = DNAMarkerBrowser.searchTerms(search.value).split(/\s+/).filter(Boolean);
    const matches = range.invalid
      ? []
      : this.markers.filter(marker => {
          if (brand.value && marker.brand !== brand.value) return false;
          if (category.value && marker.category !== category.value) return false;
          if (range.lower && (marker.sizeRange[0] > range.lower || marker.sizeRange[1] < range.upper)) return false;
          const searchable = DNAMarkerBrowser.searchTerms(
            [marker.name, marker.id, marker.brand, ...marker.tags].join(' ')
          );
          return terms.every(term => searchable.includes(term));
        });

    this.clearButton.disabled = !search.value && !brand.value && !category.value && !range.lower && !range.invalid;
    count.textContent = range.invalid ? 'Check fragment range' : `${matches.length} of ${this.markers.length} markers`;
    this.empty.hidden = range.invalid || matches.length > 0;
    this.empty.textContent = this.markers.length
      ? 'No markers match these filters.'
      : 'The marker catalog is unavailable.';
    this.results.hidden = matches.length === 0;
    this.detail.hidden = matches.length === 0;

    const selected = matches.find(marker => marker.id === this.selectedId) ?? matches[0];
    const rows = matches.map(marker => this.createResultRow(marker, marker === selected));
    this.results.replaceChildren(...rows);
    if (selected) this.selectMarker(selected.id);
  }

  createResultRow(marker, checked) {
    const row = document.createElement('label');
    row.className = 'marker-browser-row';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'dna-marker-choice';
    radio.value = marker.id;
    radio.checked = checked;
    const title = document.createElement('strong');
    title.textContent = marker.name;
    const meta = document.createElement('span');
    meta.textContent = `${marker.brand} · ${this.formatRange(marker.sizeRange)}`;
    row.append(radio, title, meta);
    return row;
  }

  selectMarker(id) {
    const compare = this.fields.compare;
    const comparisonId = compare.value === id ? this.selectedId : compare.value;
    this.selectedId = id;
    const options = this.markers
      .filter(marker => marker.id !== id)
      .map(marker => new Option(`${marker.name} · ${marker.brand}`, marker.id));
    compare.replaceChildren(new Option('No comparison', ''), ...options);
    compare.value = this.database?.has(comparisonId) ? comparisonId : '';
    this.renderDetails();
  }

  renderDetails() {
    const primary = this.database.get(this.selectedId);
    const comparison = this.database.get(this.fields.compare.value);
    const markers = comparison ? [primary, comparison] : [primary];
    this.fields.name.textContent = primary.name;
    this.fields.summary.textContent = `${primary.brand} · ${DNAMarkerBrowser.categories[primary.category]}`;
    this.copyRequest++;
    this.copyStatus.textContent = '';

    this.sharedBands.hidden = !comparison;
    if (comparison) {
      const sizes = primary.sizes.filter(size => comparison.sizes.includes(size)).sort((a, b) => b - a);
      this.sharedBands.textContent = sizes.length
        ? `Shared sizes (bp) · ${sizes.map(size => this.format.format(size)).join(' · ')}`
        : 'No shared band sizes';
    }

    this.renderChart(markers);
    this.bandDetails.replaceChildren(
      ...markers.map((marker, index) => this.createBandDetails(marker, index, markers.length > 1))
    );
  }

  formatRange([min, max]) {
    return `${this.format.format(min)}–${this.format.format(max)} bp`;
  }

  sizePosition(size) {
    return (100 * Math.log10(this.chartMax / size)) / Math.log10(this.chartMax / this.chartMin);
  }

  renderChart(markers) {
    const plot = document.createElement('div');
    plot.className = 'marker-browser-plot';
    this.chart.classList.toggle('is-comparing', markers.length > 1);
    for (const size of DNAMarkerBrowser.ticks) {
      const tick = document.createElement('div');
      tick.className = 'marker-browser-tick';
      tick.style.top = `${this.sizePosition(size)}%`;
      const label = document.createElement('span');
      label.textContent = this.format.format(size);
      tick.append(label);
      plot.append(tick);
    }
    for (const [index, marker] of markers.entries()) {
      const lane = document.createElement('div');
      lane.className = 'marker-browser-lane';
      if (markers.length > 1) {
        const label = document.createElement('span');
        label.className = 'marker-browser-lane-label';
        label.textContent = ['A', 'B'][index];
        lane.append(label);
      }
      for (const size of marker.sizes) {
        const band = document.createElement('div');
        band.className = 'marker-browser-band';
        band.style.top = `${this.sizePosition(size)}%`;
        band.title = `${this.format.format(size)} bp`;
        lane.append(band);
      }
      plot.append(lane);
    }
    this.chart.replaceChildren(plot);
  }

  createBandDetails(marker, index, comparing) {
    const sizes = [...marker.sizes].sort((a, b) => b - a);
    const section = document.createElement('section');
    section.className = 'marker-browser-band-card';

    const heading = document.createElement('h5');
    heading.textContent = comparing ? `${['A', 'B'][index]} · ${marker.name}` : 'Band sizes';
    const metrics = document.createElement('p');
    metrics.className = 'marker-browser-metrics';
    metrics.textContent = `${sizes.length} bands · ${this.formatRange(marker.sizeRange)}`;

    const bands = document.createElement('ul');
    bands.className = 'marker-browser-band-list';
    bands.setAttribute('aria-label', 'Band sizes in base pairs');
    bands.replaceChildren(
      ...sizes.map(size => {
        const item = document.createElement('li');
        item.textContent = this.format.format(size);
        return item;
      })
    );

    const metadata = document.createElement('div');
    metadata.className = 'marker-browser-band-meta';
    const agarose = document.createElement('span');
    const [low, high] = marker.recommendedGel.map(value => value.toFixed(1));
    agarose.textContent = `Catalog agarose range ${low}–${high}%`;
    const id = document.createElement('code');
    id.textContent = marker.id;
    metadata.append(agarose, id);

    const actions = document.createElement('div');
    actions.className = 'marker-browser-actions';
    for (const [kind, label] of [
      ['id', 'Copy ID'],
      ['sizes', 'Copy band sizes'],
    ]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn marker-browser-button';
      button.dataset.copy = kind;
      button.dataset.marker = marker.id;
      button.textContent = label;
      button.setAttribute('aria-label', `${label} for ${marker.name}`);
      actions.append(button);
    }

    section.append(heading, metrics, bands, metadata, actions);
    return section;
  }

  async copyMarkerValue(button) {
    const marker = this.database.get(button.dataset.marker);
    const copyId = button.dataset.copy === 'id';
    const value = copyId ? marker.id : [...marker.sizes].sort((a, b) => b - a).join(', ');
    const request = ++this.copyRequest;
    let message;
    try {
      await navigator.clipboard.writeText(value);
      message = copyId ? 'Marker ID copied.' : 'Band sizes copied in bp.';
    } catch (error) {
      console.warn('Could not copy marker details:', error);
      message = 'Could not copy to the clipboard.';
    }
    if (request === this.copyRequest && this.dialog.open) this.copyStatus.textContent = message;
  }
}

window.DNAMarkerBrowser = DNAMarkerBrowser;
