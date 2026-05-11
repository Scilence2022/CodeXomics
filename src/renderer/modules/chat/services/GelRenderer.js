/**
 * GelRenderer - Canvas-based agarose gel electrophoresis visualization
 * Renders realistic gel images with wells, DNA bands, ladder lanes,
 * and size annotations on an HTML5 Canvas element.
 *
 * Color schemes: ethidium_bromide (classic orange/red), gel_red (red),
 * sybr_safe (green), methylene_blue (blue), uv_default (violet)
 */
class GelRenderer {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.dpr = window.devicePixelRatio || 1;
    this._currentResult = null;
    this._currentScheme = 'ethidium_bromide';

    this.colorSchemes = {
      ethidium_bromide: {
        name: 'Ethidium Bromide',
        bandColor: 'rgba(220, 60, 30, 0.88)',
        bandSmearColor: 'rgba(220, 60, 30, 0.25)',
        ladderColor: 'rgba(255, 120, 80, 0.7)',
        bandGradientEdge: [220, 60, 30],
        bandGradientMid: [240, 80, 40],
        smearRGB: [220, 60, 30],
      },
      gel_red: {
        name: 'Gel Red',
        bandColor: 'rgba(255, 40, 40, 0.88)',
        bandSmearColor: 'rgba(255, 40, 40, 0.25)',
        ladderColor: 'rgba(255, 100, 100, 0.7)',
        bandGradientEdge: [255, 40, 40],
        bandGradientMid: [255, 70, 50],
        smearRGB: [255, 40, 40],
      },
      sybr_safe: {
        name: 'SYBR Safe',
        bandColor: 'rgba(40, 200, 80, 0.88)',
        bandSmearColor: 'rgba(40, 200, 80, 0.25)',
        ladderColor: 'rgba(100, 220, 130, 0.7)',
        bandGradientEdge: [40, 200, 80],
        bandGradientMid: [60, 220, 100],
        smearRGB: [40, 200, 80],
      },
      methylene_blue: {
        name: 'Methylene Blue',
        bandColor: 'rgba(40, 80, 220, 0.88)',
        bandSmearColor: 'rgba(40, 80, 220, 0.25)',
        ladderColor: 'rgba(100, 130, 255, 0.7)',
        bandGradientEdge: [40, 80, 220],
        bandGradientMid: [60, 100, 240],
        smearRGB: [40, 80, 220],
      },
      uv_default: {
        name: 'UV Default',
        bandColor: 'rgba(80, 40, 180, 0.85)',
        bandSmearColor: 'rgba(80, 40, 180, 0.3)',
        ladderColor: 'rgba(180, 140, 255, 0.7)',
        bandGradientEdge: [80, 40, 180],
        bandGradientMid: [90, 50, 200],
        smearRGB: [80, 40, 180],
      },
    };

    this.layout = {
      canvasWidth: 600,
      canvasHeight: 700,
      gelLeft: 80,
      gelRight: 520,
      gelTop: 60,
      gelBottom: 620,
      wellWidth: 10,
      wellDepth: 12,
      laneSpacing: 4,
      ladderLaneWidth: 60,
      gelBgColor: '#0a0a1a',
      gelBorderColor: '#333355',
      wellColor: '#050510',
      labelColor: '#ffffff',
      sizeLabelColor: '#aaccff',
      scaleLabelColor: '#aaccff',
      canvasBgColor: '#12121a',
    };
  }

  render(result) {
    const modal = document.getElementById('gelElectrophoresisModal');
    if (!modal) {
      console.warn('GelRenderer: gelElectrophoresisModal not found in DOM');
      return;
    }

    const container = document.getElementById('gelResultsContainer');
    if (!container) {
      console.warn('GelRenderer: gelResultsContainer not found in DOM');
      return;
    }

    this._currentResult = result;
    if (result.bandColorScheme && this.colorSchemes[result.bandColorScheme]) {
      this._currentScheme = result.bandColorScheme;
    }
    container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'gel-visualization-wrapper';

    const infoPanel = this._createInfoPanel(result);
    wrapper.appendChild(infoPanel);

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'gel-canvas';
    this.canvas.width = this.layout.canvasWidth * this.dpr;
    this.canvas.height = this.layout.canvasHeight * this.dpr;
    this.canvas.style.width = this.layout.canvasWidth + 'px';
    this.canvas.style.height = this.layout.canvasHeight + 'px';

    this.ctx = this.canvas.getContext('2d');
    this.ctx.scale(this.dpr, this.dpr);

    this._drawGel(result);

    wrapper.appendChild(this.canvas);

    const controlsPanel = this._createControlsPanel(result);
    wrapper.appendChild(controlsPanel);

    container.appendChild(wrapper);

    this._wireExportButton();
    modal.classList.add('show');
  }

  _wireExportButton() {
    const headerExportBtn = document.getElementById('exportGelBtn');
    if (headerExportBtn) {
      const newBtn = headerExportBtn.cloneNode(true);
      headerExportBtn.parentNode.replaceChild(newBtn, headerExportBtn);
      newBtn.id = 'exportGelBtn';
      newBtn.addEventListener('click', () => this._exportPNG());
    }
  }

  _createInfoPanel(result) {
    const panel = document.createElement('div');
    panel.className = 'gel-info-panel';

    const schemeOptions = Object.entries(this.colorSchemes)
        .map(
            ([key, val]) => `<option value="${key}"${key === this._currentScheme ? ' selected' : ''}>${val.name}</option>`,
        )
        .join('');

    panel.innerHTML = `
      <div class="gel-info-header">
        <span class="gel-info-title">Gel Electrophoresis</span>
        <span class="gel-info-subtitle">${result.gelPercentage}% agarose | ${result.ladderType} ladder</span>
      </div>
      <div class="gel-info-stats">
        <div class="gel-stat">
          <span class="gel-stat-label">Enzymes</span>
          <span class="gel-stat-value">${result.enzymes.join(', ') || 'N/A'}</span>
        </div>
        <div class="gel-stat">
          <span class="gel-stat-label">Fragments</span>
          <span class="gel-stat-value">${result.totalFragments}</span>
        </div>
        <div class="gel-stat">
          <span class="gel-stat-label">Range</span>
          <span class="gel-stat-value">${result.gelConfig.effectiveRange[0].toLocaleString()}-${result.gelConfig.effectiveRange[1].toLocaleString()} bp</span>
        </div>
        <div class="gel-stat">
          <span class="gel-stat-label">Chromosome</span>
          <span class="gel-stat-value">${result.chromosome}</span>
        </div>
      </div>
      <div class="gel-color-scheme-row">
        <label for="gelColorSchemeSelect" class="gel-color-scheme-label">Stain / Color:</label>
        <select id="gelColorSchemeSelect" class="gel-color-scheme-select">${schemeOptions}</select>
      </div>
    `;

    const select = panel.querySelector('#gelColorSchemeSelect');
    select.addEventListener('change', (e) => {
      this._currentScheme = e.target.value;
      if (this._currentResult) {
        this._redraw();
      }
    });

    return panel;
  }

  _redraw() {
    if (!this.canvas || !this.ctx || !this._currentResult) return;

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.dpr, this.dpr);
    this._drawGel(this._currentResult);
  }

  _createControlsPanel(result) {
    const panel = document.createElement('div');
    panel.className = 'gel-controls-panel';

    const sizeTable = this._createSizeTable(result);

    panel.appendChild(sizeTable);
    return panel;
  }

  _createSizeTable(result) {
    const table = document.createElement('div');
    table.className = 'gel-size-table';

    const sortedFragments = result.fragmentSizes.map((size, i) => ({index: i + 1, size}));
    sortedFragments.sort((a, b) => b.size - a.size);

    const rows = sortedFragments
        .map((f) => `<tr><td>${f.index}</td><td>${f.size.toLocaleString()} bp</td></tr>`)
        .join('');

    table.innerHTML = `
      <div class="gel-size-table-title">Fragment Sizes</div>
      <table>
        <thead><tr><th>#</th><th>Size</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
    return table;
  }

  _getScheme() {
    return this.colorSchemes[this._currentScheme] || this.colorSchemes.ethidium_bromide;
  }

  _drawGel(result) {
    const {ctx, layout} = this;
    const {gelLeft, gelRight} = layout;
    const scheme = this._getScheme();

    // Fill canvas with dark background
    ctx.fillStyle = layout.canvasBgColor || '#12121a';
    ctx.fillRect(0, 0, layout.canvasWidth, layout.canvasHeight);

    this._drawGelBackground();
    this._drawGelGradient();

    const hasLadder = result.showLadder && result.ladderBands && result.ladderBands.length > 0;
    const numLanes = 1 + (hasLadder ? 1 : 0);
    const gelWidth = gelRight - gelLeft;

    // Distribute lanes evenly with a max width
    const laneWidth = Math.min(80, (gelWidth * 0.7) / Math.max(1, numLanes));
    const totalLanesWidth = numLanes * laneWidth;
    const spacing = (gelWidth - totalLanesWidth) / (numLanes + 1);

    let currentX = gelLeft + spacing;

    if (hasLadder) {
      this._drawLane(currentX, laneWidth, result.ladderBands, true, result.ladderSizes, scheme);
      this._drawLaneLabel(currentX, laneWidth, 'Ladder', spacing);
      currentX += laneWidth + spacing;
    }

    this._drawLane(currentX, laneWidth, result.bands, false, result.fragmentSizes, scheme);
    this._drawLaneLabel(currentX, laneWidth, result.label || 'Digest', spacing);

    this._drawGelBorder();
    this._drawSizeScale(result);
  }

  _drawGelBackground() {
    const {ctx, layout} = this;
    const {gelLeft, gelRight, gelTop, gelBottom} = layout;

    ctx.fillStyle = layout.gelBgColor;
    ctx.fillRect(gelLeft, gelTop, gelRight - gelLeft, gelBottom - gelTop);
  }

  _drawGelGradient() {
    const {ctx, layout} = this;
    const {gelLeft, gelRight, gelTop, gelBottom} = layout;

    const gradient = ctx.createLinearGradient(gelLeft, gelTop, gelLeft, gelBottom);
    gradient.addColorStop(0, 'rgba(10, 10, 50, 0.0)');
    gradient.addColorStop(0.15, 'rgba(15, 15, 60, 0.15)');
    gradient.addColorStop(0.5, 'rgba(20, 20, 70, 0.08)');
    gradient.addColorStop(0.85, 'rgba(10, 10, 40, 0.05)');
    gradient.addColorStop(1, 'rgba(5, 5, 30, 0.0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(gelLeft, gelTop, gelRight - gelLeft, gelBottom - gelTop);
  }

  _drawGelBorder() {
    const {ctx, layout} = this;
    const {gelLeft, gelRight, gelTop, gelBottom} = layout;

    ctx.strokeStyle = layout.gelBorderColor;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(gelLeft, gelTop, gelRight - gelLeft, gelBottom - gelTop);
  }

  _drawLane(x, width, bands, isLadder, sizes, scheme) {
    const {ctx, layout} = this;
    const {gelTop, gelBottom, wellDepth} = layout;

    ctx.fillStyle = layout.wellColor;
    ctx.fillRect(x + 1, gelTop, width - 2, wellDepth);

    ctx.strokeStyle = 'rgba(60, 60, 120, 0.4)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x + 1, gelTop, width - 2, wellDepth);

    const gelHeight = gelBottom - gelTop - wellDepth;
    const bandCenterX = x + width / 2;

    const sortedBands = bands.slice().sort((a, b) => {
      const posA = a.normalizedPosition !== undefined ? a.normalizedPosition : a.migrationDistance / layout.gelTop;
      const posB = b.normalizedPosition !== undefined ? b.normalizedPosition : b.migrationDistance / layout.gelTop;
      return posA - posB;
    });

    for (const band of sortedBands) {
      if (band.isInWell || band.size <= 0) continue;

      const normalizedPos =
        band.normalizedPosition !== undefined ?
          band.normalizedPosition :
          band.migrationDistance / layout.wellToBottomDistance;

      const yPos = gelTop + wellDepth + normalizedPos * gelHeight;

      if (yPos < gelTop + wellDepth || yPos > gelBottom - 2) continue;

      const intensity = band.intensity || 1.0;
      const bandWidth = band.bandWidth || 0.3;
      const pixelHeight = Math.max(1.5, bandWidth * 8);

      if (isLadder) {
        this._drawBand(bandCenterX, yPos, width * 0.7, pixelHeight, scheme.ladderColor, intensity, scheme);
      } else if (band.isSmear) {
        this._drawSmearBand(bandCenterX, yPos, width * 0.7, pixelHeight * 3, scheme.bandSmearColor, intensity, scheme);
        this._drawBand(bandCenterX, yPos, width * 0.5, pixelHeight, scheme.bandColor, intensity * 0.6, scheme);
      } else {
        this._drawBand(bandCenterX, yPos, width * 0.7, pixelHeight, scheme.bandColor, intensity, scheme);
      }
    }

    if (isLadder && sizes) {
      this._drawLadderSizeLabels(x, width, bands, sizes, gelHeight);
    }
  }

  _drawBand(cx, cy, halfWidth, height, color, intensity, scheme) {
    const {ctx} = this;
    const [eR, eG, eB] = scheme.bandGradientEdge;
    const [mR, mG, mB] = scheme.bandGradientMid;

    ctx.save();

    // Add glowing effect
    ctx.shadowBlur = 12;
    ctx.shadowColor = `rgba(${mR}, ${mG}, ${mB}, ${0.8 * intensity})`;

    const gradient = ctx.createLinearGradient(cx - halfWidth, cy, cx + halfWidth, cy);
    const baseAlpha = 0.3 * intensity;
    gradient.addColorStop(0, `rgba(${eR}, ${eG}, ${eB}, ${baseAlpha})`);
    gradient.addColorStop(0.15, `rgba(${mR}, ${mG}, ${mB}, ${0.7 * intensity})`);
    gradient.addColorStop(0.5, color);
    gradient.addColorStop(0.85, `rgba(${mR}, ${mG}, ${mB}, ${0.7 * intensity})`);
    gradient.addColorStop(1, `rgba(${eR}, ${eG}, ${eB}, ${baseAlpha})`);

    ctx.fillStyle = gradient;

    // Draw with rounded corners for realism
    const x = cx - halfWidth;
    const y = cy - height / 2;
    const w = halfWidth * 2;
    const h = height;
    const r = Math.min(2, h / 2);

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  _drawSmearBand(cx, cy, halfWidth, height, color, intensity, scheme) {
    const {ctx} = this;
    const [sR, sG, sB] = scheme.smearRGB;

    const gradient = ctx.createLinearGradient(cx, cy - height / 2, cx, cy + height / 2);
    gradient.addColorStop(0, `rgba(${sR}, ${sG}, ${sB}, 0.0)`);
    gradient.addColorStop(0.3, `rgba(${sR}, ${sG}, ${sB}, ${0.15 * intensity})`);
    gradient.addColorStop(0.5, `rgba(${sR}, ${sG}, ${sB}, ${0.25 * intensity})`);
    gradient.addColorStop(0.7, `rgba(${sR}, ${sG}, ${sB}, ${0.15 * intensity})`);
    gradient.addColorStop(1, `rgba(${sR}, ${sG}, ${sB}, 0.0)`);

    ctx.fillStyle = gradient;
    ctx.fillRect(cx - halfWidth, cy - height / 2, halfWidth * 2, height);
  }

  _drawLadderSizeLabels(laneX, laneWidth, bands, sizes, gelHeight) {
    const {ctx, layout} = this;
    const {gelTop, wellDepth} = layout;

    ctx.save();
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = layout.sizeLabelColor;
    ctx.textAlign = 'right';

    for (let i = 0; i < bands.length && i < sizes.length; i++) {
      const band = bands[i];
      const size = sizes[i];
      if (!band || !size || size <= 0) continue;

      const normalizedPos =
        band.normalizedPosition !== undefined ? band.normalizedPosition : band.migrationDistance / layout.gelTop;

      const yPos = gelTop + wellDepth + normalizedPos * gelHeight;

      if (yPos < gelTop + wellDepth + 5 || yPos > layout.gelBottom - 5) continue;

      const label = size >= 1000 ? `${(size / 1000).toFixed(size % 1000 === 0 ? 0 : 1)}kb` : `${size}bp`;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillText(label, laneX - 3, yPos + 4);
      ctx.fillStyle = layout.sizeLabelColor;
      ctx.fillText(label, laneX - 4, yPos + 3);
    }

    ctx.restore();
  }

  _drawLaneLabel(x, width, label, spacing = 20) {
    const {ctx, layout} = this;

    ctx.save();
    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = layout.labelColor;
    ctx.textAlign = 'center';

    // Truncate label if it's too long
    let displayLabel = label;
    const maxWidth = width + spacing * 0.9;

    if (ctx.measureText(displayLabel).width > maxWidth) {
      while (displayLabel.length > 3 && ctx.measureText(displayLabel + '...').width > maxWidth) {
        displayLabel = displayLabel.slice(0, -1);
      }
      displayLabel += '...';
    }

    // Move text higher up to avoid overlapping the well
    ctx.fillText(displayLabel, x + width / 2, layout.gelTop - 15);
    ctx.restore();
  }

  _drawSizeScale(result) {
    const {ctx, layout} = this;
    const {gelLeft, gelRight} = layout;

    if (!result.ladderBands || result.ladderBands.length === 0) return;

    ctx.save();
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = layout.scaleLabelColor;
    ctx.textAlign = 'center';

    const scaleSizes = [10000, 5000, 2000, 1000, 500, 200, 100];
    const gelConfig = result.gelConfig;

    for (const size of scaleSizes) {
      if (size < gelConfig.effectiveRange[0] * 0.5 || size > gelConfig.effectiveRange[1] * 2) continue;

      const logMW = Math.log10(size);
      const {a, b, wellToBottom} = this._getGelParamsFromResult(result);
      const migration = a - b * logMW;
      const normalizedPos = Math.max(0, Math.min(1, migration / wellToBottom));

      const yPos =
        layout.gelTop + layout.wellDepth + normalizedPos * (layout.gelBottom - layout.gelTop - layout.wellDepth);

      if (yPos < layout.gelTop + 15 || yPos > layout.gelBottom - 5) continue;

      ctx.strokeStyle = 'rgba(120, 120, 180, 0.18)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(gelLeft, yPos);
      ctx.lineTo(gelRight, yPos);
      ctx.stroke();

      const label = size >= 1000 ? `${size / 1000}kb` : `${size}bp`;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillText(label, gelRight + 26, yPos + 4);
      ctx.fillStyle = layout.scaleLabelColor;
      ctx.fillText(label, gelRight + 25, yPos + 3);
    }

    ctx.restore();
  }

  _getGelParamsFromResult(result) {
    if (result.bands && result.bands.length > 0 && result.bands[0].migrationDistance !== undefined) {
      const sizes = result.fragmentSizes || [];
      if (sizes.length >= 2) {
        const sortedSizes = sizes.slice().sort((a, b) => a - b);
        const small = sortedSizes[0];
        const large = sortedSizes[sortedSizes.length - 1];
        const bands = result.bands.slice().sort((a, b) => b.migrationDistance - a.migrationDistance);
        const d1 = bands[0].migrationDistance;
        const d2 = bands[bands.length - 1].migrationDistance;
        if (d1 !== d2) {
          const b = (d1 - d2) / (Math.log10(large) - Math.log10(small));
          const a = d1 + b * Math.log10(large);
          return {a, b, wellToBottom: Math.max(a, 12)};
        }
      }
    }
    return {a: 9.5, b: 2.7, wellToBottom: 12};
  }

  _exportPNG() {
    if (!this.canvas) {
      console.warn('GelRenderer: No canvas to export');
      return;
    }

    try {
      const dataURL = this.canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = 'gel_electrophoresis.png';
      link.href = dataURL;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('GelRenderer: Export PNG failed:', err);
    }
  }
}

if (typeof window !== 'undefined') {
  window.GelRenderer = GelRenderer;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GelRenderer;
}
