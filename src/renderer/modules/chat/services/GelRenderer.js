/**
 * Displays a simulated gel and its fragment data in the floating results window.
 */
class GelRenderer {
  constructor() {
    this.colorSchemes = {
      ethidium_bromide: { name: 'Ethidium Bromide', rgb: '255, 117, 68' },
      gel_red: { name: 'Gel Red', rgb: '255, 77, 106' },
      sybr_safe: { name: 'SYBR Safe', rgb: '102, 238, 159' },
      methylene_blue: { name: 'Methylene Blue', rgb: '113, 160, 255' },
      uv_default: { name: 'UV Default', rgb: '182, 146, 255' },
    };
    this.statusLabels = {
      in_gel: 'In gel',
      diffuse: 'Diffuse',
      in_well: 'In well',
      at_front: 'At front',
    };
    this.layout = { width: 560, height: 432, left: 70, right: 532, well: 56, start: 74, front: 398 };
    this.pageSize = 40;
    this.number = new Intl.NumberFormat();
  }

  render(result, ladderBands = result.ladderBands) {
    const container = document.getElementById('gelResultsContainer');
    if (!container) return;
    if (this.container !== container) this._bindControls(container);

    this.result = result;
    this.ladderBands = ladderBands ?? [];
    this.selectedSize = null;
    this.page = 0;
    this.descending = true;
    this.sizes = this._groupFragments(result.bands);
    this.sortedSizes = [...this.sizes.values()].sort((a, b) => b.band.size - a.band.size);
    this.plottedBands = this._getPlottedBands();
    this.sampleName = result.laneLabel || 'Digest';
    this.ladderName = result.ladderName || result.ladderType;
    this.fields.sample.textContent = this.sampleName;
    this.fields.agarose.textContent = `${result.gelPercentage}%`;
    this.fields.total.textContent = this.number.format(result.totalFragments);
    this.fields.range.textContent = `${result.gelConfig.effectiveRange.map(size => this.number.format(size)).join('–')} bp`;
    this.fields.filter.value = 'all';
    this.fields['export-status'].hidden = true;
    this.scheme.value = Object.hasOwn(this.colorSchemes, result.bandColorScheme)
      ? result.bandColorScheme
      : 'ethidium_bromide';
    this.fields.ladder.disabled = this.ladderBands.length === 0;
    this.fields.ladder.checked = result.showLadder && !this.fields.ladder.disabled;
    this.fields.ladder.parentElement.title = this.ladderName;

    this._renderTable();
    this._updateImage();
  }

  _bindControls(container) {
    this.container = container;
    this.fields = Object.fromEntries(
      [...container.querySelectorAll('[data-gel]')].map(node => [node.dataset.gel, node])
    );
    this.canvas = container.querySelector('.gel-canvas');
    this.ctx = this.canvas.getContext('2d');
    const { width, height } = this.layout;
    const scale = Math.max(2, Math.min(window.devicePixelRatio || 1, 3));
    this.canvas.width = width * scale;
    this.canvas.height = height * scale;
    this.ctx?.setTransform(this.canvas.width / width, 0, 0, this.canvas.height / height, 0, 0);
    this.canvas.hidden = !this.ctx;
    this.fields['image-controls'].hidden = !this.ctx;

    this.scheme = container.querySelector('#gelColorSchemeSelect');
    this.scheme.replaceChildren(
      ...Object.entries(this.colorSchemes).map(([value, { name }]) => new Option(name, value))
    );
    this.scheme.addEventListener('change', () => this._updateImage());
    this.fields.ladder.addEventListener('change', () => this._updateImage());

    this.fields.sort.addEventListener('click', () => {
      this.descending = !this.descending;
      this.page = 0;
      this._renderTable();
    });
    this.fields.filter.addEventListener('change', () => {
      this._selectSize(null);
      this.page = 0;
      this._renderTable();
    });
    this.fields.previous.addEventListener('click', () => {
      this.page -= 1;
      this._renderTable();
    });
    this.fields.next.addEventListener('click', () => {
      this.page += 1;
      this._renderTable();
    });
    this.fields.rows.addEventListener('click', event => {
      const button = event.target.closest('button[data-size]');
      if (!button) return;
      const size = Number(button.dataset.size);
      this._selectSize(this.selectedSize === size ? null : size);
    });
    this.fields.clear.addEventListener('click', () => {
      const selectedButton = this.fields.rows.querySelector('button[aria-pressed="true"]');
      this._selectSize(null);
      (selectedButton || this.fields.filter).focus();
    });

    this.canvas.addEventListener('pointermove', event => {
      this.canvas.style.cursor = this._bandAtPointer(event) ? 'pointer' : '';
    });
    this.canvas.addEventListener('click', event => this._selectFromImage(event));

    const pngButton = container.querySelector('#exportGelBtn');
    pngButton.disabled = !this.ctx;
    pngButton.addEventListener('click', () => this._exportPNG());
    this.fields.csv.addEventListener('click', () => this._exportCSV());
  }

  _bandStatus(band) {
    if (band.isInWell) return 'in_well';
    if (band.normalizedPosition >= 1) return 'at_front';
    return band.isSmear ? 'diffuse' : 'in_gel';
  }

  _groupFragments(bands) {
    const sizes = new Map();
    for (const band of bands) {
      const existing = sizes.get(band.size);
      if (existing) {
        existing.count += 1;
      } else {
        sizes.set(band.size, { band, count: 1, status: this._bandStatus(band) });
      }
    }
    return sizes;
  }

  _filteredSizes() {
    const filter = this.fields.filter.value;
    const rows = this.sortedSizes.filter(row => filter === 'all' || row.status === filter);
    return this.descending ? rows : rows.reverse();
  }

  _renderTable() {
    const rows = this._filteredSizes();
    const start = this.page * this.pageSize;
    const end = Math.min(start + this.pageSize, rows.length);
    this.fields.rows.replaceChildren(...rows.slice(start, end).map(row => this._buildRow(row)));
    this.fields.empty.hidden = rows.length > 0;
    this.fields.sort.parentElement.setAttribute('aria-sort', this.descending ? 'descending' : 'ascending');
    this.fields.sort.querySelector('span').textContent = this.descending ? '↓' : '↑';
    this.fields.count.textContent = rows.length
      ? `${this.number.format(start + 1)}–${this.number.format(end)} of ${this.number.format(rows.length)} sizes`
      : '0 sizes';
    this.fields.previous.disabled = this.page === 0;
    this.fields.next.disabled = end === rows.length;
    this.fields['table-scroll'].scrollTop = 0;
    this._updateRowSelection();
  }

  _buildRow({ band, count, status }) {
    const row = document.createElement('tr');
    const size = document.createElement('button');
    size.type = 'button';
    size.className = 'gel-size-button';
    size.dataset.size = band.size;
    size.textContent = this.number.format(band.size);
    size.setAttribute('aria-label', `${size.textContent} bp`);
    row.insertCell().appendChild(size);
    row.insertCell().textContent = this.number.format(count);
    row.insertCell().textContent = `${(band.normalizedPosition * 100).toFixed(1)}%`;
    const statusCell = row.insertCell();
    statusCell.dataset.status = status;
    statusCell.textContent = this.statusLabels[status];
    return row;
  }

  _updateRowSelection() {
    for (const button of this.fields.rows.querySelectorAll('button')) {
      const selected = Number(button.dataset.size) === this.selectedSize;
      button.setAttribute('aria-pressed', String(selected));
      button.closest('tr').classList.toggle('is-selected', selected);
    }
  }

  _selectSize(size) {
    this.selectedSize = size;
    this._updateRowSelection();
    this._updateImage();
  }

  _selectFromImage(event) {
    const hit = this._bandAtPointer(event);
    if (!hit || this.selectedSize === hit.band.size) {
      this._selectSize(null);
      return;
    }
    const filter = this.fields.filter;
    if (filter.value !== 'all' && filter.value !== hit.status) filter.value = 'all';
    const index = this._filteredSizes().findIndex(row => row.band.size === hit.band.size);
    this.page = Math.floor(index / this.pageSize);
    this.selectedSize = hit.band.size;
    this._renderTable();
    this._updateImage();
    const button = this.fields.rows.querySelector('[aria-pressed="true"]');
    button?.scrollIntoView({ block: 'nearest' });
  }

  _bandAtPointer(event) {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) * this.layout.width) / rect.width;
    const y = ((event.clientY - rect.top) * this.layout.height) / rect.height;
    if (Math.abs(x - this.sampleLane.x) > this.sampleLane.width / 2 + 8) return null;

    let nearest = null;
    let distance = (7 * this.layout.height) / rect.height;
    for (const row of this.plottedBands.values()) {
      const offset = Math.abs(this._bandY(row.band) - y);
      if (offset < distance) {
        nearest = row;
        distance = offset;
      }
    }
    return nearest;
  }

  _updateImage() {
    const selected = this.sizes.get(this.selectedSize);
    this.fields.clear.hidden = !selected;
    if (selected) {
      const { band, count, status } = selected;
      const fragments = count === 1 ? '1 fragment' : `${this.number.format(count)} fragments`;
      this.fields.detail.textContent = `${this.number.format(band.size)} bp · ${fragments} · ${this.statusLabels[status]}`;
    } else {
      this.fields.detail.textContent = this.ctx
        ? 'Select a band or a size to inspect it.'
        : 'Gel image is unavailable. Fragment data is available in the table.';
    }
    if (this.ctx) this._drawGel(selected);
  }

  _bandY(band) {
    const { start, front } = this.layout;
    return start + band.normalizedPosition * (front - start);
  }

  _drawGel(selected) {
    const { ctx, layout } = this;
    const { width, height, left, right, well, start, front } = layout;
    const showLadder = this.fields.ladder.checked;
    const { rgb } = this.colorSchemes[this.scheme.value];

    ctx.fillStyle = '#0d131e';
    ctx.fillRect(0, 0, width, height);
    const gel = ctx.createLinearGradient(left, well, right, front);
    gel.addColorStop(0, '#171f2f');
    gel.addColorStop(1, '#101725');
    ctx.fillStyle = gel;
    ctx.fillRect(left, well - 8, right - left, front - well + 8);
    ctx.strokeStyle = '#364155';
    ctx.strokeRect(left, well - 8, right - left, front - well + 8);

    const laneWidth = showLadder ? 126 : 182;
    const ladderLane = { x: left + (right - left) * 0.27, width: laneWidth };
    this.sampleLane = { x: left + (right - left) * (showLadder ? 0.72 : 0.5), width: laneWidth };
    if (showLadder) this._drawLadder(ladderLane, rgb);
    this._drawLane(this.sampleLane, this.sampleName);
    this._drawSample(rgb);
    if (selected) this._drawSelection(selected);

    ctx.font = '12px system-ui';
    ctx.fillStyle = '#a8b7cd';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    if (!showLadder) ctx.fillText('Well', left - 10, start - 11);
    ctx.fillText('Front', left - 10, front);
    ctx.fillText(`${this.result.gelPercentage}% agarose`, right, height - 15);
  }

  _drawLane({ x, width }, label) {
    const { ctx, layout } = this;
    ctx.fillStyle = '#0a101a';
    ctx.fillRect(x - width / 2, layout.well, width, 10);
    ctx.strokeStyle = '#404d63';
    ctx.strokeRect(x - width / 2, layout.well, width, 10);

    ctx.fillStyle = '#e2eaf5';
    ctx.font = '600 15px system-ui';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, 26, width + 55);
  }

  _drawLadder(lane, rgb) {
    const { ctx, layout } = this;
    this._drawLane(lane, this.ladderName);
    const visible = this.ladderBands
      .filter(band => !band.isInWell && band.normalizedPosition < 1)
      .sort((a, b) => a.normalizedPosition - b.normalizedPosition);
    let previousLabel = layout.start - 16;
    for (const band of visible) {
      const y = this._bandY(band);
      this._drawBand(lane, y, rgb, 0.75, 3);
      if (y - previousLabel < 17 || y > layout.front - 16) continue;
      previousLabel = y;
      ctx.fillStyle = '#a8b7cd';
      ctx.textAlign = 'right';
      ctx.font = '12px system-ui';
      ctx.fillText(this.number.format(band.size), layout.left - 10, y);
      ctx.fillStyle = '#404d63';
      ctx.fillRect(layout.left, Math.round(y), 12, 1);
    }
    ctx.fillStyle = '#a8b7cd';
    ctx.fillText('bp', layout.left - 10, 26);
  }

  _getPlottedBands() {
    // Collapse bands at indistinguishable display positions to bound drawing work for large digests.
    const plotted = new Map();
    for (const row of this.sizes.values()) {
      const { band, status } = row;
      if (status === 'in_well' || status === 'at_front') continue;
      const pixel = Math.round(this._bandY(band));
      if (!plotted.has(pixel) || plotted.get(pixel).band.intensity < band.intensity) {
        plotted.set(pixel, row);
      }
    }
    return plotted;
  }

  _drawSample(rgb) {
    for (const { band, count } of this.plottedBands.values()) {
      const intensity = Math.min(1, band.intensity * (0.72 + Math.log2(count) * 0.18));
      const height = Math.max(2, band.bandWidth * 10) * (band.isSmear ? 3 : 1);
      this._drawBand(this.sampleLane, this._bandY(band), rgb, intensity, height);
    }
  }

  _drawBand({ x, width }, y, rgb, intensity, height) {
    const { ctx } = this;
    const left = x - width * 0.46;
    const right = x + width * 0.46;
    const gradient = ctx.createLinearGradient(left, y, right, y);
    gradient.addColorStop(0, `rgba(${rgb}, 0.05)`);
    gradient.addColorStop(0.18, `rgba(${rgb}, ${intensity})`);
    gradient.addColorStop(0.82, `rgba(${rgb}, ${intensity})`);
    gradient.addColorStop(1, `rgba(${rgb}, 0.05)`);
    ctx.save();
    ctx.shadowColor = `rgba(${rgb}, ${intensity})`;
    ctx.shadowBlur = 8;
    ctx.fillStyle = gradient;
    ctx.fillRect(left, y - height / 2, right - left, height);
    ctx.restore();
  }

  _drawSelection({ band, status }) {
    const { ctx, layout } = this;
    const { x, width } = this.sampleLane;
    const y = status === 'in_well' ? layout.well + 5 : this._bandY(band);
    ctx.strokeStyle = '#e2eaf5';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - width / 2 - 4, y - 7, width + 8, 14);
    ctx.lineWidth = 1;
  }

  _exportPNG() {
    try {
      this._drawGel();
      this._download(this.canvas.toDataURL('image/png'), 'gel_electrophoresis.png');
    } catch (error) {
      this._showExportError('gel image', error);
    } finally {
      this._updateImage();
    }
  }

  _exportCSV() {
    try {
      const rows = this.result.bands.map(band =>
        [band.index + 1, band.size, (band.normalizedPosition * 100).toFixed(3), this._bandStatus(band)].join(',')
      );
      const csv = ['fragment,size_bp,migration_pct,status', ...rows, ''].join('\r\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      try {
        this._download(url, 'gel_fragments.csv');
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (error) {
      this._showExportError('fragment data', error);
    }
  }

  _download(url, filename) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    try {
      link.click();
      this.fields['export-status'].hidden = true;
    } finally {
      link.remove();
    }
  }

  _showExportError(label, error) {
    console.error(`GelRenderer: Failed to export ${label}`, error);
    const status = this.fields['export-status'];
    status.textContent = `Could not export ${label}.`;
    status.hidden = false;
  }
}

if (typeof window !== 'undefined') {
  window.GelRenderer = GelRenderer;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GelRenderer;
}
